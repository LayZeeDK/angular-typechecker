import type ts from 'typescript';

import type { Program } from './compiler-cli-types';

/**
 * Gathers EVERY diagnostic getter on the Angular Program unconditionally, in
 * order, without the phase short-circuit that ngc's `defaultGatherDiagnostics`
 * applies (its `&&`-chain stops at `getNgSemanticDiagnostics` once an earlier
 * phase errors). Calling `getNgSemanticDiagnostics()` unconditionally is what
 * surfaces Angular template + extended (NG8xxx) diagnostics even when a
 * co-located TypeScript error exists in the same program (D-16, the
 * differentiator). No out-of-project / node_modules filtering here -- that is
 * deferred to Phase 3 (D-10).
 *
 * RES-02 / D-04 / D-05 / D-06 (the RES-01 GATE recorded GO = HYBRID; see
 * 09-RES-01-SPIKE.md): the Angular semantic set is now gathered with PER-FILE
 * FAULT ISOLATION so a single component's TCB-phase `FatalDiagnosticError` (e.g.
 * IMPORT_GENERATION_FAILURE during type-check-block generation) yields exactly
 * one diagnostic and does NOT abandon the remaining files' Angular diagnostics.
 * The per-file overload `getNgSemanticDiagnostics(sf.fileName)` delegates to the
 * compiler's `getDiagnosticsForFile(sf, OptimizeFor.WholeProgram)`, which carries
 * its OWN `isFatalDiagnosticError` try/catch -- one Fatal becomes one diagnostic
 * and the loop continues (the `@angular/build` north star).
 *
 * Shape = HYBRID, not SIMPLE. The RES-01 spike could not positively enumerate the
 * Angular NON-template diagnostic universe as file-bearing-and-matched (the
 * `getDiagnosticsForFile` filter is `diag.file === file`, an object-identity
 * comparison) and produced affirmative counter-evidence that a real Angular
 * diagnostic can attach to a generated `.ngtypecheck.ts` SHIM rather than the
 * iterated `.component.ts` -- exactly the shape a per-file-only loop would drop.
 * Per D-03 (inconclusive defaults to the strict superset), HYBRID KEEPS the
 * residual whole-program `getNgSemanticDiagnostics()` (the file-less-safe
 * non-template set, NOT filtered by file, so it can never under-gather a
 * file-less / shim-attached non-template diagnostic) AND adds the per-file loop
 * for the isolated template/extended families. `sf.isDeclarationFile` files are
 * skipped (D-06). `OptimizeFor.WholeProgram` is used implicitly via the
 * `fileName` overload -- NEVER `OptimizeFor.SingleFile` (D-07).
 *
 * NO catch-all is added (D-05): the loop wraps NOTHING in try/catch, so a
 * non-fatal / infrastructure throw still escapes to `performCompilation`'s outer
 * catch -> `UNKNOWN_ERROR_CODE 500` -> `TypecheckInfrastructureError` (the Phase 8
 * infra-vs-type policy is preserved). The per-file loop isolates the
 * `FatalDiagnosticError` class ONLY.
 *
 * Determinism is unchanged: `finalize`'s `ts.sortAndDeduplicateDiagnostics`
 * (run-typecheck.ts) orders + dedups the merged set, so the per-file template
 * duplicates the residual whole-program call ALSO produces are removed for free
 * (D-06) -- do NOT add a manual dedup.
 *
 * COR-02 / D-04: a final call gathers GLOBAL / location-less TypeScript semantic
 * diagnostics (e.g. TS2318 "Cannot find global type") via
 * `getTsProgram().getGlobalDiagnostics()`. The per-file `getTsSemanticDiagnostics`
 * path NEVER emits these (TypeScript buckets them separately, and `@angular/build`
 * calls `getGlobalDiagnostics()` explicitly), so without this call a real global
 * type error escapes the type-check (under-reporting).
 */
export function gatherAllDiagnostics(
  program: Program,
): readonly ts.Diagnostic[] {
  const all: ts.Diagnostic[] = [];

  all.push(...program.getTsOptionDiagnostics());
  all.push(...program.getNgOptionDiagnostics());
  all.push(...program.getTsSyntacticDiagnostics());
  all.push(...program.getTsSemanticDiagnostics());
  all.push(...program.getNgStructuralDiagnostics());

  // HYBRID (RES-02 / D-03 / D-04): residual whole-program non-template set...
  all.push(...program.getNgSemanticDiagnostics());

  // ...PLUS the per-file isolated template/extended loop (D-05/D-06/D-07).
  for (const sourceFile of program.getTsProgram().getSourceFiles()) {
    if (sourceFile.isDeclarationFile) {
      continue;
    }

    all.push(...program.getNgSemanticDiagnostics(sourceFile.fileName));
  }

  all.push(...program.getTsProgram().getGlobalDiagnostics()); // COR-02 / D-04

  return all;
}
