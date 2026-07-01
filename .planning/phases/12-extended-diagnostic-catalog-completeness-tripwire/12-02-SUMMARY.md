---
phase: 12-extended-diagnostic-catalog-completeness-tripwire
plan: 02
subsystem: testing
tags: [angular, compiler-cli, extended-diagnostics, vitest, it-each, fixtures, ng-codes]

# Dependency graph
requires:
  - phase: 12-extended-diagnostic-catalog-completeness-tripwire (Plan 01)
    provides: EXTENDED_DIAGNOSTIC_MEMBERS (the 18-value as-const source of truth) + the type-level completeness tripwire
provides:
  - The 18-row enum-keyed extended-diagnostic it.each catalog of record (exact NG() code + DiagnosticCategory + occurrence count vs real @angular/compiler-cli@22.0.4)
  - The single NG8101 severity-promotion proof (Warning -> Error under defaultCategory error) folded into the catalog
  - 8 new committed fixtures covering the 13 extended members not already covered by existing fixtures
  - One catalog of record (the two duplicate NG8101 specs removed)
affects: [12-03 (baseline sibling table + TESTING.md spec-count update), milestone audit (CAT-01/CAT-02/CAT-04 closure)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Data-driven describe.each catalog keyed on a dependency-free as-const source of truth, with a structure-guard test asserting one row per member in declaration order"
    - "member field typed as (typeof EXTENDED_DIAGNOSTIC_MEMBERS)[number] so a rename forces a compile error in the runtime table too"
    - "D-03 fixture batching: co-locate independent checks in one program; split a member into its own program the moment its exact-count collides"

key-files:
  created:
    - packages/angular-typechecker/src/core/extended-catalog.integration.spec.ts
    - fixtures/extended-batch-expression/ (NG8102/8107/8114/8117/8104/8106)
    - fixtures/extended-batch-structural/ (NG8103 + NG8116)
    - fixtures/extended-ngfor-let/ (NG8105 -- D-03 split)
    - fixtures/extended-batch-fn/ (NG8111/8115/8112)
    - fixtures/extended-skip-hydration/ (NG8108)
    - fixtures/extended-unused-standalone-imports/ (NG8113)
    - fixtures/extended-defer-trigger/ (NG8021)
    - fixtures/extended-content-projection/ (NG8011, two-component)
  modified:
    - packages/angular-typechecker/src/core/extended.angular13.integration.spec.ts (DELETED -- folded)
    - packages/angular-typechecker/src/core/extended.promotion.integration.spec.ts (DELETED -- folded)

key-decisions:
  - "Split NG8105 (missingNgForOfLet) into its own fixture (extended-ngfor-let, CommonModule imported) because a bare *ngFor without CommonModule co-fires NG8103, colliding the batch's NG8103 count (D-03)"
  - "NG8108 (skipHydrationNotStatic) uses the STATIC text-attribute trigger (ngSkipHydration=\"yes\") not the [ngSkipHydration]=\"x\" binding, because the binding co-fires an incidental NG8002 (SCHEMA_INVALID_ATTRIBUTE) Error"
  - "NG8011 is a normal promotable Warning-default row (D-09 CORRECTED); not skipped, never asserted to stay Warning under promotion"
  - "Zero it.skip rows -- all 18 members proven to fire from a static fixture by a real run (RESEARCH A1 confirmed)"

patterns-established:
  - "Every NG assertion routes through NG(code); count by ts.DiagnosticCategory, never by code sign"
  - "Each fixture engineered so its target diagnostic is the ONLY diagnostic, verified by a real runTypecheck probe before the catalog is committed (exception: the gate-b-error NG8109 row asserts only its filtered count -- TS2322 is present by design)"

requirements-completed: [CAT-01, CAT-02, CAT-04]

# Metrics
duration: 14min
completed: 2026-07-01
---

# Phase 12 Plan 02: Extended-diagnostic catalog it.each + promotion proof Summary

**A single enum-keyed 18-row `describe.each` catalog asserting every `ExtendedTemplateDiagnosticName` member by exact NG() code + DiagnosticCategory + occurrence count against real @angular/compiler-cli@22.0.4, plus the one NG8101 Warning->Error promotion proof, backed by 8 new single-diagnostic fixtures, with the two duplicate NG8101 specs folded away.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-01T06:43:57Z
- **Completed:** 2026-07-01T06:57:52Z
- **Tasks:** 3
- **Files modified:** 27 created + 1 spec created + 2 specs deleted

## Accomplishments
- All 18 extended members asserted by exact NG() code + `ts.DiagnosticCategory` + exact occurrence count over committed fixtures against the real compiler (CAT-01), each firing exactly once at Warning by default.
- The single NG8101 severity-promotion proof (Warning -> Error under `extendedDiagnostics.defaultCategory: "error"`) + the count invariant, folded into the catalog (CAT-02, D-08).
- A single data-driven `describe.each` table keyed on `EXTENDED_DIAGNOSTIC_MEMBERS` with introduction-version as a row field (not a per-version file split), plus a structure-guard test proving one row per member in declaration order (CAT-04).
- The two duplicate NG8101 specs (`extended.angular13`, `extended.promotion`) removed via `git rm`; the catalog is now the sole extended-diagnostic catalog of record (D-07).

## Task Commits

Each task was committed atomically:

1. **Task 1: Author the new extended-diagnostic fixtures** - `ad98063` (test)
2. **Task 2: Build the 18-row extended catalog it.each + the NG8101 promotion row** - `86cfc95` (test)
3. **Task 3: Delete the two folded specs; confirm one catalog of record** - `8ff2fe3` (test)

_Note: The fixture-verification loop (fix-and-reprobe) happened inside Task 1 before its single commit; Task 2 was authored GREEN because the fixtures were pre-verified via a throwaway probe spec._

## Files Created/Modified
- `packages/angular-typechecker/src/core/extended-catalog.integration.spec.ts` - The 18-row enum-keyed `describe.each` catalog (exact NG code + category + count per member) + the structure guard + the NG8101 promotion `it` block + the count invariant.
- `fixtures/extended-batch-expression/` - Batch A: NG8102, NG8107, NG8114, NG8117, NG8104, NG8106 (each once, Warning).
- `fixtures/extended-batch-structural/` - Batch B: NG8103 (`*ngIf` no CommonModule) + NG8116 (unknown structural directive).
- `fixtures/extended-ngfor-let/` - NG8105 (`*ngFor` missing `let`, CommonModule imported so NG8103 does not co-fire) -- D-03 split from Batch B.
- `fixtures/extended-batch-fn/` - Batch C: NG8111 (event binding), NG8115 (`@for` track), NG8112 (`@let` unused).
- `fixtures/extended-skip-hydration/` - NG8108 (`ngSkipHydration="yes"` static text attribute).
- `fixtures/extended-unused-standalone-imports/` - NG8113 (a standalone `imports: [X]` never used in the template).
- `fixtures/extended-defer-trigger/` - NG8021 (`@defer (on immediate; on timer(1s))`).
- `fixtures/extended-content-projection/` - NG8011 (two-component: parent projects an `@if` block with >1 root node into the child's `<ng-content>`).
- `packages/angular-typechecker/src/core/extended.angular13.integration.spec.ts` - DELETED (NG8101 Warning-default assertion folded into the catalog).
- `packages/angular-typechecker/src/core/extended.promotion.integration.spec.ts` - DELETED (NG8101 promotion + invariant folded into the catalog).

## Decisions Made
- **D-03 split of NG8105 into its own fixture.** A real run showed a bare `*ngFor="items"` without CommonModule raises NG8103 a SECOND time in addition to NG8105, colliding the structural batch's NG8103 count. NG8105 only fires cleanly (without an extra NG8103) when CommonModule IS imported, so it lives in `fixtures/extended-ngfor-let/` (the plan explicitly permits a D-03 split on count collision).
- **NG8108 uses the static-text-attribute trigger.** A `[ngSkipHydration]="x"` property binding co-fires an incidental NG8002 (SCHEMA_INVALID_ATTRIBUTE) Error on both DOM and component hosts (verified by probe). The static `ngSkipHydration="yes"` text-attribute branch of the same check (bundle line 3335) fires NG8108 alone, keeping the count clean.
- **NG8011 is a normal promotable Warning-default row (D-09 CORRECTED).** It is not `it.skip`-ped, not framed as "not promotable," and nothing asserts it stays a Warning under `defaultCategory: "error"`.
- **Zero `it.skip` rows.** RESEARCH A1 projected zero skips; a real run confirmed all 18 members fire from a static fixture. The `skipReason`/`it.skip` gate is still present in the table so a future non-reproducible member can be represented honestly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] NG8105 fixture split out to avoid an NG8103 count collision**
- **Found during:** Task 1 (fixture authoring, verified via a throwaway probe spec)
- **Issue:** The planned `fixtures/extended-batch-structural/` combined `*ngIf` (NG8103), an unknown structural directive (NG8116), and `*ngFor` missing `let` (NG8105). A real run showed the bare `*ngFor` (no CommonModule) ALSO raised NG8103 -- NG8103 fired twice, so an exact-count assertion of NG8103 == 1 would fail.
- **Fix:** Removed `*ngFor` from the structural batch and created a new own-program fixture `fixtures/extended-ngfor-let/` that imports CommonModule (so NG8103 does not fire) and uses `*ngFor="item of items"` missing `let` -> NG8105 == 1 clean. The catalog row for `missingNgForOfLet` maps to this new fixture. `files_modified` gained the 3 `extended-ngfor-let/*` files (D-03 explicitly permits splitting on a count collision).
- **Files modified:** fixtures/extended-batch-structural/{error.component.ts,error.component.html}, fixtures/extended-ngfor-let/* (new)
- **Verification:** probe run shows extended-batch-structural = {NG8103 x1, NG8116 x1} and extended-ngfor-let = {NG8105 x1}, all Warning, no incidental errors.
- **Committed in:** `ad98063` (Task 1 commit)

**2. [Rule 1 - Bug] NG8108 fixture switched to the static-text-attribute trigger**
- **Found during:** Task 1 (fixture authoring, verified via probe)
- **Issue:** The plan's suggested `[ngSkipHydration]="x"` binding trigger fired NG8108 but ALSO an incidental NG8002 (SCHEMA_INVALID_ATTRIBUTE) as an Error -- polluting the "target diagnostic is the ONLY diagnostic" invariant. Moving the binding onto a component host did not remove the NG8002.
- **Fix:** Switched to the check's OTHER branch (bundle line 3335): a static text attribute `ngSkipHydration="yes"` with a non-accepted value. This fires NG8108 alone (no NG8002). Documented the reason in the fixture header.
- **Files modified:** fixtures/extended-skip-hydration/{error.component.ts,error.component.html}
- **Verification:** probe run shows extended-skip-hydration = {NG8108 x1, Warning}, errorCount 0.
- **Committed in:** `ad98063` (Task 1 commit)

**3. [Rule 1 - Bug] NG8114 expression made genuinely nullable to avoid a co-firing NG8102**
- **Found during:** Task 1 (fixture authoring, verified via probe)
- **Issue:** The initial Batch A NG8114 expression (`flag && other ?? 'fallback'`) had a non-nullable `??` left side, so NG8102 (nullishCoalescingNotNullable) ALSO fired -- NG8102 count was 2, not 1.
- **Fix:** Used a genuinely nullable member (`maybeNull: string | null`) so the `??` LHS (`flag && maybeNull`) can be null, keeping NG8102 from firing on the NG8114 line. Each Batch A code now fires exactly once.
- **Files modified:** fixtures/extended-batch-expression/{error.component.ts,error.component.html}
- **Verification:** probe run shows extended-batch-expression = {NG8102, NG8107, NG8114, NG8117, NG8104, NG8106 -- each x1, Warning}.
- **Committed in:** `ad98063` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 -- fixture-count bugs discovered during real-run verification)
**Impact on plan:** All three were necessary to satisfy the plan's own hard constraint (each fixture's target diagnostic is the ONLY diagnostic, deterministic exact count -- CAT-01). The NG8105 split added one fixture directory (D-03-sanctioned). No scope creep; the catalog surface and requirements are unchanged.

## Issues Encountered
- The `--skip-nx-cache -- extended-catalog.integration` argument narrowed the reporter's file scope but Vitest still ran the full plugin suite; this is a known Nx/Vitest passthrough behavior and does not affect correctness -- the catalog spec's 21 tests (1 structure guard + 18 rows + 2 promotion) all pass, and the full suite is green (173 tests, 25 files).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CAT-01, CAT-02, CAT-04 are satisfied by the catalog of record. Plan 03 (this same wave) adds the sibling baseline TS/NG code `it.each` table (CAT-03), folds `baseline.angular13.integration.spec.ts`, and updates the TESTING.md spec-count (was 10 integration files; this plan removed 2 extended specs and added 1 catalog spec -- Plan 03 lands the combined accurate delta).
- The `typecheck-drift` target still passes: the catalog and the type-level tripwire both consume `EXTENDED_DIAGNOSTIC_MEMBERS` and are in lockstep.
- Post-merge gate (per AGENTS.md): run the full build + test on the merged main checkout after this wave's plans merge, since per-plan self-checks cannot catch cross-plan integration breaks.

## Self-Check: PASSED

- All created files exist on disk (catalog spec, 8 fixture directories, this SUMMARY).
- Both folded specs confirmed deleted (extended.angular13, extended.promotion).
- All 3 task commits exist: `ad98063`, `86cfc95`, `8ff2fe3`.
- `npx nx test angular-typechecker --skip-nx-cache` green (25 files, 173 tests); `npx nx typecheck-drift angular-typechecker` green.

---
*Phase: 12-extended-diagnostic-catalog-completeness-tripwire*
*Completed: 2026-07-01*
