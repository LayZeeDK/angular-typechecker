import { readNxJson, readProjectConfiguration, writeJson } from '@nx/devkit';
import type { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import configurationGenerator from './generator';

// ACS-01 / ACS-02 / COV-01 coverage for the Angular CLI write-fork on a GENUINE
// angular.json-seeded substrate (D-07, Pitfall 1): createTreeWithEmptyWorkspace()
// then DELETE nx.json + WRITE angular.json + the leaf tsconfigs. No
// addProjectConfiguration -- the `readProjectConfiguration` polyfill reads the CLI
// project straight from angular.json. Every case asserts BOTH angular.json present
// AND nx.json absent so the fork (not the Nx else-branch) is what runs. The polyfill
// normalizes architect -> targets / builder -> executor on read-back, so the written
// `builder` surfaces as `executor` and the leaf ARRAY as `options.tsConfig`.

interface AngularJsonProject {
  projectType: 'application' | 'library';
  root: string;
  architect?: Record<string, unknown>;
}

function writeAngularJson(
  tree: Tree,
  projects: Record<string, AngularJsonProject>,
): void {
  writeJson(tree, 'angular.json', { version: 1, projects });
}

function writeLeaf(tree: Tree, path: string): void {
  writeJson(tree, path, { compilerOptions: {} });
}

function assertCliSubstrate(tree: Tree): void {
  expect(tree.exists('angular.json')).toBe(true);
  expect(tree.exists('nx.json')).toBe(false);
}

// Mirrors the real bluehalo/ngx-leaflet workspace: app at root "" with
// tsconfig.app.json + tsconfig.spec.json; lib under projects/ngx-leaflet with
// tsconfig.lib.json + tsconfig.spec.json.
function seedNgxLeafletWorkspace(tree: Tree): void {
  writeAngularJson(tree, {
    'ngx-leaflet-demo': { projectType: 'application', root: '' },
    'ngx-leaflet': { projectType: 'library', root: 'projects/ngx-leaflet' },
  });

  writeLeaf(tree, 'tsconfig.app.json');
  writeLeaf(tree, 'tsconfig.spec.json');
  writeLeaf(tree, 'projects/ngx-leaflet/tsconfig.lib.json');
  writeLeaf(tree, 'projects/ngx-leaflet/tsconfig.spec.json');
}

describe('configuration generator (Angular CLI write-fork)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.delete('nx.json');
  });

  it('writes the app typecheck target with the [app, spec] leaf array (ACS-01)', async () => {
    seedNgxLeafletWorkspace(tree);
    assertCliSubstrate(tree);

    await configurationGenerator(tree, { project: 'ngx-leaflet-demo' });

    expect(
      readProjectConfiguration(tree, 'ngx-leaflet-demo').targets?.typecheck,
    ).toEqual({
      executor: 'angular-typechecker:typecheck',
      options: { tsConfig: ['tsconfig.app.json', 'tsconfig.spec.json'] },
    });
  });

  it('writes the library typecheck target with the [lib, spec] leaf array (ACS-01)', async () => {
    seedNgxLeafletWorkspace(tree);
    assertCliSubstrate(tree);

    await configurationGenerator(tree, { project: 'ngx-leaflet' });

    expect(
      readProjectConfiguration(tree, 'ngx-leaflet').targets?.typecheck,
    ).toEqual({
      executor: 'angular-typechecker:typecheck',
      options: {
        tsConfig: [
          'projects/ngx-leaflet/tsconfig.lib.json',
          'projects/ngx-leaflet/tsconfig.spec.json',
        ],
      },
    });
  });

  it('scopes each target to EXACTLY its own leaves -- no cross-project bleed (COV-01)', async () => {
    seedNgxLeafletWorkspace(tree);
    assertCliSubstrate(tree);

    await configurationGenerator(tree, { project: 'ngx-leaflet-demo' });
    await configurationGenerator(tree, { project: 'ngx-leaflet' });

    // Exact-array equality per project proves both halves of COV-01: each target
    // carries its COMPLETE leaf set AND ONLY its own leaves (no other project's
    // leaf appears -- the arrays are disjoint by construction).
    expect(
      readProjectConfiguration(tree, 'ngx-leaflet-demo').targets?.typecheck,
    ).toEqual({
      executor: 'angular-typechecker:typecheck',
      options: { tsConfig: ['tsconfig.app.json', 'tsconfig.spec.json'] },
    });
    expect(
      readProjectConfiguration(tree, 'ngx-leaflet').targets?.typecheck,
    ).toEqual({
      executor: 'angular-typechecker:typecheck',
      options: {
        tsConfig: [
          'projects/ngx-leaflet/tsconfig.lib.json',
          'projects/ngx-leaflet/tsconfig.spec.json',
        ],
      },
    });
  });

  it('creates NO stray nx.json on the CLI branch (ACS-02, init skipped)', async () => {
    seedNgxLeafletWorkspace(tree);
    assertCliSubstrate(tree);

    await configurationGenerator(tree, { project: 'ngx-leaflet-demo' });

    // The CLI branch skips the Nx init generator, so no nx.json is ever written.
    assertCliSubstrate(tree);
  });

  it('is idempotent for OUR target -- preserves user options + configurations (ACS-01)', async () => {
    writeAngularJson(tree, {
      'ngx-leaflet-demo': {
        projectType: 'application',
        root: '',
        architect: {
          typecheck: {
            builder: 'angular-typechecker:typecheck',
            options: {
              tsConfig: ['tsconfig.app.json', 'tsconfig.spec.json'],
              maxWarnings: 0,
            },
            configurations: { ci: { failFast: true } },
          },
        },
      },
    });
    writeLeaf(tree, 'tsconfig.app.json');
    writeLeaf(tree, 'tsconfig.spec.json');
    assertCliSubstrate(tree);

    await configurationGenerator(tree, { project: 'ngx-leaflet-demo' });

    // Re-asserts the id + resolved tsConfig array but preserves the user's extra
    // option (maxWarnings) and the configurations block.
    expect(
      readProjectConfiguration(tree, 'ngx-leaflet-demo').targets?.typecheck,
    ).toEqual({
      executor: 'angular-typechecker:typecheck',
      options: {
        tsConfig: ['tsconfig.app.json', 'tsconfig.spec.json'],
        maxWarnings: 0,
      },
      configurations: { ci: { failFast: true } },
    });
  });

  it('throws on a same-named NON-ours target instead of clobbering (ACS-01)', async () => {
    writeAngularJson(tree, {
      'ngx-leaflet-demo': {
        projectType: 'application',
        root: '',
        architect: {
          typecheck: {
            builder: '@angular-devkit/build-angular:something',
          },
        },
      },
    });
    writeLeaf(tree, 'tsconfig.app.json');
    writeLeaf(tree, 'tsconfig.spec.json');
    assertCliSubstrate(tree);

    await expect(
      configurationGenerator(tree, { project: 'ngx-leaflet-demo' }),
    ).rejects.toThrow(/already has a "typecheck" target/);
  });

  it('rejects an empty / whitespace --targetName (ACS-01)', async () => {
    seedNgxLeafletWorkspace(tree);
    assertCliSubstrate(tree);

    await expect(
      configurationGenerator(tree, {
        project: 'ngx-leaflet-demo',
        targetName: '   ',
      }),
    ).rejects.toThrow(/must be a non-empty target name/);
  });

  it('honors an explicit --tsConfig override as a single-element array (ACS-01)', async () => {
    writeAngularJson(tree, {
      'custom-lib': { projectType: 'library', root: 'projects/custom-lib' },
    });
    writeLeaf(tree, 'projects/custom-lib/tsconfig.custom.json');
    assertCliSubstrate(tree);

    await configurationGenerator(tree, {
      project: 'custom-lib',
      tsConfig: 'tsconfig.custom.json',
    });

    expect(
      readProjectConfiguration(tree, 'custom-lib').targets?.typecheck,
    ).toEqual({
      executor: 'angular-typechecker:typecheck',
      options: { tsConfig: ['projects/custom-lib/tsconfig.custom.json'] },
    });
  });

  it('emits a single-element array when only the build leaf exists (ACS-01)', async () => {
    writeAngularJson(tree, {
      'solo-lib': { projectType: 'library', root: 'projects/solo-lib' },
    });
    writeLeaf(tree, 'projects/solo-lib/tsconfig.lib.json');
    assertCliSubstrate(tree);

    await configurationGenerator(tree, { project: 'solo-lib' });

    expect(
      readProjectConfiguration(tree, 'solo-lib').targets?.typecheck?.options,
    ).toEqual({ tsConfig: ['projects/solo-lib/tsconfig.lib.json'] });
  });

  it('throws a located error when neither build nor spec leaf exists (ACS-01)', async () => {
    writeAngularJson(tree, {
      'empty-lib': { projectType: 'library', root: 'projects/empty-lib' },
    });
    assertCliSubstrate(tree);

    await expect(
      configurationGenerator(tree, { project: 'empty-lib' }),
    ).rejects.toThrow(/Could not resolve a tsconfig for project "empty-lib"/);
  });
});

