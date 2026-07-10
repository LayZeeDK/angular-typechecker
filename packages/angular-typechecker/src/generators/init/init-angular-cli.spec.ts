import { logger, readNxJson, writeJson } from '@nx/devkit';
import type { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import initGenerator, {
  NO_CACHING_NOTICE,
  TYPECHECK_EXECUTOR_ID,
} from './generator';

// ACS-03 / D-04 coverage for the additive Angular CLI fork in `initGenerator` on a
// GENUINE angular.json-seeded substrate (mirrors configuration-angular-cli.spec.ts):
// createTreeWithEmptyWorkspace() then DELETE nx.json + WRITE angular.json. Every
// case asserts BOTH angular.json present AND nx.json absent so the fork (not the Nx
// else-branch) is what runs, and that the fork seeds NO caching + creates NO stray
// nx.json. The existing init.spec.ts covers the byte-unchanged Nx else-branch (it
// runs on a bare createTreeWithEmptyWorkspace() -> nx.json present, no angular.json).

interface AngularJsonProject {
  projectType: 'application' | 'library';
  root: string;
}

function writeAngularJson(
  tree: Tree,
  projects: Record<string, AngularJsonProject>,
): void {
  writeJson(tree, 'angular.json', { version: 1, projects });
}

function assertCliSubstrate(tree: Tree): void {
  expect(tree.exists('angular.json')).toBe(true);
  expect(tree.exists('nx.json')).toBe(false);
}

describe('init generator (Angular CLI fork, ACS-03)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.delete('nx.json');
    writeAngularJson(tree, {
      'ngx-leaflet-demo': { projectType: 'application', root: '' },
      'ngx-leaflet': { projectType: 'library', root: 'projects/ngx-leaflet' },
    });
  });

  it('creates NO stray nx.json on the Angular CLI branch', async () => {
    assertCliSubstrate(tree);

    await initGenerator(tree, {});

    // The fork returns before readNxJson/updateNxJson, so nx.json is never written.
    assertCliSubstrate(tree);
  });

  it('seeds NO targetDefaults caching (readNxJson stays null, no unscoped key)', async () => {
    await initGenerator(tree, {});

    const nxJson = readNxJson(tree);

    expect(nxJson).toBeNull();
    expect(nxJson?.targetDefaults?.[TYPECHECK_EXECUTOR_ID]).toBeUndefined();
  });

  it('prints the shared no-caching notice once via logger.info (D-06)', async () => {
    const infoSpy = vi
      .spyOn(logger, 'info')
      .mockImplementation(() => undefined);

    await initGenerator(tree, {});

    expect(infoSpy).toHaveBeenCalledWith(NO_CACHING_NOTICE);
    expect(infoSpy).toHaveBeenCalledTimes(1);

    infoSpy.mockRestore();
  });
});
