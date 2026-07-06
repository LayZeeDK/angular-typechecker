---
gsd_state_version: 1.0
milestone: v0.1.2
milestone_name: Storybook story type-checking
status: verifying
stopped_at: Completed 18-02-PLAN.md (T9/T6/T10 residual boundary-semantics fixtures; T5 verified pre-covered).
last_updated: "2026-07-06T13:56:02.527Z"
last_activity: 2026-07-06
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 12
  completed_plans: 13
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-05 -- v0.1.2 milestone opened)

**Core value:** Deliver the complete Angular type-check (TypeScript + template type-check + extended NG8xxx) for any project type without building the app or running the tests -- faster, in isolation, and more completely than the build's coupled check or a bare `ngc --noEmit`.
**Current focus:** Phase 18 — Packaged-tarball e2e + docs

## Current Position

Milestone: v0.1.2 (Storybook story type-checking) -- Phase 16 gate spike COMPLETE (GO); Phase 17 next.
Phase: 18 (Packaged-tarball e2e + docs) — EXECUTING
Plan: 5 of 5
Status: Phase complete — ready for verification
external-template branch 4a locked (relatedInformation ownership signal).
Last activity: 2026-07-06
into the spike-findings-angular-typechecker skill, recorded Phase 16 complete.

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

**Phase 16 GATE RESOLVED 2026-07-05 = GO** (spikes 006-008, all VALIDATED; records in
`.planning/spikes/` + the `spike-findings-angular-typechecker` skill; blueprint in that skill's
`references/storybook-input-set-boundary.md`): G2 = YES (widened cross-project include ->
`readConfiguration().rootNames`; key `inputTs` on the declared set, NOT
`program.getRootFileNames()` which adds `.ngtypecheck.ts` shims); G3 = YES (forced
`@storybook/angular@10.4.6` via `--legacy-peer-deps` compiles; its 48 TS6 `.d.ts` errors are
node_modules-suppressed -- D4 confirmed); G4 = YES positively (NG8002 + NG8102 fire RED in-project);
G1 = html + G5 = PASS -> external-template branch **4a** (map `.html` -> owning rootName `.ts` via
public `relatedInformation`; default-keep the unmappable edge). Phase 17 ships Layout A + Layout B.

Prior milestone decisions (v0.0.1 + v0.0.3 + v0.1.0): PROJECT.md Key Decisions + the per-milestone
archives under `.planning/milestones/`.

- [Phase 18]: 18-01: added advisory CoreResult.notTypeCheckedDeclaredFiles (.mdx always; .tsx when jsx unset/None) rendered as one executor logger.warn; verdict stays green (evaluate-result unchanged, negative test locks it)
- [Phase 18]: 18-03: T11 integration proof of D-01 notTypeCheckedDeclaredFiles; fixed .mdx enumeration (ScriptKind.Deferred, was Unknown -> zero .mdx); verdict stays green with a JSX-free .tsx
- [Phase 18]: 18-04: packaged-tarball Storybook criterion-1 e2e (Verdaccio nx add) proves the SHIPPED artifact catches planted story errors on Layout A (TS2322) + Layout B (aggregated TS2345 + external-template NG8002); clean baselines exit 0, no ERR_REQUIRE_ESM/infra error. B-03 preserved by installing angular-typechecker BEFORE Storybook (nx add forwards no flags) so the override-free peer check runs against a Storybook-free tree; only @storybook/angular used --legacy-peer-deps. Known-local out-of-scope: nx-add-yarn ECONNREFUSED (corepack-yarn vs Verdaccio).
- [Phase 18]: 18-05: SB-07 docs -- README ## Storybook section (exact coverage claim + caveats), Limitations WR-01 fix (zero-input in-project leaf is coverage-incomplete, not advisory-skip), CoreResult comment gains notTypeCheckedDeclaredFiles, curated CHANGELOG 0.1.2 with green->red false-pass to true-fail callout; prose only, no release cut (D-05).

### Blockers/Concerns

- **v0.1.2 GATE -- RESOLVED 2026-07-05 = GO (was: Layout B rested on unverified official-stack
  empirics).** Phase 16 spikes 006-008 confirmed G2/G3/G4 all YES and selected external-template
  branch 4a (G1 = html + G5 = PASS). Layout B IS supportable; no fallback to Layout-A-only. See the
  Decisions section above and `.planning/spikes/`.

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

Last session: 2026-07-06T13:56:02.520Z
`/gsd-new-milestone` roadmap gap (phases 16-19 lacked the `### Phase N:` detail headings GSD resolves
against -> `phase_found:false`; user-fixed in commit 7d68162; see the [[gsd-roadmap-needs-phase-headings]]
memory). Then built + ran spikes 006 (G2), 007 (G3/G4 -- forced `@storybook/angular@10.4.6` in an
isolated scratchpad scaffold via `--legacy-peer-deps`), 008 (G1/G5) -- all VALIDATED. Wrapped up:
packaged findings into `.claude/skills/spike-findings-angular-typechecker/`, and recorded Phase 16
complete in ROADMAP/REQUIREMENTS/STATE. Committed on `gsd/v0.1.2-storybook`.
Stopped at: Completed 18-02-PLAN.md (T9/T6/T10 residual boundary-semantics fixtures; T5 verified pre-covered).
complete. Reviewed at the 16->17 gate.
Next step: `/gsd-plan-phase 17` (input-set-membership boundary + Layout A/B support). The
implementation blueprint is in the spike-findings skill's
`references/storybook-input-set-boundary.md`. NOTE: the forced-SB10 scaffold lives in the session
scratchpad (not committed); an eventual PR for `gsd/v0.1.2-storybook` into `main` (PR-only) carries
the `.planning/` + `.claude/skills/` artifacts. OSS reference clones under D:/projects/github/
(radix-ng/primitives et al.) are not committed.
