import type { ExecutorContext } from '@nx/devkit';
import { logger } from '@nx/devkit';

import { evaluateResult } from '../../core/evaluate-result';
import { renderReport } from '../../core/render-report';
import {
  runTypecheck,
  TypecheckInfrastructureError,
} from '../../core/run-typecheck';
import { normalizeOptions } from './normalize-options';
import type { TypecheckExecutorOptions } from './schema';

/**
 * The complete Nx executor adapter (D-01) -- the only tier (with
 * normalize-options) that references @nx/devkit. It composes the
 * framework-agnostic core: normalizeOptions -> runTypecheck -> renderReport
 * (raw stdout) -> evaluateResult -> { success }.
 *
 * Its compiled .js is the GATE A artifact: built under module: nodenext so the
 * transitive dynamic load of @angular/compiler-cli in compiler-loader.ts (reached
 * via runTypecheck + renderReport) survives emit (not downleveled to require()).
 *
 * Error handling (D-01): a `TypecheckInfrastructureError` (the Angular compiler
 * failed to RUN -- not a type error) is caught and mapped to a distinct
 * logger.error meta message + { success: false }. EVERY other error is RE-THROWN:
 * a type-checker that silently swallows an unknown failure and reports success is
 * worse than none.
 *
 * RES-02 (reframe; 09-RES-02-DECISION.md): when the core reports a TCB-generation
 * Fatal (`result.templateCheckAborted`), the adapter emits a LOUD `logger.warn`
 * (distinct from the infra `logger.error`) naming the offending file -- so the
 * incompleteness (surviving files' Angular template/extended NG8xxx diagnostics
 * are suppressed until that Fatal is fixed) is NEVER silent. The verdict is
 * untouched: the Fatal is still a counted type error, and the infra-vs-type path
 * (D-05) is unchanged -- this is additive signalling, not a reclassification.
 */
