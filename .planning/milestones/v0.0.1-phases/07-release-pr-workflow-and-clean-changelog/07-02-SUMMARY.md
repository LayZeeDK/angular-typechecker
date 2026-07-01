---
phase: 07-release-pr-workflow-and-clean-changelog
plan: 02
subsystem: ci-workflow
tags: [ci, github-actions, paths-filter, required-check, skip-gate, REL-02]
requires:
  - 'ci.yml cross-OS matrix + ci aggregate gate (Phase 6, RD-01/RD-09)'
  - 'tools/act/act-compat.sh act-compat contract (Phase 6)'
  - 'release.yml SHA-pin + persist-credentials convention (Phase 5/6, FROZEN)'
provides:
  - 'ci.yml changes filter job (dorny/paths-filter, SHA-pinned v4.0.0)'
  - "path-gated test + e2e jobs (negative if: needs.changes.outputs.code != 'false')"
  - "reworked skip-aware ci aggregate gate (fails only on failure/cancelled; 'skipped' dropped)"
affects:
  - 'Branch-protection switch (Plan 04): a planning-only PR now path-skips heavy jobs yet ci reports success, so the empty-bypass required-ci ruleset does not deadlock the merge button'
  - 'Future planning-only PRs (no longer burn the full cross-OS matrix)'
tech-stack:
  added:
    - 'dorny/paths-filter@9d7afb8d214ad99e78fbd4247752c4caed2b6e4c # v4.0.0 (GitHub Action, SHA-pinned, resolved at CI runtime; not an npm dependency)'
  patterns:
    - 'Skip-aware aggregate gate: detect the diff INSIDE the workflow (never on:-level paths-ignore on a required check); gate heavy jobs by job-level if:; keep the single required ci job always-running and reporting'
    - "Negative if: form (!= 'false') so an empty filter output under act keeps gated jobs in the plan (A3 / Pitfall 3)"
key-files:
  created: []
  modified:
    - '.github/workflows/ci.yml'
decisions:
  - '[07-02] D-08 mechanism = leading dorny/paths-filter `changes` job + job-level negative if: on test/e2e + reworked aggregate gate (chosen over step-level force-pass: cleaner, and the negative if: is the only shape that survives act-compat per Pitfall 3)'
  - "[07-02] Filter globs: code = `!.planning/**`, `!**/*.md`, `!docs/**` (default `some` quantifier); planning/docs-only PRs set code='false' and path-skip test+e2e"
  - "[07-02] Aggregate gate drops ONLY 'skipped' (path-skip now acceptable); keeps failure AND cancelled fail-closed; cancelled + the post-merge main run are the backstops (T-07-04)"
  - '[07-02] No paths-ignore on the on: trigger (T-07-05 deadlock anti-pattern); ci job id+name byte-stable = `ci` (required-status-check contract)'
metrics:
  duration: '~9 min'
  tasks: 2
  files: 1
  completed: '2026-06-29'
---

# Phase 7 Plan 02: ci.yml path-aware skip for planning-only PRs Summary

Added a path-aware skip to `ci.yml` so the ~58%-of-commits planning-only PRs neither burn the full cross-OS matrix NOR deadlock the required `ci` check: a leading `changes` job (SHA-pinned `dorny/paths-filter@v4.0.0`) classifies the diff, the heavy `test`/`e2e` jobs gate on its output with the load-bearing negative `if:`, and the `ci` aggregate gate is reworked to treat a path-skip as acceptable while staying fail-closed on `failure`/`cancelled`. The `ci` job id+name stay byte-stable, no `paths-ignore` touches the `on:` trigger, and `release.yml` is untouched (REL-02 DX, D-08).

## What Was Built

### Task 1: Empirical act-compat baseline + A3 check (read-only, no commit)

- Ran `bash tools/act/act-compat.sh` against the UNMODIFIED ci.yml to capture the pre-change job selection.
- Baseline result: 10 PASS / 2 FAIL. The two FAILs were `ci/ci` ABSENT on `pull_request` and `push-main`. Root cause: **Docker is not running on this Windows arm64 dev box** (`docker info` fails; `failed to connect to the docker API at npipe:////./pipe/docker_engine`). Under `act -n` with no Docker daemon, act cannot "Set up job" for any container job, so it never schedules the dependent aggregate `ci` job (which `needs:` all upstream jobs). `ci/test-`, `ci/e2e`, `ci/act-compat`, `ci/lint-workflows` were all SELECTED at baseline; only the dependent `ci/ci` was unreachable.
- This matches the Phase-6 recorded precedent: `act --validate` (parseability) runs container-free locally, but `act -n` per-trigger plan fidelity for DEPENDENT jobs needs a running Docker daemon to schedule them. The baseline FAILs are an environment artifact, not a ci.yml defect.

### Task 2: changes filter job + gated test/e2e + reworked ci gate (commit `4245761`)

