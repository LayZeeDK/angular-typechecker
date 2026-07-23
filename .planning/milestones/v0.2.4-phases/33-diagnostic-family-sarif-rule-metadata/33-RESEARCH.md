# Phase 33: Diagnostic-family SARIF rule metadata - Research

**Researched:** 2026-07-21
**Domain:** Widening a shipped SARIF 2.1.0 reporter (`node-sarif-builder`) so every fired diagnostic resolves to a cataloged rule carrying a family tag, default severity, and inline help -- SARIF-path-only, additive patch bump.
**Confidence:** HIGH (every load-bearing claim re-verified against the real source AND the installed `node_modules` at HEAD `0977db6`; milestone research consolidated, not re-derived).

> This is a CONSOLIDATION of the v0.2.4 milestone research (`.planning/research/v0.2.4-enhanced-sarif-reporting/`), narrowed to Phase 33 (RULE-01..04), with every key claim verified against source and the 8 planner questions resolved to final form.

<user_constraints>
## User Constraints (from 33-CONTEXT.md)

### Locked Decisions (D-01..D-12 -- the contract; do not contradict)
- **D-01:** NEW pure module `src/core/diagnostic-family.ts` exports `familyOf(record): Family` + the `Family` union (`'typescript' | 'template-type-check' | 'extended-diagnostics' | 'tool'`). Reads ONLY `DiagnosticRecord.rawCode` + `.file`; adds NO field to `DiagnosticRecord`; stays `src/core` boundary-clean (no `console`/`process`/`@angular/compiler-cli`).
- **D-02:** Classifier boundaries (lock in a unit test): `rawCode < 0` AND in `EXTENDED_DIAGNOSTIC_CATALOG` (the 18 NG8xxx) -> `extended-diagnostics`; `rawCode < 0` other -> `template-type-check`; `rawCode >= 90000` -> `tool`; `file` ends `.html` -> `template-type-check`; else -> `typescript`.
- **D-03:** Accepted imprecision = RULE-FUT-01: an INLINE-template TS error in a component `.ts` is tagged `typescript`. Coarse file-extension heuristic is the v1 contract; do not thread diagnostic origin now.
- **D-04:** A rule carries exactly ONE tag. When a `ruleId` (e.g. `TS2322`) appears in BOTH `.html` and `.ts` in one run, resolve family as **any-`.html`-occurrence-wins -> `template-type-check`, else `typescript`** (NOT first-occurrence-wins). Lock in a test.
- **D-05:** Switch `sarif-report.ts` from "always add the 18 NG8xxx" to "catalog exactly one rule per DISTINCT `ruleId` actually present in `result.diagnostics`." First pass builds `Map<ruleId, {family, level, shortDescription, helpUri, helpText}>`; add one rule per entry; the result-emit loop stays unchanged (one result per diagnostic, never-drop). Do NOT pre-enumerate the open TSxxxx space.
- **D-06:** `properties.tags = [family]` (RULE-02). `defaultConfiguration.level` = REUSE `toSarifLevel(record.severity)` already in `sarif-report.ts` (RULE-03). Tie-break on mixed severities for one `ruleId` in one run: **first observed** -- document.
- **D-07:** `help.text` (RULE-04, distinct from `helpUri`): NG8xxx seed from catalog `shortDescription` + keep existing `helpUri`; ATC900x curated per-code + repo README/docs anchor; TSxxxx per-FAMILY generic template + TS error-reference `helpUri` (per-code TS help is an anti-feature); template-type-check per-family generic + Angular template-type-check docs `helpUri`.
- **D-08:** `shortDescription.text`: NG8xxx from catalog; ATC900x curated; TSxxxx generated (`"TypeScript diagnostic TS####"`); template-type-check generated. Describes the RULE, never a single occurrence.
- **D-09:** Set the three new fields by MUTATING `SarifRuleBuilder.rule` directly (`rb.rule.properties = { tags: [family] }`; `rb.rule.defaultConfiguration = { level }`; `rb.rule.help = { text }`) -- same escape hatch as `resultBuilder.result.partialFingerprints`. `.rule` is typed `ReportingDescriptor`, so all three type-check with NO cast. NO new dependency; the lazy `await import('node-sarif-builder')` firewall is unchanged.
- **D-10:** `extended-catalog.ts` schema stays UNCHANGED (family code-derived; level result-derived; NG `help.text` seeded from `shortDescription`).
- **D-11:** FIX the stale `sarif-report.ts` header comment ("no `ruleIndex` is emitted") -- `completeRunFields()` behavior (see finding V4 below). Fold the doc correction here; the panel limitation itself is DOC-01 / Phase 36.
- **D-12:** Prove the SARIF-only boundary: `json-report.ts`, `diagnostic-record.ts`, `format-report.ts` DO-NOT-TOUCH; `FORMAT_VERSION` stays `1`; JSON key-drift tripwire stays green; additive audit vs `@0.2.3` shows only `sarif-report.*` + new `diagnostic-family.ts`.

### Claude's Discretion
- Exact wording of per-family `help.text` templates + curated `ATC900x` help/short strings (end-user language, no internal/board jargon).
- Precise `helpUri` targets (TS error reference URL, Angular template-type-check docs URL, repo README anchor for ATC).
- Whether the family reducer lives as a `Map`-fold inside `sarif-report.ts` or as a helper in `diagnostic-family.ts`.

### Deferred Ideas (OUT OF SCOPE for Phase 33)
- Precise inline-template-vs-code disambiguation (RULE-FUT-01).
- Richer per-entry `help` strings on `extended-catalog.ts` (optional nicety).
- Per-project CI SARIF categories + discovery + drift guard (Phase 34, MULTI).
- Automated `gh api` Code Scanning proof fixture (Phase 35, PROOF).
- `code-scanning` in `ci` aggregate + "Require code scanning results" ruleset + Scanned-files docs (Phase 36, GATE/DOC).
- Emitting `run.artifacts` / `taxonomies` for the "Scanned files" panel (proven inert).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RULE-01 | Every emitted diagnostic references a cataloged SARIF rule across ALL families (no blank rule description) | Catalog-on-demand (D-05): first pass over `result.diagnostics` -> one rule per distinct `ruleId`. Verified `completeRunFields()` then sets `result.ruleIndex` for every result (finding V4), closing the RULE-01 gap. |
| RULE-02 | Each rule carries a diagnostic-family tag in `properties.tags` | `familyOf` classifier (D-02, finding V2) + `rb.rule.properties = { tags: [family] }` (D-09, verified no-cast V3). |
| RULE-03 | Each rule carries `defaultConfiguration.level` consistent with severity | Reuse `toSarifLevel` (D-06) -> `rb.rule.defaultConfiguration = { level }`; `ReportingConfiguration.level` accepts the `'error'|'warning'|'note'` union (verified V3). |
| RULE-04 | Each rule carries SARIF `help` text (not only `helpUri`) | `rb.rule.help = { text }` (D-07/D-09); `ReportingDescriptor.help?: MultiformatMessageString` has `.text` (verified V3). |
</phase_requirements>

