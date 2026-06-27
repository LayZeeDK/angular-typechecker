# Requirements: angular-typechecker

**Defined:** 2026-06-27
**Core Value:** Deliver the complete Angular type-check (TypeScript + template type-check + extended diagnostics) for any project type without building the app or running the tests -- faster, in isolation, and more completely than the build's coupled check or a bare `ngc --noEmit`.

> Milestone naming: the first milestone is **v0.0.1** (not "v1"). The section below is the current-milestone scope; the roadmapper maps each requirement to exactly one phase.

## v0.0.1 Requirements

### Workspace & Plugin Scaffold (WS)

- [ ] **WS-01**: The repository is an Nx 23 integrated Angular monorepo (created via `create-nx-workspace`) hosting the `angular-typechecker` plugin package.
- [ ] **WS-02**: The plugin builds via `@nx/js:tsc` to CommonJS `.js` + `.d.ts`, compiled with `module: node16`/`nodenext` (a build-time check asserts the emitted executor `.js` still contains `import(`).
- [ ] **WS-03**: The plugin's own unit/integration tests run via `@nx/vitest:test` (Vitest).
- [ ] **WS-04**: ESLint + Prettier are configured, including `@nx/dependency-checks` and module-boundary enforcement of the framework-agnostic `core/` vs adapters.

### Type-Check Engine (ENG)

- [ ] **ENG-01**: A framework-agnostic core (`runTypecheck(options)`) runs `@angular/compiler-cli` whole-program, no-emit, against a given tsconfig.
- [ ] **ENG-02**: A custom gatherer collects ALL diagnostics unconditionally -- TS option/syntactic/semantic + Angular template type-check + extended (NG8xxx) -- modeled on `@angular/build`, never short-circuiting like `ngc`'s default gatherer.
- [ ] **ENG-03**: The core loads ESM `@angular/compiler-cli` via `await import()` and runs under the supported Node range.
- [ ] **ENG-04**: The core returns a structured result (errors/warnings as `ts.Diagnostic[]` + counts) with `strictTemplates` honored; extended-diagnostic categories respected.

### Executor (EXE)

- [ ] **EXE-01**: An `angular-typecheck` Nx executor wraps the core and can be set as any Angular project's target.
- [ ] **EXE-02**: Required `tsConfig` option (single tsconfig per target), overridable in target configuration; spec/unit-test checking via a target pointed at `tsconfig.spec.json`.
- [ ] **EXE-03**: Default full / report-all mode (matches `tsc --noEmit`); opt-in fail-fast (return on first error).
- [ ] **EXE-04**: Excludes out-of-project + `node_modules` diagnostics by default; opt-in `includeDeps`.
- [ ] **EXE-05**: `--max-warnings=<n>` (0 = fail on any warning); errors always fail; project-configured diagnostic categories respected.
- [ ] **EXE-06**: The executor target is Nx-cacheable (`cache: true`, `outputs: []`, correct per-tsconfig + dependency-source inputs + `externalDependencies`).
- [ ] **EXE-07**: Shipped as a CommonJS executor that loads ESM compiler-cli via dynamic `import()` with no `import()`->`require()` downlevel.

### Diagnostics & Output (OUT)

- [ ] **OUT-01**: Default human output via `@angular/compiler-cli` `formatDiagnostics` (NG codes + template codeframes; superset of `tsc`).
- [ ] **OUT-02**: Diagnostics filtered on absolute realpath-normalized `fileName` (pnpm-symlink / case-insensitive-FS safe); CI annotation paths emitted workspace-root-relative.
- [ ] **OUT-03**: Clear non-zero exit on diagnostics; deterministic, idempotent (agent-ready) output.

### Testing (TEST)

- [ ] **TEST-01**: Unit tests (Vitest) mock `@angular/compiler-cli` and cover gatherer, project-boundary filtering, tsconfig resolution, modes, and `--max-warnings` logic.
- [ ] **TEST-02**: Integration tests run the real compiler against fixtures and assert exact diagnostic codes/counts across the v13->v22 catalog (organized by Angular introduction version), all on Angular 22.
- [ ] **TEST-03**: The executor is validated across all five project types: application, local (non-buildable) library, buildable library, publishable library, and spec tsconfig.
- [ ] **TEST-04**: A dependency-error-busts-cache correctness test verifies a downstream type change invalidates the consumer's cache.
- [ ] **TEST-05**: One real-workspace e2e smoke (tarball/Verdaccio install) lands early; the full real-workspace e2e matrix lands in late phase(s).

