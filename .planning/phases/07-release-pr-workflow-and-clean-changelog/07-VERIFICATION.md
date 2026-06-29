---
phase: 07-release-pr-workflow-and-clean-changelog
verified: 2026-06-29T13:05:00Z
status: passed
score: 3/3 must-haves verified; the planning-only skip-gate live proof surfaced a real bug (matrix did not skip) which was fixed and re-proven -- see "## UPDATE" below
re_verification:
  previous_status: human_needed
  note: "The live planning-only probe (PR #5, run on the pre-fix ci.yml) revealed the matrix RAN on a .planning/-only diff (the dorny/paths-filter all-negation `code` filter used the default `some` quantifier, so a .planning/x.md matched `!docs/**` and set code=true). Fixed by adding `predicate-quantifier: every` (commit f143534) and re-proven on a post-merge planning-only probe. This is exactly the bug the live-PR tier exists to catch -- act could not (it does not run the filter)."
---

# Phase 7: Release-PR workflow and clean changelog Verification Report

**Phase Goal:** Replace direct-push-to-main releases with a Release-PR workflow, harden `main` accordingly, and ship a clean public changelog free of internal GSD phase/plan scopes.
**Verified:** 2026-06-29T13:05:00Z
**Status:** passed (see "## UPDATE" below)
**Re-verification:** Yes -- the live planning-only probe surfaced a skip-gate bug, now fixed + re-proven

## UPDATE: the skip-gate live proof found + fixed a real bug (REL-02 DX)

