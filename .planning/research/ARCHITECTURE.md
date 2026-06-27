# Architecture Research

**Domain:** Nx plugin wrapping a shared Angular type-check core (executor now; CLI bin / createNodesV2 / Angular builder later)
**Researched:** 2026-06-27
**Confidence:** HIGH (grounded in three live reference codebases on disk: push-based/nx-verdaccio, angular/angular-cli `@angular/build`, analogjs/analog; cross-checked against current Nx 23 extending-nx docs)

## Summary recommendation (one line)

A single published package whose `src/` is split into a **framework-agnostic core** (`src/core/` -- the diagnostic engine, tsconfig resolution, filtering, reporting; zero Nx/CLI imports) and **thin adapters** (`src/executors/<name>/` now; `src/plugin/`, `src/cli/`, `src/builders/` later) that only translate environment-specific inputs into one `runTypecheck(coreOptions)` call and translate the result back out. Tests live colocated (`*.unit.test.ts` / `*.int.test.ts`) plus a sibling `testing/` test-utils package for the `createFsTree`/`flushFsTreeChanges` quarantine and a fixtures workspace under `e2e/`.

---

## Standard Architecture

### System Overview

```
+---------------------------------------------------------------------+
|                         ADAPTER LAYER (thin)                         |
|   each maps its own input shape -> CoreOptions, calls core, maps     |
|   CoreResult -> its own output/exit contract. No diagnostic logic.   |
|                                                                      |
|  +-------------+  +--------------+  +-----------+  +---------------+  |
|  | Nx executor |  | createNodesV2|  |  CLI bin  |  | ng builder    |  |
|  | (v0.0.1)    |  |  (deferred)  |  | (deferred)|  | (deferred)    |  |
|  | executor.ts |  | plugin.ts    |  | bin.ts    |  | builder.ts    |  |
|  +------+------+  +------+-------+  +-----+-----+  +-------+-------+  |
|         |                |               |                 |          |
+---------+----------------+---------------+-----------------+----------+
          |                |               |                 |
          v                v               v                 v
+---------------------------------------------------------------------+
|                  CORE LAYER (framework-agnostic)                     |
|   No imports of @nx/devkit, yargs, @angular-devkit/architect.        |
|   Pure inputs (absolute paths + plain option object) -> result.      |
|                                                                      |
|   runTypecheck(options: CoreOptions): Promise<CoreResult>            |
|        |            |              |              |                   |
|   +----v----+  +----v-----+  +-----v------+  +----v--------+         |
|   | tsconfig|  | gatherer |  | filtering  |  | reporting   |         |
|   | resolve |  | (all-    |  | (deps /    |  | (format-    |         |
|   |         |  |  getter) |  | maxWarn)   |  | Diagnostics)|         |
|   +----+----+  +----+-----+  +------------+  +-------------+         |
+--------+------------+------------------------------------------------+
         |            |
         v            v
+---------------------------------------------------------------------+
|             LAZY ESM BOUNDARY (await import(), cached)               |
|   @angular/compiler-cli  +  typescript   (peerDeps, consumer's)     |
+---------------------------------------------------------------------+
```

### Component Responsibilities

