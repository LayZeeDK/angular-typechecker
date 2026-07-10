# Quick Task 260710-b9t: Dogfood angular-typechecker - typecheck all files - Context

**Gathered:** 2026-07-10
**Status:** Ready for research/planning
**Branch:** `dogfood-typecheck-all-files` (forked off origin/main @ 8818e9e)

<domain>
## Task Boundary

Dogfood angular-typechecker on its own repo: ensure **every non-intentionally-broken**
`*.ts`, `*.mts`, `*.js`, `*.mjs` file (including config files) is type-checked by an Nx
target. Ignore `.planning/`. Unify the target vocabulary so CI and root `package.json`
scripts are driven by three uniform commands. Land on a separate branch, open a PR, make
it green (locally first).
</domain>

<decisions>
## Implementation Decisions (LOCKED - do not revisit)

### D1. Intentionally-broken fixtures are EXCLUDED
- Top-level `fixtures/**` and `e2e/**/fixtures/**` are the plugin's TEST CORPUS, not
  first-party source. They are loose dirs (no `project.json`), NOT on the Nx graph, and are
  consumed as INPUTS to `runTypecheck()` inside 16 integration specs + `executor.spec.ts`
  that assert exact diagnostics (NG8001, TS2322, etc.). Their brokenness IS the assertion.
- Do NOT add passing typecheck targets over intentionally-broken fixtures. Do NOT add
  negative/exit-inverting targets (redundant with the specs, strictly weaker).
- The type-check-PASSING (clean) fixtures SHOULD get real coverage, and clean vs broken
  MUST be separated where possible. **Classify each fixture dir by actually running the
  check - do not guess from the name** (`ts-baseline`/`ng-baseline` are BROKEN despite
  "baseline"; only some `-clean` dirs are truly clean).

### D2. Non-Angular files: nx:run-commands + `tsc --noEmit -p` (REVISED per research Q1)
- Angular projects (app + Angular libs + clean fixtures) -> `angular-typechecker:typecheck` (dogfood).
- **REVISION (research-verified, user pre-authorized via "if possible"):** `@nx/js:tsc` CANNOT do
  a no-emit type-check - its schema REQUIRES `main`+`outputPath`, forces `outDir`, sets
  `noEmitOnError`, calls `program.emit()`, and treats `emitSkipped` as failure; `noEmit:true` ->
  guaranteed `success:false` (CI-red). So non-Angular TS/specs/configs use `nx:run-commands`
  running `tsc --noEmit -p <tsconfig>` - EXACTLY the repo's existing `typecheck-drift`/`typecheck-e2e`
  pattern. This satisfies the GOAL of D2 (a real no-emit type-check).

### D3. Cleanup is ADDITIVE coverage, NOT a literal build/test/e2e buildout
- Goal: every real (non-broken) JS/TS file is type-checked by SOME target, including config
  files. Do NOT force `build`/`test`/`e2e` onto projects that don't need them.
- Rationale: a literal build/test/e2e buildout adds ZERO type-check coverage beyond the
  additive approach, and fights the existing `.nxignore` + release `preVersionCommand`
  (`npx nx run-many -t build`) design (fixture libs are deliberately kept out of the build
  sweep; Angular fixture libs would need ng-packagr, not installed).

### D4. Unify the target vocabulary so three run-many commands cover everything
The user wants CI + root `package.json` scripts simplified to:
- `nx run-many -t typecheck`  -> every project's type-check (fold in today's
  `typecheck-drift` and `typecheck-e2e`; add plugin-spec, test-util-spec, config, and
  clean-fixture coverage). Single target NAME `typecheck` across all projects.
- `nx run-many -t test`       -> unit/integration tests (plugin, test-util).
- `nx run-many -t e2e`        -> the 3 e2e projects (RENAME their current `test` target
  to `e2e`). Preserve cross-project serialization (`--parallel=1`; shared-tarball race).
