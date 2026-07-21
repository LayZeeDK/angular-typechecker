---
phase: 35-automated-code-scanning-proof
plan: 03
subsystem: ci
tags: [sarif, code-scanning, ci-job, upload-sarif, pr-only, fork-gate, proof, act]

# Dependency graph
requires:
  - phase: 35-automated-code-scanning-proof
    provides: 35-01 isolated one-per-family fixture (tools/sarif-proof-fixture/) + drift-lock; 35-02 tools/ci/assert-code-scanning.mjs (gh-api poll + set-membership) with its GH_TOKEN + PR_NUMBER + SARIF_ID env contract
  - phase: 34-per-project-sarif-categories-in-ci
    provides: the dogfood code-scanning job shape (fork gate, security-events: write, persist-credentials false, fetch-depth 0, SHA-pinned upload-sarif, produced-guard) mirrored verbatim
  - phase: 33-diagnostic-family-sarif-rule-metadata
    provides: the familyOf + per-rule tags/level SARIF contract the proof job's alerts assert against
provides:
  - .github/workflows/ci.yml -- new PR-only, non-fork code-scanning-proof job (gen proof.sarif from the fixture -> upload under category angular-typecheck-proof -> assert via tools/ci/assert-code-scanning.mjs)
  - tools/act/act-compat.sh -- proof-job trigger-fidelity assertions (PR-selected + push-main-absent)
affects: [36-code-scanning-gate-promotion, GATE-01]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Second instance of the Code Scanning job pattern: a fork-gated, path-gated, SHA-pinned, security-events-scoped upload job -- this one PR-only with a DEDICATED category and a gh-api assert step, kept OUT of the required ci aggregate"
    - "PR metadata (PR number, sarif-id) passed into an assert step via env: values (bracket syntax for the hyphenated sarif-id), never interpolated into a run: shell -- mirrors the e2e job's PROJECT pattern"
    - "act-compat assert_absent on a PR-only job proves an event-name if: gate drops it on push-to-main (the SC4 leak-prevention check)"

key-files:
  created: []
  modified:
    - .github/workflows/ci.yml
    - tools/act/act-compat.sh

key-decisions:
  - "Fork gate uses the simple github.event.pull_request.head.repo.fork == false (no github.event_name != 'pull_request' || prefix): the job is already PR-only via its own if:, so the dogfood job's push-to-main compound form is unnecessary -- and this keeps the head.repo.fork == false token guarding BOTH the upload and assert steps"
  - "PROOF-01/02 remain Pending (not marked complete this plan): the GitHub-ingestion half is provable ONLY in real CI (the phase Nyquist point), so they close at phase verification once the code-scanning-proof job is green on a real PR -- consistent with 35-02"
  - "Local act-compat PR-selection fidelity deferred to the real-CI act-compat job (authoritative): this box's act -n does not resolve needs.changes.outputs.code to empty-string, so ALL code-gated jobs (incl. the untouched dogfood code-scanning) drop from the local PR plan -- an environment divergence, not a defect"

# Metrics
duration: ~7m
completed: 2026-07-21
status: complete
---

# Phase 35 Plan 03: code-scanning-proof CI job Summary

**A new PR-only, non-fork `code-scanning-proof` job in `ci.yml` that runs the shipped standalone CLI over the isolated `tools/sarif-proof-fixture/`, uploads the single-run SARIF under the dedicated `category: angular-typecheck-proof`, and asserts via `tools/ci/assert-code-scanning.mjs` that one alert per diagnostic family landed on the PR merge-ref -- mirroring every dogfood CI security invariant verbatim, gated PR-only so the fixture's deliberate errors never reach `main`'s alerts view, and deliberately kept out of the required `ci` aggregate (GATE-01 is Phase 36); plus two `act-compat.sh` assertions locking the PR-only trigger fidelity.**

## Performance
- **Duration:** ~7 min
- **Started:** 2026-07-21T19:35:38Z
- **Completed:** 2026-07-21
- **Tasks:** 1
- **Files modified:** 2 (both modified, none created)

