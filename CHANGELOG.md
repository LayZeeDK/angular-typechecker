# Changelog

All notable changes to **angular-typechecker** are documented in this file.

## 0.0.3 (2026-06-30)

Engine-hardening release. The `angular-typecheck` engine now reports a more
_complete_ diagnostic set and survives partial failures without aborting the
whole run. There are no breaking changes and no change to how you wire or invoke
the target.

### Completeness

- **Whole-program TypeScript diagnostics** -- global, file-less program errors
  (for example `TS2318`) are now gathered via `getGlobalDiagnostics`, closing a
  class of errors the engine could previously miss.
- **Config-resolution failures surface as infrastructure errors** -- a broken or
  unreadable tsconfig is re-thrown as an infrastructure failure instead of being
  silently swallowed.
- **File-less diagnostics retained** -- diagnostics with no associated source
  file (empty `fileName`) are kept by the in-project boundary filter rather than
  dropped.

### Resilience

- **Per-file fault isolation** -- Angular diagnostic gathering is fault-isolated
  per file, so a single file that aborts template type-checking no longer takes
  down the entire run. When a type-check block (TCB) fatal suppresses template
  diagnostics, a loud notice is surfaced rather than failing silently.
- **Robust path filtering** -- the realpath-normalized boundary filter now
  tolerates a throwing or unresolvable `realpath`, keeping the affected
  diagnostics instead of crashing or dropping them.
- **No nuisance output-path errors** -- `suppressOutputPathCheck` is passed to
  `readConfiguration` so no-emit runs do not emit spurious output-path
  complaints.
- **Structurally-absent compiler `Program` guarded** -- the engine guards
  against a compiler invocation that returns no `Program`.

### Hardening

- **Compiler-internal drift tripwires** -- build-time assertions detect drift in
  the `@angular/compiler-cli` / TypeScript internals the engine relies on, with
  the drift check keyed on the installed `@angular/compiler-cli` and `typescript`
  versions, so an incompatible upgrade fails loudly at build time instead of
  misbehaving silently at runtime.
- **Expanded CI confidence** -- a cross-OS end-to-end matrix installs and runs
  the published tarball across project types, and a code-quality gate runs in CI.

### Compatibility

- Nx 23, Angular 22 (`@angular/compiler-cli` `^22.0.0`), TypeScript `>=6.0.0 <6.1.0`
- Node `^22.22.3 || ^24.15.0 || ^26.0.0`

## 0.0.2 (2026-06-28)

Maintenance release. No functional changes to the executor.

This release verifies the tokenless OIDC steady-state publish path: 0.0.1 was first-published with a one-time token (a first npm publish cannot use OIDC), and 0.0.2 is the first release to authenticate through the registered npm Trusted Publisher with no token, attaching an SLSA provenance attestation.

### Compatibility

- Nx 23, Angular 22 (`@angular/compiler-cli` `^22.0.0`), TypeScript `>=6.0.0 <6.1.0`
- Node `^22.22.3 || ^24.15.0 || ^26.0.0`

## 0.0.1 (2026-06-28)

Initial release.

angular-typechecker is an Nx plugin that runs the _complete_ Angular compiler type-check -- TypeScript checks plus Angular template type-checking and extended (NG8xxx) diagnostics -- with no emit, decoupled from building the application or running its tests. It gives a fast, isolated static-check feedback loop for AI coding agents and CI pipelines.

### Features

- **`angular-typecheck` Nx executor** -- runs `@angular/compiler-cli` whole-program and no-emit against a project's tsconfig, reporting the full diagnostic set in a single pass (modeled on `@angular/build`, never short-circuiting by phase the way `ngc` does).
- **Complete diagnostics** -- TypeScript option/syntactic/semantic + Angular template type-check + extended NG8xxx, gathered unconditionally.
- **Modes & filtering** -- report-all by default (matches `tsc --noEmit`) or opt-in fail-fast; `--max-warnings=<n>` (ESLint-style); out-of-project and `node_modules` diagnostics excluded by default (opt-in `includeDeps`), filtered on realpath-normalized paths (pnpm- and case-insensitive-filesystem safe).
- **Agent/CI-ready output** -- `@angular/compiler-cli` `formatDiagnostics` (NG codes + template codeframes), deterministic and idempotent, with a clear non-zero exit on diagnostics.
- **Nx-cacheable target** -- `cache: true`, `outputs: []`, with correct per-tsconfig and dependency-source inputs, proven by a dependency-error-busts-cache correctness test.
- **Supply-chain-hardened release** -- published via `nx release` with npm provenance, from a SHA-pinned, least-privilege, manual-approval GitHub Actions workflow.

### Compatibility

- Nx 23, Angular 22 (`@angular/compiler-cli` `^22.0.0`), TypeScript `>=6.0.0 <6.1.0`
- Node `^22.22.3 || ^24.15.0 || ^26.0.0`

See the [README](./packages/angular-typechecker/README.md) for wiring the `angular-typecheck` target into a project.

[0.0.3]: https://github.com/LayZeeDK/angular-typechecker/releases/tag/angular-typechecker@0.0.3
[0.0.2]: https://github.com/LayZeeDK/angular-typechecker/releases/tag/angular-typechecker@0.0.2
[0.0.1]: https://github.com/LayZeeDK/angular-typechecker/releases/tag/angular-typechecker@0.0.1
