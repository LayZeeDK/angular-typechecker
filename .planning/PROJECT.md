# angular-typechecker

## What This Is

angular-typechecker is an Nx plugin that type-checks Angular projects -- applications, libraries (local/non-buildable, buildable, and publishable), and unit-test (spec) tsconfigs -- the way `ngc --noEmit -p <tsconfig>` would, but *completely* and *decoupled from building or running tests*. It runs the Angular compiler's full diagnostic set: TypeScript checks plus Angular template type-checking and extended diagnostics (NG8xxx). The first milestone (`v0.0.1`) ships a single Nx executor (`angular-typecheck`) targeting Nx 23 + Angular 22 (TypeScript 6). It exists to give a fast static-check feedback loop for AI coding agents and CI pipelines.

## Core Value

Deliver the *complete* Angular type-check (TypeScript + template type-check + extended diagnostics) for any project type *without* building the application or executing the tests -- faster, in isolation, and more completely than either the build's coupled check or a bare `ngc --noEmit`.

Why this matters (validated by Brandon Roberts' 2026-06-26 analysis): at scale the whole-program type-check is the dominant, *separable* cost of an Angular build (~15s standalone `ngc --noEmit` vs ~36s full esbuild build). Fast per-file compilers (AnalogJS `fastCompile`, the experimental Oxc compiler) and esbuild dev deliberately *skip* the type-check for speed and expect you to "run the type-check elsewhere"; the editor's Angular Language Service covers the live loop. angular-typechecker is that "elsewhere" for headless/CI/agent loops -- Nx-native, cacheable, and runnable per project.

Distinct from Nx's built-in `@nx/js` `typecheck` target (plain `tsc`/`tsgo`): Angular projects cannot use that fast path -- Angular lacks TypeScript project-references support -- and it would not surface Angular template type-check or extended (NG8xxx) diagnostics anyway. angular-typechecker is the Angular-aware whole-program no-emit type-check that fills that gap.

## Requirements

### Validated

(None yet -- ship to validate)

### Active (v0.0.1 -- hypotheses until shipped and validated)

- [ ] `angular-typecheck` Nx executor: programmatic `@angular/compiler-cli` whole-program type-check, no-emit.
- [ ] Complete diagnostics: a custom gatherer runs all phases UNCONDITIONALLY (models the modern `@angular/build` builder, not `ngc`'s phase-fail-fast short-circuit) -- TS option/syntactic/semantic + Angular template type-check + extended (NG8xxx).
- [ ] Required `tsConfig` option (single tsconfig per target, overridable in target config). Spec/unit-test checking via a target pointed at `tsconfig.spec.json`.
- [ ] Modes: full / report-all by default (matches `tsc --noEmit`); opt-in fail-fast (stop at first error).
- [ ] Dependency boundary: exclude out-of-project + `node_modules` diagnostics by default; opt-in `includeDeps`.
- [ ] `--max-warnings=<n>` (0 = fail on any warning; ESLint-style). Errors fail; project-configured diagnostic categories respected.
- [ ] Default human output = `@angular/compiler-cli` `formatDiagnostics` (superset of `tsc`; renders NG codes + template codeframes). Filter on absolute realpath-normalized `fileName` (host `getCanonicalFileName` + `realpath`); emit workspace-root-relative paths for GitHub Actions annotations. Agent-ready: deterministic, idempotent, clear non-zero exit on diagnostics.
- [ ] Nx-cacheable target: `cache: true`, `outputs: []`, `@nx/js`-style per-tsconfig inputs (include/exclude globs + `extends` chain + sibling package.json) + `^production`/`^{projectRoot}` dependency-source filesets (non-buildable deps) + `dependentTasksOutputFiles` (buildable deps) + `externalDependencies: ['typescript', '@angular/compiler-cli']`; verify via `nx show target inputs --check` / Task Sandboxing.
- [ ] Validated across all five project types: application, local (non-buildable) library, buildable library, publishable library, spec tsconfig.
- [ ] Test pyramid (Vitest via `@nx/vitest:test`): unit (mock `@angular/compiler-cli`) + integration (real compiler against fixtures, asserting exact diagnostic codes/counts across the v13->v22 catalog; incl. a dependency-error-busts-cache test) + e2e (one smoke early; full real-workspace matrix in late phase(s)).
- [ ] Module format: CommonJS executor that loads ESM `@angular/compiler-cli` via `await import()`, shipped as pre-compiled `.js` built with `module: node16`/`nodenext` (so `import()` is not downleveled to `require()`; build-time assert the emitted `.js` still contains `import(`).
- [ ] Published to npm (MIT) via `nx release`. Manual `project.json` target wiring documented (no config generator in v0.0.1).
- [ ] CI: GitHub Actions, Node 22/24/26 x Linux/Windows/macOS (free standard public-repo runners).

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
| Package name `angular-typechecker` (unscoped, MIT) | Available on npm; cleanest `nx add`/`ng add` UX | Pending |
| v0.0.1 = Nx executor only; everything else deferred | Smallest publishable, valuable slice (Vertical MVP) | Pending |
| Support Nx 23 + Angular 22 + TS 6 only | Matrix-confirmed only viable pairing for TS 6 | Pending |
| Engine: `performCompilation` + custom all-getter gatherer (unconditional) | Avoids `ngc` short-circuit; models `@angular/build`; stable API | Pending |
| Module: CJS executor + `await import()`, compiled `.js` with `module: node16`/`nodenext` | Nx loader require()-based; ESM compiler-cli; avoid import()->require() downlevel | Pending |
| `@nx/devkit` pinned dependency (no `nx`); compiler-cli + typescript peers | Nx publish-plugin recipe + registry listing; consumer versions | Pending |
| Runner: Vitest via `@nx/vitest:test` (Jest deferred) | compiler-cli ESM-only; `@nx/vitest` is the Nx 23 package | Pending |
| Default report-all; opt-in fail-fast (stop at first error) | Matches `tsc --noEmit` default | Pending |
| Exclude out-of-project diagnostics by default; opt-in `includeDeps` | Project-in-isolation feedback | Pending |
| `--max-warnings=<n>` (ESLint-style) | Only count-based prior art; tsc/ngc have none | Pending |
| Default output = `formatDiagnostics`; JSON/SARIF deferred | Superset of tsc; lossless; machine formats later | Pending |
| Cacheable target (`cache:true`, `outputs:[]`, @nx/js-style inputs) | Fast feedback; whole-program -> per-target cache | Pending |
| Tests assert exact diagnostic codes across v13->v22 catalog | Improves on priors' pass/fail-only assertions | Pending |
| e2e blends both prior approaches under Vitest (fixtures fast tier + tarball CI gate) | Fast agent loop + publish/install fidelity | Pending |
| Capture `createFsTree`/`flushFsTreeChanges` (nx-internal FsTree) | Drive generators against real disk in tests; no public alt | Pending |
| Release via `nx release`; manual target wiring in v0.0.1 | Dogfoods Nx; generator/ng-add/nx-add deferred | Pending |
| Publish hardening: npm Trusted Publishers (OIDC) + provenance + hardened CI + SECURITY.md + tarball audit (publint/attw) | Supply-chain (s1ngularity); registry listing | Pending |
| Diagnostics: absolute-realpath filter; workspace-root-relative CI paths; agent-ready output | Correct project-boundary filter + GitHub annotations; AI/CI consumers | Pending |
| Angular CLI surface (deferred) via `convertNxExecutor`/`convertNxGenerator` re-exports | Current @nx/devkit APIs; thin adapters over same core | Pending |
| GSD: YOLO, Standard granularity, parallel, quality/Opus, Vertical MVP | Correctness-critical tooling with a gating spike | Pending |

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
*Last updated: 2026-06-27 after initialization and research (corrections applied; see .planning/research/SUMMARY.md and FOLLOWUP-FINDINGS.md)*
