---
phase: 30-reporter-seam-json-reporter-format-threading-observability
reviewed: 2026-07-18T00:00:00Z
depth: deep
files_reviewed: 24
files_reviewed_list:
  - packages/angular-typechecker/src/core/diagnostic-record.ts
  - packages/angular-typechecker/src/core/json-report.ts
  - packages/angular-typechecker/src/core/render-report.ts
  - packages/angular-typechecker/src/core/run-typecheck.ts
  - packages/angular-typechecker/src/core/walk-references.ts
  - packages/angular-typechecker/src/cli/parse-args.ts
  - packages/angular-typechecker/src/cli/main.ts
  - packages/angular-typechecker/src/executors/typecheck/executor.ts
  - packages/angular-typechecker/src/executors/typecheck/normalize-options.ts
  - packages/angular-typechecker/src/executors/typecheck/schema.json
  - packages/angular-typechecker/src/executors/typecheck/schema.d.ts
  - packages/angular-typechecker/src/builders/typecheck/schema.json
  - packages/angular-typechecker/src/core/json-report.spec.ts
  - packages/angular-typechecker/src/core/__snapshots__/json-report.spec.ts.snap
  - packages/angular-typechecker/src/core/render-report.spec.ts
  - packages/angular-typechecker/src/core/run-typecheck.spec.ts
  - packages/angular-typechecker/src/core/walk-references.spec.ts
  - packages/angular-typechecker/src/core/total-files-count.integration.spec.ts
  - packages/angular-typechecker/src/core/infra-failure.spec.ts
  - packages/angular-typechecker/src/core/ts99-leak.integration.spec.ts
  - packages/angular-typechecker/src/cli/main.spec.ts
  - packages/angular-typechecker/src/cli/parse-args.spec.ts
  - packages/angular-typechecker/src/executors/typecheck/schema-parity.spec.ts
  - packages/angular-typechecker/src/builders/typecheck/schema-parity.spec.ts
findings:
  critical: 1
  warning: 2
  info: 3
  total: 6
status: issues_found
---

# Phase 30: Code Review Report

**Reviewed:** 2026-07-18
**Depth:** deep (cross-file call-chain tracing, incl. into `node_modules/nx` logger channels)
**Files Reviewed:** 24 (10 production, 14 spec/snapshot)
**Status:** issues_found

## Summary

Phase 30 adds the machine-readable JSON reporter (`core/diagnostic-record.ts`,
`core/json-report.ts`), widens the render seam (`core/render-report.ts`), threads
`--format`/`--quiet`/`--color` through the CLI + executor + builder, and captures
the `totalFilesCount` observability field.

The **cardinal correctness axes hold in the pure layer**:

- **Verdict purity** is intact. `formatJsonReport` delegates `summary.success`/`outcome`
  to `evaluateResult` and never re-derives from counts; the executor exit, the CLI exit,
  and the JSON `summary.success` all call `evaluateResult` with the same
  `{ maxWarnings, strict }`, so they cannot diverge. The coverage-incomplete
  anti-false-pass (`errorCount === 0`, `success === false`) is preserved and tested.
- **`evaluateResult` never reads `totalFilesCount`** (`EvaluateInput` Pick omits it; a
  negative test locks verdict-neutrality). Additive-only contract honored; barrel /
  `index.drift` / `builder.ts` untouched.
- **Off-by-one** in `positionsOf` is correct: 1-based on both axes for start AND end,
  `length ?? 0` end guard, file-less -> all-null. A hand-counted test pins it.
- **File-less diagnostics** are mapped 1:1 (`file: null` + null positions), never dropped.
- **`formatJsonReport` stdout is ANSI-free** (JSON.stringify over
  `flattenDiagnosticMessageText`); byte-identical under `FORCE_COLOR=1`.

However, one **BLOCKER breaks stdout purity in the shipped Nx executor / Angular CLI
builder JSON path** — a violation of the phase's own D-08 ("machine payload to stdout
ONLY; no stray `console.log` on stdout"). The CLI path is immune; the executor path is
not, and it is untested. Two WARNINGs (an inflated `totalFilesCount` metric; a shipped
undocumented feature) and three INFO items follow.

## Critical Issues

### CR-01 [BLOCKER]: Executor / Angular-CLI-builder `--format json` corrupts stdout with the third-party suppression notice

**File:** `packages/angular-typechecker/src/executors/typecheck/executor.ts:54` (unconditional `emitAdvisoryNotices`), consumed via `packages/angular-typechecker/src/core/emit-advisory-notices.ts:136` (`logger.info`)

**Issue:**
The executor calls `emitAdvisoryNotices(result, logger)` **unconditionally**, regardless
of `format`, then writes the machine payload with `process.stdout.write(report)`
(executor.ts:71). Inside `emitAdvisoryNotices`, `warnSuppressed` emits
`logger.info(...)` whenever `result.suppressedThirdParty > 0`
(emit-advisory-notices.ts:135-140). The injected `logger` here is `@nx/devkit`'s
`logger`, which re-exports Nx's logger; in a task process (`isOnDaemon()` false) that
logger is `createLogger(console)`, so `logger.info(s)` -> `console.info(s)` -> **stdout**
(`node_modules/nx/dist/src/utils/logger.js:26-33,65`; `console.info` is an alias of
`console.log`).

