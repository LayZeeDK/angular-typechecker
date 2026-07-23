# Phase 35: Automated Code Scanning proof - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-07-21
**Phase:** 35-automated-code-scanning-proof
**Mode:** `--auto` (autonomous single pass) + `--analyze` (trade-off tables below) + `--chain` (auto-advance to plan)
**Areas discussed:** Isolated fixture location + shape, Tool (ATC) family synthesis, Proof CI job shape + event scoping, Assertion mechanism + determinism, Release discipline

---

## Isolated fixture location + shape (PROOF-01)

**Trade-off analysis**

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| `tools/sarif-proof-fixture/` (no project.json) | Outside Nx graph -> `nx run-many -t typecheck` never touches its deliberate errors; reads as a CI proof asset; sibling of existing `tools/act`/`tools/ci`/`tools/e2e-timing` | New top-level fixture dir | [x] |
| `e2e/*/fixtures/` location | Also graph-excluded (precedent exists) | Reads as a "consumer example," not a proof asset; conflates with e2e tarball fixtures | |
| Inline in the proof job (heredoc) | No committed fixture | Not reviewable/diffable; brittle; can't be locally drift-locked | |

**Choice (auto, recommended):** `tools/sarif-proof-fixture/` with NO `project.json`, firing one diagnostic per family -- `TS2322` (typescript/error), external `.html` template error (template-type-check/error), an NG8xxx (extended-diagnostics/warning), synthesized `ATC90001`/`ATC90002` (tool/error). (`[auto] fixture-location -> tools/sarif-proof-fixture/ (research ARCHITECTURE.md §3 recommendation)`)
**Notes:** Grounded in `diagnostic-family.ts` + `diagnostic-codes.ts` + `sarif-report.ts` at HEAD (family tags, ATC codes, severity levels verified in source).

---

## Tool (ATC) family synthesis (PROOF-01)

**Trade-off analysis**

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| Dedicated references-only/empty (or missing-reference) tsconfig leaf via repeatable `-c` (2nd invocation merged if needed) | Deterministically fires `ATC90001`/`ATC90002`; self-verified (proof goes red if absent) | ATC is an engine-state condition, not a source error -> may need a 2nd CLI run merged in (MEDIUM-confidence wiring) | [x] |
| Skip the `tool` family in the proof | Simpler fixture | Fails PROOF-01 (must be one-per-family, all four); leaves the ATC->alert contract unproven | |

**Choice (auto, recommended):** synthesize the `tool` alert via a dedicated tsconfig leaf. Exact code (90001 vs 90002) and single-vs-double invocation left to planner/researcher. (`[auto] atc-synthesis -> dedicated references-only/missing-reference tsconfig leaf`)
**Notes:** The only MEDIUM-confidence item; CI-only, reversible, and caught loud by the proof itself -- not escalated (not high-impact + low-confidence).

---

## Proof CI job shape + event scoping (PROOF-01, success criterion 4)

**Trade-off analysis**

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| NEW dedicated `code-scanning-proof` job, PR-scoped upload+assert, dedicated `angular-typecheck-proof` category | Dogfood analyses stay uncontaminated by deliberate errors; own gating; PR-ref scoping keeps fixture errors off `main` (SC4) | One more job in ci.yml | [x] |
| Fold proof steps into the existing `code-scanning` job | Fewer jobs | Mixes deliberate errors with the real per-project dogfood analyses; harder to scope/gate independently | |
| Run proof on push + PR | Alerts on main too | Pollutes `main`'s alerts view with deliberate errors (violates SC4) | |

**Choice (auto, recommended):** dedicated `code-scanning-proof` job; upload+assert only on `pull_request` (skip push-to-main + fork PRs); dedicated category; every CI security invariant preserved verbatim; stays OUT of the required `ci` aggregate (that is GATE-01/Phase 36). (`[auto] proof-job -> dedicated PR-scoped code-scanning-proof job, angular-typecheck-proof category, out of ci needs`)
**Notes:** Fork-PR skip + `security-events: write` (job-scoped) + SHA-pin + no PR-metadata-in-shell all mirror the existing `code-scanning` job.

---

## Assertion mechanism + determinism (PROOF-01/02, PITFALLS P6)

**Trade-off analysis**

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| `tools/ci/assert-code-scanning.mjs` -- `gh api` bounded poll on `refs/pull/<n>/merge`, set-membership assert | Mirrors `tools/ci/*.mjs`; no new pinned action; deterministic `sarif_id` wait handle; poll survives async ingestion | Custom script to maintain | [x] |
| Inline bash `gh api` step | No new file | Bounded-poll + JSON parse is ugly in bash; not unit-testable | |
| Marketplace action | Off-the-shelf | New SHA-pinned dep (repo warns against); overkill | |
| Assert exact alert counts | Simple | Brittle -- an incidental diagnostic breaks it (P6) | |

**Choice (auto, recommended):** `tools/ci/assert-code-scanning.mjs` -- correlate on the upload `sarif_id` (`GET /code-scanning/sarifs/{id}` -> `processing_status == complete`), then bounded poll `code-scanning/{analyses,alerts}?ref=refs/pull/<n>/merge`, asserting SET-MEMBERSHIP of (category `angular-typecheck-proof`, family tag, severity) and exiting non-zero on any missing tuple or timeout (PROOF-02). (`[auto] assert -> tools/ci/assert-code-scanning.mjs, gh api PR-ref bounded poll, set-membership`)
**Notes:** Expected set grounded in the reporter: typescript=error, template-type-check=error, extended-diagnostics=warning, tool=error.

---

## Release discipline (PROOF is no-release)

**Trade-off analysis**

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| CI/fixture/test-only; published surface byte-unchanged; no version bump | Preserves "only RULE bumps the version"; additive-only holds | -- | [x] |
| Add a reporter `--category`/proof option | Reusable | Makes PROOF release-bearing; risks non-additive SARIF change (explicitly rejected) | |

**Choice (auto, recommended):** touch only `tools/sarif-proof-fixture/**`, `tools/ci/assert-code-scanning.mjs`, `.github/workflows/ci.yml`, and (optional) one test-only spec; confirm `packages/angular-typechecker/**` + manifest byte-unchanged. (`[auto] release -> no bump; CI/fixture/test-only`)

---

## Claude's Discretion

- Exact poll bounds (attempts/interval/total timeout; ~3-5 min default with backoff).
- RECOMMENDED optional local test-only drift lock (run the shipped CLI over the fixture; assert the SARIF carries the four expected family tags/severities) so the CI proof's expected set cannot silently drift from the reporter.
- Exact ATC code (90001 vs 90002) + single-vs-double CLI invocation.
- Whether the assert cross-checks per-analysis `category`/`automationDetails.id` (analyses API) in addition to alerts.
- Exact ci.yml step wiring (`set -e` loud-fail, `$GITHUB_OUTPUT` handoff of `sarif_id`/PR number).

## Deferred Ideas

- GATE-01/02 (promote to required `ci` + un-path-gate + "Require code scanning results" ruleset) + DOC-01 (Scanned-files limitation) -- Phase 36.
- Reporter-side `--category`/`automationDetails.id` CLI option -- rejected (would make PROOF release-bearing).
- Precise inline-template vs `typescript` family distinction -- RULE-FUT-01, deferred.
