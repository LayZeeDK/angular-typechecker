---
phase: 15-generator-e2e-ci-self-audit-guard
plan: 02
subsystem: testing
tags: [e2e, tarball, generator, nx-add, main-tree, vitest]

# Dependency graph
requires:
  - phase: 14-configuration-init-generators-nx-add
    provides: the shipped configuration/init generators + generators.json + the reference-walking typecheck executor this plan proves end-to-end
  - phase: 15-generator-e2e-ci-self-audit-guard
    plan: 01
    provides: execution-ordering only (GUARD-01 shipped in wave 1; kept this heavy plan alone in wave 2 so it runs on the main tree)
provides:
  - GE2E-01 clean-install proof that configuration wires ONE typecheck target at the solution tsconfig.json + init seeds the default-input WALK-02 cache block
  - GE2E-02 two-leaf WALK verdict from a clean install (green clean; TS2322 lib + TS2345 spec on injected two-leaf errors)
  - GE2E-03 proof that nx add's init path (npm install <tarball> + nx g angular-typechecker:init) seeds targetDefaults from ABSENT
  - D-13 packaging-audit hardening (the five shipped generator files asserted present in the tarball)
affects: [milestone-audit, v0.1.0-release-pr]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "New un-wired multi-leaf consumer-generator fixture: composite of local-lib (2-reference solution tsconfig + template component + inline-globals spec) and consumer-app (installable flat package.json/nx.json) MINUS the targetDefaults key (D-02) MINUS any lockfile"
    - "generator-e2e / nx-add-e2e reuse the matrix-5types / install-smoke pack+tmp-install honesty harness verbatim; only the operation changes (generate-then-run / install-then-init)"
    - "Two DISTINCT injected codes (TS2322 lib field / TS2345 spec statement) prove BOTH solution-tsconfig leaves were walked"
    - "Best-effort removeTmpWorkspace helper (maxRetries + swallow) makes Windows tmp-dir teardown non-fatal without masking assertions"

key-files:
  created:
    - e2e/angular-typechecker-install-e2e/fixtures/consumer-generator/package.json
    - e2e/angular-typechecker-install-e2e/fixtures/consumer-generator/nx.json
    - e2e/angular-typechecker-install-e2e/fixtures/consumer-generator/project.json
    - e2e/angular-typechecker-install-e2e/fixtures/consumer-generator/tsconfig.json
    - e2e/angular-typechecker-install-e2e/fixtures/consumer-generator/tsconfig.lib.json
    - e2e/angular-typechecker-install-e2e/fixtures/consumer-generator/tsconfig.spec.json
    - e2e/angular-typechecker-install-e2e/fixtures/consumer-generator/src/consumer-generator.component.ts
    - e2e/angular-typechecker-install-e2e/fixtures/consumer-generator/src/consumer-generator.component.spec.ts
    - e2e/angular-typechecker-install-e2e/src/generator-e2e.int.spec.ts
    - e2e/angular-typechecker-install-e2e/src/nx-add-e2e.int.spec.ts
  modified:
    - e2e/angular-typechecker-install-e2e/src/tarball-audit.int.spec.ts

key-decisions:
  - "Fixture nx.json ships namedInputs only, NO targetDefaults[angular-typechecker:typecheck] (D-02) so init genuinely seeds from ABSENT and GE2E-01(b)/GE2E-03 are non-vacuous"
  - "Assert the init-SEEDED shape (inputs[0]==='default'), never the fixture nx.json production-first blocks -- the WALK-02 spec-hashing landmine"
  - "GE2E-03 uses the deterministic offline stand-in npm install <tarball> + nx g angular-typechecker:init (the byte-identical command nx add's runPluginInitGenerator runs); nx add <bare> would hit the registry"
  - "Two-leaf proof via DISTINCT codes: TS2322 (lib class field) + TS2345 (spec ('x').padStart('str') statement); the spec-only TS2345 proves the spec leaf was walked"
  - "D-13 included: appended the 5 shipped generator paths to tarball-audit REQUIRED_FILES; leak guards unchanged and still pass"
  - "Per-file build+pack (D-08 acceptable fallback) for isolation parity with the existing install-e2e specs"

patterns-established:
  - "Windows tmp-workspace teardown after a nested nx subprocess must be best-effort (the dir root can stay EPERM-locked past execSync); the CI e2e gate is Linux-only where recursive rmSync never EPERMs"

requirements-completed: [GE2E-01, GE2E-02, GE2E-03]

# Metrics
duration: ~15 min
completed: 2026-07-02
---

# Phase 15 Plan 02: Generator e2e (GE2E-01/02/03) + tarball-audit hardening Summary

