# Roadmap: angular-typechecker

## Milestones

- [SHIPPED] **v0.0.1** -- Phases 1-7 (incl. inserted 5.1) -- shipped 2026-06-29. Complete Angular type-check (TS + template + extended NG8xxx), no-emit, decoupled from build/test, as a cacheable Nx executor published to npm. Full detail: `.planning/milestones/v0.0.1-ROADMAP.md`.
- [SHIPPED] **v0.0.3** -- Phases 8-11 -- shipped 2026-06-30. Engine hardening: closed correctness/completeness holes, made diagnostic gathering resilient instead of all-or-nothing, made Angular-version drift fail loudly, and adopted `fallow` as a green-on-adoption CI quality gate. Full detail: `.planning/milestones/v0.0.3-ROADMAP.md`.
- [SHIPPED] **v0.1.0** -- Phases 12-15 (incl. inserted 13.1) -- shipped 2026-07-02. Reference-walking engine, the typecheck executor rename, and the configuration + init generator suite. Full detail: `.planning/milestones/v0.1.0-ROADMAP.md`.
- [SHIPPED] **v0.2.0** -- Phases 16-20 -- shipped 2026-07-07. Storybook story type-checking via one boundary-filter correctness fix (directory-containment -> compiler input-set membership), across both Nx-official layouts, with no silent false pass. Full detail: `.planning/milestones/v0.2.0-ROADMAP.md`.
- [SHIPPED] **v0.2.1** -- Phases 21-24 -- shipped 2026-07-16. Angular CLI (`angular.json`) workspace support: `ng add`/`ng generate`/`ng run` for the typecheck target, additive-only beside the existing Nx surface, proven against real OSS Angular 22 workspaces. Full detail: `.planning/milestones/v0.2.1-ROADMAP.md`.
- [SHIPPED] **v0.2.2** -- Phases 25-29 -- shipped 2026-07-17. Standalone `angular-typechecker` / `atc` CLI binary: a third thin adapter over the same `runTypecheck` core that runs the complete Angular type-check outside Nx and the Angular CLI, owning the literal OS exit codes `0`/`1`/`2`. Additive-only patch bump (`0.2.1 -> 0.2.2`). Full detail: `.planning/milestones/v0.2.2-ROADMAP.md`.
- [SHIPPED] **v0.2.3** -- Phases 30-32 -- shipped 2026-07-20. Machine-readable output -- JSON (agent-parseable) and SARIF 2.1.0 (GitHub Code Scanning `upload-sarif`) -- across all three adapters (Nx executor, Angular CLI builder, standalone CLI) over the one shared `runTypecheck` core, so AI coding agents and CI can consume the complete diagnostic set as data. Additive-only patch bump (`0.2.2 -> 0.2.3`). Full detail: `.planning/milestones/v0.2.3-ROADMAP.md`.
- [IN PROGRESS] **v0.2.4** -- Phases 33-36 -- Enhanced SARIF reporting for GitHub Code Scanning. Make the Code Scanning integration first-class and continuously PROVEN: richer SARIF (per-project analyses + diagnostic-family rule metadata) plus an automated `gh` CLI proof that the uploaded SARIF lands in Code Scanning with the expected categories, tags, and severities. Only the diagnostic-family rule metadata (Phase 33) touches the published SARIF report and bumps the version (additive patch `0.2.3 -> 0.2.4`); MULTI/PROOF/GATE/DOC are CI/ruleset/docs only (no release).

## Phases

### v0.2.4 -- Enhanced SARIF reporting for GitHub Code Scanning (Phases 33-36, IN PROGRESS)

- [x] **Phase 33: Diagnostic-family SARIF rule metadata** -- catalog one rule per fired ruleId across all families with `properties.tags` + `defaultConfiguration.level` + `help` text (the sole release-bearing SARIF change; additive patch bump) (completed 2026-07-21)
- [x] **Phase 34: Per-project SARIF categories in CI** -- discover executor-using projects, run the CLI per project, merge to one multi-run file with per-run `automationDetails.id`, single `upload-sarif` (CI-only, no release) (completed 2026-07-21)
- [ ] **Phase 35: Automated Code Scanning proof** -- isolated one-per-family fixture outside the Nx graph + a `gh api` poll/assert that expected alerts land with the expected category/tags/severity (CI-only, no release)
- [ ] **Phase 36: Code Scanning gating + Scanned-files documentation** -- promote `code-scanning` (+ proof) to the required `ci` aggregate + enable the "Require code scanning results" ruleset with the planning-only/fork-PR deadlock mitigation, and document the CodeQL-only "Scanned files" limitation

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

