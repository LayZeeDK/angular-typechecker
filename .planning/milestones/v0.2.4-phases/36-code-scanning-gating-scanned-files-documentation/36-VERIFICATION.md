---
phase: 36-code-scanning-gating-scanned-files-documentation
verified: 2026-07-23T18:05:00Z
status: passed
score: 10/10 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 8/10
  gaps_closed:
    - "GATE-01 real-CI red/green Nyquist point (was truth #10): confirmed live -- GREEN run 29898624245 (headSha 3e4fc6f) has code-scanning=success + proof=success + ci=success; RED chaos run 29901279596 (PR #56, forced empty SARIF) has code-scanning=failure via the D-03 assertion + ci=failure while code-scanning-proof stayed success."
    - "GATE-02 live ruleset enablement / SC3 (was truth #7): the \"Require code scanning results\" ruleset is ACTIVE on main (angular-typechecker + CodeQL required) after PR #55 merged (commit 966a7c6); proven clean on planning-only probe #64 and code probe #65 with no deadlock."
  gaps_remaining: []
  regressions: []
  notes:
    - "Post-phase refinement (same milestone PR #55, quick task 260722-g6y): the proof job was renamed code-scanning-proof -> code-scanning-red-proof and given its own Code Scanning tool. Both Code Scanning jobs remain required members of the ci aggregate; the drift guard was updated to lock the renamed id and added a D-02 driver-name assertion. GATE-01's membership contract holds under the new name -- not a regression."
---

# Phase 36: Code Scanning gating + Scanned-files documentation Verification Report

**Phase Goal:** Make a successful Code Scanning upload part of the merge gate -- both via the required `ci` aggregate and GitHub's "Require code scanning results" ruleset -- WITHOUT deadlocking planning-only or fork PRs, and document the CodeQL-only "Scanned files" limitation as a known GitHub product gap. Enabling the ruleset on `main` is a real-CI-only, spike-gated step verified on a throwaway PR first.
**Verified:** 2026-07-23T18:05:00Z
**Status:** passed
**Re-verification:** Yes -- after the two real-CI-only / human-only items were resolved with recorded evidence

## Re-verification Summary

The prior pass (2026-07-22) returned `human_needed` at 8/10: truths #7 (GATE-02 live ruleset) and #10 (GATE-01 real-CI Nyquist point) were left `PRESENT_BEHAVIOR_UNVERIFIED` because both are real-CI-only / human-only and were deferred past the offline pass by design (D-04). Both are now RESOLVED and independently confirmed against GitHub (not rubber-stamped from the UAT):

- **Truth #10 (GATE-01 red/green):** queried both CI runs directly. GREEN run `29898624245` (headSha `3e4fc6f`) = success with `code-scanning`=success, `code-scanning-proof`=success, `ci`=success. RED chaos run `29901279596` (PR #56, `displayTitle` "CHAOS (DO NOT MERGE): verify ci aggregate reds on a code-scanning failure") = failure with `code-scanning`=**failure** (the D-03 empty-SARIF assertion), `code-scanning-proof`=success, `ci`=**failure**. The aggregate reds *specifically* because `code-scanning` failed while the proof job stayed green -- exactly GATE-01's contract.
- **Truth #7 (GATE-02):** PR #55 is MERGED (commit `966a7c6`, 2026-07-22T23:06Z). Raw check-runs on both probe PR heads confirm the ruleset's tool check fires clean on both PR kinds: planning-only #64 shows `angular-typechecker`=success + `code-scanning`=success + `code-scanning-red-proof`=skipped (no deadlock); code #65 shows `angular-typechecker`=success + `angular-typechecker-red-proof`=success + `code-scanning`=success + `code-scanning-red-proof`=success.

