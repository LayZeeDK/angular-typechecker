import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { URL } from 'node:url';

import { expect } from 'vitest';

/**
 * Lever 1 (quick-260714-1gr): before starting the local registry with
 * clearStorage:false, delete ONLY the two things that MUST be fresh each run --
 * the published angular-typechecker package dir (so the freshly built dist
 * republishes with no EPUBLISHCONFLICT) and the .htpasswd (so the ci-user
 * sign-up + real-token mint still works; Verdaccio 6 401s an unverifiable
 * bearer, and a second sign-up over an existing .htpasswd 409s). Everything else
 * under storage -- the npmjs uplink proxy cache -- is PRESERVED across runs, which
 * is the whole point: re-run install network cost drops to ~0 once the uplink is
 * warm. `force: true` makes the first run (storage absent) a no-op that never
 * throws. This is the COMPLETE and ONLY storage reset once clearStorage:false
 * stops the @nx/js executor from wiping storage.
 */
export function resetVerdaccioPublishState(root: string): void {
  const storageDir = join(root, 'tmp', 'local-registry', 'storage');

  rmSync(join(storageDir, 'angular-typechecker'), {
    recursive: true,
    force: true,
  });
  rmSync(join(storageDir, '.htpasswd'), { force: true });
}

/**
 * Write a Verdaccio-targeting `.npmrc` into `dir`: a `registry=<url>` line plus the
 * nerf-dart `//<host>/:_authToken="<token>"` auth line for that registry's host.
 * This is the exact shape the npm/pnpm `nx add` + `verdaccio-publish` specs use to
 * point a fresh consumer at the local Verdaccio registry.
 */
export function writeVerdaccioNpmrc(
  dir: string,
  registryUrl: string,
  token: string,
): void {
  const host = new URL(registryUrl).host;

  writeFileSync(
    join(dir, '.npmrc'),
    `registry=${registryUrl}\n//${host}/:_authToken="${token}"\n`,
  );
}

/**
 * The shape of the `angular-typechecker:typecheck` `nx.json` targetDefaults entry
 * the specs assert against. Exported so a spec can annotate the reader's result.
 */
export interface TypecheckTargetDefault {
  cache?: boolean;
  outputs?: unknown[];
  inputs?: unknown[];
}

/**
 * ASSERTION-FREE reader of the `angular-typechecker:typecheck` entry in a
 * workspace's `nx.json` `targetDefaults`: reads `<tmpDir>/nx.json` and returns the
 * entry, or `undefined` when the key is absent. Specs keep their own `expect()`
 * calls -- this only removes the duplicated `JSON.parse(readFileSync(...))`
 * plumbing shared by the seeded-from-absent BEFORE baseline and the AFTER read.
 */
export function readTypecheckTargetDefault(
  tmpDir: string,
): TypecheckTargetDefault | undefined {
  const nxJson = JSON.parse(readFileSync(join(tmpDir, 'nx.json'), 'utf8')) as {
    targetDefaults?: Record<string, TypecheckTargetDefault>;
  };

  return nxJson.targetDefaults?.['angular-typechecker:typecheck'];
}

/**
 * Assert the `init`-seeded `angular-typechecker:typecheck` targetDefaults entry in
 * `<tmpDir>/nx.json` has the WALK-02 shape: `cache: true`, empty `outputs`, and --
 * the load-bearing invariant -- `'default'` as its FIRST input. The `'default'`-first
 * input is what keeps `*.spec.ts` in the hash; a `'production'`-first input would
 * exclude the spec files and under-hash the walked spec leaf (a stale PASS). Lives
 * here ONCE so the nx-add + generator install-e2e specs share a single seeded-shape
 * assertion instead of a byte-identical copy each.
 */
export function expectSeededTypecheckTargetDefault(tmpDir: string): void {
  const seeded = readTypecheckTargetDefault(tmpDir);

  expect(seeded).toBeDefined();
  expect(seeded?.cache).toBe(true);
  expect(seeded?.outputs).toEqual([]);
  expect(seeded?.inputs?.[0]).toBe('default');
}
