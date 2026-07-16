# Phase 26: Pure CLI core + exit-code wiring - Pattern Map

**Mapped:** 2026-07-16
**Files analyzed:** 6 net-new (3 source + 3 spec)
**Analogs found:** 6 / 6 (every new file has a strong in-repo analog)

All new files live under `packages/angular-typechecker/src/cli/` (NEW dir, sibling of
`executors/` and `builders/`). `@nx/js:tsc` already globs `src/**/*.ts`, so the dir
builds with zero build-config change. Phase 26 respects the nx-free `src/cli/**` import
boundary BY CONSTRUCTION (the enforcing ESLint ban + module-graph guard land in Phase 27).

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/cli/parse-args.ts` | utility (arg parser + validator + usage-error mapper) | transform (argv -> `CliOptions \| help \| version \| usageError`) | `src/executors/typecheck/normalize-options.ts` (pure typed knob-split) + `util.parseArgs` config from RESEARCH Code Examples | role-match |
| `src/cli/main.ts` | adapter / controller (`run()` core) | request-response (argv+env -> `{ exitCode, stdout, stderr }`) | `src/executors/typecheck/executor.ts` | exact (same core, adapter swap) |
| `src/cli/console-logger.ts` | utility / provider (`BufferingLogger`) | event-driven (accumulate info/warn/error into an array) | `src/core/logger.ts` (the interface it implements) + the `mockLogger()` shape in `emit-advisory-notices.spec.ts` | role-match |
| `src/cli/parse-args.spec.ts` | test (unit, pure) | -- | `src/core/emit-advisory-notices.spec.ts` (pure fn, direct call, NO `vi.mock`) | role-match |
| `src/cli/main.spec.ts` | test (unit, STUBBED core) | -- | `src/executors/typecheck/executor.spec.ts` (`vi.hoisted` + `vi.mock` + `importOriginal`) | exact |
| `src/cli/main.integration.spec.ts` | test (integration, real cold compiler) | -- | `src/core/run-typecheck.integration.spec.ts` (`findWorkspaceRoot` + `fixtures/` + real `runTypecheck`) | exact |

## Pattern Assignments

### `src/cli/main.ts` (adapter, request-response) -- THE load-bearing file

**Analog:** `packages/angular-typechecker/src/executors/typecheck/executor.ts` (exact mirror; swap logger sink, path resolver, return type).

**Compose order to copy VERBATIM** (`executor.ts:44-81`):
```typescript
const { coreOptions, maxWarnings, failFast, color, strict } =
  normalizeOptions(options, context);            // CLI: parse-args + nx-free path resolve
