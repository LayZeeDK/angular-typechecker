---
slug: pr15-review-triage
status: complete
date: 2026-07-02
validate: true
---

# SUMMARY: PR #15 review triage + fixes

Merged, deduplicated, audited, and triaged three PR #15 code-review reports
(`/pr-review-toolkit:review-pr all`, `/code-review:code-review`, `/code-review max`),
then addressed every triaged finding. 29 raw findings -> 21 unique; all verified
against the code before acting.

## Outcome

19 CONFIRMED findings fixed, 1 recorded as an explicit decision, 2 deferred with
rationale. 7 atomic commits on the PR branch:

- `47760be` fix(core): C-1, I-1, I-2, S-7, I-3, S-1 + FAL-04 dedup (walk parity)
- `eee2a55` fix(executor): C4 advisory wording for not-found refs
- `d8f487c` fix(generators): C3 flat tsconfig, C13 empty targetName, S-3, C6/C12 docs, S-2 tests
- `da84d31` test(core): B1/C14 drift comments, S-6 uniqueness, I-4 keyof binding, C11 target-defaults drift
- `fd4b3b3` ci: C9 format-lint runs on non-.planning doc PRs
- `0a90225` docs(core): I-5/C7 zero-root walk decision + nested-solution limitation
- `adc7d5f` style(core): Prettier reflow of review-fix spec files

Two fixes reversed decisions the code documented as intentional (I-3 'duplicate'
label; FAL-04 emit-block dedup) -- both flagged to the user, both routed through
the standard review.

## Decision recorded (no behavior change)

- I-5/C7: a zero-rootNames leaf inside a walk stays advisory (pass-with-warn),
  deliberately asymmetric with the direct path's hard 90001; nested-solution
  recursion is a documented single-level limitation. Recorded at the D-03b branch.

## Deferred (with rationale)

- C12 (absolute --tsConfig written verbatim): documented OQ-1; the schema
  advertises absolute; probing is impossible against the virtual tree. Addressed
  the spirit with a portability note in the schema description.
- S-5 (skippedReferences non-empty tuple type): low-value type nicety; the runtime
  guards are already correct.

## Validation (--validate)

Green: `nx test` (251/251, 34 files), `nx build` (tsc), `nx typecheck-drift`,
`nx run-many -t lint` (maxWarnings:0), Prettier `--check` on every changed file.
act-compat could not run locally (Docker down) but the change preserves the
`!= 'false'` if: form and the pre-change workflow fails act-compat identically
locally, so the regression is environmental; CI (with Docker) runs it.
