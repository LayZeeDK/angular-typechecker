# Architecture Research -- v0.2.1 Angular CLI workspace support

**Domain:** Re-exporting an existing Nx plugin's executor + generators as Angular CLI builders + schematics (`convertNxExecutor` / `convertNxGenerator`), additive-only beside the shipped Nx surface
**Researched:** 2026-07-10
**Confidence:** HIGH (bridge mechanics, the write-path fork, and the additive-safety precedence all verified against the installed `@nx/devkit@23.0.1` + `nx@23.0.1` source on disk; only the consumer-side Angular CLI resolution order is training-data + symmetry inference, MEDIUM)

## Headline finding (read first)

The two bridges are ASYMMETRIC, and the asymmetry is the whole milestone:

- **`convertNxExecutor(typecheckExecutor)` -> the builder works UNCHANGED.** The executor reads only `context.root` from `ExecutorContext` (via `normalize-options.ts`). `convertNxExecutor` synthesizes a full `ExecutorContext` from the Angular CLI `BuilderContext` -- setting `context.root = builderContext.workspaceRoot` and building `projectsConfigurations` via `retrieveProjectConfigurationsWithAngularProjects()` (an Angular-CLI-aware retrieval). Nothing the executor touches breaks on `angular.json`. This tier is a ~3-line re-export.

