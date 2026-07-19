import { describe, expect, it } from 'vitest';

import { redactVolatile } from './redact-volatile';

// PR47-F2: redactVolatile must replace the volatile tool `version` with the
// placeholder ONLY when a version key is already present -- never INJECT one.
// The unconditional inject masked a dropped tool-version regression: a reporter
// that stopped emitting `version` still matched the redacted snapshot because the
// helper re-added the placeholder. Replace-only-when-present makes the drop fail
// the snapshot instead.

const VERSION_PLACEHOLDER = '[version]';

describe('redactVolatile (JSON branch)', () => {
  it('maps a present top-level version to the placeholder and preserves the rest', () => {
    const result = redactVolatile({
      version: '0.2.3',
      formatVersion: 1,
      summary: { errorCount: 0 },
    }) as Record<string, unknown>;

    expect(result['version']).toBe(VERSION_PLACEHOLDER);
    expect(result['formatVersion']).toBe(1);
    expect(result['summary']).toEqual({ errorCount: 0 });
  });

  it('does NOT inject a version key when the payload has none (present-only)', () => {
    const result = redactVolatile({
      formatVersion: 1,
      summary: { errorCount: 0 },
    }) as Record<string, unknown>;

    expect('version' in result).toBe(false);
    expect(result['formatVersion']).toBe(1);
  });
});

describe('redactVolatile (SARIF branch)', () => {
  it('maps a present runs[].tool.driver.version to the placeholder', () => {
    const result = redactVolatile({
      runs: [
        { tool: { driver: { name: 'angular-typechecker', version: '0.2.3' } } },
      ],
    }) as { runs: Array<{ tool: { driver: Record<string, unknown> } }> };

    const driver = result.runs[0].tool.driver;

    expect(driver['version']).toBe(VERSION_PLACEHOLDER);
    expect(driver['name']).toBe('angular-typechecker');
  });

  it('does NOT inject a driver.version key when the run omits it (present-only)', () => {
    const result = redactVolatile({
      runs: [{ tool: { driver: { name: 'angular-typechecker' } } }],
    }) as { runs: Array<{ tool: { driver: Record<string, unknown> } }> };

    const driver = result.runs[0].tool.driver;

    expect('version' in driver).toBe(false);
    expect(driver['name']).toBe('angular-typechecker');
  });
});
