import { cpSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, inject, it } from 'vitest';
import {
  APP_PROJECT,
  LIB_PROJECT,
  assertPerProjectScoping,
  buildCleanEnv,
  createNgRun,
  findWorkspaceRoot,
  removeTmpDir,
  sh,
  typecheckTarget,
  writeVerdaccioNpmrc,
} from '@workspace/test-util';

// ACV-02: the CI-authoritative Angular CLI proof. It installs the SHIPPED tarball
// (published once to local Verdaccio by the shared globalSetup) into a committed,
// pinned Angular 22 workspace fixture, runs the REAL `ng add angular-typechecker`
// (auto-wires a `typecheck` target into EVERY application + library project), then
// runs `ng run <project>:typecheck` per project and proves per-project SCOPING:
// each target catches EXACTLY its own planted leaf errors (app component + app spec
// vs library component) with NO cross-project bleed, and a CLEAN baseline exits 0
// for each. This is the Angular CLI (`ng`) analogue of the Nx `nx add` / `nx run`
// install-e2e specs; it keeps the `@angular/cli` harness SEPARATE (CONTEXT D-03).
//
// The planted per-leaf diagnostic codes/anchors, the angular.json target read, the
// `ng run` runner, and the per-project scoping assertions are the shared ng-cli-e2e
// helpers (@workspace/test-util); this spec keeps only the npm-specific provisioning.
//
// Runs SEQUENTIALLY on the main tree under the serialized vitest.config.mts + the
// shared globalSetup (which builds dist + publishes to the local Verdaccio registry
// ONCE); this spec CONSUMES that registry via inject() and installs the package
// by-name with `ng add` (NOT by packing a shared `.tgz`). It still shares the single
// `dist/` build + the one loopback registry with the sibling e2e projects, so the CI
// e2e job MUST stay `--parallel=1` (GUARD-01b) -- concurrent runs would race the
// shared dist rebuild + registry publish.

// Resolve the workspace root from this spec's location; findWorkspaceRoot() walks
// up to nx.json so every path is cwd-independent (main tree).
const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

const fixtureDir = join(
  workspaceRoot,
  'e2e',
  'angular-typechecker-ng-cli-e2e',
  'fixtures',
  'ng-cli-workspace',
);

// stripAllNpmConfig is load-bearing: the shared globalSetup sets npm_config_registry
// process-wide (inherited by this singleFork worker) and it would outrank the tmp
// .npmrc and retarget the install away from local Verdaccio. Stripping every
// npm_config_* also drops any leaked legacy-peer-deps override so a real on-stack
// ERESOLVE cannot be masked (on-stack Angular 22 must install with NO flag).
const env = buildCleanEnv({ stripAllNpmConfig: true });

// npm/pnpm use the `npx ng run` prefix.
const ngRun = createNgRun('npx');

describe('ACV-02: `ng add` auto-wires every project and `ng run <project>:typecheck` scopes per-project', () => {
  it('installs the tarball, ng-adds all projects, and each typecheck target catches only its own planted leaves', () => {
    const verdaccioUrl = inject('verdaccioUrl');
    const verdaccioToken = inject('verdaccioToken');

    // Re-assert the globalSetup SAFETY invariant: this install reads from local
    // Verdaccio pinned to the numeric IPv4 loopback (T-24-05).
    expect(verdaccioUrl.startsWith('http://127.0.0.1:')).toBe(true);

    const tmp = mkdtempSync(join(tmpdir(), 'atc-ng-cli-'));

    try {
      cpSync(fixtureDir, tmp, { recursive: true });

      // Point npm/ng at Verdaccio (registry + minted bearer via the nerf-dart auth
      // line). The Verdaccio .npmrc is written to the tmp copy ONLY -- never
      // committed into the fixture (T-24-06).
      writeVerdaccioNpmrc(tmp, verdaccioUrl, verdaccioToken);

      // Non-vacuous baseline: neither project carries a `typecheck` target BEFORE
      // `ng add`, so the auto-wire-all assertion below is non-vacuous.
      expect(typecheckTarget(tmp, APP_PROJECT)).toBeUndefined();
      expect(typecheckTarget(tmp, LIB_PROJECT)).toBeUndefined();

      // npm_config_userconfig -> a nonexistent path so the user ~/.npmrc cannot
      // reintroduce a peer override (legacy-peer-deps) into the nested install.
      const npmEnv = {
        ...env,
        npm_config_userconfig: join(tmp, '.npmrc.nonexistent'),
      };

      // Provision the fixture's own Angular 22 deps from the committed
      // package-lock.json. NO --legacy-peer-deps: on-stack Angular 22 installs
      // clean (Pitfall D). sh throws on a non-zero exit, so a real ERESOLVE would
      // FAIL the test rather than be masked (T-24-07 honesty).
      sh('npm install --no-audit --no-fund --prefer-offline', {
        cwd: tmp,
        env: npmEnv,
      });

      // The REAL Angular CLI flow: `ng add` resolves angular-typechecker@latest from
      // Verdaccio, installs it as a devDependency, and runs its ng-add schematic ->
      // auto-wires a `typecheck` architect target into EVERY app + library project.
      sh('npx ng add angular-typechecker --skip-confirmation', {
        cwd: tmp,
        env: npmEnv,
      });

      // Auto-wire-ALL: both the application and the library gained a `typecheck`
      // target using the published builder id + a two-element `tsConfig` array
      // (build leaf + spec leaf) -- the per-project shape ng run consumes.
      const appTarget = typecheckTarget(tmp, APP_PROJECT);
      const libTarget = typecheckTarget(tmp, LIB_PROJECT);
      expect(appTarget?.builder).toBe('angular-typechecker:typecheck');
      expect(libTarget?.builder).toBe('angular-typechecker:typecheck');
      expect(appTarget?.options?.tsConfig).toEqual([
        'tsconfig.app.json',
        'tsconfig.spec.json',
      ]);
      expect(libTarget?.options?.tsConfig).toEqual([
        'projects/my-lib/tsconfig.lib.json',
        'projects/my-lib/tsconfig.spec.json',
      ]);

      // CLEAN baseline: each target type-checks the pristine scaffold GREEN (exit 0).
      const appClean = ngRun(tmp, `${APP_PROJECT}:typecheck`, npmEnv);
      expect(appClean.code, appClean.stdout).toBe(0);
      const libClean = ngRun(tmp, `${LIB_PROJECT}:typecheck`, npmEnv);
      expect(libClean.code, libClean.stdout).toBe(0);

      // Plant DISTINCT per-leaf errors and prove per-project scoping (app catches
      // TS2322 + TS2345 and not TS2554; lib catches TS2554 and neither app code;
      // no ERR_REQUIRE_ESM / infrastructure error either direction).
      assertPerProjectScoping({ tmp, ngRun, env: npmEnv });
    } finally {
      removeTmpDir(tmp);
    }
  }, 600000);
});
