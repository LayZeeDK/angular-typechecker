---
phase: 34-per-project-sarif-categories-in-ci
plan: 01
subsystem: infra
tags: [ci, sarif, github-code-scanning, nx, upload-sarif, discovery, drift-guard]

# Dependency graph
requires:
  - phase: 33-diagnostic-family-sarif-rule-metadata
    provides: per-run SARIF rule tags/level/help (each per-project analysis inherits family metadata)
provides:
  - CI discovery of angular-typechecker:typecheck executor consumers (tools/ci/list-typecheck-projects.mjs)
  - CI multi-run SARIF merge with per-run automationDetails.id = angular-typecheck/<project> (tools/ci/merge-sarif.mjs)
  - MULTI-02 drift guard + MULTI-01 merge-shape specs (in-plugin, ride the test target)
  - rewired code-scanning job (per-project multi-run upload, no category input)
affects: [35-proof, 36-gate-doc]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CI-side SARIF assembly (reporter stays single-run; multi-run merged in CI -> no release)"
    - "executor-id discovery + independent-enumeration drift guard (mirrors the e2e GUARD-01b pattern)"
    - "per-run automationDetails.id as the Code Scanning category (single no-category upload-sarif)"

key-files:
  created:
    - tools/ci/list-typecheck-projects.mjs
    - tools/ci/merge-sarif.mjs
    - packages/angular-typechecker/src/multi-typecheck-discovery-guard.spec.ts
    - packages/angular-typechecker/src/merge-sarif.spec.ts
  modified:
    - .github/workflows/ci.yml

key-decisions:
  - "Design B: merge-sarif.mjs folds the per-project generate loop into the merge (spawnSync the shipped dist CLI per project from repo root); no bash-JSON footgun, unit-testable, injection-free."
  - "Discovery filters by the executor id (never a typecheck target-NAME match); root-scoping to apps/+libs/ excludes the root @angular-typechecker/source dogfood and e2e fixtures by construction."
  - "Drift guard's independent enumeration subtracts BOTH the workspace-root project.json AND any e2e/ path -- the root uses the executor on clean fixtures, so an unfiltered enum yields 5 vs the discovery script's 4 (would false-RED)."
  - "Merge is plain JSON concat (no node-sarif-builder); envelope {version,$schema} copied from the first valid run; zero runs -> write nothing so the [ -s ] produced-guard skips the upload."
  - "Upload drops the category input; the per-run automationDetails.id (angular-typecheck/<project>) is the per-analysis category (a single category would re-trigger GitHub's multi-run-same-category rejection)."
  - "D-06 additive-only: only tools/ci/*.mjs + 2 test-only specs + ci.yml changed; core/**, src/cli/**, package.json byte-unchanged; version held at 0.2.3 (no bump)."

patterns-established:
  - "Pattern: CI reporting stays out of the published package -- the multi-run shape is a CI merge, keeping MULTI a no-release change."
  - "Pattern: any drift in the reported project set is a loud RED (discovery CLI output must equal an independent root-agnostic enumeration)."

requirements-completed: [MULTI-01, MULTI-02]

