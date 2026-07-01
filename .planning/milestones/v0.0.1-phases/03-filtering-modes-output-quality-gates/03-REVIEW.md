---
phase: 03-filtering-modes-output-quality-gates
reviewed: 2026-06-27T23:49:45Z
depth: deep
files_reviewed: 16
files_reviewed_list:
  - packages/angular-typechecker/src/core/filter-diagnostics.ts
  - packages/angular-typechecker/src/core/filter-diagnostics.spec.ts
  - packages/angular-typechecker/src/core/run-typecheck.ts
  - packages/angular-typechecker/src/core/run-typecheck.integration.spec.ts
  - packages/angular-typechecker/src/core/infra-failure.spec.ts
  - packages/angular-typechecker/src/core/evaluate-result.ts
  - packages/angular-typechecker/src/core/evaluate-result.spec.ts
  - packages/angular-typechecker/src/core/format-report.ts
  - packages/angular-typechecker/src/core/format-report.spec.ts
  - packages/angular-typechecker/src/core/compiler-cli-types.ts
  - packages/angular-typechecker/src/core/gate-b.spec.ts
  - packages/angular-typechecker/src/index.ts
  - packages/angular-typechecker/eslint.config.mjs
  - fixtures/sibling-import/main-lib/main.component.ts
  - fixtures/sibling-import/main-lib/tsconfig.lib.json
  - fixtures/sibling-import/dependency-lib/dependency.ts
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-06-27T23:49:45Z
**Depth:** deep
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Deep, cross-file review of the Phase-3 core/\*\* modules (`filterDiagnostics`,
`evaluateResult`, `formatReport`) and the `runTypecheck` seam that composes them,
plus the sibling-import fixture and the rewritten ESLint config that locks the
core boundary. The verdict logic, the boundary-filter segment/realpath handling,
the deterministic format host, and the infrastructure-failure re-throw are all
sound and well-tested (70/70 tests pass; lint clean, 0 errors). The two
`eslint-disable-next-line` directives (one per deep-import in
`compiler-cli-types.ts`, one for the GATE-B timing `console.log` in
`gate-b.spec.ts`) are justified and minimally scoped against the rules they
actually suppress -- I confirmed the base config enables
`@nx/enforce-module-boundaries` as an error (eslint.config.mjs:22) so the deep
`node_modules/@angular/compiler-cli/...` relative imports would fire it, and the
core block bans `no-console` so the spec's timing line needs the exemption.

No correctness BLOCKERs were found. The two WARNINGs are robustness defects: an
`?? ''` fallback in `runTypecheck` that silently DISABLES the boundary filter
instead of failing safe (the most material), and a per-call canonicalizer cache
whose pattern invites an unbounded-leak refactor. The remaining items are minor.

I verified several plausible crash/correctness paths and cleared them:

- realpath-of-nonexistent-path (e.g. `.ngtypecheck.ts` virtual shadow files):
  `ts.sys.realpath` swallows ENOENT and returns the input path
  (typescript.js:8640-8646), and `runTypecheck` additionally guards with
  `ts.sys.realpath?.(filePath) ?? filePath` (run-typecheck.ts:197-198). NOT a
  crash path. Called out as INFO for the injected-realpath contract only.
- ANSI strip completeness: the renderer (`formatDiagnosticsWithColorAndContext`)
  emits only SGR `...m` sequences and the gutter `ESC[7m`, all matched by
  `ANSI_PATTERN`. Strip is complete; the pattern is linear (no ReDoS).
- `getCanonicalFileName` case-fold vs preserved-casing output: TS's
  `convertToRelativePath` uses `getCanonicalFileName` only for comparison and
  preserves original `fileName` casing in the rendered line. Correct.
- `includeDeps: true` ordering: this path still passes a `filter` object to
  `finalize`, so it DOES go through `ts.sortAndDeduplicateDiagnostics`. The only
  sort-skipping path is the zero-rootNames guard -- see IN-05.

## Warnings

### WR-01: `basePath ?? ''` silently disables the boundary filter instead of failing safe

