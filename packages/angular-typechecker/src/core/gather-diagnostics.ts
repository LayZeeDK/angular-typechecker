import type { Program } from '@angular/compiler-cli';
import type ts from 'typescript';

/**
 * Gathers EVERY diagnostic getter on the Angular Program unconditionally, in
 * order, without the phase short-circuit that ngc's `defaultGatherDiagnostics`
 * applies (its `&&`-chain stops at `getNgSemanticDiagnostics` once an earlier
 * phase errors). Calling `getNgSemanticDiagnostics()` unconditionally is what
 * surfaces Angular template + extended (NG8xxx) diagnostics even when a
 * co-located TypeScript error exists in the same program (D-16, the
 * differentiator). No out-of-project / node_modules filtering here -- that is
 * deferred to Phase 3 (D-10).
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

  return all;
}