coverage:
  - id: D1
    description: "Discovery script (list-typecheck-projects.mjs) yields exactly the four executor consumers (ng-spike-app, typecheck-consumer, typecheck-consumer-dep, typecheck-walk-consumer) by the angular-typechecker:typecheck executor filter, sorted, each { name, tsConfig[] }; the root dogfood + e2e fixtures are absent; throws on an empty set."
    requirement: MULTI-02
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/multi-typecheck-discovery-guard.spec.ts#discovery output equals the independent root-agnostic enumeration"
        status: pass
      - kind: unit
        ref: "packages/angular-typechecker/src/multi-typecheck-discovery-guard.spec.ts#skips a subdir without project.json and a falsy-name project"
        status: pass
      - kind: other
        ref: "node tools/ci/list-typecheck-projects.mjs (repo-root smoke: 4 consumers, @angular-typechecker/source absent, ng-spike tsconfig exact)"
        status: pass
    human_judgment: false
  - id: D2
    description: "merge-sarif.mjs produces one merged multi-run SARIF: one run per non-empty consumer, each stamped automationDetails.id = angular-typecheck/<project>, envelope {version,$schema} preserved from the first valid run, empty-stdout projects skipped, and NO file written when zero runs are collected."
    requirement: MULTI-01
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/merge-sarif.spec.ts#merges one run per non-empty consumer, stamps angular-typecheck/<name>, skips the empty project, preserves the envelope"
        status: pass
      - kind: unit
        ref: "packages/angular-typechecker/src/merge-sarif.spec.ts#writes NO output file when every consumer produces empty stdout (zero runs)"
        status: pass
      - kind: other
        ref: "node tools/ci/merge-sarif.mjs after nx build (smoke: 4-run SARIF, ids angular-typecheck/<project>, version 2.1.0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "MULTI-02 drift guard fails loud (RED) if the discovery script's name set diverges from the independent root-agnostic enumeration; non-vacuous (asserts the enumeration is non-empty before the equality)."
    requirement: MULTI-02
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/multi-typecheck-discovery-guard.spec.ts (full file, npx nx test angular-typechecker)"
        status: pass
    human_judgment: false
  - id: D4
    description: "code-scanning job rewired: atc-sarif step runs node tools/ci/merge-sarif.mjs (keeping id + the [ -s ] produced-guard) and the angular-typechecker upload carries NO category input; fallow steps, checkout/setup/npm ci/nx build, job permissions, fetch-depth: 0, SHA-pinned upload-sarif, path-gated if, and the ci aggregate needs[] are byte-unchanged."
    requirement: MULTI-01
    verification:
      - kind: other
        ref: "structural git grep (merge-sarif wired; 2 SHA pins; 2 fork gates; no real category: key; old hardcoded line removed) + git diff scope"
        status: pass
      - kind: unit
        ref: "packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts (GUARD-01/01b/01c/01f parse ci.yml; still green after the code-scanning edit)"
        status: pass
    human_judgment: false
  - id: D5
    description: "MULTI-01 end-to-end: GitHub Code Scanning ACCEPTS the merged multi-run file and lands N distinct angular-typecheck/<project> analyses."
    requirement: MULTI-01
    verification:
      - kind: manual_procedural
        ref: "real-CI only: gh api repos/.../code-scanning/analyses?tool_name=angular-typechecker&ref=refs/pull/<n>/merge (Phase 35 automates)"
        status: unknown
    human_judgment: true
    rationale: "Code Scanning ingestion is async/server-side; local schema-validate + actionlint + act-compat all pass while GitHub can still reject the multi-run-same-category class. This plan WIRES it correctly; Phase 35 (PROOF) automates the assertion. Not gated locally per the plan's real_ci_only note."

# Metrics
duration: 12min
completed: 2026-07-21
status: complete
---

# Phase 34 Plan 01: Per-project SARIF categories in CI Summary

**CI code-scanning now merges one SARIF run per angular-typechecker:typecheck consumer (auto-discovered, drift-guarded) into a single multi-run file stamped angular-typecheck/<project>, uploaded with no category input -- no published-package change.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-07-21
- **Tasks:** 3
- **Files modified:** 5 (2 new CI scripts, 2 new specs, 1 workflow)

## Accomplishments

- `tools/ci/list-typecheck-projects.mjs` discovers the four executor consumers under apps/+libs/ by the `angular-typechecker:typecheck` executor id (never a target-NAME match), emitting sorted `{ name, tsConfig[] }`; throws on an empty set. The root `@angular-typechecker/source` dogfood and e2e fixtures are excluded by root-scoping.
- `tools/ci/merge-sarif.mjs` (Design B) runs the shipped dist CLI once per discovered project from the repo root, stamps each run `automationDetails.id = angular-typecheck/<project>`, merges to one multi-run file preserving the `{version,$schema}` envelope, and writes nothing when zero runs are collected. Pure JSON merge -- no `node-sarif-builder`, fixed `spawnSync` arg array (no shell).
- MULTI-02 drift guard + MULTI-01 merge-shape specs ride the plugin `test` target; the guard proves discovery equals an independent root-agnostic enumeration (subtracting root + e2e), and the merge-shape spec drives the real `merge-sarif.mjs` as a subprocess over a temp workspace.
- The `code-scanning` job now runs `node tools/ci/merge-sarif.mjs` and uploads the multi-run file with NO `category` input; every security invariant and the fallow steps are byte-unchanged, and the job stays out of the `ci` aggregate.

## Task Commits

Each task was committed atomically:

1. **Task 1: CI discovery + merge scripts** - `9d8ba99` (feat)
2. **Task 2: Drift-guard + merge-shape specs** - `5d7247e` (test)
3. **Task 3: Rewire the ci.yml code-scanning job** - `b3eb306` (ci)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `tools/ci/list-typecheck-projects.mjs` (new) - executor-id discovery of apps/+libs/ consumers -> sorted `{ name, tsConfig[] }`; CLI-entry prints compact JSON; throws on empty.
- `tools/ci/merge-sarif.mjs` (new) - pure `mergeSarifRuns(entries)` + a CLI entry that spawns the shipped CLI per discovered project and writes the merged multi-run `angular-typechecker.sarif` (or nothing on zero runs).
- `packages/angular-typechecker/src/multi-typecheck-discovery-guard.spec.ts` (new) - MULTI-02 drift guard (execs the discovery CLI == independent enumeration, root+e2e subtracted, non-vacuous) + a B3 robustness case.
- `packages/angular-typechecker/src/merge-sarif.spec.ts` (new) - MULTI-01 merge-shape (subprocess over a temp workspace + stub bin: 2-run merge, exact ids, envelope preserved, empty project skipped; zero-run writes no file).
- `.github/workflows/ci.yml` (modified) - `code-scanning` job's `atc-sarif` step + angular-typechecker upload rewired; job header + upload comments updated; fallow steps, invariants, and `ci` aggregate byte-unchanged.

