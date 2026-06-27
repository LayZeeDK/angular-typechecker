import { describe, expect, it } from 'vitest';

import { evaluateResult } from './evaluate-result';

describe('evaluateResult', () => {
  it('fails when errorCount > 0, with no maxWarnings (EXE-05 / D-03: errors always fail)', () => {
    expect(evaluateResult({ errorCount: 1, warningCount: 0 }).success).toBe(
      false,
    );
  });

  it('fails on errors even when warnings are within threshold (EXE-05 / D-03)', () => {
    expect(
      evaluateResult({ errorCount: 1, warningCount: 0 }, { maxWarnings: 5 })
        .success,
    ).toBe(false);
  });

  it('passes when there are no errors and no maxWarnings -- warnings never fail on their own (EXE-05 / D-03)', () => {
    expect(evaluateResult({ errorCount: 0, warningCount: 3 }).success).toBe(
      true,
    );
  });

  it('fails on ANY warning when maxWarnings is 0 (EXE-05 / D-03)', () => {
    expect(
      evaluateResult({ errorCount: 0, warningCount: 1 }, { maxWarnings: 0 })
        .success,
    ).toBe(false);
  });

  it('passes when warningCount is exactly at the maxWarnings threshold (EXE-05 / D-03)', () => {
    expect(
      evaluateResult({ errorCount: 0, warningCount: 2 }, { maxWarnings: 2 })
        .success,
    ).toBe(true);
  });

  it('fails when warningCount is over the maxWarnings threshold (EXE-05 / D-03)', () => {
    expect(
      evaluateResult({ errorCount: 0, warningCount: 3 }, { maxWarnings: 2 })
        .success,
    ).toBe(false);
  });

  it('passes with zero warnings when maxWarnings is 0 (EXE-05 / D-03)', () => {
    expect(
      evaluateResult({ errorCount: 0, warningCount: 0 }, { maxWarnings: 0 })
        .success,
    ).toBe(true);
  });

  it('treats a negative maxWarnings as unset -- warnings do not fail on their own (Security V5 / T-03-03)', () => {
    expect(
      evaluateResult({ errorCount: 0, warningCount: 3 }, { maxWarnings: -1 })
        .success,
    ).toBe(true);
  });

  it('treats a NaN maxWarnings as unset -- warnings do not fail on their own (Security V5 / T-03-03)', () => {
    expect(
      evaluateResult(
        { errorCount: 0, warningCount: 3 },
        { maxWarnings: Number.NaN },
      ).success,
    ).toBe(true);
  });
});
