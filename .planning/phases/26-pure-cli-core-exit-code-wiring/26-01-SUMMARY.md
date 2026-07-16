---
phase: 26-pure-cli-core-exit-code-wiring
plan: 01
subsystem: cli
tags: [parseArgs, cli, logger, exit-codes, nx-free, util]

# Dependency graph
requires:
  - phase: 25-extract-the-advisory-notice-seam
    provides: the pure structural core/logger.ts Logger seam the BufferingLogger implements
provides:
  - src/cli/parse-args.ts -- util.parseArgs wrapper -> discriminated ParseResult (options | help | version | usageError), flag validation, usage-error mapping, help/version text
  - src/cli/console-logger.ts -- BufferingLogger implementing the core Logger, buffering info/warn/error into one newline-joined stderr string
  - src/cli/parse-args.spec.ts -- 19 unit assertions locking ARGS-01/02/04 flag mapping + usage-error branches + version drift-lock
affects: [26-02 main.ts run() compose, 26-03 main.integration.spec, 27 bin shell + src/cli ESLint import-ban]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "nx-free src/cli/** module: imports only node:util + the package.json manifest + a type-only core Logger (D-15), respected by construction"
    - "Discriminated ParseResult union so run() (26-02) switches on kind without re-parsing"
    - "BufferingLogger: all three Logger methods route to ONE ordered buffer (everything except the report is stderr)"

key-files:
  created:
    - packages/angular-typechecker/src/cli/parse-args.ts
    - packages/angular-typechecker/src/cli/console-logger.ts
    - packages/angular-typechecker/src/cli/parse-args.spec.ts
  modified: []

key-decisions:
  - "parse-args returns a raw tsConfig string[] (no single-vs-array collapse here; ARGS-03 collapse is run()'s job in 26-02)"
  - "--version reads the real package.json via require('../../package.json') (D-10); a drift-lock test proves it equals the manifest -- verified working under Vitest"
  - "--help synopsis presents 'npx angular-typechecker' and never 'npx atc' (D-11 supply-chain hazard)"
  - "Requirements NOT marked complete at this per-plan stage: ARGS-01/02/04, CLI-03, VER-01 each also depend on 26-02's run()/main.spec; closure deferred to phase verification (repo practice)"

patterns-established:
  - "CLI arg-parsing seam mirrors normalize-options.ts's pure typed knob-split shape"
  - "parseArgs strict:true wrapped in try/catch -> usageError (D-14); explicit missing-required + non-integer-max-warnings checks (D-08)"

requirements-completed: []  # deferred to phase verification -- ARGS-01/02/04, CLI-03, VER-01 span 26-02/26-03

# Metrics
duration: ~15min
completed: 2026-07-16
---

# Phase 26 Plan 01: Pure CLI parse-args + BufferingLogger Summary

**Nx-free `util.parseArgs` wrapper that maps argv to a typed discriminated `ParseResult` (options | help | version | usageError) with `-c` (never `-p`) + non-negative-integer `--max-warnings` + `npx angular-typechecker` help + manifest-drift-locked `--version`, plus a `BufferingLogger` that accumulates info/warn/error into one newline-joined stderr string.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-16T12:07:38Z
- **Completed:** 2026-07-16T12:22:17Z
- **Tasks:** 3
- **Files modified:** 3 created, 0 modified

## Accomplishments
- `parse-args.ts`: `util.parseArgs` (strict, no positionals, `-c/--tsConfig` repeatable, `-h`) mapped to a discriminated `ParseResult`; unknown flag / missing value / missing required `--tsConfig` / non-integer `--max-warnings` all map to a `usageError`; `-p`/`--project` deliberately unregistered; help text steers to `npx angular-typechecker` (never `npx atc`) and states the 0/1/2 exit-code contract; `--version` reads the real manifest.
- `console-logger.ts`: `BufferingLogger implements Logger` (type-only import from `../core/logger`); info/warn/error each push onto one private array; a `text` getter joins by `\n` (empty string when unused). No stream/console writes -- the real write is bin.ts (Phase 27).
- `parse-args.spec.ts`: 19 pure unit assertions (direct calls, no `vi.mock`) covering single/repeatable `-c`, boolean knob defaults+mapping, `-p`/`--project`/unknown-flag/missing-required/missing-value usage errors, the full `--max-warnings` validation matrix (0 and 3 accepted; `x`/`-1`/`1.5` rejected), `--help`/`-h` text guarantees, and the `--version` manifest drift-lock.

## Task Commits

1. **Task 1: parse-args.ts** - `8696c6b` (feat)
2. **Task 2: console-logger.ts** - `3b482bb` (feat)
3. **Task 3: parse-args.spec.ts** - `ef9a092` (test)

**Plan metadata:** committed with this SUMMARY + STATE.md + ROADMAP.md (docs).

