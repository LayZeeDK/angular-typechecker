---
phase: 35-automated-code-scanning-proof
plan: 04
subsystem: testing
tags: [sarif, code-scanning, github, node-sarif-builder, reporter, gap-closure]

# Dependency graph
requires:
  - phase: 35-automated-code-scanning-proof
    provides: "The SARIF proof fixture, the assert-code-scanning.mjs script, and the code-scanning-proof CI job (35-01..35-03) that surfaced the file-less no-location rejection on the first real CI run."
  - phase: 31/33
    provides: "The SARIF reporter (sarif-report.ts) and the shared diagnostic-record projection (relativizePath) this fix extends."
provides:
  - "File-less SARIF results (record.file === null) now carry a region-less whole-file fallback location on the relativized tsConfigPath, so GitHub Code Scanning ingests the whole upload instead of rejecting it (locationFromSarifResult)."
  - "Both SARIF snapshots (unit sarif-report + integration machine-reporters-sarif) regenerated to the new located shape; the sarif-proof-fixture drift-lock stays green."
  - "README file-less-diagnostic guidance corrected to describe whole-file alerts."
affects: [milestone-pr, code-scanning-proof, release]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SARIF file-less fallback location: a project/config-level diagnostic with no source location is anchored to its always-present tsConfigPath (relativized, forward-slash, region-less) rather than emitting no `locations` key -- ingestible by GitHub while still never dropped."

key-files:
  created: []
  modified:
    - packages/angular-typechecker/src/core/sarif-report.ts
    - packages/angular-typechecker/src/core/sarif-report.spec.ts
    - packages/angular-typechecker/src/core/machine-reporters-sarif.integration.spec.ts
    - packages/angular-typechecker/src/core/__snapshots__/sarif-report.spec.ts.snap
    - packages/angular-typechecker/src/core/__snapshots__/machine-reporters-sarif.integration.spec.ts.snap
    - packages/angular-typechecker/README.md

key-decisions:
  - "Reversed the old D-01 no-location emission in the SARIF EMISSION only (D1/D5/D6): fileUri = relativizePath(result.tsConfigPath, pathBase), no region. The DiagnosticRecord, json-report.ts, fingerprintOf, the barrel, and the package version are byte-unchanged (D2/D3/D4/D7)."
  - "Region-less (fileUri alone) over a synthetic line-1 region: honest for project/config-level diagnostics and the smallest diff; GitHub path-level-alert acceptance is the real-CI-only Nyquist confirmation."

patterns-established:
  - "File-less-result fallback location lives in the reporter out-of-band; the synthesized diagnostic stays file: undefined (never-suppress boundary) and never feeds the fingerprint."

requirements-completed: [PROOF-01, PROOF-02]

coverage:
  - id: D1
    description: "File-less SARIF results carry exactly one region-less whole-file location whose artifactLocation.uri === relativizePath(tsConfigPath, pathBase); results.length === diagnostics.length (never-drop) preserved; DiagnosticRecord/JSON/fingerprint/version byte-unchanged."
    requirement: "PROOF-01"
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/core/sarif-report.spec.ts#never drops a file-less diagnostic -- emits it as a whole-file located result on the tsconfig with no region, length one-to-one (D1/D5/D6)"
        status: pass
      - kind: integration
        ref: "packages/angular-typechecker/src/core/machine-reporters-sarif.integration.spec.ts#gives every file-less result exactly one whole-file location on the tsconfig, never dropped"
        status: pass
      - kind: integration
        ref: "packages/angular-typechecker/src/core/machine-reporters-sarif.integration.spec.ts#resolves both file-less results to the single tool rule by ruleIndex 0, each located on the tsconfig (RULE-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "In REAL CI the code-scanning-proof job's upload-sarif ingests the SARIF with no locationFromSarifResult rejection and the assert step exits 0 with all four (family tag, severity) tuples under the angular-typecheck-proof category (PROOF-01/PROOF-02, the phase Nyquist point)."
    requirement: "PROOF-02"
    verification:
      - kind: e2e
        ref: "GitHub code-scanning-proof job on the milestone PR (upload-sarif ingestion + assert-code-scanning.mjs exit 0) -- pending push"
        status: unknown
    human_judgment: true
    rationale: "GitHub Code Scanning ingestion of the region-less whole-file location is provable ONLY in real CI (region-less path-level acceptance is a real-CI-only concern per CONTEXT D6). No push was performed by this executor; the milestone PR CI run is authoritative."

