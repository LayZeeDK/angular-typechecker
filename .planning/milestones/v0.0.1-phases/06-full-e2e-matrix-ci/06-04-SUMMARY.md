---
phase: 06-full-e2e-matrix-ci
plan: 04
subsystem: infra
tags: [github-actions, oidc, release, ci, security, ngc, nx-release]

# Dependency graph
requires:
  - phase: 05-packaging-publish-hardening-e2e-smoke-mvp
    provides: the hardened OIDC-only release.yml (tag-push publish, id-token:write, npm-publish environment, SHA-pinned actions) + the release-hygiene.int.spec regression gate
  - phase: 05.1
    provides: the proven tokenless OIDC steady-state publish + the decoupled release config (release.git.push:false / createRelease:false)
provides:
  - The publish-job ref gate `if: startsWith(github.ref, 'refs/tags/angular-typechecker@')` on release.yml (RD-07 Option A, additive defense-in-depth)
  - An act-discriminable publish condition (act evaluates `if:` but not `on:` filters) that 06-05 asserts for tag-vs-branch selection
affects: [06-05-ci-act-compat, phase-7-release-pr-workflow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Job-level `if:` ref gate as belt-and-suspenders over the `on: push: tags:` primary gate (publish unreachable on a non-tag ref even if a trigger is later broadened)"
    - "Explanatory workflow comments live on standalone `#` lines (never inline trailing) and avoid banned literal tokens so the substring-based release-hygiene regression spec stays green"

key-files:
  created:
    - .planning/phases/06-full-e2e-matrix-ci/06-04-SUMMARY.md
    - .planning/phases/06-full-e2e-matrix-ci/deferred-items.md
  modified:
    - .github/workflows/release.yml

key-decisions:
  - "Added ONLY the publish-job `if:` ref gate + a standalone comment block; the OIDC/provenance/permissions/environment model is byte-for-byte unchanged (proven by the release-hygiene regression spec + a comment-stripped structural assertion)"
  - "The `nx release --dry-run` version/changelog preview is blocked by a PRE-EXISTING, out-of-scope fixture build failure (06-01 buildable/publishable fixtures need ng-packagr, which is deliberately not installed per OQ-1); logged to deferred-items.md, NOT fixed in 06-04"

patterns-established:
  - "Pattern: workflow `if:` gate comments stay on their own `#` line and reword around the substring-checked banned literals (pull_request_target / contents: write / NODE_AUTH_TOKEN / @vN)"

requirements-completed: [CI-01]

# Metrics
duration: 4min
completed: 2026-06-29
---

# Phase 6 Plan 04: release.yml publish-job ref gate (RD-07) Summary

**Added the single additive `if: startsWith(github.ref, 'refs/tags/angular-typechecker@')` ref gate to release.yml's publish job, leaving the proven OIDC/provenance/permissions/environment model byte-for-byte intact (release-hygiene spec 15/15 green).**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-29T01:14:38Z
- **Completed:** 2026-06-29T01:18:13Z
- **Tasks:** 1
- **Files modified:** 1 (release.yml) + 2 planning artifacts (SUMMARY, deferred-items)

## Accomplishments

- Added the RD-07 (Option A, user-approved) job-level ref gate to `release.yml`'s publish job, at job level between `permissions:` and `steps:` -- additive defense-in-depth so the OIDC publish is unreachable on a non-tag ref even if a trigger is later broadened, with the `on: push: tags:` filter remaining the primary real gate.
- Wrote the explanatory comment as a standalone `#` block ABOVE the `if:` (never an inline trailing comment), reworded to avoid the substring-checked banned literals (`pull_request_target` / `contents: write` / `NODE_AUTH_TOKEN` / `@vN`).
- Re-verified the frozen model is intact: the `release-hygiene.int.spec` regression gate is GREEN (15/15; full install-e2e suite 22/22, exit 0), and a comment-stripped structural assertion confirms every `uses:` is a 40-char SHA, `id-token: write` present, no `contents: write`, `registry-url: https://registry.npmjs.org/` retained, `NODE_AUTH_TOKEN` unset, no `pull_request_target`.
- The full `git diff` shows ONLY the +7 additive lines (comment block + `if:`); nothing else in `release.yml` moved.

## Task Commits

1. **Task 1: add the publish-job ref gate + re-verify the frozen model is intact** - `dc740ab` (ci)

## Files Created/Modified

- `.github/workflows/release.yml` - Added the publish-job `if: startsWith(github.ref, 'refs/tags/angular-typechecker@')` ref gate + a standalone explanatory comment block (RD-07 Option A); +7 lines, nothing else changed.
- `.planning/phases/06-full-e2e-matrix-ci/deferred-items.md` - Logged DI-06-01 (the out-of-scope `nx release --dry-run` pre-version fixture build failure).
- `.planning/phases/06-full-e2e-matrix-ci/06-04-SUMMARY.md` - This summary.

## Re-verification Evidence (the critical_release_yml_caveats)

| Invariant | Result |
|-----------|--------|
| `if: startsWith(github.ref, 'refs/tags/angular-typechecker@')` present at job level | YES (between `permissions:` and `steps:`) |
| Comment is a standalone `#` line (no inline trailing comment; no banned literals) | YES |
| Every `uses:` a 40-char SHA (`93cb6efe...`, `a0853c24...`) | YES |
| `id-token: write` present; `contents: write` ABSENT; top-level `contents: read` | YES |
| `environment: npm-publish` intact | YES |
| `registry-url: https://registry.npmjs.org/` retained (OIDC detection) | YES |
| `NODE_AUTH_TOKEN` not present as an active env declaration | YES (unset) |
| `NPM_CONFIG_PROVENANCE: true` | YES |
| `persist-credentials: false` | YES |
| `pull_request_target` absent | YES |
| `release-hygiene.int.spec` regression gate | GREEN (15/15; install-e2e suite 22/22, exit 0) |
| `nx.json` `release.git.push:false` + `createRelease:false` + `projects:[angular-typechecker]` | UNCHANGED |
| `git diff` is the +7 additive lines only (OIDC model byte-for-byte unchanged) | YES |

`nx release --dry-run` sanity: see Issues Encountered -- it published/pushed NOTHING (it halts in the pre-version build, upstream of any release write), but could not surface the version/changelog preview due to a pre-existing, out-of-scope fixture build failure (DI-06-01).

## Decisions Made

- Followed the plan exactly: a single job-level `if:` line + a standalone comment block, with full re-verification. No release was cut and nothing was pushed.

## Deviations from Plan

None - plan executed exactly as written. (The one out-of-scope discovery during verification, DI-06-01, was logged to `deferred-items.md` per the SCOPE BOUNDARY rule and NOT fixed in this plan.)

## Issues Encountered

**`nx release --dry-run` cannot reach its version/changelog preview (pre-existing, out of scope).** The plan's acceptance criterion asks the dry-run to preview a clean version + changelog and write nothing. The dry-run runs a `preVersionCommand` (`npx nx run-many -t build`), and that unscoped sweep now picks up the 06-01 matrix-e2e consumer-workspace fixtures `buildable-lib` / `publishable-lib`, whose `@nx/angular:ng-packagr-lite` / `@nx/angular:package` build targets fail with `Cannot find module 'ng-packagr'` (ng-packagr is deliberately NOT installed in the dev repo per OQ-1 -- the executor never RUNS those builds, it only reads each project's `tsConfig`). This is:

