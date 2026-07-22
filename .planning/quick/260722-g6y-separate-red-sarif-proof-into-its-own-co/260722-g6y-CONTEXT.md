# Quick Task 260722-g6y: Separate RED SARIF proof into its own Code Scanning tool - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Task Boundary

Change CI so the job that deliberately reports a RED SARIF report to GitHub Code Scanning is a
standalone, descriptively-named job reporting under a SEPARATE Code Scanning tool (distinct SARIF
`driver.name`), unconflated from the clean dogfood `angular-typechecker` tool and from unintended
reds. The job passes ONLY when the RED report is submitted AND confirmed via the Code Scanning API
to be red for EXACTLY the expected diagnostics in the expected files.

**Scope:** `.github/workflows/ci.yml` (job `code-scanning-proof`, currently at line 690) and
`tools/ci/assert-code-scanning.mjs`, plus the GUARD drift specs that assert job wiring.

**Out of scope (handled separately, after this lands):** resolving the 3 currently-unresolved
`github-advanced-security` review threads on PR #55.
</domain>

<decisions>
## Implementation Decisions

### D-01: Recurrence handling -- auto-dismiss AFTER confirming

The proof job MUST first assert the exact expected alert set via the Code Scanning API (the proof
happens in full), and ONLY THEN dismiss those specific alerts, scoped to the proof tool, with
`dismissed_reason: "used in tests"`.

- Ordering is load-bearing: dismissal happens strictly AFTER a passing assertion, so proof
  integrity is preserved. A failed assertion must NOT dismiss anything -- it must fail the job.
- Rationale: every future code-touching PR would otherwise re-post the proof fixture's alerts as
  unresolved `github-advanced-security` review threads, and the main ruleset sets
  `required_review_thread_resolution: true` -- so without this, every code PR needs manual thread
  resolution before it can merge. This makes the proof self-healing.
- Scope discipline: dismissal touches ONLY alerts belonging to the new proof tool. It must never
  touch the dogfood `angular-typechecker` tool, `fallow`, or CodeQL alerts.
