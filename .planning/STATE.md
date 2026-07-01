---
gsd_state_version: 1.0
milestone: v0.1.0
milestone_name: configuration + init generators, nx add support, and the typecheck executor rename
status: verifying
stopped_at: Phase 13.1 context gathered
last_updated: "2026-07-01T22:09:17.233Z"
last_activity: 2026-07-01
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 11
  completed_plans: 10
  percent: 40
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-01 after v0.0.4 re-scope: reference-walking engine)

**Core value:** Deliver the complete Angular type-check (TypeScript + template type-check + extended NG8xxx) for any project type without building the app or running the tests -- faster, in isolation, and more completely than the build's coupled check or a bare `ngc --noEmit`.
**Current focus:** Phase 13.1 — rename-angular-typecheck-executor-to-typecheck

## Current Position

Phase: 13.1 (rename-angular-typecheck-executor-to-typecheck) — EXECUTING
Plan: 1 of 1
Status: Phase complete — ready for verification
Last activity: 2026-07-01

Progress: [█████████░] 91%

## v0.1.0 Phase Map

| Phase | Name | Requirements | Depends on |
|-------|------|--------------|------------|
| 12 | Extended-diagnostic catalog + completeness tripwire | CAT-01..05, DRIFT-01 | — (engine-only; generator-independent) — DONE |
| 13 | Engine: solution-tsconfig reference-walking | WALK-01, WALK-02 | — (builds on the shipped `performCompilation` engine; spikes 001-005 GO) |
| 14 | typecheck-configuration generator | GEN-01..06 | Phase 13 (wires ONE `typecheck` target relying on the walk) |
| 15 | Generator e2e + CI self-audit guard | GE2E-01, GE2E-02, GUARD-01 | Phase 14 (needs the shipped generator + `generators.json`) |

Sequencing note: engine-walk (13) → generator (14) → e2e (15). Phase 12 (catalog + tripwire) already shipped. Phase 13 teaches the engine to walk a solution `tsconfig.json`'s in-project referenced leaves (union + dedupe, module-boundary-guarded, coarse-cached) — the prerequisite that makes Phase 14's generator thin (ONE `typecheck` target → solution `tsconfig.json`; no per-project-type `tsConfig` detection, no separate spec target). Phase 15 folds the generator e2e into `angular-typechecker-install-e2e` and adds the `-p` set-equality guard. The previously-OPEN GEN-02/03 shape blocker (single-target vs. multiple targets vs. `configurations`, and per-project-type detection) is now RESOLVED by reference-walking: spikes 001-005 all VALIDATED (GO), so the generator wires ONE target and the engine walks the references.

## Accumulated Context

### Roadmap Evolution

- Phase 13.1 inserted after Phase 13: v0.1.0 re-scope: executor rename EXEC-01 + configuration/init generators + nx add; re-versioned v0.0.4 -> v0.1.0

### Decisions

All milestone decisions (v0.0.1 + v0.0.3) are logged in PROJECT.md Key Decisions
(outcomes closed) and in the per-milestone archives:

- v0.0.3 decision summary: `.planning/milestones/v0.0.3-ROADMAP.md` (Milestone Summary) + the phase SUMMARYs under `.planning/milestones/v0.0.3-phases/`.
- v0.0.1 decision log: `.planning/milestones/v0.0.1-ROADMAP.md` + `.planning/milestones/v0.0.1-phases/`.

v0.0.4 testing strategy ratified by a unanimous 8-lens Opus board (record: `.planning/research/v0.0.4-testing/board2/CONSENSUS.md`): in-memory `createTreeWithEmptyWorkspace` substrate (NO bespoke `createFsTree`); single enum-keyed `it.each` catalog over committed fixtures (exact code + category + count + one promotion case; NG8011 out-of-band/not promotable); enum-vs-table completeness tripwire; generator e2e folded into `angular-typechecker-install-e2e` (no Verdaccio, no new e2e project); in-plugin specs auto-route into the existing 6-cell `test` matrix (no `ci.yml` structural change); a `-p` set-equality guard; single required `ci` gate unchanged.

v0.0.4 re-scoped 2026-07-01: spikes 001-005 (`.planning/spikes/MANIFEST.md`, all VALIDATED) proved runtime solution-tsconfig reference-walking feasible on the existing `performCompilation` engine. Added WALK-01/02 (engine, new Phase 13) and reshaped GEN-01/02/03 (the generator, now Phase 14, wires ONE `typecheck` target at the solution `tsconfig.json`). This supersedes the D-03a solution-style short-circuit and the board's decision-B "no executor change" assumption (D1 in-memory generator tests unchanged; it is the executor that changes, not the generator).

