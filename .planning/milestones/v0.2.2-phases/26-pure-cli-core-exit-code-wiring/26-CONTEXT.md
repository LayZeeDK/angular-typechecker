# Phase 26: Pure CLI core + exit-code wiring - Context

**Gathered:** 2026-07-16
**Status:** Ready for planning
**Mode:** `--auto` (autonomous discuss) `--analyze` `--chain`

<domain>
## Phase Boundary

Build the pure, in-process core of the standalone CLI: a
`run(argv, env): Promise<{ exitCode, stdout, stderr }>` that parses flags with
Node's stdlib `util.parseArgs`, resolves tsconfig paths from an arbitrary CWD
(nx-free), composes the SAME `runTypecheck` core the Nx executor and Angular CLI
builder use, and returns the correct literal exit code via the two-step compose
(`toExitCode` owns literal `2` for infra/usage; `evaluateResult().success` owns
the `0`-vs-`1` split). The three new files this phase delivers are
`src/cli/parse-args.ts`, `src/cli/main.ts` (the `run()` core), and
`src/cli/console-logger.ts` (a buffering `Logger`), plus their `*.spec.ts`
(VER-01) and `*.integration.spec.ts` (VER-02).

**All load-bearing correctness lives here** and is fully unit- and
integration-testable in-process -- no packaging, no `bin`, no `process.exit`, no
stream writes. This phase mirrors the composition already proven in
`executors/typecheck/executor.ts`, swapping the `@nx/devkit` logger for a
console/buffering logger and the Nx `{ success }` return for a literal exit code.

**In scope:** `parse-args.ts` (the `parseArgs` wrapper + flag validation +
usage-error mapping), `main.ts` (`run()` -- the compose + two-step exit code +
path resolution + color detection + `--help`/`--version`), `console-logger.ts`
(a `Logger` that buffers notice/error lines for the returned `stderr`), and the
unit + integration specs (VER-01/VER-02).

**Out of scope (later phases):** the `bin.ts` shell + `package.json` `bin` +
shebang/CRLF + `newLine: lf` + the `src/cli/**` ESLint import-ban + the
`bin-static.spec.ts` module-graph guard (all Phase 27: CLI-01, PKG-01/02, VER-03,
ADD-01); the shipped-tarball e2e + real-clone UAT (Phase 28: VER-04/05); README +
CHANGELOG (Phase 29: DOC-01). `process.exit`/flush-safety belongs to `bin.ts`
(Phase 27), NOT `run()`.

</domain>

<decisions>
## Implementation Decisions

### Exit-code compose (the milestone's whole reason to exist -- LOCKED by EXIT-01 + Pitfall 1)
- **D-01:** Two-step compose, NEVER `toExitCode` over raw counts:
  1. A caught `TypecheckInfrastructureError` -> `toExitCode(error)` = `2` (its
     FIRST live consumer, reserved since v0.0.3 COR-04).
  2. A usage error (parse failure / missing required `--tsConfig` / non-integer
     `--max-warnings`) -> `2` DIRECTLY (not via `toExitCode`, which only knows
     infra vs counts).
  3. A completed run -> `evaluateResult(result, { maxWarnings, strict }).success
     ? 0 : 1`. This is load-bearing: a `coverage-incomplete` or
     `warnings-exceeded` run has `errorCount === 0` but `success === false`; wiring
     the `0`/`1` split to `toExitCode`/`errorCount` would be a SILENT FALSE PASS
     that violates the charter. Render `evaluateResult().outcome` so a
     coverage-incomplete fail is not mistaken for a plain type error.

### `run()` shape + purity (LOCKED by EXIT-02 + CLI-03)
- **D-02:** `run(argv: string[], env: NodeJS.ProcessEnv = process.env):
  Promise<{ exitCode: 0 | 1 | 2; stdout: string; stderr: string }>`. It NEVER
  calls `process.exit` and NEVER writes a stream. Compose order (mirrors
  `executor.ts`): parseArgs -> (help/version/usage short-circuits) -> resolve
  paths -> `runTypecheck(coreOptions)` -> `emitAdvisoryNotices(result, logger)` ->
  `renderReport(result, { pathBase, color, failFast })` -> `evaluateResult(result,
  { maxWarnings, strict })` -> exit code. `stdout` = the report; `stderr` = the
  buffered notice/error lines.
- **D-03:** `stdout` carries ONLY the `renderReport` output (byte-deterministic
  codeframes). Every advisory notice, infra error, and usage message goes to
  `stderr`. This is the CLI-03 routing contract.