## Summary

Phase 33 is a tightly bounded, SARIF-path-only change to ONE production module (`sarif-report.ts`) plus ONE new pure helper (`diagnostic-family.ts`). It flips the rule catalog from "always the fixed 18 NG8xxx" to "one rule per distinct `ruleId` that actually fired," and decorates each cataloged rule with a family tag (RULE-02), a default severity level (RULE-03), and inline help text (RULE-04). Family is derived coarsely from `DiagnosticRecord.{rawCode, file}` inside the SARIF path only; `DiagnosticRecord` gains no field, so JSON and human output stay byte-identical. It ships as an additive `0.2.3 -> 0.2.4` patch bump and is the SOLE release-bearing change in the milestone.

The milestone research is accurate and the plan is de-risked by the closed spike PR #53 (which proved live in Code Scanning that rule `tags` + a catalog + `help` power the `tag:`/`severity:`/`rule:` filters and the rule-help panel). Verification against source turned up two sharpenings the planner must internalize: **(1)** the classifier's `rawCode` checks MUST precede the `.html` check or an external-template NG8101 misclassifies; and **(2)** switching to catalog-on-demand makes `node-sarif-builder`'s `completeRunFields()` start emitting `result.ruleIndex` on every result (because every fired `ruleId` now matches a cataloged rule) -- a large but purely-additive snapshot delta.

**Primary recommendation:** Add `diagnostic-family.ts` (pure `familyOf` + `Family` union + a Set of the 18 catalog ngCodes for membership). In `sarif-report.ts`, replace the unconditional 18-rule loop with a first-pass `Map<ruleId, RuleMeta>` fold (family via `familyOf`, level via the existing `toSarifLevel`, any-`.html`-wins family upgrade, first-observed level), then add one decorated rule per map entry via the `.rule` mutation escape hatch. Regenerate the SARIF specs/snapshots (they ARE the release-bearing delta), fix the stale header comment, and prove the SARIF-only boundary with the standing gates. No new dependency.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Family classification | `src/core` pure helper (`diagnostic-family.ts`) | -- | Pure `(record) -> Family`; no I/O, no compiler-cli; unit-testable in isolation. |
| Rule catalog assembly (on-demand) | SARIF reporter (`sarif-report.ts`) | family helper | Reporter is the ONLY consumer of family; keeps family out of the shared record so JSON/human never see it. |
| Severity -> SARIF level | SARIF reporter (existing `toSarifLevel`) | -- | Already lives in `sarif-report.ts`; reuse verbatim (D-06). |
| Rule-metadata field-set (tags/level/help) | SARIF reporter via `.rule` mutation | `@types/sarif` `ReportingDescriptor` | `initSimple` cannot express them; raw `.rule` is the shipped escape-hatch pattern. |
| Verdict / counts | `evaluateResult` (untouched) | -- | The reporter never re-derives success; D-07 firewall unchanged. |
| JSON / human payloads | `json-report.ts` / `format-report.ts` (DO-NOT-TOUCH) | -- | SARIF-only boundary; regression-proof surfaces. |

## Standard Stack

### Core (all already installed -- NO new dependency this phase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node-sarif-builder` | `4.1.0` | Builds the SARIF 2.1.0 log; reached ONLY via `await import()` | Already the shipped SARIF engine (added @0.2.3). `SarifRuleBuilder.rule` is a public `ReportingDescriptor` -- the mutation surface D-09 uses. [VERIFIED: node_modules/node-sarif-builder/package.json = "4.1.0"] |
| `@types/sarif` | `2.1.7` | Type shapes for `.rule` mutation | Bundled by `node-sarif-builder` as a `dependency`. `ReportingDescriptor.{properties,defaultConfiguration,help}` all optional; no cast needed. [VERIFIED: node_modules/@types/sarif/index.d.ts lines 1198-1432] |
| `typescript` | peer `>=6.0.0 <6.1.0` | `DiagnosticCategory` etc. (already injected) | Existing peer; the family helper needs none of it (reads `rawCode`/`file` off the projected record). |
| `vitest` | `4.x` | Unit + integration specs + snapshots | Existing test runner; snapshot deltas are the release-bearing proof. |

**Installation:** none. D-09 mandates zero new dependencies; the lazy `await import('node-sarif-builder')` firewall is unchanged (verified: `render-report.ts:83` does `await import('./sarif-report.js')`).

### Alternatives Considered (all rejected by locked decisions)
| Instead of | Could Use | Why rejected |
|------------|-----------|--------------|
| `.rule` mutation | a richer SARIF builder / hand-authored JSON | D-09 + shipped precedent (`partialFingerprints`); adds a dependency for zero gain. |
| catalog-on-demand | pre-enumerate every TSxxxx | impossible (thousands of codes); RULE-01 = on-demand (FEATURES Pitfall 3). |
| per-family rule ids (`TS2322@template`) | disambiguate the shared-code case | breaks the `ruleId === code` contract, fragments alert baselines (PITFALLS P4). |

## Package Legitimacy Audit

**No external packages are installed in this phase.** D-09 explicitly forbids a new dependency; `node-sarif-builder@4.1.0` and `@types/sarif@2.1.7` are already present and were legitimacy-audited when added in v0.2.3 (see `32-ADDITIVE-AUDIT.md` section 2a: the only dep added since @0.2.2 was `node-sarif-builder@^4.1.0`, correctly classified by `@nx/dependency-checks`). No audit table required.

## Architecture Patterns

### System Architecture Diagram (SARIF path, post-change)

