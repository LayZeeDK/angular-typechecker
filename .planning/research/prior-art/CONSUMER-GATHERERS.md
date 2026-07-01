# Consumer Gatherers (AnalogJS fastCompile, @nx/js) vs Ours

Corroboration pass for the primary `@angular/build` analysis. Scope: how two other
real consumers gather Angular/TS diagnostics, and what (if anything) is adoptable for our
CURRENT whole-program engine. Deferred features are out of scope.

Our engine (ground truth):

- Gatherer: `packages/angular-typechecker/src/core/gather-diagnostics.ts:15-28` --
  `gatherAllDiagnostics(program)` pushes, in order, ALL six getters on the public Angular
  `api.Program`: `getTsOptionDiagnostics`, `getNgOptionDiagnostics`,
  `getTsSyntacticDiagnostics`, `getTsSemanticDiagnostics`, `getNgStructuralDiagnostics`,
  `getNgSemanticDiagnostics`. Whole-program (no source-file arg, no per-file loop). Passed
  as `performCompilation`'s `gatherDiagnostics`.
- Result/counting: `run-typecheck.ts:35-54` `CoreResult` =
  `{ tsConfigPath, rootNamesCount, diagnostics, errorCount, warningCount, suppressedCount, durationMs }`.
  Error/Warning counted EXPLICITLY by `ts.DiagnosticCategory` POST-filter+sort
  (`run-typecheck.ts:322-327`); Suggestion/Message stay inspectable but uncounted.
  Config errors (`parsed.errors`) folded in (`:110`), never dropped. Zero-rootNames guard
  (`:117-130`). UNKNOWN_ERROR_CODE(500) re-thrown as `TypecheckInfrastructureError`
  (`:171-179`).

---

## AnalogJS vite-plugin-angular gatherer

File: `D:/projects/github/analogjs/analog/packages/vite-plugin-angular/src/lib/angular-vite-plugin.ts`

Core gatherer `getDiagnosticsForSourceFile` (lines 1749-1772):

```
1755  const syntacticDiagnostics = program.getSyntacticDiagnostics(sourceFile);
1757  if (disableTypeChecking) { return syntacticDiagnostics; }   // syntax-only fast path
1763  const semanticDiagnostics = program.getSemanticDiagnostics(sourceFile);
1764  const angularDiagnostics = angularCompiler
1765    ? angularCompiler.getDiagnosticsForFile(sourceFile, 1)     // 1 == OptimizeFor.SingleFile
1766    : [];
1767  return [ ...syntacticDiagnostics, ...semanticDiagnostics, ...angularDiagnostics ];
```

- Families gathered (per file): TS syntactic + TS semantic + Angular
  `getDiagnosticsForFile(sf, OptimizeFor.SingleFile)` (template type-check + extended
  NG8xxx for that one file). `program` here is a `ts.BuilderProgram`, `angularCompiler` is
  `NgtscProgram['compiler']`.
- Per-file, NOT whole-program. Invoked once per source file via `getFileMetadata` ->
  `getDiagnosticsForSourceFile` (call site `:1715`). The plugin is a Vite transform that
  processes one module at a time; `buildEnd` (`:363-376`) aggregates every file's
  diagnostics so a single errored file no longer aborts the build (comment `:363-371`).
- SingleFile rationale (CONFIRMED at code level): the literal `1` is
  `OptimizeFor.SingleFile`. Angular's `OptimizeFor` (public API:
  `WholeProgram = 0`, `SingleFile = 1`) tells the template type-checker how to amortize
  type-check-block (TCB) generation. The Vite plugin only ever has ONE file in hand per
  `transform`, so `SingleFile` is the correct/optimal choice -- `WholeProgram` would
  eagerly generate TCBs for the entire program on the first file (wasteful when you call
  per file). This is the inverse of our situation: we hold the whole program and report
  once, so whole-program getters are correct for us.
- Deliberately EXCLUDED: NO option getters (`getTsOptionDiagnostics` /
  `getNgOptionDiagnostics`), NO `getNgStructuralDiagnostics`, NO global diagnostics, NO
  tsconfig parse-error surfacing in this gatherer. (Option/structural diagnostics are
  program-wide, not per-file; surfacing them per file would duplicate them across every
  file.) Config errors are handled elsewhere in the plugin's setup, not in this function.
- Warnings: separated by `ts.DiagnosticCategory.Warning` vs `.Error` at the call site
  (`:1722-1728`), mapped to formatted strings. Suggestion/Message categories are dropped
  (only Error + Warning buckets exist).

