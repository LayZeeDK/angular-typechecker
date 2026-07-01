---
phase: 10
slug: drift-hardening-maintainability
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-29
validated: 2026-06-30
---

# Phase 10 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Requirement-level map below (task IDs are filled in post-planning by
> `/gsd-validate-phase`). Source: `10-RESEARCH.md` Validation Architecture.

---

## Test Infrastructure

| Property               | Value                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------- |
| **Framework**          | Vitest 4.x via `@nx/vitest:test`                                                   |
| **Config file**        | `packages/angular-typechecker/vite.config.ts` (existing)                           |
| **Quick run command**  | `npx nx run angular-typechecker:test` (filter `-t <name>`)                         |
| **Full suite command** | `npx nx run-many -t test -p angular-typechecker`                                   |
| **Drift gate command** | `npx nx run angular-typechecker:typecheck-drift` (NEW; build-time tsc, not Vitest) |
| **Estimated runtime**  | ~30-60s unit/integration; drift gate ~2-5s (cached)                                |

---

## Sampling Rate

- **After every task commit:** Run the touched spec(s) + `typecheck-drift` (fast + cached).
- **After every plan wave:** Run `npx nx run-many -t typecheck-drift test -p angular-typechecker`.
- **Before `/gsd:verify-work`:** Full suite + `typecheck-drift` green; `git grep -c "angular-typechecker: vendored" -- packages/angular-typechecker/src/core/compiler-cli-types.ts` returns >= 6.
- **Max feedback latency:** ~60 seconds.

---

## Per-Requirement Verification Map

(Task IDs assigned during planning; this is the requirement-level contract.)

| Req ID                         | Behavior                                                                                                       | Test Type                                                                                              | Automated Command                                                                                                          | File / Status                                                                                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HARD-01                        | Removed/renamed/sig-changed getter or changed `UNKNOWN_ERROR_CODE`/`EmitFlags` breaks the build (exit != 0)    | build-time tsc                                                                                         | `npx nx run angular-typechecker:typecheck-drift`                                                                           | `compiler-cli-types.drift.ts` + `tsconfig.drift.json` -- **green** (exit 0 on corrected shim; negative drift proof tripped twice per 10-VERIFICATION SC1) |
| HARD-01 (additions + encoding) | New upstream getter flagged at runtime; `NG(n) === ngErrorCode(n)`; `UNKNOWN_ERROR_CODE === 500`               | integration (real `await import`)                                                                      | `npx nx run angular-typechecker:test -t "compiler-cli-types runtime"`                                                      | `compiler-cli-types.runtime.spec.ts` (3 tests) -- **green** (subset containment; additions diff `toEqual([])`; encoding round-trip)                       |
| HARD-02                        | Shim `EmitFlags` mirrors real members; `0 as EmitFlags` cast retained + still type-checks                      | build-time tsc (value-level assertion) + `nx build`                                                    | `npx nx run angular-typechecker:typecheck-drift` + `npx nx build angular-typechecker`                                      | drift value-level pins (DTS=1..All=31) + build -- **green** (both exit 0; cast retained at `run-typecheck.ts:229`)                                        |
| HARD-03                        | Every vendored divergence carries the greppable marker                                                         | static grep assertion (note: static -- the marker count is a `git grep` invariant, not a runtime test) | `git grep -c "angular-typechecker: vendored" -- packages/angular-typechecker/src/core/compiler-cli-types.ts` (expect >= 6) | N/A (grep) -- **green** (returns 6, >= 6 met)                                                                                                             |
| HARD-04                        | `getNgStructuralDiagnostics` retained + called + covered by the per-member probe                               | unit (existing) + build-time drift gate                                                                | `npx nx run angular-typechecker:test -t "gatherAllDiagnostics"` + drift gate                                               | `gather-diagnostics.spec.ts` (4 tests) -- **green** (`getNgStructuralDiagnostics` in call-order assertion; drift probe slot + runtime `GATHERED_GETTERS`) |
| HARD-05                        | No `TS-99` substring survives the `color:false` path; an `NG####` label renders (real `cli.formatDiagnostics`) | integration                                                                                            | `npx nx run angular-typechecker:test -t "TS-99"`                                                                           | `ts99-leak.integration.spec.ts` (1 test) -- **green** (real NG8101 producer -> real `cli.formatDiagnostics`; `/NG\d{4}/` present, `TS-99` absent)         |

_Status legend: pending / green / red / flaky_

**Validation run 2026-06-30 (retroactive audit):** `typecheck-drift` exit 0; `nx build` exit 0; full Vitest suite `26 test files, 147 tests passed`; `git grep -c "angular-typechecker: vendored"` = 6. Every HARD-01..HARD-05 requirement has a real, passing automated signal -- no coverage gap, no new test generated.

---

## Wave 0 Requirements

- [x] `packages/angular-typechecker/tsconfig.drift.json` - classic-node drift tsconfig (`module`/`moduleResolution: node`, `noEmit`, `ignoreDeprecations: "6.0"`, `files` only the drift file) (HARD-01) -- present and exercised by `typecheck-drift` (exit 0)
- [x] `packages/angular-typechecker/src/core/compiler-cli-types.drift.ts` - per-member assignability probes + `getTsProgram` special-case + call-site probes + value-level `UNKNOWN_ERROR_CODE`/`EmitFlags` assertions (HARD-01/02/04) -- present (6 `AssertAssignable` getter probes + `GetTsProgramProbe` + 8 call-site probes + UNKNOWN/EmitFlags pins)
- [x] `typecheck-drift` target in `packages/angular-typechecker/project.json` (`nx:run-commands` -> `tsc --noEmit -p tsconfig.drift.json`) (HARD-01) -- present, cached on compiler-cli typings inputs
- [x] `*.drift.ts` exclusion added to BOTH `tsconfig.lib.json` AND `tsconfig.spec.json` (HARD-01 safety - the real barrel resolves EMPTY under production nodenext) -- present (lib.json `exclude` + spec.json `exclude`)
- [x] `packages/angular-typechecker/src/core/compiler-cli-types.runtime.spec.ts` - runtime getter-set SUBSET-containment + encoding round-trip (HARD-01 D-04) -- present (3 tests green)
- [x] HARD-05 spec - new `*.ts99-leak.integration.spec.ts` OR a `not.toContain('TS-99')` assertion added to an existing NG8xxx case in `render-report.spec.ts` -- present as `ts99-leak.integration.spec.ts` (1 test green)
- [x] `ci.yml` wiring of `typecheck-drift` (Option A fold-in to the existing `run-many` recommended) -- wired at `.github/workflows/ci.yml` (`nx run-many -t typecheck-drift test -p angular-typechecker`)
- [x] Framework install: none - Vitest + TypeScript + Nx all present.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
| -------- | ----------- | ---------- | ----------------- |
| (none)   | -           | -          | -                 |

_All phase behaviors have automated verification (the HARD-03 marker count is an automatable `git grep` assertion, not manual)._

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (all Wave 0 artifacts now present)
- [x] No watch-mode flags
- [x] Feedback latency < 60s (drift gate ~2-5s cached; full Vitest suite ~10s wall)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-30 -- retroactive Nyquist audit on the completed, goal-verified phase. All 5 requirements (HARD-01..HARD-05) carry a real, passing automated signal (`typecheck-drift` exit 0, `nx build` exit 0, 147/147 Vitest tests green, vendor-marker grep = 6). No coverage gap; no test generated.
