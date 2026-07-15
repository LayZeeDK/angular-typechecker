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
  schematics?: Record<string, { factory?: string }>;
}

interface CollectionManifest {
  schematics?: Record<string, { factory?: string }>;
}

const manifest = JSON.parse(
  readFileSync(join(packageRoot, 'package.json'), 'utf8'),
) as PluginManifest;
const generatorsManifest = JSON.parse(
  readFileSync(join(packageRoot, 'generators.json'), 'utf8'),
) as GeneratorsManifest;
const collectionManifest = JSON.parse(
  readFileSync(join(packageRoot, 'collection.json'), 'utf8'),
) as CollectionManifest;

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

  it('exposes NO Angular CLI init schematic in collection.json -- init is the Nx post-install hook (nx add -> <pkg>:init); its Angular CLI counterpart is ng-add, so ng generate angular-typechecker:init is deliberately absent (ACS-04)', () => {
    expect(collectionManifest.schematics?.init).toBeUndefined();
  });

  it('still declares the init generator factory in generators.json so nx add angular-typechecker -> <pkg>:init stays resolvable via generators (nx add UNCHANGED, Pitfall 5)', () => {
    expect(generatorsManifest.generators?.init?.factory).toBe(
      './src/generators/init/generator',
    );
  });

  it('declares the additive ng-add schematic in collection.json (ng add angular-typechecker auto-wire-all, NGADD-01)', () => {
    expect(collectionManifest.schematics?.['ng-add']?.factory).toBe(
      './src/schematics/ng-add/schematic',
    );
  });

  it('never declares ng-add in generators.json so the Nx nx add surface stays <pkg>:init (nx add UNCHANGED, Pitfall 5)', () => {
    expect(generatorsManifest.generators?.['ng-add']).toBeUndefined();
    expect(generatorsManifest.schematics?.['ng-add']).toBeUndefined();
  });
});
