# Roadmap: angular-typechecker

## Milestones

- [SHIPPED] **v0.0.1** -- Phases 1-7 (incl. inserted 5.1) -- shipped 2026-06-29. Complete Angular type-check (TS + template + extended NG8xxx), no-emit, decoupled from build/test, as a cacheable Nx executor published to npm. Full detail: `.planning/milestones/v0.0.1-ROADMAP.md`.
- [SHIPPED] **v0.0.3** -- Phases 8-11 -- shipped 2026-06-30. Engine hardening: closed correctness/completeness holes, made diagnostic gathering resilient instead of all-or-nothing, made Angular-version drift fail loudly, and adopted `fallow` as a green-on-adoption CI quality gate. Full detail: `.planning/milestones/v0.0.3-ROADMAP.md`.
- [SHIPPED] **v0.1.0** -- Phases 12-15 (incl. inserted 13.1) -- shipped 2026-07-02. Reference-walking engine, the typecheck executor rename, and the configuration + init generator suite. Full detail: `.planning/milestones/v0.1.0-ROADMAP.md`.
- [SHIPPED] **v0.2.0** -- Phases 16-20 -- shipped 2026-07-07. Storybook story type-checking via one boundary-filter correctness fix (directory-containment -> compiler input-set membership), across both Nx-official layouts, with no silent false pass. Full detail: `.planning/milestones/v0.2.0-ROADMAP.md`.
- [SHIPPED] **v0.2.1** -- Phases 21-24 -- shipped 2026-07-16. Angular CLI (`angular.json`) workspace support: `ng add`/`ng generate`/`ng run` for the typecheck target, additive-only beside the existing Nx surface, proven against real OSS Angular 22 workspaces. Full detail: `.planning/milestones/v0.2.1-ROADMAP.md`.
- [SHIPPED] **v0.2.2** -- Phases 25-29 -- shipped 2026-07-17. Standalone `angular-typechecker` / `atc` CLI binary: a third thin adapter over the same `runTypecheck` core that runs the complete Angular type-check outside Nx and the Angular CLI, owning the literal OS exit codes `0`/`1`/`2`. Additive-only patch bump (`0.2.1 -> 0.2.2`). Full detail: `.planning/milestones/v0.2.2-ROADMAP.md`.
- [SHIPPED] **v0.2.3** -- Phases 30-32 -- shipped 2026-07-20. Machine-readable output -- JSON (agent-parseable) and SARIF 2.1.0 (GitHub Code Scanning `upload-sarif`) -- across all three adapters (Nx executor, Angular CLI builder, standalone CLI) over the one shared `runTypecheck` core, so AI coding agents and CI can consume the complete diagnostic set as data. Additive-only patch bump (`0.2.2 -> 0.2.3`). Full detail: `.planning/milestones/v0.2.3-ROADMAP.md`.

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

- [x] Phase 8: Correctness & Completeness Fixes (3/3 plans) -- completed 2026-06-29
- [x] Phase 9: Resilience (per-file fault isolation + boundary robustness) (5/5 plans) -- completed 2026-06-29
- [x] Phase 10: Drift-hardening & Maintainability (4/4 plans) -- completed 2026-06-29
- [x] Phase 11: Fallow code-quality CI gate (2/2 plans) -- completed 2026-06-30

Full phase detail (goals, success criteria, decisions): `.planning/milestones/v0.0.3-ROADMAP.md`

</details>

<details>
<summary>[SHIPPED] v0.1.0 -- reference-walking engine, typecheck executor rename, and the configuration + init generator suite (Phases 12-15, incl. inserted 13.1) -- SHIPPED 2026-07-02</summary>

