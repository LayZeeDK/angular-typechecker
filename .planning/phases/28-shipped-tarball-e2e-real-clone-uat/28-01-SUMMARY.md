---
phase: 28-shipped-tarball-e2e-real-clone-uat
plan: 01
subsystem: testing
tags: [e2e, verdaccio, cli, exit-codes, spawnSync, npm, tarball]

# Dependency graph
requires:
  - phase: 27-bin-shell-cross-platform-packaging
    provides: the shipped two-name bin (angular-typechecker + atc) -> ./src/cli/bin.js and the frozen 0/1/2 exit-code contract this plan installs and observes
  - phase: 26-pure-cli-core-exit-code-wiring
    provides: the two-step exit-code compose (literal 2 for infra/usage) the .bin shim must faithfully carry
provides:
  - A new CI-authoritative e2e project (angular-typechecker-cli-e2e) that auto-discovers into the Linux dynamic CI matrix
  - runShim helper in @workspace/test-util (spawnSync over the PM .bin shim, cross-platform, literal status)
  - A bounded ECONNREFUSED/ECONNRESET retry in the shared mintCiToken (hardens the Windows Verdaccio start-up race)
  - Proof the shipped angular-typechecker + atc bins return literal 0/1/2 through the real npm .bin shim (+ npx angular-typechecker)
affects: [28-02 yarn e2e, 28-03 pnpm + Windows CI leg, 28-04 nx-free runtime probe, VER-04, VER-05 UAT]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "runShim: spawnSync over node_modules/.bin/<binName>[.cmd] reading the literal OS status (the shim IS the surface under test, never node bin.js)"
    - "Install BY NAME from Verdaccio (not pack-a-tgz) to sidestep the Windows/MSYS tar drive-letter gotcha"
    - "nx-free consumer fixture (no nx.json/project.json) type-checked by the standalone CLI at a tsconfig path"

key-files:
  created:
    - e2e/angular-typechecker-cli-e2e/project.json
    - e2e/angular-typechecker-cli-e2e/vitest.config.mts
    - e2e/angular-typechecker-cli-e2e/src/global-setup.ts
    - e2e/angular-typechecker-cli-e2e/src/cli-exit-codes.e2e.spec.ts
    - e2e/angular-typechecker-cli-e2e/fixtures/cli-consumer/ (package.json + committed lockfile + tsconfig{,.spec}.json + clean component + spec leaf)
    - libs/test-util/src/lib/cli-e2e.ts
  modified:
    - libs/test-util/src/index.ts
    - libs/test-util/src/lib/verdaccio-global-setup.ts

key-decisions:
  - "VER-04 left OPEN (not marked complete): this plan lands only the npm baseline + harness + retry; yarn/pnpm specs, the Windows CI leg, and the runtime nx-free probe are plans 28-02/03/04. VER-04 closes at phase verification."
  - "cli-consumer fixture drops nx/@nx/devkit from devDeps (nx-free CLI); they still arrive transitively when angular-typechecker is installed by name."
  - "Committed lockfile generated with `npm install --package-lock-only` (no node_modules materialized)."

patterns-established:
  - "runShim(consumerDir, binName, args, env): the .bin-shim exit-code runner, derived from createNgRun"
  - "Bounded connection-refusal retry around the earliest Verdaccio network touch (mintCiToken)"

requirements-completed: []  # VER-04 spans plans 28-02/03/04 too; advanced here, closed at phase verification.

# Metrics
duration: 22min
completed: 2026-07-16
---

# Phase 28 Plan 01: Standalone-CLI shipped-tarball e2e harness + npm baseline Summary

**A new `angular-typechecker-cli-e2e` project proves the SHIPPED `angular-typechecker` and `atc` bins, installed by name from Verdaccio with npm, return literal OS exit codes 0/1/2 through the real `.bin` shim (plus safe `npx angular-typechecker`), and lands the `runShim` helper + the Windows-hardening ECONNREFUSED retry.**

## Performance

- **Duration:** ~22 min
- **Completed:** 2026-07-16
- **Tasks:** 3
- **Files modified:** 15 (13 created, 2 modified)

