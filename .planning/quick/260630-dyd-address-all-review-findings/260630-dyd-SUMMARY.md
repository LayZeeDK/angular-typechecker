---
phase: quick-260630-dyd
plan: 01
subsystem: testing
tags: [angular, typescript, nx-plugin, vitest, diagnostics, tcb]
status: complete

# Dependency graph
requires:
  - phase: 09-resilience-per-file-fault-isolation-boundary-robustness
    provides: RES-02 template-check-aborted detection + boundary filter
provides:
  - I-1 fix: out-of-basePath TCB-generation Fatals (NG3004) now fire templateCheckAborted even when suppressed from the reported set
  - T1/T3/S-types coverage closures (throwing-realpath both-sides, infra re-throw message, useCaseSensitiveFileNames reach-through)
  - Dead-mock / unreferenced-fixture / rot-prone-comment cleanups
affects: [release v0.0.3, PR #11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Detect whole-program signals (templateCheckAborted) on the pre-filter superset, not the post-filter reported set"

key-files:
  created: []
  modified:
    - packages/angular-typechecker/src/core/run-typecheck.ts
    - packages/angular-typechecker/src/core/infra-failure.spec.ts
    - packages/angular-typechecker/src/core/filter-diagnostics.spec.ts
    - packages/angular-typechecker/src/core/compiler-cli-types.runtime.spec.ts
    - packages/angular-typechecker/src/core/suppress-output-path.integration.spec.ts
    - .fallowrc.jsonc
  deleted:
    - fixtures/fault-isolation/non-template-error.component.ts
    - fixtures/fault-isolation/tsconfig.non-template.json

key-decisions:
  - "I-1 Option A (LOCKED): detect NG3004 on the pre-filter `diagnostics` arg in `finalize`, not the post-filter `reported` set; keep the first-found `.find` (no in-project-preference branch)"
  - "I-1 gate is the mock-harness regression test driving runTypecheck end-to-end (RED on reported-arg, GREEN on pre-filter-arg); no bare detectTemplateCheckAborted unit test as the gate; no real cross-project integration fixture (not cross-OS feasible)"
  - "S-test: remove the two unreferenced RES-01 spike fixtures (already covered by fault-isolation.integration.spec.ts) rather than wiring them in"
  - "S-comments: replace `(typescript.js:129892)` line pins with `(verifyCompilerOptions, TS 6.0.3)`; drop the `.fallowrc.jsonc` 56/14 magic-number counts, keep rationale"

patterns-established:
  - "Whole-program abort detection scans the raw gathered (pre-filter) set so suppression by the boundary filter never silences the notice"

# Metrics
duration: 18min
completed: 2026-06-30
---

# Quick Task 260630-dyd: Address all review findings Summary

**Closed the one genuine behavioral PR #11 review gap (a silent RES-02 notice on out-of-basePath TCB poison) with a failing-then-passing mock-harness regression test, closed three confirmed coverage gaps (T1/T3/S-types), and removed dead/rot-prone artifacts -- engine vitest suite green (149/149).**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-30 (PLAN_START at task load)
- **Completed:** 2026-06-30
- **Tasks:** 3 (committed as 6 atomic commits)
- **Files modified:** 6 modified, 2 deleted

## Accomplishments

- **I-1 behavioral fix (the only genuine gap):** `finalize` now calls `detectTemplateCheckAborted(diagnostics)` on the PRE-filter superset rather than `detectTemplateCheckAborted(reported)` on the post-filter+deduped set. An out-of-basePath TCB-generation Fatal (NG3004) that the boundary filter suppresses from the reported set still fires `templateCheckAborted` (the abort is whole-program, so survivors' template diagnostics are gone regardless of where the offending shim lives). Counts are unchanged -- `errorCount`/`warningCount` still derive only from `reported`, so this is purely additive signalling.
- **I-1 regression test:** drives `runTypecheck` end-to-end through the `infra-failure.spec.ts` mock harness with a synthesized out-of-basePath NG3004; asserts `suppressedCount >= 1`, the NG3004 absent from `result.diagnostics`, YET `templateCheckAborted` set (with the `.ngtypecheck` shim infix normalized back to `/elsewhere/poison.component.ts`).
- **T1/T3/S-types coverage closures** added with deterministic cross-OS assertions; no production behavior changed.
- **Cleanups** (S-code/S-test/S-comments): dead `EmitFlags.None` mock member removed, two unreferenced spike fixtures `git rm`-removed, three `typescript.js:129892` line pins and two `.fallowrc.jsonc` magic-number counts de-pinned -- all with rationale preserved.

## I-1 RED -> GREEN confirmation

- **RED** (detection on the post-filter `reported` set, pre-fix): the new test failed with `AssertionError: expected undefined to be defined` at `expect(result.templateCheckAborted).toBeDefined()` -- the NG3004 was correctly suppressed (`suppressedCount` and absence asserts passed) but the notice was silently lost. Observed by running the new test against the un-fixed `detectTemplateCheckAborted(reported)` call site.
- **GREEN** (detection on the pre-filter `diagnostics` arg, post-fix): all 6 `infra-failure.spec.ts` tests pass; `templateCheckAborted` is set with `.code === TCB_GENERATION_FATAL_DIAGNOSTIC_CODE` and `.fileName === '/elsewhere/poison.component.ts'`.

## Task Commits

Each task was committed atomically (Task 3 split by changelog scope):

1. **Task 1: I-1 behavioral fix + failing-then-passing regression test** - `830ea4b` (fix)
2. **Task 2: T1/T3/S-types coverage gaps** - `6e890eb` (test)
3. **Task 3a: remove unreferenced fault-isolation spike fixtures (S-test)** - `1567109` (chore)
4. **Task 3b: drop dead EmitFlags.None mock + de-pin spec line refs (S-code + S-comments)** - `6cf758b` (test)
5. **Task 3c: de-pin production typescript.js line reference (S-comments)** - `a0b6516` (docs)
6. **Task 3d: drop rot-prone .fallowrc entry-point/dev-dep counts (S-comments)** - `53c8c18` (chore)

_Note: Task 1 is a TDD task; the RED was observed by running the new test against the un-fixed call site before applying the GREEN one-line change, then both were committed together as the single behavioral fix._

## Files Created/Modified

- `packages/angular-typechecker/src/core/run-typecheck.ts` - I-1 fix: `detectTemplateCheckAborted(diagnostics)` (pre-filter arg) + reframed `finalize` comment blocks (~358-361 doc-comment and ~400-405 detection block); de-pinned `typescript.js:129892` -> `verifyCompilerOptions, TS 6.0.3`.
- `packages/angular-typechecker/src/core/infra-failure.spec.ts` - I-1 mock-harness regression test + `fileDiagnostic` helper + `TCB_GENERATION_FATAL_DIAGNOSTIC_CODE` import; T3 `rejects.toThrow` message asserts at both 500 scans; removed dead `EmitFlags: { None: 0 }` mock member; de-pinned `129892`.
- `packages/angular-typechecker/src/core/filter-diagnostics.spec.ts` - T1: throwing-realpath + out-of-project path -> `kept` 0, `suppressedCount` 1.
- `packages/angular-typechecker/src/core/compiler-cli-types.runtime.spec.ts` - S-types: `useCaseSensitiveFileNames` reach-through assertion in test (a).
- `packages/angular-typechecker/src/core/suppress-output-path.integration.spec.ts` - S-comments: de-pinned `129892`.
- `.fallowrc.jsonc` - S-comments: dropped the literal 56/14 counts, kept rationale.
- `fixtures/fault-isolation/non-template-error.component.ts` - DELETED (unreferenced RES-01 spike leftover).
- `fixtures/fault-isolation/tsconfig.non-template.json` - DELETED (unreferenced RES-01 spike leftover).

## Verification

- `npx nx test angular-typechecker` (full engine vitest suite, run cold with `--skip-nx-cache`): **149 passed (149)** across **26 test files**. Baseline before changes was 147; +1 from the I-1 regression test, +1 from the T1 test (T3 and S-types add assertions to existing tests, not new test cases).
- `git grep "typescript.js:129892" -- packages/` returns no matches.
- `git grep -e "the 56 real" -e "the 14 dev" -- .fallowrc.jsonc` returns no matches.
- `git grep "EmitFlags: { None"` returns no matches in `packages/`.
- Both non-template fixtures show as deleted in `git status`.

## Deviations from Plan

None - plan executed exactly as written. Task 3 was split into four atomic commits (rather than one) to keep changelog-meaningful scopes clean (`chore`, `test(core)`, `docs(core)`, `chore(fallow)`), as the plan's commit-message guidance explicitly permits ("split or combine as fits").

## Known Stubs

None. No stub patterns introduced; all changes are surgical edits to existing logic, tests, comments, and fixtures.

## Threat Flags

None. All edits preserve the `core/**` purity boundary (no `console`/`process`/logging introduced); the I-1 detection field remains pure signalling rendered by the adapter, not a verdict reclassification (D-05 intact). No dependency adds/removes/upgrades; no new network/auth/filesystem surface. The threat register's `mitigate` disposition for T-dyd-02 (infra-500 re-throw classifies by code only) is upheld -- T3 asserts the flattened message is surfaced verbatim, never parsed for control flow.

## Self-Check: PASSED

- SUMMARY.md exists at `.planning/quick/260630-dyd-address-all-review-findings/260630-dyd-SUMMARY.md`.
- All 6 modified files present; both fixtures confirmed deleted.
- All 6 commits exist in history: `830ea4b`, `6e890eb`, `1567109`, `6cf758b`, `a0b6516`, `53c8c18`.
- Full engine vitest suite: 149 passed (149) across 26 files.