The planning-only skip-gate proof was RUN (probe PR #5, a `.planning/`-only diff) and it
FAILED as written: the 6-cell `test` matrix + `e2e` RAN instead of skipping. Root cause: the
`changes` job's dorny/paths-filter used all-negation globs with the DEFAULT `some`
predicate-quantifier, so a `.planning/x.md` file matched `!docs/**` (it is not under `docs/`)
and set `code=true` -- the matrix never skipped. The `ci` gate stayed green (safe, no
deadlock), but the DX skip did not happen.

**Fix (commit f143534):** add `predicate-quantifier: 'every'` to the filter step (the
documented dorny/paths-filter idiom for "files NOT in a set"): a changed file counts toward
`code` only if it satisfies EVERY negation (NOT .planning, NOT *.md, NOT docs = a real code
file). Planning-only diff -> `code=false` -> matrix skips; code diff -> `code=true` -> matrix
runs. `act-compat` stays 12/0 (act does not run the filter; the negative `if:` keeps jobs in
the act plan regardless). Re-proven on a post-merge planning-only probe: `test`/`e2e` SKIPPED,
`changes`+`act-compat`+`lint-workflows`+`ci` SUCCESS, no deadlock.

This is precisely the value of the live-PR verification tier: the local `act-compat` (12/0)
and the static reasoning both PASSED the broken filter -- only a real planning-only PR exposed
it. The Key-Link "changes filter" row below (originally PARTIAL) is now WIRED.

## Goal Achievement

The phase goal decomposes into the three ROADMAP success criteria REL-01/REL-02/REL-03.
All three are ACHIEVED in the codebase and live GitHub config to the limit of what is
verifiable without cutting a real release. One DX proof (the planning-only skip-gate half)
is a live-PR operational verification that is still PENDING -- it is the only reason the
status is `human_needed` rather than `passed`. Per RESEARCH "## Validation Architecture",
this is the same human-gated draft-PR class as Phase 6 SC3, not a code gap.

### Observable Truths

| # | Truth (success criterion) | Status | Evidence |
|---|---------------------------|--------|----------|
| 1 | REL-01: the release cut creates a version+CHANGELOG commit but NO git tag (decoupled from the publish trigger); `release.yml` OIDC publish unchanged | ACHIEVED | `nx.json release.git` = `{commit:true, tag:false, push:false}`, `changelog.workspaceChangelog.createRelease:false` (read direct, lines 85-96). `release.yml` byte-frozen: `git diff HEAD` empty, last touched commit `dc740ab` (Phase 6), `git status` clean. act-compat probe (ran locally 12/0, exit 0): `release/publish` SELECTED only on tag refs, SKIPPED on PR + branch refs -- the tag-triggered publish path is intact. AGENTS.md documents the branch-cut -> PR -> merge -> tag-the-merge-commit flow (lines 137-220). |
| 2 | REL-02: `main` is in PR mode -- staged "Default branch" ruleset ENABLED; v0.0.1 ruleset DELETED; "Release tag" ruleset RETAINED | ACHIEVED (live, one-time op) | `gh api .../rulesets/18229122`: `enforcement:active`, `bypass_actors:[]`, condition `~DEFAULT_BRANCH`, rules = `deletion` + `non_fast_forward` (force-push/deletion blocked) + `pull_request` (approvals 0, merge `["merge"]`, thread-resolution true) + `required_status_checks` (`ci` + `Analyze (actions)` + `Analyze (javascript-typescript)`, `strict_required_status_checks_policy:false`). `gh api .../rulesets/18229088` -> 404 (v0.0.1 DELETED). `gh api .../rulesets/18229053` -> active tag ruleset (RETAINED). New skip-gate ci.yml green on real runners (run 28366176185). |
| 3 | REL-03: the public CHANGELOG.md (and the Release-notes source) exposes NO internal GSD phase/plan scope | ACHIEVED | CHANGELOG.md scanned with all three leak-shape regexes -- conventional-commit scope `\((\d{2}(?:-\d{2})*)\)`, bold heading `\*\*\d{2}(?:-\d{2})*[:*]`, bare leading `\b\d{2}(?:-\d{2})*:` -- each returns NONE. 0.0.1/0.0.2 entries are curated narrative (prose + Features/Fixes + a Compatibility block). The release-hygiene spec encodes the same three assertions (lines 237-257). AGENTS.md mandates curate-in-PR + `gh release create --notes-file` (NEVER `--generate-notes`) + scope hygiene (lines 164-220). |

**Score:** 3/3 truths verified (all codebase + one-time-live evidence confirmed). 1 live-PR DX proof pending (see Human Verification).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `nx.json` | `release.git.tag:false` (+ commit:true, push:false, createRelease:false) | VERIFIED | Exact `{commit:true,tag:false,push:false}`; createRelease:false. One-field flip per D-01. |
| `.github/workflows/release.yml` | FROZEN / OIDC-only tag-triggered publish | VERIFIED | Byte-unchanged vs HEAD; last touched `dc740ab` (Phase 6); release-hygiene spec asserts no `pull_request_target`, no `contents:write`, SHA-pins, id-token:write, registry-url, NODE_AUTH_TOKEN unset -- all still pass. |
| `.github/workflows/ci.yml` | path-aware skip-gate; `ci` job id+name byte-stable | VERIFIED | `changes` job (dorny/paths-filter SHA-pinned v4.0.0, line 54); `test`/`e2e` gated by negative `if: needs.changes.outputs.code != 'false'`; `ci` aggregate `needs:[changes,test,e2e,act-compat,lint-workflows]`, `if:always()`, fail set drops `'skipped'`, keeps `failure`+`cancelled`; no `paths-ignore` on `on:`; name+id `ci` intact. |
| `AGENTS.md` | Release-PR-flow rewrite (D-17), code-review-gated | VERIFIED | Branch-cut/PR/merge-commit/tag-the-merge-commit flow + PR-only-main note + D-12 recovery toggle; 0.x bump table + GIT_PUSH_FALSE_WITH_CREATE_RELEASE landmine + literal-version gotcha kept verbatim. Code-review-gate satisfied by phase code_review_gate (per AGENTS.md self-rule). |
| `release-hygiene.int.spec.ts` | git.tag===false + CHANGELOG-no-plan-id-scope assertions | VERIFIED | New `it('keeps the cut decoupled from git tagging (REL-01/D-01)')` asserts `git.tag===false` (line 111); new `describe('REL-03: ...')` asserts the 3 leak shapes against CHANGELOG.md (lines 237-257). Suite ran green 24/24, release-hygiene 17/17. |
| `.planning/REQUIREMENTS.md` | REL-01/02/03 defined + Traceability | VERIFIED | Three definitions with acceptance criteria (lines 67-69); Traceability rows -> Phase 7 (lines 147-149); coverage 34/34/0. |
| `CHANGELOG.md` | curated, no plan-id scope | VERIFIED | 0.0.1/0.0.2 curated; 3 leak-shape scans return NONE. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `nx.json release.git.tag:false` | release cut produces no tag | nx release gates tagging on `git.tag` (D-01, nx 23.0.1 source) | WIRED | Config present; act-compat confirms the tag-trigger path (`release/publish` only fires on tag refs) is intact and untouched. |
| ci.yml `ci` aggregate job | ruleset 18229122 required check | required-status-check `context:"ci"` | WIRED | Live ruleset lists `ci` (integration_id 15368). ci.yml job id+name byte-stable `ci`. Real-runner run 28366176185 reported `ci` success on a code push; dependabot PR run 28366273522 reported `ci` success on a code PR with full matrix. |
| ci.yml `changes` filter | `test`/`e2e` path-skip | negative `if: needs.changes.outputs.code != 'false'` + `predicate-quantifier: every` (f143534) | WIRED (both halves proven on real runners) | Code-PR-runs-matrix proven (dependabot PR #2, run 28366273522). Planning-only-skip first FAILED on probe PR #5 (the `some`-quantifier bug -- see "## UPDATE"), fixed via `predicate-quantifier: every`, re-proven on a post-merge planning-only probe (matrix SKIPPED, `ci` green, no deadlock). |
| CHANGELOG.md | GitHub Release notes | `gh release create --notes-file` (never --generate-notes) | WIRED (documented; per-release op pending) | AGENTS.md mandates `--notes-file`; no release has been cut under the new flow yet, so the live notes-match is a future per-release op (one-time operational, RESEARCH tier). |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| release-hygiene + install-e2e suite green (incl. git.tag + CHANGELOG assertions) | `npx nx run angular-typechecker-install-e2e:test` | 3 files / 24 tests passed; release-hygiene 17/17; "Successfully ran target test" (the "consumer-app failed" line is the EXPECTED injected-TS2322 from the install-smoke spec, not a failure) | PASS |
| nx.json release.git invariants | read `nx.json` lines 85-96 | `{commit:true,tag:false,push:false}` + createRelease:false | PASS |
| CHANGELOG has no plan-id scope | 3 `rg` leak-shape scans | all NONE | PASS |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| `tools/act/act-compat.sh` (workflow trigger/condition fidelity) | `bash tools/act/act-compat.sh` (Docker up, act v0.2.89) | 12 passed / 0 failed; exit 0; both workflows parse; `ci/test-`+`ci/e2e`+`ci/ci` SELECTED on pull_request+push-main; `release/publish` SKIPPED on PR/branch, SELECTED on tag/dispatch | PASS |

Note: `actionlint` is not installed on this dev box (Phase-6 recorded state); the `./actionlint -color` static check is covered by the CI `lint-workflows` job (pinned 1.7.7), which is green on real runners (run 28366176185 `lint-workflows: success`).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| REL-01 | 07-01 | Release-PR flow (cut commits-not-tags; release.yml frozen) | SATISFIED (1 release-context dry-run is a future op) | nx.json git.tag:false; release.yml frozen; spec assertion; AGENTS.md flow; act-compat tag-path intact. |
| REL-02 | 07-02, 07-04 | Branch-protection switch to PR mode | SATISFIED (live) + 1 live-PR DX proof pending | Ruleset 18229122 active/strict:false/empty-bypass/3-checks/merge:["merge"]; 18229088 deleted (404); 18229053 retained; new ci.yml green on real runners. |
| REL-03 | 07-01, 07-03 | Clean public changelog | SATISFIED | CHANGELOG no plan-id scope (3 scans NONE); regression assertion; AGENTS.md curate-in-PR + --notes-file. |

No orphaned requirements: REQUIREMENTS.md maps exactly REL-01/02/03 to Phase 7, and all three appear in the plans' `requirements`/coverage.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | -- | No TBD/FIXME/XXX/TODO/PLACEHOLDER in nx.json, ci.yml, AGENTS.md, release-hygiene spec, or CHANGELOG.md | -- | No debt markers; no stub patterns. The `paths-ignore` string in ci.yml appears ONLY inside an explanatory comment documenting the anti-pattern to AVOID -- not in the `on:` trigger (verified: `on:` is `pull_request:{}` + `push:branches:[main]`). |

### Human Verification Required

#### 1. Planning-only skip-gate live proof (the close-out PR)

**Test:** Open the phase-07-closeout PR (from `gsd/phase-07-closeout`, currently a `.planning/`-only diff vs `origin/main`: `.planning/ROADMAP.md` + `07-04-SUMMARY.md`) against `main` and observe the `ci` check on the `pull_request` event.
**Expected:** The `changes` filter sets `code == 'false'`; the heavy `test` (6-cell matrix) and `e2e` jobs are SKIPPED; `changes`, `act-compat`, `lint-workflows`, and the `ci` aggregate gate all report SUCCESS; the required `ci` check is green and the merge button is NOT stuck on "Expected -- waiting for status".
**Why human:** Requires a real GitHub `pull_request` run exercising path-filter base..head diffing + required-check reporting. act cannot emulate either (the act-compat suite proves job SELECTION per trigger, not path-skip arithmetic). The complementary "code PR runs the matrix" half is ALREADY proven on a real runner (dependabot PR #2, run 28366273522: full 6-cell matrix + e2e + `ci` all green), so only the planning-only-skip half remains unobserved -- and the close-out PR (this phase's own artifact PR) is the natural vehicle, mirroring the Phase 6 SC3 draft-PR proof.

### Gaps Summary

No code or config gaps. All three success criteria are achieved in the codebase + live
GitHub config:

- REL-01: `nx.json` `release.git.tag:false` (+commit:true/push:false/createRelease:false),
  `release.yml` byte-frozen, regression assertion in place, AGENTS.md flow rewritten,
  act-compat confirms the OIDC tag-publish path is intact.
- REL-02: the live "Default branch" ruleset is `active` with `strict:false`, empty bypass,
  the 3 required checks, merge `["merge"]`, force-push/deletion blocked; the v0.0.1 ruleset
  is deleted (404); the Release-tag ruleset is retained; the new skip-gate ci.yml is green
  on real runners and the code-PR-runs-matrix half of the DX is proven.
- REL-03: the public CHANGELOG.md carries no plan-id scope (3 leak-shape scans clean), the
  regression assertion guards it, and AGENTS.md systematizes curate-in-PR + `--notes-file`.

The planning-only skip-gate LIVE proof was run: it first exposed a real bug (the matrix did
not skip -- the `some`-quantifier defect), which was fixed (f143534, `predicate-quantifier:
every`) and re-proven on a post-merge planning-only probe. With both skip-gate halves now
proven on real runners, there are no outstanding items: the phase is fully closed (status
`passed`).

---

## VERIFICATION PASSED

The planning-only skip-gate was proven on a real PR (it first FAILED, exposing the
`some`-quantifier bug; fixed in f143534 with `predicate-quantifier: every`; re-proven on a
post-merge planning-only probe: `test`/`e2e` SKIPPED, `changes`+`act-compat`+`lint-workflows`+`ci`
SUCCESS, no deadlock). All three success criteria are achieved and all evidence confirmed:
REL-01 (nx.json git.tag:false + frozen release.yml + spec assertion + AGENTS.md flow);
REL-02 (live ruleset switch + new-ci.yml-green-on-real-runners + both skip-gate halves proven);
REL-03 (clean changelog + regression assertion + curate-in-PR/--notes-file docs).

---

_Verified: 2026-06-29T13:05:00Z_
_Verifier: Claude (gsd-verifier)_
