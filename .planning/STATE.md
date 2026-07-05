---
gsd_state_version: 1.0
milestone: v0.1.0
milestone_name: configuration + init generators, nx add support, and the typecheck executor rename
status: completed
stopped_at: "v0.1.0 (configuration + init generators, nx add support, and the typecheck executor rename) shipped, audited (passed, 22/22, zero tech debt), and ARCHIVED. Published live as angular-typechecker@0.1.0. Next milestone not yet scoped."
last_updated: "2026-07-05"
last_activity: 2026-07-05
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

Post-v0.1.0: **260703-lp0** (`fix-stray-scoped-angular-typechecker-exe`, 2026-07-03) --
removed the stray scoped `@angular-typechecker/angular-typechecker[:typecheck]` form the
v0.1.0 executor rename left in the dev workspace (`nx.json` duplicate targetDefault, two
`libs/*` consumer executors, the `tsconfig.base.json` path alias), root README, e2e, and
specs; added a repo-wide `scoped-name-guard.spec.ts` tripwire. Distributed package verified
UNAFFECTED (shipped generator + package README already correct; specs excluded from the
tarball; the three scoped comments in the shipped `generator.js` were reworded) -- so NO
release/tag/publish/CHANGELOG. Diagnosis of the silent-green CI: the leftover tsconfig alias
made the bogus scoped id resolve to the real executor, and two shape-only specs REQUIRED it.

**260703-p2x** (`create-workspace-test-util-lib-with-find`, 2026-07-03, stacked on the
260703-lp0 PR) -- created the internal `@workspace/test-util` Nx library exporting a tested
`findWorkspaceRoot` (anchor-walk to `nx.json`), then refactored 26 specs (plugin + 3 e2e
projects) off the depth-coupled `join(dir, '..', ...)` chain (review Finding J). Reverted the
`@nx/js:library` generator's inferred-`plugins` block (workspace uses explicit executor
targets); made the lib buildable so the buildable plugin may import it. Deferred guard-CI
findings (docs-only skip, per-project cache stale-green, executor-resolution invariant) to a
follow-up.

**260703-u74** (`harden-scoped-name-guard-...`, 2026-07-03) -- resolved that deferred
follow-up: a dedicated always-run, `--skip-nx-cache` CI `scoped-name-guard` job (E1 docs-only
skip + E3 per-project-cache stale-green), a new executor-id resolution-invariant guard (E4/E5
-- every `:typecheck` executor id across `project.json`/`nx.json` must equal the canonical
`angular-typechecker:typecheck` in `executors.json`; catches aliased/typo'd ids the scope scan
misses), and ENOENT-robust file reads (E8). Verified an aliased `@atc/core:typecheck` trips the
new guard.

**260703-wcg** (`license-relocation-and-package-readme-ov`, 2026-07-03, `--validate --research`)
-- relocated the MIT `LICENSE` from `packages/angular-typechecker/` to the repo root (`git mv`,
history preserved) and re-pointed the `@nx/js:tsc` build asset (`input: "."`) so the root file
still lands in `dist/packages/angular-typechecker/LICENSE` -- the published tarball is UNCHANGED
(load-bearing check: deleted the dist copy, rebuilt `--skip-nx-cache`, it reappeared
byte-identical; `tarball-audit.int.spec.ts` + `package-manifest.spec.ts` green; `package.json`
`files` untouched). Fixed the root README license link to `./LICENSE`. Overhauled the published
package README (`packages/angular-typechecker/README.md`) per a README-conventions research pass:
badge row (npm version/license/CI), new `## Output` (one honest human-readable format + a real
TS2322/NG8002 codeframe example), `## CI integration` (tsc-superset problem matcher), and
`## Programmatic API` (`runTypecheck`/`TypecheckInfrastructureError`/`CoreOptions`/`CoreResult`);
documents only real features (JSON/SARIF framed as a v0.x non-goal; `nx add`, never `ng add`).
Docs/config only -- NO version bump/tag/publish. Verified 9/9 must-haves. On branch
`docs/license-root-and-readme-overhaul` (PR-bound; main is PR-only).

