import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

import { evaluateResult } from './evaluate-result';
import { runTypecheck, TypecheckInfrastructureError } from './run-typecheck';

// ENG-01 (D-06) REAL-compiler proof of the tsConfig ARRAY path. `runTypecheck`
// accepts `tsConfigPath: string | string[]`; an array runs each entry
// through the SAME single-tsConfig gather logic, UNIONs the raw per-entry
// diagnostics, and runs ONE finalize over the COMBINED declared input set. The
// hermetic `multi-tsconfig-array` fixture has co-located app + spec leaves with a
// planted diagnostic in EACH (TS2322 in the component, TS2345 in the spec); the spec
// imports the component so both sit in one dependency graph. This proves (a) the
// array union surfaces BOTH leaves' diagnostics and keeps both leaves' in-project
// files over the combined boundary, (b) a single-element array equals the
// single-string path, and (c) the single-string path is unchanged.

const TS2322 = 2322;
const TS2345 = 2345;

const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);
const fixtureDir = join(workspaceRoot, 'fixtures', 'multi-tsconfig-array');

const appTsConfig = join(fixtureDir, 'tsconfig.app.json');
const specTsConfig = join(fixtureDir, 'tsconfig.spec.json');

const appComponent = join(fixtureDir, 'app.component.ts');
const appComponentSpec = join(fixtureDir, 'app.component.spec.ts');

// WR-02 fixtures: a zero-rootNames leaf (`files: []`, no references) exercises the
// array path's zero-root-names skip branch; a nonexistent path exercises the
// per-entry infrastructure-500 re-throw.
const emptyLeafTsConfig = join(
  workspaceRoot,
  'fixtures',
  'solution-style-empty',
  'tsconfig.json',
);
const nonexistentTsConfig = join(
  workspaceRoot,
  'fixtures',
  'config-broken',
  'tsconfig.does-not-exist.json',
);

// WR-03 fixture: the two leaves live in SIBLING directories (app/ and spec/), so
// they do NOT share a base directory. The spec leaf's file is out of the app leaf's
// base, so the base-containment clause cannot rescue it -- only the combined
// rootNamePaths union keeps it.
const crossDirRoot = join(
  workspaceRoot,
  'fixtures',
  'multi-tsconfig-cross-dir',
);
const crossDirAppTsConfig = join(crossDirRoot, 'app', 'tsconfig.app.json');
const crossDirSpecTsConfig = join(crossDirRoot, 'spec', 'tsconfig.spec.json');
const crossDirAppComponent = join(crossDirRoot, 'app', 'app.component.ts');
const crossDirSpec = join(crossDirRoot, 'spec', 'app.spec.ts');

function diagnosticsOnFile(
  diagnostics: readonly { file?: { fileName: string } }[],
  absolutePath: string,
): readonly { file?: { fileName: string } }[] {
  // CoreResult fileNames are absolute + forward-slash; the join() path uses the
  // OS separator, so compare on the normalized forward-slash form.
  const normalized = absolutePath.replace(/\\/g, '/');

  return diagnostics.filter(
    (diagnostic) => diagnostic.file?.fileName === normalized,
  );
}

