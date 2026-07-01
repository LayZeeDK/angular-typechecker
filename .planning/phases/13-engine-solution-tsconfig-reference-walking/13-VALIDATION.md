---
phase: 13
slug: engine-solution-tsconfig-reference-walking
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-01
validated: 2026-07-01
---

# Phase 13 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `13-RESEARCH.md` "## Validation Architecture" (ROADMAP SC1-5 + D-04/D-05 + cross-leaf TCB).

---

## Test Infrastructure

| Property               | Value                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Framework**          | Vitest `~4.1.0` via Nx executor `@nx/vitest:test`                                                                        |
| **Config file**        | `packages/angular-typechecker/vitest.config.mts` (integration `testTimeout`/`hookTimeout` 30000 for cold-compiler specs) |
| **Quick run command**  | `npx nx test angular-typechecker`                                                                                        |
| **Full suite command** | `npx nx run-many -t typecheck-drift test -p angular-typechecker` (drift tripwire + unit + integration)                   |
| **Estimated runtime**  | ~90 seconds (integration fixtures compile cold, ~30s ceiling each)                                                       |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test angular-typechecker` (unit + integration)
- **After every plan wave:** Run `npx nx run-many -t typecheck-drift test -p angular-typechecker`
- **Before `/gsd:verify-work`:** Full plugin suite + `angular-typechecker-cache-e2e` must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

> Reconciled post-execution by `/gsd:validate-phase` (2026-07-01). The draft rows were keyed by
> success criterion / decision because task IDs were TBD at plan time; each row below now names the
> CONCRETE test file(s) + `describe`/`it` location that proves it, all confirmed green by a live
> `npx nx test angular-typechecker` (27 files / 214 tests) + `npx nx test angular-typechecker-cache-e2e`
> (3 files / 9 tests), both run with `NX_DAEMON=false --skip-nx-cache`.

| SC / Decision                           | Requirement | Threat Ref                             | Secure Behavior                                                                                            | Test Type          | Concrete Test File (location)                                                                                                                                                                                | Automated Command                                                               | Coverage | Status |
| --------------------------------------- | ----------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | -------- | ------ |
| SC1 union completeness                  | WALK-01     | --                                     | Both app+spec leaf TS2322 reported (spec-only error present)                                               | unit + integration | `walk-references.integration.spec.ts:65-104` + `config-resolution.integration.spec.ts:127-166`; unit `walk-references.spec.ts:153-189`                                                                       | `npx nx test angular-typechecker`                                               | COVERED  | green  |
| SC2 dedupe collapse                     | WALK-01     | --                                     | Shared source diagnostic collapses to ONE cross-`Program`                                                  | integration        | `walk-references.integration.spec.ts:107-132` (`solution-style-overlap`)                                                                                                                                     | `npx nx test angular-typechecker`                                               | COVERED  | green  |
| SC2 both leaves ran                     | WALK-01     | --                                     | Two distinct-file TS2322; `errorCount === 2`                                                               | integration        | `walk-references.integration.spec.ts:65-104` (distinct `error.component.ts` / `.spec.ts`, `errorCount 2`)                                                                                                    | `npx nx test angular-typechecker`                                               | COVERED  | green  |
| SC2 boundary skip                       | WALK-01     | T-13-01 (out-of-project ref traversal) | OOP ref SKIPPED, not walked; `skippedReferences reason:'out-of-project'`                                   | unit + integration | `walk-references.integration.spec.ts:134-166` (`solution-style-oop`); unit never-compiled proof `walk-references.spec.ts:191-219`                                                                            | `npx nx test angular-typechecker`                                               | COVERED  | green  |
| SC3 three-way split                     | WALK-01     | --                                     | walk / `90001` none-in-project / `90001` empty; direct-leaf unchanged                                      | integration        | `walk-references.integration.spec.ts:168-211` (`it.each` over `solution-style`, `-oop`, `-empty`)                                                                                                            | `npx nx test angular-typechecker`                                               | COVERED  | green  |
| SC3 / D-05 fold-and-count               | WALK-01     | T-13-02 (broken-ref false PASS)        | ONE counted `90002`; survivor still walked; run RESOLVES (no rethrow)                                      | unit + integration | `walk-references.integration.spec.ts:213-261` (`solution-style-broken-ref`; resolves, not `TypecheckInfrastructureError`); unit by-code-only `walk-references.spec.ts:221-306`                               | `npx nx test angular-typechecker`                                               | COVERED  | green  |
| SC4 spec rewrite                        | WALK-01     | --                                     | `config-resolution.integration.spec.ts` asserts walk; COR-01 `:100-121` byte-unchanged                     | integration        | `config-resolution.integration.spec.ts:127-178` (walk block + TS18003-independence); COR-01 pin `:103-125` (`rejects TypecheckInfrastructureError`) unchanged                                                | `npx nx test angular-typechecker`                                               | COVERED  | green  |
| SC5 default hashing                     | WALK-02     | T-13-03 (stale PASS on spec edit)      | spec-only edit busts Nx cache; `inputs` has `default` not `production`                                     | e2e + manifest     | manifest `nx-target-defaults.spec.ts:73-102` (both executor keys); e2e `cache-busts-on-spec-edit.int.spec.ts:153-242` (R1 input pre-flight + cache-HIT then spec-edit MISS + `--skip-nx-cache` differential) | `npx nx test angular-typechecker` + `npx nx test angular-typechecker-cache-e2e` | COVERED  | green  |
| cross-leaf TCB abort                    | WALK-01     | --                                     | `templateCheckAborted` fires on abort in ANY leaf (union pre-filter scan)                                  | unit               | `run-typecheck.spec.ts:107-140` (TCB Fatal in SECOND leaf of synthesized cross-leaf union; negative: clean union -> undefined)                                                                               | `npx nx test angular-typechecker`                                               | COVERED  | green  |
| D-04 self/dup ref                       | WALK-01     | --                                     | redundant leaf skipped; output unchanged; `skippedReferences reason:'self-reference'`                      | unit + integration | `walk-references.integration.spec.ts:263-288` (`solution-style-selfref`, TS2322 exactly once); unit compile-at-most-once `walk-references.spec.ts:368-406`                                                   | `npx nx test angular-typechecker`                                               | COVERED  | green  |
| D-02 adapter render (skippedReferences) | WALK-01     | --                                     | one `logger.warn` per skipped ref (path + reason); advisory-only, verdict unchanged; silent when undefined | unit               | `executor.spec.ts:234-306` (per-entry warn, no-false-positive, verdict-unchanged)                                                                                                                            | `npx nx test angular-typechecker`                                               | COVERED  | green  |

_Status: pending / green / red / flaky_

---

## Wave 0 Requirements

- [x] `packages/angular-typechecker/src/core/walk-references.spec.ts` -- pure unit tests (reference resolution, self-ref dedupe, boundary skip, `90002` synthesis) against hand-built `ParsedConfiguration` / stub programs (no cold compiler). PRESENT + green: union+SUM, out-of-project never-compiled, counted 90002 fold-and-count, by-code-only 500 detect, 5012 scope exclusion, zero-root-names, self/dup compile-once, no-refs empty, `it.each` reason table.
- [x] `packages/angular-typechecker/src/core/walk-references.integration.spec.ts` -- real-compiler walk proofs (SC1/SC2/SC3/D-04/D-05) against the new fixtures. PRESENT + green (9 tests).
- [x] Fixtures: `fixtures/solution-style` upgrade (`tsconfig.spec.json`, `error.component.spec.ts`, planted TS2322 in `error.component.ts`). Present (integration specs compile it live).
- [x] Fixtures (NEW): `solution-style-overlap`, `solution-style-oop`, `solution-style-empty`, `solution-style-broken-ref`, `solution-style-selfref`. All present + exercised by green integration specs.
- [x] `config-resolution.integration.spec.ts` solution-style block rewrite (`:127-178`); COR-01 block (`:103-125`) BYTE-UNCHANGED (still `rejects.toBeInstanceOf(TypecheckInfrastructureError)`).
- [x] cache-e2e spec + fixture for the `production`->`default` hashing proof (SC5); `nx.json` `targetDefaults` edit. `cache-busts-on-spec-edit.int.spec.ts` + `nx-target-defaults.spec.ts` PRESENT + green.
- [x] `detectTemplateCheckAborted` unit coverage over a synthesized union (cross-leaf). PRESENT + green (`run-typecheck.spec.ts:107-140`).
- [x] Framework install: none -- Vitest / `@nx/vitest` already present.

---

## Manual-Only Verifications

| Behavior                                         | Requirement | Why Manual                       | Test Instructions                                                                     |
| ------------------------------------------------ | ----------- | -------------------------------- | ------------------------------------------------------------------------------------- |
| README single-target walk recipe reads correctly | WALK-01     | Prose/DX, not machine-assertable | Review the updated README consumer-guidance section against the shipped walk behavior |

_All engine/behavioral phase criteria (SC1-5, D-04, D-05, cross-leaf TCB) have automated verification._

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies -- every SC/decision row maps to a concrete green test (see reconciled Per-Task Verification Map).
- [x] Sampling continuity: no 3 consecutive tasks without automated verify -- all rows carry an `npx nx test` command.
- [x] Wave 0 covers all MISSING references -- no MISSING rows remain; all 11 rows are COVERED/green. No test files were generated by this audit (the suite already covers every behavioral criterion).
- [x] No watch-mode flags -- commands are `npx nx test ...` (single-run Vitest via `@nx/vitest:test`); no `--watch`.
- [x] Feedback latency < 90s -- unit + integration suite ~35s; cache-e2e ~55s.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** validated 2026-07-01 -- all 11 behavioral criteria (SC1-5, D-02, D-04, D-05, cross-leaf TCB) COVERED by real, green tests; independently confirmed via live `npx nx test angular-typechecker` (27 files / 214 tests passed) and `npx nx test angular-typechecker-cache-e2e` (3 files / 9 tests passed), both `NX_DAEMON=false --skip-nx-cache`. No gaps; no test files generated. The one Manual-Only item (README single-target walk recipe prose, WALK-01/DX) remains a documentation review, already inspected in 13-VERIFICATION.md.
