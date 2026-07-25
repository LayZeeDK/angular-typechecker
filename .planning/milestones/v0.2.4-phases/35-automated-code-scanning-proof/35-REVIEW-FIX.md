---
phase: 35-automated-code-scanning-proof
fixed_at: 2026-07-21T22:20:00Z
review_path: .planning/phases/35-automated-code-scanning-proof/35-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 1
status: all_fixed
---

# Phase 35: Code Review Fix Report

**Fixed at:** 2026-07-21T22:20:00Z
**Source review:** .planning/phases/35-automated-code-scanning-proof/35-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope (Critical + Warning): 2
- Fixed: 2
- Skipped: 1 (IN-01, Info -- out of the requested fix scope)

## Fixed Issues

### CR-01: Exact-equality category comparison will likely fail permanently in real CI (trailing-slash normalization)

**Files modified:** `tools/ci/assert-code-scanning.mjs`, `packages/angular-typechecker/src/assert-code-scanning.spec.ts`
**Commit:** 28bcfa0
**Applied fix:** Introduced one `categoryMatches(value)` helper that returns
`value === CATEGORY || value === CATEGORY + '/'`, with a comment explaining the
`upload-sarif` `category:`-input trailing-slash synthesis of `automationDetails.id`.
Replaced the three strict `=== CATEGORY` comparison sites with `categoryMatches(...)`:
the analyses cross-check (`assertAnalysisCategory`), the bounded alerts poll filter
(`assertAlerts`), and the `ASSERT_ALERTS_FILE` seam filter (`assertFromFile`). The
tolerance now lives in one place so it cannot drift between sites. Added a GREEN spec
case that feeds `most_recent_instance.category === 'angular-typecheck-proof/'` for all
four families and asserts exit 0, so the local seam no longer hard-codes only the
no-slash literal.

**Note:** The fix is defensive and correct regardless of which form GitHub returns.
The exact string on the `category`-input upload path remains real-CI-only and is not
locally observable (the phase has never run in CI); the reviewer's recommendation to
confirm the observed value on the first real PR run still stands, but the assert now
accepts either form so it will not permanently false-RED either way.

### WR-01: Alerts query reads a single unpaginated page and does not scope alert state

**Files modified:** `tools/ci/assert-code-scanning.mjs`
**Commit:** 28bcfa0
**Applied fix:** Extended the `ghApi` helper with an optional `{ paginate }` flag that
prepends the fixed literal `--paginate` arg to the `gh api` arg array (no PR data
interpolated -- injection safety preserved). The `assertAlerts` alerts call now passes
`{ paginate: true }` and adds `state=open` to the query, so proof alerts on a later page
are never paginated out as combined `tool_name`-scoped alert volume grows. The
`sarifs/{id}` processing poll and the analyses cross-check are unchanged (they call
`ghApi` without the flag). `gh api --paginate` over an array endpoint concatenates pages
into one JSON array, so the existing client-side `.filter(...)` continues to work.

## Skipped Issues

### IN-01: Bounded-poll loops sleep once more before throwing the timeout

**File:** `tools/ci/assert-code-scanning.mjs:114-132`, `:160-179`
**Reason:** skipped -- out of the requested fix scope (Critical + Warning only). This is
an Info finding with no correctness impact, only up to one `POLL_INTERVAL_MS` (6s) of
extra latency on the RED path.
**Original issue:** Both `waitForProcessing` and `assertAlerts` call
`await sleep(POLL_INTERVAL_MS)` on the final iteration before throwing the timeout,
wasting one poll interval on failure.

## Verification

- Module import + matcher check (`node --check` + dynamic `import('./tools/ci/assert-code-scanning.mjs')`):
  PASS -- `missingTuples` still exported, GREEN (empty) / RED (`tool`) decisions correct.
- `npx nx test angular-typechecker`: PASS -- 56 files, 575 tests, including the new
  trailing-slash GREEN spec case.
- `npx nx run-many -t lint` (maxWarnings:0): PASS -- all files pass linting.
- `npx nx format:check`: PASS (exit 0).
- `git diff --stat` scope: only `tools/ci/assert-code-scanning.mjs` and
  `packages/angular-typechecker/src/assert-code-scanning.spec.ts` were changed and
  committed (the pre-existing `.planning/config.json` working-tree change was left
  untouched and unstaged).

---

_Fixed: 2026-07-21T22:20:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
