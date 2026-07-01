import { isAbsolute } from 'node:path';

import type { ExecutorContext } from '@nx/devkit';
import { joinPathFragments } from '@nx/devkit';

import type { CoreOptions } from '../../core/run-typecheck';
import type { TypecheckExecutorOptions } from './schema';

/**
 * The pure mapping from the Nx executor's native options + `ExecutorContext` to
 * the framework-agnostic core inputs, with reporter-only knobs split OUT of
 * `CoreOptions` (D-01).
 *
 * - `coreOptions` carries only what the engine needs: an ABSOLUTE `tsConfigPath`,
 *   the `includeDeps` boundary switch, and the `pathBase` (workspace root) the
 *   formatter uses for CI annotation paths.
 * - `maxWarnings` is the verdict-only quality gate (consumed by `evaluateResult`).
 * - `failFast` + `color` are reporter-only (consumed by `renderReport`).
 */
export interface NormalizedOptions {
  coreOptions: CoreOptions;
  maxWarnings?: number;
  failFast: boolean;
  color: boolean;
}

/**
 * Maps `TypecheckExecutorOptions` + `ExecutorContext` to
 * {@link NormalizedOptions} (D-01/D-03). Pure: no I/O, no compiler load.
 *
 * D-03 tsConfig resolution: an absolute `tsConfig` passes through; a relative one
 * is resolved WORKSPACE-root-relative via `joinPathFragments(context.root, ...)`
 * (NOT `node:path.join` -- POSIX-separator stability on Windows arm64). The core
 * requires an absolute path and never reads `process.cwd()`.
 *
 * `maxWarnings` is forwarded AS-IS (no `?? 0`): `evaluateResult` defensively
 * treats undefined / negative / NaN as unset (EXE-05), so a `default: 0` footgun
 * is avoided. `color` is derived from the TTY here so the core stays
 * `process`-free (D-04 / Phase-3 D-11).
 */
export function normalizeOptions(
  options: TypecheckExecutorOptions,
  context: ExecutorContext,
): NormalizedOptions {
  const tsConfigPath = isAbsolute(options.tsConfig)
    ? options.tsConfig
    : joinPathFragments(context.root, options.tsConfig);

  return {
    coreOptions: {
      tsConfigPath,
      includeDeps: options.includeDeps ?? false,
      pathBase: context.root,
    },
    maxWarnings: options.maxWarnings,
    failFast: options.failFast ?? false,
    color: process.stdout.isTTY === true,
  };
}
