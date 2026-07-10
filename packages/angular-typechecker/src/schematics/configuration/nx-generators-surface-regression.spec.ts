import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// ACS-04 Nx-surface regression contract: the additive `schematics` field +
// `collection.json` (this plan) MUST NOT change what Nx resolves. Nx reads
// `packageJson.generators ?? packageJson.schematics` (source-verified in RESEARCH:
// nx `generator-utils.js` L57) -- so as long as `generators` stays declared and
// `generators.json` still declares the `configuration` generator, Nx NEVER reads
// `collection.json` and `nx g angular-typechecker:configuration` stays resolvable
// via the generator. This mirrors the Phase-21 `executors ?? builders` regression
// (`src/builders/typecheck/nx-surface-regression.spec.ts`): a pure package.json +
// generators.json read-and-assert (no Nx invocation, no compiler-cli load), so it
// runs in the fast `nx test` loop with no build.

const packageRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);

interface PluginManifest {
  generators?: string;
  schematics?: string;
}

interface GeneratorsManifest {
  generators?: Record<string, { factory?: string }>;
}

const manifest = JSON.parse(
  readFileSync(join(packageRoot, 'package.json'), 'utf8'),
) as PluginManifest;
const generatorsManifest = JSON.parse(
  readFileSync(join(packageRoot, 'generators.json'), 'utf8'),
) as GeneratorsManifest;

describe('Nx generators ?? schematics surface regression (ACS-04)', () => {
  it('keeps the generators field declared + unchanged so Nx resolves it before schematics', () => {
    expect(manifest.generators).toBe('./generators.json');
  });

  it('declares the additive schematics field alongside generators (never a replacement)', () => {
    expect(manifest.schematics).toBe('./collection.json');
  });

  it('still declares the configuration generator factory (nx g angular-typechecker:configuration stays resolvable via generators, never reads collection.json)', () => {
    expect(generatorsManifest.generators?.configuration?.factory).toBe(
      './src/generators/configuration/generator',
    );
  });
});
