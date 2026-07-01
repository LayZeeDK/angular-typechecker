---
phase: 09-resilience-per-file-fault-isolation-boundary-robustness
plan: 04
subsystem: core
tags: [angular, compiler-cli, readConfiguration, suppressOutputPathCheck, resilience, typescript, noEmit]

# Dependency graph
requires:
  - phase: 02-engine-core
    provides: 'runTypecheck readConfiguration + emit-neutralizing override (noEmit:true) that already gates the output-path check'
  - phase: 08-correctness-completeness-fixes
    provides: 'COR-01 config-resolution 500-scan + parsed.errors fold + infra-vs-type policy (D-05/D-06) that RES-04 must NOT blur'
provides:
  - 'readConfiguration now called with { suppressOutputPathCheck: true } as the existingOptions second arg (run-typecheck.ts), matching @angular/build exactly'
  - 'Deterministic readConfiguration-spy unit proving the second-arg placement (infra-failure.spec.ts)'
  - 'Real-compiler no-nuisance integration assertion: no TS5055/overwrite-class diagnostic surfaces in the no-emit type-only flow (suppress-output-path.integration.spec.ts)'
affects: [resilience, engine-hardening, release]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Belt-and-suspenders parity with @angular/build: pass suppressOutputPathCheck to readConfiguration even though noEmit:true already gates the check'
    - 'Deterministic placement spy + real-compiler absence-under-suppression assertion (RESEARCH Open Q1 Option a) instead of a fragile noEmit-unset probe'

key-files:
  created:
    - packages/angular-typechecker/src/core/suppress-output-path.integration.spec.ts
  modified:
    - packages/angular-typechecker/src/core/run-typecheck.ts
    - packages/angular-typechecker/src/core/infra-failure.spec.ts

key-decisions:
  - 'Reused the composite-triangle fixture (composite/declarationMap/emitDeclarationOnly collision shape) for the no-nuisance assertion; no new fixture created.'
  - 'Chose deterministic Option a (spy + absence assertion) over probe Option b (temporarily unset noEmit); the shipped spec never clears noEmit.'

patterns-established:
  - 'RES-04 placement: readConfiguration(tsConfigPath, { suppressOutputPathCheck: true }) as the existingOptions second arg, no shim change (ts.CompilerOptions index signature).'

requirements-completed: [RES-04]

# Metrics
duration: ~12min
completed: 2026-06-29
---

# Phase 9 Plan 04: suppressOutputPathCheck in the no-emit flow Summary

**runTypecheck now passes `{ suppressOutputPathCheck: true }` as the `existingOptions` second arg to `ng.readConfiguration` (matching @angular/build v22.0.4 exactly), so an output-path config nuisance (TS5055/overwrite-class) never surfaces as a type error -- proven by a deterministic readConfiguration spy and a real-compiler no-nuisance assertion.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-29T18:21:00Z (approx)
- **Completed:** 2026-06-29T18:33:00Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `run-typecheck.ts:105` now calls `ng.readConfiguration(options.tsConfigPath, { suppressOutputPathCheck: true })`, the exact `@angular/build` `loadConfiguration` parity (`angular-compilation.ts:51` @ v22.0.4). Mitigates threat T-09-03.
- The Phase 8 infra-vs-type policy is preserved: the COR-01 500-scan and the `configDiagnostics = [...parsed.errors]` fold immediately after are byte-unchanged (T-09-04 / D-05).
- Deterministic readConfiguration-spy unit added to `infra-failure.spec.ts` (the established `vi.mock('./compiler-loader')` + `vi.hoisted` + `fakeProgram()` idiom), asserting the second arg via `toHaveBeenCalledWith('/virtual/tsconfig.json', { suppressOutputPathCheck: true })`.
- Real-compiler no-nuisance integration spec created (`suppress-output-path.integration.spec.ts`): runs `runTypecheck` against the `composite-triangle` fixture and asserts `result.diagnostics` codes do NOT contain TS5055 (raw) -- the SC4 safe-under-noEmit evidence.
- No shim change (the `readConfiguration(project, existingOptions?)` overload already existed at `compiler-cli-types.ts:155-158`); the build drift guard confirms the extra key type-checks via the `ts.CompilerOptions` index signature.

## Task Commits

Each task was committed atomically:

1. **Task 1: Pass suppressOutputPathCheck + deterministic spy unit (TDD: RED test then GREEN impl, one commit)** - `5e2af6e` (feat)
2. **Task 2: Real-compiler no-nuisance integration assertion** - `b4f0319` (test)

