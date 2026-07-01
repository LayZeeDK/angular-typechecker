---
phase: 13-engine-solution-tsconfig-reference-walking
plan: 05
subsystem: core-engine-tests
tags: [testing, walk-references, integration, unit, WALK-01]
requires:
  - 'fixtures/solution-style* (Plan 13-02)'
  - 'runTypecheck reference-walk wiring (Plan 13-04)'
provides:
  - 'walk-references.integration.spec.ts (real-compiler SC1/SC2/SC3/D-04/D-05 proofs)'
  - 'cross-leaf detectTemplateCheckAborted union unit'
  - 'executor skippedReferences logger.warn render unit'
affects:
  - 'packages/angular-typechecker/src/core/walk-references.integration.spec.ts'
  - 'packages/angular-typechecker/src/core/run-typecheck.spec.ts'
  - 'packages/angular-typechecker/src/executors/angular-typecheck/executor.spec.ts'
tech-stack:
  added: []
  patterns:
    - 'Real-compiler *.integration.spec.ts off CoreResult (30000 timeout inherited from vitest.config.mts)'
    - 'it.each three-way SC3 split table'
    - 'Synthesized cross-leaf diagnostic union for a pure detector unit'
    - 'vi.hoisted mocked-core adapter unit (skippedReferences render seam)'
key-files:
  created:
    - 'packages/angular-typechecker/src/core/walk-references.integration.spec.ts'
  modified:
    - 'packages/angular-typechecker/src/core/run-typecheck.spec.ts'
    - 'packages/angular-typechecker/src/executors/angular-typecheck/executor.spec.ts'
decisions:
  - "Task 2 required no source change: Plan 13-04 already rewrote the config-resolution solution-style block to the walk assertions and left COR-01 byte-unchanged; reconciled and confirmed against the plan's acceptance criteria."
metrics:
  duration: '~25 min'
  tasks_completed: 3
  files_created: 1
  files_modified: 2
  tests_added: 14
  completed: 2026-07-01
requirements: [WALK-01]
---

# Phase 13 Plan 05: Walk-Reference Validation Proofs Summary

Closed the WALK-01 validation contract's behavioral half with a real-compiler
integration spec (SC1/SC2/SC3/D-04/D-05) against the Plan 13-02 fixtures, a pure
cross-leaf `detectTemplateCheckAborted` union unit, and an executor
`skippedReferences` render unit -- every locked walk decision now has an automated
proof off `CoreResult`.

## What Was Built

### Task 1 -- `walk-references.integration.spec.ts` (real compiler, 9 tests)

Mirrors the `config-resolution.integration.spec.ts` harness (path helpers,
`TS2322`/`NG()` consts, `codesOf` helper, inherited 30000 cold-compiler timeout).
Drives `runTypecheck({ tsConfigPath })` against each solution-style fixture and
asserts off `CoreResult`:

- **SC1/SC2 union completeness + both leaves ran** (`solution-style`):
  `rootNamesCount > 0`, `errorCount === 2`, exactly two `code === 2322` in DISTINCT
  files (`error.component.ts` vs `error.component.spec.ts` -- the spec-only error is
  the named build differentiator), `skippedReferences === undefined`.
- **SC2 cross-`Program` dedupe collapse** (`solution-style-overlap`): the shared
  `shared.component.ts` diagnostic gathered in both the lib and spec Programs
  collapses to EXACTLY one `(fileName, code)` entry; `errorCount === 1`.
- **SC2 boundary skip** (`solution-style-oop`, threat T-13-01): the out-of-project
  leaf's TS2322 is NOT in `codes` (leak tripwire); `rootNamesCount === 0`,
  `errorCount === 1`, `90001` present; `skippedReferences` has a
  `reason: 'out-of-project'` entry.
- **SC3 three-way split** (`it.each`): `solution-style` -> WALK (`rootNamesCount>0`,
  err 2, no 90001); `-oop` -> `90001` none-in-project; `-empty` -> `90001`
  empty-project.
- **SC3/D-05 fold-and-count** (`solution-style-broken-ref`, threat T-13-02): exactly
  one `90002`, the survivor leaf's TS2322 also present, `errorCount >= 2`,
  `skippedReferences` `reason: 'not-found'`, AND a NEGATIVE assertion that the run
  RESOLVES (does NOT reject with `TypecheckInfrastructureError` -- the per-leaf 500
  was reclassified, not rethrown).
