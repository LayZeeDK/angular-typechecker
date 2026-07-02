---
slug: pr15-thermos-triage
created: 2026-07-02
kind: quick
validate: false
---

# Quick task: PR #15 Thermos-review triage

A fourth review round on PR #15 (`/thermos:thermos` -- thermo-nuclear branch
audit + code-quality audit, `.planning/` ignored) surfaced findings that overlap
heavily with the three prior rounds already triaged in
`20260702-pr15-review-triage` (status: complete). Triage each Thermos finding
against the Phase/Milestone/Project decisions and the prior triage, consulting
the ponytail-full (lazy-senior) lens on all findings. The PR is green and
awaiting merge, so the bar for any new churn is high.

## Directives (from the user)

1. **Skip migrations.json** -- decision for the executor-rename break.
2. **Keep GSD IDs but combine with plain language** -- decision for the
   code-quality HIGH (comment legibility); reject the reviewer's "strip IDs".
3. **Audit + triage `run-typecheck.ts:260-352`** (extract-walk-branch finding)
   against Phase/Milestone/Project decisions. Consult ponytail-full on all.
4. **Audit + triage the remaining findings** (target-defaults dup, schema-parity
   dup, directory-reference LOW) against Phase/Milestone/Project decisions.

## Approach

Investigation-only where the directive is a decision (#1, #2) or an audit
(#3, #4). Read the actual shipped source, the Phase 13 decision docs, and the
prior triage SUMMARY; apply the ponytail ladder (does it need to exist? already
decided? churn on a green PR?) to each finding. Land a code fix ONLY where the
triage finds a genuine, not-already-decided defect this PR introduced.

## Validation

None planned: a triage that lands no code needs no `nx test`/`build` run. If any
fix lands, run `nx test angular-typechecker` + `nx run-many -t lint` +
`nx format:check` before committing.
