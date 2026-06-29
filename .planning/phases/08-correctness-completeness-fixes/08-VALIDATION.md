---
phase: 8
slug: correctness-completeness-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-29
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Draft: per-task map + sign-off completed by `/gsd-validate-phase` after execution.
> Validation Architecture detail lives in `08-RESEARCH.md`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 (`@nx/vitest:test`) |
| **Config file** | `packages/angular-typechecker/vitest.config.ts` |
| **Quick run command** | `npx nx test angular-typechecker` |
| **Full suite command** | `npx nx test angular-typechecker` |
| **Estimated runtime** | ~30-60 seconds (unit + real-compiler integration) |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test angular-typechecker`
- **After every plan wave:** Run `npx nx test angular-typechecker` (full suite)
- **Before verification:** Full suite must be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (filled by /gsd-validate-phase after planning/execution) | | | COR-01..04 | | | | `npx nx test angular-typechecker` | | ⬜ pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- Existing Vitest infrastructure covers all phase requirements (unit + integration tiers established in v0.0.1). Each COR fix adds a failing-then-passing spec; COR-04 adds `core/exit-codes.spec.ts`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| (none) | | | |

*All phase behaviors have automated verification (see 08-RESEARCH.md Validation Architecture).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
