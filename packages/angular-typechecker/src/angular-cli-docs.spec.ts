import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// Docs tripwire for the README `## Angular CLI` section. That section is the only
// place the Angular CLI consumer flow is documented, so if a load-bearing claim is
// deleted, softened, or over-claimed the reader is misled about what is supported.
// This is a false-assurance guard: the strings below appear ONLY in the
// `## Angular CLI` section, so removing or gutting it fails CI here. It is a pure,
// deterministic filesystem read (no compiler load, no build artifact) so it runs in
// the fast `nx test` loop on every PR, even a docs-only one.
//
// Assertions normalize runtime whitespace (`\s+` -> single space) so they survive
// prose re-wrapping -- the CLAIM is locked, not its line breaks. The Storybook
// caveat is policed by `storybook-docs.spec.ts`; this file does not duplicate it.

const readmePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../README.md',
);
const readme = readFileSync(readmePath, 'utf8');
const normalized = readme.replace(/\s+/g, ' ');

describe('README ## Angular CLI section (docs tripwire)', () => {
  it('has an Angular CLI section heading', () => {
    expect(readme).toContain('## Angular CLI');
  });

  it('documents the three consumer commands', () => {
    expect(normalized).toContain('ng add angular-typechecker');
    expect(normalized).toContain(
      'ng generate angular-typechecker:configuration',
    );
    expect(normalized).toContain('ng run <project>:typecheck');
  });

  it('states the ng add auto-wire-all claim (every app + library)', () => {
    expect(normalized).toContain(
      'wires a `typecheck` target into every `application` and `library` project',
    );
  });

  it('states that ng run parity matches the Nx executor verdict', () => {
    expect(normalized).toContain(
      'runs the exact same complete Angular type-check as the Nx executor',
    );
    expect(normalized).toContain('its pass/fail exit verdict is identical');
  });

  it('documents the per-project tsConfig array target shape', () => {
    expect(normalized).toContain('"builder": "angular-typechecker:typecheck"');
    expect(normalized).toContain('["tsconfig.app.json", "tsconfig.spec.json"]');
  });

  it('carries the no-target-caching notice', () => {
    expect(normalized).toContain(
      'The Angular CLI `typecheck` target does not cache its result',
    );
  });

  it('carries the nx-transitive and .nx/ note', () => {
    expect(normalized).toContain('pulls in `nx` as a transitive dependency');
    expect(normalized).toContain('a `.nx/` directory may appear');
  });

  it('carries the off-stack --legacy-peer-deps note for Angular < 22', () => {
    expect(normalized).toContain(
      'an Angular workspace older than 22 cannot satisfy them',
    );
    expect(normalized).toContain('--legacy-peer-deps');
  });

  it('does not contradict the Storybook "not supported" caveat', () => {
    // The general Angular CLI typecheck support and the Storybook-on-Angular-CLI
    // "not supported" caveat must stay coherent: the section defers the Storybook
    // case rather than claiming it works.
    expect(normalized).toContain(
      'A Storybook wired through the Angular CLI is a separate, unsupported case',
    );
  });
});
