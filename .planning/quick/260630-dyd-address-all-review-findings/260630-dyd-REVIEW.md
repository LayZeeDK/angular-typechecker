---
task: 260630-dyd-address-all-review-findings
reviewed: 2026-06-30T00:00:00Z
depth: quick
range: 3eb2e5d..HEAD
branch: gsd/v0.0.3-engine-hardening
files_reviewed: 8
files_reviewed_list:
  - packages/angular-typechecker/src/core/run-typecheck.ts
  - packages/angular-typechecker/src/core/infra-failure.spec.ts
  - packages/angular-typechecker/src/core/filter-diagnostics.spec.ts
  - packages/angular-typechecker/src/core/compiler-cli-types.runtime.spec.ts
  - packages/angular-typechecker/src/core/suppress-output-path.integration.spec.ts
  - .fallowrc.jsonc
  - fixtures/fault-isolation/non-template-error.component.ts (DELETED)
  - fixtures/fault-isolation/tsconfig.non-template.json (DELETED)
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Quick Task 260630-dyd: Code Review Report

**Reviewed:** 2026-06-30
**Depth:** quick (focused regression check)
**Range:** `3eb2e5d..HEAD` (6 commits)
**Status:** CLEAN -- no findings (advisory / non-blocking review)

## Summary

This is a focused regression check on a set of fixes that address prior PR-review findings.
The ONLY behavioral change is a single line in `run-typecheck.ts`
(`detectTemplateCheckAborted(reported)` -> `detectTemplateCheckAborted(diagnostics)`);
everything else is test coverage, comment de-pinning, and deletion of two orphaned spike
fixtures. I read all changed files in full, traced the I-1 data flow, ran the affected
suites, and empirically proved the I-1 regression test gates the change. All five focus
checks pass. No Critical, Important, or Suggestion findings.

I went beyond pattern-matching for this review: I ran `npx vitest run` on the two changed
spec files (22 tests pass), then temporarily reverted the I-1 one-liner to the old
`reported`-based call and re-ran -- the I-1 test failed exactly at
`expect(result.templateCheckAborted).toBeDefined()` ("expected undefined to be defined").
That is positive proof the test is a genuine failing-then-passing gate, not vacuous. The
source file was restored byte-identical (`git status` clean).

## Focus-check results

### 1. The I-1 one-line change is correct and complete -- VERIFIED

- **(a) Cannot change counts or the reported set.** `errorCount`/`warningCount` are computed
  from `reported` (the post-filter, sorted-and-deduped set) at `run-typecheck.ts:396-401`,
  and `result.diagnostics` is `reported` (line 421). `detectTemplateCheckAborted` is a pure
  read that returns a separate `TemplateCheckAborted | undefined`; it is spread into the
  result conditionally (line 426) and never feeds back into `kept`/`reported`/counts.
  Switching its INPUT arg from `reported` to `diagnostics` (the pre-filter superset) cannot
  alter any of those. Confirmed.
- **(b) `.find` first-found semantics unaffected.** `detectTemplateCheckAborted` still uses a
  pure code-only `.find` (`run-typecheck.ts:446-448`). The compiler reports the deduped Fatal
  once; scanning the pre-filter superset is order/dedup-independent because the predicate is a
  single code equality. First-found semantics are intact.
- **(c) Reframed comments are accurate, no stale "reported set" wording.** The JSDoc at
  ~358-364 and the inline block at ~403-415 now correctly describe scanning the PRE-filter
  `diagnostics` arg (a superset of `reported`) and explain WHY (out-of-basePath poison is
  suppressed from `reported`). No stale "scans the same reported set"/"kept set is post-filter"
  wording remains at the detection site. NOTE (not a finding): the `CoreResult.templateCheckAborted`
  field JSDoc at lines 52-61 and the `detectTemplateCheckAborted` function JSDoc at lines
  430-442 still say "in the REPORTED set" / "scans the reported diagnostics" and name the
  param `reported`. This is internally consistent and harmless -- the function is generic over
  whatever set it is handed, and the param name is local. It is a documentation nuance, not a
  correctness or staleness defect, so no finding is raised. (If desired, those two doc spots
  could later be reworded to "the scanned set" for symmetry, but this is below Suggestion
  threshold for a regression check.)
- **(d) Detection stays pure.** `detectTemplateCheckAborted` and `normalizeShimFileName` use no
  `console`/`process` -- just `.find`, object construction, and a regex `.replace`. The core
  boundary (eslint bans `console`/`process` under `**/src/core/**`) is intact.

### 2. The I-1 regression test genuinely gates -- VERIFIED EMPIRICALLY

`infra-failure.spec.ts` "RES-02 / I-1" drives the real `runTypecheck` through the mock
harness: `performCompilation` returns one NG3004 (`TCB_GENERATION_FATAL_DIAGNOSTIC_CODE`)
whose `file.fileName` is `/elsewhere/poison.component.ngtypecheck.ts`; the mock
`readConfiguration` returns `options: {}`, so `resolveFilterBasePath` falls back to
`dirname('/virtual/tsconfig.json')` = `/virtual`, making the NG3004 out-of-basePath and thus
SUPPRESSED. The test asserts `suppressedCount >= 1`, NG3004 ABSENT from `result.diagnostics`,
`templateCheckAborted` DEFINED, its `.code` is NG3004, and its `.fileName` is the
shim-normalized `/elsewhere/poison.component.ts`.

