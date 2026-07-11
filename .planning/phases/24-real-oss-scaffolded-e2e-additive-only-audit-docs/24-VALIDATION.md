---
phase: 24
slug: real-oss-scaffolded-e2e-additive-only-audit-docs
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-11
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ~4.1 via `@nx/vitest:test` |
| **Config file** | per-project `vitest.config.mts` (plugin + each `e2e/*`) |
| **Quick run command** | `npx nx test angular-typechecker` |
| **Full suite command** | `npx nx run-many -t test -p angular-typechecker test-util` + the e2e gate `npx nx run-many -t e2e --parallel=1` |
| **Estimated runtime** | ~60s plugin unit/integration; e2e minutes (real pack/install) |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test angular-typechecker`
- **After every plan wave:** Run the full plugin suite (+ the affected e2e project)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~60 seconds (unit/integration tier)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 24-XX-XX | XX | 1 | ACV-0X | T-24-0X / — | {expected behavior or "N/A"} | integration/e2e | `{command}` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. Filled by `/gsd:validate-phase` / the Nyquist auditor from RESEARCH.md `## Validation Architecture`.*

---

## Wave 0 Requirements

- [ ] To be derived by the planner from RESEARCH.md `## Validation Architecture` (the new `ng-cli-e2e` project scaffolding, the builder-over-`BuilderContext` integration harness, and the docs tripwire).

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-clone tarball e2e (`ng add` -> `ng run <project>:typecheck`) against `bluehalo/ngx-leaflet` then `realworld-angular/realworld-angular` | ACV-01 | Clones are UNCOMMITTED; cannot run in CI | Documented UAT: URL + SHA, pack shipped tarball, `ng add`, plant + assert, clean baseline |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
