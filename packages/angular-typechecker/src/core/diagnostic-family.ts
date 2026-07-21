import { ngCodeOf } from './diagnostic-codes';
import type { DiagnosticRecord } from './diagnostic-record';
import { EXTENDED_DIAGNOSTIC_CATALOG } from './extended-catalog';

/**
 * The diagnostic-family classifier (RULE-02 / D-01..D-03). A PURE
 * `(DiagnosticRecord) => Family` used ONLY by the SARIF reporter to tag each
 * cataloged rule with its family. It reads ONLY `record.rawCode` +
 * `record.file`, adds NO field to `DiagnosticRecord`, and imports nothing
 * beyond two dependency-free `src/core` siblings -- no `console`, no `process`,
 * no `@angular/compiler-cli` -- so it stays inside the `src/core` lint boundary
 * and never breaches the lazy SARIF import firewall.
 *
 * `familyOf` is imported by `sarif-report.ts` ONLY and is NOT re-exported from
 * `src/index.ts`, so the family concept never leaks into the public API or the
 * JSON / human payloads (D-01 / D-12).
 */

// RULE-02 fixes this set to exactly four literals -- do not rename, do not add a
// fifth.
export type Family =
  | 'typescript'
  | 'template-type-check'
  | 'extended-diagnostics'
  | 'tool';

// The 18 catalog ngCodes with ONE source of truth (D-02): derived from
// `EXTENDED_DIAGNOSTIC_CATALOG` so an upstream catalog change cannot desync this
// membership test.
const EXTENDED_NG_CODES: ReadonlySet<number> = new Set(
  EXTENDED_DIAGNOSTIC_CATALOG.map((entry) => entry.ngCode),
);

/**
 * Classifies a normalized diagnostic into its SARIF rule family.
 *
 * The CHECK ORDER is LOAD-BEARING and mirrors `codeStringOf`
 * (`rawCode < 0` -> NG, `>= 90000` -> ATC, else TS) so the emitted code label
 * and the family can never disagree. The `rawCode` sign/range checks MUST run
 * BEFORE the `.html` heuristic: an external-template extended diagnostic is
 * negative AND `.html`-attributed, so an `.html`-first order would wrongly
 * downgrade it from `extended-diagnostics` to `template-type-check`. Steps 1-2
 * return for every negative and every synthesized code, so the `.html` test is
 * reached only for a TypeScript code.
 *
 * D-03 (accepted imprecision, deferred as RULE-FUT-01): an INLINE-template
 * TypeScript error attributed to a component `.ts` file stays `typescript` --
 * family is derived from the file extension, and threading the diagnostic's
 * template origin through the record to fix this is out of the v1 contract.
 */
export function familyOf(record: DiagnosticRecord): Family {
  if (record.rawCode < 0) {
    return EXTENDED_NG_CODES.has(ngCodeOf(record.rawCode))
      ? 'extended-diagnostics'
      : 'template-type-check';
  }

  if (record.rawCode >= 90000) {
    return 'tool';
  }

  if (record.file !== null && record.file.endsWith('.html')) {
    return 'template-type-check';
  }

  return 'typescript';
}
