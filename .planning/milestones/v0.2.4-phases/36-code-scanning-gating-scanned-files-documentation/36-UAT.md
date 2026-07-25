---
status: complete
phase: 36-code-scanning-gating-scanned-files-documentation
source: [36-VERIFICATION.md]
started: 2026-07-22T05:59:08Z
updated: 2026-07-23T17:20:00Z
---

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
result: [passed]
evidence: |
  Executed by the human maintainer AFTER PR #55 merged (merge commit 966a7c6),
  and proven live on `main`. The "Require code scanning results" ruleset is now
  ACTIVE on `main` with `angular-typechecker` + CodeQL as required Code Scanning
  tools (user-authorized this session), and was proven CLEAN on BOTH probe PR
  kinds the runbook requires:
  - Planning-only probe PR #64: the un-path-gated `code-scanning` dogfood job
    produced an `angular-typechecker` analysis, so the gate did NOT deadlock a
    `.planning/`-only PR -- check = success ("No new alerts").
  - Code probe PR #65: produced the `angular-typechecker` analysis + the proof
    tool -- check = success ("No new alerts").
  DEVIATION vs the original expected flow (recorded honestly, non-blocking):
  (a) The true blocker was NOT the runbook mechanics but an ORPHANED
      `angular-typechecker`-category Code Scanning config left on `main` by the
      Phase-34 category rename to `angular-typecheck`; a required tool whose
      analysis can never be reproduced yields a PERMANENT "configuration not
      found" block. Resolved by deleting the 4 orphaned analyses via the Code
      Scanning API (spike 012). No `ci.yml` change was needed -- the existing
      multi-run + default merge-ref upload already satisfies the gate.
  (b) `fallow` was intentionally NOT added to the required tool list (findings
      already gate via the `ci` `fallow` job), and `angular-typechecker-red-proof`
      is deliberately kept OFF the required list. Both are documented decisions,
      not gaps.
  The `enforcement: disabled` recovery path and the fork-PR deadlock limitation
  are documented in AGENTS.md and understood. See HANDOFF.json + auto-memory
  `gate-02-require-code-scanning-results-blocks-third-party-sarif` for the full
  root-cause narrative. (Task-list #12 marks this human toggle complete.)

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
