---
phase: 35-automated-code-scanning-proof
verified: 2026-07-21T22:30:00Z
status: human_needed
score: 2/4 must-haves verified
behavior_unverified: 2 # SC2 (CI job asserts real GitHub ingestion) + SC3 (proof turns red on a real regression) -- both are the real-CI-only Nyquist point; see behavior_unverified_items
overrides_applied: 0
behavior_unverified_items:
  - truth: "SC2 -- A CI job runs the standalone CLI on the fixture, uploads under a dedicated angular-typecheck-proof category, and asserts via bounded gh api polling on the PR merge-ref that each expected alert is present (set-membership of category/tag/severity)."
    test: "Open the milestone PR against main. Observe the code-scanning-proof job: gen step produces proof.sarif from the fixture, upload step uploads it under category: angular-typecheck-proof, and the 'Assert proof alerts landed' step polls code-scanning/sarifs/{id} to complete, then code-scanning/analyses and code-scanning/alerts on refs/pull/<n>/merge."
    expected: "The assert step exits 0, logging 'code-scanning proof: all expected (category, family tag, severity) tuples present on refs/pull/<n>/merge' -- meaning GitHub actually ingested the SARIF and surfaced all four (family tag, severity) alerts under the angular-typecheck-proof category (or its upload-sarif-synthesized angular-typecheck-proof/ form)."
    why_human: "GitHub Code Scanning SARIF ingestion is a live, asynchronous external service. No local gate (schema validation, the drift-lock integration spec, the ASSERT_ALERTS_FILE unit-test seam, act --validate/-n) can simulate the real upload-sarif category-to-automationDetails.id synthesis or GitHub's actual alert-generation response. This job has never executed in real CI -- the code was written and code-reviewed same-day and no PR against main has run it yet."
  - truth: "SC3 -- The proof check turns red if any expected alert, category, or tag is missing, so a broken SARIF->Code Scanning contract is caught automatically."
    test: "On a real CI run where the reporter/rule contract genuinely regresses (or as a deliberate drill: temporarily break diagnostic-family.ts / sarif-report.ts and push to the PR), confirm the code-scanning-proof job's 'Assert proof alerts landed' step fails and the job shows red in the PR checks list."
    expected: "The step exits non-zero and GitHub marks the code-scanning-proof check red -- with no possibility of a silent pass -- when the live alerts response is missing an expected tuple or the SARIF fails to process."
    why_human: "The fail-loud DECISION LOGIC is proven locally (assert-code-scanning.spec.ts's RED and category-isolation cases genuinely exit 1 and name the missing tuple), but whether the full CI job surfaces that as a live red GitHub check, on a genuine ingestion regression, has never been observed. This shares the same real-CI-only ingestion path as SC2."
human_verification:
  - test: "Open the milestone PR against main. Observe the code-scanning-proof job: gen step produces proof.sarif from the fixture, upload step uploads it under category: angular-typecheck-proof, and the 'Assert proof alerts landed' step polls code-scanning/sarifs/{id} to complete, then code-scanning/analyses and code-scanning/alerts on refs/pull/<n>/merge."
    expected: "The assert step exits 0, logging 'code-scanning proof: all expected (category, family tag, severity) tuples present on refs/pull/<n>/merge'."
    why_human: "GitHub Code Scanning SARIF ingestion is a live, asynchronous external service that cannot be simulated locally; this job has never run against real CI."
  - test: "Confirm the observed GitHub category string on the first real run (angular-typecheck-proof vs. the upload-sarif-synthesized angular-typecheck-proof/ with a trailing slash) matches what CR-01's categoryMatches() tolerates."
    expected: "Either form is accepted by categoryMatches() (already coded defensively), and the assert step does not permanently false-RED on this string."
    why_human: "The reviewer's CR-01 finding is a defensive fix against a documented-but-unconfirmed upload-sarif behavior on this exact category-input upload path; the actual string GitHub returns is real-CI-only and unverified."
  - test: "On a real CI run where a genuine regression removes/breaks one family's SARIF rule, confirm the code-scanning-proof job goes red (not just the local unit test's canned RED case)."
    expected: "The job fails and GitHub shows a red check for code-scanning-proof."
    why_human: "The fail-loud logic is unit-proven locally; the live end-to-end red-on-regression behavior against GitHub's actual API has never been observed."
---

# Phase 35: Automated Code Scanning proof Verification Report

**Phase Goal:** A CI check continuously PROVES the SARIF -> Code Scanning contract end-to-end -- one known diagnostic per family from an isolated fixture lands as a Code Scanning alert with the expected category, tags, and severity -- and fails red the moment any part of that contract regresses.
**Verified:** 2026-07-21T22:30:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

