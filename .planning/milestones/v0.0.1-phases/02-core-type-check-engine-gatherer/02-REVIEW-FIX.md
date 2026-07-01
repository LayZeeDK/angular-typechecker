---
phase: 02-core-type-check-engine-gatherer
fixed_at: 2026-06-27T20:47:47Z
review_path: .planning/phases/02-core-type-check-engine-gatherer/02-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-06-27T20:47:47Z
**Source review:** .planning/phases/02-core-type-check-engine-gatherer/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (0 critical, 2 warning, 4 info; fix_scope = all)
- Fixed: 6
- Skipped: 0

**Verification gate (authoritative, re-run after the last fix):**
- `npx nx build angular-typechecker` -- SUCCESS
- `npx nx test angular-typechecker` -- 39 passed (39) across 12 test files (12 passed)

All work was performed in an isolated git worktree on branch
`gsd-reviewfix/02-456`; the worktree's `node_modules` was a junction to the
main repo's installed dependencies so the authoritative nx build/test could run.
The cold-run `durationMs` value reported by `gate-b.spec.ts` rose from ~536ms
(now correctly including module load + config parse) and its `> 0` assertion
stayed green.

## Fixed Issues

### WR-01 + IN-03: Dead `tsconfig.lib.json` fixture excludes + false "excluded" fixture comments

**Files modified:** `packages/angular-typechecker/tsconfig.lib.json`,
`fixtures/composite-triangle/error.component.ts`,
`fixtures/config-broken/error.component.ts`,
`fixtures/extended-promoted/error.component.ts`,
`fixtures/extended-v13/error.component.ts`,
`fixtures/gate-b-error/error.component.ts`,
`fixtures/ng-baseline/error.component.ts`,
`fixtures/no-emit-message/error.component.ts`,
`fixtures/solution-style/error.component.ts`,
`fixtures/ts-baseline/error.component.ts`,
`.planning/phases/02-core-type-check-engine-gatherer/02-VALIDATION.md`
**Commit:** e8fca0b
**Applied fix:** Grouped WR-01 and IN-03 (they touch the same tsconfig and the
same fixture comments). Verified there is NO `packages/angular-typechecker/fixtures/`
directory, so both `"fixtures/gate-b-error/**/*"` and `"fixtures/**/*"` exclude
globs matched nothing -- deleted both (IN-03's redundant subset entry plus WR-01's
broad entry). The real guard remains `include: ["src/**/*.ts"]`. Corrected the
false header comments in all nine fixture `error.component.ts` files (each claimed
the fixture was "excluded from the plugin's tsconfig.lib.json") to truthfully state
they are "kept out of the plugin build by tsconfig.lib.json's
`include: ["src/**/*.ts"]` scope (the fixtures live at the workspace root, not
under the package)." The planted type errors and every `Do NOT add @ts-nocheck`
warning were left untouched (the `@ts-nocheck` text stays non-leading /
non-functional). Updated the live `02-VALIDATION.md` carried-forward note to
reflect the removal. Verified each fixture still triggers its asserted diagnostic
(39/39 unchanged); JSON validity of `tsconfig.lib.json` confirmed.

### WR-02 + IN-04: `durationMs` excluded the dominant cold-start cost (module load + config parse)

**Files modified:** `packages/angular-typechecker/src/core/run-typecheck.ts`
**Commit:** 566ccb0
**Applied fix:** Grouped WR-02 and IN-04 (one shared change). Moved
`const start = performance.now();` to the very top of `runTypecheck`, before
`await loadCompilerCli()`, `await loadTypescript()`, and
`ng.readConfiguration(...)`, and removed the later capture. `durationMs` now
covers the full cold-run wall-clock (module load + config parse + compile) on
BOTH the normal return path and the zero-rootNames-guard return path (IN-04:
the guard path previously reported a near-zero, misleading value). The
`loadTypescript` memoization is intact. Confirmed exactly one `start`
declaration remains; the `gate-b.spec.ts` "cold-run durationMs" `> 0` assertion
stayed green (value only grows). Project JS/TS style applied (blank lines around
the new declaration and surrounding control flow).

### IN-02: `NG()` / `ngCodeOf()` 4-digit-code precondition undocumented on the functions

**Files modified:** `packages/angular-typechecker/src/core/diagnostic-codes.ts`
**Commit:** 145d052
**Applied fix:** Added a PRECONDITION note to each function (not only in the file
header) documenting that the `-990000 - code` shortcut only equals the compiler's
`parseInt('-99' + code)` for 4-digit Angular ErrorCodes (1000-9999); a 3-digit or
5+-digit code diverges and computes a wrong, never-matching value. Documented the
inverse precondition on `ngCodeOf()` symmetrically. Comment-only; no behavior
change (no runtime assertion was added, keeping the module dependency-free and its
hot path allocation-free as before).

### IN-01: `extended.angular17.integration.spec.ts` misnamed -- no v17 coverage

**Files modified:** `packages/angular-typechecker/src/core/extended.angular17.integration.spec.ts`
-> `packages/angular-typechecker/src/core/extended.promotion.integration.spec.ts`
(renamed via `git mv`),
`.planning/phases/02-core-type-check-engine-gatherer/02-VALIDATION.md`
**Commit:** ccb4734
**Applied fix:** The `angular17` filename was a false coverage signal -- the spec
contains no v17-specific code and there is no `fixtures/extended-v17/` tree; it
reuses the v13-introduced NG8101 shape to prove the version-independent
extended-diagnostic category-promotion mechanism. Renamed via `git mv` to
`extended.promotion.integration.spec.ts` (atomic source-delete + dest-add) and
updated the file's header comment to state version-independence explicitly and
note the rename rationale. The existing `describe("extended diagnostics (category
promotion proof)")` block was already truthful and left as-is. Updated the single
set of references in the LIVE tracking doc `02-VALIDATION.md` only (rows for
ENG-04, TEST-02, the Wave-0 checklist, and the carried-forward note). Historical
point-in-time artifacts (`02-03-PLAN.md`, `02-03-SUMMARY.md`, `02-PATTERNS.md`,
`02-LEARNINGS.md`, `02-VERIFICATION.md`, `02-SECURITY.md`, `02-REVIEW.md`) were
deliberately NOT rewritten. Adding genuine v17 coverage is out of scope (new
feature work). vitest discovers by glob, so the rename is safe; the renamed file
ran 2 tests and the suite stayed 39/39 across 12 files.

## Skipped Issues

None -- all 6 in-scope findings were fixed.

---

_Fixed: 2026-06-27T20:47:47Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
