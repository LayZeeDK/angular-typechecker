---
slug: trim-public-barrel
status: complete
date: 2026-07-02
validate: true
breaking: true
---

# SUMMARY: trim the published package barrel to a minimal public API (Option A)

Resolved PR #15 review finding M (deferred there as a public-API decision). User
approved Option A + confirmed breaking changes are acceptable in this pre-1.0 line.

## Change

`packages/angular-typechecker/src/index.ts` now exports only the intended public
API: `runTypecheck`, `TypecheckInfrastructureError`, and the `CoreOptions` /
`CoreResult` / `SkippedReference` types. Removed the engine internals
(`loadCompilerCli`, `evaluateResult`/`EvaluateOptions`, `filterDiagnostics`/
`FilterOptions`/`FilterResult`, `formatReport`/`FormatOptions`, `gatherAllDiagnostics`,
`renderReport`/`RenderOptions`) -- they remain internal, imported module-to-module.

1 commit: `96e9c83` refactor(core)! (BREAKING CHANGE footer). 0.x -> a breaking
change bumps a minor, riding the v0.1.0 release.

## Why safe

Nx loads the executor/generators by path (executors.json / generators.json), never
through the barrel; no internal module imports the barrel; the dropped symbols are
still compiled and used internally. `TemplateCheckAborted` stays transitively
reachable via `CoreResult` but un-exported by name (unchanged from before).

## Validation (--validate)

Green: `nx build` (tsc), `nx test` 251/251 (34 files), `nx typecheck-drift`,
`nx run-many -t lint` (incl. `@nx/dependency-checks`, maxWarnings:0), Prettier
`--check`.
