# Phase 23: `init` schematic parity + first-party `ng-add` - Research

**Researched:** 2026-07-10
**Domain:** Angular CLI (`angular.json`) install-orchestration schematic (`ng-add`) + `init` parity schematic + optional-peer dependency classification, over the already-shipped `convertNxGenerator` re-export + shared `configuration` write-fork
**Confidence:** HIGH (every locked mechanic re-confirmed against the installed `@angular/cli@22.0.6`, `@nx/devkit@23.0.1`, `nx@23.0.1`, and `@nx/eslint-plugin` source on disk; both open research flags RF-01/RF-02 resolved with a code-grounded verdict)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01..D-09 -- do NOT re-open)
- **D-01:** Author `ng-add` as an Nx-devkit generator `ngAddGenerator(tree, schema)` re-exported via `export default convertNxGenerator(ngAddGenerator)` at `src/schematics/ng-add/schematic.ts`, registered in `collection.json` under the reserved `ng-add` name. NOT a hand-written `@angular-devkit/schematics` Rule.
- **D-02:** `ng-add` COMPOSES the shared Phase-22 `configuration` write-fork per project -- `configurationGenerator(tree, { project, skipFormat: true })` for each in-scope project, format ONCE at the end. Inherits the collision-by-builder-id guard, idempotent rewrite, and `resolveTsConfigLeaves` for free.
- **D-03:** Enumerate `angular.json#projects`; wire a target ONLY into `projectType` `'application'` or `'library'` (skip e2e/other). Idempotency delegated to the write-fork (re-assert OUR target; throw on a same-named NON-ours target).
- **D-04:** Add an additive early `tree.exists('angular.json')` fork to `src/generators/init/generator.ts`: on an Angular CLI workspace do NO `nx.json` seeding and return (optionally print the shared no-caching notice) BEFORE touching `nx.json`; the Nx branch stays byte-unchanged. (Safe design even though `updateNxJson` is a verified no-op off-Nx.)
- **D-05:** Register `convertNxGenerator(initGenerator)` at `src/schematics/init/schematic.ts` in `collection.json` (parity re-export). The fork lives in the generator so `ng g` and `nx g` run the exact same forked code.
- **D-06:** A single shared notice string ("no target caching on Angular CLI") printed via devkit `logger.info`, printed ONCE by `ng-add` after wiring. The `init` CLI fork MAY print the same shared string; wording lives in ONE place. Exact phrasing is planner discretion within end-user language.
- **D-07:** Declare `@angular-devkit/architect` (`^0.2200.0`) and `rxjs` (`^7.8.0`) as OPTIONAL `peerDependencies` (`peerDependenciesMeta.<dep>.optional: true`). `nx` is NOT declarable and flows in transitively -- ACCEPT + DOCUMENT the `.nx/` dir consequence.
- **D-08:** Keep `@nx/dependency-checks` green after adding the two optional peers (confirm the exact lever against installed `@nx/eslint` behavior). Verified green by `nx lint` (a required CI check).
- **D-09:** The first-party `ng-add` does NOT violate the "no hand-written Rule" Out-of-Scope line -- it is an INSTALL-ORCHESTRATION schematic authored as an Nx generator + `convertNxGenerator`, COMPOSING the shared `configuration` generator. IN charter.

### Claude's Discretion
- Plan decomposition (how many plans; whether `ng-add` + `init` fork/schematic + optional-peer classification split or land together). A natural split mirrors Phase 22 (behavioral fork/schematic code in one plan; additive-manifest + regression + optional-peer + docs-touch in another) but is NOT prescribed.
- The exact no-caching notice wording (end-user language, no internal ids).
- Whether `ng-add` takes an optional `--project` to scope a single project. DEFAULT + tested behavior = auto-wire-ALL app+library projects (NGADD-01).
- Whether the `ng-add` schema is a minimal hand-authored `schema.json` (likely just `skipFormat?` + optional `project?`) or reuses an existing one. (Researcher verdict below: minimal new schema, mirror the `init` schema shape.)

### Deferred Ideas (OUT OF SCOPE)
- WALK-FUT-01 `createNodesV2` Nx auto-provisioning (the idiomatic Nx analog of `ng add` auto-wire-all). Nx `nx add` stays init/caching-only.
- Real-OSS + scaffolded e2e, the additive-only audit, README/CHANGELOG docs -> Phase 24 (ACV-01/02/03, ACP-02, ACD-01). Phase 23 delivers unit/integration coverage of its own surface only.
- The builder, the `tsConfig: string|string[]` engine widening, the `configuration` schematic + write-fork -> ALREADY SHIPPED (Phases 21-22). Phase 23 CONSUMES them.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACS-03 | `ng generate angular-typechecker:init` available for parity; on an Angular CLI workspace seeds NO caching + no stray `nx.json` | Init `tree.exists('angular.json')` early-return fork (D-04) + `convertNxGenerator(initGenerator)` in `collection.json` (D-05). `updateNxJson` verified TOTAL no-op when `nx.json` absent (`nx-json.js` L23-42) -- fork makes the skip explicit, not incidental. |
| NGADD-01 | `ng add` runs a first-party `ng-add` schematic iterating `angular.json#projects`, auto-wires `typecheck` into every application+library project (idempotent, skip existing/e2e/other), ensures the devDependency, prints a "no target caching" notice; Nx `nx add` unchanged | `ngAddGenerator` composes `configurationGenerator` per in-scope project (D-02/D-03). RF-01 verdict: devDependency via `"ng-add": {"save": "devDependencies"}` manifest field + a defensive in-schematic tree edit. RF-02 verdict: `tree.exists('angular.json')` guard. `nx add` runs `<pkg>:init` (verified `add.js`/`configure-plugins.js`) -> unchanged. |
| ACP-01 | `@angular-devkit/architect` + `rxjs` as OPTIONAL peer deps; `@nx/dependency-checks` green; `nx`-transitive + `.nx/` consequence documented | D-07 optional peers. ACP-01 LEVER (D-08): add both to the rule's `ignoredDependencies` (source-verified: rule fires `obsoleteDependency` for declared-but-unimported peers; `peerDependenciesMeta.optional` does NOT exempt). Versions verified: `@angular-devkit/architect@0.2200.6` latest, `rxjs@7.8.2` latest. |
</phase_requirements>

