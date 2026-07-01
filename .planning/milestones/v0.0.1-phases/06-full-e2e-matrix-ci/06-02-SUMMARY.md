---
phase: 06-full-e2e-matrix-ci
plan: 02
subsystem: testing
tags: [nx, angular, e2e, tarball, npm, pnpm, symlink, realpath, ts2322, nxignore]

requires:
  - phase: 05-packaging-publish-hardening-e2e-smoke-mvp
    provides: the install-e2e harness (pack-to-tmp, buildCleanEnv, green+TS2322 4-way) + the B-03 clean-install honesty invariant
  - phase: 06-full-e2e-matrix-ci
    provides: 06-01's angular-typechecker-matrix-e2e project + the 5-type consumer-workspace fixture + the OQ-1 clean-install result
provides:
  - the 5-type matrix e2e spec (TEST-03) proving the installed tarball type-checks green + reports an injected TS2322 across application, local-lib, buildable-lib, publishable-lib, and the spec-tsconfig target
  - the pnpm symlinked-store e2e + realpath regression-guard (OUT-02 backstop) with the documented Windows fallback and the Linux-CI authoritative gate (RD-10)
  - a committed pnpm-lock.yaml (lockfileVersion 9.0, pnpm 11.9.0) for the fixture
  - DI-06-01 RESOLVED -- .nxignore removes the matrix-e2e fixtures from the main Nx graph so an unscoped nx run-many -t build (the release preVersionCommand) no longer fails on ng-packagr
affects: [06-05 ci.yml (the e2e job runs angular-typechecker-matrix-e2e Linux-only), Phase 7 release cut (the release preVersionCommand build is now clean)]

tech-stack:
  added: []
  patterns:
    - 'Install-once multi-project consumer fixture, it.each over the project-type targets (D-07): one Angular+Nx install reused across 5 type rows'
    - 'Per-row context-correct injection: a class FIELD for component sources, a const STATEMENT for the spec-function-body row (same TS2322 outcome, different syntactic context)'
    - '.nxignore excludes an installed-consumer fixture subdir from the host project graph while keeping the owning e2e project in the graph for its test target'
    - 'pnpm-symlink realpath PROBE gates the boundary-crossing regression-guard; documented Windows fallback (Git Bash ln -s copies) defers the true teeth to the Linux CI leg'

key-files:
  created:
    - 'e2e/angular-typechecker-matrix-e2e/src/matrix-5types.int.spec.ts'
    - 'e2e/angular-typechecker-matrix-e2e/src/pnpm-symlink.int.spec.ts'
    - 'e2e/angular-typechecker-matrix-e2e/fixtures/consumer-workspace/pnpm-lock.yaml'
    - '.nxignore'
  modified:
    - 'e2e/angular-typechecker-matrix-e2e/fixtures/consumer-workspace/libs/local-lib/tsconfig.spec.json (types:[node] -> types:[] -- the consumer installs no @types/node)'
    - '.planning/phases/06-full-e2e-matrix-ci/deferred-items.md (DI-06-01 marked RESOLVED)'

key-decisions:
  - "DI-06-01 fixed via .nxignore on the fixtures subdir (remediation #2), not by re-scoping the release preVersionCommand (#1): the fixture projects are an installed-consumer workspace and should never have been members of THIS repo's project graph."
  - "The matrix spec runs each nx run with --skip-nx-cache: the cacheable target's `production` input EXCLUDES *.spec.ts, so mutating the spec-row source would NOT bust the cache and the injected spec run would be served the cached GREEN (a false PASS). Cache-correctness is the separate cache-e2e project's concern."
  - 'pnpm add uses --config.frozen-lockfile=false (pnpm add rejects the install-only --no-frozen-lockfile flag); the local pnpm install is a COPY/junction layout (Windows arm64) so the realpath regression-guard takes its documented fallback locally and is authoritatively validated on the Linux CI draft-PR leg (RD-10).'