- Add root `package.json` scripts for these (root `scripts` is currently `{}`).
- Keep `lint`, `format:check`, `scoped-name-guard` as-is.

### D5. 3-tier test split (test / integration / e2e) + reclassify 2 leakers
Measured timings (plugin suite, 2026-07-10, Windows arm64):
| Tier | Files | Tests | Wall | Raw test time |
|---|---|---|---|---|
| true fast unit (`.spec.ts` excl. 2 leakers) | 29 | ~254 | ~2-4s | ~2.2s (every file <400ms) |
| cold-compile leakers named `.spec.ts` | 2 | 8 | ~4s | gate-b 3.0s + compiler-cli-types.runtime 1.1s |
| integration (`.integration.spec.ts`) | 16 | 86 | ~17-19s | 66s parallelized (extended-catalog 15.7s, run-typecheck 9s, config-resolution 8s) |
| e2e (tarball) | 3 projects | - | minutes | not measured |

Decision (LOCKED):
- `test` = fast unit only (~29 files, ~3s).
- `integration` = real-compiler specs (`*.integration.spec.ts`), 16 + the 2 reclassified = 18.
- `e2e` = the 3 tarball projects (renamed from their current `test` target).
- **Reclassify via `git mv` (no code change): `gate-b.spec.ts` -> `gate-b.integration.spec.ts` and
  `compiler-cli-types.runtime.spec.ts` -> `compiler-cli-types.runtime.integration.spec.ts`.**
  Both already run cold `runTypecheck`/`performCompilation`. Verify no other file references
  these paths by name before renaming (the vitest include glob catches them either way).
- Mechanism: split the plugin's vitest into a fast `test` target (exclude `**/*.integration.spec.ts`)
  and an `integration` target (include only `**/*.integration.spec.ts`). Prefer two vitest
  configs over inline CLI globs. `test-util`'s single spec is fast -> stays `test`.
- CI runs the tiers as separate steps: `nx run-many -t test`, then `-t integration`, then
  `-t e2e --parallel=1` (preserve the shared-tarball serialization). Fast tier fails fast.
</decisions>

<code_context>
## Repo analysis (verified 2026-07-10)

### Real projects and current targets
| Project | Path | Targets today |
|---|---|---|
| ng-spike-app | apps/ng-spike-app | build (@angular/build), serve, lint, serve-static |
| test-util | libs/test-util | build (@nx/js:tsc), lint, test (@nx/vitest) |
| typecheck-consumer | libs/typecheck-consumer | typecheck (angular-typechecker:typecheck) |
| typecheck-consumer-dep | libs/typecheck-consumer-dep | (NONE) |
| typecheck-walk-consumer | libs/typecheck-walk-consumer | typecheck (angular-typechecker:typecheck) |
| angular-typechecker | packages/angular-typechecker | build, lint, nx-release-publish, scoped-name-guard, typecheck-drift, test |
| @angular-typechecker/source | ./project.json (root) | local-registry |
| angular-typechecker-cache-e2e | e2e/.../cache-e2e | test (@nx/vitest), typecheck-e2e (tsc --noEmit) |
| angular-typechecker-install-e2e | e2e/.../install-e2e | test, typecheck-e2e |
| angular-typechecker-matrix-e2e | e2e/.../matrix-e2e | test, typecheck-e2e |

### Coverage GAPS (first-party files NOT type-checked today)
1. **Plugin spec files ~50** (`packages/angular-typechecker/src/**/*.spec.ts`): included by
   `tsconfig.spec.json` but NOTHING runs tsc on it; `@nx/vitest:test` uses esbuild (no
   type-check). BIGGEST gap. Enabling this for the first time will likely SURFACE real type
   errors that must be fixed to go green - this is the bulk of the work.
2. **test-util spec** (`find-workspace-root.spec.ts`) - same reason.
3. **Tooling configs ~11** `.mjs`/`.mts`: root `eslint.config.mjs` + `vitest.workspace.ts`;
   per-project `eslint.config.mjs` (app, test-util, plugin); `vitest.config.mts` (test-util,
   plugin, 3x e2e).
