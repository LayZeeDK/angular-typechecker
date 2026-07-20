import {
  relativizePath,
  toDiagnosticRecord,
  toolVersion,
  type DiagnosticRecord,
} from './diagnostic-record';
import { evaluateResult, type Outcome } from './evaluate-result';
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

export interface JsonReportOptions {
  // The relativization base for `file` / `tsConfigPath` / advisory paths, yielding
  // repo-relative paths for same-root files (T-30-04; a Windows cross-drive path has
  // no relative form and stays absolute -- see relativizePath). The adapter fills it
  // from the workspace/context root (30-03).
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
export interface Advisories {
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
 * The `summary` block of {@link JsonReport}: the verdict (`outcome`/`success`,
 * DELEGATED to `evaluateResult` -- never re-derived from counts, D-07) plus the
 * scalar counts. `totalFilesCount` and `advisories` are OPTIONAL and present only
 * when non-empty (the value-presence spread idiom in {@link formatJsonReport}), so
 * the type mirrors the exact emitted shape (absent key vs `null` -- never `null`).
 */
export interface JsonReportSummary {
  outcome: Outcome;
  success: boolean;
  errorCount: number;
  warningCount: number;
  diagnosticCount: number;
  rootNamesCount: number;
  totalFilesCount?: number;
  suppressedThirdParty: number;
  suppressedInGraphErrorCount: number;
  suppressedInGraphWarningCount: number;
  advisories?: Advisories;
}

/**
 * The stable, agent-parseable JSON payload `formatJsonReport` serializes (REP-01 /
 * FMT-02). Named so the payload contract is a single importable, diffable type --
 * `formatJsonReport`'s return object is annotated with it, so adding, removing, or
 * retyping a field is a COMPILE error unless this interface is updated in lockstep,
 * the structural companion to the runtime `formatVersion` marker + the key-drift
 * snapshot tripwire (D-03). The emitted key ORDER is fixed by the object literal,
 * not this interface; the interface guards the shape.
 */
export interface JsonReport {
  formatVersion: number;
  tool: 'angular-typechecker';
  version: string;
  tsConfigPath: string;
  summary: JsonReportSummary;
  diagnostics: readonly DiagnosticRecord[];
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

  const payload: JsonReport = {
    formatVersion: FORMAT_VERSION,
    tool: 'angular-typechecker',
    version: toolVersion,
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

/**
 * Assembles the present-if-non-empty advisory block by spreading five per-field
 * partials (each `{}` when absent/empty, or `{ key: value }` when present), then
 * returns `undefined` when nothing is present. The spread order fixes the emitted
 * key order -- byte-identical to the historic single conditional-spread chain.
 */
function buildAdvisories(
  result: CoreResult,
  pathBase: string | undefined,
): Advisories | undefined {
  const advisories: Advisories = {
    ...templateCheckAbortedAdvisory(result, pathBase),
    ...skippedReferencesAdvisory(result, pathBase),
    ...suppressedInGraphFilesAdvisory(result, pathBase),
    ...notTypeCheckedDeclaredFilesAdvisory(result, pathBase),
    ...bundlerQueryImportsAdvisory(result),
  };

  return Object.keys(advisories).length > 0 ? advisories : undefined;
}

function templateCheckAbortedAdvisory(
  result: CoreResult,
  pathBase: string | undefined,
): Partial<Advisories> {
  if (result.templateCheckAborted === undefined) {
    return {};
  }

  return {
    templateCheckAborted: {
      fileName:
        result.templateCheckAborted.fileName !== undefined
          ? relativizePath(result.templateCheckAborted.fileName, pathBase)
          : null,
    },
  };
}

function skippedReferencesAdvisory(
  result: CoreResult,
  pathBase: string | undefined,
): Partial<Advisories> {
  if (!result.skippedReferences?.length) {
    return {};
  }

  return {
    skippedReferences: result.skippedReferences.map((reference) => ({
      referencePath: relativizePath(reference.referencePath, pathBase),
      reason: reference.reason,
    })),
  };
}

function suppressedInGraphFilesAdvisory(
  result: CoreResult,
  pathBase: string | undefined,
): Partial<Advisories> {
  if (result.suppressedInGraphFiles.length === 0) {
    return {};
  }

  return {
    suppressedInGraphFiles: result.suppressedInGraphFiles.map((file) =>
      relativizePath(file, pathBase),
    ),
  };
}

function notTypeCheckedDeclaredFilesAdvisory(
  result: CoreResult,
  pathBase: string | undefined,
): Partial<Advisories> {
  if (!result.notTypeCheckedDeclaredFiles?.length) {
    return {};
  }

  return {
    notTypeCheckedDeclaredFiles: result.notTypeCheckedDeclaredFiles.map(
      (file) => relativizePath(file, pathBase),
    ),
  };
}

function bundlerQueryImportsAdvisory(result: CoreResult): Partial<Advisories> {
  if (!result.bundlerQueryImports?.length) {
    return {};
  }

  return { bundlerQueryImports: [...result.bundlerQueryImports] };
}
