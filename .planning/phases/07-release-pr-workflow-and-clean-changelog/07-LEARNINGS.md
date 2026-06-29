# Phase 7 Learnings: Release-PR workflow and clean changelog

**Extracted:** 2026-06-29

## Decisions (locked, with rationale)

- **One-field nx.json change decouples the cut from tagging:** `release.git.tag: true -> false`
  (keep `commit:true`, `push:false`, `createRelease:false`). Source-verified against nx 23.0.1:
  the unified `nx release` gates tagging on `git.tag` and push on `createRelease` (NOT `git.push`).
- **Manual tag-after-merge, not automated.** The default `GITHUB_TOKEN` cannot fire another
  workflow, and a PAT/App reintroduces a long-lived `contents` secret that contradicts the
  tokenless-OIDC posture. The maintainer tags the merge commit `angular-typechecker@x.y.z`.
- **Merge commits (not squash)** -- maintainer preference to keep granular history; the clean
  changelog comes from curation, independent of merge method.
- **Empty bypass on the Default-branch ruleset** (full PR mode, owner included). Release
  integrity is unaffected: tag pushes are governed by the SEPARATE retained Release-tag ruleset.
- **Clean changelog = curate-in-PR + scope hygiene** (primary); `gh release create --notes-file`
  for Release notes. The nx custom renderer is a deferred optional backstop.

## Lessons / landmines (verified)

- **`nx release version` subcommand REJECTS the top-level `release.git` block** in nx 23.0.1 --
  only the unified `nx release` (and `--dry-run`) honors it. Always use the unified command.
- **`createRelease: "github"` is a push landmine** -- with `push:false` it hard-errors
  (`GIT_PUSH_FALSE_WITH_CREATE_RELEASE`); without it, nx pushes the un-curated commit during the
  local cut. Keep `createRelease:false`.
- **GitHub repository-ruleset update is a full-replacement PUT** (`PUT /repos/{o}/{r}/rulesets/{id}`),
  not PATCH -- resend the entire rules array. Rulesets grant **no implicit admin/owner bypass**
  (unlike classic branch protection); empty `bypass_actors` blocks even the owner. `ci` + the
  CodeQL `Analyze` checks all come from the github-actions app (`integration_id 15368`).
- **The required-check deadlock:** a workflow-level `paths-ignore` on a REQUIRED check leaves the
  merge button stuck on "Expected -- waiting for status" forever (a skipped WORKFLOW never reports;
  a skipped JOB reports success). Fix = the skip-aware aggregate gate: `dorny/paths-filter` `changes`
  job + heavy jobs gated by a job-level `if:`, and the `ci` aggregate drops only `skipped` while
  staying fail-closed on `failure`/`cancelled`.
- **act `-n` evaluates `if:` but NOT path filters (A3):** use the NEGATIVE form
  `if: needs.changes.outputs.code != 'false'` so the empty `changes` output under `act -n` keeps the
  gated jobs in the plan and `act-compat`'s `assert_selected` stays green. Confirmed locally (Docker)
  AND on real runners.
- **CHANGELOG leak-detection regexes must be anchored to the leak grammar** (WR-01): a bare
  `\b\d{2}(?:-\d{2})*:` false-positives on `Angular 22:` / `14:30`, and `\((\d{2}...)\)` on `Node (22)`.
  Anchor: commit-type keyword + `(NN[-NN])`; bold token with trailing colon; bare scope only at
  line start. A leak detector that fails on legit prose is worse than none -- it blocks real releases.

## Process / orchestration learnings

- **Sequencing for the ruleset switch:** push the phase work AND confirm the NEW skip-gate ci.yml
  green on real runners BEFORE enabling the ruleset that requires `ci`. Enabling a required check
  that is red/non-reporting deadlocks `main`. (The old ci.yml being green on `main` is not enough --
  the NEW ci.yml is the one that must be proven.)
- **The bootstrap paradox:** the phase that establishes PR-mode is itself the last direct-push batch.
  Its commits land on `main` directly (old ruleset), then the switch flips `main` to PR-only, and the
  phase CLOSE-OUT (this PR) is the first artifact to go through the new flow -- dogfooding it.
- **Worktrees were unsafe here** (recurring repo learning, see memory `worktree-executors-need-node-modules`):
  fresh worktrees lack `node_modules` (07-01's spec verification needs it) AND the phase's planning
  commits were unpushed (a worktree off `origin/HEAD` would be stale). Ran executors sequentially on
  the main tree instead. `branching_strategy: none` meant no isolation was lost.
- **`act`/`actionlint` are not on the Windows arm64 dev box by default** -- local act-compat needs
  Docker running (it was started mid-phase, which let the local A3 cross-check run 12/0). actionlint
  still deferred to the CI `lint-workflows` job. The draft-PR / push-to-main CI run is the
  authoritative cross-OS + workflow-lint proof (the Phase-6 SC3 precedent).

## Surprises

- The staged "Default branch" ruleset required ONLY the two CodeQL `Analyze` checks and was
  **missing `ci`** -- the load-bearing Phase-6 contract. Caught during discuss-phase; the maintainer
  added `ci` to the required checks live before the switch.
- **CodeQL default setup was already enabled** (it had been deferred in Phase 6's D-16, but enabled
  since 2026-06-28) and is green on `main` + runs on PRs (`threat_model: remote`) -- so requiring the
  two `Analyze` checks alongside `ci` adds real security gating with no deadlock risk.
