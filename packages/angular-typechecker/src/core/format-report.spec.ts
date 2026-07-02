import type tsType from 'typescript';

import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

import type { CompilerCli } from './compiler-cli-types';
import { formatReport } from './format-report';

// ESC (0x1b) built from a char code so no literal control char lives in source
// (CLAUDE.md ASCII rule). Used to assert the D-10 ANSI strip / keep behavior.
const ESC = String.fromCharCode(0x1b);
const ANSI_RED = `${ESC}[91m`;
const ANSI_RESET = `${ESC}[0m`;

/**
 * Hand-built ts.Diagnostic factory (the gather-diagnostics.spec.ts idiom). When
 * `fileName` is supplied the diagnostic carries a minimal `file` whose
 * `getLineAndCharacterOfPosition`/`text` are stubbed so the REAL
 * `ts.formatDiagnostics` can render it for the end-to-end path-outcome cases.
 */
function diag(
  category: tsType.DiagnosticCategory,
  fileName?: string,
  code = 2322,
): tsType.Diagnostic {
  const file =
    fileName === undefined
      ? undefined
      : ({
          fileName,
          text: 'const x = 1;\n',
          getLineAndCharacterOfPosition: () => ({ line: 0, character: 0 }),
        } as unknown as tsType.SourceFile);

  return {
    category,
    code,
    file,
    start: fileName === undefined ? undefined : 0,
    length: fileName === undefined ? undefined : 1,
    messageText: 'sample message',
  } as tsType.Diagnostic;
}

/** A vi.fn fake `formatDiagnostics` wrapped as the injected `ng` surface. */
function fakeNg(returnValue: string): {
  ng: Pick<CompilerCli, 'formatDiagnostics'>;
  formatDiagnostics: ReturnType<typeof vi.fn>;
} {
  const formatDiagnostics = vi.fn(() => returnValue);

  return {
    ng: { formatDiagnostics } as unknown as Pick<
      CompilerCli,
      'formatDiagnostics'
    >,
    formatDiagnostics,
  };
}

/** The real `ts.formatDiagnostics`, wrapped as the injected `ng` surface. */
const realNg = {
  formatDiagnostics: ts.formatDiagnostics,
} as unknown as Pick<CompilerCli, 'formatDiagnostics'>;

