---
gsd_state_version: 1.0
milestone: v0.2.0
milestone_name: Storybook story type-checking
status: Awaiting next milestone
stopped_at: "v0.2.0 RELEASED -- angular-typechecker@0.2.0 published to npm 2026-07-07 (PR #29 merged; tag on the release merge commit); awaiting /gsd-new-milestone"
last_updated: "2026-07-09T21:22:43.067Z"
last_activity: 2026-07-07 -- v0.2.0 released and published to npm (angular-typechecker@0.2.0)
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 20
  completed_plans: 20
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-09 -- v0.2.0 RELEASED + published to npm)

**Core value:** Deliver the complete Angular type-check (TypeScript + template type-check + extended NG8xxx) for any project type without building the app or running the tests -- faster, in isolation, and more completely than the build's coupled check or a bare `ngc --noEmit`.
**Current focus:** v0.2.0 RELEASED -- `angular-typechecker@0.2.0` published live to npm 2026-07-07 (dist-tag `latest`, tokenless OIDC + SLSA v1 provenance). Next: `/gsd-new-milestone`.

## Current Position

Phase: Milestone v0.2.0 released
Plan: —
Status: Awaiting next milestone
Last activity: 2026-07-10 -- Completed quick task 260710-0ch: audited, triaged, and addressed all 5 Dependabot security alerts

## Accumulated Context

### Decisions

v0.2.0 decisions are logged in PROJECT.md Key Decisions and detailed in the board CONSENSUS.md.
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
- [Phase 18]: 18-05: SB-07 docs -- README ## Storybook section (exact coverage claim + caveats), Limitations WR-01 fix (zero-input in-project leaf is coverage-incomplete, not advisory-skip), CoreResult comment gains notTypeCheckedDeclaredFiles, curated CHANGELOG 0.2.0 with green->red false-pass to true-fail callout; prose only, no release cut (D-05).
- [Phase 19]: 19-03: README ## Storybook Composition coverage claim rests on per-project typecheck + Nx ^typecheck fan-out (implicitDependencies), NOT Storybook's any-typed refs (19-02 finding); a content tripwire (storybook-docs.spec.ts) locks it
- [Phase 19]: 19-03: recorded Layout-C-beyond-guard and .mdx/.tsx-beyond-advisory as 'not warranted' (19-DECISIONS.md), closing phase-19 success criterion 1
- [Phase 20]: 20-01: added advisory CoreResult.bundlerQueryImports (deduped+sorted ?query TS2307 specifiers) via a pure detector over the POST-filter kept set at the single finalize seam (zero walk threading); verdict-neutral (evaluate-result untouched + D-05 tripwire); baseline leg fires+keeps the TS2307 / vite-client leg self-gates, proven by a hermetic real-compiler fixture. Signal 2 engine half only -- executor render (20-02) + README (20-03) remain; SB-09 not closed until phase verification.
- [Phase 20]: 20-02: executor half of Signal 2 (D-04) -- warnBundlerQueryImports renders CoreResult.bundlerQueryImports as ONE logger.warn (count + "types": ["vite/client"] fix + ADVISORY-not-suppressed + specifiers), the fifth advisory notice, fired after warnNotTypeChecked; self-gating on field presence (D-03), verdict untouched (evaluateResult never reads it), content-isolated to the consumer's own specifiers; both doc-comments bumped four->five
- [Phase 20]: README Vite caveat restructured to lead with the vite/client fix; both SB-09 signals folded into the curated 0.2.0 CHANGELOG (prose only, no release cut, package.json stays 0.1.1)

### Roadmap Evolution

- Phase 20 added 2026-07-07: Vite/Analog Storybook query-import guidance (SB-09). Follow-up surfaced by the Phase-19 OSS real-repo UAT (`19-UAT.md`) and validated by spikes 009-010. BOTH signals in scope for v0.2.0 (user-committed 2026-07-07): the `vite/client` README recipe (docs) AND the `?query` detection advisory (engine + executor). Reopens v0.2.0 beyond its passed milestone audit.

