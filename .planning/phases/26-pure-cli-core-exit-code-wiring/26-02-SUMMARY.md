---
phase: 26-pure-cli-core-exit-code-wiring
plan: 02
subsystem: cli
tags: [run, exit-codes, two-step-compose, nx-free-path, color, realpath-guard, stubbed-core]

# Dependency graph
requires:
  - phase: 26-pure-cli-core-exit-code-wiring
    plan: 01
    provides: the discriminated ParseResult union (parse-args) + the BufferingLogger (console-logger) that run() consumes
  - phase: 25-extract-the-advisory-notice-seam
    provides: the pure emitAdvisoryNotices seam + core/logger.ts Logger run() injects the BufferingLogger into
provides:
  - src/cli/main.ts -- run(argv, env): Promise<{ exitCode: 0|1|2; stdout; stderr }>, the load-bearing pure CLI core (third thin adapter mirroring executor.ts) with the two-step exit compose, nx-free path resolution + guarded realpathSync.native, single-vs-array collapse, and env color detection
  - src/cli/main.spec.ts -- 18 stubbed-core unit assertions locking the EXIT-01 branch matrix (incl. errorCount===0/success===false -> 1), CLI-03 routing, EXIT-02 purity, ARGS-03 single-vs-array, ARGS-05 color, VER-01 version drift-lock, plus 2 BufferingLogger contract assertions