- [Phase 12]: Phase 12 Plan 01 (DRIFT-01): the extended-diagnostic completeness tripwire deep-imports ExtendedTemplateDiagnosticName from the sub-barrel @angular/compiler-cli/src/ngtsc/diagnostics under classic resolution -- compiled green on first typecheck-drift run, no leaf-path fallback needed (Assumption A2 resolved).
- [Phase 12]: Phase 12 Plan 01 (D-02): EXTENDED_DIAGNOSTIC_MEMBERS is the single dependency-free as-const source of truth (18 enum VALUES, declaration order) consumed by BOTH the Plan 02 catalog spec and the type-level tripwire; deliberate-RED proof confirmed it fails loudly (TS2344 at the CatalogCoversEnum probe) on drift and returns green when restored.
- [Phase 12]: Phase 12 Plan 04 (CAT-05 / D-10..D-13): DIAGNOSTIC-CATALOG.md is now enum-driven -- the extended section lists all 18 ExtendedTemplateDiagnosticName members (adds NG8011 controlFlowPreventingContentProjection + NG8112 unusedLetDeclaration), notes NG8110/NG8118 as non-enum ErrorCodes, frames NG8011/NG8113 as out-of-band-but-promotable (all 18 promotable via defaultCategory), and replaces the per-version file-split + programmatic-injection test-org guidance with the single enum-keyed it.each + completeness-tripwire decision. The stale un-promotable-exception framing for NG8011 (CONSENSUS D2 / CAT-02 parenthetical) is superseded per D-13 and reconciled at the milestone audit, not re-ratified this phase.
- [Phase 12]: Phase 12 Plan 02 (CAT-01/CAT-02/CAT-04, D-03..D-09): the 18-row extended-diagnostic it.each catalog (extended-catalog.integration.spec.ts) keyed on EXTENDED_DIAGNOSTIC_MEMBERS asserts every member by exact NG() code + DiagnosticCategory + occurrence count against real @angular/compiler-cli@22.0.4; ZERO it.skip rows (all 18 fire from a static fixture, RESEARCH A1 confirmed by a real run). NG8011 is a normal Warning-default promotable row (D-09), not skipped. The single NG8101 promotion proof + count invariant are folded in (D-08); extended.angular13 + extended.promotion deleted (D-07). Two D-03 fixture-count bugs auto-fixed: NG8105 split into its own CommonModule-importing fixture (bare *ngFor co-fires NG8103), and NG8108 uses the static ngSkipHydration="yes" text-attribute trigger ([ngSkipHydration] binding co-fires NG8002).
- [Phase ?]: [Phase 12]: Phase 12 Plan 03 (CAT-03 / D-06/D-07): all 12 baseline TS/NG codes asserted by exact code in a sibling it.each table inside the one catalog of record; NG6100 asserted as a Warning. Two new fixtures (ng-baseline-extra fires 8 NG codes; ng-baseline-import-cycle fires NG3003 via an NgModule declarations cycle under compilationMode: partial -- standalone imports forward-declare and never fire NG3003; NG2005 needs a constructor dependency). baseline.angular13 folded+deleted; TESTING.md integration-spec count 10 -> 8.
- [Phase 13]: Phase 13 Plan 03 (WALK-01): walk-references.ts is the pure core walk (walkReferences + WalkResult + SkippedReference); 90002 not-found code + file-less synthesizer co-located in the walk module; detect-by-code-only 500->90002; returns raw union + summed rootNamesCount + skippedReferences; reuses exported createCanonicalizer/isUnderDir (no duplicate canonicalizer)
- [Phase 13]: Phase 13 Plan 03: the pre-compile canonicalizer sources realpath + useCaseSensitiveFileNames from ts.sys (no per-leaf Program exists yet at boundary-guard time); keeps core pure and is injectable in the stub-driven unit spec
- [Phase 13]: Phase 13 Plan 04 (WALK-01): run-typecheck D-03a three-way split invokes walkReferences; the walk-branch finalize sources useCaseSensitiveFileNames + realpath from ts.sys (no per-leaf Program in runTypecheck); union feeds the single existing finalize (solution-dir basePath, includeDeps once); skippedReferences threaded non-empty-only ([] -> undefined); COR-01 direct 500 path + direct override block byte-unchanged; one sortAndDeduplicateDiagnostics call
- [Phase 13]: Phase 13 Plan 04 (D-02): SkippedReference re-exported from ./core/walk-references via index.ts; executor adapter renders a per-reference advisory logger.warn AFTER the templateCheckAborted block, gated presence-AND-non-empty, verdict unchanged (L-4), no new import. Rewrote the now-stale config-resolution solution-style block to assert the walk (rootNamesCount>0, errorCount 2, two distinct-file TS2322, skippedReferences undefined) so existing coverage does not regress; COR-01 pinning block byte-unchanged
- [Phase ?]: Phase 13.1 (EXEC-01): renamed the shipped Nx executor angular-typechecker:angular-typecheck to angular-typechecker:typecheck (executors.json key, impl dir via git mv, impl/schema paths, schema $id + TS options interface to TypecheckExecutorOptions, default-export to typecheckExecutor, nx.json targetDefaults both id forms with WALK-02 value preserved, all consumers/fixtures/specs/READMEs). Behavior unchanged; committed as breaking feat! (956e657). Human-facing message prefixes moved to package name angular-typechecker:.

### Blockers/Concerns

Carried forward into v0.0.4:

- **RESOLVED (was OPEN — Phase 13 design decision):** the generator's per-project-type `tsConfig`-defaulting shape (originally GEN-02/03) — single target + `--tsConfig` option vs. multiple targets vs. `configurations`, plus the project-type detection method — is no longer open. Spikes 001-005 (`.planning/spikes/MANIFEST.md`, all VALIDATED, GO) resolved it via runtime solution-tsconfig **reference-walking**: the engine (new Phase 13, WALK-01/02) walks the solution `tsconfig.json`'s in-project referenced leaves, so the generator (Phase 14) wires ONE `typecheck` target at the solution `tsconfig.json` — per-project-type detection and a separate spec target evaporate. Board decision D1 (no bespoke FsTree; in-memory generator tests; generator emits no files) STILL HOLDS: it is the executor that changes, not the generator.
- **CARRIED FORWARD (dev-repo only):** `.npmrc legacy-peer-deps=true` is required in this dev repo because `@nx/angular@23.0.1` caps Angular tooling peers at `< 22.0.0` while the locked stack is Angular 22. It does NOT reach consumers (a clean tarball install on stable Angular 22.0.4 + Nx 23.0.1 needs no override). Revisit/drop when a stable `@nx/angular` admits Angular 22 in its peers.

### Pending Todos

None.

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260630-dyd | Address all PR #11 review findings (I-1 silent-notice fix + T1/T3/S-types test gaps + S-code/S-test/S-comments cleanups; T2 dropped as refuted) | 2026-06-30 | 53c8c18 | Verified + shipped (v0.0.3) | [260630-dyd-...](./quick/260630-dyd-address-all-review-findings/) |
| 260630-fg0 | Address second-round PR #11 review findings (#1 realpath keep-on-throw false-negative fix + inverted T1, #3 program guard, #2/S1/S2 comments, S3/S5a/S5c/S5d pinning tests; S4 + S5b refuted, S6 declined) | 2026-06-30 | 95d6f58 | Verified + shipped (v0.0.3) | [260630-fg0-...](./quick/260630-fg0-address-second-round-pr-review-findings/) |
| 260630-jnl | Address third-round PR #11 review findings (de-tautologize S5c warningCount test + cover the undefined-base filter branch + the program-undefined guard branch; de-pin a stale line ref + sharpen 2 comments; #4 "infra-failure:204" half refuted) | 2026-06-30 | 02c5ead | Verified + shipped (v0.0.3) | [260630-jnl-...](./quick/260630-jnl-address-third-round-pr-review-findings/) |
| 260701-shh | Add CI `format:check` + `lint` gates (nrwl/nx-set-shas base/head), bake `maxWarnings:0` into the lint target, Prettier-format the whole repo (2 diagnostic-sensitive templates + lockfiles excluded), bump actions/checkout v7 + setup-node v6 | 2026-07-01 | 4f0ccdf | Complete (verified locally) | [260701-shh-...](./quick/260701-shh-add-ci-format-check-lint-jobs-nx-set-sha/) |

## Deferred Items

Tracked as Future Requirements (out of scope, not debt):

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| FsTree testing | FSTREE-01: bespoke real-disk `createFsTree`/`flushFsTreeChanges` helpers | Deferred (board Option A; only if a future generator emits files) | v0.0.4 requirements definition |
| Generator surface | GEN-FUT-01 (Angular CLI `angular.json` support) / GEN-FUT-02 (`ng add` / `nx add`) | Deferred (later milestone) | v0.0.4 requirements definition |
| Engine / performance | WALK-FUT-01 (`createNodesV2` granular per-leaf `typecheck` targets) / WALK-FUT-02 (project-references / `NgtscProgram` incremental declaration-reuse to collapse the walk's double-compile tax) | Deferred (additive, not blocking; WALK-FUT-02 needs the deferred `NgtscProgram` engine) | v0.0.4 re-scope (spikes 001-005) |
| Resilience | REP-RES-02b: faithful per-file TEMPLATE/extended diagnostic recovery after a TCB-generation Fatal (needs `NgtscProgram` / `OptimizeFor.SingleFile`; same limit as `@angular/build` today) | Deferred to the `NgtscProgram` incremental milestone | v0.0.3 RES-02 reframe |
| Observability | OBS-01: `totalFilesCount` field on `CoreResult` (`@nx/js` parity) | Deferred pending charter-fit | v0.0.3 requirements definition |
| Surfaces | Standalone CLI surface (owns the literal OS exit code `2`; consumes the pure `toExitCode` policy) | Deferred (PROJECT.md Out of Scope) | v0.0.3 (COR-04) |
| Feature families | INF / SUR / REP / SUP carried from v0.0.1 | Deferred (later milestone) | v0.0.1 close |

## Session Continuity

Last session: 2026-07-01T22:08:22.307Z
Stopped at: Phase 13.1 context gathered
Next step: Plan Phase 13 (Engine: solution-tsconfig reference-walking, WALK-01/02) via `/gsd-plan-phase 13`. The engine change is Approach-A-compatible (existing `performCompilation`, no new compiler machinery); ground the plan in spikes 001-005 and the spike `MANIFEST.md` locked requirements.
