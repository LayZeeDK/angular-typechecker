# Phase 7: Release-PR workflow and clean changelog - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning
**Mode:** --auto --chain --analyze (research-first; --research passed to plan-phase)

<domain>
## Phase Boundary

Replace the direct-push-to-`main` release flow with a **Release-PR flow**, flip `main`'s
branch protection to **PR mode**, and **systematize a clean public changelog** free of
internal GSD phase/plan scopes. Three deliverables, mapped to the ROADMAP Phase-7 success
criteria (candidate requirement IDs **REL-01 / REL-02 / REL-03**):

1. **REL-01 -- Release-PR flow.** `nx release` produces the version bump + CHANGELOG on a
   `release/*` branch that merges via PR; the tag is created on the merged commit and fires
   the EXISTING tag-triggered OIDC publish (`release.yml` UNCHANGED). `nx.json release.git`
   decouples commit from tag (`tag:false`, keep `push:false`).
2. **REL-02 -- Branch-protection switch.** ENABLE the staged **"Default branch"** ruleset
   (require PR + the Phase-6 `ci` status check + force-push/deletion blocked), DELETE the
   temporary **"v0.0.1"** ruleset, RETAIN the **"Release tag"** ruleset (governs tag pushes).
3. **REL-03 -- Clean changelog.** CHANGELOG.md + GitHub Release notes must NOT expose internal
   GSD phase/plan numbers (e.g. `feat(05-01):`).

This phase clarifies HOW to implement what is already scoped. LOCKED and NOT re-decided here:
the engine/executor/cacheable-target/filtering (Phases 1-4); the dependency/manifest/tarball
model + e2e smoke (Phase 5); the tokenless OIDC publish pipeline (Phase 5/5.1); the cross-OS
CI matrix + the `ci` aggregate gate (Phase 6). OUT of scope (-> deferred / later): `createNodesV2`
inference, `nx add`/`ng add`, CLI bin, Angular builder, JSON/SARIF reporters; OpenSSF Scorecard /
harden-runner / CodeQL workflow tuning / signed commits/tags (continuous-assurance, deferred from
Phase 5 D-16); the Nx community-registry-listing PR (post-publish human follow-up).

**Process note:** every decision below is grounded in (1) prior context (05/05.1/06 CONTEXT,
AGENTS.md, the release-mechanics memory), (2) a live codebase + `gh api` scout (nx.json release
block, release.yml/ci.yml, CHANGELOG.md, the three live rulesets, the CodeQL default-setup state,
check-runs on `main`), (3) a **2-researcher parallel pre-pass** (nx Release-PR mechanics; clean
changelog + ruleset API -- both source-verified against nx 23.0.1 + live GitHub API), and (4) a
**5-member Opus panel** (lenses: release-engineering / nx+gh internals; supply-chain security;
solo-maintainer DX; ruleset correctness; changelog consumer UX). Panel/research findings are
folded in inline and tagged `[research]` / `[panel]`. Deep implementation research still runs in
plan-phase (`--research`).
</domain>

<decisions>
## Implementation Decisions

### Release-PR flow (REL-01)

- **D-01 `[research, source-verified nx 23.0.1]`: The SOLE `nx.json` release-config change is
  `release.git.tag: true -> false`.** Keep `commit:true` (the bump+CHANGELOG must be committed
  on the release branch), `push:false` (the PR provides the push to `main`; the tag is pushed
  separately), and `createRelease:false`. Verified in nx 23.0.1 source: `nx release version`
  commits but tags only if `git.tag`, pushes only if `git.push`; the unified `nx release` gates
  tagging on `git.tag` and push on `createRelease` (NOT `git.push`) -- so `tag:false` +
  `createRelease:false` makes it commit, not tag, not push.

- **D-02 `[research]`: Cut on a `release/*` branch via `nx release --skip-publish` (commit
  version+CHANGELOG, no tag, no push) -> open PR -> merge.** Nx 23 has NO native "release PR"
  mode (no changesets/release-please equivalent) -- this is the canonical assembled pattern.
  `conventionalCommits` derivation works on a release branch (the last `angular-typechecker@*`
  tag is a `--merged` ancestor); `preVersionCommand: npx nx run-many -t build` is harmless on the
  branch (output is gitignored `dist/`, rebuilt again in CI before publish).

