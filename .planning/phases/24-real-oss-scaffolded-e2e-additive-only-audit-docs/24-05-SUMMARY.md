---
phase: 24-real-oss-scaffolded-e2e-additive-only-audit-docs
plan: 05
subsystem: e2e
tags: [e2e, angular-cli, ng-add, yarn, pnpm, vitest, verdaccio, acv-02]

# Dependency graph
requires:
  - phase: 24-real-oss-scaffolded-e2e-additive-only-audit-docs
    provides: "nx declared as a direct ^23.0.0 dependency (24-04) so the published dist installs nx for yarn/pnpm consumers"
provides:
  - "Finalized CI-authoritative CLI x yarn e2e (flat + workspace): real ng add install + ng g wire + per-project scoping"
  - "Committed CLI x pnpm-workspace name-collision e2e: app build leaf never silently dropped (committed ACV-01 gate #2)"
  - "Confirmed + documented finding: yarn `ng add` installs but does NOT auto-wire (Angular CLI ng-add detection fails on yarn's node-modules layout)"
affects: [release, ng-add, yarn, pnpm]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pnpm 11 build-script gate satisfied declaratively via `strictDepBuilds: false` in pnpm-workspace.yaml (skip ALL build scripts) rather than `allowBuilds` allowlisting -- the type-check e2e needs no native postinstall artifacts, so skipping runs zero postinstall code (safest, mirrors npm)"
    - "yarn `ng add` install + explicit `ng g <pkg>:ng-add` wire (Angular CLI does not run the ng-add schematic under yarn); assert no-wire after `ng add` to lock the quirk"

key-files:
  created:
    - e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run-pnpm.e2e.spec.ts
    - .planning/todos/pending/readme-yarn-ng-add-caveat.md
  modified:
    - e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run-yarn.e2e.spec.ts
    - .planning/debug/resolved/cli-yarn-e2e-wrong-version.md

key-decisions:
  - "Yarn wiring via `ng g angular-typechecker:ng-add` (Option A1, coordinator-approved): Angular CLI's `ng add` under yarn INSTALLS angular-typechecker + nx (transitive via 24-04) but does NOT run the ng-add schematic -- its post-install `createSchematic('ng-add')` detection silently fails on yarn's node-modules layout, so it reports 'does not provide any ng add actions'. npm and pnpm both run the same schematic on the identical package. The spec keeps the real `ng add` install, asserts the no-wire state, then wires via `ng g` (the plan's authorized `ng add`-misbehaves -> `ng g` fallback, previously written only for pnpm)."
  - "pnpm build-script gate satisfied via `strictDepBuilds: false` (skip ALL build scripts), NOT the plan's `allowBuilds: { nx: true }`: the full Angular CLI fixture flags 5-6 transitive native build-script packages (@parcel/watcher, esbuild, lmdb, msgpackr-extract, + nx), so `allowBuilds: { nx: true }` alone fails the install. Skipping all scripts is sufficient (the type-check needs no native postinstall artifacts), strictly safer (runs zero postinstall code vs allowBuilds running them), avoids @parcel/watcher build-from-source on Windows arm64, and mirrors npm's proven skip-and-succeed."

patterns-established:
  - "A CLI-under-yarn behavior difference (ng add no-autowire) is locked as a regression by asserting the target is undefined immediately after `ng add`, then wiring via `ng g`."

requirements-completed: [ACV-02]

# Metrics
duration: 70min
completed: 2026-07-12
---

# Phase 24 Plan 05: yarn + pnpm CLI e2e finalization Summary

**Finalized the CI-authoritative Angular CLI e2e coverage on the 24-04 dependency fix: a real-`ng add` yarn spec (flat + workspace) that wires via `ng g` because Angular CLI's `ng add` does not run the ng-add schematic under yarn, and a new committed CLI x pnpm-workspace name-collision spec proving the app build leaf is never silently dropped.**

## Performance

- **Duration:** ~70 min (dominated by 4 full e2e runs at ~6 min each; each rebuilds+republishes the shared dist)
- **Completed:** 2026-07-12
- **Tasks:** 2
- **Files created/modified for tasks:** 2 spec files (1 created, 1 modified)

## Accomplishments

