---
quick_id: 260725-73m
verified: 2026-07-25T06:50:00Z
status: human_needed
score: 12/12 truths verified (all local/codebase-provable claims hold; 8 human-gated actions remain, by design)
behavior_unverified: 0
overrides_applied: 0
must_haves:
  truths_total: 12
  truths_verified: 12
  artifacts_total: 5
  artifacts_verified: 5
  key_links_total: 5
  key_links_verified: 5
human_verification:
  - test: "Relax the CodeQL leg of the 'Require code scanning results' rule (temporarily remove CodeQL from required-tools, keep angular-typechecker required)"
    expected: "The main ruleset's required status-check contexts (Analyze (actions), Analyze (javascript-typescript), ci) are unaffected; only the Code-Scanning-results CodeQL leg is relaxed for the duration of the migration"
    why_human: "Repository security-configuration change on the gate guarding main -- AGENTS.md reserves this for the maintainer via the GitHub UI; the agent must never flip a main ruleset via gh api or any automated call"
  - test: "Disable CodeQL default setup (Security -> Code scanning -> CodeQL analysis row -> Switch to advanced -> Disable CodeQL) BEFORE pushing this branch"
    expected: "code-scanning/default-setup reports state other than configured; this must happen before the push because codeql.yml's pull_request trigger is unfiltered and fires the instant a PR opens, and both setups would then upload the identical category to the same ref and collide"
    why_human: "Disabling/switching a CodeQL setup is classified in AGENTS.md as the same human-only security-configuration class as ruleset edits (item 7 / the extended human-only sentence at line 251-258)"
  - test: "Push chore/codeql-advanced-setup-setup-node-v7 and open the PR into main"
    expected: "ci is green and both Analyze (actions) / Analyze (javascript-typescript) checks appear and go green -- the first real proof the rendered check names match the ruleset's required contexts byte-for-byte"
    why_human: "main is PR-only with an empty bypass list; only a human merges via the GitHub UI, and this is the first REAL-CI-ONLY proof point (rendered check names, SARIF ingestion) that cannot be produced locally"
  - test: "Merge the PR as a merge commit (the repo's only allowed merge method)"
    expected: "The push-to-main run of codeql.yml produces the FIRST advanced-setup CodeQL analyses on main, with analysis_key .github/workflows/codeql.yml:analyze"
    why_human: "Merging to main is a human action under the PR-only ruleset"
  - test: "Delete the orphaned default-setup CodeQL analyses on main (GET .../code-scanning/analyses?tool_name=CodeQL&ref=refs/heads/main, DELETE each whose analysis_key is dynamic/github-code-scanning/codeql:analyze, following next_analysis_url, ?confirm_delete=true on the last one) -- ONLY after step above confirms a live advanced-setup analysis exists"
    expected: "The stale default-setup config tuple no longer exists on main; CodeQL's live config is exclusively the advanced-setup one"
    why_human: "Irreversible Code Scanning API deletion; AGENTS.md step 0 explicitly reserves this and warns that deleting too early makes CodeQL 'not configured' -- a PERMANENT block on an empty-bypass main"
  - test: "Re-add CodeQL to the 'Require code scanning results' required-tools list with its original threshold (errors / high_or_higher)"
    expected: "Full enforcement restored -- both angular-typechecker and CodeQL required again"
    why_human: "Same ruleset-editing action class as the first item"
  - test: "Verify on a throwaway probe PR (planning-only + code) that both Analyze (*) checks report with no 'configuration not found', then verify on a real Dependabot PR (re-run or reopen #59) that the checks now appear"
    expected: "No missing-configuration warning; Dependabot PR's Analyze (*) checks report green"
    why_human: "REAL-CI-ONLY proof -- SARIF ingestion, ruleset evaluation, and Dependabot-PR check reporting are provable only on GitHub, never locally"
  - test: "Close Dependabot PR #46 with a comment that the bump was applied by hand in this PR"
    expected: "PR #46 closed, cross-referencing the merged replacement PR"
    why_human: "Filing/closing PRs is a GitHub-side action; also this repo's CLAUDE.md-level policy keeps such actions maintainer-initiated"
---

# Quick Task 260725-73m Verification Report

