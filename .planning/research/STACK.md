# Stack Research

**Domain:** Nx plugin (single executor) authoring + publishing, Angular ecosystem, 2026
**Researched:** 2026-06-27
**Confidence:** HIGH (versions verified against npm registry 2026-06-27; conventions cross-checked against official Nx docs + two real published plugins: `@push-based/nx-verdaccio` Nx 22.3.1 and `@analogjs/platform` v2.6.2 / Angular 22)

> Scope note: PROJECT.md already locks Nx 23 / Angular 22 / TS 6 / Node ranges / Vitest / CJS-executor-with-`await import()` / `nx release` / MIT. This file does NOT re-derive those. It supplies the **supporting toolchain + Nx-plugin packaging conventions** and tags each finding `[confirms PROJECT.md]`, `[adds]`, or `[contradicts]`. The one item that needs a PROJECT.md edit is the `@nx/devkit` / `nx` dependency classification (see "What NOT to Use" #1 and Version Compatibility).

---

## Headline finding (read first)

`[contradicts]` **PROJECT.md says "`nx`/`@nx/devkit` as peerDependencies." The official Nx publish-plugin recipe says the opposite, and so do the real plugins.**

The canonical rule from `nx.dev/docs/extending-nx/publish-plugin`:

> Include `@nx/devkit` as a **`dependency`** (not a `peerDependency`) so your plugin pins the tested version. Do **NOT** list `nx` as a direct dependency **or** a peerDependency at all -- `@nx/devkit` carries the `nx` version range for you.

Evidence (npm registry, 2026-06-27):
- `@nx/devkit@23.0.1` declares `nx` as a **peerDependency**: `">= 22 <= 24 || ^23.0.0-0"`. So when your plugin depends on `@nx/devkit`, the consumer's `nx` is satisfied transitively through that peer -- you never declare `nx` yourself.
- `@nx/plugin@23.0.1` lists `@nx/devkit`, `@nx/js`, `@nx/eslint`, `@nx/jest` all as **exact-pinned `dependencies`** (`"23.0.1"`), zero peerDependencies.
- `@push-based/nx-verdaccio` ships `"dependencies": { "nx": "22.3.1", "@nx/plugin": "22.3.1", "tslib": "2.8.1" }` and only `@nx/js` as a peer.

`@angular/compiler-cli` and `typescript` as peerDependencies remains correct `[confirms PROJECT.md]` -- those genuinely must resolve from the consumer workspace to avoid version skew. But `nx`/`@nx/devkit` should move to `dependencies`. **Recommended edit to PROJECT.md:** "`@angular/compiler-cli` and `typescript` as peerDependencies; `@nx/devkit` as a pinned `dependency`; do not declare `nx` at all (devkit's peer carries it)."

---

## Recommended Stack

### Core Technologies (supporting toolchain -- the locked stack lives in PROJECT.md)

| Technology | Version (2026-06-27) | Purpose | Why Recommended |
|------------|----------------------|---------|-----------------|
| `@nx/devkit` | `23.0.1` (pin exact) | Plugin authoring API (`ExecutorContext`, `logger`, `readJsonFile`, etc.) | `[adds]` Ship as a pinned `dependency`. Its own `nx` peer (`>= 22 <= 24 || ^23.0.0-0`) is what satisfies the consumer's Nx -- you never declare `nx`. |
| `@nx/js` (`@nx/js:tsc`) | `23.0.1` | Build executor for the plugin library | `[confirms PROJECT.md (compiled .js)]` Official + default builder for plugins; emits CJS `.js` + `.d.ts` via native `tsc`. Both reference plugins use `@nx/js:tsc`. NOT esbuild/swc (see "What NOT to Use"). |
| `@nx/plugin` | `23.0.1` | Generators: `@nx/plugin:plugin` (scaffold), `@nx/plugin:executor` (scaffold the executor) | `[adds]` Use as a **devDependency** in your repo to scaffold; it is not shipped. `@nx/plugin:executor` is `path`-based in Nx 23 and supports `--unitTestRunner=vitest`. |
| `@nx/vitest` | `23.0.1` | Vitest test executor (`@nx/vitest:test`) | `[adds]` In Nx 22.2 Nx **split Vitest out of `@nx/vite` into a dedicated `@nx/vitest` package** (verified: `@nx/vitest@23.0.1` exists; nx-verdaccio carries the `migrate-vitest-to-vitest-package` migration). On Nx 23 use `@nx/vitest:test`, NOT `@nx/vite:test`. |
| `@nx/eslint` | `23.0.1` | Lint executor + flat config + `@nx/dependency-checks` rule | `[adds]` Provides the publishable-package dependency linter (see below). Peer-depends on `vite`/`vitest`/itself. |
| `vitest` | `4.1.9` (latest) | Test runner | `[confirms PROJECT.md]` `@nx/vitest@23.0.1` peer accepts `^3.0.0 || ^4.0.0`. Use 4.x. |
| `tslib` | `^2.3.0` (latest `2.8.1`) | Runtime helper for `importHelpers` | `[adds]` Standard `dependency` in every Nx-generated lib/plugin. Pair with `"importHelpers": true`. |
| TypeScript | `6.0.3` (latest; range `>=6.0.0 <6.1.0`) | Compiles the plugin AND is a runtime peer | `[confirms PROJECT.md]` Latest in the locked window is `6.0.3`. (TS 7 is `7.0.1-rc` / `next`; out of scope per PROJECT.md.) |
| `@angular/compiler-cli` | `22.0.4` (latest; `22.1.0-next.3` on `next`) | The type-check engine (peer, ESM, `await import()`) | `[confirms PROJECT.md]` Latest stable Angular 22 is `22.0.4`. |
| `nx` | `23.0.1` (latest) | Workspace runtime (your dev repo + consumer) | `[confirms PROJECT.md "Nx 23.x"]` Declared by no one in your package.json -- flows in via `@nx/devkit`'s peer. |

### Supporting Libraries / Tools

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `@nx/eslint` `@nx/dependency-checks` rule | `23.0.1` | Catches missing/obsolete/mismatched deps in the published `package.json` | `[adds]` MANDATORY for a publishable plugin. Add `{projectRoot}/package.json` to the lint file set and enable the rule (details below). |
| Prettier | latest (`3.x`) | Formatting | `[adds]` Nx default. Use `.prettierrc` with `"singleQuote": true` per your global pref. |
| ESLint flat config (`eslint.config.mjs`/`.js`) | ESLint `9.x` | Lint | `[adds]` Nx 23 generators emit **flat config** by default. nx-verdaccio's `.eslintrc.json` is legacy (Nx 22-era); do not copy that shape for a greenfield Nx 23 repo. |
| `verdaccio` | `6.7.4` (latest 6.x) | Local registry for tarball/e2e publish-install tests | `[adds]` Standard for the "install the real tarball" e2e tier PROJECT.md describes. `@push-based/nx-verdaccio` itself wraps this. Optional but recommended for the late-phase tarball matrix. |

### Build executor decision: `@nx/js:tsc` (NOT esbuild, NOT swc)

`[confirms PROJECT.md "compiled .js" + "CJS executor"]` -- with explicit rationale:

- **Nx loads executors via `require()`** across Nx 21/22/23. The shipped executor entry must be **CommonJS `.js`**. `@nx/js:tsc` -> `tsconfig.lib.json` with `"module": "CommonJS"` produces exactly that, plus `.d.ts` declarations, plus per-file output (no bundling) -- which is what Nx expects for `executors.json` `implementation` paths.
- **esbuild/swc bundle or transpile-without-typecheck.** Bundling an executor into one file fights the multi-file `implementation` + `schema.json` layout, and swc skips type-checking (you want full TS checking on a type-checking tool). `@nx/esbuild`/`@nx/rollup` are for ESM/CJS dual-format *consumable libraries*, not for an executor whose only consumer is the Nx CLI's `require()`.
- The CJS executor then does `await import('@angular/compiler-cli')` to reach the ESM-only compiler -- this is the standard CJS->ESM bridge and works under `"module": "CommonJS"`. `[confirms PROJECT.md]`

---

## Package.json conventions for an Nx plugin (the published artifact)

Composite of the official recipe + `@analogjs/platform` (published) + `@push-based/nx-verdaccio` (published). Recommended shape for `angular-typechecker`:

```jsonc
{
  "name": "angular-typechecker",
  "version": "0.0.1",
  "license": "MIT",
  "type": "commonjs",                       // executor must be require()-able  [confirms PROJECT.md]
  "main": "./src/index.js",                 // compiled entry (NOT .ts)
  "types": "./src/index.d.ts",              // a.k.a. "typings" in older plugins
  "executors": "./executors.json",          // REQUIRED marker -> Nx discovers the executor  [adds]
  "exports": {                              // [adds] modern; analog uses this
    ".": "./src/index.js",
    "./package.json": "./package.json"
  },
  "dependencies": {
    "@nx/devkit": "23.0.1",                 // pinned, NOT peer  [contradicts PROJECT.md]
    "tslib": "^2.3.0"
  },
  "peerDependencies": {
    "@angular/compiler-cli": "^22.0.0",     // resolve from consumer  [confirms PROJECT.md]
    "typescript": ">=6.0.0 <6.1.0"          //   "      "      "       [confirms PROJECT.md]
  },
  "files": [                                // [adds] whitelist published files
    "src",
    "executors.json",
    "README.md"
  ],
  "keywords": ["nx", "nx-plugin", "angular", "typecheck", "type-check", "ngc"],  // [adds] discovery
  "repository": {                           // [adds] REQUIRED for registry listing
    "type": "git",
    "url": "git+https://github.com/<owner>/angular-typechecker.git"
  },
  "publishConfig": {
    "access": "public",
    "provenance": true                      // [adds] analog ships provenance
  }
}
```

Field-by-field notes:

- **`executors`** (`./executors.json`) is THE marker that makes the package an Nx plugin that ships executors. `[adds]` No executor field -> Nx will not find your executor. (`generators`/`schematics`/`builders`/`ng-update` are for generators/migrations -- all deferred per PROJECT.md, so omit them in v0.0.1.)
- **`main` + `types` point at compiled `./src/*.js` / `*.d.ts`**, never `.ts`. `[confirms PROJECT.md "pre-compiled .js"]` Both reference plugins ship `./src/index.js`.
- **`type: "commonjs"`** explicit. `[confirms PROJECT.md]` Known Nx behavior: `@nx/js:tsc` will force `commonjs` on the published `package.json` anyway -- which is exactly what you want for an executor, so set it explicitly to avoid surprise.
- **`bin`**: NONE in v0.0.1. `[confirms PROJECT.md "Out of Scope: standalone CLI binary"]` Add only when the standalone CLI lands in a later milestone.
- **`module`**: do NOT add. CJS-only plugin; an executor has no ESM consumer.
- **`exports` map**: `[adds]` analog ships `{".": "./src/index.js", "./package.json": "./package.json"}`. Including `"./package.json"` is the conventional escape hatch so tooling can read your manifest. Keep it minimal -- the executor is referenced by Nx via `executors.json` paths, not via `exports`.
- **`files`**: `[adds]` Whitelist `src`, `executors.json`, `README.md` (+ `docs` if you ship any). Prevents publishing tests/tsconfigs/source `.ts`.
- **`keywords`**: `[adds]` Include `nx` and `nx-plugin` -- these are the de-facto npm-search tags for the ecosystem. The official **registry listing is NOT keyword-driven** (see below), but keywords still drive npm search discovery.
- **`@angular/compiler-cli` peer range**: use `^22.0.0` (semver-major pin to Angular 22). PROJECT.md targets Angular 22 only; widen later.

### executors.json conventions

`[adds]` Minimal single-executor form (modeled on both reference plugins):

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/nrwl/nx/master/packages/nx/schemas/executors-schema.json",
  "executors": {
    "angular-typecheck": {
      "implementation": "./src/executors/angular-typecheck/executor",  // no .js extension
      "schema": "./src/executors/angular-typecheck/schema.json",
      "description": "Type-check an Angular project with the full Angular compiler diagnostic set, no emit."
    }
  }
}
```

- `implementation` is an **extensionless path relative to the published package root** pointing at the compiled `executor.js`. Nx appends the extension and `require()`s it.
- The default export of `executor.ts` is `async function (options, context: ExecutorContext): Promise<{ success: boolean }>`.
- `executors.json` itself must be **copied into the build output** via the build target's `assets` (see Architecture; both reference plugins glob `executors.json` -> `.`). It is not compiled.

### schema.json conventions (per executor)

`[adds]` Shape used by Nx's own generators + nx-verdaccio:

```jsonc
{
  "$schema": "https://json-schema.org/schema",
  "$id": "AngularTypecheckExecutorOptions",
  "title": "angular-typecheck executor",
  "type": "object",
  "cli": "nx",                         // marks it as an Nx Devkit executor
  "properties": {
    "tsConfig": {
      "type": "string",
      "description": "Path to the tsconfig to type-check (single tsconfig per target)."
    },
    "failFast":   { "type": "boolean", "default": false },
    "includeDeps":{ "type": "boolean", "default": false },
    "maxWarnings":{ "type": "number" }
  },
  "required": ["tsConfig"],
  "additionalProperties": false        // prefer false for a typed contract
}
```

- Hand-author a matching TS interface (`schema.d.ts` / `schema.ts`) -- Nx does NOT generate it; nx-verdaccio's executor imports `import type { KillProcessExecutorOptions } from './schema';`.
- `cli: "nx"` is the convention indicating Nx Devkit (vs Angular `architect`).
- Use `aliases` on properties for CLI short flags if desired (nx-verdaccio uses `"aliases": ["envRoot","e"]`).
- `additionalProperties`: nx-verdaccio uses `true` (lenient); for a strict typed tool, `false` is cleaner. Your call -- `false` recommended.

### tsconfig setup for the plugin lib

`[adds]` Standard Nx project-references layout (identical across both reference plugins):

- **`tsconfig.json`** (solution): `"files": [], "include": []`, `references` -> `tsconfig.lib.json` + `tsconfig.spec.json`. Sets `"module": "CommonJS"` for the plugin.
- **`tsconfig.lib.json`**: `extends` the solution; `"declaration": true`, `"types": ["node"]`, `"outDir": "../../dist/out-tsc"`, `"resolveJsonModule": true`; `include: ["src/**/*.ts"]`; **exclude all test/mock/spec files** so they are not compiled into the package.
- **`tsconfig.spec.json`**: test-only includes (`*.spec.ts`, `*.test.ts`), `types` includes the test runner.
- For TS 6 / Angular 22: set `"module": "CommonJS"`, `"moduleResolution": "node"` (classic) or `"bundler"` -- the analog repo (Angular 22) uses `"moduleResolution": "bundler"` + `"ignoreDeprecations": "6.0"` at the base. `[adds]` Expect to need `"ignoreDeprecations": "6.0"` on TS 6 if you carry older option shapes; the analog base on Angular 22 already sets it.
- Keep `verbatimModuleSyntax: false` on the plugin (nx-verdaccio does) so the CJS `await import()` bridge type-checks cleanly.

### ESLint + Prettier + `@nx/dependency-checks`

`[adds]` For a publishable plugin the dependency linter is the highest-value addition not in PROJECT.md:

- Enable `@nx/dependency-checks` (ERROR) in the plugin's ESLint flat config, scoped to the project's `package.json`.
- Add the plugin's `package.json` to the lint file set so the rule runs against it (in flat config this is the file matcher; in legacy `project.json` it was `lintFilePatterns`).
- What it catches: **missing** deps (code imports a package not declared), **obsolete** deps, and **version mismatches** vs the lockfile.
- Useful options: `buildTargets` (default `["build"]`), `ignoredDependencies` (e.g. ignore packages only used in tests), `includeTransitiveDependencies`, `peerDepsVersionStrategy: "installed" | "workspace"`.
- This rule is what keeps your `@angular/compiler-cli`/`typescript` **peers** and `@nx/devkit` **dependency** honest at publish time -- directly de-risks the contradiction flagged above.
- Prettier: `.prettierrc` with `"singleQuote": true` (your global preference) + `.prettierignore`.

### README / migrations.json / registry listing

`[adds]` (refines PROJECT.md's "Published to npm via `nx release`"):

- **README.md**: ship it (in `files`). Document the manual `project.json` target wiring (PROJECT.md already commits to manual wiring in v0.0.1). The registry submission also surfaces the README.
- **migrations.json**: NOT needed for v0.0.1. `[confirms PROJECT.md "no config generator / ng-add / nx-add in v0.0.1"]` Add a `migrations` (a.k.a. `nx-migrations`) field + `migrations.json` only when you ship breaking-change migrations later. (nx-verdaccio's `migrations.json` exists because it has shipped multiple versions.)
- **Registry listing is a PR, not metadata.** `[adds]` To appear in `nx list` / the Nx plugin registry you open a PR adding an entry (`name`, `url`, `description`) to Nx's `approved-community-plugins.json`. Hard criteria: (1) automated **e2e tests** in the repo, (2) **`@nx/devkit` as a `dependency`**, (3) **`repository.url`** in `package.json`. Note criterion (2) is the same rule that contradicts PROJECT.md's peer-dep plan -- listing in the registry *requires* devkit-as-dependency. PROJECT.md already plans e2e tests and a repo, so the only gap is the dependency classification.

### nx release configuration norms

`[confirms PROJECT.md "Release via nx release"]` with `[adds]` specifics:

- In `nx.json`, `"release": { "projects": ["angular-typechecker"], "version": { "conventionalCommits": true } }`. Scope `projects` so e2e/fixture projects are never published.
- `"changelog": { "workspaceChangelog": { "createRelease": "github" } }` (nx-verdaccio uses this) to cut a GitHub release + changelog.
- **First publish requires `nx release --first-release`** (and `--dry-run` strongly recommended) -- there are no prior tags/changelog/published versions yet. The flag is not needed afterward.
- **CI publish**: `npx nx release publish` with `NODE_AUTH_TOKEN` + `NPM_CONFIG_PROVENANCE=true` and job permission `id-token: write` to get the npm provenance checkmark (matches `@analogjs/platform`'s `publishConfig.provenance: true`). `[adds]`
- Recommended split: run `nx release --skip-publish` locally (commits version + changelog + tag), push tags, and let CI run `nx release publish`. `[adds]`
- 0.x semver: conventional-commits versioning works in `0.x`; `feat` bumps minor, `fix` bumps patch. PROJECT.md allows breaking changes in 0.x minors, which is consistent. `[confirms PROJECT.md]`

---

## Installation (dev repo)

```bash
# Scaffold (one-time) -- these are devDependencies in your workspace, not shipped
npm install -D nx@23.0.1 @nx/devkit@23.0.1 @nx/js@23.0.1 @nx/plugin@23.0.1 \
               @nx/vitest@23.0.1 @nx/eslint@23.0.1

