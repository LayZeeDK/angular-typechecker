---
phase: 01-workspace-bootstrap-engine-spike-gated
plan: 01
subsystem: infra
tags: [nx, nx-23, angular-22, typescript-6, create-nx-workspace, monorepo, bootstrap]

# Dependency graph
requires: []
provides:
  - 'Nx 23 integrated Angular monorepo (--preset=apps, classic project.json layout) at the repo root over the preserved .git/'
  - 'Root workspace manifest (package.json) with nx/@nx/* 23.0.1, typescript 6.0.3, @angular/compiler-cli 22.0.4 pinned EXACT (D-15)'
  - 'nx.json (classic apps shape), .gitignore, .editorconfig, .vscode/extensions.json, package-lock.json'
  - 'Preserved .git/ (HEAD unchanged) + restored .planning/ + CLAUDE.md byte-identical'
affects: [01-02-scaffold-plugin-spike-app, 01-03-tracer-bullet-core, 01-04-gate-specs, phase-2-core-engine]

# Tech tracking
tech-stack:
  added:
    - 'nx@23.0.1, @nx/devkit@23.0.1, @nx/js@23.0.1, @nx/plugin@23.0.1, @nx/vitest@23.0.1, @nx/angular@23.0.1, @nx/workspace@23.0.1'
    - 'typescript@6.0.3, @angular/compiler-cli@22.0.4 (root devDependency, exact pin)'
  patterns:
    - 'Mechanism B in-place bootstrap: move-aside + create-nx-workspace-in-temp + dotfile-safe copy over preserved .git/ + restore'
    - 'Exact-dev / ranged-peer split (D-15): root installs pinned EXACT; plugin-facing peer ranges stay broad (Phase 1+ plugin manifest)'

key-files:
  created:
    - 'nx.json'
    - 'package.json'
    - 'package-lock.json'
    - '.gitignore'
    - '.editorconfig'
    - '.vscode/extensions.json'
    - 'README.md'
  modified: []

key-decisions:
  - 'Bootstrap via Mechanism B (D-01/D-02/D-03): create-nx-workspace@23.0.1 --preset=apps in temp sibling, copied dotfile-safe over the preserved root .git/; HEAD provably unchanged'
  - "Committed the GSD orchestrator's STATE.md execution-started bookkeeping first to restore the documented clean-tree precondition (became the canonical pre-bootstrap HEAD 4a848a4)"
  - 'Renamed CNW-seeded root package.json name @atc-temp/source -> @angular-typechecker/source (temp dir name leaked)'
  - '--preset=apps is a minimal empty integrated workspace: CNW 23.0.1 does NOT emit tsconfig.base.json/.prettierrc/apps/.gitkeep; these materialize when the first project is generated (Plan 01-02 owns creating/validating tsconfig.base.json)'

patterns-established:
  - 'Mechanism B bootstrap runbook: clean-tree precondition -> capture HEAD -> mv .planning/+CLAUDE.md to mktemp scratch -> CNW --skipGit into named temp sibling -> cp -R temp/. ./ (dotfile-safe) -> rm node_modules+temp -> restore from scratch -> npm install -> exact pins -> nx report -> HEAD-unchanged + no-clobber assertions -> blocking human-verify before commit'
  - 'Stage generated files BY NAME (never git add .); single-writer STATE.md/ROADMAP.md in sequential main-tree mode'

requirements-completed: [WS-01, CMP-01]

# Metrics
duration: ~22min
completed: 2026-06-27
---

# Phase 01 Plan 01: Workspace Bootstrap (Mechanism B) Summary

**Nx 23 integrated Angular monorepo (`--preset=apps`) bootstrapped in-place over the preserved `.git/` via create-nx-workspace-in-temp + dotfile-safe copy + restore, with the locked toolchain (nx 23.0.1 / @angular/compiler-cli 22.0.4 / typescript 6.0.3) pinned EXACT and HEAD provably unchanged.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-06-27T15:11Z (approx)
- **Completed:** 2026-06-27T15:34Z
- **Tasks:** 2 auto + 1 blocking human-verify checkpoint (3 total)
- **Files modified:** 7 created (bootstrap commit)