- **(A) Added the leading `changes` job** at the top of `jobs:` on `ubuntu-latest` with `outputs.code: ${{ steps.filter.outputs.code }}`, a SHA-pinned `actions/checkout@93cb6efe... # v5.0.1` (`persist-credentials: false`), then `dorny/paths-filter@9d7afb8d214ad99e78fbd4247752c4caed2b6e4c # v4.0.0` (`id: filter`) with a `code` filter whose negated globs are `'!.planning/**'`, `'!**/*.md'`, `'!docs/**'`. Added a threat-model-voice rationale comment above the job (why path-aware skip; why detected INSIDE the workflow, not at `on:`; the SHA-pin discipline; no extra permissions needed beyond top-level `contents: read`).
- **(B) Gated the heavy jobs.** `test`: added `needs: changes` (it had none) + `if: ${{ needs.changes.outputs.code != 'false' }}`. `e2e`: added `needs: changes` (it had no needs) + the same negative `if:`. Matrix/steps otherwise unchanged. Added a comment to each explaining the NEGATIVE-`if:` rationale (A3 / Pitfall 3). Left `act-compat` and `lint-workflows` UNGATED (cheap; always validate the YAML).
- **(C) Reworked the `ci` aggregate gate.** `needs` is now `[changes, test, e2e, act-compat, lint-workflows]`; `runs-on: ubuntu-latest`, `if: always()`, and the job id+name stay EXACTLY `ci`. The gate `contains(...)` fail expression now fails only on `contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled')` -- `'skipped'` DROPPED. Echo strings updated ("A required job failed or was cancelled" / "All required jobs succeeded or were intentionally path-skipped"). The preceding comment notes path-skip is now acceptable, `cancelled` stays the backstop, and the post-merge `main` `ci` run is the second backstop.
- Never added `paths-ignore` to the `on:` trigger. ASCII only.

## Verification Evidence

### Structural acceptance criteria (all green via rg + manual review)

- `rg -n 'dorny/paths-filter@9d7afb8d214ad99e78fbd4247752c4caed2b6e4c # v4.0.0' .github/workflows/ci.yml` -> exactly 1 hit (line 54).
- `rg -n "needs.changes.outputs.code != 'false'" .github/workflows/ci.yml` -> exactly 2 hits (test line 80, e2e line 114).
- The `ci` job has `needs: [changes, test, e2e, act-compat, lint-workflows]` (line 183), `if: always()`, and the gate `contains(...)` expression NO LONGER references `'skipped'` (only `'failure'` and `'cancelled'`, line 189).
- `paths-ignore` appears ONLY inside an explanatory comment (line 38, describing the anti-pattern) -- the `on:` trigger (lines 22-25: `pull_request: {}` + `push: branches: [main]`) has NO `paths-ignore`.
- `name: ci` (line 20) and the `ci:` job id (line 182) are byte-stable -- the required-status-check contract is intact.
- Non-ASCII scan of ci.yml -> clean.
- `git status --short .github/workflows/release.yml` -> empty (release.yml untouched / FROZEN).

### Workflow validity (local, Docker-free)

- `act --validate` -> PASS ("both workflows parse"). This is act's container-free ingest check.
- `act -g` (job dependency graph, Docker-free) renders the correct DAG: `changes`, `lint-workflows`, `act-compat` at the top; `test` + `e2e` depend on `changes`; `ci` depends on `test`/`e2e`. This proves the `needs` graph, the `outputs.code -> steps.filter.outputs.code` wiring, and the gate references are all structurally valid.

## Deviations from Plan

None - plan executed exactly as written. The mechanism, globs, negative `if:`, and gate rework all match Runbook 3 / PATTERNS Conventions 1-5 verbatim.

The only working-tree change outside my task file was a pre-existing SDK side-effect flip of `.planning/config.json` `_auto_chain_active: false -> true` (written by the orchestrator chain at executor start). It is unrelated to this plan's ci.yml task and was deliberately NOT staged.

## Deferred / CI-Pending Verification (NOT faked locally)

- **act-compat `act -n` per-trigger selection (Assumption A3): confirmed-in-CI-pending.** A3 claims the negative `if: needs.changes.outputs.code != 'false'` keeps the gated `test`/`e2e` jobs in the `act -n` plan when the filter output is empty under act. This CANNOT be confirmed on this dev box because **Docker is not running** -- act cannot set up the `changes` container job, so it never resolves `changes`'s (empty) output nor schedules the dependent `test`/`e2e`/`ci` jobs in the dry-run executor. After the change, the local `act -n` run regressed from 10/2 to 7/5: `ci/test-` and `ci/e2e` are now also absent because the new `needs: changes` edge extends the Docker-dependent subtree to include them -- the same no-Docker artifact that already affected `ci/ci` at baseline. The `act -g` graph (above) proves the workflow is structurally sound; A3 is verified by the CI `act-compat` job (ubuntu-latest, Docker present) and the draft-PR run, exactly per the Phase-6 precedent. Per the plan's explicit constraint, the local act result was NOT faked.
- **actionlint: deferred to CI.** `actionlint` is not installed on this box (no `actionlint` on PATH, no `./actionlint` binary) -- the Phase-6 recorded state. `./actionlint -color` is verified by the CI `lint-workflows` job (pinned 1.7.7). The local static substitutes (`act --validate` parse + the `act -g` DAG render + the manual structural review of the `needs` graph, `outputs` wiring, negative `if:`, and gate expression) all pass.
- **Live skip-gate behavior:** that a planning-only PR skips the matrix yet `ci` reports green, and a code PR runs the matrix, is a draft-PR operational verification (like Phase 6 SC3), to be recorded in VERIFICATION.md -- NOT a CI assertion.

## Self-Check: PASSED

- FOUND: .github/workflows/ci.yml (changes job line 46; test gate line 78-80; e2e gate line 111-114; reworked ci gate line 182-193)
- FOUND commit 4245761 (Task 2 ci.yml change)
- Task 1 was read-only (act-compat baseline) -- no commit expected; its findings are recorded above
