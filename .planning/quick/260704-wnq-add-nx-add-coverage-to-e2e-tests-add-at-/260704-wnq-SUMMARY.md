---
phase: 260704-wnq
plan: 01
subsystem: testing
tags: [nx-add, pnpm, yarn, corepack, verdaccio, e2e, vitest, ci]

# Dependency graph
requires:
  - phase: 260704-mse
    provides: shared @nx/js Verdaccio globalSetup (build+publish dist once; inject verdaccioUrl/verdaccioToken)
provides:
  - Real `nx add angular-typechecker` SUCCESS-path e2e coverage for npm, pnpm 11, and yarn 4
  - pnpm build-approval workaround (allowBuilds) embedded in the pnpm spec fixture with explanatory comments
  - CI corepack-enable step so the yarn nx-add spec runs in the e2e job
affects: [release, e2e, nx-add, pnpm-workspaces, yarn-berry]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Real nx add via npx nx add (npm/pnpm) and corepack yarn nx add (yarn), NOT the nx g :init substitute"
    - "pnpm 11 build gate satisfied per-fixture via allowBuilds: { nx: true } (the pnpm 11 approval key) so the real nx add succeeds"
    - "yarn 4 local-Verdaccio fixture: .yarnrc.yml with npmMinimalAgeGate 0 + unsafeHttpWhitelist localhost + per-fixture cache"

key-files:
  created:
    - e2e/angular-typechecker-install-e2e/src/nx-add-npm.int.spec.ts
    - e2e/angular-typechecker-install-e2e/src/nx-add-pnpm.int.spec.ts
    - e2e/angular-typechecker-install-e2e/src/nx-add-yarn.int.spec.ts
  modified:
    - .github/workflows/ci.yml

key-decisions:
  - "DIRECTIVE CHANGE: all three PM specs assert the SUCCESS path (package installs + inits on every PM once the PM's own build gate is satisfied); the pnpm spec applies a workaround instead of asserting the failure"
  - "pnpm workaround: allowBuilds: { nx: true } in pnpm-workspace.yaml (the pnpm 11 approval key; the fixture flags exactly nx@23.0.1)"
  - "Invoke nx via `npx nx add` for pnpm, NOT `pnpm exec nx add` (pnpm exec's pre-flight deps-status check is a separate surface)"
  - "yarn 4 needs npmMinimalAgeGate 0 to accept the seconds-old Verdaccio-published version"

patterns-established:
  - "Uniform SUCCESS assertion across all three PM specs: absent-before baseline + init-seeded targetDefaults (cache:true, outputs:[], inputs[0]==='default')"

requirements-completed: [QUICK-wnq-nx-add-e2e]

# Metrics
duration: 40min
completed: 2026-07-05
---

# Phase 260704-wnq: Real `nx add` e2e coverage (npm + pnpm 11 + yarn 4) Summary

**Three install-e2e specs that drive the REAL `nx add angular-typechecker` for npm, pnpm 11, and yarn 4 against the shared local Verdaccio -- all three assert the SUCCESS path (init seeds the typecheck targetDefaults) once each PM's own install gate is satisfied; the pnpm spec applies the recommended `allowBuilds` build-approval workaround with thorough explanatory comments -- plus a CI corepack-enable step so the yarn spec runs.**

> DIRECTIVE CHANGE (mid-execution, from the user via the coordinator): "This is a package manager issue, not an issue with our package. Apply workarounds to the automated tests in our repo with explanatory comments, that's it." The pnpm spec was pivoted from asserting the ERR_PNPM_IGNORED_BUILDS FAILURE to APPLYING a pnpm build-approval workaround so the real `nx add` SUCCEEDS, matching the npm and yarn specs. Scope is the automated tests ONLY -- no README changes.

## Performance

