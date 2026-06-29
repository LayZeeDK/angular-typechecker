# Phase 7: Release-PR workflow and clean changelog - Research

**Researched:** 2026-06-29
**Domain:** Release engineering (nx release 23.0.1), GitHub repository rulesets (REST), GitHub Actions required-check skip-gating, changelog hygiene
**Confidence:** HIGH (every load-bearing claim source-verified against installed nx 23.0.1 and the live GitHub API this session)

## Summary

Phase 7 converts a direct-push-to-`main` release into a Release-PR flow, flips `main` to PR-mode branch protection, and systematizes a clean public changelog. Every gray area is already LOCKED in `07-CONTEXT.md` (D-01..D-17) following a 2-researcher pre-pass and a 5-member Opus panel. This research DEEPENS those decisions into executable specifics and verifies the locked claims against current tooling. All verifications passed; no locked decision is contradicted by the evidence.

The four mechanical pieces are: (1) a one-field `nx.json` change (`release.git.tag: true -> false`) plus a release-branch cut runbook using the **unified** `nx release --dry-run`/`nx release --skip-publish` (the `version` subcommand REJECTS the top-level `release.git` block -- a newly verified operational constraint); (2) a `gh api PUT` full-replacement of ruleset 18229122 (flip `strict -> false`, `enforcement -> active`) then `DELETE` 18229088, both already in their expected pre-state; (3) the highest-risk piece -- a path-aware skip on `ci.yml` that must NOT deadlock the required `ci` check; and (4) a manual tag-after-merge + `gh release create --notes-file` runbook.

**Primary recommendation:** Use `dorny/paths-filter@9d7afb8d214ad99e78fbd4247752c4caed2b6e4c` (v4.0.0, node24) as a leading `changes` job, gate the heavy `test`/`e2e` jobs with a job-level `if:` on its output, and REWORK the `ci` aggregate gate to treat `skipped` as acceptable while staying fail-closed on `failure`/`cancelled`. This is the only mechanism that simultaneously (a) avoids the required-check deadlock, (b) survives the act-compat plan assertions, and (c) keeps the `ci` job id+name byte-stable.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Version + CHANGELOG generation | Local dev / release branch (`nx release`) | -- | nx writes the bump + changelog on the release branch; no CI involvement at cut time |
| Code/`.planning` integration to `main` | GitHub PR + branch ruleset | CI (`ci` aggregate) | PR is the merge gate; ruleset enforces it; `ci` is the required status check |
| Path-aware CI skip | GitHub Actions (`ci.yml`) | `dorny/paths-filter` | Skip decision is per-PR diff, computed inside the workflow (NOT at `on:` trigger) |
| Tag creation + publish trigger | Local maintainer (`git push` tag) | Frozen `release.yml` (OIDC) | Manual human gate on the one irreversible action; tag push fires the unchanged publish workflow |
| Branch protection state | GitHub rulesets (REST) | -- | One-time live operation, not a repeatable test |
| Public release notes | Local maintainer (`gh release create --notes-file`) | curated `CHANGELOG.md` section | Human-authored narrative; no automated path authors reader-visible text |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Release-PR flow (REL-01)**
- **D-01:** The SOLE `nx.json` release-config change is `release.git.tag: true -> false`. Keep `commit:true`, `push:false`, `createRelease:false`.
- **D-02:** Cut on a `release/*` branch via `nx release --skip-publish` (commit version+CHANGELOG, no tag, no push) -> open PR -> merge. Nx 23 has NO native release-PR mode.
- **D-03:** Tag-after-merge is MANUAL. After merge, `git tag angular-typechecker@x.y.z <merged-sha> && git push origin angular-typechecker@x.y.z`. Automated tagging DECLINED (default `GITHUB_TOKEN` cannot trigger another workflow; PAT/App = long-lived secret contradicting the OIDC posture).
- **D-04:** Merge method = MERGE COMMITS (`allowed_merge_methods` stays `["merge"]`). Tag the merge commit.
- **D-05:** Tag MUST be exactly `angular-typechecker@x.y.z` (no `v`). Tagged tree MUST carry the bumped `package.json`/`CHANGELOG.md`. Do NOT set `changelog.workspaceChangelog.createRelease:"github"`.

**Branch-protection switch (REL-02)**
- **D-06:** Default-branch ruleset `bypass_actors: []` (EMPTY -- full PR mode, owner included).
- **D-07:** `.planning/` reaches `main` by being CARRIED IN the feature PR -- NOT stripped via `/gsd-pr-branch`.
- **D-08:** `ci.yml` gains a PATH-AWARE skip; the skip-aware aggregate gate must distinguish "path-skipped" from "failed/cancelled".
- **D-09:** Ruleset ops via `gh api`: PUT (full replacement) 18229122 (`enforcement: active`, complete rules array); DELETE 18229088; RETAIN 18229053. Safe order: PUT-enable FIRST, THEN delete v0.0.1.
- **D-10:** `strict_required_status_checks_policy: false`.
- **D-11:** `required_approving_review_count: 0` (unchanged).
- **D-12:** Lockout recovery = toggle ruleset `enforcement: disabled` (admins can EDIT even when they cannot BYPASS), push fix, re-enable.

**Clean changelog (REL-03)**
- **D-13:** PRIMARY mechanism = hand-curate the CHANGELOG.md entry in the Release PR.
- **D-14:** GitHub Release notes = curated CHANGELOG.md section via `gh release create angular-typechecker@x.y.z --notes-file <section> --verify-tag`. Do NOT use `--generate-notes`.
- **D-15:** Commit + PR-title scope HYGIENE (use `core`/`executor`/`release`/`deps`; never let a plan-id scope ride a release window).
- **D-16:** nx custom changelog renderer DEFERRED (optional backstop, not built now).

**Documentation deliverable**
- **D-17:** Rewrite the `AGENTS.md` release-mechanics section for the Release-PR flow (code-review-gated). Reconcile the `angular-typechecker-release-mechanics` memory + CLAUDE.md norms note.

### Claude's Discretion
- Exact `release/*` branch naming (`release/x.y.z` vs `release/next`).
- The exact `ci.yml` skip-aware-gate mechanism (`dorny/paths-filter` job vs. job-level `if:` + always-run aggregate); the precise filter globs.
- Whether to add a `.github/release.yml` / an `internal` label (only relevant if `--generate-notes` were used -- it is not; likely skip).
- The per-release curated CHANGELOG wording and the GitHub Release title.
- Whether to batch `.planning/` checkpoints into fewer PRs.