Net result for `nx typecheck <proj> --format json` when any node_modules diagnostic was
suppressed:

```
angular-typechecker: 3 node_modules diagnostic(s) suppressed (expected; pass includeDeps to include them).
{
  "formatVersion": 1,
  ...
}
```

stdout is no longer valid JSON — `jq` / `JSON.parse` fail. This is the exact failure the
phase forbids: **D-08** (30-CONTEXT.md:83-90) mandates "the machine payload goes to
**stdout ONLY** ... no stray `console.log` on stdout," and **T-30-07** (30-03-PLAN.md:225)
states "the payload goes to the raw stdout seam only, notices to stderr (D-08)." The
design assumed advisory notices "go to stderr via the injected `Logger`" — true for the
CLI (`BufferingLogger` routes info/warn/error to one in-memory buffer surfaced as
`stderr`, console-logger.ts:22-37), but **false for the executor/builder**, whose Nx
`logger.info` goes to stdout. The `Advisory` block is *already* embedded in the JSON
payload (`summary.suppressedThirdParty`, `summary.advisories.*`), so the notice is both
redundant and corrupting for machine formats.

Reachability: `suppressedThirdParty` is incremented for any node_modules-segment
diagnostic dropped by the boundary filter (filter-diagnostics.ts:191-194,278-280) — e.g.
`skipLibCheck: false`, a dependency `.ts`/`.js` source pulled into the graph, or a pnpm
symlinked lib canonicalizing under `node_modules`. Intermittent (project-dependent),
which is the worst kind: JSON works in one repo and silently corrupts in another. The
same defect reaches the Angular CLI builder (same executor body via `convertNxExecutor`).

Note the internal irony: executor.ts:68-70 comments that it uses `process.stdout.write`
"NOT `logger.info` (which prepends Nx chrome/color and corrupts...)" — yet the
`logger.info` in `emitAdvisoryNotices` fired just above (line 54) does exactly that.

**Fix:** Gate advisory emission on the human format in the executor (the JSON/SARIF
payload already carries every advisory field), mirroring how the CLI keeps stdout pure:

```ts
// executor.ts, replacing the unconditional call at line 54
if (format === 'human') {
  emitAdvisoryNotices(result, logger);
}
```

Alternative (keeps notices for all formats but off stdout): route the third-party notice
through `logger.warn` (stderr) instead of `logger.info` in
`emit-advisory-notices.ts:136`, so no advisory ever touches stdout — matching the CLI's
all-to-stderr posture. Prefer the executor-level gate; it also drops the redundant
stderr chatter for machine consumers.

Add a regression test at the e2e/executor tier that runs `--format json` against a
project with `suppressedThirdParty > 0` and asserts `JSON.parse(stdout)` succeeds (the
existing unit tests mock `renderReport` and the logger, so they structurally cannot catch
this).

## Warnings

### WR-01 [medium]: `totalFilesCount` counts Angular-generated `.ngtypecheck.ts` TCB shims — the "files checked" metric is inflated and version-sensitive

**File:** `packages/angular-typechecker/src/core/run-typecheck.ts:523-526` (direct path) and `packages/angular-typechecker/src/core/walk-references.ts:181-187` (walk accumulation)

**Issue:**
`totalFilesCount` is computed as
`getTsProgram().getSourceFiles().filter((sf) => !sf.isDeclarationFile).length`. That set
includes the synthetic `<name>.ngtypecheck.ts` type-check-block shims Angular injects into
the Program — they are non-declaration `.ts` files. The integration test confirms and
*pins* this: `total-files-count.integration.spec.ts:37-56` asserts `totalFilesCount === 2`
for a fixture with a single authored `shared.component.ts` (the 2 = source + its
`shared.component.ngtypecheck.ts` shim).

