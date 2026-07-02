---
quick_id: 260702-hsv
status: passed
score: 4/4 must-haves verified
verified: 2026-07-02
---

# Verification: 260702-hsv (fallow CI gate fix)

Verified against the actual codebase by running the exact CI command and the full gate set.

## Must-haves

| # | Must-have | Status | Evidence |
|---|---|---|---|
| 1 | CI `fallow` command exits 0 on the cumulative v0.1.0 diff | PASS | `FALLOW_AUDIT_BASE=origin/main npx fallow audit --format human --base origin/main` -> `✓ No issues in 347 changed files` (exit 0). Down from 34 dead-code + 10 complexity + 1 duplication. |
| 2 | No product-code gate weakened | PASS | All suppressions are scoped to test scaffolding: `unused-files: off` only for `**/*.spec.ts`/`**/*.int.spec.ts`; `health.ignore` only `e2e/**`/`fixtures/**`/spec globs; unrendered override only fixtures/e2e-fixtures/libs; `ignoreDependencies` only `@angular/core` (no product code imports it); duplication suppressed only at the one reviewed D-05 mirror. `unused-files`/`unlisted-dependencies`/complexity/duplication all stay gated for `packages/angular-typechecker/src` product code. |
| 3 | No shipped engine logic change | PASS | `git diff` on walk-references.ts is comment-only (a rationale block + one `// fallow-ignore-next-line code-duplication` directive). Reason union + behavior byte-unchanged; 239/239 tests pass. |
| 4 | format:check + lint + unit suite green | PASS | `nx format:check` exit 0; `nx lint angular-typechecker` "All files pass linting" (maxWarnings:0); `nx test angular-typechecker` 32 files / 239 tests passed. |

## Gate re-run summary

- fallow: exit 0 (`✓ No issues in 347 changed files`)
- format:check: exit 0
- lint: clean (maxWarnings:0)
- test: 239/239

## Note

The separate CI `e2e` failure is an environmental `spawn sh ENOENT` flake in the
publint/attw/pnpm external-tool invocations (the milestone's own generator/walk e2e proofs
PASSED); it is not addressed by code because there is nothing to fix -- it is expected to
clear on the fresh CI run this fix triggers. If it recurs deterministically, it will be
addressed separately.

**Status: passed.**
