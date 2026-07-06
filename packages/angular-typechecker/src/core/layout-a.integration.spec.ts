import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

import { evaluateResult } from './evaluate-result';
import { runTypecheck } from './run-typecheck';

// SB-01 (Phase 17, plan 17-06) -- REAL-compiler Layout-A proof. Layout A is the
// per-project Storybook scaffold: a project solution `tsconfig.json` referencing
// its app leaf AND a `.storybook/tsconfig.json` leaf that declares the project's
// own `*.stories.ts`. Layout A is ALREADY type-checked by the shipped
// reference-walk (D-08); this spec is the milestone's regression proof that the
// walk still type-checks the story surface end-to-end against actual Angular
// diagnostics.
//
// Covers the phase's success criteria:
//   - criterion 1(A): a BROKEN `*.stories.ts` FAILS the verdict; a CLEAN one PASSES.
//   - criterion 5: no Layout-A regression -- the shipped walk still represents and
//     type-checks the story surface (rootNamesCount > 0 AND the story error
//     surfaces on the story file).
//
// The stories are PLAIN Angular `.ts` (no `@storybook/angular` install), so the
// ONLY diagnostic is the planted TS2322. Cold-compiler timeout is inherited from
// vitest.config.mts (testTimeout 30000); do NOT add a per-file testTimeout.

const TS2322 = 2322;

const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

function fixtureTsConfig(name: string): string {
  return join(workspaceRoot, 'fixtures', name, 'tsconfig.json');
}

function codesOf(diagnostics: readonly ts.Diagnostic[]): number[] {
  return diagnostics.map((diagnostic) => diagnostic.code);
}

describe('layout-a: broken story fails + no walk regression (criteria 1(A) + 5)', () => {
  it('reports the broken story TS2322 on the story file and FAILS the verdict', async () => {
    const result = await runTypecheck({
      tsConfigPath: fixtureTsConfig('layout-a-storybook'),
    });

    // criterion 5 (no regression): the shipped walk still resolves the story
    // surface -- the `.storybook` leaf's declared rootNames enter the union, so the
    // summed rootNamesCount is non-zero. A regression that stopped walking the
    // story leaf would collapse this to 0.
    expect(result.rootNamesCount).toBeGreaterThan(0);

    // criterion 1(A) broken: exactly the one planted TS2322 survives the union
    // finalize.
    expect(result.errorCount).toBe(1);
    expect(codesOf(result.diagnostics)).toContain(TS2322);

    // The error is attributed to the STORY file (not the component), proving the
    // walk type-checked the story surface itself (criterion 5). The story is a
    // declared rootName of the `.storybook` leaf, so input-set membership KEEPs it.
    const storyErrors = result.diagnostics.filter(
      (diagnostic) =>
        diagnostic.code === TS2322 &&
        (diagnostic.file?.fileName ?? '').endsWith('button.stories.ts'),
    );

    expect(storyErrors).toHaveLength(1);

    // No first-party diagnostic was silently dropped: the story error is REPORTED,
    // not suppressed.
    expect(result.suppressedInGraphErrorCount).toBe(0);
    expect(result.suppressedInGraphWarningCount).toBe(0);

    // The verdict FAILS on the real type error.
    expect(evaluateResult(result).success).toBe(false);
  });
});

describe('layout-a: clean story passes (criterion 1(A) clean side)', () => {
  it('reports zero errors, zero in-graph suppressions, and PASSES', async () => {
    const result = await runTypecheck({
      tsConfigPath: fixtureTsConfig('layout-a-storybook-clean'),
    });

    // The story surface is still walked (rootNames non-zero) -- a clean PASS is a
    // genuinely-checked pass, not a vacuous "0 files" one.
    expect(result.rootNamesCount).toBeGreaterThan(0);

    expect(result.errorCount).toBe(0);
    expect(result.suppressedInGraphErrorCount).toBe(0);

    const verdict = evaluateResult(result);

    expect(verdict.success).toBe(true);
    expect(verdict.outcome).toBe('clean');
  });
});