### Deferred Ideas (OUT OF SCOPE)
- nx custom changelog renderer (auto-strip `^\d{2}(-\d{2})*$` scopes).
- `gh release create --generate-notes` + `.github/release.yml` (REJECTED -- PR-title scope leak).
- Squash merge (REJECTED -- D-04).
- Automated tag-after-merge (PAT/GitHub App workflow) (REJECTED -- D-03).
- Maintainer-on-bypass for direct `.planning/` pushes (REJECTED -- D-06).
- OpenSSF Scorecard / StepSecurity harden-runner / signed commits+tags.
- Nx community-registry-listing PR (`approved-community-plugins.json`).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REL-01 | Release-PR flow: `nx release` produces version+CHANGELOG on a `release/*` branch merged via PR; the tag created on the merged commit fires the frozen OIDC `release.yml`; `nx.json release.git` decouples commit from tag (`tag:false`) | Runbook 1 + the nx 23.0.1 source verification (release.js `shouldTag`/`shouldPush`); dry-run confirms commit-not-tag-not-push after the flip |
| REL-02 | Branch-protection switch: ENABLE Default-branch ruleset (PR + `ci` + 2 CodeQL checks + force-push/deletion blocked, empty bypass, `strict:false`); DELETE v0.0.1 ruleset; RETAIN Release-tag ruleset | Runbook 2 (gh-api PUT/DELETE bodies) + the live ruleset reads (all three confirmed in expected pre-state) |
| REL-03 | Clean changelog: CHANGELOG.md + GitHub Release notes expose NO internal GSD phase/plan numbers | Curate-in-PR (D-13) + scope hygiene (D-15); the live dry-run PROVES raw nx output leaks `**06-02:**` scopes today |

### Proposed REQUIREMENTS.md text + acceptance criteria

Add these to `.planning/REQUIREMENTS.md` under a new **Release Process (REL)** family and to the Traceability table (all three -> Phase 7):

- **REL-01 (Release-PR flow):** Releases no longer push version/changelog commits directly to `main`. `nx release --skip-publish` on a `release/*` branch produces the version bump + curated CHANGELOG commit with NO git tag and NO push; the change merges via PR; the maintainer creates the release tag on the merge commit, firing the unchanged tag-triggered OIDC publish (`release.yml` byte-identical). **Acceptance:** `nx.json` has `release.git.tag:false` (plus `commit:true`, `push:false`, `createRelease:false`); `release-hygiene.int.spec.ts` asserts `git.tag===false`; a release-branch `nx release --dry-run` shows "Skipped ... Tagging" and creates no tag/push; the tag `angular-typechecker@x.y.z` matches `release.yml`'s `on: push: tags` filter.
- **REL-02 (Branch-protection switch):** `main` requires a PR satisfying the `ci` + `Analyze (actions)` + `Analyze (javascript-typescript)` status checks with force-push/deletion blocked and empty bypass; the temporary v0.0.1 ruleset is deleted; the Release-tag ruleset is retained. **Acceptance:** `gh api .../rulesets/18229122` returns `enforcement:active`, `strict_required_status_checks_policy:false`, `bypass_actors:[]`, the three required checks, `allowed_merge_methods:["merge"]`; `gh api .../rulesets/18229088` returns 404; `gh api .../rulesets/18229053` still returns the active tag ruleset.
- **REL-03 (Clean changelog):** The public CHANGELOG.md entry and the GitHub Release notes contain NO internal GSD phase/plan scope (no `NN`/`NN-NN` token like `feat(05-01):`/`**06-02:**`). **Acceptance:** the curated CHANGELOG.md section matches the 0.0.1/0.0.2 style (prose summary + Features/Fixes/Breaking + a Compatibility block) and contains no `\b\d{2}(-\d{2})*\b` plan-id scope; the GitHub Release is created with `--notes-file` pointing at that section (never `--generate-notes`).

## Standard Stack

This is a process/config phase. The only NEW external dependency is the path-filter action.

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| `nx` (release) | 23.0.1 (installed) | Version bump + changelog generation on the release branch | [VERIFIED: `node_modules/nx/package.json` = 23.0.1] Already the project's release engine |
| `gh` CLI | repo-installed | Ruleset PUT/DELETE; release create | [VERIFIED: live `gh api` calls succeeded this session] |
| `dorny/paths-filter` | v4.0.0 (`9d7afb8d214ad99e78fbd4247752c4caed2b6e4c`) | Compute whether a PR diff touches code vs. planning/docs only | [VERIFIED: GitHub API tag ref] Most-widely-used path-filter action; node24 runtime matches the Node-24/26 envelope |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `actionlint` | 1.7.7 (pinned in ci.yml lint-workflows) | Static workflow validation of the modified ci.yml | Must stay green on the new YAML |
| `act` | v0.2.89 (pinned in ci.yml act-compat) | Parseability + per-trigger job-selection fidelity | Must stay green; the new YAML must `act --validate` + `act -n` clean |
| `vitest` | 4.x (installed) | `release-hygiene.int.spec.ts` regression gate | Add the `git.tag:false` assertion |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `dorny/paths-filter@v4.0.0` | `dorny/paths-filter@v3.0.3` (`d1c1ffe0248fe513906c8e24db8ea791d46f8590`, node20) | v3 is node20; the repo targets Node 24/26. v4 is the node24 line and the same maintainer/action. Prefer v4 unless a node24 incompatibility surfaces. |
| `dorny/paths-filter` job | `tj-actions/changed-files` | tj-actions was a documented supply-chain incident (mutable-tag repointing) referenced in this repo's own threat-model comments -- avoid on principle even SHA-pinned. |
| Step-level path detection (GitHub docs Workaround 2) | A leading filter job + job-level `if:` | Step-level "force-pass inside the step" keeps every matrix cell triggering but bloats every job and is harder to read; a leading filter job + job `if:` is cleaner. See "Common Pitfalls" for the act-compat nuance that drives the recommendation. |

**Installation:**
```bash
# No package install. dorny/paths-filter is referenced by SHA in ci.yml only.
# Dependabot (.github/dependabot.yml, github-actions ecosystem at /) auto-bumps the pin.
```

## Package Legitimacy Audit

> Only one external artifact is introduced: a GitHub Action (not an npm package). It is referenced by immutable 40-char commit SHA, not a registry version, which is the supply-chain control this repo already enforces (release-hygiene spec asserts every `uses:` is a 40-char SHA).

| Artifact | Source | Age | Usage | Pin | Disposition |
|----------|--------|-----|-------|-----|-------------|
| `dorny/paths-filter` | github.com/dorny/paths-filter (v4.0.0) | mature (v1..v4; v4.0.0 cut for node24) | path-diff detection in CI | `@9d7afb8d214ad99e78fbd4247752c4caed2b6e4c` (40-char SHA, [VERIFIED: GitHub API tag ref]) | Approved -- SHA-pinned, tracked by Dependabot |

**Packages removed due to slopcheck [SLOP] verdict:** none (no npm package introduced; slopcheck is npm/PyPI-scoped and not applicable to a SHA-pinned GitHub Action).
**Packages flagged as suspicious [SUS]:** none.

