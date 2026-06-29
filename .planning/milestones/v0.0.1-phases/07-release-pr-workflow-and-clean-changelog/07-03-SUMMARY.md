---
phase: 07-release-pr-workflow-and-clean-changelog
plan: 03
subsystem: docs / release-mechanics
tags: [agents-md, release-pr-flow, changelog-hygiene, branch-protection, nx-release]
requires:
  - "07-01 (nx.json release.git.tag:false flip + release-hygiene git.tag assertion)"
  - "07-02 (ci.yml path-aware skip-gate; the required `ci` check the ruleset consumes)"
  - "Phase 6 ci aggregate gate (the required-check name `ci`)"
provides:
  - "AGENTS.md release-mechanics section rewritten for the Release-PR flow (D-17)"
  - "AGENTS.md default-branch-ruleset note: main is PR-only (empty bypass) + D-12 recovery toggle"
affects:
  - "How every future AI agent cuts a release in this repo (docs -> agent behavior trust boundary)"
tech-stack:
  added: []
  patterns:
    - "Release-PR flow: cut on release/* branch -> PR (carries code + .planning/) -> merge commit -> tag the MERGE COMMIT -> push tag -> OIDC publish"
    - "Curate-in-the-Release-PR changelog hygiene; gh release create --notes-file (never --generate-notes)"
key-files:
  created:
    - ".planning/phases/07-release-pr-workflow-and-clean-changelog/07-03-SUMMARY.md"
  modified:
    - "AGENTS.md"
decisions:
  - "[07-03] Kept the LANDMINE block's closing line referencing the manual `git push origin angular-typechecker@<version>` -- still accurate (curation precedes the tag push) and consistent with the new merge-commit-tag flow; no regression of the source-verified LANDMINE."
  - "[07-03] AGENTS.md change is code-review-gated per AGENTS.md's OWN rule (lines 6-17); the phase code_review_gate (/gsd-code-review) satisfies it -- this plan does NOT claim the change is `done` without that review."
metrics:
  duration: ~7 min
  completed: 2026-06-29
---

# Phase 7 Plan 03: AGENTS.md Release-PR-flow rewrite Summary

Rewrote the AGENTS.md release-mechanics section so every future AI agent cuts a release via the Release-PR flow (cut on a `release/*` branch -> PR carrying code + `.planning/` -> merge commit -> tag the merge commit -> push tag -> OIDC publish), kept the source-verified 0.x bump table + the `createRelease:"github"` LANDMINE + the literal-version gotcha verbatim, and added a PR-only-`main` note with the D-12 lockout-recovery toggle.

## What Was Built

One task, one file (`AGENTS.md`), five in-place edits per the RESEARCH "AGENTS.md Rewrite Scope (D-17)" table:

1. **UPDATE "Always confirm with a dry run":** Added that the UNIFIED `npx nx release --dry-run` must be used because the `nx release version` subcommand REJECTS the top-level `release.git` block (newly verified against nx 23.0.1) and only the unified command honors the `commit`/`tag`/`push` config this repo relies on.
2. **STRENGTHEN Gotcha 2 (scope hygiene):** Cited the concrete evidence -- a live `npx nx release --dry-run` PROVED the raw nx changelog renders plan-id scopes verbatim as bold headings such as `**06-02:**`, exactly the internal phase/plan numbers a public changelog must never expose.
3. **REWRITE Gotcha 3 lead:** Replaced the old "cut locally on `main` -> curate -> push the tag from main" + "the cut creates the tag" text with the Release-PR flow (D-01/D-02/D-03/D-04/D-05/D-07/D-14): branch `release/x.y.z` off `main`, `npx nx release --skip-publish` (with `git.tag:false` -> NO tag; `push:false`+`createRelease:false` -> NO push; commit-only), curate + amend, PR carrying code + `.planning/`, self-merge as a MERGE COMMIT once `ci` is green, tag the MERGE COMMIT exactly `angular-typechecker@x.y.z` (no `v`), pre-push verify `git show <tag>:packages/angular-typechecker/package.json` carries the bump, push the tag to fire the frozen `release.yml`, then `gh release create ... --notes-file <curated-section> --verify-tag` (NEVER `--generate-notes`). Documented WHY tagging stays manual (default `GITHUB_TOKEN` cannot trigger another workflow; a PAT/App = a long-lived `contents` secret contradicting the OIDC posture).
4. **REWRITE the Quick checklist (steps reordered 1-7):** branch-cut -> unified dry-run -> cut (no tag) -> curate + amend -> PR (carries `.planning/`) -> merge commit -> tag-the-merge-commit + verify-bump + push-tag + gh-release-via-notes-file. States explicitly the cut no longer creates a tag.
5. **ADD "The default-branch ruleset: `main` is PR-only" note:** `main` has an active ruleset with an EMPTY bypass (even the owner cannot direct-push, D-06); release TAGS are governed by the SEPARATE "Release tag" ruleset (so the empty branch bypass does not block the tag push); and the D-12 lockout recovery -- if `ci` goes red/non-reporting, admins EDIT the ruleset (`enforcement: disabled`), push the fix, re-enable (preferred over a standing bypass actor).

