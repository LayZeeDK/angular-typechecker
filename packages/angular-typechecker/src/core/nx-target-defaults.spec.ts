import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// WALK-02 / L-5 / Spike 005 (manifest contract): pin the shape of the
// `angular-typecheck` walk-target defaults in the workspace `nx.json`. The
// coarse single walk target caches on ONE key, so the NAMED input decides what
// busts it. `production` EXCLUDES `*.spec.ts` (see the `production` namedInput's
// `!...spec|test...` + `!tsconfig.spec.json` negations), so with the walk now
// type-checking the spec leaf a spec-only edit under `production` would NOT bust
// the cache -> a stale PASS ("a type-checker that lies"). `default` (the lib+spec
// source union) is the correct coarse input: a spec-only source edit changes the
// input hash and re-executes.
//
// This is a pure, deterministic filesystem read (no compiler-cli load, no build
// artifact) -- it runs in the fast `nx test` loop with no `nx build`
// prerequisite, mirroring `package-manifest.spec.ts`.
//
// The executor is registered under TWO target-default keys -- the dev-workspace
// executor id (`angular-typechecker:angular-typecheck`) and the published-package
// executor id (`@angular-typechecker/angular-typechecker:angular-typecheck`) --
// which are the same executor's defaults for the local repo vs an installed
// consumer. Both MUST carry the WALK-02 shape so the caching contract holds in
// both contexts, so the assertions run against each.

// packages/angular-typechecker/src/core/<file> -> workspace root is 4 dirs up.
const workspaceRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
);
const nxJsonPath = join(workspaceRoot, 'nx.json');

interface NxTargetDefault {
  cache?: boolean;
  outputs?: unknown;
  inputs?: unknown[];
}

interface NxJson {
  targetDefaults?: Record<string, NxTargetDefault>;
}

const nxJson = JSON.parse(readFileSync(nxJsonPath, 'utf8')) as NxJson;

const WALK_TARGET_DEFAULT_KEYS = [
  'angular-typechecker:angular-typecheck',
  '@angular-typechecker/angular-typechecker:angular-typecheck',
] as const;

const TSCONFIG_GLOB = '{projectRoot}/tsconfig*.json';

function inputsOf(key: string): unknown[] {
  const targetDefault = nxJson.targetDefaults?.[key];

  if (targetDefault === undefined) {
    throw new Error(`nx.json targetDefaults is missing the key: ${key}`);
  }

  const { inputs } = targetDefault;

  if (inputs === undefined) {
    throw new Error(`nx.json targetDefaults[${key}] has no inputs array`);
  }

  return inputs;
}

describe('nx.json angular-typecheck walk-target defaults (WALK-02 / L-5)', () => {
  it.each(WALK_TARGET_DEFAULT_KEYS)(
    'uses the "default" named input and NOT "production" (%s)',
    (key) => {
      const inputs = inputsOf(key);

      expect(inputs).toContain('default');
      expect(inputs).not.toContain('production');
    },
  );

  it.each(WALK_TARGET_DEFAULT_KEYS)(
    'retains the "{projectRoot}/tsconfig*.json" glob and "^default" (%s)',
    (key) => {
      const inputs = inputsOf(key);

      expect(inputs).toContain(TSCONFIG_GLOB);
      expect(inputs).toContain('^default');
    },
  );

  it.each(WALK_TARGET_DEFAULT_KEYS)(
    'declares outputs as an empty array -- the walk emits nothing (%s)',
    (key) => {
      const targetDefault = nxJson.targetDefaults?.[key];

      expect(targetDefault?.outputs).toEqual([]);
    },
  );
});
