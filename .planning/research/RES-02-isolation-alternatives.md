# RES-02 / SC2 Per-File Fault-Isolation: Alternatives Research (NEUTRAL)

Target: angular-typechecker Nx plugin -- no-emit whole-program Angular type-check on
`@angular/compiler-cli` `performCompilation` + custom all-diagnostics gatherer over the
`api.Program` (NgtscProgram) surface. Stable Angular 22.0.4 / TypeScript 6.0.3.
NO NgtscProgram migration this milestone (D-04). NO `OptimizeFor.SingleFile` per current
lock (D-07). NO catch-all (D-05).

This document is NEUTRAL: it presents evidence and per-option assessments. It does NOT rank
or recommend -- a separate panel decides.

All Angular source citations were verified against the LOCAL clones at the `v22.0.4` tag via
`git show v22.0.4:<path>` (NOT the working tree, which sits on 22.1.0-next.x):

- `@angular/compiler-cli` + `@angular/compiler`: D:\projects\github\angular\angular @ v22.0.4 (commit 0b1cbbd)
- `@angular/build` (CLI): D:\projects\github\angular\angular-cli @ v22.0.4 (commit e197652)

---

## EXECUTIVE SUMMARY

CONFIRMED at v22.0.4. A TCB-GENERATION-phase `FatalDiagnosticError` thrown inside the SHARED
`ensureAllShimsForAllFiles()` priming loop aborts that loop before `updateFromContext()` runs,
so NO surviving file's template-check shims are committed to the type-check program -- under
`OptimizeFor.WholeProgram` (the mode the `api.Program` `getNgSemanticDiagnostics(fileName)`
overload hard-codes), every other file's TEMPLATE (NG8xxx) diagnostics are lost in BOTH the
whole-program AND the per-file-WholeProgram paths. The team's empirical finding is correct.
The only in-tree mechanisms that isolate it are `OptimizeFor.SingleFile`
(`ensureAllShimsForOneFile`, which primes + commits each file in its own context) or the
per-file-request model the Language Service uses (also SingleFile). One refinement: the claim
"`@angular/build` hits the same limitation" is true ONLY for cold/multi-file builds -- its
loop dynamically picks `SingleFile` when exactly ONE file is affected (watch-mode incremental).

---

## PER-QUESTION FINDINGS

### Q1 -- CONFIRM/REFUTE: WholeProgram priming abort hides survivors' template diagnostics

CONFIRMED (HIGH, local source).

Call chain on the `api.Program` surface:

- `NgtscProgram.getNgSemanticDiagnostics(fileName)` -> `compiler.getDiagnosticsForFile(sf, OptimizeFor.WholeProgram)`
  (`ngtsc/program.ts:241`). The no-arg form -> `compiler.getDiagnostics()` (`program.ts:239`).
  Both are file-less of `OptimizeFor` choice on the per-file form: the overload ALWAYS passes
  `WholeProgram`.
- `NgCompiler.getDiagnostics()` (`core/src/compiler.ts:591-609`) and
  `NgCompiler.getDiagnosticsForFile()` (`compiler.ts:616-639`) each wrap the template-diagnostics
  call in a try/catch that re-throws non-fatal errors but converts a `FatalDiagnosticError` to
  ONE diagnostic (`if (!isFatalDiagnosticError(err)) throw err; diagnostics.push(err.toDiagnostic())`).
  This is why the run does not crash -- the fatal becomes a single reported diagnostic.
- Inside that try, `getTemplateDiagnosticsForFile(file, WholeProgram)` (`compiler.ts:1224-1241`)
  -> `templateTypeChecker.getDiagnosticsForFile(sf, WholeProgram)` (`checker.ts:602-649`).
- `checker.ts:602-610`: `case OptimizeFor.WholeProgram: this.ensureAllShimsForAllFiles();`.

The abort mechanism (`checker.ts:923-952`, `ensureAllShimsForAllFiles`):

```
for (const sf of this.originalProgram.getSourceFiles()) {     // line 933
  ... const fileData = this.getFileData(sfPath);              // line 939
  if (fileData.isComplete) continue;
  this.typeCheckAdapter.typeCheck(sf, ctx);                   // line 944  <-- THROWS here on poison
  fileData.isComplete = true;                                 // line 946
}
this.updateFromContext(ctx);                                  // line 949  <-- NEVER reached
this.isComplete = true;                                       // line 950  <-- NEVER reached
```

