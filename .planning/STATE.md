---
gsd_state_version: 1.0
milestone: v0.0.4
milestone_name: typecheck-configuration generator and extended testing strategy
status: executing
stopped_at: Completed 12-01-PLAN.md
last_updated: "2026-07-01T06:28:53.698Z"
last_activity: 2026-07-01
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 4
  completed_plans: 1
  percent: 25
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-30 after v0.0.3 milestone completion)

**Core value:** Deliver the complete Angular type-check (TypeScript + template type-check + extended NG8xxx) for any project type without building the app or running the tests -- faster, in isolation, and more completely than the build's coupled check or a bare `ngc --noEmit`.
**Current focus:** Phase 12 — extended-diagnostic-catalog-completeness-tripwire

## Current Position

Phase: 12 (extended-diagnostic-catalog-completeness-tripwire) — EXECUTING
Plan: 2 of 4
Status: Plan 01 complete (DRIFT-01 tripwire green); ready to execute Plan 02
Last activity: 2026-07-01 -- completed 12-01 (extended-diagnostic source of truth + completeness tripwire)

Progress: [███░░░░░░░] 25%

## v0.0.4 Phase Map

| Phase | Name | Requirements | Depends on |
|-------|------|--------------|------------|
| 12 | Extended-diagnostic catalog + completeness tripwire | CAT-01..05, DRIFT-01 | — (engine-only; generator-independent) |
| 13 | typecheck-configuration generator | GEN-01..06 | — (parallel to 12; consumes the existing executor) |
| 14 | Generator e2e + CI self-audit guard | GE2E-01, GE2E-02, GUARD-01 | Phase 13 (needs the shipped generator + `generators.json`) |

Sequencing note: Phase 12 (catalog + tripwire) is the highest-value, generator-independent deliverable. Phase 13 (the generator) is the version-bumping `feat` (0.0.3 -> 0.0.4) and a prerequisite for the Phase 14 generator e2e. GUARD-01 is small/independent and rides Phase 14. The generator's exact per-project-type `tsConfig`-defaulting shape (GEN-02/03 — single-target+option vs. multiple targets vs. `configurations`) is an OPEN design decision to resolve during Phase 13's discussion/research; it is intentionally not pre-locked in the roadmap success criteria.

## Accumulated Context

### Decisions

All milestone decisions (v0.0.1 + v0.0.3) are logged in PROJECT.md Key Decisions
(outcomes closed) and in the per-milestone archives:

- v0.0.3 decision summary: `.planning/milestones/v0.0.3-ROADMAP.md` (Milestone Summary) + the phase SUMMARYs under `.planning/milestones/v0.0.3-phases/`.
- v0.0.1 decision log: `.planning/milestones/v0.0.1-ROADMAP.md` + `.planning/milestones/v0.0.1-phases/`.

v0.0.4 testing strategy ratified by a unanimous 8-lens Opus board (record: `.planning/research/v0.0.4-testing/board2/CONSENSUS.md`): in-memory `createTreeWithEmptyWorkspace` substrate (NO bespoke `createFsTree`); single enum-keyed `it.each` catalog over committed fixtures (exact code + category + count + one promotion case; NG8011 out-of-band/not promotable); enum-vs-table completeness tripwire; generator e2e folded into `angular-typechecker-install-e2e` (no Verdaccio, no new e2e project); in-plugin specs auto-route into the existing 6-cell `test` matrix (no `ci.yml` structural change); a `-p` set-equality guard; single required `ci` gate unchanged.

- [Phase 12]: Phase 12 Plan 01 (DRIFT-01): the extended-diagnostic completeness tripwire deep-imports ExtendedTemplateDiagnosticName from the sub-barrel @angular/compiler-cli/src/ngtsc/diagnostics under classic resolution -- compiled green on first typecheck-drift run, no leaf-path fallback needed (Assumption A2 resolved).
- [Phase 12]: Phase 12 Plan 01 (D-02): EXTENDED_DIAGNOSTIC_MEMBERS is the single dependency-free as-const source of truth (18 enum VALUES, declaration order) consumed by BOTH the Plan 02 catalog spec and the type-level tripwire; deliberate-RED proof confirmed it fails loudly (TS2344 at the CatalogCoversEnum probe) on drift and returns green when restored.