**The empirical real-consumer proof of the shipped Phase 14 generator suite: a clean tarball install + `nx g angular-typechecker:configuration` on a new un-wired multi-leaf `consumer-generator` fixture wires ONE `typecheck` target at the solution `tsconfig.json` and seeds the `default`-input WALK-02 cache block, the target then walks BOTH leaves (green clean; TS2322 lib + TS2345 spec on injected two-leaf errors), and `nx add`'s init path seeds `targetDefaults` from absent -- all GREEN under `npx nx test angular-typechecker-install-e2e` (26/26).**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-02T07:32:23Z
- **Completed:** 2026-07-02T07:47:34Z
- **Tasks:** 3
- **Files:** 10 created, 1 modified

## Accomplishments

- **GE2E-01 (`generator-e2e.int.spec.ts`):** From a clean tarball install into a tmp copy of the un-wired `consumer-generator`, `nx g angular-typechecker:configuration --skipFormat` writes exactly ONE `typecheck` target (executor `angular-typechecker:typecheck`) whose `options.tsConfig` resolves to the solution `tsconfig.json` (root-level D-07 case 2, asserted `endsWith('tsconfig.json')` and NOT a leaf), and `init` seeds `nx.json` `targetDefaults['angular-typechecker:typecheck']` with `cache:true`, `outputs:[]`, `inputs[0]==='default'`.
- **GE2E-02 (same spec):** `nx run consumer-generator:typecheck --skip-nx-cache` is green (exit 0) on the committed-clean sources; after injecting a `number`-typed class field into the lib component (TS2322) AND a `('x').padStart('str')` statement into the spec (TS2345), the run exits non-zero with BOTH tokens in stdout, no `ERR_REQUIRE_ESM`, no `infrastructure error` -- proving both solution-tsconfig leaves were walked.
- **GE2E-03 (`nx-add-e2e.int.spec.ts`):** Asserts the fixture `nx.json` key is `undefined` BEFORE init, then `npm install <tarball>` + the byte-identical internal command `nx add` runs (`nx g angular-typechecker:init --skipFormat`) seeds the WALK-02 block (`inputs[0]==='default'`). A header documents the `nx add` -> `nx g :init` equivalence (Finding 1).
- **D-13 (`tarball-audit.int.spec.ts`):** Appended `generators.json` + `src/generators/{configuration,init}/generator.js` + `src/generators/{configuration,init}/schema.json` to `REQUIRED_FILES`; the "ships the required published files" gate passes (all five ship), and the `.spec.`/`(libs|fixtures|e2e)/`/`typecheck-consumer` leak guards + the no-install-scripts guard are byte-unchanged and still green.
- **New un-wired multi-leaf fixture (`fixtures/consumer-generator/`):** root-level `projectType:"library"`, solution `tsconfig.json` with a two-entry `references[]` (lib + spec leaves), `nx.json` with `namedInputs` but NO `targetDefaults` key (D-02), a clean template-bearing component + inline-globals spec, `consumer-app` dep set, `private:true`, NO lockfile.

## Task Commits

Each task was committed atomically:

1. **Task 1: un-wired multi-leaf `consumer-generator` fixture (8 files)** - `de4c423` (test)
2. **Task 2: `generator-e2e.int.spec.ts` (GE2E-01 + GE2E-02)** - `ff53522` (test)
3. **Task 3: `nx-add-e2e.int.spec.ts` (GE2E-03) + tarball-audit D-13 extension + teardown fix** - `7f2f201` (test)

**Plan metadata:** committed with this SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md (docs: complete plan).

## Files Created/Modified

- `fixtures/consumer-generator/{package.json,nx.json,project.json,tsconfig.json,tsconfig.lib.json,tsconfig.spec.json,src/consumer-generator.component.ts,src/consumer-generator.component.spec.ts}` - the un-wired multi-leaf consumer fixture (composite of `local-lib` + `consumer-app`, minus the targetDefaults key and any lockfile).
- `src/generator-e2e.int.spec.ts` - GE2E-01 + GE2E-02 (generate -> assert config + seeded block -> clean run -> two-leaf injection verdict).
- `src/nx-add-e2e.int.spec.ts` - GE2E-03 (install tarball + `nx g :init` -> seeded-from-absent).
- `src/tarball-audit.int.spec.ts` - MODIFIED: `REQUIRED_FILES` += the five generator paths (D-13).

## Decisions Made

