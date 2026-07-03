import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// WALK-02 / L-5 / Spike 005 (manifest contract): pin the shape of the
// `typecheck` walk-target defaults in the workspace `nx.json`. The
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
// The executor has ONE canonical target-default key -- the UNSCOPED published
// executor id `angular-typechecker:typecheck` -- both in this dev workspace and
// in an installed consumer. It MUST carry the WALK-02 shape so the caching
// contract holds. A scoped dev-repo form is never a real executor id; the
// repo-wide guard (scoped-name-guard.spec.ts) keeps that form from creeping back.

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

const KEY = 'angular-typechecker:typecheck';

const TSCONFIG_GLOB = '{projectRoot}/tsconfig*.json';

function inputsOf(): unknown[] {
  const targetDefault = nxJson.targetDefaults?.[KEY];

  if (targetDefault === undefined) {
    throw new Error(`nx.json targetDefaults is missing the key: ${KEY}`);
  }

  const { inputs } = targetDefault;

  if (inputs === undefined) {
    throw new Error(`nx.json targetDefaults[${KEY}] has no inputs array`);
  }

  return inputs;
}

describe('nx.json typecheck walk-target defaults (WALK-02 / L-5)', () => {
  it('uses the "default" named input and NOT "production"', () => {
    const inputs = inputsOf();

    expect(inputs).toContain('default');
    expect(inputs).not.toContain('production');
  });

  it('retains the "{projectRoot}/tsconfig*.json" glob and "^default"', () => {
    const inputs = inputsOf();

    expect(inputs).toContain(TSCONFIG_GLOB);
    expect(inputs).toContain('^default');
  });

  it('declares outputs as an empty array -- the walk emits nothing', () => {
    const targetDefault = nxJson.targetDefaults?.[KEY];

    expect(targetDefault?.outputs).toEqual([]);
  });
});