- [x] Phase 12: Extended-diagnostic catalog + completeness tripwire (4/4 plans) -- completed 2026-07-01
- [x] Phase 13: Engine -- solution-tsconfig reference-walking (6/6 plans) -- completed 2026-07-01
- [x] Phase 13.1: Rename angular-typecheck executor to typecheck (INSERTED) (1/1 plan) -- completed 2026-07-01
- [x] Phase 14: configuration + init generators, nx add (3/3 plans) -- completed 2026-07-02
- [x] Phase 15: Generator e2e + CI self-audit guard (2/2 plans) -- completed 2026-07-02

Full phase detail (goals, success criteria, decisions): `.planning/milestones/v0.1.0-ROADMAP.md`

</details>

<details>
<summary>[SHIPPED] v0.2.0 -- Storybook story type-checking (Phases 16-20) -- SHIPPED 2026-07-07</summary>

- [x] Phase 16: Storybook type-check gate spike (GATED, GO/NO-GO) -- completed 2026-07-05 (GO)
- [x] Phase 17: Input-set-membership boundary + layout support (7/7 plans) -- completed 2026-07-06
- [x] Phase 18: Packaged-tarball e2e + docs (5/5 plans) -- completed 2026-07-06
- [x] Phase 19: Stretch -- Layout C / non-TS story formats / strict mode (3/3 plans) -- completed 2026-07-07
- [x] Phase 20: Vite/Analog Storybook query-import guidance (5/5 plans) -- completed 2026-07-07

Full phase detail (goals, success criteria, decisions): `.planning/milestones/v0.2.0-ROADMAP.md`

</details>

<details>
<summary>[SHIPPED] v0.2.1 -- Angular CLI workspace support (Phases 21-24) -- SHIPPED 2026-07-16</summary>

