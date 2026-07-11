import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import type { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import configurationGenerator from './generator';

// FULL-MATRIX lock (ACV-01 follow-up). Systematically covers the cross-product the
// milestone cares about:
//
//   {Angular CLI (angular.json), Nx (nx.json + project.json)}
//     x {flat (no workspace manifest),
//        npm/yarn `workspaces` field,
//        pnpm `pnpm-workspace.yaml`}
//     x {Nx-compliant, project name duplicated in package.json}
//     x {app at root "", app in a subdir}
//
// PM note: npm and yarn share the package.json `workspaces` mechanism at the layer that
// matters here (Nx project inference), so the `npm/yarn workspaces` column represents both
// package managers; pnpm is the distinct `pnpm-workspace.yaml` column. The PM BINARY is
// exercised for real by the e2e tier (nx-add-{npm,pnpm,yarn}, ng-cli-e2e, and the manual
// ACV-01 clones); this spec locks the INFERENCE-level behavior deterministically and fast.
//
// INVARIANT under test (charter: complete type-check / never false-pass): for EVERY cell the
// generated `typecheck` target either covers the app BUILD program, or fails LOUDLY -- it must
// NEVER wire spec-only and NEVER silently drop the build leaf. Only ONE cell silently broke
// pre-fix (CLI + pnpm-workspace-including-root + name collision: root app -> spec-only; subdir
// app -> throw). The pathological Nx duplicate (two projects of the SAME name at DIFFERENT
// roots) is a genuinely-ambiguous workspace that Nx rejects with a clear, actionable error --
// asserted here as a LOUD failure, which satisfies the never-SILENT invariant.
//
// Collision shape differs by branch because the workspaces differ: a CLI app at the workspace
// root shares the ROOT package.json (so the collision is root-package-name == project name --
// the realworld-angular case); an Nx project lives in its own dir with its own package.json (so
// the realistic collision is project-dir-package-name == project.json name -- the publishable-lib
// case, which MERGES at one root). Assertions read the WRITTEN config file directly because under
// a collision `readProjectConfiguration` can return the shadowing stub.

type Manifest = 'flat' | 'npm-workspaces' | 'pnpm-workspace';

const PROJECT = 'demo-app';

function writeLeaf(tree: Tree, path: string): void {
  writeJson(tree, path, { compilerOptions: {} });
}

// A pnpm-workspace.yaml makes Nx treat any package.json under its `packages` glob as a
// workspace package. Each branch needs a DIFFERENT glob to seed its realistic collision:
// the CLI branch covers the ROOT (`.`) so the root package.json is the stub trigger for a
// root-app name collision; the Nx branch covers the project dir (`libs/*`) so the project's
// own package.json is a real workspace member. npm/yarn `workspaces` conventionally target
// subdirs (never the root), so on the CLI branch they do NOT shadow -- the matrix uses each
// manifest in its realistic shape. `pnpmGlob` lets each branch pick its own glob.
function writeManifest(
  tree: Tree,
  manifest: Manifest,
  rootPkgName: string,
  pnpmGlob = '.',
): void {
  const pkg: { name: string; workspaces?: string[] } = { name: rootPkgName };
  if (manifest === 'npm-workspaces') {
    pkg.workspaces = ['packages/*'];
  }
  writeJson(tree, 'package.json', pkg);
  if (manifest === 'pnpm-workspace') {
    tree.write('pnpm-workspace.yaml', `packages:\n  - '${pnpmGlob}'\n`);
  }
}

function rel(root: string, file: string): string {
  return root ? `${root}/${file}` : file;
}

const MANIFESTS: Manifest[] = ['flat', 'npm-workspaces', 'pnpm-workspace'];

interface CliCell {
  manifest: Manifest;
  collision: boolean;
  appRoot: string;
}
const cliCells: CliCell[] = MANIFESTS.flatMap((manifest) =>
  [true, false].flatMap((collision) =>
    ['', 'apps/demo-app'].map(
      (appRoot): CliCell => ({ manifest, collision, appRoot }),
    ),
  ),
);

interface NxCell {
  manifest: Manifest;
  collision: boolean;
}
const nxCells: NxCell[] = MANIFESTS.flatMap((manifest) =>
  [true, false].map((collision): NxCell => ({ manifest, collision })),
);

function cliLabel(c: CliCell): string {
  return `${c.manifest} | ${c.collision ? 'name-COLLISION' : 'nx-compliant'} | ${c.appRoot || 'root'}`;
}
function nxLabel(c: NxCell): string {
  return `${c.manifest} | ${c.collision ? 'name-COLLISION' : 'nx-compliant'} | libs/demo-app`;
}

describe('configuration generator FULL MATRIX: build leaf is never silently dropped', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('Angular CLI branch (angular.json, no nx.json)', () => {
    it.each(cliCells.map((c) => [cliLabel(c), c] as const))(
      'wires the full [build, spec] leaf array — %s',
      async (label, cell) => {
        tree.delete('nx.json');

        const buildLeaf = rel(cell.appRoot, 'tsconfig.app.json');
        const specLeaf = rel(cell.appRoot, 'tsconfig.spec.json');
        writeJson(tree, 'angular.json', {
          version: 1,
          projects: {
            [PROJECT]: {
              projectType: 'application',
              root: cell.appRoot,
              sourceRoot: cell.appRoot ? `${cell.appRoot}/src` : 'src',
              architect: {
                build: {
                  builder: '@angular/build:application',
                  options: { tsConfig: buildLeaf },
                },
              },
            },
          },
        });
        writeLeaf(tree, buildLeaf);
        writeLeaf(tree, specLeaf);
        // CLI collision = root package.json name === the angular.json project name.
        writeManifest(
          tree,
          cell.manifest,
          cell.collision ? PROJECT : 'workspace-root',
        );

        expect(tree.exists('angular.json')).toBe(true);
        expect(tree.exists('nx.json')).toBe(false);

        // Must not throw for any cell (the subdir-app collision threw pre-fix).
        await configurationGenerator(tree, { project: PROJECT });

        const angularJson = readJson<{
          projects: Record<
            string,
            { architect?: Record<string, { options?: { tsConfig?: unknown } }> }
          >;
        }>(tree, 'angular.json');
        const tsConfig =
          angularJson.projects[PROJECT]?.architect?.['typecheck']?.options
            ?.tsConfig;

        expect(tsConfig, `${label} must include the build leaf`).toEqual([
          buildLeaf,
          specLeaf,
        ]);
      },
    );
  });

  // ROBUSTNESS LOCK (not a discriminating regression test). The Nx branch reads the
  // AUTHORITATIVE project.json, so a same-root package.json/project.json name collision --
  // made a REAL pnpm workspace member here via the `libs/*` glob -- MERGES with project.json
  // winning. BOTH collision and clean therefore resolve to the same solution tsconfig BY
  // DESIGN; the `collision` dimension does not change the resolved target, it just proves the
  // invariant holds across the manifest cross-product so a future Nx-inference regression is
  // caught. The dedicated same-root collision assertion lives in configuration.spec.ts.
  describe('Nx branch (nx.json + project.json)', () => {
    it.each(nxCells.map((c) => [nxLabel(c), c] as const))(
      'wires a build-covering solution tsConfig — %s',
      async (label, cell) => {
        const projectRoot = 'libs/demo-app';
        // keep nx.json (createTreeWithEmptyWorkspace seeds it)
        addProjectConfiguration(tree, PROJECT, {
          root: projectRoot,
          projectType: 'application',
          targets: {},
        });
        writeJson(tree, `${projectRoot}/tsconfig.json`, {
          references: [
            { path: './tsconfig.app.json' },
            { path: './tsconfig.spec.json' },
          ],
        });
        writeLeaf(tree, `${projectRoot}/tsconfig.app.json`);
        writeLeaf(tree, `${projectRoot}/tsconfig.spec.json`);
        // Nx collision = the project's OWN package.json name === its project.json name. With
        // the pnpm `libs/*` glob (below) that package.json is a REAL workspace member, so Nx
        // MERGES the two same-root projects (project.json wins). The ROOT stays distinct.
        if (cell.collision) {
          writeJson(tree, `${projectRoot}/package.json`, {
            name: PROJECT,
            version: '0.0.0',
          });
        }
        // pnpm glob covers the project dir so the collision above is a genuine workspace
        // member (the CLI branch's default `.` would only shadow the root, not libs/demo-app).
        writeManifest(tree, cell.manifest, 'workspace-root', 'libs/*');

        await configurationGenerator(tree, { project: PROJECT });

        const tsConfig = readProjectConfiguration(tree, PROJECT).targets?.[
          'typecheck'
        ]?.options?.['tsConfig'];

        expect(
          tsConfig,
          `${label} must resolve a build-covering tsconfig`,
        ).toBe(`${projectRoot}/tsconfig.json`);
      },
    );

    it('fails LOUDLY (never silently) on a genuinely-ambiguous same-name-different-root duplicate', async () => {
      // Pathological: the ROOT package.json name equals a NESTED project.json name, and a
      // pnpm-workspace including `.` makes both real projects -> two `demo-app` at different
      // roots. Nx rejects this with a clear, actionable error; the generator surfaces it rather
      // than silently mis-resolving. This LOCKS "loud, not silent" for the ambiguous case.
      const projectRoot = 'libs/demo-app';
      addProjectConfiguration(tree, PROJECT, {
        root: projectRoot,
        projectType: 'application',
        targets: {},
      });
      writeJson(tree, `${projectRoot}/tsconfig.json`, {
        references: [{ path: './tsconfig.app.json' }],
      });
      writeLeaf(tree, `${projectRoot}/tsconfig.app.json`);
      writeManifest(tree, 'pnpm-workspace', PROJECT); // root package named `demo-app`

      await expect(
        configurationGenerator(tree, { project: PROJECT }),
      ).rejects.toThrow(/defined in multiple locations/i);
    });
  });
});
