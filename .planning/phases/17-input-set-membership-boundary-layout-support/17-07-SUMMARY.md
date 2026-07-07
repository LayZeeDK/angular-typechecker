---
phase: 17-input-set-membership-boundary-layout-support
plan: 07
subsystem: testing
tags: [angular, typescript, tripwire, relatedInformation, dual-identity, NG3004, coverage-incomplete, vitest]

# Dependency graph
requires:
  - phase: 17-01
    provides: keep()/filterDiagnostics dual-identity membership + split suppressed counters
  - phase: 17-03
    provides: run-typecheck pipeline (branch-4a relatedInformation ownership, templateCheckAborted detection)
  - phase: 17-04
    provides: evaluateResult coverage-incomplete verdict (FM-9 fold of templateCheckAborted)
provides:
  - D-09a(ii) dual-identity declared-root tripwire (case-insensitive / case-sensitive / symlink-throw recovery + transitive-dep negative)
  - D-09.2 external-template relatedInformation attribution tripwire (real compiler)
  - D-09a(i) clean-host base-clause tripwire (suppressedInGraph == 0, no false coverage-incomplete)
  - D-09a(iii) shim + external-template never-dropped assertion
  - D-09a(iv)/FM-9 TCB-abort drift probe (verdict-affecting + NG3004-only fatal-code surface pinned)
affects: [phase-18-validation-docs, phase-19, angular-drift-regression]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tripwire spec: assert an UNDOCUMENTED Angular/TS invariant so a future drift fails LOUD (never a silent false pass)"
    - "Isolate a verdict signal from confounds by feeding the real fixture's detected object into a synthetic evaluate input (errorCount 0)"

key-files:
  created:
    - packages/angular-typechecker/src/core/dual-identity-tripwire.spec.ts
    - packages/angular-typechecker/src/core/external-template.integration.spec.ts
    - fixtures/external-template-tripwire/error-template.component.ts
    - fixtures/external-template-tripwire/error-template.component.html
    - fixtures/external-template-tripwire/tsconfig.app.json
    - fixtures/clean-template-host/external.component.ts
    - fixtures/clean-template-host/external.component.html
    - fixtures/clean-template-host/inline.component.ts
    - fixtures/clean-template-host/tsconfig.app.json
  modified:
    - packages/angular-typechecker/src/core/fault-isolation.integration.spec.ts

key-decisions:
  - "The poison fixture cannot itself yield outcome 'coverage-incomplete' (errorCount > 0 => type-error wins); FM-9 is proven by feeding the fixture's REAL templateCheckAborted into an isolated evaluate input"
  - "Dual-identity FS modes exercised at the UNIT level via injected realpath + useCaseSensitiveFileNames (no real symlink/junction)"
  - "External-template tripwire uses NG8002 (spike-008-validated to attribute to .html + carry a .ts relatedInformation)"

patterns-established:
  - "Version-pinned drift probe: link the real-compiler produced code to the vendored constant (TCB_GENERATION_FATAL_DIAGNOSTIC_CODE === NG(3004)) so an Angular renumber trips loud"

requirements-completed: [SB-02, SB-03]

# Metrics
duration: ~15min
completed: 2026-07-06
---

# Phase 17 Plan 07: D-09a MANDATORY Tripwire Fixtures + Probes Summary

**Tripwire specs that GUARD the undocumented Angular/TS invariants the input-set boundary rests on: dual-identity declared-root recovery across three filesystem modes, external-template `.ts` relatedInformation attribution, clean-host base-clause classification, and a version-pinned NG3004 TCB-abort drift probe -- each fails LOUD on a future compiler drift.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-06T07:41Z
- **Completed:** 2026-07-06T07:56Z
- **Tasks:** 3
- **Files modified:** 10 (9 created, 1 modified)

## Accomplishments

- **D-09a(ii) dual-identity tripwire** (`dual-identity-tripwire.spec.ts`): a declared rootName's own failing diagnostic is KEPT across a case-INSENSITIVE FS, a case-SENSITIVE FS, and a symlink/junction whose realpath THROWS (raw-form recovery, the load-bearing D-02 charter case); a genuine transitive dep `.ts` is SUPPRESSED into `suppressedInGraphErrorCount` (isolation negative control). Pure tier, injected realpath, no real filesystem.
- **D-09.2 + D-09a(iii) attribution tripwire** (`external-template.integration.spec.ts` + `fixtures/external-template-tripwire`): a real cold-compiler run proves the NG8002 external-template diagnostic attributes to the `.html`, carries a `.ts` relatedInformation pointing at the owning `error-template.component.ts` (branch-4a ownership signal), and is KEPT in the reported set (never silently dropped).
- **D-09a(i) clean-host base-clause tripwire** (`fixtures/clean-template-host`): a clean host using an external `.html` AND an inline template reports `suppressedInGraphErrorCount === 0 && suppressedInGraphWarningCount === 0` and a `clean` verdict -- no false coverage-incomplete on a host's own templates.
- **D-09a(iv)/FM-9 drift probe** (extended `fault-isolation.integration.spec.ts`): the real poison fixture's abort signal drives `coverage-incomplete` when isolated (proving FM-9 is verdict-affecting, not advisory-only), and the recognized TCB-generation Fatal surface is pinned to NG3004 (real code === `TCB_GENERATION_FATAL_DIAGNOSTIC_CODE`; `detectTemplateCheckAborted` fires on NG3004 but not siblings NG3001/NG3003).

