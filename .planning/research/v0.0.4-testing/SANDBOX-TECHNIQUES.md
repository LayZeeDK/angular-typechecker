# Sandbox Testing Techniques (Prior-Art Extraction)

**Source repo:** `D:\projects\sandbox\nx19-8-angular18-2-esbuild-playwright-storybook`
**Stack of the sandbox:** Nx 19.8.14, Angular 18.2.13, TypeScript (Angular 18-era), Vitest 3.x, `@nx/vite` 19.8.14, `verdaccio` ^5, `jscodeshift` ^17.3.0.
**Extracted:** 2026-06-30 (read-only archaeology; no files modified, no branches switched).
**Purpose:** Inspiration for v0.0.4 (`typecheck-configuration` generator + extended testing strategy). Every pattern must be re-validated against Nx 23 / Angular 22 / TS 6 later -- the sandbox stack is 4 majors behind.

All paths below are relative to the sandbox root unless noted. Code excerpts are verbatim from the sandbox.

---

## 1. The `typecheck-configuration` generator

**Files:** `libs/nx-plugin/src/generators/typecheck-configuration/{generator.ts, schema.json, schema.d.ts, generator.spec.ts}` plus an (empty) `files/src/` template dir.

### What it does

The generator adds a `typecheck` target to an EXISTING project's configuration. It does NOT create files (the `files/` template dir contains only an empty `src/` folder and is never used -- there is no `generateFiles` call). The whole generator is 33 lines.

`libs/nx-plugin/src/generators/typecheck-configuration/generator.ts`:

```typescript
import {
  formatFiles,
  joinPathFragments,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { TypecheckConfigurationGeneratorSchema } from './schema';

export async function typecheckConfigurationGenerator(
  tree: Tree,
  options: TypecheckConfigurationGeneratorSchema
) {
  const projectConfig = readProjectConfiguration(tree, options.project);

  const tsConfigPath =
    options.tsConfig ??
    joinPathFragments(projectConfig.root, 'tsconfig.lib.json');

  projectConfig.targets ??= {};
  projectConfig.targets.typecheck = {
    executor: '@workspace/nx-plugin:angular-typecheck',
    options: {
      tsConfig: tsConfigPath,
    },
  };

  updateProjectConfiguration(tree, options.project, projectConfig);

  await formatFiles(tree);
}

export default typecheckConfigurationGenerator;
```

**`@nx/devkit` APIs used (exhaustive):**
- `readProjectConfiguration(tree, project)` -- read the target project's config.
- `joinPathFragments(root, 'tsconfig.lib.json')` -- compute the DEFAULT tsConfig path (POSIX join).
- `updateProjectConfiguration(tree, project, config)` -- write the mutated config back.
- `formatFiles(tree)` -- Prettier-format the changed files.
- NOT used: `addProjectConfiguration`, `generateFiles`, `installPackagesTask`, `names`, `getProjects`. There is no `ng-add`/`init` behavior, no dependency installation, no formatting toggle.

**Default tsConfig:** hard-coded to `<projectRoot>/tsconfig.lib.json`. There is NO project-type detection (app vs lib vs spec) -- the consumer overrides via `--tsConfig` for anything else. This is a v0.0.1-grade default; the current milestone's broader project-type matrix (apps, buildable/publishable libs, spec tsconfigs) is NOT modeled here.

**Idempotency:** Partial. Re-running OVERWRITES `targets.typecheck` wholesale (it assigns a fresh object every time), so re-running with the same args is idempotent, and re-running with new args replaces cleanly. It does NOT guard against an existing target (no "skip if present" / no `--skipExisting`), and it does NOT warn on overwrite. `projectConfig.targets ??= {}` is the only defensive guard.

**Schema** -- `schema.json`:

```json
{
  "$schema": "https://json-schema.org/schema",
  "$id": "TypecheckConfiguration",
  "title": "Add angular typecheck target",
  "type": "object",
  "properties": {
    "project": {
      "type": "string",
      "description": "Project to receive the angular typecheck target.",
      "$default": { "$source": "argv", "index": 0 },
      "x-prompt": "Which project should be updated?"
    },
    "tsConfig": {
      "type": "string",
      "description": "Path to the tsconfig file to pass to the typecheck executor."
    }
  },
  "required": ["project"]
}
```

Notes on schema conventions worth carrying:
- `project` uses `$default: { $source: "argv", index: 0 }` so `nx g typecheck-configuration my-lib` binds the first positional arg to `project`, and `x-prompt` makes it interactive otherwise.
- `tsConfig` is optional (only `project` is required); absence triggers the `tsconfig.lib.json` default in code.
- `additionalProperties` is NOT set (defaults to permissive). The current repo's STACK.md recommends `false` for a strict tool.

`schema.d.ts` (the hand-authored interface Nx does not generate):

```typescript
export interface TypecheckConfigurationGeneratorSchema {
  project: string;
  tsConfig?: string;
}
```

**Generator registration** -- `libs/nx-plugin/generators.json`:

```json
{
  "generators": {
    "typecheck-configuration": {
      "factory": "./src/generators/typecheck-configuration/generator",
      "schema": "./src/generators/typecheck-configuration/schema.json",
      "description": "typecheck-configuration generator"
    }
  }
}
```

