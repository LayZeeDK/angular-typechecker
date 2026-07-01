---
phase: 09-resilience-per-file-fault-isolation-boundary-robustness
verified: 2026-06-29T22:35:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  note: initial verification (no prior VERIFICATION.md)
---

# Phase 9: Resilience (per-file fault isolation + boundary robustness) Verification Report

**Phase Goal:** The engine reports as much as it can instead of aborting on a single bad component, a throwing `realpath()`, or an output-path nuisance -- with the per-file isolation shape settled by a gate before any isolation code is written.
**Verified:** 2026-06-29T22:35:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

This phase carries a mid-phase REFRAME of RES-02 / SC2 (a locked-decision re-open,
decided with the user in `09-RES-02-DECISION.md`). Verification was performed against
the REFRAMED, achievable contract -- not the original literal wording. The literal
"surviving files' TEMPLATE/extended (NG8xxx) diagnostics are still reported" is a
DOCUMENTED, DEFERRED limitation (mechanically impossible on the `api.Program` /
`OptimizeFor.WholeProgram` surface; same as `@angular/build`), tracked as
`REQUIREMENTS.md` REP-RES-02b. Its proper RECORDING was verified (ROADMAP SC2 amended,
REQUIREMENTS RES-02 amended + REP-RES-02b added, decision doc present); the phase is
NOT failed for the intentionally-out-of-scope deferred sub-clause.

### Observable Truths

