# Phase 9: Resilience (per-file fault isolation + boundary robustness) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-06-29
**Phase:** 9-resilience-per-file-fault-isolation-boundary-robustness
**Mode:** `--analyze --auto --chain` (autonomous selection; trade-off tables logged for audit; phase-specific research performed before analysis)
**Areas discussed:** RES-01 spike scope/gate, RES-02 fault-isolation scope, RES-02 iteration+skip rules, RES-03 realpath try/catch, RES-04 suppressOutputPathCheck placement

> **Trap-quadrant check (CLAUDE.md `--auto` rule):** every gray area below was rated on
> IMPACT x CONFIDENCE. None landed in the HIGH-IMPACT + NOT-HIGH-CONFIDENCE trap quadrant,
> so all were auto-locked. The highest-impact item (RES-01 shape) is high-confidence
> BECAUSE the decision preserves the empirical spike gate rather than pre-deciding the
> shape -- the SIMPLE-vs-HYBRID uncertainty is deferred to the spike by design.

---

## RES-01 -- GATE spike: settle the per-file isolation shape

| Option                                            | Description                                                                                                                      | Selected |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------- |
| SIMPLE only                                       | Per-file `getNgSemanticDiagnostics(sf.fileName)` loop only; minimal, matches `@angular/build`                                    |          |
| HYBRID                                            | File-less non-template set gathered ONCE whole-program + template/extended looped per file; strict superset, never under-gathers |          |
| Pre-decide now (skip spike)                       | Faster but violates the phase's gate design; the file-less question is genuinely unknown at 22.0.4                               |          |
| Preserve the gate; HYBRID as inconclusive-default | Spike decides SIMPLE-vs-HYBRID empirically; default HYBRID if inconclusive                                                       | ✓        |

**Choice (auto, recommended):** Preserve RES-01 as the first plan + hard gate on RES-02; GO=SIMPLE only if the spike POSITIVELY proves no file-less Angular non-template diagnostics exist, else GO=HYBRID; inconclusive -> HYBRID.
**Notes:** IMPACT high, CONFIDENCE high (the decision is the _process_, not the shape). Grounded in PRIOR-ART #3 + ENGINE-REF Open Q3 (the `d.file === file` filter at `compiler.ts:618`). HYBRID is the safe superset because the whole-program non-template call is what the engine already does.

---

## RES-02 -- Fault-isolation error-handling scope

| Option                                       | Description                                                                                                                                                                 | Selected |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Inherent FatalDiagnosticError isolation only | Rely on `getDiagnosticsForFile`'s own per-file `isFatalDiagnosticError` try/catch (`compiler.ts:631-636`); matches `@angular/build`; preserves Phase 8 infra-vs-type policy | ✓        |
| Add our own catch-all per-file try/catch     | Isolates even non-fatal throws, but reclassifies infra/non-fatal crashes as per-file diagnostics -- blurs Phase 8 classification                                            |          |

**Choice (auto, recommended):** Inherent FatalDiagnosticError isolation only.
**Notes:** IMPACT high, CONFIDENCE high (faithfulness to `@angular/build` + Phase 8 `08-CONTEXT.md` D-06 infra-vs-type policy are strong anchors). CAVEAT flagged in CONTEXT.md D-05: a non-fatal escape still collapses the run to one 500 (ENGINE-REF Open Q1); isolating non-fatal escapes is DEFERRED.

---

## RES-02 -- Per-file iteration source + skip rules

| Option                                                                           | Description                                                                                                | Selected |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------- |
| Iterate `getSourceFiles()`, skip `isDeclarationFile`, `OptimizeFor.WholeProgram` | Rely on the `fileName` overload's internal no-op for shim/out-of-program files; spike confirms shim parity | ✓        |
| `OptimizeFor.SingleFile` in the loop                                             | Rejected -- enum doc warns of "significant unnecessary overhead"                                           |          |

**Choice (auto, recommended):** Iterate `program.getTsProgram().getSourceFiles()`, skip `sf.isDeclarationFile`, keep `OptimizeFor.WholeProgram`.
**Notes:** IMPACT medium, CONFIDENCE high. ENGINE-REF Open Q4 (shim parity) confirmed by the spike. Determinism preserved by existing `sortAndDeduplicateDiagnostics`.

---

## RES-03 -- Throwing realpath() try/catch location

| Option                                                        | Description                                                                                                                                | Selected |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| Wrap inside `createCanonicalizer` (boundary filter, `:127`)   | The location the research names (SHIM #2); protects the contract regardless of injected impl; fall back to unresolved path, then normalize | ✓        |
| Harden only the production injection (`run-typecheck.ts:229`) | Narrower; misses a throwing test stub and any future injection site                                                                        |          |

**Choice (auto, recommended):** Wrap `options.realpath(filePath)` in `createCanonicalizer`; fall back to the raw path, then still normalize + case-fold; silent (pure core).
**Notes:** IMPACT low, CONFIDENCE high (requirement RES-03 dictates the behavior).

---

## RES-04 -- suppressOutputPathCheck placement

| Option                                          | Description                                                                                                                                 | Selected |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `readConfiguration` 2nd arg                     | `readConfiguration(path, { suppressOutputPathCheck: true })`; matches `@angular/build` exactly; fires at config-parse where the check lives | ✓        |
| Override object in `performCompilation` options | ENGINE-REF #4's "locality" preference; may fire too late (after `readConfiguration`)                                                        |          |

**Choice (auto, recommended):** `readConfiguration` second arg (reasoned deviation from ENGINE-REF #4).
**Notes:** IMPACT low-medium, CONFIDENCE medium-high. CAVEAT flagged in CONTEXT.md D-09: deviates from ENGINE-REF's "prefer the override object" because the output-path check fires at config resolution -- the override-object placement may be too late. Planner/spike confirms with a fixture; safe under `noEmit: true` either way. Signature already declared (`compiler-cli-types.ts:155-158`); no shim change.

---

## Claude's Discretion

- Exact loop structure / helper extraction in `gather-diagnostics.ts`; for HYBRID, whether to keep a single residual whole-program `getNgSemanticDiagnostics()` for the non-template portion or filter it.
- Fixture mechanics for RES-02 (multi-file: one TCB-poisoning `FatalDiagnosticError` component + a second component with a normal template error), RES-03 (throwing-realpath stub), RES-04 (output-path-nuisance config).
- RES-01 spike fixture(s), detection method for file-less non-template diagnostics, and the form of the recorded GO artifact.

## Deferred Ideas

- Isolating NON-fatal per-file escapes (our own try/catch around each call) -- ENGINE-REF Open Q1; deferred (would blur infra-vs-type). Revisit only if a real non-fatal escape is observed.
- Phase 10 (HARD) items -- drift tsconfig getter-set tripwire, `EmitFlags.None` fix, vendor markers, retained `getNgStructuralDiagnostics()` under assertion, TS-99 leak regression spec. Cross-phase note: HARD-01's getter-set assertion must cover the per-file `getNgSemanticDiagnostics(fileName)` usage RES-02 leaves in place.
- `NgtscProgram` migration / incremental / `--watch` -- RES-02 stays on the existing `api.Program` surface (PROJECT.md Out of Scope).
