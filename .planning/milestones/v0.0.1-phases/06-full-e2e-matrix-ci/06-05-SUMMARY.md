---
phase: 06-full-e2e-matrix-ci
plan: 05
subsystem: infra
tags: [github-actions, ci, act, actionlint, pnpm, matrix, sha-pinning, oidc-gate]

# Dependency graph
requires:
  - phase: 06-04
    provides: "release.yml publish-job `if: startsWith(github.ref, 'refs/tags/angular-typechecker@')` ref gate -- the condition the act suite asserts to discriminate tag-push (publish SELECTED) from branch-push (publish SKIPPED)"
  - phase: 06-02
    provides: 'angular-typechecker-matrix-e2e project (the third serialized e2e project the e2e job runs)'
  - phase: 06-03
    provides: 'the cross-OS unit+integration suite (FS/OS/Node) the matrix `test` job exercises on all 6 cells'
  - phase: 05-04
    provides: 'release.yml hardening envelope + action SHA pins (checkout v5.0.1, setup-node v5.0.0) reused verbatim; the bare-literal-token comment hygiene rule'
provides:
  - '.github/workflows/ci.yml -- the cross-OS / multi-Node CI gate: lean 6-cell test matrix + Linux-only e2e + act-compat + lint-workflows + aggregate `ci` gate (the Phase-7 required-check contract name)'
  - 'tools/act/act-compat.sh + tools/act/events/*.json -- the container-free act compatibility suite (parseability + trigger/condition fidelity)'
  - '.actrc -- native-arm64 local act runner-image mapping'
affects: [phase-7-release-pr-branch-protection]

# Tech tracking
tech-stack:
  added:
    - 'act v0.2.89 (CI act-compat job + local dev tool; not a shipped dep)'
    - 'actionlint 1.7.7 (CI lint-workflows job; not a shipped dep)'
    - 'pnpm/action-setup v6.0.9 (e2e job pnpm provisioning, SHA-pinned)'
  patterns:
    - 'Aggregate gate job named exactly `ci` (needs all upstream jobs + if:always() + fail-closed on failure||cancelled||skipped) as the single stable required-status-check name'
    - 'act -n dry-run + injected GITHUB_REF to assert if:-gated job selection (act ignores on: filters, evaluates if:)'
    - "Reuse release.yml's exact action SHAs so Dependabot bumps both workflows in lockstep"

key-files:
  created:
    - '.github/workflows/ci.yml'
    - 'tools/act/act-compat.sh'
    - 'tools/act/events/pull_request.json'
    - 'tools/act/events/push-main.json'
    - 'tools/act/events/push-tag.json'
    - 'tools/act/events/workflow_dispatch.json'
    - '.actrc'
  modified: []

key-decisions:
  - 'ci.yml lean 6-cell matrix uses `matrix.include` (explicit cell list), NOT a node x os cross-product -- the 6 cells are ubuntu 22/24/26 + windows 24/26 + macos 24 (RD-01)'
  - 'lint-workflows installs actionlint 1.7.7 via the official download-actionlint.bash script (no extra action SHA to pin); act-compat installs act v0.2.89 via the nektos/act install.sh with an explicit version arg'
  - 'act-compat.sh uses --pull=false on every `act -n` so the dry-run does not fetch the runner image over the network; the dry-run plan job-selection is identical with or without it'
  - 'workflow_dispatch assertion injects a tag GITHUB_REF so release/publish is reachable (the publish if: gate keys on the ref); a bare workflow_dispatch on a non-tag ref correctly skips publish'

patterns-established:
  - "Pattern 1: the `ci` aggregate gate is the ONLY required-check name (matrix cell names are dynamic); needs:[test,e2e,act-compat,lint-workflows], if:always(), fail-closed via contains(needs.*.result,'failure'||'cancelled'||'skipped')"
  - "Pattern 2: act compatibility suite is container-free (--validate + -n only); never plain `act <event>` execution; capture each plan to a variable before grepping with rg so a pipe tail cannot mask act's exit code"

requirements-completed: [CI-01]

