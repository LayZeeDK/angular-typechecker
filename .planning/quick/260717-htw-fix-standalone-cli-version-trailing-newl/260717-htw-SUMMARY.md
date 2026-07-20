---
status: complete
phase: quick-260717-htw
plan: 01
subsystem: standalone-cli
tags: [cli, version, pr-42-review]
requires: []
provides:
  - "--version stdout carries its own trailing newline (symmetric with --help)"
affects:
  - packages/angular-typechecker/src/cli/parse-args.ts
tech-stack:
  added: []
  patterns:
    - "version payload owns its newline; bin.ts writes stdout verbatim"
key-files:
  created: []
  modified:
    - packages/angular-typechecker/src/cli/parse-args.ts
    - packages/angular-typechecker/src/cli/parse-args.spec.ts
    - packages/angular-typechecker/src/cli/main.spec.ts
decisions:
  - "Fix at the source (version result text), not in bin.ts/run() -- one guard where all callers route through; bin.ts stays untouched"
metrics:
  duration: ~6m
  completed: 2026-07-17
requirements: [PR42-N-1]
---

# Phase quick-260717-htw Plan 01: Fix standalone CLI --version trailing newline Summary

Appended a trailing `'\n'` to the standalone CLI `--version` payload so
`atc --version` prints the version on its own line (symmetric with `--help`,
whose `HELP_TEXT` already ends in `\n`) instead of gluing it to the shell
prompt. Fixes PR #42 review finding N-1.

## What changed

One-line source fix plus two drift-lock spec updates, in a single bisect-safe
commit:

- `parse-args.ts:129` -- version result text `packageManifest.version` ->
  `packageManifest.version + '\n'`. The version payload now carries its own
  newline, so `run()` / `bin.ts` (which write stdout verbatim) stay untouched.
- `parse-args.spec.ts:236` -- `expect(version.text).toBe(manifestVersion)` ->
  `... .toBe(manifestVersion + '\n')`.
- `main.spec.ts:210` -- `expect(result.stdout).toBe(manifestVersion)` ->
  `... .toBe(manifestVersion + '\n')`.

Scope held exactly to the plan: no changes to `bin.ts`, `main.ts` `run()`,
`HELP_TEXT`, e2e specs, or `standalone-cli-docs.spec.ts`. Additive/behavior-
consistent, no public-API change, within the v0.2.2 additive-only charter.

## Verification (all four gates GREEN, run before commit)

- `npx nx test angular-typechecker`
  ```
  Test Files  46 passed (46)
       Tests  463 passed (463)
  NX  Successfully ran target test for project angular-typechecker and 2 tasks it depends on
  ```
- `npx nx typecheck angular-typechecker` (tsc spec + drift + tools)
  ```
  NX  Successfully ran target typecheck for project angular-typechecker
  ```
- `npx nx lint angular-typechecker` (maxWarnings:0)
  ```
  [OK] All files pass linting
  NX  Successfully ran target lint for project angular-typechecker
  ```
- `npx nx format:check`
  ```
  EXIT=0   (no files reported)
  ```

## Deviations from Plan

None - plan executed exactly as written.

## Commit

- `ad23cbb` fix(cli): append trailing newline to --version output
  (3 files changed, 3 insertions(+), 3 deletions(-); no file deletions)

## Self-Check: PASSED

- FOUND: packages/angular-typechecker/src/cli/parse-args.ts (version branch returns `packageManifest.version + '\n'`)
- FOUND: packages/angular-typechecker/src/cli/parse-args.spec.ts (asserts `manifestVersion + '\n'`)
- FOUND: packages/angular-typechecker/src/cli/main.spec.ts (asserts `manifestVersion + '\n'`)
- FOUND commit: ad23cbb
