---
phase: 09-resilience-per-file-fault-isolation-boundary-robustness
plan: 05
subsystem: core
tags: [angular, compiler-cli, diagnostics, resilience, reporting]

# Dependency graph
requires:
  - phase: 09-resilience-per-file-fault-isolation-boundary-robustness
    plan: 02
    provides: 'HYBRID gatherer + the per-file isFatalDiagnosticError isolation that converts the TCB-generation Fatal (NG3004) into one reported diagnostic instead of an infra-500 collapse'
  - phase: 08-correctness-completeness-fixes
    provides: 'D-05 infra-vs-type policy (UNKNOWN_ERROR_CODE 500 -> TypecheckInfrastructureError) the notice must NOT disturb'
provides:
  - 'diagnostic-codes: IMPORT_GENERATION_FAILURE_CODE (3004) + TCB_GENERATION_FATAL_DIAGNOSTIC_CODE (NG(3004) === -993004), the verified sole TCB-generation Fatal code at v22.0.4'
  - 'CoreResult.templateCheckAborted: a PURE optional field flagging a TCB-generation-Fatal template abort + the offending source file (shim path normalized back to .ts), set in finalize by scanning the reported set'
  - 'executor logger.warn loud suppression notice naming the offending file when templateCheckAborted is set; infra-vs-type path unchanged'
affects: [resilience, reporting, release]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Pure-core detection (a CoreResult field set by a code-only scan in finalize) + adapter-rendered notice (executor logger.warn) -- no console/process under src/core'
    - "Normalize the generated .ngtypecheck.ts shim path back to the authored source component so a consumer-facing notice names a fixable file (compiler convention fileName.replace(/\\.tsx?$/, '.ngtypecheck.ts'), verified v22.0.4)"

key-files:
  created: []
  modified:
    - packages/angular-typechecker/src/core/diagnostic-codes.ts
    - packages/angular-typechecker/src/core/run-typecheck.ts
    - packages/angular-typechecker/src/executors/angular-typecheck/executor.ts
    - packages/angular-typechecker/src/core/run-typecheck.spec.ts
    - packages/angular-typechecker/src/core/fault-isolation.integration.spec.ts
    - packages/angular-typechecker/src/executors/angular-typecheck/executor.spec.ts

key-decisions:
  - 'Detected the TCB-generation Fatal by a SINGLE code (NG3004 IMPORT_GENERATION_FAILURE). Verified at v22.0.4 that the typecheck bundle (chunk-QY6RCOQ6.js, the one carrying referenceTcbValue/TypeCheckBlock/Environment) throws NO other FatalDiagnosticError code; the siblings SYMBOL_NOT_EXPORTED (3001) and IMPORT_CYCLE_DETECTED (3003) live in the analysis bundle and do NOT reach the per-file getDiagnosticsForFile template catch, so they are EXCLUDED (locked by a regression unit test).'
  - 'Normalize the offending file from the generated .ngtypecheck.ts shim back to its source component. The Fatal empirically attaches to the shim (tcb-poison.component.ngtypecheck.ts), not the authored .component.ts; a notice pointing at a generated artifact would be useless, so finalize strips the .ngtypecheck infix (pure string transform).'
  - 'Used ng-baseline (an ordinarily-erroring Angular program emitting NG8001) as the negative integration case, proving the notice does NOT fire even when real Angular template diagnostics are present (no false positive). No new fixture added.'

patterns-established:
  - 'RES-02 loud notice: core sets CoreResult.templateCheckAborted (pure), the executor renders the logger.warn -- the I/O boundary (D-11) holds.'

requirements-completed: [RES-02]

# Metrics
duration: ~25min
completed: 2026-06-29
---

# Phase 9 Plan 05: RES-02 loud suppression notice Summary

**A TCB-generation `FatalDiagnosticError` (NG3004 `IMPORT_GENERATION_FAILURE`) that aborts shared shim priming -- silently suppressing surviving files' Angular template/extended (NG8xxx) diagnostics -- now sets a pure `CoreResult.templateCheckAborted` flag that the executor renders as a LOUD `logger.warn` naming the offending source file, so the incompleteness (deferred-to-REP-RES-02b) is never silent; the infra-vs-type policy (D-05) is untouched.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-06-29
- **Tasks:** 1
- **Files modified:** 6 (0 created, 6 modified)

## Accomplishments

