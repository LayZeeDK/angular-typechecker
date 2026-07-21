---
status: complete
task: 260714-1gr
title: Apply Lever 1 (persist Verdaccio uplink cache) + re-measure cold vs warm
subsystem: e2e test harness
tags: [e2e, verdaccio, cache, test-util, measurement]
requires:
  - 260713-w87 (Lever 1 spec + cold baseline)
provides:
  - resetVerdaccioPublishState(root) shared helper (test-util, barrel-exported)
  - clearStorage:false + selective-reset in both registry global-setups
  - 260714-1gr-MEASUREMENTS.md (cold-vs-warm + w87 comparison)
affects:
  - e2e/angular-typechecker-install-e2e
  - e2e/angular-typechecker-ng-cli-e2e
key-files:
  created:
    - libs/test-util/src/lib/e2e-fixture.spec.ts
    - .planning/quick/260714-1gr-apply-lever-1-persist-verdaccio-uplink-c/260714-1gr-MEASUREMENTS.md
  modified:
    - libs/test-util/src/lib/e2e-fixture.ts
    - libs/test-util/src/index.ts
    - e2e/angular-typechecker-install-e2e/src/global-setup.ts
    - e2e/angular-typechecker-ng-cli-e2e/src/global-setup.ts
    - .verdaccio/config.yml
decisions:
  - "Two-run cold/warm protocol shows a NULL C->W delta BY DESIGN: clearStorage:false warms run C within itself, so run W has nothing left to warm. Reported honestly; the win is evidenced vs the w87 wipe-per-project baseline."
metrics:
  duration: ~55 min (incl. two ~9-13 min detached e2e runs)
  completed: 2026-07-14
  tasks: 2
  files: 7
---

# Quick Task 260714-1gr: Apply Lever 1 (persist Verdaccio uplink cache) + re-measure Summary

Flipped `clearStorage:true -> false` in both registry global-setups and added a shared
`resetVerdaccioPublishState(root)` (test-util) that deletes ONLY
`storage/angular-typechecker` + `storage/.htpasswd` before `startLocalRegistry`, so the
npmjs uplink proxy cache now persists across e2e runs while the freshly built dist still
republishes clean and the ci-token still mints fresh. Both instrumented e2e runs are green.

## What was done

### Task 1 (TDD) -- apply Lever 1 + prove invariants survive (folded COLD run)

- RED: `e2e-fixture.spec.ts` asserting the helper deletes ONLY angular-typechecker +
  .htpasswd, PRESERVES siblings (.verdaccio-db.json, other-pkg/), and is a first-run no-op
  (storage absent) -- committed failing (`resetVerdaccioPublishState is not a function`).
- GREEN: added `resetVerdaccioPublishState(root)` to `libs/test-util/src/lib/e2e-fixture.ts`
  (two `rmSync` calls, `force:true` first-run no-op) + barrel export from `src/index.ts`.
- Apply: both global-setups import + call the helper AFTER `delete NX_INVOCATION_ROOT_PID`
  and BEFORE `startLocalRegistry`, with `clearStorage:false`. Corrected the 4 now-false
  comments (`.verdaccio/config.yml` x2 + both global-setup blocks) to describe the
  selective reset; every other load-bearing comment byte-unchanged.
- FAST gate GREEN: `nx test test-util` (9/9, incl. the 2 new specs), `nx lint test-util`,
  `nx typecheck test-util`, `nx format:check` (all six files), plus `nx typecheck` on both
  e2e projects (validates the global-setup imports compile).
- COLD run (run C, storage wiped first): `nx run-many -t e2e --parallel=2 --skip-nx-cache`
  exited 0, all 4 projects green (install 37, matrix 7, ng-cli 4, cache 9). Non-empty
  `tmp/1gr-run1-cold.jsonl` (45 lines, all 3 PMs). No ng-cli flake.

### Task 2 -- WARM re-measure + report

- WARM run (run W, storage preserved) exited 0, all 4 projects green. This is the decisive
  invariant proof: storage/angular-typechecker + .htpasswd were PRESENT (from run C), the
  helper deleted them, and publish stayed clean (no EPUBLISHCONFLICT, no sign-up 409).
- Aggregated both JSONL via the reused w87 aggregator; wrote `260714-1gr-MEASUREMENTS.md`
  with the 2-run protocol, Windows caveat, both tables, the cold-vs-warm delta, the w87
  comparison, the honest ceiling, and the deferred actions/cache follow-up.

## Headline measurement (install-only ms, directional -- Windows dev box)

- **C-vs-W same-session delta is NULL (within noise):** Verdaccio-routed subset +0.9%,
  matrix flat control +3.7%, grand 589032 -> 599299 (+1.7%). Reason: `clearStorage:false`
  makes run C already warm-within-itself (11 install-e2e specs + ng-cli share one
  persistent cache after the first fetch), so run W has nothing left to warm.
- **vs the w87 pre-Lever baseline (clearStorage:true, wipe-per-project):** Verdaccio-routed
  subset 797099 (w87) -> 536416 (C) / 541068 (W) = ~-33%. Cross-session caveat: the
  cache-independent matrix control also fell ~27% (faster box today), so the clean
  cache-attributable excess is ~5 pp aggregate, ~7 pp on ng-cli.
- **Flagship line (clean cache proof):** ng-cli yarn-flat `corepack yarn install`
  93.4s (w87) -> 53.5s (C) -> 44.7s (W) = -43%/-52%, far exceeding the ~27% environmental.
- **matrix flat control** (npmjs-direct) confirms bounded scope (C->W +3.7%).

## Deviations from Plan

### Minor (not deviations from intent)

**1. [Prettier normalization] Spec formatting folded into the apply commit**
- The RED spec's multi-line `writeFileSync` was collapsed to one line by `nx format:write`
  after the RED commit; the format fix was folded into the apply commit (`302f93c`) rather
  than amending the RED commit. All test-harness files; no behavior change.

**2. [Honest null result] The two-run cold/warm delta is ~null, not "cold > warm"**
- The plan/RESEARCH anticipated a cold>warm delta on the Verdaccio-routed subset. The
  measured C-vs-W delta is within noise BECAUSE clearStorage:false warms run C within a
  single run. This is reported honestly; the Lever's real win is evidenced against the w87
  wipe-per-project baseline (the flagship ng-cli yarn line) after subtracting the ~27%
  cross-session environmental drift. No narrative was forced onto the data.

No auto-fixes (Rules 1-3) were needed; no architectural change (Rule 4); no auth gates.

## Blocking invariants -- all confirmed

- Selective delete removes ONLY angular-typechecker + .htpasswd (unit spec locks it;
  494-entry proxy cache preserved across runs, verified on disk).
- Token mint OK (no 409); no EPUBLISHCONFLICT; dist republished clean each run.
- 127.0.0.1 SAFETY gate, single 4873 registry, parallelism:false, NX_INVOCATION_ROOT_PID
  clear, enableMirror:false, --parallel=2: all untouched.
- No package.json version mutation; no product/source change (test-harness + config comments
  only). actions/cache NOT implemented (deferred follow-up).

## Commits

- `1395e8d` test(test-util): add failing spec for resetVerdaccioPublishState (RED)
- `5e88426` feat(test-util): add resetVerdaccioPublishState selective storage reset (GREEN)
- `302f93c` test(e2e): persist Verdaccio uplink cache via clearStorage:false (Lever 1)

Raw JSONL/logs under `tmp/` are gitignored and NOT committed. Docs artifacts
(SUMMARY/MEASUREMENTS) left uncommitted for the orchestrator.

## Self-Check: PASSED