### Blockers/Concerns

Carried forward into v0.0.4:

- **OPEN (Phase 13 design decision):** the generator's per-project-type `tsConfig`-defaulting shape (GEN-02/03) — single target + `--tsConfig` option vs. multiple targets vs. `configurations`, plus the project-type detection method — is NOT pre-locked. Resolve during Phase 13's discussion/research. The board's D1/D3/D6 convergence is conditioned on the generator staying `project.json`-edit-only (no file emission, no per-type file branching); if that assumption breaks (generator must emit a tsconfig), the FsTree/milestone-split decisions re-open.
- **CARRIED FORWARD (dev-repo only):** `.npmrc legacy-peer-deps=true` is required in this dev repo because `@nx/angular@23.0.1` caps Angular tooling peers at `< 22.0.0` while the locked stack is Angular 22. It does NOT reach consumers (a clean tarball install on stable Angular 22.0.4 + Nx 23.0.1 needs no override). Revisit/drop when a stable `@nx/angular` admits Angular 22 in its peers.

### Pending Todos

None.

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260630-dyd | Address all PR #11 review findings (I-1 silent-notice fix + T1/T3/S-types test gaps + S-code/S-test/S-comments cleanups; T2 dropped as refuted) | 2026-06-30 | 53c8c18 | Verified + shipped (v0.0.3) | [260630-dyd-...](./quick/260630-dyd-address-all-review-findings/) |
| 260630-fg0 | Address second-round PR #11 review findings (#1 realpath keep-on-throw false-negative fix + inverted T1, #3 program guard, #2/S1/S2 comments, S3/S5a/S5c/S5d pinning tests; S4 + S5b refuted, S6 declined) | 2026-06-30 | 95d6f58 | Verified + shipped (v0.0.3) | [260630-fg0-...](./quick/260630-fg0-address-second-round-pr-review-findings/) |
| 260630-jnl | Address third-round PR #11 review findings (de-tautologize S5c warningCount test + cover the undefined-base filter branch + the program-undefined guard branch; de-pin a stale line ref + sharpen 2 comments; #4 "infra-failure:204" half refuted) | 2026-06-30 | 02c5ead | Verified + shipped (v0.0.3) | [260630-jnl-...](./quick/260630-jnl-address-third-round-pr-review-findings/) |

## Deferred Items

Tracked as Future Requirements (out of scope, not debt):

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| FsTree testing | FSTREE-01: bespoke real-disk `createFsTree`/`flushFsTreeChanges` helpers | Deferred (board Option A; only if a future generator emits files) | v0.0.4 requirements definition |
| Generator surface | GEN-FUT-01 (Angular CLI `angular.json` support) / GEN-FUT-02 (`ng add` / `nx add`) | Deferred (later milestone) | v0.0.4 requirements definition |
| Resilience | REP-RES-02b: faithful per-file TEMPLATE/extended diagnostic recovery after a TCB-generation Fatal (needs `NgtscProgram` / `OptimizeFor.SingleFile`; same limit as `@angular/build` today) | Deferred to the `NgtscProgram` incremental milestone | v0.0.3 RES-02 reframe |
| Observability | OBS-01: `totalFilesCount` field on `CoreResult` (`@nx/js` parity) | Deferred pending charter-fit | v0.0.3 requirements definition |
| Surfaces | Standalone CLI surface (owns the literal OS exit code `2`; consumes the pure `toExitCode` policy) | Deferred (PROJECT.md Out of Scope) | v0.0.3 (COR-04) |
| Feature families | INF / SUR / REP / SUP carried from v0.0.1 | Deferred (later milestone) | v0.0.1 close |

## Session Continuity

Last session: 2026-07-01T06:24:58.266Z
Stopped at: Completed 12-01-PLAN.md (DRIFT-01: extended-diagnostic member source of truth + type-level completeness tripwire, green under typecheck-drift with a recorded deliberate-RED proof)
Next step: Execute 12-02-PLAN.md (the 18-member enum-keyed `it.each` catalog integration spec + sibling baseline table + CAT-05 DIAGNOSTIC-CATALOG.md rewrite), which consumes the EXTENDED_DIAGNOSTIC_MEMBERS source of truth this plan established.
