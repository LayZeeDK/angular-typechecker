import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  findWorkspaceRoot,
  redactVolatile,
  validateSarif,
} from '@workspace/test-util';

import { run } from '../cli/main';
import typecheckExecutor from '../executors/typecheck/executor';

// VER-02 (D-01/D-02/D-03) + RULE-01..04 (Phase 33) -- the SARIF machine reporter
// proven over REAL cold-compiler fixtures through BOTH run() and the Nx executor.
// Mirrors machine-reporters-json.integration.spec.ts (cwd pin, executor dual) but
// for --format sarif, adding the TRUE 2.1.0 schema validation (validateSarif =
// committed draft-07 schema + ajv + ajv-formats) that complements Phase 31's golden
// snapshot.
//
//   - layout-b-host: mixed TS2322 + NG8002 (external .html template) -- the
//     Windows path -> forward-slash artifactLocation.uri conversion (VER-02), and
//     the `typescript` + `template-type-check` family tags over a real fixture.
//   - global-diagnostics: file-less TS2318 -- the SARIF no-`locations` result that
//     is NEVER dropped (Phase-31 D-01), catalogued as a single `typescript` rule
//     that all ten results resolve to by ruleIndex.
//   - extended-content-projection: a real NG8011 extended diagnostic -- the
//     `extended-diagnostics` family tag keeping its angular.dev helpUri (RULE-02/04).
//   - solution-style-all-missing: two file-less ATC90002 not-found errors -- the
//     `tool` family tag (RULE-02) over the fourth and final Family literal.
//
// Phase 33 (RULE-01..04): each cataloged rule now carries properties.tags (the
// family), defaultConfiguration.level, and help.text, and every result carries a
// ruleIndex into the on-demand rules[] (one entry per DISTINCT fired ruleId). The
// two committed redacted snapshots (layout-b-host + global-diagnostics) are the
// release-bearing proof; the extended + tool blocks assert their family tag
// EXPLICITLY rather than by snapshot -- the ATC90002 message embeds the resolved
// (absolute) tsconfig path, which is neither cross-OS byte-stable nor drive-letter
// clean, so that fixture is intentionally NOT snapshotted.
//
// The committed Windows-authored redacted snapshot reproducing byte-for-byte on
// Linux/macOS IS the cross-OS artifactLocation.uri proof (partialFingerprints are
// already OS-invariant per Phase-31 D-02).

interface SarifArtifactLocation {
  uri?: string;
}

interface SarifPhysicalLocation {
  artifactLocation?: SarifArtifactLocation;
}

interface SarifLocation {
  physicalLocation?: SarifPhysicalLocation;
}

interface SarifResult {
  ruleId?: string;
  // Present once a result's ruleId matches a cataloged rule -- which, with
  // on-demand cataloging (RULE-01), is every result (completeRunFields sets it).
  ruleIndex?: number;
  locations?: SarifLocation[];
}

// The run tool driver's on-demand rule catalog (RULE-01..04): one reportingDescriptor
// per DISTINCT fired ruleId, each carrying properties.tags (the family), a
// defaultConfiguration level, and help text alongside its helpUri.
interface SarifRule {
  id: string;
  shortDescription?: { text: string };
  helpUri?: string;
  properties?: { tags?: string[] };
  defaultConfiguration?: { level?: string };
  help?: { text: string };
}

interface SarifToolDriver {
  rules?: SarifRule[];
}

interface SarifRun {
  tool: { driver: SarifToolDriver };
  results: SarifResult[];
}

interface SarifLog {
  runs: SarifRun[];
}

const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

