# Roadmap: angular-typechecker

## Overview

v0.0.1 ships a single Nx executor (`angular-typecheck`) that runs the complete Angular compiler diagnostic set (TypeScript + template type-check + extended NG8xxx) with no emit, decoupled from build and test. The journey is engine-before-Nx and riskiest-first: a gated workspace + engine spike de-risks the custom unconditional gatherer and the CJS-loads-ESM `import()` design against a real Angular 22 workspace; a fully testable framework-agnostic core engine exists before any Nx code; filtering/modes/output and the human reporter complete the core contract; a sub-50-line Nx executor adapter plus a correctness-gated cacheable target wraps it; packaging/publish hardening with one e2e smoke proves the package installs and runs end-to-end (Vertical MVP); and the slow, gating full real-workspace e2e matrix plus cross-OS CI land last. Every borrowed prior-art pattern is re-validated against Nx 23 / Angular 22 / TS 6 / Node 24.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Workspace Bootstrap + Engine Spike (GATED)** - Stand up the Nx 23 / Angular 22 / TS 6 monorepo in-place and prove the riskiest unknowns (complete unconditional gatherer + CJS-loads-ESM `import()` survives `module: node16`) on a real workspace before committing to the engine.
- [ ] **Phase 2: Core Type-Check Engine + Gatherer** - A framework-agnostic `runTypecheck` runs `@angular/compiler-cli` whole-program no-emit and gathers ALL diagnostics unconditionally, asserted against the v13->v22 diagnostic catalog.
- [ ] **Phase 3: Filtering, Modes, Output + Quality Gates** - Project-boundary filtering, report-all/fail-fast modes, `--max-warnings`, and `formatDiagnostics` human output complete the core contract; ESLint/Prettier + module-boundary enforcement lock the core-vs-adapter split.
- [ ] **Phase 4: Nx Executor Adapter + Cacheable Target** - A thin `angular-typecheck` executor wraps the core and runs as any Angular project's target, with a correct cacheable target proven by a dependency-error-busts-cache test.
- [ ] **Phase 5: Packaging, Publish Hardening + e2e Smoke (MVP)** - The plugin publishes to npm via `nx release` (OIDC + provenance), passes tarball audits, and installs-and-runs end-to-end against one smoke workspace.
- [ ] **Phase 6: Full e2e Matrix + CI** - The executor is validated across all five project types and a cross-OS / multi-Node GitHub Actions matrix gates every change.

## Phase Details

### Phase 1: Workspace Bootstrap + Engine Spike (GATED)
**Goal**: A working Nx 23 integrated Angular monorepo hosting the plugin package, with a thrown-away-or-promoted spike that PROVES the highest-risk unknowns against a real Angular 22 workspace before the engine is built for real.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: WS-01, WS-02, WS-03, ENG-03, CMP-01, CMP-02
**Success Criteria** (what must be TRUE):
  1. The repo is an Nx 23 integrated Angular monorepo created via `create-nx-workspace` despite the pre-existing `.git` + `.planning/` (bootstrap handles in-place creation -- no clobber of tracked files), with the `angular-typechecker` package present and pinned to Nx 23 / Angular 22 / TypeScript `>=6.0 <6.1` and `engines.node = ^22.22.3 || ^24.15.0 || ^26.0.0`.
  2. The plugin builds via `@nx/js:tsc` to CommonJS `.js` + `.d.ts` and a build-time assertion confirms the emitted executor `.js` STILL contains `import(` (proving `module: node16`/`nodenext` did not downlevel `await import()` to `require()`).
  3. The spike confirms, on a real Angular 22 workspace, that the custom gatherer surfaces template + extended (NG8xxx) diagnostics UNCONDITIONALLY even when a co-located TS error exists (no `ngc`-style phase short-circuit), across the project-type matrix, with out-of-project diagnostics filtered, and that ESM `@angular/compiler-cli` loads via `await import()` under the supported Node range with a rough cold-run timing recorded.
  4. The Vitest harness (`@nx/vitest:test`) runs at least one green test, establishing the unit/integration test plumbing the engine phases depend on.
