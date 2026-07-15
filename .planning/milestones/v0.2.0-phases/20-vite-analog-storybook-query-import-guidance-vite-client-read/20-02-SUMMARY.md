---
phase: 20-vite-analog-storybook-query-import-guidance-vite-client-read
plan: 02
subsystem: executor
tags:
  [
    nx-executor,
    devkit-logger,
    advisory,
    bundler-query,
    vite-client,
    ts2307,
  ]

# Dependency graph
requires:
  - phase: 20-vite-analog-storybook-query-import-guidance-vite-client-read
    plan: 01
    provides: "CoreResult.bundlerQueryImports?: readonly string[] ([] -> undefined) fed from the single finalize seam -- the field this executor half renders"
  - phase: 18-not-type-checked-declared-advisory
    provides: "the pure-detector -> additive-CoreResult-field -> executor-logger.warn triad (warnNotTypeChecked) mirrored exactly here"
provides:
  - "warnBundlerQueryImports(result) -- the fifth advisory executor notice, one logger.warn (count + \"types\": [\"vite/client\"] fix + ADVISORY-not-suppressed + specifiers)"
  - "call site after warnNotTypeChecked(result) in typecheckExecutor"
  - "render + self-gate unit tests (bundlerQueryCoreResult helper) locking the notice fires once and stays silent when the field is undefined"
affects:
  - 20-03 (README Signal 1 cross-references the same advisory the executor renders)

# Tech tracking
tech-stack:
  added: [] # no new runtime or dev dependencies
  patterns:
    - "executor advisory render mirrors warnNotTypeChecked exactly: optional-chained length self-gate, ONE logger.warn, consumer's OWN specifiers only (content isolation), verdict untouched"
    - "self-gating on field PRESENCE (D-03) -- no new public option"

key-files:
  created: []
  modified:
    - packages/angular-typechecker/src/executors/typecheck/executor.ts
    - packages/angular-typechecker/src/executors/typecheck/executor.spec.ts

key-decisions:
  - "warnBundlerQueryImports fires AFTER warnNotTypeChecked (D-04 order); the message names the count, the \"types\": [\"vite/client\"] fix (with the ambient 'declare module' shim as fallback), states the TS2307 are NOT suppressed (charter), and lists result.bundlerQueryImports.join(', ')"
  - "content isolation (T-20-02): the notice names ONLY the consumer's own specifiers from the POST-filter kept set -- no dependency error text, mirroring warnNotTypeChecked / warnSuppressed"
  - "verdict integrity (T-20-03): additive signalling only; evaluateResult owns { success } and never reads the field -- the silent-when-undefined test guards the false positive"
  - "both executor doc-comments bumped four -> five; the field enumeration gains bundlerQueryImports (Pitfall 4)"

# Metrics
metrics:
  duration: ~3 min
  completed: 2026-07-07
  tasks_completed: 2
  files_created: 0
  files_modified: 2
  commits: 2
---

# Phase 20 Plan 02: Executor bundler-query-import advisory render Summary

Signal 2's executor half (D-04): render the core's pure `CoreResult.bundlerQueryImports` field as ONE loud `@nx/devkit` `logger.warn`, mirroring `warnNotTypeChecked` exactly -- the fifth advisory notice. Core stays framework-agnostic; the executor adapter is the only tier that logs.

## What Was Built

- **`warnBundlerQueryImports(result)`** in `executor.ts`: an optional-chained length self-gate (`if (!result.bundlerQueryImports?.length) { return; }` -- D-03), then exactly ONE `logger.warn` whose message names the count, says the imports use a bundler query suffix (e.g. `?raw/?url/?worker/?inline`) that looks like a Vite/Analog import, recommends `"types": ["vite/client"]` in the checked tsconfig (with the ambient `declare module` shim as fallback), states plainly this is ADVISORY -- the TS2307 are NOT suppressed (a missing module can be a real bug), and lists the specifiers via `result.bundlerQueryImports.join(', ')`. Named the fifth `warn*` helper, placed after `warnNotTypeChecked` in both the call block and the definitions.
- **Doc-comment updates**: both executor doc-comments bumped from "four" to "five" advisory `warn*` notices, and the field enumeration gained `bundlerQueryImports` (Pitfall 4).
- **Unit tests** in `executor.spec.ts`: a `bundlerQueryCoreResult(specs)` helper (`{ ...coreResult(2), bundlerQueryImports: specs }` -- the `?query` TS2307 are counted errors); a render test asserting a single `logger.warn` containing `vite/client`, `ADVISORY`, and the specifier `./x?raw` with NO `logger.error`; a silent test asserting no `logger.warn` when the field is undefined.

## How It Works

`typecheckExecutor` composes the pure core, then fires the advisory notices BEFORE the codeframe report so they cannot be lost below a long dump. `warnBundlerQueryImports(result)` is the fifth, after `warnNotTypeChecked(result)`. It reads the field 20-01 put on `CoreResult` (self-gating: the field is `undefined` unless the core found an unresolved `?query` TS2307 in the post-boundary-filter kept set). The verdict is never touched -- `evaluateResult` alone owns `{ success }` and its `EvaluateInput` `Pick` structurally omits the field.

## Verification

- `npx nx build angular-typechecker` -- exits 0 (executor compiles under `module: nodenext`).
- `npx nx test angular-typechecker` -- 347 tests pass (47 files), including the new render + silent tests.
- `git grep` confirms the call site appears once, after `warnNotTypeChecked(result);`, and that neither "the four advisory" nor "The four warn" survives (both bumped to five).

## Deviations from Plan

None - plan executed exactly as written.

## Threat Model Compliance

- **T-20-02 (Information Disclosure)** mitigated: the notice names ONLY `result.bundlerQueryImports` (the consumer's own specifiers from the POST-filter kept set); no dependency error text.
- **T-20-03 (Tampering / verdict integrity)** mitigated: the notice is additive signalling before the report; `evaluateResult` alone owns `{ success }` and never reads the field. The silent-when-undefined test guards against a false positive.
- **T-20-SC**: accepted -- no package installs in this phase.

## Notes for Next Steps

20-03 (README Signal 1) leads with the same `"types": ["vite/client"]` fix and cross-references the `bundlerQueryImports` field this notice renders. SB-09 is not closed until phase verification (Gate A CI + Gate B manual radix-ng UAT).

## Self-Check: PASSED

- Files: `executor.ts`, `executor.spec.ts`, `20-02-SUMMARY.md` all present.
- Commits: `7b4c240` (feat), `a69b10f` (test) both in history.
