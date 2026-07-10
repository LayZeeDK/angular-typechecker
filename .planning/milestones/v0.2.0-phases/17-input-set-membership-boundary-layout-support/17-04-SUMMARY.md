---
phase: 17-input-set-membership-boundary-layout-support
plan: 04
subsystem: core
tags: [typescript, angular, verdict, exit-codes, coverage-incomplete, input-set-membership, late-binding]

# Dependency graph
requires:
  - phase: 17-input-set-membership-boundary-layout-support
    provides: "CoreResult split suppressed counters + templateCheckAborted + skippedReferences (17-03)"
provides:
  - "evaluateResult returns { success, outcome } with an Outcome discriminant (clean | type-error | coverage-incomplete | warnings-exceeded)"
  - "evaluateResult fails coverage-incomplete on suppressedInGraphErrorCount>0, templateCheckAborted present, or a zero-root-names skipped reference (always), and on suppressedInGraphWarningCount>0 LATE-BOUND to the real maxWarnings"
  - "toExitCode maps suppressedInGraphErrorCount>0 to exit 1 (coverage-incomplete, reusing 1 for ngc parity)"
affects:
  - "17-05 (executor renders the split counts; the Outcome discriminant is available for a future distinct render)"
  - "the deferred standalone CLI (toExitCode gains its coverage-incomplete branch; warning/abort/zero-root triggers documented as deferred)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ordered pure verdict: errors win the label; the three always-fail coverage triggers (suppressed in-graph error, templateCheckAborted, zero-root-names leaf) are unconditional; the suppressed-warning trigger is late-bound to maxWarnings"
    - "New coverage inputs are OPTIONAL (Partial) on the parameter type so the pure unit tier keeps its minimal-literal idiom; the live caller passes a full CoreResult so the counters are always wired"

key-files:
  created: []
  modified:
    - packages/angular-typechecker/src/core/evaluate-result.ts
    - packages/angular-typechecker/src/core/evaluate-result.spec.ts
    - packages/angular-typechecker/src/core/exit-codes.ts
    - packages/angular-typechecker/src/core/exit-codes.spec.ts

key-decisions:
  - "Made the new coverage inputs OPTIONAL (Partial<Pick<...>>) rather than the plan's plain (required) Pick, because the acceptance criterion 'every prior evaluate-result/exit-codes assertion still passes' requires the existing 2-field literals to keep compiling. Type-shape only -- no behavior change; the live caller passes a full CoreResult so T-17-09 (unwired count) is unaffected."
  - "errorCount is checked FIRST so a genuine type error always wins the outcome label even when a suppressed in-graph error is also present."
  - "The suppressed-in-graph-WARNING trigger is late-bound to the real maxWarnings in evaluateResult (D-06); baking it into core would silent-pass a dropped warning under maxWarnings:0."

requirements-completed: [SB-04]

# Metrics
duration: 15min
completed: 2026-07-06
---

# Phase 17 Plan 04: coverage-incomplete verdict + exit code Summary

**Wired the 17-03 split in-graph counters (plus `templateCheckAborted` and the `zero-root-names` skipped-reference leaf) into the pure verdict so a dropped first-party diagnostic can never coexist with a green result: `evaluateResult` now returns a discriminated `{ success, outcome }` with a late-bound `coverage-incomplete` gate, and `toExitCode` maps a suppressed in-graph error to exit 1 (ngc parity).**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2 (both TDD RED/GREEN)
- **Files modified:** 4

## Authoritative gate result

