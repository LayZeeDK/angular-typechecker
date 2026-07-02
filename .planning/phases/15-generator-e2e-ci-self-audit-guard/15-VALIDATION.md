---
phase: 15
slug: generator-e2e-ci-self-audit-guard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-02
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `15-RESEARCH.md` "## Validation Architecture". This is a
> testing + CI-config phase: the deliverables ARE the tests, so "validation"
> here means the tests are present, green, and honest (the guard carries a
> deliberate-RED proof; the e2e verdict is a green/broken PAIRING, not a bare
> exit-0).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 via `@nx/vitest:test` |
| **Config file** | e2e: `e2e/angular-typechecker-install-e2e/vitest.config.mts` (forks/singleFork/fileParallelism:false/node env/300000ms); guard: `packages/angular-typechecker/vitest.config.mts` (jsdom, 30000ms) |
| **Quick run command** | `npx nx test angular-typechecker` (runs the in-plugin GUARD-01 spec + all plugin specs; fast) |
| **Full suite command** | `npx nx run-many -t test -p angular-typechecker-install-e2e angular-typechecker-cache-e2e angular-typechecker-matrix-e2e` (heavy tarball e2e) |
| **Estimated runtime** | guard: ~5s; full e2e: several minutes (real `nx build` + `npm pack` + `npm install` per scenario) |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test angular-typechecker` (guard + plugin specs; fast).
- **After every plan wave:** Run the full e2e run-many (the three e2e projects) on the merged main tree.
- **Before `/gsd:verify-work`:** Full suite green + the GUARD-01 deliberate-RED proof recorded once in the phase SUMMARY.
- **Max feedback latency:** guard < 30s; e2e is the phase-gate tier (minutes), run on the merged main tree, not per-task.

---

## Per-Task Verification Map

> Requirement-granular map (task IDs finalized by the planner). Every row is
> automated except the GUARD-01 deliberate-RED probe (a one-time manual/scripted
> proof recorded in the SUMMARY, mirroring Phase 12's tripwire proof).

| Req ID | Wave | Observable signal that proves it | Test Type | Automated Command | File Exists |
|--------|------|----------------------------------|-----------|-------------------|-------------|
| GE2E-01 | 0 | After `nx g angular-typechecker:configuration <proj>`: tmp `project.json` has ONE `typecheck` target (executor `angular-typechecker:typecheck`, `options.tsConfig` -> solution `tsconfig.json`) AND tmp `nx.json` `targetDefaults["angular-typechecker:typecheck"]` seeded with the WALK-02 block (`inputs[0]==='default'`, `cache:true`, `outputs:[]`) | e2e (tarball) | `npx nx test angular-typechecker-install-e2e` (`generator-e2e.int.spec.ts`) | ❌ W0 |
| GE2E-02 | 0 | Clean `nx run <proj>:typecheck --skip-nx-cache` exit 0; after injecting TS2322 (lib leaf) + TS2345 (spec leaf), exit != 0 AND stdout contains BOTH tokens AND no `ERR_REQUIRE_ESM` AND no `infrastructure error` (two-leaf verdict pairing) | e2e (tarball) | same file | ❌ W0 |
| GE2E-03 | 0 | After `npm install <tarball>` + `nx g angular-typechecker:init` (the exact command `nx add` runs internally), tmp `nx.json` carries the seeded `targetDefaults` from ABSENT (WALK-02, `inputs[0]==='default'`) | e2e (tarball) | `nx-add-e2e.int.spec.ts` (or a `describe` in the GE2E file) | ❌ W0 |
| GUARD-01 | 0 | `e2e`-job `-p` set (job-scoped, line-start `-p` extraction) === `e2e/*/project.json` `.name` set, bidirectional (`every`), with LOCATED failure messages | in-plugin unit (6-cell matrix) | `npx nx test angular-typechecker` (`ci-e2e-coverage-guard.spec.ts`) | ❌ W0 |
| GUARD-01 (RED proof) | 0 | Transiently add `e2e/phantom-e2e/project.json` (or drop a `-p` entry) -> guard goes RED with a located message -> restore | manual/scripted (one-time) | recorded in SUMMARY | N/A |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `e2e/angular-typechecker-install-e2e/fixtures/consumer-generator/` — new multi-leaf solution fixture workspace (un-wired Angular library; solution `tsconfig.json` with non-empty `references[]` -> `tsconfig.lib.json` + `tsconfig.spec.json`; `nx.json` with NO `targetDefaults["angular-typechecker:typecheck"]` key; NO lockfile). Covers GE2E-01/02/03.
- [ ] `e2e/angular-typechecker-install-e2e/src/generator-e2e.int.spec.ts` — GE2E-01 + GE2E-02.
- [ ] `e2e/angular-typechecker-install-e2e/src/nx-add-e2e.int.spec.ts` (or a `describe` folded into the above) — GE2E-03.
- [ ] `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` — GUARD-01 (in-plugin, NOT `.int.spec.ts`).
- [ ] (optional, D-13) extend `e2e/angular-typechecker-install-e2e/src/tarball-audit.int.spec.ts` `REQUIRED_FILES` with the five shipped generator paths.

*Framework install: none needed — Vitest + `@nx/vitest` are already configured for both the plugin and the e2e project.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The guard actually goes RED on drift | GUARD-01 | A committed test cannot assert its own RED path without a transient repo mutation; the proof is a one-time execution, not a permanent test (mirrors Phase 12's tripwire deliberate-RED) | Add `e2e/phantom-e2e/project.json` `{"name":"phantom-e2e"}` (or drop one `-p` entry from `ci.yml`), run `npx nx test angular-typechecker`, confirm the guard fails with the located message naming the offending project, then remove the phantom dir / restore the line. Record the outcome in the phase SUMMARY. |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (the 4 new files above)
- [ ] No watch-mode flags (the e2e config is `watch:false`; `--skip-nx-cache` on every `nx run`)
- [ ] Feedback latency < 30s (guard tier); e2e is the phase-gate tier
- [ ] `nyquist_compliant: true` set in frontmatter (post-execution, by `/gsd:validate-phase`)

**Approval:** pending
