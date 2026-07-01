import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { NG } from './diagnostic-codes';
import { EXTENDED_DIAGNOSTIC_MEMBERS } from './extended-catalog.members';
import { runTypecheck } from './run-typecheck';

// CAT-01 / CAT-02 / CAT-04 (D-03..D-09) -- the SINGLE data-driven extended-diagnostic
// catalog of record. One `describe.each` row per `ExtendedTemplateDiagnosticName`
// member (keyed on EXTENDED_DIAGNOSTIC_MEMBERS, the D-02 source of truth), each row
// asserting the diagnostic by EXACT NG() code + `ts.DiagnosticCategory` + occurrence
// count against the real @angular/compiler-cli@22.0.4 over committed fixtures, plus
// the ONE NG8101 severity-promotion proof (D-08).
//
// This spec FOLDS and REPLACES two former specs (D-07, deleted in the same plan):
//   - extended.angular13.integration.spec.ts  -> the NG8101 Warning-default row below.
//   - extended.promotion.integration.spec.ts   -> the NG8101 promotion `it` + the
//     `errorCount + warningCount <= diagnostics.length` invariant below.
// There is now ONE catalog of record; no duplicate NG8101 assertion can drift.
//
// DISCIPLINE (from the existing integration specs + diagnostic-codes.ts header):
//   - Every NG assertion routes through `NG()` (NG(8101) === -998101); never a bare
//     positive code (L-4 / Pitfall E).
//   - Counting is ALWAYS by `ts.DiagnosticCategory`, never by code sign.
//   - Each fixture is engineered so its target diagnostic is the ONLY diagnostic, so
//     the exact-count assertion (`.filter(...).length === expectedCount`) is
//     deterministic. The one exception is the gate-b-error-backed NG8109 row, whose
//     fixture ALSO carries a deliberate TS2322 by design -- that row asserts ONLY its
//     filtered NG8109 count/category and does NOT assert `errorCount === 0`.
//
// CORRECTNESS GUARD (D-09 CORRECTED 2026-07-01, triple-verified docs+source+runtime):
// NG8011 (`controlFlowPreventingContentProjection`) IS promotable. Its row below is a
// NORMAL Warning-default member (default `ts.DiagnosticCategory.Warning`). It is NOT
// `it.skip`-ped, NOT framed as "not promotable", and NO assertion anywhere expects it
// to stay a Warning under `defaultCategory: "error"`.

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspaceRoot = join(packageRoot, '..', '..');

/**
 * Resolves the `tsconfig.app.json` of a committed fixture under the workspace-root
 * `fixtures/` tree (cwd-independent; mirrors the resolver every integration spec
 * uses, extended.angular13.integration.spec.ts:22-30).
 */
function fixtureTsConfig(scenario: string): string {
  return join(workspaceRoot, 'fixtures', scenario, 'tsconfig.app.json');
}

/**
 * One catalog row per `ExtendedTemplateDiagnosticName` member (D-04).
 *
 * `member` is typed as `(typeof EXTENDED_DIAGNOSTIC_MEMBERS)[number]` (the D-02
 * source-of-truth union) so a member rename/removal upstream forces a COMPILE error
 * in this table too -- not just in the type-level drift tripwire.
 *
 * `introVersion` is carried as a ROW FIELD (CAT-04) -- the catalog is a single
 * enum-keyed table, NOT a per-introduction-version file split. Values are the
 * authoritative introduction majors from .planning/research/DIAGNOSTIC-CATALOG.md.
 *
 * `skipReason`, when present, turns the row's `it` into `it.skip` WITH A WRITTEN
 * REASON while KEEPING the row in the table (the completeness tripwire consumes the
 * LIST, not the test outcome). RESEARCH projects ZERO skips -- confirmed by a real
 * run: all 18 members fire from a static fixture -- but the gate exists so a future
 * non-reproducible member stays honestly represented.
 */
interface CatalogRow {
  member: (typeof EXTENDED_DIAGNOSTIC_MEMBERS)[number];
  ngCode: number;
  expectedCategory: ts.DiagnosticCategory;
  expectedCount: number;
  introVersion: string;
  fixtureTsConfig: string;
  skipReason?: string;
}

