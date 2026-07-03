import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

// QT-260703-lp0 regression guard. We do NOT own the `@angular-typechecker` npm
// scope; the package is `angular-typechecker` (executor `angular-typechecker:typecheck`).
// The ONLY sanctioned scoped name is the workspace-root package name (derived from
// the root package.json). Any other `<scope>/...` in a tracked file is the
// v0.1.0-rename regression and MUST fail here. `.planning/` history is excluded.
//
// The needle is assembled from parts (`SCOPE + '/'`) so this file carries no banned
// literal (it would flag itself). LOAD-BEARING: any new file that must name the
// banned form assembles it the same way, or lives under `.planning/`.
//
// ponytail: CONTIGUOUS LITERALS ONLY -- a runtime-assembled id (`SCOPE + '/x'`) is
// out of scope by design; combined with tracked-files-only, these are the guard's
// deliberate ceilings. Each fails loudly, never a false PASS.

const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

const SCOPE = '@angular-typechecker';

// The one sanctioned scoped name is the workspace-root package name itself, derived
// from the root package.json so the carve-out tracks a rename instead of duplicating
// the literal. If the root is renamed off the scope, NO `<scope>/...` is allowed.
const ALLOWED = (
  JSON.parse(readFileSync(join(workspaceRoot, 'package.json'), 'utf8')) as {
    name?: string;
  }
).name;

// `<scope>/<name>` plus an OPTIONAL `:<executor>` suffix, so a resurrected scoped
// executor id on the sanctioned name (`<scope>/source:typecheck`) is still flagged
// even though the bare `<scope>/source` package name is allowed. The `*` on the name
// segment also catches a bare `<scope>/`.
const SCOPED_REF = new RegExp(
  `${SCOPE}/[A-Za-z0-9._-]*(?::[A-Za-z0-9._-]+)?`,
  'g',
);

// Pure detector: every `<scope>/...` token in a line except the sanctioned ALLOWED
// name. Kept as a unit so test 1 proves the matcher works -- test 2 asserts the live
// repo is clean and would pass vacuously if the matcher silently broke.
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
    .filter((file) => file.length > 0)
    .filter((file) => !file.startsWith('.planning/'));
}

function findViolations(files: string[]): string[] {
  const violations: string[] = [];

  for (const file of files) {
    let content: string;

    try {
      content = readFileSync(join(workspaceRoot, file), 'utf8');
    } catch {
      // A tracked file absent from the working tree (deleted-but-unstaged
      // mid-refactor) has no content to scan -- skip it rather than crash on
      // ENOENT. CI runs a fresh checkout where every tracked file exists.
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
  it('detector flags disallowed scoped refs but permits the sanctioned name', () => {
    // Assemble bad refs from parts so these assertions are not themselves violations.
    const scopedExecutorId = `${SCOPE}/angular-typechecker:typecheck`;
    // A scoped executor id even on the sanctioned `source` name must be flagged.
    const sanctionedAsId = `${ALLOWED}:typecheck`;

    expect(disallowedScopedRefs(`"executor": "${scopedExecutorId}"`)).toEqual([
      scopedExecutorId,
    ]);
    expect(disallowedScopedRefs(`"executor": "${sanctionedAsId}"`)).toEqual([
      sanctionedAsId,
    ]);
    // A bare `<scope>/` (no name) is still caught.
    expect(disallowedScopedRefs(`${SCOPE}/ trailing`)).toEqual([`${SCOPE}/`]);
    // The sanctioned workspace-root package name is permitted.
    expect(disallowedScopedRefs(`"name": "${ALLOWED}"`)).toEqual([]);
  });

  it(`allows only ${ALLOWED} across tracked non-.planning files`, () => {
    const files = trackedFiles();

    // Non-vacuous: the scan must actually see tracked files (e.g. not run outside a
    // git checkout) before asserting the absence of violations.
    expect(files.length).toBeGreaterThan(0);
    expect(findViolations(files)).toEqual([]);
  });
});

// Executor-id resolution invariant (E4/E5). The scan above enforces the naming
// rule (no disowned scope). This enforces the RESOLUTION rule: every executor id
// the workspace uses for our plugin's target must be the canonical, registered id.
// It catches not just the scoped form but ANY aliased-scope or typo'd id that would
// resolve to the real executor exactly as the v0.1.0 bug did (a tsconfig `paths`
// alias under a different scope, an unscoped typo) -- the disease, not the symptom.
const registeredExecutorNames = Object.keys(
  (
    JSON.parse(
      readFileSync(
        join(workspaceRoot, 'packages/angular-typechecker/executors.json'),
        'utf8',
      ),
    ) as { executors?: Record<string, unknown> }
  ).executors ?? {},
);

const canonicalExecutorIds = new Set(
  registeredExecutorNames.map((name) => `angular-typechecker:${name}`),
);

// Every executor id whose name segment is a registered name (here `:typecheck`),
// as used in a project.json `executor` field or an nx.json targetDefault key.
function executorIdReferences(): { file: string; id: string }[] {
  const suffixes = registeredExecutorNames.map((name) => `:${name}`);
  const isOurs = (id: string): boolean => suffixes.some((s) => id.endsWith(s));
  const refs: { file: string; id: string }[] = [];

  for (const file of trackedFiles()) {
    if (!file.endsWith('project.json') && !file.endsWith('nx.json')) {
      continue;
    }

    let json: {
      targets?: Record<string, { executor?: string }>;
      targetDefaults?: Record<string, unknown>;
    };

    try {
      json = JSON.parse(readFileSync(join(workspaceRoot, file), 'utf8'));
    } catch {
      continue;
    }

    for (const target of Object.values(json.targets ?? {})) {
      if (typeof target?.executor === 'string' && isOurs(target.executor)) {
        refs.push({ file, id: target.executor });
      }
    }

    for (const key of Object.keys(json.targetDefaults ?? {})) {
      if (isOurs(key)) {
        refs.push({ file, id: key });
      }
    }
  }

  return refs;
}

describe('executor-id resolution invariant (E4/E5)', () => {
  it('registers the typecheck executor in executors.json', () => {
    expect(registeredExecutorNames).toContain('typecheck');
  });

  it('references our executor only by the canonical angular-typechecker:<name> id', () => {
    const refs = executorIdReferences();

    // Non-vacuous: the workspace must actually reference the executor somewhere.
    expect(refs.length).toBeGreaterThan(0);

    const nonCanonical = refs.filter(
      (ref) => !canonicalExecutorIds.has(ref.id),
    );

    expect(nonCanonical).toEqual([]);
  });
});