## Accomplishments

- The repo is now an Nx 23 integrated Angular monorepo created via `create-nx-workspace@23.0.1 --preset=apps` despite the pre-existing `.git/` + `.planning/` (WS-01) -- the classic `project.json` layout (no TS-solution `isTsSolutionSetup` artifacts).
- The pre-existing `.git/` was provably preserved: post-bootstrap `HEAD == 4a848a4ff29be21ba7b06c5f43d68bc54cf5944f` (the captured pre-bootstrap SHA) -- no history rewrite.
- `.planning/` + `CLAUDE.md` were moved aside and restored byte-identical (`git diff --quiet -- .planning CLAUDE.md` clean; no clobber of tracked files).
- The locked toolchain resolves: `nx report` lists nx 23.0.1 and @nx/devkit/js/plugin/vitest/angular/eslint/workspace all at 23.0.1; `npm ls` confirms `@angular/compiler-cli@22.0.4`, `nx@23.0.1`, `typescript@6.0.3` pinned EXACT at the root (CMP-01, D-15).
- The final commit was gated on a human review of the full `git status` + HEAD-unchanged check (blocking checkpoint, `autonomous: false`); approval received before commit.

## Task Commits

1. **(pre) Restore clean-tree precondition** - `4a848a4` (docs) -- committed the GSD orchestrator's STATE.md execution-started bookkeeping so the clean-tree precondition held; this is the canonical pre-bootstrap HEAD.
2. **Task 1: Capture pre-bootstrap state + move planning artifacts aside** - no commit by design (move-aside of working-tree files; restored byte-identical in Task 2 so no index delete is ever committed).
3. **Task 2 + Task 3: Generate workspace, copy over preserved `.git/`, human-verify, commit** - `ab182b2` (feat) -- the bootstrap commit (7 files: nx.json, package.json, package-lock.json, .gitignore, .editorconfig, .vscode/extensions.json, README.md), made only after the blocking human-verify checkpoint cleared.

**Plan metadata:** (this commit) (docs: complete plan -- SUMMARY.md + STATE.md + ROADMAP.md)

## Files Created/Modified

- `nx.json` - Nx 23 integrated workspace config (classic `--preset=apps` shape)
- `package.json` - Root workspace manifest; name `@angular-typechecker/source`; nx/@nx/\* 23.0.1 + typescript 6.0.3 + @angular/compiler-cli 22.0.4 pinned EXACT (D-15)
- `package-lock.json` - Lockfile for the pinned root toolchain
- `.gitignore` - CNW-generated ignore set (dotfile copy verified -- Pitfall 5)
- `.editorconfig` - CNW-generated editor config
- `.vscode/extensions.json` - CNW-generated VS Code recommendations
- `README.md` - CNW-generated workspace README

## Decisions Made

