import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

import { NG } from './diagnostic-codes';
import { renderReport } from './render-report';
import { runTypecheck } from './run-typecheck';

// HARD-05 / D-11 -- the TS-99 leak regression.
//
// Angular encodes its extended-diagnostic codes NEGATIVELY on `ts.Diagnostic.code`
// (`ngErrorCode(8101) === -998101`; STATE [01-03]). TypeScript's own diagnostic
// formatter renders that raw negative code as the literal `TS-998101` (a LEAK of a
// raw, un-rewritten negative NG code). The REAL `@angular/compiler-cli` formatter
// instead rewrites `TS-998101` to `NG8101` internally via Angular's TS-to-NG
// error-code rewrite.
//
// This regression guards a RUNTIME rewrite, not a type or config. The rewrite is
// Angular's own (the TS-to-NG rewrite helper is DECLARED in `index.d.ts` but NOT
// exported from the runtime bundle -- `typeof cli[that helper] === 'undefined'`,
// verified). So the spec MUST route through the REAL compiler-cli formatter,
// reached here via the `renderReport` seam (render-report.ts:61-73 ->
// loadCompilerCli -> the rewrite path). A TypeScript-formatter fake (or a mocked
// formatter) does NOT run the rewrite and would pass VACUOUSLY while production
// leaks `TS-998101` (10-RESEARCH Pitfall 2). The TypeScript-formatter fake used in
// `format-report.spec.ts:62` is for OTHER assertions -- it is deliberately NOT
// copied here.
//
// The diagnostics are produced by a REAL NG8xxx fixture (`extended-promoted`,
// which carries NG8101 as an Error -- 10-RESEARCH A3), not a hand-built diagnostic
// with a fabricated negative code, so the rewrite runs against genuine compiler
// output.

const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

const extendedPromotedTsConfig = join(
  workspaceRoot,
  'fixtures',
  'extended-promoted',
  'tsconfig.app.json',
);

describe('TS-99 leak regression (HARD-05 / D-11)', () => {
  it('renders an NG#### label and NO TS-99 substring on the color:false path', async () => {
    // A REAL NG8xxx producer: the extended-promoted fixture surfaces NG8101 as an
    // Error through `result.diagnostics` (extended.promotion.integration.spec.ts
    // proves NG(8101) is present). Assert the NG code SYMBOLICALLY via `NG(8101)`
    // -- never the bare `8101`, which would never match the negative-encoded
    // `ts.Diagnostic.code` (-998101).
    const result = await runTypecheck({
      tsConfigPath: extendedPromotedTsConfig,
    });

    expect(
      result.diagnostics.some((diagnostic) => diagnostic.code === NG(8101)),
    ).toBe(true);

    // Render through the REAL `cli.formatDiagnostics` (the renderReport seam loads
    // it); `color: false` is the ANSI-strip output path agents / CI / pipes use.
    const out = await renderReport(
      { diagnostics: result.diagnostics },
      { color: false },
    );

    // Positive: an NG#### label rendered (proves the rewrite ran, not a vacuous
    // pass on empty output).
    expect(out).toMatch(/NG\d{4}/);

    // Negative: no raw, un-rewritten negative NG code (`TS-998101` etc.) survives.
    expect(out).not.toContain('TS-99');
  });
});
