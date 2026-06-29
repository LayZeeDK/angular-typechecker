---
phase: 08-correctness-completeness-fixes
plan: 01
subsystem: testing
tags: [angular-compiler-cli, typescript, vitest, diagnostics, infrastructure-error, config-resolution]

# Dependency graph
requires:
  - phase: 02-engine (v0.0.1)
    provides: "runTypecheck engine with TypecheckInfrastructureError + the post-performCompilation 500 scan and the D-03 parsed.errors fold"
provides:
  - "Early parsed.errors UNKNOWN_ERROR_CODE (500) scan in run-typecheck.ts, re-throwing TypecheckInfrastructureError BEFORE the zero-rootNames guard"
  - "Two-stage 500 defense-in-depth (config parse + post-performCompilation), both keyed on ng.UNKNOWN_ERROR_CODE"
  - "COR-01 failing-then-passing unit twin (mocked readConfiguration) + real-compiler integration case (nonexistent tsconfig path)"
affects: [08-02 (COR-02 global diagnostics), 08-03 (COR-03/COR-04), 10-drift-hardening (HARD-01 must keep UNKNOWN_ERROR_CODE in the drift assertion)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Code-only UNKNOWN_ERROR_CODE (500) detection mirrored at two stages (config parse + post-compilation)"
    - "Hoisted mockable readConfiguration handle in infra-failure.spec.ts (mirrors the existing performCompilation handle) to drive config-parse variants per test"

key-files:
  created: []
  modified:
    - packages/angular-typechecker/src/core/run-typecheck.ts
    - packages/angular-typechecker/src/core/infra-failure.spec.ts
    - packages/angular-typechecker/src/core/config-resolution.integration.spec.ts

key-decisions:
  - "Early scan placed immediately after readConfiguration and BEFORE both the configDiagnostics fold and the zero-rootNames guard (the 500 case has rootNames: [], so a late scan would be swallowed and mis-counted as a type error)"
  - "Detect by ng.UNKNOWN_ERROR_CODE only (D-02), never source/message text; the existing post-performCompilation scan kept unchanged (two-stage defense-in-depth)"
  - "Only code 500 is infrastructure; every other parsed.errors entry (e.g. 5012) stays folded into configDiagnostics and is counted (D-03)"
  - "COR-01 integration fixture is a nonexistent tsconfig path (deterministic ENOENT, cross-OS) -- no fixture file committed"

patterns-established:
  - "Failing-then-passing discipline verified: both new COR-01 assertions FAIL against the pre-fix source (errorCount: 2 via the guard) and PASS after the early scan"

requirements-completed: [COR-01]

# Metrics
duration: 5min
completed: 2026-06-29
---

# Phase 8 Plan 01: Config-Resolution Infrastructure-Crash Detection (COR-01) Summary

**An early `parsed.errors` UNKNOWN_ERROR_CODE (500) scan in `run-typecheck.ts` re-throws `TypecheckInfrastructureError` immediately after `readConfiguration` and before the zero-rootNames guard, so a config-resolution crash is classified as infrastructure -- never folded into the reported diagnostics or counted as a type error.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-29T16:09:25Z
- **Completed:** 2026-06-29T16:14:54Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added the early config-parse 500 scan (`configInfrastructureFailure`) on `parsed.errors`, keyed on `ng.UNKNOWN_ERROR_CODE`, positioned before the `configDiagnostics` fold and the `if (parsed.rootNames.length === 0)` guard, re-throwing `TypecheckInfrastructureError` with a flattened `messageText`.
- Kept the existing post-`performCompilation` 500 scan unchanged -- two-stage defense-in-depth (D-02), both stages keyed by code only.
- Proved the fix failing-then-passing with a stubbed-`readConfiguration` unit twin (`{ rootNames: [], errors: [code-500] }` rejects; `performCompilation` never called) plus a real-compiler integration case (a nonexistent tsconfig path rejects), and a code-5012 contrast confirming a genuine config diagnostic stays folded and is RETURNED (D-03 boundary).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the early parsed.errors 500 scan to run-typecheck.ts** - `6993cb3` (feat)
2. **Task 2: Failing-then-passing COR-01 unit twin + real-compiler integration case** - `7561bd1` (test)

_Note: this is a TDD plan; the source (GREEN-enabling) commit and the test commit are separate. The RED state was verified against the pre-Task-1 source before applying the fix (the two new assertions failed with `errorCount: 2` via the guard), then GREEN after._

## Files Created/Modified
- `packages/angular-typechecker/src/core/run-typecheck.ts` - Added the early `parsed.errors` `UNKNOWN_ERROR_CODE` scan + `TypecheckInfrastructureError` re-throw, after `readConfiguration` and before the `configDiagnostics` fold / zero-rootNames guard.
- `packages/angular-typechecker/src/core/infra-failure.spec.ts` - Hoisted `readConfiguration` to a mockable `vi.fn` handle (restored to the non-empty-rootNames default in `beforeEach`); added the COR-01 500 unit twin and the code-5012 D-03 contrast case.
- `packages/angular-typechecker/src/core/config-resolution.integration.spec.ts` - Added the real-compiler COR-01 case asserting a nonexistent tsconfig path rejects with `TypecheckInfrastructureError`; existing malformed-5012 "does NOT throw" cases left unchanged.

## Decisions Made
- **Scan placement before the guard is load-bearing.** The 500 case returns `rootNames: []`; the RED run reproduced the exact bug (the folded 500 + the synthesized guard diagnostic yielded `errorCount: 2` and the run resolved instead of throwing). Placing the scan after the guard would leave the bug intact.
- **Code-only detection at both stages.** The config-parse 500 carries `source: 'angular'` but the post-compilation 500 does not; `=== ng.UNKNOWN_ERROR_CODE` is the uniform predicate matching the existing scan (D-02).
- **No fixture file for the integration case.** A nonexistent tsconfig path triggers ENOENT in `readConfiguration`'s outer catch (the 500) deterministically on every OS, so no `tsconfig.does-not-exist.json` was committed (the path simply must not exist).
- **`readConfiguration` mock refactor (unit twin enablement).** Converted the previously-inline `readConfiguration` stub into a hoisted handle (mirroring the existing `performCompilation` handle) so per-test config-parse variants are drivable; the two pre-existing post-`performCompilation` cases keep their original behavior via a `beforeEach` default restore.

## Deviations from Plan

None - plan executed exactly as written. The scan was inserted at the specified insertion point, both 500 scans coexist, the existing D-03 cases were not weakened, and the integration case used a nonexistent path (no fixture file) as the plan directed.

## Issues Encountered

None. The RED -> GREEN transition reproduced the documented behavior exactly (RESEARCH Pitfall 2: today's path returns `errorCount: 2` instead of throwing).

## Deferred Issues

- **Pre-existing lint warning (out of scope):** `config-resolution.integration.spec.ts:30` -- `'NG' is assigned a value but never used` (`@typescript-eslint/no-unused-vars`). This `NG` helper was already declared-but-unused in the pre-edit file (`git show HEAD~2:...` confirms it at line 30 with no call site) and the COR-01 case asserts only raw TS / 500 codes, so it remains unused. `npx nx lint angular-typechecker` reports **0 errors, 1 warning** and the lint target succeeds. Not fixed here to avoid scope creep into an unrelated pre-existing issue; a later plan asserting an NG code (or a cleanup) can resolve it.

## User Setup Required

None - no external service configuration required.

## Verification

- `npx nx build angular-typechecker` -- green (GATE A `module: nodenext` compile).
- `npx nx test angular-typechecker -- infra-failure config-resolution` -- green (all four COR-01 cases pass: 500 unit twin, 5012 contrast, nonexistent-path integration, plus the unchanged D-03 malformed cases).
- `npx nx test angular-typechecker --skip-nx-cache` -- full suite green (20 files / 117 tests; `build` dependsOn also ran).
- `npx nx lint angular-typechecker` -- 0 errors (1 pre-existing warning, see Deferred Issues); core/** boundary unchanged (no new `@nx/*` / `process.exit`).

## Next Phase Readiness
- COR-01 complete and test-gated. The two-stage 500 defense is in place.
- Cross-phase note for Phase 10 (HARD-01): the drift getter-set / error-code assertion must keep `ng.UNKNOWN_ERROR_CODE` covered so neither 500 scan can silently break on an Angular upgrade.
- Plans 08-02 (COR-02 global diagnostics) and 08-03 (COR-03 empty-fileName + COR-04 exit-code policy) remain to execute for the phase.

## Self-Check: PASSED

- `packages/angular-typechecker/src/core/run-typecheck.ts` - FOUND (contains `configInfrastructureFailure` scan)
- `packages/angular-typechecker/src/core/infra-failure.spec.ts` - FOUND (COR-01 describe block)
- `packages/angular-typechecker/src/core/config-resolution.integration.spec.ts` - FOUND (COR-01 nonexistent-path case)
- Commit `6993cb3` (feat, Task 1) - FOUND in git log
- Commit `7561bd1` (test, Task 2) - FOUND in git log

---
*Phase: 08-correctness-completeness-fixes*
*Completed: 2026-06-29*
