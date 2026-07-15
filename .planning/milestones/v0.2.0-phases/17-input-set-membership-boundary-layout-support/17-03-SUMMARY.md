---
phase: 17-input-set-membership-boundary-layout-support
plan: 03
subsystem: core
tags: [typescript, angular, run-typecheck, input-set-membership, boundary-filter, split-counters]

# Dependency graph
requires:
  - phase: 17-input-set-membership-boundary-layout-support
    provides: "FilterOptions.inputTs + split FilterResult (17-01); WalkResult.rootNamePaths (17-02)"
provides:
  - "inputTs threaded through the ONE shared finalize() -> buildFinalizeFilter() -> filterDiagnostics() chokepoint for BOTH the walk-union and direct single-leaf paths"
  - "CoreResult exposes suppressedThirdParty + suppressedInGraphErrorCount + suppressedInGraphWarningCount + suppressedInGraphFiles (suppressedCount removed)"
  - "Guard paths (zero-rootNames / no Program) return the four suppressed fields as 0 / []"
  - "Real-compiler proof that an out-of-project first-party .ts suppression increments suppressedInGraph (R1), not a silent drop"
affects:
  - "17-04 (evaluateResult coverage-incomplete gate consumes suppressedInGraph*)"
  - "17-05 (executor renders the split counts)"
  - "17-06/17-07 (Layout-A/B integration fixtures rely on the threaded chokepoint)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One shared finalize->filter chokepoint fed by both entry paths (walk union + direct leaf), differing only in useCaseSensitiveFileNames + inputTs (no walk/direct drift)"
    - "Split suppressed counters carried on CoreResult; verdict decision stays late-bound (17-04)"

key-files:
  created: []
  modified:
    - packages/angular-typechecker/src/core/run-typecheck.ts
    - packages/angular-typechecker/src/core/run-typecheck.integration.spec.ts
    - packages/angular-typechecker/src/core/infra-failure.spec.ts
    - packages/angular-typechecker/src/executors/typecheck/executor.spec.ts
    - packages/angular-typechecker/README.md
    - fixtures/sibling-import/main-lib/tsconfig.lib.json

key-decisions:
  - "Both callers thread inputTs via buildFinalizeFilter (walk -> walk.rootNamePaths; direct -> parsed.rootNames), so a missed path would fail the 17-06 Layout proof (T-17-07 mitigated)"
  - "Aligned the sibling-import fixture with its documented transitive-only design (dropped the declared dependency.ts from files) because a declared rootName is charter-never-dropped under membership (D-02), so the fixture had to be made a genuine transitive dependency to prove suppressedInGraph"

requirements-completed: [SB-02, SB-04]

# Metrics
duration: 30min
completed: 2026-07-06
---

# Phase 17 Plan 03: run-typecheck input-set boundary Summary

**Threaded the `inputTs` union (walk `rootNamePaths` / direct `parsed.rootNames`) through the single `finalize() -> buildFinalizeFilter() -> filterDiagnostics()` chokepoint both entry paths share, and replaced the scalar `CoreResult.suppressedCount` with the split counters (`suppressedThirdParty` + per-category `suppressedInGraph*` + `suppressedInGraphFiles`), turning the intentional wave-1 RED state (2 build errors + 6 walk-references integration failures) fully GREEN.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-07-06T09:05Z (approx)
- **Completed:** 2026-07-06T09:22Z
- **Tasks:** 2
- **Files modified:** 6

## Authoritative gate result (waves 1+2+3 post-migration)

- **`NX_DAEMON=false npx nx build angular-typechecker --skip-nx-cache`:** SUCCESS, 0 errors (the 2 known compile errors at `run-typecheck.ts:510`/`:518` cleared).
- **`NX_DAEMON=false npx nx test angular-typechecker --skip-nx-cache`:** **284 passed (36 files), 0 failed** (was 282 + 2 pre-migration failures). The 6 `walk-references.integration.spec.ts` `TypeError: options.inputTs is not iterable` failures cleared once `inputTs` was threaded; `run-typecheck.integration.spec.ts` + `infra-failure.spec.ts` pass on the split fields.
- **`npx prettier --check`** on all 6 touched files: clean.
- **`npx nx lint angular-typechecker`:** clean (maxWarnings 0).

