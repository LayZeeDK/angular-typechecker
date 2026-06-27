# Phase 3 Deferred Items

Out-of-scope discoveries logged during execution. These are NOT introduced by the
current plan's changes; do NOT fix them as part of this plan (SCOPE BOUNDARY rule).

## Pre-existing lint problems (observed during 03-01 execution, 2026-06-28)

Baseline `npx nx lint angular-typechecker` reports 4 problems, ALL in files NOT
touched by plan 03-01:

- `src/core/compiler-cli-types.ts:15:1` and `:20:1` -- `@nx/enforce-module-boundaries`
  "External resources cannot be imported using a relative or absolute path". This is
  the documented nodenext deep-import workaround (the file header explains why the
  barrel `index.d.ts` cannot be used under nodenext). Pre-existing since Phase 1/2.
- `src/core/config-resolution.integration.spec.ts:30:7` -- `@typescript-eslint/no-unused-vars`
  `'NG' is assigned a value but never used` (warning). Pre-existing (Phase 2 02-02).
- `src/executors/angular-typecheck/executor.ts:16:3` -- `@typescript-eslint/no-unused-vars`
  `'_context' is defined but never used` (warning). Pre-existing (Phase 1).

Plan 03-01's new files (`filter-diagnostics.ts`, `filter-diagnostics.spec.ts`) and
its edits (`run-typecheck.ts`, `run-typecheck.integration.spec.ts`) introduce ZERO
new lint problems. WS-04 (the `core/**` import-ban override + a clean lint gate) is
owned by plan 03-02 per the phase plan; the lint-cleanliness gate (SC5) is a
phase-level criterion resolved there.
