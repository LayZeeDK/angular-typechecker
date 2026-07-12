import { execSync } from 'node:child_process';
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
  buildCleanEnv,
  commandSucceeds,
  findWorkspaceRoot,
  removeTmpDir,
  sh,
  writeVerdaccioNpmrc,
  type RunResult,
} from '@workspace/test-util';

// CLI-YARN e2e: the Angular CLI `ng add <pkg>` (install) + `ng g <pkg>:ng-add` (wire) +
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
// INSTALL + WIRE PATH: the REAL `ng add angular-typechecker` does the INSTALL -- it
// resolves the LOCAL unreleased Verdaccio dist and installs angular-typechecker PLUS `nx`
// (a DIRECT dependency since Plan 24-04, so yarn pulls it transitively; yarn does NOT
// auto-install the `@nx/devkit` peer that npm/pnpm add -- the pre-24-04 crash was
// "Cannot find module 'nx/src/devkit-exports'"). Both registries point at Verdaccio (the
// tmp `.npmrc` (writeVerdaccioNpmrc) feeds Angular CLI's npm-based metadata fetch,
// `.yarnrc.yml` feeds yarn's actual install).
//
// BUT under yarn, `ng add` INSTALLS WITHOUT AUTO-WIRING. Root cause, PINNED 2026-07-12 by an
// instrumented first-run `ng add` against Verdaccio (see the resolved debug doc): the CLI's
// registry-metadata gate reports hasSchematics=true (Angular CLI DOES see `schematics` via
// `yarn npm info` -- it is NOT a metadata-stripping issue), but the post-install
// `createSchematic('ng-add')` PROBE in @angular/cli's add command throws while LOADING this
// package's ng-add factory. That factory is `convertNxGenerator(...)` from `@nx/devkit`, so
// loading it pulls in `nx` + its transitive deps; under yarn 4's node-modules hoist the load
// fails (observed: `TypeError: chalk.blue is not a function` from nx's nested `log-symbols`/`ora`;
// the pre-24-04 form was `Cannot find module 'nx/src/devkit-exports'`), and the add command
// swallows it in a bare `catch {}` -> hasSchematics=false -> "does not provide any ng add
// actions", no wire. npm and pnpm hoist nx's deps so the SAME probe succeeds and they wire the
// identical dist -- so this is NOT an angular-typechecker defect and NOT a collection-resolution
// issue. NOTE (scope): it is NOT established that a vanilla (Nx-free) Angular schematic also fails
// the probe under yarn, so this is scoped to this package's `@nx/devkit`-based factory, NOT
// asserted as a general Angular-CLI-under-yarn bug. The schematic ITSELF runs fine under yarn (the
// probe is a pre-check, not execution), so wiring is performed with an explicit
// `ng g angular-typechecker:ng-add` (the plan's authorized `ng add`-misbehaves -> `ng g` fallback;
// a SECOND `ng add` also wires, via the CLI's already-installed short-circuit). The spec asserts
// the no-wire state right after `ng add` to lock the quirk.
//
// yarn 4 is delivered via corepack, pinned to one literal; the spec skips cleanly where
// corepack yarn is unavailable. Runs SEQUENTIALLY on the main tree under the serialized
// vitest.config.mts + the shared globalSetup (build + publish ONCE); the CI e2e job stays
// --parallel=1 (GUARD-01b).

const YARN_VERSION = '4.17.0';

// Rendered diagnostic codes (full 'TSxxxx' token, not a bare 4-digit substring, so an
// unrelated 4-digit occurrence in a hash/offset cannot false-PASS). DISTINCT per leaf.
const APP_COMPONENT_CODE = 'TS2322'; // app build leaf (tsconfig.app.json)
const APP_SPEC_CODE = 'TS2345'; // app spec leaf (tsconfig.spec.json)
const LIB_COMPONENT_CODE = 'TS2554'; // lib build leaf (projects/my-lib/tsconfig.lib.json)

const APP_PROJECT = 'ng-cli-workspace';
const LIB_PROJECT = 'my-lib';

// Clean committed anchors + broken replacements (JSON.stringify keeps them ASCII-only).
const APP_COMPONENT_ANCHOR =
  "protected readonly title = signal('ng-cli-workspace');";
const APP_COMPONENT_INJECTION = `${APP_COMPONENT_ANCHOR}\n  protected readonly appTypeError: string = ${JSON.stringify(
  123,
)};`;
const APP_SPEC_INJECTION = `\n// planted app spec-leaf error (per-project scoping proof)\nMath.abs(${JSON.stringify(
  'planted-app-spec-arg',
)});\n`;
const LIB_COMPONENT_ANCHOR = 'export class MyLib {';
const LIB_COMPONENT_INJECTION = `export class MyLib {\n  protected readonly libTypeError = parseInt();`;

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

// Availability guard: yarn 4 is corepack-delivered, so probe ACTUAL provisioning of the
// pinned version (a host with corepack but no network to fetch it skips cleanly).
const corepackAvailable = commandSucceeds(
  `corepack yarn@${YARN_VERSION} --version`,
  { cwd: workspaceRoot, env },
);

interface TypecheckArchitectTarget {
  builder?: string;
  options?: { tsConfig?: unknown };
}

function typecheckTarget(
  cwd: string,
  project: string,
): TypecheckArchitectTarget | undefined {
  const angularJson = JSON.parse(
    readFileSync(join(cwd, 'angular.json'), 'utf8'),
  ) as {
    projects?: Record<
      string,
      { architect?: Record<string, TypecheckArchitectTarget> }
    >;
  };

  return angularJson.projects?.[project]?.architect?.['typecheck'];
}

