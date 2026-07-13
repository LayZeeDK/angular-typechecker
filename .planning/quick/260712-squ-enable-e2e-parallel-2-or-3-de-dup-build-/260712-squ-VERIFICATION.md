---
phase: quick-260712-squ
verified: 2026-07-13T00:00:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 1
overrides:
  - must_have: "The two registry-starting projects run on DISTINCT Verdaccio ports (install-e2e 4873, ng-cli-e2e 4874) with DISTINCT storage dirs"
    reason: "Approved Rule-3 blocking deviation. Two real defects made the second registry unworkable: (a) .verdaccio/config.yml hardcodes htpasswd to install-e2e's storage -> 409 on the shared ci-user sign-up; (b) FUNDAMENTAL -- yarn 4 keys its global metadata cache by HOST (127.0.0.1) not host:port and bakes the port into __archiveUrl, so a second registry on another port causes cross-registry ECONNREFUSED that would break CI too. Realized as corrected Fallback A: a SINGLE 4873 registry with install-e2e AND cache-e2e parallelism:false, still running CI at --parallel=2 (install alone; cache alone; ng-cli + matrix overlap; only ONE registry ever live). GUARD-01b invariant 3 (install-e2e parallelism:false) replaces the literal distinct-registry invariant and asserts the actual architecture."
    accepted_by: "orchestrator (verify-work task brief, 260712-squ)"
    accepted_at: "2026-07-13T00:00:00Z"
---

# Quick Task 260712-squ: Enable e2e --parallel=2 (de-dup build + isolate shared resources) Verification Report

**Task Goal:** Run the e2e tier at `nx run-many -t e2e --parallel=2` (from the previously-forced `--parallel=1`) by de-duplicating the dist build and isolating the shared resources, with every GUARD updated in lockstep.
**Verified:** 2026-07-13
**Status:** passed
**Re-verification:** No -- initial verification

## Approved Deviation (context)

The executor made a Rule-3 blocking deviation from the plan's literal Option-1 design (a
second Verdaccio registry on port 4874). The final architecture is a corrected Fallback A:
a SINGLE 4873 registry with `install-e2e` AND `cache-e2e` set `parallelism: false`, still
running CI at `--parallel=2`. This verification evaluates the ACTUAL architecture as the
correct realization of the goal (per the task brief), not the plan's superseded literal
wording. The superseded "distinct registry ports + storage" must-have is recorded as
`PASSED (override)`; all other must-haves are verified against the actual codebase.

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                            | Status              | Evidence                                                                                                                                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `nx run-many -t e2e --parallel=2` runs GREEN across all four e2e projects, non-flaky (3x), no race errors        | VERIFIED            | Orchestrator-attested authoritative T3 `--parallel=2` GREEN x3 (4/4 projects each; zero ENOENT/EADDRINUSE/EPUBLISHCONFLICT/ECONNREFUSED/"already invoked"). Runtime behavior not re-run per task brief; the enabling isolation invariants (2-7) are all verified in-code below.                        |
| 2   | dist built ONCE upstream via `e2e dependsOn`; read-only during e2e (NO `nx build` in any spec/setup)            | VERIFIED            | `nx.json` lines 48-50: `"e2e": { "dependsOn": ["angular-typechecker:build"] }`. `git grep "nx build angular-typechecker" -- e2e/` -> zero matches.                                                                                                                                                    |
| 3   | Registry isolation invariant (plan literal: distinct ports 4873/4874 + distinct storage)                        | PASSED (override)   | Override: superseded by approved Rule-3 deviation -- single 4873 registry + install-e2e `parallelism:false` (Fallback A). Accepted by orchestrator on 2026-07-13. Actual invariant verified as truth #5.                                                                                              |
| 4   | Every `npm pack --json` writes to a per-spec `--pack-destination` temp dir; no shared tarball path              | VERIFIED            | All 6 pack sites use `npm pack --json --pack-destination "${packDest}"` with `packDest = mkdtempSync(join(tmpdir(), 'atc-pack-<slug>-'))`; tarball path = `join(packDest, filename)` (data flows to packDest, not distDir). git grep -c confirms >=1 each.                                             |
| 5   | Single-registry serialization: install-e2e AND cache-e2e `parallelism:false`; both setups on same 4873; no 4874 | VERIFIED            | install-e2e project.json:12 `"parallelism": false`; cache-e2e project.json:16 `"parallelism": false`; both global-setups use `${rootProjectName}:local-registry` + `./tmp/local-registry/storage`. `git grep` for `local-registry-ngcli`/`4874`/`config-ngcli` -> zero matches.                       |
| 6   | GUARD-01b rewritten (not deleted) with fail-loud invariants; GUARD-01/01c/01d untouched; `nx test`/`nx lint` green | VERIFIED            | GUARD-01b (`ci-e2e-coverage-guard.spec.ts:235-315`) asserts 5 invariants (parallel=2 present + parallel=1 absent; per-spec --pack-destination TS-comment-aware; install-e2e parallelism:false; cache-e2e parallelism:false; no in-spec/in-setup nx build). `nx test` GREEN (39 files, 12 guard tests). |
| 7   | Additive/release-safe: no source change; no package.json version mutation; n7z delete + SAFETY gate preserved   | VERIFIED            | `git diff ef76d0b..HEAD -- packages/angular-typechecker/package.json` empty (version 0.2.0 unchanged). `delete process.env.NX_INVOCATION_ROOT_PID` present in both global-setups; `http://127.0.0.1:` SAFETY gate present in both. Only test-harness/config/ci files changed.                          |

