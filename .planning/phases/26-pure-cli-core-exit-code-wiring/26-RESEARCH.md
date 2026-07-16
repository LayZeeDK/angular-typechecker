# Phase 26: Pure CLI core + exit-code wiring - Research

**Researched:** 2026-07-16
**Domain:** A pure, in-process `run(argv, env)` core for the standalone CLI -- a third thin adapter that composes the SAME `runTypecheck` core the Nx executor already composes, swapping the `@nx/devkit` logger for a buffering logger and the Nx `{ success }` return for a literal exit code.
**Confidence:** HIGH (every claim verified against the actual code this session; the milestone research already converged HIGH and its `--research-phase: none` flag holds).

> This is SYNTHESIS + planning-readiness, not fresh discovery. The milestone research (all four researchers, HIGH) plus the locked CONTEXT.md decisions (D-01..D-17) already settle the design. Everything below is grounded in a direct read of the composing seams; the only NET-NEW finding is one path-normalization failure-mode subtlety (Open Question 1) that the locked decisions do not pin and that directly touches the VER-02 "nonexistent tsconfig -> 2" case.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Exit-code compose (D-01) -- the milestone's whole reason to exist:**
Two-step compose, NEVER `toExitCode` over raw counts:
1. Caught `TypecheckInfrastructureError` -> `toExitCode(error)` = `2` (its FIRST live consumer, reserved since v0.0.3 COR-04).
2. Usage error (parse failure / missing required `--tsConfig` / non-integer `--max-warnings`) -> `2` DIRECTLY (not via `toExitCode`, which only knows infra vs counts).
3. Completed run -> `evaluateResult(result, { maxWarnings, strict }).success ? 0 : 1`. Load-bearing: a `coverage-incomplete` or `warnings-exceeded` run has `errorCount === 0` but `success === false`; wiring 0/1 to `toExitCode`/`errorCount` is a SILENT FALSE PASS. Render `evaluateResult().outcome` so a coverage-incomplete fail is not mistaken for a plain type error.

**`run()` shape + purity (D-02, D-03):**
`run(argv: string[], env: NodeJS.ProcessEnv = process.env): Promise<{ exitCode: 0 | 1 | 2; stdout: string; stderr: string }>`. NEVER calls `process.exit`, NEVER writes a stream. Compose order mirrors `executor.ts`: parseArgs -> (help/version/usage short-circuits) -> resolve paths -> `runTypecheck` -> `emitAdvisoryNotices(result, logger)` -> `renderReport(result, { pathBase, color, failFast })` -> `evaluateResult(result, { maxWarnings, strict })` -> exit code. `stdout` = renderReport output ONLY (byte-deterministic codeframes); `stderr` = buffered notice/error lines. This is the CLI-03 routing contract.

**Buffering logger (D-04):**
`src/cli/console-logger.ts` exports a `BufferingLogger` implementing `core/logger.ts`'s `Logger` (`info`/`warn`/`error`) that ACCUMULATES messages into an in-memory array; `run()` joins them (newline-separated) into the returned `stderr`. The real console/stream write happens ONLY in `bin.ts` (Phase 27). Internal class/function names are Claude's discretion.

**CWD + report path base (D-05, D-06, D-07):**
`run()` resolves a RELATIVE `--tsConfig` against `process.cwd()` using nx-free `node:path` (the nx-free equivalent of `joinPathFragments(context.root, ...)`); an absolute path passes through. Signature preserves `run(argv, env)` -- CWD is NOT a third parameter. Each resolved path is NORMALIZED before the boundary filter (PKG-03): `.replace(/\\/g, '/')` + `fs.realpathSync.native` (Windows drive-letter-case / 8.3-name). `pathBase = process.cwd()` so `renderReport` renders diagnostic paths CWD-relative.

**`--max-warnings` validation (D-08):**
Accepts ONLY a non-negative integer. Parse the `parseArgs` string with `Number(raw)`; reject `!Number.isInteger(n) || n < 0` as a usage error -> exit `2` with a clear message. `--max-warnings 0` stays valid.

**Color detection (D-09, ARGS-05):**
Precedence computed in `run()` from `env` (2nd param): (1) `NO_COLOR` present with ANY value -> OFF; (2) else `FORCE_COLOR` present and not `"0"`/`"false"` -> ON; (3) else `process.stdout.isTTY === true`. `NO_COLOR` WINS over `FORCE_COLOR`. Boolean feeds `renderReport({ color })`.

**`--version` + `--help` (D-10, D-11):**
`--version` value = `require('../../package.json').version` (CJS JSON require under `module: nodenext`; published layout keeps `package.json` two dirs above `src/cli/`). A unit test asserts the emitted version equals the real `package.json` version (drift-lock). `--help`/`-h` and `--version` print to `stdout`, exit `0`. `--help` synopsis MUST present `npx angular-typechecker`, NEVER `npx atc`. Minimal usage synopsis (flag list + the `0`/`1`/`2` exit-code line); full README prose is Phase 29.

**Flag set + parse contract (D-12, D-13, D-14):**
`util.parseArgs({ options, strict: true, allowPositionals: false })`, ZERO new deps. Flags: `--tsConfig` (short `-c`, `type: string`, `multiple: true`, REQUIRED); `--max-warnings` (`type: string`, validated per D-08); `--fail-fast`, `--include-deps`, `--strict`, `--help`/`-h`, `--version` (all `type: boolean`). Mapping: `--tsConfig` -> `CoreOptions.tsConfigPath`; `--include-deps` -> `CoreOptions.includeDeps`; `--max-warnings` + `--strict` -> `evaluateResult` options; `--fail-fast` -> `renderReport` option. `-p`/`--project` is DELIBERATELY NOT registered. Single vs multi `--tsConfig`: `multiple: true` ALWAYS yields an array; collapse a length-1 array to its single STRING before building `CoreOptions` (direct/solution-walk path); 2+ -> pass the `string[]` union. Wrap `parseArgs` in try/catch: `strict: true` throws on unknown flag / missing option value -> map to usage error (exit `2`); missing required `--tsConfig` checked explicitly -> usage error exit `2`.

