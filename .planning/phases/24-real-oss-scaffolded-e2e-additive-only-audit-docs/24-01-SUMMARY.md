---
phase: 24-real-oss-scaffolded-e2e-additive-only-audit-docs
plan: 01
subsystem: testing
tags: [angular-cli, builder, architect, TestingArchitectHost, drift-tripwire, additive-only, nx]

# Dependency graph
requires:
  - phase: 21-angular-cli-builder-engine-multi-tsconfig-gate-a-spike-go-no
    provides: the convertNxExecutor Angular CLI builder + its brand/surface guards
  - phase: 21-angular-cli-builder-engine-multi-tsconfig-gate-a-spike-go-no
    provides: ENG-01 tsConfig string|string[] widening + the multi-tsconfig-array fixture
provides:
  - Builder-over-BuilderContext integration test proving BuilderOutput.success + Nx-executor parity (the one genuine ACV-03 gap)
  - fixtures/builder-context/ minimal resolvable Angular CLI workspace root (angular.json + app/spec leaves + components)
  - src/index.drift.ts standing barrel tripwire locking all five public exports (ACP-02/RF-02)
  - 24-ADDITIVE-AUDIT.md recorded widen-only git-diff verdict vs angular-typechecker@0.2.0
affects: [24-02 scaffolded e2e + real-clone UAT, 24-03 docs, milestone audit, phase verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "In-process Architect builder run via @angular-devkit/architect/testing TestingArchitectHost (integration tier)"
    - "Barrel additive-only lock via a *.drift.ts tsc --noEmit tripwire covering type-only exports"

key-files:
  created:
    - packages/angular-typechecker/src/builders/typecheck/builder.integration.spec.ts
    - packages/angular-typechecker/src/index.drift.ts
    - fixtures/builder-context/angular.json
    - fixtures/builder-context/tsconfig.app.json
    - fixtures/builder-context/tsconfig.spec.json
    - fixtures/builder-context/app.component.ts
    - fixtures/builder-context/app.component.spec.ts
    - .planning/phases/24-real-oss-scaffolded-e2e-additive-only-audit-docs/24-ADDITIVE-AUDIT.md
  modified:
    - packages/angular-typechecker/tsconfig.drift.json

key-decisions:
  - "Assumption A1 holds only with the Nx daemon + plugin isolation disabled in-process; set NX_DAEMON=false + NX_ISOLATE_PLUGINS=false at spec module scope so the eager prelude re-roots to the fixture."
  - "Clean-run parity case reuses the existing clean-template-host leaf (a GREEN classified fixture) rather than adding a clean leaf to builder-context, since both builder-context leaves carry planted errors by design."
  - "Barrel tripwire imports all five exports (2 value + 3 type-only) so a runtime spec's blind spot on erased type exports is closed; consumed via the repo's void/tuple *.drift.ts idiom."

patterns-established:
  - "Builder integration parity: assert BuilderOutput.success == the Nx executor { success } for the identical fixture + tsConfig (the builder IS the executor)."
  - "Additive-only audit = standing-guard cross-check + git diff @<tag>..HEAD per public-surface path, recorded in an audit artifact."

requirements-completed: [ACV-03, ACP-02]

# Metrics
duration: 25min
completed: 2026-07-11
---

# Phase 24 Plan 01: ACV-03 builder gap-fill + ACP-02 additive-only enforcement & audit Summary

**Closed the one genuine ACV-03 gap by RUNNING the Angular CLI builder over a real BuilderContext (success + Nx parity on clean and planted-error fixtures), locked the public barrel with a standing drift tripwire, and recorded the widen-only additive-only audit versus the `angular-typechecker@0.2.0` tag.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-11T08:40:00Z (approx)
- **Completed:** 2026-07-11T08:57:00Z (approx)
- **Tasks:** 3
- **Files modified:** 9 (8 created, 1 modified)

## Accomplishments
- ACV-03 gap-fill: `builder.integration.spec.ts` drives the `typecheck` builder through `TestingArchitectHost` and asserts `BuilderOutput.success` true on a clean run, false on a planted-error two-element `tsConfig` array, PLUS parity with the Nx executor `{ success }` for the identical fixture + `tsConfig`.
- New `fixtures/builder-context/` minimal resolvable Angular CLI workspace root (Pitfall F): `angular.json` declaring `builder-context-app` with `builder: angular-typechecker:typecheck` + a two-element `tsConfig` array, plus co-located app/spec leaves with planted TS2322/TS2345.
- ACP-02 enforcement: `src/index.drift.ts` barrel tripwire wired into `tsconfig.drift.json`, locking all five public exports; fail-loud verified (renaming a barrel export -> TS2724/TS2305 on the drift leg).
- ACP-02 audit: `24-ADDITIVE-AUDIT.md` records the git-diff verdict (barrel unchanged; executor schema `tsConfig` `oneOf` widen-only; generator schemas + `executors.json`/`generators.json` unchanged; `builders.json`/`collection.json` new files) + the guard cross-check map (all green), disposition: additive-only holds, milestone stays 0.2.x.

## Task Commits

Each task was committed atomically:

1. **Task 1: Builder-over-BuilderContext integration test + builder-context fixture** - `497a808` (test)
2. **Task 2: Barrel additive-only tripwire (src/index.drift.ts) wired into the drift target** - `78c40c4` (test)
3. **Task 3: Additive-only git-diff audit versus angular-typechecker@0.2.0** - `60825e3` (docs)

**Plan metadata:** (this final commit)

## Files Created/Modified
- `packages/angular-typechecker/src/builders/typecheck/builder.integration.spec.ts` - Runs the builder over a real BuilderContext; asserts success + Nx parity (clean + planted-error).
- `fixtures/builder-context/angular.json` - One application project with the `typecheck` architect target (two-element `tsConfig` array).
- `fixtures/builder-context/tsconfig.app.json` / `tsconfig.spec.json` - The app + spec leaves (`files` = component / spec).
- `fixtures/builder-context/app.component.ts` - Planted TS2322 (string not assignable to number).
- `fixtures/builder-context/app.component.spec.ts` - Imports AppComponent; planted TS2345 (wrong-type argument).
- `packages/angular-typechecker/src/index.drift.ts` - Type-only barrel tripwire referencing all five exports.
- `packages/angular-typechecker/tsconfig.drift.json` - Added `src/index.drift.ts` to `files`.
- `.planning/phases/24-.../24-ADDITIVE-AUDIT.md` - The recorded ACP-02 widen-only verdict + guard cross-check.

## Decisions Made
- Reused `clean-template-host/tsconfig.app.json` (a GREEN classified fixture) for the clean-run parity case instead of adding a clean leaf to `builder-context`, keeping the fixture faithful to the plan (both its leaves carry planted errors).
- Set `NX_DAEMON=false` + `NX_ISOLATE_PLUGINS=false` at the spec's module scope so `convertNxExecutor`'s eager project-graph prelude re-roots to the fixture rather than colliding with the ambient dev-repo Nx daemon/isolated plugin workers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Nx daemon + isolated plugin workers broke the in-process builder prelude**
- **Found during:** Task 1 (builder integration test)
- **Issue:** `convertNxExecutor`'s eager `retrieveProjectConfigurationsWithAngularProjects(fixtureRoot)` prelude failed with `ProjectConfigurationsError: Failed to create project configurations` (`readJsonFile` ENOENT) when run inside the dev-repo's vitest process. The ambient Nx daemon + `NX_ISOLATE_PLUGINS` machinery is pinned to the REAL workspace root, so an isolated plugin worker resolved package.json paths against the real repo while the main process expected the fixture root. The plan's documented fallback (handler-direct) would hit the SAME prelude, so it does not resolve this.
- **Fix:** Set `process.env.NX_DAEMON = 'false'` and `process.env.NX_ISOLATE_PLUGINS = 'false'` at the spec's module scope. This forces the prelude in-process + daemonless so the Rust workspace context re-roots cleanly to the fixture (which has no package.json). Confirmed Assumption A1 with this caveat.
- **Files modified:** packages/angular-typechecker/src/builders/typecheck/builder.integration.spec.ts
- **Verification:** `npx nx integration angular-typechecker` green (107 tests incl. the 4 builder tests); the integration config's `forks` pool isolates the env change to this file's worker.
- **Committed in:** 497a808 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The env-knob fix is a test-harness configuration, not a production change; it confirms rather than abandons the plan's TestingArchitectHost approach. No scope creep.

## Issues Encountered
- The `typecheck-drift` target named in the success criteria does not exist as a separate target; the drift `tsc --noEmit -p tsconfig.drift.json` leg runs inside the `typecheck` target (which ran green in Task 2). No action needed -- the drift gate is covered.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ACV-03 gap and ACP-02 enforcement + audit are complete and green (test 314, integration 107, typecheck/drift all pass).
- Remaining Phase 24 plans: the scaffolded automated e2e + real-clone UAT (ACV-01/ACV-02) and the README `## Angular CLI` + CHANGELOG docs (ACD-01).

## Self-Check: PASSED

All 8 created files + this SUMMARY exist on disk; all three task commits (497a808, 78c40c4, 60825e3) exist in git history.

---
*Phase: 24-real-oss-scaffolded-e2e-additive-only-audit-docs*
*Completed: 2026-07-11*
