# @angular/build Engine Reference vs Our gatherAllDiagnostics -- Improvement Findings

Scope: improve the CURRENT whole-program no-emit engine for CORRECTNESS / COMPLETENESS /
ROBUSTNESS / SPEED. Deferred features (watch/incremental, reporters, CLI, generators,
inference, Storybook, Jest) are OUT of scope and explicitly NOT proposed below.

All citations verified at STABLE Angular **v22.0.4** via `git show v22.0.4:<path>` against the
two clones (working trees are at `22.1.0-next.x`; every version-sensitive section below was
re-confirmed at the v22.0.4 tree-ish and matched the working tree byte-for-byte unless noted).

Clones:
- `D:\projects\github\angular\angular` (`@angular/compiler-cli`, ngtsc)
- `D:\projects\github\angular\angular-cli` (`@angular/build`)

---

## How @angular/build gathers diagnostics @ v22.0.4

`@angular/build` drives an `NgtscProgram` + a `ts.EmitAndSemanticDiagnosticsBuilderProgram`
(the underlying TS builder), through a `DiagnosticModes`-gated generator.

`DiagnosticModes` (a bitmask) -- `angular-cli` `packages/angular/build/src/tools/angular/compilation/angular-compilation.ts:22-28` @ v22.0.4:
```
None = 0, Option = 1<<0, Syntactic = 1<<1, Semantic = 1<<2, All = Option|Syntactic|Semantic
```
It selects WHICH diagnostic *families* to gather (Option / Syntactic / Semantic). It does NOT
change how a given family is computed; it only includes/excludes whole families. The build
always passes `DiagnosticModes.All` from `diagnoseFiles(modes = DiagnosticModes.All)`
(`angular-compilation.ts:88-109`).

`diagnoseFiles` (`angular-compilation.ts:88-109`): loops over `collectDiagnostics(modes)`,
converts each `ts.Diagnostic` to an esbuild `PartialMessage`, and bins by `category` into
`errors` / `warnings`.

`collectDiagnostics(modes)` (`aot-compilation.ts:225-296` @ v22.0.4) -- the gatherer:
1. **Program-level** (`Option`): `getConfigFileParsingDiagnostics()` + `angularCompiler.getOptionDiagnostics()` + `typeScriptProgram.getOptionsDiagnostics()` (lines 239-243).
2. **Global syntactic** (`Syntactic`): `typeScriptProgram.getGlobalDiagnostics()` (lines 244-246).
3. **Per source file** (loop, lines 248-295), skipping `angularCompiler.ignoreForDiagnostics.has(sf)` shim/typecheck files (250-252):
   - `Syntactic`: `typeScriptProgram.getSyntacticDiagnostics(sf)` (257-261).
   - `Semantic`: `typeScriptProgram.getSemanticDiagnostics(sf)` (268-272).
   - skip `sf.isDeclarationFile` for templates (274-277).
   - Angular template/extended/source-file-validator: `angularCompiler.getDiagnosticsForFile(sf, templateDiagnosticsOptimization)` -- **only for affected files**, else read from `diagnosticCache` (281-294). This is the incremental cache path; on a cold whole-program build EVERY non-declaration file is "affected" so this runs for all of them.

`templateDiagnosticsOptimization` (`OptimizeFor`) is set ONCE at init:
`affectedFiles.size === 1 ? OptimizeFor.SingleFile : OptimizeFor.WholeProgram`
(`aot-compilation.ts:210`). On a cold full build (>1 file) it is `WholeProgram`.

`getDiagnosticsForFile(sf, optimizeFor)` -- `NgCompiler` `angular/packages/compiler-cli/src/ngtsc/core/src/compiler.ts:616-639` @ v22.0.4:
```
const diagnostics = [...getNonTemplateDiagnostics().filter(d => d.file === file)];
try {
  diagnostics.push(...getTemplateDiagnosticsForFile(file, optimizeFor), ...runAdditionalChecks(file));
} catch (err) { if (!isFatalDiagnosticError(err)) throw err; diagnostics.push(err.toDiagnostic()); }
return addMessageTextDetails(diagnostics);
```
So per file it runs: non-template (filtered to that file) + per-file template TTC +
`runAdditionalChecks(file)` (sourceFileValidator + templateSemanticsChecker + extended), all
under a PER-FILE `isFatalDiagnosticError` try/catch, then `addMessageTextDetails`.

