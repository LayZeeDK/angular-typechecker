---
phase: 17-input-set-membership-boundary-layout-support
plan: 05
subsystem: executor
tags: [nx, executor, adapter, logger, suppressed-counters, coverage-incomplete, sb-04]

# Dependency graph
requires:
  - phase: 17-input-set-membership-boundary-layout-support
    provides: "CoreResult split suppressed counters (suppressedThirdParty + suppressedInGraphErrorCount/WarningCount/Files) from 17-03"
provides:
  - "Executor renders the two split suppressed counts LOUDLY from the pure CoreResult fields: logger.info for expected node_modules (suppressedThirdParty), logger.warn coverage-incomplete naming dropped first-party files (suppressedInGraphFiles)"
  - "templateCheckAborted + zero-root-names skippedReferences notices reworded to coverage-incomplete (non-clean), not advisory-only"
  - "Executor return destructures .success from evaluateResult so extra structured fields (17-04 outcome) never leak into Nx { success }"
affects:
  - "17-06/17-07 (Layout-A/B integration proofs exercise the loud rendering end-to-end)"
  - "18 (validation gate T7: clean Layout-B surfaces both counts)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Detection(core, pure)-vs-rendering(adapter, logger) split extended to the suppressed counts: core only COUNTS + records file paths, the adapter is the sole @nx/devkit logger tier"
    - "Adapter reads structured CoreResult fields to render; NEVER recomputes counts and NEVER surfaces a dependency's diagnostic message text (content isolation)"

key-files:
  created: []
  modified:
    - packages/angular-typechecker/src/executors/typecheck/executor.ts
    - packages/angular-typechecker/src/executors/typecheck/executor.spec.ts

key-decisions:
  - "Render from the SPLIT per-category fields (suppressedInGraphErrorCount || WarningCount) that 17-03 delivered, not the single suppressedInGraph the RESEARCH sketch used; the WARN reports both counts and the file list, an error-only or warning-only drop both fire it"
  - "Destructure .success from evaluateResult (rather than returning its object) so 17-04's forthcoming { success, outcome } shape maps cleanly to Nx { success } with no field leak"
  - "zero-root-names skippedReferences notice reworded to coverage-incomplete (a checked sibling leaf can transitively import a zero-root-names leaf's files, dropped as suppressedInGraph); not-found keeps its counted-90002 wording; out-of-project/self-reference/duplicate keep advisory-only wording"

requirements-completed: [SB-04]

# Metrics
duration: ~20min
completed: 2026-07-06
---

# Phase 17 Plan 05: Executor loud rendering of the split suppressed counts Summary

**The Nx executor adapter now surfaces the two split suppressed counters LOUDLY from the pure structured `CoreResult` fields (17-03) -- an INFO line for expected `node_modules` suppressions and a LOUD coverage-incomplete WARN naming the dropped first-party files when `suppressedInGraph*` > 0 -- closing the SB-04 charter floor (Pitfall 5: a suppressed count that is never rendered is functionally silent).**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2
- **Files modified:** 2

## Authoritative gate result

- **`NX_DAEMON=false npx nx test angular-typechecker --skip-nx-cache`:** **289 passed (36 files), 0 failed** (was 284; +5 new executor SB-04 tests). Note: the `-- executor` positional does not narrow the Nx vitest run, so the full suite ran and is green.
- **`npx prettier --check`** on both touched files: clean.
- **`NX_DAEMON=false npx nx lint angular-typechecker --skip-nx-cache`:** clean (maxWarnings 0).

## Accomplishments