## Phase Details (v0.2.4 -- Enhanced SARIF reporting for GitHub Code Scanning)

### Phase 33: Diagnostic-family SARIF rule metadata

**Goal**: Every GitHub Code Scanning alert from angular-typechecker shows a rich, filterable rule -- a diagnostic-family tag, the correct default severity, and inline help text -- across ALL diagnostic families (TypeScript `TSxxxx`, template type-check, extended `NG8xxx`, tool `ATC900x`), shipped as an additive patch bump. This is the SOLE release-bearing change in the milestone.
**Depends on**: Nothing (first v0.2.4 phase; builds on the shipped v0.2.3 SARIF reporter)
**Requirements**: RULE-01, RULE-02, RULE-03, RULE-04
**Success Criteria** (what must be TRUE):

  1. A SARIF report from a run that fires a TypeScript, an external-template, an NG8xxx, and a tool (ATC) diagnostic catalogs one rule per distinct fired `ruleId`, so no Code Scanning alert shows a blank rule description (RULE-01).
  2. Each rule carries a `properties.tags` family tag (`typescript` / `template-type-check` / `extended-diagnostics` / `tool`) so GitHub `tag:` filters group alerts by family (RULE-02).
  3. Each rule carries a `defaultConfiguration.level` matching the observed diagnostic severity so GitHub `severity:` filtering and default alert severity are correct (RULE-03).
  4. Each rule carries SARIF `help.text` (not only `helpUri`) so the alert detail page renders rule help instead of "No rule help available" (RULE-04).
  5. The JSON and human reporter outputs, `DiagnosticRecord`, and the barrel are byte-unchanged (family is derived inside the SARIF path only), and the additive-only audit vs `@0.2.3` passes -- patch bump `0.2.3 -> 0.2.4`, `v0.3.0` escape hatch untriggered.

**Plans**: 2/2 plans complete
**Wave 1**

