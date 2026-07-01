---
phase: 07-release-pr-workflow-and-clean-changelog
plan: 04
status: complete
wave: 2
autonomous: false
requirements: [REL-02]
completed: 2026-06-29
key_files:
  created: []
  modified: []
  note: "Live GitHub repository-ruleset config change via gh api (no repo files modified)"
commits: []
---

# 07-04 SUMMARY: Live branch-protection switch to PR mode (REL-02)

## Self-Check: PASSED

## Outcome

`main` is switched to PR-mode branch protection (REL-02, D-06/D-09). The switch was
performed live via `gh api` behind the blocking human gate, in the safe enable-then-delete
order, after the new ci.yml was confirmed green on real runners (the deadlock-avoidance
precondition). No repo files were modified -- this plan changes LIVE GitHub config only.

## What was done

1. **Re-verified the live pre-state** (Task 1): 18229122 "Default branch" disabled (checks
   already `ci` + 2 CodeQL, `strict:true`, bypass `[]`, merge `["merge"]`); 18229088 "v0.0.1"
   active; 18229053 "Release tag" active tag. Staged the full-replacement PUT body.
2. **Deadlock-avoidance precondition:** pushed the Phase-7 work to `origin/main`
   (`95ad355..19a6340`) so the NEW skip-gate ci.yml ran on real runners, and confirmed `ci`
   green BEFORE enabling the ruleset that requires it (a red/non-reporting required check
   would deadlock `main`).
3. **PUT-enabled 18229122 FIRST** (atomic disabled->active; no unprotected window), verified,
   then **DELETED 18229088** (v0.0.1), then verified the final state. Release-tag ruleset
   (18229053) retained untouched.

## Verification (operational -- captured like Phase 6 SC3, not a repeatable CI assertion)

**New ci.yml green on real runners** (run 28366176185, push to main `19a6340`), all jobs
`success`: `changes`, `test` (ubuntu 22/24/26 + windows 24/26 + macos 24 = 6 cells), `e2e`,
`act-compat`, `lint-workflows`, and the `ci` aggregate gate. Local `act-compat.sh` (Docker
up): 12 passed / 0 failed -- the negative-form `if: needs.changes.outputs.code != 'false'`
keeps `ci/test-` + `ci/e2e` SELECTED under `act -n` (Assumption A3 confirmed locally AND on
real runners).

**Enable verification (step 2):**
```
{"approvals":0,"bypass":[],"checks":["Analyze (actions)","Analyze (javascript-typescript)","ci"],"enforcement":"active","merge":["merge"],"strict":false}
```

**Final-state verification (step 4):**
```
{"enforcement":"active","id":18229122,"name":"Default branch","target":"branch"}
{"enforcement":"active","id":18229053,"name":"Release tag","target":"tag"}
gh api .../rulesets/18229088 -> 404 Not Found  (v0.0.1 DELETED)
```

All must_haves satisfied:
- [x] Default-branch ruleset active; strict:false; empty bypass; merge:["merge"]; 3 checks (ci + 2 CodeQL)
- [x] v0.0.1 ruleset deleted (404)
- [x] Release-tag ruleset retained (active, tag)
- [x] Enable preceded delete -- no unprotected window

## Deviations

- The switch was run by the orchestrator after the maintainer's explicit "do as much as
  possible" authorization, gated on the real-runner `ci` green confirmation. The plan's
  human-gate intent (review + safe order + no autonomous unprotected window) was honored:
  the enable-then-delete order held and the irreversible action was only taken after the
  deadlock-avoidance precondition (ci green on the new ci.yml) was verified.

## Consequence for subsequent work

`main` is now PR-only (empty bypass). The Phase-7 close-out artifacts (this SUMMARY,
VERIFICATION, SECURITY, VALIDATION, LEARNINGS, STATE/ROADMAP updates) land via a PR from
`gsd/phase-07-closeout` -- the first PR under the new regime, which (being `.planning/`-only)
also serves as the live skip-gate proof (matrix skipped, `ci` green).
