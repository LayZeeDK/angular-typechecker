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
//
// COVERAGE-INCOMPLETE (SB-04 / D-06, the input-set-membership charter floor): a
// first-party (in-graph) diagnostic the project-boundary filter DROPPED must never
// coexist with a green verdict. `run-typecheck` surfaces the split counters
// (`suppressedInGraphErrorCount` / `suppressedInGraphWarningCount`), the
// whole-program TCB-abort flag (`templateCheckAborted`, FM-9), and any
// `zero-root-names` skipped reference (a first-party leaf that resolved zero
// files). Any of these means the run did NOT fully check what it claims to, so the
// verdict is `coverage-incomplete` (success:false) -- distinct from a genuine
// `type-error`. The WARNING-severity coverage trigger is LATE-BOUND here with the
// real `maxWarnings` (D-06): `finalize` never receives `maxWarnings`, so baking the
// warning decision into core would silently pass a dropped in-graph warning under
// `maxWarnings: 0`. `suppressedThirdParty` (node_modules) NEVER affects the verdict.
import type { CoreResult } from './run-typecheck';

// D-06: the discriminated verdict label. `type-error` wins over every coverage
// trigger (errors are the loudest signal); `coverage-incomplete` means a
// first-party diagnostic was dropped or a leaf checked nothing; `warnings-exceeded`
// is the existing EXE-05 `--max-warnings` gate; `clean` is a fully-checked pass.
export type Outcome =
  | 'clean'
  | 'type-error'
  | 'coverage-incomplete'
  | 'warnings-exceeded';

export interface EvaluateOptions {
  // EXE-05: undefined => warnings never fail on their own; 0 => ANY warning
  // fails; n => warnings fail only when `warningCount > n`. A negative or NaN
  // value is treated defensively as unset (Security V5 / T-03-03): the Phase-4
  // adapter validates the CLI input, and this function refuses to crash or invert
  // the verdict on a malformed number.
  maxWarnings?: number;
}

// The verdict reads the two ALWAYS-required counts (`errorCount`/`warningCount`)
// plus the OPTIONAL coverage signals. The live caller passes a full `CoreResult`
// (so the split counters are always present + wired, T-17-09); the coverage fields
// are optional here purely so the pure unit tier keeps its minimal-literal idiom --
// an absent count reads as `0` (nothing suppressed), the safe default.
type EvaluateInput = Pick<CoreResult, 'errorCount' | 'warningCount'> &
  Partial<
    Pick<
      CoreResult,
      | 'suppressedInGraphErrorCount'
      | 'suppressedInGraphWarningCount'
      | 'templateCheckAborted'
      | 'skippedReferences'
    >
  >;

/**
 * Computes the pass/fail verdict + discriminated `outcome` for a completed
 * type-check (EXE-05 / D-03 / D-06). Ordered decision:
 *   1. `errorCount > 0` -> type-error (errors always win the label).
 *   2. a suppressed in-graph error -> coverage-incomplete.
 *   3. `templateCheckAborted` present -> coverage-incomplete (FM-9).
 *   4. a `zero-root-names` skipped reference -> coverage-incomplete.
 *   5. `warningCount > maxWarnings` (when gated) -> warnings-exceeded.
 *   6. a suppressed in-graph warning (when gated) -> coverage-incomplete.
 *   7. else -> clean.
 * The warning-severity coverage decision (6) is LATE-BOUND with the real
 * `maxWarnings` (D-06). A negative or NaN `maxWarnings` is unset-equivalent
 * (Security V5).
 */
export function evaluateResult(
  result: EvaluateInput,
  options: EvaluateOptions = {},
): { success: boolean; outcome: Outcome } {
  if (result.errorCount > 0) {
    return { success: false, outcome: 'type-error' };
  }

  const suppressedInGraphErrorCount = result.suppressedInGraphErrorCount ?? 0;

  if (suppressedInGraphErrorCount > 0) {
    return { success: false, outcome: 'coverage-incomplete' };
  }

  if (result.templateCheckAborted !== undefined) {
    return { success: false, outcome: 'coverage-incomplete' };
  }

  const hasZeroRootNamesLeaf =
    result.skippedReferences?.some(
      (reference) => reference.reason === 'zero-root-names',
    ) ?? false;

  if (hasZeroRootNamesLeaf) {
    return { success: false, outcome: 'coverage-incomplete' };
  }

  const { maxWarnings } = options;
  const gatesWarnings =
    maxWarnings !== undefined &&
    Number.isFinite(maxWarnings) &&
    maxWarnings >= 0;

  if (gatesWarnings && result.warningCount > maxWarnings) {
    return { success: false, outcome: 'warnings-exceeded' };
  }

  const suppressedInGraphWarningCount =
    result.suppressedInGraphWarningCount ?? 0;

  if (gatesWarnings && suppressedInGraphWarningCount > 0) {
    return { success: false, outcome: 'coverage-incomplete' };
  }

  return { success: true, outcome: 'clean' };
}
