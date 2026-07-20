---
phase: 26-pure-cli-core-exit-code-wiring
reviewed: 2026-07-16T13:25:46Z
depth: deep
files_reviewed: 6
files_reviewed_list:
  - packages/angular-typechecker/src/cli/parse-args.ts
  - packages/angular-typechecker/src/cli/console-logger.ts
  - packages/angular-typechecker/src/cli/main.ts
  - packages/angular-typechecker/src/cli/parse-args.spec.ts
  - packages/angular-typechecker/src/cli/main.spec.ts
  - packages/angular-typechecker/src/cli/main.integration.spec.ts
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 26: Code Review Report

**Reviewed:** 2026-07-16T13:25:46Z
**Depth:** deep
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the six net-new files that compose the standalone CLI's pure core: the
`node:util.parseArgs` seam (`parse-args.ts`), the in-memory `BufferingLogger`
(`console-logger.ts`), the load-bearing `run()` adapter (`main.ts`), and their
three spec files. Cross-file analysis traced `run()`'s composition of the shared
core seams (`runTypecheck`, `emitAdvisoryNotices`, `renderReport`,
`evaluateResult`, `toExitCode`) against the Nx executor it mirrors.

**Every load-bearing invariant in the review brief holds:**

- **Two-step exit-code compose is correct.** Usage errors return `2` directly
  (main.ts:120-124); `--help`/`--version` return `0` (main.ts:128-130); a caught
  `TypecheckInfrastructureError` returns `2` via `toExitCode` (main.ts:174-180);
  a completed run returns `evaluateResult(...).success ? 0 : 1` (main.ts:164-169)
  and NEVER reads raw error counts. The coverage-incomplete / warnings-exceeded
  false-pass floor is preserved (both are `errorCount === 0, success === false`
  and are proven by unit + integration tests).
- **`run()` purity holds.** No `process.exit`, no stream writes; it returns
  `{ exitCode, stdout, stderr }` with the report on stdout and the
  `BufferingLogger` buffer on stderr. `process.cwd()` / `process.stdout.isTTY`
  are reads only, matching the executor.
- **The `realpathSync.native` guard is correctly wrapped** in try/catch
  (main.ts:93-97) so a nonexistent tsconfig falls through to the resolved path
  and surfaces as an infra exit 2 through the core, never an uncaught ENOENT
  (proven end-to-end by the integration spec).
- **nx-free boundary holds by construction.** `src/cli/**` imports only
  `node:*` stdlib, relative `../core/*` pure modules, and the two sibling CLI
  seams; no `@nx/devkit` / `nx` / executor / builder / barrel import reaches the
  CLI runtime graph (verified transitively through every imported core module).
- **Short flag is `-c`**, `-p`/`--project` is deliberately unregistered
  (parse-args.ts:112), zero new dependencies, ASCII-only, and the TS blank-line /
  always-braces style is followed throughout.

No blocker-class defects were found. The remaining findings are input-validation
robustness at the CLI trust boundary, one stale cross-file doc comment, and minor
test-coverage / annotation gaps.

## Narrative Findings (AI reviewer)

### Warnings

#### WR-01: `--max-warnings` uses lenient `Number()` parsing; `--max-warnings=` silently becomes `0`

**File:** `packages/angular-typechecker/src/cli/parse-args.ts:145-147`
**Issue:** The validator is `const parsed = Number(rawMaxWarnings); if (!Number.isInteger(parsed) || parsed < 0)`. `Number()` accepts many non-decimal forms that a numeric-count flag should not:
- `--max-warnings 0x10` -> `16`, `--max-warnings 0b11` -> `3`, `--max-warnings 1e3` -> `1000` (all pass `Number.isInteger`).
- `--max-warnings "  5  "` (whitespace-padded) -> `5`.
- `--max-warnings=` (empty value, e.g. a shell var that expanded to nothing) -> `Number('') === 0`, which silently selects the STRICTEST gate (fail on ANY warning). A user who fat-fingered the value gets a maximally strict run with no error.

None of these cause a false PASS (the empty-string case fails safe by over-gating), so this is a robustness/UX defect rather than a correctness one, but a numeric CLI arg is a trust boundary and should validate strictly.
**Fix:** Reject anything that is not a run of decimal digits before coercing:
```ts
const rawMaxWarnings = values['max-warnings'];

if (rawMaxWarnings !== undefined) {
  // D-08: accept ONLY a non-negative decimal integer literal.
  if (!/^\d+$/.test(rawMaxWarnings)) {
    return {
      kind: 'usageError',
      message: `angular-typechecker: --max-warnings expects a non-negative integer, got "${rawMaxWarnings}".`,
    };
  }

  maxWarnings = Number(rawMaxWarnings);
}
```

