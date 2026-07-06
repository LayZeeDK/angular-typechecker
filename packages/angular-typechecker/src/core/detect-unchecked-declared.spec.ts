import { describe, expect, it } from 'vitest';

import { detectTsxWithoutJsx } from './detect-unchecked-declared';

// D-01 (Phase 18, T11): pure `.tsx`-without-`jsx` detection, proven with synthetic
// input (no compiler). `ts.JsxEmit.None === 0`, so a `.tsx` root is uncheckable
// only when `jsx` is unset (`undefined`) or `None` (`0`). The `.mdx` half needs a
// real `ts.parseJsonConfigFileContent`, so its exact-enumeration proof lives at the
// integration tier (plan 18-03), NOT here.
describe('detectTsxWithoutJsx', () => {
  it('detects a declared .tsx when jsx is unset (undefined)', () => {
    expect(detectTsxWithoutJsx(['/a/x.tsx', '/a/y.ts'], undefined)).toEqual([
      '/a/x.tsx',
    ]);
  });

  it('detects a declared .tsx when jsx is None (0)', () => {
    expect(detectTsxWithoutJsx(['/a/x.tsx'], 0 /* ts.JsxEmit.None */)).toEqual([
      '/a/x.tsx',
    ]);
  });

  it('returns [] when jsx is enabled (ReactJSX === 4) -- the .tsx IS type-checked', () => {
    expect(
      detectTsxWithoutJsx(['/a/x.tsx'], 4 /* ts.JsxEmit.ReactJSX */),
    ).toEqual([]);
  });

  it('returns [] on a .ts-only set even when jsx is unset -- no false positives', () => {
    expect(detectTsxWithoutJsx(['/a/y.ts', '/a/z.ts'], undefined)).toEqual([]);
  });
});