### Packaging & Release (PKG)

- [ ] **PKG-01**: `package.json` declares `@nx/devkit` as a pinned dependency (no `nx`), `@angular/compiler-cli` + `typescript` as peers (Angular `^22` / TS `>=6.0 <6.1`), with `files`/`exports`/`executors` fields and `nx`/`nx-plugin` keywords for registry listing.
- [ ] **PKG-02**: `executors.json`/`schema.json` (v2, `cli: "nx"`, `outputCapture`) are copied into `dist` and present in the `npm pack` tarball (verified by `publint` + `attw --pack`).
- [ ] **PKG-03**: Published to npm (MIT, 0.x semver) via `nx release` using npm Trusted Publishers (OIDC) + provenance.
- [ ] **PKG-04**: `SECURITY.md` present and the release CI is hardened (read-only default permissions, no untrusted `pull_request_target`, SHA-pinned actions, manual-approval publish environment).

### Compatibility (CMP)

- [ ] **CMP-01**: Supports Nx 23 + Angular 22 + TypeScript `>=6.0 <6.1` (the only TS-6 pairing).
- [ ] **CMP-02**: `engines.node = ^22.22.3 || ^24.15.0 || ^26.0.0` (Angular-Nx intersection).

### Continuous Integration (CI)

- [ ] **CI-01**: GitHub Actions runs unit + integration on a Node 22/24/26 x Linux/Windows/macOS matrix (free standard public-repo runners); the heavy e2e gate runs Linux-only.

## v2 Requirements (deferred to later milestones)

### Inference (INF)
- **INF-01**: `createNodes` (v2) plugin infers `angular-typecheck` targets on all Angular app/lib/buildable/publishable projects.
- **INF-02**: Optional `typecheck` target override on Angular projects (ordered after `@nx/js/typescript`) so `nx run-many --targets=typecheck` includes Angular checks.

### Install & Generators (GEN)
- **GEN-01**: `nx add angular-typechecker` (Nx CLI) installation/init.
- **GEN-02**: `ng add angular-typechecker` (Angular CLI) schematic via `convertNxGenerator`.
- **GEN-03**: A configuration generator adds the typecheck target to a project.

### Other surfaces (SUR)
- **SUR-01**: Standalone `angular-typecheck` CLI binary (non-Nx use).
- **SUR-02**: Angular CLI **builder** (`angular.json`) via `convertNxExecutor` re-export.
- **SUR-03**: Storybook story (`*.stories.ts`) type-check support.

### Reporters & performance (REP)
- **REP-01**: Machine-readable reporters: JSON, then SARIF / GitHub annotations.
- **REP-02**: `NgtscProgram` migration -> incremental (`oldProgram` + affected files + `OptimizeFor.SingleFile`) and `--watch` mode.

### Broader support (SUP)
- **SUP-01**: Jest support (ESM-mode only, spike-gated).
- **SUP-02**: Wider Nx (22/21) and older/future Angular support; AI-agent **skill** distribution (`nx configure-ai-agents`).

## Out of Scope

| Feature | Reason |
|---------|--------|
| Emit / build output | This is a no-emit type-checker; building is a separate concern |
| Auto-fix of diagnostics | Type errors are not mechanically fixable; out of scope |
| In-executor `--watch` (v0.0.1) | Needs `NgtscProgram` incremental; deferred. Editor Language Service + Nx cache cover the loop |
| Per-rule severity CLI flags | Angular owns severities via tsconfig `extendedDiagnostics` -- avoid two sources of truth |
| Type-coverage percentage | Different tool category; not the goal |
| Multiple tsconfigs per target | Hurts cache granularity/reporting; use one target per tsconfig (or TS project references) |
| MCP tool for agents | Nx's direction is CLI + a skill; agent layer is a skill, not MCP |
| Reporter zoo | Ship a focused set (pretty now; JSON/SARIF later) -- ESLint's documented regret |

## Traceability

Populated during roadmap creation (each requirement maps to exactly one phase).

| Requirement | Phase | Status |
|-------------|-------|--------|
| (to be filled by roadmapper) | | Pending |

**Coverage:**
- v0.0.1 requirements: 26 total
- Mapped to phases: (pending)
- Unmapped: (pending)

---
*Requirements defined: 2026-06-27*
*Last updated: 2026-06-27 after initial definition*
