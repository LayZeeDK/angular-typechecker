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

// CLI-YARN e2e: the Angular CLI `ng add <pkg>` (install + AUTO-WIRE) +
// `ng run <project>:typecheck` flow on a REAL yarn 4 (berry) workspace, in BOTH the flat
// layout (single package.json, no `workspaces` field) and the yarn-workspace layout
// (root `workspaces: ['projects/*']`, which makes the library a workspace member whose
// package.json `name` `my-lib` collides with its angular.json project name -- proving,
// end-to-end with real yarn, that a yarn `workspaces` name collision does NOT shadow the
// project the way a pnpm-workspace one does; see configuration-matrix.spec.ts).
//
// This is the yarn analogue of ng-add-ng-run.e2e.spec.ts (ACV-02, npm/flat) and fills
// the CLI x yarn x {flat, workspace} cells of the workspace matrix.
//
// FIRST-RUN AUTO-WIRE (24-06 / Option C): the REAL `ng add angular-typechecker` does the
// INSTALL -- it resolves the LOCAL unreleased Verdaccio dist and installs
// angular-typechecker PLUS `nx` (a DIRECT dependency since Plan 24-04, so yarn pulls it
// transitively) -- AND auto-wires a typecheck target into every application + library
// project on the FIRST run under yarn. Both registries point at Verdaccio (the tmp
// `.npmrc` (writeVerdaccioNpmrc) feeds Angular CLI's npm-based metadata fetch, `.yarnrc.yml`
// feeds yarn's actual install).
//
// Why first-run auto-wire now works under yarn: the ng-add schematic is a VANILLA
// `@angular-devkit/schematics` Rule that never loads the Nx devkit / nx runtime (24-06).
// Previously the schematic was an Nx-generator conversion, so the Angular CLI's post-install
// `createSchematic('ng-add')` probe pulled in nx's transitive `ora -> log-symbols -> chalk`
// chain, which throws `chalk.blue is not a function` under yarn 4's last-in-wins hoist; the
// add command swallowed it in a bare `catch {}` -> "does not provide any ng add actions" ->
// no wire (npm/pnpm hoist nx's deps so the same probe succeeded). The nx-free execution path
// removes that chain entirely, so `ng add` auto-wires the first run on every package manager.
//
// The planted per-leaf codes/anchors, the angular.json target read, the `ng run` runner,
// and the per-project scoping assertions are the shared ng-cli-e2e helpers
// (@workspace/test-util); this spec keeps only the yarn-specific provisioning.
//
// yarn 4 is delivered via corepack, pinned to one literal; the spec skips cleanly where
// corepack yarn is unavailable. Runs SEQUENTIALLY on the main tree under the serialized
// vitest.config.mts + the shared globalSetup (build + publish ONCE); the CI e2e job stays
// --parallel=1 (GUARD-01b).

const YARN_VERSION = '4.17.0';

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

// stripAllNpmConfig: the globalSetup sets npm_config_registry process-wide; stripping it
// (and every npm_config_*) keeps nested invocations clean. yarn 4 reads its registry from
// .yarnrc.yml, so the strip does not affect yarn's Verdaccio targeting.
const env = buildCleanEnv({ stripAllNpmConfig: true });

// yarn uses the `corepack yarn ng run` prefix (yarn resolves node_modules/.bin/ng
// under nodeLinker: node-modules).
const ngRun = createNgRun('corepack yarn');

// Availability guard: yarn 4 is corepack-delivered, so probe ACTUAL provisioning of the
// pinned version (a host with corepack but no network to fetch it skips cleanly).
const corepackAvailable = commandSucceeds(
  `corepack yarn@${YARN_VERSION} --version`,
  { cwd: workspaceRoot, env },
);