## @nx/js run-type-check.ts

File: `D:/projects/github/nrwl/nx/packages/js/src/utils/typescript/run-type-check.ts`

`runTypeCheck` (lines 84-120):

```
103  program = ts.createProgram(config.fileNames, compilerOptions);   // (or createIncrementalProgram, :94)
106  const result = program.emit();
108  const allDiagnostics = options.ignoreDiagnostics ? []
110    : ts.getPreEmitDiagnostics(program as Program).concat(result.diagnostics);
112  return getTypeCheckResult(ts, allDiagnostics, workspaceRoot,
117    config.fileNames.length,            // inputFilesCount
118    program.getSourceFiles().length,    // totalFilesCount
       incremental);
```

- Families gathered: PLAIN TypeScript only. `ts.getPreEmitDiagnostics(program)` =
  options + global + syntactic + semantic + config-file-parse + (for noEmit, declaration)
  diagnostics across ALL files, concatenated with `program.emit().diagnostics`. NO Angular
  template / structural / extended (NG8xxx) diagnostics -- `@nx/js`'s typecheck is the
  generic JS/TS `tsc` path, which (per CLAUDE.md) Angular projects cannot use anyway.
- Whole-program (no per-file loop; `getPreEmitDiagnostics` is called with no `sourceFile`
  arg, so it covers the entire program).
- Result shape (`TypeCheckResult`, :8-14):
  `{ warnings?: string[]; errors?: string[]; inputFilesCount; totalFilesCount; incremental }`.
  Note `errors`/`warnings` are FORMATTED STRINGS (with code frames), not raw
  `ts.Diagnostic[]` -- this is a reporter-shaped result, unlike our raw-diagnostic
  `CoreResult`.
- Counting (`getTypeCheckResult`, :156-179): Error and Warning filtered EXPLICITLY by
  `ts.DiagnosticCategory.Error` / `.Warning` (`:165`,`:169`) -- same explicit-category
  discipline as ours, never `total - errors`. Suggestion/Message are not counted (only
  Error + Warning buckets produced); the formatter (`:204-210`) can RENDER
  Suggestion/Message as "suggestion"/"info" but the result object never carries them.
- File counts: `inputFilesCount = config.fileNames.length` (the tsconfig's resolved root
  file list -- our `rootNamesCount` analog) and `totalFilesCount =
program.getSourceFiles().length` (EVERY source file the program pulled in: roots + all
  transitively imported `.ts`/`.d.ts` incl. lib + node_modules). The pair gives a
  root-vs-total spread.
- Config-error handling: `setupTypeScript` (:122-154) reads the tsconfig and, if
  `config.errors.length`, THROWS `new Error('Invalid config file due to following: ...')`
  (`:127-130`) -- it aborts rather than folding config errors into the diagnostic set.
- Fatal/program errors: none isolated -- a throw from `createProgram`/`emit` propagates.
- `skipLibCheck: true` is FORCED (`:147`), and `composite: false` + `noEmit: true` in
  noEmit mode (`:143`) -- mirrors our emit-neutralizing override.

## Comparison table

| Dimension                 | Ours (angular-typechecker)                                                             | AnalogJS vite-plugin-angular                                                               | @nx/js run-type-check                                                                            |
| ------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Families gathered         | TS option+syntactic+semantic AND Ng option+structural+semantic (all 6 getters)         | TS syntactic+semantic + Ng `getDiagnosticsForFile` (template+NG8xxx). NO option/structural | Plain TS via `getPreEmitDiagnostics` + `emit()` diags. NO Angular diagnostics                    |
| Per-file vs whole-program | Whole-program (one pass, no sourceFile arg)                                            | Per-file (`OptimizeFor.SingleFile`=1), aggregated at `buildEnd`                            | Whole-program (`getPreEmitDiagnostics`, no sourceFile arg)                                       |
| Result shape              | Raw `ts.Diagnostic[]` + counts + `rootNamesCount` + `suppressedCount` + `durationMs`   | `{ errors, warnings }` as formatted strings (+ hmr fields), per file                       | `{ errors, warnings }` formatted strings + `inputFilesCount` + `totalFilesCount` + `incremental` |
| Config-error handling     | Folds `parsed.errors` into diagnostics; never drops (`:110`); zero-rootNames guard     | Not in the gatherer (handled in plugin setup elsewhere)                                    | THROWS on `config.errors.length` (`:127-130`) -- aborts, not folded                              |
| Warning counting          | Explicit `category === Warning` post-filter+sort (`:325`)                              | Explicit `category === Warning` at call site (`:1726`)                                     | Explicit `category === Warning` (`:169`)                                                         |
| Fatal-error handling      | Detect UNKNOWN_ERROR_CODE(500) -> re-throw `TypecheckInfrastructureError` (`:171-179`) | None (build proceeds; per-file failures isolated by aggregation)                           | None (createProgram/emit throw propagates)                                                       |