| # | Truth (reframed where applicable) | Status | Evidence |
| --- | --- | --- | --- |
| 1 (SC1 / RES-01 gate) | The RES-01 spike produced a recorded GO decision on the per-file isolation shape (SIMPLE vs HYBRID); RES-02 was gated on it. | VERIFIED | `09-RES-01-SPIKE.md` records **GO = HYBRID** with live `@angular/compiler-cli@22.0.4` empirical output (poison + non-template fixtures), the D-02/D-03 rationale (inconclusive -> strict superset), and a hand-off to plan 09-02. ROADMAP wave order encodes the gate (09-02 `depends_on 09-01`). |
| 2 (SC2 / RES-02 reframed) | One component's TCB-generation `FatalDiagnosticError` yields exactly ONE diagnostic and does NOT collapse the run to an infra-500; the run completes and surviving files' TS + Angular NON-template diagnostics are still reported, on the existing `api.Program` surface via the HYBRID gatherer; AND a TCB-gen Fatal fires a LOUD `logger.warn` naming the offending source file. | VERIFIED | HYBRID gatherer in `gather-diagnostics.ts:57-83` (residual whole-program `getNgSemanticDiagnostics()` line 69 + per-file loop lines 72-78 skipping `isDeclarationFile`, `OptimizeFor.WholeProgram` implicit, COR-02 `getGlobalDiagnostics()` line 80 retained, NO catch-all). Real-compiler proof `fault-isolation.integration.spec.ts`: exactly one NG3004 (deduped), no UNKNOWN_ERROR_CODE 500, survivor TS2322 reported, `templateCheckAborted` set naming `tcb-poison.component.ts`, and NO false-positive on an ordinary NG8001 run. Loud notice: `CoreResult.templateCheckAborted` set by `detectTemplateCheckAborted` (run-typecheck.ts:406,433-448) via `TCB_GENERATION_FATAL_DIAGNOSTIC_CODE = NG(3004)` (diagnostic-codes.ts:88), rendered by executor `logger.warn` (executor.ts:52-62) -- tested in `executor.spec.ts:147-193`. Infra-vs-type policy (D-05) preserved (no try/catch in the loop). |
| 3 (SC3 / RES-03) | A throwing `options.realpath()` in the project-boundary filter is caught and falls back to the unresolved raw path, so a realpath failure cannot abort the type-check pass; happy path unchanged. | VERIFIED | `createCanonicalizer` try/catch in `filter-diagnostics.ts:129-138` (`catch { resolved = filePath; }`), normalization + case-fold still applied. Unit proof `filter-diagnostics.spec.ts:114-126` (throwing realpath -> in-project diagnostic still kept, `suppressedCount` 0). Wired via `run-typecheck.ts:268` (`realpath: ts.sys.realpath ?? filePath`). |
| 4 (SC4 / RES-04) | The no-emit override sets `suppressOutputPathCheck: true` so output-path nuisance errors never surface in the type-only flow (safe under `noEmit: true`). | VERIFIED | `readConfiguration(options.tsConfigPath, { suppressOutputPathCheck: true })` at `run-typecheck.ts:142-144`. Spy unit `infra-failure.spec.ts:143-159` asserts the exact second-arg placement. No-nuisance behavior proven end-to-end `suppress-output-path.integration.spec.ts:50-60` (no TS5055 on the composite-triangle fixture). |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `09-RES-01-SPIKE.md` | Recorded GO=HYBRID gate decision | VERIFIED | Present; GO=HYBRID with v22.0.4 empirical evidence + D-02/D-03 rationale + 09-02 hand-off. |
| `09-RES-02-DECISION.md` | Recorded reframe (Option A) | VERIFIED | Present; DECIDED Option A (reframe + defer + loud notice), web research + 5-lens panel, COR-04 precedent. |
| `gather-diagnostics.ts` | HYBRID gatherer | VERIFIED | Residual whole-program + per-file loop (skip declaration files), `getGlobalDiagnostics()` retained, no catch-all. Wired into `performCompilation` (run-typecheck.ts:231). |
| `diagnostic-codes.ts` | TCB Fatal code (NG3004) | VERIFIED | `TCB_GENERATION_FATAL_DIAGNOSTIC_CODE = NG(3004) = -993004`; dependency-free; 3001/3003 deliberately excluded with rationale. |
| `run-typecheck.ts` | `suppressOutputPathCheck` + `templateCheckAborted` detection + filter wiring | VERIFIED | `suppressOutputPathCheck: true` (142-144); `detectTemplateCheckAborted` (433-448) pure (no console/process); `normalizeShimFileName` shim->source (469-477) with WR-01 limitation documented; realpath injected (268). |
| `filter-diagnostics.ts` | realpath try/catch + raw-path fallback | VERIFIED | `createCanonicalizer` catch -> raw path (129-138); pure (no logging). |
| `executor.ts` | Loud `logger.warn` on `templateCheckAborted` | VERIFIED | Warn fires only on presence, names offending file (or "an unknown file"), distinct from infra `logger.error`. |
| `fixtures/fault-isolation/` | Poison + survivor multi-file fixture | VERIFIED | `tcb-poison.component.{ts,html}`, `survivor.component.{ts,html}`, `tsconfig.app.json` present. |
| Test files | Unit + integration coverage across all 4 reqs | VERIFIED | `fault-isolation.integration.spec.ts`, `filter-diagnostics.spec.ts`, `gather-diagnostics.spec.ts`, `infra-failure.spec.ts`, `suppress-output-path.integration.spec.ts`, `executor.spec.ts`. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `runTypecheck` | `gatherAllDiagnostics` | `gatherDiagnostics: gatherAllDiagnostics` | WIRED | run-typecheck.ts:231. |
| `runTypecheck` | `readConfiguration` | `{ suppressOutputPathCheck: true }` second arg | WIRED | run-typecheck.ts:142-144. |
| `finalize` | `detectTemplateCheckAborted` | scan reported set, set `templateCheckAborted` | WIRED | run-typecheck.ts:406. |
| `detectTemplateCheckAborted` | `diagnostic-codes` | `=== TCB_GENERATION_FATAL_DIAGNOSTIC_CODE` | WIRED | run-typecheck.ts:7,437. |
| `executor` | `CoreResult.templateCheckAborted` | `logger.warn` branch | WIRED | executor.ts:52-62. |
| `finalize` | `filterDiagnostics` -> `createCanonicalizer` | `realpath: ts.sys.realpath` injected | WIRED | run-typecheck.ts:268 -> filter-diagnostics.ts:130. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `CoreResult.templateCheckAborted` | reported diagnostics | real `performCompilation` over `fixtures/fault-isolation/tsconfig.app.json` | YES -- live compiler emits NG3004 on the poison shim; integration spec asserts the flag is set with the real source file name | FLOWING |
| `CoreResult.diagnostics` (survivor) | reported set, post-filter, deduped | real compiler; file-scoped TS semantic getter | YES -- survivor TS2322 surfaces independently of the aborted Angular TCB priming | FLOWING |
| executor `logger.warn` | `result.templateCheckAborted.fileName` | core detection via shim->source inversion | YES -- names a real openable source path (`.ts`) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Full suite green (the authoritative gate per CLAUDE.md/AGENTS.md) | `npx nx test angular-typechecker` | 24 files, 143 tests passed | PASS |
| Build clean (CJS executor emit survives) | `npx nx build angular-typechecker` | Successfully ran target build | PASS |
| Lint clean (0 errors) | `npx nx lint angular-typechecker` | 0 errors, 1 pre-existing unrelated warning (unused `NG` const in a Phase-2-era config-resolution.integration.spec.ts) | PASS |

### Probe Execution

