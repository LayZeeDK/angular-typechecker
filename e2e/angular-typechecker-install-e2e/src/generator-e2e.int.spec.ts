import { execSync } from 'node:child_process';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

// GE2E-01 + GE2E-02 (Phase 15): the real-consumer proof of the shipped Phase 14
// generator suite against the freshly-packed tarball. This installs the tarball
// into an isolated tmp copy of the un-wired multi-leaf `consumer-generator`
// fixture, runs `nx g angular-typechecker:configuration`, and asserts the wired
// target + the `init`-seeded `nx.json` targetDefaults (GE2E-01), then runs the
// target to a real WALK verdict: green on clean sources, and a failure carrying
// BOTH the lib-leaf (TS2322) and spec-leaf (TS2345) codes on injected two-leaf
// errors -- proving the solution tsconfig's lib AND spec references were walked
// (GE2E-02). Reuses the matrix-5types / install-smoke harness VERBATIM (only the
// operation changes: generate-then-run instead of run). Runs SEQUENTIALLY on the
// main tree (D-22); real npm pack/install + nested nx run are worktree-hostile.

// The rendered diagnostic codes the two-leaf injection deliberately triggers.
// Asserting the full 'TS2322'/'TS2345' tokens (not bare 4-digit substrings) keeps
// the check from false-PASSing on an unrelated 4-digit occurrence in a stack
// trace / hash / offset (IN-02). DISTINCT codes per leaf (Pitfall 4): a single
// shared code could not distinguish "both leaves walked" from "one walked twice".
const LIB_LEAF_CODE = 'TS2322';
const SPEC_LEAF_CODE = 'TS2345';

// The clean committed anchor lines each injection targets. The lib anchor lives in
// a lib-ONLY source (consumer-generator.util.ts) that NO spec imports, so a TS2322
// injected there can ONLY come from the lib leaf's own program (tsconfig.lib.json's
// src/**/*.ts rootNames) -- it cannot leak in via the spec leaf's import graph the
// way an injection into the imported component would (WR-01). The spec anchor lives
// in the *.spec.ts that only tsconfig.spec.json includes.
const UTIL_ANCHOR_LINE =
  "export const consumerGeneratorLibOnly: string = 'ok';";
const SPEC_ANCHOR_LINE = 'const label: string = component.label;';

// The injected lines, built via JSON.stringify (ASCII-only, no quote/apostrophe
// escaping hazard -- D-05). The lib injection FLIPS the util const's declared type
// to `number` while keeping its string value -> TS2322 (Type 'string' is not
// assignable to type 'number'). The spec injection is a STATEMENT (valid inside the
// `it()` function body -- a `readonly` field would be a syntax error there) passing
// a string where `padStart` requires a number -> TS2345.
const BROKEN_LIB_CONST = `export const consumerGeneratorLibOnly: number = ${JSON.stringify('str')};`;
const BROKEN_STATEMENT = `('x').padStart(${JSON.stringify('str')});`;

// Resolve the workspace root from this spec's location
// (e2e/angular-typechecker-install-e2e/src/<file>); findWorkspaceRoot() walks up to nx.json, so so every path
// is cwd-independent (D-17 main tree), mirroring install-smoke / matrix-5types.
const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

const distDir = join(workspaceRoot, 'dist', 'packages', 'angular-typechecker');
const fixtureDir = join(
  workspaceRoot,
  'e2e',
  'angular-typechecker-install-e2e',
  'fixtures',
  'consumer-generator',
);

// CRITICAL (nested-nx isolation): this spec runs UNDER `nx run
// <install-e2e>:test`, so the outer Nx runner injects env vars into this process
// that a naive `...process.env` would propagate into the nested `nx g` / `nx run`
// / `npm install` and silently corrupt the run. NX_SKIP_NX_CACHE in particular
// (set when the outer test ran with --skip-nx-cache) would change cache behavior;
// the NX_TASK_HASH / NX_FORKED_TASK_EXECUTOR / NX_INVOCATION_ROOT_PID vars mark
// the run as "inner". Strip them all so the nested run is a clean top-level
// invocation regardless of how the outer test was invoked (Phase-4 pattern).
const NX_RUNNER_ENV_KEYS = [
  'NX_SKIP_NX_CACHE',
  'NX_TASK_HASH',
  'NX_INVOCATION_ROOT_PID',
  'NX_FORKED_TASK_EXECUTOR',
  'NX_TASK_TARGET_PROJECT',
  'NX_TASK_TARGET_TARGET',
  'NX_CLI_SET',
  'NX_TERMINAL_CAPTURE_STDERR',
];