- **Task 1 (`executor.ts`, feat `53f5792`):** After `runTypecheck` and before `renderReport` (alongside the existing `templateCheckAborted` / `skippedReferences` notices), added:
  - `result.suppressedThirdParty > 0` -> `logger.info` an expected-suppression line ("N node_modules diagnostic(s) suppressed (expected; pass includeDeps to include them)"). Quiet, never verdict-affecting (dependency isolation).
  - `result.suppressedInGraphErrorCount > 0 || result.suppressedInGraphWarningCount > 0` -> `logger.warn` a LOUD coverage-incomplete notice that states coverage is INCOMPLETE and the verdict is NOT clean, reports both counts, and lists the dropped first-party files from `result.suppressedInGraphFiles` -- FILE PATHS ONLY, never the dependency's error text (T-17-13 content isolation).
  - Reworded the `templateCheckAborted` WARN to add that the run is coverage-incomplete (non-clean verdict).
  - Reworded the `skippedReferences` per-entry note into a three-way branch: `not-found` keeps its counted-90002 FAILS wording; `zero-root-names` now warns about coverage-incompleteness instead of "verdict is unchanged"; `out-of-project` / `self-reference` / `duplicate` keep the advisory-only wording.
  - Changed the final return to destructure `.success` from `evaluateResult(result, { maxWarnings })` and return `{ success }`, so any extra structured fields evaluateResult may carry (17-04's coverage-incomplete outcome) never leak into Nx's `{ success }`. The raw-stdout `renderReport` path is unchanged.
- **Task 2 (`executor.spec.ts`, test `8c1494b`):** Added a `suppressedCoreResult()` helper (Partial override of the four split fields over `coreResult(0)`) and five assertions: INFO fires for `suppressedThirdParty > 0` (and NOT the coverage-incomplete WARN); WARN fires + names the dropped file for `suppressedInGraphErrorCount > 0` and never contains a diagnostic message fragment (`is not assignable`); WARN also fires for a warning-only in-graph drop; a clean result emits NEITHER notice; the `zero-root-names` skippedReferences notice contains `coverage-incomplete` and no longer contains `verdict is unchanged`.

## Decisions Made

- **Render from the split fields, not the RESEARCH single-field sketch.** 17-RESEARCH's code example rendered a single `suppressedInGraph`; 17-03 shipped the split per-category counters. The WARN condition ORs `suppressedInGraphErrorCount` and `suppressedInGraphWarningCount` and reports both, so an error-only, warning-only, or mixed drop all fire the notice.
- **Destructure `.success`.** The plan flags 17-04 as the authoritative verdict tier that will extend `evaluateResult` to return a coverage-incomplete outcome. Destructuring keeps the adapter forward-compatible with that concurrent change (my base does not yet contain 17-04; `evaluateResult` currently returns `{ success }`, and destructuring it is a no-op today but leak-proof once 17-04 lands).

## Deviations from Plan

None -- plan executed as written.

**Plan note (not a deviation):** Task 2's action instructs updating the `coreResult()` helper to remove `suppressedCount` and add the four split fields. 17-03 already applied that exact field-rename cascade (documented in 17-03-SUMMARY deviation #1, commit `250aa02`) so the whole-package build would type-check. The helper in my base already carried the four split fields, so Task 2 reduced to ADDING the count-rendering assertions -- the helper change was already present and correct.

## Authentication Gates

None.

## Threat Model Coverage

- **T-17-12 (silent coverage loss):** mitigated -- the adapter renders BOTH counts (INFO third-party, WARN in-graph naming files); a clean run stays silent. Proven by the `SB-04` info/warn/clean tests.
- **T-17-13 (dependency error text leaking):** mitigated -- the WARN renders ONLY file paths from `suppressedInGraphFiles`; the adapter never reads `result.diagnostics` for the notice. The `not.toHaveBeenCalledWith(expect.stringContaining('is not assignable'))` assertion locks that a diagnostic message fragment can never appear.
- **T-17-SC (supply chain):** accepted -- no package installs this plan.

## Threat Flags

None -- no new security-relevant surface (no new endpoints, auth paths, file access, or schema at a trust boundary). Rendering reads existing pure `CoreResult` fields and writes to the Nx `logger`.

## Known Stubs

None.

## Next Phase Readiness

- The executor now loudly surfaces both suppressed counts, satisfying SB-04's rendering half. 17-06/17-07 Layout integration fixtures can exercise the notice end-to-end; Phase 18's T7 validation (clean Layout-B surfaces both counts) has its adapter surface in place. No blockers.

## Self-Check: PASSED

- `packages/angular-typechecker/src/executors/typecheck/executor.ts` - FOUND
- `packages/angular-typechecker/src/executors/typecheck/executor.spec.ts` - FOUND
- Commit `53f5792` (feat) - FOUND
- Commit `8c1494b` (test) - FOUND
- Full suite 289/289 passing; prettier + lint clean

---
*Phase: 17-input-set-membership-boundary-layout-support*
*Completed: 2026-07-06*