**Adversarial framing applied:** this phase explicitly declares itself a "real-CI-only" proof harness (per its own PLAN/SUMMARY/CONTEXT). SUMMARY.md claims of "complete" for PROOF-01/PROOF-02 are read as "the LOCAL half is done" -- not "the phase goal is achieved" -- because the phase's own Nyquist point (its stated primary behavior) is GitHub ingestion, which none of the three plans' local gates can exercise. This report independently re-derives that split rather than trusting the SUMMARY narrative, and confirms both halves in the actual codebase.

### Observable Truths

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
|---|---|---|---|
| 1 | SC1: An isolated fixture lives OUTSIDE the Nx project graph (`tools/`, no `project.json`) emitting exactly one diagnostic per family (typescript; template-type-check via external `.html`; extended `NG8xxx`; tool `ATC`) | VERIFIED | Confirmed directly: `tools/sarif-proof-fixture/` contains exactly 5 files (`tsconfig.json`, `tsconfig.fixture.json`, `type-error.ts`, `proof.component.ts`, `proof.component.html`), no `project.json`, no `tsconfig.missing.json` on disk (its deliberate absence synthesizes ATC90002). `npx nx show projects` does not list the fixture. Ran the actual built CLI (`node dist/packages/angular-typechecker/src/cli/bin.js -c tools/sarif-proof-fixture/tsconfig.json --format sarif`) and independently verified the SARIF output: 1 run, 4 rules, exactly `ATC90002->tool/error`, `NG8002->template-type-check/error`, `NG8101->extended-diagnostics/warning`, `TS2322->typescript/error`. Ran `npx nx run-many -t typecheck --skip-nx-cache` (the real merge gate) and confirmed it stays green and never mentions the fixture. |
| 2 | SC2: A CI job runs the standalone CLI on the fixture, uploads under a dedicated `angular-typecheck-proof` category, and asserts via bounded `gh api` polling on the PR merge-ref that each expected alert is present (set-membership) | PRESENT_BEHAVIOR_UNVERIFIED | Code + wiring fully present and structurally correct: `.github/workflows/ci.yml`'s `code-scanning-proof` job (gen -> upload with `category: angular-typecheck-proof` -> assert via `tools/ci/assert-code-scanning.mjs`) matches the plan exactly; `assert-code-scanning.mjs`'s `waitForProcessing` -> `assertAnalysisCategory` -> `assertAlerts` -> `missingTuples` chain is correct and unit-proven via the `ASSERT_ALERTS_FILE` seam (4/4 tests pass, incl. the post-review trailing-slash `categoryMatches` case). BUT the actual GitHub SARIF-ingestion round-trip (real `gh api` calls against a live `code-scanning/sarifs/{id}`, `code-scanning/analyses`, `code-scanning/alerts` on a real PR) has NEVER executed -- this job has not yet run in real CI. See `behavior_unverified_items`. |
| 3 | SC3: The proof check turns red if any expected alert, category, or tag is missing, so a broken SARIF->Code Scanning contract is caught automatically | PRESENT_BEHAVIOR_UNVERIFIED | The FAIL-LOUD DECISION LOGIC is proven locally and independently re-run: `packages/angular-typechecker/src/assert-code-scanning.spec.ts` (4 tests, incl. RED -- drops the `tool` alert, exits 1 naming `tool/error` -- and category-isolation -- a right-tag/right-severity alert under a dogfood category does not satisfy the tuple, exits 1). But whether the FULL CI job actually surfaces a live red GitHub check on a genuine ingestion-level regression has never been observed -- shares the same real-CI-only path as SC2. |
| 4 | SC4: Proof alerts query on the PR ref and do not pollute the `main` alerts view | VERIFIED | Structurally guaranteed, not merely asserted: the `code-scanning-proof` job's `if:` is `github.event_name == 'pull_request' && needs.changes.outputs.code != 'false'` -- the job literally cannot execute on a `push` event, so it cannot generate alerts on `main` regardless of GitHub's live behavior. `assert-code-scanning.mjs` computes `ref = refs/pull/${PR_NUMBER}/merge` unconditionally in the normal branch -- it never queries a `main`/default-branch ref. `tools/act/act-compat.sh` carries `assert_absent "$PUSH_MAIN_PLAN" "ci/code-scanning-proof" "push-main"`, confirming (via `act -n`, which DOES evaluate `if:`) that the job drops out of the push-to-`main` plan. |

