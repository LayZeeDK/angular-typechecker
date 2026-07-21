---
status: complete
phase: quick-260717-6ad
plan: 01
subsystem: testing
tags: [cli, bin, epipe, streams, refactor, changelog, pr-42]

requires:
  - phase: v0.2.2 (Phases 25-29, standalone CLI)
    provides: the standalone bin (src/cli/bin.ts), the pure run() core, and the duplicated infra-error message this task deduplicates
provides:
  - EPIPE-safe standalone bin -- an early-closing reader (e.g. piping to head) no longer crashes the CLI; the computed 0/1/2 exit code is preserved
  - single-home infrastructure-error message (core/log-infrastructure-error.ts) consumed by both the CLI and Nx executor adapters
  - one consumer-facing 0.2.2 changelog line on safe piping
affects: [release-v0.2.2, pr-42]

tech-stack:
  added: []
  patterns:
    - "Shared 'error' listener on process.stdout/stderr that swallows EPIPE and re-throws everything else, attached before the run() chain issues any write"
    - "Adapter-shared meta-message helper in core/ (type-only imports, injected Logger) -- same single-home pattern as emit-advisory-notices.ts"

key-files:
  created:
    - packages/angular-typechecker/src/core/log-infrastructure-error.ts
    - packages/angular-typechecker/src/core/log-infrastructure-error.spec.ts
  modified:
    - packages/angular-typechecker/src/cli/bin.ts
    - packages/angular-typechecker/src/cli/bin.spec.ts
    - packages/angular-typechecker/src/cli/main.ts
    - packages/angular-typechecker/src/executors/typecheck/executor.ts
    - CHANGELOG.md

key-decisions:
  - "Swallow EPIPE via one shared listener on both streams; re-throw any non-EPIPE stream error (ENOSPC etc.) so a genuine write failure stays loud"
  - "Centralize the infra-error string in core/ with type-only imports so the src/core purity lint boundary holds; NOT exported from the public barrel"
  - "e2e tier not run -- bin wiring is covered in-process by bin.spec.ts and the infra message is byte-unchanged"

patterns-established:
  - "bin.ts EPIPE guard: register process.stdout/stderr on('error') BEFORE run() so an async EPIPE cannot outrace the listener; process.exitCode is already set synchronously, so the verdict survives"

requirements-completed: [QUICK-260717-6AD]

duration: ~15min
completed: 2026-07-17
---

# Quick Task 260717-6ad: EPIPE-safe standalone bin + single-home infra-error message

**The standalone CLI now survives its output pipe closing early (e.g. `atc -c tsconfig.json | head`) with its real 0/1/2 exit code intact, and the infrastructure-error message has one source home shared by both adapters.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 3 (each an independent, bisect-safe atomic commit)
- **Files created:** 2
- **Files modified:** 5

## Accomplishments

- Fixed the PR #42 thermo-review EPIPE finding: a shared `ignoreEpipe` listener on `process.stdout` and `process.stderr`, attached at module load before the `run()` chain, swallows `code === 'EPIPE'` and re-throws everything else. `process.exitCode` is set synchronously before the async `'error'` fires, so the computed verdict is preserved instead of an uncaught `write EPIPE` stack + wrong code.
- Fixed the PR #42 duplication finding: the byte-identical infra-error string that lived in both `main.ts` and `executor.ts` now has one home, `core/log-infrastructure-error.ts` (`logInfrastructureError(logger, error)`, type-only imports, injected `Logger`). Both adapters delegate to it; exit-code / `{ success }` mapping unchanged; the `main.integration.spec.ts` prose pin passes unchanged.
- Added one consumer-facing line to the 0.2.2 CHANGELOG `### Notes` on safe piping.

## Task Commits

Each task was committed atomically (bisect-safe -- test + lint + format green at each):

1. **Task 1: fix(cli): ignore EPIPE on the standalone bin's stdout/stderr** - `6686a1a` (fix)
2. **Task 2: refactor(core): give the infrastructure-error message one home** - `bf90214` (refactor)
3. **Task 3: docs(changelog): note EPIPE-safe piping in the 0.2.2 entry** - `0e70a6e` (docs)

## Files Created/Modified

- `packages/angular-typechecker/src/cli/bin.ts` - shared EPIPE-swallowing `'error'` listener on both streams, attached before `run()`
- `packages/angular-typechecker/src/cli/bin.spec.ts` - EPIPE-swallow + non-EPIPE-rethrow tests with listener-leak snapshot/removal cleanup
- `packages/angular-typechecker/src/core/log-infrastructure-error.ts` - single home of the infra-error message
- `packages/angular-typechecker/src/core/log-infrastructure-error.spec.ts` - byte-pinned contract spec
- `packages/angular-typechecker/src/cli/main.ts` - delegates to `logInfrastructureError`
- `packages/angular-typechecker/src/executors/typecheck/executor.ts` - delegates to `logInfrastructureError`
- `CHANGELOG.md` - one 0.2.2 Notes bullet on safe piping

## Decisions Made

None beyond the plan - executed exactly as specified. The other six thermo-review findings (color-policy fork, e2e assertion-matrix duplication, `toExitCode` dead arms, comment-id style, `--tsConfig` casing, `NO_COLOR=""`) were triaged as non-blocking follow-ups and deliberately NOT touched (scope discipline on an already-audited milestone branch).

## Deviations from Plan

None - plan executed exactly as written. (One prettier `--write` collapse on the new spec's multi-line call; whitespace only, re-verified green.)

## Issues Encountered

The first executor agent hit the session usage limit before doing any work; the orchestrator executed the plan directly. No code impact.

## Verification

- `npx nx run-many -t test -p angular-typechecker` -- 46 files / 463 tests pass (incl. the 2 new bin tests, the new log-infrastructure-error spec, and the unchanged `main.integration.spec.ts` prose pin).
- `npx nx run-many -t lint -p angular-typechecker` -- clean (src/core purity + src/cli nx-free boundaries hold).
- `npx prettier --check` on every touched file -- clean.
- `git grep -c "infrastructure error, not a type error"` -- one src home (+ its spec byte-pin) only.
- e2e tier not required (bin wiring covered in-process; message byte-unchanged).

## Next Steps

- These three commits sit on `gsd/v0.2.2-standalone-cli` (PR #42); they ride the existing Release-PR flow.
- Six triaged follow-ups remain optional (see Decisions Made) -- none block the v0.2.2 release.

---
*Quick task: 260717-6ad*
*Completed: 2026-07-17*