function buildCleanEnv(): NodeJS.ProcessEnv {
  const cleaned: NodeJS.ProcessEnv = { ...process.env };

  for (const key of NX_RUNNER_ENV_KEYS) {
    delete cleaned[key];
  }

  // D-20 honesty: a leaked peer-resolution override (via env or an inherited
  // .npmrc) would MASK a real consumer ERESOLVE on the published peer ranges
  // (B-03). Strip the env form here; the tmp workspace also gets its own empty
  // .npmrc (below) so no ancestor .npmrc is consulted, and we set
  // npm_config_userconfig to a non-existent path so the user-level ~/.npmrc
  // cannot reintroduce it. (The npm config keys use underscores, not the CLI
  // flag form, so they never read as a passed override flag.)
  delete cleaned['npm_config_legacy_peer_deps'];
  delete cleaned['NPM_CONFIG_LEGACY_PEER_DEPS'];

  // NX_DAEMON off so a stale daemon cannot serve an outdated graph. FORCE_COLOR=0
  // (NOT the color-disabling CLI flag: Nx forwards that flag as color:false into
  // the executor options, which the schema's additionalProperties:false rejects;
  // 04-02 hand-off) keeps stdout un-split by ANSI for the code assertions.
  return {
    ...cleaned,
    NX_DAEMON: 'false',
    FORCE_COLOR: '0',
  };
}

const env = buildCleanEnv();