### Buffering / console logger (GA discussed; LOCKED shape)
- **D-04:** `src/cli/console-logger.ts` exports a `BufferingLogger` implementing
  `core/logger.ts`'s `Logger` (`info`/`warn`/`error`) that ACCUMULATES messages
  into an in-memory array; `run()` joins them (newline-separated) into the
  returned `stderr`. The REAL console/stream write happens ONLY in `bin.ts`
  (Phase 27). A buffering logger (not a live `console.error` logger injected into
  `run()`) is what keeps `run()` stream-free (EXIT-02) while still routing
  notices/errors to stderr (CLI-03). Internal class/function names are Claude's
  discretion.

### CWD + report path base (GA-1)
- **D-05:** `run()` resolves a RELATIVE `--tsConfig` against `process.cwd()` (a
  read, not a stream write -- EXIT-02 holds) using nx-free `node:path` (the
  nx-free equivalent of the executor's `joinPathFragments(context.root, ...)`).
  An absolute path passes through. The locked `run(argv, env)` signature is
  preserved -- CWD is NOT threaded as a third parameter.
- **D-06:** Each resolved tsconfig path is NORMALIZED before the boundary filter
  (PKG-03): `.replace(/\\/g, '/')` for POSIX-separator stability + `fs.realpathSync.native`
  for Windows drive-letter-case / 8.3-name normalization. This is the nx-free
  counterpart to what `normalize-options.ts` gets from `joinPathFragments`; it is
  exercised on the Windows CI cell (VER-02) with a relative `-c` from a non-root CWD.
- **D-07:** `pathBase = process.cwd()` so `renderReport` renders diagnostic paths
  CWD-relative (tsc/ngc/eslint parity, readable from a project directory).
  (Alternative considered + rejected: `pathBase` unset -> absolute paths --
  portable but noisier in logs. Reversible one-liner if a later phase disagrees.)

### `--max-warnings` validation (GA-2)
- **D-08:** `--max-warnings` accepts ONLY a non-negative integer. Parse the
  `parseArgs` string with `Number(raw)`; reject `!Number.isInteger(n) || n < 0`
  as a usage error -> exit `2` with a clear message (e.g. `--max-warnings expects
  a non-negative integer, got "x"`). Honors ARGS-04 ("non-integer -> 2") and is
  clearer than passing a negative through as unset (`evaluateResult` would treat
  it defensively as unset, silently ignoring a likely typo). `--max-warnings 0`
  stays valid (fail on ANY warning).

### Color detection (GA-3, ARGS-05)
- **D-09:** Precedence computed in `run()` from `env` (the 2nd param): (1)
  `NO_COLOR` present with ANY value -> color OFF; (2) else `FORCE_COLOR` present
  and not `"0"`/`"false"` -> color ON; (3) else `process.stdout.isTTY === true`.
  `NO_COLOR` WINS over `FORCE_COLOR` (per the NO_COLOR informal standard -- a user
  sets `NO_COLOR` to GUARANTEE no color). The boolean feeds `renderReport({ color })`,
  which strips ANSI when false (`format-report.ts`). The env branches are the
  deterministically-testable paths; the bare-TTY fallback reads
  `process.stdout.isTTY` (a read, like the executor does).

### `--version` + `--help` (GA-4)
- **D-10:** `--version` value = `require('../../package.json').version` (CJS JSON
  `require` works under `module: nodenext`; the published layout keeps
  `package.json` two dirs above `src/cli/`). A unit test asserts the emitted
  version equals the real `package.json` version so it can't drift. (Alternative
  rejected: a build-time generated version constant -- adds build machinery for no
  benefit.)
- **D-11:** `--help` / `-h` and `--version` print to `stdout` and return exit `0`.
  The `--help` synopsis MUST present the canonical uninstalled invocation as
  `npx angular-typechecker` and NEVER `npx atc` (Pitfall 5: `atc@0.0.6` is an
  UNRELATED published package; `atc` is only a post-install PATH shorthand). This
  phase emits a minimal usage synopsis (flag list + the `0`/`1`/`2` exit-code line);
  the full prose README is Phase 29 (DOC-01) and must stay consistent with it.

