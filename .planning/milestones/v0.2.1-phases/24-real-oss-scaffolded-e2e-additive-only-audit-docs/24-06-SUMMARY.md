---
phase: 24-real-oss-scaffolded-e2e-additive-only-audit-docs
plan: 06
subsystem: testing
tags: [nx-plugin, angular-cli, ng-add, schematics, yarn, verdaccio, e2e]

# Dependency graph
requires:
  - phase: 23-*
    provides: "the first-party ng-add generator + configuration write-fork + NO_CACHING_NOTICE"
  - phase: 24-04
    provides: "nx as a direct dependency (so ng add resolves nx transitively under yarn)"
  - phase: 24-05
    provides: "the yarn CLI e2e (enableMirror:false) + pnpm-collision e2e"
provides:
  - "A vanilla nx-free @angular-devkit/schematics ng-add so `ng add angular-typechecker` auto-wires on the FIRST run under yarn 4 (npm + pnpm + yarn parity)"
  - "src/core/angular-cli-wiring.ts: one framework-agnostic wiring core shared by the vanilla ng-add and the Nx configuration generator"
  - "CI-authoritative yarn CLI e2e asserting first-run ng add auto-wire (no ng g fallback)"
affects: [release, ng-add, configuration-generator, cli-e2e]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Framework-agnostic pure core (node:path posix.join + injected exists() callback) shared by an Nx generator and a vanilla Angular schematic -- extract, do not duplicate"
    - "Vanilla @angular-devkit/schematics Rule with TYPE-ONLY schematics imports (erased at compile) so the compiled schematic.js loads zero @nx/devkit"

key-files:
  created:
    - packages/angular-typechecker/src/core/angular-cli-wiring.ts
    - packages/angular-typechecker/src/core/angular-cli-wiring.spec.ts
    - packages/angular-typechecker/src/schematics/ng-add/ng-add.spec.ts
  modified:
    - packages/angular-typechecker/src/generators/init/generator.ts
    - packages/angular-typechecker/src/generators/configuration/generator.ts
    - packages/angular-typechecker/src/schematics/ng-add/schematic.ts
    - packages/angular-typechecker/eslint.config.mjs
    - e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run-yarn.e2e.spec.ts

key-decisions:
  - "Option C (nx-free vanilla ng-add) landed: the ng-add schematic is a pure Angular schematics Rule; its @angular-devkit/schematics imports are type-only, so the compiled schematic.js requires only the pure first-party core -- ZERO @nx/devkit in load or execution."
  - "Extract-not-duplicate: one src/core/angular-cli-wiring.ts is the single source of truth for leaf resolution + targetName guard + collision-by-builder + [build,spec] idempotent merge; both the vanilla ng-add AND the Nx configuration generator import it; error strings byte-preserved; the Nx configuration observable behavior is byte-identical."
  - "posix.join replaces devkit joinPathFragments and an injected exists() callback replaces tree.exists, so the core is Tree/devkit-agnostic and passes the D-11 core/** lint boundary."

patterns-established:
  - "Vanilla schematic testing: invoke the synchronous Rule directly with a logger-backed context (the test-runner callRule builds a NullLogger context and cannot capture context.logger notices)."

requirements-completed: [NGADD-01, ACV-02, ACP-02]

# Metrics
duration: 58min
completed: 2026-07-12
---

# Phase 24 Plan 06: nx-free vanilla ng-add (Option C) Summary

**`ng add angular-typechecker` now auto-wires every project on the FIRST run under yarn 4 -- the ng-add schematic is a vanilla `@angular-devkit/schematics` Rule that loads zero `@nx/devkit`, sharing one framework-agnostic wiring core with the Nx `configuration` generator (whose behavior stays byte-identical).**

## Performance

- **Duration:** ~58 min
- **Started:** 2026-07-12 (resumed execution)
- **Completed:** 2026-07-12
- **Tasks:** 3 of 3
- **Files touched:** 11 (3 created, 5 modified, 2 deleted, 1 moved)

## Accomplishments

- Closed the last NGADD-01 gap: the Angular CLI post-install `createSchematic('ng-add')` probe no longer pulls in nx's `ora -> log-symbols -> chalk` chain (the `chalk.blue is not a function` throw under yarn 4's last-in-wins hoist), so `ng add` auto-wires every application + library project on the FIRST run under npm, pnpm, AND yarn -- proven by the CI-authoritative `angular-typechecker-ng-cli-e2e`.
- Established one shared framework-agnostic wiring core (`src/core/angular-cli-wiring.ts`) that both the vanilla ng-add schematic and the Nx `configuration` generator consume, with the Nx configuration observable behavior byte-identical (all 4 configuration specs + init specs green).
- Retired the release-facing README yarn-caveat blocker: the caveat is obsolete (product-fixed), so the README needs no edit; the todo moved to `.planning/todos/done/`.

