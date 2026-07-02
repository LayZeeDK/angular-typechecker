---
phase: 15-generator-e2e-ci-self-audit-guard
plan: 01
subsystem: testing
tags: [ci-guard, e2e-coverage, nx-plugin, vitest, github-actions]

# Dependency graph
requires:
  - phase: 14-configuration-init-generators-nx-add
    provides: the shipped configuration/init generators + e2e/* project set this guard's coverage protects
provides:
  - GUARD-01 in-plugin bidirectional set-equality guard asserting the ci.yml e2e job -p list equals the e2e/* project set
  - a proven deliberate-RED tripwire (a forgotten/stale -p entry produces a loud, LOCATED failure)
affects: [15-02, ci-e2e-coverage, milestone-audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "In-plugin *.spec.ts (NOT *.int.spec.ts) reads repo-root config files (ci.yml + e2e/*/project.json) via 3-dirs-up workspaceRoot resolution -- rides the 6-cell test matrix"
    - "No-YAML-parser, job-scoped + line-start regex extraction of the CI e2e -p list (reuses the release-hygiene precedent)"
    - "Bidirectional every-quantifier set equality with per-element LOCATED failure messages + a final toEqual backstop"

key-files:
  created:
    - packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts
  modified: []

key-decisions:
  - "Enumerate e2e projects via readdirSync('e2e') + each project.json .name -- NOT the scope:fixture tag (three libs/* projects carry it -> would over-count 6 vs 3)"
  - "Extract the e2e-job -p list job-scoped to `e2e:` (job-key regex includes digits) AND matched at line-start (never the mid-line test-job `-p angular-typechecker`); no YAML dependency"
  - "Deliberate-RED probe A used (phantom e2e/phantom-e2e/project.json); confirmed LOCATED RED then fully restored to green"

patterns-established:
  - "GUARD-01: a self-audit guard MUST be proven to go RED on drift (deliberate-RED), same rigor as the Phase 12 tripwire"

requirements-completed: [GUARD-01]

# Metrics
duration: ~10 min
completed: 2026-07-02
---

# Phase 15 Plan 01: CI e2e-coverage self-audit guard (GUARD-01) Summary

**An in-plugin `*.spec.ts` that asserts the CI `e2e` job's explicit `-p` project list equals the `e2e/*` project set (bidirectional `every`), turning a forgotten/stale `-p` entry from a silent coverage skip into a loud, LOCATED test failure -- proven to go RED on drift then restored.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-02T07:11:00Z
- **Completed:** 2026-07-02T07:20:55Z
- **Tasks:** 2
- **Files modified:** 1 created (Task 2 was a transient probe -- no committed change)

## Accomplishments
- Shipped GUARD-01: `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts`, a read-only guard that reads `.github/workflows/ci.yml` + each `e2e/*/project.json` and asserts bidirectional set equality between the e2e-job `-p` list and the `e2e/*` project set.
- Guard is GREEN today: the `-p` list `{angular-typechecker-install-e2e, angular-typechecker-cache-e2e, angular-typechecker-matrix-e2e}` equals the `e2e/*` project set exactly; codifies the current-correct coverage and goes RED only on drift.
- Placed as a plain in-plugin `*.spec.ts` so it auto-routes into the existing 6-cell `test` matrix (loudest/earliest signal on every OS x Node cell) with NO `ci.yml` structural change; excluded from the shipped tarball by `tsconfig.lib.json`.
- Executed the mandatory deliberate-RED proof (D-12) and fully restored -- the guard demonstrably fails LOUD + LOCATED on drift.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the in-plugin GUARD-01 set-equality spec** - `fdd80a4` (test)
2. **Task 2: Deliberate-RED proof of the guard (D-12)** - transient probe, no committed change (proof recorded below)

**Plan metadata:** committed with this SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md (docs: complete plan)