- **D-03 `[research, decisive]`: Tag-after-merge is MANUAL.** After the PR merges, the maintainer
  creates + pushes the tag on the **merge commit** (`main` HEAD): `git tag angular-typechecker@x.y.z <merged-sha> && git push origin angular-typechecker@x.y.z`,
  which fires the FROZEN `release.yml`. **Automated tagging is DECLINED:** the default
  `GITHUB_TOKEN` cannot trigger another workflow (so a CI-pushed tag would NOT fire `release.yml`),
  and a PAT/GitHub App reintroduces a long-lived `contents`-scoped secret that contradicts the
  repo's tokenless-OIDC, least-privilege threat model. Manual keeps `release.yml` byte-unchanged,
  adds zero secrets, and keeps a human on the one irreversible action.

- **D-04 `[maintainer decision]`: Merge method = MERGE COMMITS** (`allowed_merge_methods` stays
  `["merge"]`). The maintainer wants individual commits preserved in `main` history. Tag the merge
  commit. (Squash was the research runner-up for changelog cleanliness, but D-13/D-15 deliver a
  clean changelog independent of merge method, so merge commits cost nothing here.)

- **D-05 `[research]`: Tag-name + tag-target invariants (pitfalls to enforce).** The tag MUST be
  exactly `angular-typechecker@x.y.z` (no `v` prefix) or it won't match `release.yml`'s
  `on: push: tags: ['angular-typechecker@*']` nor the publish-job `if: startsWith(github.ref,
  'refs/tags/angular-typechecker@')`. The tagged commit's tree MUST contain the bumped
  `package.json`/`CHANGELOG.md` (the merge commit does) -- verify with
  `git show <tag>:packages/angular-typechecker/package.json` before pushing. Do NOT set
  `changelog.workspaceChangelog.createRelease: "github"` (nx 23 `GIT_PUSH_FALSE_WITH_CREATE_RELEASE`
  hard-error with `push:false`; or, if `push:false` were dropped, it would push the version commit
  during the local step and bypass the PR).

### Branch-protection switch (REL-02)

- **D-06 `[maintainer decision; panel-split resolved by user]`: Default-branch ruleset
  `bypass_actors: []` (EMPTY -- full PR mode, owner included).** Even the owner cannot direct-push
  to `main`; every change goes through a PR satisfying `ci`. Security-max posture, consistent with
  the hardened repo. Release integrity is unaffected -- tag pushes are governed by the SEPARATE
  "Release tag" ruleset + the manual tag + the `npm-publish` approval gate, none of which the
  branch-ruleset bypass touches `[panel: ruleset-correctness confirmed]`.

- **D-07 `[maintainer decision]`: `.planning/` reaches `main` by being CARRIED IN the feature PR
  -- NOT stripped.** `/gsd-pr-branch` (which strips `.planning/`) is the WRONG tool here -- it is
  built for repos that do NOT want planning artifacts on `main`; this repo wants the opposite.
  Include `.planning/` in the feature-branch PR so merging lands it on `main` AND it lives on the
  branch -- satisfying "`.planning/` in feature branches AND main" with no direct push.

- **D-08 `[derived from D-06/D-07; panel: DX + ruleset-correctness]`: `ci.yml` gains a PATH-AWARE
  skip so planning-only PRs neither burn the full cross-OS matrix NOR deadlock the required `ci`
  check.** CRITICAL pitfall: a workflow-level `paths-ignore` on a REQUIRED check leaves the merge
  button stuck on "Expected -- waiting for status" (the check never reports). The correct shape is
  the **skip-aware aggregate gate**: keep the workflow triggering, gate the heavy jobs
  (`test`/`e2e`) by a path filter (e.g. `dorny/paths-filter` or job-level `if:`), and keep the
  `ci` aggregate job ALWAYS running and reporting SUCCESS when the heavy jobs were path-skipped
  (today's gate fails-closed on `skipped`, so it must be reworked to distinguish "path-skipped" from
  "failed/cancelled"). ~58% of this repo's commits are `.planning/`-only, so this is load-bearing
  for DX. **Planner chooses the exact mechanism** (paths-filter job vs. job-level `if` + always-run
  aggregate). Globs to skip: `.planning/**`, `**/*.md`, `docs/**` (planner to confirm).

