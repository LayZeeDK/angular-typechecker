---
phase: 28-shipped-tarball-e2e-real-clone-uat
plan: 02
subsystem: testing
tags: [e2e, verdaccio, cli, exit-codes, yarn, pnpm, nx-free, esm-bridge, runtime-probe]

# Dependency graph
requires:
  - phase: 28-shipped-tarball-e2e-real-clone-uat
    plan: 01
    provides: the angular-typechecker-cli-e2e project, the runShim helper, the cli-consumer fixture, the shared Verdaccio globalSetup + mintCiToken retry, and the npm baseline this plan mirrors
  - phase: 27-bin-shell-cross-platform-packaging
    provides: the shipped two-name bin + the frozen 0/1/2 exit-code contract and the STATIC nx-free/shebang guard (bin-static.spec.ts) this plan's runtime probe complements
provides:
  - yarn (flat + workspace) install-by-name + .bin-shim 0/1/2 coverage for both bin names
  - pnpm install-by-name + .bin-shim 0/1/2 coverage for both bin names
  - the RUNTIME nx-free proof (require.cache reaches no @nx/*/nx/) + ERR_REQUIRE_ESM-free assertion on the INSTALLED bin (D-07, SC-3)
affects: [28-03 Windows CI leg + GUARD-01f, 28-04 real-clone UAT, VER-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "yarn 4 install-by-name via corepack + .yarnrc.yml (node-modules linker, enableMirror:false, npmMinimalAgeGate:0); it.skipIf(!corepackAvailable).each(['flat','workspace'])"
    - "pnpm install-by-name with strictDepBuilds:false via pnpm-workspace.yaml (pnpm 11 build-gate, avoids ERR_PNPM_IGNORED_BUILDS on the transitive nx postinstall)"
    - "runtime require-cache probe: node -r <exit-hook.cjs> <installed bin.js> dumps require.cache filtered by /node_modules[\\/](@nx[\\/]|nx[\\/])/ -> toEqual([])"

key-files:
  created:
    - e2e/angular-typechecker-cli-e2e/src/cli-exit-codes-yarn.e2e.spec.ts
    - e2e/angular-typechecker-cli-e2e/src/cli-exit-codes-pnpm.e2e.spec.ts
    - e2e/angular-typechecker-cli-e2e/src/nx-free-runtime.e2e.spec.ts
  modified: []

key-decisions:
  - "strictDepBuilds:false written into pnpm-workspace.yaml (the CI-authoritative ng-add-ng-run-pnpm mechanism), NOT the consumer .npmrc the plan action text named -- pnpm 11 reads the build-script gate from pnpm-workspace.yaml. Verified green (no ERR_PNPM_IGNORED_BUILDS)."
  - "yarn workspace layout uses workspaces:['projects/*'] verbatim from the analog even though the cli-consumer ships no projects/ members -- the empty glob still exercises yarn's node-modules workspace linker path (both layouts green)."
  - "Runtime require-cache probe runs via node -r hook bin.js directly (RESEARCH Open Question 2 / D-07 discretion); the .bin shim path is proven separately by the exit-code specs."
  - "VER-04 stays OPEN: this plan lands yarn + pnpm + the runtime probe; the Windows CI e2e-windows leg + GUARD-01f (SC-2) is plan 28-03 and the real-clone UAT (VER-05) is 28-04. VER-04 closes at phase verification."

patterns-established:
  - "String.raw preload-hook authoring: emit a .cjs whose regex character class [\\/] stays byte-exact"

requirements-completed: []  # VER-04 also spans 28-03 (Windows CI leg, SC-2); advanced here, closed at phase verification.

# Metrics
duration: 20min
completed: 2026-07-16
---

# Phase 28 Plan 02: yarn + pnpm CLI exit-code e2e + runtime nx-free/ESM probe Summary

**Completes the VER-04 package-manager matrix (yarn flat + workspace, pnpm) proving the shipped `angular-typechecker`/`atc` bins, installed by name from Verdaccio, return literal OS exit codes 0/1/2 through the real `.bin` shim for both bin names, and adds the D-07 runtime half: the INSTALLED bin's require cache never reaches `@nx/*`/`nx/` and its output never emits `ERR_REQUIRE_ESM`.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-16
- **Tasks:** 3
- **Files created:** 3

## Accomplishments
- yarn 4 (flat + workspace) install-by-name + `.bin` shim `0`/`1`/`2` for both bin names, provisioned via corepack + the load-bearing `.yarnrc.yml` (node-modules linker, `enableMirror:false`, `npmMinimalAgeGate:0`), copied verbatim from the proven ng-add-ng-run-yarn analog and re-targeted to `runShim`.
- pnpm install-by-name + `.bin` shim `0`/`1`/`2` for both bin names, with `strictDepBuilds:false` disabling pnpm 11's build-script gate so the transitive `nx` postinstall does not `ERR_PNPM_IGNORED_BUILDS`-fail the install.
- The D-07 RUNTIME complement to Phase 27's static require-graph walk: a `node -r <exit-hook> <installed bin.js>` run of a real type-check whose process-exit hook dumps `require.cache`; the nx-filtered set is `[]` (no `@nx/*`/`nx/` loaded at run time) and the captured output is `ERR_REQUIRE_ESM`-free (the CJS->ESM `await import('@angular/compiler-cli')` bridge survived install un-downleveled).
- Full `nx run angular-typechecker-cli-e2e:e2e` ran GREEN locally on this Windows arm64 dev host: 4 spec files, 5 tests (npm baseline + yarn x2 layouts + pnpm + runtime probe).

## Task Commits

Each task was committed atomically:

1. **Task 1: yarn (flat + workspace) exit-code spec** - `21fb99c` (test)
2. **Task 2: pnpm exit-code spec** - `472a302` (test)
3. **Task 3: runtime nx-free / ESM-bridge probe on the installed bin** - `ad5edb7` (test)

_Note: all three are `tdd="true"` tasks, but (like Plan 01) the CLI under test is a frozen, already-shipped artifact (Phases 25-27) with no new production code to make the specs pass. Each spec OBSERVES the shipped bin's behavior, so a single `test(...)` commit per task is the correct and only commit (a RED phase would require the shipped bin to be broken)._

## Files Created
- `e2e/angular-typechecker-cli-e2e/src/cli-exit-codes-yarn.e2e.spec.ts` - yarn flat + workspace install-by-name + `runShim` `0`/`1`/`2` for both bins; `it.skipIf(!corepackAvailable).each(['flat','workspace'])`; RED asserts no `ERR_REQUIRE_ESM` / no `infrastructure error`.
- `e2e/angular-typechecker-cli-e2e/src/cli-exit-codes-pnpm.e2e.spec.ts` - pnpm install-by-name + `runShim` `0`/`1`/`2` for both bins; `strictDepBuilds:false` posture; `it.skipIf(!pnpmAvailable)`.
- `e2e/angular-typechecker-cli-e2e/src/nx-free-runtime.e2e.spec.ts` - `node -r hook bin.js` require-cache probe (`toEqual([])`) + `ERR_REQUIRE_ESM`-free assertion on a real installed-bin type-check.

## Decisions Made
- **strictDepBuilds via pnpm-workspace.yaml, not .npmrc.** The plan action text said "write it into the consumer .npmrc", but pnpm 11 reads the build-script gate from `pnpm-workspace.yaml` (the mechanism proven green in the CI-authoritative ng-add-ng-run-pnpm spec, Phase 24). Using `.npmrc` would not have disabled the gate. Recorded as a deviation below.
- **yarn workspace layout copied verbatim** (`workspaces:['projects/*']`) even though `cli-consumer` ships no `projects/` members: the empty glob still exercises yarn's node-modules workspace linker path, which is what the "workspace" cell must prove. Both layouts are green.
- **Runtime probe via `node -r hook bin.js`** (not through the `.bin` shim): RESEARCH Open Question 2 / D-07 discretion. The shim path is proven separately by the exit-code specs; the probe needs the raw process to attach the require-cache exit hook.
- **VER-04 remains OPEN.** yarn + pnpm + the runtime nx-free/ESM probe land here; the Windows CI `e2e-windows` leg + GUARD-01f (SC-2) is plan 28-03 and the human-run real-clone UAT (VER-05) is plan 28-04. `requirements-completed` is intentionally empty; VER-04 closes at phase verification.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] pnpm build-gate config location: pnpm-workspace.yaml, not .npmrc**
- **Found during:** Task 2 (pnpm exit-code spec)
- **Issue:** The plan's `<action>` for Task 2 said to carry the `strictDepBuilds:false` posture by "write it into the consumer .npmrc". pnpm 11 does not read the build-script gate from `.npmrc`; installing `angular-typechecker` (which pulls `nx` transitively -- npm itself warns + skips its postinstall) would `ERR_PNPM_IGNORED_BUILDS`-fail the `pnpm add` under the default gate.
- **Fix:** Wrote `strictDepBuilds:false` into `pnpm-workspace.yaml` (with `packages:\n  - '.'`), the exact mechanism the plan's own `<read_first>` analog (ng-add-ng-run-pnpm) uses and that is proven green in CI. Pinned `packageManager: pnpm@11.9.0` so pnpm self-routes to the gated major.
- **Files modified:** e2e/angular-typechecker-cli-e2e/src/cli-exit-codes-pnpm.e2e.spec.ts
- **Verification:** `nx run angular-typechecker-cli-e2e:e2e` -- the pnpm spec install exits 0 (no `ERR_PNPM_IGNORED_BUILDS`) and all `0`/`1`/`2` cells pass.
- **Committed in:** 472a302 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking-issue: config-location correction to match the proven-working mechanism).
**Impact on plan:** none on scope; the build-gate is disabled by the correct pnpm 11 mechanism. The acceptance criterion's literal ".npmrc" wording is superseded by the CI-authoritative `pnpm-workspace.yaml` posture.

## Verification Checks (ran vs deferred)

Per the executor guidance for this heavy e2e plan, recording exactly what ran locally vs is deferred to CI:

**Ran and GREEN locally (Windows arm64 dev host):**
- `nx run angular-typechecker-cli-e2e:typecheck --skip-nx-cache` -> green after each new spec (Tasks 1/2/3).
- `nx run angular-typechecker-cli-e2e:e2e --skip-nx-cache` (full project run, all specs) -> **GREEN**: 4 spec files, 5 tests.
  - yarn: flat layout (~20s) + workspace layout (~21s) -- both bins `0`/`1`/`2`, planted TS2322 in stdout, no `ERR_REQUIRE_ESM`.
  - pnpm: (~15s) -- both bins `0`/`1`/`2`, install did not `ERR_PNPM_IGNORED_BUILDS`, planted TS2322 in stdout.
  - runtime probe: (~17s) -- clean run exits 0, `require.cache` nx set `toEqual([])`, output `ERR_REQUIRE_ESM`-free.
  - npm baseline (Plan 01) still green alongside.
- Threat-mitigation greps: no `npx atc` in any of the 3 new specs (T-28-03); the yarn/pnpm exit-code specs contain no `node .../bin.js` invocation (they use `runShim`); the nx-free-runtime spec names the installed path `node_modules/angular-typechecker/src/cli/bin.js`.
- `nx format:check --files <3 specs>` -> clean. (The cli-e2e project has only `e2e` + `typecheck` targets -- no lint target, matching the other e2e projects; e2e specs are not linted by design.)
- Post-commit deletion scan across all 3 task commits: none.

**Deferred to CI (out of this plan's scope):**
- The yarn/pnpm cells' cold-runner behavior on the **Windows CI** `e2e-windows` job (SC-2) is plan 28-03; locally these ran on this Windows arm64 host and passed, but the dedicated CI Windows leg + the ECONNREFUSED retry exercise is that plan.
- The Linux dynamic-matrix run of all four specs is exercised by CI's per-project e2e matrix (the project auto-discovers via `tools/ci/list-e2e-projects.mjs`, established in Plan 01).

## Issues Encountered
- None. All three specs mirrored proven in-repo analogs; the only surprise was the pnpm build-gate config location (see Deviation 1), caught and fixed before commit.

## Known Stubs
None. The specs observe the frozen shipped bin against the genuine clean Angular 22 `cli-consumer` fixture; errors are planted at runtime into a per-run tmp copy and restored in `finally`.

## Threat Flags
None new. The plan's `<threat_model>` is honored: T-28-03 (no `npx atc`; shim by path via `runShim`; probe via `node -r hook bin.js`) enforced by source grep; T-28-02 (127.0.0.1 SAFETY echo + install-by-name from Verdaccio) re-asserted in every spec; T-28-06 (`strictDepBuilds:false` skips ALL dependency build scripts -- more restrictive than an allowlist) applied in the pnpm spec.

## Next Phase Readiness
- yarn + pnpm + the runtime nx-free/ESM probe complete the automated PM x bin matrix for VER-04.
- Plan 28-03 (Windows `e2e-windows` CI job + GUARD-01f, SC-2) and plan 28-04 (real-clone UAT, VER-05) remain; VER-04 stays open until phase verification confirms the full PM x OS x bin matrix.

## Self-Check: PASSED

- All 3 created spec files verified present on disk.
- All 3 task commits verified in git log: `21fb99c`, `472a302`, `ad5edb7`.
- No file deletions across the 3 commits.

---
*Phase: 28-shipped-tarball-e2e-real-clone-uat*
*Completed: 2026-07-16*
