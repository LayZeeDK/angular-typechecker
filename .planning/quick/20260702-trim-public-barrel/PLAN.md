---
slug: trim-public-barrel
created: 2026-07-02
kind: quick
validate: true
breaking: true
---

# Quick task: trim the published package barrel to a minimal public API (Option A)

Follow-up to the PR #15 review triage (finding M, deferred there for a decision).
User approved **Option A** and confirmed a breaking change is acceptable in this
pre-1.0 prerelease.

## Change

Narrow `packages/angular-typechecker/src/index.ts` (the published barrel: `main` /
`types` / `exports["."]`) to a small, deliberate programmatic API.

- **KEEP:** `runTypecheck`, `TypecheckInfrastructureError` (runtime); `CoreOptions`,
  `CoreResult`, `SkippedReference` (types).
- **DROP:** `loadCompilerCli`; `evaluateResult` + `EvaluateOptions`;
  `filterDiagnostics` + `FilterOptions` + `FilterResult`; `formatReport` +
  `FormatOptions`; `gatherAllDiagnostics`; `renderReport` + `RenderOptions`.

## Why safe

- Nx loads the executor via `executors.json` and generators via `generators.json`
  (by path), never through the barrel.
- No internal module imports the barrel (verified: zero `from '../index'` etc.).
- Dropped symbols stay internal (imported module-to-module), so only `index.ts`
  changes; the modules are still compiled and used.
- `TemplateCheckAborted` remains transitively reachable via `CoreResult` but
  un-exported by name -- unchanged from today.

## Commit

`refactor(core)!` with a `BREAKING CHANGE:` footer (0.x -> breaking bumps a minor;
this rides the v0.1.0 release).

## Validation (--validate)

`nx build` + `nx test` + `nx typecheck-drift` + `nx run-many -t lint` + Prettier
`--check`, and confirm `@nx/dependency-checks` stays green.
