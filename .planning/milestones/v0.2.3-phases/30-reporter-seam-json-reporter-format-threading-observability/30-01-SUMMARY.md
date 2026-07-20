---
phase: 30-reporter-seam-json-reporter-format-threading-observability
plan: 01
subsystem: core
tags: [observability, totalFilesCount, coreresult, angular-compiler-cli, nx-plugin, walk-references]

# Dependency graph
requires:
  - phase: v0.1.0 reference-walk engine (archived)
    provides: runTypecheck finalize/finalizeUnion, walk-references gatherLeafInto/LeafAccumulator, the direct vs walk vs multi-tsconfig-array paths
  - phase: v0.2.0 input-set-membership boundary (archived)
    provides: the shared finalizeUnion union-then-single-finalize tail both walk callers reuse
provides:
  - "CoreResult.totalFilesCount?: number — OPTIONAL, additive, non-declaration source-file count captured on BOTH engine paths (direct live Program; walk/multi-tsconfig name-deduped Set via finalizeUnion)"
  - "LeafAccumulator.sourceFileNames: Set<string> + WalkResult.totalFilesCount — the walk/fan-out accumulator field threaded through finalizeUnion"
  - "Verdict-neutrality lock: evaluateResult never reads totalFilesCount (negative test, D-11 / T-30-01)"
  - "total-files-count.integration.spec.ts — real-compiler exact-literal dedupe proof over solution-style-overlap"