**Score:** 2/4 truths verified (2 present + wired, behavior-unverified pending the real-CI PR run)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `tools/sarif-proof-fixture/tsconfig.json` | Solution tsconfig, `files:[]`, references surviving leaf + one missing leaf | VERIFIED | Exists; confirmed exactly this shape by reading the file; drives the CLI to the confirmed 4-rule SARIF output. |
| `tools/sarif-proof-fixture/tsconfig.fixture.json` | Surviving leaf, strict + strictTemplates | VERIFIED | Exists; matches plan spec (strict, strictTemplates, `files: [type-error.ts, proof.component.ts]`). |
| `tools/sarif-proof-fixture/type-error.ts` | Fires TS2322 | VERIFIED | Exists; `export const proofTypeError: number = 'not a number'`; confirmed TS2322/typescript/error in the SARIF run. |
| `tools/sarif-proof-fixture/proof.component.ts` | Standalone component, external templateUrl | VERIFIED | Exists; matches plan (standalone, `templateUrl: './proof.component.html'`, one `value` member). |
| `tools/sarif-proof-fixture/proof.component.html` | Fires NG8002 + warning NG8xxx | VERIFIED | Exists; `[nonExistentProp]` (NG8002) + `([value])` inverted banana-in-box (NG8101); confirmed both in the SARIF run. |
| `machine-reporters-sarif.integration.spec.ts` (new drift-lock describe block) | Asserts the 4 family tuples over 1 fixture run | VERIFIED | 5th `describe('SARIF reporter integration -- sarif-proof-fixture ...')` block exists; independently ran `npx vitest run --config .../vitest.integration.config.mts -t "sarif-proof-fixture"` -- 4/4 tests pass. |
| `tools/ci/assert-code-scanning.mjs` | Exported pure `missingTuples`; gh-api poll/assert CLI entry; `ASSERT_ALERTS_FILE` seam | VERIFIED | Exists; `node --check` passes; confirmed the exported `missingTuples`, the `categoryMatches` trailing-slash tolerance (CR-01 fix), and `--paginate` + `state=open` (WR-01 fix) are all present in the actual file (not just claimed in REVIEW-FIX.md). |
| `packages/angular-typechecker/src/assert-code-scanning.spec.ts` | Subprocess spec: GREEN/RED/category-isolation | VERIFIED | Exists; independently re-ran via `npx nx test angular-typechecker` -- `src/assert-code-scanning.spec.ts (4 tests)` all pass, including the post-review trailing-slash GREEN case. |
| `.github/workflows/ci.yml` (`code-scanning-proof` job) | New PR-only, non-fork job; dedicated category; reused SHA pin; bracket-syntax `sarif-id`; PR data via env; absent from `ci` aggregate `needs[]` | VERIFIED | Job exists at line 654; every structural requirement independently confirmed by direct read: `if: github.event_name == 'pull_request' && ...`, `permissions: {contents: read, security-events: write}`, reused `upload-sarif@7188fc36...` SHA pin, `category: angular-typecheck-proof`, `SARIF_ID: steps.upload.outputs['sarif-id']` (bracket syntax), `PR_NUMBER`/`GH_TOKEN` via `env:`, fork gate on both upload and assert steps. The `ci:` aggregate job's `needs: [...]` list (read directly) does NOT include `code-scanning-proof` or `code-scanning`. |
| `tools/act/act-compat.sh` (trigger-fidelity assertions) | PR-selected + push-main-absent for `code-scanning-proof` | VERIFIED (structurally); local execution environment-limited | Both assertion lines exist and are correctly worded. Ran `bash tools/act/act-compat.sh` locally: it FAILS the PR-selected assertion for `code-scanning-proof` -- but this is a PRE-EXISTING local-environment limitation, not a phase-35 regression: confirmed by reverting to the pre-phase-35 `act-compat.sh` (commit `04b33ef`) and re-running -- the untouched dogfood `ci/code-scanning` PR-selected assertion ALSO fails identically on this box (act 0.2.89 does not resolve `needs.changes.outputs.code` to an empty string in `act -n` dry-run). The push-main-absent assertion for `code-scanning-proof` DOES pass locally, and the source-level `if:` gate (Truth 4 above) makes the PR-selected claim provable by direct code inspection regardless of this local tooling gap. The real-CI `act-compat` job (required in the `ci` aggregate, Linux) is authoritative here per the repo's own documented convention. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Fixture solution tsconfig | Shipped `familyOf`/`toSarifLevel` | One CLI run tagging each rule | VERIFIED | Directly re-ran the CLI; output matches the 4 expected (tag, level) tuples exactly. |
| Drift-lock integration spec | CI assert's `EXPECTED` set | Shared 4-tuple contract | VERIFIED | `EXPECTED` in `assert-code-scanning.mjs` (typescript/error, template-type-check/error, extended-diagnostics/warning, tool/error) matches the drift-lock spec's asserted tuple set and the independently-observed CLI output verbatim. |
| `.fallowrc.jsonc` + `.prettierignore` | fallow new-only gate + `format:check` | Fixture scoping | VERIFIED | Independently ran `npx fallow audit --format human --base origin/main` -- no finding names the fixture (only a benign stderr WARN about the by-design-missing `tsconfig.missing.json`). Independently ran `npx nx format:check` -- exit 0, no output. |
| `upload-sarif` `sarif-id` output | `assert-code-scanning.mjs` `SARIF_ID` env | `steps.upload.outputs['sarif-id']` bracket syntax | VERIFIED (wiring); UNVERIFIED (live value) | Bracket syntax confirmed present in `ci.yml`; the actual GitHub-produced `sarif-id` and its round-trip through the poll have never been exercised (real-CI-only). |
| `code-scanning-proof` job | `ci` aggregate | Deliberate absence from `needs[]` | VERIFIED | Directly read the `ci:` job's `needs` array -- `code-scanning-proof` is not present, matching D-02d. |
| `code-scanning-proof` job `if:` | push-to-`main` events | `github.event_name == 'pull_request'` gate | VERIFIED | Direct code read confirms the gate; `act-compat.sh`'s push-main-absent assertion passes locally, corroborating it. |

