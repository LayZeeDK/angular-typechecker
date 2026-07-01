---
phase: 10-drift-hardening-maintainability
plan: 01
subsystem: core (vendored compiler-cli shim + gatherer)
tags: [HARD-02, HARD-03, HARD-04, shim, vendored-types, drift-hardening]
requires:
  - 'compiler-cli-types.ts vendored shim (v0.0.1/Phase 5 self-contained re-declaration)'
  - 'gather-diagnostics.ts all-getter gatherer (Phase 9 RES-02 HYBRID shape)'
  - 'diagnostic-codes.ts:56 existing vendor-marker idiom'
provides:
  - 'Corrected EmitFlags enum mirroring the real @angular/compiler-cli@22.0.4 members (DTS=1..All=31, no fabricated zero-valued member)'
  - '6 greppable `angular-typechecker: vendored` markers enumerating every divergent shim construct'
  - 'Retained getNgStructuralDiagnostics() with a HARD-04/D-10 forward-compatible documenting comment'
affects:
  - 'Plan 02 (drift tripwire) -- asserts EmitFlags member values against the corrected enum'
  - 'Plan 03 (runtime getter-set spec) -- covers the retained getNgStructuralDiagnostics getter'
tech-stack:
  added: []
  patterns:
    - 'Vendored-from-real marker idiom (// angular-typechecker: vendored -- <reason>) replicated across all divergent constructs'
    - 'Ambient `declare enum` mirroring real numeric members; the load-bearing `0 as EmitFlags` cast at the call site stays untouched'
key-files:
  created: []
  modified:
    - 'packages/angular-typechecker/src/core/compiler-cli-types.ts'
    - 'packages/angular-typechecker/src/core/gather-diagnostics.ts'
decisions:
  - 'HARD-02: mirror the real EmitFlags members verbatim (DTS=1, JS=2, Metadata=4, I18nBundle=8, Codegen=16, Default=19, All=31); drop the fabricated zero-valued member; leave the `0 as EmitFlags` cast at run-typecheck.ts:229 untouched (the cast is load-bearing -- bare `: EmitFlags = 0` errors TS2322)'
  - "HARD-03: one greppable vendor marker per divergent construct (6 total), co-located inside each construct's existing doc comment so a single git grep enumerates every divergence; rich WHY-comments preserved"
  - "HARD-04: reverse the earlier 'consider dropping' stance into a documented, asserted retention of getNgStructuralDiagnostics() (D-10), referencing the HARD-01 drift probe, the runtime getter-set spec, and the existing call-order assertion as the gates that keep it from silently under-gathering"
  - 'Reworded the EmitFlags rationale comment to avoid the literal `None = 0` token so the HARD-02 acceptance grep (`git grep -c "None = 0"` == 0) stays clean while still documenting the removal'
metrics:
  duration: ~3 min
  completed: 2026-06-29
  tasks: 3
  files: 2
---

# Phase 10 Plan 01: Shim Corrections Summary

Corrected the vendored `compiler-cli-types.ts` shim so its `EmitFlags` enum mirrors the real `@angular/compiler-cli@22.0.4` members verbatim (dropping the fabricated zero-valued member), added a greppable `angular-typechecker: vendored` marker to all 6 divergent shim constructs, and documented the deliberately retained `getNgStructuralDiagnostics()` gatherer call as forward-compatible and no-op-tolerant -- all without changing any runtime behavior (the shim is type-only/erased at emit; the gatherer edit is a comment).

## What Was Built

### Task 1: Correct the shim EmitFlags enum (HARD-02) -- commit e5e63c3

Replaced `export declare enum EmitFlags { None = 0 }` with the real 7-member enum mirrored verbatim from `@angular/compiler-cli@22.0.4` (`src/transformers/api.d.ts:74-82`): `DTS=1, JS=2, Metadata=4, I18nBundle=8, Codegen=16, Default=19, All=31`. The fabricated `None` member is gone. The ambient-enum rationale comment was lightly updated to note the members now mirror the real enum and that the load-bearing `0 as EmitFlags` cast (run-typecheck.ts:229) is what keeps the literal `0` acceptable (a bare `: EmitFlags = 0` errors TS2322 at tsc 6.0.3). `run-typecheck.ts:229` was NOT touched -- the cast is unchanged.

### Task 2: Add greppable vendor markers (HARD-03) -- commit b80435f

Added one `// angular-typechecker: vendored -- <reason>` marker line (the `diagnostic-codes.ts:56` idiom) inside the existing doc comment of each of the 6 divergent constructs:

| #   | Construct                          | Marker line                                                                                     |
| --- | ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | `TsProgram` intersection           | :45 -- adds synthetic `useCaseSensitiveFileNames()` not on the public `ts.Program`              |
| 2   | `Program` subset interface         | :61 -- deliberate SUBSET of the real `api.Program` (only the called getters + `getTsProgram()`) |
| 3   | `EmitFlags` enum                   | :104 -- mirrors the real members; only what `performCompilation` accepts as `emitFlags`         |
| 4   | `UNKNOWN_ERROR_CODE` literal       | :126 -- hand-declared `= 500` instead of importing the ESM-only real const                      |
| 5   | `ParsedConfiguration` subset       | :139 -- subset of the real; `options` widens to add `{ basePath?: string }`                     |
| 6   | `PerformCompilationResult.program` | :177 -- narrows the real OPTIONAL `program?` to NON-optional to match guarded usage             |

