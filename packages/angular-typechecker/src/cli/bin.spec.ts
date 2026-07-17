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

  beforeEach(() => {
    previousExitCode = process.exitCode;
    stdoutChunks.length = 0;
    stderrChunks.length = 0;
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
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('./main');
  });

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
});