The 8 previously-verified truths are unchanged; spot-checked (`ci.needs[]` membership + D-03 assertions by direct read, AGENTS.md runbook by grep, drift guard + docs tripwire by running the specs -- 29/29 pass). Every truth now resolves to VERIFIED; the human-verification section is empty; status is `passed`.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1/GATE-01/D-02: `code-scanning` + the proof job are members of the required `ci` aggregate's `needs[]`; the reversal of the prior exclusion is documented | VERIFIED | `ci.yml:800-815` `needs[]` list contains `code-scanning,` and `code-scanning-red-proof,` (proof job renamed post-phase; see re-verification notes); drift guard `ci-e2e-coverage-guard.spec.ts` GATE-01/02 describe passes (`nx test`: 29/29 in the two relevant files) |
| 2 | GATE-01/D-03: on a non-fork PR a silent `produced=='false'` SARIF (atc + fallow) fails the `code-scanning` job loud; never fires on fork PR or push | VERIFIED | Two named steps at `ci.yml:614-623` gated `github.event_name == 'pull_request' && ...head.repo.fork == false && steps.<id>.outputs.produced == 'false'`, static `echo "::error::..."` + `exit 1` bodies; drift guard it anchors on `produced == 'false'` and passes. Behaviorally exercised: RED run 29901279596's `code-scanning` job failed via this exact assertion on a forced empty SARIF |
| 3 | SC2/GATE-02/D-01/D-01a: `code-scanning` is un-path-gated (no `needs.changes.outputs.code` `if:`); the proof job stays PR-only + path-gated | VERIFIED | `code-scanning:` job (`ci.yml:551`) has `needs: changes` but no path-gate `if:`; drift guard scoped-block it (`.toBe(false)`) passes; behaviorally confirmed by probe #64 where `code-scanning`=success on a `.planning/`-only PR while `code-scanning-red-proof`=skipped |
| 4 | D-05: the two "DELIBERATELY NOT" comment blocks and the `cve-lite` comment are reconciled with the new membership; the code-review WR-01 stale "Path-gated (D-08)" note on `code-scanning` is fixed | VERIFIED | Confirmed VERIFIED in the initial pass (commit `5aff3a7`); artifacts unchanged on `main` |
| 5 | D-06: additive-only vs the phase start commit -- no `packages/angular-typechecker/src/**` runtime change, no `package.json`/manifest change, no version bump | VERIFIED | Confirmed VERIFIED in the initial pass (the phase's own diff was ci.yml + AGENTS.md + README + two spec files only); historical, now merged into `main` |
| 6 | GATE-02/D-04: AGENTS.md documents the human-run ruleset-enablement runbook (add rule for both tools, Evaluate first, probe two PR kinds, flip to Active, `enforcement: disabled` recovery, fork-PR deadlock accepted) and states the agent never flips the `main` ruleset | VERIFIED | `AGENTS.md:243-278` `### Enabling the "Require code scanning results" ruleset (human-run, real-CI-only)` with the 6 steps and the opening "agent NEVER flips" statement; no ruleset-mutating `gh api` call present |
| 7 | SC3/GATE-02: the ruleset is verified live in Evaluate mode, probed on throwaway PRs, then flipped to Active on `main` | VERIFIED | RESOLVED. Ruleset ACTIVE on `main` (`angular-typechecker` + CodeQL required, user-authorized) after PR #55 merged (commit `966a7c6`). Proven clean on both probe kinds: planning-only #64 (`angular-typechecker` check=success, no deadlock) and code #65 (`angular-typechecker` + red-proof=success). Documented deviation (the true blocker was an orphaned angular-typechecker Code Scanning config from the Phase-34 category rename, fixed by deleting 4 orphaned analyses via the Code Scanning API per spike 012, with NO ci.yml change) is a recorded decision, not a gap. `fallow` deliberately not on the required list; `angular-typechecker-red-proof` deliberately off it |
| 8 | SC4/DOC-01: README documents the CodeQL-only "Scanned files" panel limitation in end-user language, citing the `run.artifacts`-inert spike evidence, no GitHub Issue filed | VERIFIED | Confirmed VERIFIED in the initial pass; `README.md` `#### The "Scanned files" panel stays empty (a GitHub limitation)`; unchanged on `main` |
| 9 | DOC-01: a docs tripwire locks the README claim against drift | VERIFIED | `packages/angular-typechecker/src/code-scanning-docs.spec.ts` passes (4/4 its) in the re-verification run |
| 10 | GATE-01 real-CI Nyquist point: the required `ci` aggregate goes RED on a genuine regression and GREEN otherwise, with both jobs as required members | VERIFIED | RESOLVED. GREEN run `29898624245` (headSha `3e4fc6f`): `code-scanning`=success, `code-scanning-proof`=success, `ci`=success. RED chaos run `29901279596` (PR #56, forced empty SARIF): `code-scanning`=**failure** (D-03 assertion), `ci`=**failure**, `code-scanning-proof`=success (attribution confirmed -- the aggregate reds because of `code-scanning` specifically). Chaos PR #56 CLOSED + branch deleted; `main` unchanged |

**Score:** 10/10 truths verified (0 present-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.github/workflows/ci.yml` | `ci.needs[]` +code-scanning +proof job; `code-scanning` path-gate removed; two `if:`-gated D-03 assertion steps; reconciled comment blocks | VERIFIED | Confirmed by direct read on `main`; proof job now `code-scanning-red-proof` (post-phase rename), still a required member |
| `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` | GATE-01/02 drift guard reusing `extractJobLines` | VERIFIED | Present, updated to lock the renamed proof id + a D-02 driver-name assertion; 25 its pass |
| `AGENTS.md` | Human-run ruleset-enablement runbook subsection | VERIFIED | Present at `AGENTS.md:243-278`; runbook proven accurate by the live execution (probe #64/#65) |
| `packages/angular-typechecker/README.md` | New `#### The "Scanned files" panel stays empty (a GitHub limitation)` sub-subsection | VERIFIED | Present, unchanged; 4 tripwire tokens intact |
| `packages/angular-typechecker/src/code-scanning-docs.spec.ts` | Docs tripwire mirroring `angular-cli-docs.spec.ts` | VERIFIED | Present, 4 its pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `ci` aggregate `needs[]` | `code-scanning` / `code-scanning-red-proof` jobs | list-item membership | WIRED | Confirmed via direct read + drift guard (list-item-anchored); behaviorally proven RED (chaos run) and GREEN (clean run) |
| `code-scanning` job | D-03 assertion steps | `if:` expression + step-output | WIRED | Fired for real: RED run 29901279596's `code-scanning` job failed via the atc `produced == 'false'` assertion |
| README DOC-01 prose | `code-scanning-docs.spec.ts` tripwire | exact heading + normalized-whitespace `.toContain` | WIRED | 4 tokens present in README and asserted; spec green |
| AGENTS.md runbook | live `main` ruleset settings | human execution | EXERCISED | Runbook executed post-merge; ruleset ACTIVE on `main`, proven clean on probe #64 (planning-only) and #65 (code) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Drift guard + docs tripwire pass | `nx test angular-typechecker` (two relevant spec files) | 29 passed / 2 files (0 failed) | PASS |
| GREEN-on-clean real CI | `gh run view 29898624245` | `code-scanning`=success, `code-scanning-proof`=success, `ci`=success | PASS |
| RED-on-regression real CI | `gh run view 29901279596` (chaos PR #56) | `code-scanning`=failure (D-03), `ci`=failure, `code-scanning-proof`=success | PASS |
| GATE-02 ruleset clean on planning-only PR | `gh api .../commits/<#64 head>/check-runs` | `angular-typechecker`=success, `code-scanning`=success, `code-scanning-red-proof`=skipped | PASS |
| GATE-02 ruleset clean on code PR | `gh api .../commits/<#65 head>/check-runs` | `angular-typechecker` + `angular-typechecker-red-proof` + `code-scanning` + `code-scanning-red-proof` all success | PASS |
| PR #55 merged to main | `gh pr view 55 --json state,mergeCommit` | MERGED, mergeCommit `966a7c6` | PASS |

### Probe Execution

SKIPPED -- no `scripts/*/tests/probe-*.sh` declared or found for this phase; PLAN/SUMMARY do not reference any probe script. (The real-CI red/green Nyquist point serves as the phase's behavioral probe and is now confirmed above.)

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|--------------|--------|----------|
| GATE-01 | 36-01 | `code-scanning` job is a required member of the `ci` aggregate | SATISFIED | CI wiring + drift guard (truths 1-2, 4) plus the now-confirmed real-CI red/green Nyquist point (truth 10) |
| GATE-02 | 36-01 + 36-02 | GitHub "Require code scanning results" enabled on `main`, planning-only PRs not deadlocked | SATISFIED | CI un-path-gating (truth 3) + AGENTS.md runbook (truth 6) + the live ruleset ACTIVE on `main`, proven clean on probe #64/#65 (truth 7) |
| DOC-01 | 36-02 | README documents the CodeQL-only Scanned-files panel limitation | SATISFIED | Committed + locally verified (truths 8-9) |

No orphaned requirements: all three IDs declared in the plans' `requirements:` frontmatter match REQUIREMENTS.md's Phase 36 traceability row.

### Anti-Patterns Found

None blocking. The prior WARNING (WR-01, stale "Path-gated (D-08)" comment) was fixed in commit `5aff3a7`. No debt markers, no email/domain leak in the phase's changed files (confirmed in the initial pass; artifacts unchanged).

### Human Verification Required

None. Both previously-deferred items (GATE-01 real-CI Nyquist point; GATE-02 human ruleset enablement) have been executed and confirmed with recorded, independently-verified GitHub evidence.

### Gaps Summary

No gaps. All ten must-haves are VERIFIED. The two items the initial pass deferred as real-CI-only / human-only (by design, D-04) are now closed: GATE-01's red/green aggregate behavior is proven by the GREEN clean run (29898624245) and the RED chaos run (29901279596, where `ci` reds specifically because `code-scanning` fails), and GATE-02's ruleset is ACTIVE on `main` (PR #55 / commit `966a7c6`) and proven not to deadlock either PR kind (probe #64 planning-only, #65 code). The documented GATE-02 deviation (orphaned-config cleanup via spike 012 with no ci.yml change; `fallow` and `angular-typechecker-red-proof` intentionally off the required tool list) is a set of recorded decisions, not gaps. The post-phase proof-job rename (`code-scanning-proof` -> `code-scanning-red-proof`, same milestone PR) preserves GATE-01's membership contract and is locked by the updated drift guard.

---

*Verified: 2026-07-23T18:05:00Z*
*Verifier: Claude (gsd-verifier)*
