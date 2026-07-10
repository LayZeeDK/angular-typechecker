import { formatFiles, getProjects, logger, updateJson } from '@nx/devkit';
import type { Tree } from '@nx/devkit';

import configurationGenerator from '../configuration/generator';
import { NO_CACHING_NOTICE } from '../init/generator';
import type { NgAddGeneratorSchema } from './schema';

// The UNSCOPED published package name -- the key `ng add` installs into
// package.json (dependencies by default; devDependencies once the shipped
// `ng-add.save: devDependencies` manifest field applies -- RF-01).
const PACKAGE_NAME = 'angular-typechecker';

// End-user-facing guidance (no internal ids) for the RF-02 non-Angular-CLI edge:
// `ng add` can be run where there is no angular.json (an Nx-only workspace or a
// bare package). We ensure the devDependency but wire nothing -- an Nx workspace
// is configured via `nx add angular-typechecker` (-> the Nx `init` generator) or
// per project via `nx g angular-typechecker:configuration <project>`.
const NO_ANGULAR_JSON_NOTICE =
  'angular-typechecker: no angular.json found, so no typecheck targets were ' +
  'wired. angular-typechecker was ensured as a devDependency. Run `ng add ' +
  'angular-typechecker` from an Angular CLI workspace to auto-wire targets, or ' +
  'wire a single project with `nx g angular-typechecker:configuration <project>`.';

/**
 * The first-party `ng-add` generator (NGADD-01): `ng add angular-typechecker`.
 *
 * An INSTALL-ORCHESTRATION generator (D-09) -- it COMPOSES the shared Phase-22
 * `configurationGenerator` per project rather than re-implementing any per-project
 * wiring. Registered under the reserved `ng-add` name in `collection.json` and
 * re-exported via `convertNxGenerator` (D-01); NOT in `generators.json`, so the
 * Nx `nx add` surface (which runs `<pkg>:init`) is UNCHANGED (Pitfall 5).
 *
 * Order:
 *   1. Defensive devDependency ensure (RF-01 backstop): if `ng add` placed
 *      angular-typechecker in `dependencies`, move it to `devDependencies` (a
 *      type-checker is dev tooling). Returns VOID -- no install callback, so no
 *      redundant post-schematic `npm install`. A direct package.json edit is used
 *      rather than the devkit add-dependencies helper, which cannot reclassify
 *      deps->devDeps and would schedule an install task.
 *   2. RF-02 guard: without angular.json this is not an Angular CLI workspace --
 *      print guidance and return, wiring no targets and seeding no nx.json.
 *   3. Enumerate `getProjects(tree)` (the angular.json READ polyfill normalizes
 *      `projectType`) and compose `configurationGenerator(tree, { project,
 *      skipFormat: true })` for each `application`/`library` project (skip e2e/other
 *      -- Pitfall 3). `--project` restricts to a single project. Idempotency,
 *      collision-by-builder-id, and leaf resolution are all inherited.
 *   4. Format ONCE (each inner call used `skipFormat: true`).
 *   5. Print the shared no-caching notice ONCE (D-06).
 */
export default async function ngAddGenerator(
  tree: Tree,
  schema: NgAddGeneratorSchema,
): Promise<void> {
  // 1. Defensive devDependency ensure (RF-01) -- unconditional + always safe.
  updateJson(tree, 'package.json', (pkg) => {
    const version = pkg.dependencies?.[PACKAGE_NAME];

    if (version) {
      delete pkg.dependencies[PACKAGE_NAME];
      pkg.devDependencies ??= {};
      pkg.devDependencies[PACKAGE_NAME] ??= version;
    }

    return pkg;
  });

  // 2. RF-02 guard: no angular.json -> devDep-ensure + guidance only.
  if (!tree.exists('angular.json')) {
    logger.info(NO_ANGULAR_JSON_NOTICE);

    return;
  }

  // 3. Enumerate + filter + compose the shared write-fork per in-scope project,
  // tracking how many projects were actually wired.
  let wired = 0;

  for (const [name, project] of getProjects(tree)) {
    if (schema.project && name !== schema.project) {
      continue;
    }

    if (
      project.projectType === 'application' ||
      project.projectType === 'library'
    ) {
      await configurationGenerator(tree, { project: name, skipFormat: true });
      wired++;
    }
  }

  // WR-03: a `--project` that matched no application/library project (a typo, or
  // an e2e/other project) is a user error -- fail loudly with a located error
  // rather than reporting a silent no-op as success, matching the direct
  // `nx g angular-typechecker:configuration <bad>` path. An UNSET `--project` over
  // a workspace with no app/library project is NOT an error (an empty Angular CLI
  // workspace is valid); the IN-01 gate below handles that case honestly.
  if (schema.project && wired === 0) {
    throw new Error(
      `--project "${schema.project}" did not match an application or library ` +
        `project. Omit --project to wire every application + library project.`,
    );
  }

  // IN-01: only claim wiring happened when it did. When zero targets were wired
  // (an angular.json with only e2e/other projects) there is nothing to format and
  // the no-caching notice would misreport, so skip both and return.
  if (wired === 0) {
    return;
  }

  // 4. Format ONCE at the end.
  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  // 5. Print the shared no-caching notice ONCE.
  logger.info(NO_CACHING_NOTICE);
}
