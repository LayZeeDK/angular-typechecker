# Phase 14: configuration + init generators, nx add - Pattern Map

**Mapped:** 2026-07-02
**Files analyzed:** 14 (10 created, 4 modified)
**Analogs found:** 14 / 14 (in-repo analog for every file; generator-body tier also cites read-only first-party copy-sources in `node_modules`)

> The generator tier is NEW to this plugin, so the closest STRUCTURAL analog is the
> shipped executor tier (`src/executors/typecheck/`) -- same per-directory layout,
> same `schema.json`+`schema.d.ts`+`schema-parity.spec.ts` triad, same
> `executors.json`/`package.json`/`project.json`/`package-manifest.spec.ts`
> packaging surface. The generator BODY logic (init-first composition,
> `targetDefaults ??=`, target write) has NO in-repo analog -- the closest is the
> read-only first-party `@nx/eslint`/`@nx/vitest` generators in `node_modules`,
> cited per file below. Prefer the in-repo structural analog for layout/packaging
> and the first-party bodies for the generator logic.

## File Classification

| New/Modified File | Role | Data Flow | Closest In-Repo Analog | Match Quality |
|-------------------|------|-----------|------------------------|---------------|
| `src/generators/configuration/generator.ts` | generator | transform (config-edit `project.json`) | `src/executors/typecheck/executor.ts` (async default-export, devkit tier) | role-match (structure); body from `@nx/eslint:lint-project` (read-only) |
| `src/generators/configuration/schema.json` | config | -- | `src/executors/typecheck/schema.json` | exact |
| `src/generators/configuration/schema.d.ts` | config | -- | `src/executors/typecheck/schema.d.ts` | exact |
| `src/generators/configuration/schema-parity.spec.ts` | test | -- | `src/executors/typecheck/schema-parity.spec.ts` | exact (mirror closely) |
| `src/generators/configuration/configuration.spec.ts` | test | -- | none in-repo (first generator spec) -> `@nx/devkit/testing` idiom + executor.spec.ts describe/it structure | no-analog (substrate differs) |
| `src/generators/init/generator.ts` | generator | transform (config-edit `nx.json`) | `src/executors/typecheck/executor.ts` (async default-export) | role-match (structure); body from `@nx/eslint`/`@nx/vitest` `init.js` (read-only) |
| `src/generators/init/schema.json` | config | -- | `src/executors/typecheck/schema.json` | exact |
| `src/generators/init/schema.d.ts` | config | -- | `src/executors/typecheck/schema.d.ts` | exact |
| `src/generators/init/init.spec.ts` | test | -- | none in-repo -> `@nx/devkit/testing` idiom | no-analog (substrate differs) |
| `src/generators/init/schema-parity.spec.ts` | test | -- | `src/executors/typecheck/schema-parity.spec.ts` | exact (mirror closely) |
| `generators.json` (NEW root manifest) | config | -- | `executors.json` | exact (mirror `factory` vs `implementation`) |
| `package.json` (MODIFIED) | config | -- | itself (add `generators` field + `files` entry beside `executors`) | exact |
| `project.json` (MODIFIED) | config | -- | itself (add `assets` glob mirroring `executors.json`) | exact |
| `src/package-manifest.spec.ts` (MODIFIED) | test | -- | itself (extend the `files` assertion) | exact |

---

## Pattern Assignments

### `src/generators/configuration/generator.ts` (generator, config-edit transform)

**Structural analog (in-repo):** `packages/angular-typechecker/src/executors/typecheck/executor.ts`
**Body copy-source (read-only, `node_modules`):** `@nx/eslint/dist/src/generators/lint-project/lint-project.js` (`lintProjectGeneratorInternal`)

**Async default-export shape (from the in-repo executor, `executor.ts:37-40`):**
```typescript
export default async function typecheckExecutor(
  options: TypecheckExecutorOptions,
  context: ExecutorContext,
): Promise<{ success: boolean }> {
```
The generator mirrors the "async default export, devkit-aware tier" convention, but its
signature is `(tree: Tree, schema: ConfigurationGeneratorSchema) => Promise<GeneratorCallback | void>`.
Import type from the sibling `./schema` exactly as the executor does
(`import type { TypecheckExecutorOptions } from './schema';`, `executor.ts:11`).

