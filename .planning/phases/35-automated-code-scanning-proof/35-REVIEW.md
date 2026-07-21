---
phase: 35-automated-code-scanning-proof
reviewed: 2026-07-21T22:10:00Z
depth: deep
files_reviewed: 12
files_reviewed_list:
  - tools/ci/assert-code-scanning.mjs
  - packages/angular-typechecker/src/assert-code-scanning.spec.ts
  - packages/angular-typechecker/src/core/machine-reporters-sarif.integration.spec.ts
  - tools/sarif-proof-fixture/type-error.ts
  - tools/sarif-proof-fixture/proof.component.ts
  - tools/sarif-proof-fixture/proof.component.html
  - tools/sarif-proof-fixture/tsconfig.json
  - tools/sarif-proof-fixture/tsconfig.fixture.json
  - .fallowrc.jsonc
  - .prettierignore
  - .github/workflows/ci.yml
  - tools/act/act-compat.sh
findings:
  critical: 1
  warning: 1
  info: 1
  total: 3
status: issues_found
---

# Phase 35: Code Review Report

**Reviewed:** 2026-07-21T22:10:00Z
**Depth:** deep
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 35 ships a proof harness (additive CI/test/tooling; no published-surface change): an
isolated one-per-family SARIF fixture outside the Nx graph, a `gh api` poll/assert script,
and a PR-only `code-scanning-proof` CI job. The intentional fixture type errors
(`type-error.ts`, `proof.component.ts`, `proof.component.html`) and the deliberately-missing
`tsconfig.missing.json` reference are the point of the fixture -- verified they are
tsconfig-`files`-only, outside the Nx graph (no `project.json`), and are NOT reported as
bugs. Fixture whitespace/import scoping in `.prettierignore` and `.fallowrc.jsonc` is
correct.

The security posture is sound. The assert script spawns `gh` via a fixed `execFileSync`
arg array (no `shell:true`), and all PR data (`PR_NUMBER`, `SARIF_ID`, `GH_TOKEN`) reaches
the script through `env:`, never interpolated into a `run:` shell -- there is no command- or
argument-injection surface. The CI job is correctly PR-only + non-fork gated
(`github.event_name == 'pull_request'` at the job level; `head.repo.fork == false` on both
the upload and assert steps), and `code-scanning-proof` is genuinely absent from the `ci`
aggregate's `needs[]`, matching the design. `missingTuples` implements set-membership
correctly.

The one BLOCKER is a correctness defect in the load-bearing category comparison: the script
matches the Code Scanning category with exact `===` equality, but the value GitHub reports
is subject to a documented trailing-slash normalization on the `category`-input upload path
this job uses -- which the local spec cannot catch because it feeds a hand-written no-slash
category. Details below.

## Critical Issues

### CR-01: Exact-equality category comparison will likely fail permanently in real CI (trailing-slash normalization)

**File:** `tools/ci/assert-code-scanning.mjs:146` (analyses cross-check) and
`tools/ci/assert-code-scanning.mjs:166`, `:191-193` (alerts + seam category filter)

**Issue:**
The script asserts the Code Scanning category with strict equality against
`CATEGORY = 'angular-typecheck-proof'`:

- `assertAnalysisCategory`: `analyses.some((analysis) => analysis.category === CATEGORY)` (line 146)
- `assertAlerts`: `.filter((alert) => alert.most_recent_instance?.category === CATEGORY)` (line 166)
- `assertFromFile`: same filter (lines 191-193)

The `code-scanning-proof` job uploads the proof SARIF with the `category:
angular-typecheck-proof` **input** (`ci.yml:700`), and the CLI's single-run SARIF carries
NO `runs[].automationDetails.id`. On exactly this path the `github/codeql-action/upload-sarif`
action synthesizes `automationDetails.id` from the category and appends a trailing `/` when
the category does not already end in one (i.e. `angular-typecheck-proof/`). GitHub's
`code-scanning/analyses.category` and `code-scanning/alerts[].most_recent_instance.category`
report that synthesized id. If that holds, then on the very first real run:

1. `assertAnalysisCategory` throws `no analysis with category angular-typecheck-proof ...`
   because the actual value is `angular-typecheck-proof/` -- the job fails before it ever
   reaches the alerts loop, and
2. even if that check were removed, the `assertAlerts` category filter would drop every
   proof alert, so `missingTuples` reports all four tuples missing and the poll times out
   (RED).

This is a permanent false RED for the entire deliverable, and it is NOT caught by any local
gate: the subprocess spec (`assert-code-scanning.spec.ts`) feeds a canned payload whose
`most_recent_instance.category` is hand-set to the no-slash literal
`'angular-typecheck-proof'` (via the `alert()` helper default), so the seam is GREEN while
the real-CI path would be RED. This asymmetry is real vs. the dogfood job: the dogfood
uploads runs with a PRESET `automationDetails.id` (`angular-typecheck/<project>`, no category
input), so the action does NOT append a slash there -- which is precisely why the dogfood
category string looks clean while the proof's `category`-input path does not. The phase is
explicitly "real-CI-only" and this job has never run, so the exact category string is
unverified.

Because the assert step is out of the `ci` aggregate it will not deadlock merges, but a proof
check that is permanently red either gets ignored (defeating its regression-detection
purpose) or blocks the GATE-01/Phase 36 promotion the `ci.yml` comment anticipates.

