---
phase: 10-drift-hardening-maintainability
verified: 2026-06-30T00:55:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 10: Drift-hardening & Maintainability Verification Report

**Phase Goal:** An Angular upgrade that changes the `api.Program` getter set, the `EmitFlags` enum, or the NG error-code encoding breaks `nx`/CI LOUDLY (a build failure) instead of silently under-gathering -- and every vendored-shim divergence is documented and greppable.
**Verified:** 2026-06-30T00:55:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth (Success Criterion) | Status | Evidence |
| --- | ------------------------- | ------ | -------- |
| SC1 | HARD-01: `tsconfig.drift.json` (classic `moduleResolution: node`) type-checked in CI as `typecheck-drift`; FAILS the build when the real `api.Program` stops being assignable TO the vendored shim (removed/renamed/sig-changed getter) or when `UNKNOWN_ERROR_CODE` changes; runtime spec covers the additions blind-spot + NG encoding round-trip + UNKNOWN_ERROR_CODE===500 | VERIFIED | Build-time half PASSES (exit 0) against corrected shim; **negative drift proof TRIPPED twice** (getter rename -> TS2339; signature/return change -> TS2344; both exit 1). Runtime spec `compiler-cli-types.runtime.spec.ts` (3 tests) green: subset-containment, additions-diff `toEqual([])`, `NG(n)===cli.ngErrorCode(n)` + `cli.UNKNOWN_ERROR_CODE===500`. |
| SC2 | HARD-02: fabricated `EmitFlags.None = 0` corrected to mirror real members (DTS=1..All=31); `emitFlags: 0 as EmitFlags` cast retained | VERIFIED | `compiler-cli-types.ts:109-117` has DTS=1,JS=2,Metadata=4,I18nBundle=8,Codegen=16,Default=19,All=31; NO `None` member (only a comment notes its removal). Cast retained at `run-typecheck.ts:229` (`emitFlags: 0 as EmitFlags`). Value-level pins in drift file assert each member. |
| SC3 | HARD-03: every divergence carries a greppable `// angular-typechecker: vendored -- <reason>` marker (single grep finds all; expect >= 6) | VERIFIED | `git grep -c "angular-typechecker: vendored" compiler-cli-types.ts` = **6** (>= 6 met): TsProgram, Program (subset), EmitFlags, UNKNOWN_ERROR_CODE, ParsedConfiguration, PerformCompilationResult. A 7th marker exists in `diagnostic-codes.ts:56` (IMPORT_GENERATION_FAILURE_CODE) -- same single-grep idiom. |
| SC4 | HARD-04: `getNgStructuralDiagnostics()` retained + documented forward-compatible AND covered by the drift assertion + runtime spec | VERIFIED | Call retained at `gather-diagnostics.ts:74` with HARD-04/D-10 documenting comment (lines 66-73). Build-time drift probe asserts it (`compiler-cli-types.drift.ts:76-79`) + call-site probe (`:115`). Runtime spec includes it in `GATHERED_GETTERS` (`:56`) covered by tests (a) and (b). |
| SC5 | HARD-05: regression spec asserts no `TS-99` substring survives the `color: false` output path, using the REAL `cli.formatDiagnostics` | VERIFIED | `ts99-leak.integration.spec.ts` (1 test) green: real NG8101 producer fixture -> `renderReport(..., { color: false })`; asserts `out` matches `/NG\d{4}/` AND `not.toContain('TS-99')`. `renderReport` (`render-report.ts:65`) loads the REAL `@angular/compiler-cli` via `loadCompilerCli()` -> `formatReport` -- NOT a fake. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/core/compiler-cli-types.ts` | Corrected shim (EmitFlags fix, vendor markers, retained getter type) | VERIFIED | EmitFlags DTS=1..All=31 no None; 6 vendor markers; `getNgStructuralDiagnostics` in Program interface. |
| `src/core/compiler-cli-types.drift.ts` | Build-time real->shim probes + getTsProgram special-case + call-site probes + value pins | VERIFIED | 6 diagnostic-getter `AssertAssignable` probes; `GetTsProgramProbe` ReturnType special-case; 8 call-site probes incl. getGlobalDiagnostics reach-through; UNKNOWN_ERROR_CODE + 7 EmitFlags member pins. |
| `src/core/compiler-cli-types.runtime.spec.ts` | Subset-containment + additions diff + NG encoding round-trip vs real namespace | VERIFIED | 3 `it` blocks (a/b/c); uses `await import('@angular/compiler-cli')`; SUBSET containment (not equality); `added.toEqual([])`; encoding round-trip + UNKNOWN_ERROR_CODE===500. |
| `src/core/ts99-leak.integration.spec.ts` | TS-99 leak regression via real cli.formatDiagnostics, color:false | VERIFIED | Routes through `renderReport` (real cli); NG#### present, `TS-99` absent. |
| `tsconfig.drift.json` | classic moduleResolution: node, noEmit, drift file only | VERIFIED | `moduleResolution: node`, `module: commonjs`, `noEmit: true`, `ignoreDeprecations: "6.0"`, `files: [src/core/compiler-cli-types.drift.ts]`. |
| `tsconfig.lib.json` | excludes *.drift.ts | VERIFIED | `exclude` line 18: `src/**/*.drift.ts`. |
| `tsconfig.spec.json` | excludes *.drift.ts | VERIFIED | `exclude` line 29: `src/**/*.drift.ts`. |
| `project.json` | typecheck-drift Nx target | VERIFIED | `typecheck-drift` (nx:run-commands -> `tsc --noEmit -p tsconfig.drift.json`), cached on compiler-cli typings inputs. |
| `.github/workflows/ci.yml` | typecheck-drift wired into CI | VERIFIED | Line 114: `npx nx run-many -t typecheck-drift test -p angular-typechecker` (fixed target ids, no PR-metadata interpolation). |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `gather-diagnostics.ts` | `compiler-cli-types.ts` Program shim | `import type { Program }` + 6 getter calls | WIRED | All 6 getters + getTsProgram().getGlobalDiagnostics() called; getter set mirrors drift probe + runtime GATHERED_GETTERS. |
| `compiler-cli-types.drift.ts` | real `@angular/compiler-cli` + shim | `import { Program as RealProgram }` / `import { Program as ShimProgram }` | WIRED | Real->shim AssertAssignable probes; compiles only under classic-node drift tsconfig. |
| `typecheck-drift` target | `tsconfig.drift.json` | `tsc --noEmit -p` | WIRED | Runs and exits 0 on corrected shim; exits 1 on perturbation. |
| `ci.yml` | `typecheck-drift` target | `nx run-many -t typecheck-drift test` | WIRED | Drift gate runs per matrix cell, Nx-cached. |
| `ts99-leak.integration.spec.ts` | real `cli.formatDiagnostics` | `renderReport` -> `loadCompilerCli` -> `formatReport` | WIRED | No fake formatter; real rewrite path exercised. |
| `run-typecheck.ts:229` | `EmitFlags` shim | `emitFlags: 0 as EmitFlags` | WIRED | Cast retained; build-green (drift guard). |

### Behavioral Spot-Checks (gates RUN, not narrated)

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| SC1 build-time half passes on corrected shim | `nx run angular-typechecker:typecheck-drift --skip-nx-cache` | exit 0, "Successfully ran target typecheck-drift" | PASS |
| **SC1 negative proof #1 (getter rename)** | perturb shim `getTsSemanticDiagnostics`->`...RENAMED`, re-run typecheck-drift | **exit 1, TS2339 "Property 'getTsSemanticDiagnostics' does not exist on type 'Program'" at drift.ts:72** | PASS (tripwire trips) |
| **SC1 negative proof #2 (signature/return change)** | perturb shim `getNgSemanticDiagnostics` to required params + `: boolean` return, re-run | **exit 1, TS2344 "Type ... does not satisfy the constraint ... 'boolean' is not assignable to 'readonly Diagnostic[]'" at drift.ts:82** | PASS (tripwire trips) |
| Restore + re-confirm clean | `git checkout -- compiler-cli-types.ts`; re-run typecheck-drift | exit 0, working tree clean (HEAD bef741e, no diff, no stash) | PASS |
| Full suite incl. runtime + TS-99 specs | `nx run angular-typechecker:test --skip-nx-cache` (NX_DAEMON=false) | **26 test files, 147 tests passed** | PASS |
| Runtime drift spec ran | filtered output | `compiler-cli-types.runtime.spec.ts (3 tests)` green | PASS |
| TS-99 spec ran | filtered output | `renders an NG#### label and NO TS-99 substring on the color:false path` green | PASS |
| SC3 marker count | `git grep -c "angular-typechecker: vendored" -- compiler-cli-types.ts` | 6 | PASS (>= 6) |
| SC2 cast | `git grep -n "0 as EmitFlags" -- run-typecheck.ts` | `:229: emitFlags: 0 as EmitFlags,` | PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` declared for this phase; the phase's runnable verification is the `typecheck-drift` Nx target + the Vitest suite, both executed above. Not applicable.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| HARD-01 | 10-02 (build) + 10-03 (runtime) | Build-time drift tsconfig + CI target; real->shim assignability; NG encoding mirrored | SATISFIED | typecheck-drift passes + trips on drift; runtime spec round-trip green. Note: REQUIREMENTS.md traceability table still lists HARD-01 as "Pending" (doc lag -- implementation fully verified). |
| HARD-02 | 10-01 / 10-02 | EmitFlags corrected; `emitFlags: 0` cast retained | SATISFIED | Enum DTS=1..All=31 no None; cast at run-typecheck.ts:229; value pins in drift file. |
| HARD-03 | 10-01 | Greppable vendor markers | SATISFIED | 6 markers single-grep discoverable. |
| HARD-04 | 10-01 / 10-02 / 10-03 | getNgStructuralDiagnostics retained + asserted | SATISFIED | Retained at gather-diagnostics.ts:74; in drift probe + runtime GATHERED_GETTERS. |
| HARD-05 | 10-04 | TS-99 leak regression via real formatDiagnostics | SATISFIED | ts99-leak.integration.spec.ts green via real cli seam. Note: REQUIREMENTS.md table still lists HARD-05 as "Pending" (doc lag). |

No orphaned requirements: REQUIREMENTS.md maps exactly HARD-01..05 to Phase 10; all 5 claimed by plans and verified.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | - | No TODO/FIXME/XXX/HACK/TBD/PLACEHOLDER debt markers in any Phase 10 source file | - | Clean |

### Human Verification Required

None. All success criteria are programmatically verifiable and were verified by running the gates (including the negative drift proof). The CI wiring is statically confirmed; the runtime behavior of the drift tripwire and both regression specs was executed locally and passed.

### Gaps Summary

No gaps. All 5 success criteria MET with executed-gate evidence. The drift tripwire was proven to actually trip: two distinct perturbations (a renamed getter and a signature/return-type change) both caused `typecheck-drift` to fail with non-zero exit and precise TS errors at the exact probe slots, and the shim was restored exactly afterward (clean tree, same HEAD). The full Vitest suite (147 tests) is green including the runtime getter-set/encoding spec and the TS-99 leak spec.

Minor non-blocking observation (NOT a gap against the phase goal): `.planning/REQUIREMENTS.md` traceability table (lines 72, 76) still marks HARD-01 and HARD-05 as "Pending" while their implementations are complete and verified. This is documentation lag in the planning artifact, not a code deliverable gap -- the phase goal and all SCs are achieved in the codebase. The milestone audit can flip those two rows to Complete.

---

_Verified: 2026-06-30T00:55:00Z_
_Verifier: Claude (gsd-verifier)_
