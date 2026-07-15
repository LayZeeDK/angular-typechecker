# Phase 22: `configuration` schematic + the `angular.json` write-fork - Research

**Researched:** 2026-07-10
**Domain:** Nx-devkit generator forking for an Angular CLI (`angular.json`) write path; leaf-set discovery; additive schematics manifest wiring
**Confidence:** HIGH (every load-bearing claim verified against installed `nx@23.0.1` source, the repo's shipped generator, and the two real substrates on disk)

## Summary

Phase 22 adds ONE early `tree.exists('angular.json')` fork to the shipped shared `configuration` generator so that, on an Angular CLI workspace, it writes a per-project `typecheck` architect target directly into `angular.json` with `tsConfig: [buildLeaf, specLeaf]` -- while the Nx path (`updateProjectConfiguration` + init-first, single-string solution `tsConfig`) stays byte-unchanged. The engineering weight is concentrated in exactly two places: (1) the leaf-set discovery strategy (RF-01), and (2) the direct `updateJson('angular.json', ...)` write with mirrored collision/idempotency semantics. Everything else -- the `convertNxGenerator` re-export, the new `collection.json`, the `schematics` package.json field, and the `generators ?? schematics` regression assertion -- is a thin additive layer with zero new production dependency.

The design is LOCKED by CONTEXT (D-01..D-07); the one genuinely open question, RF-01 (how the CLI branch discovers `[buildLeaf, specLeaf]`), is resolved decisively below against the two real substrates. **The empirical evidence flips the CONTEXT starting hypothesis:** Approach A (projectType-convention + existence-probe) is the correct primary strategy, and Approach B (read the project's own architect targets) is NOT a reliable fallback -- because the standard Angular library builder (`@angular/build:ng-packagr`) carries no `tsConfig` in `build.options` at all (it lives under `configurations`), so B silently misses the library build leaf.

**Primary recommendation:** Add a new `resolveTsConfigLeaves(tree, projectConfig, schema): string[]` helper alongside (never modifying) `resolveTsConfig`, using projectType-convention + `tree.exists` probing: `application -> <root>/tsconfig.app.json`, `library -> <root>/tsconfig.lib.json`, plus `<root>/tsconfig.spec.json`; drop a missing leaf, emit the single available leaf when only one exists, throw only when the array would be empty. Write it into `angular.json#projects.<project>.architect.<targetName>` via `updateJson`, collision-checked by the `builder` id, idempotent-rewriting like the shipped Nx path. Do NOT build Approach B speculatively; the shared `--tsConfig` override already covers exotic layouts.

<user_constraints>
## User Constraints (from 22-CONTEXT.md)

### Locked Decisions (do NOT re-open; verify feasibility only)

- **D-01 (write-fork location):** ONE shared `configuration` generator with an early `tree.exists('angular.json')` fork (Architecture Option A). CLI branch -> write the target into `angular.json` at `projects.<project>.architect.<targetName>`; Nx branch -> the EXISTING path (`updateProjectConfiguration` + init-first), byte-unchanged. Option B (a separate Angular-CLI generator) is REJECTED. `convertNxGenerator(configurationGenerator)` re-exports the same generator.
- **D-02 (CLI target shape):** `{ "builder": "angular-typechecker:typecheck", "options": { "tsConfig": [<buildLeaf>, <specLeaf>] } }` -- Angular CLI vocabulary (`builder`, not `executor`), same id string as the executor, `tsConfig` as an ARRAY of the project's leaves. No emitted per-project solution tsconfig; no directory-boundary change.
- **D-03 (how angular.json is written):** Edit `angular.json` via `@nx/devkit` `readJson`/`updateJson` (they operate transparently on the `DevkitTreeFromAngularDevkitTree` adapter tree). NOT `updateProjectConfiguration` (throws / mis-writes off-Nx). NOT `@schematics/angular` `updateWorkspace` (would add a dependency). ZERO new production dependency.
- **D-04 (init gating on CLI branch):** The CLI branch does NOT invoke the Nx `init` generator; gate it out explicitly. The Nx branch KEEPS the init-first composition unchanged.
- **D-05 (idempotency + collision + targetName):** Reuse the shipped semantics on the CLI branch: default `targetName = typecheck`; reject empty/whitespace `--targetName`; collision-check by the target's `builder` id (`angular-typechecker:typecheck`); a same-named NON-ours target throws a clear located error; a re-run of OUR target is idempotent, preserving user-added keys (`configurations`) + extra `options`, re-asserting only the id + resolved `tsConfig`.
- **D-06 (additive-safety / Nx-surface regression):** `collection.json` + the `package.json` `schematics` field + a `files` whitelist entry are NEW SIBLINGS of `generators.json` / the `generators` field. Nx resolves `generators ?? schematics`, so the new collection is Nx-invisible. Add a `generators ?? schematics` regression assertion mirroring Phase 21's `executors ?? builders` spec.
- **D-07 (test substrate):** Integration-test BOTH substrates using an `angular.json`-SEEDED test tree (NOT bare `createTreeWithEmptyWorkspace`): (a) Nx tree path still writes a single-string solution `tsConfig`, byte-unchanged; (b) angular.json tree path writes the `architect` target with the leaf ARRAY, creates NO stray `nx.json`, is idempotent + collision-safe. Prove COV-01 per-project scoping at the unit/integration tier here; the fresh-scaffold `ng g library` real proof is Phase 24 (ACV-02).

### Claude's Discretion
- Plan decomposition (how many plans; whether the write-fork + `collection.json` + regression assertion split across plans or land as one).
- Whether the CLI-branch leaf resolution is a NEW helper alongside `resolveTsConfig` or an added return-mode of it. **Keep the Nx-branch `resolveTsConfig` output byte-identical either way.** (This research recommends a new helper -- see RF-01.)

### Deferred Ideas (OUT OF SCOPE for Phase 22)
- `init` schematic parity + first-party `ng-add` auto-wire-all + optional-peer classification -> Phase 23 (ACS-03, NGADD-01, ACP-01).
- Real-OSS tarball e2e + scaffolded automated e2e + additive-only audit + docs -> Phase 24 (ACV-01/02/03, ACP-02, ACD-01).
- The builder + the `tsConfig: string | string[]` engine -> ALREADY SHIPPED in Phase 21. Phase 22 CONSUMES them.
- Any hand-written `@angular-devkit/schematics` Rule for `configuration` (charter: thin `convertNxGenerator` re-export only).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACS-01 | `ng generate angular-typechecker:configuration <project>` wires ONE per-project `typecheck` architect target into `angular.json` with `tsConfig: [<build leaf>, <spec leaf>]` (via `tree.exists('angular.json')` write-fork; config-edit-only, no emitted file; idempotent + collision-safe). | Write-fork design (this doc, "The write-fork") + RF-01 leaf discovery + mirrored collision/idempotency from the shipped generator (`generator.ts` L163-188). |
| ACS-02 | The Nx `configuration` generator path stays behavior-unchanged -- one shared generator with the workspace-type fork; the Nx path still writes a single-string solution `tsConfig`. | Existing `configuration.spec.ts` stays green untouched; the fork is an early branch that leaves the current body verbatim as the else path. |
| ACS-04 | `collection.json` + the `package.json` `schematics` field are added additively; `nx g angular-typechecker:configuration` still resolves unchanged (regression assertion: `generators ?? schematics`). | Verified `generator-utils.js` L57 `packageJson.generators ?? packageJson.schematics`; mirror `nx-surface-regression.spec.ts`; add `collection.json` to build `assets` + `files`. |
| COV-01 | A per-project `typecheck` target type-checks that project's COMPLETE leaf set (application+spec, or library+spec) and ONLY that project's leaves (no cross-project bleed) -- proven by scaffolding `ng g library` and asserting per-project scoping. | Leaf array `[buildLeaf, specLeaf]` scoped by `projectConfig.root` (RF-01); Phase-22 unit proof = written array equals that project's leaves only; the real `ng g library` scaffold proof is Phase 24 (ACV-02). |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Workspace-type detection (Nx vs Angular CLI) | Shared generator (`generator.ts`) | -- | The one place both consumers converge; `tree.exists('angular.json')` is the clean discriminator (Nx has `nx.json` + `project.json`, no `angular.json`; Angular CLI has `angular.json`, no `nx.json`). |
| Leaf-set discovery (`[buildLeaf, specLeaf]`) | Shared generator (build-time resolution) | Virtual `Tree` (`tree.exists`) | Leaves are resolved at generate-time from `projectConfig.root` + `projectType` and written into the target; NO runtime `angular.json`/tsconfig parsing in the builder. |
| `angular.json` write | Shared generator via `@nx/devkit` `updateJson` on the adapter tree | -- | `updateJson` operates transparently on `DevkitTreeFromAngularDevkitTree`; direct JSON edit needs zero new dependency (D-03). |
| Nx generator path (unchanged) | Nx devkit (`updateProjectConfiguration` + `init`) | -- | Byte-unchanged else branch; the current generator body verbatim (ACS-02). |
| Schematic discovery + invocation | Angular CLI + `collection.json` manifest | `convertNxGenerator` bridge (`@nx/devkit`) | `ng generate` reads `package.json.schematics -> collection.json -> factory`; the factory is `convertNxGenerator(configurationGenerator)`. |
| Additive-safety (Nx surface unchanged) | `package.json` field precedence | `nx-plugin-checks` / regression spec | Nx reads `generators ?? schematics`; keeping `generators` declared makes `collection.json` Nx-invisible (ACS-04). |
| Type-check execution | Builder/executor (Phase 21) | Engine `tsConfig: string[]` (ENG-01) | CONSUMED, not modified: the written array is executed by the shipped builder/engine. |

## Standard Stack

### Core (all already installed / pinned -- ZERO new packages this phase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nx/devkit` | `23.0.1` (pinned dependency) | `convertNxGenerator`, `readJson`/`updateJson`/`readProjectConfiguration`/`formatFiles`, `joinPathFragments`, `Tree` | Already the plugin's only devkit dependency; exports both the bridge and the tree helpers used on both branches. |
| `nx` | `23.0.1` (transitive via devkit peer) | `readProjectConfiguration` angular.json polyfill; `generators ?? schematics` precedence | Verified in installed source; not declared by the plugin. |
| `vitest` | `4.x` (dev) | Test runner (fast tier + integration tier) | The repo's locked runner via `@nx/vitest:test`. |

### Supporting (dev-only, already present; used ONLY if the optional SchematicTestRunner tier is chosen)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@angular-devkit/schematics` (+ `/testing`) | present in `node_modules` (transitive) | `SchematicTestRunner`/`UnitTestTree` round-trip through the real `collection.json` factory | OPTIONAL: only if a plan wants to prove `convertNxGenerator` wiring through the schematics engine. The CI-authoritative write-fork test does NOT need it (see Validation Architecture). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct `updateJson('angular.json', ...)` | `@schematics/angular/utility` `updateWorkspace` | More idiomatic, but adds a production dependency -- REJECTED by D-03 (zero-new-dep charter). |
| New `resolveTsConfigLeaves` helper | Add an array return-mode to `resolveTsConfig` | Both allowed by discretion; a NEW helper keeps the Nx-branch output provably byte-identical (no regression risk to `resolveTsConfig`'s single-string contract). RECOMMENDED. |
| Generator-direct write-fork test | `SchematicTestRunner` end-to-end | Direct test is faster, needs zero new imports, runs in the `nx test` loop; the full schematics-engine round-trip is better spent in Phase 24's real `ng generate` e2e. |

**Installation:** none. Phase 22 installs no external package.

## Package Legitimacy Audit

**N/A -- Phase 22 installs no external packages.** The `configuration` schematic module imports only `@nx/devkit` (already a pinned dependency) and the local generator. The optional test tier would import `@angular-devkit/schematics/testing`, a first-party Angular package already resolvable in `node_modules` and never shipped (spec files are excluded from `tsconfig.lib.json` and the tarball). No slopcheck run required; no new registry surface introduced.

## RF-01 (the primary research question) -- RESOLVED DECISIVELY

**Question:** How does the Angular CLI branch determine a project's `[buildLeaf, specLeaf]` for `angular.json#projects.<project>`?
**Verdict: Approach A (projectType-convention + existence-probe). Approach B is rejected as a fallback. This FLIPS the CONTEXT starting hypothesis ("prefer B, fall back to A").**

### The two substrates (read from disk 2026-07-10)

**Substrate 1 -- `D:\projects\github\bluehalo\ngx-leaflet` @ 818e9ae (existing on-stack repo):** [VERIFIED: local clone]
- Root `tsconfig.json` is a PLAIN BASE config (real `compilerOptions` + `angularCompilerOptions`, NO `files: []` / `references[]`). Leaves `extends` it. It is NOT solution-style.
- App `ngx-leaflet-demo` (`projectType: application`, `root: ""`): `architect.build` = `@angular/build:application`, `options.tsConfig = "tsconfig.app.json"`; `architect.test` = `@angular/build:karma`, `options.tsConfig = "tsconfig.spec.json"`. Files `tsconfig.app.json` + `tsconfig.spec.json` exist at root.
- Lib `ngx-leaflet` (`projectType: library`, `root: "projects/ngx-leaflet"`): `architect.build` = `@angular/build:ng-packagr`, **`options = { project: "projects/ngx-leaflet/ng-package.json" }` -- NO `tsConfig` key in `options`.** The build tsConfig lives under `configurations.development.tsConfig` (`.../tsconfig.lib.json`) and `configurations.production.tsConfig` (`.../tsconfig.lib.prod.json`). `architect.test.options.tsConfig = "projects/ngx-leaflet/tsconfig.spec.json"`. Files `tsconfig.lib.json` + `tsconfig.spec.json` exist under the lib root.

**Substrate 2 -- freshly scaffolded `npm init @angular@latest` + `ng g library` (Angular 22):** [CITED: v0.2.1 SUMMARY.md CORRECTION point 1, verified against a generated Ng22 workspace]
- Root `tsconfig.json` IS solution-style (`files: []` + `references -> tsconfig.app.json + tsconfig.spec.json`); `ng g library` APPENDS the lib's `tsconfig.lib.json` + `tsconfig.spec.json` to that SAME root `references[]`.
- App root `""` with `tsconfig.app.json` + `tsconfig.spec.json`; lib under `projects/<lib>/` with `tsconfig.lib.json` (+ `tsconfig.lib.prod.json`) + `tsconfig.spec.json`. The lib build target is `ng-packagr`, same shape as Substrate 1 (tsConfig under `configurations`, not `options`).

### Why Approach A wins

| Approach | App build leaf | App spec leaf | Lib build leaf | Lib spec leaf | Verdict |
|----------|---------------|---------------|----------------|---------------|---------|
| **A: convention + probe** (`app->tsconfig.app.json`, `lib->tsconfig.lib.json`, `+tsconfig.spec.json`, each `tree.exists`-probed against `<root>/`) | `tsconfig.app.json` OK | `tsconfig.spec.json` OK | `projects/ngx-leaflet/tsconfig.lib.json` OK | `projects/ngx-leaflet/tsconfig.spec.json` OK | **Works on BOTH substrates; matches 21-CONTEXT D-06 expected arrays exactly.** |
| B: read architect targets (`build.options.tsConfig` / `test.options.tsConfig`) | `tsconfig.app.json` OK | `tsconfig.spec.json` OK | **UNDEFINED** (`ng-packagr` build has no `options.tsConfig`) | `projects/ngx-leaflet/tsconfig.spec.json` OK | **FAILS: silently misses the library build leaf.** |

Approach A is the correct primary strategy because:
1. **It works cleanly on both real substrates** and produces exactly the arrays 21-CONTEXT D-06 anticipated: `["tsconfig.app.json","tsconfig.spec.json"]` and `["projects/ngx-leaflet/tsconfig.lib.json","projects/ngx-leaflet/tsconfig.spec.json"]`.
2. **Approach B is fragile precisely where it matters.** The DEFAULT Angular library builder is `@angular/build:ng-packagr`, whose build target carries no `tsConfig` in `options` -- it takes `project` (the `ng-package.json`) and stashes the tsConfig under `configurations.{development,production}`. B would have to (a) know to dig into `configurations`, and (b) disambiguate `tsconfig.lib.json` (dev) from `tsconfig.lib.prod.json` (the emit-optimized prod variant, the WRONG scope for a type-check). That is more code for a WORSE result, on the most common library shape.
3. **It mirrors the existing `resolveTsConfig` branch-3 discipline** (`application -> tsconfig.app.json`, else `tsconfig.lib.json`, `tree.exists`-probed), reusing the same virtual-`Tree`-only probing (never `node:fs`), and reads `projectType` + `root` straight from the polyfilled `readProjectConfiguration` result.

**Do NOT build Approach B as a speculative fallback.** It adds test surface and the ng-packagr `configurations` special-case for a hypothetical custom layout that neither substrate exhibits. The escape hatch for an exotic layout already exists: the shared `--tsConfig` override (schema `tsConfig?: string`), which short-circuits resolution exactly as on the Nx branch.

### The edge case (RF-01 sub-question): a project with only one leaf

**Recommendation: existence-probe each candidate, include what exists, drop what is missing; emit the single available leaf rather than throw; throw only when the resulting array would be empty.**
- Both real substrates have both leaves, so the array is normally length 2.
- If only the build leaf exists (no `tsconfig.spec.json`) -> `[buildLeaf]`. If only a spec leaf exists (unusual) -> `[specLeaf]`. If NEITHER exists -> throw a clear, located error mirroring `resolveTsConfig` branch-5 (`Could not resolve a tsconfig for project "<p>": no ...`). This matches the fail-safe, no-silent-false-pass discipline: never write an unrunnable/empty target, but never drop a project just because it lacks a spec.

### Why a per-project array, not the root solution tsconfig?

On Substrate 2 the root `tsconfig.json` IS solution-style, so it is tempting to point the target at it and reuse the walk engine. That would VIOLATE COV-01: the root solution references EVERY project's leaves (the app's app+spec PLUS each library's lib+spec appended by `ng g library`), so a per-project target pointed at it would check ALL projects -- cross-project bleed. Per-project scoping REQUIRES the explicit `[buildLeaf, specLeaf]` array scoped by `projectConfig.root`. This is the architectural reason Option A + `tsConfig: string[]` (ENG-01) exists.

## The write-fork (implementation shape)

The fork is an early branch at the top of `configurationGenerator`, BEFORE `await initGenerator(...)`. Recommended structure (uses only `@nx/devkit`, no new import):

```typescript
// Source: repo generator.ts (Nx branch = current body verbatim) + nx source
//   (readProjectConfiguration angular.json polyfill, updateJson on the adapter tree)
export default async function configurationGenerator(
  tree: Tree,
  schema: ConfigurationGeneratorSchema,
): Promise<void> {
  const targetName = schema.targetName ?? 'typecheck';

  if (targetName.trim() === '') {
    throw new Error(/* ...existing empty-name reject... */);
  }

  // NEW FORK (D-01). Angular CLI substrate: angular.json present.
  if (tree.exists('angular.json')) {
    const projectConfig = readProjectConfiguration(tree, schema.project); // angular.json polyfill: gives root + projectType
    const tsConfig = resolveTsConfigLeaves(tree, projectConfig, schema);   // NEW helper -> string[] (RF-01)

    updateJson(tree, 'angular.json', (json) => {
      const project = json.projects?.[schema.project];
      // project exists (readProjectConfiguration succeeded); ensure architect map
      project.architect ??= {};
      const existing = project.architect[targetName];

      // D-05 collision by BUILDER id (same string as the executor id).
      if (existing && existing.builder !== TYPECHECK_EXECUTOR_ID) {
        throw new Error(/* ...already has a "<targetName>" target using builder "<x>"... */);
      }

      // D-05 idempotent rewrite: preserve user keys + extra options.
      project.architect[targetName] = {
        ...existing,
        builder: TYPECHECK_EXECUTOR_ID,
        options: { ...existing?.options, tsConfig },
      };

      return json;
    });

    // D-04: skip the Nx init (no nx.json / targetDefaults analog off-Nx).
    if (!schema.skipFormat) {
      await formatFiles(tree);
    }

    return;
  }

  // ELSE: existing Nx path, byte-unchanged (init-first + updateProjectConfiguration
  // + single-string resolveTsConfig). ACS-02.
  await initGenerator(tree, { skipFormat: true });
  // ...current body verbatim...
}
```

Key facts verified in `nx@23.0.1` source:
- `readProjectConfiguration(tree, name)` (`project-configuration.js` L118-130): when the project is NOT found via `project.json`/`package.json` AND `tree.exists('angular.json')`, it reads `angular.json` through `toNewFormat` (renames `architect->targets`, `builder->executor`) and returns the project. So `projectConfig.root` + `projectConfig.projectType` are available on the CLI substrate. [VERIFIED: node_modules/nx/dist/src/generators/utils/project-configuration.js]
- `updateProjectConfiguration` (L50-59) writes only `<root>/project.json` or `<root>/package.json`, else THROWS -- it has NO `angular.json` write branch. This is why the fork writes `angular.json` directly. [VERIFIED]
- `updateNxJson` (`nx-json.js` L23-42) early-returns when `nx.json` is absent -- a safe no-op that creates nothing. So even if `init` leaked onto the CLI branch it would not create `nx.json`; D-04 gates it out explicitly anyway (cleaner + avoids a redundant `formatFiles`). [VERIFIED]
- `generator-utils.js` L57: `const generatorsFile = packageJson.generators ?? packageJson.schematics;` -- Nx PREFERS `generators`, so `collection.json` is Nx-invisible (ACS-04). [VERIFIED]

### `architect` vs `targets` key nuance
Angular CLI accepts both `architect` and `targets` as aliases for a project's target map. Both real substrates (ngx-leaflet + fresh Ng22 scaffold) use `architect`, and Angular CLI scaffolds write `architect`. **Recommendation:** write into `architect` (the canonical key), but read the collision candidate defensively from `project.architect ?? project.targets` in case a hand-edited workspace uses the `targets` alias. Do not over-engineer beyond that one defensive read.

### `--tsConfig` override on the CLI branch
The shared schema keeps `tsConfig?: string` (single). An explicit override short-circuits resolution exactly as on the Nx branch. Recommendation: resolve it via the existing `resolveTsConfigOverride` discipline (absolute passes through; relative is `<root>`-joined + existence-probed) and write it as a single-element array `[resolved]` for CLI-branch shape uniformity (the ENG-01 engine accepts both string and array). This is a planner micro-decision; flag it, but `[resolved]` is the clean default.

## Additive manifest wiring (ACS-04 -- the mechanical, easy-to-miss tasks)

Four additive edits, all NEW siblings, never replacements:

1. **`packages/angular-typechecker/collection.json`** (NEW). Angular schematics collection:
   ```jsonc
   {
     "$schema": "../../node_modules/@angular-devkit/schematics/collection-schema.json",
     "schematics": {
       "configuration": {
         "factory": "./src/schematics/configuration/schematic",
         "schema": "./src/generators/configuration/schema.json",
         "description": "Wire a typecheck target into an Angular CLI project's angular.json."
       }
     }
   }
   ```
   (`init` + `ng-add` entries are Phase 23; add only `configuration` now.) Confirm the `$schema` path resolves; if `collection-schema.json` is not present at that path, omit `$schema` (it is advisory).
2. **`packages/angular-typechecker/src/schematics/configuration/schematic.ts`** (NEW, ~2 lines):
   ```typescript
   import { convertNxGenerator } from '@nx/devkit';
   import configurationGenerator from '../../generators/configuration/generator';
   export default convertNxGenerator(configurationGenerator);
   ```
   Compiles CJS under `module: nodenext` via the EXISTING `tsconfig.lib.json` `include: ["src/**/*.ts"]` -- no build-config change. Imports only `@nx/devkit` (already a dep) -> `@nx/dependency-checks` stays green.
3. **`package.json`:** add `"schematics": "./collection.json"` alongside `executors`/`generators`/`builders`, and add `"collection.json"` to the `files` whitelist.
4. **`project.json` build `assets`:** add a glob entry copying `collection.json -> .` in the dist output (mirror the existing `builders.json` asset entry). Without this the shipped tarball omits `collection.json` and `ng generate` fails post-publish. (Phase 24 audits the tarball; Phase 22 must wire the asset.)

### Schema reuse asymmetry (notable, contrasts with Phase 21)
The `configuration` schematic REUSES the generator `schema.json` VERBATIM. The `$default: { $source: "argv", index: 0 }` + `x-*` conventions ORIGINATE in Angular schematics, so the schematic dialect accepts them natively. This is UNLIKE the Phase-21 builder, which needed a sanitized `schema.json` because Architect's stricter validator differs (Pitfall 7). No new schematic schema file is needed. Confirm at plan time, but the generator schema is schematic-compatible by construction.

## Common Pitfalls

### Pitfall 1: Testing the CLI write-fork on an Nx tree hides the bug
**What goes wrong:** `createTreeWithEmptyWorkspace()` seeds an Nx tree (`nx.json` + `project.json`), so `tree.exists('angular.json')` is false and the fork never runs -- the test exercises the Nx path and passes while the CLI write is unverified. Worse, if `angular.json` is added WITHOUT deleting `nx.json`, the fork triggers but the substrate is ambiguous.
**How to avoid:** Seed a genuine Angular CLI substrate: start from an empty tree (or `createTreeWithEmptyWorkspace()` then `tree.delete('nx.json')`), `tree.write('angular.json', ...)` with the project(s), and write the tsconfig leaves. Assert BOTH `tree.exists('angular.json') === true` AND `tree.exists('nx.json') === false`. The `readProjectConfiguration` polyfill reads the project from `angular.json` only when it is NOT found via project.json AND `angular.json` exists -- so no `addProjectConfiguration` call is needed for the CLI project. [VERIFIED: project-configuration.js L120-127]

### Pitfall 2: Approach B silently under-checks libraries
**What goes wrong:** Reading `architect.build.options.tsConfig` returns `undefined` for the standard `ng-packagr` library builder; a naive B implementation writes `[undefined, specLeaf]` or drops the build leaf -> the library's source is never type-checked (a "type-checker that lies").
**How to avoid:** Use Approach A (convention + probe). See RF-01.

### Pitfall 3: Emitting the root solution tsconfig instead of the leaf array
**What goes wrong:** On a fresh Ng22 scaffold the root `tsconfig.json` is solution-style; pointing the per-project target at it checks every project -> cross-project bleed, violating COV-01.
**How to avoid:** Always write the explicit `[buildLeaf, specLeaf]` array scoped by `projectConfig.root`. Never reuse the workspace-root solution tsconfig for a per-project target.

### Pitfall 4: Forgetting the `collection.json` build asset
**What goes wrong:** The dist/tarball omits `collection.json` (it is not a `.ts` and is not auto-copied), so `ng generate` fails after publish with "collection not found".
**How to avoid:** Add the `collection.json` glob to `project.json` build `assets` (mirror `builders.json`) AND to `package.json` `files`. Phase 24's tarball audit is the backstop, but wire it here.

### Pitfall 5: Accidentally regressing the Nx path
**What goes wrong:** Refactoring `resolveTsConfig` to return an array (instead of adding a new helper) changes the Nx-branch single-string output -> ACS-02 regression.
**How to avoid:** Add a NEW `resolveTsConfigLeaves` helper; leave `resolveTsConfig` byte-identical. The existing `configuration.spec.ts` (single-string assertions) must stay green untouched.

## Runtime State Inventory

Not applicable in the classic sense (no rename/migration of stored data), but the ADDITIVE-ONLY charter demands a "what must NOT change" inventory:

| Category | Items | Action Required |
|----------|-------|------------------|
| Nx surface (must stay byte-unchanged) | `package.json` `executors`/`generators` fields; `executors.json`; `generators.json`; the Nx branch of `generator.ts`; the executor id `angular-typechecker:typecheck` | NONE -- add siblings only; `generators ?? schematics` regression assertion proves it. |
| Public API (widen-only) | `runTypecheck`/`CoreOptions`/`CoreResult`; `src/index.ts` barrel | NONE this phase (engine already widened to `string[]` in Phase 21). Do not touch the barrel. |
| Existing generator schemas | `configuration/schema.json`, `init/schema.json` | NONE -- reused verbatim by the schematic. |
| Build artifacts | dist tarball must GAIN `collection.json` | Add build `assets` glob + `files` entry (Pitfall 4). |
| Test baselines | `configuration.spec.ts` (Nx single-string), `nx-surface-regression.spec.ts` (executors ?? builders) | Must stay green; ADD parallel angular.json + generators-surface specs. |

## Code Examples

### Leaf-set resolver (Approach A) -- recommended new helper
```typescript
// Source: mirrors repo resolveTsConfig branch-3 discipline; virtual Tree only.
function resolveTsConfigLeaves(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  schema: ConfigurationGeneratorSchema,
): string[] {
  const root = projectConfig.root;

  // explicit override short-circuits (single leaf, user's choice).
  if (schema.tsConfig) {
    return [resolveTsConfigOverride(tree, root, schema.tsConfig, schema.project)];
  }

  const buildLeaf =
    projectConfig.projectType === 'application'
      ? joinPathFragments(root, 'tsconfig.app.json')
      : joinPathFragments(root, 'tsconfig.lib.json');
  const specLeaf = joinPathFragments(root, 'tsconfig.spec.json');

  const leaves = [buildLeaf, specLeaf].filter((p) => tree.exists(p));

  if (leaves.length === 0) {
    throw new Error(
      `Could not resolve a tsconfig for project "${schema.project}": no ` +
        `"${buildLeaf}" and no "${specLeaf}". Pass --tsConfig explicitly.`,
    );
  }

  return leaves;
}
```

### Verified angular.json target shape written by the fork
```jsonc
// angular.json (app "ngx-leaflet-demo", root "")
"typecheck": {
  "builder": "angular-typechecker:typecheck",
  "options": { "tsConfig": ["tsconfig.app.json", "tsconfig.spec.json"] }
}
// angular.json (lib "ngx-leaflet", root "projects/ngx-leaflet")
"typecheck": {
  "builder": "angular-typechecker:typecheck",
  "options": {
    "tsConfig": [
      "projects/ngx-leaflet/tsconfig.lib.json",
      "projects/ngx-leaflet/tsconfig.spec.json"
    ]
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CONTEXT starting hypothesis: "prefer B (read architect targets), fall back to A" | Approach A (convention + probe) is primary; B rejected | This research (empirical, 2026-07-10) | Simpler code, correct on `ng-packagr` libraries, matches D-06 expected arrays. |
| Per-project coverage via emitted solution tsconfig / reference-walk | `tsConfig: [buildLeaf, specLeaf]` array (Option A, ENG-01) | v0.2.1 SUMMARY CORRECTION | No emitted file; explicit per-project scoping; PITFALL-8 voided. |
| `updateProjectConfiguration` assumed to round-trip to `angular.json` | Direct `updateJson('angular.json', ...)` write-fork | v0.2.1 ARCHITECTURE (Pitfall 2) | The only way `ng run` finds the target on Angular CLI. |

**Deprecated/outdated:** none newly relevant. (The v0.2.1 SUMMARY's "modern Angular CLI root tsconfig is solution-style" is TRUE for fresh scaffolds but NOT for existing repos like ngx-leaflet -- both shapes are supported by Approach A regardless.)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `configuration` generator `schema.json` is schematic-compatible verbatim (the `$default`/`x-*` conventions are Angular-native) | Additive manifest wiring | LOW -- confirm at plan time via a `ng generate` dry-run in Phase 24; if a key is rejected, sanitize a schematic copy (same pattern as the Phase-21 builder schema). |
| A2 | Fresh Ng22 `ng g library` places leaves at `projects/<lib>/tsconfig.lib.json` + `tsconfig.spec.json` under the lib root | RF-01 Substrate 2 | LOW -- cited from v0.2.1 SUMMARY (verified against a generated workspace); Approach A probes existence, so a differently-named leaf simply drops and the `--tsConfig` override covers it. The definitive scaffold proof is Phase 24 (ACV-02). |
| A3 | `@angular-devkit/schematics/collection-schema.json` exists at the referenced path for the collection `$schema` | Additive manifest wiring | NEGLIGIBLE -- `$schema` is advisory; omit if absent. |

## Open Questions (RESOLVED)

Both are non-load-bearing and are encoded in the Phase-22 plans (22-01 / 22-02).

1. **Does `@nx/nx-plugin-checks` validate `collection.json` referenced by the `schematics` field?**
   - What we know: the eslint config runs `@nx/nx-plugin-checks` on `package.json`; it validates plugin manifests.
   - What is unclear: whether it errors if `collection.json` factories/paths are malformed at lint time.
   - RESOLVED: after adding `collection.json` + the `schematics` field, run `nx lint angular-typechecker` and fix any manifest findings as part of the same plan. Treat a green lint as a hard gate. (Encoded in 22-02 Task 1 acceptance criteria: `nx lint angular-typechecker` exits 0.)

2. **Single-element `[resolved]` vs bare string for an explicit `--tsConfig` override on the CLI branch.**
   - What we know: the ENG-01 engine accepts both.
   - RESOLVED: write `[resolved]` for CLI-branch shape uniformity. Non-load-bearing. (Encoded in 22-01 as the single-element array for the `--tsConfig` override case.)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | all | Yes | `^22.22.3 \|\| ^24.15.0 \|\| ^26.0.0` (engines) | -- |
| `nx` / `@nx/devkit` | fork + tree helpers + polyfill | Yes | `23.0.1` | -- |
| `vitest` (`@nx/vitest:test`) | test tiers | Yes | `4.x` | -- |
| `@angular-devkit/schematics` (+`/testing`) | OPTIONAL SchematicTestRunner tier | Yes (transitive in `node_modules`) | Angular 22 devkit | Generator-direct test (no dependency) |
| `bluehalo/ngx-leaflet` clone | dev/debug RF-01 confidence check | Yes (uncommitted) | @ 818e9ae | The CI-authoritative proof is the seeded-tree unit test |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x via `@nx/vitest:test` |
| Config file | `packages/angular-typechecker/vitest.config.mts` (fast tier); `vitest.integration.config.mts` (real-compiler tier) |
| Quick run command | `nx test angular-typechecker` (fast tier: `**/*.spec.ts`, excludes `*.integration.spec.ts`) |
| Full suite command | `nx test angular-typechecker && nx integration angular-typechecker && nx lint angular-typechecker && nx typecheck angular-typechecker` |

The write-fork is a PURE virtual-`Tree` operation (resolve leaves, write JSON) -- NO `@angular/compiler-cli` load -- so all Phase-22 tests are FAST-tier `*.spec.ts` files. No integration-tier (real-compiler) test is needed this phase; planted-error compilation proof is Phase 24 (ACV-02).

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ACS-01 | CLI fork writes `architect.typecheck` = `{ builder, options.tsConfig: [buildLeaf, specLeaf] }` on an `angular.json`-seeded tree; config-edit-only (no emitted file) | unit | `nx test angular-typechecker` | Wave 0 -- NEW `configuration-angular-cli.spec.ts` |
| ACS-01 | Idempotent re-run of OUR target preserves user keys + extra options; re-asserts id + tsConfig | unit | `nx test angular-typechecker` | Wave 0 |
| ACS-01 | Collision: a same-named NON-ours `builder` target throws a located error | unit | `nx test angular-typechecker` | Wave 0 |
| ACS-01 | Empty/whitespace `--targetName` rejected; explicit `--tsConfig` override honored; single-leaf edge emits `[buildLeaf]`; no-leaf throws | unit | `nx test angular-typechecker` | Wave 0 |
| ACS-02 | Nx path byte-unchanged: single-string solution `tsConfig` via `project.json`; init seeds targetDefaults | unit | `nx test angular-typechecker` | EXISTS -- `configuration.spec.ts` (must stay green untouched) |
| ACS-02 | CLI branch creates NO stray `nx.json` (init skipped) | unit | `nx test angular-typechecker` | Wave 0 (assert `!tree.exists('nx.json')`) |
| ACS-04 | `package.json` keeps `generators` + adds `schematics`; `collection.json` declares `configuration`; Nx resolves `generators ?? schematics` | unit | `nx test angular-typechecker` | Wave 0 -- NEW `nx-generators-surface-regression.spec.ts` (mirror the builders one) |
| ACS-04 | Manifest/plugin validity | lint | `nx lint angular-typechecker` | EXISTS (`@nx/nx-plugin-checks` + `@nx/dependency-checks`) -- verify green after wiring |
| COV-01 | On a TWO-project (app + lib) seeded angular.json tree, each `typecheck` target's `tsConfig` array equals EXACTLY that project's leaves; no other project's leaves appear | unit | `nx test angular-typechecker` | Wave 0 (per-project scoping assertion) |

### Sampling Rate
- **Per task commit:** `nx test angular-typechecker` (fast tier).
- **Per wave merge:** `nx test angular-typechecker && nx lint angular-typechecker && nx typecheck angular-typechecker`.
- **Phase gate:** full suite (test + integration + lint + typecheck + build) green; plus `format:check` per the repo's release discipline before any Release PR.

### Wave 0 Gaps
- [ ] `src/generators/configuration/configuration-angular-cli.spec.ts` -- the write-fork on an `angular.json`-seeded tree (ACS-01, ACS-02 no-stray-nx.json, COV-01 per-project scoping). Covers ACS-01/ACS-02/COV-01.
- [ ] `src/schematics/configuration/nx-generators-surface-regression.spec.ts` -- `generators ?? schematics` static regression, mirroring `src/builders/typecheck/nx-surface-regression.spec.ts`. Covers ACS-04.
- [ ] (OPTIONAL) a schematic structural/schema-reuse assertion if a plan wants to pin `collection.json` factory/schema paths. Not required for the requirement set.
- Framework install: NONE -- Vitest infrastructure exists.

*(A seeded-tree helper -- `createTreeWithEmptyWorkspace()` then `tree.delete('nx.json')` + `tree.write('angular.json', ...)` + write leaves -- can be a small local factory in the new spec; no shared fixture file is strictly required.)*

## Security Domain

`security_enforcement` is not explicitly `false` in config.json (only `nyquist_validation` and workflow flags are set), so this section is included. **Realistic surface: ASVS L1.** Phase 22 is config-edit-only on the developer's OWN workspace tree -- no network, no runtime/user input, no secrets, no deserialization of untrusted data.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | no | -- |
| V5 Input Validation | yes (narrow) | The generator validates its own inputs: reject empty/whitespace `--targetName`; existence-probe `--tsConfig` overrides and throw a located error on a miss; throw on an unresolvable leaf set. All writes go through `@nx/devkit` JSON helpers (no string concatenation into JSON). |
| V6 Cryptography | no | -- |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/unexpected `angular.json` shape (missing `projects[p]`, `architect` vs `targets` alias) | Tampering (of local config, self-inflicted) | Guard `project.architect ??= {}`; read collision candidate from `architect ?? targets`; `readProjectConfiguration` throws a clear "Cannot find configuration" if the project is absent. |
| Collision: clobbering a user's foreign same-named target | Tampering | Collision-by-`builder`-id throw (D-05) -- never overwrite a non-ours target. |
| Silent under-coverage (target that "lies") | Repudiation of correctness | Approach A + existence-probe + no-empty-array throw; never write `[undefined, ...]`; per-project scoping asserted (COV-01). |

No classic injection surface exists (no shell, no SQL, no network, no eval). The `<threat_model>` block for the planner should be scoped to "malformed `angular.json` / collision / idempotency correctness at ASVS L1," not classic web threats.

## Sources

### Primary (HIGH confidence)
- Installed `nx@23.0.1` source (read directly): `node_modules/nx/dist/src/generators/utils/project-configuration.js` (`readProjectConfiguration` angular.json polyfill L118-130; `updateProjectConfiguration` no-angular.json-write L50-59; `toNewFormat` L259+), `nx-json.js` (`updateNxJson` no-op-when-absent L23-42), `command-line/generate/generator-utils.js` L57 (`generators ?? schematics`), `command-line/run/executor-utils.js` L76 (`executors ?? builders`).
- Repo source (read directly): `src/generators/configuration/{generator.ts,schema.json,schema.d.ts,configuration.spec.ts,schema-parity.spec.ts}`, `src/generators/init/generator.ts` (`TYPECHECK_EXECUTOR_ID`), `src/builders/typecheck/{builder.ts,schema.json,nx-surface-regression.spec.ts}`, `package.json`, `project.json`, `generators.json`/`executors.json`/`builders.json`, `tsconfig.{json,lib.json}`, `eslint.config.mjs`, `vitest.config.mts`/`vitest.integration.config.mts`.
- Real substrate `D:\projects\github\bluehalo\ngx-leaflet` @ 818e9ae (read directly): `angular.json` (app + ng-packagr lib target shapes), root `tsconfig.json` (plain base, no references), `tsconfig.app.json`, `tsconfig.spec.json`, `projects/ngx-leaflet/tsconfig.lib.json`, `projects/ngx-leaflet/tsconfig.spec.json`.

### Secondary (MEDIUM confidence)
- `.planning/research/v0.2.1-angular-cli/{SUMMARY.md,ARCHITECTURE.md,PITFALLS.md}` (v0.2.1 design source of truth; the SUMMARY CORRECTION on the solution-style fresh-scaffold root tsconfig).
- `.planning/phases/22-configuration-schematic-the-angular-json-write-fork/22-CONTEXT.md` (D-01..D-07, RF-01), `.planning/REQUIREMENTS.md` (ACS/COV text), `.planning/ROADMAP.md` (Phase 22-24 goals/deps).

### Tertiary (LOW confidence)
- v0.2.1 SUMMARY claim about a freshly scaffolded Ng22 `ng g library` leaf layout (Assumption A2) -- to be nailed by Phase 24's real scaffold e2e.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new packages; all versions verified against the shipped manifest + installed source.
- RF-01 leaf discovery: HIGH -- both substrates read directly on disk; the ng-packagr `options`-has-no-tsConfig fact is decisive and reproducible.
- Write-fork mechanics: HIGH -- nx polyfill/write/no-op branches + `generators ?? schematics` precedence all read from installed source.
- Fresh-scaffold leaf layout (Substrate 2 specifics): MEDIUM -- cited, not re-generated this session; existence-probe + `--tsConfig` override make Approach A robust to minor deviation.

**Research date:** 2026-07-10
**Valid until:** ~2026-08-09 (stable; pinned Nx 23.0.1 / Angular 22 stack). Re-verify RF-01 if the target set widens beyond Angular 22 or a non-ng-packagr default library builder ships.
