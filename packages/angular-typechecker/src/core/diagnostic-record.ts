import { relative } from 'node:path';

import type ts from 'typescript';

import { ngCodeOf } from './diagnostic-codes';

/**
 * The ONE shared "diagnostic -> normalized record" projection (D-13). The JSON
 * reporter (`json-report.ts`, Phase 30) and the SARIF reporter (Phase 31) BOTH map
 * through this exact projection, so positions / codes / paths can never drift
 * between the two machine formats.
 *
 * PURE (eslint `src/core` boundary): no `console`, no `process`, and -- crucially --
 * NO `@angular/compiler-cli` import, so a reporter built on this never loads the
 * heavy ESM peer (D-12). `ts_` is INJECTED (the caller already has it warm from
 * `runTypecheck`) for `DiagnosticCategory` + `flattenDiagnosticMessageText`.
 */

/**
 * A single diagnostic, normalized for a machine payload. Positions are 1-based (or
 * `null` for a file-less diagnostic); `file` is repo-relative forward-slash (or
 * `null`); `code` is the humanized label (`TS####` / `NG8xxx` / `ATC9000x`) and
 * `rawCode` the exact `ts.Diagnostic.code` int (D-01 -- both are carried so agents
 * get a stable grep-able code AND the lossless discriminator).
 */
export interface DiagnosticRecord {
  file: string | null;
  line: number | null;
  column: number | null;
  endLine: number | null;
  endColumn: number | null;
  code: string;
  rawCode: number;
  severity: 'error' | 'warning' | 'suggestion' | 'message';
  message: string;
}

/**
 * Projects a `ts.Diagnostic` to the shared normalized record. `pathBase` relativizes
 * the file the SAME way the human host does (`format-report.ts:99-101`).
 */
export function toDiagnosticRecord(
  diagnostic: ts.Diagnostic,
  ts_: typeof import('typescript'),
  pathBase: string | undefined,
): DiagnosticRecord {
  const rawCode = diagnostic.code;

  return {
    file: fileOf(diagnostic, pathBase),
    ...positionsOf(diagnostic),
    code: codeStringOf(rawCode),
    rawCode,
    severity: severityOf(diagnostic.category, ts_),
    message: ts_.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
  };
}

/**
 * The ONE file-less-safe 0-based -> 1-based off-by-one helper (Pitfall 3 -- an
 * off-by-one is invisible to a round-trip snapshot, so it lives in exactly one
 * place). A synthesized guard / global diagnostic has `file`/`start` undefined by
 * construction (diagnostic-codes.ts:122-135) -> all-`null` positions; otherwise
 * `+1` on BOTH axes for start AND end (`endPos = start + (length ?? 0)`).
 */
export function positionsOf(diagnostic: ts.Diagnostic): {
  line: number | null;
  column: number | null;
  endLine: number | null;
  endColumn: number | null;
} {
  if (diagnostic.file === undefined || diagnostic.start === undefined) {
    return { line: null, column: null, endLine: null, endColumn: null };
  }

  const start = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  const endPosition = diagnostic.start + (diagnostic.length ?? 0);
  const end = diagnostic.file.getLineAndCharacterOfPosition(endPosition);

  return {
    line: start.line + 1,
    column: start.character + 1,
    endLine: end.line + 1,
    endColumn: end.character + 1,
  };
}

/**
 * Humanizes a raw `ts.Diagnostic.code` to a stable label. NEGATIVE codes are
 * Angular extended diagnostics -> `NG8xxx` via the shipped `ngCodeOf` (never
 * re-derive the `-99xxxx` math -- Pitfall 6); `>= 90000` are angular-typechecker's
 * synthesized codes -> `ATC9000x`; everything else is a raw TypeScript code
 * -> `TS####`.
 */
export function codeStringOf(rawCode: number): string {
  if (rawCode < 0) {
    return 'NG' + ngCodeOf(rawCode);
  }

  if (rawCode >= 90000) {
    return 'ATC' + rawCode;
  }

  return 'TS' + rawCode;
}