## Accomplishments
- Added the `code-scanning-proof` job to `.github/workflows/ci.yml`, placed immediately after the dogfood `code-scanning` job and before the `ci` aggregate, modelled on the dogfood job VERBATIM with a matching-style header comment explaining PROOF-01/02, the isolated out-of-graph fixture, the dedicated category, the PR-only + non-fork gating, and the deliberate absence from the required gate.
- Job wiring exactly per D-02/a/b/c/d:
  - `needs: changes`; `if: ${{ github.event_name == 'pull_request' && needs.changes.outputs.code != 'false' }}` (PR-only D-02b + the NEGATIVE `!= 'false'` path-gate D-02d).
  - `permissions: { contents: read, security-events: write }` (job-level replaces top-level; write covers upload AND the alerts/analyses read, D-02c); `env: { NX_DAEMON: false }`.
  - Reused SHA pins verbatim: `checkout@9c091bb... # v7.0.0` (`persist-credentials: false`, `fetch-depth: 0`), `setup-node@48b55a... # v6.4.0` (node 24, cache npm), `npm ci`, `npx nx build angular-typechecker`.
  - `id: gen` -- `node dist/packages/angular-typechecker/src/cli/bin.js -c tools/sarif-proof-fixture/tsconfig.json --format sarif > proof.sarif || true` + the `[ -s proof.sarif ]` produced-guard, run from the repo root.
  - `id: upload` -- gated `head.repo.fork == false && steps.gen.outputs.produced == 'true'`; REUSED `upload-sarif@7188fc363630916deb702c7fdcf4e481b751f97a # v4.37.1`; `sarif_file: proof.sarif`, `category: angular-typecheck-proof` (one run + one category, no multi-run rejection).
  - Assert step -- same fork+produced gate; `env: { GH_TOKEN: github.token, PR_NUMBER: github.event.pull_request.number, SARIF_ID: steps.upload.outputs['sarif-id'] }` (bracket syntax for the hyphenated output; PR data via env, never in a `run:` shell); `run: node tools/ci/assert-code-scanning.mjs`.
- Confirmed the job is ABSENT from the `ci` aggregate `needs[]`, and the `code-scanning`/`changes`/`ci` jobs are otherwise unchanged (D-02d).
- Added two `tools/act/act-compat.sh` assertions locking the PR-only trigger: `assert_selected "$PR_PLAN" "ci/code-scanning-proof" "pull_request"` and `assert_absent "$PUSH_MAIN_PLAN" "ci/code-scanning-proof" "push-main"` (the load-bearing SC4/T-35-06 check that the fixture errors never run on `main`), each with a short comment. The `-proof` suffix keeps `ci/code-scanning-proof` a distinct `[$token` so the dogfood `ci/code-scanning` assertions keep passing.

## Task Commits
Each task committed atomically (conventional scope `35-03`):
1. **Task 1: code-scanning-proof job + act-compat trigger assertions** - `1ada3c7` (ci)

## Files Created/Modified
- `.github/workflows/ci.yml` (MOD) - new `code-scanning-proof` job (+ header comment) between the dogfood `code-scanning` job and the `ci` aggregate.
- `tools/act/act-compat.sh` (MOD) - PR-selected + push-main-absent assertions for `ci/code-scanning-proof`.

## Verification
- **Task-1 automated structural check (authoritative local gate): PASSED.** `code-scanning-proof:` job present; `category: angular-typecheck-proof`; bracket-syntax `steps.upload.outputs['sarif-id']`; `PR_NUMBER` via env; reused `upload-sarif@7188fc36...` SHA pin inside the job; `github.event_name == 'pull_request'` PR-only gate; `head.repo.fork == false` guarding BOTH upload and assert (2 occurrences); both act-compat assertions present; job ABSENT from the `ci` aggregate `needs[]`.
- **`act --validate`: PASSED** -- both workflows parse; the new job + its comment block + all Actions expressions are structurally valid.
- **act-compat push-main assertion: PASSED** -- `assert_absent "$PUSH_MAIN_PLAN" "ci/code-scanning-proof"` passes: the `github.event_name == 'pull_request'` gate correctly drops the proof job from the push-to-`main` plan (the SC4 leak-prevention check works).
- **End-to-end `gen`-step dogfood: PASSED** -- ran the exact ci.yml `gen` command over the fixture: one SARIF run, four rules, set-equal to the assert's EXPECTED -- `ATC90002`->tool/error, `NG8002`->template-type-check/error, `NG8101`->extended-diagnostics/warning, `TS2322`->typescript/error; `produced=true`; no `proof.sarif` leaked into the working tree.
- **`git diff --stat` scope: PASSED (D-04)** -- the commit touches ONLY `.github/workflows/ci.yml` + `tools/act/act-compat.sh`; `packages/angular-typechecker/**` + `package.json`/`package-lock.json` byte-unchanged; no version bump.
- **Real-CI-only (authoritative, Nyquist point): DEFERRED to phase verification** -- the `code-scanning-proof` job GREEN on the milestone PR against `main` is the ONLY place the SARIF -> GitHub-ingestion assertion is actually exercised. Local gates prove the SARIF is well-formed and the assert logic is correct but CANNOT prove GitHub ingested it.

