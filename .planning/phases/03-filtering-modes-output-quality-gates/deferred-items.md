# Phase 3 - Deferred / Out-of-Scope Discoveries

Items discovered during execution that are OUT OF SCOPE for the discovering plan
(SCOPE BOUNDARY rule: only auto-fix issues DIRECTLY caused by the current task).

## Discovered during plan 03-03 (formatter slice)

### Pre-existing `npx nx lint angular-typechecker` failures (NOT introduced by 03-03)

`npx nx lint angular-typechecker` is RED on the Phase-3 base commit
(`7faa425`), independent of plan 03-03's changes:

1. `@nx/enforce-module-boundaries` ERROR x2 in
   `packages/angular-typechecker/src/core/compiler-cli-types.ts` lines 15 and 20:
   "External resources cannot be imported using a relative or absolute path".
   - These fire on the deep-relative `import type` paths
     (`../../../../node_modules/@angular/compiler-cli/src/...`) that are the
     documented nodenext-safe shim (see the file header). Line 15
     (`transformers/api`) was added in Phase 2 and is UNTOUCHED by 03-03 yet
     errors identically -- proving the violation is pre-existing, not caused by
     03-03's one-line `formatDiagnostics` addition to the line-20 block.
   - Resolution owner: plan 03-04 (wave 2) owns WS-04 and the "lint passes clean"
     gate. The deep-import shim needs either an `@nx/enforce-module-boundaries`
     `allow`/override entry or an eslint-disable on the shim, decided in 03-04.

2. `@typescript-eslint/no-unused-vars` WARNING x2 (pre-existing, unrelated files):
   - `src/core/config-resolution.integration.spec.ts:30` -- `'NG'` assigned but
     never used.
   - `src/executors/angular-typecheck/executor.ts:16` -- `'_context'` defined but
     never used (the Phase-1 stub executor).

Plan 03-03's own new files (`format-report.ts`, `format-report.spec.ts`) are
lint-clean. The build (`npx nx build angular-typechecker`) and the full unit
suite (`npx nx test angular-typechecker`, 50/50) are green.
