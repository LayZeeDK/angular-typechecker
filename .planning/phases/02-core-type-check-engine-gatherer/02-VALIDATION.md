---
phase: 2
slug: core-type-check-engine-gatherer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-27
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `02-RESEARCH.md` "## Validation Architecture". The Per-Task Verification Map is populated once plans exist (and audited by `/gsd:validate-phase`).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 via `@nx/vitest:test` (already configured — WS-03 complete) |
| **Config file** | `packages/angular-typechecker/vitest.config.mts` |
| **Quick run command** | `npx nx test angular-typechecker -- --exclude '**/*.integration.spec.ts'` |
| **Full suite command** | `npx nx build angular-typechecker && npx nx test angular-typechecker` (build precedes so the GATE A static spec reads fresh `dist/`) |
| **Estimated runtime** | quick ~sub-second; full suite ~tens of seconds (REAL-compiler integration tier per fixture) |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test angular-typechecker -- --exclude '**/*.integration.spec.ts'` (fast unit specs: gatherer getter-order + LW-01 shim import)
- **After every plan wave:** Run `npx nx build angular-typechecker && npx nx test angular-typechecker` (REAL-compiler integration tier + GATE A static + GATE B differential)
- **Before `/gsd:verify-work`:** Full suite must be green; every Requirement -> Test Map row asserted
- **Max feedback latency:** quick run < 5s

---

## Per-Task Verification Map

> Populated during planning / `/gsd:validate-phase`. Seed rows below are the requirement/decision -> validation map from `02-RESEARCH.md`; bind each to a concrete `{N}-{plan}-{task}` ID once PLAN.md files exist.

| Req / Decision | Behavior | Test Type | Automated Command / Assertion | File Exists |
|----------------|----------|-----------|-------------------------------|-------------|
| ENG-01 | `runTypecheck` loads ESM compiler-cli, resolves tsconfig, whole-program no-emit, structured result | integration | `runTypecheck({tsConfigPath:<app fixture>})` resolves; `rootNamesCount > 0`; `diagnostics` is `ts.Diagnostic[]` | ❌ W0 |
| ENG-02 | Gatherer surfaces TS + template + extended in ONE pass, no short-circuit | unit + integration | Unit: 6 getters called in order (EXISTS, fix LW-01). Integration: F7 multi-error -> `codes` contains `2322` AND `NG(8109)`; differential `defaultGatherDiagnostics` returns `[2322]` only | unit ✅ / integ ❌ W0 |
| ENG-04 | Counts by category; `strictTemplates` honored; extended categories respected | integration | F5 (NG8101) -> `warningCount >= 1`; F6 promoted (`defaultCategory:"error"`) -> same code in `errorCount`; invariant `errorCount + warningCount <= diagnostics.length` | ❌ W0 |
| EXE-02 | Required single `tsConfig`; spec tsconfig checked | integration | `runTypecheck({tsConfigPath:<tsconfig.spec.json fixture>})` reports the planted spec-file error | ❌ W0 |
| TEST-02 | REAL compiler, exact codes/counts, per-introduction-version organization | integration | `*.angularNN.integration.spec.ts`; each fixture `codes` contains exact code + `errorCount`/`warningCount` exact | ❌ W0 |
| D-01 | Explicit counts; no public `codes`; invariant | integration | F5/F6 counts; `CoreResult` has no `codes` field; invariant holds | ❌ W0 |
| D-02 | `diagnostics:false` suppresses "Time for diagnostics" Message | integration | tsconfig with `diagnostics:true` -> result `diagnostics` has NO category-Message "Time for diagnostics" | ❌ W0 |
| D-03 / MD-01 | Config errors prepended; malformed tsconfig not silently clean | integration | malformed/nonexistent tsconfig -> `errorCount >= 1` (NOT 0/success); includes the `parsed.errors` entry | ❌ W0 |
| D-03 / D-03a | Zero-rootNames guard fires on solution-style | integration | `{files:[],include:[],references:[...]}` -> `rootNamesCount === 0` AND `errorCount === 1` AND message names a leaf tsconfig | ❌ W0 |
| D-05 / L-1 | Override neutralizes composite-triangle (TS5053/6304/6379) | integration | F8 composite-triangle -> `codes` excludes `5053`,`6304`,`6379` | ❌ W0 |
| D-06 / L-3 | Infra crash re-thrown (gate on `code === 500`), not counted | integration/unit | simulated returned `UNKNOWN_ERROR_CODE` -> `runTypecheck` THROWS; a normal type error does NOT throw | ❌ W0 |
| LW-01 | gatherer spec imports from the shim, not the barrel | static | `git grep "from '@angular/compiler-cli'" .../gather-diagnostics.spec.ts` returns nothing | one-line fix |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `fixtures/` new dirs + committed tsconfigs: ts-baseline (F2), ng-baseline (F3/F4), extended (F5/F6), composite-triangle (F8), solution-style, spec-tsconfig variant. (F1/F7 reuse the Phase-1 `gate-b-error` fixture.)
- [ ] `src/core/*.integration.spec.ts` (or per-version split `*.angularNN.integration.spec.ts`) with the `NG()` helper + a shared `codesFor(tsConfigPath)` runner calling `runTypecheck`
- [ ] `config-errors.integration.spec.ts` (D-03/MD-01) + solution-style zero-rootNames guard assertion
- [ ] `composite-triangle.integration.spec.ts` (D-05/L-1)
- [ ] `infra-failure` test (D-06) — integration fixture vs focused `performCompilation` stub (planner to confirm scope vs TEST-01's Phase-3 mock boundary)
- [ ] LW-01 one-line import fix in `gather-diagnostics.spec.ts` (barrel -> `./compiler-cli-types`)
- [ ] `gate-b.spec.ts` reconcile `result.codes` -> `result.diagnostics.map(d => d.code)` (D-01 drops public `codes`)

*Framework install: NONE — Vitest + `@nx/vitest:test` already configured (WS-03 complete).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| (none expected) | — | All Phase-2 behaviors have automated real-compiler verification | — |

*If none confirmed at plan time: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