describe('runTypecheck tsConfig array (multi-tsconfig-array fixture, ENG-01)', () => {
  it('ENG-01: an array [appLeaf, specLeaf] surfaces BOTH leaves planted diagnostics over the combined input set', async () => {
    const result = await runTypecheck({
      tsConfigPath: [appTsConfig, specTsConfig],
    });

    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);

    // The union carries BOTH the app leaf's TS2322 and the spec leaf's TS2345.
    expect(codes).toContain(TS2322);
    expect(codes).toContain(TS2345);

    // Neither leaf's in-project file is dropped by the COMBINED boundary: the app
    // component (a rootName of the app leaf, a dependency of the spec leaf) and the
    // spec (a rootName of the spec leaf) both keep their diagnostics.
    expect(
      diagnosticsOnFile(result.diagnostics, appComponent).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      diagnosticsOnFile(result.diagnostics, appComponentSpec).length,
    ).toBeGreaterThanOrEqual(1);

    // Real diagnostics flowed (not a vacuous pass); both planted errors counted.
    expect(result.errorCount).toBeGreaterThanOrEqual(2);
  });

  it('ENG-01: a single-element array [appLeaf] equals the single-string appLeaf (same codes + counts)', async () => {
    const arrayResult = await runTypecheck({ tsConfigPath: [appTsConfig] });
    const stringResult = await runTypecheck({ tsConfigPath: appTsConfig });

    const arrayCodes = arrayResult.diagnostics
      .map((diagnostic) => diagnostic.code)
      .sort();
    const stringCodes = stringResult.diagnostics
      .map((diagnostic) => diagnostic.code)
      .sort();

    expect(arrayCodes).toEqual(stringCodes);
    expect(arrayResult.errorCount).toBe(stringResult.errorCount);
    expect(arrayResult.warningCount).toBe(stringResult.warningCount);
  });

  it('ENG-01: the single-string appLeaf path is unchanged (surfaces its planted TS2322)', async () => {
    const result = await runTypecheck({ tsConfigPath: appTsConfig });

    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);

    expect(codes).toContain(TS2322);
    // The spec leaf is NOT pulled in by the app leaf alone (app.component.ts does
    // not import the spec), so its TS2345 is absent from the single app-leaf run.
    expect(codes).not.toContain(TS2345);
    expect(result.errorCount).toBeGreaterThanOrEqual(1);
  });
});

// WR-02: the verdict-deciding branches handleMultiTsConfig ADDED this phase, which
// the three happy-path cases above never exercise. Each of these MUST be provably
// "never a silent pass" (T-21-05) -- the charter-critical property.
describe('runTypecheck tsConfig array branches (WR-02, ENG-01)', () => {
  it('WR-02(a): a zero-rootNames array entry is recorded as a zero-root-names skip and yields coverage-incomplete, NEVER a silent pass', async () => {
    // A single zero-rootNames leaf: no surviving entry runs, so the ONLY signal is
    // the recorded skip. If handleMultiTsConfig failed to record it, errorCount 0 +
    // no skip would evaluate CLEAN (success: true) -- the exact silent pass the
    // charter forbids.
    const result = await runTypecheck({ tsConfigPath: [emptyLeafTsConfig] });

    // No surviving leaf -> zero root names, zero diagnostics (the array path does
    // NOT synthesize a 90001 guard; it records a skip instead, mirroring the walk).
    expect(result.rootNamesCount).toBe(0);
    expect(result.errorCount).toBe(0);
    expect(result.diagnostics).toHaveLength(0);

    // The zero-rootNames entry is recorded on skippedReferences, path-named.
    expect(result.skippedReferences).toBeDefined();
    expect(result.skippedReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: 'zero-root-names',
          referencePath: expect.stringContaining('solution-style-empty'),
        }),
      ]),
    );

    // The load-bearing assertion: the recorded skip feeds evaluateResult's
    // hasZeroRootNamesLeaf, so the verdict is coverage-incomplete (fails), NOT a
    // silent clean pass on zero input.
    expect(evaluateResult(result)).toEqual({
      success: false,
      outcome: 'coverage-incomplete',
    });
  });

  it('WR-02(a): a surviving leaf + a zero-rootNames leaf keeps the surviving diagnostic AND records the skip', async () => {
    // Coexistence: the surviving app leaf's TS2322 is unioned while the empty leaf
    // is recorded as a zero-root-names skip (the [appLeaf, emptyLeaf] case).
    const result = await runTypecheck({
      tsConfigPath: [appTsConfig, emptyLeafTsConfig],
    });

    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);

    expect(codes).toContain(TS2322);
    expect(result.skippedReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: 'zero-root-names',
          referencePath: expect.stringContaining('solution-style-empty'),
        }),
      ]),
    );
  });

  it('WR-02(b): an empty array throws a TypecheckInfrastructureError, NEVER a silent pass on no input', async () => {
    await expect(runTypecheck({ tsConfigPath: [] })).rejects.toBeInstanceOf(
      TypecheckInfrastructureError,
    );

    await expect(runTypecheck({ tsConfigPath: [] })).rejects.toThrow(
      /empty array/,
    );
  });

  it('WR-02(c): a per-entry UNKNOWN_ERROR_CODE (500) re-throws as TypecheckInfrastructureError, NEVER a counted type error', async () => {
    // A nonexistent explicit array entry makes readConfiguration's outer catch fire
    // (ENOENT -> code-500 in parsed.errors); the per-entry infra scan re-throws it
    // as infrastructure even when a valid leaf precedes it in the array -- exactly
    // as the direct single-string path does (COR-01).
    await expect(
      runTypecheck({ tsConfigPath: [appTsConfig, nonexistentTsConfig] }),
    ).rejects.toBeInstanceOf(TypecheckInfrastructureError);
  });
});

