---
phase: 13-engine-solution-tsconfig-reference-walking
plan: 03
subsystem: engine
tags: [angular-compiler-cli, typescript, reference-walk, diagnostics, nx-plugin, core-purity]

# Dependency graph
requires:
  - phase: 13-engine-solution-tsconfig-reference-walking (Plan 13-01)
    provides: exported createCanonicalizer + isUnderDir from filter-diagnostics.ts (reused verbatim by the walk)
  - phase: 13-engine-solution-tsconfig-reference-walking (Plan 13-02)
    provides: solution-style fixtures (consumed by the later integration tier, not this pure unit plan)
provides:
  - walkReferences pure core module (WALK-01 engine core)
  - WalkResult interface (rawDiagnostics union + summed rootNamesCount + skippedReferences)
  - SkippedReference interface (referencePath + reason discriminator)
  - private REFERENCE_NOT_FOUND_DIAGNOSTIC_CODE = 90002 + file-less synthesizer (D-05)
  - pure unit spec proving all five walk decisions without a cold compiler
affects:
  - Plan 13-04 (run-typecheck D-03a three-way split invokes walkReferences)
  - Plan 13-05 (integration tier over the solution-style fixtures)
  - Phase 14 (typecheck-configuration generator relies on the walk)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Pure core walk module mirroring filter-diagnostics.ts / gather-diagnostics.ts modularity'
    - 'Detect-by-code-only 500 -> 90002 reclassification (never source/message text)'
    - 'File-less synthesized Error diagnostic (file/start/length undefined) idiom for 90002'
    - 'skippedReferences pure-detection field pattern (no logging in core; adapter renders later)'

key-files:
  created:
    - packages/angular-typechecker/src/core/walk-references.ts
    - packages/angular-typechecker/src/core/walk-references.spec.ts
  modified: []

key-decisions:
  - '90002 REFERENCE_NOT_FOUND code lives as a private const in walk-references.ts (sibling to 90001); the synthesizer is co-located with the walk that emits it'
  - "The walk sources its pre-compile canonicalizer's realpath + useCaseSensitiveFileNames from ts.sys (pure; no per-leaf Program exists yet)"
  - 'The walk returns RAW diagnostics and NEVER filters/dedupes per leaf; runTypecheck feeds the union into the single existing finalize (Pitfalls 1 and 2)'

patterns-established:
  - 'Pattern: pure reference-walk decision module unit-tested against stub ng (readConfiguration/performCompilation/UNKNOWN_ERROR_CODE) + real ts, no cold compiler'
  - 'Pattern: platform-robust spec path fixtures computed via the same resolve(solutionDir, ref.path) the module uses (drive-prefixed on Windows) and keyed on the stub'

requirements-completed: [WALK-01]

# Metrics
duration: ~25min
completed: 2026-07-01
---

# Phase 13 Plan 03: walk-references Pure Core Module Summary

**Pure, Nx-agnostic `walkReferences` core module that resolves a solution tsconfig's direct references one level, guards the module boundary + dedupes self/duplicate leaves, synthesizes a counted 90002 for a not-found leaf PATH (fold-and-count with survivor), records skippedReferences, and returns the raw union + summed rootNamesCount -- proven by a stub-driven unit spec with no cold compiler.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-01T15:58Z (approx, plan load)
- **Completed:** 2026-07-01T16:22Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments

- `walk-references.ts`: `walkReferences(ng, ts, solutionParsed, solutionTsConfigPath): Promise<WalkResult>` -- resolves each direct `references[]` entry against the solution dir, canonicalizes + dedupes (self-reference + duplicate leaf skipped), applies the D-01 boundary guard (reused `createCanonicalizer`/`isUnderDir`, no duplicate canonicalizer), runs `performCompilation` per surviving leaf with the verbatim emit-neutralizing override block + `gatherAllDiagnostics`, unions the RAW per-leaf diagnostics, synthesizes a file-less counted `90002` Error for a not-found leaf PATH (detected by `code === ng.UNKNOWN_ERROR_CODE` only), and returns `{ rawDiagnostics, rootNamesCount (sum), skippedReferences }`.
- `WalkResult` + `SkippedReference` interfaces with `reason: 'out-of-project' | 'zero-root-names' | 'self-reference' | 'not-found'`, modelled on the RES-02 `TemplateCheckAborted` pure-detection pattern.
- `walk-references.spec.ts`: 11 pure unit tests (no fixtures, no cold compiler) covering all five behaviors plus detect-by-code-only, the 5012-out-of-scope case, a no-references empty walk, and an `it.each` reason-discriminator table.
- Core purity verified: 0 `console.` / 0 `process.` / 0 `@nx/devkit` import / 0 `.source ===` / 0 self-declared canonicalizer.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the pure walk-references.ts core module** - `02a1c53` (feat)
2. **Task 2: Pure unit spec walk-references.spec.ts** - `f0047c5` (test)

