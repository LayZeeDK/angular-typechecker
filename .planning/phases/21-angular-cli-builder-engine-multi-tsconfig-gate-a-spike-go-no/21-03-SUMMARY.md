---
phase: 21-angular-cli-builder-engine-multi-tsconfig-gate-a-spike-go-no
plan: 03
subsystem: testing
tags: [nx, angular-cli, builder, convertNxExecutor, architect, schema-parity, vitest, ACB-01, ACB-03]

# Dependency graph
requires:
  - phase: 21-01
    provides: builder.ts (convertNxExecutor re-export), builders.json, package.json builders field, executors.json
  - phase: 21-02
    provides: widened builder schema.json tsConfig oneOf string|array + TypecheckExecutorOptions string|string[]
provides:
  - Sanitized builder-schema parity guard (builder schema.json <-> TypecheckExecutorOptions, incl. sanitization + oneOf)
  - Thin-wrapper structural parity guard (builder = convertNxExecutor(typecheckExecutor), source + runtime)
  - executors ?? builders Nx-surface regression guard (additive builders never shadows the executor)
affects: [22-configuration-write-fork, 23-ng-add-init, 24-e2e-additive-audit-docs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sanitized-schema parity spec: mirror the executor parity spec but assert the INVERSE (no cli/version/$id) plus the ENG-01 tsConfig oneOf"
    - "Thin-wrapper guard: source-byte regex + runtime Architect-brand assertion to forbid an engine fork (D-04 charter enforcement in CI)"
    - "Nx-surface regression: pure package.json + executors.json read-and-assert for the executors ?? builders precedence"

key-files:
  created:
    - packages/angular-typechecker/src/builders/typecheck/schema-parity.spec.ts
    - packages/angular-typechecker/src/builders/typecheck/builder.spec.ts
    - packages/angular-typechecker/src/builders/typecheck/nx-surface-regression.spec.ts
  modified: []

key-decisions:
  - "Bound builder-schema EXPECTED_KEYS to TypecheckExecutorOptions via satisfies + AssertAssignable reverse-coverage probe (compile-time drift protection; T-21-07 mitigation), rather than a bare literal"
  - "Corrected the plan's runtime assertion: convertNxExecutor returns an Architect Builder OBJECT branded with Symbol.for('@angular-devkit/architect:builder') + a handler function, NOT a bare function; asserted the brand + handler (stronger than typeof === 'function')"

patterns-established:
  - "Sanitized builder-schema parity guard keyed to the executor options interface"
  - "convertNxExecutor thin-wrapper guard: source-regex + Architect-brand runtime check"
  - "executors ?? builders additive-safety regression guard"

requirements-completed: [ACB-01, ACB-03]

# Metrics
duration: ~10min
completed: 2026-07-10
---

# Phase 21 Plan 03: In-repo builder guard suite (ACB-01 + ACB-03) Summary

**Three pure Vitest specs that keep the Angular CLI builder honest in CI: the sanitized builder schema cannot drift from TypecheckExecutorOptions, the builder can never fork the engine (it must stay convertNxExecutor(typecheckExecutor)), and the additive builders field can never make the Nx executor un-resolvable.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-10T20:44:00Z
- **Completed:** 2026-07-10T20:50:07Z
- **Tasks:** 3
- **Files modified:** 3 (all new specs; zero production code)

## Accomplishments
- `schema-parity.spec.ts`: locks the builder schema.json property keys to TypecheckExecutorOptions (bound at COMPILE time via `satisfies` + reverse-coverage probe), asserts `required:['tsConfig']`, `additionalProperties:false`, the includeDeps/failFast/strict defaults, `maxWarnings` has no default, the ENG-01 `tsConfig` `oneOf` string|array(minItems 1), AND the Architect-dialect sanitization (no `cli`/`version`/`$id`).
- `builder.spec.ts`: source-byte regex proves builder.ts imports `convertNxExecutor` from `@nx/devkit`, imports the executor default from `../../executors/typecheck/executor`, and default-exports exactly `convertNxExecutor(typecheckExecutor)` -- failing loudly on an engine fork or a hand-written architect builder (D-04). Runtime assertion proves the default export is a genuine Architect builder (global brand symbol + `handler` function); the clean static import proves no `@angular/compiler-cli` load.
- `nx-surface-regression.spec.ts`: asserts package.json `executors === './executors.json'` (unchanged) and `builders === './builders.json'` (additive), and that executors.json still declares the `typecheck` executor implementation -- so Nx's `executors ?? builders` precedence resolves the executor and never reads builders.json.
- Full suite green: 274 tests, `nx lint` clean, `nx format:check` clean; no production code changed.

## Task Commits

Each task was committed atomically:

1. **Task 1: Builder schema-parity spec (sanitized, oneOf)** - `30e5a1b` (test)
2. **Task 2: Builder thin-wrapper structural parity spec** - `a51e540` (test)
3. **Task 3: Nx-surface regression spec (executors ?? builders)** - `742816f` (test)

## Files Created/Modified
- `packages/angular-typechecker/src/builders/typecheck/schema-parity.spec.ts` - Sanitized builder-schema parity guard vs TypecheckExecutorOptions (inverse cli/version/$id assertion + oneOf)
- `packages/angular-typechecker/src/builders/typecheck/builder.spec.ts` - Thin-wrapper structural parity (builder = convertNxExecutor(typecheckExecutor); source + runtime)
- `packages/angular-typechecker/src/builders/typecheck/nx-surface-regression.spec.ts` - executors ?? builders regression (Nx surface byte-unchanged)

## Decisions Made
- **satisfies binding over a bare literal.** The plan marked the compile-time `satisfies readonly (keyof TypecheckExecutorOptions)[]` binding as optional. Adopted the full configuration-spec pattern (satisfies + `AssertAssignable` reverse-coverage probe) because it directly implements the T-21-07 mitigation ("locks the builder option surface to TypecheckExecutorOptions") -- a field added to the executor interface but not listed now fails the type-check, which a hand-literal alone could not catch. The builder reuses the executor's interface (no separate builder schema.d.ts), so this pins both option surfaces to one source of truth.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the builder runtime-shape assertion**
- **Found during:** Task 2 (Builder thin-wrapper structural parity spec)
- **Issue:** The plan (and the 21-RESEARCH interfaces note) specified the runtime assertion `expect(typeof builderDefault).toBe('function')`, asserting `convertNxExecutor` returns "a builder handler (a function)". This is factually wrong: `convertNxExecutor` -> `createBuilder` returns an OBJECT (not a bare function) whose own keys are `handler` (the wrapped function) + `__OptionT`, branded with the global registry symbol `Symbol.for('@angular-devkit/architect:builder') === true`. The `typeof === 'function'` assertion failed against the real return value.
- **Fix:** Asserted the correct (and stronger) runtime contract instead: `typeof builder === 'object'`, `builder[Symbol.for('@angular-devkit/architect:builder')] === true` (genuine Architect builder brand from `createBuilder`), and `typeof builder.handler === 'function'` (the wrapped executor). This proves the default export is a real Architect builder produced by `convertNxExecutor`, and the clean static import still proves no `@angular/compiler-cli` load. Verified empirically via a throwaway `require('@nx/devkit').convertNxExecutor(...)` probe (removed).
- **Files modified:** packages/angular-typechecker/src/builders/typecheck/builder.spec.ts
- **Verification:** `nx test angular-typechecker` -> builder.spec.ts 4/4 green; full suite 274 passed.
- **Committed in:** `a51e540` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix corrects an inaccurate assumption about the `@nx/devkit`/Architect API and produces a stronger, correct runtime assertion. No scope change (still a single runtime backstop to the source guard), no production code touched.

## Issues Encountered
- The scratchpad temp path (`C:\Users\LARSGY~1\...\Temp`) broke ESM `import()` module resolution for a probe script (resolved relative paths against the temp dir, not the project). Worked around by writing the probe as a CJS `require` file inside the project root and deleting it immediately -- no committed artifact.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The in-repo CI-authoritative builder guard suite is complete: schema parity, thin-wrapper structural parity, and the `executors ?? builders` regression are all locked. Combined with Plan 01's real-`ng run` GATE A' (GO) and the extended `gate-a-static` byte guard, the builder surface is fully backstopped for the fast `nx test` loop.
- Phase 21 (last plan) is complete. Ready for phase verification (`verify_phase_goal`), then secure/validate/extract-learnings. Downstream Phase 22 (the `configuration` `angular.json` write-fork) can proceed against a builder proven additive-only and parity-locked.

---
*Phase: 21-angular-cli-builder-engine-multi-tsconfig-gate-a-spike-go-no*
*Completed: 2026-07-10*
