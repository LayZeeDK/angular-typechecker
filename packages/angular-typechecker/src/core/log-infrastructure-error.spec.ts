import { describe, expect, it, vi } from 'vitest';

import type { Logger } from './logger';
import { logInfrastructureError } from './log-infrastructure-error';
import { TypecheckInfrastructureError } from './run-typecheck';

// Byte-contract spec (single-home): logInfrastructureError is the ONLY src home of
// the infrastructure-error meta message, so this pins the exact emitted string. The
// prose pin at main.integration.spec.ts (`toContain('the Angular compiler failed to
// run')`) and both adapters (main.ts / executor.ts) rest on this text staying stable.

function mockLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('logInfrastructureError', () => {
  it('emits the byte-pinned message to logger.error exactly once', () => {
    const logger = mockLogger();
    const error = new TypecheckInfrastructureError('the compiler crashed');

    logInfrastructureError(logger, error);

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      'angular-typechecker: the Angular compiler failed to run (infrastructure error, not a type error): the compiler crashed',
    );
  });

  it('routes to error only -- never info or warn', () => {
    const logger = mockLogger();

    logInfrastructureError(logger, new TypecheckInfrastructureError('boom'));

    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