#### WR-02: an empty / whitespace-only `-c` value is not rejected as a usage error

**File:** `packages/angular-typechecker/src/cli/parse-args.ts:130-138` (and consumed at `main.ts:88-98`)
**Issue:** The required-option guard only checks `tsConfig === undefined || tsConfig.length === 0` (array emptiness). A single blank value `-c ''` produces `tsConfig: ['']` (length 1), which passes the guard. In `run()`, `toAbsoluteTsConfigPath('')` resolves `''` against `process.cwd()`, yielding the CWD directory; `realpathSync.native` succeeds on the CWD, so the core is handed a directory path and surfaces a confusing downstream config/infra error (exit 1 or 2) instead of a clear usage message. The CLI is a trust boundary; a blank path is a usage mistake and should be reported as one.
**Fix:** Reject blank entries where the required-option check already runs:
```ts
const tsConfig = values.tsConfig;

if (
  tsConfig === undefined ||
  tsConfig.length === 0 ||
  tsConfig.some((path) => path.trim() === '')
) {
  return {
    kind: 'usageError',
    message:
      'angular-typechecker: missing required --tsConfig (-c) option. Pass at least one non-empty tsconfig path.',
  };
}
```

### Info

#### IN-01: `--help` / `--version` do not short-circuit strict parseArgs, so a bad companion token turns help into exit 2

**File:** `packages/angular-typechecker/src/cli/parse-args.ts:102-128`
**Issue:** `--help`/`--version` are read from `values` only AFTER `parseArgs({ strict: true, allowPositionals: false })` runs. So `angular-typechecker --help --typo`, or a stray positional (`angular-typechecker help`), throws inside parseArgs and returns a `usageError` (exit 2) instead of printing help. Help works alone and alongside known flags; only an unknown companion token or a positional breaks it. Low impact (arguably a strict-mode typo is worth surfacing), but many users expect `--help` to be robust.
**Fix:** Optional -- if help-robustness is wanted, pre-scan `argv` for `-h`/`--help`/`--version` before the strict `parseArgs` call and short-circuit. Otherwise document the behavior. Not required for this phase.

#### IN-02: stale doc comment in `core/exit-codes.ts` -- `main.ts` is now `toExitCode`'s first live consumer

**File:** `packages/angular-typechecker/src/core/exit-codes.ts:18-20, 42-43`
**Issue:** The header still asserts "So `toExitCode` currently has no live consumer" and "`toExitCode` has no live consumer today". Phase 26's `main.ts:179` makes `run()` the first live consumer of `toExitCode` (the infra path). The comment is now factually wrong and will mislead the next reader about whether the function is dead scaffold. This is out of the changed-file set but is a direct consequence of this phase's work.
**Fix:** Update the two comment passages to note the standalone CLI's `run()` (main.ts) is now the live consumer for the infrastructure exit-2 path.

#### IN-03: documented color / max-warnings edge cases are untested

**File:** `packages/angular-typechecker/src/cli/main.spec.ts:285-312`, `packages/angular-typechecker/src/cli/parse-args.spec.ts:121-172`
**Issue:** `colorFromEnv`'s emphasized edges are not covered: `NO_COLOR=''` (empty string present -> OFF, the whole point of the "including empty" note at main.ts:50) and `FORCE_COLOR='false'` (the `!== 'false'` branch at main.ts:64) -- only `NO_COLOR='1'`, `FORCE_COLOR='0'`, `FORCE_COLOR='1'`, and the isTTY fallback are tested. Likewise, the `--max-warnings` lenient forms (WR-01) have no test. The current code handles the empty-string NO_COLOR correctly, but the assertions do not lock it.
**Fix:** Add `run(..., { NO_COLOR: '' })` -> `color === false` and `run(..., { FORCE_COLOR: 'false' })` -> `color === false` cases; if WR-01 is applied, add rejection cases for `0x10` / `1e3` / empty `--max-warnings`.

#### IN-04: misleading return-type annotation on the `lastTsConfigPath` test helper

**File:** `packages/angular-typechecker/src/cli/main.spec.ts:82`
**Issue:** The helper is annotated `CoreResult['tsConfigPath'] | string | string[]`, but `CoreResult['tsConfigPath']` is a plain `string`, so the union collapses to `string | string[]`. The value it actually returns is `CoreOptions['tsConfigPath']` (`string | string[]`). Referencing `CoreResult` (the run OUTPUT) for a value read off the `runTypecheck` INPUT is cosmetically misleading.
**Fix:** Annotate as `CoreOptions['tsConfigPath']` (import the type) or simply `string | string[]`.

---

_Reviewed: 2026-07-16T13:25:46Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
