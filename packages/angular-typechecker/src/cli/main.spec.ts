import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CoreResult } from '../core/run-typecheck';
import { TypecheckInfrastructureError } from '../core/run-typecheck';
import { BufferingLogger } from './console-logger';
import { run } from './main';

// VER-01: pure unit coverage of run()'s COMPOSITION + the two-step exit-code
// compose (EXIT-01), the stdout/stderr routing (CLI-03), the purity contract
// (EXIT-02), the color precedence (ARGS-05), single-vs-array (ARGS-03), and the
// --version drift-lock (VER-01) -- all against a STUBBED core. Mirrors
// executor.spec.ts's vi.hoisted + vi.mock(importOriginal) pattern with the paths
// adjusted ONE level up (src/cli -> src/core). Unlike executor.spec (which mocks
// @nx/devkit and asserts the executor DOES process.stdout.write), run() has NO nx
// import -- it builds its own BufferingLogger and NEVER writes a stream, so this
// spec asserts on the RETURNED { exitCode, stdout, stderr } and on the OPPOSITE
// purity contract.

const SENTINEL_REPORT = 'STUBBED RENDERED REPORT';

// Hoisted handles so each test drives the composed core deterministically without a
// real compiler load. runTypecheck / renderReport / evaluateResult are stubbed;
// emitAdvisoryNotices and toExitCode stay REAL (the notice routing and the literal
// 2 must be exercised end-to-end), and parse-args / console-logger stay REAL.
const mocks = vi.hoisted(() => {
  return {
    runTypecheck: vi.fn(),
    // Bare vi.fn() (like runTypecheck above) so its `.mock.calls` args tuple is
    // `any[]` -- the lastColor() helper reads call-arg index [1] (the options),
    // which a zero-arg inline impl would type as an empty tuple (TS2493/TS2532).
    // beforeEach sets mockResolvedValue(SENTINEL_REPORT), so no inline impl is needed.
    renderReport: vi.fn(),
    evaluateResult: vi.fn(),
  };
});

// Keep the REAL TypecheckInfrastructureError so run()'s `instanceof` catch works +
// the real toExitCode maps it to 2; only stub runTypecheck.
vi.mock('../core/run-typecheck', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../core/run-typecheck')>();

  return {
    ...actual,
    runTypecheck: mocks.runTypecheck,
  };
});

vi.mock('../core/render-report', () => {
  return { renderReport: mocks.renderReport };
});

vi.mock('../core/evaluate-result', () => {
  return { evaluateResult: mocks.evaluateResult };
});

// The version drift-lock reads the SAME manifest parse-args reads (two dirs above
// src/cli/), via the repo's established readFileSync idiom (parse-args.spec.ts).
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifestVersion = (
  JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
    version: string;
  }
).version;

function coreResult(errorCount: number): CoreResult {
  return {
    tsConfigPath: '/ws/libs/x/tsconfig.lib.json',
    rootNamesCount: 1,
    diagnostics: [],
    errorCount,
    warningCount: 0,
    suppressedThirdParty: 0,
    suppressedInGraphErrorCount: 0,
    suppressedInGraphWarningCount: 0,
    suppressedInGraphFiles: [],
    durationMs: 1,
  };
}

// The tsConfigPath run() actually handed the stubbed runTypecheck on the last call
// (ARGS-03: a STRING for a single -c, a string[] for two).
function lastTsConfigPath(): CoreResult['tsConfigPath'] | string | string[] {
  return mocks.runTypecheck.mock.calls.at(-1)?.[0].tsConfigPath;
}

// The `color` option run() actually handed the stubbed renderReport on the last
// call (ARGS-05).
function lastColor(): boolean | undefined {
  return mocks.renderReport.mock.calls.at(-1)?.[1].color;
}

// The `includeDeps` option run() actually handed the stubbed runTypecheck.
function lastIncludeDeps(): boolean | undefined {
  return mocks.runTypecheck.mock.calls.at(-1)?.[0].includeDeps;
}

// The `failFast` option run() actually handed the stubbed renderReport.
function lastFailFast(): boolean | undefined {
  return mocks.renderReport.mock.calls.at(-1)?.[1].failFast;
}