const layoutBHostTsConfig = join(
  workspaceRoot,
  'fixtures',
  'layout-b-host',
  'tsconfig.json',
);
const globalDiagnosticsTsConfig = join(
  workspaceRoot,
  'fixtures',
  'global-diagnostics',
  'tsconfig.json',
);
// Phase 33 -- the extended-diagnostics family: a single real NG8011 warning (the
// fixture's only diagnostic, locked by extended-catalog.integration.spec.ts).
const extendedContentProjectionTsConfig = join(
  workspaceRoot,
  'fixtures',
  'extended-content-projection',
  'tsconfig.app.json',
);
// Phase 33 -- the tool family: two file-less ATC90002 not-found errors (the
// fixture's only diagnostics, locked by walk-references.integration.spec.ts).
const solutionStyleAllMissingTsConfig = join(
  workspaceRoot,
  'fixtures',
  'solution-style-all-missing',
  'tsconfig.json',
);

const env = { ...process.env, NO_COLOR: '1' };

/** Render `--format sarif` for one fixture through the CLI adapter, pure stdout. */
async function runSarif(tsConfig: string): Promise<string> {
  const { stdout } = await run(['-c', tsConfig, '--format', 'sarif'], env);

  return stdout;
}

/**
 * Drive the Nx executor over one fixture with `--format sarif`, capturing the raw
 * `process.stdout.write` payload (matching builder.integration.spec.ts). context.root
 * = workspaceRoot mirrors run()'s cwd-derived pathBase so the two payloads are
 * byte-identical after redaction.
 */
async function captureExecutorSarif(tsConfig: string): Promise<string> {
  const chunks: string[] = [];
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: unknown): boolean => {
    chunks.push(typeof chunk === 'string' ? chunk : String(chunk));

    return true;
  }) as typeof process.stdout.write;

  try {
    // Derive the ExecutorContext type from the executor's own signature -- core/
    // is nx-free (D-11), so this spec never imports @nx/devkit. normalizeOptions
    // reads only context.root.
    const context = {
      root: workspaceRoot,
    } as Parameters<typeof typecheckExecutor>[1];
    await typecheckExecutor({ tsConfig, format: 'sarif' }, context);
  } finally {
    process.stdout.write = originalWrite;
  }

  return chunks.join('');
}

/** Every artifactLocation.uri across every result location in the log. */
function artifactUris(payload: SarifLog): string[] {
  const uris: string[] = [];

  for (const run_ of payload.runs) {
    for (const result of run_.results) {
      for (const location of result.locations ?? []) {
        const uri = location.physicalLocation?.artifactLocation?.uri;

        if (typeof uri === 'string') {
          uris.push(uri);
        }
      }
    }
  }

  return uris;
}

/** The on-demand rule catalog of the first (only) run. */
function rulesOf(payload: SarifLog): SarifRule[] {
  return payload.runs[0].tool.driver.rules ?? [];
}

/** The cataloged rule ids, sorted so assertions are catalog-order-independent. */
function ruleIds(payload: SarifLog): string[] {
  return rulesOf(payload)
    .map((rule) => rule.id)
    .sort();
}

/**
 * Looks a cataloged rule up by id, failing LOUDLY (naming the ids that ARE present)
 * when it is absent -- so a missing rule reads as a clear assertion failure rather
 * than an undefined-property crash downstream.
 */
function ruleById(payload: SarifLog, id: string): SarifRule {
  const rule = rulesOf(payload).find((candidate) => candidate.id === id);

  if (rule === undefined) {
    throw new Error(
      `SARIF rule '${id}' is absent; cataloged rule ids: [${ruleIds(payload).join(', ')}]`,
    );
  }

  return rule;
}

/**
 * Asserts every result resolves to a cataloged rule: its ruleIndex is a number that
 * indexes back to a rule whose id equals the result's ruleId (RULE-01, the
 * completeRunFields ruleIndex wiring). A result whose ruleId should be cataloged but
 * carries NO ruleIndex is a defect, not snapshot noise.
 */
function expectEveryResultResolvesToItsRule(payload: SarifLog): void {
  const rules = rulesOf(payload);

  for (const result of payload.runs[0].results) {
    expect(result.ruleIndex).toBeTypeOf('number');
    expect(rules[result.ruleIndex ?? -1]?.id).toBe(result.ruleId);
  }
}

