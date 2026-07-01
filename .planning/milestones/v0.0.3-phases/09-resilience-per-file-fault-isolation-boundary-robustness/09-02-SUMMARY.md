---
phase: 09-resilience-per-file-fault-isolation-boundary-robustness
plan: 02
subsystem: core-engine
tags: [angular, compiler-cli, diagnostics, fault-isolation, resilience]

# Dependency graph
requires:
  - phase: 09-resilience-per-file-fault-isolation-boundary-robustness
    plan: 01
    provides: the GO=HYBRID gate decision (09-RES-01-SPIKE.md) and the fixtures/fault-isolation/ multi-file fixture (tcb-poison + survivor)
  - phase: 08-correctness-completeness-fixes
    provides: the gatherAllDiagnostics seventh-getter (getGlobalDiagnostics, COR-02) and the infra-vs-type TypecheckInfrastructureError policy RES-02 preserves
provides:
  - 'Per-file fault-isolated Angular diagnostic gathering (HYBRID) in gather-diagnostics.ts: residual whole-program getNgSemanticDiagnostics() + per-file getNgSemanticDiagnostics(sf.fileName) loop skipping isDeclarationFile'
  - 'fault-isolation.integration.spec.ts: the real-compiler proof that one TCB-phase FatalDiagnosticError yields exactly ONE diagnostic and does NOT collapse the run to an infra-500 (the survivor is not abandoned)'
  - "Empirical finding (the WholeProgram-priming limitation): a TCB-GENERATION Fatal aborts the shared ensureAllShimsForAllFiles() priming, so a survivor's TEMPLATE diagnostics cannot be recovered per-file under OptimizeFor.WholeProgram (D-07) -- affects @angular/build identically"
affects: [10 HARD-01 getter-set drift assertion must cover the per-file getNgSemanticDiagnostics(fileName) usage]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "HYBRID Angular gather (RES-01 GO): keep the file-less-safe whole-program getNgSemanticDiagnostics() AND add a per-file loop over getTsProgram().getSourceFiles() skipping isDeclarationFile; rely on finalize's ts.sortAndDeduplicateDiagnostics to dedup the per-file template duplicates (no manual dedup)"
    - 'Fault-isolation integration spec asserts the PROVABLE resilience contract (exactly one Fatal-derived diagnostic, no infra-500, survivor not abandoned), with the WholeProgram-priming limitation documented inline'

key-files:
  created:
    - 'packages/angular-typechecker/src/core/fault-isolation.integration.spec.ts'
  modified:
    - 'packages/angular-typechecker/src/core/gather-diagnostics.ts'
    - 'packages/angular-typechecker/src/core/gather-diagnostics.spec.ts'

key-decisions:
  - "Implemented HYBRID (not SIMPLE), exactly as the RES-01 GO decision recorded. The residual whole-program getNgSemanticDiagnostics() guarantees no file-less / shim-attached non-template diagnostic is dropped; the per-file loop adds the FatalDiagnosticError isolation. COR-02's getGlobalDiagnostics (line 35) retained; OptimizeFor.WholeProgram only (D-07); NO catch-all added (D-05); NO NgtscProgram migration (D-04)."
  - "SIGNIFICANT DEVIATION: the planned failing-then-passing 0 -> >= 1 differentiator for the SURVIVOR'S TEMPLATE diagnostic is mechanically UNSATISFIABLE on the api.Program surface under D-07. A TCB-GENERATION Fatal (IMPORT_GENERATION_FAILURE) is thrown during the SHARED ensureAllShimsForAllFiles() priming that BOTH the whole-program AND the per-file WholeProgram calls depend on -- so the survivor's NG8109/NG8117 vanish in BOTH the pre-change and post-change paths. The spec asserts the resilience that IS provable instead."

requirements-completed: [RES-02]

# Metrics
duration: 49min
completed: 2026-06-29
---

