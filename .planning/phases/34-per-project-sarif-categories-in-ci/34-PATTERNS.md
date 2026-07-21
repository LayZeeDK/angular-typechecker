# Phase 34: Per-project SARIF categories in CI - Pattern Map

**Mapped:** 2026-07-21
**Files analyzed:** 4 (3 new, 1 modified) + 1 optional merge-shape spec
**Analogs found:** 4 / 4 (every file has a strong in-repo analog; this phase is assembly, not invention)

All new logic is CI-side (`tools/ci/*.mjs` + the `code-scanning` job) plus one test-only
plugin spec. The published package surface (`packages/angular-typechecker/src/core/**`,
`src/cli/**`, the manifest) is byte-unchanged (D-06). Every primitive already exists in the
repo -- the planner copies patterns, it does not design new ones.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `tools/ci/list-typecheck-projects.mjs` (NEW) | utility (CI discovery script) | file-I/O (fs read of `project.json` -> JSON to stdout) | `tools/ci/list-e2e-projects.mjs` | exact |
| `tools/ci/merge-sarif.mjs` (NEW) | utility (CI SARIF assembly script, Design B) | transform + batch (spawn CLI per project -> concat `runs[]` -> one file) | fallow per-run stamp `node -e` (`ci.yml:583`) + `sarif-report.ts` envelope + `list-e2e-projects.mjs` CLI-entry idiom | role-match (composed from 3 analogs) |
| `packages/angular-typechecker/src/multi-typecheck-discovery-guard.spec.ts` (NEW) | test (regression / drift guard) | request-response (exec discovery CLI) + transform (independent enumeration, set-equality) | `ci-e2e-coverage-guard.spec.ts` (GUARD-01b) + `scoped-name-guard.spec.ts` (`executorIdReferences`) | exact |
| `.github/workflows/ci.yml` `code-scanning` job (MOD) | config (CI workflow) | event-driven / batch (job steps) | the job itself (atc step + category upload to REPLACE; fallow no-category multi-run to MIRROR; `discover` job separate-assignment idiom) | self-modification |

Optional (RESEARCH Wave 0 Gaps, Validation Architecture): a merge-shape unit spec for
`merge-sarif.mjs` (write fake single-run SARIF parts / stub the CLI, assert merged `runs[]`
count + per-run ids + empty-skip). May live in the guard spec file or a sibling; mirror the
B3 `mkdtempSync` + `execFileSync` temp-root style in `ci-e2e-coverage-guard.spec.ts:646-688`.

## Pattern Assignments

### `tools/ci/list-typecheck-projects.mjs` (utility, file-I/O)

**Analog:** `tools/ci/list-e2e-projects.mjs` (exact -- clone it, re-scope from `e2e/` to `apps/`+`libs/`, filter by executor id instead of `e2e`-target presence).

**Imports pattern** (`list-e2e-projects.mjs:16-18`) -- copy verbatim (node builtins only, no nx, no npm ci):
```js
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
```

**Core discovery pattern** (`list-e2e-projects.mjs:24-48`) -- the shape to adapt. The analog iterates `e2e/<dir>/project.json` and keeps `projectJson.targets?.e2e`; the new file iterates `apps/*` + `libs/*` and keeps the target whose `executor === 'angular-typechecker:typecheck'`:
```js
export function listE2eProjects(workspaceRoot) {
  const e2eRoot = join(workspaceRoot, 'e2e');
  const names = [];

  for (const entry of readdirSync(e2eRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const projectJsonPath = join(e2eRoot, entry.name, 'project.json');

    if (!existsSync(projectJsonPath)) {
      continue;
    }

    const projectJson = JSON.parse(readFileSync(projectJsonPath, 'utf8'));

    if (projectJson.name && projectJson.targets?.e2e) {
      names.push(projectJson.name);
    }
  }
  // ...
}
```

**Executor filter, NOT name match** (D-01a, RESEARCH Pattern 1 + Pitfall 2). Scan `Object.values(targets)` for the executor field -- a `typecheck`-NAME match over-matches (see the Over-match / False-match shared pattern below):
```js
const EXECUTOR = 'angular-typechecker:typecheck';
const target = Object.values(json.targets ?? {}).find((t) => t?.executor === EXECUTOR);
```

