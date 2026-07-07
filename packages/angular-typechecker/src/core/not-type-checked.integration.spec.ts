import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

import { evaluateResult } from './evaluate-result';
import { runTypecheck } from './run-typecheck';

// D-01 (Phase 18, T11) -- REAL-compiler proof that a fixture DECLARING a `.mdx`
// (and a JSX-FREE `.tsx` with `compilerOptions.jsx` unset) surfaces
// `CoreResult.notTypeCheckedDeclaredFiles` non-empty AND keeps the verdict `clean`.
// This is criterion 3's integration proof.
//
// 18-01's unit tier proves the `.tsx` half with synthetic input. The `.mdx` half is
// enumerated by a REAL cold `ts.parseJsonConfigFileContent` `extraFileExtensions`
// parse over a committed tsconfig `include` -- the exact enumeration the unit tier
// cannot cover (18-RESEARCH RQ2 / Assumption A2).
//
// Pitfall 3 / Assumption A1: the fixture's `.tsx` is deliberately JSX-FREE. A `.tsx`
// that USES JSX with `jsx` unset emits a hard TS17004-class error that would flip
// the verdict RED, orthogonal to the advisory. The advisory NEVER changes the
// verdict -- `evaluateResult` does not read the field (locked by the negative unit
// test in evaluate-result.spec.ts; proven end-to-end here).
//
// Cold-compiler timeout is inherited from vitest.config.mts (testTimeout 30000); do
// NOT add a per-file testTimeout.

const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

function fixtureTsConfig(name: string): string {
  return join(workspaceRoot, 'fixtures', name, 'tsconfig.json');
}

describe('not-type-checked advisory: declared .mdx / jsx-less .tsx surfaces, verdict stays clean (T11 / D-01)', () => {
  it('surfaces notTypeCheckedDeclaredFiles (incl. the .mdx and the jsx-less .tsx) AND keeps the verdict clean', async () => {
    const result = await runTypecheck({
      tsConfigPath: fixtureTsConfig('not-type-checked-mdx'),
    });

    // A genuinely-checked green pass: the declared checkable surface is walked, so
    // rootNamesCount is non-zero (not a vacuous zero-files pass).
    expect(result.rootNamesCount).toBeGreaterThan(0);

    // The advisory fires on the declared-but-uncheckable files.
    expect(result.notTypeCheckedDeclaredFiles).toBeDefined();
    expect(result.notTypeCheckedDeclaredFiles ?? []).not.toHaveLength(0);

    // The `.mdx` is enumerated by the REAL ts.parseJsonConfigFileContent
    // extraFileExtensions parse over the committed `include` -- the half the unit
    // tier cannot exercise. This is the integration proof of criterion 3.
    expect(
      result.notTypeCheckedDeclaredFiles?.some((path) =>
        path.endsWith('intro.mdx'),
      ),
    ).toBe(true);

    // The JSX-free `.tsx` (jsx unset) is enumerated too (from parsed.rootNames).
    expect(
      result.notTypeCheckedDeclaredFiles?.some((path) =>
        path.endsWith('widget.tsx'),
      ),
    ).toBe(true);

    // The advisory is ORTHOGONAL to the verdict: no hard error is produced, so the
    // verdict stays green (Pitfall 3 / A1 -- the JSX-free `.tsx` cannot turn it red).
    expect(result.errorCount).toBe(0);

    const verdict = evaluateResult(result);

    expect(verdict.success).toBe(true);
    expect(verdict.outcome).toBe('clean');
  });
});

describe('not-type-checked advisory: negative control -- only .ts declared -> field empty, verdict clean (T11 / D-01)', () => {
  it('leaves notTypeCheckedDeclaredFiles empty/undefined with a clean verdict', async () => {
    const result = await runTypecheck({
      tsConfigPath: fixtureTsConfig('not-type-checked-clean'),
    });

    // Same genuinely-checked green pass, isolating the difference from the green
    // fixture to the declared surface alone.
    expect(result.rootNamesCount).toBeGreaterThan(0);

    // No `.mdx` and no jsx-less `.tsx` declared -> core maps the empty array to
    // undefined (asserted tolerant of [] too).
    expect(result.notTypeCheckedDeclaredFiles ?? []).toHaveLength(0);

    expect(result.errorCount).toBe(0);

    const verdict = evaluateResult(result);

    expect(verdict.success).toBe(true);
    expect(verdict.outcome).toBe('clean');
  });
});
