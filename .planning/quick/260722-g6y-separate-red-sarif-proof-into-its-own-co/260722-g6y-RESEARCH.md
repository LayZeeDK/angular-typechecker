# Quick Task 260722-g6y: Separate RED SARIF proof into its own Code Scanning tool - Research

**Researched:** 2026-07-22
**Domain:** GitHub Code Scanning (SARIF ingestion, alerts REST API, PR review annotations)
**Confidence:** HIGH on tool identity / API contract / permissions. MEDIUM on post-dismissal recurrence semantics (two specific unknowns flagged below, both settleable only in real CI).

## Summary

Every load-bearing mechanism was verified empirically against THIS repo's live PR #55 data (read-only `gh api`) plus docs.github.com. Three findings would change the plan materially:

1. **D-03's "ATC90002 is file-less" is WRONG.** GitHub reports it at `tools/sarif-proof-fixture/tsconfig.json` line 1 col 1. The exact-set matcher must expect that path, not an absent location.
2. **D-01's dismissal is GLOBAL and permanent ("dismissed in all branches"; "Next time code scanning runs, the same code won't generate an alert").** The existing assert filters `state=open` -- so the FIRST PR after this lands passes, and the SECOND goes permanently RED. The assert must become state-agnostic.
3. **D-01's stated rationale is over-broad.** PR review threads are posted only for alerts *inside the PR diff* (`annotations_count: 3` on PR #55, and only the 3 fixture files it touched -- the tsconfig.json alert at line 1 got no annotation). A future PR that does not touch `tools/sarif-proof-fixture/` posts no thread at all. D-01 is still worth doing (it covers the PRs that DO touch the fixture, and it clears the recurrence for free), but it is not the every-PR blocker the CONTEXT assumes.

**Primary recommendation:** rename `driver.name` + the job id, key the exact-set matcher on `(rule.id, most_recent_instance.location.path)`, drop `state=open` from the alerts query, and make the dismiss step non-fatal (`::warning::`, never `exit 1`) so an unexpected PATCH rejection cannot deadlock the required `ci` gate.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01** -- assert the exact expected alert set FIRST, then dismiss those alerts, scoped to the proof tool, `dismissed_reason: "used in tests"`. Assert-before-dismiss is structural. A failed assertion dismisses nothing and fails the job. Never touches `angular-typechecker`, `fallow`, or CodeQL alerts. No permission widening.
- **D-02** -- proof `runs[].tool.driver.name` becomes `angular-typechecker-red-proof`. MUST NOT join the "Require code scanning results" required-tool list (stays `angular-typechecker` + `fallow`).
- **D-03** -- assert EXACTLY: TS2322 @ `type-error.ts`, NG8002 @ `proof.component.html`, NG8101 @ `proof.component.html`, ATC90002 file-less. Missing / extra / wrong-file all fail.

### Claude's Discretion

- Exact job id/name (direction: descriptive, e.g. `code-scanning-red-proof`).
- `node -e` inline rewrite vs a committed `tools/ci/*.mjs` script for the `driver.name` rewrite.
- How assert/dismiss splits across steps/modules, provided ordering is structurally enforced.

### Deferred Ideas (OUT OF SCOPE)

- Resolving the 3 currently-unresolved `github-advanced-security` review threads on PR #55.

## Findings

### 1. Tool identity: check-run name IS `tool.driver.name` [VERIFIED: gh api]

`GET repos/LayZeeDK/angular-typechecker/commits/4a8ac92.../check-runs` returns three check runs from app `github-advanced-security`, named exactly `CodeQL`, `fallow`, `angular-typechecker` -- i.e. one per SARIF `driver.name`. Docs corroborate: the check *suite* is `Code scanning results`, and "The results for each analysis tool used are shown separately" [CITED: docs.github.com/en/code-security/code-scanning/managing-code-scanning-alerts/triaging-code-scanning-alerts-in-pull-requests].

Consequences for the plan:

