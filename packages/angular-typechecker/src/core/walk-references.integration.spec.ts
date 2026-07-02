import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { runTypecheck, TypecheckInfrastructureError } from './run-typecheck';

// WALK-01 (Phase 13) -- REAL-compiler reference-walk proofs. Each spec calls
// `runTypecheck` DIRECTLY against a committed solution-style fixture tsconfig
// (Plan 13-02 substrate) and asserts off `CoreResult`, proving the SHIPPED walk
// (Plan 13-04 wiring) end-to-end:
//
//   - SC1/SC2 UNION completeness + both leaves ran (`solution-style`): the walk
//     reports BOTH leaves' planted TS2322 (app leaf + spec leaf), each in its OWN
//     file so nothing collapses under ts.sortAndDeduplicateDiagnostics. The
//     spec-file error is reachable ONLY through the spec leaf (a build never
//     compiles specs) -- the named build differentiator.
//   - SC2 DEDUPE collapse (`solution-style-overlap`): ONE source file listed in
//     BOTH leaves is compiled in two separate Programs; its shared diagnostic
//     COLLAPSES to ONE in the union (cross-Program value dedupe by file.path).
//   - SC2 BOUNDARY skip (`solution-style-oop`): an out-of-project reference is
//     SKIPPED (its error never enters the union) and recorded on
//     skippedReferences with reason 'out-of-project'; the guard fires 90001.
//   - SC3 three-way split (it.each): refs + in-project leaf -> WALK; refs + 0
//     in-project -> 90001 none-in-project; no refs -> 90001 empty-project.
//   - SC3/D-05 FOLD-and-count (`solution-style-broken-ref`): a nonexistent leaf
//     PATH synthesizes ONE counted 90002 Error, the survivor leaf is STILL walked
//     (its TS2322 also reported), and the run RESOLVES (the per-leaf 500 was
//     reclassified, NOT rethrown as a TypecheckInfrastructureError).
//   - D-04 self/duplicate ref (`solution-style-selfref`): the single leaf TS2322
//     appears EXACTLY once despite the self + duplicate reference edges
//     (output-neutral dedupe); skippedReferences records reason 'self-reference'.
//
// Cold-compiler timeout is inherited from vitest.config.mts (testTimeout 30000);
// do NOT add a per-file testTimeout.

// The planted leaf errors are plain TS2322 (raw positive). The synthesized
// guard/not-found codes (90001/90002) are bare positive ints OUTSIDE both the TS
// and the Angular (negative-encoded, e.g. ngErrorCode(8109) = -998109) ranges, so
// they are asserted directly. No NG8xxx code is asserted here (PITFALL E / L-4),
// so no negative-encoding helper is needed.
const TS2322 = 2322;
const ZERO_ROOT_NAMES = 90001;
const REFERENCE_NOT_FOUND = 90002;

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspaceRoot = join(packageRoot, '..', '..');

function fixtureTsConfig(name: string): string {
  return join(workspaceRoot, 'fixtures', name, 'tsconfig.json');
}

const solutionStyle = fixtureTsConfig('solution-style');
const solutionStyleOverlap = fixtureTsConfig('solution-style-overlap');
const solutionStyleOop = fixtureTsConfig('solution-style-oop');
const solutionStyleEmpty = fixtureTsConfig('solution-style-empty');
const solutionStyleBrokenRef = fixtureTsConfig('solution-style-broken-ref');
const solutionStyleAllMissing = fixtureTsConfig('solution-style-all-missing');
const solutionStyleSelfRef = fixtureTsConfig('solution-style-selfref');

function codesOf(diagnostics: readonly ts.Diagnostic[]): number[] {
  return diagnostics.map((diagnostic) => diagnostic.code);
}

