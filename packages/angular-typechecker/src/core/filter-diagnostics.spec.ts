import type ts from 'typescript';

import { describe, expect, it } from 'vitest';

import { filterDiagnostics, keep } from './filter-diagnostics';

// Pure-function unit tier for the input-set-membership boundary filter (SB-02 /
// SB-04). NO @angular/compiler-cli mock: filterDiagnostics + keep are pure over
// hand-built ts.Diagnostic[] literals plus an injected realpath and a synthetic
// inputTs, mirroring the gather-diagnostics.spec.ts idiom. The `as ts.Diagnostic`
// cast keeps each literal minimal -- only `file.fileName`, `category`, and
// `relatedInformation` are read by the filter.
//
// ts.DiagnosticCategory numeric values (verified against typescript@6.0.3
// typescript.d.ts): Warning = 0, Error = 1, Suggestion = 2, Message = 3. We use
// the numeric literals directly (the module `import type`s ts, so the runtime enum
// value is not in scope) and default a diagnostic to Error so a suppressed
// first-party `.ts` lands in suppressedInGraphErrorCount.
function diag(
  fileName: string | undefined,
  options: {
    code?: number;
    category?: number;
    relatedFiles?: readonly string[];
  } = {},
): ts.Diagnostic {
  const { code = 2322, category = 1 /* Error */, relatedFiles } = options;

  return {
    category,
    code,
    file: fileName === undefined ? undefined : ({ fileName } as ts.SourceFile),
    start: 0,
    length: 1,
    messageText: 'x',
    relatedInformation:
      relatedFiles === undefined
        ? undefined
        : relatedFiles.map(
            (name) =>
              ({
                category: 1,
                code: 0,
                file: { fileName: name } as ts.SourceFile,
                start: 0,
                length: 1,
                messageText: 'related',
              }) as ts.DiagnosticRelatedInformation,
          ),
  } as ts.Diagnostic;
}

