---
phase: quick-260715-q3l
plan: 01
subsystem: ci-e2e-matrix
tags: [ci, e2e, security, hardening, coverage-guard]
requires: []
provides:
  - ci.yml e2e job passes the matrix project via a PROJECT env var (no shell interpolation)
  - list-e2e-projects.mjs throws on zero-project discovery
  - ng-cli-e2e e2e target serialized (parallelism:false)
  - GUARD-01b registry-serialization invariant (every startLocalRegistry project serializes)
affects:
  - .github/workflows/ci.yml
  - tools/ci/list-e2e-projects.mjs
  - e2e/angular-typechecker-ng-cli-e2e/project.json
  - packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts
tech-stack:
  added: []
  patterns:
    - "fork-PR-controlled matrix values reach run steps only through env vars, never ${{ }} shell interpolation"
    - "discovery scripts fail loud on empty results rather than silently expanding a matrix to zero cells"
key-files:
  created: []
  modified:
    - .github/workflows/ci.yml
    - tools/ci/list-e2e-projects.mjs
    - e2e/angular-typechecker-ng-cli-e2e/project.json
    - packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts
decisions:
  - "Task commits use no-bump conventional-commit TYPES (ci/build/test) so the package version stays 0.2.0 even though the guard spec lives under packages/angular-typechecker/."
  - "The new GUARD-01b it generalizes the dedicated install-e2e/cache-e2e serialization checks: it detects registry-starters by scanning global-setup.ts for a non-comment startLocalRegistry line, so any FUTURE registry-starting e2e project is covered too."
metrics:
  tasks: 3
  files: 4
  completed: 2026-07-15
---

# Quick Task 260715-q3l: Harden the CI e2e matrix wiring and coverage guard Summary

Four triaged CI review findings on the e2e matrix wiring and its coverage guard were addressed as bounded, low-risk hardening fixes with no product-code or version change (package.json stays 0.2.0).

## What changed

- **FIX 1 (command-injection hardening, T-q3l-01).** The `e2e` job's two run steps
  no longer interpolate `${{ matrix.project }}` into a shell command. The matrix
  value (derived from a fork-PR-controlled `e2e/*/project.json` `name`) is now passed
  through a `PROJECT` env var and referenced as `-p "$PROJECT"`, restoring the file's
  own top-of-file "no command-injection surface from untrusted PR metadata" invariant.
- **FIX 4 (fallback shrink).** The dynamic-matrix `|| '[...]'` fallback shrank from a
  stale 4-project list to a single-element sentinel `'["angular-typechecker-cache-e2e"]'`,
  and the adjacent comment now states plainly that the fallback is a non-authoritative
  `act -n` placeholder, not a coverage source. The `fromJSON(needs.discover.outputs.projects || '...')`
  shape (GUARD-01b matrix regex) is preserved.
- **FIX 2 (fail loud on empty discovery, T-q3l-02).** `listE2eProjects()` now throws
  when zero e2e projects are discovered instead of returning `[]`. An empty array would
  expand the CI `e2e` matrix to zero cells (reported `skipped`), which the `ci` aggregate
  excludes from its fail set -- silently dropping the whole tarball tier while `ci` stays
  green. The throw turns that into a loud non-zero-exit `discover`-job failure.
- **FIX 3 (serialize the 2nd Verdaccio publisher + encode the invariant).**
  `angular-typechecker-ng-cli-e2e`'s `e2e` target gains `parallelism: false` (its
  global-setup boots a second Verdaccio publisher on 127.0.0.1:4873, so it must run solo
  under the LOCAL `nx run-many -t e2e --parallel=2` command). A new GUARD-01b `it` encodes
  the general invariant "every e2e project whose global-setup calls `startLocalRegistry`
  sets `parallelism: false`", detected by scanning `global-setup.ts` files (non-comment
  lines) and mapping each to its project via `basename(dirname(dirname(path)))`. It has an
  anti-vacuous-green non-empty assertion. The stale install-e2e "sole Verdaccio publisher"
  message was corrected to "one of two publishers (with ng-cli-e2e), both serialized".

## Commits (one per task)

| Task | Type    | Commit    | Files |
| ---- | ------- | --------- | ----- |
| 1    | `ci`    | `117e854` | .github/workflows/ci.yml |
| 2    | `build` | `2394989` | tools/ci/list-e2e-projects.mjs |
| 3    | `test`  | `ec382de` | e2e/angular-typechecker-ng-cli-e2e/project.json, packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts |

All three types are no-bump / changelog-hidden, so the package version stays 0.2.0.

## Verification (all green)

- `npx nx test angular-typechecker --skip-nx-cache` -> **374 passed** (39 files). GUARD-01/01b/01c/01d/01e
  all pass, including the NEW registry-serialization `it` (373 -> 374) and the still-green
  execSync discovery == enumeration check.
- `node tools/ci/list-e2e-projects.mjs` -> emits the sorted 4-project JSON
  `["angular-typechecker-cache-e2e","angular-typechecker-install-e2e","angular-typechecker-matrix-e2e","angular-typechecker-ng-cli-e2e"]`,
  exit 0. A standalone check against an empty `e2e/` proved the new guard throws
  (`list-e2e-projects: no e2e projects discovered under e2e/ ...`).
- `npx nx format:check --base=HEAD~3 --head=HEAD` -> exit 0 (changed files clean; no `format:write` needed).
- `npx nx run-many -t lint --skip-nx-cache` -> all 3 projects pass linting at maxWarnings:0.

## Deviations from Plan

None - plan executed exactly as written.

Note on commit types: the executor prompt described the per-task tokens as "scopes"
(Task 1 -> ci, Task 2 -> build, Task 3 -> test). Applied them as conventional-commit
TYPES (`ci:` / `build:` / `test:`), which is the interpretation that keeps the package
version at 0.2.0 (all three are no-bump types) and keeps them out of the public changelog --
critical for Task 3 because its spec change lives under `packages/angular-typechecker/`
and a `feat`/`fix` type there would have triggered a patch bump. Not a scope/deviation from
the intended behavior; recorded for transparency.

## GUARD regex substrings preserved

- `run-many -t e2e` (GUARD-01 / GUARD-01b) -- kept before `-p "$PROJECT"`.
- `run-many -t typecheck` (GUARD-01c) -- kept before `-p "$PROJECT"`.
- `fromJSON(needs.discover.outputs.projects` (GUARD-01b matrix) -- shape preserved.

## Self-Check: PASSED

- All 4 modified files exist and carry the changes (verified by the passing test/lint/format runs).
- Commits `117e854`, `2394989`, `ec382de` exist on `gsd/v0.2.1-angular-cli-workspace-support`.
