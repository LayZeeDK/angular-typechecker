import { execSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, inject, it } from 'vitest';
import {
  buildCleanEnv,
  findWorkspaceRoot,
  removeTmpDir,
  sh,
  writeVerdaccioNpmrc,
  type RunResult,
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
// Runs SEQUENTIALLY on the main tree under the serialized vitest.config.mts + the
// shared globalSetup (which builds + publishes dist once); this spec CONSUMES that
// registry via inject(). It shares the ONE dist tarball path with the sibling e2e
// projects, so the CI e2e job MUST stay `--parallel=1` (GUARD-01b).

// The rendered diagnostic codes each planted leaf deliberately triggers. Asserting
// the FULL 'TSxxxx' token (not a bare 4-digit substring) keeps the check from
// false-PASSing on an unrelated 4-digit occurrence in a stack trace / hash / offset.
// DISTINCT codes per leaf: a shared code could not distinguish "this project's leaf
// was checked" from "some other project's leaf leaked in".
const APP_COMPONENT_CODE = 'TS2322'; // app build leaf   (tsconfig.app.json)
const APP_SPEC_CODE = 'TS2345'; // app spec leaf    (tsconfig.spec.json)
const LIB_COMPONENT_CODE = 'TS2554'; // lib build leaf   (projects/my-lib/tsconfig.lib.json)

// The scaffold's project names (see the committed fixture's angular.json).
const APP_PROJECT = 'ng-cli-workspace';
const LIB_PROJECT = 'my-lib';

// Clean committed anchors each injection targets, and the broken replacement lines.
// Built with JSON.stringify (ASCII-only, no quote/apostrophe escaping hazard).
//
// App component leaf: assign a number to a `string` field -> TS2322. Lives in
// src/app/app.ts, which tsconfig.app.json includes and tsconfig.spec.json only
// pulls in transitively -- either way it belongs to the app project's programs.
const APP_COMPONENT_ANCHOR =
  "protected readonly title = signal('ng-cli-workspace');";
const APP_COMPONENT_INJECTION = `${APP_COMPONENT_ANCHOR}\n  protected readonly appTypeError: string = ${JSON.stringify(
  123,
)};`;

// App spec leaf: a top-level STATEMENT passing a string where Math.abs wants a
// number -> TS2345. It lives in src/app/app.spec.ts, which ONLY tsconfig.spec.json
// includes, so its presence proves the app's SPEC leaf was checked.
const APP_SPEC_INJECTION = `\n// planted app spec-leaf error (per-project scoping proof)\nMath.abs(${JSON.stringify(
  'planted-app-spec-arg',
)});\n`;

// Library component leaf: call parseInt with zero args -> TS2554 (Expected 1-2
// arguments, but got 0). Lives in projects/my-lib/src/lib/my-lib.ts, which
// tsconfig.lib.json includes -- a code the APP programs never compile.
const LIB_COMPONENT_ANCHOR = 'export class MyLib {';
const LIB_COMPONENT_INJECTION = `export class MyLib {\n  protected readonly libTypeError = parseInt();`;

// Resolve the workspace root from this spec's location; findWorkspaceRoot() walks
// up to nx.json so every path is cwd-independent (main tree).
const workspaceRoot = findWorkspaceRoot(dirname(fileURLToPath(import.meta.url)));

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

interface TypecheckArchitectTarget {
  builder?: string;
  options?: { tsConfig?: unknown };
}

function readAngularProjects(
  cwd: string,
): Record<string, { architect?: Record<string, TypecheckArchitectTarget> }> {
  const angularJson = JSON.parse(
    readFileSync(join(cwd, 'angular.json'), 'utf8'),
  ) as {
    projects?: Record<
      string,
      { architect?: Record<string, TypecheckArchitectTarget> }
    >;
  };

  return angularJson.projects ?? {};
}

function typecheckTarget(
  cwd: string,
  project: string,
): TypecheckArchitectTarget | undefined {
  return readAngularProjects(cwd)[project]?.architect?.['typecheck'];
}

// Run `npx ng run <project>:typecheck` in `cwd` and capture combined stdout/stderr
// + exit code. execSync throws on a non-zero exit, so the catch is how a failing
// typecheck's output is captured (NEVER pipe ng through head/rg -- the pipe tail's
// exit code would mask ng's). A fixed target id + fixed flags only reach the shell.
function ngRun(
  cwd: string,
  target: string,
  runEnv: NodeJS.ProcessEnv,
): RunResult {
  try {
    const stdout = execSync(`npx ng run ${target}`, {
      cwd,
      env: runEnv,
      encoding: 'utf8',
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

// Apply an anchor -> replacement injection, asserting the anchor was actually found
// (a scaffold change that moves the anchor fails LOUDLY instead of silently
// planting nothing and passing for the wrong reason).
function plant(path: string, anchor: string, replacement: string): void {
  const original = readFileSync(path, 'utf8');
  const injected = original.replace(anchor, replacement);

  expect(injected, `anchor not found in ${path}: ${anchor}`).not.toBe(original);
  writeFileSync(path, injected);
}

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
      sh('npm install', { cwd: tmp, env: npmEnv });

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

      // Plant DISTINCT per-leaf errors: app component (TS2322), app spec (TS2345),
      // library component (TS2554).
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

      // APP target scoping: catches its OWN app-component (TS2322) AND app-spec
      // (TS2345) leaves, and NOT the library's leaf -- no cross-project bleed.
      const appBad = ngRun(tmp, `${APP_PROJECT}:typecheck`, npmEnv);
      expect(appBad.code, appBad.stdout).not.toBe(0);
      expect(appBad.stdout).toContain(APP_COMPONENT_CODE);
      expect(appBad.stdout).toContain(APP_SPEC_CODE);
      expect(appBad.stdout).not.toContain(LIB_COMPONENT_CODE);
      // The CJS executor's dynamic import() of the ESM compiler-cli survived
      // packaging + `ng run`, and the non-zero exit is a real diagnostic, not a crash.
      expect(appBad.stdout).not.toMatch(/ERR_REQUIRE_ESM/);
      expect(appBad.stdout).not.toContain('infrastructure error');

      // LIBRARY target scoping: catches ONLY its own leaf (TS2554), and NEITHER of
      // the app leaves -- proving the reverse direction of per-project scoping.
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
  }, 600000);
});
