import { createHash } from 'node:crypto';

import {
  REFERENCE_NOT_FOUND_DIAGNOSTIC_CODE,
  ZERO_ROOT_NAMES_DIAGNOSTIC_CODE,
} from './diagnostic-codes';
import { familyOf, type Family } from './diagnostic-family';
import {
  toDiagnosticRecord,
  toolVersion,
  type DiagnosticRecord,
} from './diagnostic-record';
import { EXTENDED_DIAGNOSTIC_CATALOG } from './extended-catalog';
import type { CoreResult } from './run-typecheck';

/**
 * The SARIF 2.1.0 machine reporter (REP-02 / D-01..D-06 / RULE-01..04). A PURE
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
 * projection. `node-sarif-builder` bakes `version: "2.1.0"` + `$schema`.
 *
 * Rules are cataloged ON-DEMAND: one `reportingDescriptor` per DISTINCT `ruleId`
 * present in `result.diagnostics` (RULE-01), so a clean result yields an EMPTY
 * `rules[]`. Each rule carries `properties.tags` (exactly one diagnostic family via
 * `familyOf`, RULE-02), `defaultConfiguration.level` (from the reused
 * `toSarifLevel`, RULE-03), and `help.text` (RULE-04) -- all set by MUTATING the
 * builder's public `rule` (a `ReportingDescriptor`), the same escape hatch this
 * module uses one level down for `resultBuilder.result.partialFingerprints` (D-09,
 * no cast). `node-sarif-builder`'s `completeRunFields()` (invoked by
 * `buildSarifJsonString`) then auto-emits `run.artifacts[]` with `sourceLanguage`,
 * sets each location's `artifactLocation.index`, AND sets `result.ruleIndex` for
 * every result whose `ruleId` matches a cataloged rule -- which, with on-demand
 * cataloging, is every result. Every diagnostic thus resolves to a rule, so no
 * GitHub Code Scanning alert shows a blank rule description.
 */

// D-04: node-sarif-builder is CommonJS; `import type` erases at compile so neither
// it nor the transitive `@types/sarif` / `fs-extra` enter the static require graph.
import type * as NodeSarifBuilder from 'node-sarif-builder';

// D-02: the versioned partialFingerprints key. GitHub matches on ANY fingerprint
// version, so a later `/v2` recipe can co-exist without churning existing alerts.
const FINGERPRINT_KEY = 'atcFingerprint/v1';

// The tool driver informationUri (the public repository home). Also the helpUri for
// the `tool` family and the defensive extended-diagnostics fallback (D-07).
const INFORMATION_URI = 'https://github.com/LayZeeDK/angular-typechecker';

// The per-code Angular extended-diagnostics help page (D-06). VERIFIED to resolve
// for the catalog codes incl. the two lower-numbered outliers NG8011 + NG8021 (A2).
const HELP_URI_BASE = 'https://angular.dev/extended-diagnostics/NG';

// helpUri targets for the non-NG families (D-07, Claude's discretion; both verified
// to resolve). `help.text` is the RULE-04-critical field -- a slightly stale helpUri
// never blanks the GitHub rule-help panel.
const TYPESCRIPT_HELP_URI =
  'https://www.typescriptlang.org/docs/handbook/2/understanding-errors.html';
const TEMPLATE_TYPE_CHECK_HELP_URI =
  'https://angular.dev/tools/cli/template-typecheck';

// The NG8xxx catalog entries keyed by their SARIF ruleId (`NG` + ngCode) so the
// on-demand catalog can resolve the shortDescription (which also seeds help.text,
// D-07) without re-deriving the ngCode. Single source of truth:
// EXTENDED_DIAGNOSTIC_CATALOG (D-10, unchanged).
const EXTENDED_BY_RULE_ID = new Map(
  EXTENDED_DIAGNOSTIC_CATALOG.map(
    (entry) => ['NG' + entry.ngCode, entry] as const,
  ),
);

