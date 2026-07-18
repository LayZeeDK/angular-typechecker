import { relativizePath, toDiagnosticRecord } from './diagnostic-record';
import { evaluateResult } from './evaluate-result';
import type { CoreResult } from './run-typecheck';
import type { SkippedReference } from './walk-references';

/**
 * The zero-dependency machine reporter (REP-01 / D-02..D-06). A PURE
 * `(CoreResult, ts_, opts) => string` mirroring the human `formatReport` contract
 * (format-report.ts:57-83) but WITHOUT the `ng` param -- it never touches
 * `@angular/compiler-cli`, so the JSON path never loads the heavy ESM peer (D-12).
 *
 * The payload is built ENTIRELY with `JSON.stringify` (D-06 -- zero new dependency;
 * escapes quotes/newlines/control chars) over the shared `diagnostic-record`
 * projection, and every message comes from `ts.flattenDiagnosticMessageText` (in the
 * projection), NEVER the colorizing human renderer -- so an ANSI byte is
 * structurally impossible (FMT-03 / D-10).
 *
 * The verdict (`summary.outcome`/`summary.success`) is DELEGATED to `evaluateResult`
 * -- the sole owner (D-07) -- NEVER re-derived from counts, so the
 * coverage-incomplete case (`errorCount === 0` but `success === false`) is preserved
 * as data (the cardinal anti-false-pass, Pitfall 13).
 */

// D-03: the payload marker version. Bump ONLY on a breaking shape change; the key
// drift-lock spec is the tripwire that forces a deliberate bump.
const FORMAT_VERSION = 1;

// The version is read from the REAL manifest (parse-args.ts:20 pattern): compiled
// `src/core/json-report.js` -> `../../package.json` is the package root. A unit test
// drift-locks the emitted value to the manifest so it can never go stale.
const packageManifest = require('../../package.json') as { version: string };

export interface JsonReportOptions {
  // The relativization base for `file` / `tsConfigPath` / advisory paths (never
  // leak an absolute local path -- T-30-04). The adapter fills it from the
  // workspace/context root (30-03).
  pathBase?: string;
  // Forwarded to `evaluateResult` for the DELEGATED `summary.outcome`/`success`
  // (D-07). NOT read to decide success in this module.
  maxWarnings?: number;
  strict?: boolean;
}

/**
 * The structured, present-if-non-empty advisory block mirroring the five fields
 * `emitAdvisoryNotices` surfaces (emit-advisory-notices.ts:23-31), as DATA. Every
 * FILE path is relativized (T-30-04); `bundlerQueryImports` are module specifiers,
 * not local paths, so they pass through verbatim.
 */
interface Advisories {
  templateCheckAborted?: { fileName: string | null };
  skippedReferences?: readonly {
    referencePath: string;
    reason: SkippedReference['reason'];
  }[];
  suppressedInGraphFiles?: readonly string[];
  notTypeCheckedDeclaredFiles?: readonly string[];
  bundlerQueryImports?: readonly string[];
}

/**
 * Serializes a completed `CoreResult` to the stable JSON payload (flat
 * `diagnostics[]` + rich `summary`). See the module header for the contract.
 */
export function formatJsonReport(
  result: CoreResult,
  ts_: typeof import('typescript'),
  opts: JsonReportOptions,
): string {
  const { success, outcome } = evaluateResult(result, {
    maxWarnings: opts.maxWarnings,
    strict: opts.strict,
  });

  const advisories = buildAdvisories(result, opts.pathBase);

  const payload = {
    formatVersion: FORMAT_VERSION,
    tool: 'angular-typechecker',
    version: packageManifest.version,
    tsConfigPath: relativizePath(result.tsConfigPath, opts.pathBase),
    summary: {
      outcome,
      success,
      errorCount: result.errorCount,
      warningCount: result.warningCount,
      diagnosticCount: result.diagnostics.length,
      rootNamesCount: result.rootNamesCount,
      // OBS-01: OPTIONAL -- omit the key when absent (no-Program guard paths); the
      // reporter never emits `null` for it (30-01 tolerance / Pitfall 14).
      ...(result.totalFilesCount !== undefined
        ? { totalFilesCount: result.totalFilesCount }
        : {}),
      suppressedThirdParty: result.suppressedThirdParty,
      suppressedInGraphErrorCount: result.suppressedInGraphErrorCount,
      suppressedInGraphWarningCount: result.suppressedInGraphWarningCount,
      ...(advisories !== undefined ? { advisories } : {}),
    },
    // Pitfall 10: map EVERY diagnostic through the shared projection -- a file-less
    // entry carries file:null / null positions and is NEVER dropped, so the payload
    // length is one-to-one with CoreResult.diagnostics.
    diagnostics: result.diagnostics.map((diagnostic) =>
      toDiagnosticRecord(diagnostic, ts_, opts.pathBase),
    ),
  };

  return JSON.stringify(payload, null, 2);
}

function buildAdvisories(
  result: CoreResult,
  pathBase: string | undefined,
): Advisories | undefined {
  const advisories: Advisories = {
    ...(result.templateCheckAborted !== undefined
      ? {
          templateCheckAborted: {
            fileName:
              result.templateCheckAborted.fileName !== undefined
                ? relativizePath(result.templateCheckAborted.fileName, pathBase)
                : null,
          },
        }
      : {}),
    ...(result.skippedReferences?.length
      ? {
          skippedReferences: result.skippedReferences.map((reference) => ({
            referencePath: relativizePath(reference.referencePath, pathBase),
            reason: reference.reason,
          })),
        }
      : {}),
    ...(result.suppressedInGraphFiles.length > 0
      ? {
          suppressedInGraphFiles: result.suppressedInGraphFiles.map((file) =>
            relativizePath(file, pathBase),
          ),
        }
      : {}),
    ...(result.notTypeCheckedDeclaredFiles?.length
      ? {
          notTypeCheckedDeclaredFiles: result.notTypeCheckedDeclaredFiles.map(
            (file) => relativizePath(file, pathBase),
          ),
        }
      : {}),
    ...(result.bundlerQueryImports?.length
      ? { bundlerQueryImports: [...result.bundlerQueryImports] }
      : {}),
  };

  return Object.keys(advisories).length > 0 ? advisories : undefined;
}
