# Technology Stack -- v0.2.4 Enhanced SARIF reporting for GitHub Code Scanning

**Project:** angular-typechecker
**Researched:** 2026-07-21
**Scope:** narrow, additive milestone. NO new runtime dependency. Everything below either
already ships (`node-sarif-builder@4.1.0`) or is CI/ruleset plumbing (GitHub Actions +
`gh`). Confidence: HIGH (library facts verified against installed `node_modules`; GitHub
facts against current docs / the merged `code-scanning` job / the closed PR #53 spike).

## TL;DR for the roadmapper + planner

- **No new package.** `node-sarif-builder@4.1.0` + its bundled `@types/sarif@2.1.7` already
  installed already type-check the four field additions we need. `tags` / `defaultConfiguration.level`
  / `help` / `automationDetails.id` have **no `initSimple`/setter** -- you set them by
  **mutating the public `.rule` / `.run` object**, the exact escape hatch the reporter
  already uses for `resultBuilder.result.partialFingerprints` (`sarif-report.ts:112`).
- **Only the rule-metadata change (RULE-01..04) touches the published reporter.** MULTI
  (per-project runs + `automationDetails.id`), GATE, and PROOF are CI/ruleset-only -- do
  them as a `gh`/`node -e` CI merge step mirroring the existing `fallow` step in `ci.yml`,
  NOT in the shipped `formatSarifReport`.
- **GATE-02 is the one real trap:** GitHub merge protection is **independent of status
  checks** and blocks a PR when the required tool's analysis is *missing/in-progress/not
  configured* -- so a planning-only PR that path-skips the `code-scanning` job WILL be
  blocked waiting for angular-typechecker results. Mitigation below.

---

## 1. `node-sarif-builder` capability audit (installed v4.1.0)

Verified by reading `node_modules/node-sarif-builder/dist/lib/*.js` + `.d.ts` and
`node_modules/@types/sarif/index.d.ts` (v2.1.7).

### What `initSimple` / setters expose (the "easy" surface)

| Builder | `initSimple` keys | Setters |
|---------|-------------------|---------|
| `SarifRuleBuilder` | `ruleId`, `shortDescriptionText`, `fullDescriptionText?`, `helpUri?` | `setRuleId`, `setShortDescriptionText`, `setFullDescriptionText`, `setHelpUri` |
| `SarifResultBuilder` | `level`, `messageText`, `ruleId`, `fileUri?`, `startLine?`, `startColumn?`, `endLine?`, `endColumn?` | `setLevel`, `setMessageText`, `setRuleId`, `setLocationRegion`, `setLocationArtifactUri` |
| `SarifRunBuilder` | `toolDriverName`, `toolDriverVersion`, `url?` | `setToolDriverName`, `setToolDriverVersion`, `setToolDriverUri` |

**None of the four v0.2.4 fields (`properties.tags`, `defaultConfiguration.level`, `help`,
`automationDetails.id`) has a builder method.** Confirmed: `SarifRuleBuilder` only writes
`id`/`shortDescription`/`fullDescription`/`helpUri`; `SarifRunBuilder` only writes
`tool.driver.{name,version,informationUri}` + empty `rules[]`/`results[]`.

### The supported way: mutate the public builder object

Each builder exposes its underlying `sarif` object as a **public, typed** property:
`SarifRuleBuilder.rule: ReportingDescriptor`, `SarifResultBuilder.result: Result`,
`SarifRunBuilder.run: Run`. Mutating it directly is the library's own idiom and is already
how this repo sets `partialFingerprints`. All four target fields are optional members of
the bundled `@types/sarif` types, so the mutations **type-check with zero casts**:

```ts
// RULE-02 tags + RULE-03 level + RULE-04 help, per catalog rule:
const rb = new SarifRuleBuilder().initSimple({
  ruleId: 'NG' + entry.ngCode,
  shortDescriptionText: entry.shortDescription,
  helpUri: HELP_URI_BASE + entry.ngCode,        // helpUri stays (RULE-04 ADDS help, keeps helpUri)
});
rb.rule.properties = { tags: ['extended-diagnostics'] };          // PropertyBag.tags?: string[]
rb.rule.defaultConfiguration = { level: 'warning' };              // ReportingConfiguration.level
rb.rule.help = { text: entry.shortDescription /*, markdown?: ... */ }; // MultiformatMessageString (text required, markdown optional)
runBuilder.addRule(rb);

// MULTI-01 per-run category (CI merge only -- NOT the shipped reporter, see s.4):
runBuilder.run.automationDetails = { id: 'angular-typecheck/' + project }; // RunAutomationDetails.id
```

Type facts (from `@types/sarif@2.1.7/index.d.ts`):
- `ReportingDescriptor.properties?: PropertyBag`, `PropertyBag.tags?: string[]`.
- `ReportingDescriptor.defaultConfiguration?: ReportingConfiguration`; `ReportingConfiguration.level?: "none"|"note"|"warning"|"error"`.
- `ReportingDescriptor.help?: MultiformatMessageString` = `{ text: string (required); markdown?: string }`. (`help.text` / `help.markdown` -- this is what lights the alert rule-help panel, NOT `helpUri`, per PR #53.)
- `Run.automationDetails?: RunAutomationDetails`; `RunAutomationDetails.id?: string`.

### These mutations SURVIVE `buildSarifJsonString()` (verified)

`SarifBuilder.buildSarifJsonString()` runs `completeRunFields()` first
(`sarif-builder.js:69-78`). `completeRunFields` **only** touches `run.artifacts`,
`result.ruleIndex`, and `location.physicalLocation.artifactLocation.index`. It never reads
or overwrites `automationDetails`, rule `properties`/`defaultConfiguration`/`help`, so the
mutations pass through untouched. It throws if any `SARIF_BUILDER_INVALID` placeholder
survives -- so every rule you add MUST get a real `ruleId` + `shortDescriptionText`.

### Two behaviors of v4.1.0 that contradict stale comments in the current reporter (flag to planner)

`sarif-report.ts`'s module header claims "no `ruleIndex` is emitted" and the codebase
treats `run.artifacts` as never-emitted. **Both are false with the installed v4.1.0** --
`completeRunFields` (verified in `sarif-builder.js:79-137`):
- **Auto-populates `run.artifacts[]`** (one entry per distinct result URI, with a guessed
  `sourceLanguage`). So the SHIPPED v0.2.3 SARIF *already contains* `run.artifacts[]`. The
  REQUIREMENTS "Out of Scope: emitting `run.artifacts`" is therefore not something we add --
  it is the library's default and is inert (does not populate the Scanned-files panel, per
  DOC-01). Do **not** write a test asserting "no artifacts" -- it would fail. Leave them.
- **Auto-sets `result.ruleIndex`** for any result whose `ruleId` matches an added rule.
  Once RULE-01 adds a rule for every emitted code, every result gains a valid `ruleIndex` --
  harmless and correct SARIF. The header comment should be corrected (not load-bearing).

---

## 2. RULE-01..04 shape (the one release-bearing change)

Today the reporter adds only the **18 NG8xxx** catalog rules (with `shortDescription` +
`helpUri`, no tags/level/help). TS#### and ATC900x results carry a `ruleId` with **no rule
object** -> blank alert description (RULE-01 gap).

**Recommended approach -- catalog the codes that actually appear, not all of TypeScript:**
- Collect the **distinct `record.code`** set from `result.diagnostics` (dedupe by code).
- For each distinct code, `addRule` once with family-derived metadata:
  - `code.startsWith('NG')` -> tag `extended-diagnostics`; reuse `EXTENDED_DIAGNOSTIC_CATALOG`
    for `shortDescription` + `help.text` + `helpUri` (angular.dev). (All 18 NG codes are in
    the catalog already.)
  - `code.startsWith('ATC')` -> tag `tool`; a tiny fixed catalog (e.g. `ATC90001` = the
    synthesized out-of-project reference-resolution error). Small, closed set.
  - `code.startsWith('TS')` -> tag `typescript`; `shortDescription`/`help` can be generic
    ("TypeScript compiler diagnostic <code>") since TS has thousands of codes and no
    shippable per-code catalog. `helpUri` optional.
- `defaultConfiguration.level`: derive from the observed severity of the diagnostics
  carrying that code via the existing `toSarifLevel` (error wins on disagreement). This is a
  per-rule field; per-diagnostic `level` on the result stays as today.

**RULE-02 family tag caveat (already deferred as RULE-FUT-01):** template-type-check errors
surface as `TS####` codes originating in templates -- indistinguishable from ordinary
TypeScript by the code alone. So the coarse mapping is `NG8xxx -> extended-diagnostics`,
`TS#### -> typescript`, `ATC -> tool`; a precise `template-type-check` tag needs the
diagnostic's origin and is **out of scope** (RULE-FUT-01). Ship the coarse 3-way tagging;
note the `template-type-check` family may be under-represented.

**Limits (all far away for this repo)** -- max **20 tags per rule** (truncated to 10), 25,000
rules/run, 25,000 results/run.
[Source: SARIF results limits](https://docs.github.com/en/code-security/code-scanning/troubleshooting-sarif-uploads/results-exceed-limit)

---

## 3. `github/codeql-action/upload-sarif@v4` inputs (currently pinned v4.37.1 in `ci.yml`)

Verified against `action.yml` on the `v4` branch.

| Input | Default | Relevant fact |
|-------|---------|---------------|
| `sarif_file` | `../results` | File **or directory** of `.sarif`/`.sarif.json`. Our merged single file works; a directory upload requires each file carry a distinct `automationDetails.id`. |
| `category` | (none) | "String used by Code Scanning for matching the analyses." Written as `run.automationDetails.id` -- **but a value already in the SARIF wins.** OMIT it for the multi-run merged file (per-run `automationDetails.id` becomes each run's category); passing one `category` would flatten all runs to one category and re-trigger the 2025-07-21 multi-run-same-category rejection. |
| `wait-for-processing` | `true` | Blocks the step until the SARIF is processed -- so a subsequent `gh api` analyses/alerts query (PROOF) can rely on the analysis existing. Keep default `true`. |
| `checkout_path` | `${{ github.workspace }}` | Relativizes absolute paths in the SARIF. angular-typechecker already emits repo-relative URIs and the CLI runs from repo root, so leave default. |
| `ref` / `sha` | `GITHUB_REF`/`GITHUB_SHA` | Ignored for fork PRs. For a PR the ref is `refs/pull/<n>/merge`. Only set explicitly for out-of-band uploads (the PROOF fixture may want its own ref). |
| `token` | `${{ github.token }}` | Upload needs **`security-events: write`** (already granted job-level in the `code-scanning` job). |

The `code-scanning` job already implements the merged-multi-run pattern for `fallow` (a
`node -e` that sets `run.automationDetails = {id: "fallow/"+i}` then uploads WITHOUT
`category`). **Reuse that exact pattern for angular-typechecker's per-project runs (MULTI-01).**
[Source: upload-sarif action.yml (v4)](https://github.com/github/codeql-action/blob/v4/upload-sarif/action.yml); [Uploading a SARIF file](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github)

---

## 4. MULTI-01/02 -- how per-project runs get built (CI-only, no release)

The shipped `formatSarifReport` is a **pure function over ONE `CoreResult`** (one project's
type-check) and emits **one run**. It does not know about sibling projects and must NOT gain
that knowledge -- MULTI is CI orchestration, not a reporter change. Two viable shapes:

- **Recommended (lazy, matches `fallow`): per-project generate + `node -e` merge.** Discover
  projects (MULTI-02), run the CLI/executor `--format sarif` per project into per-project
  files, then a merge step concatenates `runs[]` into one file, setting each run's
  `automationDetails.id = angular-typecheck/<project>`, single `upload-sarif`, no `category`.
  Each per-project file is already a complete SARIF (its own `completeRunFields` ran), so the
  merge is pure JSON array concat + the id write -- byte-for-byte the fallow idiom.
- **Discovery (MULTI-02):** the repo already has `tools/ci/list-e2e-projects.mjs` +
  GUARD-01b (set-equality guard) as the precedent for "auto-discover a project set + guard it
  cannot drift." Mirror it: discover projects whose `project.json` declares the
  `angular-typechecker:typecheck` target (e.g. `nx show projects --with-target typecheck` or a
  small `node` graph read), and add a GUARD-01-style set-equality test so a newly-onboarded
  project is covered with no CI edit and a dropped one is dropped.

Do **not** add a per-project SARIF matrix now (MULTI-FUT-01 defers that to "past a handful of
projects"); one merged file with N runs is well under the **20-runs-per-file** cap.

Prevailing-convention + category-semantics background is already captured in
`scratchpad/sarif-multiproject-research.md` (reuse it; the per-project-run / rule-tag split it
recommends is exactly MULTI + RULE here).

---

## 5. PROOF-01/02 -- `gh` CLI / REST for the automated assertion (CI-only)

Verified query params + response fields against the REST code-scanning docs.

**Endpoints (both `GET`, both usable via `gh api`):**
- `GET /repos/{owner}/{repo}/code-scanning/analyses` -- params incl. `tool_name`, `tool_guid`,
  `ref`, `sarif_id`, `pr`, `sort`, `direction`, `per_page`. Use to confirm the analysis for a
  ref/tool exists (and read its `category`).
- `GET /repos/{owner}/{repo}/code-scanning/alerts` -- params incl. `tool_name`, `ref`, `pr`,
  `state`, `severity`, `sort`, `per_page`. Each alert carries **`rule.id`, `rule.tags`,
  `rule.severity`, `rule.security_severity_level`, `rule.help`, `rule.help_uri`** and
  **`most_recent_instance.{category, ref, state, analysis_key}`** -- i.e. every field the
  proof must assert (category + tags + severity).

**Example proof assertions:**
```bash
# analysis landed for the proof ref+tool:
gh api "repos/$OWNER/$REPO/code-scanning/analyses?tool_name=angular-typechecker&ref=$REF" \
  --jq '.[].category'          # expect angular-typecheck/<project> (or the proof category)
# per-family alert has the right tag + level:
gh api "repos/$OWNER/$REPO/code-scanning/alerts?tool_name=angular-typechecker&ref=$REF" \
  --jq '.[] | {rule: .rule.id, tags: .rule.tags, sev: .rule.severity, cat: .most_recent_instance.category}'
```

**Token scope:** reading these on this **public** repo needs `security_events` scope (or
`public_repo`); in Actions set job-level **`permissions: security-events: read`** (distinct
from the upload job's `write`). [Source: REST code-scanning](https://docs.github.com/en/rest/code-scanning/code-scanning)

**Eventual consistency (do NOT assume instant):**
- `upload-sarif` returns a `sarif-id` output. `GET /code-scanning/sarifs/{sarif_id}` reports
  `processing_status` (`pending`/`complete`/`failed`) + `analyses_url` -- the deterministic
  handle to wait on. `wait-for-processing: true` already blocks the upload step until
  processed, but the alerts index can still lag processing by seconds.
- **The proof must poll with bounded retries** (query analyses/alerts a few times with a short
  sleep) rather than a single immediate read. Filter by `ref` = the exact ref uploaded (for a
  PR that is `refs/pull/<n>/merge` unless the proof uploads under its own explicit `ref`).
- **Isolation:** PROOF-01 wants the one-per-family fixture "outside the normal typecheck gate."
  Upload it under a **distinct `ref` or `category`** (e.g. a dedicated proof ref) so its
  synthetic alerts are filterable and never mixed with the real dogfood analysis. Optionally
  clean up with `DELETE /code-scanning/analyses/{analysis_id}` (needs `security-events: write`).

---

## 6. GATE-01 vs GATE-02 -- two DIFFERENT gates (do not conflate)

**GATE-01 (status check):** add `code-scanning` to the `ci` aggregate's `needs`. This works
with the existing aggregate logic -- `ci` already drops `'skipped'` from its fail set, so a
path-skipped `code-scanning` on a planning-only PR still reports green. GATE-01 only asserts
"the dogfood upload job ran (or legitimately skipped)"; it does NOT assert alerts landed
(that is PROOF). Low risk.

**GATE-02 (merge protection ruleset) -- the load-bearing constraint:**
- Configured in a **repository ruleset** (Settings -> Rules -> Rulesets -> branch ruleset ->
  "Require code scanning results"), **not** classic branch protection and **not** the
  status-check list. Per tool you set an **Alerts threshold** (`None`/`Errors`/`Errors and
  Warnings`/`All`) and a **Security alerts threshold** (`None`/`Critical`/`High or higher`/
  `Medium or higher`/`All`). Add `angular-typechecker` + `fallow` as required tools.
- **It is independent of status checks and blocks a PR when ANY of:** (1) a required tool
  finds an alert at/above the threshold, (2) a required tool's analysis is **still in
  progress**, or (3) **a required tool is not configured / did not produce results** for the
  PR. Also: an alert only blocks if all its lines exist in the PR diff.
- **Therefore the planning-only-PR deadlock is real:** the `code-scanning` job is currently
  path-gated (`if: needs.changes.outputs.code != 'false'`), so a `.planning/`-only PR skips
  the upload -> no angular-typechecker analysis for that PR ref -> condition (3) blocks the
  merge, and the `ci`-aggregate always-report trick does NOT save it (merge protection is
  independent of status checks).
- **Exclusions that do NOT help here:** the rule is skipped only for merge-queue groups and
  Dependabot default-setup PRs -- not for ordinary planning PRs.

**Mitigation options for GATE-02 (recommend A):**
- **A (lazy + robust): stop path-gating the `code-scanning` job so every PR to `main` uploads
  an analysis.** A planning-only PR changes no code, so angular-typechecker re-runs on the
  unchanged app and uploads the same (clean) analysis -> condition (3) never fires. Cost: the
  build + one CLI run on the ~58%-planning-only PRs (cheap: small `@nx/js:tsc` lib + one
  `performCompilation`). This is the simplest guaranteed non-deadlock.
- **B:** keep the path-gate but add a tiny always-run step that uploads a minimal/clean SARIF
  on planning-only PRs so an analysis always exists. More moving parts than A for no real gain.
- **C (verify live, do not assume):** GitHub *may* reuse the base-branch analysis when a PR
  changes no analyzable files -- the PR #53 spike did NOT test the planning-only-PR x
  merge-protection interaction, so treat "GitHub auto-satisfies it" as UNVERIFIED. If a phase
  wants to rely on it, prove it on a throwaway planning-only PR before enabling the ruleset on
  `main`.

**Fork-PR caveat (document, don't solve):** the `code-scanning` job already skips the *upload*
on fork PRs (read-only fork token). A fork PR would then hit condition (3). This repo is
single-maintainer with a PR-only, empty-bypass `main`; handle fork PRs by the ruleset-
enforcement toggle already documented in AGENTS.md "Lockout recovery" rather than weakening the
rule. [Sources: [merge protection concept](https://docs.github.com/en/code-security/concepts/code-scanning/merge-protection); [set merge protection](https://docs.github.com/en/code-security/code-scanning/managing-your-code-scanning-configuration/set-code-scanning-merge-protection); [changelog 2024-04-30](https://github.blog/changelog/2024-04-30-code-scanning-now-allows-configuring-rulesets-to-prevent-pull-requests-from-being-merged-beta/)]

---

## 7. Integration with the existing reporter -- what changes, what stays

| Piece | Change? |
|-------|---------|
| `formatSarifReport` (pure `(CoreResult, ts, pathBase) -> string`) | ADD RULE-01..04 metadata (catalog every emitted code + mutate `.rule.properties/.defaultConfiguration/.help`). Stays pure, stays lazy-`import()`ed, verdict-neutral. This is the sole published change (patch bump). |
| `EXTENDED_DIAGNOSTIC_CATALOG` | Reuse for NG help/tags; add a small ATC catalog. Enum-completeness tripwire (`extended-catalog.spec.ts`) stays honest. |
| `automationDetails.id` (MULTI) | NOT in the reporter -- CI `node -e` merge step, mirroring `fallow`. |
| `partialFingerprints` mutation idiom | Already proven at `sarif-report.ts:112`; RULE mutations use the same idiom. |
| `.github/workflows/ci.yml` `code-scanning` job | Un-path-gate (GATE-02 mit. A) + add per-project generate/merge (MULTI) + add to `ci.needs` (GATE-01); add a separate proof job/step (PROOF) with `security-events: read`. |
| Repository ruleset | Add "Require code scanning results" for angular-typechecker + fallow (GATE-02). |

## What NOT to add

| Avoid | Why |
|-------|-----|
| A new npm dependency | `node-sarif-builder@4.1.0` + bundled `@types/sarif@2.1.7` already cover every field; the four additions are object mutations. |
| Builder-method wrappers / a fork of node-sarif-builder | Direct `.rule`/`.run` mutation is the library's own idiom and type-safe; wrapping it is boilerplate. |
| `automationDetails.id` inside the shipped reporter | MULTI is CI-only (no release). The reporter must stay a pure per-`CoreResult` single-run function; a project name is not part of its contract. |
| Populating `run.artifacts[]` / `analysisTarget` for the Scanned-files panel | Proven inert (PR #53 / DOC-01); and v4.1.0 already emits `artifacts` automatically anyway. |
| A test asserting "SARIF has no `run.artifacts`" | It WOULD fail -- `completeRunFields` auto-adds them in v4.1.0. |
| A formal SARIF `taxonomies`/`taxa` object for families | GitHub filters on `properties.tags` only; taxonomies add spec-purist complexity GitHub does not render. Use `properties.tags`. |
| Passing `category:` to `upload-sarif` for the merged multi-run file | Would flatten per-run `automationDetails.id`s to one category and re-trigger the 2025-07-21 rejection. |
| A per-project upload matrix now | MULTI-FUT-01 -- only past "a handful" of projects; N runs in one file is under the 20-run cap. |
| Precise `template-type-check` vs `typescript` tagging | RULE-FUT-01 -- needs diagnostic origin, not derivable from the `TSxxxx` code. Ship coarse 3-way tags. |
| Relying on the `ci` always-report trick to avoid the merge-protection block | Merge protection is INDEPENDENT of status checks -- it will block anyway. Fix at the upload (GATE-02 mit. A). |

## Version pins (verified)

| Package / action | Version | Source |
|------------------|---------|--------|
| `node-sarif-builder` | `4.1.0` (installed) | `node_modules/node-sarif-builder/package.json` |
| `@types/sarif` (bundled dep) | `2.1.7` (installed) | `node_modules/@types/sarif/package.json` |
| `github/codeql-action/upload-sarif` | `v4.37.1` (`7188fc3...`, already pinned) | `.github/workflows/ci.yml:590` |
| `gh` CLI | runner-ambient (GitHub-hosted) | REST calls only; no version-specific behavior needed |

## Sources

- Installed `node-sarif-builder@4.1.0` dist (`sarif-rule-builder.js`, `sarif-result-builder.js`,
  `sarif-run-builder.js`, `sarif-builder.js`) + `@types/sarif@2.1.7` `index.d.ts` -- HIGH (read directly).
- [github/codeql-action upload-sarif action.yml (v4)](https://github.com/github/codeql-action/blob/v4/upload-sarif/action.yml) -- HIGH.
- [GitHub REST: code scanning](https://docs.github.com/en/rest/code-scanning/code-scanning) -- HIGH (query params, alert `rule`/`most_recent_instance` fields, token scope).
- [Code scanning merge protection (concept)](https://docs.github.com/en/code-security/concepts/code-scanning/merge-protection) + [set merge protection](https://docs.github.com/en/code-security/code-scanning/managing-your-code-scanning-configuration/set-code-scanning-merge-protection) + [changelog 2024-04-30](https://github.blog/changelog/2024-04-30-code-scanning-now-allows-configuring-rulesets-to-prevent-pull-requests-from-being-merged-beta/) -- HIGH (block conditions, thresholds, status-check independence, exclusions).
- [SARIF results limits](https://docs.github.com/en/code-security/code-scanning/troubleshooting-sarif-uploads/results-exceed-limit) + [Uploading a SARIF file](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) -- HIGH.
- Repo artifacts: `.github/workflows/ci.yml` `code-scanning` job (the fallow multi-run idiom), `sarif-report.ts` / `extended-catalog.ts` / `diagnostic-record.ts` (current reporter), closed PR #53 spike (empirically de-risked), `scratchpad/sarif-multiproject-research.md` (topology + category convention) -- HIGH (read directly / prior proven work).
