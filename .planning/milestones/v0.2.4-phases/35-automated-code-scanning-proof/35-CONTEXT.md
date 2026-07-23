# Phase 35: Automated Code Scanning proof - Context

**Gathered:** 2026-07-21
**Status:** Ready for planning

> Discussion mode: `--auto` (autonomous, single pass) + `--analyze` (trade-off tables logged in `35-DISCUSSION-LOG.md`) + `--chain` (auto-advance to plan). Every decision below is evidence-backed by the v0.2.4 milestone research (HIGH confidence, mapped against the real source + live `ci.yml` at HEAD) and the closed spike PR #53, which already PROVED live in Code Scanning that per-run `automationDetails.id` categories land as distinct analyses, that rule tags/severity/help render, and that PR-ref alerts are queryable via `refs/pull/<n>/merge`. Every gray area here is CI/fixture/test-only, reversible, and self-verified by the proof going red -- none is in the high-impact + low-confidence quadrant, so none was escalated.

<domain>
## Phase Boundary

Add a CI check that continuously PROVES the SARIF -> GitHub Code Scanning contract end-to-end: one known diagnostic per family (typescript / template-type-check / extended-diagnostics / tool), emitted from an ISOLATED fixture living OUTSIDE the Nx project graph, uploaded under a dedicated proof category, then asserted -- via bounded `gh api` polling on the PR merge-ref -- to have landed as Code Scanning alerts with the expected category, family tags, and severity. The check fails RED the moment any expected alert/category/tag regresses.

