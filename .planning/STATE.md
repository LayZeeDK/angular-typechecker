---
gsd_state_version: 1.0
milestone: v0.0.4
milestone_name: typecheck-configuration generator and extended testing strategy
status: planning
last_updated: "2026-06-30T20:48:05.263Z"
last_activity: 2026-06-30
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-30 after v0.0.3 milestone completion)

**Core value:** Deliver the complete Angular type-check (TypeScript + template type-check + extended NG8xxx) for any project type without building the app or running the tests -- faster, in isolation, and more completely than the build's coupled check or a bare `ngc --noEmit`.
**Current focus:** Milestone v0.0.4 -- typecheck-configuration generator and extended testing strategy (in planning: research -> requirements -> roadmap).

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-06-30 — Milestone v0.0.4 started

## Accumulated Context

### Decisions

All milestone decisions (v0.0.1 + v0.0.3) are logged in PROJECT.md Key Decisions
(outcomes closed) and in the per-milestone archives:

- v0.0.3 decision summary: `.planning/milestones/v0.0.3-ROADMAP.md` (Milestone Summary) + the phase SUMMARYs under `.planning/milestones/v0.0.3-phases/`.
- v0.0.1 decision log: `.planning/milestones/v0.0.1-ROADMAP.md` + `.planning/milestones/v0.0.1-phases/`.

### Blockers/Concerns

v0.0.3 is closed; all phase-input concerns were resolved during the milestone. Carried
forward into the next milestone:

- **CARRIED FORWARD (dev-repo only):** `.npmrc legacy-peer-deps=true` is required in this dev repo because `@nx/angular@23.0.1` caps Angular tooling peers at `< 22.0.0` while the locked stack is Angular 22. It does NOT reach consumers (a clean tarball install on stable Angular 22.0.4 + Nx 23.0.1 needs no override). Revisit/drop when a stable `@nx/angular` admits Angular 22 in its peers.
- **RESOLVED in v0.0.3:** the Phase-9 open question (`NgCompiler.getDiagnosticsForFile` `d.file === file` filtering could drop file-less non-template diagnostics) was settled by the RES-01 spike -> HYBRID gathering. The Phase-10 vendored-shim debt (`EmitFlags.None` fabrication) was corrected and is now guarded by the build-time drift tripwire.

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
| Resilience | REP-RES-02b: faithful per-file TEMPLATE/extended diagnostic recovery after a TCB-generation Fatal (needs `NgtscProgram` / `OptimizeFor.SingleFile`; same limit as `@angular/build` today) | Deferred to the `NgtscProgram` incremental milestone | v0.0.3 RES-02 reframe |
| Observability | OBS-01: `totalFilesCount` field on `CoreResult` (`@nx/js` parity) | Deferred pending charter-fit | v0.0.3 requirements definition |
| Surfaces | Standalone CLI surface (owns the literal OS exit code `2`; consumes the pure `toExitCode` policy) | Deferred (PROJECT.md Out of Scope) | v0.0.3 (COR-04) |
| Feature families | INF / GEN / SUR / REP / SUP carried from v0.0.1 | Deferred (later milestone) | v0.0.1 close |

## Session Continuity

Last session: 2026-06-30 -- `/gsd-complete-milestone v0.0.3`.
Stopped at: v0.0.3 (Engine hardening) closed and archived (ROADMAP + REQUIREMENTS + audit + phases moved to `.planning/milestones/`; PROJECT.md evolved; MILESTONES.md + RETROSPECTIVE.md updated; REQUIREMENTS.md removed for the next milestone). Per the v0.0.1 precedent and the repo's `angular-typechecker@x.y.z` tag convention, no separate `v0.0.3` GSD tag was created (`angular-typechecker@0.0.3` already marks the release). Commits made on branch `complete-gsd-v0.0.3`; NOT pushed (main is PR-only).
Next step: open a PR for `complete-gsd-v0.0.3` into `main`, then `/gsd-new-milestone` to scope the next version.