- **Duration:** ~55 min (incl. the mid-execution directive pivot)
- **Tasks:** 3 (+ 1 directive-driven rewrite)
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- npm: real `nx add` on an npm workspace at Verdaccio -> SUCCESS -> init seeds `angular-typechecker:typecheck` (cache:true, outputs:[], inputs[0]==='default').
- pnpm 11: real `nx add` on a pnpm 11 workspace with the `allowBuilds: { nx: true }` build-approval workaround -> SUCCESS -> init seeds the same targetDefaults. (Without the workaround, nx add's child `pnpm add` exits non-zero on the pnpm build-script gate and nx add aborts before init -- a pnpm <-> nx-add interaction, NOT an angular-typechecker defect: the package ships zero install/build scripts.)
- yarn 4: real `nx add` on a yarn 4 workspace at Verdaccio -> SUCCESS -> init seeds the same targetDefaults.
- CI: `corepack enable` added to the e2e job so nx add's bare child `yarn add` resolves on PATH.
- Full install-e2e suite green: 9 files / 32 tests. `nx format:check` + `nx run-many -t lint` clean.

## Per-PM observed record (OBSERVE-FIRST)

| PM | Exact `nx add` command | Observed outcome | Substring(s) asserted |
|----|------------------------|------------------|-----------------------|
| npm | `npx nx add angular-typechecker` | SUCCESS -> init seeds targetDefaults | `seeded.cache===true`, `outputs===[]`, `inputs[0]==='default'` (+ absent-before baseline) |
| pnpm 11 | `npx nx add angular-typechecker` (fixture applies `allowBuilds: { nx: true }`) | SUCCESS -> init seeds targetDefaults | `seeded.cache===true`, `outputs===[]`, `inputs[0]==='default'` (+ absent-before baseline) |
| yarn 4 | `corepack yarn nx add angular-typechecker` | SUCCESS -> init seeds targetDefaults | `seeded.cache===true`, `outputs===[]`, `inputs[0]==='default'` (+ absent-before baseline) |

### pnpm gate + workaround (observed on pnpm 11.9.0)

- A plain `pnpm install` on the fixture flags EXACTLY `nx@23.0.1` (nx has a postinstall; angular-typechecker ships zero scripts). A single pinned, OS-stable dep -- so `allowBuilds: { nx: true }` enumerates precisely the flagged set (preferred over the `strictDepBuilds: false` blanket fallback).
- Verified: with `allowBuilds: { nx: true }`, both `pnpm install` and `pnpm add -Dw <pkg>` exit 0 -> nx add's child `pnpm add angular-typechecker@latest` exits 0 -> init runs.
- pnpm 10 vs 11: `allowBuilds` (a `{ pkg: true }` map) is the pnpm 11 approval key; `onlyBuiltDependencies` (a list) was the pnpm 10 key and was REMOVED in pnpm 11 (a stale one is silently ignored). `--ignore-scripts` / `strictDepBuilds: false` fix only the direct install+init path -- they cannot be passed through `nx add`, which forwards no flags.

## RESEARCH assumptions (A1-A5) at runtime

| # | Assumption | Disposition | Note |
|---|-----------|-------------|------|
| A1 | yarn `nx add` succeeds + seeds targetDefaults | CONFIRMED | after adding `npmMinimalAgeGate: 0` (see New Finding); init seeded the WALK-02 block |
| A2 | exact pnpm failure substring | SUPERSEDED by the directive | The observe-first pass established the failure mechanism (corrections: the gate does NOT re-arm after `pnpm install --ignore-scripts`; nx must be invoked via `npx nx add`, not `pnpm exec nx add`; the real nx wrapper string is `Failed to install angular-typechecker. Please check the error above for more details.`). The directive then pivoted the spec to the SUCCESS path, so the failure is no longer asserted -- instead the fixture applies `allowBuilds: { nx: true }` so the child `pnpm add` exits 0. |
| A3 | child `yarn add` needs `corepack enable` | CONFIRMED | corepack enable added to the spec setup AND the CI e2e job; child `yarn add` resolved |
| A4 | per-fixture yarn cache to prove local dist | CONFIRMED | `cacheFolder: ./.yarn/cache` + `enableGlobalCache: false`; local Verdaccio 0.1.1 resolved |
| A5 | pnpm 11.9.0 pin vs corepack | CORRECTED/refined | the host PATH `pnpm` is fnm-shimmed 9.15.7 (NO build gate). The fixture's `packageManager: pnpm@11.9.0` makes pnpm self-route to 11.9.0 (pnpm's manage-package-manager-versions), which is what engages the pnpm 11 build gate AT ALL on this host -- not merely CI-version parity. |

## Task Commits

1. **Task 1: npm real `nx add` spec** - `97deb06` (test)
2. **Task 2: pnpm 11 spec, initial (asserted the build-gate failure)** - `7e61c06` (test)
3. **Task 3: yarn 4 real `nx add` spec + CI corepack enable** - `dd639c1` (test)
4. **Directive rewrite: pnpm spec asserts SUCCESS via the allowBuilds workaround** - `918696d` (test)

_Note: commit 2 and commit 4 are both `test(e2e)` (a hidden, no-bump changelog type), so the intermediate failure-asserting revision has no release-changelog impact._

## Files Created/Modified
- `e2e/angular-typechecker-install-e2e/src/nx-add-npm.int.spec.ts` - real `nx add` on npm; asserts init seeds targetDefaults.
- `e2e/angular-typechecker-install-e2e/src/nx-add-pnpm.int.spec.ts` - real `nx add` on pnpm 11 with the `allowBuilds: { nx: true }` build-approval workaround; asserts init seeds targetDefaults (SUCCESS path).
- `e2e/angular-typechecker-install-e2e/src/nx-add-yarn.int.spec.ts` - real `nx add` on yarn 4; asserts init seeds targetDefaults.
- `.github/workflows/ci.yml` - `corepack enable` step in the e2e job (after setup-node).

