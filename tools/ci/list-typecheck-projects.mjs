// Enumerate the workspace projects that use the angular-typechecker:typecheck
// executor, for the CI `code-scanning` job's per-project SARIF merge (MULTI-02).
//
// Scans `apps/<dir>/project.json` + `libs/<dir>/project.json` and keeps the
// target whose `executor === 'angular-typechecker:typecheck'`, emitting a sorted
// JSON array of `{ name, tsConfig[] }`. `tsConfig` is normalized to an array from
// the target's `options.tsConfig` (the executor schema is `string | string[]`
// since v0.2.1).
//
// Filter by the EXECUTOR id, NOT a `typecheck` target-NAME match: a name match
// over-matches the plugin's own nx:run-commands `typecheck`, libs/test-util, and
// every e2e project (none use the plugin executor). Root-scoping to apps/+libs/
// also excludes BOTH the workspace-root `@angular-typechecker/source` project
// (which dogfoods the executor on clean fixtures) AND the `e2e/*/fixtures/`
// project.json files by construction -- so neither becomes a per-project analysis.
//
// Pure `fs` + JSON -- no nx, no `npm ci` -- so it is fast and directly execable
// from the MULTI-02 drift guard (which asserts this CLI output equals an
// independent root-agnostic enumeration, so the reported set cannot silently
// drift). Mirrors tools/ci/list-e2e-projects.mjs.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXECUTOR = 'angular-typechecker:typecheck';

/**
 * @param {string} workspaceRoot Absolute path to the workspace root.
 * @returns {{ name: string, tsConfig: string[] }[]} Sorted consumers of the
 *   angular-typechecker:typecheck executor under apps/ or libs/.
 */
export function listTypecheckProjects(workspaceRoot) {
  const out = [];

  for (const root of ['apps', 'libs']) {
    const rootDir = join(workspaceRoot, root);

    // A workspace may not have both roots -- skip a missing one rather than
    // ENOENT-crash the discovery.
    if (!existsSync(rootDir)) {
      continue;
    }

    for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const projectJsonPath = join(rootDir, entry.name, 'project.json');

      if (!existsSync(projectJsonPath)) {
        continue;
      }

      const projectJson = JSON.parse(readFileSync(projectJsonPath, 'utf8'));
      const target = Object.values(projectJson.targets ?? {}).find(
        (candidate) => candidate?.executor === EXECUTOR,
      );

      // Push only a TRUTHY name that also carries the executor target. A
      // missing/empty name would inject a null/undefined project into the merge.
      if (projectJson.name && target) {
        const raw = target.options?.tsConfig;
        const tsConfig = Array.isArray(raw) ? raw : raw ? [raw] : [];
        out.push({ name: projectJson.name, tsConfig });
      }
    }
  }

  // Fail loud on empty discovery (mirrors list-e2e-projects.mjs): an empty set
  // would silently merge nothing and upload no analysis while the job stays
  // green. Throwing turns that silent coverage loss into a non-zero exit.
  if (out.length === 0) {
    throw new Error(
      'list-typecheck-projects: no angular-typechecker:typecheck projects discovered under apps/ or libs/',
    );
  }

  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// CLI entry: print the COMPACT single-line JSON array to stdout. The workflow (and
// the drift guard) run this from the repo root, so `process.cwd()` is the
// workspace root.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(JSON.stringify(listTypecheckProjects(process.cwd())));
}
