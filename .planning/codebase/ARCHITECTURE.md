<!-- refreshed: 2026-07-09 -->
# Architecture

**Analysis Date:** 2026-07-09

## System Overview

```text
+---------------------------------------------------------------+
|                      Nx CLI (require()-based loader)          |
|         nx run <project>:typecheck  |  nx g <plugin>:<gen>    |
+---------------------------+-----------------------------------+
                            |
              executors.json / generators.json (by path)
                            |
                            v
+---------------------------------------------------------------+
|   ADAPTER TIER (the ONLY tier that touches @nx/devkit)        |
|   executor.ts + normalize-options.ts + generators/*           |
|   `packages/angular-typechecker/src/executors/`               |
|   `packages/angular-typechecker/src/generators/`              |
+---------------------------+-----------------------------------+
                            |  CoreOptions (absolute tsConfigPath)
                            v
+---------------------------------------------------------------+
|   CORE ENGINE TIER (pure; no console / process / devkit)      |
|   run-typecheck.ts -> gather-diagnostics.ts                   |
|                    -> walk-references.ts                      |
|                    -> filter-diagnostics.ts                   |
|                    -> finalize / evaluate-result.ts           |
|   `packages/angular-typechecker/src/core/`                    |
+----------+----------------------------+-----------------------+
           |                            |
   await import()                await import()
           v                            v
+----------------------+     +----------------------------------+
| @angular/compiler-cli|     | typescript (peer)                |
| (ESM peer)           |     | compiler-loader / load-typescript|
| performCompilation   |     | (memoized CJS->ESM bridge)       |
+----------------------+     +----------------------------------+
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Executor adapter | Nx `{ success }` boundary; composes core + renders advisory `logger` notices; writes raw stdout | `packages/angular-typechecker/src/executors/typecheck/executor.ts` |
| Options normalizer | Pure map from Nx options + `ExecutorContext` to `CoreOptions`; resolves absolute `tsConfigPath` | `packages/angular-typechecker/src/executors/typecheck/normalize-options.ts` |
| Engine entry | Orchestrates parse -> compile/walk -> finalize; owns infra-vs-type policy | `packages/angular-typechecker/src/core/run-typecheck.ts` |
| Compiler-cli loader | Memoized `await import('@angular/compiler-cli')` (the single value-import) | `packages/angular-typechecker/src/core/compiler-loader.ts` |
| TypeScript loader | Memoized `await import('typescript')` (core-private) | `packages/angular-typechecker/src/core/load-typescript.ts` |
| Diagnostic gatherer | `performCompilation` + unconditional all-getter (Approach A / HYBRID) | `packages/angular-typechecker/src/core/gather-diagnostics.ts` |
| Reference walker | Solution-tsconfig single-level `references[]` walk (Storybook Layout B) | `packages/angular-typechecker/src/core/walk-references.ts` |
| Project-boundary filter | Dual-identity input-set-membership keep/suppress classification | `packages/angular-typechecker/src/core/filter-diagnostics.ts` |
| Verdict evaluator | Pure pass/fail + discriminated `Outcome` (type-error / coverage-incomplete / warnings-exceeded / clean) | `packages/angular-typechecker/src/core/evaluate-result.ts` |
| Report renderer | CJS->ESM load seam then `formatDiagnostics` | `packages/angular-typechecker/src/core/render-report.ts` |
| Report formatter | Deterministic codeframe rendering, ANSI strip, fail-fast truncation | `packages/angular-typechecker/src/core/format-report.ts` |
| compiler-cli type shim | Self-contained structural surface for the ESM compiler API under nodenext | `packages/angular-typechecker/src/core/compiler-cli-types.ts` |
| Diagnostic code space | NG encoding helpers + synthesized 90001/90002 + fileless-error factory | `packages/angular-typechecker/src/core/diagnostic-codes.ts` |
| Public API barrel | Exposes only `runTypecheck`, `TypecheckInfrastructureError`, `CoreOptions`, `CoreResult`, `SkippedReference` | `packages/angular-typechecker/src/index.ts` |

## Pattern Overview

**Overall:** Pure functional core with a thin framework adapter shell ("functional core, imperative shell"). A single Nx executor is the primary consumer; a programmatic `runTypecheck` API is the secondary surface.

**Key Characteristics:**
- Strict tier separation: `core/**` is PURE (no `console`, no `process`, no `@nx/devkit`); only the executor/generators touch `@nx/devkit` `logger` and `process.stdout`. Enforced by ESLint scoped to `**/src/core/**`.
- CommonJS package that reaches the ESM-only `@angular/compiler-cli` and `typescript` via memoized `await import()`; compiled under `module: nodenext` so the dynamic import survives emit as a native load (never downleveled to `require()`).
- Detection-vs-rendering split: core only COUNTS and RECORDS structured advisory fields on `CoreResult`; the adapter is the sole tier that renders `logger.warn`/`logger.info` notices.
- Single source of truth for every shared computation: one `runNoEmitCompilation` (direct leaf + walk cannot diverge), one `finalize`, one `EMIT_NEUTRALIZING_OPTIONS`, one verdict in `evaluateResult`.
- Fail-safe / over-report bias: a type-checker that lies is worse than none; unknowns are kept, never silently dropped.

## Layers

**Adapter (Nx-facing):**
- Purpose: translate Nx executor/generator invocations to/from the pure core.
- Location: `packages/angular-typechecker/src/executors/`, `packages/angular-typechecker/src/generators/`
- Contains: `executor.ts`, `normalize-options.ts`, `schema.json`/`schema.d.ts`, generator factories.
- Depends on: `@nx/devkit`, the core tier.
- Used by: the Nx CLI (by path, via `executors.json` / `generators.json`).

**Core engine (pure):**
- Purpose: run the complete Angular whole-program type-check and produce a structured `CoreResult` + verdict.
- Location: `packages/angular-typechecker/src/core/`
- Contains: engine orchestration, gatherer, walker, filter, formatter, verdict, code space, loaders, type shim.
- Depends on: `@angular/compiler-cli` (peer, dynamic import), `typescript` (peer, dynamic import), `node:path`.
- Used by: the executor adapter and the public barrel.

**Public API (barrel):**
- Purpose: minimal "run the type-check from code" surface.
- Location: `packages/angular-typechecker/src/index.ts`
- Contains: `runTypecheck`, `TypecheckInfrastructureError`, and the `CoreOptions`/`CoreResult`/`SkippedReference` types ONLY. Engine internals are intentionally NOT exported.

## Data Flow

### Primary Request Path (nx run <project>:typecheck)

1. Nx `require()`s the compiled executor via `executors.json` `implementation` path (`packages/angular-typechecker/executors.json`).
2. `typecheckExecutor(options, context)` calls `normalizeOptions` -> absolute `tsConfigPath`, split verdict/reporter knobs (`executor.ts:44`, `normalize-options.ts:44`).
3. `runTypecheck(coreOptions)` loads the compiler-cli + typescript, `readConfiguration`, and scans config errors for infra (500) failures (`run-typecheck.ts:260`).
4. Branch on `parsed.rootNames.length === 0`: solution/references -> `handleSolutionWalk`; empty project -> synthesized 90001 guard; else the direct single-leaf path (`run-typecheck.ts:324`).
5. `runNoEmitCompilation(ng, parsed)` -> `performCompilation` with `EMIT_NEUTRALIZING_OPTIONS` + the unconditional all-getter `gatherAllDiagnostics` (`gather-diagnostics.ts:114`).
6. `throwIfInfrastructureFailure` re-throws a returned `UNKNOWN_ERROR_CODE` (500) as `TypecheckInfrastructureError` (`run-typecheck.ts:169`).
7. `finalize` runs `filterDiagnostics` (project-boundary), `ts.sortAndDeduplicateDiagnostics`, explicit category counts, and pure advisory detectors (`run-typecheck.ts:626`).
8. Adapter fires the five `warn*(result)` advisory notices, then `renderReport` -> `process.stdout.write(report)` (`executor.ts:53`, `render-report.ts:43`).
9. `evaluateResult(result, { maxWarnings, strict })` computes the verdict; adapter returns `{ success }` (`evaluate-result.ts:116`).

### Solution-tsconfig reference walk (Storybook Layout B)

1. `handleSolutionWalk` calls `walkReferences(ng, ts, parsed, tsConfigPath)` (`run-typecheck.ts:441`).
2. Walk resolves each DIRECT `references[]` entry, canonicalizes, skips self/duplicate/out-of-project, and classifies not-found -> synthesized 90002 (`walk-references.ts:108`).
3. Each surviving leaf runs the SAME `runNoEmitCompilation`; the RAW per-leaf diagnostics are UNIONed (never filtered/deduped in the walk) (`walk-references.ts:261`).
4. The union + the leaves' declared `rootNames` (the input set) feed the single `finalize`; skipped references and uncheckable files are attached advisorily (`run-typecheck.ts:469`).

**State Management:**
- Module-level memoization only: `compiler-loader.ts` caches the resolved compiler-cli namespace; `load-typescript.ts` caches the typescript namespace. No other mutable global state. Each run parses config into a FRESH options object so a second `performCompilation` never shares mutated `noEmit` state.

## Key Abstractions

**CoreResult:**
- Purpose: the structured, PURE output of a run (diagnostics, explicit error/warning counts, split suppressed counters, and presence-gated advisory fields).
- Examples: `packages/angular-typechecker/src/core/run-typecheck.ts:42`
- Pattern: advisory ARRAY fields are PRESENT only when non-empty (`presentIfNonEmpty` maps `[]` -> omitted key -> `undefined`), so consumers branch on presence.

**Approach A / HYBRID all-getter:**
- Purpose: gather EVERY diagnostic phase unconditionally (no ngc `&&`-chain short-circuit) so template + extended NG8xxx diagnostics surface even alongside a TS error.
- Examples: `packages/angular-typechecker/src/core/gather-diagnostics.ts:129`
- Pattern: residual whole-program `getNgSemanticDiagnostics()` PLUS a per-file `getNgSemanticDiagnostics(fileName)` loop (fault isolation) PLUS `getGlobalDiagnostics()`.

**Dual-identity input-set membership filter:**
- Purpose: decide keep/suppress by compiler input-set membership (declared rootNames), not directory-containment proxy; recover symlinked/junctioned roots.
- Examples: `packages/angular-typechecker/src/core/filter-diagnostics.ts:218`
- Pattern: each declared rootName stored under raw + full-canonical forms; a diagnostic keeps if either form hits either stored form.

**Synthesized diagnostic-code space (90000+):**
- Purpose: represent conditions the compiler never emits (references-only/empty config -> 90001; not-found leaf -> 90002) as fileless, counted Errors.
- Examples: `packages/angular-typechecker/src/core/diagnostic-codes.ts:99`
- Pattern: fileless Errors (the filter always keeps fileless diagnostics), chosen outside the TS/NG/500 code ranges.

## Entry Points

**Nx `typecheck` executor:**
- Location: `packages/angular-typechecker/src/executors/typecheck/executor.ts` (referenced by `packages/angular-typechecker/executors.json`)
- Triggers: `nx run <project>:typecheck` (or the workspace target default keyed `angular-typechecker:typecheck`).
- Responsibilities: normalize options, run the core, render advisory notices + report, map to `{ success }`.

**Nx generators (`configuration`, `init`):**
- Location: `packages/angular-typechecker/src/generators/configuration/generator.ts`, `packages/angular-typechecker/src/generators/init/generator.ts` (via `packages/angular-typechecker/generators.json`)
- Triggers: `nx g angular-typechecker:configuration <project>`, `nx add angular-typechecker` (runs `init`).
- Responsibilities: seed `nx.json` targetDefaults for caching (`init`); wire a `typecheck` target with a resolved `tsConfig` (`configuration`).

**Programmatic API:**
- Location: `packages/angular-typechecker/src/index.ts`
- Triggers: `import { runTypecheck } from 'angular-typechecker'`.
- Responsibilities: run the core type-check from code; caller catches `TypecheckInfrastructureError`.

## Architectural Constraints

- **Threading:** single-threaded; a synchronous `performCompilation` wrapped in an async engine (the async is only the dynamic ESM imports). No worker threads.
- **Module format:** CommonJS executor (`"type": "commonjs"`, Nx loads via `require()`) bridging to ESM peers via `await import()`. Compiled under `module: nodenext` / `moduleResolution: nodenext` (`packages/angular-typechecker/tsconfig.json`). `module: commonjs` would downlevel `import()` to `require()` and break at runtime -- this is the "GATE A" constraint.
- **Global state:** two module-level memo caches only (`compiler-loader.ts`, `load-typescript.ts`); both hold immutable resolved namespaces.
- **Purity boundary:** `core/**` must never import `@nx/devkit`, use `console`, or call `process` (ESLint-enforced). `load-typescript.ts` must never be barrel-exported.
- **Circular imports:** none. `walk-references.ts` stays free of the `run-typecheck.ts` import cycle by re-throwing infra failures in the caller; `exit-codes.ts` must not import `run-typecheck.ts` beyond types.
- **Peer versions:** `@angular/compiler-cli` and `typescript` are consumer-provided peers; the vendored type shim (`compiler-cli-types.ts`) pins the structural surface at Angular 22.0.4 / TS 6.0.3.

## Anti-Patterns

### Silently dropping a diagnostic or swallowing an error

**What happens:** returning `{ success: true }` (or a "clean" count) when a compiler crash, a fileless config error, or an out-of-project first-party diagnostic was lost.
**Why it's wrong:** a type-checker that lies is worse than none; this is the project's core charter violation.
**Do this instead:** re-throw non-`TypecheckInfrastructureError` errors (`executor.ts:84`); prepend `parsed.errors`; keep fileless diagnostics unconditionally; count in-graph suppressions toward a `coverage-incomplete` verdict (`filter-diagnostics.ts`, `evaluate-result.ts`).

### Counting warnings as `length - errorCount`

**What happens:** deriving one category count by subtracting another.
**Why it's wrong:** Suggestion/Message categories exist too, so subtraction miscounts (the MD-02 bug).
**Do this instead:** count each `ts.DiagnosticCategory` EXPLICITLY on the post-filter sorted set (`run-typecheck.ts:663`).

### Detecting infra failures or NG codes by message/source text

**What happens:** matching `source === 'angular'` or English message substrings to classify a diagnostic.
**Why it's wrong:** locale-fragile and source is unset on synthesized diagnostics.
**Do this instead:** detect BY CODE only (`UNKNOWN_ERROR_CODE`, `NG(3004)`, 90001/90002). The one deliberate exception is `detectBundlerQueryImports` (verdict-neutral, degrades to `[]` under non-English) (`detect-bundler-query-imports.ts:36`).

### Duplicating the compile invocation or the verdict

**What happens:** the walk path and direct path building their own `performCompilation` options, or a second exit-code path re-deriving the verdict from raw counts.
**Why it's wrong:** the same project could yield different verdicts via a leaf vs its solution.
**Do this instead:** route both through the single `runNoEmitCompilation` + single `finalize`; keep the verdict solely in `evaluateResult` (`exit-codes.ts` deliberately stays verdict-free).

## Error Handling

**Strategy:** three-way classification -- infrastructure failure vs genuine type error vs advisory signal. Infra failures never count as type errors and never pass silently.

**Patterns:**
- `TypecheckInfrastructureError` (`run-typecheck.ts:154`) is thrown for a returned `UNKNOWN_ERROR_CODE` (500) at THREE stages (config parse, walk union, post-compile) and for a `{ program: undefined }` return. The executor maps it to `logger.error` + `{ success: false }`; every other throw is re-thrown.
- Exit-code policy (deferred CLI) lives in `exit-codes.ts`: `2` = infra, `1` = type errors, `0` = clean (ngc parity).
- Config-parse errors (`parsed.errors`) are never dropped -- prepended and counted.
- Fatal template-compilation aborts (NG3004) are detected on the PRE-filter set and surfaced as a loud advisory + `coverage-incomplete` verdict, never a reclassification.

## Cross-Cutting Concerns

**Logging:** ONLY the executor adapter logs (via `@nx/devkit` `logger`); the report goes to RAW `process.stdout` (never `logger.info`, which would corrupt codeframes / GitHub problem-matcher parsing). Core is silent.
**Validation:** `schema.json` (`additionalProperties: false`) validates executor options; `normalize-options.ts` resolves paths; `evaluateResult` defensively treats negative/NaN `maxWarnings` as unset.
**Determinism:** `ts.sortAndDeduplicateDiagnostics` runs unconditionally in `finalize`; the format host forces `getNewLine: () => '\n'` and absolute-or-`pathBase`-relative paths so output is byte-identical cross-OS and across the Nx daemon vs a cold run.
**Caching:** the `typecheck` target is Nx-cacheable with explicit `inputs` (incl. `externalDependencies: [typescript, @angular/compiler-cli]`); the `init` generator seeds these targetDefaults; the `default` (not `production`) named input is load-bearing so a spec-only edit busts the cache.

---

*Architecture analysis: 2026-07-09*