**Score:** 7/7 truths verified (6 VERIFIED + 1 PASSED override)

### Required Artifacts

| Artifact                                                       | Expected                                          | Status     | Details                                                                                                     |
| ------------------------------------------------------------- | ------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| `nx.json`                                                     | `e2e` targetDefault dependsOn build-once          | VERIFIED   | `"e2e": { "dependsOn": ["angular-typechecker:build"] }` (lines 48-50)                                       |
| `.github/workflows/ci.yml`                                    | e2e job runs `--parallel=2` with rewritten comment | VERIFIED   | Line 211 `npx nx run-many -t e2e --parallel=2`; rationale block (lines 192-210) documents the 4 isolations |
| `e2e/angular-typechecker-install-e2e/project.json`           | `parallelism:false` on e2e target                 | VERIFIED   | Line 12                                                                                                     |
| `e2e/angular-typechecker-cache-e2e/project.json`             | `parallelism:false` on e2e target                 | VERIFIED   | Line 16                                                                                                     |
| both global-setups                                           | single 4873; SAFETY gate + n7z delete preserved   | VERIFIED   | install-e2e (SAFETY:125, n7z:107); ng-cli-e2e (SAFETY:136, n7z:118); no nx build                            |
| 6 pack specs                                                 | per-spec `--pack-destination`                     | VERIFIED   | tarball-audit, install-smoke, generator-e2e, nx-add-e2e, matrix-5types, pnpm-symlink                        |
| `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` | GUARD-01b rewritten to new invariants         | VERIFIED   | 5-invariant rewrite; TS-comment-aware scans; GUARD-01/01c/01d assertions unchanged                         |

### Key Link Verification

| From                                | To                              | Via                                                | Status | Details                                                          |
| ----------------------------------- | ------------------------------- | -------------------------------------------------- | ------ | --------------------------------------------------------------- |
| e2e `e2e` targets                   | `angular-typechecker:build`     | nx.json targetDefaults e2e.dependsOn               | WIRED  | dependsOn present; build runs once upstream, dist read-only     |
| ci.yml e2e job                      | `nx run-many -t e2e --parallel=2` | run step (no `-p`, no `--parallel=1`)             | WIRED  | Line 211; GUARD-01b asserts present + rejects --parallel=1      |
| GUARD-01b                           | ci.yml + 6 pack specs + both setups + 2 project.json | read-only text/JSON invariant assertions | WIRED  | 12 guard tests GREEN; scans locate real files, fail-loud        |

### Data-Flow Trace (Level 4)

| Artifact               | Data Variable | Source                                       | Produces Real Data | Status    |
| ---------------------- | ------------- | -------------------------------------------- | ------------------ | --------- |
| 6 pack specs           | `packDest` -> `tarballPath`/`tgz` | `mkdtempSync(tmpdir())` + `npm pack --json --pack-destination` | Yes (real per-spec temp dir) | FLOWING   |
| GUARD-01b assertions   | file contents | `readFileSync` of ci.yml/project.json/specs  | Yes (reads tracked files) | FLOWING   |

### Behavioral Spot-Checks

| Behavior                              | Command                                                    | Result                              | Status |
| ------------------------------------- | --------------------------------------------------------- | ----------------------------------- | ------ |
| Rewritten guards pass                 | `NX_DAEMON=false npx nx test angular-typechecker --skip-nx-cache` | 39 test files pass; guard spec 12/12 | PASS   |
| `--parallel=2` tier GREEN x3          | `nx run-many -t e2e --parallel=2 --skip-nx-cache` (x3)     | Orchestrator-attested GREEN x3      | SKIP (not re-run per brief; attested authoritative) |
| No debt markers in modified files     | `git grep -E "TBD\|FIXME\|XXX"` over modified files        | zero matches                        | PASS   |

### Requirements Coverage

| Requirement | Source Plan | Description                                        | Status    | Evidence                                              |
| ----------- | ----------- | ------------------------------------------------- | --------- | ---------------------------------------------------- |
| SQU-01      | 260712-squ  | e2e tier at `--parallel=2` via build de-dup + isolation | SATISFIED | Truths 1-7 verified; single-registry Fallback A realized |

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX` debt markers in any modified file. No stub/placeholder patterns; changes are test-harness/config only.

### Human Verification Required

None. The authoritative `--parallel=2` GREEN x3 runtime was already observed by the orchestrator; all enabling in-code invariants are programmatically verified.

### Gaps Summary

No gaps. The goal is achieved via the approved corrected-Fallback-A architecture: dist built
once upstream (read-only during e2e), per-spec `--pack-destination` tarballs, a single
127.0.0.1:4873 registry with install-e2e + cache-e2e serialized (`parallelism:false`), CI at
`--parallel=2`, and GUARD-01b rewritten in lockstep to fail loudly on regression of every
actual invariant. The plan's literal "second registry on 4874" was intentionally replaced
(recorded as an override) and must NOT be treated as a gap. No production source or
package.json version was touched.

---

_Verified: 2026-07-13_
_Verifier: Claude (gsd-verifier)_