_Note: Task 1 is the `tdd="true"` task; the RED (spy test) and GREEN (run-typecheck.ts change) were verified in sequence (the spy failed pre-change, passed post-change) and committed together as the plan combined them into one task._

## Files Created/Modified

- `packages/angular-typechecker/src/core/run-typecheck.ts` - Added the `{ suppressOutputPathCheck: true }` second arg to the `readConfiguration` call at the existing seam (line ~105), with a comment citing the @angular/build parity and the Pitfall-3 resolution. COR-01 scan + parsed.errors fold untouched.
- `packages/angular-typechecker/src/core/infra-failure.spec.ts` - Added the RES-04 deterministic spy test; the first `describe` block's `beforeEach` now also `mockReset()`s `readConfiguration` (then restores the default return value) so the spy assertion sees only its own call.
- `packages/angular-typechecker/src/core/suppress-output-path.integration.spec.ts` - NEW. Real-compiler `runTypecheck`-against-composite-triangle assertion that no TS5055/output-path overwrite-class code surfaces in the no-emit type-only flow.

## Decisions Made

- **Reused composite-triangle, no new fixture.** The plan permits a new fixture only if `composite-triangle` provably cannot exercise the assertion. composite-triangle carries the emit-option-collision shape (composite:true + declarationMap:true + emitDeclarationOnly:true), so it is the natural base; the assertion (`codes.not.toContain(5055)`) passes against it.
- **Deterministic Option a, not probe Option b.** The shipped integration spec never temporarily unsets `noEmit`. Per RESEARCH A3, `noEmit:true` is the primary suppressor and `suppressOutputPathCheck` is the parity belt; the deterministic spy proves the placement and the integration spec proves the absence-under-suppression behavior. This is the planner's recommended (deterministic) choice.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The node_modules junction creation via `cmd //c mklink /J` (and `MSYS_NO_PATHCONV=1 cmd /c mklink`) produced a malformed target with a leading backslash that did not resolve. Recreated the junction with PowerShell `New-Item -ItemType Junction`, which resolved correctly (verified `node_modules/@angular/compiler-cli` and `node_modules/typescript` exist). This is environment provisioning, not plan work.

## Note on output-path nuisance reproducibility

Consistent with RESEARCH Pitfall 3 / Open Q1: the output-path overwrite check lives in TypeScript's `verifyCompilerOptions()` at the end of `createProgram`, gated by `!options.noEmit && !options.suppressOutputPathCheck`. Because the engine's emit-neutralizing override already sets `noEmit:true`, the TS5055 nuisance is inert in this flow regardless of `suppressOutputPathCheck`. The integration assertion is therefore an absence-under-suppression proof (the SC4 "verified safe under noEmit:true" evidence); the deterministic placement proof is the spy in `infra-failure.spec.ts`. `composite-triangle` exercises the emit-option-collision shape but, as expected, produces no TS5055 in the no-emit flow.

## Acceptance gate evidence

- `npx nx test angular-typechecker -- infra-failure.spec.ts` -> exit 0 (RES-04 spy + retained infra-failure + COR-01 cases; all green).
- `npx nx test angular-typechecker -- suppress-output-path.integration.spec.ts` -> exit 0 (1 test, no TS5055 surfaces).
- `npx nx test angular-typechecker` (full suite) -> 24 test files, 127 tests, 0 failures.
- `npx nx build angular-typechecker` -> exit 0 (drift guard; the extra key type-checks via the index signature, no shim change).

## Next Phase Readiness

- RES-04 / SC4 satisfied. The output-path nuisance is suppressed defensively with @angular/build parity, the Phase 8 infra-vs-type policy intact.
- No package added, no shim change, no fixture added. Ready for the wave merge and the phase's remaining plans / verification.

## Self-Check: PASSED

All created/modified files exist and both task commits are in the log:

- FOUND: packages/angular-typechecker/src/core/run-typecheck.ts
- FOUND: packages/angular-typechecker/src/core/infra-failure.spec.ts
- FOUND: packages/angular-typechecker/src/core/suppress-output-path.integration.spec.ts
- FOUND: .planning/phases/09-resilience-per-file-fault-isolation-boundary-robustness/09-04-SUMMARY.md
- FOUND commit: 5e2af6e (Task 1, feat)
- FOUND commit: b4f0319 (Task 2, test)

---

_Phase: 09-resilience-per-file-fault-isolation-boundary-robustness_
_Completed: 2026-06-29_
