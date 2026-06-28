---
phase: 4
slug: nx-executor-adapter-cacheable-target
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-28
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `04-RESEARCH.md` "## Validation Architecture" (live-verified against Nx 23.0.1 / @angular/compiler-cli 22.0.4 / TS 6.0.3 / Vitest 4.1.9). Per-task rows are finalized by the planner/validator once PLAN.md task IDs exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 via `@nx/vitest:test` |
| **Unit config file** | `packages/angular-typechecker/vitest.config.mts` (exists) |
| **Cache-e2e config file** | NEW dedicated serialized project (Wave 0): `singleFork`, `fileParallelism:false`, `testTimeout >= 180000`, `environment: node` (D-14) |
| **Quick run command** | `npx nx test angular-typechecker` (unit tier) |
| **Full suite command** | `npx nx build angular-typechecker && npx nx test angular-typechecker && npx nx test angular-typechecker-cache-e2e` |
| **Estimated runtime** | unit ~30s; cache-e2e ~minutes (real `performCompilation` + project graph + `nx run`) |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test angular-typechecker` (fast unit tier).
- **After every plan wave:** Run `npx nx build angular-typechecker && npx nx test angular-typechecker` (build required so GATE-A static + any built-executor specs read real dist bytes).
- **Before `/gsd:verify-work`:** FULL suite green, including `npx nx test angular-typechecker-cache-e2e` (the serialized cache-correctness gate). Run on the MAIN tree (D-17 — dependency/daemon/graph-heavy; worktree-hostile).
- **Max feedback latency:** unit < 30s; phase-gate cache-e2e on demand.

---

## Per-Requirement Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists |
|-------------|----------|-----------|-------------------|-------------|
| EXE-01 | `normalizeOptions` resolves relative + absolute tsConfig; splits reporter knobs | unit | `npx nx test angular-typechecker` (normalize-options.spec.ts) | ❌ W0 |
| EXE-01 | executor maps `{success}`; catches infra error -> `{false}`; re-throws unknown | unit (mock core) | `npx nx test angular-typechecker` (executor.spec.ts) | ❌ W0 |
| EXE-01 | `renderReport` delegates to formatReport with injected ng/ts | unit | `npx nx test angular-typechecker` (render-report.spec.ts) | ❌ W0 |
| EXE-01 | schema.json keys === schema.d.ts keys (parity) | unit | `npx nx test angular-typechecker` (schema-parity.spec.ts) | ❌ W0 |
| EXE-01 | executor `{success}` + diagnostic-code set === core (green AND injected-error) | integration (`runExecutor`) | `npx nx test angular-typechecker-cache-e2e` (executor-parity.int.spec.ts) | ❌ W0 |
| EXE-01 | literal `nx run <consumer>:angular-typecheck` runs and is discoverable | integration (`execSync`) | `npx nx test angular-typechecker-cache-e2e` | ❌ W0 |
| EXE-06 | the dep SOURCE file IS an input for the consumer target (R1 edge guard) | integration (`execSync` `--check`, exit 0 + `✓`) | `npx nx test angular-typechecker-cache-e2e` (BLOCKING pre-flight) | ❌ W0 |
| EXE-06 | `tsconfig.base.json` (extends root) IS an input | integration (`--check`, optional) | same | ❌ W0 (optional) |
| EXE-07 | a real `nx run` returns NG/template diagnostics through the compiled CJS executor (no `ERR_REQUIRE_ESM` at RUNTIME) | integration | `npx nx test angular-typechecker-cache-e2e` | ❌ W0 |
| EXE-07 | built `core/compiler-loader.js` retains literal `import(` (build-time half) | static | `gate-a-static.spec.ts` | ✅ exists |
| EXE-07 | `require()` the built `executor.js` runs without `ERR_REQUIRE_ESM` (belt-and-braces) | integration | same (dist-guarded) | ❌ W0 (optional) |
| TEST-04 | green run -> 2nd run CACHE HIT (marker present, exit 0) | integration | `npx nx test angular-typechecker-cache-e2e` (cache-busts-on-dep-error.int.spec.ts) | ❌ W0 |
| TEST-04 | inject dep error -> run CACHE MISS (no marker) + new diagnostic + non-zero exit | integration | same | ❌ W0 |

*Status: ❌ W0 = test file is a Wave 0 dependency (does not yet exist).*

---

## Required Distinct Cases (Nyquist — both edges of every binary signal)

| Signal | Required case A | Required case B |
|--------|-----------------|-----------------|
| Cache hit/miss (TEST-04) | **CACHE HIT** on the 2nd green run (marker present) | **CACHE MISS** after dep-error injection (marker absent + new diagnostic + non-zero exit) |
| R1 edge existence (D-10) | **`✓` is an input** on the dep source file (exit 0) — the BLOCKING pre-flight | non-input file yields `✗`/exit 1 (negative documented; guard relies on the positive) |
| tsConfig resolution (D-03) | **relative** path -> joined to `context.root` | **absolute** path -> passed through unchanged |
| Verdict mapping (D-01) | **green** (errorCount 0) -> `{ success: true }` | **injected error** (errorCount>0) -> `{ success: false }` |
| Infra error handling (D-01) | `TypecheckInfrastructureError` -> `logger.error` + `{ success: false }` | unknown error -> **re-thrown** (not swallowed) |
| Parity (D-16) | green state: executor codes === core codes | injected-error state: executor codes === core codes |

---

## Wave 0 Requirements

- [ ] `packages/angular-typechecker/src/core/render-report.spec.ts` — EXE-01 (D-02 seam)
- [ ] `packages/angular-typechecker/src/executors/angular-typecheck/normalize-options.spec.ts` — EXE-01/D-03 (rel+abs)
- [ ] `packages/angular-typechecker/src/executors/angular-typecheck/executor.spec.ts` — EXE-01/D-01 (mapping, infra-catch, re-throw)
- [ ] `packages/angular-typechecker/src/executors/angular-typecheck/schema-parity.spec.ts` — EXE-01/D-06
- [ ] The dedicated serialized cache-e2e project: `vitest.config.mts` + `project.json` (`@nx/vitest:test`) (D-14)
- [ ] `cache-busts-on-dep-error.int.spec.ts` — TEST-04 + EXE-06 (R1 guard + HIT/MISS)
- [ ] `executor-parity.int.spec.ts` — EXE-01/EXE-07/D-16 (`runExecutor` parity + one `execSync` `nx run`)
- [ ] `libs/typecheck-consumer-dep/**` + `libs/typecheck-consumer/**` committed fixtures incl. the `.pristine` sidecar (D-11/D-15)
- [ ] (optional) `built-executor-require.int.spec.ts` — EXE-07 belt-and-braces

*Existing infrastructure that already covers part of the phase: `gate-a-static.spec.ts` (EXE-07 build-time half), the Phase-3 unit suite (core composition), `vitest.config.mts` (unit plumbing).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| (none) | — | — | All phase behaviors have automated verification. |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (unit tier)
- [ ] Both edges of every binary signal covered (cache HIT + MISS; rel + abs; green + injected; infra-catch + re-throw)
- [ ] `nyquist_compliant: true` set in frontmatter (post-execution, by `/gsd:validate-phase`)

**Caveat (from research):** the R1 `nx show target inputs ... --check` guard must use `execSync` (throws on non-zero) or capture `$?` directly — piping through `head`/`rg` masks Nx's exit code with the pipe tail's.

**Approval:** pending
