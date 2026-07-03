import { existsSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { findWorkspaceRoot } from './find-workspace-root';

describe('findWorkspaceRoot', () => {
  const here = dirname(fileURLToPath(import.meta.url));

  it('returns the ancestor directory that contains nx.json', () => {
    const root = findWorkspaceRoot(here);

    expect(existsSync(join(root, 'nx.json'))).toBe(true);
  });

  it('is depth-independent: nested and parent start dirs resolve to the same root', () => {
    const root = findWorkspaceRoot(here);

    // Starting one level up must yield the same root -- the walk keys off the
    // nx.json marker, not a hand-counted number of `..` segments.
    expect(findWorkspaceRoot(dirname(here))).toBe(root);
  });

  it('returns the directory itself when it already contains nx.json', () => {
    const root = findWorkspaceRoot(here);

    expect(findWorkspaceRoot(root)).toBe(root);
  });

  it('throws when no nx.json exists at or above the start dir', () => {
    // The filesystem root has no nx.json and no parent, so the walk exhausts.
    const filesystemRoot = parse(here).root;

    expect(() => findWorkspaceRoot(filesystemRoot)).toThrow(/nx\.json/);
  });
});
