import { readNxJson, updateNxJson } from '@nx/devkit';
import type { NxJsonConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import initGenerator, { TYPECHECK_EXECUTOR_ID } from './generator';

// The UNSCOPED published executor id `init` seeds (D-04). The generator must add
// ONLY this key -- never a scoped dev-repo alias. Import the id from the generator
// so a future rename updates one source, not three spec copies.
const UNSCOPED_KEY = TYPECHECK_EXECUTOR_ID;

describe('init generator (GEN-07)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('seeds the WALK-02 cacheable block under the unscoped id with default-not-production', async () => {
    await initGenerator(tree, {});

    const targetDefault = readNxJson(tree)?.targetDefaults?.[UNSCOPED_KEY];

    expect(targetDefault?.cache).toBe(true);
    expect(targetDefault?.outputs).toEqual([]);
    expect(targetDefault?.inputs?.[0]).toBe('default');
    expect(targetDefault?.inputs).not.toContain('production');
  });

  it('is idempotent (a second run leaves the seeded block byte-identical)', async () => {
    await initGenerator(tree, {});
    const first = JSON.stringify(
      readNxJson(tree)?.targetDefaults?.[UNSCOPED_KEY],
    );

    await initGenerator(tree, {});
    const second = JSON.stringify(
      readNxJson(tree)?.targetDefaults?.[UNSCOPED_KEY],
    );

    expect(second).toBe(first);
  });

  it("does not clobber a user-customized entry (whole-entry ??= don't-clobber, D-05)", async () => {
    const nxJson: NxJsonConfiguration = readNxJson(tree) ?? {};
    nxJson.targetDefaults ??= {};
    nxJson.targetDefaults[UNSCOPED_KEY] = { cache: false };
    updateNxJson(tree, nxJson);

    await initGenerator(tree, {});

    expect(readNxJson(tree)?.targetDefaults?.[UNSCOPED_KEY]).toEqual({
      cache: false,
    });
  });

  it('seeds ONLY the unscoped id, adding no scoped alias key (D-04)', async () => {
    const before = Object.keys(readNxJson(tree)?.targetDefaults ?? {});

    await initGenerator(tree, {});

    const after = Object.keys(readNxJson(tree)?.targetDefaults ?? {});
    const added = after.filter((key) => !before.includes(key));

    expect(added).toEqual([UNSCOPED_KEY]);
  });
});
