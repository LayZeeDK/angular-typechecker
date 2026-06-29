# Phase 6 — Morning Handoff (overnight run, 2026-06-29)

## TL;DR

Phase 6 (Full e2e Matrix + CI) is **fully executed, committed locally, and verified to the
limit of what's possible without a push.** All 5 plans done; every local gate green. The
**only** remaining item is **SC3: the cross-OS matrix green on real GitHub runners** — which
needs a `git push` (deliberately not done overnight; push is in Ask-permission mode). One
copy-paste step below proves it.

**Nothing has been pushed.** `origin/main` is 31 commits behind local `main`; all 43 non-`.planning`
changed files are this phase's work (ci.yml, release.yml +if-gate, the matrix-e2e fixture/specs,
the act suite, `.actrc`, `.nxignore`, the unit/integration specs).

## The one action needed: validate the matrix on real runners

### Recommended (RD-10 — validate before it's blessed on `main`): throwaway draft PR
```bash
# from the repo root, on `main` (all Phase-6 work is committed here)
git switch -c ci/validate-ci-matrix
git push -u origin ci/validate-ci-matrix          # branch push fires NOTHING (ci.yml push trigger is branches:[main] only)
gh pr create --draft --base main \
  --title "ci: validate Phase-6 CI matrix" \
  --body "Validate the lean 6-cell matrix + Linux-only e2e + act-compat + lint-workflows + ci gate. Do not merge."
gh pr checks --watch                               # watch test (6 cells) + e2e + act-compat + lint-workflows + the `ci` gate
gh run view --log-failed                           # if anything is red
```
On green (the `ci` check passes): land `ci.yml` on `main` via the existing direct-push flow
(Phase 6 still uses direct push; Phase 7 switches to PR-merge), then close the probe:
```bash
git switch main && git push origin main            # lands all 31 commits; ci.yml re-runs on push-to-main (also green)
gh pr close ci/validate-ci-matrix --delete-branch
```

### Simpler alternative (no branch protection requires `ci` yet, so this is safe): push `main`
```bash
git push origin main                               # fires ci.yml on push-to-main -> the matrix runs on `main`
gh run watch                                        # or: gh run list --branch main
```
(The draft PR is the cleaner RD-10 path; push-`main` is simpler and equally valid today because
the `ci`-requiring "Default branch" ruleset isn't enabled until Phase 7.)

### If a matrix cell is red
Expected suspects (all pre-mitigated but real-runner-only): Node 26 toolcache miss (downloads
from nodejs.org — slower, occasionally flaky); a native-prebuilt install hiccup on a specific
OS. Fix in `ci.yml` / the spec, re-push (the PR `synchronize` re-runs). The `ci` gate is
fail-closed (`failure||cancelled||skipped`), so a red/skipped cell correctly reddens `ci`.

## What's already proven locally (green)

| Gate | Result |
|------|--------|
| Unit + integration (`nx run-many -t test -p angular-typechecker`) | **114 passed** (incl. D-10 mixed-case + RD-04 store-dir generality + host-derived case-sensitivity) |
| 5-type + pnpm e2e (`...-p angular-typechecker-matrix-e2e`) | **7 passed** (~82s) — all 5 project types green + injected TS2322; pnpm symlinked-store run |
| release.yml if-gate regression (release-hygiene int spec) | **22/22** — OIDC model byte-for-byte unchanged |
| act suite (`bash tools/act/act-compat.sh`) | **12 passed** — all triggers/conditions; tag→publish SELECTED, branch→SKIPPED |
| actionlint (native arm64) on ci.yml + release.yml | **exit 0**, zero findings |
| `nx run-many -t build` | **green** (DI-06-01 fixed via `.nxignore`) |
| Verifier | `human_needed` (SC1+SC2 verified; SC3 = this draft-PR run) — **0 blockers** |
| Security audit | **8/8 threats closed, 0 open** |
| Code review | **0 critical, 3 warnings** (WR-02/03 fixed; WR-01 below) |

## Open review items (your call)

- **WR-01 (release.yml:54) — decide:** the publish-job `if: startsWith(github.ref, 'refs/tags/angular-typechecker@')`
  also gates `workflow_dispatch`, so a **manual dispatch from a branch now skips publish** — only a
  dispatch against a **tag ref** publishes (arguably correct, since publish is tag-scoped). If you
  want branch-dispatch republish, add `|| github.event_name == 'workflow_dispatch'` to the gate;
  otherwise add a one-line comment documenting the tag-ref requirement. (Untouched overnight —
  it's the frozen file; re-editing re-triggers the release-hygiene check.)
- **WR-02 / WR-03 — DONE** (committed `f28c15c`): act-compat now matches the `ci/test-` job family
  (not the positional `ci/test-1`) and the version probe is `set -e`-safe.
- **Info (6):** all minor/documented (see `06-REVIEW.md`) — the `import.meta` LSP error on
  `run-typecheck.integration.spec.ts` is a known false positive (vitest transforms ESM; the runner passed).

## Notes / guardrails for Phase 7

- The required status check is **`ci`** (and only `ci`). Wire exactly that into the "Default branch"
  ruleset; do NOT require individual matrix cells (dynamic names). Do NOT enable the ruleset until
  the draft-PR matrix is green.
- The pnpm realpath regression-guard takes a documented **Windows fallback** locally (Git Bash
  `ln -s` copies); its true `.pnpm` boundary-crossing teeth validate on the **Linux e2e leg** of the
  draft-PR run, backstopped by the 06-03 unit realpath coverage.
- Local `.actrc` is committed for native-arm64 `act` (run `bash tools/act/act-compat.sh` anytime, or
  `act pull_request --container-architecture linux/arm64` to run the real Linux jobs locally).

## State

ROADMAP shows Phase 6 = 5/5 plans complete; the phase GOAL is **executed + locally verified, SC3
pending the draft-PR matrix run**. Do not mark the milestone done / advance to Phase 7 until the
`ci` check is green on real runners.
