# Codebase Structure

**Analysis Date:** 2026-06-30

## Directory Layout

```
angular-typechecker/
├── packages/
│   └── angular-typechecker/          # THE published Nx plugin (the only release artifact)
│       ├── src/
│       │   ├── index.ts              # Public API barrel (main/types)
│       │   ├── core/                 # Framework-agnostic engine + reporting + verdict
│       │   └── executors/
│       │       └── angular-typecheck/# The Nx executor adapter + schema
│       ├── executors.json            # Plugin marker -> executor implementation path
│       ├── package.json              # Published manifest (CJS, peers, files allowlist)
│       ├── project.json              # build / lint / test / typecheck-drift targets
│       ├── tsconfig.json             # Solution tsconfig (module: nodenext)
│       ├── tsconfig.lib.json         # Library build (excludes specs/drift)
│       ├── tsconfig.spec.json        # Test tsconfig
│       ├── tsconfig.drift.json       # Drift-probe tsconfig
│       ├── eslint.config.mjs         # Flat config + @nx/dependency-checks
│       ├── vitest.config.mts         # Vitest config
│       ├── README.md / LICENSE       # Shipped in the tarball
├── apps/
│   └── ng-spike-app/                 # Local Angular 22 app (engine spike / sandbox)
├── e2e/                              # End-to-end test projects (NOT published)
│   ├── angular-typechecker-cache-e2e/    # Nx cache + executor-parity int specs
│   ├── angular-typechecker-install-e2e/  # Tarball install smoke + release hygiene
│   └── angular-typechecker-matrix-e2e/   # 5-project-type + pnpm-symlink matrix
├── fixtures/                         # Hand-authored tsconfig+component fixtures for int tests
├── .planning/                        # GSD planning artifacts (milestones, phases, quick, research)
├── .github/workflows/               # ci.yml, release.yml
├── nx.json                           # Workspace config: targetDefaults, release, namedInputs
├── tsconfig.base.json                # Workspace-wide TS base + path aliases
├── package.json                      # Workspace (private) devDependencies
├── package-lock.json
├── eslint.config.mjs                 # Workspace flat ESLint config
├── vitest.workspace.ts               # Vitest project globs
├── .fallowrc.jsonc                   # fallow code-quality config
├── AGENTS.md / CLAUDE.md             # Agent instructions (release mechanics, worktrees)
├── README.md / SECURITY.md / CHANGELOG.md
```

## Directory Purposes

**`packages/angular-typechecker/`:**
- Purpose: The single published npm package (`angular-typechecker`). Everything else in the repo supports, tests, or plans it.
- Contains: the executor, the core engine, build/test config, and the shipped README/LICENSE.
- Key files: `src/index.ts`, `executors.json`, `package.json`, `project.json`.

**`packages/angular-typechecker/src/core/`:**
- Purpose: The framework-agnostic type-check engine, reporting, verdict, and exit-code policy. NO `@nx/devkit`, NO `process`/`console` (ESLint-enforced purity).
- Contains: `run-typecheck.ts` (orchestrator), `gather-diagnostics.ts`, `filter-diagnostics.ts`, `compiler-loader.ts`, `render-report.ts`, `format-report.ts`, `evaluate-result.ts`, `exit-codes.ts`, `diagnostic-codes.ts`, `compiler-cli-types.ts`, the drift probe, and co-located `*.spec.ts` / `*.integration.spec.ts`.
- Key files: `run-typecheck.ts` (the engine entry), `gather-diagnostics.ts` (the differentiator).

**`packages/angular-typechecker/src/executors/angular-typecheck/`:**
- Purpose: The Nx executor adapter -- the ONLY `@nx/devkit`-aware tier.
- Contains: `executor.ts` (default async fn), `normalize-options.ts`, `schema.json`, `schema.d.ts`, plus their specs and `gate-a-static.spec.ts` / `schema-parity.spec.ts`.
- Key files: `executor.ts`, `normalize-options.ts`, `schema.json`.

**`e2e/`:**
- Purpose: End-to-end verification at three tiers -- Nx cache behavior, tarball install, and the cross-project-type matrix. Never published (`nx.json` `release.projects` is scoped to `angular-typechecker`).
- Contains: three `*-e2e` projects, each with its own `project.json`, `tsconfig*.json`, `vitest.config.mts`, `src/*.int.spec.ts`, and `fixtures/` consumer workspaces.

**`fixtures/`:**
- Purpose: Small hand-authored tsconfig + component triples that reproduce specific diagnostic scenarios (TS baseline, NG baseline, extended/promoted NG8xxx, composite-triangle, broken config, solution-style, fault-isolation, global diagnostics, no-emit message, gate-b).
- Contains: per-scenario directories referenced by `core/*.integration.spec.ts`.

**`apps/ng-spike-app/`:**
- Purpose: A real Angular 22 application used as the engine spike / sandbox target.
- Contains: a standard Nx Angular app (`src/app/`, `tsconfig.app.json`).

**`.planning/`:**
- Purpose: GSD workflow artifacts. Drives milestones, phases, quick tasks, research, and this codebase map.
- Contains: `PROJECT.md`, `ROADMAP.md`, `MILESTONES.md`, `STATE.md`, `RETROSPECTIVE.md`, `config.json`, `codebase/`, `milestones/` (v0.0.1-phases, v0.0.3-phases), `phases/`, `quick/`, `research/`.

