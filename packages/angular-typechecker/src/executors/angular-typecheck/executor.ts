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