The loop body is NOT individually try/caught. The poison's `typeCheck` throw (a
`FatalDiagnosticError`) propagates out of `ensureAllShimsForAllFiles`, up through
`getDiagnosticsForFile`/`getDiagnostics`, and is caught at the `compiler.ts` boundary.
Because `updateFromContext(ctx)` (line 949) -- which calls `ctx.finalize()` and
`programDriver.updateFiles(updates, Incremental)` (`checker.ts:1033-1043`) -- never runs, the
generated TCB shims for the OTHER files in this shared `ctx` are never committed into the
type-check program. After `getDiagnosticsForFile` returns (with just the poison's one
diagnostic), `this.isComplete` is still `false`, so the NEXT per-file `WholeProgram` call
re-enters `ensureAllShimsForAllFiles` and re-throws on the same poison -- never surfacing any
survivor's template diagnostics. This holds for both the whole-program and per-file
WholeProgram paths. CONFIRMS the team's claim.

The specific poison: a template referencing a non-exported / local-only symbol throws
`IMPORT_GENERATION_FAILURE` (NG3004) during reference emission for the TCB, at
`ngtsc/typecheck/src/reference_emit_environment.ts:52-58` (the in-typecheck-module throw) and
`ngtsc/imports/src/emitter.ts:173` (the import-emitter throw reached during TCB reference
emission). Both are `throw new FatalDiagnosticError(ErrorCode.IMPORT_GENERATION_FAILURE, ...)`.

### Q2 -- CONFIRM/REFUTE: OptimizeFor.SingleFile (ensureAllShimsForOneFile) isolates this

CONFIRMED that it isolates a FRESH (not-yet-primed) survivor (HIGH, local source) -- with one
shared-state pitfall (see Q4).

`ensureAllShimsForOneFile(sf)` (`checker.ts:954-975`):

```
const fileData = this.getFileData(sfPath);
if (fileData.isComplete) return;                              // early-return guard
const host = new SingleFileTypeCheckingHost(sfPath, fileData, this);  // line 966
const ctx = this.newContext(host);
this.typeCheckAdapter.typeCheck(sf, ctx);                     // ONLY this one file
fileData.isComplete = true;
this.updateFromContext(ctx);                                  // line 973  <-- commits THIS file
```

Mechanism: each SingleFile call builds its OWN context scoped to a single file
(`SingleFileTypeCheckingHost`, `checker.ts:1801-1856`; `shouldCheckClass` returns false for any
class not in `this.sfPath`), runs `typeCheck` for ONLY that file, then immediately calls
`updateFromContext(ctx)` to commit. A throw on the poison file aborts only the poison's own
call; the survivor's separate call builds + commits its own shims independently. The poison and
survivor are decoupled because they no longer share a single `ctx` that must finalize as a unit.

Shared state that STILL couples files even under SingleFile:

- `clearAllShimDataUsingInlines()` (`checker.ts:1015-1031`, invoked from
  `SingleFileTypeCheckingHost.recordShimData` at 1841-1844 when a file's TCB needs inline type
  operations): generating new inlines clears ALL prior shim data that relied on inlines and
  resets `this.isComplete = false`. So a later inline-using file can invalidate earlier
  committed inline shims -- but it does not RE-THROW the poison; it only forces recomputation.
  This is the "significant unnecessary overhead" the enum doc warns about, not a correctness
  break for isolation.
- The poison's diagnostic is still produced once (its own SingleFile call still throws and is
  caught at the `compiler.ts` boundary). SingleFile changes WHICH files survive, not whether
  the poison reports.

### Q3 -- PERFORMANCE: real cost of SingleFile-in-a-loop vs WholeProgram-primed-once

MED (source-grounded mechanism; no first-party benchmark numbers found).

What the enum doc says (`ngtsc/typecheck/api/checker.ts:379-398`): SingleFile is "only
interested in results for a given file, and wants them as fast as possible"; "Calling ...
methods successively for multiple files while specifying `OptimizeFor.SingleFile` can result in
significant unnecessary overhead overall." WholeProgram: "Initial calls ... may take longer,
but repeated calls to gather information for the whole user program will be significantly
faster."

What is recomputed per SingleFile call (from the code):

