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

- [x] **Phase 8: Correctness & Completeness Fixes** - Close the under-report / mis-classify holes: detect config-resolution infra crashes, surface global TS diagnostics, stop dropping empty-`fileName` diagnostics, and classify infra-vs-type failures via a pure core exit-code policy (literal OS exit code delivered by the deferred standalone CLI; the Nx executor surfaces infra distinctly within its `{ success }` contract). (completed 2026-06-29)
- [x] **Phase 9: Resilience (per-file fault isolation + boundary robustness)** - GATED spike decides the isolation shape, then per-file fault isolation so one `FatalDiagnosticError` does not abandon the rest, plus a try/catch realpath and `suppressOutputPathCheck`. (completed 2026-06-29)
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
- [x] 08-02-PLAN.md -- COR-02: gather getTsProgram().getGlobalDiagnostics() (7th getter) + global-diagnostics TS2318 fixture + unit/integration proof
- [x] 08-03-PLAN.md -- COR-03 (empty-fileName guard kept) + COR-04 (pure core/exit-codes.ts toExitCode 0/1/2 + tightened executor distinct-message assertion)

### Phase 9: Resilience (per-file fault isolation + boundary robustness)

**Goal**: The engine reports as much as it can instead of aborting on a single bad component, a throwing `realpath()`, or an output-path nuisance -- with the per-file isolation shape settled by a gate before any isolation code is written.
**Depends on**: Nothing on the other clusters; INTERNAL gate -- RES-01 (spike) MUST be the first plan and gates RES-02.
**Requirements**: RES-01, RES-02, RES-03, RES-04
**Success Criteria** (what must be TRUE):

  1. (GATE) The RES-01 spike produces a recorded GO decision on the per-file isolation shape -- simple per-file `getNgSemanticDiagnostics(fileName)` loop vs. HYBRID (gather the file-less non-template `traitCompiler`/`checkForPrivateExports` set ONCE whole-program + loop the template/extended families per file) -- settling whether any Angular non-template diagnostics are file-less and would be dropped by a naive `d.file === file` per-file filter. RES-02 does not start until this returns GO.
  2. [REFRAMED 2026-06-29 -- see `phases/09-.../09-RES-02-DECISION.md`] One component's `FatalDiagnosticError` yields exactly one diagnostic and does NOT collapse the whole run to an infrastructure error (`UNKNOWN_ERROR_CODE` 500): the run completes and the surviving files' TypeScript and Angular NON-template diagnostics are still reported (proven by a multi-file fixture where one component throws a TCB-generation Fatal), implemented on the existing `api.Program` surface per the RES-01 HYBRID decision (no `NgtscProgram` migration). When a TCB-generation Fatal is detected the engine surfaces a LOUD notice naming the offending file and warning that surviving files' Angular TEMPLATE/extended (NG8xxx) diagnostics may be suppressed until it is fixed -- the incompleteness is never silent. **Known limitation (deferred):** recovering the surviving files' TEMPLATE/extended diagnostics after a TCB-generation Fatal is mechanically impossible on the `api.Program` / `OptimizeFor.WholeProgram` surface (the shared `ensureAllShimsForAllFiles` priming aborts for all files; `@angular/build` has the same limitation; verified at v22.0.4 + a 5-lens panel). It is deferred to the `NgtscProgram` incremental milestone, whose `OptimizeFor.SingleFile`-per-file surface can deliver it faithfully -- tracked as `REQUIREMENTS.md` REP-RES-02b.
  3. A throwing `options.realpath()` in the project-boundary filter is caught and falls back to the unresolved path, so a filesystem realpath failure cannot abort the whole type-check pass (proven by a realpath-throws test; the happy path is unchanged).
  4. The no-emit options override sets `suppressOutputPathCheck: true`, so output-path configuration nuisance errors never surface in the type-only flow (verified safe under `noEmit: true`).

**Plans**: 5 plans (3 waves; the INTERNAL gate encoded as wave order; 09-05 added by the RES-02 reframe)

Plans:
**Wave 1**