patterns-established:
  - '5-type e2e matrix: install the freshly-packed tarball ONCE into one consumer-workspace, it.each over the project-type targets, green + injected-TS2322 4-way per type.'

requirements-completed: [TEST-03]

duration: ~25min
completed: 2026-06-29
---

# Phase 6 (Plan 02): 5-type matrix e2e + pnpm symlink guard + DI-06-01 fix

**Authored and PASSED (locally, Windows arm64) the two `angular-typechecker-matrix-e2e` specs that close TEST-03 -- the installed-tarball type-check is green + reports an injected TS2322 across all five Angular project types (application, local/buildable/publishable libraries, and the spec tsconfig) and under both the npm hoisted and pnpm symlinked node_modules layouts -- and resolved DI-06-01 by excluding the matrix fixtures from the main Nx graph so an unscoped `nx run-many -t build` is green again.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-06-29
- **Tasks:** 2 plan tasks + 1 folded-in fix (DI-06-01)
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments

- **TEST-03 (5-type matrix):** `matrix-5types.int.spec.ts` packs the fresh dist, installs the tarball ONCE into a tmp consumer-workspace (clean: empty `.npmrc`, non-existent `npm_config_userconfig`, no `legacy-peer-deps` -- B-03 honesty), and `it.each` over the five committed targets asserts GREEN (exit 0) then an injected TS2322 (non-zero exit + the full `TS2322` token + no `ERR_REQUIRE_ESM` + no `infrastructure error`). The spec-tsconfig row injects into `local-lib.component.spec.ts` so the error provably lands in the spec file set.
- **OUT-02 backstop (pnpm):** `pnpm-symlink.int.spec.ts` installs the tarball via `pnpm add` so the package lands in pnpm's `.pnpm/` store, runs `app:angular-typecheck` (`includeDeps:true`) green + injected, and a `lstatSync`/`realpathSync` PROBE gates the boundary-crossing realpath regression-guard with the documented Windows fallback.
- **DI-06-01 RESOLVED:** added `.nxignore` excluding `e2e/angular-typechecker-matrix-e2e/fixtures/`; the main graph no longer discovers the nested `app`/`local-lib`/`buildable-lib`/`publishable-lib` projects, so `nx run-many -t build` (the release `preVersionCommand`) runs 2 real projects green instead of failing on `ng-packagr`. The owning `angular-typechecker-matrix-e2e` project stays in the graph for its `test` target.
- **Local e2e run PASSED:** `npx nx run-many -t test -p angular-typechecker-matrix-e2e --skip-nx-cache` -> `Test Files 2 passed (2)`, `Tests 7 passed (7)`, 82.41s, exit 0 on Windows arm64.

## Task Commits

1. **DI-06-01: exclude matrix-e2e fixtures from the main Nx graph** - `99435b6` (fix)
2. **Task 1: 5-type matrix e2e against the installed tarball** - `db884fc` (test)
3. **Task 2: pnpm symlinked-store e2e + realpath guard + lockfile** - `235dfa6` (test)
4. **Rule 1 fixes (npm lockfile + pnpm add flag)** - `5dde2c0` (fix)
5. **Rule 1 fixes (spec-tsconfig green + per-row injection)** - `0b629b3` (fix)
6. **Rule 1 fix (--skip-nx-cache busts the spec-row cache)** - `e590884` (fix)

## Files Created/Modified

- `e2e/angular-typechecker-matrix-e2e/src/matrix-5types.int.spec.ts` - the 5-type install-once matrix e2e (TEST-03)
- `e2e/angular-typechecker-matrix-e2e/src/pnpm-symlink.int.spec.ts` - the pnpm symlinked-store e2e + realpath probe-gated regression-guard (OUT-02)
- `e2e/angular-typechecker-matrix-e2e/fixtures/consumer-workspace/pnpm-lock.yaml` - committed lockfile (v9.0, pnpm 11.9.0) for reproducible pnpm install
- `.nxignore` - excludes the matrix-e2e fixtures subdir from the host project graph (DI-06-01)
- `.../libs/local-lib/tsconfig.spec.json` - `types:[node]` -> `types:[]` (the consumer installs no `@types/node`)
- `.planning/phases/06-full-e2e-matrix-ci/deferred-items.md` - DI-06-01 marked RESOLVED

