---
phase: 9
slug: resilience-per-file-fault-isolation-boundary-robustness
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-29
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `09-RESEARCH.md` "Validation Architecture". Per-task rows are
> requirement-level until the planner assigns task IDs; `/gsd:validate-phase`
> reconciles them after execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x via `@nx/vitest:test` (`environment: jsdom`, `globals: true`) |
| **Config file** | `packages/angular-typechecker/vitest.config.mts` (`testTimeout`/`hookTimeout` already 30000ms for cold-compiler specs) |
| **Quick run command** | `npx nx test angular-typechecker -- <file>` (single spec) |
| **Full suite command** | `npx nx test angular-typechecker` (target `dependsOn: ["build"]`) |
| **Estimated runtime** | unit specs: seconds; cold-compiler integration specs: ~tens of seconds each |

---

## Sampling Rate

- **After every task commit:** Run the single new/extended spec for the task (`-- <file>`). Unit specs (RES-03, RES-04 unit) run in seconds; the RES-02 cold-compiler integration spec runs in ~tens of seconds.
- **After every plan wave:** Run the full suite `npx nx test angular-typechecker` — proves no regression in COR/ENG/OUT coverage and that the per-file loop did not change the diagnostic SET on clean / ordinarily-erroring fixtures.
- **Before `/gsd:verify-work`:** Full suite green AND the RES-01 GO artifact present/recorded.
- **Max feedback latency:** < 60 seconds (single integration spec, cold-compiler ceiling).

---

## Per-Task Verification Map

> Requirement-level until the planner assigns task IDs. Gate ordering (RES-01 before RES-02) is enforced by plan sequencing, not a runtime check.

| Req | Plan (expected) | Wave | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|-----|-----------------|------|------------|-----------------|-----------|-------------------|-------------|--------|
| RES-01 (GATE) | 09-01 (spike) | 1 | T-09-01 | One poisoned component cannot hide the rest — shape proven loss-free before code | spike artifact (probe + recorded GO) | `npx nx test angular-typechecker -- res-01-spike.probe.spec.ts` (throwaway) | ❌ W0 (new) | ⬜ pending |
| RES-02 | 09-02 (gated on 09-01) | 2 | T-09-01 | A TCB-phase `FatalDiagnosticError` yields exactly one diagnostic; surviving files' diagnostics still reported | integration (real compiler, multi-file fixture) | `npx nx test angular-typechecker -- fault-isolation.integration.spec.ts` | ❌ W0 (new spec + `fixtures/fault-isolation/`) | ⬜ pending |
| RES-03 | 09-03 | 1 | T-09-02 | A throwing `realpath()` is caught; in-project diagnostics still kept; pass does not abort | unit (pure, injected throwing realpath stub) | `npx nx test angular-typechecker -- filter-diagnostics.spec.ts` | ✅ (extend existing) | ⬜ pending |
| RES-04 | 09-04 | 1 | T-09-03 | `suppressOutputPathCheck: true` passed to `readConfiguration`; no output-path nuisance diagnostic surfaces; safe under `noEmit:true` | unit (`readConfiguration` spy) + integration (no-nuisance assertion) | `npx nx test angular-typechecker -- run-typecheck.spec.ts` + a no-nuisance integration spec | ✅ (extend) / ❌ W0 (new integration) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Plan IDs and waves are the research's expected shape; the planner is authoritative.*

---

## Wave 0 Requirements

- [ ] RES-01 spike probe (throwaway): exercises `getNonTemplateDiagnostics`'s `d.file` shape on a fixture that produces non-template diagnostics; records the GO artifact (SIMPLE | HYBRID). Per D-03, inconclusive → HYBRID.
- [ ] `fixtures/fault-isolation/` (NEW): multi-file fixture — one TCB-poisoning component (`IMPORT_GENERATION_FAILURE`: a template referencing a non-exported / local-only symbol) + one survivor component with a plain template error.
- [ ] `fault-isolation.integration.spec.ts` (NEW): RES-02 failing-then-passing isolation proof (pre-change: survivor diagnostic absent; post-change: present).
- [ ] `filter-diagnostics.spec.ts` (EXTEND): add the throwing-realpath case (inject `realpath: () => { throw new Error('EACCES'); }`) — RES-03.
- [ ] `run-typecheck.spec.ts` (EXTEND) + a no-nuisance integration assertion — RES-04 (`readConfiguration` second-arg + safe-under-`noEmit` proof).
- [ ] Framework install: none — Vitest infrastructure exists.

*Existing test infrastructure (the `runTypecheck`-against-workspace-root-`fixtures/` idiom + the pure `filterDiagnostics`-with-injected-realpath idiom + the raised cold-compiler timeout) covers all four requirements with NO new harness.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| RES-01 GO decision quality | RES-01 | The spike's empirical judgement (did it POSITIVELY enumerate every non-template diagnostic as file-bearing-and-matched, or default to HYBRID?) is a human/agent-reviewable artifact, not a permanent assertion | Read the recorded GO artifact: confirm it states SIMPLE only with positive proof, else HYBRID; verify the v22.0.4 citations and the fixture used |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
