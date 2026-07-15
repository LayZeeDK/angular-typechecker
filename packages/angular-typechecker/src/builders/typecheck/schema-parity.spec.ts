import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { TypecheckExecutorOptions } from '../../executors/typecheck/schema';

// ACB-01 / T-21-07 builder-schema parity contract: the SANITIZED Angular CLI
// builder schema.json MUST stay in lock-step with the executor's
// `TypecheckExecutorOptions` (schema.d.ts) -- same property keys, same single
// required flag, same strictness, same defaults, same ENG-01 `tsConfig`
// string|array `oneOf` -- AND must be sanitized for the Architect dialect (no
// Nx-only `cli`/`version`/`$id`). The builder reuses the EXECUTOR's options
// interface (there is no separate builder schema.d.ts), so binding EXPECTED_KEYS
// to `TypecheckExecutorOptions` at COMPILE time (see below) pins the builder
// schema to the same single source of truth the executor is pinned to. This is a
// pure, deterministic filesystem read (no compiler load, no build artifact) so it
// runs in the fast `nx test` loop.

const schemaPath = join(dirname(fileURLToPath(import.meta.url)), 'schema.json');

interface SchemaProperty {
  type?: string;
  default?: unknown;
  // ENG-01: tsConfig is a `oneOf` string|array (widened from a bare string).
  oneOf?: readonly {
    type?: string;
    items?: { type?: string };
    minItems?: number;
  }[];
}

interface BuilderSchema {
  additionalProperties?: boolean;
  required?: readonly string[];
  properties: Record<string, SchemaProperty>;
}

const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as BuilderSchema;

// The exact TypecheckExecutorOptions key set (schema.d.ts), sorted. `satisfies`
// binds it FORWARD (every listed key is a real TypecheckExecutorOptions key); the
// AssertAssignable reverse probe below binds it BACKWARD (no interface key is
// missing from the list) -- so adding a field to the executor options interface
// without listing it here fails the type-check, which a hand-literal alone could
// not catch. Together with the runtime `toEqual` this pins builder schema.json <->
// TypecheckExecutorOptions <-> EXPECTED_KEYS.
const EXPECTED_KEYS = [
  'failFast',
  'includeDeps',
  'maxWarnings',
  'strict',
  'tsConfig',
] as const satisfies readonly (keyof TypecheckExecutorOptions)[];

// The phantom `To extends From` constraint IS the reverse-coverage assertion; `To`
// is intentionally unreferenced in the body (mirrors the configuration spec).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type AssertAssignable<From, To extends From> = true;
// Reverse completeness: every TypecheckExecutorOptions key MUST appear in
// EXPECTED_KEYS -- this instantiation errors if a field is added to the executor
// options interface but not listed above.
type ReverseCoverage = AssertAssignable<
  (typeof EXPECTED_KEYS)[number],
  keyof TypecheckExecutorOptions
>;
void (0 as unknown as ReverseCoverage);

describe('builder schema.json <-> TypecheckExecutorOptions parity (ACB-01 / T-21-07)', () => {
  it('declares exactly the TypecheckExecutorOptions properties', () => {
    expect(Object.keys(schema.properties).sort()).toEqual(EXPECTED_KEYS);
  });

  it('keeps tsConfig as the single required flag', () => {
    expect(schema.required).toEqual(['tsConfig']);
  });

  it('is a strict (additionalProperties:false) schema', () => {
    expect(schema.additionalProperties).toBe(false);
  });

  it('is sanitized for the Architect dialect: NO cli, version, or $id', () => {
    expect(schema).not.toHaveProperty('cli');
    expect(schema).not.toHaveProperty('version');
    expect(schema).not.toHaveProperty('$id');
  });

  it('leaves maxWarnings WITHOUT a default (a default:0 is an un-loosenable footgun)', () => {
    expect(schema.properties.maxWarnings).not.toHaveProperty('default');
  });

  it('defaults includeDeps and failFast to false (matches the executor)', () => {
    expect(schema.properties.includeDeps.default).toBe(false);
    expect(schema.properties.failFast.default).toBe(false);
  });

  it('defaults strict to false (matches the executor; opt-in)', () => {
    expect(schema.properties.strict.default).toBe(false);
  });

  it('ENG-01: widens tsConfig to a oneOf accepting a string OR a non-empty array of strings', () => {
    const branches = schema.properties.tsConfig.oneOf ?? [];

    expect(Array.isArray(schema.properties.tsConfig.oneOf)).toBe(true);

    const stringBranch = branches.find((branch) => branch.type === 'string');
    const arrayBranch = branches.find((branch) => branch.type === 'array');

    expect(stringBranch).toBeDefined();
    expect(arrayBranch).toBeDefined();
    expect(arrayBranch?.items?.type).toBe('string');
    expect(arrayBranch?.minItems).toBe(1);
  });
});
