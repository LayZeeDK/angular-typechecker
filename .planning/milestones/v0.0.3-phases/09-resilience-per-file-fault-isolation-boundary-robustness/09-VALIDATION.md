---
phase: 9
slug: resilience-per-file-fault-isolation-boundary-robustness
status: audited
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-29
audited: 2026-06-29
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

> Reconciled to as-shipped after execution (`/gsd:validate-phase`). Gate ordering (RES-01 before RES-02) was enforced by plan wave order (09-02 `depends_on` 09-01). Full suite: 143 tests / 24 files green; build + lint clean.

| Req | Plan | Wave | Threat Ref | Secure Behavior | Test Type | Automated Command | Status |
|-----|------|------|------------|-----------------|-----------|-------------------|--------|
| RES-01 (GATE) | 09-01 | 1 | T-09-01 | GO decision (HYBRID) recorded before any isolation code | spike artifact (GO recorded; throwaway probe removed post-spike, IN-04) | artifact `09-RES-01-SPIKE.md` (GO=HYBRID); verified by gsd-verifier | ✅ green |
| RES-02 | 09-02 | 2 | T-09-01 | A TCB-gen `FatalDiagnosticError` yields exactly one diagnostic, no whole-run 500 collapse; survivors' TS + non-template diagnostics still reported (reframed contract) | integration (real compiler, multi-file fixture) + unit | `npx nx test angular-typechecker -- fault-isolation.integration.spec.ts` + `-- gather-diagnostics.spec.ts` | ✅ green |
| RES-02 (loud notice) | 09-05 | 3 | T-09-05 | TCB-gen Fatal surfaces a loud executor notice naming the source file; never silent | unit (pure detection) + integration + executor | `-- run-typecheck.spec.ts` + `-- fault-isolation.integration.spec.ts` + `-- executor.spec.ts` | ✅ green |
| RES-03 | 09-03 | 1 | T-09-02 | A throwing `realpath()` is caught; in-project diagnostics still kept; pass does not abort | unit (pure, injected throwing realpath stub) | `npx nx test angular-typechecker -- filter-diagnostics.spec.ts` | ✅ green |
| RES-04 | 09-04 | 1 | T-09-03 | `suppressOutputPathCheck: true` passed to `readConfiguration`; no output-path nuisance diagnostic surfaces; safe under `noEmit:true` | unit (`readConfiguration` spy) + integration (no-nuisance assertion) | `-- infra-failure.spec.ts` + `-- suppress-output-path.integration.spec.ts` | ✅ green |

*Status: pending · ✅ green · red · flaky*
*Deferred (REP-RES-02b, NgtscProgram milestone): faithful recovery of survivors' TEMPLATE diagnostics after a TCB-gen Fatal -- intentionally NOT covered here (mechanically unachievable on the locked surface; see `09-RES-02-DECISION.md`).*

---

## Wave 0 Requirements (delivered)

- [x] RES-01 spike: recorded GO=HYBRID in `09-RES-01-SPIKE.md`. The throwaway probe ran, produced the decision, and was REMOVED post-spike (IN-04) -- the GO artifact is the durable deliverable.
- [x] `fixtures/fault-isolation/` (NEW): multi-file fixture -- TCB-poison (`IMPORT_GENERATION_FAILURE`) + survivor + a non-template fixture (authored in 09-01).
- [x] `fault-isolation.integration.spec.ts` (NEW): RES-02 run-level-resilience proof (poison = one diagnostic, no whole-run 500, survivor TS diagnostic reported, `templateCheckAborted` set).
- [x] `filter-diagnostics.spec.ts` (EXTEND): throwing-realpath case -- RES-03.
- [x] `run-typecheck.spec.ts` (EXTEND) + `infra-failure.spec.ts` (spy) + `suppress-output-path.integration.spec.ts` (NEW, no-nuisance) -- RES-04.
- [x] `run-typecheck.spec.ts` + `executor.spec.ts` -- the loud-notice detection + render (09-05).
- [x] Framework install: none -- Vitest infrastructure existed.

*Existing test infrastructure (the `runTypecheck`-against-workspace-root-`fixtures/` idiom + the pure `filterDiagnostics`-with-injected-realpath idiom + the raised cold-compiler timeout) covers all four requirements with NO new harness.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| RES-01 GO decision quality | RES-01 | The spike's empirical judgement (did it POSITIVELY enumerate every non-template diagnostic as file-bearing-and-matched, or default to HYBRID?) is a human/agent-reviewable artifact, not a permanent assertion | Read the recorded GO artifact: confirm it states SIMPLE only with positive proof, else HYBRID; verify the v22.0.4 citations and the fixture used |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none -- existing infra sufficed)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-29

---

## Validation Audit 2026-06-29

| Metric | Count |
|--------|-------|
| Requirements audited | 4 (RES-01..04) + the loud notice (09-05) |
| Covered (automated/artifact) | 5 |
| Partial | 0 |
| Missing | 0 |
| Tests generated this audit | 0 (existing suite covers all SCs) |

State-A audit: no MISSING gaps -- the as-shipped suite (143 tests / 24 files, green; build + lint clean) covers every success criterion. The only deferred behavior (survivors' TEMPLATE diagnostics after a TCB-gen Fatal) is REP-RES-02b, intentionally out of scope (see `09-RES-02-DECISION.md`); recorded as a known limitation, not a coverage gap. `nyquist_compliant: true`.
