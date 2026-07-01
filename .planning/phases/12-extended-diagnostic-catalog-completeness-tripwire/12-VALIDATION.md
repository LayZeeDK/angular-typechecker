---
phase: 12
slug: extended-diagnostic-catalog-completeness-tripwire
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-01
---

# Phase 12 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `12-RESEARCH.md` Validation Architecture; finalized post-execution by
> `/gsd-validate-phase` (Nyquist audit, 2026-07-01).

---

## Test Infrastructure

| Property               | Value                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Framework**          | Vitest `~4.1.0` via `@nx/vitest:test` (globals: true; integration specs cold-load the real `@angular/compiler-cli`)                                                      |
| **Config file**        | `packages/angular-typechecker/vitest.config.mts` (`testTimeout`/`hookTimeout` 30000) + `packages/angular-typechecker/tsconfig.drift.json` (the `typecheck-drift` target) |
| **Quick run command**  | `npx nx test angular-typechecker --skip-nx-cache`                                                                                                                        |
| **Full suite command** | `npx nx run-many -t typecheck-drift test -p angular-typechecker` (drift + test -- the CI plugin gate)                                                                    |
| **Measured runtime**   | ~17.6s test suite (24 files, 183 tests); drift + build + test run-many completes well under a minute                                                                     |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test angular-typechecker --skip-nx-cache` (the catalog spec is the unit of work -- run it after each fixture/row addition).
- **After every plan wave:** Run `npx nx run-many -t typecheck-drift test -p angular-typechecker` (proves the tripwire COMPILES and the catalog is GREEN together).
- **Before `/gsd:verify-work`:** Full suite (drift + test) must be green.
- **Max feedback latency:** ~60 seconds.

---

## Per-Task Verification Map

> Finalized post-execution. All executable requirements have automated verification, run green this session.

| Task ID | Plan  | Wave | Requirement                                                                      | Threat Ref       | Secure Behavior           | Test Type                                   | Automated Command                                                                        | File Exists                                                                                             | Status                                       |
| ------- | ----- | ---- | -------------------------------------------------------------------------------- | ---------------- | ------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| T2      | 12-02 | 2    | CAT-01 (18 members: exact code+category+count)                                   | T-12-02 (accept) | N/A (test/doc-only phase) | integration `describe.each`                 | `npx nx test angular-typechecker --skip-nx-cache`                                        | yes (`extended-catalog.integration.spec.ts`, 18 rows)                                                   | green                                        |
| T2      | 12-02 | 2    | CAT-02 (one promotion proof: NG8101 Warning->Error)                              | T-12-02 (accept) | N/A                       | integration                                 | `npx nx test angular-typechecker --skip-nx-cache`                                        | yes (`fixtures/extended-promoted` + promotion `it`)                                                     | green                                        |
| T2      | 12-03 | 3    | CAT-03 (12 baseline TS/NG codes by exact code)                                   | T-12-03 (accept) | N/A                       | integration `describe.each`                 | `npx nx test angular-typechecker --skip-nx-cache`                                        | yes (baseline sibling table + `ng-baseline-extra`/`ng-baseline-import-cycle`)                           | green                                        |
| T2      | 12-02 | 2    | CAT-04 (single enum-keyed table; non-reproducible = `it.skip`+reason, row stays) | T-12-02 (accept) | N/A                       | integration (table shape + structure guard) | `npx nx test angular-typechecker --skip-nx-cache`                                        | yes (single `describe.each` keyed on `EXTENDED_DIAGNOSTIC_MEMBERS`, intro-version a row field, 0 skips) | green                                        |
| T1      | 12-04 | 1    | CAT-05 (`DIAGNOSTIC-CATALOG.md` rewritten to the 18-member enum)                 | T-12-04 (accept) | N/A                       | doc review + tripwire keeps the SET honest  | `npx nx typecheck-drift angular-typechecker --skip-nx-cache` (set) + manual prose review | yes (doc rewritten; membership enforced by DRIFT-01)                                                    | green (automated set) / manual prose (below) |
| T2/T3   | 12-01 | 1    | DRIFT-01 (catalog set === enum; loud CI fail on drift)                           | T-12-01 (accept) | N/A                       | type-level (`typecheck-drift`)              | `npx nx typecheck-drift angular-typechecker --skip-nx-cache`                             | yes (`extended-catalog.drift.ts`; mutual set-equality; drift-fail re-proven TS2344 both directions)     | green                                        |

_Status: pending . green . red . flaky_

---

## Wave 0 Requirements

- [x] `packages/angular-typechecker/src/core/extended-catalog.members.ts` -- the single `as const` member-value list (D-02 source of truth) consumed by BOTH the spec and the tripwire.
- [x] `packages/angular-typechecker/src/core/extended-catalog.integration.spec.ts` -- the 18-row extended `describe.each` + the baseline sibling `describe.each` (folds the 3 existing specs).
- [x] `packages/angular-typechecker/src/core/extended-catalog.drift.ts` -- the type-level enum-vs-table tripwire; added to `tsconfig.drift.json` `files` + the `typecheck-drift` target inputs.
- [x] New batched fixtures under `fixtures/` (8 extended: Batch A/B/C + the D-03 `extended-ngfor-let` split + own-programs for NG8108/8113/8021/8011; 2 baseline: `ng-baseline-extra` + `ng-baseline-import-cycle`).
- [x] Delete the folded specs (`extended.angular13`, `extended.promotion`, `baseline.angular13`) once absorbed (D-07); updated `.planning/codebase/TESTING.md` spec count to 8.
- [x] Framework install: NONE -- Vitest + the `typecheck-drift` target already existed.

---

## Manual-Only Verifications

| Behavior                                                | Requirement | Why Manual                                                                                                          | Test Instructions                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Prose accuracy of the rewritten `DIAGNOSTIC-CATALOG.md` | CAT-05      | Documentation correctness is a human-review concern; the tripwire enforces only the SET (membership), not the prose | Review the rewritten doc against the 18-member enum table in RESEARCH.md; confirm NG8011 framed as promotable, NG8112 included, NG8110/NG8118 noted as non-enum. (Corroborated this phase by the deep code review + verifier, which both cross-checked the doc against `error_code.d.ts`.) |

_All executable behaviors (CAT-01..04, DRIFT-01, CAT-05 set-membership) have automated verification._

---

## Validation Audit 2026-07-01

| Metric     | Count |
| ---------- | ----- |
| Gaps found | 0     |
| Resolved   | 0     |
| Escalated  | 0     |

No coverage gaps: this phase's entire deliverable IS the test coverage. All executable requirements were verified green in-session (`nx test` 183/183 pass; `nx typecheck-drift` exit 0; DRIFT-01 loud-fail re-proven both directions and restored byte-identical). No auditor gap-fill was required. One manual-only item (CAT-05 prose accuracy) is intentional and corroborated by the deep code review and verifier.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** verified 2026-07-01
