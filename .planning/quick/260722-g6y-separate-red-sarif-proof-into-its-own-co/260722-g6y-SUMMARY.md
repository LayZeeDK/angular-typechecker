---
phase: quick-260722-g6y
plan: 01
subsystem: ci
tags: [code-scanning, sarif, github-actions, ci-guards]
status: complete
requires:
  - tools/sarif-proof-fixture (PROOF-01, Phase 35)
  - '`ci` aggregate + `produced == false` fail-loud steps (Phase 36)'
provides:
  - 'a SEPARATE Code Scanning tool `angular-typechecker-red-proof` for the deliberate RED proof'
  - 'exact-set (rule id, file path) assertion over the proof alerts'
  - 'assert-gated, scoped, idempotent, non-fatal alert dismissal'
affects:
  - .github/workflows/ci.yml
  - tools/ci/assert-code-scanning.mjs
  - tools/act/act-compat.sh
tech-stack:
  added: []
  patterns:
    - 'CI-side SARIF post-process (`node -e` driver.name rewrite) instead of changing the shipped CLI'
    - 'structural assert-before-mutate: the mutation consumes only the value a passing assert returned'
    - 'cross-file literal drift-lock (ci.yml block regex + script constant) in one guard spec'
key-files:
  created: []
  modified:
    - tools/ci/assert-code-scanning.mjs
    - packages/angular-typechecker/src/assert-code-scanning.spec.ts
    - .github/workflows/ci.yml
    - packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts
    - tools/act/act-compat.sh
    - packages/angular-typechecker/src/core/machine-reporters-sarif.integration.spec.ts
decisions:
  - 'D-02 implemented as a CI-side `node -e` rewrite of `runs[].tool.driver.name`, mirroring the existing fallow `automationDetails` rewrite -- the shipped CLI is byte-unchanged'
  - 'Job renamed `code-scanning-proof` -> `code-scanning-red-proof` (Claude discretion; says RED out loud)'
  - 'D-01 ordering enforced by DATA DEPENDENCY (dismissal consumes the array a passing assert returns), not a flag or a comment'
  - 'The alerts query carries NO `state` param (research P1) -- dismissal is global and permanent, so a state filter would make the SECOND future PR permanently RED'
  - 'Every dismissal PATCH is individually try/caught -> `::warning::`, never a non-zero exit (research P3) -- the job is in the required `ci` aggregate'
metrics:
  duration: ~50 min
  completed: 2026-07-22
  tasks: 2
  commits: 2
---

# Quick Task 260722-g6y: Separate RED SARIF proof into its own Code Scanning tool - Summary

Split the deliberate RED SARIF proof onto its own Code Scanning tool
(`angular-typechecker-red-proof`) so the fixture's four intentional errors stop
reddening the clean dogfood `angular-typechecker` check, tightened the CI assertion to
an exact (rule id, file path) set, and made the proof self-healing by dismissing
exactly those alerts after -- and only after -- the assertion passes.

## What Was Built

### Task 1 -- exact-set matcher + scoped, assert-gated, non-fatal dismissal (`3335c15`)

`tools/ci/assert-code-scanning.mjs` reworked:

- `TOOL` is now the D-02 literal `angular-typechecker-red-proof` (drives both the
  `tool_name` alerts query and the analyses cross-check). `CATEGORY` stays
  `angular-typecheck-proof` -- category and driver name are orthogonal axes, and the
  trailing-slash tolerance (`categoryMatches`) is unchanged.
- The family-tag `missingTuples` matcher is replaced by one exported pure
  `tupleDiff(alerts, expected)` returning `{ missing, extra }`, keyed on `rule.id` +
  `most_recent_instance.location.path`. `extra` is deduped by `ruleId@path`. A
  right-code-wrong-file attribution surfaces in BOTH directions.
