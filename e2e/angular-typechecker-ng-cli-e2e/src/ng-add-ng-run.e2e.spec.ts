import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, inject, it } from 'vitest';
import {
  APP_COMPONENT_ANCHOR,
  APP_COMPONENT_INJECTION,
  APP_PROJECT,
  LIB_PROJECT,
  assertPerProjectScoping,
  buildCleanEnv,
  createNgRun,
  extractJsonPayload,
  findWorkspaceRoot,
  plant,
  removeTmpDir,
  sh,
  typecheckTarget,
  validateSarif,
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
// by-name with `ng add` (NOT by packing a shared `.tgz`). The specs in THIS project
// share the single `dist/` build + the one loopback registry, so they must not run
// concurrently -- the registry-starting project is serialized (parallelism:false), and
// CI runs the e2e tier as a per-project matrix (one runner per e2e project), so no two
// registry-publishers ever race the shared dist rebuild + publish (GUARD-01b).

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

      // VER-03 (ng run adapter): the shipped builder emits a parseable JSON +
      // schema-valid SARIF payload and returns the IDENTICAL exit code across
      // --format human|json|sarif for the SAME input. Unlike the standalone `.bin`
      // shim (the guaranteed-pure stdout proof), `ng run` frames the executor's
      // stdout, so extractJsonPayload isolates the single JSON object and we assert
      // no advisory text is INSIDE the payload boundary (the executor gates advisory
      // notices to the human format, so json/sarif never emit them).
      const appHuman = ngRun(
        tmp,
        `${APP_PROJECT}:typecheck --format human`,
        npmEnv,
      );
      const appJson = ngRun(
        tmp,
        `${APP_PROJECT}:typecheck --format json`,
        npmEnv,
      );
      const appSarif = ngRun(
        tmp,
        `${APP_PROJECT}:typecheck --format sarif`,
        npmEnv,
      );

      // exit-code parity: every format exits 0 on the clean app project.
      expect(appHuman.code, appHuman.stdout).toBe(0);
      expect(appJson.code, appJson.stdout).toBe(0);
      expect(appSarif.code, appSarif.stdout).toBe(0);

      // Observed framing (Angular CLI 22 `ng run <project>:typecheck --format json`):
      // stdout is PURE -- the executor's process.stdout.write(payload) passes straight
      // through and `ng` chrome goes to stderr (leading="" trailing=""). extractJsonPayload
      // stays as a defensive isolation of the single JSON object regardless.
      // json payload: parseable + shaped (formatVersion + diagnostics[] + summary);
      // no advisory text bled into the payload boundary.
      const jsonPayload = extractJsonPayload(appJson.stdout);
      const parsedJson = JSON.parse(jsonPayload) as {
        formatVersion: number;
        summary: unknown;
        diagnostics: unknown[];
      };
      expect(parsedJson.formatVersion).toBe(1);
      expect(Array.isArray(parsedJson.diagnostics)).toBe(true);
      expect(parsedJson.summary).toBeDefined();

      // sarif payload: schema-valid SARIF 2.1.0 (shared dev-only validateSarif). The
      // extractJsonPayload + validateSarif slice is the structural proof no framing
      // bled inside the payload boundary.
      const sarifPayload = extractJsonPayload(appSarif.stdout);
      const sarif = validateSarif(sarifPayload);
      expect(sarif.valid, sarif.errors).toBe(true);

      // exit-code parity under a planted verdict-fail: plant the app-component TS2322
      // and assert the code is IDENTICAL and non-zero across all three formats (the
      // anti-false-pass -- a machine format must never mask the verdict). Restore in
      // a finally so assertPerProjectScoping below runs on the committed-clean tree.
      const appComponentPath = join(tmp, 'src', 'app', 'app.ts');
      const appComponentOriginal = readFileSync(appComponentPath, 'utf8');

      try {
        plant(appComponentPath, APP_COMPONENT_ANCHOR, APP_COMPONENT_INJECTION);

        const redHuman = ngRun(
          tmp,
          `${APP_PROJECT}:typecheck --format human`,
          npmEnv,
        );
        const redJson = ngRun(
          tmp,
          `${APP_PROJECT}:typecheck --format json`,
          npmEnv,
        );
        const redSarif = ngRun(
          tmp,
          `${APP_PROJECT}:typecheck --format sarif`,
          npmEnv,
        );

        expect(redHuman.code, redHuman.stdout).not.toBe(0);
        expect(redJson.code, redJson.stdout).toBe(redHuman.code);
        expect(redSarif.code, redSarif.stdout).toBe(redHuman.code);
      } finally {
        writeFileSync(appComponentPath, appComponentOriginal);
      }

      // Plant DISTINCT per-leaf errors and prove per-project scoping (app catches
      // TS2322 + TS2345 and not TS2554; lib catches TS2554 and neither app code;
      // no ERR_REQUIRE_ESM / infrastructure error either direction).
      assertPerProjectScoping({ tmp, ngRun, env: npmEnv });
    } finally {
      removeTmpDir(tmp);
    }
  }, 600000);
});