affects: [30-02 json-report reads summary.totalFilesCount, 30-03 adapter threading, 32 additive-only git-diff audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional-additive CoreResult scalar via the value-presence conditional spread (...(x !== undefined ? { x } : {})), not presentIfNonEmpty (array-only)"
    - "Name-deduped Set<string> of non-declaration source files across walked leaves, threaded as a finalizeUnion param (both walk + array-fan-out callers)"
    - "Verdict-neutral observability field: EvaluateInput Pick omission locked by a negative test"

key-files:
  created:
    - packages/angular-typechecker/src/core/total-files-count.integration.spec.ts
  modified:
    - packages/angular-typechecker/src/core/run-typecheck.ts
    - packages/angular-typechecker/src/core/walk-references.ts
    - packages/angular-typechecker/src/core/run-typecheck.spec.ts
    - packages/angular-typechecker/src/core/walk-references.spec.ts
    - packages/angular-typechecker/src/core/infra-failure.spec.ts

key-decisions:
  - "totalFilesCount counts non-declaration source files via the !isDeclarationFile filter (matching gather-diagnostics.ts:152-153) — which INCLUDES Angular-generated .ngtypecheck.ts TCB shims, so the count is authored files + generated shims (documented; the exact-literal fixture is 2 = shared.component.ts + its shim)"
  - "Field is OPTIONAL + spread via the value-presence idiom (Pitfall 14); omitted on no-Program guard paths (empty / none-in-project)"
  - "evaluate-result.ts UNTOUCHED — EvaluateInput Pick keeps omitting the field (verdict-neutral, D-11)"

patterns-established:
  - "Value-presence scalar spread for optional CoreResult fields captured off a live Program"
  - "Real-compiler exact-literal dedupe assertion (never >= rootNamesCount) as the cross-Program dedupe proof"

requirements-completed: [OBS-01, VER-01]

coverage:
  - id: D1
    description: "CoreResult gains OPTIONAL totalFilesCount; the direct single-leaf path captures the non-declaration source-file count off the live Program (excludes .d.ts)"
    requirement: OBS-01
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/core/run-typecheck.spec.ts#CoreResult.totalFilesCount (OBS-01 / D-11) > is carried on the result shape as a number"
        status: pass
      - kind: other
        ref: "nx typecheck angular-typechecker (tsc spec + drift + tools) — index.drift.ts still compiles (additive-only)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Verdict-neutrality: evaluateResult returns a byte-identical {success, outcome} with vs without totalFilesCount, at any count, on clean AND failing verdicts (D-11 / T-30-01 mitigation)"
    requirement: OBS-01
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/core/run-typecheck.spec.ts#CoreResult.totalFilesCount (OBS-01 / D-11) > is verdict-neutral: evaluateResult is byte-identical with vs without it..."
        status: pass
    human_judgment: false
  - id: D3
    description: "Walk / multi-tsconfig path accumulates a name-deduped Set<string> of non-declaration source files (LeafAccumulator.sourceFileNames via gatherLeafInto, shared by the solution walk AND the tsConfig-array fan-out), threaded onto CoreResult via finalizeUnion"
    requirement: OBS-01
    verification:
      - kind: integration
        ref: "packages/angular-typechecker/src/core/total-files-count.integration.spec.ts#totalFilesCount walk-path name-dedupe (solution-style-overlap)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Real-compiler dedupe proof: solution-style-overlap (shared.component.ts compiled in BOTH leaves) asserts the EXACT deduped totalFilesCount literal (2), proving the doubly-compiled file is counted once (a naive per-leaf sum would yield 4)"
    requirement: VER-01
    verification:
      - kind: integration
        ref: "packages/angular-typechecker/src/core/total-files-count.integration.spec.ts#counts the doubly-compiled shared.component.ts EXACTLY once across both leaves"
        status: pass
    human_judgment: false

# Metrics
duration: 17min
completed: 2026-07-18
status: complete
---

# Phase 30 Plan 01: totalFilesCount observability capture Summary

**Optional, verdict-neutral `CoreResult.totalFilesCount` (non-declaration source-file count) captured on both engine paths — the direct live Program and a name-deduped `Set<string>` across walked leaves via `finalizeUnion` — proven by a real-compiler exact-literal dedupe spec.**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-07-18T02:53:00Z
- **Completed:** 2026-07-18T03:10:00Z
- **Tasks:** 2
- **Files modified:** 6 (5 modified, 1 created)

## Accomplishments
- Added `CoreResult.totalFilesCount?: number` (OPTIONAL, additive) — the meaningful "files checked" number the JSON reporter (30-02) will surface as `summary.totalFilesCount`.
- Captured it on the direct single-leaf path off the live `Program` and on the walk / multi-tsconfig-array path via a name-deduped `Set<string>` (`LeafAccumulator.sourceFileNames` → `WalkResult.totalFilesCount` → `finalizeUnion`), so a source file compiled in two leaves is counted once.
- Locked verdict-neutrality (D-11 / T-30-01): `evaluateResult` never reads the field — a negative test proves the verdict is byte-identical with and without it, at any count, on both clean and failing runs.
- Real-compiler proof over the `solution-style-overlap` walk fixture asserts the EXACT deduped literal, proving cross-leaf name-dedupe.

## Task Commits

Each task was committed atomically (both `tdd="true"` — implementation + tests in one atomic commit each; the additive optional field has no meaningful runtime-RED under esbuild, so test + impl landed together):

1. **Task 1: Capture totalFilesCount on the direct single-leaf path (D-11 / OBS-01)** - `3a61abd` (feat)
2. **Task 2: Capture totalFilesCount on the walk / multi-tsconfig path + real-count integration proof (D-11 / OBS-01 / VER-01)** - `86b32d7` (feat)

**Plan metadata:** (this SUMMARY + STATE.md + ROADMAP.md) — final `docs` commit.

## Files Created/Modified
- `packages/angular-typechecker/src/core/run-typecheck.ts` - `CoreResult.totalFilesCount?` field; direct-path live-Program capture; `finalizeUnion` gains a `totalFilesCount` param + value-presence spread; both walk callers (`handleSolutionWalk`, `handleMultiTsConfig`) pass the Set size.
- `packages/angular-typechecker/src/core/walk-references.ts` - `LeafAccumulator.sourceFileNames: Set<string>`; `gatherLeafInto` populates it (`!isDeclarationFile`, name-dedupe); `WalkResult.totalFilesCount` carried as `acc.sourceFileNames.size`.
- `packages/angular-typechecker/src/core/total-files-count.integration.spec.ts` - NEW real-compiler dedupe proof (exact literal `2` on `solution-style-overlap`).
- `packages/angular-typechecker/src/core/run-typecheck.spec.ts` - field-presence + verdict-neutrality negative tests.
- `packages/angular-typechecker/src/core/walk-references.spec.ts` - fixed the `performResult` program stub to expose `getTsProgram().getSourceFiles()` (Rule 1).
- `packages/angular-typechecker/src/core/infra-failure.spec.ts` - fixed the `fakeProgram` stub to expose `getTsProgram().getSourceFiles()` (Rule 1).

## Decisions Made
- **The count includes Angular-generated `.ngtypecheck.ts` TCB shims.** The plan-mandated filter (`!isDeclarationFile` over `program.getTsProgram().getSourceFiles()`, mirroring `gather-diagnostics.ts:152-153`) keeps generated shims because they are non-declaration `.ts` files. So the `solution-style-overlap` exact literal is **2** = the authored `shared.component.ts` + its `shared.component.ngtypecheck.ts` shim (each compiled in both leaves but name-deduped to one; a naive per-leaf sum yields 4). This is deliberate parity with the gatherer and is documented in the integration spec's comment. **30-02 must describe `summary.totalFilesCount` as "authored source files + generated TCB shims the type-check processed", not "author files".**
- **Value-presence spread over `presentIfNonEmpty`** for the scalar (the latter is array-only), matching the shipped `templateCheckAborted` idiom. Field is omitted on no-Program guard paths (empty / none-in-project).
- **`evaluate-result.ts` left untouched** — verdict-neutrality by construction (EvaluateInput Pick omission).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `infra-failure.spec.ts` program stub lacked `getSourceFiles`**
- **Found during:** Task 1 (direct-path capture)
- **Issue:** The direct path now reads `result.program.getTsProgram().getSourceFiles()`; the shared `fakeProgram()` stub only exposed `useCaseSensitiveFileNames`, crashing 5 tests with `getSourceFiles is not a function`.
- **Fix:** Added `getSourceFiles: () => []` to the stub (file-less diagnostics → count 0; these tests do not assert the count).
- **Files modified:** `packages/angular-typechecker/src/core/infra-failure.spec.ts`
- **Verification:** `nx test` green (462 passed).
- **Committed in:** `3a61abd` (Task 1 commit)

**2. [Rule 1 - Bug] `walk-references.spec.ts` `performResult` stub lacked `getTsProgram().getSourceFiles()`**
- **Found during:** Task 2 (walk-path capture)
- **Issue:** `gatherLeafInto` now iterates the leaf Program's source files; the `performResult` stub returned `program: {} as Program`, crashing 7 walk-routing tests.
- **Fix:** Stub now returns `{ getTsProgram: () => ({ getSourceFiles: () => [] }) }`; updated its now-stale "reads NOTHING off the Program" comment.
- **Files modified:** `packages/angular-typechecker/src/core/walk-references.spec.ts`
- **Verification:** `nx test` green (462 passed).
- **Committed in:** `86b32d7` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — test-double stubs that did not expose a Program method the new capture reads). Both are direct consequences of the source change, not pre-existing failures. No scope creep.
**Impact on plan:** Necessary for the planned change to pass its own unit tier. No production-code deviation.

