import type { ExecutorContext } from '@nx/devkit';
import { logger } from '@nx/devkit';

import { evaluateResult } from '../../core/evaluate-result';
import { renderReport } from '../../core/render-report';
import {
  runTypecheck,
  TypecheckInfrastructureError,
} from '../../core/run-typecheck';
import { normalizeOptions } from './normalize-options';
import type { AngularTypecheckExecutorOptions } from './schema';

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
export default async function angularTypecheckExecutor(
  options: AngularTypecheckExecutorOptions,
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
        `angular-typecheck: a fatal template-compilation error in ${offendingFile} ` +
          `(NG3004 IMPORT_GENERATION_FAILURE) aborted Angular template type-check-block ` +
          `generation. Surviving files' Angular template/extended (NG8xxx) diagnostics ` +
          `may be SUPPRESSED until that error is fixed -- this run's template check is ` +
          `INCOMPLETE. Fix the reported NG3004 and re-run angular-typecheck.`,
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

    return evaluateResult(result, { maxWarnings });
  } catch (error) {
    if (error instanceof TypecheckInfrastructureError) {
      logger.error(
        `angular-typecheck: the Angular compiler failed to run (infrastructure error, not a type error): ${error.message}`,
      );

      return { success: false };
    }

    throw error;
  }
}
