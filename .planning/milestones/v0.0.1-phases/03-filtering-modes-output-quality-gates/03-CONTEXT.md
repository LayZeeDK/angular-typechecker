# Phase 3: Filtering, Modes, Output + Quality Gates - Context

**Gathered:** 2026-06-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the framework-agnostic core CONTRACT on top of the Phase-2 engine: project-boundary filtering (`includeDeps`), report-all (default) vs opt-in fail-fast modes, `--max-warnings` gating, and `formatDiagnostics` human output -- all operating on the structured `CoreResult` -- plus the lint/format quality gates (ESLint + Prettier + `@nx/dependency-checks` + module-boundary enforcement) that lock the `core/` vs adapter split.

Requirements covered: EXE-03, EXE-04, EXE-05, OUT-01, OUT-02, OUT-03, TEST-01, WS-04.

This phase clarifies HOW to implement what is already scoped. The unconditional all-getter gatherer (ENG-02, Phase-1 D-16), the memoized `await import()` loader, the `CoreResult` category-counting contract (Phase-2 D-01), the no-emit override (Phase-2 D-05), and `module: nodenext` are LOCKED and NOT re-decided here. The Nx executor adapter / cacheable target (Phase 4), packaging (Phase 5), and the full e2e matrix (Phase 6) are OUT of scope.
</domain>

<decisions>
## Implementation Decisions

All decisions are research-backed: seven parallel research passes against the local `@angular/compiler-cli`, `@angular/build`, and TypeScript 6.0.3 sources, the Nx clone, the published reference plugins, prior-art prototypes (treated as inspiration only -- see Code Context), and the external docs/article/community sweep. Net across all sources: **no recommendation was reversed**; the consumption baseline (`@angular/build`) and `tsc --noEmit` triangulated the output decisions. Citations in `<canonical_refs>`.

### Composition & API (EXE-03/04/05, OUT-01/02/03, TEST-01)

- **D-01: Hybrid composition.** Project-boundary filtering runs INSIDE `runTypecheck` (driven by a new `includeDeps?: boolean` `CoreOption`); the pass/fail verdict (`evaluateResult`) and the human formatter (`formatReport`) are SEPARATE PURE functions exported from `core/`, composed by the Phase-4 adapter. `runTypecheck` remains the only `@angular/compiler-cli`-touching seam. This mirrors `@angular/build` exactly -- it filters (`ignoreForDiagnostics`) and buckets by category INSIDE the compilation, but the verdict is the caller's and rendering is a separate concern -- and `tsc`'s own internals (collect -> format -> summarize). It is the only shape where TEST-01's filter / modes / `--max-warnings` are unit-testable with hand-built `ts.Diagnostic[]` literals and NO `@angular/compiler-cli` mock.
- **D-02: `CoreResult` holds FILTERED diagnostics + a `suppressedCount` scalar.** After filtering, `CoreResult.diagnostics` = in-project diagnostics only; `errorCount`/`warningCount` are counted POST-filter (extends Phase-2 D-01 category counting); add `suppressedCount: number` = count of excluded out-of-project + `node_modules` diagnostics. `includeDeps: true` folds those back into `diagnostics` (and `suppressedCount` -> 0). Do NOT retain a full raw / `outOfProject[]` array. Rationale (correct + fast + scalable): the executor is per-project and Nx-cacheable, so each `runTypecheck` call is bounded by ONE project and the workspace scales via Nx orchestration + caching across hundreds of independent runs -- the result must be lean and per-project. Re-enumerating a dependency's diagnostics across every consumer target is redundant (the dependency has its OWN target) and noisy; the scalar keeps the report HONEST (OUT-03: "PASS -- N dependency diagnostics suppressed; run with `includeDeps` to see them"). 0.x semver permits non-destructively widening with an optional `outOfProject[]` later if a reporter ever needs enumeration.
- **D-03: Verdict is a pure `evaluateResult(result, { maxWarnings }) -> { success }` in `core/`.** Errors ALWAYS fail; `warningCount > maxWarnings` fails; `maxWarnings: 0` fails on ANY warning -- all on POST-filter counts (project-configured `extendedDiagnostics` categories respected via Phase-2 D-01 category counting). The Phase-4 adapter calls it and maps to `{ success }` / a clear non-zero exit (stays sub-50 lines). Config-error diagnostics (Phase-2 D-03) and the zero-rootNames guard (`file: undefined`) are NEVER filtered.

