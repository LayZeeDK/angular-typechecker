// Enumerate the workspace's e2e projects for the CI `e2e` matrix (quick-260715-050).
//
// Reads `e2e/<dir>/project.json` by the strict directory convention (the same
// convention as GUARD-01's `enumerateE2eProjects`) and emits the sorted JSON array
// of project names that define an `e2e` target. It additionally filters by the
// `e2e` target's presence; the result equals `enumerateE2eProjects` given GUARD-01's
// every-e2e-project-has-an-`e2e`-target invariant (GUARD-01b asserts that equality).
// The `discover` CI job pipes this into the dynamic
// `fromJSON(needs.discover.outputs.projects)` matrix, so a NEW e2e project is
// auto-covered with no static list to drift.
//
// Pure `fs` + JSON -- no nx, no `npm ci` -- so the `discover` job is a ~seconds
// checkout + `node` read (vs ~30s for `npm ci` + `nx show projects`). GUARD-01b
// asserts this CLI output equals GUARD-01's enumeration, so the CI matrix cannot
// silently diverge from the actual e2e projects.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @param {string} workspaceRoot Absolute path to the workspace root.
 * @returns {string[]} Sorted names of e2e/* projects that define an `e2e` target.
 */
export function listE2eProjects(workspaceRoot) {
  const e2eRoot = join(workspaceRoot, 'e2e');
  const names = [];

  for (const entry of readdirSync(e2eRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const projectJsonPath = join(e2eRoot, entry.name, 'project.json');

    // A future non-project e2e/ subdir (a fixtures/scratch/tooling folder) has
    // no project.json -- skip it so the CI discover job does not ENOENT-crash.
    if (!existsSync(projectJsonPath)) {
      continue;
    }

    const projectJson = JSON.parse(readFileSync(projectJsonPath, 'utf8'));

    // Push only a TRUTHY name that also defines an `e2e` target. A missing/empty
    // name would inject a null/undefined cell into the CI matrix.
    if (projectJson.name && projectJson.targets?.e2e) {
      names.push(projectJson.name);
    }
  }

  // Fail loud on empty discovery. An empty array would expand the CI `e2e` matrix
  // to zero cells; GitHub then reports the `e2e` job as `skipped`, and the `ci`
  // aggregate excludes `skipped` from its fail set -- so the whole tarball-install
  // tier would silently drop while `ci` still reports green. Throwing here turns
  // that silent coverage loss into a loud, non-zero-exit `discover`-job failure.
  if (names.length === 0) {
    throw new Error(
      'list-e2e-projects: no e2e projects discovered under e2e/ (expected at least one project.json with an `e2e` target)',
    );
  }

  return names.sort();
}

// CLI entry: print the COMPACT single-line JSON array to stdout so
// `echo "projects=$(node tools/ci/list-e2e-projects.mjs)" >> "$GITHUB_OUTPUT"`
// yields a valid single-line workflow output. The workflow runs from the repo
// root, so `process.cwd()` is the workspace root.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(JSON.stringify(listE2eProjects(process.cwd())));
}