**Fix:** Tolerate the trailing slash on both comparison sites (defensive and strictly correct
regardless of which form GitHub returns; also verify the observed value on the first real PR
run):

```js
const CATEGORY = 'angular-typecheck-proof';

// upload-sarif synthesizes automationDetails.id from the `category` input and appends a
// trailing '/', so the analyses/alerts API may report either form.
function categoryMatches(value) {
  return value === CATEGORY || value === `${CATEGORY}/`;
}

// assertAnalysisCategory:
if (!analyses.some((analysis) => categoryMatches(analysis.category))) {
  throw new Error(/* ... */);
}

// assertAlerts + assertFromFile:
.filter((alert) => categoryMatches(alert.most_recent_instance?.category));
```

Add a spec case that feeds `most_recent_instance.category === 'angular-typecheck-proof/'`
(trailing slash) and asserts GREEN, so the seam no longer hard-codes only the no-slash form.

## Warnings

### WR-01: Alerts query reads a single unpaginated page and does not scope alert state

**File:** `tools/ci/assert-code-scanning.mjs:164-166`

**Issue:**
`assertAlerts` fetches
`code-scanning/alerts?ref=${ref}&tool_name=${TOOL}&per_page=100` and reads only the first
page (no `--paginate`, no follow-up). It also does not pin `state`, so the endpoint may
return alerts in any state that accumulate on `refs/pull/<n>/merge` across a PR's pushes.
The query is scoped by `tool_name=angular-typechecker`, which also includes the dogfood
`code-scanning` job's alerts on the same PR before the client-side category filter runs. This
is safe today (the dogfooded projects pass the repo's own type-check gate, so the dogfood
emits ~0 alerts and the proof's 4 alerts fit comfortably in one page), but it is a latent
false-RED: if the combined alert volume under `tool_name=angular-typechecker` on the merge
ref ever exceeds 100 (dogfood surfaces real findings, or fixed/dismissed alerts pile up over
a long-lived PR), the proof alerts can be paginated out and the assert times out (RED) even
though the proof alerts landed. Because the category filter is client-side (there is no
`category` query param), pagination cannot be avoided by narrowing the server query to the
proof category.

**Fix:** Paginate the alerts read and (optionally) scope state, e.g.:

```js
const out = execFileSync(
  'gh',
  ['api', '--paginate', `repos/${REPO}/code-scanning/alerts?ref=${ref}&tool_name=${TOOL}&state=open&per_page=100`],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);
```

`gh api --paginate` over an array endpoint concatenates pages into one JSON array, so the
existing `.filter(...)` continues to work.

## Info

### IN-01: Bounded-poll loops sleep once more before throwing the timeout

**File:** `tools/ci/assert-code-scanning.mjs:114-132` (`waitForProcessing`) and
`:160-179` (`assertAlerts`)

**Issue:**
Both loops call `await sleep(POLL_INTERVAL_MS)` on the final iteration before the loop exits
and throws the timeout error, wasting up to one full `POLL_INTERVAL_MS` (6s) on the RED path.
No correctness impact -- purely a small latency cost on failure.

**Fix:** Skip the sleep on the last attempt:

```js
if (attempt < PROCESSING_ATTEMPTS - 1) {
  await sleep(POLL_INTERVAL_MS);
}
```

(and the analogous guard with `ALERTS_ATTEMPTS` in `assertAlerts`).

## Notes on items explicitly checked and found sound

- **Injection safety:** `ghApi` uses `execFileSync('gh', ['api', pathAndQuery], ...)` with no
  `shell:true`; `pathAndQuery` always begins with `repos/...` (never a `-` flag) and embeds
  only the constant `REPO`/`TOOL`/`CATEGORY` plus the GitHub-controlled `SARIF_ID`/`PR_NUMBER`
  from env -- no shell metacharacter is ever interpreted. The CI job passes `PR_NUMBER`,
  `SARIF_ID` (bracket syntax for the hyphenated `sarif-id` output), and `GH_TOKEN` via `env:`
  and runs `node tools/ci/assert-code-scanning.mjs` with no interpolation. No command- or
  argument-injection surface.
- **PR-only + fork gating:** job-level `if: github.event_name == 'pull_request' && ...`;
  upload and assert steps both gate on `github.event.pull_request.head.repo.fork == false`.
  The act-compat suite (`act-compat.sh:122`, `:134`) locks PR-selected / push-main-absent
  fidelity.
- **Out of the `ci` aggregate:** `code-scanning-proof` (and `code-scanning`) are absent from
  the `ci` job's `needs[]`, so a Code Scanning outage cannot deadlock the PR-only merge button.
- **`missingTuples` matcher:** correct set-membership; `?? []` and optional chaining guard
  undefined `rule`/`tags`.
- **Fixture (intentional, not bugs):** no `project.json` (outside the Nx graph); the missing
  `tsconfig.missing.json` reference is the `tool`-family ATC90002 source; `.prettierignore`
  and `.fallowrc.jsonc` scope the fixture's diagnostic-sensitive template + intentionally
  unimported/unrendered sources correctly.

---

_Reviewed: 2026-07-21T22:10:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
