import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// SB-08 (D-10) docs tripwire: the README `## Storybook` section carries a
// Composition coverage claim in the board trust-lens MUST/MUST-NOT form, a Layout
// C verification note, and an Angular-CLI planned/deferred caveat. This is a
// false-assurance guard (threat T-19-05): if the MUST-NOT caveat or the
// Composition claim is deleted or softened into an over-claim, CI fails here. It
// is a pure, deterministic filesystem read (no compiler load, no build artifact)
// so it runs in the fast `nx test` loop.
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

  it("states the MUST claim: each composed project's declared surface is type-checked", () => {
    expect(normalized).toContain(
      "each composed project's declared TypeScript surface is type-checked",
    );
  });

  it('states the MUST-NOT: we do NOT verify composed refs resolve/deploy (runtime URLs)', () => {
    expect(normalized).toContain('we do NOT verify that composed');
    expect(normalized).toContain('runtime URLs');
  });

  it("does NOT over-claim that Storybook's own refs type catches a bad entry", () => {
    // 19-02 proved StorybookConfig['refs'] is `any`; the doc must credit the
    // consumer-declared ref shape, not Storybook's type, for a caught mistake.
    expect(normalized).toContain("Storybook's own type does not catch it");
  });

  it('carries a Layout C verification note (direct single-leaf path, guarded)', () => {
    expect(normalized).toContain('not a committed-supported Storybook layout');
    expect(normalized).toContain('direct single-leaf path');
  });

  it('words the Angular CLI shape as planned/deferred, NOT unsupported', () => {
    expect(normalized).toContain('not yet covered, planned for a future');
    expect(normalized).toContain('not an unsupported configuration');
  });
});
