import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

// GUARD-01 (CI e2e-coverage self-audit). The CI `e2e` job runs the e2e tier with
// `nx run-many -t e2e` (no explicit `-p` list): run-many runs the target for
// EVERY project that defines it. That makes `e2e` coverage depend on TWO
// invariants that both fail SILENTLY:
//   (1) every `e2e/*` project must define an `e2e` target -- a project that drops
//       or renames it is silently never run in CI (the coverage gap a
//       type-checking tool must never tolerate); and
//   (2) NO non-e2e project may define an `e2e` target -- a stray `e2e` target on
//       any other project would be pulled into `run-many -t e2e`, breaking the
//       "exactly the three tarball projects, serialized" guarantee (they share one
//       dist tarball path; see GUARD-01b).
// This guard asserts BOTH directions so a forgotten target or a stray/misplaced
// one becomes a loud, LOCATED test failure instead of a silent miscoverage.
//
// It is a cheap filesystem/text read (NO build/pack/install), so it lives as a
// plain in-plugin `*.spec.ts` and rides the existing fast `test` matrix -- the
// loudest, earliest signal on every OS x Node cell (no `ci.yml` structural
// change). It is READ-ONLY: it reads `ci.yml` + each `project.json` and asserts;
// it NEVER edits `ci.yml`. YAML is asserted with string/regex (NOT a new parser
// dependency) -- the invariant is line-level, mirroring the release-hygiene
// precedent.

// Resolve the workspace root from this spec's location
// (packages/angular-typechecker/src/<file>); findWorkspaceRoot() walks up to nx.json, so every file read is
// cwd-independent (identical depth to the e2e specs).
const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

// Enumerate the workspace's e2e projects by the strict `e2e/<dir>/project.json`
// convention (each project's `.name` === its directory name). Do NOT enumerate by
// the `scope:fixture` tag -- three `libs/*` projects also carry it, which would
// over-count 6 vs the 3 real e2e projects and false-RED the guard forever.
function enumerateE2eProjects(root: string): string[] {
  return readdirSync(join(root, 'e2e'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const projectJson = JSON.parse(
        readFileSync(join(root, 'e2e', entry.name, 'project.json'), 'utf8'),
      ) as { name: string };

      return projectJson.name;
    })
    .sort();
}

// Build/dep-output + planning trees that never host a first-party `project.json`
// and would only slow (or error) the walk. Everything else is scanned so a new
// project anywhere under a standard root is covered without editing this list.
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
// output/planning trees above). A cheap FS walk -- no nx runtime, no new
// dependency -- so the anti-silent-skip guarantee stays a fast-tier check.
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

// Slice the `e2e:` job block (from its key to the next top-level job key) WITHOUT a
// YAML parser (line-level invariant; reuses the release-hygiene no-parser
// precedent). Shared by the `--parallel=1` serialization guard (GUARD-01b) and the
// typecheck-coverage guard (GUARD-01c) so there is ONE job-scoping implementation.
// The job-key regex MUST allow digits or it would miss `e2e:` itself (the `2`).
// Throws a clear located Error if the `e2e:` job is absent, so a ci.yml refactor
// fails LOUDLY.
function extractE2eJobLines(ci: string): string[] {
  const lines = ci.split('\n');
  const start = lines.findIndex((line) => /^ {2}e2e:\s*$/.test(line));

  if (start === -1) {
    throw new Error(
      'GUARD-01: could not locate the `e2e:` job in .github/workflows/ci.yml',
    );
  }

  let end = lines.length;

  for (let index = start + 1; index < lines.length; index++) {
    if (/^ {2}[a-z0-9-]+:\s*$/.test(lines[index])) {
      end = index;

      break;
    }
  }

  return lines.slice(start, end);
}

