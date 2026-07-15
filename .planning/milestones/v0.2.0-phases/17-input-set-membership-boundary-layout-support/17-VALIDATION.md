---
phase: 17
slug: input-set-membership-boundary-layout-support
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-06
updated: 2026-07-06
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x via `@nx/vitest:test` (ESM; `@angular/compiler-cli` is ESM-only) |
| **Config file** | `packages/angular-typechecker/vitest.config.mts` |
| **Quick run command** | `npx nx test angular-typechecker` |
| **Full suite command** | `npx nx test angular-typechecker` (+ `npx nx build angular-typechecker` before any tarball/e2e tier) |
| **Result (post-execution)** | 311 tests / 40 files green; `nx build` 0 errors; `nx lint` clean |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test angular-typechecker` (unit tier: `keep()` + verdict; fast).
- **After every plan wave:** Run the full `npx nx test angular-typechecker` (incl. integration fixtures).
- **Before `/gsd:verify-work`:** Full suite green + `npx nx build angular-typechecker` + `format:check` + `lint` (CI gates).
- **Max feedback latency:** ~90 s.

---

## Per-Task Verification Map

*Anchored to the D-09 / D-09a scope. Statuses completed by `/gsd-validate-phase`
post-execution against the merged, green tree.*

| Plan | Wave | Requirement | Secure Behavior | Test Type | Test File(s) | Status |
|------|------|-------------|-----------------|-----------|--------------|--------|
| 17-01 | 1 | SB-02 | pure `keep()` branches a-d + dual-identity + branch-4a; zero ngtsc internals | unit + structural | `filter-diagnostics.spec.ts`, `filter-diagnostics.structural.spec.ts` | ✅ COVERED |
| 17-02 | 1 | SB-02 | `WalkResult.rootNamePaths` = union of surviving leaves' declared rootNames | unit | `walk-references.spec.ts` | ✅ COVERED |
| 17-03 | 2 | SB-01, SB-02 | `inputTs` threaded through the single finalize->filter chokepoint; split counters | unit + integration | `run-typecheck.spec.ts`, `run-typecheck.integration.spec.ts`, `infra-failure.spec.ts` | ✅ COVERED |
| 17-04 | 3 | SB-04 | late-bound coverage-incomplete verdict (maxWarnings, incl. `:0`) + exit codes | unit | `evaluate-result.spec.ts`, `exit-codes.spec.ts` | ✅ COVERED |
| 17-05 | 3 | SB-04 | loud rendering of both suppressed counts; content isolation (paths only) | unit | `executor.spec.ts` | ✅ COVERED |
| 17-06 | 4 | SB-01, SB-03 | Layout A + Layout B cold-compiler proof of the 5 phase success criteria | integration | `layout-a.integration.spec.ts`, `layout-b.integration.spec.ts` | ✅ COVERED |
| 17-07 | 4 | SB-01 (D-09a) | dual-identity, external-template `relatedInformation` attribution, fault isolation tripwires | tripwire + integration | `dual-identity-tripwire.spec.ts`, `external-template.integration.spec.ts`, `fault-isolation.integration.spec.ts` | ✅ COVERED |

---

## Wave 0 Requirements

- [x] Unit spec for the pure `keep(diagnostic, inputSet, options)` (synthetic diagnostics + synthetic input set): every branch a-d, the branch-4a `relatedInformation` map + unmappable default-KEEP, dual-identity raw/full recovery. — `filter-diagnostics.spec.ts`
- [x] Unit spec for the late-bound verdict: `suppressedInGraphErrorCount` / `suppressedInGraphWarningCount` gated in `evaluateResult` with `maxWarnings` (incl. the `maxWarnings: 0` warning case) + `toExitCode` mapping; `outcome` discriminant. — `evaluate-result.spec.ts`, `exit-codes.spec.ts`
- [x] Tripwire fixtures (D-09a): external `.html` + indirect inline template clean host -> `suppressedInGraph == 0`; declared-root error KEPT on case-insensitive / case-sensitive / symlink FS + transitive dep NOT kept; shim + external-template never silently dropped; FM-9 new-TCB-Fatal drift probe. — `dual-identity-tripwire.spec.ts`, `external-template.integration.spec.ts`, `fault-isolation.integration.spec.ts`

*Existing Vitest infrastructure covers the framework; these are the new phase-specific specs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| — | — | — | All Phase-17 behaviors have automated verification (unit + integration fixtures). |

*The FORCE-INSTALLED `@storybook/angular@10` real-generator matrix + packaged-tarball e2e are Phase 18 (SB-06), not Phase 17.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated (2026-07-06)

---

## Validation Audit 2026-07-06

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All Phase-17 requirements (SB-01/02/03/04) and Wave-0 specs have green automated
coverage on the merged tree (311 tests / 40 files). No MISSING or PARTIAL gaps, so
no test generation was required; `nyquist_compliant` flipped to `true`.
