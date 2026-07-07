import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

import { NG, ZERO_ROOT_NAMES_DIAGNOSTIC_CODE } from './diagnostic-codes';
import { evaluateResult } from './evaluate-result';
import { runTypecheck } from './run-typecheck';

// SB-03 (Phase 17, plan 17-06) -- REAL-compiler Layout-B proof. Layout B is the
// centralized `one-storybook-for-all` host: the host solution `tsconfig.json`
// references ONLY `./.storybook/tsconfig.json`, whose widened `include` reaches
// cross-project files OUTSIDE the host dir (an aggregated `*.stories.ts`, an
// aggregated `*.component.ts` with an EXTERNAL `templateUrl`, and its `.html`).
// Layout B is delivered PURELY by the SB-02 input-set-membership boundary change
// (no Storybook-specific code). This spec proves the WHOLE pipeline
// (walk -> inputTs union -> keep -> split counter -> coverage-incomplete verdict)
// against actual Angular diagnostics.
//
// Covers the phase's success criteria:
//   - criterion 1(B): a BROKEN aggregated `*.stories.ts` FAILS the verdict.
//   - criterion 2 (the kill-shot): an aggregated external-`templateUrl` NG8002
//     FAILS with its `.html` codeframe + `.ts` relatedInformation owner (branch
//     4a kept it -- a naive rootNames-only filter would silently drop it because
//     `.html` is never a rootName).
//   - criterion 3 (isolation, R1): a transitively-imported DEPENDENCY's internal
//     error is NEVER reported (content isolation) BUT increments
//     `suppressedInGraphErrorCount` and the verdict is non-clean (coverage-
//     incomplete, NOT a false PASS).
//   - criterion 4: a fully clean Layout-B host -- incl. its clean external
//     template -- reports `suppressedInGraphErrorCount === 0 &&
//     suppressedInGraphWarningCount === 0` and PASSES.
//
// Fixtures are PLAIN Angular (no `@storybook/angular` install). NG codes are
// negative-encoded (`NG(8002) === -998002`). Cold-compiler timeout is inherited
// from vitest.config.mts (testTimeout 30000); do NOT add a per-file testTimeout.

const TS2322 = 2322;
const NG8002 = NG(8002);
// The dependency's INTERNAL error code (`box.missing` -> TS2339). Distinct from
// the story's TS2322 so the isolation assertion can prove this EXACT code is
// absent from the reported set.
const DEPENDENCY_INTERNAL_CODE = 2339;

const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

function fixtureTsConfig(name: string): string {
  return join(workspaceRoot, 'fixtures', name, 'tsconfig.json');
}

function codesOf(diagnostics: readonly ts.Diagnostic[]): number[] {
  return diagnostics.map((diagnostic) => diagnostic.code);
}