describe('GUARD-01: run-many -t e2e covers exactly the e2e/* projects', () => {
  const e2eProjects = enumerateE2eProjects(workspaceRoot);

  it('every e2e/* project defines an `e2e` target (no forgotten target -> no silent skip)', () => {
    for (const project of e2eProjects) {
      const projectJson = JSON.parse(
        readFileSync(
          join(workspaceRoot, 'e2e', project, 'project.json'),
          'utf8',
        ),
      ) as { targets?: Record<string, unknown> };

      expect(
        projectJson.targets?.['e2e'],
        `GUARD-01: e2e/${project} does not define an \`e2e\` target -- \`nx run-many -t e2e\` would silently skip it (run-many runs the target only for projects that define it).`,
      ).toBeDefined();
    }
  });

  it('no non-e2e project defines an `e2e` target (run-many -t e2e stays scoped to the tarball projects)', () => {
    for (const path of collectProjectJsonPaths(workspaceRoot)) {
      const relativePath = relative(workspaceRoot, path).split(sep).join('/');

      if (relativePath.startsWith('e2e/')) {
        continue;
      }

      const projectJson = JSON.parse(readFileSync(path, 'utf8')) as {
        targets?: Record<string, unknown>;
      };

      expect(
        projectJson.targets?.['e2e'],
        `GUARD-01: ${relativePath} defines an \`e2e\` target but is not an e2e/* project. \`nx run-many -t e2e\` would run it too, breaking the "exactly the three tarball projects, serialized" guarantee. Give the target a different name, or move the project under e2e/.`,
      ).toBeUndefined();
    }
  });
});

// GUARD-01b (e2e shared-tarball race guard). The correctness of the `e2e` gate
// depends on `--parallel=1`: all three e2e projects `npm pack` the SAME dist
// artifact (dist/packages/angular-typechecker/angular-typechecker-<ver>.tgz) in
// beforeAll and `rmSync` it in afterAll. Vitest serializes specs WITHIN each project
// (singleFork + fileParallelism:false), but `nx run-many` defaults to parallel, so
// without `--parallel=1` a sibling project's afterAll `rmSync` deletes the tarball
// mid-`pnpm add` -> a nondeterministic ENOENT flake. `--parallel=1` is therefore
// load-bearing; guard it the same way the target coverage is guarded (GUARD-01) so
// that dropping it becomes a loud, LOCATED test failure instead of a silent flake.
describe('GUARD-01b: the ci.yml e2e job serializes its projects (shared-tarball race guard)', () => {
  const ci = readFileSync(
    join(workspaceRoot, '.github', 'workflows', 'ci.yml'),
    'utf8',
  );

  it('passes --parallel=1 to the e2e run-many', () => {
    const e2eBlock = extractE2eJobLines(ci).join('\n');

    expect(
      /--parallel=1\b/.test(e2eBlock),
      'GUARD-01b: the `e2e` job must pass `--parallel=1` to `nx run-many` so the three e2e projects run serially. They share one dist tarball path (each packs it in beforeAll + `rmSync`s it in afterAll); running them in parallel races to an ENOENT on `pnpm add`. If this flag was removed intentionally, first give each e2e project a UNIQUE tarball path so cross-project parallelism is safe.',
    ).toBe(true);
  });
});

