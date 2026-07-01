# Technology Stack

**Analysis Date:** 2026-06-30

This is `angular-typechecker`, an Nx 23 plugin that ships a single executor
(`angular-typecheck`) running the complete Angular compiler type-check
(TypeScript + template type-check + extended NG8xxx diagnostics) with no emit.
The published artifact is the library at `packages/angular-typechecker/`; the
repository root is the dev/test workspace.

## Languages

**Primary:**

- TypeScript `>=6.0.0 <6.1.0` (installed `6.0.3`) - all plugin source under `packages/angular-typechecker/src/`, fixtures, e2e harnesses. Also a runtime `peerDependency` (the consumer's TypeScript is what the executor type-checks against).

**Secondary:**

- JavaScript (ESM `.mjs`) - flat ESLint configs (`eslint.config.mjs`), Vitest config (`vitest.config.mts`).
- Bash - CI helper scripts (`tools/act/act-compat.sh`).

The published package compiles to CommonJS `.js` (see Module format below). No
other application languages are present.

## Runtime

**Environment:**

- Node.js. Consumer-facing supported range pinned in `packages/angular-typechecker/package.json` `engines`: `^22.22.3 || ^24.15.0 || ^26.0.0` (intersection of the Angular 22 and Nx 23 supported Node ranges).
- The executor is loaded by the Nx CLI via `require()` (CommonJS), then reaches the ESM-only `@angular/compiler-cli` through a dynamic `await import()` (`packages/angular-typechecker/src/core/compiler-loader.ts`).

**Package Manager:**

- npm (default). Root `package.json` is the workspace; `package-lock.json` present (lockfileVersion 3).
- Lockfile: present (`package-lock.json`, ~910 KB).
- `.npmrc` sets `legacy-peer-deps=true` to reconcile the Angular 22 framework tree against `@nx/angular@23.0.1`'s `< 22.0.0` optional peer ceiling (documented inline in `.npmrc`).
- pnpm is used only inside the e2e tier (provisioned in CI via `pnpm/action-setup`, version `11.9.0`) to exercise consumer-install scenarios; it is NOT the workspace package manager.

## Frameworks

**Core (build/plugin authoring):**

- `@nx/devkit` `23.0.1` - Nx plugin authoring API (`ExecutorContext`, `logger`). Shipped as a pinned `dependency` of the published package (NOT a peer) - required for Nx plugin-registry listing.
- Nx `23.0.1` - workspace runtime. NOT declared in the published `package.json`; flows in transitively via `@nx/devkit`'s `nx` peer (`>= 22 <= 24 || ^23.0.0-0`).
- `@angular/compiler-cli` `^22.0.0` (installed `22.0.4`) - the type-check ENGINE. A runtime `peerDependency` (consumer supplies it). ESM-only, reached via dynamic `import()`. The engine calls `readConfiguration` + `performCompilation` with an unconditional all-getter gatherer (`packages/angular-typechecker/src/core/run-typecheck.ts`, `gather-diagnostics.ts`).

**Testing:**

- Vitest `~4.1.0` via the dedicated Nx 23 `@nx/vitest:test` executor (`@nx/vitest` `23.0.1`). NOT `@nx/vite:test` (legacy/migrated-away on Nx 23).
- `@vitest/coverage-v8` `~4.1.0` - coverage (`provider: 'v8'`).
- jsdom `^27.1.0` - Vitest `environment: 'jsdom'`.
- `vite` `^8.0.0` - underlies the Vitest config plugins (`@nx/vite/plugins/*`).

**Build/Dev:**

- `@nx/js:tsc` (`@nx/js` `23.0.1`) - the plugin's build target. Emits CommonJS `.js` + `.d.ts` via native `tsc` (NOT esbuild/swc - those would bundle or skip type-checking). Configured in `packages/angular-typechecker/project.json`.
- `@nx/plugin` `23.0.1` - scaffolding generators (devDependency, not shipped).
- `@nx/angular` `23.0.1`, `@nx/web` `23.0.1`, `@nx/workspace` `23.0.1` - workspace tooling for the Angular app/lib fixtures.
- `@angular/build` / `@angular/cli` `22.0.4` - Angular toolchain for the `apps/ng-spike-app` spike app and Angular fixtures.

## Key Dependencies

**Published package runtime (`packages/angular-typechecker/package.json`):**

- `dependencies`: `@nx/devkit` `23.0.1` (pinned exact), `tslib` `^2.3.0` (runtime helper for `importHelpers`).
- `peerDependencies`: `@angular/compiler-cli` `^22.0.0`, `typescript` `>=6.0.0 <6.1.0`. These are the consumer's own versions; the executor type-checks the consumer's project with the consumer's compiler.
- NO `nx`, NO `@nx/plugin`, NO `vitest` in the published package - those are dev-only.

**Critical (dev toolchain at root `package.json`):**

- `typescript` `6.0.3` - compiles the plugin AND is the runtime peer surface.
- `@angular/compiler-cli` `22.0.4` - the engine, also a devDependency for the dev/test build of the workspace.
- `eslint` `^9.8.0` + `typescript-eslint` `^8.40.0` + `@nx/eslint` / `@nx/eslint-plugin` `23.0.1` - flat-config lint with `@nx/dependency-checks` and `@nx/nx-plugin-checks`.
- `angular-eslint` `^22.0.0` - Angular-aware lint rules for fixtures.

**Infrastructure / quality:**

- `fallow` `2.103.0` - dead-code / duplication / complexity audit (new-only gate in CI; config `.fallowrc.jsonc`).
- `@arethetypeswrong/cli` `0.18.4` (`attw`) + `publint` `0.3.21` - published-package type-resolution and packaging validators.
- `prettier` `~3.6.2` + `eslint-config-prettier` `^10.0.0` - formatting.
- `@swc-node/register` / `@swc/cli` / `@swc/core` / `@swc/helpers` - SWC tooling used by Nx internals/config loading (not the plugin build).

**Angular framework (root `dependencies`, for fixtures/spike app):**

- `@angular/common`, `@angular/compiler`, `@angular/core`, `@angular/platform-browser`, `@angular/router` all `22.0.4`; `rxjs` `~7.8.0`.

## Configuration

**Environment:**

- No `.env` files and no runtime environment configuration in the plugin itself. The executor is configured entirely through its Nx target options (`schema.json`): `tsConfig` (required), `includeDeps`, `maxWarnings`, `failFast` (`packages/angular-typechecker/src/executors/angular-typecheck/schema.json`).
- CI uses `NX_DAEMON: false` (in `.github/workflows/ci.yml`) and OIDC/`NPM_CONFIG_PROVENANCE` env for publish (see INTEGRATIONS.md).

**Build / TypeScript:**

- `tsconfig.base.json` (workspace solution base): `module: esnext`, `moduleResolution: node`, `target: es2015`, path aliases for the plugin and a fixture lib.
- `packages/angular-typechecker/tsconfig.json` (plugin solution): `module: nodenext`, `moduleResolution: nodenext`, `verbatimModuleSyntax: false`, `ignoreDeprecations: "6.0"`; references `tsconfig.lib.json` + `tsconfig.spec.json`. The `nodenext` module setting is LOAD-BEARING - it keeps the dynamic `import('@angular/compiler-cli')` literal in the emitted `.js` (a `module: commonjs` build would downlevel it to `require()` and break the ESM bridge).
- `packages/angular-typechecker/tsconfig.lib.json`: `declaration: true`, `outDir: ../../dist/out-tsc`, `types: ["node"]`, excludes all `*.spec.ts` / `*.test.ts` / `*.drift.ts` from the published build.
- `packages/angular-typechecker/tsconfig.drift.json` - separate `tsc --noEmit` drift tripwire (compiler-cli type-shape drift gate), run via the `typecheck-drift` target.
- `nx.json` - `targetDefaults` (caching for `@nx/js:tsc`, `@nx/eslint:lint`, `@nx/vitest:test`, the `angular-typecheck` target), `release` config (conventional commits, `releaseTag.pattern: angular-typechecker@{version}`, `git: { commit: true, tag: false, push: false }`).

**Lint / format:**

- `eslint.config.mjs` (root flat config) + `packages/angular-typechecker/eslint.config.mjs` (project flat config with the core-boundary specifier bans, `@nx/dependency-checks`, `@nx/nx-plugin-checks`).
- `.prettierrc` (`{ "singleQuote": true }`), `.prettierignore`, `.editorconfig` (2-space, UTF-8, final newline).

**Module format:**

- Published package is `type: "commonjs"`, `main: ./src/index.js`, `types: ./src/index.d.ts`, `executors: ./executors.json`, `exports` map `{ ".": "./src/index.js", "./package.json": "./package.json" }`, `files` whitelist `[src, executors.json, README.md, LICENSE]`.

## Platform Requirements

**Development:**

- Developed on Windows arm64 (PowerShell Core). The shared-`node_modules` junction pattern for parallel worktree execution is documented in `AGENTS.md`.
- Node in the `engines` range; npm with `legacy-peer-deps=true`.

**Production (consumer / deployment target):**

- The package is published to the public npm registry as `angular-typechecker` (currently `0.0.3`), with npm provenance attestation (`publishConfig.provenance: true`, `access: public`).
- Consumers install it into an Nx 23 + Angular 22 + TypeScript 6 workspace and wire the `angular-typecheck` executor into a project target manually (no generator in this milestone).
- CI runs on GitHub Actions free public-repo runners across Linux / Windows / macOS, Node 22 / 24 / 26 (lean 6-cell matrix in `.github/workflows/ci.yml`).

---

_Stack analysis: 2026-06-30_