- **`convertNxGenerator(configurationGenerator)` -> the schematic HALF works.** The bridge wraps the `@angular-devkit/schematics` `Tree` in a `DevkitTreeFromAngularDevkitTree` adapter implementing the Nx `Tree` interface, so the generator runs. But the substrate divergence bites on WRITE: `readProjectConfiguration` HAS an `angular.json` read-polyfill, while `updateProjectConfiguration` has NO `angular.json` branch. The existing `configuration` generator therefore reads the project fine but CANNOT write the target back into `angular.json` -- it either throws (Angular app) or writes into the wrong file (Angular lib's `package.json` `nx` block). This forces an `angular.json`-aware write path in the shared generator. This is the crux design work.

Everything else (package layout, `ng-add`, the caching gap, build order) follows from those two facts.

---

## Bridge mechanics (verified against `@nx/devkit@23.0.1`)

### `convertNxExecutor` -> Angular Devkit Builder

Source: `node_modules/@nx/devkit/dist/src/utils/convert-nx-executor.js` (exported from `public-api.js`).

```js
function convertNxExecutor(executor) {
  const builderFunction = (options, builderContext) => {
    const nxJsonConfiguration = readNxJsonFromDisk(builderContext.workspaceRoot);
    const promise = async () => {
      const projectsConfigurations = { version: 2,
        projects: await retrieveProjectConfigurationsWithAngularProjects(
          builderContext.workspaceRoot, nxJsonConfiguration).then(/* map */) };
      const context = {                       // a synthesized ExecutorContext
        root: builderContext.workspaceRoot,
        projectName: builderContext.target?.project,
        targetName: builderContext.target?.target,
        target: builderContext.target?.target,
        configurationName: builderContext.target?.configuration,
        projectsConfigurations, nxJsonConfiguration,
        cwd: process.cwd(), projectGraph: null, taskGraph: null, isVerbose: false,
      };
      return executor(options, context);       // calls OUR executor unchanged
    };
    return toObservable(promise());            // Promise/AsyncIterable -> rxjs Observable
  };
  return require('@angular-devkit/architect').createBuilder(builderFunction);
}
```

- Returns a real `@angular-devkit/architect` Builder (via `createBuilder`), so it drops straight into a `builders.json` `implementation`.
- `require('@angular-devkit/architect')` and `require('rxjs')` are LAZY (inside the function body / `toObservable`), so they are only needed at builder-invocation time -- i.e. inside an Angular CLI workspace, where both are always present.
- `readNxJsonFromDisk` on a workspace with no `nx.json` returns an empty/default config (it does not hard-require the file); `retrieveProjectConfigurationsWithAngularProjects` is the function name that tells you this path is DESIGNED for `angular.json` workspaces.
- Our executor's only `ExecutorContext` dependency is `context.root` -> mapped from `workspaceRoot`. Verified in `normalize-options.ts` (`joinPathFragments(context.root, options.tsConfig)`) and `executor.ts` (no other context field is read). CONCLUSION: the builder is a faithful, unchanged re-export.

### `convertNxGenerator` -> Angular Devkit Schematic

Source: `node_modules/@nx/devkit/dist/src/utils/invoke-nx-generator.js` (exported as `convertNxGenerator` from `public-api.js`).

```js
function convertNxGenerator(generator, skipWritingConfigInOldFormat = false) {
  return (generatorOptions) => invokeNxGenerator(generator, generatorOptions);   // an Angular Rule factory
}
function invokeNxGenerator(generator, options, skipWritingConfigInOldFormat) {
  return async (tree /* @angular-devkit Tree */, context) => {
    // register a RunCallbackTask so a returned generator-callback can run post-schematic
    const root = /* engineHost.paths[1] ?? tree.root.path */;
    const adapterTree = new DevkitTreeFromAngularDevkitTree(tree, root, skipWritingConfigInOldFormat);
    const result = await generator(adapterTree, options);   // runs OUR generator on the ADAPTER tree
    if (typeof result === 'function') context.addTask(new RunCallbackTask(result));
  };
}
```

- Returns an Angular `Rule` factory `(options) => (tree, context) => Promise<void>` -- drops into a schematics `collection.json` `factory`.
- `DevkitTreeFromAngularDevkitTree` is a full adapter: it implements the Nx `Tree` surface (`root`, `children`, `delete`, `exists`, `isFile`, `listChanges`, `read`, `rename`, `write`, `changePermissions`) by delegating to the underlying `@angular-devkit/schematics` `Tree`. So `@nx/devkit` tree helpers (`readJson`, `writeJson`, `readProjectConfiguration`, `formatFiles`, ...) all operate against the Angular CLI tree transparently.
- A generator that returns a callback function becomes a post-schematic `RunCallbackTask` (this is how `installPackagesTask`-style deferred work would run). Our generators return `void`, so this path is unused.

### How the Angular CLI resolves + invokes the converted entry points

- `ng run <project>:typecheck` -> Architect reads the target's `builder` field (`"angular-typechecker:typecheck"`), resolves package `angular-typechecker`'s `package.json` `builders` field -> `builders.json` -> the `typecheck` entry -> `require()`s the extensionless `implementation` module -> uses its default export (the `createBuilder` result). SAME require()-based loading as Nx executors -> the builder inherits the CJS + `module: nodenext` constraint (GATE A) so the transitive `await import('@angular/compiler-cli')` is not downleveled.
- `ng generate angular-typechecker:configuration <project>` and `ng add angular-typechecker` -> the CLI reads `package.json` `schematics` field -> `collection.json` -> the named schematic's `factory` -> invokes the `Rule`. (MEDIUM confidence -- consumer-side resolution is the symmetric counterpart to the Nx path verified below; not re-verified against `@angular/cli` source this pass.)

---

## The workspace-substrate divergence (THE crux fork -- verified)

Source: `node_modules/nx/dist/src/generators/utils/project-configuration.js` and `.../nx-json.js`.

| `@nx/devkit` function our generators call | Behaviour on an `angular.json` (non-Nx) workspace | Evidence |
|---|---|---|
| `readProjectConfiguration(tree, project)` | WORKS. Falls through to a `// temporary polyfill to make sure our generators work for existing angularcli workspaces`: if `tree.exists('angular.json')`, reads it, `toNewFormat()` renames `architect`->`targets` and `builder`->`executor`, returns the project. | project-configuration.js L118-130, L259-286 |
| `getProjects(tree)` | WORKS (same polyfill, merges `angular.json` projects). | project-configuration.js L136-146 |
| `updateProjectConfiguration(tree, project, cfg)` | **BROKEN.** Writes `<root>/project.json` if it exists, else writes `<root>/package.json`'s `nx` block if that exists, else **THROWS** `Cannot update Project ...`. There is NO `angular.json` write branch. | project-configuration.js L50-60 |
| `readNxJson(tree)` | Returns `null` when no `nx.json` (generator guards `?? {}`). | nx-json.js L10-18 |
| `updateNxJson(tree, nxJson)` | **NO-OP** when no `nx.json` (guarded by `if (tree.exists('nx.json'))`). Does NOT create a stray file. | nx-json.js L23-42 |

### What this means for each existing entry point run through `convertNxGenerator`

- **`configuration` generator: does NOT work unchanged for the WRITE.** It calls `readProjectConfiguration` (fine) then `updateProjectConfiguration` (line 188 of `configuration/generator.ts`). On an Angular CLI **application** (no `project.json`, no per-project `package.json`) `updateProjectConfiguration` throws. On an Angular CLI **library** (`projects/<lib>/package.json` exists) it writes the target into that `package.json`'s `nx.targets` -- a location `ng run` never reads, so no runnable target lands in `angular.json` `architect`. Neither outcome wires the target. => the generator needs an `angular.json`-aware write branch.
- **`init` generator: harmlessly does nothing.** `readNxJson` -> `null` -> `{}`; `updateNxJson` -> no-op (no `nx.json`). No stray file, no error, no effect. This is CORRECT -- Angular CLI has no `targetDefaults`/caching engine, so there is nothing to seed.

---

## The init / caching-gap fork -- resolution

Nx side (shipped): `nx add` -> `init` seeds `nx.json` `targetDefaults["angular-typechecker:typecheck"]` with the cacheable block; `configuration` invokes `init` first. Angular CLI has NO analog -- no `nx.json`, no `targetDefaults`, no Nx cache. So the Angular CLI branch must:

1. **Wire the `typecheck` architect target into `angular.json`** at `projects.<name>.architect.<targetName>` with the Angular CLI target shape (`builder`, not `executor`):
   ```jsonc
   // angular.json
   "projects": { "my-app": { "architect": {
     "typecheck": {
       "builder": "angular-typechecker:typecheck",
       "options": { "tsConfig": "projects/my-app/tsconfig.app.json" }
     }
   }}}
   ```
   Write it via the SAME `@nx/devkit` `readJson`/`updateJson`/`writeJson` the generator already uses (they operate on the adapter tree) -- editing `angular.json` JSON directly. No new `@schematics/angular` or `@angular-devkit/core` workspace-util dependency is required for a direct JSON edit (though `@schematics/angular/utility` `updateWorkspace` is the more idiomatic alternative if a dep is acceptable).

2. **SKIP the Nx caching seed.** On the `angular.json` branch, do not invoke `init` (or invoke it -- it no-ops -- but gating is cleaner and avoids the redundant `formatFiles` round-trip).

### Where the branch lives -- Option A (RECOMMENDED) vs Option B

- **Option A -- ONE shared generator with a workspace-type check (`tree.exists('angular.json')`).** The existing `configuration` generator gains an early split: `angular.json` present -> write into `architect`, skip `init`; else -> the existing Nx path (`updateProjectConfiguration` + `init`). `readProjectConfiguration` stays shared (the polyfill covers both). `convertNxGenerator` then re-exports this SAME generator as the schematic for free. One code path, one test surface, DRY. RECOMMENDED.
- **Option B -- a separate Angular-CLI generator/schematic.** Duplicates resolution + collision logic; two files to keep in sync; drift risk. NOT recommended.

The workspace-type check is a one-liner and matches how Nx's own generators detect the substrate (they read `angular.json` via the same polyfill). Angular CLI vs Nx is a clean `tree.exists('angular.json')` fork because a non-Nx Angular CLI workspace has `angular.json` and no `nx.json`, while an Nx workspace has `nx.json` and `project.json` files (and no `angular.json`).

---

## Standard Architecture

### System Overview

```
                 CONSUMER INVOCATION
   Nx workspace                         Angular CLI (angular.json) workspace
   -----------                          ------------------------------------
   nx run p:typecheck                   ng run p:typecheck
   nx g angular-typechecker:configuration   ng generate angular-typechecker:configuration
   nx add angular-typechecker           ng add angular-typechecker
        |                                       |
        | package.json:                         | package.json:
        |   executors -> executors.json         |   builders   -> builders.json     (NEW)
        |   generators -> generators.json       |   schematics -> collection.json   (NEW)
        v                                       v
   +----------------------+           +------------------------------------------+
   | Nx entry points      |           | Angular CLI entry points (NEW, additive) |
   | (EXISTING, untouched)|           |                                          |
   |  executor: typecheck |           |  builder: convertNxExecutor(typecheck)   |
   |  gen: configuration  |           |  schematic: convertNxGenerator(config.)  |
   |  gen: init           |           |  schematic: convertNxGenerator(init)     |
   |                      |           |  schematic: ng-add (first-party Rule)    |
   +----------+-----------+           +---------------------+--------------------+
              |                                             |
              |   convertNxExecutor / convertNxGenerator    |
              |   (@nx/devkit@23.0.1 bridge)                |
              +----------------------+----------------------+
                                     |
                                     v
        +----------------------------------------------------------+
        | SHARED, UNCHANGED core + Nx executor + generators        |
        |  runTypecheck(CoreOptions) : the engine                  |
        |  typecheckExecutor(options, context)  <- reads context.root only
        |  configurationGenerator(tree, schema) <- NEEDS angular.json write branch
        |  initGenerator(tree, schema)          <- no-op on angular.json
        +----------------------------------------------------------+
```

### Component Responsibilities

| Component | Responsibility | New / Modified |
|-----------|----------------|----------------|
| `builders.json` | Maps `typecheck` builder name -> converted-builder module + reuses the executor `schema.json` | NEW (beside `executors.json`) |
| `src/builders/typecheck/builder.ts` | `export default convertNxExecutor(typecheckExecutor)` -- thin re-export | NEW (~3 lines) |
| `collection.json` (schematics) | Maps `ng-add` / `configuration` / `init` schematic names -> factories | NEW (beside `generators.json`) |
| `src/schematics/configuration/schematic.ts` | `export default convertNxGenerator(configurationGenerator)` | NEW (~2 lines) |
| `src/schematics/init/schematic.ts` | `export default convertNxGenerator(initGenerator)` (parity; no-op on CLI) | NEW (~2 lines) |
| `src/schematics/ng-add/schematic.ts` | First-party `@angular-devkit/schematics` Rule: ensure devDependency + guidance; optionally chain `configuration` when a `project` is passed | NEW (first-party, small) |
| `src/generators/configuration/generator.ts` | Add `tree.exists('angular.json')` fork: write `architect` target + skip `init` on CLI; existing Nx path unchanged | MODIFIED (additive branch) |
| `package.json` | Add `"builders": "./builders.json"` + `"schematics": "./collection.json"`; add both to `files`; add optional Angular-devkit peer deps | MODIFIED |
| `src/executors/typecheck/*`, `src/core/*`, `init` generator body | UNTOUCHED | unchanged |

---

## Recommended Project Structure

```
packages/angular-typechecker/
+-- package.json                 # MODIFIED: + builders, + schematics, + files entries, + peer deps
+-- executors.json               # EXISTING (untouched)
+-- generators.json              # EXISTING (untouched)
+-- builders.json                # NEW  { "builders": { "typecheck": { implementation, schema } } }
+-- collection.json              # NEW  { "schematics": { "ng-add", "configuration", "init" } }
+-- src/
|   +-- core/                    # EXISTING (untouched) -- runTypecheck engine
|   +-- executors/typecheck/     # EXISTING (untouched) -- executor.ts, normalize-options.ts, schema.json
|   +-- generators/
|   |   +-- configuration/
|   |   |   +-- generator.ts     # MODIFIED: angular.json write branch (Option A)
|   |   |   +-- schema.json      # EXISTING (reused by the schematic; $default argv is CLI-compatible)
|   |   +-- init/generator.ts    # EXISTING (untouched; no-op on angular.json)
|   +-- builders/                # NEW
|   |   +-- typecheck/
|   |       +-- builder.ts       #   export default convertNxExecutor(typecheckExecutor)
|   +-- schematics/              # NEW
|       +-- configuration/schematic.ts   #   convertNxGenerator(configurationGenerator)
|       +-- init/schematic.ts            #   convertNxGenerator(initGenerator)
|       +-- ng-add/
|           +-- schematic.ts             #   first-party Rule (devDep + guidance)
|           +-- schema.json              #   ng-add options (optional `project`)
|
+-- e2e/  (repo-level)
    +-- angular-typechecker-ng-cli-e2e/  # NEW: real angular.json workspace tarball e2e
```

### Structure Rationale

- **`builders.json` + `collection.json` are NEW SIBLINGS of `executors.json` + `generators.json`, never edits of them.** Additive-only is preserved at the file level.
- **`builders.json` reuses the executor `schema.json`** (`"schema": "./src/executors/typecheck/schema.json"`). The schema's Nx-only keys (`cli: "nx"`, `version: 2`, `$id`) are ignored by Architect's JSON-schema validator; `additionalProperties:false` + `required:["tsConfig"]` carry over. One schema, two registrations.
- **`src/builders/` and `src/schematics/` are new folders** so the converted re-exports don't clutter the existing executor/generator folders and so `tsconfig.lib.json`'s `include: ["src/**/*.ts"]` compiles them with zero config change. Both must be excluded-from-tests same as the rest.
- **`ng-add` is the only genuinely new first-party schematic;** everything else is a `convert*` one-liner + a JSON manifest.

---

## Additive-safety: the Nx surface is provably untouched (verified)

The concern: does adding `builders` + `schematics` to `package.json` double-register the converted collection under `nx g` / `nx run`?

- `nx run`: `executorsFile = packageJson.executors ?? packageJson.builders` -- Nx PREFERS `executors`. (nx `executor-utils.js` L76.) Since `executors` stays declared, `builders.json` is never read by Nx.
- `nx g`: `generatorsFile = packageJson.generators ?? packageJson.schematics` -- Nx PREFERS `generators`. (nx `generator-utils.js` L57.) Since `generators` stays declared, `collection.json` is never read by Nx.

So `builders.json`/`collection.json` are consumed ONLY by the Angular CLI; the Nx `nx run`/`nx g` surface is byte-for-byte the same behaviour. This is the mechanical guarantee behind the additive-only charter.

---

## Data Flow

### Angular CLI type-check run (builder)

```
ng run my-app:typecheck
   |
   v Architect reads angular.json target.builder = "angular-typechecker:typecheck"
   v resolves package.json.builders -> builders.json -> typecheck.implementation
   v require()s src/builders/typecheck/builder.js  (CJS, nodenext)  -> default export = createBuilder(fn)
   |
   v convertNxExecutor's builderFunction(options, builderContext):
   |    context.root = builderContext.workspaceRoot
   |    projectsConfigurations = retrieveProjectConfigurationsWithAngularProjects(...)  (reads angular.json)
   v typecheckExecutor(options, synthesizedContext)   <-- UNCHANGED executor
   |    normalizeOptions -> tsConfigPath = joinPathFragments(context.root, options.tsConfig)
   |    runTypecheck(coreOptions)  ->  await import('@angular/compiler-cli')  ...
   v { success } -> toObservable -> Architect BuilderOutput { success }
```

### Angular CLI configure (converted schematic, with the write fork)

```
ng generate angular-typechecker:configuration my-app
   |
   v collection.json -> configuration.factory -> convertNxGenerator(configurationGenerator)
   v invokeNxGenerator wraps the @angular-devkit Tree in DevkitTreeFromAngularDevkitTree
   v configurationGenerator(adapterTree, { project:"my-app" }):
   |    readProjectConfiguration(tree,"my-app")  -> angular.json polyfill -> project cfg
   |    resolveTsConfig(...)                       (shared, unchanged)
   |    IF tree.exists('angular.json'):            <-- NEW FORK (Option A)
   |        updateJson('angular.json', add projects.my-app.architect.typecheck = {builder, options})
   |        (skip init -- no targetDefaults analog)
   |    ELSE (Nx): updateProjectConfiguration(...) + initGenerator(...)   (existing path)
   |    formatFiles(tree)
   v tree changes flushed by the Angular schematics engine to disk (angular.json edited)
```

### `ng add`

```
ng add angular-typechecker
   |
   v @angular/cli installs the package (adds to devDependencies)
   v runs collection.json "ng-add" schematic (first-party Rule):
   |    - ensure angular-typechecker present in package.json devDependencies (idempotent)
   |    - log: "run `ng generate angular-typechecker:configuration <project>` to wire a target"
   |    - (optional) if opts.project provided, chain the configuration schematic
   v  NO caching seed (no nx.json / targetDefaults analog) -- the deliberate CLI-vs-Nx difference
```

---

## Architectural Patterns

### Pattern 1: Bridge-and-branch (the whole milestone in one sentence)

**What:** Re-export the executor with `convertNxExecutor` verbatim (it only needs `context.root`), and re-export the generators with `convertNxGenerator` PLUS a single `tree.exists('angular.json')` write-branch inside the shared `configuration` generator.
**When:** Whenever a substrate-reading generator (`readProjectConfiguration` polyfill OK) must ALSO write config back (`updateProjectConfiguration` has no `angular.json` path).
**Trade-offs:** One extra branch + a direct `angular.json` JSON edit in the generator; in exchange, one generator serves both Nx and Angular CLI with no duplication, and the builder is free.

### Pattern 2: Thin `convert*` re-export modules

**What:** `builder.ts` = `export default convertNxExecutor(typecheckExecutor)`; `schematic.ts` = `export default convertNxGenerator(configurationGenerator)`.
**When:** Every converted entry point.
**Trade-offs:** Trivial modules, but they MUST be built CJS under `module: nodenext` (same as the executor) so the transitive `await import()` survives -- do not let them land in an ESM/`commonjs`-downlevel path.

**Example:**
```typescript
// src/builders/typecheck/builder.ts  (the WHOLE builder)
import { convertNxExecutor } from '@nx/devkit';
import typecheckExecutor from '../../executors/typecheck/executor';

export default convertNxExecutor(typecheckExecutor);
```

### Anti-Pattern: hand-writing an `@angular-devkit/architect` builder

**What people do:** Author a bespoke `createBuilder` that re-implements option mapping + the compiler call.
**Why it's wrong:** Duplicates the executor's normalize/verdict logic, drifts from the Nx path, and re-introduces the CJS/ESM bridge by hand. PROJECT.md explicitly mandates the `convertNxExecutor` re-export, NOT a hand-written builder.
**Instead:** The 3-line re-export above.

### Anti-Pattern: calling `updateProjectConfiguration` on an Angular CLI workspace

**What people do:** Assume the converted generator writes `angular.json` transparently.
**Why it's wrong:** `updateProjectConfiguration` throws (app) or writes `package.json` `nx` (lib) -- verified in nx source. `ng run` never sees the target.
**Instead:** the `tree.exists('angular.json')` branch that edits `architect` directly.

---

## Packaging / dependency notes (must-do, easy to miss)

- **`package.json`:** add `"builders": "./builders.json"` and `"schematics": "./collection.json"`; add `builders.json` + `collection.json` to `files`. Keep `type: "commonjs"`, `main`/`types` unchanged.
- **`@nx/dependency-checks` will flag new imports.** The converted builder pulls in `@angular-devkit/architect` + `rxjs` at runtime (lazily, inside a CLI workspace); the `ng-add` schematic imports `@angular-devkit/schematics`. Declare these as **optional peerDependencies** (`peerDependenciesMeta: { "@angular-devkit/architect": { optional: true }, ... }`) -- they are always present in an Angular CLI workspace but absent in a pure-Nx consumer, and they must not be hard runtime deps. Alternatively add to the lint rule's `ignoredDependencies`. This is a real, gate-able task -- flag it in the builder + ng-add phases.
- **Schema compatibility:** the executor `schema.json` and the `configuration` `schema.json` (`$default: {$source:"argv", index:0}`) are already Angular-CLI-schematic/Architect-compatible (the `$default`/`argv` convention originates in Angular schematics). LOW-risk caveat: Angular's schema registry is draft-07-ish; `"$schema": "http://json-schema.org/schema"` (unversioned) generally validates, but confirm during the builder spike.

---

## Suggested build order

Ordered by dependency + risk (prove the mechanical bridge first, do the design-risk write-fork second, glue with ng-add, gate with real-OSS e2e last).

1. **Builder re-export.** `src/builders/typecheck/builder.ts` (`convertNxExecutor`) + `builders.json` + `package.json` `builders` field + optional Angular-devkit peer deps. Prove `ng run <project>:typecheck` runs against a minimal `angular.json` fixture and inherits GATE A (nodenext CJS require()-load + transitive `await import()`). LOWEST risk, independently testable, and a prerequisite for a runnable wired target. FIRST.
2. **`configuration` schematic + the `angular.json` write fork (crux).** Add the `tree.exists('angular.json')` branch to the shared generator (Option A), register `convertNxGenerator(configurationGenerator)` in `collection.json`, add the `schematics` package.json field. Integration-test both substrates: Nx (`project.json` unchanged) and Angular CLI (`architect` target written, no `nx.json` created). HIGHEST design risk. SECOND (depends on the builder for an end-to-end-runnable target).
3. **`init` schematic (parity) + first-party `ng-add`.** `convertNxGenerator(initGenerator)` for parity (no-op on CLI), and the first-party `ng-add` Rule (devDependency + guidance, optional `configuration` chain). This is the install entry point that ties it together. THIRD.
4. **Real-OSS end-to-end proof.** New `angular-typechecker-ng-cli-e2e` project: pack the tarball, `ng add` into a real cloned `angular.json` (non-Nx) workspace, `ng generate ...:configuration`, `ng run <project>:typecheck`, assert diagnostics (clean pass + planted error caught). Slow, gating, needs 1-3. LAST.

**Phasing implication:** the executor-unchanged / generator-write-fork asymmetry means phase 1 is nearly free and phase 2 carries essentially all the milestone's engineering + test weight -- flag phase 2 for the deepest research/testing.

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| `convertNxExecutor` returns an Architect Builder; builder works unchanged | HIGH | `convert-nx-executor.js` read directly; executor reads only `context.root` |
| `convertNxGenerator` returns a Rule via a Tree adapter | HIGH | `invoke-nx-generator.js` read directly |
| `readProjectConfiguration` reads `angular.json`; `updateProjectConfiguration` does NOT write it | HIGH | `project-configuration.js` L50-60, L118-146, L259-286 read directly |
| `init`/`updateNxJson` is a safe no-op on Angular CLI | HIGH | `nx-json.js` L23-42 read directly |
| Adding `builders`/`schematics` is additive-safe for the Nx surface | HIGH | nx `executor-utils.js` L76 + `generator-utils.js` L57 (`?? ` precedence) |
| Angular CLI consumer resolution of `builders`/`schematics`/`ng-add` | MEDIUM | Symmetric to verified Nx path; not re-read from `@angular/cli` source this pass |
| Schema.json (executor + generator) is Architect/schematic-compatible | MEDIUM | `$default`/argv is an Angular convention; unversioned `$schema` is a LOW-risk caveat to confirm in the builder spike |

---

## Sources

- `node_modules/@nx/devkit@23.0.1/dist/src/utils/convert-nx-executor.js` + `invoke-nx-generator.js` + `public-api.{js,d.ts}` -- the bridge implementations + exports. HIGH.
- `node_modules/nx@23.0.1/dist/src/generators/utils/project-configuration.js` + `nx-json.js` -- `readProjectConfiguration` angular.json polyfill, `updateProjectConfiguration` no-angular.json-branch, `updateNxJson` no-op-when-absent. HIGH.
- `node_modules/nx@23.0.1/dist/src/command-line/run/executor-utils.js` (L76) + `command-line/generate/generator-utils.js` (L57) -- `executors ?? builders` / `generators ?? schematics` precedence proving additive safety. HIGH.
- Repo source: `packages/angular-typechecker/{package.json,executors.json,generators.json}`, `src/executors/typecheck/{executor.ts,normalize-options.ts,schema.json}`, `src/generators/{configuration/generator.ts,configuration/schema.json,init/generator.ts}` -- what the executor/generators actually read + write. HIGH.
- `.planning/PROJECT.md` (v0.2.1 charter + Key Decisions) + `.planning/research/ARCHITECTURE.md` (v0.0.1 core-vs-adapter split this builds on). HIGH.

---
*Architecture research for: v0.2.1 Angular CLI workspace support (additive-only)*
*Researched: 2026-07-10*
</content>
</invoke>
