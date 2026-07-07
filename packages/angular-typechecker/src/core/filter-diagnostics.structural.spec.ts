import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

// D-01 structural gate (criterion 5): the boundary filter MUST reach an
// external-template diagnostic's owning component via public
// `ts.Diagnostic.relatedInformation` ONLY -- never the ngtsc component registry,
// a `ComponentScopeReader`, the `TemplateTypeChecker`, `program.getSourceFiles`,
// an `NgtscProgram`, or a `@angular/compiler-cli` import. Coupling to any of those
// is brittle across Angular patches: it can silently break and DROP diagnostics ->
// a false PASS (the milestone's core failure mode). Reading only the public TS
// surface keeps the filter stable and unit-testable with synthetic literals.
//
// This is the executable form of that constraint: read filter-diagnostics.ts from
// disk (mirroring the workspace-root resolution the rest of the suite uses) and
// assert a denylist has zero substring matches across the WHOLE file (code AND
// comments). The tokens do not legitimately appear anywhere in this module, so a
// plain substring scan is the loud tripwire -- a future edit that reintroduces an
// internal fails this spec in CI with a clear message.
const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

const sourcePath = join(
  workspaceRoot,
  'packages',
  'angular-typechecker',
  'src',
  'core',
  'filter-diagnostics.ts',
);

const source = readFileSync(sourcePath, 'utf8');

const DENYLIST = [
  'ngtsc',
  'componentRegistry',
  'ComponentScopeReader',
  'TemplateTypeChecker',
  'getSourceFiles',
  '@angular/compiler-cli',
  'NgtscProgram',
] as const;

describe('filter-diagnostics structural gate (D-01, criterion 5)', () => {
  it.each(DENYLIST)(
    'references ZERO ngtsc/component-registry internals: "%s"',
    (token) => {
      expect(
        source.includes(token),
        `filter-diagnostics.ts must reference ZERO ngtsc/component-registry ` +
          `internals (D-01 / criterion 5), but found the denied token "${token}". ` +
          `The boundary filter must resolve an external-template diagnostic's ` +
          `owning component via public ts.Diagnostic.relatedInformation ONLY -- ` +
          `never a compiler-internal API. Remove the coupling.`,
      ).toBe(false);
    },
  );
});
