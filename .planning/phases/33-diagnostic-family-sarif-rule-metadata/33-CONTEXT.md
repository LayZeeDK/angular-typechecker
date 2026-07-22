# Phase 33: Diagnostic-family SARIF rule metadata - Context

**Gathered:** 2026-07-21
**Status:** Ready for planning

> Discussion mode: `--auto` (autonomous, single pass) `--analyze` (trade-off tables logged) `--chain` (auto-advance to plan). Every decision below is evidence-backed by the v0.2.4 milestone research and the closed spike PR #53, which proved live in GitHub Code Scanning that rule `properties.tags` + a rule catalog + `help` make the `tag:` / `severity:` / `rule:` filters and the rule-help panel work. No decision landed in the high-impact + low-confidence quadrant, so none was escalated.

<domain>
## Phase Boundary

Widen the shipped v0.2.3 SARIF reporter so that EVERY diagnostic that fires resolves to a cataloged SARIF rule carrying a diagnostic-family tag, the correct default severity level, and inline `help` text -- across ALL families (TypeScript `TSxxxx`, external-template type-check, extended `NG8xxx`, tool `ATC900x`).

This is the SOLE release-bearing change in milestone v0.2.4 (additive patch bump `0.2.3 -> 0.2.4`). The change is confined to the SARIF path: family is derived only inside the SARIF reporter, `DiagnosticRecord` gains no field, and the JSON reporter, human reporter, `run-typecheck` core, `CoreResult`, the barrel, and every adapter stay byte-unchanged.

**In scope:** the four RULE requirements only -- catalog-on-demand across families (RULE-01), `properties.tags` family tag (RULE-02), `defaultConfiguration.level` (RULE-03), `help.text` (RULE-04); the SARIF spec/snapshot updates that ARE the release-bearing delta; the additive audit vs `@0.2.3`; and a fix to the now-stale `sarif-report.ts` header comment.

**Out of scope (own phases / deferred):** per-project CI categories + discovery/guard (MULTI, Phase 34); the automated `gh api` Code Scanning proof (PROOF, Phase 35); `ci`-aggregate gating + the "Require code scanning results" ruleset + Scanned-files docs (GATE/DOC, Phase 36); precise inline-template-vs-code family disambiguation (RULE-FUT-01); emitting `run.artifacts` / `taxonomies` for the "Scanned files" panel (proven inert).
</domain>

<decisions>
## Implementation Decisions

### Family classifier (RULE-02)
- **D-01:** Add a NEW pure module `src/core/diagnostic-family.ts` exporting `familyOf(record): Family` and the `Family` union (`'typescript' | 'template-type-check' | 'extended-diagnostics' | 'tool'`). It reads ONLY `DiagnosticRecord.rawCode` + `DiagnosticRecord.file` -- no new field is added to `DiagnosticRecord`, so the JSON payload stays byte-identical and the module stays `src/core` boundary-clean (no `console` / `process` / `@angular/compiler-cli`).
- **D-02:** Classifier boundaries (lock in a unit test):
  - `rawCode < 0` AND the code is in `EXTENDED_DIAGNOSTIC_CATALOG` (the 18 `NG8xxx`) -> `extended-diagnostics`
  - `rawCode < 0`, other Angular negative codes (e.g. `NG5xxx` parse, `NG3004`) -> `template-type-check`
  - `rawCode >= 90000` (`ATC900x`) -> `tool`
  - `file` ends with `.html` -> `template-type-check`
  - else -> `typescript`
- **D-03:** Accepted imprecision = deferred RULE-FUT-01: an INLINE-template TS error attributed to a component `.ts` is tagged `typescript`, not `template-type-check`. This coarse file-extension heuristic is the v1 contract; do not thread diagnostic origin through the record to fix it now.

### Rule-level family when a code spans both `.html` and `.ts` (the flagged MEDIUM gap)
- **D-04:** A rule carries exactly one tag. When the same `ruleId` (e.g. `TS2322`) is observed in BOTH a `.html` and a `.ts` file within one run, resolve the rule's family as **any-`.html`-occurrence-wins -> `template-type-check`, else `typescript`** (NOT first-occurrence-wins). Rationale: a real template error must never be mislabeled `typescript`. Lock this reducer behavior in a test.

