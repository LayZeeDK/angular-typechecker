---
phase: 04-nx-executor-adapter-cacheable-target
plan: 01
subsystem: api
tags: [nx-executor, nx-devkit, angular-compiler-cli, cjs-esm, json-schema, vitest]

# Dependency graph
requires:
  - phase: 03-filtering-modes-output-quality-gates
    provides: 'runTypecheck, evaluateResult, formatReport, filterDiagnostics, loadCompilerCli core seams + the core/** import ban'
  - phase: 02-core-type-check-engine-gatherer
    provides: 'CoreOptions/CoreResult shapes, TypecheckInfrastructureError, the private loadTypescript memo'
  - phase: 01-workspace-bootstrap-engine-spike-gated
    provides: 'GATE A module:nodenext import() survival; the executor stub + executors.json + schema.json starting points'
provides:
  - 'renderReport core seam (D-02): loads ng + ts internally, delegates to formatReport, barrel-exported, never leaks loadTypescript'
  - 'Pure normalize-options mapper (D-01/D-03): rel->abs tsConfig via joinPathFragments, splits reporter knobs out of CoreOptions'
  - 'Completed sub-50-line executor adapter (D-01/D-04): composes normalize -> runTypecheck -> renderReport (raw stdout) -> evaluateResult -> { success }; catches infra errors, re-throws all others'
  - 'v0.0.1 executor public schema contract (D-06): tsConfig + includeDeps + maxWarnings (no default) + failFast + version 2, lockstep schema.d.ts + key-parity test'
  - 'executors.json outputCapture direct-nodejs (D-04)'
affects: [04-02-cacheable-target, 04-03-cache-correctness, 05-packaging-publish, 06-e2e-matrix]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'renderReport core seam: the single render entry every adapter (executor now; CLI/builder later) reuses; keeps CJS->ESM module loading inside core/'
    - 'Hexagonal-lite adapter split: pure normalize-options.ts mapper + thin executor.ts composing the core; @nx/devkit confined to the adapter tier'
    - 'schema.json <-> schema.d.ts key-parity unit test (readFileSync + JSON.parse contract test) to catch silent runtime/type contract drift'

key-files:
  created:
    - packages/angular-typechecker/src/core/render-report.ts
    - packages/angular-typechecker/src/core/render-report.spec.ts
    - packages/angular-typechecker/src/executors/angular-typecheck/normalize-options.ts
    - packages/angular-typechecker/src/executors/angular-typecheck/normalize-options.spec.ts
    - packages/angular-typechecker/src/executors/angular-typecheck/executor.spec.ts
    - packages/angular-typechecker/src/executors/angular-typecheck/schema-parity.spec.ts
  modified:
    - packages/angular-typechecker/src/index.ts
    - packages/angular-typechecker/src/executors/angular-typecheck/executor.ts
    - packages/angular-typechecker/src/executors/angular-typecheck/schema.json
    - packages/angular-typechecker/src/executors/angular-typecheck/schema.d.ts
    - packages/angular-typechecker/executors.json

key-decisions:
  - "D-02: renderReport added as a NEW core seam (not a CoreResult.formatted field, not a loadTypescript re-export) so formatReport's injected ng/ts stay inside core"
  - 'D-03: tsConfig resolution uses joinPathFragments(context.root, ...) (workspace-root-relative, POSIX-stable), never node:path.join'
  - 'D-04: report written via process.stdout.write (raw), not logger.info; color = process.stdout.isTTY === true; outputCapture direct-nodejs'
  - 'D-01: executor catches TypecheckInfrastructureError (logger.error + success:false) and RE-THROWS every other error (a type-checker that lies is worse than none)'
  - 'D-06: maxWarnings carries NO json-schema default (a default:0 would silently fail any NG8xxx warning); maxWarnings forwarded as-is (evaluateResult treats undefined/negative/NaN as unset)'

patterns-established:
  - 'renderReport seam: the reusable render entry for every present/future adapter; CJS->ESM loaders stay in core/'
  - 'Adapter-tier @nx/devkit confinement: only executor.ts + normalize-options.ts import @nx/devkit; core/render-report.ts imports none'

requirements-completed: [EXE-01, EXE-07]

# Metrics
duration: 6min
completed: 2026-06-28
---

# Phase 4 Plan 01: Executor-Adapter Slice Summary

**A complete sub-50-line `angular-typecheck` Nx executor composes normalize -> runTypecheck -> renderReport (raw stdout) -> evaluateResult, backed by a new `renderReport` core seam and the locked v0.0.1 four-option schema; build stays green under module:nodenext with the literal `import(` retained.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-06-28T11:05:33Z
- **Completed:** 2026-06-28T11:11:19Z
- **Tasks:** 3
- **Files modified:** 11 (6 created, 5 modified)

## Accomplishments

- Added the `renderReport(result, { pathBase, color, failFast })` core seam (D-02 compile-blocker): it loads `@angular/compiler-cli` (`loadCompilerCli`) + a module-private `loadTypescript` memo and delegates to `formatReport`, so the adapter can render without re-coupling rendering into the engine or leaking `loadTypescript` from the barrel. Barrel-exported alongside `RenderOptions`.
- Added a pure `normalizeOptions(options, context)` mapper that resolves a relative `tsConfig` workspace-root-relative via `joinPathFragments` (absolute passes through), and splits reporter-only knobs (`maxWarnings`, `failFast`, `color`) out of `CoreOptions`.
- Completed the executor stub into the full D-01 composition: it writes the report through raw `process.stdout.write` (NOT `logger.info`), catches `TypecheckInfrastructureError` (-> `logger.error` + `{ success: false }`), and RE-THROWS every other error.
- Extended `schema.json` to the locked v0.0.1 contract (`tsConfig` required + `includeDeps` + `maxWarnings` with NO default + `failFast`, `version: 2`, `additionalProperties: false`, no aliases/mode), kept `schema.d.ts` in lockstep, and added a key-parity unit test.
- Set `outputCapture: "direct-nodejs"` in `executors.json` (preserves `isTTY` + captures stdout verbatim for cache replay).

