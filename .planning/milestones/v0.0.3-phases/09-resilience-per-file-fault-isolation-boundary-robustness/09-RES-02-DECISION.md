# RES-02 / SC2 Reframe Decision

**Date:** 2026-06-29
**Status:** DECIDED -- Option A (reframe + defer + loud notice). Recorded for the milestone audit.
**Trigger:** During execution of plan 09-02, the executor proved (5 live-compiler experiments + source analysis) that the literal SC2 clause "surviving files' template/extended diagnostics are still reported" is mechanically unachievable on the locked surface. This re-opens a locked decision, so it was escalated to the user (a human in the loop) per the `--auto` trap-quadrant rule rather than auto-resolved.

## The finding (CONFIRMED at Angular v22.0.4)

A TCB-GENERATION-phase `FatalDiagnosticError` (e.g. NG3004 `IMPORT_GENERATION_FAILURE` -- a template referencing a non-exported / local-only symbol) is thrown inside the SHARED `ensureAllShimsForAllFiles()` priming that `OptimizeFor.WholeProgram` triggers on the first per-file call. When it throws, shim generation aborts for ALL files before any shim is committed (`checker.ts:944` throws, `:949` commit never runs, `isComplete` stays false). Consequence:

- The poison yields exactly ONE diagnostic (the boundary `isFatalDiagnosticError` catch converts it; no crash, no whole-run `UNKNOWN_ERROR_CODE` 500 collapse).
- Surviving files' TypeScript + Angular NON-template diagnostics still surface.
- Surviving files' Angular TEMPLATE/extended (NG8xxx) diagnostics VANISH -- in BOTH the whole-program and the per-file `WholeProgram` paths (the gathered set is identical pre- and post-change).
- `@angular/build` exhibits the SAME limitation on its cold/multi-file path (`aot-compilation.ts:210` routes >1 affected file through `WholeProgram`).

The `api.Program` `getNgSemanticDiagnostics(fileName)` overload HARDCODES `WholeProgram` (`program.ts:241`). Recovering the survivors' template diagnostics requires either `OptimizeFor.SingleFile`-per-file (reachable only via `NgCompiler` internals -- past the locked `api.Program` surface, D-04) or an `NgtscProgram` migration (D-04 / PROJECT.md forbid). There is NO third in-tree lever (research Q10, HIGH confidence).

Full evidence: `.planning/research/RES-02-isolation-alternatives.md` (web + v22.0.4 source) and `phases/09-.../09-02-SUMMARY.md`.

## Options weighed (web research + a 5-lens Opus panel)

| Option         | Summary                                                                                                                                                                                             | Panel verdict                                                                                                                                                                                                                                                                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** (chosen) | Reframe SC2 to the achievable run-level resilience contract; keep the HYBRID gatherer; add a loud suppression notice; defer faithful template recovery to the NgtscProgram milestone (REP-RES-02b). | 4 / 5 lenses TOP at HIGH confidence (Architecture, Perf/correctness, Scope/charter, Risk/feasibility).                                                                                                                                                                                                                                          |
| B              | Two-pass `SingleFile` re-gather of survivors on the same program.                                                                                                                                   | Disqualified: needs `NgCompiler` internals (breaches D-04) AND has an order-dependent correctness bug (recovers nothing for pre-poison survivors); cannot be honestly tested.                                                                                                                                                                   |
| C              | `SingleFile` always (per file).                                                                                                                                                                     | Needs `NgCompiler` internals (breaches D-04/D-07); pays the documented "significant unnecessary overhead" on every (clean) run.                                                                                                                                                                                                                 |
| D1             | On a Fatal, re-run `performCompilation` excluding the poison file(s).                                                                                                                               | Runner-up (Completeness lens only, medium). Rejected: semantically UNFAITHFUL (survivors recomputed as if the poison were DELETED -> phantom `cannot find module` / hides real errors), conditional (multi-poison = O(poisons) recompiles; non-attributable Fatals fall back to A), and a new recompilation mechanism in a hardening milestone. |
| E              | Migrate to NgtscProgram now (LS-style `SingleFile`-per-file against the intact program -- the FAITHFUL fix).                                                                                        | The correct long-term home, but a re-architecture, explicitly out of v0.0.3 scope. Deferred (REP-RES-02b).                                                                                                                                                                                                                                      |

The completeness lens preferred D1; every other lens + the cross-lens consensus rejected it because the poison-exclusion recompute is unfaithful (a different flavor of incorrectness, arguably worse than an honest, loud gap).

## Decision (Option A)

1. **Keep the HYBRID gatherer** (plan 09-02, merged) -- the RES-01 GO=HYBRID shape: residual whole-program `getNgSemanticDiagnostics()` + per-file `getNgSemanticDiagnostics(sf.fileName)` loop, COR-02 `getGlobalDiagnostics()` retained, no catch-all (D-05 infra-vs-type preserved), `OptimizeFor.WholeProgram` (D-07).
2. **Reframe SC2 / RES-02** to the achievable run-level resilience contract: a Fatal yields exactly one diagnostic, the run does NOT collapse to a 500, and surviving files' TypeScript + Angular non-template diagnostics are reported. (ROADMAP SC2 + REQUIREMENTS RES-02 amended.)
3. **Add a LOUD suppression notice** (plan 09-05): when a TCB-generation Fatal is detected, the engine surfaces a visible warning naming the offending file and stating that surviving files' Angular template/extended (NG8xxx) diagnostics may be suppressed until it is fixed. The incompleteness is never silent -- this neutralizes the only real objection to A (the completeness lens).
4. **Defer faithful recovery** (surviving files' template diagnostics after a TCB-gen Fatal) to the `NgtscProgram`/incremental milestone as **REP-RES-02b** -- where `OptimizeFor.SingleFile`-per-file (the Language Service approach) delivers it correctly, without the D1 phantom-diagnostic hazard.

## Precedent + discipline

This mirrors the COR-04 reframe (08-CONTEXT D-07..D-10): a literal success-criterion clause unachievable on the locked surface was reframed to what the surface delivers, with the unachievable literal deferred to the surface that CAN deliver it, and recorded (not silently narrowed). The milestone audit MUST confirm SC2's wording is formally amended (done here) with the named future home (REP-RES-02b).