# Generate the plugin + executor (Nx 23 path-based API, Vitest runner)
nx g @nx/plugin:plugin angular-typechecker --unitTestRunner=vitest
nx g @nx/plugin:executor packages/angular-typechecker/src/executors/angular-typecheck \
     --name=angular-typecheck --unitTestRunner=vitest

# The PUBLISHED package's runtime deps (in the plugin's own package.json)
#   dependencies:     @nx/devkit@23.0.1, tslib@^2.3.0
#   peerDependencies: @angular/compiler-cli@^22.0.0, typescript@>=6.0.0 <6.1.0
#   (NO nx, NO @nx/plugin, NO vitest in the published package)
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@nx/js:tsc` build | `@nx/esbuild` / `@nx/rollup` | Only for a dual-format ESM+CJS *consumable library*. Never for an executor (Nx `require()`s it; bundling fights the multi-file executor layout). |
| `@nx/js:tsc` (native tsc) | `@nx/js:swc` | swc is faster but **skips type-checking** -- wrong for a type-checking tool; you want full TS checking on your own source. |
| `@nx/vitest:test` | `@nx/vite:test` | Only on Nx <= 22.1. On Nx 22.2+ / 23 the Vitest executor moved to the dedicated `@nx/vitest` package; `@nx/vite:test` is legacy/migrated-away. |
| `@nx/devkit` as `dependency` | devkit as `peerDependency` | Effectively never for a plugin. Peer-devkit reintroduces version-skew risk and **disqualifies registry listing**. |
| ESLint flat config | `.eslintrc.json` (legacy) | Only when matching an existing legacy workspace. Greenfield Nx 23 = flat config. |
| Conventional-commits `nx release` | Manual/independent versioning | Fine, but conventional commits is the documented norm and automates changelog -- use it. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `nx` in `dependencies` OR `peerDependencies` of the published plugin | Official recipe forbids it; `@nx/devkit`'s own peer (`>= 22 <= 24 || ^23.0.0-0`) already constrains the consumer's `nx`. Declaring it yourself causes double-constraint/skew. | Depend only on `@nx/devkit` (pinned); let its peer carry `nx`. |
| `@nx/devkit` as a `peerDependency` | `[contradicts PROJECT.md]` Loses the tested-version pin and **fails the Nx registry criteria**. | `@nx/devkit` as a pinned `dependency` (`"23.0.1"`). |
| `@nx/vite:test` executor on Nx 23 | Vitest support moved out to `@nx/vitest` in Nx 22.2 (there is a literal `migrate-vitest-to-vitest-package` migration). | `@nx/vitest:test`. |
| esbuild/swc to "build the plugin" | swc skips type-checking; esbuild bundles -- both wrong for a `require()`-loaded, multi-file executor. | `@nx/js:tsc` -> CommonJS `.js` + `.d.ts`. |
| `type: "module"` / `module` field on the plugin | The executor is loaded by `require()`; ESM here breaks the loader. | `type: "commonjs"`, no `module` field; reach ESM `@angular/compiler-cli` via `await import()`. |
| Shipping `.ts` source as `main` / publishing tests | Consumers `require()` compiled JS; tests bloat the tarball and can fail dependency-checks. | `main: ./src/index.js`, `types: ./src/index.d.ts`, `files` whitelist, test excludes in `tsconfig.lib.json`. |
| copying nx-verdaccio's `.eslintrc.json` shape verbatim | That repo is Nx 22-era legacy ESLint config. | Nx 23 flat config (`eslint.config.mjs`) emitted by the generator + `@nx/dependency-checks`. |

## Stack Patterns by Variant

**If you want registry listing in v0.0.1:**
- You MUST have e2e tests (PROJECT.md already plans them), `@nx/devkit` as a dependency, and `repository.url`. Then open a PR to Nx's `approved-community-plugins.json`. The dependency-classification fix is the only blocker.

**If a later milestone adds generators / `nx add` / `ng add` (deferred per PROJECT.md):**
- Add `generators: "./generators.json"` (+ `schematics` alias for `ng add`) and `ng-update`/`migrations: "./migrations.json"` fields, plus glob those JSON files into build `assets`. None of this in v0.0.1.

**If you adopt `@nx/js:tsc` batch mode for faster CI builds:**
- Requires all built deps to also use `@nx/js:tsc` and `clean: false` (preserves `.tsbuildinfo`). Optional; only worth it once the workspace has several buildable libs.

## Version Compatibility

| Package | Pin / range | Notes |
|---------|-------------|-------|
| `nx` | `23.0.1` (workspace runtime; latest) | `[confirms PROJECT.md "Nx 23.x"]` Not declared in the plugin's package.json. |
| `@nx/devkit` (dependency) | exact `23.0.1` | Its peer `nx: ">= 22 <= 24 || ^23.0.0-0"` is WIDER than PROJECT.md's Nx-23-only intent. `[adds]` If you want to *prevent* installs on Nx 22/24, you cannot do it via devkit's peer; document "Nx 23 only" in the README and/or add an `engines`-style note. Pinning devkit to `23.0.1` keeps your own behavior on 23. |
| `@nx/vitest` | `23.0.1` | Peer `vitest: "^3.0.0 || ^4.0.0"`, `vite: "^5||^6||^7||^8"`, `@nx/eslint: 23.0.1`. |
| `vitest` | `4.1.9` (latest) | In `@nx/vitest@23.0.1`'s accepted range. |
| `typescript` (peer) | `>=6.0.0 <6.1.0` -> latest `6.0.3` | `[confirms PROJECT.md]` TS 7 is RC/next; out of scope. |
| `@angular/compiler-cli` (peer) | `^22.0.0` -> latest `22.0.4` | `[confirms PROJECT.md]` `22.1.0-next.3` on `next`; engine already verified against `22.1.0-next.3` per PROJECT.md context. |
| Node (consumer `engines`) | `^22.22.3 \|\| ^24.15.0 \|\| ^26.0.0` | `[confirms PROJECT.md]` Add to `engines` so npm warns on unsupported Node. |
| `tslib` | `^2.3.0` (latest `2.8.1`) | Standard runtime dependency with `importHelpers`. |
| `verdaccio` | `6.7.4` | Latest 6.x; for the tarball/e2e tier. |

## Sources

- npm registry (`registry.npmjs.org`) dist-tags + version manifests, fetched 2026-06-27 -- HIGH: `nx`/`@nx/devkit`/`@nx/js`/`@nx/plugin`/`@nx/vite`/`@nx/vitest`/`@nx/eslint` all `latest = 23.0.1`; `typescript latest = 6.0.3`; `@angular/compiler-cli latest = 22.0.4` (`next = 22.1.0-next.3`); `vitest latest = 4.1.9`; `verdaccio latest = 6.7.4`; `tslib` `^2.3.0`. Verified `@nx/devkit@23.0.1` peer `nx: ">= 22 <= 24 || ^23.0.0-0"`; `@nx/plugin@23.0.1` deps pinned `23.0.1`; `@nx/vitest@23.0.1` peers.
- `nx.dev/docs/extending-nx/publish-plugin` (Publish Your Nx Plugin) -- HIGH: "Include `@nx/devkit` as a `dependency` (not a `peerDependency`)"; do not list `nx`; `repository.url` required; registry criteria (e2e tests + devkit dependency + repo url); submission via `approved-community-plugins.json` PR.
- `nx.dev/docs/extending-nx/local-executors` + Nx executor concept docs -- HIGH: executors.json / schema.json (`cli: "nx"`, `$schema`, properties, `additionalProperties`) / `implementation` extensionless paths / default-export `Promise<{success}>` signature; `@nx/plugin:executor` Nx 23 `path`-based generator schema (supports `--unitTestRunner=vitest`).
- `nx.dev` `@nx/js:tsc` executor + `What Are Nx Plugins` docs -- HIGH: `@nx/js:tsc` is the recommended/default plugin builder, CJS output, batch mode requirements, esbuild/rollup only for dual-format consumable libs.
- `nx.dev/docs/guides/nx-release` (Manage Releases, Publish in CI/CD, Release npm packages) -- HIGH: `conventionalCommits`, `--first-release` + `--dry-run`, `NPM_CONFIG_PROVENANCE` + `id-token: write`, `release.projects` scoping, `--skip-publish` local / CI-publish split.
- `nx.dev` `@nx/dependency-checks` rule docs -- HIGH: missing/obsolete/version-mismatch checks; `buildTargets`/`ignoredDependencies`/`includeTransitiveDependencies`/`peerDepsVersionStrategy`; must add `package.json` to lint file set.
- Local clone `D:/projects/github/push-based/nx-verdaccio` (Nx 22.3.1) -- HIGH: real published plugin package.json (`type: commonjs`, `main: ./src/index.js`, `executors: ./executors.json`, `files`, deps `nx`+`@nx/plugin`+`tslib`, peer `@nx/js`), executors.json/schema.json shapes, `tsconfig.{json,lib,spec}` layout, build target `assets` globbing `executors.json`, `nx.json` `release` block + `migrate-vitest-to-vitest-package` migration evidence.
- Local clone `D:/projects/github/analogjs/analog` (Angular 22 / Nx 22) -- HIGH: `@analogjs/platform` published package.json (`exports` map, `executors`/`builders`/`generators`/`schematics`/`ng-update` fields, `peerDependenciesMeta`, `publishConfig.provenance`, `keywords`), nx-plugin `@nx/js:tsc` build with executors.json/generators.json assets, Angular 22 tsconfig base (`moduleResolution: bundler`, `ignoreDeprecations: "6.0"`).

---
*Stack research for: Nx plugin (single executor) authoring + publishing, 2026*
*Researched: 2026-06-27*
