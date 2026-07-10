---
phase: 21
slug: angular-cli-builder-engine-multi-tsconfig-gate-a-spike-go-no
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-10
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `21-RESEARCH.md` § Validation Architecture. Per-task rows are
> assigned by the planner; this draft locks the requirement→test map + Wave 0.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 via `@nx/vitest:test` |
| **Config file** | `packages/angular-typechecker` (per-project vitest config) |
| **Quick run command** | `nx test angular-typechecker` |
| **Full suite command** | `nx build angular-typechecker && nx test angular-typechecker` (build-before-static-read for `gate-a-static.spec.ts`) |
| **Also required before any Release PR** | `nx run angular-typechecker:format:check` + `nx lint angular-typechecker` (maxWarnings:0) |
| **Estimated runtime** | ~60 seconds (build + test) |

---

## Sampling Rate

- **After every task commit:** Run `nx test angular-typechecker`
- **After every plan wave:** Run `nx build angular-typechecker && nx test angular-typechecker`
- **Phase gate (before `/gsd:verify-work`):** Full suite green AND the GATE A' spike VERDICT = GO recorded in `forensic-log.json`
- **Max feedback latency:** ~60 seconds

---

## Per-Requirement Test Map

*(Task IDs assigned during planning; each row below MUST map to at least one task's `<automated>` verify or a Wave 0 stub.)*

| Requirement | Behavior | Test Type | Automated Command | File |
|-------------|----------|-----------|-------------------|------|
| **ACB-02** | built builder entry retains `import(`, never `require('@angular/compiler-cli')` | unit (static, built artifact) | `nx build angular-typechecker && nx test angular-typechecker` | extend `src/executors/typecheck/gate-a-static.spec.ts` |
| **ACB-02** (GATE) | real `ng run <p>:typecheck` on-stack Ng22 completes, NO `ERR_REQUIRE_ESM` incl. the eager `retrieveProjectConfigurationsWithAngularProjects` prelude | spike-harness (real `bluehalo/ngx-leaflet` clone) | orchestrator harness → `forensic-log.json` (GO/NO-GO) | Wave 0: new spike `.planning/spikes/011-*` |
| **ACB-01** | builder diagnostics + `formatDiagnostics` output + `BuilderOutput.success` IDENTICAL to the Nx executor | unit (structural) + spike-harness parity | thin-wrapper assertion + real `ng run` planted-error parity | Wave 0: new specs |
| **ACB-01** | builder option surface parses under Architect (Pitfall 7) | unit (schema parity) + `ng run` smoke | `nx test` (new `src/builders/typecheck/schema-parity.spec.ts`) + spike `ng run --tsConfig` | Wave 0: new spec |
| **ENG-01** | `tsConfig: string[]` unions per-entry diagnostics + filters over COMBINED input set; single-string byte-unchanged; `["x"]` == `"x"` | integration (hermetic fixture, app+spec leaves, planted errors per leaf) | `nx test angular-typechecker` (new spec mirroring `run-typecheck.integration.spec.ts`) | Wave 0: new spec + fixture |
| **ENG-01** | executor/builder schema `tsConfig` `oneOf` accepts string AND array | unit (schema) | `nx test` (parity specs assert `oneOf`) | Wave 0 |
| **ACB-03** | `nx run <p>:typecheck` resolves after `builders` field lands; `executors` unchanged (`executors ?? builders`) | unit (package.json/executors.json read) + resolve smoke | `nx test` (new regression spec) + existing GUARD-01 resolve | Wave 0: new spec |

---

## Wave 0 Requirements

- [ ] Extend `src/executors/typecheck/gate-a-static.spec.ts` — builder-entry positive `import(` + negative `require(compiler-cli)` (ACB-02)
- [ ] `src/builders/typecheck/schema-parity.spec.ts` — sanitized builder-schema parity vs the executor options interface (ACB-01 / Pitfall 7)
- [ ] Integration spec + hermetic fixture for `tsConfig: string[]` union + combined-input-set boundary + `["x"]`==`"x"` (ENG-01)
- [ ] Nx-surface regression spec (`executors ?? builders`) (ACB-03)
- [ ] Spike `.planning/spikes/011-*` — orchestrator harness + `forensic-log.json` + README for the GATE A' real `ng run` against the Ng22 `bluehalo/ngx-leaflet` clone (ACB-02 GATE)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GATE A' real `ng run` GO/NO-GO | ACB-02 | Requires an external, uncommitted real Angular 22 clone + a full `ng` toolchain install (not committed to CI); it is a spike-harness gate producing forensic evidence | `nx build` → `npm pack` the dist → install the tarball into `D:\projects\github\bluehalo\ngx-leaflet` (no `--legacy-peer-deps`) → hand-wire `architect.typecheck` → `ng run <p>:typecheck` → scan for `ERR_REQUIRE_ESM` / "require() of ES Module" → record VERDICT + repo URL + SHA in `forensic-log.json` |

*The in-repo static byte-assertion, schema-parity, ENG-01 union, and Nx-surface regression are all fully automated (Vitest). Only the real-`ng run` bridge proof is harness/manual.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] GATE A' spike VERDICT = GO recorded before ENG-01 + parity/regression suite proceed
- [ ] `nyquist_compliant: true` set in frontmatter (by gsd-validate-phase post-execution)

**Approval:** pending
