# Prior-Art Research Summary -- v0.0.3 (improve the EXISTING engine)

**Date:** 2026-06-29
**Scope:** Mine prior art for learnings that make the CURRENT `runTypecheck` engine more
CORRECT, COMPLETE, ROBUST, and MAINTAINABLE. **Deferred FEATURES (incremental/`--watch`,
reporters, standalone CLI, generators, `createNodesV2` inference, Storybook, Jest) are OUT OF
SCOPE for this milestone** -- not researched here as deliverables. (The first, feature-scoped
research pass is archived under `_initial-feature-scoped/` and is superseded.)

**Method:** verified every version-sensitive claim against **stable Angular 22.0.4** (our pinned
target) by reading the `v22.0.4` tag as a tree-ish in the local clones -- NOT the `22.1.0-next.x`
the clones' working trees sit on. Clones: `@angular/compiler-cli` + `@angular/compiler`
(`D:\projects\github\angular\angular`), `@angular/build` (`D:\projects\github\angular\angular-cli`),
AnalogJS, `@nx/js` (nrwl/nx), Prettier `angular-estree-parser`.

**Detail files (engine-focused):**
`ENGINE-REFERENCE.md` (the `@angular/build` gatherer comparison -- primary),
`COMPILER-CLI-INTERNALS.md`, `CONSUMER-GATHERERS.md`, `SHIM-HARDENING.md`.

---

## Headline

**Our engine is already complete and faithful -- the work is targeted hardening, not a rewrite.**
Verified at v22.0.4: our diagnostic-family coverage is identical to `@angular/build` (non-template
+ template type-check + sourceFileValidator + templateSemantics + extended NG8xxx), we inherit NG
guide-URL enrichment and template codeframes for free, extended-diagnostic severity gating is
faithful to the consumer's `extendedDiagnostics` config, and our config-error handling is strictly
better than both `@nx/js` (throws) and AnalogJS (silent). The improvements below are a small set of
real correctness/robustness defects plus drift-hardening -- all reachable WITHOUT migrating off
`performCompilation` to `NgtscProgram` (incremental migration stays deferred).

---

## Consolidated improvements (prioritized)