`OptimizeFor` enum -- `angular/packages/compiler-cli/src/ngtsc/typecheck/api/checker.ts:388-405` @ v22.0.4. `SingleFile` doc: "Calling `TemplateTypeChecker` methods successively for multiple files while specifying `OptimizeFor.SingleFile` can result in significant unnecessary overhead overall." `WholeProgram` doc: "Initial calls ... may take longer, but repeated calls ... will be significantly faster."

WHY a per-file loop with `WholeProgram` is cheap after the first call -- `TemplateTypeChecker.getDiagnosticsForFile` `angular/packages/compiler-cli/src/ngtsc/typecheck/src/checker.ts:659-705`: the FIRST call with `WholeProgram` runs `ensureAllShimsForAllFiles()` (generates ALL type-check blocks at once); the per-file work afterward just reads cached shim state and asks TS for `getSemanticDiagnostics(shimSf)`. `SingleFile` instead calls `ensureAllShimsForOneFile(sf)` -- cheap once, but in a loop it repeatedly re-primes program state (the "significant unnecessary overhead").

`@angular/build` does NOT call `getNgStructuralDiagnostics()` anywhere in `collectDiagnostics`.
It also does NOT call the `api.Program` Ng getters at all; it reaches into
`angularProgram.compiler` (the `NgCompiler`) directly.

`loadConfiguration` overrides (`angular-compilation.ts:46-67` @ v22.0.4) passes a SECOND arg to
`readConfiguration`: `{ suppressOutputPathCheck:true, outDir:undefined, sourceMap:false,
declaration:false, declarationMap:false, allowEmptyCodegenFiles:false,
annotationsAs:'decorators', enableResourceInlining:false, supportTestBed:false,
supportJitMode:false, removeComments:false }`.

---

## How our engine gathers diagnostics

`gatherAllDiagnostics(program)` -- `packages/angular-typechecker/src/core/gather-diagnostics.ts:15-28`: pushes 6 whole-program getters on the `api.Program` IN ORDER, NO short-circuit:
```
getTsOptionDiagnostics(), getNgOptionDiagnostics(), getTsSyntacticDiagnostics(),
getTsSemanticDiagnostics(), getNgStructuralDiagnostics(), getNgSemanticDiagnostics()
```
Passed as `performCompilation`'s `gatherDiagnostics` callback -- `run-typecheck.ts:165`.

`runTypecheck` -- `packages/angular-typechecker/src/core/run-typecheck.ts:90-206`:
- loads compiler-cli (102) + typescript (103); `readConfiguration(tsConfigPath)` with NO second-arg overrides (105).
- folds `parsed.errors` into `configDiagnostics` (110) -- not dropped (MD-01 fixed).
- zero-rootNames guard (117-130) -> synthesized Error.
- `performCompilation({ rootNames, options: {...parsed.options, <emit-neutralizing override>}, emitFlags: 0, gatherDiagnostics: gatherAllDiagnostics })` (139-166).
- emit-neutralizing override (143-158): `noEmit:true, composite:false, declaration:false, declarationMap:false, emitDeclarationOnly:false, incremental:false, tsBuildInfoFile:undefined, sourceMap/inlineSourceMap/inlineSources/declarationDir/mapRoot/sourceRoot:undefined, diagnostics:false`.
- detects returned `UNKNOWN_ERROR_CODE` (500) by code and RE-THROWS as `TypecheckInfrastructureError` (171-179).
- `finalize` (187-206 / 292-338): boundary filter -> `ts.sortAndDeduplicateDiagnostics` -> explicit Error/Warning category counts.

