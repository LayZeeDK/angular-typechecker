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
 * COR-02 / D-04: a SEVENTH call gathers GLOBAL / location-less TypeScript
 * semantic diagnostics (e.g. TS2318 "Cannot find global type") via
 * `getTsProgram().getGlobalDiagnostics()`. The per-file `getTsSemanticDiagnostics`
 * path NEVER emits these (TypeScript buckets them separately, and `@angular/build`
 * calls `getGlobalDiagnostics()` explicitly), so without this call a real global
 * type error escapes the type-check (under-reporting). Placement is irrelevant:
 * `finalize`'s `ts.sortAndDeduplicateDiagnostics` (run-typecheck.ts) orders +
 * dedups the merged set, so any overlap with the per-file getters is safe.
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
  all.push(...program.getNgSemanticDiagnostics());
  all.push(...program.getTsProgram().getGlobalDiagnostics()); // COR-02 / D-04

  return all;
}
