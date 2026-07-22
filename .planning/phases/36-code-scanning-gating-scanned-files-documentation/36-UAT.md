---
status: testing
phase: 36-code-scanning-gating-scanned-files-documentation
source: [36-VERIFICATION.md]
started: 2026-07-22T05:59:08Z
updated: 2026-07-22T07:54:22Z
---

## Current Test

number: 2
name: GATE-02 human-only ruleset enablement (D-04) -- run the AGENTS.md runbook on `main`
expected: |
  A maintainer follows the AGENTS.md "Enabling the Require code scanning
  results ruleset (human-run, real-CI-only)" runbook end-to-end AFTER this
  phase's PR (#55) merges: add the rule for BOTH angular-typechecker AND fallow
  -> Evaluate mode first -> probe a `.planning/`-only PR AND a code PR ->
  confirm Ruleset Insights shows neither would be blocked -> flip to Active.
  The `enforcement: disabled` recovery path is understood and the fork-PR
  deadlock is accepted as documented. Human-only, real-CI-only -- the agent
  never performs this toggle.
awaiting: human maintainer (post-merge)

## Tests

### 1. GATE-01 real-CI Nyquist point -- required `ci` aggregate RED-on-regression / GREEN-on-clean

expected: `ci` fails when `code-scanning` or `code-scanning-proof` fails/cancels; `ci` passes when both succeed or are legitimately path-skipped. Real-CI-only (GitHub Actions ingestion + aggregate verdict cannot be reproduced locally). Mirrors the 35-03 PROOF precedent.
result: [passed]
evidence: |
  Verified in real CI on PR #55's branch (both halves):
  - GREEN-on-clean: run 29898624245 (headSha 3e4fc6f, the actual phase-36 state)
    completed success -- `code-scanning`=success, `code-scanning-proof`=success,
    and the required `ci` aggregate=success with BOTH jobs as members. (The
    earlier green run 29881837667 was on the pre-change 42295c7 where
    `code-scanning` was NOT yet a `ci` member, so it did not count.)
  - RED-on-regression: throwaway chaos PR #56 forced an empty angular-typechecker
    SARIF (produced=false). Run 29901279596 completed failure: the D-03 step
    "Assert angular-typechecker SARIF was produced (non-fork PR)"=failure (exit 1,
    the P7 empty-SARIF scenario), so `code-scanning`=failure and the required `ci`
    aggregate=failure. `code-scanning-proof`=success (attribution confirmed). Chaos
    PR #56 was closed and its branch deleted; the milestone branch is unchanged.
  - Also provable by construction: `ci.needs[]` includes both jobs (ci.yml:779-780),
    and the byte-unchanged Gate step fails on
    `contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled')`.

### 2. GATE-02 human-only ruleset enablement (D-04) -- run the AGENTS.md runbook on `main`

expected: A maintainer follows the AGENTS.md "Enabling the Require code scanning results ruleset (human-run, real-CI-only)" runbook end-to-end AFTER this phase's PR merges: add the rule for BOTH angular-typechecker AND fallow -> Evaluate mode first -> probe a `.planning/`-only PR AND a code PR -> confirm Ruleset Insights shows neither would be blocked -> flip to Active. The `enforcement: disabled` recovery path is understood and the fork-PR deadlock is accepted as documented. Human-only, real-CI-only -- the agent never performs this toggle.
result: [pending]
note: |
  Blocked on a human maintainer, by design (D-04 + the repo's human-only posture
  for `main` protections). The agent NEVER flips the `main` ruleset -- a misstep
  on the PR-only, empty-bypass `main` could lock out all merges. This step is
  genuinely post-merge: it runs AFTER PR #55 merges. The AGENTS.md runbook is
  shipped and code-reviewed for accuracy; execution is the maintainer's action.

## Summary

total: 2
passed: 1
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
