import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// bin.ts is the standalone CLI's process shell: it runs run() at module load, writes
// the returned stdout/stderr, and owns the literal OS exit code. These tests mock
// './main' and dynamically import './bin' so the top-level run() call is driven
// deterministically WITHOUT spawning a process. process.exitCode is saved and
// restored around every test -- bin.ts sets it, and a leaked value would make
// vitest's own process exit non-zero.

describe('bin.ts (CLI-01 / EXIT-02: process wiring over run())', () => {
  let previousExitCode: typeof process.exitCode;
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  // Snapshot of the 'error' listeners present BEFORE each import('./bin'). Every
  // import (under vi.resetModules) re-runs bin.ts's top-level
  // process.stdout/stderr.on('error', ignoreEpipe), attaching a FRESH listener to
  // the real vitest process streams. Without removal they accumulate across tests
  // and files and leak into vitest's own process -- so afterEach removes any
  // 'error' listener that is present then but was absent from these snapshots
  // (mirrors the process.exitCode save/restore care).
  let stdoutErrorListeners: readonly ((...args: unknown[]) => void)[] = [];
  let stderrErrorListeners: readonly ((...args: unknown[]) => void)[] = [];

  beforeEach(() => {
    previousExitCode = process.exitCode;
    stdoutChunks.length = 0;
    stderrChunks.length = 0;
    stdoutErrorListeners = process.stdout.listeners('error') as ((
      ...args: unknown[]
    ) => void)[];
    stderrErrorListeners = process.stderr.listeners('error') as ((
      ...args: unknown[]
    ) => void)[];
    vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
      stdoutChunks.push(String(chunk));

      return true;
    }) as typeof process.stdout.write);
    vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: unknown) => {
      stderrChunks.push(String(chunk));

      return true;
    }) as typeof process.stderr.write);
    vi.resetModules();
  });

  afterEach(() => {
    // CRITICAL: undo bin.ts's process.exitCode mutation so a test's exit code never
    // leaks into vitest's own process exit.
    process.exitCode = previousExitCode;
    // CRITICAL: remove the 'error' listeners bin.ts attached this test so they do
    // not accumulate on the shared vitest process streams.
    removeAddedListeners('error', process.stdout, stdoutErrorListeners);
    removeAddedListeners('error', process.stderr, stderrErrorListeners);
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('./main');
  });

  // Remove every listener on `stream` for `event` that is absent from `before`
  // (i.e. added by the just-run import('./bin')).
  function removeAddedListeners(
    event: 'error',
    stream: NodeJS.WriteStream,
    before: readonly ((...args: unknown[]) => void)[],
  ): void {
    const current = stream.listeners(event) as ((...args: unknown[]) => void)[];

    for (const listener of current) {
      if (!before.includes(listener)) {
        stream.removeListener(event, listener);
      }
    }
  }

  // Let the floating run().then().catch() chain bin.ts starts on import settle.
  function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  it('applies the run() result exitCode and writes stdout + stderr on the happy path', async () => {
    vi.doMock('./main', () => ({
      run: vi.fn().mockResolvedValue({
        exitCode: 1,
        stdout: 'THE REPORT',
        stderr: 'a notice',
      }),
    }));

    await import('./bin');
    await flush();

    expect(process.exitCode).toBe(1);
    expect(stdoutChunks.join('')).toContain('THE REPORT');
    // A notice is terminated with a newline (never glues the shell prompt).
    expect(stderrChunks.join('')).toBe('a notice\n');
  });

  it('maps a re-thrown non-infrastructure error to exit 2 and writes it to stderr', async () => {
    vi.doMock('./main', () => ({
      run: vi.fn().mockRejectedValue(new Error('unexpected boom')),
    }));

    await import('./bin');
    await flush();

    // The last-line defense: an unknown crash is infrastructure-class (2), NEVER a
    // clean (0) or type-error (1) verdict.
    expect(process.exitCode).toBe(2);
    expect(stderrChunks.join('')).toContain('unexpected boom');
  });

  it('stringifies a thrown plain object via its message, not [object Object]', async () => {
    vi.doMock('./main', () => ({
      run: vi.fn().mockRejectedValue({ message: 'object-shaped failure' }),
    }));

    await import('./bin');
    await flush();

    expect(process.exitCode).toBe(2);
    expect(stderrChunks.join('')).toContain('object-shaped failure');
    expect(stderrChunks.join('')).not.toContain('[object Object]');
  });

  it('swallows an EPIPE stream error and preserves the computed exit code', async () => {
    vi.doMock('./main', () => ({
      run: vi.fn().mockResolvedValue({
        exitCode: 1,
        stdout: 'THE REPORT',
        stderr: '',
      }),
    }));

    await import('./bin');
    await flush();

    // A reader closing the pipe early raises an async EPIPE 'error' on the stream;
    // the guard must swallow it so the process still exits with run()'s verdict.
    const epipe = Object.assign(new Error('write EPIPE'), { code: 'EPIPE' });

    expect(() => process.stdout.emit('error', epipe)).not.toThrow();
    expect(() => process.stderr.emit('error', epipe)).not.toThrow();
    expect(process.exitCode).toBe(1);
  });

  it('re-throws a non-EPIPE stream error so a real write failure stays loud', async () => {
    vi.doMock('./main', () => ({
      run: vi.fn().mockResolvedValue({
        exitCode: 0,
        stdout: 'THE REPORT',
        stderr: '',
      }),
    }));

    await import('./bin');
    await flush();

    const other = Object.assign(new Error('disk full'), { code: 'ENOSPC' });

    expect(() => process.stdout.emit('error', other)).toThrow('disk full');
    expect(() => process.stderr.emit('error', other)).toThrow('disk full');
  });
});
