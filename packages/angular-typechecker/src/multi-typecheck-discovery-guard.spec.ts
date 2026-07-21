import { execFileSync, execSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

// MULTI-02 drift guard (D-04). The CI `code-scanning` job merges ONE SARIF run per
// workspace project that uses the `angular-typechecker:typecheck` executor, and
// the reported set is DISCOVERED by `tools/ci/list-typecheck-projects.mjs` (an
// apps/+libs/ fs scan filtered by the executor id), never hardcoded. That makes
// coverage depend on the discovery script staying in sync with the real set of
// executor consumers -- a divergence would silently drop or add an analysis while
// the job stays green.
//
// This guard turns any drift into a loud, located RED: it execs the SAME discovery
// CLI the workflow runs and asserts its project-NAME set EQUALS an independent,
// root-agnostic enumeration -- scan EVERY workspace `project.json` for the executor
// FIELD (never a string-grep: nx.json's targetDefaults key, the generator
// schema.json files, and fixtures/builder-context/angular.json all carry the
// literal but are not consumers), then subtract BOTH the workspace-root
// `project.json` AND any `e2e/` path (see the LOAD-BEARING exclusion below).
//
// It is a cheap READ-ONLY fs/exec check, so it rides the fast `test` target as a
// plain spec (the closest analog, ci-e2e-coverage-guard.spec.ts, does the same;
// the discovery script and the `code-scanning` job are both path-gated together,
// so the guard need not run on planning-only PRs). Mirrors GUARD-01b.

const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

const EXECUTOR = 'angular-typechecker:typecheck';

// Build/dep-output + planning trees that never host a first-party `project.json`
// (reused verbatim from ci-e2e-coverage-guard.spec.ts). Everything else is scanned
// so a new consumer anywhere under a standard root is covered without editing this.
const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  '.nx',
  '.git',
  '.angular',
  '.verdaccio',
  '.planning',
  'coverage',
  'tmp',
]);

// Recursively collect every `project.json` path under `root` (skipping the
// output/planning trees above). A cheap FS walk -- no nx runtime -- reused verbatim
// from ci-e2e-coverage-guard.spec.ts.
function collectProjectJsonPaths(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        collectProjectJsonPaths(join(dir, entry.name), acc);
      }

      continue;
    }

    if (entry.isFile() && entry.name === 'project.json') {
      acc.push(join(dir, entry.name));
    }
  }

  return acc;
}

// Independent, root-agnostic enumeration of the executor's consumers. Parses
// `targets.*.executor` (never string-greps), and subtracts BOTH the workspace-root
// `project.json` AND any `e2e/` path.
//
// The two exclusions are LOAD-BEARING (RESEARCH Pitfall 1, HIGHEST RISK): the
// workspace-root `project.json` (`@angular-typechecker/source`) declares a REAL
// `angular-typechecker:typecheck` target on the clean fixtures, so an unfiltered
// executor enumeration yields FIVE while the discovery script (apps/+libs/ only)
// yields FOUR -- without the root subtraction this guard would false-RED on day
// one. The e2e/*/fixtures/ project.json files also carry the executor but are not
// workspace consumers. DO NOT "fix" a RED by scoping this side to apps/+libs/ too:
// that silently destroys the root-agnostic drift protection this guard exists for.
// The ONLY allowed subtractions are `rel === 'project.json'` and
// `rel.startsWith('e2e/')`.
function independentTypecheckProjects(root: string): string[] {
  const names: string[] = [];

  for (const path of collectProjectJsonPaths(root)) {
    const rel = relative(root, path).split(sep).join('/');

    if (rel === 'project.json' || rel.startsWith('e2e/')) {
      continue;
    }

    const json = JSON.parse(readFileSync(path, 'utf8')) as {
      name?: string;
      targets?: Record<string, { executor?: string }>;
    };
    const uses = Object.values(json.targets ?? {}).some(
      (target) => target?.executor === EXECUTOR,
    );

    if (json.name && uses) {
      names.push(json.name);
    }
  }

  return names.sort();
}

describe('MULTI-02: the discovery script covers exactly the executor consumers', () => {
  it('discovery output equals the independent root-agnostic enumeration', () => {
    const independent = independentTypecheckProjects(workspaceRoot);

    // Non-vacuous green: the enumeration must actually find consumers before the
    // equality means anything (a broken walker/matcher must not pass by matching
    // nothing).
    expect(
      independent.length,
      'MULTI-02: independentTypecheckProjects() found no angular-typechecker:typecheck consumers -- the walker or the executor-field matcher likely drifted, which would make the set-equality below pass vacuously.',
    ).toBeGreaterThan(0);

    const cliOutput = execSync('node tools/ci/list-typecheck-projects.mjs', {
      cwd: workspaceRoot,
      encoding: 'utf8',
    });
    const discovered = (JSON.parse(cliOutput) as { name: string }[])
      .map((project) => project.name)
      .sort();

    expect(
      discovered,
      'MULTI-02: `tools/ci/list-typecheck-projects.mjs` output must equal the independent executor-consumer enumeration -- the CI code-scanning merge must report exactly the executor-using projects (ng-spike-app, typecheck-consumer, typecheck-consumer-dep, typecheck-walk-consumer), no more, no less.',
    ).toEqual(independent);
  });
});

