import {
  getProjects,
  logger,
  readJson,
  readNxJson,
  readProjectConfiguration,
  updateJson,
  writeJson,
} from '@nx/devkit';
import type { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

// Spies created with vi.spyOn are restored after every test so a stubbed
// logger.info cannot leak into a later test if an assertion throws first
// (vitest.config.mts sets neither restoreMocks nor clearMocks).
afterEach(() => {
  vi.restoreAllMocks();
});

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
  });

  it('throws when --project names a project that does not exist (WR-03)', async () => {
    seedNgxLeafletWorkspace(tree);
    assertCliSubstrate(tree);

    await expect(
      ngAddGenerator(tree, { project: 'does-not-exist' }),
    ).rejects.toThrow(
      /--project "does-not-exist" did not match an application or library project/,
    );
  });

  it('throws when --project names an e2e/non-app-library project (WR-03)', async () => {
    writeAngularJson(tree, {
      'ngx-leaflet-demo': { projectType: 'application', root: '' },
      // Legacy e2e projects carry NO projectType field (Pitfall 3) -- enumerated
      // but not wireable, so scoping to it matches nothing wireable.
      'ngx-leaflet-demo-e2e': { root: 'e2e' },
    });
    writeLeaf(tree, 'tsconfig.app.json');
    writeLeaf(tree, 'tsconfig.spec.json');
    assertCliSubstrate(tree);

    await expect(
      ngAddGenerator(tree, { project: 'ngx-leaflet-demo-e2e' }),
    ).rejects.toThrow(
      /--project "ngx-leaflet-demo-e2e" did not match an application or library project/,
    );
  });

  it('does NOT print the no-caching notice when auto-wire-all wires zero targets (IN-01)', async () => {
    // angular.json with ONLY an e2e/other project: auto-wire-all (no --project) is
    // valid and NOT an error, but nothing is wired -- the notice must not claim it.
    writeAngularJson(tree, {
      'ngx-leaflet-demo-e2e': { root: 'e2e' },
    });
    assertCliSubstrate(tree);
    const infoSpy = vi
      .spyOn(logger, 'info')
      .mockImplementation(() => undefined);

    await ngAddGenerator(tree, {});

    expect(infoSpy).not.toHaveBeenCalledWith(NO_CACHING_NOTICE);
  });
});

// ACV-01 real-clone regression AT THE ng-add ENTRY POINT (2026-07-11, realworld-angular
// @ 9e3528f). The fix (commit 1837b25) made configurationGenerator read root/projectType
// straight from angular.json instead of readProjectConfiguration. ngAddGenerator does not
// resolve leaves itself -- it COMPOSES that shared configurationGenerator once per in-scope
// project, so it INHERITS the CLI-branch leaf-resolution fix. What these cases lock is the
// COMPOSED `ng add` entry point end-to-end over the pnpm-collision substrate: it must still
// write the app's FULL [app, spec] leaf array (it would regress to spec-only for a root app,
// or drop the build leaf, if the composed configurationGenerator lost the fix and fell back
// to readProjectConfiguration). NOTE: on this in-memory substrate getProjects(tree) returns
// the CORRECT angular.json project (projectType 'application'), NOT the shadowing stub --
// only readProjectConfiguration(tree, name) returns the stub -- so ng-add's own getProjects
// filter never sees `undefined`, and a getProjects-based skip cannot be reproduced here (it
// is deferred to the real-clone / e2e tier). Assertions read angular.json DIRECTLY because
// readProjectConfiguration returns the shadowing stub (which carries no typecheck target)
// even after a correct write.
describe('ng-add generator (Angular CLI + pnpm-workspace name collision, ACV-01 regression)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.delete('nx.json');
  });

  // Root package.json `name` === the angular.json project name, plus a pnpm-workspace.yaml
  // whose `packages` glob covers the root (`.`) so Nx infers the shadowing root-package
  // stub -- the exact shape that broke the direct generator (see configuration-angular-cli
  // .spec.ts). A glob that does NOT cover the root leaves the project un-shadowed (vacuous).
  function seedPnpmCollision(projectName: string): void {
    writeJson(tree, 'package.json', { name: projectName });
    tree.write('pnpm-workspace.yaml', "packages:\n  - '.'\n");
  }

  function writtenTsConfig(project: string): unknown {
    const json = readJson<{
      projects: Record<
        string,
        { architect?: Record<string, { options?: { tsConfig?: unknown } }> }
      >;
    }>(tree, 'angular.json');

    return json.projects[project]?.architect?.['typecheck']?.options?.tsConfig;
  }

  it('auto-wires the ROOT app with the full [app, spec] array despite the pnpm stub (real `ng add` entry point)', async () => {
    writeAngularJson(tree, {
      'demo-app': { projectType: 'application', root: '' },
    });
    writeLeaf(tree, 'tsconfig.app.json');
    writeLeaf(tree, 'tsconfig.spec.json');
    seedPnpmCollision('demo-app');
    assertCliSubstrate(tree);

    // Auto-wire-all (no --project) -- the default `ng add angular-typechecker`. The composed
    // configurationGenerator must resolve the leaf array from angular.json; a regression to
    // readProjectConfiguration would hit the shadowing stub and drop the app build leaf.
    await ngAddGenerator(tree, {});

    expect(writtenTsConfig('demo-app')).toEqual([
      'tsconfig.app.json',
      'tsconfig.spec.json',
    ]);
  });

  it('auto-wires a SUBDIR app with the full [app, spec] array despite the pnpm stub', async () => {
    writeAngularJson(tree, {
      'demo-app': { projectType: 'application', root: 'apps/demo-app' },
    });
    writeLeaf(tree, 'apps/demo-app/tsconfig.app.json');
    writeLeaf(tree, 'apps/demo-app/tsconfig.spec.json');
    seedPnpmCollision('demo-app');
    assertCliSubstrate(tree);

    await ngAddGenerator(tree, {});

    expect(writtenTsConfig('demo-app')).toEqual([
      'apps/demo-app/tsconfig.app.json',
      'apps/demo-app/tsconfig.spec.json',
    ]);
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
  });
});