describe('walk-references: SC1/SC2 union completeness + both leaves ran (solution-style)', () => {
  it('walks app + spec leaves and unions BOTH planted TS2322 (rootNamesCount > 0, errorCount 2)', async () => {
    const result = await runTypecheck({ tsConfigPath: solutionStyle });

    // L-3: references + >=1 in-project leaf -> WALK, so rootNamesCount is the SUM
    // over surviving leaves, never 0.
    expect(result.rootNamesCount).toBeGreaterThan(0);

    // Exactly the two planted TS2322 (one per leaf) survive the union finalize --
    // no infra collapse, no double-count.
    expect(result.errorCount).toBe(2);

    const codes = codesOf(result.diagnostics);

    // EXACTLY two TS2322 in the union -- proves both leaves ran AND nothing
    // double-counted (no second dedupe layer over the union).
    expect(codes.filter((code) => code === TS2322)).toHaveLength(2);

    // The two TS2322 live in DISTINCT files (error.component.ts vs
    // error.component.spec.ts). The spec-file error is reachable ONLY through the
    // spec leaf (a build never compiles specs) -- the named build differentiator.
    const ts2322FileNames = result.diagnostics
      .filter((diagnostic) => diagnostic.code === TS2322)
      .map((diagnostic) => diagnostic.file?.fileName ?? '');

    expect(
      ts2322FileNames.some((fileName) =>
        fileName.endsWith('error.component.ts'),
      ),
    ).toBe(true);
    expect(
      ts2322FileNames.some((fileName) =>
        fileName.endsWith('error.component.spec.ts'),
      ),
    ).toBe(true);

    // Both references are in-project and walk cleanly, so no skipped-reference
    // notice is recorded (core maps the walk's empty array to undefined).
    expect(result.skippedReferences).toBeUndefined();
  });
});

describe('walk-references: SC2 cross-Program dedupe collapse (solution-style-overlap)', () => {
  it('collapses ONE shared-source diagnostic to a single entry though gathered in both leaves', async () => {
    const result = await runTypecheck({ tsConfigPath: solutionStyleOverlap });

    // The SAME file (shared.component.ts) is listed in BOTH tsconfig.lib.json and
    // tsconfig.spec.json, so it is compiled in two separate Programs. The union's
    // single finalize (ts.sortAndDeduplicateDiagnostics keys on file.path string
    // identity) must COLLAPSE the identical diagnostic to ONE.
    const sharedTs2322 = result.diagnostics.filter(
      (diagnostic) =>
        diagnostic.code === TS2322 &&
        (diagnostic.file?.fileName ?? '').endsWith('shared.component.ts'),
    );

    // The shared (fileName, code) pair appears EXACTLY once (dedupe collapse).
    expect(sharedTs2322).toHaveLength(1);

    // errorCount reflects the DEDUPED multiset -- the shared diagnostic is not
    // double-counted across the two Programs.
    expect(result.errorCount).toBe(1);

    // Both leaves are in-project and walk cleanly, so no skip is recorded.
    expect(result.rootNamesCount).toBeGreaterThan(0);
    expect(result.skippedReferences).toBeUndefined();
  });
});

describe('walk-references: SC2 boundary skip vs no-guard leak (solution-style-oop)', () => {
  it('SKIPS the out-of-project reference (its error never reported) and records skippedReferences reason out-of-project', async () => {
    const result = await runTypecheck({ tsConfigPath: solutionStyleOop });

    const codes = codesOf(result.diagnostics);

    // T-13-01: the ONLY reference points OUT of the solution directory (to
    // ../solution-style/tsconfig.app.json). The boundary guard SKIPS it, so the
    // outsider's planted TS2322 NEVER enters the union. WITHOUT the guard this
    // out-of-project error would leak into the reported set -- this assertion is
    // the leak tripwire.
    expect(codes).not.toContain(TS2322);

    // Every reference was skipped, so 0 in-project leaves walked: the walk branch
    // synthesizes the references-present none-in-project 90001 guard.
    expect(result.rootNamesCount).toBe(0);
    expect(result.errorCount).toBe(1);
    expect(codes).toContain(ZERO_ROOT_NAMES);

    // The skip is RECORDED for the adapter's advisory notice: a non-empty array
    // with the out-of-project reason naming the resolved leaf path.
    expect(result.skippedReferences).toBeDefined();
    expect(result.skippedReferences ?? []).not.toHaveLength(0);
    expect(result.skippedReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: 'out-of-project',
          referencePath: expect.stringContaining('solution-style'),
        }),
      ]),
    );
  });
});

