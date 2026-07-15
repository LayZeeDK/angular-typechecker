import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, inject, it } from 'vitest';
import {
  APP_PROJECT,
  LIB_PROJECT,
  assertPerProjectScoping,
  buildCleanEnv,
  commandSucceeds,
  createNgRun,
  findWorkspaceRoot,
  removeTmpDir,
  sh,
  typecheckTarget,
  writeVerdaccioNpmrc,
} from '@workspace/test-util';

// CLI-PNPM e2e (the committed ACV-01 gate #2): the Angular CLI `ng add <pkg>` + `ng run
// <project>:typecheck` flow on a REAL pnpm 11 workspace whose root package.json name
// COLLIDES with the app project name -- the committed, CI-authoritative form of the
// milestone-final realworld-angular real-clone scenario.
//
// WHY THIS SPEC EXISTS (the regression it locks): when an Angular CLI workspace is ALSO
// a pnpm workspace whose root package.json name (`ng-cli-workspace`) equals the
// angular.json app project name, Nx project inference returns a SHADOWING package stub
// for that project (projectType: undefined). Before the ACV-01 fix (commit 1837b25) the
// CLI write-fork read root/projectType from that stub via readProjectConfiguration and
// SILENTLY DROPPED the app BUILD leaf -- wiring the typecheck target with only
// [tsconfig.spec.json] (a root app under-check) or throwing (a subdir app). For a tool
// whose entire value is a COMPLETE type-check, a silently-narrowed target is the worst
// failure mode. The fix reads root/projectType straight from angular.json, so the app
// target keeps the FULL [tsconfig.app.json, tsconfig.spec.json] array. This spec proves
// that end-to-end against the shipped tarball on real pnpm 11 (the deterministic
// inference-level invariant lives in configuration-matrix.spec.ts).
//
// WHY strictDepBuilds: false IS SET (a pnpm <-> install INTERACTION, NOT an
// angular-typechecker defect): pnpm 11's build-script gate (strictDepBuilds, default
// true) makes any `pnpm add`/`pnpm install` exit non-zero (ERR_PNPM_IGNORED_BUILDS)
// while the workspace carries dependencies with unapproved build scripts. The full
// Angular CLI fixture pulls 5-6 transitive native build-script packages
// (@parcel/watcher, esbuild, lmdb, msgpackr-extract, + nx). `ng add`, like `nx add`,
// forwards no flags, so the gate is satisfied DECLARATIVELY via pnpm-workspace.yaml. We
// set `strictDepBuilds: false` (skip ALL build scripts) rather than enumerating those
// packages in `allowBuilds`: the type-check e2e needs none of the native postinstall
// artifacts (only the wiring + `ng run typecheck`), skipping runs ZERO postinstall code
// (the SAFEST posture -- allowBuilds would RUN the approved scripts, incl.
// @parcel/watcher's fragile build-from-source on Windows arm64), and it mirrors npm's
// proven skip-and-succeed on this same fixture (the npm ACV-02 spec). The fixture ships
// no build scripts of its own.
//
// The planted per-leaf codes/anchors, the angular.json target read, the `ng run` runner,
// and the per-project scoping assertions are the shared ng-cli-e2e helpers
// (@workspace/test-util); this spec keeps only the pnpm-specific provisioning.
//
// Runs SEQUENTIALLY on the main tree under the serialized vitest.config.mts + the shared
// globalSetup (build + publish ONCE); CI runs the e2e tier as a per-project matrix (one
// runner per e2e project), and the registry-starting project is serialized
// (parallelism:false), so registry-publishers never race (GUARD-01b).
// Skips cleanly where pnpm is unavailable, and ASSERTS the effective pnpm is 11 (the PM
// major CI provisions), so a <11 host fails loudly rather than reproducing the collision
// on a different PM major.

// keep in sync with ci.yml pnpm/action-setup version
const PNPM_VERSION = '11.9.0';

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

// stripAllNpmConfig strips the process-wide npm_config_registry the globalSetup set
// (which pnpm would otherwise honor over the fixture .npmrc) plus the NX_* runner vars.
const env = buildCleanEnv({ stripAllNpmConfig: true });

// pnpm uses the `npx ng run` prefix.
const ngRun = createNgRun('npx');

// Availability guard: probe pnpm reachability so a host without pnpm skips cleanly
// (CI provisions pnpm 11.9.0 on PATH via pnpm/action-setup).
const pnpmAvailable = commandSucceeds('pnpm --version', {
  cwd: workspaceRoot,
  env,
});