# Metrics
duration: ~28min
completed: 2026-07-22
status: complete
---

# Phase 35 Plan 04: SARIF file-less fallback location (G-35-01) Summary

**File-less SARIF results now carry a region-less whole-file location on the relativized tsConfigPath -- reversing the old no-location emission so GitHub Code Scanning ingests the whole upload instead of rejecting it (locationFromSarifResult), with every diagnostic still never dropped.**

## Performance

- **Duration:** ~28 min
- **Started:** 2026-07-22T00:11:00+02:00
- **Completed:** 2026-07-22T00:39:00+02:00
- **Tasks:** 4
- **Files modified:** 6

## Accomplishments
- Production fix (`sarif-report.ts` PASS-2): the file-less arm now supplies `{ fileUri: relativizePath(result.tsConfigPath, pathBase) }` (fileUri alone, no region), so node-sarif-builder emits a region-less whole-file location. Applies to ALL file-less results (ATC tool codes AND file-less global TS like TS2318), per D5.
- Both D-01 doc-comments updated to describe the fallback-location behavior; `relativizePath` imported as a value from `./diagnostic-record`.
- Unit spec flipped: the file-less test asserts a located, region-less result on `libs/x/tsconfig.lib.json`; unit snapshot regenerated (file-less result shows its region-less location, `artifactLocation.index 1`).
- Integration spec flipped: global-diagnostics (all 10 TS2318 results located on `fixtures/global-diagnostics/tsconfig.json`) and solution-style-all-missing (both ATC90002 results located on `.../tsconfig.json`); integration snapshot regenerated; the sarif-proof-fixture drift-lock and layout-b-host snapshot unchanged.
- Shipped README corrected: file-less diagnostics are anchored to the tsconfig and surface as whole-file Code Scanning alerts (stale "treat the exit code, not the SARIF alert" caveat dropped).

## Task Commits

Each task was committed atomically:

1. **Task 1: Attach region-less tsconfig fallback location to file-less SARIF results (D1/D5/D6)** - `89119a0` (fix)
2. **Task 2: Flip the unit spec file-less assertion + regenerate snapshot** - `19b99f7` (test)
3. **Task 3: Flip the two integration "NO locations" assertions + regenerate snapshot** - `2831d11` (test)
4. **Task 4: Correct the shipped README SARIF file-less-diagnostic paragraph** - `5568afe` (docs)

**Plan metadata:** committed by the orchestrator (STATE/ROADMAP/SUMMARY owned by execute-phase, not this executor).

## Files Created/Modified
- `packages/angular-typechecker/src/core/sarif-report.ts` - PASS-2 file-less arm supplies the region-less tsconfig fallback location; `relativizePath` imported; both D-01 comments updated. (+16/-... one spread-arm value, one import, comment prose.)
- `packages/angular-typechecker/src/core/sarif-report.spec.ts` - file-less test asserts located (uri `libs/x/tsconfig.lib.json`) + `region` undefined; `filelessDiag` comment refreshed.
- `packages/angular-typechecker/src/core/__snapshots__/sarif-report.spec.ts.snap` - regenerated; file-less result now carries its region-less whole-file location.
- `packages/angular-typechecker/src/core/machine-reporters-sarif.integration.spec.ts` - global-diagnostics + solution-style-all-missing location assertions flipped to whole-file located; module-header bullets updated.
- `packages/angular-typechecker/src/core/__snapshots__/machine-reporters-sarif.integration.spec.ts.snap` - regenerated; the 10 global-diagnostics results now show their region-less tsconfig location (single artifact index 0).
- `packages/angular-typechecker/README.md` - file-less-diagnostic paragraph rewritten for whole-file alerts (consumer language, no internal ids); "Run from the repository root" note byte-unchanged.

## Decisions Made
- None beyond the locked CONTEXT (D1-D7). The plan was followed as written; region-less (D6) implemented exactly as specified.

## Deviations from Plan

None affecting the SARIF work -- plan executed exactly as written (Tasks 1-4).

One OUT-OF-SCOPE discovery, NOT fixed here (SCOPE BOUNDARY): see "Issues Encountered".

## Issues Encountered