## Accomplishments
- Net-new e2e project that auto-flows into the CI Linux dynamic matrix via `tools/ci/list-e2e-projects.mjs` with zero static-list edit (D-01), satisfying GUARD-01/01b/01c/01d/01e.
- The literal exit `2` surface (infrastructure + usage) -- never asserted by the Nx/ng `{success}` (0/1) harness -- proven end-to-end through the real PM `.bin` shim for both bin names.
- `runShim` helper added to `@workspace/test-util` (cross-platform: `.cmd` + `shell:true` on Windows per CVE-2024-27980; `maxBuffer` 20MB).
- Bounded ECONNREFUSED/ECONNRESET retry landed in the shared `mintCiToken` (D-06) to harden the cold Windows Verdaccio start-up race, backward-compatible with install-e2e / ng-cli-e2e.
- Full `nx run angular-typechecker-cli-e2e:e2e` ran GREEN locally on this Windows arm64 dev host (1 test, ~24s): both bins clean/planted/infra/usage + `npx angular-typechecker`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold the project + nx-free cli-consumer fixture** - `b69be3b` (test)
2. **Task 2: runShim helper + mintCiToken ECONNREFUSED retry** - `536d091` (test)
3. **Task 3: npm baseline exit-code spec** - `c484707` (test)

_Note: Task 3 is a `tdd="true"` task, but the CLI under test is a frozen, already-shipped artifact (Phases 25-27) -- there is no new production code to make the spec pass. The spec asserts the shipped bin's behavior, so a single `test(...)` commit is the correct and only commit (no RED->GREEN production change; a RED phase would require the shipped bin to be broken)._

## Files Created/Modified
- `e2e/angular-typechecker-cli-e2e/project.json` - e2e + typecheck targets, type:e2e tag, parallelism:false, e2e.dependsOn build (mirrors install-e2e, tokens renamed)
- `e2e/angular-typechecker-cli-e2e/vitest.config.mts` - node-env, fully serialized (pool:forks + singleFork, fileParallelism:false, sequence.concurrent:false, 300000 timeouts)
- `e2e/angular-typechecker-cli-e2e/tsconfig.json` + `tsconfig.spec.json` - mirror install-e2e (typecheck runs tsc over tsconfig.spec.json)
- `e2e/angular-typechecker-cli-e2e/src/global-setup.ts` - one-line createVerdaccioGlobalSetup delegate (label cli-e2e)
- `e2e/angular-typechecker-cli-e2e/src/cli-exit-codes.e2e.spec.ts` - npm install-by-name + shim 0/1/2 matrix for both bins + npx angular-typechecker
- `e2e/angular-typechecker-cli-e2e/fixtures/cli-consumer/*` - nx-free on-stack Angular 22 fixture (package.json + committed package-lock.json, self-contained tsconfig.json + tsconfig.spec.json, clean app.component.ts + app.component.spec.ts leaf); NO nx.json / project.json / committed .npmrc
- `libs/test-util/src/lib/cli-e2e.ts` - runShim helper (spawnSync over the .bin shim)
- `libs/test-util/src/index.ts` - re-export runShim + ShimResult
- `libs/test-util/src/lib/verdaccio-global-setup.ts` - bounded ECONNREFUSED/ECONNRESET retry in mintCiToken

## Decisions Made
- **VER-04 remains OPEN.** This plan is 1 of 4; it delivers the npm baseline + the shared harness (runShim) + the D-06 retry. The yarn (flat+workspace) and pnpm specs, the Windows CI `e2e-windows` leg + GUARD-01f, and the runtime nx-free/ESM probe (D-07) are plans 28-02/03/04. VER-04 (and VER-05) close at phase verification, so `requirements-completed` is intentionally empty here.
- **Fixture drops nx/@nx/devkit** from devDependencies: the standalone CLI is nx-free and takes a tsconfig path directly, so the fixture only needs the Angular 22 peer set (`@angular/core|common|compiler`, `rxjs`, `zone.js` + dev `@angular/compiler-cli` + `typescript`). Installing `angular-typechecker` by name still pulls `nx`/`@nx/devkit` transitively (unused at CLI runtime; the D-07 runtime probe in plan 28-04 verifies that).
- **Committed lockfile via `npm install --package-lock-only`** so no `node_modules` is materialized in the committed fixture tree.
- **Install BY NAME from Verdaccio** (not a packed `.tgz`) per D-02 -- sidesteps the Windows/MSYS `D:/` tar drive-letter gotcha for the later Windows leg.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Reworded the npx-safety comment to avoid the literal `npx atc` string**
- **Found during:** Task 3 (npm baseline exit-code spec)
- **Issue:** The threat mitigation T-28-03 is "enforced by source grep in acceptance criteria" (the spec must never contain `npx atc`). My explanatory comment literally wrote ``NEVER `npx atc` `` to document the hazard, which a source grep for `npx atc` would false-flag as a violation.
- **Fix:** Reworded the comment to "The `atc` alias is NEVER driven through npx ..." so the contiguous `npx atc` literal no longer appears anywhere in the spec; the runNpx helper still hardcodes `npx angular-typechecker` only.
- **Files modified:** e2e/angular-typechecker-cli-e2e/src/cli-exit-codes.e2e.spec.ts
- **Verification:** `rg -n "npx atc"` on the spec returns no matches; the full e2e passed.
- **Committed in:** c484707 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 missing-critical / mitigation-hardening).
**Impact on plan:** Preserves the T-28-03 source-grep mitigation intent. No scope creep.