affects: [26-03 main.integration.spec end-to-end run(argv) against real fixtures, 27 bin.ts wraps run() + the src/cli ESLint import-ban + bin-static module-graph guard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "run() is the THIRD thin adapter over the same core the Nx executor + Angular CLI builder compose -- mirrors executor.ts's compose order VERBATIM, swapping only the sink (BufferingLogger), the path resolver (node:path + guarded realpathSync.native), and the return shape (literal exitCode)"
    - "two-step exit compose (D-01): toExitCode appears ONLY in the infra catch (=2); usage -> 2 directly; the 0-vs-1 split reads evaluateResult(...).success, NEVER raw counts (anti-false-pass)"
    - "guarded realpathSync.native: ENOENT on a nonexistent path falls through to the plain resolved absolute path so the core raises its canonical TypecheckInfrastructureError -> exit 2, never an uncaught throw"

key-files:
  created:
    - packages/angular-typechecker/src/cli/main.ts
    - packages/angular-typechecker/src/cli/main.spec.ts
  modified: []

key-decisions:
  - "toExitCode is confined to the infra catch (its FIRST live consumer); the completed-run 0/1 split comes from evaluateResult(...).success so a coverage-incomplete / warnings-exceeded run (errorCount===0, success===false) correctly returns 1 -- the milestone's anti-false-pass invariant"
  - "realpathSync.native wrapped in try/catch with fall-through to the .replace'd resolved absolute path (RESEARCH Open Question 1 / Pitfall 2) so a nonexistent/malformed tsconfig returns exit 2 via the core, not an uncaught ENOENT"
  - "single --tsConfig collapses to a STRING (direct/solution-walk); 2+ stay a string[] (union) -- a single input is never a one-element array (would skip solution-walk)"
  - "run() is pure (D-02/EXIT-02): no process.exit, no stream write; stdout = renderReport only, stderr = the BufferingLogger's joined lines"
  - "Requirements NOT marked complete at this per-plan stage: CLI-02/03, ARGS-03/05, EXIT-01/02, PKG-03, VER-01 also span 26-03 (VER-02 integration) and/or phase verification; closure deferred to gsd-verifier per repo practice"

requirements-completed: []  # deferred to phase verification -- CLI-02/03, ARGS-03/05, EXIT-01/02, PKG-03, VER-01 span 26-02/26-03 + integration

# Metrics
duration: ~13min
completed: 2026-07-16
tasks: 2
files: 2
tests: 433
---

# Phase 26 Plan 02: Pure run(argv, env) CLI core + two-step exit-code wiring Summary

**The load-bearing `run(argv, env): Promise<{ exitCode: 0|1|2; stdout; stderr }>` -- the third thin adapter mirroring `executor.ts`'s compose order VERBATIM, swapping the `@nx/devkit` logger for the Wave-1 `BufferingLogger`, `joinPathFragments` for nx-free `node:path` + a guarded `realpathSync.native`, and the Nx `{ success }` return for the literal exit code via the two-step compose (infra -> `toExitCode`=2; usage -> 2 direct; completed -> `evaluateResult().success ? 0 : 1`) that prevents the silent false pass on a coverage-incomplete / warnings-exceeded run.**

## Performance

- **Duration:** ~13 min
- **Tasks:** 2
- **Files modified:** 2 created, 0 modified

## Accomplishments

- `main.ts`: `run(argv, env = process.env)` composes the SAME core as the Nx executor:
  parse (via Wave-1 `parseCliArgs`) -> help/version/usage short-circuits -> resolve + normalize
  each `--tsConfig` entry -> build `CoreOptions` -> `runTypecheck` -> `emitAdvisoryNotices(result, logger)`
  (BEFORE the report) -> `renderReport(result, { pathBase, color, failFast })` -> `evaluateResult(result, { maxWarnings, strict })`
  -> the literal exit code.
- **Two-step exit compose (D-01, the milestone's whole reason to exist):** a usage error returns `2`
  DIRECTLY before the core; a caught `TypecheckInfrastructureError` returns `toExitCode(error)` = `2`
  (its FIRST live consumer, and the ONLY `toExitCode` call site); a completed run returns
  `evaluateResult(...).success ? 0 : 1`. The 0/1 split NEVER reads raw counts, so a coverage-incomplete /
  warnings-exceeded run (`errorCount === 0`, `success === false`) correctly returns `1`.
- **nx-free path resolution (D-05/D-06/PKG-03):** `toAbsoluteTsConfigPath` resolves a relative `-c`
  against `process.cwd()` (absolute passes through), `.replace(/\\/g, '/')`-normalizes for POSIX-separator
  stability, then runs a **try/catch-guarded** `realpathSync.native` for Windows drive-letter-case / 8.3-name
  normalization. On ANY realpath failure it falls through to the plain resolved path so a nonexistent /
  malformed tsconfig returns exit `2` via the core's canonical error, never an uncaught ENOENT.
- **Single-vs-array collapse (ARGS-03/D-13):** a length-1 resolved array collapses to the single STRING
  (direct / solution-walk path); 2+ stay a `string[]` (union). A single input is never a one-element array.
- **Color (D-09/ARGS-05):** `colorFromEnv` computes precedence from the passed `env` -- `NO_COLOR` (any value)
  wins OFF; else `FORCE_COLOR` (not `"0"`/`"false"`) ON; else `process.stdout.isTTY === true`. Feeds `renderReport({ color })`.
- **Purity (D-02/D-03/EXIT-02):** `run()` never calls `process.exit` and never writes a stream; `stdout` is
  EXCLUSIVELY the `renderReport` output; every notice/error routes through the `BufferingLogger` to `stderr`.
- **nx-free boundary (D-15):** `main.ts` imports only Node stdlib + relative pure-core seams + the two Wave-1
  CLI modules; the acceptance greps for `@nx/devkit` / `from 'nx` / `../index` / `../executors` / `../builders`
  return nothing, and `toExitCode` appears only inside the infra catch.
- `main.spec.ts`: 20 unit assertions against a STUBBED core (mirroring `executor.spec.ts`'s `vi.hoisted` +
  `vi.mock(importOriginal)` pattern, one level up), keeping the REAL `TypecheckInfrastructureError`,
  `emitAdvisoryNotices`, `toExitCode`, and `BufferingLogger`.

## Task Commits

1. **Task 1: main.ts (run compose + two-step exit + guarded realpath + color)** - `8efdeac` (feat)
2. **Task 2: main.spec.ts (stubbed-core branch matrix)** - `4a88087` (test)

**Plan metadata:** committed with this SUMMARY + STATE.md + ROADMAP.md (docs).

## Files Created/Modified

- `packages/angular-typechecker/src/cli/main.ts` - `run(argv, env)` + the `RunResult` type + `colorFromEnv`
  + `toAbsoluteTsConfigPath` helpers; the load-bearing two-step exit compose.
- `packages/angular-typechecker/src/cli/main.spec.ts` - the EXIT-01 branch matrix (clean->0, type-error->1,
  coverage-incomplete AND warnings-exceeded [errorCount===0, success===false]->1, infra->2 via the real
  toExitCode, usage->2 direct, unknown->rethrow), CLI-03 routing (report->stdout, a real advisory notice->stderr),
  EXIT-02 purity (no process.exit / stdout.write), ARGS-03 single-vs-array, ARGS-05 color matrix, VER-01
  version drift-lock, and the D-04 BufferingLogger contract.

## Verification Results

- `nx build angular-typechecker`: green (main.ts compiles against the real core types).
- `nx test angular-typechecker`: green -- **433 tests / 42 files** (main.spec.ts contributes 20; was 413/41 after Wave 1).
- `nx lint angular-typechecker`: green at `maxWarnings:0`.
- `nx format:check` (Prettier) on both files: clean.
- Acceptance greps on `main.ts`: `toExitCode` used ONLY in the infra catch (line 175); the four banned-import
  tokens (`@nx/devkit` / `from 'nx` / `../index` / `../executors` / `../builders`) return nothing.

## Decisions Made

- **`toExitCode` confined to the infra catch.** It is verdict-blind by explicit design; the completed-run 0/1
  split reads `evaluateResult(...).success`, so a coverage-incomplete / warnings-exceeded run (errorCount 0,
  success false) returns 1 -- the milestone's anti-false-pass invariant. Two dedicated unit tests pin this.
- **Guarded `realpathSync.native` with fall-through** (RESEARCH Open Question 1 / Pitfall 2) so a
  nonexistent/malformed tsconfig returns exit 2 via the core, not an uncaught ENOENT (proven end-to-end in 26-03).
- **`RunResult` exported** from `main.ts` -- not speculative: `bin.ts` (Phase 27) and this spec both type against it.
- **Requirements left Pending** in REQUIREMENTS.md: CLI-02/03, ARGS-03/05, EXIT-01/02, PKG-03, VER-01 also span
  26-03's VER-02 integration and/or phase verification; marking them complete from a single plan would be
  inaccurate. Closure is deferred to phase verification (gsd-verifier), matching repo practice.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reworded a D-15 boundary doc-comment to drop the literal `@nx/devkit` token**
- **Found during:** Task 1 (nx-free boundary acceptance grep, before commit)
- **Issue:** A `main.ts` doc-comment documented the D-15 rule using the literal `@nx/devkit` token in prose.
  The plan's acceptance grep (`git grep "@nx/devkit\|..."`) must return NOTHING for the CLI file, and it
  matched the explanatory comment (not any actual import) -- the identical gate issue Wave 1 hit.
- **Fix:** Reworded to "the Nx devkit `logger`" so the boundary stays documented but the acceptance grep
  returns cleanly. No behavior change; no import change.
- **Files modified:** packages/angular-typechecker/src/cli/main.ts
- **Verification:** `rg` for the four banned import tokens returns no matches.
- **Committed in:** `8efdeac` (Task 1 commit)

**2. [Rule 3 - Blocking] Applied a Prettier pass to both new files before commit**
- **Found during:** Task 1 (main.ts) + Task 2 (main.spec.ts), on the pre-commit `format:check` gate.
- **Issue:** `nx format:check` (maxWarnings:0 CI gate) flagged a `colorFromEnv` condition wrap in main.ts
  and minor whitespace in the spec.
- **Fix:** `npx prettier --write` on each file (whitespace only; no logic change).
- **Files modified:** main.ts (folded into `8efdeac`), main.spec.ts (folded into `4a88087`).
- **Verification:** `nx format:check` clean on both files.

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking gate issues, both trivial and pre-commit).
**Impact on plan:** None on the delivered behavior or the locked decisions -- both were gate-conformance fixes
(the acceptance grep; format:check at maxWarnings:0). No scope change.

## Issues Encountered

- **TDD attribute vs task decomposition:** Task 1 carries `tdd="true"`, but its `<verify>` is `nx build` and
  the dedicated spec is a separate downstream task (Task 2, `type="auto"`, `<verify>` `nx test`). Followed the
  plan's explicit decomposition -- source in Task 1 (build-verified), the unit spec in Task 2 (test-verified) --
  rather than an inverted RED-first cycle. (MVP+TDD runtime gate was not active this run.)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 26-03 (`main.integration.spec.ts`) can now drive `run(argv)` end-to-end against the real cold compiler +
  committed `fixtures/` (VER-02): clean->0, planted TS/template/NG8xxx->1, real coverage-incomplete->1,
  `--max-warnings 0`/`--strict`->1, multi- and single-`--tsConfig` paths, and the malformed/nonexistent
  tsconfig->2 case that exercises the realpath ENOENT guard.
- Phase 27 will wrap `run()` in `bin.ts` (the only `process.exit`/stream-write site) and add the enforcing
  `src/cli/**` ESLint import-ban + the `bin-static.spec.ts` module-graph guard. The nx-free boundary is
  respected here by construction; `RunResult` is exported for `bin.ts` to type against.
- No blockers.

## Self-Check: PASSED
- Files: FOUND main.ts, FOUND main.spec.ts
- Commits: FOUND 8efdeac, FOUND 4a88087

---
*Phase: 26-pure-cli-core-exit-code-wiring*
*Completed: 2026-07-16*