The `api.Program` getters our gatherer calls resolve to `NgtscProgram` (`angular/packages/compiler-cli/src/ngtsc/program.ts`):
- `getTsOptionDiagnostics` -> `tsProgram.getOptionsDiagnostics()` (146-152).
- `getTsSyntacticDiagnostics()` (no arg) -> loops `getSyntacticDiagnostics(sf)` over non-ignored files (154-178).
- `getTsSemanticDiagnostics()` (no arg) -> loops `getSemanticDiagnostics(sf)` over non-ignored files (180-210).
- `getNgOptionDiagnostics` -> `compiler.getOptionDiagnostics()` (212-216).
- `getNgStructuralDiagnostics` -> `return []` (218-222) -- a NO-OP at v22.0.4.
- `getNgSemanticDiagnostics()` (no fileName) -> `compiler.getDiagnostics()` (224-243), the whole-program path.

`NgCompiler.getDiagnostics()` -- `compiler.ts:591-609` @ v22.0.4:
```
const diagnostics = [...getNonTemplateDiagnostics()];
try { diagnostics.push(...getTemplateDiagnostics(), ...runAdditionalChecks()); }
catch (err) { if (!isFatalDiagnosticError(err)) throw err; diagnostics.push(err.toDiagnostic()); }
return addMessageTextDetails(diagnostics);
```
- `getNonTemplateDiagnostics()` (1243-1258): `traitCompiler.diagnostics` + (if entryPoint) `checkForPrivateExports`.
- `getTemplateDiagnostics()` (1202-1222): loops ALL input source files, skipping `sf.isDeclarationFile || adapter.isShim(sf)`, calling `templateTypeChecker.getDiagnosticsForFile(sf, OptimizeFor.WholeProgram)`.
- `runAdditionalChecks()` (1260-1291): for ALL input files -> sourceFileValidator + templateSemanticsChecker + (if `strictTemplates`) extendedTemplateChecker.
- ONE try/catch wraps `getTemplateDiagnostics()` + `runAdditionalChecks()` for the WHOLE program: a single `isFatalDiagnosticError` thrown by ANY file ABANDONS all remaining files' template + additional diagnostics and returns what was gathered so far + `err.toDiagnostic()`.

`performCompilation` wrapper -- `angular/packages/compiler-cli/src/perform_compile.ts:255-326` @ v22.0.4: calls `gatherDiagnostics(program!)` inside a try/catch; ANY throw that escapes the gatherer (e.g. a NON-fatal error, or a throw from a TS getter) is swallowed into ONE `UNKNOWN_ERROR_CODE` (500) diagnostic (lines 313-323). Our engine then re-throws that as infra failure -- so an escaped throw nukes the ENTIRE run's diagnostics, not just one file.

---

## Equivalence & completeness analysis

**Same Angular families.** Our single `getNgSemanticDiagnostics()` -> `NgCompiler.getDiagnostics()`
runs EXACTLY the same Angular families as `@angular/build`'s per-file
`getDiagnosticsForFile` loop: non-template (`traitCompiler.diagnostics` + `checkForPrivateExports`),
template TTC, and `runAdditionalChecks` (sourceFileValidator + templateSemanticsChecker +
extended NG8xxx). The only difference is whole-program-at-once vs per-file-filtered. Both end
with `addMessageTextDetails` (the NG error-guide-URL appender) -- so we DO get the NG message
detail enrichment (RQ6). VALIDATED: no Angular family is missing or extra in our path.

**`getNgStructuralDiagnostics()` is a confirmed NO-OP** at v22.0.4 (`program.ts:218-222` returns
`[]`). It is NOT double-counting (it returns nothing), but it is dead weight in our gatherer and
in ngtsc's own `defaultGatherDiagnostics` (which also calls it, `perform_compile.ts:354`).
`@angular/build` correctly does not call it. NOTE: `traitCompiler.diagnostics` -- the diagnostics
one might *expect* "structural" to carry -- are already returned by `getNonTemplateDiagnostics`
inside `getNgSemanticDiagnostics`, so removing the structural call drops zero coverage. Keeping
it is harmless (validated), but it is a no-signal call.