**260704-mse** (`fix-nx-release-publishing-typescript-sou`, 2026-07-04, `--research`) --
CRITICAL release-mechanics bug: every published version (0.0.1-0.1.0) shipped raw TypeScript
source (0 `.js`, no `src/index.js`), so `nx add` / `nx g` / `nx typecheck` / `require` all
failed on a stock Nx 23 workspace. Root cause: `nx release publish` had no `packageRoot`, so
it packed the project SOURCE root (`files: ["src"]` -> `src/**/*.ts`) instead of the built
`dist/` (the build itself was always correct). Surfaced by dogfooding the published package
against real Nx 23 + Angular 22 OSS repos (mmstack, ngx-lottie). Fix: added an
`nx-release-publish` target with `options.packageRoot: "dist/packages/angular-typechecker"`
to `project.json`. Regression gates: config guard (packageRoot === dist) + dist/source
version-parity guard in the serialized install-e2e, plus a NEW Verdaccio publish round-trip
e2e (real `nx release publish --registry <local>` -> install-by-name -> init/configuration/
typecheck green, asserts the installed tree has `.js` and zero `.ts`/`.spec`); added
`verdaccio@6.7.4` devDep; README pnpm-install fallback. 4 atomic commits on `release/0.1.1`;
full install-e2e suite green (6 files/29 tests), format + lint clean. Cutting **v0.1.1** as a
patch hotfix (PR-bound; tag/npm-publish/GitHub-release are human-gated). Recorded to memory
([[angular-typechecker-npm-releases-ship-source]]).

PR #23 REVIEW FOLLOW-UP (commit `2e2f8ab`): audited + merged + deduplicated findings from two
independent review reports (Thermos branch-audit + a 4-agent PR review) against the actual
code (both reports cited stale line numbers -- file is 553 lines). Zero critical/medium; all
test-harness honesty/robustness. FIXED (one `test(e2e)` commit, all 29 install-e2e tests green
locally): stale "dummy token"->"minted token" comments + the affirmatively-wrong "\$all accepts
dummy token as anonymous" + "five"->"three" file count; `green.stdout` on the typecheck
assertion; `JSON.parse` guard + registration request timeout; an `npm_config_*`-strip safety
assertion (the localhost check alone was tautological); `packageRoot === build.outputPath`
drift-proof invariant; "install by PATH" mischaracterization, overstated version-parity it()
title, and the rotting `@nx/js impl.js:68` line ref. DEFERRED (low value / beyond a ship-ready
hotfix, tracked for a follow-up, NOT blocking merge): extract the 4x-copied e2e harness
(`buildCleanEnv`/`run`/`RunResult`/`removeTmp*`/`walkFiles`) into `@workspace/test-util`;
wrap the install/init/configuration `execSync` calls to surface stdout on failure; add a
`.d.ts` installed-tree assertion; add `dependsOn: ["build"]` to `nx-release-publish`; note the
non-hermetic npmjs-uplink flake surface for CI triage.