## Task Commits

1. **Task 1 (RED): pure wiring-core unit spec** - `43a5815` (test)
2. **Task 1 (GREEN): extract framework-agnostic wiring core + route init/configuration through it** - `73ba76c` (feat)
3. **Task 2 (RED): migrate ng-add spec to the vanilla schematic Rule** - `1df91b6` (test)
4. **Task 2 (GREEN): vanilla nx-free ng-add schematic + delete dead generator + eslint ignore** - `b5dfcfd` (feat)
5. **Task 3: flip yarn CLI e2e to first-run ng add auto-wire; retire README caveat** - `1b05e19` (test)

_TDD tasks 1 and 2 each landed as a RED test commit before the GREEN implementation commit._

## Files Created/Modified

- `src/core/angular-cli-wiring.ts` (created) - the shared pure core: `TYPECHECK_EXECUTOR_ID`, `NO_CACHING_NOTICE`, `NO_ANGULAR_JSON_NOTICE`, `AngularJson*` interfaces, `resolveTargetName`, `resolveTsConfigOverride`, `resolveTsConfigLeaves`, `wireTypecheckTarget`.
- `src/core/angular-cli-wiring.spec.ts` (created) - 18 pure unit tests for every leaf/override/targetName/collision/idempotent rung.
- `src/schematics/ng-add/ng-add.spec.ts` (created, moved from generators/) - 13 tests exercising the vanilla Rule.
- `src/generators/init/generator.ts` (modified) - moved + re-exported the two constants from the core.
- `src/generators/configuration/generator.ts` (modified) - routes targetName guard, CLI-branch leaf resolution, --tsConfig override, and collision/merge through the core; Nx else-branch untouched.
- `src/schematics/ng-add/schematic.ts` (modified) - rewritten as the vanilla nx-free Rule.
- `eslint.config.mjs` (modified) - `@angular-devkit/schematics` added to `@nx/dependency-checks` `ignoredDependencies`.
- `e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run-yarn.e2e.spec.ts` (modified) - asserts first-run auto-wire; `ng g` fallback + no-wire quirk removed; `enableMirror:false` retained.
- `src/generators/ng-add/generator.ts` (deleted) - dead after the schematic went vanilla (schema.json/schema.d.ts kept).
- `.planning/todos/pending/readme-yarn-ng-add-caveat.md` -> `.planning/todos/done/` (moved, with a resolution note).

## Decisions Made

See `key-decisions` frontmatter. Headline: nx-free vanilla ng-add (Option C) + one shared wiring core (extract, not duplicate) + byte-identical Nx configuration behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking test-harness] Vanilla-Rule log capture via direct invocation**
- **Found during:** Task 2 (migrated ng-add spec)
- **Issue:** The plan's `<interfaces>` sketch drove the spec via `SchematicTestRunner.callRule(ngAdd(opts), tree)` and `runner.logger.subscribe(...)`. In `@angular-devkit/schematics@22.0.6`, `callRule` builds its context with `engine.createContext({}, parentContext)`, which yields a `NullLogger` when no parent is passed (so `context.logger.info` notices are swallowed) and CRASHES on `schematic.description.name` if a parent logger IS passed -- so `callRule` fundamentally cannot capture the ng-add notices. The two notice assertions (notice-once, no-angular.json guidance) failed against it.
- **Fix:** The vanilla Rule is synchronous and touches only `context.logger`, so the spec invokes it directly (`ngAdd(options)(tree, context)`) with a context backed by `runner.logger`, and subscribes to `runner.logger`. Still uses `SchematicTestRunner` + `UnitTestTree(new HostTree())` from `@angular-devkit/schematics/testing`.
- **Files modified:** `src/schematics/ng-add/ng-add.spec.ts`
- **Verification:** `nx test` -- the 13 migrated behaviours green.
- **Committed in:** `b5dfcfd`

**2. [Rule 1 - Lint blocker] Removed non-null assertion for maxWarnings:0**
- **Found during:** Task 2 (vanilla schematic)
- **Issue:** `tree.read('angular.json')!` tripped `@typescript-eslint/no-non-null-assertion`, failing `nx lint` at `maxWarnings:0`.
- **Fix:** Read `angular.json` once (`const angularJson = tree.read('angular.json')`); a null return means the file is absent, so it both drives the RF-02 guard and yields the buffer for the parse -- no assertion needed.
- **Files modified:** `src/schematics/ng-add/schematic.ts`
- **Verification:** `nx lint` green.
- **Committed in:** `b5dfcfd`

