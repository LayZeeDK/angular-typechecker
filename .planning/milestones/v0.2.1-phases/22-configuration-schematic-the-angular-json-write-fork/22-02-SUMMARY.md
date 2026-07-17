---
phase: 22-configuration-schematic-the-angular-json-write-fork
plan: 02
subsystem: schematics
tags: [nx-devkit, angular-cli, convertNxGenerator, collection.json, ng-generate, additive-safety, manifest]

# Dependency graph
requires:
  - phase: 22-configuration-schematic-the-angular-json-write-fork
    provides: the Plan 01 tree.exists('angular.json') write-fork inside the shared configuration generator (the default export re-exported here) and the resolveTsConfigLeaves leaf-array resolver
  - phase: 21-angular-cli-builder-engine-multi-tsconfig-gate-a-spike-go-no
    provides: the Phase-21 executors ?? builders additive pattern (package.json builders field, build asset glob, nx-surface-regression.spec.ts) cloned here for the generators ?? schematics axis
provides:
  - a NEW collection.json declaring only the configuration schematic (factory -> ./src/schematics/configuration/schematic, schema REUSES ./src/generators/configuration/schema.json verbatim)
  - src/schematics/configuration/schematic.ts = export default convertNxGenerator(configurationGenerator) (imports only @nx/devkit + the local generator; zero new production dependency)
  - the package.json schematics field + collection.json files entry (NEW siblings of executors/generators/builders, D-06)
  - the project.json build asset glob copying collection.json into dist root (Pitfall 4 closed)
  - nx-generators-surface-regression.spec.ts proving generators ?? schematics keeps collection.json Nx-invisible (ACS-04)