PR #23 CLEANUP LANDING (user directed "land ALL deferred findings in #23"): audited + merged
+ deduped six more cleanup reports (/simplify + /ponytail-audit + /ponytail-review in full +
ultra) against the deferred set; verified each against code (reports cited stale line numbers).
Only distributed-code items could bind the "runtime findings land now" rule; scan of .planning
confirmed `toExitCode` is deliberate COR-04 deferred-CLI scaffolding (KEEP, not slop) and
`TemplateCheckAborted.code` a drift pin (KEEP). Scaffolded a throwaway `@nx/plugin:e2e-project`
(create-nx-workspace under scratchpad) to diff canonical vs our e2e setup: we already match on
implicitDependencies + serialization; adopted the canonical local-registry/globalSetup shape;
justified divergences (Vitest not Jest; publish REAL dist not `releaseVersion({0.0.0-e2e})`
which mutates source version; custom config.yml for no-proxy + htpasswd + real token since
canonical's `'**':proxy` + dummy token fail on Verdaccio 6). Landed 10 commits (59c022c..0c16285)
on `release/0.1.1`: adopted `@nx/js:setup-verdaccio` + `startLocalRegistry` in a vitest
globalSetup (single build/publish), extracted shared e2e helpers into `@workspace/test-util`
(M8/M9), R1 readdirSync-recursive, deleted the tautological version-parity test (A3), M14
`dependsOn:["build"]` on nx-release-publish, a programmatic-API barrel-load smoke (catches the
original dangling-`main` defect), and the shipped-source `loadTypescript` dedup to a private
`core/load-typescript.ts` leaf + `exit-codes.ts` comment fix (kept `toExitCode`). Verified green
independently: `nx build`, `nx test angular-typechecker` (unit), install-e2e 6/29, cache-e2e 9,
matrix-e2e 7, format:check, lint. Windows teardown prints benign `local registry exit 143`
(SIGTERM double-fork edge; CI is Linux-only).

PR #23 REVIEW ROUND (commit e7b8653): audited/triaged a 6-finding max-effort review (all
test-harness reliability/cleanup, none blocking) against code and fixed all 6 in one
`test(e2e)` commit -- `stripAllNpmConfig:true` in the 3 install-consuming specs (the shared
globalSetup sets `npm_config_registry` process-wide, inherited by the singleFork worker),
`AbortSignal.timeout` on the `mintCiToken` fetch, node_modules-excluded installed-tree walk,
`install-smoke` `removeTmpDir` teardown, a documented `collectDtsText` regular-files assumption,
and `NX_RUNNER_ENV_KEYS` made module-private (dead public export). Verified green: install-e2e
6/29, format:check, lint, fallow. Also fixed a prior CI regression: fallow flagged the vitest
`global-setup.ts` as unused (config-only reachability) -> declared it a fallow entry point
(057f610). PR #23 CI all-green across the full matrix; still merge-ready + human-gated.

**260704-wnq** (`add-nx-add-coverage-to-e2e-tests`, 2026-07-05, `--full --auto`) --
closed the post-v0.1.1 handoff test-coverage gap: added REAL `nx add angular-typechecker`
e2e coverage for ALL THREE package managers (npm, pnpm 11, yarn 4) in the existing
`angular-typechecker-install-e2e` project, consuming the shared Verdaccio globalSetup via
`inject()`. Prior state: NO spec ran the real `nx add` -- `verdaccio-publish` did
install-by-NAME + manual init; `nx-add-e2e` only the `nx g :init` substitute (both retained).
New specs (ALL assert the real `nx add` SUCCESS path -- our package installs + inits on every PM
once the PM's own gate is satisfied): `nx-add-npm` + `nx-add-yarn` (success -> init seeds
`angular-typechecker:typecheck` targetDefaults) and `nx-add-pnpm` (applies the recommended pnpm-11
build-approval workaround `allowBuilds: { nx: true }` in `pnpm-workspace.yaml` -- the fixture flags
exactly `nx@23.0.1`, which has a postinstall -- so the real `nx add` succeeds and init seeds
targetDefaults; the bare-fails-without-workaround context is in explanatory comments, not asserted);
+ a `corepack enable` step in the CI e2e job so nx add's child `yarn` resolves. DIRECTIVE PIVOT
(user, 2026-07-05): the pnpm spec originally PINNED the `ERR_PNPM_IGNORED_BUILDS` FAILURE as an
inverted tripwire; the user reframed it -- the gate is a pnpm<->nx-add interaction, NOT our defect,
so APPLY the workaround in the test (assert success) and add NO README caveat (commit `918696d`
replaced the failure version `7e61c06`). Observe-first CORRECTIONS locked from real runs:
(1) pnpm `--ignore-scripts` provisioning was a FALSE-GREEN -- the faithful repro is a plain
gated `pnpm install` + `npx nx add` (NOT `pnpm exec nx add`, whose pre-flight deps-status
check trips the gate before nx runs); the `packageManager: pnpm@11.9.0` pin self-routes to
the gated major (the fnm PATH pnpm 9.15.7 has no gate). (2) pnpm 11 REMOVED
`onlyBuiltDependencies` (replaced by `allowBuilds`) -- why the OSS repos' allowlists didn't
help. (3) yarn 4.17.0 defaults `npmMinimalAgeGate: 1440` and quarantined the seconds-old
Verdaccio version -> set `npmMinimalAgeGate: 0` in the fixture `.yarnrc.yml` (yarn's analog
of pnpm `minimumReleaseAge`). Full suite green (9 files / 32 tests), format + lint clean;
plan-check + code-review (0 blockers) + verify (6/6) all passed. Test-coverage only -- NO
version bump/tag/publish. On branch `test/nx-add-e2e-pnpm-yarn` (PR-bound; main is PR-only).
DECIDED (no longer open): the README pnpm caveat is DECLINED (PM issue, not our defect -- the
workarounds are encoded in the e2e tests instead). STILL OPEN from the handoff: only the optional
upstream Nx issue. (The pre-existing `tsconfig.spec.json` `inject()` -> `never` infra gap noted
here has since been RESOLVED by 260705-1wo, below.) Recorded to memory
([[nx-add-fails-on-pnpm-workspaces]]).

