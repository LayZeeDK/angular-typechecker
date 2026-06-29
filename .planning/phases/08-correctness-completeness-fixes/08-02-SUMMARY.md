---
phase: 08-correctness-completeness-fixes
plan: 02
subsystem: testing
tags: [angular-compiler-cli, typescript, getGlobalDiagnostics, ts2318, vitest, diagnostics]

# Dependency graph
requires:
  - phase: 08-correctness-completeness-fixes (plan 01)
    provides: TypecheckInfrastructureError + the run-typecheck.ts engine flow COR-02's gatherer feeds into
provides:
  - "Seventh diagnostic getter: gatherAllDiagnostics now calls program.getTsProgram().getGlobalDiagnostics() so global/location-less TS diagnostics (e.g. TS2318) are gathered (COR-02 / D-04)"
  - "fixtures/global-diagnostics (noLib + types:[]) real-compiler fixture that triggers a raw TS2318"
  - "Unit + integration proof that TS2318 surfaces through the engine (failing-then-passing)"
  - "Deterministic test suite (raised vitest testTimeout) -- removed the rotating cold-compiler timeout flake"
affects: [09-resilience, 10-drift-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Append-only all-getter extension: a new diagnostic source is one all.push(...) before return all; ordering/overlap is safe via finalize's sortAndDeduplicateDiagnostics"
    - "Real-compiler integration proof in a dedicated *.integration.spec.ts asserting through result.diagnostics (the engine), not the raw getter"

key-files:
  created:
    - fixtures/global-diagnostics/tsconfig.json
    - fixtures/global-diagnostics/global-error.ts
    - packages/angular-typechecker/src/core/global-diagnostics.integration.spec.ts
  modified:
    - packages/angular-typechecker/src/core/gather-diagnostics.ts
    - packages/angular-typechecker/src/core/gather-diagnostics.spec.ts
    - packages/angular-typechecker/vitest.config.mts

key-decisions:
  - "No compiler-cli-types.ts edit: getGlobalDiagnostics is on the public ts.Program, reachable via the existing TsProgram = ts.Program & {...} declaration"
  - "Assert the RAW positive TS code 2318 (never the negative NG() encoding -- it is a TypeScript code, not an Angular extended code)"
  - "Fixture does NOT extend tsconfig.base.json -- the global type loss (noLib + types:[]) must be real or the TS2318 vanishes"
  - "Raised vitest testTimeout/hookTimeout to 30000ms to make the cold real-compiler integration specs deterministic (pre-existing latent flake surfaced by the COR-02 verification gate)"

patterns-established:
  - "Seventh getter / append-only gatherer growth: extend gatherAllDiagnostics with one all.push(...) and let the downstream sort+dedup absorb placement/overlap"

requirements-completed: [COR-02]

# Metrics
duration: 14min
completed: 2026-06-29
---

# Phase 8 Plan 02: Global / location-less TypeScript diagnostics (COR-02) Summary

**gatherAllDiagnostics now calls program.getTsProgram().getGlobalDiagnostics() as a seventh getter, so global TS errors (e.g. TS2318 "Cannot find global type") the per-file path never emits are gathered and reported -- proven end-to-end against a real noLib fixture.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-06-29T16:17Z (08-01 completion)
- **Completed:** 2026-06-29T16:31Z
- **Tasks:** 2
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments

- Added the seventh, unconditional getter to `gatherAllDiagnostics`: `all.push(...program.getTsProgram().getGlobalDiagnostics())` (COR-02 / D-04), immediately before `return all;`, with an updated module JSDoc explaining why global/location-less TS diagnostics need a separate getter and why placement is safe.
- Created `fixtures/global-diagnostics/` (a `noLib: true` + `types: []` leaf tsconfig that does NOT extend the base config, plus a source file referencing the `Array` global) so the real compiler emits a raw TS2318.
- Added a unit wiring proof (a stubbed `getTsProgram().getGlobalDiagnostics` returning `[2318]` is included in the gatherer output) and a dedicated real-compiler integration spec asserting `result.diagnostics` contains `2318` for the fixture -- both confirmed failing-then-passing against the disabled 7th getter.
- No `compiler-cli-types.ts` edit was needed: the call type-checks under `module: nodenext` via the existing `TsProgram = ts.Program & {...}` declaration (build green = GATE A proof).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the COR-02 fixture + the seventh getGlobalDiagnostics push** - `5f13ad8` (feat)
2. **Task 2: Failing-then-passing COR-02 unit wiring + real-compiler integration** - `9305123` (test)

**Plan metadata:** _(final docs commit -- this SUMMARY + STATE/ROADMAP/REQUIREMENTS)_

_Note: this is a `tdd="true"` plan; Task 1 ships the fixture + production change (build-verified), Task 2 ships the failing-then-passing proof. RED was demonstrated by temporarily disabling the 7th getter (both new assertions fail; the gatherer returns `[]` for the fixture's globals), then GREEN by restoring it._

## Files Created/Modified

- `packages/angular-typechecker/src/core/gather-diagnostics.ts` - Added the seventh `all.push(...program.getTsProgram().getGlobalDiagnostics())` getter + JSDoc.
- `fixtures/global-diagnostics/tsconfig.json` - `noLib: true`, `types: []`, `skipLibCheck: false`, `noEmit: true`, `files: ["global-error.ts"]`; does NOT extend `tsconfig.base.json`.
- `fixtures/global-diagnostics/global-error.ts` - References the `Array` global -> raw TS2318 with no lib loaded.
- `packages/angular-typechecker/src/core/gather-diagnostics.spec.ts` - New COR-02 unit test (raw `2318`); plus the two pre-existing six-getter tests gained a `getTsProgram` stub so the now-unconditional 7th call does not throw (assertions unchanged).
- `packages/angular-typechecker/src/core/global-diagnostics.integration.spec.ts` - New real-compiler proof: `runTypecheck` over the fixture surfaces TS2318 in `result.diagnostics`.
- `packages/angular-typechecker/vitest.config.mts` - Raised `testTimeout`/`hookTimeout` to 30000ms (flake fix; see Deviations).

## Decisions Made

- **No shim edit (D-04 / RESEARCH anti-pattern):** `getGlobalDiagnostics` lives on the public `ts.Program`, reached via `getTsProgram()`. The drift getter-set assertion for it is Phase 10 HARD-01 (D-05), not this plan.
- **Raw `2318`, never `NG()`:** TS2318 is a positive TypeScript code, not an Angular extended (negative-encoded) code (RESEARCH Pitfall 5).
- **Assert through the engine, not the raw getter (RESEARCH Pitfall 3):** the failing-then-passing property only holds via `gatherAllDiagnostics` / `result.diagnostics`; calling `getGlobalDiagnostics()` directly would always pass.
- **Globals are file-less, so they are kept (RESEARCH Pitfall 4):** the boundary filter's file-less "always keep" rule retains the TS2318 set with no `includeDeps` needed -- COR-02 and the file-less rule cooperate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The unconditional 7th getter threw in two pre-existing unit tests that omit `getTsProgram`**
- **Found during:** Task 2 (failing-then-passing verification)
- **Issue:** Adding `program.getTsProgram().getGlobalDiagnostics()` to `gatherAllDiagnostics` made every gatherer invocation call `getTsProgram()`. The two pre-existing `gather-diagnostics.spec.ts` tests ("calls all six getters...", "still calls getNgSemanticDiagnostics...") stub a `program` whose object literal does NOT declare `getTsProgram`, so they threw `TypeError: program.getTsProgram is not a function`. The plan anticipated adding a SEPARATE `it` (which I did) but did not foresee that the new unconditional call breaks the existing stubs.
- **Fix:** Added a minimal `getTsProgram: () => ({ getGlobalDiagnostics: () => [] })` stub to both pre-existing tests. Returning no globals keeps their six-in-order code assertions (`[1,2,3,2322,5,8109]`) and order assertions exactly unchanged.
- **Files modified:** packages/angular-typechecker/src/core/gather-diagnostics.spec.ts
- **Verification:** `npx nx test angular-typechecker -- gather-diagnostics.spec` -> all 3 tests green.
- **Committed in:** 9305123 (Task 2 commit)

**2. [Rule 3 - Blocking] Non-deterministic cold-compiler test timeout flake blocked the deterministic verification gate**
- **Found during:** Task 2 (full-suite verification)
- **Issue:** The full `npx nx test angular-typechecker` produced a NON-deterministic, rotating set of failures -- each failing spec was a real-compiler `*.integration.spec.ts` (`extended-v13`, `ts-baseline`, `config-resolution`, `run-typecheck.integration` ENG-01, `composite-triangle`, ...) hitting Vitest's default 5000ms `testTimeout`. Across five runs five different failing combinations appeared; the COR-02 specs passed every time. Root cause: a cold `@angular/compiler-cli` `performCompilation` (ESM load + whole-program no-emit) can exceed 5s under the parallel pool on this Windows arm64 box. Pre-existing latent flake (the vitest config has carried the 5s default since the 01-02 scaffold), surfaced by this plan's "full suite green" gate.
- **Fix:** Raised `testTimeout` and `hookTimeout` to 30000ms in `vitest.config.mts` -- exactly what Vitest's own timeout message recommends for legitimately long-running tests. Changes NO test semantics; only the patience.
- **Files modified:** packages/angular-typechecker/vitest.config.mts
- **Verification:** Full `npx nx test angular-typechecker --skip-nx-cache` run TWICE consecutively -> 21 files / 119 tests passed both times (deterministic).
- **Committed in:** 9305123 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes were necessary for the plan's own success criteria (the existing six-getter tests must stay green; the full suite must be deterministically green). Fix #1 is intrinsic to the COR-02 change. Fix #2 hardens pre-existing test infrastructure -- no production-code scope creep. The out-of-scope `'NG' is unused` lint warning in `config-resolution.integration.spec.ts` (a Plan 08-01 file) was left untouched (SCOPE BOUNDARY).

## Issues Encountered

- The rotating timeout flake initially looked like it might be caused by the COR-02 change; isolating the specs and reading the failure detail (`Error: Test timed out in 5000ms`) confirmed it was a pre-existing cold-compiler timeout under contention, independent of COR-02. Resolved via Deviation #2.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- COR-02 is complete and proven end-to-end. The gatherer now reports global/location-less TS diagnostics.
- **Phase 10 input (D-05, already noted in STATE):** HARD-01's drift getter-set assertion MUST include `getTsProgram().getGlobalDiagnostics` so this new call cannot silently drop out on an Angular upgrade.
- Phase 8 Plan 03 (COR-03 empty-`fileName`; COR-04 `toExitCode`) remains; the file-less "always keep" rule this plan relies on is COR-03's edit point.

## Self-Check: PASSED

All created files verified on disk (fixture pair, integration spec, modified gatherer/spec/vitest config, SUMMARY) and both task commits (`5f13ad8`, `9305123`) verified in git history.

---
*Phase: 08-correctness-completeness-fixes*
*Completed: 2026-06-29*
