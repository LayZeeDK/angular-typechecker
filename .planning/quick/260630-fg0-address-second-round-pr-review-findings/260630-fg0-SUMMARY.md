---
phase: quick-260630-fg0
plan: 01
subsystem: core engine + executor adapter
tags: [pr-review, correctness, defense-in-depth, tdd, tests]
status: complete
requires:
  - The angular-typechecker core engine (filter-diagnostics, run-typecheck, diagnostic-codes)
provides:
  - Keep-on-throw realpath fail-safe (no false PASS on an unresolvable symlink)
  - Defense-in-depth guard for a structurally-absent compiler Program
  - Corrected detection-set documentation + four pinning tests
affects:
  - PR #11 (branch gsd/v0.0.3-engine-hardening)
tech-stack:
  added: []
  patterns:
    - "Sentinel return (undefined) signals 'cannot classify' from a pure canonicalizer; the caller keeps the diagnostic"
    - 'Defense-in-depth runtime guard converts a hypothetical bare TypeError into the existing infra-error class'
key-files:
  created: []
  modified:
    - packages/angular-typechecker/src/core/filter-diagnostics.ts
    - packages/angular-typechecker/src/core/filter-diagnostics.spec.ts
    - packages/angular-typechecker/src/core/run-typecheck.ts
    - packages/angular-typechecker/src/core/diagnostic-codes.ts
    - packages/angular-typechecker/src/core/compiler-cli-types.ts
    - packages/angular-typechecker/src/executors/angular-typecheck/executor.spec.ts
    - packages/angular-typechecker/src/core/infra-failure.spec.ts
    - packages/angular-typechecker/src/core/run-typecheck.spec.ts
decisions:
  - 'A throwing realpath KEEPS the diagnostic (cannot prove out-of-project), inverting the prior suppress-on-throw test'
  - 'The program-undefined guard is a runtime defense only; the vendored shim program type stays non-optional'
  - 'S1 de-pins the emitFlags comment to a symbol reference instead of a drifting line number'
  - 'TemplateCheckAborted.code is retained (pinned by tests) and documented as adapter-unused-but-kept'
metrics:
  duration: ~9 minutes
  completed: 2026-06-30
  tasks: 3
  commits: 4
  files-changed: 8
  tests-total: 153
---

# Quick Task 260630-fg0: Address second-round PR review findings Summary

Closed the one behavioral false-PASS edge (a symlink whose realpath throws was being
SUPPRESSED, masking a real error), added a defense-in-depth guard for a structurally-absent
compiler Program, corrected two stale "reported set" comments plus an S1/S2 documentation
polish, and added four additive pinning tests -- all surgical and confined to
`packages/angular-typechecker/src/**`.

## What Was Built

### Task 1 (`fix(core)`, commit `f5b030f`) -- keep-on-throw realpath fix (#1) + inverted T1 test

- `createCanonicalizer` return type widened to `(filePath: string) => string | undefined`; the
  catch now `return undefined` instead of falling back to the unresolved raw path. `undefined` is
  NOT cached (a transient EACCES could resolve on a later call).
- `filterDiagnostics` adds a `canonicalFile === undefined -> kept.push(diagnostic) + continue`
  guard before the node_modules/isUnderDir branch, mirroring the file-less keep idiom; it never
  reaches `suppressedCount++`.
- `isUnderDir` widened to accept `string | undefined`; an `undefined` base (basePath realpath
  threw) returns `true` (over-keep-safe), so a non-node_modules file is kept rather than
  suppressed against an unprovable baseline.
- The success path (memoization + `\\`->`/` normalize + case-fold) is byte-unchanged.
- SAME COMMIT: inverted the prior T1 test (filter-diagnostics.spec.ts) from `kept 0 / suppressed 1`
  to `kept 1 / suppressed 0`, renamed it to the KEEP intent, and rewrote the comment block.

### Task 2 (`fix(core)` guard `b71447d`; `docs(core)` comments `f4648be`)