## Decisions Made

- **DI-06-01 via `.nxignore`** (remediation #2), not preVersionCommand re-scoping (#1): the narrowest, most correct fix -- the fixtures are an installed-consumer workspace, not graph members.
- **`--skip-nx-cache` per `nx run`** in the matrix spec: the cacheable target's `production` input excludes `*.spec.ts`, so a spec-file mutation does not bust the cache; without the flag the injected spec run would false-PASS on the cached green.
- **`pnpm add --config.frozen-lockfile=false`**: `pnpm add` rejects the install-only `--no-frozen-lockfile`; the `--config.<key>=<value>` escape overrides CI auto-frozen mode.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] npm matrix consumer left the committed pnpm-lock.yaml in place**

- **Found during:** Task 1 (first verification run)
- **Issue:** the npm-install tmp consumer carried the committed `pnpm-lock.yaml`; Nx's `js/dependencies-and-lockfile` plugin tried to parse it and hard-failed the project graph (`Could not find .modules.yaml` -- no `.pnpm/` store under an npm install), so every `nx run` exited 1 before the executor started (all 5 rows failed the green assertion).
- **Fix:** `rmSync` the `pnpm-lock.yaml` from the npm-install tmp copy after `cpSync`, keeping it a pure npm hoisted layout.
- **Verification:** the 4 component rows + spec row green assertion then passed.
- **Committed in:** `5dde2c0`

**2. [Rule 1 - Blocking] `pnpm add --no-frozen-lockfile` is an invalid flag**

- **Found during:** Task 2 (first verification run)
- **Issue:** `pnpm add <tgz> --no-frozen-lockfile` errored `Unknown option: 'frozen-lockfile'` (that is an `install`-only flag), so the pnpm `beforeAll` install threw and skipped both pnpm tests.
- **Fix:** use `pnpm add <tgz> --config.frozen-lockfile=false --ignore-scripts` (the `--config.<key>=<value>` escape that `pnpm add` accepts and that overrides CI auto-frozen mode).
- **Verification:** standalone `pnpm add` of a fresh tarball exited 0 with `executors.json` present; both pnpm tests then passed.
- **Committed in:** `5dde2c0`

**3. [Rule 1 - Bug] spec-tsconfig GREEN baseline failed (TS2688 'Cannot find type definition file for node')**

- **Found during:** Task 1 (second verification run)
- **Issue:** the committed `local-lib/tsconfig.spec.json` (from 06-01) declared `types:["node"]`, but the consumer-workspace installs no `@types/node`, so `ngc` reported `TS2688` even on the committed-CLEAN spec file -- the spec-tsconfig green run exited 1.
- **Fix:** change `types:["node"]` -> `types:[]`. The spec file declares its own ambient `describe`/`it`/`expect` and uses no Node APIs, so it type-checks clean while preserving the distinct `*.spec.ts` file set as the check baseline.
- **Verification:** spec target green RC=0 in a fresh install.
- **Committed in:** `0b629b3`

**4. [Rule 1 - Bug] spec-row TS2322 injection used a class-field declaration in a function body**

- **Found during:** Task 1 (second verification run)
- **Issue:** the matrix spec injected `readonly broken: number = 'str';` (a class field) into ALL rows, but the spec row's injection point is inside the `it()` callback where a `readonly` field is a SYNTAX error -- masking the intended TS2322 (the injected run returned exit 0).
- **Fix:** carry a per-row `injectedLine`: a class FIELD for the 4 component rows, a `const` STATEMENT (`const broken: number = 'str';`) for the spec-function-body row.
- **Verification:** spec target injected RC=1 with `TS2322` in a fresh install.
- **Committed in:** `0b629b3`