## Decisions Made

See `key-decisions` in the frontmatter. Headline: Design B (merge folds the generate loop) + executor-id discovery + the load-bearing root+e2e subtraction in the guard + no-category multi-run upload; all CI-side, so D-06 additive-only holds and the version stays 0.2.3.

## Deviations from Plan

None - plan executed exactly as written. (No Rule 1/2/3 auto-fixes were required; no architectural Rule 4 escalation.)

Notable faithful-to-plan detail: `merge-sarif.mjs` factors the CLI-entry body into a small internal `collectEntries(root)` helper alongside the required pure `mergeSarifRuns(entries)` export -- the plan explicitly calls for the thin CLI entry + the pure export, and the merge-shape spec exercises the whole CLI as a subprocess (no cross-project import), so this matches the plan's intent exactly.

## Issues Encountered

None during implementation. Prettier wrapped the long `node:fs` import lines in both new specs (format:check is a gate) -- applied `prettier --write`, whitespace-only, re-verified clean.

## Verification Results

All local gates green (recorded output):

- `npx nx test angular-typechecker` (--skip-nx-cache): **55 files, 569 tests passed** (was 565 in Phase 33 -> +4 from the two new specs). Includes the GUARD-01/01b/01c/01f ci.yml-parsing specs, confirming the code-scanning edit did not break the e2e-job invariants.
- `npx nx typecheck angular-typechecker` (--skip-nx-cache): green (`tsc --noEmit` for tsconfig.spec.json + tsconfig.drift.json + tsconfig.tools.json; the tools tsconfig type-checks the two new `.mjs`).
- `npx nx lint angular-typechecker`: green (maxWarnings:0; the merge spec imports only node builtins + vitest + `@workspace/test-util`, so `@nx/enforce-module-boundaries` stays clean).
- `npx nx format:check`: clean.
- Discovery smoke (`node tools/ci/list-typecheck-projects.mjs`): exactly the 4 consumers, sorted; `@angular-typechecker/source` absent; `ng-spike-app` tsConfig = `apps/ng-spike-app/tsconfig.app.json` (coverage not reduced).
- Merge smoke (`node tools/ci/merge-sarif.mjs` after `nx build`): 4-run `angular-typechecker.sarif`, ids `angular-typecheck/{ng-spike-app,typecheck-consumer,typecheck-consumer-dep,typecheck-walk-consumer}`, `version: 2.1.0`, `$schema` present; no `node-sarif-builder` import.
- ci.yml structural: `merge-sarif.mjs` wired into `atc-sarif`; both `upload-sarif` refs SHA-pinned (`@7188fc36...`, count 2); both fork-PR skip gates present (count 2); NO real `category:` input key; fallow steps + `ci` aggregate `needs[]` byte-unchanged.
- D-06 additive-only: `git diff HEAD~3..HEAD` touches only `.github/workflows/ci.yml`, the two new specs, and the two new `tools/ci/*.mjs`; `packages/angular-typechecker/src/core/**`, `src/cli/**`, and `package.json` byte-unchanged; version held at 0.2.3.

**Real-CI-only (NOT a local gate):** MULTI-01 end-to-end -- that GitHub accepts the merged file and lands N distinct `angular-typecheck/<project>` analyses -- is an async/server-side observation. Local schema-validate/actionlint/act-compat pass while GitHub can still reject the multi-run-same-category class. This plan wires it correctly; Phase 35 (PROOF) automates the `gh api .../code-scanning/analyses` assertion. Coverage deliverable D5 is flagged `human_judgment: true` accordingly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 35 (PROOF) can now poll `gh api .../code-scanning/analyses?tool_name=angular-typechecker&ref=refs/pull/<n>/merge` against a real PR to confirm the N distinct `angular-typecheck/<project>` analyses land (the D5 real-CI proof).
- Phase 36 (GATE/DOC) can promote `code-scanning` into the required `ci` aggregate and un-path-gate it -- deliberately deferred here (the job stays absent from `needs[]`).
- No blockers.

## Self-Check: PASSED

Created files (all present on disk and committed):
- FOUND: tools/ci/list-typecheck-projects.mjs
- FOUND: tools/ci/merge-sarif.mjs
- FOUND: packages/angular-typechecker/src/multi-typecheck-discovery-guard.spec.ts
- FOUND: packages/angular-typechecker/src/merge-sarif.spec.ts
- FOUND: .github/workflows/ci.yml (modified)

Task commits (verified via git log):
- FOUND: 9d8ba99 (feat, Task 1)
- FOUND: 5d7247e (test, Task 2)
- FOUND: b3eb306 (ci, Task 3)

---
*Phase: 34-per-project-sarif-categories-in-ci*
*Completed: 2026-07-21*