// One row per member, in EXTENDED_DIAGNOSTIC_MEMBERS (enum declaration) order.
// Every expectedCount + expectedCategory was proven by a real `runTypecheck` run
// against the committed fixture before this table was committed (RESEARCH A1).
const CATALOG: readonly CatalogRow[] = [
  {
    member: 'invalidBananaInBox',
    ngCode: 8101,
    expectedCategory: ts.DiagnosticCategory.Warning,
    expectedCount: 1,
    introVersion: 'v13',
    fixtureTsConfig: fixtureTsConfig('extended-v13'),
  },
  {
    member: 'nullishCoalescingNotNullable',
    ngCode: 8102,
    expectedCategory: ts.DiagnosticCategory.Warning,
    expectedCount: 1,
    introVersion: 'v13',
    fixtureTsConfig: fixtureTsConfig('extended-batch-expression'),
  },
  {
    member: 'optionalChainNotNullable',
    ngCode: 8107,
    expectedCategory: ts.DiagnosticCategory.Warning,
    expectedCount: 1,
    introVersion: 'v14',
    fixtureTsConfig: fixtureTsConfig('extended-batch-expression'),
  },
  {
    member: 'missingControlFlowDirective',
    ngCode: 8103,
    expectedCategory: ts.DiagnosticCategory.Warning,
    expectedCount: 1,
    introVersion: 'v14',
    fixtureTsConfig: fixtureTsConfig('extended-batch-structural'),
  },
  {
    member: 'missingStructuralDirective',
    ngCode: 8116,
    expectedCategory: ts.DiagnosticCategory.Warning,
    expectedCount: 1,
    introVersion: 'v19',
    fixtureTsConfig: fixtureTsConfig('extended-batch-structural'),
  },
  {
    member: 'textAttributeNotBinding',
    ngCode: 8104,
    expectedCategory: ts.DiagnosticCategory.Warning,
    expectedCount: 1,
    introVersion: 'v14',
    fixtureTsConfig: fixtureTsConfig('extended-batch-expression'),
  },
  {
    member: 'uninvokedFunctionInEventBinding',
    ngCode: 8111,
    expectedCategory: ts.DiagnosticCategory.Warning,
    expectedCount: 1,
    introVersion: 'v18',
    fixtureTsConfig: fixtureTsConfig('extended-batch-fn'),
  },
  {
    member: 'missingNgForOfLet',
    ngCode: 8105,
    expectedCategory: ts.DiagnosticCategory.Warning,
    expectedCount: 1,
    introVersion: 'v14',
    // D-03 split: a bare `*ngFor` without CommonModule co-fires NG8103, so NG8105
    // lives in its own program (CommonModule imported) for a clean count.
    fixtureTsConfig: fixtureTsConfig('extended-ngfor-let'),
  },
  {
    member: 'suffixNotSupported',
    ngCode: 8106,
    expectedCategory: ts.DiagnosticCategory.Warning,
    expectedCount: 1,
    introVersion: 'v14',
    fixtureTsConfig: fixtureTsConfig('extended-batch-expression'),
  },
  {
    member: 'skipHydrationNotStatic',
    ngCode: 8108,
    expectedCategory: ts.DiagnosticCategory.Warning,
    expectedCount: 1,
    introVersion: 'v16',
    fixtureTsConfig: fixtureTsConfig('extended-skip-hydration'),
  },
  {
    member: 'interpolatedSignalNotInvoked',
    ngCode: 8109,
    expectedCategory: ts.DiagnosticCategory.Warning,
    expectedCount: 1,
    introVersion: 'v17',
    // Reused fixture: gate-b-error ALSO carries a deliberate TS2322 by design, so
    // this row asserts ONLY its filtered NG8109 count/category (never errorCount).
    fixtureTsConfig: fixtureTsConfig('gate-b-error'),
  },
  {
    member: 'controlFlowPreventingContentProjection',
    ngCode: 8011,
    // CORRECTNESS GUARD (D-09): a NORMAL promotable Warning-default member. NOT
    // skipped, NOT "not promotable".
    expectedCategory: ts.DiagnosticCategory.Warning,
    expectedCount: 1,
    introVersion: 'v17',
    fixtureTsConfig: fixtureTsConfig('extended-content-projection'),
  },
  {
    member: 'unusedLetDeclaration',
    ngCode: 8112,
    expectedCategory: ts.DiagnosticCategory.Warning,
    expectedCount: 1,
    introVersion: 'v18',
    fixtureTsConfig: fixtureTsConfig('extended-batch-fn'),
  },
  {
    member: 'uninvokedTrackFunction',
    ngCode: 8115,
    expectedCategory: ts.DiagnosticCategory.Warning,
    expectedCount: 1,
    introVersion: 'v20',
    fixtureTsConfig: fixtureTsConfig('extended-batch-fn'),
  },
  {
    member: 'unusedStandaloneImports',
    ngCode: 8113,
    expectedCategory: ts.DiagnosticCategory.Warning,
    expectedCount: 1,
    introVersion: 'v19',
    fixtureTsConfig: fixtureTsConfig('extended-unused-standalone-imports'),
  },
  {
    member: 'unparenthesizedNullishCoalescing',
    ngCode: 8114,
    expectedCategory: ts.DiagnosticCategory.Warning,
    expectedCount: 1,
    introVersion: 'v20',
    fixtureTsConfig: fixtureTsConfig('extended-batch-expression'),
  },
  {
    member: 'uninvokedFunctionInTextInterpolation',
    ngCode: 8117,
    expectedCategory: ts.DiagnosticCategory.Warning,
    expectedCount: 1,
    introVersion: 'v20',
    fixtureTsConfig: fixtureTsConfig('extended-batch-expression'),
  },
  {
    member: 'deferTriggerMisconfiguration',
    ngCode: 8021,
    expectedCategory: ts.DiagnosticCategory.Warning,
    expectedCount: 1,
    introVersion: 'v21',
    fixtureTsConfig: fixtureTsConfig('extended-defer-trigger'),
  },
];

