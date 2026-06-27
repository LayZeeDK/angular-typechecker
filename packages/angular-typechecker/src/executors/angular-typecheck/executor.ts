import type { ExecutorContext } from '@nx/devkit';

import { runTypecheck } from '../../core/run-typecheck';
import type { AngularTypecheckExecutorOptions } from './schema';

/**
 * Thin Nx executor adapter -- the only tier that references @nx/devkit (type-only)
 * -- delegating to the framework-agnostic core. Its compiled .js is the GATE A
 * artifact: built under module: nodenext so the transitive dynamic load of
 * @angular/compiler-cli in compiler-loader.ts survives emit (not downleveled to
 * require()). Full option normalization and schema validation are deferred to
 * Phase 4 (EXE-01).
 */
export default async function angularTypecheckExecutor(
  options: AngularTypecheckExecutorOptions,
  _context: ExecutorContext,
): Promise<{ success: boolean }> {
  const result = await runTypecheck({ tsConfigPath: options.tsConfig });

  return { success: result.errorCount === 0 };
}
