import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { NG } from './diagnostic-codes';
import { runTypecheck } from './run-typecheck';

// TEST-02 / ENG-04 -- the v13-introduced EXTENDED diagnostic NG8101
// (INVALID_BANANA_IN_BOX, "invalidBananaInBox") defaults to category WARNING. The
// extended-v13 fixture sets `strictTemplates: true` with NO
// `extendedDiagnostics.defaultCategory` override, so the diagnostic lands in
// warningCount and NOT errorCount. Mirrors Angular's own
// invalid_banana_in_box_spec.ts idiom: find the diagnostic by exact code, assert
// its `.category`. Counting is by `.category`, never by code sign (L-4).
//
// NG8101 verified = 8101 in installed @angular/compiler-cli@22.0.4
// error_code.d.ts:394; on the extended path per
// extended_template_diagnostic_name.d.ts -> "invalidBananaInBox".

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspaceRoot = join(packageRoot, '..', '..');

const extendedV13TsConfig = join(
  workspaceRoot,
  'fixtures',
  'extended-v13',
  'tsconfig.app.json',
);

describe('extended diagnostics (Angular v13 introduction set)', () => {
  it('extended-v13: NG8101 (invalid banana-in-box) is a WARNING by default and is counted in warningCount, not errorCount', async () => {
    const result = await runTypecheck({ tsConfigPath: extendedV13TsConfig });

    const banana = result.diagnostics.find(
      (diagnostic) => diagnostic.code === NG(8101),
    );

    expect(banana).toBeDefined();
    expect(banana?.category).toBe(ts.DiagnosticCategory.Warning);
    expect(result.warningCount).toBeGreaterThanOrEqual(1);
    expect(result.errorCount).toBe(0);
  });
});
