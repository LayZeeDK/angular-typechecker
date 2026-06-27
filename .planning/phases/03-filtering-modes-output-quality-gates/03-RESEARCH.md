# Phase 3: Filtering, Modes, Output + Quality Gates - Research

**Researched:** 2026-06-28
**Domain:** TypeScript/Angular diagnostic post-processing (filtering, verdict, formatting) + ESLint flat-config quality gates
**Confidence:** HIGH (every load-bearing source-level claim verified against the INSTALLED `@angular/compiler-cli@22.0.4` / `typescript@6.0.3` and the live repo, plus one empirical `readConfiguration` probe)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01..D-13 -- DO NOT re-decide)
- **D-01 Hybrid composition.** Project-boundary filtering runs INSIDE `runTypecheck` (driven by a new `includeDeps?: boolean` `CoreOption`); the pass/fail verdict (`evaluateResult`) and the human formatter (`formatReport`) are SEPARATE PURE functions exported from `core/`, composed by the Phase-4 adapter. `runTypecheck` stays the only `@angular/compiler-cli`-touching seam.
- **D-02 `CoreResult` holds FILTERED diagnostics + a `suppressedCount` scalar.** After filtering, `diagnostics` = in-project only; `errorCount`/`warningCount` counted POST-filter; add `suppressedCount: number` = excluded out-of-project + `node_modules` count. `includeDeps: true` folds those back (and `suppressedCount` -> 0). Do NOT retain a raw/`outOfProject[]` array.
- **D-03 Verdict is a pure `evaluateResult(result, { maxWarnings }) -> { success }` in `core/`.** Errors ALWAYS fail; `warningCount > maxWarnings` fails; `maxWarnings: 0` fails on ANY warning -- all POST-filter. Config-error diagnostics (Phase-2 D-03) and the zero-rootNames guard (`file: undefined`) are NEVER filtered.
- **D-04 Fail-fast is REPORTING-ONLY, never a gather short-circuit.** The unconditional all-getter ALWAYS runs every getter; `runTypecheck` takes NO `failFast` flag. Fail-fast truncates the REPORTED list at the first Error-category diagnostic. Document it as "output brevity / early signal, NOT a speed-up."
- **D-05 In-project baseline = the leaf tsconfig's `basePath`.** A diagnostic is in-project iff its canonical-realpath `fileName` is under the canonical-realpath `basePath`. NOT `rootDir`/`rootDirs`. A `paths`-resolved sibling project lands OUTSIDE `basePath` -> filtered by default; `includeDeps: true` surfaces it.
- **D-06 Filter on absolute, realpath-normalized `fileName` via `getCanonicalFileName` + `realpath`** (pnpm-symlink + case-insensitive-FS safe), NEVER naive string-prefix / `toLowerCase()`. Exclude `node_modules` by PATH-SEGMENT test, NOT substring `.includes('node_modules')`. Filter runs AFTER `performCompilation`, against `result.program.getTsProgram()`'s host.
- **D-07 `includeDeps` and `skipLibCheck` are ORTHOGONAL.** `includeDeps` (default false) governs OUR boundary filter; `skipLibCheck` is the consumer's tsconfig option, HONORED VERBATIM. No second severity knob.
- **D-08 CI-relative paths via an optional `pathBase` `CoreOption` consumed ONLY by the formatter.** `formatDiagnostics`'s `FormatDiagnosticsHost.getCurrentDirectory()` sets the relativization base; `getCanonicalFileName` must NOT be identity (use OUR host built from `pathBase`). When `pathBase` unset, default ABSOLUTE paths (deterministic) -- NOT cwd-relative. Phase-4 adapter fills `pathBase` from `context.root`.
- **D-09 File-grouped output via `ts.sortAndDeduplicateDiagnostics`** applied before counting/formatting. Sort key = file -> start -> length -> code -> messageText (file-less sort first). Render via compiler-cli `formatDiagnostics`. SINGLE stream for v0.0.1.
- **D-10 TTY-gated color; plain (ANSI-stripped) default for non-TTY** (CI/agents/pipes), color interactively. compiler-cli's `formatDiagnostics` is always-color, so strip ANSI when stdout is not a TTY.
- **D-11 Module-boundary enforcement via ESLint `@typescript-eslint/no-restricted-imports` scoped to `src/core/**`** banning `@nx/devkit`, `nx`, `@angular-devkit/architect` (+ `@nx/*` / `@angular-devkit/*` family patterns) and `yargs` -- INCLUDING type-only imports. Single published package; NOT `@nx/enforce-module-boundaries`. Also forbid `process.exit` and `console`/`logger` in `core/**`. Specifier ban ONLY; defer the directory-zone rule.
- **D-12 `@nx/dependency-checks` is already enabled and ORTHOGONAL** to the boundary. Prettier `singleQuote: true` already present. Phase 3 adds only the `no-restricted-imports` `core/**` override; lint must pass clean.
- **D-13 Mock `@angular/compiler-cli` only where the compiler is genuinely touched** (gatherer + tsconfig-resolution path); test `filterDiagnostics` / `evaluateResult` / `formatReport` as PURE functions with hand-built `ts.Diagnostic[]` literals and a fake `Program` -- no compiler mock.

### Claude's Discretion
- Exact option names (`includeDeps`, `maxWarnings`, `pathBase`; a reporter-layer `failFast`), module/file names (e.g. `filter-diagnostics.ts`, `evaluate-result.ts`, `format-report.ts`), the ANSI-strip mechanism, the fail-fast truncation detail (truncate-only vs a "N more suppressed" footer), the first-error ordering, and the precise mock strategy (`vi.mock` vs dependency injection).
- **Scale implementation:** memoize canonicalized directory paths in the boundary filter (a cache, NOT a `realpath()` syscall per diagnostic).
- Verify the no-emit override (Phase-2 D-05) neutralizes the `rootDir` -> TS6059 trap; add a fixture if it can still fire.

### Deferred Ideas (OUT OF SCOPE)
- Quiet / errors-only output mode (would suppress NG8xxx WARNING-severity -> kills the differentiator).
- Errors/warnings split into two streams + structured per-diagnostic category -> future JSON/SARIF reporter (REP-01).
- `outOfProject[]` enumeration in `CoreResult` -> non-destructive 0.x widening later.
- `import/no-restricted-paths` directory-zone enforcement -> only if internal coupling appears.
- Nx executor adapter / `schema.json` / normalize-options / cacheable target / exit-code mapping -> Phase 4 (EXE-01/06/07, TEST-04). `pathBase` <- `context.root` and `{ success }`/exit are realized there.
- Buildable + publishable fixtures + the full 5-project-type matrix + pnpm/mixed-case e2e assertions -> Phase 6 (TEST-03, CI-01).
- `NgtscProgram` per-file (`OptimizeFor.SingleFile`) incremental + `--watch` -> deferred milestone (REP-02).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXE-03 | Default full / report-all mode (matches `tsc --noEmit`); opt-in fail-fast (return on first error). | `evaluateResult` (verdict) + a reporter-layer `failFast` truncation in `formatReport`; D-04 confirms fail-fast is reporting-only (the `defaultGatherDiagnostics` `&&`-short-circuit it must NOT replicate is verified at `chunk-6ZBSJK4S.js:609-616`). |
| EXE-04 | Excludes out-of-project + `node_modules` diagnostics by default; opt-in `includeDeps`. | `filterDiagnostics` against `basePath` (empirically = leaf-tsconfig dir, probe below) using canonical-realpath + path-segment node_modules test. |
| EXE-05 | `--max-warnings=<n>` (0 = fail on any warning); errors always fail; project-configured categories respected. | `evaluateResult({ maxWarnings })` on POST-filter `errorCount`/`warningCount`; categories already counted by `ts.DiagnosticCategory` in `finalize` (Phase-2 D-01). |
| OUT-01 | Default human output via compiler-cli `formatDiagnostics` (NG codes + template codeframes). | `formatReport` -> `ng.formatDiagnostics`; verified always emits NG codes via `replaceTsWithNgInErrors` (`chunk-QY6RCOQ6.js:140`). |
| OUT-02 | Diagnostics filtered on absolute realpath-normalized `fileName`; CI annotation paths workspace-root-relative. | `filterDiagnostics` (D-06) + the `pathBase`-driven `FormatDiagnosticsHost` (D-08); diagnostic `file.fileName` is already absolute + forward-slash (probe). |
| OUT-03 | Clear non-zero exit on diagnostics; deterministic, idempotent (agent-ready) output. | `ts.sortAndDeduplicateDiagnostics` (alphabetical-by-file determinism, verified `typescript.d.ts:8574` + comparator `typescript.js:21823`); ABSOLUTE-path default (not cwd) for determinism; exit is the Phase-4 adapter's job. |
| TEST-01 | Unit tests (Vitest, mocking compiler-cli) cover gatherer, project-boundary filtering, tsconfig resolution, modes, `--max-warnings`. | Pure-function unit tier with hand-built `ts.Diagnostic[]` (the established `gather-diagnostics.spec.ts` pattern) + a fake `Program`. |
| WS-04 | ESLint + Prettier + `@nx/dependency-checks` + module-boundary enforcement of `core/` vs adapters. | `@typescript-eslint/no-restricted-imports@8.62.0` `core/**` flat-config override (D-11); `@nx/dependency-checks` already wired (verified in `packages/angular-typechecker/eslint.config.mjs`). |
</phase_requirements>