## Task Commits

Each task was committed atomically:

1. **Task 1: dual-identity declared-root tripwire (D-09a ii)** - `d08a9ee` (test)
2. **Task 2: external-template relatedInformation + clean-host base-clause tripwires (D-09.2, D-09a i/iii)** - `6edf1ac` (test)
3. **Task 3: FM-9 TCB-abort drift probe (D-09a iv)** - `e5da340` (test)

## Files Created/Modified

- `packages/angular-typechecker/src/core/dual-identity-tripwire.spec.ts` - Pure unit tripwire for D-02 dual-identity across three FS modes + transitive-dep negative
- `packages/angular-typechecker/src/core/external-template.integration.spec.ts` - Real-compiler tripwires: D-09.2 `.ts` relatedInformation attribution + D-09a(i) clean-host suppressedInGraph == 0
- `packages/angular-typechecker/src/core/fault-isolation.integration.spec.ts` - Extended with the D-09a(iv)/FM-9 drift probe (verdict-affecting + NG3004 surface pin)
- `fixtures/external-template-tripwire/*` - Component with an external `templateUrl` `.html` carrying NG8002
- `fixtures/clean-template-host/*` - Clean host with an external `.html` component AND an inline-template component

## Decisions Made

- **Dual-identity FS variants at the unit level.** Per the plan's context note, the three filesystem modes are exercised via injected `realpath` + `useCaseSensitiveFileNames` (deterministic cross-platform), never a real symlink/junction in the test run -- mirrors the existing filter-diagnostics.spec OUT-02/T8 idiom.
- **NG8002 for the external-template fixture.** Spike 008 validated NG8002 (`[nonExistentProp]` binding) attributes to the `.html` and carries a `.ts` relatedInformation -- the exact branch-4a ownership signal the tripwire guards.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the impossible Task-3 `coverage-incomplete` assertion on the poison fixture**
- **Found during:** Task 3 (FM-9 TCB-abort drift probe)
- **Issue:** The plan's literal wording -- "run the TCB-poison fixture through `runTypecheck` and assert ... `evaluateResult(result).success === false` with `outcome === 'coverage-incomplete'`" -- is impossible. The poison fixture has `errorCount >= 2` (the NG3004 Fatal + the survivor's TS2322 are real reported errors), and `evaluate-result.ts` step 1 returns `type-error` FIRST whenever `errorCount > 0`. So `evaluateResult(result).outcome` is always `type-error` for that fixture, never `coverage-incomplete`.
- **Fix:** Preserved the plan's INTENT (prove the FM-9 fold is verdict-affecting, not advisory-only) with a factually correct assertion: (a) assert the full-result verdict fails (`evaluateResult(result).success === false`, as `type-error`), and (b) feed the fixture's REAL `result.templateCheckAborted` into an isolated evaluate input (`errorCount: 0, warningCount: 0`) and assert `outcome === 'coverage-incomplete'`. This proves the same real abort signal drives coverage-incomplete when it is the only failure -- the honest end-to-end FM-9 proof.
- **Files modified:** packages/angular-typechecker/src/core/fault-isolation.integration.spec.ts
- **Verification:** `npx vitest run ... fault-isolation` green (6/6); the isolated-signal assertion holds against the real fixture-produced abort object
- **Committed in:** `e5da340` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The correction was necessary for a compilable, truthful test; the plan's stated goal (FM-9 verdict-affecting + NG3004 surface pinned) is fully met. No scope creep.

## Issues Encountered

None - all three specs went green on first run against the real cold compiler; lint and format:check pass on every new/changed file.

## Known Stubs

None - all fixtures and specs are fully wired; the tripwires assert against real diagnostics and the real pipeline.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All D-09a MANDATORY tripwires (i-iv) + the D-09.2 attribution tripwire are committed and green; the dual-identity, attribution, base-clause, and FM-9 invariants each fail LOUD on a future Angular/TS drift.
- Post-merge gate (per AGENTS.md): after the wave's worktree branches merge, run the full `nx test` + build + lint + format:check on the merged main checkout as the authoritative cross-plan integration gate.
- Ran in parallel with 17-06 against a shared junctioned `node_modules`; no dependency changes in this plan.

## Self-Check: PASSED

All 10 created files + 1 modified file present on disk; all three task commits (`d08a9ee`, `6edf1ac`, `e5da340`) exist in git history. The three plan specs run green together (12 tests: 4 dual-identity + 2 external-template + 6 fault-isolation).

---
*Phase: 17-input-set-membership-boundary-layout-support*
*Completed: 2026-07-06*
