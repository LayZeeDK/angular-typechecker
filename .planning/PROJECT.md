# angular-typechecker

## What This Is

angular-typechecker is an Nx plugin that type-checks Angular projects -- applications, libraries (local/non-buildable, buildable, and publishable), and unit-test (spec) tsconfigs -- the way `ngc --noEmit -p <tsconfig>` would, but *completely* and *decoupled from building or running tests*. It runs the Angular compiler's full diagnostic set: TypeScript checks plus Angular template type-checking and extended diagnostics (NG8xxx). The first milestone (`v0.0.1`) ships a single Nx executor (`angular-typecheck`) targeting Nx 23 + Angular 22 (TypeScript 6). It exists to give a fast static-check feedback loop for AI coding agents and CI pipelines.

## Core Value

Deliver the *complete* Angular type-check (TypeScript + template type-check + extended diagnostics) for any project type *without* building the application or executing the tests -- faster, in isolation, and more completely than either the build's coupled check or a bare `ngc --noEmit`.

Why this matters (validated by Brandon Roberts' 2026-06-26 analysis): at scale the whole-program type-check is the dominant, *separable* cost of an Angular build (~15s standalone `ngc --noEmit` vs ~36s full esbuild build). Fast per-file compilers (AnalogJS `fastCompile`, the experimental Oxc compiler) and esbuild dev deliberately *skip* the type-check for speed and expect you to "run the type-check elsewhere"; the editor's Angular Language Service covers the live loop. angular-typechecker is that "elsewhere" for headless/CI/agent loops -- Nx-native, cacheable, and runnable per project.

Distinct from Nx's built-in `@nx/js` `typecheck` target (plain `tsc`/`tsgo`): Angular projects cannot use that fast path -- Angular lacks TypeScript project-references support -- and it would not surface Angular template type-check or extended (NG8xxx) diagnostics anyway. angular-typechecker is the Angular-aware whole-program no-emit type-check that fills that gap.

## Current State

**Shipped v0.0.3 (2026-06-30)** -- the latest release, published live to npm as `angular-typechecker@0.0.3` (tokenless OIDC Trusted Publisher + SLSA v1 provenance), following v0.0.1 and v0.0.2 (shipped 2026-06-28/29).

The `angular-typecheck` Nx executor is real and runnable: a sub-50-line CommonJS adapter over a framework-agnostic core (`runTypecheck`) that loads ESM `@angular/compiler-cli` via `await import()` and gathers the complete diagnostic set unconditionally. Validated across all five project types against the installed tarball, made Nx-cacheable with a dependency-error-busts-cache correctness gate, and gated by a Node 22/24/26 x Linux/Windows/macOS CI matrix. v0.0.3 hardened that engine (correctness, resilience, drift-hardening) and added a `fallow` CI code-quality gate. `main` is PR-only with a Release-PR flow and a curated public changelog.

- **Codebase:** ~1,777 LOC production TypeScript across 15 non-test `.ts` files in `packages/angular-typechecker/src/`; ~5,263 LOC including the test suite (41 `.ts` files total); plus e2e fixture projects, CI/release workflows, and a `tsconfig.drift.json` build-time drift tripwire.
- **Tech stack:** Nx 23.0.1, Angular 22.0.4, TypeScript 6.0.3, Vitest 4, Node 22/24/26. `@nx/devkit` pinned dependency; `@angular/compiler-cli` + `typescript` peers. CI quality gate: `fallow@2.103.0` (path-gated, new-only).
- **Known issues / debt:** none accumulated in v0.0.3 (audit: zero tech debt). Residual items are documentation-drift / INFO-level only (see the milestone audits); `.npmrc legacy-peer-deps=true` remains a dev-repo concern that does not reach consumers.
- **Current milestone:** **v0.0.4 -- typecheck-configuration generator and extended testing strategy** (in planning). Ships the deferred `typecheck-configuration` Nx generator and adopts the sandbox/Connect testing-technique stack (bespoke FsTree utilities, generator tests, in-memory executor variant, per-introduction-version diagnostic catalog, generator e2e, CI jobs). See `## Current Milestone` below.

v0.0.3 delivered in four phases: **Phase 8** (Correctness & Completeness, COR-01..04) -- config-resolution 500 re-thrown as infrastructure, global TS diagnostics via `getGlobalDiagnostics()`, empty-`fileName` diagnostics kept, pure core `toExitCode` 0/1/2 policy. **Phase 9** (Resilience, RES-01..04) -- HYBRID per-file fault isolation (gated spike) so one `FatalDiagnosticError` no longer collapses the run + a loud TCB-abort notice, `realpath()` try/catch, `suppressOutputPathCheck`. **Phase 10** (Drift-hardening, HARD-01..05) -- build-time `tsconfig.drift.json` + `typecheck-drift` CI target, `EmitFlags` fix, vendor markers, retained no-op getter, no-`TS-99`-leak spec. **Phase 11** (Code-Quality Gate, QUAL-01..03) -- `fallow@2.103.0` adopted as a path-gated CI quality gate (`--format human`, exit-code-gated, least-privilege `contents: read`), current findings resolved (gate green on adoption), proven RED on introduced dead code via a throwaway PR.

## Current Milestone: v0.0.4 -- typecheck-configuration generator and extended testing strategy

**Goal:** Ship the deferred `typecheck-configuration` Nx generator (the GEN-family config generator that wires the `angular-typecheck` target into a project) AND adopt the full testing-technique stack proven in the sandbox + Connect prior art -- using the generator as the vehicle for the missing FsTree generator-testing technique -- closing the gaps in test utilities, test files, test cases, and CI jobs. A `feat` (the generator) bumps 0.0.3 -> 0.0.4 under 0.x conventional commits, so this milestone carries a version.

**Target features:**
- `typecheck-configuration` Nx generator (Nx 23 devkit): adds/configures the `angular-typecheck` target for a project; hand-authored schema; idempotent re-runs.
- Bespoke FsTree test utilities (`createFsTree` / `flushFsTreeChanges`) authored fresh over the nx-internal `FsTree` + `flushChanges` (`nx/src/generators/tree`; resolves to `dist/src/generators/tree.js` and returns both on `nx@23.0.1`), quarantined with `eslint-disable` + a drift tripwire on the internal import. (Substrate -- real-disk wrapper vs. the public in-memory `createTreeWithEmptyWorkspace` from `@nx/devkit/testing` -- finalized at requirements; default leans real-disk wrapper to stay faithful to the prior art.)
- Generator tests as in the sandbox/Connect prior art: FsTree-based generator unit tests + a generator e2e (sandbox `nx-plugin-e2e` style; Connect target-wiring-per-project-type patterns, sanitized).
- Complete extended-diagnostic coverage: assert EVERY Angular extended (NG8xxx) diagnostic in the catalog by exact code/count (the introduction-version taxonomy in `research/DIAGNOSTIC-CATALOG.md` -- baseline + extended). The test-file / test-name / test-case ORGANIZATION is research-informed (sandbox/Connect prior art + web prior art used as inspiration in earlier milestones) -- e.g. the per-introduction-version `executor.angularNN.integration.spec.ts` split, which v0.0.1 collapsed.
- Other existing-surface testing gaps: in-memory executor variant alignment, a drift-gate negative ("does it actually fail?") test, plus any gaps surfaced by research.
- CI jobs covering the new generator + test files/tiers.

**Out of scope (unchanged):** `ng add` / `nx add` install schematics (only the config generator lands), machine-readable reporters (JSON/SARIF), `NgtscProgram` incremental/`--watch`, `createNodesV2` inference, Jest, Storybook story type-check, standalone CLI.

**Key context:** The FsTree utilities were PLANNED as a v0.0.1 Phase-3 deliverable but were never delivered to source (no generator consumer existed) -- documentation drift corrected below; v0.0.4 authors them for real. Connect prior art is read READ-ONLY and fully sanitized (no proprietary identifiers ever reach this repo).

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

### Active (v0.0.4 -- in planning)

Scoped this milestone (REQ-IDs assigned during requirements definition): the `typecheck-configuration` Nx generator (the GEN-family config generator only -- `ng add`/`nx add` install schematics stay deferred) and an extended testing strategy that adopts the sandbox/Connect prior-art techniques. Concretely: the bespoke FsTree test utilities, FsTree-based generator unit tests, a generator e2e, the per-introduction-version diagnostic-catalog spec split, an in-memory executor variant, a drift-gate negative test, and the CI jobs to run them. Full requirements: `.planning/REQUIREMENTS.md` (written by this milestone).

The remaining deferred families carried from v0.0.1 (inferred targets INF, install schematics GEN-`ng add`/`nx add`, other surfaces SUR, reporters/performance REP incl. the `NgtscProgram` incremental engine + REP-RES-02b, broader support SUP) plus the `totalFilesCount` observability field (OBS-01) remain Out of Scope (below).

### Out of Scope (deferred to later milestones, not abandoned)

- `createNodesV2` inferred `angular-typecheck` targets (+ optional `typecheck` target override) -- next milestone.
- `nx add` + `ng add` install schematics. (The minimal `typecheck-configuration` config generator is PROMOTED into v0.0.4 -- see Current Milestone.)
- Standalone `angular-typecheck` CLI binary (non-Nx use).
- Storybook story (`*.stories.ts`) type-check support.
- Angular CLI surface for non-Nx `angular.json` workspaces: our Nx executor re-exported as an Angular **builder** via `convertNxExecutor`, and our generator as a **schematic** via `convertNxGenerator` (thin re-exports over the same core + Nx executor/generator -- NOT a hand-written `@angular-devkit/architect` builder; these `@nx/devkit` APIs are current, not deprecated).
- Machine-readable reporters: JSON, SARIF, and others.
- `NgtscProgram` migration -> incremental (`oldProgram` + affected files + `OptimizeFor.SingleFile`) and `--watch` mode.
- Jest support (ESM-mode only, if feasible -- spike-gated; older tooling proved it infeasible, re-test on current stack).
- Wider support: older Angular (20/21, non-TS-6) on their Nx versions; future Angular/Nx pairs.

## Context

Prior art: the project was prototyped twice -- a personal sandbox (`D:/projects/sandbox/nx19-8-angular18-2-...`, Nx 19.8 / Angular 18.2) and a proprietary work repo (no proprietary details retained here). Both converged on the same engine: programmatic `@angular/compiler-cli` `performCompilation` with a *custom all-diagnostics gatherer*. Both are version-bound to an older stack, so they are treated as reference only and every borrowed pattern is re-validated against Nx 23 / Angular 22 / TS 6 / Node 24.

Reusable artifacts identified from the prior art:
- Test helpers `createFsTree()` / `flushFsTreeChanges()` -- bespoke wrappers around the nx-internal `FsTree` + `flushChanges` (`nx/src/generators/tree`, resolving to `dist/src/generators/tree.js` and returning both on `nx@23.0.1`; no public re-export -- the public alternative is the in-memory `createTreeWithEmptyWorkspace` from `@nx/devkit/testing`). PLANNED as a v0.0.1 deliverable but NOT delivered to source (no generator consumer existed); authored for real in v0.0.4 with the `typecheck-configuration` generator, quarantined with eslint-disable + a drift tripwire on the internal import.
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
| Capture `createFsTree`/`flushFsTreeChanges` (nx-internal FsTree) | Drive generators against real disk in tests; no public alt | [DEFERRED] Planned v0.0.1, NOT delivered (no generator to test); scheduled for v0.0.4 with the `typecheck-configuration` generator |
| Promote `typecheck-configuration` config generator into v0.0.4 (vehicle for the FsTree generator-testing technique); `ng add`/`nx add` stay deferred | "Extended testing strategy" needs a real generator to exercise FsTree tests; the config generator is the smallest GEN slice | Scoped v0.0.4 |
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
*Last updated: 2026-06-30 -- milestone v0.0.4 (typecheck-configuration generator and extended testing strategy) opened and scoped. v0.0.3 (engine hardening) shipped + archived; its requirements are Validated. Corrected the FsTree documentation-drift (`createFsTree`/`flushFsTreeChanges` were planned in v0.0.1 but never delivered -- they land in v0.0.4 alongside the generator).*
