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

// VER-02 (D-01/D-02/D-03) -- the SARIF machine reporter proven over REAL
// cold-compiler fixtures through BOTH run() and the Nx executor. Mirrors
// machine-reporters-json.integration.spec.ts (cwd pin, same two fixtures, executor
// dual) but for --format sarif, adding the TRUE 2.1.0 schema validation
// (validateSarif = committed draft-07 schema + ajv + ajv-formats) that complements
// Phase 31's golden snapshot.
//
//   - layout-b-host: mixed TS2322 + NG8002 (external .html template) -- the
//     Windows path -> forward-slash artifactLocation.uri conversion (VER-02).
//   - global-diagnostics: file-less TS2318 -- the SARIF no-`locations` result that
//     is NEVER dropped (Phase-31 D-01).
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
  locations?: SarifLocation[];
}

interface SarifRun {
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
});
