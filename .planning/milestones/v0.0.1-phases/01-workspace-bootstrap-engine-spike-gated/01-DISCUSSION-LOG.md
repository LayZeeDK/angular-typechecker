# Phase 1: Workspace Bootstrap + Engine Spike (GATED) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-27
**Phase:** 1-Workspace Bootstrap + Engine Spike (GATED)
**Areas discussed:** Bootstrap method, Workspace shape, Spike disposition, Gate scope, Gate harness & Phase-1 executor, Error-fixture placement, package.json scope
**Mode:** `--analyze` (trade-off tables) + user-requested phase-specific research (3 agents, persisted to `01-DISCUSS-RESEARCH.md`) + per-area `research_before_questions` web searches.

---

## Bootstrap method

| Option                           | Description                                                                                                                    | Selected |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------- |
| Move-aside + CNW temp            | Move .planning+CLAUDE.md aside -> create-nx-workspace in temp (--preset=apps) -> copy into root over preserved .git -> restore | [X]      |
| CNW temp + merge (no move-aside) | Generate in temp, copy/merge into root resolving root-file collisions                                                          |          |
| nx init in place + generators    | Official "existing repo" tool; but does not scaffold the integrated baseline                                                   |          |

**User's choice:** Move-aside + CNW temp (Recommended)
**Notes:** `create-nx-workspace .` is a hard error on non-empty dirs (Nx-source-verified); CNW's git init only runs in its own subdir so root .git is provably safe.

---

## Workspace shape

| Option                       | Description                                                                                                        | Selected |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------- |
| packages/ + minimal scaffold | Plugin at packages/angular-typechecker/; Phase-1 scaffold = plugin skeleton + one apps/ spike app + one green test | [X]      |
| libs/ + minimal scaffold     | Same scope, plugin under libs/ (prior prototype placement)                                                         |          |
| packages/ + full tree now    | Scaffold entire ARCHITECTURE.md tree up front                                                                      |          |

**User's choice:** packages/ + minimal scaffold (Recommended). Preset locked to `--preset=apps`.
**Notes:** Folder name cosmetic to Nx; packages/ idiomatic for publishable; integrated-vs-package distinction deprecated since Nx 20.

---

## Spike disposition

| Option                              | Description                                                                                | Selected |
| ----------------------------------- | ------------------------------------------------------------------------------------------ | -------- |
| Tracer bullet / promote             | Lean production-quality core engine entry, gate assertions as real tests; Phase 2 grows it | [X]      |
| Throwaway spike, rebuild in Phase 2 | Scrappy proof, no tests, discard after gate                                                |          |
| Hybrid: scrappy then promote on GO  | Scrappy first, refactor if GO                                                              |          |

**User's choice:** Tracer bullet / promote (Recommended)
**Notes:** Engine approach + architecture are locked, so little to "learn" that a rebuild would change (Pragmatic Programmer: if you can't throw it away, write tracer code). Keep it lean before GO.

---

## Gate scope

| Option                       | Description                                                                                      | Selected |
| ---------------------------- | ------------------------------------------------------------------------------------------------ | -------- |
| A + B on one app + one lib   | GATE A + GATE B on one app AND one local lib + one timing number; defer matrix/filtering/catalog | [X]      |
| Add out-of-project filtering | Also require filtering proof before GO                                                           |          |
| App-only (drop the library)  | GATE A + B on a single app only                                                                  |          |

**User's choice:** A + B on one app + one lib (Recommended)
**Notes:** Keep the lib because libraries most likely expose tsconfig/rootNames resolution diffs that could invalidate the engine choice; filtering is orthogonal post-processing (Phase 3).

---

## Gate harness & the Phase-1 executor

| Option                                       | Description                                                                                                                                           | Selected |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Minimal executor stub now                    | Default export -> runTypecheck, runnable via nx run; proves GATE A runtime through Nx's real require() loader; tracer-bullet seed of Phase 4 executor | [X]      |
| Core runTypecheck + CJS-require harness only | Executor deferred to Phase 4; runtime proven by a require() test harness on the built core .js                                                        |          |
| Full Phase 4 executor now                    | Complete adapter now (over-scopes Phase 1)                                                                                                            |          |

**User's choice:** Minimal executor stub now (Recommended)
**Notes:** Set package.json type:"commonjs" deliberately (Nx #18801 can mislabel @nx/js:tsc + node16 output). GATE A static = Vitest test reading dist .js (fs.readFileSync, not git grep -- dist is gitignored).

---

## Error-fixture placement

| Option                              | Description                                                                                                                              | Selected |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Separate fixture dir + own tsconfig | Deliberate-error component in its own dir/tsconfig; gate points runTypecheck at it; excluded from workspace graph; spike app stays green | [X]      |
| Errors inline in the spike app      | Errors in apps/ng-spike-app source (app permanently red)                                                                                 |          |

**User's choice:** Separate fixture dir + own tsconfig (Recommended)
**Notes:** Do not use @ts-nocheck (errors are the gate input); ensure no workspace file imports the fixture (exclude does not stop type-check of imported files, TS #36017).

---

## package.json scope

| Option                          | Description                                                                                                                                                                           | Selected |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Minimal-now + exact root pins   | Author type:commonjs + devkit dep + compiler-cli/ts peer ranges + engines.node + version pins; defer files/exports/keywords (P5) + dependency-checks (P3); root installs pinned exact | [X]      |
| Minimal-now + caret root ranges | Same authoring, root uses caret ranges                                                                                                                                                |          |
| Fuller package.json now         | Also author files/exports/keywords now (pull PKG-01 forward)                                                                                                                          |          |

**User's choice:** Minimal-now + exact root pins (Recommended)
**Notes:** Standard exact-dev / ranged-peer split; root nx 23.0.1 / Angular 22.0.4 / TS 6.0.3 exact for reproducible CI.

---

## Claude's Discretion

- Exact directory/file names within the minimal scaffold (`ng-spike-app`, fixture dir name), Vitest config layout, `nxCloud`/`.gitignore` merge mechanics.

## Deferred Ideas

- Out-of-project/node_modules filtering -> Phase 3; full 5-type matrix -> Phase 2/3 + 6; full NG8xxx catalog -> Phase 2; ESLint/Prettier/dependency-checks/module boundaries -> Phase 3; full executor adapter + cacheable target -> Phase 4; files/exports/keywords + publish hardening -> Phase 5; e2e tarball matrix + CI -> Phase 6.