## Deliberate Simplifications (ponytail)
- **No standalone direct-path real-compiler integration test.** Per the plan's exact test scope, Task 1 proves the direct path at the unit tier (field presence + verdict-neutrality) and Task 2's integration spec proves the WALK path's exact deduped literal. The direct-path capture rides on the identical `!isDeclarationFile` predicate the walk integration proves against a real compiler, plus the existing production integration suite (which exercises the direct path). Add a dedicated direct-path exact-literal integration case only if a future audit wants it isolated — the logic is not novel to the direct path.

## Issues Encountered
- Determining the exact deduped literal required running the fixture (per plan): the real value is **2**, not the naive "1 authored file" guess, because the Angular `.ngtypecheck.ts` shim is a counted non-declaration source file. Pinned `toBe(2)` with a precise comment explaining the composition and the naive-sum=4 dedupe-regression tripwire.

## Known Stubs
None. `totalFilesCount` is wired end-to-end (captured on the direct, walk, and multi-tsconfig-array paths); 30-02 consumes it. Test-double program stubs return empty source-file lists by design (those unit tests do not assert the count).

## Next Phase Readiness
- **30-02 (JSON reporter):** `CoreResult.totalFilesCount` is available for `summary.totalFilesCount`. Document it as "authored source files + generated TCB shims processed" (the shim-inclusion nuance above), and remember it is OPTIONAL (omitted on no-Program guard paths) — the JSON summary must tolerate `undefined`.
- Additive-only charter held: `index.ts` barrel and `index.drift.ts` are byte-unchanged; `evaluate-result.ts` untouched. All gates green (`nx test` 462, `nx integration` 120, `nx typecheck`, `nx lint` maxWarnings:0, `nx format:check`).

## Self-Check: PASSED
- Commits exist: `3a61abd` (Task 1), `86b32d7` (Task 2) — both found in `git log`.
- Files exist: `run-typecheck.ts`, `walk-references.ts`, `total-files-count.integration.spec.ts` (+ 3 modified specs) — all present.
- Additive-only proof: `index.ts` / `index.drift.ts` / `evaluate-result.ts` NOT in the two-commit diff (barrel + drift + verdict owner untouched).

---
*Phase: 30-reporter-seam-json-reporter-format-threading-observability*
*Completed: 2026-07-18*