4. **typecheck-consumer-dep** (index.ts, dep.component.ts) - zero targets; weak transitive
   coverage only.
5. **Loose fixtures/** (58 .ts) - mixed; broken excluded (D1), clean set gets coverage.

### Already type-checked (do not regress)
- Plugin LIB src via `build`; plugin DRIFT via `typecheck-drift`.
- App src via `build`.
- test-util LIB via `build`.
- typecheck-consumer / walk-consumer src via `typecheck` (dogfood).
- e2e spec sources via `typecheck-e2e`.

### Constraints / landmines
- `.nxignore` deliberately excludes `e2e/angular-typechecker-matrix-e2e/fixtures/` and
  `e2e/angular-typechecker-install-e2e/fixtures/consumer-storybook-composition/` from the
  main graph. Do NOT undo this.
- Release: `nx.json` release.version.preVersionCommand = `npx nx run-many -t build`, scoped to
  project `angular-typechecker`. Adding stray `build` targets to fixture libs risks release
  breakage - another reason for D3 (additive, not buildout).
- `@nx/eslint:lint` targetDefaults sets `maxWarnings: 0`. New/edited files must be
  Prettier-clean AND lint-clean (both are required CI gates). Run `nx format:check` + `nx
  run-many -t lint` before the PR.
- CI required check is the `ci` aggregate job (see .github/workflows/ci.yml). `main` is
  PR-only (empty-bypass ruleset) - never push to main; open a PR.
- Executor loading: plugin ships CommonJS; `angular-typechecker:typecheck` requires the
  plugin discoverable by Nx. It is (source project). The clean Angular fixtures can be
  type-checked by `angular-typechecker:typecheck`; non-Angular by `@nx/js:tsc` noEmit.
- targetDefaults in nx.json key on EXECUTOR (`@nx/vitest:test`) not target NAME, so renaming
  e2e `test` -> `e2e` keeps the vitest cache/inputs defaults. There is an existing
  `angular-typechecker:typecheck` targetDefault (by target name) - reconcile if a project's
  `typecheck` uses a different executor (@nx/js:tsc) so the name-keyed default doesn't apply
  wrong inputs.

### "Make it green locally" - CI gate equivalents to run before PR
- `npx nx run-many -t typecheck` (new unified)
- `npx nx run-many -t test`
- `npx nx run-many -t e2e --parallel=1` (heavy: tarball install; may only be fully
  verifiable in CI - note if so)
- `npx nx run-many -t lint`
- `npx nx format:check` (or `--all` locally)
- `npx nx scoped-name-guard angular-typechecker`
- `bash tools/act/act-compat.sh` + actionlint (if ci.yml is edited)
</code_context>

<specifics>
## Specific Ideas
- Prefer one shared/base tsconfig for tooling configs (e.g. a root `tsconfig.tools.json`)
  covering all `eslint.config.mjs` + `vitest.*.mts` + `vitest.workspace.ts`, type-checked via
  an `@nx/js:tsc` noEmit `typecheck` target on the root project.
- For the plugin: fold `typecheck-drift` into `typecheck` (or make `typecheck` also cover the
  drift tsconfig) so `nx run-many -t typecheck` catches drift too; ensure specs are covered.
- For clean fixtures: consider grouping their coverage rather than one target per dir if a
  single tsconfig can `include` the clean set (only if it does not pull in broken siblings).
</specifics>

<canonical_refs>
## Canonical References
- `AGENTS.md` (release mechanics, worktree rules, PR-only main, CI gates)
- `.github/workflows/ci.yml` (the `ci` aggregate is the required check)
- `nx.json` (targetDefaults, release config)
- Prettier config: `.prettierrc` `singleQuote: true`; `.prettierignore` excludes `.planning/`
</canonical_refs>
