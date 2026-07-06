import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

import { evaluateResult } from './evaluate-result';
import { runTypecheck } from './run-typecheck';

// SB-06 T9 (= criterion 2, Phase 18, plan 18-02) -- REAL-compiler proof of the
// Layout-B `paths`-alias DX landmine. A centralized-host aggregated story imports
// a sibling ONLY through a workspace `@org/*` alias declared in
// `.storybook/tsconfig.json`'s `paths`. TypeScript's module resolution must honor
// that alias so the import resolves with NO spurious TS2307 (module-not-found) and
// the run stays clean.
//
// The alias is load-bearing: `@org/button` maps to
// `fixtures/layout-b-paths-alias-lib/button.ts` via `paths` alone -- removing the
// alias (or the target) would break resolution and surface a TS2307. Asserting the
// FULL 2307 code (not a stdout substring) is the criterion-2 gate.
//
// The story is plain Angular-free `.ts`, so the ONLY resolution concern is the
// alias -- no template diagnostics in play. Cold-compiler timeout is inherited
// from vitest.config.mts (testTimeout 30000); do NOT add a per-file testTimeout.

const TS2307 = 2307;

const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

function fixtureTsConfig(name: string): string {
  return join(workspaceRoot, 'fixtures', name, 'tsconfig.json');
}

describe('paths-alias: aggregated story imports a sibling via a workspace alias and compiles clean (criterion 2)', () => {
  it('resolves the @org/* aliased import with NO spurious TS2307 and a clean verdict', async () => {
    const result = await runTypecheck({
      tsConfigPath: fixtureTsConfig('layout-b-paths-alias'),
    });

    // The widened `.storybook` include materialized the aggregated story as a
    // declared rootName -- a genuinely-checked run, not a vacuous zero-files pass.
    expect(result.rootNamesCount).toBeGreaterThan(0);

    // criterion 2: the aliased import resolves via `paths`, so NO module-not-found
    // (TS2307) diagnostic appears. This is the DX landmine assertion -- a naive
    // setup that dropped the alias would emit TS2307 on a workspace that resolves
    // fine.
    expect(result.diagnostics.every((diagnostic) => diagnostic.code !== TS2307)).toBe(
      true,
    );

    // The whole run is clean: the aliased sibling is well-typed and the story has
    // no errors, so the verdict is a genuine clean pass.
    const verdict = evaluateResult(result);

    expect(verdict.outcome).toBe('clean');
    expect(verdict.success).toBe(true);
  });
});