- Each call runs `this.typeCheckAdapter.typeCheck(sf, ctx)` + `updateFromContext(ctx)` ->
  `programDriver.updateFiles(updates, UpdateMode.Incremental)` (`checker.ts:973`, 1039). Each
  `updateFiles` mutates the underlying type-check program (a new/patched `ts.Program` via the
  program driver). So a per-file loop performs N separate type-check-program updates instead of
  ONE batched update (the WholeProgram path commits all shims in a single `updateFromContext`
  after the whole loop, `checker.ts:949`).
- The dominant repeated cost is the TypeScript type-checker work: after each `updateFiles`, the
  TS program's type information for the shim files is (re)computed. WholeProgram amortizes shim
  generation + a single program update across all files; SingleFile pays the program-update +
  TS-typecheck-priming cost once per file. The "overhead" is therefore principally repeated
  TS-program patching and re-checking, plus the inline-clearing recomputation in Q2 when inlines
  are involved -- not literally regenerating every other file's TCB on every call (the
  `fileData.isComplete` / `shimData.has` guards prevent already-done files from re-running).
- It is NOT a clean O(n^2) in the general case, but inline-using files can degrade toward it:
  `clearAllShimDataUsingInlines()` wipes inline-dependent shims, so subsequent files may
  recompute previously-done inline shims. The realistic worst case is "linear number of program
  updates, each triggering bounded TS re-checks, with extra recompute proportional to
  inline-using files."

Materiality for a COLD, one-shot CI/agent no-emit type-check (the angular-typechecker use case):

- This is a single process, single pass, no watch/LS reuse. The WholeProgram amortization
  benefit (cheap REPEATED whole-program queries) is largely irrelevant -- there is exactly one
  gathering pass. The SingleFile "overhead" is paid once across N files in that single pass.
- The cost that matters is therefore: N incremental program updates + per-file TS re-checks vs
  ONE batched update + one whole-program TS check. On large programs this can be a meaningful
  constant-factor slowdown (the maintainers chose WholeProgram for builders precisely to avoid
  it), but it is NOT the pathological watch-loop scenario the doc warns about (which is the same
  SingleFile cost paid repeatedly across many keystroke-driven passes). No published v22 number
  was found; `@angular/build` treats >1 affected file as "use WholeProgram" (Q6), which is
  indirect evidence the maintainers consider multi-file SingleFile loops costly enough to avoid
  by default.

### Q4 -- TWO-PASS feasibility (WholeProgram normally; on Fatal, re-gather survivors with SingleFile)

PARTIALLY SOUND with a concrete correctness pitfall (HIGH, local source).

Can you call `getNgSemanticDiagnostics(fileName)` with different OptimizeFor on the same
program? On the `api.Program`/NgtscProgram surface: NO -- the public `getNgSemanticDiagnostics`
overload hard-codes `WholeProgram` (`program.ts:241`); there is no public way to request
`SingleFile` through `api.Program`. SingleFile is reachable only via the internal
`NgCompiler.getDiagnosticsForFile(sf, OptimizeFor.SingleFile)` or
`TemplateTypeChecker.getDiagnosticsForFile(sf, OptimizeFor.SingleFile)` -- i.e. you must reach
PAST `api.Program` into `program.compiler` (an `NgCompiler`) / its `TemplateTypeChecker`. That
is a deeper-surface call, not strictly an `NgtscProgram` MIGRATION, but it is NOT the
`api.Program` contract either.

Mechanical soundness of a second pass on the SAME program after a WholeProgram abort:

- After the abort, `this.isComplete` is `false` (Q1). A subsequent `ensureAllShimsForOneFile`
  on a survivor that was NEVER reached by the aborted loop works cleanly: `this.state` has no
  entry for it (its `getFileData` at `checker.ts:939` was never called because the loop broke at
  the poison), so SingleFile creates fresh `fileData` (isComplete=false), generates + COMMITS its
  shim. Its template diagnostics ARE recovered.
- PITFALL (order-dependent): for a survivor that WAS iterated BEFORE the poison in the aborted
  WholeProgram loop, `typeCheck(survivorSf, ctx)` succeeded and `fileData.isComplete = true` was
  set DIRECTLY on the impl's fileData (`checker.ts:946`) -- but `updateFromContext(ctx)` (line 949) never ran, so its shims were generated into the now-DISCARDED `ctx` and never committed to
  the type-check program. A later `ensureAllShimsForOneFile(survivorSf)` then hits the
  `if (fileData.isComplete) return;` early-return (`checker.ts:961-963`) and commits NOTHING --
  so that survivor's template diagnostics are NOT recovered by the second pass. Whether a given
  survivor is recoverable thus depends on its position relative to the poison in
  `originalProgram.getSourceFiles()` order. This is a real, non-obvious correctness hazard for a
  naive two-pass-on-the-same-program design.
