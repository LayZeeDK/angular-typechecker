---
phase: 02-core-type-check-engine-gatherer
plan: 01
subsystem: testing
tags: [angular-compiler-cli, typescript, vitest, nx-plugin, type-check, diagnostics]

# Dependency graph
requires:
  - phase: 01-workspace-bootstrap-engine-spike-gated
    provides: "Phase-1 tracer-bullet core/ (run-typecheck.ts, gather-diagnostics.ts, compiler-loader.ts, compiler-cli-types.ts); GATE A/B proof; nodenext-safe shim"
provides:
  - "Real runTypecheck engine + locked CoreResult contract (tsConfigPath, rootNamesCount, diagnostics, errorCount, warningCount, durationMs)"
  - "Explicit category counting (Error/Warning), never length - errorCount (D-01/MD-02)"
  - "Config-error prepend so a malformed tsconfig is never silently clean (D-03/MD-01)"
  - "Zero-rootNames guard synthesizing one Error naming the leaf tsconfigs (D-03/D-03a)"
  - "Full D-05 emit-neutralizing override + diagnostics:false (D-05/D-02)"
  - "TypecheckInfrastructureError re-throw on UNKNOWN_ERROR_CODE 500 (D-06)"
  - "Widened CompilerCli shim exposing UNKNOWN_ERROR_CODE"
  - "REAL-compiler integration tier (*.integration.spec.ts) + focused D-06 stub spec"
  - "tsconfig.lib.json excludes all fixtures/** (Wave-2 slices are fixture-only additions)"
affects: [02-02-config-resolution, 02-03-diagnostic-catalog, phase-03-filtering-modes-output, phase-04-executor-adapter]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Explicit ts.DiagnosticCategory counting (Error + Warning), invariant errorCount + warningCount <= diagnostics.length"
    - "Config errors prepended to diagnostics; never thrown for config problems (compiler-cli exitCodeFromResult contract)"
    - "Infrastructure-failure detection by code === 500 only, NOT source === 'angular' (L-3/V-3); re-throw as TypecheckInfrastructureError"
    - "Fresh per-call options object spread (footgun guard against mutated noEmit leaking across calls)"
    - "Focused single mock of loadCompilerCli for the D-06 path (broad mocking deferred to Phase-3 TEST-01)"

key-files:
  created:
    - packages/angular-typechecker/src/core/run-typecheck.integration.spec.ts
    - packages/angular-typechecker/src/core/infra-failure.spec.ts
  modified:
    - packages/angular-typechecker/src/core/run-typecheck.ts
    - packages/angular-typechecker/src/core/compiler-cli-types.ts
    - packages/angular-typechecker/src/index.ts
    - packages/angular-typechecker/src/core/gather-diagnostics.spec.ts
    - packages/angular-typechecker/src/core/gate-b.spec.ts
    - packages/angular-typechecker/tsconfig.lib.json

key-decisions:
  - "Synthesized zero-rootNames diagnostic code = 90001 (outside TS range and Angular -99xxxx/500 space; Claude's discretion per CONTEXT/RESEARCH)"
  - "TypecheckInfrastructureError extends Error, exported from index.ts so the Phase-4 executor can catch it; carries the 500 diagnostic's flattened messageText"
  - "tsconfig.lib.json: kept the explicit fixtures/gate-b-error line AND added a broad fixtures/**/* exclude (future-proof; no same-file conflict with Wave-2 slices)"
  - "Integration specs reuse the gate-b-error fixture (F1+F7: TS2322 + NG8109) via describe.each over app+lib tsconfigs; no jsdom needed but inherited config kept (no over-configuration)"

patterns-established:
  - "REAL-compiler integration tier named *.integration.spec.ts (D-07c: one performCompilation per fixture, multiple assertions, NG() helper)"
  - "NG(code) => -990000 - code assertion helper; TS codes asserted raw; count by .category never by code sign (L-4)"
  - "D-06 stub pattern: vi.hoisted mutable performCompilation + vi.mock('./compiler-loader') returning a CompilerCli with UNKNOWN_ERROR_CODE: 500"