- `ng-add-ng-run-yarn.e2e.spec.ts` finalized: debug-era temp scaffolding removed (no `NX_VERSION`, no `corepack yarn add -D nx`, no `atc-probe` diagnostics), installs via the real `corepack yarn ng add angular-typechecker --skip-confirmation` (nx arrives transitively via 24-04), asserts `ng add` did NOT wire under yarn, then wires via `corepack yarn ng g angular-typechecker:ng-add`; both flat + workspace layouts prove auto-wire-all + per-leaf scoping (app TS2322+TS2345 vs lib TS2554, no cross-bleed), clean baseline exit 0, no stray nx.json, no `ERR_REQUIRE_ESM`. `enableMirror: false` retained (separate mirror fix). Docstring corrected (refuted `ng g`-vs-`ng add` collection-resolution claim removed; the real cause -- CLI ng-add detection -- documented).
- `ng-add-ng-run-pnpm.e2e.spec.ts` created: an Angular CLI workspace that is ALSO a pnpm workspace (`packages: ['.']`) whose root package.json name (`ng-cli-workspace`) collides with the app project name -- the committed form of the ACV-01 gate #2 realworld-angular scenario. `ng add` (which DOES run the schematic under pnpm) wires the app target with the FULL `[tsconfig.app.json, tsconfig.spec.json]` array (build leaf never dropped) + the lib target's array; per-project scoping proven; no stray nx.json; 127.0.0.1 Verdaccio safety re-asserted; pnpm 11 pin + effective-major===11 assertion; skips cleanly where pnpm is unavailable.
- Debug doc `cli-yarn-e2e-wrong-version.md` resolved + moved to `.planning/debug/resolved/`.

## Task Commits

Each task was committed atomically (filename-scoped staging):

1. **Task 1: Finalize the yarn CLI e2e (real ng add install + ng g wire)** - `76c6f35` (test)
2. **Task 2: Add the CLI x pnpm-workspace name-collision e2e** - `c5c6912` (test)
3. **Debug-doc resolution (separate docs commit)** - `6fcd782` (docs)

## Files Created/Modified

- `e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run-yarn.e2e.spec.ts` (modified) - finalized to real `ng add` + `ng g`, scaffolding removed, docstring corrected
- `e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run-pnpm.e2e.spec.ts` (created) - CLI x pnpm-workspace name-collision spec
- `.planning/debug/resolved/cli-yarn-e2e-wrong-version.md` (moved + resolved) - final resolution appended
- `.planning/todos/pending/readme-yarn-ng-add-caveat.md` (created) - deferred README follow-up

## Deviations from Plan

Two deviations, both surfaced at a checkpoint and coordinator-approved before implementation.

### 1. [Rule 4 - Approach] Yarn wiring via `ng g`, not `ng add` (Option A1)

- **Found during:** Task 1 (three full e2e runs)
- **Issue:** The plan's Task-1 premise -- "the REAL `ng add angular-typechecker` auto-wires under yarn" -- is FALSE. Under yarn 4, `ng add` installs angular-typechecker + `nx` (transitively via 24-04) + `collection.json` correctly, but Angular CLI reports "Package installed successfully. The package does not provide any `ng add` actions, so no further actions were taken" and runs NO schematic. Root cause: Angular CLI's post-install ng-add detection (`collection.createSchematic('ng-add')` in `@angular/cli/src/commands/add/cli.js`) throws under yarn's node-modules layout and is silently caught (`hasSchematics=false`). npm AND pnpm both pass this detection and wire on the identical package -- so it is an Angular-CLI-under-yarn behavior, NOT an angular-typechecker packaging defect, and NOT a collection-resolution issue.
- **Fix:** Keep the real `ng add` as the install step; assert no typecheck target exists after `ng add` (locking the quirk as a regression); wire via `corepack yarn ng g angular-typechecker:ng-add` (VERIFIED green, both layouts). This is the plan's OWN authorized `ng add`-misbehaves -> `ng g` fallback (the plan wrote exactly that escape hatch for pnpm), applied to yarn where `ng add` provably misbehaves.
- **Acceptance-criteria impact (explicit, approved):** the Task-1 grep `rg -c "...ng g angular-typechecker:ng-add..."` is now **1**, not the planned 0. The other three scaffolding tokens (`atc-probe`, `NX_VERSION`, `yarn add -D nx`) are 0, and `enableMirror: false` is 1, as required.
- **Files modified:** `e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run-yarn.e2e.spec.ts`
- **Commit:** `76c6f35`