# Phase 9 Plan 02: RES-02 Per-File Fault-Isolated Angular Gathering Summary

**Shape = HYBRID (the RES-01 GO decision, implemented exactly): the Angular semantic set is now gathered with a residual whole-program `getNgSemanticDiagnostics()` PLUS a per-file `getNgSemanticDiagnostics(sf.fileName)` loop, so one component's TCB-phase `FatalDiagnosticError` yields exactly ONE diagnostic and does NOT collapse the run to a `TypecheckInfrastructureError` 500 -- with a documented compiler-level limitation that a TCB-GENERATION Fatal still suppresses other files' TEMPLATE diagnostics under `OptimizeFor.WholeProgram`.**

## Performance

- **Duration:** ~49 min (heavy empirical verification of the WholeProgram-priming behavior against the live compiler)
- **Started:** 2026-06-29T18:08Z
- **Completed:** 2026-06-29T18:57Z
- **Tasks:** 2
- **Files created:** 1 (the integration spec)
- **Files modified:** 2 (the gatherer + its unit spec)

## Accomplishments

- **Implemented the HYBRID gatherer (Task 1)** in `gather-diagnostics.ts` exactly as the RES-01 GO decision recorded: a residual whole-program `getNgSemanticDiagnostics()` (the file-less-safe non-template set, NOT filtered by file) followed by a per-file `getNgSemanticDiagnostics(sf.fileName)` loop over `getTsProgram().getSourceFiles()` skipping `sf.isDeclarationFile`. COR-02's `getTsProgram().getGlobalDiagnostics()` (line 35) is retained; `OptimizeFor.WholeProgram` is used implicitly (never `SingleFile`, D-07); NO catch-all try/catch was added (D-05); determinism is left to `finalize`'s existing `ts.sortAndDeduplicateDiagnostics` (D-06).
- **Updated the gatherer unit spec** to stub `getTsProgram().getSourceFiles()` for the new per-file loop and added a dedicated `isDeclarationFile`-skip test; the call-order test now asserts the residual whole-program call followed by the per-file iterations.
- **Authored `fault-isolation.integration.spec.ts` (Task 2)** -- a real-compiler proof against `fixtures/fault-isolation/` that the poison's `IMPORT_GENERATION_FAILURE` (NG3004) yields exactly ONE diagnostic, the run does NOT collapse to an `UNKNOWN_ERROR_CODE 500`, and the survivor component is NOT abandoned (its own diagnostic on its own file is still reported).
- **Empirically characterized the WholeProgram-priming limitation** (five live-compiler experiments + bundle source analysis): the planned "survivor template diagnostic returns" differentiator is mechanically impossible on the locked surface, and documented it so Phase verification / a future SingleFile decision has the full picture.

## Task Commits

1. **Task 1: HYBRID per-file gatherer + updated unit mocks** - `2afb3c0` (feat)
2. **Task 2: fault-isolation integration proof** - `3a27e75` (test)

## Files Created/Modified

- `packages/angular-typechecker/src/core/gather-diagnostics.ts` (modified) - replaced the single whole-program `getNgSemanticDiagnostics()` (line 34) with the HYBRID shape (residual whole-program call + per-file loop); header comment documents the HYBRID per-file isolation, cites the RES-01 GO decision, and records the no-catch-all / WholeProgram-only / determinism constraints. Line 35 COR-02 `getGlobalDiagnostics()` intact.
- `packages/angular-typechecker/src/core/gather-diagnostics.spec.ts` (modified) - stub `getTsProgram().getSourceFiles()` for the per-file loop; new `isDeclarationFile`-skip test; call-order test updated for the residual + per-file calls.
- `packages/angular-typechecker/src/core/fault-isolation.integration.spec.ts` (created) - the RES-02 isolation proof (3 tests, all green).

## Decisions Made

