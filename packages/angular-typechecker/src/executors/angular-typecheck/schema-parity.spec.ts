import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// D-06 key-parity contract: schema.json `properties` keys MUST equal the
// `AngularTypecheckExecutorOptions` (schema.d.ts) key set. TS interfaces have no
// runtime keys, so the expected set is encoded as a literal array here -- the
// parity test's job is to fail LOUDLY if schema.json and schema.d.ts drift (a
// silent drift means the executor's runtime contract diverges from its type
// contract). This is a pure, deterministic filesystem read (no compiler load, no
// build artifact) so it runs in the fast `nx test` loop.

const schemaPath = join(
  dirname(fileURLToPath(import.meta.url)),
  'schema.json',
);

interface ExecutorSchema {
  version?: number;
  cli?: string;
  additionalProperties?: boolean;
  required?: readonly string[];
  properties: Record<string, { type?: string; default?: unknown }>;
}

const schema = JSON.parse(
  readFileSync(schemaPath, 'utf8'),
) as ExecutorSchema;

// The exact AngularTypecheckExecutorOptions key set (schema.d.ts), sorted.
const EXPECTED_KEYS = ['failFast', 'includeDeps', 'maxWarnings', 'tsConfig'];

describe('schema.json <-> schema.d.ts parity (D-06)', () => {
  it('declares exactly the AngularTypecheckExecutorOptions properties', () => {
    expect(Object.keys(schema.properties).sort()).toEqual(EXPECTED_KEYS);
  });

  it('keeps tsConfig as the single required flag', () => {
    expect(schema.required).toEqual(['tsConfig']);
  });

  it('is a v2, cli:nx, strict (additionalProperties:false) schema', () => {
    expect(schema.version).toBe(2);
    expect(schema.cli).toBe('nx');
    expect(schema.additionalProperties).toBe(false);
  });

  it('leaves maxWarnings WITHOUT a default (a default:0 is an un-loosenable footgun)', () => {
    expect(schema.properties.maxWarnings).not.toHaveProperty('default');
  });

  it('defaults includeDeps and failFast to false', () => {
    expect(schema.properties.includeDeps.default).toBe(false);
    expect(schema.properties.failFast.default).toBe(false);
  });
});
