import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { InitGeneratorSchema } from './schema';

// GEN-05 key-parity contract: schema.json `properties` keys MUST equal the
// `InitGeneratorSchema` (schema.d.ts) key set. TS interfaces have no runtime keys,
// so the expected set is a literal array here -- but it is BOUND to the interface
// at COMPILE time (see EXPECTED_KEYS below) so it cannot silently diverge from
// schema.d.ts (I-4). The runtime `toEqual` then fails LOUDLY if schema.json drifts
// from that bound list. This is a pure, deterministic filesystem read (no compiler
// load, no build artifact) so it runs in the fast `nx test` loop.
//
// A GENERATOR schema OMITS the executor-only `"version": 2` and any `required`
// array (init has no required options), so those executor-tier assertions are
// intentionally dropped here.

const schemaPath = join(dirname(fileURLToPath(import.meta.url)), 'schema.json');

interface GeneratorSchema {
  cli?: string;
  version?: number;
  additionalProperties?: boolean;
  properties: Record<string, { type?: string; default?: unknown }>;
}

const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as GeneratorSchema;

// The exact InitGeneratorSchema key set (schema.d.ts), sorted. `satisfies` binds it
// FORWARD (every listed key is a real InitGeneratorSchema key); the AssertAssignable
// reverse probe below binds it BACKWARD (no schema.d.ts key is missing) -- so adding
// a field to schema.d.ts without listing it here fails the type-check (I-4).
const EXPECTED_KEYS = [
  'skipFormat',
] as const satisfies readonly (keyof InitGeneratorSchema)[];

// The phantom `To extends From` constraint IS the reverse-coverage assertion; `To`
// is intentionally unreferenced in the body (mirrors extended-catalog.drift.ts).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type AssertAssignable<From, To extends From> = true;
// Reverse completeness: every InitGeneratorSchema key MUST appear in EXPECTED_KEYS.
type ReverseCoverage = AssertAssignable<
  (typeof EXPECTED_KEYS)[number],
  keyof InitGeneratorSchema
>;
void (0 as unknown as ReverseCoverage);

describe('init schema.json <-> schema.d.ts parity (GEN-05)', () => {
  it('declares exactly the InitGeneratorSchema properties', () => {
    expect(Object.keys(schema.properties).sort()).toEqual(EXPECTED_KEYS);
  });

  it('is a cli:nx, strict (additionalProperties:false) schema', () => {
    expect(schema.cli).toBe('nx');
    expect(schema.additionalProperties).toBe(false);
  });

  it('omits the executor-only "version" field (generator schema)', () => {
    expect(schema).not.toHaveProperty('version');
  });
});