## Decisions Made
- pnpm workaround: enumerate the exact flagged dep via `allowBuilds: { nx: true }` (the recommended, security-preserving pnpm 11 approval -- what `pnpm approve-builds` writes) rather than the `strictDepBuilds: false` blanket fallback, because the fixture flags exactly one pinned, OS-stable dep.
- Dropped the synthetic `esbuild` gate-arming dep the failure-assertion revision added: the fixture's own `nx` devDep is the authentic build-hardened scenario, and a smaller flagged set keeps `allowBuilds` stable.
- Invoke nx via `npx nx add` on pnpm (matches the npm spec; with the gate satisfied `pnpm exec nx add` would also work, but npx sidesteps pnpm exec's separate pre-flight deps-status check).
- yarn spec disables the freshness quarantine via `npmMinimalAgeGate: 0` rather than pre-approving a package glob, since the whole local Verdaccio registry serves freshly-published test versions.

## Deviations from Plan

### Directive change (mid-execution)

**pnpm spec pivoted from asserting the FAILURE to asserting workaround-applied SUCCESS.**
- **Source:** the user, via the coordinator: "This is a package manager issue, not an issue with our package. Apply workarounds to the automated tests in our repo with explanatory comments, that's it."
- **Change:** the pnpm spec now applies `allowBuilds: { nx: true }` in the fixture so the real `nx add angular-typechecker` succeeds, and asserts init seeded the targetDefaults (absent-before baseline + cache:true/outputs:[]/inputs[0]==='default') -- identical assertions to the npm and yarn specs. Thorough ASCII-only explanatory comments cover the pnpm <-> nx-add interaction, the workaround, and the pnpm 10/11 key facts.
- **Removed:** the failure assertion, the non-vacuous `caught` guard, and the synthetic `esbuild` gate-arming dep from the initial revision.
- **Scope:** automated tests ONLY -- no README changes.
- **Committed in:** 918696d (supersedes the design of 7e61c06).

### Auto-fixed Issues (from the observe-first pass)

**1. [Rule 3 - Blocking] yarn 4 quarantined the seconds-old Verdaccio version**
- **Found during:** Task 3 (yarn spec)
- **Issue:** yarn 4.17.0 defaults `npmMinimalAgeGate: 1440` (24h) and rejected the just-published local dist with `YN0016: The version for tag "latest" is quarantined` / `YN0027 ... can't be resolved`, so nx add's child `yarn add` failed.
- **Fix:** Added `npmMinimalAgeGate: 0` to the fixture `.yarnrc.yml`.
- **Files modified:** e2e/angular-typechecker-install-e2e/src/nx-add-yarn.int.spec.ts
- **Verification:** yarn spec resolves the local 0.1.1 and init seeds targetDefaults; passes.
- **Committed in:** dd639c1

---

**Total deviations:** 1 directive change (pnpm design pivot) + 1 auto-fixed (yarn blocking).
**Impact:** The pnpm pivot aligns all three specs on the SUCCESS path (the package works on every PM once the PM's gate is satisfied). No scope creep -- same files, tests-only, no README.

## Issues Encountered
- The `nx test <project> <positional>` filter did not narrow the vitest run (it ran all 9 files). Not a blocker -- the full suite is the authoritative gate anyway; observation was done from the full-suite output.
- Windows teardown prints a benign `local registry exit 143` (SIGTERM double-fork edge); CI is Linux-only.

## Self-Check

- Files exist: nx-add-npm.int.spec.ts, nx-add-pnpm.int.spec.ts, nx-add-yarn.int.spec.ts, ci.yml (corepack enable present).
- Commits exist: 97deb06, 7e61c06, dd639c1, 918696d.
- Verifications (after the pnpm rewrite): install-e2e 9/9 files, 32/32 tests PASS; format:check clean; lint clean; ci.yml parses.

## Next Phase Readiness
- Real `nx add` SUCCESS-path coverage now exists for all three PMs; the pnpm spec documents + applies the build-approval workaround.
- The underlying pnpm <-> nx-add UX friction (bare `nx add` aborts on a build-hardened pnpm workspace) is a package-manager/nx-CLI interaction, not an angular-typechecker defect. The README pnpm caveat + optional upstream Nx issue remain explicitly OUT OF SCOPE and are open follow-ups per the directive (tests-only).

---
*Phase: 260704-wnq*
*Completed: 2026-07-05*