| Component | Responsibility | Reference / Implementation |
|-----------|----------------|----------------------------|
| **Core: `runTypecheck`** | Single public entry to the engine. Orchestrates resolve -> gather -> filter -> report. The ONE function every adapter calls. | Mirrors `@angular/build`'s `AngularCompilation.diagnoseFiles(modes = DiagnosticModes.All)` public method. |
| **Core: tsconfig resolution** | Load + `extends`-chain merge one tsconfig via `readConfiguration` with Angular overrides (`suppressOutputPathCheck`, `outDir: undefined`, no emit). | `AngularCompilation.loadConfiguration()` (`aot-compilation.ts` peer). |
| **Core: gatherer** | Run option/syntactic/semantic + Angular template + extended (NG8xxx) **unconditionally** per file via `getDiagnosticsForFile(sf, OptimizeFor.WholeProgram)`. Bitflag modes enum. | `collectDiagnostics(modes)` generator in `aot-compilation.ts` (the exact PROJECT.md engine). |
| **Core: filtering** | Drop out-of-project + `node_modules` diagnostics by default (opt-in `includeDeps`); apply category gating; count warnings for `--max-warnings`. | New (no direct peer); operates on `ts.Diagnostic[]`. |
| **Core: reporting** | Default human output via compiler-cli `formatDiagnostics`. Returns a structured `CoreResult` (counts + raw diagnostics) so adapters can re-render (JSON/SARIF later) without re-running. | `formatDiagnostics` from `@angular/compiler-cli`. |
| **Core: compiler loader** | `await import('@angular/compiler-cli')` + `await import('typescript')`, memoized in module scope. CJS-safe ESM bridge. | `AngularCompilation.loadCompilerCli()` static-cached pattern (verbatim shape). |
| **Adapter: Nx executor** | Read `ExecutorContext`, resolve `tsConfig` to an absolute path, build `CoreOptions`, call `runTypecheck`, map `CoreResult.success` -> `{ success: boolean }`. | nx-verdaccio `src/executors/*/executor.ts` (default export `async (options, context) => {...}`). |
| **Adapter: createNodesV2** (deferred) | Glob `**/tsconfig*.json` (or project files), infer `angular-typecheck` targets pointing at the executor **you own**. No diagnostic logic. | nx-verdaccio `src/plugin/nx-verdaccio.plugin.ts`. |
| **Adapter: CLI bin** (deferred) | Parse argv, resolve cwd-relative tsconfig, call `runTypecheck`, `process.exit(code)`. | New thin `src/cli/bin.ts`. |
| **Adapter: ng builder** (deferred) | `createBuilder`, map Architect options -> `CoreOptions`, yield `{ success }`. | `@angular/build` `builders/*/index.ts` `execute` wrappers. |

---

## Recommended Project Structure

This package lives inside the angular-typechecker repo's own Nx workspace (dogfooding `nx release`). The structure below is the **published library project** plus its sibling test/fixture projects. `[confirms PROJECT.md]` / `[adds]` / `[contradicts]` tags mark each decision.

