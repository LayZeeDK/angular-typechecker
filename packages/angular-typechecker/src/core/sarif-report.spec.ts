import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { validateSarif } from '@workspace/test-util';

import { NG } from './diagnostic-codes';
import { evaluateResult } from './evaluate-result';
import { EXTENDED_DIAGNOSTIC_CATALOG } from './extended-catalog';
import type { CoreResult } from './run-typecheck';
import { formatSarifReport } from './sarif-report';

// ESC (0x1b) built from a char code so no literal control char lives in source
// (CLAUDE.md ASCII rule). Used to assert the SARIF payload carries NO ANSI.
const ESC = String.fromCharCode(0x1b);

const TS2322 = 2322;
const ATC90001 = 90001;

const ERROR = ts.DiagnosticCategory.Error;
const WARNING = ts.DiagnosticCategory.Warning;
const SUGGESTION = ts.DiagnosticCategory.Suggestion;
const MESSAGE = ts.DiagnosticCategory.Message;

// The SAME hand-counted off-by-one fixture the JSON reporter pins
// (json-report.spec.ts:37-57): 0-based line 11 / char 4 at `start`, 0-based line
// 11 / char 19 at `endPos`, so the projection MUST yield 1-based startLine 12 /
// startColumn 5 / endLine 12 / endColumn 20. Reusing it means JSON and SARIF pin
// IDENTICAL values (D-13); an off-by-one is invisible to a snapshot (Pitfall 3).
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

// Two diagnostics that share the SAME line, SAME rule code, and SAME (unparameterized)
// message text but sit at DIFFERENT columns -- the exact same-line-collision scenario
// the fingerprint fix (commit d3e1cd3) closed. Prior to that fix the tuple omitted
// `column`, so these two would have produced IDENTICAL `atcFingerprint/v1` values.
function diagAtColumn(character: number): ts.Diagnostic {
  const file = {
    fileName: 'D:/ws/proj/src/y.component.ts',
    getLineAndCharacterOfPosition: () => ({ line: 11, character }),
  } as unknown as ts.SourceFile;

  return {
    category: ERROR,
    code: TS2322,
    file,
    start: character,
    length: 1,
    messageText: 'Type X is not assignable to type Y.',
  } as ts.Diagnostic;
}

// A synthesized guard shape (diagnostic-codes.ts:122-135): file/start/length are
// undefined BY CONSTRUCTION -> a no-location SARIF result (D-01).
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

// The file-SET but position-ABSENT shape (the SAME fixture json-report.spec.ts pins):
// the diagnostic carries its owning `file` yet has no `start`/`length`. `positionsOf`
// short-circuits on the undefined `start`, so `getLineAndCharacterOfPosition` is NEVER
// invoked -- it throws here to lock that. SARIF must still emit a LOCATED result
// (artifactLocation set) but with NO region, since node-sarif-builder only builds a
// region when `startLine` is neither null nor undefined.
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

// The SAME TS2322 rule code as positionedDiag but attributed to an external .html
// template -- the D-04 any-.html-wins case. Family is derived from the extension, so
// this occurrence classifies as template-type-check.
function tsInHtml(): ts.Diagnostic {
  const file = {
    fileName: 'D:/ws/proj/src/y.component.html',
    getLineAndCharacterOfPosition: () => ({ line: 0, character: 0 }),
  } as unknown as ts.SourceFile;

  return {
    category: ERROR,
    code: TS2322,
    file,
    start: 0,
    length: 1,
    messageText: 'Type X is not assignable to type Y.',
  } as ts.Diagnostic;
}

// A negative Angular diagnostic (NG code) attributed to a file. `rawCode` is the
// negative encoding via NG(); the category (hence severity) is irrelevant to the
// family tag under test.
function negativeCodeDiag(rawCode: number, fileName: string): ts.Diagnostic {
  const file = {
    fileName,
    getLineAndCharacterOfPosition: () => ({ line: 0, character: 0 }),
  } as unknown as ts.SourceFile;

  return {
    category: WARNING,
    code: rawCode,
    file,
    start: 0,
    length: 1,
    messageText: 'an Angular template diagnostic',
  } as ts.Diagnostic;
}

// The tool-version drift-lock reads the SAME manifest the reporter reads (two dirs
// above src/core/), via the repo's established readFileSync idiom.
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

