# Quick Task 260630-jnl: Address third-round PR review findings - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning
**Discussion mode:** `--analyze --auto` (gsd-assumptions-analyzer validated all 5 findings against HEAD a1bcb80; recommended options auto-locked). NO trap-quadrant items -- every finding is a test addition or comment/pin polish, LOW impact + HIGH confidence. Research folded into the analyze pass (it returned exact test code + the verbatim guard message), so no separate researcher was spawned for this trivial round.

<domain>
## Task Boundary

Address the third-round `/pr-review-toolkit:review-pr` findings on `gsd/v0.0.3-engine-hardening`
(PR #11). ALL findings target test-quality + comment-pin polish of the prior round's own changes;
NO production behavior change. Scope: `packages/angular-typechecker/src/core/**` specs + two source
comments. Commits land on the current branch (into PR #11).
</domain>

<decisions>
## Implementation Decisions (all auto-locked: LOW impact, HIGH confidence)

### #1 (Important) -- de-tautologize the S5c warningCount test

- CONFIRMED: `infra-failure.spec.ts:248-265` feeds `[Error, Warning]` (length 2); the buggy
  `warningCount = length - errorCount = 2-1 = 1` EQUALS the correct count, so the test cannot catch
  the MD-02 regression it claims to guard.
- FIX: add a file-less `suggestionDiagnostic(code, message)` builder (category `2`, mirroring the
  existing file-less `errorDiagnostic`/`warningDiagnostic` at infra-failure.spec.ts:52-76), feed a
  3-element set `[Error(TS2322), Warning(6133), Suggestion(<code>)]`, KEEP the existing
  `errorCount === 1` / `warningCount === 1` asserts, and ADD the anti-tautology guard
  `expect(result.errorCount + result.warningCount).toBeLessThan(result.diagnostics.length)`. Correct
  code: `2 < 3` PASS; under the `length - errorCount` bug: `1 + 2 = 3`, NOT `< 3` -> FAILS. A
  Suggestion (category 2) is RETAINED in `CoreResult.diagnostics` (length 3) but NEVER counted
  (CoreResult invariant `errorCount + warningCount <= diagnostics.length`). The suggestion code only
  needs `.category === 2`; use a benign non-colliding 4-digit code (NOT 500 / a `-99xxxx` NG code).

### #2 (Important) -- cover the `isUnderDir(undefined base)` over-keep branch

- CONFIRMED uncovered: both existing throwing-realpath tests throw for EVERY input, so
  `canonicalFile === undefined` short-circuits the keep at filter-diagnostics.ts:100 and `isUnderDir`
  is never reached with an undefined dir; the `:188-190` branch (`canonicalBase === undefined ->
return true`) added in f5b030f is shipped untested.
- FIX: add a `filter-diagnostics.spec.ts` test whose `realpath` throws for the BASE (`/ws/proj`)
  ONLY and returns identity for files (`/ws/proj/src/a.ts`), asserting `kept` length 1 /
  `suppressedCount` 0 (the file canonicalizes normally so line 100 does not short-circuit;
  `canonicalBase` is undefined; `isUnderDir(file, undefined)` returns true -> kept).

### #3 (Suggestion) -- cover the program-undefined guard's distinct branch

- CONFIRMED uncovered: the only `program: undefined` test also plants a 500, so it exits via the
  post-compilation 500 scan (run-typecheck.ts:244-252) and never reaches the guard at `:265-272`.
- FIX: add an `infra-failure.spec.ts` test (D-06 describe) where `performCompilation` returns
  `{ diagnostics: [], program: undefined }` (NO 500) -> `rejects.toBeInstanceOf(TypecheckInfrastructureError)`
  and `rejects.toThrow(/returned no Program/)`. Verbatim guard message (verified):
  "angular-typecheck: the Angular compiler returned no Program (performCompilation produced neither a
  Program nor an UNKNOWN_ERROR_CODE diagnostic). This is an infrastructure failure, not a type error."
  Use the broad `/returned no Program/` regex (OS-independent, no punctuation coupling). The default
  beforeEach config supplies non-empty rootNames, so execution reaches `performCompilation`.

### #4 (Suggestion) -- de-pin the stale line reference I introduced

- CONFIRMED: `compiler-cli-types.runtime.spec.ts:118` cites `run-typecheck.ts:265-267` for the
  `useCaseSensitiveFileNames()` read, but the b71447d guard insertion shifted that read to ~:292-294
  (line 265 is now the guard). De-pin to a SYMBOL reference (e.g. "the
  `getTsProgram().useCaseSensitiveFileNames()` read in `runTypecheck`"), no line number.
- REFUTED half: the claimed "same drift at infra-failure.spec.ts:204" does NOT exist -- line 204 is
  prose with no `run-typecheck.ts` line pin. NO change there. (Repo-wide, the `265-267` pin lives in
  exactly one place.)

### #5 (Suggestion) -- comment precision + external de-pin (cosmetic)

- run-typecheck.ts:260: reword "access in `finalize` below" -> "access in the `finalize` CALL ARGS
  below (within `runTypecheck`)" -- the deref `result.program.getTsProgram()` runs in the finalize
  call args (:292-294), not the finalize body.
- run-typecheck.ts:255: de-pin the `perform_compile.d.ts:29` external line ref -> symbolic "the
  optional `program?` field of `PerformCompilationResult`". SCOPE: only the run-typecheck.ts site the
  finding names; leave the `compiler-cli-types.ts` `perform_compile.d.ts` pins untouched (not flagged
  -- avoid scope creep).

### Claude's Discretion

- Exact suggestion code value; test names/placement; task grouping (tests vs comments).
  </decisions>

<specifics>
## Specific Ideas

Source: third-round 5-agent `/pr-review-toolkit:review-pr` on PR #11 (HEAD a1bcb80) + this
`--analyze` validation pass. Every finding is self-inflicted polish from the round-2 changes
(the S5c test, the two new defensive branches, and a line pin shifted by the guard insertion).
No production code behavior changes -- specs + two comments only.

Affected files: `infra-failure.spec.ts` (#1 builder + S5c upgrade, #3 guard test),
`filter-diagnostics.spec.ts` (#2 base-throw test), `compiler-cli-types.runtime.spec.ts` (#4 de-pin),
`run-typecheck.ts` (#5 two comment edits).
</specifics>

<canonical_refs>

## Canonical References

- Prior rounds: `.planning/quick/260630-fg0-.../260630-fg0-CONTEXT.md` (introduced the S5c test, the
  realpath keep-on-throw branch, the program guard, and the de-pinning pass this round extends).
- AGENTS.md "Single-plan wave: skip worktrees" (executor runs on the main tree); drift-machinery /
  comment-accuracy rule (motivates #4/#5).
  </canonical_refs>
