<!-- refreshed: 2026-06-30 -->

# Architecture

**Analysis Date:** 2026-06-30

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                          Nx CLI  (`nx run <project>:angular-typecheck`)   │
│   resolves the executor via the published `executors.json` and require()s │
│   the compiled CommonJS `executor.js`                                     │
└───────────────────────────────┬───────────────────────────────────────────┘
                                 │ require() (CJS)
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  ADAPTER (the only @nx/devkit-aware tier)                                 │
│  `src/executors/angular-typecheck/executor.ts`  (default async fn)        │
│  `src/executors/angular-typecheck/normalize-options.ts`                   │
│   options + ExecutorContext -> NormalizedOptions; owns stdout + verdict   │
└───────┬──────────────────────────────┬──────────────────────┬──────────────┘
        │ coreOptions                  │ result (raw stdout)   │ {errors,warnings}
        ▼                              ▼                       ▼
┌──────────────────────┐  ┌────────────────────────┐  ┌────────────────────┐
│  CORE ENGINE         │  │  REPORTING             │  │  VERDICT / POLICY  │
│  `core/run-typecheck`│  │  `core/render-report`  │  │ `core/evaluate-    │
│  `core/gather-       │  │  `core/format-report`  │  │   result` ({success})│
│   diagnostics`       │  │  (ANSI strip, codeframe│  │ `core/exit-codes`  │
│  `core/filter-       │  │   path relativization) │  │  (toExitCode 0/1/2)│
│   diagnostics`       │  └───────────┬────────────┘  └────────────────────┘
│  `core/compiler-     │              │
│   loader` (CJS->ESM) │              │
└──────────┬───────────┘              │
           │ await import()           │ await import()
           ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  ESM PEER COMPILER  `@angular/compiler-cli@^22`  +  `typescript@>=6 <6.1` │
│  performCompilation(...) + Program diagnostic getters + formatDiagnostics │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component               | Responsibility                                                                                                                         | File                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Executor adapter        | Compose core -> stdout -> verdict; map infra error; emit RES-02 abort notice                                                           | `packages/angular-typechecker/src/executors/angular-typecheck/executor.ts`          |
| Options normalizer      | Pure map of Nx options + `ExecutorContext` to `CoreOptions` + reporter knobs; resolve absolute `tsConfigPath`; derive `color` from TTY | `packages/angular-typechecker/src/executors/angular-typecheck/normalize-options.ts` |
| Core engine             | Parse config once, run `performCompilation` (emit-neutralized), filter + sort + dedup, count by category, detect TCB abort             | `packages/angular-typechecker/src/core/run-typecheck.ts`                            |
| Diagnostic gatherer     | Unconditional all-getter (HYBRID: whole-program + per-file isolation) injected into `performCompilation`                               | `packages/angular-typechecker/src/core/gather-diagnostics.ts`                       |
| Project-boundary filter | Partition diagnostics into in-project vs suppressed (out-of-project + node_modules)                                                    | `packages/angular-typechecker/src/core/filter-diagnostics.ts`                       |
| Compiler loader         | Memoized CJS->ESM `await import('@angular/compiler-cli')`                                                                              | `packages/angular-typechecker/src/core/compiler-loader.ts`                          |
| Render seam             | Load `ng`/`ts`, delegate to `formatReport`                                                                                             | `packages/angular-typechecker/src/core/render-report.ts`                            |
| Formatter               | `formatDiagnostics` -> string; ANSI strip; deterministic format host; fail-fast truncation                                             | `packages/angular-typechecker/src/core/format-report.ts`                            |
| Verdict                 | Pure `{ success }` from `errorCount`/`warningCount` + `maxWarnings` gate                                                               | `packages/angular-typechecker/src/core/evaluate-result.ts`                          |
| Exit-code policy        | Pure `toExitCode` 0/1/2 (ngc parity); for future CLI/builder                                                                           | `packages/angular-typechecker/src/core/exit-codes.ts`                               |
| Diagnostic-code helpers | NG negative encoding (`NG()`/`ngCodeOf`); TCB-fatal code constant                                                                      | `packages/angular-typechecker/src/core/diagnostic-codes.ts`                         |
| Type shim               | Self-contained structural surface of `@angular/compiler-cli` consumed by core                                                          | `packages/angular-typechecker/src/core/compiler-cli-types.ts`                       |
| Public barrel           | Re-exports core engine + reporting + verdict for the future CLI/builder                                                                | `packages/angular-typechecker/src/index.ts`                                         |

## Pattern Overview

**Overall:** Ports-and-adapters (hexagonal). A framework-agnostic `core/` engine
is wrapped by a thin Nx executor adapter; the only `@nx/devkit`-aware files are
`executor.ts` and `normalize-options.ts`. The core is reusable by deferred
adapters (a standalone CLI, an Angular CLI builder).

**Key Characteristics:**

- **CommonJS shell, ESM peer.** The shipped executor is CommonJS (`require()`d by Nx across Nx 21/22/23); it reaches the ESM-only `@angular/compiler-cli` via a literal `await import()` that survives `@nx/js:tsc` emit because the lib is compiled under `module: nodenext` (`tsconfig.json`).
- **Pure core.** `src/core/**` performs NO `process` / `console` side effects (enforced by ESLint). All side effects (stdout, exit, logging, TTY detection) live in the adapter. `ng`/`ts` are injected into `formatReport` so it is unit-testable without a compiler mock.
- **Unconditional all-getter gather (the differentiator).** Unlike `ngc`'s phase short-circuit, the gatherer calls every diagnostic getter unconditionally so Angular template + extended (NG8xxx) diagnostics surface even when a co-located TypeScript error exists.
- **Single config parse, fresh options per call.** Config is parsed once via `readConfiguration` and spread into a fresh emit-neutralizing `options` object so a second `performCompilation` never inherits a mutated `noEmit`.
- **Deterministic output.** A custom format host forces `getNewLine: () => '\n'`, non-identity case-fold, and absolute (or `pathBase`-relative) paths; `ts.sortAndDeduplicateDiagnostics` runs on every path so the report is byte-stable cross-OS and cache-idempotent.

## Layers

**Adapter (Nx executor) layer:**

- Purpose: Bridge Nx's `(options, context) => { success }` contract to the pure core; own all side effects (stdout, logger, TTY).
- Location: `packages/angular-typechecker/src/executors/angular-typecheck/`
- Contains: `executor.ts` (default async fn), `normalize-options.ts`, `schema.json` + `schema.d.ts`.
- Depends on: `@nx/devkit` (`ExecutorContext`, `logger`, `joinPathFragments`); the core engine + reporting + verdict.
- Used by: the Nx CLI (`require()` via `executors.json`).

**Core engine layer:**

- Purpose: Run the complete whole-program Angular type-check for one tsconfig with no emit; return a structured `CoreResult`.
- Location: `packages/angular-typechecker/src/core/run-typecheck.ts`, `gather-diagnostics.ts`, `filter-diagnostics.ts`, `compiler-loader.ts`.
- Contains: config resolution, the emit-neutralizing override, the all-getter gatherer, the project-boundary filter, sort/dedup/count, infra-vs-type classification, TCB-abort detection.
- Depends on: the ESM peers (`@angular/compiler-cli`, `typescript`) via `await import()`; `compiler-cli-types.ts` for types only.
- Used by: the adapter and the public barrel.

**Reporting layer:**

- Purpose: Turn `CoreResult.diagnostics` into a human/CI string (NG codes, template codeframes), deterministically.
- Location: `packages/angular-typechecker/src/core/render-report.ts` (seam) + `format-report.ts` (pure formatter).
- Depends on: injected `ng.formatDiagnostics` + `typescript`.
- Used by: the adapter (`renderReport`).

**Verdict / policy layer:**

- Purpose: The single source of truth for pass/fail and exit code; pure, no side effects.
- Location: `packages/angular-typechecker/src/core/evaluate-result.ts` (`{ success }`) + `exit-codes.ts` (`toExitCode`).
- Depends on: only `CoreResult` shape + `TypecheckInfrastructureError`.
- Used by: the adapter now (`evaluateResult`); the deferred CLI/builder (`toExitCode`).

## Data Flow

### Primary Request Path

1. Nx resolves `angular-typecheck` from `executors.json` and `require()`s the compiled `executor.js` (`packages/angular-typechecker/executors.json:3`).
2. `angularTypecheckExecutor(options, context)` runs (`executor.ts:37`).
3. `normalizeOptions(options, context)` resolves an absolute `tsConfigPath`, splits reporter knobs, derives `color` from `process.stdout.isTTY` (`normalize-options.ts:41`).
4. `runTypecheck(coreOptions)` loads `@angular/compiler-cli` + `typescript`, parses the config once, and runs `performCompilation` with `gatherDiagnostics: gatherAllDiagnostics` (`run-typecheck.ts:123`, gatherer injected at `run-typecheck.ts:238`).
5. `gatherAllDiagnostics(program)` calls every Program getter unconditionally, then the per-file Angular semantic loop, then global TS diagnostics (`gather-diagnostics.ts:57`).
6. `finalize` filters out-of-project/node_modules diagnostics, sorts + dedups, counts Error/Warning by category, and detects a TCB-generation Fatal (`run-typecheck.ts:394`).
7. If a TCB abort is flagged, the adapter emits a loud `logger.warn` BEFORE the report (`executor.ts:52`).
8. `renderReport(result, ...)` loads `ng`/`ts` and delegates to `formatReport` (`render-report.ts:61`), which renders codeframes and strips ANSI when `color` is false (`format-report.ts:57`).
9. The adapter writes the report to RAW `process.stdout` (NOT `logger.info`, to keep byte-deterministic codeframes) (`executor.ts:73`).
10. `evaluateResult(result, { maxWarnings })` returns `{ success }` to Nx (`executor.ts:75`, `evaluate-result.ts:40`).

### Infrastructure-failure path

1. A config-resolution crash or internal compiler crash surfaces as a `UNKNOWN_ERROR_CODE` (500) diagnostic; the engine detects it by CODE only and throws `TypecheckInfrastructureError` (`run-typecheck.ts:167`, `run-typecheck.ts:244`).
2. The adapter catches `TypecheckInfrastructureError`, logs a distinct `logger.error`, and returns `{ success: false }` (`executor.ts:77`). Any OTHER error is re-thrown (a type-checker must never swallow an unknown failure).
3. The deferred CLI/builder maps the same classes to exit codes via `toExitCode` (2 = infra, 1 = type errors, 0 = clean) (`exit-codes.ts:34`).

### Zero-rootNames guard path

1. A solution-style / references-only / empty tsconfig yields `parsed.rootNames.length === 0`.
2. The engine skips `performCompilation` and returns one synthesized Error diagnostic so agents/CI get a deterministic non-zero signal instead of a false PASS (`run-typecheck.ts:190`, `run-typecheck.ts:329`).

**State Management:**

- Module-level memo caches in `compiler-loader.ts` (the `@angular/compiler-cli` namespace) and a duplicated `cachedTypescript` memo in `run-typecheck.ts` and `render-report.ts`. These are process-lifetime caches of resolved ESM modules; no other mutable shared state exists.

## Key Abstractions

**`CoreOptions` / `CoreResult`:**

- Purpose: The framework-agnostic engine contract. `CoreOptions` = `tsConfigPath` + `includeDeps` + `pathBase`. `CoreResult` = filtered/sorted diagnostics + explicit `errorCount`/`warningCount` + `suppressedCount` + `durationMs` + optional `templateCheckAborted`.
- Examples: `packages/angular-typechecker/src/core/run-typecheck.ts` (interfaces at lines 11 and 33).
- Pattern: Plain interfaces; counts are computed EXPLICITLY by `ts.DiagnosticCategory`, never `length - errorCount`.

**`gatherAllDiagnostics` (HYBRID gatherer):**

- Purpose: The injected `gatherDiagnostics` callback that defeats ngc's phase short-circuit; whole-program getters PLUS a per-file Angular-semantic loop for fault isolation.
- Examples: `packages/angular-typechecker/src/core/gather-diagnostics.ts:57`.
- Pattern: Append-only accumulation; relies on downstream `sortAndDeduplicateDiagnostics` for dedup (no manual dedup).

**`TypecheckInfrastructureError`:**

- Purpose: Distinguish "the compiler failed to RUN" from "the code has type errors". Detected by `UNKNOWN_ERROR_CODE` (500), never by message text.
- Examples: `packages/angular-typechecker/src/core/run-typecheck.ts:103`.
- Pattern: Typed error class; caught in the adapter, mapped to exit 2 in `toExitCode`.

**`CompilerCli` structural shim:**

- Purpose: A self-contained structural type surface for the `@angular/compiler-cli` members the core calls, because the package's barrel typings do not resolve under nodenext and a deep relative import breaks in a consumer install.
- Examples: `packages/angular-typechecker/src/core/compiler-cli-types.ts`.
- Pattern: Hand-declared `import type` surface sourced from `typescript`'s public types; the runtime value is the real module. A drift target (`compiler-cli-types.drift.ts` + `typecheck-drift` target) guards it.

## Entry Points

**Nx executor (the only shipped entry point):**

- Location: `packages/angular-typechecker/executors.json` -> `./src/executors/angular-typecheck/executor` (compiled `.js`).
- Triggers: `nx run <project>:angular-typecheck` (or any target keyed to the published executor id `angular-typechecker:angular-typecheck`).
- Responsibilities: normalize options, run the core, render to stdout, return `{ success }`.

**Public API barrel:**

- Location: `packages/angular-typechecker/src/index.ts` (`main`/`types` in the published `package.json`).
- Triggers: programmatic `import` by the deferred CLI/builder.
- Responsibilities: re-export the engine, reporting, verdict, and types.

## Architectural Constraints

- **Threading:** Single-threaded. The compile is synchronous inside `performCompilation`; only module loading (`await import`) and the adapter are async. No worker threads.
- **Module format:** The shipped package is CommonJS (`"type": "commonjs"`, `main: ./src/index.js`). The lib is compiled under `module: nodenext` (`packages/angular-typechecker/tsconfig.json:4`) so `await import()` is emitted as a NATIVE dynamic import, not downleveled to `require()`. `module: commonjs` would break the CJS->ESM bridge at runtime.
- **Global state:** Module-level memo caches only (`compiler-loader.ts` `cached`; `cachedTypescript` in `run-typecheck.ts` and `render-report.ts`). No singletons hold compiler results.
- **Core purity:** `src/core/**` must never call `process` or `console` (ESLint-enforced). Side effects belong to the adapter.
- **Circular imports:** None. `exit-codes.ts` deliberately does NOT import the engine's runtime (only types + the error class) to avoid a cycle; the engine never imports the exit policy.
- **Path resolution:** The core requires an ABSOLUTE `tsConfigPath` and never reads `process.cwd()`; the adapter owns resolution via `joinPathFragments(context.root, ...)`.

## Anti-Patterns

### Counting warnings as `total - errorCount`

**What happens:** Deriving `warningCount` by subtracting errors from the total diagnostic length (the historical "MD-02" bug).
**Why it's wrong:** Suggestion + Message category diagnostics inflate the total, so the warning count (and the verdict) become wrong.
**Do this instead:** Count Error and Warning EXPLICITLY by `ts.DiagnosticCategory` on the post-filter sorted set, as `finalize` does (`run-typecheck.ts:424`). Invariant: `errorCount + warningCount <= diagnostics.length`.

### Classifying diagnostics by `source`/message text

**What happens:** Detecting an infrastructure failure (or an NG code) by inspecting `diagnostic.source === 'angular'` or message strings.
**Why it's wrong:** Synthesized diagnostics set no `source`, and message text is unstable across versions/locales.
**Do this instead:** Classify by `code` only -- `UNKNOWN_ERROR_CODE` (500) for infra (`run-typecheck.ts:167`/`:244`), `NG(3004) === -993004` for the TCB-fatal (`diagnostic-codes.ts:92`).

### Writing the report via `logger.info`

**What happens:** Emitting the diagnostic report through Nx's `logger.info`.
**Why it's wrong:** Nx prepends chrome/color that corrupts byte-deterministic codeframes and breaks GitHub problem-matcher `file:line:col` parsing.
**Do this instead:** Write to RAW `process.stdout` (`executor.ts:73`); reserve `logger.error`/`logger.warn` for meta messages (infra failure, TCB-abort notice).

### Short-circuiting the gather to "fail fast"

**What happens:** Stopping diagnostic gathering at the first error (the ngc phase short-circuit) to speed up.
**Why it's wrong:** It drops Angular template/extended NG8xxx diagnostics that live behind a co-located TS error -- the exact gap this tool exists to close.
**Do this instead:** Gather every getter unconditionally (`gather-diagnostics.ts`); `failFast` is a REPORTING-only truncation applied AFTER the full gather (`format-report.ts:69`).

## Error Handling

**Strategy:** Three-way classification -- clean / type-error / infrastructure-failure -- with a fail-safe bias for a correctness tool.

**Patterns:**

- Infra failures detected by code 500 at two stages (config resolution and post-compilation) and thrown as `TypecheckInfrastructureError`; caught in the adapter and mapped to `{ success: false }` / exit 2.
- A `{ program: undefined }` return without a 500 is defensively converted to the same infra class (`run-typecheck.ts:266`).
- Any non-infra error is RE-THROWN unswallowed (`executor.ts:85`).
- A throwing `realpath` in the boundary filter fails SAFE: the diagnostic is KEPT, never silently dropped (`filter-diagnostics.ts:100`).
- A zero-rootNames config yields a synthesized Error, never a false PASS.

## Cross-Cutting Concerns

**Logging:** Only in the adapter via `@nx/devkit` `logger` (`logger.error` for infra, `logger.warn` for TCB abort). The core is logging-free.
**Validation:** Schema validation by Nx from `schema.json` (`additionalProperties: false`, `tsConfig` required). `maxWarnings` is defensively re-validated in `evaluateResult` (negative/NaN treated as unset).
**Determinism:** `formatReport`'s custom `FormatDiagnosticsHost` (`getNewLine: () => '\n'`, non-identity case-fold, absolute/`pathBase`-relative paths) plus unconditional `ts.sortAndDeduplicateDiagnostics` make output byte-stable cross-OS and cache-idempotent.
**Drift protection:** `compiler-cli-types.drift.ts` + the `typecheck-drift` `nx:run-commands` target (`project.json:45`) compile-check the structural shim against the installed compiler-cli; the gatherer's getter set is pinned by unit + runtime specs.

---

_Architecture analysis: 2026-06-30_
