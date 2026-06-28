---
phase: 6
slug: full-e2e-matrix-ci
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-29
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `06-RESEARCH.md` § Validation Architecture. The Per-Task
> Verification Map is seeded with the requirement->layer mapping; concrete task
> IDs are bound by the planner and finalized by `/gsd:validate-phase` post-execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x via `@nx/vitest:test` |
| **Config file** | per-project `vitest.config.mts` (plugin unit: jsdom env; e2e: cloned serialized node-env config, `singleFork`, `fileParallelism:false`, 300000 timeouts) |
| **Quick run command** | `npx nx run-many -t test -p angular-typechecker` |
| **Full suite command** | `npx nx run-many -t test -p angular-typechecker-install-e2e angular-typechecker-cache-e2e angular-typechecker-matrix-e2e` (Linux-only e2e gate) |
| **Estimated runtime** | unit+integration ~tens of seconds/cell; e2e gate several minutes (real pack/install + nested nx run, serialized) |

---

## Sampling Rate

- **After every task commit:** Run `npx nx run-many -t test -p angular-typechecker` (fast unit + integration)
- **After every plan wave:** add the e2e project list on Linux (`... -p angular-typechecker-matrix-e2e ...`)
- **Before `/gsd:verify-work`:** the full `ci.yml` matrix green (all 9 `test` cells + the `e2e` job) -> the aggregate `ci` job green
- **Max feedback latency:** unit/integration < ~60s; e2e gate is the slow backstop (minutes, Linux-only)

---

## Per-Task Verification Map

> Task IDs are assigned by the planner (step 8). This map is seeded from
> `06-RESEARCH.md` § Phase Requirements -> Test Map; `/gsd:validate-phase` binds
> each row to a concrete `{N}-PP-TT` task ID and flips Status after execution.

| Requirement | Behavior | Test Type | Automated Command | Layer | File (Wave 0 = new) | Status |
|-------------|----------|-----------|-------------------|-------|---------------------|--------|
| TEST-03 | application type-checks from the installed tarball (green + injected TS2322) | e2e | `nx run-many -t test -p angular-typechecker-matrix-e2e` | e2e 5-type | `e2e/.../src/matrix-5types.int.spec.ts` (Wave 0) | ⬜ pending |
| TEST-03 | local (non-buildable) library | e2e | (same; `it.each` over 5 targets) | e2e 5-type | (same) Wave 0 | ⬜ pending |
| TEST-03 | buildable library (hand-authored build target, no `@nx/angular` dep) | e2e | (same) | e2e 5-type | (same) Wave 0 | ⬜ pending |
| TEST-03 | publishable library (hand-authored build target) | e2e | (same) | e2e 5-type | (same) Wave 0 | ⬜ pending |
| TEST-03 | spec tsconfig (executor points at `tsconfig.spec.json`) | e2e | (same) | e2e 5-type | (same) Wave 0 | ⬜ pending |
| TEST-03 / OUT-02 | pnpm symlinked-store run + realpath regression-guard (Linux) | e2e | `nx run-many -t test -p angular-typechecker-matrix-e2e` | e2e pnpm | `e2e/.../src/pnpm-symlink.int.spec.ts` + `pnpm-lock.yaml` (Wave 0) | ⬜ pending |
| OUT-02 | mixed-case fold (`useCaseSensitiveFileNames:false`, in/out-of-project + node_modules-segment) | unit | `nx run-many -t test -p angular-typechecker` | unit (all 9 cells) | EXTEND `filter-diagnostics.spec.ts` | ⬜ pending |
| OUT-02 | host-derived case sensitivity (live `ts.sys`/program host) | integration | (same) | integration (all 9 cells; mac/win legs are the case-insensitive samples) | EXTEND `run-typecheck.integration.spec.ts` | ⬜ pending |
| CI-01 | unit+integration on 3 Node x 3 OS | CI | the `test` matrix in `ci.yml` | CI infra | `.github/workflows/ci.yml` (Wave 0) | ⬜ pending |
| CI-01 | heavy e2e/tarball-install Linux-only | CI | the `e2e` job in `ci.yml` | CI infra | (same) Wave 0 | ⬜ pending |
| CI-01 | full matrix green + required merge/publish gate | CI | the aggregate `ci` job (`needs:[test,e2e]`, `if:always`) | CI infra | (same) Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Nyquist Sample Points

- **5 project types x install path** (5 samples) — app, local lib, buildable lib, publishable lib, spec tsconfig; each green + injected-`TS2322` against the once-installed npm tarball.
- **pnpm symlink case** (1 sample) — one pnpm install; symlinked-layout green/red + realpath regression-guard (Linux).
- **mixed-case case** (2 samples) — unit (`filter-diagnostics.spec.ts`) + integration (host-derived case sensitivity), both on all 9 cells; the macOS+Windows legs are the live case-insensitive samples.
- **9 CI matrix cells** (9 samples) — {22,24,26} x {ubuntu,windows,macos}, `fail-fast:false`, unit+integration each.
- **aggregate gate** (1 sample) — the `ci` job; green iff all 9 `test` cells AND the `e2e` job succeed. This is the single check Phase 7's ruleset requires.

---

## Wave 0 Requirements

- [ ] `.github/workflows/ci.yml` — CI-01 (test matrix + Linux-only e2e job + aggregate `ci` gate)
- [ ] `e2e/angular-typechecker-matrix-e2e/{project.json,vitest.config.mts,tsconfig.json,tsconfig.spec.json}` — new Nx project (clone install-e2e serialized config)
- [ ] `e2e/angular-typechecker-matrix-e2e/fixtures/consumer-workspace/**` — the 5-type fixture (self-contained `nx.json`, `package.json`, 4 projects + a spec target; published executor id; no `tsconfig.base.json`/source alias)
- [ ] `e2e/angular-typechecker-matrix-e2e/src/matrix-5types.int.spec.ts` — TEST-03 5-type (`it.each` over 5 targets, green + injected error)
- [ ] `e2e/angular-typechecker-matrix-e2e/src/pnpm-symlink.int.spec.ts` + committed `pnpm-lock.yaml` — OUT-02 pnpm backstop
- [ ] EXTEND `packages/angular-typechecker/src/core/filter-diagnostics.spec.ts` — D-10 mixed-case unit cases
- [ ] EXTEND the run-typecheck integration spec — D-10 host-derived case-sensitivity assertion
- [ ] (OQ-1 spike, BLOCKING-before-lock) clean `npm install` of the shaped fixture confirms no ERESOLVE without `legacy-peer-deps`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The pnpm realpath regression-guard genuinely fails a non-realpath filter | OUT-02 / B-02 | Git Bash `ln -s` on the Windows arm64 dev box produces a COPY (not a symlink) — the boundary-crossing realpath cannot be reproduced locally | Construct + validate the guard on the Linux CI runner (the e2e gate is Linux-only anyway); confirm `ts.sys.realpath` crosses the `.pnpm/` boundary before asserting the KEPT diagnostic |

*All other phase behaviors have automated verification (CI matrix + e2e).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (ci.yml, matrix-e2e project, fixtures, spec extensions)
- [ ] No watch-mode flags
- [ ] Feedback latency acceptable (unit/integration < ~60s; e2e gate is the slow Linux-only backstop by design)
- [ ] `nyquist_compliant: true` set in frontmatter (by `/gsd:validate-phase` post-execution)

**Approval:** pending
