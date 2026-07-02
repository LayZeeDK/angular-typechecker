---
phase: 13-engine-solution-tsconfig-reference-walking
plan: 06
subsystem: core
tags: [nx-caching, walk, cache-e2e, docs, WALK-02]
requires:
  - "13-04 (runTypecheck reference-walk wired: solution tsconfig -> per-leaf walk)"
provides:
  - "WALK-02 default-input hashing: the angular-typecheck walk-target caches on the lib+spec source union, so a spec-only edit busts the coarse single-target cache instead of replaying a stale PASS"
  - "cache-e2e proof (spec-only edit -> cache MISS) for the WALK-02 hashing contract"
  - "README single-target walk recipe + caching guidance for consumers"
affects:
  - "nx.json targetDefaults (both angular-typecheck executor-id keys)"
  - "e2e/angular-typechecker-cache-e2e (new scenario spec)"
  - "libs/typecheck-walk-consumer (new fixture library)"
  - "README.md"
tech-stack:
  added: []
  patterns:
    - "cache-busts-on-* e2e harness: per-run isolated NX_CACHE_DIRECTORY, NX_DAEMON off, R1 pre-flight `nx show target inputs --check`, byte-restore from a committed .pristine sidecar"
    - "solution-tsconfig walk fixture: references-only tsconfig.json -> tsconfig.lib.json (excludes specs) + tsconfig.spec.json (includes specs), inline-declared test globals (no test-runner types)"
key-files:
  created:
    - "packages/angular-typechecker/src/core/nx-target-defaults.spec.ts"
    - "libs/typecheck-walk-consumer/tsconfig.json"
    - "libs/typecheck-walk-consumer/tsconfig.lib.json"
    - "libs/typecheck-walk-consumer/tsconfig.spec.json"
    - "libs/typecheck-walk-consumer/src/index.ts"
    - "libs/typecheck-walk-consumer/src/lib/walk-consumer.component.ts"
    - "libs/typecheck-walk-consumer/src/lib/walk-consumer.component.spec.ts"
    - "libs/typecheck-walk-consumer/src/lib/walk-consumer.component.spec.ts.pristine"
    - "libs/typecheck-walk-consumer/package.json"
    - "libs/typecheck-walk-consumer/project.json"
    - "e2e/angular-typechecker-cache-e2e/src/cache-busts-on-spec-edit.int.spec.ts"
  modified:
    - "nx.json"
    - "README.md"
decisions:
  - "Swapped BOTH walk-target-default keys (dev-workspace `angular-typechecker:angular-typecheck` AND published-package `@angular-typechecker/angular-typechecker:angular-typecheck`), not one, because there is no bare `angular-typecheck` targetDefaults key -- the two executor-id forms are the same executor's defaults for the local repo vs an installed consumer and both must carry the WALK-02 shape."
  - "Added a NEW `typecheck-walk-consumer` fixture library (solution tsconfig + spec leaf) rather than repurposing `typecheck-consumer` (whose leaf tsconfig + includeDeps the existing executor-parity / dep-error specs depend on), keeping those specs byte-unchanged."
  - "Reused the in-workspace cache-e2e harness (real nx CLI + project graph) exactly, NOT Verdaccio and NOT a new e2e project, per the plan."
requirements-completed: [WALK-02]
metrics:
  duration: "~35 min"
  completed: "2026-07-01"
  tasks: 3
  files: 13
---

# Phase 13 Plan 06: WALK-02 default-input hashing + cache proof + README walk recipe Summary

Swap the `angular-typecheck` walk-target Nx input from `production` to the `default` named input so `*.spec.ts` sources hash into the coarse single-target cache key (a spec-only edit busts the cache instead of replaying a stale PASS), prove it with a cache-e2e scenario, and document the single-target walk recipe in the README.

## What was built

### Task 1 -- nx.json `production` -> `default` swap + manifest assertion (commit a062a16)

Replaced `"production"` with `"default"` in the `inputs` array of BOTH `angular-typecheck` walk-target-default blocks in `nx.json` (`angular-typechecker:angular-typecheck` and `@angular-typechecker/angular-typechecker:angular-typecheck`), retaining `outputs: []`, the `{projectRoot}/tsconfig*.json` glob, and `^default`. Added `packages/angular-typechecker/src/core/nx-target-defaults.spec.ts` -- a pure filesystem-read manifest spec that, for each of the two walk-target keys, asserts `inputs` contains `default` and NOT `production`, retains the tsconfig glob and `^default`, and `outputs === []`.

Rationale (L-5 / Spike 005 / WALK-02): the `production` named input EXCLUDES `*.spec.ts` (its `!...spec|test...` + `!tsconfig.spec.json` negations). With the walk now type-checking the spec leaf, a spec-only change under `production` would not change the input hash and the coarse single-target cache would replay a stale PASS. `default` (the lib+spec source union) is the correct coarse input.

### Task 2 -- cache-e2e proof that a spec-only edit busts the cache (commit c34398f)

Added the `typecheck-walk-consumer` fixture library: a references-only solution `tsconfig.json` whose `references[]` include `tsconfig.lib.json` (excludes specs) and `tsconfig.spec.json` (includes specs), with a clean lib source (`walk-consumer.component.ts`) and a clean spec source (`walk-consumer.component.spec.ts` + a byte-identical `.pristine` sidecar). Its `project.json` wires one `angular-typecheck` target pointed at the SOLUTION `tsconfig.json`, so one walk type-checks both leaves. Test globals are declared inline in the spec (no test-runner types needed).