| # | Improvement | Class | Output? | Effort | Source |
|---|-------------|-------|:------:|:------:|--------|
| 1 | Detect `UNKNOWN_ERROR_CODE` (500) inside `parsed.errors` (config-resolution crash), re-throw as infra | **correctness** | yes | S | COMPILER-CLI #1 |
| 2 | Add `program.getTsProgram().getGlobalDiagnostics()` -- we currently MISS global/location-less TS errors (TS2318-class) | **completeness** | yes | S | ENGINE-REF #2 |
| 3 | Per-file fault isolation: loop `getNgSemanticDiagnostics(sf.fileName)` so one `FatalDiagnosticError` doesn't abandon every later file's Angular diagnostics | **robustness + completeness** | yes (failure paths) | M | ENGINE-REF #1 |
| 4 | Wrap `options.realpath()` in try/catch in the boundary filter -- a throwing realpath currently aborts the whole pass | **robustness** | no (happy path) | S | SHIM #2 |
| 5 | Treat present-but-empty `file.fileName` as file-less (don't suppress) | **correctness** | edge | S | SHIM #4 |
| 6 | Add `suppressOutputPathCheck: true` to the no-emit options override | **robustness** | edge | S | ENGINE-REF #4 |
| 7 | Build-time DRIFT spec: dedicated `tsconfig.drift.json` (`moduleResolution: node`) CI-checked, asserting our shim `Program` is assignable from the real `api.Program` + a getter-set tripwire + an `ngErrorCode`/`UNKNOWN_ERROR_CODE` mirror | **maintainability** | no | M | SHIM #3 + COMPILER-CLI #5 |
| 8 | Fix the shim's fabricated `EmitFlags.None = 0` (real enum has 7 members incl. `I18nBundle = 8`; no `None`). `emitFlags: 0` itself is safe | **maintainability** | no | S | SHIM #5 + COMPILER-CLI #6 |
| 9 | Greppable `// angular-typechecker: vendored -- <reason>` markers on every shim divergence (Prettier `angular-estree-parser` idiom) | **maintainability** | no | S | SHIM #1 |
| 10 | KEEP the `getNgStructuralDiagnostics()` call (vestigial View-Engine-era getter, `return []` at v22.0.4, ~free to call). Do NOT drop it -- dropping bakes in a today-only impl detail and silently under-gathers if Angular ever reactivates it. Add a comment explaining the deliberate no-op-tolerant call; have #7 assert it stays in the called-getter set | **robustness + maintainability** | no | S | ENGINE-REF #3 (RECOMMENDATION REVERSED) |
| 11 | (DECIDE) Add `totalFilesCount` observability field alongside `rootNamesCount` (`@nx/js` parity) -- shape-only, but borders on deferred reporting | **ergonomics** | no | S | CONSUMER #1 |

`Output?` = whether the change can alter the reported diagnostics or the pass/fail verdict.

### The one load-bearing open question (gates #3)

`NgCompiler.getDiagnosticsForFile` filters non-template diagnostics by `d.file === file`
(`compiler.ts:618`), so a naive per-file loop could DROP file-less `traitCompiler` /
`checkForPrivateExports` diagnostics. Before implementing #3, confirm whether any such file-less
Angular diagnostics exist in the no-emit path; if so, gather the non-template set ONCE separately
and only loop the template/extended families per file. This must be settled in planning/spike.

---

## What is already correct (validated -- do NOT change)

- **Family completeness:** our single `getNgSemanticDiagnostics()` -> `NgCompiler.getDiagnostics()`
  runs the full set (`getNonTemplateDiagnostics` + `getTemplateDiagnostics` + `runAdditionalChecks`:
  sourceFileValidator + templateSemantics + extended NG8xxx). Identical to `@angular/build`.
- **Formatting fidelity:** `addMessageTextDetails` pre-bakes the version-pinned NG guide URL into
  `messageText`; `formatDiagnostics` emits codeframes + runs `replaceTsWithNgInErrors`. Our
  `format-report`/`render-report` preserve it; our host even fixes two ngc default-host bugs.
- **Extended NG8xxx severity:** per-check `checks[name] ?? defaultCategory ?? Warning`; `Suppress`
  drops the check; category is baked in before we count. Our verbatim options pass-through +
  category-bucketed counts make `evaluateResult` faithful.
- **Counting:** explicit per-category Error/Warning counting (the old MD-02 fix) corroborated by
  both `@nx/js` and AnalogJS.
- **Config handling:** folding `parsed.errors` + the zero-rootNames guard is strictly better than
  `@nx/js` (throws) and AnalogJS (silent); `readConfiguration` walks the `extends` chain for
  `angularCompilerOptions` -- a reason NOT to hand-roll config reading.
- **Options:** do NOT copy `@angular/build`'s emit/codegen overrides (`annotationsAs`,
  `supportTestBed:false`, etc.) -- they SUPPRESS diagnostics; our `true` defaults are more complete,
  especially for spec tsconfigs. `emitFlags: 0` is safe (gated by `noEmit:true`).
- **Getter order** is irrelevant (no short-circuit; final `sortAndDeduplicateDiagnostics`).
- **`@angular/compiler`** is essentially irrelevant to a whole-program type-checker (it owns
  template-parser `ParseError`/`ParseSourceSpan` infra + `VERSION`); the `ErrorCode`/`ngErrorCode`
  source of truth lives in `@angular/compiler-cli`. No investment warranted there.

---

## Suggested grouping for v0.0.3 (input to requirements/roadmap)

Three coherent clusters, smallest-risk-first:

1. **Correctness & completeness fixes** (#1, #2, #5) -- changes reported diagnostics; each needs a
   failing-then-passing test (a broken-`extends` config; a global TS error; an empty-`fileName`
   diagnostic). Highest priority: these are real holes where we under-report or mis-classify.
2. **Resilience** (#3, #4, #6) -- the engine reports as much as it can instead of aborting on one
   bad component / a realpath throw / an output-path nuisance. #3 is the marquee item and carries
   the open question above (plan a spike).
3. **Drift-hardening / maintainability** (#7, #8, #9, #10) -- make an Angular upgrade that changes
   the `api.Program` getter set or error-code encoding break `nx`/CI LOUDLY instead of silently
   under-gathering. Low risk, high long-term leverage; pairs naturally with the vendored-shim debt
   already noted in PROJECT.md.

Item #11 (`totalFilesCount`) is a charter-fit decision: pure observability vs. the start of the
deferred reporting surface. Recommend deferring unless it earns its place as a correctness signal.
