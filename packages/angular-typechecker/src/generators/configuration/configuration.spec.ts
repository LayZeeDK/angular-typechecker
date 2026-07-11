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
    writeJson(tree, 'libs/my-lib/tsconfig.custom.json', {
      compilerOptions: {},
    });

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

  it('falls back to a flat reference-less tsconfig.json when no app/lib leaf exists (C3)', async () => {
    addProjectConfiguration(tree, 'flat-single', {
      root: 'libs/flat-single',
      projectType: 'library',
      targets: {},
    });
    // The ONLY tsconfig is a flat tsconfig.json that lists files directly: no
    // references[] (branch 2 falls through) and no tsconfig.lib.json leaf. It is
    // still validly checkable, so the target must point at it, not throw.
    writeJson(tree, 'libs/flat-single/tsconfig.json', {
      compilerOptions: {},
      files: ['src/index.ts'],
    });

    await configurationGenerator(tree, { project: 'flat-single' });

    expect(
      readProjectConfiguration(tree, 'flat-single').targets?.typecheck?.options,
    ).toEqual({ tsConfig: 'libs/flat-single/tsconfig.json' });
  });

  it('falls through an empty references[] tsconfig.json to the leaf (S-2 branch-2 false path)', async () => {
    addProjectConfiguration(tree, 'empty-refs', {
      root: 'libs/empty-refs',
      projectType: 'library',
      targets: {},
    });
    // tsconfig.json exists but its references[] is EMPTY -> branch 2 must fall
    // through to the tsconfig.lib.json leaf, not point the target at the solution.
    writeJson(tree, 'libs/empty-refs/tsconfig.json', { references: [] });
    writeJson(tree, 'libs/empty-refs/tsconfig.lib.json', {
      compilerOptions: {},
    });

    await configurationGenerator(tree, { project: 'empty-refs' });

    expect(
      readProjectConfiguration(tree, 'empty-refs').targets?.typecheck?.options,
    ).toEqual({ tsConfig: 'libs/empty-refs/tsconfig.lib.json' });
  });

  it('writes an absolute --tsConfig override verbatim (S-2 passthrough)', async () => {
    addProjectConfiguration(tree, 'my-lib', {
      root: 'libs/my-lib',
      projectType: 'library',
      targets: {},
    });
    // An absolute override cannot be probed against the workspace-relative tree, so
    // it is honored verbatim (OQ-1). A leading-slash path is absolute on both POSIX
    // and win32 (path.isAbsolute('/x') === true on Windows).
    const absolute = '/abs/ws/libs/my-lib/tsconfig.app.json';

    await configurationGenerator(tree, {
      project: 'my-lib',
      tsConfig: absolute,
    });

    expect(
      readProjectConfiguration(tree, 'my-lib').targets?.typecheck?.options,
    ).toEqual({ tsConfig: absolute });
  });

  it('throws when --targetName is an explicit empty string (C13)', async () => {
    addProjectConfiguration(tree, 'my-lib', {
      root: 'libs/my-lib',
      projectType: 'library',
      targets: {},
    });
    writeJson(tree, 'libs/my-lib/tsconfig.json', {
      references: [{ path: './tsconfig.lib.json' }],
    });

    await expect(
      configurationGenerator(tree, { project: 'my-lib', targetName: '' }),
    ).rejects.toThrow(/must be a non-empty target name/);
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

    expect(readProjectConfiguration(tree, 'my-lib').targets?.typecheck).toEqual(
      {
        executor: 'angular-typechecker:typecheck',
        options: { tsConfig: 'libs/my-lib/tsconfig.json' },
      },
    );
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
    expect(readProjectConfiguration(tree, 'my-lib').targets?.typecheck).toEqual(
      {
        executor: 'angular-typechecker:typecheck',
        options: { tsConfig: 'libs/my-lib/tsconfig.json', maxWarnings: 0 },
        configurations: { ci: { failFast: true } },
      },
    );
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

// Full-matrix lock (ACV-01 follow-up, 2026-07-11): a package.json `name` that collides
// with a project.json `name` is a known Nx-workspace hazard. Unlike the Angular CLI
// branch -- where a pnpm-workspace name collision makes Nx return a SHADOWING package
// stub (projectType undefined) that silently drops the build leaf, fixed by reading
// angular.json directly -- the Nx branch reads the AUTHORITATIVE project.json, so the
// same-root package.json + project.json merge (project.json wins) and the target lands
// correctly. This locks that robustness across the Nx x pnpm-workspace x name-collision
// cell so a future Nx-inference regression is caught here rather than in the field.
describe('configuration generator (Nx branch: package.json/project.json name collision + pnpm workspace)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('wires the target to the correct project despite a package.json name collision', async () => {
    addProjectConfiguration(tree, 'my-lib', {
      root: 'libs/my-lib',
      projectType: 'library',
      targets: {},
    });
    writeJson(tree, 'libs/my-lib/tsconfig.json', {
      references: [{ path: './tsconfig.lib.json' }],
    });
    // Collision: the project's OWN package.json `name` === its project.json `name`, plus
    // a pnpm-workspace.yaml that makes Nx's package.json plugin treat libs/my-lib as a
    // workspace package (the shape that stubbed the CLI branch).
    writeJson(tree, 'libs/my-lib/package.json', {
      name: 'my-lib',
      version: '0.0.0',
    });
    tree.write('pnpm-workspace.yaml', "packages:\n  - 'libs/*'\n");

    await configurationGenerator(tree, { project: 'my-lib' });

    expect(readProjectConfiguration(tree, 'my-lib').targets?.typecheck).toEqual(
      {
        executor: 'angular-typechecker:typecheck',
        options: { tsConfig: 'libs/my-lib/tsconfig.json' },
      },
    );
  });
});