// `corepack yarn ng run <target>` (yarn resolves the local node_modules/.bin/ng under
// nodeLinker: node-modules). execSync throws on non-zero exit, so the catch captures a
// failing typecheck's combined output + code (NEVER pipe ng through head/rg -- the tail's
// exit code would mask ng's).
function ngRun(
  cwd: string,
  target: string,
  runEnv: NodeJS.ProcessEnv,
): RunResult {
  try {
    const stdout = execSync(`corepack yarn ng run ${target}`, {
      cwd,
      env: runEnv,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });

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

// Apply an anchor -> replacement injection, asserting the anchor was found (a scaffold
// move fails LOUDLY instead of silently planting nothing).
function plant(path: string, anchor: string, replacement: string): void {
  const original = readFileSync(path, 'utf8');
  const injected = original.replace(anchor, replacement);

  expect(injected, `anchor not found in ${path}: ${anchor}`).not.toBe(original);
  writeFileSync(path, injected);
}

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
    'ng add installs, ng g wires every project, catches planted leaf errors -- %s layout',
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
        // from Verdaccio + the ng-add schematic auto-wires every app + library project.
        // No explicit `nx` install: Plan 24-04 declared `nx` a DIRECT dependency of
        // angular-typechecker, so `yarn add angular-typechecker` (which `ng add` runs)
        // installs it transitively -- yarn installs direct deps and only skips the
        // `@nx/devkit` peer that npm/pnpm auto-add (the pre-24-04 crash was
        // "Cannot find module 'nx/src/devkit-exports'" when that peer was absent).
        sh('corepack enable', { cwd: tmp, env: npmEnv });
        sh('corepack yarn install', { cwd: tmp, env: npmEnv });
        // The REAL `ng add` does the install: yarn resolves the local Verdaccio dist +
        // `nx` transitively (24-04's direct dependency), so no explicit `nx` install is
        // needed (yarn skips only the `@nx/devkit` peer that npm/pnpm add).
        sh('corepack yarn ng add angular-typechecker --skip-confirmation', {
          cwd: tmp,
          env: npmEnv,
        });

        // YARN QUIRK (locked): `ng add` INSTALLED angular-typechecker but did NOT wire --
        // Angular CLI's post-install ng-add detection silently fails under yarn's
        // node-modules layout (npm/pnpm both wire on the identical package). Assert the
        // no-wire state so a future Angular CLI change that starts auto-wiring under yarn
        // is noticed; then wire with the schematic explicitly below.
        expect(typecheckTarget(tmp, APP_PROJECT)).toBeUndefined();
        expect(typecheckTarget(tmp, LIB_PROJECT)).toBeUndefined();

        // Wire via the ng-add schematic (runs fine under yarn) -- auto-wires EVERY app +
        // library project in one command. This is the plan's authorized
        // `ng add`-misbehaves -> `ng g` fallback.
        sh('corepack yarn ng g angular-typechecker:ng-add', {
          cwd: tmp,
          env: npmEnv,
        });

        // Auto-wire-ALL: both projects gained the typecheck target with the published
        // builder id + the two-element [build, spec] leaf array.
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

        // Plant DISTINCT per-leaf errors and prove per-project scoping under real yarn:
        // the app target catches its own app-component (TS2322) + app-spec (TS2345)
        // leaves and NOT the library's leaf; the library target catches only TS2554.
        plant(
          join(tmp, 'src', 'app', 'app.ts'),
          APP_COMPONENT_ANCHOR,
          APP_COMPONENT_INJECTION,
        );
        const appSpecPath = join(tmp, 'src', 'app', 'app.spec.ts');
        writeFileSync(
          appSpecPath,
          `${readFileSync(appSpecPath, 'utf8')}${APP_SPEC_INJECTION}`,
        );
        plant(
          join(tmp, 'projects', 'my-lib', 'src', 'lib', 'my-lib.ts'),
          LIB_COMPONENT_ANCHOR,
          LIB_COMPONENT_INJECTION,
        );

        const appBad = ngRun(tmp, `${APP_PROJECT}:typecheck`, npmEnv);
        expect(appBad.code, appBad.stdout).not.toBe(0);
        expect(appBad.stdout).toContain(APP_COMPONENT_CODE);
        expect(appBad.stdout).toContain(APP_SPEC_CODE);
        expect(appBad.stdout).not.toContain(LIB_COMPONENT_CODE);
        // The CJS executor's dynamic import() of the ESM compiler-cli survived a real
        // yarn install + `ng run`; the non-zero exit is a real diagnostic, not a crash.
        expect(appBad.stdout).not.toMatch(/ERR_REQUIRE_ESM/);
        expect(appBad.stdout).not.toContain('infrastructure error');

        const libBad = ngRun(tmp, `${LIB_PROJECT}:typecheck`, npmEnv);
        expect(libBad.code, libBad.stdout).not.toBe(0);
        expect(libBad.stdout).toContain(LIB_COMPONENT_CODE);
        expect(libBad.stdout).not.toContain(APP_COMPONENT_CODE);
        expect(libBad.stdout).not.toContain(APP_SPEC_CODE);
        expect(libBad.stdout).not.toMatch(/ERR_REQUIRE_ESM/);
        expect(libBad.stdout).not.toContain('infrastructure error');
      } finally {
        removeTmpDir(tmp);
      }
    },
    900000,
  );
});
