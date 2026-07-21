import { describe, expect, it } from 'vitest';

import { NG } from './diagnostic-codes';
import { familyOf } from './diagnostic-family';
import { codeStringOf, type DiagnosticRecord } from './diagnostic-record';
import { EXTENDED_DIAGNOSTIC_CATALOG } from './extended-catalog';

// `familyOf` reads ONLY `record.rawCode` + `record.file` (D-01). The remaining
// fields are inert here -- `code` is derived from `rawCode` via the shipped
// `codeStringOf` purely so each fixture is a faithful record, never because
// `familyOf` reads it.
function record(rawCode: number, file: string | null): DiagnosticRecord {
  return {
    file,
    line: null,
    column: null,
    endLine: null,
    endColumn: null,
    code: codeStringOf(rawCode),
    rawCode,
    severity: 'error',
    message: 'irrelevant to familyOf',
  };
}

// Source the in-catalog NG code from the catalog itself (D-02) so an upstream
// catalog change cannot silently desync this spec. NG8002 is the canonical negative
// code that is NOT an extended diagnostic; the desync-guard test below proves it
// stays out of the catalog.
const IN_CATALOG_NG_CODE = EXTENDED_DIAGNOSTIC_CATALOG[0].ngCode;
const NON_CATALOG_NG_CODE = 8002;

describe('familyOf (D-01 / D-02 / D-03)', () => {
  it('keeps the non-catalog NG code genuinely out of the extended catalog (desync guard)', () => {
    expect(EXTENDED_DIAGNOSTIC_CATALOG.map((entry) => entry.ngCode)).not.toContain(
      NON_CATALOG_NG_CODE,
    );
  });

  it('classifies a positive TypeScript code in a .ts file as typescript', () => {
    expect(familyOf(record(2322, 'src/util.ts'))).toBe('typescript');
  });

  it('classifies a negative catalog NG code as extended-diagnostics', () => {
    expect(familyOf(record(NG(IN_CATALOG_NG_CODE), 'src/y.component.ts'))).toBe(
      'extended-diagnostics',
    );
  });

  it('keeps a catalog NG code attributed to an external .html file as extended-diagnostics (rawCode-before-.html order proof)', () => {
    expect(
      familyOf(record(NG(IN_CATALOG_NG_CODE), 'src/y.component.html')),
    ).toBe('extended-diagnostics');
  });

  it('classifies a negative non-catalog NG code as template-type-check', () => {
    expect(familyOf(record(NG(NON_CATALOG_NG_CODE), 'src/y.component.ts'))).toBe(
      'template-type-check',
    );
  });

  it('classifies the synthesized tool codes 90001 and 90002 as tool', () => {
    expect(familyOf(record(90001, null))).toBe('tool');
    expect(familyOf(record(90002, 'src/tsconfig.json'))).toBe('tool');
  });

  it('classifies a positive TypeScript code attributed to a .html file as template-type-check', () => {
    expect(familyOf(record(2322, 'src/y.component.html'))).toBe(
      'template-type-check',
    );
  });

  it('classifies a file-less TypeScript code as typescript', () => {
    expect(familyOf(record(2318, null))).toBe('typescript');
  });

  it('classifies an inline-template TypeScript error in a component .ts as typescript (D-03 accepted imprecision, RULE-FUT-01)', () => {
    expect(familyOf(record(2322, 'src/y.component.ts'))).toBe('typescript');
  });
});
