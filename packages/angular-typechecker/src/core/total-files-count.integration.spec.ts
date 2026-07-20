import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

import { runTypecheck } from './run-typecheck';

// OBS-01 / VER-01 (Phase 30, D-11): REAL-compiler proof that
// `CoreResult.totalFilesCount` is the name-DEDUPED count of non-declaration source
// files the walk actually processed. The `solution-style-overlap` fixture is a
// GENUINE solution tsconfig referencing tsconfig.lib.json + tsconfig.spec.json, and
// BOTH leaves list the SAME `shared.component.ts` -- so it is compiled in two
// separate Programs (this is the same fixture walk-references.integration.spec.ts
// uses to prove cross-Program diagnostic dedupe). The Set<string> name-dedupe
// (walk-references.ts `gatherLeafInto` -> `finalizeUnion`) must count that shared
// file EXACTLY ONCE.
//
// A dedupe regression (a naive per-leaf SUM) would count `shared.component.ts`
// twice and yield a strictly LARGER number, so the EXACT-literal assertion below IS
// the dedupe proof. `>= rootNamesCount` is deliberately NOT used: it passes whether
// or not dedupe works. A single-leaf / direct-path tsconfig is deliberately NOT
// used either -- it takes the DIRECT path and never exercises the walk `Set`-dedupe.
//
// Cold-compiler timeout is inherited from vitest.integration.config.mts
// (testTimeout 30000); do NOT add a per-file testTimeout.

const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

function fixtureTsConfig(name: string): string {
  return join(workspaceRoot, 'fixtures', name, 'tsconfig.json');
}

describe('totalFilesCount walk-path name-dedupe (solution-style-overlap)', () => {
  it('counts the doubly-compiled shared.component.ts EXACTLY once across both leaves', async () => {
    const result = await runTypecheck({
      tsConfigPath: fixtureTsConfig('solution-style-overlap'),
    });

    // EXACT deduped literal (determined by running the fixture, not guessed): the
    // ONLY authored non-declaration source file each leaf's Program carries is
    // `shared.component.ts`. Its Angular-generated `shared.component.ngtypecheck.ts`
    // TCB shim is a non-declaration `.ts`, but WR-01 excludes `.ngtypecheck.ts` shims
    // from the count (they are compiler-internal, not authored source), so it does NOT
    // contribute. BOTH leaves compile the SAME `shared.component.ts` at the SAME path
    // (the sibling walk-references.integration.spec.ts dedupe-collapse test proves that
    // shared path identity), so the authored file carries an identical fileName across
    // the two leaves and the name-deduped Set collapses it to ONE -> 1. A dedupe
    // regression (a naive per-leaf SUM) would count it twice and yield 2 -- strictly
    // larger -- so this exact-literal assertion IS the dedupe proof. `>= rootNamesCount`
    // is deliberately avoided (it passes whether or not dedupe works).
    expect(result.totalFilesCount).toBe(1);
  });
});
