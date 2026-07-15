---
phase: 18-packaged-tarball-e2e-docs
reviewed: 2026-07-06T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - packages/angular-typechecker/src/core/detect-unchecked-declared.ts
  - packages/angular-typechecker/src/core/run-typecheck.ts
  - packages/angular-typechecker/src/core/walk-references.ts
  - packages/angular-typechecker/src/executors/typecheck/executor.ts
  - e2e/angular-typechecker-install-e2e/src/storybook-tarball.int.spec.ts
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: resolved
fixes_applied: 2026-07-06
findings_outcome:
  - id: WR-01
    severity: warning
    outcome: fixed
    commit: 58c3dad
    note: "Softened the executor advisory wording ('may not be fully type-checked'; a .tsx with no JSX is still fully checked; JSX under unset jsx reports TS17004). Verdict untouched. executor.spec.ts assertion updated."
  - id: IN-01
    severity: info
    outcome: fixed
    commit: 5807fa1
    note: "Deduped aggregated notTypeCheckedDeclaredFiles across surviving walk leaves via a Set (walk-references.ts). Raw diagnostic union untouched."
  - id: IN-02
    severity: info
    outcome: fixed
    commit: b770f72
    note: "Guarded the readConfigFile .config ?? {} fallback: skip .mdx enumeration when a leaf config read yields no config, avoiding a latent whole-tree **/* scan (detect-unchecked-declared.ts)."
---

# Phase 18: Code Review Report

> **Fixes applied 2026-07-06 (`/gsd:code-review 18 --fix --all`):** all 3 findings resolved
> (WR-01 `58c3dad`, IN-01 `5807fa1`, IN-02 `b770f72`). `nx test` (323/44), `build`, `lint`,
> `format:check` all green; core purity + green-verdict preserved.

**Reviewed:** 2026-07-06T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the D-01 "not type-checked" advisory (Phase 18, T11) and its packaged-tarball
Storybook e2e: the pure `detect-unchecked-declared.ts` detector, its plumbing into the
direct single-leaf path (`run-typecheck.ts`) and the solution-walk path
(`walk-references.ts`), the executor `logger.warn` render, and
`storybook-tarball.int.spec.ts`.

The four load-bearing correctness invariants ALL hold:

- **Verdict isolation (critical).** `evaluateResult` (evaluate-result.ts:87-132) reads
  only `errorCount`, `warningCount`, `suppressedInGraphErrorCount`,
  `suppressedInGraphWarningCount`, `templateCheckAborted`, and `skippedReferences`. It
  never reads `notTypeCheckedDeclaredFiles`; the executor consumes only `evaluateResult`'s
  `.success`. The advisory cannot flip the verdict. Confirmed GREEN-safe.
- **Core purity.** No `console`/`process` in `src/core/**` (all matches are in comments);
  only `ts.sys` + `node:path` are used, matching the existing `walk-references.ts` host.
- **Detection correctness.** `.mdx` enumeration uses `ts.ScriptKind.Deferred` (NOT the
  previously-broken `Unknown`) with `isMixedContent: false`
  (detect-unchecked-declared.ts:87); `.tsx`-without-`jsx` is `jsx === undefined || jsx === 0`
  (line 32). Aggregation in the walk lives in the surviving-leaf tail AFTER every skip
  `continue` (walk-references.ts:284-286), so out-of-project / skipped / not-found leaves
  contribute nothing.
- **e2e honesty (B-03).** The `nx add angular-typechecker` install carries NO peer override
  (line 130); `@storybook/angular@10.4.6 --legacy-peer-deps` is a distinct, later step
  (line 136); `stripAllNpmConfig` + a nonexistent `npm_config_userconfig` prevent a leaked
  override from masking a real ERESOLVE on our peers. Assertions use FULL code tokens
  (`TS2322`/`TS2345`/`NG8002`), never bare 4-digit substrings. Verified the `run` helper
  folds stderr into `.stdout` on the non-zero path (e2e-process.ts:100), so the
  `not.toContain('infrastructure error')` / `not.toMatch(/ERR_REQUIRE_ESM/)` guards are
  genuinely capable of failing on the planted-error runs.

No blockers. One quality WARNING (advisory over-reports fully-checked `.tsx`) and two INFO
items below.

## Warnings

### WR-01: `.tsx`-without-`jsx` advisory over-reports fully-type-checked files

