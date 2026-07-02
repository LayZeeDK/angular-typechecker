---
phase: 12-extended-diagnostic-catalog-completeness-tripwire
plan: 01
subsystem: testing
tags: [angular-compiler-cli, extended-diagnostics, type-level-assertion, typecheck-drift, nx, drift-tripwire]

# Dependency graph
requires:
  - phase: v0.0.3 Phase 10 (Drift-hardening)
    provides: the tsconfig.drift.json + typecheck-drift Nx target + the compiler-cli-types.drift.ts AssertAssignable pattern this tripwire mirrors and rides
provides:
  - "EXTENDED_DIAGNOSTIC_MEMBERS: the single as-const 18-member source of truth (D-02), dependency-free"
  - "extended-catalog.drift.ts: a type-level mutual set-equality tripwire vs the real ExtendedTemplateDiagnosticName enum (DRIFT-01), run by typecheck-drift, never ships"
  - "Compile-verified deep-import specifier '@angular/compiler-cli/src/ngtsc/diagnostics' under classic resolution (Assumption A2 resolved)"
affects: [Phase 12 Plan 02 catalog integration spec (consumes EXTENDED_DIAGNOSTIC_MEMBERS as it.each row keys), milestone audit (CAT-01/CAT-04 catalog rows must derive from this list)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deep sub-barrel type import of a non-public compiler-cli enum under classic moduleResolution:node (differs from the barrel import compiler-cli-types.drift.ts uses)"
    - "Value-union mutual set-equality tripwire: `${Enum}` string-value union vs an as-const list's [number] union, both directions asserted via the vendored AssertAssignable"

key-files:
  created:
    - packages/angular-typechecker/src/core/extended-catalog.members.ts
    - packages/angular-typechecker/src/core/extended-catalog.drift.ts
  modified:
    - packages/angular-typechecker/tsconfig.drift.json
    - packages/angular-typechecker/project.json

key-decisions:
  - "Deep-import the enum from the sub-barrel '@angular/compiler-cli/src/ngtsc/diagnostics' (verified re-export); no fallback to the leaf path was needed -- it compiled green on the first try under tsconfig.drift.json"
  - "Compared the enum's string-VALUE union against the catalog list (A3), not member-NAME keys, so the runtime it.each table (Plan 02) can key rows on the same values"
  - "Vendored AssertAssignable<From, To extends From> rather than adding tsd/expect-type (zero new dependency, consistent with the existing drift file)"

patterns-established:
  - "Single as-const source-of-truth module (dependency-free, mirrors diagnostic-codes.ts) consumed by BOTH a runtime spec and a type-level tripwire so the two cannot drift"
  - "A type-level completeness tripwire that fails loudly at a named probe slot when the hand-mirrored list diverges from the upstream enum"

requirements-completed: [DRIFT-01]

# Metrics
duration: 5min
completed: 2026-07-01
---

# Phase 12 Plan 01: Extended-diagnostic catalog source of truth + completeness tripwire Summary

**A dependency-free 18-member `as const` source of truth plus a type-level `typecheck-drift` tripwire that mutually set-equals it to the real `ExtendedTemplateDiagnosticName` enum -- proven to fail loudly (TS2344) when a member drifts and to return green when restored.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-01T06:18:02Z
- **Completed:** 2026-07-01T06:22:47Z
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 edited)

## Accomplishments

- Established the D-02 single source of truth: `EXTENDED_DIAGNOSTIC_MEMBERS`, the 18 `ExtendedTemplateDiagnosticName` string values as one dependency-free `as const` list in enum declaration order, verified against the installed `@angular/compiler-cli@22.0.4` enum d.ts.
- Built the DRIFT-01 completeness tripwire (`extended-catalog.drift.ts`): a type-only mutual set-equality assertion (catalog subset of enum AND enum subset of catalog) using the vendored `AssertAssignable` helper and the deep sub-barrel enum import.
- Compile-verified the deep-import specifier `@angular/compiler-cli/src/ngtsc/diagnostics` resolves the enum under classic `moduleResolution: node` in `tsconfig.drift.json` (RESEARCH Assumption A2 -- the only unverified-by-compile assumption in the phase -- now RESOLVED; no leaf-path fallback needed).
- Wired the tripwire into `tsconfig.drift.json` `files` and the `typecheck-drift` target `inputs[]` so Nx cache-invalidates on the drift file or its members list changing; the `*.drift.ts` exclude glob keeps it out of `nx build` / `nx test` / the tarball.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the `as const` 18-member source of truth** - `83a30ac` (test)
2. **Task 2: Create the type-level enum-vs-list tripwire (DRIFT-01)** - `5d9b790` (test)
3. **Task 3: Wire the tripwire into tsconfig.drift.json + project.json and verify it compiles** - `0d814a3` (build)

_No TDD tasks in this plan (type-level tripwire + config wiring; the RED proof is a manual deliberate-drift check, recorded below, not a committed test)._

## Files Created/Modified

