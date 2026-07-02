---
gsd_state_version: 1.0
milestone: v0.1.0
milestone_name: configuration + init generators, nx add support, and the typecheck executor rename
status: completed
stopped_at: "v0.1.0 (configuration + init generators, nx add support, and the typecheck executor rename) shipped, audited (passed, 22/22, zero tech debt), and ARCHIVED. Published live as angular-typechecker@0.1.0. Next milestone not yet scoped."
last_updated: "2026-07-02"
last_activity: 2026-07-02
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 16
  completed_plans: 16
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-02 after v0.1.0 milestone completion)

**Core value:** Deliver the complete Angular type-check (TypeScript + template type-check + extended NG8xxx) for any project type without building the app or running the tests -- faster, in isolation, and more completely than the build's coupled check or a bare `ngc --noEmit`.
**Current focus:** Planning next milestone -- run `/gsd-new-milestone`.

## Current Position

Milestone: v0.1.0 (configuration + init generators, nx add support, and the typecheck executor rename) -- COMPLETE and archived.
Status: shipped (published `angular-typechecker@0.1.0`); no active phase.
Next: next milestone not yet scoped. Natural candidates (Out of Scope in PROJECT.md): `createNodesV2` inferred per-leaf targets (WALK-FUT-01), `NgtscProgram` incremental engine (WALK-FUT-02, REP-RES-02b), Angular CLI (`angular.json`) generator/schematic support (GEN-FUT-01/02), machine-readable reporters (JSON/SARIF), or the `totalFilesCount` observability field (OBS-01).

Shipped milestones (historical record): `.planning/MILESTONES.md`.
Full roadmap: `.planning/ROADMAP.md` (v0.0.1 + v0.0.3 + v0.1.0 collapsed to SHIPPED).
Phase execution history: `.planning/milestones/v0.0.1-phases/`, `.planning/milestones/v0.0.3-phases/`, and `.planning/milestones/v0.1.0-phases/`.

## Accumulated Context

### Decisions

All milestone decisions (v0.0.1 + v0.0.3 + v0.1.0) are logged in PROJECT.md Key Decisions
(outcomes closed) and in the per-milestone archives:

- v0.1.0 decision summary: `.planning/milestones/v0.1.0-ROADMAP.md` (Milestone Summary) + the phase SUMMARYs under `.planning/milestones/v0.1.0-phases/`.
- v0.0.3 decision summary: `.planning/milestones/v0.0.3-ROADMAP.md` (Milestone Summary) + the phase SUMMARYs under `.planning/milestones/v0.0.3-phases/`.
- v0.0.1 decision log: `.planning/milestones/v0.0.1-ROADMAP.md` + `.planning/milestones/v0.0.1-phases/`.

### Blockers/Concerns

v0.1.0 is closed; all phase-input concerns were resolved during the milestone. Carried
forward into the next milestone:

- **CARRIED FORWARD (dev-repo only):** `.npmrc legacy-peer-deps=true` is required in this dev repo because `@nx/angular@23.0.1` caps Angular tooling peers at `< 22.0.0` while the locked stack is Angular 22. It does NOT reach consumers (a clean tarball install on stable Angular 22.0.4 + Nx 23.0.1 needs no override). Revisit/drop when a stable `@nx/angular` admits Angular 22 in its peers.
- **RESOLVED in v0.1.0:** the generator's per-project-type `tsConfig`-defaulting shape (originally GEN-02/03) is no longer open -- spikes 001-005 resolved it via reference-walking (the engine walks a solution `tsconfig.json`'s in-project leaves; the generator wires ONE target).
- **PROCESS DEBT (not a code blocker):** the `audit-open` quick-task scanner bug (reads a bare `<dir>/SUMMARY.md`, but `/gsd-quick` writes `<id>-SUMMARY.md`) has now recurred at TWO milestone closes (v0.0.3, v0.1.0). See `.planning/RETROSPECTIVE.md` v0.1.0 "What Was Inefficient" -- the fix belongs in the GSD scanner, not another per-repo workaround. Similarly, the "close requirement statuses at phase verification" lesson has recurred a THIRD time; both need a mechanical gate before the next milestone.

### Pending Todos

None.

### Quick Tasks Completed

All v0.1.0 quick tasks are verified + shipped; full detail (descriptions, commits,
directories) is preserved in `.planning/milestones/v0.1.0-phases/` and the quick-task
directories under `.planning/quick/`. Summary: 3 PR-review rounds against PR #15
(260630-era carried from v0.0.3 close; 20260702-pr15-review-triage + its round-2
simplification pass; 260702-rq7 thermos triage with zero code changes), 2 milestone-audit
INFO-finding fixes (260702-g5r), 1 CI fallow-gate fix (260702-hsv), 1 CI format/lint gate
addition (260701-shh), and 1 breaking public-barrel trim (20260702-trim-public-barrel).

## Deferred Items

Tracked as Future Requirements (out of scope, not debt):

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| FsTree testing | FSTREE-01: bespoke real-disk `createFsTree`/`flushFsTreeChanges` helpers | Deferred (board Option A; only if a future generator emits files) | v0.0.4 requirements definition |
| Generator surface | GEN-FUT-01 (Angular CLI `angular.json` support) / GEN-FUT-02 (`ng add` Angular CLI schematic) | Deferred (later milestone; Nx's `nx add` shipped in v0.1.0) | v0.0.4 requirements definition |
| Engine / performance | WALK-FUT-01 (`createNodesV2` granular per-leaf `typecheck` targets) / WALK-FUT-02 (project-references / `NgtscProgram` incremental declaration-reuse to collapse the walk's double-compile tax) | Deferred (additive, not blocking; WALK-FUT-02 needs the deferred `NgtscProgram` engine) | v0.0.4 re-scope (spikes 001-005) |
| Resilience | REP-RES-02b: faithful per-file TEMPLATE/extended diagnostic recovery after a TCB-generation Fatal (needs `NgtscProgram` / `OptimizeFor.SingleFile`; same limit as `@angular/build` today) | Deferred to the `NgtscProgram` incremental milestone | v0.0.3 RES-02 reframe |
| Observability | OBS-01: `totalFilesCount` field on `CoreResult` (`@nx/js` parity) | Deferred pending charter-fit | v0.0.3 requirements definition |
| Surfaces | Standalone CLI surface (owns the literal OS exit code `2`; consumes the pure `toExitCode` policy) | Deferred (PROJECT.md Out of Scope) | v0.0.3 (COR-04) |
| Feature families | INF / SUR / REP / SUP carried from v0.0.1 | Deferred (later milestone) | v0.0.1 close |

## Session Continuity

Last session: 2026-07-02 -- `/gsd-complete-milestone v0.1.0`.
Stopped at: v0.1.0 (configuration + init generators, nx add support, and the typecheck
executor rename) closed and archived (ROADMAP + REQUIREMENTS + audit + phases moved to
`.planning/milestones/`; PROJECT.md evolved; MILESTONES.md + RETROSPECTIVE.md updated;
REQUIREMENTS.md removed for the next milestone). Per the v0.0.1/v0.0.3 precedent and the
repo's `angular-typechecker@x.y.z` tag convention, no separate `v0.1.0` GSD tag was
created (`angular-typechecker@0.1.0` already marks the release, tagged on the PR #16 merge
commit). Commits made on branch `complete-gsd-v0.1.0`; NOT pushed directly (main is
PR-only).
Next step: open a PR for `complete-gsd-v0.1.0` into `main`, then `/gsd-new-milestone` to
scope the next version.