Added `e2e/angular-typechecker-cache-e2e/src/cache-busts-on-spec-edit.int.spec.ts`, mirroring the existing `cache-busts-on-dep-error` harness (per-run isolated `NX_CACHE_DIRECTORY`, `NX_DAEMON=false`, `FORCE_COLOR=0`, NX runner-env stripping, R1 pre-flight `nx show target inputs --check`, byte-restore from pristine). It proves: green run #1 -> run #2 CACHE HIT -> edit ONLY the `*.spec.ts` source (inject a self-contained TS2322) -> run #3 CACHE MISS (marker absent + TS2322 present + non-zero exit), plus a `--skip-nx-cache` anti-lying differential. The R1 pre-flight confirms the spec source IS an input under `default` -- the exact check a `production` input would fail.

### Task 3 -- README single-target walk recipe (commit 7f431b4)

Added a "Type-check an Angular project (single-target walk recipe)" section to `README.md`: wire ONE `angular-typecheck` target per project pointed at the project's SOLUTION `tsconfig.json`; the engine walks the in-project referenced leaves (lib/app + `tsconfig.spec.json`) in one run and returns the complete, duplicate-free diagnostic set -- no per-project-type detection and no separate spec target. Documented the WALK-02 caching guidance (`default` input so spec sources hash, `outputs: []`, the `{projectRoot}/tsconfig*.json` glob, `^default`) with a `project.json` + `nx.json` example. No Phase 14 generator content. ASCII-only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan's `targetDefaults["angular-typecheck"]` key does not exist**
- **Found during:** Task 1
- **Issue:** The plan objective and its `<automated>` verify gate both reference `n.targetDefaults['angular-typecheck']`, but `nx.json` has no bare `angular-typecheck` key. The actual walk-target-default keys are `angular-typechecker:angular-typecheck` (dev workspace) and `@angular-typechecker/angular-typechecker:angular-typecheck` (published package). The plan's node gate would throw a TypeError (reading `.inputs` of `undefined`).
- **Fix:** Applied the `production` -> `default` swap to BOTH executor-id keys (same executor's defaults for local vs installed contexts) and wrote the manifest spec + the run node gate against the real keys. The intent (L-5 / WALK-02: spec sources must hash) is satisfied for both.
- **Files modified:** nx.json, packages/angular-typechecker/src/core/nx-target-defaults.spec.ts
- **Commit:** a062a16

**2. [Rule 1 - Bug] Pre-existing non-ASCII emoji in the stock README broke the Task 3 ASCII gate**
- **Found during:** Task 3
- **Issue:** The README carried stock Nx-generated boilerplate with a sparkle emoji on line 5 (6 non-ASCII bytes). Task 3's acceptance criterion requires the README be ASCII-only and its `<automated>` gate to pass; the emoji failed it.
- **Fix:** Replaced the emoji line with an ASCII-only equivalent (also mandated by the CLAUDE.md/AGENTS.md ASCII-only rule). Minimal, in-scope, on the file this task owns.
- **Files modified:** README.md
- **Commit:** 7f431b4

### Plan-substrate note (not a code change)

The plan's Task 2 `read_first` describes the cache-e2e harness as "tarball-install/junction" and instructs to "reuse the existing project's tarball-install/junction mechanics". In fact `angular-typechecker-cache-e2e` uses in-workspace fixture libraries (`typecheck-consumer` / `typecheck-consumer-dep`) driven through the real `nx run` CLI + project graph -- there is NO tarball install in this e2e project (the tarball tier lives in `angular-typechecker-install-e2e` / `-matrix-e2e`). The plan's overriding directive ("mirror the existing harness exactly; no Verdaccio; no new e2e project") was followed against the harness as it actually exists.

## Authentication Gates

None.

## Known Stubs

None. The walk-consumer lib and spec sources are real, clean, type-checked fixtures (proven by the green baseline run and the injected-error run surfacing TS2322).

## Verification

- `node -e` gate on `nx.json` (both walk-target keys): OK (`default` present, `production` absent, `{projectRoot}/tsconfig*.json` glob + `^default` + `outputs: []` retained).
- `NX_DAEMON=false npx nx test angular-typechecker --skip-nx-cache`: green -- 26 test files, 200 tests (includes the new `nx-target-defaults.spec.ts`; no regression).
- `NX_DAEMON=false npx nx test angular-typechecker-cache-e2e --skip-nx-cache`: green -- 3 test files, 9 tests (includes the new `cache-busts-on-spec-edit.int.spec.ts`: R1 pre-flight input check, green->HIT->spec-edit->MISS, anti-lying differential).
- README `node -e` ASCII gate: OK (`tsconfig.json` present, ASCII-only).
- Manual-only (VALIDATION): the README walk-recipe prose is written for consumer correctness -- documents pointing ONE target at the solution `tsconfig.json`, the walk over lib/app + spec leaves in one run, and the WALK-02 caching inputs; no Phase 14 generator content.

## Commits

- a062a16: feat(core): hash spec sources into the walk-target cache key
- c34398f: test(core): prove a spec-only edit busts the walk-target cache
- 7f431b4: docs(core): document the single-target walk recipe
- 652fc54: docs(13-06): complete WALK-02 caching + walk-recipe plan

## Self-Check: PASSED

All 12 created files exist on disk; all 4 commits (a062a16, c34398f, 7f431b4, 652fc54) are present in the git log; working tree clean.
