import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

import { ZERO_ROOT_NAMES_DIAGNOSTIC_CODE } from './diagnostic-codes';
import { evaluateResult } from './evaluate-result';
import { runTypecheck } from './run-typecheck';

// SB-06 T6 (board D-7 "ONE guard test", Phase 18, plan 18-02) -- REAL-compiler
// proof that a story-less / flat config is NEVER a silent clean pass. The fixture
// is a flat tsconfig (no `references`, no `files`) whose `include` globs for
// `*.stories.ts` in a dir that contains none, so `readConfiguration` resolves ZERO
// declared input files.
//
// A zero-declared-files run MUST surface a deterministic non-zero signal, never a
// vacuous "0 files checked -> clean". The flat (no-references) path synthesizes the
// empty-project ZERO_ROOT_NAMES guard (90001, an Error), so the verdict FAILS.
// (The references-only variant instead yields `outcome === 'coverage-incomplete';
// this fixture is the direct-flat shape, so it asserts the 90001 guard.)
//
// Cold-compiler timeout is inherited from vitest.config.mts (testTimeout 30000);
// do NOT add a per-file testTimeout.

const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

function fixtureTsConfig(name: string): string {
  return join(workspaceRoot, 'fixtures', name, 'tsconfig.json');
}

describe('story-less-guard: a flat config resolving zero declared files is not a silent clean pass (D-7 guard)', () => {
  it('fires the ZERO_ROOT_NAMES (90001) guard and FAILS the verdict', async () => {
    const result = await runTypecheck({
      tsConfigPath: fixtureTsConfig('story-less-flat'),
    });

    // The flat config declared nothing: zero rootNames materialized.
    expect(result.rootNamesCount).toBe(0);

    // The direct-flat (no-references) path synthesizes the empty-project guard --
    // a deterministic 90001 Error, never a silent drop.
    expect(
      result.diagnostics.some(
        (diagnostic) => diagnostic.code === ZERO_ROOT_NAMES_DIAGNOSTIC_CODE,
      ),
    ).toBe(true);

    // The verdict is non-clean: the guard Error means the run did NOT check what a
    // story tsconfig would be expected to check.
    expect(evaluateResult(result).success).toBe(false);
  });
});
