import { formatFiles, readNxJson, updateNxJson } from '@nx/devkit';
import type {
  NxJsonConfiguration,
  TargetConfiguration,
  Tree,
} from '@nx/devkit';

import type { InitGeneratorSchema } from './schema';

// The UNSCOPED published executor id -- ALSO the key Nx uses for this executor's
// `targetDefaults` entry. Exported so the `configuration` generator wires the
// target with the SAME id (Landmine 3 / Pitfall 2: never the scoped
// `@angular-typechecker/...` dev-repo alias, which exists only because this repo
// aliases its own package).
export const TYPECHECK_EXECUTOR_ID = 'angular-typechecker:typecheck';

// D-04 / WALK-02: copied VERBATIM from the workspace `nx.json`
// targetDefaults[TYPECHECK_EXECUTOR_ID] block (the UNSCOPED published executor id,
// NOT the scoped `@angular-typechecker/...` dev-repo alias). Keep this block in
// sync with nx.json.
//
// LANDMINE: the first `inputs` entry MUST stay 'default', never 'production'.
// The coarse single walk target caches on ONE key, so the named input decides
// what busts it. The `production` named input EXCLUDES `*.spec.ts`, so with the
// walk now type-checking the spec leaf a spec-only edit under `production` would
// NOT bust the cache -> a stale PASS ("a type-checker that lies"). `default`
// (the lib+spec source union) is the correct coarse input.
const TYPECHECK_TARGET_DEFAULTS: TargetConfiguration = {
  cache: true,
  outputs: [],
  inputs: [
    'default',
    '{projectRoot}/tsconfig*.json',
    '{projectRoot}/package.json',
    '{workspaceRoot}/tsconfig.base.json',
    '^default',
    {
      dependentTasksOutputFiles: '**/*.{d.ts,d.cts,d.mts,tsbuildinfo}',
      transitive: true,
    },
    { externalDependencies: ['typescript', '@angular/compiler-cli'] },
  ],
};

/**
 * The standalone `init` generator (GEN-07). Idempotently seeds the workspace
 * `nx.json` `targetDefaults` so the `angular-typechecker:typecheck` target is
 * Nx-cacheable, keyed by the UNSCOPED published executor id.
 *
 * This is the unit `configuration` invokes (GEN-08) and that
 * `nx add angular-typechecker` runs on install (GEN-09). It is config-edit only
 * (no `generateFiles`, no file emission): it reads/writes `nx.json` via
 * `readNxJson`/`updateNxJson`.
 *
 * Idempotency + non-clobber (D-05): whole-entry `??=`. The coherent WALK-02
 * block is seeded ONLY when the unscoped key is absent; a pre-existing (possibly
 * user-customized) entry of ANY shape is left untouched, because a sub-key merge
 * could produce an incoherent block (the `default`-not-`production` inputs,
 * `outputs: []`, and `cache: true` are interdependent). The scoped
 * `@angular-typechecker/...` key is never written.
 */
export default async function initGenerator(
  tree: Tree,
  schema: InitGeneratorSchema,
): Promise<void> {
  // Pitfall 4: `readNxJson` is typed `NxJsonConfiguration | null` -- guard it.
  const nxJson: NxJsonConfiguration = readNxJson(tree) ?? {};

  nxJson.targetDefaults ??= {};
  nxJson.targetDefaults[TYPECHECK_EXECUTOR_ID] ??= TYPECHECK_TARGET_DEFAULTS;
  updateNxJson(tree, nxJson);

  if (!schema?.skipFormat) {
    await formatFiles(tree);
  }
}
