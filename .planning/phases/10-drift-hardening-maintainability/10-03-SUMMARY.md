---
phase: 10-drift-hardening-maintainability
plan: 03
subsystem: testing
tags: [angular-compiler-cli, drift-guard, vitest, ngErrorCode, ngtsc-program, runtime-introspection]

# Dependency graph
requires:
  - phase: 09-resilience-per-file-fault-isolation-boundary-robustness
    provides: the gathered getter set (per-file getNgSemanticDiagnostics + COR-02 getGlobalDiagnostics) the runtime spec must cover
  - phase: 08-correctness-completeness-fixes
    provides: UNKNOWN_ERROR_CODE 500 + NG encoding semantics the runtime round-trip pins
provides:
  - Runtime half of the HARD-01 two-pronged drift guard (D-04)
  - SUBSET-containment getter check against the live NgtscProgram (renamed/removed getter fails loudly)
  - Additions-review filtered diff that flags any NEW upstream diagnostic getter (the build-time type gate's blind spot)
  - NG encoding round-trip assertion NG(n) === cli.ngErrorCode(n) + UNKNOWN_ERROR_CODE === 500
affects: [10-04, future-angular-upgrades, drift-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Runtime introspection of the real await import('@angular/compiler-cli') NgtscProgram in the integration test tier"
    - "SUBSET containment (typeof program[name] === 'function') over prototype EQUALITY for getter-set drift detection"
    - "Filtered prototype diff (/^get.*Diagnostics$/) as an additions-review signal complementing the build-time type gate"

key-files:
  created:
    - packages/angular-typechecker/src/core/compiler-cli-types.runtime.spec.ts
  modified: []

key-decisions:
  - "Build the real program ONCE in beforeAll with gatherDiagnostics: () => [] (shape-only, fast, deterministic) and reuse it across the getter-set + additions tests"
  - "Reused the ng-baseline fixture tsconfig.app.json per RESEARCH Open Question 2 (an Angular program that always yields an NgtscProgram)"
  - "Used SUBSET containment for the getter-set check and a filtered diff for additions, NOT prototype equality (the live NgtscProgram has runtime-only extras the shim never declares)"
  - "Imported NG/ngCodeOf from diagnostic-codes.ts rather than re-deriving parseInt('-99' + code) -- the canonical dependency-free encoding the round-trip pins against the real ngErrorCode"

patterns-established:
  - "Runtime drift spec: introspect the live NgtscProgram getter set + pin the runtime encoding the type gate cannot see"

requirements-completed: [HARD-01]

# Metrics
duration: 3min
completed: 2026-06-29
---

# Phase 10 Plan 03: Runtime getter-set + NG encoding drift spec Summary

**A runtime Vitest integration spec that introspects the REAL `await import('@angular/compiler-cli')` NgtscProgram -- SUBSET-containment of the 7 frozen gathered getters, an additions-review filtered diff, and the NG encoding round-trip -- closing the two blind spots (added getters, encoding arithmetic) the build-time HARD-01 type gate structurally cannot see.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-29T22:09:20Z
- **Completed:** 2026-06-29T22:12:29Z
- **Tasks:** 1
- **Files modified:** 1 (created)

## Accomplishments
- Authored `compiler-cli-types.runtime.spec.ts` -- the RUNTIME half of the HARD-01 two-pronged drift guard (D-04), green against the live Angular 22.0.4.
- (a) SUBSET-containment: every getter in the frozen `GATHERED_GETTERS` tuple (the 7 names `gather-diagnostics.ts` calls) is asserted present as a function on the real NgtscProgram, plus `getTsProgram().getGlobalDiagnostics` (COR-02 reach-through) -- a renamed/removed getter fails loudly at runtime.
- (b) Additions-review: the live prototype's `/^get.*Diagnostics$/` getters (plus `getTsProgram`) are diffed against the frozen set; `expect(added).toEqual([])` (verified empty at 22.0.4). A non-empty diff is the "do we now miss diagnostics?" signal the build-time type gate cannot raise.
- (c) Encoding round-trip: `NG(8001|8109|3004) === cli.ngErrorCode(...)`, `ngCodeOf(cli.ngErrorCode(8109)) === 8109`, and `cli.UNKNOWN_ERROR_CODE === 500`, pinned against the imported `NG`/`ngCodeOf` (not a re-derived `parseInt`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Author the runtime getter-set + additions-review + encoding spec (HARD-01 D-04)** - `6c17973` (test)

## Files Created/Modified
- `packages/angular-typechecker/src/core/compiler-cli-types.runtime.spec.ts` - Runtime drift spec: SUBSET-containment getter check + additions-review filtered diff + NG encoding round-trip against the real `await import('@angular/compiler-cli')`; builds a real program with `gatherDiagnostics: () => []`.

## Decisions Made
- **Reused `ng-baseline` fixture** (RESEARCH Open Question 2): a plain Angular program reliably yields an `NgtscProgram`; the empty gatherer means no diagnostic work, keeping the spec fast and deterministic.
- **Built the program once in `beforeAll`** and shared it across tests (a) and (b); test (c) needs only the namespace, so it `await import`s independently.
- **SUBSET containment, not prototype equality** (RESEARCH anti-pattern): the live `NgtscProgram` prototype carries runtime-only extras (`emitXi18n`, `getApiDocumentation`, `getEmittedSourceFiles`, `getIndexedComponents`, `getReuseTsProgram`) the shim never declares -- equality would false-positive.
- **`GATHERED_GETTERS` mirrors `gather-diagnostics.ts:62-77` exactly** (7 names incl. `getNgStructuralDiagnostics` for HARD-04 coverage); a divergence from the gatherer is itself a drift to catch.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The first `Write` resolved an absolute path into the main checkout rather than the worktree (the harness rejected it). Re-issued the write against the canonical worktree root from `git rev-parse --show-toplevel`. No code impact.

## Threat Model Adherence
- T-10-03-01 (Tampering, accept): the spec imports ONLY the already-installed, `@nx/dependency-checks`-policed `@angular/compiler-cli` (the production load path); no new package, no dynamic/untrusted module specifier.
- T-10-03-02 (DoS, mitigate): `gatherDiagnostics: () => []` keeps the build shape-only; reuses the small `ng-baseline` fixture; the existing 30000ms testTimeout covers cold-compiler warmup. Observed file duration ~1.7s.
- T-10-03-SC (Tampering, accept): no package installs; zero new dependency added.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- HARD-01 runtime half (D-04) is complete and green: the real NgtscProgram carries every gathered getter, a new diagnostic getter is flagged for review, and the NG encoding round-trip + `UNKNOWN_ERROR_CODE === 500` are pinned against the real `ngErrorCode`.
- Complements the build-time type gate (Plan 02, parallel Wave 1): the type gate catches removal/rename/sig-change; this runtime spec catches additions + encoding drift.
- No blockers. This plan was independent (a new test file introspecting the real package, not the shim) and merges cleanly with sibling Wave 1 work.

## Self-Check: PASSED
- FOUND: packages/angular-typechecker/src/core/compiler-cli-types.runtime.spec.ts
- FOUND: commit 6c17973 (test(10): add compiler-cli runtime getter-set + NG encoding drift spec)
- Test verification: `npx vitest run compiler-cli-types.runtime` -> 3 passed (3); `npx nx run angular-typechecker:test` -> 146 passed (25 files).

---
*Phase: 10-drift-hardening-maintainability*
*Completed: 2026-06-29*