## Accomplishments
- Added `inputTs: readonly string[]` to `FinalizeFilter` and to `buildFinalizeFilter` (which now takes it as a parameter and threads it into the returned filter). The WALK `>=1 in-project leaf` finalize call passes `walk.rootNamePaths`; the DIRECT single-leaf call passes `parsed.rootNames` -- both into the SAME shared filter (T-17-07: no walk/direct drift).
- `finalize` passes `filter.inputTs` into `filterDiagnostics` via `FilterOptions.inputTs` and reads the four new `FilterResult` fields into locals; guard-path finalize calls (no filter) default all four to `0` / `[]` (T-17-08).
- Replaced `CoreResult.suppressedCount` (interface + the single return site) with `suppressedThirdParty`, `suppressedInGraphErrorCount`, `suppressedInGraphWarningCount`, `suppressedInGraphFiles`. `resolveFilterBasePath` / base-path (D-05, narrowed solution/host dir per D-04a) and the `templateCheckAborted` / `skippedReferences` detection are UNCHANGED; core stays pure.
- Migrated the core specs to the split fields and documented the R1 in-graph classification: a suppressed out-of-project first-party `.ts` asserts `suppressedInGraphErrorCount >= 1` AND its file in `suppressedInGraphFiles`; `includeDeps: true` asserts all four `0` / empty.

## Task Commits

Each task committed atomically:

1. **Task 1: thread inputTs + split CoreResult counters** - `ba56d41` (feat)
2. **Task 2: core specs for the field rename + R1 count semantics** - `250aa02` (test)

**Plan metadata:** this `docs(17-03)` commit (SUMMARY.md).

## Files Modified
- `packages/angular-typechecker/src/core/run-typecheck.ts` - `inputTs` on `FinalizeFilter` + `buildFinalizeFilter`; both call sites thread the union; `finalize` consumes `FilterOptions.inputTs` + the four `FilterResult` fields; `CoreResult` split-counter fields (comments updated).
- `packages/angular-typechecker/src/core/run-typecheck.integration.spec.ts` - split-field assertions on the sibling-import fixture (suppressed sibling -> `suppressedInGraphErrorCount` + `suppressedInGraphFiles`; `includeDeps` -> all four 0/empty).
- `packages/angular-typechecker/src/core/infra-failure.spec.ts` - out-of-basePath NG3004 suppression now asserts `suppressedInGraphErrorCount >= 1`.
- `packages/angular-typechecker/src/executors/typecheck/executor.spec.ts` - `coreResult()` mock builder updated to the four new fields (field-rename cascade).
- `packages/angular-typechecker/README.md` - the documented `CoreResult` shape now lists the split fields (was stale `suppressedCount`).
- `fixtures/sibling-import/main-lib/tsconfig.lib.json` - dropped the declared `../dependency-lib/dependency.ts` from `files` (see Deviations).

## Decisions Made
- **Single shared chokepoint, two threaded unions.** `buildFinalizeFilter` gained `inputTs` as a parameter (the second thing that differs between callers, alongside `useCaseSensitiveFileNames`); `basePath`/`includeDeps`/`realpath` stay identical. This keeps the "one boundary semantics" invariant (T-17-07) structural -- a diverging path could not compile without a second, visibly-different call.
- **README kept honest.** `CoreResult` is a published exported type; its documented field list is part of the shipped package, so the removed `suppressedCount` was corrected in the same feat.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `executor.spec.ts` `coreResult()` builder updated for the CoreResult field rename**
- **Found during:** Task 1 (the full `nx build` type-checks all specs).
- **Issue:** The mock `coreResult()` builder set `suppressedCount: 0`; removing that field from `CoreResult` and adding four required fields made the builder fail to type-check, breaking the whole-package build (the authoritative gate). `executor.spec.ts` is not in the plan's `files_modified`, but the executor rendering itself (17-05) reads none of these fields -- only the test builder needed the rename.
- **Fix:** Replaced `suppressedCount: 0` with the four new fields (`0` / `[]`).
- **Files modified:** packages/angular-typechecker/src/executors/typecheck/executor.spec.ts
- **Committed in:** `250aa02` (Task 2 commit)

