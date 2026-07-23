---
phase: 33
phase_name: "diagnostic-family-sarif-rule-metadata"
project: "angular-typechecker"
generated: "2026-07-21"
counts:
  decisions: 5
  lessons: 3
  patterns: 3
  surprises: 2
missing_artifacts:
  - "33-UAT.md (no human verification items; verification passed autonomously)"
---

# Phase 33 Learnings: diagnostic-family-sarif-rule-metadata

## Decisions

### Family classifier is a pure, non-barrel-exported src/core module
`familyOf(record): Family` lives in a new `src/core/diagnostic-family.ts`, reads ONLY
`rawCode` + `file`, adds no field to `DiagnosticRecord`, and is imported by
`sarif-report.ts` alone (never re-exported from `src/index.ts`).

**Rationale:** Deriving family inside the SARIF path only keeps the public API and the
additive-only audit clean, and guarantees JSON/human output cannot drift (D-01/D-12).
**Source:** 33-01-PLAN.md, 33-01-SUMMARY.md

### On-demand rule catalog replaces the fixed 18-NG catalog
The SARIF reporter now catalogs one reporting descriptor per DISTINCT fired `ruleId`
(empty `rules[]` on a clean run), each carrying `properties.tags`,
`defaultConfiguration.level`, and `help.text`.

**Rationale:** Matches the CodeQL/ESLint norm (rules reflect the actual run), closes the
blank-rule-description / no-`tag:`-filter / "No rule help available" gaps for ALL families
rather than only the 18 NG8xxx (RULE-01..04).
**Source:** 33-01-PLAN.md (D-05), 33-01-SUMMARY.md

### tags/level/help set via the `.rule` mutation with no cast and no new dependency
The three fields `initSimple` cannot express are assigned directly onto
`SarifRuleBuilder.rule` (a `ReportingDescriptor`).

**Rationale:** `@types/sarif` types all three natively so no cast is needed, and it mirrors
the shipped `result.partialFingerprints` precedent one level down; the published
dependencies gain nothing (D-09).
**Source:** 33-01-SUMMARY.md

### Prove the four families with existing per-family fixtures, not one combined fixture
The integration tier reuses committed fixtures (layout-b-host, global-diagnostics, an
extended-* fixture, a solution-style missing-reference fixture) rather than building one
bespoke composite fixture.

**Rationale:** The combined-fixture idea was only MEDIUM confidence (depended on unverified
reference-walk co-surfacing); reuse is HIGH confidence and leaner, and the unit tier already
locks all four families authoritatively with synthesized records.
**Source:** 33-02-PLAN.md, 33-02-SUMMARY.md, 33-VERIFICATION.md

### tool-family helpUri = repo information URI (author no new README this phase)
The synthesized `tool` (ATC900x) rules point `helpUri` at the repo information URI rather
than a new README anchor.

**Rationale:** Keeps the additive audit scoped to `src/` (no doc surface touched); `help.text`
is the RULE-04-critical field regardless of the URI, and the TS + template-type-check external
helpUris were confirmed to resolve (200).
**Source:** 33-01-SUMMARY.md

---

## Lessons

### `nx test` does NOT run the integration tier
`vitest.config.mts` excludes `**/*.integration.spec.ts`; the real-cold-compiler specs
(`machine-reporters-sarif.integration.spec.ts`) run under a SEPARATE `nx integration`
target. Both plans' verification text described `nx test` as "unit + integration", which is
inaccurate.

**Context:** Surfaced first in 33-01 (why plan 01's battery stayed green while the
integration snapshot regen was correctly deferred to 33-02) and again as a 33-02 deviation.
Any full local/phase gate for this repo MUST run `nx test` AND `nx integration` separately.
**Source:** 33-01-SUMMARY.md (Issues Encountered), 33-02-SUMMARY.md (Deviations)

