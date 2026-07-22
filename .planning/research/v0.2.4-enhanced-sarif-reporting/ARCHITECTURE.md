# Architecture: v0.2.4 Enhanced SARIF reporting for GitHub Code Scanning

**Domain:** Integrating richer SARIF + per-project Code Scanning analyses into an existing, shipped reporter seam.
**Researched:** 2026-07-21
**Confidence:** HIGH (mapped against the real source at HEAD; `node-sarif-builder` API + Nx graph verified locally).

## TL;DR

- **RULE-01..04 is the only release-bearing change** and it touches exactly one production module: `sarif-report.ts` (plus one small new pure helper). `toDiagnosticRecord`, `json-report.ts`, `format-report.ts`, `run-typecheck.ts`, `CoreResult`, and every adapter stay byte-unchanged -> JSON + human paths provably unaffected, patch bump `0.2.3 -> 0.2.4`.
- **MULTI, PROOF, GATE, DOC are CI/ruleset/docs only** -- no published-package change. The reporter keeps emitting ONE run per CLI invocation; per-project multi-run is assembled CI-side by a merge script (mirrors the existing fallow `node -e` id-stamp step).
- **Family derivation** for TS-coded diagnostics uses a coarse `.html`-origin heuristic (RULE-FUT-01 defers precise inline-template detection). Family is derived per-rule inside the SARIF path only, from `DiagnosticRecord.{rawCode,file}` -- never added to `DiagnosticRecord` (that would leak into JSON).

---

## 1. RULE-01..04 -- diagnostic-family rule metadata (release-bearing, SARIF-only)

### Current state (what ships today in `sarif-report.ts`)
- It loops `EXTENDED_DIAGNOSTIC_CATALOG` (18 NG8xxx) and `addRule(initSimple({ ruleId, shortDescriptionText, helpUri }))` -- **all 18 added unconditionally**, whether or not they fired.
- Every result carries a `ruleId` (`TS####`/`NG8xxx`/`ATC9000x` from `codeStringOf`). TS/ATC results reference a `ruleId` with **no rule object** -> GitHub shows a blank rule description (the RULE-01 gap).
- No rule carries `properties.tags`, `defaultConfiguration.level`, or `help` (the RULE-02/03/04 gap).

### The rule catalog: switch from "always the 18" to "one rule per ruleId actually emitted"
Build the `rules[]` set **dynamically from the distinct ruleIds present in `result.diagnostics`**, in a first pass, then add results as today. This is what every surveyed tool does (CodeQL/ESLint/Semgrep) and it satisfies RULE-01 for the open-ended TS code space (you cannot pre-enumerate every `TSxxxx`).

Per distinct ruleId, emit a `reportingDescriptor` with:
| Field | Source |
|-------|--------|
| `id` | the ruleId (`TS2322` / `NG8101` / `ATC90001`) |
| `properties.tags` | `[family]` -- `familyOf(record)` (RULE-02) |
| `defaultConfiguration.level` | the SARIF level of the observed severity for that ruleId (RULE-03) -- accurate, not guessed |
| `help.text` (+ `helpUri`) | curated for NG8xxx + ATC, generic for TS (RULE-04) |
| `shortDescription.text` | catalog `shortDescription` for NG8xxx; curated for ATC; generated (`"TypeScript diagnostic TS####"`) for TS |

`node-sarif-builder`'s `SarifRuleBuilder.initSimple` only accepts `{ruleId, shortDescriptionText, fullDescriptionText?, helpUri?}`, so **set the three new fields directly on `.rule`** -- the same escape hatch the module already uses for `resultBuilder.result.partialFingerprints`:
```ts
const rb = new SarifRuleBuilder().initSimple({ ruleId, shortDescriptionText, helpUri });
rb.rule.properties = { tags: [family] };            // RULE-02
rb.rule.defaultConfiguration = { level };            // RULE-03
rb.rule.help = { text: helpText };                   // RULE-04
runBuilder.addRule(rb);
```
`SarifRuleBuilder.rule` is typed `ReportingDescriptor` (from the bundled `@types/sarif`), which carries all three -- no cast needed.