let originalCwd: string;

beforeAll(() => {
  originalCwd = process.cwd();
  process.chdir(workspaceRoot);
});

afterAll(() => {
  process.chdir(originalCwd);
});

describe('SARIF reporter integration -- layout-b-host (mixed TS2322 + NG8002)', () => {
  let stdout: string;
  let payload: SarifLog;

  beforeAll(async () => {
    stdout = await runSarif(layoutBHostTsConfig);
    payload = JSON.parse(stdout) as SarifLog;
  });

  it('schema-validates against the committed SARIF 2.1.0 schema (real ajv, not shape-only)', () => {
    const { valid, errors } = validateSarif(stdout);

    expect(valid, errors).toBe(true);
  });

  it('carries a repo-relative forward-slash artifactLocation.uri (no backslash / drive letter)', () => {
    const uris = artifactUris(payload);

    expect(uris.length).toBeGreaterThan(0);

    for (const uri of uris) {
      expect(uri).not.toMatch(/[\\:]/);
    }
  });

  it('is byte-stable two-run (same process, redacted)', async () => {
    const second = await runSarif(layoutBHostTsConfig);

    expect(redactVolatile(JSON.parse(second))).toEqual(redactVolatile(payload));
  });

  it('matches the committed redacted snapshot (cross-OS/Node artifactLocation.uri proof)', () => {
    expect(redactVolatile(payload)).toMatchSnapshot();
  });

  it('catalogs exactly the two fired ruleIds and resolves every result by ruleIndex (RULE-01)', () => {
    expect(ruleIds(payload)).toEqual(['NG8002', 'TS2322']);

    expectEveryResultResolvesToItsRule(payload);
  });

  it('tags the external-template NG8002 rule template-type-check and the TS2322 rule typescript, each at error level with help text (RULE-02/03/04)', () => {
    const ng8002 = ruleById(payload, 'NG8002');
    const ts2322 = ruleById(payload, 'TS2322');

    expect(ng8002.properties?.tags).toEqual(['template-type-check']);
    expect(ts2322.properties?.tags).toEqual(['typescript']);

    for (const rule of [ng8002, ts2322]) {
      expect(rule.defaultConfiguration?.level).toBe('error');
      expect((rule.help?.text ?? '').length).toBeGreaterThan(0);
    }
  });

  it('the executor payload schema-validates and equals run() (same renderReport seam)', async () => {
    const executorStdout = await captureExecutorSarif(layoutBHostTsConfig);
    const { valid, errors } = validateSarif(executorStdout);

    expect(valid, errors).toBe(true);
    expect(redactVolatile(JSON.parse(executorStdout))).toEqual(
      redactVolatile(payload),
    );
  });
});

describe('SARIF reporter integration -- global-diagnostics (file-less TS2318)', () => {
  let stdout: string;
  let payload: SarifLog;

  beforeAll(async () => {
    stdout = await runSarif(globalDiagnosticsTsConfig);
    payload = JSON.parse(stdout) as SarifLog;
  });

  it('schema-validates against the committed SARIF 2.1.0 schema (real ajv, not shape-only)', () => {
    const { valid, errors } = validateSarif(stdout);

    expect(valid, errors).toBe(true);
  });

  it('keeps at least one file-less result with NO locations (never dropped)', () => {
    expect(
      payload.runs[0].results.some(
        (result) => (result.locations?.length ?? 0) === 0,
      ),
    ).toBe(true);
  });

  it('is byte-stable two-run (same process, redacted)', async () => {
    const second = await runSarif(globalDiagnosticsTsConfig);

    expect(redactVolatile(JSON.parse(second))).toEqual(redactVolatile(payload));
  });

  it('matches the committed redacted snapshot (cross-OS/Node byte-stability)', () => {
    expect(redactVolatile(payload)).toMatchSnapshot();
  });

  it('catalogs exactly ONE TS2318 rule that all ten results resolve to by ruleIndex 0 (RULE-01)', () => {
    expect(ruleIds(payload)).toEqual(['TS2318']);

    const results = payload.runs[0].results;

    expect(results).toHaveLength(10);

    for (const result of results) {
      expect(result.ruleId).toBe('TS2318');
      expect(result.ruleIndex).toBe(0);
    }
  });

  it('tags the TS2318 rule typescript at error level with help text (RULE-02/03/04)', () => {
    const ts2318 = ruleById(payload, 'TS2318');

    expect(ts2318.properties?.tags).toEqual(['typescript']);
    expect(ts2318.defaultConfiguration?.level).toBe('error');
    expect((ts2318.help?.text ?? '').length).toBeGreaterThan(0);
  });
});