- `packages/angular-typechecker/src/core/extended-catalog.members.ts` (created) - The single dependency-free `as const` list of the 18 extended-diagnostic member string values (D-02); consumed by both the Plan 02 catalog spec and the tripwire.
- `packages/angular-typechecker/src/core/extended-catalog.drift.ts` (created) - Type-only tripwire asserting mutual set-equality between the members list and the real enum's string-value union (DRIFT-01); compiles only under `tsconfig.drift.json`, never ships.
- `packages/angular-typechecker/tsconfig.drift.json` (modified) - Added `src/core/extended-catalog.drift.ts` to the `files` array (classic-resolution drift compile).
- `packages/angular-typechecker/project.json` (modified) - Added the new drift file and its members source of truth to the `typecheck-drift` target `inputs[]` (Nx cache invalidation); `@angular/compiler-cli` stays in `externalDependencies`, not duplicated.

## Deliberate-RED Proof (DRIFT-01 acceptance criterion)

The tripwire was proven to fail loudly on drift and return green when the drift is undone:

1. **GREEN (baseline, tripwire in scope):** `npx nx typecheck-drift angular-typechecker --skip-nx-cache` exited **0** with `extended-catalog.drift.ts` compiled under the drift tsconfig. This is the load-bearing verification of the deep-import specifier (Assumption A2).
2. **RED (deliberate drift):** Temporarily removed `'deferTriggerMisconfiguration'` from `EXTENDED_DIAGNOSTIC_MEMBERS`. Re-ran `typecheck-drift` -> exited **1** with:
   ```
   packages/angular-typechecker/src/core/extended-catalog.drift.ts:64:58 - error TS2344:
   Type '... | "deferTriggerMisconfiguration"' does not satisfy the constraint '... | "uninvokedFunctionInTextInterpolation"'.
     Type '"deferTriggerMisconfiguration"' is not assignable to type '...'.
   64 type CatalogCoversEnum = AssertAssignable<CatalogValues, EnumValues>;
   ```
   The failure lands at line 64 -- the `CatalogCoversEnum` probe slot -- and names the drifted member. (A member ADDED upstream would instead fail `EnumCoversCatalog`.)
3. **GREEN (restored):** Restored the member. Re-ran `typecheck-drift` -> exited **0**. The members module was confirmed byte-identical to its committed state (`git diff` clean) -- the file was NOT left in the RED state.

## Decisions Made

- **Deep-import from the sub-barrel, no fallback needed:** The plan allowed a fallback to the leaf path `'@angular/compiler-cli/src/ngtsc/diagnostics/src/extended_template_diagnostic_name'` if the sub-barrel specifier failed to resolve under classic resolution. It resolved green on the first `typecheck-drift` run, so the sub-barrel specifier `'@angular/compiler-cli/src/ngtsc/diagnostics'` is used as-authored; the leaf fallback was not exercised.
- **Value-union comparison (A3):** Compared `` `${ExtendedTemplateDiagnosticName}` `` (string-value union) against `(typeof EXTENDED_DIAGNOSTIC_MEMBERS)[number]`, not the SCREAMING_SNAKE member-NAME keys, so the Plan 02 runtime `it.each` table can key its rows on the same string values it asserts against.
- **NG8011 treated as a normal member (correctness guard honored):** `controlFlowPreventingContentProjection` (NG8011) is included in the list like any other member -- no "not promotable" special-casing anywhere (D-09 CORRECTED; this plan only touches the member SET, so the promotability correction is not exercised here but the list membership is correct).

## Deviations from Plan

None - plan executed exactly as written. All three tasks landed as specified; the deep-import specifier compiled without needing the documented leaf-path fallback; no dependencies were added (this plan installs no packages by design, per the threat model T-12-SC).

## Issues Encountered

None. The one live risk (Assumption A2 -- whether the deep enum import resolves under classic resolution in `tsconfig.drift.json`) was resolved on the first `typecheck-drift` run: it compiled green.

## Known Stubs

None. `EXTENDED_DIAGNOSTIC_MEMBERS` is a complete, hardcoded 18-value list by design (the D-02 hand-mirror of a non-runtime-exported enum), kept honest by the DRIFT-01 tripwire this plan delivers -- not a stub.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 02 (catalog integration spec) is unblocked:** `EXTENDED_DIAGNOSTIC_MEMBERS` is the source-of-truth list its 18-row `it.each` table keys on; the tripwire guarantees that table's row set stays lockstep with the real enum.
- **DRIFT-01 is complete and CI-wired:** the existing CI gate already runs `nx run-many -t typecheck-drift test -p angular-typechecker`, so a future Angular release that adds/renames/removes an extended-diagnostic member will fail CI loudly at the tripwire's probe slot -- no `ci.yml` change was needed.
- No blockers.

## Self-Check: PASSED

- Created files verified on disk: `extended-catalog.members.ts`, `extended-catalog.drift.ts`, `12-01-SUMMARY.md` (all FOUND).
- Task commits verified in git log: `83a30ac`, `5d9b790`, `0d814a3` (all FOUND).

---
*Phase: 12-extended-diagnostic-catalog-completeness-tripwire*
*Completed: 2026-07-01*