## Summary

Phase 3 is a pure post-processing + quality-gate phase. It adds three behaviors on top of the Phase-2 `CoreResult` -- (1) project-boundary filtering, (2) a pass/fail verdict, and (3) human formatting -- plus the ESLint `core/**` import ban that locks the framework-agnostic boundary. Crucially, NONE of this touches `@angular/compiler-cli` semantics: the filter runs against the already-returned `result.program.getTsProgram()` host, and the verdict/formatter are pure functions over `ts.Diagnostic[]`. That is the entire payoff of the D-01 hybrid split and is what makes TEST-01 unit-testable with hand-built diagnostic literals and zero compiler mock.

All seven discuss-phase research passes that produced D-01..D-13 held up under re-verification against the installed sources, with **ONE correction** worth the planner's attention: CONTEXT.md D-05 asserts `parsed.options.rootDir` is `undefined` "in the common case" because Nx lib/app templates omit it. In THIS workspace (bootstrapped via `--preset=apps`, the legacy non-ts-solution base) that is FALSE -- `tsconfig.base.json` sets `rootDir: "."`, so `parsed.options.rootDir` resolves to the WORKSPACE ROOT (empirically `D:/.../angular-typechecker`). This does not weaken D-05; it strengthens it: `rootDir` here would classify EVERY workspace file as in-project, defeating the filter entirely. `basePath` (empirically the leaf-tsconfig dir) is the correct, present baseline regardless of which base shape ships. All other claims (the `sortAndDeduplicateDiagnostics` sort key, the always-color `formatDiagnostics`, identity `getCanonicalFileName`, the `defaultGatherDiagnostics` short-circuit, the ESLint rule semantics) are CONFIRMED verbatim.

**Primary recommendation:** Grow `core/` in place with three new pure modules -- `filter-diagnostics.ts`, `evaluate-result.ts`, `format-report.ts` -- wire `filterDiagnostics` into `runTypecheck`/`finalize` (the only place that holds the live `Program`), extend `CoreOptions` with `includeDeps?`/`pathBase?` and `CoreResult` with `suppressedCount`, and add the `@typescript-eslint/no-restricted-imports` `src/core/**` flat-config override. Filter on `program.getTsProgram().useCaseSensitiveFileNames()` + `ts.sys.realpath`, sort with `ts.sortAndDeduplicateDiagnostics`, render with `ng.formatDiagnostics` + a `pathBase`-built `FormatDiagnosticsHost`, then strip ANSI when `!process.stdout.isTTY`.

## Locked Decisions Confirmed (D-01..D-13)

Verification of every load-bearing source-level claim against INSTALLED `@angular/compiler-cli@22.0.4` / `typescript@6.0.3` and the live repo. `[VERIFIED]` = confirmed via tool against an authoritative installed source this session.

| Decision / Claim | Verdict | Citation (this session) |
|------------------|---------|--------------------------|
| **D-09** `ts.sortAndDeduplicateDiagnostics` is PUBLIC API in `typescript@6.0.3` | CONFIRMED | `node_modules/typescript/lib/typescript.d.ts:8574` -- `function sortAndDeduplicateDiagnostics<T extends Diagnostic>(diagnostics: readonly T[]): SortedReadonlyArray<T>;` `[VERIFIED]` |
| **D-09** comparator sort key = file -> start -> length -> code -> messageText | CONFIRMED | `typescript.js:21823` (`compareDiagnosticsSkipRelatedInformation`): `compareStringsCaseSensitive(getDiagnosticFilePath(d1), getDiagnosticFilePath(d2)) \|\| compareValues(d1.start, d2.start) \|\| compareValues(d1.length, d2.length) \|\| compareValues(code1, code2) \|\| compareMessageText(d1, d2)` `[VERIFIED]` |
| **D-09** file-less diagnostics sort FIRST | CONFIRMED | `getDiagnosticFilePath` returns `void 0` when `!diagnostic.file` (`typescript.js:21814`); `compareComparableValues` (`typescript.js:21819`): `a === void 0 ? -1 /* LessThan */` -- so `undefined` file path sorts before any real path `[VERIFIED]` |
| **D-10** compiler-cli `formatDiagnostics` uses `formatDiagnosticsWithColorAndContext` UNCONDITIONALLY (always color) | CONFIRMED | INSTALLED `node_modules/@angular/compiler-cli/bundles/chunk-6ZBSJK4S.js:443` -- `diags.map((diagnostic) => replaceTsWithNgInErrors(ts5.formatDiagnosticsWithColorAndContext([diagnostic], host)))`; no TTY gate. Empirically emits `[91m...` ANSI even for a file-less diagnostic (probe) `[VERIFIED]` |
| **D-08** `defaultFormatHost.getCanonicalFileName` is identity | CONFIRMED | `chunk-6ZBSJK4S.js:438` -- `getCanonicalFileName: (fileName) => fileName` `[VERIFIED]` |
| **D-08** `defaultFormatHost.getCurrentDirectory` is cwd-based (the non-determinism trap) | CONFIRMED | `chunk-6ZBSJK4S.js:437` -- `getCurrentDirectory: () => ts5.sys.getCurrentDirectory()`; cwd differs with/without the Nx daemon, so unset-`pathBase` must default to ABSOLUTE, not cwd-relative `[VERIFIED]` |
| **D-05** `readConfiguration`/`calcProjectFileAndBasePath` always injects `basePath` (leaf tsconfig dir) | CONFIRMED | `chunk-6ZBSJK4S.js:448-454` (`calcProjectFileAndBasePath` -> `basePath = host.resolve(projectDir)`), `:490` (`basePath` folded into `existingCompilerOptions`), `:495` (passed as `parseJsonConfigFileContent` basePath). Empirically `parsed.options.basePath === D:/.../apps/ng-spike-app` for the app tsconfig (probe) `[VERIFIED]` |
| **D-05** Nx lib/app templates do NOT set `rootDir` so `parsed.options.rootDir` is `undefined` | **CORRECTED** | FALSE for THIS repo. `tsconfig.base.json:4` sets `rootDir: "."`; the app chain `tsconfig.app.json -> tsconfig.json -> tsconfig.base.json` inherits it, so `parsed.options.rootDir === D:/.../angular-typechecker` (the WORKSPACE ROOT) -- empirically confirmed (probe). The repo used `create-nx-workspace --preset=apps` (legacy non-ts-solution base, STATE.md 01-01), not the ts-solution base the D-05 prose assumed. **The D-05 conclusion (use `basePath`, never `rootDir`) is unchanged and MORE strongly justified**: `rootDir = workspace root` would mark every file in-project and defeat the filter. `[VERIFIED]` |
| **D-06** program host exposes case-sensitivity + a realpath source for normalization | CONFIRMED | `result.program.getTsProgram()` exposes `useCaseSensitiveFileNames()` (method) and `getCurrentDirectory()` (probe); `ts.sys.realpath` is a function; `ts.sys.useCaseSensitiveFileNames === false` on this Windows arm64 FS. `ts.createGetCanonicalFileName(useCase)` lowercases on case-insensitive FS (probe: `'D:/Foo/Bar.ts' -> 'd:/foo/bar.ts'`) `[VERIFIED]` |
| **D-06** diagnostic `file.fileName` is already absolute + forward-slash normalized | CONFIRMED | probe: a real diagnostic source file is `D:/projects/.../fixtures/gate-b-error/error.component.ngtypecheck.ts` (forward slashes, absolute). Realpath still needed for pnpm symlinks where the symlink path != real path `[VERIFIED]` |
| **D-04** `ngc`'s `defaultGatherDiagnostics` `&&`-short-circuits, suppressing `getNgSemanticDiagnostics` after a prior error | CONFIRMED | `chunk-6ZBSJK4S.js:609-616` -- `checkOtherDiagnostics = checkOtherDiagnostics && checkDiagnostics(...)` chained; line 616 `getNgSemanticDiagnostics()` is gated by the running `&&`. This is the failure mode the all-getter (`gather-diagnostics.ts`) avoids; fail-fast must NOT re-introduce it `[VERIFIED]` |
| **D-11** `@typescript-eslint/no-restricted-imports` exists and bans type-only imports by DEFAULT | CONFIRMED | `@typescript-eslint/eslint-plugin@8.62.0` installed; rule at `dist/rules/no-restricted-imports.js`. Type-only allowance is OPT-IN: a path is added to `allowedTypeImportPathNameSet` only when `restrictedPath.allowTypeImports` is truthy (`:155-159`). Omitting `allowTypeImports` bans `import type` too `[VERIFIED]` |
| **D-11/D-12** `@nx/enforce-module-boundaries` is project/tag-granular; cannot ban folders inside ONE project | CONFIRMED | `@nx/eslint-plugin@23.0.1` `dist/src/rules/enforce-module-boundaries.js`: `findProject(...sourceFilePath) -> sourceProject` (`:156`), `targetProject` (`:165-168`), and at `:264` when `sourceProject === targetProject` it only nudges relative imports -- no specifier ban within one project `[VERIFIED]` |
| **D-12** `@nx/dependency-checks` already wired; Prettier `singleQuote: true` already present | CONFIRMED | `packages/angular-typechecker/eslint.config.mjs:10-18` enables `@nx/dependency-checks` (error) on `**/*.json`; `.prettierrc` = `{ "singleQuote": true }` `[VERIFIED]` |
| **D-10** `replaceTsWithNgInErrors` does NOT strip ANSI (only rewrites the TS->NG code prefix) | CONFIRMED | `chunk-QY6RCOQ6.js:140-142` -- `errors.replace(ERROR_CODE_MATCHER, "$1NG$2")`; color stays embedded -> ANSI-strip must be a separate post-step `[VERIFIED]` |