- **Verified the TCB-generation Fatal code at v22.0.4 from source.** Read `node_modules/@angular/compiler-cli` bundles: the typecheck chunk (chunk-QY6RCOQ6.js, the bundle that contains `referenceTcbValue` / `TypeCheckBlock` / `Environment`) throws `FatalDiagnosticError(ErrorCode.IMPORT_GENERATION_FAILURE)` at the reference emitter (and NO other Fatal code). `NgCompiler.getDiagnosticsForFile` (chunk-33J3WRHI.js:4574) wraps `getTemplateDiagnosticsForFile` in the `isFatalDiagnosticError` try/catch, converting it via `toDiagnostic()` -> `code: ngErrorCode(3004) === -993004`. The siblings SYMBOL_NOT_EXPORTED (3001) and IMPORT_CYCLE_DETECTED (3003) live in the analysis chunk (chunk-VBOLXMVC.js), thrown during `ensureAnalyzed`, NOT through this template catch -- so they do not suppress survivors' template diagnostics and are excluded.
- **Pure-core detection.** `diagnostic-codes.ts` declares `IMPORT_GENERATION_FAILURE_CODE = 3004` (vendored, dependency-free) and `TCB_GENERATION_FATAL_DIAGNOSTIC_CODE = NG(3004)`. `run-typecheck.ts` adds the optional `CoreResult.templateCheckAborted` field (a `{ code, fileName }`), populated in `finalize` by a CODE-only scan of the reported (post-filter, post-sort, deduped) set -- the same code-only discipline the infra-500 scans use. No `console`/`process` (the pure-core eslint ban holds).
- **Shim-path normalization.** The Fatal attaches to the generated `tcb-poison.component.ngtypecheck.ts` shim (the empirically-documented HYBRID-gatherer shape), not the authored `.component.ts`. `finalize` normalizes it back to the source (`.ngtypecheck.ts` -> `.ts`, the compiler's own `fileName.replace(/\.tsx?$/, ".ngtypecheck.ts")` convention inverted) so the notice names a file the consumer can open and fix.
- **Adapter-rendered loud notice.** `executor.ts` emits a `logger.warn` (distinct from the infra `logger.error`) naming the offending file, stating that surviving files' template/extended (NG8xxx) diagnostics may be SUPPRESSED until the NG3004 is fixed, with a re-run hint. The success and infra (`UNKNOWN_ERROR_CODE 500 -> TypecheckInfrastructureError`) paths are byte-unchanged; the notice is additive signalling, NOT a reclassification (closes threat T-09-05 / T-09-04).
- **Three-tier proof.** Unit (synthesized reported sets: detection set/unset, file-less, shim normalization, non-shim passthrough, 3001/3003 exclusion, encoding guard); real-compiler integration (the field is SET on the fault-isolation poison naming `tcb-poison.component.ts`, and UNSET on the ordinarily-erroring `ng-baseline` NG8001 run); executor (logger.warn on set with file + NG3004 + SUPPRESSED, fallback file text, silent on unset).

## Task Commits

Each task was committed atomically:

1. **Task 1: Detect a TCB-generation-Fatal template abort in core and surface a loud notice in the executor** - `3232944` (feat)

## Files Created/Modified

- `packages/angular-typechecker/src/core/diagnostic-codes.ts` - Added `IMPORT_GENERATION_FAILURE_CODE` (3004, vendored with a verification note) and `TCB_GENERATION_FATAL_DIAGNOSTIC_CODE` (`NG(3004)`), documenting WHY only this code (the sole TCB-generation Fatal that reaches the per-file template catch) and WHY 3001/3003 are excluded (analysis-phase).
- `packages/angular-typechecker/src/core/run-typecheck.ts` - Added the `templateCheckAborted?: TemplateCheckAborted` field to `CoreResult`, the exported pure `detectTemplateCheckAborted` (code-only scan) called from `finalize`, and the private `normalizeShimFileName` (strips `.ngtypecheck`). The two infra-500 re-throw paths (D-05) are untouched.
- `packages/angular-typechecker/src/executors/angular-typecheck/executor.ts` - Added the `result.templateCheckAborted` -> `logger.warn` notice on the success path, before the report write. The `TypecheckInfrastructureError` catch and the stdout report write are unchanged.
- `packages/angular-typechecker/src/core/run-typecheck.spec.ts` - Added the `detectTemplateCheckAborted (RES-02 reframe)` describe block (7 unit cases incl. the encoding guard, shim normalization, and the 3001/3003 exclusion regression).
- `packages/angular-typechecker/src/core/fault-isolation.integration.spec.ts` - Added the real-compiler `templateCheckAborted` SET-on-poison (naming `tcb-poison.component.ts`) assertion and a new describe proving it is UNSET on the ordinarily-erroring `ng-baseline` (NG8001) run.
- `packages/angular-typechecker/src/executors/angular-typecheck/executor.spec.ts` - Added `logger.warn` to the `@nx/devkit` mock + a `loggerWarn` handle, an `abortedCoreResult` helper, and three cases (warn-with-file, fallback-file, silent-when-unset).

## Decisions Made

- **Single-code detection (NG3004), 3001/3003 excluded -- verified from compiler source.** The plan asked to "check whether the sibling structural classes 3001/3003 also reach that catch". They do NOT: at v22.0.4 they are thrown during component analysis (`ensureAnalyzed`), surface through the structural / non-template getters, and never pass through the `getDiagnosticsForFile` -> `getTemplateDiagnosticsForFile` `isFatalDiagnosticError` catch that the TCB-generation Fatal hits. The typecheck bundle throws only `IMPORT_GENERATION_FAILURE`. A regression unit test locks the exclusion.
- **Normalize the shim path to the source component.** Discovered during execution: the real-compiler poison run attributes NG3004 to `tcb-poison.component.ngtypecheck.ts` (the generated shim), not `tcb-poison.component.ts`. A notice naming a generated artifact would be unactionable, so `finalize` strips the `.ngtypecheck` infix (the inverse of the compiler's documented shim-naming convention, verified at chunk-VBOLXMVC.js:9592). Unit tests lock both the strip and the non-shim passthrough.
- **ng-baseline as the negative integration case.** It is an ordinarily-erroring Angular program (NG8001) with NO TCB-generation Fatal -- the strongest "no false positive" proof, since the notice must stay silent even when real Angular template diagnostics are present. No new fixture was added.

## Deviations from Plan

### Auto-fixed / in-task discoveries (Rule 2 - critical correctness)

**1. [Rule 2 - missing critical correctness] Offending file was the generated shim, not the source component**

- **Found during:** Task 1 (the integration assertion initially expected `tcb-poison.component.ts` and FAILED -- the compiler reported `tcb-poison.component.ngtypecheck.ts`).
- **Issue:** The TCB-generation Fatal attaches to the synthesized `.ngtypecheck.ts` shim. Surfacing that raw path in the notice would point a consumer at a non-openable generated artifact, defeating the notice's purpose ("name the offending file").
- **Fix:** Added the pure `normalizeShimFileName` helper in `finalize` (strips `.ngtypecheck.ts` -> `.ts`, the inverse of the compiler's verified shim-naming convention). The notice now names the authored source component.
- **Files modified:** `run-typecheck.ts` (+ unit tests in `run-typecheck.spec.ts`).
- **Commit:** `3232944`.

No architectural changes; no package installs; the infra-vs-type path (D-05) was not touched.

## Issues Encountered

- None beyond the shim-path discovery above. The node_modules junction provisioned cleanly via PowerShell `New-Item -ItemType Junction` on the first attempt.

## Acceptance gate evidence

- `npx nx test angular-typechecker` (full suite, `--skip-nx-cache`) -> 25 test files, 145 tests, 0 failures (was 142; +3 net after adding the RES-02 unit/integration/executor cases).
- `npx nx build angular-typechecker` -> exit 0 (drift guard; the new `CoreResult` field + helpers type-check; the executor `logger.warn` survives the nodenext emit).
- `npx nx lint angular-typechecker` -> exit 0. The one reported warning (`'NG' is assigned a value but never used` in `config-resolution.integration.spec.ts`) is PRE-EXISTING in a file this plan did not touch -- out of scope per the deviation scope boundary, not a regression.
- `npx prettier --check` on all six changed files -> clean.

## Next Phase Readiness

- RES-02 (reframed, Option A) is fully delivered: the TCB-generation Fatal now produces a loud, file-named notice; the incompleteness is never silent. Pure-core detection + adapter-rendered notice; the infra-vs-type policy preserved; no new package, no new fixture, no shim change.
- The faithful recovery of survivors' template diagnostics after a TCB-generation Fatal remains deferred to the `NgtscProgram`/incremental milestone as REP-RES-02b (per 09-RES-02-DECISION.md), exactly as recorded.
- Ready for the wave-3 merge and the phase's remaining verification.

## Self-Check: PASSED

All modified files exist and the task commit is in the log:

- FOUND: packages/angular-typechecker/src/core/diagnostic-codes.ts
- FOUND: packages/angular-typechecker/src/core/run-typecheck.ts
- FOUND: packages/angular-typechecker/src/executors/angular-typecheck/executor.ts
- FOUND: packages/angular-typechecker/src/core/run-typecheck.spec.ts
- FOUND: packages/angular-typechecker/src/core/fault-isolation.integration.spec.ts
- FOUND: packages/angular-typechecker/src/executors/angular-typecheck/executor.spec.ts
- FOUND: .planning/phases/09-resilience-per-file-fault-isolation-boundary-robustness/09-05-SUMMARY.md
- FOUND commit: 3232944 (Task 1, feat)

---

_Phase: 09-resilience-per-file-fault-isolation-boundary-robustness_
_Completed: 2026-06-29_
