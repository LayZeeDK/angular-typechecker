# angular-typechecker

## What This Is

angular-typechecker is an Nx plugin that type-checks Angular projects -- applications, libraries (local/non-buildable, buildable, and publishable), and unit-test (spec) tsconfigs -- the way `ngc --noEmit -p <tsconfig>` would, but *completely* and *decoupled from building or running tests*. It runs the Angular compiler's full diagnostic set: TypeScript checks plus Angular template type-checking and extended diagnostics (NG8xxx). The first milestone (`v0.0.1`) ships a single Nx executor (`angular-typecheck`) targeting Nx 23 + Angular 22 (TypeScript 6). It exists to give a fast static-check feedback loop for AI coding agents and CI pipelines.

## Core Value

Deliver the *complete* Angular type-check (TypeScript + template type-check + extended diagnostics) for any project type *without* building the application or executing the tests -- faster, in isolation, and more completely than either the build's coupled check or a bare `ngc --noEmit`.

Why this matters (validated by Brandon Roberts' 2026-06-26 analysis): at scale the whole-program type-check is the dominant, *separable* cost of an Angular build (~15s standalone `ngc --noEmit` vs ~36s full esbuild build). Fast per-file compilers (AnalogJS `fastCompile`, the experimental Oxc compiler) and esbuild dev deliberately *skip* the type-check for speed and expect you to "run the type-check elsewhere"; the editor's Angular Language Service covers the live loop. angular-typechecker is that "elsewhere" for headless/CI/agent loops -- Nx-native, cacheable, and runnable per project.

Distinct from Nx's built-in `@nx/js` `typecheck` target (plain `tsc`/`tsgo`): Angular projects cannot use that fast path -- Angular lacks TypeScript project-references support -- and it would not surface Angular template type-check or extended (NG8xxx) diagnostics anyway. angular-typechecker is the Angular-aware whole-program no-emit type-check that fills that gap.

## Current Milestone: v0.0.3 Engine hardening

**Goal:** Harden the existing whole-program no-emit `runTypecheck` engine -- close real correctness/completeness holes, make diagnostic gathering resilient instead of all-or-nothing, and make Angular-version drift fail loudly -- all verified against stable Angular 22.0.4 and WITHOUT migrating off `performCompilation` to `NgtscProgram`.

**Target features (3 clusters):**
- **Correctness & completeness:** detect config-resolution infra crashes (re-throw as infra, do not count as type errors); surface global / location-less TS diagnostics (`getGlobalDiagnostics`); stop suppressing empty-`fileName` diagnostics.
- **Resilience:** per-file fault isolation so one `FatalDiagnosticError` does not abandon the rest (opens with a GATED spike deciding simple per-file loop vs. hybrid gather); `realpath()` try/catch in the boundary filter; `suppressOutputPathCheck`.
- **Drift-hardening:** a build-time `tsconfig.drift.json` assertion that the vendored shim stays in sync with the real `api.Program` getter set + NG error-code encoding; fix the fabricated `EmitFlags.None`; vendor-marker comments; KEEP the no-op `getNgStructuralDiagnostics()` call under the drift assertion (forward-compat).

Grounded in `.planning/research/prior-art/PRIOR-ART-SUMMARY.md` (verified against `@angular/build` + `@angular/compiler-cli` at stable 22.0.4). The engine is already complete and faithful to `@angular/build`; this milestone is hardening, not a rewrite. Deferred: `totalFilesCount` observability field; the v0.0.1 deferred feature families (INF/GEN/SUR/REP/SUP) remain out of scope.

## Current State

**Shipped v0.0.1 (2026-06-29)** -- published live to npm as `angular-typechecker@0.0.1` and `@0.0.2` (tokenless OIDC Trusted Publisher + SLSA v1 provenance).

The `angular-typecheck` Nx executor is real and runnable: a sub-50-line CommonJS adapter over a framework-agnostic core (`runTypecheck`) that loads ESM `@angular/compiler-cli` via `await import()` and gathers the complete diagnostic set unconditionally. Validated across all five project types against the installed tarball, made Nx-cacheable with a dependency-error-busts-cache correctness gate, and gated by a Node 22/24/26 x Linux/Windows/macOS CI matrix. `main` is PR-only with a Release-PR flow and a curated public changelog.

- **Codebase:** ~1,162 LOC TypeScript across 33 `.ts` files in `packages/angular-typechecker/` (incl. tests); plus e2e fixture projects and CI/release workflows.
- **Tech stack:** Nx 23.0.1, Angular 22.0.4, TypeScript 6.0.3, Vitest 4, Node 22/24/26. `@nx/devkit` pinned dependency; `@angular/compiler-cli` + `typescript` peers.
- **Known issues / debt:** documentation-drift and INFO-level only (see `.planning/milestones/v0.0.1-MILESTONE-AUDIT.md`); `.npmrc legacy-peer-deps=true` is a dev-repo concern that does not reach consumers.
- **v0.0.3 progress (in flight):** Phase 8 (Correctness & Completeness, COR-01..04) COMPLETE 2026-06-29 -- config-resolution `UNKNOWN_ERROR_CODE` 500 re-thrown as infrastructure before the zero-rootNames guard, global/location-less TS diagnostics gathered via `getGlobalDiagnostics()`, present-but-empty-`fileName` diagnostics kept, and a pure core `toExitCode` 0/1/2 policy added (literal OS exit code deferred to the future standalone CLI; the Nx executor surfaces infra distinctly within its `{ success }` contract). Full suite 123/123 green. Phases 9 (Resilience) + 10 (Drift-hardening) remain.

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

### Active (v0.0.3 Engine hardening -- in progress)

Scoped requirements with REQ-IDs live in `.planning/REQUIREMENTS.md`. Summary by cluster:
- **Correctness & completeness:** config-resolution-crash detection, global TS diagnostics, empty-`fileName` handling.
- **Resilience:** per-file fault isolation (gated spike), `realpath()` robustness, `suppressOutputPathCheck`.
- **Drift-hardening:** build-time shim + error-code drift assertion, `EmitFlags` fix, vendor markers, retained-getter-under-assertion.

This milestone improves the EXISTING engine only. The deferred families carried forward from v0.0.1 (inferred targets INF, install/generators GEN, other surfaces SUR, reporters/performance REP, broader support SUP) remain Out of Scope (below) and are the natural candidates for a later milestone.

### Out of Scope (deferred to later milestones, not abandoned)

- `createNodesV2` inferred `angular-typecheck` targets (+ optional `typecheck` target override) -- next milestone.
- `nx add` + `ng add` schematics; a minimal config generator.
- Standalone `angular-typecheck` CLI binary (non-Nx use).
- Storybook story (`*.stories.ts`) type-check support.
- Angular CLI surface for non-Nx `angular.json` workspaces: our Nx executor re-exported as an Angular **builder** via `convertNxExecutor`, and our generator as a **schematic** via `convertNxGenerator` (thin re-exports over the same core + Nx executor/generator -- NOT a hand-written `@angular-devkit/architect` builder; these `@nx/devkit` APIs are current, not deprecated).
- Machine-readable reporters: JSON, SARIF, and others.
- `NgtscProgram` migration -> incremental (`oldProgram` + affected files + `OptimizeFor.SingleFile`) and `--watch` mode.
- Jest support (ESM-mode only, if feasible -- spike-gated; older tooling proved it infeasible, re-test on current stack).
- Wider support: older Angular (20/21, non-TS-6) on their Nx versions; future Angular/Nx pairs.

## Context

Prior art: the project was prototyped twice -- a personal sandbox (`D:/projects/sandbox/nx19-8-angular18-2-...`, Nx 19.8 / Angular 18.2) and a proprietary work repo (no proprietary details retained here). Both converged on the same engine: programmatic `@angular/compiler-cli` `performCompilation` with a *custom all-diagnostics gatherer*. Both are version-bound to an older stack, so they are treated as reference only and every borrowed pattern is re-validated against Nx 23 / Angular 22 / TS 6 / Node 24.

Reusable artifacts carried forward:
- Test helpers `createFsTree()` / `flushFsTreeChanges()` wrapping the nx-internal `FsTree` + `flushChanges` from `nx/src/generators/tree` (no public alternative exists; confirmed still exported on Nx 23.0.1; quarantined in dedicated files with eslint-disable).
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
| Capture `createFsTree`/`flushFsTreeChanges` (nx-internal FsTree) | Drive generators against real disk in tests; no public alt | [OK] Validated v0.0.1 |
| Release via `nx release`; manual target wiring in v0.0.1 | Dogfoods Nx; generator/ng-add/nx-add deferred | [OK] Validated v0.0.1 |
| Publish hardening: npm Trusted Publishers (OIDC) + provenance + hardened CI + SECURITY.md + tarball audit (publint/attw) | Supply-chain (s1ngularity); registry listing | [OK] Validated v0.0.1 |
| Diagnostics: absolute-realpath filter; workspace-root-relative CI paths; agent-ready output | Correct project-boundary filter + GitHub annotations; AI/CI consumers | [OK] Validated v0.0.1 |
| Angular CLI surface (deferred) via `convertNxExecutor`/`convertNxGenerator` re-exports | Current @nx/devkit APIs; thin adapters over same core | [OK] Validated v0.0.1 |
| GSD: YOLO, Standard granularity, parallel, quality/Opus, Vertical MVP | Correctness-critical tooling with a gating spike | [OK] Validated v0.0.1 |

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
*Last updated: 2026-06-29 -- v0.0.3 Phase 8 (Correctness & Completeness, COR-01..04) complete and verified (123/123 green); SC4/COR-04 reframed (exit-code policy in core, literal OS code via the deferred standalone CLI). Phases 9-10 remain.*