describe('filterDiagnostics', () => {
  const base = {
    basePath: '/ws/proj',
    useCaseSensitiveFileNames: true,
    realpath: (p: string) => p,
    inputTs: [] as readonly string[],
  };

  it('keeps in-graph (under base), splits out-of-graph .ts vs node_modules (D-05, SB-04)', () => {
    const result = filterDiagnostics(
      [
        diag('/ws/proj/src/a.component.ts'), // kept (under base)
        diag('/ws/sibling-lib/src/b.ts'), // suppressed in-graph (out of graph .ts)
        diag('/ws/proj/node_modules/x/y.d.ts'), // suppressed third-party (node_modules)
        diag('/ws/proj-other/src/c.ts'), // suppressed in-graph (NOT a segment prefix)
        diag(undefined), // kept (file-less config/guard, D-06)
      ],
      { ...base, includeDeps: false },
    );

    expect(result.kept).toHaveLength(2);
    expect(result.suppressedThirdParty).toBe(1);
    expect(result.suppressedInGraphErrorCount).toBe(2);
    expect(result.suppressedInGraphWarningCount).toBe(0);
    expect(result.suppressedInGraphFiles).toHaveLength(2);
    expect(result.suppressedInGraphFiles).toContain('/ws/sibling-lib/src/b.ts');
    expect(result.suppressedInGraphFiles).toContain('/ws/proj-other/src/c.ts');

    const keptFiles = result.kept.map(
      (diagnostic) => diagnostic.file?.fileName,
    );

    expect(keptFiles).toContain('/ws/proj/src/a.component.ts');
    expect(keptFiles).toContain(undefined);
  });

  // Branch (a): file-less / present-but-empty fileName -> KEEP (D-06/COR-03).
  it('keeps a file-less diagnostic (file === undefined) ALWAYS (D-06)', () => {
    const result = filterDiagnostics([diag(undefined)], {
      ...base,
      includeDeps: false,
    });

    expect(result.kept).toHaveLength(1);
    expect(result.suppressedInGraphErrorCount).toBe(0);
    expect(result.suppressedInGraphFiles).toHaveLength(0);
  });

  it('keeps a diagnostic whose file.fileName is present-but-empty (COR-03/D-06)', () => {
    const result = filterDiagnostics([diag('')], {
      ...base,
      includeDeps: false,
    });

    expect(result.kept).toHaveLength(1);
    expect(result.suppressedThirdParty).toBe(0);
    expect(result.suppressedInGraphErrorCount).toBe(0);
  });

  // Branch (c) membership: a declared rootName is KEPT even when it lies OUTSIDE
  // the narrowed base -- proving membership (not the base clause) does the work.
  it('keeps a declared rootName in inputTs even when it is not under base (D-02, branch c)', () => {
    const result = filterDiagnostics([diag('/ws/elsewhere/story.stories.ts')], {
      ...base,
      basePath: '/ws/host',
      inputTs: ['/ws/elsewhere/story.stories.ts'],
      includeDeps: false,
    });

    expect(result.kept).toHaveLength(1);
    expect(result.suppressedInGraphErrorCount).toBe(0);
  });

  // Branch else: a transitively-imported dependency .ts (not a rootName, not under
  // base, not node_modules) is SUPPRESSED (isolation).
  it('suppresses a dependency .ts that is neither a rootName nor under base (isolation, branch else)', () => {
    const result = filterDiagnostics([diag('/ws/dep/lib/internal.ts')], {
      ...base,
      basePath: '/ws/host',
      inputTs: ['/ws/host/src/main.ts'],
      includeDeps: false,
    });

    expect(result.kept).toHaveLength(0);
    expect(result.suppressedThirdParty).toBe(0);
    expect(result.suppressedInGraphErrorCount).toBe(1);
    expect(result.suppressedInGraphFiles).toEqual(['/ws/dep/lib/internal.ts']);
  });

  it('does NOT misclassify node_modules-tools as node_modules (segment test, D-06)', () => {
    const result = filterDiagnostics(
      [diag('/ws/proj/node_modules-tools/z.ts')],
      { ...base, includeDeps: false },
    );

    expect(result.kept).toHaveLength(1);
    expect(result.suppressedThirdParty).toBe(0);
    expect(result.suppressedInGraphErrorCount).toBe(0);
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
      inputTs: [],
      includeDeps: false,
    });

    expect(result.kept).toHaveLength(1);
    expect(result.suppressedInGraphErrorCount).toBe(0);
  });

  // Branch (a'): a throwing realpath is caught inside createCanonicalizer, signals
  // undefined, and -- unmatched by raw membership -- the diagnostic is KEPT.
  it("branch (a'): a throwing realpath is caught; the in-project diagnostic is still kept (RES-03)", () => {
    const result = filterDiagnostics([diag('/ws/proj/src/a.component.ts')], {
      basePath: '/ws/proj',
      useCaseSensitiveFileNames: true,
      realpath: () => {
        throw new Error('EACCES');
      },
      inputTs: [],
      includeDeps: false,
    });

    expect(result.kept).toHaveLength(1);
    expect(result.suppressedInGraphErrorCount).toBe(0);
  });

  it("branch (a'): a throwing realpath keeps an out-of-project diagnostic too (cannot prove out-of-graph, fail-safe)", () => {
    const result = filterDiagnostics([diag('/ws/sibling-lib/src/b.ts')], {
      basePath: '/ws/proj',
      useCaseSensitiveFileNames: true,
      realpath: () => {
        throw new Error('EACCES');
      },
      inputTs: [],
      includeDeps: false,
    });

    expect(result.kept).toHaveLength(1);
    expect(result.suppressedInGraphErrorCount).toBe(0);
  });

  // DUAL-IDENTITY recovery (D-02, THE load-bearing case): a DECLARED rootName whose
  // realpath THROWS is dropped from the full-form input set, but its raw form is
  // still present -- so the diagnostic is matched via raw membership and KEPT as a
  // real error, never counted suppressed-in-graph.
  it('dual-identity: a declared rootName whose realpath throws is still KEPT via raw membership (D-02)', () => {
    const result = filterDiagnostics([diag('/ws/proj/src/story.stories.ts')], {
      basePath: '/ws/proj',
      useCaseSensitiveFileNames: true,
      realpath: () => {
        throw new Error('EACCES');
      },
      inputTs: ['/ws/proj/src/story.stories.ts'],
      includeDeps: false,
    });

    expect(result.kept).toHaveLength(1);
    expect(result.suppressedThirdParty).toBe(0);
    expect(result.suppressedInGraphErrorCount).toBe(0);
    expect(result.suppressedInGraphWarningCount).toBe(0);
    expect(result.suppressedInGraphFiles).toHaveLength(0);
  });

  // T8 canonicalization symmetry: a declared rootName (real path) and a diagnostic
  // file reached via a JUNCTION share ONE canonicalizer, so the junction path
  // resolves (realpath) to the declared root's full form and is matched -- even
  // though the base does NOT contain the file (membership, not the base clause).
  it('T8 symmetry: a diagnostic reached via a junction matches a declared rootName via the shared full canonicalizer', () => {
    const realpath = (p: string): string => {
      if (p === '/ws/junction/a.ts') {
        return '/ws/proj/src/a.ts';
      }

      return p;
    };

    const result = filterDiagnostics([diag('/ws/junction/a.ts')], {
      basePath: '/ws/host',
      useCaseSensitiveFileNames: true,
      realpath,
      inputTs: ['/ws/proj/src/a.ts'],
      includeDeps: false,
    });

    expect(result.kept).toHaveLength(1);
    expect(result.suppressedInGraphErrorCount).toBe(0);
  });

  // Branch (d)/4a: an external-template .html diagnostic outside base, resolved to
  // its owning component .ts via relatedInformation.
  it('branch 4a: a .html diagnostic whose owning .ts is in inputTs is KEPT (D-04)', () => {
    const result = filterDiagnostics(
      [
        diag('/ws/agg/comp.html', {
          relatedFiles: ['/ws/agg/comp.ts'],
        }),
      ],
      {
        ...base,
        basePath: '/ws/host',
        inputTs: ['/ws/agg/comp.ts'],
        includeDeps: false,
      },
    );

    expect(result.kept).toHaveLength(1);
    expect(result.suppressedInGraphErrorCount).toBe(0);
  });

  it('branch 4a: a .html diagnostic whose owning .ts is NOT in inputTs is SUPPRESSED (D-04)', () => {
    const result = filterDiagnostics(
      [
        diag('/ws/dep/comp.html', {
          relatedFiles: ['/ws/dep/comp.ts'],
        }),
      ],
      {
        ...base,
        basePath: '/ws/host',
        inputTs: ['/ws/host/src/main.ts'],
        includeDeps: false,
      },
    );

    expect(result.kept).toHaveLength(0);
    expect(result.suppressedThirdParty).toBe(0);
    expect(result.suppressedInGraphErrorCount).toBe(1);
    expect(result.suppressedInGraphFiles).toEqual(['/ws/dep/comp.html']);
  });

  it('branch 4a: an unmappable .html (no .ts relatedInformation) DEFAULT-KEEPs (D-04, over-report safe)', () => {
    const result = filterDiagnostics(
      [
        diag('/ws/dep/orphan.html'), // no relatedInformation at all
        diag('/ws/dep/only-html.html', {
          relatedFiles: ['/ws/dep/other.html'], // related but no .ts entry
        }),
      ],
      {
        ...base,
        basePath: '/ws/host',
        inputTs: [],
        includeDeps: false,
      },
    );

    expect(result.kept).toHaveLength(2);
    expect(result.suppressedInGraphErrorCount).toBe(0);
    expect(result.suppressedInGraphFiles).toHaveLength(0);
  });

  it('case-insensitive FS folds case so /WS/PROJ/src/A.ts is in-project under /ws/proj (OUT-02)', () => {
    const result = filterDiagnostics([diag('/WS/PROJ/src/A.ts')], {
      basePath: '/ws/proj',
      useCaseSensitiveFileNames: false,
      realpath: (p: string) => p,
      inputTs: [],
      includeDeps: false,
    });

    expect(result.kept).toHaveLength(1);
    expect(result.suppressedInGraphErrorCount).toBe(0);
  });

  it('case-insensitive FS folds an OUT-of-project mixed-case .ts so it is SUPPRESSED in-graph (D-10, OUT-02)', () => {
    const result = filterDiagnostics([diag('/WS/SIBLING/src/x.ts')], {
      basePath: '/ws/proj',
      useCaseSensitiveFileNames: false,
      realpath: (p: string) => p,
      inputTs: [],
      includeDeps: false,
    });

    expect(result.kept).toHaveLength(0);
    expect(result.suppressedInGraphErrorCount).toBe(1);
    expect(result.suppressedInGraphFiles).toEqual(['/ws/sibling/src/x.ts']);
  });

  it('case-insensitive FS folds a mixed-case NODE_MODULES segment so it is SUPPRESSED third-party (D-10, OUT-02)', () => {
    const result = filterDiagnostics([diag('/WS/PROJ/NODE_MODULES/X/Y.d.ts')], {
      basePath: '/ws/proj',
      useCaseSensitiveFileNames: false,
      realpath: (p: string) => p,
      inputTs: [],
      includeDeps: false,
    });

    expect(result.kept).toHaveLength(0);
    expect(result.suppressedThirdParty).toBe(1);
    expect(result.suppressedInGraphErrorCount).toBe(0);
  });

  it('the SAME mixed-case in-project input is NOT folded under useCaseSensitiveFileNames:true -> SUPPRESSED (D-10, OUT-02)', () => {
    const result = filterDiagnostics([diag('/WS/PROJ/src/A.ts')], {
      basePath: '/ws/proj',
      useCaseSensitiveFileNames: true,
      realpath: (p: string) => p,
      inputTs: [],
      includeDeps: false,
    });

    expect(result.kept).toHaveLength(0);
    expect(result.suppressedInGraphErrorCount).toBe(1);
  });

  // RD-04 store-dir generality: the node_modules-SEGMENT exclusion (third-party)
  // fires for EVERY package manager's on-disk store layout, not just pnpm's `.pnpm`.
  it('suppresses third-party: an in-project path whose realpath crosses node_modules/.pnpm (RD-04)', () => {
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
      inputTs: [],
      includeDeps: false,
    });

    expect(result.kept).toHaveLength(0);
    expect(result.suppressedThirdParty).toBe(1);
    expect(result.suppressedInGraphErrorCount).toBe(0);
  });

  it('suppresses third-party: an in-project path whose realpath crosses node_modules/.bun (RD-04)', () => {
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
      inputTs: [],
      includeDeps: false,
    });

    expect(result.kept).toHaveLength(0);
    expect(result.suppressedThirdParty).toBe(1);
  });

  it('suppresses third-party: an in-project path whose realpath crosses plain node_modules/<pkg> (RD-04)', () => {
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
      inputTs: [],
      includeDeps: false,
    });

    expect(result.kept).toHaveLength(0);
    expect(result.suppressedThirdParty).toBe(1);
  });

  it('keeps a .ngtypecheck.ts shadow file under basePath via the base clause (D-04a, Pitfall 1)', () => {
    const result = filterDiagnostics(
      [diag('/ws/proj/src/a.component.ngtypecheck.ts')],
      { ...base, includeDeps: false },
    );

    expect(result.kept).toHaveLength(1);
    expect(result.suppressedInGraphErrorCount).toBe(0);
  });

  // Per-category split (D-05): only Error/Warning count; Suggestion/Message never do.
  it('per-category split: a suppressed Warning increments suppressedInGraphWarningCount only', () => {
    const result = filterDiagnostics(
      [diag('/ws/sibling/w.ts', { category: 0 /* Warning */ })],
      { ...base, includeDeps: false },
    );

    expect(result.kept).toHaveLength(0);
    expect(result.suppressedInGraphErrorCount).toBe(0);
    expect(result.suppressedInGraphWarningCount).toBe(1);
    expect(result.suppressedInGraphFiles).toEqual(['/ws/sibling/w.ts']);
  });

  it('per-category split: a suppressed Suggestion increments NEITHER count (still listed in files)', () => {
    const result = filterDiagnostics(
      [diag('/ws/sibling/s.ts', { category: 2 /* Suggestion */ })],
      { ...base, includeDeps: false },
    );

    expect(result.kept).toHaveLength(0);
    expect(result.suppressedInGraphErrorCount).toBe(0);
    expect(result.suppressedInGraphWarningCount).toBe(0);
    expect(result.suppressedInGraphFiles).toEqual(['/ws/sibling/s.ts']);
  });

  it('suppressedInGraphFiles is DISTINCT across multiple diagnostics on the same file', () => {
    const result = filterDiagnostics(
      [
        diag('/ws/sibling/dup.ts', { code: 2322 }),
        diag('/ws/sibling/dup.ts', { code: 2345 }),
      ],
      { ...base, includeDeps: false },
    );

    expect(result.suppressedInGraphErrorCount).toBe(2);
    expect(result.suppressedInGraphFiles).toEqual(['/ws/sibling/dup.ts']);
  });

  it('includeDeps: true folds everything back, all suppressed counters 0 (D-07, EXE-04)', () => {
    const result = filterDiagnostics(
      [
        diag('/elsewhere/x.ts'),
        diag('/ws/proj/node_modules/y/z.d.ts'),
        diag('/ws/dep/comp.html', { relatedFiles: ['/ws/dep/comp.ts'] }),
        diag(undefined),
      ],
      { ...base, includeDeps: true },
    );

    expect(result.kept).toHaveLength(4);
    expect(result.suppressedThirdParty).toBe(0);
    expect(result.suppressedInGraphErrorCount).toBe(0);
    expect(result.suppressedInGraphWarningCount).toBe(0);
    expect(result.suppressedInGraphFiles).toHaveLength(0);
  });

  // RES-03 / isUnderDir undefined-dir branch: a realpath that throws for the BASE
  // ('/ws/proj') ONLY -- files resolve normally -- canonicalizes the file fine but
  // leaves `canonicalBase` undefined, so isUnderDir(file, undefined) returns true
  // (over-keep-safe) and the in-project file is KEPT.
  it('RES-03: a realpath that throws for the base only still KEEPS in-project files (isUnderDir undefined-dir branch)', () => {
    const realpath = (p: string): string => {
      if (p === '/ws/proj') {
        throw new Error('EACCES'); // base only
      }

      return p; // files resolve (identity)
    };

    const result = filterDiagnostics([diag('/ws/proj/src/a.ts')], {
      basePath: '/ws/proj',
      useCaseSensitiveFileNames: true,
      realpath,
      inputTs: [],
      includeDeps: false,
    });

    expect(result.kept).toHaveLength(1);
    expect(result.suppressedInGraphErrorCount).toBe(0);
  });
});