describe('walk-references: SC3 three-way D-03a split', () => {
  it.each([
    {
      label: 'refs + in-project leaf -> WALK',
      tsConfigPath: solutionStyle,
      expectWalk: true,
    },
    {
      label: 'refs + 0 in-project -> 90001 none-in-project',
      tsConfigPath: solutionStyleOop,
      expectWalk: false,
    },
    {
      label: 'no refs (empty project) -> 90001 empty-project',
      tsConfigPath: solutionStyleEmpty,
      expectWalk: false,
    },
  ])('routes correctly: $label', async ({ tsConfigPath, expectWalk }) => {
    const result = await runTypecheck({ tsConfigPath });

    const codes = codesOf(result.diagnostics);

    if (expectWalk) {
      // Walk branch: at least one in-project leaf ran, so rootNamesCount is the
      // summed count and the reported errors are the leaves' real diagnostics
      // (no 90001 guard).
      expect(result.rootNamesCount).toBeGreaterThan(0);
      expect(result.errorCount).toBe(2);
      expect(codes).not.toContain(ZERO_ROOT_NAMES);

      return;
    }

    // Guard branch (none-in-project OR empty project): zero root names and the
    // single synthesized 90001 Error -- a deterministic non-zero signal, never a
    // false "0 files / 0 errors".
    expect(result.rootNamesCount).toBe(0);
    expect(result.errorCount).toBe(1);
    expect(codes).toContain(ZERO_ROOT_NAMES);
  });
});

describe('walk-references: C8 the zero-rootNames guard message is actionable (regression guard)', () => {
  it('names a leaf tsconfig and distinguishes references-only from empty-project', async () => {
    const refsOnly = await runTypecheck({ tsConfigPath: solutionStyleOop });
    const empty = await runTypecheck({ tsConfigPath: solutionStyleEmpty });

    function guardMessage(diagnostics: readonly ts.Diagnostic[]): string {
      const guard = diagnostics.find(
        (diagnostic) => diagnostic.code === ZERO_ROOT_NAMES,
      );

      return guard !== undefined && typeof guard.messageText === 'string'
        ? guard.messageText
        : '';
    }

    const refsOnlyMessage = guardMessage(refsOnly.diagnostics);
    const emptyMessage = guardMessage(empty.diagnostics);

    // C8: no spec pinned this message text, so a regression that empties/garbles/
    // collapses the two branch messages would ship silently (the code stays 90001).
    // Both branches MUST keep the actionable "point at a leaf tsconfig" guidance.
    expect(refsOnlyMessage).toContain('tsconfig.app.json');
    expect(refsOnlyMessage).toContain('references-only');
    expect(emptyMessage).toContain('tsconfig.app.json');
    expect(emptyMessage).toContain('empty project');

    // The two branches carry DISTINCT guidance and are never collapsed together.
    expect(refsOnlyMessage).not.toBe(emptyMessage);
  });
});

describe('walk-references: SC3/D-05 fold-and-count (solution-style-broken-ref)', () => {
  it('synthesizes ONE counted 90002, STILL walks the survivor, and RESOLVES (no rethrow)', async () => {
    const result = await runTypecheck({ tsConfigPath: solutionStyleBrokenRef });

    const codes = codesOf(result.diagnostics);

    // T-13-02: the solution references a REAL leaf + a NONEXISTENT
    // ./tsconfig.missing.json. D-05 reclassifies the per-leaf 500 into ONE counted
    // 90002 Error (never a rethrow), so the broken reference is a deterministic
    // non-zero verdict rather than a silent PASS by omission.
    expect(codes).toContain(REFERENCE_NOT_FOUND);
    expect(codes.filter((code) => code === REFERENCE_NOT_FOUND)).toHaveLength(
      1,
    );

    // The survivor leaf (error.component.ts) is STILL walked despite the sibling
    // broken reference -- its planted TS2322 is also reported.
    expect(codes).toContain(TS2322);

    // 90002 + the survivor's TS2322 -> at least two counted Errors.
    expect(result.errorCount).toBeGreaterThanOrEqual(2);

    // The survivor contributed root names (the walk did not collapse to the guard).
    expect(result.rootNamesCount).toBeGreaterThan(0);

    // The not-found reclassification is recorded for the advisory notice.
    expect(result.skippedReferences).toBeDefined();
    expect(result.skippedReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: 'not-found',
          referencePath: expect.stringContaining('tsconfig.missing.json'),
        }),
      ]),
    );
  });

  it('RESOLVES rather than rejecting with a TypecheckInfrastructureError (the per-leaf 500 is reclassified, not rethrown)', async () => {
    // NEGATIVE assertion: unlike the DIRECT nonexistent-path case (COR-01, which
    // rejects), a nonexistent leaf reached THROUGH the walk is folded into a
    // counted 90002 -- so the top-level call RESOLVES to a defined CoreResult and
    // NEVER throws.
    await expect(
      runTypecheck({ tsConfigPath: solutionStyleBrokenRef }),
    ).resolves.toBeDefined();

    await expect(
      runTypecheck({ tsConfigPath: solutionStyleBrokenRef }),
    ).resolves.not.toBeInstanceOf(TypecheckInfrastructureError);
  });
});

