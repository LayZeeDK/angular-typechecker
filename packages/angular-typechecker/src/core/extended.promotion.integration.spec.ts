import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { NG } from './diagnostic-codes';
import { runTypecheck } from './run-typecheck';

// TEST-02 / ENG-04 / D-01 -- the category-PROMOTION proof. The extended-promoted
// fixture carries the SAME extended-diagnostic shape as extended-v13 (NG8101,
// INVALID_BANANA_IN_BOX) but its tsconfig sets
// `angularCompilerOptions.extendedDiagnostics.defaultCategory: "error"`, which
// auto-promotes the SAME code from its default WARNING into a hard Error. This
// proves the engine counts by `.category` (not by code sign / L-4): the promoted
// diagnostic now lands in errorCount, and the D-01 invariant
// (errorCount + warningCount <= diagnostics.length) holds.
//
// IN-01: this spec proves the extended-diagnostic category-promotion mechanism,
// which is VERSION-INDEPENDENT -- it is NOT a claim that NG8101 (or any code) was
// introduced in a specific Angular version. It is asserted against the portable
// NG8101 shape. (Renamed from `extended.angular17.integration.spec.ts`, whose
// `angular17` signal was false: it carried no v17-specific code and there is no
// `fixtures/extended-v17/` tree. Genuine per-version extended-code coverage is
// separate, future feature work.)

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspaceRoot = join(packageRoot, '..', '..');

const extendedPromotedTsConfig = join(
  workspaceRoot,
  'fixtures',
  'extended-promoted',
  'tsconfig.app.json',
);

describe('extended diagnostics (category promotion proof)', () => {
  it('extended-promoted: defaultCategory "error" promotes the SAME extended code (NG8101) to an Error counted in errorCount', async () => {
    const result = await runTypecheck({
      tsConfigPath: extendedPromotedTsConfig,
    });

    const promoted = result.diagnostics.find(
      (diagnostic) => diagnostic.code === NG(8101),
    );

    expect(promoted).toBeDefined();
    expect(promoted?.category).toBe(ts.DiagnosticCategory.Error);
    expect(result.errorCount).toBeGreaterThanOrEqual(1);
  });

  it('upholds the D-01 count invariant errorCount + warningCount <= diagnostics.length', async () => {
    const result = await runTypecheck({
      tsConfigPath: extendedPromotedTsConfig,
    });

    expect(result.errorCount + result.warningCount).toBeLessThanOrEqual(
      result.diagnostics.length,
    );
  });
});
