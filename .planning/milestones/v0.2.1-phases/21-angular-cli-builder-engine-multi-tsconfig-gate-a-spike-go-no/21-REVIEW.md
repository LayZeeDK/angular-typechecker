---
phase: 21-angular-cli-builder-engine-multi-tsconfig-gate-a-spike-go-no
reviewed: 2026-07-10T00:00:00Z
depth: deep
files_reviewed: 21
files_reviewed_list:
  - fixtures/multi-tsconfig-array/app.component.spec.ts
  - fixtures/multi-tsconfig-array/app.component.ts
  - fixtures/multi-tsconfig-array/tsconfig.app.json
  - fixtures/multi-tsconfig-array/tsconfig.spec.json
  - packages/angular-typechecker/builders.json
  - packages/angular-typechecker/package.json
  - packages/angular-typechecker/project.json
  - packages/angular-typechecker/src/builders/typecheck/builder.spec.ts
  - packages/angular-typechecker/src/builders/typecheck/builder.ts
  - packages/angular-typechecker/src/builders/typecheck/nx-surface-regression.spec.ts
  - packages/angular-typechecker/src/builders/typecheck/schema-parity.spec.ts
  - packages/angular-typechecker/src/builders/typecheck/schema.json
  - packages/angular-typechecker/src/core/multi-tsconfig.integration.spec.ts
  - packages/angular-typechecker/src/core/run-typecheck.ts
  - packages/angular-typechecker/src/executors/typecheck/gate-a-static.spec.ts
  - packages/angular-typechecker/src/executors/typecheck/normalize-options.ts
  - packages/angular-typechecker/src/executors/typecheck/schema-parity.spec.ts
  - packages/angular-typechecker/src/executors/typecheck/schema.d.ts
  - packages/angular-typechecker/src/executors/typecheck/schema.json
  - packages/angular-typechecker/src/package-manifest.spec.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 21: Code Review Report

**Reviewed:** 2026-07-10T00:00:00Z
**Depth:** deep
**Files Reviewed:** 21
**Status:** issues_found

## Summary

This phase adds two additive capabilities: an Angular CLI builder (a thin
`convertNxExecutor` re-export) and a tsConfig-ARRAY engine path
(`handleMultiTsConfig` in `run-typecheck.ts`, plus array-aware resolution in
`normalize-options.ts`). I traced the array fan-out end to end through the call
chain: `normalizeOptions` -> `runTypecheck` (Array.isArray guard) ->
`handleMultiTsConfig` -> per-entry `readConfiguration`/`runNoEmitCompilation` ->
single `finalize` over the combined input set -> `evaluateResult` verdict ->
`executor` advisory rendering.

The core change is correct on every axis the phase brief called out:

- **Diagnostic union completeness:** each surviving entry runs the same full
  whole-program gather (`runNoEmitCompilation`); all raw diagnostics are unioned
  before a single `finalize`. The union is produced by the loop independent of
  the filter, so no leaf's diagnostics are lost.
- **Finalize-once-over-combined-input-set:** `finalize` runs exactly once with
  `inputTs = rootNamePaths` (the union of every surviving leaf's declared
  rootNames), so a file that is a rootName of one leaf and a dependency of another
  is kept by membership. It correctly avoids the `runTypecheck`-per-entry +
  merge anti-pattern (which would double-finalize).
- **Zero-rootNames handling:** a zero-rootNames entry is recorded as a
  `zero-root-names` skipped reference and `continue`d; `evaluateResult`
  (`hasZeroRootNamesLeaf`, evaluate-result.ts:134-141) folds it into a
  `coverage-incomplete` (success:false) verdict, so even an all-zero-rootNames
  array is never a silent pass. Verified against `evaluateResult`.
- **Infrastructure-error re-throw:** applied per-entry over `parsed.errors`
  (config-500/ENOENT) AND post-loop over the whole `rawDiagnostics` union
  (performCompilation-500), mirroring `handleSolutionWalk` exactly. `errorCount`
  never counts a compiler crash.