**tsConfig array-normalize** (D-01; RESEARCH Pattern 1). All four consumers carry a single STRING `tsConfig` today, but the executor schema is `string | string[]` since v0.2.1 -- normalize:
```js
const raw = target.options?.tsConfig;
const tsConfig = Array.isArray(raw) ? raw : raw ? [raw] : [];
out.push({ name: json.name, tsConfig });
```
Verified consumer values the discovery must yield (coverage is NOT reduced vs today):
- `apps/ng-spike-app/project.json:67` -> `apps/ng-spike-app/tsconfig.app.json` (EXACTLY the currently-hardcoded `ci.yml:566` value)
- `libs/typecheck-consumer/project.json:11` -> `libs/typecheck-consumer/tsconfig.lib.json` (also `includeDeps:true` at :12 -- deliberately NOT threaded, RESEARCH Pitfall 5)
- `libs/typecheck-consumer-dep/project.json:11` -> `libs/typecheck-consumer-dep/tsconfig.lib.json`
- `libs/typecheck-walk-consumer/project.json:11` -> `libs/typecheck-walk-consumer/tsconfig.json`

**Fail-loud-on-empty** (`list-e2e-projects.mjs:55-59`) -- copy this guard; an empty set would silently upload nothing while the job stays green:
```js
if (names.length === 0) {
  throw new Error(
    'list-e2e-projects: no e2e projects discovered under e2e/ ...',
  );
}

return names.sort();
```

**CLI-entry idiom** (`list-e2e-projects.mjs:68-70`) -- copy verbatim so the guard spec (D-04) can exec it and CI can `$(node tools/ci/list-typecheck-projects.mjs)`:
```js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(JSON.stringify(listE2eProjects(process.cwd())));
}
```

---

### `tools/ci/merge-sarif.mjs` (utility, transform + batch -- Design B recommended)

**Analogs:** (1) the fallow per-run stamp `node -e` in `ci.yml:583` for the per-run-id + no-category pattern; (2) `packages/angular-typechecker/src/core/sarif-report.ts` for the single-run envelope it merges; (3) `list-e2e-projects.mjs` for the module + import + CLI-entry idiom. RESEARCH "Design B" folds the D-03 per-project generate loop INTO this script via `spawnSync`.

**The per-run-id stamp to generalize** (`ci.yml:583`, the SHIPPED fallow step) -- this is the exact primitive; the new script does the same `run.automationDetails = { id: ... }` mutation but with the D-02a literal prefix `angular-typecheck/<project>` (note: `angular-typecheck`, NOT `angular-typechecker`):
```js
// ci.yml:583 -- fallow stamps automationDetails.id per run, then uploads with NO category
node -e 'const fs=require("fs");const f="fallow.sarif";const j=JSON.parse(fs.readFileSync(f,"utf8"));(j.runs||[]).forEach(function(r,i){r.automationDetails={id:"fallow/"+i}});fs.writeFileSync(f,JSON.stringify(j))'
```

**The single-run envelope being merged** (`sarif-report.ts:32` header comment + `:134` + `:221-225`). The reporter emits ONE `SarifRunBuilder` per invocation and `node-sarif-builder` bakes `version: "2.1.0"` + `$schema` at the top level, so each per-project file is `{ version, $schema, runs: [<one run>] }`. The merge copies `version` + `$schema` from the first valid input and replaces `runs[]` -- do NOT hand-author the envelope, do NOT import `node-sarif-builder`:
```js
// sarif-report.ts:32 (comment): node-sarif-builder bakes version: "2.1.0" + $schema
// sarif-report.ts:134: const runBuilder = new SarifRunBuilder().initSimple({ ... });  // ONE run
// sarif-report.ts:221-225:
const logBuilder = new SarifBuilder();
logBuilder.addRun(runBuilder);                 // addRun called ONCE -> single-run file
return logBuilder.buildSarifJsonString({ indent: false });
```

