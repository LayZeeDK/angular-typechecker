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
//     listing requires devkit-as-dependency; D-14), and `nx` declared as a direct
//     `^23.0.0` runtime dependency. `@nx/devkit`'s entrypoint `require()`s
//     `nx/src/devkit-exports` at load, and yarn does NOT auto-install the peer
//     (npm/pnpm do), so a yarn Angular CLI consumer would crash with `Cannot find
//     module 'nx/src/devkit-exports'` unless `nx` is present directly. Range
//     `^23.0.0` (>=23.0.0 <24.0.0) pins Nx-23-only support and cannot pull nx
//     22/24 (v0.2.1 correction; see .planning/debug/cli-yarn-e2e-wrong-version.md).
//     The peer ranges (`@angular/compiler-cli`, `typescript`) are the
//     consumer-supplied compiler/TS versions.
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
  generators?: string;
  builders?: string;
  schematics?: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  // RF-01: how `ng add angular-typechecker` places the install.
  'ng-add'?: {
    save?: string;
  };
  engines?: {
    node?: string;
  };
  // PKG-01 publishable-contract fields (D-01..D-04).
  files?: string[];
  exports?: Record<string, unknown>;
  keywords?: string[];
  repository?: {
    url?: string;
    directory?: string;
  };
  license?: string;
  description?: string;
  publishConfig?: {
    provenance?: boolean;
    access?: string;
  };
}

const manifest = JSON.parse(
  readFileSync(manifestPath, 'utf8'),
) as PluginManifest;

describe('plugin manifest compatibility contract (CMP-01 manifest / CMP-02 / D-14)', () => {
  it('declares the exact Angular 22 + Nx 23 Node engine intersection range (CMP-02)', () => {
    expect(manifest.engines?.node).toBe('^22.22.3 || ^24.15.0 || ^26.0.0');
  });

  it('is a CommonJS package so the Nx executor loader can require() it', () => {
    expect(manifest.type).toBe('commonjs');
  });

  it('pins @nx/devkit EXACT as a runtime dependency (registry listing requires devkit-as-dependency; D-14)', () => {
    expect(manifest.dependencies?.['@nx/devkit']).toBe('23.0.1');
  });

  it('declares nx as a ^23.0.0 runtime dependency (yarn does not auto-install the @nx/devkit peer) and NOT a peer', () => {
    expect(manifest.dependencies?.['nx']).toBe('^23.0.0');
    expect(manifest.peerDependencies ?? {}).not.toHaveProperty('nx');
  });

  it('declares @angular/compiler-cli and typescript as the consumer-supplied peer ranges (CMP-01 manifest contract)', () => {
    expect(manifest.peerDependencies?.['@angular/compiler-cli']).toBe(
      '^22.0.0',
    );
    expect(manifest.peerDependencies?.['typescript']).toBe('>=6.0.0 <6.1.0');
  });
});

describe('plugin manifest publishable contract (PKG-01 / D-01..D-04)', () => {
  it('declares the explicit files allowlist (D-01; never rely on npm defaults)', () => {
    expect(manifest.files).toEqual([
      'src',
      'executors.json',
      'generators.json',
      'builders.json',
      'collection.json',
      'README.md',
      'LICENSE',
    ]);
  });

  it('registers the generators collection (D-02)', () => {
    expect(manifest.generators).toBe('./generators.json');
  });

  it('registers the Angular CLI builders collection (ACB-03; additive)', () => {
    expect(manifest.builders).toBe('./builders.json');
  });

  it('registers the Angular CLI schematics collection (ACS-04; additive sibling of generators)', () => {
    expect(manifest.schematics).toBe('./collection.json');
  });

  it('declares the minimal CJS exports map (D-02; barrel entry + package.json escape hatch)', () => {
    expect(manifest.exports?.['.']).toBe('./src/index.js');
    expect(manifest.exports?.['./package.json']).toBe('./package.json');
  });

  it('includes the nx and nx-plugin keywords (D-03; registry/search discovery)', () => {
    expect(manifest.keywords).toContain('nx');
    expect(manifest.keywords).toContain('nx-plugin');
  });

  it('declares the repository url + monorepo directory with the LayZeeDK casing (D-03; OIDC/provenance byte-match)', () => {
    expect(manifest.repository?.url).toBe(
      'git+https://github.com/LayZeeDK/angular-typechecker.git',
    );
    expect(manifest.repository?.directory).toBe('packages/angular-typechecker');
  });

  it('declares the MIT license (D-03)', () => {
    expect(manifest.license).toBe('MIT');
  });

  it('declares a non-empty description (D-03)', () => {
    expect(typeof manifest.description).toBe('string');
    expect((manifest.description ?? '').length).toBeGreaterThan(0);
  });

  it('opts into npm provenance (D-04; belt-and-suspenders with the CI env)', () => {
    expect(manifest.publishConfig?.provenance).toBe(true);
  });

  it('explicitly sets publishConfig.access to public (required for provenance on a NEW package; D-04 correction)', () => {
    // npm rejects provenance generation for a first publish with
    // "Can't generate provenance for new or private package, you must set
    // `access` to public" -- the unscoped-defaults-to-public rule does NOT
    // satisfy this, so `access: public` must be explicit (caught by the seed run).
    expect(manifest.publishConfig?.access).toBe('public');
  });
});

