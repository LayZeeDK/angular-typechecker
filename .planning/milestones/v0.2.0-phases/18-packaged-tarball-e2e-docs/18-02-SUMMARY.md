---
phase: 18-packaged-tarball-e2e-docs
plan: 02
subsystem: testing
tags: [integration-test, storybook, layout-b, paths-alias, zero-root-names, boundary-semantics]

# Dependency graph
requires:
  - phase: 17-input-set-membership-boundary-layout-support
    provides: "the shipped input-set-membership boundary engine (walk -> inputTs union -> keep -> split counter -> three-state clean/coverage-incomplete/type-error verdict); ZERO_ROOT_NAMES_DIAGNOSTIC_CODE (90001) guard; fixtures/layout-b-* shapes"
provides:
  - "T9 (criterion 2): a paths-aliased aggregated import compiles clean -- no spurious TS2307, verdict clean"
  - "T6: a story-less/flat config surfaces the 90001 guard and FAILS -- never a silent clean pass (board D-7)"
  - "T10: explicit no-ZERO_ROOT_NAMES (90001) assertion on the layout-b host-story-error flow"
  - "fixtures/layout-b-paths-alias (+ -lib, -aggregated) and fixtures/story-less-flat -- reusable boundary-semantics fixtures"
affects: [18-04 e2e criterion-1 (proves the same boundary semantics on the shipped tarball), milestone SB-06 acceptance matrix]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Layout-B host fixture shape (files:[], references:[.storybook/tsconfig.json]) with a widened cross-project include, mirroring fixtures/layout-b-host"
    - "paths alias declared directly in .storybook/tsconfig.json (resolves relative to the declaring config, no baseUrl) so the aliased import is load-bearing"
    - "verify-then-extend: confirm existing coverage via git grep before adding a residual test (T5 confirmed pre-covered, no new test)"

key-files:
  created:
    - fixtures/layout-b-paths-alias/tsconfig.json
    - fixtures/layout-b-paths-alias/.storybook/tsconfig.json
    - fixtures/layout-b-paths-alias-aggregated/card.stories.ts
    - fixtures/layout-b-paths-alias-lib/button.ts
    - fixtures/story-less-flat/tsconfig.json
    - packages/angular-typechecker/src/core/paths-alias.integration.spec.ts
    - packages/angular-typechecker/src/core/story-less-guard.integration.spec.ts
  modified:
    - packages/angular-typechecker/src/core/layout-b.integration.spec.ts

key-decisions:
  - "T5 verified genuinely pre-covered by two existing filter-diagnostics.spec.ts cases; NO new test added (verify-then-extend, plan-sanctioned skip)"
  - "T9 paths alias declared directly in .storybook/tsconfig.json (contains 'paths', resolves unambiguously relative to that dir) rather than in a fixture base -- the alias is load-bearing (removing it emits TS2307)"
  - "T6 fixture is the direct-flat (no-references) shape, so it asserts the 90001 empty-project guard specifically (not the references-only coverage-incomplete branch)"

metrics:
  tasks_completed: 3
  files_created: 7
  files_modified: 1
  duration_minutes: 20
  completed_date: 2026-07-06
---

# Phase 18 Plan 02: Residual T-matrix boundary-semantics fixtures (T9/T6/T5/T10) Summary

Filled the residual SB-06 T-matrix gaps against the already-shipped Phase-17 engine with fast in-repo integration fixtures: T9 (paths-alias aggregated import compiles clean, criterion 2), T6 (story-less/flat config is not a silent clean pass), a thin T10 no-90001 assertion, and a verify-then-extend confirmation that T5 is already covered. No engine code touched -- this plan tests the shipped boundary semantics as-is; Phase-17's T1/T2/T3/T4/T7/T8 proofs were NOT duplicated.

## What Was Built

