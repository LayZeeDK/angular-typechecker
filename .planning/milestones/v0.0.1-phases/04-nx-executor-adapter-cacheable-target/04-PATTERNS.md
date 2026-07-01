# Phase 4: Nx Executor Adapter + Cacheable Target - Pattern Map

**Mapped:** 2026-06-28
**Files analyzed:** 17 (new + modified)
**Analogs found:** 16 / 17 (1 file -- the dedicated cache-e2e `project.json`/`vitest.config.mts` -- adapts an existing analog rather than copying it; 0 files have NO analog)

All analogs are IN THIS REPO (no external-clone analog is load-bearing). Every code excerpt below includes the absolute file path and line numbers so the planner can copy patterns directly into plan actions.

## File Classification

| New/Modified File                                                                              | New/Mod | Role                              | Data Flow                                            | Closest Analog (this repo)                                                                                                                                       | Match Quality                                                          |
| ---------------------------------------------------------------------------------------------- | ------- | --------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `packages/angular-typechecker/src/core/render-report.ts`                                       | NEW     | core (render seam)                | transform (CoreResult.diagnostics -> string)         | `src/core/format-report.ts` (delegate target) + `src/core/run-typecheck.ts:340-351` (private `loadTypescript` memo) + `src/core/compiler-loader.ts` (memo shape) | exact (composes 3 existing core members)                               |
| `packages/angular-typechecker/src/core/render-report.spec.ts`                                  | NEW     | test (unit)                       | transform                                            | `src/core/format-report.spec.ts` (injected-`ng`/fake + real-`ts` idiom)                                                                                          | exact                                                                  |
| `packages/angular-typechecker/src/executors/angular-typecheck/normalize-options.ts`            | NEW     | adapter (pure mapper)             | transform (ExecutorContext -> NormalizedOptions)     | the existing `executor.ts` stub (the only devkit-typed file) + `src/core/run-typecheck.ts` `CoreOptions` shape                                                   | role-match (no `internal/` helper exists yet)                          |
| `packages/angular-typechecker/src/executors/angular-typecheck/normalize-options.spec.ts`       | NEW     | test (unit)                       | transform                                            | `src/core/evaluate-result.spec.ts` / `format-report.spec.ts` (pure-fn table tests)                                                                               | role-match                                                             |
| `packages/angular-typechecker/src/executors/angular-typecheck/executor.ts`                     | MODIFY  | adapter (executor default export) | request-response (Nx invokes -> `{ success }`)       | itself (the stub) + `src/core/run-typecheck.ts` (compose target)                                                                                                 | exact (grow in place)                                                  |
| `packages/angular-typechecker/src/executors/angular-typecheck/executor.spec.ts`                | NEW     | test (unit, mock-core)            | request-response                                     | `src/core/infra-failure.spec.ts` (`vi.mock('./compiler-loader')` + re-throw/catch assertions)                                                                    | role-match                                                             |
| `packages/angular-typechecker/src/executors/angular-typecheck/schema.json`                     | MODIFY  | config (executor schema)          | n/a                                                  | itself (extend)                                                                                                                                                  | exact                                                                  |
| `packages/angular-typechecker/src/executors/angular-typecheck/schema.d.ts`                     | MODIFY  | config (TS contract)              | n/a                                                  | itself (extend, lockstep with `schema.json`)                                                                                                                     | exact                                                                  |
| `packages/angular-typechecker/src/executors/angular-typecheck/schema-parity.spec.ts`           | NEW     | test (contract)                   | n/a                                                  | `src/package-manifest.spec.ts` (read JSON via `readFileSync` + assert keys/contract)                                                                             | role-match                                                             |
| `packages/angular-typechecker/executors.json`                                                  | MODIFY  | config                            | n/a                                                  | itself (add `outputCapture`)                                                                                                                                     | exact                                                                  |
| `nx.json`                                                                                      | MODIFY  | config (targetDefaults)           | n/a                                                  | existing `targetDefaults` + `namedInputs` (same file)                                                                                                            | exact                                                                  |
| `tsconfig.base.json`                                                                           | MODIFY  | config (paths alias)              | n/a                                                  | existing `paths` entry (same file)                                                                                                                               | exact                                                                  |
| `libs/typecheck-consumer-dep/**` (NON-buildable lib fixture + `.pristine` sidecar)             | NEW     | fixture (Angular lib)             | n/a                                                  | `fixtures/sibling-import/dependency-lib/` + `apps/ng-spike-app/` (project.json/tsconfig shape)                                                                   | role-match (existing fixtures are NOT graph projects; spike is an APP) |
| `libs/typecheck-consumer/**` (consumer lib carrying the target)                                | NEW     | fixture (Angular lib + target)    | n/a                                                  | `fixtures/sibling-import/main-lib/` (paths-alias import) + `apps/ng-spike-app/project.json` (target wiring)                                                      | role-match                                                             |
| `<cache-e2e-project>/project.json` (dedicated serialized e2e)                                  | NEW     | config (Nx project)               | n/a                                                  | `packages/angular-typechecker/project.json` `test` target (`@nx/vitest:test`)                                                                                    | role-match                                                             |
| `<cache-e2e-project>/vitest.config.mts` (serialized)                                           | NEW     | config (Vitest)                   | n/a                                                  | `packages/angular-typechecker/vitest.config.mts` (+ ADD `singleFork`/`fileParallelism:false`/`testTimeout`)                                                      | role-match (must DIVERGE on parallelism)                               |
| `<cache-e2e-project>/src/cache-busts-on-dep-error.int.spec.ts` + `executor-parity.int.spec.ts` | NEW     | test (integration/e2e)            | request-response (execSync `nx run` / `runExecutor`) | `src/core/run-typecheck.integration.spec.ts` (real-compiler int) + `gate-a-static.spec.ts` (built-artifact + `node:fs`/`node:path` idiom)                        | role-match (no `execSync('nx ...')` spec exists yet)                   |

