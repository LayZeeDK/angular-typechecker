import { isAbsolute, posix } from 'node:path';

// The framework-agnostic wiring core (24-06). The SINGLE source of truth for
// leaf-array resolution, the targetName default+empty-guard, collision-by-builder,
// and the [build, spec] idempotent merge. BOTH the vanilla `@angular-devkit/schematics`
// ng-add schematic AND the Nx `configuration` generator import it, so neither is a
// blind duplicate.
//
// It lives under src/core/**, so the D-11 eslint block bans @nx/devkit, @nx/*,
// @angular-devkit/*, nx, and yargs imports here (no console, no process.exit) -- that
// lint boundary is what keeps this core framework-agnostic. Path work uses ONLY
// node:path (isAbsolute, posix): posix.join is a pure replacement for devkit
// joinPathFragments (both forward-slash-normalize), and posix.join('', 'x') === 'x'
// covers the root-app `root: ''` case.

// The UNSCOPED published executor id / builder id (MOVED from init/generator.ts;
// re-exported there so existing importers resolve it unchanged).
export const TYPECHECK_EXECUTOR_ID = 'angular-typechecker:typecheck';

// The single shared "no target caching on Angular CLI" notice (MOVED from
// init/generator.ts). End-user-facing -- no internal plan/decision ids.
export const NO_CACHING_NOTICE =
  'angular-typechecker: Angular CLI has no build/target-result cache to seed, so ' +
  'the typecheck target(s) were wired without caching. On an Nx workspace, target ' +
  'caching is configured automatically.';

// End-user guidance for the RF-02 non-Angular-CLI edge.
export const NO_ANGULAR_JSON_NOTICE =
  'angular-typechecker: no angular.json found, so no typecheck targets were ' +
  'wired. angular-typechecker was ensured as a devDependency. Run `ng add ' +
  'angular-typechecker` from an Angular CLI workspace to auto-wire targets, or ' +
  'wire a single project with `nx g angular-typechecker:configuration <project>`.';

/**
 * Minimal shape of an Angular CLI `angular.json` workspace. A raw on-disk
 * `angular.json` uses the `architect` target map (the Nx `targets` alias only
 * appears in the config `readProjectConfiguration` RETURNS, never on disk), so the
 * collision read and the write both operate on `architect`. The `[key: string]:
 * unknown` index signatures preserve every unmodeled top-level/project/target key
 * across a parse-mutate-stringify round-trip (T-24-06-01).
 */
export interface AngularJsonTarget {
  builder?: string;
  options?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AngularJsonProject {
  projectType?: 'application' | 'library';
  root?: string;
  architect?: Record<string, AngularJsonTarget>;
  [key: string]: unknown;
}

export interface AngularJsonWorkspace {
  projects: Record<string, AngularJsonProject>;
  [key: string]: unknown;
}

/**
 * GEN-04: the targetName default + empty/whitespace guard. `??` only substitutes
 * the default for a MISSING targetName, not an explicit empty string
 * (`'' ?? x === ''`); an empty / whitespace-only name would write an unrunnable
 * target keyed by `''`, so reject it with a located error.
 */
export function resolveTargetName(
  targetName: string | undefined,
  project: string,
): string {
  const resolved = targetName ?? 'typecheck';

  if (resolved.trim() === '') {
    throw new Error(
      `--targetName for project "${project}" must be a non-empty target ` +
        `name. Omit it to use the default "typecheck".`,
    );
  }

  return resolved;
}

/**
 * OQ-1: resolves an explicit `--tsConfig` override. An ABSOLUTE path passes through
 * verbatim (it cannot be existence-probed against the workspace-relative tree); a
 * relative one is interpreted project-root-relative and existence-probed so a typo
 * fails HERE with a clear located error rather than silently writing a broken
 * target that only fails at execute time. Existence is checked via the injected
 * `exists` callback so the core stays Tree-agnostic.
 */
export function resolveTsConfigOverride(
  root: string,
  tsConfig: string,
  project: string,
  exists: (path: string) => boolean,
): string {
  if (isAbsolute(tsConfig)) {
    return tsConfig;
  }

  const overridePath = posix.join(root, tsConfig);

  if (!exists(overridePath)) {
    throw new Error(
      `--tsConfig "${tsConfig}" for project "${project}" resolves to ` +
        `"${overridePath}", which does not exist. Pass a path relative to the ` +
        `project root (or an absolute path).`,
    );
  }

  return overridePath;
}

/**
 * RF-01 (Approach A): resolves a project's leaf tsconfig ARRAY. An explicit
 * `--tsConfig` override short-circuits to a SINGLE-element array (`[resolved]`) via
 * `resolveTsConfigOverride`. Otherwise it takes the projectType-convention build
 * leaf (`application` -> `tsconfig.app.json`, else `tsconfig.lib.json`) plus
 * `tsconfig.spec.json`, each `posix.join(root, leaf)` then existence-probed. A
 * missing leaf is dropped; a project with a single leaf emits just that one; an
 * empty result throws the located error (never a silent under-checking target,
 * T-24-06-02).
 */
export function resolveTsConfigLeaves(
  root: string,
  projectType: 'application' | 'library' | undefined,
  tsConfigOverride: string | undefined,
  project: string,
  exists: (path: string) => boolean,
): string[] {
  if (tsConfigOverride) {
    return [resolveTsConfigOverride(root, tsConfigOverride, project, exists)];
  }

  const buildLeaf =
    projectType === 'application'
      ? posix.join(root, 'tsconfig.app.json')
      : posix.join(root, 'tsconfig.lib.json');
  const specLeaf = posix.join(root, 'tsconfig.spec.json');

  const leaves = [buildLeaf, specLeaf].filter((leaf) => exists(leaf));

  if (leaves.length === 0) {
    throw new Error(
      `Could not resolve a tsconfig for project "${project}": no ` +
        `"${buildLeaf}" and no "${specLeaf}". Pass --tsConfig explicitly.`,
    );
  }

  return leaves;
}

/**
 * D-05: MUTATES `workspace.projects[project].architect[targetName]`. Collision is by
 * BUILDER id (the SAME string as the executor id): a same-named target that is NOT
 * ours is a genuine clash -> throw, do not clobber. On an idempotent re-run of OUR
 * target, preserve user-added keys (e.g. a `configurations` block) + extra options
 * (e.g. `maxWarnings`) and re-assert only the builder id + the resolved leaf array.
 */
export function wireTypecheckTarget(
  workspace: AngularJsonWorkspace,
  project: string,
  targetName: string,
  tsConfig: string[],
): void {
  const projectConfig = workspace.projects[project];
  const existing = projectConfig.architect?.[targetName];

  if (existing && existing.builder !== TYPECHECK_EXECUTOR_ID) {
    throw new Error(
      `Project "${project}" already has a "${targetName}" target using ` +
        `builder "${existing.builder}". Choose a different --targetName or ` +
        `remove the existing target.`,
    );
  }

  projectConfig.architect ??= {};
  projectConfig.architect[targetName] = {
    ...existing,
    builder: TYPECHECK_EXECUTOR_ID,
    options: { ...existing?.options, tsConfig },
  };
}
