# Phase 9: Resilience (per-file fault isolation + boundary robustness) - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning
**Mode:** `--analyze --auto --chain` (phase-specific research performed before gray-area analysis; `--research` to be passed to plan-phase)

<domain>
## Phase Boundary

Harden the EXISTING whole-program no-emit `runTypecheck` engine so it reports as
much as it can instead of aborting on a single bad component, a throwing
`realpath()`, or an output-path nuisance -- with the per-file isolation SHAPE
settled by a GATE spike (RES-01) BEFORE any isolation code is written. Covers
RES-01..RES-04.

In scope: the four RES changes against the existing `api.Program` surface --
(RES-01) a gating spike that settles the per-file isolation shape; (RES-02)
per-file fault-isolated Angular diagnostic gathering; (RES-03) a try/catch around
`options.realpath()` in the boundary filter; (RES-04) `suppressOutputPathCheck` in
the no-emit flow. NO `NgtscProgram` migration. NO new executor option or feature
surface. Each non-spike change is test-gated (failing-then-passing).

This is HOW to implement the four scoped RES requirements; it does not add new
capabilities. The engine is already complete and faithful to `@angular/build` at
22.0.4 (PRIOR-ART-SUMMARY headline) -- this is targeted resilience hardening only.
</domain>

<decisions>
## Implementation Decisions