### Flag set + parse contract (LOCKED by ARGS-01/02/03)
- **D-12:** `util.parseArgs({ options, strict: true, allowPositionals: false })`,
  ZERO new runtime/dev dependencies (ARGS-01). Flags:
  - `--tsConfig` (short `-c`, `type: string`, `multiple: true`, REQUIRED)
  - `--max-warnings` (`type: string`, validated per D-08)
  - `--fail-fast` (`type: boolean`)
  - `--include-deps` (`type: boolean`)
  - `--strict` (`type: boolean`)
  - `--help` / `-h` (`type: boolean`)
  - `--version` (`type: boolean`)
  Mapping to existing knobs (NO new engine behavior): `--tsConfig` ->
  `CoreOptions.tsConfigPath` (per D-13); `--include-deps` -> `CoreOptions.includeDeps`;
  `--max-warnings` + `--strict` -> `evaluateResult` options; `--fail-fast` ->
  `renderReport` option. `-p` / `--project` is DELIBERATELY NOT registered (ARGS-02
  -- would collide with Angular CLI / Nx workspace *project* selection).
- **D-13:** Single vs multi `--tsConfig` (ARGS-03): `parseArgs` with `multiple:
  true` ALWAYS yields an array. Collapse a length-1 array to its single STRING
  before building `CoreOptions` -> the direct / solution-walk path. Two or more ->
  pass the `string[]` union -> the multi-tsConfig union path. A single input is
  NEVER passed as a one-element array (that would skip solution-tsconfig walking).
- **D-14:** Wrap `parseArgs` in try/catch: `strict: true` THROWS on an unknown
  flag or a missing option value; the catch maps it to a usage error (exit `2`)
  with a clear message (Pitfall 9). Missing required `--tsConfig` (parseArgs does
  not enforce required) is checked explicitly -> usage error exit `2`.

### nx-free CLI boundary (LOCKED by CLI-03)
- **D-15:** `src/cli/**` imports ONLY pure-core modules by RELATIVE path
  (`../core/run-typecheck`, `../core/evaluate-result`, `../core/exit-codes`,
  `../core/render-report`, `../core/emit-advisory-notices`, `../core/logger`) plus
  Node stdlib -- NEVER `@nx/devkit` / `nx`, NEVER `executor.ts` / `builder.ts`,
  and NEVER through the barrel `src/index.ts` (which omits the internal seams
  anyway -- it exports only `runTypecheck`/`CoreOptions`/`CoreResult`/
  `TypecheckInfrastructureError`/`SkippedReference`). The CLI is INSIDE the
  package, so like `executor.ts` it reaches internal core modules module-to-module.
  The enforcing ESLint `src/cli/**` import-ban + the static module-graph guard land
  in Phase 27 (CLI-03 / VER-03); Phase 26 respects the boundary by construction.

### Verification (LOCKED by VER-01/VER-02)
- **D-16:** VER-01 (Unit, `test` tier, `dependsOn: build`, 6-cell OS x Node
  matrix) against a STUBBED core: `parse-args` (flag mapping, `-c` repeatable,
  unknown-flag / missing-input / non-integer-`--max-warnings` -> usage 2,
  `--help`/`--version`, color env precedence), the exit-code composition in `run()`
  (clean->0; type-error->1; `coverage-incomplete` AND `warnings-exceeded`
  [`errorCount === 0`, `success === false`]->1; infra->2; usage->2), the buffering
  logger (report->stdout, notices/errors->stderr), and `--version` drift-lock.
- **D-17:** VER-02 (Integration, `*.integration.spec.ts`, `integration` target,
  real cold `@angular/compiler-cli`, same 6-cell matrix): `run(argv)` end-to-end
  in-process (NO spawn, NO tarball) against committed real-cold-compiler fixtures:
  clean->0, planted TS / template / NG8xxx->1 (code in `stdout`), a real
  coverage-incomplete->1, `--max-warnings 0` and `--strict`->1, multi-`--tsConfig`
  union + single-`--tsConfig` solution-walk, malformed / nonexistent tsconfig->2
  (`TypecheckInfrastructureError`). Exercises the CJS->ESM `await import()` bridge
  and, on the Windows cells, real path normalization (D-06).

### Claude's Discretion
- Internal file/function/class naming within `src/cli/` (`main.ts` vs `run.ts`;
  the `BufferingLogger` class name; whether parse+validate is one function or two).
- Exact `--help` / usage wording, as long as it uses `npx angular-typechecker`
  (never `npx atc`) and lists the flags + the `0`/`1`/`2` exit codes.
- Whether `run()` calls the five advisory helpers via `emitAdvisoryNotices`
  directly (yes -- reuse the Phase-25 seam; do not re-implement).
- Fixture layout / reuse for VER-02 (reuse existing `fixtures/` real-compiler
  fixtures where they already plant the needed codes).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + roadmap (what + why)
