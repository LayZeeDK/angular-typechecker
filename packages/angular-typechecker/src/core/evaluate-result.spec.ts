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

  // --- D-19-01: opt-in strict mode escalates a dropped in-graph WARNING to a HARD
  // FAIL. A1 (19-RESEARCH) ratified: the ONLY observable FLIP is the dropped in-graph
  // WARNING with maxWarnings UNSET -- which passes clean today (line 143 above). The
  // dropped in-graph ERROR case already fails by default (line 97), so strict cannot
  // FLIP it; that case is the regression guard below, not the FLIP demonstration.
  it('strict escalates a dropped in-graph WARNING (maxWarnings unset) to coverage-incomplete; default stays clean (D-19-01 FLIP)', () => {
    const dropped = {
      errorCount: 0,
      warningCount: 0,
      suppressedInGraphWarningCount: 1,
    };

    // default (strict off): CLEAN -- the current behavior locked at line 143.
    expect(evaluateResult(dropped)).toEqual({
      success: true,
      outcome: 'clean',
    });

    // strict on: the same dropped in-graph warning now FAILS coverage-incomplete.
    expect(evaluateResult(dropped, { strict: true })).toEqual({
      success: false,
      outcome: 'coverage-incomplete',
    });
  });

  it('strict does NOT change the error case -- a dropped in-graph ERROR fails either way (D-19-01 regression guard)', () => {
    const droppedError = {
      errorCount: 0,
      warningCount: 0,
      suppressedInGraphErrorCount: 1,
    };

    // A1: the error case already fails by default; strict cannot loosen it.
    expect(evaluateResult(droppedError).outcome).toBe('coverage-incomplete');
    expect(evaluateResult(droppedError, { strict: true }).outcome).toBe(
      'coverage-incomplete',
    );
  });

  it('strict does NOT falsely escalate a fully-clean result -- all suppressed counts 0 stays clean (D-19-01)', () => {
    expect(
      evaluateResult(
        {
          errorCount: 0,
          warningCount: 0,
          suppressedInGraphErrorCount: 0,
          suppressedInGraphWarningCount: 0,
        },
        { strict: true },
      ),
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
