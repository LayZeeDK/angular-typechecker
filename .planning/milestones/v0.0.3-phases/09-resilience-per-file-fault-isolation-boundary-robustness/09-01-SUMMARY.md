---
phase: 09-resilience-per-file-fault-isolation-boundary-robustness
plan: 01
subsystem: testing
tags: [angular, compiler-cli, diagnostics, spike, fault-isolation, tcb]

# Dependency graph
requires:
  - phase: 08-correctness-completeness-fixes
    provides: the gatherAllDiagnostics seventh-getter context (getGlobalDiagnostics) and the infra-vs-type TypecheckInfrastructureError policy RES-02 must preserve
provides:
  - "GO=HYBRID decision recorded in 09-RES-01-SPIKE.md (the RES-01 GATE deliverable that gates plan 09-02 / RES-02)"
  - "fixtures/fault-isolation/ multi-file fixture (tcb-poison component A + survivor component B) for plan 09-02's failing-then-passing isolation spec"
  - "empirical proof that the IMPORT_GENERATION_FAILURE Fatal attaches to a generated .ngtypecheck.ts shim (d.file is unreliable) and that the whole-program getNgSemanticDiagnostics() under-reports on a poison"
affects: [09-02 RES-02 per-file fault isolation, 10 HARD-01 getter-set drift assertion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RES-01 throwaway spike probe: reach the live api.Program via loadCompilerCli + readConfiguration + performCompilation with a capturing gatherDiagnostics callback, then inspect d.file on the whole-program set vs the per-file union"
    - "GO artifact (09-RES-01-SPIKE.md): GO DECISION + fixtures + method + empirical result + v22.0.4 citations, the durable record the phase verifier checks"

key-files:
  created:
    - ".planning/phases/09-resilience-per-file-fault-isolation-boundary-robustness/09-RES-01-SPIKE.md"
    - "fixtures/fault-isolation/tcb-poison.component.ts"
    - "fixtures/fault-isolation/tcb-poison.component.html"
    - "fixtures/fault-isolation/survivor.component.ts"
    - "fixtures/fault-isolation/survivor.component.html"
    - "fixtures/fault-isolation/tsconfig.app.json"
    - "fixtures/fault-isolation/non-template-error.component.ts"
    - "fixtures/fault-isolation/tsconfig.non-template.json"
    - "packages/angular-typechecker/src/core/res-01-spike.probe.spec.ts"
  modified: []

key-decisions:
  - "GO=HYBRID: SIMPLE rejected because the spike could not positively enumerate the non-template diagnostic universe as file-bearing-and-matched (Pitfall 1; checkForPrivateExports/A2 not exercised) AND produced counter-evidence that d.file is fragile (a Fatal attached to a .ngtypecheck.ts shim, not the iterated .component.ts). Per D-03 inconclusive defaults to HYBRID, the strict superset."
  - "IMPORT_GENERATION_FAILURE poison construct = Angular's own v22.0.4 test trigger (template_typecheck_spec.ts:86-115): an unexported referenced standalone component with a bound required input forces the TCB to reference its class -> reference emit fails -> Fatal during TCB generation (NOT analysis)."

patterns-established:
  - "Spike probe reaches the live program through the engine's own load path so it observes exactly the no-emit program the engine builds (run-typecheck.ts:102-193 mirrored)."
  - "A non-template-only fixture (a plain class in standalone imports -> NG2012) isolates a real getNonTemplateDiagnostics() entry so its .file can be inspected without a template Fatal aborting the run."

requirements-completed: [RES-01]

# Metrics
duration: 14min
completed: 2026-06-29
---

# Phase 9 Plan 01: RES-01 GATE Spike Summary

**GO = HYBRID -- the RES-01 spike empirically settled the per-file isolation shape: keep the whole-program getNgSemanticDiagnostics() (file-less-safe non-template set) AND add the per-file template loop, because file-less / shim-attached non-template diagnostics could not be ruled out (D-03 inconclusive default).**

## Performance

- **Duration:** 14 min
- **Started:** 2026-06-29T18:01:09Z
- **Completed:** 2026-06-29T18:15:22Z
- **Tasks:** 2
- **Files created:** 9 (8 fixture/probe + 1 GO artifact)

## Accomplishments

- **Recorded the GO=HYBRID decision** in `09-RES-01-SPIKE.md` (the GATE deliverable plan 09-02 and the phase verifier consume) with the empirical d.file findings and v22.0.4 citations.
- **Built the reusable `fixtures/fault-isolation/` multi-file fixture**: component A (`tcb-poison`) triggers an `IMPORT_GENERATION_FAILURE` Fatal during TCB GENERATION (Angular's own v22.0.4 test construct), component B (`survivor`) carries a plain TS2322 + NG8109 template error that vanishes today and survives post-RES-02.
- **Ran a throwaway probe against the LIVE api.Program** that inspected `d.file` on the whole-program set vs the per-file union and verified A1 (the poison is a template/TCB Fatal, not a non-template/analysis diagnostic).
- **Surfaced two RES-02 design inputs:** (1) the Fatal's `.file` is a generated `.ngtypecheck.ts` shim (not the queried `.component.ts`), so the `d.file === file` per-file filter is fragile; (2) under `OptimizeFor.WholeProgram` the poison's Fatal during shared shim generation suppresses the survivor in BOTH sets -- so SIMPLE per-file would not by itself isolate this whole-program-priming Fatal.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author the fault-isolation multi-file fixture** - `85fc65c` (test)
2. **Task 2: Probe the live api.Program and record the GO decision** - `393f1c9` (test)

**Plan metadata:** (this SUMMARY + STATE/ROADMAP/REQUIREMENTS) - see final docs commit.

## Files Created/Modified

- `.planning/.../09-RES-01-SPIKE.md` - the GO=HYBRID artifact (decision + fixtures + method + empirical result + v22.0.4 citations)
- `fixtures/fault-isolation/tcb-poison.component.ts` + `.html` - component A: unexported referenced component with a bound required input -> IMPORT_GENERATION_FAILURE during TCB generation
- `fixtures/fault-isolation/survivor.component.ts` + `.html` - component B: plain TS2322 + NG8109 template error (gate-b-error model)
- `fixtures/fault-isolation/tsconfig.app.json` - extends tsconfig.base.json; noEmit + strictTemplates; lists both components
- `fixtures/fault-isolation/non-template-error.component.ts` + `tsconfig.non-template.json` - spike input: a plain class in standalone imports -> NG2012 analysis-phase non-template diagnostic
- `packages/angular-typechecker/src/core/res-01-spike.probe.spec.ts` - throwaway probe (build-excluded) inspecting d.file on the whole-program set vs the per-file union

## Decisions Made

- **GO=HYBRID (D-02/D-03).** SIMPLE requires POSITIVE proof that no non-template diagnostic is file-less / unmatched. The spike confirmed only ONE non-template class (NG2012) as file-bearing, did NOT exercise `checkForPrivateExports` (A2, the flagged file-less risk), and produced counter-evidence (a real Fatal attached to a `.ngtypecheck.ts` shim). Inconclusive -> HYBRID, the strict superset that can never under-gather. Absence of evidence is not proof of absence (Pitfall 1).
- **Poison construct = Angular's own v22.0.4 trigger** (`template_typecheck_spec.ts:86-115`): an intentionally-unexported referenced standalone component with a bound required input, replicated verbatim so the Fatal fires during TCB generation rather than analysis (Pitfall 2 avoided).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The initial tcb-poison fixture did not trigger IMPORT_GENERATION_FAILURE**
- **Found during:** Task 2 (running the probe against the live compiler)
- **Issue:** Task 1's first poison construct used a non-exported `@Directive` applied via an attribute selector with no input binding. The directive class was same-file/local, so Angular's `CopySourceToTcb` path (`tcb_adapter.ts:334`) treated it as local and output the name directly -- the reference emitter never needed to generate an import, so no Fatal fired. The probe showed `IMPORT_GENERATION_FAILURE present in per-file union: false` and the poison's diagnostic was absent from both sets.
- **Fix:** Rebuilt the poison on Angular's own v22.0.4 test construct (`template_typecheck_spec.ts:86-115`): an unexported referenced `@Component` (`SubComponent`) with a required input bound in the template (`<sub-cmp [someInput]="''" />`). Under strictTemplates the TCB must reference the unexported class -> `ReferenceEmitKind.Failed` -> `FatalDiagnosticError(IMPORT_GENERATION_FAILURE = 3004)` during TCB generation.
- **Files modified:** `fixtures/fault-isolation/tcb-poison.component.ts`, `fixtures/fault-isolation/tcb-poison.component.html`
- **Verification:** Re-ran the probe; `A1: IMPORT_GENERATION_FAILURE present in per-file union: true`, the Fatal code `-993004` confirmed.
- **Committed in:** `393f1c9` (Task 2 commit)

**2. [Rule 2 - Missing critical] Added a dedicated non-template fixture to test the actual load-bearing question**
- **Found during:** Task 2 (designing the d.file inspection)
- **Issue:** The poison fixture produces only a TEMPLATE Fatal. The RES-01 question is specifically about NON-TEMPLATE diagnostics being file-less -- a probe that never produces a real `getNonTemplateDiagnostics()` entry cannot inspect its `.file`, leaving the decision unsupported by direct evidence.
- **Fix:** Added `non-template-error.component.ts` + `tsconfig.non-template.json` (a plain non-Angular class in standalone `imports:` -> NG2012 analysis-phase non-template diagnostic) and a second probe leg that inspects its `.file` directly. This converts the HYBRID decision from "I saw no file-less ones" into "I positively inspected one non-template class (file-bearing) but could not enumerate the universe -> HYBRID per D-03" (the Pitfall 1 standard).
- **Files modified:** `fixtures/fault-isolation/non-template-error.component.ts`, `fixtures/fault-isolation/tsconfig.non-template.json`, `packages/angular-typechecker/src/core/res-01-spike.probe.spec.ts`
- **Verification:** Probe leg ran; NG2012 (`-992012`) confirmed file-bearing on its `.component.ts` and retained by the per-file union.
- **Committed in:** `393f1c9` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both were essential to producing a TRUE GATE deliverable -- without the Rule 1 fix the fixture would not exercise the per-file template path (Pitfall 2), and without the Rule 2 fixture the GO decision would rest on absence-of-evidence (Pitfall 1). No scope creep: no production engine code changed, no package added, the probe is build-excluded, and the fixtures are out of the project graph.

## Issues Encountered

- A transient duplicate-`const` parse error appeared while refactoring the probe's program-capture into a shared helper (oxc PARSE_ERROR: `wholeProgram` already declared). Resolved by removing the leftover duplicate declaration; the probe then ran clean (Rule 3 blocking fix on my own edit, no commit needed -- caught before any commit).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **RES-01 GATE is GO.** Plan 09-02 (RES-02) may proceed with the **HYBRID** gather shape per the recorded decision.
- The `fixtures/fault-isolation/` tree is committed for plan 09-02's `fault-isolation.integration.spec.ts` failing-then-passing differentiator.
- Full suite green (23 files / 125 tests, including the 2 probe legs); no regression. The probe + the non-template fixture are throwaway spike artifacts plan 09-02 may remove once RES-02's permanent spec lands.
- Concern for 09-02 (documented in 09-RES-01-SPIKE.md section 4a finding 3): under `OptimizeFor.WholeProgram` a TCB-generation Fatal during the shared shim-priming step can still suppress other files in the per-file loop; the RES-02 failing-then-passing spec must verify the survivor's diagnostic actually surfaces post-change, not merely that the loop structure is present.

## Self-Check: PASSED

- All 9 created files verified present on disk (GO artifact, 5 fault-isolation fixture files, 2 non-template spike inputs, 1 probe spec, this SUMMARY).
- Both task commits verified in git log: `85fc65c` (Task 1), `393f1c9` (Task 2).
- All new files ASCII-only; probe lint-clean (0 errors); full suite 23 files / 125 tests green.

---
*Phase: 09-resilience-per-file-fault-isolation-boundary-robustness*
*Completed: 2026-06-29*
