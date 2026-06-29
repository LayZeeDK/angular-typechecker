# Roadmap: angular-typechecker

## Milestones

- [SHIPPED] **v0.0.1** -- Phases 1-7 (incl. inserted 5.1) -- shipped 2026-06-29. Complete Angular type-check (TS + template + extended NG8xxx), no-emit, decoupled from build/test, as a cacheable Nx executor published to npm. Full detail: `.planning/milestones/v0.0.1-ROADMAP.md`.
- [ACTIVE] **v0.0.3** -- Phases 8-10 -- Engine hardening. Harden the EXISTING whole-program no-emit `runTypecheck` engine: close correctness/completeness holes, make diagnostic gathering resilient instead of all-or-nothing, and make Angular-version drift fail loudly. Verified against stable Angular 22.0.4; NO `NgtscProgram` migration, NO new feature surfaces.

## Phases

<details>
<summary>[SHIPPED] v0.0.1 (Phases 1-7, incl. 5.1) -- SHIPPED 2026-06-29</summary>

- [x] Phase 1: Workspace Bootstrap + Engine Spike (GATED) (4/4 plans) -- completed 2026-06-27
- [x] Phase 2: Core Type-Check Engine + Gatherer (3/3 plans) -- completed 2026-06-27
- [x] Phase 3: Filtering, Modes, Output + Quality Gates (4/4 plans) -- completed 2026-06-27
- [x] Phase 4: Nx Executor Adapter + Cacheable Target (3/3 plans) -- completed 2026-06-28
- [x] Phase 5: Packaging, Publish Hardening + e2e Smoke (MVP) (5/5 plans) -- completed 2026-06-28
- [x] Phase 5.1: 0.0.2 first OIDC steady-state publish verification (INSERTED) (1/1 plan) -- completed 2026-06-29
- [x] Phase 6: Full e2e Matrix + CI (5/5 plans) -- completed 2026-06-29
- [x] Phase 7: Release-PR workflow and clean changelog (4/4 plans) -- completed 2026-06-29

Full phase detail (goals, success criteria, decisions): `.planning/milestones/v0.0.1-ROADMAP.md`

</details>

### v0.0.3 -- Engine hardening (active)

- [ ] **Phase 8: Correctness & Completeness Fixes** - Close the under-report / mis-classify holes: detect config-resolution infra crashes, surface global TS diagnostics, stop dropping empty-`fileName` diagnostics, and classify infra-vs-type failures via a pure core exit-code policy (literal OS exit code delivered by the deferred standalone CLI; the Nx executor surfaces infra distinctly within its `{ success }` contract).
- [ ] **Phase 9: Resilience (per-file fault isolation + boundary robustness)** - GATED spike decides the isolation shape, then per-file fault isolation so one `FatalDiagnosticError` does not abandon the rest, plus a try/catch realpath and `suppressOutputPathCheck`.
- [ ] **Phase 10: Drift-hardening & Maintainability** - Make an Angular upgrade that changes the `api.Program` getter set or error-code encoding break CI loudly: a build-time drift tsconfig + CI target, the `EmitFlags` fix, vendor markers, the retained-getter-under-assertion, and a no-TS-99-leak regression spec.

## Phase Details

### Phase 8: Correctness & Completeness Fixes

**Goal**: The engine reports the diagnostics it currently misses and classifies a config-resolution crash as infrastructure (not a type error), so a "clean" verdict is never a false negative and CI/agents can tell a crash apart from real type errors.
**Depends on**: Nothing (independent cluster; the engine from v0.0.1 already exists)
**Requirements**: COR-01, COR-02, COR-03, COR-04
**Success Criteria** (what must be TRUE):
  1. A tsconfig with a broken `extends`/host (an `UNKNOWN_ERROR_CODE` 500 diagnostic in `readConfiguration().errors`) is re-thrown as `TypecheckInfrastructureError` and is NEVER counted as a type error or folded into the reported diagnostics (proven by a failing-then-passing test against a broken-config fixture).
  2. A global / location-less TypeScript semantic diagnostic (e.g. TS2318) that the per-file path never emitted now appears in the reported diagnostics (proven by a fixture that triggers a global TS diagnostic).
  3. A diagnostic whose `file.fileName` is present-but-empty is reported (treated as file-less), never silently dropped by the project-boundary filter (proven by an empty-`fileName` diagnostic test).
  4. The engine classifies an infrastructure failure distinctly from a type-error failure and exposes a pure, framework-agnostic exit-code policy (`toExitCode` -> `0` clean / `1` type-error / `2` infra, ngc-parallel) covered by tests; the Nx executor surfaces an infra failure distinctly WITHIN Nx's `{ success: boolean }` contract (typed `TypecheckInfrastructureError` + distinct operator message; Nx maps to exit 1) and a real type-error failure keeps its existing `{ success: false }` behavior. The literal distinct OS exit code (`2`) is delivered by the standalone CLI surface (deferred), which owns its process and consumes the same policy -- NOT by the Nx executor, which Nx hard-maps to 0/1 (verified nx 23.0.1: `run.ts:72`, `command-object.ts:30`). [Reframed 2026-06-29 -- see `08-CONTEXT.md` D-07..D-10.]
**Plans**: 3 plans (1 wave, all parallel -- disjoint files)