// A build-time guard that the table stays in lockstep with the source-of-truth
// list: exactly one row per member, and every member present. This is the runtime
// twin of the type-level completeness tripwire (extended-catalog.drift.ts).
describe('extended-diagnostic catalog (structure)', () => {
  it('has exactly one row per EXTENDED_DIAGNOSTIC_MEMBERS entry, in declaration order', () => {
    expect(CATALOG.map((row) => row.member)).toEqual([
      ...EXTENDED_DIAGNOSTIC_MEMBERS,
    ]);
  });
});

describe.each(CATALOG)(
  'extended diagnostic $member (NG$ngCode, introduced $introVersion)',
  (row) => {
    // D-05 / CAT-04: a row with a `skipReason` becomes `it.skip` WITH THE REASON,
    // but STAYS in CATALOG (the tripwire consumes the list, not the outcome).
    const maybe = row.skipReason ? it.skip : it;

    maybe(
      `fires NG${row.ngCode} exactly ${row.expectedCount} time(s) at the expected category${
        row.skipReason ? ` (skipped: ${row.skipReason})` : ''
      }`,
      async () => {
        const result = await runTypecheck({ tsConfigPath: row.fixtureTsConfig });

        const hits = result.diagnostics.filter(
          (diagnostic) => diagnostic.code === NG(row.ngCode),
        );

        // CAT-01: EXACT occurrence count by the negative-encoded NG code...
        expect(hits.length).toBe(row.expectedCount);
        // ...and the category by `ts.DiagnosticCategory` (never by code sign).
        expect(hits[0]?.category).toBe(row.expectedCategory);
      },
    );
  },
);

// CAT-02 / D-08 -- the SINGLE severity-promotion proof (folds
// extended.promotion.integration.spec.ts). The extended-promoted fixture carries
// the SAME NG8101 shape as extended-v13 but its tsconfig sets
// `extendedDiagnostics.defaultCategory: "error"`, which auto-promotes the SAME code
// from its default Warning into a hard Error. No per-member promotion tests (YAGNI).
describe('extended-diagnostic catalog (severity promotion, CAT-02)', () => {
  const promotedTsConfig = fixtureTsConfig('extended-promoted');

  it('defaultCategory "error" promotes NG8101 from Warning to an Error counted in errorCount', async () => {
    const result = await runTypecheck({ tsConfigPath: promotedTsConfig });

    const promoted = result.diagnostics.find(
      (diagnostic) => diagnostic.code === NG(8101),
    );

    expect(promoted).toBeDefined();
    expect(promoted?.category).toBe(ts.DiagnosticCategory.Error);
    expect(result.errorCount).toBeGreaterThanOrEqual(1);
  });

  it('upholds the D-01 count invariant errorCount + warningCount <= diagnostics.length', async () => {
    const result = await runTypecheck({ tsConfigPath: promotedTsConfig });

    expect(result.errorCount + result.warningCount).toBeLessThanOrEqual(
      result.diagnostics.length,
    );
  });
});
