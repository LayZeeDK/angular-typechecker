---
phase: 26-pure-cli-core-exit-code-wiring
plan: 03
subsystem: cli
tags: [integration, ver-02, exit-codes, real-cold-compiler, realpath-guard, coverage-incomplete, args-03]

# Dependency graph
requires:
  - phase: 26-pure-cli-core-exit-code-wiring
    plan: 02
    provides: the pure run(argv, env) core (two-step exit compose, guarded realpath, single-vs-array collapse) this spec drives end-to-end
provides:
  - src/cli/main.integration.spec.ts -- VER-02 real-cold-compiler end-to-end coverage of run(argv) against committed fixtures/ (12 in-process cases proving CLI-02 verdict parity, CLI-03 routing, EXIT-01 exit codes, ARGS-03 collapse, PKG-03 relative-cwd normalization, and the D-06 realpath ENOENT guard)
affects: [27 bin.ts wraps run() + the src/cli ESLint import-ban + bin-static module-graph guard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "the CLI integration spec mirrors src/core/run-typecheck.integration.spec.ts VERBATIM (findWorkspaceRoot + join(workspaceRoot, 'fixtures', ...) + real cold compiler) one dir up, calling run(argv) IN-PROCESS and asserting on the returned { exitCode, stdout, stderr } -- NO spawn, NO tarball, NO process.exit"
    - "assertions read the RENDERED report (stdout), where compiler-cli's formatDiagnostics prints the HUMAN code form (TS2322 / NG8109); the negative-encoding NG() helper the core specs use is inapplicable and deliberately absent (run() never exposes the numeric CoreResult.diagnostics)"
    - "NO_COLOR env is passed to run() so renderReport strips ANSI regardless of the runner's TTY -- deterministic substring assertions across the 6-cell matrix"

key-files:
  created:
    - packages/angular-typechecker/src/cli/main.integration.spec.ts
  modified: []

key-decisions:
  - "A malformed tsconfig (broken `extends` target) asserts exit 1, NOT the plan's stated exit 2: config-broken/tsconfig.malformed.json folds a COUNTED 5012 config error on a COMPLETED run (locked by config-resolution.integration.spec.ts) -- it never throws TypecheckInfrastructureError, so run()'s completed-run branch returns evaluateResult(...).success ? 0 : 1 = 1. Only a nonexistent PATH (ENOENT) is the infra exit 2. This is the COR-01/MD-01 distinction, now proven end-to-end through run()."
  - "The REAL coverage-incomplete case (errorCount 0, success false) is driven via a TWO-entry array [cleanLeaf, solution-style-empty], not a single -c empty leaf: run()'s ARGS-03 collapse hands a single -c to the core as a STRING (reference-walk), which surfaces the zero-root-names guard as a COUNTED 90001 error (a type-error, errorCount 1). Only an ARRAY entry records the zero-root-names SKIP that yields the coverage-incomplete verdict the unit tier can only stub -- so the empty leaf is unioned with a clean sibling to keep errorCount 0 and leave the skip as the sole fail signal."
  - "The single-vs-array ARGS-03 collapse is proven end-to-end by a contrast pair: a single -c solution tsconfig reference-walks its leaves (BOTH app + spec TS2322 in stdout, no zero-root-names skip in stderr) while a two-entry -c unions two leaves -- the one-element-array skip a wrong collapse would cause is absent."
  - "Requirements NOT marked complete here: CLI-02/EXIT-01/PKG-03/VER-02 span 26-02 (unit) + this plan (integration) + phase verification; closure is deferred to gsd-verifier per repo practice (matching 26-02)."

requirements-completed: []  # deferred to phase verification -- CLI-02, EXIT-01, PKG-03, VER-02 span 26-02/26-03 + integration

# Metrics
duration: ~20min
completed: 2026-07-16
tasks: 1
files: 1
tests: 119
---

# Phase 26 Plan 03: VER-02 end-to-end run(argv) integration spec Summary

**`main.integration.spec.ts` drives the Wave-2 `run(argv, env)` core IN-PROCESS against the committed real-cold-compiler `fixtures/` (12 cases, NO spawn / NO tarball / NO `process.exit`), proving the literal exit codes the unit stubs can only fake: clean -> 0; planted TS/template-NG8xxx, real coverage-incomplete, `--max-warnings 0`, `--strict`+`--max-warnings 0`, multi- and single-`--tsConfig` -> 1; a nonexistent tsconfig -> 2 through the D-06 realpath ENOENT guard -- plus CLI-03 stdout/stderr routing, the ARGS-03 single-vs-array collapse, and PKG-03 relative-cwd normalization.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 1
- **Files modified:** 1 created, 0 modified

## Accomplishments

- `main.integration.spec.ts`: 12 real-compiler cases exercising `run(argv, env)` end-to-end,
  each asserting on the returned `{ exitCode, stdout, stderr }` (never a stub):
  - **Clean fixture** (`not-type-checked-clean`) -> `exitCode 0` with an empty `stderr` (a clean run stays silent).
  - **Planted TS error** (`gate-b-error/tsconfig.app.json`) -> `exitCode 1`; `TS2322` present in `stdout` (the report) and ABSENT from `stderr` -- the CLI-03 routing contract / T-26-04 proven against the real compiler.
  - **Template / NG8xxx** (same program) -> `exitCode 1`; the rendered human `NG8109` present in `stdout`.
  - **REAL coverage-incomplete** (`[clean, solution-style-empty]` array) -> `exitCode 1` with the zero-root-names skip advisory in `stderr` -- errorCount 0, success false; the anti-false-pass floor no unit stub can fake.
  - **Warning gate:** the reported NG8xxx warning fixture (`extended-v13`) exits `0` with NO gate (warnings never fail alone), `1` under `--max-warnings 0`, and `1` under `--strict` + `--max-warnings 0` (CORRECTED per plan: `--strict` alone fails only on a DROPPED in-graph warning, which this reported-warning fixture does not have, so the fail is driven by the warnings gate -- the `assert exitCode 1` is not weakened).
  - **ARGS-03 collapse:** two `-c` entries UNION both leaves (`TS2322` + `TS2345` in `stdout`); a single `-c` solution tsconfig reference-WALKS its leaves (both `error.component.ts` and `error.component.spec.ts` surface their `TS2322`, NO zero-root-names skip in `stderr`) -- the spec-file error is reachable only through the spec leaf, the named build differentiator.
  - **Config-resolution failures:** a malformed tsconfig (broken `extends`) -> `exitCode 1` (folded 5012 config error, the target named in `stdout`); a NONEXISTENT path -> `exitCode 2` with `stderr` containing "the Angular compiler failed to run" and an empty `stdout` -- the D-06 realpath ENOENT guard / T-26-02 proven end-to-end (never an uncaught throw).
  - **PKG-03:** a relative `-c` resolved from a `chdir`'d cwd (restored in `finally`) yields the SAME `exitCode` as the canonical absolute-path invocation.

## Task Commits

1. **Task 1: main.integration.spec.ts (VER-02 end-to-end)** - `73a4816` (test)

**Plan metadata:** committed with this SUMMARY + STATE.md + ROADMAP.md (docs).

## Files Created/Modified

- `packages/angular-typechecker/src/cli/main.integration.spec.ts` - the VER-02 real-cold-compiler
  end-to-end suite driving `run(argv)` in-process against committed `fixtures/`.

## Verification Results

- `nx run angular-typechecker:integration`: green -- **21 files / 119 tests**; `main.integration.spec.ts`
  contributes **12 tests**, all passing (integration duration ~55s wall).
- `nx lint angular-typechecker`: green at `maxWarnings:0` (All files pass linting).
- `nx format:check` (Prettier) on the new file: clean.
- `nx build angular-typechecker`: green (ran as the `dependsOn: build` prerequisite of the integration target).
- Unit tier (`nx test angular-typechecker`) is unaffected: the added file is `*.integration.spec.ts`,
  excluded by `vitest.config.mts` and included only by `vitest.integration.config.mts` (no double-run, no unit regression).

## Decisions Made

- **Malformed tsconfig -> exit 1, not the plan's exit 2.** A broken `extends` TARGET is folded by the
  compiler into a COUNTED 5012 config error on a COMPLETED run (locked by
  `config-resolution.integration.spec.ts`), so `run()`'s completed-run branch returns
  `evaluateResult(...).success ? 0 : 1 = 1`; it never throws `TypecheckInfrastructureError`, so it never
  reaches the exit-2 infra path. Only a nonexistent PATH (ENOENT) is infra exit 2. Asserting exit 2 for the
  malformed file would be a knowingly-false test. See Deviations.
- **Coverage-incomplete driven via a two-entry array.** `run()`'s ARGS-03 collapse routes a single `-c`
  through the STRING walk-path, which surfaces the empty leaf's zero-root-names guard as a COUNTED 90001
  error (a type-error). Only the ARRAY path records the zero-root-names SKIP that produces the
  `errorCount 0 / success false` coverage-incomplete verdict the plan requires ("a case no unit stub can
  fake"), so the empty leaf is unioned with a clean sibling. See Deviations.
- **NG() negative-code helper omitted.** Assertions read the rendered `stdout` where `formatDiagnostics`
  prints the human `NG8109`; the negative-encoding helper is only for the numeric `CoreResult.diagnostics`
  field, which `run()` does not expose. Adding an unused helper would fail lint at `maxWarnings:0`.
- **Requirements left Pending** (CLI-02/EXIT-01/PKG-03/VER-02): these span 26-02 (unit) + this plan
  (integration) + phase verification; closure deferred to `gsd-verifier`, matching repo practice.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Plan expectation contradicts locked behavior] Malformed tsconfig asserts exit 1, not the plan's exit 2**
- **Found during:** Task 1 (reading `config-resolution.integration.spec.ts` before writing the exit-code cases)
- **Issue:** The plan's `must_haves`, acceptance, done, and threat model all state
  `fixtures/config-broken/tsconfig.malformed.json` -> exit 2. But that file is a REAL file whose `extends`
  target does not exist, which the compiler folds into a COUNTED 5012 config error on a COMPLETED run --
  `runTypecheck` RETURNS `errorCount >= 1` and does NOT throw `TypecheckInfrastructureError` (locked by two
  assertions in `config-resolution.integration.spec.ts`). Through `run()` this is the completed-run branch
  -> `evaluateResult(...).success ? 0 : 1 = 1`, never the infra exit 2. Asserting exit 2 would be a
  knowingly-false test.
- **Fix:** Asserted the true behavior: the malformed file -> `exitCode 1` with the unresolvable `extends`
  target named in `stdout` (a completed-run counted config error); the NONEXISTENT PATH (ENOENT) -> the
  infra `exitCode 2`. This preserves both exit-code branches AND proves the COR-01/MD-01 distinction
  (folded config diagnostic vs infra failure) end-to-end. No production code changed.
- **Files modified:** `packages/angular-typechecker/src/cli/main.integration.spec.ts`
- **Verification:** `nx run angular-typechecker:integration` green; both cases pass with their literal exit codes.
- **Committed in:** `73a4816`

**2. [Rule 3 - Blocking: ARGS-03 collapse prevents the single-string empty-leaf coverage-incomplete path] Coverage-incomplete driven via a two-entry array**
- **Found during:** Task 1 (reconciling the plan's "solution-style-empty -> errorCount 0 but success false" with `run()`'s single-vs-array collapse + `walk-references.integration.spec.ts`)
- **Issue:** The plan lists `fixtures/solution-style-empty` for the "REAL coverage-incomplete (errorCount 0,
  success false)" case. But `run()` collapses a single `-c` to a STRING, and the STRING walk-path turns an
  empty leaf into a COUNTED 90001 zero-root-names guard error (`errorCount 1`, a type-error) -- NOT the
  coverage-incomplete verdict (locked by `walk-references.integration.spec.ts` "empty-project -> 90001"
  vs `multi-tsconfig.integration.spec.ts` "array [emptyLeaf] -> zero-root-names skip -> coverage-incomplete").
  A single-element array cannot reach `run()` (it collapses).