```
CoreResult.diagnostics[]  (ts.Diagnostic[])
        |
        v
  formatSarifReport(result, ts_, pathBase)          [sarif-report.ts, reached via await import()]
        |
        |  PASS 1 -- build the on-demand catalog (NEW)
        v
  for each diagnostic:
     record = toDiagnosticRecord(...)               [shared projection, unchanged]
     ruleId = record.code                           (TS#### / NG8xxx / ATC900x, from codeStringOf)
     family = familyOf(record)                       [diagnostic-family.ts, NEW pure helper]
     level  = toSarifLevel(record.severity)          [existing fn, reused]
     map.upsert(ruleId): first-observed level;
                         any-.html-occurrence upgrades family -> template-type-check   [D-04]
        |
        v
  for each map entry:                                (RULE-01: one rule per fired ruleId)
     rb = new SarifRuleBuilder().initSimple({ ruleId, shortDescriptionText, helpUri })
     rb.rule.properties          = { tags: [family] }        [RULE-02, D-09]
     rb.rule.defaultConfiguration = { level }                [RULE-03, D-09]
     rb.rule.help                 = { text: helpText }       [RULE-04, D-09]
     runBuilder.addRule(rb)
        |
        |  PASS 2 -- emit results (UNCHANGED: one result per diagnostic, never-drop)
        v
  runBuilder.addResult(...) with partialFingerprints
        |
        v
  logBuilder.buildSarifJsonString()
        |  -> completeRunFields() auto-emits run.artifacts[], sets artifactLocation.index,
        |     AND sets result.ruleIndex for every result whose ruleId is now cataloged   [finding V4]
        v
  SARIF 2.1.0 JSON string  -> render-report.ts seam -> stdout (all 3 adapters)
```

File-to-code mapping: `familyOf` new in `diagnostic-family.ts`; PASS-1 map fold + rule decoration new in `sarif-report.ts`; everything downstream (results, fingerprints, serialization) unchanged.

### Recommended structure (minimal)
```
packages/angular-typechecker/src/core/
  diagnostic-family.ts        # NEW: familyOf(record): Family + Family union + EXTENDED_NG_CODES set
  diagnostic-family.spec.ts   # NEW: D-02 boundary matrix + D-04 any-.html-wins reducer (pure, deterministic)
  sarif-report.ts             # MOD: on-demand catalog + tags/level/help via .rule; fixed header comment
  sarif-report.spec.ts        # MOD: "18 rules" -> "rules match fired ruleIds, each with tags/level/help"
  machine-reporters-sarif.integration.spec.ts  # MOD: assert family tags across the 4 families over real fixtures
  __snapshots__/sarif-report.spec.ts.snap                       # REGEN
  __snapshots__/machine-reporters-sarif.integration.spec.ts.snap # REGEN
```

### Pattern 1: The `.rule` mutation escape hatch (D-09)
**What:** `SarifRuleBuilder.initSimple` accepts only `{ruleId, shortDescriptionText, fullDescriptionText?, helpUri?}` -- no `tags`/`level`/`help`. Set them on the public `.rule` (`ReportingDescriptor`) after `initSimple`.
**When:** every cataloged rule.
**Example (verified type-checks with no cast):**
```ts
// Source: node_modules/node-sarif-builder/dist/lib/sarif-rule-builder.d.ts (rule: ReportingDescriptor)
//         node_modules/@types/sarif/index.d.ts:1372-1432 (ReportingDescriptor), :1198-1208 (PropertyBag.tags),
//         :1333-1366 (ReportingConfiguration.level = "none"|"note"|"warning"|"error")
const rb = new SarifRuleBuilder().initSimple({ ruleId, shortDescriptionText, helpUri });
rb.rule.properties = { tags: [family] };          // RULE-02  (PropertyBag.tags?: string[])
rb.rule.defaultConfiguration = { level };          // RULE-03  (level in the accepted union; toSarifLevel returns a subset)
rb.rule.help = { text: helpText };                 // RULE-04  (MultiformatMessageString.text)
runBuilder.addRule(rb);
```
This mirrors the shipped precedent `resultBuilder.result.partialFingerprints = {...}` (sarif-report.ts:112).

### Pattern 2: On-demand catalog with the any-`.html`-wins fold (D-04, D-05, D-06)
**What:** one first pass over diagnostics builds `Map<ruleId, RuleMeta>`.
**Example (final form):**
```ts
type RuleMeta = { family: Family; level: 'error'|'warning'|'note'; shortDescription: string; helpUri?: string; helpText: string };
const catalog = new Map<string, RuleMeta>();
for (const diagnostic of result.diagnostics) {
  const record = toDiagnosticRecord(diagnostic, ts_, pathBase);
  const ruleId = record.code;
  const family = familyOf(record);
  const existing = catalog.get(ruleId);
  if (existing === undefined) {
    catalog.set(ruleId, buildRuleMeta(ruleId, record, family));   // shortDescription/helpUri/helpText per family (D-07/D-08)
  } else if (family === 'template-type-check' && existing.family !== 'template-type-check') {
    existing.family = 'template-type-check';                       // D-04 any-.html-wins upgrade
    // NOTE: level is first-observed (D-06) -- do NOT overwrite existing.level here.
  }
}
```
The family upgrade is monotonic: only `typescript` ever upgrades to `template-type-check` (the only cross-family conflict a shared code can have -- NG-extended and tool codes are unambiguous). Level is never overwritten (first-observed tie-break).

### Anti-Patterns to Avoid
- **Checking `.html` before `rawCode` sign/range** -- would misclassify an external-template NG8101 (`.html`) as `template-type-check` instead of `extended-diagnostics`. Order is load-bearing (see finding V2).
- **Overwriting `existing.level` on later occurrences** -- violates D-06 first-observed tie-break and makes output order-nondeterministic if severities ever differ.
- **Adding a `family` field to `DiagnosticRecord`** -- would leak into JSON, breaking the SARIF-only boundary (D-01/D-12).
- **Casting `.rule` to `any`** -- unnecessary; the fields type-check natively (V3).

## Resolved Planner Questions

### Q1 -- The exact `familyOf(record)` classifier (order matters) [VERIFIED against `codeStringOf`]
`codeStringOf(rawCode)` (diagnostic-record.ts:106-116) splits `rawCode < 0 -> NG`, `>= 90000 -> ATC`, else `-> TS`. The classifier MUST mirror that split FIRST so the family and the code label never disagree, THEN apply the `.html` heuristic only within the TS branch:

```
familyOf(record):                                  // reads record.rawCode + record.file ONLY
  if record.rawCode < 0:
    ngCode = ngCodeOf(record.rawCode)              // -998101 -> 8101 (reuse diagnostic-codes.ts; never re-derive)
    return EXTENDED_NG_CODES.has(ngCode) ? 'extended-diagnostics' : 'template-type-check'
  if record.rawCode >= 90000:
    return 'tool'                                   // ATC900x
  // rawCode is a TS code (0..89999) from here:
  if record.file !== null and record.file endsWith '.html':
    return 'template-type-check'                    // external-template TS-coded error (coarse heuristic, D-03)
  return 'typescript'
```
`EXTENDED_NG_CODES` = `new Set(EXTENDED_DIAGNOSTIC_CATALOG.map(e => e.ngCode))` (the 18 codes: 8101, 8102, 8107, 8103, 8116, 8104, 8111, 8105, 8106, 8108, 8109, 8011, 8112, 8115, 8113, 8114, 8117, 8021). **Why the order is load-bearing:** steps 1-2 return for ALL negative + ATC codes, so the `.html` check is reached only for TS codes; an external-template NG8101 (negative, `.html`-attributed) is caught by step 1 -> `extended-diagnostics`, never downgraded. A file-less TS diagnostic has `record.file === null` -> falls through to `typescript` (correct; global TS2318 in the global-diagnostics fixture). [VERIFIED: matches codeStringOf boundaries + the shipped ngCodeOf inverse]