describe('formatReport', () => {
  it('renders via the injected ng.formatDiagnostics with an NG code in the output (OUT-01)', () => {
    const { ng, formatDiagnostics } = fakeNg(
      `${ANSI_RED}error NG8109: x${ANSI_RESET}`,
    );

    const out = formatReport(
      [diag(ts.DiagnosticCategory.Error, '/ws/a.ts')],
      ng,
      ts,
      {
        color: true,
      },
    );

    expect(formatDiagnostics).toHaveBeenCalledOnce();
    expect(out).toContain('NG8109');
  });

  it('strips ANSI when color is false (OUT-03/D-10)', () => {
    const { ng } = fakeNg(`${ANSI_RED}error NG8109: x${ANSI_RESET}`);

    const out = formatReport(
      [diag(ts.DiagnosticCategory.Error, '/ws/a.ts')],
      ng,
      ts,
      {
        color: false,
      },
    );

    expect(out).not.toContain(ESC);
    expect(out).toContain('NG8109');
  });

  it('keeps ANSI when color is true (D-10)', () => {
    const { ng } = fakeNg(`${ANSI_RED}error NG8109: x${ANSI_RESET}`);

    const out = formatReport(
      [diag(ts.DiagnosticCategory.Error, '/ws/a.ts')],
      ng,
      ts,
      {
        color: true,
      },
    );

    expect(out).toContain(ANSI_RED);
  });

  it('is idempotent: the same inputs render byte-identical strings (OUT-03)', () => {
    const diagnostics = [
      diag(ts.DiagnosticCategory.Error, 'D:/ws/proj/src/a.component.ts'),
      diag(ts.DiagnosticCategory.Warning, 'D:/ws/proj/src/b.component.ts'),
    ];

    const first = formatReport(diagnostics, realNg, ts, { color: false });
    const second = formatReport(diagnostics, realNg, ts, { color: false });

    expect(first).toBe(second);
  });

  it('forces the host getNewLine to "\\n" (Pitfall 2)', () => {
    const { ng, formatDiagnostics } = fakeNg('x');

    formatReport([diag(ts.DiagnosticCategory.Error, '/ws/a.ts')], ng, ts, {
      color: false,
    });

    const host = formatDiagnostics.mock
      .calls[0][1] as tsType.FormatDiagnosticsHost;

    expect(host.getNewLine()).toBe('\n');
  });

  it('uses a non-identity getCanonicalFileName (D-08)', () => {
    const { ng, formatDiagnostics } = fakeNg('x');

    formatReport([diag(ts.DiagnosticCategory.Error, '/ws/a.ts')], ng, ts, {
      color: false,
    });

    const host = formatDiagnostics.mock
      .calls[0][1] as tsType.FormatDiagnosticsHost;
    const canonical = host.getCanonicalFileName('D:/Foo/Bar.TS');

    if (ts.sys.useCaseSensitiveFileNames) {
      expect(canonical).toBe('D:/Foo/Bar.TS');
    } else {
      // NOT the always-identity defaultFormatHost behavior: it case-folds.
      expect(canonical).toBe('d:/foo/bar.ts');
      expect(canonical).not.toBe('D:/Foo/Bar.TS');
    }
  });

  it('renders the ABSOLUTE path when pathBase is unset (OUT-02/OUT-03/D-08, A1 sentinel)', () => {
    const absolute = 'D:/ws/proj/src/a.component.ts';

    const out = formatReport(
      [diag(ts.DiagnosticCategory.Error, absolute)],
      realNg,
      ts,
      { color: false },
    );

    expect(out).toContain(absolute);
    // The rendered line begins with the ABSOLUTE path -- it is NOT relativized to
    // the file's own directory (which would start the line at the bare basename).
    expect(out.startsWith(absolute)).toBe(true);
    expect(out.startsWith('a.component.ts')).toBe(false);
  });

  it('renders a workspace-root-relative, "/"-normalized path when pathBase is set (OUT-02/OUT-03/D-08)', () => {
    const absolute = 'D:/ws/proj/src/a.component.ts';

    const out = formatReport(
      [diag(ts.DiagnosticCategory.Error, absolute)],
      realNg,
      ts,
      { color: false, pathBase: 'D:/ws/proj' },
    );

    expect(out).toContain('src/a.component.ts');
    expect(out).not.toContain(absolute);
    expect(out).not.toContain('\\');
  });

  it('fail-fast truncates the REPORTED list at the first Error (EXE-03/D-04)', () => {
    const { ng, formatDiagnostics } = fakeNg('x');
    const sorted = [
      diag(ts.DiagnosticCategory.Warning, '/ws/a.ts'),
      diag(ts.DiagnosticCategory.Error, '/ws/b.ts'),
      diag(ts.DiagnosticCategory.Warning, '/ws/c.ts'),
      diag(ts.DiagnosticCategory.Error, '/ws/d.ts'),
    ];

    formatReport(sorted, ng, ts, { color: false, failFast: true });

    const passed = formatDiagnostics.mock
      .calls[0][0] as readonly tsType.Diagnostic[];

    expect(passed).toHaveLength(2);
  });

  it('passes all diagnostics when failFast is unset (EXE-03)', () => {
    const { ng, formatDiagnostics } = fakeNg('x');
    const sorted = [
      diag(ts.DiagnosticCategory.Warning, '/ws/a.ts'),
      diag(ts.DiagnosticCategory.Error, '/ws/b.ts'),
      diag(ts.DiagnosticCategory.Warning, '/ws/c.ts'),
      diag(ts.DiagnosticCategory.Error, '/ws/d.ts'),
    ];

    formatReport(sorted, ng, ts, { color: false });

    const passed = formatDiagnostics.mock
      .calls[0][0] as readonly tsType.Diagnostic[];

    expect(passed).toHaveLength(4);
  });

  it('fail-fast with no Error renders every diagnostic (EXE-03)', () => {
    const { ng, formatDiagnostics } = fakeNg('x');
    const sorted = [
      diag(ts.DiagnosticCategory.Warning, '/ws/a.ts'),
      diag(ts.DiagnosticCategory.Warning, '/ws/b.ts'),
      diag(ts.DiagnosticCategory.Warning, '/ws/c.ts'),
    ];

    formatReport(sorted, ng, ts, { color: false, failFast: true });

    const passed = formatDiagnostics.mock
      .calls[0][0] as readonly tsType.Diagnostic[];

    expect(passed).toHaveLength(3);
  });
});