**File:** `packages/angular-typechecker/src/core/run-typecheck.ts:192`
**Issue:** `runTypecheck` passes `basePath: parsed.options.basePath ?? ''` into the
filter. If `parsed.options.basePath` is ever `undefined`, the empty-string
fallback flows into `filterDiagnostics` -> `createCanonicalizer('')` -> `''`, and
`isUnderDir(canonicalFile, '')` computes `dirWithSeparator = '' + '/' = '/'`
(filter-diagnostics.ts:148-152). On POSIX EVERY absolute path
`startsWith('/')`, so `isUnderDir` returns `true` for every file and the
boundary filter is silently turned OFF -- out-of-project diagnostics (and any
`node_modules` paths NOT caught by the still-active segment test) leak into the
reported set, inflating `errorCount`/`warningCount` and potentially flipping a
PASS to a FAIL (or masking a suppression a consumer relies on). The failure is
silent: `suppressedCount` reads near-0 with no signal that the baseline was
missing. The module header (filter-diagnostics.ts:10-13) warns that a wrong
baseline "would mark every file in-project and defeat the filter" -- the `?? ''`
reintroduces exactly that failure mode as the fallback.

In practice `ng.readConfiguration` injects `basePath`, so this is defense-in-depth,
but the chosen sentinel is the worst possible default: it disables correctness
rather than preserving it.
**Fix:** Use an always-present, correct stand-in for the baseline instead of `''`,
which matches every path. The leaf-tsconfig directory is the natural fallback:

```typescript
import { dirname } from 'node:path';
// ...
basePath: parsed.options.basePath ?? dirname(options.tsConfigPath),
```

(Alternatively, throw if the baseline is genuinely absent -- it is structurally
required for a meaningful boundary filter.)

### WR-02: per-call canonicalizer cache is unbounded; pattern invites a leaking cross-run refactor

**File:** `packages/angular-typechecker/src/core/filter-diagnostics.ts:110-124`
**Issue:** `createCanonicalizer` builds a `Map<string,string>` keyed on every
distinct input path (`options.basePath` plus every diagnostic `fileName`) and
never evicts. For the current one-shot path this is correct and bounded -- the
canonicalizer is rebuilt per `filterDiagnostics` call, so the cache dies with the
run, and the header (lines 100-105) rightly justifies it as "a cache, not a
realpath() syscall per diagnostic." The risk is latent and maintainability-only:
the format host explicitly designs for an Nx-daemon long-lived process
(format-report.ts:16-18 "across the Nx daemon vs a cold run"), so a future
optimizer could plausibly hoist this cache to module scope for cross-run reuse --
at which point it leaks unboundedly across the daemon's session. Performance is
out of v1 scope; this is flagged as a robustness/maintainability guardrail, not a
perf finding.
**Fix:** No behavior change needed for v1. Pin the lifetime invariant in a comment
so a future refactor cannot quietly hoist the cache without bounding it:

```typescript
// INVARIANT: this cache lives ONLY for one filterDiagnostics call. Do NOT hoist
// to module scope without bounding it (paths accumulate unboundedly per process).
const cache = new Map<string, string>();
```

## Info

### IN-01: `suppressedCount` is computed pre-dedup, so duplicated out-of-project diagnostics inflate the scalar

**File:** `packages/angular-typechecker/src/core/filter-diagnostics.ts:74-97`
**Issue:** The unconditional all-getter (`gatherAllDiagnostics`) can surface the
same diagnostic from more than one phase. `filterDiagnostics` increments
`suppressedCount` once per suppressed diagnostic BEFORE any dedup (sort+dedup
runs later in `finalize`, and ONLY on the kept set -- never on the suppressed
ones). So two identical out-of-project diagnostics report `suppressedCount: 2`
even though they would collapse to one if kept. Advisory-only: the scalar is not
a verdict input (`evaluateResult` reads only `errorCount`/`warningCount`), so
impact is cosmetic.
**Fix:** Acceptable as-is. If exactness matters later, dedup the suppressed set
before counting, or document that `suppressedCount` is an upper bound.

