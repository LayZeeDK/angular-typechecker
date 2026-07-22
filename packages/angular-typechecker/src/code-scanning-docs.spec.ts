import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// Docs tripwire for the README `### SARIF and GitHub Code Scanning` section's
// "Scanned files" limitation claim (DOC-01). That subsection is the only place
// the empty "Scanned files" panel is explained as a known GitHub limitation, so
// if the claim is deleted, softened, or the `run.artifacts` spike evidence is
// dropped, a reader could mistake the blank panel for an angular-typechecker
// defect. This is a false-assurance guard: the strings below appear ONLY in that
// subsection, so removing or gutting it fails CI here. It is a pure,
// deterministic filesystem read (no compiler load, no build artifact) so it runs
// in the fast `nx test` loop.
//
// Assertions normalize runtime whitespace (`\s+` -> single space) so they survive
// prose re-wrapping -- the CLAIM is locked, not its line breaks.
//
// Coverage nuance: the `test` target is path-gated on `code`, so a README-only PR
// (`*.md` -> `code=false`) SKIPS this tripwire -- the SAME coverage the other
// `*-docs.spec.ts` tripwires already have (accepted parity). This phase's own PR
// touches `ci.yml` (`code=true`), so the tripwire IS exercised at phase
// verification. The other docs tripwires own their own claims; this file does not
// duplicate them.

const readmePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../README.md',
);
const readme = readFileSync(readmePath, 'utf8');
const normalized = readme.replace(/\s+/g, ' ');

describe('README ### SARIF and GitHub Code Scanning -- Scanned-files limitation (docs tripwire)', () => {
  it('has the SARIF and GitHub Code Scanning section heading', () => {
    expect(readme).toContain('### SARIF and GitHub Code Scanning');
  });

  it('documents the empty "Scanned files" panel as a GitHub limitation', () => {
    expect(normalized).toContain('Scanned files');
    expect(normalized).toContain('a GitHub limitation');
  });

  it('attributes the panel to CodeQL-only telemetry', () => {
    expect(normalized).toContain('CodeQL');
  });

  it('locks the spike evidence that run.artifacts does not populate the panel', () => {
    expect(normalized).toContain('run.artifacts');
  });
});