**Task Goal:** Handle Dependabot #46 (actions/setup-node 6.4.0 -> 7.0.0 with a pinned SHA),
harden release.yml with `package-manager-cache: false`, delete release.yml's dead
`always-auth` step, add `.github/workflows/codeql.yml` (CodeQL advanced setup) so
Dependabot PRs stop being permanently unmergeable, and correct + reconcile the AGENTS.md
GATE-02 runbook.

**Verified:** 2026-07-25T06:50:00Z
**Branch:** `chore/codeql-advanced-setup-setup-node-v7`, 5 commits, unpushed
(`git rev-list --left-right --count origin/main...HEAD` -> `0 5`)
**Status:** `human_needed`

## Scoping note (honored)

Per the plan's "Local vs REAL-CI-ONLY proof boundary" and this verification's explicit
instructions: the migration is deliberately NOT LIVE. Default setup is still
`state: configured` on GitHub (last known state per RESEARCH/REVIEW, unchanged by any
commit on this branch), the branch is unpushed, and `codeql.yml` has never run. That is BY
DESIGN -- disabling default setup, editing the ruleset, and deleting orphaned Code Scanning
analyses are maintainer-only actions. This report does NOT treat the un-run migration as a
gap. It verifies instead that the repo text honestly describes the migration as pending
(it does -- see truth 8/9 below) and lists the maintainer's remaining actions as
`human_needed` items, not gaps, per instruction.

`bash tools/act/act-compat.sh` was re-run and reproduces the documented pre-existing
8-passed/11-failed result (all 11 failures are `ci/*` tokens dropped by the missing-Docker
`ci/changes` failure; none mention `codeql`) -- confirmed not attributable to this task.