This is CI/fixture/test-only. The shipped reporter, the three adapters (Nx executor, Angular CLI builder, standalone CLI), the plugin `package.json`, and every published-surface file are BYTE-UNCHANGED -- **no version bump** (PROOF is a no-release phase; only Phase 33's RULE-01..04 bumped `0.2.3 -> 0.2.4`).

**In scope (PROOF-01/02 only):**
- An isolated one-per-family fixture under `tools/sarif-proof-fixture/` with NO `project.json` (outside the Nx graph -> the real `nx run-many -t typecheck` gate never touches its deliberate errors).
- A dedicated `code-scanning-proof` CI job that runs the shipped standalone CLI on the fixture, uploads under a dedicated `angular-typecheck-proof` category, and asserts via `gh api` that each expected alert is present.
- A bounded, deterministic `gh api` poll/assert that checks SET-MEMBERSHIP of (category, family tag, severity) -- not counts -- and exits non-zero if any expected tuple is missing or the wait times out.
- PR-ref scoping so proof alerts do NOT pollute `main`'s alerts view.

**Out of scope (own phases / deferred):**
- Promoting `code-scanning` (+ this proof job) into the required `ci` aggregate `needs[]`, un-path-gating the code-scanning job so a planning-only PR still produces an analysis, enabling the "Require code scanning results" ruleset, and the Scanned-files docs -- **Phase 36 (GATE-01/02 + DOC-01)**.
- Any reporter-side `--category`/`automationDetails.id` CLI option -- explicitly rejected (would make this release-bearing).
- Asserting exact alert COUNTS (brittle) -- set-membership only.
- Populating / emitting `run.artifacts` to chase the "Scanned files" panel (proven inert; DOC-01/Phase 36).

</domain>

<decisions>
## Implementation Decisions

### Isolated fixture (PROOF-01)
- **D-01:** Put the fixture at `tools/sarif-proof-fixture/` (a bare `tsconfig.json` + source files, NO `project.json`), a NEW sibling of the existing `tools/act`, `tools/ci`, `tools/e2e-timing`. With no `project.json` it is invisible to `nx run-many -t typecheck` (the real merge gate lives in `test`), so its deliberate errors can never fail the normal gate. `tools/` (vs an `e2e/*/fixtures/` location, which is also graph-excluded) reads clearly as "CI proof asset, not a consumer example."
- **D-01a (one diagnostic per family -- the exact contract):** the fixture must fire exactly one known diagnostic per SARIF family, grounded in the shipped `diagnostic-family.ts` + `diagnostic-record.ts`:
  - `typescript` (SARIF level `error`) -- a plain TS type error in a `.ts` (e.g. `TS2322`).
  - `template-type-check` (level `error`) -- a type error in an EXTERNAL `.html` template, so it lands `.html`-attributed and the coarse family heuristic tags it `template-type-check` (e.g. `NG8002` unknown property, or a TS-coded template error attributed to the `.html`).
  - `extended-diagnostics` (level `warning`) -- any NG8xxx from the shipped 18-member extended catalog (pick a deterministic warning-level one, e.g. NG8101/NG8109/banana-in-box NG8102).
  - `tool` (level `error`) -- a synthesized ATC diagnostic: `ATC90001` (zero rootNames, `ZERO_ROOT_NAMES_DIAGNOSTIC_CODE`) or `ATC90002` (not-found referenced leaf, `REFERENCE_NOT_FOUND_DIAGNOSTIC_CODE`).
- **D-01b (ATC synthesis -- the one MEDIUM-confidence wiring detail):** the `tool`-family alert comes from an engine-state condition, not a source error, so it needs a dedicated references-only/empty (or missing-reference) tsconfig leaf fed via the CLI's repeatable `-c` -- possibly a SECOND CLI invocation whose SARIF is merged in with the fixture run. This is CI-only and self-verified: if ATC does not fire, the proof assert goes RED and the fixture is fixed. Exact code (90001 vs 90002) and single-vs-double invocation are the planner's/researcher's call.

### Proof CI job (PROOF-01, success criterion 4)
- **D-02:** Add a NEW dedicated `code-scanning-proof` job in `.github/workflows/ci.yml` (NOT steps folded into the dogfood `code-scanning` job). A separate job keeps the real per-project dogfood analyses uncontaminated by the fixture's deliberate errors and gives the proof its own upload + assert + gating.
- **D-02a (dedicated category):** upload the fixture SARIF under a DEDICATED `category: angular-typecheck-proof` -- distinct from the per-project `angular-typecheck/<project>` dogfood ids and the `fallow/<i>` ids -- so proof alerts never mix with or overwrite the dogfood analyses.
- **D-02b (PR-scoped -- protects `main`'s alerts view, SC4):** the upload + assert run ONLY on `pull_request` events (skip push-to-`main`), so the deliberate fixture errors are scoped to `refs/pull/<n>/merge` and NEVER land as open alerts on `main`'s default view (SC4). The assert needs a PR number for the merge-ref anyway. Also skip FORK PRs (read-only token -> upload skipped), mirroring the existing dogfood job's fork gate.
- **D-02c (preserve every CI security invariant verbatim):** job-scoped `security-events: write` at the job level only (write covers both the upload AND the alerts/analyses read the assert needs; top-level `contents: read` restated for `actions/checkout`), `persist-credentials: false`, `fetch-depth: 0`, SHA-pin any new action (prefer `gh api` over a marketplace action -- fewer pinned deps, PITFALLS repo-warning), `gh api` authenticated via the workflow `GITHUB_TOKEN`, and NO PR metadata interpolated into any shell command (the fork check is an Actions-expression, the PR number comes from `github.event.pull_request.number`).
- **D-02d (stays OUT of the required gate for now):** the proof job is NOT added to the `ci` aggregate `needs[]` this phase (promoting it is GATE-01, Phase 36). Keep the existing `code != 'false'` path-gate for now (a planning-only PR simply skips the proof); un-path-gating for the ruleset is Phase 36's GATE-02 concern, not this phase's.

### Assertion mechanism + determinism (PROOF-01/02, PITFALLS P6)
- **D-03:** Add a NEW `tools/ci/assert-code-scanning.mjs` (mirrors the existing `tools/ci/list-*.mjs` / `merge-sarif.mjs` precedent) -- a lean `node` script driving `gh api`. NOT a new marketplace action (fewer SHA-pinned deps; repo-warning). It receives the repo (`LayZeeDK/angular-typechecker`), the PR number, the expected category, and the expected family/severity set.
- **D-03a (deterministic wait handle):** capture the `upload-sarif` step's `sarif-id` output and poll `GET /repos/LayZeeDK/angular-typechecker/code-scanning/sarifs/{sarif_id}` until `processing_status == complete` (bounded) BEFORE querying alerts -- the deterministic handle from the research. If the sarif-id path is unavailable, fall back to bounded polling of the analyses API.
- **D-03b (bounded poll, never a single query):** query `code-scanning/analyses?ref=refs/pull/<n>/merge` + `code-scanning/alerts?ref=refs/pull/<n>/merge` (filtered by `tool_name`/category) with bounded retries + backoff. Code Scanning ingestion is asynchronous and `upload-sarif`'s `wait-for-processing` gives up SILENTLY on timeout (continues, does not fail), so the script must poll itself and fail loud on timeout.
- **D-03c (set-membership, not counts):** assert SET-MEMBERSHIP of the expected tuples -- category `angular-typecheck-proof` present, and one alert PRESENT per family matched on rule tag (`typescript` / `template-type-check` / `extended-diagnostics` / `tool`) + severity. NEVER assert an exact alert count (brittle if the fixture picks up an incidental diagnostic). Exit non-zero (RED) if ANY expected tuple is missing OR the poll times out (PROOF-02).
- **D-03d (the expected set -- the contract the assert locks):** grounded in the shipped reporter's family + level mapping:
  - `typescript` -> `error`
  - `template-type-check` -> `error`
  - `extended-diagnostics` -> `warning`
  - `tool` (ATC) -> `error`

### No release / additive-only
- **D-04:** CI/fixture/test-only. New/changed files: `tools/sarif-proof-fixture/**` (NEW), `tools/ci/assert-code-scanning.mjs` (NEW), `.github/workflows/ci.yml` (MOD -- new `code-scanning-proof` job), and OPTIONALLY one in-plugin test spec (see Discretion). NO reporter/API/schema edit, NO new runtime dependency, NO `package.json` version bump. Confirm via the repo's standing additive posture that `packages/angular-typechecker/**` production surface + the manifest are byte-unchanged (nothing to release).

### Claude's Discretion
- Exact poll bounds (attempts / interval / total timeout) -- a sensible default of up to ~3-5 min total with linear or exponential backoff; generous enough for GitHub's async ingestion.
- **RECOMMENDED drift lock:** a LOCAL, test-only in-plugin spec that runs the shipped CLI over the proof fixture and asserts the emitted SARIF carries exactly the four family tags + severities the CI assert expects -- so the "expected set" the CI proof checks cannot silently drift from what the reporter actually emits (mirrors the Phase-34 drift-guard philosophy). Planner's discretion on exact shape/target (`cache:false` regression-guard vs integration spec); it MUST be test-only (never published, no version impact).
- Exact ATC code to synthesize (90001 zero-rootNames vs 90002 not-found-reference) and whether it needs a second CLI invocation vs an added `-c` leaf (D-01b).
- Whether `assert-code-scanning.mjs` also cross-checks the per-analysis `category`/`automationDetails.id` via the analyses API in addition to the alerts API.
- Exact ci.yml step wiring (`set -e` loud-fail on a failed substitution, mirroring the `discover` job's separate-assignment idiom; passing `sarif-id` / PR number between steps via `$GITHUB_OUTPUT`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + roadmap (locked scope)
- `.planning/REQUIREMENTS.md` -- PROOF-01 (isolated one-per-family fixture outside the gate + `gh api` assert of category/tags/severity) + PROOF-02 (fails loud RED on any missing alert/category/tag) + the Out-of-Scope table (no Issue filed; no `run.artifacts`).
- `.planning/ROADMAP.md` (Phase 35 detail) -- goal + the 4 success criteria; the "CI-only, no release" attribution; SC4 "proof alerts query on the PR ref and do not pollute the `main` alerts view."

### Milestone research (v0.2.4, namespaced -- do NOT clobber the root `.planning/research/*.md`)
- `.planning/research/v0.2.4-enhanced-sarif-reporting/ARCHITECTURE.md` §3 -- the PROOF seam: fixture outside the Nx graph at `tools/sarif-proof-fixture/`, one diagnostic per family (incl. the ATC-may-need-a-second-invocation note), the `angular-typecheck-proof` category, `gh api` poll/assert, the new-vs-modified PROOF file table.
- `.planning/research/v0.2.4-enhanced-sarif-reporting/PITFALLS.md` -- **P6** (PROOF flakiness: wrong-ref, async ingestion latency, brittle count assertions -> query `refs/pull/<n>/merge`, poll with backoff, assert set-membership) + the repo-specific SHA-pin / `gh api`-over-action / real-owner-name warnings.
- `.planning/research/v0.2.4-enhanced-sarif-reporting/SUMMARY.md` -- key finding #2 (PROOF is CI-only; `sarif_id` + `GET /code-scanning/sarifs/{id}` is the deterministic wait handle; `security-events: read` scope; set-membership) + finding #4 (`node-sarif-builder@4.1.0` already auto-emits `run.artifacts` yet the Scanned-files panel is still empty -- do NOT chase it here).
- `.planning/research/v0.2.4-enhanced-sarif-reporting/FEATURES.md` -- PROOF table-stakes vs anti-features.

### CI + tooling under change (grounded at HEAD)
- `.github/workflows/ci.yml` -- the existing `code-scanning` job (lines ~539-613: the fork-PR skip gate, job-scoped `security-events: write`, `persist-credentials: false`, `fetch-depth: 0`, SHA-pinned `upload-sarif@7188fc36...`, the `|| true` + `[ -s file ]` produced-guard, the path-gated `if: needs.changes.outputs.code != 'false'`, run-from-repo-root) -- the invariants the new `code-scanning-proof` job MUST mirror; the `changes` job path-gate; the `ci` aggregate `needs[]` (the proof job stays ABSENT here -- GATE-01 is Phase 36); the `discover` job's `set -e` separate-assignment loud-fail idiom.
- `tools/ci/merge-sarif.mjs`, `tools/ci/list-typecheck-projects.mjs`, `tools/ci/list-e2e-projects.mjs` -- the pure-`node` `tools/ci/*.mjs` precedent that `assert-code-scanning.mjs` (D-03) mirrors.

### Reporter contract the proof verifies (read-only; DO NOT edit -- no release)
- `packages/angular-typechecker/src/core/diagnostic-family.ts` -- `familyOf(record)` + the `Family` union (`typescript` / `template-type-check` / `extended-diagnostics` / `tool`); the exact family tags the assert checks. ATC (`rawCode >= 90000`) -> `tool`; `.html` -> `template-type-check`.
- `packages/angular-typechecker/src/core/diagnostic-codes.ts` -- `ZERO_ROOT_NAMES_DIAGNOSTIC_CODE` (90001) + `REFERENCE_NOT_FOUND_DIAGNOSTIC_CODE` (90002), the two synthesizable `tool` codes for the fixture (D-01b).
- `packages/angular-typechecker/src/core/sarif-report.ts` -- `toSarifLevel` (error/warning/note) + how tags/level/help are set on `.rule`; the per-rule tag/level the proof asserts.
- `packages/angular-typechecker/src/cli/bin.ts` (built to `dist/packages/angular-typechecker/src/cli/bin.js`) -- the standalone CLI the proof job runs on the fixture (`--format sarif`, repeatable `-c`).

### Prior phase context (same milestone)
- `.planning/phases/33-diagnostic-family-sarif-rule-metadata/33-CONTEXT.md` -- the RULE-01..04 SARIF-path work the proof asserts (family tags/level/help are already in every SARIF run).
- `.planning/phases/34-per-project-sarif-categories-in-ci/34-CONTEXT.md` -- the per-project multi-run/no-category upload shape the proof job's separate category sits beside; the drift-guard philosophy the optional local drift lock (Discretion) mirrors.

### Empirical evidence (external -- the pipeline is already spike-proven)
- Closed spike PR #53 (`LayZeeDK/angular-typechecker`) -- PROVED live that SARIF -> alert lands with per-run category, rule tags, severity, and `help`; that PR-ref alerts are queryable via `refs/pull/<n>/merge`; and that `run.artifacts` does NOT populate the Scanned-files panel.
- Auto-memory `code-scanning-sarif-empirical-behavior` -- `tag:`/`severity:`/`rule:` filters work with the shipped rule metadata; PR-ref alerts do NOT hit the `main` alerts view (query `pr:<n>` / `ref=refs/pull/<n>/merge`).
- Auto-memory `ci-sarif-code-scanning-dogfood` -- the current `code-scanning` job shape; multi-run-same-category rejection; SARIF-upload correctness only provable in REAL CI (local gates all pass while GitHub still rejects) -- **so this proof's real verification is a real-CI-only step, not local.**

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The existing `code-scanning` job (`ci.yml`) -- copy its fork-PR upload gate, `security-events: write` job scope, `persist-credentials: false` + `fetch-depth: 0`, SHA-pinned `upload-sarif`, `npm ci` + `nx build` prelude (so the dist CLI is runnable), and run-from-repo-root verbatim into the new `code-scanning-proof` job.
- `tools/ci/merge-sarif.mjs` / `list-typecheck-projects.mjs` / `list-e2e-projects.mjs` -- the lean pure-`node` `tools/ci/*.mjs` shape `assert-code-scanning.mjs` mirrors.
- The standalone CLI `bin.js --format sarif -c <tsConfig...>` (byte-pure SARIF to stdout) -- already the dogfood generator; the proof runs it on the fixture tsconfig(s).
- The `discover` job's `x=$(node ...)` separate-assignment (NOT `echo "$(...)"`) so a failed substitution trips `set -e` and fails LOUD -- reuse for the proof's generate/upload/assert wiring.
- `diagnostic-family.ts` / `diagnostic-codes.ts` / `sarif-report.ts` -- the source of truth for the exact family tags, ATC codes, and severity levels the fixture must fire and the assert must expect (read-only; no edits).

### Established Patterns
- Lean CI helper (`tools/ci/*.mjs`) + a fork-gated, path-gated, SHA-pinned `security-events`-scoped Code Scanning job -- the proof job is a second instance of that pattern with a dedicated category and PR-only upload/assert.
- Set-equality / regression-guard specs cross-check dynamic CI behavior against an independent source (GUARD-01b, the Phase-34 drift guard) -- the OPTIONAL local drift lock (Discretion) applies the same idea to the proof's expected family set.
- CI security invariants preserved verbatim on every job: SHA-pin every action, `persist-credentials: false`, job-scoped least-privilege permissions, fork-PR upload skip, no PR-metadata interpolated into a shell command.
- Standing additive-only audit vs the previous published version gates every release; PROOF touches no published surface, so the audit must show `packages/angular-typechecker/**` production files + manifest byte-unchanged.

### Integration Points
- All new logic is CI-side (`.github/workflows/ci.yml` new job + `tools/ci/assert-code-scanning.mjs`) plus the `tools/sarif-proof-fixture/**` assets and one OPTIONAL test-only in-plugin spec; the reporter seam and all three adapters are UNCHANGED.
- The per-family SARIF metadata the proof asserts already ships (Phase 33), and the CI merge/upload shape already exists (Phase 34) -- this phase only ADDS an isolated proof against that contract; it does not touch the dogfood path.

</code_context>

<specifics>
## Specific Ideas

- Fixture at `tools/sarif-proof-fixture/` (NO `project.json`) -- one diagnostic per family: `TS2322` (typescript/error), an external `.html` template type error (template-type-check/error), an NG8xxx (extended-diagnostics/warning), and a synthesized `ATC90001`/`ATC90002` (tool/error).
- Dedicated `category: angular-typecheck-proof` -- never mixes with the per-project `angular-typecheck/<project>` dogfood analyses or the `fallow/<i>` runs.
- Query the PR merge-ref explicitly: `gh api repos/LayZeeDK/angular-typechecker/code-scanning/{analyses,alerts}?ref=refs/pull/<n>/merge` -- PR-scoped so the deliberate errors never surface on `main`'s alerts view.
- Assert SET-MEMBERSHIP of (category, family tag, severity), poll with bounded backoff, and fail RED on any missing tuple or timeout -- never an exact count.
- `sarif_id` + `GET /code-scanning/sarifs/{id}` `processing_status == complete` is the deterministic wait handle before the alerts query.

</specifics>

<deferred>
## Deferred Ideas

- Promote `code-scanning` (+ this proof job) into the required `ci` aggregate `needs[]`, un-path-gate the code-scanning job so a planning-only PR still produces an analysis, enable the "Require code scanning results" ruleset (Evaluate-mode-first + `enforcement: disabled` recovery + fork-PR deadlock note), and document the CodeQL-only "Scanned files" limitation -- **Phase 36 (GATE-01/02 + DOC-01)**.
- Any reporter-side `--category`/`automationDetails.id` CLI option -- explicitly rejected (would make PROOF release-bearing).
- Precisely distinguishing inline-template TS diagnostics from ordinary `typescript` (family cannot be derived from the `TSxxxx` code alone) -- RULE-FUT-01, deferred; the coarse `.html`-origin heuristic is the v1 contract the fixture's external-`.html` template error relies on.

None of the above is in scope for Phase 35.

</deferred>

---

*Phase: 35-automated-code-scanning-proof*
*Context gathered: 2026-07-21*
