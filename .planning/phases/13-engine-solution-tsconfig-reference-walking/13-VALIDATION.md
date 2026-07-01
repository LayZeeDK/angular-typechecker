---
phase: 13
slug: engine-solution-tsconfig-reference-walking
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-01
---

# Phase 13 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `13-RESEARCH.md` "## Validation Architecture" (ROADMAP SC1-5 + D-04/D-05 + cross-leaf TCB).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `~4.1.0` via Nx executor `@nx/vitest:test` |
| **Config file** | `packages/angular-typechecker/vitest.config.mts` (integration `testTimeout`/`hookTimeout` 30000 for cold-compiler specs) |
| **Quick run command** | `npx nx test angular-typechecker` |
| **Full suite command** | `npx nx run-many -t typecheck-drift test -p angular-typechecker` (drift tripwire + unit + integration) |
| **Estimated runtime** | ~90 seconds (integration fixtures compile cold, ~30s ceiling each) |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test angular-typechecker` (unit + integration)
- **After every plan wave:** Run `npx nx run-many -t typecheck-drift test -p angular-typechecker`
- **Before `/gsd:verify-work`:** Full plugin suite + `angular-typechecker-cache-e2e` must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

> Task IDs are TBD until plans are written; `/gsd:validate-phase` reconciles this map to concrete
> `{plan}-{task}` IDs post-execution. Rows are keyed by success criterion / decision until then.

| SC / Decision | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Fixture | Status |
|---------------|-------------|------------|-----------------|-----------|-------------------|---------|--------|
| SC1 union completeness | WALK-01 | -- | Both app+spec leaf TS2322 reported (spec-only error present) | integration | `npx nx test angular-typechecker` | `solution-style` (upgraded) | pending |
| SC2 dedupe collapse | WALK-01 | -- | Shared source diagnostic collapses to ONE cross-`Program` | integration | `npx nx test angular-typechecker` | `solution-style-overlap` | pending |
| SC2 both leaves ran | WALK-01 | -- | Two distinct-file TS2322; `errorCount === 2` | integration | `npx nx test angular-typechecker` | `solution-style` | pending |
| SC2 boundary skip | WALK-01 | T-13-01 (out-of-project ref traversal) | OOP ref SKIPPED, not walked; `skippedReferences reason:'out-of-project'` | integration | `npx nx test angular-typechecker` | `solution-style-oop` | pending |
| SC3 three-way split | WALK-01 | -- | walk / `90001` none-in-project / `90001` empty; direct-leaf unchanged | integration | `npx nx test angular-typechecker` | `solution-style`, `-oop`, `-empty` | pending |
| SC3 / D-05 fold-and-count | WALK-01 | T-13-02 (broken-ref false PASS) | ONE counted `90002`; survivor still walked; run RESOLVES (no rethrow) | integration | `npx nx test angular-typechecker` | `solution-style-broken-ref` | pending |
| SC4 spec rewrite | WALK-01 | -- | `config-resolution.integration.spec.ts` asserts walk; COR-01 `:100-121` byte-unchanged | integration | `npx nx test angular-typechecker` | `solution-style` | pending |
| SC5 default hashing | WALK-02 | T-13-03 (stale PASS on spec edit) | spec-only edit busts Nx cache; `inputs` has `default` not `production` | e2e + manifest | `npx nx test angular-typechecker-cache-e2e` | cache-e2e fixtures + `nx.json` | pending |
| cross-leaf TCB abort | WALK-01 | -- | `templateCheckAborted` fires on abort in ANY leaf (union pre-filter scan) | unit + integration | `npx nx test angular-typechecker` | synthesized union + poison leaf | pending |
| D-04 self/dup ref | WALK-01 | -- | redundant leaf skipped; output unchanged; `skippedReferences reason:'self-reference'` | integration | `npx nx test angular-typechecker` | `solution-style-selfref` | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `packages/angular-typechecker/src/core/walk-references.spec.ts` -- pure unit tests (reference resolution, self-ref dedupe, boundary skip, `90002` synthesis) against hand-built `ParsedConfiguration` / stub programs (no cold compiler)
- [ ] `packages/angular-typechecker/src/core/walk-references.integration.spec.ts` -- real-compiler walk proofs (SC1/SC2/SC3/D-05) against the new fixtures
- [ ] Fixtures: `fixtures/solution-style` upgrade (`tsconfig.spec.json`, `error.component.spec.ts`, planted TS2322 in `error.component.ts`)
- [ ] Fixtures (NEW): `solution-style-overlap`, `solution-style-oop`, `solution-style-empty`, `solution-style-broken-ref`, `solution-style-selfref`
- [ ] `config-resolution.integration.spec.ts` solution-style block rewrite (`:124-152`); COR-01 block (`:100-121`) BYTE-UNCHANGED
- [ ] cache-e2e spec + fixture for the `production`->`default` hashing proof (SC5); `nx.json` `targetDefaults` edit
- [ ] `detectTemplateCheckAborted` unit coverage over a synthesized union (cross-leaf)
- [ ] Framework install: none -- Vitest / `@nx/vitest` already present

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| README single-target walk recipe reads correctly | WALK-01 | Prose/DX, not machine-assertable | Review the updated README consumer-guidance section against the shipped walk behavior |

*All engine/behavioral phase criteria (SC1-5, D-04, D-05, cross-leaf TCB) have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