// GUARD-01c (typecheck coverage guard). The e2e sources are statically
// type-checked by the unified `nx run-many -t typecheck`, which relies on TWO
// conventions that both fail SILENTLY: `nx run-many -t <target>` with ZERO matching
// projects EXITS 0. So (axis 1) if an `e2e/*` project drops or renames its
// `typecheck` target it silently stops type-checking its own specs, and (axis 2) if
// the target name is renamed/typo'd in the ci.yml e2e job the run-many matches zero
// projects and passes vacuously -- a false green either way. This guard closes both
// axes so a drop or a rename becomes a loud, LOCATED failure:
//   (1) EVERY `e2e/*` project (enumerated by the same name===dir convention as
//       GUARD-01) defines a `typecheck` target; a missing one names the project.
//   (2) The ci.yml `e2e` job actually RUNS `nx run-many -t typecheck` (folding the
//       former `typecheck-e2e` gate before the multi-minute tarball install).
// Like GUARD-01/01b it is a cheap READ-ONLY filesystem/text check (reads each
// e2e/*/project.json + ci.yml and asserts; NEVER edits either) asserted with
// string/regex, no YAML parser, riding the existing fast `test` matrix.
describe('GUARD-01c: every e2e project defines typecheck and the ci.yml e2e job runs it', () => {
  it('every e2e/* project defines a typecheck target', () => {
    for (const project of enumerateE2eProjects(workspaceRoot)) {
      const projectJson = JSON.parse(
        readFileSync(
          join(workspaceRoot, 'e2e', project, 'project.json'),
          'utf8',
        ),
      ) as { targets?: Record<string, unknown> };

      expect(
        projectJson.targets?.['typecheck'],
        `GUARD-01c: e2e/${project} does not define a \`typecheck\` target -- it silently stops type-checking its specs while \`nx run-many -t typecheck\` still exits 0 (run-many with zero matches is a no-op green).`,
      ).toBeDefined();
    }
  });

  it('the ci.yml e2e job runs `nx run-many -t typecheck`', () => {
    const ci = readFileSync(
      join(workspaceRoot, '.github', 'workflows', 'ci.yml'),
      'utf8',
    );
    const e2eBlock = extractE2eJobLines(ci).join('\n');

    expect(
      /\brun-many\s+-t\s+typecheck\b/.test(e2eBlock),
      'GUARD-01c: the ci.yml `e2e` job must run `nx run-many -t typecheck`. A rename/typo of the target name here would match zero projects and pass vacuously (run-many with zero matches exits 0), silently skipping the e2e static type-check gate.',
    ).toBe(true);
  });
});

// GUARD-01d (e2e tag-membership guard). The CI `e2e` job scopes its pre-install
// fast type-check with `nx run-many -t typecheck -p tag:type:e2e` -- a selector by
// the `type:e2e` tag. That selection is correct ONLY if the `type:e2e` tag set is
// EXACTLY the e2e/* projects: (axis 1) a new e2e project that forgets the tag is
// silently dropped from the pre-install gate, and (axis 2) a stray `type:e2e` on a
// non-e2e project would pull it into the e2e-scoped run. (The AUTHORITATIVE
// whole-repo type-check is the unscoped `test`-job `run-many -t typecheck`; this
// guard keeps the e2e job's fail-fast gate from silently drifting.) Same cheap,
// READ-ONLY, enumerate-both-directions shape as GUARD-01.
describe('GUARD-01d: the `type:e2e` tag set is exactly the e2e/* projects', () => {
  it('every e2e/* project carries the `type:e2e` tag', () => {
    for (const project of enumerateE2eProjects(workspaceRoot)) {
      const projectJson = JSON.parse(
        readFileSync(
          join(workspaceRoot, 'e2e', project, 'project.json'),
          'utf8',
        ),
      ) as { tags?: string[] };

      expect(
        projectJson.tags ?? [],
        `GUARD-01d: e2e/${project} is missing the \`type:e2e\` tag -- \`nx run-many -t typecheck -p tag:type:e2e\` (the ci.yml e2e pre-install gate) would silently skip it.`,
      ).toContain('type:e2e');
    }
  });

  it('no non-e2e project carries the `type:e2e` tag', () => {
    for (const path of collectProjectJsonPaths(workspaceRoot)) {
      const relativePath = relative(workspaceRoot, path).split(sep).join('/');

      if (relativePath.startsWith('e2e/')) {
        continue;
      }

      const projectJson = JSON.parse(readFileSync(path, 'utf8')) as {
        tags?: string[];
      };

      expect(
        projectJson.tags ?? [],
        `GUARD-01d: ${relativePath} carries the \`type:e2e\` tag but is not an e2e/* project. \`-p tag:type:e2e\` would pull it into the e2e-scoped type-check. Remove the tag or move the project under e2e/.`,
      ).not.toContain('type:e2e');
    }
  });
});
