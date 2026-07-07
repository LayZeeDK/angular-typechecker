---
phase: 18-packaged-tarball-e2e-docs
plan: 01
subsystem: testing
tags: [angular-compiler-cli, typescript, nx-executor, jsx, mdx, storybook, advisory-notice]

# Dependency graph
requires:
  - phase: 17-input-set-membership-boundary-layout-support
    provides: "skippedReferences / templateCheckAborted / suppressedInGraphFiles detection-in-core + render-in-executor split; WalkResult.rootNamePaths surviving-leaf aggregation; the three-state clean/coverage-incomplete/type-error verdict"
provides:
  - "CoreResult.notTypeCheckedDeclaredFiles?: readonly string[] -- declared-but-uncheckable files (.mdx always; .tsx when jsx unset/None), advisory, []->undefined"
  - "Pure detect-unchecked-declared.ts (detectTsxWithoutJsx + detectUncheckedDeclaredFiles) reused by the walk + direct engine paths"
  - "Executor logger.warn 'not type-checked' advisory naming the consumer's own declared files"
  - "Negative unit tests locking the field OUT of the verdict (stays green)"
affects: [18-03 T11 integration fixture, 18-05 README CoreResult shape + Storybook caveats, phase-19 SB-08 actual .mdx/.tsx checking]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure declared-surface detection via ts.parseJsonConfigFileContent extraFileExtensions (never a hand-rolled glob)"
    - "Advisory CoreResult field mirroring skippedReferences: []->undefined conditional-spread on both walk + direct paths; deliberately NOT wired into evaluateResult"

key-files:
  created:
    - packages/angular-typechecker/src/core/detect-unchecked-declared.ts
    - packages/angular-typechecker/src/core/detect-unchecked-declared.spec.ts
  modified:
    - packages/angular-typechecker/src/core/run-typecheck.ts
    - packages/angular-typechecker/src/core/walk-references.ts
    - packages/angular-typechecker/src/executors/typecheck/executor.ts
    - packages/angular-typechecker/src/executors/typecheck/executor.spec.ts
    - packages/angular-typechecker/src/core/evaluate-result.spec.ts

key-decisions:
  - "Named the field notTypeCheckedDeclaredFiles (RESEARCH RQ2 recommendation); it will surface in the README CoreResult shape comment (plan 18-05)"
  - "detectUncheckedDeclaredFiles reads the leaf tsconfig via ts.readConfigFile + ts.parseJsonConfigFileContent extraFileExtensions for .mdx; .tsx filters parsed.rootNames since .tsx is always a TS extension"
  - "evaluate-result.ts left UNCHANGED (field absent from EvaluateInput); the negative test is the tripwire against future accidental wiring (Pitfall 2)"

patterns-established:
  - "Detection-in-core / render-in-executor: the D-01 advisory follows the shipped skippedReferences precedent exactly"
  - "Surviving-leaf-tail aggregation: notTypeCheckedDeclaredFiles pushed beside rootNamePaths AFTER every skip continue (Pitfall 7)"

requirements-completed: [SB-06]

# Metrics
duration: 12min
completed: 2026-07-06
---

# Phase 18 Plan 01: D-01 not-type-checked advisory (engine + executor) Summary

**Declared `.mdx` / `.tsx`-without-`jsx` files now surface a loud advisory (`CoreResult.notTypeCheckedDeclaredFiles` -> one executor `logger.warn`) while the verdict stays green -- criterion 3 / T11's engine half.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-06T13:43:00+0200
- **Completed:** 2026-07-06T13:50:32+0200
- **Tasks:** 3
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- Pure `detect-unchecked-declared.ts`: `detectTsxWithoutJsx` (unit-proven with synthetic input) + `detectUncheckedDeclaredFiles` (unions `.tsx`-without-`jsx` + `.mdx` enumerated via `ts.parseJsonConfigFileContent` `extraFileExtensions`).
- `CoreResult.notTypeCheckedDeclaredFiles?: readonly string[]` surfaced on BOTH engine paths (walk surviving-leaf aggregation + direct single-leaf), `[]`->`undefined` via the shipped conditional-spread idiom.
- One executor `logger.warn` gated on `result.notTypeCheckedDeclaredFiles?.length`, after the `suppressedInGraph` block and before `renderReport`, naming the consumer's OWN files only.
- Verdict locked GREEN: `evaluate-result.ts` untouched; negative unit tests prove a non-empty field + `errorCount 0` stays `{ success: true, outcome: 'clean' }` (incl. under `maxWarnings: 0`).
- Behavioral render test asserts the warn actually fires with the "not type-checked" advisory naming the file (the structural grep alone cannot prove the gate emits).

