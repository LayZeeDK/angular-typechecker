---
phase: 11-fallow-code-quality-ci-gate
plan: 02
subsystem: infra
tags: [fallow, ci-gate, github-actions, act-compat, dead-code, quality-gate]

# Dependency graph
requires:
  - phase: 11-fallow-code-quality-ci-gate
    plan: 01
    provides: the .fallowrc.jsonc + the exact-pinned fallow@2.103.0 root devDependency + the regenerated lockfile that make `npm ci` + `npx fallow audit` meaningful and green
provides:
  - a dedicated path-gated SHA-pinned `fallow` job in ci.yml wired into the `ci` aggregate `needs:` (covered by the existing contains(needs.*.result, ...) gate)
  - the `assert_selected "$PR_PLAN" "ci/fallow" "pull_request"` act-compat assertion
affects: [release (no published-package surface change; CI/tooling only), future PRs (newly-introduced dead code / duplication / over-complexity now breaks the single required `ci` check)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "New CI job copies the in-file e2e job verbatim + two fallow deltas (fetch-depth: 0 for new-only attribution, the npx fallow audit run step)"
    - "Aggregate-gate membership: a new job joins via the `needs:` list only; the contains(needs.*.result, ...) gate globs needs.* and auto-includes it (no gate-expression edit)"
    - "Path-gate via the NEGATIVE `!= 'false'` form (load-bearing for act -n plan stability under empty filter output)"

key-files:
  created: []
  modified: [.github/workflows/ci.yml, tools/act/act-compat.sh]

key-decisions:
  - "Slotted the `fallow` job between e2e and act-compat, and `fallow` after e2e in ci.needs (D-10 / workflow-file ordering); the gate expression and the `ci` job id/name are byte-unchanged so the single required status check stays `ci` (no Default-branch ruleset change)"
  - "fetch-depth: 0 is the ONLY checkout in ci.yml carrying it (D-13, load-bearing for new-only base-snapshot attribution against origin/main's merge-base); FALLOW_AUDIT_BASE=origin/main pins the base defensively"
  - "No SARIF/--ci and no job permissions block (D-12); --format json is for the CI log, the EXIT CODE gates; the top-level contents: read posture is preserved (no security-events: write)"

patterns-established:
  - "Pattern: a code-quality analyzer wired as a dedicated path-gated job in the ci aggregate (single required check stays `ci`), exact-pinned + run via `npx <tool>` so a tool release cannot silently flip the gate"

requirements-completed: [QUAL-01, QUAL-03]

# Metrics
duration: ~6min
completed: 2026-06-30
---

# Phase 11 Plan 02: Wire the fallow gate into CI Summary

**Added a dedicated, path-gated, SHA-pinned `fallow` job to `ci.yml` (the `e2e` job pattern plus `fetch-depth: 0` and `npx fallow audit --format json --base origin/main`), wired it into the `ci` aggregate `needs:` (one-line edit; the existing `contains(needs.*.result, ...)` gate auto-includes it), and added the matching `assert_selected "$PR_PLAN" "ci/fallow" "pull_request"` line to `act-compat.sh` -- so newly-introduced dead code / duplication / over-complexity now breaks the single required `ci` check, with the security posture (SHA pins, `contents: read`, `persist-credentials: false`, no PR-metadata interpolation, no SARIF) preserved.**

## Performance

- **Duration:** ~6 min
- **Tasks:** 3
- **Files modified:** 2 (0 created, 2 modified)

## Accomplishments

- A dedicated `fallow` job exists in `ci.yml` between `e2e` and `act-compat`: path-gated with the NEGATIVE `!= 'false'` form, `runs-on: ubuntu-latest`, Node 24, `actions/checkout` with `persist-credentials: false` AND `fetch-depth: 0`, `actions/setup-node` `cache: npm`, `npm ci`, then `npx fallow audit --format json --base origin/main` with `env: FALLOW_AUDIT_BASE: origin/main`. The reused SHA pins are the EXACT existing ones (no new SHA introduced).
- `fallow` is listed in the `ci` aggregate `needs:` (after `e2e`); the `contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled')` gate expression and the `ci` job id/name are byte-unchanged.
- `tools/act/act-compat.sh` asserts `ci/fallow` selected on `pull_request`, in the `pull_request` block between `ci/e2e` and `ci/act-compat`, matching the existing `ci/<jobid>` family. Not added to the PUSH_MAIN/PUSH_TAG/DISPATCH blocks; no `assert_absent`.
- **Gate proven green:** `npx fallow audit --format json --base origin/main` exits 0 with `verdict: "pass"` on the merged wave-1 tree (see Verification below).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the path-gated, SHA-pinned `fallow` job to ci.yml** - `64c8ebd` (ci)
2. **Task 2: Add `fallow` to the `ci` aggregate `needs:` list** - `a1d1ce1` (ci)
3. **Task 3: Add the `ci/fallow` act-compat assertion + run the validation suite** - `1fed6e4` (ci)

_Commit type rationale (AGENTS.md scope hygiene): this plan touches ONLY CI/tooling files (`.github/workflows/ci.yml`, `tools/act/act-compat.sh`), NOT `packages/angular-typechecker/` source, so `ci` is used (no published-package version bump; hidden from the public changelog)._

## Files Created/Modified

- `.github/workflows/ci.yml` (modified) - added the `fallow` job (32-line insertion: explanatory comment block + the job) between `e2e` and `act-compat`; added `fallow` to the `ci` aggregate `needs:` (one-line edit). The threat-model header (lines 1-19), the top-level `permissions: contents: read`, the gate expression, and the `ci` job id/name are all unchanged.
- `tools/act/act-compat.sh` (modified) - added one line: `assert_selected "$PR_PLAN" "ci/fallow" "pull_request"` in the `pull_request` block.

## Verification

| Check | Command | Result |
|-------|---------|--------|
| Gate command exit code | `npx fallow audit --format json --base origin/main` | **exit 0** (`verdict: "pass"`) |
| Fallow attribution | (from JSON) | `gate: new-only`; `dead_code_issues: 0`, `dead_code_introduced: 0`, `dead_code_inherited: 0`, `dead_code_has_errors: false`; `complexity_findings: 0` introduced/inherited 0; `duplication_clone_groups: 0` introduced/inherited 0; `base_ref: origin/main`; `changed_files_count: 120`; merge-base `1e37d55` (matches 11-RESEARCH.md) |
| act parseability (Guard 1) | `act --validate` (inside `act-compat.sh`) | **PASS** -- both workflows (ci.yml + release.yml) parse with the new job + extended `needs` graph |
| act-compat structural | `git grep -n 'ci/fallow' tools/act/act-compat.sh` | exactly ONE line at 113, in the `pull_request` block, matching the `ci/<jobid>` family |
| ci.yml structural | node job-graph parse | jobs include `fallow`; `ci.needs = [changes, test, e2e, fallow, act-compat, lint-workflows]`; exactly one `fetch-depth: 0` directive |
| security posture | greps for `sarif`/`--ci`, job `permissions:`, `github.event` | no SARIF/`--ci` directive (only the explanatory comment), no job `permissions:` block (only top-level `contents: read`), no `github.event` interpolation anywhere |

### Deferred local-tooling checks (deferred to the existing CI jobs, with reason)

- **`./actionlint -color`** -- DEFERRED to the CI `lint-workflows` job. `actionlint` is NOT provisioned on this Windows arm64 dev box (verified absent on PATH and as a local `./actionlint`). This matches the Phase 6/7 precedent (STATE.md `[06-05]`/`[07-02]`: actionlint not on the dev box -> deferred to the orchestrator/draft-PR `lint-workflows` job). Mitigation: the `act --validate` Guard 1 passed (both workflows parse), and the new job uses ONLY constructs already present (matrix-free `runs-on`, `needs`, `if:` expression, SHA-pinned `uses`, `env`) -- the single residual research uncertainty A1 (actionlint stays green for the new job) is LOW risk and is authoritatively checked by the CI `lint-workflows` job on the phase PR.
- **Full `bash tools/act/act-compat.sh` run** -- the `changes`-dependent `act -n` assertions (including the new `ci/fallow`) are DEFERRED to the CI `act-compat` job. Docker is not running on this box (`no DOCKER_HOST`), so `act -n` cannot schedule the `changes`-dependent jobs (`test`, `e2e`, `fallow`, `ci`) -- all four fail uniformly for the same Docker reason, NOT because of the edit. This is the documented Phase 7 precedent (STATE.md `[07-02]`: "local act -n cannot schedule changes-dependent test/e2e/ci jobs (Docker not running on this box)"; the ci.yml/act-compat caveat: act's `needs.*.result`/skipped arithmetic is only authoritative on a REAL run). The non-`changes`-dependent assertions (`ci/act-compat`, `ci/lint-workflows`, `release/publish`) all passed, and Guard 1 (`act --validate`) passed.

## Decisions Made

- **Job placement + ordering:** the `fallow` job is slotted between `e2e` and `act-compat` (sibling of `e2e`); `fallow` is added after `e2e` in `ci.needs`, matching its workflow-file ordering (D-10). The gate expression is untouched -- `needs.*` globs every listed job, so adding `fallow` to the list auto-includes it.
- **`fetch-depth: 0` is the only one in the file (D-13):** it is load-bearing for `new-only` base-snapshot attribution against `origin/main`'s merge-base; every other checkout uses the default shallow depth. `FALLOW_AUDIT_BASE=origin/main` pins the base ref defensively.
- **No SARIF, no job `permissions:` (D-12):** `--format json` is for the CI log, the exit code gates. `--ci`/SARIF would need `security-events: write`, contradicting the top-level `contents: read`. The job re-grants nothing.
- **`@angular/forms` lockfile note (carried from 11-01):** wave 1 already removed `@angular/forms` and pinned `fallow@2.103.0`; this plan touched NO dependency files, so the gate the new job runs is the clean 0-finding tree wave 1 produced.

## Deviations from Plan

None - plan executed exactly as written. No deviation rules (1-4) were triggered; no authentication gates; no checkpoints (the plan is fully autonomous).

## Issues Encountered

- `actionlint` and a running Docker daemon are both unavailable on this Windows arm64 dev box. Neither is a defect: both are the documented Phase 6/7 local-tooling deferrals to the CI `lint-workflows` / `act-compat` jobs (see "Deferred local-tooling checks" above). The static checks that ARE available locally -- `act --validate` (Guard 1), the `npx fallow audit` exit-0 gate, and structural greps of both edited files -- all passed.

## User Setup Required

None - no external service configuration required. The authoritative integration check (the phase PR's own real `ci` run is green with the new `fallow` job present, and a throwaway PR introducing dead code goes red) is the MANUAL gate noted in the plan's verification and 11-VALIDATION.md.

## Next Phase Readiness

- The `fallow` gate is wired and provably green on the current tree. The phase's remaining authoritative verification (a REAL green `ci` run on the phase PR, and a red run on an introduced-dead-code probe) is a draft-PR / merge-time check, consistent with the act-compat caveat.
- This is the last plan of Phase 11 (plan 2 of 2) and the last phase of v0.0.3. Phase verification (`/gsd-execute-phase` -> verify_phase_goal), secure, validate, and extract-learnings follow per the project workflow.

## Self-Check: PASSED

- FOUND: `.github/workflows/ci.yml` (the `fallow` job + the `ci.needs` edit)
- FOUND: `tools/act/act-compat.sh` (the `ci/fallow` assertion)
- FOUND: `.planning/phases/11-fallow-code-quality-ci-gate/11-02-SUMMARY.md`
- FOUND commit `64c8ebd` (Task 1)
- FOUND commit `a1d1ce1` (Task 2)
- FOUND commit `1fed6e4` (Task 3)

---
*Phase: 11-fallow-code-quality-ci-gate*
*Completed: 2026-06-30*
