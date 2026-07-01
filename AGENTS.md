# AGENTS.md -- angular-typechecker

Agent-agnostic instructions for any AI coding agent working in this repository.
(Claude Code loads this via the `@AGENTS.md` reference at the top of `CLAUDE.md`.)

## Changing this file

**Any change to `AGENTS.md` MUST be code-reviewed.** This file governs how every AI agent
works in this repository, so an inaccurate, ambiguous, or unverified instruction propagates
silently into all future agent behavior. The review may be satisfied EITHER by an explicit
independent review before commit, OR by the mandatory `/gsd-code-review` step that runs
during phase execution (the `code_review_gate`), which reviews every source file changed in
the phase -- including this one. Either way, an `AGENTS.md` change is not "done" until a
code review has checked it for factual accuracy against the actual codebase and tooling,
clarity, and internal consistency, and every finding is resolved. (This rule exists because
a release-mechanics claim in this file was once wrong about the 0.x semver bump shift and
about `--skip-publish` semantics -- review is what caught both.)

## Conventional Commits drive the changelog and the released version

This repository releases `angular-typechecker` to npm with **`nx release`** configured
for **`version.conventionalCommits: true`** (see `nx.json` -> `release`). That means the
NEXT version number AND the generated changelog are computed **from the commit log** --
not chosen by hand. Every commit you write is release input. Follow these rules so the
release machinery behaves predictably.

### Commit message format

```
type(scope): short imperative description

optional body explaining what and why

optional footer (e.g. BREAKING CHANGE: ..., Refs: ...)
```

- `type` is required and lowercase. `scope` is optional but, when present, is rendered
  verbatim in the changelog (see the scope-hygiene rule below).
- A breaking change is marked EITHER by a `!` before the colon (`feat(core)!: ...`) OR by
  a `BREAKING CHANGE:` footer.

### How each type influences the version bump

`nx release` maps conventional-commit types to a SemVer bump. The version bump for a
release is the HIGHEST bump implied by any qualifying commit since the previous release
tag.

**IMPORTANT -- this repo is pre-1.0, so the bumps are shifted DOWN one level.** Nx 23
enables `version.adjustSemverBumpsForZeroMajorVersion` (default `true`, and this repo does
NOT override it; verified in nx 23.0.1 `config.js` and in `.planning/research/FOLLOWUP-FINDINGS.md`).
While the current version is `0.x`, every bump nx computes is lowered one step:
`major -> minor`, `minor -> patch`, `patch -> patch`. So the operative mapping right now is:

| Commit type                                                           | Standard (post-1.0) | EFFECT NOW (0.x, this repo) | In the changelog?                   |
| --------------------------------------------------------------------- | ------------------- | --------------------------- | ----------------------------------- |
| `feat`                                                                | minor               | **patch** (0.0.1 -> 0.0.2)  | Yes (Features)                      |
| `fix`                                                                 | patch               | patch (0.0.1 -> 0.0.2)      | Yes (Fixes)                         |
| `feat!` / `fix!` / `BREAKING CHANGE:`                                 | major               | **minor** (0.0.1 -> 0.1.0)  | Yes (Breaking Changes)              |
| `perf`                                                                | none                | none                        | Yes (Performance) -- shown, no bump |
| `docs`, `chore`, `refactor`, `test`, `build`, `ci`, `style`, `revert` | none                | none                        | No (hidden by default)              |

Two consequences to internalize:

- **While in 0.x, `feat` and `fix` both produce a patch bump** -- they are
  indistinguishable for the VERSION (they still land in different changelog sections).
  A breaking change is what cuts a new minor (e.g. `0.1.0`). This stays true until the
  first `1.0.0`, after which the standard column applies.
- **A release window that contains only no-bump types (`docs`/`chore`/`perf`/etc.)
  produces NO version bump** -- `nx release` reports no releasable change. Only `feat`,
  `fix`, and breaking changes move the version.

### Always confirm with a dry run

Because the 0.x adjustment surprises people, never assume the computed version. Preview it
with the UNIFIED command:

