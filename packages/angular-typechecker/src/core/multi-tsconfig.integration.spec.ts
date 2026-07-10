import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

import { runTypecheck } from './run-typecheck';

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
