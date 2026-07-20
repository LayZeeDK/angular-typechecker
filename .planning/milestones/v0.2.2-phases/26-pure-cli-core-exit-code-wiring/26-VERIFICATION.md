---
phase: 26-pure-cli-core-exit-code-wiring
verified: 2026-07-16T15:40:00Z
status: passed
score: 15/15 must-haves verified
overrides_applied: 0
re_verification:
  # No prior VERIFICATION.md existed for this phase -- initial verification.
requirements_accounted:
  - CLI-02
  - CLI-03
  - ARGS-01
  - ARGS-02
  - ARGS-03
  - ARGS-04
  - ARGS-05
  - EXIT-01
  - EXIT-02
  - PKG-03
  - VER-01
  - VER-02
accepted_deviations:
  - truth: "VER-02 malformed tsconfig -> exit 2"
    actual: "A broken-`extends` malformed tsconfig folds to a COUNTED 5012 config error on a COMPLETED run -> exit 1 (locked by config-resolution.integration.spec.ts). Only a NONEXISTENT path is the infra exit 2."
    assessment: "EXIT-01 / VER-02 STILL SATISFIED. The exit-2 infra path (TypecheckInfrastructureError -> toExitCode = 2) is genuinely proven end-to-end via the nonexistent-path case. malformed -> 1 is the CORRECT locked behavior (COR-01/MD-01 distinction); the plan's stated exit 2 was a planning-time expectation that contradicted already-tested core behavior. No production code changed."
  - truth: "VER-02 real coverage-incomplete driven via a single -c empty leaf"
    actual: "Driven via a two-entry array [cleanLeaf, solution-style-empty] because run()'s ARGS-03 collapse routes a single -c through the STRING walk-path (which surfaces the empty leaf as a COUNTED 90001 error). Only the ARRAY path records the zero-root-names SKIP that yields the errorCount-0/success-false coverage-incomplete verdict."
    assessment: "VER-02 STILL SATISFIED -- MORE faithfully. The two-entry array proves the genuine errorCount===0 / success===false anti-false-pass floor the unit tier can only stub. No production code changed."
---

# Phase 26: Pure CLI core + exit-code wiring Verification Report