### RES-01 -- GATE spike: settle the per-file isolation shape (FIRST plan; gates RES-02)
- **D-01:** RES-01 is the FIRST plan and a HARD GATE on RES-02 -- RES-02 does not
  start until the spike returns a recorded GO. The spike must EMPIRICALLY determine
  the one load-bearing open question (PRIOR-ART #3 / ENGINE-REF Open Q3): whether any
  Angular non-template diagnostics (`traitCompiler.diagnostics` /
  `checkForPrivateExports`) are file-less (`d.file === undefined`) in the no-emit
  path. `NgCompiler.getDiagnosticsForFile` filters the non-template set by
  `d.file === file` (`compiler.ts:618` @ v22.0.4), so a naive per-file loop would
  silently DROP any file-less non-template diagnostic.
- **D-02:** GO/NO-GO criteria for the shape:
  - **SIMPLE** (a per-file `getNgSemanticDiagnostics(sf.fileName)` loop ONLY) is
    chosen ONLY IF the spike POSITIVELY proves no file-less Angular non-template
    diagnostics exist in the no-emit path.
  - **HYBRID** (gather the file-less non-template set ONCE whole-program +
    loop the template/extended families per file) otherwise.
- **D-03:** Inconclusive-fallback = **HYBRID**. If the spike cannot positively prove
  SIMPLE is loss-free, default to HYBRID -- it is the strict superset that can never
  under-gather (a whole-program non-template call already returns file-less
  diagnostics; the per-file loop adds the isolation). SIMPLE is an optimization valid
  ONLY under a proven precondition; absence of evidence is not proof of absence. The
  spike's GO decision (shape + the file-less finding that justified it) is recorded
  as a durable artifact the phase verifier checks.

### RES-02 -- Per-file fault isolation (post-gate, on the existing api.Program surface)
- **D-04:** Implement via `program.getNgSemanticDiagnostics(sf.fileName)` per file.
  The `fileName?` overload is ALREADY declared on the vendored shim
  (`compiler-cli-types.ts:76-79`) and delegates to
  `compiler.getDiagnosticsForFile(sf, OptimizeFor.WholeProgram)` (`program.ts:224-243`
  @ v22.0.4). NO `NgtscProgram` migration; NO shim widening required.
- **D-05:** Fault-isolation scope = rely on `getDiagnosticsForFile`'s OWN per-file
  `isFatalDiagnosticError` try/catch (`compiler.ts:631-636`): one component's
  `FatalDiagnosticError` yields exactly ONE diagnostic (`err.toDiagnostic()`) and the
  loop CONTINUES -- identical to `@angular/build`'s per-file gatherer
  (`aot-compilation.ts:281-294`). Do NOT add a catch-all per-file try/catch: a
  non-fatal / infra throw must STILL surface as `UNKNOWN_ERROR_CODE` 500 ->
  `TypecheckInfrastructureError` (preserves the Phase 8 infra-vs-type policy,
  `08-CONTEXT.md` D-06; `run-typecheck.ts:195-206`). RES-02's contract is
  FatalDiagnosticError isolation ONLY.
  - **CAVEAT (flagged):** ENGINE-REF Open Q1 -- a NON-fatal throw still collapses the
    whole run to one 500 at the `performCompilation` boundary
    (`perform_compile.ts:313-323`). Isolating non-fatal escapes per file (our own
    try/catch around each call) is DEFERRED -- it would blur infra-vs-type
    classification. Revisit ONLY if a real non-fatal escape is observed in practice.
- **D-06:** Iterate `program.getTsProgram().getSourceFiles()`; skip
  `sf.isDeclarationFile`. The `getNgSemanticDiagnostics(fileName)` overload internally
  resolves the source file and no-ops on files not in the program / shim files
  (`program.ts:231-235`), so `.ngtypecheck.ts` shims are not double-processed (the
  spike confirms this shim parity -- ENGINE-REF Open Q4). Output set is unchanged on
  clean / ordinarily-erroring programs (changes ONLY in the failure case); determinism
  is preserved by the existing `ts.sortAndDeduplicateDiagnostics` in `finalize`
  (`run-typecheck.ts:347`). `getNonTemplateDiagnostics` is memoized (`compiler.ts:1244`),
  so per-file re-filtering does not recompute it.
- **D-07:** Use `OptimizeFor.WholeProgram` (the implicit mode of the `fileName`
  overload) so the FIRST per-file call primes `ensureAllShimsForAllFiles()` once and
  subsequent calls are cheap cache reads. NEVER `OptimizeFor.SingleFile` in a loop
  (the enum doc warns of "significant unnecessary overhead" --
  `typecheck/api/checker.ts:388-405`).
- **Edit point:** `gather-diagnostics.ts` -- replace the single
  `program.getNgSemanticDiagnostics()` (line 34) with the per-file loop (SIMPLE) or
  the once-whole-program-non-template + per-file-template structure (HYBRID), per the
  RES-01 GO decision.

### RES-03 -- Throwing realpath() robustness in the boundary filter
- **D-08:** Wrap the `options.realpath(filePath)` call INSIDE `createCanonicalizer`
  (`filter-diagnostics.ts:127`, the boundary filter the research names -- SHIM #2 /
  PRIOR-ART #4) in try/catch. On throw, fall back to the UNRESOLVED raw `filePath`,
  then STILL apply the `\\` -> `/` normalization and the case-fold so the fallback
  path classifies consistently. Silent fallback -- core is PURE (eslint bans
  `process.exit` / side effects in `**/src/core/**`; no logging). The per-input
  memoization cache still applies. Happy path is unchanged.
  - Rationale: a throwing `ts.sys.realpath` (injected at `run-typecheck.ts:229-230`)
    currently propagates out of `filterDiagnostics` and aborts the WHOLE pass.
    Catching at the call site protects the contract regardless of the injected impl
    (production `ts.sys.realpath` or a test stub).

### RES-04 -- suppressOutputPathCheck in the no-emit flow
- **D-09:** Pass `suppressOutputPathCheck: true` as the `existingOptions` SECOND ARG
  to `ng.readConfiguration(options.tsConfigPath, { suppressOutputPathCheck: true })`
  (`run-typecheck.ts:105`) -- matching `@angular/build` EXACTLY
  (`angular-compilation.ts:51` @ v22.0.4). The
  `readConfiguration(project, existingOptions?)` signature is ALREADY declared on the
  shim (`compiler-cli-types.ts:155-158`); no shim change. `ts.CompilerOptions` carries
  an index signature, so the extra key type-checks.
  - **CAVEAT (flagged -- reasoned deviation from ENGINE-REF #4):** ENGINE-REF #4 states
    "prefer the override object [in the `performCompilation` options bag] for locality
    with the other emit-neutralizers." This decision DEVIATES: the output-path check
    fires during config resolution, so the override-object placement (AFTER
    `readConfiguration` ran) may be TOO LATE -- a nuisance error could already be
    folded into `parsed.errors` (`run-typecheck.ts:137`) and reported. The
    `readConfiguration`-arg placement is where `@angular/build` validated it.
    Planner/spike CONFIRMS with a fixture which placement actually suppresses an
    output-path nuisance error; if the override-object placement proves equivalent
    under `noEmit: true`, either is acceptable. Safe under `noEmit: true` either way
    (no diagnostic-completeness downside).

### Claude's Discretion
- Exact loop structure / helper extraction in `gather-diagnostics.ts`; for HYBRID,
  whether to keep a single residual whole-program `getNgSemanticDiagnostics()` for the
  non-template portion or to filter it.
- Fixture mechanics for the test-gated (failing-then-passing) changes: RES-02 needs a
  multi-file fixture with one TCB-poisoning component (throws `FatalDiagnosticError`)
  + a SECOND component with a normal template error -- today the second error vanishes,
  after the change it survives; RES-03 needs a throwing-`realpath` stub; RES-04 needs
  a config that triggers an output-path nuisance error.
- Spike (RES-01) mechanics: the fixture(s) and the method used to detect file-less
  non-template diagnostics, and the exact form of the recorded GO artifact.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Grounding research (the source of every RES requirement)
- `.planning/research/prior-art/PRIOR-ART-SUMMARY.md` -- improvements #3/#4/#6 map to
  RES-01+02 / RES-03 / RES-04; the "load-bearing open question (gates #3)" section is
  the RES-01 spike charter; the "what is already correct -- do NOT change" list.
- `.planning/research/prior-art/ENGINE-REFERENCE.md` -- THE primary doc for this phase.
  "Resilience analysis" (the single whole-program try/catch vs `@angular/build`'s
  per-file isolation); IMPROVEMENT #1 (per-file loop, reachable via
  `getNgSemanticDiagnostics(fileName)`), #4 (`suppressOutputPathCheck`); "Open
  questions" 1/3/4 (non-fatal escapes, file-less non-template diagnostics, `isShim`
  parity) -- the spike must resolve #3.
- `.planning/research/prior-art/SHIM-HARDENING.md` -- #2 (wrap `options.realpath()`
  in try/catch in the boundary filter, RES-03).
