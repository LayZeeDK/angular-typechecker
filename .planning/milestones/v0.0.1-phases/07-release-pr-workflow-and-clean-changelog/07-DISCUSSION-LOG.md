# Phase 7: Release-PR workflow and clean changelog - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-29
**Phase:** 07-release-pr-workflow-and-clean-changelog
**Mode:** --auto --chain --analyze (research-first; --research passed to plan-phase)
**Areas discussed:** Merge method, Bypass posture / `.planning/`-on-main reconciliation, Required status checks, Clean-changelog mechanism (the maintainer's explicit question), plus the research-auto-locked release/ruleset/changelog mechanics

**Process:** a 2-researcher parallel pre-pass (nx 23.0.1 Release-PR mechanics; clean-changelog + ruleset API, both source-verified) followed by a **5-member Opus panel** (release-engineering, supply-chain security, solo-maintainer DX, ruleset correctness, changelog consumer UX). Two interactive AskUserQuestion rounds; the first was paused by the maintainer to add context (`.planning/`-on-main constraint, merge-commit preference, "ci added to the ruleset", "can Docker be closed").

---

## Merge method

| Option       | Description                                                                                                                              | Selected |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Squash merge | One clean conventional-commit per PR; intra-PR plan-id scopes never reach changelog derivation; needs `allowed_merge_methods:["squash"]` |          |
| Merge commit | Keeps every individual commit in `main` history; tag the merge commit; no ruleset change                                                 | ✓        |

**User's choice:** Merge commits — "I would prefer using merge commits to merge PRs so that individual commits are kept."
**Notes:** Researchers split (release-eng leaned merge-to-avoid-churn; changelog-clean leaned squash). The maintainer prioritized preserving granular history. Resolved as a non-issue for the changelog because D-13/D-15 deliver a clean changelog independent of merge method (clean OUTPUT via curation, not via history rewriting). Triggered the maintainer's follow-up: "can we adapt nx release or the gh CLI release notes/changelog?" -> answered in the Clean-changelog area.

---

## Bypass posture / `.planning/`-on-main reconciliation

| Option                                   | Description                                                                                                                                                                           | Selected |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| You on bypass + paths-ignore             | Maintainer in `bypass_actors`; keep direct-pushing `.planning/` to main; code/release/Dependabot via PR by convention; paths-ignore so docs don't spin the matrix                     |          |
| Empty bypass + carry `.planning/` in PRs | Nobody bypasses (owner included); include `.planning/` IN the feature PR so merge lands it on main; add a skip-aware `ci` gate so planning-only PRs don't burn the matrix or deadlock | ✓        |

**User's choice:** Empty bypass + carry `.planning/` in PRs (the security-max posture).
**Notes:** Surfaced by the maintainer's constraint "I need to keep `.planning/` artifacts in feature branches AND main" and the concern "there is a GSD skill for opening a PR without `.planning/` commits, but then I don't know how I would get `.planning/` commits into main after merging." Key resolution: `/gsd-pr-branch` strips `.planning/` and is the WRONG tool for this goal — carrying `.planning/` in the PR satisfies "branches AND main" with no direct push. Panel split (security/correctness lenses favored empty bypass; DX lens favored maintainer-on-bypass given ~58% of commits are `.planning/`-only). Maintainer chose the principled empty-bypass posture; the DX cost is mitigated by the D-08 path-aware `ci` skip. Ruleset-correctness lens confirmed the release-tag flow does NOT need owner-bypass (tags governed by the separate Release-tag ruleset) and lockout recovery is a one-toggle `enforcement:disabled`.

---

## Required status checks (Default-branch ruleset)

| Option                     | Description                                                                                                     | Selected |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- | -------- |
| `ci` only                  | Require just the Phase-6 aggregate gate                                                                         |          |
| `ci` + CodeQL Analyze (x2) | Also gate on `Analyze (actions)` + `Analyze (javascript-typescript)` (CodeQL default setup, green, runs on PRs) | ✓        |

**User's choice:** `ci` + CodeQL — the maintainer ADDED `ci` to the ruleset's required checks during the discussion (the staged ruleset previously listed only the two CodeQL checks and was missing `ci`).
**Notes:** Finding: the staged "Default branch" ruleset required only CodeQL and was missing the load-bearing `ci` Phase-6 contract. Maintainer corrected it live. Remaining ruleset ops: set `strict:false`, flip `enforcement:active`, delete the v0.0.1 ruleset.

---

## strict_required_status_checks_policy (require branches up to date)

| Option          | Description                                                    | Selected                    |
| --------------- | -------------------------------------------------------------- | --------------------------- |
| Keep `true`     | Force every PR to be rebased onto latest main before merge     |                             |
| Drop to `false` | Don't require up-to-date; post-merge `main` ci is the backstop | ✓ (Claude call, reversible) |

**User's choice:** Not separately selected by the user; auto-resolved to `false` per the DX lens (avoids the Dependabot/self-merge rebase convoy on a solo repo). Low-stakes, reversible. Security/correctness lenses were fine keeping `true` — flagged as easily reverted if it ever matters.

---

## Clean-changelog mechanism (maintainer's explicit question: "can we adapt nx release or gh CLI?")

| Option                                                                            | Description                                                                                                      | Selected                                             |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| nx custom changelog renderer                                                      | Subclass `DefaultChangelogRenderer`, strip internal-scope regex from every commit line; works with merge commits | Deferred (optional backstop)                         |
| `gh release create --generate-notes`                                              | PR-title-based notes; `.github/release.yml` categorize/exclude                                                   | Rejected (can't strip PR-title text -> leaks scopes) |
| Hand-curate CHANGELOG.md in the Release PR + `--notes-file` for the Release notes | The proven 0.0.1/0.0.2 narrative style; leak-proof; human curation checkpoint                                    | ✓                                                    |

**User's choice:** Curate-in-PR primary (consistent with the maintainer's existing practice); the explicit question "can nx/gh be adapted?" was answered YES (both can) but the consumer-UX + DX lenses recommended keeping the curated style; the nx renderer is a deferred optional backstop. Scope hygiene (clean commit + PR titles) is the always-on discipline.
**Notes:** Merge-commits preference is fully compatible — granular history is preserved while the public changelog stays clean via curation.

---

## Research-auto-locked mechanics (HIGH-confidence, source-verified — not separately asked)

- nx.json change = ONLY `release.git.tag: true -> false` (keep commit:true/push:false/createRelease:false).
- Cut on a `release/*` branch via `nx release --skip-publish` (no native nx release-PR mode exists).
- Tag-after-merge = MANUAL on the merge commit, exact tag `angular-typechecker@x.y.z`; automated tagging declined (GITHUB_TOKEN can't fire release.yml; a PAT contradicts tokenless-OIDC).
- `release.yml` stays frozen/unchanged.
- Ruleset switch = full-replacement PUT 18229122 (enable + strict:false) then DELETE 18229088; retain 18229053.
- AGENTS.md release-mechanics section to be rewritten (code-review-gated).

## Claude's Discretion

- Exact `release/*` branch naming; the exact `ci.yml` skip-aware-gate mechanism + globs; per-release curated wording; whether to batch `.planning/` checkpoints into fewer PRs.

## Deferred Ideas

- nx custom changelog renderer (optional); squash merge (rejected); `gh --generate-notes` (rejected); automated tagging (rejected); maintainer-on-bypass (rejected); OpenSSF Scorecard / harden-runner / signed tags (later); Nx community-registry-listing PR (post-publish).

## Side answers given during discussion

- **Docker/act:** Phase 7 needs neither locally — the `act-compat` job runs container-free on GitHub's Ubuntu runner inside `ci.yml`. The maintainer can close Docker.