---

## Pattern Assignments

### `src/core/render-report.ts` (NEW, core render seam, transform) -- D-02 compile-blocker

This is the headline new seam. It composes THREE existing core members: it delegates to `formatReport`, loads `ng` via the exported `loadCompilerCli`, and loads `ts` via a PRIVATE memo it copies from `run-typecheck.ts` (because `loadTypescript` is module-private and must NOT be barrel-exported -- D-02 anti-leak rule).

**Analog 1 -- delegate target `src/core/format-report.ts`** (the exact signature `renderReport` must call). `formatReport(diagnostics, ng, ts_, options)` lines 57-62:

```typescript
export function formatReport(
  diagnostics: readonly ts.Diagnostic[],
  ng: Pick<CompilerCli, 'formatDiagnostics'>,
  ts_: typeof import('typescript'),
  options: FormatOptions,
): string {
```

`FormatOptions` (lines 34-38) is the option shape `renderReport`'s own `RenderOptions` mirrors and forwards:

```typescript
export interface FormatOptions {
  pathBase?: string;
  color: boolean;
  failFast?: boolean;
}
```

**Analog 2 -- private `loadTypescript` memo, COPY VERBATIM from `src/core/run-typecheck.ts` lines 340-351** (D-02 says duplicating this near-free cache in `render-report.ts` is acceptable; do NOT export it):

```typescript
let cachedTypescript: typeof ts | undefined;

async function loadTypescript(): Promise<typeof ts> {
  if (cachedTypescript === undefined) {
    const loaded = (await import('typescript')) as typeof ts & {
      default?: typeof ts;
    };
    cachedTypescript = loaded.default ?? loaded;
  }

  return cachedTypescript;
}
```

