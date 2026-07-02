import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// GUARD-01 (CI e2e-coverage self-audit). The CI `e2e` job runs its e2e projects
// by an EXPLICIT `-p` list in .github/workflows/ci.yml, NOT `nx affected`. If a
// new e2e project is added and the `-p` list is not extended, that project is
// SILENTLY never run in CI -- exactly the coverage gap a type-checking tool must
// never tolerate. This guard asserts the `e2e` job's `-p` list EQUALS the set of
// `e2e/*` projects (bidirectional), so a FORGOTTEN entry (the primary landmine:
// a real e2e project silently skipped) or a STALE/typo entry becomes a loud,
// LOCATED test failure instead. It codifies the current-correct coverage and
// goes RED only on drift.
//
// It is a cheap filesystem/text read (NO build/pack/install), so it lives as a
// plain in-plugin `*.spec.ts` and rides the existing 6-cell `test` matrix -- the
// loudest, earliest signal on every OS x Node cell (no `ci.yml` structural
// change). It is READ-ONLY: it reads `ci.yml` + each `e2e/*/project.json` and
// asserts; it NEVER edits `ci.yml`. YAML is asserted with string/regex (NOT a new
// parser dependency) -- the invariant is line-level, mirroring the
// release-hygiene precedent.

// Resolve the workspace root from this spec's location
// (packages/angular-typechecker/src/<file>) -- 3 dirs up -- so every file read is
// cwd-independent (identical depth to the e2e specs).
const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

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

// Extract the `e2e` job's `-p` project list from ci.yml WITHOUT a YAML parser
// (line-level invariant; reuses the release-hygiene no-parser precedent). Two
// robustness levers, both applied (belt-and-suspenders):
//   1. Job-scope to the `e2e:` block (slice to the next top-level job key). The
//      job-key regex MUST allow digits or it would miss `e2e:` itself (the `2`).
//   2. Match the physical-line-start `-p` of the folded (`>`) run scalar. There is
//      a SECOND `-p` in the `test` job (`-p angular-typechecker`, MID-line); the
//      line-start match uniquely selects the e2e continuation, never the test one.
// Throws a clear located Error if the `e2e:` job or its `-p` line is absent, so a
// ci.yml refactor fails LOUDLY -- never silently.
function extractE2ePList(ci: string): string[] {
  const lines = ci.split('\n');
  const start = lines.findIndex((line) => /^  e2e:\s*$/.test(line));

  if (start === -1) {
    throw new Error(
      'GUARD-01: could not locate the `e2e:` job in .github/workflows/ci.yml',
    );
  }

  let end = lines.length;

  for (let index = start + 1; index < lines.length; index++) {
    if (/^  [a-z0-9-]+:\s*$/.test(lines[index])) {
      end = index;

      break;
    }
  }

  const pLine = lines.slice(start, end).find((line) => /^\s*-p\s+\S/.test(line));

  if (pLine === undefined) {
    throw new Error(
      'GUARD-01: no `-p` project list found in the `e2e:` job of ci.yml',
    );
  }

  return pLine
    .trim()
    .replace(/^-p\s+/, '')
    .split(/\s+/)
    .sort();
}

describe('GUARD-01: the ci.yml e2e job -p list equals the e2e/* project set', () => {
  const ci = readFileSync(
    join(workspaceRoot, '.github', 'workflows', 'ci.yml'),
    'utf8',
  );
  const pList = extractE2ePList(ci);
  const graph = enumerateE2eProjects(workspaceRoot);

  it('covers every e2e/* project (no forgotten -p entry -> no silent skip)', () => {
    for (const project of graph) {
      expect(
        pList,
        `e2e/${project} is a graph e2e project but is MISSING from the ci.yml e2e job -p list`,
      ).toContain(project);
    }
  });

  it('lists no stale/non-e2e project in the -p list', () => {
    for (const project of pList) {
      expect(
        graph,
        `"${project}" is in the ci.yml e2e job -p list but is not an e2e/* project`,
      ).toContain(project);
    }
  });

  it('is an exact bidirectional set match', () => {
    expect(pList).toEqual(graph);
  });
});
