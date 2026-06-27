// The pure pass/fail VERDICT for a type-check run (EXE-05 / D-03).
//
// `evaluateResult` maps the POST-filter `errorCount`/`warningCount` of a
// `CoreResult` to a `{ success }` decision. It is the framework-agnostic core of
// the `--max-warnings` quality gate: the Phase-4 Nx adapter calls it and maps the
// boolean to `{ success }` / a non-zero exit, so the verdict logic stays
// unit-testable with a 2-field literal -- no compiler, no `CoreResult`
// construction (the D-01 hybrid-split payoff, TEST-01).
//
// VERDICT CONTRACT (D-03):
//   - errors ALWAYS fail (`errorCount > 0` => `{ success: false }`), regardless
//     of `maxWarnings` -- errors can never be suppressed by the warning gate.
//   - with no `maxWarnings`, warnings never fail on their own.
//   - `warningCount > maxWarnings` fails; `maxWarnings: 0` fails on ANY warning;
//     at-threshold passes.
//
// CATEGORY RESPECT: the counts this reads were already bucketed by
// `ts.DiagnosticCategory` upstream in `finalize` (Phase-2 D-01). So a consumer's
// project-configured `extendedDiagnostics.defaultCategory: "error"` -- which
// promotes NG8xxx extended diagnostics from Warning to Error -- already lands in
// `errorCount` before this function runs; the verdict respects those categories
// without re-deriving severity here.
import type { CoreResult } from './run-typecheck';

export interface EvaluateOptions {
  // EXE-05: undefined => warnings never fail on their own; 0 => ANY warning
  // fails; n => warnings fail only when `warningCount > n`. A negative or NaN
  // value is treated defensively as unset (Security V5 / T-03-03): the Phase-4
  // adapter validates the CLI input, and this function refuses to crash or invert
  // the verdict on a malformed number.
  maxWarnings?: number;
}

/**
 * Computes the pass/fail verdict for a completed type-check (EXE-05 / D-03).
 * Errors always fail. When `maxWarnings` is a finite number >= 0, a
 * `warningCount` strictly above it fails (so `maxWarnings: 0` fails on any
 * warning). A negative or NaN `maxWarnings` is unset-equivalent (Security V5).
 */
export function evaluateResult(
  result: Pick<CoreResult, 'errorCount' | 'warningCount'>,
  options: EvaluateOptions = {},
): { success: boolean } {
  if (result.errorCount > 0) {
    return { success: false };
  }

  const { maxWarnings } = options;
  const gatesWarnings =
    maxWarnings !== undefined &&
    Number.isFinite(maxWarnings) &&
    maxWarnings >= 0;

  if (gatesWarnings && result.warningCount > maxWarnings) {
    return { success: false };
  }

  return { success: true };
}
