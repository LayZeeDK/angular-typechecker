import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import {
  codeStringOf,
  positionsOf,
  toDiagnosticRecord,
} from './diagnostic-record';
import { formatJsonReport, type JsonReport } from './json-report';
import type { CoreResult } from './run-typecheck';

// ESC (0x1b) built from a char code so no literal control char lives in source
// (CLAUDE.md ASCII rule). Used to assert the machine payload carries NO ANSI.
const ESC = String.fromCharCode(0x1b);

// One code per family: a raw TypeScript code, a NEGATIVE-encoded Angular extended
// code (`ngErrorCode(8109) === -998109`), and a synthesized angular-typechecker
// code (`ZERO_ROOT_NAMES === 90001`). Proves codeStringOf/rawCode over all three.
const TS2322 = 2322;
const NG8109 = -998109;
const ATC90001 = 90001;

const ERROR = ts.DiagnosticCategory.Error;
const WARNING = ts.DiagnosticCategory.Warning;
const SUGGESTION = ts.DiagnosticCategory.Suggestion;
const MESSAGE = ts.DiagnosticCategory.Message;

// A diagnostic whose file resolves 0-based line 11 / char 4 at `start` and 0-based
// line 11 / char 19 at `endPos` -- so positionsOf MUST project 1-based line 12,
// column 5 .. endLine 12, endColumn 20 (the hand-counted off-by-one guard: an
// off-by-one is invisible to a round-trip snapshot, so the expected values are
// pinned by hand, Pitfall 3).
const START = 100;
const SPAN = 15;

function positionedDiag(): ts.Diagnostic {
  const file = {
    fileName: 'D:/ws/proj/src/y.component.ts',
    getLineAndCharacterOfPosition: (position: number) =>
      position === START
        ? { line: 11, character: 4 }
        : { line: 11, character: 19 },
  } as unknown as ts.SourceFile;

  return {
    category: ERROR,
    code: TS2322,
    file,
    start: START,
    length: SPAN,
    messageText: 'Type X is not assignable to type Y.',
  } as ts.Diagnostic;
}

// The synthesized guard shape (diagnostic-codes.ts:122-135): file/start/length are
// undefined BY CONSTRUCTION, so the projection MUST tolerate them (Pitfall 10).
function filelessDiag(code = ATC90001): ts.Diagnostic {
  return {
    category: ERROR,
    code,
    file: undefined,
    start: undefined,
    length: undefined,
    messageText: 'a references-only config resolved zero root names',
  } as ts.Diagnostic;
}

// The file-SET but position-ABSENT shape: the diagnostic carries its owning `file`
// yet has no `start`/`length` (a file-scoped diagnostic). `positionsOf` short-circuits
// on the undefined `start`, so `getLineAndCharacterOfPosition` is NEVER invoked --
// it throws here to lock that. The record must keep a NON-null relativized `file`
// while all four positions go null, and must never be dropped.
function fileSetPositionAbsentDiag(): ts.Diagnostic {
  const file = {
    fileName: 'D:/ws/proj/src/z.component.ts',
    getLineAndCharacterOfPosition: () => {
      throw new Error(
        'getLineAndCharacterOfPosition must not be called when start is undefined',
      );
    },
  } as unknown as ts.SourceFile;

  return {
    category: ERROR,
    code: TS2322,
    file,
    start: undefined,
    length: undefined,
    messageText: 'Type X is not assignable to type Y.',
  } as ts.Diagnostic;
}

// The version drift-lock reads the SAME manifest the reporter reads, via the repo's
// established readFileSync idiom (main.spec.ts) -- two dirs above src/core/.
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifestVersion = (
  JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
    version: string;
  }
).version;

function coreResult(overrides: Partial<CoreResult> = {}): CoreResult {
  return {
    tsConfigPath: 'D:/ws/proj/libs/x/tsconfig.lib.json',
    rootNamesCount: 3,
    diagnostics: [],
    errorCount: 0,
    warningCount: 0,
    suppressedThirdParty: 0,
    suppressedInGraphErrorCount: 0,
    suppressedInGraphWarningCount: 0,
    suppressedInGraphFiles: [],
    durationMs: 5,
    ...overrides,
  };
}