- **Fix:** Passed the empty leaf as ONE entry of a TWO-entry array `[cleanLeaf, solution-style-empty]`. The
  array path records the zero-root-names SKIP; the clean sibling contributes zero diagnostics, so
  `errorCount` stays 0 and the skip is the sole fail signal -> the genuine `success false` coverage-incomplete
  verdict (asserted via `exitCode 1` + the `zero-root-names` skip advisory in `stderr`). Faithfully proves
  the "no unit stub can fake" intent while honoring the ARGS-03 collapse.
- **Files modified:** `packages/angular-typechecker/src/cli/main.integration.spec.ts`
- **Verification:** `nx run angular-typechecker:integration` green; the case exits 1 with the coverage-incomplete advisory.
- **Committed in:** `73a4816`

---

**Total deviations:** 2 (both forced by locked, already-tested core behavior contradicting the plan's stated
fixture semantics -- no production code changed, no assertion weakened).
**Impact on plan:** Both exit-code branches (1 and 2) are still proven; the coverage-incomplete verdict is
proven MORE faithfully (the genuine errorCount-0/success-false path) than the plan's single-string fixture
would have allowed. VER-02, CLI-03, ARGS-03, PKG-03, and the D-06 realpath guard are all covered end-to-end.

## Issues Encountered

