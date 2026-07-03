---
quick_id: 260703-p2x
slug: create-workspace-test-util-lib-with-find
description: Create @workspace/test-util lib with findWorkspaceRoot and address Finding J
date: 2026-07-03
status: complete
---

# Quick Task 260703-p2x - Summary

## What

Created the internal `@workspace/test-util` Nx library (via `@nx/js:library`)
exporting a tested `findWorkspaceRoot`, and refactored 26 specs to use it
(review Finding J). Stacked on PR #19.

## Changes

Commit 1 - `feat(test-util)`: `libs/test-util` (project.json with explicit
build/lint/test targets, `src/lib/find-workspace-root.ts` + 4-test spec, tsconfigs
with `ignoreDeprecations: "6.0"`, vitest/eslint config, README) + the
`@workspace/test-util` path alias in `tsconfig.base.json`.

Commit 2 - `test(workspace)`: 26 specs (plugin + 3 e2e projects) now call
`findWorkspaceRoot(...)` instead of a depth-coupled `join(dir, '..', ...)` chain;
stale "N dirs up" comments corrected.

## Decisions / gotchas resolved

- **Generator side effects reverted.** `@nx/js:library` added an inferred-`plugins`
  block to `nx.json` (namespaced `eslint:lint`/`vitest:test` targets) that neither
  matches this workspace's explicit-executor convention nor is picked up by CI's
  `nx run-many -t test/lint`. Reverted; the lib carries explicit targets instead.
  `nx.json` ends byte-unchanged.
- **Buildable-boundary rule.** The plugin is a buildable library, and
  `@nx/enforce-module-boundaries` forbids a buildable lib importing a non-buildable
  one. Gave test-util a `@nx/js:tsc` build target (its output is never consumed --
  the lib is used via the source path alias; the build only satisfies the rule).
- **TS 6 deprecation.** The generated tsconfig inherited `moduleResolution: node`
  (node10), which errors TS5107 under TS 6; added `ignoreDeprecations: "6.0"`
  (matches the plugin's `tsconfig.drift.json`).
- **findWorkspaceRoot design.** Anchor-walk to `nx.json` -> depth-independent, which
  removes the silent wrong-root-on-move bug class Finding J flagged (not just the
  duplication).

## Verification (all green)

- `nx run-many -t test lint -p test-util` -- 4 findWorkspaceRoot tests pass
- plugin: lint + typecheck-drift + 250 tests + build clean
- e2e (run serially -- shared dist tarball): cache 9, install 26, matrix 7 -- proves
  `@workspace/test-util` resolves under every e2e vitest config
- tarball isolation: no `@workspace/test-util` / test-util code in the plugin's
  shipped `src` or `dist/packages/angular-typechecker`
- `nx format:check` clean; repo-wide scoped-name scan clean (only `@angular-typechecker/source`)

## Deferred (offered follow-up)

Review findings E1 (docs-only PRs skip the guard - code-gated `test` job), E3 (Nx
per-project cache can stale-green the whole-repo scan), E4, E5 (test the executor
resolution invariant, not just the scope string) are a coherent "make the guard a
dedicated, always-run, non-cached workspace check + assert executor ids resolve"
follow-up -- not folded in here.