**Analog 3 -- the `ng` loader is already exported.** Import `{ loadCompilerCli }` from `./compiler-loader` (`src/core/compiler-loader.ts:16-20`, also re-exported from the barrel). Its memo shape (`cached ??= (await import(...)) as ...`) is the model.

**Barrel export (MODIFY `src/index.ts`):** add `renderReport` + `RenderOptions` alongside the existing exports (`src/index.ts:1-13`). The barrel already exports `loadCompilerCli`, `evaluateResult`, `formatReport`, `runTypecheck` -- but NOT `loadTypescript` (confirmed: it is module-private). Add:

```typescript
export { renderReport } from './core/render-report';
export type { RenderOptions } from './core/render-report';
```

**Type-import convention to copy** (every core module uses `import type ts from 'typescript'` + `import type { CompilerCli } from './compiler-cli-types'`; only the loaders do a VALUE import via `await import()`). See `format-report.ts:1-3`.

---

### `src/core/render-report.spec.ts` (NEW, unit test, transform)

**Analog:** `src/core/format-report.spec.ts` (full file). Reuse its two-mode injection idiom verbatim:

- `fakeNg(returnValue)` -> `{ ng: { formatDiagnostics: vi.fn(() => returnValue) }, formatDiagnostics }` (lines 46-59) to assert delegation/forwarding without a compiler load.
- For the real path, `render-report` itself loads ng/ts -- so the spec exercises the REAL `loadCompilerCli`/`loadTypescript` (an integration-flavored unit test). Mirror the `realNg` shape (lines 61-64) only if mocking the loaders; otherwise assert that `renderReport(result, { color, pathBase, failFast })` forwards each option into `formatReport` output (NG code present, ANSI strip on `color:false`, path relativization on `pathBase`).
- ESC-from-char-code ANSI constants (lines 9-13): `const ESC = String.fromCharCode(0x1b)` -- CLAUDE.md ASCII rule, no literal control char in source.

---

### `src/executors/angular-typecheck/normalize-options.ts` (NEW, adapter pure mapper, transform) -- D-01/D-03

**Analog:** the existing `executor.ts` stub (the only file importing `@nx/devkit`) + the `CoreOptions` target shape in `src/core/run-typecheck.ts:13-26`.

**Imports pattern to copy** (type-only `ExecutorContext`, plus the VALUE import of `joinPathFragments`; `isAbsolute` from `node:path`). The stub `executor.ts:1` shows the type-only devkit import convention:

```typescript
import type { ExecutorContext } from '@nx/devkit';
```

Add `import { joinPathFragments } from '@nx/devkit';` and `import { isAbsolute } from 'node:path';` (the `node:` protocol prefix is the repo convention -- see `run-typecheck.ts:1`, `gate-a-static.spec.ts:1-3`).

**Core pattern -- D-03 tsConfig resolution (workspace-root-relative):**

```typescript
const tsConfigPath = isAbsolute(options.tsConfig) ? options.tsConfig : joinPathFragments(context.root, options.tsConfig);
```

Use `joinPathFragments` (POSIX-stable on Windows arm64), NOT `node:path.join`.

**Return shape -- splits reporter-only knobs out of `CoreOptions`.** Target `CoreOptions` (`run-typecheck.ts:13-26`) has only `{ tsConfigPath, includeDeps?, pathBase? }`. `normalizeOptions` returns `{ coreOptions, maxWarnings?, failFast, color }`:

```typescript
return {
  coreOptions: {
    tsConfigPath,
    includeDeps: options.includeDeps ?? false,
    pathBase: context.root, // D-08 (Phase-3): workspace-root-relative CI paths
  },
  maxWarnings: options.maxWarnings, // undefined stays undefined (EXE-05)
  failFast: options.failFast ?? false,
  color: process.stdout.isTTY === true, // D-04: adapter derives TTY; core stays process-free
};
```

Note `maxWarnings` is forwarded as-is (no `?? 0`): `evaluateResult` (`evaluate-result.ts:40-59`) defensively treats undefined/negative/NaN as unset.