- A clean two-pass would therefore need either (a) a FRESH program/compiler for the second pass
  (re-run `performCompilation` / re-create NgtscProgram so all `isComplete` flags reset), which
  is essentially "compile twice"; or (b) SingleFile from the START (Option C), avoiding the
  poisoned shared-`ctx` state entirely.
- `incrementalCompilation`: each `updateFromContext` records successful type-check state
  (`priorBuild.recordSuccessfulTypeCheck`, `checker.ts:1040`); a partially-primed-then-aborted
  pass leaves the incremental state inconsistent with what was actually committed. For a
  single-shot cold run this matters only insofar as the pitfall above; there is no reuse across
  runs.

### Q5 -- LANGUAGE SERVICE: how it gets per-file template diagnostics; does it tolerate one file's Fatal

It uses `OptimizeFor.SingleFile` and the per-file-request model, so it structurally isolates
one file's TCB-gen Fatal from others (HIGH, local source).

`packages/language-service/src/language_service.ts:129-157` (`getSemanticDiagnostics(fileName)`):

- For a TS file: `compiler.getDiagnosticsForFile(sourceFile, OptimizeFor.SingleFile)` (line 136).
- For an external template (HTML) file: iterates `getComponentsWithTemplateFile(fileName)` and
  calls `compiler.getDiagnosticsForComponent(component)` (line 143), which uses
  `ensureShimForComponent` (`checker.ts:689`, single-shim isolation) -- also caught per call at
  `compiler.ts:654-670`.
- `getSuggestionDiagnosticsForFile(..., OptimizeFor.SingleFile)` (line 168) likewise.

The editor requests diagnostics ONE file at a time. A poison file's request throws, is caught at
the `compiler.ts` boundary (PR #49527 / commit ed817e3 added this catch precisely for the LS:
"undesirable for the language service" to crash), and returns one diagnostic for THAT file. A
survivor file is a SEPARATE request with its own SingleFile priming, unaffected by the poison.
This is the same `getDiagnosticsForFile` method angular-typechecker calls -- the difference is
purely the `OptimizeFor` argument (SingleFile) and the one-file-at-a-time request model.
(Historical note: vscode-ng-language-service#1881 -- a non-exported host directive crashing
TCB-gen -- and #39040 predate the catch and show the LS could be taken down by one TCB-gen Fatal
before the boundary catch existed.)

### Q6 -- @angular/build REALITY: does its per-file getDiagnosticsForFile loop lose survivors?

REFINES the team's claim (HIGH, local source @ v22.0.4).

`packages/angular/build/src/tools/angular/compilation/aot-compilation.ts`:

- The diagnostics loop (`collectDiagnostics`, lines 225-296) iterates all source files and, for
  affected files, calls
  `angularCompiler.getDiagnosticsForFile(sourceFile, templateDiagnosticsOptimization)` (line 284).
- `templateDiagnosticsOptimization` is set at line 210:
  `affectedFiles.size === 1 ? OptimizeFor.SingleFile : OptimizeFor.WholeProgram`.

Consequences:

- COLD / first build (all files affected -> `affectedFiles.size > 1` -> `WholeProgram`): the
  loop routes through `ensureAllShimsForAllFiles()` and hits the SAME priming-abort limitation --
  a TCB-gen Fatal on one file loses survivors' template diagnostics. So for the cold-build case
  the team's "affects @angular/build identically" is CONFIRMED.
- WATCH-mode incremental rebuild touching exactly ONE file (`affectedFiles.size === 1` ->
  `SingleFile`): the loop routes through `ensureAllShimsForOneFile()` and DOES isolate per file.
  So @angular/build is NOT universally subject to the limitation -- it has a dynamic SingleFile
  path for the single-affected-file case.
- @angular/build runs on a `ts.BuilderProgram` (incremental) but the Angular TEMPLATE
  diagnostics still funnel through the same `NgCompiler.getDiagnosticsForFile` + checker priming;
  the BuilderProgram's incremental caching covers TS (syntactic/semantic) diagnostics
  (lines 257-272) and a `diagnosticCache` for unaffected files' Angular diagnostics
  (lines 290-294), NOT recovery of a survivor whose shim never committed under an aborted
  WholeProgram priming. So the BuilderProgram does not rescue the cold-build case.