```
npx nx release --dry-run
```

The dry run prints BOTH the version nx will pick and the changelog it will write, sourced
from the commit log. Treat its output as the source of truth.

**Always use the unified `nx release` command, NOT the `nx release version` subcommand.**
Newly verified against nx 23.0.1: the `version` subcommand REJECTS the top-level
`release.git` block in `nx.json` and errors out (it tells you to move git options under
`release.version.git` / `release.changelog.git`). Only the unified `nx release` (and its
`--dry-run`) honors the top-level `release.git` block this repo relies on, so it is the only
command that previews and cuts with the correct `commit`/`tag`/`push` behavior. Use the
unified command for every preview and every cut.

(The "nx release configuration norms" note in `CLAUDE.md` states the standard post-1.0
mapping `feat -> minor, fix -> patch`; the 0.x-adjusted column above is what actually
happens until `1.0.0`.)

### Only commits that touch the published project count

`nx.json` scopes releases with `release.projects: ["angular-typechecker"]`. With
`conventionalCommits`, the version of that package is derived from commits whose changes
touch the package's project graph -- commits that only touch `.planning/`, docs, or other
projects do NOT bump `angular-typechecker`. (This is why a stretch of `docs(...)` commits
under `.planning/` leaves the package version untouched.)

Attribution is decided by the FILES a commit changes, NOT by the commit message's scope
text. A `feat(anything): ...` that edits files under `packages/angular-typechecker/` WILL
count toward that package's bump; a `feat(core): ...` that only edits `.planning/` will
NOT. So the scope is cosmetic for both attribution and (post-curation) the changelog --
write accurate `type`s and put real changes in the package's files.

## Repo-specific gotchas (learned in production)

1. **When there is no releasable (`feat`/`fix`) commit, pin the version explicitly.**
   If you must cut a release in a window that contains only `docs`/`chore` commits (for
   example, a verification or maintenance release), `conventionalCommits` will compute no
   bump. Pass the target version explicitly instead of relying on derivation:

   ```
   npx nx release 0.0.2 --skip-publish
   ```

   Confirm with `--dry-run` first. Note: a LITERAL version (`0.0.2`) bypasses
   conventional-commits derivation AND the 0.x adjustment entirely -- you get exactly what
   you typed. A keyword specifier (`patch`/`minor`/`major`) instead still goes through the
   0.x shift-down, so prefer a literal version when you want a deterministic result.

