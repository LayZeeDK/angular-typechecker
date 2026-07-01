---
phase: 260630-fg0-address-second-round-pr-review-findings
reviewed: 2026-06-30T00:00:00Z
depth: quick
files_reviewed: 8
files_reviewed_list:
  - packages/angular-typechecker/src/core/compiler-cli-types.ts
  - packages/angular-typechecker/src/core/diagnostic-codes.ts
  - packages/angular-typechecker/src/core/filter-diagnostics.ts
  - packages/angular-typechecker/src/core/filter-diagnostics.spec.ts
  - packages/angular-typechecker/src/core/run-typecheck.ts
  - packages/angular-typechecker/src/core/run-typecheck.spec.ts
  - packages/angular-typechecker/src/core/infra-failure.spec.ts
  - packages/angular-typechecker/src/executors/angular-typecheck/executor.spec.ts
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: issues_found
---

# GSD Quick Task 260630-fg0: Code Review Report

**Reviewed:** 2026-06-30
**Depth:** quick (focused regression check, advisory/non-blocking)
**Files Reviewed:** 8
**Status:** issues_found (1 Suggestion; no Blockers, no Warnings)

## Summary

Focused regression review of commits `13aa9ff..HEAD` on `gsd/v0.0.3-engine-hardening`, which
address second-round PR-review findings (#1, #2, #3, S1-S5). All six focus checks pass. The
keep-on-throw refactor in `filter-diagnostics.ts`, the structurally-absent-Program guard in
`run-typecheck.ts`, the doc corrections, and the four new tests are correct, complete, and
adhere to project conventions (ASCII-only, core purity, blank lines + braces around control
flow, clean conventional-commit scopes, no AI attribution).

One Suggestion: a PRE-EXISTING sibling test comment in `filter-diagnostics.spec.ts` (NOT
modified by these commits) now describes behavior these commits superseded. It is out of the
strict change scope but worth a one-line fix to keep the test file internally consistent.

### Focus-check verdicts

1. **#1 keep-on-throw correct + complete -- PASS.**
   - (a) Success path byte-unchanged: `realpath` resolves -> `replace(/\\/g,'/')` -> conditional
     `toLowerCase()` -> `cache.set` -> return. Memoization and case-fold ordering preserved
     (filter-diagnostics.ts:157-164).
   - (b) `undefined` cannot be confused with a legitimately-empty canonical path: the empty-
     `fileName` case is intercepted EARLIER by `diagnostic.file.fileName === ''` (line 85) and
     kept as file-less, so it never reaches the canonicalizer. A resolved path can never be
     `undefined` (only the catch returns `undefined`), so the `canonicalFile === undefined`
     check (line 100) is unambiguous.
   - (c) Both `isNodeModulesPath` and `isUnderDir` are bypassed on the keep-on-throw path: the
     `if (canonicalFile === undefined) { kept.push; continue; }` (lines 100-104) returns before
     the classification block (lines 106-113). A throwing realpath on a `node_modules` path is
     therefore now KEPT -- the comment at lines 93-99 documents this as the deliberate fail-safe
     ("never silently drop a diagnostic on an unprovable boundary"). Deliberate, not accidental.
   - (d) No console/process/require added to core (verified by scan).

2. **Inverted T1 test genuinely gates -- PASS.** filter-diagnostics.spec.ts:135-147 asserts
   throwing-realpath + out-of-project (`/ws/sibling-lib/src/b.ts` vs base `/ws/proj`) ->
   `kept` length 1 / `suppressedCount` 0. Against the old suppress-on-throw code (which fell
   back to the raw path, classified out-of-project, and suppressed) this would have asserted
   kept 0 / suppressed 1, so the test would FAIL pre-fix -- not vacuous. The comment
   (lines 128-134) now correctly states "failing-then-passing change" and the fail-safe rationale.

3. **#3 guard placement + disjointness -- PASS.** run-typecheck.ts:265-272 places
   `if (result.program === undefined) throw new TypecheckInfrastructureError(...)` AFTER the
   post-compilation 500 scan (lines 244-252) and BEFORE the first `result.program` deref
   (`result.program.getTsProgram()` at line 292-293). It is disjoint from the 500 scan (that
   handles `UNKNOWN_ERROR_CODE`; this handles a bare `program === undefined` with no 500) -- no
   double-handling. Message is an ASCII string literal. Success path unchanged (the guard only
   fires on a `{ program: undefined }` return, not observed in compiler-cli@22.0.4).

4. **#2/S1/S2 docs -- PASS.** diagnostic-codes.ts:71 and :88 now say "PRE-filter gathered set
   (the raw `diagnostics` `finalize` receives), NOT the post-boundary-filter `reported` set" --
   the stale "reported set" wording is gone and matches `finalize`'s actual behavior
   (run-typecheck.ts:443 scans the PRE-filter `diagnostics` arg). compiler-cli-types.ts:98 no
   longer pins `:229` (now "at the `performCompilation` call site in run-typecheck.ts") -- and
   the call site has in fact drifted (`emitFlags: 0 as EmitFlags` is now at line 236), so
   de-pinning was correct. `TemplateCheckAborted.code` retains a "do not drop" note
   (run-typecheck.ts:81-85) and the `code` field is still present (line 85).

5. **New tests real + non-tautological -- PASS.**
   - S3 (executor.spec.ts:201-217): asserts `result` equals `{ success: true }` with
     `evaluateResult` stubbed to `{ success: true }` and `runTypecheck` returning errorCount 0 +
     `templateCheckAborted`. Asserts `loggerWarn` called once, `loggerError` not called.
     Confirmed it does NOT assert `success: false` anywhere -- it pins the advisory-not-verdict
     contract (abort never forces a failing verdict).
   - S5a (infra-failure.spec.ts:330-362): config-parse 500 with NON-empty `rootNames`
     (`['/virtual/error.component.ts']`) still rejects with `TypecheckInfrastructureError` and
     never reaches `performCompilation` -- pins that the config-500 scan (run-typecheck.ts:167-178)
     is rootNames-independent (it precedes the zero-rootNames guard at line 190).
   - S5c (infra-failure.spec.ts:245-263): mixed Error (TS2322, category 1) + Warning (6133,
     category 0) file-less set -> `errorCount` 1, `warningCount` 1. Both diagnostics are file-less
     so they survive the boundary filter, isolating the EXPLICIT category split
     (run-typecheck.ts:423-428) and guarding the MD-02 `length - errorCount` anti-bug. Category
     values verified against installed typescript.d.ts (Warning=0, Error=1).
   - S5d (run-typecheck.spec.ts:139-153): `.ngtypecheck.tsx` path passes through UNCHANGED
     because the shim regex `/\.ngtypecheck\.ts$/` (run-typecheck.ts:516) is `.ts$`-anchored.
     Pins the `$` anchor as a negative-case guard; deterministic cross-OS literal.

6. **Conventions -- PASS.**
   - ASCII-only: full diff scanned, zero non-ASCII bytes.
   - core/\*\* purity: no `console`/`process`/`require` added to `filter-diagnostics.ts` or
     `run-typecheck.ts`; the keep-on-throw path is silent (returns `undefined`).
   - Blank lines around control flow + always braces: new blocks (filter-diagnostics.ts:100-104,
     188-190; run-typecheck.ts:265-272) all use braces and have surrounding blank lines.
   - Clean conventional-commit scopes: `fix(core)`, `docs(core)`, `test(core)` -- no quick-id
     (`260630-fg0`) leaked into any subject.
   - No AI attribution in any commit subject.
   - `compiler-cli-types.drift.ts` was NOT touched (S4 refuted -- confirmed via name-only diff).
   - No second `includeDeps` test added (S5b refuted -- only the one T1 test was inverted;
     the diff touches no `includeDeps` test).

## Info

### IN-01: Pre-existing sibling RES-03 test comment now describes superseded behavior

**File:** `packages/angular-typechecker/src/core/filter-diagnostics.spec.ts:108-113`
**Issue:** The sibling test "RES-03: a throwing realpath is caught; the in-project diagnostic is
still kept" (line 114) was NOT modified by these commits, but its leading comment still describes
the OLD suppress-on-throw mechanism: "fall back to the unresolved raw path -- ... The fallback
path is still normalized + case-folded, so an in-project diagnostic classifies in-project and is
kept." After commit `f5b030f`, a throwing realpath no longer falls back to the raw path; it
returns `undefined` and the diagnostic is kept via the keep-on-throw branch (filter-diagnostics.ts:100-104),
NOT via raw-path-then-in-project classification. The assertion (kept 1 / suppressed 0) still
passes -- the test is correct -- but the comment's stated MECHANISM is now wrong, which could
mislead a future reader into thinking the raw-path fallback still exists.

This is flagged as Info (not Warning) because: (1) it is a pre-existing comment outside the lines
these commits changed -- the task instruction is to "not re-litigate prior rounds"; (2) the
assertion behavior is correct and the test still gates; (3) it is documentation-only.

**Fix:** Update the comment to reflect the in-project keep-on-throw path, e.g.:

```ts
// RES-03 / D-08: a throwing options.realpath() (EACCES / permission-denied
// junction / broken symlink) must be CAUGHT inside createCanonicalizer; the
// canonicalizer signals `undefined` and the diagnostic is KEPT (the throw must
// NOT escape filterDiagnostics and abort the whole type-check pass). Mirrors the
// out-of-project sibling below -- both sides of the boundary are kept on throw.
it('RES-03: a throwing realpath is caught; the in-project diagnostic is still kept', () => {
```

---

_Reviewed: 2026-06-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