---

### `src/executors/angular-typecheck/normalize-options.spec.ts` (NEW, unit test)

**Analog:** `src/core/evaluate-result.spec.ts` (pure-fn verdict tests) for the table-style assertions, plus the `ExecutorContext` literal shape. Assert: (a) relative `tsConfig` -> `joinPathFragments(root, ...)`; (b) absolute `tsConfig` -> passed through unchanged; (c) the knob split (`maxWarnings` undefined stays undefined; `failFast`/`includeDeps` default to false; `pathBase === context.root`). Build a minimal `ExecutorContext` literal `{ root: '/ws', ... } as ExecutorContext`.

---

### `src/executors/angular-typecheck/executor.ts` (MODIFY -- complete the stub, adapter) -- D-01

**Analog:** itself. Current stub (full file, `executor.ts:1-21`) only does `runTypecheck({ tsConfigPath: options.tsConfig })` then `{ success: result.errorCount === 0 }`. Grow it into the D-01 composition WITHOUT changing the existing default-export signature `(options, context): Promise<{ success: boolean }>`.

**Existing signature + JSDoc to preserve** (`executor.ts:14-17`):

```typescript
export default async function angularTypecheckExecutor(
  options: AngularTypecheckExecutorOptions,
  _context: ExecutorContext,   // un-underscore: context is now USED
): Promise<{ success: boolean }> {
```

**Compose:** `normalizeOptions(options, context)` -> `runTypecheck(coreOptions)` -> `renderReport(...)` -> `process.stdout.write(report)` -> `return evaluateResult(result, { maxWarnings })`.

**Error-handling pattern -- catch `TypecheckInfrastructureError` (re-throw everything else).** The error type to catch is exported from the barrel/`run-typecheck.ts:70-75`:

```typescript
try {
  const result = await runTypecheck(coreOptions);
  const report = await renderReport(result, { pathBase: coreOptions.pathBase, color, failFast });
  process.stdout.write(report); // D-04: RAW stdout, NOT logger.info

  return evaluateResult(result, { maxWarnings });
} catch (error) {
  if (error instanceof TypecheckInfrastructureError) {
    logger.error(`angular-typecheck: ... infrastructure error ...: ${error.message}`);

    return { success: false };
  }

  throw error; // D-01: never swallow an unknown failure
}
```

`logger` is the ONLY non-type devkit value the executor imports: `import { logger } from '@nx/devkit';` (devkit `logger.error` is verified present per RESEARCH). The infra-error class is already a re-throwing seam in core (`run-typecheck.ts:171-179` throws it; this adapter is its catch site, as the class JSDoc at lines 62-69 states).

---

### `src/executors/angular-typecheck/executor.spec.ts` (NEW, unit test, mock-core) -- D-01

**Analog:** `src/core/infra-failure.spec.ts` (full file) -- the canonical mock-the-loader + assert-catch/re-throw pattern in this repo.

- Hoisted mock handle + `vi.mock('./compiler-loader', ...)` (lines 20-47) to drive `runTypecheck` deterministically; OR mock the core modules the executor imports.
- Re-throw assertion idiom: `await expect(fn()).rejects.toBeInstanceOf(TypecheckInfrastructureError)` (lines 89-91) -- mirror it to prove the executor RE-THROWS a non-infra error and returns `{ success: false }` ONLY for `TypecheckInfrastructureError`.
- Also assert the mapping `errorCount===0 -> { success: true }` and that `process.stdout.write` (not `logger.info`) carries the report (spy on `process.stdout.write`).

---

### `schema.json` + `schema.d.ts` (MODIFY, config, lockstep) -- D-06

**Analog:** itself. Current `schema.json` (`schema.json:1-16`) has only `tsConfig`. Extend the `properties` block to 4 props + `"version": 2` + keep `additionalProperties: false`. Exact target shape (from RESEARCH Code Examples, D-06):

