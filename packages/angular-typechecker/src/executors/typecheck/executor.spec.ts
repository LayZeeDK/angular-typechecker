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

// SB-04 (17-05 adapter render): a CoreResult carrying the split suppressed counts
// the adapter must render loudly -- INFO for expected node_modules third-party
// suppressions, WARN (naming the dropped files from suppressedInGraphFiles, NEVER
// their error text) for a first-party in-graph drop (coverage-incomplete).
function suppressedCoreResult(
  overrides: Partial<
    Pick<
      CoreResult,
      | 'suppressedThirdParty'
      | 'suppressedInGraphErrorCount'
      | 'suppressedInGraphWarningCount'
      | 'suppressedInGraphFiles'
    >
  >,
): CoreResult {
  return {
    ...coreResult(0),
    ...overrides,
  };
}

// D-01 (Phase 18, T11 adapter render): a CoreResult carrying the NON-EMPTY
// notTypeCheckedDeclaredFiles the adapter must turn into ONE loud logger.warn with
// the "not type-checked" advisory, naming the consumer's OWN declared file(s). Core
// sets the field only when non-empty (mapping [] -> undefined), so the
// optional-chained length check alone gates the notice. errorCount 0 so the verdict
// stays green (the field is ADVISORY, never verdict-affecting).
function notTypeCheckedCoreResult(
  notTypeCheckedDeclaredFiles: readonly string[],
): CoreResult {
  return {
    ...coreResult(0),
    notTypeCheckedDeclaredFiles,
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

  // SB-04 (17-05): the adapter renders the two split suppressed counts LOUDLY from
  // the PURE structured CoreResult fields -- INFO for expected node_modules
  // suppressions, WARN (naming the dropped files, never their error text) for a
  // first-party in-graph drop -- and stays silent on a clean result.
  it('SB-04: emits a logger.info for expected node_modules third-party suppressions', async () => {
    mocks.runTypecheck.mockResolvedValue(
      suppressedCoreResult({ suppressedThirdParty: 3 }),
    );
    mocks.evaluateResult.mockReturnValue({ success: true });

    const { default: executor } = await import('./executor');
    await executor(options, context);

    expect(mocks.loggerInfo).toHaveBeenCalledOnce();
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      expect.stringContaining('node_modules'),
    );
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      expect.stringContaining('includeDeps'),
    );
    // Expected suppressions are advisory INFO, NEVER the coverage-incomplete WARN.
    expect(mocks.loggerWarn).not.toHaveBeenCalled();
  });

  it('SB-04: emits a coverage-incomplete logger.warn naming the dropped file for an in-graph suppression', async () => {
    mocks.runTypecheck.mockResolvedValue(
      suppressedCoreResult({
        suppressedInGraphErrorCount: 1,
        suppressedInGraphFiles: ['/ws/libs/dep/src/broken.ts'],
      }),
    );
    mocks.evaluateResult.mockReturnValue({ success: false });

    const { default: executor } = await import('./executor');
    await executor(options, context);

    expect(mocks.loggerWarn).toHaveBeenCalledOnce();
    // Names the dropped FILE and states the coverage is INCOMPLETE...
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('/ws/libs/dep/src/broken.ts'),
    );
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('INCOMPLETE'),
    );
    // ...but NEVER leaks the dependency's error MESSAGE text (T-17-13 content
    // isolation): the adapter renders from suppressedInGraphFiles (paths only), so
    // a typical diagnostic message fragment can never appear in the notice.
    expect(mocks.loggerWarn).not.toHaveBeenCalledWith(
      expect.stringContaining('is not assignable'),
    );
    expect(mocks.loggerError).not.toHaveBeenCalled();
  });

  it('SB-04: also fires the coverage-incomplete warn when only in-graph WARNINGS were dropped', async () => {
    mocks.runTypecheck.mockResolvedValue(
      suppressedCoreResult({
        suppressedInGraphWarningCount: 2,
        suppressedInGraphFiles: ['/ws/libs/dep/src/warn-only.ts'],
      }),
    );
    mocks.evaluateResult.mockReturnValue({ success: false });

    const { default: executor } = await import('./executor');
    await executor(options, context);

    expect(mocks.loggerWarn).toHaveBeenCalledOnce();
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('/ws/libs/dep/src/warn-only.ts'),
    );
    // WR-03: the notice must NOT over-claim a non-clean verdict. It prints from the
    // suppressed counts BEFORE evaluateResult decides, so it cannot assert the
    // verdict -- when only in-graph WARNINGS drop and maxWarnings is unset the run
    // stays clean/exit 0.
    expect(mocks.loggerWarn).not.toHaveBeenCalledWith(
      expect.stringContaining('NOT clean'),
    );
  });

  it('SB-04: a clean result (all suppressed fields 0) emits NEITHER the info nor the coverage-incomplete warn', async () => {
    mocks.runTypecheck.mockResolvedValue(coreResult(0));
    mocks.evaluateResult.mockReturnValue({ success: true });

    const { default: executor } = await import('./executor');
    await executor(options, context);

    expect(mocks.loggerInfo).not.toHaveBeenCalled();
    expect(mocks.loggerWarn).not.toHaveBeenCalled();
  });

  it('SB-04: the zero-root-names skippedReferences notice no longer claims the verdict is unchanged', async () => {
    mocks.runTypecheck.mockResolvedValue(
      skippedRefsCoreResult([
        {
          referencePath: '/ws/fixtures/solution-style/tsconfig.inner.json',
          reason: 'zero-root-names',
        },
      ]),
    );
    mocks.evaluateResult.mockReturnValue({ success: true });

    const { default: executor } = await import('./executor');
    await executor(options, context);

    expect(mocks.loggerWarn).toHaveBeenCalledOnce();
    // The zero-root-names reason now warns about coverage-incompleteness instead of
    // the old "verdict is unchanged" advisory wording.
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('coverage-incomplete'),
    );
    expect(mocks.loggerWarn).not.toHaveBeenCalledWith(
      expect.stringContaining('verdict is unchanged'),
    );
  });

  // D-01 (Phase 18, T11): the adapter renders the core's pure
  // notTypeCheckedDeclaredFiles as ONE loud "not type-checked" advisory naming the
  // declared file -- the render gate the structural git grep cannot prove fires.
  it('D-01 T11: emits a loud logger.warn with the softened "may not be fully type-checked" advisory naming the file when notTypeCheckedDeclaredFiles is non-empty (WR-01)', async () => {
    mocks.runTypecheck.mockResolvedValue(
      notTypeCheckedCoreResult(['/ws/libs/x/docs.mdx']),
    );
    mocks.evaluateResult.mockReturnValue({ success: true });

    const { default: executor } = await import('./executor');
    const result = await executor(options, context);

    // ADVISORY only: the verdict stays green, and the notice names the consumer's
    // OWN declared file. WR-01: the wording is softened to "may not be fully
    // type-checked" and must distinguish a JSX-free .tsx (still fully checked) from
    // a file that is never checked -- it must NOT claim a fully-checked file is
    // "not type-checked".
    expect(result).toEqual({ success: true });
    expect(mocks.loggerWarn).toHaveBeenCalledOnce();
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('may not be fully type-checked'),
    );
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('with no JSX is still fully checked'),
    );
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('/ws/libs/x/docs.mdx'),
    );
    expect(mocks.loggerError).not.toHaveBeenCalled();
  });

  it('D-01 T11: does NOT warn when notTypeCheckedDeclaredFiles is undefined (no false positive)', async () => {
    mocks.runTypecheck.mockResolvedValue(coreResult(0));
    mocks.evaluateResult.mockReturnValue({ success: true });

    const { default: executor } = await import('./executor');
    await executor(options, context);

    expect(mocks.loggerWarn).not.toHaveBeenCalled();
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
