# Feature Landscape: v0.2.4 -- Enhanced SARIF reporting for GitHub Code Scanning

**Domain:** SARIF-emitting static analysis tool integrating with GitHub Code Scanning (multi-project Nx/Angular type-checker)
**Researched:** 2026-07-21
**Overall confidence:** HIGH (GitHub docs + the closed spike PR #53 + the repo's live `ci.yml`)

## Scope note -- what is already proven (do NOT re-derive)

Taken as given from the 2026-07-20 spike (closed PR #53) and the merged dogfood wiring (PR #49, now in `.github/workflows/ci.yml` `code-scanning` job):

- Per-run `automationDetails.id` categories land as distinct analyses; a single `upload-sarif` of one file with multiple runs works when each run's id differs (fallow already does this in `ci.yml`).
- `properties.tags` + rule catalog + `help` make GitHub `tag:`/`severity:`/`rule:` filters and the rule-help panel work.
- The "Scanned files" tool-status panel is CodeQL-only telemetry; `run.artifacts` is inert for third-party SARIF. -> DOC-01 (document), never pursue.

The v0.2.3 SARIF reporter emits **one run**, catalogs **only the 18 NG8xxx** rules, and carries **no family tags**. Everything below builds on that reporter and that CI job.

---

## Table Stakes

Features a first-class Code Scanning integration for a multi-project type-checker is expected to have. Missing = the integration feels half-wired.

| Feature | Req | Why expected | Complexity | Depends on |
|---------|-----|--------------|------------|------------|
| **Per-project analyses via distinct `category`** (`angular-typecheck/<project>`, N runs in one file, single upload) | MULTI-01 | This is exactly what GitHub's `category`/`automationDetails.id` is designed for -- "different parts of the code" (CodeQL's `/language:<lang>` precedent). A monorepo tool that dumps one union run throws away the per-project "which project is failing" signal Nx users need. | LOW-MED | CI orchestration + a merge step (NOT reporter code) -- see Feature Dependencies |
| **Auto-discovered project set + drift guard** | MULTI-02 | A project that adds the `typecheck` target must be covered with no CI edit; a dropped target must drop. The repo already lives by this rule (GUARD-01b: `tools/ci/list-e2e-projects.mjs` + set-equality). | LOW | Reuse the existing discover+guard pattern |
| **Rule catalog across ALL families** (TS / template / NG8xxx / ATC900x), on-demand | RULE-01 | A blank rule description on an alert is the classic "half-configured SARIF" smell. Every diagnostic that fires must resolve to a `reportingDescriptor`. | MED | Extends the v0.2.3 reporter's NG8xxx-only catalog -- the one release-bearing change |
| **Family tag on every rule** (`properties.tags`: `typescript` / `template-type-check` / `extended-diagnostics` / `tool`) | RULE-02 | Every surveyed tool (CodeQL, ESLint, Semgrep, gosec, Checkov) expresses rule family as in-run tag metadata; GitHub's `tag:` filter reads `rule.tags`. This is the free "show me only NG8xxx" view. | LOW | Reporter catalog |
| **`defaultConfiguration.level` per rule** matching diagnostic severity | RULE-03 | Drives GitHub's `severity:` filter and the default alert severity band. | LOW | Reporter catalog |
| **`help` text per rule** (not just `helpUri`) | RULE-04 | Without `help`, the alert detail page renders "No rule help available". A per-family help template + a `helpUri` to the TS/Angular docs is the right-sized fill. | LOW-MED | Reporter catalog |
| **`code-scanning` job in the required `ci` aggregate** | GATE-01 | A dogfood upload that can silently stop uploading is not a gate. The aggregate already tolerates path-skip (`'skipped'` dropped from the fail set), so this is a one-line `needs:` edit. | LOW (+ a design-tension flag, below) | `ci.yml` aggregate |
| **"Require code scanning results" ruleset** for angular-typechecker + fallow, planning-PR-safe | GATE-02 | The maintainer wants Code Scanning to be a merge precondition. Must be configured so the ~58%-of-commits planning-only PRs (code-scanning path-skipped) do not deadlock. | MED (+ LIVE-verify) | Ruleset + un-path-gating the job -- see Pitfall below |
| **"Scanned files" limitation documented in-repo** | DOC-01 | Sets the right expectation: the empty panel is a GitHub product gap, not a defect. | TRIVIAL | Spike evidence already captured |

### Notes on the table-stakes shape (all sourced)

- **Per-project topology (MULTI-01):** N runs in ONE file, ONE `upload-sarif`, distinct per-run id. At 4-ish projects this is nowhere near GitHub's 20-runs-per-file cap. The **lazy-correct build** reuses the fallow pattern already in `ci.yml`: run `atc --format sarif` per discovered project, stamp each run's `automationDetails.id = angular-typecheck/<project>` (a tiny `node -e` merge, exactly like the existing fallow step), one upload with **no `category` input**. No reporter code needed -> consistent with the milestone note that per-project categories are "CI/ruleset-only (no release)."
- **Rule catalog is ON-DEMAND, not an enumeration (RULE-01):** you cannot hand-catalog every `TSxxxx` (thousands exist). Catalog a rule the moment its code appears in the result set, deriving the family from the code prefix. Only `NG8xxx`/`ATC900x` are enumerable; TS is open-ended and must be lazy-cataloged. (This is the intended reading -- flagged under Requirement Cross-Check so the planner scopes it correctly.)
- **Family cannot always be derived from the code (RULE-FUT-01, correctly deferred):** a `TSxxxx` diagnostic that originates in a template should read as `template-type-check`, but the code alone doesn't say so. Interim heuristic: file extension / an `.html` external template maps to `template-type-check`, otherwise `typescript`. Deferred unless the coarse heuristic proves insufficient -- a good deferral.

---

## Differentiators

Not expected of a typical SARIF emitter, but high-value here.

| Feature | Req | Value proposition | Complexity |
|---------|-----|-------------------|------------|
| **Continuously-PROVEN SARIF->Code Scanning contract** (fixture emits one diagnostic per family; `gh api` asserts each alert landed with the right category/tags/severity) | PROOF-01/02 | Nobody ships this off-the-shelf. The GitHub REST primitives are documented and stable, but a self-verifying "my SARIF actually rendered as I intended" CI check is **bespoke** -- it turns the whole spike into a regression test so a future SARIF/GitHub change can't silently rot the integration. Fits ATC's "correctness is the product" ethos. | MED-HIGH |
| **Diagnostic-family tagging on a type-checker** | RULE-02 | Security scanners tag by CWE/OWASP; a *type-checker* tagging TS vs template vs extended-diagnostic vs tool is unusual and genuinely useful for triage in a mixed monorepo. | folded into RULE-02 |

### PROOF harness -- the known pattern (axis 4)

The verification flow GitHub documents and that a CI check strings together:

1. **Upload** the fixture SARIF to an **isolated ref + category** -- `POST /repos/{o}/{r}/code-scanning/sarifs` (gzip+base64) or the `upload-sarif` action. Returns a `sarif_id`.
2. **Poll** `GET /code-scanning/sarifs/{sarif_id}` until `processing_status == complete` (upload is async -- fire-and-assert races).
3. **Assert analyses:** `GET /code-scanning/analyses?ref=<ref>&tool_name=angular-typechecker` -> expected category present. `GET .../analyses/{id}` with `Accept: application/sarif+json` returns the ingested SARIF plus `github/alertNumber` / `github/alertUrl`.
4. **Assert alerts:** `GET /code-scanning/alerts?ref=<ref>&tool_name=angular-typechecker` -> assert `rule.id`, `rule.tags`, `rule.severity` per expected family. Red-fail if any expected alert/category/tag is missing (PROOF-02).

**Gotchas that must be designed in (all confirmed):**
- **Isolate the ref.** Uploading fixture "errors" to `main`'s baseline creates persistent alerts on the real Security tab. Upload to a dedicated synthetic ref (e.g. `refs/heads/code-scanning-proof`) and query that same ref; alerts stay scoped there and never touch `main`. (Requirements say "ISOLATED fixture" but do not mention the isolated-REF/baseline-pollution angle -- flag.)
- **Distinct category** (e.g. `angular-typecheck-proof/*`) so the proof upload never overwrites the real dogfood analysis (same-tool+category overwrites).
- **Fork PRs can't upload** -- `GITHUB_TOKEN` is read-only on forks (the dogfood job already gates on `head.repo.fork == false`). The proof runs on `push`/non-fork only, or skips forks the same way.
- **Async + eventual consistency:** poll `sarifs/{id}`; add a bounded timeout on the alerts query (analyses can lag a few seconds).
- **Fingerprint dedup:** re-uploading the same fixture matches the same alert -- assert on *presence*, never on a "new alerts count".
- **`security-events: write`** at job level only (mirror the dogfood job's least-privilege posture).

---

## Anti-Features

Explicitly do NOT build.

| Anti-feature | Why avoid | Do instead |
|--------------|-----------|------------|
| **Per-family SARIF runs / GitHub categories** (a `run` or `category` per TS/template/NG8xxx/tool) | Fragments per-project baselines, multiplies tool-status rows (4 projects x 4 families = 16 configs), invites "reclassified across a refactor -> new here / stale there" churn, and yields **zero** UI benefit (tag/severity/rule filters already do it). The SARIF spec puts classification in rules, not run identity. | `properties.tags` on each rule, inside each project's single run |
| **Single union run** (no per-project split) | Loses the "which project failed" signal and per-project baseline tracking -- the one place `category` gives a cheap real win. | One run per project (MULTI-01) |
| **Populate `run.artifacts[]`/`analysisTarget`** to light up "Scanned files" | Proven inert for third-party tools; not in GitHub's documented ingestion surface; adds bytes for no effect. | Document the gap (DOC-01) |
| **Formal SARIF `taxonomies`/`taxa` objects** | Spec-purist, but GitHub renders `properties.tags`, not taxa, for non-CWE families. Complexity GitHub won't use. | Plain `properties.tags` |
| **Hand-authored per-rule `help` for every TS code** | Unbounded (thousands of TS codes). | Per-family `help` template + `helpUri` to TS/Angular docs |
| **Matrix-per-project upload** (N jobs, N files) now | 4 projects fit one file well under the 20-run cap; N jobs = more CI minutes + `security-events: write` on every cell for no gain today. | Deferred = MULTI-FUT-01 (migrate only if the workspace grows past a handful) |
| **Make the `code-scanning` job a findings gate** (block merges on ATC/fallow findings *from the SARIF upload*) | ATC findings already gate via `test`'s `nx typecheck`; fallow via the `fallow` job. Duplicating it is redundant and couples the merge button to Code Scanning ingestion uptime. | Keep code-scanning a *reporting* gate; set the GATE-02 ruleset alert threshold to **None** (require-the-scan-ran, don't-re-block-on-findings) -- see Out of Scope in REQUIREMENTS |
| **File a GitHub Issue for the Scanned-files gap** | User preference (MEMORY: no Issues on their behalf). | In-repo doc only (DOC-01) |

---

## Feature Dependencies

```
v0.2.3 SARIF reporter (1 run, NG8xxx-only catalog, no tags)
        |
        +-- RULE-01..04  (release-bearing: widen catalog to all families + tags + level + help)   [reporter code]
        |
        +-- MULTI-01     (per-project: CI runs atc per discovered project, node-e merge to 1 file) [CI only, reuse fallow pattern]
        |        |
        |        +-- MULTI-02  (auto-discover typecheck-target projects + set-equality guard)      [reuse GUARD-01b pattern]
        |
        +-- PROOF-01/02  (fixture SARIF is the thing-under-test; gh api asserts it landed)          [CI only]

GATE-01 (add code-scanning to `ci` needs)  --- independent, one-line edit; reverses a documented decision (flag)
GATE-02 (merge-protection ruleset)         --- needs the code-scanning job to ALWAYS run (un-path-gate) to be planning-PR-safe
DOC-01  (Scanned-files limitation)         --- prose only
```

**Release attribution:** only RULE-01..04 touch the *published* SARIF report -> the sole version-bumping work (patch bump under 0.x). MULTI, GATE, PROOF, DOC are CI/ruleset/docs-only. This matches PROJECT.md exactly.

---

## Pitfalls the roadmap must plan around

1. **GATE-02 planning-only-PR deadlock (the highest-risk item, LIVE-verify required).** Code-scanning merge protection blocks a merge under three conditions, verbatim from GitHub docs: *"A required tool finds a code scanning alert of a severity that is defined in the ruleset"*, *"A required tool's analysis is still in progress"*, and *"A required tool is not configured for the repository."* On a planning-only PR the `code-scanning` job is **path-skipped** and uploads nothing for the PR ref -- which risks tripping the "analysis in progress / not configured" condition regardless of the alert threshold. The exact fallback behavior (does GitHub reuse the base-branch analysis?) is **not clearly documented** and the spike did not cover it.
   - **Recommended mitigation (verify live):** (a) set the ruleset alert thresholds to **None / None** for both tools -- "require the scan ran" without re-blocking on findings (consistent with the Out-of-Scope "don't duplicate findings gating"); and (b) **un-path-gate the `code-scanning` job** so every PR -- even planning-only -- produces a clean analysis (ng-spike-app is unchanged -> 0 alerts -> analysis completes). Cost: one Linux runner on the ~58% planning-only PRs. This is the robust "always run the required job" fix the community documents for skipped-workflow deadlocks.

2. **GATE-01 reverses a deliberate design decision.** The `code-scanning` job comment states it is kept OUT of `ci` on purpose so *"a Code Scanning outage or a fork-PR upload skip can NEVER deadlock the PR-only merge button."* Adding it to `ci` (GATE-01) means a Code Scanning ingestion outage or an `upload-sarif` failure now fails the aggregate and blocks the empty-bypass `main`. This is acceptable and **precedented** -- `cve-lite` made the identical trade at the maintainer's request -- but the roadmap must document the outage trade-off and point to the AGENTS.md "Lockout recovery" (toggle ruleset enforcement). Do not treat GATE-01 as a no-op.

3. **RULE-01 is not "enumerate every TS code".** Read it as "every diagnostic that *fires* resolves to a cataloged rule" -- catalog on demand, derive family from code prefix. Pre-enumerating `TSxxxx` is impossible and un-asked.

4. **PROOF must not pollute `main`'s baseline.** Isolate the ref and category (above). This is implied by "ISOLATED fixture" but the ref/baseline dimension is not spelled out in REQUIREMENTS.

---

## Requirement Cross-Check (gaps / over-reach)

| Requirement | Assessment |
|-------------|------------|
| MULTI-01 | Sound. Lazy path = CI-side merge reusing the fallow `node -e` + per-run-id pattern; no reporter change. |
| MULTI-02 | Sound + **under-specified on the guard**: reuse the existing `list-e2e-projects.mjs` + GUARD-01b set-equality mechanism rather than inventing a new discovery. Note as a dependency. |
| RULE-01 | **Clarify scope:** on-demand catalog, not TS-code enumeration (Pitfall 3). |
| RULE-02/03/04 | Sound and correctly the only release-bearing work. |
| RULE-FUT-01 | Good deferral; capture the file-extension interim heuristic so the family tag is never wrong-by-omission today. |
| GATE-01 | **Gap:** requirements don't flag that this reverses the "never deadlock the merge button" decision (Pitfall 2). Add the outage trade-off + recovery to the phase. |
| GATE-02 | **Gap:** "planning-only-PR deadlock mitigation" is named but not specified. Needs a concrete config (thresholds None + un-path-gate) AND a live-verify step -- merge-protection-on-skipped-PR is undocumented (Pitfall 1). Consider a short spike before locking the ruleset on the empty-bypass `main`. |
| PROOF-01/02 | Sound. **Gap:** add the isolated-ref + fork-skip + async-poll + dedup constraints (Differentiators section) to the phase plan; they are load-bearing for a non-flaky check. |
| DOC-01 | Sound, trivial. |
| Out of Scope (4 rows) | All correct and well-reasoned; the anti-features above align 1:1. |

**Net:** no over-reach that needs cutting. Two real gaps to inject into the roadmap -- (1) GATE-02 needs a concrete, live-verified deadlock mitigation (candidate spike), and (2) GATE-01's outage trade-off must be documented, not assumed free. RULE-01 needs a one-line scope clarification.

---

## MVP Recommendation

Ship order that front-loads the release-bearing change and de-risks the ruleset last:

1. **RULE-01..04** (reporter catalog widen) -- the sole version-bumping change; unit-testable in isolation against the SARIF 2.1.0 schema (extends the v0.2.3 reporter tests).
2. **MULTI-01/02** (per-project CI merge + discovery guard) -- CI-only, reuses two existing patterns.
3. **PROOF-01/02** (contract check) -- turns the spike into a regression test; must land before GATE so the gate rests on a proven contract.
4. **GATE-01** (add to `ci`) then **GATE-02** (ruleset) -- **last**, gated on a live-verified planning-only-PR mitigation (Pitfall 1). Candidate short spike for the merge-protection-on-skipped-PR behavior before enabling the ruleset on the empty-bypass `main`.
5. **DOC-01** -- alongside RULE (the release PR's README/CHANGELOG).

---

## Sources

- Prior research (reused, HIGH): `scratchpad/sarif-multiproject-research.md` -- axes 1 (per-project categories), 2 (rule metadata/tags vs taxonomies), 5 (Scanned-files gap), incl. the 2025-07-21 multi-run-same-category rejection and the SARIF ingestion limits.
- Repo `.github/workflows/ci.yml` (HIGH, live) -- the `code-scanning` job (single-run `category: angular-typechecker` + fallow multi-run per-run `automationDetails.id`, fork-skip, `|| true` + non-empty guard), the `ci` aggregate that drops `'skipped'` from the fail set, the `changes`/`dorny/paths-filter` `predicate-quantifier: every` path-gating, and the `cve-lite` "intentionally a required gate" precedent.
- [Set code scanning merge protection -- GitHub Docs](https://docs.github.com/en/code-security/code-scanning/managing-your-code-scanning-configuration/set-code-scanning-merge-protection) (HIGH) -- ruleset setup, per-tool **Alerts** (None/Errors/Errors+Warnings/All) and **Security alerts** (None/Critical/High+/Medium+/All) thresholds, REST `code_scanning` rule.
- [Code scanning merge protection (concepts) -- GitHub Docs](https://docs.github.com/en/code-security/concepts/code-scanning/merge-protection) (HIGH) -- the three verbatim blocking conditions; alerts must be in the PR diff to block; no documented skipped-tool mitigation (-> Pitfall 1).
- [Troubleshooting required status checks -- GitHub Docs](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks) (HIGH) -- path-skipped workflow stays "Pending"/"Expected -- waiting for status"; skipped *job* reports success; merge_group trigger note.
- [community discussion #54877](https://github.com/orgs/community/discussions/54877), [#13690](https://github.com/orgs/community/discussions/13690) (MEDIUM) -- the path-filter deadlock and the "always-run the required job / gate in a step" workaround pattern.
- [REST API endpoints for code scanning -- GitHub Docs](https://docs.github.com/en/rest/code-scanning/code-scanning) and [Uploading a SARIF file to GitHub -- GitHub Docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) (HIGH) -- upload -> poll `sarifs/{id}` -> `analyses` (`application/sarif+json` -> `github/alertNumber`/`github/alertUrl`) -> `alerts?ref=&tool_name=`; ref determines PR-check vs Security-tab; fingerprint dedup; `security-events: write` / `security_events` scope.
- [SARIF support for code scanning -- GitHub Docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning) (HIGH) -- `automationDetails.id` semantics, supported property surface (tags supported; artifacts/taxonomies not), limits.
- [github.blog 2024-04-30 -- rulesets to prevent merges (beta)](https://github.blog/changelog/2024-04-30-code-scanning-now-allows-configuring-rulesets-to-prevent-pull-requests-from-being-merged-beta/) (MEDIUM) -- merge-protection ruleset origin/intent.
