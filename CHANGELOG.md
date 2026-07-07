# Changelog

All notable changes to **angular-typechecker** are documented in this file.

## 0.2.0 (2026-07-07)

**Storybook story type-checking.** `nx typecheck` now type-checks your Storybook
stories (`*.stories.ts`), your `.storybook/main.ts` and `preview.ts`, and every
other file your Storybook `tsconfig` includes. Your stories get the full Angular
check (TypeScript errors plus template and NG8xxx diagnostics), not just your app
and libraries. This works whether each project has its own Storybook or you run a
single central Storybook that pulls in stories and components from across the
workspace. No configuration and no Storybook-specific option is required, and the
plugin still has no dependency on Storybook.

> **Behavior change (a correctness fix, not a regression).** If you run a single
> central Storybook that pulls in stories and components from other projects, a
> `typecheck` run that used to pass may now fail. It was previously skipping those
> pulled-in files and missing real errors in them. A newly failing run is not a new
> problem: the reported type or template errors were already there; they just
> weren't being checked. Fix them, or run each project's own `typecheck` to see them
> reported directly.
>
> This isn't specific to Storybook. Any project that imports an internal workspace
> library from source (for example through a TypeScript `paths` alias) is now checked
> the same way. If a pulled-in first-party file has a real error, the run no longer
> reports a false "clean". Each error stays attributed to the project that owns it,
> but the run now tells you which file it couldn't fully check and refuses to report
> a passing result.

### Features

- Complete Storybook coverage for both setups. Whether your stories live in each
  project (the default per-project Storybook) or in one central Storybook that
  aggregates them from across the workspace, `nx typecheck` checks the whole set of
  files your Storybook `tsconfig` declares. An error in one of those declared files
  is reported with the correct file and code frame, including a story that uses an
  external `templateUrl` template. A file reached only through an import (for example
  a component in another library that the config doesn't include) is instead surfaced
  as incomplete coverage, as described above.
- Storybook Composition is supported. When one Storybook embeds other,
  independently built Storybooks, give each project its own `typecheck` target and
  use Nx's dependency fan-out (`dependsOn: ["^typecheck"]`) to check a host and
  everything it composes in one command. A type error in the host's
  `.storybook/main.ts`, including its `refs`, is reported.
- A notice for files that can't be type-checked. When your Storybook `tsconfig`
  includes files the Angular type-check can't cover, `nx typecheck` prints a notice
  naming them, so you always know which declared files it can't cover. This covers
  `.mdx` docs (never
  type-checked) and `.tsx` files (checked only when your `tsconfig` sets
  `compilerOptions.jsx`). The notice is informational and does not change whether the
  run passes.
- Vite and Analog `?query` import guidance. Vite and Analog Storybook imports that
  use a query suffix (`?raw`, `?url`, `?worker`, `?inline`, and virtual modules)
  report `TS2307` ("cannot find module") under the full Angular check, because
  TypeScript doesn't know about those bundler features on its own. `nx typecheck` now
  prints a notice for these and points you at the one-line fix: add
  `"types": ["vite/client"]` to the tsconfig you check. If you'd rather not rely on
  Vite's types, add a `declare module '*?raw'` ambient declaration in a `.d.ts`
  instead. These errors are never hidden automatically, because a genuinely missing
  module is a real error.
- Opt-in `strict` option (default `false`). When set, a run fails if the type-check
  had to skip a first-party file that produced a warning that would otherwise leave
  the run green. It only adds a fail path on a real coverage gap; it never turns a
  fail into a pass, and leaving it off keeps today's behavior.
- Clearer reporting of skipped diagnostics. `nx typecheck` now separates the
  diagnostics it expectedly ignores in `node_modules` (quiet) from any first-party
  file it had to skip (loud, with the files named). A skipped first-party error now
  fails the run.

### Fixes

- A referenced project config that resolves to no input files (an empty config, or a
  solution-style `tsconfig` whose inner projects aren't reached) now fails the run
  instead of being skipped without failing, so an accidentally-empty target can't
  report a false pass. Out-of-project, duplicate, and self references are still
  skipped with a warning (they don't fail the run), as before.

### Breaking (programmatic API only)

This breaking change is what makes 0.2.0 a minor release rather than a patch: under
0.x semver, a breaking change bumps the minor.

- If you consume the programmatic `runTypecheck` result (`CoreResult`) directly, the
  single `suppressedCount` field is replaced by `suppressedThirdParty`,
  `suppressedInGraphErrorCount`, `suppressedInGraphWarningCount`, and
  `suppressedInGraphFiles`, and two advisory fields are added
  (`notTypeCheckedDeclaredFiles` and `bundlerQueryImports`). The `nx typecheck`
  executor and its output are unaffected. (Breaking changes are permitted under
  0.x semver.)

### Compatibility

- Nx 23, Angular 22 (`@angular/compiler-cli` `^22.0.0`), TypeScript `>=6.0.0 <6.1.0`,
  Node `^22.22.3 || ^24.15.0 || ^26.0.0`. No new runtime dependency.

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

[0.2.0]: https://github.com/LayZeeDK/angular-typechecker/releases/tag/angular-typechecker@0.2.0
[0.1.1]: https://github.com/LayZeeDK/angular-typechecker/releases/tag/angular-typechecker@0.1.1
[0.1.0]: https://github.com/LayZeeDK/angular-typechecker/releases/tag/angular-typechecker@0.1.0
[0.0.3]: https://github.com/LayZeeDK/angular-typechecker/releases/tag/angular-typechecker@0.0.3
[0.0.2]: https://github.com/LayZeeDK/angular-typechecker/releases/tag/angular-typechecker@0.0.2
[0.0.1]: https://github.com/LayZeeDK/angular-typechecker/releases/tag/angular-typechecker@0.0.1