- **Mechanism B (D-01/D-02/D-03):** `create-nx-workspace .` in-place is a hard error on a non-empty dir; generated into a temp sibling (`atc-temp`) with `--skipGit` (so CNW's `git init` ran only inside the temp dir and never touched the root `.git/`), then copied dotfile-safe over the preserved `.git/`. Flags confirmed via `--help` first (D-03): `--preset=apps --packageManager=npm --nxCloud=skip --skipGit --interactive=false --defaultBase=main`.
- **Exact pins at root, broad peers in plugin (D-14/D-15):** root devDependencies pinned exact for reproducible dev/CI; `@angular/compiler-cli` installed at the root as a devDependency so the spike app + core can resolve it (it stays a PEER in the plugin's own manifest, authored in Plan 01-02).
- **`--preset=apps` shape:** chosen for an empty integrated workspace with classic `project.json` (D-04). Confirmed it does not force a starter app and does not flip `isTsSolutionSetup`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Tree was dirty on entry (clean-tree precondition not met)**

- **Found during:** Task 1 (clean-tree precondition check)
- **Issue:** `.planning/STATE.md` carried the GSD orchestrator's own "Phase 01 execution started" bookkeeping (timestamp + status + plan counter -- no user work-in-progress). Task 1's acceptance criterion and the orchestrator's NON-NEGOTIABLE safety note require an empty `git status --porcelain` before any move-aside.
- **Fix:** Committed the GSD bookkeeping as `docs(01-01): mark phase 01 execution started in STATE.md` (`4a848a4`), restoring the documented precondition exactly. This became the canonical pre-bootstrap HEAD. The move-aside would have preserved the change regardless (it travels with `.planning/`), so there was never a clobber risk; committing simply made the precondition true rather than proceeding against a hard safety rule.
- **Files modified:** `.planning/STATE.md`
- **Verification:** `git status --porcelain` empty after the commit; HEAD captured as `4a848a4`.
- **Committed in:** `4a848a4`

**2. [Rule 1 - Bug] CNW seeded the root package.json `name` with the temp dir name**

- **Found during:** Task 2 (post-`npm install` inspection)
- **Issue:** `create-nx-workspace atc-temp` set the root `package.json` `name` to `@atc-temp/source` (the temp dir name leaked into the workspace identity).
- **Fix:** Renamed to `@angular-typechecker/source` before committing.
- **Files modified:** `package.json`
- **Verification:** Committed `package.json` shows `"name": "@angular-typechecker/source"`.
- **Committed in:** `ab182b2` (bootstrap commit)

---

**Total deviations:** 2 auto-fixed (1 blocking precondition, 1 name-leak bug)
**Impact on plan:** Both necessary for correctness/safety. No scope creep. The precondition commit is the intended GSD bookkeeping; the rename fixes a leaked temp identifier.

## Issues Encountered

- **`--preset=apps` is a minimal empty integrated workspace (not a defect).** CNW 23.0.1 did NOT emit a root `tsconfig.base.json`, a `.prettierrc`, or an `apps/.gitkeep` -- the plan frontmatter `files_modified` optimistically listed these. They materialize when the first project is generated. **Plan 01-02 now owns creating/validating `tsconfig.base.json`** (it patches the plugin tsconfig `module` to `nodenext` and scaffolds the plugin + spike app, which is when the workspace base tsconfig and prettier config land). This matches D-04 (empty integrated workspace) and is consistent with the documented scaffold variance (Assumption A3).
- **Verify-command false negative (rg vs ANSI):** the plan's Task 2 `<automated>` check `rg -q "nx +23\.0\.1"` returned non-zero against `nx report`'s ANSI-colorized output (the version line is `<ESC>nx<ESC> : <ESC>23.0.1<ESC>`). Color-stripped (`sed 's/\x1b\[[0-9;]*m//g'`) the pattern matches and the toolchain is GO. Functional result is GO; only the raw assertion regex needed color handling.
- **npm `allow-scripts` postinstall gate:** npm's script-allowlist blocked the postinstall scripts of `nx`, `less`, `unrs-resolver`, and `@parcel/watcher`. `nx report` and the full toolchain resolve correctly regardless (nx's postinstall is a best-effort `try/catch`). `npm audit` flagged some transitive dev-tooling advisories -- audit/hardening is deferred to Phase 5 per D-14, out of scope for this bootstrap.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The Nx 23 integrated workspace skeleton is in place over the preserved `.git/`; every later Plan/Phase builds on it.
- **Plan 01-02** is unblocked: scaffold the plugin (`packages/angular-typechecker/`) + spike app (`apps/ng-spike-app`), PATCH the generated plugin tsconfig `module: commonjs -> nodenext` (BLOCKING for GATE A), author the Phase-1 plugin `package.json`, and -- per the variance above -- create/validate the root `tsconfig.base.json` (and `.prettierrc`) when the first project is generated.
- No blockers. HEAD intact, planning artifacts preserved, toolchain resolved.

## Self-Check: PASSED

- Files verified present: nx.json, package.json, package-lock.json, .gitignore, .editorconfig, .vscode/extensions.json, README.md, 01-01-SUMMARY.md
- Commits verified present: `4a848a4` (clean-tree precondition), `ab182b2` (bootstrap)

---

_Phase: 01-workspace-bootstrap-engine-spike-gated_
_Completed: 2026-06-27_
