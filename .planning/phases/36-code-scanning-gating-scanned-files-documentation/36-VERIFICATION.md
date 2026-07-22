---
phase: 36-code-scanning-gating-scanned-files-documentation
verified: 2026-07-22T02:15:00Z
status: human_needed
score: 8/10 must-haves verified
behavior_unverified: 2
overrides_applied: 0
behavior_unverified_items:
  - truth: "GATE-01 real-CI Nyquist point: the required `ci` aggregate genuinely goes RED on a real Code Scanning upload/infra failure or a PROOF-02 (SARIF -> Code Scanning contract) regression, and stays GREEN on a clean PR, with `code-scanning` + `code-scanning-proof` as required members."
    test: "Force a genuine infra break (e.g. corrupt `merge-sarif.mjs` output) or a PROOF-02 regression on a throwaway PR and confirm the required `ci` check goes red; separately confirm a clean PR keeps `ci` green with both jobs required."
    expected: "`ci` fails when `code-scanning` or `code-scanning-proof` fails/cancels; `ci` passes when both succeed or are legitimately path-skipped (proof job on planning-only PRs)."
    why_human: "GitHub Actions ingestion and the aggregate's live verdict cannot be reproduced by local grep/test; this phase's own PR (#55) currently shows `ci`=SUCCESS with both jobs SUCCESS, which corroborates the GREEN-on-clean-PR half only -- the RED-on-regression half is unexercised by design (no destructive test was run against a real PR)."
  - truth: "GATE-02 (SC3): the \"Require code scanning results\" ruleset for angular-typechecker + fallow is verified live in Evaluate mode first, probed on a `.planning/`-only PR and a code PR, then flipped to Active on `main`."
    test: "Maintainer follows the AGENTS.md 6-step runbook: add the rule for both tools -> Evaluate mode -> push a `.planning/`-only probe PR and a code probe PR -> confirm Ruleset Insights shows neither would be blocked -> flip to Active."
    expected: "Ruleset is Active on `main`; neither PR kind is blocked; the `enforcement: disabled` recovery and the fork-PR deadlock are documented and understood by the maintainer."
    why_human: "Enabling a `main` ruleset is an out-of-band, human-only, real-CI-only GitHub repo-settings action (D-04) -- the agent never performs it. Not yet executed; AGENTS.md documents the runbook but the live steps have not been run."
human_verification:
  - test: "Confirm this phase's own PR run (or a follow-up throwaway PR) shows a genuine RED `ci` aggregate when a Code Scanning upload/infra failure or a PROOF-02 regression is deliberately introduced, and GREEN otherwise, with `code-scanning` + `code-scanning-proof` as required members."
    expected: "`ci` fails on a real regression and passes on a clean PR, matching GATE-01's contract."
    why_human: "Real-CI-only Nyquist point; not reproducible via local grep/test. Partial corroboration already exists: PR #55 shows `ci`=SUCCESS with both `code-scanning` and `code-scanning-proof`=SUCCESS as of the latest run."
  - test: "Run the AGENTS.md \"Enabling the Require code scanning results ruleset\" runbook end-to-end on the live `main` ruleset settings."
    expected: "Evaluate mode confirms neither a `.planning/`-only PR nor a code PR would be blocked; ruleset flipped to Active; `enforcement: disabled` recovery path understood; fork-PR deadlock accepted as documented."
    why_human: "Human-only, real-CI-only GitHub repo-settings action (D-04); the agent never flips the `main` ruleset. Deferred until after this phase's PR merges, per plan design."
---

# Phase 36: Code Scanning gating + Scanned-files documentation Verification Report

