import { describe, expect, it } from 'vitest';

import { toExitCode } from './exit-codes';
import { TypecheckInfrastructureError } from './run-typecheck';

// Pure-function unit tier for the exit-code policy (COR-04 / D-07), mirroring the
// evaluate-result.spec.ts idiom: no compiler, no process, 2-field literals (+ a
// typed-error instance for the infra branch). Locks all three ngc-parallel
// branches -- 2 (infra) / 1 (type error) / 0 (clean) -- so an infra crash can
// never be mis-reported as clean (T-08-06).
describe('toExitCode (COR-04 / D-07)', () => {
  it('returns 2 for an infrastructure error', () => {
    expect(toExitCode(new TypecheckInfrastructureError('boom'))).toBe(2);
  });

  it('returns 1 when errorCount > 0', () => {
    expect(toExitCode({ errorCount: 3 })).toBe(1);
  });

  it('returns 0 when clean (errorCount 0)', () => {
    expect(toExitCode({ errorCount: 0 })).toBe(0);
  });
});