**nx-free CLI boundary (D-15):**
`src/cli/**` imports ONLY pure-core modules by RELATIVE path (`../core/run-typecheck`, `../core/evaluate-result`, `../core/exit-codes`, `../core/render-report`, `../core/emit-advisory-notices`, `../core/logger`) plus Node stdlib -- NEVER `@nx/devkit`/`nx`, NEVER `executor.ts`/`builder.ts`, and NEVER through the barrel `src/index.ts`. The enforcing ESLint ban + static module-graph guard land in Phase 27; Phase 26 respects the boundary by construction.

**Verification (D-16, D-17):** see the Validation Architecture section.

### Claude's Discretion
- Internal file/function/class naming within `src/cli/` (`main.ts` vs `run.ts`; the `BufferingLogger` class name; whether parse+validate is one function or two).
- Exact `--help` / usage wording, as long as it uses `npx angular-typechecker` (never `npx atc`) and lists the flags + the `0`/`1`/`2` exit codes.
- Whether `run()` calls the five advisory helpers via `emitAdvisoryNotices` directly (yes -- reuse the Phase-25 seam; do not re-implement).
- Fixture layout / reuse for VER-02 (reuse existing `fixtures/` real-compiler fixtures where they already plant the needed codes).

### Deferred Ideas (OUT OF SCOPE)
- `bin.ts` shell + `package.json` `bin` (two names) + shebang/`newLine: lf` + `.gitattributes` + `process.exit`/flush-safety -- Phase 27 (CLI-01, PKG-01/02, Pitfall 6).
- `src/cli/**` ESLint import-ban + `bin-static.spec.ts` module-graph guard -- Phase 27 (CLI-03 / VER-03).
- Shipped-tarball e2e + real-clone UAT -- Phase 28 (VER-04/05).
- README `## Standalone CLI` + exit-code table + curated CHANGELOG -- Phase 29 (DOC-01).
- JSON / SARIF reporters (REP-01/02), `--watch` (CLIX-01), `--quiet` / explicit `--color`/`--no-color` / `--project` alias (CLIX-02) -- Future Requirements.

**`process.exit` / stream writes belong to `bin.ts` (Phase 27), NEVER `run()`.**
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLI-02 | Same verdict/diagnostics as the executor by composing `runTypecheck` (complete set, single + solution walk, same boundary filtering), never a re-implementation. | `run()` mirrors `executor.ts` compose order VERBATIM (VERIFIED: `executor.ts:44-70`); reuses `runTypecheck`/`renderReport`/`evaluateResult` unchanged. |
| CLI-03 | nx-free import boundary + stdout/stderr routing (report->stdout, notices/errors->stderr). | Core seams are nx-free and NOT in the barrel (VERIFIED: `index.ts`, `eslint.config.mjs` core block); `BufferingLogger` -> stderr, `renderReport` string -> stdout. |
| ARGS-01 | Parsed with stdlib `util.parseArgs`, zero new deps. | Node builtin; milestone STACK verified the API. Zero packages installed (see Package Legitimacy Audit). |
| ARGS-02 | Input by tsconfig path via `--tsConfig` (short `-c`), repeatable + required; NOT `-p`/`--project`. Other knobs map to existing `CoreOptions`/adapter knobs. | D-12; mapping verified against `CoreOptions` (`run-typecheck.ts:20-45`), `evaluateResult` opts, `renderReport` opts. **Use `-c`, not `-p`** (see Known Discrepancy). |
| ARGS-03 | Single `--tsConfig` uses the string path; 2+ use the `string[]` union; single is never a 1-element array. | `runTypecheck` routes on `Array.isArray(options.tsConfigPath)` (VERIFIED: `run-typecheck.ts:348`); mirrors `normalize-options.ts:56-58`. |
| ARGS-04 | `--help`/`-h` and `--version` print + exit 0; unknown flag / missing `--tsConfig` / non-integer `--max-warnings` -> usage error exit 2. | D-08, D-11, D-14; `parseArgs` strict throw wrapped in try/catch. |
| ARGS-05 | Color auto-detected honoring `NO_COLOR`/`FORCE_COLOR`/TTY, feeding the formatter. | D-09; `renderReport({ color })` strips ANSI when false (VERIFIED: `render-report.ts:18-22` + `RenderOptions`). |
| EXIT-01 | Literal 0/1/2; infra->2 via `toExitCode`; 0-vs-1 from `evaluateResult().success`, never raw counts. | D-01; `toExitCode` is verdict-blind by design (VERIFIED: `exit-codes.ts` header + body); `evaluateResult` owns coverage-incomplete/warnings-exceeded (VERIFIED: `evaluate-result.ts:116-181`). |
| EXIT-02 | Pure `run(argv, env)` holds all decision logic, never `process.exit`/stream writes. | D-02; `bin.ts` (Phase 27) is the only I/O tier. |
| PKG-03 | tsconfig paths resolved from arbitrary CWD via nx-free `node:path` + `realpathSync.native`. | D-05, D-06; nx-free equivalent of `normalize-options.ts:53-58`. **Failure-mode subtlety flagged in Open Question 1.** |
| VER-01 | In-process unit specs on the 6-cell matrix against a STUBBED core. | Validation Architecture; stub pattern proven in `executor.spec.ts`. |
| VER-02 | `run(argv)` integration end-to-end against committed real-cold-compiler fixtures on the 6-cell matrix. | Validation Architecture; fixtures already exist (`fixtures/`). |
</phase_requirements>

## Summary

Phase 26 builds the pure in-process heart of the standalone CLI: three source files (`parse-args`, the `run()` core, a buffering `Logger`) plus their unit and integration specs. There is NO new engine behavior. `run()` is a mechanical mirror of the already-shipped `executors/typecheck/executor.ts` composition, verified line-by-line this session: it swaps the `@nx/devkit` `logger` for an in-memory `BufferingLogger`, swaps `joinPathFragments(context.root, ...)` for nx-free `node:path` resolution against `process.cwd()`, and swaps the Nx `{ success }` return for the literal exit code via the two-step compose. Every core seam it composes (`runTypecheck`, `emitAdvisoryNotices`, `renderReport`, `evaluateResult`, `toExitCode`, `Logger`) exists, is pure, and is nx-free -- and, crucially, is reached module-to-module (NOT via the curated barrel, which deliberately omits `evaluateResult`/`toExitCode`/`emitAdvisoryNotices`).