_TDD note (Task 1 was `tdd="true"`): the RED failing spec was written first (import of the not-yet-existing module failed), the module was implemented to GREEN, then the spec was expanded to the full Task 2 coverage. The two files were committed as one `feat` (module) + one `test` (spec) rather than separate RED/GREEN test commits, because the initial RED spec and the final spec are the same file (Task 2 is the spec deliverable); RED was proven by a run, not by an intermediate commit._

## Files Created/Modified

- `packages/angular-typechecker/src/core/walk-references.ts` - the WALK-01 pure core walk (walkReferences + WalkResult + SkippedReference + 90002 synth + boundary-guard/dedupe reuse).
- `packages/angular-typechecker/src/core/walk-references.spec.ts` - the pure unit spec (stub `ng` + real `ts`, no cold compiler).

## Decisions Made

- **90002 constant + synthesizer co-located in `walk-references.ts`** (Directive 1 / RESEARCH offered "sit beside 90001 in run-typecheck.ts OR in the walk module"): kept it private to the walk module since it fires only during the walk; sibling comment mirrors the 90001 "outside TS/NG/500 spaces" rationale.
- **Pre-compile canonicalizer sourced from `ts.sys`** (`useCaseSensitiveFileNames` + `realpath`): the walk decides which leaves to compile BEFORE any Program exists, so it cannot read a program host's case-sensitivity like the direct path does. `ts.sys` keeps core pure (it is not `console`/`process`) and is injectable in the unit spec.
- **Boundary guard uses `canonicalLeaf ?? leafPath`** when passing to `isUnderDir`: a throwing realpath (undefined canonical) is treated over-keep-safe by `isUnderDir` (undefined base returns true), so a leaf is walked rather than silently dropped -- consistent with the RES-03 fail-safe bias.

## Deviations from Plan

**1. [Rule 3 - Blocking] Platform-correct spec path fixtures**

- **Found during:** Task 1 (GREEN run) / Task 2
- **Issue:** The initial spec hardcoded POSIX absolute leaf paths (`/ws/solution/tsconfig.app.json`). On Windows, `node:path` `resolve(solutionDir, ref.path)` -- the resolution the module performs -- produces drive-prefixed backslash paths (`D:\ws\solution\...`), so the stub `readConfiguration` keys did not match and `skippedReferences.referencePath` did not equal the hardcoded POSIX strings. All 5 initial tests failed for this test-harness reason (the module was correct).
- **Fix:** The spec now computes every expected leaf path with the SAME `resolve(SOLUTION_DIR, ref.path)` the module uses (`leaf()` helper) and keys the stub on it, making the spec platform-independent. The `ts.sys` stub is forced case-sensitive + identity-realpath so canonicalization is a pure slash-normalizer.
- **Files modified:** `packages/angular-typechecker/src/core/walk-references.spec.ts`
- **Verification:** `npx nx test angular-typechecker -- walk-references.spec.ts` green (11 tests); full suite 194 tests green.
- **Committed in:** `f0047c5` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking test-harness fix)
**Impact on plan:** The fix was confined to the test harness (path fixtures); the module implementation matched the plan as written. No scope creep.

## Issues Encountered

- None beyond the platform path-fixture deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `walkReferences` is ready to be invoked by `run-typecheck.ts` at the D-03a three-way split (Plan 13-04). Its `WalkResult.rawDiagnostics` union feeds the existing single `finalize`; `rootNamesCount` is the sum over walked leaves; `skippedReferences` will be threaded onto `CoreResult` and rendered by the executor adapter (`logger.warn`) in a later plan.
- The `SkippedReference` interface is defined in `walk-references.ts`; Plan 13-04 must decide whether to re-export it from `run-typecheck.ts` / `index.ts` for the public `CoreResult` field (RESEARCH Directive 2 allows either source).
- No blockers.

## Self-Check: PASSED

- `packages/angular-typechecker/src/core/walk-references.ts` - FOUND
- `packages/angular-typechecker/src/core/walk-references.spec.ts` - FOUND
- commit `02a1c53` (feat, Task 1) - FOUND
- commit `f0047c5` (test, Task 2) - FOUND
- `npx nx run-many -t typecheck-drift test -p angular-typechecker` - 194 tests green, drift tripwire green

---

_Phase: 13-engine-solution-tsconfig-reference-walking_
_Completed: 2026-07-01_