**2. [Rule 1 - Bug] README `CoreResult` shape doc referenced the removed `suppressedCount`**
- **Found during:** Task 1 (post-edit `git grep suppressedCount`).
- **Issue:** The published README's `CoreResult` field enumeration listed `suppressedCount`, which the rename removed -- stale API documentation on the shipped artifact, directly caused by this task.
- **Fix:** Updated the enumerated field list to the four split fields.
- **Files modified:** packages/angular-typechecker/README.md
- **Committed in:** `ba56d41` (Task 1 commit)

**3. [Rule 1 - Bug] `sibling-import` fixture declared the dependency it documents as transitive-only**
- **Found during:** Task 2 (the pre-existing `diagnosticsOnFile(dependencyLibSource).toHaveLength(0)` assertion failed -- the sibling diagnostic was now KEPT, length 1).
- **Issue:** `main-lib/tsconfig.lib.json` listed `"../dependency-lib/dependency.ts"` in `files`, so under the NEW input-set-membership rule it was a DECLARED rootName -> a member of `inputTs` -> charter-never-dropped (D-02) -> KEPT. That directly contradicted (a) the fixture's own comments ("pulled into the program only via a `paths` alias", "the default boundary filter must suppress it") and (b) the plan's mandated proof that a sibling suppression increments `suppressedInGraph`. The `files` entry was a directory-containment-era artifact -- harmless under the old proxy (only the file's directory mattered), decisive under membership.
- **Fix:** Removed the declared `dependency.ts` from `files`. It is now reached ONLY via the `@sibling/dependency-lib` `paths` alias imported by `main.component.ts` -- a genuine transitively-imported dependency: not a rootName, not under base, non-`node_modules`, `.ts` -> SUPPRESSED and counted as `suppressedInGraph` (blueprint keep-rule (c) isolation case). The compiler still loads and type-checks the imported module, so its TS2322 still fires and is suppressed (verified: `suppressedInGraphErrorCount >= 1`, file in `suppressedInGraphFiles`). `includeDeps: true` still folds both diagnostics back with all counters 0.
- **Files modified:** fixtures/sibling-import/main-lib/tsconfig.lib.json
- **Impact:** The fixture is referenced only by `run-typecheck.integration.spec.ts` (this plan's file); no other spec affected. This makes the fixture model the exact "transitively-imported dependency -> suppressed (isolation)" case the milestone charter and the plan intend.
- **Committed in:** `250aa02` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking cascade, 2 bug fixes). No architectural changes. No scope creep beyond making the plan's own integration proof valid under the charter-correct membership semantics.

## Authentication Gates

None.

## Threat Model Coverage
- **T-17-07 (walk/direct drift):** mitigated -- `inputTs` threads through the SINGLE shared `finalize -> buildFinalizeFilter -> filterDiagnostics` chokepoint both callers use.
- **T-17-01 (verdict tampering):** inherits 17-01's dual-identity canonicalizer + KEEP-on-throw; base stays the narrowed solution/host dir (D-04a), unchanged here.
- **T-17-08 (a dropped first-party diagnostic reads clean):** mitigated -- guard paths return the four suppressed fields as 0/[]; a real out-of-project first-party suppression increments `suppressedInGraph` (proven by the sibling-import + infra-failure specs), feeding the 17-04 coverage-incomplete gate.

## Threat Flags

None -- no new security-relevant surface (no new endpoints, auth paths, or schema at a trust boundary).

## Known Stubs

None.

## Next Phase Readiness
- `CoreResult` now carries the split counters for 17-04's `evaluateResult` coverage-incomplete gate and 17-05's executor rendering. No blockers.

## Self-Check: PASSED

- `packages/angular-typechecker/src/core/run-typecheck.ts` - FOUND
- `packages/angular-typechecker/src/core/run-typecheck.integration.spec.ts` - FOUND
- `packages/angular-typechecker/src/core/infra-failure.spec.ts` - FOUND
- `packages/angular-typechecker/src/executors/typecheck/executor.spec.ts` - FOUND
- `packages/angular-typechecker/README.md` - FOUND
- `fixtures/sibling-import/main-lib/tsconfig.lib.json` - FOUND
- Commit `ba56d41` (feat) - FOUND
- Commit `250aa02` (test) - FOUND
- Full build 0 errors; full test 284/284 passing; prettier + lint clean

---
*Phase: 17-input-set-membership-boundary-layout-support*
*Completed: 2026-07-06*