Plans:
- [x] 08-01-PLAN.md -- COR-01: early parsed.errors 500 scan re-throws TypecheckInfrastructureError before the zero-rootNames guard (+ unit twin + nonexistent-path integration)
- [ ] 08-02-PLAN.md -- COR-02: gather getTsProgram().getGlobalDiagnostics() (7th getter) + global-diagnostics TS2318 fixture + unit/integration proof
- [ ] 08-03-PLAN.md -- COR-03 (empty-fileName guard kept) + COR-04 (pure core/exit-codes.ts toExitCode 0/1/2 + tightened executor distinct-message assertion)

### Phase 9: Resilience (per-file fault isolation + boundary robustness)

**Goal**: The engine reports as much as it can instead of aborting on a single bad component, a throwing `realpath()`, or an output-path nuisance -- with the per-file isolation shape settled by a gate before any isolation code is written.
**Depends on**: Nothing on the other clusters; INTERNAL gate -- RES-01 (spike) MUST be the first plan and gates RES-02.
**Requirements**: RES-01, RES-02, RES-03, RES-04
**Success Criteria** (what must be TRUE):
  1. (GATE) The RES-01 spike produces a recorded GO decision on the per-file isolation shape -- simple per-file `getNgSemanticDiagnostics(fileName)` loop vs. HYBRID (gather the file-less non-template `traitCompiler`/`checkForPrivateExports` set ONCE whole-program + loop the template/extended families per file) -- settling whether any Angular non-template diagnostics are file-less and would be dropped by a naive `d.file === file` per-file filter. RES-02 does not start until this returns GO.
  2. One component's `FatalDiagnosticError` yields exactly one diagnostic and does NOT abandon the remaining files' Angular diagnostics -- the surviving files' template/extended diagnostics are still reported (proven by a multi-file fixture where one component throws), implemented on the existing `api.Program` surface per the RES-01 decision (no `NgtscProgram` migration).
  3. A throwing `options.realpath()` in the project-boundary filter is caught and falls back to the unresolved path, so a filesystem realpath failure cannot abort the whole type-check pass (proven by a realpath-throws test; the happy path is unchanged).
  4. The no-emit options override sets `suppressOutputPathCheck: true`, so output-path configuration nuisance errors never surface in the type-only flow (verified safe under `noEmit: true`).
**Plans**: TBD

### Phase 10: Drift-hardening & Maintainability

**Goal**: An Angular upgrade that changes the `api.Program` getter set, the EmitFlags enum, or the NG error-code encoding breaks `nx`/CI LOUDLY (a build failure) instead of silently under-gathering -- and every vendored-shim divergence is documented and greppable.
**Depends on**: Nothing (independent cluster). Touches the vendored `compiler-cli-types.ts` shim + a new drift tsconfig/CI target; should land near the end so it asserts against the getter set the COR/RES work leaves in place.
**Requirements**: HARD-01, HARD-02, HARD-03, HARD-04, HARD-05
**Success Criteria** (what must be TRUE):
  1. A dedicated `tsconfig.drift.json` (classic `moduleResolution: node`) is type-checked in CI as its own target (preferably a `typecheck-drift` target) and FAILS the build when the vendored `Program` shim stops being assignable FROM the real `@angular/compiler-cli` `api.Program` -- a new or removed diagnostic getter, or a changed `ngErrorCode`/`UNKNOWN_ERROR_CODE` encoding, breaks CI (real->shim direction only; the shim is a deliberate subset).
  2. The shim's fabricated `EmitFlags.None = 0` member is corrected against the real enum, while the `emitFlags: 0` call site is retained as a documented literal (verified safe under `noEmit: true`).
  3. Every divergence in the vendored type surface carries a greppable `// angular-typechecker: vendored -- <reason>` marker comment (Prettier `angular-estree-parser` idiom), discoverable by a single grep.
  4. The `getNgStructuralDiagnostics()` call is retained as a documented, deliberately forward-compatible no-op-tolerant call AND is covered by the HARD-01 getter-set assertion, so a future Angular version that reactivates it cannot silently under-gather.
  5. A regression spec asserts that no `TS-99` substring (a raw, un-rewritten negative NG code) survives the `color: false` output path.
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Workspace Bootstrap + Engine Spike (GATED) | v0.0.1 | 4/4 | Complete | 2026-06-27 |
| 2. Core Type-Check Engine + Gatherer | v0.0.1 | 3/3 | Complete | 2026-06-27 |
| 3. Filtering, Modes, Output + Quality Gates | v0.0.1 | 4/4 | Complete | 2026-06-27 |
| 4. Nx Executor Adapter + Cacheable Target | v0.0.1 | 3/3 | Complete | 2026-06-28 |
| 5. Packaging, Publish Hardening + e2e Smoke (MVP) | v0.0.1 | 5/5 | Complete | 2026-06-28 |
| 5.1 0.0.2 first OIDC steady-state publish verification (INSERTED) | v0.0.1 | 1/1 | Complete | 2026-06-29 |
| 6. Full e2e Matrix + CI | v0.0.1 | 5/5 | Complete | 2026-06-29 |
| 7. Release-PR workflow and clean changelog | v0.0.1 | 4/4 | Complete | 2026-06-29 |
| 8. Correctness & Completeness Fixes | v0.0.3 | 1/3 | In Progress|  |
| 9. Resilience (per-file fault isolation + boundary robustness) | v0.0.3 | 0/? | Not started | - |
| 10. Drift-hardening & Maintainability | v0.0.3 | 0/? | Not started | - |