**Pre-existing cve-lite HIGH (out of scope; NOT caused by this plan) -- the one non-green local gate.**
- **Found during:** the plan's 8-gate local battery (`npm run cve-lite`, `--fail-on high`).
- **Finding:** HIGH transitive advisory `fast-uri@3.1.3` (GHSA-v2hh-gcrm-f6hx, fixed 3.1.4), reached via `ajv@6.15.0 -> fast-uri` and 4 other paths; plus a MEDIUM `@hono/node-server@1.19.14` (below the `high` gate, no auto-fix / major bump).
- **Why out of scope:** the additive-only spot check confirms this plan touched NO `package.json` / `package-lock.json`, so the advisory is 100% pre-existing on the unchanged dependency tree (a freshly published OSV advisory turning the gate red with zero code change). Plan 35-04's must_haves explicitly forbid any dependency add/upgrade and confine the diff to the 6 `files_modified`. Fixing it (the suggested `ajv 6->8` two-major-line bump across 5 paths) also hits the CLAUDE.md do-not-bump-across-a-major-line + npm 10-vs-11 override-portability traps and can break `npm ci` -- a focused dep-hygiene task, not an inline drive-by. The repo's precedent clears such findings via DEDICATED quick tasks (svgo HIGH -> 260721-wda; fallow complexity -> 260721-vm1).
- **Action taken:** logged to `.planning/phases/35-automated-code-scanning-proof/deferred-items.md` (item 2) with the recommended fix (a reviewed `overrides` entry pinning `fast-uri` to `>=3.1.4`, covering all 5 paths without the ajv major bump). NOT fixed here.

## Local gate battery (repo root, on the final committed state)

| # | Gate | Result |
|---|------|--------|
| 1 | `nx test angular-typechecker` (unit + regenerated sarif-report snapshot) | GREEN (575 tests, clean `-u`-free run) |
| 2 | `nx integration angular-typechecker` (integration + regenerated machine-reporters snapshot + sarif-proof-fixture drift-lock) | GREEN (156 tests, clean `-u`-free run) |
| 3 | `nx typecheck angular-typechecker` (3 tsc incl. tsconfig.spec.json) | GREEN (re-run AFTER the Task 2-3 spec edits) |
| 4 | `nx run-many -t lint` (maxWarnings:0) | GREEN (all files pass) |
| 5 | `nx format:check` | GREEN |
| 6 | `npm run fallow` | GREEN (No issues in 84 changed files; prior complexity blocker cleared by 260721-vm1) |
| 7 | `npm run cve-lite` (`--fail-on high`) | **RED -- pre-existing, out-of-scope (see Issues Encountered / deferred-items.md item 2)** |
| 8 | `nx build angular-typechecker` | GREEN |

**7/8 green.** The one RED gate (cve-lite) is unrelated to the SARIF change and is deferred to a dedicated dependency-hygiene task.

**Additive-only spot check:** `git diff --stat a608a6d HEAD` shows ONLY the six `files_modified`. `src/index.ts`, `src/index.drift.ts`, `json-report.ts`, `diagnostic-record.ts`, and `packages/angular-typechecker/package.json` are all byte-unchanged (verified). No version bump, no release cut.

## Next Phase Readiness

- The SARIF deliverable is complete and correct; the local SARIF proof (unit + integration) is green on a clean run and the sarif-proof-fixture drift-lock still passes.
- **BLOCKER before the milestone PR closes (2 items, both for the orchestrator/user, not this executor):**
  1. **cve-lite HIGH `fast-uri`** -- run a dedicated dep-hygiene quick task (overrides pin `fast-uri >=3.1.4`) so the milestone PR's cve-lite gate is green. See deferred-items.md item 2.
  2. **Real-CI Nyquist point (PROOF-01/PROOF-02)** -- after the milestone PR pushes, the `code-scanning-proof` job's `upload-sarif` must ingest the SARIF (no `locationFromSarifResult` rejection) and the assert step must exit 0 with all four (family tag, severity) tuples under `angular-typecheck-proof`. This is provable ONLY in real CI (region-less path-level acceptance, D6) and closes PROOF-01/PROOF-02 at phase verification. This executor did NOT push (per instructions).

## Self-Check: PASSED

- All 6 modified source files + SUMMARY.md + deferred-items.md exist on disk.
- All 4 task commits exist: `89119a0`, `19b99f7`, `2831d11`, `5568afe`.
- Additive-only spot check verified (only the 6 `files_modified`; deps/barrel/version byte-unchanged).
- 7/8 local gates green; the 8th (cve-lite) is a documented pre-existing out-of-scope deferral.

---
*Phase: 35-automated-code-scanning-proof*
*Completed: 2026-07-22*
