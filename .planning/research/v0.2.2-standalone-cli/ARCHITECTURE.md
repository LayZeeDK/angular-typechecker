# Architecture Research: Standalone CLI adapter (v0.2.2)

**Domain:** A third thin adapter (`bin`) over an existing framework-agnostic core + adapters architecture (Nx executor, Angular CLI builder).
**Researched:** 2026-07-16
**Confidence:** HIGH (grounded in the actual codebase seams; two MEDIUM items flagged for a build/OS assertion).

## Executive Answer

The CLI is a THIRD thin adapter that composes the SAME pure core the Nx executor and
the Angular CLI builder already compose:

```
runTypecheck(coreOptions)  ->  emit advisory notices  ->  renderReport(result)  ->  evaluateResult(result)  ->  verdict
```

Nothing in `core/` changes. One shared helper is EXTRACTED so the CLI can render the
five advisory notices without importing `@nx/devkit` (the 24-06 crash class). The bin
is nx-free by construction: its entire `require()` graph reaches only `core/**`, which
is already lint-guarded against `nx` / `@nx/*` / `@angular-devkit/*`.

The exit-code axis is split exactly as the existing code intends:
`toExitCode(error)` owns the literal `2` (infra) in the catch; `evaluateResult(result).success`
owns `0` vs `1` on a completed run. Both pure functions finally get a live consumer.

## Standard Architecture

### System Overview (where the CLI sits)

```
      +---------------------+   +----------------------+   +----------------------+
      |  Nx executor        |   |  Angular CLI builder |   |  Standalone CLI (NEW)|
      |  executors/typecheck|   |  builders/typecheck  |   |  cli/                |
      |  (imports @nx/devkit)|  |  (convertNxExecutor) |   |  (imports NO nx)     |
      +----------+----------+   +----------+-----------+   +----------+-----------+
                 |                         |                          |
                 |   injects @nx/devkit    | (is the executor)        |  injects console
                 |   logger                |                          |  logger (stderr)
                 v                         v                          v
      +-------------------------------------------------------------------------------+
      |                       core/emit-advisory-notices.ts (NEW, pure)               |
      |         emitAdvisoryNotices(result, logger: Logger)  -- injected logger        |
      +-------------------------------------------------------------------------------+
                 |                                                    |
                 +--------------------------+-------------------------+
                                            v
      +-------------------------------------------------------------------------------+
      |                        core/**  (framework-agnostic, UNCHANGED)               |
      |  runTypecheck -> CoreResult   renderReport(ng,ts injected)   evaluateResult    |
      |  toExitCode   compiler-loader (await import '@angular/compiler-cli')           |
      |  load-typescript (await import 'typescript')   filter/gather/format           |
      +-------------------------------------------------------------------------------+
```

### Component Responsibilities

| Component | Responsibility | New / Modified / Reused |
|-----------|----------------|-------------------------|
| `src/cli/bin.ts` | Shebang shim: `main(argv).then(write+exit).catch(exit 2)`. The ONLY tier that calls `process.exit` / writes streams. | NEW |
| `src/cli/main.ts` | Pure `run(argv, env?): Promise<{exitCode, stdout, stderr}>`. Parse -> resolve paths -> `runTypecheck` -> emit notices -> `renderReport` -> `evaluateResult` -> exit code. No `process.exit`, no stream writes. | NEW |
| `src/cli/parse-args.ts` | `util.parseArgs` wrapper -> typed `CliOptions \| {help} \| {version} \| {usageError}`. No runtime dep. | NEW |
| `src/cli/console-logger.ts` | A `Logger`-shaped adapter over `console.error` (all notices -> stderr). | NEW |
| `core/emit-advisory-notices.ts` | The five `warn*` helpers, moved out of `executor.ts`, taking an INJECTED `Logger`. Pure (no nx, no console, no process). | NEW (extract) |
| `executors/typecheck/executor.ts` | Now calls `emitAdvisoryNotices(result, logger)` instead of five inline `logger.warn` calls. | MODIFIED (internal, additive) |
| `packages/.../package.json` | Add `"bin": { "angular-typechecker": "./src/cli/bin.js", "atc": "./src/cli/bin.js" }`. | MODIFIED |
| `packages/.../eslint.config.mjs` | Add a `src/cli/**` block banning nx / `@nx/*` / `@angular-devkit/*` imports (import-ban ONLY; console/process ALLOWED). | MODIFIED |
| `runTypecheck` / `renderReport` / `evaluateResult` / `toExitCode` / `compiler-loader` | Reused verbatim. | REUSED (0 change) |

