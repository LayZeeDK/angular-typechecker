import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// QT-260703-lp0 (scoped-name regression guard). We do NOT own the
// `@angular-typechecker` npm scope. The package is `angular-typechecker` and its
// executor id is `angular-typechecker:typecheck`. The ONLY sanctioned scoped name
// is the Nx workspace-root package name in the root `package.json` /
// `package-lock.json` (derived below). Any OTHER `<scope>/...` reference in a
// tracked file is the v0.1.0-rename regression (a stray scoped executor id or
// path alias) and MUST fail LOUDLY here instead of resolving accidentally through
// the tsconfig path alias and hiding behind shape-only cache tests.
//
// The search needle is assembled from parts (`SCOPE + '/'`) so THIS guard file
// does not itself contain the banned literal -- otherwise it would flag itself.
// This parts-assembly discipline is LOAD-BEARING: any NEW file that must mention
// the banned scoped form has to assemble it from parts the same way this guard
// does (see `SCOPE`/`NEEDLE` below) or live under `.planning/`; a contiguous
// literal anywhere else fails here.
//
// Cheap read-only filesystem/git scan (no build/pack/install), so it rides the
// existing in-plugin `test` matrix as a plain `*.spec.ts`. Historical `.planning/`
// artifacts are an immutable record of what happened and are excluded.

// Resolve the workspace root from this spec's location
// (packages/angular-typechecker/src/<file>) -- 3 dirs up.
const workspaceRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);

const SCOPE = '@angular-typechecker';
const NEEDLE = `${SCOPE}/`;

// The one sanctioned scoped name is the workspace-root package name itself.
// Derive it from the root `package.json` so the carve-out tracks a rename rather
// than duplicating the literal here (and so this file carries no banned literal).
// If the root is ever renamed out from under the scope, NO `<scope>/...` form is
// allowed and the ban becomes unconditional.
const ALLOWED = (
  JSON.parse(readFileSync(join(workspaceRoot, 'package.json'), 'utf8')) as {
    name?: string;
  }
).name;

// `*` (not `+`): a bare `<scope>/` with no trailing name -- or one followed by a
// non-name char -- still matches and is flagged (only ALLOWED is permitted).
const SCOPED_REF = new RegExp(`${SCOPE}/[A-Za-z0-9._-]*`, 'g');

// Pure detector: every `<scope>/...` token in a line of text except the sanctioned
// ALLOWED name.
//
// ponytail: CONTIGUOUS LITERALS ONLY -- a runtime-assembled id (`SCOPE + '/x'`) is
// intentionally out of scope, because this repo teaches that exact technique to
// name the banned form in tests, so chasing assembled strings would be
// self-defeating. Combined with tracked-files-only + `.planning`-excluded, these
// are the guard's deliberate ceilings; each fails loudly, never a false PASS.
function disallowedScopedRefs(text: string): string[] {
  return (text.match(SCOPED_REF) ?? []).filter((ref) => ref !== ALLOWED);
}

function trackedFiles(): string[] {
  return execSync('git ls-files', {
    cwd: workspaceRoot,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  })
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((file) => !file.startsWith('.planning/'));
}

function findViolations(files: string[]): string[] {
  const violations: string[] = [];

  for (const file of files) {
    const content = readFileSync(join(workspaceRoot, file), 'utf8');

    if (!content.includes(NEEDLE)) {
      continue;
    }

    const lines = content.split('\n');

    for (let index = 0; index < lines.length; index += 1) {
      for (const ref of disallowedScopedRefs(lines[index])) {
        violations.push(`${file}:${index + 1}: ${ref}`);
      }
    }
  }

  return violations;
}

describe('scoped-name regression guard (QT-260703-lp0)', () => {
  it('detector flags a disallowed scoped ref but permits the sanctioned name', () => {
    // Assemble the bad ref from parts so these assertions are not themselves a
    // violation this guard would catch.
    const scopedName = `${SCOPE}/angular-typechecker`;

    // A resurrected scoped executor id is caught by its name portion -- the match
    // stops at ':' (outside the name char class), which is exactly what makes a
    // stray `<scope>/...:typecheck` fail this guard.
    expect(
      disallowedScopedRefs(`"executor": "${scopedName}:typecheck"`),
    ).toEqual([scopedName]);
    // A bare `<scope>/` (no trailing name) is still caught.
    expect(disallowedScopedRefs(`${NEEDLE} trailing`)).toEqual([NEEDLE]);
    // The sanctioned workspace-root name is permitted.
    expect(disallowedScopedRefs(`"name": "${ALLOWED}"`)).toEqual([]);
  });

  it(`allows only ${ALLOWED} across tracked non-.planning files`, () => {
    const files = trackedFiles();

    // Guard against a vacuous pass (e.g. run outside a git checkout): the scan
    // MUST actually see tracked files before asserting the absence of violations.
    expect(files.length).toBeGreaterThan(0);
    expect(findViolations(files)).toEqual([]);
  });
});
