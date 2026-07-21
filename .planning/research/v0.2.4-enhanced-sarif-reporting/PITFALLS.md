# Domain Pitfalls -- v0.2.4 Enhanced SARIF reporting for GitHub Code Scanning

**Domain:** adding per-project SARIF categories + diagnostic-family rule metadata + Code Scanning result-gating + an automated CI proof to an already-shipped SARIF reporter, in a hardened PR-only repo.
**Researched:** 2026-07-21
**Overall confidence:** HIGH (grounded in the shipped reporter code, the live ci.yml, the 2026-07-20 spike PR #53 evidence, GitHub docs, and the `node-sarif-builder` type surface).

Pitfalls are ranked by risk. The two most likely to bite are **P1 (planning-PR deadlock)** and **P2 (release discipline)** -- both are near-certain to fire if not designed around up front.

---

## Critical Pitfalls

### P1 -- "Require code scanning results" DEADLOCKS planning-only PRs (highest risk)

**Owning requirement:** GATE-02. **Suggested phase:** the gating phase, and it MUST be enabled last (after MULTI/RULE ship and produce analyses).

**What goes wrong:** GitHub's "Require code scanning results" ruleset blocks a merge when a required tool's analysis is **missing, not configured, or still in progress** -- not only when it finds alerts (confirmed in GitHub docs, "Set code scanning merge protection"). `~58%` of this repo's PRs are `.planning/`-only, and the `code-scanning` job is path-gated (`if: needs.changes.outputs.code != 'false'`) -> on a planning-only PR the job SKIPS -> no SARIF is uploaded for that commit -> the required tool has **no analysis on that PR ref** -> the ruleset blocks the merge button. On `main` with an empty-bypass ruleset (AGENTS.md) even the owner cannot override -> total lockout.

**Why the repo's existing trick does NOT save you:** the `changes` path-gate + skip-tolerant `ci` aggregate (D-08) solves the *status-check* deadlock (a required named check that never reports). "Require code scanning results" is a **separate GitHub mechanism** evaluated against whether an analysis exists for the tool on the ref -- it does not read the `ci` status check. Making `code-scanning` a member of `ci` (GATE-01) does not help GATE-02 at all; they are orthogonal gates.

**Warning sign:** a planning-only or docs-only PR shows "Code scanning results / <tool> -- Waiting for results" or "missing analysis" and the merge button stays disabled; closing/reopening the PR does not clear it (there is no code to re-scan).

**Prevention (do all three):**
1. **Enable the ruleset in Evaluate mode FIRST** (GitHub's own recommended de-risking -- it records would-be blocks without blocking). Push a deliberate `.planning/`-only probe PR and confirm in Ruleset Insights whether it would be blocked BEFORE flipping to Active. This is the single most important step.
2. **Guarantee an analysis on every PR ref for each required tool.** The robust fix is to STOP path-gating the SARIF upload for the required tools -- the `code-scanning` job (or at minimum its upload steps) must run and upload a valid SARIF on planning-only PRs too, so the analysis always exists. (Cost: `npm ci` + `nx build` + one CLI run on planning PRs -- acceptable; it is one Linux job, not the OS x Node matrix.) A clean tree still produces a valid, empty-results SARIF, which satisfies "analysis exists" with zero alerts.
3. **Know the recovery path** (AGENTS.md "Lockout recovery"): if the ruleset locks the button, toggle the ruleset `enforcement` to `disabled`, merge the fix, re-enable. Do NOT add a standing bypass actor.

**Do NOT** try to solve this with `on: paths-ignore` (makes the check never report -> the other deadlock class) or by scoping the ruleset by changed-file path (rulesets cannot path-filter merge protection by diff).

**Fork-PR corollary:** fork PRs get a read-only token, so the upload steps are already gated to skip forks (ci.yml:589,599) -> a fork PR also produces no analysis -> the same ruleset would block it. Low practical impact here (no external contributors; maintainer self-merges), but note it: a future external contributor's PR would deadlock. Prevention 2 does not fix forks (token is read-only); accept that fork PRs need a maintainer-side re-run or the ruleset toggle.

---

### P2 -- Release discipline: only the rule-metadata change may bump the version

**Owning requirement:** RULE-01..04 (the sole release-bearing change). **Suggested phase:** the rule-metadata phase, plus the release phase.

**What goes wrong:** v0.2.4 mixes ONE published-artifact change (diagnostic-family rule metadata in the SARIF reporter) with several CI/ruleset/docs-only changes (MULTI per-project categories, GATE gating, PROOF harness, DOC). The published version must bump ONLY for the rule-metadata change (PROJECT.md + REQUIREMENTS RULE section). Two ways this goes wrong:
- **The CI-only work accidentally becomes release-bearing.** `nx release` conventional-commits derives the bump from commits whose **files** touch `packages/angular-typechecker/` (AGENTS.md). The per-project (MULTI) feature is tempting to implement by widening the reporter to emit multiple runs / accept a `category` -- that edits `sarif-report.ts`, making MULTI release-bearing AND risking a non-additive SARIF-shape change. Keep MULTI **entirely in CI**: run the CLI per discovered project (each a single-run SARIF), then merge + inject per-run `automationDetails.id` in a node post-process step -- exactly mirroring the existing fallow post-process (ci.yml:582-583). The reporter stays a pure single-run `(CoreResult) => string`.
- **The additive audit is skipped or fails.** Every prior milestone did a byte-for-byte git-diff audit of the published tarball vs the prior version (e.g. `32-ADDITIVE-AUDIT.md` vs `@0.2.3`). v0.2.4's published diff vs `@0.2.3` must be ONLY the rule-metadata additions (tags + level + help + the new TS/template/ATC catalog rows). CI workflow, ruleset config, the proof fixture, and README are NOT in the package `files` allowlist, so they must not appear in the tarball diff at all.

**Warning sign:** `npx nx release --dry-run` proposes a bump for a commit that only touched `.github/` or docs; or the additive audit shows non-catalog changes in `src/`.

**Prevention:**
- Scope commits so `sarif-report.ts` / `extended-catalog.ts` (+ the new family catalog data) change in `feat`/`fix`-typed commits, and CI/ruleset/proof/docs change in `ci`/`docs`/`chore`-typed commits that do NOT touch package files.
- Under 0.x, `feat` -> **patch** (0.2.3 -> 0.2.4); no breaking change here. Confirm with `npx nx release --dry-run` (unified command, never `nx release version`); check `git log` for any stray `!`/`BREAKING CHANGE` before cutting (release-mechanics memory).
- Run the additive git-diff audit vs `@0.2.3` as an explicit gate before the Release PR.
- Follow the Release-PR flow (AGENTS.md): branch off `main`, `nx release --skip-publish` (no tag, no push), curate `CHANGELOG.md` (consumer language, no plan-id scopes), PR, self-merge as a merge commit, tag the merge commit `angular-typechecker@0.2.4`, push tag to fire release.yml.

---

## Moderate Pitfalls

### P3 -- `node-sarif-builder.initSimple` cannot express tags, level, or help

**Owning requirement:** RULE-02 (tags), RULE-03 (level), RULE-04 (help).

**What goes wrong:** the shipped reporter builds rules with `new SarifRuleBuilder().initSimple({ ruleId, shortDescriptionText, helpUri })`. Verified from the type surface, `SarifRuleBuilder.initSimple` accepts ONLY `{ ruleId, shortDescriptionText, fullDescriptionText?, helpUri? }` -- there is **no** parameter for `help` (help.text/markdown), `properties.tags`, or `defaultConfiguration.level`. A plan that assumes "add tags/level/help via initSimple" will not compile / will silently emit none of them.

**Prevention:** set them on the raw `SarifRuleBuilder.rule` (a public `ReportingDescriptor`) AFTER `initSimple`, exactly as the reporter already does for `resultBuilder.result.partialFingerprints`:
```
const rb = new SarifRuleBuilder().initSimple({ ruleId, shortDescriptionText, helpUri });
rb.rule.defaultConfiguration = { level: 'warning' };          // RULE-03
rb.rule.properties = { tags: ['extended-diagnostics'] };      // RULE-02
rb.rule.help = { text: '...' };                               // RULE-04 (help, NOT helpUri)
```
`help` is a DIFFERENT field from `helpUri` -- GitHub's rule-help panel renders `help.text`/`help.markdown`; `helpUri` alone leaves "No rule help available" (proven, spike PR #53). Keep the existing `helpUri` too.

### P4 -- Family tags are per-RULE; a shared `TSxxxx` ruleId cannot carry two families

**Owning requirement:** RULE-02; deferral is RULE-FUT-01.

**What goes wrong:** GitHub's `tag:` filter keys off the **rule's** `tags[]` (`rule.tags` via the REST API), not per-result properties. angular-typechecker emits ONE rule per `ruleId` (== diagnostic code). But a TypeScript code is ambiguous by origin: the spike proved `TS2551` fires both in a `.ts` file (real TypeScript) AND in a `.html` template (template type-check). You literally cannot tag the single `TS2551` rule as both `typescript` and `template-type-check`. Setting the family on the result (`result.properties.tags`) does NOT power the `tag:` filter, so it does not satisfy RULE-02.

**Prevention -- coarse per-rule family by code, precision deferred (matches RULE-FUT-01):**
- `NG8xxx` extended-enum members (the 18) -> `extended-diagnostics`.
- other `NG####` template compiler codes (e.g. NG8002) -> `template-type-check`.
- `ATC900x` tool codes -> `tool`.
- all `TS####` -> `typescript` (accept that template-origin TS diagnostics are grouped under `typescript`).
Do NOT synthesize per-family rule ids (e.g. `TS2551@template`) to disambiguate -- it breaks the `ruleId === code` contract, fragments alert baselines, and over-engineers. Per-occurrence precision (file-extension / template-origin heuristic) is explicitly deferred to RULE-FUT-01 "unless a coarse file-extension heuristic proves insufficient."

### P5 -- Multi-run SARIF rejection when angular-typechecker becomes multi-run

**Owning requirement:** MULTI-01.

**What goes wrong:** GitHub Code Scanning (2025-07-21+) REJECTS a delivery with multiple runs that share one category: `"The CodeQL Action does not support uploading multiple SARIF runs with the same category."` Today angular-typechecker uploads a SINGLE run with `category: angular-typechecker` (ci.yml:593). When MULTI-01 merges per-project runs into one file, leaving that `category:` input on a now-multi-run file re-triggers the rejection (this is exactly the bug fallow already hit -- ci-sarif-code-scanning-dogfood memory).

**Prevention:** when the angular-typechecker upload becomes multi-run, give each run a distinct `automationDetails.id` (`angular-typecheck/<project>`) in a post-process step and upload **WITHOUT** the `category` input -- the per-run id becomes the category. Copy the fallow pattern verbatim (ci.yml:582-583 sets `automationDetails.id` then uploads with no `category`). The per-run id, not `category`, is what GitHub uses (SARIF `automationDetails.id` wins over the action's `category` input).

**Warning sign:** upload step fails with the "multiple runs with the same category" server error. Reminder (meta-lesson from the memory): this is only catchable in **real CI** -- local schema validation, actionlint, and act-compat all pass while GitHub still rejects. Verify via `gh api .../code-scanning/analyses?tool_name=angular-typechecker&ref=refs/pull/<n>/merge` on the PR.

### P6 -- Automated PROOF flakiness: PR-ref scoping + upload->queryable latency

**Owning requirement:** PROOF-01, PROOF-02.

**What goes wrong (three distinct traps):**
1. **Wrong ref.** Alerts uploaded on a PR are scoped to `refs/pull/<n>/merge`, NOT the default `branch:main` view (proven, spike). Querying the default alerts view or `branch:main` returns nothing and the proof falsely fails.
2. **Eventual consistency.** `gh api .../code-scanning/analyses` (or `/alerts`) immediately after `upload-sarif` may not yet show the analysis -- there is a processing/propagation delay. `upload-sarif`'s `wait-for-processing` (default true) helps, but it **gives up silently on timeout (continues, does not fail)** -- so you cannot rely on it alone.
3. **Non-deterministic assertion.** Asserting an exact alert COUNT is brittle if the fixture picks up an incidental diagnostic.

**Prevention:**
- Query the PR ref explicitly: `gh api repos/LayZeeDK/angular-typechecker/code-scanning/analyses?ref=refs/pull/<n>/merge` (or `/alerts?ref=...`). Filter by `tool_name` and/or the analysis `category`.
- After `upload-sarif` (keep `wait-for-processing: true`), **poll the analyses/alerts API yourself with bounded retries + backoff** until the expected analysis appears or a timeout -- do not assert once. Correlate on the returned `sarif_id` if possible.
- Assert **set-membership** of the expected `(ruleId, tag, severity, category)` tuples (each expected alert is PRESENT), and fail loudly (PROOF-02) if any is missing -- not an exact total count. Pin the fixture to emit EXACTLY one known diagnostic per family so membership is stable.
- Run the fixture OUTSIDE the normal `nx typecheck` gate (isolated fixture) so its deliberate errors never fail the real merge gate, and upload it under a distinct tool name / category so it does not pollute the dogfood analysis or main's baseline (PR-ref scoping already keeps it off main).

---

## Minor Pitfalls

### P7 -- GATE-01 fail-open generation defeats the "upload succeeded" gate

**Owning requirement:** GATE-01.

**What goes wrong:** the `code-scanning` job tolerates generation failures with `|| true` and gates upload on a non-empty file (`produced`), by design so an infra exit-2 (empty SARIF) does not feed `upload-sarif` an invalid file. Once `code-scanning` is a required member of `ci` (GATE-01), a reporter regression that emits an empty/invalid SARIF would set `produced=false`, skip the upload, and leave the job GREEN -- so GATE-01 gates only "the job did not crash," not "a valid SARIF was produced and accepted."

**Prevention:** decide GATE-01's contract explicitly. If GATE-01 should mean "a valid analysis was uploaded," add an assertion that `produced == 'true'` (for non-fork, non-planning PRs) fails the job when generation silently produced nothing. Otherwise document that GATE-01 gates job health only and the real diagnostic gate stays `test`'s `nx typecheck` (this is the existing stated design -- Out of Scope table: "code-scanning job stays a reporting/upload gate," findings already gate via `test`). Do not accidentally duplicate findings-gating in `code-scanning`.

### P8 -- MULTI-02 auto-discovery can silently drift

**Owning requirement:** MULTI-02.

**What goes wrong:** the reported project set is auto-discovered (projects with the `angular-typechecker:typecheck` target). A discovery bug that silently drops a project produces fewer analyses with no error -- the same silent-skip class the repo already guards elsewhere (GUARD-01/01b set-equality for e2e projects).

**Prevention:** reuse the established pattern -- a set-equality guard asserting the discovered project set equals the actual set of projects declaring the target (a `nx show projects`-style enumeration), turning a dropped project into a loud CI failure. Model it on `tools/ci/list-e2e-projects.mjs` + GUARD-01b.

### P9 -- SARIF ingestion limits (far away, but know the ceiling)

**Owning requirement:** MULTI-01; escape hatch MULTI-FUT-01.

Limits: 10 MB gzip/file, **20 runs/file**, 25k results/run (top 5k ingested), 20 tags/rule (truncated to 10). At ~4 self-hosting projects every ceiling is far off. The only realistic future constraint is 20 runs/file if the workspace grows past ~20 self-hosting projects -- MULTI-FUT-01 already scopes the migration to a per-project matrix (one file per job) at that point. `ponytail:` do not build the matrix now; one merged multi-run file is correct at this scale.

### P10 -- "Scanned files" panel is not SARIF-fixable (do not chase)

**Owning requirement:** DOC-01.

The tool-status "Scanned files" panel is CodeQL-internal per-language telemetry; third-party SARIF cannot populate it (proven: emitting `run.artifacts` with `roles:["analysisTarget"]` left it unchanged, spike PR #53). Do NOT emit `run.artifacts` (Out of Scope: inert bytes). Document it in-repo as a known GitHub product gap with the spike evidence (DOC-01). Per user rule, do NOT file a GitHub Issue on the maintainer's behalf.

---

## Repo-Specific Warnings

- **`main` is PR-only with an empty-bypass ruleset.** Enabling "Require code scanning results" adds a SECOND hard gate the owner cannot bypass. Combined with P1 this can lock out ALL merges (including the fix). Enable in Evaluate mode first; know the `enforcement: disabled` recovery toggle.
- **Namespaced research.** v0.2.4 research lives in `.planning/research/v0.2.4-enhanced-sarif-reporting/`. Do NOT write to or clobber the foundational root `.planning/research/*.md` (STACK/FEATURES/etc. that feed CLAUDE.md).
- **No GitHub Issues on the user's behalf** (covers the P10 "Scanned files" limitation -- document in-repo, do not file).
- **SHA-pin every action in ci.yml.** Any new action added for the PROOF job must be a full 40-char commit SHA with a `# vX.Y.Z` comment (Dependabot keeps them fresh), matching the top-of-file threat model. Prefer `gh` CLI (`gh api`) for the proof assertions over a new marketplace action -- fewer new pinned dependencies.
- **`gh api` proof queries must use the repo's real owner/name** `LayZeeDK/angular-typechecker` and the `refs/pull/<n>/merge` ref, per the spike-verified command shape.

---

## Phase-Specific Warnings (for the roadmapper)

| Phase topic | Likely pitfall | Mitigation |
|-------------|----------------|------------|
| Rule metadata (RULE-01..04, release-bearing) | P3 (initSimple can't set tags/level/help), P4 (per-rule family ambiguity for TS codes) | Set raw `.rule` fields; coarse family-by-code, defer precision to RULE-FUT-01 |
| Per-project categories (MULTI, CI-only) | P2 (do it in the reporter -> release-bearing), P5 (multi-run + category rejection), P8 (silent discovery drift) | Merge + inject `automationDetails.id` in CI post-process; drop `category` input; set-equality guard |
| Gating (GATE-01 aggregate) | P7 (fail-open generation defeats the gate) | Decide/assert the `produced==true` contract or document reporting-only |
| Gating (GATE-02 ruleset) -- HIGHEST RISK | P1 (planning-PR + fork-PR deadlock) | Evaluate mode first; always-upload for required tools; know the recovery toggle; enable LAST |
| Automated proof (PROOF) | P6 (PR-ref scoping, eventual-consistency latency, brittle count assertions) | Query `refs/pull/<n>/merge`, poll with backoff, assert set-membership |
| Docs (DOC-01) | P10 (chasing an unfixable panel) | Document the gap + spike evidence; no `run.artifacts`; no Issue |
| Release | P2 (accidental bump, skipped additive audit) | Scope commits; `nx release --dry-run`; additive git-diff audit vs `@0.2.3`; Release-PR flow |

## Sources

- GitHub Docs, "Set code scanning merge protection" -- HIGH: merge blocked when a required tool's analysis is missing/unconfigured/in-progress; Evaluate mode recommended before Active. https://docs.github.com/en/code-security/code-scanning/managing-your-code-scanning-configuration/set-code-scanning-merge-protection
- GitHub community discussion #159026 ("Code scanning is waiting for results from CodeQL") -- MEDIUM: real-world stuck-PR reports corroborating the missing-analysis block. https://github.com/orgs/community/discussions/159026
- `codeql-action` `upload-sarif/action.yml` + `src/upload-lib.ts` -- HIGH: `wait-for-processing` polls then continues (does not fail) on timeout; processing is eventually consistent. https://github.com/github/codeql-action/blob/main/src/upload-lib.ts
- Repo memory `code-scanning-sarif-empirical-behavior.md` + `ci-sarif-code-scanning-dogfood.md` (spike PR #53, PR #49) -- HIGH: tags/`help`/per-run categories verified live; PR-ref scoping (`refs/pull/<n>/merge`); multi-run-same-category rejection; "Scanned files" is a CodeQL-only gap; SARIF upload correctness only provable in real CI.
- Shipped reporter `packages/angular-typechecker/src/core/sarif-report.ts` + `extended-catalog.ts` -- HIGH: single-run, 18 NG8xxx cataloged, `helpUri` only, no tags/level/help, raw-object pattern already used for `partialFingerprints`.
- `node_modules/node-sarif-builder/dist/lib/sarif-rule-builder.d.ts` + `sarif-run-builder.d.ts` -- HIGH: `initSimple` supports only ruleId/shortDescription/fullDescription/helpUri (rule) and toolDriverName/version/url (run); tags/level/help/automationDetails need raw `.rule`/`.run` access.
- Scratchpad `sarif-multiproject-research.md` -- HIGH: run/file topology, 2025-07-21 change + exact error, ingestion limits table, per-project = category / per-family = rule-tag recommendation.
- Repo `.github/workflows/ci.yml` -- HIGH: the `changes` path-gate, the `ci` skip-tolerant aggregate (D-08), the existing `code-scanning` job (fork-skip, `produced` guard, fallow `automationDetails.id` post-process), SHA-pinned actions.
- Repo `AGENTS.md` -- HIGH: PR-only empty-bypass `main`, lockout recovery, `nx release` 0.x bump derivation by changed files, Release-PR flow, additive-audit expectation.