- [x] Phase 21: Angular CLI builder engine (multi-tsConfig, GATE A' spike GO/NO-GO) (3/3 plans) -- completed 2026-07-11 -- ENG-01, ACB-01/02/03: GATE A' = GO against a real `bluehalo/ngx-leaflet` clone; `tsConfig` widened to `string | string[]`.
- [x] Phase 22: Configuration schematic -- the angular.json write-fork (2/2 plans) -- completed 2026-07-11 -- ACS-01/02/04, COV-01: `ng generate ...:configuration` wires `tsConfig: [buildLeaf, specLeaf]` into `angular.json`.
- [x] Phase 23: Init schematic parity + first-party ng-add (3/3 plans) -- completed 2026-07-12 -- ACS-03, NGADD-01, ACP-01: `ng generate ...:init` parity, optional peer classification, `ng-add` auto-wire-all (first iteration).
- [x] Phase 24: Real-OSS + scaffolded e2e, additive-only audit, docs (6/6 plans, incl. 3 gap-closure) -- completed 2026-07-15 -- ACV-01/02/03, ACP-02, ACD-01 + gap-closure NGADD-01 (yarn `nx` peer + nx-free vanilla `ng-add`).

Full phase detail (goals, success criteria, decisions): `.planning/milestones/v0.2.1-ROADMAP.md`

</details>

<details>
<summary>[SHIPPED] v0.2.2 -- Standalone CLI (Phases 25-29) -- SHIPPED 2026-07-17</summary>

- [x] Phase 25: Extract the advisory-notice seam (1/1 plans) -- completed 2026-07-16 -- CLI-04
- [x] Phase 26: Pure CLI core + exit-code wiring (3/3 plans) -- completed 2026-07-16 -- CLI-02/03, ARGS-01..05, EXIT-01/02, PKG-03, VER-01/02
- [x] Phase 27: Bin shell + cross-platform packaging (3/3 plans) -- completed 2026-07-16 -- CLI-01, PKG-01/02, VER-03, ADD-01
- [x] Phase 28: Shipped-tarball e2e + real-clone UAT (4/4 plans) -- completed 2026-07-17 -- VER-04, VER-05
- [x] Phase 29: Docs (1/1 plans) -- completed 2026-07-17 -- DOC-01

Full phase detail (goals, success criteria, decisions): `.planning/milestones/v0.2.2-ROADMAP.md`

</details>

<details>
<summary>[SHIPPED] v0.2.3 -- Machine-readable reporters (Phases 30-32) -- SHIPPED 2026-07-20</summary>

- [x] Phase 30: Reporter seam + JSON reporter + `--format` threading + observability (3/3 plans) -- completed 2026-07-18
- [x] Phase 31: SARIF reporter (2/2 plans) -- completed 2026-07-18
- [x] Phase 32: Verification + docs + additive audit (4/4 plans) -- completed 2026-07-19

Full phase detail (goals, success criteria, decisions): `.planning/milestones/v0.2.3-ROADMAP.md`

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
| ----- | --------- | --------------- | ------ | --------- |
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
| 12. Extended-diagnostic catalog + completeness tripwire | v0.1.0 | 4/4 | Complete | 2026-07-01 |
| 13. Engine -- solution-tsconfig reference-walking | v0.1.0 | 6/6 | Complete | 2026-07-01 |
| 13.1 Rename angular-typecheck executor to typecheck (INSERTED) | v0.1.0 | 1/1 | Complete | 2026-07-01 |
| 14. configuration + init generators, nx add | v0.1.0 | 3/3 | Complete | 2026-07-02 |
| 15. Generator e2e + CI self-audit guard | v0.1.0 | 2/2 | Complete | 2026-07-02 |
| 16. Storybook type-check gate spike (GATED) | v0.2.0 | spike 006-008 | Complete (GO) | 2026-07-05 |
| 17. Input-set-membership boundary + layout support | v0.2.0 | 7/7 | Complete | 2026-07-06 |
| 18. Packaged-tarball e2e + docs | v0.2.0 | 5/5 | Complete | 2026-07-06 |
| 19. Stretch (Layout C / non-TS formats / strict mode) | v0.2.0 | 3/3 | Complete | 2026-07-07 |
| 20. Vite/Analog Storybook query-import guidance | v0.2.0 | 5/5 | Complete | 2026-07-07 |
| 21. Angular CLI builder engine (multi-tsConfig, GATE A') | v0.2.1 | 3/3 | Complete | 2026-07-11 |
| 22. Configuration schematic -- the angular.json write-fork | v0.2.1 | 2/2 | Complete | 2026-07-11 |
| 23. Init schematic parity + first-party ng-add | v0.2.1 | 3/3 | Complete | 2026-07-12 |
| 24. Real-OSS + scaffolded e2e, additive-only audit, docs | v0.2.1 | 6/6 | Complete | 2026-07-15 |
| 25. Extract the advisory-notice seam | v0.2.2 | 1/1 | Complete | 2026-07-16 |
| 26. Pure CLI core + exit-code wiring | v0.2.2 | 3/3 | Complete | 2026-07-16 |
| 27. Bin shell + cross-platform packaging | v0.2.2 | 3/3 | Complete | 2026-07-16 |
| 28. Shipped-tarball e2e + real-clone UAT | v0.2.2 | 4/4 | Complete | 2026-07-17 |
| 29. Docs | v0.2.2 | 1/1 | Complete | 2026-07-17 |
| 30. Reporter seam + JSON reporter + `--format` threading + observability | v0.2.3 | 3/3 | Complete    | 2026-07-18 |
| 31. SARIF reporter | v0.2.3 | 2/2 | Complete    | 2026-07-18 |
| 32. Verification + docs + additive audit | v0.2.3 | 4/4 | Complete   | 2026-07-19 |

## Backlog

- **GitHub-backed self-hosted Nx remote cache** -- a workspace-wide CI cache optimization proposed and then removed from the v0.2.1 roadmap (was Phase 25) as lower priority than the already-shipped e2e per-project matrix split (~41% faster). Grounded by `260715-050-RESEARCH-3.md` (GitHub Actions Cache backend, CREEP-mitigated). Requires fixing the OS/Node hash landmine (`RUNNER_OS` + Node major as `env` named inputs) before any cache replay.
