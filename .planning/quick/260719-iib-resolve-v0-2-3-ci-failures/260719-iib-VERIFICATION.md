---
phase: 260719-iib-resolve-v0-2-3-ci-failures
verified: 2026-07-19T14:15:00Z
status: gaps_found
score: 5/6 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "PR #47's `ci` check is green (the stated task goal)"
    status: failed
    reason: >
      The three fix commits (6817f87, 6a5aba0, 6f8e455) exist ONLY on the local
      branch and have NEVER been pushed to origin. `git rev-list --left-right
      --count origin/gsd/v0.2.3-machine-readable-reporters...HEAD` returns "0  3"
      (local is 3 commits ahead, remote has none of them). `gh pr checks 47` and
      `gh run view` confirm the most recent CI run on PR #47 (run 29684538313,
      2026-07-19T11:06:20Z) ran against headSha c792d3b (the pre-fix "ship"
      commit) and shows exactly the three failures this task set out to fix:
      `ci fail`, `fallow fail`, `test (macos-latest, 24) fail`. The SUMMARY.md
      itself only self-checks local git log / local file existence and never
      records a push; it explicitly notes "(feature branch, nothing pushed)" in
      an unrelated context (rebuilding commits after a format fix), confirming
      the branch was never pushed at any point during or after execution.
    artifacts: []
    missing:
      - "Push the branch: git push origin gsd/v0.2.3-machine-readable-reporters (fast-forward; 3 new commits on top of c792d3b, nothing rewritten)."
      - "Re-run / wait for PR #47's CI to complete against the new HEAD (6f8e455) and confirm ci, fallow, and test (macos-latest, 24) all report green via `gh pr checks 47`."
      - "Only after that observation does the task's literal goal (\"Make PR #47's ci check green\") hold -- today it does not."
---

# Quick Task 260719-iib: Resolve v0.2.3 CI Failures on PR #47 -- Verification Report

