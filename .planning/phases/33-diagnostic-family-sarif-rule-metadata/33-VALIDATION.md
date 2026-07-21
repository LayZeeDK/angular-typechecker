---
phase: 33
slug: diagnostic-family-sarif-rule-metadata
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-21
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded at plan time from `33-RESEARCH.md` "## Validation Architecture"; the per-task map + Wave 0 are finalized by `/gsd:validate-phase`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (via `@nx/vitest:test`) |
| **Config file** | `packages/angular-typechecker` project (existing SARIF specs: `sarif-report.spec.ts`, `machine-reporters-sarif.integration.spec.ts`) |
| **Quick run command** | `npx nx test angular-typechecker` |
| **Full suite command** | `npx nx test angular-typechecker && npx nx typecheck angular-typechecker && npx nx lint angular-typechecker` |
| **Estimated runtime** | ~30-60 seconds (unit + integration) |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test angular-typechecker`
- **After every plan wave:** Run the full suite command
- **Before `/gsd:verify-work`:** Full suite green + additive audit vs `@0.2.3` clean
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

> Populated by `/gsd:validate-phase` from the finalized PLAN.md task IDs. Backbone from RESEARCH.md "## Validation Architecture":

| Behavior under test | Requirement | Test Type | Automated Command |
|---------------------|-------------|-----------|-------------------|
| `familyOf` classifier: TS / template-type-check / extended-diagnostics / tool (order load-bearing) | RULE-02 | unit | `npx nx test angular-typechecker` |
| Rule catalog membership = distinct fired ruleIds (0 rules on a clean run; on-demand, all families) | RULE-01 | unit + snapshot | `npx nx test angular-typechecker` |
| Each rule carries `properties.tags = [family]` | RULE-02 | unit + snapshot | `npx nx test angular-typechecker` |
| Each rule carries `defaultConfiguration.level` from observed `toSarifLevel` | RULE-03 | unit | `npx nx test angular-typechecker` |
| Each rule carries `help.text` (not only `helpUri`) | RULE-04 | unit + snapshot | `npx nx test angular-typechecker` |
| any-`.html`-occurrence-wins tie-break when one ruleId spans `.html` + `.ts` | RULE-02 | unit | `npx nx test angular-typechecker` |
| Real cold-compiler diagnostics tagged correctly across all 4 families | RULE-01..04 | integration | `npx nx test angular-typechecker` |
| JSON + human byte-unchanged; `FORMAT_VERSION` = 1; key-drift tripwire green | (regression) | unit | `npx nx test angular-typechecker` |
| Additive-only audit vs `@0.2.3` shows only `sarif-report.*` + new `diagnostic-family.*` | (release gate) | audit | the standing additive-audit e2e/script |

*Status: filled during validate-phase.*

---

## Wave 0 Requirements

- Existing Vitest infrastructure covers all phase requirements (SARIF unit + integration specs already exist). No new framework install.
- New spec surface: `diagnostic-family.spec.ts` (classifier), updated `sarif-report.spec.ts` + snapshot, updated `machine-reporters-sarif.integration.spec.ts` + snapshot. These are authored inside the phase plans, not Wave 0.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rule-help panel + `tag:`/`severity:` filters render in GitHub Code Scanning | RULE-02/03/04 | Requires live GitHub ingestion (proven once in spike PR #53) | Covered continuously by the Phase 35 automated proof; not re-proven per-run here |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
