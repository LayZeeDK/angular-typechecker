import type ts from 'typescript';

import { describe, expect, it } from 'vitest';

import { filterDiagnostics } from './filter-diagnostics';

// D-09a(ii) MANDATORY dual-identity tripwire (Phase 17 board). It GUARDS the
// UNDOCUMENTED invariant the input-set boundary rests on: a DECLARED rootName's
// own failing diagnostic is KEPT (never counted suppressed-in-graph) across a
// case-INSENSITIVE FS, a case-SENSITIVE FS, AND through a symlink/junction whose
// realpath THROWS -- recovered via the raw-form dual-identity membership (D-02,
// filter-diagnostics.ts). The same spec proves the NEGATIVE: a genuine transitive
// dependency `.ts` (neither a declared rootName nor under base, not node_modules)
// is SUPPRESSED into `suppressedInGraphErrorCount` -- isolation is intact. If a
// future TypeScript/Angular patch (or a refactor of the canonicalizer) breaks the
// dual-identity recovery, a declared root's real error would be silently dropped;
// these assertions turn that into a LOUD, named CI failure.
//
// PURE tier: `filterDiagnostics` is exercised over hand-built `ts.Diagnostic[]`
// literals plus an INJECTED `realpath` + `useCaseSensitiveFileNames` (mirroring the
// filter-diagnostics.spec OUT-02 / dual-identity idiom). The three FS modes are
// therefore deterministic cross-platform -- no real symlink/junction is created on
// disk (Windows-junction / POSIX-symlink behavior is modelled by the injected
// realpath). Version-pinned to Angular 22.0.4 / TS 6.0.3.
//
// ts.DiagnosticCategory numeric values (typescript@6.0.3): Warning = 0, Error = 1.
// Each diagnostic defaults to Error so a WRONGLY-suppressed declared root would
// land in `suppressedInGraphErrorCount` (the loud regression signal).
function diag(fileName: string): ts.Diagnostic {
  return {
    category: 1 /* Error */,
    code: 2322,
    file: { fileName } as ts.SourceFile,
    start: 0,
    length: 1,
    messageText: 'x',
  } as ts.Diagnostic;
}

describe('dual-identity declared-root tripwire (D-09a ii)', () => {
  // The declared rootName under test. In every membership mode the `basePath` is
  // set ELSEWHERE (`/ws/host`) so the diagnostic is kept by dual-identity
  // MEMBERSHIP, never the narrowed base clause -- the invariant being guarded.
  const declaredRoot = '/ws/proj/src/story.stories.ts';

  it('KEEPS a declared root on a case-INSENSITIVE FS (mixed-case diagnostic path folds to the rootName)', () => {
    const result = filterDiagnostics([diag('/WS/PROJ/src/Story.stories.ts')], {
      basePath: '/ws/host',
      useCaseSensitiveFileNames: false,
      realpath: (p: string) => p,
      inputTs: [declaredRoot],
      includeDeps: false,
    });

    // D-09a(ii): the declared root's own diagnostic is KEPT and NEVER counted as
    // a suppressed in-graph error -- case-fold membership matched it.
    expect(result.kept).toHaveLength(1);
    expect(result.suppressedInGraphErrorCount).toBe(0);
    expect(result.suppressedThirdParty).toBe(0);
  });

  it('KEEPS a declared root on a case-SENSITIVE FS (exact-case membership match)', () => {
    const result = filterDiagnostics([diag(declaredRoot)], {
      basePath: '/ws/host',
      useCaseSensitiveFileNames: true,
      realpath: (p: string) => p,
      inputTs: [declaredRoot],
      includeDeps: false,
    });

    // D-09a(ii): exact-case membership keeps it; not the base clause (base is
    // `/ws/host`, which does NOT contain the file).
    expect(result.kept).toHaveLength(1);
    expect(result.suppressedInGraphErrorCount).toBe(0);
    expect(result.suppressedThirdParty).toBe(0);
  });

  it('KEEPS a declared root through a symlink/junction whose realpath THROWS (raw-form recovery)', () => {
    const result = filterDiagnostics([diag(declaredRoot)], {
      basePath: '/ws/host',
      useCaseSensitiveFileNames: true,
      // Models a permission-denied junction / broken symlink: realpath throws for
      // EVERY path, so the full canonical form is undefined for both the rootName
      // and the diagnostic file. Only the raw form survives.
      realpath: () => {
        throw new Error('EACCES');
      },
      inputTs: [declaredRoot],
      includeDeps: false,
    });

    // D-09a(ii) THE load-bearing dual-identity case (D-02): the declared root is
    // matched via its raw form (which never touches realpath), so its real error
    // is KEPT rather than silently dropped when the filesystem cannot resolve it.
    expect(result.kept).toHaveLength(1);
    expect(result.suppressedInGraphErrorCount).toBe(0);
    expect(result.suppressedInGraphWarningCount).toBe(0);
    expect(result.suppressedThirdParty).toBe(0);
    expect(result.suppressedInGraphFiles).toHaveLength(0);
  });

  it('SUPPRESSES a genuine transitive dependency .ts (not a rootName, not under base) -- isolation NEGATIVE control', () => {
    const dependency = '/ws/dep/lib/internal.ts';

    const result = filterDiagnostics([diag(dependency)], {
      basePath: '/ws/host',
      useCaseSensitiveFileNames: true,
      realpath: (p: string) => p,
      inputTs: ['/ws/host/src/main.ts'],
      includeDeps: false,
    });

    // D-09a(ii): the dep is NOT kept, NOT third-party (it is first-party source,
    // just out of the input set), and counts as ONE suppressed in-graph error --
    // proving dual-identity membership did not over-keep an out-of-graph dep.
    expect(result.kept).toHaveLength(0);
    expect(result.suppressedThirdParty).toBe(0);
    expect(result.suppressedInGraphErrorCount).toBe(1);
    expect(result.suppressedInGraphFiles).toEqual([dependency]);
  });
});
