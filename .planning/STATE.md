---
gsd_state_version: 1.0
milestone: v0.1.2
milestone_name: Storybook story type-checking
status: planning
stopped_at: "v0.1.2 milestone opened and scoped (SB-01..08, phases 16-19). Scope + decisions hardened by a 6-lens Opus advisory board (2 rounds, consensus). No phase planned yet -- next is /gsd-plan-phase 16 (the gate spike)."
last_updated: "2026-07-05"
last_activity: 2026-07-05
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-05 -- v0.1.2 milestone opened)

**Core value:** Deliver the complete Angular type-check (TypeScript + template type-check + extended NG8xxx) for any project type without building the app or running the tests -- faster, in isolation, and more completely than the build's coupled check or a bare `ngc --noEmit`.
**Current focus:** v0.1.2 -- Storybook story type-checking. Next: `/gsd-plan-phase 16` (the gate spike).

## Current Position

Milestone: v0.1.2 (Storybook story type-checking) -- planning.
Phase: Not started.
Plan: --
Status: Requirements + roadmap defined; phase 16 not yet planned.
Last activity: 2026-07-05 -- milestone opened; scope hardened by the advisory board.

Requirements: `.planning/REQUIREMENTS.md` (SB-01..08).
Roadmap: `.planning/ROADMAP.md` (phases 16-19; v0.0.1 + v0.0.3 + v0.1.0 collapsed to SHIPPED).
Board record: `.planning/research/v0.1.2-storybook/board/` (FACTS.md, ROUND-1-SYNTHESIS.md, CONSENSUS.md).
Research: `.planning/research/v0.1.2-storybook/` (NX-SCAFFOLD.md, OSS-EXAMPLES.md, CENTRALIZED-HOST.md).

## Accumulated Context

### Decisions

v0.1.2 decisions are logged in PROJECT.md Key Decisions and detailed in the board CONSENSUS.md.
Headline: this milestone is ONE input-set-membership boundary correctness fix (not Storybook-specific
code); Layout A + Layout B both minimum; never-false-pass enforced via a split suppression counter;
external-template coverage G1-gated with a no-ngtsc-internals rule; a hard GO/NO-GO Phase-16 spike.

Prior milestone decisions (v0.0.1 + v0.0.3 + v0.1.0): PROJECT.md Key Decisions + the per-milestone
archives under `.planning/milestones/`.

### Blockers/Concerns

- **v0.1.2 GATE (spike-resolvable, not a blocker yet):** Layout B support rests on unverified empirics
  on the official stack -- G2 (widened files materialize as the storybook leaf's `parsed.rootNames`),
  G3 (forced `@storybook/angular@10.4.6` compiles via `performCompilation`; a clean story passes clean),
  G4 (NG8xxx fire on stories). Phase 16 resolves these as GO/NO-GO; a NO ships Layout A + documents
  Layout B "not yet supported".
- **v0.1.2 external constraint:** `@storybook/angular@10.4.6` peer-caps Angular at `<22.0.0` / TS at
  `^4.9||^5`, so installing Storybook on Angular 22 needs `--legacy-peer-deps`/`--force`. Documented,
  never gated (D4). `nx add`/pnpm can hit `ERR_PNPM_IGNORED_BUILDS` (see [[nx-add-fails-on-pnpm-workspaces]]).
- **CARRIED FORWARD (dev-repo only):** `.npmrc legacy-peer-deps=true` is required in this dev repo
  because `@nx/angular@23.0.1` caps Angular tooling peers at `< 22.0.0` while the locked stack is
  Angular 22. It does NOT reach consumers. Revisit when a stable `@nx/angular` admits Angular 22.
- **PROCESS DEBT (not a code blocker):** the `audit-open` quick-task scanner bug (bare `<dir>/SUMMARY.md`
  vs `<id>-SUMMARY.md`) recurred at v0.0.3 and v0.1.0 closes; and "close requirement statuses at phase
  verification" has recurred. Both want a mechanical gate before the next milestone close.

### Pending Todos

None.

### Quick Tasks Completed

v0.1.1 and its post-release quick tasks are recorded in the git history and the prior STATE.md archive
(260703-lp0 / 260703-p2x / 260703-u74 / 260703-wcg / 260704-mse / 260704-wnq / 260705-1wo). v0.1.1
(packaging hotfix -- `packageRoot` so the tarball ships built `.js`) is published; prior versions
(0.0.1-0.1.0) are deprecated. See [[angular-typechecker-npm-releases-ship-source]].

## Deferred Items

Tracked as Future Requirements (out of scope, not debt):

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Storybook (v0.1.2 stretch) | SB-08: Layout C beyond the guard; `.mdx`/`.tsx` type-check; opt-in strict mode failing on `suppressedInGraph>0` | Deferred (stretch; deferrable Phase 19) | v0.1.2 requirements definition |
| FsTree testing | FSTREE-01: bespoke real-disk `createFsTree`/`flushFsTreeChanges` helpers | Deferred (board Option A) | v0.0.4 requirements definition |
| Generator surface | GEN-FUT-01 (Angular CLI `angular.json`) / GEN-FUT-02 (`ng add` Angular CLI schematic) | Deferred (later milestone) | v0.0.4 requirements definition |
| Engine / performance | WALK-FUT-01 (`createNodesV2` per-leaf targets) / WALK-FUT-02 (`NgtscProgram` incremental) | Deferred (additive) | v0.0.4 re-scope |
| Resilience | REP-RES-02b: faithful per-file template recovery after a TCB Fatal | Deferred (needs `NgtscProgram`) | v0.0.3 RES-02 reframe |
| Observability | OBS-01: `totalFilesCount` on `CoreResult` | Deferred pending charter-fit | v0.0.3 requirements definition |
| Surfaces | Standalone CLI (owns literal OS exit code `2`) | Deferred | v0.0.3 (COR-04) |
| Reporters | Machine-readable JSON/SARIF | Deferred | v0.0.1 close |
| Feature families | INF / SUR / REP / SUP carried from v0.0.1 | Deferred | v0.0.1 close |

## Session Continuity

Last session: 2026-07-05 -- opened milestone v0.1.2 via `/gsd-new-milestone`. Ran bespoke research
(NX-SCAFFOLD / OSS-EXAMPLES / CENTRALIZED-HOST) then a 6-lens Opus advisory board (2 rounds) to decide
and harden the requirements/decisions; wrote PROJECT.md (Current Milestone + Key Decisions), a fresh
REQUIREMENTS.md (SB-01..08), ROADMAP.md (phases 16-19), and this STATE.md. Committed on branch
`gsd/v0.1.2-storybook`.
Stopped at: milestone artifacts written + committed; Layout-B support pending the Phase-16 GO/NO-GO spike.
Next step: open a PR for `gsd/v0.1.2-storybook` into `main` (main is PR-only) carrying the `.planning/`
milestone artifacts, then `/gsd-plan-phase 16` (the gate spike). The throwaway scaffold workspace lives
under the session scratchpad (not committed); the OSS reference clones are under D:/projects/github/
(radix-ng/primitives, zeckaissue/*, brandonroberts/*, bitwarden/clients -- not committed).