describe('SARIF reporter integration -- extended-content-projection (NG8011 extended diagnostic)', () => {
  let stdout: string;
  let payload: SarifLog;

  beforeAll(async () => {
    stdout = await runSarif(extendedContentProjectionTsConfig);
    payload = JSON.parse(stdout) as SarifLog;
  });

  it('schema-validates against the committed SARIF 2.1.0 schema (real ajv, not shape-only)', () => {
    const { valid, errors } = validateSarif(stdout);

    expect(valid, errors).toBe(true);
  });

  it('tags the fired NG8011 rule extended-diagnostics, keeping its angular.dev helpUri, at warning level with help text (RULE-02/03/04)', () => {
    expect(ruleIds(payload)).toEqual(['NG8011']);

    const ng8011 = ruleById(payload, 'NG8011');

    expect(ng8011.properties?.tags).toEqual(['extended-diagnostics']);
    expect(ng8011.helpUri).toBe(
      'https://angular.dev/extended-diagnostics/NG8011',
    );
    expect(ng8011.defaultConfiguration?.level).toBe('warning');
    expect((ng8011.help?.text ?? '').length).toBeGreaterThan(0);
  });

  it('resolves every result to the cataloged rule by ruleIndex (RULE-01)', () => {
    expectEveryResultResolvesToItsRule(payload);
  });

  it('is byte-stable two-run (same process, redacted)', async () => {
    const second = await runSarif(extendedContentProjectionTsConfig);

    expect(redactVolatile(JSON.parse(second))).toEqual(redactVolatile(payload));
  });
});

describe('SARIF reporter integration -- solution-style-all-missing (tool ATC90002)', () => {
  let stdout: string;
  let payload: SarifLog;

  beforeAll(async () => {
    stdout = await runSarif(solutionStyleAllMissingTsConfig);
    payload = JSON.parse(stdout) as SarifLog;
  });

  it('schema-validates against the committed SARIF 2.1.0 schema (real ajv, not shape-only)', () => {
    const { valid, errors } = validateSarif(stdout);

    expect(valid, errors).toBe(true);
  });

  it('tags the fired ATC90002 rule tool, at error level with help text (RULE-02/03/04)', () => {
    expect(ruleIds(payload)).toEqual(['ATC90002']);

    const tool = ruleById(payload, 'ATC90002');

    expect(tool.properties?.tags).toEqual(['tool']);
    expect(tool.defaultConfiguration?.level).toBe('error');
    expect((tool.help?.text ?? '').length).toBeGreaterThan(0);
  });

  it('resolves both file-less results to the single tool rule by ruleIndex 0 (RULE-01)', () => {
    const results = payload.runs[0].results;

    expect(results).toHaveLength(2);

    for (const result of results) {
      expect(result.ruleId).toBe('ATC90002');
      expect(result.ruleIndex).toBe(0);
      expect(result.locations?.length ?? 0).toBe(0);
    }
  });

  it('is byte-stable two-run (same process, redacted)', async () => {
    const second = await runSarif(solutionStyleAllMissingTsConfig);

    expect(redactVolatile(JSON.parse(second))).toEqual(redactVolatile(payload));
  });
});