**Init-first + write + format-once composition (copy-source shape,
`@nx/eslint/dist/src/generators/lint-project/lint-project.js`):**
```js
// head (~lines 22-42): init FIRST, push its callback, then read the project config
const tasks = [];
const initTask = await (0, init_1.lintInitGenerator)(tree, { ... });
tasks.push(initTask);
const projectConfig = (0, devkit_1.readProjectConfiguration)(tree, options.project);
// ...
projectConfig.targets ??= {};
projectConfig.targets['lint'] = { command: `eslint ...` };   // <- our version writes the typecheck target
// tail (~lines 116-121): write, format-once, return the aggregated callbacks
(0, devkit_1.updateProjectConfiguration)(tree, options.project, projectConfig);
if (!options.skipFormat) { await (0, devkit_1.formatFiles)(tree); }
return (0, devkit_1.runTasksInSerial)(...tasks);
```
Apply per D-08/D-10: `await initGenerator(tree, { skipFormat: true })` FIRST (so we format
ONCE at the end), then `readProjectConfiguration` -> resolve tsConfig -> collision-check ->
write `projectConfig.targets[targetName] = { executor: 'angular-typechecker:typecheck', options: { tsConfig } }`
-> `updateProjectConfiguration` -> `if (!schema.skipFormat) await formatFiles(tree)` ->
`return runTasksInSerial(...tasks)`.

**Collision branch (D-09):** branch on `existing.executor === 'angular-typechecker:typecheck'`
(idempotent rewrite) vs any other executor (throw a located error). The UNSCOPED id is the
comparison target -- see Pitfall 2 below.

**tsConfig resolution (D-07):** read the virtual `Tree`, never `node:fs` -- use
`tree.exists(path)` to probe and `readJson(tree, path)` (JSONC-safe) to read `references[]`.
Build the path with `joinPathFragments(projectConfig.root, 'tsconfig.json')` -- see Landmine 1.

---

### `src/generators/init/generator.ts` (generator, config-edit transform)

**Structural analog (in-repo):** `packages/angular-typechecker/src/executors/typecheck/executor.ts` (async default export).
**Body copy-source (read-only, `node_modules`):** `@nx/eslint/dist/src/generators/init/init.js` (`addTargetDefaults`) and `@nx/vitest/dist/src/generators/init/init.js` (`updateNxJsonSettings`).

**Verified first-party seed shape (`@nx/eslint init.js` `addTargetDefaults`):**
```js
function addTargetDefaults(tree, format) {
    const nxJson = (0, devkit_1.readNxJson)(tree);
    nxJson.targetDefaults ??= {};
    nxJson.targetDefaults['@nx/eslint:lint'] ??= {};
    nxJson.targetDefaults['@nx/eslint:lint'].cache ??= true;
    nxJson.targetDefaults['@nx/eslint:lint'].inputs ??= [ 'default', '^default', ... ];
    (0, devkit_1.updateNxJson)(tree, nxJson);
}
```
`@nx/vitest init.js` `updateNxJsonSettings` uses the identical `readNxJson -> targetDefaults ??= {} -> [key] ??= {} -> .cache ??= true -> .inputs ??= [...] -> updateNxJson` shape.

**DEVIATION (D-05, locked):** the first-party inits use SUB-KEY `??=` (per-property). D-05
mandates WHOLE-ENTRY `??=` instead -- seed the whole coherent block only when the key is
absent, never merge sub-keys (the WALK-02 `default`-not-`production` inputs + `outputs:[]` +
`cache:true` are interdependent; a sub-key merge could produce an incoherent block). So the
body is:
```typescript
const nxJson = readNxJson(tree) ?? {};              // Pitfall 4: readNxJson can return null
nxJson.targetDefaults ??= {};
nxJson.targetDefaults['angular-typechecker:typecheck'] ??= TYPECHECK_TARGET_DEFAULTS;  // whole-entry
updateNxJson(tree, nxJson);
if (!schema?.skipFormat) { await formatFiles(tree); }
```

**Seed VALUE (copy VERBATIM from `nx.json`, D-04 -- do NOT retype):** see Shared Pattern
"init seed value" below for the exact block and its source line range.

---

### `src/generators/{configuration,init}/schema.json` (config)

**Analog:** `packages/angular-typechecker/src/executors/typecheck/schema.json` (whole file, 31 lines).

