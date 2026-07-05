import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { URL } from 'node:url';

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
