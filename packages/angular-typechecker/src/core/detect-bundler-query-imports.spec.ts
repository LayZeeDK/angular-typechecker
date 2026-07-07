import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { detectBundlerQueryImports } from './detect-bundler-query-imports';

// SB-09 D-02/D-06: pure detection of unresolved bundler-query imports, proven with
// SYNTHESIZED diagnostics (no cold compiler). A real `ts` is passed only for
// `ts.flattenDiagnosticMessageText`, which returns a plain-string messageText
// unchanged, so the synthetic factory below stays cheap. The end-to-end proof (a
// real ?query compile that KEEPS the TS2307 and self-gates under `vite/client`)
// lives at the integration tier (bundler-query-imports.integration.spec.ts).
describe('detectBundlerQueryImports (SB-09 D-02/D-06)', () => {
  // Category is irrelevant to the detector (it gates on `code`), but the literal
  // Error value (1) keeps the synthesized diagnostic realistic. The default code
  // 2307 is the plain "Cannot find module" the detector keys on; override it to
  // prove the non-2307 gate (Pitfall 2).
  const ERROR_CATEGORY = 1 as ts.DiagnosticCategory;

  function ts2307(specifier: string, code = 2307): ts.Diagnostic {
    return {
      category: ERROR_CATEGORY,
      code,
      file: undefined,
      start: undefined,
      length: undefined,
      messageText: `Cannot find module '${specifier}' or its corresponding type declarations.`,
    };
  }

  it('flags a ?query specifier, deduped + sorted', () => {
    expect(
      detectBundlerQueryImports(ts, [
        ts2307('./b?raw'),
        ts2307('./a?url'),
        ts2307('./b?raw'),
      ]),
    ).toEqual(['./a?url', './b?raw']);
  });

  it('does NOT flag a plain missing module (no ?) -- D-06(a) no false positive', () => {
    expect(detectBundlerQueryImports(ts, [ts2307('./does-not-exist')])).toEqual(
      [],
    );
  });

  it('ignores non-2307 "cannot find module" codes (2732/2792 gated out -- Pitfall 2)', () => {
    expect(
      detectBundlerQueryImports(ts, [ts2307('./x.json?raw', 2732)]),
    ).toEqual([]);
  });

  it('returns [] on an empty set (self-gating baseline -- D-03)', () => {
    expect(detectBundlerQueryImports(ts, [])).toEqual([]);
  });
});
