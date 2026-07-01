---
phase: quick-260630-jnl
plan: 01
subsystem: core
tags: [pr-review, test-quality, comment-precision, no-behavior-change]
status: complete
requires: []
provides:
  - 'S5c anti-tautology guard (3-element Error+Warning+Suggestion set)'
  - 'isUnderDir undefined-base over-keep branch coverage'
  - 'program-undefined-no-500 guard coverage'
  - 'de-pinned useCaseSensitiveFileNames symbol reference'
  - 'sharpened #3 defense-in-depth comments'
affects:
  - packages/angular-typechecker/src/core/infra-failure.spec.ts
  - packages/angular-typechecker/src/core/filter-diagnostics.spec.ts
  - packages/angular-typechecker/src/core/compiler-cli-types.runtime.spec.ts
  - packages/angular-typechecker/src/core/run-typecheck.ts
tech-stack:
  added: []
  patterns:
    - 'file-less ts.Diagnostic builders by category (1/0/2) for category-split unit coverage'
    - 'injected realpath that throws selectively (base-only) to reach a specific defensive branch'
    - 'symbol-reference comments over line-pin references (drift-resistant)'
key-files:
  created: []
  modified:
    - packages/angular-typechecker/src/core/infra-failure.spec.ts
    - packages/angular-typechecker/src/core/filter-diagnostics.spec.ts
    - packages/angular-typechecker/src/core/compiler-cli-types.runtime.spec.ts
    - packages/angular-typechecker/src/core/run-typecheck.ts
decisions:
  - "Suggestion code 6138 (benign 'declared but never read'); only .category===2 matters"
  - 'Broad /returned no Program/ regex (OS-independent) for the program-undefined guard assertion'
  - 'infra-failure.spec.ts:204 left untouched (REFUTED finding -- prose, no pin)'
  - 'compiler-cli-types.ts perform_compile.d.ts pins left untouched (out of scope)'
metrics:
  duration: ~7m
  completed: 2026-06-30
---

# Phase quick-260630-jnl Plan 01: Address Third-Round PR Review Findings Summary

Addressed all five third-round `/pr-review-toolkit:review-pr` findings on PR #11 (de-tautologized the S5c warning-count test, covered two shipped-but-untested defensive branches, removed a stale line pin, and sharpened two `run-typecheck.ts` comments) with ZERO production behavior change.

## Tasks Completed

### Task 1 (`test(core)`) -- commit `f0b98c0`

Three test changes across two spec files (exact RESEARCH.md code):

- **#1 S5c anti-tautology:** Added a file-less `suggestionDiagnostic(code, message)` builder (category 2) to `infra-failure.spec.ts` alongside the existing `errorDiagnostic`/`warningDiagnostic`. Upgraded the S5c test to feed a 3-element set `[errorDiagnostic(TS2322), warningDiagnostic(6133), suggestionDiagnostic(6138)]`, KEPT `errorCount===1`/`warningCount===1`, and ADDED `expect(result.errorCount + result.warningCount).toBeLessThan(result.diagnostics.length)`. Logic sanity-check: correct explicit split gives `1+1=2 < 3` PASS; the buggy `warningCount = length - errorCount = 3-1 = 2` gives `1+2=3`, NOT `< 3`, so the guard would FAIL under the MD-02 regression -- anti-tautology restored.
- **#2 undefined-base filter branch:** Added the `RES-03` test to `filter-diagnostics.spec.ts` whose injected `realpath` throws for the base (`/ws/proj`) ONLY and returns identity for files. The file canonicalizes normally (line-100 short-circuit does NOT fire), `canonicalBase` is undefined, so `isUnderDir(file, undefined)` returns true -> `kept` 1 / `suppressedCount` 0 (covers `filter-diagnostics.ts:188-190`).
- **#3 program-undefined guard:** Added a D-06 describe test where `performCompilation` returns `{ diagnostics: [], program: undefined }` (NO 500). Empty diagnostics means the 500 scan finds nothing, so execution reaches the distinct program-undefined guard -> `rejects.toBeInstanceOf(TypecheckInfrastructureError)` + `rejects.toThrow(/returned no Program/)`.

### Task 2 (`docs(core)`) -- commit `02c5ead`

Comment-text only; guard logic/message and the deref left byte-unchanged:

- **#4 de-pin:** In `compiler-cli-types.runtime.spec.ts`, replaced the stale `(run-typecheck.ts:265-267)` line pin with a symbol reference (`the getTsProgram().useCaseSensitiveFileNames() read in runTypecheck`), no line number. The `expect(...).toBe('function')` assertion was untouched.
- **#5 comment precision:** In `run-typecheck.ts`, reworded `access in finalize below` -> `access in the finalize CALL ARGS below (within runTypecheck)` (kept the backticks around `finalize`), and de-pinned `(@angular/compiler-cli perform_compile.d.ts:29)` -> `the optional program? field of PerformCompilationResult`.

## Verification

- `npx nx test angular-typechecker`: **155 passed (155)**, 26 test files. Run after Task 1 (cached) and again after Task 2 with `--skip-nx-cache` (fresh) -- both green.
- `infra-failure.spec.ts` now reports **9 tests** (S5c upgraded + new program-undefined-no-500 test).
- `filter-diagnostics.spec.ts` now reports **17 tests** (RES-03 base-throw added).
- Grep checks (Task 2): stale `run-typecheck.ts:265-267` pin GONE; `perform_compile.d.ts:29` pin GONE in `run-typecheck.ts`; `CALL ARGS below` present; symbol references present (verified via `rg` with backtick-free patterns -- the longer `finalize CALL ARGS below` pattern intentionally NOT used per the plan-checker correction, since a backtick sits between `finalize` and CALL).

## Deviations from Plan

None - plan executed exactly as written. REFUTED / out-of-scope items left untouched as specified: `infra-failure.spec.ts:204` (prose, no pin) and the `compiler-cli-types.ts` `perform_compile.d.ts` pins.

## Self-Check: PASSED

- infra-failure.spec.ts: FOUND (modified, `suggestionDiagnostic` builder + upgraded S5c + #3 guard test)
- filter-diagnostics.spec.ts: FOUND (modified, RES-03 base-throw test)
- compiler-cli-types.runtime.spec.ts: FOUND (modified, de-pinned symbol reference)
- run-typecheck.ts: FOUND (modified, two reworded comments)
- Commit f0b98c0: FOUND
- Commit 02c5ead: FOUND
