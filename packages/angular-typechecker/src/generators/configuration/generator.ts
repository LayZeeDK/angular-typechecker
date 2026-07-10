import { isAbsolute } from 'node:path';

import {
  formatFiles,
  joinPathFragments,
  readJson,
  readProjectConfiguration,
  updateJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import type { ProjectConfiguration, Tree } from '@nx/devkit';

import initGenerator, { TYPECHECK_EXECUTOR_ID } from '../init/generator';
import type { ConfigurationGeneratorSchema } from './schema';

/**
 * OQ-1: resolves an explicit `--tsConfig` override. An ABSOLUTE path passes through
 * verbatim (it cannot be existence-probed against the workspace-relative tree); a
 * relative one is interpreted project-root-relative and existence-probed so a typo
 * fails HERE with a clear located error (matching the other resolution rungs)
 * rather than silently writing a broken target that only fails at execute time.
 */
function resolveTsConfigOverride(
  tree: Tree,
  projectRoot: string,
  tsConfig: string,
  project: string,
): string {
  if (isAbsolute(tsConfig)) {
    return tsConfig;
  }

  const overridePath = joinPathFragments(projectRoot, tsConfig);

  if (!tree.exists(overridePath)) {
    throw new Error(
      `--tsConfig "${tsConfig}" for project "${project}" resolves to ` +
        `"${overridePath}", which does not exist. Pass a path relative to the ` +
        `project root (or an absolute path).`,
    );
  }

  return overridePath;
}

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

  // 1. explicit override wins (OQ-1) -- a cohesive sub-decision, so it lives in its
  // own helper (absolute verbatim / relative probed-and-located).
  if (schema.tsConfig) {
    return resolveTsConfigOverride(tree, root, schema.tsConfig, schema.project);
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
 * RF-01 (Approach A): resolves a project's leaf tsconfig ARRAY for the Angular
 * CLI write-fork -- the counterpart to `resolveTsConfig`'s single-string Nx
 * output, added ALONGSIDE it (never modifying it) so the Nx path stays
 * byte-identical (Pitfall 5). Reads the virtual `Tree` ONLY (never `node:fs`).
 *
 * An explicit `--tsConfig` override short-circuits to a SINGLE-element array
 * (`[resolved]`) via the same `resolveTsConfigOverride` discipline as the Nx
 * branch. Otherwise it takes the projectType-convention build leaf
 * (`application` -> `tsconfig.app.json`, else `tsconfig.lib.json`) plus
 * `tsconfig.spec.json`, each existence-probed against `projectConfig.root`. A
 * missing leaf is dropped; a project with a single leaf emits just that one; an
 * empty result throws the located error (never a silent under-checking target).
 *
 * Approach B (reading `architect.build.options.tsConfig`) is deliberately NOT
 * used: the default `@angular/build:ng-packagr` library builder carries no
 * `tsConfig` in `options` (it lives under `configurations`), so B would silently
 * miss the library build leaf (RF-01, Pitfall 2).
 */
function resolveTsConfigLeaves(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  schema: ConfigurationGeneratorSchema,
): string[] {
  const root = projectConfig.root;

  // explicit override wins -- a single leaf, wrapped as an array for CLI-branch
  // shape uniformity (the ENG-01 engine accepts string | string[]).
  if (schema.tsConfig) {
    return [
      resolveTsConfigOverride(tree, root, schema.tsConfig, schema.project),
    ];
  }

  const buildLeaf =
    projectConfig.projectType === 'application'
      ? joinPathFragments(root, 'tsconfig.app.json')
      : joinPathFragments(root, 'tsconfig.lib.json');
  const specLeaf = joinPathFragments(root, 'tsconfig.spec.json');

  const leaves = [buildLeaf, specLeaf].filter((leaf) => tree.exists(leaf));

  if (leaves.length === 0) {
    throw new Error(
      `Could not resolve a tsconfig for project "${schema.project}": no ` +
        `"${buildLeaf}" and no "${specLeaf}". Pass --tsConfig explicitly.`,
    );
  }

  return leaves;
}

/**
 * Minimal shape of an Angular CLI `angular.json` workspace, typed just enough
 * for the D-01 write-fork's `updateJson` edit. A raw on-disk `angular.json`
 * uses the `architect` target map -- the Nx `targets` alias only appears in the
 * config `readProjectConfiguration` RETURNS, never on disk -- so the collision
 * read and the write both operate on `architect`.
 */
interface AngularJsonTarget {
  builder?: string;
  options?: Record<string, unknown>;
  [key: string]: unknown;
}

interface AngularJsonProject {
  architect?: Record<string, AngularJsonTarget>;
  [key: string]: unknown;
}

interface AngularJsonWorkspace {
  projects: Record<string, AngularJsonProject>;
  [key: string]: unknown;
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
  // Shared by BOTH branches. GEN-04: `??` only substitutes the default for a
  // MISSING targetName, not an explicit empty string (`'' ?? x === ''`); an empty
  // / whitespace-only name would write an unrunnable target keyed by `''`, so
  // reject it here with a located error.
  const targetName = schema.targetName ?? 'typecheck';

  if (targetName.trim() === '') {
    throw new Error(
      `--targetName for project "${schema.project}" must be a non-empty target ` +
        `name. Omit it to use the default "typecheck".`,
    );
  }

  // D-01 write-fork: an Angular CLI workspace has angular.json AND no nx.json.
  // nx.json is authoritative when present (WR-01): a hybrid workspace carrying BOTH
  // files is a real Nx workspace and MUST take the Nx path below -- its projects may
  // be defined via project.json (not angular.json's `projects` map), where the
  // `json.projects[schema.project]` lookup here would be `undefined` and throw. On a
  // genuine CLI workspace `readProjectConfiguration` polyfills root + projectType
  // from angular.json; `updateProjectConfiguration` cannot write angular.json
  // (Pitfall 2), so the target is edited straight in via `updateJson`. The Nx init
  // is skipped (D-04): there is no nx.json / targetDefaults analog off-Nx.
  if (tree.exists('angular.json') && !tree.exists('nx.json')) {
    const projectConfig = readProjectConfiguration(tree, schema.project);
    const tsConfig = resolveTsConfigLeaves(tree, projectConfig, schema);

    updateJson<AngularJsonWorkspace>(tree, 'angular.json', (json) => {
      const project = json.projects[schema.project];

      // D-05 collision by BUILDER id (the SAME string as the executor id). Read
      // and write the SAME `architect` map (WR-01): a raw angular.json always uses
      // `architect`, so reading an alias we never write to would be inconsistent.
      const existing = project.architect?.[targetName];

      if (existing && existing.builder !== TYPECHECK_EXECUTOR_ID) {
        throw new Error(
          `Project "${schema.project}" already has a "${targetName}" target ` +
            `using builder "${existing.builder}". Choose a different ` +
            `--targetName or remove the existing target.`,
        );
      }

      project.architect ??= {};
      // Idempotent re-run of OUR target: preserve user-added keys + extra options,
      // re-assert only the builder id + the resolved leaf ARRAY.
      project.architect[targetName] = {
        ...existing,
        builder: TYPECHECK_EXECUTOR_ID,
        options: { ...existing?.options, tsConfig },
      };

      return json;
    });

    if (!schema.skipFormat) {
      await formatFiles(tree);
    }

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
