import type tsType from 'typescript';

import { describe, expect, it } from 'vitest';

import { renderReport } from './render-report';

// ESC (0x1b) built from a char code so no literal control char lives in source
// (CLAUDE.md ASCII rule). Used to assert the D-04/D-10 ANSI strip / keep behavior.
const ESC = String.fromCharCode(0x1b);

// An Angular extended diagnostic code is NEGATIVE-encoded on `ts.Diagnostic.code`
// (`ngErrorCode(8109) === -998109`; STATE [01-03]). renderReport forwards
// diagnostics through `formatReport` -> compiler-cli's `formatDiagnostics`, which
// renders the NG label. We assert the NG code surfaces in the rendered output.
const NG8109 = -998109;
const TS2322 = 2322;

/**
 * Hand-built ts.Diagnostic factory (the format-report.spec.ts idiom). The minimal
 * `file` stubs `getLineAndCharacterOfPosition`/`text` so the REAL
 * `compiler-cli.formatDiagnostics` (loaded by renderReport) can render it for the
 * color / path-outcome cases.
 */
function diag(
  category: tsType.DiagnosticCategory,
  fileName: string,
  code = TS2322,
): tsType.Diagnostic {
  const file = {
    fileName,
    text: 'const x = 1;\n',
    getLineAndCharacterOfPosition: () => ({ line: 0, character: 0 }),
  } as unknown as tsType.SourceFile;

  return {
    category,
    code,
    file,
    start: 0,
    length: 1,
    messageText: 'sample message',
  } as tsType.Diagnostic;
}

// ts.DiagnosticCategory.Error === 1, .Warning === 0 (stable enum values), used as
// literals so the spec does not need to load `typescript` itself -- renderReport
// loads it internally.
const ERROR = 1 as tsType.DiagnosticCategory;
const WARNING = 0 as tsType.DiagnosticCategory;

describe('renderReport (D-02 seam)', () => {
  it('keeps ANSI when color is true (D-04/D-10)', async () => {
    const out = await renderReport(
      { diagnostics: [diag(ERROR, 'D:/ws/proj/src/a.component.ts')] },
      { color: true },
    );

    expect(out).toContain('a.component.ts');
    // compiler-cli's formatDiagnostics is always color, so the kept path carries
    // the ESC byte.
    expect(out).toContain(ESC);
  });

  it('strips ANSI when color is false (D-04/D-10)', async () => {
    const out = await renderReport(
      { diagnostics: [diag(ERROR, 'D:/ws/proj/src/a.component.ts')] },
      { color: false },
    );

    expect(out).not.toContain(ESC);
    expect(out).toContain('a.component.ts');
  });

  it('forwards an NG-encoded diagnostic code through to formatReport output', async () => {
    const out = await renderReport(
      { diagnostics: [diag(ERROR, 'D:/ws/proj/src/a.component.ts', NG8109)] },
      { color: false },
    );

    expect(out).toContain('NG8109');
  });

  it('forwards pathBase to relativize "/"-normalized paths (D-08)', async () => {
    const absolute = 'D:/ws/proj/src/a.component.ts';

    const out = await renderReport(
      { diagnostics: [diag(ERROR, absolute)] },
      { color: false, pathBase: 'D:/ws/proj' },
    );

    expect(out).toContain('src/a.component.ts');
    expect(out).not.toContain(absolute);
    expect(out).not.toContain('\\');
  });

  it('forwards failFast to truncate the reported list at the first error (EXE-03/D-04)', async () => {
    const diagnostics = [
      diag(WARNING, 'D:/ws/proj/src/a.component.ts'),
      diag(ERROR, 'D:/ws/proj/src/b.component.ts'),
      diag(ERROR, 'D:/ws/proj/src/c.component.ts'),
    ];

    const out = await renderReport(
      { diagnostics },
      { color: false, failFast: true },
    );

    // The reporter truncates AT the first error (inclusive): a.ts (warning) and
    // b.ts (first error) render; c.ts (the second error) does not.
    expect(out).toContain('a.component.ts');
    expect(out).toContain('b.component.ts');
    expect(out).not.toContain('c.component.ts');
  });

  it('renders every diagnostic when failFast is unset (EXE-03)', async () => {
    const diagnostics = [
      diag(WARNING, 'D:/ws/proj/src/a.component.ts'),
      diag(ERROR, 'D:/ws/proj/src/b.component.ts'),
      diag(ERROR, 'D:/ws/proj/src/c.component.ts'),
    ];

    const out = await renderReport({ diagnostics }, { color: false });

    expect(out).toContain('a.component.ts');
    expect(out).toContain('b.component.ts');
    expect(out).toContain('c.component.ts');
  });
});
