---
phase: 24-real-oss-scaffolded-e2e-additive-only-audit-docs
plan: 03
subsystem: e2e
tags: [e2e, angular-cli, ng-add, ng-run, verdaccio, fixture, per-project-scoping, uat]

# Dependency graph
requires:
  - phase: 21-angular-cli-builder-engine-multi-tsconfig-gate-a-spike-go-no
    provides: the Angular CLI builder (convertNxExecutor) + ng run <project>:typecheck + multi-tsConfig array
  - phase: 22-configuration-schematic-the-angular-json-write-fork
    provides: the angular.json write-fork (per-project tsConfig-array target)
  - phase: 23-init-schematic-parity-first-party-ng-add
    provides: first-party ng-add auto-wire-all + the no-caching notice
provides:
  - "angular-typechecker-ng-cli-e2e: the 4th e2e project proving ng add -> ng run per-project scoping in CI (ACV-02)"
  - "a committed, pinned Angular 22 CLI workspace fixture (app + library) for deterministic offline e2e (RF-01 Option B)"
  - "24-ACV-01-UAT.md: the reproducible real-clone milestone-final gate procedure (ACV-01, manual)"
affects: [milestone-close, v0.2.1-verification, ci-e2e]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "4th e2e project mirrors install-e2e (verbatim Verdaccio global-setup, shared dist tarball, --parallel=1)"
    - "ng add -> ng run per-project scoping proof: distinct raw TS code per leaf (app TS2322 component + TS2345 spec vs library TS2554)"
    - "committed pinned Angular CLI fixture under e2e/<proj>/fixtures/ with committed package-lock.json + REGENERATE.md drift note"

key-files:
  created:
    - e2e/angular-typechecker-ng-cli-e2e/project.json
    - e2e/angular-typechecker-ng-cli-e2e/vitest.config.mts
    - e2e/angular-typechecker-ng-cli-e2e/tsconfig.json
    - e2e/angular-typechecker-ng-cli-e2e/tsconfig.spec.json
    - e2e/angular-typechecker-ng-cli-e2e/src/global-setup.ts
    - e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run.e2e.spec.ts
    - e2e/angular-typechecker-ng-cli-e2e/fixtures/ng-cli-workspace/ (committed pinned Ng22 app+lib scaffold, 33 files incl. REGENERATE.md + package-lock.json)
    - .planning/phases/24-real-oss-scaffolded-e2e-additive-only-audit-docs/24-ACV-01-UAT.md
  modified: []

key-decisions:
  - "RF-01 Option B: committed pinned Angular 22 fixture (ng new + ng g library, frozen on-stack), not a live npm init @angular@latest -- deterministic, offline, on-stack by construction"
  - "Current 4-guard contract satisfied: e2e + typecheck targets + type:e2e tag (CONTEXT D-03's typecheck-e2e is stale) -- GUARD-01/01b/01c/01d stay green, no ci.yml edit"
  - "Distinct raw TS code per leaf pins per-project scoping: app target catches TS2322 (component) + TS2345 (spec) but NOT the lib TS2554, and the lib target catches only TS2554"
  - "ACV-01 is a documented MANUAL/local gate (D-02): the clones are uncommitted; ACV-02 (this scaffolded e2e) is the CI-authoritative proof"
  - "Per-test timeout set to 600000ms as a CI-headroom margin (the local run was 94.6s); config testTimeout stays 300000ms"

patterns-established:
  - "Angular CLI e2e: local ngRun(cwd, target, env) helper mirrors test-util run() but shells `npx ng run` (captures stdout+exit without piping)"
  - "Auto-wire-all assertion: read angular.json architect.typecheck on every project (app + lib), assert builder id + the exact two-element tsConfig leaf array"

requirements-completed: [ACV-01, ACV-02]

# Metrics
duration: ~2h20m
completed: 2026-07-11
---

# Phase 24 Plan 03: Real-OSS + scaffolded Angular CLI e2e Summary

Shipped the CI-authoritative scaffolded Angular CLI e2e (`ng add angular-typechecker` ->
`ng run <project>:typecheck`, per-project scoping proven) plus the documented reproducible
real-clone milestone-final UAT procedure -- closing ACV-02 and ACV-01. Phase 24 adds only
test-infra + docs; no production surface changed (additive-only holds by construction).

## What was built

### Task 1 -- committed pinned Angular 22 fixture (RF-01 Option B) [`7f7365b`]
Generated a genuine `ng new ng-cli-workspace --defaults --skip-install --skip-git` + `ng
generate library my-lib` scaffold (Angular CLI 22.0.6), pinned `package.json`
(`@angular/cli ~22.0.6`, `@angular/* ^22.0.0`, `typescript ~6.0.3`), regenerated the committed
`package-lock.json` (TS resolves to 6.0.3, no `--legacy-peer-deps`), stripped
`node_modules/.angular/dist/.git`, and committed it under
`e2e/angular-typechecker-ng-cli-e2e/fixtures/ng-cli-workspace/` with a `REGENERATE.md` drift
note. The fixture carries an application (`ng-cli-workspace`) + a library (`my-lib`) -- the
app+lib shape the per-project-scoping proof needs -- and NO `.npmrc` with `legacy-peer-deps`.