## Files Created/Modified
- `packages/angular-typechecker/src/cli/parse-args.ts` - parseArgs wrapper + flag validation + usage-error mapping + help/version text; exports `parseCliArgs` and the `ParseResult` union.
- `packages/angular-typechecker/src/cli/console-logger.ts` - `BufferingLogger` implementing the core `Logger`, buffering all lines for the returned stderr.
- `packages/angular-typechecker/src/cli/parse-args.spec.ts` - 19 unit assertions (ARGS-01/02/04 + version drift-lock).

## Verification Results
- `nx build angular-typechecker`: green (parse-args.ts + console-logger.ts compile against the real core types).
- `nx test angular-typechecker`: green -- **413 tests / 41 files** (parse-args.spec.ts contributes 19).
- `nx lint angular-typechecker`: green at maxWarnings:0.
- `nx format:check` (Prettier) on the three files: clean.
- nx-free boundary grep on both source files (`@nx/devkit` / `from 'nx` / `from '../index` / `from '../executors`): **no matches** (D-15 respected by construction).

## Decisions Made
- **Kept `tsConfig` as the raw `string[]`** in `ParsedOptions` -- the ARGS-03 single-vs-array collapse belongs to `run()` (26-02); a single input must never become a one-element array or it would skip solution-tsconfig walking.
- **`--version` via `require('../../package.json')`** (the locked D-10 mechanism) -- empirically confirmed to work under Vitest (the drift-lock test passed), and lint-clean on its own (`@typescript-eslint/no-require-imports` is not enabled here). The spec reads the same manifest via the repo's established `readFileSync` idiom to assert equality.
- **Requirements left "Pending"** in REQUIREMENTS.md: ARGS-01/02/04, CLI-03, VER-01 each also depend on 26-02's `run()` + `main.spec.ts`; marking them complete from a single plan would be inaccurate. Closure is deferred to phase verification (gsd-verifier), matching the repo's "close requirement statuses at phase verification" practice.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed an unused `eslint-disable` directive that would fail `nx lint` at maxWarnings:0**
- **Found during:** Task 1 (parse-args.ts lint verification, before commit)
- **Issue:** I preemptively added `// eslint-disable-next-line @typescript-eslint/no-require-imports` above the manifest `require`. That rule is NOT enabled in this config, so the directive was unused, and `--report-unused-disable-directives` reported it as a warning -> `nx lint` failed at maxWarnings:0.
- **Fix:** Removed the directive. The plan's literal `require('../../package.json')` is lint-clean on its own; no mechanism change.
- **Files modified:** packages/angular-typechecker/src/cli/parse-args.ts
- **Verification:** `nx lint angular-typechecker` green (All files pass linting).
- **Committed in:** `8696c6b` (Task 1 commit)

**2. [Rule 3 - Blocking] Reworded the D-15 boundary doc-comments to drop the literal `@nx/devkit` token**
- **Found during:** Task 2 (nx-free boundary grep)
- **Issue:** Both files documented the D-15 rule using the literal `@nx/devkit` token in prose. The plan's acceptance-criteria grep (`git grep "@nx/devkit\|..."`) must return NOTHING for the CLI files, and it matched the explanatory comments (not any actual import).
- **Fix:** Reworded the comments to "the Nx devkit / the `nx` runtime" so the boundary is still documented but the acceptance grep returns cleanly. No behavior change; the parse-args comment reword was folded into the Task 1 commit via `--amend` (it is that file's own comment).
- **Files modified:** parse-args.ts (amended into `8696c6b`), console-logger.ts (`3b482bb`)
- **Verification:** working-tree grep for the four banned import tokens returns no matches.
- **Committed in:** `8696c6b` + `3b482bb`

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking gate issues, both trivial and pre-commit).
**Impact on plan:** None on the delivered behavior or the locked decisions -- both were gate-conformance fixes (lint at maxWarnings:0; the acceptance grep). No scope change.

## Issues Encountered
- **TDD attribute vs task decomposition:** Tasks 1 and 2 carry `tdd="true"`, but their `<verify>` is `nx build` and the dedicated spec is a separate downstream task (Task 3, `type="auto"`). Followed the plan's explicit decomposition -- source in Tasks 1/2 (build-verified), the unit spec in Task 3 (test-verified) -- rather than an inverted RED-first cycle that would have merged the Task 3 spec into Task 1. (MVP+TDD runtime gate was not active this run.)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The two contracts 26-02's `run()` imports are ready: the typed `ParseResult` union (relative import `./parse-args`) and a ready `BufferingLogger` (relative import `./console-logger`).
- console-logger.ts has no separate spec by design (RESEARCH Open Question 2) -- its behavior is exercised through `run()` in 26-02's `main.spec.ts`.
- No blockers. The nx-free `src/cli/**` boundary is respected by construction; its enforcing ESLint ban + static module-graph guard land in Phase 27.

## Self-Check: PASSED
- Files: FOUND parse-args.ts, FOUND console-logger.ts, FOUND parse-args.spec.ts
- Commits: FOUND 8696c6b, FOUND 3b482bb, FOUND ef9a092

---
*Phase: 26-pure-cli-core-exit-code-wiring*
*Completed: 2026-07-16*