- **Fixture `nx.json` has NO `targetDefaults` key (D-02, load-bearing).** Copying `consumer-app`'s block (which pre-declares the key with `production`-first inputs) would make `init`'s whole-entry `??=` skip seeding (vacuous GE2E-01(b)/GE2E-03) and under-hash the spec leaf. The new fixture omits it, so `init` genuinely seeds and the assertions target the init-SEEDED shape (`inputs[0]==='default'`), never the fixture blocks.
- **GE2E-03 = the deterministic offline stand-in, not `nx add <bare>`.** `nx add angular-typechecker` resolves `pkg@latest` from the registry (wrong artifact, needs network); `nx add`'s `runPluginInitGenerator` constructs the byte-identical `nx g angular-typechecker:init`, so `npm install <tarball>` + that command is the faithful, offline, board-aligned GEN-09 proof (documented in the spec header).
- **Two DISTINCT injected codes.** TS2322 in the lib component field and TS2345 (`('x').padStart('str')`) inside the spec `it()` body; the spec-only TS2345 uniquely proves the spec-leaf reference was walked (a single shared code could not distinguish "both walked" from "one twice").
- **Root-level tsConfig assertion is normalization-robust.** Asserts `options.tsConfig` ends at `tsconfig.json` and is NOT a `tsconfig.(lib|spec).json` leaf, rather than a brittle exact-string match.
- **D-13 included** (low-cost belt-and-suspenders): the five generator paths added to `REQUIRED_FILES`; the GE2E scenarios already empirically prove the generators ship, but the static audit gate is cheap.
- **Per-file build+pack (D-08 fallback)** for isolation parity with the existing install-e2e specs, rather than a shared install with byte-restore.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking teardown flake] Best-effort tmp-workspace removal on Windows**
- **Found during:** Task 3 full-suite verification (`npx nx test angular-typechecker-install-e2e`).
- **Issue:** `nx-add-e2e`'s `finally` teardown failed the whole scenario with `EPERM, Permission denied` on the tmp dir ROOT (`\\?\C:\...\atc-add-*`) -- a lingering nx subprocess holds the directory open past `execSync`'s return. All assertions had already passed; only the recursive `rmSync` failed. Node's `maxRetries`/`retryDelay` linear-backoff (tried first) did NOT clear the persistent lock.
- **Fix:** Extracted a `removeTmpWorkspace(tmp)` helper (`rmSync` with `maxRetries:10`/`retryDelay:100` for quick transients, wrapped in a swallowing `try/catch`) so a residual Windows temp-lock cannot fail a green scenario. Applied to BOTH new specs for consistency (`generator-e2e` shares the identical teardown pattern and the same race can flake on any Windows cell). Assertions are untouched and remain authoritative.
- **Why safe:** the CI e2e gate is Linux-only (recursive `rmSync` never `EPERM`s there); a left-behind OS-temp dir is harmless (unique per `mkdtempSync`, OS-reclaimed). This is teardown cleanup, not a requirement assertion.
- **Files modified:** `src/nx-add-e2e.int.spec.ts`, `src/generator-e2e.int.spec.ts`.
- **Commit:** `7f2f201`.

## Issues Encountered

- The Windows `EPERM` teardown race (above) was the only issue; resolved via the best-effort helper. No `ERESOLVE` surfaced on the published peer ranges under the honesty controls (empty `.npmrc` + non-existent `npm_config_userconfig` + no peer override) -- the fixture's Angular 22.0.4 / Nx 23.0.1 / TS 6.0.3 deps resolve cleanly against the packed tarball.

## Verification

- **Authoritative:** `npx nx test angular-typechecker-install-e2e --skip-nx-cache` -> **GREEN**: `Test Files 5 passed (5)`, `Tests 26 passed (26)` -- `generator-e2e` (1), `nx-add-e2e` (1), the extended `tarball-audit` (6), `install-smoke` (1), `release-hygiene` (17).
- **Task 1 structural check:** the fixture verify script passes (2-reference solution tsconfig, targetDefaults-free `nx.json`, un-wired library `project.json`, no lockfile, no `e2e/consumer-generator/` project dir).
- **Prettier:** all created/modified files pass `prettier --check` (CI `format:check` gate).
- **Lint:** e2e projects have no `lint` target (`nx run-many -t lint` skips them); the plugin lint gate is unaffected (no plugin source changed).
- Note: the `NX ... consumer-generator:typecheck failed` / `consumer-app:typecheck failed` lines in the run log are the EXPECTED injected-error runs the specs catch and assert on -- not spec failures.

## Known Stubs

None. The fixture's hardcoded label is intentional clean test data, not a stub; no `TODO`/`FIXME`/placeholder in any created file.

## Self-Check: PASSED

- FOUND: all 8 `fixtures/consumer-generator/` files + `src/generator-e2e.int.spec.ts` + `src/nx-add-e2e.int.spec.ts` (created); `src/tarball-audit.int.spec.ts` (modified).
- FOUND: commits `de4c423` (Task 1), `ff53522` (Task 2), `7f2f201` (Task 3).
- Full suite GREEN (26/26) via `npx nx test angular-typechecker-install-e2e`.

## Next Phase Readiness

- All Phase 15 requirements complete: GE2E-01/02/03 (this plan) + GUARD-01 (plan 15-01). The generator suite is proven end-to-end from a clean tarball install -- the last coverage gate before the v0.1.0 milestone Release PR.
- **Phase gate (orchestrator):** run the full e2e run-many on the merged main tree: `npx nx run-many -t test -p angular-typechecker-install-e2e angular-typechecker-cache-e2e angular-typechecker-matrix-e2e`.
- No blockers. `test(...)` no-bump commits only; NO version bump / release performed (the 0.1.0 cut is the milestone Release PR, per AGENTS.md).

---
*Phase: 15-generator-e2e-ci-self-audit-guard*
*Completed: 2026-07-02*