**Global TS diagnostics gap (the one real completeness miss).** TS `Program.getSemanticDiagnostics()`
"the first time this is called ... will return global diagnostics (no location)" -- but ONLY when
called with NO `sourceFile` arg (`node_modules/typescript/lib/typescript.d.ts:6039-6040`). ngtsc's
`getTsSemanticDiagnostics()` always calls `getSemanticDiagnostics(sf)` PER FILE (with an arg,
`program.ts:201-203`), so it NEVER triggers the global-diagnostics return. Result: global
semantic diagnostics (e.g. TS2318 "Cannot find global type 'X'", incompatible `lib`/`target`
global-type clashes, duplicate-global-identifier errors that have no per-file location) are NOT
surfaced by our path. `@angular/build` explicitly calls `typeScriptProgram.getGlobalDiagnostics()`
(`aot-compilation.ts:245`). This is a genuine, citable completeness gap -- see IMPROVEMENT #2.

**Config-parse diagnostics.** `@angular/build` surfaces `getConfigFileParsingDiagnostics()` from the
builder (`aot-compilation.ts:240`). We surface `parsed.errors` from `readConfiguration` and prepend
them (`run-typecheck.ts:110`). Functionally equivalent for the config-error family; VALIDATED.

**Shim/declaration skipping.** Our whole-program TS getters skip `ignoreForDiagnostics` files
inside ngtsc (`program.ts:159-176`, `191-208`); the Angular path skips `isDeclarationFile ||
adapter.isShim(sf)` inside `getTemplateDiagnostics` (`compiler.ts:1207-1210`). So we already skip
shims/declarations for templates the same way -- VALIDATED, no change needed (RQ7 partial).

---

## Resilience analysis

This is the highest-value area.

Our whole-program `getNgSemanticDiagnostics()` wraps ALL files' template + additional checks in
ONE try/catch (`compiler.ts:599-606`). If a SINGLE component throws a `FatalDiagnosticError`
during TCB generation, every remaining file's template + extended diagnostics are abandoned and
the method returns early with just `err.toDiagnostic()`. One poisoned component therefore
SUPPRESSES correct diagnostics for the rest of the program -- the opposite of what an
agent/CI consumer wants (they want the complete picture, with the one bad file flagged).

`@angular/build`'s per-file loop calls `getDiagnosticsForFile(sf, optimizeFor)` (`aot-compilation.ts:284`),
and `getDiagnosticsForFile` has its OWN per-file try/catch (`compiler.ts:631-636`). A fatal error
in one component yields ONE diagnostic for that file and the loop CONTINUES to the next file --
full isolation. (Note: a non-fatal throw still escapes both designs identically -- it propagates
out and, in our path, `performCompilation`'s outer catch turns it into UNKNOWN_ERROR_CODE 500.)

Tradeoffs of switching our engine to a per-file Angular loop:
- We CANNOT call `getDiagnosticsForFile` through the `api.Program` interface -- it is on
  `NgtscProgram`/`NgCompiler`, not `api.Program`. BUT `NgtscProgram.getNgSemanticDiagnostics(fileName?)`
  accepts an optional `fileName` and, when given one, delegates to
  `compiler.getDiagnosticsForFile(sf, OptimizeFor.WholeProgram)` (`program.ts:224-243`). So a
  per-file resilient loop is reachable from the EXISTING `api.Program` surface by calling
  `getNgSemanticDiagnostics(sf.fileName)` per file -- no NgtscProgram migration required, no new
  type surface beyond widening our `Program` interface's existing `fileName?` param (already
  declared, `compiler-cli-types.ts:76-79`).
- Speed: using `OptimizeFor.WholeProgram` in the loop, the FIRST per-file call primes
  `ensureAllShimsForAllFiles()` once; subsequent calls are cheap cache reads
  (`typecheck/src/checker.ts:659-667`). So the resilient loop costs roughly the SAME as the
  single whole-program call PLUS the per-file iteration overhead (filtering non-template
  diagnostics by `d.file === file` per file, and re-running sourceFileValidator/extended per
  file). Do NOT use `OptimizeFor.SingleFile` in the loop -- that incurs the "significant
  unnecessary overhead" warned in the enum doc.
