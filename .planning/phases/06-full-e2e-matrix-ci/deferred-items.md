# Phase 6 -- Deferred Items

Out-of-scope discoveries logged during execution. NOT fixed in the discovering plan
(SCOPE BOUNDARY: only auto-fix issues directly caused by the current task's changes).

## DI-06-01: `nx release --dry-run` pre-version build fails on the 06-01 fixtures

- **Discovered during:** 06-04 (the RD-07 `release.yml` `if:` gate plan), running the
  required `nx release --dry-run` sanity check.
- **Symptom:** `npx nx release --dry-run` fails in its `preVersionCommand`
  (`npx nx run-many -t build`) with `Cannot find module 'ng-packagr'` on the projects
  `buildable-lib:build` and `publishable-lib:build`. The dry-run therefore never reaches
  the version/changelog preview (it fails before version computation; nothing is pushed
  or published -- the failure is upstream of any release write).
- **Root cause:** 06-01 committed the matrix-e2e consumer-workspace fixtures under
  `e2e/angular-typechecker-matrix-e2e/fixtures/consumer-workspace/libs/{buildable-lib,
  publishable-lib}`. By OQ-1 design these declare `@nx/angular:ng-packagr-lite` /
  `@nx/angular:package` build targets WITHOUT adding `@nx/angular`/`ng-packagr` to the
  dev repo (the executor never RUNS those builds -- it only reads each project's
  `tsConfig`). `ng-packagr` is consequently not installed (`node_modules/ng-packagr`
  absent). These fixture projects are members of the dev-repo project graph, so the
  release `preVersionCommand`'s UNSCOPED `nx run-many -t build` sweeps them in and fails.
- **Why out of scope for 06-04:** 06-04 edits ONLY `.github/workflows/release.yml` (the
  publish-job `if:` ref gate). `release.yml` is not consumed by `nx build`; this failure
  is independent of the edit and pre-exists it. `nx.json` `release.git.push:false` +
  `createRelease:false` + `release.projects:["angular-typechecker"]` are all intact and
  untouched.
- **Candidate remediations (NOT applied here -- a maintainer/owning-plan call):**
  1. Scope the release `preVersionCommand` to the published project, e.g.
     `npx nx run angular-typechecker:build` (or `run-many -t build -p angular-typechecker`),
     so fixture build targets are never invoked by a release cut.
  2. Mark the fixture build targets so `run-many -t build` skips them, or exclude the
     fixture projects from the default build sweep.
  3. Install `ng-packagr` as a dev dependency (REJECTED-by-default: re-introduces the
     OQ-1 `@nx/angular`-in-fixtures concern the design deliberately avoids).
- **Impact on 06-04 verification:** The OIDC/permissions/environment model is proven
  unchanged by the release-hygiene regression spec (15/15 green) + the comment-stripped
  structural assertion. The `nx release --dry-run` step proved nothing is pushed/published
  (it halts in the pre-version build), but could NOT surface the version/changelog preview
  because of this pre-existing fixture build failure. Resolve before the next real release
  cut.