describe('plugin manifest Angular CLI install contract (ACP-01 / NGADD-01 RF-01 / D-07)', () => {
  it('sets ng-add.save to devDependencies so `ng add` installs a dev tool into devDependencies (RF-01)', () => {
    // `@angular/cli` reads the package's own `ng-add.save` and installs with
    // --save-dev when it is "devDependencies" (precedent @angular-eslint/schematics).
    expect(manifest['ng-add']?.save).toBe('devDependencies');
  });

  it('declares the converted builder runtime peers with the D-07 ranges', () => {
    // @angular-devkit/architect uses the 0.22xx.x scheme (NOT 22.x): 22.0 ->
    // 0.2200, 22.1 -> 0.2201, ... The range spans ALL of Angular 22.x, symmetric
    // with the `^22.0.0` compiler-cli peer -- a caret on the leading-zero-major
    // (`^0.2200.0`) would lock to 22.0.x only.
    expect(manifest.peerDependencies?.['@angular-devkit/architect']).toBe(
      '>=0.2200.0 <0.2300.0',
    );
    // The @nx/devkit convertNxExecutor wrapper touches only the core Observable
    // contract (`new Observable(subscriber => { subscriber.next/complete/error })`),
    // identical across rxjs 6.5.3+ and all 7.x -- so mirror Angular 22's own rxjs
    // range rather than pinning a narrower 7.8.0 the wrapper does not require.
    expect(manifest.peerDependencies?.['rxjs']).toBe('^6.5.3 || ^7.4.0');
  });

  it('classifies both builder runtime peers as OPTIONAL (never forced onto a pure-Nx consumer)', () => {
    expect(
      manifest.peerDependenciesMeta?.['@angular-devkit/architect']?.optional,
    ).toBe(true);
    expect(manifest.peerDependenciesMeta?.['rxjs']?.optional).toBe(true);
  });

  it('declares @angular-devkit/schematics as an OPTIONAL peer at ^22.0.0 (ng-add schematic runtime peer; B6)', () => {
    // The vanilla nx-free ng-add schematic TYPE-imports Rule/Tree/SchematicContext
    // from @angular-devkit/schematics. `^22.0.0` is the all-of-Angular-22 spelling
    // for a 22.x-scheme package (installed 22.0.6) -- NOT architect's 0.2200.x
    // leading-zero scheme. Optional so it is never forced onto a pure-Nx consumer.
    expect(manifest.peerDependencies?.['@angular-devkit/schematics']).toBe(
      '^22.0.0',
    );
    expect(
      manifest.peerDependenciesMeta?.['@angular-devkit/schematics']?.optional,
    ).toBe(true);
  });

  it('declares nx as a ^23.0.0 dependency; the optional peers do not move it into peerDependencies', () => {
    expect(manifest.dependencies?.['nx']).toBe('^23.0.0');
    expect(manifest.peerDependencies ?? {}).not.toHaveProperty('nx');
  });
});
