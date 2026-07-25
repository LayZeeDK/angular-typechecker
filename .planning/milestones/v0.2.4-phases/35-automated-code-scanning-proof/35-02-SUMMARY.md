---
phase: 35-automated-code-scanning-proof
plan: 02
subsystem: ci
tags: [sarif, code-scanning, gh-api, set-membership, fail-loud, proof, ci]

# Dependency graph
requires:
  - phase: 35-automated-code-scanning-proof
    provides: 35-01 isolated one-per-family fixture + drift-lock locking the four (family tag, severity) tuples the assert checks
  - phase: 34-per-project-sarif-categories-in-ci
    provides: the tools/ci/*.mjs pure-node CI-helper precedent (merge-sarif.mjs, list-typecheck-projects.mjs) + the code-scanning upload shape
  - phase: 33-diagnostic-family-sarif-rule-metadata
    provides: familyOf + per-rule properties.tags/defaultConfiguration.level (the family/severity contract the assert asserts landed)
provides:
  - tools/ci/assert-code-scanning.mjs -- exported pure missingTuples(alerts, expected) + a bounded gh-api poll/assert CLI entry (sarifs/{id} -> analyses -> alerts set-membership on refs/pull/<n>/merge) + an ASSERT_ALERTS_FILE test seam
  - Local, GitHub-free subprocess spec proving the matcher's GREEN / RED (fail-loud) / category-isolation behavior
affects: [35-03, code-scanning-proof CI job]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "gh-api bounded-poll + client-side category filter + set-membership assert as a pure-node tools/ci/*.mjs (exported matcher + injection-safe execFileSync CLI entry + env test seam)"
    - "ASSERT_ALERTS_FILE env seam makes a real-CI-only assert's set-membership decision + RED exit unit-testable locally WITHOUT GitHub"
    - "Plugin-side subprocess spec drives the tools/ci .mjs via execFileSync + the env seam (never a static cross-project import -- @nx/enforce-module-boundaries + vitest module runner both block it)"

key-files:
  created:
    - tools/ci/assert-code-scanning.mjs
    - packages/angular-typechecker/src/assert-code-scanning.spec.ts
  modified: []

key-decisions:
  - "Flush-safe fail-loud via `process.exitCode = 1` in a `.catch` (the shipped bin.ts D-02 pattern), NOT an uncaught top-level-await rejection -- deterministic exit 1 + a clean one-line stderr message the spec asserts on"
  - "Category filter lives in the CLI entry (BOTH the seam and normal branches); the exported `missingTuples` stays category-agnostic (receives already-scoped alerts) -- Pattern 2, proven load-bearing by the category-isolation test"
  - "Included the analyses-API category cross-check (RESEARCH Open-Q2 / Discretion) -- one extra gh api GET proving an analysis landed under angular-typecheck-proof, independent of the alerts loop"
  - "Spec normalizes the subprocess into { status, stdout, stderr } rather than a try/catch-per-test -- each assertion targets the exact exit code (0 vs 1) and the RED cases additionally assert stderr names the missing tuple, so no assertion can pass vacuously"
  - "EXPECTED (typescript/error, template-type-check/error, extended-diagnostics/warning, tool/error) is cross-referenced in-code to the 35-01 drift-lock describe block + diagnostic-family.ts -- the CI proof's expected set cannot silently drift from what the reporter emits"

patterns-established:
  - "Pattern: a real-CI-only assertion script ships with a pure exported core + an env test seam so its decision logic + fail-loud path have a fast local tripwire, while the ingestion round-trip stays real-CI-only"

requirements-completed: []  # PROOF-01/02 span 35-01 (fixture+drift-lock) + 35-02 (assert+local RED proof) + 35-03 (CI job + real-CI ingestion). Real ingestion is provable ONLY in real CI (the phase Nyquist point), so both stay Pending -> closed at phase verification once the code-scanning-proof job is green on a real PR.

coverage:
  - id: D1
    description: "The exported pure matcher missingTuples(alerts, expected) returns [] when all four (family tag, severity) tuples are present and the missing tuples otherwise"
    requirement: PROOF-01
    verification:
      - kind: unit
        ref: "Task-1 automated import check (node -e import missingTuples): GREEN -> [], RED (drop tool) -> 1 missing"
        status: pass
    human_judgment: false
  - id: D2
    description: "The real assert-code-scanning.mjs, driven as a subprocess via the ASSERT_ALERTS_FILE seam, exits 0 on all-four-present, exits 1 naming the missing family on a missing alert (PROOF-02), and exits 1 when a right-tag/right-severity alert sits under a dogfood category (category isolation is load-bearing)"
    requirement: PROOF-02
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/assert-code-scanning.spec.ts (nx test angular-typechecker, 3 tests) -- GREEN/RED/category-isolation"
        status: pass
    human_judgment: false
  - id: D3
    description: "The SARIF -> Code Scanning ingestion assertion (poll sarifs/{id} to complete, then set-membership over refs/pull/<n>/merge alerts under the proof category) -- provable ONLY in real CI"
    requirement: PROOF-01
    verification:
      - kind: other
        ref: "real-CI-only: the code-scanning-proof job on a PR (35-03) runs `node tools/ci/assert-code-scanning.mjs`"
        status: deferred
    human_judgment: false

# Metrics
duration: ~10m
completed: 2026-07-21
status: complete
---

# Phase 35 Plan 02: Code Scanning proof gh-api poll/assert Summary

**A lean pure-node `tools/ci/assert-code-scanning.mjs` that polls `gh api` (sarifs/{id} -> analyses -> alerts on `refs/pull/<n>/merge`) and asserts SET-MEMBERSHIP of the four (family tag, severity) tuples under the dedicated `angular-typecheck-proof` category -- failing loud (exit 1) on any missing tuple or timeout -- plus a local, GitHub-free subprocess spec proving its GREEN / RED / category-isolation behavior via an `ASSERT_ALERTS_FILE` seam.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-21T19:17:09Z
- **Completed:** 2026-07-21
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- Built `tools/ci/assert-code-scanning.mjs` mirroring the `merge-sarif.mjs` / `list-typecheck-projects.mjs` shape exactly (no shebang, `node:*` imports, exported pure function + `process.argv[1] === fileURLToPath(import.meta.url)` CLI-entry guard, JSDoc types).
- Exported the PURE `missingTuples(alerts, expected)` matcher: returns the expected tuples with no alert matching `(rule.tags includes tag) && rule.severity === severity`. No I/O, no spawn.
- Wired the CLI entry: (1) deterministic wait handle -- bounded poll of `code-scanning/sarifs/{id}` to `processing_status === complete` (throws immediately on `failed`, throws on timeout); (2) analyses cross-check -- a `code-scanning/analyses` GET asserting an analysis under `angular-typecheck-proof`; (3) bounded set-membership retry over `code-scanning/alerts?ref=refs/pull/<n>/merge`, client-filtered to the proof category before `missingTuples`. Fail-loud everywhere.
- Injection-safe: `execFileSync('gh', ['api', pathAndQuery])` (fixed arg array, no `shell:true`); PR data (`PR_NUMBER`/`SARIF_ID`) read from env, `GH_TOKEN` read by `gh` from env -- never interpolated into a shell string (T-35-08).
- Added the `ASSERT_ALERTS_FILE` env test seam: reads a canned alerts payload, applies the same category filter + `missingTuples`, throws (exit 1) on any miss -- never calls `gh`.
- Added `packages/angular-typechecker/src/assert-code-scanning.spec.ts`: drives the REAL `.mjs` as a subprocess (`execFileSync('node', ...)`) through the seam, proving GREEN (exit 0), RED (exit 1 naming `tool/error`, PROOF-02), and category isolation (a right-tag/right-severity alert under a dogfood category is filtered out -> tuple missing -> exit 1). No static `.mjs` import (module boundary + vitest runner both block it).

## Task Commits

Each task was committed atomically (conventional scope `35-02`):

1. **Task 1: `tools/ci/assert-code-scanning.mjs` (exported matcher + gh-api poll/assert)** - `d9cdec0` (ci)
2. **Task 2: the matcher subprocess unit test (GREEN / RED / category-isolation)** - `b1f417f` (test)

## Files Created/Modified
- `tools/ci/assert-code-scanning.mjs` - Exported pure `missingTuples`; `ghApi`/`sleep` helpers; `waitForProcessing`/`assertAnalysisCategory`/`assertAlerts`/`assertFromFile`; CLI entry reading `PR_NUMBER`/`SARIF_ID`/`ASSERT_ALERTS_FILE` from env; flush-safe `process.exitCode = 1` on any failure.
- `packages/angular-typechecker/src/assert-code-scanning.spec.ts` - Subprocess spec via the `ASSERT_ALERTS_FILE` seam; `alert()`/`allFourFamilies()` factories; normalized `runAssert -> { status, stdout, stderr }`; GREEN/RED/category-isolation.

## Decisions Made
- **Flush-safe fail-loud** (`process.exitCode = 1` in a `.catch`, the shipped `bin.ts` D-02 pattern) rather than an uncaught top-level-await rejection: deterministic exit 1 and a clean one-line stderr message (`proof alerts missing expected ... tuples: tool/error`) the spec asserts on. Avoids relying on TLA-at-block-scope rejection semantics.
- **Category filter in the CLI entry, matcher category-agnostic** (Pattern 2): both the seam and normal branches client-filter to `most_recent_instance.category === angular-typecheck-proof` BEFORE `missingTuples`, so the pure matcher stays simple and the category-isolation test proves the filter is load-bearing (a dogfood-category `tool` alert does NOT satisfy the `tool` tuple).
- **Analyses-API cross-check included** (RESEARCH Open-Q2 / Discretion): one extra `gh api` GET proving an analysis landed under the dedicated category, independent of the alerts loop.
- **Normalized subprocess result in the spec** (`{ status, stdout, stderr }`) instead of try/catch-per-test: each assertion targets the exact exit code, and the RED cases additionally assert the stderr names the missing tuple -- no vacuous pass.
- **EXPECTED cross-referenced in-code** to the 35-01 drift-lock describe block + `diagnostic-family.ts`, so the CI proof's expected set cannot silently drift from what the reporter emits.

## Deviations from Plan

None - the plan executed exactly as written. (Prettier auto-normalized the spec's line-wrapping to the repo idiom -- e.g. wrapping `findWorkspaceRoot(dirname(fileURLToPath(...)))` across lines, matching `merge-sarif.spec.ts` -- a cosmetic reflow via `nx format:check`, not a logic change.)

## Issues Encountered
- **`nx test` does not type-check specs.** As the repo's standing lesson notes, `nx test` (vitest/esbuild) green-masks spec type errors, so the spec was additionally type-checked with `tsc --noEmit -p packages/angular-typechecker/tsconfig.spec.json` (exit 0) beyond the passing `nx test`.
- **`.planning/config.json` shows an orchestrator-owned change** (`_auto_chain_active: true -> false`) in the working tree -- not part of this plan's work and intentionally left uncommitted (not in the docs-commit set).

## User Setup Required
None - no external service configuration required. The real ingestion assertion runs in CI (the 35-03 `code-scanning-proof` job) authenticated by the ambient workflow `GITHUB_TOKEN`.

## Next Phase Readiness
- The assert half of PROOF-01/02 is in place and locally proven. Ready for **35-03**: the `code-scanning-proof` job in `ci.yml` that runs the shipped CLI on the 35-01 fixture, uploads under `category: angular-typecheck-proof` (PR-only, non-fork), and invokes `node tools/ci/assert-code-scanning.mjs` with `PR_NUMBER`/`SARIF_ID`/`GH_TOKEN` from env.
- **PROOF-01/02 stay Pending** -- the SARIF -> Code Scanning ingestion round-trip is provable ONLY in real CI (the phase Nyquist point); both close at phase verification once the CI job is green on a real PR.
- D-04 holds: only `tools/ci/assert-code-scanning.mjs` (new) + one plugin-side spec under `src/**` (new) were added; no reporter/adapter/schema/manifest change, no new runtime dependency, no version bump (`packages/angular-typechecker/**` production surface byte-unchanged).

## Self-Check: PASSED
- Both created files exist on disk: `tools/ci/assert-code-scanning.mjs`, `packages/angular-typechecker/src/assert-code-scanning.spec.ts`.
- Both task commits present: `d9cdec0` (Task 1), `b1f417f` (Task 2).
- Gates green: `nx test angular-typechecker` (574 pass, incl. the 3 new subprocess tests), Task-1 `missingTuples` import check (GREEN+RED), `nx run-many -t lint` (maxWarnings:0, no module-boundary violation), `nx format:check` (exit 0), `tsc --noEmit -p tsconfig.spec.json` (exit 0).
- `git diff --stat` scope holds: exactly the two files; no production surface touched (D-04).

---
*Phase: 35-automated-code-scanning-proof*
*Completed: 2026-07-21*