## Observable Truths (12/12 from PLAN.md frontmatter)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | All 10 `actions/setup-node` refs pin the v7.0.0 SHA `820762786026740c76f36085b0efc47a31fe5020`; zero v6.4.0 pins remain | VERIFIED | `git grep -c` -> `ci.yml:9`, `release.yml:1` (10 total); old pin `48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e` absent under `.github/` (exit 1). SHA independently confirmed `== refs/tags/v7.0.0` via live `git ls-remote --tags https://github.com/actions/setup-node` |
| 2 | `release.yml` no longer carries the `always-auth` sed step; `registry-url` + tokenless-OIDC comments byte-intact | VERIFIED | `git grep -n always-auth -- .github` exit 1 (absent); `registry-url: https://registry.npmjs.org/` present (count 1); diff shows only the setup-node pin line and the sed-step deletion touched, `NPM_CONFIG_PROVENANCE`/tag-ref gate untouched |
| 3 | `release.yml`'s setup-node step declares `package-manager-cache: false`; absent from ci.yml | VERIFIED | `git grep -c "package-manager-cache: false" -- release.yml` -> 1; `git grep -n "package-manager-cache" -- ci.yml` exit 1; ci.yml's 9 `cache: npm` steps unchanged (count still 9) |
| 4 | `.github/workflows/codeql.yml` exists; `analyze` job renders EXACTLY `Analyze (actions)` / `Analyze (javascript-typescript)` | VERIFIED | File read; `name: Analyze (${{ matrix.language }})` + matrix `[actions, javascript-typescript]`; both matrix cells confirmed present in `act pull_request -n` and `act push -n` dry-run plans (`codeql/Analyze (actions)`, `codeql/Analyze (javascript-typescript)`) |
| 5 | `codeql.yml` triggers on `pull_request`, `push` to `main`, and a weekly `schedule` | VERIFIED | File read: `pull_request: {}`, `push: branches: [main]`, `schedule: - cron: '27 4 * * 1'` |
| 6 | Every action in `codeql.yml` is 40-hex SHA-pinned; `init`/`analyze` reuse the SAME codeql-action SHA ci.yml pins for `upload-sarif` | VERIFIED | `checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0` (confirmed `== refs/tags/v7.0.0` live); `init`/`analyze@7188fc363630916deb702c7fdcf4e481b751f97a` matches `ci.yml:647,656,777` `upload-sarif@7188fc363630916deb702c7fdcf4e481b751f97a` exactly (confirmed `== refs/tags/v4.37.1^{}` live) |
| 7 | `codeql.yml` reproduces default setup exactly: matrix `[actions, javascript-typescript]`, `build-mode: none`, `category: /language:${{matrix.language}}` | VERIFIED | File read, matches byte-for-byte |
| 8 | AGENTS.md item 6 states the TRUE mechanism (proven on #46; default setup's `dynamic` event was the cause) and preserves the honest evidence boundary | VERIFIED | Read AGENTS.md:331-367. States the token-half proof, the fork/non-fork distinction (`head.repo.fork=false` for #46), restores the still-true fork-block conclusion via ci.yml's own `fork == false` gate, and explicitly marks GitHub's fork-upload acceptance as untested |
| 9 | GATE-02 runbook RECONCILED: intro names `codeql.yml`, STATUS records the migration as pending (not done), step 0 generalizes orphaning to any tuple-component change, step 1 notes the new source, item 7 records why + ordering | VERIFIED | Read AGENTS.md:224-386 in full. STATUS explicitly says "COMMITTED but NOT YET LIVE ... default-setup analyses on main are LIVE, NOT orphaned, and must NOT be deleted" -- the critical liveness-honesty bar this whole task turns on |
| 10 | Runbook steps 2/3/4/5 BYTE-UNCHANGED; `Do NOT add fallow`/`NEVER add red-proof`; step 0's TRANSIENT/PERMANENT + deletion mechanics preserved | VERIFIED | Independent section-scoped SHA-256 re-derivation (not a whole-file match, per the tooling warning): steps 2/3/4/5 hash to `7292cefa3d31`, `c88929c1fa27`, `bc558b4b5c42`, `664eca4e915c` -- exactly the values given in this verification's brief and matching origin/main. File suffix from `## Parallel execution` hashes to `1f62ba276c91`, unchanged. `confirm_delete=true`, `next_analysis_url`, `angular-typechecker-red-proof`, `TRANSIENT` all present (`git grep -c`, all non-zero) |
| 11 | Every human-only rule preserved or strengthened; agent still NEVER flips a ruleset; disabling CodeQL default setup added to the same human-only class | VERIFIED | AGENTS.md:251-258: "The agent NEVER flips the `main` ... ruleset ... via `gh api` or any automated call, and that same prohibition covers changing a CodeQL setup -- disabling default setup, or switching default -> advanced, is likewise ... human-only." Extension only, nothing removed |
| 12 | Prettier and `act --validate` green across all three workflows; no `ci.yml` aggregate change; no ruleset edit required | VERIFIED | `npx prettier --check AGENTS.md .github/workflows/{ci,release,codeql}.yml` -> clean; `act --validate` exit 0; `ci.yml` diff vs origin/main is exactly 9 pin-bump lines, nothing else (`ci` aggregate job untouched) |

**Score:** 12/12 truths verified (all codebase/local-provable claims hold).

## Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `.github/workflows/ci.yml` | 9 setup-node pins bumped (plan frontmatter mislabels this "10" -- see note) | VERIFIED | Diff vs origin/main: exactly 9 lines changed, all pin bumps |
| `.github/workflows/release.yml` | 1 pin bumped + `package-manager-cache: false` added + dead `always-auth` step deleted | VERIFIED | Diff confirms all three changes, nothing else |
| `.github/workflows/codeql.yml` | NEW -- CodeQL advanced setup | VERIFIED | Exists, Prettier-clean, act-parseable, matrix cells confirmed in dry-run plans |
| `AGENTS.md` (lines 224-308 originally, now 224-386 after insertions) | Item 6 rewritten + GATE-02 runbook reconciled | VERIFIED | All diff hunks fall inside the GATE-02 section (`git diff` hunk headers: 226, 248, 301, 328) |
| `260725-73m-REVIEW.md` | gsd-code-reviewer's in-task review of the AGENTS.md change | VERIFIED (exists) with a process note -- see below | 2 critical + 4 important + 3 suggestion findings, all fixed in `3e9bf87`; re-review then surfaced 4 NEW findings (N1-N4), fixed in follow-up commit `1b10f3d` -- see note |

**Note on the artifact-list mislabeling:** the plan's `must_haves.artifacts` line reads
"`.github/workflows/ci.yml` (10 setup-node pins bumped)" -- the true count for ci.yml alone
is 9 (10 is the cross-file total, matching truth 1 and the plan's own body text at lines
62/124). This is a plan-authoring label inconsistency, not a codebase defect; the code is
correct.

**Note on the review-fix loop (process observation, not a gap):** `260725-73m-REVIEW.md`'s
own frontmatter ends at `re_review.status: resolved_with_new_findings` (4 new findings: N1
Important, N2 Important, N3/N4 Suggestion) -- i.e., as recorded in that file, not every
finding was yet resolved. Commit `1b10f3d` ("fix tense and pin the disable-before-push
ordering") was authored after that re-review to address exactly N1-N4, but no THIRD
independent review pass exists confirming those fixes. I independently re-verified `1b10f3d`
against each of the reviewer's four prescribed fixes (`git diff 3e9bf87 1b10f3d`) and confirm
all four landed as prescribed (N2's disable-before-push framing, N3's job-name-warning
hoisted out of the conditional, N1/N4's tense corrections in `codeql.yml`). Content-wise this
is sound; procedurally, the dedicated reviewer never re-certified this specific commit. Not
treated as a gap because the content is independently confirmed correct here, but noted for
awareness -- a human closing this task may want a quick fourth glance at `1b10f3d` alone.

## Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `codeql.yml`'s `analyze` job `name: Analyze (${{ matrix.language }})` | `main` ruleset's required status-check contexts | Byte-exact job-name rendering | WIRED | Confirmed via `act pull_request -n` / `act push -n` dry-run plans showing `codeql/Analyze (actions)` and `codeql/Analyze (javascript-typescript)`; byte-match against the two required contexts documented in RESEARCH/REVIEW's live ruleset read |
| `codeql.yml`'s `category: /language:<lang>` | Default setup's categories | Deliberately identical | WIRED | File read confirms `/language:${{matrix.language}}`, matching RESEARCH section 3's captured default-setup categories |
| `codeql.yml`'s `init`/`analyze` SHA | ci.yml's `upload-sarif` SHA | Same codeql-action pin | WIRED | Both `7188fc363630916deb702c7fdcf4e481b751f97a`, confirmed by `git grep` across both files |
| `release.yml`'s `registry-url` | npm OIDC trusted-publisher detection | e2e `release-hygiene` spec assertion | WIRED | `e2e/angular-typechecker-install-e2e/src/release-hygiene.e2e.spec.ts:259-273` asserts `registry-url: https://registry.npmjs.org/?` stays; unaffected by this branch's diff (only the pin value and the new `package-manager-cache` line changed in that step's `with:` block) |
| `codeql.yml`'s `pull_request` trigger | Code scanning's documented upload exemption for Dependabot/fork runs | Design/comment-level | WIRED (design), UNTESTED (behavior) | Trigger present in the file; the actual SARIF-upload behavior on a Dependabot/fork PR is explicitly REAL-CI-ONLY and correctly left untested per the plan's proof boundary |

## Behavioral Spot-Checks / Local Gates

| Check | Command | Result | Status |
| --- | --- | --- | --- |
| Prettier | `npx prettier --check AGENTS.md .github/workflows/{ci,release,codeql}.yml` | "All matched files use Prettier code style!" | PASS |
| act validate | `act --validate` | exit 0 (only a docker-connection warning, expected on this machine) | PASS |
| act dry-run (pull_request) | `act pull_request -n ... \| rg "codeql/Analyze"` | both matrix cells present | PASS |
| act dry-run (push-main) | `act push -n ... \| rg "codeql/Analyze"` | both matrix cells present | PASS |
| act-compat suite | `bash tools/act/act-compat.sh` | 8 passed, 11 failed -- all 11 are pre-existing `ci/*` Docker-dependent failures, none mention codeql (re-verified in this session, matches SUMMARY's isolation test) | PASS (pre-existing, out of scope) |
| Unit tests | `npx nx test angular-typechecker --skip-nx-cache` | 592/592 passed, 58 test files | PASS |
| scoped-name-guard | `npx nx scoped-name-guard angular-typechecker` | 4/4 passed | PASS |
| format:check | `npx nx format:check --base=origin/main --head=HEAD` | exit 0 | PASS |
| Upstream SHA verification | `git ls-remote --tags` for setup-node, checkout, codeql-action | `820762786026740c76f36085b0efc47a31fe5020 refs/tags/v7.0.0`; `9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 refs/tags/v7.0.0`; `7188fc363630916deb702c7fdcf4e481b751f97a refs/tags/v4.37.1^{}` | PASS |
| Scope containment | `git diff origin/main HEAD --stat` | exactly 4 files: `ci.yml`, `release.yml`, `codeql.yml` (new), `AGENTS.md` | PASS |
| No deletions | `git diff --diff-filter=D --name-only 2daf7fb..HEAD` | empty | PASS |

## Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX` markers, no placeholder returns, no stub handlers introduced by
this branch's diff. The `always-auth` step removed was itself confirmed dead code (0 hits in
both v6.4.0 and v7.0.0 shipped `dist/setup/index.js`, per RESEARCH section 4).

## Requirements Coverage

Not applicable -- this is a quick task (no `requirements:` frontmatter field, no
`.planning/REQUIREMENTS.md` phase mapping expected for quick tasks).

## Human Verification Required

The 8 items below are the plan's own "Human-gated runbook," which the executor correctly
did NOT perform (repository security-configuration changes and irreversible Code Scanning
API deletions are maintainer-only per AGENTS.md). They are listed here as the deliberate
remainder, not as gaps in this task's work. See the YAML frontmatter `human_verification`
list for the structured form; narrative below.

1. **Relax the CodeQL leg of the ruleset** -- temporarily remove `CodeQL` from the
   "Require code scanning results" required-tools list (keep `angular-typechecker`
   required). Why human: ruleset edit, agent-prohibited.
2. **Disable CodeQL default setup, BEFORE pushing this branch** -- Security -> Code
   scanning -> CodeQL analysis row -> Switch to advanced -> Disable CodeQL. Why human:
   same security-configuration class as a ruleset edit; ordering matters because
   `codeql.yml`'s `pull_request` trigger is unfiltered and fires on push+PR-open, not at
   merge.
3. **Push the branch and open the PR** -- confirm `ci` green and both `Analyze (*)`
   checks appear and go green. Why human: `main` is PR-only with an empty bypass list;
   this is also the first REAL-CI-ONLY proof of byte-exact check-name matching.
4. **Merge as a merge commit** -- produces the first live advanced-setup analyses on
   `main`. Why human: merge action on the protected branch.
5. **Delete the orphaned default-setup analyses**, only after step 4's live analyses
   exist -- via the Code Scanning API, following `next_analysis_url`,
   `?confirm_delete=true` on the last one. Why human: irreversible API deletion,
   explicitly maintainer-only per AGENTS.md step 0.
6. **Re-add `CodeQL` to the required-tools list** at its original threshold. Why human:
   ruleset edit.
7. **Verify on probe PRs and a real Dependabot PR** (re-run/reopen #59) that both checks
   report cleanly with no "configuration not found." Why human: REAL-CI-ONLY (SARIF
   ingestion, ruleset evaluation, Dependabot-triggered check reporting cannot be proven
   locally).
8. **Close Dependabot PR #46** with a note that the bump landed by hand. Why human:
   GitHub PR action.

## Gaps Summary

No gaps. Every locally/codebase-provable must-have (12 truths, 5 artifacts, 5 key links)
verified against the actual repository state, independent of SUMMARY/REVIEW claims:
pin bumps confirmed by `git grep` and cross-checked against live upstream tag SHAs;
`codeql.yml` confirmed to render the exact required check names via `act` dry-runs;
AGENTS.md's GATE-02 reconciliation independently re-derived by section-scoped hashing
(steps 2-5 unchanged, item 6/7/STATUS/intro updated); all local gates (Prettier, act
--validate, unit tests, scoped-name-guard, format:check) green. The task's own
scope-defined REAL-CI-ONLY items (byte-exact check-name matching on GitHub, SARIF
ingestion, ruleset evaluation, Dependabot/fork check reporting) remain correctly
unproven and are not held against this task, per the plan's explicit proof boundary.
The one process nuance noted above (no third-pass independent review of commit
`1b10f3d`) was independently closed by this verification's own re-derivation of the diff
against the reviewer's four prescribed fixes, and is not blocking.

---

_Verified: 2026-07-25T06:50:00Z_
_Verifier: Claude (gsd-verifier)_