- **D-09 `[research, live-API-verified]`: Ruleset operations via `gh api`.** (a) **PUT** (full
  replacement -- NOT PATCH) `repos/LayZeeDK/angular-typechecker/rulesets/18229122` flipping
  `enforcement: disabled -> active`, with the COMPLETE rules array: `deletion`, `non_fast_forward`,
  `pull_request` (approvals 0, `allowed_merge_methods:["merge"]`, `required_review_thread_resolution:true`),
  `required_status_checks` (`ci` + `Analyze (actions)` + `Analyze (javascript-typescript)`, each
  `integration_id: 15368` = the github-actions app, `strict_required_status_checks_policy:false` per
  D-10), `bypass_actors:[]`. (b) **DELETE** `.../rulesets/18229088` (the "v0.0.1" ruleset -- it only
  carries `deletion`+`non_fast_forward`, both re-asserted by 18229122). (c) RETAIN 18229053
  ("Release tag"). **Safe order:** PUT-enable FIRST (atomic disabled->active, never an unprotected
  window), THEN delete v0.0.1. No deadlock: `ci` is already in the required list (maintainer added
  it), is green on `main`, and runs on PRs. **The maintainer ALREADY added `ci` to the required
  checks during this discussion** -- so the live ruleset already lists all three; the remaining ops
  are: set `strict:false`, flip `enforcement:active`, delete v0.0.1.

- **D-10 `[research; panel-split, leaned by DX]`: `strict_required_status_checks_policy: false`**
  (drop "require branches up to date before merging"). Avoids the Dependabot/self-merge rebase
  convoy on a solo repo; the post-merge `main` `ci` run is the backstop. Easily reversible if it
  ever bites. (Security/correctness lenses were fine keeping `true`; it rarely bites a solo repo --
  this is a low-stakes, reversible call.)

- **D-11: `required_approving_review_count: 0`** (unchanged) -- the solo maintainer self-merges
  once `ci` is green; no second reviewer exists.

- **D-12 `[panel: ruleset-correctness]`: Lockout recovery (the cost of empty bypass).** If `ci`
  ever goes red/non-reporting and blocks the merge button, recover by toggling the ruleset
  `enforcement: disabled` (repo admins can EDIT a ruleset even when they cannot BYPASS it), push
  the fix, re-enable. Prefer the enforcement toggle over a standing bypass actor.

### Clean changelog (REL-03)

- **D-13 `[panel: consumer-UX + DX]`: PRIMARY mechanism = hand-curate the CHANGELOG.md entry in
  the Release PR.** The PR is the natural human curation checkpoint; it produces the narrative
  (prose summary + Features/Fixes/Breaking + the mandatory Compatibility block with Nx/Angular/TS/
  Node ranges) that the proven 0.0.1/0.0.2 entries deliver and no auto-generator can. Leak-proof:
  no automated path ever authors reader-visible text. Merge commits keep the granular history for
  the record; the clean OUTPUT comes from curation, independent of merge method.

- **D-14 `[panel; matches AGENTS.md]`: GitHub Release notes = the curated CHANGELOG.md section via
  `gh release create angular-typechecker@x.y.z --notes-file <section> --verify-tag`.** Do NOT use
  `gh release create --generate-notes`: it is PR-title-based and `.github/release.yml` can
  categorize/exclude by label but CANNOT strip text inside a PR title -- a PR titled
  `feat(NN-NN): ...` would leak the scope verbatim. (If `--generate-notes` were ever used, it MUST
  pass `--notes-start-tag angular-typechecker@<prev>` because GitHub's auto previous-tag heuristic
  is unreliable for prefixed `angular-typechecker@` tags -- but we are not using it.)

