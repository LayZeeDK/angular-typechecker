---
status: testing
phase: 36-code-scanning-gating-scanned-files-documentation
source: [36-VERIFICATION.md]
started: 2026-07-22T05:59:08Z
updated: 2026-07-22T05:59:08Z
---

## Current Test

number: 1
name: Required `ci` aggregate goes RED on a real Code Scanning regression, GREEN on a clean PR
expected: |
  On this phase's own PR run (or a follow-up throwaway PR), the required `ci`
  aggregate fails when the `code-scanning` or `code-scanning-proof` job
  fails/cancels (e.g. a deliberately introduced Code Scanning upload/infra
  failure or a PROOF-02 SARIF->Code-Scanning contract regression), and passes
  when both succeed (or are legitimately path-skipped -- the proof job on a
  planning-only PR). Both `code-scanning` and `code-scanning-proof` are required
  members of the aggregate. PR #55 already corroborates the GREEN-on-clean half
  (both jobs SUCCESS, `ci` SUCCESS); the RED-on-regression half is unexercised
  by design.
awaiting: user response

## Tests

### 1. GATE-01 real-CI Nyquist point -- required `ci` aggregate RED-on-regression / GREEN-on-clean

expected: `ci` fails when `code-scanning` or `code-scanning-proof` fails/cancels; `ci` passes when both succeed or are legitimately path-skipped. Real-CI-only (GitHub Actions ingestion + aggregate verdict cannot be reproduced locally). Mirrors the 35-03 PROOF precedent.
result: [pending]

### 2. GATE-02 human-only ruleset enablement (D-04) -- run the AGENTS.md runbook on `main`

expected: A maintainer follows the AGENTS.md "Enabling the Require code scanning results ruleset (human-run, real-CI-only)" runbook end-to-end AFTER this phase's PR merges: add the rule for BOTH angular-typechecker AND fallow -> Evaluate mode first -> probe a `.planning/`-only PR AND a code PR -> confirm Ruleset Insights shows neither would be blocked -> flip to Active. The `enforcement: disabled` recovery path is understood and the fork-PR deadlock is accepted as documented. Human-only, real-CI-only -- the agent never performs this toggle.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