- **D-04 self/duplicate ref** (`solution-style-selfref`): the single leaf TS2322
  appears exactly once despite the self + duplicate edges; `skippedReferences`
  `reason: 'self-reference'`.

### Task 2 -- config-resolution solution-style block (RECONCILED, no source change)

Plan 13-04 (commit `5ac2f0f`, already part of this plan's base) rewrote the
`config-resolution.integration.spec.ts` solution-style block to the walk assertions
(`rootNamesCount > 0`, `errorCount === 2`, two distinct-file TS2322,
`skippedReferences === undefined`) and retained the TS18003-independence `it`, while
leaving the COR-01 direct nonexistent-path pinning test (`:104-126`,
`rejects.toBeInstanceOf(TypecheckInfrastructureError)`) byte-unchanged. Reconciled
per the plan's `<already_done_note>`: read the CURRENT file, confirmed it matches
every Task 2 acceptance criterion (including the `skippedReferences === undefined`
line), and verified via `git diff <walk-wiring>^ <walk-wiring>` that the COR-01
block was untouched by the rewrite. No further edit was required, so this task has
no commit.

### Task 3 -- cross-leaf TCB union unit + executor skippedReferences render unit (5 tests)

- `run-typecheck.spec.ts` (+2): `detectTemplateCheckAborted` fires on a TCB fatal
  (`TCB_GENERATION_FATAL_DIAGNOSTIC_CODE === NG(3004)`) present in the SECOND leaf of
  a synthesized `[...leafAClean, ...leafBWithTcbFatal]` union (proving the pre-filter
  union scan catches a poison in ANY walked leaf), and returns `undefined` for a
  union with no such code. Detection is BY CODE only, order-independent.
- `executor.spec.ts` (+3): a non-empty `skippedReferences` triggers one
  `logger.warn` PER entry (naming path + reason); an `undefined` `skippedReferences`
  triggers NO warn (no false positive); and the notice is advisory-only -- the
  `{ success }` verdict is delegated to `evaluateResult` and unchanged by the skip.

## Deviations from Plan

None. Plan executed as written. Task 2 was a reconciliation-only task by design
(the plan's `<already_done_note>` anticipated that 13-04 had already performed the
rewrite); the current file satisfies every Task 2 acceptance criterion with no edit
needed, so no Task 2 commit exists.

## Known Stubs

None. All added specs assert real behavior off the live compiler (Tasks 1) or a
controlled synthesized/mocked seam (Task 3). No placeholder values, no empty
data sources.

## Threat Coverage

- **T-13-01 (out-of-project ref traversal / info disclosure):** Task 1
  `solution-style-oop` spec proves the outsider's error is absent from `codes` and
  that `skippedReferences` records `reason: 'out-of-project'`; Task 3 proves the
  adapter surfaces it via `logger.warn`. This is the test that catches a
  no-guard-baseline leak.
- **T-13-02 (broken-reference false PASS / tampering):** Task 1
  `solution-style-broken-ref` spec proves one counted `90002` + survivor TS2322 AND
  that `runTypecheck` RESOLVES (no rethrow); the COR-01 direct-500 rethrow stays
  byte-unchanged (Task 2), pinning the fold-and-count semantics.
- **T-13-SC (package installs):** accepted -- no package installs (test-only
  additions).

No new security-relevant surface introduced (test-only additions).

## Verification

- `NX_DAEMON=false npx nx test angular-typechecker --skip-nx-cache`: **26 files,
  208 tests passing** (up from 203; +9 integration in Task 1, +5 unit in Task 3).
  The `test` target `dependsOn: ["build"]`, so the build is green too.
- `git diff d53d2cd -- config-resolution.integration.spec.ts` is EMPTY -- COR-01
  (`:104-126`) and the TS18003-independence `it` are byte-unchanged.

## Commits

- `fdc7e51`: test(core): add walk-references real-compiler integration proofs (WALK-01)
- `1cefeb2`: test(core): cross-leaf TCB union scan + executor skippedReferences render (WALK-01)

(Task 2 has no commit -- reconciliation-only, already satisfied by base commit `5ac2f0f`.)

## Self-Check: PASSED

- FOUND: packages/angular-typechecker/src/core/walk-references.integration.spec.ts
- FOUND: packages/angular-typechecker/src/core/run-typecheck.spec.ts (modified)
- FOUND: packages/angular-typechecker/src/executors/angular-typecheck/executor.spec.ts (modified)
- FOUND commit: fdc7e51
- FOUND commit: 1cefeb2
- STATE.md / ROADMAP.md: untouched (worktree mode; orchestrator-owned)