## Verification Checks (ran vs deferred)

Per the executor guidance for this heavy e2e plan, recording exactly what ran locally vs is deferred to CI:

**Ran and GREEN locally (Windows arm64 dev host):**
- `node tools/ci/list-e2e-projects.mjs` -> includes `angular-typechecker-cli-e2e` (D-01 auto-discovery).
- `nx test angular-typechecker --skip-nx-cache` -> 435/435 tests pass, including GUARD-01/01b/01c/01d/01e (Task 1).
- `nx run test-util:typecheck` + `nx run test-util:build` -> green (Task 2).
- Acceptance greps: `runShim` exported; `shell: isWin` + `maxBuffer` present in cli-e2e.ts; `ECONNREFUSED`/`ECONNRESET` code guard + `AbortSignal.timeout(10000)` present in verdaccio-global-setup.ts.
- `nx run angular-typechecker-cli-e2e:typecheck` -> green (spec type-checks).
- `nx run angular-typechecker-cli-e2e:e2e` -> **GREEN** (1 test, ~24s): both `angular-typechecker` and `atc` bins return 0 (clean) / 1 (planted TS2322 in stdout) / 2 (nonexistent tsconfig + `--nonsense` + missing `-c`), and `npx angular-typechecker` returns 0 / 2. `toBe(2)` count = 5 (>= 3). No `ERR_REQUIRE_ESM`, no false `infrastructure error` on RED runs.
- Post-commit deletion scan across all 3 task commits: none.

**Deferred to CI (out of this plan's scope):**
- The bounded ECONNREFUSED retry's Windows-runner behavior is exercised only on a cold Windows CI runner (D-06); locally the first fetch always connects, so the retry loop takes the happy path (attempt 1 succeeds) -- the guard logic is unit-covered by construction (retries only on the two connection codes, rethrows otherwise). The CI per-project matrix (Linux) is the authoritative e2e gate.

## Issues Encountered
- The Bash safety classifier was intermittently unavailable during execution (repeated "temporarily unavailable" errors on Bash calls). Worked around by retrying until it recovered; all verification commands and commits ultimately ran. No impact on the delivered artifact.

## Known Stubs
None. The fixture ships a genuine clean Angular 22 component + spec leaf; errors are planted at runtime and restored in `finally`.

## Threat Flags
None new. The plan's `<threat_model>` (T-28-02 127.0.0.1 SAFETY gate reuse, T-28-03 no-`npx atc`, T-28-06 stripAllNpmConfig + nonexistent userconfig) is honored by the npm spec; the yarn/pnpm/Windows surfaces land in later plans.

## Next Phase Readiness
- The shared harness (`runShim`, the cli-consumer fixture, the Verdaccio globalSetup, the D-06 retry) is ready for the yarn (28-02) and pnpm (28-03) specs, the Windows CI leg + GUARD-01f (28-03), and the runtime nx-free probe (28-04).
- The human-run real-clone UAT artifact (VER-05, D-08) is a later plan; it is NOT satisfied by automation here.
- VER-04 stays open until all four plans land and phase verification confirms the full PM x OS x bin matrix.

## Self-Check: PASSED

- All key created files verified present on disk (project.json, vitest.config.mts, global-setup.ts, cli-exit-codes.e2e.spec.ts, fixture package.json + committed lockfile, cli-e2e.ts, this SUMMARY).
- All three task commits verified in git log: `b69be3b`, `536d091`, `c484707`.

---
*Phase: 28-shipped-tarball-e2e-real-clone-uat*
*Completed: 2026-07-16*
