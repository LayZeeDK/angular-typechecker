import {
  addProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import type { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import configurationGenerator from './generator';

// GEN-01/02/03/04/08 unit coverage on the PUBLIC in-memory
// `createTreeWithEmptyWorkspace` substrate (D-12, board D1). The generator emits
// NO files -- it only edits `project.json` (its target) and `nx.json`
// (targetDefaults, via the nested `init`). Assertions pin the WORKSPACE-root-
// relative tsConfig path (Landmine 1) and the collision-by-executor semantics
// (Landmine 3).

describe('configuration generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('wires a solution-tsconfig target and seeds targetDefaults via init (GEN-01/02/03/08)', async () => {
    addProjectConfiguration(tree, 'my-lib', {
      root: 'libs/my-lib',
      projectType: 'library',
      targets: {},
    });
    writeJson(tree, 'libs/my-lib/tsconfig.json', {
      files: [],
      include: [],
      references: [
        { path: './tsconfig.lib.json' },
        { path: './tsconfig.spec.json' },
      ],
    });

    await configurationGenerator(tree, { project: 'my-lib' });

    // GEN-01/02: ONE target at the WORKSPACE-root-relative solution tsconfig.
    const projectConfig = readProjectConfiguration(tree, 'my-lib');

    expect(projectConfig.targets?.typecheck).toEqual({
      executor: 'angular-typechecker:typecheck',
      options: { tsConfig: 'libs/my-lib/tsconfig.json' },
    });

    // GEN-08: running configuration ALONE seeds nx.json targetDefaults (proves it
    // awaits init), with the WALK-02 default-not-production inputs.
    const targetDefaults =
      readNxJson(tree)?.targetDefaults?.['angular-typechecker:typecheck'];

    expect(targetDefaults?.cache).toBe(true);
    expect(targetDefaults?.outputs).toEqual([]);
    expect(targetDefaults?.inputs).toContain('default');
    expect(targetDefaults?.inputs).not.toContain('production');
  });

  it('falls back to tsconfig.lib.json for a flat library with no references (GEN-02)', async () => {
    addProjectConfiguration(tree, 'flat-lib', {
      root: 'libs/flat-lib',
      projectType: 'library',
      targets: {},
    });
    // No solution tsconfig.json -- only the flat leaf exists.
    writeJson(tree, 'libs/flat-lib/tsconfig.lib.json', { compilerOptions: {} });

    await configurationGenerator(tree, { project: 'flat-lib' });

    expect(
      readProjectConfiguration(tree, 'flat-lib').targets?.typecheck?.options,
    ).toEqual({ tsConfig: 'libs/flat-lib/tsconfig.lib.json' });
  });

  it('falls back to tsconfig.app.json for a flat application by projectType (GEN-02)', async () => {
    addProjectConfiguration(tree, 'flat-app', {
      root: 'apps/flat-app',
      projectType: 'application',
      targets: {},
    });
    writeJson(tree, 'apps/flat-app/tsconfig.app.json', { compilerOptions: {} });

    await configurationGenerator(tree, { project: 'flat-app' });

    expect(
      readProjectConfiguration(tree, 'flat-app').targets?.typecheck?.options,
    ).toEqual({ tsConfig: 'apps/flat-app/tsconfig.app.json' });
  });

  it('honors an explicit --tsConfig override, joined project-root-relative (GEN-02)', async () => {
    addProjectConfiguration(tree, 'my-lib', {
      root: 'libs/my-lib',
      projectType: 'library',
      targets: {},
    });
    // No solution tsconfig and no flat leaf: resolution would fail WITHOUT the
    // override, so a successful write proves the override short-circuits. The
    // override is existence-probed, so the file must exist.
    writeJson(tree, 'libs/my-lib/tsconfig.custom.json', { compilerOptions: {} });

    await configurationGenerator(tree, {
      project: 'my-lib',
      tsConfig: 'tsconfig.custom.json',
    });

    expect(
      readProjectConfiguration(tree, 'my-lib').targets?.typecheck?.options,
    ).toEqual({ tsConfig: 'libs/my-lib/tsconfig.custom.json' });
  });

  it('throws a located error when a relative --tsConfig override does not exist (GEN-02)', async () => {
    addProjectConfiguration(tree, 'my-lib', {
      root: 'libs/my-lib',
      projectType: 'library',
      targets: {},
    });
    // The override file is NOT created -- a typo must fail HERE, not at execute time.

    await expect(
      configurationGenerator(tree, {
        project: 'my-lib',
        tsConfig: 'tsconfig.typo.json',
      }),
    ).rejects.toThrow(
      /--tsConfig "tsconfig\.typo\.json".*resolves to "libs\/my-lib\/tsconfig\.typo\.json", which does not exist/,
    );
  });

  it('supports a configurable targetName', async () => {
    addProjectConfiguration(tree, 'my-lib', {
      root: 'libs/my-lib',
      projectType: 'library',
      targets: {},
    });
    writeJson(tree, 'libs/my-lib/tsconfig.json', {
      references: [{ path: './tsconfig.lib.json' }],
    });

    await configurationGenerator(tree, {
      project: 'my-lib',
      targetName: 'check-types',
    });

    const { targets } = readProjectConfiguration(tree, 'my-lib');

    expect(targets?.['check-types']).toEqual({
      executor: 'angular-typechecker:typecheck',
      options: { tsConfig: 'libs/my-lib/tsconfig.json' },
    });
    expect(targets?.typecheck).toBeUndefined();
  });

  it('throws a located error when no tsconfig resolves (GEN-02)', async () => {
    addProjectConfiguration(tree, 'my-lib', {
      root: 'libs/my-lib',
      projectType: 'library',
      targets: {},
    });
    // No tsconfig.json, no tsconfig.lib.json, no --tsConfig override.

    await expect(
      configurationGenerator(tree, { project: 'my-lib' }),
    ).rejects.toThrow(/Could not resolve a tsconfig for project "my-lib"/);
  });

  it('is idempotent for our own target -- rewrites, no duplicate (GEN-04)', async () => {
    addProjectConfiguration(tree, 'my-lib', {
      root: 'libs/my-lib',
      projectType: 'library',
      targets: {
        typecheck: {
          executor: 'angular-typechecker:typecheck',
          options: { tsConfig: 'libs/my-lib/tsconfig.json' },
        },
      },
    });
    writeJson(tree, 'libs/my-lib/tsconfig.json', {
      references: [{ path: './tsconfig.lib.json' }],
    });

    await configurationGenerator(tree, { project: 'my-lib' });

    expect(readProjectConfiguration(tree, 'my-lib').targets?.typecheck).toEqual({
      executor: 'angular-typechecker:typecheck',
      options: { tsConfig: 'libs/my-lib/tsconfig.json' },
    });
  });

  it('preserves user-added keys on our target during an idempotent re-run (GEN-04)', async () => {
    addProjectConfiguration(tree, 'my-lib', {
      root: 'libs/my-lib',
      projectType: 'library',
      targets: {
        typecheck: {
          executor: 'angular-typechecker:typecheck',
          options: { tsConfig: 'libs/my-lib/tsconfig.json', maxWarnings: 0 },
          configurations: { ci: { failFast: true } },
        },
      },
    });
    writeJson(tree, 'libs/my-lib/tsconfig.json', {
      references: [{ path: './tsconfig.lib.json' }],
    });

    await configurationGenerator(tree, { project: 'my-lib' });

    // Re-asserts the executor id + resolved tsConfig, but does NOT clobber the
    // user's extra option (`maxWarnings`) or the `configurations` block (GEN-04
    // "no clobbered config").
    expect(readProjectConfiguration(tree, 'my-lib').targets?.typecheck).toEqual({
      executor: 'angular-typechecker:typecheck',
      options: { tsConfig: 'libs/my-lib/tsconfig.json', maxWarnings: 0 },
      configurations: { ci: { failFast: true } },
    });
  });

  it('throws on a non-ours same-named target instead of clobbering (GEN-04)', async () => {
    addProjectConfiguration(tree, 'my-lib', {
      root: 'libs/my-lib',
      projectType: 'library',
      targets: { typecheck: { executor: '@nx/js:tsc' } },
    });
    writeJson(tree, 'libs/my-lib/tsconfig.json', {
      references: [{ path: './tsconfig.lib.json' }],
    });

    await expect(
      configurationGenerator(tree, { project: 'my-lib' }),
    ).rejects.toThrow(/already has a "typecheck" target/);
  });
});
