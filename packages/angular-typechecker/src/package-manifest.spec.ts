import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// CMP-02 + CMP-01 (manifest contract): prove the PUBLISHED plugin manifest
// (`packages/angular-typechecker/package.json`) encodes the locked D-14
// dependency model and Node engine range. This is a pure, deterministic
// filesystem read -- no compiler-cli load, no build artifact -- so it runs in
// the fast `nx test` loop with no `nx build` prerequisite.
//
// What this guards:
//   - CMP-02: `engines.node` is the exact intersection range of Angular 22 + Nx 23.
//   - CMP-01 (manifest portion): the runtime-version compatibility contract is
//     DECLARED correctly -- `@nx/devkit` pinned EXACT as a `dependency` (registry
//     listing requires devkit-as-dependency; D-14), and `nx` declared by NO ONE
//     (devkit's own peer carries the consumer's nx transitively -- declaring it
//     ourselves double-constrains). The peer ranges (`@angular/compiler-cli`,
//     `typescript`) are the consumer-supplied compiler/TS versions.
//   - `type: "commonjs"`: the executor is loaded by Nx via `require()`; an ESM
//     manifest here breaks the loader.
//
// The actual installed-version resolution (`npm ls nx @angular/compiler-cli
// typescript` -> 23.0.1 / 22.0.4 / 6.0.3) stays a CI/env smoke check
// (Manual-Only); this spec asserts the DECLARED contract that those versions
// must satisfy.

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(packageRoot, 'package.json');

interface PluginManifest {
  type?: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  engines?: {
    node?: string;
  };
}

const manifest = JSON.parse(
  readFileSync(manifestPath, 'utf8'),
) as PluginManifest;

describe('plugin manifest compatibility contract (CMP-01 manifest / CMP-02 / D-14)', () => {
  it('declares the exact Angular 22 + Nx 23 Node engine intersection range (CMP-02)', () => {
    expect(manifest.engines?.node).toBe(
      '^22.22.3 || ^24.15.0 || ^26.0.0',
    );
  });

  it('is a CommonJS package so the Nx executor loader can require() it', () => {
    expect(manifest.type).toBe('commonjs');
  });

  it('pins @nx/devkit EXACT as a runtime dependency (registry listing requires devkit-as-dependency; D-14)', () => {
    expect(manifest.dependencies?.['@nx/devkit']).toBe('23.0.1');
  });

  it('does NOT declare nx in dependencies or peerDependencies (devkit peer carries the consumer nx; declaring it double-constrains)', () => {
    expect(manifest.dependencies ?? {}).not.toHaveProperty('nx');
    expect(manifest.peerDependencies ?? {}).not.toHaveProperty('nx');
  });

  it('declares @angular/compiler-cli and typescript as the consumer-supplied peer ranges (CMP-01 manifest contract)', () => {
    expect(manifest.peerDependencies?.['@angular/compiler-cli']).toBe(
      '^22.0.0',
    );
    expect(manifest.peerDependencies?.['typescript']).toBe('>=6.0.0 <6.1.0');
  });
});