- **Plan fixture guidance vs. locked core behavior (both deviations above).** The plan's fixture table
  described the ARRAY-path semantics of `solution-style-empty` and mislabeled the malformed-config exit
  code; both were reconciled by reading the existing locked integration specs
  (`config-resolution` / `walk-references` / `multi-tsconfig`) rather than trusting the plan table.
  No blocker -- the true behavior is a superset of the plan's intent.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 27 wraps `run()` in `bin.ts` (the only `process.exit` / stream-write site), adds the enforcing
  `src/cli/**` ESLint import-ban, and the `bin-static.spec.ts` module-graph guard. `run()` is now proven
  end-to-end (exit codes + routing + path normalization), so `bin.ts` only needs to write `stdout`/`stderr`
  and exit with the returned `exitCode`.
- No blockers.

## Threat Flags

None -- the spec introduces no new security surface (test-only; drives the already-audited `run()` over
committed fixtures). T-26-02 (realpath ENOENT guard) and T-26-04 (stdout/stderr routing) are now verified
end-to-end, as the threat model intended.

## Self-Check: PASSED
- Files: FOUND packages/angular-typechecker/src/cli/main.integration.spec.ts
- Commits: FOUND 73a4816

---
*Phase: 26-pure-cli-core-exit-code-wiring*
*Completed: 2026-07-16*
