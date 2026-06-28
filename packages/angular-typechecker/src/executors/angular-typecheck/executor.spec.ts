import type { ExecutorContext } from '@nx/devkit';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { CoreResult } from '../../core/run-typecheck';

// Hoisted mock handles so each test can drive the composed core deterministically
// without a real compiler load. The executor is a pure adapter, so mocking its
// four core seams isolates the COMPOSITION + error-handling logic under test.
const mocks = vi.hoisted(() => {
  return {
    runTypecheck: vi.fn(),
    renderReport: vi.fn(async () => 'RENDERED REPORT'),
    evaluateResult: vi.fn(),
    normalizeOptions: vi.fn(() => ({
      coreOptions: {
        tsConfigPath: '/ws/libs/x/tsconfig.lib.json',
        includeDeps: false,
        pathBase: '/ws',
      },
      maxWarnings: undefined,
      failFast: false,
      color: false,
    })),
    loggerError: vi.fn(),
    loggerInfo: vi.fn(),
  };
});

// Keep the REAL TypecheckInfrastructureError class so the executor's
// `instanceof` catch works; only stub `runTypecheck`.
vi.mock('../../core/run-typecheck', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../core/run-typecheck')
  >();

  return {
    ...actual,
    runTypecheck: mocks.runTypecheck,
  };
});

vi.mock('../../core/render-report', () => {
  return { renderReport: mocks.renderReport };
});

vi.mock('../../core/evaluate-result', () => {
  return { evaluateResult: mocks.evaluateResult };
});

vi.mock('./normalize-options', () => {
  return { normalizeOptions: mocks.normalizeOptions };
});

vi.mock('@nx/devkit', () => {
  return {
    logger: { error: mocks.loggerError, info: mocks.loggerInfo },
    joinPathFragments: (...parts: string[]) => parts.join('/'),
  };
});

function coreResult(errorCount: number): CoreResult {
  return {
    tsConfigPath: '/ws/libs/x/tsconfig.lib.json',
    rootNamesCount: 1,
    diagnostics: [],
    errorCount,
    warningCount: 0,
    suppressedCount: 0,
    durationMs: 1,
  };
}

const context = { root: '/ws' } as ExecutorContext;
const options = { tsConfig: 'libs/x/tsconfig.lib.json' };

describe('angularTypecheckExecutor (D-01/D-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.renderReport.mockResolvedValue('RENDERED REPORT');
    mocks.normalizeOptions.mockReturnValue({
      coreOptions: {
        tsConfigPath: '/ws/libs/x/tsconfig.lib.json',
        includeDeps: false,
        pathBase: '/ws',
      },
      maxWarnings: undefined,
      failFast: false,
      color: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps errorCount === 0 to { success: true } (via evaluateResult)', async () => {
    mocks.runTypecheck.mockResolvedValue(coreResult(0));
    mocks.evaluateResult.mockReturnValue({ success: true });

    const { default: executor } = await import('./executor');
    const result = await executor(options, context);

    expect(result).toEqual({ success: true });
    expect(mocks.evaluateResult).toHaveBeenCalledWith(coreResult(0), {
      maxWarnings: undefined,
    });
  });

  it('maps errorCount > 0 to { success: false } (via evaluateResult)', async () => {
    mocks.runTypecheck.mockResolvedValue(coreResult(2));
    mocks.evaluateResult.mockReturnValue({ success: false });

    const { default: executor } = await import('./executor');
    const result = await executor(options, context);

    expect(result).toEqual({ success: false });
  });

  it('writes the rendered report through process.stdout.write, NOT logger.info (D-04)', async () => {
    mocks.runTypecheck.mockResolvedValue(coreResult(0));
    mocks.evaluateResult.mockReturnValue({ success: true });
    const writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    const { default: executor } = await import('./executor');
    await executor(options, context);

    expect(writeSpy).toHaveBeenCalledWith('RENDERED REPORT');
    expect(mocks.loggerInfo).not.toHaveBeenCalled();
  });

  it('catches a TypecheckInfrastructureError -> logger.error + { success: false } (D-01)', async () => {
    const { TypecheckInfrastructureError } = await import(
      '../../core/run-typecheck'
    );
    mocks.runTypecheck.mockRejectedValue(
      new TypecheckInfrastructureError('simulated internal crash'),
    );

    const { default: executor } = await import('./executor');
    const result = await executor(options, context);

    expect(result).toEqual({ success: false });
    expect(mocks.loggerError).toHaveBeenCalledOnce();
  });

  it('RE-THROWS a non-infrastructure error (never swallows an unknown failure) (D-01)', async () => {
    mocks.runTypecheck.mockRejectedValue(new Error('unexpected boom'));

    const { default: executor } = await import('./executor');

    await expect(executor(options, context)).rejects.toThrow('unexpected boom');
    expect(mocks.loggerError).not.toHaveBeenCalled();
  });

  it('does NOT treat a plain Error as a TypecheckInfrastructureError', async () => {
    const { TypecheckInfrastructureError } = await import(
      '../../core/run-typecheck'
    );
    mocks.runTypecheck.mockRejectedValue(new Error('plain'));

    const { default: executor } = await import('./executor');

    await expect(executor(options, context)).rejects.not.toBeInstanceOf(
      TypecheckInfrastructureError,
    );
  });
});