- **T9 (criterion 2)** -- `fixtures/layout-b-paths-alias/` is a Layout-B host (`files:[]`, references only `./.storybook/tsconfig.json`) whose widened `.storybook` include reaches an aggregated story (`fixtures/layout-b-paths-alias-aggregated/card.stories.ts`) that imports a sibling (`fixtures/layout-b-paths-alias-lib/button.ts`) ONLY through a `@org/*` workspace `paths` alias. `paths-alias.integration.spec.ts` runs `runTypecheck` over the host solution tsconfig and asserts `result.diagnostics.every(d => d.code !== 2307)` (no spurious module-not-found), `evaluateResult(result).outcome === 'clean'`, and `rootNamesCount > 0`.
- **T6 (board D-7 guard)** -- `fixtures/story-less-flat/tsconfig.json` is a flat config (no `references`, no `files`) whose `include` globs `*.stories.ts` in a dir with none, so it resolves zero declared input files. `story-less-guard.integration.spec.ts` asserts the `ZERO_ROOT_NAMES_DIAGNOSTIC_CODE` (90001) guard fires and `evaluateResult(result).success === false` -- never a silent clean pass.
- **T10 (thin)** -- added one explicit assertion to the existing `layout-b.integration.spec.ts` broken-host case that `result.diagnostics.every(d => d.code !== 90001)` -- the `.storybook`-only host fails on a real story error, not the empty-project guard (traceability for "not empty-project 90001").
- **T5 (verify-then-extend)** -- confirmed pre-covered; no new test (see Deviations).

## How to Verify

```
npx nx test angular-typechecker
```

All 43 test files / 321 tests pass (including the two new integration specs and the extended layout-b flow). Lint (`npx nx lint angular-typechecker`) and Prettier are clean.

## Deviations from Plan

### T5 skipped as genuinely pre-covered (verify-then-extend, plan-sanctioned)

- **Found during:** Task 3.
- **Verification:** `git grep suppressedThirdParty` / `includeDeps` over `filter-diagnostics.spec.ts`.
- **Result:** The T5 claim ("a node_modules-attributed diagnostic is suppressed by default AND counted in `suppressedThirdParty>0` AND folded back under `includeDeps`") is already proven by two existing cases:
  - `filter-diagnostics.spec.ts` line 61 `'keeps in-graph ..., splits out-of-graph .ts vs node_modules (D-05, SB-04)'` -- a `/ws/proj/node_modules/x/y.d.ts` diagnostic is suppressed by default with `suppressedThirdParty === 1` and NOT in `kept`.
  - `filter-diagnostics.spec.ts` line 484 `'includeDeps: true folds everything back, all suppressed counters 0 (D-07, EXE-04)'` -- a `/ws/proj/node_modules/y/z.d.ts` diagnostic is folded back (`kept` length 4 includes it) with `suppressedThirdParty === 0`.
- **Action:** No redundant test added; `filter-diagnostics.spec.ts` left untouched. The plan's verify-then-extend directive explicitly sanctions this ("if already covered, the SUMMARY names the covering test and no new test is added").

### [Rule 3 - Blocking] Prettier format fix on the T9 spec

- **Found during:** post-task format:check (required CI gate at `maxWarnings:0`).
- **Issue:** the T9 `every(...)` assertion exceeded Prettier's print width; `format:check` would have failed CI.
- **Fix:** `prettier --write` re-wrapped the expression; committed as `style(18-02)` (f284d43).

## Self-Check: PASSED

- Files created/modified all present on disk (verified below).
- All four commits present in git history.

## Commits

- `8340cf8` test(18-02): prove paths-alias aggregated import compiles clean (T9)
- `05f266d` test(18-02): prove story-less/flat config is not a silent clean pass (T6)
- `a0f1726` test(18-02): assert no ZERO_ROOT_NAMES (90001) on the layout-b host-story-error flow (T10)
- `f284d43` style(18-02): prettier-format the T9 paths-alias spec assertion wrap

## Notes for Downstream

- SB-06 is NOT marked milestone-complete here -- it is shared across 18-01/02/03/04 and closes at phase verification.
- The new fixtures follow the `fixtures/layout-b-*` shapes and are available for reuse by the 18-04 e2e tier.
