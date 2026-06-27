import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { NG } from './diagnostic-codes';
import { runTypecheck } from './run-typecheck';

// TEST-02 -- baseline diagnostics introduced at/before Angular v13 (the
// TypeScript template-driven case + an NG baseline), asserted against the REAL
// compiler via `runTypecheck` directly (D-07c: one performCompilation per
// fixture). Files are organized per Angular INTRODUCTION version so the full
// v13->v22 catalog is purely additive later (D-07a). TS codes assert RAW; NG
// codes assert via the NG() helper, never bare (L-4 / Pitfall E).
//
// Codes (re-verified against installed @angular/compiler-cli@22.0.4):
//   - TS2339 = 2339              (raw; "Property 'X' does not exist on type 'Y'")
//   - NG8001 = SCHEMA_INVALID_ELEMENT (error_code.d.ts:238) -> NG(8001) = -998001

const TS2339 = 2339;

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspaceRoot = join(packageRoot, '..', '..');

const tsBaselineTsConfig = join(
  workspaceRoot,
  'fixtures',
  'ts-baseline',
  'tsconfig.app.json',
);
const ngBaselineTsConfig = join(
  workspaceRoot,
  'fixtures',
  'ng-baseline',
  'tsconfig.app.json',
);

describe('baseline diagnostics (Angular v13 introduction set)', () => {
  it('ts-baseline: a template referencing a missing member surfaces TS2339 (raw) and counts as an error', async () => {
    const result = await runTypecheck({ tsConfigPath: tsBaselineTsConfig });

    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);

    expect(codes).toContain(TS2339);
    expect(result.errorCount).toBeGreaterThanOrEqual(1);
  });

  it('ng-baseline: an unknown element surfaces NG8001 (-998001) and counts as an error', async () => {
    const result = await runTypecheck({ tsConfigPath: ngBaselineTsConfig });

    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);

    expect(codes).toContain(NG(8001));
    expect(result.errorCount).toBeGreaterThanOrEqual(1);
  });
});
