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

// CLI-YARN e2e: the ARBITER for the yarn-4 `ng generate
// angular-typechecker:configuration <project>` path. This cell exists to PROVE or
// DISPROVE the `TypeError: chalk.blue is not a function` crash on the SINGLE-project
// `ng generate` command under a real yarn 4 (berry) workspace -- the SECONDARY wiring
// flow the milestone-audit (2026-07-15) flagged as unverified.
//
// Why this is a genuine open question (not covered by ng-add-ng-run-yarn.e2e.spec.ts):
// `ng add` was made a VANILLA nx-free `@angular-devkit/schematics` Rule in 24-06, so
// its load path no longer pulls nx's transitive `ora -> log-symbols -> chalk` chain.
// But `configuration` and `init` are still `convertNxGenerator(...)`-based, so their
// compiled `schematic.js` does `require('@nx/devkit')` at MODULE (factory) LOAD --
// exactly the chain that threw `chalk.blue is not a function` under yarn 4's
// last-in-wins hoist before 24-06. `ng generate` loads `@angular-devkit/schematics`
// (hence chalk v5 via ora@8) into the same yarn-hoisted node_modules, so the strong
// hypothesis is that `ng generate angular-typechecker:configuration` DOES crash on
// yarn 4. This cell settles it empirically; unlike `ng add`'s post-install probe
// (which swallowed the throw in a bare `catch {}`), `ng generate` has no such catch,
// so a crash surfaces LOUDLY as a non-zero exit -- `sh` rethrows it with the captured
// output.
//
// Install is via PLAIN `corepack yarn add -D angular-typechecker` (NOT `ng add`, whose
// nx-free path is already proven): `corepack enable` -> `corepack yarn install` ->
// `corepack yarn add -D angular-typechecker` -> `corepack yarn ng generate
// angular-typechecker:configuration ng-cli-workspace`. `nx` comes in transitively
// (a DIRECT dependency of angular-typechecker since Plan 24-04, so yarn pulls it; yarn
// only skips the `@nx/devkit` peer). Its presence is what makes the current crash
// possible -- the convertNx schematic loads `@nx/devkit` -> nx -> log-symbols@4.
//
// The COMMITTED cell asserts the SUCCESS end-state (target wired + `ng run :typecheck`
// green then catches a planted leaf error, no chalk.blue / ERR_REQUIRE_ESM /
// infrastructure error). If the convertNx schematic crashes, the cell FAILS LOUDLY at
// the `ng generate` step -- that failure IS the "prove", and the executor records the
// verbatim crash output as the gate for the conditional vanilla refactor. The cell
// locks the correct long-term behavior, not the crash.
//
// FLAT layout, APP project `ng-cli-workspace` only: the crash is schematic-factory-load
// (layout-independent) and `configuration` is inherently single-project. yarn 4 is
// corepack-delivered, pinned to one literal; the cell skips cleanly where corepack yarn
// is unavailable. Runs SEQUENTIALLY on the main tree under the serialized
// vitest.config.mts + the shared globalSetup (build + publish ONCE via Verdaccio).

const YARN_VERSION = '4.17.0';

// Rendered diagnostic codes (full 'TSxxxx' token, not a bare 4-digit substring, so an
// unrelated 4-digit occurrence in a hash/offset cannot false-PASS). DISTINCT per leaf.
const APP_COMPONENT_CODE = 'TS2322'; // app build leaf (tsconfig.app.json)
const APP_SPEC_CODE = 'TS2345'; // app spec leaf (tsconfig.spec.json)

const APP_PROJECT = 'ng-cli-workspace';

// Clean committed anchors + broken replacements (JSON.stringify keeps them ASCII-only).
const APP_COMPONENT_ANCHOR =
  "protected readonly title = signal('ng-cli-workspace');";
const APP_COMPONENT_INJECTION = `${APP_COMPONENT_ANCHOR}\n  protected readonly appTypeError: string = ${JSON.stringify(
  123,
)};`;
const APP_SPEC_INJECTION = `\n// planted app spec-leaf error (single-project wiring proof)\nMath.abs(${JSON.stringify(
  'planted-app-spec-arg',
)});\n`;

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

// Make the tmp copy a real yarn 4 workspace at local Verdaccio (FLAT layout only --
// `configuration` is single-project, so no `workspaces` field is needed).
function setupYarnWorkspace(
  tmp: string,
  verdaccioUrl: string,
  verdaccioToken: string,
): void {
  const packageJsonPath = join(tmp, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    packageManager?: string;
  };
  packageJson.packageManager = `yarn@${YARN_VERSION}`;

  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

  // yarn 4 config (mirrors ng-add-ng-run-yarn.e2e.spec.ts, all load-bearing):
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
  // per-fixture cache instead of the fresh Verdaccio dist, so `ng generate
  // angular-typechecker:configuration` would resolve a schematics-less collection.
  // Disabling the mirror makes yarn ignore the global mirror entirely and download the
  // fresh Verdaccio tarball into the (fresh, per-fixture) cacheFolder.
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

  // Angular CLI resolves the package version via its npm-based metadata fetch (which
  // reads .npmrc, NOT .yarnrc.yml), so BOTH registries must point at Verdaccio for the
  // local dist to resolve under yarn.
  writeVerdaccioNpmrc(tmp, verdaccioUrl, verdaccioToken);
}