### Task 2 -- the 4th e2e project satisfying the guard contract [`3e38133`]
Copied install-e2e's `project.json` / `vitest.config.mts` / `tsconfig.json` /
`tsconfig.spec.json` and the `global-setup.ts` VERBATIM (127.0.0.1 SAFETY gate + publish-once
via `nx release publish --first-release --excludeTaskDependencies`), changing only the name,
sourceRoot, reportsDirectory, cacheDir, and the typecheck command path. The project defines the
`e2e` + `typecheck` targets and the `type:e2e` tag, so it auto-joins `nx run-many -t e2e` /
`-t typecheck -p tag:type:e2e` with no ci.yml edit. `ci-e2e-coverage-guard.spec.ts`
(GUARD-01/01b/01c/01d) stays green with the 4th project present.

### Task 3 -- the ng add -> ng run per-project e2e (ACV-02) + the real-clone UAT (ACV-01) [`8f35f49`]
`ng-add-ng-run.e2e.spec.ts` copies the fixture to a tmp dir, writes a Verdaccio `.npmrc`,
`npm install`s the fixture deps (on-stack, no `--legacy-peer-deps`), runs
`npx ng add angular-typechecker --skip-confirmation` (resolved from Verdaccio), asserts BOTH
projects gained a `typecheck` architect target (builder `angular-typechecker:typecheck` +
the exact two-element `tsConfig` leaf array), runs a CLEAN baseline green for each, then plants
DISTINCT per-leaf errors and proves scoping: `ng run ng-cli-workspace:typecheck` reports its
own TS2322 (component) + TS2345 (spec) but NOT the library's TS2554, and
`ng run my-lib:typecheck` reports only TS2554 -- with no `ERR_REQUIRE_ESM` / infrastructure
error. `24-ACV-01-UAT.md` documents the manual real-clone gate against `bluehalo/ngx-leaflet`
@ `818e9ae` (app+lib) then `realworld-angular/realworld-angular` @ `9e3528f` (app-only), each by
URL + SHA with the pack -> `ng add` -> plant -> `ng run` -> assert -> clean steps.

## Verification

- `npx nx e2e angular-typechecker-ng-cli-e2e` -- PASS (1 test, real `ng add` + 4 `ng run`s, 94.6s).
- `npx nx test angular-typechecker` -- PASS (all guard specs green with the 4th e2e project present).
- `npx nx run angular-typechecker-ng-cli-e2e:typecheck` -- PASS (spec + global-setup compile).
- Working tree clean after the e2e (temp dirs cleaned; dist/tmp gitignored).

## Deviations from Plan

### Auto-fixed / adjusted (Rule 3 -- blocking-issue resolution + headroom)

**1. [Rule 3 - Tooling] Generated the fixture with the repo-installed `ng` binary.**
- **Found during:** Task 1. `npx ng new` / `npm init @angular@22` from an empty sandbox dir hit
  `npm error could not determine executable to run` (no local install to resolve `ng`).
- **Fix:** Invoked the repo's installed CLI directly:
  `node <repo>/node_modules/@angular/cli/bin/ng.js new ng-cli-workspace --defaults --skip-install --skip-git`,
  then `... generate library my-lib --skip-install`. Produces the identical CLI 22.0.6 scaffold.
- **Files:** the committed fixture. **Commit:** `7f7365b`.

**2. [Headroom] Per-test timeout raised to 600000ms.**
- The single e2e `it` does `npm install` (full Angular workspace) + `ng add` + 4 `ng run`s. The
  config `testTimeout` is 300000ms; the local run measured 94.6s, but the per-test override was
  set to 600000ms as a margin for slower CI hosts. The shared `vitest.config.mts` `testTimeout`
  is unchanged (300000ms).

### Not needed
- **Assumption A2 fallback (npm install `<tgz>` + `ng g :ng-add`) was NOT required** -- the
  primary `npx ng add angular-typechecker --skip-confirmation` resolved from Verdaccio and
  ran the ng-add schematic cleanly.

## Notes (informational)

- During the fixture `npm install`, npm 11 emitted advisory `allow-scripts` warnings for
  `esbuild`/`lmdb`/`@parcel/watcher` (deferred-script REVIEW notices, not blocks) -- scripts
  still ran and both `ng add` and every `ng run <project>:typecheck` succeeded. The typecheck
  builder runs the Angular compiler (no esbuild bundling), so it is unaffected regardless.
- No `--legacy-peer-deps` anywhere: on-stack Angular 22 installs clean (Pitfall D / T-24-07
  honesty proven -- a real ERESOLVE would have failed the test).

## Threat surface

No new shipped surface. The one network action (the e2e publish) is loopback-gated
(`http://127.0.0.1:` SAFETY gate, copied verbatim, re-asserted in the spec -- T-24-05); the
committed fixture ships first-party pinned Angular deps + a `package-lock.json` and no secret /
no peer-masking `.npmrc` (T-24-06); the tmp install strips all inherited `npm_config_*` (T-24-07).
No threat flags.

## Known Stubs

None. The scaffolded e2e exercises the real shipped tarball end-to-end; the ACV-01 UAT is an
intentionally manual/local gate (D-02, clones uncommitted) documented as a reproducible
procedure -- ACV-02 is its CI-authoritative counterpart.

## Self-Check: PASSED

All 10 created files verified present on disk; all three task commits (7f7365b, 3e38133,
8f35f49) verified in git history.