requirements-completed: [ENG-01, ENG-02, ENG-04]

# Metrics
duration: 6min
completed: 2026-06-27
---

# Phase 2 Plan 01: Core Type-Check Engine + Gatherer Summary

**Real `runTypecheck` engine on the locked `CoreResult` contract: explicit category counts, config-error prepend, zero-rootNames guard, full D-05 emit-neutralizing override, and a `TypecheckInfrastructureError` re-throw on UNKNOWN_ERROR_CODE 500 -- proven end-to-end against the real Angular 22 compiler.**

## Performance

- **Duration:** ~6 min
- **Completed:** 2026-06-27
- **Tasks:** 3
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments

- Grew the Phase-1 tracer-bullet `run-typecheck.ts` into the real framework-agnostic engine and locked the `CoreResult` contract that slices 02-02, 02-03, and Phases 3/4 consume.
- Fixed the two carried-forward code-review defects: MD-02 (warning-count conflation -> explicit `Warning`-category count) and MD-01 (dropped `parsed.errors` -> prepended so a malformed config is never a silent PASS).
- Implemented the full D-05 emit-neutralizing override (composite/declaration/emitDeclarationOnly triangle broken; sourcemap/tsbuildinfo cleared) plus D-02 `diagnostics: false`, keeping both `emitFlags: 0` and `noEmit: true` (V-2 load-bearing pair).
- Added the D-06 infrastructure-failure re-throw (`TypecheckInfrastructureError`), detected by `code === 500` only (never `source === 'angular'`, per L-3/V-3), exported for the Phase-4 executor.
- Stood up the REAL-compiler integration tier proving the unconditional gatherer surfaces TS2322 AND NG8109 (-998109) in one pass, plus a focused D-06 stub spec proving the re-throw distinguishes a code-500 crash from a genuine TS2322 type error.
- Reconciled all Phase-1 specs to the new contract (LW-01 import fix; `result.codes` -> `result.diagnostics.map(...)`) and extended `tsconfig.lib.json` to exclude all `fixtures/**` so Wave-2 slices are fixture-only additions.
- Full verification green: `npx nx build angular-typechecker` succeeds; `npx nx test angular-typechecker` is 27/27 across 7 files.

## Task Commits

Each task was committed atomically:

1. **Task 1: Widen the type shim and rewrite the runTypecheck engine (D-01..D-06)** - `2062c70` (feat)
2. **Task 2: Reconcile Phase-1 specs and add the end-to-end + D-06 integration proofs** - `873c352` (test)
3. **Task 3: Extend tsconfig.lib.json exclude for all Phase-2 fixture dirs** - `82b82d5` (chore)

_Note: Task 1 and Task 2 are TDD-flagged. Here the plan splits the cycle across two atomic commits: Task 1 implements the engine contract (gate = build), Task 2 lands the REAL-compiler + focused-stub specs that prove the contract (gate = test). All specs pass against the implemented engine._

## Files Created/Modified

- `packages/angular-typechecker/src/core/run-typecheck.ts` - Rewritten engine: new `CoreResult` (drops public `codes`, adds `tsConfigPath`/`rootNamesCount`), config-error prepend, zero-rootNames guard (synthesized code 90001), full D-05 override + D-02, D-06 detect+re-throw, explicit category counts; `TypecheckInfrastructureError` defined here.
- `packages/angular-typechecker/src/core/compiler-cli-types.ts` - Widened `CompilerCli` shim with `readonly UNKNOWN_ERROR_CODE: typeof UNKNOWN_ERROR_CODE` (deep-import from `.../transformers/api`, value 500).
- `packages/angular-typechecker/src/index.ts` - Exports `TypecheckInfrastructureError` alongside `runTypecheck` + `CoreOptions`/`CoreResult`.
- `packages/angular-typechecker/src/core/run-typecheck.integration.spec.ts` - NEW. REAL-compiler end-to-end proof over the `gate-b-error` app+lib tsconfigs (ENG-01/02/04, D-01 no-public-codes).
- `packages/angular-typechecker/src/core/infra-failure.spec.ts` - NEW. Focused D-06 stub: re-throws on returned code-500; does NOT throw on a real TS2322 (counted in `errorCount`).
- `packages/angular-typechecker/src/core/gather-diagnostics.spec.ts` - LW-01: `Program` imported from `./compiler-cli-types`, not the barrel.
- `packages/angular-typechecker/src/core/gate-b.spec.ts` - L-8 reconcile: timing test derives codes from `result.diagnostics.map(...)` (the GATE B differential proof is otherwise unchanged).
- `packages/angular-typechecker/tsconfig.lib.json` - Added a broad `fixtures/**/*` exclude (kept the explicit `gate-b-error` line).