**Phase Goal:** Make a successful Code Scanning upload part of the merge gate -- both via the required `ci` aggregate and GitHub's "Require code scanning results" ruleset -- WITHOUT deadlocking planning-only or fork PRs, and document the CodeQL-only "Scanned files" limitation as a known GitHub product gap. Enabling the ruleset on `main` is a real-CI-only, spike-gated step verified on a throwaway PR first.
**Verified:** 2026-07-22T02:15:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1/GATE-01/D-02: `code-scanning` + `code-scanning-proof` are members of the required `ci` aggregate's `needs[]`; the reversal of the prior exclusion is documented | VERIFIED | `ci.yml:744-745` (needs list contains `code-scanning,` and `code-scanning-proof,`); rationale comments at `ci.yml:487-508` and `ci.yml:641-646`; drift guard `ci-e2e-coverage-guard.spec.ts` `describe('GATE-01/02...')` it #1 passes (`nx test`: 585/585) |
| 2 | GATE-01/D-03: on a non-fork PR a silent `produced=='false'` SARIF (atc + fallow) fails the `code-scanning` job loud; never fires on fork PR or push | VERIFIED | Two named steps at `ci.yml:611-623` gated `github.event_name == 'pull_request' && github.event.pull_request.head.repo.fork == false && steps.<id>.outputs.produced == 'false'`, static `echo "::error::..."` + `exit 1` bodies (no shell interpolation); drift guard it #3 anchors on `produced == 'false'` and passes |
| 3 | SC2/GATE-02/D-01/D-01a: `code-scanning` is un-path-gated (no `needs.changes.outputs.code` `if:`); `code-scanning-proof` stays PR-only + path-gated | VERIFIED | `code-scanning:` job (`ci.yml:548-550`) has `needs: changes` but no `if:`; `code-scanning-proof:` job (`ci.yml:656`) keeps `if: github.event_name == 'pull_request' && needs.changes.outputs.code != 'false'` byte-unchanged; drift guard it #2 (`.toBe(false)`) passes |
| 4 | D-05: the two "DELIBERATELY NOT" comment blocks and the `cve-lite` comment are reconciled with the new membership; the code-review WR-01 stale "Path-gated (D-08)" note on `code-scanning` is fixed | VERIFIED | `ci.yml:487-508` and `ci.yml:641-646` rewritten; `cve-lite` comment (`ci.yml:354-359`) states both `code-scanning` and `cve-lite` are now required gates; commit `5aff3a7` fixes the stale note (confirmed by reading the file -- the comment immediately above `code-scanning:` now reads "Un-path-gated (D-01)...") |
| 5 | D-06: additive-only vs `@0.2.3` / the phase's own start commit -- no `packages/angular-typechecker/src/**` runtime change, no `package.json`/manifest change, no version bump | VERIFIED | `git diff --stat 42295c7..HEAD -- . ':!.planning'` shows exactly 5 files: `ci.yml`, `AGENTS.md`, `README.md`, `ci-e2e-coverage-guard.spec.ts`, `code-scanning-docs.spec.ts` -- no `package.json`, no non-spec `src/**` file |
| 6 | GATE-02/D-04: AGENTS.md documents the human-run ruleset-enablement runbook (add rule for both tools, Evaluate first, probe two PR kinds, flip to Active, `enforcement: disabled` recovery, fork-PR deadlock accepted) and states the agent never flips the `main` ruleset | VERIFIED | `AGENTS.md` new `###` subsection (inserted between "Lockout recovery" and "Parallel execution in git worktrees") contains all 6 steps in the documented order and the opening "agent NEVER flips" statement; no `gh api` ruleset-mutating call present; `npx prettier --check AGENTS.md` passes |
| 7 | SC3/GATE-02: the ruleset is verified live in Evaluate mode, probed on throwaway PRs, then flipped to Active on `main` | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Runbook exists and is accurate (see truth 6), but the live steps have not been executed -- this is a human-only, real-CI-only action deferred until after this phase's PR merges (by design, D-04) |
| 8 | SC4/DOC-01: README documents the CodeQL-only "Scanned files" panel limitation in end-user language, citing the `run.artifacts`-inert spike evidence, no GitHub Issue filed | VERIFIED | `packages/angular-typechecker/README.md` new `#### The "Scanned files" panel stays empty (a GitHub limitation)` sub-subsection under `### SARIF and GitHub Code Scanning`, after `#### Run from the repository root` and before `## Storybook`; contains `Scanned files`, `a GitHub limitation`, `CodeQL`, `run.artifacts`; no Issue mentioned |
| 9 | DOC-01: a docs tripwire locks the README claim against drift | VERIFIED | `packages/angular-typechecker/src/code-scanning-docs.spec.ts` mirrors `angular-cli-docs.spec.ts`; asserts the exact heading on the raw string and the 4 tokens on the normalized-whitespace string; `nx test` passes (4/4 new its) |
| 10 | GATE-01 real-CI Nyquist point: the required `ci` aggregate goes RED on a genuine regression and GREEN otherwise, with both jobs as required members | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | This phase's own PR #55 (branch `gsd/v0.2.4-...`) currently shows `ci`=SUCCESS with `code-scanning`=SUCCESS and `code-scanning-proof`=SUCCESS as required members -- corroborates the GREEN-on-clean-PR half; the RED-on-regression half is real-CI-only and unexercised (no destructive test was run) |

