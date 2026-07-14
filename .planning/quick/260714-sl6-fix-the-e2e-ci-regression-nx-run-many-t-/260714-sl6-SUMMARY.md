---
quick_id: 260714-sl6
status: complete
outcome: fixed + act-verified
date: 2026-07-14
---

# Quick Task 260714-sl6: Fix the e2e-CI regression -- SUMMARY

**Outcome: the dist-build e2e-CI regression is FIXED and act-verified.** `nx run-many -t e2e` now
builds `angular-typechecker` (dist) BEFORE the parallel e2e tier on a fresh runner, so the ENOENT that
failed install/matrix/ng-cli is gone. Fix committed at `bd2d243`; test-harness/CI config only; no
`package.json` version mutation.

## Root cause (proven)

The `e2e` targetDefault `dependsOn: ["angular-typechecker:build"]` in `nx.json` was INERT. nx 23.1's
`readTargetDefaultsForTarget` returns the EXECUTOR-keyed default (`@nx/vitest:test`, which all 4 e2e
targets use) and short-circuits BEFORE reading the NAME-keyed `e2e` default -- so the whole `e2e`
targetDefault block (any dependsOn form: the `project:target` string OR `^build` OR object) was
discarded. `nx show project` showed the merged `e2e` target with `dependsOn: (none)`; the task graph
scheduled zero build tasks. Masked locally by a pre-existing `dist/` + `--skip-nx-cache`; CI has
neither, and feature-branch pushes never triggered CI (`on: push:[main]`), so it only surfaced on the
nub throwaway probe PR (#34).

## Fix (bd2d243)

- DELETED the inert name-keyed `e2e` targetDefault from `nx.json`.
- ADDED `dependsOn: [{ "projects": ["angular-typechecker"], "target": "build" }]` to the `e2e` target
  in EACH of the 4 e2e `project.json` files -- a target's OWN config bypasses the executor-keyed
  precedence trap. nx dedups to ONE shared `angular-typechecker:build` before the parallel tier
  (preserving squ's build-once / no-per-spec-build / read-only-dist intent; no concurrent dist writes).
  Fixes BOTH CI and local `nx e2e`.
- GUARD-01e (ci-e2e-coverage-guard.spec.ts): per-project.json read asserting each `e2e` target declares
  the `angular-typechecker:build` dependsOn (the failure mode was config-present-but-inert, so it
  asserts the dep ON THE TARGET) + a no-nx.json-e2e-default assertion.
- ci.yml item-(1) build-ordering comment corrected (comment-only; run steps byte-unchanged) to credit
  the per-project mechanism instead of the deleted targetDefault.

## Verification

- **Task graph:** `nx run-many -t e2e --parallel=2 --graph` now schedules `angular-typechecker:build`
  (1 shared, + its own `^build` -> `test-util:build`) before the 4 e2e tasks.
- **Fast gates (bd2d243):** `nx test angular-typechecker` 372/372 (incl. GUARD-01e), `nx show project`
  build-dependsOn proof for ALL FOUR e2e projects, typecheck + lint (maxWarnings:0) + format:check green.
- **act fresh-container run** (`act pull_request -j e2e`, catthehacker/ubuntu:act-24.04 arm64 native):
  build compiled FIRST (test-util + angular-typechecker), then **install-e2e 37 tests, matrix-e2e 7,
  cache-e2e 9 ALL PASS** -- the exact projects that ENOENT'd pre-fix. No dist ENOENT anywhere. The
  dist-build regression is RESOLVED.
- **Local `rm -rf dist` repro** confirmed the build runs first + dist is created (the run was reaped by
  the environment mid-specs, but proved the crux before the kill).

## Known act-fidelity gap (NOT a real-CI issue) -- ng-cli-e2e

Under act, ng-cli-e2e's 3 `ng add`/`ng run` specs (npm/pnpm/yarn) FAILED -- but the error is
`The Angular CLI requires a minimum Node.js version of v22.22.3 or v24.15.0 or v26.0.0. Node.js version
v24.14.1 detected.` The catthehacker act image ships Node **24.14.1**, BELOW the Angular CLI's 24.15.0
floor, and act's setup-node reused the pre-baked Node instead of downloading latest 24.x. So `ng add`
refuses under act. This is ACT-SPECIFIC: on real GitHub CI, `setup-node@... node-version: 24` installs
the latest 24.x (>= 24.15.0), and ng-cli passes locally on Node 24.18.0. IMPORTANT: ng-cli got PAST the
dist-read (its globalSetup succeeded -- dist present) and failed only downstream at `ng add` on the Node
floor -- so the dist-build fix is confirmed for ng-cli too; only the act Node floor blocks it under act.

## Residual note (low risk) + follow-ups

- ng-cli-e2e has NEVER run in real GitHub CI (nub #34 died at the dist ENOENT first; act can't run it
  due to the Node floor). The v0.2.1 Release-PR will be its first real-CI run. High confidence it passes
  (compliant Node via setup-node@24 + green locally), but the Release-PR's own CI is the final
  confirmation. A throwaway PR could confirm it earlier if desired.
- act-compat follow-up (optional): make act faithful for ng-cli by pinning an act image with Node
  >= 24.15.0 (or forcing setup-node to download it), so `act -j e2e` can run ng-cli locally.
- The 260714-nub actions/cache work stays parked; it can resume now that the e2e tier passes in CI.

## Files (bd2d243)

nx.json, e2e/angular-typechecker-{cache,install,matrix,ng-cli}-e2e/project.json,
packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts, .github/workflows/ci.yml (comment).
