import type ts from 'typescript';

import { describe, expect, it } from 'vitest';

import { filterDiagnostics } from './filter-diagnostics';

// Pure-function unit tier for the project-boundary filter (TEST-01 / D-13). NO
// @angular/compiler-cli mock: filterDiagnostics is a pure function over
// hand-built ts.Diagnostic[] literals plus an injected realpath, mirroring the
// gather-diagnostics.spec.ts idiom. Covers EXE-04 (boundary filter +
// includeDeps fold-back) and OUT-02 (realpath-first + case-fold + path-segment
// containment). The `as ts.Diagnostic` cast keeps the literal minimal -- only
// `file.fileName` is read by the filter.
function diag(fileName: string | undefined, code = 2322): ts.Diagnostic {
  return {
    category: 0 /* ts.DiagnosticCategory.Error -- avoids importing the enum value */,
    code,
    file: fileName === undefined ? undefined : ({ fileName } as ts.SourceFile),
    start: 0,
    length: 1,
    messageText: 'x',
  } as ts.Diagnostic;
}

describe('filterDiagnostics', () => {
  const base = {
    basePath: '/ws/proj',
    useCaseSensitiveFileNames: true,
    realpath: (p: string) => p,
  };

  it('keeps in-project, suppresses out-of-project + node_modules (D-05/D-06, EXE-04)', () => {
    const result = filterDiagnostics(
      [
        diag('/ws/proj/src/a.component.ts'), // kept (in-project)
        diag('/ws/sibling-lib/src/b.ts'), // suppressed (out of project)
        diag('/ws/proj/node_modules/x/y.d.ts'), // suppressed (node_modules segment)
        diag('/ws/proj-other/src/c.ts'), // suppressed (NOT a segment-bounded prefix)
        diag(undefined), // kept (file-less config/guard, D-03)
      ],
      { ...base, includeDeps: false },
    );

    expect(result.kept).toHaveLength(2);
    expect(result.suppressedCount).toBe(3);

    const keptFiles = result.kept.map((diagnostic) => diagnostic.file?.fileName);

    expect(keptFiles).toContain('/ws/proj/src/a.component.ts');
    expect(keptFiles).toContain(undefined);
  });

  it('keeps a file-less diagnostic (file === undefined) ALWAYS (D-03)', () => {
    const result = filterDiagnostics([diag(undefined)], {
      ...base,
      includeDeps: false,
    });

    expect(result.kept).toHaveLength(1);
    expect(result.suppressedCount).toBe(0);
  });

  // COR-03 / D-06: a present-but-empty fileName is a synthesized-diagnostic edge
  // that canonicalizes to '' (isUnderDir('', base) === false), so without the
  // widened file-less guard it is SUPPRESSED -- a real error dropped by a path
  // edge (a false PASS). It must be treated as file-less and ALWAYS kept.
  // Failing-then-passing: pre-fix this asserts kept.length === 0; post-fix 1.
  it('keeps a diagnostic whose file.fileName is present-but-empty (COR-03/D-06)', () => {
    const result = filterDiagnostics([diag('')], {
      ...base,
      includeDeps: false,
    });

    expect(result.kept).toHaveLength(1);
    expect(result.suppressedCount).toBe(0);
  });

  it('does NOT misclassify node_modules-tools as node_modules (segment test, D-06)', () => {
    const result = filterDiagnostics(
      [diag('/ws/proj/node_modules-tools/z.ts')],
      { ...base, includeDeps: false },
    );

    expect(result.kept).toHaveLength(1);
    expect(result.suppressedCount).toBe(0);
  });

  it('applies realpath BEFORE case-fold so a symlinked path under basePath is kept (OUT-02)', () => {
    const realpath = (p: string): string => {
      if (p === '/ws/links/a.component.ts') {
        return '/ws/proj/src/a.component.ts';
      }

      return p;
    };

    const result = filterDiagnostics([diag('/ws/links/a.component.ts')], {
      basePath: '/ws/proj',
      useCaseSensitiveFileNames: true,
      realpath,
      includeDeps: false,
    });

    expect(result.kept).toHaveLength(1);
    expect(result.suppressedCount).toBe(0);
  });

  // RES-03 / D-08: a throwing options.realpath() (EACCES / permission-denied
  // junction / broken symlink) must be CAUGHT inside createCanonicalizer (the
  // throw must NOT escape filterDiagnostics and abort the whole type-check pass)
  // and signal `undefined`, so the diagnostic is KEPT (fail-safe -- a throw cannot
  // prove the file is out-of-project). This in-project input is kept like every
  // keep-on-throw case; the out-of-project companion below proves the bias holds
  // regardless of the raw path's classification. Mirrors the injected-realpath
  // idiom above, with a stub that throws.
  it('RES-03: a throwing realpath is caught; the in-project diagnostic is still kept', () => {
    const result = filterDiagnostics([diag('/ws/proj/src/a.component.ts')], {
      basePath: '/ws/proj',
      useCaseSensitiveFileNames: true,
      realpath: () => {
        throw new Error('EACCES');
      },
      includeDeps: false,
    });

    expect(result.kept).toHaveLength(1);
    expect(result.suppressedCount).toBe(0);
  });

  // T1 / RES-03: a throwing realpath cannot PROVE the file is out-of-project, so
  // the canonicalizer signals `undefined` and the diagnostic is KEPT (fail-safe
  // bias for a correctness tool). Accepts a minor over-keep -- a genuinely
  // out-of-project file whose realpath throws is now reported -- which is the
  // correct direction: never silently drop a diagnostic on an unprovable boundary.
  // This is a failing-then-passing change: pre-fix this asserted kept 0 /
  // suppressed 1 (the buggy suppress-on-throw behavior).
  it('RES-03: a throwing realpath is caught and the diagnostic is KEPT (cannot prove out-of-project, fail-safe)', () => {
    const result = filterDiagnostics([diag('/ws/sibling-lib/src/b.ts')], {
      basePath: '/ws/proj',
      useCaseSensitiveFileNames: true,
      realpath: () => {
        throw new Error('EACCES');
      },
      includeDeps: false,
    });

    expect(result.kept).toHaveLength(1);
    expect(result.suppressedCount).toBe(0);
  });

  it('case-insensitive FS folds case so /WS/PROJ/src/A.ts is in-project under /ws/proj (OUT-02)', () => {
    const result = filterDiagnostics([diag('/WS/PROJ/src/A.ts')], {
      basePath: '/ws/proj',
      useCaseSensitiveFileNames: false,
      realpath: (p: string) => p,
      includeDeps: false,
    });

    expect(result.kept).toHaveLength(1);
    expect(result.suppressedCount).toBe(0);
  });

  // D-10 mixed-case parity set: the seed above proves the IN-project fold under
  // useCaseSensitiveFileNames:false; these siblings prove the SAME fold for an
  // out-of-project and a node_modules-SEGMENT path, and that the fold is GATED on
  // the flag (the identical mixed-case input is NOT folded under :true). On a
  // case-insensitive CI leg (macOS/Windows, and this Windows dev box) the :false
  // branch is the LIVE host behavior; on Linux the :true branch is.
  it('case-insensitive FS folds an OUT-of-project mixed-case path so it is SUPPRESSED (D-10, OUT-02)', () => {
    const result = filterDiagnostics([diag('/WS/SIBLING/src/x.ts')], {
      basePath: '/ws/proj',
      useCaseSensitiveFileNames: false,
      realpath: (p: string) => p,
      includeDeps: false,
    });

    expect(result.kept).toHaveLength(0);
    expect(result.suppressedCount).toBe(1);
  });

  it('case-insensitive FS folds a mixed-case NODE_MODULES segment so it is SUPPRESSED (D-10, OUT-02)', () => {
    const result = filterDiagnostics([diag('/WS/PROJ/NODE_MODULES/X/Y.d.ts')], {
      basePath: '/ws/proj',
      useCaseSensitiveFileNames: false,
      realpath: (p: string) => p,
      includeDeps: false,
    });

    expect(result.kept).toHaveLength(0);
    expect(result.suppressedCount).toBe(1);
  });

  it('the SAME mixed-case in-project input is NOT folded under useCaseSensitiveFileNames:true -> SUPPRESSED (D-10, OUT-02)', () => {
    const result = filterDiagnostics([diag('/WS/PROJ/src/A.ts')], {
      basePath: '/ws/proj',
      useCaseSensitiveFileNames: true,
      realpath: (p: string) => p,
      includeDeps: false,
    });

    expect(result.kept).toHaveLength(0);
    expect(result.suppressedCount).toBe(1);
  });

  // RD-04 store-dir generality: the node_modules-SEGMENT exclusion must fire for
  // EVERY package manager's on-disk store layout, not just pnpm's `.pnpm`. These
  // map a friendly in-project input path through the injected realpath to a
  // store realpath that crosses a `node_modules` SEGMENT (exactly as production's
  // realpath-FIRST-then-segment canonicalizer does), proving the match is the
  // single `node_modules` segment test -- never hardcoded to `.pnpm`. Synthetic
  // realpaths only; NO install.
  it('suppresses an in-project path whose realpath crosses a node_modules/.pnpm store segment (RD-04, OUT-02)', () => {
    const realpath = (p: string): string => {
      if (p === '/ws/proj/src/dep.ts') {
        return '/ws/proj/node_modules/.pnpm/@scope+pkg@1.0.0/node_modules/@scope/pkg/index.d.ts';
      }

      return p;
    };

    const result = filterDiagnostics([diag('/ws/proj/src/dep.ts')], {
      basePath: '/ws/proj',
      useCaseSensitiveFileNames: true,
      realpath,
      includeDeps: false,
    });

    expect(result.kept).toHaveLength(0);
    expect(result.suppressedCount).toBe(1);
  });

  it('suppresses an in-project path whose realpath crosses a node_modules/.bun store segment (RD-04, OUT-02)', () => {
    const realpath = (p: string): string => {
      if (p === '/ws/proj/src/dep.ts') {
        return '/ws/proj/node_modules/.bun/pkg@1.0.0/node_modules/pkg/index.d.ts';
      }

      return p;
    };

    const result = filterDiagnostics([diag('/ws/proj/src/dep.ts')], {
      basePath: '/ws/proj',
      useCaseSensitiveFileNames: true,
      realpath,
      includeDeps: false,
    });

    expect(result.kept).toHaveLength(0);
    expect(result.suppressedCount).toBe(1);
  });

  it('suppresses an in-project path whose realpath crosses a plain node_modules/<pkg> segment (RD-04, OUT-02)', () => {
    const realpath = (p: string): string => {
      if (p === '/ws/proj/src/dep.ts') {
        return '/ws/proj/node_modules/pkg/index.d.ts';
      }

      return p;
    };

    const result = filterDiagnostics([diag('/ws/proj/src/dep.ts')], {
      basePath: '/ws/proj',
      useCaseSensitiveFileNames: true,
      realpath,
      includeDeps: false,
    });

    expect(result.kept).toHaveLength(0);
    expect(result.suppressedCount).toBe(1);
  });

  it('keeps a .ngtypecheck.ts shadow file under basePath (Pitfall 1)', () => {
    const result = filterDiagnostics(
      [diag('/ws/proj/src/a.component.ngtypecheck.ts')],
      { ...base, includeDeps: false },
    );

    expect(result.kept).toHaveLength(1);
    expect(result.suppressedCount).toBe(0);
  });

  it('includeDeps: true folds everything back, suppressedCount 0 (D-07, EXE-04)', () => {
    const result = filterDiagnostics(
      [
        diag('/elsewhere/x.ts'),
        diag('/ws/proj/node_modules/y/z.d.ts'),
        diag(undefined),
      ],
      { ...base, includeDeps: true },
    );

    expect(result.kept).toHaveLength(3);
    expect(result.suppressedCount).toBe(0);
  });
});
