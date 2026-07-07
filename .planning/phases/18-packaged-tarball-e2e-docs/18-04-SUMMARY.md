---
phase: 18-packaged-tarball-e2e-docs
plan: 04
subsystem: testing
tags: [nx-plugin, e2e, verdaccio, storybook, angular, tarball, packaging, criterion-1]

# Dependency graph
requires:
  - phase: 17-input-set-membership-boundary-layout-support
    provides: the input-set-membership boundary fix (Layout A + B, branch 4a external-template keep, split suppressed counter) the e2e exercises through the shipped artifact
  - phase: 18-packaged-tarball-e2e-docs (18-01/18-03)
    provides: the D-01 notTypeCheckedDeclaredFiles advisory engine + executor render present in the packed dist
provides:
  - Committed generator-shaped Storybook consumer fixtures (Layout A per-project scaffold; Layout B centralized host with aggregated cross-project stories + external templateUrl)
  - storybook-tarball.int.spec.ts -- SB-06 criterion 1: the SHIPPED (published-to-Verdaccio) artifact catches a planted story error via nx add + nx g configuration + nx typecheck, on both layouts
affects: [phase-18 verification, phase-18 docs (SB-07), milestone v0.1.2 close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Packaged-tarball criterion-1 proof: Verdaccio nx add install of the SHIPPED dist + committed generator-shaped Storybook fixtures + runtime planted-error injection"
    - "Install-order honesty: install OUR package into a Storybook-free tree first (override-free peer check), force-install @storybook/angular --legacy-peer-deps LAST"

key-files:
  created:
    - e2e/angular-typechecker-install-e2e/fixtures/consumer-storybook-a/** (Layout A)
    - e2e/angular-typechecker-install-e2e/fixtures/consumer-storybook-b/** (Layout B centralized host)
    - e2e/angular-typechecker-install-e2e/src/storybook-tarball.int.spec.ts
  modified: []

key-decisions:
  - "Verdaccio nx add install path (RQ3 Open-Q1) -- the literal criterion-1 sequence; global-setup already publishes dist to Verdaccio"
  - "Install angular-typechecker BEFORE Storybook (order swap from the research recipe) so nx add (which forwards no flags) checks OUR peers against a Storybook-free tree and does NOT abort on Storybook's KNOWN foreign peer cap -- while preserving B-03 (no override on our install)"
  - "skipLibCheck:false on the .storybook leaf + main.ts importing @storybook/angular so the forced-SB10 .d.ts errors actually fire and are node_modules-suppressed (non-vacuous clean-baseline proof)"
  - "Stories use a local interface Story (no @storybook/angular import) so planted errors are the ONE deliberate diagnostic; DISTINCT tokens per layout (A=TS2322, B=TS2345+NG8002)"

patterns-established:
  - "New e2e spec is a FILE inside angular-typechecker-install-e2e (never a new project) -- inherits singleFork/serialization + shared dist/Verdaccio (shared-tarball race avoidance)"
  - "Layout B host is a subdir Nx project so the aggregated sources are a SIBLING outside the host base dir -- reached only via input-set membership (the motivating false-pass case)"

requirements-completed: [SB-06]

# Metrics
duration: ~40min (two heavy e2e runs)
completed: 2026-07-06
---

# Phase 18 Plan 04: Packaged-tarball Storybook e2e (criterion 1) Summary

**The SHIPPED (Verdaccio-published) angular-typechecker artifact, installed via `nx add` + `nx g configuration` + `nx typecheck` into committed generator-shaped Storybook consumers, catches a planted Layout-A story TS2322 and a Layout-B aggregated TS2345 + external-template NG8002 -- clean baselines pass, no ERR_REQUIRE_ESM, no infrastructure error.**

## Performance

- **Duration:** ~40 min (dominated by two full heavy e2e runs: build + publish + real Storybook installs + nested nx)
- **Completed:** 2026-07-06
- **Tasks:** 3
- **Files created:** 19 (9 Layout-A fixture files, 9 Layout-B fixture files, 1 spec)

## Accomplishments
- **Criterion 1 PROVEN on the shipped artifact** (not just the local build): both layouts catch planted errors through the full `nx add` + `nx g angular-typechecker:configuration` + `nx typecheck` sequence against the freshly-published Verdaccio dist.
- **Layout A** (per-project scaffold): clean baseline exits 0; planted `*.stories.ts` string->number gives a non-zero exit carrying the distinct full `TS2322` token.
- **Layout B** (centralized host, the motivating silent-false-pass case): aggregated cross-project story + component live OUTSIDE the host base dir, reached only via the widened `.storybook` include; planted aggregated `TS2345` AND the external-`templateUrl` `NG8002` (with `.html`/component codeframe via branch 4a) both FAIL the verdict.
- **B-03 install honesty preserved:** only `@storybook/angular@10.4.6` used `--legacy-peer-deps`; the angular-typechecker install carried NO peer override (`buildCleanEnv({ stripAllNpmConfig: true })` + a nonexistent `npm_config_userconfig`).
- **Forced-SB10 suppression proof is non-vacuous:** `skipLibCheck:false` + `main.ts` importing `@storybook/angular` means the SB10 `.d.ts` errors actually fire and are node_modules-suppressed; the clean baseline exit 0 proves they never leak in-project.

## Task Commits

Each task was committed atomically:

1. **Task 1: Layout-A Storybook consumer fixture** - `aafde71` (test)
2. **Task 2: Layout-B centralized-host Storybook consumer fixture** - `2eb8fc1` (test)
3. **Task 3: storybook-tarball.int.spec.ts (criterion 1, both layouts)** - `bdcbb75` (test)

**Plan metadata:** (this SUMMARY + STATE + ROADMAP) committed separately.

## Files Created/Modified
- `e2e/.../fixtures/consumer-storybook-a/**` - Runnable root-project Nx workspace: pinned deps, solution `tsconfig.json` referencing `tsconfig.app.json` + `.storybook/tsconfig.json`, `.storybook/main.ts` (imports `@storybook/angular`), clean `button.stories.ts` with a labelled anchor.
- `e2e/.../fixtures/consumer-storybook-b/**` - Layout-B: `storybook-host` subdir project (solution references only `./.storybook/tsconfig.json`), widened `.storybook` include reaching `../../aggregated-ui/**/*.ts`; `aggregated-ui/` sibling with an external-`templateUrl` component (`.html` anchor for NG8002) and an aggregated story (anchor for TS2345).
- `e2e/.../src/storybook-tarball.int.spec.ts` - The criterion-1 proof: two `it` blocks sharing an install helper; header comment states the resolved Verdaccio `nx add` path and the install-order rationale.

## Decisions Made
- **Verdaccio `nx add` install path** (RQ3 Open-Q1 RESOLVED) - the most literal criterion-1 sequence; global-setup already publishes dist to Verdaccio, so no per-spec `npm pack` race.
- **skipLibCheck:false on the `.storybook` leaf** - to make the forced-SB10 suppression proof non-vacuous (the 48 SB10 `.d.ts` errors fire and are node_modules-suppressed rather than never generated).
- **DISTINCT tokens per layout** (A=`TS2322`, B=`TS2345`+`NG8002`) - so a single stdout token cannot false-attribute across layouts (Pitfall 6).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Install order swapped: angular-typechecker BEFORE Storybook**
- **Found during:** Task 3 (first e2e run)
- **Issue:** The research recipe installed `@storybook/angular --legacy-peer-deps` FIRST, then `nx add angular-typechecker` with NO override. `nx add` forwards no flags, so its `npm install -D angular-typechecker@latest` re-resolved the WHOLE tree and hit @storybook/angular's KNOWN peer cap (`@angular-devkit/build-angular >=18 <22` -> `typescript >=5.9 <6.0`, conflicting with TS 6.0.3) -> ERESOLVE that aborted `nx add`. This is a FOREIGN (Storybook) conflict, NOT a conflict on angular-typechecker's own peers.
- **Fix:** Install fixture deps -> `nx add angular-typechecker` (NO override, into a Storybook-free tree so OUR peers are honestly checked) -> force-install `@storybook/angular --legacy-peer-deps` LAST. Preserves B-03 exactly: our install remains override-free and would ERESOLVE if OUR peer range were broken; the override stays scoped to Storybook only.
- **Files modified:** e2e/.../src/storybook-tarball.int.spec.ts (header note + helper order)
- **Verification:** Both `it` blocks pass on the re-run; no ERESOLVE on our install.
- **Committed in:** `bdcbb75` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** Order swap is the correct root-cause fix and STRENGTHENS B-03 honesty (our peers are checked against a clean tree). No scope creep; no assertion weakened.

## Issues Encountered

**Known-local, OUT-OF-SCOPE: `nx-add-yarn.int.spec.ts` ECONNREFUSED (NOT fixed).**
The wave run of `npx nx test angular-typechecker-install-e2e` (the CLI filter did not restrict, so all 10 e2e spec files ran) reported **9/10 spec files passed, 33/34 tests passed**. The ONLY failure was the pre-existing `nx-add-yarn.int.spec.ts`: corepack `yarn 4.17.0` completed its Resolution step (269 packages) but its Fetch step threw `RequestError` / `AggregateError [ECONNREFUSED]` against the local Verdaccio. This is a corepack-yarn-4 + local-Verdaccio fetch flake, unrelated to this plan's additive changes (my new spec + fixtures passed; the yarn spec runs in its own isolated tmp workspace and never references them). Per AGENTS.md the CI e2e gate is Linux-only; this is a local-Windows-only observation. Logged in `deferred-items.md`; re-evaluate at the phase wave gate / on CI. Do NOT mark SB-06 milestone-complete (shared across plans; closes at phase verification).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Criterion 1 (SB-06) is proven on the shipped artifact for both layouts.
- Remaining Phase 18 work (other plans): SB-07 docs (README Storybook section + Limitations WR-01 fix + CHANGELOG 0.1.2 prose). Do NOT run `nx release` (D-05).
- Wave gate `npx nx run-many -t test --parallel=1` should be re-run on a clean network / CI to clear the environmental yarn ECONNREFUSED.

## Self-Check: PASSED

- All fixtures + spec + SUMMARY + deferred-items present on disk.
- Task commits `aafde71`, `2eb8fc1`, `bdcbb75` present in history.
- Spec run: both `it` blocks green (Layout A `TS2322`; Layout B `TS2345` + `NG8002`); clean baselines exit 0; no `ERR_REQUIRE_ESM`; no `infrastructure error`.

---
*Phase: 18-packaged-tarball-e2e-docs*
*Completed: 2026-07-06*