**Score:** 8/10 truths verified (2 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.github/workflows/ci.yml` | `ci.needs[]` +code-scanning +code-scanning-proof; `code-scanning` path-gate removed; two `if:`-gated D-03 assertion steps; three reconciled comment blocks | VERIFIED | All four edits present and confirmed by direct read; Prettier-clean |
| `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` | New `describe('GATE-01/02...')` reusing `extractJobLines` | VERIFIED | Present, 3 `it`s, all pass, no new export/dependency |
| `AGENTS.md` | New ruleset-enablement runbook subsection | VERIFIED | Present, matches PLAN content exactly, Prettier-clean, no email/domain leak |
| `packages/angular-typechecker/README.md` | New `#### The "Scanned files" panel stays empty (a GitHub limitation)` sub-subsection | VERIFIED | Present, correct placement, contains all 4 tripwire tokens |
| `packages/angular-typechecker/src/code-scanning-docs.spec.ts` | New docs tripwire mirroring `angular-cli-docs.spec.ts` | VERIFIED | Present, mirrors shape exactly, 4 its, all pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `ci` aggregate `needs[]` | `code-scanning` / `code-scanning-proof` jobs | list-item membership | WIRED | Confirmed via direct read + drift guard regex (list-item anchored, not substring-trapped) |
| `code-scanning` job | D-03 assertion steps | `if:` expression + step id output | WIRED | `steps.atc-sarif.outputs.produced` / `steps.fallow-sarif.outputs.produced` referenced correctly; discriminated from the upload step's `produced == 'true'` gate |
| README DOC-01 prose | `code-scanning-docs.spec.ts` tripwire | exact heading + normalized-whitespace `.toContain` | WIRED | All 4 tokens present in README and asserted in the spec; non-vacuous (confirmed by reading both files) |
| AGENTS.md runbook | live `main` ruleset settings | human execution | NOT YET EXERCISED | Documentation exists and is accurate; the actual GitHub-side toggle has not been performed (expected -- deferred to post-merge human action per D-04) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Drift guard + docs tripwire pass | `npx nx test angular-typechecker` | 585 passed / 58 files (0 failed) | PASS |
| ci.yml / AGENTS.md / README / specs are Prettier-clean | `npx prettier --check .github/workflows/ci.yml AGENTS.md packages/angular-typechecker/README.md packages/angular-typechecker/src/code-scanning-docs.spec.ts packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` | "All matched files use Prettier code style!" | PASS |
| Lint clean | `npx nx lint angular-typechecker` | "All files pass linting" | PASS |
| No debt markers in changed files | `rg "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` over the 5 changed files | no matches | PASS |
| No email/domain leak in changed files | `rg "consensus\|@consensus\|lgbn"` over the 5 changed files | no matches | PASS |
| Real GitHub PR (#55) shows both Code Scanning jobs + `ci` aggregate green | `gh pr view --json statusCheckRollup` | `code-scanning`=SUCCESS, `code-scanning-proof`=SUCCESS, `ci`=SUCCESS | PASS (partial corroboration only -- see truth #10) |

### Probe Execution

SKIPPED -- no `scripts/*/tests/probe-*.sh` declared or found for this phase; PLAN/SUMMARY do not reference any probe script.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|--------------|--------|----------|
| GATE-01 | 36-01 | `code-scanning` job is a required member of the `ci` aggregate | NEEDS HUMAN | CI wiring fully committed and drift-guard-locked (truths 1-2, 4); the real-CI red/green Nyquist point (truth 10) is unexercised. Matches REQUIREMENTS.md's `[ ]` / "Pending" traceability -- correctly left open. |
| GATE-02 | 36-01 + 36-02 | GitHub "Require code scanning results" enabled on `main`, planning-only PRs not deadlocked | NEEDS HUMAN | CI-side un-path-gating (truth 3) and the AGENTS.md runbook (truth 6) are fully committed; the live ruleset enablement (truth 7 / SC3) has not been executed. Matches REQUIREMENTS.md's `[ ]` / "Pending" traceability -- correctly left open. |
| DOC-01 | 36-02 | README documents the CodeQL-only Scanned-files panel limitation | SATISFIED | Fully committed and locally verified (truths 8-9); matches REQUIREMENTS.md's `[x]` / "Complete" traceability. |

No orphaned requirements: all three IDs declared in the plans' `requirements:` frontmatter (36-01: GATE-01, GATE-02; 36-02: GATE-02, DOC-01) match REQUIREMENTS.md's Phase 36 traceability row exactly.

### Anti-Patterns Found

None blocking. Code review (`36-REVIEW.md`) found one WARNING (WR-01: stale "Path-gated (D-08)" comment contradicting the un-path-gated `code-scanning` job) which was fixed in commit `5aff3a7` -- confirmed fixed by direct read of the current file. One INFO (IN-01: `needs: changes` retained on the un-path-gated job) is a deliberate, documented, non-blocking choice with no silent-failure path (backstopped by the `ci` aggregate's own fail-set) -- left as-is per the reviewer's own analysis.

### Human Verification Required

#### 1. GATE-01 real-CI red/green Nyquist point

**Test:** Confirm the required `ci` aggregate goes genuinely RED when a real Code Scanning upload/infra failure or a PROOF-02 (SARIF -> Code Scanning contract) regression occurs, and stays GREEN on a clean PR, with `code-scanning` + `code-scanning-proof` as required members.
**Expected:** `ci` fails on a real regression, passes on a clean PR.
**Why human:** GitHub Actions ingestion and the aggregate's live verdict are provable only on GitHub. This phase's own open PR (#55) already shows `ci`=SUCCESS with both jobs SUCCESS, which corroborates the GREEN half; the RED-on-regression half was intentionally not exercised (no destructive test was run against a real PR) and mirrors the Phase 35 PROOF-01/02 precedent.

#### 2. GATE-02 human ruleset-enablement runbook

**Test:** Follow the AGENTS.md "Enabling the 'Require code scanning results' ruleset" runbook end-to-end: add the rule for both `angular-typechecker` and `fallow` -> Evaluate mode first -> push a `.planning/`-only probe PR and a code probe PR -> confirm Ruleset Insights shows neither would be blocked -> flip to Active.
**Expected:** Ruleset Active on `main`; neither PR kind blocked; `enforcement: disabled` recovery understood; fork-PR deadlock accepted as documented.
**Why human:** Enabling a `main` ruleset is an out-of-band, human-only, real-CI-only GitHub repo-settings action (D-04); the agent never performs this. Deferred to after this phase's PR merges, by design.

### Gaps Summary

No gaps. All locally verifiable must-haves (CI wiring, drift guards, comment reconciliation, additive-only audit, AGENTS.md runbook content, README DOC-01 subsection, docs tripwire) are VERIFIED and green in `nx test` / Prettier / lint. The two items left open (the real-CI red/green Nyquist point for GATE-01, and the human-run ruleset-enablement for GATE-02) are exactly the real-CI-only / human-only halves the phase's own design (D-04, mirroring the 35-03 PROOF-01/02 precedent) deliberately defers past this offline verification pass -- they are not implementation gaps, and REQUIREMENTS.md correctly leaves GATE-01/GATE-02 as "Pending" while DOC-01 is "Complete". Both executor SUMMARYs and the code-review report are consistent with this state; no discrepancy between SUMMARY claims and the actual codebase was found.

---

*Verified: 2026-07-22T02:15:00Z*
*Verifier: Claude (gsd-verifier)*