## Deviations from Plan
None to the plan's instructions -- the job and assertions were implemented exactly as specified. One environment note (not a code deviation):

- **act-compat PR-selection fidelity is not verifiable on this local box; deferred to the real-CI `act-compat` job (authoritative).** `bash tools/act/act-compat.sh` reports the new `assert_selected "$PR_PLAN" "ci/code-scanning-proof"` as failed locally -- but so do ALL pre-existing PR-block assertions for code-gated jobs (`ci/test-`, `ci/e2e`, `ci/fallow`, `ci/cve-lite`, `ci/format-lint`, `ci/code-scanning`, `ci/ci`). The raw `act -n pull_request` plan on this Windows arm64 box stages only `ci/changes` + the three jobs with no `needs: changes` gate (`ci/act-compat`, `ci/lint-workflows`, `ci/scoped-name-guard`): this act runtime does NOT resolve `needs.changes.outputs.code` to empty-string in dry-run (the design assumption behind the NEGATIVE `!= 'false'` form documented in `ci.yml`), so every code-gated job -- including the untouched dogfood `ci/code-scanning` -- drops from the local PR plan. This is an environment divergence, not a defect in this change; the local-tooling note in the plan brief anticipates exactly this by treating the real-CI `act-compat` job (ubuntu, act v0.2.89, required in the `ci` aggregate, green) as authoritative. Out of scope to "fix" locally (the suite is CI-authoritative by design).

## Authentication Gates
None. The real ingestion assert runs in CI authenticated by the ambient workflow `GITHUB_TOKEN` (`GH_TOKEN`); no local auth was required.

## Known Stubs
None. The job runs the shipped CLI over a real fixture and a real assert script; no placeholder data, empty returns, or TODO markers were introduced.

## Threat Flags
None. All security-relevant surface introduced by this job (the `security-events: write` scope, the PR-metadata env boundary, the reused SHA-pinned action, the fork gate) is enumerated in the plan's `<threat_model>` (T-35-01..T-35-SC) and implemented as specified. No NEW network endpoint, auth path, or trust boundary beyond that register was added.

## Requirements
- **PROOF-01 / PROOF-02: Pending (not marked complete).** Consistent with 35-02: the SARIF -> Code Scanning ingestion round-trip is provable ONLY in real CI (the phase Nyquist point). Both close at phase verification once the `code-scanning-proof` job is green on a real PR against `main`. The local half (fixture emits the four tuples; assert logic + fail-loud path) is fully proven across 35-01/35-02/35-03; only ingestion remains.

## Next Phase Readiness
- The proof pipeline is fully wired: fixture (35-01) -> assert (35-02) -> CI job (35-03). The milestone PR's CI run is the authoritative gate that closes PROOF-01/02.
- Phase 36 (GATE-01/02 + DOC-01) will promote `code-scanning` (+ this proof job) into the required `ci` aggregate `needs[]`, un-path-gate the dogfood job, enable the "Require code scanning results" ruleset, and document the Scanned-files limitation. This plan deliberately left the proof job OUT of the required gate (D-02d).

## Self-Check: PASSED
- `.github/workflows/ci.yml` contains the `code-scanning-proof:` job (git grep: 1 match).
- `tools/act/act-compat.sh` references `code-scanning-proof` (git grep: 2 matches -- PR-selected + push-main-absent).
- Task commit `1ada3c7` present in git log.
- `packages/angular-typechecker/**` + manifest byte-unchanged (D-04 additive-only posture holds).

---
*Phase: 35-automated-code-scanning-proof*
*Completed: 2026-07-21*