- `tsConfig` (string, required, FLAG -- keep, add the "resolved relative to the workspace root" wording).
- `includeDeps` (boolean, `default: false`).
- `maxWarnings` (number, **NO `default` key** -- a `default: 0` is an un-loosenable footgun since NG8xxx default to warning).
- `failFast` (boolean, `default: false`, with the "NOT a speed-up" description).
- Add top-level `"version": 2`. NO `aliases`. NO `mode` enum.

**`schema.d.ts` lockstep** (`schema.d.ts:1-3` currently `{ tsConfig: string }`) ->

```typescript
export interface AngularTypecheckExecutorOptions {
  tsConfig: string;
  includeDeps?: boolean;
  maxWarnings?: number;
  failFast?: boolean;
}
```

These camelCase names MUST match `CoreOptions`/`EvaluateOptions`/`FormatOptions` keys so the adapter is a literal pass-through.

---

### `schema-parity.spec.ts` (NEW, contract test) -- D-06 key-parity

**Analog:** `src/package-manifest.spec.ts` (full file) -- the canonical "read a JSON file via `readFileSync` and assert its declared contract" pattern.

- Path-resolution idiom (lines 1-3, 29-30): `join(dirname(fileURLToPath(import.meta.url)), ...)` then `readFileSync(..., 'utf8')` + `JSON.parse`.
- Assert `Object.keys(schema.properties).sort()` === the `AngularTypecheckExecutorOptions` key set (ARCHITECTURE Pattern 4). Because TS interfaces have no runtime keys, encode the expected key set as a literal array in the test (the parity test's job is to fail loudly if `schema.json` and `schema.d.ts` drift).

---

### `executors.json` (MODIFY, config) -- D-04

**Analog:** itself (`executors.json:1-9`). Add `"outputCapture": "direct-nodejs"` to the `angular-typecheck` entry (verified valid value per RESEARCH). The existing `implementation`/`schema`/`description` keys stay; insert `outputCapture` alongside them.

---

### `nx.json` (MODIFY, config -- executor-id-keyed cacheable targetDefault) -- D-07/D-08

**Analog:** the existing `targetDefaults` + `namedInputs` in `nx.json` (same file, lines 4-41). Add a NEW key to `targetDefaults` keyed by the EXECUTOR id (precedence over target-name key). The existing entries are target-name OR executor-id keyed (`@nx/js:tsc`, `@nx/vitest:test`, etc., lines 15-41) -- copy that object shape.

**Existing `namedInputs` (lines 4-14) -- REUSE, do NOT redefine.** `production` (line 6) and `default` (line 5) already exist; the D-08 recipe references them by name (`"production"`, `"^default"`).

**The exact entry to add** (from CONTEXT.md Specific Ideas + RESEARCH; both input-object shapes verified valid `InputDefinition` members):

```json
"angular-typechecker:angular-typecheck": {
  "cache": true,
  "outputs": [],
  "inputs": [
    "production",
    "{projectRoot}/tsconfig*.json",
    "{projectRoot}/package.json",
    "{workspaceRoot}/tsconfig.base.json",
    "^default",
    { "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}", "transitive": true },
    { "externalDependencies": ["typescript", "@angular/compiler-cli"] }
  ]
}
```

Note the existing `@nx/js:tsc` default (lines 16-20) uses `"inputs": ["production", "^production"]`; the new target deliberately uses `^default` (D-09 inlined-source model), NOT `^production` -- this divergence is load-bearing.

---

### `tsconfig.base.json` (MODIFY, config -- namespaced fixture paths alias) -- D-11

**Analog:** the existing `compilerOptions.paths` entry (`tsconfig.base.json:19-23`):

```json
"paths": {
  "@angular-typechecker/angular-typechecker": [
    "./packages/angular-typechecker/src/index.ts"
  ]
}
```

Add a SIBLING namespaced alias pointing at fixture SOURCE (not dist) -- this forms the consumer->dep Nx graph edge (D-10):

```json
"@fixtures/typecheck-consumer-dep": ["libs/typecheck-consumer-dep/src/index.ts"]
```

The alias must NOT shadow the product alias and must be namespaced `@fixtures/...` (D-11 hygiene). Note `tsconfig.base.json` `exclude` (lines 25-28) lists `node_modules` + `tmp` -- the new `libs/` are NOT excluded, so they ARE discovered graph projects (the D-11 non-negotiable).

---

### `libs/typecheck-consumer-dep/**` + `libs/typecheck-consumer/**` (NEW, committed Angular lib fixtures) -- D-11

These are REAL main-graph projects (NOT under gitignored `tmp`/`dist` -- see `.gitignore:4-5`; the fixture-discovery trap requires graph membership). The existing `fixtures/` dir is NOT a graph (no `project.json` files there) and the spike is an APP -- so this is a blended analog.

**Project.json analog -- `apps/ng-spike-app/project.json` (target-wiring shape) + `packages/angular-typechecker/project.json` (library shape).** For the NON-buildable dep, OMIT the `build` target entirely (D-11 critical cache case). For the consumer, add the `angular-typecheck` target:

```json
"targets": {
  "angular-typecheck": {
    "executor": "@angular-typechecker/angular-typechecker:angular-typecheck",
    "options": { "tsConfig": "libs/typecheck-consumer/tsconfig.lib.json" }
  }
}
```

The `cache: true`/`outputs: []`/`inputs` come from the `nx.json` executor-id targetDefault (D-07) -- do NOT repeat them per-project. Add `"tags": ["scope:fixture"]` (D-11 hygiene; the spike/plugin use `"tags": []`).

**tsconfig analog -- `fixtures/sibling-import/main-lib/tsconfig.lib.json`** (`tsconfig.lib.json:1-20`) shows the Angular-lib leaf tsconfig shape used by the engine: `extends` base, `noEmit: true`, `target: es2022`, `module: preserve`, `moduleResolution: bundler`, `strict: true`, `angularCompilerOptions.strictTemplates: true`, explicit `files`/`include`. The consumer imports the dep via the `tsconfig.base.json` alias (NOT a local `paths` -- the global alias is what forms the Nx edge), mirroring how `main.component.ts` imports `@sibling/dependency-lib`.

**Component analog -- `fixtures/sibling-import/main-lib/main.component.ts`** (`main.component.ts:1-25`): a standalone `@Component` with a template, importing the sibling. The consumer component imports `@fixtures/typecheck-consumer-dep` so the injected dep error lands IN the consumer's program (D-11 / Phase-3 boundary filter D-05/D-07). The injected-error idiom is the in-file `label: number = 'string'` TS2322 (main.component.ts:23) -- but for TEST-04 the error is injected into the DEP source at runtime, not committed.

**`package.json` per fixture:** `"private": true` (D-11 hygiene; no analog in-repo -- the spike/plugin are not private, so author fresh).

**`.pristine` sidecar (D-15):** a committed byte-copy of the mutated dep source file (e.g. `src/lib/dep.component.ts.pristine`) for crash-safe heal. No in-repo analog (new pattern); the consuming test's `beforeAll` heals from it.

---

### `<cache-e2e-project>/project.json` + `vitest.config.mts` (NEW, dedicated serialized e2e) -- D-14

**Analog:** `packages/angular-typechecker/project.json` `test` target (`project.json:45-53`) + `packages/angular-typechecker/vitest.config.mts` (full file). COPY the `@nx/vitest:test` target shape, but the Vitest config MUST DIVERGE on parallelism (this is the whole point of D-14).

**project.json `test` target to copy** (lines 45-53):

```json
"test": {
  "executor": "@nx/vitest:test",
  "outputs": ["{options.reportsDirectory}"],
  "options": { "reportsDirectory": "coverage/<cache-e2e-project>" }
}
```

**vitest.config.mts -- copy the base shape (`vitest.config.mts:1-21`) then ADD serialization** (the existing config has NONE of these; D-14 requires all):

```typescript
test: {
  // ...existing name/watch/include...
  pool: 'forks',
  poolOptions: { forks: { singleFork: true } },
  fileParallelism: false,
  sequence: { concurrent: false },
  testTimeout: 180000,
}
```

The existing config uses `environment: 'jsdom'` + `globals: true` + `nxViteTsPaths()`/`nxCopyAssetsPlugin` plugins (lines 2-13) -- keep the plugins; `jsdom` is unnecessary for an execSync harness (node env is fine).

---

### `<cache-e2e-project>/src/cache-busts-on-dep-error.int.spec.ts` + `executor-parity.int.spec.ts` (NEW, integration/e2e) -- D-12..D-16

No `execSync('nx ...')` spec exists in this repo yet, so this blends two analogs.

**Analog 1 -- real-compiler integration: `src/core/run-typecheck.integration.spec.ts`** (full file) for: the `node:path` workspace-root resolution (lines 1-2, 21-24 `join(dirname(fileURLToPath(import.meta.url)), ...)`), the NG-code helper `const NG = (code) => -990000 - code` (lines 16-17, for asserting the injected error code in stdout/parity), and the `describe.each`/structured-assertion style. For `executor-parity.int.spec.ts` (D-16): call `runTypecheck` directly to get the `CoreResult` baseline, then `runExecutor` for the executor side, and assert `{ success } === (errorCount === 0)` + the sorted `code` sets match -- structured values, NOT rendered stdout.

**Analog 2 -- built-artifact / fs+exec idiom: `src/executors/angular-typecheck/gate-a-static.spec.ts`** (full file) for: the `node:fs`/`node:path` import discipline (lines 1-3), reading from gitignored/dist locations via `readFileSync` (CLAUDE.md: NEVER `git grep` on gitignored paths), and substring/regex assertions on captured output. Mirror its `stripCommentLines` defensiveness if matching markers in noisy output.

**New patterns (no in-repo analog -- author per RESEARCH skeleton, lines 582-616):**

- `execSync('npx nx run <consumer>:angular-typecheck --output-style=static --no-color ...', { env, encoding: 'utf8' })` with `env = { ...process.env, NX_DAEMON: 'false', FORCE_COLOR: '0', NX_CACHE_DIRECTORY: <tmpdir> }`; catch the throw to capture non-zero exit + stdout/stderr.
- Cache-hit marker substring: `'Nx read the output from the cache instead of running the command'` (D-12).
- R1 edge guard pre-flight (D-10): `execSync('nx show target inputs <consumer>:angular-typecheck --check <dep-source-file>')` -- exit 0 + `✓ ... is an input`; do NOT pipe through `head`/`rg` (pipe masks Nx's exit code -- RESEARCH anti-pattern).
- Crash-safe revert (D-15): `beforeAll` heal from `.pristine`, `finally` byte-restore of captured original (preserve EOL), CI backstop `git diff --exit-code -- libs/typecheck-consumer-dep`.

---

## Shared Patterns

### Module-loading bridge (CJS -> ESM via memoized `await import()`)

**Source:** `src/core/compiler-loader.ts:16-20` (the `ng` loader) + `src/core/run-typecheck.ts:340-351` (the private `ts` loader).
**Apply to:** `render-report.ts` (copies the `ts` memo) -- the ONLY new file that loads a compiler module. Everything else uses `import type`.

```typescript
let cached: CompilerCli | undefined;
export async function loadCompilerCli(): Promise<CompilerCli> {
  cached ??= (await import('@angular/compiler-cli')) as unknown as CompilerCli;
  return cached;
}
```

This literal `import(` is the GATE-A invariant (must survive `module: nodenext` emit). New code that loads ESM MUST use `await import()`, never `require()`.

### Pure-function-with-injected-compiler-surface

**Source:** `src/core/format-report.ts:57-83` + `src/core/evaluate-result.ts:40-59`.
**Apply to:** `render-report.ts` delegates to this pattern; `normalize-options.ts` is pure (no I/O); `evaluateResult` is consumed verbatim by the executor as THE verdict (do NOT add `internal/exit-code.ts` -- it is stale per CONTEXT.md/D-01).

### `@nx/devkit` confinement (type-only ctx + `logger`/`joinPathFragments` values)

**Source:** `src/executors/angular-typecheck/executor.ts:1` (`import type { ExecutorContext } from '@nx/devkit'`).
**Apply to:** ONLY `executor.ts` + `normalize-options.ts` (the adapter tier). Core files import ZERO devkit (lint-enforced, Phase-3 D-11). `executor.ts` adds `import { logger }`; `normalize-options.ts` adds `import { joinPathFragments }`.

### `node:` protocol + ESC-from-char-code (CLAUDE.md ASCII rule)

**Source:** `run-typecheck.ts:1` (`import { dirname } from 'node:path'`); `format-report.ts:11` + `format-report.spec.ts:11` (`String.fromCharCode(0x1b)`).
**Apply to:** all new files -- always `node:fs`/`node:path`/`node:child_process`; never a literal control char in source.

### JSON-contract test via `readFileSync` + `JSON.parse`

**Source:** `src/package-manifest.spec.ts:1-43` + `gate-a-static.spec.ts:41-44`.
**Apply to:** `schema-parity.spec.ts` (read `schema.json`, assert keys). `gate-a-static.spec.ts` additionally shows deriving paths from `project.json` config rather than hard-coding.

### Mock-the-loader unit isolation

**Source:** `src/core/infra-failure.spec.ts:20-47` (`vi.hoisted` + `vi.mock('./compiler-loader', ...)`).
**Apply to:** `executor.spec.ts` (drive the core deterministically to test the catch/re-throw/mapping without a real compiler run).

---

## No Analog Found

No file in scope lacks an analog. The two patterns with the WEAKEST in-repo analog (authored fresh against RESEARCH skeletons, not copied) are noted inline above:

| Pattern                                                            | Role           | Data Flow        | Reason                                                | Source instead                                                                                                      |
| ------------------------------------------------------------------ | -------------- | ---------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `execSync('nx run ...')` / `nx show target inputs --check` harness | test (e2e)     | request-response | No spec in this repo shells out to the `nx` CLI yet   | RESEARCH 04-RESEARCH.md Code Examples (harness skeleton lines 582-616, marker line 577-580, R1 guard lines 566-573) |
| `.pristine` sidecar + crash-safe `finally` byte-restore            | fixture/test   | n/a              | New crash-safety pattern (D-15); no in-repo precedent | RESEARCH D-15 / CONTEXT.md D-15                                                                                     |
| `"private": true` fixture `package.json`                           | fixture config | n/a              | Spike/plugin manifests are not private                | Author fresh per D-11 hygiene                                                                                       |

---

## Metadata

**Analog search scope:** `packages/angular-typechecker/src/**` (core + executor + specs), `packages/angular-typechecker/{project.json,executors.json,vitest.config.mts,package.json}`, `nx.json`, `tsconfig.base.json`, `apps/ng-spike-app/**`, `fixtures/**`, `.gitignore`.
**Files scanned (read in full or targeted):** 21 source/config/spec files.
**External clones (`D:/projects/github/nrwl/nx`, `push-based/nx-verdaccio`, etc.):** referenced in CONTEXT/RESEARCH for Nx-behavior validation but NOT used as code-copy analogs -- every load-bearing pattern has a stronger in-repo analog.
**Pattern extraction date:** 2026-06-28