**Phase Goal:** A pure `run(argv, env)` resolves flags, runs the SAME `runTypecheck` core, and returns the correct `{ exitCode, stdout, stderr }` -- with the two-step exit-code compose that owns literal `2` for infra/usage and derives the `0`-vs-`1` split from `evaluateResult().success`, never from raw error counts. All load-bearing correctness lives here, fully unit- and integration-testable in-process with no packaging.
**Verified:** 2026-07-16T15:40:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| 1  | (SC1) `run(argv, env)` parses `--tsConfig`/`-c` (repeatable, required), `--max-warnings`, `--fail-fast`, `--include-deps`, `--strict`, `--help`/`-h`, `--version` via `util.parseArgs` with ZERO new deps, composing `runTypecheck` | VERIFIED | parse-args.ts:103-120 registers the exact D-12 flag surface via `node:util` parseArgs (short `c`, `multiple:true` for tsConfig, `strict:true`, `allowPositionals:false`); main.ts:148 composes `runTypecheck`. package.json deps (`@nx/devkit`,`nx`,`tslib`) untouched since the 0.2.1 release commit -- zero new deps. |
| 2  | (SC2) clean->0; type-error OR warnings-exceeded OR coverage-incomplete->1 via `evaluateResult().success` even when `errorCount===0`; `TypecheckInfrastructureError`->2 via `toExitCode`; unknown flag / missing `--tsConfig` / non-integer `--max-warnings`->usage 2 | VERIFIED | main.ts:120-124 (usage->2 direct), :164-169 (`success ? 0 : 1`), :174-179 (infra->2 via toExitCode). Unit main.spec.ts EXIT-01 block asserts coverage-incomplete AND warnings-exceeded with `errorCount:0` both ->1; integration confirms real coverage-incomplete->1 and nonexistent tsconfig->2. |
| 3  | (SC3) `--help`/`-h` and `--version` print + return 0; single `--tsConfig`->string, 2+->string[] (never a one-element array) | VERIFIED | main.ts:128-130 (help/version->0), :135-137 (length===1 ? string : string[]). Integration proves single-solution -c reference-WALKS (both app+spec leaves, no zero-root-names skip) vs two-entry -c UNION. |
| 4  | (SC4) CLI imports ONLY pure-core (no `@nx/devkit`/`nx` at runtime); `run()` never `process.exit`/writes a stream; report->stdout, notices/errors->stderr; color honors NO_COLOR/FORCE_COLOR/TTY; tsconfig paths resolve from arbitrary CWD via nx-free `node:path` + `realpathSync.native` | VERIFIED | `git grep` of banned import tokens in `src/cli/*.ts` matches only prose comments, zero actual imports. EXIT-02 purity test spies confirm no `process.exit`/`stdout.write`. colorFromEnv (main.ts:55-71) implements NO_COLOR>FORCE_COLOR>isTTY. toAbsoluteTsConfigPath (main.ts:88-98) = guarded `realpathSync.native`. BufferingLogger routes all lines to stderr. |
| 5  | (SC5) in-process `*.spec.ts` cover pure logic vs STUBBED core (VER-01) AND `run(argv)` end-to-end vs real-cold-compiler fixtures (VER-02) | VERIFIED | parse-args.spec.ts (19 assertions) + main.spec.ts (20, stubbed core) + main.integration.spec.ts (12, real cold compiler). Verifier re-ran both tiers: `nx test` = 433 passed / 42 files; `nx run :integration` = 119 passed / 21 files. |
| 6  | (P1) parse-args maps `-c`/`--tsConfig` repeatable + rejects unknown flag, missing required `--tsConfig`, non-integer `--max-warnings` as usage errors | VERIFIED | parse-args.ts:130-172; parse-args.spec.ts usage-error + max-warnings validation blocks. |
| 7  | (P1) `--help`/`-h` and `--version` resolve stdout text; version from the real manifest | VERIFIED | parse-args.ts:20,122-128; HELP_TEXT says `npx angular-typechecker`, never `npx atc`. Drift-lock test in parse-args.spec.ts:199-203 + main.spec.ts:192-199. |
| 8  | (P1) `-p`/`--project` is NOT registered (surfaces as unknown-flag usage error) | VERIFIED | No `p` short / `project` option in parse-args.ts:107-119; parse-args.spec.ts:92-101 asserts both `-p` and `--project` -> usageError. |
| 9  | (P1) BufferingLogger accumulates info/warn/error into one buffer joined for stderr | VERIFIED | console-logger.ts:19-38 (one `lines[]`, `text` getter joins by `\n`); main.spec.ts:315-327 asserts ordered join + empty-string default. |
| 10 | (P2) `run()` exit codes 0/1/2 incl. `errorCount===0`/`success===false`->1; usage->2; never `process.exit`/stream write | VERIFIED | Same evidence as truths 2 + 4. |
| 11 | (P2) single `--tsConfig`->string; 2+->string[] | VERIFIED | main.spec.ts ARGS-03 block asserts `typeof passed === 'string'` for single, `Array.isArray` + length 2 for two. |
| 12 | (P2) color from env: NO_COLOR wins over FORCE_COLOR; FORCE_COLOR=0/false off; else isTTY | VERIFIED | main.ts:55-71; main.spec.ts ARGS-05 block asserts all four precedence branches via the color option captured by the renderReport stub. |
| 13 | (P2) `run(['--version'])` stdout equals the real package.json version | VERIFIED | main.spec.ts:192-199 compares to manifest read via readFileSync. |
| 14 | (P3) `run(argv)` end-to-end verdicts on real fixtures: clean->0; TS/template/NG8xxx, coverage-incomplete, --max-warnings 0, --strict->1; nonexistent tsconfig->2 (malformed->1, accepted deviation) | VERIFIED | main.integration.spec.ts 12 cases, all green in the verifier's own integration run. See Accepted Deviations for the malformed-vs-nonexistent exit-2 attribution. |
| 15 | (P3) single solution `--tsConfig` walks references; two-entry unions; planted code in stdout not stderr; relative -c from non-root CWD -> same verdict | VERIFIED | main.integration.spec.ts:165-195 (walk vs union), :87-96 (TS2322 in stdout, not stderr), :230-255 (chdir'd relative -c == absolute verdict). |

**Score:** 15/15 truths verified (2 truths carry accepted, documented deviations that do not break any success criterion).

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/cli/parse-args.ts` | util.parseArgs wrapper + validation + usage mapping + help/version | VERIFIED | 174 lines; discriminated `ParseResult` union; `-c` short, no `-p`; D-08 max-warnings validation; manifest `--version`; nx-free. |
| `src/cli/console-logger.ts` | BufferingLogger implements core Logger | VERIFIED | 38 lines; `implements Logger`; one buffer; `text` getter; type-only `../core/logger` import. |
| `src/cli/main.ts` | `run(argv,env)` compose + two-step exit + nx-free path + color | VERIFIED | 187 lines; `toExitCode` used ONLY in infra catch (line 179); 0/1 from `evaluateResult().success`; guarded realpath. |
| `src/cli/parse-args.spec.ts` | unit flag-mapping + usage-error coverage | VERIFIED | 19 assertions, all green. |
| `src/cli/main.spec.ts` | stubbed-core branch matrix | VERIFIED | 20 assertions, all green. |
| `src/cli/main.integration.spec.ts` | VER-02 real-cold-compiler end-to-end | VERIFIED | 12 cases, all green (real @angular/compiler-cli). |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| main.ts | ../core/run-typecheck | `runTypecheck` + `TypecheckInfrastructureError` | WIRED | Both exported (run-typecheck.ts:20 CoreOptions, :166 error class); imported main.ts:9-12; runTypecheck called :148; error `instanceof` :174. |
| main.ts | ../core/evaluate-result + ../core/exit-codes | evaluateResult owns 0/1; toExitCode owns literal 2 | WIRED | evaluateResult :164 (0/1 split); toExitCode :179 (infra only). Confirmed by grep: toExitCode call site is solely the infra catch. |
| main.ts | ../core/render-report | renderReport(result, {pathBase,color,failFast}) | WIRED | `export async function renderReport` (render-report.ts:43); called main.ts:154. |
| main.ts | ../core/emit-advisory-notices | emitAdvisoryNotices(result, logger) BEFORE report | WIRED | Exported (emit-advisory-notices.ts:23); called main.ts:152 before renderReport. |
| main.ts | ./parse-args + ./console-logger | consume ParseResult union + inject BufferingLogger | WIRED | parseCliArgs :116; `new BufferingLogger()` :115. |
| parse-args.ts | node:util parseArgs | strict, no positionals, short c/h, multiple tsConfig | WIRED | parse-args.ts:1,103-120. |
| console-logger.ts | ../core/logger | type-only `Logger` import, structural implement | WIRED | console-logger.ts:1 `import type`; :19 `implements Logger`. |
| main.integration.spec.ts | ./main run() | in-process call vs findWorkspaceRoot fixtures | WIRED | :7 import; :34-36 findWorkspaceRoot; 12 in-process `run([...])` calls. |

### Data-Flow Trace (Level 4)

Not applicable in the rendering-component sense -- this phase ships pure library functions, not a UI. The equivalent "does real data flow" check is the VER-02 integration tier, which drives the REAL cold `@angular/compiler-cli` end-to-end and asserts real diagnostic codes (TS2322, TS2345, NG8109, NG8101) flow through `run()` into the returned stdout, and real coverage-incomplete / infra signals flow into the exit code + stderr. All 12 integration cases green -- real data confirmed flowing.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Unit tier (VER-01, stubbed core) | `nx test angular-typechecker --skip-nx-cache` | 433 passed / 42 files | PASS |
| Integration tier (VER-02, real cold compiler) | `nx run angular-typechecker:integration --skip-nx-cache` | 119 passed / 21 files | PASS |
| Lint at maxWarnings:0 | `nx lint angular-typechecker --skip-nx-cache` | All files pass linting | PASS |
| Format (Prettier) | `nx format:check` | exit 0, clean | PASS |
| Zero new deps | `git log -- packages/angular-typechecker/package.json` | last touched at `chore(release): publish 0.2.1` (pre-phase-26) | PASS |
| Two-step compose real | `git grep -n toExitCode -- .../cli/main.ts` | sole call site line 179 (infra catch); 0/1 reads evaluateResult().success | PASS |
| nx-free boundary | `git grep` banned tokens in src/cli/*.ts | only prose-comment matches, zero actual imports | PASS |

### Probe Execution

No probe scripts declared for this phase (not a migration/tooling phase; verification is via the Vitest unit + integration tiers, run above). Step 7c: N/A.

### Requirements Coverage

All 12 phase requirement IDs are accounted for. REQUIREMENTS.md lists each as `Pending` by repo practice (statuses close at phase verification); each is now SATISFIED in code.

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| CLI-02 | 26-02, 26-03 | Same verdict/diagnostics as executor by composing runTypecheck | SATISFIED | main.ts composes the identical core pipeline as executor.ts; VER-02 proves parity (TS/NG codes, solution-walk, boundary filtering) end-to-end. |
| CLI-03 | 26-01, 26-02 | nx-free import boundary + report->stdout, notices/errors->stderr | SATISFIED | grep boundary clean; CLI-03 routing tests (unit + integration) assert code in stdout, notices in stderr. |
| ARGS-01 | 26-01 | util.parseArgs, zero new deps | SATISFIED | parse-args.ts:1 `node:util`; package.json unchanged. |
| ARGS-02 | 26-01 | `-c`/`--tsConfig` repeatable+required, no `-p`; knob mapping | SATISFIED | parse-args.ts flag set; `-p`/`--project` -> usageError tests. |
| ARGS-03 | 26-02, 26-03 | single->string, 2+->string[] | SATISFIED | main.ts:135-137; unit + integration collapse proofs. |
| ARGS-04 | 26-01 | help/version->0; unknown/missing/non-integer->usage 2 | SATISFIED | parse-args.ts + main.ts short-circuits; full test matrix. |
| ARGS-05 | 26-02 | color honors NO_COLOR/FORCE_COLOR/TTY | SATISFIED | colorFromEnv + ARGS-05 test block. |
| EXIT-01 | 26-02, 26-03 | literal 0/1/2; infra->2 via toExitCode; 0/1 from evaluateResult().success | SATISFIED | two-step compose verified; errorCount===0/success===false->1 proven; infra->2 proven via nonexistent-path case. |
| EXIT-02 | 26-02 | pure run(); no process.exit / stream write | SATISFIED | purity spies confirm; doc-comment-only matches for process.exit. |
| PKG-03 | 26-02, 26-03 | nx-free path resolution + realpathSync.native from arbitrary CWD | SATISFIED | toAbsoluteTsConfigPath; PKG-03 relative-cwd integration case. |
| VER-01 | 26-01, 26-02 | unit *.spec.ts vs stubbed core | SATISFIED | parse-args.spec.ts + main.spec.ts, 433-test tier green. |
| VER-02 | 26-03 | integration *.integration.spec.ts vs real cold compiler | SATISFIED | main.integration.spec.ts, 119-test tier green (with accepted fixture-attribution deviations). |

No orphaned requirements: REQUIREMENTS.md maps exactly CLI-02, CLI-03, ARGS-01..05, EXIT-01/02, PKG-03, VER-01/02 to Phase 26, and all appear in the plans' `requirements` frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | -- | No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER in src/cli/* | -- | Clean. The two `process.exit`/`stdout.write` grep hits in main.ts are doc comments documenting the EXIT-02 purity guarantee, not calls (confirmed by the purity spy test). |

Advisory code-review findings (26-REVIEW.md): 0 blockers, 2 warnings (WR-01 lenient `Number()` for `--max-warnings`; WR-02 blank `-c` value not rejected) + 4 info. These are input-validation robustness polish at the CLI trust boundary. Neither breaks a success criterion: WR-01's edge cases (empty string, hex/exponent) never cause a false PASS (they fail-safe by over-gating or resolve to a valid integer), and WR-02's blank path surfaces as a downstream config/infra error (exit 1/2), not a silent pass. Recorded as advisory, NOT verification gaps -- consistent with the phase-26 review disposition.

### Human Verification Required

None. This phase is pure in-process logic with no runnable binary (the `bin.ts` shell, `process.exit`, and stream writes are deferred to Phase 27), no UI, no real-time behavior, and no external service. Every observable truth is covered by the unit + integration tiers, both of which the verifier re-ran independently to green.

### Gaps Summary

No gaps. All 5 ROADMAP success criteria are true in the shipped code (`packages/angular-typechecker/src/cli/`), all 3 plans' `must_haves.truths` hold, all 12 requirement IDs are satisfied, the two-step exit compose is real (`toExitCode` confined to the infra catch; the 0/1 split reads `evaluateResult().success`), the guarded `realpathSync.native` returns exit 2 (not an uncaught throw) on a nonexistent path, zero new dependencies were added, and the nx-free boundary holds by construction.

Two execution deviations from the plans are recorded and ACCEPTED (see `accepted_deviations` in frontmatter): (a) a broken-`extends` malformed tsconfig folds to a COUNTED config error -> exit 1 (only a NONEXISTENT path is the infra exit 2), and (b) the real coverage-incomplete verdict is driven via a two-entry array because run()'s ARGS-03 collapse routes a single `-c` through the string walk-path. Both are grounded in existing locked integration specs (config-resolution / walk-references / multi-tsconfig), no production code changed, and neither weakens VER-02 or EXIT-01 -- the infra exit-2 path is genuinely proven via the nonexistent-path case, and the coverage-incomplete `errorCount===0`/`success===false` floor is proven MORE faithfully via the array path.

---

_Verified: 2026-07-16T15:40:00Z_
_Verifier: Claude (gsd-verifier)_