**3. [Rule 3 - Blocking dist-grep] Reword schematic JSDoc to drop the literal `@nx/devkit` token**
- **Found during:** Task 2 (dist blocking-constraint check)
- **Issue:** tsc preserves comments into `schematic.js`, so the JSDoc line "it NEVER loads @nx/devkit" made the compiled dist grep (and the source acceptance grep) match the forbidden literal even though there is no real import.
- **Fix:** Reworded the JSDoc to say "the Nx devkit / nx runtime" (no literal `@nx/devkit`). The real code was already clean.
- **Files modified:** `src/schematics/ng-add/schematic.ts`
- **Verification:** source grep + `rg` over `dist/.../schematic.js` both CLEAN; dist requires only `../../core/angular-cli-wiring`.
- **Committed in:** `b5dfcfd`

---

**Total deviations:** 3 auto-fixed (2x Rule 3, 1x Rule 1). All necessary for correctness/lint/blocking-constraint compliance. No scope creep.

## Issues Encountered

**`nx run-many -t e2e --parallel=1` fails only on `angular-typechecker-ng-cli-e2e` (pre-existing infra, NOT from 24-06).** The plan's authoritative post-merge check was run twice; both times the ng-cli-e2e task failed at globalSetup with an Nx local-registry task RE-INVOCATION error -- `@angular-typechecker/source:local-registry -> angular-typechecker-ng-cli-e2e:e2e -> @angular-typechecker/source:local-registry` / "Task ... was already invoked by a parent Nx process in this chain" / `local registry exit 1`. Nx itself flagged the task as **flaky**. This aborts globalSetup BEFORE any test runs (not an assertion failure) and is an orchestration limitation of running multiple shared-Verdaccio e2e projects in one `run-many` chain -- I did not touch the shared globalSetup/project.json. Evidence it is not a regression:
- `angular-typechecker-ng-cli-e2e` passes **4/4 standalone** (`nx e2e angular-typechecker-ng-cli-e2e`): npm (ACV-02) + yarn flat (first-run auto-wire, 89.8s) + yarn workspace (first-run auto-wire, 70.9s) + pnpm collision.
- The other 3 e2e projects pass WITHIN the same `run-many`: install-e2e (37), matrix-e2e (7), cache-e2e (9).
- Per AGENTS.md, CI runs each e2e project as a fresh per-job `npm ci` (NOT `run-many`), so this local-registry re-invocation conflict does not occur in CI.

## Verification Results

| Command | Result |
|---------|--------|
| `nx test angular-typechecker --skip-nx-cache` | GREEN -- 366 tests, 39 files (incl. new core spec + migrated ng-add spec) |
| `nx build angular-typechecker --skip-nx-cache` | GREEN -- compiled `schematic.js` requires only the pure core (zero `@nx/devkit`) |
| `nx lint angular-typechecker --skip-nx-cache` | GREEN -- maxWarnings:0; D-11 core/** boundary + `@angular-devkit/schematics` ignore honored |
| `nx typecheck angular-typechecker --skip-nx-cache` | GREEN |
| `nx e2e angular-typechecker-ng-cli-e2e --skip-nx-cache` (standalone) | GREEN -- 4/4 (npm + yarn flat + yarn workspace first-run auto-wire + pnpm) |
| `nx run-many -t e2e --parallel=1` | RED on `ng-cli-e2e` only, via the Nx local-registry re-invocation conflict (infra, Nx-flagged flaky; see Issues). install(37)/matrix(7)/cache(9) GREEN; ng-cli-e2e GREEN standalone |

## Blocking-Constraint Compliance

- **Vanilla, no @nx/devkit in dist:** `git grep -e convertNxGenerator -e @nx/devkit -- schematic.ts` = CLEAN; `rg "@nx/devkit|convertNxGenerator|require\(.@angular-devkit/schematics" dist/.../schematic.js` = CLEAN; the `@angular-devkit/schematics` import is `import type`.
- **Nx configuration byte-identical:** all 4 configuration specs (configuration, configuration-angular-cli, configuration-matrix, schema-parity) + init specs green; every moved error string byte-preserved; `collection.json` byte-unchanged; ng-add still absent from `generators.json`.

## Self-Check: PASSED

- Created files exist: `src/core/angular-cli-wiring.ts`, `src/core/angular-cli-wiring.spec.ts`, `src/schematics/ng-add/ng-add.spec.ts`, `.planning/todos/done/readme-yarn-ng-add-caveat.md` -- all FOUND.
- Deleted files gone: `src/generators/ng-add/generator.ts`, `src/generators/ng-add/ng-add.spec.ts`, `.planning/todos/pending/readme-yarn-ng-add-caveat.md` -- all GONE.
- Commits exist: `43a5815`, `73ba76c`, `1df91b6`, `b5dfcfd`, `1b05e19` -- all present in `git log`.
