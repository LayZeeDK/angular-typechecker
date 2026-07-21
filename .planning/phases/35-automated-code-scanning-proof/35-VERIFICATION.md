---
phase: 35-automated-code-scanning-proof
verified: 2026-07-22T00:00:00Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 2/4 (2 present + wired, behavior-unverified)
  gaps_closed:
    - "SC2 -- code-scanning-proof job asserts real GitHub Code Scanning ingestion on the PR merge-ref"
    - "SC3 -- the proof check turns red automatically when the SARIF->Code Scanning contract breaks"
  gaps_remaining: []
  regressions: []
---

# Phase 35: Automated Code Scanning proof Verification Report

**Phase Goal:** A CI check continuously PROVES the SARIF -> Code Scanning contract end-to-end -- one known diagnostic per family from an isolated fixture lands as a Code Scanning alert with the expected category, tags, and severity -- and fails red the moment any part of that contract regresses.
**Verified:** 2026-07-22T00:00:00Z
**Status:** passed
**Re-verification:** Yes -- after gap closure (G-35-01, plan 35-04)

## Goal Achievement

**Adversarial framing applied.** The prior verification (2026-07-21) correctly refused to trust SUMMARY.md's "complete" framing for PROOF-01/PROOF-02 and left SC2/SC3 as `PRESENT_BEHAVIOR_UNVERIFIED`, because the phase's own stated Nyquist point -- real GitHub SARIF ingestion -- had never executed in CI. That refusal was vindicated: the first real CI run (PR #55, run `29866139011`) DID fail, on a genuine defect (G-35-01: GitHub rejected the whole SARIF because file-less diagnostics carried no `locations`). This report does not take the task prompt's "landed GREEN" claim at face value -- it independently re-fetched and read the real GitHub Actions job log for the cited run (`29875173270`, job `88784063791`) via `gh run view --log`, read the production code diff that fixed G-35-01, and cross-checked PR #55's full check-run list via `gh pr checks 55`, before assigning any status.

### Observable Truths

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
|---|---|---|---|
| 1 | SC1: An isolated fixture lives OUTSIDE the Nx project graph (`tools/`, no `project.json`) emitting exactly one diagnostic per family (typescript; template-type-check via external `.html`; extended `NG8xxx`; tool `ATC`) | VERIFIED | Regression-checked: `tools/sarif-proof-fixture/` still contains exactly the 5 files (`tsconfig.json`, `tsconfig.fixture.json`, `type-error.ts`, `proof.component.ts`, `proof.component.html`), no `project.json` on disk. `git diff --stat a608a6d..afe1241` confirms plan 35-04 touched zero fixture files -- this truth is untouched by the gap-closure work. Previously independently verified against the built CLI output (unchanged by this re-verification). |
| 2 | SC2: A CI job runs the standalone CLI on the fixture, uploads under a dedicated `angular-typecheck-proof` category, and asserts via bounded `gh api` polling on the PR merge-ref that each expected alert is present (set-membership of category/tag/severity) | VERIFIED | Independently read the real job log for `code-scanning-proof` (run `29875173270`, job `88784063791`, commit `afe1241`, PR #55): `github/codeql-action/upload-sarif` logs `Successfully uploaded results` then, under "Waiting for processing to finish", `Analysis upload status is complete.` -- no `locationFromSarifResult` rejection (the exact G-35-01 blocker is gone, confirmed live). The `Assert proof alerts landed` step (`node tools/ci/assert-code-scanning.mjs`, env `PR_NUMBER: 55`, `SARIF_ID: c87d47b2-8556-11f1-9c9d-8ed576432962`) printed `code-scanning proof: all expected (category, family tag, severity) tuples present on refs/pull/55/merge` and the step succeeded (job status `pass`, `gh pr checks 55`). This is the phase's own designated Nyquist point and it is now directly observed, not inferred. |
| 3 | SC3: The proof check turns red if any expected alert, category, or tag is missing, so a broken SARIF->Code Scanning contract is caught automatically | VERIFIED | Two independent lines of evidence, combined: (a) **Live regression, not a drill** -- the first real CI run (`29866139011`) hit a genuine, unplanned break in the SARIF->Code Scanning contract (file-less results had no `locations`) and the `code-scanning-proof` job went red automatically, with no manual intervention, exactly as SC3 requires; this is stronger evidence than a synthetic drill because it was a real defect the harness caught unprompted (documented in `35-UAT.md` G-35-01 and independently re-confirmed via the prior job's failure). (b) **Tuple-mismatch decision logic** -- `packages/angular-typechecker/src/assert-code-scanning.spec.ts`'s RED case (drops the `tool` alert, asserts exit 1 naming `tool/error`) and category-isolation case are unit-proven and still pass in the current `test` CI matrix (all 5 `test (...)` jobs pass on run `29875173270`). Residual scope note: the RED path has been observed live at the ingestion layer (a) but the assert script's own tuple-membership RED branch has only been exercised against mocked GitHub API shapes (b), not a live GitHub alerts response with a genuinely missing tuple -- this is a minor, non-blocking residual (see Gaps Summary), not a reason to withhold VERIFIED given (a) is real, unplanned, and directly on-point for the success criterion's stated purpose ("a broken SARIF->Code Scanning contract is caught automatically"). |
| 4 | SC4: Proof alerts query on the PR ref and do not pollute the `main` alerts view | VERIFIED | Regression-checked: `code-scanning-proof`'s `if:` is still `github.event_name == 'pull_request' && needs.changes.outputs.code != 'false'` (read directly at `.github/workflows/ci.yml:656`), byte-identical to the prior verification -- 35-04 did not touch `ci.yml`. Structurally the job cannot run on a `push` to `main`, so it cannot generate alerts there. |

**Score:** 4/4 truths verified (0 present-but-behavior-unverified; both previously-unverified truths now have direct real-CI behavioral evidence, independently fetched and read, not taken from the SUMMARY narrative)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/angular-typechecker/src/core/sarif-report.ts` | File-less SARIF results (`record.file === null`) carry a region-less whole-file fallback location on the relativized `tsConfigPath` | VERIFIED | Read directly: PASS-2's conditional spread now has `: { fileUri: relativizePath(result.tsConfigPath, pathBase) }` in the file-less arm (line 219); `relativizePath` is imported as a value from `./diagnostic-record` (line 9); the located arm and `fingerprintOf` are unchanged. Matches locked decisions D1/D5/D6 from `35-G-35-01-CONTEXT.md` exactly. |
| `packages/angular-typechecker/src/core/sarif-report.spec.ts` + regenerated `.snap` | File-less test asserts a located, region-less result | VERIFIED (via CI) | `test (...)` jobs (5 OS/Node combinations) all pass on run `29875173270`, which exercises `nx test angular-typechecker` including this spec and its snapshot. |
| `packages/angular-typechecker/src/core/machine-reporters-sarif.integration.spec.ts` + regenerated `.snap` | The two "NO locations" assertions flipped to whole-file-located; sarif-proof-fixture drift-lock unaffected | VERIFIED (via CI) | Additive-scope diff (`git diff --stat a608a6d..afe1241`) confirms both files changed as planned; the integration tier runs inside the same green `test`/`ci` pipeline. |
| `packages/angular-typechecker/README.md` | File-less-diagnostic paragraph corrected to describe whole-file alerts, no internal ids | VERIFIED | Diff-stat confirms the file changed (+9/-... lines); `format-lint` job passed on run `29875173270` (Prettier gate). |
| `.github/workflows/ci.yml` `code-scanning-proof` job | Unchanged by the gap-closure plan (out of its additive scope) | VERIFIED | `git diff --stat a608a6d..afe1241` does not list `.github/workflows/ci.yml` -- confirmed byte-unchanged since the prior (fully-verified) structural read. |
| `package.json` / `package-lock.json` (fast-uri override) | Pre-existing HIGH `fast-uri` cve-lite finding (surfaced during 35-04, out of that plan's scope, deferred) cleared before the milestone PR closes | VERIFIED | Commit `afe1241` "fix(deps): override fast-uri to ^3.1.4 to clear GHSA-v2hh-gcrm-f6hx (HIGH)"; `package.json:79` shows `"fast-uri": "^3.1.4"` under `overrides`; `cve-lite` job passes on run `29875173270`. This was flagged as a pre-close blocker in 35-04-SUMMARY.md's "Next Phase Readiness" and is now resolved. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `sarif-report.ts` PASS-2 file-less branch | `node-sarif-builder` `initSimple({ fileUri })` | region-less `physicalLocation.artifactLocation.uri` | VERIFIED | Code read directly confirms `fileUri` alone is passed (no `startLine`), matching the verified `node-sarif-builder` behavior documented in 35-04-PLAN.md's context. |
| SARIF payload | GitHub Code Scanning `upload-sarif` ingestion | `wait-for-processing: true` | VERIFIED (live) | Real job log: `Successfully uploaded results` -> `Analysis upload status is complete.` -- no location rejection. This is the link that was previously `NOT_WIRED` in effect (rejected at runtime) and is now directly observed working. |
| `upload-sarif` `sarif-id` output | `assert-code-scanning.mjs` `SARIF_ID` env | `steps.upload.outputs['sarif-id']` bracket syntax | VERIFIED (live) | Real job log shows `SARIF_ID: c87d47b2-8556-11f1-9c9d-8ed576432962` populated in the assert step's env, and the assert step logs a successful set-membership match using it. |
| `code-scanning-proof` job | `ci` required aggregate | Deliberate absence from `needs[]` | VERIFIED | Unchanged since prior verification; `gh pr checks 55` shows `ci` and `code-scanning-proof` as separate, independently-reported checks. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Real GitHub SARIF ingestion succeeds (no `locationFromSarifResult` rejection) | `gh run view 29875173270 --job 88784063791 --log` | `Successfully uploaded results` / `Analysis upload status is complete.` | PASS |
| Real assert step confirms set-membership on the live PR merge-ref | same log, `Assert proof alerts landed` step | `code-scanning proof: all expected (category, family tag, severity) tuples present on refs/pull/55/merge`, step exit 0 | PASS |
| Full PR #55 check-run list is green except the expected dogfood finding | `gh pr checks 55` | All required checks (`ci`, `cve-lite`, `code-scanning`, `code-scanning-proof`, `fallow`, `format-lint`, full `test`/`e2e` matrix, `act-compat`, CodeQL `Analyze (actions)`/`Analyze (javascript-typescript)`) pass; only the non-required `angular-typechecker` Advanced Security check-run shows `fail` (expected dogfood: planted fixtures + a benign baseline-config warning) | PASS |
| Production fix present in source (not just claimed) | `rg -n "fileUri: relativizePath" packages/angular-typechecker/src/core/sarif-report.ts` | Line 219 matches | PASS |
| Additive-scope diff holds through the fast-uri follow-up commit | `git diff --stat a608a6d..afe1241` | Only the 6 planned files + `package.json`/`package-lock.json` (documented, out-of-scope-but-tracked cve-lite fix) + `.planning/` docs changed | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| PROOF-01 | 35-01, 35-02, 35-03, 35-04 | Isolated fixture + `gh api` assert of category/tags/severity, actually ingested by GitHub | SATISFIED | Local half fully verified (unchanged); ingestion half now directly observed live in CI (Truth 2). |
| PROOF-02 | 35-02, 35-03, 35-04 | Fails loud (red) on any missing alert/category/tag or a broken contract | SATISFIED | Fail-loud decision logic unit-proven; the pipeline's real-world red-on-genuine-regression behavior was directly observed (Truth 3, G-35-01 itself). |

No orphaned requirements (unchanged from prior verification -- both IDs are claimed by plan frontmatter across 35-01..35-04).

Note: `.planning/REQUIREMENTS.md` still shows `PROOF-01`/`PROOF-02` as `Pending` at the time of this verification -- that traceability table is owned by the orchestrator/milestone-audit step, not this verifier; this report's finding is that the underlying work now satisfies both requirements and the table should be updated by whichever workflow step owns it next.

### Anti-Patterns Found

None. Re-scanned all files touched by plan 35-04 (`sarif-report.ts`, `sarif-report.spec.ts`, `machine-reporters-sarif.integration.spec.ts`, both `.snap` files, `README.md`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` -- zero hits. `git diff --stat a608a6d..afe1241` confirms the diff stayed within the plan's declared `files_modified` plus the documented, tracked `package.json`/`package-lock.json` cve-lite fix (not a scope violation -- explicitly logged in `deferred-items.md` and closed by commit `afe1241`).

### Human Verification Required

None. All three items carried forward from the prior `human_needed` verification are now closed by directly-observed real-CI evidence (independently fetched via `gh run view --log` and `gh pr checks`, not taken from the task prompt's narrative or SUMMARY.md):

1. ~~GitHub SARIF -> Code Scanning ingestion round-trip~~ -- CLOSED. Observed live: upload succeeds, assert step exits 0.
2. ~~Observed category string matches `categoryMatches()` tolerance~~ -- CLOSED (moot by outcome). Whichever form GitHub returned, the assert step's set-membership check succeeded, proving the CR-01 defensive tolerance works in practice; the exact string was not independently extracted since the outcome (assertion passed) is the load-bearing fact.
3. ~~Job goes red on a genuine regression~~ -- CLOSED. Directly observed: the first real CI run hit an actual, unplanned SARIF->Code Scanning contract break (G-35-01) and the job went red automatically, with no manual intervention -- the strongest possible form of this evidence.

### Gaps Summary

No gaps. No FAILED truth, no MISSING/STUB artifact, no NOT_WIRED key link, no blocker anti-pattern, and no remaining human-verification item.

One non-blocking residual noted for completeness (does not affect the verdict): the assert script's own tuple-membership RED branch (a live GitHub alerts response missing one specific expected tuple, as opposed to the whole SARIF being rejected at ingestion) has been unit-proven against mocked data but not yet observed against a genuinely broken live GitHub response. The G-35-01 incident proved the pipeline's red-on-regression property at the ingestion layer, which is the stronger and more likely real-world failure mode; the tuple-layer RED path is lower-risk residual coverage, not a phase-goal gap.

The phase goal -- "A CI check continuously PROVES the SARIF -> Code Scanning contract end-to-end ... and fails red the moment any part of that contract regresses" -- is achieved and directly demonstrated in production: it caught a real defect (G-35-01) on its very first live run, that defect was fixed (plan 35-04), and the same job now runs green end-to-end on the milestone PR (run `29875173270`).

---

_Verified: 2026-07-22T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
