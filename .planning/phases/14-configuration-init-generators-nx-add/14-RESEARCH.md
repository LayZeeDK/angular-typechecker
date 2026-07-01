# Phase 14: configuration + init generators, nx add - Research

**Researched:** 2026-07-02
**Domain:** Nx 23 devkit generators (config-edit only: `project.json` + `nx.json`), `nx add` install contract
**Confidence:** HIGH (every load-bearing claim verified against the installed Nx 23.0.1 source in `node_modules/` and the shipped codebase; no web fetch needed)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (copied verbatim from 14-CONTEXT.md `## Implementation Decisions`)

**Generator source layout + registration (GA-1)**
- **D-01 (Layout mirrors the executor tier):** Both generators live under `packages/angular-typechecker/src/generators/<name>/` -- `.../configuration/` and `.../init/` -- each carrying `generator.ts` (default-export async Nx generator fn), `schema.json`, `schema.d.ts`, a co-located `<name>.spec.ts`, and a `schema-parity.spec.ts`. Matches `src/executors/typecheck/`.
- **D-02 (New root `generators.json`, `factory`-keyed):** Add `packages/angular-typechecker/generators.json` registering both generators, each entry keyed with `factory` -> the extensionless COMPILED path (`./src/generators/<name>/generator`) + `schema` (`./src/generators/<name>/schema.json`) + a `description`. Add `"generators": "./generators.json"` to the published `package.json`.
- **D-03 (Ship it in the tarball):** `generators.json` needs its OWN build `assets` glob (`{ input: ./packages/angular-typechecker, glob: "generators.json", output: "." }`) alongside `executors.json`, AND must be added to the `package.json` `files` allowlist (currently `src`, `executors.json`, `README.md`, `LICENSE`). The per-generator `schema.json` files are already copied by the existing `**/!(*.ts)` asset glob and `schema.d.ts` by the `**/*.d.ts` glob. Only the root `generators.json` needs the extra wiring.