The single load-bearing correctness concern is the exit-code compose (D-01 / EXIT-01 / Pitfall 1), and it is the whole reason the milestone exists. `toExitCode` is verdict-blind by explicit design -- its own header says the CLI "must map `evaluateResult(...)`'s `success`/`outcome` to an exit code, NOT re-compute the verdict here." A `coverage-incomplete` or `warnings-exceeded` run has `errorCount === 0` but `success === false`; wiring 0/1 to `toExitCode`/`errorCount` would silently exit 0 on a real fail. The correct wiring is: infra catch -> `toExitCode(error)` (=2); usage error -> 2 directly; completed run -> `evaluateResult(...).success ? 0 : 1`.

One net-new subtlety the locked decisions do not pin: `fs.realpathSync.native` (D-06) THROWS `ENOENT` on a nonexistent path, but VER-02 requires a nonexistent/malformed tsconfig to return `{ exitCode: 2 }` from `run()` (not throw). The normalization must be try/catch-guarded so a nonexistent path falls through to the raw resolved absolute path, letting the core produce its canonical `TypecheckInfrastructureError` -> caught -> exit 2. See Open Question 1.

**Primary recommendation:** Copy `executor.ts`'s compose order verbatim into `run()`; put the two-step exit-code compose (D-01) at the center; guard `realpathSync.native` in try/catch; reuse `emitAdvisoryNotices` and the existing `fixtures/` for VER-02; do NOT touch anything in `core/`.

## Architectural Responsibility Map

The CLI is one Node process; "tiers" here are the adapter-vs-core responsibility split the codebase already enforces (detection/verdict/render in `core/`, I/O + policy wiring in the adapter).

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Argument parsing + usage-error mapping | CLI adapter (`parse-args.ts`) | -- | `util.parseArgs` + validation is adapter I/O concern; core never sees argv. |
| tsconfig path resolution + normalization | CLI adapter (`main.ts`) | Node stdlib (`node:path`, `node:fs`) | Core requires an ABSOLUTE path and never reads `process.cwd()` (VERIFIED: `CoreOptions` doc `run-typecheck.ts:20-33`). Adapter owns CWD resolution -- nx-free equivalent of `normalize-options.ts`. |
| Type-check engine (TS + template + NG8xxx, boundary filter, walk) | core (`runTypecheck`) | -- | Unchanged. CLI-02: compose, never re-implement. |
| Advisory-notice rendering | core (`emitAdvisoryNotices`) | CLI adapter injects the `BufferingLogger` | Phase-25 seam; pure, takes an injected `Logger`. Adapter owns the sink. |
| Human report rendering (+ color strip) | core (`renderReport`) | CLI adapter derives `color` from env | Shared render seam; loads compiler-cli + ts (ESM bridge) internally. |
| Pass/fail verdict (0-vs-1) | core (`evaluateResult`) | -- | Owns coverage-incomplete/warnings-exceeded. Adapter reads `.success` + `.outcome`. |
| Infra/usage exit code (=2) | core (`toExitCode`) for infra; CLI adapter for usage | -- | `toExitCode` owns the literal 2 for `TypecheckInfrastructureError`; usage->2 is set directly by the adapter (parseArgs/validation never reach the core). |
| Color detection from env | CLI adapter (`main.ts`) | Node stdlib (reads `env`, `process.stdout.isTTY`) | D-09 precedence; env branches deterministic, isTTY fallback is a read. |
| stdout/stderr routing | CLI adapter (`run()` return shape) | -- | CLI-03: report -> `stdout`; buffered notices/errors -> `stderr`. `run()` returns strings; `bin.ts` (Phase 27) writes them. |
| Process exit + stream writes | bin.ts (Phase 27 -- OUT OF SCOPE) | -- | EXIT-02: `run()` never touches `process.exit` or streams. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:util` `parseArgs` | Node builtin (Node `^22.22.3 \|\| ^24.15.0 \|\| ^26.0.0`) | Parse the 7-flag surface (`strict: true`, `allowPositionals: false`, `multiple: true` for repeatable `-c`, `short: { c: 'tsConfig', h: 'help' }`) | Stdlib, ladder rung 3; zero deps (ARGS-01). Stable on every supported runtime. |
| `node:path` (`isAbsolute`, `resolve`) | Node builtin | Resolve a relative `--tsConfig` against `process.cwd()` | nx-free equivalent of the executor's `joinPathFragments` (D-05). |
| `node:fs` (`realpathSync.native`) | Node builtin | Normalize Windows drive-letter case / 8.3 names before the boundary filter (D-06 / PKG-03) | Native realpath fixes what a raw string cannot; must be try/catch-guarded (Open Question 1). |
| `node:module` `createRequire` OR direct `require('../../package.json')` | Node builtin | Read `--version` from the package manifest (D-10) | CJS JSON require works under `module: nodenext`; a unit test drift-locks it. |
| The pure core (`runTypecheck`, `evaluateResult`, `renderReport`, `toExitCode`, `emitAdvisoryNotices`, `Logger`) | in-repo, unchanged | The CLI's only non-stdlib imports, reached by RELATIVE path | Verified nx-free + not in the barrel (D-15). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `util.parseArgs` | `commander` / `yargs` / `minimist` / `meow` / `cac` / `arg` | Adds a runtime dep for a 7-flag surface stdlib already covers. Rejected by ARGS-01 (no new deps). |
| stdlib color detection | `chalk` / `supports-color` / `picocolors` | Color already lives in `renderReport`/`format-report` (strips ANSI on `color: false`); the CLI only derives the boolean. Rejected. |

**Installation:** None. Zero new runtime or dev dependencies.

**Version verification:** N/A -- no packages installed this phase. The consumer Node range is already pinned in `package.json` `engines` (from PROJECT.md).

## Package Legitimacy Audit

**No external packages are installed in this phase.** The CLI core uses only Node stdlib builtins (`node:util`, `node:path`, `node:fs`, `node:module`) and in-repo pure-core modules. The Package Legitimacy Gate (slopcheck / registry verification) does not apply -- there is nothing to audit.

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
argv (from bin.ts, Phase 27)              env (NodeJS.ProcessEnv, 2nd param)
   |                                          |
   v                                          v
+---------------------------------------------------------------+
| parse-args.ts: util.parseArgs(strict, no positionals)         |
|   try/catch -> unknown flag / missing value -> usageError     |
|   validate: missing --tsConfig -> usageError                  |
|              non-integer --max-warnings -> usageError         |
|   --help / --version -> {help} / {version}                    |
+----------------------+----------------------------------------+
        |  usageError                    |  help/version
        v  -> {exitCode:2, stderr}       v  -> {exitCode:0, stdout: text}
        |                                |
        |  CliOptions (parsed + typed)
        v
+---------------------------------------------------------------+
| main.ts run(): resolve --tsConfig entries against cwd         |
|   isAbsolute ? p : resolve(cwd, p) ; .replace(\\ -> /) ;      |
|   realpathSync.native (try/catch -> fall through on ENOENT)   |
|   single -> string (direct/solution-walk) ; 2+ -> string[]    |
|   color = colorFromEnv(env)   pathBase = cwd                  |
+----------------------+----------------------------------------+
        v
   runTypecheck(coreOptions)  --(await import compiler-cli + ts inside core)-->  CoreResult
        |          \
        |           `-- throws TypecheckInfrastructureError --> toExitCode(e)=2 (stderr via BufferingLogger.error)
        v
   emitAdvisoryNotices(result, bufferingLogger)   --> stderr buffer (info/warn)
        v
   renderReport(result, {pathBase, color, failFast})  --> stdout string
        v
   evaluateResult(result, {maxWarnings, strict})  --> {success, outcome}
        v
   { exitCode: success ? 0 : 1, stdout: report, stderr: buffer.join('\n') }
