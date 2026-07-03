---
quick_id: 260703-lp0
slug: fix-stray-scoped-angular-typechecker-exe
description: Fix stray scoped @angular-typechecker executor id references in dev workspace and docs
date: 2026-07-03
status: complete
---

# Quick Task 260703-lp0 - Summary

## What

Removed the stray scoped `@angular-typechecker/angular-typechecker[:typecheck]`
form that the v0.1.0 executor rename left in the dev workspace, root docs, e2e,
and specs. The package is `angular-typechecker` and its executor is
`angular-typechecker:typecheck`; the only sanctioned scoped name is
`@angular-typechecker/source` (the Nx workspace-root package name).

## Distributed package: UNAFFECTED (verified) -> no release

- Package name `angular-typechecker`; `files` ships compiled `src` (specs/drift
  excluded by tsconfig.lib.json), `executors.json`, `generators.json`, the
  package's own already-correct `README.md`, `LICENSE`.
- The shipped `init` generator writes only `angular-typechecker:typecheck` and
  guards against ever writing a scoped key.
- Before this task the compiled `generator.js` carried a scoped literal in three
  code comments (`removeComments` is unset, so comments ship); those are now
  reworded. Post-fix scan of `dist/packages/angular-typechecker` is clean.
- Decision: no v0.1.1, no tag, no npm publish, no CHANGELOG entry (nothing
  shipped changed behavior). Landed as a normal fix PR into `main` (main is
  PR-only).

## Root cause of silent-green CI ("how could specs pass with a wrong id")

Nx resolves a local plugin executor by requiring the package name with the
workspace tsconfig `paths` registered. The leftover alias
`@angular-typechecker/angular-typechecker` -> `packages/angular-typechecker/src/index.ts`
made the bogus scoped id resolve to the SAME executor (proven:
`npx nx run typecheck-consumer:typecheck` ran green and loaded the real
executor; no node_modules symlink exists). The duplicate `nx.json` targetDefault
gave the scoped-keyed target valid cache config, and two specs asserted only the
SHAPE of string-keyed `targetDefaults` entries -- Nx treats those keys as
arbitrary strings and never checks they map to a registered executor. So the
wrong id was an accidental alias and no test caught it; in fact two specs
REQUIRED it. The guardrail was inverted.

## Changes

Commit 1 - `fix(workspace)`: `nx.json` (drop duplicate orphan targetDefault),
`libs/typecheck-{consumer,walk-consumer}/project.json` (executor ->
`angular-typechecker:typecheck`), `tsconfig.base.json` (alias ->
`angular-typechecker`), e2e cache parity import + config comment, root
`README.md` (both snippets), `.planning/codebase/STRUCTURE.md`.

Commit 2 - `test(workspace)`: corrected the two complicit specs to key on the
canonical id; reworded `generator.ts` comments so the shipped `generator.js`
carries no scoped literal; kept `init.spec.ts`'s generator-output negative guard
(forbidden key assembled from parts); added `scoped-name-guard.spec.ts` - a
repo-wide tripwire that fails if any tracked non-`.planning` file references
`@angular-typechecker/` other than `@angular-typechecker/source`.

## Regression prevention

- `scoped-name-guard.spec.ts` scans `git ls-files` and would have caught this
  entire incident. Negative spot-check: injecting a scoped ref into a tracked
  file turns it RED; reverting restores GREEN.
- The two shape-only specs now assert the single canonical id, so a reintroduced
  scoped duplicate no longer passes silently.

## Verification (all green)

- `nx run typecheck-consumer:typecheck` resolves + passes with the canonical id
- `nx run-many -t typecheck-drift test -p angular-typechecker` - 249 tests pass
- `nx run angular-typechecker-cache-e2e:test` - 9 tests pass (renamed import +
  canonical executor id end-to-end)
- `nx format:check` clean; `nx run-many -t lint build -p angular-typechecker`
  clean (maxWarnings:0)
- built `dist/packages/angular-typechecker` scoped-literal scan: clean
- repo-wide: no stray `@angular-typechecker/` outside `.planning/` history except
  the sanctioned `@angular-typechecker/source`

## Scope note

Historical `.planning/` milestone artifacts (13.1-*, 04-*, 05-*, etc.) still
contain the scoped form as an accurate record of what happened and are left
untouched (and excluded from the guard). Only the current-state
`.planning/codebase/STRUCTURE.md` reference was updated.
