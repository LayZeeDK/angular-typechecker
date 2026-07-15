---
phase: 17-input-set-membership-boundary-layout-support
plan: 02
subsystem: core
tags: [nx, angular, typescript, reference-walk, input-set-membership, rootnames]

# Dependency graph
requires:
  - phase: 13-solution-tsconfig-reference-walk
    provides: walkReferences + WalkResult (rawDiagnostics / rootNamesCount / skippedReferences)
provides:
  - "WalkResult.rootNamePaths: the union of every SURVIVING leaf's DECLARED readConfiguration().rootNames (D-02)"
  - "Surviving-leaves-only accumulation proof (skipped/zero-root-names/out-of-project contribute zero)"
affects:
  - 17-03-run-typecheck-input-set-boundary
  - input-set-membership boundary filter (keep())

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive WalkResult field surfaced from data the loop already holds (parsed.rootNames), never Program-derived"

key-files:
  created: []
  modified:
    - packages/angular-typechecker/src/core/walk-references.ts
    - packages/angular-typechecker/src/core/walk-references.spec.ts

key-decisions:
  - "D-02: rootNamePaths is the DECLARED readConfiguration().rootNames set, NEVER program.getRootFileNames() (no .ngtypecheck.ts shim enters the input set)"
  - "Accumulation lives in the surviving-leaf tail after every continue guard, so non-surviving leaves contribute zero (T-17-06)"

patterns-established:
  - "Surface declared per-leaf rootName PATHS (not just the count) as an additive readonly string[] on WalkResult"

requirements-completed: [SB-02]

# Metrics
duration: 4min
completed: 2026-07-06
---

# Phase 17 Plan 02: Surface declared rootName paths on WalkResult Summary

**WalkResult now carries `rootNamePaths` -- the union of every surviving leaf's DECLARED `readConfiguration().rootNames` -- so plan 17-03 can build the `inputTs` membership set without ever letting a synthetic `.ngtypecheck.ts` shim corrupt it.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-07-06T08:28:00Z (approx)
- **Completed:** 2026-07-06T08:32:26Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `rootNamePaths: readonly string[]` to `WalkResult`, accumulated ONLY in the surviving-leaf tail (after all skip/not-found/zero-root-names `continue` guards) from the `parsed.rootNames` the loop already holds -- never from a Program (D-02 `.ngtypecheck.ts` shim landmine avoided; T-17-05 mitigated).
- Proved surviving-leaves-only accumulation with two unit tests against the existing hand-built `ng` stub / `leaf()` idiom (no cold compiler): a two-surviving-leaf union (one leaf declaring two roots) and a mixed survivor + zero-root-names + out-of-project solution surfacing only the survivor's declared root (T-17-06).

## Task Commits

Each task was committed atomically:

1. **Task 1: accumulate declared rootName paths on WalkResult** - `ec9c0ba` (feat)
2. **Task 2: unit proof of rootNamePaths accumulation** - `ab329b6` (test)

## Files Created/Modified
- `packages/angular-typechecker/src/core/walk-references.ts` - Added `WalkResult.rootNamePaths`, the `rootNamePaths` accumulator, the surviving-leaf-tail `push(...parsed.rootNames)`, and the field in the returned object.
- `packages/angular-typechecker/src/core/walk-references.spec.ts` - Two new tests asserting the declared-rootNames union across surviving leaves and zero contribution from skipped/zero-root-names/out-of-project leaves.

## Decisions Made
None beyond the plan/D-02: surfaced the DECLARED `parsed.rootNames` (never `program.getRootFileNames()`), accumulated strictly in the surviving-leaf tail.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The `-- walk-references` positional does not scope Vitest (it ran the whole suite), so the two new tests were additionally confirmed in isolation via `-t "rootNamePaths"` (2 passed, 254 skipped).

## Verification
- `npx nx test angular-typechecker` (NX_DAEMON=false, --skip-nx-cache): 256 tests passed across 35 files (was 254; +2 new).
- `-t "rootNamePaths"`: exactly 2 tests, both passed, in `walk-references.spec.ts`.
- `prettier --check` on both touched files: clean.
- Acceptance greps: no `getRootFileNames` / `getTsProgram` added; push occurs only in the surviving-leaf tail.

## Threat Model Coverage
- **T-17-05 (Tampering of coverage):** mitigated -- only `parsed.rootNames` (DECLARED set) is surfaced; no Program-derived rootNames, so no `.ngtypecheck.ts` shim enters the input set.
- **T-17-06 (Spoofing via out-of-project leaf):** mitigated -- accumulation is in the surviving-leaf tail after all boundary/skip `continue` guards; unit test proves zero contribution from skipped leaves.

## Next Phase Readiness
- `WalkResult.rootNamePaths` is ready for plan 17-03 to build the `inputTs` union feeding the input-set-membership `keep()` boundary filter.
- No blockers.

## Self-Check: PASSED

- Files exist: `walk-references.ts`, `walk-references.spec.ts`, `17-02-SUMMARY.md` all FOUND.
- Commits exist: `ec9c0ba` (feat), `ab329b6` (test) both FOUND.
- Acceptance grep: the only `getTsProgram().getRootFileNames()` occurrence is the doc comment FORBIDDING it (D-02 landmine note), not a usage -- no Program-derived rootNames added.

---
*Phase: 17-input-set-membership-boundary-layout-support*
*Completed: 2026-07-06*
