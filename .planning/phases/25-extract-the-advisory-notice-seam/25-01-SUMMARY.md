---
phase: 25-extract-the-advisory-notice-seam
plan: 01
subsystem: core
tags: [advisory-notices, logger-seam, nx-executor, dependency-injection, refactor]

# Dependency graph
requires:
  - phase: earlier v0.2.x phases (13/17/18/20)
    provides: the five executor advisory helpers (templateCheckAborted / skippedReferences / split suppressed counts / notTypeCheckedDeclaredFiles / bundlerQueryImports) and the CoreResult advisory fields they read
provides:
  - core/logger.ts - a homegrown structural Logger seam (info/warn/error) that imports nothing
  - core/emit-advisory-notices.ts - a pure, logger-injected emitAdvisoryNotices(result, logger) rendering all five advisories
  - the reusable advisory seam the Phase-26 CLI can drive without importing executor.ts (@nx/devkit/chalk)
affects: [phase-26-cli, standalone-cli, run, parse-args, console-logger]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Structural Logger seam: @nx/devkit's logger is passed in with ZERO adapter (structural assignability); the contract lives in a nothing-importing core/logger.ts"
    - "Detection(core)-vs-rendering(adapter) split extended: rendering moved into core-but-pure behind an injected sink; the module performs no I/O of its own"

key-files:
  created:
    - packages/angular-typechecker/src/core/logger.ts
    - packages/angular-typechecker/src/core/emit-advisory-notices.ts
    - packages/angular-typechecker/src/core/emit-advisory-notices.spec.ts
  modified:
    - packages/angular-typechecker/src/executors/typecheck/executor.ts

key-decisions:
  - "Logger is homegrown (never @nx/devkit's type) so core/logger.ts imports nothing and satisfies the src/core D-11 boundary (D-01/D-03)"
  - "Logger.error is in the contract even though no advisory uses it - it freezes the full seam shape for the Phase-26 CLI infra path (D-03)"
  - "The five helpers + skippedReferenceVerdictNote moved by literal cut-paste; the only per-helper edit is appending , logger: Logger (D-04/D-05/D-06)"
  - "Emission order locked: templateCheckAborted -> skippedReferences(per-ref) -> suppressed(info THEN warn) -> notTypeChecked -> bundlerQueryImports (D-05)"
  - "The infra TypecheckInfrastructureError catch/logger.error stays in the executor - it is adapter error-handling, not an advisory (D-08)"
  - "executor.spec.ts is unchanged and keeps running the real emitAdvisoryNotices against the mocked @nx/devkit logger - the byte-identical regression guard (D-10)"

patterns-established:
  - "Pattern 1: pure-core render module behind an injected Logger - no console/process/nx, caller owns the sink"
  - "Pattern 2: byte-exact spec anchor - full-string toHaveBeenCalledWith (not stringContaining) pins each advisory's message text + stream routing"

requirements-completed: [CLI-04]

# Metrics
duration: 10min
completed: 2026-07-16
---

# Phase 25 Plan 01: Extract the advisory-notice seam Summary

**Lifted the five Nx-executor advisory helpers into a pure, logger-injected `core/emit-advisory-notices.ts` behind a homegrown structural `Logger` seam, and swapped the executor to one `emitAdvisoryNotices(result, logger)` call with byte-identical output vs `angular-typechecker@0.2.1`.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-16T01:34:41Z
- **Completed:** 2026-07-16T01:45:03Z
- **Tasks:** 3
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- New `core/logger.ts`: a structural `Logger` interface (`info`/`warn`/`error`) that imports nothing, so it cannot reach nx/console/process under the `src/core` D-11 lint boundary.
- New `core/emit-advisory-notices.ts`: `emitAdvisoryNotices(result, logger)` plus the five private advisory helpers + `skippedReferenceVerdictNote`, moved verbatim behind the injected `Logger`, preserving the locked emission order and every message string byte-for-byte.
- New byte-exact unit spec asserting each advisory's EXACT full-string message + stream routing (info for the node_modules-suppressed count, warn for everything else, error never), all three `skippedReferenceVerdictNote` branches, the info-before-warn sub-order, and a clean-result silent case.
- Executor swapped to one injected-logger call; the five helpers + unused `CoreResult`/`SkippedReference` type imports deleted; the infra `logger.error` path kept. The existing executor + builder specs stay green with no assertion edits (byte-identical proof).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the Logger seam and the pure advisory module (verbatim move)** - `75a130e` (feat)
2. **Task 2: Add the byte-exact unit spec for emitAdvisoryNotices** - `bb63d23` (test)
3. **Task 3: Swap the executor to one emitAdvisoryNotices call and delete the moved code** - `c06ea2c` (refactor)

**Plan metadata:** committed with SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md (docs commit)

## Files Created/Modified
- `packages/angular-typechecker/src/core/logger.ts` - structural `Logger` seam contract, imports nothing (D-01/D-03).
- `packages/angular-typechecker/src/core/emit-advisory-notices.ts` - `emitAdvisoryNotices` + the five advisory helpers + `skippedReferenceVerdictNote`, pure and logger-injected (D-04/D-05/D-06).
- `packages/angular-typechecker/src/core/emit-advisory-notices.spec.ts` - byte-exact unit spec against a mock `Logger` (D-09).
- `packages/angular-typechecker/src/executors/typecheck/executor.ts` - one `emitAdvisoryNotices(result, logger)` call; moved code + unused type imports removed; infra catch untouched (D-07/D-08).

## Decisions Made
None beyond the plan's locked decisions (D-01..D-10), which were followed exactly. Internal helper names were kept identical to the originals (permitted discretion), and `emitAdvisoryNotices` calls the five helpers as a straight sequence (permitted discretion).

## Deviations from Plan

None - plan executed exactly as written. No `git add .`/`-A` was used; files were staged individually. No new dependencies installed (additive/internal refactor, ADD-01). `src/index.ts` untouched (no barrel change).

## Issues Encountered
- **JSDoc `**/src/core/**` glob closed the block comment early.** During Task 1, writing the boundary path with the glob suffix inside a `/** ... */` doc comment put a literal `*/` mid-comment, terminating it and breaking the build (TS2304 on `src`/`core`). Fixed immediately (before the Task 1 commit) by rephrasing the doc prose to `src/core` (no glob asterisks) in both new files. Caught by the `nx build` gate; no behavioral impact.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The Phase-26 standalone CLI can now import `emitAdvisoryNotices` + `Logger` from `core/` and inject a console logger, driving advisory output without ever importing `executor.ts` (which drags `@nx/devkit`/`chalk` - the 24-06 crash class). CLI-03's stdout/stderr routing and the console `Logger` implementation remain Phase-26 work (deferred as planned).
- No blockers. Full suite (build + unit + integration + lint at maxWarnings:0 + typecheck + format:check) is green.

## Self-Check: PASSED
- FOUND: packages/angular-typechecker/src/core/logger.ts
- FOUND: packages/angular-typechecker/src/core/emit-advisory-notices.ts
- FOUND: packages/angular-typechecker/src/core/emit-advisory-notices.spec.ts
- FOUND: packages/angular-typechecker/src/executors/typecheck/executor.ts
- FOUND commit: 75a130e (Task 1)
- FOUND commit: bb63d23 (Task 2)
- FOUND commit: c06ea2c (Task 3)

---
*Phase: 25-extract-the-advisory-notice-seam*
*Completed: 2026-07-16*
