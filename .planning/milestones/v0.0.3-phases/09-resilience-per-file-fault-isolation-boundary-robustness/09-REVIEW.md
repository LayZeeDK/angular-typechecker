---
phase: 09-resilience-per-file-fault-isolation-boundary-robustness
reviewed: 2026-06-29T00:00:00Z
depth: deep
files_reviewed: 12
files_reviewed_list:
  - packages/angular-typechecker/src/core/diagnostic-codes.ts
  - packages/angular-typechecker/src/core/filter-diagnostics.ts
  - packages/angular-typechecker/src/core/gather-diagnostics.ts
  - packages/angular-typechecker/src/core/run-typecheck.ts
  - packages/angular-typechecker/src/executors/angular-typecheck/executor.ts
  - packages/angular-typechecker/src/core/fault-isolation.integration.spec.ts
  - packages/angular-typechecker/src/core/filter-diagnostics.spec.ts
  - packages/angular-typechecker/src/core/gather-diagnostics.spec.ts
  - packages/angular-typechecker/src/core/infra-failure.spec.ts
  - packages/angular-typechecker/src/core/run-typecheck.spec.ts
  - packages/angular-typechecker/src/core/suppress-output-path.integration.spec.ts
  - packages/angular-typechecker/src/executors/angular-typecheck/executor.spec.ts
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-06-29
**Depth:** deep
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 9 adds per-file fault isolation (HYBRID gatherer), a silent realpath
fallback in the boundary filter, a TCB-generation Fatal (NG3004) detector with a
shim-name inversion, and a loud-but-non-verdict-changing executor warning. I
reviewed the four production files plus eight spec files at deep depth, and
cross-checked the load-bearing claims directly against the installed
`@angular/compiler-cli@22.0.4` and `typescript` bundles rather than trusting the
inline comments.

The core design is sound and the high-risk areas hold up under adversarial
tracing:

- **Infra-vs-type boundary preserved.** The per-file loop wraps nothing in
  try/catch, so a non-fatal/infra throw still escapes to `performCompilation`'s
  outer catch -> `UNKNOWN_ERROR_CODE 500` -> `TypecheckInfrastructureError`
  (`gather-diagnostics.ts:72-78`). NG3004 stays a counted Error and the verdict
  is computed solely from `errorCount`/`warningCount` in `evaluateResult`;
  `templateCheckAborted` is purely additive signalling. No reclassification.
  VERIFIED against `chunk-33J3WRHI.js:4574-4587` (the `isFatalDiagnosticError`
  try/catch lives inside the compiler's own `getDiagnosticsForFile`, not in our
  code).
- **HYBRID gatherer is correct.** Residual whole-program
  `getNgSemanticDiagnostics()` + per-file `getNgSemanticDiagnostics(sf.fileName)`
  loop, `isDeclarationFile` skipped, `OptimizeFor.WholeProgram` only (the
  `fileName` overload hard-codes it at `chunk-6ZBSJK4S.js:294`), never
  `SingleFile`, `getGlobalDiagnostics()` retained, NO manual dedup. The
  whole-program + per-file duplicate of the same Fatal collapses correctly --
  `ts.sortAndDeduplicateDiagnostics` compares by file/start/length/code/message,
  not object identity (VERIFIED `typescript.js:21820-21823`), so the
  integration spec's "exactly once" invariant is real.
- **Fatal-code detection is numerically correct.** `NG(3004) === -993004`
  matches the compiler's `ngErrorCode(3004)` display encoding, and only code 3004
  is detected (3001/3003 deliberately excluded). Detection is by code only, no
  `source`/message-text matching.
- **Core stays pure.** None of the four production files (or the in-scope spec
  files) use `console` or `process` -- the realpath try/catch and the
  templateCheckAborted scan are silent; the loud notice is rendered only by the
  executor adapter's `logger.warn`. eslint's `no-console` / `no-restricted-properties`
  core ban is respected in every reviewed file.

Findings are two Warnings (a real `.tsx` edge case in the shim-name inversion, and
a notice-message overstatement) plus four Info items. No Critical issues.

## Warnings

### WR-01: `normalizeShimFileName` mis-rewrites a `.tsx` source's shim to `.ts`

