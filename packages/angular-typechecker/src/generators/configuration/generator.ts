import { isAbsolute } from 'node:path';

import {
  formatFiles,
  joinPathFragments,
  readJson,
  readProjectConfiguration,
  runTasksInSerial,
  updateProjectConfiguration,
} from '@nx/devkit';
import type {
  GeneratorCallback,
  ProjectConfiguration,
  Tree,
} from '@nx/devkit';

import initGenerator from '../init/generator';
import type { ConfigurationGeneratorSchema } from './schema';

// The UNSCOPED published executor id (Phase 13.1). The generated target and the
// collision check both key off this id -- NOT the scoped `@angular-typechecker/...`
// dev-repo alias, which exists only because this repo aliases its own package
// (Landmine 3 / Pitfall 2).
const TYPECHECK_EXECUTOR = 'angular-typechecker:typecheck';

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
 *   4. else throw a clear, located error.
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

  // 1. explicit override wins (OQ-1: absolute verbatim, relative project-root-relative).
  if (schema.tsConfig) {
    return isAbsolute(schema.tsConfig)
      ? schema.tsConfig
      : joinPathFragments(root, schema.tsConfig);
  }

  // 2. solution tsconfig.json WITH a non-empty references[] -> point at it.
  const solution = joinPathFragments(root, 'tsconfig.json');

  if (tree.exists(solution)) {
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

  // 4. nothing resolved.
  throw new Error(
    `Could not resolve a tsconfig for project "${schema.project}": no ` +
      `"${solution}" with a non-empty references[] array and no "${leafPath}". ` +
      `Pass --tsConfig explicitly.`,
  );
}

/**
 * The `configuration` generator (GEN-01/02/03/04/08):
 * `nx g angular-typechecker:configuration <project>`.
 *
 * Config-edit only (no `generateFiles`, no file emission). It (1) awaits the
 * `init` generator FIRST with `skipFormat: true` so caching is seeded and we
 * format ONCE at the end (GEN-08 / D-10), (2) reads the project config, (3)
 * resolves the target's `tsConfig` (D-07), (4) collision-checks by EXECUTOR
 * (D-09), (5) writes ONE minimal `typecheck` target
 * `{ executor: 'angular-typechecker:typecheck', options: { tsConfig } }`, and
 * (6) formats once. A re-run for OUR target is idempotent (rewrite to the same
 * shape); a same-named NON-ours target throws a clear, located error.
 */
export default async function configurationGenerator(
  tree: Tree,
  schema: ConfigurationGeneratorSchema,
): Promise<GeneratorCallback> {
  const tasks: GeneratorCallback[] = [];

  // GEN-08 / D-10: seed workspace caching FIRST via init. `skipFormat: true` so
  // the nested init does not format -- we format ONCE at the end (first-party
  // `@nx/eslint:lint-project` / `@nx/vitest:configuration` composition).
  await initGenerator(tree, { skipFormat: true });

  const projectConfig = readProjectConfiguration(tree, schema.project);
  const targetName = schema.targetName ?? 'typecheck';
  const tsConfig = resolveTsConfig(tree, projectConfig, schema);

  // GEN-04 / D-09: collision by EXECUTOR (compare the UNSCOPED id). A same-named
  // target that is NOT ours is a genuine clash -> throw, do not clobber. A
  // same-named target that IS ours is rewritten to the same shape (idempotent).
  const existing = projectConfig.targets?.[targetName];

  if (existing && existing.executor !== TYPECHECK_EXECUTOR) {
    throw new Error(
      `Project "${schema.project}" already has a "${targetName}" target using ` +
        `executor "${existing.executor}". Choose a different --targetName or ` +
        `remove the existing target.`,
    );
  }

  projectConfig.targets ??= {};
  projectConfig.targets[targetName] = {
    executor: TYPECHECK_EXECUTOR,
    options: { tsConfig },
  };
  updateProjectConfiguration(tree, schema.project, projectConfig);

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}
