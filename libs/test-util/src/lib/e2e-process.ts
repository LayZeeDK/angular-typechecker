import { execSync } from 'node:child_process';
import { appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The outer `nx run <e2e-project>:test` injects these cache-defeating / "inner
// task" NX_* vars into the spec process. A naive `...process.env` would propagate
// them into a nested `nx run` / `nx build` / `nx g` / `npm install` and silently
// corrupt the run (most dangerously NX_SKIP_NX_CACHE, which forces every nested
// run to a cache-miss and kills the cache-e2e CACHE HIT assertions). Stripping
// them makes every nested invocation a clean top-level one regardless of how the
// outer test task was invoked. Identical in every e2e spec -- extracted here.
const NX_RUNNER_ENV_KEYS: readonly string[] = [
  'NX_SKIP_NX_CACHE',
  'NX_TASK_HASH',
  'NX_INVOCATION_ROOT_PID',
  'NX_FORKED_TASK_EXECUTOR',
  'NX_TASK_TARGET_PROJECT',
  'NX_TASK_TARGET_TARGET',
  'NX_CLI_SET',
  'NX_TERMINAL_CAPTURE_STDERR',
];

/**
 * Build a clean environment for a nested `nx` / `npm` / `pnpm` invocation from an
 * e2e spec: always strips {@link NX_RUNNER_ENV_KEYS} and forces `NX_DAEMON=false`
 * (no stale daemon graph) + `FORCE_COLOR=0` (un-split stdout for token asserts).
 *
 * `npm_config_*` handling is the load-bearing variant:
 * - default: strips ONLY `npm_config_legacy_peer_deps` / `NPM_CONFIG_LEGACY_PEER_DEPS`
 *   so a leaked peer-resolution override cannot MASK a real consumer ERESOLVE
 *   (B-03 honesty). This is what the tarball / generator / matrix specs need.
 * - `stripAllNpmConfig: true`: strips EVERY `npm_config_*` key. REQUIRED for the
 *   Verdaccio consumer + globalSetup -- an inherited `npm_config_registry` (incl.
 *   the one `startLocalRegistry` sets in the parent process) outranks a `--registry`
 *   flag and would silently retarget publish/install away from local Verdaccio.
 */
export function buildCleanEnv(options?: {
  stripAllNpmConfig?: boolean;
}): NodeJS.ProcessEnv {
  const cleaned: NodeJS.ProcessEnv = { ...process.env };

  for (const key of NX_RUNNER_ENV_KEYS) {
    delete cleaned[key];
  }

  if (options?.stripAllNpmConfig) {
    for (const key of Object.keys(cleaned)) {
      if (/^npm_config_/i.test(key)) {
        delete cleaned[key];
      }
    }
  } else {
    delete cleaned['npm_config_legacy_peer_deps'];
    delete cleaned['NPM_CONFIG_LEGACY_PEER_DEPS'];
  }

  return {
    ...cleaned,
    NX_DAEMON: 'false',
    FORCE_COLOR: '0',
  };
}

export interface RunResult {
  stdout: string;
  code: number;
}

/**
 * Extract the single JSON payload object from FRAMED CLI output. The Nx / Angular CLI
 * task runners wrap an executor's raw stdout with their own chrome (a leading
 * task-echo line, a trailing run summary), so `JSON.parse(rawStdout)` fails even
 * though the machine payload itself is pure. The payload is the ONLY brace-delimited
 * object in the output, so slice from the first `{` to the last `}`; a JSON.parse /
 * validateSarif on the slice then proves the payload boundary is clean -- and fails
 * LOUDLY (never a false pass) if chrome ever bled INSIDE the braces.
 *
 * Used for the `ng run` / `nx run` adapters (VER-03), where -- unlike the standalone
 * `.bin` shim -- the framework owns stdout framing. The guaranteed-pure stdout proof
 * stays on the CLI shim path (`runShimSplit`).
 */
export function extractJsonPayload(rawStdout: string): string {
  const start = rawStdout.indexOf('{');
  const end = rawStdout.lastIndexOf('}');

  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      `extractJsonPayload: no brace-delimited payload in output:\n${rawStdout}`,
    );
  }

  return rawStdout.slice(start, end + 1);
}

/**
 * Run `command` in `options.cwd` with `options.env` and capture the exit code +
 * combined stdout/stderr. `execSync` throws on a non-zero exit, so the catch is how
 * a failing command's output + status are captured (NEVER pipe the command through
 * head/rg -- the pipe tail's exit code would mask the command's). `maxBuffer` is
 * forwarded verbatim; passing `undefined` is byte-equivalent to omitting it
 * (execSync's 1 MB default).
 *
 * Shared by {@link run} (default buffer) and the ng-cli e2e `ng run` runner (20 MB,
 * IN-02) -- the identical execSync -> {@link RunResult} try/catch lived in both.
 */
export function execToRunResult(
  command: string,
  options: { cwd: string; env: NodeJS.ProcessEnv; maxBuffer?: number },
): RunResult {
  try {
    const stdout = execSync(command, {
      cwd: options.cwd,
      env: options.env,
      encoding: 'utf8',
      maxBuffer: options.maxBuffer,
    });

    return { stdout, code: 0 };
  } catch (error) {
    const execError = error as {
      stdout?: string;
      stderr?: string;
      status?: number;
    };

    return {
      stdout: `${execError.stdout ?? ''}${execError.stderr ?? ''}`,
      code: execError.status ?? 1,
    };
  }
}