**Plans**: 4 plans
- [x] 01-01-PLAN.md -- Bootstrap the Nx 23 integrated Angular monorepo in-place over the existing .git/ (Mechanism B)
- [x] 01-02-PLAN.md -- Scaffold the plugin + spike app, patch tsconfig module to nodenext (BLOCKING), author the Phase-1 plugin package.json
- [x] 01-03-PLAN.md -- Build the tracer-bullet core + executor stub + error fixture, then build the plugin (executor.js retains import()
- [ ] 01-04-PLAN.md -- Author the GATE A + GATE B specs, run the suite, record the GO/NO-GO decision
**UI hint**: no

Note: This is the GATED spike PROJECT.md flags. The engine implementation (Phase 2) does not begin until the spike proves criteria 2 and 3 -- if the `import(` survival or unconditional-gatherer assumptions fail, the engine approach is revisited before further investment.

### Phase 2: Core Type-Check Engine + Gatherer
**Goal**: A framework-agnostic core (`runTypecheck(options)`) runs the complete Angular compiler diagnostic set whole-program and no-emit against a given tsconfig, returning structured results -- with zero `@nx/devkit`/CLI imports so every deferred surface is cheap later.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: ENG-01, ENG-02, ENG-04, EXE-02, TEST-02
**Success Criteria** (what must be TRUE):
  1. `runTypecheck(options)` loads ESM `@angular/compiler-cli` lazily (memoized), resolves a single tsconfig (full `extends` chain + Angular no-emit overrides), runs `@angular/compiler-cli` whole-program, and returns a structured result (errors/warnings as `ts.Diagnostic[]` + counts) with `strictTemplates` honored and extended-diagnostic categories respected.
  2. The custom gatherer collects ALL diagnostics unconditionally -- TS option/syntactic/semantic + Angular template type-check + extended (NG8xxx) -- modeled on `@angular/build`, never short-circuiting by phase the way `ngc`'s default gatherer does.
  3. A required `tsConfig` resolves correctly for each project's tsconfig including a spec/unit-test tsconfig (`tsconfig.spec.json`), and a `references`-only / solution-style tsconfig does NOT silently report "0 files / 0 errors".
  4. Integration tests run the REAL compiler against committed fixtures and assert exact diagnostic codes/counts across the v13->v22 catalog (organized by the Angular major that introduced each check), all evaluated on Angular 22 plus any v22 additions.
**Plans**: TBD
**UI hint**: no

### Phase 3: Filtering, Modes, Output + Quality Gates
**Goal**: The core contract is complete -- project-boundary filtering, report-all/fail-fast modes, `--max-warnings`, and `formatDiagnostics` human output all work on the structured result -- and lint/format quality gates enforce the framework-agnostic core-vs-adapter boundary.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: EXE-03, EXE-04, EXE-05, OUT-01, OUT-02, OUT-03, TEST-01, WS-04
**Success Criteria** (what must be TRUE):
  1. By default the core reports ALL diagnostics (matches `tsc --noEmit`); opt-in fail-fast returns on the first error; errors always fail and `--max-warnings=<n>` (0 = fail on any warning) gates warnings while project-configured diagnostic categories are respected.
  2. Out-of-project + `node_modules` diagnostics are excluded by default (opt-in `includeDeps`), filtered on absolute realpath-normalized `fileName` via the host `getCanonicalFileName` + `realpath` (pnpm-symlink and case-insensitive-FS safe) -- not a naive string-prefix comparison.
  3. Default human output is `@angular/compiler-cli` `formatDiagnostics` (NG codes + template codeframes; superset of `tsc`), output is deterministic and idempotent (agent-ready) with a clear non-zero exit on diagnostics, and CI annotation paths are emitted workspace-root-relative (normalized to `/`).
  4. Unit tests (Vitest, mocking `@angular/compiler-cli`) cover the gatherer, project-boundary filtering, tsconfig resolution, modes, and `--max-warnings` logic.
  5. ESLint + Prettier are configured (Prettier `singleQuote: true`) including `@nx/dependency-checks` and module-boundary enforcement that forbids `core/` from importing `@nx/devkit`/CLI/architect, and lint passes clean.
**Plans**: TBD
**UI hint**: no

### Phase 4: Nx Executor Adapter + Cacheable Target
**Goal**: A thin Nx executor wraps the core as the first user-runnable surface and runs as any Angular project's target, shipped as a CommonJS executor that loads ESM compiler-cli via `import()` with no downlevel, and made Nx-cacheable with inputs proven correct by a dependency-error-busts-cache test.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: EXE-01, EXE-06, EXE-07, TEST-04
**Success Criteria** (what must be TRUE):
  1. An `angular-typecheck` Nx executor (sub-50-line adapter: `ExecutorContext` -> `CoreOptions` -> `runTypecheck` -> `{ success }`) can be set as any Angular project's target and `nx run <project>:angular-typecheck` produces the same diagnostics as the core, with the executor shipped as CommonJS that loads ESM compiler-cli via dynamic `import()` (verified no `import()`->`require()` downlevel at runtime).
  2. The executor target is Nx-cacheable (`cache: true`, `outputs: []`) with correct per-tsconfig inputs (include/exclude globs + full `extends` chain + sibling `package.json`), `^production`/`^{projectRoot}` dependency-source filesets for non-buildable deps, `dependentTasksOutputFiles` for buildable deps, and `externalDependencies: ['typescript','@angular/compiler-cli']`; verified via `nx show target inputs --check`.
  3. A dedicated dependency-error-busts-cache correctness test proves a green run, then a type change injected into a transitive source dependency, does NOT cache-hit on re-run and reports the new error (a type-checker that lies is worse than none).
**Plans**: TBD
**UI hint**: no

### Phase 5: Packaging, Publish Hardening + e2e Smoke (MVP)
**Goal**: The plugin is publishable to npm and installs-and-runs end-to-end -- correct dependency model, `executors.json`/`schema.json` present in the tarball, supply-chain-hardened release via `nx release`, all proven by one early e2e smoke (Vertical MVP).
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: PKG-01, PKG-02, PKG-03, PKG-04, TEST-05
**Success Criteria** (what must be TRUE):
  1. `package.json` declares `@nx/devkit` as a pinned dependency (and does NOT declare `nx`), `@angular/compiler-cli` + `typescript` as peers (Angular `^22` / TS `>=6.0 <6.1`), with `files`/`exports`/`executors` fields and `nx`/`nx-plugin` keywords for registry listing.
  2. `executors.json` + each `schema.json` (v2, `cli: "nx"`, `outputCapture`) and the compiled executor `.js` are copied into `dist` and present in the `npm pack` tarball, verified by `publint` + `attw --pack` against the tarball (not the source tree).
  3. The package publishes to npm (MIT, 0.x semver) via `nx release` using npm Trusted Publishers (OIDC) + provenance, with `SECURITY.md` present and the release CI hardened (read-only default permissions, no untrusted `pull_request_target`, SHA-pinned actions, manual-approval publish environment).
  4. One real-workspace e2e smoke installs the packed tarball (Verdaccio or `file:`) into a workspace and runs `nx run <project>:angular-typecheck` successfully, proving the executor path resolves from the installed package.
**Plans**: TBD
**UI hint**: no

### Phase 6: Full e2e Matrix + CI
**Goal**: The executor is validated across all five project types on a real installed package, and a cross-OS / multi-Node GitHub Actions matrix gates every change -- the slow, gating backstop for packaging, peer-range, path-normalization, and cross-OS bugs.
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: TEST-03, CI-01
**Success Criteria** (what must be TRUE):
  1. The executor is validated end-to-end across all five project types -- application, local (non-buildable) library, buildable library, publishable library, and spec tsconfig -- against the installed tarball, including a pnpm fixture and a mixed-case path assertion (the bug invisible under npm/Linux).
  2. GitHub Actions runs unit + integration on a Node 22/24/26 x Linux/Windows/macOS matrix (free standard public-repo runners), with the heavy e2e/tarball-install gate running Linux-only.
  3. The full matrix is green and is the required gate before merge/publish (no cross-OS path-normalization, pnpm-symlink, or ERESOLVE/EBADENGINE regressions slip through).
**Plans**: TBD
**UI hint**: no

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Workspace Bootstrap + Engine Spike (GATED) | 3/4 | In Progress|  |
| 2. Core Type-Check Engine + Gatherer | 0/TBD | Not started | - |
| 3. Filtering, Modes, Output + Quality Gates | 0/TBD | Not started | - |
| 4. Nx Executor Adapter + Cacheable Target | 0/TBD | Not started | - |
| 5. Packaging, Publish Hardening + e2e Smoke (MVP) | 0/TBD | Not started | - |
| 6. Full e2e Matrix + CI | 0/TBD | Not started | - |
