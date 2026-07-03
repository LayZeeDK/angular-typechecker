import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// QT-260703-lp0 (scoped-name regression guard). We do NOT own the
// `@angular-typechecker` npm scope. The package is `angular-typechecker` and its
// executor id is `angular-typechecker:typecheck`. The ONLY sanctioned scoped name
// is `<scope>/source` -- the Nx workspace-root package name in the root
// `package.json` / `package-lock.json`. Any OTHER `<scope>/...` reference in a
// tracked file is the v0.1.0-rename regression (a stray scoped executor id or
// path alias) and MUST fail LOUDLY here instead of resolving accidentally through
// the tsconfig path alias and hiding behind shape-only cache tests.
//
// The search needle is assembled from parts (`SCOPE + '/'`) so THIS guard file
// does not itself contain the banned literal -- otherwise it would flag itself.
//
// Cheap read-only filesystem/git scan (no build/pack/install), so it rides the
// existing in-plugin `test` matrix as a plain `*.spec.ts`. Historical `.planning/`
// artifacts are an immutable record of what happened and are excluded.
const SCOPE = '@angular-typechecker';
const NEEDLE = `${SCOPE}/`;
const ALLOWED = `${SCOPE}/source`;
const SCOPED_REF = new RegExp(`${SCOPE}/[A-Za-z0-9._-]+`, 'g');

// Resolve the workspace root from this spec's location
// (packages/angular-typechecker/src/<file>) -- 3 dirs up.
const workspaceRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);

function trackedFiles(): string[] {
  return execSync('git ls-files', {
    cwd: workspaceRoot,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((file) => !file.startsWith('.planning/'));
}

function findViolations(): string[] {
  const violations: string[] = [];

  for (const file of trackedFiles()) {
    const content = readFileSync(join(workspaceRoot, file), 'utf8');

    if (!content.includes(NEEDLE)) {
      continue;
    }

    const lines = content.split('\n');

    for (let index = 0; index < lines.length; index += 1) {
      const matches = lines[index].match(SCOPED_REF) ?? [];

      for (const match of matches) {
        if (match !== ALLOWED) {
          violations.push(`${file}:${index + 1}: ${match}`);
        }
      }
    }
  }

  return violations;
}

describe('scoped-name regression guard (QT-260703-lp0)', () => {
  it(`allows only ${ALLOWED} across tracked non-.planning files`, () => {
    expect(findViolations()).toEqual([]);
  });
});
