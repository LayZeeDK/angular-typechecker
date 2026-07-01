---
phase: 09-resilience-per-file-fault-isolation-boundary-robustness
plan: 03
subsystem: core
tags: [angular, filter, realpath, resilience, boundary-filter]

# Dependency graph
requires:
  - phase: 08-correctness-completeness-fixes
    provides: the createCanonicalizer boundary-filter pass (realpath-first + normalize + case-fold + per-input memoization) RES-03 hardens
provides:
  - 'A throwing options.realpath() inside createCanonicalizer is caught and falls back to the unresolved raw path (still normalized + case-folded), so a filesystem realpath failure cannot abort the whole type-check pass (RES-03 / D-08 / SC3)'
  - 'filter-diagnostics.spec.ts RES-03 case: a throwing realpath stub proves the in-project diagnostic is still kept and no exception escapes filterDiagnostics'
affects: [10 HARD-01 getter-set drift assertion (boundary-filter surface unchanged)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Silent try/catch fallback in PURE core: on a throwing injected dependency, swallow the error (NO logging, NO process) and degrade gracefully to a raw value, then re-apply the same downstream normalization so the fallback classifies identically to the happy path'

key-files:
  created: []
  modified:
    - 'packages/angular-typechecker/src/core/filter-diagnostics.ts'
    - 'packages/angular-typechecker/src/core/filter-diagnostics.spec.ts'

key-decisions:
  - "Fallback to the UNRESOLVED raw filePath (D-08), THEN still run .replace(/\\\\/g, '/') + the useCaseSensitiveFileNames case-fold, so a thrown realpath classifies consistently with a resolved one. The catch is SILENT -- core is PURE (eslint.config.mjs bans no-console + process.exit in **/src/core/**), so no logging / no process in the fallback."
  - "Edit confined to createCanonicalizer's single options.realpath call site (the only place realpath is invoked). The per-input memoization cache, isNodeModulesPath, isUnderDir, and the happy path are untouched -- the catch protects the contract regardless of the injected impl (production ts.sys.realpath or a test stub)."

patterns-established:
  - 'TDD RED/GREEN as separate atomic commits: a test(core) commit lands the throwing-realpath case (proven to fail with Error: EACCES escaping), then a fix(core) commit lands the try/catch that makes it pass.'

requirements-completed: [RES-03]

# Metrics
duration: 6min
completed: 2026-06-29
---

# Phase 9 Plan 03: RES-03 Throwing-Realpath Robustness in the Boundary Filter Summary

**A throwing `options.realpath()` inside `createCanonicalizer` is now caught and falls back to the unresolved raw path (still normalized + case-folded) instead of propagating out of `filterDiagnostics` and aborting the whole type-check pass -- a silent, PURE-core graceful-degradation fix proven by an injected throwing-realpath unit test (RES-03 / D-08 / SC3).**

## Performance

- **Duration:** ~6 min
- **Completed:** 2026-06-29
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2 (1 source + 1 spec)

## Accomplishments

- **Wrapped the single `options.realpath(filePath)` call** (the only realpath invocation in the boundary filter, `filter-diagnostics.ts` `createCanonicalizer`) in a `try { resolved = options.realpath(filePath); } catch { resolved = filePath; }`, then fed `resolved` through the existing `.replace(/\\/g, '/')` normalization and the `useCaseSensitiveFileNames` case-fold. On an EACCES / permission-denied junction / broken symlink, the filter classifies on the raw path rather than crashing the pass (Denial-of-Service hardening for trust boundary T-09-02).
- **Kept the fallback SILENT** -- no `console`, no `process` (core is PURE; `eslint.config.mjs:54-62` bans `no-console` + `process.exit` in `**/src/core/**`). The catch body is a single comment + assignment.
- **Left the happy path, the per-input memoization `cache` Map, `isNodeModulesPath`, and `isUnderDir` untouched** -- in-project kept, out-of-project / node_modules suppressed, exactly as before.
- **Added the RES-03 unit case** to `filter-diagnostics.spec.ts`: injects `realpath: () => { throw new Error('EACCES'); }` into `FilterOptions` and asserts `result.kept` has length 1 and `result.suppressedCount` is 0 (no throw escapes). A pure unit test mirroring the existing injected-realpath idiom -- no fixture, no compiler.

## Task Commits

Each phase of the TDD cycle was committed atomically:

1. **RED -- failing throwing-realpath test** - `a500383` (test): injects the throwing stub; verified to FAIL with `Error: EACCES` escaping `filterDiagnostics` before the fix.
2. **GREEN -- the try/catch + raw-path fallback** - `90e4ec3` (fix): makes the RES-03 case pass; all 126 tests green.

No REFACTOR commit -- the implementation is minimal and idiomatic; nothing to clean up.

**Plan metadata:** this SUMMARY commit (the orchestrator owns STATE.md / ROADMAP.md post-merge).

## Files Created/Modified

- `packages/angular-typechecker/src/core/filter-diagnostics.ts` (modified) - `createCanonicalizer`: the `options.realpath(filePath)` call wrapped in try/catch with a raw-path fallback into a local `resolved`; the existing normalize + case-fold now apply to `resolved`. Cache and happy path unchanged.
- `packages/angular-typechecker/src/core/filter-diagnostics.spec.ts` (modified) - added `it('RES-03: a throwing realpath is caught; the in-project diagnostic is still kept', ...)` injecting a throwing `realpath` stub.

## Decisions Made

- **Raw-path fallback, then re-normalize (D-08).** On a thrown realpath the code resolves to the UNRESOLVED `filePath` and STILL applies `.replace(/\\/g, '/')` + the case-fold, so the fallback classifies consistently with a resolved path. This matches the verified RES-03 shape in `09-RESEARCH.md:296-326` exactly.
- **Silent fallback, no observability.** Core is PURE: the catch adds only a comment explaining D-08 (no logging, no process). `npx nx lint angular-typechecker` exiting 0 proves no `console`/`process` was introduced into core.
- **Single-call-site edit.** The change is confined to the one place `options.realpath` is called, protecting `filterDiagnostics`'s contract regardless of whether production injects `ts.sys.realpath` (at `run-typecheck.ts:229-230`) or a test injects a stub.

## Deviations from Plan

None - plan executed exactly as written. The implementation matches the plan `<action>` and the verified `09-RESEARCH.md` code example byte-for-byte (modulo CLAUDE.md blank-line-around-control-flow style); the test matches the prescribed `<behavior>` assertions.

## Threat Mitigation (T-09-02)

- **T-09-02 (Denial of Service, `createCanonicalizer`):** `mitigate` disposition satisfied. The realpath syscall trust boundary (filesystem -> boundary filter) is now fault-tolerant: a hostile/broken symlink target or a permission-denied path that makes `ts.sys.realpath` throw can no longer abort the pass; one path is classified on its raw value and the filter continues. ASVS V12 graceful degradation; no path-traversal surface introduced (the filter only CLASSIFIES paths, never reads/writes them).

## Verification

- `npx nx test angular-typechecker -- filter-diagnostics.spec.ts` exits 0: `filter-diagnostics.spec.ts` 15 tests pass (the new RES-03 case + all 14 pre-existing); full run 126 tests / 23 files green.
- `npx nx lint angular-typechecker` exits 0 (0 errors -- the pure-core eslint override is satisfied; the catch is silent). One pre-existing, out-of-scope warning (`'NG' is assigned a value but never used` in `gather-diagnostics.spec.ts`, NOT a file this plan touched) remains untouched per the SCOPE BOUNDARY rule.
- `npx nx build angular-typechecker` exits 0 ("Done compiling TypeScript files").

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RES-03 / SC3 satisfied: a throwing `options.realpath()` is caught and falls back to the unresolved path; a filesystem realpath failure cannot abort the pass; the happy path, cache, and classification logic are unchanged. No package added; core remains pure.
- The boundary-filter surface is unchanged in shape (still `createCanonicalizer` -> normalize -> case-fold; same getters), so Phase 10 HARD-01's getter-set drift assertion is unaffected by this plan.

## Self-Check: PASSED

- Both modified files verified present on disk with the RES-03 edits: `filter-diagnostics.ts` contains the `try { ... options.realpath(filePath) ... } catch { ... = filePath; }`; `filter-diagnostics.spec.ts` contains the `RES-03` test with the `throw new Error('EACCES')` stub.
- Both task commits verified in git log: `a500383` (RED test), `90e4ec3` (GREEN fix).
- All edits ASCII-only; lint 0 errors; full suite 23 files / 126 tests green; build green.

---

_Phase: 09-resilience-per-file-fault-isolation-boundary-robustness_
_Completed: 2026-06-29_
