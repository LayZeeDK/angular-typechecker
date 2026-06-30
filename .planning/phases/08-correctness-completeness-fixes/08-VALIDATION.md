---
phase: 8
slug: correctness-completeness-fixes
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-29
updated: 2026-06-29
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Audited post-execution: all 4 COR requirements have green automated coverage; no gaps.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 (`@nx/vitest:test`) |
| **Config file** | `packages/angular-typechecker/vitest.config.mts` (testTimeout 30000ms) |
| **Quick run command** | `npx nx test angular-typechecker` |
| **Full suite command** | `npx nx test angular-typechecker` |
| **Suite size** | 22 files / 123 tests (all green) |

---

## Sampling Rate

- **After every task commit:** `npx nx test angular-typechecker`
- **After every plan wave:** `npx nx test angular-typechecker` (full suite)
- **Before verification:** Full suite green (achieved: 123/123)
- **Max feedback latency:** ~9s test run (full integrated gate ~build+test+lint)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Test File(s) | Status |
|---------|------|------|-------------|-----------|-------------------|--------------|--------|
| 08-01-T1 | 01 | 1 | COR-01 | unit+integration | `npx nx test angular-typechecker` | infra-failure.spec.ts; config-resolution.integration.spec.ts | green |
| 08-01-T2 | 01 | 1 | COR-01 | unit+integration | `npx nx test angular-typechecker` | infra-failure.spec.ts (500 twin + 5012 contrast); config-resolution.integration.spec.ts (nonexistent-path) | green |
| 08-02-T1 | 02 | 1 | COR-02 | unit+integration | `npx nx test angular-typechecker` | gather-diagnostics.spec.ts; global-diagnostics.integration.spec.ts | green |
| 08-02-T2 | 02 | 1 | COR-02 | integration | `npx nx test angular-typechecker` | global-diagnostics.integration.spec.ts (raw TS2318 surfaces) | green |
| 08-03-T1 | 03 | 1 | COR-03 | unit | `npx nx test angular-typechecker` | filter-diagnostics.spec.ts (`diag('')` kept, suppressed 0) | green |
| 08-03-T2 | 03 | 1 | COR-04 | unit | `npx nx test angular-typechecker` + `npx nx lint angular-typechecker` | exit-codes.spec.ts (2/1/0 branches); executor.spec.ts (distinct infra message) | green |

*Status: pending / green / red / flaky*

---

## Gap Analysis

| Requirement | Coverage | Verdict |
|-------------|----------|---------|
| COR-01 | infra-failure.spec.ts + config-resolution.integration.spec.ts (failing-then-passing) | COVERED |
| COR-02 | gather-diagnostics.spec.ts + global-diagnostics.integration.spec.ts (TS2318) | COVERED |
| COR-03 | filter-diagnostics.spec.ts (empty-fileName kept) | COVERED |
| COR-04 | exit-codes.spec.ts (toExitCode 2/1/0) + executor.spec.ts (distinct infra message) | COVERED |

No MISSING or PARTIAL requirements. No tests generated (existing failing-then-passing coverage is complete). gsd-nyquist-auditor not spawned (no gaps).

---

## Wave 0 Requirements

Existing Vitest infrastructure (established in v0.0.1) covers all phase requirements. Each COR fix added its own failing-then-passing spec; COR-04 added `core/exit-codes.spec.ts`. No Wave 0 scaffolding needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| (none) | | | |

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none missing)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-29

---

## Validation Audit 2026-06-29

| Metric | Count |
|--------|-------|
| Requirements audited | 4 (COR-01..04) |
| Covered | 4 |
| Partial | 0 |
| Missing | 0 |
| Tests generated | 0 (coverage already complete) |
| Escalated | 0 |