- Changing `driver.name` to `angular-typechecker-red-proof` **does** produce a genuinely separate tool, separate alert grouping (`tool_name` filter), and a separate PR check run. HIGH confidence.
- The dogfood `angular-typechecker` check is currently **`conclusion: failure`** with `output.title: "1 configuration not found"` and `annotations_count: 3` -- caused by the proof fixture's alerts. Splitting the tool is what makes that check green. (It will not go green on PR #55 itself until the 4 legacy alerts are closed -- see Pitfall P4.)
- **`category` and `driver.name` are orthogonal axes.** `category` maps to `runs[].automationDetails.id` ("String used by Code Scanning for matching the analyses") [CITED: github/codeql-action/upload-sarif/action.yml]. Keeping `category: angular-typecheck-proof` alongside the new tool name is fine and costs nothing; there is no collision risk because the (tool, category) pair is now unique.
- **Check-run failure rule:** the per-tool check fails if any alert has severity `error`, `critical`, or `high`. The proof carries three `error`s, so `angular-typechecker-red-proof` will show as a RED check on every PR. That is intentional and unavoidable -- the repo-level severity override is repo-wide, not per-tool, so it cannot be used to selectively green just the proof tool. It is NOT a required check, so it cannot block merge.

### 2. Alerts API surface [VERIFIED: gh api + REST docs]

`GET /repos/{owner}/{repo}/code-scanning/alerts` query params: `tool_name`, `tool_guid`, `ref`, `pr`, `state` (`open|closed|dismissed|fixed`), `severity`, `sort`, `direction`, `page`/`per_page` (max 100), `before`/`after`.

- `ref=refs/pull/55/merge` and `pr=55` returned identical results (4 alerts each). Either works; keep `ref` (already wired, and `pr` would need the same env plumbing).
- Fields the exact-set matcher needs, confirmed present in the live payload:
  - `rule.id` -- `"TS2322"`, `"NG8002"`, `"NG8101"`, `"ATC90002"`
  - `rule.severity`, `rule.tags` (`["tool"]` etc.), `rule.help`, `rule.help_uri`
  - `tool.name`, `tool.version` (`"0.2.3"`)
  - `most_recent_instance.location.{path,start_line,end_line,start_column,end_column}`
  - `most_recent_instance.category`, `.ref`, `.state`, `.commit_sha`, `.analysis_key`
- **ATC90002 is NOT file-less.** Live payload:
  ```
  location: { path: "tools/sarif-proof-fixture/tsconfig.json",
              start_line: 1, end_line: 1, start_column: 1, end_column: 1 }
  ```
  This is GitHub's whole-file fallback rendering. **D-03's table must be corrected**: expect `tools/sarif-proof-fixture/tsconfig.json`, not an absent `location`. A matcher that asserts `location === undefined` would fail permanently.
- Pagination: the existing `--paginate` + `per_page=100` is correct and already sufficient (4-5 alerts).
- Secondary handle if ever needed: `GET /code-scanning/alerts/{n}/instances?ref=<ref>` is ref-scoped and returns `{ref, state, category, commit_sha, location}` per instance. Verified working. Requires knowing the alert number first, so it is a cross-check, not a primary query.

### 3. Dismissal contract [VERIFIED: REST docs + Actions docs]

`PATCH /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}`