affects: [23 ng-add auto-wire-all (adds init/ng-add entries to this same collection.json), 24 real-OSS + scaffolded e2e (runs ng generate against the shipped collection.json + tarball audit)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "convertNxGenerator re-export twin of the Phase-21 convertNxExecutor builder: a ~3-line schematic.ts re-exporting the shared generator, declared in a new collection.json"
    - "Additive-only manifest siblings: schematics field + collection.json (files + build asset) added alongside the untouched executors/generators/builders surface; Nx resolves generators ?? schematics so the collection is Nx-invisible"

key-files:
  created:
    - packages/angular-typechecker/collection.json
    - packages/angular-typechecker/src/schematics/configuration/schematic.ts
    - packages/angular-typechecker/src/schematics/configuration/nx-generators-surface-regression.spec.ts
  modified:
    - packages/angular-typechecker/package.json
    - packages/angular-typechecker/project.json
    - packages/angular-typechecker/src/package-manifest.spec.ts

key-decisions:
  - "collection.json ships the advisory $schema (../../node_modules/@angular-devkit/schematics/collection-schema.json) because the file resolves in node_modules (Assumption A3 confirmed present)"
  - "The schematic REUSES the generator schema.json verbatim -- no sanitized schematic schema (unlike the Phase-21 builder), because the $default/x-* conventions originate in Angular schematics"
  - "The PKG-01 manifest contract test was updated to reflect the additive siblings (collection.json in files + a schematics-field assertion mirroring the builders one) -- the additive edit necessarily touched the locked allowlist contract"

requirements-completed: [ACS-04]

# Metrics
duration: 5min
completed: 2026-07-10
---

# Phase 22 Plan 02: `configuration` schematic + additive `ng generate` surface Summary

**A NEW `collection.json` + `convertNxGenerator` re-export wiring the shared `configuration` generator to the Angular CLI schematics engine additively (`schematics` field + build asset), with a `generators ?? schematics` regression proving the Nx surface is byte-unchanged (ACS-04).**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-10T20:45:41Z
- **Completed:** 2026-07-10T20:50:52Z
- **Tasks:** 2
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- New `collection.json` declares ONLY the `configuration` schematic (`init`/`ng-add` are Phase 23): `factory -> ./src/schematics/configuration/schematic`, `schema -> ./src/generators/configuration/schema.json` (REUSED verbatim), plus the advisory `$schema` (confirmed present in node_modules).
- New `src/schematics/configuration/schematic.ts` (`export default convertNxGenerator(configurationGenerator)`) clones the Phase-21 `builder.ts` shape on the generator axis; imports only `@nx/devkit` (already pinned) + the local generator, so `@nx/dependency-checks` stays green and no new production dependency is introduced. It compiled to CJS `.js` in dist via the existing `tsconfig.lib.json` `include: ["src/**/*.ts"]` -- no build-config change.
- `package.json` gained `"schematics": "./collection.json"` as a NEW SIBLING of `executors`/`generators`/`builders` (the `generators` field stays declared + unchanged, D-06) and `collection.json` in the `files` allowlist.
- `project.json` build `assets` gained a fourth glob copying `collection.json -> .`, mirroring the `builders.json` entry; `nx build` proves `dist/packages/angular-typechecker/collection.json` ships (Pitfall 4 closed).
- New `nx-generators-surface-regression.spec.ts` (3 assertions) mirrors the Phase-21 `executors ?? builders` spec on the generator axis: `generators` stays `./generators.json`, `schematics` is the additive `./collection.json`, and the `configuration` generator factory stays resolvable -- proving Nx reads `generators` first and the collection is Nx-invisible (ACS-04).

## Task Commits

Each task was committed atomically:

1. **Task 1: Additive manifest wiring (collection.json, schematic.ts, package.json, project.json)** - `625c567` (feat)
2. **Task 2: Nx-surface regression spec -- generators ?? schematics (ACS-04)** - `81720d9` (test)

## Files Created/Modified
- `packages/angular-typechecker/collection.json` (NEW) - Angular schematics manifest, `configuration` entry only; schema reuses the generator schema.json verbatim.
- `packages/angular-typechecker/src/schematics/configuration/schematic.ts` (NEW) - `convertNxGenerator(configurationGenerator)` re-export (~3 lines + doc comment).
- `packages/angular-typechecker/src/schematics/configuration/nx-generators-surface-regression.spec.ts` (NEW) - static `generators ?? schematics` regression (3 tests, fast tier, no Nx invocation, no compiler-cli load).
- `packages/angular-typechecker/package.json` (MODIFIED) - added the `schematics` field + `collection.json` files entry (both additive siblings).
- `packages/angular-typechecker/project.json` (MODIFIED) - added the `collection.json` build asset glob.
- `packages/angular-typechecker/src/package-manifest.spec.ts` (MODIFIED) - PKG-01 contract updated for the additive siblings (see Deviations).

## Decisions Made
- **`$schema` included, not omitted.** RESEARCH Assumption A3 made `$schema` conditional on `@angular-devkit/schematics/collection-schema.json` resolving. Verified present in `node_modules`, so the advisory `$schema` is included.
- **Schema reused verbatim.** No sanitized schematic schema file was authored (the Phase-21 builder needed one; the schematic dialect natively accepts the generator schema's `$default`/`x-*` conventions).
- **`--skip-nx-cache` used for all verification runs** to avoid the daemon reading stale cached results while iterating on the manifest.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated the PKG-01 manifest contract test for the additive siblings**
- **Found during:** Task 2 (`nx test` after the Task 1 manifest edits)
- **Issue:** `src/package-manifest.spec.ts` locks the exact `package.json` `files` allowlist with `toEqual([...])`. Adding `collection.json` to `files` in Task 1 broke that assertion (1 failing test). This was directly caused by this plan's additive edit, not a pre-existing/out-of-scope failure.
- **Fix:** Added `collection.json` to the expected `files` array (in the same position as the real manifest), added `schematics?: string` to the test's `PluginManifest` interface, and added a `schematics` field assertion mirroring the existing `builders` one -- keeping the additive-safety contract honest and complete.
- **Files modified:** `packages/angular-typechecker/src/package-manifest.spec.ts`
- **Commit:** `81720d9` (bundled with the Task 2 regression spec, since both are the ACS-04 additive-safety proof)

## TDD Gate Compliance

Not applicable -- neither task carried `tdd="true"`. Task 1 is manifest wiring (config); Task 2 is a static regression spec asserting the already-landed Task 1 manifest state. Both are exempt (config-only / test-only under the behavior-adding predicate).

## Known Stubs

None -- `collection.json` declares a real factory pointing at a real compiled re-export; no placeholder/empty values or TODOs.

## Issues Encountered
The only issue was the PKG-01 contract test failure documented under Deviations -- expected fallout of the additive `files` edit, resolved by updating the contract to match the new additive surface.

## Verification
- `nx lint angular-typechecker`: exit 0 (Open Question 1 hard gate -- `@nx/nx-plugin-checks` + `@nx/dependency-checks` accept the new `collection.json` manifest + the `@nx/devkit`-only import).
- `nx build angular-typechecker`: exit 0; `dist/packages/angular-typechecker/collection.json` present AND `dist/.../src/schematics/configuration/schematic.js` present (asset glob + CJS compile proven, Pitfall 4 closed).
- `nx test angular-typechecker` (fast tier): 288 passed (34 files), including the new 3-test `nx-generators-surface-regression.spec.ts` and the updated `package-manifest.spec.ts`.
- `nx typecheck angular-typechecker`: exit 0.
- `git grep` confirms the `schematics` field + `collection.json` files entry in `package.json` and `"generators": "./generators.json"` unchanged; `rg` confirms `convertNxGenerator` in `schematic.ts` and `manifest.schematics` in the regression spec (both untracked-at-check-time, so `rg` not `git grep`).
- The Nx `executors`/`generators` surface and `executors.json`/`generators.json` are byte-unchanged; the engine, executor, builder, and public barrel were not touched.

## Next Phase Readiness
- The Angular CLI `ng generate angular-typechecker:configuration <project>` surface is wired and ships in the tarball. Phase 23 composes the SAME `collection.json` by adding `init` + `ng-add` schematic entries (auto-wire-all); Phase 24 runs `ng generate` against the shipped collection + the tarball additive-only audit.

## Self-Check: PASSED

- FOUND: packages/angular-typechecker/collection.json
- FOUND: packages/angular-typechecker/src/schematics/configuration/schematic.ts
- FOUND: packages/angular-typechecker/src/schematics/configuration/nx-generators-surface-regression.spec.ts
- FOUND commit: 625c567 (feat Task 1)
- FOUND commit: 81720d9 (test Task 2)

---
*Phase: 22-configuration-schematic-the-angular-json-write-fork*
*Completed: 2026-07-10*
