import { createHash } from 'node:crypto';

import { toDiagnosticRecord, type DiagnosticRecord } from './diagnostic-record';
import { EXTENDED_DIAGNOSTIC_CATALOG } from './extended-catalog';
import type { CoreResult } from './run-typecheck';

/**
 * The SARIF 2.1.0 machine reporter (REP-02 / D-01..D-06). A PURE
 * `(CoreResult, ts_, pathBase) => Promise<string>` that builds a valid SARIF log
 * with `node-sarif-builder` -- reached ONLY via `await import('node-sarif-builder')`
 * (D-03), so the human / JSON / `--help` / CLI-boot paths never load it (nor its
 * transitive `fs-extra`). It REUSES the shared `diagnostic-record` projection
 * (D-13): positions / codes / paths / severity / message all come from
 * `toDiagnosticRecord`, so JSON and SARIF cannot drift -- this module NEVER calls
 * `path.relative` / `ngCodeOf` / `getLineAndCharacterOfPosition` /
 * `flattenDiagnosticMessageText` itself.
 *
 * The verdict is NOT this module's job (D-07): it emits ONE result per diagnostic
 * (a file-less record becomes a no-location result and is NEVER dropped -- D-01)
 * and never re-derives `success`; `evaluateResult` stays the sole verdict owner and
 * a reporter throw propagates as infra (exit 2), never a swallowed pass. No `\x1b`
 * byte can appear -- every message is the ANSI-free flattened text from the
 * projection. `node-sarif-builder` bakes `version: "2.1.0"` + `$schema` and owns the
 * `ruleIndex` linkage; each of the 18 NG rules is added ONCE and results set only
 * `ruleId` (D-05/D-06).
 */

// D-04: node-sarif-builder is CommonJS; `import type` erases at compile so neither
// it nor the transitive `@types/sarif` / `fs-extra` enter the static require graph.
import type * as NodeSarifBuilder from 'node-sarif-builder';

// D-02: the versioned partialFingerprints key. GitHub matches on ANY fingerprint
// version, so a later `/v2` recipe can co-exist without churning existing alerts.
const FINGERPRINT_KEY = 'atcFingerprint/v1';

// The tool driver informationUri (the public repository home).
const INFORMATION_URI = 'https://github.com/LayZeeDK/angular-typechecker';

// The per-code Angular extended-diagnostics help page (D-06). VERIFIED to resolve
// for the catalog codes incl. the two lower-numbered outliers NG8011 + NG8021 (A2).
const HELP_URI_BASE = 'https://angular.dev/extended-diagnostics/NG';

// The version is read from the REAL manifest (json-report.ts:31 pattern): compiled
// `src/core/sarif-report.js` -> `../../package.json` is the package root.
const packageManifest = require('../../package.json') as { version: string };

/**
 * Serializes a completed `CoreResult` to a SARIF 2.1.0 JSON string. See the module
 * header for the contract.
 */
export async function formatSarifReport(
  result: CoreResult,
  ts_: typeof import('typescript'),
  pathBase: string | undefined,
): Promise<string> {
  // D-03: reach node-sarif-builder ONLY via a lazy dynamic import. It is plain CJS,
  // so `(mod.default ?? mod)` is the defensive interop access (both work at runtime;
  // this form is future-proof if a later release changes the interop shape).
  const mod = await import('node-sarif-builder');
  const {
    SarifBuilder,
    SarifRunBuilder,
    SarifResultBuilder,
    SarifRuleBuilder,
  } =
    (mod as typeof NodeSarifBuilder & { default?: typeof NodeSarifBuilder })
      .default ?? mod;

  const runBuilder = new SarifRunBuilder().initSimple({
    toolDriverName: 'angular-typechecker',
    toolDriverVersion: packageManifest.version,
    url: INFORMATION_URI,
  });

  // D-06: add the 18-NG8xxx catalog rules ONCE. The builder computes ruleIndex when
  // a result's ruleId matches a rule id; TS#### / ATC9000x results reference their
  // rule by ruleId without a catalog entry. NEVER hand-compute ruleIndex.
  for (const entry of EXTENDED_DIAGNOSTIC_CATALOG) {
    runBuilder.addRule(
      new SarifRuleBuilder().initSimple({
        ruleId: 'NG' + entry.ngCode,
        shortDescriptionText: entry.shortDescription,
        helpUri: HELP_URI_BASE + entry.ngCode,
      }),
    );
  }

  // Map EVERY diagnostic through the shared projection and emit one result each --
  // results.length === result.diagnostics.length (D-01 never-drop, Pitfall 10).
  for (const diagnostic of result.diagnostics) {
    const record = toDiagnosticRecord(diagnostic, ts_, pathBase);
    const resultBuilder = new SarifResultBuilder().initSimple({
      level: toSarifLevel(record.severity),
      messageText: record.message,
      ruleId: record.code,
      // D-01: a file-less record omits fileUri + positions -> no `locations` key.
      ...(record.file !== null
        ? {
            fileUri: record.file,
            startLine: record.line ?? undefined,
            startColumn: record.column ?? undefined,
            endLine: record.endLine ?? undefined,
            endColumn: record.endColumn ?? undefined,
          }
        : {}),
    });
    // D-02: self-computed fingerprint (node-sarif-builder has no initSimple param
    // for it) written before addResult; a file-less record still gets one.
    resultBuilder.result.partialFingerprints = {
      [FINGERPRINT_KEY]: fingerprintOf(record),
    };
    runBuilder.addResult(resultBuilder);
  }

  const logBuilder = new SarifBuilder();
  logBuilder.addRun(runBuilder);

  // D-05: let the builder serialize (never hand-concatenate SARIF JSON).
  return logBuilder.buildSarifJsonString({ indent: false });
}

/**
 * The ONE SARIF-specific mapping: `DiagnosticRecord.severity`
 * (`error`/`warning`/`suggestion`/`message`) -> SARIF `Result.level`
 * (`error`/`warning`/`note`). `suggestion` and `message` both map to `note`.
 */
function toSarifLevel(
  severity: DiagnosticRecord['severity'],
): 'error' | 'warning' | 'note' {
  if (severity === 'error') {
    return 'error';
  }

  if (severity === 'warning') {
    return 'warning';
  }

  return 'note';
}

/**
 * A deterministic, OS-invariant `sha256` hex fingerprint over a stable tuple
 * (humanized code + repo-relative URI + ANSI-free message + 1-based start line +
 * 1-based start column), newline-joined so field boundaries are unambiguous (D-02).
 * The column is part of the tuple so two distinct diagnostics on the SAME line that
 * share a rule + message (e.g. an unparameterized NG8102 fixed-string message) still
 * get DISTINCT fingerprints. It contains NO absolute path, NO cwd, and NO volatile
 * field (tool version, duration), so it is byte-stable across the OS x Node matrix.
 * A file-less record still gets a fingerprint (empty-string sentinels for the missing
 * URI / line / column).
 */
function fingerprintOf(record: DiagnosticRecord): string {
  const tuple = [
    record.code,
    record.file ?? '',
    record.message,
    record.line ?? '',
    record.column ?? '',
  ].join('\n');

  return createHash('sha256').update(tuple, 'utf8').digest('hex');
}
