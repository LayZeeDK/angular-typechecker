# Stack Research

**Domain:** Nx devkit plugin exposing its executor + generators to a non-Nx Angular CLI (`angular.json`) workspace (additive milestone v0.2.1)
**Researched:** 2026-07-10
**Confidence:** HIGH

> Scope note: this is the STACK dimension for a SUBSEQUENT, ADDITIVE-ONLY milestone.
> The existing engine/stack (Nx 23.0.1, Angular 22.0.4, TS 6.0.3, Node 22/24/26,
> `@nx/devkit` pinned dependency, `@angular/compiler-cli`+`typescript` peers,
> Vitest 4) is treated as GIVEN and is NOT restated here. The v0.0.1 stack research
> lives in `.planning/research/STACK.md` (root). This file only covers what the
> Angular CLI surface ADDS.

## Headline finding (read first)

**No new runtime `dependencies` are required.** Both conversion APIs already ship
in the pinned `@nx/devkit@23.0.1` you already depend on:

- `convertNxExecutor(executor)` -> Angular Devkit **Builder**. EXISTS, exported from
  the `@nx/devkit` public API, **NOT deprecated** (verified in the installed source and
  on nx.dev). Its returned builder internally `require('@angular-devkit/architect').createBuilder(...)`
  and `require('rxjs').Observable(...)` **at runtime** -- so those two packages must be
  RESOLVABLE in the consumer workspace when the builder runs. In any Angular CLI
  (`angular.json`) workspace they always are (the CLI ships `@angular-devkit/architect@0.2200.x`,
  which depends on `rxjs`), so they are OPTIONAL PEERS satisfied by the consumer, NOT
  hard deps of this plugin.
- `convertNxGenerator(generator, skipWritingConfigInOldFormat?)` -> Angular Devkit
  **Schematic RuleFactory** (`(opts) => (tree, context) => Promise`). EXISTS, exported,
  **NOT deprecated**. Its PRODUCTION path requires **no** `@angular-devkit/*` package --
  it adapts the Angular schematic `Tree`/`context` the CLI hands it. (The only
  `require('@angular-devkit/schematics/testing')` is inside a `try/catch` used solely to
  special-case `UnitTestTree` during testing; it is non-fatal when absent.)