**Shape to copy (executor `schema.json:1-31`):**
```json
{
  "$schema": "http://json-schema.org/schema",
  "$id": "TypecheckExecutorOptions",
  "title": "Angular type-check executor",
  "description": "...",
  "cli": "nx",
  "version": 2,
  "type": "object",
  "properties": { ... },
  "required": ["tsConfig"],
  "additionalProperties": false
}
```
Reuse verbatim: `"cli": "nx"` (line 6), `"additionalProperties": false` (line 30), the
`"properties"` object, and `"required": [...]`. NOTE a generator schema OMITS `"version": 2`
(that is an executor-schema field); the first-party `generators.json` schemas do not carry it,
and the parity spec (below) asserts `cli`/`additionalProperties` but NOT `version` for
generators. Recommended surfaces (D-11):
- `configuration`: `project` (string, required, positional via `$default`), `tsConfig`
  (string, optional), `targetName` (string, default `"typecheck"`), `skipFormat` (boolean,
  default `false`).
- `init`: `skipFormat` (boolean, default `false`) only. Do NOT add `keepExistingVersions` /
  `updatePackageScripts` (OQ-2: their presence makes `nx add` append flags for no benefit).

### `src/generators/{configuration,init}/schema.d.ts` (config)

**Analog:** `packages/angular-typechecker/src/executors/typecheck/schema.d.ts` (6 lines):
```typescript
export interface TypecheckExecutorOptions {
  tsConfig: string;
  includeDeps?: boolean;
  maxWarnings?: number;
  failFast?: boolean;
}
```
Mirror exactly: one exported interface (`ConfigurationGeneratorSchema` /
`InitGeneratorSchema`), required props non-optional, optional props with `?`. Keys MUST match
the `schema.json` `properties` (enforced by the parity spec).

---

### `src/generators/{configuration,init}/schema-parity.spec.ts` (test)

**Analog:** `packages/angular-typechecker/src/executors/typecheck/schema-parity.spec.ts` (mirror closely, whole file 53 lines).

**Load pattern + parity assertions (`schema-parity.spec.ts:15-43`):**
```typescript
const schemaPath = join(dirname(fileURLToPath(import.meta.url)), 'schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as ExecutorSchema;

// The exact key set (schema.d.ts), sorted.
const EXPECTED_KEYS = ['failFast', 'includeDeps', 'maxWarnings', 'tsConfig'];

describe('schema.json <-> schema.d.ts parity (D-06)', () => {
  it('declares exactly the ...Options properties', () => {
    expect(Object.keys(schema.properties).sort()).toEqual(EXPECTED_KEYS);
  });
  it('is a ... cli:nx, strict (additionalProperties:false) schema', () => {
    expect(schema.cli).toBe('nx');
    expect(schema.additionalProperties).toBe(false);
  });
});
```
Per generator, set `EXPECTED_KEYS` to the sorted `schema.d.ts` key set
(`configuration`: `['project','skipFormat','targetName','tsConfig']`;
`init`: `['skipFormat']`), and assert `cli === 'nx'` + `additionalProperties === false`.
DROP the executor-only assertions (`version === 2`, the `required === ['tsConfig']` /
`maxWarnings`-no-default / `includeDeps`+`failFast` default checks). This is a pure,
deterministic FS read -- no compiler load, no build artifact -- so it runs in the fast
`nx test` loop, same as the executor parity spec.

---

### `src/generators/configuration/configuration.spec.ts` + `src/generators/init/init.spec.ts` (test) -- NO in-repo substrate analog

**No in-repo analog for the substrate.** The executor specs mock the four core seams with
`vi.hoisted` (`executor.spec.ts:10-45`) -- a DIFFERENT substrate. Generator specs instead
use the PUBLIC in-memory `createTreeWithEmptyWorkspace` from `@nx/devkit/testing` (D-12,
board D1). Borrow the `describe`/`beforeEach`/`it` STRUCTURE and Vitest imports from
`executor.spec.ts`, but the substrate is the devkit testing tree:

```typescript
import { addProjectConfiguration, readNxJson, readProjectConfiguration, writeJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import configurationGenerator from './generator';

describe('configuration generator', () => {
  let tree: Tree;
  beforeEach(() => { tree = createTreeWithEmptyWorkspace(); });
  // ... addProjectConfiguration + writeJson(tree, 'libs/x/tsconfig.json', {references:[...]})
  //     -> await configurationGenerator(tree, { project }) -> assert targets + targetDefaults
});
```
Cases to cover (from RESEARCH Validation Architecture / D-12):
- `configuration`: solution-tsconfig write (assert `tsConfig` is the WORKSPACE-relative
  `libs/x/tsconfig.json` -- Landmine 1); flat-project fallback; `--tsConfig` override;
  no-resolvable-tsconfig error; idempotent-for-ours; non-ours collision throws; init-invoked
  (targetDefaults seeded after running `configuration` alone -- GEN-08).
- `init`: seed shape (`cache:true`, `outputs:[]`, inputs start with `default`, NOT
  `production`); idempotent re-run; don't-clobber a customized entry.

The RESEARCH file already contains full worked example specs (14-RESEARCH.md "Code Examples",
lines 414-500) -- the planner/executor should copy those.

---

### `generators.json` (NEW root manifest, config)

**Analog:** `packages/angular-typechecker/executors.json` (whole file, 10 lines):
```json
{
  "executors": {
    "typecheck": {
      "implementation": "./src/executors/typecheck/executor",
      "schema": "./src/executors/typecheck/schema.json",
      "outputCapture": "direct-nodejs",
      "description": "..."
    }
  }
}
```
**Key difference to mirror:** generators use `"factory"` (extensionless compiled path), executors
use `"implementation"`. NO `outputCapture` on generators. Confirmed against the read-only
first-party `@nx/vitest/generators.json` and `@nx/eslint/generators.json`:
- `@nx/vitest`: `"init"` and `"configuration"` both keyed with `"factory"`, `"schema"`,
  `"description"`. `init` also carries `"aliases": ["ng-add"]` and `"hidden": true`.
