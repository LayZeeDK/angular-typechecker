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

// TEST-05: THE tracer bullet (D-22). 05-02 proved the packed tarball is SHAPED
// correctly (publint/attw against the .tgz); this smoke proves it actually WORKS
// from a clean consumer install. It packs the exact artifact `nx release publish`
// would ship, installs it into an isolated per-run tmp workspace with NO
// peer-resolution override flag (B-03 honesty), and runs the executor by its
// PUBLISHED id both green and against a deliberately broken source. The pairing is
// what distinguishes "the check ran and passed" from "a no-op exited 0" -- a
// type-checker that lies is worse than none. Runs SEQUENTIALLY on the main tree
// (D-17/D-22); real npm pack/install + nx run are worktree-hostile.

// The rendered TS diagnostic code the injection deliberately triggers. Asserting
// the full 'TS2322' token (not a bare 4-digit '2322' substring) keeps the check
// from false-PASSing on an unrelated 4-digit occurrence in a stack trace / hash /
// offset. Hoisted to one place so a future code change is a single edit (IN-02).
const INJECTED_TS_CODE = 'TS2322';

// The published, unscoped executor id the fixture wires (D-18). The dev
// workspace-scoped key would NOT bind in a consumer install.
const TARGET = 'consumer-app:angular-typecheck';

// Resolve the workspace root from this spec's location
// (e2e/angular-typechecker-install-e2e/src/<file>) -- 3 dirs up -- so every path
// is cwd-independent (D-17 main tree).
const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const distDir = join(workspaceRoot, 'dist', 'packages', 'angular-typechecker');
const fixtureDir = join(
  workspaceRoot,
  'e2e',
  'angular-typechecker-install-e2e',
  'fixtures',
  'consumer-app',
);

// CRITICAL (nested-nx isolation): this spec runs UNDER `nx run
// <install-e2e>:test`, so the outer Nx runner injects env vars into this process
// that a naive `...process.env` would propagate into the nested `nx run` /
// `npm install` and silently corrupt the smoke. NX_SKIP_NX_CACHE in particular
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
  // 04-02 hand-off) keeps stdout un-split by ANSI for the TS2322 assertion.
  return {
    ...cleaned,
    NX_DAEMON: 'false',
    FORCE_COLOR: '0',
  };
}

const env = buildCleanEnv();

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
// is the per-run tmp workspace (the installed-from-tarball consumer), NOT the dev
// workspaceRoot.
function run(cwd: string): RunResult {
  try {
    const stdout = execSync(
      `npx nx run ${TARGET} --output-style=static`,
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
  // stale dist would smoke-test a stale artifact -- Pitfall 6). --skip-nx-cache
  // forces a real emit even when the outer run is cached.
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

describe('TEST-05: a clean install of the packed tarball resolves + runs the executor', () => {
  it('packs -> clean tmp install (no peer override) -> green run exit 0 -> injected TS2322 non-zero + no ERR_REQUIRE_ESM', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'atc-smoke-'));

    try {
      // Copy the committed consumer fixture into the tmp workspace. We do NOT
      // copy this repo's .npmrc (it sets the peer override) -- D-20 honesty.
      // Because tmp lives under the OS temp dir, the repo .npmrc is not in tmp's
      // ancestor chain either; the empty .npmrc below makes that airtight.
      cpSync(fixtureDir, tmp, { recursive: true });

      // An explicit EMPTY project .npmrc guarantees no inherited peer override
      // (B-03): a clean install must honestly succeed or ERESOLVE.
      writeFileSync(join(tmp, '.npmrc'), '');

      // Install the freshly-packed tarball with NO peer-resolution override flag.
      // If this ERESOLVEs on the published peer ranges (D-06), that is a REAL
      // FINDING -- let the test FAIL surfacing it; do NOT auto-add the override
      // (the remediation is escalated per B-03). npm_config_userconfig -> a path
      // that does not exist so the user ~/.npmrc cannot reintroduce an override.
      execSync(`npm install ${JSON.stringify(tarballPath)}`, {
        cwd: tmp,
        env: { ...env, npm_config_userconfig: join(tmp, '.npmrc.nonexistent') },
        encoding: 'utf8',
      });

      // Sanity: the installed package's executor entry is resolvable from the tmp
      // consumer's node_modules -- proves the executor resolves FROM the install,
      // not from a dev path-alias (D-18). This is the cheap require()-the-package
      // check left to discretion in D-18.
      const installedExecutorsManifest = join(
        tmp,
        'node_modules',
        'angular-typechecker',
        'executors.json',
      );
      const executorsManifest = JSON.parse(
        readFileSync(installedExecutorsManifest, 'utf8'),
      ) as { executors: Record<string, { implementation: string }> };
      expect(
        executorsManifest.executors['angular-typecheck'],
      ).toBeDefined();

      // GREEN: the committed fixture type-checks clean from the installed package.
      const green = run(tmp);
      expect(green.code).toBe(0);

      // Inject a known TS2322 into the TMP copy's component source. Because the
      // tmp workspace is discarded via rmSync, mutating the copy is inherently
      // crash-safe -- no .pristine sidecar needed (D-18). Build the broken line
      // via JSON.stringify (no quote/apostrophe escaping hazard; ASCII-only).
      const componentPath = join(tmp, 'src', 'app.component.ts');
      const original = readFileSync(componentPath, 'utf8');
      const injected = original.replace(
        "readonly label: string = 'angular-typechecker install smoke';",
        `readonly broken: number = ${JSON.stringify('str')};\n  readonly label: string = 'angular-typechecker install smoke';`,
      );
      expect(injected).not.toBe(original);
      writeFileSync(componentPath, injected);

      // INJECTED: the installed executor must report the deliberate type error and
      // exit non-zero. All four together prove the packaged check actually ran:
      //   (1) non-zero exit,
      //   (2) the real rendered TS2322 token is in stdout (the check ran, not a
      //       no-op exit 0),
      //   (3) NO ERR_REQUIRE_ESM -- the CJS executor's dynamic import() of the
      //       ESM compiler-cli survived packaging (D-19),
      //   (4) NO infra-error meta message -- the non-zero exit is the real
      //       diagnostic, not an unrelated crash masquerading as a finding.
      const bad = run(tmp);
      expect(bad.code).not.toBe(0);
      expect(bad.stdout).toContain(INJECTED_TS_CODE);
      expect(bad.stdout).not.toMatch(/ERR_REQUIRE_ESM/);
      expect(bad.stdout).not.toContain('infrastructure error');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