# Metrics
duration: 8min
completed: 2026-06-29
---

# Phase 6 Plan 05: ci.yml + act compatibility suite + .actrc Summary

**Cross-OS / multi-Node GitHub Actions CI gate (lean 6-cell matrix + Linux-only e2e + container-free act-compat + actionlint lint-workflows + a single aggregate `ci` gate) plus a container-free act suite that proves the 06-04 release.yml `if:` ref gate discriminates tag-push from branch-push.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-29T01:59:39Z
- **Completed:** 2026-06-29T02:08:14Z
- **Tasks:** 2
- **Files modified:** 7 (all created)

## Accomplishments

- `.github/workflows/ci.yml` -- the CI-01 gate: a LEAN 6-cell test matrix (ubuntu 22/24/26 + windows 24/26 + macos 24, fail-fast:false, NO arm64 runners, NO `architecture` pin), a Linux-only Node-24 e2e job (NX_DAEMON:false, pnpm via action-setup, the three serialized e2e projects by explicit list), an `act-compat` job (pinned act v0.2.89, container-free), a `lint-workflows` job (actionlint 1.7.7, container-free), and a single aggregate `ci` gate (needs all four, if:always(), fail-closed on failure||cancelled||skipped).
- The hardening envelope matches release.yml exactly: top-level `permissions: contents: read`, `persist-credentials: false` on every checkout, the same 40-char SHA pins for checkout (v5.0.1) + setup-node (v5.0.0), pnpm/action-setup SHA-pinned (v6.0.9), `concurrency` cancel-in-progress, NO `registry-url`, NO `pull_request_target`.
- `tools/act/act-compat.sh` + four event payloads + `.actrc` -- the act suite. Ran locally: **12 PASS / 0 FAIL**. It proves act can ingest both workflows (`act --validate`) and that the `if:`-gated job selection discriminates per trigger: pull_request -> all ci jobs, no release publish; push-main -> ci jobs + release publish SKIPPED; push-tag -> release publish SELECTED; workflow_dispatch (tag ref) -> release publish reachable.

## Task Commits

Each task was committed atomically:

1. **Task 1: author ci.yml** - `08c2777` (ci)
2. **Task 2: act compat suite + .actrc** - `ffcde45` (test)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified

- `.github/workflows/ci.yml` - CI-01 gate: 6-cell matrix test job, Linux-only e2e job, act-compat job, lint-workflows job, aggregate `ci` gate
- `tools/act/act-compat.sh` - container-free act --validate + act -n per-trigger if:-gated job-selection assertions (executable, mode 100755)
- `tools/act/events/pull_request.json` - minimal pull_request payload (head ci/validate-ci-matrix -> base main)
- `tools/act/events/push-main.json` - push payload, ref refs/heads/main
- `tools/act/events/push-tag.json` - push payload, ref refs/tags/angular-typechecker@0.0.2
- `tools/act/events/workflow_dispatch.json` - minimal dispatch payload
- `.actrc` - maps ubuntu-latest + ubuntu-24.04 to catthehacker/ubuntu:act-24.04 (multi-arch; arm64 auto-selected); no forced container-architecture

## Decisions Made