`CoreResult.totalFilesCount`'s own doc (run-typecheck.ts:140-152) calls it "the meaningful
'files checked' number for agents/CI," surfaced as `summary.totalFilesCount`. Counting
compiler-internal shims makes it *not* meaningful: a project with N authored files and C
components reports ~`N + C` (only component files get a shim), an odd number a consumer
cannot interpret as "files checked." It is also **non-reproducible across Angular
versions** — shim generation is a compiler internal that can change on a patch bump, so
the metric drifts for an unchanged source tree. The same codebase deliberately avoids
shims elsewhere (walk-references.ts:52-53 warns that `getRootFileNames()` "adds a
synthetic `<root>.ngtypecheck.ts` shim per root that would corrupt the input set") — this
capture reintroduces exactly that pollution into a shipped field.

**Fix:** Exclude synthetic shim files before counting, e.g. skip names ending in
`.ngtypecheck.ts` (and any other generated shim suffix), or count only source files whose
name is in the declared rootName set. Update the integration test's expected literal
(2 -> 1) and its rationale accordingly. If counting shims is intentional, rename/redocument
the field so consumers are not told it is "files checked."

### WR-02 [medium]: Shipped `format` option (executor + builder) and the new CLI flags are undocumented; the plan's README deliverable is unmet

**File:** `README.md` (no phase-30 change) vs `packages/angular-typechecker/src/executors/typecheck/schema.json:36-41`, `packages/angular-typechecker/src/cli/parse-args.ts:71`

**Issue:**
The executor/builder `format` enum (`human|json|sarif`) is shipped in both `schema.json`
files and is user-selectable via `nx typecheck <proj> --format json`. README.md has no
mention of `--format`, `json`, machine-readable output, `--quiet`, `--color`, or
`--no-color` (verified: `git diff 3ca0f74..HEAD -- README.md` is empty; `rg` finds none of
these tokens). `parse-args.ts:71` explicitly defers "the full prose ... to the package
README (DOC-01)," so the help text alone is not the intended documentation home.

30-03-PLAN.md listed "README.md `### Options` rows" as a Task-1 deliverable (line 34) and
a verification criterion — "Each of `--format`/`--quiet`/`--color`/`--no-color` appears in
HELP_TEXT AND has a README `### Options` row" (line 128). The README rows are absent, so a
shipped user-facing feature has no consumer documentation and the phase's own acceptance
criterion for this plan is not satisfied.

**Fix:** Add the `### Options` rows for `format` (executor/builder) and the CLI flags to
README.md, documenting the JSON output shape and the "machine payload -> stdout, notices
-> stderr" contract. If CLI docs are deferred until the standalone `bin` ships, at minimum
document the executor/builder `format` option, which is live now.

## Info

### IN-01 [low]: `--format sarif` runs the full type-check, then throws — no fail-fast, and an executor crash rather than a graceful result

**File:** `packages/angular-typechecker/src/core/render-report.ts:73-78`; validated-as-valid at `packages/angular-typechecker/src/cli/parse-args.ts:191-199`; executor catch at `packages/angular-typechecker/src/executors/typecheck/executor.ts:79-87`

**Issue:**
`sarif` passes parse-args enum validation and the executor/builder schema enum, so a user
can select it. The full (cold, seconds-long) compilation runs, and only then does
`renderReport`'s `sarif` case throw. In the executor the throw is not a
`TypecheckInfrastructureError`, so it is re-thrown (executor.ts:86) and Nx reports a
crashed executor with a stack trace instead of a clean `{ success: false }` + message. In
the CLI it is re-thrown out of `run()` to bin.ts. The message is actionable, and `sarif`
is documented as deferred, so this is low severity — but compiling first and then throwing
is wasteful and surfaces as an exception rather than a usage error.

**Fix:** Reject `sarif` earlier as a usage error (exit 2) in parse-args / normalize-options
until the renderer lands, or catch the deferred-format error in the executor and map it to
a clean `logger.error` + `{ success: false }` (avoiding a full compile + stack trace).

### IN-02 [low]: `totalFilesCount` "nothing checked" is represented inconsistently (absent vs `0`); the presence guard is dead code

**File:** `packages/angular-typechecker/src/core/run-typecheck.ts:534` and `:331` (guards); `:439-448` (direct empty-project path) vs `:752-764` (multi-tsconfig all-zero path)

**Issue:**
Two nits on the same field:
1. `...(totalFilesCount !== undefined ? { totalFilesCount } : {})` at run-typecheck.ts:534
   (direct path) and :331 (`finalizeUnion`) can never take the false branch — the value is
   `Set.size` / `Array.length`, always a `number`. The guard is dead code copied from the
   optional-array `presentIfNonEmpty` idiom, and misleads a reader into thinking the field
   is conditionally present here.
2. For the semantically-equivalent "no files were checked" state, the machine payload
   differs: the direct empty-project path (`finalize` without a count, :441-447) **omits**
   `totalFilesCount` (undefined), while the multi-tsconfig all-zero-rootNames path reaches
   `finalizeUnion` with `acc.sourceFileNames.size === 0` and **emits `totalFilesCount: 0`**.
   A consumer sees absent-vs-0 for the same condition.

**Fix:** Pick one representation for "nothing checked" (either always omit, or always emit
0 on any path where a Program was attempted) and drop the dead `!== undefined` guard so
the field is spread directly.

### IN-03 [low]: `relativizePath` leaks an absolute path across Windows drives

**File:** `packages/angular-typechecker/src/core/diagnostic-record.ts:113-121`

**Issue:**
When `absolutePath` and `pathBase` are on different drives (e.g. base `D:\ws` and a
diagnostic file on `C:\...`), `path.win32.relative` returns the absolute target (there is
no cross-drive relative path), so the JSON `file` / advisory paths become `C:/...` after
slash-normalization — defeating the T-30-04 intent that the payload "never leak an absolute
local path." Rare (cross-drive tsconfig references / symlinked deps), and full URI
normalization is Phase 31, so noting for awareness rather than as a defect to fix now.

**Fix:** When `relative()` yields an absolute path (drive-different / `path.isAbsolute`
true), decide a deliberate representation in Phase 31 (e.g. keep absolute but flag it, or
emit a URI). No action required this phase beyond awareness.

---

_Reviewed: 2026-07-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