**`init` generator -- targetDefaults seeding (GA-2)**
- **D-04 (Seed the UNSCOPED id with the VERBATIM WALK-02 block):** `init` seeds `nx.json` `targetDefaults` under the UNSCOPED published executor id **`angular-typechecker:typecheck`** only (NOT the scoped dev-repo key). The seeded value is the EXACT block currently in this repo's `nx.json` (copy verbatim). The `default` (NOT `production`) input is load-bearing. Use `readNxJson`/`updateNxJson` from `@nx/devkit`.
- **D-05 (Whole-entry `??=` don't-clobber):** If `targetDefaults["angular-typechecker:typecheck"]` already exists (any shape), `init` leaves it UNTOUCHED. Seed only when the key is absent. (Interpret GEN-07's "per-key `??=`" as whole-entry don't-clobber at the `targetDefaults` key level; the planner MAY refine to a finer sub-key `??=` if research shows first-party `init`s do so, but whole-entry is the safe default.)

**`nx add` -> `init` wiring (GA-3) -- borderline, RESEARCH-VERIFY**
- **D-06 (Register `init` by name; rely on the first-party nx-add contract):** Register the generator literally as `init` in `generators.json`. `nx add angular-typechecker` runs the package's `init` generator on install (GEN-09). RESEARCH-VERIFY the exact Nx 23.0.1 `nx add` discovery contract (see the dedicated section below -- **RESOLVED**). Do NOT ship an Angular-CLI `ng add` schematic (GEN-FUT-02 stays deferred).

**`configuration` -- tsConfig resolution (GA-5)**
- **D-07 (Resolution order):** 1. explicit `--tsConfig` wins (honored verbatim, project-root-relative); 2. else the project's solution `tsconfig.json` IF it exists and has `references[]` -> point the ONE target at it (relies on WALK-01); 3. else **flat-project fallback** -> the leaf tsconfig by Nx `projectType` (`application` -> `tsconfig.app.json`, `library` -> `tsconfig.lib.json`) with an fs existence probe; 4. else error clearly. Nx workspaces only; Angular CLI layouts deferred; prod tsconfigs not walked. Spec checking is automatic via the walk in case (2); in the flat fallback (3) spec checking is out of scope (GEN-03).

**`configuration` -- target write, idempotency, collision (GA-4)**
- **D-08 (One minimal target, config-edit only):** Write ONE target named `targetName` (default `typecheck`) with `executor: "angular-typechecker:typecheck"` and `options.tsConfig` = the resolved path, via `readProjectConfiguration`/`updateProjectConfiguration`/`formatFiles`. NO `generateFiles`. Caching delegated to `init` (D-04).
- **D-09 (Idempotent for ours, error for non-ours):** A re-run is idempotent when a same-named target already exists AND is OURS (`executor === angular-typechecker:typecheck`) -- rewrite to the same shape, no duplicate. When a same-named target exists that is NOT ours, THROW a clear, located error (do not clobber). Configurable `targetName` lets a consumer sidestep a genuine name clash.
- **D-10 (`configuration` invokes `init`):** `configuration` calls the `init` generator as part of its run (GEN-08). The idiomatic first-party pattern.

**Claude's Discretion**
- **D-11 (Schema option surface -- LOW impact, planner may refine):** Recommended `configuration` schema: `project` (string, required, positional), `tsConfig` (string, optional), `targetName` (string, default `"typecheck"`), `skipFormat` (boolean, default `false`); `additionalProperties: false`, `cli: "nx"`. Recommended `init` schema: minimal -- `skipFormat` (boolean, default `false`) or no options; `additionalProperties: false`, `cli: "nx"`. Parity enforced by `schema-parity.spec.ts` per generator.

**Testing (GA-7 -- board-locked)**
- **D-12 (In-memory substrate only, this phase):** Unit tests run on the PUBLIC in-memory `createTreeWithEmptyWorkspace` (`@nx/devkit/testing`). Assert `configuration` target write (solution + flat-fallback) + idempotency + non-ours collision error; assert `init` seed shape + idempotent re-run + don't-clobber + `default`-not-`production`; plus a schema-parity spec per generator. Bespoke real-disk `createFsTree` NOT built (FSTREE-01 deferred). Real-disk / install fidelity is Phase 15.

### Claude's Discretion (research decides, planner encodes)
- D-05 whole-entry vs sub-key `??=` -- planner may refine (this research recommends WHOLE-ENTRY; see Pitfall 3).
- D-11 schema option surface -- planner may rename/trim; keep pair in parity.

### Deferred Ideas (OUT OF SCOPE -- do NOT research or plan)
- GE2E-01..03 + GUARD-01 (generator/nx-add tarball e2e + `-p` guard) -> **Phase 15**.
- FSTREE-01 (bespoke real-disk `createFsTree`/`flushFsTreeChanges`) -- only if a future generator emits files.
- GEN-FUT-01 (Angular CLI `angular.json` support) / GEN-FUT-02 (`ng add` Angular CLI schematic).
- WALK-FUT-01 (`createNodesV2` inferred granular per-leaf targets).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GEN-01 | `configuration` wires a `typecheck` target via `readProjectConfiguration`/`updateProjectConfiguration`/`formatFiles`; no `generateFiles`; reads/writes `nx.json` through `init` | Verified devkit APIs (all present at 23.0.1) + `@nx/eslint:lint-project` copy-source template (Architecture Pattern 1) |
| GEN-02 | ONE target at the solution `tsconfig.json`; `--tsConfig` override; flat-project fallback (`tsconfig.app.json`/`tsconfig.lib.json` by `projectType` + existence probe) | tsConfig resolution logic (Architecture Pattern 2); confirmed standard Nx solution-tsconfig shape has `references[]` (common case) |
| GEN-03 | Spec-tsconfig checking automatic via WALK-01 (spec leaf walked); flat-fallback leaf spec-checking left to consumer | Confirmed by 13-CONTEXT walk contract; `typecheck-walk-consumer` fixture proves references include `tsconfig.spec.json` |
| GEN-04 | Re-run idempotent (no dup, no clobber); non-ours same-named target errors clearly | Idempotency + collision logic (Architecture Pattern 1, Pitfall 2) |
| GEN-05 | Ship hand-authored `schema.json` + `schema.d.ts` for both generators; registered via `generators.json` (`factory`) + `package.json` `generators` field; in tarball `files` | Packaging wiring (Architecture Pattern 4); mirror executor `executors.json` idiom; `@nx/nx-plugin-checks` validates it |
| GEN-06 | Unit tests on `createTreeWithEmptyWorkspace`; solution + flat-fallback + idempotency; schema-parity spec | Test substrate confirmed (`createTreeWithEmptyWorkspace(opts?): Tree`); Validation Architecture section |
| GEN-07 | Standalone `init` idempotently seeds `targetDefaults["angular-typechecker:typecheck"]` WALK-02 block; unscoped id; never clobbers; `default`-not-`production` | `init` seed pattern (Architecture Pattern 3); verbatim WALK-02 block from `nx.json`; `@nx/vitest`+`@nx/eslint` init `??=` precedent |
| GEN-08 | `configuration` invokes `init` (one command wires target AND seeds caching) | `configuration`-calls-`init` composition verified in `@nx/vitest:configuration` + `@nx/eslint:lint-project` (Architecture Pattern 1) |
| GEN-09 | `nx add angular-typechecker` auto-runs registered `init` on install | **RESOLVED** -- the nx-add->init contract section below (exact Nx 23.0.1 source cited) |
</phase_requirements>

## Summary

Phase 14 is the plugin's first generator work, and the research is unusually low-risk because every pattern it needs is demonstrated by first-party Nx 23.0.1 plugins already installed in `node_modules/` -- `@nx/vitest` (`init` + `configuration`) and `@nx/eslint` (`init#initEsLint` + `lint-project`). No new external dependency is introduced: generators import only `@nx/devkit` (an already-pinned runtime `dependency`) plus Node builtins. The whole phase is config-edit-only (`readProjectConfiguration`/`updateProjectConfiguration`/`readNxJson`/`updateNxJson`/`formatFiles`) with NO file emission, so no real-disk test substrate is needed -- the public in-memory `createTreeWithEmptyWorkspace` (`@nx/devkit/testing`) is the correct and sufficient substrate (board D1 / D-12).

The single genuinely public contract in the phase -- how `nx add angular-typechecker` finds and runs `init` (GEN-09 / D-06) -- is now **fully resolved against the Nx 23.0.1 source**: `nx add` literally constructs the command `nx g <pkg>:init` and resolves the generator by the KEY `init` in the package's `generators.json` (discovered via the `package.json` `generators` field). No `ng-add` alias and no extra `package.json` manifest key are required. The alias-aware `findInitGenerator` helper that inspects `ng-add`/`init` aliases is **dead code in 23.0.1** (defined, never called).

**Primary recommendation:** Copy the `@nx/eslint:lint-project` shape for `configuration` (init-first, then `readProjectConfiguration` -> mutate `projectConfig.targets[targetName]` -> `updateProjectConfiguration` -> `formatFiles` -> `runTasksInSerial`) and the `@nx/eslint`/`@nx/vitest` `init` shape for `init` (`readNxJson` -> `targetDefaults ??=` guard -> `updateNxJson`). Register both literally-keyed generators in a root `generators.json` mirroring the existing `executors.json` idiom, add the `generators` field + `files` entry + build asset glob, and write the seeded targetDefaults block verbatim from `nx.json`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Wire a project's `typecheck` target | Generator (`configuration`) -> `project.json` | -- | Per-project config edit; devkit `readProjectConfiguration`/`updateProjectConfiguration` own project.json |
| Seed workspace caching defaults | Generator (`init`) -> `nx.json` `targetDefaults` | -- | Workspace-level config; devkit `readNxJson`/`updateNxJson` own nx.json |
| Resolve which tsconfig the target points at | Generator (`configuration`), reading the virtual `Tree` | -- | Solution-vs-flat detection reads tsconfig from `Tree`, NOT `node:fs` (generators operate on the in-memory tree) |
| Type-check the resolved tsconfig's leaves | Engine (`runTypecheck`, Phase 13 walk) + Executor | Generator (none) | The generator only WIRES the target; the Phase 13 walk does the checking at run time |
| Auto-seed on install | Nx CLI `nx add` -> invokes `init` generator | Generator (`init`) | `nx add` is Nx-owned; our only obligation is a correctly-registered `init` |
| Package/ship the generators | Build (`@nx/js:tsc` + asset globs) + `package.json` `generators`/`files` | -- | tsc emits `generator.js`; asset globs ship `schema.json`/`schema.d.ts`/`generators.json` |

## Standard Stack

### Core (no new packages -- all already installed and declared)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nx/devkit` | `23.0.1` (pinned `dependency`) | `readProjectConfiguration`, `updateProjectConfiguration`, `readNxJson`, `updateNxJson`, `formatFiles`, `runTasksInSerial`, `joinPathFragments`, `readJson`, `getProjects`, `Tree`/`ProjectConfiguration`/`GeneratorCallback` types | The generator authoring API; already the plugin's pinned runtime dependency; core-purity lint gate does NOT constrain `src/generators/**` `[VERIFIED: packages/angular-typechecker/eslint.config.mjs:16]` |
| `@nx/devkit/testing` | `23.0.1` | `createTreeWithEmptyWorkspace(opts?: { layout?: "apps-libs" }): Tree` -- the in-memory test substrate | Board D1 / D-12; public API; `[VERIFIED: nx/dist/src/generators/testing-utils/create-tree-with-empty-workspace.d.ts]` |
| `vitest` | `4.1.9` | Test runner; co-located `*.spec.ts` auto-route into the existing 6-cell `test` matrix | Established; same as executor specs |
| `tslib` | `^2.3.0` | `importHelpers` runtime helper | Already declared |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-memory `createTreeWithEmptyWorkspace` | Bespoke real-disk `createFsTree` (FSTREE-01) | Zero value for a config-edit generator that emits no files; deferred by board D1 |
| Whole-entry `??=` (D-05) | Sub-key `??=` (first-party precedent) | Sub-key risks an incoherent WALK-02 block (see Pitfall 3); whole-entry is safer here |
| `factory`-keyed `generators.json` | `implementation`-keyed | Nx generators use `factory`; executors use `implementation`. Do not mix. `[VERIFIED: @nx/vitest/generators.json, @nx/eslint/generators.json]` |

**Installation:** None. No `npm install` required for this phase -- `@nx/devkit` is already a pinned dependency and no other runtime package is introduced.

**Version verification:** `@nx/devkit@23.0.1` is the installed + declared version (`packages/angular-typechecker/package.json` `dependencies["@nx/devkit"] = "23.0.1"`, exact-pinned). All devkit functions used were observed IMPORTED AND CALLED in the compiled first-party generators (`@nx/vitest/dist/src/generators/init/init.js`, `@nx/eslint/dist/src/generators/lint-project/lint-project.js`) -- stronger evidence than a registry lookup.

## Package Legitimacy Audit

**No external packages are installed by this phase.** The generators import only `@nx/devkit` (already a pinned `dependency`, `23.0.1`, ~weekly-millions downloads, source `github.com/nrwl/nx`), `@nx/devkit/testing` (same package, test-only), and Node builtins (`node:path`, `node:fs` for spec reads only). `tslib` is already declared. slopcheck/registry audit is not applicable -- there is nothing new to vet. The `@nx/dependency-checks` ESLint rule (ERROR, on `package.json`) will independently confirm no undeclared import is introduced `[VERIFIED: packages/angular-typechecker/eslint.config.mjs:69]`.

## Architecture Patterns

### System Architecture Diagram

```
                          nx g angular-typechecker:configuration <project> [--tsConfig] [--targetName]
                                                     |
                                                     v
                          +-------------------------------------------------+
                          |  configuration generator (async fn)             |
                          |  1. await init(tree, { skipFormat: true })  ----+---> init generator
                          |  2. const p = readProjectConfiguration(tree)    |     (see below)
                          |  3. resolve tsConfig  (Tree reads, NOT node:fs) |
                          |       a. --tsConfig override?                   |
                          |       b. solution tsconfig.json w/ references[]?|
                          |       c. flat leaf by projectType + tree.exists |
                          |       d. else throw located error               |
                          |  4. collision check on p.targets[targetName]    |
                          |       - ours (same executor) -> rewrite (idemp) |
                          |       - non-ours            -> throw            |
                          |  5. p.targets[targetName] = {executor, options} |
                          |  6. updateProjectConfiguration(tree, name, p)   |
                          |  7. if !skipFormat: await formatFiles(tree)     |
                          |  8. return runTasksInSerial(...tasks)           |
                          +-------------------------------------------------+
                                                     |
                                                     v
                                    project.json  <-- one typecheck target written

     nx add angular-typechecker  (on install)          nx g angular-typechecker:init  (standalone)
                    |                                                  |
                    v                                                  v
     Nx runs `nx g angular-typechecker:init` --------------> +----------------------------+
     (resolves generator KEYED "init" via                    |  init generator (async fn) |
      package.json `generators` -> generators.json)          |  n = readNxJson(tree)      |
                                                             |  n.targetDefaults ??= {}   |
                                                             |  n.targetDefaults[         |
                                                             |    "angular-typechecker:   |
                                                             |     typecheck"] ??= {WALK-02}|  <-- whole-entry guard (don't clobber)
                                                             |  updateNxJson(tree, n)     |
                                                             |  if !skipFormat: format    |
                                                             +----------------------------+
                                                                          |
                                                                          v
                                                          nx.json <-- targetDefaults seeded (unscoped id)
```

### Recommended Project Structure (mirrors `src/executors/typecheck/`)
```
packages/angular-typechecker/
|-- generators.json                       # NEW root registration (factory-keyed), globbed into build output
|-- package.json                          # + "generators": "./generators.json"; + "generators.json" in files[]
|-- project.json                          # + build asset glob for generators.json
'-- src/generators/
    |-- configuration/
    |   |-- generator.ts                  # default-export async (tree, schema) => GeneratorCallback|void
    |   |-- schema.json                   # cli:nx, additionalProperties:false
    |   |-- schema.d.ts                   # ConfigurationGeneratorSchema interface (parity)
    |   |-- configuration.spec.ts         # createTreeWithEmptyWorkspace: solution + flat + idempotency + collision
    |   '-- schema-parity.spec.ts         # keys(schema.json.properties) === schema.d.ts keys
    '-- init/
        |-- generator.ts                  # default-export async (tree, schema) => void
        |-- schema.json
        |-- schema.d.ts                   # InitGeneratorSchema interface
        |-- init.spec.ts                  # seed shape + idempotent + don't-clobber + default-not-production
        '-- schema-parity.spec.ts
```

### Pattern 1: `configuration` generator (init-first, then edit `project.json`) -- GEN-01/02/04/08

**What:** An async devkit generator that (1) calls `init` to seed workspace caching, (2) reads the project config, (3) resolves the tsConfig, (4) collision-checks, (5) writes ONE target, (6) formats once.
**When to use:** This IS the `configuration` generator. Copy the `@nx/eslint:lint-project` skeleton exactly.
**Copy-source (verified):** `@nx/eslint/dist/src/generators/lint-project/lint-project.js:22-122` -- `lintProjectGeneratorInternal`:
```js
// Source: node_modules/@nx/eslint/dist/src/generators/lint-project/lint-project.js:22-122 (paraphrased to our shape)
async function configurationGenerator(tree, schema) {
  const tasks = [];
  // GEN-08: init FIRST, skipFormat:true so we format ONCE at the end
  const initTask = await initGenerator(tree, { skipFormat: true });
  if (initTask) { tasks.push(initTask); }               // init may return a no-op callback or void

  const projectConfig = readProjectConfiguration(tree, schema.project); // { root, projectType, targets, ... }
  const targetName = schema.targetName ?? 'typecheck';
  const tsConfig = resolveTsConfig(tree, projectConfig, schema);        // Pattern 2

  // GEN-04 collision: ours -> idempotent rewrite; non-ours -> throw
  const existing = projectConfig.targets?.[targetName];
  if (existing && existing.executor !== 'angular-typechecker:typecheck') {
    throw new Error(
      `Project "${schema.project}" already has a "${targetName}" target using executor ` +
      `"${existing.executor}". Choose a different --targetName or remove the existing target.`,
    );
  }

  projectConfig.targets ??= {};
  projectConfig.targets[targetName] = {
    executor: 'angular-typechecker:typecheck',
    options: { tsConfig },                               // workspace-root-relative path (see Pitfall 1)
  };
  updateProjectConfiguration(tree, schema.project, projectConfig);

  if (!schema.skipFormat) { await formatFiles(tree); }
  return runTasksInSerial(...tasks);
}
export default configurationGenerator;
```
Key facts proven from the copy-source: `@nx/eslint:lint-project` awaits `lintInitGenerator(tree, {...})` FIRST (line 29), pushes its callback (line 34), then `readProjectConfiguration` (line 42), mutates `projectConfig.targets['lint'] = { executor: ... }` (line 69), calls `updateProjectConfiguration(tree, options.project, projectConfig)` (line 117), guards `formatFiles` behind `!options.skipFormat` (line 118-120), and returns `runTasksInSerial(...tasks)` (line 121). `@nx/vitest:configuration` uses the identical init-first-with-`skipFormat:true` composition (`configuration.js:59-62`, `await init(tree, { skipFormat: true, ... })`). `[VERIFIED: node_modules]`

### Pattern 2: tsConfig resolution (solution-vs-flat) -- GEN-02

**What:** Decide which tsconfig path to write into `options.tsConfig`, reading the VIRTUAL TREE.
**Critical:** Read tsconfig files with devkit `readJson(tree, path)` (it strips comments -> JSONC-safe) and probe existence with `tree.exists(path)`. NEVER use `node:fs` inside a generator -- generators operate on the in-memory `Tree`. `[VERIFIED: nx/dist/src/generators/utils/json.d.ts -- "Reads a json file, removes all comments and parses JSON"]`
```js
function resolveTsConfig(tree, projectConfig, schema) {
  const root = projectConfig.root;                       // workspace-root-relative, e.g. "libs/foo"
  // 1. explicit override wins (see Open Question OQ-1 for the exact join semantics)
  if (schema.tsConfig) {
    return joinPathFragments(root, schema.tsConfig);     // recommended: interpret project-root-relative
  }
  // 2. solution tsconfig.json WITH references[] -> point at it (WALK-01 walks the leaves)
  const solution = joinPathFragments(root, 'tsconfig.json');
  if (tree.exists(solution)) {
    const json = readJson(tree, solution);
    if (Array.isArray(json.references) && json.references.length > 0) {
      return solution;
    }
  }
  // 3. flat-project fallback -> leaf by projectType + existence probe
  const leaf = projectConfig.projectType === 'application' ? 'tsconfig.app.json' : 'tsconfig.lib.json';
  const leafPath = joinPathFragments(root, leaf);
  if (tree.exists(leafPath)) { return leafPath; }
  // 4. clear error
  throw new Error(
    `Could not resolve a tsconfig for project "${schema.project}": no tsconfig.json with references[] ` +
    `and no ${leaf}. Pass --tsConfig explicitly.`,
  );
}
```
**Common case is the solution path (case 2).** A standard Nx project's `tsconfig.json` is a solution stub -- `{ "extends": "...", "files": [], "include": [], "references": [{ "path": "./tsconfig.lib.json" }, { "path": "./tsconfig.spec.json" }] }` `[VERIFIED: libs/typecheck-walk-consumer/tsconfig.json]`. So GEN-03's "spec checking is automatic via the walk" holds because the solution references the spec leaf.

### Pattern 3: `init` generator (seed `nx.json` targetDefaults) -- GEN-07

**What:** Idempotently seed the WALK-02 cacheable block under the UNSCOPED id, never clobbering an existing entry.
**Copy-source (verified):** `@nx/eslint/dist/src/generators/init/init.js:24-38` (`addTargetDefaults`) and `@nx/vitest/dist/src/generators/init/init.js:33-51` (`updateNxJsonSettings`) both use `readNxJson` -> `??=` guards -> `updateNxJson`.
```js
// Source: mirror of @nx/eslint init.js:24-38 + @nx/vitest init.js:33-51
const TYPECHECK_TARGET_DEFAULTS = {
  cache: true,
  outputs: [],
  inputs: [
    'default',
    '{projectRoot}/tsconfig*.json',
    '{projectRoot}/package.json',
    '{workspaceRoot}/tsconfig.base.json',
    '^default',
    { dependentTasksOutputFiles: '**/*.{d.ts,d.cts,d.mts,tsbuildinfo}', transitive: true },
    { externalDependencies: ['typescript', '@angular/compiler-cli'] },
  ],
};                                                        // COPY VERBATIM from nx.json (D-04); do NOT retype

async function initGenerator(tree, schema) {
  const nxJson = readNxJson(tree) ?? {};                  // readNxJson can return null; guard defensively
  nxJson.targetDefaults ??= {};
  // D-05 WHOLE-ENTRY don't-clobber (recommended -- see Pitfall 3):
  nxJson.targetDefaults['angular-typechecker:typecheck'] ??= TYPECHECK_TARGET_DEFAULTS;
  updateNxJson(tree, nxJson);
  if (!schema?.skipFormat) { await formatFiles(tree); }
}
export default initGenerator;
```
The seeded key is the UNSCOPED `angular-typechecker:typecheck` (D-04). In the dev repo `nx.json` BOTH the unscoped and the scoped `@angular-typechecker/angular-typechecker:typecheck` keys exist (the scoped one only because the dev repo aliases its own package); `init` seeds ONLY the unscoped published id, which is what a consumer's workspace uses. `[VERIFIED: nx.json:44-75]`

### Pattern 4: Packaging + registration -- GEN-05

**What:** Make both `nx g` and `nx add` discover the generators, and ship them in the tarball.
- **`generators.json`** (new, at package root; mirror `executors.json`):
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
  Note: `factory` uses the extensionless COMPILED path (`./src/generators/<name>/generator` -> resolves to the source `generator.ts` at lint time and the built `generator.js` at run time), exactly mirroring `executors.json`'s `implementation: ./src/executors/typecheck/executor`. `[VERIFIED: packages/angular-typechecker/executors.json]`
- **`package.json`:** add `"generators": "./generators.json"` (alongside the existing `"executors": "./executors.json"`) and add `"generators.json"` to the `files` allowlist (currently `["src", "executors.json", "README.md", "LICENSE"]`). `[VERIFIED: packages/angular-typechecker/package.json:29,34-39]`
- **`project.json` build assets:** add a glob mirroring the existing `executors.json` entry:
```json
{ "input": "./packages/angular-typechecker", "glob": "generators.json", "output": "." }
```
  The per-generator `schema.json` files ship via the existing `{ "input": "./packages/angular-typechecker/src", "glob": "**/!(*.ts)", "output": "./src" }` glob, and `schema.d.ts` via the `**/*.d.ts` glob -- no change needed. `[VERIFIED: packages/angular-typechecker/project.json:15-38]`
- **`generator.js`** is emitted by the `@nx/js:tsc` build (`tsconfig.lib.json` `include: ["src/**/*.ts"]`, and `exclude` drops `*.spec.ts`), so it lands at `dist/.../src/generators/<name>/generator.js`. `[VERIFIED: packages/angular-typechecker/tsconfig.lib.json]`

### Anti-Patterns to Avoid
- **Using `node:fs` to read/probe tsconfig inside the generator.** Generators mutate the virtual `Tree`; real-fs reads bypass it and break `createTreeWithEmptyWorkspace` tests. Use `tree.exists`/`readJson(tree, ...)`.
- **Writing a project-root-relative `tsConfig` into the target.** The executor resolves `options.tsConfig` WORKSPACE-root-relative (`joinPathFragments(context.root, options.tsConfig)`); the generated path must be workspace-root-relative to match (see Pitfall 1).
- **Adding an `ng-add` alias or an `nx` manifest key to satisfy `nx add`.** Neither is needed (see the nx-add contract section); adding `ng-add` implies an Angular-CLI schematic surface that is explicitly deferred (GEN-FUT-02).
- **Formatting inside `init` when called from `configuration`.** Pass `skipFormat: true` to the nested `init` and format ONCE at the end of `configuration` (first-party pattern).
- **`generateFiles` / template files.** Board D1 / D-08: config-edit only.

## The `nx add` -> `init` Discovery Contract (D-06, GEN-09) -- RESOLVED, HIGH confidence

This was the phase's single flagged RESEARCH-VERIFY. Traced end-to-end through the installed Nx 23.0.1 source. All three sub-questions answered authoritatively:

### (a) Does `nx add` invoke a generator named literally `init`, or via `ng-add` alias, or something else?
**Literally `init`.** `nx add <pkg>` -> `addHandler` (`nx/dist/src/command-line/add/add.js:21-33`) calls `initializePlugin` (line 84-107) which calls `runPluginInitGenerator(pkgName, workspaceRoot, ...)` (line 95). `runPluginInitGenerator` (`nx/dist/src/command-line/init/configure-plugins.js:57-83`) builds the command string:
```js
let command = `g ${plugin}:init ${verbose ? '--verbose' : ''}`;   // configure-plugins.js:58
```
It first probes the init schema via `getGeneratorInformation(plugin, 'init', workspaceRoot, {})` (line 60) to optionally append `--keepExistingVersions` / `--updatePackageScripts` if those schema properties exist; then runs the command as a child process via `runNxSync(command, ...)` (line 77). If the init generator does NOT exist, `getGeneratorInformation` throws and the function **noops** (returns, logging only under `NX_VERBOSE_LOGGING`): "No 'init' generator found in {plugin}. Skipping initialization." (lines 68-76). `[VERIFIED: nx/dist/src/command-line/add/add.js, nx/dist/src/command-line/init/configure-plugins.js]`

Resolution of the name `init` to our generator: `getGeneratorInformation` -> `readGeneratorsJson` (`nx/dist/src/command-line/generate/generator-utils.js:44-81`) reads `packageJson.generators ?? packageJson.schematics` (line 57), then `findFullGeneratorName('init', generatorsJson.generators)` (line 64) matches by `key === 'init'` OR `data.aliases.includes('init')` (lines 82-91). Our generator is KEYED `init`, so it matches directly.

### (b) Is `aliases: ["ng-add"]` REQUIRED, conventional, or irrelevant?
**IRRELEVANT to `nx add`.** The `nx add` path (`runPluginInitGenerator`) hardcodes `:init` and never consults the `ng-add` alias. The only function that inspects `ng-add`/`init` aliases -- `findInitGenerator` (`configure-plugins.js:158-168`, which checks `isAngularPluginInstalled()` + `generators['ng-add']` + `aliases.includes('init'|'ng-add')`) -- is **defined but never called anywhere in the Nx 23.0.1 dist** (a repo-wide `rg` for `findInitGenerator` returns only its definition line). `@nx/vitest`'s `init` carries `aliases: ["ng-add"]` for Angular-CLI `ng add @nx/vitest` compatibility (a separate Angular schematic-resolution path), NOT for `nx add`; `@nx/eslint`'s `init` OMITS the alias and still works with `nx add` -- direct proof the alias is not required. Since GEN-FUT-02 (Angular CLI `ng add`) is deferred, **do NOT add the `ng-add` alias.** `[VERIFIED: node_modules -- @nx/vitest/generators.json has the alias, @nx/eslint/generators.json does not; findInitGenerator is dead code]`

### (c) Does `package.json` need anything beyond the `generators` field?
**No.** `readGeneratorsJson` resolves the collection's generators via `packageJson.generators ?? packageJson.schematics` (`generator-utils.js:57`). The `generators` field alone (pointing at `generators.json`) suffices. No `nx` manifest key is needed -- the `"nx": "23.0.1"` seen in `@nx/vitest`/`@nx/eslint` package.json is a `devDependencies` entry, not a manifest field `[VERIFIED: @nx/vitest/package.json:95-97]`. No `schematics` field is needed (it is only a fallback when `generators` is absent). `[VERIFIED: nx/dist/src/command-line/generate/generator-utils.js:44-81]`

**Consequence for the plan:** register `init` by its literal key in `generators.json`, add the `generators` field to `package.json`, and ensure `generators.json` + `src/generators/init/generator.js` + `src/generators/init/schema.json` ship in the tarball (D-03). Nothing else is required for `nx add angular-typechecker` to seed `targetDefaults`. The e2e PROOF of this is Phase 15 (GE2E-03), not this phase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Read/parse `project.json` | Custom JSON read + path logic | `readProjectConfiguration(tree, name)` | Handles project.json/package.json config sources, inference, workspace layout |
| Write `project.json` | `tree.write(JSON.stringify(...))` | `updateProjectConfiguration(tree, name, cfg)` | Correct serialization + placement; round-trips config source |
| Read/write `nx.json` | Custom file read | `readNxJson(tree)` / `updateNxJson(tree, json)` | Canonical nx.json access; matches first-party inits |
| Read a JSONC tsconfig | `JSON.parse(tree.read(...))` (fails on comments) | `readJson(tree, path)` | Strips comments/trailing commas -> JSONC-safe |
| Join workspace paths on Windows | `node:path.join` (backslashes) | `joinPathFragments(...)` | POSIX-separator stability on Windows arm64 (same reason the executor uses it) |
| Format changed files | Custom Prettier invocation | `formatFiles(tree)` | Uses workspace Prettier config; no-ops when absent |
| Chain generator callbacks | Manual promise plumbing | `runTasksInSerial(...tasks)` | Standard devkit callback aggregation |
| Discover the `init` generator on install | Custom `nx add` shim | Register `init` by key in `generators.json` | Nx owns the `nx add`->`init` contract (see above) |
| In-memory test workspace | Bespoke `createFsTree` | `createTreeWithEmptyWorkspace()` | Public, sufficient for config-edit; FSTREE-01 deferred |

**Key insight:** Every capability this phase needs already exists in `@nx/devkit`, and every composition (init-first, targetDefaults `??=`, target write, format-once) is demonstrated by first-party plugins in `node_modules/`. Hand-rolling any of it re-introduces bugs Nx already solved and diverges from the idiom the Phase 15 e2e will exercise.

## Common Pitfalls

### Pitfall 1: Writing a project-root-relative `tsConfig` path
**What goes wrong:** The generated target's `options.tsConfig` points at the wrong file (or nothing) at run time.
**Why it happens:** The executor resolves a relative `tsConfig` WORKSPACE-root-relative (`normalize-options.ts:45-47`: `joinPathFragments(context.root, options.tsConfig)`), and the existing manual targets store workspace-root-relative paths (`"libs/typecheck-walk-consumer/tsconfig.json"`). If the generator writes a project-root-relative path (e.g. just `"tsconfig.json"`), the executor resolves it against the WORKSPACE root and misses.
**How to avoid:** Build the path as `joinPathFragments(projectConfig.root, 'tsconfig.json')` where `projectConfig.root` is already workspace-root-relative (e.g. `libs/foo`). This yields `libs/foo/tsconfig.json` -- correct. `[VERIFIED: libs/typecheck-walk-consumer/project.json, packages/angular-typechecker/src/executors/typecheck/normalize-options.ts:45-47]`
**Warning signs:** A generated target that fails to resolve its tsconfig, or a test asserting `tsConfig === 'tsconfig.json'` instead of the full workspace-relative path.

### Pitfall 2: Idempotency vs collision -- reading the WRONG field
**What goes wrong:** A re-run duplicates or clobbers, or a legitimate same-named non-ours target is silently overwritten.
**Why it happens:** Conflating "target name exists" with "OUR target exists." GEN-04/D-09 distinguish by EXECUTOR: `existing.executor === 'angular-typechecker:typecheck'` -> idempotent rewrite; any other executor -> throw a located error.
**How to avoid:** Branch on `existing.executor`, not on the target name alone. Compare against the UNSCOPED published id (what the generator writes), not the scoped dev id.
**Warning signs:** A test that overwrites a `@nx/js:tsc` `typecheck` target instead of erroring; a duplicate-target diff on re-run.

### Pitfall 3: `??=` granularity -- whole-entry vs sub-key (the D-05/GEN-07 tension)
**What goes wrong:** A partial merge produces an INCOHERENT WALK-02 block -- e.g. our load-bearing `inputs` (`default`-based) combined with a user's `cache: false`, or a user's `production`-based `inputs` left in place while we add `outputs: []`.
**Why it happens:** GEN-07's text says "per-key `??=` merge", and first-party inits DO use sub-key `??=` (`@nx/eslint init.js:26-29`: `targetDefaults['@nx/eslint:lint'] ??= {}; .cache ??= true; .inputs ??= [...]`; `@nx/vitest init.js:44-49` identical shape). But their blocks are simple and their sub-keys are independent.
**How to avoid (recommended):** Use WHOLE-ENTRY `??=` per D-05 -- `nxJson.targetDefaults['angular-typechecker:typecheck'] ??= { cache, outputs, inputs }`. Rationale: the WALK-02 block is a COHERENT UNIT (the `default`-not-`production` inputs, `outputs: []`, and `cache: true` are interdependent for correct cache-busting on spec edits). A sub-key merge could yield a block that neither we nor the user intended. Whole-entry fully satisfies GEN-07's "never clobber a customized entry." Document the first-party sub-key precedent but choose whole-entry.
**Warning signs:** A don't-clobber test that only checks `cache` but not `inputs`; a seeded block with mixed provenance.

### Pitfall 4: `readNxJson(tree)` can return `null`
**What goes wrong:** `TypeError: Cannot set property 'targetDefaults' of null`.
**Why it happens:** `readNxJson` is typed `NxJsonConfiguration | null`. `createTreeWithEmptyWorkspace` seeds an nx.json so it returns an object in tests, but defensive code should not assume it.
**How to avoid:** `const nxJson = readNxJson(tree) ?? {};` before mutating.

### Pitfall 5: `@nx/nx-plugin-checks` will lint `generators.json`
**What goes wrong:** `nx lint angular-typechecker` fails after adding `generators.json` if a `factory`/`schema` path does not resolve or a `schema.json` is malformed.
**Why it happens:** The `@nx/nx-plugin-checks` ESLint rule (ERROR, scoped to `**/package.json`) validates the plugin manifest INCLUDING the `generators` collection -- it reads `generators.json` and checks each generator's factory/schema resolvability. `[VERIFIED: packages/angular-typechecker/eslint.config.mjs:88-96; @nx/eslint-plugin/dist/src/rules/nx-plugin-checks.js references `generatorsJson`]`
**How to avoid:** Treat this as a FREE verification lever -- once `generators.json` + schemas are correct, `nx lint` proves the registration is valid. Mirror the extensionless `factory` path exactly as `executors.json` does its `implementation`.

## Code Examples

### `schema-parity.spec.ts` (per generator) -- mirror the executor tier
```typescript
// Source: mirror of packages/angular-typechecker/src/executors/typecheck/schema-parity.spec.ts
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const schemaPath = join(dirname(fileURLToPath(import.meta.url)), 'schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));

// The exact ConfigurationGeneratorSchema key set (schema.d.ts), sorted.
const EXPECTED_KEYS = ['project', 'skipFormat', 'targetName', 'tsConfig'];

describe('configuration schema.json <-> schema.d.ts parity', () => {
  it('declares exactly the ConfigurationGeneratorSchema properties', () => {
    expect(Object.keys(schema.properties).sort()).toEqual(EXPECTED_KEYS);
  });
  it('is a cli:nx, strict (additionalProperties:false) schema', () => {
    expect(schema.cli).toBe('nx');
    expect(schema.additionalProperties).toBe(false);
  });
});
```

### `configuration.spec.ts` -- in-memory substrate (GEN-06)
```typescript
// Source: standard devkit generator test idiom (createTreeWithEmptyWorkspace)
import { addProjectConfiguration, readNxJson, readProjectConfiguration, writeJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import configurationGenerator from './generator';

describe('configuration generator', () => {
  let tree: Tree;
  beforeEach(() => { tree = createTreeWithEmptyWorkspace(); });

  it('wires a solution-tsconfig target and seeds targetDefaults', async () => {
    addProjectConfiguration(tree, 'my-lib', { root: 'libs/my-lib', projectType: 'library', targets: {} });
    writeJson(tree, 'libs/my-lib/tsconfig.json', { files: [], include: [], references: [{ path: './tsconfig.lib.json' }] });

    await configurationGenerator(tree, { project: 'my-lib' });

    const cfg = readProjectConfiguration(tree, 'my-lib');
    expect(cfg.targets?.typecheck).toEqual({
      executor: 'angular-typechecker:typecheck',
      options: { tsConfig: 'libs/my-lib/tsconfig.json' },
    });
    // GEN-08: init ran -> targetDefaults seeded (unscoped id, default-not-production)
    const td = readNxJson(tree)?.targetDefaults?.['angular-typechecker:typecheck'];
    expect(td?.cache).toBe(true);
    expect(td?.outputs).toEqual([]);
    expect(td?.inputs).toContain('default');
    expect(td?.inputs).not.toContain('production');
  });

  it('falls back to the leaf tsconfig for a flat library (no references)', async () => {
    addProjectConfiguration(tree, 'flat-lib', { root: 'libs/flat-lib', projectType: 'library', targets: {} });
    writeJson(tree, 'libs/flat-lib/tsconfig.lib.json', { compilerOptions: {} }); // no solution tsconfig.json

    await configurationGenerator(tree, { project: 'flat-lib' });

    expect(readProjectConfiguration(tree, 'flat-lib').targets?.typecheck?.options)
      .toEqual({ tsConfig: 'libs/flat-lib/tsconfig.lib.json' });
  });

  it('is idempotent for our own target and errors on a non-ours collision', async () => {
    addProjectConfiguration(tree, 'my-lib', { root: 'libs/my-lib', projectType: 'library',
      targets: { typecheck: { executor: '@nx/js:tsc' } } });
    writeJson(tree, 'libs/my-lib/tsconfig.json', { references: [{ path: './tsconfig.lib.json' }] });
    await expect(configurationGenerator(tree, { project: 'my-lib' })).rejects.toThrow(/already has a "typecheck" target/);
  });
});
```

### `init.spec.ts` -- seed shape + idempotency + don't-clobber (GEN-07)
```typescript
import { readNxJson, updateNxJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import initGenerator from './generator';

describe('init generator', () => {
  let tree: Tree;
  beforeEach(() => { tree = createTreeWithEmptyWorkspace(); });

  it('seeds the WALK-02 cacheable block under the unscoped id with default-not-production', async () => {
    await initGenerator(tree, {});
    const td = readNxJson(tree)?.targetDefaults?.['angular-typechecker:typecheck'];
    expect(td?.cache).toBe(true);
    expect(td?.outputs).toEqual([]);
    expect(td?.inputs?.[0]).toBe('default');
    expect(td?.inputs).not.toContain('production');
  });

  it('is idempotent (a second run does not change the seeded block)', async () => {
    await initGenerator(tree, {});
    const first = JSON.stringify(readNxJson(tree)?.targetDefaults?.['angular-typechecker:typecheck']);
    await initGenerator(tree, {});
    expect(JSON.stringify(readNxJson(tree)?.targetDefaults?.['angular-typechecker:typecheck'])).toBe(first);
  });

  it('does not clobber a user-customized entry', async () => {
    const nxJson = readNxJson(tree)!;
    nxJson.targetDefaults ??= {};
    nxJson.targetDefaults['angular-typechecker:typecheck'] = { cache: false };
    updateNxJson(tree, nxJson);
    await initGenerator(tree, {});
    expect(readNxJson(tree)?.targetDefaults?.['angular-typechecker:typecheck']).toEqual({ cache: false });
  });
});
```

## Validation Architecture

> `nyquist_validation: true` -- section included so the orchestrator can derive VALIDATION.md.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 via `@nx/vitest:test` |
| Config file | `packages/angular-typechecker/vitest.config.*` (existing; specs auto-discovered) |
| Quick run command | `nx test angular-typechecker` (co-located `*.spec.ts` under `src/generators/**` auto-route in) |
| Full suite command | `nx run-many -t test` (or the 6-cell CI `test` matrix, unchanged) |

### Observable Behaviors to Sample (proves GEN-01..09; all in-plugin unit on `createTreeWithEmptyWorkspace`)
| Req ID | Behavior (observable) | Test Type | Automated Command | File Exists? |
|--------|-----------------------|-----------|-------------------|-------------|
| GEN-01/02 | `configuration` writes ONE target `{ executor: 'angular-typechecker:typecheck', options.tsConfig }` at the SOLUTION `tsconfig.json` (project has `references[]`) | unit | `nx test angular-typechecker` | ❌ Wave 0: `src/generators/configuration/configuration.spec.ts` |
| GEN-02 | Flat-project fallback: no solution `tsconfig.json`/no `references` -> target points at `tsconfig.lib.json` (library) / `tsconfig.app.json` (application) by `projectType` + existence probe | unit | same | ❌ Wave 0 (same file) |
| GEN-02 | `--tsConfig` override honored (verbatim/resolved) | unit | same | ❌ Wave 0 (same file) |
| GEN-02 | No resolvable tsconfig -> clear located error | unit | same | ❌ Wave 0 (same file) |
| GEN-04 | Re-run idempotent for OUR target (no dup, same shape); non-ours same-named target -> thrown located error | unit | same | ❌ Wave 0 (same file) |
| GEN-03 | (Covered indirectly) solution path points at `tsconfig.json` so WALK-01 walks the spec leaf -- assert the target points at the solution tsconfig, not a spec-specific target | unit | same | ❌ Wave 0 (same file) |
| GEN-07 | `init` seeds `targetDefaults['angular-typechecker:typecheck']` = WALK-02 block; `cache:true`, `outputs:[]`, inputs start with `default`, NOT `production` | unit | `nx test angular-typechecker` | ❌ Wave 0: `src/generators/init/init.spec.ts` |
| GEN-07 | `init` idempotent re-run (block unchanged) | unit | same | ❌ Wave 0 (same file) |
| GEN-07 | `init` does NOT clobber a pre-existing customized entry | unit | same | ❌ Wave 0 (same file) |
| GEN-08 | `configuration` invokes `init` (running `configuration` alone seeds `targetDefaults`) | unit | `nx test angular-typechecker` | ❌ Wave 0 (in `configuration.spec.ts`) |
| GEN-05 | Schema parity: `keys(schema.json.properties)` === `schema.d.ts` interface keys, per generator | unit | same | ❌ Wave 0: `configuration/schema-parity.spec.ts`, `init/schema-parity.spec.ts` |
| GEN-05 | `generators.json` registration valid (factory/schema paths resolve) | lint | `nx lint angular-typechecker` (`@nx/nx-plugin-checks`) | ✅ rule exists; passes once generators.json correct |
| GEN-05 | `package.json` `generators` field + `files` includes `generators.json`; build assets ship it | unit (manifest) | extend `src/package-manifest.spec.ts` OR a new packaging spec | ⚠️ Wave 0: add assertions (mirror executor manifest spec) |
| GEN-09 | `nx add` runs `init` on install (SEED on install) | **e2e -- Phase 15 (GE2E-03)** | Phase 15 install-e2e | Not this phase |

### Sampling Rate
- **Per task commit:** `nx test angular-typechecker` (fast; no `nx build` needed for these in-memory specs)
- **Per wave merge:** `nx test angular-typechecker` + `nx lint angular-typechecker` (the latter validates `generators.json` via `@nx/nx-plugin-checks`)
- **Phase gate:** full `test` suite green + `nx build angular-typechecker` green (proves the compiled `generator.js` emits) before `/gsd:verify-work`

### Wave 0 Gaps (test files to create before/with implementation)
- [ ] `src/generators/configuration/configuration.spec.ts` -- solution write, flat fallback, `--tsConfig`, no-resolvable error, idempotency, non-ours collision, init-invoked (GEN-01/02/03/04/08)
- [ ] `src/generators/configuration/schema-parity.spec.ts` -- key parity (GEN-05)
- [ ] `src/generators/init/init.spec.ts` -- seed shape, idempotent, don't-clobber, default-not-production (GEN-07)
- [ ] `src/generators/init/schema-parity.spec.ts` -- key parity (GEN-05)
- [ ] Packaging assertions -- extend `src/package-manifest.spec.ts` (or a new spec) to assert `package.json.generators === './generators.json'` and `files` includes `'generators.json'` (GEN-05)
- Framework install: none (Vitest + devkit/testing already present)

**End-to-end / tarball proof is explicitly Phase 15's scope (GE2E-01..03, GUARD-01), NOT this phase.** Phase 15 will also need to extend `e2e/angular-typechecker-install-e2e/src/tarball-audit.int.spec.ts` `REQUIRED_FILES` (currently `executors.json`, `src/executors/typecheck/schema.json`, `src/executors/typecheck/executor.js`, `src/index.js`, ...) with: `generators.json`, `src/generators/configuration/schema.json`, `src/generators/configuration/generator.js`, `src/generators/init/schema.json`, `src/generators/init/generator.js`. Noted for Phase 15; do not build here. `[VERIFIED: e2e/.../tarball-audit.int.spec.ts:41-49]`

## Security Domain

> `security_enforcement` absent in config (= enabled). Proportionate to a config-editing, dev-time generator with no network/runtime/user-input surface beyond the workspace files it edits. ASVS L1.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface (local dev generator) |
| V3 Session Management | no | -- |
| V4 Access Control | no | -- |
| V5 Input Validation | yes | Generator schema `additionalProperties:false` + Nx arg parsing; `--tsConfig`/`--project`/`--targetName` are the only inputs; validate `project` exists (devkit `readProjectConfiguration` throws on unknown) |
| V6 Cryptography | no | No crypto; no secrets touched |
| V12 Files/Resources | yes (light) | tsConfig path resolution stays within the workspace `Tree`; no arbitrary FS writes (config-edit only) |

### Known Threat Patterns for this generator (proportionate `<threat_model>` inputs for the planner)
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Clobbering/corrupting a consumer's `project.json` (destroying an existing target) | Tampering | GEN-04/D-09: non-ours same-named target throws a located error; ours is rewritten to the same coherent shape (idempotent). Test: collision + idempotency. |
| Corrupting `nx.json` `targetDefaults` (overwriting a user-customized cacheable block) | Tampering | GEN-07/D-05: whole-entry `??=` don't-clobber -- seed only when the key is absent. Test: don't-clobber. |
| `--tsConfig` path handling pointing the target outside the project / at a nonexistent file | Tampering / DoS (stale-green) | Resolve via `joinPathFragments(root, ...)` on the `Tree`; existence-probe the flat leaf; error clearly when nothing resolves. The engine's Phase 13 boundary guard is the run-time backstop for out-of-project references. |
| Malformed WALK-02 seed silently disabling spec hashing (`production` instead of `default`) -> stale PASS | Tampering (correctness) | Copy the block VERBATIM from `nx.json`; assert `inputs` contains `default` and NOT `production` (GEN-07 test). |

No `postinstall`/lifecycle script is added (the tarball audit already forbids install scripts); `nx add` runs `init` via the Nx CLI, not via an npm lifecycle hook.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@nx/devkit` | generator implementation | ✓ | 23.0.1 (pinned dependency) | -- |
| `@nx/devkit/testing` | generator unit tests | ✓ | 23.0.1 | -- |
| `nx` (CLI, incl. `add` command) | `nx add` contract (Phase 15 proof) | ✓ | 23.0.1 | -- |
| `vitest` | test run | ✓ | 4.1.9 | -- |
| `@nx/vitest`, `@nx/eslint` (copy-source templates) | read-only reference | ✓ | 23.0.1 | -- |
| Prettier | `formatFiles` | ✓ (workspace default) | 3.x | `formatFiles` no-ops if absent |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `--tsConfig` override is interpreted project-root-relative and joined with the project root before writing (OQ-1) | Pattern 2 / Open Questions | If a user expects verbatim workspace-relative, the generated path could be wrong; LOW (override is an escape hatch; the planner picks the semantics and the test pins it) |
| A2 | Whole-entry `??=` is preferred over sub-key `??=` for the targetDefaults seed (recommendation refining D-05) | Pitfall 3 | If the milestone later wants sub-key parity with first-party, a refactor of one guard line; LOW |
| A3 | `project` positional binds via `$default: { $source: "projectName" }` (first-party idiom) OR `{ $source: "argv", index: 0 }` (D-11); both valid | Pattern 4 / D-11 | Cosmetic CLI ergonomics; LOW (planner picks; schema-parity spec unaffected) |
| A4 | Generator specs auto-route into the existing `test` matrix (no `ci.yml`/vitest config change), same as executor/core specs | Validation Architecture | If discovery is scoped, a config tweak needed; LOW (executor + core specs already co-located and discovered) |

**All other claims are `[VERIFIED]` against `node_modules/` Nx 23.0.1 source or the shipped codebase, or `[CITED]` from the locked CONTEXT/REQUIREMENTS.**

## Open Questions

1. **OQ-1: `--tsConfig` override path semantics (A1).**
   - What we know: D-07 says "honored verbatim, project-root-relative." The executor resolves a relative `options.tsConfig` WORKSPACE-root-relative. The default (non-override) path is workspace-root-relative (`joinPathFragments(root, 'tsconfig.json')`).
   - What's unclear: whether "verbatim" means (a) write the user's string unchanged into `options.tsConfig` (user must supply a workspace-root-relative or absolute path), or (b) interpret it project-root-relative and `joinPathFragments(root, override)` before writing.
   - Recommendation: choose (b) -- interpret the override project-root-relative and join with the project root, because the user is naming a project and thinks in project-relative terms, and (b) yields a path the executor resolves correctly. Pin the chosen semantics in a `configuration.spec.ts` case. Honor an ABSOLUTE override verbatim. LOW risk; planner decides.

2. **OQ-2: `init` schema surface (D-11).**
   - What we know: first-party `init`s carry internal flags (`keepExistingVersions`, `updatePackageScripts`, `skipPackageJson`) that `nx add` probes for. Our `init` adds NO dependencies and needs none of them.
   - What's unclear: whether to expose `skipFormat` only, or an empty options object.
   - Recommendation: expose `skipFormat` (boolean, default false) so `configuration` can call `init(tree, { skipFormat: true })` and format once. Keep everything else out. Do NOT add `keepExistingVersions`/`updatePackageScripts` -- their presence would make `nx add` append flags for no benefit.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@nx/vite:test` executor + vite-bundled Vitest generators | Dedicated `@nx/vitest` package (`init` + `configuration`) | Nx 22.2 | Use `@nx/vitest` as the copy-source, not `@nx/vite` |
| Legacy `.eslintrc.json` + `implementation`-only manifests | Flat config + `factory`-keyed `generators.json` | Nx 16+/23 | `generators` use `factory`; `executors` use `implementation` |
| Alias-based `nx add` init discovery (`findInitGenerator` w/ `ng-add`) | Hardcoded `g <pkg>:init` + key/alias match in `getGeneratorInformation` | present in 23.0.1 (`findInitGenerator` now dead code) | Register `init` by literal key; no `ng-add` alias needed |

**Deprecated/outdated:**
- `createTreeWithEmptyV1Workspace` -- deprecated; use `createTreeWithEmptyWorkspace`. `[VERIFIED: nx/dist/.../create-tree-with-empty-workspace.d.ts]`
- Adding `ng-add` alias for `nx add` -- unnecessary in 23.0.1 (only relevant to the deferred Angular-CLI `ng add`).

## Sources

### Primary (HIGH confidence -- installed Nx 23.0.1 source, the authoritative version)
- `node_modules/nx/dist/src/command-line/add/add.js` -- `addHandler` -> `initializePlugin` -> `runPluginInitGenerator`.
- `node_modules/nx/dist/src/command-line/init/configure-plugins.js:57-83` -- `runPluginInitGenerator` builds `g ${plugin}:init`; `findInitGenerator` (158-168) is dead code.
- `node_modules/nx/dist/src/command-line/generate/generator-utils.js:44-91` -- `readGeneratorsJson` (`packageJson.generators ?? packageJson.schematics`) + `findFullGeneratorName` (key OR alias).
- `node_modules/@nx/eslint/dist/src/generators/lint-project/lint-project.js:19-122` -- the `configuration`-calls-`init` + target-write + format-once copy-source.
- `node_modules/@nx/eslint/dist/src/generators/init/init.js:24-38` + `node_modules/@nx/vitest/dist/src/generators/init/init.js:33-51` -- `readNxJson` -> `targetDefaults ??=` -> `updateNxJson` seed pattern.
- `node_modules/@nx/vitest/dist/src/generators/configuration/configuration.js:42-62` -- `await init(tree, { skipFormat: true })` composition + `readProjectConfiguration`.
- `node_modules/@nx/vitest/generators.json`, `node_modules/@nx/eslint/generators.json` -- `factory`-keyed registration; alias present/absent contrast.
- `node_modules/@nx/vitest/package.json`, `node_modules/@nx/eslint/package.json` -- `generators` field; no manifest `nx` key needed.
- `node_modules/nx/dist/src/generators/testing-utils/create-tree-with-empty-workspace.d.ts` -- `createTreeWithEmptyWorkspace(opts?): Tree`.
- `node_modules/nx/dist/src/generators/utils/json.d.ts` -- `readJson` strips comments (JSONC-safe).
- `node_modules/@nx/devkit/dist/index.d.ts` (re-exports `nx/src/devkit-exports`) -- devkit API surface (functions observed imported/called in the compiled first-party generators above).
- Shipped codebase: `packages/angular-typechecker/{executors.json,package.json,project.json}`, `src/executors/typecheck/{schema.json,schema.d.ts,schema-parity.spec.ts,normalize-options.ts}`, `src/package-manifest.spec.ts`, `nx.json:44-75`, `libs/typecheck-{consumer,walk-consumer}/{tsconfig.json,project.json}`, `eslint.config.mjs`, `packages/angular-typechecker/eslint.config.mjs`, `e2e/angular-typechecker-install-e2e/src/tarball-audit.int.spec.ts`.

### Secondary
- CONTEXT/REQUIREMENTS/ROADMAP locked decisions (`.planning/phases/14-.../14-CONTEXT.md`, `.planning/REQUIREMENTS.md` GEN-01..09/WALK-02, `.planning/ROADMAP.md` Phase 14, `.planning/phases/13-.../13-CONTEXT.md`, `.planning/phases/13.1-.../13.1-CONTEXT.md`).

### Tertiary (LOW confidence)
- None. No web fetch was required; the installed Nx source is the authoritative 23.0.1.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new packages; devkit APIs observed imported+called in compiled first-party generators.
- Architecture (generator shapes, composition): HIGH -- direct copy-source from `@nx/eslint`/`@nx/vitest` at the exact installed version.
- `nx add` -> `init` contract: HIGH -- traced end-to-end through Nx 23.0.1 source with line citations; `findInitGenerator` dead-code confirmed by repo-wide grep.
- tsConfig resolution (solution-vs-flat): HIGH on the common (solution) case (confirmed fixture shape); MEDIUM on the exact `--tsConfig` override semantics (OQ-1/A1 -- planner decision).
- Pitfalls: HIGH -- each grounded in shipped code (executor normalize-options, nx.json block, lint config).

**Research date:** 2026-07-02
**Valid until:** ~2026-08-01 for the Nx-source contracts (stable within the 23.x line; re-verify if the plugin bumps `@nx/devkit` to 24.x). The codebase anchors are valid until the referenced files change.

## RESEARCH COMPLETE