**5. [Rule 1 - Bug] the cacheable target served the cached GREEN for the injected spec run**

- **Found during:** Task 1 (third verification run)
- **Issue:** the spec-tsconfig green now passed but the INJECTED assertion failed (`expected +0 not to be +0`): the cacheable `angular-typecheck` target's `production` input EXCLUDES `*.spec.ts`, so mutating `local-lib.component.spec.ts` did not change the cache key and Nx served the cached green (exit 0) for the injected run.
- **Fix:** add `--skip-nx-cache` to the `run()` helper in both specs so each green/injected invocation really executes the executor (cache-correctness is the separate cache-e2e project's concern).
- **Verification:** full suite `Tests 7 passed (7)`, exit 0.
- **Committed in:** `e590884`

---

**Total deviations:** 5 auto-fixed (all Rule 1 -- bugs/blocking surfaced by the heavy e2e run). Plus the planned folded-in DI-06-01 fix.
**Impact on plan:** All five were genuine correctness defects in the freshly-authored specs or the latent 06-01 fixture (`types:[node]`) that the heavy install-and-run surfaced; without them the spec would have lied (false PASS on the injected runs) or failed to run at all. No scope creep -- every fix is inside the two authored specs, their fixture, or the DI-06-01 `.nxignore`.

## Issues Encountered

- The verification run is heavy (real `nx build` + `npm pack` + one Angular 22 + Nx 23 `npm install` + a `pnpm add` + 7 real executor runs with `--skip-nx-cache`); ~82s on Windows arm64. This is expected, not a failure.
- The injected-error rows log Nx `Running target ... failed` + a "flaky task" hint to stdout -- that is the EXPECTED non-zero exit the spec captures via `execSync`'s catch; the Vitest summary (`Tests 7 passed (7)`) is the authority.

## Local run vs authoritative gate

- **Local (Windows arm64): PASSED in full** -- all 5 npm matrix rows green+injected, both pnpm tests green (the pnpm install is a COPY/junction layout locally, so the realpath regression-guard took its documented fallback -- "the symlinked layout simply works" -- per B-02 / Pitfall 1).
- **Authoritative cross-boundary teeth (RD-10):** the pnpm `.pnpm/` boundary-crossing realpath guard is truly exercised on the Linux CI leg via the 06-05 draft PR, where pnpm creates real boundary-crossing symlinks. The load-bearing realpath unit coverage already lives in 06-03 (`filter-diagnostics.spec.ts` mixed-case + store-dir generality).

## Self-Check: PASSED

- Created files present: `matrix-5types.int.spec.ts`, `pnpm-symlink.int.spec.ts`, `pnpm-lock.yaml`, `.nxignore`, `06-02-SUMMARY.md` -- all FOUND.
- Task commits present in git: `99435b6`, `db884fc`, `235dfa6`, `5dde2c0`, `0b629b3`, `e590884` -- all FOUND.
- Local e2e run: `Tests 7 passed (7)`, exit 0.

## Next Phase Readiness

- TEST-03 is satisfied locally; the matrix-e2e project is ready for the 06-05 Linux-only `e2e` CI job (`nx run-many -t test -p angular-typechecker-install-e2e angular-typechecker-cache-e2e angular-typechecker-matrix-e2e`).
- DI-06-01 resolved -> the Phase 7 release cut's `preVersionCommand` build is clean.
- Remaining Phase 6 plan: 06-05 (`ci.yml` lean 6-cell matrix + Linux-only e2e + act-compat + lint-workflows + aggregate `ci` gate).

---

_Phase: 06-full-e2e-matrix-ci_
_Completed: 2026-06-29_