### Q7 -- FREQUENCY of TCB-generation Fatals vs ordinary non-fatal template/type errors

MED (error-code taxonomy HIGH from source; real-world frequency MED, inferred from issue
patterns -- no published statistics).

TCB-generation Fatal classes (the ones that throw during shim generation and abort the shared
priming), from `ngtsc/diagnostics/src/error_code.ts` NG30xx import/emit family:

- `SYMBOL_NOT_EXPORTED = 3001`
- `IMPORT_CYCLE_DETECTED = 3003` ("a cyclic import ... cannot be handled")
- `IMPORT_GENERATION_FAILURE = 3004` (the observed poison; "unable to generate an import statement
  for a reference")
  Direct `throw new FatalDiagnosticError(...)` reachable from the TCB reference-emit path at
  v22.0.4: `typecheck/src/reference_emit_environment.ts:52` (IMPORT_GENERATION_FAILURE) and
  `imports/src/emitter.ts:173` (IMPORT_GENERATION_FAILURE). The typecheck module itself has exactly
  ONE such throw site (reference_emit_environment.ts); the import emitter is the other reachable
  source during reference emission. (Other `FatalDiagnosticError`s exist across ngtsc analysis
  phases, but those surface during analyze/`getNonTemplateDiagnostics`, not the template-shim
  priming loop, and are largely caught/converted before this loop.)

By contrast, ordinary template/type errors -- TS semantic codes (e.g. TS2322) and Angular
template/extended diagnostics (NG2xxx, NG8xxx, e.g. NG8109/NG8117) -- are produced by the TS
type-checker AFTER the TCB compiles, or by the extended-check pass; they are returned as
diagnostics, NOT thrown, so they isolate per file fine and never abort priming.

Character of NG3004 in practice (MED): the web-research pass found it framed consistently as a
STRUCTURAL / library-boundary error rather than an everyday app-author template mistake.
Documented triggers: a library symbol not re-exported from its `.d.ts` (NgModule entry not
TS-exported); a non-exported standalone directive referenced via `hostDirectives`
(vscode-ng-language-service#1881); a `@angular/forms` 15.2.0 regression (#49197); Module
Federation / duplicated `@angular/*` in nested node_modules (#64531, closed not-planned); and
library builds with constrained `rootDir` (PR #44587). Net: comparatively RARE and concentrated
in library/monorepo/federation scenarios -- but exactly the throw that, when it fires under
whole-program checking, aborts the shared priming. (Confidence MED: no frequency metrics exist;
this is a qualitative read of the issue corpus.)

### Q8 -- UPSTREAM: Angular GitHub issues/PRs/design docs on TCB-gen error recovery

MED-HIGH (web research; specific issue/PR numbers HIGH, "nothing planned for the loop itself"
MED -- absence of evidence).

What EXISTS (all guard the caller boundary, none makes the priming loop itself per-file
error-tolerant):

- PR #49527 / commit ed817e3 -- "Catch FatalDiagnosticError during template type checking."
  MERGED. Added the try/catch in `compiler.ts` around the template-diagnostic call sites that
  converts a fatal to one diagnostic instead of crashing. Motivated by the language service.
  This is the catch verified at `compiler.ts:599-606` / `626-636` @ v22.0.4.
- PR #50046 / commit 7c58885 -- "catch fatal diagnostic when getting diagnostics for
  components." MERGED. Same handling for `getDiagnosticsForComponent` (the LS external-template
  path). Fixes vscode-ng-language-service#1881.
- PR #48314 / commit 167bc0d -- "Produce diagnostic rather than crash when using invalid
  hostDirective." MERGED. States the design philosophy: hard errors crash the compiler, which is
  "acceptable when compiling a program as part of a regular build" but "undesirable for the
  language service."
- PR #40331 / commit 4db89f4 -- "report non-template diagnostics." MERGED. Split `getDiagnostics`
  (WholeProgram) from `getDiagnosticsForFile` (SingleFile) and established the "iterate file-by-
  file with WholeProgram so memoized shims are reused" guidance -- i.e. the reason iterating
  callers land on the shared-priming path.
- Issue #49194 -- "Run TypeCheck with ngtsc just like tsc --noEmit." CLOSED as not planned
  (2023-02-24). Confirms there is no built-in `ng typecheck` / no maintainer-blessed per-file
  ngtsc type-check path.
- Issues #44999, #39040 -- historical FatalDiagnosticError-not-converted / crash reports
  (pre-catch).

No issue or design doc was found proposing to wrap the per-file body of
`ensureAllShimsForAllFiles` in try/catch so surviving files keep their template diagnostics. The
upstream posture is "convert the propagated fatal to one diagnostic at the boundary" and "use
SingleFile (LS) when you need per-file isolation." (Caveat: the web pass searched `main`, not the
v22.0.4 tag; the design posture is stable across both, but exact line numbers in the PR
descriptions reflect `main`. The MECHANISM line numbers in Q1-Q6 of this doc are all
v22.0.4-verified locally.)

### Q9 -- ALTERNATIVES IN THE WILD: community tools achieving per-file template-diagnostic resilience

LOW-MED (web research; "none found" is HIGH for the search performed, MED for "definitely does
not exist").

- No tool was found that explicitly solves "one component's TCB-gen Fatal hides others." The
  common community pattern is wrapping `ngc --noEmit` in an Nx `nx:run-commands` target
  (e.g. `@clickup/ngx-esbuild` documents replacing `tsc` with `ngc` for template checks, noting
  much higher memory). That path delegates to the same whole-program `performCompilation` and
  inherits the abort behavior.
- Nx's own inferred `typecheck` target is plain `tsc`/`tsgo` (TS-only; no NG8xxx/template
  checks) -- it does not address Angular template diagnostics at all (consistent with this
  project's own positioning).
- Fast per-file compilers DELIBERATELY skip template type-check and tell you to run it elsewhere:
  AnalogJS `fastCompile` (`fastCompileMode: 'partial'`, "offload type checking as a separate
  process"); VoidZero's experimental Oxc Angular compiler ("does not implement ... template
  type-checking"). This corroborates the project's premise but offers no resilient template-check
  alternative.

### Q10 -- Any approach to recover survivors' template diagnostics WITHOUT SingleFile AND WITHOUT NgtscProgram migration?

On the EXISTING `api.Program` surface, with WholeProgram only, and without re-compiling: NO
in-tree mechanism exists (HIGH, local source).

- The `api.Program` per-file overload is hard-wired to `WholeProgram` (`program.ts:241`); there
  is no public lever to change priming mode.
- The abort is structural to the shared-`ctx` loop in `ensureAllShimsForAllFiles` and the fact
  that `updateFromContext` (the commit) runs ONCE after the whole loop. Catching deeper is the
  only place a fix COULD live, and that try/catch is internal to `NgCompiler`/the checker -- not
  reachable or overridable from the `api.Program` surface. (D-05 also forbids adding a catch-all
  in the gatherer; even if added, a catch-all in the gatherer cannot RE-PRIME survivors -- the
  uncommitted shims are gone with the discarded `ctx`.)
- The only "stay on api.Program" recoveries are (a) a SECOND full `performCompilation` /
  fresh-program pass (recompiles from scratch; resets all `isComplete` flags so a fresh
  WholeProgram pass STILL aborts on the same poison -- so this recovers nothing unless the second
  pass EXCLUDES the poison file, which requires identifying it first and editing the program
  input); or (b) accepting that the survivors' template diagnostics are deferred (Option A).
  Neither (a) variant is "free" and (a) without poison-exclusion does not work at all.
- Therefore, recovering survivors' TEMPLATE diagnostics provably requires EITHER `SingleFile`
  priming (reaching `NgCompiler.getDiagnosticsForFile(sf, SingleFile)` / a SingleFile loop) OR an
  NgtscProgram-level migration that drives SingleFile priming -- exactly the two levers D-07 and
  D-04 currently lock out. There is NO third in-tree lever on the WholeProgram `api.Program`
  surface.

---

## OPTION ASSESSMENT (NEUTRAL -- no ranking)

| Option                                                                                                                                                                                                | Viability (v22.0.4)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Performance (cold one-shot)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Risk                                                                                                                                                                                                                                                                                                                                                                                                                                            | Key citations                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (A) Reframe SC2 to the achievable contract: no whole-run collapse; poison yields one diagnostic; survivors' TS + NON-template Angular diagnostics reported; survivors' TEMPLATE diagnostics deferred. | Fully viable; matches the verified behavior of the SHIPPED HYBRID gatherer with zero code change. No SingleFile, no migration -- honors D-04/D-05/D-07 as-is.                                                                                                                                                                                                                                                                                                                                           | Zero added cost (current WholeProgram-primed-once behavior).                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Lowest implementation risk. Risk is purely SPEC/expectation: the literal SC2 wording "surviving files' template/extended diagnostics must still be reported" is NOT met for the TCB-gen-Fatal case. A poison file silently suppresses other files' NG8xxx until the poison is fixed (poison reports, others' templates do not) -- a possible surprise for users/agents, though the run still completes and surfaces the poison + all TS errors. | compiler.ts:591-639 (boundary catch); checker.ts:923-952 (abort); program.ts:241 (WholeProgram hard-wire). Matches 09-02-SUMMARY shipped behavior.                                                |
| (B) Two-pass: WholeProgram normally; on detecting a Fatal, re-gather survivors with SingleFile.                                                                                                       | Partially viable, with a correctness pitfall. SingleFile is NOT reachable via `api.Program`; requires reaching into `program.compiler` (NgCompiler) -- past the locked surface (tension with D-04/D-07). On the SAME program after a WholeProgram abort, survivors iterated BEFORE the poison have `isComplete=true` but uncommitted shims -> SingleFile early-returns and recovers NOTHING for them (order-dependent). A clean second pass needs a FRESH program (recompile) or SingleFile-from-start. | Pays WholeProgram once + SingleFile for survivors on the Fatal path (only when a Fatal occurs). On the common no-Fatal path, no added cost. Worst case approaches Option C's cost for the affected run, plus a possible full recompile if a fresh program is used.                                                                                                                                                                                                                                                                  | Highest correctness risk of the three due to the order-dependent partial-recovery pitfall (Q4): silently recovers SOME survivors and not others depending on file order -- non-deterministic-looking behavior. Also surface-boundary risk (reaching past api.Program).                                                                                                                                                                          | checker.ts:944-950 (isComplete set before commit), 954-975 (SingleFile), 961-963 (early-return guard), 1033-1043 (commit); program.ts:241.                                                        |
| (C) SingleFile always (per file, unconditionally).                                                                                                                                                    | Viable and the most behavior-complete (every survivor's template diagnostics recovered; matches how the Language Service operates). REQUIRES reaching `NgCompiler.getDiagnosticsForFile(sf, OptimizeFor.SingleFile)` or `TemplateTypeChecker` -- past the `api.Program` overload, so it directly contradicts D-07 as written (and arguably brushes D-04's "no deeper-surface" intent, though it is not a full NgtscProgram rewrite).                                                                    | Pays the SingleFile per-file overhead across N files in ONE pass: N incremental program updates + per-file TS re-checks vs one batched WholeProgram update. For a COLD one-shot run this is a constant-factor slowdown (not the pathological repeated-watch-loop case the enum doc warns about). Inline-using files add recompute via clearAllShimDataUsingInlines. No v22 benchmark found; @angular/build's "use WholeProgram when >1 affected file" is indirect evidence maintainers consider multi-file SingleFile loops costly. | Behavior risk LOW (isolates correctly, LS-proven model). Cost risk MED (perf on large programs). Decision risk: requires re-opening D-07. The poison still reports once.                                                                                                                                                                                                                                                                        | checker.ts:602-610, 954-975 (SingleFile path); api/checker.ts:379-398 (overhead warning); language_service.ts:136 (LS precedent); aot-compilation.ts:210 (build's size===1 SingleFile heuristic). |
| (D) Other options surfaced by research                                                                                                                                                                | (D1) Fresh-program re-compile EXCLUDING the identified poison file(s), then WholeProgram-prime the reduced program: would recover ALL survivors' template diagnostics on the WholeProgram fast path, staying on `api.Program`. Viability MED. (D2) Upstream a per-file try/catch inside `ensureAllShimsForAllFiles` (not in scope for this milestone; no such PR exists upstream).                                                                                                                      | D1: pays a second full `performCompilation` on the Fatal path only (cold cost doubled for affected runs). D2: n/a (upstream).                                                                                                                                                                                                                                                                                                                                                                                                       | D1 risk: must reliably identify the poison file(s) from the first pass's Fatal diagnostic (the diagnostic carries `.file`); multiple independent poisons need iteration; recompile cost. Stays within D-04/D-05/D-07 (no SingleFile, no NgtscProgram migration, no catch-all in gatherer). D2 risk: depends on upstream, out of milestone scope.                                                                                                | program.ts:239-242; compiler.ts:591-609; checker.ts:923-952 (fresh program resets isComplete). No upstream loop-level recovery PR found (Q8).                                                     |

---

## SOURCES

HIGH confidence (verified locally at v22.0.4 via `git show v22.0.4:<path>`):

- D:\projects\github\angular\angular @ v22.0.4 (commit 0b1cbbd):
  - packages/compiler-cli/src/ngtsc/program.ts:224-243 (getNgSemanticDiagnostics dispatch; per-file overload hard-codes OptimizeFor.WholeProgram)
  - packages/compiler-cli/src/ngtsc/core/src/compiler.ts:591-609 (getDiagnostics + Fatal catch), 616-639 (getDiagnosticsForFile + Fatal catch), 644-672 (getDiagnosticsForComponent + catch), 1202-1241 (getTemplateDiagnostics[ForFile]), 1243-1291 (getNonTemplateDiagnostics / runAdditionalChecks)
  - packages/compiler-cli/src/ngtsc/typecheck/src/checker.ts:602-649 (getDiagnosticsForFile OptimizeFor branch), 923-952 (ensureAllShimsForAllFiles -- abort site), 954-975 (ensureAllShimsForOneFile), 977-995 (ensureShimForComponent), 1015-1031 (clearAllShimDataUsingInlines), 1033-1043 (updateFromContext -- commit), 1045-1055 (getFileData), 1770-1856 (Whole/SingleFile TypeCheckingHost)
  - packages/compiler-cli/src/ngtsc/typecheck/api/checker.ts:379-398 (OptimizeFor enum + overhead doc)
  - packages/compiler-cli/src/ngtsc/typecheck/src/reference_emit_environment.ts:52-58 (IMPORT_GENERATION_FAILURE throw during TCB reference emit)
  - packages/compiler-cli/src/ngtsc/imports/src/emitter.ts:173 (IMPORT_GENERATION_FAILURE throw)
  - packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts:197,202,207 (SYMBOL_NOT_EXPORTED 3001 / IMPORT_CYCLE_DETECTED 3003 / IMPORT_GENERATION_FAILURE 3004)
  - packages/compiler-cli/src/ngtsc/diagnostics/src/error.ts:14,111 (FatalDiagnosticError / isFatalDiagnosticError)
  - packages/language-service/src/language_service.ts:129-170 (getSemanticDiagnostics uses OptimizeFor.SingleFile + per-file/per-component request model)
- D:\projects\github\angular\angular-cli @ v22.0.4 (commit e197652):
  - packages/angular/build/src/tools/angular/compilation/aot-compilation.ts:38, 205-213 (templateDiagnosticsOptimization = affectedFiles.size===1 ? SingleFile : WholeProgram), 225-296 (collectDiagnostics loop -> getDiagnosticsForFile)

MED confidence (web research, github.com/angular/angular -- searched on `main`, design posture stable to v22.0.4; exact PR-description line numbers reflect main):

- PR #49527 / commit ed817e3 (catch FatalDiagnosticError during template type checking)
- PR #50046 / commit 7c58885 (catch fatal in getDiagnosticsForComponent)
- PR #48314 / commit 167bc0d (diagnostic-not-crash for invalid hostDirective; design philosophy quote)
- PR #40331 / commit 4db89f4 (split getDiagnostics WholeProgram vs getDiagnosticsForFile SingleFile)
- Issue #49194 (Run TypeCheck with ngtsc -- closed not planned)
- vscode-ng-language-service #1881 (non-exported host directive crashes TCB-gen -- canonical NG3004-class repro)
- Issues #44999, #39040, #45529, #42910, #49197, #64531; PR #44587 (NG3004 real-world trigger corpus)

LOW-MED confidence (web research, ecosystem; "none found" reflects the search performed):

- @clickup/ngx-esbuild docs (ngc --noEmit wrapping pattern); Nx TypeScript typecheck target docs (tsc-only)
- AnalogJS fastCompile / fastCompileMode 'partial' (offload type-checking); VoidZero Oxc Angular compiler (no template type-check)
- No community tool found providing per-file template-diagnostic resilience against TCB-gen Fatals
