import { dirname } from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveFilterBasePath } from './run-typecheck';

// WR-01 regression: the project-boundary filter keys off `basePath`. An empty
// base makes `isUnderDir` treat `'' + '/'` as `/`, matching EVERY absolute path
// on POSIX and silently DISABLING the filter. `resolveFilterBasePath` must never
// return '' for an absolute tsConfigPath -- it falls back to the leaf tsconfig's
// directory whenever the parsed `basePath` is missing.
describe('resolveFilterBasePath (WR-01)', () => {
  const tsConfigPath = '/abs/workspace/packages/app/tsconfig.app.json';
  const tsConfigDir = dirname(tsConfigPath);

  it('returns the parsed basePath unchanged when it is a non-empty absolute path', () => {
    const parsedBasePath = '/abs/workspace/packages/app';

    expect(resolveFilterBasePath(parsedBasePath, tsConfigPath)).toBe(
      parsedBasePath,
    );
  });

  it('falls back to dirname(tsConfigPath) when the parsed basePath is undefined', () => {
    expect(resolveFilterBasePath(undefined, tsConfigPath)).toBe(tsConfigDir);
  });

  it('falls back to dirname(tsConfigPath) when the parsed basePath is the empty-string sentinel (?? would not catch it)', () => {
    expect(resolveFilterBasePath('', tsConfigPath)).toBe(tsConfigDir);
  });

  it('never yields an empty base that would disable the boundary filter', () => {
    for (const parsedBasePath of [undefined, '']) {
      expect(resolveFilterBasePath(parsedBasePath, tsConfigPath)).not.toBe('');
    }
  });
});