interface SarifPhysicalLocation {
  artifactLocation: { uri: string };
  region: {
    startLine?: number;
    startColumn?: number;
    endLine?: number;
    endColumn?: number;
  };
}

interface SarifResult {
  ruleId: string;
  // Present once a result's ruleId matches a cataloged rule -- which, with
  // on-demand cataloging, is every result (completeRunFields sets it).
  ruleIndex?: number;
  level: string;
  message: { text: string };
  locations?: { physicalLocation: SarifPhysicalLocation }[];
  partialFingerprints?: Record<string, string>;
}

interface SarifRule {
  id: string;
  shortDescription?: { text: string };
  helpUri?: string;
  properties?: { tags?: string[] };
  defaultConfiguration?: { level?: string };
  help?: { text: string };
}

interface SarifLog {
  version: string;
  runs: {
    tool: { driver: { name: string; version: string; rules: SarifRule[] } };
    results: SarifResult[];
  }[];
}

async function sarifOf(result: CoreResult): Promise<SarifLog> {
  return JSON.parse(
    await formatSarifReport(result, ts, 'D:/ws/proj'),
  ) as SarifLog;
}

describe('formatSarifReport (REP-02 / D-01..D-06 / VER-01)', () => {
  it('emits a SARIF 2.1.0 log with the angular-typechecker driver and catalogs one rule per fired ruleId on demand', async () => {
    const log = await sarifOf(
      coreResult({ diagnostics: [positionedDiag()], errorCount: 1 }),
    );

    expect(log.version).toBe('2.1.0');
    expect(log.runs[0].tool.driver.name).toBe('angular-typechecker');
    expect(log.runs[0].tool.driver.version).toBe(manifestVersion);

    const rules = log.runs[0].tool.driver.rules;

    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe('TS2322');
    expect(rules[0].properties?.tags).toEqual(['typescript']);
    expect(rules[0].defaultConfiguration?.level).toBe('error');
    expect(rules[0].shortDescription?.text).toBe(
      'TypeScript diagnostic TS2322',
    );
    expect(rules[0].help?.text.length ?? 0).toBeGreaterThan(0);
    expect(rules[0].helpUri).toBeDefined();
  });

  it('catalogs one rule per DISTINCT fired ruleId, tagging the synthesized code as a tool rule with curated help (RULE-01/02/04)', async () => {
    const log = await sarifOf(
      coreResult({
        diagnostics: [positionedDiag(), filelessDiag()],
        errorCount: 2,
      }),
    );

    const rules = log.runs[0].tool.driver.rules;

    expect(rules.map((rule) => rule.id)).toEqual(['TS2322', 'ATC90001']);

    const tool = rules.find((rule) => rule.id === 'ATC90001');

    expect(tool?.properties?.tags).toEqual(['tool']);
    expect(tool?.shortDescription?.text).toBe(
      'No files to type-check (empty or references-only tsconfig)',
    );
    expect(tool?.help?.text).toContain('resolved zero root names');
  });

  it('resolves a ruleId seen in both a .ts and a .html file to template-type-check, in either order (D-04 any-.html-wins)', async () => {
    const orders: ts.Diagnostic[][] = [
      [positionedDiag(), tsInHtml()],
      [tsInHtml(), positionedDiag()],
    ];

    for (const diagnostics of orders) {
      const log = await sarifOf(coreResult({ diagnostics, errorCount: 2 }));
      const rules = log.runs[0].tool.driver.rules;

      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe('TS2322');
      expect(rules[0].properties?.tags).toEqual(['template-type-check']);
    }
  });

  it('keeps the FIRST observed severity level for a ruleId seen at mixed severities in one run (D-06 tie-break)', async () => {
    const warningFirst = {
      ...positionedDiag(),
      category: WARNING,
    } as ts.Diagnostic;
    const errorSecond = {
      ...positionedDiag(),
      category: ERROR,
    } as ts.Diagnostic;
    const log = await sarifOf(
      coreResult({
        diagnostics: [warningFirst, errorSecond],
        errorCount: 1,
        warningCount: 1,
      }),
    );

    const rules = log.runs[0].tool.driver.rules;

    expect(rules).toHaveLength(1);
    // First observed is a warning -> the rule level stays 'warning' even though a
    // later occurrence of the same ruleId is an error (never overwritten).
    expect(rules[0].defaultConfiguration?.level).toBe('warning');
  });

  it('tags a catalog NG code extended-diagnostics (keeping its angular.dev helpUri, even when .html-attributed) and a non-catalog NG code template-type-check', async () => {
    const inCatalogNgCode = EXTENDED_DIAGNOSTIC_CATALOG[0].ngCode;
    const log = await sarifOf(
      coreResult({
        diagnostics: [
          negativeCodeDiag(
            NG(inCatalogNgCode),
            'D:/ws/proj/src/a.component.html',
          ),
          negativeCodeDiag(NG(8002), 'D:/ws/proj/src/b.component.html'),
        ],
        warningCount: 2,
      }),
    );

    const rules = log.runs[0].tool.driver.rules;
    const extended = rules.find((rule) => rule.id === 'NG' + inCatalogNgCode);
    const template = rules.find((rule) => rule.id === 'NG8002');

    expect(extended?.properties?.tags).toEqual(['extended-diagnostics']);
    expect(extended?.helpUri).toBe(
      'https://angular.dev/extended-diagnostics/NG' + inCatalogNgCode,
    );
    expect(template?.properties?.tags).toEqual(['template-type-check']);
  });

  it('maps a located diagnostic to ruleId + level + message.text and a 1-based region (hand-counted off-by-one)', async () => {
    const log = await sarifOf(
      coreResult({ diagnostics: [positionedDiag()], errorCount: 1 }),
    );
    const located = log.runs[0].results[0];

    expect(located.ruleId).toBe('TS2322');
    expect(located.level).toBe('error');
    expect(located.message.text).toBe('Type X is not assignable to type Y.');

    const physical = located.locations?.[0].physicalLocation;

    expect(physical?.artifactLocation.uri).toBe('src/y.component.ts');
    expect(physical?.region.startLine).toBe(12);
    expect(physical?.region.startColumn).toBe(5);
    expect(physical?.region.endLine).toBe(12);
    expect(physical?.region.endColumn).toBe(20);
  });

  it('never drops a file-less diagnostic -- emits it as a no-location result, length one-to-one (D-01)', async () => {
    const result = coreResult({
      diagnostics: [positionedDiag(), filelessDiag()],
      errorCount: 2,
    });
    const log = await sarifOf(result);

    expect(log.runs[0].results).toHaveLength(result.diagnostics.length);

    const fileless = log.runs[0].results[1];

    expect(fileless.ruleId).toBe('ATC90001');
    expect('locations' in fileless).toBe(false);
  });

  it('emits a file-SET but position-ABSENT diagnostic as a LOCATED result with NO region, length one-to-one, schema-valid (FIX 4 / REP-02)', async () => {
    const result = coreResult({
      diagnostics: [fileSetPositionAbsentDiag()],
      errorCount: 1,
    });
    const log = await sarifOf(result);

    expect(log.runs[0].results).toHaveLength(result.diagnostics.length);

    const physical = log.runs[0].results[0].locations?.[0].physicalLocation;

    // The artifact IS reported (contrast the file-less case, which omits `locations`)...
    expect(physical?.artifactLocation.uri).toBe('src/z.component.ts');
    // ...but node-sarif-builder only builds a region when startLine is neither null
    // nor undefined, so a position-absent diagnostic carries NO region at all --
    // never a degenerate 0/1 span that would mis-anchor a GitHub alert.
    expect(physical?.region).toBeUndefined();

    const { valid, errors } = validateSarif(
      await formatSarifReport(result, ts, 'D:/ws/proj'),
    );

    expect(valid, errors).toBe(true);
  });

  it('renders a clean CoreResult as an EMPTY results array AND an empty on-demand rule catalog, schema-valid (RULE-01)', async () => {
    const log = await sarifOf(coreResult());

    expect(log.runs[0].results).toHaveLength(0);
    // No diagnostic fired, so no ruleId is cataloged on demand -- an empty rules
    // array is valid SARIF.
    expect(log.runs[0].tool.driver.rules).toHaveLength(0);

    const { valid, errors } = validateSarif(
      await formatSarifReport(coreResult(), ts, 'D:/ws/proj'),
    );

    expect(valid, errors).toBe(true);
  });

  it('writes a versioned partialFingerprints (atcFingerprint/v1 sha256 hex) on every result, file-less included (D-02)', async () => {
    const log = await sarifOf(
      coreResult({
        diagnostics: [positionedDiag(), filelessDiag()],
        errorCount: 2,
      }),
    );

    expect(log.runs[0].results).toHaveLength(2);

    for (const result of log.runs[0].results) {
      expect(result.partialFingerprints?.['atcFingerprint/v1']).toMatch(
        /^[0-9a-f]{64}$/,
      );
    }
  });

  it('gives two same-line, same-rule, same-message diagnostics DISTINCT fingerprints when their columns differ (D-02 collision fix)', async () => {
    const log = await sarifOf(
      coreResult({
        diagnostics: [diagAtColumn(5), diagAtColumn(10)],
        errorCount: 2,
      }),
    );

    expect(log.runs[0].results).toHaveLength(2);

    const [first, second] = log.runs[0].results;

    // Same rule + message (the collision precondition) but different columns...
    expect(first.ruleId).toBe(second.ruleId);
    expect(first.message.text).toBe(second.message.text);
    expect(first.locations?.[0].physicalLocation.region.startLine).toBe(
      second.locations?.[0].physicalLocation.region.startLine,
    );
    expect(first.locations?.[0].physicalLocation.region.startColumn).not.toBe(
      second.locations?.[0].physicalLocation.region.startColumn,
    );

    // ...must NOT collide on partialFingerprints (GitHub would otherwise merge two
    // distinct alerts into one).
    expect(first.partialFingerprints?.['atcFingerprint/v1']).not.toBe(
      second.partialFingerprints?.['atcFingerprint/v1'],
    );
  });

  it('maps each severity to its SARIF level (suggestion/message -> note)', async () => {
    const cases: readonly [ts.DiagnosticCategory, string][] = [
      [ERROR, 'error'],
      [WARNING, 'warning'],
      [SUGGESTION, 'note'],
      [MESSAGE, 'note'],
    ];

    for (const [category, level] of cases) {
      const log = await sarifOf(
        coreResult({
          diagnostics: [{ ...positionedDiag(), category } as ts.Diagnostic],
        }),
      );

      expect(log.runs[0].results[0].level).toBe(level);
    }
  });

  it('emits no ANSI byte and is byte-identical under FORCE_COLOR=1 (structurally plain)', async () => {
    const result = coreResult({
      diagnostics: [positionedDiag()],
      errorCount: 1,
    });

    const plain = await formatSarifReport(result, ts, 'D:/ws/proj');

    expect(plain).not.toContain(ESC);

    const previous = process.env.FORCE_COLOR;
    process.env.FORCE_COLOR = '1';

    try {
      const forced = await formatSarifReport(result, ts, 'D:/ws/proj');

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

  it('serializes the full SARIF shape (snapshot, driver.version redacted for release-stability)', async () => {
    const log = await sarifOf(
      coreResult({
        diagnostics: [positionedDiag(), filelessDiag()],
        errorCount: 2,
      }),
    );

    expect(log.version).toBe('2.1.0');
    expect(log.runs[0].tool.driver.version).toBe(manifestVersion);

    const redacted = {
      ...log,
      runs: log.runs.map((run) => ({
        ...run,
        tool: {
          ...run.tool,
          driver: { ...run.tool.driver, version: '[version]' },
        },
      })),
    };

    expect(redacted).toMatchSnapshot();
  });

  it('never masks the verdict: a coverage-incomplete CoreResult stays success:false while SARIF emits a result per diagnostic (D-07 / VER-01)', async () => {
    const result = coreResult({
      diagnostics: [positionedDiag(), filelessDiag()],
      errorCount: 0,
      suppressedInGraphErrorCount: 1,
      suppressedInGraphFiles: ['D:/ws/proj/libs/x/src/y.ts'],
    });

    const verdict = evaluateResult(result, {});

    expect(verdict.success).toBe(false);
    expect(verdict.outcome).toBe('coverage-incomplete');

    const log = await sarifOf(result);

    expect(log.runs[0].results).toHaveLength(result.diagnostics.length);
  });
});