**Task Goal:** Make PR #47's `ci` check green by fixing (1) the macOS-only `relativizePath` case-insensitivity bug and (2) the fallow new-only gate failures (parseCliArgs + buildAdvisories complexity, the libs/test-util clone group) -- WITHOUT changing any public/observable surface and without regenerating committed snapshots.
**Verified:** 2026-07-19T14:15:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The macOS-only `relativizePath` case-insensitivity bug is fixed at the source level (correctness) | VERIFIED (local proxy) | `stripBaseCaseInsensitive` added and directly unit-tested for the mixed-case-remainder property and the exact macOS scenario (see diagnostic-record.spec.ts:44-60), not only through the composite `relativizePath` (which would false-pass on this Windows machine via `path.win32.relative`'s case-insensitive fast path -- confirmed empirically: `path.relative('/Repo/Root','/repo/root/sub/file.ts')` returns `sub\file.ts` on this machine, i.e. it never even reaches the fallback). Independent code review (260719-iib-REVIEW.md) traced the boundary logic (separator guard, sibling-prefix rejection, exact-equality, real-casing slice) and confirmed it correct for all realistic (ASCII) paths, incl. the literal committed macOS CI snapshot value. This is a sound local proxy per the task's own instruction ("classify human_needed only if there is no sound local proxy, otherwise passed") -- so this truth is NOT downgraded to human_needed. |
| 2 | Committed Windows/Linux JSON + SARIF integration snapshots stay byte-identical (no regeneration) | VERIFIED | Ran `npx nx test angular-typechecker` (544 passed) and `npx nx integration angular-typechecker` (139 passed) fresh; `git status --short` afterward shows zero modified `*.snap` files (only the untracked `.planning/quick/.../` task directory). |
| 3 | `npx fallow audit --format human --base origin/main` exits 0 (new-only gate) | VERIFIED | Ran it directly: `Audit scope: 190 changed files vs origin/main (6f8e455..HEAD)` / `No issues in 190 changed files (2.62s)` / `EXIT=0`. No `.fallowrc.jsonc` bypass was added (diff across the 3 fix commits is empty) -- the clone group and both complexity findings were resolved by real extraction, matching the plan's stated preference. |
| 4 | All repo gates green (nx test/integration/typecheck/lint for angular-typechecker; nx typecheck/lint for test-util; nx format:check at repo root) | VERIFIED | Ran every command independently: `nx test angular-typechecker` (544/544), `nx integration angular-typechecker` (139/139), `nx typecheck angular-typechecker` (3 tsc projects, exit 0), `nx lint angular-typechecker` ("All files pass linting"), `nx typecheck test-util` (exit 0), `nx lint test-util` ("All files pass linting"), `nx format:check` (EXIT=0, no output = clean). |
| 5 | Additive-only charter (ADD-01) holds: barrel byte-unchanged, no new dependency, payload shape unchanged | VERIFIED | `git diff --stat angular-typechecker@0.2.2 -- packages/angular-typechecker/src/index.ts packages/angular-typechecker/src/index.drift.ts` is empty. `git diff 6817f87^..6f8e455 -- packages/angular-typechecker/package.json libs/test-util/package.json` is empty (no dependency touched by the fix commits). `git diff --stat 6817f87^..6f8e455` shows exactly the 6 planned files touched, 0 `.snap` files. |
| 6 | **PR #47's `ci` check is green** (the literal, stated task goal) | **FAILED** | See Gaps below. The fix is real and correct in the local working tree, but it has never reached the remote branch backing PR #47, so the PR is still red. |

**Score:** 5/6 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/angular-typechecker/src/core/diagnostic-record.ts` | rewritten `relativizePath` + new `stripBaseCaseInsensitive` | VERIFIED | Read in full; matches plan's fast-path/fallback contract exactly; doc comments explain the macOS rationale. |
| `packages/angular-typechecker/src/core/diagnostic-record.spec.ts` | new spec covering every behavior-block case | VERIFIED | 10 tests, all pass; direct `stripBaseCaseInsensitive` assertions present (not routed only through `relativizePath`). |
| `packages/angular-typechecker/src/cli/parse-args.ts` | `parseCliArgs` decomposed into pure validators | VERIFIED | `validateTsConfig` / `validateMaxWarnings` / `validateFormat` / `buildParsedOptions` extracted; `parseCliArgs` is now a flat linear read; HELP_TEXT and flag registration untouched; parse-args.spec.ts 30/30 green. |
| `packages/angular-typechecker/src/core/json-report.ts` | `buildAdvisories` decomposed into per-field partials | VERIFIED | 5 per-field helpers, spread in interface-field order (byte-identical key order); json-report.spec.ts 24/24 green. |
| `libs/test-util/src/lib/e2e-process.ts` | new exported `execToRunResult` | VERIFIED | Matches plan's exact contract (success `{stdout, code:0}`, catch narrows to `{stdout,stderr,status}`, `maxBuffer` passthrough incl. `undefined`-is-byte-equivalent-to-omitted). `run()` calls it with no maxBuffer. |
| `libs/test-util/src/lib/ng-cli-e2e.ts` | `createNgRun` rewritten to call `execToRunResult` | VERIFIED | Imports `execToRunResult` alongside the existing `type RunResult` import; 20 MB maxBuffer + IN-02 comment preserved; unused `execSync` import removed. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `json-report.ts` / `sarif-report.ts` | `relativizePath` (diagnostic-record.ts) | shared D-13 projection through `toDiagnosticRecord` | WIRED | Confirmed by reading both call sites; `sarif-report.ts` was not modified (per plan, unnecessary -- it reaches the same `relativizePath` transitively) and its own spec (`sarif-report.spec.ts`, 9 tests) still passes. |
| `run()` (e2e-process.ts) / `createNgRun` (ng-cli-e2e.ts) | `execToRunResult` | direct call, extracted from the former duplicated try/catch | WIRED | Confirmed by reading both call sites; both compile and lint clean. |
| Local fix commits (6817f87, 6a5aba0, 6f8e455) | `origin/gsd/v0.2.3-machine-readable-reporters` | `git push` | **NOT WIRED** | `git rev-list --left-right --count origin/gsd/v0.2.3-machine-readable-reporters...HEAD` = "0 3": the remote branch has 0 of these 3 commits. This is the load-bearing missing link -- PR #47 cannot observe a fix that was never pushed. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit + integration suites green, snapshots untouched | `npx nx test angular-typechecker && npx nx integration angular-typechecker` then `git status --short` | 544 + 139 tests passed; no modified `.snap` | PASS |
| Typecheck gates green | `npx nx typecheck angular-typechecker && npx nx typecheck test-util` | both exit 0 | PASS |
| Lint gates green | `npx nx lint angular-typechecker && npx nx lint test-util` | "All files pass linting" x2 | PASS |
| Format gate green | `npx nx format:check` (repo root) | EXIT=0 | PASS |
| Fallow new-only gate (the CI-blocking check) | `npx fallow audit --format human --base origin/main` | "No issues in 190 changed files" / EXIT=0 | PASS |
| PR #47's actual `ci` check | `gh pr checks 47` | `ci fail`, `fallow fail`, `test (macos-latest, 24) fail` -- all three against pre-fix commit c792d3b | **FAIL** (goal not yet observable on the PR) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|------------|--------------|--------|----------|
| CI-PR47-1-macos-snapshot | 260719-iib-PLAN.md | macOS `relativizePath` case-insensitivity fix | SATISFIED (code); BLOCKED (delivery) | Fix is correct and unit-proven locally; not yet observable green on the actual macOS CI cell because it has not been pushed. |
| CI-PR47-2-fallow-gate | 260719-iib-PLAN.md | fallow new-only gate green | SATISFIED (code); BLOCKED (delivery) | Local `fallow audit` exits 0; the PR's own `fallow` check still fails because it last ran against the pre-fix commit. |

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in any of the 6 modified files. No stub returns, no hardcoded empty data flowing to output. The independent code review (260719-iib-REVIEW.md) found 0 criticals, 1 low-likelihood Unicode-edge-case warning (WR-01, non-blocking -- ASCII-only paths are what macOS CI actually produces), and 2 cosmetic info items. None of these block this verification.

### Human Verification Required

None. The task's own instruction was to classify the macOS-behavior truth as `human_needed` only if there is no sound local proxy -- a sound local proxy exists (the direct `stripBaseCaseInsensitive` unit tests plus the independent code review's boundary trace), so that truth is VERIFIED rather than deferred to a human. The one real gap below (the unpushed branch) is a deterministic, machine-checkable fact (`gh pr checks 47`), not a human-judgment item.

## Gaps Summary

The code fix itself is complete, correct, and fully verified against every local gate the plan specified (test, integration, typecheck x2, lint x2, format:check, fallow audit -- all green; additive-only charter intact; zero snapshot regeneration). The independent code review found no blockers.

However, the task's literal, stated goal -- **"Make PR #47's `ci` check green"** -- is not yet true. The three fix commits (`6817f87`, `6a5aba0`, `6f8e455`) live only on the local branch. `origin/gsd/v0.2.3-machine-readable-reporters` is still at `c792d3b`, the same commit PR #47's most recent CI run (2026-07-19T11:06:20Z) ran against and failed on exactly the three checks this task targeted (`ci`, `fallow`, `test (macos-latest, 24)`). Until the branch is pushed and CI re-runs against the new HEAD, PR #47 remains red -- the goal this quick task exists to achieve has not been delivered, only prepared.

This is a one-command remediation (`git push origin gsd/v0.2.3-machine-readable-reporters`, a fast-forward push introducing 3 new commits, nothing rewritten/force-pushed) followed by confirming the PR's checks turn green. No code changes are needed.

---

_Verified: 2026-07-19T14:15:00Z_
_Verifier: Claude (gsd-verifier)_
