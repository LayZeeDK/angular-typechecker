---
phase: 08-correctness-completeness-fixes
plan: 03
subsystem: testing
tags: [angular-compiler-cli, typescript, diagnostics, exit-codes, ngc-parity, pure-core]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: core/adapter split (filterDiagnostics, evaluateResult, TypecheckInfrastructureError, CoreResult); core/** purity lint boundary
  - phase: 08-01
    provides: TypecheckInfrastructureError re-throw for config-resolution 500 crashes (the typed infra signal toExitCode keys on)
provides:
  - COR-03 - the project-boundary filter keeps a present-but-empty fileName diagnostic (treated as file-less, never suppressed by a path edge)
  - COR-04 - a pure framework-agnostic toExitCode(input) -> 0 | 1 | 2 exit-code policy in core (ngc-parallel) as the single source of truth for all surfaces
  - Tightened executor D-08 assertion locking the distinct "infrastructure error" operator message
affects: [09-resilience, 10-drift-hardening, standalone-cli-deferred, angular-cli-builder-deferred]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Pure core/ exit-code policy (toExitCode) sibling of evaluateResult: Pick<CoreResult,...> | typed-error input, no process, lint-gated purity'
    - 'File-less guard widened to cover the present-but-empty fileName synthesized-diagnostic edge'

key-files:
  created:
    - packages/angular-typechecker/src/core/exit-codes.ts
    - packages/angular-typechecker/src/core/exit-codes.spec.ts
  modified:
    - packages/angular-typechecker/src/core/filter-diagnostics.ts
    - packages/angular-typechecker/src/core/filter-diagnostics.spec.ts
    - packages/angular-typechecker/src/executors/angular-typecheck/executor.spec.ts

key-decisions:
  - "COR-03: one widened boolean (file === undefined || file.fileName === '') is the entire fix; canonicalizer / node_modules-segment test / isUnderDir untouched (D-06)"
  - 'COR-04: toExitCode is a pure leaf in core/ importing ONLY from ./run-typecheck (type CoreResult + value TypecheckInfrastructureError for the instanceof branch); run-typecheck.ts does NOT import it (no cycle)'
  - "COR-04 D-08: executor.ts source unchanged; toExitCode NOT wired into the executor return (Nx maps { success } to 0/1); only the existing infra-catch spec assertion was tightened to lock the distinct 'infrastructure error' message"

patterns-established:
  - "Pure exit-code policy: toExitCode(input: Pick<CoreResult,'errorCount'> | TypecheckInfrastructureError): 0|1|2 -- 2 infra (instanceof), 1 errorCount>0, else 0; unit-tested with a 2-field literal + a typed-error instance, no compiler, no process"

requirements-completed: [COR-03, COR-04]

# Metrics
duration: 5min
completed: 2026-06-29
---

# Phase 8 Plan 03: COR-03 empty-fileName keep + COR-04 pure toExitCode policy Summary

**The boundary filter now keeps a present-but-empty `fileName` diagnostic instead of silently dropping it (COR-03), and a new pure framework-agnostic `core/exit-codes.ts` exposes `toExitCode` -> 0/1/2 (clean/type-error/infra, ngc-parallel) as the single source of truth for every surface (COR-04).**

## Performance

- **Duration:** 5 min
- **Started:** 2026-06-29T16:35:42Z
- **Completed:** 2026-06-29T16:40:42Z
- **Tasks:** 2 (both TDD: failing-then-passing)
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- **COR-03:** widened the file-less guard in `filter-diagnostics.ts` from `diagnostic.file === undefined` to `diagnostic.file === undefined || diagnostic.file.fileName === ''`. A synthesized diagnostic with an empty `fileName` canonicalizes to `''` and was suppressed by the project-boundary filter (`isUnderDir('', base) === false`) -- a real error dropped by a path edge (false PASS). It is now treated as file-less and always kept. Inline comment + module JSDoc D-03 paragraph updated; canonicalizer / node_modules-segment test / `isUnderDir` untouched.
- **COR-04:** created the pure `core/exit-codes.ts` exporting `toExitCode(input): 0 | 1 | 2` (ngc-parallel `exitCodeFromResult`): `2` when `input instanceof TypecheckInfrastructureError`, `1` when `input.errorCount > 0`, else `0`. Mirrors `evaluate-result.ts`'s pure-policy shape; imports ONLY from `./run-typecheck`; no `process`, no `console`, no `@nx/*` (passes the `core/**` boundary lint). Not imported by `run-typecheck.ts` (no cycle).
- **COR-04 D-08:** tightened the existing executor infra-catch spec to assert `logger.error` is called with a message containing `"infrastructure error"`, locking the distinct operator message. `executor.ts` source unchanged; `toExitCode` is NOT wired into the executor return (Nx maps `{ success }` to 0/1).

## Task Commits

Each task was committed atomically:

1. **Task 1: COR-03 widen the file-less guard + failing-then-passing unit case** - `3f9958a` (feat)
2. **Task 2: COR-04 pure core/exit-codes.ts + unit spec + tightened executor D-08 assertion** - `6d1fbcc` (feat)

**Plan metadata:** (final docs commit — this SUMMARY + STATE + ROADMAP + REQUIREMENTS)

_Note: both tasks are TDD. Each followed RED (new case fails against pre-fix source) -> GREEN (fix makes it pass). The leaf changes were committed as a single feat per task (test + implementation together), as the plan defines one atomic task per COR fix._

## Files Created/Modified

- `packages/angular-typechecker/src/core/exit-codes.ts` (created) - pure `toExitCode` 0/1/2 exit-code policy (COR-04 / D-07)
- `packages/angular-typechecker/src/core/exit-codes.spec.ts` (created) - unit cases for the 2 / 1 / 0 branches
- `packages/angular-typechecker/src/core/filter-diagnostics.ts` (modified) - file-less guard widened to cover empty `fileName` (COR-03 / D-06)
- `packages/angular-typechecker/src/core/filter-diagnostics.spec.ts` (modified) - new unit case: `diag('')` is kept, suppressedCount 0
- `packages/angular-typechecker/src/executors/angular-typecheck/executor.spec.ts` (modified) - tightened D-08 infra-catch assertion (distinct "infrastructure error" message)

## Decisions Made

None beyond the plan-specified decisions (D-06, D-07, D-08). Implemented exactly as planned:

- COR-04 used the recommended discriminated-union input shape (`Pick<CoreResult, 'errorCount'> | TypecheckInfrastructureError`) rather than overloads (planner discretion, union was the recommended form).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Both TDD cycles ran cleanly: each new case failed RED against the pre-fix source (COR-03: `expected [] to have a length of 1`; COR-04: `Failed to resolve import "./exit-codes"`), then passed GREEN after the fix. The single lint warning (`'NG' is assigned a value but never used` at `config-resolution.integration.spec.ts:30`) is pre-existing in a file untouched by this plan and out of scope (0 lint errors).

## Verification

- `npx nx test angular-typechecker` - GREEN (22 test files, 123 tests)
- `npx nx lint angular-typechecker` - 0 errors (the `core/**` boundary holds for the new `exit-codes.ts`; 1 pre-existing out-of-scope warning)
- `npx nx build angular-typechecker` - GREEN (nodenext compile of the new core file; GATE A `import(` retained in the built `compiler-loader.js`)
- Invariants asserted: `exit-codes.ts` imports only `./run-typecheck`; `run-typecheck.ts` does NOT import `exit-codes.ts` (no cycle); `executor.ts` does NOT reference `toExitCode` (D-08).

## Next Phase Readiness

- COR-03 and COR-04 are complete; Phase 8 (COR-01..COR-04) is fully implemented across plans 08-01/08-02/08-03 and ready for phase verification.
- **Cross-phase note (Phase 10 HARD-01):** unaffected by this plan -- COR-02's `getTsProgram().getGlobalDiagnostics` getter (added in 08-02) is the one that must land in the drift getter-set assertion; `toExitCode` is a pure leaf with no shim coupling.
- **Deferred-surface readiness (D-09):** the pure `toExitCode` policy is the single definition the deferred standalone CLI will consume via `process.exit(toExitCode(...))`; the Angular CLI builder inherits the executor's `{ success }` -> 0/1. No corner painted.

## Self-Check: PASSED

All 6 declared files exist on disk and both task commits (`3f9958a`, `6d1fbcc`) are in the git history.

---

_Phase: 08-correctness-completeness-fixes_
_Completed: 2026-06-29_
