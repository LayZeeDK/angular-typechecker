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

// CLI-YARN e2e: the Angular CLI `ng generate <pkg>:ng-add` + `ng run
// <project>:typecheck` flow on a REAL yarn 4 (berry) workspace, in BOTH the flat
// layout (single package.json, no `workspaces` field) and the yarn-workspace layout
// (root `workspaces: ['projects/*']`, which makes the library a workspace member whose
// package.json `name` `my-lib` collides with its angular.json project name -- proving,
// end-to-end with real yarn, that a yarn `workspaces` name collision does NOT shadow the
// project the way a pnpm-workspace one does; see configuration-matrix.spec.ts).
//
// This is the yarn analogue of ng-add-ng-run.e2e.spec.ts (ACV-02, npm/flat) and fills
// the CLI x yarn x {flat, workspace} cells of the workspace matrix.
//
// INSTALL PATH: the REAL `ng add angular-typechecker`, mirroring the npm ACV-02 spec but
// with yarn as the package manager. Both registries are pinned to local Verdaccio so ng
// add resolves the LOCAL unreleased dist (WITH the Angular CLI schematics), never the
// public-npm 0.2.0 that predates them: the tmp `.npmrc` (writeVerdaccioNpmrc) feeds Angular
// CLI's npm-based package-metadata fetch, and `.yarnrc.yml` feeds yarn's actual install.
// ng detects yarn (yarn.lock + packageManager) -> `yarn add angular-typechecker` -> runs the
// ng-add schematic (auto-wires every app + library project). (We do NOT use
// `ng generate angular-typechecker:ng-add` here: `ng generate <collection>` resolution
// behaves differently under yarn 4's node-modules linker than `ng add` -- "does not support
// schematics" -- whereas `ng add` uses the same install+schematic path proven green under
// npm.) yarn 4 is delivered via corepack, pinned to one literal; the spec skips cleanly where
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

const workspaceRoot = findWorkspaceRoot(dirname(fileURLToPath(import.meta.url)));

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
    '',
  ].join('\n');
  writeFileSync(join(tmp, '.yarnrc.yml'), yarnrc);

  // Angular CLI's `ng add` resolves the package version via its npm-based metadata
  // fetch (which reads .npmrc, NOT .yarnrc.yml), so BOTH registries must point at
  // Verdaccio for ng add to resolve the local dist under yarn.
  writeVerdaccioNpmrc(tmp, verdaccioUrl, verdaccioToken);
}

describe('CLI-YARN: `ng g :ng-add` + `ng run :typecheck` on a real yarn 4 workspace', () => {
  it.skipIf(!corepackAvailable).each(['flat', 'workspace'] as const)(
    'auto-wires every project and catches planted leaf errors — %s layout',
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
        sh('corepack enable', { cwd: tmp, env: npmEnv });
        sh('corepack yarn install', { cwd: tmp, env: npmEnv });
        // [TEMP DIAGNOSTIC] install explicitly, then probe the INSTALLED resolution.
        sh('corepack yarn add -D angular-typechecker', { cwd: tmp, env: npmEnv });
        writeFileSync(
          join(tmp, 'atc-probe.cjs'),
          [
            "console.log('LS_NM=' + require('fs').existsSync('node_modules/angular-typechecker'));",
            "try{const p=require.resolve('angular-typechecker/package.json');console.log('PKGJSON='+p);const j=require(p);console.log('VERSION='+j.version+' SCHEMATICS='+JSON.stringify(j.schematics)+' EXPORTS='+JSON.stringify(j.exports));}catch(e){console.log('PKGJSON_ERR='+e.code+' '+e.message);}",
            "try{console.log('COLLECTION='+require.resolve('angular-typechecker/collection.json'));}catch(e){console.log('COLLECTION_ERR='+e.code+' '+String(e.message).split('\\n')[0]);}",
          ].join('\n'),
        );
        console.log(
          '[ATC-PROBE]\n' +
            sh('corepack yarn node atc-probe.cjs', { cwd: tmp, env: npmEnv }),
        );

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

        // CLEAN baseline: the app target type-checks the pristine scaffold GREEN.
        const appClean = ngRun(tmp, `${APP_PROJECT}:typecheck`, npmEnv);
        expect(appClean.code, appClean.stdout).toBe(0);

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
