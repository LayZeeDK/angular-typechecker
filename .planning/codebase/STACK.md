# Technology Stack

**Analysis Date:** 2026-07-09

angular-typechecker is a single-package Nx plugin published to npm. It ships one
Nx executor (`typecheck`) plus two generators (`configuration`, `init`) that run
the complete Angular compiler type-check (TypeScript + template type-check +
extended NG8xxx diagnostics) with no emit, decoupled from build and test. The
shipped runtime is a CommonJS executor that dynamically `import()`s the ESM-only
`@angular/compiler-cli` and `typescript` at runtime.

## Languages

**Primary:**
- TypeScript `6.0.3` (range `>=6.0.0 <6.1.0`) - all first-party source under `packages/angular-typechecker/src/`, `libs/`, and `e2e/`. TS 6 is mandatory: it is the only TypeScript major Angular 22 supports.

**Secondary:**
- JavaScript (ESM `.mjs`) - tooling config only: `eslint.config.mjs`, `packages/angular-typechecker/vitest.config.mts`.
- JavaScript (CommonJS `.js`) - the SHIPPED artifact. `@nx/js:tsc` compiles the executor/generators to `.js` + `.d.ts` under `dist/packages/angular-typechecker/`; consumers `require()` it via Nx's executor loader.

## Runtime

**Environment:**
- Node.js `^22.22.3 || ^24.15.0 || ^26.0.0` (declared in `packages/angular-typechecker/package.json` `engines.node`). This is the intersection of the Angular 22 and Nx 23 supported ranges.
- CI matrix exercises Node 22, 24, 26 (see `.github/workflows/ci.yml`).