Supply-chain note: pinning by the **release tag's commit SHA** (not a floating `v4`) is mandatory here -- the `release-hygiene.int.spec.ts` SHA-pin assertion (`/^[0-9a-f]{40}$/` on every `uses:` ref) will FAIL the suite if a mutable `@v4` ref is committed. The trailing `# v4.0.0` comment is preserved (the spec strips only whole-line comments, not inline pin-version comments).

## Architecture Patterns

### System Architecture Diagram

```
                          RELEASE-PR FLOW (REL-01)
  maintainer (local)
    |
    |  git switch -c release/x.y.z   (off up-to-date main)
    v
  [ npx nx release --skip-publish ]  --- runs preVersionCommand: nx run-many -t build (gitignored dist/)
    |   git.tag:false  -> NO tag        --- bumps packages/angular-typechecker/package.json
    |   git.push:false / createRelease:false -> NO push   --- generates raw CHANGELOG.md entry (LEAKS scopes)
    |   git.commit:true -> ONE commit (version + raw changelog)
    v
  [ hand-curate CHANGELOG.md ]  ----> amend onto the version commit (strip plan-id scopes; add prose + Compatibility)
    |
    |  git push origin release/x.y.z ; gh pr create  (PR carries code + .planning/, D-07)
    v
  +-----------------------------------------------------------+
  |  GitHub PR  ->  Default-branch ruleset (REL-02) gate      |
  |   require PR + ci + Analyze(actions) + Analyze(js-ts)     |
  |   empty bypass / merge-commit / strict:false              |
  +-----------------------------------------------------------+
    |                                   ^
    |  (ci.yml: planning-only diff      |  (code diff -> full matrix runs + can fail ci)
    |   path-skips heavy jobs; ci=success)
    v                                   |
  [ self-merge (merge commit) ] --------+
    |
    |  git tag angular-typechecker@x.y.z <merge-sha>   (D-03 manual; D-05 invariants)
    |  git show <tag>:packages/angular-typechecker/package.json   (PRE-PUSH verify the bump)
    |  git push origin angular-typechecker@x.y.z
    v
  +-----------------------------------------------------------+
  |  Release-tag ruleset (RETAINED 18229053)                  |
  |   creation/deletion/non_fast_forward; bypass: owner+DeployKey
  +-----------------------------------------------------------+
    |
    v
  [ FROZEN release.yml ]  on: push: tags: angular-typechecker@*
    |   id-token:write only ; environment npm-publish (required reviewer)
    v
  [ OIDC publish to npm + SLSA provenance ]   (no token, no contents:write)
    |
    v
  [ gh release create angular-typechecker@x.y.z --notes-file <curated section> --verify-tag ]  (REL-03, D-14)
```

### Recommended Project Structure (files touched)
```
nx.json                                   # release.git.tag: true -> false (the ONE config change, D-01)
.github/workflows/ci.yml                  # add `changes` filter job + gate heavy jobs + rework `ci` gate (D-08)
AGENTS.md                                 # rewrite the release-mechanics section (D-17, code-review-gated)
CHANGELOG.md                              # curated per-release entry (D-13) -- created at each cut, not in the phase build
e2e/angular-typechecker-install-e2e/
  src/release-hygiene.int.spec.ts         # ADD git.tag===false assertion (regression gate)
.planning/REQUIREMENTS.md                 # define REL-01/02/03
# release.yml is FROZEN -- DO NOT TOUCH
# rulesets are LIVE GitHub config -- changed via gh api, not files
```

### Pattern 1: Unified `nx release` (NOT the `version` subcommand) on a release branch
**What:** Cut the version + changelog with the unified command. The `version` subcommand rejects the top-level `release.git` block.
**When to use:** Every release cut and every dry-run preview.
**Example:**
```bash
# Source: VERIFIED live this session. `nx release version --dry-run` errors:
#   "The release.git property in nx.json may not be used with the nx release version subcommand ...
#    configure git options ... with release.version.git and release.changelog.git."
# The UNIFIED command is the only one that honors the top-level release.git block.

git switch -c release/0.0.3            # off an up-to-date main
npx nx release --dry-run              # PREVIEW: prints version + changelog, makes no changes
npx nx release --skip-publish         # CUT: commit version+changelog, (after flip) NO tag, NO push
# -> hand-curate CHANGELOG.md, git commit --amend, push branch, open PR
```

### Pattern 2: gh-api full-replacement ruleset PUT (enable-then-delete order)
**What:** A PUT replaces the entire ruleset object (rules array included). PATCH-style partial merge is not how rulesets update -- supply the COMPLETE desired object.
**When to use:** The one-time REL-02 switch.
**Example:** see Runbook 2.

### Pattern 3: Skip-aware aggregate gate
**What:** Keep the workflow triggering on every PR (no `on:`-level `paths-ignore`). Detect the diff INSIDE the workflow. Gate heavy jobs. Make the single required `ci` job ALWAYS report, treating `skipped` as acceptable but failing on real `failure`/`cancelled`.
**When to use:** The REL-02 DX requirement (~58% of commits are `.planning/`-only).
**Example:** see Runbook 3 (the exact YAML deltas).

