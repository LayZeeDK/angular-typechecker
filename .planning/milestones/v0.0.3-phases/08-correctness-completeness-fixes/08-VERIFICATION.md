---
phase: 08-correctness-completeness-fixes
verified: 2026-06-29T19:20:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 8: Correctness & Completeness Fixes Verification Report

**Phase Goal:** The engine reports the diagnostics it currently misses and classifies a config-resolution crash as infrastructure (not a type error), so a "clean" verdict is never a false negative and CI/agents can tell a crash apart from real type errors.
**Verified:** 2026-06-29T19:20:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

The four reframed ROADMAP Success Criteria (SC1-SC4) map 1:1 to COR-01..COR-04.
SC4 was reframed (08-CONTEXT.md D-07..D-10): the literal OS exit code `2` is
delivered by the DEFERRED standalone CLI, NOT the Nx executor. Phase 8 delivers
the engine classification + a pure `toExitCode` 0/1/2 policy + the executor's
distinct infra message within Nx's `{ success }` contract. The executor not
emitting a numeric exit code is deferred by design and is NOT a gap.

### Observable Truths

| #   | Truth (Success Criterion)                                                                                                      | Status     | Evidence                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | SC1/COR-01: A config-resolution 500 (`UNKNOWN_ERROR_CODE` in `readConfiguration().errors`) is re-thrown as `TypecheckInfrastructureError`, never folded/counted | VERIFIED   | `run-typecheck.ts:121-132` early scan keyed on `ng.UNKNOWN_ERROR_CODE`, placed AFTER `readConfiguration` (`:105`) and BEFORE the `configDiagnostics` fold (`:137`) + zero-rootNames guard (`:144`). Present in compiled `dist/.../run-typecheck.js:74-76`. Proven by `infra-failure.spec.ts` (500 unit twin rejects; `performCompilation` not called) + `config-resolution.integration.spec.ts:101` (nonexistent path rejects). Both 500 scans coexist (post-compilation at `:198-206`). No hardcoded `500`. |
| 2   | SC2/COR-02: A global/location-less TS diagnostic (TS2318) the per-file path never emitted now appears in reported diagnostics | VERIFIED   | `gather-diagnostics.ts:35` `all.push(...program.getTsProgram().getGlobalDiagnostics())` (7th getter). Present in compiled `dist/.../gather-diagnostics.js:31`. Proven by `gather-diagnostics.spec.ts:76` (unit wiring) + `global-diagnostics.integration.spec.ts:36` (real compiler surfaces raw TS2318 through `result.diagnostics`). Fixtures `fixtures/global-diagnostics/{tsconfig.json,global-error.ts}` exist (`noLib`+`types:[]`, no base extend). No `compiler-cli-types.ts` edit. |
| 3   | SC3/COR-03: A diagnostic whose `file.fileName` is present-but-empty is kept (file-less), never silently dropped                | VERIFIED   | `filter-diagnostics.ts:85` guard widened to `diagnostic.file === undefined \|\| diagnostic.file.fileName === ''`. Present in compiled `dist/.../filter-diagnostics.js:23`. Proven by `filter-diagnostics.spec.ts:68` (`diag('')` kept, `suppressedCount` 0). Canonicalizer / node_modules-segment / `isUnderDir` untouched. |
| 4   | SC4/COR-04 (reframed): pure `toExitCode` 0/1/2 policy + executor surfaces infra distinctly within `{ success }` (D-08)         | VERIFIED   | `exit-codes.ts` exports pure `toExitCode(input): 0\|1\|2` (`2` instanceof infra, `1` errorCount>0, else `0`); imports ONLY `./run-typecheck`; no `process`/`@nx/*`/`console`. Unit-covered (`exit-codes.spec.ts` 3 branches). Executor (`executor.ts:52-57`) catches `TypecheckInfrastructureError` -> distinct `logger.error('...infrastructure error, not a type error...')` + `{ success: false }`; `executor.spec.ts:156` asserts the message contains "infrastructure error". `toExitCode` NOT wired into executor; `run-typecheck.ts` does not import `exit-codes.ts` (no cycle). Literal exit `2` deferred to standalone CLI by design. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact                                                                           | Expected                                                          | Status     | Details                                                                                              |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------- |
| `packages/angular-typechecker/src/core/run-typecheck.ts`                           | Early `parsed.errors` 500 scan before zero-rootNames guard       | VERIFIED   | `configInfrastructureFailure` at `:121`; both 500 scans coexist; compiled into dist                  |
| `packages/angular-typechecker/src/core/infra-failure.spec.ts`                      | 500 unit twin + 5012 D-03 contrast                               | VERIFIED   | 4 tests green; 500 rejects + `performCompilation` not called; 5012 stays folded/returned             |
| `packages/angular-typechecker/src/core/config-resolution.integration.spec.ts`      | Nonexistent tsconfig path rejects; malformed-5012 unchanged      | VERIFIED   | 6 tests green; COR-01 nonexistent-path case at `:101`; D-03 malformed cases intact                   |
| `packages/angular-typechecker/src/core/gather-diagnostics.ts`                      | 7th `getGlobalDiagnostics` push                                  | VERIFIED   | `:35`; six existing pushes unchanged; compiled into dist                                             |
| `packages/angular-typechecker/src/core/gather-diagnostics.spec.ts`                 | Unit wiring proof (2318) + six-getter test intact                | VERIFIED   | 3 tests green; new global-getter test at `:76`; six-in-order test stubs `getTsProgram` empty         |
| `packages/angular-typechecker/src/core/global-diagnostics.integration.spec.ts`     | Real-compiler TS2318 via `result.diagnostics`                    | VERIFIED   | 1 test green; asserts through the engine, raw 2318                                                   |
| `fixtures/global-diagnostics/tsconfig.json` + `global-error.ts`                    | `noLib`+`types:[]` leaf config triggering TS2318                 | VERIFIED   | Both exist; does NOT extend base; references `Array` global                                          |
| `packages/angular-typechecker/src/core/filter-diagnostics.ts`                      | File-less guard widened to `fileName === ''`                     | VERIFIED   | `:85`; JSDoc D-03 paragraph extended; helpers untouched; compiled into dist                          |
| `packages/angular-typechecker/src/core/filter-diagnostics.spec.ts`                 | `diag('')` kept, suppressedCount 0                               | VERIFIED   | New COR-03 case at `:68`; all existing cases intact                                                  |
| `packages/angular-typechecker/src/core/exit-codes.ts`                              | Pure `toExitCode` 0/1/2, core-boundary clean                     | VERIFIED   | Exports `toExitCode`; imports only `./run-typecheck`; no `process`/`@nx/*`; passes core lint         |
| `packages/angular-typechecker/src/core/exit-codes.spec.ts`                         | 2/1/0 branch cases                                               | VERIFIED   | 3 tests green                                                                                         |
| `packages/angular-typechecker/src/executors/angular-typecheck/executor.spec.ts`    | D-08 assertion: message contains "infrastructure error"          | VERIFIED   | `:156` `expect.stringContaining('infrastructure error')`; executor.ts source unchanged               |