| Probe | Command | Result | Status |
| --- | --- | --- | --- |
| (none) | -- | This phase has no `scripts/*/tests/probe-*.sh`; verification mechanism is the Vitest suite (run above). The throwaway RES-01 spike probe (`res-01-spike.probe.spec.ts`) was intentionally removed after the GO decision was recorded (per the spike hand-off). | SKIPPED (no probe scripts; Vitest suite is the runnable proof) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| RES-01 | 09-01 | GATE/spike: GO decision on per-file isolation shape | SATISFIED | `09-RES-01-SPIKE.md` GO=HYBRID. |
| RES-02 | 09-02, 09-05 | Per-file fault isolation (HYBRID) + loud notice (REFRAMED) | SATISFIED | HYBRID gatherer + real-compiler integration proof + loud `logger.warn`. Deferred template-recovery sub-clause recorded as REP-RES-02b. |
| RES-03 | 09-03 | realpath try/catch + raw-path fallback | SATISFIED | filter-diagnostics.ts:129-138 + unit test. |
| RES-04 | 09-04 | `suppressOutputPathCheck: true` | SATISFIED | run-typecheck.ts:142-144 + spy unit + no-nuisance integration test. |
| REP-RES-02b | (deferred) | Recover survivors' template/extended diagnostics after a TCB-gen Fatal -- NgtscProgram milestone | RECORDED (out of scope) | REQUIREMENTS.md line 42; ROADMAP SC2 amended; decision doc present. Intentionally NOT implemented in v0.0.3. |

All four declared requirement IDs (RES-01..RES-04) are accounted for and SATISFIED.
No orphaned requirements: ROADMAP maps exactly RES-01..04 to Phase 9 and all four are
claimed by plans (09-01..09-05).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (phase-9 source files) | -- | TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER | none | NONE found in any of the four production files or executor.ts. Debt-marker BLOCKER gate is clean. |

### Code Review reconciliation (`09-REVIEW.md`)

The deep code review returned `issues_found` (0 Critical, 2 Warning, 4 Info). Both
Warnings were addressed in the verified source (confirmed against current code):

- **WR-01** (`normalizeShimFileName` lossy `.tsx`->`.ts`): addressed via the review's
  explicit "at minimum" path -- the `LIMITATION (WR-01)` comment is present in
  `run-typecheck.ts:460-468` documenting that a `.tsx`-sourced component is named as
  `.ts`. Affects only the advisory notice's path string, never the verdict, counts, or
  the diagnostic's own codeframe. `.tsx` Angular sources are vanishingly rare.
- **WR-02** (notice names only the first NG3004): addressed via the review's Option (a)
  -- the message now reads "a fatal template-compilation error (e.g. in
  ${offendingFile}) ... Fix all reported NG3004 diagnostics" (executor.ts:57-61),
  signalling there may be additional offenders.
- **IN-04** (spike probe `console.log` lint risk): moot -- the throwaway probe was
  deleted (confirmed absent); `nx lint` is green.

The review's adversarial cross-checks against the installed `@angular/compiler-cli@22.0.4`
bundles independently CONFIRMED the load-bearing claims (infra-vs-type boundary preserved,
HYBRID correctness, NG3004 numeric encoding, core purity).

### Human Verification Required

None. All four truths are verifiable programmatically and were verified against the real
compiler (the integration tier runs the live `@angular/compiler-cli@22.0.4`), so no visual
/ real-time / external-service human check is needed.

### Gaps Summary

No goal-blocking gaps. The reframed resilience contract is genuinely achieved: the engine
isolates a single TCB-generation Fatal to one diagnostic, never collapses to an infra-500,
keeps reporting surviving files' TS + Angular non-template diagnostics, and loudly warns
(naming the offending source file) that the template check is incomplete. The realpath
fallback (RES-03) and `suppressOutputPathCheck` (RES-04) are implemented, wired, and
tested. The gate (RES-01) produced a recorded GO=HYBRID before any isolation code was
written, and the deferred faithful-template-recovery sub-clause is properly recorded
(ROADMAP SC2 amended, REQUIREMENTS RES-02 amended + REP-RES-02b added, decision doc
present) -- not silently dropped. Full suite green (143 tests), build clean, lint clean.

**Non-blocking bookkeeping notes (for the orchestrator / milestone audit -- not goal gaps):**

1. `REQUIREMENTS.md` coverage table (lines 69-71) still lists RES-02 / RES-03 / RES-04 as
   "Pending" while the requirement checkboxes (lines 22-24) are `[x]` and the code + tests
   confirm delivery. This is a stale status-table cell, not an unmet requirement. The
   milestone audit's 3-source cross-reference should flip these to "Complete". RES-01 is
   already "Complete".
2. `09-VALIDATION.md` is still `status: draft` (`nyquist_compliant: false`,
   `wave_0_complete: false`) -- it is the pre-validation template. `/gsd-validate-phase`
   runs AFTER verification (per project workflow) and will flip these post-execution; it is
   not a verification-stage gap. The Vitest suite is already green, which is the substantive
   coverage proof.

---

_Verified: 2026-06-29T22:35:00Z_
_Verifier: Claude (gsd-verifier)_
