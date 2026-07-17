---
phase: 21-angular-cli-builder-engine-multi-tsconfig-gate-a-spike-go-no
plan: 02
subsystem: engine
tags: [eng-01, tsconfig-array, multi-tsconfig, union-then-single-finalize, input-set-boundary, oneOf, schema]

# Dependency graph
requires:
  - phase: 21-01
    provides: GATE A' = GO (human-authorized); the shipped engine + executor + builder the array widening extends
  - phase: v0.2.0 (shipped)
    provides: the union-then-single-finalize tail (handleSolutionWalk/walkReferences) + the input-set-membership boundary (buildFinalizeFilter) reused verbatim
provides:
  - CoreOptions.tsConfigPath widened to string | string[] + handleMultiTsConfig (array union-then-single-finalize over the combined declared input set)
  - TypecheckExecutorOptions.tsConfig widened to string | string[]; array-aware normalize-options (map resolveOne)
  - executor + builder schema.json tsConfig oneOf string|array (minItems 1)
  - hermetic fixtures/multi-tsconfig-array (co-located app+spec leaves, planted TS2322 + TS2345) + real-compiler integration spec
affects: [21-03 (builder schema-parity + Nx-surface guards), Phase 22 configuration write-fork (wires tsConfig: [buildLeaf, specLeaf]), Phase 24 e2e]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "tsConfig array fan-out = handleMultiTsConfig: union raw per-entry diagnostics -> ONE finalize over the COMBINED declared input set (mirror of handleSolutionWalk's surviving-leaf tail, sourced from an explicit path list); NEVER per-entry runTypecheck+merge"
    - "widening seam: additive string -> string|string[] at four points (schema.d.ts, both schema.json oneOf, normalize-options, CoreOptions) with the single-string path + Nx executor path byte-unchanged"
    - "zero-rootNames array entry -> recorded 'zero-root-names' SkippedReference so evaluateResult surfaces coverage-incomplete (never a silent pass), mirroring the walk not the direct path's hard 90001"

key-files:
  created:
    - fixtures/multi-tsconfig-array/app.component.ts
    - fixtures/multi-tsconfig-array/app.component.spec.ts
    - fixtures/multi-tsconfig-array/tsconfig.app.json
    - fixtures/multi-tsconfig-array/tsconfig.spec.json
    - packages/angular-typechecker/src/core/multi-tsconfig.integration.spec.ts
  modified:
    - packages/angular-typechecker/src/core/run-typecheck.ts
    - packages/angular-typechecker/src/executors/typecheck/schema.d.ts
    - packages/angular-typechecker/src/executors/typecheck/schema.json
    - packages/angular-typechecker/src/builders/typecheck/schema.json
    - packages/angular-typechecker/src/executors/typecheck/normalize-options.ts
    - packages/angular-typechecker/src/executors/typecheck/schema-parity.spec.ts

key-decisions:
  - "CoreOptions.tsConfigPath / TypecheckExecutorOptions.tsConfig widened to MUTABLE string | string[] (not readonly): Array.isArray narrows a readonly-array union only in the true branch, so a readonly member left the byte-unchanged single-string body typed as the union (TS2345). Mutable narrows in both branches, keeping the Array.isArray guard + the single-string body untouched. Verified empirically at nx build."
  - "handleMultiTsConfig calls finalize EXACTLY ONCE over the combined input set; a zero-rootNames entry is a coverage-incomplete SkippedReference (evaluateResult's only zero-root-names channel), a per-entry 500 re-throws as infra, an empty array throws infra -- never a silent pass (T-21-05)."
  - "handleMultiTsConfig is co-located-leaf oriented: FIRST entry is the representative tsConfigPath + basePath source (input-set membership, not basePath, is the primary boundary); a solution/references entry lands as a zero-rootNames skip (single-level)."

patterns-established:
  - "tsConfig-array union-then-single-finalize (handleMultiTsConfig)"
  - "additive string -> string|string[] widening seam"

requirements-completed: []  # ENG-01 substantively delivered + integration-proven; formally closed by the phase verifier

# Metrics
duration: ~35min
completed: 2026-07-10
---