## Task Commits

Each task was committed atomically:

1. **Task 1: Pure detector + unit spec (TDD)** - `ba0aadc` (test, RED) then `7a794ad` (feat, GREEN); follow-up `e41a205` (style: purity-note reword + prettier)
2. **Task 2: Surface notTypeCheckedDeclaredFiles on CoreResult (walk + direct)** - `9bbcd80` (feat)
3. **Task 3: Executor render block + green-verdict negative test** - `25e8c09` (feat)

_TDD Task 1 followed RED (`ba0aadc`) -> GREEN (`7a794ad`); no refactor needed._

## Files Created/Modified
- `packages/angular-typechecker/src/core/detect-unchecked-declared.ts` - Pure `.tsx`/`jsx` filter + `.mdx` enumeration detector (core-pure, no logging/Node globals).
- `packages/angular-typechecker/src/core/detect-unchecked-declared.spec.ts` - Synthetic-input unit spec for the `.tsx`/`jsx` branches.
- `packages/angular-typechecker/src/core/run-typecheck.ts` - New `CoreResult` field + attach on the walk (`rootNamesCount>0`) and direct returns.
- `packages/angular-typechecker/src/core/walk-references.ts` - `WalkResult.notTypeCheckedDeclaredFiles` aggregated in the surviving-leaf tail beside `rootNamePaths`.
- `packages/angular-typechecker/src/executors/typecheck/executor.ts` - The `logger.warn` "not type-checked" advisory render block.
- `packages/angular-typechecker/src/executors/typecheck/executor.spec.ts` - Behavioral render test + no-false-positive test.
- `packages/angular-typechecker/src/core/evaluate-result.spec.ts` - Negative tests locking the field out of the verdict.

## Decisions Made
- Field name `notTypeCheckedDeclaredFiles` (RESEARCH RQ2). `.mdx` via `extraFileExtensions` (public API, honors include/exclude/files exactly), `.tsx` via `parsed.rootNames.endsWith('.tsx')` + `jsx` unset/None.
- The negative-verdict test introduces the D-01 field via a `const` variable (excess-property checks fire only on fresh literals) rather than a cast, since `EvaluateInput` deliberately omits it.

## Deviations from Plan

None - plan executed exactly as written. One presentation-only correction: reworded the detector's doc comments to avoid the literal `console`/`process` tokens so the core-purity `git grep` acceptance check (scoped to the new file) returns nothing; the file was already pure (no runtime globals). Prettier wrapped the `extraFileExtensions` literal.

## Issues Encountered
- The initial post-`git add` purity grep gave a false PASS because `git grep` skips UNtracked files (CLAUDE.md gotcha). After committing, the grep matched the words `console`/`process` in doc comments; reworded the comments so the literal check is clean. eslint core-purity lint passes (`nx lint` green).

## Verification
- `npx nx test angular-typechecker` -> 319 passed (41 files); +8 over the pre-plan 311 (4 detector + 2 evaluate-result + 2 executor).
- `npx nx build angular-typechecker` -> green (vendored-type drift guard).
- `git grep -n -e console -e process -- .../detect-unchecked-declared.ts` -> nothing (core purity).
- `git grep -c notTypeCheckedDeclaredFiles`: run-typecheck.ts = 6 (>=3), walk-references.ts = 4 (>=2), evaluate-result.ts = 0.
- `npx nx lint angular-typechecker` -> pass; my files pass `prettier --check`.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The T11 engine half is complete. Plan 18-03 adds the in-repo integration fixture (a declared `.mdx` and/or JSX-free `.tsx` with `jsx` unset) proving the notice fires end-to-end AND the verdict stays clean (Assumption A1/A2 verification).
- Plan 18-05 (README) must add `notTypeCheckedDeclaredFiles?: readonly string[]` to the Programmatic-API `CoreResult` shape comment and the `.mdx`/`.tsx` caveats.

## Self-Check: PASSED

- All created files present on disk (detector, detector spec, SUMMARY).
- All task commits present in git log (`ba0aadc`, `7a794ad`, `9bbcd80`, `e41a205`, `25e8c09`, `f200322`).

---
*Phase: 18-packaged-tarball-e2e-docs*
*Completed: 2026-07-06*
