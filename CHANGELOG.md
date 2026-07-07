# Changelog

All notable changes to **angular-typechecker** are documented in this file.

## 0.1.2 (2026-07-06)

Storybook story type-checking. The `typecheck` target now checks the whole surface
a Storybook tsconfig declares -- your `*.stories.ts`, `.storybook/main.ts` and
`preview.ts`, and, for the centralized-host recipe, the aggregated
`*.component.ts`/`*.directive.ts`/`*.ts` its `include` reaches -- across both the
per-project scaffold (Layout A) and the centralized host (Layout B). Under the
hood this is one input-set-membership boundary correctness fix, not
Storybook-specific machinery: the plugin still ships zero Storybook coupling.

> **Behavior change (a correctness fix, not a regression):** existing
> centralized-host (Layout B) Storybook builds that previously passed by SILENTLY
> dropping aggregated cross-project diagnostics will now FAIL when those aggregated
> stories or components have real type or template errors. This is a false-pass ->
> true-fail CORRECTION (permitted under 0.x semver), not a break. If a build newly
> goes RED, read the newly reported diagnostics as the errors that were there all
> along.

### Features

- **Input-set-membership boundary** -- the project-in-isolation boundary filter
  now decides what to check by compiler input-set membership (the files the
  tsconfig declares) instead of a directory-containment proxy. A centralized
  Storybook host that aggregates stories and components from across the workspace
  is now checked completely, closing a silent false pass.
- **Declared-but-uncheckable advisory** -- a new `notTypeCheckedDeclaredFiles`
  field on the programmatic `CoreResult`, surfaced as a loud executor notice, names
  declared files the type-check cannot cover (`.mdx` is never type-checked; a
  `.tsx` is checked only when `compilerOptions.jsx` is set). Advisory only -- it
  never changes the verdict.
- **Bundler-query import advisory** -- a new `bundlerQueryImports` field on the
  programmatic `CoreResult`, surfaced as a loud executor notice, flags unresolved
  `TS2307` whose module specifier carries a `?` bundler query (Vite/Analog
  `?raw`/`?url`/`?worker`/`?inline`, virtual modules) and recommends adding
  `"types": ["vite/client"]` to the checked tsconfig. Verdict-neutral and
  self-gating (it falls silent once the imports resolve) -- it NEVER suppresses the
  diagnostic, because a missing module can be a genuine error.
- **Split coverage counters** -- suppressed diagnostics are now reported split into
  expected `node_modules` suppressions (quiet) and first-party in-graph
  suppressions (loud), so a dropped first-party diagnostic is always visible and
  forces a non-clean coverage-incomplete verdict instead of a silent pass. On the
  programmatic `CoreResult` API this replaces the prior single `suppressedCount`
  field with `suppressedThirdParty`, `suppressedInGraphErrorCount`,
  `suppressedInGraphWarningCount`, and `suppressedInGraphFiles` (a breaking change
  for any code reading `result.suppressedCount`; permitted under 0.x semver).

### Fixes

- **Zero-input in-project leaf is coverage-incomplete** -- a referenced in-project
  leaf that resolves to zero input files (an empty config, or a
  references-only/solution tsconfig whose inner projects are not walked) now yields
  a non-clean coverage-incomplete verdict instead of an advisory-only skip. Only
  out-of-project, duplicate, and self references remain advisory.

### Internal

- Added a packaged-tarball Storybook end-to-end test: it installs the published
  tarball into a fresh Nx workspace with a generator-shaped Storybook project
  (Layout A and Layout B), wires the target, and asserts a planted story error is
  caught -- proving the shipped artifact, not just the local build.
- Added in-repo integration fixtures for the residual boundary-semantics matrix
  (workspace `paths`-alias aggregated imports, story-less/flat configs, and a
  declared `.mdx`).

### Compatibility

- Nx 23, Angular 22 (`@angular/compiler-cli` `^22.0.0`), TypeScript `>=6.0.0 <6.1.0`
- Node `^22.22.3 || ^24.15.0 || ^26.0.0`
- No new dependency; the plugin still ships zero Storybook coupling. Installing
  `@storybook/angular` on Angular 22 needs `--legacy-peer-deps` / `--force`; see the
  README Storybook section.
- Vite/Analog Storybook `?query` imports (`?raw`/`?url`/`?worker`/`?inline`, virtual
  modules) report `TS2307` under the full Angular check. The README Storybook caveat
  now LEADS with the fix -- add `"types": ["vite/client"]` to the checked tsconfig, or
  a hand `declare module '*?query'` ambient shim in a `.d.ts` as the no-`vite`
  fallback. The diagnostics are never auto-suppressed.

