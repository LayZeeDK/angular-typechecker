---
phase: 03-filtering-modes-output-quality-gates
plan: 03
subsystem: api
tags: [typescript, angular-compiler-cli, formatDiagnostics, diagnostics, output, ansi, vitest, nx-plugin]

# Dependency graph
requires:
  - phase: 02-core-type-check-engine-gatherer
    provides: "compiler-cli-types.ts nodenext-safe type shim (CompilerCli interface, deep perform_compile import-type precedent); gather-diagnostics.spec.ts pure-function-with-hand-built-ts.Diagnostic[] test idiom; finalize explicit category counting; diagnostic-codes.ts dependency-free pure-module shape"
provides:
  - "Pure formatReport(diagnostics, ng, ts_, { pathBase, color, failFast }) -> string exported from core/ (OUT-01 human renderer)"
  - "FormatOptions interface (pathBase?/color/failFast?)"
  - "Deterministic FormatDiagnosticsHost: ABSOLUTE paths by default via the /__atc_absolute__ sentinel; workspace-root-relative '/'-normalized paths when pathBase set; non-identity getCanonicalFileName; getNewLine forced to '\\n' (OUT-02/OUT-03/D-08)"
  - "TTY-gated ANSI strip via String.fromCharCode(0x1b) linear pattern (D-10)"
  - "Reporter-layer fail-fast: truncate REPORTED list at first Error, never a gather short-circuit (EXE-03/D-04)"
  - "CompilerCli widened with formatDiagnostics (type-only) for the Pick injection"
affects: [phase-03-plan-04-quality-gates, phase-04-executor-adapter]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Injected-dependency rendering: ng (Pick<CompilerCli, 'formatDiagnostics'>) + ts_ passed as params so the formatter is pure and unit-testable with a vi.fn fake OR the real ts.formatDiagnostics (no @angular/compiler-cli mock, D-13)"
    - "Absolute-path emission via a non-prefixing getCurrentDirectory() sentinel (verified against real ts.formatDiagnostics by probe -- A1)"
    - "Two-mode FormatDiagnosticsHost (pathBase set => relative; unset => absolute) as the single OUT-02/OUT-03 determinism seam"
    - "ANSI escape constructed via String.fromCharCode(0x1b) (no literal control char in source, CLAUDE.md ASCII rule)"

key-files:
  created:
    - packages/angular-typechecker/src/core/format-report.ts
    - packages/angular-typechecker/src/core/format-report.spec.ts
  modified:
    - packages/angular-typechecker/src/core/compiler-cli-types.ts

key-decisions:
  - "ABSOLUTE_PATH_SENTINEL = '/__atc_absolute__' for the pathBase-unset case: a getCurrentDirectory() value that never prefixes a real diagnostic path, so formatDiagnostics's internal path.relative leaves file names absolute (probe-verified against the real ts.formatDiagnostics: D:/ws/proj/src/a.component.ts rendered intact)"
  - "formatReport does NOT re-sort: the input is already sorted+deduped by runTypecheck (D-09); the formatter only truncates (fail-fast), renders, and ANSI-gates"
  - "fail-fast is a slice(0, firstError + 1) over the already-sorted list -- inclusive of the first Error, never a getter gate (D-04)"
  - "compiler-cli-types.ts widened type-only: formatDiagnostics added to the EXISTING deep perform_compile import block + the CompilerCli interface; zero runtime/emit effect, preserving the nodenext GATE A shim invariant"

patterns-established:
  - "Pure dep-free core/ formatter (import type ts + import type CompilerCli only; no console/process.exit/module-scope compiler import) -- D-11-survivable"
  - "Injected ng/ts_ rendering surface enabling fake-or-real formatDiagnostics in unit tests (the D-13 hybrid-split payoff for the output tier)"

requirements-completed: [EXE-03, OUT-01, OUT-02, OUT-03]

# Metrics
duration: 5min
completed: 2026-06-28
---

# Phase 3 Plan 03: Human Output Formatter Summary