## Summary

Phase 23 is the install-orchestration cap on the v0.2.1 Angular CLI surface. Almost all of its design was locked and source-verified in the milestone research; this pass re-confirmed every locked mechanic against the installed package source and resolved the two genuinely-open implementation flags. The heavy engineering (the `angular.json` write-fork, `resolveTsConfigLeaves`, the collision/idempotency guard) already SHIPPED in Phase 22's `configurationGenerator` -- Phase 23 COMPOSES it and adds three small pieces: an additive early-return fork in the `init` generator, two thin `convertNxGenerator` re-exports (`init`, `ng-add`), and one new composed `ngAddGenerator`, plus manifest/peer-dep wiring.

The single most important finding overturns the framing of RF-01. The CONTEXT assumed `ng add <pkg>` always installs into `dependencies` first, forcing a schematic-side "move to devDependencies" dance (Approach A vs B). It does NOT: `@angular/cli@22.0.6`'s `ng add` reads the package's OWN `package.json` `"ng-add": { "save": ... }` field and installs with `--save-dev` directly when `save === "devDependencies"` (verified in `add/cli.js` L461 + L529 and `package-manager.js` L259-271). This is the idiomatic Angular-native mechanism -- `@angular-eslint/schematics` (a dev-tool, exactly analogous to a type-checker) ships `"ng-add": { "save": "devDependencies" }`. So the primary lever is a package.json field, not schematic code.

**Primary recommendation:** RF-01 -> declare `"ng-add": { "save": "devDependencies" }` in the published `package.json` (Approach C, the idiomatic path) + a defensive in-schematic package.json tree edit that moves any `dependencies` entry to `devDependencies` and returns VOID (never a `GeneratorCallback`, to avoid a redundant post-schematic `npm install`); REJECT Approach A (`addDependenciesToPackageJson`) which cannot move an entry deps->devDeps on its own and schedules a redundant install. RF-02 -> guard `ng-add` on `tree.exists('angular.json')`; absent -> dependency-ensure + guidance only, no target wiring, no `nx.json`. ACP-01 -> add `@angular-devkit/architect` + `rxjs` to the `@nx/dependency-checks` `ignoredDependencies` array.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Install `angular-typechecker` to `devDependencies` | Angular CLI (`ng add` command) via `ng-add.save` manifest field | `ng-add` schematic (defensive tree edit for the install-skipped edge) | The CLI owns install placement; `save: devDependencies` is the Angular-native way. The schematic backstops the "already installed in deps" edge where the CLI skips install. |
| Auto-wire `typecheck` target into every app+library project | `ng-add` schematic (`ngAddGenerator`) | shared `configurationGenerator` (per project) | Enumeration + filtering is orchestration (ng-add); per-project write is delegated to the shipped write-fork. |
| Per-project `angular.json` target write + idempotency/collision | shared `configurationGenerator` (Phase 22, unchanged) | -- | Already shipped + tested; ng-add must not re-implement it. |
| `init` parity no-op on Angular CLI (no caching seed) | shared `initGenerator` (additive `angular.json` fork) | `convertNxGenerator(initGenerator)` re-export | The fork lives in the generator so both `ng g` and `nx g` run identical code. |
| Optional runtime deps of the converted builder | Published `package.json` (optional peers) + consumer's Angular CLI workspace | ESLint `@nx/dependency-checks` `ignoredDependencies` | The `require()`s live in `@nx/devkit`, invisible to the plugin's own dep linter -- peers document intent; `ignoredDependencies` keeps the gate green. |
| `nx add` init/caching seed (UNCHANGED) | Nx `init` generator via `generators.json` | -- | `generators ?? schematics` precedence keeps `collection.json` Nx-invisible; `nx add` runs `<pkg>:init`. |

## Standard Stack

No new runtime dependencies. Everything needed ships in the already-pinned `@nx/devkit@23.0.1` (`convertNxGenerator`, `getProjects`, `readJson`/`updateJson`/`readProjectConfiguration`/`formatFiles`, `logger`). The only `package.json` additions are metadata (two optional peers + the `ng-add.save` field) satisfied by the consumer's Angular CLI workspace.