## 0.1.1 (2026-07-04)

Critical packaging fix. Every prior release (0.0.1 through 0.1.0) published the
plugin's raw TypeScript source instead of its compiled JavaScript, so on a
standard Nx 23 workspace the executor and generators failed to load and
`nx add angular-typechecker`, `nx g angular-typechecker:configuration`,
`nx typecheck`, and `require('angular-typechecker')` all errored out. 0.1.1 is
the first release that installs and runs as documented -- if you are on any
earlier version, upgrade.

### Fixes

- **Publish the built package, not the source** -- `nx release publish` now packs
  the compiled `dist` output (JavaScript plus type declarations) instead of the
  project source tree. Earlier tarballs shipped `.ts` source with no compiled
  `.js` and a `main` field pointing at a file that was never published, which
  Node's native type-stripping refuses to load from `node_modules`. No API,
  option, or wiring change -- the package simply installs and runs now.

### Internal

- Added a Verdaccio publish-and-install end-to-end regression test (publishes the
  real tarball to a local registry, installs it by name into a fresh Nx
  workspace, and asserts the installed package contains compiled JavaScript and no
  source `.ts`), plus config guards pinning the publish package root and the
  built-vs-source version -- closing the gap that let the packaging defect ship.

### Compatibility

- Nx 23, Angular 22 (`@angular/compiler-cli` `^22.0.0`), TypeScript `>=6.0.0 <6.1.0`
- Node `^22.22.3 || ^24.15.0 || ^26.0.0`

## 0.1.0 (2026-07-02)

Reference-walking engine, a configuration/init generator suite, and `nx add`
support. Two breaking changes -- see below -- so this is a minor release
despite the 0.x series.

### Breaking Changes

- **Executor renamed** -- `angular-typechecker:angular-typecheck` is now
  `angular-typechecker:typecheck`. Update any `project.json` target executor
  references and `nx.json` `targetDefaults` keys from `:angular-typecheck` to
  `:typecheck`.
- **Public API narrowed** -- the package barrel now exports only
  `runTypecheck`, `TypecheckInfrastructureError`, and the `CoreOptions` /
  `CoreResult` / `SkippedReference` types. The removed exports
  (`loadCompilerCli`, `evaluateResult`, `filterDiagnostics`, `formatReport`,
  `gatherAllDiagnostics`, and their option/result types) were engine
  internals, never part of the documented API -- the executor and generators
  remain the intended surface.

### Features

- **Solution-tsconfig reference walking** -- the `typecheck` target now walks
  a solution `tsconfig.json`'s in-project references and type-checks every
  referenced leaf in one run (deduplicated, module-boundary-guarded), instead
  of requiring one target per leaf tsconfig. A skipped or unresolved
  reference surfaces as a loud advisory notice rather than failing silently.
- **`configuration` generator** -- wires a single `typecheck` target for a
  project, resolving the right tsconfig (explicit override, solution
  tsconfig, or a flat leaf) and idempotently rewriting an existing
  `angular-typechecker:typecheck` target.
- **`init` generator** -- seeds the workspace-wide `angular-typechecker:typecheck`
  `targetDefaults` (caching, inputs/outputs) in `nx.json`.
- **`nx add` support** -- both generators are registered in `generators.json`
  and shipped in the package, so `nx add angular-typechecker` now scaffolds a
  working setup.

### Fixes

- **Reference-walking parity** -- diagnostics from the solution-tsconfig walk
  now match what a direct per-leaf run reports.
- **Flat single-tsconfig projects** -- the `configuration` generator now
  resolves projects with a single flat tsconfig (no solution references) and
  rejects an empty `targetName`.

### Compatibility

- Nx 23, Angular 22 (`@angular/compiler-cli` `^22.0.0`), TypeScript `>=6.0.0 <6.1.0`
- Node `^22.22.3 || ^24.15.0 || ^26.0.0`

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

[0.1.2]: https://github.com/LayZeeDK/angular-typechecker/releases/tag/angular-typechecker@0.1.2
[0.1.1]: https://github.com/LayZeeDK/angular-typechecker/releases/tag/angular-typechecker@0.1.1
[0.1.0]: https://github.com/LayZeeDK/angular-typechecker/releases/tag/angular-typechecker@0.1.0
[0.0.3]: https://github.com/LayZeeDK/angular-typechecker/releases/tag/angular-typechecker@0.0.3
[0.0.2]: https://github.com/LayZeeDK/angular-typechecker/releases/tag/angular-typechecker@0.0.2
[0.0.1]: https://github.com/LayZeeDK/angular-typechecker/releases/tag/angular-typechecker@0.0.1