- `EXPECTED` is the D-03 exact set, with ATC90002 at
  `tools/sarif-proof-fixture/tsconfig.json` per the RESEARCH correction -- it is NOT
  file-less (Phase 35-04's region-less whole-file fallback gives it that path).
- The `state=open` query param is GONE (research P1, blocking).
- The poll loop retries while `missing` is non-empty, then throws immediately if
  `extra` is non-empty, and otherwise RETURNS the category-filtered matched alerts.
- Recurrence fallback (research P2): if the ref-scoped query never saw a single
  proof-tool alert across the whole budget, retry repo-wide and keep only alerts with a
  confirmed instance on this ref (`alerts/{n}/instances?ref=...`, alert number
  `Number()`-coerced and integer-guarded), then run the same exact-set decision.
- New pure `dismissable(alerts)` reads `most_recent_instance.state === 'open'` (never
  the top-level `state`, which is `null` for a PR-only alert -- research P7), making
  re-runs idempotent.
- New `dismissAlerts(alerts)` PATCHes each open alert with `state=dismissed`,
  `dismissed_reason=used in tests` and a short comment via the extended `ghApi`
  helper (fixed arg array, no `shell: true`, ~1s apart for the secondary rate limit).
  Each PATCH is individually try/caught -> `::warning::`; it never throws and never
  sets a non-zero exit.
- D-01 ordering is structural: `runCli` passes the array `await assertAlerts(ref)`
  RETURNED into `dismissAlerts`. A throwing assert cannot reach the dismissal.
- The `ASSERT_ALERTS_FILE` seam applies the same filter + decision and prints a
  dismissal DRY-RUN (the selected alert numbers) instead of PATCHing.

`packages/angular-typechecker/src/assert-code-scanning.spec.ts` rewritten to 10 seam
tests (subprocess harness and temp-file plumbing unchanged): GREEN on all four tuples,
GREEN on the trailing-slash category, a location-less ATC90002 going RED (locking the
corrected path), missing-tuple RED, extra-tuple RED, wrong-file RED, no dry-run line on
a failing assert, already-dismissed alerts omitted from the selection, a dogfood alert
dropped before the selection, and dogfood category isolation.

### Task 2 -- job rename, driver.name rewrite, drift guards (`02cfbc7`)

- `.github/workflows/ci.yml`: job key `code-scanning-proof` -> `code-scanning-red-proof`,
  updated in the `ci` aggregate `needs[]` (membership preserved, not dropped). The
  `gen` step's `if [ -s proof.sarif ]` branch gained a single-quoted `node -e` that sets
  every `runs[].tool.driver.name` to `angular-typechecker-red-proof` before
  `produced=true`, mirroring the fallow `automationDetails` rewrite verbatim in style
  (no backticks, no `$`, no PR data). The `if`/`else` was restructured into the same
  multi-line form. Upload SHA pin, `category:`, `permissions`, fork gate, `produced`
  guard, PR-only `if:`, path gate and the `env:`-only assert step are all unchanged.
  The job comment block now records D-02/D-03/D-01 and that this proof tool must stay
  OFF the "Require code scanning results" required-tool list.
- `ci-e2e-coverage-guard.spec.ts`: the `ci` aggregate membership assertion re-points to
  `code-scanning-red-proof` (still full-list-item anchored), plus ONE new `it` locking
  the cross-file key link -- the driver-name literal must appear in the renamed job
  block (no-comment-line anchored) AND as the `TOOL` constant in the assert script.
- `tools/act/act-compat.sh`: both proof-job assertions re-pointed (`assert_selected` on
  the PR plan, `assert_absent` on the push-to-main plan).
- `machine-reporters-sarif.integration.spec.ts`: comment-only job-id rename (permitted
  per the CONTEXT.md clarification and the Phase 35-01 precedent).

## Verification

All gates run on the main checkout, after the final commit:

| Gate | Result |
|------|--------|
| `npx nx test angular-typechecker` | 58 files, **592 tests passed** (591 before; +1 new key-link guard) |
| `npx nx integration angular-typechecker` | 24 files, **156 tests passed** |
| `npx nx lint angular-typechecker` | All files pass linting (maxWarnings:0) |
| `npx nx format:check` | clean (no files listed) |
| `npx nx run-many -t typecheck` | Successfully ran for 12 projects |
| `bash tools/act/act-compat.sh` | **19 passed, 0 failed** -- `ci/code-scanning-red-proof` SELECTED on `pull_request`, ABSENT on push-to-`main` (SC4) |

Additional checks:

- `ci.yml` parsed with a real YAML library: 14 jobs, `ci.needs` contains
  `code-scanning-red-proof`, and `act --validate` passes.
- The `node -e` driver.name rewrite smoke-tested against a synthetic SARIF envelope in
  the scratchpad -- rewrites `angular-typechecker` -> `angular-typechecker-red-proof`.

Note on act-compat: an initial local run reported 11 failures, including jobs this task
never touched (`ci/test-`, `ci/code-scanning`, `ci/ci`). Root cause was the Docker
daemon being down, which truncates `act -n`'s plan after the first wave. Once Docker was
available the suite ran clean at 19/19.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The spec's `replace` helper could not express a location-less alert**

- **Found during:** Task 1
- **Issue:** the first draft of the "ATC90002 is not file-less" test routed through a
  `replace(..., { path: undefined })` helper, but the helper uses `??` to fall back to
  the original path -- so `undefined` silently kept the correct path and the test would
  have passed vacuously.
- **Fix:** that test now builds a genuinely location-less alert literal (no
  `most_recent_instance.location` at all) and asserts it goes RED, which is the real
  regression it guards against.
- **Files modified:** `packages/angular-typechecker/src/assert-code-scanning.spec.ts`
- **Commit:** `3335c15`

### Plan-checker resolutions applied

- **Warning 1 (proceed as planned):** the comment-only job-id rename in
  `src/core/machine-reporters-sarif.integration.spec.ts` was made. Specs are excluded
  from the built package, so the additive-only charter holds.
- **Warning 2 (fix applied):** the plan's third `must_haves.key_links` entry overstated
  local coverage. Softened in `260722-g6y-PLAN.md`: the drift-lock pins (family tag,
  level) pairs and the three fixed codes only -- it asserts no result
  `artifactLocation` paths and leaves NG8101 unpinned, so paths and NG8101 are proven by
  the seam spec plus real CI.
- **Warning 3 (fix applied):** all three `## Open Questions` entries in
  `260722-g6y-RESEARCH.md` are now marked `(DEFERRED TO UAT)` with a lead-in noting they
  are unresolvable without live GitHub behaviour and already mitigated in code.

## Real-CI-only UAT items (carried forward)

These cannot be proven locally. Verify on this PR's CI run and the next one.

1. **D-02 tool split.** The Code Scanning check list shows a NEW
   `angular-typechecker-red-proof` check (RED by design) and the dogfood
   `angular-typechecker` check no longer carries the fixture's alerts.
2. **D-01 dismissal / assumption A3.** The assert step logs the four expected
   `ruleId@path` tuples, then logs a dismissal for each (or an explicit `::warning::`).
   This settles whether PATCH succeeds on an alert whose top-level `state` is `null`.
3. **Second-PR recurrence (assumption A2, HIGH risk).** On the NEXT code-touching PR
   after this lands, confirm
   `code-scanning/alerts?ref=refs/pull/<n>/merge&tool_name=angular-typechecker-red-proof`
   (no state filter) still returns the four alerts and the job stays GREEN. If not, the
   P2 repo-wide fallback must carry it -- the job log names which path ran.

## Known follow-ups (out of scope here)

- The 3 unresolved `github-advanced-security` review threads on PR #55 are still open.
  Per research P4, the rename does NOT clean up the 4 legacy alerts already filed under
  the dogfood tool -- renaming the job changes `analysis_key`, so no future upload will
  ever mark them `fixed`. A separate dismissal pass is still required to green PR #55.
- Enabling the "Require code scanning results" ruleset stays a human-only, real-CI-only
  action (AGENTS.md runbook). This proof tool must NOT join its required-tool list.

## Self-Check: PASSED

- `tools/ci/assert-code-scanning.mjs` -- FOUND
- `packages/angular-typechecker/src/assert-code-scanning.spec.ts` -- FOUND
- `.github/workflows/ci.yml` -- FOUND
- `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` -- FOUND
- `tools/act/act-compat.sh` -- FOUND
- commit `3335c15` -- FOUND
- commit `02cfbc7` -- FOUND
