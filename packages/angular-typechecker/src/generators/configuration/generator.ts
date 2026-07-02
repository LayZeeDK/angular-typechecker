import { isAbsolute } from 'node:path';

import {
  formatFiles,
  joinPathFragments,
  readJson,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';
import type { ProjectConfiguration, Tree } from '@nx/devkit';

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

  // 1. explicit override wins (OQ-1: absolute verbatim, relative project-root-relative).
  // A relative override is existence-probed against the tree so a typo fails HERE
  // with a clear located error (matching branches 3/4) rather than silently writing
  // a broken target that only fails at execute time. An ABSOLUTE override cannot be
  // probed against the workspace-relative tree, so it is honored verbatim (OQ-1).
  if (schema.tsConfig) {
    if (isAbsolute(schema.tsConfig)) {
      return schema.tsConfig;
    }

    const overridePath = joinPathFragments(root, schema.tsConfig);

    if (!tree.exists(overridePath)) {
      throw new Error(
        `--tsConfig "${schema.tsConfig}" for project "${schema.project}" ` +
          `resolves to "${overridePath}", which does not exist. Pass a path ` +
          `relative to the project root (or an absolute path).`,
      );
    }

    return overridePath;
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
): Promise<void> {
  // GEN-08 / D-10: seed workspace caching FIRST via init. `skipFormat: true` so
  // the nested init does not format -- we format ONCE at the end (first-party
  // `@nx/eslint:lint-project` / `@nx/vitest:configuration` composition).
  await initGenerator(tree, { skipFormat: true });

  const projectConfig = readProjectConfiguration(tree, schema.project);
  const targetName = schema.targetName ?? 'typecheck';

  // GEN-04: `??` above only substitutes the default for a MISSING targetName, not
  // an explicit empty string (`'' ?? x === ''`). An empty / whitespace-only name
  // would write an unrunnable target keyed by `''`, so reject it with a located
  // error rather than silently producing a broken target.
  if (targetName.trim() === '') {
    throw new Error(
      `--targetName for project "${schema.project}" must be a non-empty target ` +
        `name. Omit it to use the default "typecheck".`,
    );
  }

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