// WR-01 lock: nx.json is authoritative when present. A hybrid workspace that
// carries BOTH nx.json and angular.json is a real Nx workspace, so
// configurationGenerator must take the Nx else-branch (init-first, seeds
// targetDefaults) rather than the CLI write-fork. Keep nx.json
// (createTreeWithEmptyWorkspace seeds it) and ADD angular.json + a leaf.
describe('configuration generator (hybrid nx.json + angular.json -> Nx branch, WR-01)', () => {
  it('takes the Nx branch (seeds nx.json targetDefaults) when both files exist', async () => {
    const tree = createTreeWithEmptyWorkspace();
    writeAngularJson(tree, {
      'ngx-leaflet-demo': { projectType: 'application', root: '' },
    });
    writeLeaf(tree, 'tsconfig.app.json');

    expect(tree.exists('nx.json')).toBe(true);
    expect(tree.exists('angular.json')).toBe(true);

    await configurationGenerator(tree, {
      project: 'ngx-leaflet-demo',
      skipFormat: true,
    });

    // The CLI write-fork returns BEFORE the nested init, so this key is present
    // only if the Nx else-branch ran init -- proving the discriminator did not
    // misfire on angular.json alone.
    expect(
      readNxJson(tree)?.targetDefaults?.['angular-typechecker:typecheck'],
    ).toBeDefined();
  });
});
