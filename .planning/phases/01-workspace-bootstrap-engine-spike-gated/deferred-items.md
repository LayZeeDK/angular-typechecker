# Deferred Items - Phase 01 (workspace-bootstrap-engine-spike-gated)

Out-of-scope discoveries logged during execution. These are NOT fixed in the
plan that found them (scope boundary: only auto-fix issues directly caused by the
current task's changes).

## Discovered during Plan 01-04 (GATE A/B spec suite)

### Pre-existing `nx lint angular-typechecker` findings (NOT caused by 01-04)

`nx lint` is not part of Plan 01-04's verification gate (`nx build && nx test`),
and ESLint enforcement (ESLint + `@nx/dependency-checks` + module-boundary
enforcement, WS-04) is explicitly deferred to Phase 3 per D-14 / CONTEXT.md
"Deferred Ideas". These findings pre-date 01-04; the two new gate spec files add
zero lint findings.

1. **`src/core/compiler-cli-types.ts:15` and `:19` (2 errors,
   `@nx/enforce-module-boundaries`):** "External resources cannot be imported
   using a relative or absolute path." These are the DELIBERATE deep relative
   imports into `node_modules/@angular/compiler-cli/src/...` that Plan 01-03's
   type-only nodenext shim requires (the barrel `index.d.ts` does not resolve
   under `module: nodenext`; see 01-03-SUMMARY deviation 1 and
   01-RESEARCH-ADDENDUM-WAVE3 Finding 1). The shim is the accepted, isolated,
   type-only workaround. Resolution options for Phase 3 (WS-04): add a scoped
   `eslint-disable`/rule override for this one shim file, or drop the shim if
   `@angular/compiler-cli` ships nodenext-clean typings. Type-only; erased at
   emit; does not affect the build (`nx build` is green) or the gate.

2. **`src/executors/angular-typecheck/executor.ts:16` (1 warning,
   `@typescript-eslint/no-unused-vars`):** `_context` parameter is defined but
   never used. Pre-existing from Plan 01-03's thin executor stub (the
   `ExecutorContext` is part of the Nx executor signature but unused in the
   Phase-1 stub; full normalize-options is deferred to Phase 4 / EXE-01). The
   `_` prefix is the conventional unused-arg marker; tune the lint rule's
   `argsIgnorePattern` in Phase 3 (WS-04) if desired.
