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

## Round 2 (quality / simplification reviews)

Six more reports (`/thermo-nuclear-code-quality-review`, `/ponytail-review`
full+ultra, `/simplify`, `/ponytail-audit` full+ultra) -- all simplification/dead-code,
several targeting the parallel boilerplate round-1's correctness fixes ADDED.
Triage principle: fix boilerplate THIS PR (incl. round-1) introduced; defer/reject
pre-existing or documented-intentional structure. 3 behavior-preserving `refactor`
commits (251/251 unchanged):

- `641f79e` refactor(core): throwIfInfrastructureFailure (3 sites), runNoEmitCompilation
  (2 sites), buildFinalizeFilter (2 sites), hasProjectReferences (2 sites), 90001/90002
  codes + synthesizeFilelessError moved to diagnostic-codes.ts
- `5808180` refactor(generators): export/reuse TYPECHECK_EXECUTOR_ID, configuration
  returns void (drops the no-op runTasksInSerial), hoist tree.exists(solution)
- `11efce7` refactor(executor): skippedReferences?.length

Declined/deferred with rationale: finalize-fork collapse (keeps the stronger
never-filter-config-errors-on-all-skipped invariant); merge duplicate/self-reference
reason (keeps round-1's accuracy split); delete exit-codes.ts / TemplateCheckAborted.code
(documented deferral / "do not drop"); trim index barrel + move pathBase + inline
ngCodeOf + extract loadTypescript (pre-existing, out of PR scope / public-API decisions).

## Follow-up: fallow CI gate (`58907e7`)

The review-fix rounds tripped fallow's new-only gate two ways, both fixed:
- unused export -- round-2's `runNoEmitCompilation` made `EMIT_NEUTRALIZING_OPTIONS`
  module-private-only, so its `export` was dropped.
- complexity -- round-1's correctness branches pushed `walkReferences` and
  `resolveTsConfig` over threshold. Both are reviewer-blessed irreducible domain
  logic (resolveTsConfig's CRAP is a coverage-estimation false-high -- fully spec'd),
  so scoped in `.fallowrc.jsonc` rather than refactored. `fallow audit` exit 0.

Then a `/simplify` audit (`c5e9131`) revisited the complexity: applied Fix 1 (hoist
walkReferences' repeated `canonicalLeaf !== undefined` guard; cyclomatic 13->10, but
cognitive stays ~20, so it stays fallow-scoped -- the report's "cognitive drops more"
was wrong) and Fix 3 (extract `resolveTsConfigOverride`; cyclomatic 10->7 clears its
CRAP, so resolveTsConfig is now UNSCOPED). Skipped Fix 2 (cosmetic closure). Net: the
fallow complexity scope is down to the single irreducible `walkReferences`.

