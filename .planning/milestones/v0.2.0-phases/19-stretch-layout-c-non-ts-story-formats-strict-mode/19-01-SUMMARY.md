---
phase: 19-stretch-layout-c-non-ts-story-formats-strict-mode
plan: 01
subsystem: api
tags: [nx-executor, verdict, strict-mode, coverage-incomplete, evaluate-result]

# Dependency graph
requires:
  - phase: 17-storybook-input-set-boundary
    provides: "SB-04 split counters (suppressedInGraphErrorCount/suppressedInGraphWarningCount) + the coverage-incomplete outcome in evaluate-result.ts that strict escalates"
provides:
  - "Opt-in strict verdict mode (default false) on the typecheck executor + pure core"
  - "strict escalates a dropped in-graph WARNING (maxWarnings unset) from clean to a HARD FAIL (coverage-incomplete)"
  - "strict is surfaced end-to-end: schema.json + schema.d.ts + parity tripwire -> normalizeOptions -> evaluateResult"
affects: [milestone-audit, verification, README-strict-docs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure verdict-only option (mirror maxWarnings): strict lives in EvaluateOptions, never in CoreOptions/runTypecheck/exit-codes"
    - "Negative-test-as-acceptance-gate: the clean->coverage-incomplete FLIP + the ERROR regression guard"

key-files:
  created: []
  modified:
    - packages/angular-typechecker/src/core/evaluate-result.ts
    - packages/angular-typechecker/src/core/evaluate-result.spec.ts
    - packages/angular-typechecker/src/executors/typecheck/schema.json
    - packages/angular-typechecker/src/executors/typecheck/schema.d.ts
    - packages/angular-typechecker/src/executors/typecheck/schema-parity.spec.ts
    - packages/angular-typechecker/src/executors/typecheck/normalize-options.ts
    - packages/angular-typechecker/src/executors/typecheck/normalize-options.spec.ts
    - packages/angular-typechecker/src/executors/typecheck/executor.ts
    - packages/angular-typechecker/src/executors/typecheck/executor.spec.ts

key-decisions:
  - "strict is a single one-gate edit in evaluateResult ((gatesWarnings || strict) && suppressedInGraphWarningCount > 0); no engine/CoreOptions/exit-codes plumbing (dead for it)"
  - "A1 ratified: the observable FLIP is a dropped in-graph WARNING with maxWarnings unset; the in-graph ERROR case already fails by default and strict does NOT change it"
  - "Release-meaningful commit scopes (core, executor) used instead of plan-id scopes per AGENTS.md scope-hygiene"

patterns-established:
  - "Verdict-only knob defaulted defensively: options.strict ?? false, so an absent/malformed value == current behavior (charter: never a silent false pass)"

requirements-completed: [SB-08]

# Metrics
duration: 20min
completed: 2026-07-07
---

# Phase 19 Plan 01: Opt-in strict verdict mode Summary

**Opt-in `strict` mode (default false) that escalates a dropped in-graph WARNING from a clean pass to a HARD FAIL (coverage-incomplete), threaded end-to-end schema -> normalizeOptions -> evaluateResult with a one-gate core edit.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-07T00:46Z (post-base)
- **Completed:** 2026-07-07T01:02Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- `strict?: boolean` added to the pure `EvaluateOptions`; the suppressed-in-graph-WARNING branch now fires under `(gatesWarnings || strict)` -- the ONLY behavioral change (A1).
- The dropped-in-graph-WARNING clean->coverage-incomplete FLIP is proven by unit test; the in-graph ERROR case is proven unchanged (regression guard); a fully-clean result under strict stays clean (no false escalation).
- `strict` surfaced consistently across schema.json (default false), schema.d.ts, and the parity tripwire (`EXPECTED_KEYS` + `default === false` assertion).
- `strict` threaded through `NormalizedOptions` (`options.strict ?? false`) and forwarded by the executor: `evaluateResult(result, { maxWarnings, strict })`.
- Full package suite green (329 tests), build compiles, prettier + lint clean on the touched files.

## Task Commits

Each task was committed atomically:

1. **Task 1: strict verdict gate + FLIP/regression tests (TDD)** - `58cbe58` (feat) - RED (FLIP failed) -> GREEN in one commit; the regression + no-escalation tests passed pre-implementation, confirming A1.
2. **Task 2: surface strict on the executor option contract** - `234140b` (feat)
3. **Task 3: thread strict through normalizeOptions + executor** - `f27b687` (feat)

_Note: Task 1 is tdd; the FLIP test was confirmed RED (1 failed) before the one-line core edit turned it GREEN._

## Files Created/Modified
- `packages/angular-typechecker/src/core/evaluate-result.ts` - `strict?: boolean` on `EvaluateOptions`; the `(gatesWarnings || strict)` suppressed-in-graph-WARNING gate; ordered-decision docstring updated.
- `packages/angular-typechecker/src/core/evaluate-result.spec.ts` - the FLIP, the ERROR regression guard, the no-false-escalation cases.
- `packages/angular-typechecker/src/executors/typecheck/schema.json` - `strict` boolean property, default false.
- `packages/angular-typechecker/src/executors/typecheck/schema.d.ts` - `strict?: boolean` on `TypecheckExecutorOptions`.
- `packages/angular-typechecker/src/executors/typecheck/schema-parity.spec.ts` - `EXPECTED_KEYS` gains `'strict'` (sorted); `schema.properties.strict.default === false` assertion.
- `packages/angular-typechecker/src/executors/typecheck/normalize-options.ts` - `strict: boolean` on `NormalizedOptions`; return `strict: options.strict ?? false`.
- `packages/angular-typechecker/src/executors/typecheck/normalize-options.spec.ts` - strict defaults false / forwards true.
- `packages/angular-typechecker/src/executors/typecheck/executor.ts` - destructure `strict`; forward `evaluateResult(result, { maxWarnings, strict })`.
- `packages/angular-typechecker/src/executors/typecheck/executor.spec.ts` - both normalizeOptions mocks carry `strict: false`; the evaluateResult call assertion updated to `{ maxWarnings: undefined, strict: false }`.

## Decisions Made
- **One-gate edit only.** strict changes exactly the dropped-in-graph-WARNING branch; the in-graph ERROR / templateCheckAborted / zero-root-names / warnings-exceeded branches are byte-unchanged except for the docstring. No `strict` in `CoreOptions`/`runTypecheck`/`exit-codes.ts` (dead plumbing per 19-RESEARCH anti-patterns).
- **Defensive default.** `strict = false` in evaluateResult (`{ maxWarnings, strict = false } = options`) and `options.strict ?? false` in normalizeOptions -- strict can only ADD a fail path, never turn a fail into a pass (T-19-01/T-19-02 mitigations preserved).
- **Commit scopes.** Used `core`/`executor` (release-meaningful) rather than `19-01` plan-id scopes, per AGENTS.md scope-hygiene (plan-id scopes leak into the public changelog).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The TDD RED step behaved exactly as A1 predicted: only the FLIP test failed pre-implementation (the ERROR regression guard and the no-false-escalation case already passed, since strict does not change those paths).

## Threat Model Compliance
- **T-19-01 (Tampering, evaluate-result strict gate):** mitigated -- `(gatesWarnings || strict) && suppressedInGraphWarningCount > 0` only adds a fail path; `strict = false` default means absent/malformed input == current behavior.
- **T-19-02 (Tampering, executor threading):** mitigated -- the regression unit test asserts the dropped in-graph ERROR still fails with AND without strict; the FLIP test asserts strict only adds the dropped-WARNING fail.
- **T-19-SC (supply chain):** N/A -- no package installs (pure source + tests on the locked stack).

No new security surface introduced beyond the plan's threat model.

## Known Stubs
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The strict engine change is complete and CI-gate-ready (tests + build + lint + format all green on the touched files).
- Remaining phase-19 SHIP items (Storybook Composition fixture/e2e/docs recipe, README strict/Layout-C/Angular-CLI caveats) are separate plans; this plan delivered only the SB-08 strict item.
- No blockers.

## Self-Check: PASSED

- All modified files verified present on disk.
- All three task commits verified in git history: `58cbe58`, `234140b`, `f27b687`.
- Verdict grep: `gatesWarnings || strict` matches exactly once in evaluate-result.ts.
- schema `strict` present in schema.json (2) + schema.d.ts (1).
- Package suite green (329 tests); build compiles; prettier + lint clean on touched files; no accidental deletions.

---
*Phase: 19-stretch-layout-c-non-ts-story-formats-strict-mode*
*Completed: 2026-07-07*
