import type { Logger } from '../core/logger';

/**
 * A {@link Logger} that ACCUMULATES every line into one in-memory buffer instead
 * of writing a stream (D-04, Phase 26). run() (Plan 26-02) injects it into
 * `emitAdvisoryNotices` (and uses `error` for the infra path), then hands the
 * joined {@link BufferingLogger.text} to the returned `stderr`. The REAL stream
 * write happens ONLY in bin.ts (Phase 27); keeping the sink in memory is what
 * lets run() stay stream-free (EXIT-02) while still routing every notice/error
 * to stderr (CLI-03).
 *
 * All three methods route to the SAME buffer on purpose: everything except the
 * `renderReport` output is stderr, so info/warn/error share one ordered stream.
 *
 * nx-free by construction (D-15): the ONLY import is a type-only `Logger` from
 * the pure `../core/logger` seam (erased at compile), so nothing from the Nx
 * devkit or the `nx` runtime reaches the CLI runtime import graph.
 */
export class BufferingLogger implements Logger {
  private readonly lines: string[] = [];

  info(message: string): void {
    this.lines.push(message);
  }

  warn(message: string): void {
    this.lines.push(message);
  }

  error(message: string): void {
    this.lines.push(message);
  }

  /** The buffered lines joined by a newline; the empty string when unused. */
  get text(): string {
    return this.lines.join('\n');
  }
}
