# Quick Task 260630-fg0: Address second-round PR review findings - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning
**Discussion mode:** `--analyze --auto` (assumptions pass via gsd-assumptions-analyzer; recommended option auto-locked per gray area). NO trap-quadrant escalations -- the two HIGH-impact items (#1 fix + its test inversion) are both HIGH-confidence; everything else is LOW/MEDIUM impact.

<domain>
## Task Boundary

Address the second-round `/pr-review-toolkit:review-pr` findings on `gsd/v0.0.3-engine-hardening`
(HEAD 13aa9ff, PR #11). One real correctness edge (#1 realpath false-negative), two comment/guard
fixes (#2, #3), and low-cost polish. Scope: `packages/angular-typechecker/src/**` source + specs
only. Commits land on the current branch (into PR #11). No `.planning/` behavior change.
</domain>

<decisions>
## Implementation Decisions

### #1 -- realpath fallback false-NEGATIVE (the one behavioral fix; HIGH impact, HIGH confidence)

- **CONFIRMED:** `filter-diagnostics.ts:129-138` falls back to classifying the UNRESOLVED raw path
  when `realpath` throws. For a symlink whose raw path is out-of-`basePath` but whose realpath
  resolves IN-project, a `realpath` throw -> raw out-of-project kept -> SUPPRESSED -> if it was the
  only error, `errorCount 0` -> `success:true`. A false PASS -- the cardinal sin for a type-checker.
- **FIX (locked, Option A refined): keep-not-suppress on a throwing realpath.** A throw means
  "cannot prove out-of-project", so KEEP the diagnostic (do not suppress), mirroring the existing
  file-less keep idiom at `filter-diagnostics.ts:85`. Accept the minor over-keep (a genuinely
  out-of-project file whose realpath throws is now reported) as the correct fail-safe bias for a
  correctness tool. NOT chosen: Option B (tally failures into `CoreResult` + executor `logger.warn`)
  -- it widens the core/adapter contract and the pure-core boundary for a rarer hazard.
- **MANDATORY coupled change -- INVERT the prior T1 test.** `filter-diagnostics.spec.ts:135-147`
  (added last round, commit `6e890eb`) asserts "throwing realpath + OUT-of-project -> `kept` 0,
  `suppressedCount` 1" -- it encodes the OLD (buggy) behavior. Flip it to
  `kept.length === 1` / `suppressedCount === 0` and rewrite its comment block (`:128-134`) to
  "a throwing realpath cannot prove out-of-project, so the diagnostic is KEPT (fail-safe)". The
  in-project keep companion (`:114-126`) and the non-throwing pnpm-symlink success test
  (`:88-106`) stay green unchanged.

### #2 -- stale "reported set" comments (CONFIRMED)

- Fix `diagnostic-codes.ts:71` and `:86`: detection scans the PRE-filter gathered set in `finalize`
  (the raw `diagnostics` it receives), NOT the post-boundary-filter `reported` set. (My prior
  cleanup fixed `run-typecheck.ts` but missed this sibling file.)

### #3 -- program-undefined guard (CONFIRMED optionality; reachability defense-in-depth)

- Add `if (result.program === undefined) throw new TypecheckInfrastructureError(...)` immediately
  BEFORE the `result.program.getTsProgram()` access (run-typecheck.ts ~268-270). The real
  `PerformCompilationResult.program?` is optional (`perform_compile.d.ts:29`); the shim narrows it.
  Frame the guard comment as DEFENSE-IN-DEPTH (the `{program: undefined, no-500}` return is
  type-permitted but not observed in source) -- it is DISJOINT from the post-compilation 500 scan
  (which handles `UNKNOWN_ERROR_CODE`), so no double-handling. Converts a hypothetical bare
  `TypeError` into the same infra-class failure as the rest of the path.

### Polish (CONFIRMED / cheap)

- **S1:** de-pin `compiler-cli-types.ts:98` -- it cites `run-typecheck.ts:229` but the
  `emitFlags: 0 as EmitFlags` statement is at `:232` (229 is a comment). Replace the line pin with a
  symbol reference.
- **S2 -- DOCUMENT, do NOT drop:** `TemplateCheckAborted.code` (run-typecheck.ts:81) is unused by
  the executor but IS asserted by `infra-failure.spec.ts:219-221` and `run-typecheck.spec.ts:94-97`.
  Dropping it breaks both. Add a one-line note that `code` is retained as the detector's public
  shape (always `NG(3004)`), pinned by the detector/drift tests.
- **S3 -- add pinning test, do NOT change the verdict:** add an `executor.spec.ts` (or
  evaluate-result) test pinning `errorCount 0 + templateCheckAborted set -> { success: true }` with
  the `logger.warn` emitted. Do NOT force `success:false` -- that contradicts the locked
  `09-RES-02-DECISION.md` advisory-not-verdict policy (run-typecheck.ts:65-69).
- **S5(a):** add a config-500 scan test with NON-empty `rootNames` (pins the scan as
  rootNames-independent; low value but cheap).
- **S5(c):** add a unit test with a MIXED Error+Warning diagnostic set exercising the explicit
  `warningCount` split (guards the MD-02 anti-bug; current multi-diagnostic tests are all-Error).
- **S5(d):** add a `.ngtypecheck.tsx` negative case for `normalizeShimFileName` (the regex
  `/\.ngtypecheck\.ts$/` does not match `.tsx`, so it passes through unchanged -- pins the anchor).

### Dropped / no-change (per --analyze)

- **S4 -- NO CHANGE (REFUTED):** the drift prose ("real `api.Program` stays assignable TO the
  shim", real->shim) is ALREADY CORRECT. `AssertAssignable<From, To extends From>` used as
  `<Real, Shim>` asserts From(Real) assignable to To(Shim). The finding misread the helper. Leave
  `compiler-cli-types.drift.ts` comments unchanged.
- **S5(b) -- DROP (REFUTED DUPLICATE):** `includeDeps:true` is already covered e2e through real
  `runTypecheck` at `run-typecheck.integration.spec.ts:129-145` (prior task 260630-dyd refuted the
  identical finding and was correct). Do NOT add a second includeDeps test.
- **S6 -- DECLINE:** `NG()` 4-digit dev-time guard. All callers pass literals; prior task rated this
  class over-engineering. Consistent to decline.

### Claude's Discretion

- Exact test names/placement; the precise canonicalizer signaling for keep-on-throw (sentinel vs.
  early-keep branch) -- whatever is cleanest while preserving the memoization + casefold on the
  success path and the `src/core/**` purity (no console/process).
  </decisions>

<specifics>
## Specific Ideas

Source: second-round 5-agent `/pr-review-toolkit:review-pr` on PR #11 (HEAD 13aa9ff) + this
`--analyze` validation pass. The realpath false-negative (#1) is the only behavioral change; it
INVERTS one prior-round test, which the plan must flip in the same commit. The drift-direction
finding (S4) and the includeDeps test gap (S5b) were both REFUTED and produce no work.

Affected files (expected): `filter-diagnostics.ts` + `filter-diagnostics.spec.ts` (#1),
`diagnostic-codes.ts` (#2), `run-typecheck.ts` (#3 guard + S1/S2 comments), `executor.spec.ts`
(S3), `infra-failure.spec.ts` (S5a), `run-typecheck.spec.ts` (S5c/S5d), `compiler-cli-types.ts`
(S1 de-pin).
</specifics>

<canonical_refs>

## Canonical References

- `.planning/phases/09-.../09-RES-02-DECISION.md` (advisory-not-verdict policy -- gates S3).
- `.planning/quick/260630-dyd-address-all-review-findings/260630-dyd-CONTEXT.md` (prior round; the
  T1 test that #1 now inverts; the includeDeps refutation that S5b duplicates).
- AGENTS.md "Single-plan wave: skip worktrees" (executor runs on the main tree).
  </canonical_refs>