### 2. [Rule 3 - Blocking] pnpm build-script gate via `strictDepBuilds: false`, not `allowBuilds: { nx: true }`

- **Found during:** Task 2 (first full e2e run)
- **Issue:** The plan mandated `allowBuilds: { nx: true }` only, but the full Angular CLI `ng-cli-workspace` fixture's transitive deps flag **5-6** native build-script packages (`@parcel/watcher`, `esbuild` x2, `lmdb`, `msgpackr-extract`, + `nx` after `ng add`) -- so `allowBuilds: { nx: true }` alone fails the provisioning `pnpm install` with `ERR_PNPM_IGNORED_BUILDS`. (The plan's "only nx flagged" assumption held for the minimal `consumer-generator` fixture in `nx-add-pnpm.e2e.spec.ts`, not this full Angular workspace.)
- **Fix:** `strictDepBuilds: false` in `pnpm-workspace.yaml` -- skips ALL build scripts. The type-check e2e needs none of those native postinstall artifacts (only wiring + `ng run typecheck`), so skipping is sufficient AND strictly safer than `allowBuilds` (runs ZERO postinstall code vs `allowBuilds` running the approved scripts, incl. `@parcel/watcher`'s fragile build-from-source on Windows arm64), and it mirrors npm's proven skip-and-succeed on the same fixture (npm ACV-02 passes).
- **Threat-model impact (T-24-10):** disposition changes from "allowBuilds approves ONLY nx's postinstall" to "**no dependency build scripts run at all**" -- MORE restrictive than the planned `allowBuilds: { nx: true }`, not less. The 127.0.0.1-only publish gate (T-24-05) and clean-env / stripAllNpmConfig (T-24-07) invariants are unchanged.
- **Files created:** `e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run-pnpm.e2e.spec.ts`
- **Commit:** `c5c6912`

## Deferred / Follow-up (out of scope for this plan)

- **README yarn caveat (release-facing, decision owner: user).** The README `## Angular CLI` section claims `ng add` auto-wire-all without a PM caveat; this is INACCURATE for yarn (a yarn user's `ng add angular-typechecker` installs but wires nothing; they must run `ng g angular-typechecker:ng-add`). Recorded in `.planning/todos/pending/readme-yarn-ng-add-caveat.md` and in STATE.md Blockers/Concerns. Decide before the v0.2.1 release: README yarn caveat +/- an upstream Angular CLI issue. Deliberately NOT auto-fixed here (this plan ships two e2e specs only).

## Verification Evidence

- `NX_DAEMON=false npx nx e2e angular-typechecker-ng-cli-e2e --skip-nx-cache` - PASS: Test Files 3 passed (3), Tests 4 passed (4). All four specs green:
  - `ng-add-ng-run.e2e.spec.ts` (npm ACV-02) - PASS
  - `ng-add-ng-run-yarn.e2e.spec.ts` - PASS (flat + workspace layouts)
  - `ng-add-ng-run-pnpm.e2e.spec.ts` - PASS (root name collision, full [build, spec] array)
- `NX_DAEMON=false npx nx test angular-typechecker --skip-nx-cache` - PASS (coverage guard GUARD-01/01b/01c/01d green with the new pnpm spec present; 349 tests).
- Yarn spec greps: `rg -c "atc-probe|NX_VERSION|yarn add -D nx" ...` = 0; `rg -c "enableMirror: false" ...` = 1.

## Self-Check: PASSED

- FOUND: `e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run-yarn.e2e.spec.ts`
- FOUND: `e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run-pnpm.e2e.spec.ts`
- FOUND: `.planning/debug/resolved/cli-yarn-e2e-wrong-version.md`
- FOUND: `.planning/todos/pending/readme-yarn-ng-add-caveat.md`
- FOUND commit: `76c6f35` (Task 1)
- FOUND commit: `c5c6912` (Task 2)
- FOUND commit: `6fcd782` (debug-doc resolution)

---
*Phase: 24-real-oss-scaffolded-e2e-additive-only-audit-docs*
*Completed: 2026-07-12*