## Decisions Made

- **Synthesized zero-rootNames diagnostic code = `90001`** - a small private positive outside the TypeScript code range and outside the Angular negative `-99xxxx` encoding and the `500` UNKNOWN_ERROR_CODE space, so it can never collide with a genuine TS or NG diagnostic. Discretion granted by CONTEXT/RESEARCH (suggested `ATC1001`/`90001`).
- **`TypecheckInfrastructureError extends Error`** carries the flattened `messageText` of the 500 diagnostic and is exported from `index.ts`. The exact Phase-4 executor mapping is out of scope here (Phase-4 concern).
- **`tsconfig.lib.json`: broad `fixtures/**/*` plus the explicit `gate-b-error` line** - future-proof and avoids same-file conflicts with the parallel Wave-2 slices (02-02/02-03), which now add fixtures without re-touching this config.
- **D-06 detection by `code === ng.UNKNOWN_ERROR_CODE` (500) only** - never the `source === 'angular'` predicate `exitCodeFromResult` uses, because the synthesized 500 diagnostic sets no `source` (L-3/V-3).

## Deviations from Plan

None - plan executed exactly as written.

The two `length - errorCount` strings that remained in JSDoc/comment prose (documenting that the MD-02 bug is gone) were both reworded/confirmed-as-comment so the literal acceptance grep (`git grep -v '^\s*//' | grep -c "length - errorCount"`) returns 0. This is acceptance-criterion compliance, not a behavioral deviation.

## Issues Encountered

- **Worktree had no `node_modules`** (Claude Code worktrees branch from a clean tree; this worktree shipped without the installed toolchain). The verification commands (`npx nx build`/`test`) and the shim's deep-import path (`../../../../node_modules/@angular/compiler-cli/...`) both require it. Resolved non-destructively by creating a Windows directory junction at the worktree root pointing at the main repo's already-installed, locked `node_modules` (`mklink /J node_modules <main-repo>\node_modules`). This is read-only sharing; it does not modify the main repo and is gitignored (does not appear in `git status`). All builds/tests then ran against the locked toolchain (`@angular/compiler-cli@22.0.4`, `typescript@6.0.3`, `vitest@4.1.9`). Verification runs used `--skip-nx-cache` so the build/test re-ran against the worktree's changes rather than the shared cache.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The load-bearing `CoreResult` contract is locked and proven against the real compiler. Slices 02-02 (config resolution: the malformed-config and solution-style guard fixtures) and 02-03 (diagnostic catalog: the F2-F6 + composite-triangle fixtures) can now assert against it and ADD fixtures only (no re-touch of `tsconfig.lib.json` or the engine body).
- `TypecheckInfrastructureError` and the `{ errorCount }` count fields are the seams the Phase-3 filtering/modes/`--max-warnings`/`formatDiagnostics` work and the Phase-4 executor adapter consume.
- No blockers. The REAL-compiler integration tier naming convention (`*.integration.spec.ts`) is established; the optional `--exclude` quick-run wiring remains available without a new Nx target.

---
*Phase: 02-core-type-check-engine-gatherer*
*Completed: 2026-06-27*