### Q2 -- Rule-level family when one ruleId spans `.html` and `.ts` (D-04) [confirmed implementable in PASS 1]
Implement in the first-pass Map build (Pattern 2). A rule's family starts as its first occurrence's `familyOf`; the moment ANY occurrence classifies as `template-type-check` (i.e. a `.html` occurrence of a TS code), upgrade the entry's family to `template-type-check`. Because the only families a shared TS code can produce are `typescript` and `template-type-check`, the upgrade is total and order-independent: whether the `.ts` or the `.html` occurrence is seen first, the final family is `template-type-check`. Lock with a unit test that feeds two synthesized `TS2322` records (one `file` ending `.ts`, one ending `.html`) in BOTH orders and asserts the single `TS2322` rule carries `tags: ['template-type-check']`.

### Q3 -- Setting tags/level/help without a cast [VERIFIED no-cast]
See Pattern 1. `ReportingDescriptor.properties?: PropertyBag` and `PropertyBag.tags?: string[]`; `ReportingDescriptor.defaultConfiguration?: ReportingConfiguration` and `ReportingConfiguration.level?: "none"|"note"|"warning"|"error"` (superset of `toSarifLevel`'s return); `ReportingDescriptor.help?: MultiformatMessageString` and `MultiformatMessageString.text: string`. All three assignments compile against the bundled `@types/sarif@2.1.7` with no cast. [VERIFIED: node_modules/@types/sarif/index.d.ts]

### Q4 -- help.text + helpUri + shortDescription strategy per family (D-07/D-08)
| Family | `shortDescription.text` | `help.text` | `helpUri` |
|--------|-------------------------|-------------|-----------|
| `extended-diagnostics` (NG8xxx) | catalog `shortDescription` (D-10, unchanged) | seed from the SAME catalog `shortDescription` (D-07) | `https://angular.dev/extended-diagnostics/NG<ngCode>` [VERIFIED: shipped `HELP_URI_BASE`, comment notes it resolves incl. NG8011/NG8021] |
| `tool` (ATC900x) | curated per code | curated per code (see below) | repo README anchor [ASSUMED - executor must confirm the anchor exists] |
| `typescript` (TSxxxx) | generated `"TypeScript diagnostic TS####"` | per-FAMILY generic template (below) | TS error reference [ASSUMED - candidate `https://www.typescriptlang.org/docs/handbook/2/understanding-errors.html`] |
| `template-type-check` | generated (e.g. `"Angular template type-check diagnostic <code>"`) | per-family generic template (below) | Angular template-type-check docs [ASSUMED - candidate `https://angular.dev/tools/cli/template-typecheck`] |

Concrete curated ATC strings (there are exactly two synthesized codes -- verified diagnostic-codes.ts:108-109):
- `ATC90001` (`ZERO_ROOT_NAMES_DIAGNOSTIC_CODE`): short `"No files to type-check (empty or references-only tsconfig)"`; help `"angular-typechecker resolved zero root names for this tsconfig. A references-only (solution-style) or empty tsconfig has nothing to check directly -- point the check at a tsconfig with real files, or check the referenced projects."`.
- `ATC90002` (`REFERENCE_NOT_FOUND_DIAGNOSTIC_CODE`): short `"A referenced tsconfig could not be found"`; help `"A tsconfig 'references' entry points at a path that does not exist. Fix or remove the reference so the referenced project can be type-checked."`.

Suggested generic templates (Claude's discretion, keep consumer-facing):
- `typescript`: `"A TypeScript compiler diagnostic (<code>). See the TypeScript error reference for the meaning of this code and how to resolve it."`
- `template-type-check`: `"An Angular template type-check diagnostic (<code>) raised while type-checking a component template. See the Angular template type-checking guide."`

**helpUri caveat:** `helpUri` targets are Claude's discretion (D-07) and the RULE-04-critical field is `help.text`, not `helpUri` (a slightly-stale `helpUri` does NOT leave "No rule help available"). RECOMMENDATION: the executor verifies each external URL at implementation time (`curl -I`), and falls back to a repo README anchor (fully under our control) for any that 404. Do not block on external-URL verification.

### Q5 -- `defaultConfiguration.level` derivation + tie-break (D-06)
`level = toSarifLevel(record.severity)`, reusing the existing private function in `sarif-report.ts` (`error->error`, `warning->warning`, `suggestion|message->note` -- verified sarif-report.ts:130-142). Level derivation stays IN `sarif-report.ts` during the PASS-1 fold; `diagnostic-family.ts` stays family-only. Tie-break when one `ruleId` is observed with mixed severities in one run: **first observed** (D-06) -- do not overwrite `existing.level`. In the normal case a code has one configured severity per compilation, so this is a rare edge; document it in a code comment and, optionally, a unit test feeding one `ruleId` at two severities and asserting the rule's level equals the first.

### Q6 -- The spec/snapshot delta [this IS the release-bearing change]
**`sarif-report.spec.ts` (unit):**
- The three "18 rules always present" assertions change semantics:
  - Test "emits ... the 18-rule catalog" (lines 178-182): fixture emits `positionedDiag()` (TS2322) only -> assert `rules` length `1`, `rules[0].id === 'TS2322'`, `tags` `['typescript']`, `defaultConfiguration.level === 'error'`, `help.text` present, `shortDescription.text === 'TypeScript diagnostic TS2322'`.
  - Test "renders a clean CoreResult as an EMPTY results array still carrying the 18-rule catalog" (lines 243-258): a clean result has NO diagnostics -> NO fired ruleIds -> `rules` length `0`. The assertion FLIPS from "18 rules" to "0 rules" (empty `rules[]` is valid SARIF). Keep the schema-valid assertion.
  - Snapshot test (lines 352-375): fixture emits TS2322 + ATC90001 -> `rules[]` becomes `[TS2322, ATC90001]` (2, was 18), each with `tags`/`defaultConfiguration`/`help`; AND both results gain `ruleIndex` (0 and 1). Regenerate the snapshot.
- Remove/repurpose the `EXTENDED_DIAGNOSTIC_CATALOG.length` / `toHaveLength(18)` expectations.
- ADD (new unit coverage, or a dedicated `diagnostic-family.spec.ts`): the D-02 boundary matrix (one case per branch: TS2322->typescript; NG8101 negative->extended-diagnostics; NG8002 negative non-catalog->template-type-check; `.html`-attributed TS2322->template-type-check; ATC90001->tool; file-less TS->typescript) and the D-04 any-`.html`-wins reducer (both orders).

**`machine-reporters-sarif.integration.spec.ts` (+ snapshots):**
- `layout-b-host` snapshot: `rules[]` becomes `[NG8002 (template-type-check), TS2322 (typescript)]` (2, was 18); the two results gain `ruleIndex` 0/1. ADD assertions: the NG8002 rule `tags === ['template-type-check']`, the TS2322 rule `tags === ['typescript']`.
- `global-diagnostics` snapshot: distinct ruleIds = `{TS2318}` -> `rules[]` becomes `[TS2318 (typescript)]` (1, was 18); all 10 results gain `ruleIndex` 0. ADD assertion: TS2318 `tags === ['typescript']`, `level === 'error'`.
- ADD coverage for the remaining two families over REAL fixtures (see the deterministic-ATC note below):
  - `extended-diagnostics`: run an existing extended fixture (e.g. `extended-content-projection` -> NG8011, or `extended-ngfor-let` -> NG8105) and assert the NG rule `tags === ['extended-diagnostics']`.
  - `tool`: run a solution-style fixture that surfaces an ATC code and assert `tags === ['tool']` (see below).

**Deterministically synthesizing one ATC diagnostic:**
- UNIT level (preferred backbone): use the existing `filelessDiag(ATC90001)` helper / `synthesizeFilelessError(ts, 90001, msg)` -- fully deterministic, no cold compiler. This is where the `tool` family is authoritatively locked.
- INTEGRATION level (end-to-end proof): point the CLI/executor at a solution-style tsconfig whose reference is missing. `walk-references.ts` emits `ATC90002` for a not-found referenced leaf and `run-typecheck.ts` emits `ATC90001` for a none-in-project/empty root (verified diagnostic-codes.ts:99-135 + run-typecheck.ts:419-421,578-579). Candidate existing fixtures: `solution-style-broken-ref` / `solution-style-all-missing` / `config-broken`.
- To honor the CONTEXT "Specific Idea" of ONE fixture emitting all four families in one run: build a solution-style root tsconfig referencing (a) one VALID leaf carrying a `.ts` TS2322 + an external-`.html` NG8002 + a source that trips an NG8101 extended diagnostic, and (b) one MISSING reference (-> ATC90002). The reference-walk finalizes the valid leaf's union AND the not-found 90002 in one run. [MEDIUM confidence -- depends on walk co-surfacing behavior; executor must confirm the single fixture yields all four in one invocation, else fall back to reusing separate fixtures + the unit-level matrix, which is the leaner ponytail-correct option and fully sufficient for RULE-02 proof.]

### Q7 -- Proving the SARIF-only boundary (D-12) [exact gates/commands]
| Claim | Gate / command |
|-------|----------------|
| `DiagnosticRecord` gains no field | `json-report.spec.ts` "JSON payload key drift-lock (D-03)" -- `DIAGNOSTIC_KEYS` (9 keys) stays green (verified json-report.spec.ts:459-498); `src/index.drift.ts` barrel tripwire compiles. |
| `json-report.ts` / `format-report.ts` untouched | `git diff angular-typechecker@0.2.3..HEAD -- packages/angular-typechecker/src/core/json-report.ts packages/angular-typechecker/src/core/format-report.ts packages/angular-typechecker/src/core/diagnostic-record.ts` is EMPTY; their specs + snapshots unchanged. |
| `FORMAT_VERSION` stays `1` | `json-report.spec.ts` asserts `formatVersion === 1` and `payload` contains `"formatVersion": 1` (verified :284,:454). |
| JSON key-drift tripwire green | run `nx test angular-typechecker` -- the "JSON payload key drift-lock" describe passes. |
| Additive audit vs `@0.2.3` shows only sarif-report.* + new module | `git diff angular-typechecker@0.2.3..HEAD --stat -- packages/angular-typechecker/src/` lists only `sarif-report.ts`, `sarif-report.spec.ts`, `diagnostic-family.ts` (+ its spec), the two SARIF snapshots, and `machine-reporters-sarif.integration.spec.ts`. Published `dependencies` gains NOTHING (D-09). Follow the `32-ADDITIVE-AUDIT.md` method (git-diff per published path + `@nx/dependency-checks`). |
| Patch bump only | `npx nx release --dry-run` (unified command, NOT `nx release version`) proposes `0.2.3 -> 0.2.4`; check `git log` for stray `!`/`BREAKING CHANGE` (AGENTS.md). |

Full local battery before the Release PR (per "Verify format + lint before release" memory): `nx test angular-typechecker`, `nx typecheck angular-typechecker` (all 3 tsc incl. drift), `tsc --noEmit -p tsconfig.spec.json` (esbuild `nx test` does NOT type-check specs -- catches spec type errors that green-mask), `nx lint angular-typechecker` (`maxWarnings:0`, runs `@nx/dependency-checks`), `nx run angular-typechecker:format:check` (or prettier `--check`), `nx build angular-typechecker`.

### Q8 -- The stale header comment (D-11) [exact text + correction]
Two stale spots in `sarif-report.ts`:
1. **Module header, lines 28-31 (verbatim):** *"...each of the 18 NG rules is added ONCE and every result references its rule by `ruleId` only -- no `ruleIndex` is emitted, which is valid SARIF (GitHub Code Scanning links a result's `ruleId` to `rules[].id`) (D-05/D-06)."*
2. **Inline D-06 comment, lines 76-80 (verbatim):** *"add the 18-NG8xxx catalog rules ONCE. Every result references its rule by `ruleId` only -- node-sarif-builder's addResult() never sets `ruleIndex`, and a result with a `ruleId` and no `ruleIndex` is valid SARIF (GitHub Code Scanning links `ruleId` to `rules[].id`). TS#### / ATC9000x results carry a `ruleId` without a catalog entry, which is fine."*

Both are now false: (a) rules are cataloged ON-DEMAND (one per distinct fired `ruleId`), not "the 18 added once"; (b) the "no `ruleIndex` is emitted / addResult() never sets ruleIndex" claim is WRONG -- `completeRunFields()` (run inside `buildSarifJsonString()`) DOES set `result.ruleIndex` whenever the result's `ruleId` matches a cataloged rule, which post-change is EVERY result (finding V4). Corrected wording (adapt to house style):

> Rules are cataloged ON-DEMAND: one `reportingDescriptor` per DISTINCT `ruleId` present in `result.diagnostics` (RULE-01), each carrying `properties.tags` (family), `defaultConfiguration.level`, and `help.text` (RULE-02/03/04). `node-sarif-builder`'s `completeRunFields()` (invoked by `buildSarifJsonString`) then auto-emits `run.artifacts[]` with `sourceLanguage`, sets each location's `artifactLocation.index`, AND sets `result.ruleIndex` for every result whose `ruleId` matches a cataloged rule -- which, with on-demand cataloging, is every result. Every diagnostic thus resolves to a rule (no blank rule description in GitHub Code Scanning).

Note the milestone note that the header also claimed "`run.artifacts` is not emitted" is NOT literally in the current header -- that was in prior notes. The shipped SARIF already carries `run.artifacts[]` (verified in both committed snapshots), so any such claim elsewhere is likewise stale.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SARIF serialization / `$schema` / version | manual JSON | `node-sarif-builder` (`buildSarifJsonString`) | Already the shipped engine; hand-JSON risks schema drift (module contract forbids it). |
| `run.artifacts[]` + `ruleIndex` + `artifactLocation.index` | manual index bookkeeping | `completeRunFields()` (automatic) | Verified auto-derived; adding it yourself would double-emit / conflict. |
| NG negative-code humanization | re-derive `-99xxxx` math | `ngCodeOf` (diagnostic-codes.ts) | Pitfall 6; single source of truth. |
| severity -> level | a second mapping | existing `toSarifLevel` | D-06 mandates reuse; a second map could drift. |
| code label boundaries | re-derive `<0`/`>=90000` | mirror `codeStringOf` in `familyOf` | Keeps label and family from ever disagreeing (finding V2). |

**Key insight:** every primitive this phase needs already exists in the codebase (`toDiagnosticRecord`, `toSarifLevel`, `ngCodeOf`, `codeStringOf`, `EXTENDED_DIAGNOSTIC_CATALOG`, the `.rule` mutation precedent). The net-new code is ~one classifier + one Map fold + per-family help strings.

## Common Pitfalls

### Pitfall 1: Classifier order inversion (external-template NG misclassification)
**What goes wrong:** checking `file.endsWith('.html')` before the `rawCode` sign/range checks tags an external-template NG8101 (`.html`-attributed, negative code) as `template-type-check` instead of `extended-diagnostics`.
**How to avoid:** `rawCode` checks FIRST (steps 1-3), `.html` check only in the TS branch (step 4). Lock with the boundary-matrix unit test including an `.html`-attributed NG8101.
**Warning sign:** an NG8xxx rule shows `tags: ['template-type-check']` in a snapshot.

### Pitfall 2: Surprise `ruleIndex` in regenerated snapshots (finding V4)
**What goes wrong:** after catalog-on-demand, every result gains `ruleIndex` (because its `ruleId` now matches a rule) -- a large snapshot churn that can look like an unexpected regression.
**Why it happens:** `completeRunFields()` matches `result.ruleId` against `run.tool.driver.rules[].id`; today no fired code is cataloged so no match; post-change every fired code is cataloged.
**How to avoid:** EXPECT it. Regenerate snapshots deliberately (`vitest -u`) and eyeball that the added `ruleIndex` values are correct 0-based indices into the now-smaller `rules[]`. It is purely additive (a new optional field on results) -- does NOT break additive-only.
**Warning sign:** `ruleIndex` absent from a result whose `ruleId` should be cataloged (means a rule was missed in PASS 1).

### Pitfall 3: `initSimple` silently cannot set tags/level/help (PITFALLS P3)
**What goes wrong:** trying to pass `tags`/`level`/`help` into `initSimple` -- it accepts only `{ruleId, shortDescriptionText, fullDescriptionText?, helpUri?}`, so the fields are silently dropped.
**How to avoid:** the `.rule` mutation (Pattern 1). Verified this is the only surface for them.

### Pitfall 4: Leaking family into JSON (D-01/D-12 breach)
**What goes wrong:** adding a `family` field to `DiagnosticRecord` or otherwise touching the shared projection would change JSON output.
**How to avoid:** `familyOf` reads the record but writes nothing back; family exists only in the SARIF `Map`. Prove via the JSON key-drift tripwire + empty git-diff on `json-report.ts`/`diagnostic-record.ts`.

### Pitfall 5: `help` vs `helpUri` confusion (RULE-04)
**What goes wrong:** setting only `helpUri` leaves the GitHub rule-help panel showing "No rule help available" (proven, spike PR #53).
**How to avoid:** set `rb.rule.help = { text }` (RULE-04) AND keep `helpUri`. They are different fields.

## Code Examples

### Deriving `EXTENDED_NG_CODES` and `familyOf`
```ts
// Source: diagnostic-record.ts:106-116 (codeStringOf boundaries), diagnostic-codes.ts:52 (ngCodeOf),
//         extended-catalog.ts:33-138 (the 18 entries)  -- all VERIFIED at HEAD.
import { ngCodeOf } from './diagnostic-codes';
import { EXTENDED_DIAGNOSTIC_CATALOG } from './extended-catalog';
import type { DiagnosticRecord } from './diagnostic-record';

export type Family = 'typescript' | 'template-type-check' | 'extended-diagnostics' | 'tool';

const EXTENDED_NG_CODES: ReadonlySet<number> = new Set(
  EXTENDED_DIAGNOSTIC_CATALOG.map((entry) => entry.ngCode),
);

export function familyOf(record: DiagnosticRecord): Family {
  if (record.rawCode < 0) {
    return EXTENDED_NG_CODES.has(ngCodeOf(record.rawCode))
      ? 'extended-diagnostics'
      : 'template-type-check';
  }

  if (record.rawCode >= 90000) {
    return 'tool';
  }

  if (record.file !== null && record.file.endsWith('.html')) {
    return 'template-type-check';
  }

  return 'typescript';
}
```

### `completeRunFields` behavior (finding V4 -- read, do not copy)
```js
// Source: node_modules/node-sarif-builder/dist/lib/sarif-builder.js:79-137 (VERIFIED)
// - builds run.artifacts[] from result location URIs (sourceLanguage from extension map: html->'HTML', ts->'TypeScript')
// - sets location.physicalLocation.artifactLocation.index
// - sets result.ruleIndex = rulesIndexMap.get(result.ruleId) ONLY IF that ruleId is in run.tool.driver.rules
//   (undefined otherwise -> no ruleIndex; this is why today's TS/ATC/NG8002 results carry none)
```

## Runtime State Inventory

Not applicable -- this is a greenfield code change to a reporter, not a rename/refactor/migration. No stored data, live-service config, OS-registered state, secrets, or build artifacts embed a string being renamed. (The SARIF `rules[]` shape changes, but that is emitted output, not stored runtime state.)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x via `@nx/vitest:test` |
| Config file | `packages/angular-typechecker/vite.config.ts` (existing) |
| Quick run command | `nx test angular-typechecker` |
| Full suite command | `nx test angular-typechecker` + `nx typecheck angular-typechecker` + `tsc --noEmit -p tsconfig.spec.json` + `nx lint angular-typechecker` + `nx build angular-typechecker` |

### Observable behaviors to test
1. **Rule catalog membership = fired ruleIds (RULE-01):** `rules[].id` set equals the DISTINCT `ruleId`s in `result.diagnostics`; a clean result yields `rules: []`; every result resolves to a rule (post-`completeRunFields`, every result carries a `ruleIndex`).
2. **Each rule's `properties.tags` (RULE-02):** correct family per the D-02 matrix, one tag per rule.
3. **Each rule's `defaultConfiguration.level` (RULE-03):** equals `toSarifLevel(severity)`; first-observed tie-break on mixed severities.
4. **Each rule's `help.text` (RULE-04):** present (non-empty) for every family; `helpUri` also present.
5. **The any-`.html`-wins reducer (D-04):** a `TS2322` seen in both `.html` and `.ts` (either order) yields one rule tagged `template-type-check`.
6. **SARIF-only boundary (D-12):** JSON + human byte-unchanged; `FORMAT_VERSION` stays `1`; JSON key-drift tripwire green; additive audit vs `@0.2.3` shows only sarif-report.* + diagnostic-family.ts.

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RULE-01 | catalog = fired ruleIds; clean=0 rules; every result has ruleIndex | unit + integration | `nx test angular-typechecker` | MOD `sarif-report.spec.ts` + integration snapshots |
| RULE-02 | family tag per rule across 4 families; D-02 boundaries; D-04 reducer | unit | `nx test angular-typechecker` | NEW `diagnostic-family.spec.ts` + MOD `sarif-report.spec.ts` |
| RULE-03 | `defaultConfiguration.level` = toSarifLevel; first-observed tie-break | unit | `nx test angular-typechecker` | MOD `sarif-report.spec.ts` |
| RULE-04 | `help.text` present per family; helpUri kept | unit | `nx test angular-typechecker` | MOD `sarif-report.spec.ts` |
| RULE-01..04 | family tags over REAL cold-compiler fixtures (4 families) | integration | `nx test angular-typechecker` | MOD `machine-reporters-sarif.integration.spec.ts` |
| D-12 | JSON/human byte-unchanged; key-drift; additive audit | regression + audit | `nx test` + `git diff angular-typechecker@0.2.3..HEAD` | existing json specs green + new `33-ADDITIVE-AUDIT.md` |

### Sampling Rate
- **Per task commit:** `nx test angular-typechecker`
- **Per wave merge:** `nx test angular-typechecker` + `nx typecheck angular-typechecker` + `tsc --noEmit -p tsconfig.spec.json` + `nx lint angular-typechecker`
- **Phase gate:** full battery green + additive audit vs `@0.2.3` + `npx nx release --dry-run` shows patch bump, before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `diagnostic-family.spec.ts` -- NEW: D-02 boundary matrix + D-04 any-`.html`-wins reducer (pure, deterministic).
- [ ] `sarif-report.spec.ts` -- MOD: replace the three `toHaveLength(18)` catalog assertions; add per-family tags/level/help assertions; regenerate `__snapshots__/sarif-report.spec.ts.snap`.
- [ ] `machine-reporters-sarif.integration.spec.ts` -- MOD: assert family tags across the 4 families over real fixtures; regenerate `__snapshots__/machine-reporters-sarif.integration.spec.ts.snap`.
- [ ] (existing) `json-report.spec.ts` key-drift + `src/index.drift.ts` -- must stay green untouched (the SARIF-only regression proof).
- Framework install: none -- Vitest infrastructure already covers this phase.

## Security Domain

`security_enforcement` is unset in `.planning/config.json` (absent = enabled), so this section is included. This phase only generates a SARIF string; no auth, session, access control, or cryptography is involved.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | no | -- |
| V5 Input Validation / Output Encoding | yes | `node-sarif-builder` serializes via `JSON.stringify` (escapes control chars/quotes); messages are the ANSI-free flattened text from the shared projection -- no `\x1b` byte can appear (existing `sarif-report.spec.ts` "emits no ANSI byte" test). New `help.text`/`shortDescription` strings are static, developer-authored literals (no user input) -- no injection surface. |
| V6 Cryptography | no (the sha256 `partialFingerprints` is a stable identifier, not a security control; unchanged this phase) | -- |

### Known Threat Patterns for a SARIF emitter
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed SARIF breaking GitHub ingestion | Tampering/DoS | Let `node-sarif-builder` serialize (never hand-concatenate); keep the committed SARIF 2.1.0 ajv schema validation (`validateSarif`) green in the integration spec. |
| Path disclosure via `artifactLocation.uri` | Information disclosure | Unchanged -- `relativizePath` already emits repo-relative URIs (30-SECURITY.md IN-03 residual accepted); this phase adds no new path emission. |

No new threat surface is introduced. No `checkpoint:human-verify` needed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build/test/tsc | yes | per repo `engines` | -- |
| Nx | `nx test`/`typecheck`/`lint`/`build` | yes | 23.x | -- |
| Vitest | specs + snapshots | yes | 4.x | -- |
| TypeScript | `tsc --noEmit` gates | yes | peer 6.0.x | -- |
| `node-sarif-builder` | SARIF emit | yes (installed) | 4.1.0 | -- |
| `git` tag `angular-typechecker@0.2.3` | additive audit baseline | yes (published + tagged; `npm view` = 0.2.3) | 0.2.3 | -- |

No missing dependencies; no external tools beyond the existing toolchain. (docs.github.com / angular.dev were NOT re-fetched -- the GitHub SARIF facts are captured in the milestone research and spike PR #53; the two candidate `helpUri` URLs are discretion-level and marked [ASSUMED] for executor confirmation.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Always emit the fixed 18 NG8xxx rules regardless of what fired | Catalog one rule per distinct fired `ruleId` (CodeQL/ESLint/Semgrep norm) | this phase (D-05) | RULE-01: no blank rule descriptions; `rules[]` now reflects the actual run. |
| Rules carry only `shortDescription` + `helpUri` | Rules carry `properties.tags` + `defaultConfiguration.level` + `help.text` too | this phase (D-06/07/09) | Powers GitHub `tag:`/`severity:` filters + the rule-help panel (proven live, PR #53). |
| Results carry no `ruleIndex` (no fired code was cataloged) | Every result carries `ruleIndex` (auto, `completeRunFields`) | emergent from D-05 (finding V4) | Additive; snapshots grow a `ruleIndex` per result. |

**Deprecated/outdated:** the `sarif-report.ts` header claim "no `ruleIndex` is emitted / addResult() never sets ruleIndex" (D-11 -- factually wrong; corrected per Q8).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | TS error-reference `helpUri` = `https://www.typescriptlang.org/docs/handbook/2/understanding-errors.html` | Q4 | LOW -- `helpUri` is secondary to `help.text` (RULE-04 critical field); a 404 does not blank the panel. Executor verifies with `curl -I`; README-anchor fallback. |
| A2 | Angular template-type-check `helpUri` = `https://angular.dev/tools/cli/template-typecheck` | Q4 | LOW -- same as A1; angular.dev may have reorganized. Executor verifies; README-anchor fallback. |
| A3 | ATC `helpUri` = a repo README anchor that exists | Q4 | LOW -- executor must confirm/author the README anchor (the README already has a Code Scanning / machine-readable section). |
| A4 | A single solution-style composite fixture can surface all 4 families in one CLI run (valid leaf diagnostics + a not-found ATC90002 co-surfaced by the walk) | Q6 | MEDIUM -- depends on reference-walk co-surfacing; if it does not, fall back to reusing separate fixtures + the unit-level 4-family matrix (fully sufficient, leaner). |

All other claims are `[VERIFIED]` against source/node_modules at HEAD or `[CITED]` from the milestone research + spike PR #53.

## Open Questions

1. **Single-fixture vs multi-fixture integration proof for the 4 families.**
   - What we know: the unit tier can lock all 4 families + the D-04 reducer deterministically (synthesized records incl. `filelessDiag(ATC90001)`); real fixtures naturally give template-type-check (NG8002) + typescript (TS2322) via `layout-b-host`, extended via any `extended-*` fixture, and tool via a solution-style/broken-ref fixture.
   - What's unclear: whether the CONTEXT "one fixture" idea is worth a bespoke composite fixture vs reusing existing fixtures (A4).
   - Recommendation: unit-level 4-family matrix is the authoritative backbone; integration reuses existing fixtures per family (ponytail-correct). Build the composite fixture only if the planner wants the literal single-fixture proof.

2. **Exact `help.text` wording + `helpUri` targets.** Claude's discretion (D-07); candidates proposed in Q4. Recommendation: keep `help.text` short and consumer-facing (no board/plan jargon per the "CHANGELOG/README end-user-facing" memory); verify external URLs at implementation, README-anchor fallback.

## Sources

### Primary (HIGH confidence -- verified at HEAD `0977db6`)
- `packages/angular-typechecker/src/core/sarif-report.ts` -- current 18-rule loop, `toSarifLevel`, `partialFingerprints` escape hatch, stale header comment.
- `packages/angular-typechecker/src/core/diagnostic-record.ts` -- `DiagnosticRecord` shape (`rawCode`+`file`), `codeStringOf` boundaries, `toDiagnosticRecord`.
- `packages/angular-typechecker/src/core/diagnostic-codes.ts` -- `ngCodeOf`, `ZERO_ROOT_NAMES_DIAGNOSTIC_CODE=90001`, `REFERENCE_NOT_FOUND_DIAGNOSTIC_CODE=90002`, `synthesizeFilelessError`.
- `packages/angular-typechecker/src/core/extended-catalog.ts` -- the 18 NG8xxx entries (member/ngCode/shortDescription).
- `packages/angular-typechecker/src/core/{sarif-report.spec.ts, machine-reporters-sarif.integration.spec.ts}` + `__snapshots__/` -- current assertions/snapshots (18-rule catalog; no ruleIndex; artifacts already emitted).
- `packages/angular-typechecker/src/core/{json-report.ts, format-report.ts}` -- DO-NOT-TOUCH surfaces; `FORMAT_VERSION=1`; the "JSON payload key drift-lock" tripwire.
- `node_modules/node-sarif-builder/dist/lib/sarif-builder.js:79-137` -- `completeRunFields()` behavior (finding V4): auto artifacts + ruleIndex-when-cataloged.
- `node_modules/node-sarif-builder/dist/lib/{sarif-rule-builder,sarif-result-builder,sarif-run-builder}.d.ts` -- `initSimple` params; `.rule: ReportingDescriptor`.
- `node_modules/@types/sarif/index.d.ts` -- `ReportingDescriptor` (:1372), `ReportingConfiguration.level` (:1360-1366), `PropertyBag.tags` (:1198-1208), `MultiformatMessageString.text`.
- `node_modules/node-sarif-builder/package.json` -- version `4.1.0`; `@types/sarif` `^2.1.7` dependency.

### Secondary (HIGH -- milestone research, consolidated not re-derived)
- `.planning/research/v0.2.4-enhanced-sarif-reporting/{SUMMARY,ARCHITECTURE,FEATURES,PITFALLS}.md` -- the family classifier, the `.rule` escape hatch, finding #4, RULE-01 catalog-on-demand, P3/P4.
- `.planning/phases/33-.../33-CONTEXT.md` -- D-01..D-12 locked decisions.
- `.planning/REQUIREMENTS.md` -- RULE-01..04, RULE-FUT-01, Out of Scope.
- `.planning/milestones/v0.2.3-phases/32-.../32-ADDITIVE-AUDIT.md` -- the additive-audit method + baseline tag mechanics.

### Tertiary (CITED -- external, captured by the milestone research/memory)
- Closed spike PR #53 -- live Code Scanning proof that rule `tags` + catalog + `help` power `tag:`/`severity:`/`rule:` filters + the help panel; `run.artifacts` inert for the Scanned-files panel.
- Auto-memory `code-scanning-sarif-empirical-behavior` -- same, plus PR-ref alert scoping.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependency; versions verified in node_modules.
- Family classifier + reducer (Q1/Q2): HIGH -- mirrors verified `codeStringOf` boundaries; order-correctness proven by walking the branches against real fixture codes.
- Mechanics (Q3/D-09): HIGH -- `@types/sarif` shapes read directly; no-cast confirmed.
- `completeRunFields` / ruleIndex delta (Q6/V4): HIGH -- read the shipped `.js` implementation.
- help/URI strategy (Q4): MEDIUM -- `help.text` HIGH; `helpUri` targets are discretion-level [ASSUMED], executor-verified.
- Single-fixture 4-family proof (Q6/A4): MEDIUM -- depends on walk co-surfacing; unit-level matrix is the HIGH-confidence fallback.

**Research date:** 2026-07-21
**Valid until:** 2026-08-20 (stable; re-verify only if `node-sarif-builder` or the SARIF path changes).
