# Codebase Structure

**Analysis Date:** 2026-07-09

## Directory Layout

```
angular-typechecker/                 # Nx workspace root (@angular-typechecker/source)
|-- packages/
|   '-- angular-typechecker/         # THE published plugin (the only shipped project)
|       |-- src/
|       |   |-- core/                # Pure engine (no devkit/console/process)
|       |   |-- executors/typecheck/ # Nx executor adapter + schema
|       |   |-- generators/          # configuration + init generators
|       |   '-- index.ts             # Public API barrel
|       |-- executors.json           # Executor manifest (Nx loads by path)
|       |-- generators.json          # Generator manifest
|       |-- package.json             # Published manifest (deps/peers/files)
|       |-- project.json             # Nx targets (build/lint/test/release/drift)
|       |-- tsconfig*.json           # Solution + lib + spec + drift tsconfigs
|       |-- vitest.config.mts        # Vitest config
|       '-- README.md
|-- e2e/                             # Tarball-install + matrix + cache e2e projects
|   |-- angular-typechecker-install-e2e/  # install / nx-add / generator / storybook / tarball
|   |-- angular-typechecker-matrix-e2e/   # 5 project-type matrix + pnpm symlink
|   '-- angular-typechecker-cache-e2e/    # Nx cache invalidation + executor parity
|-- libs/                            # Dev-only support libraries + typecheck fixtures
|   |-- test-util/                   # @workspace/test-util (findWorkspaceRoot, e2e helpers)
|   |-- typecheck-consumer/          # in-workspace consumer fixture
|   |-- typecheck-consumer-dep/      # dependency fixture (has .pristine restore files)
|   '-- typecheck-walk-consumer/     # solution-walk fixture (lib + spec leaves)
|-- apps/
|   '-- ng-spike-app/                # Angular 22 app used by engine spikes
|-- fixtures/                        # Flat tsconfig fixtures (baselines, extended, layouts)
|-- tools/act/                       # act (local GitHub Actions) compat scripts
|-- .github/workflows/               # ci.yml + release.yml
|-- .planning/                       # GSD planning artifacts (phases/milestones/etc.)
|-- nx.json                          # Nx config: targetDefaults, release, generators
|-- tsconfig.base.json               # Workspace path aliases + base compilerOptions
|-- vitest.workspace.ts              # Vitest project glob
'-- project.json                     # Root project: local-registry (verdaccio) target
```

## Directory Purposes

**`packages/angular-typechecker/src/core/`:**
- Purpose: the framework-agnostic type-check engine. PURE -- no `@nx/devkit`, `console`, or `process` (ESLint-enforced on `**/src/core/**`).
- Contains: engine orchestration, gatherer, walker, boundary filter, verdict, formatter, code space, loaders, the compiler-cli type shim, and the pure `detect-*` advisory detectors. Specs are co-located (`*.spec.ts`, `*.integration.spec.ts`, `*.drift.ts`).
- Key files: `run-typecheck.ts`, `gather-diagnostics.ts`, `walk-references.ts`, `filter-diagnostics.ts`, `evaluate-result.ts`, `compiler-loader.ts`, `compiler-cli-types.ts`, `diagnostic-codes.ts`.

**`packages/angular-typechecker/src/executors/typecheck/`:**
- Purpose: the Nx executor adapter (the tier that touches `@nx/devkit`).
- Contains: `executor.ts` (default async executor), `normalize-options.ts`, `schema.json` (option contract), `schema.d.ts` (`TypecheckExecutorOptions`), and spec/parity tests.

**`packages/angular-typechecker/src/generators/`:**
- Purpose: Nx generators that wire the target and seed cacheable targetDefaults.
- Contains: `configuration/` (wire a `typecheck` target), `init/` (seed `nx.json` targetDefaults; run by `nx add`). Each has `generator.ts`, `schema.json`, `schema.d.ts`, and `schema-parity.spec.ts`.

**`e2e/`:**
- Purpose: end-to-end verification against the packed tarball and real consumer workspaces. Each project has `implicitDependencies: ["angular-typechecker"]` and a `typecheck-e2e` (`tsc --noEmit`) static gate plus a Vitest `test` target running `*.int.spec.ts`.
- Contains: install/nx-add/generator/storybook/tarball specs, the 5-project-type matrix + pnpm symlink specs, and cache-invalidation + executor-parity specs. Consumer workspaces live under each project's `fixtures/`.

**`libs/`:**
- Purpose: dev-only support (never published). `test-util` exports `@workspace/test-util`; the `typecheck-*` libs are in-workspace fixtures exercised by core integration specs.

**`fixtures/`:**
- Purpose: flat, hand-authored tsconfig fixtures for core integration specs (TS/NG baselines, extended NG8xxx batches, Storybook Layout A/B, solution-style variants, external-template tripwires, bundler query imports).

## Key File Locations

**Entry Points:**
- `packages/angular-typechecker/src/executors/typecheck/executor.ts`: Nx executor (default export).
- `packages/angular-typechecker/src/generators/configuration/generator.ts`, `.../generators/init/generator.ts`: Nx generators.
- `packages/angular-typechecker/src/index.ts`: programmatic `runTypecheck` API barrel.

