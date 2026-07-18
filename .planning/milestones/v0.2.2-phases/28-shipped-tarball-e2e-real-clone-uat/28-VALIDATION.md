---
phase: 28
slug: shipped-tarball-e2e-real-clone-uat
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-16
validated: 2026-07-17
---

# Phase 28 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> This is a VERIFICATION phase -- the validation architecture IS the test/UAT matrix; each cell is a sample of the shipped-artifact behavior. Sourced from `28-RESEARCH.md` "Validation Architecture".
>
> **Post-execution (2026-07-17):** flipped `status`/`nyquist_compliant`/`wave_0_complete` to reflect what actually shipped. The four VER-04 e2e specs, the GUARD-01f OS-axis wiring guard, and the VER-05 UAT all landed and are GREEN in CI (draft PR #41: `e2e (angular-typechecker-cli-e2e)` + `e2e-windows` + every `test` matrix cell + the `ci` aggregate all SUCCESS). The retroactive Nyquist audit (below) scored every success criterion COVERED and generated ZERO new tests -- coverage was already complete, so YAGNI applies.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x via `@nx/vitest:test` (`e2e` target) |
| **Config file** | `e2e/angular-typechecker-cli-e2e/vitest.config.mts` (node env, `pool:forks`+`singleFork`, `fileParallelism:false`, `sequence.concurrent:false`, `testTimeout`/`hookTimeout` 300000, `globalSetup ./src/global-setup.ts`) |
| **Quick run command** | `npx nx run angular-typechecker-cli-e2e:e2e` (builds dist + publishes once + runs the specs) |
| **Full suite command** | `npx nx run-many -t e2e --parallel=2` (LOCAL full tier) / CI per-project matrix + the `e2e-windows` job |
| **Guard fast tier** | `npx nx test angular-typechecker` (runs GUARD-01/01b/01c/01d/01e/01f in `src/ci-e2e-coverage-guard.spec.ts`) |
| **Estimated runtime** | ~300s per e2e cell (real build + publish + install + run); ~5s guard fast tier |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test angular-typechecker` (fast tier -- runs the GUARD specs on every OS x Node cell)
- **After every plan wave:** Run `npx nx run angular-typechecker-cli-e2e:e2e` + `npx nx run-many -t e2e --parallel=2` (full local tier)
- **Before `/gsd:verify-work`:** Full CI green (Linux dynamic matrix + `e2e-windows`); VER-05 UAT is human-run and recorded in the UAT artifact
- **Max feedback latency:** ~300 seconds (e2e); ~5s (GUARD fast tier)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|------|--------|
| 28-01-* | 01 | 1 | VER-04 | T-28 supply-chain | installed `.bin/angular-typechecker` + `.bin/atc` + `npx angular-typechecker` -> literal 0/1/2 (npm) | e2e | `nx run angular-typechecker-cli-e2e:e2e` | `src/cli-exit-codes.e2e.spec.ts` | green (CI PR #41) |
| 28-01-* | 01 | 1 | VER-04 | T-28 supply-chain | yarn flat + yarn workspace install + shim -> 0/1/2 | e2e | same | `src/cli-exit-codes-yarn.e2e.spec.ts` | green (CI PR #41) |
| 28-01-* | 01 | 1 | VER-04 | T-28 supply-chain | pnpm install + shim -> 0/1/2 | e2e | same | `src/cli-exit-codes-pnpm.e2e.spec.ts` | green (CI PR #41) |
| 28-01-* | 01 | 1 | VER-04 SC-3 | T-28 nx-crash-class | installed bin output !~ `/ERR_REQUIRE_ESM/` + runtime require-cache no `@nx/*`/`nx/` | e2e | same | `src/nx-free-runtime.e2e.spec.ts` | green (CI PR #41) |
| 28-02-* | 02 | 2 | VER-04 SC-2 | T-28 cmd-injection | tarball e2e on Windows (Node 24) with Verdaccio ECONNREFUSED robustness | CI | `e2e-windows` job (`nx run-many -t e2e -p "$PROJECT"` on windows-latest) | `.github/workflows/ci.yml` `e2e-windows` | green (CI PR #41) |
| 28-02-* | 02 | 2 | VER-04 (guard) | T-28 cmd-injection | OS-axis + matrix wiring cannot silently drift | unit | `nx test angular-typechecker` (GUARD-01b + GUARD-01f) | `src/ci-e2e-coverage-guard.spec.ts` | green (local 20/20 + CI) |
| 28-03-* | 04 | 3 | VER-05 | T-28 untrusted-clone | shipped bin at real tsconfigs in on-stack Angular 22 clones (both kinds): RED / GREEN / bad-path->2 | manual UAT | human-run / autonomous per `28-04-UAT.md` | `28-04-UAT.md` | green (5/5 PASS, autonomous) |

*Status legend: pending / green / red / flaky. All rows green post-execution.*

---

## Post-Execution Nyquist Coverage Verdict (retroactive audit, 2026-07-17)

The Nyquist question: is every load-bearing shipped-artifact behavior sampled by at least one test cell that can fail on a regression, with no under-sampled gap that could green-mask? Scored per success criterion.

| # | Success criterion (the phase "signal") | Verdict | Evidence cell(s) | CI proof |
|---|-----------------------------------------|---------|------------------|----------|
| 1 | Shipped bins (`angular-typechecker` + `atc` + `npx angular-typechecker`) return literal 0/1/2 through the real PM `.bin` shim across npm + yarn (flat+workspace) + pnpm | **COVERED** | npm: `cli-exit-codes.e2e.spec.ts` (both bins + npx; 0 clean, 0 multi-`-c` union, 2 infra, 2 unknown-flag, 2 missing-`-c`, 1 planted TS2322). yarn: `cli-exit-codes-yarn.e2e.spec.ts` `.each(['flat','workspace'])` (both bins; 0/1/2). pnpm: `cli-exit-codes-pnpm.e2e.spec.ts` (both bins; 0/1/2) | `e2e (angular-typechecker-cli-e2e)` + `e2e-windows` SUCCESS |
| 2 | The tarball e2e runs on BOTH Linux AND Windows (Node 24) | **COVERED** | Linux: `angular-typechecker-cli-e2e` is an enumerated e2e project -> auto-covered by the dynamic `e2e` matrix (ubuntu-latest, Node 24). Windows: dedicated `e2e-windows` job (windows-latest, Node 24) runs the same project; wiring locked by GUARD-01f (job exists + windows-latest + `run-many -t e2e -p "$PROJECT"` + `PROJECT=angular-typechecker-cli-e2e` + in `ci` needs + also enumerated on Linux) | `e2e (angular-typechecker-cli-e2e)` (Linux) + `e2e-windows` (Windows) SUCCESS; GUARD-01f 4/4 pass |
| 3 | Output never matches `/ERR_REQUIRE_ESM/`; a module-graph probe confirms the installed bin's require cache never reaches `@nx/*`/`nx/` | **COVERED** | ERR_REQUIRE_ESM negative asserted on every RED run in all three PM specs. Runtime require-cache probe: `nx-free-runtime.e2e.spec.ts` runs `node -r <hook> bin.js -c tsconfig.json` and asserts `loadedNx === []` (no `@nx/*`/`nx/` in `require.cache`) AND output !~ `/ERR_REQUIRE_ESM/`; complements Phase 27's STATIC dist require-graph walk | `e2e (angular-typechecker-cli-e2e)` SUCCESS |
| 4 | Manual real-clone UAT: shipped bins at real tsconfigs in on-stack Angular 22 clones of BOTH kinds (Nx + Angular CLI), planted RED / clean GREEN / bad-path->2 | **COVERED** (manual gate, executed) | `28-04-UAT.md` 5/5 PASS: Angular CLI kind = `bluehalo/ngx-leaflet@818e9ae` (app+lib) + `realworld-angular@9e3528f` (app-only pnpm); Nx kind = `radix-ng/primitives@4a7390a2` (primary, reference-walk + NG8xxx) + `analogjs/analog@5b0b8b66` (alt). RED/GREEN/BAD-PATH each; NO ERR_REQUIRE_ESM / infra error on any run. One documented EXTERNAL caveat (analog's own unbuilt-monorepo TS2882) -- not a tool defect | Manual (D-08); the CI-authoritative VER-04 proves the identical exit-code contract deterministically |

### Tests generated by this audit: 0

Coverage was already complete. Generating additional cells would be redundant against the existing specs (YAGNI, per the phase instruction "do NOT create redundant tests").

### Considered-and-rejected candidate (documented, not a gap)

- **`npx angular-typechecker` at exit 1 (RED).** npx is exercised at exit 0 and exit 2 on the npm spec but not at exit 1. Not a gap: `npx angular-typechecker` resolves the SAME `node_modules/.bin/angular-typechecker` shim already proven at exit 1 by both bin names, and npx's exit-code pass-through is sampled at 0 and 2 (which bracket 1 -- no aliasing risk on the propagation signal). A dedicated npx-RED cell would only re-prove an already-covered wrapper behavior.

---

## Wave 0 Requirements (all shipped)

- [x] `e2e/angular-typechecker-cli-e2e/project.json` -- `e2e` + `typecheck` targets, `parallelism:false`, `dependsOn` build, `type:e2e` tag (VER-04; satisfies GUARD-01/01c/01d/01e/01b/01f)
- [x] `e2e/angular-typechecker-cli-e2e/vitest.config.mts` -- serialized node-env shape
- [x] `e2e/angular-typechecker-cli-e2e/src/global-setup.ts` -- `createVerdaccioGlobalSetup({ label })`
- [x] `e2e/angular-typechecker-cli-e2e/fixtures/cli-consumer/` -- on-stack Angular 22 fixture (peers + lockfile + clean tsconfig(s) + clean component + spec leaf; planted-error variants injected at runtime into a tmp copy)
- [x] `src/cli-exit-codes*.e2e.spec.ts` (npm / yarn / pnpm) + `src/nx-free-runtime.e2e.spec.ts`
- [x] `.github/workflows/ci.yml` -- `e2e-windows` job added + wired into the `ci` aggregate `needs` (research recommendation: option b, separate job)
- [x] `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` -- GUARD-01f added for the OS-axis wiring (4 assertions)
- [x] Bounded ECONNREFUSED retry in the Verdaccio global-setup path (D-06)
- [x] `28-04-UAT.md` manual-UAT artifact (VER-05) -- executed 5/5 PASS
- [x] `libs/test-util/src/lib/cli-e2e.ts` shared `runShim` helper (reused across the 3 PM specs)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Shipped bin at real project tsconfigs in real on-stack Angular 22 OSS clones (both kinds) | VER-05 | Uncommitted, SHA-pinned real OSS clones; repos move, so clones are not committable CI fixtures | `28-04-UAT.md`: clone + `git checkout <sha>`; run shipped `.bin` at a real tsconfig -> clean GREEN (0); plant a known TS/NG diagnostic -> RED (1, code in stdout); bad tsconfig path -> 2. Angular-CLI kind: `ngx-leaflet @818e9ae`, `realworld-angular @9e3528f`. Nx kind: `radix-ng/primitives @4a7390a2` (primary), `analogjs/analog @5b0b8b66` (alt) -- FRESH SHAs pinned at run time. Executed autonomously 2026-07-17, 5/5 PASS. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (VER-05 is the one deliberate manual)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency acceptable for an e2e-tier phase (~300s per cell)
- [x] `nyquist_compliant: true` set in frontmatter (flipped post-execution by the retroactive Nyquist audit)

**Approval:** APPROVED (2026-07-17). Nyquist audit: 4/4 criteria COVERED, 0 gaps, 0 tests generated. CI PR #41 all-green (Linux `e2e (angular-typechecker-cli-e2e)` + `e2e-windows` + every `test` cell + `ci` aggregate). VER-05 UAT executed 5/5 PASS.
