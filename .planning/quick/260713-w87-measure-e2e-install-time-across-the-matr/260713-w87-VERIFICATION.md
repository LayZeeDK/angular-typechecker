---
phase: 260713-w87-measure-e2e-install-time
verified: 2026-07-14T00:55:00Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
---

# Quick Task 260713-w87: Measure e2e install time across the PM matrix -- Verification Report

**Task Goal:** MEASURE e2e install time across the package-manager matrix (npm/pnpm/yarn)
and compile a findings report tying hotspots to the researched optimization levers.
MEASURE + REPORT only -- no optimization applied.
**Verified:** 2026-07-14
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Measurement report exists with per-PM install numbers (npm, pnpm, yarn) | VERIFIED | `260713-w87-MEASUREMENTS.md` "Per-PM totals": npm 26/593637ms, yarn 11/208868ms, pnpm 9/85126ms + full per-(PM x scenario x action) table + grand total 887631ms |
| 2 | sh() timing is a genuine NO-OP when ATC_TIME_INSTALLS is unset | VERIFIED | `e2e-process.ts:148-149` `const timed = process.env['ATC_TIME_INSTALLS'] === '1'; const started = timed ? performance.now() : 0;` -- unset path calls no `performance.now()`, no `recordInstallTiming` (guarded `if (timed)` on both success+catch), returns raw execSync stdout, throws byte-identical `${command}\n${stdout}${stderr}`. Spec case 1 asserts no file + stdout returned; `nx test test-util` 7/7 GREEN with flag unset |
| 3 | Single instrumented run covers install-e2e + matrix-e2e + ng-cli-e2e and all 3 PMs; cache-e2e absent by design | VERIFIED | MEASUREMENTS tables show install-e2e (atc-add-*, atc-sb-*, atc-verdaccio-consumer, atc-smoke, atc-gen), matrix-e2e (atc-matrix, atc-pnpm), ng-cli-e2e (atc-ng-cli/-pnpm/-yarn-flat/-yarn-workspace); cache-e2e documented absent (zero installs via nxViteTsPaths). Orchestrator observed 46-line JSONL, all 4 e2e projects exit 0 (not re-run per instructions) |
| 4 | Aggregator uses ordered PM rule (corepack yarn / yarn -> yarn before generic token check); tolerant per-line parse | VERIFIED | `aggregate-install-timings.mjs:21` `/^(corepack yarn\|yarn)\b/` checked FIRST; `parseLines` (lines 93-113) wraps each `JSON.parse` in try/catch, skips w/ stderr note. Behavioral spot-check: synthetic JSONL filed `corepack yarn install` under yarn, ambient `nx add` in atc-add-pnpm under pnpm, broken line skipped, no throw |
| 5 | Report has per-cell timings + grand total, Windows-vs-CI caveat, Verdaccio warm-cache top lever (clearStorage wipes cache each run), honest ceiling | VERIFIED | MEASUREMENTS "Environment + CAVEAT" (Windows arm64 vs Linux CI), "Findings" Lever 1 Verdaccio warm-cache TOP + `clearStorage: true -> rmSync(storage)`, "Honest ceiling" (irreducible first-fetch bytes). Lever mapping grounded in RESEARCH.md ranked-lever table (Lever 1/2 HIGH, Lever 5 TRAP) |
| 6 | No optimization applied; report says so explicitly | VERIFIED | MEASUREMENTS "No optimization applied" section; `clearStorage: true` intact in global-setup (no `clearStorage:false` flip anywhere in *.ts/*.yml); package.json version unmutated (0.2.0); working tree clean for all tracked files |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `libs/test-util/src/lib/e2e-process.ts` | Opt-in sh() timing behind ATC_TIME_INSTALLS | VERIFIED | `recordInstallTiming` (single `appendFileSync(record + '\n')`), guarded at both sh() paths; run()/buildCleanEnv/commandSucceeds/removeTmpDir/barrel/signature untouched |
| `libs/test-util/src/lib/e2e-process.spec.ts` | No-op-when-unset + append-when-set proof | VERIFIED | 3 cases: unset->no file+stdout; set->ok:true line; set+failing->throws /node -e/ + ok:false line. All pass in `nx test test-util` |
| `tools/e2e-timing/aggregate-install-timings.mjs` | JSONL -> per-PM x per-project x action table | VERIFIED | Ordered PM rule + cwd fallback + action/scenario derivation + tolerant parse; emits detail table, per-PM totals, grand total; exit 1 on empty |
| `260713-w87-MEASUREMENTS.md` | The measurement + findings deliverable | VERIFIED | All required sections present (what/how, caveat, tables, coverage confirmation, findings->levers, no-optimization statement) |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| sh() | JSONL timing file | appendFileSync when ATC_TIME_INSTALLS === '1' | WIRED (`e2e-process.ts:130`, guarded 158-166 / 170-178) |
| aggregator | timing JSONL | readFileSync + per-line JSON.parse + group by (PM, scenario, action) | WIRED (`aggregate-install-timings.mjs:93-153`) |
| MEASUREMENTS.md | RESEARCH.md | hotspot -> ranked-lever mapping | WIRED (report cites Lever 1/2/5; RESEARCH.md has the ranked-lever table) |

### Additive / Release Safety

| Check | Status | Evidence |
| --- | --- | --- |
| Only code commit is e2e-process.ts + spec + aggregator | VERIFIED | `git show --stat 1b88529`: 3 files, no package.json |
| test-util not shipped | VERIFIED | test-util is a lib under `libs/`; aggregator under `tools/` -- neither in published `packages/angular-typechecker` |
| No package.json version mutation | VERIFIED | version 0.2.0; `git status` clean (only untracked quick-task docs dir) |
| No optimization applied (no clearStorage flip) | VERIFIED | grep found only `clearStorage: true` in global-setups; no `clearStorage: false` anywhere |
| Isolation invariants intact | VERIFIED | all tracked e2e specs git-clean; install commands, 127.0.0.1 loopback, SAFETY gate, parallelism:false, --parallel=2, NX_INVOCATION_ROOT_PID clear (NX_RUNNER_ENV_KEYS), enableMirror:false untouched |
| pnpm-symlink spec reverted / clean | VERIFIED | `git diff HEAD` empty; scan for ATC_TIME_INSTALLS/appendFileSync/ATC_TIMING_OUT across all specs returns ONLY the intended e2e-process.spec.ts |

### Approved Deviations (not gaps)

- Env access via bracket notation `process.env['ATC_*']` (noPropertyAccessFromIndexSignature) -- confirmed in code, correct.
- matrix-e2e pnpm-symlink uses direct execSync by design; its one pnpm-add timing captured via a temporary, since-reverted edit and appended to JSONL. Spec confirmed git-clean.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| No-op unit test (flag unset) | `nx test test-util --skip-nx-cache` | 7/7 passed (e2e-process.spec.ts 3/3) | PASS |
| Aggregator ordered PM rule + tolerant parse | `node aggregate-install-timings.mjs <synthetic.jsonl>` | corepack yarn->yarn, storybook->storybook install, ambient nx add->pnpm via cwd, broken line skipped, no throw | PASS |

### Anti-Patterns Found

None. No debt markers (TBD/FIXME/XXX/TODO) in the three code files; no hollow returns; the aggregator's `return null`-style patterns are legitimate derivation branches.

### Human Verification Required

None. This is a measurement/tooling task: the no-op invariant is unit-test-proven, the aggregator logic is verified by spot-check, git state confirms additive safety, and the ~23-min instrumented tier was already observed GREEN by the orchestrator (46-line JSONL, all PMs, all 4 e2e projects exit 0).

### Gaps Summary

No gaps. All 6 must-haves verified against the actual codebase. The deliverable report exists with the required content, the opt-in timing is a proven no-op when unset, the aggregator applies the ordered PM rule and tolerant parsing, and the change is strictly additive (one commit, test-only + dev-tool, no version mutation, no isolation invariant perturbed, no optimization applied).

---

_Verified: 2026-07-14_
_Verifier: Claude (gsd-verifier)_