**Core Design B pattern** (RESEARCH Code Examples, `34-RESEARCH.md:334-388`) -- import the discovery, `spawnSync` the shipped `bin.js` per project from repo root (repo-relative `artifactLocation` URIs), skip empty stdout (the `[ -s file ]` analogue), stamp the id, concat `runs[]`:
```js
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { listTypecheckProjects } from './list-typecheck-projects.mjs';

const BIN = 'dist/packages/angular-typechecker/src/cli/bin.js';
const root = process.cwd();          // repo root -> repo-relative artifactLocation URIs (D-03)
const runs = [];
let envelope;                        // { version, $schema } copied from the first valid file

for (const { name, tsConfig } of listTypecheckProjects(root)) {
  const args = [BIN];

  for (const leaf of tsConfig) {
    args.push('-c', leaf);           // -c is repeatable for a multi-leaf tsConfig (D-03)
  }

  args.push('--format', 'sarif');

  const res = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const stdout = (res.stdout ?? '').trim();

  if (stdout.length === 0) {
    continue;                        // exit-2 / empty -> skip (the [ -s file ] analogue)
  }

  let doc;

  try {
    doc = JSON.parse(stdout);
  } catch {
    continue;                        // unparseable -> skip
  }

  const run = (doc.runs ?? [])[0];

  if (!run) {
    continue;
  }

  run.automationDetails = { id: `angular-typecheck/${name}` };   // D-02a literal prefix
  runs.push(run);
  envelope ??= { version: doc.version, $schema: doc.$schema };
}

// 0 runs -> write NOTHING so the job's [ -s ] produced-guard skips the upload (RESEARCH Pitfall 6).
if (runs.length > 0) {
  writeFileSync('angular-typechecker.sarif', JSON.stringify({ ...envelope, runs }));
}
```

**Error handling / exit-tolerance:** do NOT throw on a non-zero CLI exit (the `|| true` analogue) -- exit 0/1 still writes the payload, exit 2 writes empty stdout and is skipped. `spawnSync` with a fixed arg array (no `shell: true`) keeps the no-command-injection invariant (RESEARCH Security V5). Note `list-typecheck-projects.mjs` still `throw`s on an EMPTY discovery set -- that is the fail-loud discovery guard, distinct from per-project exit tolerance.

