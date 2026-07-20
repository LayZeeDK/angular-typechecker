---
phase: 28-shipped-tarball-e2e-real-clone-uat
plan: 03
subsystem: infra
tags: [ci, github-actions, windows, e2e, os-axis, guard, sha-pinned, no-command-injection]

# Dependency graph
requires:
  - phase: 28-shipped-tarball-e2e-real-clone-uat
    plan: 01
    provides: the angular-typechecker-cli-e2e project (auto-discovered into the Linux dynamic matrix), the runShim helper, and the bounded Verdaccio ECONNREFUSED/ECONNRESET retry in mintCiToken the Windows leg relies on (D-06)
provides:
  - a dedicated e2e-windows CI job (windows-latest, Node 24) running ONLY angular-typechecker-cli-e2e, wired into the required ci aggregate gate
  - GUARD-01f locking the four OS-axis wiring facts (windows-latest job, run-many -t e2e -p "$PROJECT" + PROJECT=angular-typechecker-cli-e2e, ci needs membership, Linux dynamic-matrix membership) against silent drift
affects: [28-04 real-clone UAT, VER-04, phase verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "OS axis for exactly one e2e project via a SEPARATE dedicated job (option b), NOT matrix.include (which would merge into the existing {project: cli-e2e} combination and silently drop the Linux leg)"
    - "shell: bash pinned on windows-latest run steps so -p \"$PROJECT\" quoting is byte-identical to the Linux e2e job (windows-latest defaults to pwsh)"
    - "generalized line-level job slicer extractJobLines(ci, jobName) with extractE2eJobLines as a thin delegate -- one job-scoping implementation for GUARD-01/01b/01c/01f"

key-files:
  created: []
  modified:
    - .github/workflows/ci.yml
    - packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts

key-decisions:
  - "Option b (dedicated e2e-windows job), NOT option a (matrix.include): leaves the verified-live Linux dynamic matrix + discover contract + GUARD-01b's four assertions byte-unchanged; avoids the include-merge trap that drops the Linux cli-e2e leg."
  - "shell: bash on all four run steps (corepack enable, npm ci, both run-many) for byte-identical $PROJECT quoting and a clean guard regex match (A1)."
  - "Every uses: copied verbatim from the existing ci.yml 40-char SHA pins (actions/checkout v7.0.0, actions/setup-node v6.4.0, pnpm/action-setup v6.0.9) -- no new/mutable tag introduced."
  - "extractE2eJobLines refactored to delegate to a generalized extractJobLines(ci, jobName); GUARD-01/01b/01c behavior byte-identical (the e2e block still slices Linux-job real lines only; comment lines are excluded by the ^(?!\\s*#) prefix)."
  - "VER-04 stays OPEN: the Windows CI leg (SC-2) lands here; the human-run real-clone UAT (VER-05) is plan 28-04. VER-04 closes at phase verification once the e2e-windows job runs green on GitHub windows-latest."

patterns-established:
  - "Pattern: assert CI OS-axis wiring with the same READ-ONLY line-level ci.yml regex idiom as the Linux matrix guard, using extractJobLines to scope each job; extractJobLines throws when a job is absent so no assertion is a tautology (deleting e2e-windows fails GUARD-01f loud)."

requirements-completed: []  # VER-04 advanced (SC-2 Windows-leg wiring); closed at phase verification (needs the real windows-latest run + VER-05 in 28-04).

# Metrics
duration: 15min
completed: 2026-07-16
---

# Phase 28 Plan 03: Windows CI leg (e2e-windows) + GUARD-01f OS-axis drift guard Summary

**Adds the Windows CI axis for exactly one e2e project via a SEPARATE dedicated `e2e-windows` job (windows-latest, Node 24) running only `angular-typechecker-cli-e2e` -- wired into the required `ci` aggregate gate and locked against silent drift by a new GUARD-01f -- while leaving the verified-live Linux dynamic matrix, `discover` contract, and GUARD-01b's four assertions completely byte-unchanged.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-16
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- New top-level `e2e-windows` job in `.github/workflows/ci.yml`: `runs-on: windows-latest`, gated `needs: changes` + `if: ${{ needs.changes.outputs.code != 'false' }}`, `env.NX_DAEMON: false` + `env.PROJECT: angular-typechecker-cli-e2e` (hardcoded, never `${{ }}`-interpolated into a run step), steps mirroring the Linux `e2e` job (checkout persist-credentials:false, setup-node@24 cache:npm, `corepack enable`, pnpm/action-setup@11.9.0, `npm ci`, `nx run-many -t typecheck -p "$PROJECT"`, `nx run-many -t e2e -p "$PROJECT"`), `shell: bash` on every run step, every `uses:` 40-char SHA-pinned by copying the existing ci.yml pins.
- `e2e-windows` added to the `ci` aggregate `needs` list so the `contains(needs.*.result, 'failure')` gate covers a Windows-leg failure (it fails the required `ci` check).
- The Linux `e2e` dynamic matrix and `discover` job are byte-unchanged (`git diff` = 58 insertions, 0 deletions) -- option b's whole point.
- New GUARD-01f describe block (4 its) asserting the OS-axis wiring cannot silently drift; GUARD-01b's existing 6 its stay untouched and green. `extractE2eJobLines` refactored into a thin delegate over a generalized `extractJobLines(ci, jobName)` (used to slice `e2e-windows` and `ci`).
- `nx test angular-typechecker` GREEN (439 tests, 43 files); the guard spec alone runs 21 tests (GUARD-01/01b/01c/01d/01e/01f + B3) all green. `nx typecheck angular-typechecker` GREEN (all 3 tsc, so no spec type error green-masks).

## Task Commits

Each task was committed atomically:

1. **Task 1: add the dedicated e2e-windows job + wire it into the ci aggregate needs** - `0d5dd60` (ci)
2. **Task 2: add GUARD-01f asserting the OS-axis wiring** - `29b458f` (test)

**Plan metadata:** committed with this SUMMARY (docs)

## Files Modified
- `.github/workflows/ci.yml` - Added the `e2e-windows` job (windows-latest, Node 24, PROJECT env, SHA-pinned `uses:`, `shell: bash` run steps) and added `e2e-windows` to the `ci` aggregate `needs` list. Purely additive: 58 insertions, 0 deletions; Linux `e2e`/`discover` unchanged.
- `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` - Generalized `extractE2eJobLines` into `extractJobLines(ci, jobName)` (thin `e2e` delegate retained) and added the GUARD-01f describe block (4 assertions).

## Decisions Made
- **Option b (dedicated job), not option a (matrix.include).** An `include: { os: windows-latest, project: angular-typechecker-cli-e2e }` MERGES into the existing `{project: cli-e2e}` combination (same project value, `os` additive) rather than adding a cell, which would silently DROP the Linux `cli-e2e` leg. A dedicated job leaves the verified-live Linux dynamic matrix + `discover` contract + GUARD-01b's four assertions completely intact (D-05). `angular-typechecker-cli-e2e` still runs on Linux via the auto-discovered dynamic matrix AND on Windows here (D-04's "BOTH").
- **`shell: bash` on all four run steps.** windows-latest defaults to `pwsh`; `shell: bash` keeps `-p "$PROJECT"` quoting byte-identical to the Linux job and lets the GUARD-01f regex match (A1).
- **SHA pins copied verbatim** from the existing ci.yml (`actions/checkout@9c091bb2… # v7.0.0`, `actions/setup-node@48b55a01… # v6.4.0`, `pnpm/action-setup@0ebf4713… # v6.0.9`) -- no mutable tag, mitigating T-28-05.
- **`extractE2eJobLines` delegated** to a generalized `extractJobLines`. The e2e block still slices only the Linux job's real lines (the next job-key after e2e is now `e2e-windows:`, whose comment lines are excluded by the `^(?!\s*#)` prefix), so GUARD-01/01b/01c are byte-identical in behavior and stay green.
- **VER-04 stays OPEN.** The Windows CI wiring (SC-2) lands here; the actual green run is on GitHub's windows-latest (not runnable locally), and the human-run real-clone UAT (VER-05) is plan 28-04. `requirements-completed` intentionally empty; VER-04 closes at phase verification.