### Core (already present / metadata only)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nx/devkit` `convertNxGenerator` | ships in `@nx/devkit@23.0.1` (pinned dep) | Wrap `ngAddGenerator` + `initGenerator` as Angular schematics | `[VERIFIED: installed source]` `invoke-nx-generator.js` -- exported, non-deprecated, no `@angular-devkit/*` runtime dep in production. |
| `@nx/devkit` `getProjects` / `readProjectConfiguration` | ships in `@nx/devkit@23.0.1` | Enumerate `angular.json#projects` + read `projectType` on the virtual Tree | `[VERIFIED: installed source]` `angular.json` READ polyfill (`project-configuration.js`); used already by `configurationGenerator`. |
| `@angular-devkit/architect` | peer `^0.2200.0` (latest `0.2200.6`) | Runtime host for the converted builder | `[VERIFIED: npm registry + installed]` latest = `0.2200.6`; present in every Angular CLI workspace. Note the `0.22xx.x` scheme, NOT `22.x`. OPTIONAL peer. |
| `rxjs` | peer `^7.8.0` (latest `7.8.2`) | The converted builder returns an rxjs Observable | `[VERIFIED: npm registry + installed]` latest = `7.8.2`; `@angular/core@22` peers `^6.5.3 \|\| ^7.4.0` so it is always present. OPTIONAL peer. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `ng-add.save: devDependencies` (RF-01 Approach C) | `addDependenciesToPackageJson` (Approach A) | REJECTED. `addDependenciesToPackageJson` only ADDS; `filterExistingDependencies` (package-json.js L100-107) skips a dep already present in the other bucket, so it CANNOT move `angular-typechecker` from `dependencies` to `devDependencies`, and it returns an `installPackagesTask` callback that fires a redundant post-schematic `npm install`. |
| defensive direct tree edit (RF-01 Approach B, return void) | rely on `ng-add.save` alone | `save` is NOT applied when `ng add` skips install (package already present in `dependencies` -- `add/cli.js` L167-175). The defensive edit covers that edge; returning void avoids scheduling a `RunCallbackTask` install. |
| `getProjects(tree)` enumeration | raw `readJson(tree,'angular.json').projects` | Either works; `getProjects` returns a `Map<name, ProjectConfiguration>` with `projectType` normalized (cleaner filter). Both read the same polyfill. |

**Installation:** No `npm install`. Metadata-only edits to the published `package.json`:
```jsonc
"ng-add": { "save": "devDependencies" },   // NEW: ng add installs to devDependencies
"peerDependencies": {
  "@angular/compiler-cli": "^22.0.0",
  "typescript": ">=6.0.0 <6.1.0",
  "@angular-devkit/architect": "^0.2200.0",  // NEW (optional)
  "rxjs": "^7.8.0"                            // NEW (optional)
},
"peerDependenciesMeta": {                     // NEW
  "@angular-devkit/architect": { "optional": true },
  "rxjs": { "optional": true }
}
```
**Version verification (2026-07-10):** `@angular-devkit/architect` latest `0.2200.6` (installed `0.2200.6`), `rxjs` latest `7.8.2` (installed `7.8.2`) -- both confirmed against `registry.npmjs.org` and `node_modules`. Peer ranges `^0.2200.0` / `^7.8.0` correct.

## Package Legitimacy Audit

This phase installs **no** new runtime packages. It declares two OPTIONAL peerDependencies that are canonical first-party Angular/RxJS packages already resolved in the workspace `node_modules` and satisfied by any Angular CLI consumer. slopcheck is not applicable to first-party framework peers verified against installed source + the official registry.

| Package | Registry | Age | Source Repo | Verified | Disposition |
|---------|----------|-----|-------------|----------|-------------|
| `@angular-devkit/architect` | npm | mature (Angular DevKit) | github.com/angular/angular-cli | installed `0.2200.6` = registry latest | Approved (optional peer) |
| `rxjs` | npm | mature | github.com/ReactiveX/rxjs | installed `7.8.2` = registry latest | Approved (optional peer) |

**Packages removed:** none. **Packages flagged:** none.

## Architecture Patterns

### System Architecture Diagram

```
  ng add angular-typechecker                          nx add angular-typechecker
        |                                                     |
        | @angular/cli reads pkg manifest                     | nx runs `<pkg>:init`
        | "ng-add".save == "devDependencies"                  | via generators.json
        | -> npm install --save-dev angular-typechecker       | (generators ?? schematics)
        | (BEFORE the schematic; skipped if already present)  |
        v                                                     v
  collection.json "ng-add" factory                     generators.json "init"
        |                                                     |
        v convertNxGenerator(ngAddGenerator)                  v initGenerator(tree, schema)
   ngAddGenerator(adapterTree, schema):                       |
     1. IF !tree.exists('angular.json')  ---------------.     | tree.exists('angular.json')?
        (RF-02 guard) -> defensive devDep-ensure only,  |     |   NO (Nx) -> seed nx.json
        print guidance, RETURN (no wiring, no nx.json)  |     |     targetDefaults (UNCHANGED)
     2. defensive: read package.json on tree; move      |     |   YES -> return (no-op)  <- ACS-03
        angular-typechecker deps->devDeps if present    |     |
     3. for each project in getProjects(tree)           |     v  updateNxJson: TOTAL no-op if
        where projectType in {application, library}:    |        nx.json absent (creates nothing)
          configurationGenerator(tree,{project,         |
                                    skipFormat:true}) ---+---> SHARED configuration write-fork
     4. formatFiles(tree) ONCE                                  (Phase 22, UNCHANGED):
     5. logger.info(NO_CACHING_NOTICE) ONCE                       angular.json architect target,
     6. return VOID (no GeneratorCallback -> no                   [buildLeaf, specLeaf] array,
        redundant install task)                                   collision-by-builder-id, idempotent
```

