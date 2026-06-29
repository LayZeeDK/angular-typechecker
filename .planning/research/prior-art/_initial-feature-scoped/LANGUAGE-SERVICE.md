# Angular Language Service - Prior Art Learnings

> Source: local clone `D:\projects\github\angular\angular\packages\language-service\` (the
> `@angular/language-service` TS-language-service plugin) plus the compiler internals it depends on
> under `packages\compiler-cli\src\ngtsc\` (`core`, `typecheck`, `incremental`, `program_driver`).
> Researched for `angular-typechecker` (the Nx whole-program no-emit type-checker). All file paths
> below are absolute under that clone unless noted.

## What it is

`@angular/language-service` is a **`ts.server.PluginModuleFactory`** -- a TypeScript language-service
plugin loaded by `tsserver` inside the editor. It augments TypeScript's own `ts.LanguageService` with
Angular template intelligence (diagnostics, completions, quick-info, go-to-definition, rename, code
fixes, TCB inspection). The class that holds the Angular logic is `LanguageService` in
`packages\language-service\src\language_service.ts`. It does **not** contain an LSP "language server"
-- the actual JSON-RPC LSP server lives in the separate, NOT-cloned repo
`angular/vscode-ng-language-service`. **BLOCKER for question 7 (watch/server loop):** the
push/notification/file-change loop is in that other repo and cannot be read here. However, the
type-check-on-change recomputation logic IS visible (and lives) in this package + `ngtsc`, so the
incremental recipe (the part we actually care about for `--watch`) is fully recoverable. Everything
below is from the `language-service` package and `ngtsc` internals.

Key wiring fact: the plugin reaches the editor by **`require('@angular/language-service/bundles/language-service.js')(ts)`**
(`packages\language-service\plugin-factory.ts:13`) -- it is shipped as a single rollup bundle that is
handed the host's `typescript` module instance, so TS is never bundled in (more in Packaging below).

## How it gathers Angular diagnostics

The public entry is `LanguageService.getSemanticDiagnostics(fileName)`
(`language_service.ts:129`). It branches on file kind:

- **TypeScript file** (inline templates / decorators): get the source file from the *current*
  program and call the NgCompiler with **single-file optimization**:
  ```ts
  // language_service.ts:133-137
  const program = compiler.getCurrentProgram();
  const sourceFile = program.getSourceFile(fileName);
  const ngDiagnostics = compiler.getDiagnosticsForFile(sourceFile, OptimizeFor.SingleFile);
  diagnostics.push(...filterNgDiagnosticsForFile(ngDiagnostics, sourceFile.fileName));
  ```
- **External HTML template file**: find the component(s) that reference the template, then call
  `compiler.getDiagnosticsForComponent(component)` per component
  (`language_service.ts:140-145`).

`NgCompiler.getDiagnosticsForFile(file, optimizeFor)`
(`packages\compiler-cli\src\ngtsc\core\src\compiler.ts:616`) is the aggregator. It assembles **three**
diagnostic families, all filtered to `diag.file === file`:
1. **Non-template** (TS decorator/trait diagnostics) via `getNonTemplateDiagnostics()` (memoized,
   `compiler.ts:1243`).
2. **Template type-check** via `getTemplateDiagnosticsForFile(file, optimizeFor)` ->
   `templateTypeChecker.getDiagnosticsForFile(sf, optimizeFor)` (`compiler.ts:1224-1234`).
3. **Extended/NG8xxx + template-semantics + source-file-validator** via `runAdditionalChecks(file)`
   (`compiler.ts:1260`), gated on `this.strictTemplates` for the extended checks
   (`compiler.ts:1281`).

`getDiagnosticsForComponent(component)` (`compiler.ts:644`) is the per-class variant: it calls
`ttc.getDiagnosticsForComponent(component)`, then `templateSemanticsChecker` and (if
`strictTemplates`) `extendedTemplateChecker` for that one component. **It wraps the body in a
try/catch for `isFatalDiagnosticError`** so a TCB that cannot be generated degrades to a single
diagnostic instead of throwing (`compiler.ts:649-670`).

### Comparison to our whole-program `performCompilation` + all-getter approach

- The LS calls **`getDiagnosticsForFile(sf, OptimizeFor.SingleFile)`** (or `...ForComponent`) -- it
  scopes work to *one* file/component for latency. Our tool wants *everything*, so the analogous
  public surface for us is the **whole-program** call. Note that `NgtscProgram.getNgSemanticDiagnostics()`
  (`packages\compiler-cli\src\ngtsc\program.ts:238-241`) does exactly the all-or-one split:
  no filename -> `compiler.getDiagnostics()`; with filename -> `getDiagnosticsForFile(sf, OptimizeFor.WholeProgram)`.
- The all-getter set (TS + template + extended + template-semantics + source-file-validator) is the
  SAME set the LS runs; the LS just runs it per-file. So our "custom unconditional all-getter
  gatherer modeled on `@angular/build`" is gathering the same families the LS gathers via
  `NgCompiler.getDiagnostics()` / `getDiagnosticsForFile(..., WholeProgram)`. (The `@angular/build`
  package is not present in this clone -- could not cross-check its gatherer here.)
- The LS **never short-circuits by phase** the way `ngc` does: each public method just pushes every
  family unconditionally (subject to the `strictTemplates` gate and the fatal-error try/catch). That
  matches our "run every diagnostic phase unconditionally" design.

## Incremental & per-file type-checking  (THE most important section for us)

This is the concrete recipe for our deferred `--watch`/incremental REP feature. The LS keeps one
long-lived `CompilerFactory` and rebuilds the `NgCompiler` *incrementally* from the previous one on
every request.

### The driver: `CompilerFactory.getOrCreate()`
`packages\language-service\src\compiler_factory.ts:43`. One factory instance per `LanguageService`,
holding `private compiler: NgCompiler | null` and a single
`private readonly incrementalStrategy = new TrackedIncrementalBuildStrategy()` (line 34). On each
call:

1. Pull the latest `ts.Program` from the `ProgramDriver` (`programStrategy.getProgram()`).
2. **If the program object identity is unchanged AND only resources changed** -> build a
   `resourceChangeTicket(this.compiler, modifiedResourceFiles)` and `NgCompiler.fromTicket(...)`
   (`compiler_factory.ts:50-54`). If nothing changed, reuse the existing compiler verbatim (just
   reset its perf recorder).
3. **First time** (`this.compiler === null`) -> `freshCompilationTicket(program, options, incrementalStrategy, programStrategy, null, true, true)` (`compiler_factory.ts:65-74`).
4. **Otherwise (TS changed)** -> `incrementalFromCompilerTicket(this.compiler, program, incrementalStrategy, programStrategy, modifiedResourceFiles, null)` (`compiler_factory.ts:76-83`).

So the **API recipe** for an incremental step is:
```
oldCompiler  (kept across requests)
   + newProgram (from ProgramDriver.getProgram())
   --> incrementalFromCompilerTicket(oldCompiler, newProgram, strategy, driver, modifiedResources, perf)
   --> NgCompiler.fromTicket(ticket, adapter)   // the new compiler reuses prior analysis