### Key Link Verification

| From                                  | To                                        | Via                                                                      | Status | Details                                                                              |
| ------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------ |
| `run-typecheck.ts` readConfiguration  | `TypecheckInfrastructureError` throw       | `parsed.errors.find(d => d.code === ng.UNKNOWN_ERROR_CODE)` before guard | WIRED  | `:121-132`; precedes both the fold and the zero-rootNames guard                      |
| `gather-diagnostics.ts`               | `ts.Program.getGlobalDiagnostics`          | `program.getTsProgram().getGlobalDiagnostics()`                          | WIRED  | `:35`; surfaces TS2318 end-to-end (integration test green)                           |
| `filter-diagnostics.ts` file-less guard | `kept.push` (always keep)                | `diagnostic.file === undefined \|\| diagnostic.file.fileName === ''`     | WIRED  | `:85`; empty-fileName kept (unit test green)                                         |
| `exit-codes.ts` toExitCode            | `TypecheckInfrastructureError` + errorCount | value import of `TypecheckInfrastructureError` from `./run-typecheck`     | WIRED  | `:25,37`; `instanceof` branch returns 2; unit cases lock all three branches          |
| executor infra catch                  | distinct operator message + `{success:false}` | `error instanceof TypecheckInfrastructureError` -> `logger.error(...)`   | WIRED  | `executor.ts:52-57`; spec asserts "infrastructure error"; `toExitCode` NOT wired (D-08) |

### Data-Flow Trace (Level 4)

The engine (`runTypecheck`) produces `CoreResult.diagnostics` from the real
`@angular/compiler-cli` via `performCompilation` + the unconditional all-getter.
The COR-01/COR-02/COR-03 integration specs each drive `runTypecheck` against a
real or stubbed compiler and assert on the genuinely produced `result.diagnostics`
(TS2318 surfaces; nonexistent path rejects; 5012 stays folded). No hardcoded /
static diagnostic data flows through the wiring -- the data source is the live
compiler. Status: FLOWING.

### Behavioral Spot-Checks