### The family-derivation problem (the crux) -- SOLVED coarsely per RULE-FUT-01
`TSxxxx` alone can't tell TypeScript-in-code from a template type error; both use standard TS codes. The origin (file) distinguishes them: an **external-template** diagnostic is attributed to a `.html` file; an **inline-template** diagnostic is attributed to the component `.ts` and is indistinguishable-by-extension from ordinary TS.

**v1 classifier (pure over `DiagnosticRecord`, no raw diagnostic needed):**
```
familyOf(record):
  rawCode < 0 and code in extended catalog -> 'extended-diagnostics'   // the 18 NG8xxx
  rawCode < 0 (other NG, e.g. NG5xxx parse, NG3004)     -> 'template-type-check'
  rawCode >= 90000                                       -> 'tool'      // ATC900x
  file ends with '.html'                                 -> 'template-type-check'
  else                                                   -> 'typescript'
```
- Uses only `record.rawCode` + `record.file` (already computed by `toDiagnosticRecord` in the SARIF loop) -- **zero new data on `DiagnosticRecord`**, so the JSON payload is byte-identical.
- Documented imprecision (= RULE-FUT-01, already deferred in REQUIREMENTS): an **inline-template** TS error is tagged `typescript`, not `template-type-check`. Acceptable; the coarse `.html` heuristic is explicitly the v1 contract.
- **Rule-level family when a code spans both** (e.g. TS2322 in a `.html` AND in a `.ts`): a rule has one tag. Recommend **"any `.html` occurrence -> `template-type-check`, else `typescript`"** so a real template error is never mislabeled. First-occurrence-wins is the simpler fallback; pick one and lock it in a test.

### New vs modified files (RULE)
| File | New/Mod | Change |
|------|---------|--------|
| `src/core/diagnostic-family.ts` | **NEW** | Pure `familyOf(record): Family` + `Family` union type + the TS/ATC help-text + level-mapping helpers. `src/core` boundary-clean (no `console`/`process`/compiler-cli). |
| `src/core/sarif-report.ts` | **MOD** | First pass collects `Map<ruleId, {family, level, shortDescription, helpUri, helpText}>` from records; add one rule per entry with tags/level/help; result loop unchanged. |
| `src/core/extended-catalog.ts` | **unchanged** (recommended) | family = code-derived; level = result-derived; `help.text` seeded from existing `shortDescription`. No schema change needed. (Optional nicety: add a richer per-entry `help` string later -- not required for RULE-04.) |
| `src/core/sarif-report.spec.ts` + `__snapshots__/*.snap` | **MOD** | The "18 rules always present" assertion becomes "rules match the fired ruleIds, each with tags/level/help." This snapshot delta IS the release-bearing SARIF change. |
| `machine-reporters-sarif.integration.spec.ts` (+snap) | **MOD** | Assert real cold-compiler diagnostics get correct family tags across all four families (needs a fixture emitting >=1 TS + template + NG8xxx + ATC diagnostic). |
| `json-report.ts`, `diagnostic-record.ts`, `format-report.ts` | **DO NOT TOUCH** | Confirms SARIF-only. A JSON-reporter test unchanged = the regression proof that the JSON path is unaffected. |