## Files Created/Modified
- `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` - GUARD-01. `enumerateE2eProjects(root)` reads `e2e/<dir>/project.json .name` (sorted); `extractE2ePList(ci)` slices the `e2e:` job block (job-key regex `/^  [a-z0-9-]+:\s*$/` -- digits included so it matches `e2e:` itself) and pulls the line-start `-p` folded continuation (never the mid-line `test`-job `-p`); three `it()`s assert every-direction membership with LOCATED messages plus a `toEqual` backstop. READ-ONLY (`readFileSync`/`readdirSync`); never edits `ci.yml`.

## Decisions Made
- **Enumeration source = `readdirSync('e2e')` + `.name`, not the `scope:fixture` tag.** Three `libs/*` projects also carry `scope:fixture`; a tag-based set would be 6 vs the 3 real e2e projects and false-RED the guard forever (RESEARCH Finding 2a / Pitfall 1).
- **`-p` extraction is job-scoped AND line-start-matched (belt-and-suspenders).** `ci.yml` has TWO `-p` lines -- the `test` job's mid-line `-p angular-typechecker` and the `e2e` job's folded (`>`) line-start `-p`. Job-scoping to `e2e:` plus the line-start `-p` discriminator uniquely selects the e2e list. No YAML parser (reuses the `release-hygiene` no-parser precedent).
- **Guard reads at `describe`-body level** so a `ci.yml` refactor that removes the `e2e:` job or its `-p` line throws a clear located Error at collection -- failing loudly, never silently passing.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Deliberate-RED Proof (D-12, MANDATORY -- T-15-04 mitigation)

**Probe used:** Probe A (recommended) -- a transient phantom e2e project.

**Steps + observed outcome:**
1. Created `e2e/phantom-e2e/project.json` containing `{ "name": "phantom-e2e" }`.
2. Ran `npx nx test angular-typechecker --skip-nx-cache`. The guard went RED: 2 of 3 guard tests failed (`covers every e2e/* project ...` and `is an exact bidirectional set match`), full suite `2 failed | 237 passed`.
3. **Exact LOCATED failure message observed** (names the offending project):
   ```
   AssertionError: e2e/phantom-e2e is a graph e2e project but is MISSING from the ci.yml e2e job -p list: expected [ ...(3) ] to include 'phantom-e2e'
    > src/ci-e2e-coverage-guard.spec.ts:105:9
   ```
   The `toEqual` backstop also failed: `expected [ ...(3) ] to deeply equal [ ...(4) ]` with `- "phantom-e2e"`.
4. **Fully restored:** removed `e2e/phantom-e2e/` entirely; re-ran `npx nx test angular-typechecker --skip-nx-cache` -> `Test Files 32 passed (32)`, `Tests 239 passed (239)`, guard spec GREEN (3 tests).
5. **Working tree clean of the probe:** no `e2e/phantom-e2e/` directory remains; `git diff --stat -- .github/workflows/ci.yml` is empty (ci.yml unchanged); `git status` shows no stray probe changes.

This proves the guard actually fails on drift with a loud, located message and returns green after restore -- it cannot silently false-PASS (T-15-04 Repudiation mitigation).

## Self-Check: PASSED
- FOUND: `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts`
- FOUND: commit `fdd80a4` (Task 1)
- Guard GREEN via `npx nx test angular-typechecker` (239/239); deliberate-RED performed and restored; working tree clean of the probe.

## Next Phase Readiness
- GUARD-01 complete. The remaining Phase 15 requirement set (GE2E-01/02/03) is plan 15-02: the `consumer-generator` fixture + heavy tarball `generator-e2e`/`nx-add-e2e` specs (runs sequentially on the main tree per AGENTS.md D-22, worktree-hostile).
- No blockers. The single required `ci` gate is byte-unchanged; the guard rides the existing 6-cell `test` matrix.

---
*Phase: 15-generator-e2e-ci-self-audit-guard*
*Completed: 2026-07-02*
