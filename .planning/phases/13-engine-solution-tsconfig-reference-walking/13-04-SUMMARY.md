---
phase: 13-engine-solution-tsconfig-reference-walking
plan: 04
subsystem: engine
tags: [angular-compiler-cli, typescript, reference-walk, diagnostics, nx-plugin, core-purity, executor-adapter]

# Dependency graph
requires:
  - phase: 13-engine-solution-tsconfig-reference-walking (Plan 13-03)
    provides: walkReferences + WalkResult + SkippedReference pure core module (invoked at the D-03a split)
  - phase: 13-engine-solution-tsconfig-reference-walking (Plan 13-02)
    provides: upgraded solution-style fixture (app + spec leaves, two distinct planted TS2322) that the walk now type-checks
provides:
  - runTypecheck D-03a three-way split invoking walkReferences (WALK-01 engine integration)
  - CoreResult.skippedReferences? optional field (non-empty-only, mapped from the walk's [])
  - public SkippedReference type re-export from index.ts
  - executor adapter advisory logger.warn per skipped/reclassified reference
affects:
  - Plan 13-05 (integration + executor unit specs over the walk behavior and the new fixtures)
  - Phase 14 (typecheck-configuration generator wires ONE typecheck target relying on this walk)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Three-way D-03a split: references + >=1 in-project leaf -> walk; references + 0 in-project -> 90001 none-in-project; no references -> 90001 empty-project'
    - 'Union feeds the SINGLE existing finalize (solution-dir basePath, includeDeps once); no second dedupe layer'
    - 'skippedReferences threaded non-empty-only via the templateCheckAborted conditional-spread idiom ([] -> undefined)'
    - 'Advisory adapter notice: pure detection field in core, per-reference logger.warn in the executor (verdict unchanged)'

key-files:
  created: []
  modified:
    - packages/angular-typechecker/src/core/run-typecheck.ts
    - packages/angular-typechecker/src/core/config-resolution.integration.spec.ts
    - packages/angular-typechecker/src/index.ts
    - packages/angular-typechecker/src/executors/angular-typecheck/executor.ts

key-decisions:
  - "The walk-branch finalize sources useCaseSensitiveFileNames + realpath from ts.sys (no per-leaf Program is available in runTypecheck; the walk owns and discards each leaf's Program) -- the same filesystem host every leaf used, matching the direct path's realpath fallback"
  - 'skippedReferences re-exported from ./core/walk-references (where the interface lives, per Plan 13-03), on its own export line alongside CoreOptions/CoreResult'
  - 'Rewrote the now-stale config-resolution solution-style block (asserted the pre-walk short-circuit) to assert the walk -- required so existing coverage does not regress against the already-upgraded fixture (Rule 3 blocking fix)'

patterns-established:
  - "Pattern: engine three-way branch classifies zero-rootNames three ways and reuses the direct path's finalize filter args verbatim for the walk union"
  - 'Pattern: optional CoreResult detection field set purely in core, gated presence-AND-non-empty in the adapter, rendered per-entry as an advisory logger.warn'

requirements-completed: [WALK-01]

# Metrics
duration: ~20min
completed: 2026-07-01
---

# Phase 13 Plan 04: runTypecheck reference-walk integration Summary

**runTypecheck now splits the zero-rootNames guard three ways -- references + >=1 in-project leaf awaits walkReferences and feeds the raw union into the SAME single finalize (solution-dir basePath, includeDeps once), threading a non-empty-only skippedReferences onto CoreResult; the executor renders a per-reference advisory logger.warn -- all while the COR-01 direct 500 path and the direct emit-neutralizing override block stay byte-unchanged.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-01
- **Tasks:** 2
- **Files modified:** 4 (0 created)

## Accomplishments

- **Task 1 -- engine wiring (`run-typecheck.ts`):**
  - Replaced the single-branch D-03a `if (parsed.rootNames.length === 0)` guard with the three-way split (L-3 / Spike 004), gated on the SAME references-present predicate `synthesizeZeroRootNamesDiagnostic` uses (`parsed.projectReferences !== undefined && .length > 0`):
    - references + `walk.rootNamesCount > 0` -> `await walkReferences(ng, ts, parsed, options.tsConfigPath)`, then the EXISTING single `finalize` over `[...configDiagnostics, ...walk.rawDiagnostics]` with the direct path's filter args (solution-dir `basePath` via `resolveFilterBasePath`, `includeDeps: options.includeDeps ?? false` once, `useCaseSensitiveFileNames`/`realpath` from `ts.sys`).
    - references + `walk.rootNamesCount === 0` -> `synthesizeZeroRootNamesDiagnostic` (90001, references-present none-in-project message) + attach skippedReferences.
    - no references -> `synthesizeZeroRootNamesDiagnostic` (90001, empty-project message) UNCHANGED.
  - Added `skippedReferences?: readonly SkippedReference[]` to `CoreResult`, threaded non-empty-only via the `templateCheckAborted` conditional-spread idiom (`walk.skippedReferences.length > 0 ? { skippedReferences } : {}`), so the walk's `[]` maps to `undefined`.
  - Imported `walkReferences` + `SkippedReference` from `./walk-references`.
- **Task 2 -- public export + adapter (`index.ts`, `executor.ts`):**
  - `index.ts` re-exports `SkippedReference` from `./core/walk-references` alongside `CoreOptions`/`CoreResult`.
  - `executor.ts` renders a per-reference `logger.warn` AFTER the `templateCheckAborted` block, gated on `result.skippedReferences !== undefined && result.skippedReferences.length > 0`, iterating the array (naming `referencePath` + `reason`) and stating the verdict is unchanged -- advisory only (L-4). No new import (reuses the `@nx/devkit` `logger` at `:2`); ASCII-only.

## Task Commits

Each task was committed atomically:

1. **Task 1: D-03a three-way split + skippedReferences on CoreResult** - `5ac2f0f` (feat)
2. **Task 2: Re-export SkippedReference + executor advisory logger.warn** - `0b8c155` (feat)

## Files Created/Modified

- `packages/angular-typechecker/src/core/run-typecheck.ts` - the three-way D-03a split invoking `walkReferences`; union -> single existing finalize; `skippedReferences?` field on `CoreResult`, threaded non-empty-only.
- `packages/angular-typechecker/src/core/config-resolution.integration.spec.ts` - the stale solution-style block rewritten to assert the walk (see Deviations); COR-01 pinning block byte-unchanged.
- `packages/angular-typechecker/src/index.ts` - re-export of the public `SkippedReference` type.
- `packages/angular-typechecker/src/executors/angular-typecheck/executor.ts` - per-reference advisory `logger.warn` gated on a non-empty `skippedReferences`.

## Decisions Made

- **`ts.sys` host for the walk-branch finalize filter args** (Open Question in RESEARCH Directive 3 -- "any one walked leaf's program"): `runTypecheck` has NO leaf Program in hand (the walk owns and discards each leaf's `performCompilation` result internally and returns only raw diagnostics). Rather than reshape `WalkResult` to expose a first-leaf program, the walk-branch `finalize` sources `useCaseSensitiveFileNames` + `realpath` from `ts.sys` -- the SAME filesystem host every leaf's Program used, and exactly the `realpath` fallback the direct path already uses (`ts.sys.realpath?.(filePath) ?? filePath`). Output-neutral vs. reading a leaf program's host.
- **Thread skippedReferences AFTER finalize returns** (RESEARCH Open Question 2 recommendation): kept `finalize` focused on the diagnostic pipeline and spread `skippedReferences` onto the walk-branch result object, rather than adding a `finalize` param. Mirrors how `templateCheckAborted` is conditionally spread.
- **Re-export `SkippedReference` from `./core/walk-references`** (RESEARCH Directive 2 allowed either source): the interface lives in `walk-references.ts` (Plan 13-03), so the barrel re-exports from there on its own line -- no re-declaration in `run-typecheck.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Rewrote the stale solution-style integration block**

- **Found during:** Task 1 (first `npx nx test` after wiring the walk)
- **Issue:** `config-resolution.integration.spec.ts:124-152` (the `describe('...solution-style guard fires...')` block) still asserted the PRE-walk short-circuit (`rootNamesCount === 0`, `errorCount === 1`, single guard). Plan 13-02 had ALREADY upgraded `fixtures/solution-style` with app + spec leaves + two distinct planted TS2322 and the spec-leaf reference, so once Task 1 wired the walk, the fixture now walks (rootNamesCount > 0, errorCount 2) and the old block failed. The block is the one RESEARCH/PATTERNS explicitly designate for rewrite (SC4). Leaving it asserting the superseded short-circuit would have been a self-inflicted regression against the locked L-3 design.
- **Fix:** Rewrote ONLY that `describe` block to assert the walk per RESEARCH SC4: `rootNamesCount > 0`, `errorCount === 2`, exactly two `TS2322` (`codes.filter(...).length === 2`), the two TS2322 in DISTINCT files (`error.component.ts` vs `error.component.spec.ts`), `skippedReferences` undefined, and the retained TS18003-independence assertion. Updated the file header comment's D-03a bullet to describe the walk. The COR-01 pinning block (`:100-121`) is byte-unchanged (verified: no diff hunk overlaps lines 100-121).
- **Files modified:** `packages/angular-typechecker/src/core/config-resolution.integration.spec.ts`
- **Verification:** `npx nx test angular-typechecker` green (194 tests); `npx nx build angular-typechecker` compiles clean.
- **Committed in:** `5ac2f0f` (Task 1 commit, with the engine change)

**Scope note:** The dedicated walk integration spec + the executor-unit spec + the other five sibling fixtures' assertions (oop / empty / broken-ref / selfref / overlap) are Plan 13-05 (next wave) deliverables, per the plan's own note that "the walk-branch integration BEHAVIOR is proven by specs in Plan 13-05". This plan only rewrote the ONE already-broken block so existing coverage does not regress; it did not add the new walk specs.

---

**Total deviations:** 1 auto-fixed (1 blocking test regression caused by the wave-ordering interaction between the already-landed fixture upgrade and this plan's engine wiring)
**Impact on plan:** Confined to the one stale spec block RESEARCH already scheduled for rewrite. No scope creep; the new walk integration/unit specs remain Plan 13-05's deliverables.

## Byte-unchanged / invariant verification

- COR-01 direct 500 scan/rethrow region: BYTE-UNCHANGED (`git diff` on `run-typecheck.ts` shows no hunk touching the `configInfrastructureFailure` scan/rethrow; the direct nonexistent-config path still throws `TypecheckInfrastructureError` -- its pinning test at `config-resolution.integration.spec.ts:100-121` is untouched and green).
- Direct-path emit-neutralizing `performCompilation` override block: BYTE-UNCHANGED (not in the diff).
- Exactly ONE `ts.sortAndDeduplicateDiagnostics` CALL in `run-typecheck.ts` (`:504`); the two other occurrences are doc-comment mentions. No second dedupe layer added over the union.
- Core purity: 0 `console.` and 0 added `process.` under `packages/angular-typechecker/src/core/**` (the single `process.` occurrence is a pre-existing doc-comment reference at `:134`, unchanged). The `walkReferences` module is pure and Nx-agnostic; logging happens ONLY in the executor adapter.

## Issues Encountered

- None beyond the one blocking test rewrite documented above.

## User Setup Required

None - no external service configuration required; no dependencies added (reuses shipped `typescript` + `@angular/compiler-cli` peers).

## Next Phase Readiness

- WALK-01's engine integration half is complete: a single target pointed at a solution `tsconfig.json` now yields the complete, duplicate-free diagnostic set via the walk. Plan 13-05 adds the dedicated walk integration spec (SC1/SC2/SC3/D-05 over the five sibling fixtures) + the executor-unit spec asserting the advisory `logger.warn`, plus the WALK-02 `nx.json` `production` -> `default` input change (not in this plan's scope).
- `CoreResult.skippedReferences` is public (re-exported); Phase 14's generator relies on the walk behavior, not on this field.
- No blockers.

## Self-Check: PASSED

- `packages/angular-typechecker/src/core/run-typecheck.ts` - FOUND (modified)
- `packages/angular-typechecker/src/core/config-resolution.integration.spec.ts` - FOUND (modified)
- `packages/angular-typechecker/src/index.ts` - FOUND (modified)
- `packages/angular-typechecker/src/executors/angular-typecheck/executor.ts` - FOUND (modified)
- commit `5ac2f0f` (feat, Task 1) - FOUND
- commit `0b8c155` (feat, Task 2) - FOUND
- `npx nx test angular-typechecker` - 194 tests green; `npx nx build angular-typechecker` - clean

---

_Phase: 13-engine-solution-tsconfig-reference-walking_
_Completed: 2026-07-01_