- Body: `state` (`open` | `dismissed`), `dismissed_reason` (required when dismissing) -- enum is exactly **`false positive`**, **`won't fix`**, **`used in tests`**, `null`. `"used in tests"` is valid, lowercase, space-separated. `dismissed_comment` (<=280 chars) optional. [CITED: docs.github.com/en/rest/code-scanning/code-scanning#update-a-code-scanning-alert]
- Responses: 200 OK; 400; 403 (archived repo / GHAS disabled); 404; 503.
- **Permission: `security-events: write` is exactly right, no widening.** Verbatim from the Actions workflow-syntax reference: "`security-events: read` permits an action to list the code scanning alerts for the repository, and **`security-events: write` allows an action to update the status of a code scanning alert**." [CITED: docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions]
- **Dismissal scope is global, not per-ref.** "When you dismiss an alert... It's dismissed in all branches." and "Next time code scanning runs, the same code won't generate an alert." [CITED: docs.github.com/en/code-security/code-scanning/managing-code-scanning-alerts/resolving-code-scanning-alerts]. There is no ref parameter on the PATCH -- so "dismissal on a PR ref" is not a distinct behaviour; there is one alert entity and one state.
- No shell-injection surface: `gh api --method PATCH repos/.../alerts/<n> -f state=dismissed -f "dismissed_reason=used in tests"` via `execFileSync` with a fixed arg array (the existing `ghApi` pattern). Alert numbers come back from the API as integers -- `Number()`-coerce them anyway to keep the invariant airtight.

### 4. The review-thread question (focus item 3) -- PARTIAL ANSWER

**What is proven:** the `github-advanced-security[bot]` DOES resolve its own review threads. On PR #55, the `fallow` thread on `sarif-report.ts` has `isResolved: true` with `resolvedBy: "github-advanced-security[bot]"` -- and that alert's state is `fixed`. Docs corroborate for the fix path: "If your changes fix the problem, the alert is closed and **the annotation removed**."

**What is NOT documented anywhere I could find:** whether the bot resolves the thread on **dismissal** specifically (as opposed to `fixed`). Neither the triaging doc, the resolving doc, nor the REST reference says. `[OPEN QUESTION -- see A1]`

**Why D-01 still achieves its goal regardless:** threads are only posted for alerts *inside the PR diff* -- "You can see any code scanning alerts that are inside the diff of the changes introduced in a pull request". Empirically PR #55 has `annotations_count: 3` and exactly 3 unresolved threads (`type-error.ts`, `proof.component.html` x2) -- the ATC90002 alert on `tsconfig.json:1` produced NO annotation because line 1 is outside the diff hunk. Since dismissal is global and permanent, a subsequent PR's analysis yields an already-dismissed (= closed) alert, which is not "a new alert in code changed by this pull request" and therefore should not be annotated at all. So D-01 prevents future threads even if it does not retroactively resolve existing ones.

**Corollary the CONTEXT does not reflect:** a PR that does not touch `tools/sarif-proof-fixture/` would never have posted a thread in the first place. The "every future code-touching PR" framing in D-01's rationale is over-broad. D-01 remains a cheap, correct hygiene step -- do not re-open the decision, just do not over-claim it in the commit message or docs.

## Common Pitfalls

### P1 (BLOCKING) -- `state=open` makes the proof permanently RED on the second PR

`assert-code-scanning.mjs:192` queries `...&state=open&...`. After D-01 dismisses the four alerts, they are dismissed *in all branches*, forever. On the next PR the same fingerprints resolve to the same (dismissed) alerts, which `state=open` filters out -> zero matches -> timeout -> RED.

**Fix:** drop the `state` param entirely (the API then returns alerts in every state). Filter by `tool_name` + category + the exact `(rule.id, path)` tuples, and be state-agnostic. Then make the dismiss step idempotent: PATCH only alerts whose `most_recent_instance.state === 'open'` (or top-level `state === 'open'`), skipping already-dismissed ones.

### P2 (RISK) -- an aggressively-suppressed alert may not produce an instance at all

Docs say "the same code won't generate an alert". If GitHub drops the result from ingestion outright rather than recording a dismissed instance, `?ref=<new pr ref>` returns nothing even without a `state` filter, and the proof breaks permanently. `[OPEN QUESTION -- see A2]`

**Mitigation to build in now (cheap):** if the ref-scoped query comes up empty after the poll budget, fall back to a ref-less `GET /code-scanning/alerts?tool_name=angular-typechecker-red-proof` (repo-wide, all states) and, for each matched alert, confirm a current-ref instance via `GET /alerts/{n}/instances?ref=<ref>` -- verified to work and state-independent. That keeps the assert honest (it still proves *this* upload landed on *this* ref) while surviving either recurrence semantics. Combined with the existing `assertAnalysisCategory` cross-check, the proof stays real.

### P3 -- do NOT let the dismiss step fail the job

`code-scanning-proof` is a member of the required `ci` aggregate. A PATCH that unexpectedly 400s/404s (see A3) would turn a *passing proof* into a red required check and deadlock the empty-bypass `main` ruleset. Emit `::warning::` on a dismissal failure and leave the job green -- the assert already passed, which is what the job is contracted to prove. This also preserves D-01's "a failed assertion must NOT dismiss anything" in the other direction.

### P4 -- renaming the job changes `analysis_key`; the 4 legacy alerts are orphaned

`most_recent_instance.analysis_key` is `".github/workflows/ci.yml:code-scanning-proof"`. Renaming the job id (and the tool) means no future upload will ever carry `(tool=angular-typechecker, category=angular-typecheck-proof, analysis_key=...code-scanning-proof)`. GitHub only marks alerts `fixed` when a *newer analysis for the same configuration* omits them -- so alerts #5-#8 will stay `open` on PR #55's ref indefinitely, keeping the dogfood `angular-typechecker` check RED on that PR and its 3 threads unresolved. That is precisely the out-of-scope follow-up in CONTEXT -- but note the sequencing: **the rename does not clean them up; the follow-up dismissal is required to green PR #55.**

### P5 -- ingestion timing

The existing two-phase poll is correct and should be kept as-is: `sarifs/{id}` -> `processing_status: complete` is the deterministic handle, but alerts are **not** immediately queryable at that moment -- that is exactly why the second bounded retry loop exists (documented in the script header as P4 of the phase-35 research). Do not collapse the loops. Budget is ~2 min per phase; that is generous and a timeout only ever produces a false RED, never a false pass.

### P6 -- fork PRs and rate limits

Fork PRs get a read-only `GITHUB_TOKEN` regardless of declared scope, so the upload, assert, and the new dismiss step must all carry the existing `github.event.pull_request.head.repo.fork == false` gate. Rate limits are a non-issue (~44 requests worst case against a 1000/hr/repo GITHUB_TOKEN budget), but GitHub applies a *secondary* limit to mutating requests -- space the 4 PATCHes ~1s apart.

### P7 -- `GET /alerts/{n}` reports `state: null` for a PR-only alert

Verified: `gh api .../code-scanning/alerts/5` returns top-level `state: null` (no default-branch instance) while `most_recent_instance.state` is `"open"`. Any state check must read `most_recent_instance.state`, or read state from the ref-scoped LIST response (which correctly reports `"open"`), never from the by-number GET.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Dismissing an alert causes `github-advanced-security[bot]` to resolve the corresponding PR review thread | Finding 4 | LOW -- D-01's forward-looking benefit does not depend on it; only the out-of-scope PR #55 cleanup does. Settle empirically during that cleanup: dismiss one alert via the UI and re-query `reviewThreads { isResolved resolvedBy }`. |
| A2 | A dismissed alert still yields a ref-scoped instance on a later PR ref (so a state-agnostic query still finds it) | P1/P2 | HIGH -- if wrong, the proof goes permanently RED on the 2nd PR. Mitigated by the P2 fallback. Settle by opening a second trivial code-touching PR after this lands and inspecting `alerts?ref=refs/pull/<n2>/merge&tool_name=angular-typechecker-red-proof` with no state filter. **Make this a UAT item.** |
| A3 | `PATCH` succeeds (200) on an alert that has no default-branch instance (`state: null`) | Finding 3 / P3 | MEDIUM -- if it 400s/404s, D-01's self-heal silently never happens. Mitigated by P3 (warn, don't fail) plus asserting the PATCH response in the job log. Settle on the first real CI run. |

