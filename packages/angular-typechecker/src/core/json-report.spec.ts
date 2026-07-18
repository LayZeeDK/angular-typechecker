import ts from 'typescript';
import type tsType from 'typescript';

import { describe, expect, it } from 'vitest';

import {
  codeStringOf,
  positionsOf,
  toDiagnosticRecord,
} from './diagnostic-record';

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

function positionedDiag(): tsType.Diagnostic {
  const file = {
    fileName: 'D:/ws/proj/src/y.component.ts',
    getLineAndCharacterOfPosition: (position: number) =>
      position === START
        ? { line: 11, character: 4 }
        : { line: 11, character: 19 },
  } as unknown as tsType.SourceFile;

  return {
    category: ERROR,
    code: TS2322,
    file,
    start: START,
    length: SPAN,
    messageText: 'Type X is not assignable to type Y.',
  } as tsType.Diagnostic;
}

// The synthesized guard shape (diagnostic-codes.ts:122-135): file/start/length are
// undefined BY CONSTRUCTION, so the projection MUST tolerate them (Pitfall 10).
function filelessDiag(code = ATC90001): tsType.Diagnostic {
  return {
    category: ERROR,
    code,
    file: undefined,
    start: undefined,
    length: undefined,
    messageText: 'a references-only config resolved zero root names',
  } as tsType.Diagnostic;
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
        { ...positionedDiag(), code: NG8109 } as tsType.Diagnostic,
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
        } as tsType.Diagnostic,
        ts,
        undefined,
      );

      expect(record.severity).toBe('warning');
    });

    it('maps each ts.DiagnosticCategory to its severity label', () => {
      const cases: readonly [tsType.DiagnosticCategory, string][] = [
        [ERROR, 'error'],
        [WARNING, 'warning'],
        [SUGGESTION, 'suggestion'],
        [MESSAGE, 'message'],
      ];

      for (const [category, severity] of cases) {
        const record = toDiagnosticRecord(
          { ...positionedDiag(), category } as tsType.Diagnostic,
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
