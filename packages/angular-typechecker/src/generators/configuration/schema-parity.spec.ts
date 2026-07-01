import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// GEN-05 key-parity contract: schema.json `properties` keys MUST equal the
// `ConfigurationGeneratorSchema` (schema.d.ts) key set. TS interfaces have no
// runtime keys, so the expected set is encoded as a literal array here -- the
// parity test's job is to fail LOUDLY if schema.json and schema.d.ts drift (a
// silent drift means the generator's CLI contract diverges from its type
// contract). This is a pure, deterministic filesystem read (no compiler load, no
// build artifact) so it runs in the fast `nx test` loop.
//
// A GENERATOR schema OMITS the executor-only `"version": 2`, so that executor-tier
// assertion is intentionally dropped here (unlike the executor parity spec).

const schemaPath = join(dirname(fileURLToPath(import.meta.url)), 'schema.json');

interface GeneratorSchema {
  cli?: string;
  version?: number;
  additionalProperties?: boolean;
  required?: readonly string[];
  properties: Record<string, { type?: string; default?: unknown }>;
}

const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as GeneratorSchema;

// The exact ConfigurationGeneratorSchema key set (schema.d.ts), sorted.
const EXPECTED_KEYS = ['project', 'skipFormat', 'targetName', 'tsConfig'];

describe('configuration schema.json <-> schema.d.ts parity (GEN-05)', () => {
  it('declares exactly the ConfigurationGeneratorSchema properties', () => {
    expect(Object.keys(schema.properties).sort()).toEqual(EXPECTED_KEYS);
  });

  it('marks project as the single required option', () => {
    expect(schema.required).toEqual(['project']);
  });

  it('is a cli:nx, strict (additionalProperties:false) schema', () => {
    expect(schema.cli).toBe('nx');
    expect(schema.additionalProperties).toBe(false);
  });

  it('omits the executor-only "version" field (generator schema)', () => {
    expect(schema).not.toHaveProperty('version');
  });
});
