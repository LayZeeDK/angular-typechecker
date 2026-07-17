#!/usr/bin/env node
/**
 * The standalone CLI OS shell (Phase 27, CLI-01 / EXIT-02 bin half). The THIRD
 * thin adapter's process boundary over the pure `run()` core: the ONLY tier that
 * writes stdout/stderr and owns the literal OS exit code. It adds NO logic beyond
 * wiring (D-01). Imports ONLY `./main` -- never an executor/builder, the barrel,
 * or nx (the nx-free `src/cli/**` boundary, D-09).
 */
import { run } from './main';

/**
 * Swallows an EPIPE stream error and RE-THROWS everything else (Pitfall 6, EPIPE
 * half). When a downstream reader closes the pipe early (e.g.
 * `atc -c tsconfig.json | head`), the next drain of `process.stdout` /
 * `process.stderr` raises an ASYNC `'error'` event with `code === 'EPIPE'` on the
 * stream. `process.exitCode` is already set SYNCHRONOUSLY in the `.then`/`.catch`
 * below, before that async event can fire, so swallowing EPIPE lets the process
 * exit with the already-computed 0/1/2 verdict instead of dying with an uncaught
 * `write EPIPE` stack + a wrong exit code -- the flush-safety complement to the
 * existing "process.exitCode, never process.exit()" rule. Any NON-EPIPE stream
 * failure (e.g. ENOSPC) is RE-THROWN so a genuine write failure stays loud.
 */
function ignoreEpipe(error: NodeJS.ErrnoException): void {
  if (error.code === 'EPIPE') {
    return;
  }

  throw error;
}

// Register the guard on BOTH streams at module load, BEFORE the run() chain below
// issues any write -- an EPIPE can only be caught if the listener is already
// attached when the failing write drains.
process.stdout.on('error', ignoreEpipe);
process.stderr.on('error', ignoreEpipe);

run(process.argv.slice(2))
  .then(({ exitCode, stdout, stderr }) => {
    if (stdout) {
      process.stdout.write(stdout);
    }

    if (stderr) {
      // Terminate with a newline so a usage/infra message never glues the shell
      // prompt to it (BufferingLogger.text joins lines with no trailing
      // terminator); matches the .catch path below.
      process.stderr.write(stderr.endsWith('\n') ? stderr : stderr + '\n');
    }

    // D-02: set the code and RETURN. The event loop drains the writes above, then
    // the process exits with this code. NEVER process.exit(code) here -- it would
    // truncate a piped stdout tail (every CI run + the e2e execSync capture) that a
    // TSxxxx-code assertion needs (Pitfall 6).
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    // D-03: run() re-throws any non-TypecheckInfrastructureError; an unknown crash
    // is infrastructure-class for a type-checker -> exit 2, never 0/1. Prefer a
    // stack, then a message (a thrown plain object with only `message` would
    // otherwise stringify to "[object Object]"), then the value itself.
    const thrown = error as { stack?: string; message?: string };
    process.stderr.write(
      String(thrown?.stack ?? thrown?.message ?? error) + '\n',
    );
    process.exitCode = 2;
  });
