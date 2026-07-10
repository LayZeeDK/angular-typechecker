---
phase: 21
slug: angular-cli-builder-engine-multi-tsconfig-gate-a-spike-go-no
status: audited
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-10
audited: 2026-07-10
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

| Requirement | Behavior | Test Type | Automated Command | File | Status |
|-------------|----------|-----------|-------------------|------|--------|
| **ACB-02** | built builder entry retains `import(`, never `require('@angular/compiler-cli')` | unit (static, built artifact) | `nx build angular-typechecker && nx test angular-typechecker` | `src/executors/typecheck/gate-a-static.spec.ts` | COVERED |
| **ACB-02** (GATE) | real `ng run <p>:typecheck` on-stack Ng22 completes, NO `ERR_REQUIRE_ESM` incl. the eager `retrieveProjectConfigurationsWithAngularProjects` prelude | spike-harness (real `bluehalo/ngx-leaflet` clone) | orchestrator harness → `forensic-log.json` (GO/NO-GO) | `.planning/spikes/011-builder-ng-run-esm-bridge/` (VERDICT=GO) | COVERED |
| **ACB-01** | builder diagnostics + `formatDiagnostics` output + `BuilderOutput.success` IDENTICAL to the Nx executor | unit (structural) + spike-harness parity | `nx test angular-typechecker` + real `ng run` planted-error parity (spike 011) | `src/builders/typecheck/builder.spec.ts` | COVERED |
| **ACB-01** | builder option surface parses under Architect (Pitfall 7) | unit (schema parity) + `ng run` smoke | `nx test angular-typechecker` + spike `ng run --tsConfig` | `src/builders/typecheck/schema-parity.spec.ts` | COVERED |
| **ENG-01** | `tsConfig: string[]` unions per-entry diagnostics + filters over COMBINED input set; single-string byte-unchanged; `["x"]` == `"x"` | integration (hermetic fixture, app+spec leaves, planted errors per leaf) | `nx run angular-typechecker:integration` | `src/core/multi-tsconfig.integration.spec.ts` (+ WR-02/WR-03 branch + cross-dir mutation-kill) | COVERED |
| **ENG-01** | executor/builder schema `tsConfig` `oneOf` accepts string AND array | unit (schema) | `nx test angular-typechecker` | `src/executors/typecheck/schema-parity.spec.ts` + `src/builders/typecheck/schema-parity.spec.ts` | COVERED |
| **ACB-03** | `nx run <p>:typecheck` resolves after `builders` field lands; `executors` unchanged (`executors ?? builders`) | unit (package.json/executors.json read) + resolve smoke | `nx test angular-typechecker` + existing GUARD-01 resolve | `src/builders/typecheck/nx-surface-regression.spec.ts` | COVERED |

---

## Wave 0 Requirements

- [x] Extend `src/executors/typecheck/gate-a-static.spec.ts` — builder-entry negative `require(compiler-cli)` (ACB-02)
- [x] `src/builders/typecheck/schema-parity.spec.ts` — sanitized builder-schema parity vs the executor options interface (ACB-01 / Pitfall 7)
- [x] Integration spec + hermetic fixture for `tsConfig: string[]` union + combined-input-set boundary + `["x"]`==`"x"` (ENG-01) — strengthened by the WR-02/WR-03 audit below
- [x] Nx-surface regression spec (`executors ?? builders`) (ACB-03)
- [x] Spike `.planning/spikes/011-*` — orchestrator harness + `forensic-log.json` + README for the GATE A' real `ng run` against the Ng22 `bluehalo/ngx-leaflet` clone (ACB-02 GATE) — VERDICT=GO recorded

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GATE A' real `ng run` GO/NO-GO | ACB-02 | Requires an external, uncommitted real Angular 22 clone + a full `ng` toolchain install (not committed to CI); it is a spike-harness gate producing forensic evidence | `nx build` → `npm pack` the dist → install the tarball into `D:\projects\github\bluehalo\ngx-leaflet` (no `--legacy-peer-deps`) → hand-wire `architect.typecheck` → `ng run <p>:typecheck` → scan for `ERR_REQUIRE_ESM` / "require() of ES Module" → record VERDICT + repo URL + SHA in `forensic-log.json` |