I proved the gate by reverting the one-liner to `detectTemplateCheckAborted(reported)` and
re-running: the test FAILED at `expect(result.templateCheckAborted).toBeDefined()`
("expected undefined to be defined"), exactly as the test comment predicts. With the fix in
place it passes. Not vacuous. The `fileDiagnostic` helper added for this (file-carrying
`{ fileName }` shim) is the minimal surface the detector + boundary filter read -- correct.

### 3. T1 / T3 / S-types assertions are real and deterministic -- VERIFIED

- **T1 (`filter-diagnostics.spec.ts` RES-03 OUT-of-project):** asserts a throwing realpath is
  caught AND an out-of-project raw path (`/ws/sibling-lib/...` not under `/ws/proj`) is
  SUPPRESSED (`kept` length 0, `suppressedCount` 1). Complements the existing in-project KEEP
  test; both literals are POSIX-style absolute paths with no OS-dependent tail -- deterministic
  cross-OS. Real (exercises the catch -> raw-path-fallback -> classification path), not
  tautological.
- **T3 (`infra-failure.spec.ts`):** two `rejects.toThrow(/.../)` assertions on the flattened
  messageText. The post-performCompilation case asserts `/simulated internal crash/`; the
  config-stage case asserts `/no such file or directory/` -- deliberately a path-free,
  drive-letter-free substring, so the regex is stable on Windows/Linux/macOS. These prove the
  re-thrown `TypecheckInfrastructureError` carries the compiler text verbatim (not a
  placeholder). Real.
- **S-types (`compiler-cli-types.runtime.spec.ts`):** adds
  `expect(typeof program.getTsProgram().useCaseSensitiveFileNames).toBe('function')` against a
  REAL `NgtscProgram`. This reach-through covers the one production-read vendored runtime member
  (`run-typecheck.ts:265-267`) that is in neither `GATHERED_GETTERS` nor the build-time drift
  probe. It fails loudly if the member is renamed/removed upstream. The cited line reference
  `run-typecheck.ts:265-267` matches the actual `useCaseSensitiveFileNames()` call site exactly.
  Real.

### 4. Fixture deletion is safe -- VERIFIED

`git grep` finds ZERO remaining references to `non-template-error`, `tsconfig.non-template`,
or `NonTemplateErrorComponent` anywhere in source, specs, or config (`':!.planning'`). The
`fault-isolation.integration.spec.ts` references only `tsconfig.app.json`,
`survivor.component.ts`, and `tcb-poison.component.ts`, all of which remain. The remaining
`fault-isolation/tsconfig.app.json` `files` array lists only `tcb-poison.component.ts` +
`survivor.component.ts` -- it never included the deleted `non-template-error.component.ts`.

The `.fallowrc.jsonc` `fixtures/fault-isolation/**` override is NOT orphaned: the directory
still holds `survivor.component.ts`, `tcb-poison.component.ts`, `*.html`, and
`tsconfig.app.json`, so the `unrendered-components`/`unused-component-inputs` suppression
still has live targets. Deleting the two spike files leaves the glob legitimately scoped.

### 5. Conventions -- VERIFIED

- **ASCII-only:** the added diff lines contain no non-ASCII characters (checked the full
  added-line set with a `[^\x00-\x7F]` scan -- none). Comment de-pinning uses plain ASCII.
- **Blank lines around control flow / returns; always braces:** the single behavioral change
  is one assignment line; no new control-flow blocks were introduced. The surrounding (and
  edited-adjacent) code already follows the brace + blank-line conventions. Test files use
  braces throughout.
- **No AI attribution in commits:** scanned all 6 commit messages -- no `Co-Authored-By`,
  `Generated with`, or `claude`/`anthropic` strings.
- **Clean conventional scopes / no quick-id leak:** the 6 subjects use
  `fix(core)`, `test(core)`, `docs(core)`, `chore(fallow)`, `chore:` -- release-meaningful
  scopes with no internal quick-id (`260630-dyd`) leak into the changelog. Note the behavioral
  fix is correctly typed `fix(core): fire template-check-aborted notice ...` (will appear in
  the Fixes section + bump patch under the 0.x mapping), while the de-pin/cleanup commits are
  `docs`/`chore`/`test` (no bump, hidden from changelog) -- exactly the right attribution.

## Verdict

No findings. The I-1 fix is correct, complete, pure, and covered by a genuinely-gating
regression test (proven by revert-and-rerun). T1/T3/S-types assertions are real and
cross-OS-deterministic. The two fixture deletions are fully dereferenced and do not orphan the
`.fallowrc.jsonc` glob. All conventions hold. This regression-focused change ships clean.

---

_Reviewed: 2026-06-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick (focused regression check; non-blocking / advisory)_