The existing rich WHY-comments were preserved. A single `git grep "angular-typechecker: vendored" -- packages/angular-typechecker/src/core/compiler-cli-types.ts` now enumerates all 6.

### Task 3: Document retained getNgStructuralDiagnostics() (HARD-04) -- commit 4c01003

Added a comment-only `HARD-04 / D-10` block immediately above the `getNgStructuralDiagnostics()` call in `gather-diagnostics.ts` (now at :74) marking it as deliberately retained, forward-compatible, and no-op-tolerant: it returns `[]` in practice at Angular 22.0.4 but the getter exists, so a future Angular that reactivates it cannot silently under-gather. The comment references the asserting gates (the HARD-01 per-member drift probe in Plan 02, the runtime getter-set spec in Plan 03, and the existing call-order assertion in `gather-diagnostics.spec.ts`). No code lines changed beyond the added comment.

## Verification

- `npx nx build angular-typechecker` -- GREEN (the corrected enum + the load-bearing `0 as EmitFlags` cast type-check; the build is the existing drift guard). Confirmed both on first run after Task 1 and as a cache hit at plan end.
- `npx nx run angular-typechecker:test -t "gatherAllDiagnostics"` -- GREEN (143 tests passed; the existing call-order assertion that `getNgStructuralDiagnostics` is invoked in order is unchanged and green).
- `git grep -c "angular-typechecker: vendored" -- packages/angular-typechecker/src/core/compiler-cli-types.ts` -- returns `6` (>= 6 satisfied).
- `git grep -c "None = 0" -- packages/angular-typechecker/src/core/compiler-cli-types.ts` -- returns `0` (the fabricated zero-valued member token is gone, including from comments).
- `git grep -c "0 as EmitFlags" -- packages/angular-typechecker/src/core/run-typecheck.ts` -- returns `1` (the load-bearing cast is untouched).
- ASCII-only scan (`rg '[^\x00-\x7F]'`) on both edited files -- CLEAN, no non-ASCII introduced (markers use plain `--`, not an en/em dash).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reworded the EmitFlags rationale comment to keep the HARD-02 acceptance grep clean**

- **Found during:** Task 1
- **Issue:** My first revision of the ambient-enum rationale comment included the literal phrase "the earlier fabricated `None = 0` is removed". That comment text contains the literal token `None = 0`, which made the Task 1 acceptance check `git grep -c "None = 0" ... returns 0` fail (it returned 1, matching the comment) even though the fabricated enum member itself was correctly removed.
- **Fix:** Reworded the comment to "the earlier fabricated zero-valued member is removed" -- documenting the removal without re-introducing the literal token the acceptance grep keys on. Re-verified the grep returns 0.
- **Files modified:** packages/angular-typechecker/src/core/compiler-cli-types.ts
- **Commit:** e5e63c3 (folded into the Task 1 commit; the reword happened before commit)

No other deviations -- the rest of the plan executed exactly as written.

## Authentication Gates

None -- this plan performs only local source edits, builds, and tests; no auth-requiring commands were run.

## Known Stubs

None. The `getNgStructuralDiagnostics()` call returning `[]` in practice at Angular 22.0.4 is NOT a stub -- it is a deliberately retained, documented forward-compatible getter (HARD-04 / D-10); the gather/build/test gates assert its presence so a future Angular reactivation is caught.

## Notes for Downstream Plans

- **Plan 02 (HARD-01 drift tripwire):** the value-level `EmitFlags` member assertions in the drift file must pin against the corrected members (DTS=1, JS=2, Metadata=4, I18nBundle=8, Codegen=16, Default=19, All=31) -- the fabricated zero-valued member no longer exists to assert against.
- **Plan 02/03:** `getNgStructuralDiagnostics` is in the asserted gathered-getter set (the HARD-04 comment explicitly names the HARD-01 per-member probe and the runtime getter-set spec as the gates) -- those plans must keep it in their frozen getter set.
- The `emitFlags: 0 as EmitFlags` cast at `run-typecheck.ts:229` is load-bearing and intentionally unchanged; do not "simplify" it to a bare `0`.

## Self-Check: PASSED

- SUMMARY.md created -- FOUND
- packages/angular-typechecker/src/core/compiler-cli-types.ts -- FOUND
- packages/angular-typechecker/src/core/gather-diagnostics.ts -- FOUND
- Commit e5e63c3 (Task 1, EmitFlags) -- FOUND
- Commit b80435f (Task 2, vendor markers) -- FOUND
- Commit 4c01003 (Task 3, getNgStructuralDiagnostics comment) -- FOUND