### IN-02: injected-`realpath` contract assumes a never-throwing implementation; production guard is correct but undocumented in the type

**File:** `packages/angular-typechecker/src/core/filter-diagnostics.ts:42-46`, `packages/angular-typechecker/src/core/run-typecheck.ts:197-198`
**Issue:** `FilterOptions.realpath` is typed `(filePath: string) => string` with no
"must not throw" contract. The filter calls it on every diagnostic `fileName`,
including virtual `.ngtypecheck.ts` shadow files that do not exist on disk. The
production wiring is safe on two layers (`ts.sys.realpath` catches ENOENT and
returns the input -- typescript.js:8640-8646 -- and `runTypecheck` wraps it as
`ts.sys.realpath?.(filePath) ?? filePath`). So there is NO crash in production.
The latent risk is contractual: a future caller or test that injects a raw
`fs.realpathSync` would throw on the first nonexistent path.
**Fix:** Document the non-throwing contract on the `realpath` doc comment
(filter-diagnostics.ts:42-46), e.g. "MUST NOT throw on a nonexistent path --
return the input unchanged (mirror `ts.sys.realpath`'s catch)."

### IN-03: `ABSOLUTE_PATH_SENTINEL` relies on TS-internal path-relativization details

**File:** `packages/angular-typechecker/src/core/format-report.ts:19,101`
**Issue:** When `pathBase` is unset, `getCurrentDirectory()` returns
`/__atc_absolute__`. TS's `convertToRelativePath` ->
`getRelativePathFromDirectory` asserts shared rootedness (typescript.js:9121) and,
because the sentinel root (`/`) differs from a Windows file root (`D:/`), returns
the absolute target -- the intended "emit absolute" outcome, covered by a test
(format-report.spec.ts:144-159). The mechanism is a documented probe result, but
it hinges on TS-internal relativization that could shift across TS versions.
**Fix:** No change needed. The existing idempotency + absolute-path tests guard the
behavior; a TS relativization change would surface as a test failure.

### IN-04: stale review-finding IDs embedded in a source comment

**File:** `packages/angular-typechecker/src/core/run-typecheck.ts:89`
**Issue:** The `start = performance.now()` comment is prefixed `WR-02 / IN-04:`,
which are review-finding identifiers from a prior pass, not the file's domain
codes (the rest of the file uses `D-0x` / `EXE-0x` / `OUT-0x`). Leaving
prior-review IDs in source is confusing and collides with the finding IDs a later
review emits (this report's own WR-02/IN-04 are unrelated to that comment).
**Fix:** Replace the stale finding-ID prefix with the domain rationale, e.g.
`// durationMs cold-run capture: ...`, dropping `WR-02 / IN-04`.

### IN-05: zero-rootNames guard path returns diagnostics unsorted; determinism contract holds only by accident there

**File:** `packages/angular-typechecker/src/core/run-typecheck.ts:121-128,260-290`
**Issue:** `finalize` runs `ts.sortAndDeduplicateDiagnostics` only inside the
`if (filter !== undefined)` block. The normal and `includeDeps: true` paths both
pass a `filter`, so they ARE sorted. The single path that skips sort/dedup is the
zero-rootNames guard (line 121, `filter` omitted), which carries
`[...configDiagnostics, guard]`. Today that set is order-insensitive enough not to
matter, but `formatReport`'s doc contract (format-report.ts:42 "ALREADY sorted +
deduped by runTypecheck") is upheld on that branch only incidentally. Any future
caller reaching `finalize` without a filter for a different reason would emit a
non-deterministic/duplicated report, silently violating OUT-03 idempotency.
**Fix:** Make sort+dedup unconditional in `finalize` (run it on `kept` after the
optional filter step) so the determinism guarantee holds on every path, not just
the filtered ones. This also subsumes IN-01 (dedup-before-count everywhere).

---

_Reviewed: 2026-06-27T23:49:45Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
