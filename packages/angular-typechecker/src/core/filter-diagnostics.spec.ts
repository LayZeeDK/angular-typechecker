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