// Best-effort teardown of a per-scenario tmp workspace. On Windows a lingering
// nx subprocess (or a just-installed node_modules handle) can hold the tmp dir
// open past execSync's return, so a bare recursive rmSync EPERMs on the directory
// root -- a lock Node's linear-backoff (maxRetries/retryDelay) may not outwait. A
// failed removal of an OS-temp dir must NEVER fail a scenario whose assertions
// already ran (the CI e2e gate is Linux-only, where recursive rmSync never EPERMs;
// this only manifests in Windows-local dev). Swallow the residual error; the OS
// reclaims the temp dir.
function removeTmpWorkspace(tmp: string): void {
  try {
    rmSync(tmp, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  } catch {
    // best-effort: an OS-temp dir left behind is harmless (unique per mkdtempSync).
  }
}

// Absolute path to the freshly-packed tarball, captured in beforeAll.
let tarballPath = '';

interface RunResult {
  stdout: string;
  code: number;
}

// execSync throws on a non-zero exit -- so the catch is how we capture the
// injected-error non-zero exit + the diagnostic output. NEVER pipe nx through
// head/rg: the pipe tail's exit code masks Nx's (RESEARCH anti-pattern). No
// untrusted string reaches the shell: a fixed target id + fixed flags only. cwd
// is the per-run tmp consumer (the installed-from-tarball workspace), NOT the dev
// workspaceRoot.
function run(cwd: string, target: string): RunResult {
  try {
    // --skip-nx-cache: each green/injected invocation MUST really execute the
    // executor -- the injected re-run must reflect the mutated sources, not a
    // warm coarse cache that could replay a stale GREEN verdict.
    const stdout = execSync(
      `npx nx run ${target} --output-style=static --skip-nx-cache`,
      { cwd, env, encoding: 'utf8' },
    );

    return { stdout, code: 0 };
  } catch (error) {
    const execError = error as {
      stdout?: string;
      stderr?: string;
      status?: number;
    };

    return {
      stdout: `${execError.stdout ?? ''}${execError.stderr ?? ''}`,
      code: execError.status ?? 1,
    };
  }
}

beforeAll(() => {
  // Build a FRESH dist so the packed tarball reflects current source (packing a
  // stale dist would test a stale artifact). --skip-nx-cache forces a real emit
  // even when the outer run is cached. Per-file build+pack (D-08 acceptable
  // fallback) keeps isolation parity with the existing install-e2e specs.
  execSync('npx nx build angular-typechecker --skip-nx-cache', {
    cwd: workspaceRoot,
    env,
    encoding: 'utf8',
  });

  // npm pack --json from the dist dir produces the EXACT artifact `nx release
  // publish` ships and writes the .tgz on disk. Capture its absolute path.
  const packOutput = execSync('npm pack --json', {
    cwd: distDir,
    env,
    encoding: 'utf8',
  });
  const packed = JSON.parse(packOutput) as Array<{ filename: string }>;
  tarballPath = join(distDir, packed[0].filename);
}, 300000);

afterAll(() => {
  // Remove the packed .tgz so each run does not leak an artifact under dist
  // (WR-02). force:true keeps teardown non-fatal if it is already gone.
  if (tarballPath) {
    rmSync(tarballPath, { force: true });
  }
});

describe('GE2E-01/02: configuration wires the walk target + init seeds the cache block, then the target walks both leaves', () => {
  it('generates ONE typecheck target + seeds targetDefaults, runs green clean, and fails with BOTH leaf codes on two-leaf injection', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'atc-gen-'));

    try {
      // Copy the committed un-wired fixture into the tmp workspace. Do NOT copy
      // this repo's .npmrc (it sets the peer override -- D-20 honesty); the empty
      // .npmrc below plus a non-existent npm_config_userconfig make the
      // no-inherited-override guarantee airtight (B-03).
      cpSync(fixtureDir, tmp, { recursive: true });
      writeFileSync(join(tmp, '.npmrc'), '');

      // Install the freshly-packed tarball with NO peer-resolution override flag.
      // A real ERESOLVE on the published peer ranges is a REAL FINDING -- let it
      // surface; do NOT auto-add the override (escalate per B-03).
      execSync(`npm install ${JSON.stringify(tarballPath)}`, {
        cwd: tmp,
        env: { ...env, npm_config_userconfig: join(tmp, '.npmrc.nonexistent') },
        encoding: 'utf8',
      });

      // GE2E-01(b) seeded-from-ABSENT baseline: the tmp fixture nx.json must NOT
      // already carry an `angular-typechecker:typecheck` targetDefaults key BEFORE
      // `nx g configuration` runs init. Without this guard the post-generation
      // "init seeded it" assertion below is vacuous -- if the fixture ever gained
      // the key, init's whole-entry ??= would skip seeding and the later assertion
      // would pass for the wrong reason (Pitfall 5). Mirrors nx-add-e2e's
      // before-absent guard so this spec's "from ABSENT" claim stands on its own
      // and does not depend on a sibling spec (WR-02).
      const before = JSON.parse(readFileSync(join(tmp, 'nx.json'), 'utf8')) as {
        targetDefaults?: Record<string, unknown>;
      };
      expect(
        before.targetDefaults?.['angular-typechecker:typecheck'],
      ).toBeUndefined();

      // Generate the typecheck target. --skipFormat so formatFiles (Prettier) is a
      // no-op (the fixture installs no Prettier). Do NOT pass --output-style=static
      // to `nx g` -- that is a run flag, not a generate flag (Finding 4 / A2).
      execSync(
        'npx nx g angular-typechecker:configuration consumer-generator --skipFormat',
        { cwd: tmp, env, encoding: 'utf8' },
      );

      // GE2E-01(a): the generator wrote exactly ONE `typecheck` target using the
      // UNSCOPED published executor id, pointed at the solution tsconfig.json (the
      // root-level project's D-07 case-2 resolution -- NOT a leaf tsconfig).
      const projectJson = JSON.parse(
        readFileSync(join(tmp, 'project.json'), 'utf8'),
      ) as {
        targets?: Record<
          string,
          { executor?: string; options?: { tsConfig?: string } }
        >;
      };
      const targets = projectJson.targets ?? {};
      expect(Object.keys(targets)).toEqual(['typecheck']);
      expect(targets['typecheck'].executor).toBe(
        'angular-typechecker:typecheck',
      );

      const tsConfig = targets['typecheck'].options?.tsConfig ?? '';
      // Root-level project -> the solution tsconfig resolves to 'tsconfig.json'.
      // Assert it ends at the solution tsconfig and is NOT a leaf (lib/spec), so
      // the assertion survives any Nx path normalization of the root.
      expect(tsConfig.endsWith('tsconfig.json')).toBe(true);
      expect(tsConfig).not.toMatch(/tsconfig\.(lib|spec)\.json$/);

      // GE2E-01(b): `init` (invoked by `configuration`) SEEDED the nx.json
      // targetDefaults from ABSENT. Assert against the init-seeded shape
      // (inputs[0] === 'default'), NOT the fixture nx.json blocks -- the fixture
      // has no such key (D-02). The 'default'-first input is the WALK-02 landmine
      // invariant: 'production' would exclude *.spec.ts and under-hash the walked
      // spec leaf (a stale PASS).
      const nxJson = JSON.parse(readFileSync(join(tmp, 'nx.json'), 'utf8')) as {
        targetDefaults?: Record<
          string,
          { cache?: boolean; outputs?: unknown[]; inputs?: unknown[] }
        >;
      };
      const seeded = nxJson.targetDefaults?.['angular-typechecker:typecheck'];
      expect(seeded).toBeDefined();
      expect(seeded?.cache).toBe(true);
      expect(seeded?.outputs).toEqual([]);
      expect(seeded?.inputs?.[0]).toBe('default');

      // GE2E-02 clean: the committed-clean lib + spec leaves type-check green from
      // the installed package via the just-wired target.
      const green = run(tmp, 'consumer-generator:typecheck');
      expect(green.code).toBe(0);

      // GE2E-02 two-leaf injection (DISTINCT codes -> proves BOTH leaves walked).
      // Lib leaf: flip the declared type of a const in consumer-generator.util.ts --
      // a lib-ONLY file that NO spec imports -- from `string` to `number` while
      // keeping its string value -> TS2322. Because no *.spec.ts imports this file,
      // the spec-leaf program never compiles it, so a TS2322 here can ONLY come from
      // the lib reference being independently walked (WR-01: the previous injection
      // into the imported component also surfaced via the spec's import graph, so it
      // did NOT uniquely attribute to the lib leaf).
      const utilPath = join(tmp, 'src', 'consumer-generator.util.ts');
      const utilOriginal = readFileSync(utilPath, 'utf8');
      const utilInjected = utilOriginal.replace(
        UTIL_ANCHOR_LINE,
        BROKEN_LIB_CONST,
      );
      expect(utilInjected).not.toBe(utilOriginal);
      writeFileSync(utilPath, utilInjected);

      // Spec leaf: a STATEMENT inside the it() body -> TS2345. This code can only
      // originate from the spec file (which only the spec leaf includes), so its
      // presence proves the spec-leaf reference was walked.
      const specPath = join(tmp, 'src', 'consumer-generator.component.spec.ts');
      const specOriginal = readFileSync(specPath, 'utf8');
      const specInjected = specOriginal.replace(
        SPEC_ANCHOR_LINE,
        `${BROKEN_STATEMENT}\n    ${SPEC_ANCHOR_LINE}`,
      );
      expect(specInjected).not.toBe(specOriginal);
      writeFileSync(specPath, specInjected);

      // The wired target must report BOTH deliberate errors and exit non-zero.
      // Together these prove the packaged walk actually ran across both leaves:
      //   (1) non-zero exit,
      //   (2) the lib-leaf TS2322 token is in stdout,
      //   (3) the spec-leaf TS2345 token is in stdout (both walked, not one twice),
      //   (4) NO ERR_REQUIRE_ESM -- the CJS executor's dynamic import() of the ESM
      //       compiler-cli survived packaging,
      //   (5) NO infra-error meta message -- the non-zero exit is the real
      //       diagnostic, not an unrelated crash masquerading as a finding.
      const bad = run(tmp, 'consumer-generator:typecheck');
      expect(bad.code).not.toBe(0);
      expect(bad.stdout).toContain(LIB_LEAF_CODE);
      expect(bad.stdout).toContain(SPEC_LEAF_CODE);
      expect(bad.stdout).not.toMatch(/ERR_REQUIRE_ESM/);
      expect(bad.stdout).not.toContain('infrastructure error');
    } finally {
      removeTmpWorkspace(tmp);
    }
  });
});
