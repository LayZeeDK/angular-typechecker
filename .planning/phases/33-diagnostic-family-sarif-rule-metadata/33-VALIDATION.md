---
phase: 33
slug: diagnostic-family-sarif-rule-metadata
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-21
validated: 2026-07-21
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded at plan time from `33-RESEARCH.md` "## Validation Architecture"; the per-task map + Wave 0 finalized by this retroactive `/gsd:validate-phase` audit.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 via `@nx/vitest:test` |
| **Unit tier config** | `packages/angular-typechecker/vitest.config.mts` (`test` target; EXCLUDES `**/*.integration.spec.ts`) |
| **Integration tier config** | `packages/angular-typechecker/vitest.integration.config.mts` (`integration` target; real cold-compiler fixtures) |
| **Unit run command** | `npx nx test angular-typechecker` |
| **Integration run command** | `npx nx integration angular-typechecker` |
| **Full suite command** | `npx nx test angular-typechecker && npx nx integration angular-typechecker && npx nx typecheck angular-typechecker && npx nx lint angular-typechecker` |
| **Estimated runtime** | ~6s unit / ~20s integration |

**LOAD-BEARING:** `nx test` does NOT run the SARIF integration spec (the config excludes `*.integration.spec.ts`). Both tiers MUST be run to cover this phase's requirements. (Recorded as a plan-command inaccuracy in both SUMMARYs; the map below fixes the automated command per row.)

---

## Sampling Rate

- **After every task commit:** `npx nx test angular-typechecker`
- **After every plan wave:** unit + integration + `npx nx typecheck angular-typechecker` + `npx nx lint angular-typechecker`
- **Before `/gsd:verify-work`:** full suite green + additive audit vs `@0.2.3` clean
- **Max feedback latency:** ~60 seconds

---

## Per-Requirement Verification Map

Retroactively audited 2026-07-21 (post-execution, adversarial FORCE-stance pass). Every row was independently re-run this pass (not read from SUMMARY/VERIFICATION prose) -- see "Independent Audit Evidence" below. Assessment result: **coverage adequate; no genuine gap; no new test generated** (per the "do not invent redundant tests" rule). Each RULE-01..04 critical behavior is sampled by at least one behavioral test capable of failing, at the unit tier AND the real-compiler integration tier.

| Req | Critical behavior | Tier | Test (file :: name) | Command | Status |
|-----|-------------------|------|---------------------|---------|--------|
| RULE-01 | One rule per DISTINCT fired ruleId (dedup) | unit | `sarif-report.spec.ts` :: "catalogs one rule per DISTINCT fired ruleId ..." (2 distinct); D-04 (2 occurrences -> 1 rule); D-06 (2 -> 1) | `npx nx test angular-typechecker` | green |
| RULE-01 | One rule per DISTINCT fired ruleId (dedup, real compiler) | integration | `machine-reporters-sarif.integration.spec.ts` :: global-diagnostics "catalogs exactly ONE TS2318 rule that all ten results resolve to by ruleIndex 0"; layout-b-host `['NG8002','TS2322']`; solution-style (2 results -> 1 rule) | `npx nx integration angular-typechecker` | green |
| RULE-01 | Clean run yields an EMPTY rules array | unit | `sarif-report.spec.ts` :: "renders a clean CoreResult as an EMPTY results array AND an empty on-demand rule catalog (RULE-01)" (`rules` length 0, schema-valid) | `npx nx test angular-typechecker` | green |
| RULE-01 | Every result carries a correct ruleIndex | integration | `machine-reporters-sarif.integration.spec.ts` :: `expectEveryResultResolvesToItsRule` (layout-b-host, extended-content-projection) asserts `ruleIndex` is a number AND `rules[ruleIndex].id === result.ruleId`; global-diagnostics/solution-style assert `ruleIndex 0` | `npx nx integration angular-typechecker` | green |
| RULE-01 | ruleIndex locked in the release-bearing snapshot | unit | `__snapshots__/sarif-report.spec.ts.snap` (results carry `ruleIndex` 0/1) | `npx nx test angular-typechecker` | green |
| RULE-02 | `familyOf` classifier: full 4-family boundary matrix + rawCode-before-.html order + file-less + inline-template (D-03) | unit | `diagnostic-family.spec.ts` :: 9 cases (typescript, extended-diagnostics, template-type-check, tool, `.html`-order proof, file-less, D-03 imprecision, desync guard) | `npx nx test angular-typechecker` | green |
| RULE-02 | Each rule carries `properties.tags` with EXACTLY ONE family literal -- typescript | unit + integration | `sarif-report.spec.ts` (`tags` == `['typescript']`); integration TS2322 + TS2318 | both tiers | green |
| RULE-02 | ... template-type-check (incl. D-04 any-.html-wins, both orders) | unit + integration | `sarif-report.spec.ts` :: D-04 reducer both orders + non-catalog NG8002; integration NG8002 external template | both tiers | green |
| RULE-02 | ... extended-diagnostics (keeps angular.dev helpUri) | unit + integration | `sarif-report.spec.ts` :: "tags a catalog NG code extended-diagnostics ..."; integration NG8011 | both tiers | green |
| RULE-02 | ... tool | unit + integration | `sarif-report.spec.ts` :: ATC90001 (`tags` == `['tool']`); integration ATC90002 | both tiers | green |
| RULE-03 | `defaultConfiguration.level` matches observed severity (error) | unit + integration | `sarif-report.spec.ts` (rule level `error`); integration TS2322/NG8002/TS2318/ATC90002 at `error` | both tiers | green |
| RULE-03 | ... (warning) | integration | `machine-reporters-sarif.integration.spec.ts` :: NG8011 rule at `warning` level | `npx nx integration angular-typechecker` | green |
| RULE-03 | severity -> level mapping incl. suggestion/message -> note (shared `toSarifLevel`, same fn drives rule + result level) | unit | `sarif-report.spec.ts` :: "maps each severity to its SARIF level (suggestion/message -> note)" (all 4 categories) | `npx nx test angular-typechecker` | green |
| RULE-03 | First-observed level tie-break (D-06) | unit | `sarif-report.spec.ts` :: "keeps the FIRST observed severity level for a ruleId seen at mixed severities in one run (D-06 tie-break)" (warning-first stays warning) | `npx nx test angular-typechecker` | green |
| RULE-04 | Non-empty `help.text` -- all 4 families | unit + integration | `sarif-report.spec.ts` (typescript `help.text.length > 0`, tool curated text, template text); integration asserts `help.text` non-empty on typescript/template/extended/tool | both tiers | green |
| RULE-04 | `helpUri` present ALONGSIDE `help.text` (all families) | unit | `sarif-report.spec.ts` (typescript `helpUri` defined; template/extended helpUri exact); `__snapshots__/sarif-report.spec.ts.snap` locks TS2322 + ATC90001 with BOTH `help` and `helpUri`; integration NG8011 helpUri exact | both tiers | green |
| (regression) | JSON/human byte-unchanged; no ANSI byte; verdict never masked; fingerprint uniqueness; full-shape snapshot | unit | `sarif-report.spec.ts` (no-ANSI, verdict-never-masked, fingerprint collision, snapshot) | `npx nx test angular-typechecker` | green |
| (release gate) | Additive-only vs `@0.2.3`; patch bump `0.2.3 -> 0.2.4` | audit | `33-ADDITIVE-AUDIT.md` (SARIF-path-only diff; unified `nx release --dry-run`) | manual/CI | green |