// Discovery robustness (mirrors ci-e2e-coverage-guard.spec.ts's B3 test). Exercise
// the REAL discovery module through its CLI entry against a synthetic temp root so
// the edge-case skips are proven directly: a subdir with NO project.json must not
// ENOENT-crash, and a project.json with a falsy name must not inject a nameless
// project into the merge. (A file:///relative dynamic import of the .mjs is not
// viable -- vitest's module runner cannot resolve a file:// URL outside this
// project's root, and @nx/enforce-module-boundaries bans a literal cross-project
// path. execFileSync mirrors the existing CLI-invocation precedent.)
describe('listTypecheckProjects: tolerates a stray subdir + a falsy project name', () => {
  it('skips a subdir without project.json and a falsy-name project, returning only the valid consumer', () => {
    const script = join(
      workspaceRoot,
      'tools',
      'ci',
      'list-typecheck-projects.mjs',
    );
    const tempRoot = mkdtempSync(join(tmpdir(), 'list-typecheck-projects-'));

    try {
      const libsDir = join(tempRoot, 'libs');

      // (a) a valid consumer: a truthy name + the executor target.
      mkdirSync(join(libsDir, 'valid-consumer'), { recursive: true });
      writeFileSync(
        join(libsDir, 'valid-consumer', 'project.json'),
        JSON.stringify({
          name: 'valid-consumer',
          targets: {
            typecheck: {
              executor: 'angular-typechecker:typecheck',
              options: { tsConfig: 'libs/valid-consumer/tsconfig.json' },
            },
          },
        }),
      );

      // (b) a stray dir with NO project.json (the ENOENT case).
      mkdirSync(join(libsDir, 'stray-no-project-json'), { recursive: true });

      // (c) a project.json with a falsy name (must be skipped, not injected).
      mkdirSync(join(libsDir, 'nameless'), { recursive: true });
      writeFileSync(
        join(libsDir, 'nameless', 'project.json'),
        JSON.stringify({
          targets: { typecheck: { executor: 'angular-typechecker:typecheck' } },
        }),
      );

      const output = execFileSync('node', [script], {
        cwd: tempRoot,
        encoding: 'utf8',
      });

      expect(
        JSON.parse(output) as { name: string; tsConfig: string[] }[],
      ).toEqual([
        {
          name: 'valid-consumer',
          tsConfig: ['libs/valid-consumer/tsconfig.json'],
        },
      ]);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

// WR-01 regression guard: a project with MORE THAN ONE target using the
// executor (the exact shape libs/local-lib's fixture already uses --
// `typecheck` + `typecheck-spec`) must contribute the UNION of every matching
// target's tsConfig, not just the first target's. `.find()` would silently
// drop the second target's tsConfig with no error and no failing test.
describe('listTypecheckProjects: unions tsConfig across multiple executor targets in one project', () => {
  it('collects tsConfig from every target using the executor, not just the first', () => {
    const script = join(
      workspaceRoot,
      'tools',
      'ci',
      'list-typecheck-projects.mjs',
    );
    const tempRoot = mkdtempSync(
      join(tmpdir(), 'list-typecheck-projects-multi-target-'),
    );

    try {
      const libDir = join(tempRoot, 'libs', 'multi-target-lib');
      mkdirSync(libDir, { recursive: true });
      writeFileSync(
        join(libDir, 'project.json'),
        JSON.stringify({
          name: 'multi-target-lib',
          targets: {
            typecheck: {
              executor: 'angular-typechecker:typecheck',
              options: { tsConfig: 'libs/multi-target-lib/tsconfig.lib.json' },
            },
            'typecheck-spec': {
              executor: 'angular-typechecker:typecheck',
              options: {
                tsConfig: 'libs/multi-target-lib/tsconfig.spec.json',
              },
            },
          },
        }),
      );

      const output = execFileSync('node', [script], {
        cwd: tempRoot,
        encoding: 'utf8',
      });

      expect(
        JSON.parse(output) as { name: string; tsConfig: string[] }[],
      ).toEqual([
        {
          name: 'multi-target-lib',
          tsConfig: [
            'libs/multi-target-lib/tsconfig.lib.json',
            'libs/multi-target-lib/tsconfig.spec.json',
          ],
        },
      ]);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