**Net:** 13/14 source-level claims CONFIRMED; 1 CORRECTED (the D-05 `rootDir`-is-undefined sub-claim) with the conclusion intact and strengthened. No architecture changes.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Project-boundary filtering | `core/` (inside `runTypecheck`) | -- | Needs the live `Program` host; only `runTypecheck` holds it (D-01). |
| Pass/fail verdict (`evaluateResult`) | `core/` (pure fn) | Phase-4 adapter (calls it) | Pure over `CoreResult` + `{ maxWarnings }`; framework-agnostic (D-03). |
| Human formatting (`formatReport`) | `core/` (pure fn) | Phase-4 adapter (supplies `pathBase`, prints) | Pure over `ts.Diagnostic[]` + options; the adapter owns stdout + exit (D-08/D-10). |
| Sort + dedup | `core/` (pure, via `ts.sortAndDeduplicateDiagnostics`) | -- | Determinism is a core contract (OUT-03). |
| ANSI strip (TTY gate) | `core/` formatter (reads a `color`/`isTTY` flag) | Phase-4 adapter (passes `process.stdout.isTTY`) | Keep `process.stdout` out of `core/` purity -- pass a boolean in (D-10/D-11 forbids `console`/`process` in core). |
| Exit-code mapping | Phase-4 adapter ONLY | -- | OUT-03 non-zero exit is the executor's job; explicitly deferred. |
| `pathBase <- context.root` | Phase-4 adapter ONLY | -- | core never reads `context` (D-08). |
| Module-boundary lint gate | repo ESLint flat config | -- | `src/core/**` override (D-11); not a runtime concern. |

## Standard Stack

No new runtime dependencies. Phase 3 uses already-installed, already-locked packages:

### Core (already installed -- verified versions)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `typescript` (peer) | `6.0.3` | `ts.sortAndDeduplicateDiagnostics`, `ts.DiagnosticCategory`, `ts.FormatDiagnosticsHost`, `ts.sys.realpath`, `ts.Program.useCaseSensitiveFileNames()` | Public diagnostic ordering/host APIs; `[VERIFIED: node_modules/typescript]` |
| `@angular/compiler-cli` (peer) | `22.0.4` | `formatDiagnostics` (NG codes + template codeframes) for `formatReport`; `Program.getTsProgram()` for the filter host | The OUT-01 renderer; `[VERIFIED: node_modules/@angular/compiler-cli]` |

### Supporting (dev/lint -- already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@typescript-eslint/eslint-plugin` | `8.62.0` | `@typescript-eslint/no-restricted-imports` (`core/**` ban incl. type-only) | The D-11 boundary gate; `[VERIFIED: node_modules/@typescript-eslint/eslint-plugin]` |
| `@nx/eslint-plugin` | `23.0.1` | `@nx/dependency-checks` (already wired), `no-console` (built-in ESLint) | Quality gates; `[VERIFIED: node_modules/@nx/eslint-plugin]` |
| `vitest` | `4.x` | Pure-function unit tier (hand-built `ts.Diagnostic[]`) | TEST-01; `[VERIFIED: vitest.config.mts]` |

**Installation:** none required. Confirm `node -e "require('typescript').sortAndDeduplicateDiagnostics"` and `require('@angular/compiler-cli').formatDiagnostics` resolve (both verified this session).

### Node built-ins used
- `node:path` (`path.sep`, segment splitting), `node:fs`/`ts.sys.realpath` (symlink resolution). No new packages.

## Package Legitimacy Audit

> Not applicable -- Phase 3 installs ZERO new packages. All APIs come from already-locked, already-audited `typescript@6.0.3` / `@angular/compiler-cli@22.0.4` (peers) and dev-time `@typescript-eslint/eslint-plugin@8.62.0` / `@nx/eslint-plugin@23.0.1`. No registry/slopcheck step needed.

## Architecture Patterns

### System Architecture Diagram

```
                        runTypecheck(CoreOptions)         [core/run-typecheck.ts -- the ONLY compiler seam]
                                  |
            ng.readConfiguration(tsConfigPath)  --> parsed { rootNames, options.basePath, errors, projectReferences }
                                  |
                 [D-03 guards: prepend parsed.errors; zero-rootNames short-circuit]
                                  |
            ng.performCompilation({ rootNames, options: <D-05 no-emit override>, gatherDiagnostics: gatherAllDiagnostics })
                                  |
                    result.diagnostics  (config errors prepended)
                                  |
       +--------------------------+---------------------------+
       |                                                      |
   in-project / node_modules classification           result.program.getTsProgram()
   filterDiagnostics(diags, { basePath, includeDeps,  <-- host: useCaseSensitiveFileNames(), realpath
                              program })                      |
       |                                                      |
       v
   { kept: ts.Diagnostic[], suppressedCount: number }
       |
   finalize(): sort(ts.sortAndDeduplicateDiagnostics) -> count Error/Warning categories -> CoreResult
       |
       v
   CoreResult { tsConfigPath, rootNamesCount, diagnostics(FILTERED+SORTED), errorCount, warningCount, suppressedCount, durationMs }
       |
       +-------------------------------+-------------------------------+
       |                               |                               |
   evaluateResult(result,          formatReport(result,            (Phase-4 adapter)
     { maxWarnings })                { pathBase, color, failFast }) --> stdout + process.exit
       |                               |
       v                               v
   { success: boolean }            string (sorted, NG-coded, ANSI per `color`)
   [pure -- no compiler]           [pure -- no compiler, no console]
```