```
angular-typechecker/                         # repo root = its own Nx workspace
+-- nx.json
+-- package.json                             # workspace root (private:true)
+-- tsconfig.base.json
+-- vitest.workspace.ts                      # [adds] aggregates unit + int projects
|
+-- packages/
|   +-- angular-typechecker/                 # THE published library
|       +-- package.json                     # publish manifest (see Build/Publish)
|       +-- project.json                      # build/lint/unit-test/int-test targets
|       +-- executors.json                   # [confirms] maps angular-typecheck -> impl
|       +-- README.md
|       +-- tsconfig.json                     # solution-style references
|       +-- tsconfig.lib.json                 # [adds] what COMPILES (excludes *.test.ts)
|       +-- tsconfig.spec.json                # [adds] test compilation
|       +-- vitest.unit.config.ts             # [adds] mock-compiler-cli tier
|       +-- vitest.int.config.ts              # [adds] real-compiler-vs-fixtures tier
|       |
|       +-- src/
|           +-- index.ts                      # PUBLIC barrel: re-exports core API +
|           |                                 #   (later) createNodesV2. NOT executors.
|           |
|           +-- core/                         # [adds] framework-agnostic engine
|           |   +-- index.ts                  #   internal barrel for core
|           |   +-- run-typecheck.ts          #   runTypecheck(options): the ONE entry
|           |   +-- run-typecheck.unit.test.ts
|           |   +-- options.ts                #   CoreOptions / CoreResult types
|           |   +-- compiler-loader.ts        #   await import() of compiler-cli + ts (cached)
|           |   +-- compiler-loader.unit.test.ts
|           |   +-- tsconfig/
|           |   |   +-- resolve-tsconfig.ts   #   readConfiguration + extends merge + ng overrides
|           |   |   +-- resolve-tsconfig.int.test.ts
|           |   +-- gatherer/
|           |   |   +-- diagnostic-modes.ts   #   bitflag enum (Option|Syntactic|Semantic|Template)
|           |   |   +-- gather-diagnostics.ts #   unconditional all-getter (models @angular/build)
|           |   |   +-- gather-diagnostics.unit.test.ts   # mock compiler-cli
|           |   |   +-- gather-diagnostics.int.test.ts    # real compiler vs fixtures
|           |   +-- filter/
|           |   |   +-- filter-diagnostics.ts #   deps boundary + category + maxWarnings count
|           |   |   +-- filter-diagnostics.unit.test.ts
|           |   +-- report/
|           |       +-- format-human.ts       #   formatDiagnostics wrapper (default reporter)
|           |       +-- format-human.unit.test.ts
|           |
|           +-- executors/                    # [confirms] adapter layer
|           |   +-- angular-typecheck/
|           |       +-- executor.ts           #   default export (options, context) => {success}
|           |       +-- executor.unit.test.ts #   mock core; assert option mapping + exit
|           |       +-- executor.int.test.ts  #   real core vs a fixture project
|           |       +-- schema.json           #   [confirms] CLI/Nx Console schema (source of truth)
|           |       +-- schema.d.ts           #   [adds] TS mirror of schema.json
|           |       +-- normalize-options.ts  #   ExecutorContext -> CoreOptions (testable alone)
|           |       +-- normalize-options.unit.test.ts
|           |
|           +-- plugin/                        # [adds, DEFERRED] createNodesV2 home, pre-carved
|           |   +-- (empty in v0.0.1; folder reserved by convention)
|           +-- cli/                            # [adds, DEFERRED] standalone bin
|           +-- builders/                       # [adds, DEFERRED] @angular-devkit/architect
|           |
|           +-- internal/                      # [adds] shared adapter helpers (NOT core, NOT public)
|               +-- project-paths.ts           #   ExecutorContext -> {projectRoot, workspaceRoot}
|               +-- project-paths.unit.test.ts
|               +-- exit-code.ts               #   CoreResult + maxWarnings -> {success}
|
+-- testing/                                   # [confirms PROJECT.md] test-utils as own projects
|   +-- test-nx-utils/                         #   QUARANTINE: createFsTree / flushFsTreeChanges
|   |   +-- package.json                       #   (nx-internal FsTree + flushChanges)
|   |   +-- src/
|   |       +-- index.ts
|   |       +-- create-fs-tree.ts              #   eslint-disable, single import site of nx-internal
|   |       +-- materialize-tree.ts            #   flush Tree changes to real disk for int tests
|   +-- test-fixtures/                         #   fixture loaders + error-injection helpers
|       +-- src/
|           +-- index.ts
|           +-- load-fixture.ts                #   resolve a committed fixture by name
|           +-- inject-error.ts                #   mutate a fixture to trigger a known NG/TS code
|
+-- fixtures/                                  # [adds] committed source fixtures (data, not a project)
|   +-- diagnostics/                           #   minimal files keyed by diagnostic code
|   |   +-- ng8xxx/...                          #   one file per template/extended code, v13->v22
|   |   +-- ts/...                              #   TS-only error samples
|   +-- README.md                              #   maps fixture -> expected code(s)
|
+-- e2e/
    +-- angular-typechecker-e2e/               # [confirms] representative real workspace + tarball
        +-- project.json
        +-- fixtures/
        |   +-- workspace/                     #   ONE Nx+Angular 22 workspace exercising all 5 types
        |       +-- apps/demo-app/             #   application
        |       +-- libs/local-lib/            #   local (non-buildable) library
        |       +-- libs/buildable-lib/        #   buildable library
        |       +-- libs/publishable-lib/      #   publishable library
        |       +-- (each lib carries tsconfig.spec.json)  # spec tsconfig (5th type)
        +-- setup/                             #   verdaccio/tarball install harness (late phase)
        +-- test/
            +-- executor-smoke.e2e.test.ts     #   ONE smoke early (PROJECT.md)
            +-- tarball-matrix.e2e.test.ts     #   full publish/install matrix (late phase)
```