/**
 * Relativizes an absolute path to `pathBase` and normalizes separators to `/` so
 * the payload never leaks an absolute local path (Security V5 / T-30-04) and stays
 * cross-OS stable. When `pathBase` is unset the path is left as-is (only slash-
 * normalized) -- the production adapters always pass a base.
 *
 * FAST PATH: when `node:path` `relative()` yields a non-escaping result (does not
 * start with `..`), it is returned slash-normalized -- BYTE-IDENTICAL to the historic
 * behavior, so Windows/Linux payloads and every real-case `diagnostics[].file` path
 * are untouched.
 *
 * FALLBACK: `relative()` is case-SENSITIVE on POSIX, so on a case-insensitive FS
 * (macOS) a case-only difference between `pathBase` (real cwd case) and a
 * TS-canonicalized, lowercased advisory-list path makes `relative()` find no common
 * prefix and escape with `../../..`. {@link stripBaseCaseInsensitive} recovers the
 * repo-relative remainder from that case-only mismatch; a GENUINE escape (the path is
 * really outside the base) yields `undefined` and the real `..` escape is preserved.
 */
export function relativizePath(
  absolutePath: string,
  pathBase: string | undefined,
): string {
  if (pathBase === undefined) {
    return absolutePath.replace(/\\/g, '/');
  }

  const relativePath = relative(pathBase, absolutePath);

  if (!relativePath.startsWith('..')) {
    return relativePath.replace(/\\/g, '/');
  }

  const recovered = stripBaseCaseInsensitive(absolutePath, pathBase);

  return (recovered ?? relativePath).replace(/\\/g, '/');
}

/**
 * Strips `pathBase` off `absolutePath` with a CASE-INSENSITIVE base comparison,
 * returning the repo-relative remainder in its REAL casing (or `undefined` when
 * `absolutePath` is not actually under `pathBase`).
 *
 * WHY it exists: on a case-insensitive filesystem (macOS) the Angular compiler
 * canonicalizes (lowercases) advisory-list file names (`useCaseSensitiveFileNames`
 * === false) while `pathBase` keeps the real cwd casing, so a plain case-sensitive
 * `node:path` `relative()` escapes with `../../..` instead of the repo-relative path.
 * This recovers that path from the case-only mismatch. It is OS-independent pure
 * string logic (no `node:path` FS calls), so it is unit-testable on a Windows dev
 * machine WITHOUT a macOS runner -- the local proof for a fix that only ever triggers
 * on macOS CI.
 *
 * Exported for that direct unit test; NOT added to the public barrel (`index.ts`).
 */
export function stripBaseCaseInsensitive(
  absolutePath: string,
  pathBase: string,
): string | undefined {
  const base = pathBase.replace(/[/\\]+$/, '');
  const foldedBase = base.toLowerCase();
  const foldedPath = absolutePath.toLowerCase();

  if (foldedPath === foldedBase) {
    return '';
  }

  if (!foldedPath.startsWith(foldedBase)) {
    return undefined;
  }

  // A sibling like `/repo/rootx` shares the folded prefix `/repo/root` but is NOT a
  // child -- the char right after the base in the ORIGINAL path must be a separator.
  const separator = absolutePath[base.length];

  if (separator !== '/' && separator !== '\\') {
    return undefined;
  }

  // Slice from the ORIGINAL path so the remainder keeps its real casing.
  return absolutePath.slice(base.length + 1);
}

function fileOf(
  diagnostic: ts.Diagnostic,
  pathBase: string | undefined,
): string | null {
  if (diagnostic.file === undefined) {
    return null;
  }

  return relativizePath(diagnostic.file.fileName, pathBase);
}

/**
 * Severity from `ts.DiagnosticCategory`, NEVER the code sign (L-4 /
 * evaluate-result.ts:17-22): the negative NG encoding affects DISPLAY only.
 */
function severityOf(
  category: ts.DiagnosticCategory,
  ts_: typeof import('typescript'),
): DiagnosticRecord['severity'] {
  switch (category) {
    case ts_.DiagnosticCategory.Error: {
      return 'error';
    }

    case ts_.DiagnosticCategory.Warning: {
      return 'warning';
    }

    case ts_.DiagnosticCategory.Suggestion: {
      return 'suggestion';
    }

    default: {
      return 'message';
    }
  }
}
