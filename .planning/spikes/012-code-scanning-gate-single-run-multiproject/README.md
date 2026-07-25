---
spike: 012
name: code-scanning-gate-single-run-multiproject
type: diagnostic
gate: [GATE-02]
validates: "Given GitHub's 'Require code scanning results' ruleset listing angular-typechecker as a required Code Scanning tool on the PR-only, empty-bypass main branch, when the dogfood code-scanning job uploads its (multi-run, default merge-ref) SARIF on a PR, then the gate is SATISFIED (not permanently blocked with '1 configuration not found') and neither a planning-only PR nor a code PR is deadlocked."
verdict: RESOLVED
resolution: "The gate WORKS with the existing setup; the ONLY blocker was an ORPHANED angular-typechecker Code Scanning config left on main by a category rename. Deleting the orphaned analyses via the Code Scanning API fixed it -- no ci.yml change."
related: []
tags: [code-scanning, sarif, ruleset, merge-gate, orphaned-config, category-rename, gate, gate-02, ci]
---

# Spike 012: the angular-typechecker Code Scanning merge gate (GATE-02) works -- the blocker was an orphaned config

> Note: the directory slug (`...-single-run-multiproject`) reflects the ORIGINAL working
> hypothesis (single-run vs multi-run SARIF), which this spike DISPROVED. The actual root
> cause was an orphaned Code Scanning config -- see below.

## What This Validates

GATE-02 asks: can GitHub's "Require code scanning results" ruleset require an
`angular-typechecker` Code Scanning analysis on the PR-only, empty-bypass `main` branch
WITHOUT permanently deadlocking every PR, given the dogfood `code-scanning` job's existing
(multi-run, no-`category`-input, default merge-ref) SARIF upload?

Every prior attempt to enable the gate failed the SAME way: the required-tool check reported
**"1 configuration not found"** and blocked the merge, even on PRs whose CI clearly uploaded
an `angular-typechecker` analysis. The question this spike answered was WHY -- and whether the
gate is viable at all (an earlier session wrongly concluded it was not).

## Root Cause (the finding)

**The blocker was an ORPHANED Code Scanning config on `main`, not the SARIF shape or the upload
mechanics.**

GitHub's "Require code scanning results" gate matches each required tool by its
`(analysis_key, category, environment)` **tuple**, NOT by tool name. An earlier phase (Phase 34)
renamed the dogfood SARIF category `angular-typechecker` -> `angular-typecheck`. That rename left
the OLD `angular-typechecker`-category config **orphaned** on `refs/heads/main`: a tuple the gate
still counted as a "configured" required tool, but which no current PR upload could ever
reproduce. A required tool with an unreproducible config blocks EVERY PR permanently.

**KEY DISTINCTION:** "configuration not found" is **transient** for a LIVE config (it clears the
moment CI uploads a matching analysis) but **permanent** for an ORPHANED one. Recognizing that
distinction was the whole game.

**Fix:** delete the orphaned analyses via the Code Scanning API
(`DELETE /repos/{owner}/{repo}/code-scanning/analyses/{id}` -- 4 orphaned analyses removed). The
gate then passes with the EXISTING CI setup. **NO `ci.yml` change was needed.**

## Red Herrings Burned (do not repeat)

| Hypothesis | Why it looked right | Why it was wrong |
|------------|--------------------|--------------------|
| Single-run vs multi-run SARIF | The dogfood job uploads a merged multi-run file; a "the gate can't read multi-run" theory fit the symptom | Disproven: a single-run experiment (shipped to `main` as `41ac49a`, later reverted as `44e4306`) did NOT fix the block. Multi-run is fine. |
| head-ref vs merge-ref upload | `upload-sarif` defaults; maybe the gate reads a different ref | Disproven: the default (merge-ref) upload satisfies the gate once the orphan is gone. |
| "GitHub product limitation" (roadmap #847) | An open-looking roadmap item seemed to explain a third-party gap | Wrong: #847 is CLOSED/GA; the feature works for third-party tools. A GA feature "failing" is a config issue on our side. |

## Outcome

- **GATE-02 = RESOLVED (the gate WORKS).** Proven on probe PRs **#64** (planning-only -- the
  un-path-gated dogfood job produces an analysis, no deadlock) and **#65** (code PR -- analysis +
  the proof tool); both check = success ("No new alerts").
- The "Require code scanning results" ruleset (`18229122`) is **ACTIVE on `main`** with
  `angular-typechecker` + CodeQL as the required Code Scanning tools (user-authorized this
  session). `fallow` and `angular-typechecker-red-proof` are intentionally kept OFF the required
  list (see the AGENTS.md GATE-02 runbook).
- Enablement is a human-only, real-CI-only action; the runbook (with the orphan-cleanup
  prerequisite) lives in `AGENTS.md` -> "Enabling the 'Require code scanning results' ruleset".

## Diagnostic Method (reproduction, if this recurs)

For any Code Scanning merge-gate "configuration not found" failure, FIRST check for orphaned
base-branch configs before touching SARIF shape or upload flags:

```
# List the tool's analyses on main and look for a category no current PR reproduces
gh api "repos/{owner}/{repo}/code-scanning/analyses?tool_name=angular-typechecker&ref=refs/heads/main"
# Delete each orphaned analysis id (follow next_analysis_url for ordering;
# the LAST analysis in the set needs ?confirm_delete=true or it returns HTTP 400)
gh api -X DELETE "repos/{owner}/{repo}/code-scanning/analyses/{id}"
gh api -X DELETE "repos/{owner}/{repo}/code-scanning/analyses/{last_id}?confirm_delete=true"
```

References: community discussion #153284, github/codeql #18506, microsoft/hve-core #248.

## Follow-ups (tracked, out of this spike)

- Fix the separate `fallow` file-less SARIF upload bug (`locationFromSarifResult: expected at
  least one location`) -- LOW urgency; rare; fallow is not a required gate tool.

## Anti-patterns (do NOT repeat)

- Chasing SARIF shape (single-run/multi-run, head-ref/merge-ref) for a "configuration not found"
  gate failure. Check for orphaned base-branch configs FIRST.
- Concluding "GitHub limitation" without verifying the cited issue's STATE (a GA feature failing
  is a config issue on our side).
- Live-toggling the active `main` ruleset to diagnose. Add-verify-rollback with a CodeQL-only
  backup ready; never leave a misbehaving gate on the empty-bypass `main`. (This was
  user-authorized this session only.)