**Design A alternative** (the literal D-02, if the planner insists on strict file-reading): a bash loop runs `bin.js` per project into `sarif-parts/<name>.sarif`, and `merge-sarif.mjs` globs + reads those files. Cost: the loop must parse JSON and build repeatable `-c` args in bash -- CLAUDE.md flags this class of inline shell as a footgun. Design B is preferred and in scope (D-05 makes the shell wiring Claude's Discretion).

---

### `packages/angular-typechecker/src/multi-typecheck-discovery-guard.spec.ts` (test, drift guard)

**Analogs:** `ci-e2e-coverage-guard.spec.ts` (GUARD-01b set-equality, `collectProjectJsonPaths`, `IGNORED_DIRS`, B3 temp-root robustness, exec-the-real-CLI assertion) and `scoped-name-guard.spec.ts` (parsing `targets.*.executor`, non-vacuous-green). Place it beside these under `src/` (RESEARCH Open Question 3 recommends a PLAIN spec riding the `test` target -- see the guard-target discretion note below).

**Imports + workspace-root resolution** (`ci-e2e-coverage-guard.spec.ts:1-15,44-46`) -- copy:
```js
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

const workspaceRoot = findWorkspaceRoot(dirname(fileURLToPath(import.meta.url)));
```

**Reuse the walker + ignore set** (`ci-e2e-coverage-guard.spec.ts:68-99`) -- do NOT write a fresh directory walker (RESEARCH Don't Hand-Roll). Copy `IGNORED_DIRS` and `collectProjectJsonPaths` verbatim:
```js
const IGNORED_DIRS = new Set([
  'node_modules', 'dist', '.nx', '.git', '.angular',
  '.verdaccio', '.planning', 'coverage', 'tmp',
]);

function collectProjectJsonPaths(dir, acc = []) {
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
```

**Parse `targets.*.executor`, never string-grep** (`scoped-name-guard.spec.ts:187-191`) -- the executor-field parse idiom (RESEARCH Pitfall 3: `nx.json`, generator schemas, and a fixture `angular.json` contain the literal but are not consumers):
```js
for (const target of Object.values(json.targets ?? {})) {
  if (typeof target?.executor === 'string' && isOurs(target.executor)) {
    refs.push({ file, id: target.executor });
  }
}
```

**Independent root-agnostic enumeration -- the LOAD-BEARING exclusion** (RESEARCH Code Examples `34-RESEARCH.md:414-438`; Pitfall 1). Subtract BOTH `e2e/` paths AND the workspace-ROOT `project.json`. Verified: root `project.json:14-18` (`@angular-typechecker/source`) declares a REAL `angular-typechecker:typecheck` target on `fixtures/tsconfig.clean.json`, so an executor filter over ALL `project.json` yields FIVE, while the discovery script (`apps/`+`libs/` only) yields FOUR. Without the root subtraction the guard false-fails RED on day one:
```ts
function independentTypecheckProjects(root: string): string[] {
  const names: string[] = [];

  for (const path of collectProjectJsonPaths(root)) {
    const rel = relative(root, path).split(sep).join('/');

    if (rel === 'project.json' || rel.startsWith('e2e/')) {
      continue;                      // root dogfood + e2e fixtures are NOT MULTI consumers
    }

    const json = JSON.parse(readFileSync(path, 'utf8')) as {
      name?: string;
      targets?: Record<string, { executor?: string }>;
    };
    const uses = Object.values(json.targets ?? {}).some(
      (t) => t?.executor === 'angular-typechecker:typecheck',
    );

    if (json.name && uses) {
      names.push(json.name);
    }
  }

  return names.sort();
}
```
WARNING (RESEARCH Pitfall 1): do NOT "fix" a RED by scoping the independent side to `apps/`+`libs/` too -- that silently destroys the root-agnostic drift protection D-04 exists for. The exclusion is `rel === 'project.json'` (root) and `rel.startsWith('e2e/')` (fixtures) ONLY.

**Set-equality assertion via the real CLI** (`ci-e2e-coverage-guard.spec.ts:293-308`) -- exec the discovery script (same path CI runs) and `toEqual` the independent enumeration:
```ts
const cliOutput = execSync('node tools/ci/list-typecheck-projects.mjs', {
  cwd: workspaceRoot,
  encoding: 'utf8',
});
const discovered = (JSON.parse(cliOutput) as { name: string }[]).map((p) => p.name).sort();

expect(discovered).toEqual(independentTypecheckProjects(workspaceRoot));
// both sides: ng-spike-app, typecheck-consumer, typecheck-consumer-dep, typecheck-walk-consumer
```

**Non-vacuous-green guard** (`scoped-name-guard.spec.ts:211-212`, `ci-e2e-coverage-guard.spec.ts:371-374`) -- assert the enumeration is non-empty before asserting equality, so a broken walker/matcher cannot pass by matching nothing:
```ts
expect(independentTypecheckProjects(workspaceRoot).length).toBeGreaterThan(0);
```

**Optional robustness test** (`ci-e2e-coverage-guard.spec.ts:646-688`, the B3 test) -- exercise the real discovery module against a synthetic `mkdtempSync` temp root with a stray dir / falsy-name project, asserting the skips. `execFileSync('node', [script], { cwd: tempRoot })` mirrors the CI path; `rmSync(tempRoot, { recursive: true, force: true })` in `finally`.

---

### `.github/workflows/ci.yml` `code-scanning` job (config, event-driven)

**Analog:** the job itself (`ci.yml:537-602`). Modify ONLY the angular-typechecker generate + upload steps; leave the fallow steps, checkout, setup, `npm ci`, and `nx build` untouched.

**REPLACE the single hardcoded atc-sarif step** (`ci.yml:564-567`) -- today one project, hardcoded tsconfig:
```yaml
- id: atc-sarif
  run: |
    node dist/packages/angular-typechecker/src/cli/bin.js -c apps/ng-spike-app/tsconfig.app.json --format sarif > angular-typechecker.sarif || true
    if [ -s angular-typechecker.sarif ]; then echo "produced=true" >> "$GITHUB_OUTPUT"; else echo "produced=false" >> "$GITHUB_OUTPUT"; fi
```
...with the Design B call + the UNCHANGED `[ -s file ]` produced-guard (RESEARCH `34-RESEARCH.md:390-407`):
```yaml
- id: atc-sarif
  run: |
    node tools/ci/merge-sarif.mjs
    if [ -s angular-typechecker.sarif ]; then echo "produced=true" >> "$GITHUB_OUTPUT"; else echo "produced=false" >> "$GITHUB_OUTPUT"; fi
```

**DROP the `category` input from the angular-typechecker upload** (`ci.yml:588-593`) -- the now-multi-run file collides under a single category (RESEARCH Pitfall 4). MIRROR the fallow no-category upload (`ci.yml:598-602`):
```yaml
# BEFORE (ci.yml:588-593) -- has `category: angular-typechecker`
- name: Upload angular-typechecker SARIF
  if: ${{ (github.event_name != 'pull_request' || github.event.pull_request.head.repo.fork == false) && steps.atc-sarif.outputs.produced == 'true' }}
  uses: github/codeql-action/upload-sarif@7188fc363630916deb702c7fdcf4e481b751f97a # v4.37.1
  with:
    sarif_file: angular-typechecker.sarif
    category: angular-typechecker          # <-- REMOVE this line

# AFTER -- no category; per-run automationDetails.id is the category (mirrors ci.yml:598-602)
- name: Upload angular-typechecker SARIF
  if: ${{ (github.event_name != 'pull_request' || github.event.pull_request.head.repo.fork == false) && steps.atc-sarif.outputs.produced == 'true' }}
  uses: github/codeql-action/upload-sarif@7188fc363630916deb702c7fdcf4e481b751f97a # v4.37.1
  with:
    sarif_file: angular-typechecker.sarif
```

**If Design A is chosen instead**, use the `discover` job's separate-assignment loud-fail idiom (`ci.yml:171-174`) for the discovery substitution so a failed discovery trips `set -e` (never `echo "$(...)"`):
```yaml
- id: list
  run: |
    projects=$(node tools/ci/list-e2e-projects.mjs)
    echo "projects=$projects" >> "$GITHUB_OUTPUT"
```

**Preserve verbatim** (D-05; the job's existing invariants, `ci.yml:537-550`): the fork-PR skip gate on every upload (`...pull_request.head.repo.fork == false`), job-scoped `security-events: write` + restated `contents: read` (`:541-543`), `fetch-depth: 0` (`:550`), the SHA-pinned `upload-sarif@7188fc36...` (`:590,600`), the path-gated `if: needs.changes.outputs.code != 'false'` (`:539`), and run-from-repo-root. The job STAYS ABSENT from the `ci` aggregate `needs[]` (`:619-633`) -- do NOT add it (GATE-01 is Phase 36).

## Shared Patterns

### Executor-filter over target-name (the over-match trap)
**Source:** the over-match set, verified. **Apply to:** discovery script + guard independent enumeration.
Filter by `executor === 'angular-typechecker:typecheck'`, never a `typecheck`-NAME match. The name over-matches three non-consumer classes:
- `packages/angular-typechecker/project.json:73-101` -- the plugin's own `typecheck` via `nx:run-commands` (three `tsc --noEmit` commands)
- `libs/test-util/project.json` -- `typecheck` via `nx:run-commands`
- the `e2e/*` projects (GUARD-01c requires each define a `typecheck` target; none use the plugin executor)
And never string-grep the literal (RESEARCH Pitfall 3): `nx.json:48` (a `targetDefaults` KEY), the generator `schema.json` files, and `fixtures/builder-context/angular.json` (a BUILDER id) all contain it but are not `project.json` `targets.*.executor` fields.

### Two exclusions: root project + e2e fixtures
**Source:** root `project.json:14-18`. **Apply to:** discovery (by root-scoping to `apps/`+`libs/`) + guard (by `rel === 'project.json'` + `rel.startsWith('e2e/')` subtraction).
The root `@angular-typechecker/source` genuinely uses the executor (on clean fixtures) but is deliberately excluded: it produces an always-empty analysis and its `@`+`/` name would munge the per-run id. Discovery excludes it by construction (root scope); the guard must subtract it explicitly or it counts 5 vs discovery's 4 and false-fails RED (RESEARCH Pitfall 1, HIGHEST RISK).

### `[ -s file ]` produced-guard + `|| true` exit-tolerance
**Source:** `ci.yml:566-567` (atc) and `:581-587` (fallow). **Apply to:** the per-project generate (skip empty exit-2 output, the merge-script `stdout.trim().length === 0` analogue) AND the aggregate merged file (write nothing on 0 runs so `[ -s ]` sets `produced=false` and the upload skips -- RESEARCH Pitfall 6). Exit 0/1 writes a valid payload and uploads; exit 2 writes empty and is skipped.

### Per-run `automationDetails.id` = per-analysis category, single upload, NO category input
**Source:** the fallow step `ci.yml:583` (stamp) + `:594-602` (no-category upload). **Apply to:** `merge-sarif.mjs` (stamp `angular-typecheck/<project>` per run) + the angular-typechecker upload (drop `category`). Proven live in spike PR #53: distinct per-run ids land as distinct Code Scanning analyses; a single `category` across multiple runs is rejected by GitHub (2025-07-21+).

### Fail-loud-on-empty + non-vacuous-green
**Source:** `list-e2e-projects.mjs:55-59` (discovery `throw` on empty) + `scoped-name-guard.spec.ts:211-212` / `ci-e2e-coverage-guard.spec.ts:371-374` (assert length > 0 before asserting a set). **Apply to:** the discovery script (throw on 0 projects) + the guard spec (assert the enumeration is non-empty before the equality). Turns silent coverage loss into a loud RED.

### Module + `import.meta.url` CLI-entry dual form
**Source:** `list-e2e-projects.mjs:68-70`. **Apply to:** both new `.mjs` scripts. Export the function for the guard to import/exec, and guard the CLI entry with `process.argv[1] === fileURLToPath(import.meta.url)` so `process.cwd()` = repo root under the workflow.

### CI security invariants (preserve verbatim, do not regress)
**Source:** `ci.yml` top-of-file threat model (`:1-21`) + `code-scanning` job (`:537-550`). **Apply to:** the modified job. Every action SHA-pinned; `persist-credentials: false`; job-scoped `security-events: write` only (top-level stays `contents: read`); fork-PR upload skip; path-gated `if:`; NO PR metadata interpolated into any shell (the fork check is an Actions expression; `spawnSync` uses a fixed arg array).

### JS/TS style (from CLAUDE.md, visible in every analog)
Blank lines around `if`/`for`/`return`; braces on all control-flow bodies even single-statement (see `list-e2e-projects.mjs`, both guard specs). `.mjs` scripts use ESM + node: builtins; single quotes.

## No Analog Found

None. All four files have strong in-repo analogs (three exact/role-match clones, one self-modification). This phase is assembly of existing primitives -- the planner does not need to fall back to RESEARCH-only patterns.

## Guard-target discretion note (for the planner)

RESEARCH Open Question 3 (`34-RESEARCH.md:475-478`): the closest analog `ci-e2e-coverage-guard.spec.ts` is a PLAIN spec riding the cached `test` target and is correct because CI runs cold. `scoped-name-guard` uses a dedicated `cache: false` `nx:run-commands` target (`packages/angular-typechecker/project.json:65-72`) ONLY because it must run on docs-only PRs where `test` is path-gated off. Since the `code-scanning` job + discovery are BOTH path-gated together, the drift guard does NOT need to run on planning-only PRs -- so a PLAIN spec on `test` matches the closest precedent. CONTEXT D-04 says "cache: false ... is the planner's discretion"; the `cache: false` target model is here (`project.json:65-72`) if the planner wants the always-fresh guarantee:
```json
"scoped-name-guard": {
  "executor": "nx:run-commands",
  "cache": false,
  "options": {
    "command": "vitest run --config packages/angular-typechecker/vitest.config.mts scoped-name-guard",
    "cwd": "."
  }
}
```

## Metadata

**Analog search scope:** `tools/ci/`, `.github/workflows/`, `packages/angular-typechecker/src/`, `packages/angular-typechecker/project.json`, root `project.json`, `apps/ng-spike-app/`, `libs/typecheck-consumer{,-dep}/`, `libs/typecheck-walk-consumer/`.
**Files scanned:** 10 (2 analog scripts/config, 2 guard specs, the reporter, 2 plugin/root project.json, 3 consumer project.json). Facts cross-checked against 34-RESEARCH.md Sources.
**Pattern extraction date:** 2026-07-21