So the milestone is genuinely "thin re-export": three new tiny wrapper modules
(`export default convertNxExecutor(...)` / `convertNxGenerator(...)`) plus two new
manifest files (`builders.json`, `collection.json`) and two new `package.json` fields.
Zero new production dependencies; a couple of OPTIONAL peers for honesty; Angular CLI
tooling as DEV-only deps for the e2e proof.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@nx/devkit` `convertNxExecutor` | ships in `@nx/devkit@23.0.1` (already a pinned dep) | Re-export the Nx `typecheck` executor as an Angular CLI builder | Import path `import { convertNxExecutor } from '@nx/devkit'` (confirmed `typeof === 'function'` at runtime). Signature `convertNxExecutor(executor: Executor): any`. Milestone-mandated path; NOT deprecated. |
| `@nx/devkit` `convertNxGenerator` | ships in `@nx/devkit@23.0.1` (already a pinned dep) | Re-export `configuration`/`init` (and a new `ng-add`) as Angular CLI schematics | Import path `import { convertNxGenerator } from '@nx/devkit'`. Signature `convertNxGenerator<T=any>(generator: Generator<T>, skipWritingConfigInOldFormat?: boolean): (opts: T) => (tree, context) => Promise<any>`. No `@angular-devkit/*` runtime dep. NOT deprecated. |
| `@angular-devkit/architect` | `^0.2200.0` (latest `0.2200.6`; Angular CLI 22 window) | Runtime host for the converted builder (`createBuilder`) | Required ONLY at runtime by `convertNxExecutor`'s output. Present in every Angular CLI workspace (a direct dep of `@angular/cli@22.x`). Declare OPTIONAL peer -- do NOT bundle. Note the `0.22xx.x` version scheme (NOT `22.x`). |
| `rxjs` | `^7.8.0` (Angular 22 window ships `7.8.2`) | The converted builder returns an rxjs `Observable` | Required at runtime by `convertNxExecutor`'s output. Present in every Angular CLI / Angular workspace (`@angular/core@22.0.4` peer `^6.5.3 \|\| ^7.4.0`; architect deps `rxjs@7.8.2`). Declare OPTIONAL peer. |

### Supporting Libraries (DEV-only -- the e2e Angular CLI harness, never shipped)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@angular/cli` | `^22.0.0` (latest `22.0.6`) | Provides `ng add` / `ng generate` / `ng run` for the real-OSS e2e proof | devDependency in the e2e harness / used inside the cloned OSS `angular.json` fixture. Pairs with framework 22.0.4 (CLI patch may lead the framework patch -- normal). |
| `@angular-devkit/core` | `22.0.6` | Transitive of architect/CLI; workspace (`angular.json`) reader used by the builder host | Comes in via `@angular/cli`; never declared by this plugin. Listed for compatibility awareness. |
| `@angular-devkit/schematics` | `22.0.6` | Schematic engine the CLI uses to run the converted schematics | Comes in via `@angular/cli`; only the `/testing` subpath is (optionally) touched by `convertNxGenerator` in test mode. |
| `@schematics/angular` | `22.0.6` | Angular's own schematic utilities | **Do NOT depend on it** for the ng-add (see "What NOT to Use"). Present only as a CLI transitive; listed so it is not mistaken for a needed dep. |
| `verdaccio` | `6.7.x` (already used by the Nx e2e tier) | Local registry to install the packed tarball into the Angular CLI fixture | Reuse the existing tarball-e2e machinery; the Angular-CLI e2e installs the SAME tarball into an `angular.json` workspace. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `@nx/dependency-checks` (already wired) | Polices the published `package.json` deps | It reads DIRECT imports in `src/`. The wrappers only `import` from `@nx/devkit` (already a dep), so it will NOT flag `@angular-devkit/architect`/`rxjs` (never imported directly). Add both to the rule's `ignoredDependencies` **only if** you also declare them as optional peers and the rule complains about undeclared-but-listed peers -- otherwise leave untouched. |
| `publint` / `attw` (existing tarball audit) | Verify the added `builders`/`schematics` fields + new files publish correctly | Extend the D-13 tarball audit to assert `builders.json`, `collection.json`, and the wrapper `.js`/`.d.ts` are in the packed tarball and that both new `package.json` fields resolve. |

## Published `package.json` wiring (the shipped artifact)

Add TWO fields beside the existing `executors`/`generators` (keep those unchanged -- the
Nx surface must not regress):

```jsonc
{
  // ... existing fields ...
  "executors": "./executors.json",     // Nx surface (UNCHANGED)
  "generators": "./generators.json",   // Nx surface (UNCHANGED)
  "builders": "./builders.json",       // NEW: Angular CLI builder discovery (ng run)
  "schematics": "./collection.json",   // NEW: Angular CLI schematic + ng add discovery
  "files": [
    "src", "executors.json", "generators.json",
    "builders.json", "collection.json",  // NEW: whitelist the two manifests
    "README.md", "LICENSE"
  ],
  "peerDependencies": {
    "@angular/compiler-cli": "^22.0.0",
    "typescript": ">=6.0.0 <6.1.0",
    "@angular-devkit/architect": "^0.2200.0", // NEW (optional)
    "rxjs": "^7.8.0"                            // NEW (optional)
  },
  "peerDependenciesMeta": {                     // NEW
    "@angular-devkit/architect": { "optional": true },
    "rxjs": { "optional": true }
  }
}
```

Why optional peers (not deps, not required peers): an Nx-only consumer must NOT be forced
to install Angular CLI internals it will never use; an Angular CLI consumer already has
both at the right version. Optional peers document the requirement without creating install
friction or version skew. (Mirrors the `peerDependenciesMeta` pattern `@analogjs/platform`
uses.)

### `builders.json` (NEW -- Angular CLI builder manifest)

Verified shape against the installed `@angular/build/builders.json`:

```jsonc
{
  "$schema": "./node_modules/@angular-devkit/architect/src/builders-schema.json", // optional; often omitted
  "builders": {
    "typecheck": {
      "implementation": "./src/builders/typecheck/builder",   // extensionless; CLI require()s it
      "schema": "./src/executors/typecheck/schema.json",       // REUSE the existing executor schema
      "description": "Type-checks an Angular project (TypeScript + template + extended NG8xxx) with no emit."
    }
  }
}
```

The builder module (`src/builders/typecheck/builder.ts`) is the thin re-export:

```ts
import { convertNxExecutor } from '@nx/devkit';
import typecheckExecutor from '../../executors/typecheck/executor';

export default convertNxExecutor(typecheckExecutor);
```

An `angular.json` project consumes it as `"builder": "angular-typechecker:typecheck"` and
runs via `ng run <project>:typecheck`. The compiled output stays CJS (existing
`module: nodenext` constraint) -- Angular's architect loads builders with `require()`, same
as Nx, so the existing CJS-executor constraint carries over unchanged.

### `collection.json` (NEW -- Angular CLI schematics manifest, incl. `ng-add`)

Verified shape against the installed `@angular-eslint/schematics` collection (`ng-add` entry)
and `@schematics/angular`:

```jsonc
{
  "$schema": "./node_modules/@angular-devkit/schematics/collection-schema.json", // optional
  "schematics": {
    "ng-add": {
      "factory": "./src/schematics/ng-add/schematic",
      "schema": "./src/schematics/ng-add/schema.json",
      "description": "Add angular-typechecker to an Angular CLI workspace."
    },
    "configuration": {
      "factory": "./src/schematics/configuration/schematic",
      "schema": "./src/generators/configuration/schema.json", // REUSE existing generator schema
      "description": "Wire a typecheck builder target into an angular.json project."
    },
    "init": {
      "factory": "./src/schematics/init/schematic",
      "schema": "./src/generators/init/schema.json",
      "description": "Angular CLI init (no nx.json caching analog -- see note)."
    }
  }
}
```

Each `factory` module is a `convertNxGenerator` re-export, e.g.:

```ts
import { convertNxGenerator } from '@nx/devkit';
import { configurationGenerator } from '../../generators/configuration/generator';

export const configuration = convertNxGenerator(configurationGenerator);
```

**How `ng add` finds it:** `ng add angular-typechecker` installs the package, reads the
`package.json` `schematics` field -> `collection.json`, and runs the schematic literally
named **`ng-add`**. Confirmed against `@angular-eslint/schematics`:
`"ng-add": { "factory": "./ng-add", "schema": "./ng-add/schema.json", ... }`. `ng generate
angular-typechecker:configuration` resolves the same collection.

## Two integration hazards to design around (flag for the roadmap / a spike)

1. **`package.json` field collision (Nx vs Angular CLI).** Nx historically treats the
   `builders` field as an alias for `executors`, and `schematics` as an alias for
   `generators`. Adding `builders`/`schematics` that point at Angular-shaped manifests
   whose factories are the `convertNx*` wrappers COULD make the Nx loader try to register
   the Angular collection too, or prefer the wrong manifest. This is the single most likely
   way to accidentally break the (must-not-regress) Nx surface. Mitigation: keep the four
   manifests as SEPARATE files (`executors.json`/`generators.json` for Nx unchanged;
   `builders.json`/`collection.json` new for Angular CLI), and add a regression assertion
   that `nx g angular-typechecker:configuration` and `nx run <p>:typecheck` still resolve
   after the fields are added. Confidence this is a real risk: MEDIUM (Nx alias behavior is
   version-sensitive) -- verify empirically in a phase spike, do not assume.

2. **No Nx caching analog on `angular.json`.** The existing `init` seeds `nx.json`
   `targetDefaults` (cacheable block) -- there is no `angular.json` equivalent. The Angular
   CLI `ng-add`/`init`/`configuration` path must WIRE the builder target into the project's
   `architect`/`targets` and SKIP the Nx-only caching seed. This is a behavioral fork, not a
   stack choice, but it means the converted `init` generator cannot just replay its Nx body
   verbatim -- the roadmap must define the angular.json branch. (STACK impact: none new;
   noted so the "thin re-export" framing isn't mistaken for "identical behavior".)

## Installation

```bash
# Runtime deps to ADD to the published plugin: NONE.
# (convertNxExecutor / convertNxGenerator already ship in the pinned @nx/devkit@23.0.1.)

# Optional peers to DECLARE in packages/angular-typechecker/package.json (metadata only,
# satisfied by the consumer's Angular CLI workspace -- nothing to `npm install` here):
#   "@angular-devkit/architect": "^0.2200.0"  (optional)
#   "rxjs": "^7.8.0"                            (optional)

# DEV-only, for the real-OSS Angular CLI e2e harness (NOT shipped):
npm install -D @angular/cli@^22.0.0
# verdaccio@^6.7.0 is already present for the tarball tier.
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@angular-devkit/architect`+`rxjs` as OPTIONAL peers | Declare them as hard `dependencies` | Never for this plugin -- would bloat/duplicate for Nx-only consumers and risk version skew against the consumer's Angular CLI. Only if you ever ship a STANDALONE (no-workspace) builder host, which is out of scope. |
| `convertNxExecutor` thin re-export | Hand-written `@angular-devkit/architect` `createBuilder` | Never here -- the milestone explicitly mandates the `convertNx*` path; a hand-written builder duplicates logic and adds a direct `@angular-devkit/architect` dep. |
| `convertNxGenerator` re-export for `ng-add` | Native `@schematics/angular/utility` schematic (`addPackageJsonDependency`, `addRootProvider`) | Never for the mandated path -- adds a direct `@schematics/angular` dep and diverges from the shared generator body. Only if a future ng-add needs Angular-specific scaffolding the Nx generator API cannot express. |
| Reuse existing `schema.json` files for builder/schematics | Author new Angular-specific schemas | Only if the Angular CLI surface needs options the Nx schema lacks; for a thin re-export the shared schema is correct and avoids drift. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Hand-written `@angular-devkit/architect` `createBuilder(...)` | Duplicates the Nx executor logic; adds a direct architect dep; the milestone mandates a thin re-export | `export default convertNxExecutor(typecheckExecutor)` |
| Hand-written `@angular-devkit/schematics` `Rule` / native `@schematics/angular` ng-add | Diverges from the shared generator body; adds direct `@angular-devkit/schematics` / `@schematics/angular` deps | `convertNxGenerator(<existing nx generator>)` re-exports in `collection.json` |
| `@angular-devkit/architect` / `rxjs` in `dependencies` | Forces Angular CLI internals onto Nx-only consumers; version-skew risk vs the consumer's CLI | OPTIONAL `peerDependencies` + `peerDependenciesMeta.optional` |
| Reusing `executors.json`/`generators.json` for the Angular CLI (or vice-versa) | Nx executor/generator FACTORIES are not Angular builders/schematics -- the `implementation`/`factory` targets differ (Nx executor vs `convertNx*` wrapper) | Separate `builders.json` + `collection.json` whose entries point at the `convertNx*` wrapper modules |
| Assuming Nx ignores the new `builders`/`schematics` fields | Nx may alias `builders`->`executors` and `schematics`->`generators`, risking the must-not-regress Nx surface | Keep manifests separate AND add an Nx-surface regression assertion (spike-verify the alias behavior on Nx 23.0.1) |
| `@angular-devkit/architect@22.x` (major-style version) | architect uses the `0.22xx.x` scheme, NOT `22.x` -- `22.x` does not exist | `@angular-devkit/architect@^0.2200.0` |

## Stack Patterns by Variant

**If the consumer is a pure Angular CLI (`angular.json`, no Nx):**
- `@angular-devkit/architect` + `rxjs` are already installed (CLI + Angular bring them).
- The converted builder/schematics resolve those from the consumer's `node_modules`.
- Because there is no `nx.json`, the `init`/`ng-add` path wires `architect` targets and
  skips caching (fork #2 above).

**If the consumer is an Nx workspace with `@nx/angular`:**
- The existing Nx surface (`nx add`, `nx g`, `nx run`) is the primary path and is unchanged.
- `@angular-devkit/architect` is present via `@nx/angular`, so the builder would also work,
  but Nx consumers should keep using the executor. The optional peers stay satisfied.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@nx/devkit@23.0.1` | `convertNxExecutor` / `convertNxGenerator` | Both present + exported + non-deprecated; verified in installed `dist/public-api.*` and by `require('@nx/devkit')` returning both as functions. |
| `@angular/cli@22.0.6` | `@angular-devkit/architect@0.2200.6`, `@angular-devkit/core@22.0.6`, `@angular-devkit/schematics@22.0.6`, `@schematics/angular@22.0.6` | Exact direct deps of `@angular/cli@22.0.6` (registry-verified). rxjs is transitive (architect deps `rxjs@7.8.2`). |
| `@angular-devkit/architect@0.2200.x` | `rxjs@7.8.2`, `@angular-devkit/core@22.0.x` | Its only two deps; no peerDependencies. |
| `@angular/core@22.0.4` | `rxjs ^6.5.3 \|\| ^7.4.0` (peer) | Guarantees rxjs 7.x is present in any Angular 22 workspace. |
| Angular framework `22.0.4` vs CLI `22.0.6` | Compatible (same 22.0 minor) | CLI patch leading the framework patch is normal; pin the e2e harness to `@angular/cli@^22.0.0`. |

## Sources

- Installed `node_modules/@nx/devkit@23.0.1` source (`dist/public-api.d.ts`, `dist/public-api.js`, `dist/src/utils/convert-nx-executor.{d.ts,js}`, `dist/src/utils/invoke-nx-generator.{d.ts,js}`, `dist/index.d.ts`) -- HIGH: both APIs exist, are exported from `@nx/devkit`, carry no `@deprecated` tag; `convertNxExecutor` runtime-requires `@angular-devkit/architect`+`rxjs`; `convertNxGenerator` requires no `@angular-devkit/*` in production (only guarded `/testing`); `require('@nx/devkit')` confirmed both as functions.
- `@nx/devkit@23.0.1` `package.json` (installed) -- HIGH: only peer is `nx`; NO `@angular-devkit/*`/`rxjs` declared -> they must come from the consumer.
- npm registry (`registry.npmjs.org`), fetched 2026-07-10 -- HIGH: `@angular/cli latest 22.0.6` (deps architect `0.2200.6`, core `22.0.6`, schematics `22.0.6`, @schematics/angular `22.0.6`); `@angular-devkit/architect latest 0.2200.6` (deps `rxjs@7.8.2`, core `22.0.6`, no peers); `@angular-devkit/core`/`@angular-devkit/schematics`/`@schematics/angular` latest `22.0.6`; `@angular/core@22.0.4` peer `rxjs ^6.5.3 || ^7.4.0`.
- Installed manifest shapes -- HIGH: `@angular/build/builders.json` (`implementation`/`schema`/`description`), `@angular-eslint/schematics` `collection.json` `ng-add` entry (`factory`/`schema`/`description`) + its `package.json` `"schematics": "./dist/collection.json"`, `@angular-devkit/architect/src/builders-schema.json` + `@angular-devkit/schematics/collection-schema.json` `$schema` targets.
- nx.dev `convertNxExecutor` API doc (WebFetch, 2026-07-10) -- MEDIUM: documented as current (not deprecated), signature `convertNxExecutor(executor: Executor): any`.

---
*Stack research for: Angular CLI (`angular.json`) surface for an Nx devkit plugin (v0.2.1, additive)*
*Researched: 2026-07-10*