```

The data-flow read: argv+env enter -> parse/validate (short-circuit help/version/usage) -> resolve+normalize paths -> compose the core exactly as the executor does -> map to `{ exitCode, stdout, stderr }`. `bin.ts` (Phase 27) is the only tier that writes the returned strings and calls `process.exit`.

### Recommended Project Structure
```
packages/angular-typechecker/src/cli/     # NEW -- sibling of executors/ and builders/
|-- parse-args.ts                          # util.parseArgs wrapper -> CliOptions | help | version | usageError
|-- parse-args.spec.ts                     # unit (VER-01)
|-- main.ts                                # run(argv, env): { exitCode, stdout, stderr } (pure)
|-- main.spec.ts                           # unit against a STUBBED core (VER-01)
|-- main.integration.spec.ts               # integration against real fixtures (VER-02)
'-- console-logger.ts                      # BufferingLogger implements core/logger.ts Logger
    (console-logger.spec.ts optional -- the buffer contract is small; can fold into main.spec.ts)
```
`@nx/js:tsc` already compiles `src/**/*.ts` (VERIFIED: `project.json` build target `main: src/index.ts`, and `tsconfig.lib.json` `include: src/**/*.ts`), so `src/cli/**` builds with ZERO build-config change. No `bin` field this phase (Phase 27).

### Pattern 1: Mirror the executor compose order exactly (CLI-02)
**What:** `run()` reproduces `executor.ts`'s pipeline, changing only the logger sink, the path resolver, and the return type.
**When to use:** always -- it is the CLI-02 charter (compose, never re-implement).
**Example (the verified executor template `run()` mirrors):**
```typescript
// Source: packages/angular-typechecker/src/executors/typecheck/executor.ts:44-81 (VERIFIED)
const { coreOptions, maxWarnings, failFast, color, strict } =
  normalizeOptions(options, context);
try {
  const result = await runTypecheck(coreOptions);
  emitAdvisoryNotices(result, logger);            // notices BEFORE the report
  const report = await renderReport(result, {
    pathBase: coreOptions.pathBase, color, failFast,
  });
  process.stdout.write(report);                   // <-- CLI returns this string instead
  const { success } = evaluateResult(result, { maxWarnings, strict });
  return { success };                             // <-- CLI returns exitCode instead
} catch (error) {
  if (error instanceof TypecheckInfrastructureError) {
    logger.error(`angular-typechecker: the Angular compiler failed to run ...`);
    return { success: false };                    // <-- CLI: return { exitCode: toExitCode(error) } = 2
  }
  throw error;                                     // re-throw unknowns (bin.ts catch -> 2)
}
```

### Pattern 2: The two-step exit-code compose (D-01 / EXIT-01 -- the load-bearing logic)
**What:** infra->2 (via `toExitCode`), usage->2 (direct), completed run->`evaluateResult().success ? 0 : 1`.
**Example:**
```typescript
// Grounded in exit-codes.ts (VERIFIED verdict-blind) + evaluate-result.ts (VERIFIED owns 0/1)
// usage error path (before runTypecheck):
if (parsed.kind === 'usageError') {
  logger.error(parsed.message);
  return { exitCode: 2, stdout: '', stderr: logger.text };
}
try {
  const result = await runTypecheck(coreOptions);
  emitAdvisoryNotices(result, logger);
  const report = await renderReport(result, { pathBase: cwd, color, failFast });
  const { success, outcome } = evaluateResult(result, { maxWarnings, strict });
  // Optionally surface `outcome` so a coverage-incomplete fail != a plain type error (D-01).
  return { exitCode: success ? 0 : 1, stdout: report, stderr: logger.text };
} catch (error) {
  if (error instanceof TypecheckInfrastructureError) {
    logger.error(`angular-typechecker: the Angular compiler failed to run (infrastructure error, not a type error): ${error.message}`);
    return { exitCode: toExitCode(error), stdout: '', stderr: logger.text }; // -> 2
  }
  throw error;
}
```
**Note:** `toExitCode` accepts `Pick<CoreResult,'errorCount'> | TypecheckInfrastructureError` (VERIFIED `exit-codes.ts:45-47`). Pass it ONLY the caught error, never the completed result -- passing the result would re-introduce the verdict-blind fork.

### Pattern 3: BufferingLogger over the structural `Logger` (D-04 / CLI-03)
**What:** a `Logger` (`info`/`warn`/`error`) that appends to an array; `run()` joins it into `stderr`. ALL three methods route to the same buffer (everything except the report is stderr).
**Example:**
```typescript
// console-logger.ts -- implements core/logger.ts Logger (VERIFIED: info/warn/error, error reserved for CLI infra)
export class BufferingLogger implements Logger {
  private readonly lines: string[] = [];
  info(m: string): void { this.lines.push(m); }
  warn(m: string): void { this.lines.push(m); }
  error(m: string): void { this.lines.push(m); }
  get text(): string { return this.lines.join('\n'); }
}
```
`@nx/devkit`'s `logger` is structurally assignable to `Logger` (that is how the executor injects it); the CLI's buffering variant is the same shape with a different sink. `emitAdvisoryNotices` uses only `info`/`warn` (VERIFIED `emit-advisory-notices.ts`); `error` is the CLI infra path (VERIFIED `logger.ts:22` reserves it for Phase 26).

### Pattern 4: Single-vs-array tsConfig collapse (ARGS-03 / D-13)
**What:** `parseArgs` with `multiple: true` ALWAYS yields `string[]`. Collapse length-1 to the single STRING; pass 2+ as the array.
**Why load-bearing:** `runTypecheck` routes on `Array.isArray(options.tsConfigPath)` (VERIFIED `run-typecheck.ts:348`). A single solution tsconfig passed as `['tsconfig.json']` hits `handleMultiTsConfig`, which treats each entry as a LEAF and does NOT walk references -> a solution config records a zero-root-names skip -> coverage-incomplete instead of being walked. Mirror `normalize-options.ts:56-58`.
```typescript
const resolved = raw.map(toAbsolute);            // toAbsolute = resolve+POSIX+realpath (guarded)
const tsConfigPath = resolved.length === 1 ? resolved[0] : resolved;
```

### Anti-Patterns to Avoid
- **`toExitCode(result)` as the sole exit source:** verdict-blind; silent false pass on coverage-incomplete/warnings-exceeded. Use `evaluateResult().success` for 0/1.
- **Passing a single `--tsConfig` as a 1-element array:** skips solution-walk. Collapse to string.
- **Importing anything nx (or `executor.ts`/`builder.ts`, or the barrel) into `src/cli/`:** re-introduces the 24-06 chalk-chain crash class and drags `@nx/devkit`. Import core modules by relative path only.
- **Reading via the barrel `src/index.ts`:** it exports only `runTypecheck`/`CoreOptions`/`CoreResult`/`TypecheckInfrastructureError`/`SkippedReference` (VERIFIED). `evaluateResult`/`toExitCode`/`renderReport`/`emitAdvisoryNotices`/`Logger` are NOT exported -- import them module-to-module.
- **Calling `realpathSync.native` unguarded:** it throws `ENOENT` on a nonexistent path, breaking the VER-02 "nonexistent tsconfig -> 2" case. Guard it (Open Question 1).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Arg parsing | A custom flag scanner | `util.parseArgs` | Stdlib; handles `strict`, `short`, `multiple`, missing-value throw. |
| The type-check | Re-parse tsconfig / shell out to `ngc` | `runTypecheck` | CLI-02; loses template + NG8xxx completeness. |
| Pass/fail verdict | Re-derive from `errorCount` | `evaluateResult` | Owns coverage-incomplete/warnings-exceeded; single source of truth. |
| Report formatting + color | A codeframe formatter / ANSI stripper | `renderReport({ color })` | Already byte-deterministic (`\n`, sorted, deduped); strips ANSI on `color: false`. |
| Advisory notices | Five `console.error` copies | `emitAdvisoryNotices(result, logger)` | Phase-25 seam; the five messages are correctness-bearing and must not drift. |
| Version string | Hardcode `'0.2.x'` | `require('../../package.json').version` + drift-lock test | Drifts on every release otherwise. |

**Key insight:** The entire CLI is glue. If you find yourself writing logic that decides pass/fail, counts diagnostics, or formats a codeframe, you are re-implementing the core -- stop and compose the existing seam.

## Common Pitfalls

### Pitfall 1: Exit code wired to `toExitCode`/`errorCount` (silent false pass)
**What goes wrong:** `run()` returns 0 for a `coverage-incomplete` or `warnings-exceeded` run (both `errorCount === 0`, both `success === false`).
**Why it happens:** `toExitCode` LOOKS like the exit policy (named for it, lives in `core/`). It is verdict-blind by design.
**How to avoid:** two-step compose (Pattern 2). `toExitCode` only in the infra catch; 0/1 from `evaluateResult().success`.
**Warning signs:** any test asserting the verdict from `errorCount`; a `--max-warnings 0`-with-a-warning run exiting 0.

### Pitfall 2: `realpathSync.native` throwing on a nonexistent tsconfig (breaks VER-02 exit 2)
**What goes wrong:** D-06 mandates `realpathSync.native` for Windows normalization, but it throws `ENOENT` for a path that does not exist. VER-02 requires a nonexistent/malformed tsconfig to return `{ exitCode: 2 }` from `run()`. An unguarded call throws a plain `Error` (not `TypecheckInfrastructureError`) out of `run()`.
**Why it happens:** `realpathSync.native` is a filesystem read that requires existence; the core's own boundary realpath is a try/catch (RES-02) precisely for this reason.
**How to avoid:** wrap the normalization in try/catch; on failure fall through to the plain resolved absolute path (still `.replace(/\\/g,'/')`-normalized) and let `runTypecheck`'s config-resolution stage throw the canonical `TypecheckInfrastructureError` -> caught -> exit 2 with a good message. See Open Question 1.
**Warning signs:** VER-02 "nonexistent tsconfig" test sees an uncaught throw / exit code other than 2, or a message that does not mention the compiler failing to run.

### Pitfall 3: nx-transitive import leaking into `src/cli/`
**What goes wrong:** importing `executor.ts`/`builder.ts` or widening the barrel drags `@nx/devkit` -> `chalk`/`ora`/`log-symbols` (24-06 crash class + cold-start tax).
**How to avoid:** import ONLY pure-core modules by relative path (D-15). Phase 26 respects this by construction; Phase 27 adds the ESLint ban + module-graph guard.
**Warning signs:** any `import ... from '@nx/...'` or `from '../executors/...'` or `from '../index'` in `src/cli/`.

### Pitfall 4: Usage/parse errors mis-mapped to exit 1
**What goes wrong:** `parseArgs` strict-mode throws `ERR_PARSE_ARGS_*` on unknown flag / missing value; if unhandled, Node exits 1 with a stack.
**How to avoid:** wrap `parseArgs` in try/catch -> usage error -> exit 2 (D-14). Missing required `--tsConfig` and non-integer `--max-warnings` -> exit 2 too. `--help`/`--version` -> exit 0.
**Warning signs:** `atc --nonsense` returns exitCode 1; no-`--tsConfig` returns 1.

### Pitfall 5: `stdout` contaminated by notices
**What goes wrong:** an advisory notice or error string lands in the returned `stdout`, corrupting the byte-deterministic codeframe stream / problem-matcher parsing.
**How to avoid:** `stdout` is EXCLUSIVELY the `renderReport` string (D-03). Everything from the `BufferingLogger` (info/warn/error) goes to `stderr`. help/version text goes to `stdout` (they are the report in that mode) and short-circuit before the core runs.

### Pitfall 6 (deferred, do NOT solve here): `process.exit` flush race
Belongs to `bin.ts` (Phase 27). `run()` returns strings and never writes a stream, so the flush race cannot occur in this phase. Noted only so the planner does not pull it forward.

## Code Examples

### parseArgs configuration (D-12)
```typescript
// Source: D-12 + Node util.parseArgs (stdlib). '-c' short, NOT '-p' (ARGS-02).
import { parseArgs } from 'node:util';
const { values } = parseArgs({
  args: argv,
  strict: true,
  allowPositionals: false,
  options: {
    tsConfig:      { type: 'string',  short: 'c', multiple: true },
    'max-warnings':{ type: 'string' },
    'fail-fast':   { type: 'boolean' },
    'include-deps':{ type: 'boolean' },
    strict:        { type: 'boolean' },
    help:          { type: 'boolean', short: 'h' },
    version:       { type: 'boolean' },
  },
});
```

### --max-warnings validation (D-08 / ARGS-04)
```typescript
// Non-negative integer only; else usage error -> exit 2.
let maxWarnings: number | undefined;
const raw = values['max-warnings'];
if (raw !== undefined) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    return usageError(`--max-warnings expects a non-negative integer, got "${raw}"`);
  }
  maxWarnings = n;
}
```

### Color precedence (D-09 / ARGS-05)
```typescript
function colorFromEnv(env: NodeJS.ProcessEnv): boolean {
  if (env.NO_COLOR !== undefined) return false;                 // NO_COLOR wins, any value
  const fc = env.FORCE_COLOR;
  if (fc !== undefined && fc !== '0' && fc !== 'false') return true;
  return process.stdout.isTTY === true;                          // read, not a write
}
```

## State of the Art

Nothing changed since the milestone research (2026-07-16, same day). `util.parseArgs` remains stable stdlib on Node 22/24/26. The ESLint 0/1/2 exit-code model (distinct usage/infra 2) is unchanged prior art. No deprecations relevant to this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `require('../../package.json').version` resolves the manifest from the compiled `src/cli/main.js` location (package.json two dirs up). | D-10 / Standard Stack | `--version` throws / reads wrong file. LOW: the drift-lock unit test (D-16) catches it immediately; `main: ./src/index.js` (VERIFIED) confirms compiled files sit under `src/`, so `src/cli/main.js` -> `../../package.json` is correct. Alternative: `createRequire(import.meta-less)` -- but plain CJS `require` works under `module: nodenext` (VERIFIED `tsconfig.json:4`). |
| A2 | `atc@0.0.6` is a real, unrelated published npm package (the `npx atc` supply-chain hazard driving the `npx angular-typechecker`-only `--help` synopsis). | D-11 | If wrong, the `--help` wording is merely conservative (no harm). CITED from milestone PITFALLS.md (npm registry, 2026-07-16); not re-verified this session (Phase 29 owns the docs, this phase only emits the minimal synopsis). |
| A3 | `realpathSync.native` on Windows fixes drive-letter case / 8.3 names as PKG-03 intends. | D-06 / Pitfall 2 | If the normalization is insufficient, the Windows VER-02 cell surfaces a wrong verdict. MEDIUM confidence (milestone Pitfall 7, well-established Node behavior); the Windows CI cell is the assertion (D-17). |

**All three are low-to-medium risk and each has a test that catches it.** No compliance/security/retention assumptions.

## Open Questions

1. **`realpathSync.native` failure handling on a nonexistent/malformed `--tsConfig` (the one genuine planning decision the locked decisions do not pin).**
   - What we know: D-06 mandates `realpathSync.native`; VER-02 mandates a nonexistent/malformed tsconfig returns `{ exitCode: 2 }` from `run()` (NOT a throw); the core throws `TypecheckInfrastructureError` at its config-resolution stage for such a path (VERIFIED: `throwIfInfrastructureFailure` applied at config parse, `run-typecheck.ts:173-185`).
   - What's unclear: `realpathSync.native` runs BEFORE the core and throws a plain `ENOENT Error` (not `TypecheckInfrastructureError`) on a nonexistent path -- so an unguarded call would bypass the core's canonical error path.
   - Recommendation: wrap the per-path normalization in try/catch; on failure use the plain `resolve(cwd, p).replace(/\\/g,'/')` result and let the core throw the canonical `TypecheckInfrastructureError` -> caught -> `toExitCode(error)` = 2. This mirrors the core's own RES-02 realpath try/catch discipline and keeps the exit-2 message consistent. The planner should make this an explicit task step with a VER-02 fixture (`fixtures/config-broken/tsconfig.does-not-exist.json` OR the malformed `fixtures/config-broken/tsconfig.malformed.json`, both present).

2. **Whether `console-logger.spec.ts` is a separate file or folded into `main.spec.ts`.**
   - The `BufferingLogger` contract is tiny (append + join). Claude's discretion (D-04 allows internal naming/structure). Recommendation: fold its assertions into `main.spec.ts` unless the class grows -- YAGNI on a separate spec file.

## Environment Availability

The unit tier is pure (stubbed core) -- no external dependencies. The integration tier composes the real cold `@angular/compiler-cli` + `typescript`, both already installed and pinned in the workspace (VERIFIED: they are the plugin's `peerDependencies` and are present in the dev workspace `node_modules`; the existing `*.integration.spec.ts` suite already runs them). No new tools required.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@angular/compiler-cli` | VER-02 integration (real type-check) | Yes | 22.x (workspace peer, present) | -- |
| `typescript` | VER-02 integration | Yes | 6.0.x (workspace peer, present) | -- |
| Node `util.parseArgs`/`path`/`fs` | VER-01 + VER-02 | Yes | Node `^22.22.3 \|\| ^24.15.0 \|\| ^26.0.0` | -- |

**Missing dependencies:** none.

## Validation Architecture

Grounded in the repo's existing Vitest pyramid (VERIFIED: `project.json` `test` + `integration` targets, both `dependsOn: build`; `vitest.config.mts` includes `{src,tests}/**/*.{test,spec}.*` and EXCLUDES `**/*.integration.spec.ts`; `vitest.integration.config.mts` includes `src/**/*.integration.spec.ts`; `ci.yml` runs both on the LEAN 6-cell matrix).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x via `@nx/vitest:test` |
| Unit config | `packages/angular-typechecker/vitest.config.mts` (excludes `*.integration.spec.ts`; `jsdom`; 30s timeout) |
| Integration config | `packages/angular-typechecker/vitest.integration.config.mts` (includes only `*.integration.spec.ts`; real cold compiler; 30s timeout) |
| Quick run (unit) | `nx test angular-typechecker` (or `vitest run --config .../vitest.config.mts src/cli/main.spec.ts`) |
| Full suite | `nx test angular-typechecker && nx run angular-typechecker:integration` |

Both targets `dependsOn: build`, so the specs run against the COMPILED `dist` output (the same GATE-A invariant the executor specs ride -- the CJS->ESM `await import()` bridge is exercised for real in the integration tier).

### Phase Requirements -> Test Map

**Unit tier (VER-01) -- `src/cli/parse-args.spec.ts` + `src/cli/main.spec.ts`, STUBBED core (mirror `executor.spec.ts`'s `vi.hoisted` + `vi.mock` pattern, keeping the REAL `TypecheckInfrastructureError` via `importOriginal`):**

| Req | Behavior | Test | File Exists? |
|-----|----------|------|-------------|
| ARGS-02 | `-c`/`--tsConfig` maps to `tsConfigPath`; `-c` repeatable | `parse-args.spec.ts` | Wave 0 |
| ARGS-02 | `-p`/`--project` is NOT registered (unknown-flag -> usage 2) | `parse-args.spec.ts` | Wave 0 |
| ARGS-03 | single `-c` -> string; two `-c` -> `string[]` | `parse-args.spec.ts` / `main.spec.ts` (assert the value handed to the stubbed `runTypecheck`) | Wave 0 |
| ARGS-04 | unknown flag / missing `-c` value / missing required `--tsConfig` / non-integer `--max-warnings` -> usage error, exit 2 | `parse-args.spec.ts` | Wave 0 |
| ARGS-04 | `--help`/`-h` and `--version` -> exit 0, text in stdout | `main.spec.ts` | Wave 0 |
| ARGS-05 | `NO_COLOR` wins over `FORCE_COLOR`; `FORCE_COLOR=0` -> off; env-absent -> isTTY | `main.spec.ts` (pass `env` literals) | Wave 0 |
| EXIT-01 | clean (stub `{success:true}`) -> 0 | `main.spec.ts` | Wave 0 |
| EXIT-01 | type-error (stub `{success:false, outcome:'type-error'}`) -> 1 | `main.spec.ts` | Wave 0 |
| EXIT-01 | **coverage-incomplete AND warnings-exceeded (stub `errorCount:0`, `{success:false}`) -> 1** (the subtlest new logic; the anti-false-pass) | `main.spec.ts` | Wave 0 |
| EXIT-01 | infra (stub `runTypecheck` rejects `TypecheckInfrastructureError`) -> 2 via `toExitCode` | `main.spec.ts` | Wave 0 |
| EXIT-01 | usage error -> 2 (direct, before the core) | `main.spec.ts` / `parse-args.spec.ts` | Wave 0 |
| CLI-03 | report -> `stdout`; notices+errors (via BufferingLogger) -> `stderr`; stdout never carries a notice | `main.spec.ts` | Wave 0 |
| EXIT-02 | `run()` never calls `process.exit` / writes a stream (spy asserts no `process.stdout.write` / `process.exit`) | `main.spec.ts` | Wave 0 |
| VER-01 | `--version` equals the real `package.json` version (drift-lock) | `main.spec.ts` | Wave 0 |
| D-04 | `BufferingLogger` accumulates info/warn/error into the joined `stderr` | `main.spec.ts` (or `console-logger.spec.ts`) | Wave 0 |

**Integration tier (VER-02) -- `src/cli/main.integration.spec.ts`, real cold compiler, NO spawn/tarball (call `run(argv)` in-process). Reuse existing top-level `fixtures/` (VERIFIED present):**

| Req | Behavior | Fixture (existing) | File Exists? |
|-----|----------|--------------------|-------------|
| VER-02 | clean -> 0 | a clean leaf (e.g. `fixtures/ts-baseline` / a clean layout fixture) | Wave 0 |
| VER-02 | planted TS error -> 1, code in `stdout` | `fixtures/ng-baseline` (`error.component.ts`) or `fixtures/gate-b-error` | Wave 0 |
| VER-02 | planted template / NG8xxx error -> 1 | `fixtures/gate-b-error` (template) + an `fixtures/extended-*` (NG8xxx) | Wave 0 |
| VER-02 | real coverage-incomplete -> 1 | `fixtures/solution-style-empty` (zero-root-names) or a suppressed-in-graph fixture | Wave 0 |
| VER-02 | `--max-warnings 0` -> 1; `--strict` -> 1 | an NG8xxx-warning fixture (`fixtures/extended-*`) | Wave 0 |
| VER-02 | multi-`--tsConfig` union | `fixtures/multi-tsconfig-array` (app + spec leaves) | Wave 0 |
| VER-02 | single-`--tsConfig` solution-walk | `fixtures/solution-style` (has `tsconfig.json` solution + leaves) | Wave 0 |
| VER-02 | malformed / nonexistent tsconfig -> 2 (`TypecheckInfrastructureError`) | `fixtures/config-broken/tsconfig.malformed.json` + `.../tsconfig.does-not-exist.json` (both present) -- **exercises Open Question 1** | Wave 0 |
| PKG-03 | Windows cells: relative `-c` from a non-root CWD -> same verdict as canonical | any of the above, invoked with `env`/cwd overrides on the Windows cells | Wave 0 |

### Sampling Rate
- **Per task commit:** `nx test angular-typechecker` (fast unit tier).
- **Per wave merge:** `nx test angular-typechecker && nx run angular-typechecker:integration`.
- **Phase gate:** both green on the merged main checkout before `/gsd:verify-work`.

Both tiers ride the LEAN 6-cell matrix (VERIFIED `ci.yml:106-111`): Linux x {22,24,26} + Windows x {24,26} + macOS x 24. The Windows cells give free cross-OS coverage of parse/exit/path logic (PKG-03).

### Wave 0 Gaps
- [ ] `src/cli/parse-args.spec.ts` -- ARGS-01..05 flag mapping + usage errors
- [ ] `src/cli/main.spec.ts` -- exit-code compose (EXIT-01), routing (CLI-03), purity (EXIT-02), color (ARGS-05), version drift-lock (VER-01)
- [ ] `src/cli/main.integration.spec.ts` -- VER-02 end-to-end against `fixtures/`
- [ ] No framework install needed; no new fixtures needed (existing `fixtures/` cover every VER-02 case -- confirm the exact clean fixture during planning).

**Sampling adequacy:** the single subtlest new logic is the exit-code compose. The minimum regression net is: one unit test per branch (clean/type-error/coverage-incomplete/warnings-exceeded/infra/usage) with a stubbed `evaluateResult`, PLUS the VER-02 real coverage-incomplete + nonexistent-tsconfig integration cases (which no stub can fake -- they exercise the core + the realpath guard). Together they catch any regression that would re-introduce the silent false pass or the ENOENT throw.

## Security Domain

`security_enforcement` is absent from config -> treated as enabled. The CLI's only trust boundary is untrusted argv/env; input validation (V5) is the applicable category.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface. |
| V3 Session Management | no | Stateless CLI. |
| V4 Access Control | no | No privileged operations. |
| V5 Input Validation | yes | `parseArgs` (`strict: true`, `allowPositionals: false`); `--max-warnings` non-negative-integer check (D-08); a malformed number/flag is a usage error (exit 2), never a crash or an inverted verdict. |
| V6 Cryptography | no | None. |

### Known Threat Patterns for a Node CLI over untrusted argv
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path injection via `--tsConfig` | Tampering | The core reads tsconfigs via `ts`/`fs` APIs, NOT a shell -- `run()` MUST NOT `exec`/`spawn` any user input. Keep it that way. |
| Malformed `--max-warnings` inverting the verdict | Tampering | D-08 rejects non-integers as usage errors; `evaluateResult` additionally treats negative/NaN defensively as unset (VERIFIED `evaluate-result.ts:143-147`). |
| Absolute-path info leak in output | Information Disclosure | `pathBase = process.cwd()` (D-07) renders CWD-relative diagnostic paths, matching the executor's CI-annotation intent. |
| Uncaught throw exposing a stack | Info Disclosure (minor) | `run()` returns exit 2 for infra; unknown throws re-thrown to `bin.ts` (Phase 27) which prints the stack to stderr -- acceptable for a dev tool. |

No compliance/retention requirements apply.

## Sources

### Primary (HIGH confidence -- verified this session by direct read)
- `packages/angular-typechecker/src/executors/typecheck/executor.ts` -- the exact compose template `run()` mirrors (compose order, infra catch, re-throw discipline).
- `packages/angular-typechecker/src/executors/typecheck/normalize-options.ts` -- path-resolution + knob-split template (`resolveOne`, single-vs-array, `color = isTTY`).
- `packages/angular-typechecker/src/core/exit-codes.ts` -- `toExitCode` signature + verdict-blind header (must map `evaluateResult`, not raw counts).
- `packages/angular-typechecker/src/core/evaluate-result.ts` -- `evaluateResult(result, {maxWarnings, strict}) -> {success, outcome}`; the ordered coverage-incomplete/warnings-exceeded verdict.
- `packages/angular-typechecker/src/core/render-report.ts` -- `renderReport(result, {pathBase, color, failFast})`; async, loads compiler-cli + ts (ESM bridge); `color:false` strips ANSI.
- `packages/angular-typechecker/src/core/emit-advisory-notices.ts` -- `emitAdvisoryNotices(result, logger)`; pure; uses info/warn only.
- `packages/angular-typechecker/src/core/logger.ts` -- `Logger {info,warn,error}`; `error` reserved for the CLI infra path.
- `packages/angular-typechecker/src/core/run-typecheck.ts` -- `CoreOptions`/`CoreResult`/`TypecheckInfrastructureError`; `Array.isArray(tsConfigPath)` routing; config-stage infra re-throw.
- `packages/angular-typechecker/src/index.ts` -- the barrel (confirms internal seams NOT exported).
- `packages/angular-typechecker/eslint.config.mjs` -- `src/core/**` purity block; NO `src/cli/**` ban yet (Phase 27).
- `packages/angular-typechecker/project.json` + `vitest.config.mts` + `vitest.integration.config.mts` -- test/integration targets (`dependsOn: build`), unit/integration include/exclude split.
- `packages/angular-typechecker/package.json` (`version 0.2.1`, `type commonjs`, `main ./src/index.js`) + `tsconfig.json` (`module: nodenext`).
- `packages/angular-typechecker/src/executors/typecheck/executor.spec.ts` -- the `vi.hoisted` + `vi.mock` stub pattern VER-01 mirrors.
- `packages/angular-typechecker/src/core/multi-tsconfig.integration.spec.ts` -- the real-fixture integration pattern VER-02 mirrors.
- `.github/workflows/ci.yml:106-111` -- the LEAN 6-cell OS x Node matrix.
- top-level `fixtures/` listing -- the committed real-compiler fixtures available for VER-02.

### Secondary (MEDIUM -- carried from milestone research, verified consistent with code)
- `.planning/research/v0.2.2-standalone-cli/{SUMMARY,ARCHITECTURE,FEATURES,PITFALLS}.md` -- the converged HIGH-confidence milestone research; Node `util.parseArgs` API; ESLint 0/1/2 exit-code prior art; `atc@0.0.6` registry hazard.
- `.planning/phases/26-pure-cli-core-exit-code-wiring/26-CONTEXT.md` -- the locked D-01..D-17 decisions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero deps; every builtin + core seam verified present and nx-free.
- Architecture: HIGH -- `run()` is a verified line-by-line mirror of the shipped `executor.ts`.
- Pitfalls: HIGH -- the exit-code compose and nx-boundary traps are in the code's own comments; the realpath ENOENT subtlety is a fresh but grounded finding.
- Validation: HIGH -- test tiers, matrix, and fixtures all verified against the actual config.

**Research date:** 2026-07-16
**Valid until:** 2026-08-15 (stable; the composed seams are shipped and frozen for this additive milestone).