export default async function typecheckExecutor(
  options: TypecheckExecutorOptions,
  context: ExecutorContext,
): Promise<{ success: boolean }> {
  const { coreOptions, maxWarnings, failFast, color } = normalizeOptions(
    options,
    context,
  );

  try {
    const result = await runTypecheck(coreOptions);

    // RES-02 (reframe): surface the loud suppression notice BEFORE the report so
    // it cannot be lost below a long codeframe dump. Fires only when the core
    // flagged a TCB-generation Fatal -- never on clean / ordinarily-erroring runs.
    if (result.templateCheckAborted !== undefined) {
      const offendingFile =
        result.templateCheckAborted.fileName ?? 'an unknown file';

      logger.warn(
        `angular-typechecker: a fatal template-compilation error (e.g. in ${offendingFile}) ` +
          `(NG3004 IMPORT_GENERATION_FAILURE) aborted Angular template type-check-block ` +
          `generation. Surviving files' Angular template/extended (NG8xxx) diagnostics ` +
          `may be SUPPRESSED until it is fixed -- this run's template check is ` +
          `INCOMPLETE, so its coverage is incomplete and the verdict is NOT clean. ` +
          `Fix all reported NG3004 diagnostics and re-run typecheck.`,
      );
    }

    // D-02 (Phase 13, L-4): surface the loud skipped-reference notice. Fires only
    // when the core recorded at least one reference skipped (out-of-project /
    // zero-root-names / self-reference) or reclassified (not-found -> 90002)
    // during a solution-tsconfig walk. One logger.warn per reference. ADVISORY
    // ONLY -- the verdict is unchanged: a boundary-skipped leaf's diagnostics
    // simply never entered the union, and a not-found leaf is already a counted
    // 90002 in the report. Core sets skippedReferences only when non-empty (never
    // []), so the optional-chained length check alone is sufficient.
    if (result.skippedReferences?.length) {
      for (const skipped of result.skippedReferences) {
        // A `not-found` reference is folded into the report as a COUNTED 90002
        // Error that FAILS the verdict, so its notice must NOT claim to be
        // advisory-only (the C4 inaccuracy). A `zero-root-names` reference no
        // longer claims "verdict unchanged" either: under input-set membership
        // (Phase 17), if a sibling leaf was checked, this leaf's transitively-
        // imported files can be dropped by the project boundary and counted as
        // suppressedInGraph -- a coverage-incomplete (non-clean) verdict. Every
        // OTHER reason (out-of-project / self-reference / duplicate) still excludes
        // the leaf's own diagnostics WITHOUT changing the verdict, so that advisory
        // wording holds.
        let verdictNote: string;

        if (skipped.reason === 'not-found') {
          verdictNote =
            `It is reported as a counted error (90002) that FAILS the type-check -- ` +
            `restore the referenced tsconfig or remove the stale reference.`;
        } else if (skipped.reason === 'zero-root-names') {
          verdictNote =
            `If a sibling leaf was checked, this leaf's transitively-imported files ` +
            `may have been dropped by the project boundary -- contributing to a ` +
            `coverage-incomplete (non-clean) verdict. See the coverage-incomplete notice.`;
        } else {
          verdictNote = `This notice is advisory only -- the type-check verdict is unchanged.`;
        }

        logger.warn(
          `angular-typechecker: referenced tsconfig '${skipped.referencePath}' was skipped ` +
            `or reclassified during the solution-tsconfig reference walk (reason: ${skipped.reason}). ` +
            verdictNote,
        );
      }
    }

    // SB-04 (17-RESEARCH Pitfall 5; storybook-input-set-boundary step 3): surface
    // the two split suppressed counts LOUDLY from the PURE structured CoreResult
    // fields -- CI gates on the exit code and agents on the verdict, but a human
    // needs the notice too. This mirrors the detection(core)-vs-rendering(adapter)
    // split above (templateCheckAborted / skippedReferences): core only COUNTS +
    // records file paths, the adapter is the only tier that touches @nx/devkit
    // `logger`. The counts are NOT recomputed here -- they are read straight off
    // the structured result. Both fire only when > 0, so a clean host stays silent.

    // Expected node_modules suppressions: quiet INFO. NEVER verdict-affecting
    // (dependency isolation) -- pass `includeDeps` to fold them back in.
    if (result.suppressedThirdParty > 0) {
      logger.info(
        `angular-typechecker: ${result.suppressedThirdParty} node_modules diagnostic(s) ` +
          `suppressed (expected; pass includeDeps to include them).`,
      );
    }

    // D-07 / T-17-12 / T-17-13: a dropped FIRST-PARTY (in-graph) diagnostic is the
    // milestone's core correctness signal -- LOUD WARN. It names the dropped files
    // (from the pure `suppressedInGraphFiles`) ONLY, NEVER the dependency's error
    // text, so content isolation (criterion 3) holds while the coverage loss is
    // never silent. The verdict itself is decided by evaluateResult (17-04).
    if (
      result.suppressedInGraphErrorCount > 0 ||
      result.suppressedInGraphWarningCount > 0
    ) {
      logger.warn(
        `angular-typechecker: this run's coverage is INCOMPLETE and the verdict is ` +
          `NOT clean -- ${result.suppressedInGraphErrorCount} error(s) and ` +
          `${result.suppressedInGraphWarningCount} warning(s) on first-party files were ` +
          `dropped by the project boundary. A real diagnostic on a checked file may have ` +
          `been suppressed. Dropped file(s): ${result.suppressedInGraphFiles.join(', ')}.`,
      );
    }

    const report = await renderReport(result, {
      pathBase: coreOptions.pathBase,
      color,
      failFast,
    });
    // D-04: write the report to RAW stdout, NOT logger.info (which prepends Nx
    // chrome/color and corrupts the byte-deterministic codeframes + GitHub
    // problem-matcher file:line:col parsing).
    process.stdout.write(report);

    // The authoritative verdict lives in evaluateResult (plan 17-04); the adapter
    // reads ONLY `.success` and maps it to Nx's `{ success }`, so any extra
    // structured fields evaluateResult may carry never leak into the return.
    const { success } = evaluateResult(result, { maxWarnings });

    return { success };
  } catch (error) {
    if (error instanceof TypecheckInfrastructureError) {
      logger.error(
        `angular-typechecker: the Angular compiler failed to run (infrastructure error, not a type error): ${error.message}`,
      );

      return { success: false };
    }

    throw error;
  }
}
