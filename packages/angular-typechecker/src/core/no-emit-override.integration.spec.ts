import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { runTypecheck } from './run-typecheck';

// TEST-02 / D-05 / L-1 / D-02 -- proves the engine's emit-neutralizing override
// behaves correctly on the two no-emit-related risks:
//
//   1. D-05 / L-1 (composite triangle): a fixture tsconfig that DELIBERATELY sets
//      `composite: true` + `declarationMap: true` + `emitDeclarationOnly: true`
//      would, WITHOUT the override, make TypeScript report the bogus option-
//      conflict triangle TS5053 / TS6304 / TS6379. The override (with
//      `composite: false` as the gatekeeper) neutralizes all three. ROADMAP
//      criterion 1.
//   2. D-02 (Time-for-diagnostics Message): a fixture tsconfig that sets
//      `diagnostics: true` would drive performCompilation to push a category-
//      Message "Time for diagnostics: ..." entry. The override forces
//      `diagnostics: false`, so no such entry is present (A2: the absence holds
//      regardless, since the engine never enables it).
//
// TS codes are RAW (no NG() encoding) -- 5053 / 6304 / 6379 are TypeScript codes.

const TS5053 = 5053;
const TS6304 = 6304;
const TS6379 = 6379;

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspaceRoot = join(packageRoot, '..', '..');

const compositeTriangleTsConfig = join(
  workspaceRoot,
  'fixtures',
  'composite-triangle',
  'tsconfig.json',
);
const noEmitMessageTsConfig = join(
  workspaceRoot,
  'fixtures',
  'no-emit-message',
  'tsconfig.app.json',
);

describe('no-emit override (D-05 composite triangle + D-02 diagnostics Message)', () => {
  it('composite-triangle: the override neutralizes TS5053 / TS6304 / TS6379 (none present)', async () => {
    const result = await runTypecheck({
      tsConfigPath: compositeTriangleTsConfig,
    });

    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);

    expect(codes).not.toContain(TS5053);
    expect(codes).not.toContain(TS6304);
    expect(codes).not.toContain(TS6379);
  });

  it('no-emit-message: no "Time for diagnostics" category-Message entry survives the diagnostics:false override', async () => {
    const result = await runTypecheck({ tsConfigPath: noEmitMessageTsConfig });

    const timeForDiagnosticsMessage = result.diagnostics.find(
      (diagnostic) =>
        diagnostic.category === ts.DiagnosticCategory.Message &&
        typeof diagnostic.messageText === 'string' &&
        diagnostic.messageText.includes('Time for diagnostics'),
    );

    expect(timeForDiagnosticsMessage).toBeUndefined();
  });
});
