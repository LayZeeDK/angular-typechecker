---
phase: 260714-gja-apply-safe-install-flags
verified: 2026-07-14T00:00:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
---

# Quick Task 260714-gja Verification Report

**Task Goal:** Apply fidelity-safe LOCAL e2e install-perf flags to the direct-install sites and measure the delta vs the 1gr warm baseline; document measure-only/rejected levers. APPLY + MEASURE.
**Verified:** 2026-07-14
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | 11 direct npm install sites carry `--no-audit --no-fund --prefer-offline`; 2 pnpm carry `--prefer-offline`; nowhere else | VERIFIED | `git grep`: `--no-audit`=11, `--no-fund`=11, `--prefer-offline`=13 (11 npm + nx-add-pnpm:142, ng-add-ng-run-pnpm:246). Every `--no-audit` line is an `npm install` line; both pnpm sites are `sh('pnpm install --prefer-offline', ...)` (only --prefer-offline, not the npm set) |
| 2 | nx add / ng add / `corepack yarn install` carry NO added perf flags | VERIFIED | Both `corepack yarn install` sites (nx-add-yarn:139, ng-add-ng-run-yarn:271) are plain `sh('corepack yarn install', ...)`. Grep of all `nx add`/`ng add` lines against perf flags returned "CLEAN: no perf flags on any nx add / ng add line" |
| 3 | Two Storybook installs keep `--legacy-peer-deps` (exact order); no new `--legacy-peer-deps`/`--force` anywhere | VERIFIED | storybook-composition:112 + storybook-tarball:140 both read `npm install ${STORYBOOK_ANGULAR} --legacy-peer-deps --no-audit --no-fund --prefer-offline` -- legacy-peer-deps FIRST, perf flags appended after (trailing-token revert). All other `legacy-peer-deps` hits are comments. `--force` appears only in a `--force-local` comment in tarball-audit; no `--force` flag added |
| 4 | pnpm-symlink `pnpm add <tgz> --config.frozen-lockfile=false --ignore-scripts` UNCHANGED | VERIFIED | pnpm-symlink.e2e.spec.ts:126 unchanged and NOT among the 11 committed files; no `--prefer-offline` on that line |
| 5 | Full instrumented e2e run GREEN (4/4 projects, 57 tests) | VERIFIED | Orchestrator independently observed 4/4 green (install 37/37, matrix 7/7, ng-cli 4/4, cache 9/9, exit 0, no EPUBLISHCONFLICT/ERESOLVE, no ng-cli flake). Documented in MEASUREMENTS.md "Fidelity proof" section. Per instructions the ~23-min tier was not re-run |
| 6 | MEASUREMENTS.md compares after-flags vs 1gr warm per-PM with flag-free control + honest framing | VERIFIED | Report present; treatment-vs-control split; npm flagged rows -42.5% (313233->180013, math checks: 101401+19505+59107=180013) against a flag-free control that ROSE ~+14% (yarn +13.4%, nx add +14.1%); pnpm stated within-noise (+12.5% inside +14% drift, no forced delta); single-run/directional caveat stated honestly; required keywords (1gr, no-audit, Defender, REJECT) present |
| 7 | No package.json version mutation; test-harness only | VERIFIED | Commit 6828d35 = 11 e2e spec files only (80 ins/38 del, line re-wraps). `git show` on packages/angular-typechecker/package.json: "CLEAN: version untouched". Working tree clean except untracked quick docs |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `nx-add-npm.e2e.spec.ts` | provision `npm install` + flags | VERIFIED | line 88: `npm install --no-audit --no-fund --prefer-offline` |
| `storybook-composition.e2e.spec.ts` | provision npm + SB install keeps `--legacy-peer-deps` + flags | VERIFIED | lines 97 + 112: `--legacy-peer-deps --no-audit --no-fund --prefer-offline` |
| `nx-add-pnpm.e2e.spec.ts` | provision `pnpm install --prefer-offline` | VERIFIED | line 142 |
| `ng-add-ng-run-pnpm.e2e.spec.ts` | provision `pnpm install --prefer-offline` | VERIFIED | line 246 |
| `260714-gja-MEASUREMENTS.md` | after-flags vs 1gr-warm + honest framing + follow-ups | VERIFIED | full report; contains `1gr`, `no-audit`, `Defender`, `REJECT` |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| e2e sh(...) command strings | npm/pnpm perf flags | appended ONLY to direct npm install / provisioning pnpm install | WIRED | 11 npm + 2 pnpm sites match; nx add/ng add/yarn/pnpm-symlink flag-free |
| ATC_TIME_INSTALLS seam | aggregate-install-timings.mjs -> MEASUREMENTS.md | one instrumented --parallel=2 warm run aggregated vs 1gr | WIRED | MEASUREMENTS.md cites `Grand total: 45 sh() calls, 533192 ms` from `tmp/gja-after.jsonl` (gitignored, uncommitted, per plan) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Prettier conformance on 11 edited files | `nx format:check --files <11>` | exit 0, no drift | PASS |
| Flag-count guard | `git grep` no-audit/no-fund/prefer-offline | 11/11/13 as intended | PASS |
| No version mutation | `git show 6828d35 -- .../package.json \| rg version` | CLEAN | PASS |

### Anti-Patterns Found

None. Diff is test-harness only (appended CLI-flag strings to `sh()` command literals). No debt markers introduced; no product/source change; no `--legacy-peer-deps`/`--force` added.

### Human Verification Required

None. The plan's Task 2 `<human-check>` (confirm the e2e run exited 0, 4/4 green) was satisfied by the orchestrator's independent observation of the GREEN run before launching this verification.

### Gaps Summary

No gaps. The APPLY-NOW flag set landed surgically on exactly the 13 intended direct-install sites and nowhere else; all fidelity levers (nx add / ng add / corepack yarn / pnpm-symlink / Storybook `--legacy-peer-deps`) are provably untouched; B-03 peer-honesty is intact (no flag changes resolution or masks ERESOLVE); the e2e gate stayed GREEN 4/4; MEASUREMENTS.md gives a drift-robust, honestly-caveated treatment-vs-control result and documents the measure-only + rejected levers as follow-ups. No package.json version mutation; release-safe on the current branch.

Note (not a gap): the SUMMARY/report frame the measured npm win as LARGER than the pre-run "modest" expectation. This does not violate the plan's honesty requirement -- the plan required "do not force a delta," and the report instead found a real one with a clean treatment-vs-control separation and appropriate single-run caveats. Truth #6's "shrink modestly OR within-noise, stated honestly" is satisfied in spirit (rows shrank, control-attributed, honestly caveated).

---

_Verified: 2026-07-14_
_Verifier: Claude (gsd-verifier)_
