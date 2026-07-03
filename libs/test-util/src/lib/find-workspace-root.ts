import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Walk up from `startDir` to the nearest directory containing `nx.json` (the Nx
 * workspace root), and return its absolute path.
 *
 * Specs use this instead of a hand-counted `join(dir, '..', '..', ...)` chain so a
 * spec that moves to a different directory depth keeps resolving the workspace root
 * correctly -- the `..`-count approach silently pointed at the wrong directory on a
 * move, with no error (the class of bug this replaces).
 *
 * @throws if no `nx.json` exists at `startDir` or any ancestor.
 */
export function findWorkspaceRoot(startDir: string): string {
  let dir = startDir;

  while (!existsSync(join(dir, 'nx.json'))) {
    const parent = dirname(dir);

    if (parent === dir) {
      throw new Error(
        `workspace root (nx.json) not found at or above ${startDir}`,
      );
    }

    dir = parent;
  }

  return dir;
}
