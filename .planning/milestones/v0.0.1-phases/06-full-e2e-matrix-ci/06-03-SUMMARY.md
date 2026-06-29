---
phase: 06-full-e2e-matrix-ci
plan: 03
subsystem: testing
tags: [vitest, filter-diagnostics, useCaseSensitiveFileNames, realpath, pnpm, bun, cross-os, OUT-02]

# Dependency graph
requires:
  - phase: 03-filtering-modes-output-quality-gates
    provides: the OUT-02 realpath-first / case-fold-gated / node_modules-segment boundary filter (filterDiagnostics)
  - phase: 04-nx-executor-adapter-cacheable-target
    provides: runTypecheck host seam deriving useCaseSensitiveFileNames + realpath from the live program host
provides:
  - Extended filter-diagnostics unit coverage proving the case-fold is GATED on useCaseSensitiveFileNames (D-10 mixed-case parity under both case modes)
  - RD-04 store-dir generality unit cases proving the node_modules-segment exclusion fires for .pnpm, .bun, AND plain node_modules/<pkg> (synthetic realpaths, no install)
  - Host-derived useCaseSensitiveFileNames integration assertion (the in-project/out-of-project split is derived from getTsProgram().useCaseSensitiveFileNames(), not a literal)
affects: [06-05-ci-matrix, OUT-02-cross-platform-backstop]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Synthetic injected-realpath fixtures exercise the realpath-FIRST-then-segment canonicalizer without any install"
    - "An all-OS-true integration assertion that BECOMES a live case-insensitive exercise on the case-insensitive matrix legs (mac/win) and the case-sensitive path on Linux"

key-files:
  created: []
  modified:
    - packages/angular-typechecker/src/core/filter-diagnostics.spec.ts
    - packages/angular-typechecker/src/core/run-typecheck.integration.spec.ts

key-decisions:
  - "Phrased the D-10 integration assertion to hold on all three OS legs (in-project KEPT + out-of-project SUPPRESSED is correct on every leg only if host-derived), with a case-folded equality check that is a live fold on mac/win and an identity no-op on Linux -- avoids a Linux-dead-code mixed-case assertion and needs no new fixture."
  - "RD-04 store-dir generality uses the injected realpath to map a friendly in-project input path to .pnpm/.bun/plain node_modules store realpaths, exercising the production realpath-FIRST-then-segment path exactly (synthetic, no install)."

patterns-established:
  - "Mixed-case parity set: assert the same input under BOTH case modes to prove a fold is gated on the flag, not unconditional."
  - "Store-dir generality test class: prove a node_modules-segment match is layout-agnostic across PM store dirs without installing any PM."

requirements-completed: [OUT-02]

# Metrics
duration: 3min
completed: 2026-06-29
---

# Phase 6 Plan 03: FS/OS/Node unit+integration (OUT-02 cross-platform backstop) Summary

**Extended the cheapest cross-OS test tier so the OUT-02 case-fold is proven GATED on the host's useCaseSensitiveFileNames (mixed-case parity under both modes) and the node_modules-segment exclusion is proven layout-agnostic across .pnpm/.bun/plain node_modules, plus a host-derived case-sensitivity integration assertion that is a live case-insensitive exercise on the mac/win matrix legs.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-29T01:24:15Z
- **Completed:** 2026-06-29T01:27:12Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `filter-diagnostics.spec.ts` gained 6 unit cases (7 -> 13 tests): the D-10 mixed-case parity set (out-of-project + NODE_MODULES segment SUPPRESSED under `useCaseSensitiveFileNames:false`; the SAME mixed-case in-project input NOT folded under `:true`), and the RD-04 store-dir generality set (`.pnpm`, `.bun`, and plain `node_modules/<pkg>` realpaths all suppressed by the single `node_modules`-segment test).
- `run-typecheck.integration.spec.ts` gained 1 assertion (12 -> 13 tests): the in-project/out-of-project split is HOST-derived via `getTsProgram().useCaseSensitiveFileNames()`, holding on all three OS legs and becoming a live case-insensitive exercise on mac/win (and this Windows arm64 dev box).
- The full `angular-typechecker` suite is green on this case-insensitive box: 20 files / 114 tests, `nx run-many -t test -p angular-typechecker` exit 0 -- the `useCaseSensitiveFileNames:false` branch is genuinely exercised here.

## Task Commits

Each task was committed atomically:

1. **Task 1: D-10 mixed-case + RD-04 store-dir generality unit cases** - `cc98eac` (test)
2. **Task 2: host-derived useCaseSensitiveFileNames integration assertion** - `438b12c` (test)

**Plan metadata:** committed with this SUMMARY + STATE.md + ROADMAP.md (docs: complete plan)

## Files Created/Modified
- `packages/angular-typechecker/src/core/filter-diagnostics.spec.ts` - Added the D-10 mixed-case parity set (both case modes, in/out-of-project + node_modules segment) and the RD-04 `.pnpm`/`.bun`/plain `node_modules` store-dir generality cases via injected synthetic realpaths.
- `packages/angular-typechecker/src/core/run-typecheck.integration.spec.ts` - Added one real-compiler assertion proving the in-project classification is host-derived (live case-insensitive on mac/win, case-sensitive on Linux), reusing the committed `sibling-import` fixture + the `diagnosticsOnFile` comparator.

## Decisions Made
- The D-10 integration assertion is phrased to hold on every OS leg rather than forcing a case-mismatch query that would be dead code on case-sensitive Linux: an in-project diagnostic is KEPT on its real on-disk path while the out-of-project sibling is SUPPRESSED -- a split that is only correct on all legs if the classifier is host-derived. A `reportedPath.toLowerCase() === expected.toLowerCase()` check is a genuine fold on a case-insensitive host and an identity no-op on Linux, so it exercises the fold where it bites without breaking the case-sensitive leg.
- No new fixture committed (per plan): the existing `sibling-import` main-lib/dependency-lib pairing already provides an in-project + out-of-project TS2322 pair.

## Deviations from Plan

None - plan executed exactly as written. No production code changed (the `filterDiagnostics` case-fold seam and the `run-typecheck.ts` host seam already exist); the two edits are test-only.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- OUT-02 cross-platform backstop is in place at the cheapest tier (unit + integration) that runs on every CI matrix cell. The mac/win matrix legs in 06-05's `ci.yml` become the authoritative live case-insensitive samples; Linux exercises the case-sensitive path.
- 06-02 (5-type e2e spec + pnpm symlink fixture + realpath regression-guard) and 06-05 (ci.yml lean 6-cell matrix + e2e + act-compat + lint-workflows + aggregate `ci` gate) remain to complete Phase 6.
- Note (carried, not in scope here): `nx run-many -t build` has a pre-existing fixture build failure (DI-06-01: 06-01 buildable-lib/publishable-lib declare ng-packagr build targets deliberately not installed per OQ-1) -- unrelated to this test-only plan; resolve before the next real release cut.

## Self-Check: PASSED

- `filter-diagnostics.spec.ts` - FOUND
- `run-typecheck.integration.spec.ts` - FOUND
- `06-03-SUMMARY.md` - FOUND
- Task 1 commit `cc98eac` - FOUND
- Task 2 commit `438b12c` - FOUND

---
*Phase: 06-full-e2e-matrix-ci*
*Completed: 2026-06-29*
