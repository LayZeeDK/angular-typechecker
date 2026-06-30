# Roadmap: angular-typechecker

## Milestones

- [SHIPPED] **v0.0.1** -- Phases 1-7 (incl. inserted 5.1) -- shipped 2026-06-29. Complete Angular type-check (TS + template + extended NG8xxx), no-emit, decoupled from build/test, as a cacheable Nx executor published to npm. Full detail: `.planning/milestones/v0.0.1-ROADMAP.md`.
- [SHIPPED] **v0.0.3** -- Phases 8-11 -- shipped 2026-06-30. Engine hardening: closed correctness/completeness holes, made diagnostic gathering resilient instead of all-or-nothing, made Angular-version drift fail loudly, and adopted `fallow` as a green-on-adoption CI quality gate. Verified against stable Angular 22.0.4; NO `NgtscProgram` migration, NO new feature surfaces. Full detail: `.planning/milestones/v0.0.3-ROADMAP.md`.
- [NEXT] **v0.0.4 (TBD)** -- not yet scoped. Run `/gsd-new-milestone` to start. Natural candidates: `createNodesV2` inferred targets, machine-readable reporters (JSON/SARIF), the `NgtscProgram` incremental engine + REP-RES-02b, or `nx add`/`ng add` schematics.

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

<details>
<summary>[SHIPPED] v0.0.3 -- Engine hardening (Phases 8-11) -- SHIPPED 2026-06-30</summary>

- [x] Phase 8: Correctness & Completeness Fixes (3/3 plans) -- completed 2026-06-29 -- COR-01..04: config-resolution 500 re-thrown as infrastructure, global TS diagnostics via `getGlobalDiagnostics()`, empty-`fileName` diagnostics kept, pure core `toExitCode` 0/1/2 policy.
- [x] Phase 9: Resilience (per-file fault isolation + boundary robustness) (5/5 plans) -- completed 2026-06-29 -- RES-01..04: GATED spike -> HYBRID per-file fault isolation (one `FatalDiagnosticError` no longer collapses the run) + loud TCB-abort notice, `realpath()` try/catch, `suppressOutputPathCheck`.
- [x] Phase 10: Drift-hardening & Maintainability (4/4 plans) -- completed 2026-06-29 -- HARD-01..05: build-time `tsconfig.drift.json` + `typecheck-drift` CI target, `EmitFlags` fix, vendor markers, retained no-op getter, no-`TS-99`-leak spec.
- [x] Phase 11: Fallow code-quality CI gate (2/2 plans) -- completed 2026-06-30 -- QUAL-01..03: `fallow@2.103.0` adopted as a path-gated SHA-pinned CI quality gate (new-only, `--format human`, least-privilege `contents: read`), current findings resolved (green on adoption), proven RED on introduced dead code.

Full phase detail (goals, success criteria, decisions): `.planning/milestones/v0.0.3-ROADMAP.md`

</details>

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
| 8. Correctness & Completeness Fixes | v0.0.3 | 3/3 | Complete | 2026-06-29 |
| 9. Resilience (per-file fault isolation + boundary robustness) | v0.0.3 | 5/5 | Complete | 2026-06-29 |
| 10. Drift-hardening & Maintainability | v0.0.3 | 4/4 | Complete | 2026-06-29 |
| 11. Fallow code-quality CI gate | v0.0.3 | 2/2 | Complete | 2026-06-30 |
