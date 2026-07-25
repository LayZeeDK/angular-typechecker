# Phase 33: Diagnostic-family SARIF rule metadata - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-07-21
**Phase:** 33-diagnostic-family-sarif-rule-metadata
**Mode:** `--auto --analyze --chain` (autonomous single pass; trade-off tables logged; auto-advance to plan)
**Areas discussed:** Family classifier, Rule-level family tie-break, Rule catalog scope, help.text strategy, shortDescription strategy, defaultConfiguration.level source, Catalog mechanics, Scope + stale-comment fix

> Trap-quadrant check: every area is either low-impact or evidence-backed (v0.2.4 milestone research + closed spike PR #53, which proved tags/catalog/help live in Code Scanning). None was high-impact + low-confidence, so none required escalation to an interactive prompt.

---

## Family classifier (RULE-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Coarse pure `familyOf({rawCode,file})` | Derive family in the SARIF path from existing record fields; no new `DiagnosticRecord` field | [x] |
| Thread diagnostic origin through `DiagnosticRecord` | Precise inline-template detection, but leaks a field into the JSON payload | |

**Choice:** coarse pure classifier. **Notes:** keeps JSON byte-identical (D-01/D-02); inline-template precision is the already-deferred RULE-FUT-01 (D-03).

---

## Rule-level family tie-break (same code in `.html` and `.ts`)

| Option | Description | Selected |
|--------|-------------|----------|
| any-`.html`-occurrence-wins | A rule seen in any `.html` is tagged `template-type-check` | [x] |
| first-occurrence-wins | The first diagnostic seen for the ruleId sets the tag | |

**Choice:** any-`.html`-wins. **Notes:** never mislabel a real template error as `typescript`; lock in a test (D-04). This resolves the MEDIUM gap flagged in ARCHITECTURE.md.

---

## Rule catalog scope (RULE-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Catalog-on-demand (one rule per fired ruleId) | Build rules from the distinct ruleIds present in the results | [x] |
| Pre-enumerate every `TSxxxx` | Impossible/unbounded; thousands of TS codes | |

**Choice:** catalog-on-demand. **Notes:** RULE-01 = "every fired diagnostic resolves to a rule", not enumeration (FEATURES.md Pitfall 3); D-05.

---

## help.text strategy (RULE-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-family template + `helpUri` (NG/ATC curated) | Generic per-family help for open-ended TS; seed NG from catalog; curate ATC | [x] |
| Hand-author per-code help | Unbounded for TS; explicit anti-feature | |

**Choice:** per-family template + curated NG/ATC. **Notes:** `help` != `helpUri` (D-07); per-code TS help is an anti-feature (FEATURES.md).

---

## shortDescription strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Per-family (catalog NG / curated ATC / generated TS+template) | Rule-level description, fixed per ruleId | [x] |
| First-seen diagnostic message | Occurrence-specific; misleading as a rule description | |

**Choice:** per-family. **Notes:** a rule describes the rule, not one occurrence (D-08).

---

## defaultConfiguration.level source (RULE-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Observed level via existing `toSarifLevel` | Reuse the shipped severity->level mapping; accurate | [x] |
| Guessed/static per family | Would misreport configurable NG severities | |

**Choice:** observed level. **Notes:** reuse `toSarifLevel`; first-observed tie-break documented (D-06).

---

## Catalog mechanics / dependency

| Option | Description | Selected |
|--------|-------------|----------|
| First-pass `Map` + mutate `SarifRuleBuilder.rule.*` | Same escape hatch already used for `partialFingerprints`; no new dep | [x] |
| Add a new SARIF dependency / builder | Unneeded; increases the require graph | |

**Choice:** `.rule` escape hatch, no new dependency (D-09).

---

## Scope + stale-comment fix

| Option | Description | Selected |
|--------|-------------|----------|
| Leave `extended-catalog.ts` schema; fix stale header comment | Family code-derived, level result-derived, NG help from shortDescription; correct the artifacts/ruleIndex comment | [x] |
| Enrich `extended-catalog.ts` schema now | Later nicety, not required for RULE-04 | |

**Choice:** minimal scope + comment fix (D-10/D-11). **Notes:** node-sarif-builder@4.1.0 auto-emits `run.artifacts[]` + `result.ruleIndex`, so the current header comment is wrong; prove SARIF-only via the additive audit (D-12).

---

## Claude's Discretion

- Exact per-family `help.text` wording and curated ATC help/short strings (end-user-facing language).
- Precise `helpUri` targets (TS error reference, Angular template-type-check docs, repo README anchor for ATC).
- Whether the `.html`-wins reducer lives inline in `sarif-report.ts` or as a helper in `diagnostic-family.ts`.

## Deferred Ideas

- RULE-FUT-01: precise inline-template-vs-code family.
- Richer per-entry NG `help` strings in `extended-catalog.ts`.
- MULTI (Phase 34), PROOF (Phase 35), GATE/DOC (Phase 36).
