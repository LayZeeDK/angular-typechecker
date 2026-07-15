---
phase: 17-input-set-membership-boundary-layout-support
plan: 01
subsystem: core
tags: [typescript, angular-compiler-cli, diagnostics, boundary-filter, input-set-membership, dual-identity]

# Dependency graph
requires:
  - phase: 16-storybook-type-check-gate-spike-gated-go-no-go
    provides: gate verdict GO + branch 4a lock + readConfiguration().rootNames declared-set nuance
provides:
  - "keep(diagnostic, inputSet, options): pure boolean boundary decision reading only public ts.Diagnostic fields"
  - "Dual-identity input-set membership (raw + realpath forms) so a declared rootName is never dropped on a transient realpath throw"
  - "createRawCanonicalizer (slash + case-fold, no realpath, never throws)"
  - "External-template branch 4a resolving the owning component .ts via public ts.Diagnostic.relatedInformation"
  - "FilterResult split: suppressedThirdParty + per-category suppressedInGraphErrorCount/WarningCount + advisory suppressedInGraphFiles (suppressedCount removed)"
  - "FilterOptions.inputTs (declared rootName .ts paths)"
  - "Structural no-ngtsc-internals gate spec (D-01, criterion 5)"
affects: ["17-03 (run-typecheck threads inputTs + maps the split fields)", "17-04 (evaluate-result/exit-codes coverage-incomplete gate)", "17-05 (executor renders the counts)", "17-06/17-07 (layout + tripwire integration fixtures)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-identity path membership (raw pre-realpath form + full realpath form) for fail-safe declared-root matching"
    - "Detection-in-core / rendering-in-adapter split preserved: core stays pure (no console/process), per-category counts carried for late-bound verdict"
    - "Structural denylist gate: read a source module from disk and assert zero forbidden internal tokens (public-API-only enforcement)"

key-files:
  created:
    - packages/angular-typechecker/src/core/filter-diagnostics.structural.spec.ts
  modified:
    - packages/angular-typechecker/src/core/filter-diagnostics.ts
    - packages/angular-typechecker/src/core/filter-diagnostics.spec.ts

key-decisions:
  - "Membership checked BEFORE node_modules (D-02 charter: a declared root is never dropped) -- equivalent to research b-before-c for real inputs since a rootName is never under node_modules"
  - "Replaced FilterResult.suppressedCount outright (D-07) rather than keeping it as an additive sum -- the caller update is wave-2 (17-03)"
  - "Category enum read as numeric literals (Warning=0/Error=1) since the module import type's ts; verified against typescript@6.0.3"
  - "Branch (d)/4a matches the owning .ts by EXTENSION only, never the locale-fragile English message text"

patterns-established:
  - "Pattern 1: keep() ordered decision tree (a, membership, a', b, c, else-.ts, 4a)"
  - "Pattern 2: one shared canonicalizer pair (full + raw) for both inputSet and diagnostic files (T8 symmetry)"

requirements-completed: [SB-02, SB-04]

# Metrics
duration: 30min
completed: 2026-07-06
---

# Phase 17 Plan 01: keep() input-set-membership boundary Summary

**Replaced the directory-containment diagnostic filter with a pure dual-identity input-set-membership `keep()` (raw + realpath forms), external-template branch 4a via public `relatedInformation`, and a split suppressed counter (third-party vs per-category in-graph), guarded by a structural no-ngtsc-internals gate.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-07-06T08:34Z
- **Completed:** 2026-07-06T09:00Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Extracted a pure `keep(diagnostic, inputSet, options): boolean` from the inline loop, implementing branches a -> membership -> a' -> b (node_modules) -> c (narrowed base, D-04a) -> else-`.ts` (dependency isolation) -> d/4a (external template owner via public `relatedInformation`).
- Implemented DUAL-IDENTITY membership: each declared rootName stored under both a raw (no-realpath, never-throws) and full (realpath) canonical form; a diagnostic is kept if either of its forms hits either stored form. This recovers a declared root whose realpath transiently throws (matched via raw) so a real error on a declared file is never silently dropped (D-02).
- Added `createRawCanonicalizer` and `FilterOptions.inputTs`; replaced the single silent `suppressedCount` with `suppressedThirdParty` + per-category `suppressedInGraphErrorCount`/`suppressedInGraphWarningCount` + advisory `suppressedInGraphFiles` (D-05/D-07).
- Full unit tier (38 tests) proving every `keep()` branch, dual-identity realpath-throw recovery, T8 junction symmetry, per-category split, and includeDeps fold-back; plus a structural gate (7 tests) asserting zero ngtsc/component-registry/`@angular/compiler-cli` tokens in the module (D-01, criterion 5).

## Task Commits

Each task was committed atomically:

1. **Task 1: keep() + dual-identity input set + branch 4a + split counter** - `9d66475` (feat)
2. **Task 2: keep() unit tier + counter-split coverage** - `16457af` (test)
3. **Task 3: structural no-ngtsc-internals gate spec** - `14a9bab` (test)

**Plan metadata:** this `docs(17-01)` commit (SUMMARY.md).

_Task 1 was `tdd="true"`; per the plan's task split the implementation landed first (Task 1) and its proving tests in Task 2. The implementation was verified green against the Task 2 + Task 3 specs before those tests were committed._

## Files Created/Modified
- `packages/angular-typechecker/src/core/filter-diagnostics.ts` - `keep()`, `createRawCanonicalizer`, dual-identity `inputSet` build, branch 4a `owningComponentTs`, split `FilterResult`; `createCanonicalizer`/`isNodeModulesPath`/`isUnderDir` reused unchanged.
- `packages/angular-typechecker/src/core/filter-diagnostics.spec.ts` - migrated every `suppressedCount` assertion to the split fields; added membership, 4a (3 sub-cases), dual-identity recovery, T8 symmetry, per-category split, and direct `keep()` branch coverage.
- `packages/angular-typechecker/src/core/filter-diagnostics.structural.spec.ts` - NEW disk-read denylist gate over the source module.

## Decisions Made
- **Membership before node_modules:** the `<behavior>` order (dual-identity FIRST) is honored over research Pattern 1's b-before-c; they are equivalent for real inputs (a rootName is never under `node_modules`) and the chosen order makes the "declared root never dropped" charter structural.
- **Clean replacement of `suppressedCount`:** followed the plan's D-07 mandate to remove the scalar outright; the additive-sum alternative was explicitly rejected by the plan.
- **`ts.DiagnosticCategory` values:** confirmed against installed `typescript@6.0.3` (`Warning=0, Error=1, Suggestion=2, Message=3`). The pre-existing `diag()` helper comment mislabeled `0` as "Error"; the new counter split reads `category`, so tests set categories explicitly and default `diag()` to Error (1).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reworded doc comments to satisfy the structural gate**
- **Found during:** Task 3 (structural gate spec)
- **Issue:** My own Task 1 doc comments in `filter-diagnostics.ts` used the words "ngtsc" and "@angular/compiler-cli" while describing what the module must NOT do. The plan's denylist scan is a whole-file substring match (code AND comments), so those comments would trip the gate.
- **Fix:** Reworded three comment lines to "compiler-internal APIs" / "the installed TypeScript 6.0.3 + Angular 22.0.4 compiler sources" (no code change), then Prettier-formatted.
- **Files modified:** packages/angular-typechecker/src/core/filter-diagnostics.ts
- **Verification:** `git grep -nE 'ngtsc|componentRegistry|ComponentScopeReader|getSourceFiles|TemplateTypeChecker|@angular/compiler-cli'` on the file returns nothing; the structural gate's 7 tests pass.
- **Committed in:** `14a9bab` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking, comment-only).
**Impact on plan:** No behavior change, no scope creep -- a comment reword required to make the plan's own gate pass.

