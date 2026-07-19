import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parseCliArgs } from './cli/parse-args';

// Docs tripwire for the README `## Machine-readable output` section and the
// repo-root CHANGELOG `## 0.2.3` entry (DOC-01). Like the sibling
// `standalone-cli-docs.spec.ts`, it is a pure, deterministic filesystem read (no
// compiler load, no build artifact), so it runs in the fast `nx test` loop on
// every PR, even a docs-only one. Assertions normalize runtime whitespace
// (`\s+` -> single space) so they survive prose re-wrapping -- the CLAIM is
// locked, not its line breaks.
//
// Three groups of claims are policed:
//   1. Presence: the `## Machine-readable output` section + its ToC anchor, the
//      `--format` values, the SARIF `upload-sarif` recipe, and the run-from-the-
//      repository-root / `artifactLocation.uri` caveat are all documented.
//   2. Absence (BLOCKER-1 drift-lock): the reporter claims reconciled when JSON
//      (Phase 30) and SARIF (Phase 31) shipped stay removed -- no `non-goal`
//      claim and no `lands in a later release` clause may reappear in the README.
//   3. Flag drift-lock: `--format` is present in BOTH the live
//      `parseCliArgs(['--help'])` output and the README, so a rename in one
//      without the other fails.
// Plus a hygiene guard on the public CHANGELOG `0.2.3` entry, so no internal ids
// or board jargon leak into what becomes the GitHub Release notes.

const here = dirname(fileURLToPath(import.meta.url));
const readme = readFileSync(join(here, '../README.md'), 'utf8');
const normalized = readme.replace(/\s+/g, ' ');

// The exported seam: `HELP_TEXT` is module-private, so read the live help text
// via `parseCliArgs(['--help'])` and normalize it the same way.
const help = parseCliArgs(['--help']);
const helpText = help.kind === 'help' ? help.text.replace(/\s+/g, ' ') : '';

// Addition drift-lock idiom (mirrors standalone-cli-docs.spec.ts): derive every
// long-form flag the live `--help` prints. `--format` MUST be one of them AND
// must also appear in the README, so a rename/removal on either side fails.
const helpFlags = [...new Set(helpText.match(/--[a-zA-Z][\w-]*/g) ?? [])];

describe('README ## Machine-readable output section (docs tripwire)', () => {
  it('has the Machine-readable output section heading', () => {
    expect(readme).toContain('## Machine-readable output');
  });

  it('has the ToC anchor', () => {
    expect(readme).toContain(
      '[Machine-readable output](#machine-readable-output)',
    );
  });

  it('documents --format and each of the three format values', () => {
    expect(normalized).toContain('--format');

    for (const value of ['human', 'json', 'sarif']) {
      expect(normalized).toContain(value);
    }
  });

  it('documents the SARIF upload-sarif recipe', () => {
    expect(normalized).toContain('upload-sarif');
  });

  it('documents the run-from-repository-root artifactLocation.uri caveat', () => {
    expect(normalized).toContain('artifactLocation.uri');
    expect(normalized).toContain('repository root');
  });

  it('drift-locks --format against the live --help (present in BOTH help and README)', () => {
    expect(helpFlags).toContain('--format');
    expect(normalized).toContain('--format');
  });

  it('keeps the reconciled stale reporter claims removed (BLOCKER-1)', () => {
    expect(normalized).not.toMatch(/non-goal/i);
    expect(normalized).not.toContain('lands in a later release');
  });
});

const changelog = readFileSync(join(here, '../../../CHANGELOG.md'), 'utf8');

describe('CHANGELOG ## 0.2.3 entry (hygiene tripwire)', () => {
  it('has a 0.2.3 entry', () => {
    expect(changelog).toContain('## 0.2.3');
  });

  it('carries no internal ids / scopes / board jargon (public release notes)', () => {
    const start = changelog.indexOf('## 0.2.3');
    const next = changelog.indexOf('## 0.2.2');
    const entry = changelog.slice(start, next);

    expect(next).toBeGreaterThan(start);
    // Reuses the shipped standalone-cli-docs.spec.ts guard (leaked GSD ids like
    // "DOC-01" / "CLI-03" / "phase 30"), extended for this milestone's board
    // jargon (the requirement-id families plus "Layout B" / "input-set" /
    // "SB-0x" / "G-gate") per the changelog-readme-end-user-facing rule.
    // `phase[-\s]?\d` catches an id-shaped "phase 30" without flagging the plain
    // word "phase", which is legitimate user-facing vocabulary.
    expect(entry).not.toMatch(
      /DOC-01|CLI-0\d|SC#|phase[-\s]?\d|Layout [A-C]\b|input-set|SB-\d|G-gate|REP-\d|FMT-\d|VER-\d|ADD-\d|OBS-\d|CLIX-\d/i,
    );
  });
});