### A family-tag upgrade must rebuild the FULL rule metadata, not just flip the tag
The PASS-1 fold's `typescript -> template-type-check` upgrade originally mutated only
`existing.family`, leaving the first occurrence's `shortDescription`/`helpUri`/`help.text`,
so a `TS2322` seen in a `.ts` file then an external `.html` template emitted a
`template-type-check`-tagged rule that still described TypeScript -- order-dependent
metadata (code review WR-01, fixed in 029b45d by rebuilding via `buildRuleMeta` and
preserving the first-observed level).

**Context:** The D-04 test asserted only `properties.tags`, so it missed the description
drift. Lesson: when a reducer upgrades a multi-field record, assert EVERY derived field, not
just the discriminant.
**Source:** 33-REVIEW.md (WR-01), commit 029b45d

### The repo's format gate is `nx format:check`, not a per-project `format` target
`npx nx run angular-typechecker:format:check` fails ("Cannot find configuration for task
angular-typechecker:format") -- the project has no `format` target. The workspace-level
`npx nx format:check` is the real gate.

**Context:** Both plans' verification text named the non-existent per-project target; both
executors corrected to `nx format:check`. Fix future plan templates accordingly.
**Source:** 33-01-SUMMARY.md, 33-02-SUMMARY.md (Deviations)

---

## Patterns

### `.rule` mutation escape hatch for SARIF fields `initSimple` cannot express
Build the descriptor with `SarifRuleBuilder.initSimple(...)`, then assign
`ruleBuilder.rule.properties` / `.defaultConfiguration` / `.help` directly.

**When to use:** Any time `node-sarif-builder`'s `initSimple` lacks a parameter for a
`ReportingDescriptor`/`Result` field you need; `@types/sarif` types them so no cast is
required. Mirrors the shipped `result.partialFingerprints` write.
**Source:** 33-01-SUMMARY.md

### Derive presentation-only data inside the reporter, never on the shared record
Family is computed inside the SARIF path from the already-projected `DiagnosticRecord`
fields; no field is added to `DiagnosticRecord`.

**When to use:** When a single reporter needs derived metadata but the JSON/human reporters
and the shared record must stay byte-identical for an additive-only release.
**Source:** 33-01-SUMMARY.md

### Additive-audit post-review addendum instead of a rewrite
When a post-review fix (WR-01) landed within the already-audited file set, the audit got a
"section 6 addendum" that re-confirmed the 7-file boundary + empty do-not-touch diffs at the
new HEAD, rather than rewriting the whole audit.

**When to use:** Any time code changes after a written additive/security audit but stays
inside the already-audited surface -- re-verify the boundary and append, keeping the original
verdict traceable.
**Source:** 33-ADDITIVE-AUDIT.md (section 6), 33-SECURITY.md

---

## Surprises

### fallow's `fail` verdict was a project-level false signal, not a phase defect
The structural pre-pass reported `verdict: fail` with ZERO phase-scoped findings; the one
complexity finding (`buildRuleMeta`, cyclomatic 11) rode an "estimated" (not measured)
coverage tier.

**Impact:** None on the phase -- the code reviewer correctly dismissed it: `buildRuleMeta`
is a flat four-family classifier with load-bearing order, exercised across all four families
by both the unit and real-fixture integration tiers. The `fail` reflects import-graph
reachability (`familyOf` reads as "unused" from entry points because it is intentionally not
barrel-exported), a known false-positive class for this repo.
**Source:** 33-REVIEW.md (structural findings disposition)

### A valid review suggestion collided with the phase's byte-unchanged boundary
IN-01 proposed a shared `SYNTHESIZED_CODE_FLOOR` const for the `90000` literal duplicated in
`diagnostic-family.ts` and `diagnostic-record.ts`.

**Impact:** Deferred, not applied -- realizing IN-01 would require editing
`diagnostic-record.ts`, which D-10/D-12 freeze byte-unchanged this phase (the additive audit
depends on it); a one-sided const would not achieve single-source-of-truth. Lesson: an
info-level suggestion can be correct in general yet out of scope under an additive charter --
record the deferral with its reason rather than partially implementing it.
**Source:** 33-REVIEW.md (Resolution)