describe('walk-references: I-1 all-references-not-found surfaces the 90002s (solution-style-all-missing)', () => {
  it('reports ONE counted 90002 PER missing reference, NOT a single generic 90001 guard', async () => {
    const result = await runTypecheck({
      tsConfigPath: solutionStyleAllMissing,
    });

    const codes = codesOf(result.diagnostics);

    // I-1: EVERY reference is not-found, so no leaf survives (rootNamesCount 0). The
    // walk's counted 90002 "referenced tsconfig not found" Errors -- one per missing
    // leaf -- must be REPORTED, not discarded in favour of the generic 90001 guard
    // whose message ("references are not consulted ... point at a leaf that lists
    // files") is WRONG for this case.
    expect(result.rootNamesCount).toBe(0);
    expect(codes.filter((code) => code === REFERENCE_NOT_FOUND)).toHaveLength(
      2,
    );
    expect(codes).not.toContain(ZERO_ROOT_NAMES);
    expect(result.errorCount).toBe(2);

    // Both not-found references are recorded for the advisory notice, path-named.
    expect(result.skippedReferences).toBeDefined();
    expect(result.skippedReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: 'not-found',
          referencePath: expect.stringContaining('tsconfig.missing-a.json'),
        }),
        expect.objectContaining({
          reason: 'not-found',
          referencePath: expect.stringContaining('tsconfig.missing-b.json'),
        }),
      ]),
    );

    // The messages name each missing path so an agent/CI gets an actionable step.
    const messages = result.diagnostics.map((diagnostic) =>
      typeof diagnostic.messageText === 'string' ? diagnostic.messageText : '',
    );

    expect(
      messages.some((message) => message.includes('tsconfig.missing-a.json')),
    ).toBe(true);
    expect(
      messages.some((message) => message.includes('tsconfig.missing-b.json')),
    ).toBe(true);
  });
});

describe('walk-references: D-04 self/duplicate reference (solution-style-selfref)', () => {
  it('reports the single leaf TS2322 EXACTLY once despite the self + duplicate edges and records reason self-reference', async () => {
    const result = await runTypecheck({ tsConfigPath: solutionStyleSelfRef });

    const codes = codesOf(result.diagnostics);

    // D-04: the solution references itself (./tsconfig.json) AND lists the leaf
    // (./tsconfig.app.json) twice. Canonicalize + dedupe skips the self-reference
    // and the duplicate edge, so the leaf compiles ONCE -- its single planted
    // TS2322 is reported EXACTLY once (output-neutral).
    expect(codes.filter((code) => code === TS2322)).toHaveLength(1);
    expect(result.errorCount).toBe(1);
    expect(result.rootNamesCount).toBeGreaterThan(0);

    // The skipped self/duplicate edges are RECORDED for the advisory notice with
    // the self-reference reason.
    expect(result.skippedReferences).toBeDefined();
    expect(result.skippedReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: 'self-reference',
        }),
      ]),
    );
  });
});
