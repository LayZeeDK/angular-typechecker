---
phase: 260714-1gr-apply-lever-1
verified: 2026-07-14T10:05:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
---

# Quick Task 260714-1gr: Apply Lever 1 (persist Verdaccio uplink cache) + re-measure Verification Report

**Goal:** APPLY Lever 1 (persist the Verdaccio uplink cache: `clearStorage:false` + a selective reset deleting only `storage/angular-typechecker` + `.htpasswd`) and RE-MEASURE the install-time delta. Defer actions/cache.
**Verified:** 2026-07-14
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `clearStorage:false` at BOTH registry global-setups | VERIFIED | install-e2e global-setup.ts:127, ng-cli-e2e global-setup.ts:138 -- both `clearStorage: false` in the `startLocalRegistry({...})` call |
| 2 | ONE shared `resetVerdaccioPublishState(root)` helper deletes ONLY `storage/angular-typechecker` + `storage/.htpasswd`, preserving siblings | VERIFIED | e2e-fixture.ts:20-28 -- two `rmSync` calls (angular-typechecker recursive+force, .htpasswd force); single impl in test-util, imported by both setups |
| 3 | Helper CALLED before `startLocalRegistry` in both setups, after the `NX_INVOCATION_ROOT_PID` delete | VERIFIED | install-e2e:115 delete -> :121 `resetVerdaccioPublishState(root)` -> :123 `startLocalRegistry`; ng-cli-e2e:126 -> :132 -> :134 |
| 4 | Full instrumented e2e run GREEN after the flip (token mint, no 409, no EPUBLISHCONFLICT, all isolation invariants) | VERIFIED | Orchestrator authoritatively confirmed both runs GREEN; MEASUREMENTS.md invariant table 37/7/4/9 both runs, no 409/EPUBLISHCONFLICT (re-run not permitted by task) |
| 5 | Report shows cold-vs-warm delta on the Verdaccio-routed subset with matrix flat control | VERIFIED | MEASUREMENTS.md Part 4: C-vs-W table (Verdaccio-routed +0.9%, matrix control +3.7% flat). Same-session delta is NULL BY DESIGN (clearStorage:false warms run C within itself); real win reported vs w87 baseline. Honest null accepted per task goal (measure + report honestly, not hit a predetermined figure) |
| 6 | The 4 now-false comments updated to describe the selective reset | VERIFIED | .verdaccio/config.yml:13-19 + :22-25; install-e2e global-setup.ts:88-96; ng-cli-e2e global-setup.ts:99-107 -- all describe clearStorage:false + resetVerdaccioPublishState |
| 7 | No package.json version mutation; no product/source change (test-harness + config-comment only) | VERIFIED | git show 1395e8d/5e88426/302f93c -- diffstat touches ONLY test-util (helper/spec/barrel), 2 global-setups, .verdaccio/config.yml. No package.json in any diff |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `libs/test-util/src/lib/e2e-fixture.ts` | `resetVerdaccioPublishState(root)` selective reset | VERIFIED | Lines 20-28, exported, RESEARCH doc-comment (WHY + first-run no-op) intact; existing helpers untouched |
| `libs/test-util/src/lib/e2e-fixture.spec.ts` | Unit proof: deletes ONLY the two, preserves siblings, first-run no-op | VERIFIED | Seeds `other-pkg/` + `.verdaccio-db.json` siblings (lines 44-46) and asserts both SURVIVE (55-57); asserts angular-typechecker + .htpasswd removed (51-52); first-run no-op test (60-65). 2 tests pass |
| `libs/test-util/src/index.ts` | Barrel re-export | VERIFIED | Line 13 re-exports `resetVerdaccioPublishState` from `./lib/e2e-fixture` |
| `e2e/angular-typechecker-install-e2e/src/global-setup.ts` | clearStorage:false + call + comment | VERIFIED | import :9, comment :117-120, call :121, `clearStorage: false` :127 |
| `e2e/angular-typechecker-ng-cli-e2e/src/global-setup.ts` | clearStorage:false + call + comment | VERIFIED | import :9, comment :128-131, call :132, `clearStorage: false` :138 |
| `.verdaccio/config.yml` | Comments updated (no longer claim clear:true wipes storage) | VERIFIED | Storage comment :13-19 (clear:false, cache persists), htpasswd comment :22-25 (resetVerdaccioPublishState deletes it) |
| `260714-1gr-MEASUREMENTS.md` | cold/warm tables, matrix flat control, vs-w87 win, Windows caveat, actions/cache follow-up | VERIFIED | All sections present: COLD+WARM tables, Part 4 delta + matrix control, flagship ng-cli yarn line 93.4s->53.5s->44.7s, Windows arm64/Defender caveat, Part d deferred actions/cache recipe |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| both global-setups | `resetVerdaccioPublishState` | import from `@workspace/test-util` + call after NX_INVOCATION_ROOT_PID delete, before startLocalRegistry | WIRED | Both import at line 9 and call at :121 / :132 respectively |
| `resetVerdaccioPublishState` | `<root>/tmp/local-registry/storage` | rmSync of angular-typechecker (recursive) + .htpasswd | WIRED | e2e-fixture.ts:23-27 |
| `260714-1gr-MEASUREMENTS.md` | w87 baseline | cold-vs-warm delta compared vs w87 cold baseline | WIRED | Part 4 table (w87 797099 -> C 536416 / W 541068) + flagship yarn line vs w87 93427 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Helper unit spec (selective delete + sibling preservation + first-run no-op) | `NX_DAEMON=false npx nx test test-util --skip-nx-cache` | 9/9 pass (e2e-fixture.spec.ts 2/2) | PASS |
| e2e tier green (invariants survive flip) | not re-run per task instruction (~23 min) | orchestrator-confirmed GREEN both runs | SKIP (delegated) |

### Anti-Patterns Found

None. No unreferenced debt markers (TBD/FIXME/XXX) introduced. `TODO`-style comments not present in the changed files. The two `rmSync` calls use `force: true` (documented first-run no-op, not a swallowed error). No hardcoded-empty stubs -- the helper and spec are substantive.

### Additive / Release Safety

- 3 commits (1395e8d / 5e88426 / 302f93c) touch ONLY test-util (helper + spec + barrel), the 2 e2e global-setups, and `.verdaccio/config.yml`. No package.json version mutation (confirmed absent from all diffs).
- No product/source change. actions/cache NOT implemented -- deferred to a documented turnkey follow-up in MEASUREMENTS.md Part d (no `.github/workflows/` change in any commit).
- Reversibility: `clearStorage:false -> true` in both files + remove the two helper calls (one-line-per-file revert).

### Gaps Summary

None. The one nuance -- truth #5's plan wording anticipated a same-session "cold > warm" delta, but the measured same-session delta is ~null (+0.9% Verdaccio-routed, within the +3.7% matrix control noise) -- is CORRECT goal achievement, not a gap. `clearStorage:false` warms run C within itself (install-e2e's 11 specs + ng-cli share one persistent cache after the first fetch), so run W has nothing left to warm; the win is banked inside a single run and is honestly evidenced vs the w87 wipe-per-project baseline (flagship ng-cli yarn `corepack yarn install` 93.4s -> 53.5s COLD -> 44.7s WARM = -43%/-52%, far exceeding the ~27% environmental control). The task's stated goal is APPLY + RE-MEASURE + report honestly, which is fully met. The larger cross-run win is the correctly-deferred actions/cache follow-up.

---

_Verified: 2026-07-14T10:05:00Z_
_Verifier: Claude (gsd-verifier)_
