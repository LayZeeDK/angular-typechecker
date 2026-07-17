#!/usr/bin/env node
/**
 * The standalone CLI OS shell (Phase 27, CLI-01 / EXIT-02 bin half). The THIRD
 * thin adapter's process boundary over the pure `run()` core: the ONLY tier that
 * writes stdout/stderr and owns the literal OS exit code. It adds NO logic beyond
 * wiring (D-01). Imports ONLY `./main` -- never an executor/builder, the barrel,
 * or nx (the nx-free `src/cli/**` boundary, D-09).
 */
import { run } from './main';

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