// A CoreResult with EVERY optional field present, so the drift-lock fixture pins the
// MAXIMAL payload key set (D-03) and the snapshot documents the full shape incl. a
// file-less diagnostic.
function maximalResult(): CoreResult {
  return coreResult({
    diagnostics: [positionedDiag(), filelessDiag()],
    errorCount: 2,
    totalFilesCount: 9,
    templateCheckAborted: {
      code: NG8109,
      fileName: 'D:/ws/proj/src/broken.component.ts',
    },
    skippedReferences: [
      {
        referencePath: 'D:/ws/proj/other/tsconfig.json',
        reason: 'out-of-project',
      },
    ],
    suppressedInGraphErrorCount: 1,
    suppressedInGraphWarningCount: 2,
    suppressedInGraphFiles: ['D:/ws/proj/libs/x/src/y.ts'],
    notTypeCheckedDeclaredFiles: ['D:/ws/proj/libs/x/doc.mdx'],
    bundlerQueryImports: ['./logo.svg?raw'],
  });
}

describe('diagnostic-record projection (D-13 / D-01)', () => {
  describe('positionsOf', () => {
    it('returns all-null positions for a file-less diagnostic', () => {
      expect(positionsOf(filelessDiag())).toEqual({
        line: null,
        column: null,
        endLine: null,
        endColumn: null,
      });
    });

    it('projects 0-based positions to 1-based on both axes for start AND end (hand-counted)', () => {
      expect(positionsOf(positionedDiag())).toEqual({
        line: 12,
        column: 5,
        endLine: 12,
        endColumn: 20,
      });
    });
  });

  describe('codeStringOf', () => {
    it('humanizes a raw TypeScript code as TS####', () => {
      expect(codeStringOf(TS2322)).toBe('TS2322');
    });

    it('humanizes a negative Angular code as NG8xxx via ngCodeOf', () => {
      expect(codeStringOf(NG8109)).toBe('NG8109');
    });

    it('humanizes a synthesized 9000x code as ATC9000x', () => {
      expect(codeStringOf(ATC90001)).toBe('ATC90001');
    });
  });

  describe('toDiagnosticRecord', () => {
    it('carries BOTH the humanized code string and the raw code int across all three families', () => {
      const tsRecord = toDiagnosticRecord(positionedDiag(), ts, undefined);

      expect(tsRecord.code).toBe('TS2322');
      expect(tsRecord.rawCode).toBe(TS2322);

      const ngRecord = toDiagnosticRecord(
        { ...positionedDiag(), code: NG8109 } as ts.Diagnostic,
        ts,
        undefined,
      );

      expect(ngRecord.code).toBe('NG8109');
      expect(ngRecord.rawCode).toBe(NG8109);

      const atcRecord = toDiagnosticRecord(
        filelessDiag(ATC90001),
        ts,
        undefined,
      );

      expect(atcRecord.code).toBe('ATC90001');
      expect(atcRecord.rawCode).toBe(ATC90001);
    });

    it('derives severity from the category, never the code sign (a negative NG code can be a warning)', () => {
      const record = toDiagnosticRecord(
        {
          ...positionedDiag(),
          code: NG8109,
          category: WARNING,
        } as ts.Diagnostic,
        ts,
        undefined,
      );

      expect(record.severity).toBe('warning');
    });

    it('maps each ts.DiagnosticCategory to its severity label', () => {
      const cases: readonly [ts.DiagnosticCategory, string][] = [
        [ERROR, 'error'],
        [WARNING, 'warning'],
        [SUGGESTION, 'suggestion'],
        [MESSAGE, 'message'],
      ];

      for (const [category, severity] of cases) {
        const record = toDiagnosticRecord(
          { ...positionedDiag(), category } as ts.Diagnostic,
          ts,
          undefined,
        );

        expect(record.severity).toBe(severity);
      }
    });

    it('relativizes the file to a forward-slashed repo-relative path, null when file-less', () => {
      const record = toDiagnosticRecord(positionedDiag(), ts, 'D:/ws/proj');

      expect(record.file).toBe('src/y.component.ts');

      const filelessRecord = toDiagnosticRecord(
        filelessDiag(),
        ts,
        'D:/ws/proj',
      );

      expect(filelessRecord.file).toBeNull();
    });

    it('flattens the message with no ANSI byte', () => {
      const record = toDiagnosticRecord(positionedDiag(), ts, undefined);

      expect(record.message).toBe('Type X is not assignable to type Y.');
      expect(record.message).not.toContain(ESC);
    });
  });
});

