import { describe, expect, it } from 'vitest';

import { relativizePath, stripBaseCaseInsensitive } from './diagnostic-record';

// Pure unit spec for the D-13 path projection (no compiler-cli, no fixtures). Locks
// the macOS case-only-mismatch fix: `relativizePath`'s fast path stays byte-identical
// (so the committed Windows/Linux JSON+SARIF snapshots never move), and the new
// `stripBaseCaseInsensitive` fallback -- exercised DIRECTLY so it is genuinely tested
// on this case-insensitive Windows dev machine, where a `relativizePath`-routed
// assertion would false-pass via `path.win32.relative`'s case-insensitive fast path.

describe('relativizePath', () => {
  it('recovers a repo-relative path from a case-only base/path mismatch (macOS fix, FAILS on Linux with the old code)', () => {
    // relative('/Repo/Root', '/repo/root/sub/file.ts') is case-SENSITIVE on POSIX, so
    // the old code escaped with '../../repo/root/sub/file.ts' on Linux; the fallback
    // recovers 'sub/file.ts'. On Windows this already passed via the fast path.
    expect(relativizePath('/repo/root/sub/file.ts', '/Repo/Root')).toBe(
      'sub/file.ts',
    );
  });

  it('returns the plain relative path (fast path, byte-identical) when the base case matches', () => {
    expect(relativizePath('/repo/root/sub/file.ts', '/repo/root')).toBe(
      'sub/file.ts',
    );
  });

  it('slash-normalizes only when pathBase is undefined', () => {
    expect(relativizePath('D:\\ws\\proj\\src\\a.ts', undefined)).toBe(
      'D:/ws/proj/src/a.ts',
    );
  });

  it('preserves a GENUINE escape when the path is really outside the base', () => {
    // '/repo/other/file.ts' is not under '/repo/root' at all -- the fallback returns
    // undefined and the real '..' escape is kept (the fix must not swallow it).
    expect(relativizePath('/repo/other/file.ts', '/repo/root')).toBe(
      '../other/file.ts',
    );
  });
});

describe('stripBaseCaseInsensitive', () => {
  it('preserves the REAL casing of the remainder below the base', () => {
    // Tested DIRECTLY (not through relativizePath): on this Windows machine
    // path.win32.relative is case-insensitive and takes the fast path, so a
    // relativizePath-routed assertion would pass even with the fallback broken.
    expect(
      stripBaseCaseInsensitive('/REPO/root/Sub/File.ts', '/repo/ROOT'),
    ).toBe('Sub/File.ts');
  });

  it('reproduces the macOS scenario deterministically (the committed snapshot value)', () => {
    expect(
      stripBaseCaseInsensitive(
        '/users/runner/work/angular-typechecker/angular-typechecker/fixtures/layout-b-dependency/thing.ts',
        '/Users/runner/work/angular-typechecker/angular-typechecker',
      ),
    ).toBe('fixtures/layout-b-dependency/thing.ts');
  });

  it('does NOT false-match a sibling that merely shares the base prefix', () => {
    expect(
      stripBaseCaseInsensitive('/repo/rootx/file.ts', '/repo/root'),
    ).toBeUndefined();
  });

  it('returns an empty remainder when the path equals the base', () => {
    expect(stripBaseCaseInsensitive('/repo/root', '/repo/root')).toBe('');
  });

  it('strips a trailing separator from the base before matching', () => {
    expect(
      stripBaseCaseInsensitive('/repo/root/sub/file.ts', '/repo/root/'),
    ).toBe('sub/file.ts');
  });

  it('returns undefined for a genuinely-outside path', () => {
    expect(
      stripBaseCaseInsensitive('/repo/other/file.ts', '/repo/root'),
    ).toBeUndefined();
  });
});