describe('CLI-PNPM: `ng add` on a pnpm-workspace name collision keeps the app build leaf', () => {
  it.skipIf(!pnpmAvailable)(
    'auto-wires the full [build, spec] array under a root name collision and scopes per-project',
    () => {
      const verdaccioUrl = inject('verdaccioUrl');
      const verdaccioToken = inject('verdaccioToken');

      // Re-assert the globalSetup SAFETY invariant: this install reads from local
      // Verdaccio pinned to the numeric IPv4 loopback (T-24-05).
      expect(verdaccioUrl.startsWith('http://127.0.0.1:')).toBe(true);

      const tmp = mkdtempSync(join(tmpdir(), 'atc-ng-pnpm-'));

      try {
        cpSync(fixtureDir, tmp, { recursive: true });
        // The committed fixture ships an npm lockfile; drop it so pnpm-lock.yaml +
        // packageManager: pnpm become the authoritative package-manager signal.
        if (existsSync(join(tmp, 'package-lock.json'))) {
          rmSync(join(tmp, 'package-lock.json'), { force: true });
        }

        // Make it a REAL pnpm 11 workspace INCLUDING the root (`- '.'`): that makes the
        // root package.json a workspace member, and because its `name` is
        // `ng-cli-workspace` (== the app project name) Nx infers a SHADOWING package stub
        // for the app -- the exact ACV-01 gate #2 collision.
        //
        // strictDepBuilds: false skips ALL dependency build scripts. The full Angular CLI
        // fixture pulls 5-6 transitive native build-script packages (@parcel/watcher,
        // esbuild, lmdb, msgpackr-extract, + nx), and pnpm 11's default gate
        // (strictDepBuilds: true) would hard-fail `pnpm install` and `ng add`'s child
        // install with ERR_PNPM_IGNORED_BUILDS. This e2e only needs the wiring +
        // `ng run typecheck` -- none of those native postinstall artifacts -- so skipping
        // ALL build scripts is both sufficient and the SAFEST posture: it runs ZERO
        // postinstall code (more restrictive than an allowBuilds allowlist, which would
        // RUN the approved scripts, incl. @parcel/watcher's fragile build-from-source on
        // Windows arm64). Mirrors npm's proven skip-and-succeed on this same fixture (the
        // npm ACV-02 spec). `ng add`, like `nx add`, forwards no flags, so the gate is
        // satisfied declaratively via this config, not a CLI flag.
        writeFileSync(
          join(tmp, 'pnpm-workspace.yaml'),
          "packages:\n  - '.'\nstrictDepBuilds: false\n",
        );

        // Pin packageManager to pnpm 11 so pnpm self-routes to the gated major (a host
        // PATH pnpm may be a 9.x shim with NO gate); matches CI's pnpm/action-setup.
        const packageJsonPath = join(tmp, 'package.json');
        const packageJson = JSON.parse(
          readFileSync(packageJsonPath, 'utf8'),
        ) as { packageManager?: string };
        packageJson.packageManager = `pnpm@${PNPM_VERSION}`;
        writeFileSync(
          packageJsonPath,
          `${JSON.stringify(packageJson, null, 2)}\n`,
        );

        // Point pnpm/ng at Verdaccio (registry + minted bearer via the nerf-dart auth
        // line). pnpm reads .npmrc natively; http localhost is fine for pnpm.
        writeVerdaccioNpmrc(tmp, verdaccioUrl, verdaccioToken);

        // npm_config_userconfig -> a nonexistent path so the user ~/.npmrc cannot
        // reintroduce a registry/peer override into ng add's npm metadata fetch.
        const pnpmEnv = {
          ...env,
          npm_config_userconfig: join(tmp, '.npmrc.nonexistent'),
        };

        // Non-vacuous baseline: no typecheck target BEFORE ng add.
        expect(typecheckTarget(tmp, APP_PROJECT)).toBeUndefined();
        expect(typecheckTarget(tmp, LIB_PROJECT)).toBeUndefined();

        // Provision the tree + the ng binary + a pnpm-lock.yaml (so ng detects pnpm).
        // With strictDepBuilds: false the build-script gate is disabled, so this exits 0.
        sh('pnpm install --prefer-offline', { cwd: tmp, env: pnpmEnv });

        // Assert the EFFECTIVE pnpm the tmp workspace resolves to is pnpm 11 -- the major
        // CI provisions (pnpm/action-setup) and the one this collision scenario is
        // reproduced under. A host whose effective pnpm is <11 would run the collision on
        // a different PM major than CI; fail loudly instead of passing silently.
        const pnpmVersion = sh('pnpm --version', {
          cwd: tmp,
          env: pnpmEnv,
        }).trim();
        expect(
          Number(pnpmVersion.split('.')[0]),
          `ng-add-ng-run-pnpm must run under pnpm 11 (the PM major CI provisions) to reproduce the collision on a matched PM (got ${pnpmVersion}); enable corepack so the packageManager pin routes, or install pnpm 11`,
        ).toBe(11);

        // The REAL Angular CLI flow: ng detects pnpm -> pnpm install of the local
        // Verdaccio dist (gate disabled) -> runs the ng-add schematic -> auto-wires a
        // typecheck target into EVERY app + library project. Unlike yarn, pnpm's `ng add`
        // DOES run the ng-add schematic (nx resolves via pnpm's virtual store).
        sh('npx ng add angular-typechecker --skip-confirmation', {
          cwd: tmp,
          env: pnpmEnv,
        });

        // REGRESSION LOCK (the point of this spec): under the root name collision the
        // app target keeps the FULL two-element [build, spec] array -- the app BUILD leaf
        // is NOT silently dropped to [tsconfig.spec.json].
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

        // No stray nx.json (the Angular CLI init fork seeds no Nx caching).
        expect(() => readFileSync(join(tmp, 'nx.json'), 'utf8')).toThrow();

        // CLEAN baseline: each target type-checks the pristine scaffold GREEN (exit 0).
        const appClean = ngRun(tmp, `${APP_PROJECT}:typecheck`, pnpmEnv);
        expect(appClean.code, appClean.stdout).toBe(0);
        const libClean = ngRun(tmp, `${LIB_PROJECT}:typecheck`, pnpmEnv);
        expect(libClean.code, libClean.stdout).toBe(0);

        // Plant DISTINCT per-leaf errors and prove per-project scoping under real pnpm.
        // The app-component (TS2322) surfacing at runtime is the live confirmation that
        // the app BUILD leaf is actually checked, reinforcing the tsConfig-array
        // assertion above.
        assertPerProjectScoping({ tmp, ngRun, env: pnpmEnv });
      } finally {
        removeTmpDir(tmp);
      }
    },
    900000,
  );
});