## Adoptable learnings

1. **[ergonomics] Add a `totalFilesCount` companion to `rootNamesCount` in `CoreResult`.**
   `@nx/js` reports BOTH `inputFilesCount` (= our `rootNamesCount`, the tsconfig root file
   list) and `totalFilesCount = program.getSourceFiles().length` (every file the program
   actually loaded, incl. transitively imported + lib + node_modules `.d.ts`). For a
   type-checker this is cheap diagnostics-of-the-checker: the root-vs-total spread tells an
   operator how much the program ballooned (e.g. an unexpectedly huge total hints at a
   missing `skipLibCheck` or an over-broad `include`). We already hold the live program
   (`result.program.getTsProgram()`) in `run-typecheck.ts:199-201`, so this is
   `getTsProgram().getSourceFiles().length` -- one line, no new feature, pure observability.
   Honest caveat: it is NOT zero-cost semantically on the guard path (no program -> report
   0), and it is shape-only -- decide if `durationMs`-style observability is in-charter for
   v0.0.1 before adding. NOT load-bearing; nice-to-have parity.

2. **[none/validated] Explicit per-category Error/Warning counting is corroborated by BOTH
   sources.** Analog (`:1722-1728`) and `@nx/js` (`:164-170`) both filter Error and Warning
   by explicit `ts.DiagnosticCategory`, never `length - errorCount`. This independently
   validates our `run-typecheck.ts:322-327` discipline (and the documented MD-02 bug fix).
   Nothing to change.

3. **[none/validated] Our config-error handling is STRICTLY better than both for our use
   case.** `@nx/js` THROWS on a malformed tsconfig (`:127-130`) and Analog doesn't surface
   config errors in its gatherer at all. We fold `parsed.errors` into the reported set
   (`:110`) and synthesize a deterministic zero-rootNames Error (`:117-130`) -- so a broken
   config yields a counted, non-zero, actionable result rather than an exception or a false
   "clean". For an agent/CI signal this is the correct posture; do NOT adopt the throw.

4. **[none/validated] SingleFile vs WholeProgram is a consumer-shape difference, not a
   correctness gap.** Analog uses `OptimizeFor.SingleFile` (=1) ONLY because the Vite plugin
   holds one file per `transform` call. We hold the whole program and report once, so the
   whole-program `getNgSemanticDiagnostics()` getter is the correct dual -- it amortizes TCB
   generation across the program in one pass. Confirms our Approach A; nothing to adopt.
   (If we ever migrate to a per-file `NgtscProgram` loop -- explicitly deferred -- Analog's
   `getDiagnosticsForFile(sf, 1)` is the exact template, but that is a future feature.)

5. **[robustness] Neither source isolates per-getter failures the way our 500-re-throw
   does -- our resilience model is ahead, with ONE gap to consider.** Analog gets implicit
   per-file isolation (aggregate-at-buildEnd) for free from its per-file loop; `@nx/js` has
   none. Ours converts a swallowed-into-500 gatherer crash into a typed
   `TypecheckInfrastructureError` (`:171-179`) -- stronger than both. The only thing the
   per-file consumers have that we lack is graceful degradation: if ONE getter throws
   pre-500, the whole `performCompilation` aborts for us. This is acceptable for v0.0.1
   (whole-program is all-or-nothing by design), but worth NOTING as the boundary of our
   resilience model -- not a recommended change now.

## Open questions

1. **`totalFilesCount` charter fit:** is adding a program-source-file count to `CoreResult`
   in-scope for the CURRENT engine's observability, or does it read as a new reporting
   feature (deferred)? It is one line and consumes the already-held program, but it does
   alter the public `CoreResult` shape (which specs assert against).
2. **Does the corroboration change anything vs the primary `@angular/build` analysis?**
   Net: NO new correctness/robustness action falls out of these two consumers. Both confirm
   our explicit category counting, our whole-program getter choice, and that our config +
   fatal-error handling is stronger. The single shape-only candidate (`totalFilesCount`) is
   the only thing worth a decision, and it is ergonomics, not correctness.
