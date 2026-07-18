import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ExecutorContext } from '@nx/devkit';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findWorkspaceRoot, redactVolatile } from '@workspace/test-util';

import { run } from '../cli/main';
import typecheckExecutor from '../executors/typecheck/executor';

// VER-02 (D-02/D-03) -- the JSON machine reporter proven over REAL cold-compiler
// fixtures through BOTH the CLI adapter (run()) and the Nx executor. A dedicated
// file (mirroring global-diagnostics.integration.spec.ts) so this plan owns
// disjoint files for wave parallelism.
//
// Two committed fixtures cover D-03's union WITHOUT a new fixture:
//   - layout-b-host: mixed TS2322 (aggregated broken story) + NG8002 (external
//     `.html` template) -- the relative-URI conversion over a .ts AND a .html path.
//   - global-diagnostics: file-less/global TS2318 -- the JSON `file:null` path.
//
// DETERMINISM (D-02): run() sets pathBase = process.cwd(), so pinning cwd to the
// workspace root in beforeAll makes every diagnostic `file` a repo-relative
// forward-slash path identical on every OS cell. The committed redacted snapshot is
// the cross-OS/Node byte-stability contract; `redactVolatile` normalizes only the
// volatile tool version (never asserted literally).
//
// The executor is invoked DIRECTLY (not via convertNxExecutor), so it resolves NO
// project graph -- normalizeOptions reads only context.root -- and needs no
// NX_DAEMON/NX_ISOLATE_PLUGINS override (unlike builder.integration.spec.ts).

interface JsonDiagnostic {
  file: string | null;
}

interface JsonPayload {
  formatVersion: unknown;
  summary: unknown;
  diagnostics: JsonDiagnostic[];
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

/** Render `--format json` for one fixture through the CLI adapter, pure stdout. */
async function runJson(tsConfig: string): Promise<string> {
  const { stdout } = await run(['-c', tsConfig, '--format', 'json'], env);

  return stdout;
}

/**
 * Drive the Nx executor over one fixture with `--format json`, capturing the raw
 * `process.stdout.write` payload (matching builder.integration.spec.ts). context.root
 * = workspaceRoot mirrors run()'s cwd-derived pathBase so the two payloads are
 * byte-identical after redaction.
 */
async function captureExecutorJson(tsConfig: string): Promise<string> {
  const chunks: string[] = [];
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: unknown): boolean => {
    chunks.push(typeof chunk === 'string' ? chunk : String(chunk));

    return true;
  }) as typeof process.stdout.write;

  try {
    const context = { root: workspaceRoot } as ExecutorContext;
    await typecheckExecutor({ tsConfig, format: 'json' }, context);
  } finally {
    process.stdout.write = originalWrite;
  }

  return chunks.join('');
}

function assertForwardSlashPaths(payload: JsonPayload): void {
  for (const diagnostic of payload.diagnostics) {
    if (typeof diagnostic.file === 'string') {
      // Repo-relative forward-slash only: no backslash, no drive-letter colon.
      expect(diagnostic.file).not.toMatch(/[\\:]/);
    }
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

describe('JSON reporter integration -- layout-b-host (mixed TS2322 + NG8002)', () => {
  let stdout: string;
  let payload: JsonPayload;

  beforeAll(async () => {
    stdout = await runJson(layoutBHostTsConfig);
    payload = JSON.parse(stdout) as JsonPayload;
  });

  it('emits pure, parseable stdout with formatVersion + flat diagnostics[] + summary', () => {
    expect(() => JSON.parse(stdout)).not.toThrow();
    expect(typeof payload.formatVersion).toBe('number');
    expect(Array.isArray(payload.diagnostics)).toBe(true);
    expect(payload.summary).toBeDefined();
    // The mixed fixture carries real diagnostics (not an empty payload).
    expect(payload.diagnostics.length).toBeGreaterThan(0);
  });

  it('every diagnostic file is a repo-relative forward-slash path (no backslash / drive letter)', () => {
    assertForwardSlashPaths(payload);
  });

  it('is byte-stable two-run (same process, redacted)', async () => {
    const second = await runJson(layoutBHostTsConfig);

    expect(redactVolatile(JSON.parse(second))).toEqual(redactVolatile(payload));
  });

  it('matches the committed redacted snapshot (cross-OS/Node byte-stability)', () => {
    expect(redactVolatile(payload)).toMatchSnapshot();
  });

  it('the executor payload equals run() (both render through the same seam)', async () => {
    const executorStdout = await captureExecutorJson(layoutBHostTsConfig);

    expect(() => JSON.parse(executorStdout)).not.toThrow();
    expect(redactVolatile(JSON.parse(executorStdout))).toEqual(
      redactVolatile(payload),
    );
  });
});

describe('JSON reporter integration -- global-diagnostics (file-less TS2318)', () => {
  let stdout: string;
  let payload: JsonPayload;

  beforeAll(async () => {
    stdout = await runJson(globalDiagnosticsTsConfig);
    payload = JSON.parse(stdout) as JsonPayload;
  });

  it('emits pure, parseable stdout with formatVersion + flat diagnostics[] + summary', () => {
    expect(() => JSON.parse(stdout)).not.toThrow();
    expect(typeof payload.formatVersion).toBe('number');
    expect(Array.isArray(payload.diagnostics)).toBe(true);
    expect(payload.summary).toBeDefined();
  });

  it('carries at least one file-less (file:null) diagnostic', () => {
    expect(
      payload.diagnostics.some((diagnostic) => diagnostic.file === null),
    ).toBe(true);
  });

  it('every diagnostic file is a repo-relative forward-slash path (no backslash / drive letter)', () => {
    assertForwardSlashPaths(payload);
  });

  it('is byte-stable two-run (same process, redacted)', async () => {
    const second = await runJson(globalDiagnosticsTsConfig);

    expect(redactVolatile(JSON.parse(second))).toEqual(redactVolatile(payload));
  });

  it('matches the committed redacted snapshot (cross-OS/Node byte-stability)', () => {
    expect(redactVolatile(payload)).toMatchSnapshot();
  });
});