**Configuration:**
- `packages/angular-typechecker/package.json`: published manifest -- `type: commonjs`, `main`/`types` -> `./src/index.js`, `executors`/`generators` manifests, `files` whitelist, `@nx/devkit` dependency, `@angular/compiler-cli`+`typescript` peers, `engines.node`.
- `packages/angular-typechecker/executors.json` / `generators.json`: Nx entry manifests (extensionless implementation paths).
- `packages/angular-typechecker/tsconfig.json`: solution tsconfig (`module: nodenext`, references lib + spec).
- `packages/angular-typechecker/tsconfig.lib.json`: build includes `src/**/*.ts`, excludes specs/drift.
- `nx.json`: `targetDefaults` (incl. `angular-typechecker:typecheck` cache inputs), `release` block, default generators.
- `tsconfig.base.json`: workspace path aliases (`angular-typechecker`, `@workspace/test-util`, `@fixtures/typecheck-consumer-dep`).

**Core Logic:**
- `packages/angular-typechecker/src/core/run-typecheck.ts`: engine orchestration + `CoreOptions`/`CoreResult` types + infra policy.
- `packages/angular-typechecker/src/core/gather-diagnostics.ts`: `runNoEmitCompilation` + unconditional all-getter.
- `packages/angular-typechecker/src/core/filter-diagnostics.ts`: project-boundary keep/suppress classification.

**Testing:**
- Co-located `*.spec.ts` (unit) and `*.integration.spec.ts` (real cold-compiler) under `src/core/`.
- `*.int.spec.ts` under each `e2e/*/src/`.
- `*.drift.ts` compiled by the `typecheck-drift` target (`tsconfig.drift.json`) as a version-drift tripwire.

## Naming Conventions

**Files:**
- kebab-case for modules: `run-typecheck.ts`, `filter-diagnostics.ts`, `detect-bundler-query-imports.ts`.
- Pure advisory detectors prefixed `detect-`: `detect-unchecked-declared.ts`, `detect-bundler-query-imports.ts`.
- Unit tests `<name>.spec.ts`; real-compiler tests `<name>.integration.spec.ts`; e2e tests `<name>.int.spec.ts`; drift tripwires `<name>.drift.ts`.
- Nx option contracts always paired: `schema.json` + `schema.d.ts`, guarded by a `schema-parity.spec.ts`.

**Directories:**
- Plugin lives under `packages/<plugin-name>/`; each Nx executor/generator is its own directory holding `implementation` + `schema`.
- e2e projects suffixed `-e2e`; fixture workspaces nested under `<project>/fixtures/`.

## Where to Add New Code

**New engine capability (a new diagnostic phase, filter rule, or verdict trigger):**
- Primary code: `packages/angular-typechecker/src/core/` (keep it PURE -- no devkit/console/process).
- If it produces a user-facing signal, add a structured field to `CoreResult` in `run-typecheck.ts` and render it from `executor.ts` (never log from core).
- Tests: co-located `*.spec.ts` (pure unit with synthetic diagnostics) plus a `*.integration.spec.ts` if a real compiler run is needed; add a fixture under `fixtures/` when required.

**New executor option:**
- Add to `packages/angular-typechecker/src/executors/typecheck/schema.json` AND `schema.d.ts` (parity spec enforces both), thread through `normalize-options.ts`, and split it into a verdict knob (`evaluate-result.ts`) or reporter knob (`render-report.ts`).

**New generator:**
- Add a directory under `packages/angular-typechecker/src/generators/<name>/` with `generator.ts` + `schema.json` + `schema.d.ts`, and register it in `generators.json`.

**Shared test helper:**
- `libs/test-util/src/lib/` (exported via `@workspace/test-util`).

**New e2e scenario:**
- Add a `*.int.spec.ts` under the appropriate `e2e/*/src/`; add a consumer fixture under that project's `fixtures/`.

## Special Directories

**`dist/`:**
- Purpose: `@nx/js:tsc` build output; `dist/packages/angular-typechecker` is the `packageRoot` for `nx-release-publish` (the packed tarball).
- Generated: Yes. Committed: No (gitignored).

**`.planning/`:**
- Purpose: GSD planning artifacts (phases, milestones, research, quick tasks, this codebase map).
- Generated: Yes (by GSD). Committed: Yes -- this repo deliberately keeps planning artifacts on `main`.

**`fixtures/` and `libs/typecheck-*`:**
- Purpose: intentionally-erroring / intentionally-clean tsconfig fixtures. Some carry `.pristine` files used to restore mutated fixture sources between test runs.
- Generated: No (hand-authored). Committed: Yes. Note: excluded from Prettier (`.prettierignore`) because their non-compliance is intentional.

**`.verdaccio/` + root `local-registry` target:**
- Purpose: local npm registry (`@nx/js:verdaccio`, IPv4 loopback) for tarball publish/install e2e.
- Generated: storage under `tmp/` is generated + gitignored; `.verdaccio/config.yml` is committed.

---

*Structure analysis: 2026-07-09*
