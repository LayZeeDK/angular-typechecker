import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

import { evaluateResult } from './evaluate-result';
import { runTypecheck } from './run-typecheck';

// D-09.2 + D-09a(i)(iii) MANDATORY tripwires (Phase 17 board), proven against the
// REAL @angular/compiler-cli (cold `performCompilation`), version-pinned to
// Angular 22.0.4 / TS 6.0.3. Two invariants the input-set boundary rests on but
// neither TypeScript nor Angular documents:
//
//   (D-09.2 / D-09a iii) An EXTERNAL `templateUrl` `.html` diagnostic attributes to
//   the `.html` AND carries a `ts.Diagnostic.relatedInformation` entry pointing at
//   the owning component `.ts` (spike 008, G5). Branch 4a (filter-diagnostics.ts)
//   maps `.html` -> owning `.ts` through that PUBLIC signal. If a future Angular
//   flips attribution back to the `.ts`, or stops attaching the `.ts`
//   relatedInformation, this tripwire fails LOUD -- otherwise the boundary filter
//   could silently drop a real external-template error (a false PASS). The same run
//   proves the `.html` diagnostic is KEPT in the reported set (never dropped).
//
//   (D-09a i) A CLEAN host that uses an external `.html` template AND an inline
//   template reports `suppressedInGraphErrorCount === 0 &&
//   suppressedInGraphWarningCount === 0` -- the D-04a base clause classifies the
//   host's own external/inline templates in-graph, so a clean host never yields a
//   false coverage-incomplete verdict.
//
// Cold-compiler timeout is inherited from vitest.config.mts (testTimeout 30000); do
// NOT add a per-file testTimeout (Pitfall 5).

const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);
const externalTemplateTripwireTsConfig = join(
  workspaceRoot,
  'fixtures',
  'external-template-tripwire',
  'tsconfig.app.json',
);
const cleanTemplateHostTsConfig = join(
  workspaceRoot,
  'fixtures',
  'clean-template-host',
  'tsconfig.app.json',
);

describe('runTypecheck external-template attribution tripwire (D-09.2 / D-09a iii)', () => {
  it('the external-template NG diagnostic carries a .ts relatedInformation AND is KEPT (not dropped)', async () => {
    const result = await runTypecheck({
      tsConfigPath: externalTemplateTripwireTsConfig,
    });

    // The fixture genuinely produced its external-template error (not a vacuous
    // pass): the NG8002 is a hard Error.
    expect(result.errorCount).toBeGreaterThanOrEqual(1);

    // The template diagnostic attributes to the `.html` (spike 008 G1 = html) and
    // is present in the reported set -- neither the shim nor the external template
    // is silently dropped by the boundary filter (D-09a iii). The `.html` is kept
    // because it lives under the leaf base dir (D-04a base clause).
    const htmlDiagnostics = result.diagnostics.filter((diagnostic) =>
      (diagnostic.file?.fileName ?? '').endsWith('.html'),
    );

    expect(htmlDiagnostics.length).toBeGreaterThanOrEqual(1);

    const htmlDiagnostic = htmlDiagnostics[0];

    // D-09.2 THE attribution tripwire: the `.html`-attributed diagnostic carries a
    // relatedInformation array with an entry whose file ends in `.ts` -- the owning
    // component source branch 4a resolves. A future attribution flip / dropped
    // relatedInformation breaks this LOUD.
    expect(htmlDiagnostic.relatedInformation).toBeDefined();
    expect(
      (htmlDiagnostic.relatedInformation ?? []).some((info) =>
        (info.file?.fileName ?? '').endsWith('.ts'),
      ),
    ).toBe(true);

    // Sharper pin: the owning `.ts` is specifically this fixture's component, not
    // some unrelated `.ts` -- so the ownership signal points where branch 4a needs.
    expect(
      (htmlDiagnostic.relatedInformation ?? []).some((info) =>
        (info.file?.fileName ?? '').endsWith('error-template.component.ts'),
      ),
    ).toBe(true);
  });
});

describe('runTypecheck clean-host base-clause tripwire (D-09a i)', () => {
  it('a clean host with an external .html AND an inline template reports suppressedInGraph == 0', async () => {
    const result = await runTypecheck({
      tsConfigPath: cleanTemplateHostTsConfig,
    });

    // Genuinely clean: no errors, no warnings on either template.
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);

    // D-09a(i): the host's OWN external `.html` and inline template are classified
    // in-graph via the D-04a base clause -- never counted as suppressed-out-of-graph.
    // A regression that dropped them would make these counters non-zero and flip the
    // clean host to a false coverage-incomplete.
    expect(result.suppressedInGraphErrorCount).toBe(0);
    expect(result.suppressedInGraphWarningCount).toBe(0);

    // The end-to-end verdict is clean (no false coverage-incomplete).
    expect(evaluateResult(result)).toEqual({
      success: true,
      outcome: 'clean',
    });
  });
});