describe('layout-b: broken host -- aggregated story + external-template kill-shot + isolation (criteria 1(B) + 2 + 3)', () => {
  it('fails on the aggregated story, keeps the external-template NG8002, and isolates the dependency', async () => {
    const result = await runTypecheck({
      tsConfigPath: fixtureTsConfig('layout-b-host'),
    });

    const codes = codesOf(result.diagnostics);

    // The host references only `./.storybook/tsconfig.json`, whose widened include
    // materialized the aggregated story + component as declared rootNames.
    expect(result.rootNamesCount).toBeGreaterThan(0);

    // T10 (Phase 18, plan 18-02): this host references ONLY the `.storybook` leaf
    // (no app/lib leaf), yet the widened include gave it a non-empty input set, so
    // the failure is a REAL story error -- NOT the empty-project ZERO_ROOT_NAMES
    // (90001) guard. Assert 90001 is absent for "not empty-project 90001"
    // traceability (the failure is a type error, not a coverage guard).
    expect(
      result.diagnostics.every(
        (diagnostic) => diagnostic.code !== ZERO_ROOT_NAMES_DIAGNOSTIC_CODE,
      ),
    ).toBe(true);

    // criterion 1(B): the aggregated, OUT-OF-HOST-DIR broken story's TS2322 is
    // reported (input-set membership kept the aggregated rootName) and the verdict
    // FAILS.
    const storyErrors = result.diagnostics.filter(
      (diagnostic) =>
        diagnostic.code === TS2322 &&
        (diagnostic.file?.fileName ?? '').endsWith('card.stories.ts'),
    );

    expect(storyErrors).toHaveLength(1);
    expect(evaluateResult(result).success).toBe(false);

    // criterion 2 (the kill-shot): the aggregated external-`templateUrl` NG8002 is
    // reported. `.html` is NOT a rootName, so it survives ONLY because branch 4a
    // resolved its owning component `.ts` (in the input set) via public
    // `relatedInformation` and KEPT it.
    expect(codes).toContain(NG8002);

    const templateDiagnostic = result.diagnostics.find(
      (diagnostic) => diagnostic.code === NG8002,
    );

    expect(templateDiagnostic).toBeDefined();

    // The diagnostic carries its `.html` codeframe...
    expect(templateDiagnostic?.file?.fileName ?? '').toContain(
      'card.component.html',
    );

    // ...AND a `.ts` relatedInformation owner (the branch-4a attribution signal
    // that KEPT it -- proving it was not dropped as a non-rootName resource).
    const relatedTsOwners = (
      templateDiagnostic?.relatedInformation ?? []
    ).filter((info) => (info.file?.fileName ?? '').endsWith('.ts'));

    expect(relatedTsOwners.length).toBeGreaterThan(0);
    expect(relatedTsOwners[0]?.file?.fileName ?? '').toContain(
      'card.component.ts',
    );

    // criterion 3 (isolation, R1): the dependency's INTERNAL error code is ABSENT
    // from the reported diagnostics (CONTENT isolation -- the dependency's error
    // text/codeframe is never surfaced)...
    expect(codes).not.toContain(DEPENDENCY_INTERNAL_CODE);

    // ...BUT the drop is COUNTED as an in-graph first-party suppression (never a
    // silent drop), naming the dependency file for the advisory notice...
    expect(result.suppressedInGraphErrorCount).toBeGreaterThanOrEqual(1);
    expect(
      result.suppressedInGraphFiles.some((filePath) =>
        filePath.endsWith('thing.ts'),
      ),
    ).toBe(true);

    // ...and the verdict is non-clean (coverage-incomplete territory -- NOT
    // success:true). The `suppressedInGraphErrorCount` alone would flip a
    // hypothetically error-free run to coverage-incomplete (the R1 gate, proven in
    // 17-04); here the aggregated errors make success:false regardless.
    expect(evaluateResult(result).success).toBe(false);
    expect(
      evaluateResult({
        errorCount: 0,
        warningCount: 0,
        suppressedInGraphErrorCount: result.suppressedInGraphErrorCount,
      }).outcome,
    ).toBe('coverage-incomplete');
  });
});

describe('layout-b: clean host reports suppressedInGraph == 0 and passes (criterion 4)', () => {
  it('classifies the clean external template in-graph -- both split counts zero and PASSES', async () => {
    const result = await runTypecheck({
      tsConfigPath: fixtureTsConfig('layout-b-host-clean'),
    });

    expect(result.rootNamesCount).toBeGreaterThan(0);
    expect(result.errorCount).toBe(0);

    // criterion 4: the clean host, INCL. its clean external `templateUrl`
    // component, is classified in-graph by construction -- nothing first-party was
    // dropped. Both structured split counts are present AND zero (structured-result
    // surfacing; the loud stdout surfacing is proven in the 17-05 executor spec).
    expect(result.suppressedInGraphErrorCount).toBe(0);
    expect(result.suppressedInGraphWarningCount).toBe(0);

    const verdict = evaluateResult(result);

    expect(verdict.success).toBe(true);
    expect(verdict.outcome).toBe('clean');
  });
});