// Curated per-code strings for the two synthesized `tool` codes (D-07/D-08), keyed
// off the code constants so a future 90003 cannot silently reuse these. Consumer
// language -- what the reader should do about it, no internal jargon.
const TOOL_RULE_TEXT: Readonly<
  Record<string, { short: string; help: string }>
> = {
  ['ATC' + ZERO_ROOT_NAMES_DIAGNOSTIC_CODE]: {
    short: 'No files to type-check (empty or references-only tsconfig)',
    help: 'angular-typechecker resolved zero root names for this tsconfig. A references-only (solution-style) or empty tsconfig has nothing to check directly -- point the check at a tsconfig with real files, or check the referenced projects.',
  },
  ['ATC' + REFERENCE_NOT_FOUND_DIAGNOSTIC_CODE]: {
    short: 'A referenced tsconfig could not be found',
    help: "A tsconfig 'references' entry points at a path that does not exist. Fix or remove the reference so the referenced project can be type-checked.",
  },
};

/**
 * The per-rule metadata resolved once during the PASS-1 catalog fold: the family
 * (RULE-02), the SARIF level (RULE-03), the shortDescription (D-08, describes the
 * RULE not a single occurrence), the helpUri, and the help text (RULE-04).
 */
interface RuleMeta {
  family: Family;
  level: 'error' | 'warning' | 'note';
  shortDescription: string;
  helpUri: string;
  helpText: string;
}

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
    toolDriverVersion: toolVersion,
    url: INFORMATION_URI,
  });

  // PASS 1 (RULE-01): catalog rules ON-DEMAND -- one entry per DISTINCT ruleId
  // present in the diagnostics. Family via familyOf; level via the reused
  // toSarifLevel. A clean result adds no rule.
  const catalog = new Map<string, RuleMeta>();

  for (const diagnostic of result.diagnostics) {
    const record = toDiagnosticRecord(diagnostic, ts_, pathBase);
    const ruleId = record.code;
    const family = familyOf(record);
    const existing = catalog.get(ruleId);

    if (existing === undefined) {
      catalog.set(ruleId, buildRuleMeta(record, family));

      continue;
    }

    // D-04 (any-.html-occurrence-wins): only a `typescript` entry can ever upgrade,
    // and only to `template-type-check`. Rebuild the FULL metadata from the template
    // occurrence so the tag AND the shortDescription / helpUri / help.text all describe
    // the template family -- flipping only the tag would leave the rule tagged
    // `template-type-check` while still carrying the TypeScript description and URL. The
    // level is preserved as first-observed (D-06); a code normally carries one
    // configured severity per compilation, so mixed severities in one run are a rare
    // edge. `typescript` -> `template-type-check` is the only transition and it never
    // reverses, so the emitted rule is order-independent.
    if (
      family === 'template-type-check' &&
      existing.family !== 'template-type-check'
    ) {
      const upgraded = buildRuleMeta(record, 'template-type-check');
      upgraded.level = existing.level;
      catalog.set(ruleId, upgraded);
    }
  }

  // Emit one decorated rule per catalog entry (RULE-02/03/04).
  for (const [ruleId, meta] of catalog) {
    const ruleBuilder = new SarifRuleBuilder().initSimple({
      ruleId,
      shortDescriptionText: meta.shortDescription,
      helpUri: meta.helpUri,
    });
    // D-09: set the three fields initSimple cannot express by mutating the public
    // `rule` (a ReportingDescriptor), mirroring the partialFingerprints escape hatch
    // below. @types/sarif types all three natively, so no cast is needed.
    ruleBuilder.rule.properties = { tags: [meta.family] };
    ruleBuilder.rule.defaultConfiguration = { level: meta.level };
    ruleBuilder.rule.help = { text: meta.helpText };
    runBuilder.addRule(ruleBuilder);
  }

  // PASS 2: map EVERY diagnostic through the shared projection and emit one result
  // each -- results.length === result.diagnostics.length (D-01 never-drop, Pitfall
  // 10). completeRunFields (in buildSarifJsonString) then sets result.ruleIndex for
  // each result whose ruleId matches a cataloged rule -- which is every result.
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
 * Resolves a rule's metadata from the FIRST diagnostic that fired it, per family
 * (D-07/D-08). The shortDescription and help text describe the RULE, never a single
 * occurrence's message. Per-code TypeScript help is an explicit anti-feature (there
 * are thousands of TS codes), so TS + template-type-check use per-FAMILY generic
 * help; NG seeds both strings from the catalog shortDescription (D-10).
 */
