# angular-typechecker

## What This Is

angular-typechecker is an Nx plugin that type-checks Angular projects -- applications, libraries (local/non-buildable, buildable, and publishable), and unit-test (spec) tsconfigs -- the way `ngc --noEmit -p <tsconfig>` would, but *completely* and *decoupled from building or running tests*. It runs the Angular compiler's full diagnostic set: TypeScript checks plus Angular template type-checking and extended diagnostics (NG8xxx). It ships an Nx executor (`typecheck`) that walks a project's solution `tsconfig.json` to type-check all in-project referenced leaves (lib/app + spec) in one pass, a `configuration` generator that wires the target, a standalone `init` generator that seeds caching, and `nx add angular-typechecker` support -- targeting Nx 23 + Angular 22 (TypeScript 6). It exists to give a fast static-check feedback loop for AI coding agents and CI pipelines.

## Core Value

Deliver the *complete* Angular type-check (TypeScript + template type-check + extended diagnostics) for any project type *without* building the application or executing the tests -- faster, in isolation, and more completely than either the build's coupled check or a bare `ngc --noEmit`.

Why this matters (validated by Brandon Roberts' 2026-06-26 analysis): at scale the whole-program type-check is the dominant, *separable* cost of an Angular build (~15s standalone `ngc --noEmit` vs ~36s full esbuild build). Fast per-file compilers (AnalogJS `fastCompile`, the experimental Oxc compiler) and esbuild dev deliberately *skip* the type-check for speed and expect you to "run the type-check elsewhere"; the editor's Angular Language Service covers the live loop. angular-typechecker is that "elsewhere" for headless/CI/agent loops -- Nx-native, cacheable, and runnable per project.

Distinct from Nx's built-in `@nx/js` `typecheck` target (plain `tsc`/`tsgo`): Angular projects cannot use that fast path -- Angular lacks TypeScript project-references support -- and it would not surface Angular template type-check or extended (NG8xxx) diagnostics anyway. angular-typechecker is the Angular-aware whole-program no-emit type-check that fills that gap.

## Current State

**Shipped v0.1.0 (2026-07-02)** -- the latest release, published live to npm as `angular-typechecker@0.1.0` (tokenless OIDC Trusted Publisher + SLSA v1 provenance), following v0.0.1/v0.0.2 (2026-06-28/29) and v0.0.3 (2026-06-30).

The Nx executor is renamed `typecheck` (id `angular-typechecker:typecheck`, BREAKING) and now walks a project's solution `tsconfig.json`: it resolves `references[]` to in-project leaves (lib/app + spec), runs `performCompilation` per leaf, and unions + dedupes the diagnostics into one verdict -- module-boundary-guarded, coarse-cached. A `configuration` generator (renamed from `typecheck-configuration`) wires ONE minimal `typecheck` target at the solution tsconfig; a standalone `init` generator seeds `nx.json` `targetDefaults` with the cacheable block; `nx add angular-typechecker` runs `init` on install. Both generator entry points are proven end-to-end against the real installed tarball, and a CI self-audit guard turns a forgotten e2e project entry into a loud failure instead of a silent skip. `main` is PR-only with a Release-PR flow and a curated public changelog.

- **Codebase:** ~2,709 LOC production TypeScript across 22 non-test `.ts` files in `packages/angular-typechecker/src/`; ~8,552 LOC including the test suite (56 `.ts` files total); plus e2e fixture projects (incl. the new `consumer-generator` fixture), CI/release workflows, and a `tsconfig.drift.json` build-time drift tripwire.
- **Tech stack:** Nx 23.0.1, Angular 22.0.4, TypeScript 6.0.3, Vitest 4, Node 22/24/26. `@nx/devkit` pinned dependency; `@angular/compiler-cli` + `typescript` peers. CI quality gate: `fallow@2.103.0` (path-gated, new-only).
- **Known issues / debt:** none accumulated in v0.1.0 (re-audit: zero tech debt, upgraded from an initial `tech_debt` verdict after the two README gaps + one grammar nit + one frontmatter-bookkeeping gap were fixed). `.npmrc legacy-peer-deps=true` remains a dev-repo concern that does not reach consumers.
- **Current milestone:** none active -- v0.1.0 is closed. Next milestone TBD via `/gsd-new-milestone`.

v0.1.0 delivered in five phases (incl. inserted 13.1): **Phase 12** (Extended-diagnostic catalog + completeness tripwire, CAT-01..05/DRIFT-01) -- all 18 `ExtendedTemplateDiagnosticName` members + baseline TS/NG codes asserted by exact code/category/count in one enum-keyed `it.each` table, with an enum-vs-table completeness tripwire. **Phase 13** (Engine reference-walking, WALK-01/02) -- `runTypecheck` walks a solution tsconfig's in-project referenced leaves in one call, union + dedupe by value identity, module-boundary-guarded, coarse-cached. **Phase 13.1** (Executor rename, EXEC-01) -- the BREAKING rename `angular-typechecker:angular-typecheck` -> `angular-typechecker:typecheck`, driving the 0.0.3 -> 0.1.0 minor bump. **Phase 14** (`configuration` + `init` generators + `nx add`, GEN-01..09) -- config-edit-only generator suite wiring the walk-based target and seeding `nx.json` caching. **Phase 15** (Generator e2e + CI self-audit guard, GE2E-01..03/GUARD-01) -- both generator entry points proven against the real tarball, plus the `-p` set-equality CI guard.

## Prior Milestone: v0.0.3 -- Engine hardening

v0.0.3 delivered in four phases: **Phase 8** (Correctness & Completeness, COR-01..04) -- config-resolution 500 re-thrown as infrastructure, global TS diagnostics via `getGlobalDiagnostics()`, empty-`fileName` diagnostics kept, pure core `toExitCode` 0/1/2 policy. **Phase 9** (Resilience, RES-01..04) -- HYBRID per-file fault isolation (gated spike) so one `FatalDiagnosticError` no longer collapses the run + a loud TCB-abort notice, `realpath()` try/catch, `suppressOutputPathCheck`. **Phase 10** (Drift-hardening, HARD-01..05) -- build-time `tsconfig.drift.json` + `typecheck-drift` CI target, `EmitFlags` fix, vendor markers, retained no-op getter, no-`TS-99`-leak spec. **Phase 11** (Code-Quality Gate, QUAL-01..03) -- `fallow@2.103.0` adopted as a path-gated CI quality gate (`--format human`, exit-code-gated, least-privilege `contents: read`), current findings resolved (gate green on adoption), proven RED on introduced dead code via a throwaway PR.

## Shipped Milestone: v0.1.0 -- configuration + init generators, nx add support, and the typecheck executor rename

**Goal:** Ship (1) a solution-tsconfig REFERENCE-WALKING mode for the `angular-typecheck` engine -- point one target at a project's `tsconfig.json`, walk its in-project `references[]` leaves (lib/app + spec), and type-check them in one `runTypecheck` call (union + dedupe, module-boundary-guarded, coarse-cached) -- and (2) the `configuration` generator (renamed from `typecheck-configuration`) + a standalone `init` generator: the generator wires ONE minimal `typecheck` target (executor `angular-typechecker:typecheck`) at the solution `tsconfig.json` and delegates caching to `init` (which seeds `nx.json` targetDefaults), with `nx add angular-typechecker` running `init` on install (still config-edit-only -- `project.json` + `nx.json`, no file emission), plus the board-ratified extended testing-technique stack (Phase 12: complete NG8xxx catalog + tripwire, shipped). The executor is RENAMED `angular-typechecker:angular-typecheck` -> `angular-typechecker:typecheck`, a BREAKING change that bumps 0.0.3 -> 0.1.0 under 0.x conventional commits. The reference-walking mode was GO-gated by spikes 001-005 (`.planning/spikes/`, all VALIDATED); it supersedes the D-03a solution-style short-circuit and the board's decision-B "no executor change" assumption (see Key Decisions + the spike `MANIFEST.md`).

**Target features** (testing strategy ratified by a unanimous 8-lens Opus board -- 5 constructive + 3 adversarial; record: `research/v0.0.4-testing/board2/CONSENSUS.md`):
- **Reference-walking engine (WALK):** the `angular-typecheck` engine accepts a solution / references-only `tsconfig.json` and type-checks each IN-PROJECT referenced leaf (`tsconfig.lib.json`/`tsconfig.app.json` + `tsconfig.spec.json`) in one `runTypecheck` call -- union raw per-leaf diagnostics -> single `finalize`, dedupe by `ts.sortAndDeduplicateDiagnostics` value identity (`file.path`+start+length+code+message), explicit post-dedupe category counts (D-01 invariant carried forward); a reference-resolution-layer module-boundary guard SKIPS out-of-project references (skip-with-notice, path-containment), orthogonal to and composable with the existing `filter-diagnostics`/`includeDeps`; the D-03a zero-rootNames guard splits THREE-WAY (references + >=1 in-project leaf -> walk; references + 0 in-project -> new synthesized error, code 90001; no references -> unchanged empty-project error). Coarse single-target caching accepted (any leaf/dep change busts). GO-gated by spikes 001-005.
- `configuration` generator (renamed from `typecheck-configuration`; Nx 23 devkit): edits `project.json` (`readProjectConfiguration`/`updateProjectConfiguration`/`formatFiles`; NO `generateFiles`, no file emission) and seeds `nx.json` targetDefaults via the `init` generator; hand-authored schema; idempotent + non-ours-collision-safe re-runs. Wires ONE minimal `typecheck` target pointed at the project's solution `tsconfig.json` (executor id `angular-typechecker:typecheck`), relying on WALK; per-project-type `tsConfig` detection and a separate spec target EVAPORATE (spec is a walked leaf). `--tsConfig` override + a flat-project leaf fallback (by `projectType` with an existence probe when there is no solution/`references`); configurable `targetName` (default `typecheck`). **Nx workspaces only -- Angular CLI `angular.json` layouts deferred.**
- `init` generator (standalone): idempotently seeds `nx.json` `targetDefaults["angular-typechecker:typecheck"]` with the WALK-02 cacheable block (`cache:true`, `outputs:[]`, `default`-based inputs, never `production`), keyed by the unscoped published id, never clobbering a customized entry; `configuration` calls it, and `nx add angular-typechecker` runs it on install.
- Generator tests on the PUBLIC in-memory `createTreeWithEmptyWorkspace` substrate (+ schema-parity). The bespoke real-disk `createFsTree`/`flushFsTreeChanges` is NOT built (board Option A: zero value for a `project.json`-edit generator; the prior-art FsTree helper lived only in an executor e2e). Real-disk fidelity comes from the tarball e2e. **Unchanged by the WALK reshape** -- the generator still emits NO files (board decision D1 holds; it's the *executor* that changes, separately). WALK itself adds new engine INTEGRATION tests over a multi-leaf solution fixture (real compiler), not FsTree.
- Complete extended-diagnostic catalog: assert all **18** `ExtendedTemplateDiagnosticName` members + the baseline TS/NG codes by **exact code + `DiagnosticCategory` + count + one severity-promotion case**, against the real compiler over **committed fixtures**, in a **single data-driven `it.each` table keyed on the enum** (introduction-version is a row field, not a file split). The 18 members are NG8101-8117 **plus NG8011 + NG8021** (both outside the 81xx range -- never filter by numeric pattern); **NG8011 is emitted out-of-band / not promotable** (assert observed category, skip its promotion case); NG8110/NG8118 are `ErrorCode`s but NOT configurable extended diagnostics.
- Enum-vs-table **completeness tripwire**: catalog rows === the `ExtendedTemplateDiagnosticName` enum, so a future Angular release that adds/renames/removes a member fails CI loudly (`it.skip`-with-written-reason keeps the row in the catalog so the tripwire stays honest).
- Generator e2e folded into `angular-typechecker-install-e2e`: ship `generators.json` + the `configuration`/`init` generators, add an un-wired project to the consumer fixture, `nx g angular-typechecker:configuration` -> assert `project.json` + the seeded `targetDefaults` -> `nx run <proj>:typecheck --skip-nx-cache`; plus an `nx add angular-typechecker` scenario proving `init` runs on install. No Verdaccio, no new e2e project.
- CI: in-plugin specs auto-route into the existing 6-cell `test` matrix (no `ci.yml` structural change); add a **set-equality guard test** (the `e2e` job `-p` list === all `e2e/*` projects in the graph) to convert the silent-skip landmine into a loud failure; single required `ci` gate unchanged.

**Out of scope (unchanged):** `ng add` (Angular CLI) install schematic (Nx's `nx add` IS in scope this milestone), machine-readable reporters (JSON/SARIF), `NgtscProgram` incremental/`--watch`, `createNodesV2` inference, Jest, Storybook story type-check, standalone CLI. **Excluded by the board (fragility/no-gain):** the bespoke `createFsTree` real-disk helper, a mid-tier executor-vs-workspace test, Verdaccio, the jscodeshift injection toolkit, Nx cache/`dependsOn`-ordering tests, quiet/errors-only mode tests.

**Key context:** The v0.0.4 milestone was re-versioned to **v0.1.0** on 2026-07-01 when the maintainer decided to rename the executor (breaking) and expand the generator into a suite (`configuration` + `init`) with `nx add` support -- the idiomatic first-party Nx pattern (minimal per-project target + `init`-seeded `targetDefaults`), verified against the Nx 23 source (`@nx/eslint:lint-project`, `@nx/vitest:configuration`). The FsTree utilities remain NOT built (board Option A; in-memory `createTreeWithEmptyWorkspace` is the substrate). Connect prior art is read READ-ONLY and fully sanitized (no proprietary identifiers ever reach this repo).

## Requirements

### Validated (v0.0.1 -- shipped and verified 2026-06-29)

- [x] `angular-typecheck` Nx executor: programmatic `@angular/compiler-cli` whole-program type-check, no-emit. -- v0.0.1
- [x] Complete diagnostics: a custom gatherer runs all phases UNCONDITIONALLY (models `@angular/build`, not `ngc`'s short-circuit) -- TS + Angular template type-check + extended (NG8xxx). -- v0.0.1
- [x] Required `tsConfig` option (single tsconfig per target, overridable); spec/unit-test checking via a target pointed at `tsconfig.spec.json`. -- v0.0.1
- [x] Modes: report-all by default (matches `tsc --noEmit`); opt-in fail-fast. -- v0.0.1
- [x] Dependency boundary: exclude out-of-project + `node_modules` by default; opt-in `includeDeps`. -- v0.0.1
- [x] `--max-warnings=<n>` (0 = fail on any warning); errors always fail; configured categories respected. -- v0.0.1
- [x] Human output = `formatDiagnostics`; absolute realpath-normalized filter (pnpm-symlink / case-insensitive-FS safe); workspace-root-relative CI annotation paths; agent-ready (deterministic, idempotent, non-zero exit). -- v0.0.1
- [x] Nx-cacheable target (`cache:true`, `outputs:[]`, per-tsconfig + dependency-source inputs + `externalDependencies`), proven by a dependency-error-busts-cache test. -- v0.0.1
- [x] Validated across all five project types: application, local (non-buildable) library, buildable library, publishable library, spec tsconfig. -- v0.0.1
- [x] Test pyramid (Vitest): unit (mock compiler-cli) + integration (real compiler, v13->v22 catalog) + e2e (smoke + full matrix). -- v0.0.1
- [x] Module format: CommonJS executor loads ESM `@angular/compiler-cli` via `await import()`, built with `module: nodenext` (no `import()`->`require()` downlevel; GATE A). -- v0.0.1
- [x] Published to npm (MIT) via `nx release` with tokenless OIDC Trusted Publisher + SLSA v1 provenance; manual `project.json` target wiring documented. -- v0.0.1 (0.0.1 + 0.0.2)
- [x] CI: GitHub Actions, Node 22/24/26 x Linux/Windows/macOS (heavy e2e gate Linux-only). -- v0.0.1
- [x] Release-PR workflow: PR-only `main`, version/changelog via PR, tag-the-merge-commit publish, clean public changelog (no GSD phase/plan scopes). -- v0.0.1

### Validated (v0.0.3 -- shipped and verified 2026-06-30)

- [x] Correctness: config-resolution `UNKNOWN_ERROR_CODE` (500) re-thrown as `TypecheckInfrastructureError` (never counted as a type error); global / location-less TS diagnostics surfaced via `getGlobalDiagnostics()`; present-but-empty `file.fileName` diagnostics kept (not dropped by the boundary filter). -- v0.0.3 (COR-01..03)
- [x] Exit-code policy: pure framework-agnostic `toExitCode` -> `0`/`1`/`2` (clean/type-error/infra); Nx executor surfaces infra distinctly within Nx's `{ success }` contract; literal OS exit `2` deferred to the standalone CLI. -- v0.0.3 (COR-04)
- [x] Resilience: HYBRID per-file fault isolation (GATED spike) so one `FatalDiagnosticError` no longer collapses the run -- surviving files' TS + non-template diagnostics still reported -- with a loud, never-silent TCB-generation suppression notice; `realpath()` try/catch with raw-path fallback; `suppressOutputPathCheck: true`. -- v0.0.3 (RES-01..04)
- [x] Drift-hardening: build-time `tsconfig.drift.json` + `typecheck-drift` CI target asserts the real `api.Program` stays assignable to the vendored shim (real->shim) and pins the NG error-code encoding; `EmitFlags.None` fabrication corrected; greppable `// angular-typechecker: vendored` markers; `getNgStructuralDiagnostics()` retained under the assertion; no-`TS-99`-leak regression spec. -- v0.0.3 (HARD-01..05)
- [x] Code-quality gate: `fallow@2.103.0` adopted as a path-gated, SHA-pinned, new-only CI job wired into the `ci` aggregate (single required check unchanged); current findings resolved (green on adoption) via `.fallowrc.jsonc`; proven RED on introduced dead code. -- v0.0.3 (QUAL-01..03)

Full detail with outcomes: `.planning/milestones/v0.0.3-REQUIREMENTS.md`.

### Validated (v0.1.0 -- shipped and verified 2026-07-02)

- [x] Complete extended-diagnostic catalog: all 18 `ExtendedTemplateDiagnosticName` members + the 12 baseline TS/NG codes asserted by exact code + `DiagnosticCategory` + count in one enum-keyed `it.each` table, plus a severity-promotion proof (NG8101). -- v0.1.0 (CAT-01..05)
- [x] Enum-vs-table completeness tripwire: an Angular release that adds/renames/removes an extended-diagnostic member fails CI loudly instead of silently under-covering. -- v0.1.0 (DRIFT-01)
- [x] Reference-walking engine: `runTypecheck` on a solution `tsconfig.json` walks its in-project referenced leaves (lib/app + spec) in one call, unions + dedupes by value identity, and applies a module-boundary guard that skips out-of-project references. -- v0.1.0 (WALK-01, achieved via spikes 001-005 GO)
- [x] Walk-target caching uses the `default` named input (never `production`, which would under-hash `*.spec.ts` -> stale PASS). -- v0.1.0 (WALK-02)
- [x] Executor renamed `angular-typechecker:angular-typecheck` -> `angular-typechecker:typecheck` (breaking, drives the 0.0.3 -> 0.1.0 minor bump); behavior unchanged. -- v0.1.0 (EXEC-01)
- [x] `configuration` generator (renamed from `typecheck-configuration`) wires ONE minimal `typecheck` target at the solution `tsconfig.json` (override + flat-project fallback), idempotent, non-ours-collision-safe; ships hand-authored schemas registered via `generators.json`. -- v0.1.0 (GEN-01..06)
- [x] Standalone `init` generator idempotently seeds `nx.json` `targetDefaults["angular-typechecker:typecheck"]` with the WALK-02 cacheable block, never clobbering a customized entry; `configuration` invokes it. -- v0.1.0 (GEN-07, GEN-08)
- [x] `nx add angular-typechecker` auto-runs `init` on install, seeding caching with no manual `nx.json` edit. -- v0.1.0 (GEN-09)
- [x] Both generator entry points (`configuration` and `nx add`) proven end-to-end against the real installed tarball: target wiring, `targetDefaults` seeding, and a correct multi-leaf walk verdict (clean pass; injected lib + spec errors both surfaced). -- v0.1.0 (GE2E-01..03)
- [x] CI self-audit guard: the `e2e` job's `-p` project list is asserted set-equal to the actual `e2e/*` projects, turning a forgotten entry into a loud failure. -- v0.1.0 (GUARD-01)

Full detail with outcomes: `.planning/milestones/v0.1.0-REQUIREMENTS.md`.

### Active

None yet -- define the next milestone's requirements via `/gsd-new-milestone`.

The remaining deferred families carried from v0.0.1 (inferred targets INF, the `ng add` Angular CLI install schematic + Angular CLI workspace generator GEN-FUT-01/02, other surfaces SUR, reporters/performance REP incl. the `NgtscProgram` incremental engine + REP-RES-02b, broader support SUP) plus the `totalFilesCount` observability field (OBS-01) and the v0.1.0 Future Requirements (FSTREE-01, WALK-FUT-01/02) remain Out of Scope (below) pending a future milestone.

### Out of Scope (deferred to later milestones, not abandoned)

- `createNodesV2` inferred `angular-typechecker:typecheck` targets (granular per-leaf; WALK-FUT-01) -- next milestone.
- Project references / `NgtscProgram` incremental declaration-reuse to collapse the walk's double-compile tax (WALK-FUT-02) -- needs the deferred `NgtscProgram` engine.
- Bespoke real-disk `createFsTree`/`flushFsTreeChanges` test helpers (FSTREE-01) -- only if a future generator emits files a real compiler must read back.
- `ng add` (Angular CLI) install schematic (GEN-FUT-02). (Nx's `nx add` + the `configuration`/`init` generator suite shipped in v0.1.0 -- see Shipped Milestone above; only the Angular CLI `ng add` path stays deferred.)
- Angular CLI (`angular.json`) workspace support for the generators via `convertNxGenerator` (GEN-FUT-01).
- Standalone CLI binary (non-Nx use); owns the literal OS exit code `2`.
- `totalFilesCount` observability field on `CoreResult` (OBS-01, `@nx/js` parity) -- pending charter-fit.
- Storybook story (`*.stories.ts`) type-check support.
- Angular CLI surface for non-Nx `angular.json` workspaces: our Nx executor re-exported as an Angular **builder** via `convertNxExecutor` (thin re-export over the same core + Nx executor -- NOT a hand-written `@angular-devkit/architect` builder; these `@nx/devkit` APIs are current, not deprecated).
- Machine-readable reporters: JSON, SARIF, and others.
- `NgtscProgram` migration -> incremental (`oldProgram` + affected files + `OptimizeFor.SingleFile`) and `--watch` mode.
- Jest support (ESM-mode only, if feasible -- spike-gated; older tooling proved it infeasible, re-test on current stack).
- Wider support: older Angular (20/21, non-TS-6) on their Nx versions; future Angular/Nx pairs.

## Context

Prior art: the project was prototyped twice -- a personal sandbox (`D:/projects/sandbox/nx19-8-angular18-2-...`, Nx 19.8 / Angular 18.2) and a proprietary work repo (no proprietary details retained here). Both converged on the same engine: programmatic `@angular/compiler-cli` `performCompilation` with a *custom all-diagnostics gatherer*. Both are version-bound to an older stack, so they are treated as reference only and every borrowed pattern is re-validated against Nx 23 / Angular 22 / TS 6 / Node 24.

Reusable artifacts identified from the prior art:
- Test helpers `createFsTree()` / `flushFsTreeChanges()` -- bespoke wrappers around the nx-internal `FsTree` + `flushChanges` (`nx/src/generators/tree`, resolving to `dist/src/generators/tree.js` and returning both on `nx@23.0.1`; no public re-export -- the public alternative is the in-memory `createTreeWithEmptyWorkspace` from `@nx/devkit/testing`). PLANNED as a v0.0.1 deliverable but NEVER delivered to source. The v0.0.4 board (Option A) decided NOT to build them: generator tests use the public in-memory `createTreeWithEmptyWorkspace`; the bespoke real-disk wrapper stays deferred unless a future generator emits files a real compiler must read back.
- The Angular diagnostic catalog organized by the Angular major that introduced each check (v13 baseline through v21's NG8021), all asserted on Angular 22 plus any v22 additions.

Engine verified against local Angular source (framework v22.1.0-next.3, CLI v22.1.0-next.1): `ngc` / `defaultGatherDiagnostics` short-circuits by phase (skips `getNgSemanticDiagnostics`, i.e. template + extended diagnostics, when an earlier phase errors). The modern `@angular/build:application` builder does NOT short-circuit -- it gathers option/syntactic/semantic independently and calls `getDiagnosticsForFile(sf, OptimizeFor.WholeProgram)` per file unconditionally. angular-typechecker models `@angular/build`, giving the complete diagnostic set in one pass -- more complete than the bare `ngc --noEmit` that AnalogJS and the Brandon Roberts article recommend as the separate type-check step.

Ecosystem positioning: AnalogJS has no standalone type-check tooling -- its official guidance for `fastCompile` users is a manual `ngc -p tsconfig.app.json --noEmit && vite build` npm script. angular-typechecker is the first Nx-native, cacheable, project-graph-integrated replacement for that step, and the natural companion to fast per-file builds (fastCompile, Oxc, esbuild dev) and the editor's Language Service.

Forward tailwind: TypeScript 7 (Go port, ~10x type-check target). Since `ngtsc` wraps `ts.Program`, the decoupled check stands to get much faster later; v0.0.1 targets TS 6 (Angular 22's window).

## Constraints

- **Tech stack**: Nx 23.x, Angular 22.x, TypeScript `>=6.0.0 <6.1.0` -- only viable pairing (Angular 22 needs Nx 23+; only Angular 22 supports TS 6).
- **Node**: `^22.22.3 || ^24.15.0 || ^26.0.0` (intersection of Angular 22 and Nx 23 ranges; recompute when widening the target set).
- **Test runner**: Vitest via `@nx/vitest:test` (the dedicated Nx 23 package; `@angular/compiler-cli` is ESM-only; Jest deferred).
- **Dependencies**: `@nx/devkit` as a pinned `dependency` (do NOT declare `nx`; devkit's peer carries it transitively); `@angular/compiler-cli` + `typescript` as `peerDependencies` (consumer's versions). Policed by `@nx/dependency-checks`. (devkit-as-dependency is required for Nx plugin-registry listing.)
- **Module format**: CommonJS executor + dynamic `import()` of ESM compiler-cli, shipped as pre-compiled `.js` built with `module: node16`/`nodenext` (Nx's executor loader is `require()`-based across Nx 21/22/23; `module: commonjs` would downlevel `import()` to `require()` and break at runtime).
- **Engine**: `performCompilation` + custom unconditional all-getter gatherer (Approach A) for v0.0.1; `NgtscProgram` per-file migration deferred.
- **Platform**: developed on Windows arm64; CI on Linux/Windows/macOS free standard public-repo runners.
- **License**: MIT, (c) Lars Gyrup Brink Nielsen.
- **Versioning**: 0.x semver (breaking changes allowed in minor releases pre-1.0).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Package name `angular-typechecker` (unscoped, MIT) | Available on npm; cleanest `nx add`/`ng add` UX | [OK] Validated v0.0.1 |
| v0.0.1 = Nx executor only; everything else deferred | Smallest publishable, valuable slice (Vertical MVP) | [OK] Validated v0.0.1 |
| Support Nx 23 + Angular 22 + TS 6 only | Matrix-confirmed only viable pairing for TS 6 | [OK] Validated v0.0.1 |
| Engine: `performCompilation` + custom all-getter gatherer (unconditional) | Avoids `ngc` short-circuit; models `@angular/build`; stable API | [OK] Validated v0.0.1 |
| Module: CJS executor + `await import()`, compiled `.js` with `module: node16`/`nodenext` | Nx loader require()-based; ESM compiler-cli; avoid import()->require() downlevel | [OK] Validated v0.0.1 |
| `@nx/devkit` pinned dependency (no `nx`); compiler-cli + typescript peers | Nx publish-plugin recipe + registry listing; consumer versions | [OK] Validated v0.0.1 |
| Runner: Vitest via `@nx/vitest:test` (Jest deferred) | compiler-cli ESM-only; `@nx/vitest` is the Nx 23 package | [OK] Validated v0.0.1 |
| Default report-all; opt-in fail-fast (stop at first error) | Matches `tsc --noEmit` default | [OK] Validated v0.0.1 |
| Exclude out-of-project diagnostics by default; opt-in `includeDeps` | Project-in-isolation feedback | [OK] Validated v0.0.1 |
| `--max-warnings=<n>` (ESLint-style) | Only count-based prior art; tsc/ngc have none | [OK] Validated v0.0.1 |
| Default output = `formatDiagnostics`; JSON/SARIF deferred | Superset of tsc; lossless; machine formats later | [OK] Validated v0.0.1 |
| Cacheable target (`cache:true`, `outputs:[]`, @nx/js-style inputs) | Fast feedback; whole-program -> per-target cache | [OK] Validated v0.0.1 |
| Tests assert exact diagnostic codes across v13->v22 catalog | Improves on priors' pass/fail-only assertions | [OK] Validated v0.0.1 |
| e2e blends both prior approaches under Vitest (fixtures fast tier + tarball CI gate) | Fast agent loop + publish/install fidelity | [OK] Validated v0.0.1 |
| Capture `createFsTree`/`flushFsTreeChanges` (nx-internal FsTree) | Drive generators against real disk in tests; no public alt | [NOT BUILT] Planned v0.0.1, never delivered; v0.0.4 board (Option A) confirmed NOT building it -- generator tests use in-memory `createTreeWithEmptyWorkspace`; real-disk wrapper deferred to a future file-emitting generator |
| Promote `typecheck-configuration` config generator into v0.0.4; `ng add`/`nx add` stay deferred | The version-bumping `feat` for v0.0.4; smallest GEN slice; edits `project.json` only | Scoped v0.0.4 |
| v0.0.4 testing strategy set by a unanimous 8-lens Opus board (5 constructive + 3 adversarial), fact-only, 2 rounds | Stress-test the strategy from independent + adversarial angles before committing | Ratified: all-18 NG8xxx catalog (exact code+category+count+promotion) + enum-completeness tripwire + in-memory generator tests + folded generator e2e + `-p` set-equality guard; NO bespoke FsTree / mid-tier / Verdaccio. Record: `research/v0.0.4-testing/board2/CONSENSUS.md` |
| Release via `nx release`; manual target wiring in v0.0.1 | Dogfoods Nx; generator/ng-add/nx-add deferred | [OK] Validated v0.0.1 |
| Publish hardening: npm Trusted Publishers (OIDC) + provenance + hardened CI + SECURITY.md + tarball audit (publint/attw) | Supply-chain (s1ngularity); registry listing | [OK] Validated v0.0.1 |
| Diagnostics: absolute-realpath filter; workspace-root-relative CI paths; agent-ready output | Correct project-boundary filter + GitHub annotations; AI/CI consumers | [OK] Validated v0.0.1 |
| Angular CLI surface (deferred) via `convertNxExecutor`/`convertNxGenerator` re-exports | Current @nx/devkit APIs; thin adapters over same core | [OK] Validated v0.0.1 |
| GSD: YOLO, Standard granularity, parallel, quality/Opus, Vertical MVP | Correctness-critical tooling with a gating spike | [OK] Validated v0.0.1 |
| v0.0.3 hardens the existing `api.Program` engine; NO `NgtscProgram` migration | Targeted hardening, not a rewrite; verified faithful to `@angular/build` at 22.0.4 | [OK] Validated v0.0.3 |
| Config-resolution 500 -> `TypecheckInfrastructureError`; pure `toExitCode` 0/1/2 policy (executor stays in Nx `{success}`) | A "clean" verdict must never be a false negative; Nx hard-maps `{success}` to 0/1, so literal exit 2 belongs to the deferred CLI | [OK] Validated v0.0.3 |
| Resilience = HYBRID per-file fault isolation (gated spike GO) + loud TCB-abort notice; per-file template recovery deferred (REP-RES-02b) | Report as much as possible instead of all-or-nothing; faithful per-file template recovery needs `NgtscProgram`/`OptimizeFor.SingleFile` | [OK] Validated v0.0.3 |
| Build-time `tsconfig.drift.json` drift gate (real `api.Program` -> shim assignability) | An Angular upgrade that drifts the getter set / error-code encoding must break CI loudly, not silently under-gather | [OK] Validated v0.0.3 |
| `fallow` adopted as a path-gated, new-only, least-privilege CI quality gate (single required check unchanged) | Newly-introduced dead code / duplication / over-complexity should break CI; resolve findings rather than baseline | [OK] Validated v0.0.3 |
| v0.0.4: `angular-typecheck` engine gains solution-tsconfig REFERENCE-WALKING (walk in-project `references[]` leaves, union+dedupe, boundary-guarded, coarse-cached); generator wires ONE `typecheck` target -> `tsconfig.json` | The generator's open GEN-02/03 shape decision resolved by walking references instead of guessing per-project-type tsConfig or emitting N targets; single simple `nx run-many -t typecheck` DX; verified once against `tsc -b`-less Angular (no TS project references) | [OK] Validated v0.1.0 (GO-gated by spikes 001-005, all VALIDATED) |
| Reconcile board decision-B ("`project.json`-edit-only, NO executor change") | SUPERSEDED: the executor DOES change (reference-walking), spike-validated as Approach-A-compatible (existing `performCompilation`, no new compiler machinery). D1 (no bespoke FsTree; in-memory generator tests) STILL HOLDS -- the generator still emits no files; the change is in the engine. D6 scope EXPANDED (engine-walk added to v0.0.4). CONSENSUS.md left as-is; flagged here (D-13 precedent) for the milestone audit | Reconciled at v0.0.4 re-scope 2026-07-01; [OK] Validated v0.1.0 |
| Coarse single-target caching for the walk (vs per-leaf multi-target) | Spike 003: N leaves = N compiles whether walked or wired as N targets -- the walk adds NO compute, only coarser warm-cache granularity; per-leaf targets remain a consumer escape hatch; deferred `createNodesV2` inference is the granular auto-target future | [OK] Validated v0.1.0 (spike 005: walk target must use `default` not `production` inputs) |
| v0.1.0: rename executor `angular-typecheck` -> `typecheck` (id `angular-typechecker:typecheck`) | Cleaner, shorter public id; the `typecheck` target name matches the executor; sets up the generator suite | [OK] Validated v0.1.0 (breaking -> minor bump; drove 0.0.3 -> 0.1.0) |
| v0.1.0: generator SUITE -- `configuration` (renamed) + standalone `init`; caching seeded into `nx.json` targetDefaults via `init`, NOT inlined on the target | Idiomatic first-party Nx pattern (`@nx/eslint:lint-project` -> `lintInitGenerator`; `@nx/vitest:configuration` -> `init`), verified against Nx 23 source; keeps per-project `project.json` minimal AND delivers the cacheable value prop with no manual `nx.json` edit (no `nx add`/init existed before) | [OK] Validated v0.1.0 |
| v0.1.0: support `nx add angular-typechecker` (auto-runs `init`); `ng add` (Angular CLI) stays deferred | `nx add` is near-free once `init` exists (Nx invokes the package's registered `init`), giving cacheable-on-install UX; Angular CLI `ng add` is a separate surface (GEN-FUT-02) | [OK] Validated v0.1.0 |
| Public barrel (`src/index.ts`) trimmed to a minimal API -- keep `runTypecheck` + `TypecheckInfrastructureError` + `CoreOptions`/`CoreResult`/`SkippedReference`; engine internals (loaders, evaluators, filters, formatters) stay module-internal | PR #15 review finding: the original barrel over-exported engine internals no consumer needs; breaking pre-1.0 is cheap and the trim locks a durable public surface | [OK] Validated v0.1.0 (breaking, `refactor(core)!` `96e9c83`) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check -- still the right priority?
3. Audit Out of Scope -- reasons still valid? (promote deferred milestones)
4. Update Context with current state

---
*Last updated: 2026-07-02 -- v0.1.0 MILESTONE SHIPPED: closed via `/gsd-complete-milestone`. Milestone audit passed 22/22 requirements, 8/8 phases, 8/8 cross-phase seams wired, Nyquist COMPLIANT, zero tech debt. Published live to npm as `angular-typechecker@0.1.0` (tokenless OIDC + SLSA v1 provenance) through the Release-PR flow (PR #15 feature merge -> PR #16 version/changelog cut -> PR #17 changelog header fix -> tag `angular-typechecker@0.1.0` on the merge commit). All Active requirements moved to Validated; Requirements/Roadmap archived to `.planning/milestones/v0.1.0-*`; no new milestone opened yet.*

*Prior update: 2026-07-02 -- Phase 15 COMPLETE (milestone v0.1.0 now FEATURE-COMPLETE): the generator suite is proven end-to-end against the installed tarball and the CI e2e job is self-auditing. Shipped a new un-wired multi-leaf `consumer-generator` fixture + `generator-e2e.int.spec.ts` (GE2E-01/02: install tarball -> `nx g angular-typechecker:configuration` -> assert ONE `typecheck` target + the `init`-seeded `default`-input `targetDefaults` -> clean run exit 0 -> distinct lib-leaf TS2322 [in a lib-ONLY source no spec imports, so it uniquely attributes to the lib leaf] + spec-leaf TS2345 -> both codes visible), `nx-add-e2e.int.spec.ts` (GE2E-03: `npm install <tarball>` + `nx g angular-typechecker:init` -- the byte-identical command `nx add` runs internally -- seeds `targetDefaults` from ABSENT), and an in-plugin `ci-e2e-coverage-guard.spec.ts` (GUARD-01: bidirectional `every` set-equality between the CI `e2e` job's `-p` list and the `e2e/*` project set, with a deliberate-RED proof) + a D-13 tarball-audit extension for the 5 shipped generator paths. Verified 4/4 SC; install-e2e 26 tests green, plugin suite 239 green (incl. the guard); deep code review 0 blockers, 2 warnings FIXED (WR-01 lib-leaf isolation `7cd8139` + comment `6aff6df`; WR-02 seeded-from-absent baseline), 1 info accepted. All 22 v0.1.0 requirements validated. The 0.1.0 version cut is the milestone Release PR (per AGENTS.md), NOT this phase. Phases 12, 13, 13.1, 14, 15 all shipped.*

*Prior update: 2026-07-01 -- Phase 13.1 COMPLETE: the executor rename `angular-typechecker:angular-typecheck` -> `angular-typechecker:typecheck` (EXEC-01) landed as a breaking `feat!` (commit `956e657`), verified behavior-unchanged (build + 214 tests + 3 e2e + dual grep gates all green; package-name count 176, corruption canary 0). The 0.1.0 version cut is deferred to the milestone Release PR (no tag created this phase). Phases 12, 13, 13.1 shipped; 14 (configuration + init generators, nx add) and 15 (generator e2e + guard) remain.*

*Prior update: 2026-07-01 -- v0.1.0 RE-SCOPE: re-versioned v0.0.4 -> v0.1.0. Renamed the executor `angular-typechecker:angular-typecheck` -> `angular-typechecker:typecheck` (EXEC-01, breaking -> minor bump); expanded the generator into a suite (`configuration` renamed + standalone `init`, caching seeded via `init`; GEN-07/08) and added `nx add` support (GEN-09); reshaped GE2E + added the nx-add e2e (GE2E-03). Phase 13.1 inserted for the rename. Prior update 2026-07-01: v0.0.4 re-scoped after spikes 001-005 GO (WALK-01/02; reshaped GEN-02/03; reconciled board decision-B). Earlier 2026-06-30: milestone opened/scoped; v0.0.3 (engine hardening) shipped + archived; FsTree documentation-drift corrected.*