**Pure `formatReport` that renders the already-sorted diagnostics via the injected `@angular/compiler-cli` `formatDiagnostics` (NG codes + template codeframes) through a deterministic `FormatDiagnosticsHost` -- absolute paths by default (a probe-pinned non-prefixing-cwd sentinel), workspace-root-relative `/`-normalized paths when `pathBase` is set, `getNewLine` forced to `\n`, TTY-gated ANSI stripping, and reporter-only fail-fast truncation.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-28T01:14:07+02:00
- **Completed:** 2026-06-28T01:18:47+02:00
- **Tasks:** 3
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- Widened `CompilerCli` with `formatDiagnostics` (type-only) on the existing deep `perform_compile` import so the formatter's `Pick<CompilerCli, 'formatDiagnostics'>` injection resolves under `module: nodenext` -- build green, GATE A `import(` invariant retained.
- Authored the pure `formatReport(diagnostics, ng, ts_, { pathBase, color, failFast }) -> string`: a dependency-free `core/` module (only `import type ts` + `import type CompilerCli`; no `console`, no `process.exit`, no module-scope compiler import).
- Pinned the A1 OUT-02/OUT-03 detail empirically: a 5-line probe against the REAL `ts.formatDiagnostics` confirmed the `/__atc_absolute__` sentinel `getCurrentDirectory()` yields ABSOLUTE paths (pathBase unset) and that `pathBase` set to the file's parent yields a workspace-root-relative `/`-normalized path with no backslashes -- both asserted end-to-end in the spec via the real renderer (not just host shape).
- Implemented reporter-layer fail-fast as a `slice(0, firstError + 1)` over the already-sorted list (D-04/EXE-03) -- inclusive of the first Error, never a gather short-circuit.
- TTY-gated ANSI strip via a linear `String.fromCharCode(0x1b) + '\\[[0-9;]*m'` pattern (D-10; no ReDoS, T-03-05).
- Full verification green: `npx nx build angular-typechecker` succeeds (GATE A retained); `npx nx test angular-typechecker` is 50/50 across 13 files (the 11 new `format-report.spec.ts` cases plus all Phase-2 tiers, no regression).

## Task Commits

Each task was committed atomically:

1. **Task 1: Widen CompilerCli with formatDiagnostics (type-only)** - `c7adbc0` (feat)
2. **Task 2: Wave 0 -- failing pure-function spec for formatReport** - `c5e51c0` (test, RED gate)
3. **Task 3: Implement formatReport (host + ANSI gate + fail-fast truncation)** - `4979f00` (feat, GREEN gate)

**Plan metadata:** (final docs commit with this SUMMARY)

_Note: Tasks 2 + 3 are the TDD RED -> GREEN cycle (test commit precedes the feat commit)._

## Files Created/Modified

- `packages/angular-typechecker/src/core/format-report.ts` - NEW. Pure `formatReport` + `FormatOptions` + the private `makeFormatHost` (deterministic `FormatDiagnosticsHost`) and the `ABSOLUTE_PATH_SENTINEL`. Renders via injected `ng.formatDiagnostics`, fail-fast truncation, ANSI gate.
- `packages/angular-typechecker/src/core/format-report.spec.ts` - NEW. 11 pure-function cases: renders-via-ng (NG code in output), ANSI strip/keep, idempotent, `getNewLine='\n'`, non-identity `getCanonicalFileName` (platform-guarded), absolute-when-pathBase-unset (real `ts.formatDiagnostics`, A1 sentinel), workspace-root-relative-`/`-normalized-when-pathBase-set, fail-fast truncates at first Error, fail-fast-unset renders all, fail-fast-no-error renders all. No `@angular/compiler-cli` mock (D-13).
- `packages/angular-typechecker/src/core/compiler-cli-types.ts` - MODIFIED. Added `formatDiagnostics` to the deep `perform_compile` type-only import and `formatDiagnostics: typeof formatDiagnostics;` to the `CompilerCli` interface (type-only, OUT-01).

## Decisions Made

