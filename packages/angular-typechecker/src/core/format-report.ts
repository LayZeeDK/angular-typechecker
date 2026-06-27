import type ts from 'typescript';

import type { CompilerCli } from './compiler-cli-types';

// Strip SGR ANSI sequences. ESC (0x1b) is built from a char code so no literal
// control char lives in source (CLAUDE.md ASCII rule). The pattern is LINEAR
// (bounded class `[0-9;]`, single `*`, anchored to `m`) -- no catastrophic
// backtracking (T-03-05). compiler-cli's `formatDiagnostics` is ALWAYS color
// (calls `formatDiagnosticsWithColorAndContext` unconditionally), so the strip
// is a separate post-step (D-10; `replaceTsWithNgInErrors` does NOT strip color).
const ANSI_PATTERN = new RegExp(String.fromCharCode(0x1b) + '\\[[0-9;]*m', 'g');

// Sentinel `getCurrentDirectory()` value used when `pathBase` is unset. It never
// prefixes a real diagnostic path, so `formatDiagnostics`'s internal
// `path.relative` leaves file names ABSOLUTE (verified by probe against the real
// `ts.formatDiagnostics`: a non-prefixing root yields the absolute path). This
// keeps output deterministic across the Nx daemon vs a cold run -- cwd-relative
// paths would break OUT-03 idempotency (D-08, A1).
const ABSOLUTE_PATH_SENTINEL = '/__atc_absolute__';

/**
 * Options for {@link formatReport}.
 *
 * - D-08: `pathBase` is the relativization base. Unset => ABSOLUTE paths
 *   (deterministic), NOT cwd-relative. The Phase-4 adapter fills it from
 *   `context.root` to emit workspace-root-relative CI annotation paths.
 * - D-10: `color` false => strip ANSI (CI / agents / pipes); true => keep it.
 *   The adapter passes `process.stdout.isTTY` (core stays free of `process`).
 * - EXE-03/D-04: `failFast` truncates the REPORTED list at the first
 *   Error-category diagnostic. This is a REPORTING concern only -- never a gather
 *   short-circuit (which would re-introduce `ngc`'s bug of dropping template /
 *   extended NG8xxx diagnostics behind an earlier TS error).
 */
export interface FormatOptions {
  pathBase?: string;
  color: boolean;
  failFast?: boolean;
}

/**
 * Renders the already-sorted, already-deduped diagnostics (D-09: `runTypecheck`
 * does the `ts.sortAndDeduplicateDiagnostics` -- this function does NOT re-sort)
 * into a human report via the injected compiler-cli `formatDiagnostics`
 * (NG codes + template codeframes, OUT-01).
 *
 * Pure: no `console`, no `process.exit`, no compiler import at module scope.
 * `ng` and `ts_` are INJECTED so the function is unit-testable with a fake (or
 * the real) `formatDiagnostics` and no `@angular/compiler-cli` mock (D-13). The
 * Phase-4 adapter owns stdout + exit.
 *
 * @param diagnostics ALREADY sorted + deduped by `runTypecheck` (D-09).
 * @param ng The injected `formatDiagnostics` surface (OUT-01 renderer).
 * @param ts_ The injected `typescript` namespace (`DiagnosticCategory` +
 *   `sys.useCaseSensitiveFileNames`).
 * @param options See {@link FormatOptions}.
 */
export function formatReport(
  diagnostics: readonly ts.Diagnostic[],
  ng: Pick<CompilerCli, 'formatDiagnostics'>,
  ts_: typeof import('typescript'),
  options: FormatOptions,
): string {
  let toRender = diagnostics;

  // EXE-03 / D-04: reporter-layer fail-fast -- truncate the REPORTED list at the
  // first Error (inclusive). The input is already sorted (D-09), so "first error"
  // is the first Error-category entry in alphabetical-by-file order. The gather
  // already ran every getter unconditionally; this only shortens the OUTPUT.
  if (options.failFast === true) {
    const firstError = diagnostics.findIndex(
      (diagnostic) => diagnostic.category === ts_.DiagnosticCategory.Error,
    );

    if (firstError >= 0) {
      toRender = diagnostics.slice(0, firstError + 1);
    }
  }

  const host = makeFormatHost(ts_, options.pathBase);
  const rendered = ng.formatDiagnostics([...toRender], host);

  return options.color ? rendered : rendered.replace(ANSI_PATTERN, '');
}

/**
 * Builds OUR deterministic `ts.FormatDiagnosticsHost` (D-08). compiler-cli's
 * `defaultFormatHost` is the documented trap: an identity `getCanonicalFileName`
 * (wrong for case-folding) and a cwd-based `getCurrentDirectory` (non-
 * deterministic). This host fixes both and forces `getNewLine: () => '\n'` so
 * Windows `\r\n` does not diverge cross-OS (Pitfall 2 / OUT-03 idempotency).
 */
function makeFormatHost(
  ts_: typeof import('typescript'),
  pathBase: string | undefined,
): ts.FormatDiagnosticsHost {
  const useCaseSensitiveFileNames = ts_.sys.useCaseSensitiveFileNames;

  return {
    // D-08: relativize to `pathBase` when set (workspace-root-relative CI
    // annotation paths); otherwise the sentinel forces ABSOLUTE emission.
    getCurrentDirectory: () => pathBase ?? ABSOLUTE_PATH_SENTINEL,
    // D-08: NON-identity (compiler-cli's identity default is wrong for case-fold).
    getCanonicalFileName: (fileName) =>
      useCaseSensitiveFileNames ? fileName : fileName.toLowerCase(),
    // Pitfall 2: force '\n' so output is byte-identical across OSes.
    getNewLine: () => '\n',
  };
}