- Output change: a per-file loop CHANGES the diagnostic set ONLY in the failure case (you now
  get the other files' diagnostics that the whole-program path dropped). On a clean or
  ordinarily-erroring program the SET is identical (after our existing
  `sortAndDeduplicateDiagnostics`). Note `getNonTemplateDiagnostics` is memoized
  (`compiler.ts:1244`), so re-filtering it per file does not recompute it.

See IMPROVEMENT #1.

---

## Options & post-processing analysis

**Options we DON'T set that `@angular/build` does** (`angular-compilation.ts:50-66`):
`suppressOutputPathCheck:true`, `allowEmptyCodegenFiles:false`, `annotationsAs:'decorators'`,
`enableResourceInlining:false`, `supportTestBed:false`, `supportJitMode:false`,
`removeComments:false`, `outDir:undefined`. These are EMIT/codegen-shaping options. For a pure
no-emit type-check (`noEmit:true`, `emitFlags:0`) they are mostly irrelevant -- we never emit, so
`annotationsAs`/`enableResourceInlining`/`removeComments`/`outDir` cannot affect the gathered
diagnostics. The one with a plausible diagnostic effect is `suppressOutputPathCheck:true`: it
suppresses the "output path could not be determined / would overwrite input" config check. With
our `noEmit:true` + `composite:false` + `outDir` left as the consumer set it, this is the SAME
family of output-path nuisance error our emit-neutralizing override already aims to dodge.
LOW-RISK, LOW-EFFORT hardening: see IMPROVEMENT #4. `supportTestBed`/`supportJitMode` default to
`true` in `readConfiguration`; leaving them true is actually MORE complete for spec tsconfigs
(JIT/TestBed code paths get analyzed), so we should NOT copy `false` there -- VALIDATED we are
correct to omit them.

**`strictTemplates` / extended diagnostics.** We do NOT override these -- we spread `parsed.options`
verbatim (`run-typecheck.ts:140`), so the consumer's `strictTemplates` and `extendedDiagnostics`
flow through untouched. `runAdditionalChecks` gates extended checks on `this.strictTemplates`
(`compiler.ts:1281`); since we preserve the consumer's value, we get the consumer's true extended
diagnostic set -- VALIDATED. We must NOT force `strictTemplates:true` (that would invent
diagnostics the build would not report -- a correctness violation of "what the build would see").

**`_enableTemplateTypeChecker` / `compileNonExportedClasses` (the Language-Service flags).** These
are LS-only knobs (`NgtscProgram` is constructed with `enableTemplateTypeChecker:false`,
`program.ts:120`). `@angular/build` does NOT set them either. Setting `_enableTemplateTypeChecker`
would only expose the `TemplateTypeChecker` API surface; it does not add diagnostics to the
gather path. VALIDATED: correctly omitted.

**`skipLibCheck`.** Neither we nor `@angular/build` override it -- both honor the consumer's value.
This is correct: `skipLibCheck` governs whether `.d.ts` (incl. `node_modules`) semantic
diagnostics are produced at all, and our boundary filter then excludes out-of-project ones by
default. VALIDATED.

**Post-processing / order.** `addMessageTextDetails` is applied INSIDE `getNgSemanticDiagnostics`
(`compiler.ts:608`), so we get NG guide-URL enrichment for free -- VALIDATED (RQ6). The TS getters
need no extra post-processing; `@angular/build`'s only TS post-step is
`convertTypeScriptDiagnostic` to esbuild's message shape (`angular-compilation.ts:99`), which is a
RENDERING concern, not a gathering one -- our formatter owns that separately. Getter ORDER in our
gatherer is NOT significant for completeness: we removed ngc's short-circuit, so all 6 always run;
the final `ts.sortAndDeduplicateDiagnostics` (`run-typecheck.ts:320`) imposes a deterministic
order regardless of push order. VALIDATED.

---

## CONCRETE IMPROVEMENTS FOR OUR ENGINE

Ordered highest-value first.

### 1. Switch Angular semantic gathering to a per-file, fault-isolated loop
- **(a) Current:** `gather-diagnostics.ts:25` calls `program.getNgSemanticDiagnostics()` once
  (whole-program). That resolves to `NgCompiler.getDiagnostics()` whose SINGLE try/catch
  (`compiler.ts:599-606` @ v22.0.4) abandons all remaining files' template + extended diagnostics
  on the first `FatalDiagnosticError`.
- **(b) Reference:** `@angular/build` loops per file calling `getDiagnosticsForFile(sf, optimizeFor)`
  (`aot-compilation.ts:281-288` @ v22.0.4), and that method has a PER-FILE try/catch
  (`compiler.ts:631-636` @ v22.0.4) so one poisoned component yields one diagnostic and the loop
  continues. Reachable from our existing `api.Program` surface via
  `getNgSemanticDiagnostics(sf.fileName)` -> `compiler.getDiagnosticsForFile(sf, OptimizeFor.WholeProgram)`
  (`program.ts:224-243` @ v22.0.4).
- **(c) Change:** in `gatherAllDiagnostics`, replace the single `getNgSemanticDiagnostics()` with a
  loop over `program.getTsProgram().getSourceFiles()` that, for each non-declaration / non-ignored
  source file, calls `program.getNgSemanticDiagnostics(sf.fileName)`. Keep `OptimizeFor.WholeProgram`
  (the implicit optimizeFor of the no-arg-fileName overload) so shim generation is primed once.
  Widen the `Program` type's already-declared `fileName?` usage (`compiler-cli-types.ts:76-79`) --
  no NgtscProgram migration. NOTE: `getDiagnosticsForFile` re-filters the memoized
  `getNonTemplateDiagnostics()` per file (`compiler.ts:618`), so the union over all files reproduces
  the whole-program non-template set with no loss; rely on our existing
  `sortAndDeduplicateDiagnostics` to dedupe.
- **(d) Classification:** `robustness` (primary) + `completeness` (in the failure case).
- **(e) Risk/output:** CHANGES output ONLY when a `FatalDiagnosticError` occurs (you then SEE the
  other files' diagnostics instead of losing them). On clean / ordinarily-erroring programs the
  sorted+deduped SET is unchanged. Risk: must reproduce ngtsc's own skip rules (declaration files,
  `adapter.isShim` -- approximated by skipping `isDeclarationFile`; the `fileName` overload already
  early-returns `[]` for files not in the program, `program.ts:231-235`). Confirm with a fixture
  that has one TCB-poisoning component + a second component with a normal template error: today the
  second error vanishes; after the change it survives.
- **(f) Effort:** M.

### 2. Surface global TypeScript semantic diagnostics (`getGlobalDiagnostics`)
- **(a) Current:** `gather-diagnostics.ts:23` calls `program.getTsSemanticDiagnostics()`, which in
  ngtsc loops `getSemanticDiagnostics(sf)` PER FILE (`program.ts:201-203` @ v22.0.4). Because each
  call passes a `sourceFile` arg, TS never returns its global (location-less) semantic diagnostics
  ("the first time this is called [with no arg] ... will return global diagnostics" --
  `typescript.d.ts:6039`). We therefore MISS global semantic diagnostics (e.g. TS2318 missing
  global type, incompatible `lib`/`target` global clashes).
- **(b) Reference:** `@angular/build` explicitly calls `typeScriptProgram.getGlobalDiagnostics()`
  (`aot-compilation.ts:245` @ v22.0.4) under the Syntactic mode bit, in addition to per-file
  syntactic+semantic.
- **(c) Change:** add `program.getTsProgram().getGlobalDiagnostics()` to `gatherAllDiagnostics`
  (the `getTsProgram()` accessor is already declared, `compiler-cli-types.ts:58`). Push it alongside
  the other TS getters; `sortAndDeduplicateDiagnostics` will order/dedupe.
- **(d) Classification:** `completeness`.
- **(e) Risk/output:** CHANGES output -- ADDS global diagnostics that were silently dropped. These
  are genuine TS errors the build/`tsc` would report, so this moves us CLOSER to the model. Low risk
  (additive, file-less diagnostics sort first via our existing comparator). Confirm none are
  duplicated by the per-file loop (they are location-less and distinct, so dedupe is a safety net,
  not load-bearing).
- **(f) Effort:** S.

### 3. Drop the dead `getNgStructuralDiagnostics()` call (no-op at v22.0.4)
- **(a) Current:** `gather-diagnostics.ts:24` calls `program.getNgStructuralDiagnostics()`.
- **(b) Reference:** `NgtscProgram.getNgStructuralDiagnostics()` returns `[]`
  (`program.ts:218-222` @ v22.0.4); `@angular/build` does not call it at all. The diagnostics one
  might expect here (`traitCompiler.diagnostics`) are already delivered by `getNonTemplateDiagnostics`
  inside `getNgSemanticDiagnostics` (`compiler.ts:1243-1258`).
- **(c) Change:** remove line 24. Optionally leave a comment that the getter is a documented no-op
  in Angular 22 so a future reader does not re-add it expecting coverage. Keep the `Program` type
  member (it is part of the real `api.Program` contract; only the CALL is removed).
- **(d) Classification:** `none/validated` -> `performance` (micro). It is a guaranteed-empty call;
  removing it removes a no-signal getter but does NOT change diagnostic output.
- **(e) Risk/output:** Does NOT change output (the call returns `[]`). Zero risk. (If you prefer
  maximum future-proofing against a future Angular version that makes it non-empty, KEEP it -- it is
  harmless. Flag as a judgment call, not a mandate.)
- **(f) Effort:** S.

### 4. Add `suppressOutputPathCheck: true` to the no-emit options override (defensive)
- **(a) Current:** `run-typecheck.ts:139-159` builds the options bag with the emit-neutralizing
  override but does NOT set `suppressOutputPathCheck`. We also call `readConfiguration` with no
  second-arg overrides (`run-typecheck.ts:105`).
- **(b) Reference:** `@angular/build` passes `suppressOutputPathCheck: true` to `readConfiguration`
  (`angular-compilation.ts:51` @ v22.0.4) precisely so output-path config checks never fire during
  a type-only flow.
- **(c) Change:** add `suppressOutputPathCheck: true` to the override object (alongside `noEmit`),
  OR pass it as the `existingOptions` second arg to `readConfiguration` (signature already declared,
  `compiler-cli-types.ts:155-158`). Prefer the override object for locality with the other
  emit-neutralizers.
- **(d) Classification:** `robustness` (correctness hardening against a config-shape nuisance error).
- **(e) Risk/output:** Could CHANGE output by suppressing an output-path config diagnostic (e.g. a
  TS5055/"would overwrite input"-class error) that is NOT a type error and that the build itself
  suppresses. Aligns us with the model; very low risk. If a fixture currently produces such a
  diagnostic our counts would drop by it -- that is the intended correction.
- **(f) Effort:** S.

### 5. (VALIDATED -- no change) Angular family coverage is complete and correctly enriched
- **(a) Current:** single `getNgSemanticDiagnostics()` -> `NgCompiler.getDiagnostics()`.
- **(b) Reference:** `getDiagnosticsForFile` (per file) runs the SAME families
  (`compiler.ts:591-639`): non-template, template TTC, sourceFileValidator, templateSemantics,
  extended (NG8xxx, gated on `strictTemplates`), and BOTH paths end with `addMessageTextDetails`
  (`compiler.ts:608` / `638`).
- **(c) Change:** NONE. (IMPROVEMENT #1 changes WHICH path, not WHICH families.)
- **(d) Classification:** `none/validated`.
- **(e) Risk/output:** n/a -- documenting that we are complete and DO get NG guide-URL message
  enrichment + extended diagnostics for free.
- **(f) Effort:** none.

### 6. (VALIDATED -- no change) Options pass-through is correct; do NOT copy `@angular/build`'s emit/codegen overrides
- **(a) Current:** spread `parsed.options` verbatim + emit-neutralizing override
  (`run-typecheck.ts:140-159`); `strictTemplates`/`extendedDiagnostics`/`skipLibCheck`/
  `supportTestBed`/`supportJitMode` all left as the consumer set them.
- **(b) Reference:** `@angular/build` forces `annotationsAs:'decorators'`,
  `enableResourceInlining:false`, `removeComments:false`, `supportTestBed:false`,
  `supportJitMode:false`, etc. (`angular-compilation.ts:50-66`) -- all EMIT/codegen shaping for its
  build pipeline.
- **(c) Change:** NONE for the codegen/emit options (we never emit, so they cannot affect gathered
  diagnostics). Specifically do NOT copy `supportTestBed:false`/`supportJitMode:false` -- the
  defaults (`true`) are MORE complete for spec tsconfigs.
- **(d) Classification:** `none/validated`.
- **(e) Risk/output:** Copying those would risk SUPPRESSING diagnostics relative to a faithful
  type-check (a correctness regression). Documenting the deliberate omission. (Exception:
  `suppressOutputPathCheck` IS worth copying -- see #4.)
- **(f) Effort:** none.

### 7. (VALIDATED -- no change) Getter order and post-processing
- **(a) Current:** 6 getters in fixed order; final `ts.sortAndDeduplicateDiagnostics`
  (`run-typecheck.ts:320`).
- **(b) Reference:** ngc's `defaultGatherDiagnostics` (`perform_compile.ts:328-360`) uses an
  AND-chain short-circuit; we deliberately do not. `@angular/build` bins by category after
  gathering.
- **(c) Change:** NONE. Push order is irrelevant because we always run all getters and then
  sort+dedupe deterministically.
- **(d) Classification:** `none/validated`.
- **(e) Risk/output:** n/a.
- **(f) Effort:** none.

---

## Open questions / things to confirm on 22.0.4

1. **Does ANY real-world non-fatal (non-`FatalDiagnosticError`) throw escape `getNgSemanticDiagnostics`
   in a normal type-check?** If yes, both our whole-program path AND a per-file loop convert it to
   UNKNOWN_ERROR_CODE 500 at the `performCompilation` boundary (`perform_compile.ts:313-323`). A
   per-file loop OUTSIDE `performCompilation`'s callback (i.e. wrapping each per-file call in OUR
   own try/catch) would isolate even non-fatal throws -- worth considering as a follow-on to #1 if
   we find non-fatal escapes in practice. Confirm by stress-testing with a known TCB-crashing
   component fixture.
2. **`getGlobalDiagnostics` dedup interaction (#2):** confirm on a fixture with a real global error
   (e.g. mismatched `lib`/`target` producing TS2318) that the diagnostic appears exactly once after
   `sortAndDeduplicateDiagnostics` and is correctly counted as an Error.
3. **Per-file loop + `getNonTemplateDiagnostics` filtering (#1):** verify that for a non-template
   non-template-error file (e.g. a plain `.ts` service), `getDiagnosticsForFile` returns its
   `traitCompiler` diagnostics via the `d.file === file` filter and that the union across files
   equals today's whole-program non-template set (no file slips through because its diagnostics have
   `file === undefined`). Diagnostics with `file === undefined` from the non-template set would be
   dropped by the `d.file === file` filter in EVERY per-file call -- confirm whether any
   `traitCompiler`/`checkForPrivateExports` diagnostics are file-less; if so, gather the
   non-template set ONCE separately (via a single whole-program `getNgSemanticDiagnostics()` kept
   only for its non-template portion, or accept the whole-program call for non-template + per-file
   loop for template) to avoid losing file-less Angular diagnostics. THIS IS THE KEY CORRECTNESS
   CHECK FOR #1.
4. **`adapter.isShim` parity:** our per-file loop would skip `isDeclarationFile` but cannot call the
   private `adapter.isShim`; confirm the `getNgSemanticDiagnostics(fileName)` overload's internal
   `getSourceFile(fileName)` + `getDiagnosticsForFile` already no-ops on shim files so we don't
   double-process them (the `fileName` lookup returns the real source file, and shims are not in the
   user rootNames we'd iterate -- but verify against a component with an inline template that
   generates a `.ngtypecheck.ts` shim).
5. **`next.x` vs `22.0.4` drift:** none found in any cited section -- `getDiagnostics`,
   `getDiagnosticsForFile`, `getTemplateDiagnostics`, `runAdditionalChecks`,
   `getNonTemplateDiagnostics`, `getNgStructuralDiagnostics`, `OptimizeFor`, `collectDiagnostics`,
   `DiagnosticModes`, and `loadConfiguration` overrides all matched byte-for-byte between the
   working tree (`22.1.0-next.x`) and `git show v22.0.4:`. Re-confirm before implementing if the
   clones advance.
