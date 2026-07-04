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
import {
  buildCleanEnv,
  findWorkspaceRoot,
  removeTmpDir,
  run,
  sh,
} from '@workspace/test-util';

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
const TARGET = 'consumer-app:typecheck';

// Resolve the workspace root from this spec's location
// (e2e/angular-typechecker-install-e2e/src/<file>); findWorkspaceRoot() walks up to nx.json, so every path
// is cwd-independent (D-17 main tree).
const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

const distDir = join(workspaceRoot, 'dist', 'packages', 'angular-typechecker');
const fixtureDir = join(
  workspaceRoot,
  'e2e',
  'angular-typechecker-install-e2e',
  'fixtures',
  'consumer-app',
);

// Nested-nx isolation + B-03 honesty: the shared buildCleanEnv strips the outer
// runner's NX_* vars and (default) the legacy-peer-deps override so a leaked
// override cannot MASK a real consumer ERESOLVE, and sets NX_DAEMON=false +
// FORCE_COLOR=0 (FORCE_COLOR, NOT --no-color: Nx forwards --no-color as
// color:false into the executor options, which additionalProperties:false rejects;
// 04-02 hand-off). The tmp workspace also gets its own empty .npmrc + a
// non-existent npm_config_userconfig below so no ancestor config reintroduces it.
const env = buildCleanEnv({ stripAllNpmConfig: true });

// Absolute path to the freshly-packed tarball, captured in beforeAll.
let tarballPath = '';

beforeAll(() => {
  // The project globalSetup already built dist ONCE (finding E1); pack that shared
  // dist -- no redundant per-spec build. npm pack --json from the dist dir produces
  // the EXACT artifact `nx release publish` ships and writes the .tgz on disk.
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
      sh(`npm install ${JSON.stringify(tarballPath)}`, {
        cwd: tmp,
        env: { ...env, npm_config_userconfig: join(tmp, '.npmrc.nonexistent') },
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
      expect(executorsManifest.executors['typecheck']).toBeDefined();

      // GREEN: the committed fixture type-checks clean from the installed package.
      const green = run(tmp, TARGET, { env });
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
      const bad = run(tmp, TARGET, { env });
      expect(bad.code).not.toBe(0);
      expect(bad.stdout).toContain(INJECTED_TS_CODE);
      expect(bad.stdout).not.toMatch(/ERR_REQUIRE_ESM/);
      expect(bad.stdout).not.toContain('infrastructure error');
    } finally {
      removeTmpDir(tmp);
    }
  });
});