*The in-repo static byte-assertion, schema-parity, ENG-01 union, and Nx-surface regression are all fully automated (Vitest). Only the real-`ng run` bridge proof is harness/manual.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] GATE A' spike VERDICT = GO recorded before ENG-01 + parity/regression suite proceed
- [x] `nyquist_compliant: true` set in frontmatter (set post-execution by this audit)

**Approval:** approved (post-execution audit 2026-07-10)

---

## Validation Audit (post-execution — State A, 2026-07-10)

Adversarial audit of the ENG-01 `handleMultiTsConfig` array path against the two
verdict-deciding gaps surfaced by the deep code review (`21-REVIEW.md`). Both were
genuine test gaps on verified-correct implementation code; no implementation change
was needed and none was made.

### Gaps found / resolved / escalated

| Metric | Count |
|--------|-------|
| Gaps found (from 21-REVIEW.md WR-02, WR-03) | 2 |
| Gaps resolved (test added, runs green, mutation-killing) | 2 |
| Gaps escalated (BLOCKER — implementation unmet) | 0 |

### Gap resolutions

| Gap | Requirement | Behavior now covered | File(s) | Status |
|-----|-------------|----------------------|---------|--------|
| **WR-02** | ENG-01 (T-21-05) | (a) a zero-rootNames array entry is recorded as a `zero-root-names` skip that feeds `evaluateResult` → `coverage-incomplete` (never a silent pass); (b) an empty array throws `TypecheckInfrastructureError`; (c) a per-entry `UNKNOWN_ERROR_CODE` (500) via a nonexistent entry re-throws `TypecheckInfrastructureError` even behind a valid leaf | `src/core/multi-tsconfig.integration.spec.ts` (4 new tests) | green |
| **WR-03** | ENG-01 (T-21-05) | mutation-killing combined-input-set proof: two leaves in SIBLING dirs so `finalize`'s base-containment clause CANNOT rescue the second leaf's file. A CONTROL run proves a cross-dir non-member IS suppressed; the combined `[appLeaf, specLeaf]` run keeps the spec leaf's planted TS2345 ONLY via the combined `rootNamePaths` union — so it fails if `handleMultiTsConfig` regressed to first-leaf-only rootNames | `src/core/multi-tsconfig.integration.spec.ts` (2 new tests) + NEW hermetic fixture `fixtures/multi-tsconfig-cross-dir/` | green |

### Files created / modified by this audit

- `packages/angular-typechecker/src/core/multi-tsconfig.integration.spec.ts` — MODIFIED (added 6 tests: WR-02 x4, WR-03 x2)
- `fixtures/multi-tsconfig-cross-dir/app/app.component.ts` — NEW (planted TS2322)
- `fixtures/multi-tsconfig-cross-dir/app/tsconfig.app.json` — NEW
- `fixtures/multi-tsconfig-cross-dir/spec/app.spec.ts` — NEW (planted TS2345, imports the sibling-dir component)
- `fixtures/multi-tsconfig-cross-dir/spec/tsconfig.spec.json` — NEW

No committed fixture was mutated; no `src/**` implementation file was touched.

### Out-of-scope note (not a test-coverage gap)

`21-REVIEW.md` WR-01 (the array-entry zero-root-names advisory reuses the walk's
"solution-tsconfig reference walk" message wording) is a user-facing message-accuracy
WARNING requiring an implementation edit to `executor.ts` `warnSkippedReferences`. It
is NOT a Nyquist test-coverage gap and is outside this audit's remit — deferred to the
developer as a non-blocking WARNING (the verdict itself is correct;
`coverage-incomplete` is proven by the WR-02(a) test above).

### Verification evidence (re-run from clean on-disk state)

- `nx build angular-typechecker` — GREEN
- `nx test angular-typechecker` — 274/274 unit tests GREEN
- `nx run angular-typechecker:integration` — 103/103 GREEN (incl. `multi-tsconfig.integration.spec.ts` now 9 tests)
- `nx lint angular-typechecker` — GREEN (maxWarnings:0)
- `nx format:check` — GREEN (exit 0)
