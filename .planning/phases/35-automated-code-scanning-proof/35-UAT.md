---
status: issues
phase: 35-automated-code-scanning-proof
source: [35-VERIFICATION.md]
started: 2026-07-21T20:28:24Z
updated: 2026-07-21T20:38:12Z
---

## Current Test

number: 1
name: code-scanning-proof job asserts real GitHub ingestion on the milestone PR
expected: |
  On the milestone PR against main, the code-scanning-proof job runs: the gen step
  produces proof.sarif from tools/sarif-proof-fixture, the upload step uploads it
  under category: angular-typecheck-proof, and the "Assert proof alerts landed" step
  polls code-scanning/sarifs/{id} to complete, then code-scanning/analyses and
  code-scanning/alerts on refs/pull/<n>/merge. The assert step exits 0, logging
  "code-scanning proof: all expected (category, family tag, severity) tuples present
  on refs/pull/<n>/merge".
awaiting: gap decision (see Gaps)

## Tests

### 1. code-scanning-proof job asserts real GitHub ingestion on the milestone PR
expected: The assert step exits 0, logging "code-scanning proof: all expected (category, family tag, severity) tuples present on refs/pull/<n>/merge" -- meaning GitHub actually ingested the SARIF and surfaced all four (family tag, severity) alerts under the angular-typecheck-proof category (or its upload-sarif-synthesized angular-typecheck-proof/ form).
result: issue -- First real CI run (PR #55, ci run 29866139011, job 88754758103, 2026-07-21). The gen + nx build steps succeeded (proof.sarif produced, incl. the deliberate ATC90002 tool diagnostic for the missing tsconfig). The `upload-sarif` step FAILED at wait-for-processing: "Analysis upload status is failed. Code Scanning could not process the submitted SARIF file: locationFromSarifResult: expected at least one location". GitHub rejected the ENTIRE SARIF because at least one result has no `locations` -- the file-less `tool` (ATC90002) diagnostic, which sarif-report.ts intentionally emits as a no-location result (D-01, sarif-report.ts:28/202). The assert step was consequently SKIPPED. The proof harness correctly went RED (PROOF-02 behavior confirmed) -- but on the upload/ingestion boundary, not the set-membership assertion.

### 2. Observed GitHub category string matches categoryMatches() tolerance (CR-01)
expected: The category GitHub returns on the first real run (angular-typecheck-proof vs. the upload-sarif-synthesized trailing-slash angular-typecheck-proof/ form) is accepted by categoryMatches(); the assert step does not permanently false-RED on this string.
result: blocked -- The assert step never ran (upload rejected before any alerts landed), so the live category string is still unobserved. CR-01's defensive categoryMatches() tolerance remains untested against reality.

### 3. code-scanning-proof job goes red on a genuine live regression
expected: On a real CI run where a genuine regression removes/breaks one family's SARIF rule (or as a deliberate drill), the "Assert proof alerts landed" step exits non-zero and GitHub marks the code-scanning-proof check red -- no silent pass.
result: blocked -- The job went red, proving fail-loud on a broken contract, but on the SARIF-ingestion rejection above rather than on a set-membership miss. The assert's own RED path stays proven only locally until the ingestion defect (Gap G-35-01) is fixed and the assert can actually run in CI.

## Summary

total: 3
passed: 0
issues: 1
pending: 0
skipped: 0
blocked: 2

## Gaps

### G-35-01: SARIF reporter emits file-less (tool/project-level) diagnostics with no `locations`, which GitHub Code Scanning rejects

**Discovered:** 2026-07-21, first real CI run of the code-scanning-proof job (PR #55, ci run 29866139011).

**Symptom:** `upload-sarif` fails at wait-for-processing with `Code Scanning could not process the submitted SARIF file: locationFromSarifResult: expected at least one location`. The whole SARIF is rejected, so NO proof alerts land and the assert step is skipped.

**Root cause:** `packages/angular-typechecker/src/core/sarif-report.ts` (D-01) intentionally emits a file-less diagnostic as a SARIF result with NO `locations` key (line 28 / 202). The proof fixture's `tool` family (ATC90002, the deliberate missing-`tsconfig.missing.json`) is inherently file-less, so its result has no location. GitHub Code Scanning requires every result to carry at least one location and rejects the entire file otherwise. The dogfood `code-scanning` job passes only because its real projects apparently never emit a file-less diagnostic through this path.

**Scope note:** the fix is in PRODUCTION reporter code (`sarif-report.ts`) -- a published-surface change outside phase 35's additive (D-04) boundary -- and it revisits the locked D-01 "no-location result" decision. It therefore belongs in a deliberate gap-closure plan, NOT an inline patch. Candidate fix: attach a synthetic fallback location (e.g. artifactLocation -> the project tsconfig or the referenced missing file, region line 1) to file-less diagnostics so they are ingestible while still never dropped.

**Blocks:** UAT items 1, 2, 3 (all gated on the SARIF being ingested). Phase 35's own deliverables (fixture, assert script, CI job) are correct and did their job by surfacing this.