- `.planning/REQUIREMENTS.md` -- CLI-02 (same verdict/diagnostics as the executor
  by composing `runTypecheck`), CLI-03 (nx-free import boundary + stdout/stderr
  routing), ARGS-01..05 (parseArgs, `--tsConfig`/`-c` repeatable-required, single
  vs multi, `--help`/`--version`/usage->2, color env), EXIT-01/02 (literal 0/1/2 +
  two-step compose + pure `run()`), PKG-03 (nx-free path resolution +
  `realpathSync.native`), VER-01/02 (unit + integration tiers).
- `.planning/ROADMAP.md` -- "### Phase 26: Pure CLI core + exit-code wiring" (goal
  + the 5 success criteria this CONTEXT implements).

### Milestone research (HIGH confidence -- skip `--research-phase`, all 4 researchers converged)
- `.planning/research/v0.2.2-standalone-cli/SUMMARY.md` -- milestone synthesis;
  Pitfall 1 (exit-code compose) is THE correctness pitfall; the "Gaps to Address"
  (max-warnings non-integer, `--version` source, `-p`/`--tsConfig` naming) are
  resolved in the decisions above.
- `.planning/research/v0.2.2-standalone-cli/ARCHITECTURE.md` -- the third-thin-adapter
  design; `main.ts` / `parse-args.ts` / `console-logger.ts` component split.
- `.planning/research/v0.2.2-standalone-cli/FEATURES.md` -- flag-to-CoreOptions
  mapping; the exit-code contract prior art (ESLint / tsc / ngc).
- `.planning/research/v0.2.2-standalone-cli/PITFALLS.md` -- Pitfalls 1 (exit
  compose), 3 (nx-transitive crash class), 4 (`ERR_REQUIRE_ESM`), 6
  (`process.exit` flush -- Phase 27), 7 (path normalization), 9 (usage->2).

### Code seams the CLI composes (read to mirror, do NOT re-implement)
- `packages/angular-typechecker/src/executors/typecheck/executor.ts` -- the exact
  composition template `run()` mirrors (normalize -> runTypecheck ->
  emitAdvisoryNotices -> renderReport -> evaluateResult -> return; catch
  `TypecheckInfrastructureError`).
- `packages/angular-typechecker/src/executors/typecheck/normalize-options.ts` --
  the path-resolution + knob-split template (the CLI does the nx-free equivalent).
- `packages/angular-typechecker/src/core/exit-codes.ts` -- `toExitCode` (owns
  literal `2`; its own header comment says it is verdict-blind -- do NOT use it for
  the 0/1 split).
- `packages/angular-typechecker/src/core/evaluate-result.ts` --
  `evaluateResult(result, { maxWarnings, strict }) -> { success, outcome }` (owns
  the 0-vs-1 verdict; the `Outcome` label to render).
- `packages/angular-typechecker/src/core/render-report.ts` +
  `packages/angular-typechecker/src/core/format-report.ts` --
  `renderReport(result, { pathBase, color, failFast })`; `color: false` strips ANSI.
- `packages/angular-typechecker/src/core/run-typecheck.ts` -- `runTypecheck`,
  `CoreOptions` (`{ tsConfigPath: string | string[]; includeDeps; pathBase }`),
  `CoreResult`, `TypecheckInfrastructureError`.
- `packages/angular-typechecker/src/core/emit-advisory-notices.ts` +
  `packages/angular-typechecker/src/core/logger.ts` -- the Phase-25 seam
  (`emitAdvisoryNotices(result, logger)` + the structural `Logger`); the CLI
  injects its buffering logger here.
- `packages/angular-typechecker/src/index.ts` -- the barrel (confirms the internal
  seams are NOT exported; the CLI imports them relative, not via the barrel).

### Boundary + guard models (enforced/added in Phase 27, referenced now)
- `packages/angular-typechecker/eslint.config.mjs` -- the D-11 `**/src/core/**`
  purity block (bans `nx`/`@nx/*`/`@angular-devkit/*`, `no-console`,
  `process.exit`); the `src/cli/**` import-ban is added here in Phase 27.
- `packages/angular-typechecker/src/executors/typecheck/gate-a-static.spec.ts` --
  the model for Phase 27's `bin-static.spec.ts` module-graph / shebang guard.