# Phase 21 Plan 02: engine multi-tsConfig (ENG-01 tsConfig array) Summary

**Widened the engine's `tsConfig` to `string | string[]` additively -- an array runs each entry through the SAME single-tsConfig gather logic, UNIONs the raw per-entry diagnostics, and runs ONE `finalize` over the COMBINED declared input set (`handleMultiTsConfig`, the surviving-leaf tail of `handleSolutionWalk`) -- with the single-string path and the entire Nx executor path byte-unchanged, proven by a hermetic real-compiler fixture.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-10
- **Tasks:** 3 of 3 (autonomous; no checkpoints)
- **Files:** 11 (5 created, 6 modified)

## Accomplishments
- `tsConfig` now accepts an array at four additive seams: `schema.d.ts` (`string | string[]`), BOTH the executor and builder `schema.json` (`tsConfig` `oneOf` of a string and a non-empty `{type:array, items:string, minItems:1}`), `normalize-options.ts` (a `resolveOne` mapped over each entry), and `CoreOptions.tsConfigPath` (`string | string[]`).
- New core `handleMultiTsConfig`: for each explicit leaf entry it runs `readConfiguration` (+ per-entry infra-500 re-throw) -> `runNoEmitCompilation`, accumulates the RAW union (`parsed.errors` + `result.diagnostics`), the combined `rootNamePaths`, `rootNamesCount`, and the deduped `notTypeCheckedDeclaredFiles`, then runs `finalize` EXACTLY ONCE over the union with `buildFinalizeFilter(..., combinedRootNamePaths)` -- reusing the shipped union-then-single-finalize aggregation + the v0.2.0 input-set-membership boundary. No per-entry `runTypecheck`, no per-entry `finalize`.
- Never a silent pass (T-21-05): a zero-rootNames entry is recorded as a `zero-root-names` `SkippedReference` (so `evaluateResult` folds it into coverage-incomplete, mirroring the walk -- not the direct path's hard 90001); a per-entry `UNKNOWN_ERROR_CODE` (500) re-throws as `TypecheckInfrastructureError`; an empty array throws infra.
- Hermetic `fixtures/multi-tsconfig-array` (NEW): co-located `tsconfig.app.json` (`app.component.ts`, planted TS2322) + `tsconfig.spec.json` (`app.component.spec.ts`, which imports the component and carries a distinct planted TS2345). A real-compiler integration spec proves the array union surfaces BOTH codes and keeps both leaves' in-project files over the combined boundary, that `[appLeaf]` equals the single-string `appLeaf` (same codes + counts), and that the single-string path is unchanged.
- Single-string `runTypecheck` body byte-unchanged, executor.ts byte-unchanged. `nx build`, `nx test` (259 unit tests), and `nx run angular-typechecker:integration` (incl. the new 3-test spec) all green; `nx lint` green.

## Task Commits

Each task committed atomically; tasks 1-2 followed the plan's TDD flow (RED test -> GREEN impl):

1. **Task 1 (RED): assert tsConfig oneOf shape in executor schema parity** - `d3d6e42` (test)
2. **Task 1 (GREEN): widen tsConfig to oneOf string|array in both schemas** - `30382be` (feat)
3. **Task 2: handleMultiTsConfig union-then-single-finalize array path** (+ schema.d.ts + normalize-options, grouped for type-coherence) - `94beee6` (feat)
4. **Task 3: hermetic ENG-01 multi-tsconfig integration spec + fixture** - `76330dc` (test)

**Plan metadata:** (this SUMMARY + STATE.md + ROADMAP.md + deferred-items.md) -- committed with this doc.

## Verification Evidence
- `nx build angular-typechecker`: GREEN (the type gate for the widening + the array branch narrowing).
- `nx test angular-typechecker`: 259/259 unit tests GREEN (incl. the new schema-parity `oneOf` assertion; single-string behavior unchanged).
- `nx run angular-typechecker:integration`: GREEN -- the new `multi-tsconfig.integration.spec.ts` (3/3) plus all pre-existing integration specs.
  - array `[appLeaf, specLeaf]`: `diagnostics` codes contain BOTH TS2322 (app) and TS2345 (spec); both `app.component.ts` and `app.component.spec.ts` keep their diagnostics; `errorCount >= 2`.
  - `[appLeaf]` == `appLeaf`: identical sorted codes + `errorCount` + `warningCount`.
  - single-string `appLeaf`: TS2322 present, TS2345 absent (the spec leaf is not pulled in by the app leaf alone).
- `nx lint angular-typechecker`: GREEN (maxWarnings:0).
- `handleMultiTsConfig` reached via `Array.isArray(options.tsConfigPath)`; exactly ONE `finalize(` call inside it (run-typecheck.ts:682); the other four finalize calls (direct path + empty-project + the two walk calls) are pre-existing.

## Files Created/Modified
- `packages/angular-typechecker/src/core/run-typecheck.ts` - widened `CoreOptions.tsConfigPath`; added the `Array.isArray` branch + `handleMultiTsConfig`; minimal type-narrowing in `buildFinalizeFilter` (array->first-entry basePath fallback) + `handleSolutionWalk` (narrow `options.tsConfigPath` to a string once).
- `packages/angular-typechecker/src/executors/typecheck/schema.d.ts` - `tsConfig: string | string[]`.
- `packages/angular-typechecker/src/executors/typecheck/schema.json` - `tsConfig` `oneOf` string|array (cli/version/$id untouched).
- `packages/angular-typechecker/src/builders/typecheck/schema.json` - `tsConfig` `oneOf` string|array (sanitization untouched).
- `packages/angular-typechecker/src/executors/typecheck/normalize-options.ts` - `resolveOne` mapped over array entries; `coreOptions.tsConfigPath` carries `string | string[]`.
- `packages/angular-typechecker/src/executors/typecheck/schema-parity.spec.ts` - new `oneOf` assertion; widened the `SchemaProperty` shape to read `oneOf`.
- `fixtures/multi-tsconfig-array/{app.component.ts, app.component.spec.ts, tsconfig.app.json, tsconfig.spec.json}` - NEW hermetic co-located leaves with a planted diagnostic in each.
- `packages/angular-typechecker/src/core/multi-tsconfig.integration.spec.ts` - real-compiler ENG-01 proof.

## Decisions Made
- **Mutable `string | string[]`, not `readonly string[]`.** The plan's interface text said `string | readonly string[]`, but `Array.isArray()` narrows a `readonly`-array union ONLY in the true branch -- a `readonly` member left the byte-unchanged single-string `runTypecheck` body typed as the union (TS2345 at four reads). A mutable `string[]` narrows cleanly in BOTH branches, so the `Array.isArray(options.tsConfigPath)` guard (an explicit acceptance criterion) AND the byte-unchanged single-string body (a stated success criterion) both hold. All real callers (normalize-options `.map`, array literals) pass mutable arrays. (See Deviations.)
- **Zero-rootNames entry -> `SkippedReference('zero-root-names')`.** The plan's extracted `<interfaces>` omitted `skippedReferences` from the accumulation, but task 2's behavior REQUIRES a zero-rootNames entry to "feed the coverage-incomplete signal", and `evaluateResult`'s ONLY zero-root-names channel is `result.skippedReferences.some(r => r.reason === 'zero-root-names')`. So `handleMultiTsConfig` records it and attaches it via `presentIfNonEmpty` (exactly as `handleSolutionWalk` does). (See Deviations.)
- **First entry is the representative `tsConfigPath`.** For the co-located `[buildLeaf, specLeaf]` target case (Phase 22 wiring), the first entry's basePath governs the boundary filter's node_modules/out-of-project fallback (input-set membership is the primary boundary). `CoreResult.tsConfigPath` = the first entry, so `['x']` yields `tsConfigPath === 'x'`.

## Deviations from Plan

### Auto-fixed / adjustments (Rules 2-3)

**1. [Rule 3 - Blocking type coupling] `readonly string[]` -> mutable `string[]` for the widened union.**
- **Found during:** Task 2 (`nx build`).
- **Issue:** `Array.isArray()` does not narrow a `string | readonly string[]` union's FALSE branch to `string`, so the byte-unchanged single-string `runTypecheck` body failed to type-check (TS2345 at lines reading `options.tsConfigPath`).
- **Fix:** widened to MUTABLE `string | string[]` (both `CoreOptions.tsConfigPath` and `TypecheckExecutorOptions.tsConfig`), which `Array.isArray` narrows in both branches. Behavioral intent ("accepts an array") + the `Array.isArray` guard + the byte-unchanged body are all preserved. Documented inline in the `CoreOptions` doc-comment.
- **Files:** `run-typecheck.ts`, `schema.d.ts`. **Commit:** `94beee6`.

**2. [Rule 2 - Correctness / T-21-05] zero-rootNames entry recorded as a `SkippedReference`.**
- **Found during:** Task 2.
- **Issue:** task 2 behavior requires a zero-rootNames array entry to feed coverage-incomplete; the plan's extracted interface did not list the channel. `evaluateResult` reads it ONLY from `result.skippedReferences` (`reason: 'zero-root-names'`).
- **Fix:** `handleMultiTsConfig` records a `zero-root-names` `SkippedReference` per empty-input entry and attaches `skippedReferences` via `presentIfNonEmpty` (mirroring `handleSolutionWalk`), so an empty leaf is coverage-incomplete, never a silent pass. Also added an empty-array guard that throws `TypecheckInfrastructureError`.
- **Files:** `run-typecheck.ts`. **Commit:** `94beee6`.

**3. [Rule 3 - Commit grouping for green builds] `schema.d.ts` + `normalize-options.ts` committed WITH the run-typecheck engine (task-2 commit) rather than a standalone task-1 commit.**
- **Found during:** Tasks 1-2.
- **Issue:** the `test` target `dependsOn: build`, and widening `TypecheckExecutorOptions.tsConfig` / producing an array from `normalize-options` is type-inseparable from widening `CoreOptions.tsConfigPath` + the array branch. A separate task-1 commit that widened `schema.d.ts`/`normalize-options` alone would fail `nx build`/`nx test`.
- **Fix:** grouped the three type-coupled files into the task-2 commit (`94beee6`); task 1's commits are the schema-parity RED (`d3d6e42`) + the two `schema.json` `oneOf` widenings (`30382be`). Every commit's `nx build` + `nx test` stays green.
- **Files:** commit boundary only (no code change vs plan intent).

### Minimal type-narrowing in shared helpers (forced by the widening; behavior byte-unchanged)
- `buildFinalizeFilter` coerces an array `tsConfigPath` to its first entry for the basePath FALLBACK only (byte-identical for the string callers).
- `handleSolutionWalk` narrows `options.tsConfigPath` to a `string` once at its top (it is reached only from the single-string path). Both are proven behavior-unchanged by the full pre-existing suite staying green.

## Out-of-scope discovery
- `.claude/skills/spike-findings-angular-typechecker/SKILL.md` fails `nx format:check` -- PRE-EXISTING Prettier drift on this branch from the external skill regeneration/reload (not touched by any 21-02 commit; unrelated to ENG-01). Logged to `deferred-items.md`, NOT fixed (SCOPE BOUNDARY). All 21-02-owned files are Prettier-clean.

## Issues Encountered
- The `readonly`-array `Array.isArray` narrowing gap (Deviation 1) was caught by `nx build` on the first engine build and resolved by switching to a mutable union. No other issues.

## User Setup Required
None.

## Next Phase Readiness
- ENG-01 is delivered + integration-proven. Plan 21-03 (builder schema-parity + thin-wrapper structural parity + the `executors ?? builders` Nx-surface regression) can proceed. Phase 22's `configuration` write-fork can now wire `tsConfig: [buildLeaf, specLeaf]` against this engine.

## Self-Check: PASSED

All 5 created files exist on disk (the 4 `fixtures/multi-tsconfig-array` files + the integration spec). All 4 task commits (`d3d6e42`, `30382be`, `94beee6`, `76330dc`) exist in the git log. `handleMultiTsConfig` is present in `run-typecheck.ts`, reached via `Array.isArray(options.tsConfigPath)`, with exactly ONE `finalize(` call inside it (line 682).

---
*Phase: 21-angular-cli-builder-engine-multi-tsconfig-gate-a-spike-go-no*
*Completed: 2026-07-10*