### Structure Rationale

- **`src/core/` (no Nx/CLI imports):** The single most important boundary. If core never imports `@nx/devkit`, `yargs`, or `@angular-devkit/architect`, then the CLI, createNodesV2, and builder adapters cost ~50 lines each later -- each is "parse my inputs, call `runTypecheck`, map the result." This directly enables the four deferred surfaces in PROJECT.md without a refactor. Enforce with an ESLint `no-restricted-imports` rule (or an Nx module-boundary tag `scope:core` that forbids `scope:adapter`).
- **One public entry `runTypecheck(CoreOptions)`:** Modeled on `@angular/build`'s `AngularCompilation.diagnoseFiles(modes = DiagnosticModes.All)` -- the codebase PROJECT.md says to mirror. A single coarse function (not a class hierarchy) is right for v0.0.1; the bitflag `DiagnosticModes` enum (`Option | Syntactic | Semantic`, with a `Template`/`All` superset) is carried verbatim because it is also how fail-fast vs report-all and future per-file modes will be expressed.
- **`internal/` vs `core/`:** nx-verdaccio uses `src/internal/` for shared adapter plumbing (process exec, logging, target running). Here `internal/` is strictly adapter-side glue (ExecutorContext path extraction, exit-code mapping) that depends on `@nx/devkit` and therefore must NOT live in `core/`. Keeping them separate preserves the core's portability.
- **Colocated tests (`*.unit.test.ts` / `*.int.test.ts`):** Both nx-verdaccio and analog colocate. The two suffixes map exactly to PROJECT.md's two non-e2e tiers (unit = mock compiler-cli; int = real compiler vs fixtures) and let `vitest.unit.config.ts` / `vitest.int.config.ts` select by glob. `tsconfig.lib.json` excludes `**/*.test.ts` so tests never ship.
- **`testing/test-nx-utils` as its own project:** This is where the carried-forward `createFsTree`/`flushFsTreeChanges` (nx-internal `FsTree` + `flushChanges` from `nx/src/generators/tree`) is quarantined behind a single barrel with `eslint-disable`. nx-verdaccio does exactly this (`testing/test-nx-utils/src/lib/utils/tree.ts`). Isolating the one unstable internal import to one file means a future Nx bump that breaks it touches one place, and the library proper stays clean.
- **`fixtures/` as committed data, not a project:** The v13->v22 diagnostic catalog is plain source files keyed by code, consumed by int tests via `testing/test-fixtures/load-fixture.ts`. Keeping them out of `src/` keeps them out of the published tarball and out of `tsconfig.lib.json`.
- **`e2e/` representative workspace:** ONE Angular 22 + Nx 23 workspace containing app / local lib / buildable lib / publishable lib (+ each lib's `tsconfig.spec.json`) covers all five PROJECT.md project types in one place. The smoke test runs against it early; the tarball-install matrix is wired in the late phase.
- **`src/index.ts` exports core + (later) `createNodesV2`, never executors:** Executors are referenced by path in `executors.json` and loaded via `require()` by Nx -- they are not part of the importable JS API. The barrel exposes the core types (so consumers/tests can call `runTypecheck`) and, in the next milestone, the `createNodesV2` value (nx-verdaccio's `index.ts` exports exactly this).

---

## Architectural Patterns

### Pattern 1: Thin adapter over a single core entry ("hexagonal-lite")

**What:** Every surface is a translator with two responsibilities only: (1) turn its native input into `CoreOptions` (absolute `tsConfig`, mode flags, `includeDeps`, `maxWarnings`), (2) turn `CoreResult` into its native output (Nx `{success}`, CLI exit code, Architect output).
**When to use:** Whenever a second surface appears (createNodesV2 infers a target -> still just calls the executor; CLI/builder call core directly).
**Trade-offs:** One extra indirection (`normalize-options.ts`) per adapter; in exchange every new surface is small and the diagnostic logic is tested once. This is the central design lever for PROJECT.md's deferred-surfaces requirement.

**Example:**
```typescript
// src/executors/angular-typecheck/executor.ts  (the WHOLE adapter)
import type { ExecutorContext } from '@nx/devkit';
import { runTypecheck } from '../../core';
import { normalizeOptions } from './normalize-options';
import type { AngularTypecheckExecutorSchema } from './schema';

export default async function angularTypecheckExecutor(
  options: AngularTypecheckExecutorSchema,
  context: ExecutorContext,
): Promise<{ success: boolean }> {
  const coreOptions = normalizeOptions(options, context); // ExecutorContext -> CoreOptions
  const result = await runTypecheck(coreOptions);         // all logic lives here

  return { success: result.success };
}
```

### Pattern 2: Lazy, memoized ESM bridge from CJS

**What:** Core never statically imports `@angular/compiler-cli` or `typescript`. It `await import()`s them on first use and caches the module reference at module scope.
**When to use:** Always, in core. This is what makes the CJS executor (Nx's `require()` loader) able to drive the ESM-only compiler-cli (PROJECT.md module-format decision).
**Trade-offs:** First call pays the dynamic-import cost; subsequent calls are free. The cache must be module-scoped (not per-call) or every file pays it.

**Example:**
```typescript
// src/core/compiler-loader.ts  (shape lifted from @angular/build AngularCompilation)
import type * as ng from '@angular/compiler-cli';
import type * as ts from 'typescript';

let compilerCli: typeof ng | undefined;
let typescript: typeof ts | undefined;

export async function loadCompilerCli(): Promise<typeof ng> {
  return (compilerCli ??= await import('@angular/compiler-cli'));
}

export async function loadTypescript(): Promise<typeof ts> {
  return (typescript ??= await import('typescript'));
}
```

### Pattern 3: Unconditional all-getter gatherer with bitflag modes

**What:** Instead of `ngc`'s phase-fail-fast `defaultGatherDiagnostics`, iterate every source file and yield option + syntactic + semantic + `getDiagnosticsForFile(sf, OptimizeFor.WholeProgram)` regardless of earlier errors. A `DiagnosticModes` bitflag selects which getters run (report-all = `All`; fail-fast = stop the generator on the first error).
**When to use:** The core gatherer, always (this IS the PROJECT.md engine -- modeling `@angular/build`, not `ngc`).
**Trade-offs:** Slower than short-circuiting because it never bails early -- but completeness is the product. The bitflag enum future-proofs the deferred per-file/incremental (`OptimizeFor.SingleFile`) migration.

**Example:**
```typescript
// src/core/gatherer/diagnostic-modes.ts  (verbatim from @angular/build)
export enum DiagnosticModes {
  None = 0,
  Option = 1 << 0,
  Syntactic = 1 << 1,
  Semantic = 1 << 2,           // includes Angular template + extended (NG8xxx)
  All = Option | Syntactic | Semantic,
}
```

### Pattern 4: schema.json is the source of truth; schema.d.ts mirrors it

**What:** Each executor folder carries both `schema.json` (drives Nx CLI parsing + Nx Console UI) and `schema.d.ts`/`schema.ts` (a hand-written TS type the implementation imports). They must be kept in sync.
**When to use:** Every executor (and later generator). nx-verdaccio uses a `schema.ts` exporting an `Options` type alongside `schema.json`.
**Trade-offs:** Two files to keep aligned; an optional unit test can assert the JSON `properties` keys match the TS interface keys.

---

## Data Flow

### Type-check request flow (executor)

```
nx run my-lib:typecheck
        |
        v
Nx loader require()s executor.ts (CJS)
        |
        v
normalizeOptions(options, context)            // resolve tsConfig -> absolute, read context.root
        |
        v
runTypecheck(coreOptions)                       [CORE]
   |-- resolveTsconfig()        await import(compiler-cli).readConfiguration + extends + ng overrides
   |-- loadCompilerCli()/loadTypescript()       await import(), cached
   |-- gatherDiagnostics(modes=All)             unconditional per-file getters -> ts.Diagnostic[]
   |-- filterDiagnostics()                      drop node_modules/out-of-project (unless includeDeps),
   |                                            apply category gating, count warnings
   '-- formatHuman()                            formatDiagnostics -> stderr string
        |
        v
CoreResult { success, errorCount, warningCount, diagnostics, formatted }
        |
        v
exit-code mapping: errors>0 OR warningCount>maxWarnings -> success:false
        |
        v
{ success } back to Nx (cache keyed by @nx/js-style inputs; outputs:[])
```

### Deferred-surface flows (same core, different edges)

```
createNodesV2:  glob project files -> infer { targets: { typecheck: { executor: 'angular-typechecker:angular-typecheck', options } } }
                (no diagnostics here; just wires the target you own)
CLI bin:        argv -> resolve cwd tsconfig -> runTypecheck -> process.exit(code)
ng builder:     createBuilder((opts, ctx) => runTypecheck(...).then(r => ({ success: r.success })))
```

---

## Build / Publish boundary

| Concern | Decision | Tag |
|---------|----------|-----|
| **What compiles** | `tsconfig.lib.json` includes `src/**/*.ts`, excludes `**/*.test.ts`, `**/*.spec.ts`, `**/__snapshots__/**`. Built with `@nx/js:tsc` (declaration:true) to plain CJS `.js` + `.d.ts`. | [confirms] (PROJECT.md: shipped as pre-compiled `.js`) |
| **What ships** (`package.json` `files`) | `src` (compiled output), `executors.json`, `README.md`, `LICENSE`. NOT `fixtures/`, `testing/`, `e2e/`, `*.test.ts`, vitest configs. | [adds] (mirrors nx-verdaccio `files: [docs, src, executors.json, README.md]`) |
| **Manifest fields** | `"type": "commonjs"`, `"main": "./src/index.js"`, `"typings": "./src/index.d.ts"`, `"executors": "./executors.json"`. | [confirms] |
| **Dependencies** | `@angular/compiler-cli`, `typescript`, `nx`/`@nx/devkit` as **peerDependencies**; `tslib` as the only runtime dep if `importHelpers` is on. | [confirms PROJECT.md] |
| **executors.json output** | `project.json` build target copies `executors.json` and any non-`.ts` assets into the dist root so the published path `./src/executors/angular-typecheck/executor` resolves. | [adds] (verbatim nx-verdaccio build assets config) |
| **Release** | `nx release` (semantic-version + publish). Manual `project.json` target wiring documented in README (no config generator in v0.0.1). | [confirms] |

**Critical publish detail:** `executors.json` references implementations by extensionless path (`./src/executors/angular-typecheck/executor`). After `@nx/js:tsc` build the dist layout must preserve `src/executors/...`, so the build target's `main` is `src/index.ts` with `outputPath` flattening to dist root -- exactly nx-verdaccio's config. Get this wrong and `nx run` fails to load the executor at install time (caught by the e2e tarball test, not by unit tests).

---

## Suggested build order for v0.0.1 phases

Ordered to surface the riskiest unknown first (the compiler engine) and to keep the package installable end-to-end as early as possible (Vertical MVP).

1. **Spike + Core engine skeleton** -- `compiler-loader.ts`, `diagnostic-modes.ts`, `gather-diagnostics.ts`, `resolve-tsconfig.ts`, `runTypecheck` against a couple of int fixtures. This is the gated spike PROJECT.md flags; everything else is cheap once this is right. Build order: core has zero dependents, must exist first.
2. **Filtering + reporting** -- deps boundary, `--max-warnings` counting, category gating, `formatDiagnostics` default output. Completes `CoreResult`.
3. **Test infrastructure** -- `testing/test-nx-utils` (FsTree quarantine), `testing/test-fixtures` (load + error-injection), the committed `fixtures/` catalog, vitest unit/int configs. Pulled this early because phases 4+ assert against it; the catalog (v13->v22 codes) is itself a deliverable.
4. **Nx executor adapter** -- `schema.json` + `schema.d.ts`, `normalize-options.ts`, `executor.ts`, `executors.json`. First user-runnable surface. Depends on core (1-2) and test utils (3).
5. **Build/publish wiring + one e2e smoke** -- `project.json` build target, `package.json` `files`/peerDeps, `nx release` config, the representative app/lib/buildable/publishable/spec workspace, ONE smoke e2e. Proves the package installs and runs.
6. **Full e2e matrix + CI** -- tarball install matrix across the five project types; GitHub Actions Node 22/24/26 x Linux/Windows/macOS. Late, slow, gating.

**Architecture implications for phasing:**
- The core-vs-adapter split means phases 1-3 produce a fully testable engine **before** any Nx code exists -- de-risks the spike independently of Nx wiring.
- `src/plugin/`, `src/cli/`, `src/builders/` folders are reserved (empty) in v0.0.1 so the next milestone's createNodesV2/CLI/builder land without restructuring `src/`.
- The "only create dynamic targets using executors you own" Nx migration rule (extending-nx docs) confirms the **executor-first, createNodesV2-later** order: the inferred target the future plugin creates must point at an executor that already exists and is published.

---

## Anti-Patterns

### Anti-Pattern 1: Diagnostic logic in the executor

**What people do:** Put tsconfig resolution, the gatherer, and formatting directly in `executor.ts` (the obvious path when there's only one surface).
**Why it's wrong:** When the CLI / createNodesV2 / builder arrive (all four are explicit PROJECT.md deferrals), the logic must be copy-pasted or hastily extracted under deadline. Tests become Nx-coupled (need `ExecutorContext`) when they should be plain function tests.
**Do this instead:** `executor.ts` is <50 lines and calls `runTypecheck`. All four reference codebases follow this (angular/build builders are `execute` wrappers; nx-verdaccio executors call `internal/` functions).

### Anti-Pattern 2: Statically importing compiler-cli / typescript in core

**What people do:** `import { performCompilation } from '@angular/compiler-cli'` at the top of a core file.
**Why it's wrong:** compiler-cli is ESM-only; the CJS executor that Nx `require()`s cannot statically import it -- the build or load fails. It also forces the heavy module to load even when not needed.
**Do this instead:** `await import()` behind `loadCompilerCli()`, memoized (Pattern 2 -- verbatim `@angular/build` shape).

### Anti-Pattern 3: Spreading the nx-internal `FsTree` import across tests

**What people do:** Import `FsTree` / `flushChanges` from `nx/src/generators/tree` wherever a test needs a tree.
**Why it's wrong:** It's an unstable internal API (no public alternative; confirmed exported on Nx 23.0.1 but unguaranteed). Scattered imports mean an Nx bump breaks many files.
**Do this instead:** One quarantine file in `testing/test-nx-utils` with `eslint-disable`, re-exported as `createFsTree`/`flushFsTreeChanges`. PROJECT.md already commits to this; the architecture just gives it a home.

### Anti-Pattern 4: Shipping tests/fixtures or omitting the asset-copy step

**What people do:** Rely on `.npmignore` defaults, or forget to copy `executors.json` into dist.
**Why it's wrong:** Tests/fixtures bloat the tarball; a missing `executors.json` in dist makes the installed plugin unusable (the executor path won't resolve).
**Do this instead:** Explicit `files` allowlist in `package.json` + explicit asset-copy in the build target (both verbatim from nx-verdaccio). Verified by the e2e tarball test, not unit tests.

---

## Integration Points

### External (resolved from consumer workspace -- peerDeps)

| Dependency | Integration pattern | Notes |
|------------|---------------------|-------|
| `@angular/compiler-cli` | `await import()` in `compiler-loader.ts` | ESM-only; consumer's installed v22.x; `readConfiguration`, `formatDiagnostics`, `OptimizeFor`, `getDiagnosticsForFile`. |
| `typescript` | `await import()` in `compiler-loader.ts` | TS 6.0.x; lazy-loaded only when diagnostics run (matches `@angular/build` comment "avoid loading typescript until needed"). |
| `@nx/devkit` / `nx` | static `require()` (CJS) in adapters only | `ExecutorContext`, `logger`, later `createNodesV2`, `createNodesFromFiles`. Never imported by core. |

### Internal boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| adapter <-> core | one function call: `runTypecheck(CoreOptions): Promise<CoreResult>` | The single seam. Enforce with ESLint `no-restricted-imports` (core may not import `@nx/devkit`/`yargs`/architect). |
| core <-> ESM compiler | `loadCompilerCli()` / `loadTypescript()` (memoized dynamic import) | The CJS->ESM bridge; the only place dynamic import appears. |
| library <-> test-utils | `import from '@<scope>/test-nx-utils'` (workspace project) | FsTree quarantine; not published. |
| build <-> publish | `tsconfig.lib.json` (compile set) + `package.json files` (ship set) | Two independent allowlists; both exclude tests/fixtures. |

---

## Sources

- push-based/nx-verdaccio (local clone `D:/projects/github/push-based/nx-verdaccio`) -- multi-project layout, `src/internal/` shared layer, `src/plugin/nx-verdaccio.plugin.ts` createNodesV2, colocated `*.unit.test.ts`/`*.int.test.ts`, `testing/test-nx-utils` FsTree `materializeTree`, `project.json` build asset-copy, `package.json` `files`/peerDeps/`executors` manifest. HIGH (live, current Nx 22.3 plugin).
- angular/angular-cli `@angular/build` (local clone `D:/projects/github/angular/angular-cli/packages/angular/build`) -- `AngularCompilation` abstract base with `DiagnosticModes` bitflags + `diagnoseFiles(modes=All)`/`collectDiagnostics`, `loadCompilerCli`/`loadTypescript` memoized `await import()`, `loadConfiguration` Angular overrides, `aot-compilation.ts` unconditional per-file `getDiagnosticsForFile(sf, OptimizeFor.WholeProgram)`, builders-as-thin-`execute`-wrappers. HIGH (the exact engine PROJECT.md models).
- analogjs/analog `packages/nx-plugin` + `packages/vite-plugin-angular` (local clone) -- `src/executors/<name>/{compat,schema.d,schema.json,*.impl}.ts` convention, `src/lib/compiler/` core-vs-plugin split. HIGH.
- Nx extending-nx docs (createNodes compatibility, project-graph-plugins, local-executors, organization-specific-plugin) via WebSearch 2026-06-27 -- export both `createNodes`+`createNodesV2` from one impl for Nx 21+; "only create dynamic targets using executors you own"; one entry point per inferred feature (whole plugin compiles at runtime). MEDIUM (search synthesis; cross-checked against the live nx-verdaccio plugin which embodies the same rules).

---
*Architecture research for: Nx plugin wrapping a shared Angular type-check core*
*Researched: 2026-06-27*