- `.planning/research/prior-art/COMPILER-CLI-INTERNALS.md` -- `FatalDiagnosticError` /
  `isFatalDiagnosticError` / `UNKNOWN_ERROR_CODE` (500) context for RES-02.

### Requirements / roadmap
- `.planning/REQUIREMENTS.md` -- RES-01..RES-04 (RES-01 is the GATE/spike).
- `.planning/ROADMAP.md` -- Phase 9 goal + Success Criteria (SC1 = the GATE; SC2 =
  per-file isolation; SC3 = realpath; SC4 = `suppressOutputPathCheck`).

### Prior phase context (must not be contradicted)
- `.planning/phases/08-correctness-completeness-fixes/08-CONTEXT.md` -- D-06..D-10:
  the infra-vs-type classification + `TypecheckInfrastructureError` policy that RES-02
  (D-05) must NOT blur; the `gatherAllDiagnostics` edit context (COR-02's
  `getGlobalDiagnostics` call added at `gather-diagnostics.ts:35`).

### Engine source (the exact edit points)
- `packages/angular-typechecker/src/core/gather-diagnostics.ts` -- the single
  `program.getNgSemanticDiagnostics()` call (line 34) the per-file loop replaces
  (RES-02). NOTE COR-02's `getTsProgram().getGlobalDiagnostics()` (line 35) stays.
- `packages/angular-typechecker/src/core/filter-diagnostics.ts` --
  `createCanonicalizer` (`:115-136`); the `options.realpath(filePath)` call (`:127`)
  is the RES-03 try/catch site.
- `packages/angular-typechecker/src/core/run-typecheck.ts` -- the `readConfiguration`
  call (`:105`, RES-04 second-arg site); the realpath injection (`:229-230`); the
  emit-neutralizing override (`:166-193`); the infra re-throw (`:195-206`); `finalize`
  + `sortAndDeduplicateDiagnostics` (`:319-365`).
- `packages/angular-typechecker/src/core/compiler-cli-types.ts` -- confirms
  `getNgSemanticDiagnostics(fileName?)` (`:76-79`) and
  `readConfiguration(project, existingOptions?)` (`:155-158`) are ALREADY declared:
  RES-02 and RES-04 need NO shim widening.

### External prior art (reference only -- NOT in this repo; Angular clones @ tag v22.0.4)
- `@angular/compiler-cli` (`D:/projects/github/angular/angular`):
  `src/ngtsc/core/src/compiler.ts:591-609` (`NgCompiler.getDiagnostics`, the SINGLE
  whole-program try/catch that abandons remaining files), `:616-639`
  (`getDiagnosticsForFile`, the PER-FILE try/catch), `:618` (`d.file === file`
  non-template filter -- the load-bearing open question), `:631-636`
  (`isFatalDiagnosticError` catch), `:1243-1258` (`getNonTemplateDiagnostics`),
  `src/ngtsc/program.ts:224-243` (`getNgSemanticDiagnostics(fileName)` ->
  `getDiagnosticsForFile`), `:231-235` (out-of-program no-op),
  `src/perform_compile.ts:313-323` (outer catch -> `UNKNOWN_ERROR_CODE` 500),
  `src/ngtsc/typecheck/api/checker.ts:388-405` (`OptimizeFor` enum doc).