**File:** `packages/angular-typechecker/src/core/run-typecheck.ts:460-468`
**Issue:** The shim-name inversion is `fileName.replace(/\.ngtypecheck\.ts$/, '.ts')`.
The compiler generates the shim via `fileName.replace(/\.tsx?$/, ".ngtypecheck.ts")`
(VERIFIED `chunk-VBOLXMVC.js:9592`), which collapses BOTH `.ts` and `.tsx`
sources to the same `<name>.ngtypecheck.ts` shim. The inversion is therefore
not a true inverse: a `foo.component.tsx` source produces shim
`foo.component.ngtypecheck.ts`, and `normalizeShimFileName` rewrites it to
`foo.component.ts` -- a file that may not exist. The executor then prints
"a fatal template-compilation error in foo.component.ts", pointing the consumer
at the wrong (nonexistent) file. The inversion is lossy because the original
extension is unrecoverable from the shim name alone.

This is a genuine correctness defect but low real-world likelihood: Angular does
not use JSX, so `.tsx` component sources only arise in unusual mixed/allowJs
setups. Severity is Warning rather than Critical because it degrades only the
advisory notice's accuracy (the diagnostic verdict, counts, and the diagnostic's
own codeframe path are unaffected -- the codeframe still renders the real shim
file path independently of this helper).

**Fix:** Strip only the `.ngtypecheck` infix and keep whatever extension the shim
carries, so the result is at least a real on-disk path the consumer can map back:

```ts
function normalizeShimFileName(fileName: string | undefined): string | undefined {
  if (fileName === undefined) {
    return undefined;
  }

  // The shim is always `<source-without-ext>.ngtypecheck.ts`; the original
  // extension (.ts vs .tsx) is not recoverable from the shim name. Strip only the
  // `.ngtypecheck` infix and document that the named path is the canonical
  // (.ts) form. If `.tsx` support is ever in scope, the offending source must be
  // resolved via the program's source-file map, not string surgery.
  return fileName.replace(/\.ngtypecheck(\.tsx?)$/, '$1');
}
```

At minimum, add a code comment acknowledging the `.tsx`-source case is reported as
`.ts`, so the limitation is explicit rather than silent.

### WR-02: executor notice claims survivors "may be SUPPRESSED" unconditionally, but names only the first NG3004 file

**File:** `packages/angular-typechecker/src/executors/angular-typecheck/executor.ts:52-62` and `packages/angular-typechecker/src/core/run-typecheck.ts:436-447`
**Issue:** `detectTemplateCheckAborted` uses `reported.find(...)`, which after the
deterministic alphabetical sort names exactly ONE offending file even when several
components throw NG3004. The executor message then states the abort "in
${offendingFile}" as if there were a single cause. With multiple TCB-generation
Fatals, the consumer is told to "Fix the reported NG3004 and re-run" naming only
one file, which under-communicates the scope of the breakage. This is not a crash
or data-loss issue, but it can mislead an agent/CI into fixing one file and
re-running, only to hit the next NG3004.

The phrasing is also subtly mismatched with the documented compiler behavior: the
HYBRID gatherer header and integration spec note that under `OptimizeFor.WholeProgram`
priming the survivors' template diagnostics ARE aborted (not merely "may be"),
while the notice hedges with "may be SUPPRESSED". The hedge is defensible (the core
cannot know whether any survivor actually had template diagnostics), but it should
be a deliberate, documented choice.

**Fix:** Either (a) keep single-file detection but soften the message to indicate
there may be additional NG3004s ("a fatal template-compilation error (e.g. in
${offendingFile}) ... fix all reported NG3004 diagnostics"), or (b) collect all
NG3004 offenders and name them (capped), e.g.:

```ts
const offenders = reported.filter((d) => d.code === TCB_GENERATION_FATAL_DIAGNOSTIC_CODE).map((d) => normalizeShimFileName(d.file?.fileName) ?? 'an unknown file');
// dedup + cap, then return { code, fileNames: offenders } and have the adapter
// join them.
```

Option (a) is the smaller change and sufficient for v0.0.x.

## Info

### IN-01: Per-file loop redundantly iterates generated shim source files