function buildRuleMeta(record: DiagnosticRecord, family: Family): RuleMeta {
  const level = toSarifLevel(record.severity);
  const ruleId = record.code;

  if (family === 'extended-diagnostics') {
    return buildExtendedRuleMeta(level, ruleId);
  }

  if (family === 'tool') {
    return buildToolRuleMeta(level, ruleId);
  }

  if (family === 'template-type-check') {
    return buildTemplateRuleMeta(level, ruleId);
  }

  return buildTypeScriptRuleMeta(level, ruleId);
}

/**
 * The `extended-diagnostics` (NG8xxx) family builder: resolves the shortDescription
 * from the on-demand catalog (which also seeds help.text, D-07).
 */
function buildExtendedRuleMeta(
  level: RuleMeta['level'],
  ruleId: string,
): RuleMeta {
  const entry = EXTENDED_BY_RULE_ID.get(ruleId);
  // family === 'extended-diagnostics' implies the ngCode is a catalog member, so
  // `entry` is present in practice; the `??` keeps this total without a non-null
  // assertion (banned by the maxWarnings:0 lint gate).
  const shortDescription =
    entry?.shortDescription ?? 'Angular extended diagnostic ' + ruleId;

  return {
    family: 'extended-diagnostics',
    level,
    shortDescription,
    helpUri:
      entry !== undefined ? HELP_URI_BASE + entry.ngCode : INFORMATION_URI,
    helpText: shortDescription,
  };
}

/**
 * The `tool` family builder: the two synthesized ATC codes get curated per-code
 * strings, everything else falls back to a generic README pointer (D-07/D-08).
 */
function buildToolRuleMeta(level: RuleMeta['level'], ruleId: string): RuleMeta {
  const curated = TOOL_RULE_TEXT[ruleId];

  return {
    family: 'tool',
    level,
    shortDescription:
      curated?.short ?? `An angular-typechecker diagnostic (${ruleId})`,
    helpUri: INFORMATION_URI,
    helpText:
      curated?.help ??
      `An angular-typechecker diagnostic (${ruleId}). See the project README for details.`,
  };
}

/**
 * The `template-type-check` family builder: per-FAMILY generic help (per-code help
 * is an explicit anti-feature).
 */
function buildTemplateRuleMeta(
  level: RuleMeta['level'],
  ruleId: string,
): RuleMeta {
  return {
    family: 'template-type-check',
    level,
    shortDescription: `Angular template type-check diagnostic ${ruleId}`,
    helpUri: TEMPLATE_TYPE_CHECK_HELP_URI,
    helpText: `An Angular template type-check diagnostic (${ruleId}) raised while type-checking a component template. See the Angular template type-checking guide.`,
  };
}

/**
 * The `typescript` family builder: per-FAMILY generic help (there are thousands of
 * TS codes, so per-code help is an explicit anti-feature).
 */
function buildTypeScriptRuleMeta(
  level: RuleMeta['level'],
  ruleId: string,
): RuleMeta {
  return {
    family: 'typescript',
    level,
    shortDescription: `TypeScript diagnostic ${ruleId}`,
    helpUri: TYPESCRIPT_HELP_URI,
    helpText: `A TypeScript compiler diagnostic (${ruleId}). See the TypeScript error reference for the meaning of this code and how to resolve it.`,
  };
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
