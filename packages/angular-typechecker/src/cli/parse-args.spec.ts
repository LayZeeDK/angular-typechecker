import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parseCliArgs } from './parse-args';
import type { ParseResult } from './parse-args';

// VER-01 / ARGS-01..04: pure unit coverage of the arg-parsing seam -- direct
// calls, NO vi.mock (parse-args needs no core stubs; it is a pure argv -> result
// transform). Mirrors the direct-call style of core/emit-advisory-notices.spec.ts.

// The version drift-lock reads the SAME manifest parse-args reads (two dirs above
// src/cli/), via the repo's established readFileSync idiom (package-manifest.spec.ts).
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifestVersion = (
  JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
    version: string;
  }
).version;

// Narrow a ParseResult to a specific discriminant with an assertion, returning
// the narrowed member so branch-specific fields (message/text/tsConfig) can be
// asserted with full types.
function expectKind<K extends ParseResult['kind']>(
  result: ParseResult,
  kind: K,
): Extract<ParseResult, { kind: K }> {
  expect(result.kind).toBe(kind);

  return result as Extract<ParseResult, { kind: K }>;
}

describe('parseCliArgs (ARGS-01..04 flag mapping + usage errors)', () => {
  describe('--tsConfig / -c mapping (ARGS-02/03)', () => {
    it('maps a single --tsConfig to a one-element tsConfig array', () => {
      const options = expectKind(
        parseCliArgs(['--tsConfig', 'libs/x/tsconfig.json']),
        'options',
      );

      expect(options.tsConfig).toEqual(['libs/x/tsconfig.json']);
    });

    it('maps a single -c to a one-element tsConfig array (ARGS-03 collapse to string happens in run(), not here)', () => {
      const options = expectKind(
        parseCliArgs(['-c', 'libs/x/tsconfig.json']),
        'options',
      );

      expect(options.tsConfig).toEqual(['libs/x/tsconfig.json']);
    });

    it('maps a repeatable -c to a multi-element tsConfig array in order (ARGS-02)', () => {
      const options = expectKind(
        parseCliArgs(['-c', 'a/tsconfig.json', '-c', 'b/tsconfig.json']),
        'options',
      );

      expect(options.tsConfig).toEqual(['a/tsconfig.json', 'b/tsconfig.json']);
    });

    it('defaults the boolean knobs to false and maps them when present (D-12)', () => {
      const defaults = expectKind(
        parseCliArgs(['-c', 'libs/x/tsconfig.json']),
        'options',
      );

      expect(defaults.failFast).toBe(false);
      expect(defaults.includeDeps).toBe(false);
      expect(defaults.strict).toBe(false);

      const set = expectKind(
        parseCliArgs([
          '-c',
          'libs/x/tsconfig.json',
          '--fail-fast',
          '--include-deps',
          '--strict',
        ]),
        'options',
      );

      expect(set.failFast).toBe(true);
      expect(set.includeDeps).toBe(true);
      expect(set.strict).toBe(true);
    });
  });

  describe('usage errors -> exit 2 in run() (ARGS-02/04)', () => {
    it('rejects -p as an unknown flag (ARGS-02: -p/--project is deliberately NOT registered)', () => {
      expectKind(parseCliArgs(['-p', 'libs/x/tsconfig.json']), 'usageError');
    });

    it('rejects --project as an unknown flag', () => {
      expectKind(
        parseCliArgs(['--project', 'libs/x/tsconfig.json']),
        'usageError',
      );
    });

    it('rejects an arbitrary unknown flag', () => {
      expectKind(
        parseCliArgs(['-c', 'libs/x/tsconfig.json', '--nonsense']),
        'usageError',
      );
    });

    it('rejects a missing required --tsConfig', () => {
      const usage = expectKind(parseCliArgs([]), 'usageError');

      expect(usage.message).toContain('--tsConfig');
    });

    it('rejects a missing -c value', () => {
      expectKind(parseCliArgs(['-c']), 'usageError');
    });
  });

  describe('--max-warnings validation (ARGS-04 / D-08)', () => {
    it('accepts --max-warnings 0 (fail on any warning)', () => {
      const options = expectKind(
        parseCliArgs(['-c', 'libs/x/tsconfig.json', '--max-warnings', '0']),
        'options',
      );

      expect(options.maxWarnings).toBe(0);
    });

    it('accepts a positive integer --max-warnings', () => {
      const options = expectKind(
        parseCliArgs(['-c', 'libs/x/tsconfig.json', '--max-warnings', '3']),
        'options',
      );

      expect(options.maxWarnings).toBe(3);
    });

    it('leaves maxWarnings undefined when the flag is absent', () => {
      const options = expectKind(
        parseCliArgs(['-c', 'libs/x/tsconfig.json']),
        'options',
      );

      expect(options.maxWarnings).toBeUndefined();
    });

    it('rejects a non-numeric --max-warnings', () => {
      const usage = expectKind(
        parseCliArgs(['-c', 'libs/x/tsconfig.json', '--max-warnings', 'x']),
        'usageError',
      );

      expect(usage.message).toContain('--max-warnings');
      expect(usage.message).toContain('"x"');
    });

    it('rejects a negative --max-warnings', () => {
      expectKind(
        parseCliArgs(['-c', 'libs/x/tsconfig.json', '--max-warnings', '-1']),
        'usageError',
      );
    });

    it('rejects a fractional --max-warnings', () => {
      expectKind(
        parseCliArgs(['-c', 'libs/x/tsconfig.json', '--max-warnings', '1.5']),
        'usageError',
      );
    });
  });

  describe('--help / -h (ARGS-04 / D-11)', () => {
    it('returns a help result whose text steers to npx angular-typechecker', () => {
      const help = expectKind(parseCliArgs(['--help']), 'help');

      expect(help.text).toContain('npx angular-typechecker');
      expect(help.text).not.toContain('npx atc');
    });

    it('treats -h the same as --help', () => {
      const help = expectKind(parseCliArgs(['-h']), 'help');

      expect(help.text).toContain('npx angular-typechecker');
      expect(help.text).not.toContain('npx atc');
    });

    it('states the 0/1/2 exit-code contract in the help text', () => {
      const help = expectKind(parseCliArgs(['--help']), 'help');

      expect(help.text).toContain('Exit codes: 0');
      expect(help.text).toContain('1');
      expect(help.text).toContain('2');
    });
  });

  describe('--version (ARGS-04 / D-10)', () => {
    it('returns a version result equal to the real package.json version (drift-lock)', () => {
      const version = expectKind(parseCliArgs(['--version']), 'version');

      expect(version.text).toBe(manifestVersion);
    });
  });
});
