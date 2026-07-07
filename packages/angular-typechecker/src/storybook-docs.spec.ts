import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// SB-08 (D-10) docs tripwire: the README `## Storybook` section carries a
// Composition coverage claim in the MUST/MUST-NOT form, a flat-config guard note,
// and an Angular-CLI "not supported" caveat. This is a false-assurance guard
// (threat T-19-05): if the MUST-NOT caveat or the Composition claim is deleted or
// softened into an over-claim, CI fails here. It is a pure, deterministic
// filesystem read (no compiler load, no build artifact) so it runs in the fast
// `nx test` loop.
//
// Assertions normalize runtime whitespace (`\s+` -> single space) so they survive
// prose re-wrapping -- the CLAIM is locked, not its line breaks.

const readmePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../README.md',
);
const readme = readFileSync(readmePath, 'utf8');
const normalized = readme.replace(/\s+/g, ' ');

describe('README ## Storybook Composition coverage claim (D-10 tripwire)', () => {
  it('has a Storybook Composition subsection', () => {
    expect(readme).toContain('### Storybook Composition');
  });

  it('names the Nx graph fan-out mechanism (implicitDependencies, run-many, affected)', () => {
    expect(normalized).toContain('implicitDependencies');
    expect(normalized).toContain('run-many');
    expect(normalized).toContain('affected');
  });

  it('documents the dependsOn:["^typecheck"] recipe (matches the 19-02 fixture)', () => {
    expect(readme).toContain('dependsOn: ["^typecheck"]');
    expect(readme).toContain('^typecheck');
  });

  it("states the MUST claim: each composed project's own TypeScript is checked", () => {
    expect(normalized).toContain("checks each project's own TypeScript");
  });

  it('states the MUST-NOT: it does not verify composed refs resolve/deploy (runtime URLs)', () => {
    expect(normalized).toContain('does not verify that the composed');
    expect(normalized).toContain('runtime URLs');
  });

  it("does NOT over-claim that Storybook's own refs type catches a bad entry", () => {
    // 19-02 proved StorybookConfig['refs'] is `any`; the doc must credit the
    // consumer-declared ref shape, not Storybook's type, for a caught mistake.
    expect(normalized).toContain(
      'caught only if you annotate it with your own type',
    );
  });

  it('carries a flat-config note: not officially supported, but guarded (no silent clean pass)', () => {
    expect(normalized).toContain(
      "isn't an officially supported Storybook setup",
    );
    expect(normalized).toContain(
      'a config that declares no files fails the run',
    );
  });

  it('words the Angular CLI Storybook shape as not supported', () => {
    expect(normalized).toContain('Angular CLI Storybook setup');
    expect(normalized).toContain('is not supported');
  });
});