### Data-Flow Trace (Level 4)

Not applicable in the standard "renders dynamic data" sense (this phase is CI/tooling, not a UI). The equivalent trace -- fixture source -> CLI -> SARIF -> upload -> GitHub alerts -> assert -- is covered above: the fixture-to-SARIF half is independently confirmed with real data (the CLI run's actual JSON output), while the upload-to-alerts-to-assert half is real-CI-only and unverified (see Truths 2/3).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| CLI emits exactly 4 rules / 1 run over the fixture | `node dist/.../bin.js -c tools/sarif-proof-fixture/tsconfig.json --format sarif` | 1 run, 4 rules: `ATC90002`/tool/error, `NG8002`/template-type-check/error, `NG8101`/extended-diagnostics/warning, `TS2322`/typescript/error | PASS |
| `missingTuples` matcher GREEN/RED/category-isolation/trailing-slash | `npx nx test angular-typechecker` (`src/assert-code-scanning.spec.ts`) | 4/4 tests pass | PASS |
| Drift-lock integration spec | `npx vitest run --config .../vitest.integration.config.mts -t "sarif-proof-fixture"` | 4/4 tests pass | PASS |
| Real merge gate untouched by the fixture | `npx nx run-many -t typecheck --skip-nx-cache` | 12 projects, all green, no mention of the fixture | PASS |
| fallow does not flag the fixture | `npx fallow audit --format human --base origin/main` | No finding names `sarif-proof-fixture` (only a benign stderr WARN) | PASS |
| Format gate green | `npx nx format:check` | exit 0, no output | PASS |
| Lint gate green | `npx nx run-many -t lint --skip-nx-cache` | 3 projects, all pass | PASS |
| Spec type-check (nx test does not type-check specs) | `npx tsc --noEmit -p packages/angular-typechecker/tsconfig.spec.json` | exit 0 | PASS |
| act-compat trigger fidelity (local) | `bash tools/act/act-compat.sh` | 8 passed / 11 failed; the `code-scanning-proof` PR-selected assertion fails identically to the pre-existing, untouched dogfood `ci/code-scanning` assertion (confirmed by reverting to pre-phase-35 `act-compat.sh` and re-running) | SKIP (environment-limited, not a phase-35 regression; real-CI `act-compat` job is authoritative) |
| GitHub SARIF ingestion round-trip | `code-scanning-proof` job on a real PR against `main` | Never executed | SKIP (real-CI-only; see Human Verification) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| PROOF-01 | 35-01, 35-02, 35-03 | Isolated fixture + `gh api` assert of category/tags/severity | PARTIALLY SATISFIED | Local half (fixture + drift-lock + assert script + CI job wiring) fully verified in codebase. Ingestion half real-CI-only, unverified. REQUIREMENTS.md correctly still lists it `Pending` (not prematurely marked Complete) -- consistent with this finding. |
| PROOF-02 | 35-02, 35-03 | Fails loud (red) on any missing alert/category/tag | PARTIALLY SATISFIED | Fail-loud DECISION LOGIC unit-proven locally (RED + category-isolation tests independently re-run and passing). Whether the live CI job actually goes red on a real GitHub-side regression is real-CI-only, unverified. REQUIREMENTS.md correctly lists it `Pending`. |

No orphaned requirements: both IDs mapped to Phase 35 in REQUIREMENTS.md's traceability table are claimed by at least one of the three plans' frontmatter `requirements:` fields.

### Anti-Patterns Found

None. Scanned all phase-modified files (`tools/ci/assert-code-scanning.mjs`, `packages/angular-typechecker/src/assert-code-scanning.spec.ts`, the 5 fixture files, `.github/workflows/ci.yml`'s new job, `tools/act/act-compat.sh`'s new lines) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/"not yet implemented" -- zero genuine hits (one grep false-positive on the literal substring `xxx` inside the code comment "NG8xxx", not a debt marker). No empty/stub implementations; no hardcoded empty data feeding a rendered/asserted path. `git diff --stat` across the full phase commit range (`4169c1a^..HEAD`) confirms the touched-file set matches D-04's additive-only posture exactly: no `package.json`, no `executors.json`, no production `packages/angular-typechecker/src/core/**` (non-spec) file.

### Human Verification Required

### 1. GitHub SARIF -> Code Scanning ingestion round-trip (the phase's own Nyquist point)

**Test:** Open the milestone PR against `main`. Observe the `code-scanning-proof` job: the `gen` step should produce `proof.sarif` from the fixture, the `upload` step should upload it under `category: angular-typecheck-proof`, and the "Assert proof alerts landed" step should poll `code-scanning/sarifs/{id}` to `complete`, then `code-scanning/analyses` and `code-scanning/alerts` on `refs/pull/<n>/merge`.
**Expected:** The assert step exits 0, logging `code-scanning proof: all expected (category, family tag, severity) tuples present on refs/pull/<n>/merge`.
**Why human:** GitHub Code Scanning SARIF ingestion is a live, asynchronous external service. No local gate can simulate the real `upload-sarif` category-to-`automationDetails.id` synthesis or GitHub's actual alert-generation response, and this job has never executed in real CI.

### 2. Confirm the observed category string (CR-01 trailing-slash tolerance)

**Test:** On the first real run, inspect the actual `most_recent_instance.category` / `analyses[].category` value GitHub returns for this upload.
**Expected:** Either `angular-typecheck-proof` or `angular-typecheck-proof/` -- both are already tolerated by `categoryMatches()`.
**Why human:** This is a documented-but-unconfirmed `upload-sarif` behavior on the `category:`-input path (the code-review CR-01 finding); the fix is defensive and correct either way, but the actual string is real-CI-only and has not been observed.

### 3. Confirm the job actually goes red on a genuine regression

**Test:** On a real CI run where the reporter/rule contract genuinely regresses (e.g., a deliberate drill breaking `diagnostic-family.ts` or `sarif-report.ts` on a throwaway branch), confirm the `code-scanning-proof` job fails and GitHub shows a red check.
**Expected:** The "Assert proof alerts landed" step exits non-zero and the PR checks list shows `code-scanning-proof` red.
**Why human:** The fail-loud decision logic is unit-proven locally; the live end-to-end red-on-regression behavior against GitHub's actual API has never been observed.

### Gaps Summary

No gaps (no FAILED truth, no MISSING/STUB artifact, no NOT_WIRED key link, no blocker anti-pattern). The phase's LOCAL deliverables are fully built, wired, and independently re-verified in this codebase: the isolated one-per-family fixture, the local drift-lock integration spec, the `gh api` poll/assert script (with both CR-01 and WR-01 code-review fixes actually present in the shipped file, not just claimed in REVIEW-FIX.md), its GREEN/RED/category-isolation/trailing-slash unit tests, and the PR-only non-fork `code-scanning-proof` CI job correctly wired and correctly absent from the required `ci` aggregate.

What remains is exactly what the phase itself calls out as its own Nyquist point: the actual GitHub SARIF-ingestion round-trip has never run in real CI. This is not a defect in the implementation -- it is an inherent property of a proof-harness phase whose primary behavior only exists once a real `pull_request` triggers the job against GitHub's live Code Scanning API. Per REQUIREMENTS.md (correctly still `Pending` for both PROOF-01/PROOF-02) and the three SUMMARY.md files' own framing, this closes when the milestone PR's CI run goes green -- not before.

---

_Verified: 2026-07-21T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
