---
phase: 34-per-project-sarif-categories-in-ci
fixed_at: 2026-07-21T16:45:00Z
review_path: .planning/phases/34-per-project-sarif-categories-in-ci/34-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 34: Code Review Fix Report

**Fixed at:** 2026-07-21T16:45:00Z
**Source review:** .planning/phases/34-per-project-sarif-categories-in-ci/34-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03 -- Critical + Warning per fix scope; IN-01 and IN-02 explicitly excluded)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: Discovery keeps only the FIRST target using the executor, silently dropping tsConfig coverage for a project with multiple such targets

**Files modified:** `tools/ci/list-typecheck-projects.mjs`, `packages/angular-typechecker/src/multi-typecheck-discovery-guard.spec.ts`
**Commit:** `1fccdc2`
**Applied fix:** Replaced the `.find()` (first-match) with `.filter()` to collect every target in a project whose `executor === 'angular-typechecker:typecheck'`, then `flatMap`'d each matching target's `options.tsConfig` (each normalized from `string | string[]`) into one order-stable, deduped (`[...new Set(...)]`) array. Still emits exactly one `{ name, tsConfig[] }` entry per project (MULTI-01 contract preserved -- one Code Scanning analysis per project). Updated the file's header comment (previously said "keeps the target", now accurately says "keeps EVERY target" + documents the union/dedup behavior and cites the `libs/local-lib` fixture as the real-world two-target shape). Added a new regression test (`listTypecheckProjects: unions tsConfig across multiple executor targets in one project`) to `multi-typecheck-discovery-guard.spec.ts` that constructs a project with both a `typecheck` and a `typecheck-spec` target (mirroring the real `libs/local-lib` fixture) and asserts the discovered `tsConfig` array contains both entries in insertion order.

### WR-02: `atc-sarif` step lost its `|| true` tolerance -- an uncaught discovery exception now fails the whole `code-scanning` job, including fallow's reporting

**Files modified:** `.github/workflows/ci.yml`
**Commit:** `ee08912`
**Applied fix:** Restored `|| true` on the `node tools/ci/merge-sarif.mjs` invocation in the `atc-sarif` step, matching the pre-rewire behavior and the adjacent (unchanged) `fallow-sarif` step's own `|| true`. A discovery/merge throw (empty project set, malformed `project.json`) now degrades to `produced=false` via the existing `[ -s angular-typechecker.sarif ]` guard instead of crashing the job and skipping the `fallow-sarif` step + both uploads.

No separate edit to the adjacent MED-01 comment block (lines 515-527) was needed: that block already accurately describes "each generation step tolerates a non-zero exit (`|| true`)" and becomes true again for the `atc-sarif` step the moment the tolerance is restored -- it was the CODE that had drifted from the comment, not the other way around. Verified no other comment in the job references the pre-fix (broken) behavior; the `fallow-sarif` step's own comment ("Same `|| true` + non-empty produced guard as above") also becomes accurate again as a side effect.

### WR-03: Per-project CLI `stderr` is captured but never surfaced, so a silently-skipped project leaves no diagnostic trail

**Files modified:** `tools/ci/merge-sarif.mjs`
**Commit:** `6485a4c`
**Applied fix:** When a per-project `spawnSync` invocation yields empty stdout, the skip path now logs a `console.error` breadcrumb naming the project, its exit `status`, and the first line of `stderr` (when present) before `continue`-ing -- e.g. `merge-sarif: skipped <name> -- empty stdout (status 2: <first stderr line>)`. Kept the existing skip-and-continue control flow unchanged (no `throw`), so a single failing project still does not abort the merge for the rest. Scoped narrowly to the exact skip point WR-03 cites (`stdout.length === 0`); the separate `JSON.parse` catch-block skip a few lines below was not touched, since neither the review finding nor the fix intent named it. No new test was added for this finding (not requested in fix intent, and asserting on a subprocess's stderr via `execFileSync` would need a `spawnSync`-based spec rewrite that is out of scope for a diagnostics-only logging change); the existing `merge-sarif.spec.ts` `proj-empty` case already exercises this exact skip path end-to-end and still passes.

## Skipped Issues

None -- all 3 in-scope findings were fixed.

## Gate Battery Results

All 4 required gates ran green after all 3 fixes were committed (worktree HEAD `6485a4c`, `node_modules` shared via junction from the main checkout per AGENTS.md Pattern A -- no dependency changes in this fix):

| Gate | Command | Result |
|------|---------|--------|
| Unit tests | `npx nx test angular-typechecker --skip-nx-cache` | PASS -- 55 test files, 570 tests, 0 failures (includes the new WR-01 union test and the pre-existing WR-03 empty-stdout-skip coverage in `merge-sarif.spec.ts`) |
| Typecheck | `npx nx run-many -t typecheck --skip-nx-cache` | PASS -- 12 projects, 0 errors (one pre-existing advisory `.mdx`/`.tsx` notice, unrelated to this fix) |
| Lint | `npx nx lint angular-typechecker --skip-nx-cache` | PASS -- "All files pass linting" (maxWarnings:0 satisfied) |
| Format | `npx nx format:check --base=5cc630b --head=HEAD` | PASS -- exit 0, no unformatted files |

The `ci-e2e-coverage-guard.spec.ts` GUARD-01-family spec (the closest workflow-guard spec touching `ci.yml`, scoped to the `e2e:`/`e2e-windows` job slicing, not the `code-scanning` job WR-02 touched) is included in the full `nx test angular-typechecker` run above and passed unchanged.

## Scope Notes

Per the fix scope, IN-01 (multi-entry `tsConfig[]` array path untested) and IN-02 (`angular-typechecker.sarif` not gitignored) were intentionally NOT addressed -- IN-01 is covered by the plan's existing `tsConfig[]` handling per the task instructions, and IN-02 is a pre-existing condition, not a regression from this phase. No hard-constraint boundary was crossed: `packages/angular-typechecker/src/core/**`, the barrel, and `package.json` were untouched, and no version bump occurred.

---

_Fixed: 2026-07-21T16:45:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
