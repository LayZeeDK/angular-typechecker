import { realpathSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

import { emitAdvisoryNotices } from '../core/emit-advisory-notices';
import { evaluateResult } from '../core/evaluate-result';
import { logInfrastructureError } from '../core/log-infrastructure-error';
import { renderReport } from '../core/render-report';
import type { CoreOptions } from '../core/run-typecheck';
import {
  runTypecheck,
  TypecheckInfrastructureError,
} from '../core/run-typecheck';
import { BufferingLogger } from './console-logger';
import { parseCliArgs } from './parse-args';

/**
 * The load-bearing pure core of the standalone CLI (Phase 26, EXIT-01/EXIT-02/
 * CLI-02/CLI-03). `run()` is the THIRD thin adapter over the same core the Nx
 * executor and (later) the Angular CLI builder compose: it mirrors
 * `executors/typecheck/executor.ts`'s pipeline VERBATIM, swapping only the sink,
 * the path resolver, and the return shape.
 *
 * - the Nx devkit `logger` -> an in-memory {@link BufferingLogger} (the joined
 *   lines become the returned `stderr`, D-03/D-04);
 * - `joinPathFragments(context.root, ...)` -> nx-free `node:path` resolution against
 *   `process.cwd()` + a guarded `realpathSync.native` normalization (D-05/D-06);
 * - the Nx `{ success }` return -> a literal `exitCode`, across three branches:
 *   an infra error -> 2; a usage error -> 2 directly; a completed run ->
 *   `evaluateResult(...).success ? 0 : 1` (the sole owner of the 0/1 verdict).
 *
 * nx-free by construction (D-15): the ONLY imports are Node stdlib + pure-core
 * modules by RELATIVE path (one level up, `../core/*`) + the two Wave-1 CLI seams
 * (`./parse-args`, `./console-logger`). It NEVER touches the Nx devkit / the `nx`
 * runtime, an executor/builder module, or the barrel one dir up. The enforcing
 * ESLint `src/cli/**` import-ban and the static module-graph guard
 * (`bin-static.spec.ts`) hold this boundary.
 *
 * PURITY (EXIT-02): `run()` NEVER calls `process.exit` and NEVER writes a stream.
 * It returns `{ exitCode, stdout, stderr }`; `bin.ts` (Phase 27) is the ONLY tier
 * that writes those strings and exits the process.
 */
export interface RunResult {
  readonly exitCode: 0 | 1 | 2;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * D-09 / ARGS-05 color precedence. The NO_COLOR/FORCE_COLOR inputs are read from the
 * passed `env` (never a module global); only the final fallback reads the
 * `process.stdout.isTTY` global:
 *   1. `NO_COLOR` present with ANY value (including empty) -> OFF (it WINS -- a user
 *      sets NO_COLOR to GUARANTEE no color, per the NO_COLOR informal standard);
 *   2. else `FORCE_COLOR` present and not `"0"`/`"false"` -> ON;
 *   3. else `process.stdout.isTTY === true` (a read, exactly as the executor does).
 * The boolean feeds `renderReport({ color })`, which strips ANSI when false.
 */
function colorFromEnv(env: NodeJS.ProcessEnv): boolean {
  if (env.NO_COLOR !== undefined) {
    return false;
  }

  const forceColor = env.FORCE_COLOR;

  if (
    forceColor !== undefined &&
    forceColor !== '0' &&
    forceColor !== 'false'
  ) {
    return true;
  }

  return process.stdout.isTTY === true;
}

/**
 * Resolves ONE `--tsConfig` entry from an arbitrary CWD (D-05/D-06 / PKG-03), the
 * nx-free equivalent of `normalize-options.ts`'s `joinPathFragments(context.root, ...)`:
 * an absolute path passes through, a relative one is resolved against
 * `process.cwd()`; the result is `.replace(/\\/g, '/')`-normalized for POSIX-separator
 * stability, then run through `realpathSync.native` for Windows drive-letter-case /
 * 8.3-name normalization.
 *
 * THE try/catch IS LOAD-BEARING (RESEARCH Open Question 1 / Pitfall 2):
 * `realpathSync.native` THROWS `ENOENT` on a nonexistent path, but a nonexistent /
 * malformed tsconfig must RETURN exit 2 (via the core's `TypecheckInfrastructureError`),
 * NOT throw uncaught out of `run()`. So on ANY realpath failure we fall through to the
 * plain `.replace`d resolved absolute path and let `runTypecheck`'s config-resolution
 * stage raise its canonical error -> caught below -> exit 2.
 */
function toAbsoluteTsConfigPath(rawPath: string): string {
  const resolved = (
    isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath)
  ).replace(/\\/g, '/');

  try {
    return realpathSync.native(resolved).replace(/\\/g, '/');
  } catch {
    return resolved;
  }
}

/**
 * Runs the complete standalone-CLI type-check in-process and returns the literal
 * exit code plus the report (`stdout`) and buffered notices/errors (`stderr`).
 * Pure (D-02): NO `process.exit`, NO stream writes. `env` defaults to `process.env`
 * but is injectable so the NO_COLOR/FORCE_COLOR color precedence is deterministic in
 * tests (ARGS-05); the isTTY fallback still reads the `process.stdout` global.
 *
 * Flow (mirrors the executor): parse -> (help/version/usage short-circuits) ->
 * resolve+normalize `--tsConfig` -> build `CoreOptions` -> `runTypecheck` ->
 * `emitAdvisoryNotices` (BEFORE the report, so notices are not lost below a
 * codeframe dump) -> `renderReport` -> `evaluateResult` -> the D-01 exit code.
 */
export async function run(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<RunResult> {
  const logger = new BufferingLogger();
  const parsed = parseCliArgs(argv);

  // Usage error -> exit 2 DIRECTLY (D-01 branch 2), before the core ever runs.
  if (parsed.kind === 'usageError') {
    logger.error(parsed.message);

    return { exitCode: 2, stdout: '', stderr: logger.text };
  }

  // --help / --version print to stdout and exit 0 (D-11). They ARE the report in
  // that mode, so they short-circuit before the core and leave stderr empty.
  if (parsed.kind === 'help' || parsed.kind === 'version') {
    return { exitCode: 0, stdout: parsed.text, stderr: '' };
  }

  // ARGS-03 / D-13: collapse a length-1 resolved array to a single STRING (the
  // direct / solution-walk path); 2+ stay a string[] (the multi-leaf union). A
  // single input is NEVER a one-element array -- that would skip solution-walk.
  const resolvedTsConfig = parsed.tsConfig.map(toAbsoluteTsConfigPath);
  const tsConfigPath =
    resolvedTsConfig.length === 1 ? resolvedTsConfig[0] : resolvedTsConfig;

  const pathBase = process.cwd();
  const coreOptions: CoreOptions = {
    tsConfigPath,
    includeDeps: parsed.includeDeps,
    pathBase,
  };
  // D-10: the explicit --color/--no-color flag WINS over the env precedence
  // (NO_COLOR > FORCE_COLOR > TTY); colorFromEnv stays the fallback when no flag
  // is passed. Human path only -- machine formats are unconditionally plain.
  const color = parsed.color ?? colorFromEnv(env);

  try {
    const result = await runTypecheck(coreOptions);

    // Notices BEFORE the report so they cannot be lost below a long codeframe dump.
    // A clean run stays silent (each helper self-gates on its own guard).
    // D-09: --quiet gates the stderr advisory chatter ONLY -- never the stdout
    // payload, never the verdict/exit code (the never-silent charter).
    if (!parsed.quiet) {
      emitAdvisoryNotices(result, logger);
    }

    const report = await renderReport(result, {
      pathBase,
      color,
      failFast: parsed.failFast,
      // D-08/FMT-01: select the reporter; maxWarnings/strict let the json
      // summary DELEGATE its verdict to evaluateResult (never re-derive counts).
      format: parsed.format,
      maxWarnings: parsed.maxWarnings,
      strict: parsed.strict,
    });

    // D-01 branch 3: the 0-vs-1 split comes from evaluateResult(...).success ONLY --
    // NEVER raw counts. A coverage-incomplete or warnings-exceeded run
    // has errorCount === 0 but success === false; reading counts here would be a
    // SILENT FALSE PASS that violates the charter.
    const { success } = evaluateResult(result, {
      maxWarnings: parsed.maxWarnings,
      strict: parsed.strict,
    });

    return { exitCode: success ? 0 : 1, stdout: report, stderr: logger.text };
  } catch (error) {
    // D-01 branch 1: a TypecheckInfrastructureError (the compiler failed to RUN, not a
    // type error) is always exit 2 -- the compiler produced no verdict to grade.
    if (error instanceof TypecheckInfrastructureError) {
      logInfrastructureError(logger, error);

      return { exitCode: 2, stdout: '', stderr: logger.text };
    }

    // Any OTHER error is RE-THROWN: bin.ts (Phase 27) maps an unknown failure to 2.
    // run() never swallows an unknown failure and reports a clean/typed verdict.
    throw error;
  }
}
