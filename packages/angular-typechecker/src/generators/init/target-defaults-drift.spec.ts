import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readNxJson } from '@nx/devkit';
import type { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import initGenerator from './generator';

// D-04 / WALK-02 drift guard (C11): the targetDefaults block the init generator
// SEEDS into a consumer workspace is ALSO hand-copied into the dev-repo `nx.json`
// under BOTH the unscoped `angular-typechecker:typecheck` id and the scoped
// `@angular-typechecker/angular-typechecker:typecheck` alias, aligned only by a
// "keep in sync" comment -- three copies, no test. This guard seeds the block via
// the generator and asserts it deep-equals BOTH committed nx.json copies, so a
// caching-input change to one copy that is not mirrored to the others (which would
// hand consumers stale caching config -- the exact stale-PASS the comment warns
// about) fails LOUDLY instead of drifting silently.

// This spec lives at packages/angular-typechecker/src/generators/init, so the
// workspace root (where nx.json lives) is five directories up.
const testDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(testDir, '..', '..', '..', '..', '..');
const nxJsonPath = join(workspaceRoot, 'nx.json');

const UNSCOPED_ID = 'angular-typechecker:typecheck';
const SCOPED_ID = '@angular-typechecker/angular-typechecker:typecheck';

interface NxJsonShape {
  targetDefaults?: Record<string, unknown>;
}

describe('init targetDefaults drift guard (C11)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('seeds the SAME block the dev-repo nx.json carries under both the scoped and unscoped ids', async () => {
    await initGenerator(tree, { skipFormat: true });

    const seeded = readNxJson(tree)?.targetDefaults?.[UNSCOPED_ID];

    expect(seeded).toBeDefined();

    const nxJson = JSON.parse(readFileSync(nxJsonPath, 'utf8')) as NxJsonShape;
    const unscoped = nxJson.targetDefaults?.[UNSCOPED_ID];
    const scoped = nxJson.targetDefaults?.[SCOPED_ID];

    // All three copies (generator-seeded + both committed nx.json ids) identical.
    expect(unscoped).toEqual(seeded);
    expect(scoped).toEqual(seeded);
  });
});
