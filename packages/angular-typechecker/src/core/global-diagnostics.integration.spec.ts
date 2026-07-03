import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

import { runTypecheck } from './run-typecheck';

// REAL-compiler proof of COR-02 (D-04): a GLOBAL / location-less TypeScript
// diagnostic surfaces through the ENGINE. The global-diagnostics fixture sets
// `noLib: true` + `types: []`, so the `Array` global type is unavailable and the
// compiler emits a raw TS2318 ("Cannot find global type 'Array'"). That
// diagnostic is produced ONLY by `getTsProgram().getGlobalDiagnostics()` -- the
// per-file `getTsSemanticDiagnostics` path returns [] for it -- so the seventh
// getter added in gather-diagnostics.ts is what makes it appear in
// `result.diagnostics`. Pre-fix (the 6-getter gatherer) this set was EMPTY.
//
// This is a dedicated file (separate from run-typecheck.integration.spec.ts) so
// this plan owns disjoint files for wave parallelism. The TS2318 set is file-less,
// so the boundary filter always keeps it (COR-02 + the file-less rule cooperate).

// TS2318 is a RAW TypeScript code (positive). It is NOT an Angular extended code,
// so it is asserted directly, never via the negative NG() encoding.
const TS2318 = 2318;

const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

const globalDiagnosticsTsConfig = join(
  workspaceRoot,
  'fixtures',
  'global-diagnostics',
  'tsconfig.json',
);

describe('runTypecheck global diagnostics (global-diagnostics fixture)', () => {
  it('COR-02: surfaces a global TS2318 the per-file getTsSemanticDiagnostics never emits', async () => {
    const result = await runTypecheck({
      tsConfigPath: globalDiagnosticsTsConfig,
    });

    // The global TS2318 reaches the reported set ONLY through the seventh
    // getter (getTsProgram().getGlobalDiagnostics). Pre-fix this assertion
    // FAILS -- the 6-getter gatherer returns no global diagnostics.
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      TS2318,
    );
  });
});