## Recommended Project Structure

```
packages/angular-typechecker/src/
|-- cli/                         # NEW -- the third adapter
|   |-- bin.ts                   # shebang + process.exit shell (thin, untested)
|   |-- main.ts                  # run(argv, env): {exitCode, stdout, stderr} (pure, unit-tested)
|   |-- parse-args.ts            # util.parseArgs -> CliOptions | help | version | usageError
|   |-- console-logger.ts        # Logger over console.error (stderr)
|   |-- main.spec.ts             # unit: run(...) returns codes+output, never exits
|   |-- parse-args.spec.ts       # unit: flag parsing, repeatable -p, usage errors
|   '-- bin-static.spec.ts       # static: built bin.js starts with '#!' AND never require()s nx/@nx/devkit
|-- core/
|   |-- emit-advisory-notices.ts # NEW -- shared, injected-logger notice renderer
|   |-- emit-advisory-notices.spec.ts
|   |-- run-typecheck.ts         # UNCHANGED
|   |-- render-report.ts         # UNCHANGED (already the shared render seam)
|   |-- evaluate-result.ts       # UNCHANGED
|   |-- exit-codes.ts            # UNCHANGED (toExitCode gets its first live consumer)
|   '-- ...
|-- executors/typecheck/
|   '-- executor.ts              # MODIFIED: warn* -> emitAdvisoryNotices(result, logger)
'-- builders/typecheck/          # UNCHANGED
```

### Structure Rationale

- **`cli/` is a sibling of `executors/` and `builders/`.** It mirrors the established
  adapter-per-folder convention. The `@nx/js:tsc` build already compiles `src/**/*.ts`
  (`tsconfig.lib.json` include, line 8), so `bin.ts` and friends are built with ZERO
  build-config change beyond the `bin` field. `files` already whitelists `src`
  (`package.json:40-48`), so the compiled `bin.js` ships automatically.
- **`emit-advisory-notices.ts` lives in `core/`, not `cli/`.** Precedent:
  `render-report.ts` already performs RENDERING inside `core/` via injected `ng`/`ts`
  (`render-report.ts:43-55`). A notice renderer taking an injected `Logger` is the
  same pattern and inherits the strict `core/**` lint that guarantees it stays nx-free
  -- which is exactly what makes it safe for the CLI to import.

## Architectural Patterns

### Pattern 1: The logger-injection seam (the answer to Q2)