## Open Questions

All three are unresolvable without live GitHub behaviour, and all three are already
mitigated in code -- so each is consciously DEFERRED to UAT rather than left un-actioned.

1. **Does dismissal resolve the review thread?** (A1) **(DEFERRED TO UAT)** Undocumented. Recommendation: do not gate anything on it; verify opportunistically during the PR #55 thread cleanup.
2. **Does a dismissed alert reappear as a ref-scoped instance?** (A2) **(DEFERRED TO UAT)** Undocumented; contradicting signals ("dismissed in all branches" + "won't generate an alert" vs. the alert-entity/instance data model). Mitigated in code by the P2 repo-wide fallback. Recommendation: build the P2 fallback now, and add a UAT item to confirm on the second PR.
3. **Will the new `angular-typechecker-red-proof` check confuse the future "Require code scanning results" ruleset?** **(DEFERRED TO UAT)** No -- required tools are an explicit allowlist and D-02 keeps the proof tool off it. But the ruleset's *missing-analysis* block fires per required tool only, so a red proof check is inert there. Confirm in Evaluate mode per the AGENTS.md runbook.

## Project Constraints (from CLAUDE.md / AGENTS.md)

- No command injection: PR data reaches scripts via `env:`, never interpolated into `run:`. The new dismiss logic must keep the `execFileSync` fixed-arg-array + env-only pattern.
- All `uses:` stay SHA-pinned; reuse the existing `github/codeql-action/upload-sarif@7188fc36...` pin, add no new action.
- `ci` aggregate membership must be preserved -- the renamed job id must be updated in the `ci` job's `needs:` list AND in the GUARD drift specs (`packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts`, `tools/act/act-compat.sh`) that assert job wiring by name.
- Additive-only charter: `package.json`, `src/core/**`, `src/cli/**` byte-unchanged; version stays `0.2.3`; no release cut.
- `main` is PR-only (empty-bypass ruleset). Nothing here is pushed directly.
- Never file GitHub Issues; never approve a deployment/environment gate.
- Verification before any Release PR includes `format:check` + `lint` + `nx run-many -t typecheck` (note: `nx test` does NOT type-check specs).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `gh` CLI | assert + dismiss (`gh api`) | Yes (ambient on `ubuntu-latest`) | runner-provided | none needed |
| `GITHUB_TOKEN` w/ `security-events: write` | alerts read + PATCH | Yes (already on the job) | -- | none (fork PRs skip by design) |