### Rule catalog: on-demand, all families (RULE-01)
- **D-05:** Switch `sarif-report.ts` from "always add the 18 `NG8xxx` catalog rules" to "catalog exactly one rule per DISTINCT `ruleId` actually present in `result.diagnostics`." A first pass over the diagnostics builds `Map<ruleId, { family, level, shortDescription, helpUri, helpText }>`; a rule is added per map entry; the result-emit loop is otherwise unchanged (still one result per diagnostic, never-drop). RULE-01 = catalog-on-demand; do NOT attempt to pre-enumerate the open-ended `TSxxxx` space.

### Rule field sources (RULE-02/03/04)
- **D-06:** `properties.tags = [family]` from `familyOf` (RULE-02). `defaultConfiguration.level` = the observed SARIF level for that `ruleId`, computed by REUSING the existing `toSarifLevel(record.severity)` mapping already in `sarif-report.ts` (`error->error`, `warning->warning`, `suggestion|message->note`); accurate, not guessed (RULE-03). Tie-break if a `ruleId` is ever observed with mixed severities in one run: first observed (a code has one configured severity per compilation in the normal case) -- document it.
- **D-07:** `help.text` (RULE-04, distinct from `helpUri` -- `helpUri` alone leaves "No rule help available"):
  - `extended-diagnostics` (`NG8xxx`): seed `help.text` from the existing catalog `shortDescription`; keep the existing `helpUri` (`https://angular.dev/extended-diagnostics/NG<code>`).
  - `tool` (`ATC900x`): curated per-code `help.text` + a `helpUri` to the repo README / docs anchor.
  - `typescript` (`TSxxxx`): a per-FAMILY generic `help.text` template + a `helpUri` to the TypeScript error reference. Per-code help for TS is an explicit anti-feature (thousands of codes).
  - `template-type-check` (negative non-catalog `NG`, or `.html`-attributed TS): a per-family generic `help.text` + a `helpUri` to Angular template-type-check docs.
- **D-08:** `shortDescription.text`: `NG8xxx` from the catalog `shortDescription`; `ATC900x` curated; `TSxxxx` generated (`"TypeScript diagnostic TS####"`); `template-type-check` generated. A rule's short description describes the RULE, never a single occurrence's message.

### Mechanics / no new dependency
- **D-09:** Set the three new fields by MUTATING `SarifRuleBuilder.rule` directly (`rb.rule.properties = { tags: [family] }`; `rb.rule.defaultConfiguration = { level }`; `rb.rule.help = { text }`) -- `initSimple` does not cover them. This is the same escape hatch the module already uses for `resultBuilder.result.partialFingerprints`. `SarifRuleBuilder.rule` is typed `ReportingDescriptor` (bundled `@types/sarif`), so all three type-check with no cast. NO new dependency; the lazy `await import('node-sarif-builder')` firewall is unchanged.

### Scope guards + stale-comment fix
- **D-10:** `src/core/extended-catalog.ts` schema stays UNCHANGED (family is code-derived; level is result-derived; `help.text` for NG is seeded from the existing `shortDescription`). A richer per-entry NG `help` string is a later nicety, not required for RULE-04.
- **D-11:** FIX the stale `sarif-report.ts` header comment. It currently claims "no `ruleIndex` is emitted" and (per prior notes) that `run.artifacts` is not emitted; research finding #4 confirms `node-sarif-builder@4.1.0`'s `completeRunFields()` AUTO-emits `run.artifacts[]` and AUTO-sets `result.ruleIndex`. The v0.2.3 SARIF already carries both, yet the "Scanned files" panel stays empty -- the doc must not claim otherwise. (Fold the doc correction here; the panel limitation itself is DOC-01 / Phase 36.)
- **D-12:** Prove the SARIF-only boundary: `json-report.ts`, `diagnostic-record.ts`, `format-report.ts` are DO-NOT-TOUCH; `FORMAT_VERSION` stays `1`; the JSON key-drift snapshot tripwire stays green; the standing additive audit vs `@0.2.3` must show only `sarif-report.*` + the new `diagnostic-family.ts`. The updated SARIF spec/snapshots ("rules match the fired ruleIds, each with tags/level/help" replacing "18 rules always present") ARE the release-bearing delta.

