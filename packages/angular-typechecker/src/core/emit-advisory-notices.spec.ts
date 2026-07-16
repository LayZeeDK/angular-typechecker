import { describe, expect, it, vi } from 'vitest';

import { emitAdvisoryNotices } from './emit-advisory-notices';
import type { Logger } from './logger';
import type { CoreResult } from './run-typecheck';

// D-09: the seam is INJECTED, so there is NO vi.mock -- the logger is a plain
// object of vi.fn() spies passed straight into emitAdvisoryNotices. `satisfies
// Logger` validates the shape while KEEPING the narrow Mock type on each method
// so `.mock.invocationCallOrder` (sub-order assertions) stays accessible.
function mockLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() } satisfies Logger;
}

// Copied verbatim from executor.spec.ts (the byte-identical guard's fixture): the
// four suppressed* fields are ALWAYS present (0/[]); the four optional advisory
// fields are omitted when clean so each helper self-gates to silence.
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

describe('emitAdvisoryNotices (D-09 byte-exact anchor)', () => {
  it('warnTemplateCheckAborted: one exact logger.warn naming the file; no info/error', () => {
    const logger = mockLogger();

    emitAdvisoryNotices(
      {
        ...coreResult(1),
        templateCheckAborted: {
          code: -993004,
          fileName: '/ws/libs/x/poison.component.ts',
        },
      },
      logger,
    );

    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledWith(
      `angular-typechecker: a fatal template-compilation error (e.g. in /ws/libs/x/poison.component.ts) (NG3004 IMPORT_GENERATION_FAILURE) aborted Angular template type-check-block generation. Surviving files' Angular template/extended (NG8xxx) diagnostics may be SUPPRESSED until it is fixed -- this run's template check is INCOMPLETE, so its coverage is incomplete and the verdict is NOT clean. Fix all reported NG3004 diagnostics and re-run typecheck.`,
    );
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('warnTemplateCheckAborted: names the "an unknown file" fallback when fileName is undefined', () => {
    const logger = mockLogger();

    emitAdvisoryNotices(
      {
        ...coreResult(1),
        templateCheckAborted: { code: -993004, fileName: undefined },
      },
      logger,
    );

    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledWith(
      `angular-typechecker: a fatal template-compilation error (e.g. in an unknown file) (NG3004 IMPORT_GENERATION_FAILURE) aborted Angular template type-check-block generation. Surviving files' Angular template/extended (NG8xxx) diagnostics may be SUPPRESSED until it is fixed -- this run's template check is INCOMPLETE, so its coverage is incomplete and the verdict is NOT clean. Fix all reported NG3004 diagnostics and re-run typecheck.`,
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('warnSkippedReferences: one exact logger.warn per reference exercising all three verdict-note branches', () => {
    const logger = mockLogger();

    emitAdvisoryNotices(
      {
        ...coreResult(1),
        skippedReferences: [
          {
            referencePath: '/ws/fixtures/solution-style/tsconfig.missing.json',
            reason: 'not-found',
          },
          {
            referencePath: '/ws/fixtures/solution-style/tsconfig.inner.json',
            reason: 'zero-root-names',
          },
          {
            referencePath: '/ws/fixtures/solution-style-oop/tsconfig.app.json',
            reason: 'out-of-project',
          },
        ],
      },
      logger,
    );

    // One warn PER reference (three entries -> three warns), never a joined message.
    expect(logger.warn).toHaveBeenCalledTimes(3);
    // not-found: the verdict-FAILING (counted 90002) tail.
    expect(logger.warn).toHaveBeenCalledWith(
      `angular-typechecker: tsconfig '/ws/fixtures/solution-style/tsconfig.missing.json' was skipped or reclassified (reason: not-found). It is reported as a counted error (90002) that FAILS the type-check -- restore the referenced tsconfig or remove the stale reference.`,
    );
    // zero-root-names: the coverage-incomplete tail.
    expect(logger.warn).toHaveBeenCalledWith(
      `angular-typechecker: tsconfig '/ws/fixtures/solution-style/tsconfig.inner.json' was skipped or reclassified (reason: zero-root-names). If a sibling leaf was checked, this leaf's transitively-imported files may have been dropped by the project boundary -- contributing to a coverage-incomplete (non-clean) verdict. See the coverage-incomplete notice.`,
    );
    // out-of-project: the default advisory-only tail.
    expect(logger.warn).toHaveBeenCalledWith(
      `angular-typechecker: tsconfig '/ws/fixtures/solution-style-oop/tsconfig.app.json' was skipped or reclassified (reason: out-of-project). This notice is advisory only -- the type-check verdict is unchanged.`,
    );
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('warnSuppressed: node_modules count via logger.info AND coverage-incomplete via logger.warn, info before warn', () => {
    const logger = mockLogger();

    emitAdvisoryNotices(
      {
        ...coreResult(0),
        suppressedThirdParty: 3,
        suppressedInGraphErrorCount: 1,
        suppressedInGraphWarningCount: 2,
        suppressedInGraphFiles: ['/ws/libs/dep/src/broken.ts'],
      },
      logger,
    );

    expect(logger.info).toHaveBeenCalledOnce();
    expect(logger.info).toHaveBeenCalledWith(
      `angular-typechecker: 3 node_modules diagnostic(s) suppressed (expected; pass includeDeps to include them).`,
    );
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledWith(
      `angular-typechecker: this run's coverage is INCOMPLETE -- 1 error(s) and 2 warning(s) on first-party files were dropped by the project boundary. In-graph errors force a non-clean (coverage-incomplete) verdict; dropped in-graph warnings count toward maxWarnings just like reported warnings (and fail unconditionally under strict), so with no maxWarnings and no strict they are advisory only. A real diagnostic on a checked file may have been suppressed. Dropped file(s): /ws/libs/dep/src/broken.ts.`,
    );
    // Sub-order (Pitfall 2): info (node_modules) fires BEFORE warn (coverage-incomplete).
    expect(logger.info.mock.invocationCallOrder[0]).toBeLessThan(
      logger.warn.mock.invocationCallOrder[0],
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('warnNotTypeChecked: one exact logger.warn naming the declared file', () => {
    const logger = mockLogger();

    emitAdvisoryNotices(
      {
        ...coreResult(0),
        notTypeCheckedDeclaredFiles: ['/ws/libs/x/docs.mdx'],
      },
      logger,
    );

    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledWith(
      `angular-typechecker: 1 declared file(s) may not be fully type-checked -- .mdx is never type-checked, and JSX in a .tsx is only checked when compilerOptions.jsx is set (a .tsx with no JSX is still fully checked; JSX under an unset jsx reports TS17004). This is ADVISORY: the verdict is unchanged. File(s): /ws/libs/x/docs.mdx.`,
    );
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('warnBundlerQueryImports: one exact logger.warn naming the specifier + vite/client fix', () => {
    const logger = mockLogger();

    emitAdvisoryNotices(
      {
        ...coreResult(2),
        bundlerQueryImports: ['./x?raw'],
      },
      logger,
    );

    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledWith(
      `angular-typechecker: 1 unresolved import(s) use a bundler query suffix (e.g. ?raw/?url/?worker/?inline) -- these look like Vite/Analog imports. Add "types": ["vite/client"] to the checked tsconfig (or an ambient 'declare module' shim) to resolve them. This is ADVISORY: the TS2307 are NOT suppressed (a missing module can be a real bug). Specifier(s): ./x?raw.`,
    );
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('a clean CoreResult emits nothing on info, warn, or error', () => {
    const logger = mockLogger();

    emitAdvisoryNotices(coreResult(0), logger);

    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });
});