### Prior context
- `.planning/phases/25-extract-the-advisory-notice-seam/25-CONTEXT.md` -- the
  Logger seam (D-01..D-03) + emission order the CLI inherits.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`executor.ts`** is the CLI's exact mirror: `run()` reuses the SAME core
  pipeline, swapping the `@nx/devkit` `logger` for a `BufferingLogger` and the Nx
  `{ success }` return for a literal exit code. Nothing in `core/` changes this
  phase (Phase 25 already extracted the advisory seam).
- **`evaluateResult(result, { maxWarnings, strict }) -> { success, outcome }`**
  already exists and is unit-testable with a 2-field literal -- the exit-code
  compose tests it with a STUBBED core (VER-01) with no compiler.
- **`toExitCode`** is the reserved COR-04 scaffold; this phase is its FIRST live
  consumer (infra = `2` only).
- **`renderReport({ pathBase, color, failFast })`** takes a plain `color` boolean;
  the CLI's only new work is DERIVING that boolean from env (D-09).
- **`core/logger.ts` `Logger`** (`info`/`warn`/`error`) is the injection seam;
  `Logger.error` was reserved in Phase 25 exactly for the CLI infra path.
- **`normalize-options.ts`** is the path-resolution template; the CLI does the
  nx-free equivalent (`node:path` + `realpathSync.native` instead of
  `joinPathFragments`).

### Established Patterns
- **Detection(core)-vs-rendering(adapter) split:** the core COUNTS/records; the
  adapter renders. `run()` is a third adapter over the same core.
- **nx-free `src/core/**` purity boundary** (ESLint D-11) is exactly what lets the
  CLI import the core seams without dragging `@nx/devkit`/`chalk` (the 24-06 crash
  class). `src/cli/**` extends the same discipline (enforced in Phase 27).
- **Executor compose order** (advisory notices BEFORE the report so they aren't
  lost below a codeframe dump) is preserved in `run()`.

### Integration Points
- `run()` composes the core seams (relative imports) + a `BufferingLogger`.
- `bin.ts` (Phase 27) wraps `run()`: `run(process.argv.slice(2)).then(write stdout/stderr + process.exit).catch(exit 2)` -- the ONLY `process.exit` / stream-write site.
- Phase 27 adds the `src/cli/**` ESLint import-ban + `bin-static.spec.ts`.
- Phase 28 adds the shipped-tarball e2e (literal 0/1/2 through the `.bin` shim).

</code_context>

<specifics>
## Specific Ideas

- **`-c`, NOT `-p` -- authoritative-source discrepancy to respect.** The research
  `SUMMARY.md` / `FEATURES.md` prose refer to a `-p` short flag, but the
  AUTHORITATIVE + newer `ROADMAP.md` (SC1) and `REQUIREMENTS.md` (ARGS-02) LOCK the
  short flag to `-c` and DELIBERATELY forbid `-p` / `--project` (collides with
  Angular CLI / Nx workspace *project* selection). The plan MUST use `-c`; the
  research `-p` wording is stale. Flagged so the planner is not misled by it.
- **Exit `2` for infra AND usage is the milestone's reason to exist** -- it lets
  agents/CI tell "could not run" (2) from "your types are wrong" (1) from "clean"
  (0). The silent-false-pass trap (a `coverage-incomplete`/`warnings-exceeded` run
  reading as `0`) is what D-01 exists to prevent.
- **`npx atc` supply-chain hazard** -- `atc@0.0.6` is a real, unrelated npm
  package. `--help` (and Phase 29 docs) steer to `npx angular-typechecker`.

</specifics>

<deferred>
## Deferred Ideas

- `bin.ts` shell + `package.json` `bin` (two names) + shebang/`newLine: lf` +
  `.gitattributes` + `process.exit`/flush-safety -- Phase 27 (CLI-01, PKG-01/02,
  Pitfall 6).
- `src/cli/**` ESLint import-ban + `bin-static.spec.ts` module-graph guard --
  Phase 27 (CLI-03 / VER-03).
- Shipped-tarball e2e (literal 0/1/2 through the `.bin` shim, npm/yarn/pnpm, Linux
  + Windows) + real-clone UAT -- Phase 28 (VER-04/05).
- README `## Standalone CLI` + exit-code table + curated CHANGELOG -- Phase 29
  (DOC-01).
- JSON / SARIF reporters (REP-01/02), `--watch` (CLIX-01), `--quiet` / explicit
  `--color`/`--no-color` / `--project` alias (CLIX-02) -- Future Requirements, out
  of scope this milestone.

None beyond the above -- discussion stayed within phase scope.

</deferred>

---

*Phase: 26-pure-cli-core-exit-code-wiring*
*Context gathered: 2026-07-16*