- **ci.yml matrix uses `matrix.include` (explicit 6-cell list)** rather than a `node x os` cross-product, per RD-01 -- the lean matrix is a deliberate non-product selection (full Node sweep on Linux + OS axis on Node 24 + the one worth-keeping windows x 26 cell). No arm64-specific runners; no `architecture` pin (arch is correctness-irrelevant for a pure-JS ngtsc type-checker).
- **actionlint installed via the official `download-actionlint.bash` script pinned to 1.7.7**, and act via `nektos/act` `install.sh` pinned to `v0.2.89` -- both as version-pinned binary downloads inside SHA-pinned-checkout jobs, avoiding the need to pin two more action SHAs while keeping the binaries deterministic.
- **`act-compat.sh` passes `--pull=false`** on every `act -n` so the dry-run does not fetch the ~500MB runner image over the network; the dry-run plan's job-selection is byte-identical with or without a present image (verified locally).
- **The `workflow_dispatch` fidelity assertion injects a tag `GITHUB_REF`** so `release/publish` is reachable -- the publish `if:` gate keys on the ref, so a bare workflow_dispatch on a non-tag ref (correctly) skips publish; injecting the tag ref proves the manual escape-hatch reaches publish when dispatched against a release tag.
- **Threat-model comments avoid bare literal tokens** (`pull_request_target`, `contents: write`, the auth-token env var, `@vN`) that a release-hygiene string-check might count -- the active YAML directives carry the real security model; the comments describe it in prose (per the 05-04 decision). Verified clean via a token scan.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' structural verifies (`CI_YML_OK`, `ACT_SUITE_OK`) passed, and the act suite ran 12/0 locally on the first authored version. No Rule 1/2/3 auto-fixes were needed (the ci.yml structure and the act if:-gate discrimination both worked as researched on first authoring).

## Issues Encountered

- **act prompts interactively for a default runner image when no `.actrc` exists** (it hung on stdin during the first probe with `level=fatal msg="Incorrect function."`). Resolved by authoring `.actrc` first (the `-P` label->image mappings) before running any `act -n` -- which is the intended order anyway (the `.actrc` is a deliverable). Not a code issue; a probe-ordering observation.
- **actionlint is NOT installed on the Windows arm64 dev box** (`actionlint: command not found`). Per the plan's `<verify_and_durability>` allowance, the local actionlint run is a bonus, not a gate -- the orchestrator runs actionlint on the workflows in the final validation pass, and the `lint-workflows` CI job runs it on the draft-PR. As a substitute local static check, `act --validate` confirmed both workflows parse, and the structural verify printed `CI_YML_OK`. The `ci.yml` was authored to be actionlint-clean (typed expressions, valid `needs.*.result` graph, valid `matrix.include` references, valid `runs-on` labels, POSIX-clean `run:` step shell).

## act-compat.sh local result

```
=== summary: 12 passed, 0 failed ===
act compatibility suite PASSED
```

- Guard 1 (parseability): `act --validate` PASS -- both ci.yml + release.yml parse.
- Guard 2 (trigger/condition fidelity), all PASS:
  - pull_request -> ci/test-1, ci/e2e, ci/act-compat, ci/lint-workflows, ci/ci SELECTED; release/publish ABSENT
  - push-main (GITHUB_REF=refs/heads/main) -> ci/test-1, ci/ci SELECTED; release/publish SKIPPED (the 06-04 if: gate is false on a branch ref)
  - push-tag (GITHUB_REF=refs/tags/angular-typechecker@0.0.2) -> release/publish SELECTED (the if: gate is true on a tag ref; never executed -- dry-run only)
  - workflow_dispatch (tag ref) -> release/publish reachable

## Next Phase Readiness

- The `ci` aggregate gate job (id + name exactly `ci`) is the cross-phase contract Phase 7's "Default branch" ruleset will require as the single status check. LOCKED -- do not rename.
- **SC3 (full matrix green + required gate) is NOT proven locally** -- by design (RD-10). `act` cannot emulate windows-latest/macos-latest, and the dev box is Windows arm64. The authoritative cross-OS validation is a throwaway `ci/validate-ci-matrix` draft PR on real GitHub runners (close-without-merge; land ci.yml on main via the existing direct-push flow). The aggregate gate's `skipped`-handling is verified there (act's `needs.*.result`/`skipped` semantics diverge from GitHub -- documented inline in act-compat.sh).
- Phase 7 is NOT pre-adopted: no ruleset switch, no PR-merge release flow, no required-check wiring -- those stay Phase 7's.

## Self-Check: PASSED

- All 7 created files verified on disk (ci.yml, act-compat.sh, 4 event payloads, .actrc) + SUMMARY.
- Both task commits verified in git log (08c2777 ci.yml, ffcde45 act suite + .actrc).

---

_Phase: 06-full-e2e-matrix-ci_
_Completed: 2026-06-29_
