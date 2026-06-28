# Changelog

All notable changes to **angular-typechecker** are documented in this file.

## 0.0.2 (2026-06-28)

Maintenance release. No functional changes to the executor.

This release verifies the tokenless OIDC steady-state publish path: 0.0.1 was first-published with a one-time token (a first npm publish cannot use OIDC), and 0.0.2 is the first release to authenticate through the registered npm Trusted Publisher with no token, attaching an SLSA provenance attestation.

### Compatibility

- Nx 23, Angular 22 (`@angular/compiler-cli` `^22.0.0`), TypeScript `>=6.0.0 <6.1.0`
- Node `^22.22.3 || ^24.15.0 || ^26.0.0`

## 0.0.1 (2026-06-28)

Initial release.

angular-typechecker is an Nx plugin that runs the *complete* Angular compiler type-check -- TypeScript checks plus Angular template type-checking and extended (NG8xxx) diagnostics -- with no emit, decoupled from building the application or running its tests. It gives a fast, isolated static-check feedback loop for AI coding agents and CI pipelines.

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

[0.0.2]: https://github.com/LayZeeDK/angular-typechecker/releases/tag/angular-typechecker@0.0.2
[0.0.1]: https://github.com/LayZeeDK/angular-typechecker/releases/tag/angular-typechecker@0.0.1
