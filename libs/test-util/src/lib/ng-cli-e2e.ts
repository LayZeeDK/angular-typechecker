import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect } from 'vitest';

import type { RunResult } from './e2e-process';

// Shared building blocks for the Angular CLI (`ng`) e2e specs
// (angular-typechecker-ng-cli-e2e). The four specs -- npm/flat (ACV-02), pnpm
// collision (ACV-01 gate #2), yarn flat+workspace, and the yarn `ng generate`
// arbiter -- differ ONLY in their package-manager-specific provisioning. The planted
// per-leaf diagnostic codes + anchors, the angular.json target read, the `ng run`
// runner, the anchor-planting helper, and the per-project scoping assertions are
// identical across them, so they live here as the single source of truth.

// The rendered diagnostic codes each planted leaf deliberately triggers. Asserting
// the FULL 'TSxxxx' token (not a bare 4-digit substring) keeps the check from
// false-PASSing on an unrelated 4-digit occurrence in a stack trace / hash / offset.
// DISTINCT codes per leaf: a shared code could not distinguish "this project's leaf
// was checked" from "some other project's leaf leaked in".
export const APP_COMPONENT_CODE = 'TS2322'; // app build leaf   (tsconfig.app.json)
export const APP_SPEC_CODE = 'TS2345'; // app spec leaf    (tsconfig.spec.json)
export const LIB_COMPONENT_CODE = 'TS2554'; // lib build leaf   (projects/my-lib/tsconfig.lib.json)

// The scaffold's project names (see the committed fixture's angular.json).
export const APP_PROJECT = 'ng-cli-workspace';
export const LIB_PROJECT = 'my-lib';

// Clean committed anchors each injection targets, and the broken replacement lines.
// Built with JSON.stringify (ASCII-only, no quote/apostrophe escaping hazard).
//
// App component leaf: assign a number to a `string` field -> TS2322. Lives in
// src/app/app.ts, which tsconfig.app.json includes and tsconfig.spec.json only
// pulls in transitively -- either way it belongs to the app project's programs.
export const APP_COMPONENT_ANCHOR =
  "protected readonly title = signal('ng-cli-workspace');";
export const APP_COMPONENT_INJECTION = `${APP_COMPONENT_ANCHOR}\n  protected readonly appTypeError: string = ${JSON.stringify(
  123,
)};`;

// App spec leaf: a top-level STATEMENT passing a string where Math.abs wants a
// number -> TS2345. It lives in src/app/app.spec.ts, which ONLY tsconfig.spec.json
// includes, so its presence proves the app's SPEC leaf was checked.
export const APP_SPEC_INJECTION = `\n// planted app spec-leaf error (per-project scoping proof)\nMath.abs(${JSON.stringify(
  'planted-app-spec-arg',
)});\n`;

// Library component leaf: call parseInt with zero args -> TS2554 (Expected 1-2
// arguments, but got 0). Lives in projects/my-lib/src/lib/my-lib.ts, which
// tsconfig.lib.json includes -- a code the APP programs never compile.
export const LIB_COMPONENT_ANCHOR = 'export class MyLib {';
export const LIB_COMPONENT_INJECTION = `export class MyLib {\n  protected readonly libTypeError = parseInt();`;

export interface TypecheckArchitectTarget {
  builder?: string;
  options?: { tsConfig?: unknown };
}

// Read a project's `typecheck` architect target from the workspace's angular.json.
export function typecheckTarget(
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

// Factory for the `ng run <target>` runner. `commandPrefix` is the package-manager
// invocation shell: `'npx'` for npm/pnpm, `'corepack yarn'` for yarn 4. The returned
// runner runs `${commandPrefix} ng run <target>` in `cwd` and captures combined
// stdout/stderr + exit code. execSync throws on a non-zero exit, so the catch is how
// a failing typecheck's output is captured (NEVER pipe ng through head/rg -- the pipe
// tail's exit code would mask ng's). A fixed target id + fixed flags only reach the
// shell.
export function createNgRun(
  commandPrefix: string,
): (cwd: string, target: string, runEnv: NodeJS.ProcessEnv) => RunResult {
  return (cwd, target, runEnv) => {
    try {
      const stdout = execSync(`${commandPrefix} ng run ${target}`, {
        cwd,
        env: runEnv,
        encoding: 'utf8',
        // IN-02: a large failing `ng run` can exceed the default 1 MB buffer and
        // truncate stdout BEFORE the asserted TSxxxx code -> ENOBUFS + a flaky
        // `toContain`. 20 MB is ample headroom for a diagnostic dump.
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
  };
}

// Apply an anchor -> replacement injection, asserting the anchor was actually found
// (a scaffold change that moves the anchor fails LOUDLY instead of silently planting
// nothing and passing for the wrong reason).
export function plant(path: string, anchor: string, replacement: string): void {
  const original = readFileSync(path, 'utf8');
  const injected = original.replace(anchor, replacement);

  expect(injected, `anchor not found in ${path}: ${anchor}`).not.toBe(original);
  writeFileSync(path, injected);
}

export interface PerProjectScopingArgs {
  tmp: string;
  ngRun: (cwd: string, target: string, runEnv: NodeJS.ProcessEnv) => RunResult;
  env: NodeJS.ProcessEnv;
  appProject?: string;
  libProject?: string;
}

// Plant the three DISTINCT per-leaf errors (app component TS2322, app spec TS2345,
// library component TS2554) then prove per-project scoping: the app target catches
// its OWN app-component + app-spec leaves and NOT the library's leaf, and the library
// target catches ONLY its own leaf and NEITHER app leaf. Neither output may match
// /ERR_REQUIRE_ESM/ nor contain 'infrastructure error' (the CJS->ESM compiler-cli
// bridge survived packaging + `ng run`; the non-zero exit is a real diagnostic, not a
// crash). Callers run the CLEAN baseline before this; here every run is expected RED.
export function assertPerProjectScoping({
  tmp,
  ngRun,
  env,
  appProject = APP_PROJECT,
  libProject = LIB_PROJECT,
}: PerProjectScopingArgs): void {
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

  // APP target scoping: catches its OWN app-component (TS2322) AND app-spec (TS2345)
  // leaves, and NOT the library's leaf -- no cross-project bleed.
  const appBad = ngRun(tmp, `${appProject}:typecheck`, env);
  expect(appBad.code, appBad.stdout).not.toBe(0);
  expect(appBad.stdout).toContain(APP_COMPONENT_CODE);
  expect(appBad.stdout).toContain(APP_SPEC_CODE);
  expect(appBad.stdout).not.toContain(LIB_COMPONENT_CODE);
  expect(appBad.stdout).not.toMatch(/ERR_REQUIRE_ESM/);
  expect(appBad.stdout).not.toContain('infrastructure error');

  // LIBRARY target scoping: catches ONLY its own leaf (TS2554), and NEITHER of the
  // app leaves -- proving the reverse direction of per-project scoping.
  const libBad = ngRun(tmp, `${libProject}:typecheck`, env);
  expect(libBad.code, libBad.stdout).not.toBe(0);
  expect(libBad.stdout).toContain(LIB_COMPONENT_CODE);
  expect(libBad.stdout).not.toContain(APP_COMPONENT_CODE);
  expect(libBad.stdout).not.toContain(APP_SPEC_CODE);
  expect(libBad.stdout).not.toMatch(/ERR_REQUIRE_ESM/);
  expect(libBad.stdout).not.toContain('infrastructure error');
}