File-to-implementation mapping is in Recommended Project Structure below; the diagram traces the primary use case (a tsconfig in, a verdict + a rendered report out).

### Recommended Project Structure
```
packages/angular-typechecker/src/core/
|-- run-typecheck.ts            # EXTEND: add includeDeps/pathBase to CoreOptions; add suppressedCount to CoreResult;
|                               #         call filterDiagnostics in finalize; sort via ts.sortAndDeduplicateDiagnostics
|-- gather-diagnostics.ts       # UNCHANGED (the all-getter; filtering is a SEPARATE post-performCompilation pass, D-06)
|-- filter-diagnostics.ts       # NEW pure: classify in-project vs out-of-project/node_modules (D-05/D-06/D-07)
|-- evaluate-result.ts          # NEW pure: evaluateResult(result, { maxWarnings }) -> { success } (D-03)
|-- format-report.ts            # NEW pure: formatReport(result, { pathBase, color, failFast }) -> string (D-08/D-09/D-10)
|-- diagnostic-codes.ts         # REUSE: NG()/ngCodeOf() (display only)
|-- compiler-loader.ts          # UNCHANGED (memoized await import; the GATE A seam)
|-- compiler-cli-types.ts       # MAYBE widen: re-export ts.FormatDiagnosticsHost shape if needed (type-only)
|-- filter-diagnostics.spec.ts  # NEW unit (pure; fake Program + hand-built ts.Diagnostic[])
|-- evaluate-result.spec.ts     # NEW unit (pure)
|-- format-report.spec.ts       # NEW unit (pure; assert sort order, ANSI strip, NG code rendering)
'-- ... (existing Phase-2 specs unchanged)
```

### Pattern 1: Filter is a separate pass over the live program host (D-01/D-06)
**What:** `filterDiagnostics` receives the gathered diagnostics PLUS the `ts.Program` (for `useCaseSensitiveFileNames()`), classifies each by its canonical-realpath `fileName` against the canonical-realpath `basePath`, and returns `{ kept, suppressedCount }`. It is invoked inside `runTypecheck`/`finalize` (the only place holding the live `Program`), but is itself a standalone testable function.
**When to use:** Always (post-`performCompilation`, pre-count). Never inside `gatherAllDiagnostics`.
**Example:**
```ts
// core/filter-diagnostics.ts  -- Source: D-05/D-06 + verified ts.Program host (this session)
import type ts from 'typescript';

export interface FilterOptions {
  /** Canonical-realpath baseline = the leaf tsconfig's basePath (D-05). */
  basePath: string;
  /** D-07: false (default) excludes out-of-project + node_modules. */
  includeDeps: boolean;
  /** Used only for useCaseSensitiveFileNames() + (optionally) realpath. */
  useCaseSensitiveFileNames: boolean;
  /** Resolve symlinks (pnpm .pnpm/). Inject ts.sys.realpath; tests pass identity. */
  realpath: (p: string) => string;
}

export interface FilterResult {
  kept: ts.Diagnostic[];
  suppressedCount: number;
}

export function filterDiagnostics(
  diagnostics: readonly ts.Diagnostic[],
  options: FilterOptions,
): FilterResult {
  if (options.includeDeps) {
    return { kept: [...diagnostics], suppressedCount: 0 };
  }

  const canonicalize = createCanonicalizer(options);
  // Discretion: memoize realpath() per directory (cache), NOT per diagnostic.
  const canonicalBase = canonicalize(options.basePath);

  const kept: ts.Diagnostic[] = [];
  let suppressedCount = 0;

  for (const diagnostic of diagnostics) {
    // D-03: NEVER filter file-less diagnostics (config errors / zero-rootNames guard).
    if (diagnostic.file === undefined) {
      kept.push(diagnostic);
      continue;
    }

    const canonicalFile = canonicalize(diagnostic.file.fileName);

    if (isNodeModulesPath(canonicalFile) || !isUnderDir(canonicalFile, canonicalBase)) {
      suppressedCount++;
      continue;
    }

    kept.push(diagnostic);
  }

  return { kept, suppressedCount };
}
```

### Pattern 2: Path-segment containment + node_modules test (D-06 -- replaces the prior-art landmine)
**What:** Containment by SEGMENT boundary, not raw `startsWith`; node_modules by segment, not substring; canonicalization via case-fold (when FS is case-insensitive) AFTER realpath.
**Example:**
```ts
// Source: D-06 + the prior-art landmine (executor.ts:135/146/151) this REPLACES
function createCanonicalizer(o: Pick<FilterOptions, 'useCaseSensitiveFileNames' | 'realpath'>) {
  // realpath FIRST (resolves pnpm .pnpm/ symlink to the real location), THEN case-fold.
  const dirCache = new Map<string, string>(); // discretion: memoize per dir
  return (filePath: string): string => {
    const real = o.realpath(filePath).replace(/\\/g, '/'); // normalize to '/'
    return o.useCaseSensitiveFileNames ? real : real.toLowerCase();
  };
}

function isNodeModulesPath(canonicalFile: string): boolean {
  // SEGMENT test (D-06): 'node_modules-tools/x.ts' must NOT match.
  return canonicalFile.split('/').includes('node_modules');
}

function isUnderDir(canonicalFile: string, canonicalDir: string): boolean {
  if (canonicalFile === canonicalDir) {
    return true;
  }
  const dirWithSep = canonicalDir.endsWith('/') ? canonicalDir : canonicalDir + '/';
  // startsWith on a SEGMENT-bounded prefix ('/foo/bar' under '/foo/ba' -> false).
  return canonicalFile.startsWith(dirWithSep);
}
```

### Pattern 3: Verdict is a pure scalar function (D-03)
```ts
// core/evaluate-result.ts  -- Source: D-03
import type { CoreResult } from './run-typecheck';

export interface EvaluateOptions {
  /** EXE-05: undefined => warnings never fail on their own; 0 => any warning fails. */
  maxWarnings?: number;
}

export function evaluateResult(
  result: Pick<CoreResult, 'errorCount' | 'warningCount'>,
  options: EvaluateOptions = {},
): { success: boolean } {
  if (result.errorCount > 0) {
    return { success: false }; // errors ALWAYS fail
  }

  if (options.maxWarnings !== undefined && result.warningCount > options.maxWarnings) {
    return { success: false }; // maxWarnings: 0 fails on ANY warning
  }

  return { success: true };
}
```