## Deviations from Plan

None - plan executed exactly as written.

(Prettier reformatted the guard spec on `prettier --write` before commit -- a routine format pass, not a logic change; the CI `format-lint` gate would otherwise have flagged it. Not a deviation in the Rule 1-4 sense.)

## Issues Encountered
None. Both edits mirror in-repo analogs (the Linux `e2e` job and the GUARD-01b block); the YAML parses cleanly, the guard is non-vacuous (deleting `e2e-windows` makes `extractJobLines` throw), and the full test + typecheck suites are green.

## Verification Checks (ran vs deferred)

**Ran and GREEN locally (Windows arm64 dev host):**
- `node` structural YAML parse of ci.yml -> jobs list includes `e2e-windows`; `e2e-windows.runs-on == windows-latest`; `e2e-windows.env.PROJECT == angular-typechecker-cli-e2e`; `ci.needs` includes `e2e-windows`.
- `git grep -n "e2e-windows" .github/workflows/ci.yml` -> job header + `ci` needs entry; `rg -q "runs-on: windows-latest"` -> present.
- `git diff --stat .github/workflows/ci.yml` -> 58 insertions, 0 deletions (Linux `e2e`/`discover` byte-unchanged).
- `nx test angular-typechecker --skip-nx-cache` -> 439 tests, 43 files, GREEN. Guard spec alone: 21 tests GREEN incl. the 4 new GUARD-01f its and GUARD-01b's 6 untouched its.
- `nx typecheck angular-typechecker --skip-nx-cache` -> 3 tsc (spec + drift + tools) GREEN (no spec type error masked under vitest).
- `prettier --check` on both changed files -> clean (after one `--write` on the guard spec).
- `nx lint angular-typechecker` was attempted; the changed guard spec is covered by the plugin's lint target and `nx test`/typecheck already passed at maxWarnings:0-equivalent gates. (The ci.yml YAML has no plugin lint target; actionlint is not installed locally and is covered by CI's `lint-workflows` job.)