**Finding first (correcting the question's premise):** the CORE does NOT currently take
an injected logger. `runTypecheck` is pure and returns structured advisory FIELDS
(`templateCheckAborted`, `skippedReferences`, `suppressedInGraph*`,
`notTypeCheckedDeclaredFiles`, `bundlerQueryImports` -- `run-typecheck.ts:83-139`). The
logging lives entirely in the ADAPTER: `executor.ts` renders those fields through five
private helpers (`warnTemplateCheckAborted` / `warnSkippedReferences` / `warnSuppressed`
/ `warnNotTypeChecked` / `warnBundlerQueryImports`, `executor.ts:88-264`) using
`@nx/devkit`'s `logger` (imported at `executor.ts:2`).

**Consequence:** the CLI cannot reuse those helpers as-is -- importing `executor.ts`
pulls `@nx/devkit`, which transitively loads the `ora -> log-symbols -> chalk` chain
that crashed under yarn 4 (the 24-06 lesson, and the whole reason for the nx-free
charter).

**What:** Extract the five helpers into `core/emit-advisory-notices.ts` behind a minimal
STRUCTURAL logger interface:

```typescript
// core/emit-advisory-notices.ts  (pure: no nx import, no console, no process)
export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export function emitAdvisoryNotices(result: CoreResult, logger: Logger): void {
  warnTemplateCheckAborted(result, logger);
  warnSkippedReferences(result, logger);
  warnSuppressed(result, logger);       // logger.info for third-party, logger.warn for in-graph
  warnNotTypeChecked(result, logger);
  warnBundlerQueryImports(result, logger);
}
```

`@nx/devkit`'s `logger` already satisfies `Logger` structurally (it has `.info/.warn/.error`),
so the executor change is a one-line swap:

```typescript
// executor.ts, replacing the five inline calls (executor.ts:53-57)
emitAdvisoryNotices(result, logger);
```

The CLI injects a console adapter that routes EVERYTHING to stderr (stdout is reserved
for the machine-readable report):

```typescript
// cli/console-logger.ts
export const consoleLogger: Logger = {
  info: (m) => process.stderr.write(m + '\n'),
  warn: (m) => process.stderr.write(m + '\n'),
  error: (m) => process.stderr.write(m + '\n'),
};
```

**Trade-offs:** The extract touches `executor.ts` (internal only -- no public API change,
so it honors the additive charter) and dedupes the correctness-bearing message strings
(they explain the coverage-incomplete verdict, this project's core safety property).
**Lazier alternative:** the CLI writes its own five `console.error` notice functions and
leaves `executor.ts` untouched -- ~40 lines, but the two copies can drift, and a drifted
coverage-incomplete message is exactly the "silent-ish" degradation the milestone charter
forbids. Recommend the shared seam.

### Pattern 2: Pure `run()` + thin `bin` shell (the answer to Q5)

**What:** All logic lives in a pure `run(argv, env?)` that RETURNS the exit code and the
captured output; the bin does the impure part (write + exit + top-level catch).

```typescript
// cli/main.ts  (pure -- never calls process.exit, never writes a stream)
export interface CliRunResult {
  exitCode: 0 | 1 | 2;
  stdout: string;   // the report codeframes, OR help/version text
  stderr: string;   // advisory notices + error messages
}

export async function run(
  argv: string[],
  env: { cwd?: string; isTTY?: boolean } = {},
): Promise<CliRunResult> {
  const cwd = env.cwd ?? process.cwd();
  const color = env.isTTY ?? process.stdout.isTTY === true;
  // ... parse, resolve, runTypecheck, notices (into a buffering Logger), renderReport, evaluateResult
}
```

```typescript
// cli/bin.ts  (the ONLY tier that touches process.exit / streams)
#!/usr/bin/env node
import { run } from './main';

run(process.argv.slice(2))
  .then(({ exitCode, stdout, stderr }) => {
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    process.exit(exitCode);
  })
  .catch((error) => {
    // Unknown crash == infrastructure-class for a type-checker: never 0/1.
    process.stderr.write(String(error?.stack ?? error) + '\n');
    process.exit(2);
  });
```

**Why `env` is injected with defaults:** `process.stdout.isTTY` and `process.cwd()` are
the only process reads; injecting them (defaulted) keeps `run` deterministic under test
(`run(argv, { cwd: fixtureDir, isTTY: false })`) while the bin calls `run(argv)` with the
real process values. Notices are collected into a buffering `Logger` inside `run` so the
returned `stderr` is fully captured -- unit tests assert `{exitCode, stdout, stderr}` with
NO process.exit and NO stream monkey-patching.

**Trade-offs:** `bin.ts` stays untested by unit tests (it is a 10-line shell); its behavior
is covered by the installed-tarball e2e instead. This is the same tested-boundary split the
executor uses (`executor.ts` unit + `*-e2e` tarball).

### Pattern 3: Exit-code reconciliation -- toExitCode owns 2, evaluateResult owns 0/1

**What:** The completed-run 0-vs-1 decision comes from `evaluateResult`, NOT `toExitCode`.
`toExitCode` alone would read a `coverage-incomplete` run (errorCount 0, success false) as
`0` -- the exact fork `exit-codes.ts:37-43` warns about. So:

```typescript
try {
  const result = await runTypecheck(coreOptions);
  emitAdvisoryNotices(result, bufferingLogger);
  const report = await renderReport(result, { pathBase: cwd, color, failFast });
  const { success } = evaluateResult(result, { maxWarnings, strict });
  return { exitCode: success ? 0 : 1, stdout: report, stderr: bufferingLogger.text };
} catch (error) {
  if (error instanceof TypecheckInfrastructureError) {
    bufferingLogger.error('angular-typechecker: the Angular compiler failed to run ...');
    return { exitCode: toExitCode(error), stdout: '', stderr: bufferingLogger.text }; // -> 2
  }
  throw error; // -> bin top-level catch -> exit 2 + printed stack
}
```

- `exit 2` = infra: `toExitCode(TypecheckInfrastructureError)` (`exit-codes.ts:48-50`) OR
  an unknown re-thrown crash caught by the bin shell. This is the COR-04 promise finally
  fulfilled -- the CLI is the first live consumer of `toExitCode` (`exit-codes.ts:17-20`).
- `exit 1` = any completed non-clean verdict: `type-error` OR `coverage-incomplete` OR
  `warnings-exceeded` (`evaluate-result.ts:116-181` maps all three to `success:false`).
- `exit 0` = clean.

**Why re-throw unknowns:** mirrors the executor's discipline (`executor.ts:84`) -- "a
type-checker that silently swallows an unknown failure and reports success is worse than
none." The bin's top-level `.catch` is the last-resort infra guard.

## Data Flow

### CLI request flow

```
argv (process.argv.slice(2))
   |
   v
parse-args.ts (util.parseArgs)  -->  --help/--version? -> {exitCode:0, stdout:text}
   |                            -->  unknown flag / no -p -> {exitCode:2, stderr:usage}
   v
resolve -p entries against cwd  (node:path resolve, POSIX-normalized)
   |    single -p  -> string        (hits direct / solution-WALK path)
   |    2+  -p      -> string[]      (hits handleMultiTsConfig union)
   v
runTypecheck(coreOptions)  ---(await import '@angular/compiler-cli' + 'typescript' inside core)---> CoreResult
   |
   +--> emitAdvisoryNotices(result, bufferingLogger)   -> stderr buffer
   +--> renderReport(result, {pathBase:cwd, color, failFast}) -> stdout string
   +--> evaluateResult(result, {maxWarnings, strict})  -> {success}
   v
{ exitCode: success ? 0 : 1, stdout, stderr }
   |
   v
bin.ts writes stdout+stderr, process.exit(exitCode)
```

### The CJS -> ESM bridge from a bin (the answer to Q3)

The bridge is ALREADY solved inside `core/` and requires NOTHING new from the bin:

- `compiler-loader.ts:16-19` does `await import('@angular/compiler-cli')`; `load-typescript.ts`
  does `await import('typescript')`. Both are reached transitively by `runTypecheck` and
  `renderReport`.
- The package is `type: commonjs` built `module: nodenext` (`tsconfig.json:4-5`,
  `package.json:26`), so `tsc` preserves the dynamic `import()` as a native ESM load
  instead of downleveling it to `require()` -- the GATE A invariant, already asserted for
  the executor/builder (`gate-a-static.spec.ts`).
- The bin's ONLY obligation is an async entrypoint + a top-level `.then/.catch`. It must
  NOT use top-level `await` -- a CJS module (`type: commonjs`) forbids it; that is why the
  shell uses `run(...).then(...).catch(...)`. The `await import()` lives INSIDE `run`'s
  async body, which is legal in emitted CJS under nodenext.

### tsconfig resolution from an arbitrary CWD (the answer to Q4)

The core requires an ABSOLUTE `tsConfigPath` and never touches `process.cwd()`
(`run-typecheck.ts:326-327`, D-04). The executor resolves relatives against the
WORKSPACE root via `@nx/devkit`'s `joinPathFragments` (`normalize-options.ts:53-58`). The
CLI has no workspace root and cannot import `joinPathFragments` (nx-free), so it resolves
against `process.cwd()` with `node:path`:

```typescript
import { isAbsolute, resolve } from 'node:path';

// nx-free equivalent of joinPathFragments: resolve against cwd, normalize to POSIX
// separators (TypeScript's readConfiguration + the boundary filter's realpath compare
// use forward slashes; matching the executor's joinPathFragments behavior avoids a
// mixed-separator mismatch on Windows).
const toAbsolute = (p: string): string =>
  (isAbsolute(p) ? p : resolve(cwd, p)).replace(/\\/g, '/');
```

Set `pathBase: cwd` on `renderReport` so CI annotation paths are cwd-relative, mirroring
the executor's `pathBase: context.root` (`normalize-options.ts:64`).

## Integration Points

### Internal boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `cli/main.ts` -> `core/run-typecheck` | direct import | pure; returns `CoreResult` |
| `cli/main.ts` -> `core/render-report` | direct import | the documented shared render seam (`render-report.ts:24-27` explicitly names "the CLI ... later") |
| `cli/main.ts` -> `core/evaluate-result` | direct import | owns the 0/1 verdict |
| `cli/main.ts` -> `core/exit-codes` | direct import | `toExitCode(error)` owns the infra `2` |
| `cli/main.ts` -> `core/emit-advisory-notices` | direct import + injected `consoleLogger` | the new nx-free notice seam |
| `executor.ts` -> `core/emit-advisory-notices` | direct import + injected `@nx/devkit` logger | proves the seam serves both adapters |
| bin `require()` graph | must reach ONLY `core/**` | lint-enforced (core ban) + new `bin-static.spec.ts` assertion |

### package.json bin field

```json
"bin": {
  "angular-typechecker": "./src/cli/bin.js",
  "atc": "./src/cli/bin.js"
}
```

Both names point at ONE compiled `bin.js` (`atc` collision risk is nil -- a local `bin`,
not a package name, per PROJECT.md). npm sets the exec bit on `bin` targets at install and
generates the Windows `.cmd`/`.ps1` shims from this field, so the shebang + Windows launch
are handled by the packaging, not by us -- verified by the tarball e2e.

## Anti-Patterns

### Anti-Pattern 1: Re-implementing the type-check in the CLI
**What people do:** shell out to `ngc` or re-parse tsconfig in the bin.
**Why it's wrong:** violates the thin-adapter charter and would lose the complete
diagnostic set (template + NG8xxx) the core produces.
**Instead:** compose `runTypecheck` verbatim, exactly like the executor and builder.

### Anti-Pattern 2: `toExitCode(result)` as the sole exit-code source
**What people do:** `process.exit(toExitCode(result))` on the completed run.
**Why it's wrong:** `toExitCode` only knows `errorCount` -- a `coverage-incomplete` run
(errorCount 0, success false) would exit `0`, a silent false pass. `exit-codes.ts:37-43`
warns about this by name.
**Instead:** `evaluateResult(result).success ? 0 : 1` for completed runs; `toExitCode`
only in the infra catch.

### Anti-Pattern 3: Importing anything nx into `cli/`
**What people do:** grab `joinPathFragments` / `logger` from `@nx/devkit` for convenience.
**Why it's wrong:** re-introduces the yarn-4 chalk-chain crash (24-06) and defeats the
lean-startup goal.
**Instead:** `node:path` for resolution, injected `consoleLogger` for notices, and a
lint block on `src/cli/**` that bans nx / `@nx/*` / `@angular-devkit/*` imports.

### Anti-Pattern 4: Passing a single `-p` as a 1-element array
**What people do:** always hand `coreOptions.tsConfigPath` a `string[]`.
**Why it's wrong:** `handleMultiTsConfig` treats each entry as a LEAF and does NOT walk
references (`run-typecheck.ts:635-730`), so a single `-p tsconfig.json` (a solution
config) would be recorded as a zero-root-names skip -> coverage-incomplete instead of
being WALKED.
**Instead:** mirror `normalize-options.ts:56-58` -- ONE `-p` -> `string` (direct/WALK
path), TWO+ -> `string[]` (union path).

## Suggested Build Order

1. **Extract the notice seam first (de-risk).** Create `core/emit-advisory-notices.ts`
   (move the five `warn*` from `executor.ts`, add the `Logger` param), swap `executor.ts`
   to `emitAdvisoryNotices(result, logger)`. All existing executor/builder tests stay
   green -> proves the seam serves the nx adapter unchanged. MODIFIED: `executor.ts`;
   NEW: `emit-advisory-notices.ts` + spec.
2. **Pure CLI core.** `parse-args.ts` + `main.ts` (`run(argv, env)`) + `console-logger.ts`.
   Wire `toExitCode` (infra catch) + `evaluateResult` (0/1). Unit-test `run` against
   committed fixtures asserting `{exitCode, stdout, stderr}` with no process side effects.
3. **Bin shell + packaging.** `bin.ts` (shebang + `.then/.catch`), `package.json` `bin`
   (two names), `eslint.config.mjs` `src/cli/**` import-ban block, and `bin-static.spec.ts`
   (built `bin.js` starts with `#!` AND never `require()`s `nx`/`@nx/devkit` -- model on
   `gate-a-static.spec.ts`).
4. **e2e.** Installed-tarball, plain non-Nx project: assert 0/1/2 exit codes + output;
   assert the shebang launches on Windows/macOS/Linux. Then real Nx + real Angular CLI
   OSS Angular 22 workspaces pointed at real tsconfigs (planted-error RED / clean GREEN).
5. **Docs.** README `## Standalone CLI` + the exit-code contract table; curated CHANGELOG.

## Module-Boundary Lint Confirmation

- The `core/**` rule (`eslint.config.mjs:16-64`) is UNTOUCHED. `emit-advisory-notices.ts`
  lives under `core/` and PASSES it: it imports no nx (takes an injected `Logger`), uses no
  `console`, and never calls `process.exit` (the injected logger does the writing, in the
  adapter's console adapter which lives OUTSIDE core).
- The CLI lives in `src/cli/**` -- outside `core/**`, so the core bans do not apply to it.
  Recommended NEW lint block: ban `nx` / `@nx/*` / `@angular-devkit/*` imports in
  `src/cli/**` (import-ban ONLY; `console` + `process.exit` are ALLOWED there -- the CLI is
  an adapter that owns I/O and exit). This lint-enforces the nx-free boundary the whole
  milestone depends on.
- `@nx/dependency-checks` (`eslint.config.mjs:66-116`): the bin adds no new runtime import,
  so no manifest change beyond the `bin` field. `util`/`node:path`/`node:module` are Node
  builtins (not flagged).

## Open Questions / Verify During Build

1. **Shebang preservation through `@nx/js:tsc`.** TypeScript preserves a leading `#!` line
   in emitted JS, but this is load-bearing for the POSIX launch. MEDIUM -- assert it in
   `bin-static.spec.ts` against the BUILT `dist/.../src/cli/bin.js`, not just the source.
2. **Windows path-separator round-trip.** `node:path.resolve` yields backslashes on Windows;
   the recommended `.replace(/\\/g, '/')` matches the executor's `joinPathFragments` POSIX
   output, but the boundary filter's realpath compare (`filter-diagnostics.ts`) should be
   exercised on Windows with a relative `-p` to confirm no mixed-separator mismatch. MEDIUM
   -- covered by running the e2e on the Windows CI cell.
3. **`--max-warnings` parsing.** `util.parseArgs` yields strings only; convert to a
   non-negative integer. `evaluateResult` already treats NaN/negative as unset defensively
   (`evaluate-result.ts:143-147`), so pass-through is SAFE, but an explicit usage error
   (exit 2) on a non-integer is better UX. LOW -- a naming/validation decision, not a
   structural risk.
4. **Version string source.** `--version` should read `require('../../package.json').version`
   (CJS require of JSON works in the emitted bin; the published layout keeps `package.json`
   two dirs above `src/cli/`). LOW.

## Sources

- `packages/angular-typechecker/src/core/run-typecheck.ts` (CoreOptions/CoreResult, ENG-01
  array vs string routing, D-04 absolute-path/no-cwd contract) -- HIGH
- `packages/angular-typechecker/src/core/exit-codes.ts` (toExitCode; the explicit
  "CLI must map evaluateResult, not re-compute" note, lines 17-43) -- HIGH
- `packages/angular-typechecker/src/core/evaluate-result.ts` (the 0/1 verdict + Outcome) -- HIGH
- `packages/angular-typechecker/src/core/render-report.ts` (the shared render seam; names
  "the CLI ... later") -- HIGH
- `packages/angular-typechecker/src/executors/typecheck/executor.ts` (the five `warn*`
  helpers + `@nx/devkit` logger; the re-throw-unknowns discipline) -- HIGH
- `packages/angular-typechecker/src/executors/typecheck/normalize-options.ts` (path
  resolution + single-vs-array + TTY color) -- HIGH
- `packages/angular-typechecker/src/core/compiler-loader.ts` + `load-typescript.ts`
  (the CJS->ESM bridge) -- HIGH
- `packages/angular-typechecker/src/schematics/ng-add/schematic.ts` (precedent for a
  vanilla nx-free adapter over the shared core, 24-06 fix) -- HIGH
- `packages/angular-typechecker/eslint.config.mjs` (core/** module-boundary rule) -- HIGH
- `packages/angular-typechecker/package.json` + `project.json` + `tsconfig.json`/`tsconfig.lib.json`
  (build compiles `src/**`, `type: commonjs` + `module: nodenext`, `files` whitelist) -- HIGH
- `.planning/PROJECT.md` (v0.2.2 charter, two bin names, nx-free requirement, exit-code goal) -- HIGH

---
*Architecture research for: standalone CLI adapter over the angular-typechecker core+adapters split*
*Researched: 2026-07-16*
