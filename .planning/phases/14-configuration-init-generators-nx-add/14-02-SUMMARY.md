---
phase: 14-configuration-init-generators-nx-add
plan: 02
subsystem: infra
tags: [nx-plugin, nx-generator, nx-devkit, configuration-generator, tsconfig-resolution, project-json, idempotency]

# Dependency graph
requires:
  - phase: 13-engine-solution-tsconfig-reference-walking
    provides: the reference-walking engine the ONE wired target relies on (spec leaf walked when pointed at the solution tsconfig -> GEN-03)
  - phase: 13.1-rename-angular-typecheck-executor-to-typecheck
    provides: the unscoped published executor id angular-typechecker:typecheck the generated target + collision check key off
  - phase: 14-configuration-init-generators-nx-add (plan 14-01)
    provides: the standalone init generator (default export initGenerator) the configuration generator awaits with { skipFormat: true } (GEN-08)
provides:
  - the configuration generator (nx g angular-typechecker:configuration <project>) wiring ONE minimal typecheck target at the resolved tsConfig via readProjectConfiguration/updateProjectConfiguration/formatFiles (no generateFiles)
  - ConfigurationGeneratorSchema contract (schema.json + schema.d.ts: project/tsConfig/targetName/skipFormat) + schema-parity spec
  - the D-07 tsConfig resolver (override -> solution tsconfig.json w/ references[] -> flat leaf by projectType -> located error), reading the virtual Tree only
affects: [14-03-generators-json-registration-nx-add, 15-generator-e2e]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "configuration generator init-first composition: await initGenerator(tree,{skipFormat:true}) FIRST, format ONCE at the end, return runTasksInSerial (mirrors @nx/eslint:lint-project / @nx/vitest:configuration)"
    - "workspace-root-relative tsConfig via joinPathFragments(projectConfig.root, ...) so it matches the executor's context.root resolution (Landmine 1)"
    - "collision-by-EXECUTOR (not by target name): idempotent rewrite for angular-typechecker:typecheck, thrown located error for any other executor (D-09)"

key-files:
  created:
    - packages/angular-typechecker/src/generators/configuration/generator.ts
    - packages/angular-typechecker/src/generators/configuration/schema.json
    - packages/angular-typechecker/src/generators/configuration/schema.d.ts
    - packages/angular-typechecker/src/generators/configuration/configuration.spec.ts
    - packages/angular-typechecker/src/generators/configuration/schema-parity.spec.ts
  modified: []

key-decisions:
  - "init-first, format-once: await initGenerator(tree,{skipFormat:true}) before the project edit so caching is seeded (GEN-08/D-10) and Prettier runs exactly once at the end"
  - "tsConfig resolution order (D-07): --tsConfig override (absolute verbatim / relative joinPathFragments(projectConfig.root, override)) -> solution tsconfig.json with a non-empty references[] -> flat leaf by projectType (application->tsconfig.app.json, else tsconfig.lib.json) + tree.exists -> clear located error"
  - "workspace-root-relative tsConfig path (Landmine 1): joinPathFragments(projectConfig.root, ...) yields e.g. libs/foo/tsconfig.json to match the executor's workspace-root resolution"
  - "collision by the UNSCOPED executor id (D-09/Landmine 3): existing.executor === 'angular-typechecker:typecheck' -> idempotent rewrite; any other executor -> throw; reads the virtual Tree only (readJson/tree.exists), never node:fs"

requirements-completed: [GEN-01, GEN-02, GEN-03, GEN-04, GEN-08, GEN-06]

# Metrics
duration: 25min
completed: 2026-07-02
---

# Phase 14 Plan 02: configuration generator Summary

**The `configuration` generator (`nx g angular-typechecker:configuration <project>`) that awaits `init` first (seeding caching, GEN-08), resolves the target's `tsConfig` by the D-07 order, collision-checks by executor, and writes ONE minimal workspace-root-relative `typecheck` target into `project.json` -- config-edit only, idempotent, non-ours-collision-safe.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2
- **Files modified:** 5 (all created)

## Accomplishments
- Shipped the plugin's second generator and the one a developer runs: `configuration` wires ONE minimal `typecheck` target (`{ executor: 'angular-typechecker:typecheck', options: { tsConfig } }`) into the project's `project.json` via `readProjectConfiguration`/`updateProjectConfiguration`/`formatFiles` -- NO `generateFiles`, no file emission (GEN-01).
- Awaits `initGenerator(tree, { skipFormat: true })` FIRST so one command both seeds `nx.json` `targetDefaults` (via `init`) AND wires the target, then formats ONCE at the end (GEN-08 / D-10) -- the idiomatic first-party composition.
- Implemented the D-07 tsConfig resolver reading the virtual `Tree` only: `--tsConfig` override (absolute verbatim / relative joined project-root-relative) -> solution `tsconfig.json` with a non-empty `references[]` (WALK-01 then walks the in-project leaves incl. `tsconfig.spec.json` -> GEN-03) -> flat leaf fallback by `projectType` (`application` -> `tsconfig.app.json`, else `tsconfig.lib.json`) with a `tree.exists` probe -> a clear located error (GEN-02).
- The written path is WORKSPACE-root-relative (`joinPathFragments(projectConfig.root, ...)` -> `libs/foo/tsconfig.json`) so it matches the executor's `context.root` resolution (Landmine 1); the spec asserts the FULL workspace-relative path.
- Collision by EXECUTOR (GEN-04 / D-09 / Landmine 3): a same-named target whose `executor === 'angular-typechecker:typecheck'` is rewritten to the same shape (idempotent, no duplicate); any OTHER executor throws a clear, located error instead of clobbering.
- `configuration.spec.ts` (8 cases on `createTreeWithEmptyWorkspace`): solution write + init-seeded targetDefaults, flat-library fallback, flat-application fallback, `--tsConfig` override, configurable `targetName`, no-resolvable-tsconfig error, idempotent-for-ours, non-ours collision. `schema-parity.spec.ts` (4 cases) pins the `project`/`skipFormat`/`targetName`/`tsConfig` key set, `required === ['project']`, `cli:nx`, strict, no `version` field.