- #3 guard (run-typecheck.ts): `if (result.program === undefined) throw new
TypecheckInfrastructureError(...)` inserted between the post-compilation 500 scan and the
  `return finalize(...)`. Literal `angular-typecheck:`-prefixed message (no diagnostic to flatten);
  framed as defense-in-depth, disjoint from the 500 scan, runtime-only (shim stays non-optional).
- #2 (diagnostic-codes.ts:71, :86): "reported set" -> "PRE-filter gathered set (the raw
  `diagnostics` `finalize` receives), NOT the post-boundary-filter `reported` set".
- S1 (compiler-cli-types.ts): de-pinned `run-typecheck.ts:229` to a symbol reference
  ("at the `performCompilation` call site in run-typecheck.ts").
- S2 (run-typecheck.ts): added a retention note above `TemplateCheckAborted.code` -- kept as the
  detector's public shape, pinned by tests, adapter-unused; the field was NOT dropped.

### Task 3 (`test(core)`, commit `cbfc881`) -- four additive pinning tests

- S3 (executor.spec.ts): `errorCount 0 + templateCheckAborted set -> { success: true }` STILL emits
  `logger.warn` and no `logger.error` (advisory-not-verdict; verdict not forced false).
- S5a (infra-failure.spec.ts): config-500 scan re-throws with NON-empty `rootNames` and never
  reaches `performCompilation` (scan is rootNames-independent).
- S5c (infra-failure.spec.ts): a new `warningDiagnostic` builder (category 0) drives a mixed
  Error+Warning set through `runTypecheck` to assert `errorCount === 1` AND `warningCount === 1`
  (explicit category split; MD-02 `length - errorCount` anti-bug guard).
- S5d (run-typecheck.spec.ts): a `.ngtypecheck.tsx` path passes through `detectTemplateCheckAborted`
  unchanged (the `/\.ngtypecheck\.ts$/` anchor does not match `.tsx`).

## TDD Red->Green Observation (Task 1)

Inverted T1 FIRST (RED): ran `npx nx test angular-typechecker --testFile=filter-diagnostics.spec.ts`
against the OLD suppress-on-throw source. The inverted RES-03 KEEP test FAILED:
`AssertionError: expected [] to have a length of 1 but got +0` at `expect(result.kept).toHaveLength(1)`
-- the old code suppressed (kept 0 / suppressed 1) while the test now expects keep (kept 1 /
suppressed 0). The other 15 tests passed (15 passed | 1 failed).

Then applied the keep-on-throw fix (GREEN): re-ran the same suite -> all 16 tests passed, including
the inverted RES-03 KEEP test. Red->green confirmed: the fix is exactly what flips the test.

## Deviations from Plan

None - all three tasks executed exactly as written. No Rule 1-4 deviations were needed.

## Deferred Issues (out of scope -- SCOPE BOUNDARY)

`npx nx lint angular-typechecker` reports 2 pre-existing WARNINGS (0 errors), both in
`packages/angular-typechecker/src/core/compiler-cli-types.drift.ts` (line 49 `'To'`, line 30 `'NG'`
unused) -- a file the plan EXPLICITLY forbids touching (S4 refuted). These predate this task (last
touched by commit `3da72fb`, before the task base `13aa9ff`) and are not introduced by these
changes. Lint exits clean (0 errors), so the gate passes. Not fixed per the scope boundary.

## Verification

- `npx nx test angular-typechecker`: 153 passed (26 files) -- includes the inverted T1 (RES-03 KEEP)
  and the four new pinning tests (S3, S5a, S5c, S5d).
- `npx nx build angular-typechecker`: success (the widened `createCanonicalizer` return type and the
  `result.program === undefined` guard type-check; the shim `program` stays non-optional).
- `npx nx lint angular-typechecker`: success (0 errors; 2 pre-existing out-of-scope warnings).
- `src/core/**` purity preserved: no `console`/`process` added (the keep signal is a pure return;
  the guard throws the existing infra-error class).

## Self-Check: PASSED

All 8 modified source files exist, the SUMMARY.md exists, and all four task commit hashes
(`f5b030f`, `b71447d`, `f4648be`, `cbfc881`) are present in git history.
