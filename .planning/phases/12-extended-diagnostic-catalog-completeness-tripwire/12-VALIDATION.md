---
phase: 12
slug: extended-diagnostic-catalog-completeness-tripwire
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-01
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `12-RESEARCH.md` § Validation Architecture. Task-level rows are finalized
> post-planning/execution by `/gsd-validate-phase` (Nyquist auditor).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `~4.1.0` via `@nx/vitest:test` (globals: true; integration specs cold-load the real `@angular/compiler-cli`) |
| **Config file** | `packages/angular-typechecker/vitest.config.mts` (`testTimeout`/`hookTimeout` 30000) + `packages/angular-typechecker/tsconfig.drift.json` (the `typecheck-drift` target) |
| **Quick run command** | `npx nx test angular-typechecker --skip-nx-cache` |
| **Full suite command** | `npx nx run-many -t typecheck-drift test -p angular-typechecker` (drift + test — the CI plugin gate) |
| **Estimated runtime** | ~30–60s (each cold `performCompilation` ~0.5s; the catalog batches fixtures to keep cell time ~9s parallelized) |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test angular-typechecker --skip-nx-cache` (the catalog spec is the unit of work — run it after each fixture/row addition).
- **After every plan wave:** Run `npx nx run-many -t typecheck-drift test -p angular-typechecker` (proves the tripwire COMPILES and the catalog is GREEN together).
- **Before `/gsd:verify-work`:** Full suite (drift + test) must be green.
- **Max feedback latency:** ~60 seconds.

---

## Per-Task Verification Map

> Seeded by REQUIREMENT (task IDs assigned by the planner; finalized by `/gsd-validate-phase`).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | CAT-01 (18 members: exact code+category+count) | — | N/A (test/doc-only phase) | integration `it.each` | `npx nx test angular-typechecker --skip-nx-cache` | ❌ W0 (new `extended-catalog.integration.spec.ts`) | ⬜ pending |
| TBD | TBD | 0 | CAT-02 (one promotion proof: NG8101 Warning→Error) | — | N/A | integration | `npx nx test angular-typechecker --skip-nx-cache` | ✅ partial (`fixtures/extended-promoted` + folded spec) | ⬜ pending |
| TBD | TBD | 0 | CAT-03 (12 baseline TS/NG codes by exact code) | — | N/A | integration `it.each` | `npx nx test angular-typechecker --skip-nx-cache` | ✅ partial (`ts-baseline`/`ng-baseline`/`gate-b-error`) + new fixtures | ⬜ pending |
| TBD | TBD | 0 | CAT-04 (single enum-keyed table; non-reproducible = `it.skip`+reason, row stays) | — | N/A | integration (table shape) | `npx nx test angular-typechecker --skip-nx-cache` | ❌ W0 (new) | ⬜ pending |
| TBD | TBD | 0 | CAT-05 (`DIAGNOSTIC-CATALOG.md` rewritten to the 18-member enum) | — | N/A | doc review + tripwire keeps the SET honest | `git diff` + `npx nx typecheck-drift angular-typechecker` | ❌ W0 (doc rewrite) | ⬜ pending |
| TBD | TBD | 0 | DRIFT-01 (catalog set === enum; loud CI fail on drift) | — | N/A | type-level (`typecheck-drift`) | `npx nx typecheck-drift angular-typechecker` | ❌ W0 (new `extended-catalog.drift.ts`) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/angular-typechecker/src/core/extended-catalog.members.ts` — the single `as const` member-value list (D-02 source of truth) consumed by BOTH the spec and the tripwire.
- [ ] `packages/angular-typechecker/src/core/extended-catalog.integration.spec.ts` — the 18-row extended `it.each` + the baseline sibling `it.each` (folds the 3 existing specs).
- [ ] `packages/angular-typechecker/src/core/extended-catalog.drift.ts` — the type-level enum-vs-table tripwire; added to `tsconfig.drift.json` `files` + the `typecheck-drift` target inputs.
- [ ] New batched fixtures under `fixtures/` (~8: Batch A–D + own-programs for NG8108/8113/8021/8011) for the ~13 extended members not covered by existing fixtures, plus 1–2 baseline fixtures for the uncovered baseline codes.
- [ ] Delete the folded specs (`extended.angular13`, `extended.promotion`, `baseline.angular13`) once absorbed (D-07); update `.planning/codebase/TESTING.md` spec counts.
- [ ] Framework install: NONE — Vitest + the `typecheck-drift` target already exist.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Prose accuracy of the rewritten `DIAGNOSTIC-CATALOG.md` | CAT-05 | Documentation correctness is a human-review concern; the tripwire enforces only the SET (membership), not the prose | Review the rewritten doc against the 18-member enum table in RESEARCH.md; confirm NG8011 framed as promotable, NG8112 included, NG8110/NG8118 noted as non-enum |

*All executable behaviors (CAT-01..04, DRIFT-01) have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