**File:** `packages/angular-typechecker/src/core/gather-diagnostics.ts:72-78`
**Issue:** The loop iterates `program.getTsProgram().getSourceFiles()`, which
includes the generated `.ngtypecheck.ts` shim files (the compiler itself filters
them into `ignoreForDiagnostics`, VERIFIED `chunk-33J3WRHI.js:4502`). Each shim is
not a declaration file, so the loop calls `getNgSemanticDiagnostics(shim.fileName)`
on it. The compiler's `getTemplateDiagnosticsForFile` short-circuits on
`isShim(sf)` (VERIFIED `chunk-33J3WRHI.js:5014-5019`), so this is harmless for
correctness, and any non-template Fatal matched on the shim is deduped in
`finalize`. It is wasted work per shim, but performance is explicitly out of v1
review scope, so this is informational only.
**Fix:** Optional: skip shim files in the loop with a `.ngtypecheck.ts` suffix
guard (mirrors the compiler's own `isShim` skip) if a future perf pass wants it.
Do not add now if it risks dropping the shim-attached Fatal that
`templateCheckAborted` relies on -- verify against the fixture first.

### IN-02: `loadTypescript` module-level cache is process-global mutable state

**File:** `packages/angular-typechecker/src/core/run-typecheck.ts:470-481`
**Issue:** `cachedTypescript` is a module-scope `let` memoizing the dynamically
imported `typescript` namespace. This is intentional (mirrors `loadCompilerCli`'s
memoization, documented at `run-typecheck.ts:121-123`) and benign for a CLI/executor
process. Noting it for completeness: it makes `runTypecheck` non-idempotent at the
module level and would surface in any future scenario that needs to swap the
TypeScript version between calls in one process (not a concern for the executor).
**Fix:** None required. If multi-version-per-process is ever needed, inject `ts`
rather than memoizing globally.

### IN-03: `detectTemplateCheckAborted` and the executor warn path are tested, but not the empty-`.tsx` inversion

**File:** `packages/angular-typechecker/src/core/run-typecheck.spec.ts:109-137`
**Issue:** The unit tier covers shim->source inversion for `.ts`, already-source
pass-through, file-less, and the 3001/3003 non-firing cases -- thorough. It does
NOT cover the `.tsx`-source case (WR-01), so the lossy inversion is untested and
will silently regress if "fixed" incorrectly. This is a test-coverage gap, not a
test reliability defect.
**Fix:** When addressing WR-01, add a spec asserting the chosen behavior for a
`foo.component.ngtypecheck.ts` shim whose source was `.tsx`, so the decision is
locked.

### IN-04: Throwaway spike probe ships `console.log` under `src/core/` (out of review scope, flagged for awareness)

**File:** `packages/angular-typechecker/src/core/res-01-spike.probe.spec.ts:216-306`
**Issue:** Not in the Phase 9 review file list, but it lives under `src/core/` and
was added in this phase's changeset. It contains ~14 `console.log` calls. eslint's
`no-console: error` is scoped to `**/src/core/**/*.ts` (eslint.config.mjs:54), which
matches `.spec.ts` files too, so this file would lint-error unless excluded by the
lint file set or an override. It is correctly excluded from the published build
(`tsconfig.lib.json` excludes `src/**/*.spec.ts`), so it does NOT ship -- the only
risk is a red `nx lint`. Verify the lint config excludes spec files from the core
`no-console` block, or delete the throwaway probe now that the GO decision is
recorded (the comment header calls it "THROWAWAY ... runs once").
**Fix:** Delete `res-01-spike.probe.spec.ts` (it has served its purpose per its own
header) or confirm `nx lint angular-typechecker` is green with it present.

---

## Cross-file verification notes (deep depth)

- `gather-diagnostics.ts` -> `compiler-cli-types.ts`: the `Program` interface
  declares the `getNgSemanticDiagnostics(fileName?, token?)` overload and
  `getTsProgram(): TsProgram` with `getSourceFiles()`/`getGlobalDiagnostics()`
  inherited from `ts.Program`. The gatherer's calls type-check against this
  structural surface; no drift.
- `run-typecheck.ts` -> `diagnostic-codes.ts`: `TCB_GENERATION_FATAL_DIAGNOSTIC_CODE`
  is imported and compared by `===` against `diagnostic.code`. `NG(3004) === -993004`
  is asserted directly in `run-typecheck.spec.ts:79-83`, guarding against encoding
  drift.
- `run-typecheck.ts` -> `filter-diagnostics.ts`: the filter runs BEFORE
  `detectTemplateCheckAborted`, so an in-project shim's NG3004 (shim path derives
  from the in-project source path, VERIFIED `chunk-VBOLXMVC.js:9592`) survives the
  boundary filter and is detected. An out-of-project poison would be suppressed AND
  undetected -- acceptable, since an out-of-project file is not the consumer's to fix.
- `executor.ts` -> `evaluate-result.ts`: `templateCheckAborted` never reaches
  `evaluateResult`; the verdict is computed only from `errorCount`/`warningCount`.
  The NG3004 Fatal is an Error category, so it already fails the verdict
  independently of the notice. No double-counting, no verdict mutation.
- Error propagation: `TypecheckInfrastructureError` thrown in `runTypecheck` is
  caught by `instanceof` in `executor.ts:77`; every other error is re-thrown
  (`executor.ts:85`), proven by `executor.spec.ts:215-235`.

_Reviewed: 2026-06-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
