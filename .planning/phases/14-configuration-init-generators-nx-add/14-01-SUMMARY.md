---
phase: 14-configuration-init-generators-nx-add
plan: 01
subsystem: infra
tags: [nx-plugin, nx-generator, nx-devkit, targetDefaults, caching, walk-02]

# Dependency graph
requires:
  - phase: 13-engine-solution-tsconfig-reference-walking
    provides: the reference-walking engine + WALK-02 cacheable targetDefaults contract (default-not-production inputs) that init seeds
  - phase: 13.1-rename-angular-typecheck-executor-to-typecheck
    provides: the unscoped published executor id angular-typechecker:typecheck that keys the seeded targetDefaults entry
provides:
  - standalone init generator (nx g angular-typechecker:init) seeding nx.json targetDefaults["angular-typechecker:typecheck"] with the verbatim WALK-02 block
  - InitGeneratorSchema contract (schema.json + schema.d.ts, skipFormat only) + schema-parity spec
  - the init unit the configuration generator will invoke (GEN-08) and nx add will run on install (GEN-09)
affects: [14-02-configuration-generator, 14-03-generators-json-registration-nx-add, 15-generator-e2e]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Nx config-edit generator tier under src/generators/<name>/ mirroring the executor tier layout (D-01)"
    - "Whole-entry ??= don't-clobber for a coherent targetDefaults block (D-05), diverging from first-party sub-key ??="
    - "In-memory createTreeWithEmptyWorkspace substrate for generator unit tests (D-12); no bespoke real-disk FsTree"

key-files:
  created:
    - packages/angular-typechecker/src/generators/init/generator.ts
    - packages/angular-typechecker/src/generators/init/schema.json
    - packages/angular-typechecker/src/generators/init/schema.d.ts
    - packages/angular-typechecker/src/generators/init/init.spec.ts
    - packages/angular-typechecker/src/generators/init/schema-parity.spec.ts
  modified: []

key-decisions:
  - "Seed ONLY the unscoped angular-typechecker:typecheck key with the WALK-02 block copied verbatim from nx.json; never the scoped @angular-typechecker/... dev-repo alias (D-04)"
  - "Whole-entry ??= don't-clobber (D-05): seed only when the key is absent; a customized entry of any shape is left untouched"
  - "readNxJson(tree) ?? {} null guard; config-edit only, no generateFiles (Pitfall 4)"
  - "Generator schema OMITS the executor-only version:2 field; parity spec asserts cli:nx + additionalProperties:false + absence of version"

patterns-established:
  - "TYPECHECK_TARGET_DEFAULTS module-level TargetConfiguration constant, verbatim from nx.json, with a landmine comment pinning default-not-production"
  - "Generator tier freely imports @nx/devkit (core-purity ban is scoped to src/core/** only)"

requirements-completed: [GEN-07, GEN-06]

# Metrics
duration: 15min
completed: 2026-07-02
---

# Phase 14 Plan 01: init generator Summary