- **`NX_DAEMON=false npx nx test angular-typechecker --skip-nx-cache`:** 295 passed (36 files), 0 failed (was 285; +8 evaluateResult coverage cases and +2 outcome upgrades, +2 exit-code cases; the RED runs proved each new assertion failed against the pre-implementation code first).
- **`NX_DAEMON=false npx nx build angular-typechecker --skip-nx-cache`:** SUCCESS, 0 errors (lib source type-checks; the executor's `return evaluateResult(...)` at executor.ts:104 accepts the additive `outcome` field via function-return widening -- no caller change).
- **`npx prettier --check`** on all 4 touched files: clean.
- **`NX_DAEMON=false npx nx lint angular-typechecker`:** clean (maxWarnings 0).
- Standalone `tsc -p tsconfig.spec.json` on the two touched spec files: 0 errors (the unrelated TS2835/TS1470 output is a pre-existing artifact of a standalone tsc invocation against untouched specs -- files last modified by 17-03 and earlier -- not caused by this plan; out of scope).

## Accomplishments

- **`evaluateResult` (Task 1):** expanded the input to read `suppressedInGraphErrorCount`, `suppressedInGraphWarningCount`, `templateCheckAborted`, and `skippedReferences` (optional, defaulting to 0/absent). Added the exported `Outcome` union and the ordered decision from the plan's `<behavior>`:
  1. `errorCount > 0` -> `type-error` (errors win the label).
  2. suppressed in-graph error -> `coverage-incomplete` (always).
  3. `templateCheckAborted` present -> `coverage-incomplete` (FM-9: whole-program TCB abort suppressed survivors' NG8xxx).
  4. a `zero-root-names` skipped reference -> `coverage-incomplete` (a first-party leaf resolved zero files).
  5. `warningCount > maxWarnings` (gated) -> `warnings-exceeded` (existing EXE-05 gate, preserved).
  6. suppressed in-graph warning (gated) -> `coverage-incomplete` (LATE-BOUND, the load-bearing D-06 fix).
  7. else -> `clean`.
- **`toExitCode` (Task 2):** added the `suppressedInGraphErrorCount > 0 -> 1` branch after the errorCount branch (reuse 1, Open Q2). Documented via a `ponytail:` note that the maxWarnings-gated suppressed-warning case and the `templateCheckAborted` / `zero-root-names` triggers are enforced by the live `evaluateResult` path and should be mirrored here only when the deferred CLI gains a live consumer + a maxWarnings option.
- **Specs:** every prior assertion preserved (upgraded to also assert `.outcome` where deterministic) plus the coverage-incomplete cases, including the late-binding proof (a suppressed in-graph warning FAILS under `maxWarnings: 0` but PASSES clean when `maxWarnings` is unset) and the Suggestion/Message-only-drop-stays-clean case.

## Task Commits

Each task committed atomically (TDD RED then GREEN):

1. **Task 1 RED (failing spec):** `be812c6` (test)
2. **Task 1 GREEN (impl):** `7542a0c` (feat)
3. **Task 2 RED (failing spec):** `334d56e` (test)
4. **Task 2 GREEN (impl):** `1a8293c` (feat)

**Plan metadata:** the `docs(17-04)` commit (this SUMMARY.md).

## Files Modified

- `packages/angular-typechecker/src/core/evaluate-result.ts` - `Outcome` union; `EvaluateInput` (required errorCount/warningCount + Partial coverage inputs); ordered `{ success, outcome }` verdict with the late-bound coverage-incomplete gate.
- `packages/angular-typechecker/src/core/evaluate-result.spec.ts` - existing assertions preserved + `.outcome`; coverage-incomplete cases; late-binding proof; Suggestion/Message-only clean case.
- `packages/angular-typechecker/src/core/exit-codes.ts` - `suppressedInGraphErrorCount` (Partial) input + the `>0 -> 1` branch; ponytail note on the deferred triggers.
- `packages/angular-typechecker/src/core/exit-codes.spec.ts` - `{ errorCount: 0, suppressedInGraphErrorCount: 2 } -> 1` and `... : 0 -> 0`; infra/errorCount/clean branches unchanged.

## Decisions Made

- **Optional (Partial) coverage inputs, not a required Pick.** The plan's interface sketched a plain `Pick` (which would make the two `suppressedInGraph*` numbers required). That would break every existing 2-field literal (`{ errorCount, warningCount }`) at compile time, contradicting the hard acceptance criterion "every prior assertion still passes". Wrapping the new inputs in `Partial` and reading them as `?? 0` keeps the minimal-literal test idiom, keeps the live path fully wired (the executor passes a full `CoreResult`), and makes an absent count read as the safe default (nothing suppressed). Behavior is identical to the plan's intent.
- **Errors win the outcome label.** `errorCount > 0` is checked before any coverage trigger, so a run with both a real type error and a suppressed in-graph error reports `type-error` (the loudest, most actionable signal), while still failing.
- **`outcome` is additive to the executor return.** `executor.ts:104` returns `evaluateResult(...)` directly; the extra `outcome` field is ignored by Nx's `{ success }` contract, so no executor change was needed. 17-05 renders the split counts; the discriminant is available for a future distinct render.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Coverage inputs made OPTIONAL to preserve the existing minimal-literal specs**
- **Found during:** Task 1 (and mirrored in Task 2).
- **Issue:** The plan's interface signature used a plain `Pick<CoreResult, ... | 'suppressedInGraphErrorCount' | 'suppressedInGraphWarningCount' | ...>`, which makes the two required `CoreResult` number fields required on the parameter. That breaks the pre-existing 2-field test literals (`{ errorCount: 1, warningCount: 0 }`) at compile time -- the specs would not build, failing the authoritative build gate and the acceptance criterion "every prior assertion still passes".
- **Fix:** Wrapped the new coverage inputs in `Partial<Pick<...>>` and read them defensively (`?? 0`). Same treatment in `toExitCode`. Type-shape only; no behavior change; the live caller passes a full `CoreResult` so no count is ever actually unwired (T-17-09 preserved).
- **Files modified:** packages/angular-typechecker/src/core/evaluate-result.ts, packages/angular-typechecker/src/core/exit-codes.ts
- **Committed in:** `7542a0c` (Task 1), `1a8293c` (Task 2)

---

**Total deviations:** 1 auto-fixed (a type-shape refinement to satisfy a hard acceptance criterion). No architectural changes. No scope creep.

## Authentication Gates

None.

## Threat Model Coverage

- **T-17-09 (false clean verdict via an unwired suppressed count / a baked-in warning decision):** mitigated -- both `evaluateResult` and `toExitCode` READ the suppressed counts; the warning decision is late-bound with the real `maxWarnings`, so there is no silent pass under `maxWarnings: 0`. HARD by default.
- **T-17-10 (whole-program abort hides survivors' errors):** mitigated -- `templateCheckAborted` present -> `coverage-incomplete` (success:false) (FM-9 fold).
- **T-17-11 (a zero-file leaf reads clean):** mitigated -- a `zero-root-names` skipped reference -> `coverage-incomplete`; a clean sibling can no longer make the solution read clean.
- **T-17-SC (supply chain):** N/A -- no package installs this plan.

## Threat Flags

None -- no new security-relevant surface (no new endpoints, auth paths, or schema at a trust boundary). The change hardens the existing verdict trust boundary.

## Known Stubs

None.

## Next Phase Readiness

- The verdict now fails on any first-party coverage loss with a discriminated `outcome`. 17-05's executor rendering of the split counts is unaffected (the executor already delegates the verdict to `evaluateResult`). No blockers.

## Self-Check: PASSED

- `packages/angular-typechecker/src/core/evaluate-result.ts` - FOUND
- `packages/angular-typechecker/src/core/evaluate-result.spec.ts` - FOUND
- `packages/angular-typechecker/src/core/exit-codes.ts` - FOUND
- `packages/angular-typechecker/src/core/exit-codes.spec.ts` - FOUND
- Commit `be812c6` (test) - FOUND
- Commit `7542a0c` (feat) - FOUND
- Commit `334d56e` (test) - FOUND
- Commit `1a8293c` (feat) - FOUND
- nx test 295/295 passing; nx build 0 errors; prettier + lint clean

---
*Phase: 17-input-set-membership-boundary-layout-support*
*Completed: 2026-07-06*