- [x] 09-01-PLAN.md -- RES-01 [GATE/spike, wave 1, alone-gating]: probe the live api.Program for file-less non-template diagnostics + author the fault-isolation fixture; record the SIMPLE|HYBRID GO decision (09-RES-01-SPIKE.md)
- [x] 09-03-PLAN.md -- RES-03 [wave 1, parallel]: createCanonicalizer realpath try/catch + raw-path fallback in filter-diagnostics.ts + the throwing-realpath unit case
- [x] 09-04-PLAN.md -- RES-04 [wave 1, parallel]: suppressOutputPathCheck:true to readConfiguration in run-typecheck.ts + the readConfiguration-spy unit + the no-nuisance integration assertion

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 09-02-PLAN.md -- RES-02 [wave 2, depends_on 09-01]: per-file fault-isolated Angular gathering in gather-diagnostics.ts (the RES-01-decided HYBRID shape) + the fault-isolation.integration.spec.ts run-level-resilience proof

**Wave 3** *(RES-02 reframe completion)*

- [x] 09-05-PLAN.md -- RES-02 reframe completion [wave 3, depends_on 09-02]: loud TCB-generation suppression notice (pure-core `CoreResult.templateCheckAborted` set by an NG3004 scan + executor `logger.warn` naming the source file via `normalizeShimFileName`) -- see `09-RES-02-DECISION.md`

### Phase 10: Drift-hardening & Maintainability

**Goal**: An Angular upgrade that changes the `api.Program` getter set, the EmitFlags enum, or the NG error-code encoding breaks `nx`/CI LOUDLY (a build failure) instead of silently under-gathering -- and every vendored-shim divergence is documented and greppable.
**Depends on**: Nothing (independent cluster). Touches the vendored `compiler-cli-types.ts` shim + a new drift tsconfig/CI target; should land near the end so it asserts against the getter set the COR/RES work leaves in place.
**Requirements**: HARD-01, HARD-02, HARD-03, HARD-04, HARD-05
**Success Criteria** (what must be TRUE):

  1. A dedicated `tsconfig.drift.json` (classic `moduleResolution: node`) is type-checked in CI as its own `typecheck-drift` target and FAILS the build when a REMOVED, renamed, or signature-changed diagnostic getter (among the getters the gatherer calls) stops the real `@angular/compiler-cli` `api.Program` being assignable TO the vendored `Program` shim, or when the `ngErrorCode`/`UNKNOWN_ERROR_CODE` encoding changes. Real->shim direction only (the shim is a deliberate subset); newly-ADDED upstream getters are intentionally NOT a build failure and are surfaced instead by the runtime getter-set spec. [D-07 wording fix.]
  2. The shim's fabricated `EmitFlags.None = 0` member is corrected against the real enum, while the `emitFlags: 0` call site is retained as a documented literal (verified safe under `noEmit: true`).
  3. Every divergence in the vendored type surface carries a greppable `// angular-typechecker: vendored -- <reason>` marker comment (Prettier `angular-estree-parser` idiom), discoverable by a single grep.
  4. The `getNgStructuralDiagnostics()` call is retained as a documented, deliberately forward-compatible no-op-tolerant call AND is covered by the HARD-01 getter-set assertion, so a future Angular version that reactivates it cannot silently under-gather.
  5. A regression spec asserts that no `TS-99` substring (a raw, un-rewritten negative NG code) survives the `color: false` output path.

**Plans**: 4 plans (2 waves; the drift target depends on the shim corrections)

Plans:
**Wave 1**

- [x] 10-01-PLAN.md -- HARD-02/03/04: correct the shim EmitFlags enum (mirror real members, drop None) + add greppable vendor markers to all 6 divergent constructs + document the retained getNgStructuralDiagnostics()
- [x] 10-03-PLAN.md -- HARD-01 (runtime half, D-04): runtime getter-set SUBSET-containment + additions-review + NG encoding round-trip spec against the real await import('@angular/compiler-cli')
- [x] 10-04-PLAN.md -- HARD-05: TS-99 leak regression spec via the real cli.formatDiagnostics seam (renderReport color:false; NG#### present, TS-99 absent)

**Wave 2** *(depends on 10-01 shim corrections)*

- [ ] 10-02-PLAN.md -- HARD-01 (build-time half): compiler-cli-types.drift.ts per-member real->shim probes + getTsProgram special-case + call-site probes + value-level UNKNOWN_ERROR_CODE/EmitFlags pins; tsconfig.drift.json; typecheck-drift Nx target + CI wiring; drift-file exclusion from both production tsconfigs; D-07 REQUIREMENTS wording fix

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
| 8. Correctness & Completeness Fixes | v0.0.3 | 3/3 | Complete    | 2026-06-29 |
| 9. Resilience (per-file fault isolation + boundary robustness) | v0.0.3 | 5/5 | Complete    | 2026-06-29 |
| 10. Drift-hardening & Maintainability | v0.0.3 | 3/4 | In Progress|  |
