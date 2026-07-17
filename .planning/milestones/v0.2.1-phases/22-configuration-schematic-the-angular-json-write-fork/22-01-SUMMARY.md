---
phase: 22-configuration-schematic-the-angular-json-write-fork
plan: 01
subsystem: generators
tags: [nx-devkit, angular-cli, angular.json, updateJson, tsconfig, generator, write-fork]

# Dependency graph
requires:
  - phase: 21-angular-cli-builder-engine-multi-tsconfig-gate-a-spike-go-no
    provides: the ENG-01 tsConfig string|string[] engine (consumes the leaf array) and the convertNxExecutor builder id angular-typechecker:typecheck reused as the CLI builder id
provides:
  - resolveTsConfigLeaves(tree, projectConfig, schema) -> string[] (RF-01 Approach A: projectType-convention + tree.exists probe; --tsConfig override short-circuit; empty-array throw)
  - an early tree.exists('angular.json') write-fork in the shared configuration generator that writes projects.<p>.architect.<targetName> = { builder, options.tsConfig: [buildLeaf, specLeaf] } via updateJson, skipping the Nx init (D-04)
  - the Nx path preserved byte-unchanged as the else branch (single-string solution tsConfig; resolveTsConfig / resolveTsConfigOverride untouched)
affects: [22-02 configuration schematic (convertNxGenerator re-exports this generator), 23 ng-add auto-wire-all (composes this fork), 24 real-OSS + scaffolded e2e (verifies the written targets)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Workspace-type write-fork: one shared generator with an early tree.exists('angular.json') branch; angular.json edited via @nx/devkit updateJson (updateProjectConfiguration cannot write angular.json), Nx else-branch unchanged"
    - "Leaf-array resolver alongside (never replacing) the single-string resolver so the Nx path stays byte-identical"

key-files:
  created:
    - packages/angular-typechecker/src/generators/configuration/configuration-angular-cli.spec.ts
  modified:
    - packages/angular-typechecker/src/generators/configuration/generator.ts

key-decisions:
  - "RF-01 resolved to Approach A (projectType-convention + tree.exists probe), NOT Approach B: the default @angular/build:ng-packagr library builder carries no tsConfig in build.options, so B silently misses the library build leaf"
  - "Collision by BUILDER id read defensively from project.architect ?? project.targets, then always write to architect; idempotent rewrite preserves user keys + extra options"
  - "targetName default + empty-name guard hoisted above the fork so both branches share them"

patterns-established:
  - "tree.exists('angular.json') write-fork discriminates Angular CLI vs Nx substrate; the branch writes architect + builder (CLI vocabulary) while the Nx else-branch keeps targets + executor"
  - "Seed a GENUINE Angular CLI test substrate (createTreeWithEmptyWorkspace then delete nx.json + write angular.json + leaves; no addProjectConfiguration -- the readProjectConfiguration polyfill reads the project from angular.json)"

requirements-completed: [ACS-01, ACS-02, COV-01]

# Metrics
duration: 14min
completed: 2026-07-10
---

# Phase 22 Plan 01: Angular CLI `angular.json` write-fork Summary

**A `tree.exists('angular.json')` fork in the shared `configuration` generator that writes a per-project `architect.typecheck` target with `tsConfig: [buildLeaf, specLeaf]` (via `@nx/devkit` `updateJson`), leaving the Nx path byte-unchanged.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-10T22:23:00+02:00
- **Completed:** 2026-07-10T22:37:16+02:00
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- `resolveTsConfigLeaves` (RF-01 Approach A): resolves a project's `[buildLeaf, specLeaf]` array by projectType convention (`tsconfig.app.json` / `tsconfig.lib.json`) plus `tsconfig.spec.json`, each existence-probed against the virtual `Tree`; `--tsConfig` override short-circuits to a single-element array; an empty result throws the located error (never a silently under-checking target).
- Early `tree.exists('angular.json')` write-fork: writes `projects.<p>.architect.<targetName> = { builder: 'angular-typechecker:typecheck', options: { tsConfig } }` via `updateJson`, collision-checked by builder id and idempotent (preserves user keys + extra options), skipping the Nx init (D-04, no stray `nx.json`).
- Nx path preserved as the byte-unchanged else branch: `resolveTsConfig` / `resolveTsConfigOverride` bodies untouched; `configuration.spec.ts` (14 tests) stays green.
- New `configuration-angular-cli.spec.ts` (10 cases) proving ACS-01 (leaf-array shape, idempotency, collision, targetName/override/single-leaf/no-leaf), ACS-02 (no stray `nx.json`), and COV-01 (two-project per-project scoping, no cross-project bleed) on a genuine `angular.json`-seeded substrate.

## Task Commits

Each task was committed atomically (TDD RED -> GREEN):

1. **Task 1: Author `configuration-angular-cli.spec.ts` (RED)** - `b168ebc` (test)
2. **Task 2: Add `resolveTsConfigLeaves` + the `tree.exists('angular.json')` write-fork (GREEN)** - `d5cc4be` (feat)

## Files Created/Modified
- `packages/angular-typechecker/src/generators/configuration/configuration-angular-cli.spec.ts` - 10-case fast-tier spec on a seeded angular.json substrate (nx.json deleted); every case asserts angular.json present AND nx.json absent so the fork (not the Nx else-branch) runs.
- `packages/angular-typechecker/src/generators/configuration/generator.ts` - added `resolveTsConfigLeaves` + the minimal `AngularJson*` interfaces; hoisted the `targetName` default + empty-name guard; added the early `tree.exists('angular.json')` write-fork; kept the Nx path as the byte-unchanged else branch.

## Decisions Made
- **RF-01 = Approach A, not B.** The default `@angular/build:ng-packagr` library builder has no `tsConfig` in `build.options` (it lives under `configurations`), so reading architect targets (B) would silently miss the library build leaf. Convention + existence-probe (A) produces exactly the expected arrays on both real substrates.
- **Collision read defensively, write canonically.** The collision candidate is read from `project.architect ?? project.targets` (the alias), but the target is always written to `architect` (the canonical key Angular scaffolds use).
- **`--tsConfig` override written as `[resolved]`** (single-element array) for CLI-branch shape uniformity; the ENG-01 engine accepts string | string[].

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

Task 2 was `tdd="true"`. Both gates are present in git log: a `test(...)` RED commit (`b168ebc`) precedes the `feat(...)` GREEN commit (`d5cc4be`). No REFACTOR commit was needed (the implementation was clean on first write). During RED, 6 leaf-array cases failed for the right reason (the Nx path throws `Cannot update Project ... Use addProjectConfiguration()` on angular.json projects) while `configuration.spec.ts` stayed green; all 10 pass after GREEN.

## Known Stubs

None - the fork writes real resolved leaf arrays; no placeholder/empty values or TODOs.

## Issues Encountered
None. The RED step surfaced the expected `updateProjectConfiguration` throw on angular.json projects, confirming the Nx path genuinely cannot write angular.json (Pitfall 2) and that the fork is required.

## Verification
- `nx test angular-typechecker` (fast tier): 284 passed (33 files), including the 10 new CLI-fork cases and the 14 untouched Nx cases.
- `nx typecheck angular-typechecker`: exit 0 (spec + generator type-clean under `tsconfig.spec.json` / `tsconfig.drift.json` / `tsconfig.tools.json`).
- `git grep` confirms `resolveTsConfigLeaves` (definition + call site) and the single `updateJson<AngularJsonWorkspace>(tree, 'angular.json', ...)` fork write.
- `resolveTsConfig` / `resolveTsConfigOverride` bodies unchanged (diff touches only the rewritten `configurationGenerator` doc/body).

## Next Phase Readiness
- The write-fork engine is complete and reachable via `nx g angular-typechecker:configuration <cli-project>`. Plan 22-02 adds the `ng generate` Angular CLI surface (`collection.json` + `convertNxGenerator` re-export + the `schematics` package.json field + build asset) and the `generators ?? schematics` regression assertion (ACS-04).
- Phase 23 `ng-add` auto-wire-all and Phase 24 e2e both compose this same fork.

## Self-Check: PASSED

- FOUND: packages/angular-typechecker/src/generators/configuration/configuration-angular-cli.spec.ts
- FOUND: packages/angular-typechecker/src/generators/configuration/generator.ts
- FOUND commit: b168ebc (test RED)
- FOUND commit: d5cc4be (feat GREEN)

---
*Phase: 22-configuration-schematic-the-angular-json-write-fork*
*Completed: 2026-07-10*