describe('formatJsonReport (REP-01 / D-02..D-07 / FMT-02/FMT-03)', () => {
  it('serializes the full payload shape (snapshot, version redacted for release-stability)', () => {
    const payload = JSON.parse(
      formatJsonReport(maximalResult(), ts, { pathBase: 'D:/ws/proj' }),
    );

    expect(payload.version).toBe(manifestVersion);
    expect({ ...payload, version: '[version]' }).toMatchSnapshot();
  });

  it('marks formatVersion 1, the tool name, and the version from the package manifest (D-03)', () => {
    // Typed as the exported JsonReport contract: the annotation is the payload's
    // compile-time drift guard (a field add/remove/retype in json-report.ts that
    // diverges from JsonReport breaks HERE), the structural companion to
    // formatVersion + the key-drift snapshot.
    const payload: JsonReport = JSON.parse(
      formatJsonReport(coreResult(), ts, {}),
    );

    expect(payload.formatVersion).toBe(1);
    expect(payload.tool).toBe('angular-typechecker');
    expect(payload.version).toBe(manifestVersion);
  });

  it('delegates the verdict to evaluateResult -- coverage-incomplete keeps success:false at errorCount 0 (D-07)', () => {
    const payload = JSON.parse(
      formatJsonReport(
        coreResult({
          errorCount: 0,
          suppressedInGraphErrorCount: 1,
          suppressedInGraphFiles: ['D:/ws/proj/libs/x/src/y.ts'],
        }),
        ts,
        { pathBase: 'D:/ws/proj' },
      ),
    );

    expect(payload.summary.errorCount).toBe(0);
    expect(payload.summary.success).toBe(false);
    expect(payload.summary.outcome).toBe('coverage-incomplete');
  });

  it('never drops a file-less diagnostic -- file:null + null positions, length one-to-one (Pitfall 10)', () => {
    const result = coreResult({
      diagnostics: [positionedDiag(), filelessDiag()],
      errorCount: 2,
    });

    const payload = JSON.parse(
      formatJsonReport(result, ts, { pathBase: 'D:/ws/proj' }),
    );

    expect(payload.diagnostics).toHaveLength(result.diagnostics.length);
    expect(payload.diagnostics[0].file).toBe('src/y.component.ts');

    const fileless = payload.diagnostics[1];

    expect(fileless.file).toBeNull();
    expect(fileless.line).toBeNull();
    expect(fileless.endColumn).toBeNull();
    expect(fileless.code).toBe('ATC90001');
  });

  it('keeps a file-SET but position-ABSENT diagnostic -- file non-null, all four positions null, length one-to-one (FIX 4 / REP-01)', () => {
    const result = coreResult({
      diagnostics: [fileSetPositionAbsentDiag()],
      errorCount: 1,
    });

    const payload = JSON.parse(
      formatJsonReport(result, ts, { pathBase: 'D:/ws/proj' }),
    );

    expect(payload.diagnostics).toHaveLength(result.diagnostics.length);

    const record = payload.diagnostics[0];

    // The owning file IS reported (contrast the file-less case above, which nulls it)...
    expect(record.file).toBe('src/z.component.ts');
    // ...while every position stays null -- the projection never invents a 0 or 1.
    expect(record.line).toBeNull();
    expect(record.column).toBeNull();
    expect(record.endLine).toBeNull();
    expect(record.endColumn).toBeNull();
  });

  it('maps severity data-driven over the payload diagnostics', () => {
    const cases: readonly [ts.DiagnosticCategory, string][] = [
      [ERROR, 'error'],
      [WARNING, 'warning'],
      [SUGGESTION, 'suggestion'],
      [MESSAGE, 'message'],
    ];

    for (const [category, severity] of cases) {
      const payload = JSON.parse(
        formatJsonReport(
          coreResult({
            diagnostics: [{ ...positionedDiag(), category } as ts.Diagnostic],
          }),
          ts,
          {},
        ),
      );

      expect(payload.diagnostics[0].severity).toBe(severity);
    }
  });

  it('emits no ANSI byte and is byte-identical under FORCE_COLOR=1 (FMT-03 / D-10)', () => {
    const result = coreResult({
      diagnostics: [positionedDiag()],
      errorCount: 1,
    });

    const plain = formatJsonReport(result, ts, { pathBase: 'D:/ws/proj' });

    expect(plain).not.toContain(ESC);

    const previous = process.env.FORCE_COLOR;
    process.env.FORCE_COLOR = '1';

    try {
      const forced = formatJsonReport(result, ts, { pathBase: 'D:/ws/proj' });

      expect(forced).toBe(plain);
      expect(forced).not.toContain(ESC);
    } finally {
      if (previous === undefined) {
        delete process.env.FORCE_COLOR;
      } else {
        process.env.FORCE_COLOR = previous;
      }
    }
  });

  it('surfaces totalFilesCount when present and OMITS the key when undefined (30-01 tolerance)', () => {
    const withCount = JSON.parse(
      formatJsonReport(coreResult({ totalFilesCount: 7 }), ts, {}),
    );

    expect(withCount.summary.totalFilesCount).toBe(7);

    const withoutCount = JSON.parse(formatJsonReport(coreResult(), ts, {}));

    expect(withoutCount.summary).not.toHaveProperty('totalFilesCount');
  });

  it('omits advisories on a clean run and includes each present-if-non-empty (relativized)', () => {
    const clean = JSON.parse(formatJsonReport(coreResult(), ts, {}));

    expect(clean.summary).not.toHaveProperty('advisories');

    const payload = JSON.parse(
      formatJsonReport(maximalResult(), ts, { pathBase: 'D:/ws/proj' }),
    );

    expect(payload.summary.advisories.bundlerQueryImports).toEqual([
      './logo.svg?raw',
    ]);
    expect(payload.summary.advisories.suppressedInGraphFiles).toEqual([
      'libs/x/src/y.ts',
    ]);
    expect(payload.summary.advisories.notTypeCheckedDeclaredFiles).toEqual([
      'libs/x/doc.mdx',
    ]);
    expect(payload.summary.advisories.templateCheckAborted).toEqual({
      fileName: 'src/broken.component.ts',
    });
    expect(payload.summary.advisories.skippedReferences).toEqual([
      { referencePath: 'other/tsconfig.json', reason: 'out-of-project' },
    ]);
  });

  it('relativizes tsConfigPath against pathBase with forward slashes', () => {
    const payload = JSON.parse(
      formatJsonReport(coreResult(), ts, { pathBase: 'D:/ws/proj' }),
    );

    expect(payload.tsConfigPath).toBe('libs/x/tsconfig.lib.json');
  });

  it('serializes via JSON.stringify (2-space indented, round-trips)', () => {
    const payload = formatJsonReport(
      coreResult({ diagnostics: [positionedDiag()], errorCount: 1 }),
      ts,
      { pathBase: 'D:/ws/proj' },
    );

    expect(payload).toContain('\n  "formatVersion": 1');
    expect(() => JSON.parse(payload)).not.toThrow();
  });
});

