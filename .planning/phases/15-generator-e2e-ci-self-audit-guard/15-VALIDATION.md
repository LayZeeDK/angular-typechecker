---
phase: 15
slug: generator-e2e-ci-self-audit-guard
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-02
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `15-RESEARCH.md` "## Validation Architecture". This is a
> testing + CI-config phase: the deliverables ARE the tests, so "validation"
> here means the tests are present, green, and honest (the guard carries a
> deliberate-RED proof; the e2e verdict is a green/broken PAIRING, not a bare
> exit-0). Post-execution audit (2026-07-02): all 4 requirements COVERED by
> green automated tests — `nyquist_compliant: true`.

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
- **Before `/gsd:verify-work`:** Full suite green + the GUARD-01 deliberate-RED proof recorded in the SUMMARY.
- **Max feedback latency:** guard < 30s; e2e is the phase-gate tier (minutes), run on the merged main tree, not per-task.

---

## Per-Task Verification Map

> Requirement-granular map. Every row is automated except the GUARD-01
> deliberate-RED probe (a one-time manual/scripted proof recorded in the
> SUMMARY, mirroring Phase 12's tripwire proof).

| Req ID | Wave | Observable signal that proves it | Test Type | Automated Command | Status |
|--------|------|----------------------------------|-----------|-------------------|--------|
| GE2E-01 | 0 | After `nx g angular-typechecker:configuration <proj>`: tmp `project.json` has ONE `typecheck` target (executor `angular-typechecker:typecheck`, `options.tsConfig` -> solution `tsconfig.json`) AND tmp `nx.json` `targetDefaults` seeded with the WALK-02 block (`inputs[0]==='default'`, `cache:true`, `outputs:[]`); before-absent baseline asserts the key was `undefined` pre-generate (WR-02) | e2e (tarball) | `npx nx test angular-typechecker-install-e2e` (`generator-e2e.int.spec.ts`) | ✅ green |
| GE2E-02 | 0 | Clean `nx run <proj>:typecheck --skip-nx-cache` exit 0; after injecting TS2322 into the lib-ONLY `consumer-generator.util.ts` (WR-01: uniquely attributes to the lib leaf) + TS2345 into the spec, exit != 0 AND stdout contains BOTH tokens AND no `ERR_REQUIRE_ESM`/`infrastructure error` (two-leaf verdict pairing) | e2e (tarball) | same file | ✅ green |
| GE2E-03 | 0 | After `npm install <tarball>` + `nx g angular-typechecker:init`, tmp `nx.json` carries the seeded `targetDefaults` from ABSENT (`inputs[0]==='default'`) | e2e (tarball) | `nx-add-e2e.int.spec.ts` | ✅ green |
| GUARD-01 | 0 | `e2e`-job `-p` set (job-scoped extraction) === `e2e/*/project.json` `.name` set, bidirectional (`every`), with located failure messages | in-plugin unit (6-cell matrix) | `npx nx test angular-typechecker` (`ci-e2e-coverage-guard.spec.ts`) | ✅ green |
| GUARD-01 (RED proof) | 0 | Transient phantom `e2e/phantom-e2e/project.json` -> guard RED with located message -> restored | manual/scripted (one-time) | recorded in 15-01-SUMMARY.md | ✅ done + restored |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `e2e/angular-typechecker-install-e2e/fixtures/consumer-generator/` — multi-leaf solution fixture (un-wired Angular library; solution `tsconfig.json` with non-empty `references[]`; `nx.json` with NO `targetDefaults["angular-typechecker:typecheck"]`; NO lockfile) + the lib-only `consumer-generator.util.ts` (WR-01). Covers GE2E-01/02/03.
- [x] `e2e/angular-typechecker-install-e2e/src/generator-e2e.int.spec.ts` — GE2E-01 + GE2E-02.
- [x] `e2e/angular-typechecker-install-e2e/src/nx-add-e2e.int.spec.ts` — GE2E-03.
- [x] `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` — GUARD-01 (in-plugin, plain `*.spec.ts`).
- [x] `e2e/angular-typechecker-install-e2e/src/tarball-audit.int.spec.ts` — extended `REQUIRED_FILES` with the 5 shipped generator paths (D-13).

*Framework install: none needed — Vitest + `@nx/vitest` were already configured.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The guard actually goes RED on drift | GUARD-01 | A committed test cannot assert its own RED path without a transient repo mutation; the proof is a one-time execution (mirrors Phase 12's tripwire deliberate-RED) | Add `e2e/phantom-e2e/project.json` (or drop a `-p` entry), run `npx nx test angular-typechecker`, confirm the located RED message, then restore. **Performed 2026-07-02 (Probe A, phantom project); recorded in 15-01-SUMMARY.md; restored to green.** |

*All other phase behaviors have automated verification.*

---

## Validation Audit 2026-07-02

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

State A audit: `15-VALIDATION.md` existed from plan time. All 4 phase requirements (GE2E-01/02/03, GUARD-01) map to committed automated tests that ran GREEN (`angular-typechecker-install-e2e` 5 files / 26 tests; plugin suite 32 files / 239 tests incl. the guard). No MISSING or PARTIAL gaps -> no test generation and no `gsd-nyquist-auditor` spawn required. The GUARD-01 deliberate-RED proof is correctly classified manual-only (a transient one-time probe, performed + restored). `nyquist_compliant: true`, `wave_0_complete: true`.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (the new files above)
- [x] No watch-mode flags (the e2e config is `watch:false`; `--skip-nx-cache` on every `nx run`)
- [x] Feedback latency < 30s (guard tier); e2e is the phase-gate tier
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** verified 2026-07-02