// The exported pure boolean, exercised directly (no filterDiagnostics wrapper) so
// each keep() branch is asserted against synthetic literals + a pre-built inputSet.
describe('keep', () => {
  const rawId = (p: string): string => p.replace(/\\/g, '/');
  const fullId = (p: string): string | undefined => p.replace(/\\/g, '/');

  function keepOptions(
    overrides: Partial<{
      canonicalizeRaw: (p: string) => string;
      canonicalizeFull: (p: string) => string | undefined;
      canonicalBase: string | undefined;
      includeDeps: boolean;
    }> = {},
  ): {
    canonicalizeRaw: (p: string) => string;
    canonicalizeFull: (p: string) => string | undefined;
    canonicalBase: string | undefined;
    includeDeps: boolean;
  } {
    return {
      canonicalizeRaw: rawId,
      canonicalizeFull: fullId,
      canonicalBase: '/ws/proj',
      includeDeps: false,
      ...overrides,
    };
  }

  it('includeDeps: true -> KEEP everything (fold-back)', () => {
    expect(
      keep(diag('/ws/dep/x.ts'), new Set(), keepOptions({ includeDeps: true })),
    ).toEqual({ kind: 'keep' });
  });

  it('branch (a): file-less -> KEEP', () => {
    expect(keep(diag(undefined), new Set(), keepOptions())).toEqual({
      kind: 'keep',
    });
  });

  it('branch (a): present-but-empty fileName -> KEEP', () => {
    expect(keep(diag(''), new Set(), keepOptions())).toEqual({ kind: 'keep' });
  });

  it('membership (raw): a declared rootName is KEPT', () => {
    const set = new Set(['/ws/x/story.stories.ts']);

    expect(
      keep(
        diag('/ws/x/story.stories.ts'),
        set,
        keepOptions({ canonicalBase: '/ws/other' }),
      ),
    ).toEqual({ kind: 'keep' });
  });

  it("branch (a'): canonicalizeFull returns undefined (realpath threw) -> KEEP", () => {
    expect(
      keep(
        diag('/ws/dep/x.ts'),
        new Set(),
        keepOptions({ canonicalizeFull: () => undefined }),
      ),
    ).toEqual({ kind: 'keep' });
  });

  it('branch (b): node_modules segment -> SUPPRESS third-party', () => {
    expect(
      keep(diag('/ws/proj/node_modules/pkg/i.d.ts'), new Set(), keepOptions()),
    ).toEqual({ kind: 'third-party' });
  });

  it('branch (c): under base -> KEEP', () => {
    expect(keep(diag('/ws/proj/src/a.ts'), new Set(), keepOptions())).toEqual({
      kind: 'keep',
    });
  });

  it('branch else: dependency .ts (not member, not under base) -> SUPPRESS in-graph, carrying its canonical file', () => {
    expect(
      keep(
        diag('/ws/dep/lib.ts'),
        new Set(),
        keepOptions({ canonicalBase: '/ws/host' }),
      ),
    ).toEqual({ kind: 'in-graph', canonicalFile: '/ws/dep/lib.ts' });
  });

  // Isolation parity for the other compilable source extensions: a `.mts`/`.cts`/
  // `.js` dependency (not member, not under base) must SUPPRESS in-graph exactly
  // like `.ts`, NOT fall through branch 4a to a false default-KEEP that would
  // surface the dependency's error as a `type-error` blaming the consumer.
  it('branch else: dependency .mts/.cts/.mjs/.cjs/.js/.jsx source -> SUPPRESS in-graph', () => {
    for (const dependency of [
      '/ws/dep/lib.mts',
      '/ws/dep/lib.cts',
      '/ws/dep/lib.mjs',
      '/ws/dep/lib.cjs',
      '/ws/dep/lib.js',
      '/ws/dep/lib.jsx',
    ]) {
      expect(
        keep(
          diag(dependency),
          new Set(),
          keepOptions({ canonicalBase: '/ws/host' }),
        ),
      ).toEqual({ kind: 'in-graph', canonicalFile: dependency });
    }
  });

  it('branch 4a: .html owner .ts in set -> KEEP', () => {
    const set = new Set(['/ws/agg/c.ts']);

    expect(
      keep(
        diag('/ws/agg/c.html', { relatedFiles: ['/ws/agg/c.ts'] }),
        set,
        keepOptions({ canonicalBase: '/ws/host' }),
      ),
    ).toEqual({ kind: 'keep' });
  });

  it('branch 4a: .html owner .ts NOT in set -> SUPPRESS in-graph, carrying the .html canonical file', () => {
    expect(
      keep(
        diag('/ws/dep/c.html', { relatedFiles: ['/ws/dep/c.ts'] }),
        new Set(),
        keepOptions({ canonicalBase: '/ws/host' }),
      ),
    ).toEqual({ kind: 'in-graph', canonicalFile: '/ws/dep/c.html' });
  });

  it('branch 4a: unmappable .html (no .ts relatedInformation) -> default-KEEP', () => {
    expect(
      keep(
        diag('/ws/dep/orphan.html'),
        new Set(),
        keepOptions({ canonicalBase: '/ws/host' }),
      ),
    ).toEqual({ kind: 'keep' });
  });
});
