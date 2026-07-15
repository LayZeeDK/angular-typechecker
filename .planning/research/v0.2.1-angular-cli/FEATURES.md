# Feature Research -- v0.2.1 Angular CLI workspace support

**Domain:** Angular CLI (`angular.json`) consumer surface for an existing Nx type-check plugin -- `ng add` / `ng generate` / `ng run`
**Researched:** 2026-07-10
**Confidence:** HIGH (mechanics verified against the installed `@nx/devkit@23.0.1` + `nx@23.0.1` source and Angular CLI docs; the Angular-cache-scope nuance is MEDIUM)

> Scope note: This is a SUBSEQUENT-milestone feature map. The engine, executor behavior,
> diagnostic set, options (`tsConfig`/`includeDeps`/`maxWarnings`/`failFast`/`strict`), output
> format, and exit-code semantics are ALL locked and shipped (`0.2.0`) and are NOT re-derived
> here (see `.planning/research/FEATURES.md` for that map). This file maps ONLY the NEW surface:
> what an Angular CLI (`angular.json`, non-Nx) consumer expects from `ng add` / `ng generate` /
> `ng run`, and exactly where Angular CLI diverges from the shipped Nx surface. Every row is
> tagged **[table stake]**, **[differentiator]**, or **[anti-feature]**, and the concrete
> Angular-CLI-vs-Nx differences (the milestone's testing focus) are called out explicitly.

## Angular CLI mechanics primer (verified facts the features rest on)

These are the load-bearing behaviors of the three Angular CLI entry points, verified against the
installed devkit source and Angular CLI docs. They are the substrate for the feature tables below.

1. **`ng add <pkg>`** = install the npm package, then run its `ng-add` schematic. The CLI discovers
   the schematic via the package's `package.json` `"schematics"` field pointing at a
   `collection.json`; the schematic **named `ng-add`** in that collection is the one `ng add` runs.
   Flags inherited for free: `--dry-run`, `--skip-confirmation`, `--force`, `--registry`,
   `--interactive`. Peer-dependency/version handling is the package manager's normal install
   resolution (the plugin's `@angular/compiler-cli@^22.0.0` + `typescript@>=6.0.0 <6.1.0` peers are
   honored exactly as under `npm install`). (Angular CLI docs, HIGH)

2. **`ng generate <collection>:<schematic> [args]`** resolves the collection from the installed
   package: reads `node_modules/<collection>/package.json` `"schematics"` -> opens `collection.json`
   -> finds the entry by name -> runs its `factory`. A `collection.json` schematic entry is
   `{ factory, schema, description }` (the same trio as Nx's `generators.json`). So
   `ng generate angular-typechecker:configuration my-app` is the Angular analog of
   `nx g angular-typechecker:configuration my-app`. (Angular CLI docs, HIGH)

3. **`ng run <project>:<target>[:<config>]`** invokes an Architect **builder**. The target lives in
   `angular.json` under `projects.<name>.architect.<target>` (a.k.a. `targets` in the v2 schema),
   shaped `{ "builder": "<pkg>:<builder-name>", "options": { ... } }`. The package registers builders
   via `package.json` `"builders"` -> `builders.json`, whose entries are
   `{ implementation, schema, description }`. A builder returns `BuilderOutput = { success: boolean; error?: string }`;
   Angular maps `success` to the process exit code (0 / non-zero). (Angular CLI docs, HIGH)

4. **`convertNxExecutor(executor)`** (verified in `@nx/devkit/dist/src/utils/convert-nx-executor.js`)
   wraps the SHIPPED Nx executor into an Architect builder via
   `require('@angular-devkit/architect').createBuilder(...)`. It reconstructs an `ExecutorContext`
   from the Angular `BuilderContext` (calling `retrieveProjectConfigurationsWithAngularProjects` so it
   reads `angular.json` projects, and `readNxJsonFromDisk` which tolerates a missing `nx.json`). The
   builder's return is the executor's `{ success }` -> `BuilderOutput`. **No behavior fork in the
   check itself** -- same core, same diagnostics, same exit semantics.

5. **`convertNxGenerator(generator)`** (verified in `@nx/devkit/dist/src/utils/invoke-nx-generator.js`)
   wraps the SHIPPED Nx generator into an Angular schematic Rule via a
   `DevkitTreeFromAngularDevkitTree` adapter that bridges the Angular schematics `Tree` to the Nx
   `Tree`. So `configuration`/`init` run unchanged under the Angular schematic engine.

6. **Nx auto-translates `executor` <-> `builder` and `targets` <-> `architect` when the workspace
   file is `angular.json`** (verified in `nx/dist/src/adapter/angular-json.js` `toOldFormat`/`toNewFormat`).
   When the `configuration` generator calls `updateProjectConfiguration` in an `angular.json`
   workspace, Nx writes `{ "builder": "angular-typechecker:typecheck" }` under `architect`, NOT
   `{ "executor": ... }` under `targets`. **The generator code does not change** -- the adapter does
   the rename. This is the single most important concrete difference.

## Feature Landscape

### Table Stakes (Angular CLI consumers expect these)

Missing any of these makes the Angular CLI surface feel broken or half-done next to `nx add`/`nx g`/`nx run`.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `ng add angular-typechecker` installs + runs an `ng-add` schematic | Every Angular library that "adds" itself does this (`ng add @angular/pwa`, `ng add @angular/material`); a package with no `ng-add` feels un-Angular | LOW-MEDIUM | **[table stake]** New first-party `ng-add` schematic registered in a `collection.json`; the Angular analog of the shipped `nx add` -> `init`. The FORK: what it wires (see Anti-Features + the diff table). |
| `ng generate angular-typechecker:configuration <project>` wires a `typecheck` target into `angular.json` | Parity with the shipped `nx g angular-typechecker:configuration`; Angular users generate config, not hand-edit `angular.json` | LOW | **[table stake]** Re-export the SHIPPED `configuration` generator via `convertNxGenerator`. `updateProjectConfiguration` auto-writes a `builder` target under `architect` (mechanic 6). |
| `ng generate angular-typechecker:init` available as a schematic | Symmetry with the Nx `init`; `ng add` composes it | LOW | **[table stake, forked behavior]** Re-exported via `convertNxGenerator`, but its BODY must fork on Angular CLI (no `nx.json` to seed -- see diff table + Anti-Features). |
| `ng run <project>:typecheck` runs the check and exits 0/non-zero | This is the whole point on Angular CLI -- the builder is how the check runs without Nx | LOW-MEDIUM | **[table stake]** Re-export the SHIPPED executor via `convertNxExecutor`; `BuilderOutput.success` maps to the exit code exactly like the Nx `{ success }` does. |
| Identical diagnostic set + output + exit codes to the Nx surface | An Angular CLI user must get the SAME complete check (TS + template + NG8xxx), same `formatDiagnostics` stdout, same non-zero-on-error | LOW (inherited) | **[table stake]** Falls out of the thin-adapter design -- the core is shared, so zero divergence. This is a correctness INVARIANT to test, not new code. |
| All shipped executor options exposed as builder options (`tsConfig`, `includeDeps`, `maxWarnings`, `failFast`, `strict`) | Angular CLI users expect the same knobs the README documents | LOW | **[table stake]** Same `schema.json` drives the builder (Architect validates builder options against a JSON schema, same as Nx). Reuse the shipped schema. |
| Works against real `angular.json` project shapes (app + library) | A tool that only handles apps is incomplete; Angular CLI workspaces have both `application` and `library` projects | LOW-MEDIUM | **[table stake]** The `configuration` generator's `tsConfig` resolution (solution `tsconfig.json` -> `references` walk, or `tsconfig.app.json`/`tsconfig.lib.json` fallback) already handles both; verify it holds against the `angular.json` project layout, which differs from Nx's. |
| `--dry-run` / `--skip-confirmation` on `ng add`; `--dry-run` on `ng generate` | Standard Angular CLI safety flags; users expect a preview | LOW (inherited) | **[table stake]** Free from the Angular CLI schematic engine; nothing to build, just do not break it. |
| Peer-dependency version enforcement on install (Angular 22 / TS 6) | `ng add` install must refuse or warn on an incompatible Angular/TS | LOW (inherited) | **[table stake]** Existing `peerDependencies` (`@angular/compiler-cli@^22.0.0`, `typescript@>=6.0.0 <6.1.0`) are honored by the package manager during `ng add`. No new work. |

### Differentiators (competitive advantage)

Aligned with the project Core Value: the complete Angular check, decoupled, everywhere the editor is not.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| One package, both worlds: Nx AND Angular CLI from a single install | Angular CLI users get the exact same tested engine Nx users have, with no separate build or codebase; nothing else offers the complete Angular check as an `ng run` builder | MEDIUM | **[differentiator]** Thin `convertNxExecutor`/`convertNxGenerator` adapters over the SAME shipped core -- not a second implementation. The differentiator is the ZERO-divergence guarantee. |
| Complete diagnostics (TS + template + extended NG8xxx) as an Angular CLI builder | `ng build` couples the check to emit and fast dev pipelines skip it; there is no standalone "complete Angular type-check" builder in the Angular CLI ecosystem | LOW (inherited) | **[differentiator]** The same core value proposition the Nx surface has, now reachable by non-Nx Angular workspaces. |
| Spec / Storybook coverage in the same `ng run` (via the solution-tsconfig walk) | The builder inherits the reference-walk, so `ng run app:typecheck` checks the spec leaf and Storybook stories the tsconfig declares -- without a second target | LOW (inherited) | **[differentiator]** Requires the `configuration` schematic to point at the solution `tsconfig.json` (the same rule it already applies), which the Angular CLI `references`-based tsconfig layout supports. |

### Anti-Features (deliberately NOT built)

Documented to prevent scope creep and to encode the milestone's explicit forks.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Seed an `nx.json` `targetDefaults` cacheable block on Angular CLI (what `init` does on Nx) | "`init` does it on Nx, so do it on Angular CLI for parity" | Angular CLI has NO `nx.json` and NO `targetDefaults`. Running the shipped `init` unchanged would CREATE an `nx.json` in a non-Nx workspace (`readNxJson` returns null -> `updateNxJson` writes the file), polluting it with Nx config the workspace cannot use. This is a false-parity trap -- there is nothing to cache. | Fork `init` on Angular CLI: detect the workspace has no `nx.json`/Nx and SKIP the caching seed entirely (no-op or a one-line notice). `ng add` composes this forked `init`. The caching value prop simply has no analog (see diff table). |
| Auto-wire a `typecheck` target into EVERY project during `ng add` | "One command should set up the whole workspace" | `ng add` should install + minimal setup, not silently rewrite every project's `angular.json` target block; that is surprising, hard to undo, and mirrors nothing the Nx surface does (Nx `add` runs `init` only, per-project wiring is `ng generate`) | `ng add` installs + runs the forked `init`; per-project wiring stays an explicit `ng generate angular-typechecker:configuration <project>`, exactly like the Nx split. |
| A hand-written `@angular-devkit/architect` builder | "Write a native Angular builder for the cleanest Angular integration" | Duplicates the shipped executor as a second implementation that can drift; two code paths for one check violates the zero-divergence invariant and doubles the test surface | Use `convertNxExecutor` (a current, non-deprecated `@nx/devkit` API) as a THIN re-export over the same core + Nx executor. Confirmed in `PROJECT.md` Out-of-Scope note and Key Decisions. |
| `createNodesV2`-style inferred/zero-config `typecheck` targets on Angular CLI | "Nx can infer targets; do it for Angular CLI too" | Target inference is an Nx project-graph concept with no Angular CLI equivalent; the Angular CLI reads `angular.json` literally with no plugin inference hook | Explicit `ng generate ...:configuration`. (Even on Nx, `createNodesV2` is deferred -- WALK-FUT-01.) |
| Machine-readable reporters (JSON / SARIF) for the builder | "CI wants machine output" | Already a project-wide non-goal in v0.x (see README + `.planning/research/FEATURES.md` GAP-2); adding it only on the Angular CLI surface would fork output behavior between the two surfaces | Ship the one `formatDiagnostics` output on BOTH surfaces; defer machine reporters project-wide. |
| Angular CLI Storybook setup support (`ng add @storybook/angular` tsconfig layout) | "My Angular CLI workspace uses Storybook via `angular.json`" | Already documented as explicitly UNSUPPORTED (README `## Storybook`): that layout wires Storybook tsconfigs through `angular.json` with no top-level `references` to walk | Unchanged non-goal; the builder checks what the pointed-at tsconfig declares, same as Nx. Do not special-case it. |
| A standalone `ng-add`-installed CLI binary | "Give me `angular-typecheck` on the PATH after `ng add`" | Standalone CLI is a separate deferred milestone that owns the literal OS exit code `2`; the Angular CLI surface is `ng run`, not a bin | Deferred per `PROJECT.md`; the Angular CLI entry point is the builder. |

## The concrete Angular-CLI-vs-Nx differences (the milestone's testing focus)

This is the headline deliverable for requirements: exactly where behavior diverges and must be tested.
Every row is verified against the installed source or Angular CLI docs.

| Dimension | Nx (shipped) | Angular CLI (v0.2.1) | Consequence for this tool |
|-----------|--------------|----------------------|---------------------------|
| Workspace file | `nx.json` + per-project `project.json` (or inferred) | Single `angular.json`, `projects.<name>.architect.<target>` | `updateProjectConfiguration` writes to `angular.json`; the substrate for integration tests differs (Nx `Tree` from `createTreeWithEmptyWorkspace` vs an `angular.json`-seeded tree). |
| Target field name | `"executor": "angular-typechecker:typecheck"` under `targets` | `"builder": "angular-typechecker:typecheck"` under `architect` | Nx's `toOldFormat` adapter renames `executor`->`builder` and `targets`->`architect` automatically on write (verified `angular-json.js`). Generator code is unchanged; the OUTPUT shape differs and must be asserted. |
| Install-time wiring | `nx add` -> runs `init` -> seeds `nx.json` `targetDefaults` cacheable block | `ng add` -> runs FORKED `init` -> **no `nx.json`, no caching seed** | The single genuine BEHAVIOR fork. `init` must detect the non-Nx workspace and skip the seed rather than create an `nx.json`. |
| Caching | Cacheable via `targetDefaults` (`cache:true`, `outputs:[]`, input hashing); warm re-runs skipped | No general task/computation cache. `.angular/cache` is builder-INTERNAL (Angular's own build/test incremental cache), NOT a result cache for an arbitrary custom builder | `init`'s caching value prop DOES NOT MAP. `ng run app:typecheck` re-executes every time. Document this; do not fake it. (Angular-cache-scope: MEDIUM confidence.) |
| Task orchestration | `nx run-many -t typecheck`, `nx affected -t typecheck`, `dependsOn: ["^typecheck"]` fan-out | `ng run` runs ONE target; no `affected`, no cross-project graph orchestration | The Storybook Composition `^typecheck` fan-out (v0.2.0) has NO Angular CLI analog. Multi-project runs are a user-scripted loop. Note as a limitation. |
| Generator/schematic factory shape | Nx generator `(tree: Tree, schema) => void\|callback`, native in `generators.json` | Angular schematic `(options) => Rule`, in `collection.json` | The SAME generator body runs via `convertNxGenerator`; a separate collection/registration points at the wrapped factory. Do not point the Angular `schematics` field at raw Nx generator factories -- the call shapes differ. |
| Executor/builder factory shape | Nx executor default-export `(options, ctx) => Promise<{success}>`, in `executors.json` | Architect builder `createBuilder(fn)` returning `BuilderOutput`, in `builders.json` | `convertNxExecutor` bridges them; it `require()`s `@angular-devkit/architect` at runtime (present in any Angular CLI workspace). Registration via `package.json` `"builders"`. |
| Package.json registration | `"executors"` + `"generators"` fields | ADD `"builders"` + `"schematics"` fields (keep the Nx ones) | The package must declare BOTH sets. Modern `@nx/*` plugins dropped the Angular fields (Nx-only); this milestone re-adds them for dual-surface support. |
| Discovery of the "add" entry | Nx runs the package's registered `init` on `nx add` | Angular runs the schematic literally named `ng-add` in the collection | Need a distinct `ng-add` collection entry (name is load-bearing) -- it is not the same registration channel as Nx's `init`. |

## Feature Dependencies

```
[ng-add schematic]  (table stake)
    +--requires--> [collection.json with an "ng-add" entry]
    +--requires--> [package.json "schematics" field]
    '--composes--> [FORKED init schematic]  (skip nx.json seed off-Nx)

[ng generate ...:configuration / :init]  (table stakes)
    +--requires--> [convertNxGenerator wrapper over the SHIPPED generators]
    +--requires--> [collection.json entries + package.json "schematics" field]
    '--relies-on-> [Nx angular-json adapter: executor->builder, targets->architect]  (automatic)

[ng run <project>:typecheck]  (table stake)
    +--requires--> [convertNxExecutor wrapper over the SHIPPED executor]
    +--requires--> [builders.json + package.json "builders" field]
    +--requires--> [@angular-devkit/architect present in the consumer workspace]  (given)
    '--relies-on-> [an architect target written by the configuration schematic]

[Real-OSS angular.json e2e]  (verification, not a feature)
    '--requires--> [all three entry points above wired + a real non-Nx Angular CLI repo]
```

### Dependency Notes

- **The `ng-add` schematic composes the FORKED `init`, not the Nx one.** On Nx, `init` seeds
  `nx.json` `targetDefaults`. On Angular CLI there is no `nx.json`; the shipped `init` unchanged
  would CREATE one. So `init` gains a workspace-kind branch (skip the seed when the workspace is not
  Nx). `ng-add` calls the forked `init`. This is the one place NEW logic (not just a wrapper) is
  required.
- **The generators/executor wrappers are thin and additive.** `convertNxGenerator`/`convertNxExecutor`
  re-export the SHIPPED code; the generator bodies (`configuration`, and the non-forked path of
  `init`) do not change. The Nx `angular-json` adapter handles `executor`->`builder` and
  `targets`->`architect` on write with no code change.
- **`ng run` depends on an architect target existing**, which is what the `configuration` schematic
  writes. Ordering for docs/e2e: `ng add` -> `ng generate ...:configuration <project>` -> `ng run <project>:typecheck`.
- **`@angular-devkit/architect` and `@angular-devkit/schematics` are runtime requirements of the
  conversion APIs.** Both are present in any Angular CLI workspace (transitively via `@angular/cli` /
  `@angular/build`), so no new hard dependency is added -- but the dependency-classification decision
  (peer? none? relied-upon-as-present?) is a STACK/ARCHITECTURE call, flagged here.

## MVP Definition

### Launch With (v0.2.1)

- [ ] `ng-add` schematic (`ng add angular-typechecker`) -- installs + runs the forked `init` -- table stake
- [ ] `configuration` re-exported as an Angular CLI schematic (`ng generate angular-typechecker:configuration <project>`) writing a `builder` target to `angular.json` -- table stake
- [ ] `init` re-exported as a schematic with the Angular CLI FORK (no `nx.json` caching seed) -- table stake + the one genuine fork
- [ ] Executor re-exported as an Architect builder via `convertNxExecutor` (`ng run <project>:typecheck`) with identical diagnostics/output/exit codes -- table stake
- [ ] `package.json` `"schematics"` + `"builders"` fields + `collection.json` + `builders.json` registration -- table stake (plumbing)
- [ ] Real-OSS `angular.json` e2e: tarball install -> `ng add` -> `ng generate` -> `ng run` -> assert diagnostics -- verification gate

### Add After Validation (later)

- [ ] `createNodesV2`/inference has no Angular analog -- stays Nx-only (WALK-FUT-01)
- [ ] Machine reporters (JSON/SARIF) -- project-wide deferral, both surfaces at once when it lands

### Future Consideration

- [ ] Standalone CLI binary (non-Nx, owns literal exit `2`) -- separate deferred milestone
- [ ] Older-Angular Angular CLI support -- follows the project-wide widening decision

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| `ng run` builder (`convertNxExecutor`) | HIGH | LOW | P1 |
| `configuration` schematic (`convertNxGenerator`) | HIGH | LOW | P1 |
| `init` schematic + Angular CLI fork (no nx.json seed) | HIGH | MEDIUM | P1 |
| `ng-add` schematic | MEDIUM-HIGH | LOW-MEDIUM | P1 |
| `package.json`/`collection.json`/`builders.json` registration | HIGH (enabler) | LOW | P1 |
| Real-OSS `angular.json` e2e | HIGH (gate) | MEDIUM | P1 |
| Multi-project run helper / docs (no `run-many` analog) | LOW | LOW | P3 |

## Analog Analysis: `nx add`/`nx g`/`nx run` vs `ng add`/`ng generate`/`ng run`

| Behavior | Nx (shipped) | Angular CLI (v0.2.1) | Our approach |
|----------|--------------|----------------------|--------------|
| Install + setup | `nx add` -> registered `init` -> seeds `nx.json` caching | `ng add` -> `ng-add` collection entry -> forked `init` (no caching seed) | Distinct `ng-add` entry; fork `init` on workspace kind |
| Per-project wiring | `nx g angular-typechecker:configuration <p>` -> `executor` target in `project.json`/`targets` | `ng generate angular-typechecker:configuration <p>` -> `builder` target in `angular.json`/`architect` | Same generator via `convertNxGenerator`; adapter renames on write |
| Run the check | `nx run <p>:typecheck` / `nx typecheck <p>`, cacheable, `affected`-aware | `ng run <p>:typecheck`, no cache, one target | Same executor via `convertNxExecutor`; document the no-cache reality |
| Output / exit code | `{ success }` -> exit code; `formatDiagnostics` stdout | `BuilderOutput { success }` -> exit code; same stdout | Identical -- shared core, zero divergence (test as an invariant) |
| Registration fields | `executors` + `generators` | `builders` + `schematics` (added) | Declare both sets in `package.json` |

## Sources

- Installed `@nx/devkit@23.0.1` `dist/src/utils/convert-nx-executor.js` -- HIGH: `convertNxExecutor` wraps the Nx executor via `@angular-devkit/architect` `createBuilder`; reads `angular.json` projects + tolerates missing `nx.json`.
- Installed `@nx/devkit@23.0.1` `dist/src/utils/invoke-nx-generator.js` -- HIGH: `convertNxGenerator` + `DevkitTreeFromAngularDevkitTree` bridge (Nx `Tree` <- Angular schematics `Tree`).
- Installed `nx@23.0.1` `dist/src/adapter/angular-json.js` (`toOldFormat`/`toNewFormat`) -- HIGH: automatic `executor`<->`builder` and `targets`<->`architect` (and `generators`<->`schematics`) rename keyed on the `angular.json` workspace format.
- Installed `@nx/{angular,eslint,js,vite}@23.0.1` `package.json` -- HIGH: modern Nx plugins declare only `executors`+`generators` (dropped the Angular `builders`/`schematics` fields); `@nx/angular` still ships an `ng-add` generator entry.
- Angular CLI `ng add` docs (angular.dev/cli/add) -- HIGH: install + run the package schematic; `--skip-confirmation`/`--dry-run`/`--force`/`--registry`/`--interactive`.
- Angular CLI library-schematics authoring (angular.dev/tools/cli/schematics-for-libraries) -- HIGH: `package.json` `"schematics"` -> `collection.json`; the reserved `ng-add` schematic name; `{ factory, schema, description }`; `ng generate <lib>:<schematic>` collection resolution.
- Angular CLI custom-builder authoring (angular.dev/tools/cli/cli-builder) -- HIGH: `package.json` `"builders"` -> `builders.json` (`{ implementation, schema, description }`); `createBuilder`/`BuilderContext`; `BuilderOutput { success, error? }`; `angular.json` `architect` target `{ "builder": "pkg:name", "options" }`; `ng run project:target`.
- Angular CLI cache docs (angular.dev/cli/cache) -- MEDIUM: `.angular/cache` is a disk cache for "cachable operations"; docs do not specify a general-purpose per-builder result cache (nuance: builder-internal, not an Nx-style computation cache).
- Existing project: `.planning/PROJECT.md` (v0.2.1 charter + forks), `.planning/research/FEATURES.md` (shipped v0.0.1 feature map), `packages/angular-typechecker/README.md`, `src/generators/{init,configuration}/generator.ts`, `src/executors/typecheck/executor.ts`, `package.json`, `executors.json`, `generators.json` -- HIGH: the exact shipped Nx surface being extended.

---
*Feature research for: v0.2.1 Angular CLI (`angular.json`) workspace support -- additive surface over the shipped Nx plugin*
*Researched: 2026-07-10*