describe('run() (VER-01: exit compose, routing, purity, color, drift-lock)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runTypecheck.mockResolvedValue(coreResult(0));
    mocks.renderReport.mockResolvedValue(SENTINEL_REPORT);
    mocks.evaluateResult.mockReturnValue({ success: true, outcome: 'clean' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('EXIT-01: two-step exit-code compose', () => {
    it('returns exitCode 0 for a clean completed run (evaluateResult -> success:true)', async () => {
      mocks.evaluateResult.mockReturnValue({ success: true, outcome: 'clean' });

      const result = await run(['-c', 'tsconfig.app.json']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(SENTINEL_REPORT);
    });

    it('returns exitCode 1 for a type-error run (evaluateResult -> success:false, type-error)', async () => {
      mocks.runTypecheck.mockResolvedValue(coreResult(2));
      mocks.evaluateResult.mockReturnValue({
        success: false,
        outcome: 'type-error',
      });

      const result = await run(['-c', 'tsconfig.app.json']);

      expect(result.exitCode).toBe(1);
    });

    // The anti-false-pass, subtlest new logic: errorCount === 0 but success === false
    // (a first-party diagnostic was dropped) MUST still exit 1 -- proving the 0/1
    // split comes from evaluateResult().success, NEVER from raw counts / toExitCode.
    it('returns exitCode 1 for a coverage-incomplete run with errorCount === 0 (success:false)', async () => {
      mocks.runTypecheck.mockResolvedValue(coreResult(0));
      mocks.evaluateResult.mockReturnValue({
        success: false,
        outcome: 'coverage-incomplete',
      });

      const result = await run(['-c', 'tsconfig.app.json']);

      expect(result.exitCode).toBe(1);
    });

    // Same anti-false-pass for a warnings-exceeded run (also errorCount === 0).
    it('returns exitCode 1 for a warnings-exceeded run with errorCount === 0 (success:false)', async () => {
      mocks.runTypecheck.mockResolvedValue(coreResult(0));
      mocks.evaluateResult.mockReturnValue({
        success: false,
        outcome: 'warnings-exceeded',
      });

      const result = await run([
        '-c',
        'tsconfig.app.json',
        '--max-warnings',
        '0',
      ]);

      expect(result.exitCode).toBe(1);
    });

    it('returns exitCode 2 for a caught TypecheckInfrastructureError (via toExitCode) and names it in stderr', async () => {
      mocks.runTypecheck.mockRejectedValue(
        new TypecheckInfrastructureError('simulated internal crash'),
      );

      const result = await run(['-c', 'tsconfig.app.json']);

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('infrastructure error');
      expect(result.stdout).toBe('');
      // The verdict seams are never reached on the infra path.
      expect(mocks.evaluateResult).not.toHaveBeenCalled();
    });

    it('returns exitCode 2 for a usage error DIRECTLY, before the core runs', async () => {
      const result = await run(['--nope']);

      expect(result.exitCode).toBe(2);
      expect(result.stderr.length).toBeGreaterThan(0);
      expect(result.stdout).toBe('');
      expect(mocks.runTypecheck).not.toHaveBeenCalled();
    });

    it('RE-THROWS a non-infrastructure error (never swallows an unknown failure)', async () => {
      mocks.runTypecheck.mockRejectedValue(new Error('unexpected boom'));

      await expect(run(['-c', 'tsconfig.app.json'])).rejects.toThrow(
        'unexpected boom',
      );
    });
  });

  describe('ARGS-04 / D-11: --help and --version short-circuit to stdout, exit 0', () => {
    it('run([--version]) returns exitCode 0 and stdout equal to the real package.json version (drift-lock)', async () => {
      const result = await run(['--version']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(manifestVersion + '\n');
      expect(result.stderr).toBe('');
      expect(mocks.runTypecheck).not.toHaveBeenCalled();
    });

    it('run([--help]) returns exitCode 0 with the npx angular-typechecker synopsis in stdout', async () => {
      const result = await run(['--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('npx angular-typechecker');
      expect(result.stdout).not.toContain('npx atc');
      expect(result.stderr).toBe('');
    });
  });

  describe('CLI-03: stdout/stderr routing', () => {
    it('routes the renderReport output to stdout ONLY', async () => {
      const result = await run(['-c', 'tsconfig.app.json']);

      expect(result.stdout).toBe(SENTINEL_REPORT);
      expect(result.stderr).toBe('');
    });

    it('routes an advisory notice to stderr, never contaminating the stdout report', async () => {
      // Drive a real advisory through the REAL emitAdvisoryNotices seam over a stub
      // CoreResult (templateCheckAborted trips the loud NG3004/SUPPRESSED warn).
      mocks.runTypecheck.mockResolvedValue({
        ...coreResult(1),
        templateCheckAborted: {
          code: -993004,
          fileName: '/ws/libs/x/poison.component.ts',
        },
      });
      mocks.evaluateResult.mockReturnValue({
        success: false,
        outcome: 'coverage-incomplete',
      });

      const result = await run(['-c', 'tsconfig.app.json']);

      // The notice lands in stderr...
      expect(result.stderr).toContain('NG3004');
      expect(result.stderr).toContain('SUPPRESSED');
      expect(result.stderr).toContain('/ws/libs/x/poison.component.ts');
      // ...and stdout stays EXCLUSIVELY the byte-deterministic report.
      expect(result.stdout).toBe(SENTINEL_REPORT);
      expect(result.stdout).not.toContain('NG3004');
    });
  });

  describe('EXIT-02: purity -- never process.exit, never a stream write', () => {
    it('calls neither process.exit nor process.stdout.write across a run() call', async () => {
      const exitSpy = vi
        .spyOn(process, 'exit')
        .mockImplementation((() => undefined) as never);
      const writeSpy = vi
        .spyOn(process.stdout, 'write')
        .mockImplementation(() => true);

      await run(['-c', 'tsconfig.app.json']);

      expect(exitSpy).not.toHaveBeenCalled();
      expect(writeSpy).not.toHaveBeenCalled();
    });
  });

  describe('ARGS-03: single --tsConfig -> string; two -> string[]', () => {
    it('hands the stubbed runTypecheck a STRING for a single -c (direct / solution-walk path)', async () => {
      await run(['-c', 'tsconfig.app.json']);

      const passed = lastTsConfigPath();

      expect(Array.isArray(passed)).toBe(false);
      expect(typeof passed).toBe('string');
      expect(passed as string).toMatch(/tsconfig\.app\.json$/);
    });

    it('hands the stubbed runTypecheck a string[] for two -c (union path)', async () => {
      await run(['-c', 'tsconfig.app.json', '-c', 'tsconfig.spec.json']);

      const passed = lastTsConfigPath();

      expect(Array.isArray(passed)).toBe(true);
      expect(passed as string[]).toHaveLength(2);
      expect((passed as string[])[0]).toMatch(/tsconfig\.app\.json$/);
      expect((passed as string[])[1]).toMatch(/tsconfig\.spec\.json$/);
    });
  });

  describe('ARGS-05: color precedence (NO_COLOR > FORCE_COLOR > isTTY)', () => {
    it('NO_COLOR wins over FORCE_COLOR (color OFF even when FORCE_COLOR is set)', async () => {
      await run(['-c', 'tsconfig.app.json'], {
        NO_COLOR: '1',
        FORCE_COLOR: '1',
      });

      expect(lastColor()).toBe(false);
    });

    it('FORCE_COLOR=0 means color OFF', async () => {
      await run(['-c', 'tsconfig.app.json'], { FORCE_COLOR: '0' });

      expect(lastColor()).toBe(false);
    });

    it('FORCE_COLOR set (not 0/false) means color ON', async () => {
      await run(['-c', 'tsconfig.app.json'], { FORCE_COLOR: '1' });

      expect(lastColor()).toBe(true);
    });

    it('with neither env var, color tracks process.stdout.isTTY', async () => {
      await run(['-c', 'tsconfig.app.json'], {});

      expect(lastColor()).toBe(process.stdout.isTTY === true);
    });
  });

  // Wiring-only guard: --include-deps -> CoreOptions.includeDeps (runTypecheck) and
  // --fail-fast -> renderReport({ failFast }). Without these, a dropped/swapped
  // wiring would pass every other test silently.
  describe('wiring: --include-deps and --fail-fast reach the core', () => {
    it('threads --include-deps into the runTypecheck CoreOptions', async () => {
      await run(['-c', 'tsconfig.app.json', '--include-deps']);

      expect(lastIncludeDeps()).toBe(true);
    });

    it('defaults includeDeps to false without the flag', async () => {
      await run(['-c', 'tsconfig.app.json']);

      expect(lastIncludeDeps()).toBe(false);
    });

    it('threads --fail-fast into the renderReport options', async () => {
      await run(['-c', 'tsconfig.app.json', '--fail-fast']);

      expect(lastFailFast()).toBe(true);
    });

    it('defaults failFast to false without the flag', async () => {
      await run(['-c', 'tsconfig.app.json']);

      expect(lastFailFast()).toBe(false);
    });
  });
});

describe('BufferingLogger (D-04: info/warn/error accumulate into one ordered stderr buffer)', () => {
  it('joins every line by a newline in insertion order across all three methods', () => {
    const logger = new BufferingLogger();
    logger.info('info-line');
    logger.warn('warn-line');
    logger.error('error-line');

    expect(logger.text).toBe('info-line\nwarn-line\nerror-line');
  });

  it('returns the empty string when nothing was logged', () => {
    expect(new BufferingLogger().text).toBe('');
  });
});