describe('CLI-YARN: `ng generate :configuration` + `ng run :typecheck` on a real yarn 4 workspace', () => {
  it.skipIf(!corepackAvailable)(
    'ng generate wires the app typecheck target and ng run catches planted leaf errors (chalk.blue arbiter)',
    () => {
      const verdaccioUrl = inject('verdaccioUrl');
      const verdaccioToken = inject('verdaccioToken');

      expect(verdaccioUrl.startsWith('http://127.0.0.1:')).toBe(true);

      const tmp = mkdtempSync(join(tmpdir(), 'atc-ng-gen-yarn-'));

      try {
        cpSync(fixtureDir, tmp, { recursive: true });
        // The committed fixture ships an npm lockfile; drop it so yarn.lock +
        // packageManager: yarn become the authoritative package-manager signal.
        if (existsSync(join(tmp, 'package-lock.json'))) {
          rmSync(join(tmp, 'package-lock.json'), { force: true });
        }
        setupYarnWorkspace(tmp, verdaccioUrl, verdaccioToken);

        // Non-vacuous baseline: no typecheck target BEFORE ng generate.
        expect(typecheckTarget(tmp, APP_PROJECT)).toBeUndefined();

        // npm_config_userconfig -> a nonexistent path so the user ~/.npmrc cannot
        // reintroduce a registry/peer override into any npm metadata fetch.
        const npmEnv = {
          ...env,
          npm_config_userconfig: join(tmp, '.npmrc.nonexistent'),
        };

        // corepack enable puts the bare `yarn` shim on PATH; install the fixture deps
        // (real yarn.lock), then add angular-typechecker as a plain devDependency from
        // Verdaccio (installs `nx` transitively -- a direct dep since 24-04). Finally
        // run the REAL `ng generate angular-typechecker:configuration <project>` -- the
        // convertNx schematic factory load pulls `@nx/devkit` -> nx -> log-symbols@4,
        // the yarn-4 `chalk.blue is not a function` surface. `project` is the required
        // positional arg (no x-prompt in the schema); `execSync` is non-TTY so nothing
        // prompts. If the schematic crashes, `sh` rethrows the captured output LOUDLY.
        sh('corepack enable', { cwd: tmp, env: npmEnv });
        sh('corepack yarn install', { cwd: tmp, env: npmEnv });
        sh('corepack yarn add -D angular-typechecker', {
          cwd: tmp,
          env: npmEnv,
        });
        sh(
          `corepack yarn ng generate angular-typechecker:configuration ${APP_PROJECT}`,
          { cwd: tmp, env: npmEnv },
        );

        // The app project gained the typecheck target with the published builder id +
        // the two-element [build, spec] leaf array (flat root app, root '').
        const appTarget = typecheckTarget(tmp, APP_PROJECT);
        expect(appTarget?.builder).toBe('angular-typechecker:typecheck');
        expect(appTarget?.options?.tsConfig).toEqual([
          'tsconfig.app.json',
          'tsconfig.spec.json',
        ]);

        // No stray nx.json (the Angular CLI write-fork seeds no Nx caching).
        expect(() => readFileSync(join(tmp, 'nx.json'), 'utf8')).toThrow();

        // CLEAN baseline: the wired target type-checks the pristine scaffold GREEN.
        const appClean = ngRun(tmp, `${APP_PROJECT}:typecheck`, npmEnv);
        expect(appClean.code, appClean.stdout).toBe(0);

        // Plant DISTINCT per-leaf errors and prove the wired target actually runs the
        // check: it catches its own app-component (TS2322) + app-spec (TS2345) leaves.
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

        const appBad = ngRun(tmp, `${APP_PROJECT}:typecheck`, npmEnv);
        expect(appBad.code, appBad.stdout).not.toBe(0);
        expect(appBad.stdout).toContain(APP_COMPONENT_CODE);
        expect(appBad.stdout).toContain(APP_SPEC_CODE);
        // The CJS executor's dynamic import() of the ESM compiler-cli survived a real
        // yarn install + `ng run`; the non-zero exit is a real diagnostic, not a crash.
        expect(appBad.stdout).not.toMatch(/ERR_REQUIRE_ESM/);
        expect(appBad.stdout).not.toContain('chalk.blue');
        expect(appBad.stdout).not.toContain('infrastructure error');
      } finally {
        removeTmpDir(tmp);
      }
    },
    900000,
  );
});