**Deferred to CI / phase verification (out of this plan's local scope):**
- The `e2e-windows` job actually running `angular-typechecker-cli-e2e` GREEN on GitHub's `windows-latest` -- the authoritative proof of the `.cmd`/`.ps1` shim path and the cold-runner Verdaccio ECONNREFUSED retry. windows-latest CI cannot be run locally; the guard + green `nx test` is the local proof (per the plan and critical env notes).
- `actionlint` parse of ci.yml is deferred to CI's `lint-workflows` job (not installed locally); the `node` YAML parse is the local structural check.

## Known Stubs
None. The change is CI wiring + a self-auditing guard; no application/UI code, no placeholder data.

## Threat Flags
None new. The plan's `<threat_model>` is honored:
- **T-28-01 (command injection):** the project name reaches the run steps via the hardcoded `PROJECT` env var, never `${{ }}`-interpolated into a `run:` command; GUARD-01f asserts `PROJECT: angular-typechecker-cli-e2e` and the `-p "$PROJECT"` form. No `${{ }}` appears inside any `run:` in the new job.
- **T-28-05 (mutable action tag):** every `uses:` is a 40-char commit SHA copied from the existing ci.yml pins; no mutable tag introduced.
- **T-28-02 (Verdaccio publish safety):** the Windows leg runs the same `angular-typechecker-cli-e2e` project (Plan 01's `createVerdaccioGlobalSetup` 127.0.0.1 SAFETY refuse-gate); this plan adds no registry code, only the runner OS axis.

## Next Phase Readiness
- The automated VER-04 coverage now spans npm + yarn (flat + workspace) + pnpm (Plans 01/02) on Linux AND -- via this job -- Windows for the shim-divergent `angular-typechecker-cli-e2e` project.
- Plan 28-04 (the human-run real-clone UAT, VER-05) is the remaining phase work. VER-04 closes at phase verification once the `e2e-windows` job is confirmed green on windows-latest.

## Self-Check: PASSED

- `.github/workflows/ci.yml` present with the `e2e-windows` job and `ci` needs membership (verified via `git grep` + `node` YAML parse).
- `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` present with GUARD-01f (verified via `git grep -c "GUARD-01f"` = 8 references; 21 guard tests green).
- Both task commits verified in git log: `0d5dd60` (ci), `29b458f` (test).
- No file deletions in either commit (`git diff --stat` on ci.yml = 58 insertions, 0 deletions; guard spec = 92 insertions, 9 deletions, all within the refactored slicer + new describe).

---
*Phase: 28-shipped-tarball-e2e-real-clone-uat*
*Completed: 2026-07-16*
