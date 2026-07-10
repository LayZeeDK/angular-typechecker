import {
  getProjects,
  logger,
  readNxJson,
  readProjectConfiguration,
  updateJson,
  writeJson,
} from '@nx/devkit';
import type { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NO_CACHING_NOTICE } from '../init/generator';
import ngAddGenerator from './generator';

// NGADD-01 coverage for the first-party `ng-add` generator on a GENUINE
// angular.json-seeded substrate (mirrors configuration-angular-cli.spec.ts):
// createTreeWithEmptyWorkspace() then DELETE nx.json + WRITE angular.json + the
// leaf tsconfigs. ngAddGenerator COMPOSES the shared configurationGenerator per
// app+library project, so idempotency / collision / leaf resolution are inherited;
// these tests assert the ORCHESTRATION: auto-wire-all, skip e2e/other, the RF-02
// no-angular.json guard, the defensive devDependency move, and the notice-once.

interface AngularJsonProject {
  projectType?: 'application' | 'library' | string;
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

const APP_TARGET = {
  executor: 'angular-typechecker:typecheck',
  options: { tsConfig: ['tsconfig.app.json', 'tsconfig.spec.json'] },
};

const LIB_TARGET = {
  executor: 'angular-typechecker:typecheck',
  options: {
    tsConfig: [
      'projects/ngx-leaflet/tsconfig.lib.json',
      'projects/ngx-leaflet/tsconfig.spec.json',
    ],
  },
};

describe('ng-add generator (Angular CLI auto-wire-all)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.delete('nx.json');
  });

  it('auto-wires a typecheck target into EVERY application + library project (NGADD-01)', async () => {
    seedNgxLeafletWorkspace(tree);
    assertCliSubstrate(tree);

    await ngAddGenerator(tree, {});

    expect(
      readProjectConfiguration(tree, 'ngx-leaflet-demo').targets?.typecheck,
    ).toEqual(APP_TARGET);
    expect(
      readProjectConfiguration(tree, 'ngx-leaflet').targets?.typecheck,
    ).toEqual(LIB_TARGET);
  });

  it('restricts wiring to a single project when --project is set', async () => {
    seedNgxLeafletWorkspace(tree);
    assertCliSubstrate(tree);

    await ngAddGenerator(tree, { project: 'ngx-leaflet' });

    expect(
      readProjectConfiguration(tree, 'ngx-leaflet').targets?.typecheck,
    ).toEqual(LIB_TARGET);
    expect(
      readProjectConfiguration(tree, 'ngx-leaflet-demo').targets?.typecheck,
    ).toBeUndefined();
  });

  it('is idempotent across the whole workspace on a second run', async () => {
    seedNgxLeafletWorkspace(tree);

    await ngAddGenerator(tree, {});
    await ngAddGenerator(tree, {});

    expect(
      readProjectConfiguration(tree, 'ngx-leaflet-demo').targets?.typecheck,
    ).toEqual(APP_TARGET);
    expect(
      readProjectConfiguration(tree, 'ngx-leaflet').targets?.typecheck,
    ).toEqual(LIB_TARGET);
  });

  it('re-asserts OUR target while preserving user options/configurations, and wires the untouched project fresh', async () => {
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
      'ngx-leaflet': { projectType: 'library', root: 'projects/ngx-leaflet' },
    });
    writeLeaf(tree, 'tsconfig.app.json');
    writeLeaf(tree, 'tsconfig.spec.json');
    writeLeaf(tree, 'projects/ngx-leaflet/tsconfig.lib.json');
    writeLeaf(tree, 'projects/ngx-leaflet/tsconfig.spec.json');
    assertCliSubstrate(tree);

    await ngAddGenerator(tree, {});

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
    expect(
      readProjectConfiguration(tree, 'ngx-leaflet').targets?.typecheck,
    ).toEqual(LIB_TARGET);
  });

  it('throws on a same-named NON-ours target instead of clobbering (NGADD-01)', async () => {
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

    await expect(ngAddGenerator(tree, {})).rejects.toThrow(
      /already has a "typecheck" target/,
    );
  });

  it('skips e2e/other project types (missing or non-app/library projectType)', async () => {
    writeAngularJson(tree, {
      'ngx-leaflet-demo': { projectType: 'application', root: '' },
      // Legacy e2e projects carry NO projectType field (Pitfall 3).
      'ngx-leaflet-demo-e2e': { root: 'e2e' },
    });
    writeLeaf(tree, 'tsconfig.app.json');
    writeLeaf(tree, 'tsconfig.spec.json');
    assertCliSubstrate(tree);

    await ngAddGenerator(tree, {});

    expect(
      readProjectConfiguration(tree, 'ngx-leaflet-demo').targets?.typecheck,
    ).toEqual(APP_TARGET);
    expect(
      readProjectConfiguration(tree, 'ngx-leaflet-demo-e2e').targets?.typecheck,
    ).toBeUndefined();
  });

  it('moves a dependencies entry to devDependencies (RF-01 backstop)', async () => {
    seedNgxLeafletWorkspace(tree);
    updateJson(tree, 'package.json', (pkg) => {
      pkg.dependencies ??= {};
      pkg.dependencies['angular-typechecker'] = '0.2.0';

      return pkg;
    });

    await ngAddGenerator(tree, {});

    const pkg = JSON.parse(tree.read('package.json', 'utf-8') as string);
    expect(pkg.dependencies?.['angular-typechecker']).toBeUndefined();
    expect(pkg.devDependencies?.['angular-typechecker']).toBe('0.2.0');
  });

  it('prints the no-caching notice exactly once on the main path', async () => {
    seedNgxLeafletWorkspace(tree);
    const infoSpy = vi
      .spyOn(logger, 'info')
      .mockImplementation(() => undefined);

    await ngAddGenerator(tree, {});

    const noticeCalls = infoSpy.mock.calls.filter(
      (call) => call[0] === NO_CACHING_NOTICE,
    );
    expect(noticeCalls).toHaveLength(1);

    infoSpy.mockRestore();
  });
});

describe('ng-add generator (RF-02 no-angular.json guard)', () => {
  let tree: Tree;

  beforeEach(() => {
    // Keep nx.json; NEVER write angular.json -- this is the non-Angular-CLI tree.
    tree = createTreeWithEmptyWorkspace();
  });

  it('wires no target, seeds no nx.json targetDefaults, ensures the devDependency, and prints guidance', async () => {
    updateJson(tree, 'package.json', (pkg) => {
      pkg.dependencies ??= {};
      pkg.dependencies['angular-typechecker'] = '0.2.0';

      return pkg;
    });
    const infoSpy = vi
      .spyOn(logger, 'info')
      .mockImplementation(() => undefined);

    await ngAddGenerator(tree, {});

    // No angular.json target wiring: the workspace has no projects to enumerate.
    expect(getProjects(tree).size).toBe(0);
    // No nx.json targetDefaults seeded (initGenerator is never invoked).
    expect(
      readNxJson(tree)?.targetDefaults?.['angular-typechecker:typecheck'],
    ).toBeUndefined();
    // The devDependency is still ensured.
    const pkg = JSON.parse(tree.read('package.json', 'utf-8') as string);
    expect(pkg.dependencies?.['angular-typechecker']).toBeUndefined();
    expect(pkg.devDependencies?.['angular-typechecker']).toBe('0.2.0');
    // Guidance printed; the no-caching notice is NOT printed off the CLI path.
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy.mock.calls[0][0]).not.toBe(NO_CACHING_NOTICE);

    infoSpy.mockRestore();
  });
});
