import {
  formatFiles,
  joinPathFragments,
  logger,
  readJson,
  readProjectConfiguration,
  updateJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import type { ProjectConfiguration, Tree } from '@nx/devkit';

import {
  isAngularCliWorkspace,
  NO_CACHING_NOTICE,
  resolveTargetName,
  resolveTsConfigLeaves,
  resolveTsConfigOverride,
  wireTypecheckTarget,
} from '../../core/angular-cli-wiring';
import type { AngularJsonWorkspace } from '../../core/angular-cli-wiring';
import initGenerator, { TYPECHECK_EXECUTOR_ID } from '../init/generator';
import type { ConfigurationGeneratorSchema } from './schema';

/**
 * Resolves the WORKSPACE-root-relative tsconfig path the generated target points
 * at, per D-07 resolution order. Reads the virtual `Tree` ONLY (never `node:fs`)
 * so it works on `createTreeWithEmptyWorkspace` (Landmine 2).
 *
 * Order:
 *   1. explicit `--tsConfig` override -- an ABSOLUTE path passes through
 *      verbatim; a relative one is interpreted project-root-relative
 *      (`joinPathFragments(projectConfig.root, override)`) (OQ-1 RESOLVED).
 *   2. the project's solution `tsconfig.json` IF it exists AND has a non-empty
 *      `references[]` array -> point the ONE target at it (WALK-01 then walks the
 *      in-project leaves incl. `tsconfig.spec.json` -- this is GEN-03).
 *   3. flat-project fallback: the leaf tsconfig by `projectType`
 *      (`application` -> `tsconfig.app.json`, else `tsconfig.lib.json`), gated by
 *      a `tree.exists` probe.
 *   4. flat single-tsconfig fallback: a project whose ONLY tsconfig is a flat,
 *      reference-less `tsconfig.json` that lists files directly (no app/lib leaf,
 *      no `references[]` to walk). Point the ONE target at it -- runTypecheck reads
 *      its rootNames and type-checks it via the direct leaf path.
 *   5. else throw a clear, located error.
 *
 * The returned path is WORKSPACE-root-relative because `projectConfig.root`
 * already is (e.g. `libs/foo` -> `libs/foo/tsconfig.json`). The executor resolves
 * a relative `options.tsConfig` against the workspace root, so a project-root-
 * relative path here would miss (Landmine 1 / Pitfall 1).
 */
function resolveTsConfig(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  schema: ConfigurationGeneratorSchema,
): string {
  const root = projectConfig.root;

  // 1. explicit override wins (OQ-1) -- a cohesive sub-decision routed to the shared
  // core helper (absolute verbatim / relative probed-and-located).
  if (schema.tsConfig) {
    return resolveTsConfigOverride(root, schema.tsConfig, schema.project, (p) =>
      tree.exists(p),
    );
  }

  // 2. solution tsconfig.json WITH a non-empty references[] -> point at it.
  const solution = joinPathFragments(root, 'tsconfig.json');
  const solutionExists = tree.exists(solution);

  if (solutionExists) {
    const json = readJson<{ references?: unknown[] }>(tree, solution);

    if (Array.isArray(json.references) && json.references.length > 0) {
      return solution;
    }
  }

  // 3. flat-project fallback -> leaf by projectType + existence probe.
  const leaf =
    projectConfig.projectType === 'application'
      ? 'tsconfig.app.json'
      : 'tsconfig.lib.json';
  const leafPath = joinPathFragments(root, leaf);

  if (tree.exists(leafPath)) {
    return leafPath;
  }

  // 4. flat single-tsconfig fallback: the project's ONLY tsconfig is a flat,
  // reference-less `tsconfig.json` that lists files directly (branch 2 fell through
  // because it has no non-empty references[], and there is no app/lib leaf). It is
  // still a validly-checkable leaf, so point the ONE target at it -- the executor's
  // runTypecheck reads its rootNames and type-checks it via the direct leaf path
  // (the walk never engages without references). Without this a validly-checkable
  // single-tsconfig project would be un-configurable (C3).
  if (solutionExists) {
    return solution;
  }

  // 5. nothing resolved.
  throw new Error(
    `Could not resolve a tsconfig for project "${schema.project}": no ` +
      `"${solution}" and no "${leafPath}". Pass --tsConfig explicitly.`,
  );
}

/**
 * The `configuration` generator (GEN-01/02/03/04/08 + D-01 write-fork):
 * `nx g angular-typechecker:configuration <project>` /
 * `ng generate angular-typechecker:configuration <project>`.
 *
 * Config-edit only (no `generateFiles`, no file emission). The `targetName`
 * default + empty-name guard are HOISTED so both branches share them. On an
 * Angular CLI workspace (angular.json present) the D-01 fork writes the target
 * straight into angular.json's `architect` map with the leaf ARRAY and skips the
 * Nx init (D-04). Otherwise the byte-unchanged Nx path runs: init-first
 * (GEN-08 / D-10), single-string solution `tsConfig` (D-07), collision-by-executor
 * (D-09), one minimal `typecheck` target, format once. A re-run of OUR target is
 * idempotent on both branches; a same-named NON-ours target throws a clear,
 * located error.
 */
export default async function configurationGenerator(
  tree: Tree,
  schema: ConfigurationGeneratorSchema,
): Promise<void> {
  // Shared by BOTH branches. GEN-04 default + empty-name guard, routed to the shared
  // core (same located error string).
  const targetName = resolveTargetName(schema.targetName, schema.project);

  // D-01 write-fork: an Angular CLI workspace has angular.json AND no nx.json.
  // nx.json is authoritative when present (WR-01): a hybrid workspace carrying BOTH
  // files is a real Nx workspace and MUST take the Nx path below -- its projects may
  // be defined via project.json (not angular.json's `projects` map), where the
  // `json.projects[schema.project]` lookup here would be `undefined` and throw. On a
  // genuine CLI workspace the project's root + projectType are read STRAIGHT from
  // angular.json (see the block below -- readProjectConfiguration is unreliable under a
  // pnpm-workspace name collision); `updateProjectConfiguration` cannot write angular.json
  // (Pitfall 2), so the target is edited straight in via `updateJson`. The Nx init
  // is skipped (D-04): there is no nx.json / targetDefaults analog off-Nx.
  if (isAngularCliWorkspace((path) => tree.exists(path))) {
    // Read `root`/`projectType` STRAIGHT from angular.json -- NOT via
    // readProjectConfiguration. On a workspace that is ALSO a pnpm workspace
    // (pnpm-workspace.yaml) whose root package.json `name` collides with the
    // angular.json project name, Nx infers a package.json project stub (root ".",
    // projectType undefined) that SHADOWS the angular.json project; trusting it
    // silently drops the app build leaf for a root app (spec-only under-checking)
    // or throws for a subdir app. angular.json is authoritative on this branch.
    // (ACV-01 real-clone finding, realworld-angular @ 9e3528f, 2026-07-11.)
    const cliProject = readJson<AngularJsonWorkspace>(tree, 'angular.json')
      .projects[schema.project];

    if (!cliProject) {
      throw new Error(
        `Project "${schema.project}" was not found in angular.json.`,
      );
    }

    // RF-01 (Approach A) leaf-array resolution, routed to the shared core. `root`/
    // `projectType` come STRAIGHT from angular.json (read above) so a pnpm-workspace
    // name collision cannot shadow them (ACV-01).
    const tsConfig = resolveTsConfigLeaves(
      cliProject.root ?? '',
      cliProject.projectType,
      schema.tsConfig,
      schema.project,
      (p) => tree.exists(p),
    );

    // D-05 collision-by-builder + idempotent [build, spec] merge, routed to the
    // shared core (mutates the parsed workspace; updateJson persists it).
    updateJson<AngularJsonWorkspace>(tree, 'angular.json', (json) => {
      wireTypecheckTarget(json, schema.project, targetName, tsConfig);

      return json;
    });

    if (!schema.skipFormat) {
      await formatFiles(tree);
    }

    // D-06: the CLI fork wired the target with no target caching (there is no
    // nx.json / targetDefaults analog off-Nx). Print the shared no-caching notice
    // ONCE -- matching the init fork (init/generator.ts) and the ng-add schematic,
    // so a user reaching this no-caching state via `ng generate ...:configuration`
    // gets the same explanation they would via `ng add` or `nx add`.
    logger.info(NO_CACHING_NOTICE);

    return;
  }

  // ELSE -- the byte-unchanged Nx path (ACS-02). GEN-08 / D-10: seed workspace
  // caching FIRST via init with `skipFormat: true` so we format ONCE at the end.
  await initGenerator(tree, { skipFormat: true });

  const projectConfig = readProjectConfiguration(tree, schema.project);

  const tsConfig = resolveTsConfig(tree, projectConfig, schema);

  // GEN-04 / D-09: collision by EXECUTOR (compare the UNSCOPED id). A same-named
  // target that is NOT ours is a genuine clash -> throw, do not clobber. A
  // same-named target that IS ours is rewritten to the same shape (idempotent).
  const existing = projectConfig.targets?.[targetName];

  if (existing && existing.executor !== TYPECHECK_EXECUTOR_ID) {
    throw new Error(
      `Project "${schema.project}" already has a "${targetName}" target using ` +
        `executor "${existing.executor}". Choose a different --targetName or ` +
        `remove the existing target.`,
    );
  }

  projectConfig.targets ??= {};
  // GEN-04 / D-09: on an idempotent re-run of OUR target, preserve any user-added
  // target keys (e.g. a `configurations` block) and extra `options` (e.g.
  // `maxWarnings`, `includeDeps`, `failFast`) -- re-assert only the executor id and
  // the resolved `tsConfig`, rather than clobbering the whole target object. On a
  // first run `existing` is undefined, so this is a plain write. (A non-ours target
  // already threw above.)
  projectConfig.targets[targetName] = {
    ...existing,
    executor: TYPECHECK_EXECUTOR_ID,
    options: { ...existing?.options, tsConfig },
  };
  updateProjectConfiguration(tree, schema.project, projectConfig);

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  // No deferred post-generation tasks (the nested init is awaited above, and its
  // formatting is folded into the single formatFiles here), so this returns void
  // -- matching the sibling `init` generator (no no-op GeneratorCallback needed;
  // Nx accepts a void generator return).
}