| Behavior                          | Command                                                    | Result                          | Status |
| --------------------------------- | ---------------------------------------------------------- | ------------------------------- | ------ |
| GATE A nodenext compile           | `npx nx build angular-typechecker`                          | Successfully ran target build   | PASS   |
| Full test suite (authoritative)   | `npx nx test angular-typechecker --skip-nx-cache`           | 22 files / 123 tests passed     | PASS   |
| Core boundary purity + lint       | `npx nx lint angular-typechecker`                           | 0 errors, 1 pre-existing warning | PASS   |
| COR-02 integration + COR-01 unit  | `npx nx test angular-typechecker -- global-diagnostics infra-failure` | TS2318 surfaces; 4 infra cases green | PASS   |
| COR changes present in dist       | `rg` on `dist/.../{run-typecheck,gather-diagnostics,filter-diagnostics,exit-codes}.js` | all four present | PASS   |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` probes are declared for this phase;
verification is via the Nx test/build/lint runner (the project's authoritative
gate per CLAUDE.md). Probe step: not applicable.

### Requirements Coverage

| Requirement | Source Plan | Description                                                                | Status    | Evidence                                                                                  |
| ----------- | ----------- | -------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------- |
| COR-01      | 08-01       | Config-resolution 500 detected post-parse, re-thrown as infra              | SATISFIED | `run-typecheck.ts:121-132`; `infra-failure.spec.ts` + `config-resolution.integration.spec.ts` green |
| COR-02      | 08-02       | Global/location-less TS diagnostics gathered via `getGlobalDiagnostics()`  | SATISFIED | `gather-diagnostics.ts:35`; `gather-diagnostics.spec.ts` + `global-diagnostics.integration.spec.ts` green |
| COR-03      | 08-03       | Present-but-empty `fileName` treated as file-less, never dropped           | SATISFIED | `filter-diagnostics.ts:85`; `filter-diagnostics.spec.ts:68` green                          |
| COR-04      | 08-03       | Pure `toExitCode` 0/1/2 + executor distinct infra message (reframed SC4)   | SATISFIED | `exit-codes.ts` + `exit-codes.spec.ts`; `executor.spec.ts:156`; D-08 invariants hold       |

All four declared requirement IDs (COR-01..COR-04) are accounted for in REQUIREMENTS.md,
mapped to Phase 8, and marked Complete. No orphaned requirements: REQUIREMENTS.md maps
exactly COR-01..04 to Phase 8 and all four are claimed by the phase plans.

### Anti-Patterns Found

| File                                              | Line | Pattern                                | Severity | Impact                                                                                 |
| ------------------------------------------------- | ---- | -------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| `config-resolution.integration.spec.ts`          | 30   | unused `NG` helper (lint warning)      | Info     | Pre-existing (commit `07af39e`, plan 02-02 -- NOT Phase 8); lint target still succeeds  |

No debt markers (TODO/FIXME/XXX/TBD/HACK/PLACEHOLDER) in any Phase 8 modified source file.
No stub patterns: all artifacts are substantive, wired, and exercised by green tests.

### Human Verification Required

None. All four success criteria are observable in code and proven by the green test
suite (unit + real-compiler integration), the production build, and lint. No visual,
real-time, or external-service behavior is in scope for this engine-internal phase.

### Deferred / Latent Items (informational -- not gaps)

The 08-REVIEW.md raised two WARNINGs (0 blockers), both LATENT because D-08
deliberately leaves `toExitCode` unwired in this phase:

- **WR-01**: `toExitCode` inspects only `errorCount`, diverging from `evaluateResult`'s
  `--max-warnings` gate. Becomes a live concern only when the DEFERRED standalone CLI
  wires `toExitCode` into `process.exit`. The standalone CLI is out of the current
  milestone (08-CONTEXT.md Deferred Ideas; PROJECT.md Out of Scope) -- it owns the
  decision to combine the warning gate with `toExitCode`. Not a Phase 8 gap.
- **WR-02**: `toExitCode` has no production consumer and is not re-exported from
  `src/index.ts`. Confirmed: it is consumed only by its own spec. This is by design
  per D-08 (the Nx executor uses `evaluateResult`, not `toExitCode`). The future CLI/
  builder consumers are deferred. Not a Phase 8 gap; the header's "Nx executor now"
  wording is an accuracy nit, not a correctness defect.

Neither warning falsifies a Phase 8 success criterion. SC4 was explicitly reframed
(D-10) so the contract is: engine classification + pure 0/1/2 policy + distinct
executor message -- all VERIFIED. The literal OS exit code is delivered by the
deferred CLI, which is outside this phase's scope.

### Gaps Summary

No gaps. All four reframed Success Criteria (COR-01..COR-04) are achieved in the
codebase and proven by the authoritative test/build/lint runner. The phase goal --
report the diagnostics the engine currently misses (COR-02 globals, COR-03
empty-fileName) and classify a config-resolution crash as infrastructure (COR-01),
with a pure infra-vs-type exit-code policy and a distinct executor infra message
(COR-04) -- holds: a "clean" verdict can no longer be a false negative for these
classes, and CI/agents can tell an infrastructure crash apart from real type errors.

---

_Verified: 2026-06-29T19:20:00Z_
_Verifier: Claude (gsd-verifier)_