/**
 * Run `npx nx run <target> --output-style=static [--skip-nx-cache]` in `cwd` and
 * capture the result via {@link execToRunResult} (a fixed target id + fixed flags
 * only reach the shell).
 *
 * `options.env` defaults to a default-strip {@link buildCleanEnv} so a caller that
 * forgets to pass an env still gets nested-nx isolation rather than raw process.env.
 */
export function run(
  cwd: string,
  target: string,
  options?: { env?: NodeJS.ProcessEnv; skipNxCache?: boolean },
): RunResult {
  const env = options?.env ?? buildCleanEnv();
  const command = `npx nx run ${target} --output-style=static${
    options?.skipNxCache ? ' --skip-nx-cache' : ''
  }`;

  return execToRunResult(command, { cwd, env });
}

interface InstallTimingRecord {
  ts: number;
  cmd: string;
  cwd: string;
  ms: number;
  ok: boolean;
}

/**
 * OPT-IN install timing. Only ever called when `ATC_TIME_INSTALLS === '1'` (guarded
 * at every call site in {@link sh}), so the default path stays byte-identical to a
 * plain `execSync` wrapper. Appends ONE JSONL line -- the record and its trailing
 * newline in a SINGLE `appendFileSync` call -- so concurrent `--parallel=2` e2e
 * workers cannot interleave a half-written line into a neighbor's. Output path is
 * `ATC_TIMING_OUT` (absolute wins) or an OS-tmpdir default; `tmp/` is gitignored, so
 * the raw JSONL is never committed. Aggregated by tools/e2e-timing/.
 */
function recordInstallTiming(record: InstallTimingRecord): void {
  const outPath =
    process.env['ATC_TIMING_OUT'] ??
    join(tmpdir(), 'atc-install-timings.jsonl');

  try {
    appendFileSync(outPath, `${JSON.stringify(record)}\n`);
  } catch {
    // Best-effort diagnostics. A failed timing write (e.g. ATC_TIMING_OUT points at a
    // path whose parent directory does not exist -> ENOENT) must NEVER invert a
    // SUCCEEDED command into a throw, nor replace a real failure's captured
    // stdout/stderr with a bare fs error -- both would defeat the very reason sh()
    // exists. Losing one opt-in timing line is acceptable; corrupting the command
    // result is not. Swallow it (mirrors removeTmpDir's best-effort teardown).
  }
}

/**
 * `execSync` wrapper that, on failure, rethrows an Error carrying the command plus
 * its captured stdout + stderr -- so a failed `npm install` / `nx g` surfaces WHY
 * it failed instead of the bare "Command failed: <cmd>" default. Returns the
 * command's stdout on success.
 *
 * When `process.env.ATC_TIME_INSTALLS === '1'` it ALSO appends one timing JSONL line
 * (both the success and failure paths) via {@link recordInstallTiming}. When the flag
 * is unset this is a true no-op: no `performance.now()`, no write, and the returned
 * stdout + thrown Error message are byte-identical to the un-instrumented wrapper.
 */
export function sh(
  command: string,
  options: { cwd: string; env: NodeJS.ProcessEnv },
): string {
  const timed = process.env['ATC_TIME_INSTALLS'] === '1';
  const started = timed ? performance.now() : 0;

  try {
    const stdout = execSync(command, {
      cwd: options.cwd,
      env: options.env,
      encoding: 'utf8',
    });

    if (timed) {
      recordInstallTiming({
        ts: Date.now(),
        cmd: command,
        cwd: options.cwd,
        ms: Math.round(performance.now() - started),
        ok: true,
      });
    }

    return stdout;
  } catch (error) {
    if (timed) {
      recordInstallTiming({
        ts: Date.now(),
        cmd: command,
        cwd: options.cwd,
        ms: Math.round(performance.now() - started),
        ok: false,
      });
    }

    const execError = error as { stdout?: string; stderr?: string };

    throw new Error(
      `${command}\n${execError.stdout ?? ''}${execError.stderr ?? ''}`,
    );
  }
}

/**
 * Probe whether `command` runs successfully in `options.cwd` with `options.env`:
 * runs it via {@link sh} and returns `true` on exit 0, `false` on any throw. Specs
 * use this as an availability guard for an optional external tool (pnpm, corepack,
 * a corepack-provisioned yarn) so a host without it skips cleanly instead of
 * failing later at the real invocation.
 */
export function commandSucceeds(
  command: string,
  options: { cwd: string; env: NodeJS.ProcessEnv },
): boolean {
  try {
    sh(command, options);

    return true;
  } catch {
    return false;
  }
}

/**
 * Best-effort recursive teardown of an OS-temp dir. On Windows a lingering nx
 * subprocess (or a just-installed node_modules handle) can hold a dir open past
 * execSync's return, so a bare recursive rmSync EPERMs; the linear backoff may not
 * outwait the lock. A failed removal of a unique per-run OS-temp dir must NEVER
 * fail a scenario whose assertions already ran (the CI e2e gate is Linux-only,
 * where this never EPERMs). Swallow the residual error.
 */
export function removeTmpDir(dir: string): void {
  try {
    rmSync(dir, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  } catch {
    // best-effort: a unique per-run OS-temp dir left behind is harmless.
  }
}