The published `package.json` declares `"generators": "./generators.json"` and the build globs both `generators.json` and `executors.json` into `dist` (see section 7). `factory` is an extensionless path; Nx appends `.js` and `require()`s it.

---

## 2. `generator.spec.ts` -- the FsTree (in-memory Tree) test

**File:** `libs/nx-plugin/src/generators/typecheck-configuration/generator.spec.ts` (46 lines).

**KEY CORRECTION to the milestone brief's framing:** the committed generator test does NOT use real-disk `FsTree` + `flushChanges`. It uses the standard **in-memory** `createTreeWithEmptyWorkspace()` from `@nx/devkit/testing`. The `FsTree`/`flushChanges` (real-disk) approach exists ONLY as a never-committed proposal in `PLAN-refactor-test-fixtures.md` (see section 9). Verified by `git grep`: the only `FsTree`/`flushChanges` strings in `libs/` are in that markdown plan and the integration-fixture builder uses the `execSync`-CLI approach instead. `createTreeWithEmptyWorkspace` appears exactly once in source -- in this spec.

### How the tree is created and asserted

```typescript
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  Tree,
  addProjectConfiguration,
  readProjectConfiguration,
} from '@nx/devkit';

import { typecheckConfigurationGenerator } from './generator';

describe('typecheck-configuration generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'test', {
      root: 'libs/test',
      projectType: 'library',
      sourceRoot: 'libs/test/src',
      targets: {},
    });
  });

  it('should add the typecheck target with the default tsconfig', async () => {
    await typecheckConfigurationGenerator(tree, { project: 'test' });

    const config = readProjectConfiguration(tree, 'test');
    expect(config.targets?.typecheck).toEqual({
      executor: '@workspace/nx-plugin:angular-typecheck',
      options: { tsConfig: 'libs/test/tsconfig.lib.json' },
    });
  });

  it('should respect a custom tsconfig option', async () => {
    await typecheckConfigurationGenerator(tree, {
      project: 'test',
      tsConfig: 'libs/test/custom.json',
    });

    const config = readProjectConfiguration(tree, 'test');
    expect(config.targets?.typecheck?.options?.tsConfig).toBe(
      'libs/test/custom.json'
    );
  });
});
```