### Anti-Patterns to Avoid
- **Workflow-level `paths-ignore` on a required check:** the check never reports -> merge button stuck on "Expected -- waiting for status" forever. [VERIFIED: GitHub Docs "Troubleshooting required status checks" + community discussions #54877/#142210]
- **Job-level `if:` skip WITHOUT reworking the gate:** today's `ci` gate fails-closed on `skipped`; a skipped heavy job would FAIL `ci` and still block merge. Must rework the gate first.
- **`createRelease: "github"` in nx.json:** with `git.push:false` it hard-errors (`GIT_PUSH_FALSE_WITH_CREATE_RELEASE`); without it, nx defaults changelog `push:true` and pushes the un-curated commit during the local cut. [VERIFIED: nx 23.0.1 `config.js:139-159`]
- **`nx release version` subcommand:** rejects the top-level `release.git` block. [VERIFIED live this session]
- **Tagging a `v`-prefixed tag or tagging a non-merge commit:** breaks `release.yml`'s `angular-typechecker@*` filter / tags a tree without the bump.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detect whether a PR diff is planning-only | A custom `git diff --name-only` + glob shell step | `dorny/paths-filter` | Handles PR base/head resolution, push vs PR contexts, and predicate quantifiers; battle-tested; SHA-pinnable |
| Aggregate required-check status | A second "dummy twin" workflow with the same name (GitHub docs Workaround 1) | The existing skip-aware `ci` aggregate job | The twin clutters the Actions tab with duplicate names; the aggregate is the modern, single-required-check pattern |
| Strip plan-id scopes from the changelog | A regex sed over the nx-generated CHANGELOG, NOW | Hand-curation in the Release PR (D-13); nx custom renderer DEFERRED (D-16) | The curated narrative (prose + Compatibility block) is something no generator produces; a renderer couples to nx's `protected` API |
| Trigger publish from CI after merge | A PAT/GitHub-App workflow that pushes the tag | Manual `git push` of the tag (D-03) | default `GITHUB_TOKEN` can't trigger another workflow; a PAT is a long-lived `contents` secret that breaks the OIDC least-privilege posture |

**Key insight:** Every "automate it" temptation in this phase (auto-tag, auto-changelog, path-skip-at-trigger) has a documented failure mode that the locked decisions already route around. The phase's value is wiring proven primitives together, not building new automation.

## Common Pitfalls

### Pitfall 1: The required-check deadlock (THE key technical risk)
**What goes wrong:** A planning-only PR never reports the `ci` required check, leaving the merge button stuck on "Expected -- waiting for status to be reported."
**Why it happens:** GitHub treats a SKIPPED WORKFLOW (via `on:` `paths-ignore`) as never-reported (stays Pending forever), but a SKIPPED JOB (via `if:`) reports `success`. The required check is matched by NAME; if the workflow never runs, the named check never appears. [VERIFIED: GitHub Docs + community #142210]
**How to avoid:** NEVER add `paths-ignore` to the `on:` trigger. Keep `ci.yml` triggering on every PR; detect the diff inside the workflow; keep the `ci` aggregate job ALWAYS running (`if: always()`) and reporting.
**Warning signs:** A PR shows "Expected -- waiting for status to be reported" and never resolves.

### Pitfall 2: The aggregate gate fails-closed on `skipped`
**What goes wrong:** The CURRENT `ci` gate (ci.yml:137) fails when `contains(needs.*.result, 'skipped')` is true. The moment a heavy job is skipped by a path filter, `ci` FAILS and blocks merge -- the deadlock just moves from "Pending" to "Failed."
**Why it happens:** The Phase-6 gate was authored before path-skipping existed; `skipped` was treated as a defect (a misconfigured matrix cell). Phase 7 changes the meaning of `skipped` to "intentionally path-skipped."
**How to avoid:** Rework the gate to drop `'skipped'` from the fail set: fail only on `failure` OR `cancelled`. See Runbook 3 for the exact new gate expression. CAUTION: this widens what `ci` accepts -- a genuinely mis-skipped job (e.g., a cancelled dependency that GitHub reports as `skipped`) now passes. Mitigation: `cancelled` stays in the fail set, and the post-merge `main` `ci` run (which has no planning-only diff vs. its parent in practice for code merges) is the backstop.

### Pitfall 3: act evaluates `if:` but NOT path filters -- can break act-compat
**What goes wrong:** The `act-compat.sh` suite asserts WHICH jobs are SELECTED per trigger via `act -n`. act ignores `on:`/path filters and does NOT execute the `dorny/paths-filter` step (dry-run), so a `changes` job output is EMPTY under act. If the heavy jobs use `if: needs.changes.outputs.code == 'true'`, that condition is FALSE under act -> the jobs are ABSENT from the act plan -> the existing `assert_selected "$PR_PLAN" "ci/test-"` etc. assertions FAIL.
**Why it happens:** act's job-selection honors `if:`; an empty output makes a strict-equality `if:` false.
**How to avoid:** Make the heavy-job `if:` TRUE when the filter output is absent/empty, e.g. `if: needs.changes.outputs.code != 'false'` (negative form: runs unless explicitly 'false'). Under act the output is `''` which `!= 'false'` is TRUE -> the job stays in the plan -> act-compat assertions still pass. On real GitHub the filter sets `'true'`/`'false'` correctly. This is the decisive reason to prefer the leading-filter-job + negative `if:` shape over step-level force-pass.
**Warning signs:** `act-compat` job goes red with "expected ci/test- in the plan, not found" after the ci.yml change.

### Pitfall 4: nx 23 push is gated on `createRelease`, NOT `git.push`, in the unified command
**What goes wrong:** A reader assumes `git.push:false` is what prevents the push. It is necessary but the unified command's actual push trigger is `shouldCreateWorkspaceRemoteRelease` (i.e. `createRelease` truthy).
**Why it happens:** [VERIFIED: nx 23.0.1 `release.js:189-191`] `const shouldPush = (shouldCreateWorkspaceRemoteRelease || ...) ?? false;` -- push happens to support a remote release, not because `git.push` is true.
**How to avoid:** Keep BOTH `git.push:false` (defense-in-depth + the subcommand path) AND `createRelease:false`. The `release-hygiene` spec already asserts both.

### Pitfall 5: 0.x bump shift hides `feat`/`fix` distinction
**What goes wrong:** A `feat` commit produces a PATCH bump (not minor) while the repo is 0.x, surprising the cutter.
**Why it happens:** [VERIFIED: nx 23.0.1 `semver.js:69-86` + `config.js:245` default `true`] `adjustSemverBumpsForZeroMajorVersion` (default true) shifts major->minor, minor->patch. A LITERAL version (`npx nx release 0.0.3`) bypasses the shift entirely (only relative keywords are adjusted).
**How to avoid:** Always `npx nx release --dry-run` first and read the proposed version. For a maintenance release in a no-`feat`/`fix` window, pin the literal version.

## Code Examples

### Runbook 1: Release-branch cut (REL-01)
```bash
# Source: VERIFIED via nx 23.0.1 source + live dry-run this session.
# Pre-req: nx.json release.git.tag flipped to false (D-01). main up to date.

git switch main && git pull --ff-only
git switch -c release/0.0.3                 # branch naming: release/x.y.z (Claude's discretion)

# PREVIEW (makes no changes). Reads current version from the angular-typechecker@0.0.2
# git tag (a --merged ancestor of the release branch), derives the specifier from
# conventional commits, runs preVersionCommand (nx run-many -t build; dist/ is gitignored).
npx nx release --dry-run                    # confirm the version + changelog before cutting

# CUT: with git.tag:false -> "Tagging commit with git" is SKIPPED; with createRelease:false
# + git.push:false -> NO push. One commit lands on the branch (version + raw changelog).
npx nx release --skip-publish

# Hand-curate CHANGELOG.md (strip plan-id scopes; add prose + Compatibility block, D-13),
# then fold the curation into the version commit:
git add CHANGELOG.md
git commit --amend --no-edit

git push -u origin release/0.0.3
gh pr create --base main --head release/0.0.3 \
  --title "release: 0.0.3" \
  --body "Cut 0.0.3 (version + curated CHANGELOG). Carries .planning/ updates per D-07."
# The PR carries code + .planning/ (D-07). Self-merge once `ci` is green (MERGE COMMIT, D-04).
```

Maintenance-release variant (no `feat`/`fix` since the last tag):
```bash
# A literal version bypasses the 0.x shift and conventional-commits derivation entirely.
npx nx release 0.0.3 --dry-run --skip-publish     # preview
npx nx release 0.0.3 --skip-publish               # cut exactly 0.0.3
```

### Runbook 2: gh-api ruleset switch (REL-02)
```bash
# Source: VERIFIED -- live `gh api` reads this session confirm 18229122 is already in the
# expected pre-state (enforcement:disabled, bypass_actors:[], all 3 checks present,
# strict:true). The remaining ops: strict->false, enforcement->active, then delete v0.0.1.
# A PUT is a FULL REPLACEMENT [CITED: docs.github.com/en/rest/repos/rules] -- send the COMPLETE object.

# (1) PUT-ENABLE FIRST (atomic disabled->active; never an unprotected window).
cat > /tmp/ruleset-18229122.json <<'JSON'
{
  "name": "Default branch",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [],
  "conditions": { "ref_name": { "exclude": [], "include": ["~DEFAULT_BRANCH"] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "required_reviewers": [],
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true,
        "allowed_merge_methods": ["merge"]
    } },
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": false,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          { "context": "Analyze (actions)", "integration_id": 15368 },
          { "context": "Analyze (javascript-typescript)", "integration_id": 15368 },
          { "context": "ci", "integration_id": 15368 }
        ]
    } }
  ]
}
JSON
gh api --method PUT repos/LayZeeDK/angular-typechecker/rulesets/18229122 --input /tmp/ruleset-18229122.json

# (2) VERIFY the enable landed BEFORE deleting v0.0.1.
gh api repos/LayZeeDK/angular-typechecker/rulesets/18229122 \
  --jq '{enforcement, strict: (.rules[]|select(.type=="required_status_checks").parameters.strict_required_status_checks_policy), checks: [(.rules[]|select(.type=="required_status_checks").parameters.required_status_checks[].context)], bypass: .bypass_actors, merge: (.rules[]|select(.type=="pull_request").parameters.allowed_merge_methods)}'
# Expect: enforcement "active", strict false, checks [Analyze (actions), Analyze (javascript-typescript), ci], bypass [], merge ["merge"]

# (3) DELETE the now-redundant v0.0.1 ruleset (only carried deletion + non_fast_forward,
#     both re-asserted by 18229122).
gh api --method DELETE repos/LayZeeDK/angular-typechecker/rulesets/18229088

# (4) VERIFY final state.
gh api repos/LayZeeDK/angular-typechecker/rulesets --jq '.[] | {id, name, enforcement, target}'
# Expect: 18229122 Default branch active branch ; 18229053 Release tag active tag ; (18229088 GONE)

# LOCKOUT RECOVERY (D-12): if `ci` ever goes red/non-reporting and blocks merge, admins can
# EDIT (not bypass) the ruleset: flip enforcement to disabled, push the fix, re-enable.
gh api --method PUT repos/LayZeeDK/angular-typechecker/rulesets/18229122 --input <(jq '.enforcement="disabled"' /tmp/ruleset-18229122.json)
```

### Runbook 3: ci.yml path-aware skip deltas (D-08)
```yaml
# Source: synthesized from GitHub Docs "Troubleshooting required status checks" +
# the deadlock analysis. ASCII only. SHA-pinned. Survives act-compat (negative if:).

# (A) ADD a leading filter job (top of jobs:). Needs `pull-requests: read` is NOT
#     required for paths-filter on pull_request (it diffs base..head from the checkout);
#     keep the top-level `permissions: contents: read`.
  changes:
    runs-on: ubuntu-latest
    outputs:
      code: ${{ steps.filter.outputs.code }}
    steps:
      - uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5.0.1
        with:
          persist-credentials: false
      - uses: dorny/paths-filter@9d7afb8d214ad99e78fbd4247752c4caed2b6e4c # v4.0.0
        id: filter
        with:
          # `code` is true when the diff touches anything OUTSIDE the planning/docs set.
          # The negated globs are evaluated with the default predicate quantifier (some).
          filters: |
            code:
              - '!.planning/**'
              - '!**/*.md'
              - '!docs/**'

# (B) GATE the heavy jobs. Use the NEGATIVE form so act (empty output) keeps them in the plan
#     (Pitfall 3). On real GitHub the output is 'true'/'false'.
  test:
    needs: changes
    if: ${{ needs.changes.outputs.code != 'false' }}
    runs-on: ${{ matrix.os }}
    # ... unchanged ...

  e2e:
    needs: changes
    if: ${{ needs.changes.outputs.code != 'false' }}
    runs-on: ubuntu-latest
    # ... unchanged ...

  # act-compat + lint-workflows: leave UNGATED (cheap; always run; keep validating the YAML).

# (C) REWORK the aggregate gate: add `changes` to needs; DROP 'skipped' from the fail set
#     (a path-skipped test/e2e is now acceptable); stay fail-closed on failure/cancelled.
  ci:
    needs: [changes, test, e2e, act-compat, lint-workflows]
    runs-on: ubuntu-latest
    if: always()
    steps:
      - name: Gate
        run: |
          if [ "${{ contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled') }}" = "true" ]; then
            echo "A required job failed or was cancelled"
            exit 1
          fi
          echo "All required jobs succeeded or were intentionally path-skipped"
```

Notes on Runbook 3:
- The `ci` job id AND name stay exactly `ci` (the required-check contract). [VERIFIED: ci.yml:130 + ruleset context "ci"]
- `act-compat.sh` asserts `ci/test-`, `ci/e2e`, `ci/act-compat`, `ci/lint-workflows`, `ci/ci` are SELECTED on `pull_request`. With the negative `if:` they all stay in the act plan (Pitfall 3). The new `changes` job will ALSO appear (`ci/changes`) -- this is additive and does not break any existing `assert_selected`/`assert_absent`.
- actionlint 1.7.7 type-checks `needs.changes.outputs.code` and the `needs.*.result` graph; the `outputs:`/`steps.filter.outputs.code` wiring is the standard shape it validates cleanly.

### Runbook 4: Manual tag-after-merge + GitHub Release (REL-01 D-03/D-05 + REL-03 D-14)
```bash
# Source: VERIFIED -- tag name matches release.yml on: push: tags filter; --verify-tag aborts
# if the tag is not yet on the remote [CITED: cli.github.com/manual/gh_release_create].
# Pre-req: the release PR merged to main as a MERGE COMMIT.

git switch main && git pull --ff-only
MERGE_SHA=$(git rev-parse HEAD)

# Create the tag on the merge commit. EXACT name, no `v` (D-05).
git tag angular-typechecker@0.0.3 "$MERGE_SHA"

# PRE-PUSH verification: the tagged tree MUST carry the bump (D-05).
git show angular-typechecker@0.0.3:packages/angular-typechecker/package.json | rg '"version"'
# Expect: "version": "0.0.3"

# Push the tag (allowed: the maintainer is a bypass_actor on the Release-tag ruleset 18229053).
git push origin angular-typechecker@0.0.3
# -> fires the FROZEN release.yml -> approve the `npm-publish` environment -> OIDC publish.

# Create the GitHub Release from the CURATED CHANGELOG section (NEVER --generate-notes, D-14).
# Extract the 0.0.3 section from CHANGELOG.md into a temp file first, then:
gh release create angular-typechecker@0.0.3 \
  --title "angular-typechecker 0.0.3" \
  --notes-file /tmp/release-notes-0.0.3.md \
  --verify-tag
```

## State of the Art

| Old Approach (current repo) | Current Approach (Phase 7) | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cut locally on `main`, push the tag to `main` directly | Cut on `release/*`, PR, merge, then tag the merge commit | Phase 7 | No direct `main` push; PR + `ci` gate every change |
| `git.tag: true` (cut creates the tag) | `git.tag: false` (cut never tags; maintainer tags post-merge) | Phase 7, D-01 | Decouples version commit from the publish trigger |
| v0.0.1 ruleset (deletion + non_fast_forward only) + disabled Default-branch ruleset | Default-branch ruleset active (PR + ci + CodeQL); v0.0.1 deleted | Phase 7, REL-02 | Full PR-mode protection, single source of branch rules |
| Hand-curated changelog ad hoc per cut | Systematized curate-in-the-Release-PR + always-on scope hygiene | Phase 7, D-13/D-15 | Repeatable clean changelog independent of merge method |

**Deprecated/outdated:**
- The CLAUDE.md "nx release configuration norms" note states the standard post-1.0 `feat->minor, fix->patch` mapping; AGENTS.md already corrects this with the 0.x-adjusted column. Phase 7's AGENTS.md rewrite must keep that correction.
- The `angular-typechecker-release-mechanics` memory point 6 already anticipates Phase 7 ("the Release-PR flow generalizes this"); update it post-phase, do not contradict it now.

## Runtime State Inventory

> Phase 7 is a config/process/docs phase, not a code rename. The "runtime state" that matters here is GitHub-side live config (rulesets) and the one nx.json field -- both addressed in the runbooks. Included for completeness.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None -- no datastore keyed on a renamed string. Verified: no DB/collection touched by this phase. | none |
| Live service config | GitHub rulesets 18229122 (disabled->active + strict->false), 18229088 (delete), 18229053 (retain) -- LIVE GitHub config, NOT in git. Verified via `gh api` this session. | gh-api PUT + DELETE (Runbook 2, one-time live op) |
| OS-registered state | None -- no Task Scheduler/launchd/systemd/pm2 state. | none |
| Secrets/env vars | None new. No PAT/App secret introduced (D-03 manual tag avoids it). The npm OIDC Trusted Publisher is unchanged (release.yml frozen). | none |
| Build artifacts | None -- `dist/` is gitignored and rebuilt; the `preVersionCommand` build on the release branch is throwaway. | none |

## Validation Architecture

> nyquist_validation is not set to false in config (the `.planning/config.json` was not present to override; treat as enabled). This section maps each REL deliverable to its verification tier so the Nyquist VALIDATION.md can be created.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x via `@nx/vitest:test` |
| Config file | `e2e/angular-typechecker-install-e2e/vitest.config.mts` (serialized, forks/singleFork) |
| Quick run command | `npx nx run angular-typechecker-install-e2e:test` (the release-hygiene spec is fast filesystem/text) |
| Full suite command | `npx nx run-many -t test -p angular-typechecker angular-typechecker-install-e2e` |
| Workflow lint | `./actionlint -color` (1.7.7) + `bash tools/act/act-compat.sh` (act v0.2.89) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REL-01 | `nx.json` has `git.tag:false` (+ push:false, createRelease:false) | unit (regression spec) | `npx nx run angular-typechecker-install-e2e:test` | partial -- ADD `git.tag===false` assertion (Wave 0) to `release-hygiene.int.spec.ts` |
| REL-01 | release-branch dry-run produces the expected version+changelog and creates NO tag | one-time operational verification | `npx nx release --dry-run` (read "Tagging ... Skipped") | n/a (manual op; cannot assert in CI without a release context) |
| REL-01 | release.yml stays OIDC-only/frozen (no regression) | integration (existing) | `npx nx run angular-typechecker-install-e2e:test` (release-hygiene PKG-04 block) | yes -- existing |
| REL-02 | ruleset 18229122 active + strict:false + 3 checks + empty bypass + merge:["merge"] | one-time operational verification | `gh api .../rulesets/18229122 --jq ...` (Runbook 2 step 2) | n/a (live GitHub config; not a repeatable test) |
| REL-02 | v0.0.1 ruleset deleted | one-time operational verification | `gh api .../rulesets/18229088` returns 404 | n/a |
| REL-02 | Release-tag ruleset retained | one-time operational verification | `gh api .../rulesets/18229053` returns active | n/a |
| REL-02 | ci.yml planning-only diff skips heavy jobs yet `ci` reports success; code diff runs + can fail | integration (live PR) | a draft PR with a `.planning/`-only diff (ci green, test/e2e skipped) + a code-touching diff (matrix runs) | n/a (live-PR validation, like Phase 6 SC3) |
| REL-02 | modified ci.yml stays parseable + spec-valid | unit (static) | `./actionlint -color` + `bash tools/act/act-compat.sh` | yes -- existing CI jobs |
| REL-03 | curated CHANGELOG.md entry has no plan-id scope | unit (lint/grep) | `rg -n '\b\d{2}(-\d{2})*:' CHANGELOG.md` returns nothing in the new section | n/a (per-release content; can add a spec asserting no `**\d\d:**` heading in CHANGELOG.md) |
| REL-03 | GitHub Release notes match the curated section | one-time operational verification | `gh release view angular-typechecker@x.y.z` | n/a |

### Sampling Rate
- **Per task commit:** `npx nx run angular-typechecker-install-e2e:test` (covers the regression spec incl. the new `git.tag:false` assertion) + `./actionlint -color` for ci.yml edits.
- **Per wave merge:** full suite + `bash tools/act/act-compat.sh`.
- **Phase gate:** the one-time live ops (ruleset switch, a draft-PR skip-gate proof) are HUMAN-GATED operational verifications, recorded in VERIFICATION.md the way Phase 6 SC3 was -- not automated CI assertions.

### Classification (unit vs integration vs one-time-operational)
- **Unit-testable (repeatable, in CI):** the `nx.json` `git.tag/push/createRelease` invariants (release-hygiene spec); release.yml frozen invariants (existing); ci.yml static validity (actionlint + act-compat); a CHANGELOG-no-plan-id-scope spec if added.
- **Integration (live PR, semi-repeatable):** the skip-gate behavior -- proven on a draft PR (planning-only vs code diff), mirroring Phase 6's draft-PR matrix proof.
- **One-time operational verification (NOT a repeatable test):** the ruleset PUT/DELETE state. Rulesets are LIVE GitHub config changed once; the verification is the post-switch `gh api` reads in Runbook 2, captured in VERIFICATION.md. The planner should set realistic Nyquist coverage: do NOT demand a CI test that re-asserts live ruleset state on every run (it would require a token and re-query GitHub each CI run).

### Wave 0 Gaps
- [ ] `e2e/angular-typechecker-install-e2e/src/release-hygiene.int.spec.ts` -- ADD an `it('keeps git.tag decoupled from the cut (REL-01)')` asserting `nx.release.git.tag === false` (the spec already asserts push/createRelease false; tag is the new field).
- [ ] (Optional) a CHANGELOG-hygiene assertion: a spec or `rg` check that the latest CHANGELOG.md section contains no `^##? .*\b\d{2}(-\d{2})*\b` plan-id token. Low cost; satisfies REL-03 automatability.
- [ ] No framework install needed -- Vitest, actionlint, act are all already provisioned.

*(The ruleset switch and the draft-PR skip-gate proof are intentionally NOT Wave-0 test files -- they are operational verifications.)*

## Security Domain

> security_enforcement is enabled (absent = enabled). Each PLAN.md needs a `<threat_model>` block. The threats below are phase-specific.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture / Supply Chain | yes | SHA-pinned actions; release.yml frozen; no new long-lived secret; least-privilege CI |
| V4 Access Control | yes | Branch ruleset PR-mode (empty bypass); Release-tag ruleset gates tag pushes; npm-publish environment required-reviewer gate |
| V6 Cryptography | no (delegated) | OIDC + SLSA provenance handled by the unchanged release.yml |
| V14 Configuration | yes | The ruleset switch + ci.yml edit must not open an unprotected window or a publish bypass |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Ruleset switch leaves an unprotected window (delete-before-enable) | Tampering / Elevation | PUT-enable FIRST (atomic disabled->active), THEN delete v0.0.1 (D-09 safe order); deletion + non_fast_forward are continuously asserted by 18229122 during the swap |
| The path-skip widens `ci` so a real failure slips through | Tampering | Keep `failure` AND `cancelled` in the fail set; only `skipped` is newly accepted; the post-merge `main` `ci` run is the backstop; act-compat + actionlint stay green |
| Re-introducing a publish trigger bypass via the manual-tag flow | Elevation | Tag push is governed by the SEPARATE Release-tag ruleset (retained); the branch-ruleset empty bypass does NOT touch tag pushes; release.yml `if: startsWith(github.ref,'refs/tags/angular-typechecker@')` job gate is unchanged |
| Curated release notes leak internal scopes / a private email | Information Disclosure | `--notes-file` (curated), never `--generate-notes`; release-hygiene spec asserts the public email; scope-hygiene (D-15) |
| A new long-lived `contents`-scoped secret for auto-tagging | Elevation / Spoofing | DECLINED (D-03) -- manual tag keeps zero new secrets and the human gate on the irreversible action |
| Lockout (empty bypass + non-reporting `ci`) blocks all merges | Denial of Service (self) | D-12 recovery: admins EDIT the ruleset (enforcement: disabled), push the fix, re-enable -- no standing bypass actor needed |
| A mutable-tag action ref (e.g. `@v4`) repointed to malicious code | Tampering (supply chain) | `dorny/paths-filter` pinned to the 40-char SHA; release-hygiene spec's `/^[0-9a-f]{40}$/` assertion fails the suite on any mutable ref; Dependabot bumps the SHA |

## AGENTS.md Rewrite Scope (D-17)

The `AGENTS.md` change is code-review-gated by the phase `code_review_gate` (the file's own rule). The rewrite must be factually correct -- it has been wrong twice before. Section-by-section:

| AGENTS.md section | Action | Why / what stays correct |
|-------------------|--------|--------------------------|
| "Conventional Commits drive the changelog and the released version" | KEEP largely as-is | The 0.x bump-shift table is VERIFIED correct against nx 23.0.1 (`semver.js` + `config.js:245` default true). Do not regress this. |
| "How each type influences the version bump" (0.x table) | KEEP | feat/fix both patch in 0.x; breaking -> minor. Verified. |
| "Always confirm with a dry run" | UPDATE the command note | Add: use the UNIFIED `npx nx release --dry-run` (the `nx release version` subcommand REJECTS the top-level `release.git` block -- newly verified). |
| "Only commits that touch the published project count" | KEEP | `release.projects:["angular-typechecker"]` scoping is unchanged + verified. |
| Gotcha 1 (pin the version explicitly when no releasable commit) | KEEP | A literal version bypasses the 0.x shift + conventional derivation -- verified in `semver.js` (only relative keywords adjusted). |
| Gotcha 2 (curate the changelog scope) | KEEP + STRENGTHEN | The live dry-run this session PROVED the raw nx changelog leaks `**06-02:**` plan-id scopes -- cite this as the concrete evidence. |
| Gotcha 3 ("local cut does NOT push; you push the tag ... from main") | **REWRITE** | This is the core change: replace "cut locally on main -> curate -> push tag to main" with "cut on a `release/*` branch -> PR (carries code + .planning/) -> merge (merge commit) -> tag the MERGE COMMIT -> push tag -> publish". The tag now targets the merge commit, not a local main commit. |
| Gotcha 3 LANDMINE (`createRelease: "github"`) | KEEP verbatim | VERIFIED against nx 23.0.1 `config.js:139-159` -- both failure modes (hard-error with push:false; silent push without it) are accurate. |
| "Quick checklist before cutting a release" | **REWRITE steps 1-5** | Reorder to the branch-cut -> PR -> merge -> tag-merge-commit -> gh release sequence; add the `git.tag:false` reality (the cut no longer creates a tag at all). |
| (NEW) a short note on the Default-branch ruleset | ADD | Document that `main` is now PR-only (empty bypass) and the recovery toggle (D-12), so a future agent does not try to direct-push. |

Internal-consistency checks for the rewrite:
- The new flow must say the tag is created on the MERGE COMMIT (D-05), not on a `release/*` branch commit (the branch commit's tree does carry the bump, but tagging the merge commit is the locked decision and keeps the tag on `main`).
- It must NOT claim the cut pushes anything (with `git.tag:false` + `push:false` + `createRelease:false`, the cut is commit-only).
- It must reconcile with the `angular-typechecker-release-mechanics` memory (point 6 already anticipates this) and the CLAUDE.md norms note (which states post-1.0 mapping -- AGENTS.md's 0.x column is the operative one; keep that distinction explicit).

## Open Questions

1. **Release branch naming convention (`release/x.y.z` vs `release/next`)**
   - What we know: Claude's discretion (CONTEXT.md). `release/x.y.z` is self-documenting and one-branch-per-release; `release/next` is reusable.
   - What's unclear: maintainer preference for branch churn vs. a standing branch.
   - Recommendation: `release/x.y.z` (matches the tag, auto-deleted on merge since `delete_branch_on_merge:true`).

2. **Whether to add an automated CHANGELOG-hygiene spec (REL-03)**
   - What we know: D-13 is human curation; a regex check can backstop it cheaply.
   - What's unclear: whether the planner wants an extra spec vs. relying on the curation discipline.
   - Recommendation: add a tiny assertion (no `**\d\d:**` heading / no `\b\d{2}(-\d{2})*:` token in the latest section) -- it makes REL-03 automatable and is near-zero cost.

3. **dorny/paths-filter v4.0.0 (node24) vs v3.0.3 (node20)**
   - What we know: both SHAs verified; the repo targets Node 24/26.
   - What's unclear: nothing material; v4 is the current line.
   - Recommendation: pin v4.0.0 (`9d7afb8d214ad99e78fbd4247752c4caed2b6e4c`); Dependabot maintains it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| nx (release) | REL-01 cut + dry-run | yes | 23.0.1 | -- |
| gh CLI | REL-02 ruleset ops; REL-03 release | yes | live `gh api` succeeded | -- |
| Vitest | regression spec | yes | 4.x | -- |
| actionlint | ci.yml validation | yes (CI; pinned 1.7.7) | 1.7.7 | local: act --validate substitutes (per Phase-6 note) |
| act | act-compat | yes (CI; pinned v0.2.89) | v0.2.89 | local Windows arm64 via .actrc |
| dorny/paths-filter | ci.yml skip | n/a (resolved at CI runtime by SHA) | v4.0.0 | step-level `git diff` (not recommended) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** local actionlint not on the dev box (Phase-6 note) -- defer local workflow lint to CI / the draft-PR run; `act --validate` is the local static substitute.

## Sources

### Primary (HIGH confidence)
- Installed `node_modules/nx@23.0.1` source -- `release.js` (`shouldCommit`/`shouldStage`/`shouldTag` L74-76; tag gated on `git.tag` L172-186; push gated on `createRelease` L189-200), `config.js` (`GIT_PUSH_FALSE_WITH_CREATE_RELEASE` L139-159; `adjustSemverBumpsForZeroMajorVersion` default true L245), `semver.js` (0.x shift L69-86, only relative keywords). [VERIFIED]
- Live `gh api` this session -- rulesets 18229122 (disabled, empty bypass, 3 checks, strict:true), 18229088 (deletion+non_fast_forward only), 18229053 (tag ruleset, owner+DeployKey bypass); repo merge settings (merge_commit on, squash off); main check-runs (ci + 2 Analyze green); CodeQL default setup configured (threat_model remote); maintainer id 6364586. [VERIFIED]
- Live `npx nx release --dry-run` this session -- bump derived as patch -> 0.0.3; "Tagging commit with git" present under current `git.tag:true`; raw changelog LEAKS `**06:**`/`**06-02:**` plan-id scopes; "Skipped publishing". [VERIFIED]
- GitHub API tag refs -- `dorny/paths-filter` v3.0.3 = `d1c1ffe0248fe513906c8e24db8ea791d46f8590`, v4.0.0 = `9d7afb8d214ad99e78fbd4247752c4caed2b6e4c`. [VERIFIED]

### Secondary (MEDIUM confidence)
- GitHub Docs "Troubleshooting required status checks" + community discussions #54877 (paths-ignore on required check), #142210 (skipped-but-required workaround), actions/runner #2566 (aggregate-gate skip semantics). [CITED]
- GitHub Docs "Automatically generated release notes" -- PR-based, `.github/release.yml` categorizes/excludes by label/author, cannot strip PR-title text. [CITED]
- GitHub REST "Repository rulesets" -- PUT full replacement; `required_status_checks` entry shape; enforcement enum. [CITED: docs.github.com/en/rest/repos/rules]
- `cli.github.com/manual/gh_release_create` -- `--notes-file`, `--verify-tag` aborts if tag absent remotely, `--notes-start-tag`. [CITED]

### Tertiary (LOW confidence)
- None. Every claim used in a runbook was verified against the installed nx, the live GitHub API, or official docs.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `changes` filter `code` glob (`!.planning/**`, `!**/*.md`, `!docs/**`) correctly classifies the repo's planning-only PRs | Runbook 3 / D-08 | A misclassified glob either over-runs the matrix (wasteful, safe) or under-runs it on a code PR (the ci gate still runs and the post-merge main run backstops); LOW risk, planner should confirm the exact globs match the repo's planning-doc layout |
| A2 | `dorny/paths-filter` on `pull_request` needs no extra `permissions` beyond top-level `contents:read` | Runbook 3 | If a permission is needed the `changes` job fails -> `ci` fails (fail-closed) -> caught immediately on the first PR; LOW risk |
| A3 | Under `act -n`, the negative `if: needs.changes.outputs.code != 'false'` keeps the gated jobs in the plan (empty output != 'false' is true) | Pitfall 3 / Runbook 3 | If act evaluates differently, act-compat goes red and is caught in CI before merge; MEDIUM risk -- the planner should have the first ci.yml task run act-compat locally/in-PR to confirm |
| A4 | The next release will be 0.0.3 (patch) unless a `feat`/breaking commit lands first | Runbooks 1/4 | Only affects example version strings; the dry-run is the source of truth; LOW risk |

**Note:** A3 is the one assumption worth an early empirical check (it gates whether the recommended mechanism survives act-compat). The first ci.yml plan task should run `bash tools/act/act-compat.sh` (or the draft-PR equivalent) to confirm before the rest of the phase builds on it.

## Metadata

**Confidence breakdown:**
- Release-PR mechanics (REL-01): HIGH -- nx 23.0.1 source + live dry-run directly confirm tag/push/commit gating and the version-subcommand constraint.
- Ruleset switch (REL-02 protection): HIGH -- live `gh api` reads confirm all three rulesets are in the exact expected pre-state; PUT/DELETE semantics cited from official docs.
- ci.yml skip-gate (REL-02 DX): MEDIUM-HIGH -- the deadlock failure mode and aggregate-gate pattern are well-documented and the act-compat interaction is reasoned (A3 flagged for an early empirical check).
- Clean changelog (REL-03): HIGH -- the live dry-run proves the leak; D-14's `--generate-notes` rejection is confirmed by official docs.
- AGENTS.md rewrite scope: HIGH -- the factual claims (0.x shift, createRelease landmine, version-subcommand) are all source-verified.

**Research date:** 2026-06-29
**Valid until:** ~2026-07-29 for the nx/GitHub-API claims (stable). Re-verify the `dorny/paths-filter` SHA and the live ruleset IDs at plan time if more than a week passes (Dependabot may bump the action; rulesets are unlikely to change but are live).

## RESEARCH COMPLETE