No BLOCKER-class defects (incorrect verdicts, security, data loss) were found.
The three WARNINGs concern user-facing message accuracy and test efficacy: the
array path reuses the walk's `skippedReferences` channel, whose executor-side
advisory hardcodes "solution-tsconfig reference walk" wording that is false for a
directly-supplied array; and the only array tests are three happy-path integration
cases that (a) leave the new zero-rootNames/empty-array/infra branches unexercised
and (b) cannot actually guard the combined-input-set property because the fixture
is co-located under one base directory.

## Warnings

### WR-01: Multi-tsconfig array advisory falsely claims a "solution-tsconfig reference walk"

**File:** `packages/angular-typechecker/src/core/run-typecheck.ts:638-644` (source of the signal); manifests in `packages/angular-typechecker/src/executors/typecheck/executor.ts:124-136`
**Issue:** The new array path records a zero-rootNames entry as a
`skippedReference` (`reason: 'zero-root-names'`), reusing the SAME advisory
channel the solution-walk path uses. The executor's renderer,
`warnSkippedReferences`, hardcodes the message
`"referenced tsconfig '<path>' was skipped or reclassified during the solution-tsconfig reference walk (reason: ...)"`.
For a user who passed an explicit `tsConfig: [leafA, emptyLeaf]` array, there was
NO solution tsconfig and NO reference walk -- the entry was directly named. The
message is factually wrong and, for this tool's primary audience (AI coding agents
and CI), can send a consumer looking for a nonexistent solution config / broken
`references[]`. The verdict itself is correct (coverage-incomplete); only the
guidance is misleading. `skippedReferenceVerdictNote` (executor.ts:159-165) has the
same problem: for the array case the coverage-incomplete outcome comes directly
from `hasZeroRootNamesLeaf`, not from "transitively-imported files dropped by the
project boundary."
**Fix:** Distinguish the array-entry skip from a walked reference. Cheapest options:
(a) add a distinct `reason` (e.g. `'array-entry-zero-root-names'`) or a small
`source: 'array' | 'walk'` discriminator on `SkippedReference`, and branch the
message in `warnSkippedReferences`; or (b) make the message source-neutral, e.g.
`"tsconfig '<path>' was skipped (reason: zero-root-names) -- it declares no input files"`
and drop the "reference walk" clause. Either keeps the correct
coverage-incomplete verdict while removing the false mechanism claim.

### WR-02: New handleMultiTsConfig branches are untested (zero-rootNames skip, empty-array guard, per-entry infra re-throw)

**File:** `packages/angular-typechecker/src/core/multi-tsconfig.integration.spec.ts:47-100` (only coverage); untested logic at `packages/angular-typechecker/src/core/run-typecheck.ts:638-671`
**Issue:** The only array-path tests are three happy-path integration cases (both
leaves have rootNames + errors; single-element array == single string; single
string unchanged). The genuinely new, verdict-deciding branches added this phase
have no test exercising them via the array path:
- zero-rootNames entry in an array -> `skippedReferences` -> coverage-incomplete
  (the exact "silent-pass vs coverage-incomplete" logic the charter forbids
  getting wrong). `evaluate-result.spec.ts:108` proves `evaluateResult` reacts to a
  zero-root-names skip, but nothing proves `handleMultiTsConfig` PRODUCES one from
  an array.
- empty-array defensive throw (`run-typecheck.ts:666-671`).
- per-entry infrastructure re-throw for a nonexistent explicit array entry
  (`run-typecheck.ts:627`).
**Fix:** Add unit/integration cases: an array `[appLeaf, emptyLeaf]` asserting the
`zero-root-names` skippedReference is present and the verdict via `evaluateResult`
is `coverage-incomplete`; an array containing a nonexistent path asserting
`runTypecheck` rejects with `TypecheckInfrastructureError`; and a direct
`runTypecheck({ tsConfigPath: [] })` asserting the empty-array
`TypecheckInfrastructureError`. The walk path already has analogous coverage
(`walk-references.spec.ts:246-290`), so mirror it.

### WR-03: The multi-tsconfig fixture is co-located, so the integration test does not actually guard the combined-input-set property (T-21-05)

