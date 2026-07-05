---
phase: 17
slug: input-set-membership-boundary-layout-support
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-06
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x via `@nx/vitest:test` (ESM; `@angular/compiler-cli` is ESM-only) |
| **Config file** | `packages/angular-typechecker/vite.config.ts` (existing) |
| **Quick run command** | `npx nx test angular-typechecker` |
| **Full suite command** | `npx nx test angular-typechecker` (+ `npx nx build angular-typechecker` before any tarball/e2e tier) |
| **Estimated runtime** | ~30-90 s (cold, incl. real cold-compiler integration specs) |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test angular-typechecker` (unit tier: `keep()` + verdict; fast).
- **After every plan wave:** Run the full `npx nx test angular-typechecker` (incl. integration fixtures).
- **Before `/gsd:verify-work`:** Full suite green + `npx nx build angular-typechecker` + `format:check` + `lint` (CI gates).
- **Max feedback latency:** ~90 s.

---

## Per-Task Verification Map

*Populated by the planner (each task's `<automated>` verify) and completed by
`/gsd-validate-phase` post-execution. Anchor tests to the D-09 / D-09a scope:*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | SB-02 | — | pure `keep()` branches a-d + dual-identity | unit | `npx nx test angular-typechecker` | ❌ W0 | ⬜ pending |
| 17-01-02 | 01 | 1 | SB-04 | — | late-bound per-category coverage-incomplete verdict | unit | `npx nx test angular-typechecker` | ❌ W0 | ⬜ pending |

---

## Wave 0 Requirements

- [ ] Unit spec for the pure `keep(diagnostic, inputSet, options)` (synthetic diagnostics + synthetic input set): every branch a-d, the branch-4a `relatedInformation` map + unmappable default-KEEP, dual-identity raw/full recovery.
- [ ] Unit spec for the late-bound verdict: `suppressedInGraphErrorCount` / `suppressedInGraphWarningCount` gated in `evaluateResult` with `maxWarnings` (incl. the `maxWarnings: 0` warning case) + `toExitCode` mapping; `outcome` discriminant.
- [ ] Tripwire fixtures (D-09a): external `.html` + indirect inline template clean host → `suppressedInGraph == 0`; declared-root error KEPT on case-insensitive / case-sensitive / symlink FS + transitive dep NOT kept; shim + external-template never silently dropped; FM-9 new-TCB-Fatal drift probe.

*Existing Vitest infrastructure covers the framework; these are the new phase-specific specs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| — | — | — | All Phase-17 behaviors have automated verification (unit + integration fixtures). |

*The FORCE-INSTALLED `@storybook/angular@10` real-generator matrix + packaged-tarball e2e are Phase 18 (SB-06), not Phase 17.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
