---
phase: quick-260712-n7z
verified: 2026-07-12T00:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Quick 260712-n7z: e2e local-registry collision fix -- Verification Report

**Task Goal:** Resolve the e2e local-registry flakiness so `nx run-many -t e2e --parallel=1`
(the CI e2e gate at ci.yml:204) runs green -- previously it failed on
angular-typechecker-ng-cli-e2e with "Task ... was already invoked by a parent Nx process in
this chain."

**Verified:** 2026-07-12
**Status:** passed
**Method:** code + git evidence (the slow ~40min `run-many -t e2e` was NOT re-run per
instruction; the orchestrator already observed it GREEN).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | `nx run-many -t e2e --parallel=1` runs GREEN across all four e2e projects (ng-cli included), no "already invoked" exit(1) | VERIFIED | Orchestrator-observed GREEN: "Successfully ran target e2e for 4 projects", zero "already invoked" errors (install 37/37, ng-cli 4/4, matrix 7/7, cache 9/9). Code fix present + mechanism matches root cause (below). |
| 2 | Both global-setups clear `NX_INVOCATION_ROOT_PID` from process.env immediately BEFORE `startLocalRegistry`, so each forked registry keys the tracker on its own pid | VERIFIED | `git grep -c` reports 1 in each file. Diff hunk shows insertion directly before `const stop = await startLocalRegistry({` (ng-cli-e2e line 111->113, install-e2e line 106->108; single blank line per the project's blank-line-around-statements convention). |
| 3 | ci-e2e-coverage-guard GUARD-01/01b/01c/01d stay green: no target/tag/ci.yml run-many line changed | VERIFIED | Fix commit a17ee57 touched only the two global-setup files -- guard spec untouched; GUARD-01 (`run-many -t e2e`), GUARD-01b (`--parallel=1`), GUARD-01c (`run-many -t typecheck`) assertions all intact. SUMMARY reports `nx test angular-typechecker` GREEN (366 tests/39 files incl. the 8 guard tests). |
| 4 | Files byte-identical apart from added comment + one-line delete; load-bearing regions preserved; no package.json/version mutated | VERIFIED | Commit a17ee57 is +22/-0 (11+11 insertions, ZERO deletions) -> every existing line byte-unchanged: 127.0.0.1 listenAddress, "refusing to publish to non-local registry" SAFETY gate, clearStorage, mintCiToken, buildCleanEnv/stripAllNpmConfig, provenance strip, publish invocation. No package.json in the diff (last package.json touch was the prior fd41260). Bodies of the two files are IDENTICAL (verbatim siblings, only the header prose differs). |

**Score:** 4/4 truths verified

### Root-Cause Match

The fix mechanism matches the verified root cause: children inherit `NX_INVOCATION_ROOT_PID`
from the `run-many` parent (nx `task-env.js` `?? String(process.pid)`); `startLocalRegistry`
takes no `env` param and forks `nx run <root>:local-registry` with the inherited env, so both
serialized forks registered the SAME `(rootPID, taskId)` and the second `process.exit(1)`ed.
`delete process.env.NX_INVOCATION_ROOT_PID;` before the fork makes each forked registry its
own root (Nx's `?? process.pid` fallback), so the two forks never collide. Mirrors the repo's
existing `buildCleanEnv`/`NX_RUNNER_ENV_KEYS` hygiene. Correct and minimal.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `e2e/angular-typechecker-ng-cli-e2e/src/global-setup.ts` | delete + ASCII comment before startLocalRegistry | VERIFIED | Present at lines 102-111, immediately before the `startLocalRegistry` call. ASCII-only comment. |
| `e2e/angular-typechecker-install-e2e/src/global-setup.ts` | verbatim-sibling copy | VERIFIED | Present at lines 97-106; body identical to the ng-cli file. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `e2e/*/src/global-setup.ts` | `@nx/js startLocalRegistry -> fork(nx run <root>:local-registry)` | process.env with NX_INVOCATION_ROOT_PID removed before the fork | WIRED | `delete process.env.NX_INVOCATION_ROOT_PID;` executes on the line preceding `startLocalRegistry({ ... })` in both files -- the fork inherits the cleaned process.env. |

### Anti-Patterns Found

None. The change is additive test-harness env hygiene: no TODO/FIXME/XXX, no stub, no
placeholder, no debt marker, no source/config/version mutation.

### Git Identity

Commit a17ee57 authored by `larsbrinknielsen@gmail.com` (public gmail); no work email/domain,
no AI-attribution trailer. Clean.

### Gaps Summary

None. The one-line-x2 fix is present and identical in both registry-starting global-setups,
positioned immediately before `startLocalRegistry`, additive-only (+22/-0) with all
load-bearing regions and package.json untouched, and the run-many e2e gate was observed GREEN
by the orchestrator with zero collision errors. The guard contract remains intact.

---

_Verified: 2026-07-12_
_Verifier: Claude (gsd-verifier)_