**File:** `packages/angular-typechecker/src/core/detect-unchecked-declared.ts:28-39`
(claim in doc comment `:20-27` and `:41-53`; message rendered in
`packages/angular-typechecker/src/executors/typecheck/executor.ts:156-163`)

**Issue:** `detectTsxWithoutJsx` reports EVERY declared `.tsx` root file whenever
`compilerOptions.jsx` is unset/`None`, and the executor renders "declared file(s) are
not type-checked ... .tsx is only checked when compilerOptions.jsx is set." That premise
is imprecise, and the detector produces false positives:

- A `.tsx` containing NO JSX is fully type-checked even with `jsx` unset. It is flagged
  "not type-checked" despite being completely checked.
- A `.tsx` containing JSX under `jsx` unset produces a real, counted `TS17004` error
  (which FAILS the verdict). Such a file is simultaneously listed as "not type-checked
  (advisory, verdict unchanged)" AND is the cause of a hard failure -- a contradictory
  dual signal.

For a tool whose entire value proposition is honest, complete type-checking, an advisory
that tells the user a fully-checked file "is not type-checked" erodes trust. It is
advisory-only (no verdict impact), so this is not a blocker -- but it is a
correctness/quality defect in the surfaced output. This is a deliberate coarse heuristic
(JSX in `.tsx` is the common case), so the cheapest fix is wording, not detection.

**Fix:** Soften the claim so it does not overstate. Either adjust the executor message and
the detector doc to say the JSX-dependent caveat explicitly, e.g.:

```ts
// executor.ts (message)
`angular-typechecker: ${result.notTypeCheckedDeclaredFiles.length} declared file(s) may not be ` +
  `fully type-checked -- .mdx is never type-checked, and JSX in a .tsx is only checked when ` +
  `compilerOptions.jsx is set (a .tsx with no JSX is still fully checked; JSX under an unset ` +
  `jsx reports TS17004). This is ADVISORY: the verdict is unchanged. ` +
  `File(s): ${result.notTypeCheckedDeclaredFiles.join(', ')}.`
```

Or, if precision is preferred over the coarse heuristic, restrict the `.tsx` set to files
that actually contain JSX (read via `parsed`/program source text) rather than flagging
every declared `.tsx`. The wording change is the lazy, sufficient fix; the detection change
is only worth it if the false-positive noise proves noisy in practice.

## Info

### IN-01: Advisory may list duplicate paths across surviving walk leaves

**File:** `packages/angular-typechecker/src/core/walk-references.ts:284-286`

**Issue:** `notTypeCheckedDeclaredFiles.push(...detectUncheckedDeclaredFiles(...))` runs per
surviving leaf with no dedupe. If two surviving leaves declare the same `.mdx`/`.tsx`
(overlapping `include` globs), the path is pushed twice and rendered verbatim, joined with
`', '`, in the executor's `logger.warn` (executor.ts:156-163). Cosmetic only (advisory,
never affects the verdict), and consistent with the un-deduped `rootNamePaths` /
`skippedReferences`.

**Fix:** If duplicate display is undesirable, dedupe at the render boundary rather than in
core, e.g. in executor.ts: `[...new Set(result.notTypeCheckedDeclaredFiles)].join(', ')`.
Keeps core's raw union intact.

### IN-02: Empty-config fallback silently switches `.mdx` enumeration to "include everything"

**File:** `packages/angular-typechecker/src/core/detect-unchecked-declared.ts:65-66`

**Issue:** `ts.readConfigFile(leafTsConfigPath, ts.sys.readFile).config ?? {}` falls back to
`{}` when the file cannot be read/parsed. `ts.parseJsonConfigFileContent({}, ...)` defaults
`include` to `["**/*"]`, so the fallback would enumerate the ENTIRE `dirname(leafTsConfigPath)`
tree for `.mdx` instead of the config-declared set -- a silent over-enumeration. This path is
effectively unreachable today (the caller reaches this function only after
`ng.readConfiguration` on the same path succeeded, so `readConfigFile` also parses), so it is
latent, not live. Worth a guard so a future refactor that loosens the precondition does not
regress into whole-tree enumeration.

**Fix:** Return early with `tsxWithoutJsx` when the config read yields no usable object:

```ts
const readResult = ts.readConfigFile(leafTsConfigPath, ts.sys.readFile);

if (readResult.config === undefined) {
  return tsxWithoutJsx; // no reliable include set -> report only the .tsx set
}
```

---

_Reviewed: 2026-07-06T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
