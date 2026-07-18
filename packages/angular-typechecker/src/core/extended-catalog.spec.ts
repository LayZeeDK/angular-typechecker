import { describe, expect, it } from 'vitest';

import { EXTENDED_DIAGNOSTIC_CATALOG } from './extended-catalog';
import { EXTENDED_DIAGNOSTIC_MEMBERS } from './extended-catalog.members';

// REP-02 / D-06 completeness guard. `EXTENDED_DIAGNOSTIC_CATALOG` is the ONE
// production source of the member -> NG-code mapping that drives the SARIF
// `rules[]` catalog (`sarif-report.ts`). This is the runtime twin of the
// type-level drift tripwire (`extended-catalog.drift.ts`, which guards the member
// NAME set) and mirrors the structure guard the integration spec used to own
// (`extended-catalog.integration.spec.ts:240-246`): exactly one entry per
// `EXTENDED_DIAGNOSTIC_MEMBERS` member, in enum-declaration order.
describe('EXTENDED_DIAGNOSTIC_CATALOG (structure / D-06)', () => {
  it('has exactly one entry per EXTENDED_DIAGNOSTIC_MEMBERS member, in declaration order', () => {
    expect(EXTENDED_DIAGNOSTIC_CATALOG.map((entry) => entry.member)).toEqual([
      ...EXTENDED_DIAGNOSTIC_MEMBERS,
    ]);
  });

  it('assigns every rule a positive integer ngCode', () => {
    for (const entry of EXTENDED_DIAGNOSTIC_CATALOG) {
      expect(Number.isInteger(entry.ngCode)).toBe(true);
      expect(entry.ngCode).toBeGreaterThan(0);
    }
  });

  it('assigns every rule a UNIQUE ngCode (a duplicate would collide SARIF rule ids)', () => {
    const ngCodes = EXTENDED_DIAGNOSTIC_CATALOG.map((entry) => entry.ngCode);

    expect(new Set(ngCodes).size).toBe(ngCodes.length);
  });

  it('gives every rule a non-empty shortDescription (feeds the SARIF rule catalog)', () => {
    for (const entry of EXTENDED_DIAGNOSTIC_CATALOG) {
      expect(typeof entry.shortDescription).toBe('string');
      expect(entry.shortDescription.length).toBeGreaterThan(0);
    }
  });
});
