---
phase: 23-init-schematic-parity-first-party-ng-add
plan: 01
subsystem: generators
tags: [nx-devkit, angular-cli, schematics, convertNxGenerator, init, ng-add]

# Dependency graph
requires:
  - phase: 22-configuration-schematic-the-angular-json-write-fork
    provides: the shared angular.json write-fork + the convertNxGenerator re-export template + the angular.json-seeded test substrate + the nx-generators-surface-regression spec
provides:
  - additive tree.exists('angular.json') early-return fork in the shipped initGenerator (ACS-03) -- seeds no caching, creates no stray nx.json on an Angular CLI workspace
  - exported NO_CACHING_NOTICE const (single source for the notice wording, D-06) that Plan 03's ng-add generator will import
  - convertNxGenerator(initGenerator) re-export at src/schematics/init/schematic.ts
  - collection.json init schematic entry (ng generate angular-typechecker:init parity)
affects: [23-03 ng-add generator (imports NO_CACHING_NOTICE), Phase 24 e2e/docs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fork-in-the-shared-generator: the Angular-CLI divergence is an additive tree.exists('angular.json') branch INSIDE the shipped generator, so convertNxGenerator re-exports the exact same code (ng g and nx g run it identically)"
    - "Single-source notice const (NO_CACHING_NOTICE) co-located with TYPECHECK_EXECUTOR_ID so the wording lives in one place across init + ng-add"

key-files:
  created:
    - packages/angular-typechecker/src/schematics/init/schematic.ts
    - packages/angular-typechecker/src/generators/init/init-angular-cli.spec.ts
  modified:
    - packages/angular-typechecker/src/generators/init/generator.ts
    - packages/angular-typechecker/collection.json
    - packages/angular-typechecker/src/schematics/configuration/nx-generators-surface-regression.spec.ts

key-decisions:
  - "init parity via an additive early-return fork (D-04), NOT a plain re-export -- the skip is by design, not incidental (updateNxJson is a verified no-op off-Nx, but an in-corpus contradiction made the explicit skip the safe design)"
  - "NO_CACHING_NOTICE exported from init/generator.ts co-located with TYPECHECK_EXECUTOR_ID (D-06) -- the single source Plan 03's ng-add imports"
  - "collection.json declares init; generators.json still declares init so nx add angular-typechecker -> <pkg>:init stays resolvable via generators ?? schematics (nx add UNCHANGED, Pitfall 5)"

patterns-established:
  - "Additive tree.exists('angular.json') fork + return early (mirrors the Phase-22 configuration write-fork discipline)"
  - "convertNxGenerator thin re-export (mirrors src/schematics/configuration/schematic.ts)"

requirements-completed: [ACS-03]

# Metrics
duration: 18min
completed: 2026-07-11
---

# Phase 23 Plan 01: init schematic parity Summary

**`ng generate angular-typechecker:init` parity via an additive `tree.exists('angular.json')` early-return fork in the shipped `initGenerator` that seeds no caching and creates no stray `nx.json`, plus the shared exported `NO_CACHING_NOTICE` const the Plan-03 `ng-add` generator will import.**

## Performance

- **Duration:** ~18 min
- **Tasks:** 2 of 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- Added the additive Angular CLI fork to `initGenerator`: on an `angular.json` workspace it prints `NO_CACHING_NOTICE` via `logger.info` and returns BEFORE `readNxJson`/`updateNxJson`, so no caching is seeded and no stray `nx.json` is created (ACS-03, D-04). The Nx else-branch is byte-unchanged.
- Exported the single-source `NO_CACHING_NOTICE` const co-located with `TYPECHECK_EXECUTOR_ID` (D-06) -- the wording lives in one place for both the init fork and the future `ng-add` generator.
- Added the `convertNxGenerator(initGenerator)` re-export and the `collection.json` `init` entry (D-05); the `generators.json` `init` generator is untouched so `nx add`/`nx g` still resolve via `generators ?? schematics` (nx add UNCHANGED).
- Proved the fork with a new angular.json-seeded spec and extended the surface-regression spec; full test suite grew 288 -> 293.

## Task Commits

Each task was committed atomically:

1. **Task 1: init angular.json fork + NO_CACHING_NOTICE export + init schematic re-export + collection.json init entry** - `df2d804` (feat)
2. **Task 2: init CLI-fork spec (ACS-03) + extend the surface-regression for init** - `88bbf1d` (test)

## Files Created/Modified

- `packages/angular-typechecker/src/generators/init/generator.ts` (modified) - Added `logger` to the `@nx/devkit` import; exported `NO_CACHING_NOTICE`; added the additive `tree.exists('angular.json')` early-return fork at the top of `initGenerator`. Nx else-branch byte-unchanged.
- `packages/angular-typechecker/src/schematics/init/schematic.ts` (created) - Thin `export default convertNxGenerator(initGenerator)` re-export (mirrors the configuration schematic).
- `packages/angular-typechecker/collection.json` (modified) - Added the `init` schematic entry alongside `configuration` (factory -> `./src/schematics/init/schematic`, schema reuses `./src/generators/init/schema.json`).
- `packages/angular-typechecker/src/generators/init/init-angular-cli.spec.ts` (created) - angular.json-seeded substrate (app+lib, nx.json deleted) proving the fork creates no stray nx.json, seeds no `targetDefaults` (`readNxJson` stays null), and prints `NO_CACHING_NOTICE` once.
- `packages/angular-typechecker/src/schematics/configuration/nx-generators-surface-regression.spec.ts` (modified) - Reads `collection.json`; asserts the `init` schematic factory is declared AND `generators.json` still declares the `init` generator factory (nx add unchanged).

## Decisions Made

None beyond the plan's locked decisions (D-04/D-05/D-06) -- followed the plan as specified. Notice wording chosen within planner discretion (end-user-facing, no internal ids): "angular-typechecker: Angular CLI has no build/target-result cache to seed, so the typecheck target(s) were wired without caching. On an Nx workspace, target caching is configured automatically."

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Prettier flagged the new `init-angular-cli.spec.ts` (a `vi.spyOn(...).mockImplementation(...)` chain needed line-wrapping). Fixed with `prettier --write` on the single file; re-check clean. Purely cosmetic, no logic change; tests re-confirmed green.

## Verification

- `nx build angular-typechecker` green; `dist/packages/angular-typechecker/collection.json` ships the `init` entry.
- `nx test angular-typechecker` green: 293 passed (was 288; +3 init-angular-cli, +2 surface-regression). Existing `init.spec.ts`, `target-defaults-drift.spec.ts`, `schema-parity.spec.ts` pass unchanged (Nx branch byte-unchanged).
- `nx lint angular-typechecker` green (maxWarnings:0).
- `prettier --check` clean on all touched files.

## Next Phase Readiness

- `NO_CACHING_NOTICE` is exported and ready for Plan 03's `ngAddGenerator` to import (D-06 single-source contract).
- The `configuration` write-fork + the init fork are both in place; Plan 03 composes them for `ng add` auto-wire-all.
- No blockers.

## Self-Check: PASSED

- All created/modified files present on disk (5/5).
- Both task commits found in git log (`df2d804`, `88bbf1d`).
- `dist/packages/angular-typechecker/collection.json` ships the `init` entry.

---
*Phase: 23-init-schematic-parity-first-party-ng-add*
*Completed: 2026-07-11*