*Status: pending / green / red / flaky.*

### Adequacy Verdict: no gap to fill

Every RULE-01..04 critical behavior named in the phase brief is sampled by at least one behavioral test that can fail, at BOTH the unit tier (synthesized `DiagnosticRecord`/`ts.Diagnostic` fixtures, fast, exhaustive on classifier branches + reducer edges) and the integration tier (all four `Family` literals over REAL cold-compiler output through both `run()` and the Nx executor, schema-validated). The two tiers are complementary, not redundant: the unit tier exhaustively proves the classifier order, the any-.html-wins reducer in both orders, and the first-observed tie-break with hand-built collisions the real compiler will not conveniently produce; the integration tier proves the same tags/levels/help survive the real projection end to end and that `completeRunFields` wires `ruleIndex` on every result.

One borderline was examined and rejected as a non-gap: RULE-03's `note` level is never asserted on a rule's `defaultConfiguration.level` directly (only `error` and `warning` are). This is not a genuine gap -- the rule level and the result level are produced by the identical pure `toSarifLevel(record.severity)` function, and the suggestion/message -> `note` mapping is already sampled at the result level. Adding a note-level-rule test would be redundant coverage of the same code path, which the audit charter explicitly forbids ("do NOT invent redundant tests"). No implementation was touched; no fixture directory was added; no new spec was generated.

### Independent Audit Evidence (adversarial re-run, 2026-07-21)

Both tiers were executed fresh this pass on the merged HEAD, not sourced from prior prose:

| Command | Result |
|---------|--------|
| `npx nx test angular-typechecker` | 53 files, 565 tests passed |
| ... incl. `src/core/sarif-report.spec.ts` | 15 tests passed |
| ... incl. `src/core/diagnostic-family.spec.ts` | 9 tests passed |
| `npx nx integration angular-typechecker` | 24 files, 152 tests passed |
| ... incl. `src/core/machine-reporters-sarif.integration.spec.ts` | 21 tests passed |

Source files read in full and cross-checked against the RULE-01..04 must-haves: `src/core/diagnostic-family.ts`, `src/core/sarif-report.ts`, `src/core/diagnostic-family.spec.ts`, `src/core/sarif-report.spec.ts`, `src/core/machine-reporters-sarif.integration.spec.ts`, `src/core/__snapshots__/sarif-report.spec.ts.snap`, plus the two SUMMARYs and `33-ADDITIVE-AUDIT.md`.

---

## Wave 0 Requirements

All satisfied on disk; no framework install needed (Vitest already present).

- [x] `src/core/diagnostic-family.spec.ts` -- classifier boundary matrix across all 4 families + order proof + file-less + D-03 (RULE-02)
- [x] `src/core/sarif-report.spec.ts` -- on-demand catalog, empty-on-clean, tags/level/help, D-04 reducer, D-06 tie-break, NG catalog vs non-catalog, snapshot (RULE-01..04)
- [x] `src/core/machine-reporters-sarif.integration.spec.ts` -- all 4 families over real cold-compiler fixtures, ruleIndex resolution, schema-valid, two-run byte-stable, executor==run parity (RULE-01..04)
- [x] `__snapshots__/sarif-report.spec.ts.snap` + `__snapshots__/machine-reporters-sarif.integration.spec.ts.snap` -- release-bearing shape locks

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rule-help panel + `tag:`/`severity:` filters render in GitHub Code Scanning | RULE-02/03/04 | Requires live GitHub ingestion (proven once in spike PR #53) | Covered continuously by the downstream Phase 35 automated proof; not re-proven per-run here |

---

## Validation Sign-Off

- [x] All requirements have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-07-21 (adversarial FORCE-stance audit). RULE-01..04 each have real, passing, behavior-proving tests on disk at BOTH the unit and real-compiler integration tiers; both tiers re-run green this pass (565 + 152 tests). No genuine coverage gap found; no redundant test invented; no implementation, fixture, or out-of-scope surface touched.