**Standalone `nx g angular-typechecker:init` generator that idempotently seeds `nx.json` `targetDefaults["angular-typechecker:typecheck"]` with the verbatim WALK-02 cacheable block (default-not-production, whole-entry don't-clobber), the plugin's first generator.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-02T01:35:00Z (approx)
- **Completed:** 2026-07-02T01:41:27Z
- **Tasks:** 2
- **Files modified:** 5 (all created)

## Accomplishments
- Shipped the FIRST generator in this plugin: a config-edit-only `init` generator (`src/generators/init/`) that seeds workspace caching defaults via `readNxJson`/`updateNxJson`, no `generateFiles`.
- Seeds the WALK-02 block VERBATIM from `nx.json` under the UNSCOPED published id `angular-typechecker:typecheck`, with `default`-first inputs (never `production`) so a spec-only edit busts the walk cache (no stale PASS).
- Whole-entry `??=` don't-clobber (D-05): a pre-existing / user-customized entry of any shape is never overwritten; the scoped dev-repo alias key is never written.
- Hand-authored `InitGeneratorSchema` (`skipFormat` only) + a schema-parity spec; `init.spec.ts` proves seed shape, `default`-not-`production`, idempotent re-run, don't-clobber, and unscoped-only, all on `createTreeWithEmptyWorkspace`.

## Task Commits

Each task was committed atomically:

1. **Task 1: init generator schema contract (schema.json + schema.d.ts + parity spec)** - `7ae12f1` (feat)
2. **Task 2: implement init/generator.ts (seed targetDefaults) + init.spec.ts** - `9c17a54` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified
- `packages/angular-typechecker/src/generators/init/schema.json` - init generator JSON schema (cli:nx, additionalProperties:false, skipFormat only; no executor-tier version:2)
- `packages/angular-typechecker/src/generators/init/schema.d.ts` - `InitGeneratorSchema { skipFormat?: boolean }`
- `packages/angular-typechecker/src/generators/init/schema-parity.spec.ts` - asserts schema.json properties === ['skipFormat'], cli:nx, strict, no version field
- `packages/angular-typechecker/src/generators/init/generator.ts` - default-export async `initGenerator`; module-level `TYPECHECK_TARGET_DEFAULTS` (verbatim WALK-02); whole-entry `??=` seed; readNxJson null guard; skipFormat-gated formatFiles
- `packages/angular-typechecker/src/generators/init/init.spec.ts` - 4 cases (seed shape + default-not-production, idempotent, don't-clobber, unscoped-only) on `createTreeWithEmptyWorkspace`

## Decisions Made
None beyond the locked phase decisions (D-04, D-05, D-11, D-12) - followed the plan and 14-CONTEXT/14-RESEARCH/14-PATTERNS as specified. The seed block was copied verbatim from `nx.json` lines 44-58 (unscoped key); the whole-entry `??=` was chosen per D-05 over the first-party sub-key `??=`.

## Deviations from Plan

None - plan executed exactly as written. No auto-fixes were required (Rules 1-4 did not trigger).

## Issues Encountered
None. Verified `TargetConfiguration` / `NxJsonConfiguration` / `TargetDefaults` type shapes against the installed `@nx/devkit@23.0.1` `.d.ts` before writing the generator, so the build compiled clean on the first pass (no type-annotation churn).

## Requirement Status
- **GEN-07: COMPLETE** - fully delivered by this plan (the standalone init seed generator + its in-memory unit tests).
- **GEN-05 / GEN-06: PARTIALLY ADVANCED (not closed).** These are cross-plan requirements: GEN-05 also covers the `configuration` generator schema, the root `generators.json` registration, the `package.json` `generators` field, and the tarball `files` set; GEN-06 also covers the `configuration` target-write tests. This plan delivered only the `init` slice (init schema + type + parity + unit tests). GEN-05/06 must NOT be marked complete until the `configuration` generator (Plan 14-02) and `generators.json` registration (Plan 14-03) land. Left Pending in REQUIREMENTS.md accordingly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The `init` generator exists and is unit-proven; Plan 14-02's `configuration` generator can now `await initGenerator(tree, { skipFormat: true })` (GEN-08).
- Plan 14-03 still needs to register `init` (by literal key) + `configuration` in a new root `generators.json`, add the `package.json` `generators` field + `files` entry + build asset glob, and extend `package-manifest.spec.ts` - only then will `nx lint angular-typechecker` (@nx/nx-plugin-checks) validate the registration and `nx add angular-typechecker` (GEN-09) resolve `init`.
- Not blocking: `nx lint angular-typechecker` may flag the un-registered generator until Plan 14-03; `nx test` + `nx build` are both green (221 tests pass; `dist/.../generators/init/generator.js` emits as CommonJS).

## Self-Check: PASSED

- All 5 created files verified present on disk.
- Both task commits verified in git history (`7ae12f1`, `9c17a54`).
- `nx test angular-typechecker` green (221 tests, 29 files); `nx build angular-typechecker` emits `dist/.../generators/init/generator.js` (CommonJS).

---
*Phase: 14-configuration-init-generators-nx-add*
*Completed: 2026-07-02*