### Pattern 4: Formatter -- sort, render via compiler-cli, ANSI-gate (D-08/D-09/D-10)
```ts
// core/format-report.ts  -- Source: D-08/D-09/D-10 + verified always-color formatDiagnostics
import type ts from 'typescript';
import type { CompilerCli } from './compiler-cli-types';

// Strip SGR ANSI sequences. ESC =  (0x1b); avoid a literal control char in source.
const ANSI_PATTERN = new RegExp(String.fromCharCode(0x1b) + '\\[[0-9;]*m', 'g');

export interface FormatOptions {
  /** D-08: relativization base. Unset => ABSOLUTE paths (deterministic), NOT cwd. */
  pathBase?: string;
  /** D-10: false => strip ANSI (CI/agents/pipes). Adapter passes process.stdout.isTTY. */
  color: boolean;
  /** EXE-03 reporter-layer fail-fast: truncate REPORTED list at the first Error. */
  failFast?: boolean;
}

export function formatReport(
  diagnostics: readonly ts.Diagnostic[],   // already sorted+deduped by runTypecheck (D-09)
  ng: Pick<CompilerCli, 'formatDiagnostics'>,
  ts_: typeof import('typescript'),
  options: FormatOptions,
): string {
  let toRender = diagnostics;

  if (options.failFast === true) {
    const firstError = diagnostics.findIndex(
      (d) => d.category === ts_.DiagnosticCategory.Error,
    );
    if (firstError >= 0) {
      toRender = diagnostics.slice(0, firstError + 1); // include the first error
    }
  }

  const host = makeFormatHost(ts_, options.pathBase);
  const rendered = ng.formatDiagnostics([...toRender], host);

  return options.color ? rendered : rendered.replace(ANSI_PATTERN, '');
}

function makeFormatHost(
  ts_: typeof import('typescript'),
  pathBase: string | undefined,
): ts.FormatDiagnosticsHost {
  const useCase = ts_.sys.useCaseSensitiveFileNames;
  return {
    // D-08: ABSOLUTE default (deterministic). When pathBase set, paths relativize to it.
    getCurrentDirectory: () => pathBase ?? '/__atc_absolute__',
    // D-08: NON-identity (compiler-cli's defaultFormatHost identity is wrong for case-fold).
    getCanonicalFileName: (f) => (useCase ? f : f.toLowerCase()),
    getNewLine: () => '\n', // OUT-02: normalize to '/'-style; force '\n' for idempotency
  };
}
```
> **Note for planner (discretion call):** The "ABSOLUTE default" needs care. `formatDiagnosticsWithColorAndContext` relativizes a diagnostic's `file.fileName` against `getCurrentDirectory()`. To get TRULY absolute output, `getCurrentDirectory()` should return a value that never prefixes the real paths (so `path.relative` leaves them absolute), OR the formatter should leave fileNames untouched. The simplest deterministic implementation is: when `pathBase` is unset, return the diagnostic file's own directory-agnostic absolute path -- i.e. set `getCurrentDirectory()` to a sentinel root that forces absolute emission. Validate the exact `path.relative` behavior with a probe during implementation (a 5-line `formatDiagnostics` call with a real fixture diagnostic). This is the single most fiddly OUT-02/OUT-03 detail.

### Extended `CoreOptions` / `CoreResult` (D-02/D-07/D-08)
```ts
// core/run-typecheck.ts -- EXTEND
export interface CoreOptions {
  tsConfigPath: string;
  includeDeps?: boolean;   // D-07: default false; true => boundary filter off
  pathBase?: string;       // D-08: formatter relativization base; core never reads it for filtering
}

export interface CoreResult {
  tsConfigPath: string;
  rootNamesCount: number;
  diagnostics: readonly ts.Diagnostic[]; // FILTERED + SORTED (D-02/D-09)
  errorCount: number;                    // POST-filter (D-02)
  warningCount: number;                  // POST-filter (D-02)
  suppressedCount: number;               // NEW: excluded out-of-project + node_modules (D-02)
  durationMs: number;
}
```
> **Wiring note:** `pathBase` is a `CoreOption` but is NOT consumed by `runTypecheck` (D-08 says the formatter consumes it). The cleanest plan is to NOT add `pathBase` to `CoreOptions` at all and instead pass it directly to `formatReport` from the Phase-4 adapter -- but CONTEXT.md <specifics> explicitly lists `pathBase` as a `CoreOption`. Recommendation: add it to `CoreOptions` for API discoverability/documentation, have `runTypecheck` IGNORE it, and have the adapter read `options.pathBase` to call `formatReport`. Flag this as a minor discretion point for the planner; either shape satisfies D-08 as long as core's FILTER never reads it.

### `finalize` extension (the wiring point)
`finalize` currently counts categories. Phase 3 inserts, in order: (1) `filterDiagnostics(diagnostics, ...)` -> `{ kept, suppressedCount }`; (2) `ts.sortAndDeduplicateDiagnostics(kept)` -> sorted; (3) count Error/Warning on the SORTED+FILTERED set; (4) return with `suppressedCount`. The zero-rootNames guard path returns BEFORE `performCompilation`, so it has no `Program` -- there, `suppressedCount = 0` and the single guard diagnostic is never filtered (file-less). Keep two `finalize` shapes or pass an optional `program`/`filter` so the guard path stays clean.

### Anti-Patterns to Avoid
- **Filtering inside `gatherAllDiagnostics`** -- breaks D-06 (gatherer stays "gather ALL") and makes the filter untestable without a real compiler.
- **`failFast` as a `runTypecheck` flag / gather short-circuit** -- D-04; re-introduces the exact `defaultGatherDiagnostics` `&&`-bug verified at `chunk-6ZBSJK4S.js:609-616`.
- **`diagnostic.file.fileName.toLowerCase().includes('node_modules')` / `startsWith(projectRoot)`** -- the prior-art landmine (`executor.ts:135/146/151`); breaks pnpm symlinks + Linux case-sensitivity + `node_modules-tools`.
- **cwd-relative formatter default** -- D-08; non-deterministic across the Nx daemon. Default ABSOLUTE.
- **`console.log`/`process.exit` in `core/`** -- D-11 lints it; pass `color`/`isTTY` IN, return strings/booleans OUT.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deterministic diagnostic ordering + dedup | A custom comparator over file/start/code | `ts.sortAndDeduplicateDiagnostics` (public, `typescript.d.ts:8574`) | Exactly matches `tsc --noEmit`; comparator + equality already battle-tested; reproduces the file-grouped gestalt `@angular/build` users expect. |
| Rendering NG codes + template codeframes | A custom diagnostic printer | `ng.formatDiagnostics` (+ a custom `FormatDiagnosticsHost`) | OUT-01 superset of `tsc`; `replaceTsWithNgInErrors` does the TS->NG rewrite for free. |
| Case-fold for canonical compare | `path` gymnastics | `ts.Program.useCaseSensitiveFileNames()` (live host) + lower-case fold | The compiler's own notion of canonicality; matches how diagnostics were produced. |
| Symlink resolution | Manual `.pnpm/` path rewriting | `ts.sys.realpath` (inject; tests pass identity) | Resolves pnpm symlinks the same way the compiler resolved them. |

**Key insight:** Every Phase-3 transformation has a public TS or compiler-cli primitive. The ONLY genuinely custom logic is the boundary classification (`isUnderDir` + `isNodeModulesPath`), which is ~15 lines of segment-aware string work -- and that exists precisely because the naive one-liner is the documented prior-art landmine.

## Runtime State Inventory

> Not applicable -- Phase 3 is a pure code-addition phase (new `core/` modules + an ESLint override). No rename/refactor/migration; no stored data, live-service config, OS-registered state, secrets, or build artifacts carry a renamed string. None -- verified: the phase adds files and extends two interfaces; it renames nothing.

## Common Pitfalls

### Pitfall 1: `.ngtypecheck.ts` shadow files in the diagnostic set
**What goes wrong:** Angular synthesizes `*.ngtypecheck.ts` shadow files for template type-checking; their `fileName` (e.g. `.../error.component.ngtypecheck.ts`, observed in the probe) appears on template diagnostics.
**Why it happens:** The template type-check compiler emits virtual files alongside the real component.
**How to avoid:** They live UNDER `basePath` (same directory as the component), so the `isUnderDir` test keeps them correctly -- no special-casing needed. Just do NOT assume every `fileName` ends in `.component.ts`; the filter is path-prefix based, which handles shadows transparently. Add one fixture assertion that a template diagnostic on a shadow file is kept.

### Pitfall 2: `formatDiagnostics` cwd-relativization breaks idempotency
**What goes wrong:** The default host's `getCurrentDirectory()` is `ts.sys.getCurrentDirectory()` (verified `chunk-6ZBSJK4S.js:437`); under the Nx daemon vs a cold run the cwd differs, so the same diagnostics render with different relative paths.
**Why it happens:** `formatDiagnosticsWithColorAndContext` relativizes file paths against the host cwd.
**How to avoid:** D-08 -- supply OUR `FormatDiagnosticsHost`; default to ABSOLUTE (no cwd dependence) and only relativize when `pathBase` is explicitly set (Phase-4 adapter supplies `context.root`). Force `getNewLine: () => '\n'` so Windows `\r\n` (observed in the probe) does not diverge cross-OS.