## Task Commits

Each task was committed atomically:

1. **Task 1: configuration generator schema contract (schema.json + schema.d.ts + parity spec)** - `3904166` (feat)
2. **Task 2: implement configuration/generator.ts (init-first, resolve tsConfig, collision, write target) + configuration.spec.ts** - `1f6f4dd` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified
- `packages/angular-typechecker/src/generators/configuration/schema.json` - configuration generator JSON schema (project positional+required, tsConfig, targetName default typecheck, skipFormat; cli:nx; additionalProperties:false; no executor-tier version:2)
- `packages/angular-typechecker/src/generators/configuration/schema.d.ts` - `ConfigurationGeneratorSchema { project: string; tsConfig?; targetName?; skipFormat? }`
- `packages/angular-typechecker/src/generators/configuration/schema-parity.spec.ts` - asserts properties === [project, skipFormat, targetName, tsConfig], required === [project], cli:nx, strict, no version field
- `packages/angular-typechecker/src/generators/configuration/generator.ts` - default-export async `configurationGenerator`; module-level `TYPECHECK_EXECUTOR` constant; `resolveTsConfig` helper (D-07); init-first, collision-by-executor, target write, format-once, `runTasksInSerial`
- `packages/angular-typechecker/src/generators/configuration/configuration.spec.ts` - 8 cases on `createTreeWithEmptyWorkspace` (solution + init-seeded, flat lib, flat app, --tsConfig, targetName, no-resolvable error, idempotent-for-ours, non-ours collision)

## Decisions Made
None beyond the locked phase decisions (D-07 through D-12) - followed the plan and 14-CONTEXT/14-RESEARCH/14-PATTERNS as specified. OQ-1 was applied as RESOLVED (absolute `--tsConfig` verbatim, relative joined project-root-relative).

## Deviations from Plan

None - plan executed exactly as written. No auto-fixes were required (Rules 1-4 did not trigger); the build compiled and all specs passed on the first run.

## Issues Encountered
None. Verified the devkit type shapes (`GeneratorCallback`, `ProjectConfiguration`, `Tree`) and the `readJson<T>` generic against the installed `@nx/devkit@23.0.1` before writing, and confirmed `initGenerator` returns `Promise<void>` (so the `tasks` array stays empty and `runTasksInSerial(...tasks)` returns a no-op callback) - build compiled clean on the first pass.

## Requirement Status
- **GEN-01: COMPLETE** - configuration wires the target via devkit, no `generateFiles`, reads/writes `nx.json` through `init`.
- **GEN-02: COMPLETE** - ONE target at the solution tsconfig; `--tsConfig` override; flat-project fallback by `projectType` + existence probe; configurable `targetName`; located error when nothing resolves.
- **GEN-03: COMPLETE** - the generator points the single target at the solution `tsconfig.json`, so WALK-01 (shipped Phase 13) walks the `tsconfig.spec.json` leaf; no separate spec target is wired. (The end-to-end RUN proof is Phase 15 / GE2E; the generator-wiring behavior is delivered + unit-tested here.)
- **GEN-04: COMPLETE** - idempotent re-run for our target (rewrite, no duplicate); a non-ours same-named target throws a clear located error.
- **GEN-08: COMPLETE** - `configuration` invokes `init` (running `configuration` alone seeds `targetDefaults`, proven by the solution-tsconfig spec case).
- **GEN-05 / GEN-06: PARTIALLY ADVANCED (not closed), left Pending.** These are cross-plan: GEN-05 also needs the root `generators.json` registration, the `package.json` `generators` field, and the tarball `files` set (Plan 14-03); GEN-06 also needs the packaging-manifest assertions (Plan 14-03). This plan delivered the `configuration` schema pair + parity spec (GEN-05 slice) and the `configuration` in-memory unit tests (GEN-06 slice). Do NOT mark complete until 14-03 lands.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The `configuration` generator exists and is unit-proven; it awaits the Plan 14-01 `init` generator (GEN-08).
- Plan 14-03 must register BOTH `configuration` (by key) and `init` in a new root `generators.json` (factory-keyed), add the `package.json` `generators` field + `generators.json` to `files`, add the `project.json` build asset glob, and extend `package-manifest.spec.ts`. Only then does `nx lint angular-typechecker` (@nx/nx-plugin-checks) fully validate the registration and `nx add angular-typechecker` (GEN-09) resolve `init`.
- Not blocking: the generator is un-registered until 14-03, but `nx test` (233 tests), `nx build` (emits `dist/.../generators/configuration/generator.js` as CommonJS), and `nx lint` are all green now.

## Self-Check: PASSED

- All 5 created files verified present on disk.
- Both task commits verified in git history (`3904166`, `1f6f4dd`).
- `nx test angular-typechecker` green (233 tests, 31 files); `nx build angular-typechecker` emits `dist/.../generators/configuration/generator.js` (CommonJS); `nx lint angular-typechecker` green.

---
*Phase: 14-configuration-init-generators-nx-add*
*Completed: 2026-07-02*