- **HYBRID, exactly as RES-01 recorded.** The spike's GO=HYBRID decision (inconclusive non-template enumeration + affirmative evidence that `d.file` attaches to `.ngtypecheck.ts` shims) is implemented verbatim. HYBRID can never under-gather relative to today's whole-program behavior and adds the per-file `FatalDiagnosticError` isolation.
- **Asserted the provable resilience contract, not the unsatisfiable differentiator.** See the deviation below for the full mechanical justification. The spec proves: (1) the poison Fatal -> exactly one diagnostic; (2) no infra-500 collapse; (3) the survivor's own diagnostic survives; (4) `errorCount >= 2` (the poison Fatal + the survivor's TS2322), not a single-500 collapse.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated the gatherer unit mocks for the new per-file loop**

- **Found during:** Task 1
- **Issue:** The existing `gather-diagnostics.spec.ts` stubbed `getTsProgram()` returning only `{ getGlobalDiagnostics }`. The HYBRID loop calls `program.getTsProgram().getSourceFiles()`, which is `undefined` on those stubs -> `getSourceFiles is not a function` at runtime.
- **Fix:** Added `getSourceFiles` to every `getTsProgram()` stub (returning `[]` or a small `ts.SourceFile` set including a `.d.ts` to prove the skip), updated the call-order assertion to include the per-file iterations, and added a dedicated `isDeclarationFile`-skip test.
- **Files modified:** `packages/angular-typechecker/src/core/gather-diagnostics.spec.ts`
- **Commit:** `2afb3c0`

### Significant Design Deviation (escalation-worthy; resolved within granted latitude)

**2. [Rule 4-adjacent - architectural] The planned failing-then-passing differentiator for the SURVIVOR'S TEMPLATE diagnostic is mechanically UNSATISFIABLE on the locked surface; the spec asserts the provable contract instead.**

- **Found during:** Task 2 (empirical verification of the post-change behavior, as the critical hand-off in 09-01-SUMMARY "Next Phase Readiness" and 09-RES-01-SPIKE section 4a finding 3 explicitly required).
- **What the plan assumed:** that the survivor component's template/extended diagnostic (NG8109) vanishes pre-change via the "whole-program early-return" and SURVIVES post-change via the per-file loop -- a clean `diagnosticsOnFile(survivor) 0 -> >= 1` differentiator.
- **The empirical reality (5 live-compiler experiments + bundle source analysis):**
  - The poison is a TCB-GENERATION-phase Fatal (`IMPORT_GENERATION_FAILURE`), thrown during `typeCheckAdapter.typeCheck(sf, ctx)` inside `ensureAllShimsForAllFiles()` (`@angular/compiler-cli@22.0.4` bundle `chunk-VBOLXMVC.js:10751-10773`).
  - On the `api.Program` surface, the per-file overload `getNgSemanticDiagnostics(fileName)` HARD-CODES `OptimizeFor.WholeProgram` (`chunk-6ZBSJK4S.js:294` -> `getDiagnosticsForFile(sf, OptimizeFor.WholeProgram)`), which calls the SAME shared `ensureAllShimsForAllFiles()` priming (`chunk-VBOLXMVC.js:10567`).
  - The poison's Fatal aborts that shared priming for ALL files: `this.isComplete` is never set, `updateFromContext(ctx)` is never called, so the survivor's shim data is never committed. Therefore the survivor's NG8109/NG8117 (confirmed produced when the survivor compiles ALONE) do NOT come back in EITHER the whole-program OR the per-file path.
  - Measured directly: pre-change full gathered set = `[poison Fatal, survivor TS2322]`; post-change (HYBRID) full set = `[poison Fatal, survivor TS2322]` -- IDENTICAL. There is no observable behavioral difference for THIS fixture, so a failing-then-passing TEMPLATE-diagnostic differentiator cannot exist under D-07.
  - This is a compiler-level limitation, NOT a loop-structure bug: `@angular/build`'s own per-file loop (`aot-compilation.ts:281-294`) routes through the same `ensureAllShimsForAllFiles()` and would abandon the survivor identically. A two-poison variant was also tested -- the second poison's Fatal never surfaces either (the first poison aborts the shared priming first).
  - Recovering the survivor's TEMPLATE diagnostic would require `OptimizeFor.SingleFile` per file (each shim generated in its own isolated `ensureAllShimsForOneFile()` pass) -- which D-07 explicitly forbids -- or an `NgtscProgram` migration -- which D-04 / PROJECT.md forbid.
