import { describe, expect, it } from 'vitest';

import { evaluateResult } from './evaluate-result';

describe('evaluateResult', () => {
  it('fails as type-error when errorCount > 0, with no maxWarnings (EXE-05 / D-03: errors always fail)', () => {
    expect(evaluateResult({ errorCount: 1, warningCount: 0 })).toEqual({
      success: false,
      outcome: 'type-error',
    });
  });

  it('fails on errors even when warnings are within threshold (EXE-05 / D-03)', () => {
    expect(
      evaluateResult({ errorCount: 1, warningCount: 0 }, { maxWarnings: 5 }),
    ).toEqual({ success: false, outcome: 'type-error' });
  });

  it('reports type-error even when a suppressed in-graph error is also present -- errors win the label (D-06)', () => {
    expect(
      evaluateResult({
        errorCount: 1,
        warningCount: 0,
        suppressedInGraphErrorCount: 2,
      }).outcome,
    ).toBe('type-error');
  });

  it('passes clean when there are no errors and no maxWarnings -- warnings never fail on their own (EXE-05 / D-03)', () => {
    expect(evaluateResult({ errorCount: 0, warningCount: 3 })).toEqual({
      success: true,
      outcome: 'clean',
    });
  });

  it('fails as warnings-exceeded on ANY warning when maxWarnings is 0 (EXE-05 / D-03)', () => {
    expect(
      evaluateResult({ errorCount: 0, warningCount: 1 }, { maxWarnings: 0 }),
    ).toEqual({ success: false, outcome: 'warnings-exceeded' });
  });

  it('passes clean when warningCount is exactly at the maxWarnings threshold (EXE-05 / D-03)', () => {
    expect(
      evaluateResult({ errorCount: 0, warningCount: 2 }, { maxWarnings: 2 }),
    ).toEqual({ success: true, outcome: 'clean' });
  });

  it('fails as warnings-exceeded when warningCount is over the maxWarnings threshold (EXE-05 / D-03)', () => {
    expect(
      evaluateResult({ errorCount: 0, warningCount: 3 }, { maxWarnings: 2 }),
    ).toEqual({ success: false, outcome: 'warnings-exceeded' });
  });

  it('passes clean with zero warnings when maxWarnings is 0 (EXE-05 / D-03)', () => {
    expect(
      evaluateResult({ errorCount: 0, warningCount: 0 }, { maxWarnings: 0 }),
    ).toEqual({ success: true, outcome: 'clean' });
  });

  it('treats a negative maxWarnings as unset -- warnings do not fail on their own (Security V5 / T-03-03)', () => {
    expect(
      evaluateResult({ errorCount: 0, warningCount: 3 }, { maxWarnings: -1 }),
    ).toEqual({ success: true, outcome: 'clean' });
  });

  it('treats a NaN maxWarnings as unset -- warnings do not fail on their own (Security V5 / T-03-03)', () => {
    expect(
      evaluateResult(
        { errorCount: 0, warningCount: 3 },
        { maxWarnings: Number.NaN },
      ),
    ).toEqual({ success: true, outcome: 'clean' });
  });

  // --- coverage-incomplete: a suppressed first-party in-graph ERROR ALWAYS fails (D-06) ---
  it('fails as coverage-incomplete when a first-party in-graph error was suppressed, errorCount 0 (D-06)', () => {
    expect(
      evaluateResult({
        errorCount: 0,
        warningCount: 0,
        suppressedInGraphErrorCount: 1,
      }),
    ).toEqual({ success: false, outcome: 'coverage-incomplete' });
  });

  it('fails as coverage-incomplete on a suppressed in-graph error even with no maxWarnings gate', () => {
    expect(
      evaluateResult({
        errorCount: 0,
        warningCount: 0,
        suppressedInGraphErrorCount: 3,
      }).success,
    ).toBe(false);
  });

  // --- coverage-incomplete: whole-program TCB abort (FM-9 fold) ---
  it('fails as coverage-incomplete when templateCheckAborted is present (FM-9)', () => {
    expect(
      evaluateResult({
        errorCount: 0,
        warningCount: 0,
        templateCheckAborted: { code: -993004, fileName: 'a.component.ts' },
      }),
    ).toEqual({ success: false, outcome: 'coverage-incomplete' });
  });

  // --- coverage-incomplete: a zero-root-names leaf resolved zero files ---
  it('fails as coverage-incomplete when a zero-root-names reference was skipped', () => {
    expect(
      evaluateResult({
        errorCount: 0,
        warningCount: 0,
        skippedReferences: [
          { referencePath: '/x/tsconfig.json', reason: 'zero-root-names' },
        ],
      }),
    ).toEqual({ success: false, outcome: 'coverage-incomplete' });
  });

  it('stays clean when skippedReferences are only advisory non-zero-root reasons (out-of-project / duplicate)', () => {
    expect(
      evaluateResult({
        errorCount: 0,
        warningCount: 0,
        skippedReferences: [
          { referencePath: '/x/tsconfig.json', reason: 'out-of-project' },
          { referencePath: '/y/tsconfig.json', reason: 'duplicate' },
        ],
      }),
    ).toEqual({ success: true, outcome: 'clean' });
  });

  // --- coverage-incomplete: a suppressed in-graph WARNING is LATE-BOUND on maxWarnings (the D-06 fix) ---
  it('fails as coverage-incomplete on a suppressed in-graph warning ONLY when maxWarnings gates (0)', () => {
    expect(
      evaluateResult(
        { errorCount: 0, warningCount: 0, suppressedInGraphWarningCount: 1 },
        { maxWarnings: 0 },
      ),
    ).toEqual({ success: false, outcome: 'coverage-incomplete' });
  });

  it('passes clean on a suppressed in-graph warning when maxWarnings is unset -- late-binding proof (D-06)', () => {
    expect(
      evaluateResult({
        errorCount: 0,
        warningCount: 0,
        suppressedInGraphWarningCount: 1,
      }),
    ).toEqual({ success: true, outcome: 'clean' });
  });

  // --- D-01 (Phase 18, T11): the notTypeCheckedDeclaredFiles advisory NEVER flips
  // the verdict (Pitfall 2). The field is DELIBERATELY absent from EvaluateInput, so
  // it is introduced via a variable (excess-property checks fire only on fresh
  // object literals passed directly) to prove it cannot enter the verdict. This
  // tripwire locks it against a future accidental wiring into the verdict.
  it('stays clean when notTypeCheckedDeclaredFiles is non-empty and errorCount 0 -- the D-01 advisory NEVER flips the verdict', () => {
    const withUncheckedDeclared = {
      errorCount: 0,
      warningCount: 0,
      notTypeCheckedDeclaredFiles: ['/ws/libs/x/docs.mdx'],
    };

    expect(evaluateResult(withUncheckedDeclared)).toEqual({
      success: true,
      outcome: 'clean',
    });
  });

  it('stays clean on a non-empty notTypeCheckedDeclaredFiles even under maxWarnings 0 (D-01 advisory)', () => {
    const withUncheckedDeclared = {
      errorCount: 0,
      warningCount: 0,
      notTypeCheckedDeclaredFiles: [
        '/ws/libs/x/docs.mdx',
        '/ws/libs/x/legacy.tsx',
      ],
    };

    expect(evaluateResult(withUncheckedDeclared, { maxWarnings: 0 })).toEqual({
      success: true,
      outcome: 'clean',
    });
  });

  it('a Suggestion/Message-only drop (all counts 0) stays clean even under maxWarnings 0', () => {
    expect(
      evaluateResult(
        {
          errorCount: 0,
          warningCount: 0,
          suppressedInGraphErrorCount: 0,
          suppressedInGraphWarningCount: 0,
        },
        { maxWarnings: 0 },
      ),
    ).toEqual({ success: true, outcome: 'clean' });
  });
});
