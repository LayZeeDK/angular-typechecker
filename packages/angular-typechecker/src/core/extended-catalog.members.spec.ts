import { describe, expect, it } from 'vitest';

import { EXTENDED_DIAGNOSTIC_MEMBERS } from './extended-catalog.members';

// DRIFT-01 runtime complement to extended-catalog.drift.ts (S-6). The type-level
// tripwire compares the catalog to the real enum as VALUE UNIONS, and a union
// COLLAPSES duplicates -- so a duplicated entry in EXTENDED_DIAGNOSTIC_MEMBERS (or
// a wrong cardinality) would pass the type check silently while the runtime
// `it.each` catalog spec would simply run one row twice. These runtime assertions
// pin the exact count and uniqueness the value-union comparison cannot see.
describe('EXTENDED_DIAGNOSTIC_MEMBERS cardinality + uniqueness (S-6)', () => {
  it('declares exactly 18 members (@angular/compiler-cli 22.0.4)', () => {
    expect(EXTENDED_DIAGNOSTIC_MEMBERS).toHaveLength(18);
  });

  it('has no duplicate members (a duplicate is invisible to the value-union tripwire)', () => {
    const unique = new Set(EXTENDED_DIAGNOSTIC_MEMBERS);

    expect(unique.size).toBe(EXTENDED_DIAGNOSTIC_MEMBERS.length);
  });
});