## Issues Encountered

- **`nx test` triggers the whole-project build (a cross-wave integration state, NOT a defect in this plan).** The `test` target `dependsOn: build`, and `@nx/js:tsc` typechecks the entire package -- including `run-typecheck.ts`, which still calls `filterDiagnostics` with the old shape (no `inputTs`, reads `suppressedCount`). Removing `suppressedCount` and adding the required `inputTs` is an intentional breaking API change whose CALLER is threaded in plan **17-03** (wave 2, `depends_on: ["17-01","17-02"]`). `run-typecheck.ts` is NOT in this plan's `files_modified`; touching it here would collide with 17-03. Per AGENTS.md, per-worktree self-checks cannot catch cross-plan integration breaks -- the authoritative gate is the full build+test on the MERGED wave. This plan's three touched files were therefore verified directly with `npx vitest run --config packages/angular-typechecker/vitest.config.mts filter-diagnostics` (bypassing the `nx build` dependency): **45 tests pass (38 unit + 7 structural)**. The exact two remaining build errors are `run-typecheck.ts:510` (missing `inputTs`) and `run-typecheck.ts:518` (`suppressedCount` removed) -- both resolved by 17-03.

## Threat Flags

None - no new security-relevant surface. The plan's threat mitigations T-17-01 (dual-identity + keep-on-throw), T-17-02 (unmappable `.html` default-KEEP), and T-17-03 (public-API-only + structural gate) are all implemented and unit-proven.

## Known Stubs

None.

## Next Phase Readiness
- `keep()`, `createRawCanonicalizer`, `FilterOptions.inputTs`, and the split `FilterResult` are ready for wave-2 plan 17-03 to thread `inputTs` through `run-typecheck.ts` and map the new counters onto `CoreResult`.
- **Blocker for merge order:** 17-03 MUST land (or be co-merged) to restore a green whole-project build -- this plan intentionally leaves `run-typecheck.ts` referencing the old API. Wave 1's 17-02 (walk-references `rootNamePaths`) is the other half that feeds `inputTs`.

## Self-Check: PASSED

- `packages/angular-typechecker/src/core/filter-diagnostics.ts` - FOUND (modified)
- `packages/angular-typechecker/src/core/filter-diagnostics.spec.ts` - FOUND (modified)
- `packages/angular-typechecker/src/core/filter-diagnostics.structural.spec.ts` - FOUND (created)
- Commit `9d66475` (feat) - FOUND
- Commit `16457af` (test) - FOUND
- Commit `14a9bab` (test) - FOUND
- Unit + structural specs: 45/45 passing via direct vitest
- Denylist scan on `filter-diagnostics.ts`: zero matches (including `NgtscProgram`)

---
*Phase: 17-input-set-membership-boundary-layout-support*
*Completed: 2026-07-06*
