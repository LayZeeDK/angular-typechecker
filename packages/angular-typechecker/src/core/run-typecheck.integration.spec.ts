import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { runTypecheck } from './run-typecheck';

// REAL-compiler end-to-end proof of the new D-01..D-06 contract (TEST-02,
// D-07c): call `runTypecheck` DIRECTLY (one performCompilation per fixture) and
// assert off `CoreResult`. The `gate-b-error` fixture is the F1+F7 differentiator
// -- a plain TS error (TS2322) AND a template/extended error (NG8109) in the SAME
// program -- so it proves the unconditional gatherer surfaces BOTH in one pass.

const TS2322 = 2322;
// Angular encodes extended codes negative: ngErrorCode(8109) = -998109. Assert
// via the NG() helper, never the bare 8109 (PITFALL E / L-4). TS codes are raw.
const NG = (code: number): number => -990000 - code;

const TS6059 = 6059;

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspaceRoot = join(packageRoot, '..', '..');
const fixtureDir = join(workspaceRoot, 'fixtures', 'gate-b-error');

const appTsConfig = join(fixtureDir, 'tsconfig.app.json');
const libTsConfig = join(fixtureDir, 'tsconfig.lib.json');

// The sibling-import fixture: a `main-lib` leaf project that imports a sibling
// `dependency-lib` via a `paths` alias. The dependency-lib carries a TS2322 that
// lands OUTSIDE the main-lib `basePath` -> suppressed by default; main.component
// carries its OWN in-project TS2322 -> always kept.
const siblingImportTsConfig = join(
  workspaceRoot,
  'fixtures',
  'sibling-import',
  'main-lib',
  'tsconfig.lib.json',
);
const mainLibComponent = join(
  workspaceRoot,
  'fixtures',
  'sibling-import',
  'main-lib',
  'main.component.ts',
);
const dependencyLibSource = join(
  workspaceRoot,
  'fixtures',
  'sibling-import',
  'dependency-lib',
  'dependency.ts',
);

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

describe.each([
  ['app tsconfig', appTsConfig],
  ['local-library tsconfig', libTsConfig],
])('runTypecheck end-to-end (%s)', (_label, tsConfigPath) => {
  it('ENG-01: resolves the config, runs whole-program no-emit, returns a structured result', async () => {
    const result = await runTypecheck({ tsConfigPath });

    expect(result.tsConfigPath).toBe(tsConfigPath);
    expect(result.rootNamesCount).toBeGreaterThan(0);
    expect(Array.isArray(result.diagnostics)).toBe(true);
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it('ENG-02: the unconditional gatherer surfaces TS2322 AND NG8109 (-998109) in ONE pass (no short-circuit)', async () => {
    const result = await runTypecheck({ tsConfigPath });

    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);

    expect(codes).toContain(TS2322);
    expect(codes).toContain(NG(8109));
  });

  it('ENG-04 / D-01: counts the TS2322 as an error and upholds the count invariant', async () => {
    const result = await runTypecheck({ tsConfigPath });

    expect(result.errorCount).toBeGreaterThanOrEqual(1);
    expect(result.warningCount).toBeGreaterThanOrEqual(0);
    expect(result.errorCount + result.warningCount).toBeLessThanOrEqual(
      result.diagnostics.length,
    );
  });

  it('D-01: CoreResult exposes NO public `codes` field', async () => {
    const result = await runTypecheck({ tsConfigPath });

    expect('codes' in result).toBe(false);
  });
});

// D-02/D-06/D-07 (EXE-04/OUT-02): the project-boundary filter against a REAL
// sibling-import program. main.component (in-project) and dependency-lib (a
// `paths`-resolved sibling OUTSIDE basePath) each carry a TS2322; the default
// filter suppresses the sibling and keeps the in-project one, while
// `includeDeps: true` folds the sibling diagnostic back.
describe('runTypecheck boundary filter (sibling-import fixture)', () => {
  it('EXE-04/D-06: suppresses the out-of-project sibling diagnostic and keeps the in-project one by default', async () => {
    const result = await runTypecheck({ tsConfigPath: siblingImportTsConfig });

    // The in-project main.component TS2322 is kept.
    expect(diagnosticsOnFile(result.diagnostics, mainLibComponent)).toHaveLength(
      1,
    );

    // The sibling dependency-lib TS2322 is NOT in the reported set...
    expect(
      diagnosticsOnFile(result.diagnostics, dependencyLibSource),
    ).toHaveLength(0);

    // ...it was suppressed (counted in the scalar, not enumerated).
    expect(result.suppressedCount).toBeGreaterThanOrEqual(1);
  });

  it('EXE-04/D-07: includeDeps: true folds the sibling diagnostic back with suppressedCount 0', async () => {
    const result = await runTypecheck({
      tsConfigPath: siblingImportTsConfig,
      includeDeps: true,
    });

    // Both the in-project and the sibling TS2322 are now reported.
    expect(diagnosticsOnFile(result.diagnostics, mainLibComponent)).toHaveLength(
      1,
    );
    expect(
      diagnosticsOnFile(result.diagnostics, dependencyLibSource),
    ).toHaveLength(1);

    // Nothing suppressed when the boundary filter is off.
    expect(result.suppressedCount).toBe(0);
  });

  it('D-09: the kept set is sorted by file (the sibling dependency-lib sorts before main-lib under includeDeps)', async () => {
    const result = await runTypecheck({
      tsConfigPath: siblingImportTsConfig,
      includeDeps: true,
    });

    const fileNames = result.diagnostics
      .map((diagnostic) => diagnostic.file?.fileName)
      .filter((fileName): fileName is string => fileName !== undefined);
    const sorted = [...fileNames].sort();

    // sortAndDeduplicateDiagnostics orders by file path; the dependency-lib path
    // sorts before the main-lib path alphabetically.
    expect(fileNames).toEqual(sorted);
  });

  it('Pitfall 5: TS6059 ("not under rootDir") does NOT appear (the no-emit override neutralizes the emit-layout trap)', async () => {
    const defaultResult = await runTypecheck({
      tsConfigPath: siblingImportTsConfig,
    });
    const includeDepsResult = await runTypecheck({
      tsConfigPath: siblingImportTsConfig,
      includeDeps: true,
    });

    const defaultCodes = defaultResult.diagnostics.map(
      (diagnostic) => diagnostic.code,
    );
    const includeDepsCodes = includeDepsResult.diagnostics.map(
      (diagnostic) => diagnostic.code,
    );

    expect(defaultCodes).not.toContain(TS6059);
    expect(includeDepsCodes).not.toContain(TS6059);
  });
});