2. **The auto-generated changelog renders the commit SCOPE -- keep scopes clean for
   public releases.** Internal workflow scopes (for example GSD plan ids like
   `feat(05-01):` or `fix(04-03):`) leak straight into the generated CHANGELOG and the
   GitHub Release notes, and decision refs such as `[#1]` can be mis-parsed as issue
   links. This is not hypothetical: a live `npx nx release --dry-run` PROVED that the raw
   nx changelog renders plan-id scopes verbatim as bold headings such as `**06-02:**` --
   exactly the internal phase/plan numbers a public changelog must never expose. For any
   PUBLIC release, hand-curate a clean `CHANGELOG.md` entry (match the existing `0.0.1`
   entry's style) rather than shipping the raw generated dump. Prefer release-meaningful
   scopes (`core`, `executor`, `release`, `deps`) over internal ids in commits that will
   reach a public changelog.

3. **Releases go through a Release PR; the cut creates NO tag, and you tag the MERGE
   COMMIT after the PR lands.** `main` is PR-only (see "The default-branch ruleset" note
   below), so you NEVER cut or push a release directly to `main`. `nx.json` sets
   `release.git` to `{ commit: true, tag: false, push: false }` (plus
   `changelog.workspaceChangelog.createRelease: false`), so `npx nx release --skip-publish`
   commits the version bump + changelog and does NOTHING else: with `tag: false` it creates
   NO git tag at all, and with `push: false` + `createRelease: false` it pushes nothing.
   The tag is created separately, by hand, on the merge commit AFTER the PR merges. Full
   order:
   - (1) Off an up-to-date `main`, branch `git switch -c release/x.y.z`.
   - (2) Preview with `npx nx release --dry-run`, then cut with `npx nx release --skip-publish`
     (one commit lands on the branch: version + raw changelog; NO tag, NO push).
   - (3) Curate `CHANGELOG.md` (strip plan-id scopes; add the prose summary + Compatibility
     block) and amend it onto the version commit (`git commit --amend --no-edit`).
   - (4) Push the branch and open a PR into `main`. The PR CARRIES the code AND the
     `.planning/` updates (do NOT strip `.planning/` -- this repo wants planning artifacts on
     `main`). Self-merge once the required `ci` check is green, as a MERGE COMMIT (the repo's
     `allowed_merge_methods` is `["merge"]`; the tag will target that merge commit).
   - (5) On the merged `main` HEAD, create the tag on the MERGE COMMIT with the EXACT name
     `angular-typechecker@x.y.z` (NO `v` prefix -- the `v`-prefixed form would not match
     `release.yml`'s `on: push: tags: ['angular-typechecker@*']` filter):
     `git tag angular-typechecker@x.y.z <merge-sha>`.
   - (6) BEFORE pushing, verify the tagged tree carries the bump:
     `git show angular-typechecker@x.y.z:packages/angular-typechecker/package.json` must show
     the new `"version"`. Then `git push origin angular-typechecker@x.y.z` -- which fires
     `.github/workflows/release.yml` -> OIDC publish with provenance (approve the
     `npm-publish` environment).
   - (7) Create the GitHub Release from the curated `CHANGELOG.md` section yourself:
     `gh release create angular-typechecker@x.y.z --notes-file <curated-section> --verify-tag`.
     NEVER use `--generate-notes`: it builds notes from PR TITLES and cannot strip text inside
     a title, so a PR titled `feat(NN-NN): ...` would leak the internal scope verbatim.

   The tag push and the GitHub Release are done by a human on purpose -- the CI publish job
   holds only `id-token: write`, never `contents: write`, and the irreversible "publish"
   action stays behind a manual gate. (Why manual tagging rather than CI-automated: the
   default `GITHUB_TOKEN` cannot trigger another workflow, so a CI-pushed tag would NOT fire
   `release.yml`; a PAT/GitHub App would reintroduce a long-lived `contents`-scoped secret
   that contradicts the repo's tokenless-OIDC posture. Manual keeps `release.yml`
   byte-unchanged and adds zero secrets.)

   **LANDMINE -- do NOT re-enable `changelog.workspaceChangelog.createRelease: "github"`.**
   nx 23 requires `git push` whenever `createRelease` is set (it must push the tag to tie the
   GitHub Release to it). How that manifests depends on the current `git.push` value -- and
   BOTH outcomes defeat the curate-before-push flow:
   - **With the repo's current explicit `release.git.push: false`:** nx HARD-ERRORS at
     config-load time with `GIT_PUSH_FALSE_WITH_CREATE_RELEASE` ("The createRelease option for
     changelogs cannot be enabled when git push is explicitly disabled ...") and
     `process.exit(1)` -- verified in nx 23.0.1 `command-line/release/config/config.js` (raised
     ~136-149, reported + exit ~899-913). Every `nx release` then fails until you revert one of
     the two settings; nothing is pushed.
   - **If you ALSO drop the explicit `git.push: false`:** nx defaults the changelog git `push`
     to `true` whenever `createRelease` is set (config.js ~150-160), so `nx release` pushes the
     version commit + tag during the LOCAL step -- BEFORE you curate. `--skip-publish` does NOT
     suppress this (the push is gated by `changelog.git.push` at changelog.js:566, not by
     `skipPublish`). This is the real silent-push hazard that once pushed an un-curated commit +
     tag to a force-push-protected `main`, which could not be cleanly undone.

   `release.git.push: false` + `createRelease: false` is the fix for both: the local cut stays
   push-free, and curation always precedes the manual `git push origin angular-typechecker@<version>`.

## Quick checklist before cutting a release

The release goes through a Release PR; the cut creates NO tag. Tag the merge commit AFTER
the PR lands, and never push a release directly to `main`.

1. Are the changes since the last tag committed as `feat`/`fix` (so they bump + appear in
   the changelog), or is this an explicit-version maintenance release?
2. Branch off an up-to-date `main`: `git switch -c release/x.y.z`.
3. Run `npx nx release --dry-run` (the unified command, NOT `nx release version`) and read
   the proposed version + changelog. If only `docs`/`chore` commits exist, pin the version
   explicitly (see gotcha 1).
4. Cut on the branch with `npx nx release --skip-publish`. With `git.tag: false` this
   creates NO tag, and with `push: false` + `createRelease: false` it pushes nothing -- it
   only commits the version bump + raw changelog.
5. Curate `CHANGELOG.md` so no internal scopes/ids leak into the public changelog, and amend
   it onto the version commit (`git commit --amend --no-edit`).
6. Push the branch and open a PR into `main` that carries BOTH the code and the `.planning/`
   updates. Self-merge once the required `ci` check is green, as a MERGE COMMIT.
7. On the merged `main` HEAD, tag the MERGE COMMIT with the exact name
   `angular-typechecker@x.y.z` (no `v`); verify the tagged tree carries the bump with
   `git show angular-typechecker@x.y.z:packages/angular-typechecker/package.json`; then
   `git push origin angular-typechecker@x.y.z` to fire CI. Approve the `npm-publish`
   environment for the OIDC publish, and create the GitHub Release from the curated changelog
   with `gh release create angular-typechecker@x.y.z --notes-file <curated-section> --verify-tag`
   (never `--generate-notes`). See `.github/workflows/release.yml` for the full mechanics.

## The default-branch ruleset: `main` is PR-only

`main` is governed by an active "Default branch" ruleset with an EMPTY bypass list -- even
the repository owner cannot push directly to `main`. Every change (code AND `.planning/`)
reaches `main` only through a PR that satisfies the required status checks (`ci` plus the
CodeQL `Analyze (actions)` / `Analyze (javascript-typescript)` checks). Do NOT attempt a
direct `git push origin main`; it will be rejected. This is why releases run through the
Release PR above rather than a local cut pushed to `main`.

Release TAGS are governed by a SEPARATE "Release tag" ruleset, not the default-branch one, so
the empty branch bypass does not block pushing `angular-typechecker@x.y.z` after a merge.

**Lockout recovery (the cost of the empty bypass):** if the required `ci` check ever goes
red or stops reporting and the merge button is blocked, recover by EDITING the ruleset --
repo admins can edit a ruleset even though they cannot bypass it. Toggle the ruleset's
`enforcement` to `disabled`, push the fix, then re-enable `enforcement: active`. Prefer this
temporary enforcement toggle over adding a standing bypass actor (a standing bypass would
permanently weaken the PR-only guarantee).

## Parallel execution in git worktrees: the `node_modules` junction

When an agent runs phase plans in PARALLEL, each plan's executor works in an isolated git
worktree. A fresh worktree branches from a clean tree where `node_modules` is gitignored and
therefore ABSENT. An executor with no `node_modules` cannot run `nx build` / `nx test` /
`tsc`, so it cannot verify its own work -- unacceptable for a type-checking tool whose entire
value is correctness. Provision the worktree's dependencies before any verification, using
ONE of the two patterns below.

### Pattern A -- share via a `node_modules` junction (DEFAULT, only when deps are unchanged)

When a plan changes NO dependencies (pure source/test edits -- the common case), share the
main checkout's already-installed, lockfile-pinned `node_modules` instead of re-installing.
As the executor's FIRST action AFTER the worktree HEAD/branch assertion (and BEFORE any
`nx`/`tsc`/`vitest`), create a directory junction (Windows) or symlink (POSIX) from the
worktree's `node_modules` to the main checkout's `node_modules`, then verify it resolves:

```bash
# Windows (the primary dev environment): a directory junction.
cmd //c "mklink /J node_modules <ABS-PATH-TO-MAIN-CHECKOUT>\node_modules"
# POSIX equivalent: ln -s <abs-path-to-main-checkout>/node_modules node_modules
test -d node_modules/typescript && test -d node_modules/@angular/compiler-cli \
  || { echo "FATAL: node_modules junction failed"; exit 1; }
```

Run these FROM THE WORKTREE ROOT -- the `node_modules` paths are relative to it. The
`cmd //c` prefix is the Git Bash spelling (the double slash stops MSYS from rewriting the
`/c` argument into a Windows path); from PowerShell use `cmd /c "mklink /J ..."` or
`New-Item -ItemType Junction`.
The `test -d` assertion runs under Git Bash on any OS.

**VALIDITY CONDITION (do not skip):** sharing is correct ONLY when `package.json`,
`package-lock.json`, and the Node version are identical between the worktree and the main
checkout. That holds for any plan that does not touch dependencies. If a plan ADDS, REMOVES,
or UPGRADES a dependency, Pattern A is INVALID for that worktree -- use Pattern B.

### Pattern B -- per-worktree install (when a plan changes dependencies)

If the plan modifies `package.json` / `package-lock.json`, the worktree needs its OWN
`npm ci` so it builds against the deps the plan declares -- never a junction into the main
checkout's stale tree.

### Worktree base, concurrency, and teardown rules

- **Base ref.** The dev environment sets `worktree.baseRef: "head"` in Claude Code
  `settings.json` so worktrees branch from local HEAD, not `origin/HEAD`. Whatever the
  runtime, a DEPENDENT wave's worktree MUST start from a commit that already contains the
  prerequisite plan's work; otherwise it builds against stale sources.
- **Concurrency under a shared junction.** When multiple worktrees share one junctioned
  `node_modules` and run `nx` concurrently, set `NX_DAEMON=false` and pass `--skip-nx-cache`
  so concurrent runs do not race on the shared `node_modules/.cache/nx`. Each worktree keeps
  its own `dist/` and `.nx/`, so only the shared cache path needs guarding.
- **Teardown is LINK-ONLY and orchestrator-owned (load-bearing safety).** After EVERY agent
  in the wave has returned, the orchestrator removes each worktree's `node_modules` junction
  LINK-ONLY before `git worktree remove`:
  ```bash
  cmd //c "rmdir <ABS-PATH-TO-WORKTREE>\node_modules"   # removes the junction link, NOT its target
  # POSIX symlink: rm <abs-path-to-worktree>/node_modules   (removes the link, not the target)
  ```
  Target the specific worktree's path explicitly: teardown is orchestrator-owned and the
  orchestrator's CWD is the MAIN checkout, so a bare relative `node_modules` would resolve to
  the wrong tree. NEVER `rm -rf node_modules` and never run a RECURSIVE delete on a worktree
  that still contains the junction -- a recursive delete follows the junction and wipes the
  MAIN checkout's deps. This LINK-ONLY rule applies ONLY to Pattern A (junctioned) worktrees;
  a Pattern B worktree has a REAL `node_modules`, so `git worktree remove` cleans it normally.
  After teardown, verify the main checkout's `node_modules` entry count is unchanged. (If it
  is ever lost, `npm ci` restores it -- cheap, but the correct teardown order avoids needing
  it.) Never let one worktree's teardown fire while a sibling executor is still using the
  shared `node_modules`; defer all teardown until the wave completes.
- **Single-plan wave: skip worktrees.** When there is no parallelism to gain, run the
  executor sequentially on the main checkout (no worktree isolation) so it has real
  `node_modules` with zero provisioning.
- **Post-merge gate.** Per-worktree self-checks pass in isolation but cannot catch cross-plan
  integration breaks. After merging a wave's worktree branches back, run the full build +
  test on the MERGED main checkout as the authoritative gate.

CI does NOT use worktrees -- it runs a fresh `npm ci` per job (see `.github/workflows/ci.yml`),
so the junction is a local parallel-execution mechanism only.
