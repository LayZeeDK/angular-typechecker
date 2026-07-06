import type { ExecutorContext } from '@nx/devkit';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    loggerWarn: vi.fn(),
  };
});

// Keep the REAL TypecheckInfrastructureError class so the executor's
// `instanceof` catch works; only stub `runTypecheck`.
vi.mock('../../core/run-typecheck', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../core/run-typecheck')>();

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
    logger: {
      error: mocks.loggerError,
      info: mocks.loggerInfo,
      warn: mocks.loggerWarn,
    },
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
    suppressedThirdParty: 0,
    suppressedInGraphErrorCount: 0,
    suppressedInGraphWarningCount: 0,
    suppressedInGraphFiles: [],
    durationMs: 1,
  };
}

// RES-02 (reframe): a CoreResult that carries the TCB-generation-abort flag the
// adapter must turn into a loud logger.warn naming the offending file.
function abortedCoreResult(fileName: string | undefined): CoreResult {
  return {
    ...coreResult(1),
    templateCheckAborted: { code: -993004, fileName },
  };
}

// WALK-01 (Phase 13, D-02 adapter render): a CoreResult carrying the NON-EMPTY
// skippedReferences the adapter must turn into one loud logger.warn per entry.
// Core sets the field only when non-empty (mapping the walk's `[]` -> undefined),
// so `errorCount` here models a walked verdict independent of the advisory notice.
function skippedRefsCoreResult(
  skippedReferences: CoreResult['skippedReferences'],
): CoreResult {
  return {
    ...coreResult(1),
    skippedReferences,
  };
}

const context = { root: '/ws' } as ExecutorContext;
const options = { tsConfig: 'libs/x/tsconfig.lib.json' };

describe('typecheckExecutor (D-01/D-04)', () => {
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

  it('RES-02 reframe: emits a loud logger.warn naming the file when templateCheckAborted is set', async () => {
    mocks.runTypecheck.mockResolvedValue(
      abortedCoreResult('/ws/libs/x/poison.component.ts'),
    );
    mocks.evaluateResult.mockReturnValue({ success: false });

    const { default: executor } = await import('./executor');
    await executor(options, context);

    // The notice is a WARN (not the infra error), names the offending file, and
    // states the template check is incomplete -- so the suppression is never
    // silent. The verdict path is untouched (no logger.error).
    expect(mocks.loggerWarn).toHaveBeenCalledOnce();
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('/ws/libs/x/poison.component.ts'),
    );
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('NG3004'),
    );
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('SUPPRESSED'),
    );
    expect(mocks.loggerError).not.toHaveBeenCalled();
  });

  it('RES-02 reframe: the warn names a fallback when templateCheckAborted has no file', async () => {
    mocks.runTypecheck.mockResolvedValue(abortedCoreResult(undefined));
    mocks.evaluateResult.mockReturnValue({ success: false });

    const { default: executor } = await import('./executor');
    await executor(options, context);

    expect(mocks.loggerWarn).toHaveBeenCalledOnce();
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('an unknown file'),
    );
  });

  it('RES-02 reframe: does NOT warn when templateCheckAborted is unset (no false positive)', async () => {
    mocks.runTypecheck.mockResolvedValue(coreResult(0));
    mocks.evaluateResult.mockReturnValue({ success: true });

    const { default: executor } = await import('./executor');
    await executor(options, context);

    expect(mocks.loggerWarn).not.toHaveBeenCalled();
  });

  // S3 (09-RES-02-DECISION.md, advisory-not-verdict): a TCB-generation abort with
  // ZERO errors STILL yields { success: true } -- the abort is a WARN, NEVER a
  // forced success:false. The existing abortedCoreResult builds on coreResult(1)
  // (errorCount 1); this pins the DISTINCT abort-with-zero-errors case. The
  // executor delegates the verdict to evaluateResult (stubbed { success: true }
  // here, modelling errorCount 0), so the abort never overrides it.
  it('RES-02 reframe: abort + errorCount 0 stays { success: true } with the loud warn (advisory-not-verdict)', async () => {
    mocks.runTypecheck.mockResolvedValue({
      ...coreResult(0),
      templateCheckAborted: {
        code: -993004,
        fileName: '/ws/libs/x/poison.component.ts',
      },
    });
    mocks.evaluateResult.mockReturnValue({ success: true });

    const { default: executor } = await import('./executor');
    const result = await executor(options, context);

    expect(result).toEqual({ success: true });
    expect(mocks.loggerWarn).toHaveBeenCalledOnce();
    expect(mocks.loggerError).not.toHaveBeenCalled();
  });

  // WALK-01 (Phase 13, D-02 adapter render): the executor renders the core's
  // pure skippedReferences detection as a loud, path-named logger.warn advisory.
  it('WALK-01 D-02: emits one logger.warn per skippedReferences entry naming the path + reason', async () => {
    mocks.runTypecheck.mockResolvedValue(
      skippedRefsCoreResult([
        {
          referencePath: '/ws/fixtures/solution-style-oop/tsconfig.app.json',
          reason: 'out-of-project',
        },
        {
          referencePath: '/ws/fixtures/solution-style/tsconfig.missing.json',
          reason: 'not-found',
        },
      ]),
    );
    mocks.evaluateResult.mockReturnValue({ success: false });

    const { default: executor } = await import('./executor');
    await executor(options, context);

    // One warn per skipped reference (two entries -> two warns), each naming its
    // resolved path and reason. Advisory-only: no logger.error.
    expect(mocks.loggerWarn).toHaveBeenCalledTimes(2);
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining(
        '/ws/fixtures/solution-style-oop/tsconfig.app.json',
      ),
    );
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('out-of-project'),
    );
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining(
        '/ws/fixtures/solution-style/tsconfig.missing.json',
      ),
    );
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('not-found'),
    );
    expect(mocks.loggerError).not.toHaveBeenCalled();
  });

  it('WALK-01 D-02: does NOT warn for skippedReferences when the field is undefined (no false positive)', async () => {
    // Core maps the walk's empty array to undefined, so the common direct/clean-walk
    // path carries no field -- the adapter must stay silent.
    mocks.runTypecheck.mockResolvedValue(coreResult(0));
    mocks.evaluateResult.mockReturnValue({ success: true });

    const { default: executor } = await import('./executor');
    await executor(options, context);

    expect(mocks.loggerWarn).not.toHaveBeenCalled();
  });

  it('WALK-01 D-02: the skipped-reference notice does NOT change the success verdict (advisory-only)', async () => {
    // errorCount 1 in skippedRefsCoreResult, but evaluateResult is the SOLE verdict
    // authority -- stubbed { success: true } here. The advisory warn must not
    // override it (a skip NEVER flips the verdict).
    mocks.runTypecheck.mockResolvedValue(
      skippedRefsCoreResult([
        {
          referencePath: '/ws/fixtures/solution-style-selfref/tsconfig.json',
          reason: 'self-reference',
        },
      ]),
    );
    mocks.evaluateResult.mockReturnValue({ success: true });

    const { default: executor } = await import('./executor');
    const result = await executor(options, context);

    expect(result).toEqual({ success: true });
    expect(mocks.loggerWarn).toHaveBeenCalledOnce();
    expect(mocks.loggerError).not.toHaveBeenCalled();
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
    // COR-04 / D-08: lock the DISTINCT operator message so an infra failure is
    // never reported as a plain type-error verdict. Matches executor.ts:54.
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.stringContaining('infrastructure error'),
    );
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
