---
status: testing
phase: 35-automated-code-scanning-proof
source: [35-VERIFICATION.md]
started: 2026-07-21T20:28:24Z
updated: 2026-07-21T20:28:24Z
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
awaiting: user response

## Tests

### 1. code-scanning-proof job asserts real GitHub ingestion on the milestone PR
expected: The assert step exits 0, logging "code-scanning proof: all expected (category, family tag, severity) tuples present on refs/pull/<n>/merge" -- meaning GitHub actually ingested the SARIF and surfaced all four (family tag, severity) alerts under the angular-typecheck-proof category (or its upload-sarif-synthesized angular-typecheck-proof/ form).
result: [pending]

### 2. Observed GitHub category string matches categoryMatches() tolerance (CR-01)
expected: The category GitHub returns on the first real run (angular-typecheck-proof vs. the upload-sarif-synthesized trailing-slash angular-typecheck-proof/ form) is accepted by categoryMatches(); the assert step does not permanently false-RED on this string.
result: [pending]

### 3. code-scanning-proof job goes red on a genuine live regression
expected: On a real CI run where a genuine regression removes/breaks one family's SARIF rule (or as a deliberate drill), the "Assert proof alerts landed" step exits non-zero and GitHub marks the code-scanning-proof check red -- no silent pass.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