### Fail-fast modes (EXE-03)

- **D-04: Fail-fast is REPORTING-ONLY, never a gather short-circuit.** The unconditional all-getter (ENG-02, Phase-1 D-16) ALWAYS runs every getter; `runTypecheck` takes NO `failFast` flag. Fail-fast is a post-gather/reporting concern: truncate the REPORTED list at the first Error-category diagnostic. Grounded: `NgtscProgram` construction is setup-only; the dominant cost is lazy INSIDE the getters, so the only way to make fail-fast "faster" is to skip getters -- which is precisely `ngc`'s `defaultGatherDiagnostics` `&&`-short-circuit that suppresses `getNgSemanticDiagnostics` (template + extended NG8xxx) once a TS error exists, the exact failure mode this tool exists to avoid. Confirmed in real prior art: a prototype shipped that short-circuit and silently dropped ALL template/extended diagnostics behind a single co-located TS error. Document fail-fast as "output brevity / early signal, NOT a speed-up."

### Project-boundary filtering & path base (EXE-04, OUT-02)

- **D-05: In-project baseline = the leaf tsconfig's `basePath`.** A diagnostic is in-project iff its canonical-realpath `fileName` is under the canonical-realpath `basePath` (the directory `ng.readConfiguration` always injects via `calcProjectFileAndBasePath`). NOT `rootDir`/`rootDirs`: the `@nx/angular` / `@nx/js` library + application tsconfig templates do NOT set `rootDir` (Nx's own generator tests assert it absent), so `parsed.options.rootDir` is `undefined` in the common case -- unusable as the baseline. A `paths`-resolved sibling project (the `main-lib` -> `dependency-lib` scenario) lands in a sibling directory OUTSIDE `basePath` -> filtered by default; `includeDeps: true` surfaces it.
- **D-06: Filter on absolute, realpath-normalized `fileName` via the program host's `getCanonicalFileName` + `realpath`** (pnpm-symlink + case-insensitive-FS safe), NEVER naive string-prefix / `toLowerCase()` (breaks on pnpm `.pnpm/` symlinks and on case-sensitive Linux CI). Exclude `node_modules` by a path-SEGMENT test, NOT substring `.includes('node_modules')` (which misclassifies a dir like `node_modules-tools`). The filter runs AFTER `performCompilation` returns, against `result.program.getTsProgram()`'s host -- NOT inside `gatherAllDiagnostics` (the gatherer stays "gather ALL"; filtering is a separate, testable pass).
- **D-07: `includeDeps` and `skipLibCheck` are ORTHOGONAL.** `includeDeps` (default false) governs OUR boundary filter: false -> both out-of-project workspace sources AND `node_modules` paths are excluded from the reported set; true -> boundary filter off. `skipLibCheck` is the consumer's tsconfig option, HONORED VERBATIM (Phase-2 D-05b), independently governing whether `node_modules` `.d.ts` diagnostics are even generated. So `includeDeps: true` surfaces sibling-project source errors immediately and surfaces `node_modules` typings errors only to the depth `skipLibCheck` already allows. No second severity knob; no fighting the consumer's config.
- **D-08: CI-relative paths via an optional `pathBase` `CoreOption` consumed ONLY by the formatter.** `formatDiagnostics`'s `ts.FormatDiagnosticsHost.getCurrentDirectory()` sets the relativization base; its `getCanonicalFileName` must NOT be identity (compiler-cli's `defaultFormatHost` uses identity -- wrong for case normalization), so pass OUR host built from `pathBase`. When `pathBase` is unset, default to ABSOLUTE paths (deterministic) -- NOT cwd-relative (cwd differs with/without the Nx daemon -> non-deterministic, breaking OUT-03 idempotency). The Phase-4 adapter fills `pathBase` from `context.root`; the core never reads it, preserving framework-agnostic purity.

### Output formatting & determinism (OUT-01, OUT-03)

