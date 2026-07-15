---
phase: 17-input-set-membership-boundary-layout-support
plan: 06
subsystem: core
tags: [integration-test, fixtures, cold-compiler, layout-a, layout-b, input-set-membership, branch-4a]

# Dependency graph
requires:
  - phase: 17-input-set-membership-boundary-layout-support
    provides: "inputTs threaded through the shared finalize()->filterDiagnostics() chokepoint + split suppressed counters (17-03); coverage-incomplete verdict (17-04); loud executor rendering (17-05)"
provides:
  - "Real cold-compiler proof of the phase's 5 success criteria end-to-end (Layout A + Layout B, dirty + clean)"
  - "layout-a-storybook (+ -clean) fixtures: per-project Storybook scaffold regression proof (SB-01)"
  - "layout-b-host (+ -clean) + layout-b-aggregated (+ -clean) + layout-b-dependency fixtures: centralized widened-include host proof (SB-03)"
  - "layout-a.integration.spec.ts + layout-b.integration.spec.ts (4 real-compiler tests)"
affects:
  - "17-07 (D-09.2 external-template attribution tripwire guards the same branch-4a invariant these fixtures exercise)"
  - "Phase 18 (SB-06 full T1-T11 acceptance matrix extends these Layout-A/B fixtures)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Plain-Angular widened-include host reproduces Layout B with NO @storybook/angular install (A2): a file is a story by name/location, the only diagnostics are the planted ones"
    - "Layout-B geometry proves membership (not base-containment): aggregated files + external .html live OUTSIDE the host base dir, kept only via inputTs membership + branch 4a; the dependency lives outside BOTH -> suppressed"

key-files:
  created:
    - fixtures/layout-a-storybook/tsconfig.json
    - fixtures/layout-a-storybook/tsconfig.app.json
    - fixtures/layout-a-storybook/.storybook/tsconfig.json
    - fixtures/layout-a-storybook/src/button.component.ts
    - fixtures/layout-a-storybook/src/button.stories.ts
    - fixtures/layout-a-storybook-clean/** (same shape, clean story)
    - fixtures/layout-b-host/tsconfig.json
    - fixtures/layout-b-host/.storybook/tsconfig.json
    - fixtures/layout-b-aggregated/card.stories.ts
    - fixtures/layout-b-aggregated/card.component.ts
    - fixtures/layout-b-aggregated/card.component.html
    - fixtures/layout-b-dependency/thing.ts
    - fixtures/layout-b-host-clean/** + fixtures/layout-b-aggregated-clean/** (clean host + clean external template)
    - packages/angular-typechecker/src/core/layout-a.integration.spec.ts
    - packages/angular-typechecker/src/core/layout-b.integration.spec.ts
  modified: []

key-decisions:
  - "Layout-B aggregated files placed OUTSIDE the host base dir (fixtures/layout-b-aggregated/, reached via .storybook include ../../layout-b-aggregated/**/*.ts) so the kept aggregated story + external-template rely on input-set MEMBERSHIP + branch 4a, not the base clause -- the geometry that actually exercises the SB-02 fix"
  - "Dependency internal error is TS2339 (distinct from the story's TS2322) so the isolation spec can assert this EXACT code is absent from the reported set (content isolation), while suppressedInGraphErrorCount >= 1 proves it was counted, not silently dropped"

requirements-completed: [SB-01, SB-03]

# Metrics
duration: ~20min
completed: 2026-07-06
---

# Phase 17 Plan 06: Layout-A + Layout-B cold-compiler integration proof Summary

**Proved the phase's 5 success criteria end-to-end against REAL cold-compiler Layout-A (per-project Storybook scaffold) and Layout-B (centralized widened-include host) fixtures -- broken/clean stories fail/pass under both layouts, the aggregated external-`templateUrl` NG8002 kill-shot is kept with its `.html` codeframe + `.ts` relatedInformation owner (branch 4a), a transitive dependency's internal error is content-isolated yet flips the verdict via `suppressedInGraphErrorCount`, and a clean Layout-B host reports `suppressedInGraph == 0` -- with NO `@storybook/angular` install.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-06
- **Tasks:** 3
- **Files created:** 21 (19 fixture files + 2 integration specs)

## Authoritative gate result (this worktree)

- **`NX_DAEMON=false npx nx build angular-typechecker --skip-nx-cache`:** SUCCESS, 0 errors.
- **`NX_DAEMON=false npx vitest run` (full suite):** **304 passed (38 files), 0 failed** (300 base + 4 new Layout-A/B tests). NOTE: on a FIRST run before `nx build`, the 3 pre-existing `gate-a-static.spec.ts` tests fail with `ENOENT` on `dist/.../*.js` (they read BUILT artifacts) -- a build-prerequisite of that spec, NOT a regression from this plan; running `nx build` first makes the full suite green.
- **`NX_DAEMON=false npx nx lint angular-typechecker --skip-nx-cache`:** clean (maxWarnings 0).
- **`npx prettier --check`** on all 21 new files: clean.

## Success criteria coverage (all 5 proven end-to-end)