// WR-03: the co-located `multi-tsconfig-array` fixture cannot guard the
// combined-input-set-membership boundary (T-21-05) -- both leaves share one base
// dir, so `finalize`'s base-containment clause keeps the second leaf's file
// regardless of input-set membership. This cross-dir fixture puts the two leaves in
// SIBLING directories, so ONLY the combined rootNamePaths union can keep the second
// leaf's file. This is the mutation-killing test the co-located fixture is missing.
describe('runTypecheck tsConfig array combined-input-set boundary (WR-03, T-21-05)', () => {
  it('WR-03 CONTROL: a cross-dir dependency file IS suppressed under a single leaf (proves the base clause does NOT rescue a sibling-dir non-member)', async () => {
    // Run the SPEC leaf ALONE. Its base dir is `spec/`. The imported
    // `app/app.component.ts` is a DEPENDENCY (not a declared rootName) that lives in
    // the SIBLING `app/` dir -- out of the spec leaf's base and NOT in its input
    // set -- so the boundary filter SUPPRESSES its TS2322. This establishes that a
    // file in `app/` is genuinely out-of-base relative to a `spec/`-based run (and,
    // by symmetry, the spec file is out-of-base relative to an `app/`-based run) --
    // so in the combined run below the sibling file can only be kept by membership.
    const result = await runTypecheck({ tsConfigPath: crossDirSpecTsConfig });

    // The spec leaf's OWN file is kept (its declared rootName): TS2345 present.
    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);

    expect(codes).toContain(TS2345);

    // The cross-dir dependency's TS2322 is SUPPRESSED (out of base, non-member) --
    // it is NOT in the reported set but IS counted as a suppressed in-graph error.
    expect(
      diagnosticsOnFile(result.diagnostics, crossDirAppComponent),
    ).toHaveLength(0);
    expect(result.suppressedInGraphErrorCount).toBeGreaterThanOrEqual(1);
    expect(
      result.suppressedInGraphFiles.some((file) =>
        file.toLowerCase().endsWith('app/app.component.ts'),
      ),
    ).toBe(true);
  });

  it('WR-03 MUTATION-KILL: the combined array [appLeaf, specLeaf] keeps the spec leaf file via the COMBINED input set, not base-containment', async () => {
    const result = await runTypecheck({
      tsConfigPath: [crossDirAppTsConfig, crossDirSpecTsConfig],
    });

    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);

    // Both leaves' planted diagnostics surface in the union.
    expect(codes).toContain(TS2322);
    expect(codes).toContain(TS2345);

    // The app leaf's file (the representative leaf, whose base dir governs
    // base-containment) is kept -- either membership or base-containment would keep
    // it, so this alone is not the guard.
    expect(
      diagnosticsOnFile(result.diagnostics, crossDirAppComponent).length,
    ).toBeGreaterThanOrEqual(1);

    // THE MUTATION-KILL: the spec leaf's file lives in the SIBLING `spec/` dir --
    // OUTSIDE the representative (app) leaf's base -- so base-containment cannot keep
    // it. It survives ONLY because handleMultiTsConfig finalizes over the COMBINED
    // rootNamePaths union (which includes the spec leaf's declared file). If the
    // implementation regressed to using only the FIRST leaf's rootNames as the input
    // set, this diagnostic would be dropped as an out-of-project dependency (exactly
    // as the CONTROL above shows a cross-dir non-member is dropped) and this
    // assertion would FAIL.
    expect(
      diagnosticsOnFile(result.diagnostics, crossDirSpec).length,
    ).toBeGreaterThanOrEqual(1);

    // The spec file was kept, so it is NOT counted as a suppressed in-graph error
    // (the union membership rescued it, not a fail-safe over-report).
    expect(
      result.suppressedInGraphFiles.some((file) =>
        file.toLowerCase().endsWith('spec/app.spec.ts'),
      ),
    ).toBe(false);

    expect(result.errorCount).toBeGreaterThanOrEqual(2);
  });
});