### Blockers/Concerns

- **v0.2.0 GATE -- RESOLVED 2026-07-05 = GO (was: Layout B rested on unverified official-stack
  empirics).** Phase 16 spikes 006-008 confirmed G2/G3/G4 all YES and selected external-template
  branch 4a (G1 = html + G5 = PASS). Layout B IS supportable; no fallback to Layout-A-only. See the
  Decisions section above and `.planning/spikes/`.

- **v0.2.0 external constraint:** `@storybook/angular@10.4.6` peer-caps Angular at `<22.0.0` / TS at
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

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260710-0ch | Audit, triage, then address Dependabot security alerts | 2026-07-10 | 0fe82a8 | Verified | [260710-0ch-audit-triage-then-address-dependabot-sec](./quick/260710-0ch-audit-triage-then-address-dependabot-sec/) |

## Deferred Items

Tracked as Future Requirements (out of scope, not debt):

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Storybook (v0.2.0 stretch) | SB-08: Layout C beyond the guard; `.mdx`/`.tsx` type-check; opt-in strict mode failing on `suppressedInGraph>0` | Deferred (stretch; deferrable Phase 19) | v0.2.0 requirements definition |
| FsTree testing | FSTREE-01: bespoke real-disk `createFsTree`/`flushFsTreeChanges` helpers | Deferred (board Option A) | v0.0.4 requirements definition |
| Generator surface | GEN-FUT-01 (Angular CLI `angular.json`) / GEN-FUT-02 (`ng add` Angular CLI schematic) | Deferred (later milestone) | v0.0.4 requirements definition |
| Engine / performance | WALK-FUT-01 (`createNodesV2` per-leaf targets) / WALK-FUT-02 (`NgtscProgram` incremental) | Deferred (additive) | v0.0.4 re-scope |
| Resilience | REP-RES-02b: faithful per-file template recovery after a TCB Fatal | Deferred (needs `NgtscProgram`) | v0.0.3 RES-02 reframe |
| Observability | OBS-01: `totalFilesCount` on `CoreResult` | Deferred pending charter-fit | v0.0.3 requirements definition |
| Surfaces | Standalone CLI (owns literal OS exit code `2`) | Deferred | v0.0.3 (COR-04) |
| Reporters | Machine-readable JSON/SARIF | Deferred | v0.0.1 close |
| Feature families | INF / SUR / REP / SUP carried from v0.0.1 | Deferred | v0.0.1 close |

## Session Continuity

Last session: 2026-07-07 -- ran `/gsd-audit-milestone v0.2.0` (PASSED 9/9 requirements, 5/5 phases,
9/9 cross-phase integration, 4/4 E2E flows) then `/gsd-complete-milestone v0.2.0`: archived
ROADMAP/REQUIREMENTS/audit to `.planning/milestones/v0.2.0-*`, collapsed ROADMAP to a SHIPPED
one-liner, evolved PROJECT.md (v0.2.0 Active -> Validated), updated MILESTONES/RETROSPECTIVE, removed
REQUIREMENTS.md, added the 7 bare quick-task `SUMMARY.md` markers (audit-open workaround, 3rd close).
Milestone-close committed on `release/0.2.0`; then RELEASED via the AGENTS.md Release-PR flow:
PR #29 (`release/0.2.0`, carrying the version cut + curated end-user-facing CHANGELOG) merged into
`main`; the `angular-typechecker@0.2.0` tag was created on the release merge commit and pushed
(fired `release.yml` -> OIDC publish through the human-approved `npm-publish` environment); and the
GitHub Release was cut from the curated CHANGELOG section. `angular-typechecker@0.2.0` is live on npm
(dist-tag `latest`, published 2026-07-07T22:25:11Z, SLSA v1 provenance);
`packages/angular-typechecker/package.json` is at `0.2.0`.
Next step: start the next milestone with `/gsd-new-milestone`. OSS reference clones under
D:/projects/github/ (radix-ng/primitives et al.) are not committed.

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
