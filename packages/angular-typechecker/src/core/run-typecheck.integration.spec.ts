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

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspaceRoot = join(packageRoot, '..', '..');
const fixtureDir = join(workspaceRoot, 'fixtures', 'gate-b-error');

const appTsConfig = join(fixtureDir, 'tsconfig.app.json');
const libTsConfig = join(fixtureDir, 'tsconfig.lib.json');

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
