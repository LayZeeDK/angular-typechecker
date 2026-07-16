---
phase: 28
slug: shipped-tarball-e2e-real-clone-uat
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-16
---

# Phase 28 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> This is a VERIFICATION phase -- the validation architecture IS the test/UAT matrix; each cell is a sample of the shipped-artifact behavior. Sourced from `28-RESEARCH.md` "Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x via `@nx/vitest:test` (`e2e` target) |
| **Config file** | `e2e/angular-typechecker-cli-e2e/vitest.config.mts` (new -- Wave 0; copy install-e2e's shape: node env, `pool:forks`+`singleFork`, `fileParallelism:false`, `sequence.concurrent:false`, `testTimeout`/`hookTimeout` 300000, `globalSetup ./src/global-setup.ts`) |
| **Quick run command** | `npx nx run angular-typechecker-cli-e2e:e2e` (builds dist + publishes once + runs the specs) |
| **Full suite command** | `npx nx run-many -t e2e --parallel=2` (LOCAL full tier) / CI per-project matrix + the new `e2e-windows` job |
| **Estimated runtime** | ~300s per e2e cell (real build + publish + install + run) |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test angular-typechecker` (fast tier -- runs the GUARD specs on every OS x Node cell)
- **After every plan wave:** Run `npx nx run angular-typechecker-cli-e2e:e2e` + `npx nx run-many -t e2e --parallel=2` (full local tier)
- **Before `/gsd:verify-work`:** Full CI green (Linux dynamic matrix + `e2e-windows`); VER-05 UAT is human-run and recorded in the UAT artifact
- **Max feedback latency:** ~300 seconds (e2e); ~30s (GUARD fast tier)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 28-01-* | 01 | 1 | VER-04 | T-28 supply-chain | installed `.bin/angular-typechecker` + `.bin/atc` + `npx angular-typechecker` -> literal 0/1/2 (npm) | e2e | `nx run angular-typechecker-cli-e2e:e2e` | ❌ W0 (`src/cli-exit-codes.e2e.spec.ts`) | ⬜ pending |
| 28-01-* | 01 | 1 | VER-04 | T-28 supply-chain | yarn flat + yarn workspace install + shim -> 0/1/2 | e2e | same | ❌ W0 (`src/cli-exit-codes-yarn.e2e.spec.ts`) | ⬜ pending |
| 28-01-* | 01 | 1 | VER-04 | T-28 supply-chain | pnpm install + shim -> 0/1/2 | e2e | same | ❌ W0 (`src/cli-exit-codes-pnpm.e2e.spec.ts`) | ⬜ pending |
| 28-01-* | 01 | 1 | VER-04 SC-3 | T-28 nx-crash-class | installed bin output !~ `/ERR_REQUIRE_ESM/` + runtime require-cache no `@nx/*`/`nx/` | e2e | same | ❌ W0 (`src/nx-free-runtime.e2e.spec.ts`) | ⬜ pending |
| 28-02-* | 02 | 2 | VER-04 SC-2 | T-28 cmd-injection | tarball e2e on Windows (Node 24) with Verdaccio ECONNREFUSED robustness | CI | `e2e-windows` job (`nx run-many -t e2e -p angular-typechecker-cli-e2e` on windows-latest) | ❌ W0 (`ci.yml` + retry in verdaccio-global-setup) | ⬜ pending |
| 28-02-* | 02 | 2 | VER-04 (guard) | T-28 cmd-injection | OS-axis + matrix wiring cannot silently drift | unit | `nx test angular-typechecker` (GUARD-01b / new GUARD-01f) | ❌ W0 (extend `ci-e2e-coverage-guard.spec.ts`) | ⬜ pending |
| 28-03-* | 03 | 3 | VER-05 | T-28 untrusted-clone | shipped bin at real tsconfigs in on-stack Angular 22 clones (both kinds): RED / GREEN / bad-path->2 | manual UAT | human-run per `28-<id>-UAT.md` | ❌ W0 (`28-<id>-UAT.md` artifact) | ⬜ pending |

*Status: pending / green / red / flaky. Wave/plan IDs are provisional -- the planner sets the authoritative task IDs.*

---

## Wave 0 Requirements

- [ ] `e2e/angular-typechecker-cli-e2e/project.json` -- `e2e` + `typecheck` targets, serialized, `build` dependsOn (VER-04; satisfies GUARD-01/01c/01d/01e/01b)
- [ ] `e2e/angular-typechecker-cli-e2e/vitest.config.mts` -- copy install-e2e's serialized node-env shape
- [ ] `e2e/angular-typechecker-cli-e2e/src/global-setup.ts` -- `createVerdaccioGlobalSetup({ label })`
- [ ] `e2e/angular-typechecker-cli-e2e/fixtures/cli-consumer/` -- minimal on-stack Angular 22 fixture (peers + lockfile + clean tsconfig(s) + a clean component + planted-error variants)
- [ ] `src/cli-exit-codes*.e2e.spec.ts` (npm / yarn / pnpm) + `src/nx-free-runtime.e2e.spec.ts`
- [ ] `.github/workflows/ci.yml` -- add `e2e-windows` job + add it to the `ci` aggregate `needs` (research recommendation: option b, separate job)
- [ ] Extend `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` (GUARD-01b or new GUARD-01f) for the OS-axis wiring
- [ ] Bounded ECONNREFUSED retry in `libs/test-util/src/lib/verdaccio-global-setup.ts` (`mintCiToken`) [+ optional spec-level install retry]
- [ ] `28-<id>-UAT.md` manual-UAT artifact (VER-05)
- [ ] Optional: `libs/test-util/src/lib/cli-e2e.ts` shared `createCliRun` helper (only if reused across the 3 PM specs)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Shipped bin at real project tsconfigs in real on-stack Angular 22 OSS clones (both kinds) | VER-05 | Uncommitted, SHA-pinned real OSS clones; repos move, so clones are not committable CI fixtures | `28-<id>-UAT.md`: clone + `git checkout <sha>`; run shipped `.bin` at a real tsconfig -> clean GREEN (0); plant a known TS/NG diagnostic -> RED (1, code in stdout); bad tsconfig path -> 2. Angular-CLI kind: `ngx-leaflet @818e9ae`, `realworld-angular @9e3528f` (carry-forward). Nx kind: `radix-ng/primitives` (primary), `analogjs/analog` (alt) -- pin FRESH SHAs at UAT time. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (VER-05 is the one deliberate manual)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency acceptable for an e2e-tier phase (~300s per cell)
- [ ] `nyquist_compliant: true` set in frontmatter (flipped post-execution by `/gsd:validate-phase`)

**Approval:** pending