- **D-15 `[always-on discipline]`: Commit + PR-title scope HYGIENE.** Use release-meaningful scopes
  (`core`/`executor`/`release`/`deps`); never let a plan-id scope (`feat(07-02):`) ride into a
  release window via a commit OR a PR title. Necessary first line of defense; composes with D-13.

- **D-16 `[research-verified; DEFERRED]`: nx custom changelog renderer is an OPTIONAL backstop, NOT
  built now.** A ~30-line subclass of `DefaultChangelogRenderer` overriding `formatChange` +
  `formatBreakingChangeBase` to strip internal-scope regex `^\d{2}(-\d{2})*$` works (verified in
  nx 23.0.1 source) and is merge-method-independent -- but it couples to nx's `protected` API
  (re-verify each nx major) and produces a jargonier per-commit list than the curated narrative.
  Defer; revisit only if auto-generated CHANGELOG entries ever become desirable.

### Documentation deliverable

- **D-17: Rewrite the `AGENTS.md` release-mechanics section for the Release-PR flow.** It currently
  documents the "cut locally -> curate -> push tag to `main`" flow; Phase 7 generalizes that to
  "cut on a `release/*` branch -> PR (carries code + `.planning/`) -> merge -> tag the merge commit
  -> publish". Per AGENTS.md's OWN rule, the change is code-review-gated (the phase
  `code_review_gate` satisfies it). Also reconcile the `angular-typechecker-release-mechanics`
  memory (point 6 already says "Phase 7's Release-PR flow generalizes this") and the CLAUDE.md
  "nx release configuration norms" note if they conflict.

### Claude's Discretion
- Exact `release/*` branch naming (`release/x.y.z` vs `release/next`).
- The exact `ci.yml` skip-aware-gate mechanism (D-08): `dorny/paths-filter` job vs. job-level `if:`
  + an always-run aggregate; the precise `paths-ignore`/filter globs.
- Whether to add a `.github/release.yml` / an `internal` label (only relevant if `--generate-notes`
  were used, which it is not -- likely skip).
- The per-release curated CHANGELOG wording and the GitHub Release title.
- Whether to batch `.planning/` checkpoints into fewer PRs to reduce PR ceremony.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 7 spec + scope (this repo)
- `.planning/ROADMAP.md` Phase 7 section -- goal + the 3 success criteria; candidate requirement
  IDs REL-01 (Release-PR flow), REL-02 (branch-protection switch), REL-03 (clean changelog). The
  planner should DEFINE these in REQUIREMENTS.md (currently "TBD").