**File:** `packages/angular-typechecker/src/core/multi-tsconfig.integration.spec.ts:48-71`; fixture rationale at `fixtures/multi-tsconfig-array/app.component.spec.ts:3-9`
**Issue:** The test claims to prove that the COMBINED input set keeps a file a
single-leaf run would drop ("running the spec leaf ALONE would suppress it as out
of the spec leaf's input set"). That claim is false for this fixture. Both leaves
live in one directory, so `finalize`'s boundary filter keeps any co-located
first-party file via the base-containment clause
(`filter-diagnostics.ts:285`, branch (c) `isUnderDir(fullForm, canonicalBase)`) --
independent of input-set membership. I traced it: even if `handleMultiTsConfig`
regressed to pass only the FIRST leaf's rootNames as `inputTs`,
`app.component.spec.ts` (the second leaf's file) is still under the shared base
dir and would be KEPT, so the test's "both diagnostics surface" assertion still
passes. The union of DIAGNOSTICS is produced by the per-entry loop regardless of
`inputTs`; the filter is the only thing `inputTs` affects, and the base clause
masks it here. The test therefore verifies diagnostic-union + single-element
parity, but is NOT a regression guard for the combined-input-set-membership
boundary the production change is about.
**Fix:** Add a fixture (or a second array assertion) where the shared file is NOT
under the representative leaf's base directory -- e.g. two leaves in sibling
directories whose shared imported file is a rootName of leaf A but only a
dependency of leaf B, and where a single-leaf-B run demonstrably drops it (counts
it as `suppressedInGraph`). Then assert the combined array KEEPS it via membership.
That isolates the mechanism the base clause currently hides. At minimum, correct
the fixture rationale comment so it does not overstate what the test proves.

## Info

### IN-01: handleMultiTsConfig does not dedupe duplicate array entries (diverges from the walk path)

**File:** `packages/angular-typechecker/src/core/run-typecheck.ts:618-660`
**Issue:** The reference walk explicitly dedupes leaves (`seenCanonicalLeaves`,
walk-references.ts:166-175) and records a repeat as `reason: 'duplicate'`. The
array path does not: a repeated entry (`tsConfig: [leaf, leaf]`) is
`readConfiguration`'d and compiled twice, and its diagnostics are pushed twice
into the union. `finalize`'s `ts.sortAndDeduplicateDiagnostics` removes the
duplicate DIAGNOSTICS (so no false error count), but `rootNamesCount` is
double-counted and `rootNamePaths` carries duplicates (harmless for the Set-based
membership). Impact is limited to an inflated, informational `rootNamesCount` plus
redundant compiler work (perf, out of v1 scope). Behavior/verdict are unaffected.
**Fix:** Optional. If accuracy of `rootNamesCount` matters, canonicalize+dedupe
entries as the walk does (and optionally record a `'duplicate'` skip for parity),
or document that array entries are assumed distinct.

### IN-02: CoreResult.tsConfigPath reports the first entry even when it was skipped

**File:** `packages/angular-typechecker/src/core/run-typecheck.ts:682-695`
**Issue:** `finalize` is called with `firstEntry` as the result's `tsConfigPath`.
`firstParsed`/`firstEntry` are assigned on the first iteration BEFORE the
zero-rootNames check (run-typecheck.ts:629-632), so if the first array entry is a
zero-rootNames (e.g. solution-style) config that was skipped, `CoreResult.tsConfigPath`
names a tsconfig that was NOT actually checked. The field's documented contract
(D-07b: "the resolved absolute tsconfig path actually checked", run-typecheck.ts:55)
is not strictly honored on the array path. The code comment calls it the
"representative" path, so this is a known simplification; it is advisory-only and
never affects the verdict.
**Fix:** Optional. Prefer the first SURVIVING entry for `tsConfigPath`/basePath
fallback, or relax the field's documented meaning for the array path.

### IN-03: normalize-options doc comment says "readonly string[]" but the type is mutable

**File:** `packages/angular-typechecker/src/executors/typecheck/normalize-options.ts:51-52`
**Issue:** The comment states `coreOptions.tsConfigPath` "then carries
string | readonly string[]", but the actual type (and the deliberate design
documented in `CoreOptions`, run-typecheck.ts:27-33) is the MUTABLE
`string | string[]` -- chosen specifically so `Array.isArray` narrows both branches.
The comment mildly contradicts the intended design it should be reinforcing.
**Fix:** Change the comment to "string | string[]" to match the type and the
`CoreOptions` rationale.

---

_Reviewed: 2026-07-10T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