// Make the tmp copy a real yarn 4 workspace at local Verdaccio. `layout: 'workspace'`
// adds the root `workspaces: ['projects/*']` (the library becomes a workspace member).
function setupYarnWorkspace(
  tmp: string,
  verdaccioUrl: string,
  verdaccioToken: string,
  layout: 'flat' | 'workspace',
): void {
  const packageJsonPath = join(tmp, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    packageManager?: string;
    workspaces?: string[];
  };
  packageJson.packageManager = `yarn@${YARN_VERSION}`;

  if (layout === 'workspace') {
    packageJson.workspaces = ['projects/*'];
  }

  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

  // yarn 4 config (mirrors nx-add-yarn.e2e.spec.ts, all load-bearing):
  // nodeLinker node-modules (real tree for ng + require()); npmRegistryServer/authToken
  // (yarn 4 auth form); unsafeHttpWhitelist 127.0.0.1 (yarn blocks http by default);
  // npmMinimalAgeGate 0 (yarn quarantines the seconds-old Verdaccio publish otherwise);
  // enableImmutableInstalls false (yarn auto-enables immutable under CI env); per-fixture
  // cache so the LOCAL published dist is used, not a globally-cached copy.
  //
  // enableMirror false is LOAD-BEARING (the CLI-YARN root cause): with the default
  // enableMirror: true, yarn -- even under enableGlobalCache: false -- serves a package
  // from the developer/CI global mirror (globalFolder) BY LOCATOR, i.e. by
  // `angular-typechecker@npm:<version>`, WITHOUT re-verifying the tarball against the
  // resolved registry. Because the local Verdaccio dist and the public-npm release share
  // the SAME version (0.2.0), a stale public-npm 0.2.0 sitting in the global mirror --
  // one that PREDATES the Angular CLI `schematics` surface -- gets copied into the
  // per-fixture cache instead of the fresh Verdaccio dist, so `ng add
  // angular-typechecker` errors "does not support schematics". Disabling the mirror
  // makes yarn ignore the global mirror entirely and download the fresh Verdaccio tarball
  // into the (fresh, per-fixture) cacheFolder. (nx-add-yarn dodged this only because the
  // stale zip still carried `generators`, all `nx add`'s init needs; the Angular CLI flow
  // needs the newer `schematics`, absent from the stale zip.)
  const yarnrc = [
    'nodeLinker: node-modules',
    `npmRegistryServer: "${verdaccioUrl}"`,
    `npmAuthToken: "${verdaccioToken}"`,
    'unsafeHttpWhitelist:',
    '  - 127.0.0.1',
    'npmMinimalAgeGate: 0',
    'enableTelemetry: false',
    'enableImmutableInstalls: false',
    'cacheFolder: ./.yarn/cache',
    'enableGlobalCache: false',
    'enableMirror: false',
    '',
  ].join('\n');
  writeFileSync(join(tmp, '.yarnrc.yml'), yarnrc);

  // Angular CLI's `ng add` resolves the package version via its npm-based metadata
  // fetch (which reads .npmrc, NOT .yarnrc.yml), so BOTH registries must point at
  // Verdaccio for ng add to resolve the local dist under yarn.
  writeVerdaccioNpmrc(tmp, verdaccioUrl, verdaccioToken);
}

describe('CLI-YARN: `ng add` + `ng run :typecheck` on a real yarn 4 workspace', () => {
  it.skipIf(!corepackAvailable).each(['flat', 'workspace'] as const)(
    'ng add installs and auto-wires every project, catches planted leaf errors -- %s layout',
    (layout) => {
      const verdaccioUrl = inject('verdaccioUrl');
      const verdaccioToken = inject('verdaccioToken');

      expect(verdaccioUrl.startsWith('http://127.0.0.1:')).toBe(true);

      const tmp = mkdtempSync(join(tmpdir(), `atc-ng-yarn-${layout}-`));

      try {
        cpSync(fixtureDir, tmp, { recursive: true });
        // The committed fixture ships an npm lockfile; drop it so yarn.lock +
        // packageManager: yarn become the authoritative package-manager signal.
        if (existsSync(join(tmp, 'package-lock.json'))) {
          rmSync(join(tmp, 'package-lock.json'), { force: true });
        }
        setupYarnWorkspace(tmp, verdaccioUrl, verdaccioToken, layout);

        // Non-vacuous baseline: no typecheck target BEFORE ng-add.
        expect(typecheckTarget(tmp, APP_PROJECT)).toBeUndefined();
        expect(typecheckTarget(tmp, LIB_PROJECT)).toBeUndefined();

        // npm_config_userconfig -> a nonexistent path so the user ~/.npmrc cannot
        // reintroduce a registry/peer override into ng add's npm metadata fetch.
        const npmEnv = {
          ...env,
          npm_config_userconfig: join(tmp, '.npmrc.nonexistent'),
        };

        // corepack enable puts the bare `yarn` shim on PATH; install the fixture deps
        // (real yarn.lock), then run the REAL `ng add` -> yarn installs the local dist
        // from Verdaccio and the VANILLA nx-free ng-add schematic AUTO-WIRES every app +
        // library project on the FIRST run (24-06/Option C). `nx` comes in transitively
        // (Plan 24-04's direct dependency); yarn only skips the `@nx/devkit` peer that
        // npm/pnpm auto-add -- but the vanilla schematic never loads it anyway, so the
        // former yarn no-wire quirk (nx's ora/log-symbols/chalk chain throwing in the
        // CLI's `createSchematic('ng-add')` probe) can no longer occur.
        sh('corepack enable', { cwd: tmp, env: npmEnv });
        sh('corepack yarn install', { cwd: tmp, env: npmEnv });
        sh('corepack yarn ng add angular-typechecker --skip-confirmation', {
          cwd: tmp,
          env: npmEnv,
        });

        // Auto-wire-ALL directly from `ng add`: both projects gained the typecheck target
        // with the published builder id + the two-element [build, spec] leaf array.
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

        // CLEAN baseline: BOTH targets type-check the pristine scaffold GREEN (assert the
        // library baseline too, so the later lib-scoping check is a real regression from a
        // known-green start, matching the npm/pnpm sibling specs).
        const appClean = ngRun(tmp, `${APP_PROJECT}:typecheck`, npmEnv);
        expect(appClean.code, appClean.stdout).toBe(0);
        const libClean = ngRun(tmp, `${LIB_PROJECT}:typecheck`, npmEnv);
        expect(libClean.code, libClean.stdout).toBe(0);

        // Plant DISTINCT per-leaf errors and prove per-project scoping under real yarn.
        assertPerProjectScoping({ tmp, ngRun, env: npmEnv });
      } finally {
        removeTmpDir(tmp);
      }
    },
    900000,
  );
});