- `.planning/REQUIREMENTS.md` -- the PKG family (release model already shipped) + **CI-01** (the
  `ci` gate Phase 7's ruleset requires). No REL-* IDs exist yet -- add them.
- `.planning/PROJECT.md` -- locked stack, release norms, 0.x semver.

### Release machinery (the surfaces this phase touches)
- `nx.json` `release` block -- the `git.tag: true -> false` target (D-01); `releaseTag.pattern:
  "angular-typechecker@{version}"`; `conventionalCommits:true`; `preVersionCommand`;
  `createRelease:false` (do NOT set `"github"` -- the GIT_PUSH_FALSE_WITH_CREATE_RELEASE landmine).
- `.github/workflows/release.yml` -- **FROZEN**, tag-triggered OIDC publish; the
  `if: startsWith(github.ref,'refs/tags/angular-typechecker@')` publish-job gate; the
  registry-url/empty-_authToken inline notes. **DO NOT modify** (the `release-hygiene` regression
  spec asserts it stays OIDC-only).
- `.github/workflows/ci.yml` -- the `ci` aggregate gate (job id AND name exactly `ci`;
  `needs:[test,e2e,act-compat,lint-workflows]`; `if:always()`; fail-closed on
  failure/cancelled/skipped). Phase 7 ADDS the path-aware skip (D-08) and must keep the gate's
  required-check NAME `ci` intact.
- `CHANGELOG.md` -- the curated 0.0.1 + 0.0.2 entries = the target style/altitude for D-13.
- `AGENTS.md` -- the release-mechanics section to REWRITE (D-17); the `createRelease` landmine;
  the curate-then-push-tag flow Phase 7 generalizes; the rule that AGENTS.md changes are
  code-review-gated.
- `packages/angular-typechecker/package.json` -- `version`, `repository.url` (OIDC exact-match
  `LayZeeDK` casing), `publishConfig` (provenance/access). The bump target.

### GitHub config (LIVE state -- via `gh api`; do not re-discover the IDs)
- Default-branch ruleset **id 18229122** (target branch, `~DEFAULT_BRANCH`) -- PUT to set
  `strict:false` + `enforcement:active` (full-replacement body; `ci` + 2 CodeQL checks already
  present; `bypass_actors:[]`; `allowed_merge_methods:["merge"]`).
- v0.0.1 ruleset **id 18229088** (target branch) -- DELETE.
- Release tag ruleset **id 18229053** (target tag) -- RETAIN; it governs `angular-typechecker@*`
  tag pushes -- which is WHY empty branch-ruleset bypass does not block the release tag.
- CodeQL default setup: `state: configured` (languages actions/javascript/typescript,
  threat_model `remote` -> runs on PRs); `Analyze (actions)` + `Analyze (javascript-typescript)`
  are github-actions-app checks (integration_id 15368), green on `main`.

### Prior context (this repo) -- MUST read
- `.planning/phases/06-full-e2e-matrix-ci/06-CONTEXT.md` -- **D-02/RD-09**: the `ci` aggregate gate
  is the EXACT required-check name Phase 7 consumes (do not rename); the draft-PR cross-OS
  validation pattern; CodeQL was deferred there but has since been enabled (default setup).
- `.planning/phases/05.1-0-0-2-first-oidc-steady-state-publish-verification/05.1-CONTEXT.md` --
  the CURRENT cut-locally-then-push-tag flow (D-01/D-02) Phase 7 replaces; D-11 AGENTS.md origin;
  the interim hand-curated changelog (D-06).
- `.planning/phases/05-packaging-publish-hardening-e2e-smoke-mvp/05-CONTEXT.md` + `05-SECURITY.md`
  -- the hardened-release threat model (the basis for keeping `release.yml` frozen + the
  empty-bypass security reasoning).
- Memory `angular-typechecker-release-mechanics` -- the recurring runbook; point 6 (the
  `createRelease` push landmine) + point 7 (keep `registry-url`; a 404 = the Trusted Publisher).
  UPDATE post-phase for the Release-PR flow (D-17).

### External docs (re-validate at plan time -- `--research`)
- nx.dev "@nx/release" + nx 23 release source (`node_modules/nx/dist/.../release/`): `git.tag`
  gates tagging; `createRelease` gates push in the unified command; `release.changelog.*.renderer`
  is a string path resolving a custom `DefaultChangelogRenderer` subclass; scope is emitted only in
  `formatChange`/`formatBreakingChangeBase`.
- GitHub REST "Repository rulesets" -- **PUT** `/repos/{o}/{r}/rulesets/{id}` (full replacement),
  **DELETE** same path; `required_status_checks` entries `{context, integration_id?}`; `enforcement`
  enum `disabled|active|evaluate`; rulesets grant NO implicit admin/owner bypass.
- GitHub docs "Automatically generated release notes" + `.github/release.yml` -- PR-title-based,
  cannot strip title text (why NOT `--generate-notes`, D-14).
- `gh release create` -- `--notes-file`, `--verify-tag` (and `--notes-start-tag` caveat for prefixed
  tags, not used).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The current local-cut release command (`nx release --skip-publish`) -- reuse the cut, relocate it
  to a `release/*` branch (only behavior change: `git.tag:false` so no tag is created at cut time).
- `CHANGELOG.md` 0.0.1/0.0.2 curated entries -- the template for every future curated entry (D-13).
- `release-hygiene` integration spec (`e2e/angular-typechecker-install-e2e/`) -- the regression gate
  asserting `release.yml` stays OIDC-only/auth-token-unset; KEEP green (release.yml is unchanged).
- `ci.yml` `ci` aggregate gate -- extend with the path-aware skip (D-08); preserve the `ci` name.
- `gh api` against the three live rulesets -- the switch is gh-api-driven (D-09).

### Established Patterns
- Supply-chain-hardened release: tokenless OIDC, SHA-pinned actions, top-level `contents:read`,
  publish job `id-token:write` only, manual-approval `npm-publish` environment. Phase 7 must NOT
  regress this (release.yml frozen; the GitHub Release stays a LOCAL `gh release create`, never a
  `contents:write` workflow step).
- Hand-curated public changelog (no plan-id scopes) -- now systematized as curate-in-the-Release-PR.
- `gh api` full-replacement PUT for GitHub repository config (rulesets).

### Integration Points
- `release/*` branch -> `nx release --skip-publish` (commit version+CHANGELOG, no tag, no push) ->
  PR (carries code + `.planning/`) -> `ci` green -> self-merge (merge commit) -> maintainer tags the
  merge commit `angular-typechecker@x.y.z` + pushes -> `release.yml` (OIDC publish behind
  `npm-publish` approval) -> `gh release create --notes-file <curated CHANGELOG section>`.
- Default-branch ruleset (PR + `ci` + 2 CodeQL, empty bypass, merge-commit, `strict:false`) gates
  `main`; the separate Release-tag ruleset gates `angular-typechecker@*` tags.
- `ci.yml`: planning-only PRs path-skip the heavy `test`/`e2e` jobs while the `ci` aggregate still
  reports success (no merge-button deadlock).
</code_context>

<specifics>
## Specific Ideas

- `nx.json` change is exactly one field: `release.git.tag: false` (keep `commit:true`, `push:false`,
  `createRelease:false`).
- Tag is exactly `angular-typechecker@x.y.z` (no `v`), created on the merge commit; verify
  `git show <tag>:packages/angular-typechecker/package.json` carries the bump before pushing.
- `gh api --method PUT repos/LayZeeDK/angular-typechecker/rulesets/18229122 --input <body.json>`
  with the full ruleset object (enforcement `active`, `strict:false`, checks `ci` +
  `Analyze (actions)` + `Analyze (javascript-typescript)`, bypass `[]`, merge `["merge"]`); then
  `gh api --method DELETE repos/LayZeeDK/angular-typechecker/rulesets/18229088`.
- GitHub Release: `gh release create angular-typechecker@x.y.z --notes-file <curated-section> --verify-tag`.
- `ci.yml` path-aware skip globs (planner to confirm): `.planning/**`, `**/*.md`, `docs/**`.
</specifics>

<deferred>
## Deferred Ideas

- **nx custom changelog renderer** (auto-strip `^\d{2}(-\d{2})*$` scopes) -- optional backstop,
  deferred (D-16); curate-in-PR + hygiene satisfies SC3 for a solo human-gated flow.
- **`gh release create --generate-notes` + `.github/release.yml`** -- REJECTED (PR-title scope leak;
  can't strip title text).
- **Squash merge** -- REJECTED (maintainer wants merge commits; D-04).
- **Automated tag-after-merge (PAT/GitHub App workflow)** -- REJECTED (contradicts the tokenless-OIDC
  least-privilege posture; D-03).
- **Maintainer-on-bypass for direct `.planning/` pushes** -- REJECTED (D-06: empty bypass chosen;
  `.planning/` rides in the PR instead, D-07).
- **OpenSSF Scorecard / StepSecurity harden-runner / signed commits+tags** -- later (continuous
  assurance; deferred from Phase 5 D-16).
- **Nx community-registry-listing PR** (`approved-community-plugins.json`) -- post-publish human
  follow-up (eligibility already met).

None of the discussion drifted outside the Phase 7 boundary.

## Open Questions

None -- all gray areas were resolved via the 2-researcher pre-pass + the 5-member Opus panel +
explicit maintainer decisions (merge commits D-04; empty bypass + `.planning/`-in-PR D-06/D-07).
The remaining unknowns are mechanism-level (the exact `ci.yml` skip-gate shape, branch naming,
curated wording) and are correctly the planner's/Claude's discretion.
</deferred>

---

*Phase: 7-Release-PR workflow and clean changelog*
*Context gathered: 2026-06-29*