- **Resolution (within the latitude the critical hand-off granted -- "adjust ... WITHIN the locked decisions", + CONTEXT "Claude's Discretion" over fixture mechanics):** kept the HYBRID gatherer (the correct RES-01 shape; it adds real per-file resilience for any Fatal thrown during per-file EXTRACTION rather than shared priming) and wrote `fault-isolation.integration.spec.ts` to prove the resilience that IS genuine and provable: the poison yields exactly ONE Fatal-derived diagnostic, the run does NOT collapse to an infra-500 (D-05 preserved), and the survivor is NOT abandoned (its own TS-level diagnostic on its file is still reported, `>= 1`). The spec and the gatherer header both document the WholeProgram-priming limitation explicitly (no silent caveat).
- **Why not a hard stop / human checkpoint:** the run is headless (`_auto_chain_active: true`, `mode: yolo`), so there is no human to answer a Rule 4 checkpoint; the critical hand-off explicitly anticipated this exact scenario and granted the latitude to resolve it. This deviation is surfaced loudly here (and inline in both files) rather than papered over.
- **Open item for the phase verifier / a future plan:** if SC2's literal "the surviving files' template/extended diagnostics are still reported" is deemed mandatory, it requires re-opening D-07 (allow `OptimizeFor.SingleFile` for the per-file loop, accepting the documented overhead) or the deferred `NgtscProgram` migration. That is an architectural decision above this plan's scope; flagged for the milestone audit.

**Total deviations:** 1 auto-fixed (blocking mock update) + 1 significant design deviation (documented, not silently shipped).

## Known Stubs

None. No stubbed data, no placeholder UI, no TODO/FIXME introduced. The integration spec exercises the real compiler against real fixtures.

## Verification Evidence

- `npx nx test angular-typechecker -- gather-diagnostics.spec.ts` -> green (the updated unit coverage; 24-file suite 129 tests on the first run, then 25 files / 132 tests with the new spec).
- `npx nx test angular-typechecker -- fault-isolation.integration.spec.ts` -> green (3/3 RES-02 tests pass against the post-change HYBRID gatherer).
- `npx nx test angular-typechecker` (full) -> 25 files / 132 tests passed; the diagnostic SET on clean / ordinarily-erroring fixtures is unchanged (run-typecheck.integration, gate-b, extended.promotion, global-diagnostics, no-emit-override, suppress-output-path all still green).
- `npx nx build angular-typechecker` -> green (drift guard; the per-file loop type-checks against the existing shim, no widening).
- `npx nx lint angular-typechecker` -> 0 errors (1 PRE-EXISTING warning in `config-resolution.integration.spec.ts`, out of scope per the deviation SCOPE BOUNDARY; the new spec is lint-clean).

## Self-Check: PASSED

- Created file verified present: `packages/angular-typechecker/src/core/fault-isolation.integration.spec.ts` (FOUND).
- Both task commits verified in git log: `2afb3c0` (Task 1, feat), `3a27e75` (Task 2, test) (FOUND).
- Modified files present and committed: `gather-diagnostics.ts`, `gather-diagnostics.spec.ts` (FOUND in `2afb3c0`).
- No STATE.md / ROADMAP.md writes (worktree mode -- orchestrator owns those post-merge).

---

_Phase: 09-resilience-per-file-fault-isolation-boundary-robustness_
_Completed: 2026-06-29_
