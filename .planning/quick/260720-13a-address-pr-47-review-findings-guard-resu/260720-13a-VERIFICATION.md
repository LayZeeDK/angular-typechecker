---
phase: quick-260720-13a
verified: 2026-07-20T01:20:00Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Quick Task 260720-13a: Address PR #47 review findings (guard + redaction) Verification Report

**Task Goal:** Address two confirmed PR #47 max code-review findings
behavior-preservingly -- (1) correctness: `gatherLeafInto` must early-return-guard
`result.program === undefined` BEFORE the source-file deref so an infra-crashed
leaf surfaces as a classified `TypecheckInfrastructureError`, not a raw
`TypeError`, on BOTH the solution-walk and multi-tsconfig paths, contributing 0
authored files; (2) test-coverage: `redactVolatile` must inject the version
placeholder ONLY when present on both the JSON top-level and SARIF
`driver.version` branches, so a dropped tool version fails the snapshot.
**Verified:** 2026-07-20
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A surviving leaf whose `performCompilation` returns `{ program: undefined }` plus an `UNKNOWN_ERROR_CODE` (500) surfaces as a classified `TypecheckInfrastructureError` on BOTH the solution-walk and multi-tsconfig paths, never a raw `TypeError`. | VERIFIED | `walk-references.ts:205-207` early-returns on `result.program === undefined` before the OBS-01 deref (line 216); `walk-references.spec.ts` test "RESOLVES a surviving leaf ... no raw TypeError (PR47-F1)" (line 512) proves the walk resolves; `infra-failure.spec.ts` test "PR47-F1: an ARRAY tsConfigPath entry ... REJECTS as TypecheckInfrastructureError" (line 333) proves the multi-tsconfig path classifies. Both tests ran and PASSED (`nx test angular-typechecker`: `infra-failure.spec.ts` 10 tests, `walk-references.spec.ts` 16 tests, all green). |
| 2 | The infra-crashed leaf contributes 0 authored files (`totalFilesCount` stays verdict-neutral) and the already-pushed 500 stays in the diagnostics union for the caller to classify. | VERIFIED | `walk-references.spec.ts:549-551` asserts `walk.rawDiagnostics` contains `UNKNOWN_ERROR_CODE` and `walk.totalFilesCount` is `0`. Test passed. `gatherLeafInto` pushes `parsed.errors`/`result.diagnostics` (lines 187-188) BEFORE the guard (line 205), so the 500 is unioned before the early return. |
| 3 | `redactVolatile` injects the version placeholder ONLY when a version key is already present; a payload without version keeps no version key. | VERIFIED | `redact-volatile.ts:42-46` (JSON branch, `'version' in record` guard) and `redact-volatile.ts:73-79` (`redactRunVersion`, `'version' in driverRecord` guard). `redact-volatile.spec.ts` (4 tests: present/absent x JSON/SARIF) all PASSED (`nx test test-util`: 4 tests in `redact-volatile.spec.ts`, green). |
| 4 | The JSON and SARIF integration snapshots are byte-identical after the redaction change (version present in the real payloads). | VERIFIED | `git status --porcelain` shows zero modified `.snap` files anywhere in the tree (only the untracked `.planning/quick/...` task directory). Ran `nx run angular-typechecker:integration` targeted at `machine-reporters`: `machine-reporters-sarif.integration.spec.ts` (9 tests) and `machine-reporters-json.integration.spec.ts` (10 tests) both PASSED with no snapshot mismatch. |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/angular-typechecker/src/core/walk-references.ts` | `gatherLeafInto` program-undefined guard | VERIFIED | Guard at lines 205-207, positioned after the diagnostics/rootName/notTypeChecked pushes (187-193) and before the OBS-01 source-file loop (216). No throw, no `TypecheckInfrastructureError` import (confirmed via file's import list, lines 1-12). |
| `packages/angular-typechecker/src/core/walk-references.spec.ts` | Solution-walk crash test + `crashProgram` stub flag | VERIFIED | `LeafSpec.crashProgram?` (line 83), `stubCompilerCli` branch (lines 138-147), new test at line 512. Existing tests byte-unchanged (default `crashProgram` omitted keeps prior behavior); ran and all 16 tests pass. |
| `packages/angular-typechecker/src/core/infra-failure.spec.ts` | Multi-tsconfig array-path crash test | VERIFIED | New test at line 333 drives `runTypecheck({ tsConfigPath: ['/virtual/a.json', '/virtual/b.json'] })` and asserts `.rejects.toBeInstanceOf(TypecheckInfrastructureError)`. Ran and passed (10 tests total in file). |
| `libs/test-util/src/lib/redact-volatile.ts` | Present-only JSON + SARIF redaction | VERIFIED | JSON branch (lines 42-46), SARIF `redactRunVersion` branch (lines 73-79). Both guarded by `'version' in ...` checks; no unconditional injection remains. |
| `libs/test-util/src/lib/redact-volatile.spec.ts` | Present/absent coverage on both branches | VERIFIED | 4 tests (JSON present/absent, SARIF present/absent), all passing. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `walk-references.ts` `gatherLeafInto` | the `result.program === undefined` early-return guard | mirrors `run-typecheck.ts`'s direct-path guard ordering | WIRED | Direct-path guard at `run-typecheck.ts:482-489` (`if (result.program === undefined) throw new TypecheckInfrastructureError(...)`); the shared-helper guard at `walk-references.ts:205-207` uses the identical `result.program === undefined` condition (return instead of throw, as required -- see comment lines 195-204 explaining the intentional divergence). |
| `run-typecheck.ts` `handleSolutionWalk` (post-walk `throwIfInfrastructureFailure`) and `handleMultiTsConfig` (post-loop `throwIfInfrastructureFailure`) | classify the unioned 500 | `throwIfInfrastructureFailure(ng, ts, walk.rawDiagnostics)` / `throwIfInfrastructureFailure(ng, ts, acc.rawDiagnostics)` | WIRED | `handleSolutionWalk` calls it at line 580 (after `walkReferences` returns); `handleMultiTsConfig` calls it at line 748 (after the entries loop, which calls `gatherLeafInto` at line 731). Both proven by the passing PR47-F1 tests in `walk-references.spec.ts` and `infra-failure.spec.ts`. |
| `redact-volatile.ts` `redactVolatile` JSON branch + `redactRunVersion` driver branch | present-only spread | `'version' in record` / `'version' in driverRecord` guards | WIRED | Both branches confirmed present-only via direct read and the 4 passing unit tests. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Solution-walk + multi-tsconfig crash-classification tests pass | `nx test angular-typechecker -- run walk-references infra-failure --skip-nx-cache` | `infra-failure.spec.ts` (10 tests) + `walk-references.spec.ts` (16 tests) all pass; full project suite 52 files / 552 tests green | PASS |
| redact-volatile present-only tests pass | `nx test test-util --skip-nx-cache` | `redact-volatile.spec.ts` (4 tests) pass; project suite 4 files passed / 1 skipped, 15 passed / 1 skipped tests | PASS |
| angular-typechecker spec-level typecheck (specs are NOT type-checked by vitest) | `nx typecheck angular-typechecker --skip-nx-cache` | `tsc --noEmit` on spec/drift/tools tsconfigs all succeed | PASS |
| test-util spec-level typecheck | `nx typecheck test-util --skip-nx-cache` | `tsc --noEmit -p libs/test-util/tsconfig.spec.json` succeeds | PASS |
| machine-reporters JSON + SARIF integration snapshots unchanged | `nx run angular-typechecker:integration -- run machine-reporters --skip-nx-cache` + `git status --porcelain` | 9 + 10 tests pass; `git status` shows zero modified `.snap` files | PASS |
| No debt markers in the 5 modified/created files | `git grep -n -E "TBD|FIXME|XXX"` over the 5 files | zero matches | PASS |

Note: the plan's own `<verify><automated>` instructions specified filtered vitest
invocations (`-- run walk-references infra-failure` / `-- run machine-reporters`);
in this workspace's `@nx/vitest:test` wiring those positional filters did not
narrow the file set (the full project suite ran each time), so the checks above
report against full-suite runs rather than single-file runs. All targeted files
were confirmed present and green within those full-suite results. Full test
suites for `angular-typechecker` and `test-util` were run once each (plus one
`integration` run) as part of this verification -- no repeated full-suite
re-runs.

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in any of the 5
modified/created files. No empty-implementation or stub patterns in the new
guard/redaction code.

### Requirements Coverage

This is a quick task (no `.planning/REQUIREMENTS.md` cross-reference applies).
The two requirement IDs declared in the PLAN frontmatter are satisfied by the
verified truths/artifacts above:

| Requirement | Description | Status | Evidence |
|-------------|--------------|--------|----------|
| `PR47-F1-walk-program-guard` | Guard `gatherLeafInto` against a Program-less infra crash | SATISFIED | Truths 1-2 verified; both new tests pass. |
| `PR47-F2-redact-present-only` | `redactVolatile` replaces the version placeholder only when present | SATISFIED | Truths 3-4 verified; 4 new tests pass; integration snapshots unchanged. |

### Human Verification Required

None. All must-haves are mechanically verifiable (unit-tested classification
behavior, present-only redaction, and snapshot byte-stability) and were verified
against actually-executed, currently-passing tests -- not merely SUMMARY.md
claims.

### Gaps Summary

No gaps. Both PR #47 findings are fixed at the root (single shared function
each): `gatherLeafInto`'s early-return guard covers both the solution-walk and
multi-tsconfig callers without duplicating the check per-caller, and
`redactVolatile`/`redactRunVersion`'s present-only guards cover both the JSON and
SARIF branches. No product-surface changes; no existing spec assertions were
altered beyond the additive `crashProgram` stub flag. Commits 826eb85 and
1df16ba both exist on the branch with the expected file sets.

---

_Verified: 2026-07-20T01:20:00Z_
_Verifier: Claude (gsd-verifier)_