### Recommended Project Structure
```
packages/angular-typechecker/
+-- collection.json              # MODIFIED: + "init" + "ng-add" entries (currently only "configuration")
+-- generators.json              # UNCHANGED (keeps configuration + init; ng-add NOT registered here)
+-- package.json                 # MODIFIED: + ng-add.save, + 2 optional peers + peerDependenciesMeta
+-- eslint.config.mjs            # MODIFIED: + ignoredDependencies [architect, rxjs] (ACP-01 lever)
+-- src/
|   +-- generators/
|   |   +-- init/generator.ts        # MODIFIED: additive tree.exists('angular.json') early-return fork (D-04)
|   |   +-- configuration/generator.ts   # UNCHANGED (composed by ng-add)
|   |   +-- ng-add/                   # NEW
|   |       +-- generator.ts          #   ngAddGenerator(tree, schema) -- composes configurationGenerator
|   |       +-- schema.json           #   minimal: { skipFormat?, project? }
|   |       +-- schema.d.ts           #   NgAddGeneratorSchema
|   +-- schematics/
|       +-- configuration/schematic.ts   # UNCHANGED (convertNxGenerator re-export template to mirror)
|       +-- init/schematic.ts             # NEW: export default convertNxGenerator(initGenerator)
|       +-- ng-add/schematic.ts           # NEW: export default convertNxGenerator(ngAddGenerator)
```
Mirror the shipped `configuration` layout: generator + schema under `src/generators/<name>/`, the thin `convertNxGenerator` re-export under `src/schematics/<name>/`. `collection.json` references `factory: ./src/schematics/<name>/schematic` + `schema: ./src/generators/<name>/schema.json` (exactly as the existing `configuration` entry does). `tsconfig.lib.json`'s `include: ["src/**/*.ts"]` already covers all new files; no build config change. No `files`/`project.json` asset change needed (`src` + `collection.json` are already whitelisted/globbed).

### Pattern 1: `ng-add.save` install-placement (RF-01 primary)
**What:** The published `package.json` declares `"ng-add": { "save": "devDependencies" }`.
**When to use:** Any `ng add`-installable dev tool that must land in `devDependencies`.
**How it works (verified):** `@angular/cli` reads `manifest['ng-add']?.save` (`add/cli.js` L461) and calls `packageManager.add(pkg, 'none', savePackage === 'devDependencies', ...)` (L529); the third arg maps to `--save-dev` (`package-manager.js` L259-271). Precedent: `@angular-eslint/schematics/package.json` ships exactly this.
```jsonc
// packages/angular-typechecker/package.json
"ng-add": { "save": "devDependencies" }
```

### Pattern 2: Defensive devDependency ensure (RF-01 backstop, no install task)
**What:** In `ngAddGenerator`, edit `package.json` on the virtual Tree -- if `angular-typechecker` is in `dependencies`, delete it there and set it under `devDependencies`. Return VOID.
**When to use:** The install-skipped edge (`ng add` finds the package already present -- `add/cli.js` L167-175 -- and never applies `save`).
```typescript
// inside ngAddGenerator, after the angular.json guard
updateJson(tree, 'package.json', (pkg) => {
  const version = pkg.dependencies?.['angular-typechecker'];
  if (version) {
    delete pkg.dependencies['angular-typechecker'];
    pkg.devDependencies ??= {};
    pkg.devDependencies['angular-typechecker'] ??= version;
  }
  return pkg;
});
// ... wire targets ...
// return VOID -- do NOT return a GeneratorCallback (avoids a redundant npm install task)
```
Do NOT use `addDependenciesToPackageJson` here: it cannot move deps->devDeps and returns an `installPackagesTask` callback that `convertNxGenerator` surfaces as a `RunCallbackTask` (invoke-nx-generator.js L55-59), firing a second `npm install`.

### Pattern 3: Compose the shared write-fork per project (D-02/D-03)
```typescript
// inside ngAddGenerator, after the guard + devDep ensure
for (const [name, project] of getProjects(tree)) {
  if (project.projectType === 'application' || project.projectType === 'library') {
    await configurationGenerator(tree, { project: name, skipFormat: true });
  }
}
if (!schema.skipFormat) { await formatFiles(tree); }
logger.info(NO_CACHING_NOTICE);   // ONCE
```
Idempotency + skip-existing are inherited: `configurationGenerator`'s CLI branch re-asserts OUR `typecheck` target (no-op-equivalent) and throws a located error on a same-named NON-ours target. e2e-only/other project types are excluded by the `projectType` filter (see Pitfall 3).

### Pattern 4: Additive `init` fork (D-04)
```typescript
// src/generators/init/generator.ts -- add at the TOP of initGenerator, before readNxJson
export default async function initGenerator(tree, schema) {
  if (tree.exists('angular.json')) {
    // Angular CLI: no nx.json / targetDefaults / task cache to seed.
    logger.info(NO_CACHING_NOTICE);   // optional, per D-06
    if (!schema?.skipFormat) { await formatFiles(tree); }  // or just return
    return;
  }
  // ...existing Nx branch, byte-unchanged...
}
```

### Anti-Patterns to Avoid
- **`addDependenciesToPackageJson` for the devDep move** -- cannot reclassify; schedules a redundant install (see Pattern 2).
- **Returning a `GeneratorCallback` from `ngAddGenerator`** -- surfaced as a `RunCallbackTask` under `ng add`'s real workflow and would run an extra `npm install`. Return void.
- **Registering `ng-add` in `generators.json`** -- unnecessary (Nx `nx add` runs `<pkg>:init`, not `ng-add`) and would add an `@nx/nx-plugin-checks` validation burden. Keep `ng-add` in `collection.json` only.
- **Relying on the `updateNxJson` incidental no-op instead of the explicit `angular.json` fork** -- D-04 mandates the explicit skip (the in-corpus contradiction is why).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Install to devDependencies | A schematic `NodePackageInstallTask` + move logic | `"ng-add": { "save": "devDependencies" }` manifest field | The CLI does it natively, before the schematic, deterministically. |
| Per-project target write into `angular.json` | New write code in `ngAddGenerator` | `configurationGenerator(tree, {project, skipFormat:true})` | Phase 22 already ships the write-fork + collision/idempotency + leaf resolution. |
| Project enumeration + `projectType` read | Manual `angular.json` JSON walk | `getProjects(tree)` (or `readProjectConfiguration`) | The `@nx/devkit` `angular.json` polyfill normalizes `projectType` on read. |
| Wrap the generator as an Angular Rule | Hand-written `@angular-devkit/schematics` Rule | `convertNxGenerator(ngAddGenerator)` | Charter + D-01; adds no dependency and reuses the Nx generator. |
| A `Tree` `package.json`/`angular.json` edit | `node:fs` | `@nx/devkit` `readJson`/`updateJson`/`updateProjectConfiguration` | Must operate on the virtual Tree (works under `createTreeWithEmptyWorkspace` and the schematics engine). |