- **`ABSOLUTE_PATH_SENTINEL = '/__atc_absolute__'`** for the pathBase-unset case (the RESEARCH A1 discretion item). A probe against the real `ts.formatDiagnostics` confirmed a non-prefixing `getCurrentDirectory()` leaves the diagnostic file's path absolute; the same probe confirmed `pathBase = D:/ws/proj` renders `src/a.component.ts` (relative, forward-slash, no backslash). The sentinel is the deterministic OUT-03 default (cwd-relative would diverge with/without the Nx daemon).
- **`formatReport` does NOT re-sort** -- D-09 sorting+dedup is `runTypecheck`'s job (plan 03-01/02); the formatter only truncates, renders, and ANSI-gates over the already-sorted input.
- **Type-only widening of `compiler-cli-types.ts`** -- `formatDiagnostics` added to the existing deep-import block rather than introducing a new import path, keeping the nodenext shim isolated and the emit unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected a logically-impossible negative assertion in the spec**
- **Found during:** Task 3 (implement formatReport; first GREEN run)
- **Issue:** The pathBase-unset case asserted `out.not.toContain('src/a.component.ts(1,1): error')` to prove the path was rendered absolute. That substring is necessarily CONTAINED in the absolute render `D:/ws/proj/src/a.component.ts(1,1): error ...`, so the negative assertion could never hold even with correct absolute output -- a faulty test, not an implementation defect.
- **Fix:** Replaced it with sound assertions that the rendered line STARTS with the absolute path (`out.startsWith(absolute) === true`) and does NOT start with the bare basename (`out.startsWith('a.component.ts') === false`), which actually distinguishes absolute from directory-relativized output.
- **Files modified:** `packages/angular-typechecker/src/core/format-report.spec.ts`
- **Verification:** `npx nx test angular-typechecker -- format-report.spec.ts` 50/50 green; the implementation was unchanged (it already emitted the correct absolute path, probe-confirmed).
- **Committed in:** `4979f00` (Task 3 GREEN commit -- same atomic TDD cycle)

---

**Total deviations:** 1 auto-fixed (1 bug -- test assertion).
**Impact on plan:** The fix corrected a test-only logic error; the formatter contract and implementation match the plan exactly. No scope creep, no production behavior change.

## Issues Encountered

- **Worktree had no `node_modules`** (Claude Code worktrees branch from a clean tree). Resolved non-destructively, as plan 02-03 did, by creating a Windows directory junction at the worktree root pointing at the main repo's installed, locked `node_modules` (`@angular/compiler-cli@22.0.4`, `typescript@6.0.3`, `vitest@4.1.9`). Read-only sharing, gitignored, does not modify the main repo. All build/test ran with `--skip-nx-cache` against the worktree changes.

## Threat Flags

None - no new security-relevant surface. The formatter returns a string, reads no stdout/exit, opens no network/file/auth path. The ANSI-strip regex is linear (`[0-9;]` class, single `*`, anchored to `m`) -- no ReDoS (T-03-05); its input is compiler-produced, not adversarial.

## Known Stubs

None. `format-report.ts` is a complete pure function; no hardcoded empty values flow to a UI, no placeholder text, no unwired data source.

## Out-of-Scope Discoveries (logged, NOT fixed)

`npx nx lint angular-typechecker` is RED on the Phase-3 base commit (`7faa425`), independent of this plan:
- `@nx/enforce-module-boundaries` x2 in `compiler-cli-types.ts` lines 15 + 20 ("External resources cannot be imported using a relative or absolute path") -- fires on the deep-relative nodenext shim imports. Line 15 (`transformers/api`, UNTOUCHED by this plan) errors identically, proving the violation pre-exists this plan's one-line `formatDiagnostics` addition.
- `@typescript-eslint/no-unused-vars` warnings x2 (`config-resolution.integration.spec.ts:30` `NG`, `executor.ts:16` `_context`) -- unrelated pre-existing files.

This plan's own new files (`format-report.ts`, `format-report.spec.ts`) are lint-clean. Resolution owner: plan 03-04 (wave 2), which owns WS-04 and the "lint passes clean" gate. Logged in `.planning/phases/03-filtering-modes-output-quality-gates/deferred-items.md`.

## Next Phase Readiness

- `formatReport` + `FormatOptions` are ready for plan 03-04 to re-export from the package entry point, and for the Phase-4 adapter to compose (the adapter supplies `pathBase` from `context.root` and `process.stdout.isTTY` as `color`, owns stdout + exit).
- The injected `Pick<CompilerCli, 'formatDiagnostics'>` resolves cleanly under nodenext; no compiler import leaks into `core/`, so the plan-03-04 `core/**` import ban (D-11) will pass clean for this file once added.
- The full unit suite is green and the build retains GATE A. No blockers from this plan; the pre-existing phase-level lint failure is flagged above for plan 03-04.

## Self-Check: PASSED

(See appended self-check verification below.)

---
*Phase: 03-filtering-modes-output-quality-gates*
*Completed: 2026-06-28*
