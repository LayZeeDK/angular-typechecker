import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { removeTmpDir } from './e2e-process';
import { resetVerdaccioPublishState } from './e2e-fixture';

describe('resetVerdaccioPublishState', () => {
  const createdRoots: string[] = [];

  function makeRoot(): string {
    const root = mkdtempSync(join(tmpdir(), 'atc-reset-verdaccio-'));

    createdRoots.push(root);

    return root;
  }

  function storagePath(root: string): string {
    return join(root, 'tmp', 'local-registry', 'storage');
  }

  afterEach(() => {
    for (const root of createdRoots) {
      removeTmpDir(root);
    }

    createdRoots.length = 0;
  });

  it('deletes ONLY the angular-typechecker package dir and .htpasswd, preserving every sibling', () => {
    const root = makeRoot();
    const storageDir = storagePath(root);

    // The two run-scoped essentials the helper must remove.
    mkdirSync(join(storageDir, 'angular-typechecker'), { recursive: true });
    writeFileSync(
      join(storageDir, 'angular-typechecker', 'index.json'),
      '{}',
    );
    writeFileSync(join(storageDir, '.htpasswd'), 'ci:hashed\n');

    // The siblings the helper must PRESERVE: the persisted npmjs proxy cache
    // (any other package dir) and the JWT-secret / package registry db.
    mkdirSync(join(storageDir, 'other-pkg'), { recursive: true });
    writeFileSync(join(storageDir, 'other-pkg', 'index.json'), '{}');
    writeFileSync(join(storageDir, '.verdaccio-db.json'), '{}');

    resetVerdaccioPublishState(root);

    // Removed.
    expect(existsSync(join(storageDir, 'angular-typechecker'))).toBe(false);
    expect(existsSync(join(storageDir, '.htpasswd'))).toBe(false);

    // Preserved.
    expect(existsSync(join(storageDir, '.verdaccio-db.json'))).toBe(true);
    expect(existsSync(join(storageDir, 'other-pkg'))).toBe(true);
    expect(existsSync(join(storageDir, 'other-pkg', 'index.json'))).toBe(true);
  });

  it('is a no-op that does not throw when the storage dir does not yet exist (first run)', () => {
    const root = makeRoot();

    // No tmp/local-registry/storage created -- the very first run.
    expect(() => resetVerdaccioPublishState(root)).not.toThrow();
  });
});