## KEPT verbatim / not regressed (verified)

- The "Conventional Commits drive the changelog and the released version" intro + the **0.x bump-shift table** (`feat`/`fix` both PATCH in 0.x; breaking -> minor) -- VERIFIED correct against nx 23.0.1. `rg 'EFFECT NOW' AGENTS.md` still returns a hit.
- "Only commits that touch the published project count" (`release.projects:["angular-typechecker"]` scoping).
- Gotcha 1 (a LITERAL version bypasses the 0.x shift + conventional derivation).
- Gotcha 3's `createRelease:"github"` LANDMINE sub-block (both failure modes: `GIT_PUSH_FALSE_WITH_CREATE_RELEASE` hard-error with `push:false`; silent push without it) -- KEPT verbatim; `rg 'GIT_PUSH_FALSE_WITH_CREATE_RELEASE' AGENTS.md` still returns it.
- Reconciliation note: AGENTS.md's 0.x-adjusted bump column stays the operative one vs. CLAUDE.md's post-1.0 mapping note (the existing distinction at the dry-run section is preserved).

## Verification

All plan acceptance-criteria `rg` checks pass against `AGENTS.md`:
- `rg 'release/'` -> the cut happens on a `release/*` branch (lines 145, 203).
- `rg 'merge commit|MERGE COMMIT'` -> the tag targets the merge commit (lines 143, 152-154, 198, 213-214).
- `rg 'git\.tag'` -> documents that `git.tag: false` means the cut creates no tag (line 207).
- `rg 'GIT_PUSH_FALSE_WITH_CREATE_RELEASE'` -> the KEPT LANDMINE block (line 181).
- `rg 'generate-notes'` -> `--generate-notes` documented as forbidden, `--notes-file` used instead (lines 165, 220).
- `rg 'enforcement'` -> the D-12 recovery toggle + PR-only-main note (lines 237-238).
- `rg 'nx release version'` -> the unified-command dry-run note (lines 84, 204).
- `rg 'EFFECT NOW'` -> the 0.x bump-shift table is still present (line 54), not regressed.
- `rg -nP "[^\x00-\x7F]"` -> returns nothing; ASCII-only (no em dashes, curly quotes, ellipsis introduced).

Consistency with the other Phase-7 plans: the rewrite encodes Plan 01's `nx.json git.tag:false`, references Plan 02's required `ci` check (the ruleset's status check), and the PR-only `main` matches Plan 04's (pending) live ruleset switch. No contradiction across the four plans.

## Deviations from Plan

None - plan executed exactly as written. (The LANDMINE block's closing line referencing the manual `git push origin angular-typechecker@<version>` was deliberately retained: it remains accurate under the new flow -- curation precedes the tag push -- so leaving it intact avoids regressing the source-verified LANDMINE while staying consistent with the merge-commit-tag sequence.)

## Code-Review Gate Dependency (AGENTS.md's own rule)

Per AGENTS.md lines 6-17, ANY change to AGENTS.md MUST be code-reviewed. This change is NOT "done" until the phase `code_review_gate` (`/gsd-code-review`) has checked it for factual accuracy against nx 23.0.1 + the locked decisions (D-01..D-17), internal consistency, clarity, and ASCII-only compliance. This plan surfaces the change FOR that review; it does not assert the review has happened. The reviewer should confirm: (1) the 0.x table + LANDMINE + literal-version gotcha are unregressed; (2) the new flow matches Plan 01's `git.tag:false` + Plan 02's `ci` check + Plan 04's PR-only ruleset; (3) the file is ASCII-only.

## No Stubs

No stub patterns introduced (docs-only change; no code, no data wiring).

## Self-Check: PASSED

- FOUND: AGENTS.md (modified, all five edits applied + verified via rg).
- FOUND: .planning/phases/07-release-pr-workflow-and-clean-changelog/07-03-SUMMARY.md (this file).
- FOUND commit: edeb832 docs(07-03): rewrite AGENTS.md release-mechanics for the Release-PR flow.