No new packages. **Package Legitimacy Audit: N/A -- this task installs nothing.**

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4 via `@nx/vitest:test` |
| Quick run | `npx nx test angular-typechecker` |
| Full suite | `npx nx run-many -t test lint typecheck format:check` |

### Requirement -> Test Map
| Behavior | Test Type | Command | Exists? |
|----------|-----------|---------|---------|
| Exact-set matcher: all 4 `(rule.id, path)` tuples present -> exit 0 | unit (subprocess seam) | `npx nx test angular-typechecker` | extend `packages/angular-typechecker/src/assert-code-scanning.spec.ts` |
| Missing tuple -> exit 1 naming it | unit | same | exists (adapt to rule.id/path) |
| **Extra** tuple under the proof tool -> exit 1 (new D-03 direction) | unit | same | NEW |
| Right code, wrong file -> exit 1 | unit | same | NEW |
| ATC90002 matched at `tsconfig.json` (not file-less) | unit | same | NEW |
| Dismiss never runs when the assert fails | unit | same | NEW -- assert the dismiss code path is unreachable on a throw (structural, e.g. dismissal lives after the `await assertAlerts(...)` in `runCli`) |
| Renamed job id present in `ci` needs + GUARD extractJobLines | unit | same | update `ci-e2e-coverage-guard.spec.ts` |
| SARIF ingestion + dismissal end-to-end | real-CI-only | the CI job itself | UAT (see A2/A3) |

### Wave 0 Gaps
- Extend the `ASSERT_ALERTS_FILE` seam payload shape to carry `rule.id` and `most_recent_instance.location.path` (currently only `rule.tags` / `rule.severity` / `category`).
- Add a `ASSERT_ALERTS_FILE`-driven dry-run for the dismiss selection (which alert numbers *would* be PATCHed) so scope discipline -- proof tool only -- is unit-testable without GitHub.

## Sources

### Primary (HIGH confidence)
- Live `gh api` against `LayZeeDK/angular-typechecker` (read-only): `code-scanning/alerts?ref=refs/pull/55/merge`, `code-scanning/alerts/5`, `code-scanning/alerts/5/instances?ref=...`, `commits/<sha>/check-runs`, GraphQL `pullRequest(55).reviewThreads`.
- docs.github.com REST reference -- Update a code scanning alert (body schema + `dismissed_reason` enum), List code scanning alerts (query params).
- docs.github.com Actions workflow-syntax `permissions` table (`security-events: write` = update alert status).
- docs.github.com -- Triaging code scanning alerts in pull requests (check name/severity rules, diff-scoped annotations).
- docs.github.com -- Resolving code scanning alerts (global dismissal scope, suppression on next run).
- `github/codeql-action/upload-sarif/action.yml` (inputs/outputs, `category` semantics, `sarif-id`).

### Local
- `.github/workflows/ci.yml` (jobs `code-scanning`, `code-scanning-proof`, `ci`), `tools/ci/assert-code-scanning.mjs`, `tools/sarif-proof-fixture/*`, `packages/angular-typechecker/src/assert-code-scanning.spec.ts`.

## Metadata

**Confidence breakdown:**
- Tool identity / check naming: HIGH -- empirically confirmed in this repo's own check runs.
- Alerts API shape incl. ATC90002 location: HIGH -- read from the live payload.
- Dismissal contract + permission: HIGH -- verbatim from GitHub docs.
- Post-dismissal recurrence (A2) and thread resolution (A1): MEDIUM/LOW -- undocumented; mitigations designed in.

**Research date:** 2026-07-22
**Valid until:** ~30 days (GitHub Code Scanning behaviour changes without notice; the 2025-07-21 multi-run-same-category rejection is precedent).
