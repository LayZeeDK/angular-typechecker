import type { Logger } from './logger';
import type { TypecheckInfrastructureError } from './run-typecheck';

/**
 * The single home of the infrastructure-error meta message (D-01, single-home).
 * A `TypecheckInfrastructureError` means the Angular compiler failed to RUN -- a
 * config-resolution crash or an internal createProgram/host/getter crash -- NOT a
 * type error; every adapter surfaces the same loud `logger.error` before mapping it
 * to its own failure shape (the CLI to exit 2, the Nx executor to `{ success: false }`).
 *
 * The message string used to be duplicated byte-for-byte in `src/cli/main.ts` and
 * `src/executors/typecheck/executor.ts`; a byte-identical string with two owners is
 * a drift hazard in a codebase that pins output byte-exactly (the prose pin at
 * `main.integration.spec.ts` rests on this exact text). Centralizing it here gives
 * that contract one owner, the same way `emit-advisory-notices.ts` centralized the
 * five advisory helpers.
 *
 * PURE (D-11 / eslint `src/core`): the module performs NO I/O of its own -- its only
 * imports are type-only, so it can never reach `nx`/`@nx/*`, `console`, or `process`.
 * The caller owns the concrete sink and injects it as {@link Logger}; the
 * detection(core)-vs-rendering(adapter) split holds because this module takes no sink
 * of its own.
 */
export function logInfrastructureError(
  logger: Logger,
  error: TypecheckInfrastructureError,
): void {
  logger.error(
    `angular-typechecker: the Angular compiler failed to run (infrastructure error, not a type error): ${error.message}`,
  );
}