- `@angular/build` (`D:/projects/github/angular/angular-cli`):
  `src/tools/angular/compilation/aot-compilation.ts:281-294` (the per-file loop),
  `.../angular-compilation.ts:51` (`suppressOutputPathCheck: true` to
  `readConfiguration`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `program.getNgSemanticDiagnostics(fileName?)` -- the per-file overload RES-02 needs
  is ALREADY on the shim (`compiler-cli-types.ts:76-79`) and on the runtime
  `NgtscProgram`. No new type surface, no migration.
- `readConfiguration(project, existingOptions?)` -- the second-arg seam RES-04 uses is
  ALREADY declared (`compiler-cli-types.ts:155-158`).
- `createCanonicalizer` (`filter-diagnostics.ts:115-136`) already centralizes the
  `realpath` call + normalization + per-input memoization -- the single RES-03 edit
  point; the happy path and cache are untouched.
- `ts.sortAndDeduplicateDiagnostics` in `finalize` (`run-typecheck.ts:347`) already
  makes the per-file loop's union deterministic and dedup-safe -- no manual dedup.
- `TypecheckInfrastructureError` + the 500 re-throw (`run-typecheck.ts:195-206`) is the
  Phase 8 infra signal RES-02 must preserve (D-05): non-fatal escapes stay infra.

### Established Patterns
- CORE is framework-agnostic and PURE: eslint bans `@nx/*` / `@angular-devkit/*`
  imports AND `process.exit` in `**/src/core/**`. RES-03's realpath fallback must be
  SILENT (no logging / no `process`).
- The unconditional all-getter models `@angular/build` (NOT ngc's short-circuit). RES-02
  keeps that fidelity -- it changes WHICH path computes the Angular families (per-file
  vs whole-program), not WHICH families (ENGINE-REF #5, validated).
- Each non-spike change is test-gated failing-then-passing with a dedicated fixture
  (the v0.0.1/Phase-8 convention).
- Approach A / `performCompilation` + custom gatherer is retained; `NgtscProgram`
  migration stays deferred (PROJECT.md constraint).

### Integration Points
- RES-02 edits `gather-diagnostics.ts` (the gatherer passed as
  `performCompilation`'s `gatherDiagnostics` callback, `run-typecheck.ts:192`); the
  per-file calls run INSIDE `performCompilation`'s outer try/catch, which is why a
  non-fatal escape still becomes a single 500 (D-05 caveat).
- RES-03 edits `filter-diagnostics.ts` (the post-`performCompilation` boundary filter
  pass); RES-04 edits the `readConfiguration` call in `run-typecheck.ts`.
- The RES-01 spike exercises the live `api.Program` against a real fixture to detect
  file-less non-template diagnostics.

</code_context>

<specifics>
## Specific Ideas

- `@angular/build` is the north star for RES-02: its per-file
  `getDiagnosticsForFile(sf, optimizeFor)` loop with the PER-FILE `isFatalDiagnosticError`
  try/catch is exactly the resilience we want -- one poisoned component yields one
  diagnostic and the rest survive. We reach the same behavior from the existing
  `api.Program` via the `getNgSemanticDiagnostics(fileName)` overload.
- The RES-02 proof fixture is the differentiator: a multi-file fixture where ONE
  component throws a `FatalDiagnosticError` during TCB generation AND a SECOND component
  has a normal template error. Today the second error vanishes (whole-program early
  return); after the change it survives.
- HYBRID is the safety net, not a fallback to fear: the whole-program non-template call
  is what the engine already does, so HYBRID is "keep the file-less safety + add the
  per-file resilience." SIMPLE is the optimization gated on a proven precondition.

</specifics>

<deferred>
## Deferred Ideas

- **Isolating NON-fatal per-file escapes** (our own try/catch around each per-file
  call) -- ENGINE-REF Open Q1. Deferred: it would reclassify infra/non-fatal crashes as
  per-file diagnostics, contradicting the Phase 8 infra-vs-type policy. Revisit only if
  a real non-fatal escape is observed.
- **Phase 10 (HARD) items** -- the drift `tsconfig.drift.json` getter-set tripwire,
  `EmitFlags.None` fix, vendor markers, retained `getNgStructuralDiagnostics()` under
  assertion, the TS-99 leak regression spec. Out of this phase. Cross-phase note:
  Phase 10 HARD-01's getter-set assertion must cover whatever getter set RES-02 leaves
  in `gather-diagnostics.ts` (incl. the per-file `getNgSemanticDiagnostics(fileName)`
  usage and COR-02's `getGlobalDiagnostics`).
- **`NgtscProgram` migration / incremental / `--watch`** -- RES-02 stays on the
  existing `api.Program` surface (PROJECT.md Out of Scope).

</deferred>

---

*Phase: 9-resilience-per-file-fault-isolation-boundary-robustness*
*Context gathered: 2026-06-29*