- The job already holds `security-events: write`, which is the permission a dismissal needs. No
  permission widening. (Verified: "`security-events: write` allows an action to update the status of
  a code scanning alert"; `used in tests` confirmed as an exact `dismissed_reason` enum value.)

**Research-driven refinements to D-01 (2026-07-22):**

- **The alerts query MUST NOT filter `state=open`.** Dismissal is GLOBAL and PERMANENT across
  branches. With a `state=open` filter retained, the first PR after this lands would pass and the
  SECOND would go permanently red (the alerts are dismissed, so an open-only query finds nothing and
  the exact-set assert reports them missing). Make the query state-agnostic and the dismiss step
  idempotent.
- **The dismiss step MUST be non-fatal** (emit `::warning::`, do not fail the job). This job is a
  member of the required `ci` aggregate; an unexpected PATCH 400/404 would turn a PASSING proof into
  a red required check and deadlock the empty-bypass `main` ruleset.
- **Read `most_recent_instance.state`, not top-level `state`** -- `GET /alerts/{n}` returns top-level
  `state: null` for a PR-only alert.
- **Scope correction (do not over-claim):** review threads are only auto-posted for alerts INSIDE the
  PR diff. A future PR that does not touch `tools/sarif-proof-fixture/` posts no thread at all. D-01
  is still correct and cheap, but its rationale is narrower than "every future code-touching PR".

### D-02: Proof tool name -- `angular-typechecker-red-proof`

The post-processed SARIF `runs[].tool.driver.name` becomes `angular-typechecker-red-proof`.
Explicit about both origin and intent; sorts adjacent to `angular-typechecker` so the pairing is
obvious, while being unmistakably distinct.

This tool MUST NOT be added to the future "Require code scanning results" required-tool list -- its
red is intentional. The required tools stay `angular-typechecker` + `fallow`.

### D-03: Assert strictness -- exact set, code AND file

Assert EXACTLY this set under the proof tool -- no more, no less:

| Diagnostic | Expected location |
|------------|-------------------|
| TS2322     | `tools/sarif-proof-fixture/type-error.ts` |
| NG8002     | `tools/sarif-proof-fixture/proof.component.html` |
| NG8101     | `tools/sarif-proof-fixture/proof.component.html` |
| ATC90002   | `tools/sarif-proof-fixture/tsconfig.json` (line 1, whole-file fallback) |

Catches BOTH a regression that drops a diagnostic AND an unexpected new alert leaking into the
proof tool. A missing tuple, an extra tuple, or a right-code-wrong-file attribution all fail the job.

**CORRECTION (2026-07-22, from research -- supersedes the original D-03 wording).** ATC90002 is NOT
file-less as originally stated here. Phase 35-04 gave file-less SARIF results a REGION-LESS
whole-file fallback location whose `artifactLocation.uri` is the relativized `tsConfigPath`, so the
live Code Scanning API returns
`location: { path: "tools/sarif-proof-fixture/tsconfig.json", start_line: 1, start_column: 1 }`.
A matcher that asserts an ABSENT location for ATC90002 would fail permanently. Assert the
tsconfig.json path instead.

### Claude's Discretion

- Exact job id/name (direction: descriptive, e.g. `code-scanning-red-proof`).
- Whether the SARIF `driver.name` rewrite is a `node -e` inline step (mirroring the existing fallow
  `automationDetails` rewrite at ci.yml:600) or a small committed `tools/ci/*.mjs` script -- prefer
  whichever keeps the no-command-injection invariant cleanest and stays testable.
- How the assert/dismiss logic is split between steps and modules, provided the assert-before-dismiss
  ordering is structurally enforced (not merely conventional).
</decisions>

<specifics>
## Specific Ideas

- Mirror the existing fallow-leg SARIF rewrite pattern already in the repo at `ci.yml:600`
  (`node -e '...'` rewriting `automationDetails`) for the `driver.name` rewrite.
- `assert-code-scanning.mjs` already exports a pure `missingTuples(alerts, expected)` and reads
  `ASSERT_ALERTS_FILE` as a test seam -- reuse and extend that seam rather than inventing a new one,
  so the exact-set logic (including the new "extra tuple" direction) stays unit-testable without
  GitHub.
- Alert dismissal is `PATCH /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}` with
  `state: "dismissed"`, `dismissed_reason: "used in tests"`.
</specifics>

<canonical_refs>
## Canonical References

- `AGENTS.md` -- the "Enabling the Require code scanning results ruleset" runbook (the new proof
  tool must stay OFF the required-tool list); the no-direct-push / PR-only posture.
- `.planning/phases/35-automated-code-scanning-proof/` -- PROOF-01/02 origin of the fixture + assert.
- `.planning/phases/36-code-scanning-gating-scanned-files-documentation/36-01-SUMMARY.md` -- the
  `ci` aggregate membership + D-03 `produced=='false'` fail-loud assertions this must preserve.

### Invariants that MUST hold (regression surface)

- No command injection: PR data reaches scripts via `env:`, NEVER interpolated into `run:`.
- All `uses:` remain SHA-pinned.
- Fork gate + `produced` guard preserved on every step that touches the API.
- `ci` aggregate membership preserved; the D-03 `produced=='false'` fail-loud assert steps stay.
- GUARD drift specs (`extractJobLines` membership) updated to match any renamed job id.
- Additive-only charter: the PUBLISHED surface is byte-unchanged -- `package.json` (manifest,
  dependencies, version `0.2.3`), the `src/index.ts` barrel + `src/index.drift.ts`, executor/builder
  schemas, and all shipped `src/core/**` / `src/cli/**` PRODUCTION modules. No release cut.

  **Clarification (2026-07-22, resolving plan-checker Warning 1):** an earlier draft of this line
  said "`src/core/**` byte-unchanged", which is over-broad. `*.spec.ts` files are EXCLUDED from the
  built package (`tsconfig.lib.json` excludes test/spec files), so a spec-only edit cannot reach the
  published artifact and does not violate the charter. Direct in-repo precedent: Phase 35-01 changed
  "only a spec under `src/**`" and explicitly recorded "D-04 holds: package.json byte-unchanged
  ... no bump". A comment-only job-id rename inside
  `src/core/machine-reporters-sarif.integration.spec.ts` is therefore PERMITTED here -- and is
  preferable to leaving a stale reference to a renamed job id in the repo.
</canonical_refs>