| Criterion | Where proven | Observed |
|-----------|--------------|----------|
| 1(A) broken/clean story under Layout A | `layout-a.integration.spec.ts` | broken -> TS2322 on `button.stories.ts`, errorCount 1, success false; clean -> 0 errors, outcome clean |
| 1(B) broken aggregated story under Layout B | `layout-b.integration.spec.ts` | TS2322 on aggregated `card.stories.ts` (out-of-host-dir), success false |
| 2 external-`templateUrl` NG8002 kill-shot | `layout-b.integration.spec.ts` | `NG(8002) === -998002` reported on `card.component.html` with a `card.component.ts` `relatedInformation` owner (branch 4a KEPT it; a rootNames-only filter would drop it) |
| 3 dependency isolation (R1) | `layout-b.integration.spec.ts` | dependency's TS2339 ABSENT from diagnostics (content isolation), `suppressedInGraphErrorCount >= 1` with `thing.ts` named, success false; the counter alone drives `coverage-incomplete` |
| 4 clean Layout-B host `suppressedInGraph == 0` | `layout-b.integration.spec.ts` | `suppressedInGraphErrorCount === 0 && suppressedInGraphWarningCount === 0`, incl. its clean external template; outcome clean |
| 5 no Layout-A regression | `layout-a.integration.spec.ts` | `rootNamesCount > 0` + the story error surfaces on the story file (shipped walk still type-checks the story surface) |

## Accomplishments

- Four fixture roots (dirty + clean) for BOTH layouts, plus the shared aggregated/dependency trees, all plain Angular with `strictTemplates: true` extending `../../tsconfig.base.json`. No package installed.
- Layout-B geometry deliberately places the aggregated story, external-template component, and its `.html` OUTSIDE the host base dir so they are kept ONLY via `inputTs` membership (declared rootNames of the widened `.storybook` include) + branch 4a -- and the dependency OUTSIDE both the include and the base so it is suppressed. This exercises the actual SB-02 boundary fix rather than the base-containment fallback.
- Two `*.integration.spec.ts` calling `runTypecheck({ tsConfigPath })` and asserting off `CoreResult` + `evaluateResult`, mirroring the `walk-references.integration.spec.ts` idiom (`findWorkspaceRoot` + `fixtureTsConfig` + `codesOf` + inherited config testTimeout; `NG(8002)` symbolic code from `diagnostic-codes.ts`).

## Task Commits

1. **Task 1: Layout-A + Layout-B cold-compiler fixtures** - `05f227a` (test)
2. **Task 2: Layout-A integration spec (criteria 1(A) + 5)** - `c77e133` (test)
3. **Task 3: Layout-B integration spec (criteria 1(B) + 2 + 3 + 4)** - `2399fe2` (test)

**Plan metadata:** this `docs(17-06)` commit (SUMMARY.md).

## Decisions Made

- **Aggregated files outside the host base dir.** The kill-shot and membership rigor only hold if the kept aggregated files are NOT under `base` (else clause (c) "under base" keeps them regardless of membership). Placing `layout-b-aggregated/` as a sibling of `layout-b-host/` and reaching it via `../../layout-b-aggregated/**/*.ts` makes membership + branch 4a the load-bearing keep path.
- **Distinct dependency error code (TS2339 vs the story TS2322).** Content isolation asserts the dependency's EXACT code is absent from the reported set; using TS2322 (shared with the story) would make that assertion vacuous. `box.missing` yields a clean, unambiguous TS2339.

## Deviations from Plan

None - plan executed exactly as written. (The `gate-a-static.spec.ts` ENOENT on a pre-build run is a documented build-prerequisite of that spec, not a change caused by this plan; no fix was needed beyond running the standard `nx build` before the full-suite gate.)

## Authentication Gates

None.

## Threat Model Coverage

- **T-17-14 (false pass on a real aggregated story error):** mitigated -- the broken-aggregated-story fixture asserts `success === false`; input-set membership keeps the aggregated rootName (Layout-B spec criterion 1(B)).
- **T-17-02 (external-template error silently dropped):** mitigated -- the kill-shot fixture asserts `NG(8002)` is present with its `.html` codeframe + `.ts` relatedInformation owner (Layout-B spec criterion 2). The D-09.2 attribution tripwire (17-07) guards the invariant going forward.
- **T-17-15 (dependency error false verdict):** mitigated -- the isolation fixture asserts the dependency error CODE is absent (content isolation) AND the verdict is non-clean via `suppressedInGraphErrorCount` (Layout-B spec criterion 3).
- **T-17-SC (supply chain):** accepted/N/A -- fixtures are plain Angular, no install.

## Threat Flags

None -- no new security-relevant surface (fixtures + tests only; no endpoints, auth paths, or schema at a trust boundary).

## Known Stubs

None. The `count: 'not-a-number'` / `order: 'not-a-number'` / `box.missing` values are INTENTIONAL planted diagnostics (the fixture inputs under test), not stubs.

## Next Phase Readiness

- The Layout-A/B fixtures are the substrate the Phase-18 SB-06 full T1-T11 acceptance matrix will extend. No blockers.

## Self-Check: PASSED

- `fixtures/layout-a-storybook/tsconfig.json` - FOUND
- `fixtures/layout-a-storybook-clean/tsconfig.json` - FOUND
- `fixtures/layout-b-host/.storybook/tsconfig.json` - FOUND
- `fixtures/layout-b-aggregated/card.component.html` - FOUND
- `fixtures/layout-b-dependency/thing.ts` - FOUND
- `fixtures/layout-b-host-clean/.storybook/tsconfig.json` - FOUND
- `packages/angular-typechecker/src/core/layout-a.integration.spec.ts` - FOUND
- `packages/angular-typechecker/src/core/layout-b.integration.spec.ts` - FOUND
- Commit `05f227a` (test, fixtures) - FOUND
- Commit `c77e133` (test, Layout-A spec) - FOUND
- Commit `2399fe2` (test, Layout-B spec) - FOUND
- Full build 0 errors; full test 304/304 passing; prettier + lint clean

---
*Phase: 17-input-set-membership-boundary-layout-support*
*Completed: 2026-07-06*