### Claude's Discretion
- Exact wording of the per-family `help.text` templates and the curated `ATC900x` help/short strings (keep end-user-facing, consumer language -- not internal/board jargon).
- Precise `helpUri` targets (TS error reference URL, Angular template-type-check docs URL, repo README anchor for ATC).
- Whether the family reducer lives as a small `Map`-fold inside `sarif-report.ts` or as a helper in `diagnostic-family.ts` -- planner/executor decides.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + roadmap (locked scope)
- `.planning/REQUIREMENTS.md` -- RULE-01..04 (the release-bearing SARIF change), RULE-FUT-01 (deferred inline-template precision), and the Out-of-Scope table (no `run.artifacts`, no taxonomies, no Issue filed).
- `.planning/ROADMAP.md` (Phase 33 detail) -- goal + the 5 success criteria; the "sole release-bearing change" attribution.

### Milestone research (v0.2.4, namespaced -- do NOT clobber)
- `.planning/research/v0.2.4-enhanced-sarif-reporting/SUMMARY.md` -- key findings incl. the family-derivation classifier, the `.rule` escape hatch, and finding #4 (node-sarif-builder auto-emits artifacts + ruleIndex -> stale-comment fix).
- `.planning/research/v0.2.4-enhanced-sarif-reporting/ARCHITECTURE.md` §1 -- current-state analysis, the new-vs-modified file table, the family-classifier pseudocode, and the "any-`.html`-wins vs first-wins -> pick one + lock a test" gap.
- `.planning/research/v0.2.4-enhanced-sarif-reporting/FEATURES.md` -- table-stakes (RULE-01..04), the anti-features (per-family runs, per-code TS help, taxonomies), and Pitfall 3 (RULE-01 is catalog-on-demand, not enumeration).
- `.planning/research/v0.2.4-enhanced-sarif-reporting/PITFALLS.md` -- SARIF-emit and Code Scanning pitfalls for this milestone.

### Source under change (grounded at HEAD)
- `packages/angular-typechecker/src/core/sarif-report.ts` -- the MODIFIED module: today loops all 18 NG rules unconditionally (RULE-01 gap), carries no tags/level/help (RULE-02/03/04 gap); already uses the `.result.partialFingerprints` escape hatch (the pattern D-09 extends); `toSarifLevel` (reuse for RULE-03); the stale header comment (D-11).
- `packages/angular-typechecker/src/core/diagnostic-record.ts` -- `DiagnosticRecord` shape (`rawCode` + `file` are all `familyOf` needs; D-01 adds NO field); `codeStringOf` (the `<0` / `>=90000` / else boundaries the classifier mirrors); `toDiagnosticRecord`. DO-NOT-TOUCH (D-12).
- `packages/angular-typechecker/src/core/extended-catalog.ts` -- the 18 `NG8xxx` catalog; `shortDescription` seeds NG `help.text` (D-07); schema unchanged (D-10).
- `packages/angular-typechecker/src/core/diagnostic-codes.ts` -- `ngCodeOf` (negative-code -> NG humanization; never re-derive).
- `packages/angular-typechecker/src/core/json-report.ts`, `format-report.ts` -- DO-NOT-TOUCH regression proof surfaces (D-12).

### Tests that encode the release-bearing delta
- `packages/angular-typechecker/src/core/sarif-report.spec.ts` -- the "18 rules always present" assertion becomes "rules match the fired ruleIds, each with tags/level/help."
- `packages/angular-typechecker/src/core/machine-reporters-sarif.integration.spec.ts` (+ `__snapshots__/`) -- must assert real cold-compiler diagnostics get correct family tags across all four families (needs a fixture emitting >=1 TS + external-template + NG8xxx + ATC diagnostic).