```

### What `incrementalFromCompilerTicket` actually reuses
`packages\compiler-cli\src\ngtsc\core\src\compiler.ts:247`. It pulls the **old program** and the
**old `IncrementalState`** off the old compiler
(`oldCompiler.getCurrentProgram()`, `oldCompiler.incrementalStrategy.getIncrementalState(oldProgram)`,
lines 255-256). If there's no prior state it falls back to a fresh ticket (line 257-268). Otherwise it
builds `IncrementalCompilation.incremental(newProgram, versionMap, oldProgram, oldState, modifiedResourceFiles, perf)`
(lines 275-282).

### How "affected files" are computed (what makes per-file re-check cheap)
`IncrementalCompilation.incremental(...)` in
`packages\compiler-cli\src\ngtsc\incremental\src\incremental.ts:111`:

1. **Physically changed files** are found by diffing old vs new program source files using BOTH
   object identity AND a version map: a file is "physically changed" if its `ts.SourceFile` identity
   differs, or its version string differs (`incremental.ts:154-194`). Version strings come from
   `ProgramDriver.getSourceFileVersion(sf)` -- critical because the LS treats `ts.SourceFile`s as
   mutable (same identity, new content).
2. **Any `.d.ts` change forces a full fresh compilation** (`incremental.ts:188-190`) -- the semantic
   dep graph cannot safely process declaration-file deltas.
3. **Physical -> logical changes via the dependency graph**:
   `FileDependencyGraph.updateWithPhysicalChanges(priorGraph, physicallyChanged, deleted, changedResources)`
   (`incremental.ts:204-209`; impl in
   `packages\compiler-cli\src\ngtsc\incremental\src\dependency_tracking.ts:70`). A file is
   **logically changed** iff: it physically changed, OR one of its TS dependencies physically
   changed, OR one of its resource (template/style) dependencies changed
   (`dependency_tracking.ts:111-145`). Unchanged files **inherit their dep edges from the prior
   graph** (line 84-89) -- no re-analysis.
4. The result is a `DeltaIncrementalState` carrying `physicallyChangedTsFiles`,
   `changedResourceFiles`, and a pointer to the `lastAnalyzedState` (`incremental.ts:220-225`).

### Per-file reuse at type-check time
`NgCompiler.fromTicket` -> the `TemplateTypeChecker` (`TemplateTypeCheckerImpl` in
`packages\compiler-cli\src\ngtsc\typecheck\src\checker.ts`) reuses prior TCB results through
`maybeAdoptPriorResults()` (`checker.ts:948`). For each source file it asks
`priorBuild.priorTypeCheckingResultsFor(sf)` and, if the prior `FileTypeCheckingData.isComplete`,
**adopts it wholesale into `this.state`** (`checker.ts:968-974`, counts `PerfEvent.ReuseTypeCheckFile`).
`priorTypeCheckingResultsFor` (`incremental.ts:339`) returns `null` (forcing re-check) when the file
is **logically changed**, **semantically needs a type-check emit**, has no stored results, OR **its
prior results relied on inlining** (`incremental.ts:352-372`) -- inline-dependent results are never
reused because inlines mutate user files.

### Two key takeaways for our incremental milestone
- The whole machinery is **already public-ish**: `freshCompilationTicket`,
  `incrementalFromCompilerTicket`, `incrementalFromStateTicket`, `resourceChangeTicket`,
  `NgCompiler.fromTicket`, `TrackedIncrementalBuildStrategy`, and `ProgramDriver` are all exported
  from `@angular/compiler-cli` (the LS imports them from there:
  `compiler_factory.ts:9-20`). We do NOT need `performCompilation` for the incremental path; we need
  to drive `NgCompiler` + tickets ourselves and keep the prior compiler alive.
- The cheap per-file step requires **persistent state across runs**: keep the old `NgCompiler`, keep
  the `TrackedIncrementalBuildStrategy`, feed `getSourceFileVersion`, and let
  `incrementalFromCompilerTicket` + the dep graph decide what's stale.

## Type-check blocks (TCB) and laziness

- A TCB is generated TypeScript code that mirrors a template, written into a **type-check shim file**
  (`*.ngtypecheck.ts`, via `TypeCheckShimGenerator.shimFor(sfPath)`,
  `checker.ts:510`). Diagnostics are obtained by calling
  `typeCheckProgram.getSemanticDiagnostics(shimSf)` on the shim and converting the spans back
  (`checker.ts:685-693`).
- **`OptimizeFor` controls how much of the program gets TCBs generated before answering**
  (`packages\compiler-cli\src\ngtsc\typecheck\api\checker.ts:388-407`). It optimizes *TCB-generation
  breadth*, not the diagnostic algorithm:
  - `OptimizeFor.SingleFile` -> `ensureAllShimsForOneFile(sf)` (only that file's shim)
    (`checker.ts:664-665`, `1011`).
  - `OptimizeFor.WholeProgram` -> `ensureAllShimsForAllFiles()` (every non-shim, non-`.d.ts` file)
    (`checker.ts:661-662`, `980`).
  The enum's own doc: SingleFile "wants results as fast as possible" but "successively for multiple
  files ... can result in significant unnecessary overhead"; WholeProgram "initial calls may take
  longer, but repeated calls ... will be significantly faster" (`api/checker.ts:388-406`). **This is
  the single most important knob for a batch checker: a whole-program checker should pass
  `OptimizeFor.WholeProgram` once, NOT loop files with `SingleFile`.**
- **Laziness:** `NgCompiler` does no work until an output method is called; the analysis state is
  built on demand by `ensureAnalyzed()` (`compiler.ts:357,367`). Shim generation is lazy and
  guarded by `FileTypeCheckingData.isComplete` flags (`checker.ts:997-1003`, `1018-1021`,
  `1042-1045`) so the same shim is never regenerated within a compilation. `getDiagnosticsForFile`
  runs inside `PerfPhase.TtcDiagnostics` and TCB generation inside `PerfPhase.TcbGeneration`
  (`checker.ts:669`, `986`).
- **TCB invalidation:** resource-only changes call `compiler.updateWithChangedResources(...)` which
  calls `templateTypeChecker.invalidateClass(clazz)` for each component whose template/style file
  changed (`compiler.ts:566-572`). Inline-based shim data can be cleared with
  `clearAllShimDataUsingInlines()` (`checker.ts:1072`). Across compilations, staleness is decided by
  the dependency-graph "logically changed" computation above.
- **`InliningMode`** (`packages\compiler-cli\src\ngtsc\program_driver\src\api.ts:38`): the LS uses
  `InliningMode.CopySourceToTcb` (`language_service.ts:1046`) and `supportsInlineOperations: false`
  -- it never mutates user files, instead copying source into the TCB. `filterShimDiagnostics`
  (`checker.ts:641-653`) then keeps only diagnostics whose span falls inside a generated TCB
  function range when in `CopySourceToTcb` mode.

## Integration & diagnostic-span mapping

### Plugin / project-system wiring
- **`plugin-factory.ts`** exports the `ts.server.PluginModuleFactory` that `require`s the rollup
  bundle and calls `initialize(mod)`.
- **`src\ts_plugin.ts`** is the real plugin body. `initialize(mod)` returns
  `{ create, getExternalFiles }` (`ts_plugin.ts:435-440`). `create(info)` constructs
  `new LanguageService(project, tsLS, config)` and returns an object that **spreads the TS language
  service and overrides the Angular-aware methods** (`ts_plugin.ts:372-407`).
- **Angular-or-TS merge policy** is in `ts_plugin.ts`: `getSemanticDiagnostics` concatenates TS +
  Angular results (`ts_plugin.ts:67-74`); `withFallback` tries TS first then Angular for
  quick-info/completions (`ts_plugin.ts:38-46`); rename/references are Angular-exclusive
  (`ts_plugin.ts:108-123`). The `angularOnly` config flag suppresses the TS half.
- **`getExternalFiles`** (`ts_plugin.ts:409-432`) tells tsserver about the synthetic type-check shim
  files (`ScriptKind.External`) and external resource files (`ScriptKind.Unknown`) so they stay part
  of the project across the `updateProjectIfDirty` cycle.
- **`override_rename_ts_plugin.ts`** is a SEPARATE tiny plugin that disables TypeScript's built-in
  rename provider (returns `canRename: false` when `@angular/core` is in the project) so Angular's
  rename wins. Not relevant to a type-checker, but shows the "two cooperating plugins" pattern.
- The **`ProgramDriver` for the LS** is built inline in `language_service.ts:1044-1067`
  (`createProgramDriver`): `getProgram()` returns `project.getLanguageService().getProgram()`;
  `updateFiles()` writes TCB content into editor `ScriptInfo`s; `getSourceFileVersion()` returns
  `project.getScriptVersion(...)`. **For a batch CLI we would supply a different `ProgramDriver`** --
  likely `TsCreateProgramDriver` (`packages\compiler-cli\src\ngtsc\program_driver\src\ts_create_program_driver.ts:193`),
  which is the non-editor driver that creates fresh programs.
- The **`NgCompilerAdapter`** is `LanguageServiceAdapter` (`src\adapters.ts:29`). It implements
  `readResource`, `getModifiedResourceFiles` (by tracking `lastReadResourceVersion`,
  `adapters.ts:144-152`), shim detection (`isShim`), and resource detection. A batch tool needs an
  equivalent adapter, but a simpler one (no editor `ScriptInfo` tracking).

### Diagnostic span mapping (template diagnostics -> original source)
Diagnostics are first produced against the **TCB shim** source file, then mapped back:
- `getDiagnosticsForFile` calls `convertDiagnostic(diag, fileRecord.sourceManager)` on each shim
  diagnostic (`checker.ts:687-692`).
- Mapping uses `getSourceMapping(shimSf, positionInFile, sourceManager, isDiagnosticsRequest)`
  (`packages\compiler-cli\src\ngtsc\typecheck\src\tcb_util.ts:130`) which finds the original
  template/host-binding `ParseSourceSpan` for a position inside the TCB, then
  `makeTemplateDiagnostic(id, sourceMapping, span, category, code, messageText, ...)`
  (`packages\compiler-cli\src\ngtsc\typecheck\diagnostics\src\diagnostic.ts:30`) re-targets the
  `ts.Diagnostic` at the real template span. Example call site: `checker.ts:2105-2138`.
- The LS-level `getTcb(fileName, position)` (`language_service.ts:764`) exposes the raw TCB plus the
  span selections via `templateTypeChecker.getTypeCheckBlock(declaration)` and
  `getTcbNodesOfTemplateAtPosition(...)` -- useful for a future "show me the generated TCB"
  debugging reporter, not needed for plain diagnostics.

## Packaging/distribution

- **`package.json`** (`packages\language-service\package.json`): `main: ./index.js`,
  `typings: ./index.d.ts`, an `exports` map exposing `.`, `./bundles/language-service.js`, `./api`,
  `./private`, and `./package.json`. `engines.node` is `^22.22.3 || ^24.15.0 || >=26.0.0` -- the
  SAME Node range our project pins. License MIT.
- **It ships a single rollup bundle** `bundles/language-service.js` with a custom AMD-to-CJS header
  (`bundles\rollup.config.js:16-45`) that **externalizes `typescript`** (and `os/fs/path`) and
  receives the host's TS instance at call time: `module.exports = function(provided){ const ts =
  provided['typescript']; ... }`. This is the canonical pattern for "do not bundle TS; use the
  caller's TS version." `index.ts`/`index.d.ts` just re-export the factory (`index.d.ts:9-13`).
- **`api.ts`** is the stable public surface (the `NgLanguageService` interface, `PluginConfig`,
  `GetTcbResponse`, etc.); **`private.ts`** is a separate "private but exported for the LSP server"
  surface. The deep `ngtsc` symbols we rely on (tickets, `NgCompiler`, `OptimizeFor`,
  `TemplateTypeChecker`) are NOT in `api.ts` -- they are imported from `@angular/compiler-cli`'s
  internal entry. That confirms our reliance on compiler-cli internals is the same dependency the LS
  itself takes; it is just version-coupled.
- Relevance to our thin layer: we already ship a CJS executor that `await import()`s ESM
  `@angular/compiler-cli`. The LS bundle pattern (externalize TS, accept it from the caller) is the
  precedent for **never bundling `typescript` or `@angular/compiler-cli`** -- both must be the
  consumer's peer versions, which matches our peer-dependency plan.

## LEARNINGS FOR angular-typechecker

1. **[REP] Use `OptimizeFor.WholeProgram` exactly once for a batch run; never loop files with
   `SingleFile`.** The enum doc and the `getLatestComponentState`/`getDiagnosticsForFile` switch
   (`typecheck\api\checker.ts:388-406`; `typecheck\src\checker.ts:659-667`) prove `SingleFile` in a
   loop generates per-file TCB shims repeatedly ("significant unnecessary overhead"). If we ever
   expose a per-file mode, still call the whole-program shim-generation first. *Pattern to reuse:*
   `NgCompiler.getDiagnostics()` (whole program) or `getDiagnosticsForFile(sf, OptimizeFor.WholeProgram)`
   per file after a single `ensureAllShimsForAllFiles()`.

2. **[REP] The incremental `--watch` recipe is a public-from-compiler-cli ticket dance, not
   `performCompilation`.** Keep one long-lived `NgCompiler` + one `TrackedIncrementalBuildStrategy`
   across runs; on each change build `incrementalFromCompilerTicket(oldCompiler, newProgram, strategy,
   driver, modifiedResources, null)` then `NgCompiler.fromTicket(ticket, adapter)`
   (`language-service\src\compiler_factory.ts:43-87`). *APIs to reuse (all from `@angular/compiler-cli`):*
   `freshCompilationTicket`, `incrementalFromCompilerTicket`, `resourceChangeTicket`,
   `NgCompiler.fromTicket`, `TrackedIncrementalBuildStrategy`, `ProgramDriver`. **Version-fragile:**
   these are `ngtsc` internals, not in `@angular/language-service/api`; pin behavior to a known
   compiler-cli version via our shim and add a smoke test per Angular minor.

3. **[REP] Per-file cheapness comes entirely from the `FileDependencyGraph` "logically changed"
   computation + per-file `FileTypeCheckingData.isComplete` reuse.** A file is rechecked only if it,
   a TS dependency, or a resource dependency changed (`incremental\src\dependency_tracking.ts:111-145`);
   otherwise its prior TCB results are adopted wholesale (`typecheck\src\checker.ts:948-978`,
   `PerfEvent.ReuseTypeCheckFile`). *What we could do:* for `--watch`, feed an accurate
   `ProgramDriver.getSourceFileVersion` and trust the dep graph instead of hand-rolling invalidation.
   **Caveat to encode:** any `.d.ts` change forces a full fresh build (`incremental.ts:188-190`), and
   inline-dependent results are never reused (`incremental.ts:369-371`).

4. **[REP] Wrap every TCB-producing call in an `isFatalDiagnosticError` try/catch.** `NgCompiler`
   does this in `getDiagnostics`, `getDiagnosticsForFile`, and `getDiagnosticsForComponent`
   (`core\src\compiler.ts:594-606`, `626-636`, `649-670`) so an ungeneratable TCB yields one
   diagnostic rather than crashing the run. *Pattern to reuse:* mirror this so our batch run never
   aborts on a single poisoned component. `isFatalDiagnosticError` is exported from
   `@angular/compiler-cli` (the LS imports it: `language_service.ts:18`).

5. **[REP/SUR] For machine reporters (JSON/SARIF/GitHub annotations and a future CLI), map shim
   diagnostics back to template spans with the existing `convertDiagnostic` + `getSourceMapping` +
   `makeTemplateDiagnostic` chain** (`typecheck\src\checker.ts:687-692`; `tcb_util.ts:130`;
   `diagnostics\src\diagnostic.ts:30`). The diagnostics returned by `NgCompiler.getDiagnostics*`
   are ALREADY re-targeted at original source spans (template file + offset), so a reporter can read
   `diag.file.fileName`, `diag.start`, `diag.length` directly -- no extra mapping needed by us. The
   raw-TCB inspection (`getTcb`, `language_service.ts:764`) is the precedent if we later add a
   "explain this error / show TCB" debug reporter. **Version-fragile:** span mapping touches `ngtsc`
   internals.

6. **[REP/SUR] Resource-only (template/style) changes have a dedicated cheap path -
   `resourceChangeTicket` + `invalidateClass`** (`compiler_factory.ts:50-54`;
   `core\src\compiler.ts:539-574`). In `--watch`, detect "only `.html`/`.css` changed, program
   identity unchanged" and take this path instead of a full incremental TS step. *APIs to reuse:*
   `resourceChangeTicket`, `NgCompilerAdapter.getModifiedResourceFiles` (track resource versions like
   `LanguageServiceAdapter`, `adapters.ts:144-152`).

7. **[SUR] Do NOT bundle `typescript` or `@angular/compiler-cli`; accept the consumer's instance.**
   The LS bundle externalizes TS and is handed `provided['typescript']` at load
   (`bundles\rollup.config.js:27-44`; `plugin-factory.ts:13`). This validates our peer-dependency
   posture for a standalone CLI binary: resolve the project's own TS + compiler-cli, never vendor a
   second copy (version skew would corrupt the program/TCB identity checks the incremental engine
   relies on). The LS `package.json` `engines.node` range is identical to ours -- safe to mirror.

8. **[SUR] Reuse the `ProgramDriver` abstraction to support both batch and watch from one engine.**
   The LS supplies an editor-backed driver (`createProgramDriver`, `language_service.ts:1044`); a CLI
   should supply `TsCreateProgramDriver`
   (`program_driver\src\ts_create_program_driver.ts:193`). Designing `runTypecheck()` to take a
   `ProgramDriver` (rather than baking in `performCompilation`) is what unlocks the incremental/watch
   milestone without a rewrite. **Version-fragile:** `ProgramDriver`/`TsCreateProgramDriver` are
   `ngtsc` internals.

9. **[REP] `strictTemplates` gates the extended/NG8xxx checks.** `runAdditionalChecks` and
   `getDiagnosticsForComponent` only run `extendedTemplateChecker` when `this.strictTemplates`
   (`core\src\compiler.ts:662`, `1281`). The LS even emits a *suggestion* diagnostic telling users to
   enable `strictTemplates` for full features (`language_service.ts:902-913`). *What we could do:*
   surface the same hint (or hard-require `strictTemplates`) in our reporter so users understand why
   NG8xxx diagnostics are absent when it's off. Our "complete diagnostic set" promise is only
   delivered when `strictTemplates: true`.

10. **[SUP] The LS itself is the editor-side "live loop"; our value prop (headless/CI/agent) is
    explicitly the complement.** This package contains zero CI/headless logic -- it is all
    `tsserver`-request-driven. There is no `ngc`-style standalone diagnostic runner here, which
    confirms our niche. For SUP (AI-agent skill distribution) the relevant artifact to imitate is the
    clean diagnostic shape: re-targeted `ts.Diagnostic`s with `code` (NG8xxx for extended), category,
    and original-source spans -- exactly what `NgCompiler.getDiagnostics*` returns, ready to serialize
    to JSON/SARIF without an editor.

## Open questions / things to verify on Angular 22.0.4 (our pinned version)

- **Which ticket/incremental symbols are exported from the public `@angular/compiler-cli` entry vs
  only a deep internal path on 22.0.4?** The LS imports `freshCompilationTicket`,
  `incrementalFromCompilerTicket`, `resourceChangeTicket`, `NgCompiler`, `OptimizeFor`,
  `ProgramDriver`, `TrackedIncrementalBuildStrategy`, `InliningMode` directly from
  `@angular/compiler-cli` (`compiler_factory.ts:9-20`, `language_service.ts:9-27`) -- but this clone
  may be a newer/`next` checkout. Verify these are reachable through the installed `22.0.4` package's
  type entry (or our shim) before committing to the incremental milestone.
- **Confirm `TsCreateProgramDriver` is the right batch driver on 22.0.4** and whether it needs
  `supportsInlineOperations: true` (the LS uses `false` + `CopySourceToTcb`). Our current
  `performCompilation` path hides the driver choice; the incremental path forces us to pick one.
- **Verify the `OptimizeFor.WholeProgram` perf claim holds for a one-shot batch run** (no second
  query). The optimization pays off on *repeated* whole-program queries; for a single batch pass the
  cost of `ensureAllShimsForAllFiles()` is unavoidable either way, so confirm there's no penalty vs
  our current `performCompilation` aggregation.
- **`.d.ts`-change -> full-fresh-rebuild rule** (`incremental.ts:188-190`): confirm this still holds
  on 22.0.4, since for a buildable-library consumer that edits emitted `.d.ts` between watch cycles it
  means no incremental benefit. May affect how we message `--watch` performance for library targets.
- **`@angular/build`'s unconditional all-getter gatherer could not be cross-checked** (the `build`
  package is absent from this clone). Verify our "modeled on `@angular/build`" gatherer against the
  installed `@angular/build@22` source to ensure the diagnostic family set still matches what
  `NgCompiler.getDiagnostics()` produces (TS + template + extended + template-semantics +
  source-file-validator).
- **Watch/notification loop is in `angular/vscode-ng-language-service` (NOT cloned).** If we want the
  exact debounce/recompute-on-change choreography, that repo must be consulted separately; the
  `ngtsc` incremental engine documented here is the reusable substrate, but the orchestration around
  it (file-watcher events -> `getProgram()` refresh -> diagnostics push) is theirs to study later.
