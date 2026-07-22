---
phase: 36-code-scanning-gating-scanned-files-documentation
reviewed: 2026-07-22T01:46:01Z
depth: deep
files_reviewed: 5
files_reviewed_list:
  - .github/workflows/ci.yml
  - AGENTS.md
  - packages/angular-typechecker/README.md
  - packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts
  - packages/angular-typechecker/src/code-scanning-docs.spec.ts
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
status: issues_found
---

# Phase 36: Code Review Report

**Reviewed:** 2026-07-22T01:46:01Z
**Depth:** deep
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 36 is CI/docs/test-only and additive vs @0.2.3: it promotes the two Code
Scanning jobs into the required `ci` aggregate (D-02), un-path-gates the dogfood
`code-scanning` job (D-01), adds two `if:`-gated fail-loud SARIF-produced
assertions (D-03), rewrites three stale comments (D-05), adds a drift guard, and
ships an AGENTS.md ruleset runbook + a README "Scanned files" limitation note +
a docs tripwire.

The security-critical invariants for this phase all hold. The two new D-03
assertion steps (ci.yml:611-623) use pure `if:`-expression gating with a STATIC
`echo "::error::..."`/`exit 1` body -- no step output and no PR metadata is
interpolated into any `run:` shell, so the command-injection invariant (T-36-02)
is preserved verbatim. No new action or SHA was introduced (`upload-sarif@7188fc3...
# v4.37.1` reused), and `persist-credentials: false`, `fetch-depth: 0`, the
job-scoped `contents: read` + `security-events: write`, and the fork-PR upload
gates are all unchanged on the touched jobs.

Correctness verification performed:

- Drift-guard regexes replicated against the real ci.yml: membership matches are
  list-item-anchored and both return true; the un-path-gate anti-assertion is
  correctly scoped to the `code-scanning` block and returns false; the D-03
  existence assertion anchors on `produced == 'false'` and returns true (does not
  false-match the upload step's `produced == 'true'`). All three are non-vacuous
  (`extractJobLines` throws on a missing job).
- Docs tripwire tokens (`### SARIF and GitHub Code Scanning`, `Scanned files`,
  `a GitHub limitation`, `CodeQL`, `run.artifacts`) all exist in the shipped
  README -- the tripwire is not vacuous.
- `act-compat.sh` assertions for `code-scanning` / `code-scanning-proof`
  (lines 118/122/130/134) still hold after un-path-gating (an un-gated job is
  always selected in the plan), so the required `act-compat` / `lint-workflows`
  gates are not broken by this change.
- AGENTS.md runbook is factually accurate against the live ci.yml: SARIF
  `driver.name` is confirmed `angular-typechecker` (sarif-report.spec.ts:229), the
  findings-gate references (`test` -> `nx run-many -t typecheck`; the `fallow`
  job) are correct, and the per-PR-kind analysis behavior matches the wiring.
- ASCII-only confirmed on all five files; no email-shaped token and no work-domain
  leak in any changed file; Prettier passes on all five.

One WARNING: a comment block left contradictory by the un-path-gating (the exact
class of defect D-05 set out to eliminate). One Info: a minor coupling on the
un-path-gated job. No blockers.

## Narrative Findings (AI reviewer)

### Warnings

#### WR-01: Stale "Path-gated" comment contradicts the now-un-path-gated `code-scanning` job

**File:** `.github/workflows/ci.yml:546-547`
**Issue:**
Un-path-gating the `code-scanning` job (D-01) removed its
`if: ${{ needs.changes.outputs.code != 'false' }}` line, but the trailing comment
immediately above the job key was not updated. It still reads:

```
  # Path-gated (D-08), SAME NEGATIVE if: form as test/e2e -- skips a planning/docs-
  # only PR yet stays in the `act -n` plan under the empty filter output.
  code-scanning:
```

This is now factually wrong and internally self-contradictory: the same job's
rewritten header comment at ci.yml:497 correctly states it "is un-path-gated
(below) so it runs on EVERY PR incl. planning-only," and the job (ci.yml:548-550)
has no `if:`. The stale note claims the opposite ("Path-gated ... skips a
planning/docs-only PR").

Why this matters beyond cosmetics: an accurate "runs on every PR ref" statement
is load-bearing for GATE-02 -- the whole point of D-01 is that a Code Scanning
analysis exists on every PR ref so GitHub's "Require code scanning results"
ruleset cannot deadlock a planning-only PR. A maintainer reading line 546-547
would conclude planning-only PRs skip `code-scanning` (the exact opposite of the
new, security-relevant behavior), which could lead to a wrong debugging
conclusion during the human ruleset-enablement runbook. D-05 explicitly set out
to make the comments internally consistent with the new membership/un-path-gating;
this one was missed (Edit 4 rewrote the two `DELIBERATELY NOT` blocks and the
`cve-lite` note, but not this trailing `Path-gated (D-08)` note). The verified
"Path-gated" occurrences elsewhere (test/discover/e2e/e2e-windows/fallow/cve-lite/
format-lint at 94/150/202/291/334/368/395, and the proof job at 681/685) are all
still correct -- only 546-547 is stale.

**Fix:** Delete the orphaned note, or rewrite it to match the header, e.g.:

```yaml
  # UN-path-gated (D-01, GATE-02): unlike test/e2e, this job runs on EVERY PR
  # (incl. a planning/docs-only PR) so a Code Scanning analysis always exists on
  # the PR ref; being un-gated it is trivially in the `act -n` plan.
  code-scanning:
```

### Info

#### IN-01: `needs: changes` retained on the un-path-gated `code-scanning` job

**File:** `.github/workflows/ci.yml:549`
**Issue:**
After removing the path-gate `if:`, the job keeps `needs: changes`, but it no
longer reads any `changes` output. This was a deliberate, plan-documented choice
("harmless -- it just serializes after the fast `changes` job"), and it is
backstopped: if `changes` ever fails, `code-scanning` is skipped (dependency
failure), but `changes` failing also sets `contains(needs.*.result, 'failure')`
in the `ci` aggregate, so `ci` goes red and the documented `enforcement: disabled`
recovery applies -- there is no SILENT missing-analysis path. The only nuance is
that the "an analysis exists on every PR ref" guarantee is technically
"...on every PR ref where `changes` succeeded," which the always-run, essentially
never-failing `changes` job satisfies in practice.

**Fix (optional):** Drop `needs: changes` from `code-scanning` so the job is fully
decoupled and unconditionally runs, matching the "runs on every PR" intent
literally. Keep it as-is if the serialization after `changes` is wanted; no code
change is required for correctness.

---

_Reviewed: 2026-07-22T01:46:01Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