## Key File Locations

**Entry Points:**
- `packages/angular-typechecker/executors.json`: Nx plugin marker; maps `angular-typecheck` to the compiled executor.
- `packages/angular-typechecker/src/executors/angular-typecheck/executor.ts`: the executor's default async function.
- `packages/angular-typechecker/src/index.ts`: programmatic public API barrel.

**Configuration:**
- `nx.json`: `targetDefaults` (incl. the cacheable `angular-typecheck` recipe), `release` (conventionalCommits, `git.tag: false`, `releaseTag.pattern`), `namedInputs`.
- `tsconfig.base.json`: workspace TS base + path aliases (`angular-typechecker`).
- `packages/angular-typechecker/tsconfig.json`: solution config that pins `module: nodenext` (the CJS->ESM bridge enabler).
- `packages/angular-typechecker/package.json`: published manifest (peers, `files` allowlist, `engines`).

**Core Logic:**
- `packages/angular-typechecker/src/core/run-typecheck.ts`: the engine orchestrator.
- `packages/angular-typechecker/src/core/gather-diagnostics.ts`: the unconditional all-getter gatherer.
- `packages/angular-typechecker/src/core/filter-diagnostics.ts`: the project-boundary filter.
- `packages/angular-typechecker/src/core/compiler-loader.ts`: the memoized ESM load.

**Testing:**
- Co-located `*.spec.ts` (unit) and `*.integration.spec.ts` (real cold compiler) beside their core modules.
- `e2e/**/src/*.int.spec.ts`: cache, install, matrix tiers.
- `fixtures/`: scenario inputs for the integration tier.

## Naming Conventions

**Files:**
- Source modules: `kebab-case.ts` (`run-typecheck.ts`, `filter-diagnostics.ts`, `normalize-options.ts`).
- Unit tests: `<module>.spec.ts` co-located with the module.
- Integration tests (real compiler): `<scenario>.integration.spec.ts` in `core/`.
- E2E tests: `<scenario>.int.spec.ts` under `e2e/**/src/`.
- Drift probe: `<module>.drift.ts` (excluded from the lib build; compiled by the `typecheck-drift` target).
- Schema: `schema.json` (Nx) + hand-authored `schema.d.ts` (TS interface).

**Directories:**
- `core/` for the framework-agnostic engine; `executors/<executor-name>/` for each Nx executor adapter.
- Fixtures and e2e consumer workspaces use descriptive kebab-case scenario names.

## Where to Add New Code

**New core engine logic (filters, gather phases, classification):**
- Primary code: `packages/angular-typechecker/src/core/<feature>.ts` (keep it pure -- no `process`/`console`).
- Tests: co-located `packages/angular-typechecker/src/core/<feature>.spec.ts`; add a real-compiler `<scenario>.integration.spec.ts` + a `fixtures/<scenario>/` triple when behavior depends on the live compiler.
- Export from the barrel only if a deferred adapter (CLI/builder) needs it: `packages/angular-typechecker/src/index.ts`.

**New executor option:**
- Add the property to `packages/angular-typechecker/src/executors/angular-typecheck/schema.json` AND `schema.d.ts` (kept in parity by `schema-parity.spec.ts`).
- Map it in `packages/angular-typechecker/src/executors/angular-typecheck/normalize-options.ts` (reporter knob vs `CoreOptions` field).
- Thread it through `executor.ts` and into `runTypecheck`/`renderReport`/`evaluateResult` as appropriate.
- Document it in `packages/angular-typechecker/README.md` Options table.

**New Nx executor (a second one):**
- Implementation: `packages/angular-typechecker/src/executors/<new-name>/executor.ts` + `schema.json` + `schema.d.ts`.
- Register it in `packages/angular-typechecker/executors.json` and glob the schema into the build via `project.json` `assets`.

**New end-to-end coverage:**
- Add a project under `e2e/angular-typechecker-<tier>-e2e/` with its own `project.json` + `vitest.config.mts` + `src/*.int.spec.ts`, and any `fixtures/` consumer workspace it needs.

**New fixture scenario:**
- `fixtures/<scenario>/` with the minimal `tsconfig*.json` + component triple; reference it from a `core/*.integration.spec.ts`.

## Special Directories

**`dist/`:**
- Purpose: `@nx/js:tsc` build output (`dist/packages/angular-typechecker`); `dist/out-tsc` for the lib tsconfig.
- Generated: Yes. Committed: No (gitignored).

**`.nx/`, `.angular/`, `.fallow/cache/`:**
- Purpose: Nx daemon/cache, Angular compiler cache, fallow audit cache.
- Generated: Yes. Committed: No.

**`.claude/worktrees/`:**
- Purpose: Isolated git worktrees for parallel phase execution (see AGENTS.md `node_modules` junction rules).
- Generated: Yes. Committed: No.

**`.planning/`:**
- Purpose: GSD planning artifacts.
- Generated: By GSD workflows. Committed: Yes -- this repo keeps planning artifacts on `main`.

**`node_modules/`:**
- Purpose: Dependencies. Provisioned by `npm ci` (CI) or a junction into the main checkout (parallel worktrees).
- Generated: Yes. Committed: No.

---

*Structure analysis: 2026-06-30*