- **Independent of the 06-04 edit:** `release.yml` is not consumed by `nx build`; the failure pre-exists and is upstream of any version/push/publish step (so the dry-run still proves nothing is pushed/published).
- **Out of scope for 06-04** (SCOPE BOUNDARY -- only auto-fix issues directly caused by the current task's changes). The `nx.json` release config (`git.push:false`, `createRelease:false`, `projects:[angular-typechecker]`) is intact and untouched.
- **Logged** to `.planning/phases/06-full-e2e-matrix-ci/deferred-items.md` (DI-06-01) with candidate remediations (scope the `preVersionCommand` to `angular-typechecker:build`, or exclude the fixture build targets from the default sweep) for a maintainer/owning-plan call before the next real release cut.

The OIDC-model re-verification 06-04 owns is fully satisfied by the release-hygiene regression spec (15/15 green) + the comment-stripped structural assertion + the +7-line-only diff.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 06-05 (ci.yml + act-compat) can now assert the tag-vs-branch publish discrimination: act faithfully evaluates the new `if:` (it ignores `on:` filters), so a `push-tag` event selects the publish job and a `push-main` / branch event skips it.
- Before the next real release cut, resolve DI-06-01 (the `nx release --dry-run` pre-version fixture build failure) so the version/changelog preview is reachable again.

## Self-Check: PASSED

- FOUND: `.github/workflows/release.yml`
- FOUND: `.planning/phases/06-full-e2e-matrix-ci/06-04-SUMMARY.md`
- FOUND: `.planning/phases/06-full-e2e-matrix-ci/deferred-items.md`
- FOUND commit: `dc740ab`

---
*Phase: 06-full-e2e-matrix-ci*
*Completed: 2026-06-29*
