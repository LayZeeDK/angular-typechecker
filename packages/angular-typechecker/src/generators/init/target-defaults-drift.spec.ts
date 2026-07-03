import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readNxJson } from '@nx/devkit';
import type { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

import initGenerator, { TYPECHECK_EXECUTOR_ID } from './generator';

// D-04 / WALK-02 drift guard (C11): the targetDefaults block the init generator
// SEEDS into a consumer workspace is ALSO hand-copied into the dev-repo `nx.json`
// under the canonical unscoped `angular-typechecker:typecheck` id, aligned only by
// a "keep in sync" comment -- two copies, no test. This guard seeds the block via
// the generator and asserts it deep-equals the committed nx.json copy, so a
// caching-input change to one that is not mirrored to the other (which would hand
// consumers stale caching config -- the exact stale-PASS the comment warns about)
// fails LOUDLY instead of drifting silently.

// This spec lives at packages/angular-typechecker/src/generators/init, so the
// workspace root is found by walking up to nx.json.
const testDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = findWorkspaceRoot(testDir);
const nxJsonPath = join(workspaceRoot, 'nx.json');

const UNSCOPED_ID = TYPECHECK_EXECUTOR_ID;

interface NxJsonShape {
  targetDefaults?: Record<string, unknown>;
}

describe('init targetDefaults drift guard (C11)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('seeds the SAME block the dev-repo nx.json carries under the canonical unscoped id', async () => {
    await initGenerator(tree, { skipFormat: true });

    const seeded = readNxJson(tree)?.targetDefaults?.[UNSCOPED_ID];

    expect(seeded).toBeDefined();

    const nxJson = JSON.parse(readFileSync(nxJsonPath, 'utf8')) as NxJsonShape;
    const unscoped = nxJson.targetDefaults?.[UNSCOPED_ID];

    // Both copies (generator-seeded + the committed nx.json id) identical.
    expect(unscoped).toEqual(seeded);
  });
});
