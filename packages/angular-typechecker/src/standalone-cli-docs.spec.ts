import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parseCliArgs } from './cli/parse-args';

// Docs tripwire for the README `## Standalone CLI` section and the repo-root
// CHANGELOG `## 0.2.2` entry. Two load-bearing claims are policed here:
//
//   1. Supply-chain guard: the canonical uninstalled invocation is
//      `npx angular-typechecker`, and the docs NEVER say `npx atc` (that would
//      fetch the unrelated published package `atc@0.0.6`). This mirrors the same
//      `not.toContain('npx atc')` guard in `src/cli/parse-args.spec.ts`.
//   2. Flag drift-lock: every long-form flag the shipped `--help` prints is
//      DERIVED from the live help text and must also appear in the README, so a
//      flag ADDED to `--help` forces a matching README update -- the additive
//      case a hardcoded list alone would miss (IN-01). A separate FLAG_TOKENS
//      list locks the current flags against removal/rename in `--help`. (A flag
//      added to the README ALONE, absent from `--help`, is NOT caught: the README
//      is too prose-heavy to derive flag tokens from without false positives.)
//
// It also asserts the `0`/`1`/`2` exit-code contract table and a hygiene guard on
// the public CHANGELOG entry (no internal ids/scopes leak into what becomes the
// GitHub Release notes). Like the sibling `angular-cli-docs.spec.ts`, this is a
// pure, deterministic filesystem read (no compiler load, no build artifact), so it
// runs in the fast `nx test` loop on every PR, even a docs-only one. Assertions
// normalize runtime whitespace (`\s+` -> single space) so they survive prose
// re-wrapping -- the CLAIM is locked, not its line breaks.

const here = dirname(fileURLToPath(import.meta.url));
const readme = readFileSync(join(here, '../README.md'), 'utf8');
const normalized = readme.replace(/\s+/g, ' ');

// The exported seam: `HELP_TEXT` is module-private, so read the live help text
// via `parseCliArgs(['--help'])`. Normalizing it the same way lets the aligned
// two-space flag column collapse to single spaces, so tokens compare contiguously.
const help = parseCliArgs(['--help']);
const helpText = help.kind === 'help' ? help.text.replace(/\s+/g, ' ') : '';

// Removal/rename drift-lock: these MUST stay present in BOTH the live `--help`
// and the README. A flag removed/renamed in HELP_TEXT fails the `helpText`
// assertion; a rename fails both.
const FLAG_TOKENS = [
  '-c, --tsConfig',
  '--max-warnings',
  '--fail-fast',
  '--include-deps',
  '--strict',
  '-h, --help',
  '--version',
];

// Addition drift-lock (IN-01): derive every long-form flag token the live
// `--help` actually prints. Deriving from the source of truth makes an ADDED
// flag self-enforcing -- it must also be documented in the README, a case the
// hardcoded FLAG_TOKENS above could not catch. Long-form only (short aliases
// like `-c`/`-h` are substrings of too many things to assert usefully).
const helpFlags = [...new Set(helpText.match(/--[a-zA-Z][\w-]*/g) ?? [])];

describe('README ## Standalone CLI section (docs tripwire)', () => {
  it('has a Standalone CLI section heading', () => {
    expect(readme).toContain('## Standalone CLI');
  });

  it('has the ToC anchor', () => {
    expect(readme).toContain('[Standalone CLI](#standalone-cli)');
  });

  it('documents npx angular-typechecker and NEVER npx atc', () => {
    expect(normalized).toContain('npx angular-typechecker');
    expect(normalized).not.toContain('npx atc');
  });

  it('names the atc@0.0.6 supply-chain hazard', () => {
    expect(normalized).toContain('atc@0.0.6');
  });

  it('locks the known flag tokens against removal/rename in BOTH the README and live --help', () => {
    for (const flag of FLAG_TOKENS) {
      expect(normalized).toContain(flag);
      expect(helpText).toContain(flag);
    }
  });

  it('documents in the README every long-form flag the live --help prints (additions self-enforce)', () => {
    expect(helpFlags.length).toBeGreaterThan(0);

    for (const flag of helpFlags) {
      expect(normalized).toContain(flag);
    }
  });

  it('states the 0/1/2 exit-code contract', () => {
    expect(normalized).toContain('infrastructure-or-usage');
    expect(normalized).toContain('verdict-fail');

    for (const code of ['`0`', '`1`', '`2`']) {
      expect(normalized).toContain(code);
    }
  });
});

const changelog = readFileSync(join(here, '../../../CHANGELOG.md'), 'utf8');

describe('CHANGELOG ## 0.2.2 entry (hygiene tripwire)', () => {
  it('has a 0.2.2 entry', () => {
    expect(changelog).toContain('## 0.2.2');
  });

  it('carries no internal ids/scopes (public release notes)', () => {
    const start = changelog.indexOf('## 0.2.2');
    const next = changelog.indexOf('## 0.2.1');
    const entry = changelog.slice(start, next);

    expect(next).toBeGreaterThan(start);
    // `phase[-\s]?\d` (id-shaped) catches leaked GSD phase ids like "phase 29"
    // / "phase-29" without false-positiving on the plain word "phase(s)", which
    // is legitimate user-facing vocabulary (the Angular compiler's diagnostic
    // "phases" are described in the README).
    expect(entry).not.toMatch(/DOC-01|CLI-0\d|SC#|phase[-\s]?\d/i);
  });
});