**JSON/human unaffected -- how to prove it:** family lives in `diagnostic-family.ts` consumed only by `sarif-report.ts`; `DiagnosticRecord` gains no field; `json-report.ts` `FORMAT_VERSION` stays `1`; the JSON key-drift snapshot tripwire stays green. The additive-audit against `@0.2.3` (the repo's standing gate) shows only `sarif-report.*` + the new module change.

---

## 2. MULTI-01/02 -- per-project multi-run SARIF (CI-side, no release)

### Recommended seam: CI-side merge (NOT reporter-side multiple runs)
The CLI/reporter stays single-run per invocation. Adding a `--category`/`automationDetails.id` CLI option would be a **published-package change** -> contradicts "MULTI is CI-only, no release." So:

1. **Discover** the projects whose `typecheck` executor is `angular-typechecker:typecheck`.
2. **Run the standalone CLI once per project** (each project's own `tsConfig`), emitting a single-run SARIF per project.
3. **Merge** the N single-run files into ONE file with N `runs[]`, stamping each `run.automationDetails.id = angular-typecheck/<project>`.
4. **One `upload-sarif`, NO `category` input** -- the per-run id becomes the category (avoids the 2025-07-21 multi-run-same-category rejection). This is byte-for-byte the pattern the existing fallow step already uses (`node -e` stamping `automationDetails.id` per run, uploaded with no category).

This keeps the reporter dependency-free and the release surface = RULE only.

### Discovery mechanism (MULTI-02) -- mirror `list-e2e-projects.mjs`
`nx show projects --with-target typecheck` over-matches: it returns the e2e-tier projects, the plugin itself (`nx:run-commands` typecheck), `test-util`, and `@angular-typechecker/source` alongside the 4 real consumers. **Filter by executor id.** The code-scanning job already runs `npm ci` + `nx build`, so the Nx graph is available and authoritative (e2e *fixture* projects under `e2e/*/fixtures/` are NOT in the graph -- verified). Two viable readers:
- **Graph-based (recommended, authoritative):** `nx show projects --with-target typecheck --json`, then for each `nx show project <p> --json` keep those where `targets.typecheck.executor === 'angular-typechecker:typecheck'`. Emit `[{name, tsConfig[]}]` (tsConfig normalized to an array; read from `options.tsConfig`). Yields exactly `ng-spike-app`, `typecheck-consumer`, `typecheck-consumer-dep`, `typecheck-walk-consumer`.
- **Pure-fs (leaner, matches the e2e precedent):** enumerate `apps/*/project.json` + `libs/*/project.json`, filter `targets.typecheck.executor === 'angular-typechecker:typecheck'`. No `nx`/graph, but hardcodes the two roots.

Emit `{name, tsConfig[]}` (not just names) so the CI loop knows what to pass the CLI per project (the CLI's `-c/-p` is repeatable and takes tsconfig paths).

### Drift guard (MULTI-02 "cannot silently drift") -- mirror GUARD-01b
An in-plugin Vitest spec asserts the discovery script's output **set-equals an independent enumeration** (e.g. read all `apps|libs` project.json files, filter executor). A project that adds/drops `angular-typechecker:typecheck` changes both sides in lockstep; a discovery bug fails the spec loudly. This is the MULTI-02 anti-drift analogue of the e2e `ci-e2e-coverage-guard.spec.ts`.

### New vs modified files (MULTI)
| File | New/Mod | Change |
|------|---------|--------|
| `tools/ci/list-typecheck-projects.mjs` | **NEW** | Discovery: emit `[{name, tsConfig[]}]` for executor-`angular-typechecker:typecheck` projects. |
| `tools/ci/merge-sarif.mjs` | **NEW** | Read N per-project SARIF files, stamp `automationDetails.id = angular-typecheck/<project>` per run, write one merged file. (Or keep the fallow-style inline `node -e` -- a dedicated script is cleaner + testable.) |
| `.github/workflows/ci.yml` (`code-scanning` job) | **MOD** | Replace the single `bin.js -c apps/ng-spike-app/tsconfig.app.json` step with: discover -> loop `bin.js <tsConfig args> --format sarif > <project>.sarif` per project -> merge -> single `upload-sarif` (drop the `category: angular-typechecker` input; ids come from the merge). |
| `packages/angular-typechecker/src/multi-typecheck-discovery-guard.spec.ts` | **NEW** | The MULTI-02 drift guard (in-plugin, cache:false regression-guard style). |

**20-runs/file cap:** 4 projects is nowhere near it (research doc S.2). The FUT escape hatch (`MULTI-FUT-01`, matrix-per-project) is unneeeded now.

---

## 3. PROOF-01/02 -- fixture-driven CI proof (CI-only, no release)

### Where the fixture lives so it does NOT fail the main gate
The main type gate is `test`'s `nx run-many -t typecheck`, which runs `typecheck` for **every project in the graph** that defines it. A deliberately-erroring fixture must therefore be **outside the Nx project graph**:

- **Put it under a non-project dir** -- e.g. `tools/sarif-proof-fixture/` (a bare `tsconfig.json` + source files, one diagnostic per family, NO `project.json`). It is invisible to `nx run-many -t typecheck` -> main gate untouched. (An `e2e/*/fixtures/` location also works -- those are already graph-excluded -- but `tools/` reads clearer as "CI proof asset, not a consumer example.")
- The proof CI job runs the **standalone CLI directly** against that tsconfig: `bin.js -c tools/sarif-proof-fixture/tsconfig.json --format sarif`, uploads under a **dedicated category** (`angular-typecheck-proof`, so it never mixes with the per-project analyses), then asserts via `gh api` (`code-scanning/analyses` + `code-scanning/alerts`) that one alert per family landed with the expected category, `tag:`, and `severity:`.

### One diagnostic per family in the fixture
- `typescript`: a plain TS error in a `.ts` (e.g. TS2322 type-mismatch).
- `template-type-check`: a type error in an **external `.html`** template (so it lands `.html`-attributed -> tagged `template-type-check` by the coarse heuristic).
- `extended-diagnostics`: any NG8xxx (e.g. NG8101 invalid banana-in-box) -- cheap and deterministic.
- `tool` (ATC): point the CLI at a references-only/empty tsconfig leaf, or add a not-found reference, to synthesize `ATC90001`/`ATC90002`. May need a second CLI invocation with its own SARIF merged in, since ATC codes are engine-state conditions, not source errors.

### Async-ingestion reality (PROOF-02 "fails loudly")
Code Scanning ingestion is asynchronous. The assertion step must **poll `gh api` with a bounded timeout** and fail red on timeout/missing-alert/missing-tag. Run the proof **on PRs against the PR ref** so its alerts are queryable via `ref=refs/pull/<n>/merge` / `pr:<n>` and **do not pollute the `main` alerts view** (per the repo's known SARIF behavior memo). Tradeoff to flag: making the proof a required check couples the merge gate to GitHub's async ingestion latency; mitigate with polling + a generous timeout + the ruleset lockout-recovery escape hatch (AGENTS.md).

### New vs modified files (PROOF)
| File | New/Mod | Change |
|------|---------|--------|
| `tools/sarif-proof-fixture/{tsconfig.json, src/*.ts, *.html}` | **NEW** | Isolated one-per-family fixture, outside the graph. |
| `tools/ci/assert-code-scanning.mjs` (or an inline job step) | **NEW** | `gh api` poll + assert category/tags/severity; exit non-zero on any gap. |
| `.github/workflows/ci.yml` | **MOD** | A `code-scanning-proof` job (or steps): build -> run CLI on the fixture -> upload (`category: angular-typecheck-proof`) -> assert. Fork-PR/`security-events` gating identical to the existing `code-scanning` job. |

---

## 4. GATE-01/02 -- gating (ci.yml + ruleset, no release)

- **GATE-01:** add `code-scanning` to the `ci` aggregate's `needs[]` (it is deliberately excluded today). Safe because: (a) the job is path-gated with the same `!= 'false'` form and `ci` drops `'skipped'` from its fail set (D-08) -> planning-only PRs don't deadlock; (b) the upload steps skip on fork PRs but the **job still returns success**, so `ci` sees success; (c) `|| true` on the generation steps means only a real infra break (`npm ci`/`nx build`) fails the job -- which SHOULD fail `ci`. Also decide whether the new `code-scanning-proof` job joins `needs[]` (PROOF-02 implies yes).
- **GATE-02:** GitHub-native "Require code scanning results" ruleset on `main` for both tools (angular-typechecker + fallow). This is a **repo-settings task, not code** -- configure the merge protection to compare against the base analysis so a **planning-only PR (code-scanning path-skipped, no new analysis) is NOT deadlocked**. Verify in real CI (local gates cannot prove GitHub ingestion -- per the repo's SARIF-dogfood memo). Reuse AGENTS.md ruleset "Lockout recovery" (toggle `enforcement` to edit) if it wedges.
- **DOC-01:** document the "Scanned files" CodeQL-only limitation in `packages/angular-typechecker/README.md` (the shipped README already carries the Code Scanning / machine-readable section) with the spike evidence (`run.artifacts` inert for third-party tools). Prose-only; no Issue filed (user preference).

### New vs modified files (GATE/DOC)
| File | New/Mod | Change |
|------|---------|--------|
| `.github/workflows/ci.yml` (`ci` job) | **MOD** | Add `code-scanning` (+ proof job) to `needs[]`. |
| GitHub repo ruleset | **CONFIG** | Enable "Require code scanning results" for both tools; planning-only-skip mitigation. |
| `packages/angular-typechecker/README.md` | **MOD** | DOC-01 Scanned-files limitation subsection. |
| `README.md` (root) | **MOD (optional)** | Mirror the limitation note if the root README documents Code Scanning. |

---

## Suggested phase build order

Ordered by dependency + "make the required gate last so mid-milestone PRs aren't blocked."

1. **Phase 1 -- RULE-01..04 (release-bearing SARIF rule metadata).** `diagnostic-family.ts` (new) + `sarif-report.ts` dynamic rule catalog + tags/level/help; update SARIF specs/snapshots; assert JSON/human byte-unchanged + additive audit vs `@0.2.3`. This is the substrate everything else asserts against and the sole version bump. **First.**
2. **Phase 2 -- MULTI-01/02 (per-project multi-run CI).** Discovery script + merge script + rewire the `code-scanning` job to loop-per-project -> merge -> single upload; add the drift guard spec. Uses the Phase-1 richer SARIF but is structurally independent. **After 1.**
3. **Phase 3 -- PROOF-01/02 (automated proof).** Isolated `tools/` fixture + proof job + `gh api` poll/assert. Asserts Phase-1 family tags/levels and (ideally) Phase-2 categories. **After 1 + 2.**
4. **Phase 4 -- GATE-01/02 + DOC-01.** Add `code-scanning` (+ proof) to `ci.needs`; enable the ruleset with the planning-only-skip mitigation; document the Scanned-files gap. **Last** -- promoting jobs to required only once they are stable avoids blocking every PR during development.

**Rationale:** RULE is the only thing that ships in the package and it is the contract the proof verifies, so it must land before PROOF. MULTI reshapes the same `code-scanning` job the PROOF and GATE phases touch, so it precedes them to avoid churn. GATE is last so the required-check surface only grows once the underlying jobs are green in real CI.

## Confidence + gaps

- **HIGH:** the SARIF-only boundary (family stays out of `DiagnosticRecord`), the `node-sarif-builder` `.rule` escape hatch, the CI-side merge seam, the discovery-by-executor filter, and the graph-excludes-e2e-fixtures fact are all verified against the real source/tooling at HEAD.
- **MEDIUM/gap:** the exact rule-family choice when one TS code spans template + code (pick any-`.html`-wins vs first-wins and lock a test); the ATC-in-fixture emission (may need a second CLI invocation merged in); GATE-02's precise GitHub ruleset config for the planning-only-skip non-deadlock -- provable only in real CI (per the repo's standing SARIF-dogfood memo). The spike (closed PR #53) already proved the live pipeline, tags/catalog/help, and per-run categories, so these are wiring details, not open risks.
