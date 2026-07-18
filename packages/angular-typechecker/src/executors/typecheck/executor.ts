import type { ExecutorContext } from '@nx/devkit';
import { logger } from '@nx/devkit';

import { emitAdvisoryNotices } from '../../core/emit-advisory-notices';
import { evaluateResult } from '../../core/evaluate-result';
import { logInfrastructureError } from '../../core/log-infrastructure-error';
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
 * framework-agnostic core: normalizeOptions -> runTypecheck ->
 * emitAdvisoryNotices(result, logger) -> renderReport (raw stdout) ->
 * evaluateResult -> { success }.
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
 * emitAdvisoryNotices (the reusable core seam, CLI-04) surfaces the core's PURE
 * structured advisory fields (templateCheckAborted / skippedReferences / the split
 * suppressed counts / notTypeCheckedDeclaredFiles / bundlerQueryImports) as
 * injected-`Logger` notices BEFORE the report so they cannot be lost below a long
 * codeframe dump. This is the detection(core)-vs-rendering(adapter) split: core
 * only COUNTS + records paths; the adapter injects its @nx/devkit `logger` into the
 * pure seam. All are additive signalling that NEVER touch the verdict
 * (evaluateResult owns it).
 */
export default async function typecheckExecutor(
  options: TypecheckExecutorOptions,
  context: ExecutorContext,
): Promise<{ success: boolean }> {
  const { coreOptions, maxWarnings, failFast, color, strict, format } =
    normalizeOptions(options, context);

  try {
    const result = await runTypecheck(coreOptions);

    // Surface the loud advisory notices BEFORE the report so they cannot be lost
    // below a long codeframe dump. Each fires only when the core flagged the
    // corresponding condition; a clean run stays silent.
    emitAdvisoryNotices(result, logger);

    const report = await renderReport(result, {
      pathBase: coreOptions.pathBase,
      color,
      failFast,
      // FMT-01/D-08: forward the format selector so --format json takes effect
      // from the Nx executor AND the Angular CLI builder (which inherits this
      // call via convertNxExecutor). maxWarnings/strict let the json summary
      // DELEGATE its verdict to evaluateResult (never re-derive counts).
      format,
      maxWarnings,
      strict,
    });
    // D-04: write the report to RAW stdout, NOT logger.info (which prepends Nx
    // chrome/color and corrupts the byte-deterministic codeframes + GitHub
    // problem-matcher file:line:col parsing).
    process.stdout.write(report);

    // The authoritative verdict lives in evaluateResult (plan 17-04); the adapter
    // reads ONLY `.success` and maps it to Nx's `{ success }`, so any extra
    // structured fields evaluateResult may carry never leak into the return.
    const { success } = evaluateResult(result, { maxWarnings, strict });

    return { success };
  } catch (error) {
    if (error instanceof TypecheckInfrastructureError) {
      logInfrastructureError(logger, error);

      return { success: false };
    }

    throw error;
  }
}