**Mechanics:**
- **Import of the tree factory:** `createTreeWithEmptyWorkspace` from `@nx/devkit/testing` (the public testing subpath). No internal `nx/src/...` import in the committed test.
- **Real-disk vs in-memory:** fully in-memory. No `flushChanges`, no `fs` writes, no temp dirs. The tree is virtual; assertions read back through `readProjectConfiguration`.
- **Setup/teardown:** `beforeEach` makes a fresh empty workspace and seeds ONE project (`'test'`, a library at `libs/test` with empty `targets`). No `afterEach` (in-memory tree is GC'd; nothing to clean).
- **No eslint-disable / quarantine.** The committed test has no `eslint-disable`, no `it.skip`, no `describe.skip`, no quarantine comment. (The `FsTree` plan flagged those APIs as "internal", but since the committed test avoids them, no suppression was needed.)
- **What is asserted:**
  1. Default path: full structural equality of `targets.typecheck` (`toEqual` on the whole object) -- locks executor id AND the derived `libs/test/tsconfig.lib.json`.
  2. Custom path: `--tsConfig` is passed through verbatim (`toBe`).
- **Runner:** uses Vitest globals (no explicit `import { describe } from 'vitest'`) because the plugin's `tsconfig.spec.json` includes `vitest/globals` and `vite.config.ts` sets `globals: true`. (Contrast the executor unit spec in section 3, which imports from `vitest` explicitly.)

---

## 3. `executor.spec.ts` -- the in-memory (mocked-compiler) unit test

**File:** `libs/nx-plugin/src/executors/angular-typecheck/executor.spec.ts` (317 lines).

### The mock seam

The seam is **`@angular/compiler-cli` mocked at the module boundary** with `vi.mock`. There is no `runTypecheck`-style injection seam; the executor imports compiler-cli statically (this sandbox executor does NOT use `await import()` -- it's the Nx 19 era, so it imports `performCompilation` etc. directly), and the test replaces the whole module.

```typescript
import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest';
import { ExecutorContext } from '@nx/devkit';
import * as compilerCli from '@angular/compiler-cli';
import * as ts from 'typescript';
import * as path from 'path';

import { AngularTypecheckExecutorSchema } from './schema';
import executor from './executor';

vi.mock('@angular/compiler-cli', () => ({
  readConfiguration: vi.fn(),
  performCompilation: vi.fn(),
  formatDiagnostics: vi.fn(),
}));
```

Typed handles to the mocks:

```typescript
const mockReadConfiguration = compilerCli.readConfiguration as MockedFunction<
  typeof compilerCli.readConfiguration
>;
const mockPerformCompilation = compilerCli.performCompilation as MockedFunction<
  typeof compilerCli.performCompilation
>;
const mockFormatDiagnostics = compilerCli.formatDiagnostics as MockedFunction<
  typeof compilerCli.formatDiagnostics
>;
```

### How `ExecutorContext` is built in memory

Hand-constructed plain object cast to `ExecutorContext` -- no project graph, no real workspace:

```typescript
context = {
  root: '/workspace',
  cwd: '/workspace',
  isVerbose: false,
  projectName: 'test-lib',
  projectsConfigurations: {
    version: 2,
    projects: {
      'test-lib': { root: 'libs/test-lib', sourceRoot: 'libs/test-lib/src' },
    },
  },
} as ExecutorContext;

mockFormatDiagnostics.mockReturnValue('');
```

`vi.clearAllMocks()` runs in the top `beforeEach`. Diagnostics are FAKE `ts.Diagnostic` literals (cast `as ts.SourceFile` for the `file` field) -- no compiler ever runs.

### What is asserted (8 cases)

- **No errors -> success**, AND asserts the compiler was called with the resolved absolute path and with `{ emitFlags: 0, options: { noEmit: true, skipLibCheck: true } }` via `expect.objectContaining`.
- **Error diagnostic -> `success === false`.**
- **Warning-only diagnostic -> `success === true`** (only `DiagnosticCategory.Error` counts).
- **`excludeLibsFromTypeCheck` default (true):** a project error + a dependency error (under `libs/other-lib`) -> fails on the project error, dependency error filtered (still fails, but the assertion proves project-scoping is active).
- **`excludeLibsFromTypeCheck: false`:** both errors counted.
- **node_modules error filtered** -> success (path contains `node_modules`).
- **Invalid tsconfig:** `readConfiguration` returns a config error -> fails AND `performCompilation` is NOT called (`expect(mockPerformCompilation).not.toHaveBeenCalled()`).
- **Diagnostic without `file` (global):** kept (not filtered) -> fails.

### How it differs from the real-compiler integration tests

| Dimension | `executor.spec.ts` (unit) | `executor.angularNN.integration.spec.ts` |
|---|---|---|
| Compiler | mocked (`vi.mock`) | real `@angular/compiler-cli` via `runExecutor` |
| Context | hand-built literal | from `createProjectGraphAsync()` + `readProjectsConfigurationFromProjectGraph` |
| Diagnostics | fabricated `ts.Diagnostic` objects | produced by compiling real generated fixtures |
| Speed | instant | 60s timeout per `it`, 120s suite |
| What it proves | control flow / filtering / success-counting logic | that real diagnostics surface end-to-end per Angular version |
| Assertion granularity | success boolean + call args | success boolean ONLY (no code/count assertions -- see section 4 caveat) |

---

## 4. The per-introduction-version catalog (`executor.angularNN.integration.spec.ts`)

**Files:** `executor.angular13.integration.spec.ts` ... `executor.angular21.integration.spec.ts` (9 files), all under `libs/nx-plugin/src/executors/angular-typecheck/`.

### Organization: one file per Angular MAJOR, keyed by the version a diagnostic was INTRODUCED

Each file tests the diagnostics that DEBUTED in that Angular major (not the running version). The sandbox actually runs Angular 18, but the files are named by introduction version -- so `executor.angular13` covers the baseline NG codes that shipped in v13, `executor.angular21` covers `NG8021` introduced in v21, etc. This is the "historical catalog" framing in `ANGULAR-COMPILER-ERRORS.md`.

A new Angular major is a **drop-in file**: add `executor.angularNN.integration.spec.ts`, register the suite, assert the new fixtures. The `13` file is the fat baseline (118 lines, ~15 cases); `14`-`21` are thin (one to four cases each). Example of a thin drop-in (`executor.angular21.integration.spec.ts`, the entire file):

```typescript
import { describe, it, expect } from 'vitest';
import { registerAngularTypecheckSuite } from './executor.integration.context';

const { runTypecheck } = registerAngularTypecheckSuite();

describe('Angular 21 extended diagnostics', () => {
  it('should fail for defer trigger misconfigurations (NG8021)', async () => {
    const result = await runTypecheck('defer-trigger-lib');
    expect(result.success).toBe(false);
  }, 60000);
});
```

### Test naming

- `describe` block names the Angular major + diagnostic class, e.g. `'Angular 13 compiler diagnostics'`, `'Angular 20 extended diagnostics'`.
- `it` names embed the NG code in prose: `'should surface NG2003 missing injection token errors'`, `'should fail for unparenthesized nullish coalescing (NG8115)'`.
- Each `it` has an inline `60000` ms timeout.

### How each NG diagnostic is asserted -- IMPORTANT CAVEAT

The committed catalog asserts **only `expect(result.success).toBe(false)`** (or `true` for the clean lib and the default dependency-filtering case). It does **NOT** assert exact diagnostic CODE or COUNT. The NG code lives in the test name and in the fixture comment, not in an assertion. The mapping "this fixture produces NG8115" is documentation, enforced only by the fact that the fixture is intentionally broken and the executor returns failure.

> This is precisely the gap the v0.0.4 catalog goal closes: "assert EVERY NG8xxx by exact code/count." The sandbox proves the file-per-version organization and the injection mechanics, but its assertions are coarse (boolean). The executor itself only RETURNS a boolean (`{ success }`) and logs formatted diagnostics; it does not expose the diagnostic array, so a code/count assertion would require either (a) capturing the logger output, or (b) changing the executor/test seam to return diagnostics. Carry the organization forward; upgrade the assertions.

### How errors are injected: programmatic AST rewrite (jscodeshift), NOT committed fixtures

There are **no committed fixture projects**. Fixtures are generated at test time by `nx generate @nx/angular:library` (via `execSync`), then mutated by `inject*Error` functions in `test-fixtures.ts`. Source-code injection uses **jscodeshift** (`jscodeshift.withParser('tsx')`) to add imports, class properties, `@Component.imports` entries, superclasses, and to swap decorator arguments. Template injection is plain string append/overwrite of the `.component.html`. See section 5 for the builder mechanics.

### NG codes covered, by version file

From the spec files and corroborated by `ANGULAR-COMPILER-ERRORS.md`:

| File | Angular major | Codes / scenarios asserted | Fixture(s) |
|---|---|---|---|
| `executor.angular13.integration.spec.ts` | 13 (baseline) | `TS2322` (ts error), `TS2339` (template missing member), `NG2003`, `NG2007`, `NG8001`, `NG1019`/`NG8004` (missing pipe), `NG2005`/`NG1005` (illegal ctor decorator), `NG1001` (arg not literal), `NG2009` (shadow DOM selector), `NG8002` (invalid attribute/`ngModel` not imported), `NG3003`/`NG8003` (missing `exportAs`), plus a multi-error case and the dependency-filtering pair | clean-lib, ts-error-lib, template-error-lib, decorator-error-lib, ng-di-error-lib, ng-base-error-lib, unknown-element-lib, missing-pipe-lib, illegal-constructor-lib, argument-not-literal-lib, invalid-shadow-selector-lib, invalid-attribute-lib, missing-exportas-lib, multi-error-lib, main-lib + dependency-lib |
| `executor.angular14.integration.spec.ts` | 14 | `NG6100` (`@NgModule({ id: module.id })`) | ng-module-id-lib |
| `executor.angular15.integration.spec.ts` | 15 | `NG8101` (invalidBananaInBox) -- with `extendedDiagnostics.defaultCategory='error'` | invalid-banana-lib |
| `executor.angular16.integration.spec.ts` | 16 | `NG8108` (skipHydrationNotStatic) | skip-hydration-lib |
| `executor.angular17.integration.spec.ts` | 17 | `NG8109` (interpolatedSignalNotInvoked) | signal-interpolation-lib |
| `executor.angular18.integration.spec.ts` | 18 | `NG8111` (uninvokedFunctionInEventBinding) | event-binding-lib |
| `executor.angular19.integration.spec.ts` | 19 | `NG8113` (unusedStandaloneImports) | unused-standalone-import-lib |
| `executor.angular20.integration.spec.ts` | 20 | `NG8114`, `NG8115`, `NG8116`, `NG8117` | nullish-coalescing-lib, uninvoked-track-lib, missing-structural-directive-lib, text-interpolation-lib |
| `executor.angular21.integration.spec.ts` | 21 | `NG8021` (deferTriggerMisconfiguration) | defer-trigger-lib |

**Coverage gaps the sandbox itself documents** (`ANGULAR-COMPILER-ERRORS.md` lists these as existing diagnostics but they are NOT asserted by any spec): `NG8102` (nullishCoalescingNotNullable), `NG8103` (missingControlFlowDirective), `NG8104` (textAttributeNotBinding), `NG8105` (missingNgForOfLet), `NG8106` (suffixNotSupported), `NG8107` (optionalChainNotNullable). The v0.0.4 "every NG8xxx" goal must fill these.

---

## 5. Shared integration context + test-fixtures builders

### `executor.integration.context.ts` -- the shared harness (455 lines)

Provides `registerAngularTypecheckSuite(): { runTypecheck }`. This is the load-bearing reuse mechanism: every version spec calls it at module top-level and destructures `runTypecheck`.

Key mechanics:

**One-time fixture build, shared across all suites, guarded by a filesystem lock + ready-flag** (because Vitest may load multiple spec files; fixtures are expensive `nx generate` calls):

```typescript
const TMP_DIR = 'tmp';
const LOCK_DIR_NAME = 'angular-typecheck-lock';
const READY_FILE_NAME = 'angular-typecheck-fixtures.ready';

async function acquireLock(lockPath: string): Promise<() => void> {
  while (true) {
    try {
      mkdirSync(lockPath);                       // atomic dir create == lock
      return () => rmSync(lockPath, { recursive: true, force: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
        await sleep(200);
        continue;                                // spin until lock released
      }
      throw err;
    }
  }
}
```

**Reference-counted lifecycle across suites** -- builds once, tears down after the LAST suite:

```typescript
let statePromise: Promise<InitializedState> | null = null;
let state: InitializedState | null = null;
let activeSuites = 0;

export function registerAngularTypecheckSuite(): AngularTypecheckTestContext {
  activeSuites++;
  const pendingState = ensureState();          // memoized init

  beforeAll(async () => { await pendingState; }, 600000);  // 10-min ceiling

  afterAll(async () => {
    activeSuites--;
    if (activeSuites === 0) { await cleanupState(); }
  });

  return {
    runTypecheck: (projectName, options) =>
      pendingState.then((ctx) => runTypecheckWithState(ctx, projectName, options)),
  };
}
```

**`runTypecheck` drives the REAL executor via `runExecutor`** (the ESM-native path -- see section 8), building the context from the live project graph:

```typescript
async function runTypecheckWithState(currentState, projectName, options = {}) {
  const { workspaceRoot, projectGraph } = currentState;
  const projectsConfigurations =
    readProjectsConfigurationFromProjectGraph(projectGraph);

  const context: ExecutorContext = {
    root: workspaceRoot, cwd: workspaceRoot, isVerbose: false,
    projectName, projectGraph, projectsConfigurations,
    nxJsonConfiguration: {},
  };

  const iterator = await runExecutor(
    { project: projectName, target: 'typecheck' },
    { tsConfig: `${FIXTURE_DIR}/${projectName}/tsconfig.lib.json`, ...options },
    context
  );

  let success = true;
  for await (const result of iterator) { success = success && result.success; }
  return { success };
}
```

The fixture-creation block (`initializeFixtures`) is one long sequence: for each library it calls `createAngularLibraryFixture(...)`, then the matching `inject*Error(...)`, and for extended diagnostics also `forceExtendedDiagnosticsAsErrors(...)`. After all fixtures it `createProjectGraphAsync()` and writes the ready flag. `process.env['NX_DAEMON'] = 'false'` is set before any generation.

### `test-fixtures.ts` -- the fixture + injection toolkit (1373 lines)

**`FIXTURE_DIR = 'libs/e2e-tmp'`** -- deliberately chosen NOT to match any `.gitignore` / `tsconfig.base.json` exclude, otherwise Nx project discovery would not see the generated projects (this is the #1 documented learning, see section 9).

**`createAngularLibraryFixture`** -- generates a real Angular lib via the CLI, then wires the typecheck target via the plugin's OWN generator (dogfooding):

```typescript
export function createAngularLibraryFixture(workspaceRoot, fixture): string {
  const projectRoot = `${FIXTURE_DIR}/${fixture.name}`;
  const generateCmd = [
    'npx nx generate @nx/angular:library',
    `--name=${fixture.name}`,
    `--directory=${projectRoot}`,
    '--projectNameAndRootFormat=as-provided',
    '--standalone=true', '--prefix=test', '--style=none',
    '--skipTests=true', '--skipFormat=true', '--skipModule=true',
    '--skipPackageJson=true', '--changeDetection=OnPush',
    '--linter=none', '--unitTestRunner=none', '--no-interactive',
  ].join(' ');
  execSync(generateCmd, { cwd: workspaceRoot, stdio: 'pipe',
    env: { ...process.env, NX_DAEMON: 'false' } });

  // wire the typecheck target with the plugin's own generator
  const projectJson = JSON.parse(readFileSync(join(workspaceRoot, projectRoot, 'project.json'), 'utf-8'));
  const projectName = projectJson.name ?? fixture.name;
  execSync([
    'npx nx generate @workspace/nx-plugin:typecheck-configuration',
    `--project=${projectName}`,
    `--tsConfig=${projectRoot}/tsconfig.lib.json`,
    '--no-interactive',
  ].join(' '), { cwd: workspaceRoot, stdio: 'pipe',
    env: { ...process.env, NX_DAEMON: 'false' } });

  return join(workspaceRoot, projectRoot);
}
```

**jscodeshift AST helpers** (`j = jscodeshift.withParser('tsx')`): `addImportSpecifier`, `addImportDeclaration` (with optional leading comment), `addClassProperty` (parses `class X { <prop> }` and unshifts the member), `setClassExtends`, `addToComponentImports` (finds the `@Component` decorator's `imports: [...]` array and pushes), `updateComponentMetadata` + `upsertMetadataProperty` (mutate `@Component` metadata, e.g. set `encapsulation: ViewEncapsulation.ShadowDom`). These let injections be surgical and idempotent rather than brittle string splices.

**Injection style varies by diagnostic class:**
- TS / decorator / DI errors: jscodeshift class-property / decorator edits to the `.component.ts`.
- Template diagnostics: read the `.component.html` and append (or overwrite) a small broken snippet -- e.g. NG8001 appends `<unknown-widget></unknown-widget>`, NG8101 appends `<div ([value])="invalidBananaModel"></div>`, NG8115 writes a `@for (...; track trackById)` (uninvoked track), NG8021 writes a `@defer (on immediate; prefetch on idle)` block.
- Some need extra files: NG2007 writes an `undecorated-base.ts` and `extends` it; NG3003 writes a directive missing `exportAs`; NG8113 writes an unused standalone directive.
- NG6100 writes a full `.module.ts` with `id: module.id`.
- NG1001 (arg not literal) injects a factory function and rewrites the `@Component(...)` call to `@Component(buildNonLiteralComponentMetadata())`.

**`forceExtendedDiagnosticsAsErrors(projectRoot)`** -- the toggle that makes extended (warning-by-default) diagnostics FAIL the run, by editing the generated `tsconfig.json`:

```typescript
export function forceExtendedDiagnosticsAsErrors(projectRoot: string): void {
  const tsconfigPath = join(projectRoot, 'tsconfig.json');
  const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));
  tsconfig.angularCompilerOptions ??= {};
  tsconfig.angularCompilerOptions.strictTemplates = true;
  tsconfig.angularCompilerOptions.extendedDiagnostics ??= {};
  tsconfig.angularCompilerOptions.extendedDiagnostics.defaultCategory = 'error';
  writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + '\n');
}
```

This is essential: most NG81xx are warnings unless `strictTemplates` + `defaultCategory: 'error'`. Extended-diagnostic fixtures call this; baseline NG codes (NG2xxx/NG8001/NG8002/NG3003) do not need it.

**`createDependentLibraryFixture`** -- builds a main lib, then jscodeshift-imports a (broken) dependency lib's component into the main component's `imports` array, to exercise `excludeLibsFromTypeCheck`.

**`cleanupFixtures(workspaceRoot)`** -- `rmSync` the fixture dir, then PRUNE path mappings the generator added to `tsconfig.base.json` (keys whose first path starts with `libs/e2e-tmp/`), then `nx format:check`/`nx format` `nx.json,tsconfig.base.json` to normalize. This is critical because `@nx/angular:library` mutates `tsconfig.base.json` and `nx.json` as a side effect; leaving stale entries pollutes the workspace.

**`getFixtureDefinitions()`** -- a flat record mapping each fixture key to `{ name, componentName, selector }` (28 entries). One central registry of every fixture.

---

## 6. Plugin e2e project (`libs/nx-plugin-e2e`)

**Files:** `src/nx-plugin.spec.ts`, `vite.config.ts`, `vitest.global-setup.ts`, `project.json`, `tsconfig.spec.json`, plus a stale `jest.config.ts` (NOT used -- the target is `@nx/vite:test`).

### Harness: real tarball published to a local Verdaccio registry, installed into a freshly scaffolded workspace

This is the highest-fidelity tier -- it builds, packs, publishes, installs the REAL npm tarball, then runs `nx generate` + `nx run` as a consumer would.

**`project.json`** -- the e2e target builds the plugin first:

```json
{
  "name": "nx-plugin-e2e",
  "projectType": "application",
  "implicitDependencies": ["nx-plugin"],
  "targets": {
    "e2e": {
      "executor": "@nx/vite:test",
      "options": { "config": "libs/nx-plugin-e2e/vite.config.ts" },
      "dependsOn": ["^build"]
    }
  }
}
```

**`vitest.global-setup.ts`** -- starts/stops Verdaccio around the whole e2e run:

```typescript
import startLocalRegistry from '../../tools/scripts/start-local-registry';
import stopLocalRegistry from '../../tools/scripts/stop-local-registry';

export default async function () {
  await startLocalRegistry();
  return () => { stopLocalRegistry(); };
}
```

**`tools/scripts/start-local-registry.ts`** does the full publish dance:
1. `spawn` `verdaccio` (resolved via `require.resolve('verdaccio/bin/verdaccio')`) on `127.0.0.1:4873`, with a fresh storage dir.
2. Poll `GET /-/ping` up to 60x/250ms until healthy (`ensureRegistryHealthy`).
3. `nx run nx-plugin:build` (via `execFileSync(process.execPath, [nxCli, ...])`, `NX_DAEMON=false`).
4. `prepareDistPackage`: set `private:false` and stamp a unique version `0.0.0-e2e.${Date.now()}` on the DIST package.json.
5. `npm pack dist/libs/nx-plugin` -> tarball.
6. `npm publish <tarball> --registry http://127.0.0.1:4873 --tag e2e`, authed via a temp `.npmrc` (`_authToken="secretVerdaccioToken"`) passed through `NPM_CONFIG_USERCONFIG`.

`stop-local-registry.ts` just calls `global.stopLocalRegistry()` (the kill closure stashed on `globalThis`).

### Scenarios it runs (`src/nx-plugin.spec.ts`)

`createTestProject()` scaffolds a brand-new workspace with `create-nx-workspace@<workspace-nx-version> --preset angular-monorepo --nxCloud=skip` under `tmp/test-project`, writes a `.npmrc` pointing the `@workspace` scope at the local registry, then `npm install @workspace/nx-plugin@e2e`. The Nx version is read dynamically from the host workspace via `npm list nx --json` (`readWorkspaceNxVersion`).

Three `it`s:
1. **`should be installed`** -- `npm ls @workspace/nx-plugin` (fails if not installed).
2. **`should add a typecheck target and run it`** -- `nx generate @nx/angular:library`, then `nx generate @workspace/nx-plugin:typecheck-configuration --project=...`, asserts via `nx show project ... --json` that `targets.typecheck.executor === '@workspace/nx-plugin:angular-typecheck'` and `options.tsConfig === '<root>/tsconfig.lib.json'`, then runs `nx run <proj>:typecheck` (expects exit 0 on a clean lib).
3. **`should report template errors when running the typecheck target`** -- same scaffold, then writes an invalid template containing a sentinel token `__template_error_token__`, runs `nx run <proj>:typecheck` expecting a NON-ZERO exit, and asserts the combined stdout+stderr CONTAINS the sentinel token (proving the template diagnostic surfaced to the user, not just the failure). Finds the component template by walking the lib's `src/lib` tree for a `*.component.html`.

`beforeAll` builds the project; `afterAll` `rmSync`s the temp workspace.

---

## 7. Build packaging of the plugin (relevant to making generators/executors shippable)

`libs/nx-plugin/project.json` build target (`@nx/js:tsc`) globs the non-TS assets and BOTH JSON manifests into `dist`:

```json
"build": {
  "executor": "@nx/js:tsc",
  "options": {
    "outputPath": "dist/libs/nx-plugin",
    "main": "libs/nx-plugin/src/index.ts",
    "tsConfig": "libs/nx-plugin/tsconfig.lib.json",
    "assets": [
      "libs/nx-plugin/*.md",
      { "input": "./libs/nx-plugin/src", "glob": "**/!(*.ts)", "output": "./src" },
      { "input": "./libs/nx-plugin/src", "glob": "**/*.d.ts",  "output": "./src" },
      { "input": "./libs/nx-plugin", "glob": "generators.json", "output": "." },
      { "input": "./libs/nx-plugin", "glob": "executors.json",  "output": "." }
    ]
  }
}
```

`package.json` declares `"type": "commonjs"`, `"main": "./src/index.js"`, `"executors": "./executors.json"`, `"generators": "./generators.json"`. `tsconfig.lib.json` excludes `*.spec.ts`/`*.test.ts`. The plugin `tsconfig.json` sets `"module": "commonjs"` (note: the current repo's STACK.md mandates `node16`/`nodenext` instead for Angular 22 -- the sandbox's `commonjs` is the very thing the current constraints forbid, because this Nx 19 executor imports compiler-cli statically rather than via `await import()`).

---

## 8. Runner + CI

### Runner: Vitest via `@nx/vite:test` (NOT Jest)

- **Plugin unit/integration:** `libs/nx-plugin/project.json` `test` target -> `@nx/vite:test` with `libs/nx-plugin/vite.config.ts`.
- **Why Vitest, not Jest** (the central testing decision, documented in `RUNEXECUTOR-ESM-ISSUE-PLAN.md` + `INTEGRATION-TESTING-LEARNINGS.md`): `@angular/compiler-cli` bundles use `import.meta.url` / a custom `createRequire` ESM pattern that Jest's CJS runtime cannot load. Three Jest workarounds failed (`ts-jest-mock-import-meta` only transforms `.ts` not the compiler's `.js`; `babel-plugin-transform-import-meta` -> "`_require is not a function`"; Jest experimental-vm-modules -> "`exports is not defined`"). Vitest's native ESM lets the test call `runExecutor` directly (which dynamically loads the executor + compiler-cli) instead of an `execSync('npx nx run ...')` subprocess. Reported speedup: ~17s (execSync) -> ~3.6s (Vitest + runExecutor).
  - NOTE for the current repo: this ESM rationale is even more central, because the current executor reaches compiler-cli via `await import()` (CJS->ESM bridge), so the test runner MUST handle ESM. STACK.md already mandates `@nx/vitest:test` (Nx 23's dedicated Vitest package, which replaced `@nx/vite:test`).

**`libs/nx-plugin/vite.config.ts`** -- the pools/timeouts that matter:

```typescript
test: {
  watch: false,
  globals: true,
  environment: 'node',
  include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  reporters: ['default'],
  coverage: { reportsDirectory: '../../coverage/libs/nx-plugin', provider: 'v8' },
  maxThreads: 1,
  minThreads: 1,
  poolOptions: { threads: { minThreads: 1, maxThreads: 1 } },  // single-worker
  testTimeout: 120000,
}
```

**Single-worker execution (`maxThreads:1`/`minThreads:1` + `poolOptions.threads`)** is deliberate -- the comment says "Force single-worker execution so plugins have time to initialize." Critical because the fixtures share one `libs/e2e-tmp` dir, one `tsconfig.base.json`, and the Nx project graph; parallel workers would race. The cross-suite filesystem lock (section 5) is the second layer of defense.

**Timeouts:** plugin suite `testTimeout: 120000`; per-`it` integration `60000`; `beforeAll` fixture build `600000`; e2e suite `testTimeout: 180000`. `tsconfig.spec.json` `types` include `vitest/globals`, `vitest/importMeta`, `vite/client`, `node`, `vitest`.

**`vitest.workspace.ts`** (root) globs `**/*/vite.config.ts` + `vitest.config.ts` (+ storybook configs).

### CI

There is **no GitHub Actions CI workflow in the sandbox** (`.github/` contains only `instructions/nx.instructions.md`). So there is no test-CI job to carry forward from here -- the current repo's `.github/workflows/ci.yml` already governs that. The sandbox's CI-relevant artifact is the Verdaccio local-registry e2e harness (section 6), which is what a CI e2e job would invoke.

---

## 9. Other techniques + documented learnings/pitfalls worth carrying

1. **Fixture dir must dodge `.gitignore` AND `tsconfig.base.json` excludes** (`INTEGRATION-TESTING-LEARNINGS.md`). Nx project discovery skips both. Naming the fixture root `tmp`/`libs/tmp`/`dist`/`build`/`cache` makes generated projects invisible to `nx run` (symptom: "Cannot find project"). Hence `libs/e2e-tmp`. Things that do NOT fix it: `NX_DAEMON=false`, `NX_CACHE_PROJECT_GRAPH=false`, `NX_SKIP_NX_CACHE=true` (those affect daemon/cache, not gitignore filtering).

2. **`NX_DAEMON=false` everywhere fixtures are generated** -- forces fresh project-graph discovery and avoids a stale daemon graph after dynamic project creation. Set in `initializeFixtures` and on every `execSync`/`execFileSync`.

3. **Dogfood the generator inside fixture setup** -- `createAngularLibraryFixture` calls the plugin's own `typecheck-configuration` generator to wire the target, so the integration tests also exercise the generator end-to-end (in addition to the dedicated e2e and the unit spec).

4. **Restore shared workspace files after fixture teardown** -- `cleanupFixtures` prunes the `libs/e2e-tmp/*` path mappings the Angular library generator injected into `tsconfig.base.json`, then `nx format`s `nx.json`/`tsconfig.base.json`. Without this, the workspace drifts across runs.

5. **The `FsTree` + `flushChanges` (real-disk Tree) approach was PROPOSED but never adopted** (`PLAN-refactor-test-fixtures.md`). It would `import { FsTree, flushChanges } from 'nx/src/generators/tree'` (internal API), call `libraryGenerator` from `@nx/angular/generators` programmatically, `updateJson` the target, then `flushChanges(workspaceRoot, tree.listChanges())`. The sandbox kept the `execSync`-CLI builder instead. The plan explicitly flags `FsTree`/`flushChanges` as "internal APIs (not in `@nx/devkit` public API)" -- relevant if the current repo wants real-disk generation without shelling out. (For the GENERATOR's OWN unit test, the public in-memory `createTreeWithEmptyWorkspace` is what's used and is sufficient.)

6. **Sentinel-token assertion for e2e diagnostic surfacing** -- the e2e template-error test injects a unique token and asserts it appears in the executor's stdout/stderr, proving the diagnostic text (not just the failure code) reaches the user. A cheap, robust way to assert "the right error surfaced" through a subprocess boundary where you can't inspect the diagnostic array.

7. **Reference-counted, lock-guarded, build-once fixture state** (section 5) is the technique that makes a many-file integration catalog affordable under a single-worker runner: 28 fixtures built once, shared across 9 spec files, torn down after the last suite.

8. **`gatherAllDiagnostics` (the executor's core correctness mechanism)** -- the executor replaces Angular's default `gatherDiagnostics` (which short-circuits on TS errors) with a custom function that unconditionally calls EVERY getter (`getTsOptionDiagnostics`, `getNgOptionDiagnostics`, `getTsSyntacticDiagnostics`, `getTsSemanticDiagnostics`, `getNgStructuralDiagnostics`, `getNgSemanticDiagnostics`). The `template-error-lib` test names this explicitly: "tests gatherAllDiagnostics". This is "Approach A" the current repo's CLAUDE.md commits to; the sandbox proves the all-getter gatherer + `performCompilation({ emitFlags: 0, gatherDiagnostics })` works.

---

## Techniques the current repo likely lacks (hypotheses for the audit researcher to confirm)

- **No `typecheck-configuration` generator at all** (confirmed by the milestone brief) -- the sandbox's 33-line generator + schema + generators.json registration + build-asset glob for `generators.json` is the drop-in template.
- **No generator unit test** using `createTreeWithEmptyWorkspace` from `@nx/devkit/testing` (in-memory Tree, seed-one-project, `toEqual` the target).
- **No per-Angular-major integration catalog** (`executor.angularNN.integration.spec.ts`) organized by diagnostic-introduction version, nor the shared `registerAngularTypecheckSuite()` harness.
- **No jscodeshift-based error-injection toolkit** (`test-fixtures.ts`) -- the AST helpers (`addClassProperty`, `addToComponentImports`, `updateComponentMetadata`, etc.) and the 28-fixture registry.
- **No `forceExtendedDiagnosticsAsErrors` helper** to promote NG81xx warnings to errors via `angularCompilerOptions.{strictTemplates,extendedDiagnostics.defaultCategory}`.
- **No build-once / lock-guarded / reference-counted fixture lifecycle** (the `mkdirSync`-lock + ready-flag + `activeSuites` counter pattern).
- **No `excludeLibsFromTypeCheck` dependency-filtering tests** (project-scoped diagnostic filtering, node_modules exclusion) -- both the mocked unit cases and the `main-lib`/`dependency-lib` integration pair.
- **No Verdaccio-backed tarball e2e project** (`nx-plugin-e2e` with `vitest.global-setup.ts` -> `start/stop-local-registry.ts`, `npm pack`/`publish --tag e2e`, `create-nx-workspace` consumer scaffold, sentinel-token stdout assertion).
- **No single-worker Vitest pool config** (`maxThreads:1`/`minThreads:1` + long `testTimeout`s) needed for shared-fixture integration safety.
- **No `NX_DAEMON=false` discipline** around dynamic fixture generation, and no fixture-dir-vs-gitignore/tsconfig-exclude guard.
- **Likely-missing: exact NG code/count assertions.** The sandbox itself only asserts `success === false`; the current milestone's "assert EVERY NG8xxx by exact code/count" goal is BEYOND what the sandbox demonstrates -- the sandbox supplies organization + injection, not code-level assertions. The audit should confirm the current repo has neither, and the synthesizer must design the code/count assertion seam (e.g. capturing logger output or returning the diagnostics array) since the executor currently returns only `{ success }`.