## Task Commits

Each task was committed atomically:

1. **Task 1: renderReport core seam (D-02) + barrel export** - `d903865` (feat)
2. **Task 2: pure normalize-options mapper (D-01/D-03)** - `86b66ee` (feat)
3. **Task 3: completed executor + extended schema + outputCapture (D-01/D-04/D-06)** - `32368ab` (feat)

**Plan metadata:** (this docs commit)

_Note: TDD tasks were implemented test-alongside-impl in single commits (impl + spec together); each was verified GREEN before commit._

## Files Created/Modified

- `packages/angular-typechecker/src/core/render-report.ts` - The renderReport core seam (loads ng + private ts memo, delegates to formatReport).
- `packages/angular-typechecker/src/core/render-report.spec.ts` - Exercises the REAL loaders; asserts both color edges, NG-code forwarding, pathBase relativization, failFast truncation.
- `packages/angular-typechecker/src/index.ts` - Barrel-exports `renderReport` + `RenderOptions` (NOT `loadTypescript`).
- `packages/angular-typechecker/src/executors/angular-typecheck/normalize-options.ts` - Pure rel->abs tsConfig mapper splitting reporter knobs out of CoreOptions.
- `packages/angular-typechecker/src/executors/angular-typecheck/normalize-options.spec.ts` - Asserts both resolution edges + the knob split + pathBase === root.
- `packages/angular-typechecker/src/executors/angular-typecheck/executor.ts` - Completed sub-50-line adapter composition with infra-catch + re-throw.
- `packages/angular-typechecker/src/executors/angular-typecheck/executor.spec.ts` - Mocks core seams; asserts success mapping, stdout (not logger.info), infra-catch, re-throw.
- `packages/angular-typechecker/src/executors/angular-typecheck/schema.json` - v0.0.1 four-option contract (version 2).
- `packages/angular-typechecker/src/executors/angular-typecheck/schema.d.ts` - Lockstep interface.
- `packages/angular-typechecker/src/executors/angular-typecheck/schema-parity.spec.ts` - schema.json properties keys === schema.d.ts key set.
- `packages/angular-typechecker/executors.json` - Added `outputCapture: "direct-nodejs"`.

## Decisions Made

None beyond honoring the locked D-01/D-02/D-03/D-04/D-06 decisions. Two in-discretion choices the plan delegated to the executor were resolved as RESEARCH recommended:

- `renderReport` signature is `(result, { pathBase, color, failFast })` with `color` a required param (the adapter derives it from `process.stdout.isTTY`).
- The private `loadTypescript` memo is duplicated in `render-report.ts` (copied verbatim from `run-typecheck.ts`) rather than hoisted into a shared helper, per the D-02 note that the near-free second cache is acceptable and the simpler duplication avoids any new barrel surface.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The `git grep -n "logger.info"` acceptance grep matched a documentation comment (`// ... NOT logger.info ...`) explaining the D-04 rationale; verified there is no actual `logger.info(` CALL in the executor, so the criterion (no logger.info corrupting the report) holds. The comment was kept because it documents the load-bearing reason for raw stdout.

## Threat Surface

No new security-relevant surface beyond the plan's `<threat_model>`. T-04-01 (schema validation) is satisfied by `additionalProperties: false` + `required: ["tsConfig"]` + the key-parity spec. T-04-02 (never swallow an error) is satisfied by the executor's re-throw edge, asserted in `executor.spec.ts`. T-04-04 (tsConfig path handling) uses only `joinPathFragments(context.root, ...)`; no shell interpolation, no `process.cwd()` read. No new package installs (T-04-SC N/A).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The first user-runnable surface (the executor) is complete and composes the full core contract; `renderReport` is the reusable render seam every deferred adapter (CLI/builder) will reuse.
- Ready for Plan 04-02 (cacheable target: `nx.json` executor-id-keyed `targetDefaults` with the `^default` inlined-source recipe + the committed `libs/typecheck-consumer*` fixtures + the R1 edge guard) and Plan 04-03 (the dedicated serialized cache-correctness e2e + executor parity + a real `nx run`).
- GATE A invariant held: `nx build angular-typechecker` is green and the built `core/compiler-loader.js` + the new `core/render-report.js` both retain a literal `import(` (no `require()` downlevel under module:nodenext) -- the build-time half of EXE-07.

## Self-Check: PASSED

All 6 created source/spec files + the SUMMARY exist on disk; all 3 task commits (`d903865`, `86b66ee`, `32368ab`) exist in git history. Verification gates re-run green: full unit suite 20 files / 99 tests passed; `nx build angular-typechecker` succeeded with `import(` retained in the built `compiler-loader.js` and `render-report.js` (GATE A); `nx lint angular-typechecker` exit 0 (only a pre-existing out-of-scope unused-var WARNING in `config-resolution.integration.spec.ts`).

---

_Phase: 04-nx-executor-adapter-cacheable-target_
_Completed: 2026-06-28_