**Key insight:** Phase 23 writes almost no new logic -- it wires an idiomatic manifest field, an additive early-return, and a short composition loop over an already-shipped generator.

## Common Pitfalls

### Pitfall 1: `addDependenciesToPackageJson` silently fails to move deps -> devDeps
**What goes wrong:** Calling `addDependenciesToPackageJson(tree, {}, { 'angular-typechecker': v })` while the package sits in `dependencies` is a no-op for the devDeps bucket (filtered out because it exists in `dependencies`) AND leaves the `dependencies` entry intact. Net: still a prod dep.
**Why:** `filterExistingDependencies(devDependencies, currentPkg.dependencies)` drops any dep already present in the opposite bucket (`package-json.js` L100-107, L192-210).
**How to avoid:** Use the `ng-add.save` field + the defensive direct tree edit (delete from `dependencies`, set in `devDependencies`).
**Warning signs:** After `ng add`, `angular-typechecker` appears in `dependencies` (not `devDependencies`); or a second `npm install` runs during `ng add`.

### Pitfall 2: `init` "creates a stray `nx.json`" (the resolved in-corpus contradiction)
**What goes wrong:** Fear that running the shipped `init`/`updateNxJson` on an Angular CLI workspace writes an unwanted `nx.json`.
**Resolution (VERIFIED):** `nx@23.0.1` `updateNxJson` wraps its ENTIRE body in `if (tree.exists('nx.json'))` (`nx-json.js` L23-42) -- when absent it is a TOTAL no-op and creates nothing. `readNxJson` returns `null` (L10-13). FEATURES.md's "creates a stray nx.json" claim is FALSE.
**How to avoid:** Still add the explicit `tree.exists('angular.json')` fork (D-04) so the skip is by design, not incidental, and so the CLI branch can print the notice.
**Warning signs:** A test asserting no `nx.json` on the CLI branch (mirror `configuration-angular-cli.spec.ts`'s `assertCliSubstrate`).

### Pitfall 3: e2e / other project types wrongly wired (or wrongly assumed to be separate projects)
**What goes wrong:** Wiring a `typecheck` target into an e2e or non-app/lib project.
**Fact (confirmed):** Modern Angular CLI (v13+) has NO separate `*-e2e` project -- e2e is an `architect` TARGET inside the app project. Legacy separate e2e projects in `angular.json` carry NO `projectType` field. So a filter on `projectType in {application, library}` naturally excludes both cases; no special e2e-name matching is needed.
**How to avoid:** Filter strictly on `projectType`. A project with a missing/other `projectType` is skipped.
**Warning signs:** A test seeds a project with no `projectType` (or `projectType` other than app/lib) and asserts it gets NO target.

### Pitfall 4: `@nx/dependency-checks` flags the optional peers as obsolete (ACP-01)
**What goes wrong:** Adding `@angular-devkit/architect` + `rxjs` as peers turns `nx lint` red with `obsoleteDependency` errors.
**Why (VERIFIED):** The rule builds `expectedDependencyNames` from packages the plugin's CODE actually imports (`dependency-checks.js` L99). Those two are never imported by `src/` (the `require()`s live inside `@nx/devkit`), so they are not "expected" and the per-dependency visitor calls `reportObsoleteDependency` (L368-380). `checkObsoleteDependencies` defaults `true` (L57). `peerDependenciesMeta.optional` is NOT special-cased (the selector treats `dependencies`/`peerDependencies`/`optionalDependencies` uniformly).
**How to avoid (the exact lever):** Add both to `ignoredDependencies` in `eslint.config.mjs`'s `@nx/dependency-checks` block. `ignoredDependencies.includes(packageName)` short-circuits BEFORE the obsolete check (L371). `nx lint` is a required CI check (`maxWarnings: 0`) -- verify green.
**Warning signs:** `nx lint angular-typechecker` reports `The "@angular-devkit/architect" package is not used by "angular-typechecker" project.`

### Pitfall 5: `nx add` behavior accidentally changed
**What goes wrong:** Registering `ng-add` where Nx sees it, or dropping the `generators` field, changes `nx add`.
**Fact (VERIFIED):** `nx add` runs `<pkg>:init` (`add.js` -> `configure-plugins.js` L57-60 `g ${plugin}:init` via `getGeneratorInformation(plugin,'init',...)`; if no `init` generator it SKIPS). `getGeneratorInformation` uses `generators ?? schematics` (`generator-utils.js` L57), so with `generators.json` still declaring `init`, Nx never reads `collection.json`.
**How to avoid:** Keep `generators.json` unchanged (configuration + init); add `init`+`ng-add` to `collection.json` only; keep the `generators` field declared. Extend the surface-regression spec.
**Warning signs:** The regression spec asserts `manifest.generators === './generators.json'` and `generatorsManifest.generators.init.factory` still resolves.

## Code Examples

### ng-add collection.json entries (mirror the shipped `configuration` entry)
```jsonc
// packages/angular-typechecker/collection.json
{
  "$schema": "../../node_modules/@angular-devkit/schematics/collection-schema.json",
  "schematics": {
    "ng-add": {
      "factory": "./src/schematics/ng-add/schematic",
      "schema": "./src/generators/ng-add/schema.json",
      "description": "Add angular-typechecker and wire a typecheck target into every app + library project."
    },
    "configuration": {
      "factory": "./src/schematics/configuration/schematic",
      "schema": "./src/generators/configuration/schema.json",
      "description": "Wire a typecheck target into an Angular CLI project's angular.json."
    },
    "init": {
      "factory": "./src/schematics/init/schematic",
      "schema": "./src/generators/init/schema.json",
      "description": "Angular CLI init parity (no nx.json caching analog)."
    }
  }
}
```

### Thin re-exports (mirror src/schematics/configuration/schematic.ts)
```typescript
// src/schematics/init/schematic.ts
import { convertNxGenerator } from '@nx/devkit';
import initGenerator from '../../generators/init/generator';
export default convertNxGenerator(initGenerator);

// src/schematics/ng-add/schematic.ts
import { convertNxGenerator } from '@nx/devkit';
import ngAddGenerator from '../../generators/ng-add/generator';
export default convertNxGenerator(ngAddGenerator);
```

### Minimal ng-add schema (mirror init/schema.json shape)
```jsonc
// src/generators/ng-add/schema.json
{
  "$schema": "http://json-schema.org/schema",
  "$id": "NgAddGeneratorSchema",
  "title": "angular-typechecker ng-add",
  "cli": "nx",
  "type": "object",
  "properties": {
    "project": { "type": "string", "description": "Scope wiring to a single project (default: all app + library projects)." },
    "skipFormat": { "type": "boolean", "default": false, "description": "Skip formatting files after wiring." }
  },
  "additionalProperties": false
}
```
Schematic schemas (unlike Architect builder schemas) natively accept `cli:"nx"`/`$default`/`$id` (these are Angular-schematics conventions), so reusing the generator schema shape is safe -- the sanitized-schema concern (Pitfall 7) applies only to the BUILDER (Architect) schema, already handled in Phase 21.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ng add` moves deps in the schematic | `ng-add.save` manifest field controls install bucket | Angular 6+ (stable through 22.0.6) | RF-01 is a package.json field, not schematic code. |
| Separate `<app>-e2e` project in `angular.json` | e2e as an `architect` target within the app project | Angular CLI 13+ | `projectType` filter alone excludes e2e; no name-matching. |

**Deprecated/outdated:** none relevant. `convertNxGenerator` is current + non-deprecated in `@nx/devkit@23.0.1`.

## Runtime State Inventory

Not applicable -- Phase 23 is additive code/config only (new schematics + manifest fields). No rename/refactor/migration, no stored data, no OS-registered state, no secrets. The only artifact a CONSUMER may see is the `.nx/` cache dir the converted builder can materialize (documented tradeoff, Phase 24 e2e tolerates/cleans it -- ACP-01 doc scope).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ng generate angular-typechecker:init` / `:ng-add` are discoverable via the `package.json` `schematics` field at runtime (symmetric to the verified Nx path; not re-read from `@angular/cli` schematic-collection resolution this pass) | Architecture | LOW -- Phase 22's `configuration` schematic already ships via the same field; Phase 24 e2e is the real backstop. |
| A2 | The defensive package.json tree edit + returning void is sufficient for the install-skipped edge (no CLI post-schematic re-install expected on the normal path) | RF-01 / Pattern 2 | LOW -- verified `add/cli.js` has no post-schematic install except the `save===false` cleanup path (not ours). |

**Note:** The four load-bearing mechanics (RF-01 `ng-add.save`, RF-02 guard, init no-op, ACP-01 `ignoredDependencies`) are `[VERIFIED: installed source]`, not assumed.

## Open Questions

1. **Notice string location**
   - What we know: D-06 wants ONE shared string via `logger.info`, printed once by ng-add (init MAY reuse it).
   - What's unclear: whether to export it from `init/generator.ts` (co-located with `TYPECHECK_EXECUTOR_ID`) or a tiny shared const module.
   - Recommendation: export a `NO_CACHING_NOTICE` const from `init/generator.ts` (fewest files); planner discretion.

2. **`ng-add --project` scope**
   - What we know: default + tested behavior is auto-wire-ALL (NGADD-01); optional `--project` is a nice-to-have (Claude's discretion).
   - Recommendation: include `project?` in the schema; when set, wire only that project (still via `configurationGenerator`); test the all-projects default as the primary case.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x via `@nx/vitest:test` |
| Config file | `packages/angular-typechecker/vitest.config.mts` (fast tier; `include: src/**/*.spec.ts`, `exclude: **/*.integration.spec.ts`, `jsdom`) |
| Quick run command | `npx nx test angular-typechecker` |
| Full suite command | `npx nx test angular-typechecker && npx nx integration angular-typechecker && npx nx lint angular-typechecker` |

All Phase 23 specs are FAST tier (Tree-based, no real `@angular/compiler-cli`). They mirror `configuration-angular-cli.spec.ts` (angular.json-seeded `createTreeWithEmptyWorkspace` + `tree.delete('nx.json')`) and the two `nx-*surface-regression.spec.ts` static reads. No new integration-tier (real-compiler) spec is required for this phase's surface; end-to-end `ng add`/`ng run` proof is Phase 24.

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NGADD-01 | ng-add auto-wires EVERY application + library project (leaf arrays per project) | integration (Tree) | `npx nx test angular-typechecker ng-add` | Wave 0 (new `src/generators/ng-add/ng-add.spec.ts`, mirror `configuration-angular-cli.spec.ts`) |
| NGADD-01 | idempotent re-run of OUR target; throws on a same-named NON-ours target | integration (Tree) | `npx nx test angular-typechecker ng-add` | Wave 0 |
| NGADD-01 | skips e2e/other project types (missing/other `projectType`) | integration (Tree) | `npx nx test angular-typechecker ng-add` | Wave 0 |
| NGADD-01 | ensures the devDependency: `package.json` `ng-add.save === devDependencies` (static) AND defensive move deps->devDeps when already installed (Tree) | unit + static | `npx nx test angular-typechecker ng-add` | Wave 0 |
| NGADD-01 (RF-02) | on a tree WITHOUT `angular.json`: no target wiring, no `nx.json`, devDep-ensure + guidance only | integration (Tree) | `npx nx test angular-typechecker ng-add` | Wave 0 |
| NGADD-01 | prints the no-caching notice ONCE (spy on `logger.info`) | unit | `npx nx test angular-typechecker ng-add` | Wave 0 |
| ACS-03 | init CLI fork: on `angular.json` tree seeds NO caching, creates NO stray `nx.json` | integration (Tree) | `npx nx test angular-typechecker init` | Wave 0 (extend `init.spec.ts` / new `init-angular-cli.spec.ts`) |
| ACS-03 | init Nx branch byte-unchanged (existing seed behavior still passes) | integration (Tree) | `npx nx test angular-typechecker init` | Exists (`init.spec.ts`, `target-defaults-drift.spec.ts`) |
| ACS-03 / NGADD-01 | `collection.json` declares `init` + `ng-add`; `generators.json` still declares `init`; `nx add`/`nx g` resolve via `generators` (nx add UNCHANGED) | static | `npx nx test angular-typechecker surface-regression` | Wave 0 (extend `nx-generators-surface-regression.spec.ts`) |
| ACP-01 | `@nx/dependency-checks` green after optional peers | lint gate | `npx nx lint angular-typechecker` | Exists (CI gate) |
| ACP-01 | `package.json` declares both optional peers + `peerDependenciesMeta.optional: true` | static | `npx nx test angular-typechecker` (new static spec) | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx nx test angular-typechecker <changed-spec-pattern>` (fast tier, sub-30s).
- **Per wave merge:** `npx nx test angular-typechecker && npx nx lint angular-typechecker`.
- **Phase gate:** full suite (test + integration + lint) green + `format:check` before `/gsd:verify-work`. (Project memory: verification often skips `format:check` + `lint` -- both are required CI gates at `maxWarnings:0`; run them.)

### Wave 0 Gaps
- [ ] `src/generators/ng-add/ng-add.spec.ts` -- covers NGADD-01 (auto-wire-all, idempotency, skip-existing/e2e, devDep move, RF-02 no-angular.json guard, notice-once). Mirror `configuration-angular-cli.spec.ts`.
- [ ] `src/generators/init/init-angular-cli.spec.ts` (or extend `init.spec.ts`) -- covers ACS-03 (no stray nx.json on the CLI branch).
- [ ] Extend `src/schematics/configuration/nx-generators-surface-regression.spec.ts` -- assert `collection.json` now declares `init` + `ng-add` and `generators.json` still resolves `init` (nx add unchanged).
- [ ] Static spec asserting `package.json` `ng-add.save`, the two optional peers, and `peerDependenciesMeta` (ACP-01 + RF-01).
- [ ] Framework install: none -- Vitest infra already present.

## Security Domain

Low security surface: schematics edit `angular.json` + `package.json` on a virtual Tree; no network, no secrets, no auth, no user-supplied code execution.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | Schema (`schema.json` `additionalProperties: false`) validates ng-add/init options; the empty/whitespace `--targetName` guard is inherited from `configurationGenerator`. |
| V12 File/Resource | minor | All writes go through `@nx/devkit` Tree helpers (`updateJson`/`updateProjectConfiguration`), never `node:fs`; no path traversal from user input beyond the existing `resolveTsConfigOverride` located-error probe. |
| V6 Cryptography | no | -- |
| V2/V3/V4 Auth/Session/Access | no | -- |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed `angular.json` / missing project | Denial of Service (bad UX) | `configurationGenerator` throws clear located errors; ng-add filters by `projectType` and existence-probes leaves. |
| Redundant `npm install` triggered by a schematic task | Tampering (unexpected lockfile churn) | Return VOID from `ngAddGenerator`; do NOT schedule a `RunCallbackTask` install (Pattern 2). |

No `security_enforcement: false` in config -- section included per default-enabled policy.

## Project Constraints (from CLAUDE.md / AGENTS.md)
- **ADDITIVE-ONLY charter:** no breaking change to the executor id `angular-typechecker:typecheck`, `runTypecheck`/`CoreResult`/`CoreOptions`, or existing schemas. `feat` under 0.x -> `0.2.0 -> 0.2.1` (patch, per the 0.x adjust-semver-bump). `ng-add`/`init`/peer additions are all additive.
- **Stack pinned:** Nx 23.0.1, Angular 22.x, TS `>=6.0.0 <6.1.0`, Node `^22.22.3 || ^24.15.0 || ^26.0.0`. Verify only against STABLE Angular 22 (22.0.4), never next/rc (MEMORY: stable-only).
- **Module format:** CommonJS + `module: nodenext`; new files under `src/schematics/` and `src/generators/` compile via the existing `tsconfig.lib.json`.
- **Content search:** `git grep` for tracked files; `rg -uu` inside `node_modules` (git grep cannot see it); never `grep`. Windows shell rules (no emojis/unicode; Write tool for file creation).
- **`@nx/dependency-checks` autofix:** NEVER run `eslint --fix` blindly on the manifest (`checkVersionMismatches:false` guards the public peer ranges from being rewritten to installed exacts). Add `ignoredDependencies` by hand.
- **Public email hygiene:** author/contact = `larsbrinknielsen@gmail.com` only; never the work domain in committed content/messages/identity.
- **GSD workflow:** file edits go through a GSD command; commit STATE.md after planning; run secure + validate + extract-learnings after execute.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@nx/devkit` (`convertNxGenerator`, `getProjects`) | ng-add + init re-exports | yes | 23.0.1 (pinned dep) | -- |
| `@angular/cli` (real `ng add`/`ng generate`) | Phase 24 e2e only (NOT Phase 23) | yes (dev) | 22.0.6 | -- |
| `@angular-devkit/architect` / `rxjs` | converted builder runtime (declared optional peers) | yes | 0.2200.6 / 7.8.2 | present in any Angular CLI workspace |
| Vitest (`@nx/vitest:test`) | all Phase 23 specs | yes | 4.x | -- |
| `bluehalo/ngx-leaflet` clone | dev/debug sanity-check only (uncommitted) | yes (local, uncommitted) | Angular 22 @ 818e9ae | the angular.json-seeded Tree spec is the CI-authoritative proof |

No blocking missing dependencies. All Phase 23 verification runs on the virtual Tree in the fast Vitest tier -- no external clone or real CLI needed.

## Sources

### Primary (HIGH confidence -- read directly on disk this pass)
- `node_modules/@angular/cli@22.0.6/src/commands/add/cli.js` -- `ng add` flow: `savePackage = manifest['ng-add']?.save` (L461); `packageManager.add(pkg, 'none', savePackage === 'devDependencies', ...)` (L529); install skipped when already installed + valid (L167-175); `shouldCleanUp` only when `save === false` (L226-289); no post-schematic install on the normal path.
- `node_modules/@angular/cli@22.0.6/src/package-managers/package-manager.js` L259-271 -- `add(packageName, save, asDevDependency, ...)`; `asDevDependency -> saveDevFlag`.
- `node_modules/@angular-eslint/schematics/package.json` -- real precedent: `"ng-add": { "save": "devDependencies" }`.
- `node_modules/@nx/devkit@23.0.1/dist/src/utils/invoke-nx-generator.js` -- `convertNxGenerator` surfaces a returned callback as a `RunCallbackTask` only when `context.engine.workflow` is truthy (L55-59); returns void otherwise; `DevkitTreeFromAngularDevkitTree` adapter.
- `node_modules/@nx/devkit@23.0.1/dist/src/utils/package-json.js` -- `addDependenciesToPackageJson` (L192-228) + `filterExistingDependencies` (L100-107): cannot move deps->devDeps; returns an `installPackagesTask` callback.
- `node_modules/nx@23.0.1/dist/src/generators/utils/nx-json.js` L10-42 -- `updateNxJson` TOTAL no-op when `nx.json` absent (creates nothing); `readNxJson` returns null.
- `node_modules/nx@23.0.1/dist/src/command-line/generate/generator-utils.js` L57 -- `generators ?? schematics` precedence.
- `node_modules/nx@23.0.1/dist/src/command-line/add/add.js` + `.../init/configure-plugins.js` L57-72 -- `nx add` runs `g <pkg>:init` via `getGeneratorInformation(plugin,'init',...)`; skips if no `init` generator. Confirms `nx add` UNCHANGED.
- `node_modules/@nx/eslint-plugin/dist/src/rules/dependency-checks.js` -- `checkObsoleteDependencies` default true (L57); `expectedDependencyNames` = imported packages (L99); `reportObsoleteDependency` for declared-but-unimported (L294-380); `ignoredDependencies` short-circuits (L371); `peerDependenciesMeta.optional` NOT special-cased.
- Repo source: `packages/angular-typechecker/{package.json, collection.json, generators.json, builders.json, project.json, eslint.config.mjs, vitest.config.mts}`; `src/generators/{init,configuration}/generator.ts` + schemas; `src/schematics/configuration/{schematic.ts, nx-generators-surface-regression.spec.ts}`; `src/generators/configuration/configuration-angular-cli.spec.ts`; `src/generators/init/init.spec.ts`; `src/builders/typecheck/{builder.ts, schema.json, nx-surface-regression.spec.ts}`.
- `registry.npmjs.org` (2026-07-10): `@angular-devkit/architect` latest `0.2200.6`, `rxjs` latest `7.8.2` (both match installed).

### Secondary (MEDIUM confidence)
- `.planning/research/v0.2.1-angular-cli/{SUMMARY,ARCHITECTURE,PITFALLS,STACK}.md` -- the locked milestone design (CORRECTION point 3, Pitfall 3-6, dependency-classification call).
- `.planning/phases/22-*/22-CONTEXT.md` -- the shared write-fork ng-add composes; RF-01 leaf resolution.
- `.claude/skills/spike-findings-angular-typechecker/SKILL.md` -- GATE A' = GO (Phase 21 builder bridge).

## Metadata

**Confidence breakdown:**
- RF-01 (devDependency): HIGH -- `ng add` install flow + `ng-add.save` read directly from `@angular/cli@22.0.6`; `addDependenciesToPackageJson` limitation read from `@nx/devkit` source; real precedent found.
- RF-02 (no-angular.json guard): HIGH -- guard is trivial + Nx `nx add` -> `init` path source-verified.
- init no-op: HIGH -- `updateNxJson` early-return read directly (`nx-json.js` L23-42).
- ACP-01 lever: HIGH -- `ignoredDependencies` short-circuit read directly from the rule source.
- Consumer-side schematic discovery (`ng generate`/`ng add` resolution): MEDIUM -- symmetric to the verified Nx path; Phase 24 e2e is the backstop.

**Research date:** 2026-07-10
**Valid until:** 2026-08-09 (stable stack; re-verify only if `@angular/cli`, `@nx/devkit`, or `nx` majors move).