- [x] 33-01-PLAN.md -- diagnostic-family classifier + on-demand SARIF rule catalog with tags/level/help (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 33-02-PLAN.md -- four-family integration proof over real fixtures + additive-only audit vs `@0.2.3` (wave 2)

### Phase 34: Per-project SARIF categories in CI

**Goal**: angular-typechecker's CI SARIF upload reports one Code Scanning analysis per workspace project that uses the `typecheck` executor -- auto-discovered so the set cannot silently drift -- with zero change to the published package (the reporter stays single-run per invocation; the multi-run merge is assembled CI-side).
**Depends on**: Phase 33
**Requirements**: MULTI-01, MULTI-02
**Success Criteria** (what must be TRUE):

  1. The `code-scanning` CI job uploads ONE merged SARIF file whose runs each carry `automationDetails.id = angular-typecheck/<project>`, landing as distinct per-project analyses in Code Scanning -- single `upload-sarif`, no `category` input (distinct per-run ids avoid GitHub's multi-run-same-category rejection) (MULTI-01).
  2. The reported project set is discovered by filtering for the `angular-typechecker:typecheck` executor (not a plain `--with-target` over-match), so a project that adds or drops the target is covered/dropped with no CI edit (MULTI-02).
  3. An in-plugin drift-guard spec fails loudly if the discovery script's output diverges from an independent enumeration of executor-using projects (mirrors GUARD-01b) (MULTI-02).
  4. The published package is unchanged -- no new dependency, no reporter/API/schema change -- so no version bump.

**Plans**: 1/1 plans complete

**Wave 1**

- [x] 34-01-PLAN.md -- discovery script + generate/merge script + drift-guard/merge-shape specs + code-scanning job rewire (wave 1)

### Phase 35: Automated Code Scanning proof

**Goal**: A CI check continuously PROVES the SARIF -> Code Scanning contract end-to-end -- one known diagnostic per family from an isolated fixture lands as a Code Scanning alert with the expected category, tags, and severity -- and fails red the moment any part of that contract regresses.
**Depends on**: Phase 33, Phase 34
**Requirements**: PROOF-01, PROOF-02
**Success Criteria** (what must be TRUE):

  1. An isolated fixture lives OUTSIDE the Nx project graph (under `tools/`, no `project.json`) emitting exactly one diagnostic per family (typescript; template-type-check via an external `.html`; extended `NG8xxx`; tool `ATC`), so the normal `nx typecheck` gate never touches it (PROOF-01).
  2. A CI job runs the standalone CLI on the fixture, uploads under a dedicated `angular-typecheck-proof` category, and asserts via bounded `gh api` polling on the PR merge-ref (`code-scanning/analyses` + `code-scanning/alerts`) that each expected alert is present -- set-membership of category/tag/severity, not counts (PROOF-01).
  3. The proof check turns red if any expected alert, category, or tag is missing, so a broken SARIF->Code Scanning contract is caught automatically, not manually (PROOF-02).
  4. Proof alerts query on the PR ref and do not pollute the `main` alerts view.

**Plans**: 1/3 plans executed

**Wave 1** *(parallel — disjoint files)*

- [x] 35-01-PLAN.md — isolated one-per-family fixture (outside the Nx graph, no `project.json`) + fallow/Prettier gate scoping + local drift-lock integration spec (wave 1)
- [ ] 35-02-PLAN.md — `tools/ci/assert-code-scanning.mjs` (`gh api` bounded poll + set-membership matcher, fail-loud) + subprocess matcher unit test (wave 1)

**Wave 2** *(blocked on Wave 1)*

- [ ] 35-03-PLAN.md — PR-only, non-fork `code-scanning-proof` ci.yml job (dedicated `angular-typecheck-proof` category, reused SHA-pinned upload, assert step; deliberately absent from the required `ci` aggregate) (wave 2)

### Phase 36: Code Scanning gating + Scanned-files documentation

**Goal**: Make a successful Code Scanning upload part of the merge gate -- both via the required `ci` aggregate and GitHub's "Require code scanning results" ruleset -- WITHOUT deadlocking planning-only or fork PRs, and document the CodeQL-only "Scanned files" limitation as a known GitHub product gap. Enabling the ruleset on `main` is a real-CI-only, spike-gated step verified on a throwaway PR first.
**Depends on**: Phase 33, Phase 34, Phase 35
**Requirements**: GATE-01, GATE-02, DOC-01
**Success Criteria** (what must be TRUE):

  1. The `code-scanning` job (and the proof job) are members of the required `ci` aggregate's `needs[]`; this reverses the deliberate prior exclusion (kept out so an outage could not deadlock merges) and that reversal is documented as acceptable, precedented by `cve-lite` (GATE-01).
  2. The `code-scanning` job is un-path-gated so every PR to `main` -- including a `.planning/`-only PR -- produces a Code Scanning analysis, so the "Require code scanning results" ruleset cannot deadlock a planning-only PR (the status-check path-skip trick alone does NOT satisfy this GitHub-side "analysis exists" check) (GATE-02).
  3. The "Require code scanning results" ruleset for angular-typechecker + fallow is verified live in "Evaluate" mode first and on a throwaway PR before enabling on `main`, the `enforcement: disabled` recovery toggle is documented, and the fork-PR deadlock (read-only token -> upload skipped) is documented (GATE-02).
  4. The README documents that GitHub's tool-status "Scanned files" panel is CodeQL-only telemetry that third-party SARIF cannot populate (with the spike evidence that `run.artifacts` is inert), so the empty panel is a known GitHub limitation, not a defect -- no GitHub Issue filed (DOC-01).

**Plans**: TBD

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
| 33. Diagnostic-family SARIF rule metadata | v0.2.4 | 2/2 | Complete    | 2026-07-21 |
| 34. Per-project SARIF categories in CI | v0.2.4 | 1/1 | Complete    | 2026-07-21 |
| 35. Automated Code Scanning proof | v0.2.4 | 1/3 | In Progress|  |
| 36. Code Scanning gating + Scanned-files documentation | v0.2.4 | 0/? | Not started | - |

## Backlog

- **GitHub-backed self-hosted Nx remote cache** -- a workspace-wide CI cache optimization proposed and then removed from the v0.2.1 roadmap (was Phase 25) as lower priority than the already-shipped e2e per-project matrix split (~41% faster). Grounded by `260715-050-RESEARCH-3.md` (GitHub Actions Cache backend, CREEP-mitigated). Requires fixing the OS/Node hash landmine (`RUNNER_OS` + Node major as `env` named inputs) before any cache replay.