**260705-1wo** (`resolve-e2e-tsconfig-inject-never-tsconf`, 2026-07-05, `--research --analyze`,
stacked on the same `test/nx-add-e2e-pnpm-yarn` branch) -- resolved the pre-existing e2e
type-check gap. Root cause: `e2e/angular-typechecker-install-e2e/tsconfig.spec.json` `include`
omitted `src/global-setup.ts` (where the `declare module 'vitest'` `ProvidedContext` augmentation
lives), so a standalone `tsc -p tsconfig.spec.json` reported `inject()` -> `never` (TS2345/TS2339)
on every install-e2e spec (incl. the committed ones); AND no CI gate type-checked any e2e source
(`@nx/vitest:test` transpiles via esbuild, no type-check; the `test` matrix runs only
`-p angular-typechecker test-util`). FIX: (1) added `"src/global-setup.ts"` to the install-e2e
`tsconfig.spec.json` include; (2) `global-setup.ts` imported the vitest-3 `GlobalSetupContext`,
REMOVED in vitest 4 -- replaced with `import type { TestProject } from 'vitest/node'` +
`export default async function ({ provide }: TestProject)` (its successor; carries the same
`provide<T extends keyof ProvidedContext>` shape). GATE: a distinct `typecheck-e2e` target
(`nx:run-commands` -> `tsc --noEmit -p <project>/tsconfig.spec.json`, `cache:true`, inputs modeled
on `typecheck-drift`; NOT named `typecheck` -- overloaded) on ALL THREE e2e project.json, plus one
`-p`-LESS `- run: npx nx run-many -t typecheck-e2e` step in the existing CI `e2e` job (after
`npm ci`, before the tarball test step). The `-p`-less form is load-bearing: GUARD-01
(`ci-e2e-coverage-guard.spec.ts`) `.find()`s the first `^\s*-p` line, so a `-p`-less step leaves
the tarball test `-p` list as the match -- guard stays green. cache-e2e + matrix-e2e already
`tsc`-clean, so the gate is green over all 3 from the start. VERIFIED (authoritative tsc + runner,
NOT the LSP -- which still shows stale `inject()`->never): `tsc -p install-e2e/tsconfig.spec.json`
exit 0 (was exit 2 / 12 errors); `nx run-many -t typecheck-e2e` all 3 green; `nx test
angular-typechecker-install-e2e` still 32/32; GUARD-01/01b 4/4; lint + format clean. plan-check +
verify (5/5) passed. Commits `7764803` (fix) + `7549e65` (ci). Type-only/config -- NO version
bump/tag/publish.

POST-0.1.1-RELEASE FOLLOW-UPS (human-gated, strictly AFTER 0.1.1 publishes):
- Deprecate all prior npm releases: `npm deprecate 'angular-typechecker@<=0.1.0' "<broken
  packaging; non-functional as an Nx executor; upgrade to >=0.1.1>"` for 0.0.1/0.0.2/0.0.3/0.1.0
  (needs the user's npm auth), and mark their GitHub releases as pre-release + deprecated (they
  only ever worked via the programmatic API, never as an Nx executor).
