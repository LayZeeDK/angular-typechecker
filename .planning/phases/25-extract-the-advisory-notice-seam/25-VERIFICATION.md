---
phase: 25-extract-the-advisory-notice-seam
verified: 2026-07-16T04:05:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 25: Extract the advisory-notice seam Verification Report

**Phase Goal:** The five advisory notices emit through ONE shared, logger-injected pure core module (`core/emit-advisory-notices.ts`) that the Nx executor drives with BYTE-IDENTICAL observable behavior vs `angular-typechecker@0.2.1` -- a reusable seam ready for the Phase-26 CLI adapter, so the CLI never imports `executor.ts` (which would drag `@nx/devkit`/`chalk`) or duplicate five message helpers.
**Verified:** 2026-07-16T04:05:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Executor emits every advisory through ONE `emitAdvisoryNotices(result, logger)` call, not five inline `warn*(result)` calls; passes its `@nx/devkit` logger directly with zero adapter (D-02). | VERIFIED | `executor.ts:53` is the sole advisory site: `emitAdvisoryNotices(result, logger);`, imported at line 4 from `../../core/emit-advisory-notices`. `logger` from `@nx/devkit` (line 2) passed directly; `Logger` contract lives in `core/logger.ts`. `@nx/devkit` `logger` is structurally assignable (typecheck green, zero wrapper). No `warn*` def remains in executor.ts (grep returned none). |
| 2 | `core/logger.ts` and `core/emit-advisory-notices.ts` import no nx/@nx/*/@angular-devkit/*, no console, no process (clean under `src/core/**` D-11 boundary at maxWarnings:0). | VERIFIED | `logger.ts` has zero `import` statements. `emit-advisory-notices.ts` imports only type-only `Logger`/`CoreResult`/`SkippedReference` from core-internal paths. D-11 block confirmed in `eslint.config.mjs:16` (`**/src/core/**/*.ts`) banning `@nx/*`, `no-console`, `process.exit`. `nx lint` green at maxWarnings:0. |
| 3 | Executor advisory output is byte-identical to `angular-typechecker@0.2.1`: every existing executor + builder spec stays green with NO assertion edits (D-10). | VERIFIED | Normalized diff of moved helper bodies vs `git show 75a130e^:.../executor.ts` (stripping only `, logger: Logger`) is EMPTY -- byte-identical. `executor.spec.ts` byte-unchanged (git diff empty) and does NOT `vi.mock` the seam, so the real `emitAdvisoryNotices` runs against the mocked `@nx/devkit` logger. `nx test` = 20 files / 107 tests passed; `nx run ...:integration` green. |
| 4 | A new unit spec drives `emitAdvisoryNotices` against a mock `Logger` asserting each notice's EXACT message text + stream routing (info for node_modules count, warn for other advisories, error for none) and a clean CoreResult emits nothing. | VERIFIED | `emit-advisory-notices.spec.ts` (7 tests, ran + passed). Plain `{info,warn,error: vi.fn()} satisfies Logger` (no `vi.mock`). Full-string `toHaveBeenCalledWith` (not `stringContaining`) for all 5 advisories; covers all 3 `skippedReferenceVerdictNote` branches (not-found / zero-root-names / default), info-before-warn sub-order via `invocationCallOrder`, `logger.error` never called, and a clean-result silent case. |
| 5 | `nx test`, `nx build`, `nx lint` (maxWarnings:0), `nx typecheck`, and `format:check` are all green. | VERIFIED | Re-ran `nx run-many -t build test integration lint typecheck --skip-nx-cache` -> "Successfully ran targets ... for project angular-typechecker". `nx format:check --base origin/main` produced no output (clean). |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/core/logger.ts` | Structural `Logger` seam (info/warn/error), imports nothing | VERIFIED | 23 lines; `interface Logger` with the three `(message: string): void` methods; zero imports; `error` reserved per D-03 with inline comment. |
| `src/core/emit-advisory-notices.ts` | `emitAdvisoryNotices` + five private helpers + `skippedReferenceVerdictNote`, moved verbatim | VERIFIED | 209 lines (>=120 min). Exports `emitAdvisoryNotices`; five helpers + `skippedReferenceVerdictNote` present as private. Type-only imports only. Helper bodies byte-identical to pre-move. |
| `src/core/emit-advisory-notices.spec.ts` | Exact-string + stream-routing spec vs mock Logger + clean-result case | VERIFIED | 192 lines; 7 tests passed; no `vi.mock`; exact full-string assertions; clean-result silent case present. |
| `src/executors/typecheck/executor.ts` | Swapped to one `emitAdvisoryNotices(result, logger)`; helpers + unused type imports deleted; infra catch kept | VERIFIED | 82 lines (was ~290). Single seam call; `CoreResult`/`SkippedReference` type imports removed; `TypecheckInfrastructureError` catch + `logger.error` retained (D-08). |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `executor.ts` | `core/emit-advisory-notices.ts` | `import { emitAdvisoryNotices }` + `emitAdvisoryNotices(result, logger)` | WIRED | Import at line 4; call at line 53; typecheck + tests green. |
| `core/emit-advisory-notices.ts` | `core/logger.ts` | `import type { Logger } from './logger'` | WIRED | Line 1; `Logger` param threaded through all helpers. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `emit-advisory-notices.ts` | `result` (CoreResult) fields | `runTypecheck(coreOptions)` in executor.ts:48, passed into `emitAdvisoryNotices(result, logger)` | Yes -- real CoreResult from the compiler run; helpers self-gate on live advisory fields | FLOWING |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| CLI-04 | 25-01-PLAN | Extract five advisory `warn*` helpers to pure `core/emit-advisory-notices.ts` behind injected `Logger`; executor injects its logger with byte-identical behavior (additive, no public-API change). | SATISFIED | All three ROADMAP success criteria verified above; REQUIREMENTS.md marks CLI-04 `[x]` / Phase 25 / Complete. No orphaned Phase-25 requirements. |

### Additive-only charter (ADD-01)

| Invariant | Status | Evidence |
| --------- | ------ | -------- |
| No public-API/barrel change (`src/index.ts` unchanged) | VERIFIED | `git diff 75a130e^ HEAD -- src/index.ts` empty. |
| No Nx executor id change | VERIFIED | `git diff 75a130e^ HEAD -- executors.json package.json` empty. |
| No new dependency | VERIFIED | `package.json` unchanged; SUMMARY confirms zero installs; only 4 source files changed in the phase. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | - | - | - | No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) in any of the four changed files. `D-01..D-11`/`RES-02`/`T-17-xx` tokens are decision/threat refs, not debt markers. |

### Human Verification Required

None. Byte-identity is provable mechanically (empty normalized diff) and the byte-identical guard is the existing spec suite, which was re-run green. No visual, real-time, or external-service behavior is in scope.

### Gaps Summary

No gaps. The phase goal is achieved: the five advisories emit through one pure, logger-injected `core/emit-advisory-notices.ts` behind a nothing-importing `core/logger.ts` `Logger` seam; the Nx executor drives it with a single `emitAdvisoryNotices(result, logger)` call; byte-identity vs 0.2.1 is mechanically confirmed and guarded by the unchanged executor/builder specs plus the new exact-string unit spec; and the additive-only charter (ADD-01) holds (no barrel, executor-id, or dependency change). The full toolchain (build + test + integration + lint@maxWarnings:0 + typecheck + format:check) is green. The one code-review Info item (no cross-advisory order test) is a pre-existing, non-blocking coverage note.

---

_Verified: 2026-07-16T04:05:00Z_
_Verifier: Claude (gsd-verifier)_
