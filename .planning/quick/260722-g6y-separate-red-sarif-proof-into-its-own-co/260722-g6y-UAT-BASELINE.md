# Quick Task 260722-g6y -- UAT Baseline (BEFORE the rework)

**Captured:** 2026-07-22, on `gsd/v0.2.4-enhanced-sarif-reporting-for-github-code-scanning` @ `6f336bb`
**Purpose:** anchor the before/after comparison for the autonomous UAT. Captured BEFORE the rework
lands, so the tool-separation claim is provable rather than asserted.

## Code Scanning alerts on `refs/pull/55/merge`

Query: `GET /repos/LayZeeDK/angular-typechecker/code-scanning/alerts?ref=refs/pull/55/merge&per_page=100`

| Alert | Tool | Rule | Category | Path | `most_recent_instance.state` |
|-------|------|------|----------|------|------------------------------|
| #8 | `angular-typechecker` | TS2322 | `angular-typecheck-proof` | `tools/sarif-proof-fixture/type-error.ts` | open |
| #7 | `angular-typechecker` | NG8101 | `angular-typecheck-proof` | `tools/sarif-proof-fixture/proof.component.html` | open |
| #6 | `angular-typechecker` | NG8002 | `angular-typecheck-proof` | `tools/sarif-proof-fixture/proof.component.html` | open |
| #5 | `angular-typechecker` | ATC90002 | `angular-typecheck-proof` | `tools/sarif-proof-fixture/tsconfig.json` | open |
| #4 | `fallow` | `fallow/high-crap-score` | `fallow` | `packages/angular-typechecker/src/core/sarif-report.ts` | fixed |

## What this baseline establishes

1. **The conflation is real and is by TOOL, not category.** All four deliberate proof alerts already
   carry the distinct category `angular-typecheck-proof`, yet they sit under
   `tool.name = angular-typechecker` -- the same tool as the clean dogfood. This is precisely why the
   `angular-typechecker` Code Scanning check is red, and it confirms that changing the category was
   never going to be sufficient. Only a distinct `driver.name` separates them.

2. **ATC90002 is NOT file-less -- D-03's original wording was wrong.** Alert #5 carries
   `location.path = tools/sarif-proof-fixture/tsconfig.json`. This is the Phase 35-04 region-less
   whole-file fallback (`artifactLocation.uri` = relativized `tsConfigPath`). An exact-set matcher
   asserting an ABSENT location for ATC90002 would have failed permanently in real CI. The corrected
   D-03 (assert at `tsconfig.json`) is empirically confirmed here, independently of the research agent.

3. **The 3 unresolved review threads map to the 3 in-diff alerts.** #6, #7, #8 are inside the PR diff
   (`proof.component.html` x2, `type-error.ts`) and each has an auto-posted
   `github-advanced-security` thread. #5 (`tsconfig.json`, line 1) is NOT in the diff and got no
   thread -- consistent with the research finding that threads are posted only for in-diff alerts.

4. **`github-advanced-security` does auto-resolve its own threads.** Alert #4 (fallow) is `fixed`,
   and its thread was resolved by `github-advanced-security[bot]`. Relevant to open question A1.

## Expected AFTER state (the UAT assertions)

- The four proof diagnostics appear under tool `angular-typechecker-red-proof`, NOT
  `angular-typechecker`.
- Tool `angular-typechecker` reports GREEN on a clean workspace (no proof alerts under it).
- The new `code-scanning-red-proof` job's exact-set assert PASSES against
  {TS2322@type-error.ts, NG8002@proof.component.html, NG8101@proof.component.html,
  ATC90002@tsconfig.json} -- no more, no less.
- The dismiss step runs strictly AFTER the assert and is non-fatal.
- NOTE: alerts #5-#8 are expected to remain orphaned `open` under `angular-typechecker` even after
  the rework, because renaming the job changes `analysis_key`. The rename alone therefore does NOT
  green PR #55 -- the separate thread cleanup is still required. This is expected, not a regression.