describe('JSON payload key drift-lock (D-03)', () => {
  const TOP_LEVEL_KEYS = [
    'diagnostics',
    'formatVersion',
    'summary',
    'tool',
    'tsConfigPath',
    'version',
  ];
  const SUMMARY_KEYS = [
    'advisories',
    'diagnosticCount',
    'errorCount',
    'outcome',
    'rootNamesCount',
    'success',
    'suppressedInGraphErrorCount',
    'suppressedInGraphWarningCount',
    'suppressedThirdParty',
    'totalFilesCount',
    'warningCount',
  ];
  const ADVISORIES_KEYS = [
    'bundlerQueryImports',
    'notTypeCheckedDeclaredFiles',
    'skippedReferences',
    'suppressedInGraphFiles',
    'templateCheckAborted',
  ];
  const DIAGNOSTIC_KEYS = [
    'code',
    'column',
    'endColumn',
    'endLine',
    'file',
    'line',
    'message',
    'rawCode',
    'severity',
  ];

  function maximalPayload(): Record<string, unknown> {
    return JSON.parse(
      formatJsonReport(maximalResult(), ts, { pathBase: 'D:/ws/proj' }),
    );
  }

  it('locks the top-level payload keys', () => {
    expect(Object.keys(maximalPayload()).sort()).toEqual(TOP_LEVEL_KEYS);
  });

  it('locks the summary keys (maximal fixture)', () => {
    const payload = maximalPayload();

    expect(
      Object.keys(payload.summary as Record<string, unknown>).sort(),
    ).toEqual(SUMMARY_KEYS);
  });

  it('locks the advisories keys (maximal fixture)', () => {
    const summary = maximalPayload().summary as {
      advisories: Record<string, unknown>;
    };

    expect(Object.keys(summary.advisories).sort()).toEqual(ADVISORIES_KEYS);
  });

  it('locks each diagnostic record key set', () => {
    const payload = maximalPayload();
    const diagnostics = payload.diagnostics as Record<string, unknown>[];

    expect(Object.keys(diagnostics[0]).sort()).toEqual(DIAGNOSTIC_KEYS);
  });
});