**Package Manager:**
- npm (primary). Lockfile: `package-lock.json` present at repo root (~1 MB).
- The e2e install gate additionally exercises pnpm (`11.9.0`) and yarn (via corepack) as CONSUMER package managers - not used to build this repo.
- `.npmrc` at repo root sets `legacy-peer-deps=true` (documented reconciliation for `@nx/angular@23.0.1`'s `< 22.0.0` Angular peer ceiling vs the locked Angular 22 stack).

## Frameworks

**Core:**
- Nx `23.0.1` - workspace runtime and plugin host. The published package does NOT declare `nx` directly; it flows in transitively through `@nx/devkit`'s peer (`>= 22 <= 24 || ^23.0.0-0`).
- `@nx/devkit` `23.0.1` - plugin authoring API (`ExecutorContext`, `logger`). Shipped as a pinned runtime `dependency`.
- `@angular/compiler-cli` `^22.0.0` (dev-locked `22.0.4`) - the type-check ENGINE (`performCompilation`). ESM-only; reached via `await import()`. Declared as a `peerDependency` (consumer supplies the version).

**Testing:**
- Vitest `~4.1.0` via `@nx/vitest:test` (the dedicated Nx 23 Vitest package, NOT `@nx/vite:test`). Config: `packages/angular-typechecker/vitest.config.mts` (`environment: jsdom`, `globals: true`, 30s test/hook timeout for cold real-compiler integration specs).
- `@vitest/coverage-v8` `~4.1.0` - coverage provider `v8`.
- `jsdom` `^27.1.0` - DOM environment for the test runner.

**Build/Dev:**
- `@nx/js:tsc` (`@nx/js` `23.0.1`) - the plugin build executor. Emits per-file CommonJS `.js` + `.d.ts` (never bundled - Nx `require()`s the executor). Configured in `packages/angular-typechecker/project.json` `build` target.
- `@nx/plugin` `23.0.1` - dev-only scaffolding generators (not shipped).
- `@nx/angular` `23.0.1` - powers the Angular fixtures/spike app under `apps/` and `e2e/` consumer workspaces.
- ESLint `^9.8.0` (flat config) + `typescript-eslint` `^8.40.0` + `angular-eslint` `^22.0.0` - lint. Root config `eslint.config.mjs`; per-package `packages/angular-typechecker/eslint.config.mjs`.
- Prettier `~3.6.2` - formatting (`singleQuote` preference; `.planning/` is Prettier-ignored).
- fallow `3.6.0` - dead-code / duplication / complexity audit (gated in CI, not via the GSD pre-pass). Config: `.fallowrc.jsonc`.

## Key Dependencies

**Critical (shipped in `packages/angular-typechecker/package.json`):**
- `@nx/devkit` `23.0.1` (`dependency`, exact pin) - required as a `dependency` (not peer) both for tested-version stability and for Nx community-plugin registry eligibility.
- `tslib` `^2.3.0` (`dependency`) - runtime helper for `importHelpers`.
- `@angular/compiler-cli` `^22.0.0` (`peerDependency`) - the diagnostic engine; consumer supplies it.
- `typescript` `>=6.0.0 <6.1.0` (`peerDependency`) - the language service the engine drives; consumer supplies it.

The dependency/peer split is policed by `@nx/dependency-checks` (ERROR) and
`@nx/nx-plugin-checks` (ERROR) in `packages/angular-typechecker/eslint.config.mjs`.
`checkVersionMismatches: false` is set deliberately so autofix cannot narrow the
public peer ranges (`^22.0.0`) to the installed exact version (`22.0.4`).

**Infrastructure (dev-only, root `package.json`):**
- Full Angular 22 stack (`@angular/{common,compiler,core,platform-browser,router}` `22.0.4`, `@angular/build`, `@angular/cli`, `@angular/language-service`, `@schematics/angular`, `@angular-devkit/*`) - powers fixtures and consumer workspaces.
- `rxjs` `~7.8.0` - Angular fixture dependency.
- `verdaccio` `6.7.4` - local npm registry for the tarball install e2e gate.
- `@arethetypeswrong/cli` `0.18.4`, `publint` `0.3.21` - published-package correctness checks.
- `@swc/*` / `@swc-node/register` - Nx's default TS transpile for tooling (not the plugin build path).

## Configuration

**TypeScript:**
- `tsconfig.base.json` (root) - shared compiler options + path aliases (`angular-typechecker`, `@workspace/test-util`, `@fixtures/typecheck-consumer-dep`). `module: esnext`, `moduleResolution: node`.
- `packages/angular-typechecker/tsconfig.json` (solution) - overrides to `module: nodenext` / `moduleResolution: nodenext`, `verbatimModuleSyntax: false`, `ignoreDeprecations: "6.0"`. `files: []`, `include: []`, references lib + spec.
- `packages/angular-typechecker/tsconfig.lib.json` - build tsconfig; `declaration: true`, `types: ["node"]`, excludes all `*.spec.ts` / `*.drift.ts` / test files from the package.
- `packages/angular-typechecker/tsconfig.spec.json` - test tsconfig.
- `packages/angular-typechecker/tsconfig.drift.json` - drives the `typecheck-drift` gate (`tsc --noEmit`) that fails if the compiler-cli type shims drift from installed typings.

**Module format (load-bearing constraint):**
- The plugin is `type: "commonjs"`, `main: ./src/index.js`. It is compiled under `module: nodenext` so the runtime dynamic `import()` of the ESM `@angular/compiler-cli` (`src/core/compiler-loader.ts`) and `typescript` (`src/core/load-typescript.ts`) survives emit as a native dynamic load. Compiling under `module: commonjs` would downlevel `import()` to `require()` and break at runtime against the ESM-only compiler.

**Nx workspace:**
- `nx.json` - `analytics: false`, `targetDefaults` (caching for `@nx/js:tsc`, `@nx/eslint:lint` with `maxWarnings: 0`, `@nx/vitest:test`, and the plugin's own `angular-typechecker:typecheck`), and the `release` block (`conventionalCommits`, `git.tag: false`, `git.push: false`, `createRelease: false`).
- `project.json` (root) - the `local-registry` target (`@nx/js:verdaccio`, bound to `127.0.0.1:4873`).

**Env / secrets:**
- No `.env` files. No application runtime secrets. Publish authentication is tokenless OIDC (see INTEGRATIONS.md).

## Platform Requirements

**Development:**
- Primary dev environment: Windows arm64, PowerShell Core / Git Bash. Node managed by FNM.
- Node in the supported `engines` range; npm.

**Production (the consumer's environment):**
- The package is consumed inside an Nx 23 + Angular 22 + TypeScript 6 workspace. The consumer provides `@angular/compiler-cli` and `typescript` (peer deps) and `nx` (via devkit's peer). Node must satisfy `^22.22.3 || ^24.15.0 || ^26.0.0`.
- Distribution target: the public npm registry (`registry.npmjs.org`), tag pattern `angular-typechecker@{version}`.

---

*Stack analysis: 2026-07-09*