- **D-09: File-grouped output via `ts.sortAndDeduplicateDiagnostics`** (the public TS API, verified in `typescript@6.0.3`) applied to the gathered set before counting/formatting. Sort key = file -> `start` -> `length` -> `code` -> messageText (file-less option/config/guard diagnostics sort first). This matches `tsc --noEmit` EXACTLY and delivers the file-grouped gestalt `@angular/build` users already expect (a file's TS + template diagnostics adjacent) -- but with DETERMINISTIC alphabetical file order rather than `@angular/build`'s program/source-file iteration order (which can shift with the module graph), satisfying OUT-03 "deterministic, idempotent, agent-ready." DEDUP is a correctness safety net unique to our design: we run the all-getter UNCONDITIONALLY (no `ngc` short-circuit), so we are more dup-prone than `ngc`/`@angular/build`; tsc's dedup removes accidental cross-phase duplicates. Render each diagnostic via compiler-cli `formatDiagnostics` (NG codes + template codeframes, OUT-01). Net: `@angular/build`-grade file grouping + `ngc`-grade rendering + `tsc`-grade determinism/dedup. SINGLE stream for v0.0.1.
- **D-10: TTY-gated color; plain (ANSI-stripped) default for non-TTY (CI / agents / pipes), color interactively.** Confirmed by BOTH consumption baselines: `tsc` TTY-gates color, and `@angular/build` renders via esbuild (also TTY/`color`-gated). Only `ngc`'s `formatDiagnostics` is the outlier -- it calls `ts.formatDiagnosticsWithColorAndContext` UNCONDITIONALLY (always color). Since OUT-01 locks the renderer to compiler-cli's `formatDiagnostics`, the implementation strips ANSI when stdout is not a TTY. The clear non-zero EXIT on diagnostics (OUT-03) is the adapter's responsibility (Phase 4).

### Quality gates: lint/format + module boundary (WS-04)

- **D-11: Module-boundary enforcement via ESLint `@typescript-eslint/no-restricted-imports` scoped to `src/core/**`** (flat-config `files`override), banning`@nx/devkit`, `nx`, `@angular-devkit/architect`(+`@nx/_`/`@angular-devkit/_`family patterns) and`yargs`-- INCLUDING type-only imports (core defines its own types). Single published package; NOT`@nx/enforce-module-boundaries`(Nx-docs-confirmed project/tag-granular: "cannot restrict imports between folders inside the same project"; enforcing the intra-package`core/`ban with it would require splitting`core/`into a second Nx project, contradicting the single-package design and the`core/`-as-subdir layout). Also forbid `process.exit`and`console`/`logger`in`core/\*\*` so the verdict/format functions stay pure. Specifier ban ONLY; defer the directory-zone rule (`import/no-restricted-paths`) unless internal coupling actually appears.
- **D-12: `@nx/dependency-checks` is already enabled and is ORTHOGONAL** to the boundary (it validates the published `package.json` deps -- and WANTS `core/` + adapter in one project so the adapter's `@nx/devkit` import is a legitimately-declared dependency). Prettier `singleQuote: true` is already present. Phase 3 adds only the `no-restricted-imports` `core/**` override; lint must pass clean (SC5).

### Unit tests (TEST-01)

- **D-13: Mock `@angular/compiler-cli` only where the compiler is genuinely touched** (the gatherer + tsconfig-resolution path); test `filterDiagnostics` / `evaluateResult` / `formatReport` as PURE functions with hand-built `ts.Diagnostic[]` literals and a fake `Program` -- no compiler mock. This pure-function testability is the direct payoff of the D-01 hybrid split. Phase 2 owns the real-compiler integration tier (TEST-02); Phase 3 adds the mocked unit tier covering gatherer, project-boundary filtering, tsconfig resolution, modes, and `--max-warnings` logic.

### Claude's Discretion

- Exact option names (`includeDeps`, `maxWarnings`, `pathBase`; a reporter-layer `failFast`), module/file names (e.g. `filter-diagnostics.ts`, `evaluate-result.ts`, `format-report.ts`), the ANSI-strip mechanism, the fail-fast truncation detail (truncate-only vs a "N more suppressed" footer), the first-error ordering, and the precise mock strategy (`vi.mock` vs dependency injection).
- **Scale implementation:** memoize canonicalized directory paths in the boundary filter (a cache, NOT a `realpath()` syscall per diagnostic) -- a hot path at thousands of components across hundreds of projects.
- Verify the no-emit override (Phase-2 D-05) neutralizes the `rootDir` -> TS6059 ("file is not under rootDir") trap that can arise when a leaf tsconfig pulls in sibling files; add a fixture if it can still fire.
  </decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 3 spec + scope (this repo)

- `.planning/PROJECT.md` -- locked stack, dependency model, module format, engine approach, Key Decisions.
- `.planning/REQUIREMENTS.md` -- EXE-03/04/05, OUT-01/02/03, TEST-01, WS-04 (the Phase 3 set).
- `.planning/ROADMAP.md` Phase 3 section -- goal + 5 success criteria.

### Phase 1/2 carry-forwards (this repo) -- MUST read; Phase 3 builds on these

- `.planning/phases/02-core-type-check-engine-gatherer/02-CONTEXT.md` -- D-01 `CoreResult` + category counting (extended by Phase-3 D-02), D-05 no-emit override, D-06 infra-failure re-throw, D-03 config-error/zero-rootNames handling.
- `.planning/phases/01-workspace-bootstrap-engine-spike-gated/01-CONTEXT.md` -- D-16 gatherer getter order (the all-getter Phase-3 D-04 must never short-circuit).
- `.planning/STATE.md` Accumulated Context.

### Project research (this repo)

- `.planning/research/ARCHITECTURE.md` -- core/adapter split, proposed `src/core/` tree (`filter-diagnostics.ts`, `report/format-human.ts`, `internal/exit-code.ts`). CAVEATS: lines ~314/~376 are STALE on dependency classification (PROJECT.md authoritative); line ~240 ("fail-fast = stop the generator on the first error") and ~177 (`DiagnosticModes` bitflag as the fail-fast mechanism) are MISLEADING -- contradicted by Phase-3 D-04 (fail-fast is reporting-only, the gather never short-circuits); lines ~60/116/283 fold `--max-warnings` counting into the filter -- counting lives in `runTypecheck`/`finalize`, `--max-warnings` is a verdict input (D-03).
- `.planning/research/FEATURES.md` -- "keep the formatting step at the edge" (~110), GAP-1 path-format / GAP-2 structured-at-boundary (~192-217), fail-fast/report-all/`--max-warnings`/`formatDiagnostics` rows.
- `.planning/research/PITFALLS.md` -- Pitfall 2 (`formatDiagnostics` cwd-relative), Pitfall 3 (pnpm/symlink/case-insensitive boundary filtering), anti-pattern tables.
- `.planning/research/FOLLOWUP-FINDINGS.md` -- realpath-normalized `fileName` + workspace-root-relative annotations (~23); module-boundary note (~40).
- `.planning/research/DIAGNOSTIC-CATALOG.md` -- the `main-lib` -> `dependency-lib` dependency-filtering scenario (~55) the D-05 baseline must satisfy.

### Current core source (this repo) -- Phase 3 grows it in place

- `packages/angular-typechecker/src/core/run-typecheck.ts` -- `runTypecheck` + `CoreResult` + `finalize` counting (extend with the filter call + `suppressedCount`; add `includeDeps`/`pathBase` to `CoreOptions`).
- `packages/angular-typechecker/src/core/gather-diagnostics.ts` -- the unconditional all-getter (keep; filtering is a SEPARATE pass after `performCompilation`, D-06).
- `packages/angular-typechecker/src/core/diagnostic-codes.ts` -- `NG()` / `ngCodeOf()` helpers (reuse).
- `packages/angular-typechecker/src/core/compiler-loader.ts`, `compiler-cli-types.ts` -- memoized ESM load + nodenext-safe type shim.
- `packages/angular-typechecker/eslint.config.mjs` + root `eslint.config.mjs` + `.prettierrc` -- where the `no-restricted-imports` `core/**` override (D-11) lands; `@nx/dependency-checks` already enabled (D-12).

### External reference sources (absolute paths, read-only; re-validate against installed `@angular/compiler-cli@22.0.4` / `typescript@6.0.3`)

- `D:/projects/github/angular/angular/packages/compiler-cli/src/perform_compile.ts` -- `formatDiagnostics` (32-45, uses `formatDiagnosticsWithColorAndContext` -> always color; `defaultFormatHost.getCanonicalFileName` identity, 26-28), `defaultGatherDiagnostics` phase-order + `&&`-short-circuit (328-362), `calcProjectFileAndBasePath`/`basePath` (62-73, 138-157), `readConfiguration`, `exitCodeFromResult`/`hasErrors`.
- `D:/projects/github/angular/angular-cli/packages/angular/build/src/tools/angular/compilation/aot-compilation.ts` -- `collectDiagnostics` PER-FILE order over `getSourceFiles()` (225-296). `.../angular-compilation.ts` -- `diagnoseFiles` converts each via `convertTypeScriptDiagnostic` and SPLITS errors/warnings (88-109); `DiagnosticModes` (22-28) is `@angular/build`'s subset selector, ALWAYS `All` in `diagnoseFiles` -- NOT a fail-fast mechanism. `.../esbuild/angular/diagnostics.ts` -- `convertTypeScriptDiagnostic` (ts.Diagnostic -> esbuild `PartialMessage`, TTY-gated color via esbuild).
- TypeScript `6.0.3` (installed): `node_modules/typescript/lib/typescript.js` -- `sortAndDeduplicateDiagnostics` (CLI report path `emitFilesAndReportErrors`), `compareDiagnosticsSkipRelatedInformation` sort key = file -> start -> length -> code -> messageText; `node_modules/typescript/lib/typescript.d.ts:8574` -- `sortAndDeduplicateDiagnostics` is PUBLIC API (reuse it).
- `D:/projects/github/nrwl/nx/packages/eslint-plugin` -- `enforce-module-boundaries` rule (project/tag granularity; `findProject(sourceFilePath)` -> `hasTag(sourceProject, sourceTag)`; `bannedExternalImports`/`depConstraints` are per-source-project-TAG); `@nx/dependency-checks` rule. `D:/projects/github/nrwl/nx/eslint.config.mjs` -- the `no-restricted-imports` `paths`/`patterns` idiom to mirror.
- `D:/projects/github/push-based/nx-verdaccio` -- real published Nx plugin (single project; LEGACY `.eslintrc.json` -- do NOT copy its config shape for this Nx 23 flat-config repo). `D:/projects/github/analogjs/analog/packages/nx-plugin` -- single-project plugin layout.
- `D:/projects/sandbox/nx19-8-angular18-2-esbuild-playwright-storybook` (Angular 18.2 prior prototype, PUBLIC; version-bound, inspiration only) -- `libs/nx-plugin/src/executors/angular-typecheck/executor.ts` (monolithic executor, naive `toLowerCase()`+`startsWith` filter, no core/adapter split); `INTEGRATION-TESTING-LEARNINGS.md` (Nx fixture-discovery exclusion trap; Vitest-over-Jest ESM rationale).

### External docs / article / community (URLs; the OUT-\* + fail-fast confirmation pass)

- Brandon Roberts, "Angular Compilation, Type-Checking, and Build Bottlenecks" (2026-06-26) -- https://brandonroberts.dev/blog/posts/angular-compilation-type-checking-and-build-bottlenecks-4n2f (type-check is the dominant SEPARABLE build cost; fast compilers skip it = the gap this tool closes; confirms report-all is the contract, fail-fast is not a speed-up).
- Angular extended diagnostics (NG8xxx default to WARNING severity) -- https://angular.dev/extended-diagnostics ; template type-check -- https://angular.dev/tools/cli/template-typecheck ; compiler options -- https://angular.dev/reference/configs/angular-compiler-options
- Nx `@nx/enforce-module-boundaries` (project/tag-granular; cannot restrict folders within one project) -- https://nx.dev/features/enforce-module-boundaries ; configure inputs (`{projectRoot}`/`{workspaceRoot}`) -- https://nx.dev/recipes/running-tasks/configure-inputs
- ESLint CLI (exit codes 0/1/2, `--max-warnings`) -- https://eslint.org/docs/latest/use/command-line-interface ; GitHub Actions problem matchers resolve paths vs `$GITHUB_WORKSPACE` (workspace-root-relative) -- justifies `pathBase` (D-08).
- Peer "check" tools (report-all is the contract; no fail-fast-for-speed): `svelte-check` (`--output machine-verbose` thin JSON layer; `--fail-on-warnings`) -- https://www.npmjs.com/package/svelte-check ; `vue-tsc` -- https://www.npmjs.com/package/vue-tsc
  </canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- The entire Phase-2 `core/` is the seed Phase 3 grows IN PLACE (not a rewrite): `run-typecheck.ts` (`finalize` category counting -> extend with the filter pass + `suppressedCount`; `CoreOptions` -> add `includeDeps`/`pathBase`), `gather-diagnostics.ts` (the all-getter -- unchanged; filtering is a separate post-`performCompilation` pass), `diagnostic-codes.ts` (`NG()`/`ngCodeOf()` reuse), `compiler-loader.ts` + `compiler-cli-types.ts`.
- `ts.sortAndDeduplicateDiagnostics` (public TS API) -- reuse directly for D-09 ordering; do NOT hand-roll a comparator.

### Established Patterns

- Framework-agnostic core, ZERO `@nx/devkit`/CLI imports; single seam `runTypecheck(CoreOptions): Promise<CoreResult>`; `module: nodenext` CJS build with the `import(` survival invariant (GATE A). Phase 3's new pure functions (`filterDiagnostics`/`evaluateResult`/`formatReport`) preserve the zero-devkit invariant -- now LINT-ENFORCED (D-11).

### Integration Points

- `runTypecheck` consumes `CoreOptions` and returns the filtered `CoreResult`. The Phase-4 executor adapter composes `runTypecheck` + `evaluateResult` + `formatReport`, fills `pathBase` from `context.root`, and maps to `{ success }` / exit -- staying sub-50 lines.

### Prior-art learnings (sanitized; inspiration only -- older deps, NOT reference implementations)

- The reference compilers + reviewed prototypes confirm three landmines Phase 3 must avoid: (1) NEVER short-circuit the gather -- a prototype that gated later phases on "no earlier errors" silently dropped all template/extended (NG8xxx) diagnostics behind one TS error (D-04); (2) naive `toLowerCase()` / `startsWith` / substring `node_modules` filtering breaks on pnpm symlinks + case-sensitive Linux CI (D-05/D-06 realpath + path-segment); (3) fusing the engine into the Nx adapter makes it testable only through full `ExecutorContext` fakes -- the core/adapter import-ban (D-11) prevents that.
- Nx fixture-discovery trap (from the prototype's testing learnings): Nx silently does NOT discover projects under `tmp/`/`dist/`/`cache/`/`build/` or anything matching `.gitignore` / `tsconfig.base.json` `exclude`. Keep Phase-3 unit fixtures out of excluded directories.
  </code_context>

<specifics>
## Specific Ideas

- `CoreResult` gains `suppressedCount: number`; `CoreOptions` gains `includeDeps?: boolean` and `pathBase?: string` (D-02/D-07/D-08).
- Output ordering = `ts.sortAndDeduplicateDiagnostics` (file -> start -> length -> code -> messageText, with dedup), rendered via compiler-cli `formatDiagnostics`, ANSI-stripped when stdout is not a TTY (D-09/D-10).
- Boundary filter: in-project = under leaf-tsconfig `basePath`, realpath + `getCanonicalFileName` normalized, `node_modules` excluded by path-segment; run AFTER `performCompilation` against `result.program.getTsProgram()` host (D-05/D-06).
- Lint: `@typescript-eslint/no-restricted-imports` on `src/core/**` banning `@nx/devkit`/`nx`/`@angular-devkit/architect`/`yargs` incl. type-only, plus `process.exit`/`console` (D-11).
  </specifics>

<deferred>
## Deferred Ideas

All deferrals are roadmap-scoped or out-of-milestone (NOT new in-phase capabilities):

- **Quiet / errors-only output mode** -- NOT in v0.0.1 requirements; the naive form suppresses NG8xxx (extended diagnostics are WARNING severity), killing the differentiator. If ever added, gate suppression on diagnostic code/source, never bare category. Deferred (scope discipline).
- **Errors/warnings split into two streams + structured per-diagnostic category** -- `@angular/build` does this via esbuild; defer to the future JSON/SARIF reporter (REP-01). v0.0.1 ships a single sorted stream.
- **`outOfProject[]` enumeration in `CoreResult`** -- only if a reporter needs to list suppressed dependency diagnostics; non-destructive 0.x widening later.
- **`import/no-restricted-paths` directory-zone enforcement** (core/ may not import the adapter directory) -- only if internal coupling appears; the D-11 specifier ban suffices for WS-04.
- **Nx executor adapter, `schema.json`, normalize-options, cacheable target inputs, exit-code mapping, dependency-error-busts-cache test** -> Phase 4 (EXE-01/06/07, TEST-04). `pathBase` <- `context.root` and the `{ success }`/exit mapping are realized there.
- **Buildable + publishable library fixtures, the full 5-project-type matrix, pnpm + mixed-case path assertions** -> Phase 6 e2e (TEST-03, CI-01) -- the backstop for the realpath/case-insensitive filtering (D-06).
- **`NgtscProgram` per-file (`OptimizeFor.SingleFile`) incremental + `--watch`** -> deferred milestone (REP-02); the only path to a genuinely faster check, and a separate mechanism from fail-fast.

None of the discussion drifted outside the Phase 3 boundary.
</deferred>

---

_Phase: 3-Filtering, Modes, Output + Quality Gates_
_Context gathered: 2026-06-28_
