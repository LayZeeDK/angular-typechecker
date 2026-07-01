---
phase: 06-full-e2e-matrix-ci
plan: 01
subsystem: testing
tags: [nx, angular, e2e, fixtures, package-json, npm, oq-1]

requires:
  - phase: 05-packaging-publish-hardening-e2e-smoke-mvp
    provides: the install-e2e harness (pack-to-tmp, buildCleanEnv) + the B-03 clean-install honesty invariant
provides:
  - the angular-typechecker-matrix-e2e Nx project skeleton (serialized vitest config, tsconfigs, project.json)
  - a self-contained 5-project-type consumer-workspace fixture (app, local lib, buildable lib, publishable lib, spec tsconfig) wiring the PUBLISHED executor id, NO tsconfig.base.json/source alias
  - VALIDATED OQ-1 result: a clean npm install (no legacy-peer-deps) of the fixture PASSES -> B-03 holds; buildable/publishable build targets are hand-authored with NO @nx/angular dependency
affects: [06-full-e2e-matrix-ci re-plan (the 5-type e2e spec + pnpm + ci.yml build on this fixture)]

tech-stack:
  added: []
  patterns:
    - 'Self-contained multi-project consumer fixture (own nx.json, no base tsconfig) wiring the published executor id'
    - 'Hand-authored @nx/angular:ng-packagr-lite / :package build targets WITHOUT an @nx/angular dep (executor only reads tsConfig; Nx 23 ignores the sibling build executor at graph time)'

key-files:
  created:
    - 'e2e/angular-typechecker-matrix-e2e/{project.json,vitest.config.mts,tsconfig.json,tsconfig.spec.json}'
    - 'e2e/angular-typechecker-matrix-e2e/fixtures/consumer-workspace/{nx.json,package.json}'
    - 'e2e/angular-typechecker-matrix-e2e/fixtures/consumer-workspace/apps/app/** (application type)'
    - 'e2e/angular-typechecker-matrix-e2e/fixtures/consumer-workspace/libs/local-lib/** (local non-buildable lib + spec tsconfig)'
    - 'e2e/angular-typechecker-matrix-e2e/fixtures/consumer-workspace/libs/buildable-lib/** (ng-packagr-lite build target, no @nx/angular dep)'
    - 'e2e/angular-typechecker-matrix-e2e/fixtures/consumer-workspace/libs/publishable-lib/** (@nx/angular:package build target + importPath, no @nx/angular dep)'
  modified: []

key-decisions:
  - 'OQ-1 RESOLVED EMPIRICALLY: clean npm install (empty .npmrc, no legacy-peer-deps) of the 5-type fixture succeeds -> the Phase-5 B-03 honesty invariant is preserved; no @nx/angular dependency is needed in the fixture.'
  - 'The original Task 3 (the 5-type e2e spec) is RE-SCOPED forward to the re-discuss-v2 plan set (per RD-11): the spec is re-authored under the new e2e design (Linux-only, Node 24, npm path). The committed fixtures here are the dependency it builds on.'

patterns-established:
  - '5-project-type fixture topology: one install-once consumer workspace exposing 5 angular-typecheck targets'

requirements-completed: [] # 06-01 delivers the FIXTURE FOUNDATION + the OQ-1 result only. TEST-03 is validated by the re-planned 5-type spec plan (which claims TEST-03), not here.

duration: ~40min (killed mid-Task-3 during re-discuss; Tasks 1+2 committed)
completed: 2026-06-29
---

# Phase 6 (Plan 01): matrix-e2e project + 5-type consumer-workspace fixture + OQ-1 gate

**Stood up the `angular-typechecker-matrix-e2e` project and a self-contained 5-project-type consumer-workspace fixture, and PROVED the OQ-1 honesty invariant: a clean install (no `legacy-peer-deps`) succeeds with hand-authored buildable/publishable build targets that carry no `@nx/angular` dependency.**

## Status

Tasks 1-2 of the original 06-01 plan are COMPLETE and committed. Task 3 (the 5-type e2e spec) was in progress when the plan was deliberately PAUSED for re-discuss v2 (the matrix/e2e/act design changed materially). Per RD-11, the 5-type spec is re-authored in the re-planned set under the new e2e design; the committed fixtures below are the foundation it depends on. This SUMMARY closes 06-01 so execute-phase does not re-run the heavy OQ-1 install.

## Task Commits

1. **OQ-1 clean-install gate (fixture deps locked, install PASSED)** - `11e9be4` (test)
2. **Scaffold matrix-e2e project + 5-type consumer-workspace fixture** - `2951664` (test)

## Accomplishments

- Created the `angular-typechecker-matrix-e2e` Nx project (cloned the install-e2e serialized `vitest.config.mts`: forks/singleFork/no-parallel/300000 timeouts/node env).
- Authored a self-contained 5-project-type consumer-workspace fixture (own `nx.json`, no `tsconfig.base.json`, no source alias; wires the PUBLISHED executor id `angular-typechecker:angular-typecheck`): application, local non-buildable library (+ spec tsconfig), buildable library, publishable library.
- **OQ-1 resolved:** the buildable/publishable libs use hand-authored `@nx/angular:ng-packagr-lite` / `@nx/angular:package` build targets WITHOUT adding `@nx/angular` to the fixture `package.json`; a clean `npm install` (no `legacy-peer-deps`) succeeds -> the B-03 honesty invariant holds (a real consumer needs no peer override).

## Re-scoped forward (per re-discuss v2 / RD-11)

- The 5-type e2e spec (`matrix-5types.int.spec.ts`) is re-authored under the new e2e design (Linux-only, Node 24, npm path; green + injected-error per type via the install-smoke harness pattern) in the re-planned set, which claims TEST-03.

## Self-Check: PASSED (for the committed scope)

- Fixtures present on disk + committed (28 files, `2951664`); OQ-1 clean install verified PASS (`11e9be4`).