- `@nx/eslint`: `"init"` -> `"factory": "./dist/src/generators/init/init#initEsLint"`
  (module#export form), `"hidden": true`, and NO `ng-add` alias -- direct proof the alias is
  NOT required for `nx add` (D-06 RESOLVED).

**Recommended shape (D-02):**
```json
{
  "$schema": "http://json-schema.org/schema",
  "name": "angular-typechecker",
  "version": "0.1",
  "generators": {
    "configuration": {
      "factory": "./src/generators/configuration/generator",
      "schema": "./src/generators/configuration/schema.json",
      "description": "Wire a typecheck target (executor angular-typechecker:typecheck) into a project."
    },
    "init": {
      "factory": "./src/generators/init/generator",
      "schema": "./src/generators/init/schema.json",
      "description": "Seed nx.json targetDefaults so the typecheck target is cacheable."
    }
  }
}
```
Register `init` by its LITERAL key -- do NOT add an `ng-add` alias (D-06; adding it would imply
a deferred Angular-CLI schematic surface, GEN-FUT-02). `factory` uses the extensionless
COMPILED path, exactly like `executors.json`'s `implementation`.

---

### `package.json` (MODIFIED)

**Current shape (`package.json`):**
- `"executors": "./executors.json"` (line 29) -- add `"generators": "./generators.json"`
  BESIDE it.
- `files` array (lines 34-39):
  ```json
  "files": [
    "src",
    "executors.json",
    "README.md",
    "LICENSE"
  ],
  ```
  Add `"generators.json"` to this allowlist.
- `dependencies` (lines 40-43): `@nx/devkit` `23.0.1` + `tslib` `^2.3.0` already present --
  no new dependency is needed (generators import only `@nx/devkit` + Node builtins).

### `project.json` (MODIFIED)

**Current build `assets` array (`project.json:15-37`)** -- the existing `executors.json` glob to mirror:
```json
{
  "input": "./packages/angular-typechecker",
  "glob": "executors.json",
  "output": "."
}
```
(lines 27-31). Add an identical entry for `generators.json`:
```json
{
  "input": "./packages/angular-typechecker",
  "glob": "generators.json",
  "output": "."
}
```
The per-generator `schema.json` files already ship via the existing
`{ input: "./packages/angular-typechecker/src", glob: "**/!(*.ts)", output: "./src" }` glob
(lines 17-21) and `schema.d.ts` via the `**/*.d.ts` glob (lines 22-26) -- NO change needed for
those. Only the root `generators.json` needs the new asset entry.

### `src/package-manifest.spec.ts` (MODIFIED)

**Current `files` assertion (`package-manifest.spec.ts:86-93`):**
```typescript
it('declares the explicit files allowlist (D-01; never rely on npm defaults)', () => {
  expect(manifest.files).toEqual([
    'src',
    'executors.json',
    'README.md',
    'LICENSE',
  ]);
});
```
Extend this `.toEqual([...])` to include `'generators.json'`, and ADD a new assertion mirroring
the existing manifest-field checks:
```typescript
it('registers the generators collection (D-02)', () => {
  expect(manifest.generators).toBe('./generators.json');
});
```
The `PluginManifest` interface (lines 32-53) needs a `generators?: string;` field added so the
new assertion type-checks. The existing `it('is a CommonJS package ...')`,
`@nx/devkit`-pinned, and `keywords`/`repository`/`license` assertions are unchanged.

---

## Shared Patterns

### init seed value (copy VERBATIM from `nx.json`, D-04)
**Source:** `nx.json` -- the UNSCOPED `"angular-typechecker:typecheck"` key (lines 44-58).
**Apply to:** `src/generators/init/generator.ts` (as the `TYPECHECK_TARGET_DEFAULTS` constant).
Copy this exact block -- do NOT hand-retype:
```jsonc
{
  "cache": true,
  "outputs": [],
  "inputs": [
    "default",
    "{projectRoot}/tsconfig*.json",
    "{projectRoot}/package.json",
    "{workspaceRoot}/tsconfig.base.json",
    "^default",
    { "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}", "transitive": true },
    { "externalDependencies": ["typescript", "@angular/compiler-cli"] }
  ]
}
```
**LANDMINE:** `nx.json` also contains a SCOPED sibling key
`"@angular-typechecker/angular-typechecker:typecheck"` (lines 59-73) with an IDENTICAL value --
that key exists ONLY because the dev repo aliases its own package. `init` seeds ONLY the
UNSCOPED `angular-typechecker:typecheck` (what a consumer workspace uses). Do NOT seed the
scoped key. The `default` (NOT `production`) input is load-bearing: `production` excludes
`*.spec.ts`, which would under-hash the spec sources the walk type-checks -> stale PASS.

### devkit APIs (config-edit only, no `generateFiles`)
**Source:** `@nx/devkit` (pinned `dependency` `23.0.1`) -- already declared, no install.
**Apply to:** both generators. Use `readProjectConfiguration` / `updateProjectConfiguration`
(project.json), `readNxJson` / `updateNxJson` (nx.json), `readJson` + `tree.exists`
(JSONC-safe tsconfig reads), `joinPathFragments` (Windows-safe POSIX paths -- same reason the
executor's `normalize-options.ts:47` uses it), `formatFiles`, `runTasksInSerial`,
`createTreeWithEmptyWorkspace` (tests). NEVER `node:fs` inside a generator body (breaks the
in-memory `Tree`).

### ESLint gates (free verification levers)
**Source:** `packages/angular-typechecker/eslint.config.mjs`.
**Apply to:** the whole generator tier.
- The **core-purity** import ban is scoped to `files: ['**/src/core/**/*.ts']` ONLY
  (`eslint.config.mjs:16`). The generator tier (`src/generators/**`) is NOT under `src/core/`,
  so it may import `@nx/devkit` freely -- confirmed.
- `@nx/dependency-checks` (ERROR, on `**/*.json`, `eslint.config.mjs:67-87`) will flag any
  undeclared import the generator introduces -- devkit + tslib are already declared, so no new
  import is expected.
- `@nx/nx-plugin-checks` (ERROR, on `**/package.json`, `eslint.config.mjs:88-96`) validates
  the plugin manifest INCLUDING the new `generators` collection -- it reads `generators.json`
  and checks each `factory`/`schema` path resolves. Treat `nx lint angular-typechecker` as the
  free proof the registration is valid.

---

## No Analog Found (substrate/body differs -- use RESEARCH + read-only first-party sources)

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/generators/configuration/configuration.spec.ts` | test | -- | No in-repo generator spec exists (this is the first). Substrate is `createTreeWithEmptyWorkspace` (`@nx/devkit/testing`), unlike the executor specs' `vi.hoisted` core mocks. Copy the worked example from 14-RESEARCH.md lines 414-462. |
| `src/generators/init/init.spec.ts` | test | -- | Same -- first generator spec; in-memory tree substrate. Copy the worked example from 14-RESEARCH.md lines 464-500. |
| `src/generators/{configuration,init}/generator.ts` (BODY logic) | generator | transform | Structural shape (async default export) is the in-repo executor; the BODY (init-first composition, `targetDefaults ??=`, target write) has no in-repo analog -- copy from the read-only `@nx/eslint:lint-project` / `@nx/eslint`+`@nx/vitest` `init.js` cited above. |

---

## Landmines (surfaced for the planner/executor)

1. **Workspace-root-relative `tsConfig` path (NOT project-root-relative).** The executor
   resolves a relative `options.tsConfig` WORKSPACE-root-relative:
   `packages/angular-typechecker/src/executors/typecheck/normalize-options.ts:45-47` --
   ```typescript
   const tsConfigPath = isAbsolute(options.tsConfig)
     ? options.tsConfig
     : joinPathFragments(context.root, options.tsConfig);
   ```
   The existing manual target stores a workspace-root-relative path
   (`libs/typecheck-walk-consumer/project.json:11` -> `"tsConfig": "libs/typecheck-walk-consumer/tsconfig.json"`).
   So the generator MUST write `joinPathFragments(projectConfig.root, 'tsconfig.json')` (where
   `projectConfig.root` is already workspace-relative, e.g. `libs/foo` -> `libs/foo/tsconfig.json`),
   NOT a bare `'tsconfig.json'`. Tests must assert the FULL workspace-relative path.

2. **Read the virtual `Tree`, never `node:fs`, inside a generator.** Probe with
   `tree.exists(path)` and read tsconfig via `readJson(tree, path)` (comment/JSONC-safe). A
   `node:fs` read bypasses the in-memory tree and breaks `createTreeWithEmptyWorkspace` tests.

3. **Collision compares the UNSCOPED id.** GEN-04/D-09: branch on
   `existing.executor === 'angular-typechecker:typecheck'` (the UNSCOPED published id the
   generator writes) -- NOT on the target NAME, and NOT the scoped dev id. Ours -> idempotent
   rewrite; any other executor -> throw a located error. (The fixture uses the SCOPED
   `@angular-typechecker/...` id because the dev repo aliases itself; a consumer uses the
   unscoped id -- do not confuse them.)

4. **`readNxJson(tree)` can return `null`.** Guard `const nxJson = readNxJson(tree) ?? {};`
   before mutating `targetDefaults` (Pitfall 4).

5. **Seed the UNSCOPED `angular-typechecker:typecheck` key only** -- the dev-repo `nx.json`
   also has a scoped `@angular-typechecker/angular-typechecker:typecheck` key
   (`nx.json:59-73`); do NOT seed it (see Shared Pattern "init seed value").

6. **Whole-entry `??=` (D-05), diverging from first-party sub-key `??=`.** The verified
   first-party `@nx/eslint`/`@nx/vitest` inits use per-sub-key `??=`; D-05 locks WHOLE-ENTRY
   `??=` for the coherent WALK-02 block. Do not copy the sub-key merge verbatim -- seed the
   whole block only when the key is absent.

7. **`nx add` needs the `generators` field only.** RESOLVED in RESEARCH: `nx add` runs
   `nx g angular-typechecker:init` and resolves `init` by literal key. No `ng-add` alias, no
   extra `package.json` manifest key. Register `init` by key; ship `generators.json` +
   `src/generators/init/generator.js` + `schema.json` in the tarball (D-03).

---

## Metadata

**Analog search scope:** `packages/angular-typechecker/` (executor tier, packaging surface),
`nx.json`, `libs/typecheck-walk-consumer/` (fixture), and read-only first-party copy-sources
in `node_modules/@nx/{eslint,vitest}/` (verified with `rg`/`sed`, gitignored tree).
**Files scanned:** executor.ts, executor.spec.ts, schema.json, schema.d.ts,
schema-parity.spec.ts, normalize-options.ts, executors.json, package.json, project.json,
package-manifest.spec.ts, eslint.config.mjs, nx.json, libs/typecheck-walk-consumer/{tsconfig,project}.json,
@nx/{vitest,eslint}/generators.json, @nx/eslint/dist/.../lint-project.js, @nx/eslint/dist/.../init.js, @nx/vitest/dist/.../init.js.
**Pattern extraction date:** 2026-07-02

## PATTERN MAPPING COMPLETE