### Empirical evidence (external)
- Closed spike PR #53 (`LayZeeDK/angular-typechecker`) -- PROVED live in Code Scanning that rule `properties.tags` + catalog + `help` make `tag:` / `severity:` / `rule:` filters + the rule-help panel work; and that `run.artifacts` is inert for the Scanned-files panel.
- Auto-memory `code-scanning-sarif-empirical-behavior` -- same finding, plus PR-ref alerts not hitting the main alerts view.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `toSarifLevel(record.severity)` in `sarif-report.ts` -- already maps `error/warning/suggestion/message` to SARIF `error/warning/note`. Reuse it verbatim for `defaultConfiguration.level` (RULE-03); do not invent a second mapping.
- `resultBuilder.result.partialFingerprints = {...}` in `sarif-report.ts` -- the existing precedent for setting a SARIF field that `initSimple` does not expose; `rb.rule.properties/defaultConfiguration/help` (D-09) is the identical pattern one level up.
- `EXTENDED_DIAGNOSTIC_CATALOG` (`extended-catalog.ts`) -- the source of NG `shortDescription` + `helpUri` (`https://angular.dev/extended-diagnostics/NG<code>`), reused for the `extended-diagnostics` family rules.
- `codeStringOf(rawCode)` (`diagnostic-record.ts`) -- the canonical `<0` / `>=90000` / else split; the family classifier mirrors these exact boundaries so code label and family never disagree.

### Established Patterns
- SARIF is reached ONLY via `await import('node-sarif-builder')` (D-03/D-04 firewall); a `.json` `require` of `package.json` does not breach it. The new `diagnostic-family.ts` must stay pure `src/core` (no `console`/`process`/compiler-cli) so it never breaches the firewall either.
- The shared `toDiagnosticRecord` projection (D-13 in prior phases) is the single source both machine reporters map through; keeping family OUT of the record is what preserves JSON/SARIF non-divergence.
- Standing additive-only audit vs the previous published version gates every release; the repo's byte-for-byte diff catches an accidental JSON/human change.

### Integration Points
- `sarif-report.ts` is invoked by the reporter seam (`render-report.ts` lazy import); no adapter (Nx executor / Angular CLI builder / standalone CLI) changes -- all three consume the same `formatSarifReport`.
- The new `diagnostic-family.ts` is imported by `sarif-report.ts` only.

</code_context>

<specifics>
## Specific Ideas

- The four family tag literals are FIXED by RULE-02: `typescript`, `template-type-check`, `extended-diagnostics`, `tool`. Do not rename or add a fifth.
- Family derivation must be provable across all four families in ONE integration test fixture (>=1 TS + external `.html` template + `NG8xxx` + `ATC` diagnostic). The ATC diagnostic may require a second engine-state condition (e.g. a not-found reference) since ATC codes are synthesized, not source errors.
- `help` != `helpUri`: the alert rule-help panel needs `help.text`; keep `helpUri` too.

</specifics>

<deferred>
## Deferred Ideas

- Precise inline-template-vs-code family disambiguation (an inline-template TS error tagged `template-type-check`) -- RULE-FUT-01, deferred unless the coarse `.html` heuristic proves insufficient.
- Richer per-entry `help` strings on `extended-catalog.ts` (beyond seeding from `shortDescription`) -- optional nicety, not required for RULE-04.
- Per-project CI SARIF categories + discovery + drift guard -- Phase 34 (MULTI).
- Automated `gh api` Code Scanning proof fixture -- Phase 35 (PROOF).
- `code-scanning` job in the required `ci` aggregate + "Require code scanning results" ruleset + Scanned-files limitation docs -- Phase 36 (GATE/DOC).

None of the above is in scope for Phase 33.

</deferred>

---

*Phase: 33-diagnostic-family-sarif-rule-metadata*
*Context gathered: 2026-07-21*
