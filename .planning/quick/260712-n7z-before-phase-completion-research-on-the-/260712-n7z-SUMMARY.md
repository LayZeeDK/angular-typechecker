---
status: complete
phase: quick-260712-n7z
plan: n7z
subsystem: testing
tags: [nx, e2e, verdaccio, startLocalRegistry, task-invocation, ci]

# Dependency graph
requires:
  - phase: 24-06
    provides: the 4th registry-starting e2e project (angular-typechecker-ng-cli-e2e) that collided with install-e2e under run-many
provides:
  - "delete process.env.NX_INVOCATION_ROOT_PID before startLocalRegistry in both registry-starting e2e global-setups, so nx run-many -t e2e --parallel=1 is deterministically green"
affects: [v0.2.1 release PR, ci.yml e2e job, GUARD-01/01b coverage guard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Strip the inherited Nx run-many root PID before any nested nx fork that startLocalRegistry cannot receive a cleaned env for"

key-files:
  created: []
  modified:
    - e2e/angular-typechecker-ng-cli-e2e/src/global-setup.ts
    - e2e/angular-typechecker-install-e2e/src/global-setup.ts

key-decisions:
  - "Adopted Option A (delete process.env.NX_INVOCATION_ROOT_PID before startLocalRegistry) over Option B (per-project local-registry target) -- one line x2, no config surface, mirrors the repo's existing buildCleanEnv/NX_RUNNER_ENV_KEYS hygiene."

patterns-established:
  - "startLocalRegistry takes no env param, so any env hygiene the repo applies via buildCleanEnv must be applied to process.env BEFORE the startLocalRegistry fork."

requirements-completed: [N7Z-01]

# Metrics
duration: ~50min (dominated by the ~40min authoritative run-many e2e)
completed: 2026-07-12
---

# Quick 260712-n7z: e2e local-registry collision fix Summary

**Cleared the inherited NX_INVOCATION_ROOT_PID before startLocalRegistry in both registry-starting e2e global-setups, so `nx run-many -t e2e --parallel=1` runs green across all four e2e projects with no "already invoked by a parent Nx process in this chain" exit(1).**

## Performance

- **Duration:** ~50 min (the authoritative run-many e2e alone ran ~40 min)
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Root-cause fix for the Nx 23 TaskInvocationTracker collision: under `nx run-many -t e2e`, both `install-e2e` and `ng-cli-e2e` inherited the same `NX_INVOCATION_ROOT_PID` and each `startLocalRegistry` forked `nx run <root>:local-registry` with the inherited env, so the second fork registered a duplicate `(rootPID, taskId)` and `process.exit(1)`ed.
- Deterministically unblocks the release-blocking CI `e2e` job (`.github/workflows/ci.yml:204`, `run-many -t e2e --parallel=1`) which the v0.2.1 release PR will trigger once it carries `e2e/**` code.
- The two global-setups remain verbatim siblings (identical fix text; only the pre-existing header comment differs).

## Task Commits

1. **Task 1: Clear NX_INVOCATION_ROOT_PID before startLocalRegistry in both e2e global-setups** - `a17ee57` (test)

_Docs artifacts (SUMMARY / STATE) are committed separately by the orchestrator._

## Files Created/Modified
- `e2e/angular-typechecker-ng-cli-e2e/src/global-setup.ts` - added a 9-line ASCII comment + `delete process.env.NX_INVOCATION_ROOT_PID;` immediately before the `const stop = await startLocalRegistry({` call.
- `e2e/angular-typechecker-install-e2e/src/global-setup.ts` - identical addition (verbatim sibling).

## Decisions Made
- None beyond adopting the research's primary recommendation (Option A). Option B (per-project `local-registry` target) was the documented fallback but was not needed -- Option A verified green on the first run, so no fallback was warranted.

## Deviations from Plan

None - plan executed exactly as written. The insertion point, the exact comment text, the one-line delete, and the "touch nothing else" constraint were all honored. No package.json / version mutated (release-branch safe).

## Verification Results (reported honestly)

1. `NX_DAEMON=false npx nx test angular-typechecker --skip-nx-cache` -- **GREEN**: 366 tests / 39 files passed, including `ci-e2e-coverage-guard.spec.ts` (8 tests; GUARD-01/01b/01c/01d intact).
2. `NX_DAEMON=false npx nx lint angular-typechecker --skip-nx-cache` -- **GREEN**: "All files pass linting", exit 0 (maxWarnings:0). Bonus: the two edited e2e projects have no `lint` target, but `prettier --check` on both edited files reports "All matched files use Prettier code style!" (the CI `format:check` gate covers them).
3. `NX_DAEMON=false npx nx run-many -t e2e --parallel=1` -- **GREEN** (exit 0), "Successfully ran target e2e for 4 projects", **zero** "already invoked by a parent Nx process" errors:
   - `angular-typechecker-install-e2e`: 37/37 (11 files)
   - `angular-typechecker-ng-cli-e2e` (previously failing): 4/4 (3 files -- yarn flat + yarn workspace first-run auto-wire, npm, pnpm)
   - `angular-typechecker-matrix-e2e`: 7/7 (2 files)
   - `angular-typechecker-cache-e2e`: 9/9 (3 files)

   Note: the interspersed `NX Running target typecheck for project X failed` lines are the intentionally-planted-error typecheck runs INSIDE the e2e specs (which the specs assert as failures); each project's vitest run passed. `local registry exit 143` is the normal SIGTERM `stop()` teardown of the forked verdaccio.

## Git identity check
`git config user.email` = `larsbrinknielsen@gmail.com` (public gmail) before committing. No work email/domain, no AI-attribution trailers.

## Next Phase Readiness
- The exact release-blocking CI command now passes locally across all four e2e projects. The v0.2.1 Release-PR flow (human-gated) can proceed without a red `e2e` job from this collision.
- No production surface, config, or version changed -- additive / release-branch safe.

---
*Quick task: 260712-n7z*
*Completed: 2026-07-12*