- Exercise the README Programmatic API (`runTypecheck`) against a real Angular 22 solution
  tsconfig in the OSS repos (mmstack/ngx-lottie/radix) with the 0.1.1 tarball — the e2e suite now
  covers barrel-load, but a full `runTypecheck()` call against real Angular is done in re-validation.

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

Last session: 2026-07-05 -- addressed TWO code-review rounds on PR #24.
Round 2 (3 commits: `683330c` GUARD-01c [asserts every e2e project defines + ci.yml runs
`typecheck-e2e` -- run-many with 0 matches exits 0, a silent-green axis]; `1ebc3b4` hash
`@nx/vite` [all 3] + `@nx/devkit` [cache-e2e] in the typecheck-e2e cache inputs; `918a08d`
extract `expectSeededTypecheckTargetDefault` [5 specs] + pin `YARN_VERSION`/`PNPM_VERSION`).
Addressed M1+M2+Q1+Q4; DEFERRED Q3 (audit REFUTED its premise -- cache-e2e config
`testTimeout` is 180000, not 300000, so per-`it` 300000 there is intentional, not droppable),
Q2 (nx-add-e2e header already states its offline uniqueness), L1/L2/NIT (optional/out-of-scope).
Round 1 (3 commits `2dc2475`/`6e1ff21`/`ba22ebf`): extract shared e2e helpers [commandSucceeds
/ writeVerdaccioNpmrc / readTypecheckTargetDefault]; require pnpm 11 + real yarn 4 provisioning
in the guards; add `@nx/js` to the cache inputs + document the corepack Node coupling.
All findings across both rounds verified authoritatively (tsc exit 0, typecheck-e2e 3/3 green,
plugin 254 tests incl. GUARD-01c, install-e2e 32/32, test-util green, lint + format clean).
NOTE: BOTH rounds triggered a stale-LSP `new-diagnostics` burst (round 1 TS2304 "cannot find
writeFileSync"; round 2 TS6133 "never read" + a pre-existing TS1470 import.meta-under-CJS
false positive) -- each time tsc + a usage-count grep proved the code clean; the IDE tsserver
just lags after multi-file refactors (CLAUDE.md documents this). PRIOR: `/gsd-quick
--research --analyze` (260705-1wo) resolved the e2e `tsconfig.spec.json` `inject()`->never gap
+ added the `typecheck-e2e` CI gate.
Stopped at: 260705-1wo complete + verified (5/5), STACKED on the same branch after 260704-wnq
(real `nx add` e2e coverage for npm+pnpm+yarn, verified 6/6). Branch `test/nx-add-e2e-pnpm-yarn`
(off `origin/main` @ 2cab5ac; does NOT carry local `main`'s WIP handoff commit 7a767ca).
Commits so far: `97deb06` npm spec, `7e61c06` pnpm spec (superseded), `dd639c1` yarn + CI
corepack, `f0dd652` review comments, `53c669f`/`918696d`/`0331caf` (wnq pnpm-pivot + docs),
`7764803` e2e typecheck fix, `7549e65` typecheck-e2e CI gate -- plus the pending docs commit
for 260705-1wo. Full install-e2e suite green (9 files / 32 tests), `typecheck-e2e` green on all
3 e2e projects, format + lint clean. Both tasks are test/CI-coverage + type-only -- NO version
bump/tag/publish.
Next step: open ONE PR for `test/nx-add-e2e-pnpm-yarn` into `main` (main is PR-only; required
`ci` + CodeQL checks) carrying BOTH quick tasks, and self-merge once green. Optional history
tidy first: `7e61c06` (pnpm failure spec) + the pnpm half of `f0dd652` are superseded by
`918696d` -- `/compose-commits` could collapse the pnpm churn before the PR. THEN the remaining
open items: (1) optional upstream Nx issue (nx add tolerating pnpm's ignored-builds exit);
(2) optional follow-up -- guard that any FUTURE e2e project defines `typecheck-e2e` (the gate
currently covers only the 3 existing e2e projects). After those, `/gsd-new-milestone`. NOTE:
local `main` still carries the un-pushable WIP handoff commit 7a767ca (HANDOFF.json +
.continue-here.md) -- reset local main to `origin/main` after this PR merges.