try {
  const result = await runTypecheck(coreOptions);
  emitAdvisoryNotices(result, logger);           // CLI: inject BufferingLogger; notices BEFORE report
  const report = await renderReport(result, {
    pathBase: coreOptions.pathBase, color, failFast,
  });
  process.stdout.write(report);                  // CLI: return this string as stdout, DO NOT write
  const { success } = evaluateResult(result, { maxWarnings, strict });
  return { success };                            // CLI: return { exitCode: success ? 0 : 1, ... }
} catch (error) {
  if (error instanceof TypecheckInfrastructureError) {
    logger.error(`angular-typechecker: the Angular compiler failed to run ...`); // executor.ts:73-75
    return { success: false };                   // CLI: return { exitCode: toExitCode(error), ... } = 2
  }
  throw error;                                    // re-throw unknowns (bin.ts catch, Phase 27)
}
```

**Imports pattern to copy** (`executor.ts:4-10` -- RELATIVE core imports, NEVER the barrel):
```typescript
import { emitAdvisoryNotices } from '../../core/emit-advisory-notices';
import { evaluateResult } from '../../core/evaluate-result';
import { renderReport } from '../../core/render-report';
import { runTypecheck, TypecheckInfrastructureError } from '../../core/run-typecheck';
// CLI adds: import { toExitCode } from '../../core/exit-codes';
//           import { BufferingLogger } from './console-logger';
// From src/cli/ the depth is ONE level (`../core/...`), not two (executor.ts is `../../core/...`).
```
The `@nx/devkit` `import { logger }` (`executor.ts:2`) is REMOVED. The infra `logger.error`
message text at `executor.ts:73-75` is the exact string to reuse (locked verbatim by
`executor.spec.ts:570-572` which asserts `'infrastructure error'`).

**Two-step exit-code compose (D-01 / EXIT-01 -- the milestone's whole reason):**
Grounded in `exit-codes.ts:45-57` (`toExitCode` is verdict-BLIND by design; its header at
`exit-codes.ts:38-43` says "map `evaluateResult(...)`'s `success`/`outcome` to an exit code,
NOT re-compute the verdict here") + `evaluate-result.ts:116-181` (owns the 0-vs-1 verdict,
including `coverage-incomplete`/`warnings-exceeded` which have `errorCount === 0` but
`success === false`, see `evaluate-result.ts:120-178`).
- infra catch -> `toExitCode(error)` = `2` (pass ONLY the caught error, never the result).
- usage error -> `2` DIRECTLY (before the core runs), never via `toExitCode`.
- completed run -> `evaluateResult(result, { maxWarnings, strict }).success ? 0 : 1`.

**Path resolution (nx-free equivalent of `normalize-options.ts:53-58`):**
The executor does `isAbsolute(path) ? path : joinPathFragments(context.root, path)`
(`normalize-options.ts:53-54`) then `Array.isArray(...) ? map(resolveOne) : resolveOne(...)`
(`normalize-options.ts:56-58`). The CLI replaces `joinPathFragments(context.root, ...)` with
`node:path` `resolve(process.cwd(), p)` + `.replace(/\\/g, '/')` + a try/catch-guarded
`fs.realpathSync.native` (D-06). GUARD IS LOAD-BEARING: `realpathSync.native` throws `ENOENT`
on a nonexistent path; on failure fall through to the plain resolved absolute path so the
core throws the canonical `TypecheckInfrastructureError` -> caught -> exit 2 (RESEARCH Open
Question 1 / Pitfall 2). `pathBase = process.cwd()` (D-07). `color = process.stdout.isTTY`
in the executor (`normalize-options.ts:68`); the CLI derives it from `env` first (D-09).

**Single-vs-array collapse (ARGS-03 / D-13), mirror `normalize-options.ts:56-58`:**
`parseArgs` `multiple: true` ALWAYS yields `string[]`. Collapse length-1 to the STRING before
building `CoreOptions` (a solution config passed as a 1-element array hits the multi-leaf path
and skips solution-walk). `runTypecheck` routes on `Array.isArray(options.tsConfigPath)`
(`run-typecheck.ts:348`). `CoreOptions.tsConfigPath` is `string | string[]` (`run-typecheck.ts:33`).

---

### `src/cli/parse-args.ts` (utility, transform)

**Analog:** `normalize-options.ts` for the pure-typed-mapping SHAPE (a pure function, no I/O,
returns a typed struct that splits knobs by consumer: `coreOptions` / verdict knobs / reporter
knobs -- see `normalize-options.ts:20-26` `NormalizedOptions` + `44-71` body). The CLI's
`CliOptions` result mirrors that split. The `parseArgs` config itself is net-new from RESEARCH.

**parseArgs config** (RESEARCH Code Examples, D-12 -- `-c` short, NOT `-p`):
```typescript
import { parseArgs } from 'node:util';
const { values } = parseArgs({
  args: argv, strict: true, allowPositionals: false,
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

**Usage-error mapping (D-14):** wrap `parseArgs` in try/catch (`strict: true` throws
`ERR_PARSE_ARGS_*` on unknown flag / missing value) -> usage error. Missing required
`--tsConfig` and non-integer `--max-warnings` checked explicitly -> usage error. All -> the
`run()` two-step returns exit `2`.

**--max-warnings validation (D-08):** `Number(raw)`; reject `!Number.isInteger(n) || n < 0`
as a usage error. `--max-warnings 0` stays valid. (Defense-in-depth: `evaluate-result.ts:143-147`
already treats negative/NaN defensively as unset, but D-08 rejects at the boundary for a clear msg.)

**--help / --version (D-10 / D-11):** `--version` = `require('../../package.json').version`
(CJS JSON require under `module: nodenext`; compiled `src/cli/main.js` -> `../../package.json`
is two dirs up, VERIFIED `main: ./src/index.js` in package.json). `--help` synopsis MUST say
`npx angular-typechecker`, NEVER `npx atc` (supply-chain hazard, D-11). Both print to stdout,
exit 0.

---

### `src/cli/console-logger.ts` (utility / provider, event-driven)

**Analog:** `src/core/logger.ts:19-23` (the `Logger` interface to implement) + the
`mockLogger()` object-of-spies shape in `emit-advisory-notices.spec.ts:11-13`.

**Interface to implement** (`logger.ts:19-23`):
```typescript
export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void; // reserved for the CLI infra path (Phase 26); no advisory uses it
}
```

**BufferingLogger shape** (RESEARCH Pattern 3 / D-04 -- all three methods route to ONE buffer;
everything except the report is stderr):
```typescript
export class BufferingLogger implements Logger {
  private readonly lines: string[] = [];
  info(m: string): void { this.lines.push(m); }
  warn(m: string): void { this.lines.push(m); }
  error(m: string): void { this.lines.push(m); }
  get text(): string { return this.lines.join('\n'); }
}
```
`emitAdvisoryNotices` uses only `info`/`warn` (VERIFIED `emit-advisory-notices.spec.ts:33-254`);
`error` is the CLI infra path (`logger.ts:22`). Internal class/getter names are Claude's
discretion (D-04). No separate spec needed (RESEARCH Open Question 2) -- fold assertions into
`main.spec.ts` unless the class grows.

---

### `src/cli/main.spec.ts` (test, unit, STUBBED core)

**Analog:** `packages/angular-typechecker/src/executors/typecheck/executor.spec.ts` (exact).

**Hoisted-mock + real-error pattern to copy** (`executor.spec.ts:10-42`):
```typescript
const mocks = vi.hoisted(() => ({
  runTypecheck: vi.fn(),
  renderReport: vi.fn(async () => 'RENDERED REPORT'),
  evaluateResult: vi.fn(),
  // ...
}));
// Keep the REAL TypecheckInfrastructureError so `instanceof` works; only stub runTypecheck:
vi.mock('../../core/run-typecheck', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/run-typecheck')>();
  return { ...actual, runTypecheck: mocks.runTypecheck };
});
vi.mock('../../core/render-report', () => ({ renderReport: mocks.renderReport }));
vi.mock('../../core/evaluate-result', () => ({ evaluateResult: mocks.evaluateResult }));
```
CLI adjustments: paths are `../../core/...` from `src/cli/` (same depth as the executor from
`src/executors/typecheck/`). Do NOT `vi.mock('@nx/devkit')` (`executor.spec.ts:56-65`) -- the
CLI has no `@nx/devkit` import; inject a real `BufferingLogger` and assert on its `.text`
instead. `evaluateResult` MUST return `{ success, outcome }` (see `evaluate-result.ts:119`),
so stubs return e.g. `{ success: false, outcome: 'coverage-incomplete' }`.

**Infra-catch assertion to copy** (`executor.spec.ts:555-573`):
```typescript
mocks.runTypecheck.mockRejectedValue(new TypecheckInfrastructureError('...'));
// CLI: expect(result.exitCode).toBe(2); expect(result.stderr).toContain('infrastructure error');
```

**Exit-code branch matrix (D-16, the subtlest new logic):** one test per branch with a stubbed
`evaluateResult` -- clean `{success:true}` -> 0; type-error `{success:false, outcome:'type-error'}`
-> 1; **coverage-incomplete AND warnings-exceeded (`errorCount:0`, `{success:false}`) -> 1** (the
anti-false-pass); infra reject -> 2; usage -> 2. Plus routing (report->stdout, notices/errors->
stderr), purity (spy asserts NO `process.stdout.write` / `process.exit` -- contrast with
`executor.spec.ts:200-212` which asserts the executor DOES write), and the `--version` drift-lock.

---

### `src/cli/parse-args.spec.ts` (test, unit, pure)

**Analog:** `src/core/emit-advisory-notices.spec.ts` (a pure function tested by direct call with
NO `vi.mock` -- `emit-advisory-notices.spec.ts:1-13`). `parse-args` is pure (argv in, typed
result out), so it needs no core stubs. Cover ARGS-01..05: `-c`/`--tsConfig` maps + repeatable;
`-p`/`--project` unregistered (unknown-flag -> usage 2); single `-c` -> string, two `-c` ->
`string[]`; unknown flag / missing `-c` value / missing required `--tsConfig` / non-integer
`--max-warnings` -> usage error; `--help`/`--version` short-circuits; color env precedence.

---

### `src/cli/main.integration.spec.ts` (test, integration, real cold compiler)

**Analog:** `src/core/run-typecheck.integration.spec.ts` (exact fixture-driven real-compiler
pattern). Any `*.integration.spec.ts` under `src/core/` shares it; this one is representative.

**Workspace-root + fixture reference pattern to copy** (`run-typecheck.integration.spec.ts:1-27`):
```typescript
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

const workspaceRoot = findWorkspaceRoot(dirname(fileURLToPath(import.meta.url)));
const fixtureDir = join(workspaceRoot, 'fixtures', 'gate-b-error');
const appTsConfig = join(fixtureDir, 'tsconfig.app.json');
```
The CLI integration spec calls `run(argv)` in-process (NO spawn, NO tarball). Because `run()`
resolves relative `--tsConfig` against `process.cwd()` (D-05), pass ABSOLUTE fixture tsconfig
paths built via `join(workspaceRoot, 'fixtures', ...)` (matching this analog), OR override cwd
for the PKG-03 Windows-cell relative-path case. Note the CoreResult `fileName` normalization
helper at `run-typecheck.integration.spec.ts:56-67` (`.replace(/\\/g, '/')`) is the same
POSIX-separator discipline `run()` applies to resolved tsconfig paths (D-06).

**Fixtures available for VER-02** (top-level `fixtures/`, VERIFIED present):

| VER-02 case | Fixture |
|-------------|---------|
| clean -> 0 | `fixtures/ts-baseline` (clean TS leaf) or `fixtures/not-type-checked-clean` |
| planted TS error -> 1 | `fixtures/gate-b-error/tsconfig.app.json` (carries TS2322) or `fixtures/ng-baseline` |
| template / NG8xxx error -> 1 | `fixtures/gate-b-error` (NG8109) + an `fixtures/extended-*` (NG8xxx) |
| real coverage-incomplete -> 1 | `fixtures/solution-style-empty` (zero-root-names) |
| `--max-warnings 0` / `--strict` -> 1 | an NG8xxx-warning `fixtures/extended-*` |
| multi-`--tsConfig` union | `fixtures/multi-tsconfig-array` (`tsconfig.app.json` + `tsconfig.spec.json`) |
| single-`--tsConfig` solution-walk | `fixtures/solution-style` (has `tsconfig.json` solution + leaves) |
| malformed tsconfig -> 2 | `fixtures/config-broken/tsconfig.malformed.json` (VERIFIED present) |
| nonexistent tsconfig -> 2 | reference a path that does NOT exist (e.g. `fixtures/config-broken/tsconfig.does-not-exist.json`) -- **no fixture file to create; nonexistence IS the case** (exercises the D-06 realpath guard / Open Question 1) |

**Discrepancy to flag for the planner:** RESEARCH.md and 26-CONTEXT.md reference
`fixtures/config-broken/tsconfig.does-not-exist.json` "present", but the directory contains only
`tsconfig.malformed.json` + `tsconfig.spec.json` (VERIFIED `ls`). This is harmless -- the
nonexistent-path case needs a path that resolves to nothing, so no fixture file is required;
just point `--tsConfig` at any absent path.

## Shared Patterns

### Compose order (advisory notices BEFORE the report)
**Source:** `executor.ts:47-70`
**Apply to:** `main.ts` `run()`
`emitAdvisoryNotices(result, logger)` fires BEFORE `renderReport` so notices are not lost below
a long codeframe dump (`executor.ts:50-53`). Preserve exactly.

### Two-step exit-code compose (never `toExitCode` over counts)
**Source:** `exit-codes.ts:45-57` (verdict-blind) + `evaluate-result.ts:116-181` (owns 0/1)
**Apply to:** `main.ts` (the whole reason for the milestone)
`toExitCode` ONLY in the infra catch; usage -> 2 direct; 0/1 from `evaluateResult().success`.
Passing a completed result to `toExitCode` re-introduces the silent-false-pass fork.

### RELATIVE core imports, never the barrel or nx
**Source:** `executor.ts:4-10` (relative `../../core/...`) contrasted with `index.ts` (barrel
omits `evaluateResult`/`toExitCode`/`renderReport`/`emitAdvisoryNotices`/`Logger`)
**Apply to:** all of `src/cli/**`
Import `runTypecheck`/`TypecheckInfrastructureError`/`evaluateResult`/`toExitCode`/`renderReport`/
`emitAdvisoryNotices`/`Logger` module-to-module by relative path. NEVER `@nx/devkit`/`nx`, NEVER
`../executors/*` / `../builders/*`, NEVER `../index`. (Enforcing ESLint ban + `bin-static.spec.ts`
graph guard are Phase 27; Phase 26 respects by construction.)

### Logger injection seam
**Source:** `logger.ts:19-23` + `emit-advisory-notices.spec.ts:11-13`
**Apply to:** `console-logger.ts` + wherever `main.ts` injects it into `emitAdvisoryNotices`
The seam is INJECTED (no `vi.mock`); a plain object/class of the three methods `satisfies Logger`.

### Unit stub pattern (keep the real error class)
**Source:** `executor.spec.ts:10-54`
**Apply to:** `main.spec.ts`
`vi.hoisted` handles + `vi.mock('../../core/run-typecheck', importOriginal)` to keep the REAL
`TypecheckInfrastructureError` for the `instanceof` catch; stub `renderReport`/`evaluateResult`.

### Integration fixture pattern
**Source:** `run-typecheck.integration.spec.ts:1-27` (+ `56-67` path-normalization helper)
**Apply to:** `main.integration.spec.ts`
`findWorkspaceRoot(dirname(fileURLToPath(import.meta.url)))` + `join(workspaceRoot, 'fixtures', ...)`.
File name `*.integration.spec.ts` routes it to the `integration` target (`vitest.integration.config.mts`),
NOT the unit `test` target. Both `dependsOn: build`.

### ASCII-only output + JS/TS style (project rule)
**Source:** `AGENTS.md` / `CLAUDE.md`
**Apply to:** all source + specs + `--help`/usage strings
ASCII only (no em/en dashes, curly quotes, box-drawing). Blank lines around control-flow/returns;
always brace control-flow bodies. Prettier `singleQuote: true`.

## No Analog Found

None. Every new file has a strong in-repo analog. The only NET-NEW mechanics with no direct
codebase precedent are stdlib-driven and fully specified by RESEARCH Code Examples:
- `util.parseArgs` config + strict try/catch (RESEARCH Code Examples; D-12/D-14).
- `colorFromEnv` env precedence (RESEARCH Code Examples; D-09) -- the executor uses only the
  bare `process.stdout.isTTY` read (`normalize-options.ts:68`); the env branches are net-new.
- try/catch-guarded `fs.realpathSync.native` normalization (RESEARCH Open Question 1 / Pitfall 2).

## Metadata

**Analog search scope:** `packages/angular-typechecker/src/executors/typecheck/`,
`packages/angular-typechecker/src/core/`, top-level `fixtures/`.
**Files read:** executor.ts, normalize-options.ts, logger.ts, exit-codes.ts, evaluate-result.ts,
run-typecheck.ts (CoreOptions + array routing), executor.spec.ts, emit-advisory-notices.spec.ts,
run-typecheck.integration.spec.ts; fixture directory listings.
**Pattern extraction date:** 2026-07-16
