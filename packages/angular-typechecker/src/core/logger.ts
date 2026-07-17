/**
 * The structural `Logger` seam contract every adapter injects (D-01/D-03).
 *
 * It is intentionally DEPENDENCY-FREE: this file imports NOTHING, so it can never
 * reach `nx`/`@nx/*`/`@angular-devkit/*`, `console`, or `process` -- exactly the
 * `src/core` D-11 lint boundary. That purity is what lets any pure-core module
 * (and the Phase-26 CLI's `run()`) depend on `Logger` without dragging a framework
 * into the runtime import graph. `@nx/devkit`'s `logger` already exposes
 * `info`/`warn`/`error`, so it is structurally assignable to this interface and an
 * adapter passes it in with ZERO wrapper (D-02); the homegrown shape is used
 * instead of importing `@nx/devkit`'s (which the boundary bans, and which is an
 * anonymous const anyway).
 *
 * `error` is part of the contract even though the five advisories use only
 * `info`/`warn` -- it is used by the CLI/executor infrastructure path
 * (`main.ts` / `executor.ts`), and freezing the full seam shape here once means
 * every adapter inherits the same contract (D-03).
 */
export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void; // D-03: used by the CLI/executor infra path (main.ts / executor.ts); no advisory uses it
}