### Pitfall 3: case-sensitivity + symlink ORDER in canonicalization
**What goes wrong:** Lower-casing BEFORE realpath, or skipping realpath, misclassifies pnpm `.pnpm/<pkg>@x/node_modules/...` symlink paths (the diagnostic carries the symlink path; `basePath` is the real path, or vice versa) and case-only path differences on Linux CI.
**Why it happens:** `realpath` resolves the symlink to the true location; case-folding must mirror the FS.
**How to avoid:** realpath FIRST, then case-fold (only when `useCaseSensitiveFileNames === false`). Both invisible under npm/Linux dev -- the Phase-6 pnpm fixture + mixed-case assertion is the backstop, but the SEGMENT-aware, realpath-first implementation must land now.

### Pitfall 4: filtering the config-error / zero-rootNames guard diagnostics
**What goes wrong:** Filtering a `file: undefined` diagnostic (config error from `parsed.errors`, or the synthesized zero-rootNames Error) drops it because it has no path to test -> a false PASS.
**Why it happens:** The filter's path logic has nothing to compare.
**How to avoid:** D-03 -- short-circuit `diagnostic.file === undefined` to ALWAYS keep (see Pattern 1). These must be counted and reported. Add a unit assertion.

### Pitfall 5: the TS6059 `rootDir` trap (discretion item)
**What goes wrong:** `TS6059` ("File is not under 'rootDir'") can fire when a leaf tsconfig pulls in sibling files and `rootDir` is set narrower than the actual file set.
**Why it happens:** TS validates emitted-file layout against `rootDir`.
**Status (verified):** The Phase-2 D-05 no-emit override sets `noEmit: true` + `composite: false` + clears `declaration`/`emitDeclarationOnly`. TS6059 is an EMIT-layout diagnostic; with `noEmit`/`emitFlags: 0` it does not fire on this path (Phase-2's catalog fixtures, incl. composite-triangle, are green). The empirical `rootDir = workspace root` in this repo (probe) is wide enough to contain everything anyway. **Recommendation:** add ONE fixture where a leaf tsconfig (with a narrow `rootDir`) includes a sibling import, assert TS6059 does NOT appear -- cheap insurance, satisfies the discretion ask.

## Code Examples

### Sort + dedup before counting/formatting (D-09)
```ts
// Source: ts.sortAndDeduplicateDiagnostics (typescript.d.ts:8574, verified public this session)
import type ts from 'typescript';
const sorted = ts_.sortAndDeduplicateDiagnostics([...kept]); // SortedReadonlyArray<ts.Diagnostic>
// File-less (config/guard) diagnostics sort FIRST (verified compareComparableValues: undefined -> LessThan).
```

### Pure-function unit test with hand-built diagnostics (TEST-01 / D-13)
```ts
// Source: the established gather-diagnostics.spec.ts pattern (this repo)
import type ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { filterDiagnostics } from './filter-diagnostics';

function diag(fileName: string | undefined, code = 2322): ts.Diagnostic {
  return {
    category: 0 /* ts.DiagnosticCategory.Error -- avoids importing the enum value */,
    code,
    file: fileName === undefined ? undefined : ({ fileName } as ts.SourceFile),
    start: 0,
    length: 1,
    messageText: 'x',
  } as ts.Diagnostic;
}

describe('filterDiagnostics', () => {
  const base = { basePath: '/ws/proj', useCaseSensitiveFileNames: true, realpath: (p: string) => p };

  it('keeps in-project, suppresses out-of-project + node_modules (D-05/D-06)', () => {
    const r = filterDiagnostics(
      [
        diag('/ws/proj/src/a.component.ts'),       // kept
        diag('/ws/sibling-lib/src/b.ts'),          // suppressed (out of project)
        diag('/ws/proj/node_modules/x/y.d.ts'),    // suppressed (node_modules segment)
        diag('/ws/proj-other/src/c.ts'),           // suppressed (NOT a segment-bounded prefix)
        diag(undefined),                            // kept (config/guard, D-03)
      ],
      { ...base, includeDeps: false },
    );
    expect(r.kept).toHaveLength(2);
    expect(r.suppressedCount).toBe(3);
  });

  it('node_modules-tools is NOT misclassified (segment test, D-06)', () => {
    const r = filterDiagnostics([diag('/ws/proj/node_modules-tools/z.ts')], { ...base, includeDeps: false });
    expect(r.kept).toHaveLength(1);
  });

  it('includeDeps: true folds everything back, suppressedCount 0 (D-07)', () => {
    const r = filterDiagnostics([diag('/elsewhere/x.ts')], { ...base, includeDeps: true });
    expect(r.kept).toHaveLength(1);
    expect(r.suppressedCount).toBe(0);
  });
});
```

### `evaluateResult` modes (EXE-03/EXE-05)
```ts
expect(evaluateResult({ errorCount: 1, warningCount: 0 }).success).toBe(false);             // errors always fail
expect(evaluateResult({ errorCount: 0, warningCount: 3 }).success).toBe(true);              // no maxWarnings => warnings pass
expect(evaluateResult({ errorCount: 0, warningCount: 1 }, { maxWarnings: 0 }).success).toBe(false); // 0 = fail on any warning
expect(evaluateResult({ errorCount: 0, warningCount: 2 }, { maxWarnings: 2 }).success).toBe(true);  // at threshold passes
expect(evaluateResult({ errorCount: 0, warningCount: 3 }, { maxWarnings: 2 }).success).toBe(false); // over threshold fails
```

### ESLint `core/**` boundary override (D-11) -- mirrors the Nx clone idiom
```js
// Add to packages/angular-typechecker/eslint.config.mjs (after ...baseConfig spread).
// Idiom verified against D:/projects/github/nrwl/nx/eslint.config.mjs:67-83 (patterns + paths).
{
  files: ['**/src/core/**/*.ts'],
  rules: {
    '@typescript-eslint/no-restricted-imports': [
      'error',
      {
        // Exact specifiers. allowTypeImports OMITTED => type-only imports ALSO banned (verified
        // @typescript-eslint/eslint-plugin@8.62.0 no-restricted-imports.js:155-159).
        paths: [
          { name: 'nx', message: 'core/ is framework-agnostic: no Nx CLI/devkit imports (D-11).' },
          { name: '@nx/devkit', message: 'core/ must not import @nx/devkit (D-11).' },
          { name: '@angular-devkit/architect', message: 'core/ must not import the Angular CLI architect (D-11).' },
          { name: 'yargs', message: 'core/ must not import a CLI arg parser (D-11).' },
        ],
        // Family globs.
        patterns: [
          { group: ['@nx/*'], message: 'core/ must not import any @nx/* package (D-11).' },
          { group: ['@angular-devkit/*'], message: 'core/ must not import any @angular-devkit/* package (D-11).' },
        ],
      },
    ],
    // Keep core/ pure: no direct stdout/exit (D-11). The formatter returns strings; the adapter prints.
    'no-console': 'error',
    'no-restricted-properties': [
      'error',
      { object: 'process', property: 'exit', message: 'core/ must not call process.exit (D-11); the adapter owns exit.' },
    ],
  },
},
```
> **Lint-cleanliness watch-outs:** (1) the existing specs and `run-typecheck.ts` import `typescript`/`@angular/compiler-cli` via `import type` and the single `await import()` -- neither is in the banned list, so they stay clean. (2) Scope the override to `**/src/core/**/*.ts` so it does NOT hit the Phase-4 adapter (which legitimately imports `@nx/devkit`). (3) Confirm `no-console`/`no-restricted-properties` do not already exist in the base with different settings (they do not -- base `rules: {}`). (4) `@nx/dependency-checks` stays untouched (D-12): the adapter's future `@nx/devkit` import is a legit declared dependency.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Naive `toLowerCase()`+`startsWith`+`includes('node_modules')` filter (prior-art prototype `executor.ts:135/146/151`) | realpath-first + case-fold + path-segment containment | This phase (D-06) | pnpm + Linux-CI + `node_modules-tools` safe |
| `ngc` `defaultGatherDiagnostics` `&&`-short-circuit (suppresses template/extended after a TS error) | unconditional all-getter + reporting-only fail-fast | Phase 1/2 (gatherer) + Phase 3 (D-04) | the differentiator: NG8xxx always surfaces |
| `@angular/build` program-iteration diagnostic order | `ts.sortAndDeduplicateDiagnostics` alphabetical-by-file | This phase (D-09) | deterministic/idempotent, agent-ready |
| compiler-cli always-color `formatDiagnostics` | always-color render + ANSI-strip when not a TTY | This phase (D-10) | clean CI/agent/pipe output |

**Deprecated/outdated:** nothing new deprecated; the prior-art naive filter is explicitly the anti-pattern, not a deprecation.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `pathBase`-unset ABSOLUTE-path rendering is achievable purely via the `FormatDiagnosticsHost.getCurrentDirectory()` sentinel | Pattern 4 / formatter | LOW -- needs a 5-line implementation-time probe to nail the exact `path.relative` behavior; the architecture (custom host) is verified, only the sentinel value is unconfirmed. Mitigation: probe `ng.formatDiagnostics([realDiag], host)` with a fixture during implementation. |
| A2 | Injecting `ts.sys.realpath` (rather than the program's own host `realpath`) is sufficient for pnpm symlink resolution | filter-diagnostics | LOW -- `ts.sys.realpath` is the same syscall the compiler host wraps; Phase-6 pnpm fixture is the backstop. Optionally read the program host's realpath if exposed. |

> Both assumptions are LOW-risk implementation details, not architecture. No user confirmation needed; both are verifiable with a single probe at implementation time.

## Open Questions

1. **Should `pathBase` live on `CoreOptions` or be a `formatReport` argument only?**
   - What we know: CONTEXT.md <specifics> lists `pathBase` as a `CoreOption`; D-08 says only the formatter consumes it and the core's FILTER never reads it.
   - What's unclear: whether to add it to the `CoreOptions` interface (discoverability) or pass it straight to `formatReport`.
   - Recommendation: add to `CoreOptions` for documentation, have `runTypecheck` ignore it, have the adapter pass `options.pathBase` into `formatReport`. Either satisfies D-08. Planner's discretion.

2. **`failFast` ownership: a `formatReport` option vs an adapter-level slice?**
   - What we know: D-04 says fail-fast is reporting-only; CONTEXT.md lists "a reporter-layer `failFast`" under discretion.
   - What's unclear: whether `formatReport` takes `failFast` (Pattern 4) or the adapter pre-slices.
   - Recommendation: put it on `formatReport` (Pattern 4) so the truncation logic is unit-testable in `core/` with hand-built diagnostics, and the adapter just passes the flag. The diagnostics are already sorted, so "first error" is the first Error-category entry in sorted order.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `typescript` | sort/dedup/host APIs | yes | 6.0.3 | -- |
| `@angular/compiler-cli` | `formatDiagnostics` | yes | 22.0.4 | -- |
| `@typescript-eslint/eslint-plugin` | `no-restricted-imports` | yes | 8.62.0 | -- |
| `@nx/eslint-plugin` | `@nx/dependency-checks` | yes | 23.0.1 | -- |
| `vitest` | unit tier | yes | 4.x | -- |

**Missing dependencies:** none. All Phase-3 APIs are already installed and verified this session.

## Validation Architecture

> nyquist_validation is enabled (no `workflow.nyquist_validation: false` in config). This section is consumed downstream to generate VALIDATION.md.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x via `@nx/vitest:test` |
| Config file | `packages/angular-typechecker/vitest.config.mts` (verified; `include: ['{src,tests}/**/*.{test,spec}.{...}']`) |
| Quick run command | `npx nx test angular-typechecker -- <file>.spec.ts` (or `rtk npx nx test angular-typechecker`) |
| Full suite command | `npx nx test angular-typechecker` |

### Test tiers used in Phase 3
- **Pure-function unit tier (PRIMARY, D-13):** hand-built `ts.Diagnostic[]` literals + a fake `Program` (the `gather-diagnostics.spec.ts` idiom). NO `@angular/compiler-cli` mock for `filterDiagnostics`/`evaluateResult`/`formatReport`. This is the direct payoff of the D-01 hybrid split.
- **Mocked-compiler / tsconfig-resolution unit tier (D-13):** only where the compiler is genuinely touched (gatherer call-order -- already covered; tsconfig-resolution shape). Use `vi.mock('@angular/compiler-cli')` or dependency injection (discretion).
- **DEFERRED to Phase 2 integration (TEST-02, already green):** real-compiler diagnostic codes/counts -- NOT re-run here.
- **DEFERRED to Phase 6 e2e (TEST-03, CI-01):** pnpm-symlink + mixed-case path assertions (the realpath/case-fold backstop), full 5-project-type matrix.

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXE-04 | in-project kept; out-of-project + node_modules suppressed; `node_modules-tools` NOT misclassified; file-less kept; `includeDeps: true` folds back | unit (pure) | `npx nx test angular-typechecker -- filter-diagnostics.spec.ts` | NO -- Wave 0 |
| OUT-02 | realpath-first + case-fold canonicalization; segment containment; `.ngtypecheck.ts` shadow kept | unit (pure, inject realpath) | `npx nx test angular-typechecker -- filter-diagnostics.spec.ts` | NO -- Wave 0 |
| EXE-03 | report-all default; fail-fast truncates REPORTED list at first Error (NOT a gather short-circuit) | unit (pure) | `npx nx test angular-typechecker -- format-report.spec.ts` | NO -- Wave 0 |
| EXE-05 | errors always fail; `maxWarnings` threshold; `maxWarnings: 0` fails on any warning; categories respected (counted upstream) | unit (pure) | `npx nx test angular-typechecker -- evaluate-result.spec.ts` | NO -- Wave 0 |
| OUT-01 | output contains NG codes + codeframes via `ng.formatDiagnostics` | unit (mock `formatDiagnostics` OR a tiny real-compiler smoke) | `npx nx test angular-typechecker -- format-report.spec.ts` | NO -- Wave 0 |
| OUT-03 | sorted alphabetical-by-file (file-less first); idempotent (same input -> byte-identical output); ANSI stripped when `color: false` | unit (pure) | `npx nx test angular-typechecker -- format-report.spec.ts` | NO -- Wave 0 |
| EXE-04/D-02 | `runTypecheck` returns FILTERED+SORTED diagnostics + `suppressedCount`; counts POST-filter | integration (real compiler, EXTEND existing) | `npx nx test angular-typechecker -- run-typecheck.integration.spec.ts` | YES (extend) |
| TEST-01 | the unit tier exists and covers gatherer/filter/resolution/modes/maxWarnings | meta (suite presence) | `npx nx test angular-typechecker` | partial -- gatherer YES, rest Wave 0 |
| WS-04 | ESLint `core/**` ban + `@nx/dependency-checks` + Prettier; lint clean | lint gate | `npx nx lint angular-typechecker` (+ `npx prettier --check`) | config exists; override Wave 0 |

### Sampling Rate
- **Per task commit:** the single new/edited spec file (e.g. `npx nx test angular-typechecker -- filter-diagnostics.spec.ts`).
- **Per wave merge:** full unit suite `npx nx test angular-typechecker` + `npx nx lint angular-typechecker`.
- **Phase gate:** full suite green + lint clean (SC5) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `packages/angular-typechecker/src/core/filter-diagnostics.spec.ts` -- covers EXE-04, OUT-02
- [ ] `packages/angular-typechecker/src/core/evaluate-result.spec.ts` -- covers EXE-05
- [ ] `packages/angular-typechecker/src/core/format-report.spec.ts` -- covers EXE-03, OUT-01, OUT-03
- [ ] EXTEND `run-typecheck.integration.spec.ts` -- assert `suppressedCount` + POST-filter counts on a fixture with an out-of-project import (D-02). May need a NEW fixture (a project importing a sibling lib via `paths`) -- keep it OUT of Nx-excluded dirs (`tmp/`/`dist/`/`cache/`), under `fixtures/`.
- [ ] ESLint `core/**` override added to `packages/angular-typechecker/eslint.config.mjs`
- [ ] Framework install: none (Vitest + ESLint plugins already present)

## Security Domain

> `security_enforcement` is not set to `false` -> enabled. Phase 3 is internal post-processing of a developer's own type-check output; it parses NO untrusted external input, has no auth/session/access-control surface, and adds no network or filesystem-write capability. The only inputs are the developer's own tsconfig and source diagnostics.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | no | -- |
| V5 Input Validation | minimal | `maxWarnings` is the only numeric input; the Phase-4 adapter (not this phase) parses/validates the CLI value. `evaluateResult` should treat a negative/NaN `maxWarnings` defensively (`undefined`-equivalent), but this is robustness, not a security boundary. |
| V6 Cryptography | no | -- |

### Known Threat Patterns for {TS/Angular diagnostic post-processing}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| ReDoS in the ANSI-strip regex | Denial of Service | The ANSI pattern `\x1b\[[0-9;]*m` is linear (bounded character class, single `*`); no catastrophic backtracking. Render output is compiler-produced, not adversarial. |
| Path-traversal misclassification (a crafted `fileName` escaping `basePath`) | Information Disclosure (showing a dep's diagnostics as in-project) | realpath + segment containment (D-06) is the correct mitigation; this is a correctness concern (a type-checker that lies), already the design center, not a new threat. |

No new SECURITY.md threat-model entries are required for Phase 3 beyond the existing core invariants; the Phase-5 PKG-04 SECURITY.md covers supply-chain.

## Risks / Landmines

1. **Prior-art landmine A -- gather short-circuit (D-04).** The reviewed prototype gated later phases on "no earlier errors" and silently dropped ALL template/extended (NG8xxx) diagnostics behind one TS error. Verified live: `defaultGatherDiagnostics` does exactly this (`chunk-6ZBSJK4S.js:609-616`). Phase 3's `failFast` MUST be a REPORTING truncation over already-gathered diagnostics, never a getter gate.
2. **Prior-art landmine B -- naive filter (D-06).** `executor.ts:135/146/151` uses `toLowerCase()` + `startsWith(projectRoot)` + `includes('node_modules')`. Breaks on (a) pnpm `.pnpm/` symlinks, (b) case-sensitive Linux CI, (c) `node_modules-tools/` substring false-positive. Use realpath-first + case-fold + path-segment containment.
3. **Prior-art landmine C -- engine fused into the adapter.** The prototype's monolithic executor was testable only through full `ExecutorContext` fakes. D-11's `core/**` import ban (now lint-enforced) prevents recurrence; keep `filterDiagnostics`/`evaluateResult`/`formatReport` pure and devkit-free.
4. **TS6059 `rootDir` trap (discretion).** A narrow `rootDir` + sibling import can fire TS6059. Verified the Phase-2 no-emit override (`noEmit` + `emitFlags: 0` + `composite: false`) neutralizes it (emit-layout diagnostic, no emit). In THIS repo `rootDir` is the workspace root (wide) anyway. Add one negative-assertion fixture as cheap insurance.
5. **Nx fixture-discovery exclusion trap.** Nx silently does NOT discover projects under `tmp/`/`dist/`/`cache/`/`build/` or anything matching `.gitignore` / `tsconfig.base.json` `exclude` (`exclude: ["node_modules","tmp"]` here). The new out-of-project filter fixture must live under `fixtures/` (a discovered location), NOT a temp/excluded dir.
6. **cwd-relative `formatDiagnostics` non-determinism (D-08).** Default host's `getCurrentDirectory()` is cwd-based; the Nx daemon vs cold run changes cwd -> non-idempotent output. Default ABSOLUTE; only relativize when `pathBase` is set. Force `getNewLine: () => '\n'` (Windows produced `\r\n` in the probe).
7. **D-05 `rootDir` correction.** Do NOT use `parsed.options.rootDir` as the baseline -- in this `--preset=apps` workspace it is the WORKSPACE ROOT (empirically `D:/.../angular-typechecker`), which would mark every file in-project. Use `parsed.options.basePath` (empirically the leaf-tsconfig dir). The planner must encode `basePath`, not `rootDir`.

## Sources

### Primary (HIGH confidence -- verified this session against INSTALLED sources)
- `node_modules/typescript/lib/typescript.d.ts:8574` -- `sortAndDeduplicateDiagnostics` PUBLIC API.
- `node_modules/typescript/lib/typescript.js:21814-21823, 3418-3419, 14669-14670` -- comparator sort key, file-less-first ordering, sort/dedup wiring.
- `node_modules/@angular/compiler-cli/bundles/chunk-6ZBSJK4S.js:436-454, 456-503, 600-621` -- `defaultFormatHost` (identity + cwd), `formatDiagnostics` (always color), `calcProjectFileAndBasePath`/`readConfiguration` (basePath injection), `defaultGatherDiagnostics` short-circuit.
- `node_modules/@angular/compiler-cli/bundles/chunk-QY6RCOQ6.js:140-145` -- `replaceTsWithNgInErrors` (TS->NG, no ANSI strip), `ngErrorCode`.
- `node_modules/@angular/compiler-cli/src/transformers/api.d.ts:122-128` -- `Program.getTsProgram(): ts.Program`.
- `node_modules/@typescript-eslint/eslint-plugin/dist/rules/no-restricted-imports.js:23-40, 148-177` -- `allowTypeImports` opt-in (type-only banned by default).
- `node_modules/@nx/eslint-plugin/dist/src/rules/enforce-module-boundaries.js:156-168, 262-268` -- project/tag granularity, same-project early return.
- Live probe (this session) -- `parsed.options.rootDir = D:/.../angular-typechecker` (workspace root), `parsed.options.basePath = D:/.../apps/ng-spike-app` (leaf dir), diagnostic `fileName` absolute+forward-slash, `formatDiagnostics` emits `[91m` ANSI with `\r\n`.
- Repo files -- `.prettierrc` (`singleQuote: true`), `packages/angular-typechecker/eslint.config.mjs` (`@nx/dependency-checks` wired), `tsconfig.base.json:4` (`rootDir: "."`), `apps/ng-spike-app/tsconfig*.json` (extends chain).

### Secondary (the prior-art landmine catalog, read-only)
- `D:/projects/sandbox/nx19-8-angular18-2-esbuild-playwright-storybook/libs/nx-plugin/src/executors/angular-typecheck/executor.ts:135,143,146,151` -- the naive `toLowerCase()`/`startsWith`/`includes('node_modules')` filter (landmine B), confirmed verbatim.

### Tertiary (CONTEXT.md <canonical_refs> external URLs -- not re-fetched; local sources took priority per task instruction)
- Brandon Roberts compilation-bottlenecks article, angular.dev extended-diagnostics, Nx enforce-module-boundaries docs, ESLint CLI exit codes -- all confirmation-only for already-locked decisions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new deps; all APIs verified present at the locked versions.
- Architecture (filter/verdict/format split + wiring): HIGH -- the live `Program` host, `basePath`, sort key, and always-color renderer all verified empirically.
- Pitfalls: HIGH -- the gather short-circuit, naive filter, and cwd-relativization are all confirmed in source; A1 (absolute-path host sentinel) is the one LOW-risk implementation detail flagged for an implementation-time probe.

**Research date:** 2026-06-28
**Valid until:** ~2026-07-28 (stable -- locked stack pins typescript@6.0.3 / @angular/compiler-cli@22.0.4; re-verify only if those peers move).
