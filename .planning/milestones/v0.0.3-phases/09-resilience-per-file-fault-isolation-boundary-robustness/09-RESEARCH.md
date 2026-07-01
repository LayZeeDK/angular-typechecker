# Phase 9: Resilience (per-file fault isolation + boundary robustness) - Research

**Researched:** 2026-06-29
**Domain:** `@angular/compiler-cli` `api.Program` diagnostic gathering + TypeScript config/boundary robustness (Nx plugin core engine), verified at STABLE Angular v22.0.4
**Confidence:** HIGH (every version-sensitive claim verified against `git show v22.0.4:<path>` in the local Angular clones AND against the installed `@angular/compiler-cli@22.0.4` / `typescript@6.0.3`; all four engine edit-point anchors confirmed present at the lines CONTEXT.md names)

## Summary

This phase hardens an EXISTING, already-complete-and-faithful whole-program no-emit `runTypecheck` engine against three fault classes (one poisoned component, a throwing `realpath()`, an output-path nuisance), gated by a spike (RES-01) that settles the per-file isolation shape before any isolation code is written. It is targeted resilience hardening on the existing `api.Program` surface -- NOT a rewrite, NOT an `NgtscProgram` migration. The locked decisions (D-01..D-09 in 09-CONTEXT.md) are binding; this research documents HOW to execute them, confirms every version-sensitive claim at v22.0.4, surfaces the test/fixture mechanics the planner needs, and resolves two of the three flagged caveats with new compiler-source evidence.

The four changes touch four files at the exact anchors CONTEXT.md names (all confirmed live): RES-02 replaces the single `program.getNgSemanticDiagnostics()` (`gather-diagnostics.ts:34`) with a per-file (or HYBRID) loop; RES-03 wraps `options.realpath(filePath)` (`filter-diagnostics.ts:127`) in try/catch; RES-04 passes `suppressOutputPathCheck: true` as the `readConfiguration` second arg (`run-typecheck.ts:105`). RES-01 is a gated spike that must EMPIRICALLY run the live compiler against a fixture and inspect `d.file` on the gathered Angular non-template diagnostics -- static code reading establishes the mechanism (the `d.file === file` filter exists and would drop any file-less non-template diagnostic) but only a runtime probe can prove whether such file-less diagnostics actually occur in the no-emit path.

**Primary recommendation:** Plan RES-01 as a throwaway empirical spike (probe + recorded GO artifact, no production code) that gates RES-02; default to HYBRID on any inconclusive result (D-03). Implement RES-02/03/04 each as a dedicated failing-then-passing fixture + spec on the established `runTypecheck`-against-a-workspace-root-`fixtures/`-tsconfig idiom. For RES-04, the placement-timing caveat is RESOLVED by compiler-source evidence (below): the output-path check fires inside `createProgram` gated by `!noEmit`, never inside `readConfiguration`, so `noEmit: true` alone already suppresses it and the `readConfiguration`-second-arg placement (D-09) is correct and safe -- a fixture confirms it, but the "fires too late in `parsed.errors`" hazard does not exist.

## Architectural Responsibility Map

| Capability                                                      | Primary Tier                                                                         | Secondary Tier                                                                    | Rationale                                                                                                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| RES-01 spike: detect file-less Angular non-template diagnostics | Core engine (gather path)                                                            | --                                                                                | The spike exercises the live `api.Program` returned by `performCompilation`; it is a core-engine probe, no adapter involved                         |
| RES-02 per-file fault-isolated Angular gathering                | Core engine (`gather-diagnostics.ts`, the `gatherDiagnostics` callback)              | --                                                                                | The gatherer runs INSIDE `performCompilation`'s outer try/catch (`run-typecheck.ts:192`); pure compiler-surface work, framework-agnostic            |
| RES-03 throwing-realpath robustness                             | Core engine (`filter-diagnostics.ts`, the post-`performCompilation` boundary filter) | --                                                                                | The boundary filter is a pure, dependency-free pass; the `realpath` impl is INJECTED (`ts.sys.realpath` in prod, a stub in tests)                   |
| RES-04 `suppressOutputPathCheck`                                | Core engine (`run-typecheck.ts`, the `readConfiguration` call + options bag)         | TypeScript option (consumed by `ts.parseJsonConfigFileContent` / `createProgram`) | A TS compiler option flowed through the existing options bag; the boundary is the config-resolution + program-creation seam, not an adapter concern |

All four capabilities live in `**/src/core/**` -- the PURE, framework-agnostic tier (eslint bans `@nx/*` / `@angular-devkit/*` imports AND `process.exit` / `console` there). No executor/adapter change in this phase. `[VERIFIED: eslint.config.mjs:16-64]`

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**RES-01 -- GATE spike: settle the per-file isolation shape (FIRST plan; gates RES-02)**

- **D-01:** RES-01 is the FIRST plan and a HARD GATE on RES-02 -- RES-02 does not start until the spike returns a recorded GO. The spike must EMPIRICALLY determine the one load-bearing open question (PRIOR-ART #3 / ENGINE-REF Open Q3): whether any Angular non-template diagnostics (`traitCompiler.diagnostics` / `checkForPrivateExports`) are file-less (`d.file === undefined`) in the no-emit path. `NgCompiler.getDiagnosticsForFile` filters the non-template set by `d.file === file` (`compiler.ts:618` @ v22.0.4), so a naive per-file loop would silently DROP any file-less non-template diagnostic.
- **D-02:** GO/NO-GO criteria for the shape:
  - **SIMPLE** (a per-file `getNgSemanticDiagnostics(sf.fileName)` loop ONLY) is chosen ONLY IF the spike POSITIVELY proves no file-less Angular non-template diagnostics exist in the no-emit path.
  - **HYBRID** (gather the file-less non-template set ONCE whole-program + loop the template/extended families per file) otherwise.
- **D-03:** Inconclusive-fallback = **HYBRID**. If the spike cannot positively prove SIMPLE is loss-free, default to HYBRID -- it is the strict superset that can never under-gather. SIMPLE is an optimization valid ONLY under a proven precondition; absence of evidence is not proof of absence. The spike's GO decision (shape + the file-less finding that justified it) is recorded as a durable artifact the phase verifier checks.

**RES-02 -- Per-file fault isolation (post-gate, on the existing api.Program surface)**

- **D-04:** Implement via `program.getNgSemanticDiagnostics(sf.fileName)` per file. The `fileName?` overload is ALREADY declared on the vendored shim (`compiler-cli-types.ts:76-79`) and delegates to `compiler.getDiagnosticsForFile(sf, OptimizeFor.WholeProgram)` (`program.ts:224-243` @ v22.0.4). NO `NgtscProgram` migration; NO shim widening required.
- **D-05:** Fault-isolation scope = rely on `getDiagnosticsForFile`'s OWN per-file `isFatalDiagnosticError` try/catch (`compiler.ts:631-636`): one component's `FatalDiagnosticError` yields exactly ONE diagnostic (`err.toDiagnostic()`) and the loop CONTINUES. Do NOT add a catch-all per-file try/catch: a non-fatal / infra throw must STILL surface as `UNKNOWN_ERROR_CODE` 500 -> `TypecheckInfrastructureError` (preserves the Phase 8 infra-vs-type policy, `08-CONTEXT.md` D-06; `run-typecheck.ts:195-206`). RES-02's contract is FatalDiagnosticError isolation ONLY.
  - **CAVEAT (flagged):** ENGINE-REF Open Q1 -- a NON-fatal throw still collapses the whole run to one 500 at the `performCompilation` boundary. Isolating non-fatal escapes per file is DEFERRED. Revisit ONLY if a real non-fatal escape is observed in practice.
- **D-06:** Iterate `program.getTsProgram().getSourceFiles()`; skip `sf.isDeclarationFile`. The overload internally resolves the source file and no-ops on files not in the program / shim files (`program.ts:231-235`), so `.ngtypecheck.ts` shims are not double-processed. Output set is unchanged on clean / ordinarily-erroring programs; determinism preserved by the existing `ts.sortAndDeduplicateDiagnostics` in `finalize` (`run-typecheck.ts:347`). `getNonTemplateDiagnostics` is memoized (`compiler.ts:1244`).
- **D-07:** Use `OptimizeFor.WholeProgram` (the implicit mode of the `fileName` overload) so the FIRST per-file call primes `ensureAllShimsForAllFiles()` once and subsequent calls are cheap cache reads. NEVER `OptimizeFor.SingleFile` in a loop.
- **Edit point:** `gather-diagnostics.ts` -- replace the single `program.getNgSemanticDiagnostics()` (line 34) with the per-file loop (SIMPLE) or the once-whole-program-non-template + per-file-template structure (HYBRID), per the RES-01 GO decision.

**RES-03 -- Throwing realpath() robustness in the boundary filter**

- **D-08:** Wrap the `options.realpath(filePath)` call INSIDE `createCanonicalizer` (`filter-diagnostics.ts:127`) in try/catch. On throw, fall back to the UNRESOLVED raw `filePath`, then STILL apply the `\\` -> `/` normalization and the case-fold so the fallback path classifies consistently. Silent fallback -- core is PURE (eslint bans `process.exit` / side effects in `**/src/core/**`; no logging). The per-input memoization cache still applies. Happy path is unchanged.

**RES-04 -- suppressOutputPathCheck in the no-emit flow**

- **D-09:** Pass `suppressOutputPathCheck: true` as the `existingOptions` SECOND ARG to `ng.readConfiguration(options.tsConfigPath, { suppressOutputPathCheck: true })` (`run-typecheck.ts:105`) -- matching `@angular/build` EXACTLY (`angular-compilation.ts:51` @ v22.0.4). The `readConfiguration(project, existingOptions?)` signature is ALREADY declared on the shim (`compiler-cli-types.ts:155-158`); no shim change. `ts.CompilerOptions` carries an index signature, so the extra key type-checks.
  - **CAVEAT (flagged -- reasoned deviation from ENGINE-REF #4):** ENGINE-REF #4 prefers the override object for locality. D-09 DEVIATES: the override-object placement (AFTER `readConfiguration` ran) MAY be too late if a nuisance error were already folded into `parsed.errors`. Planner/spike CONFIRMS with a fixture which placement actually suppresses an output-path nuisance error; if the override-object placement proves equivalent under `noEmit: true`, either is acceptable. Safe under `noEmit: true` either way.

### Claude's Discretion

- Exact loop structure / helper extraction in `gather-diagnostics.ts`; for HYBRID, whether to keep a single residual whole-program `getNgSemanticDiagnostics()` for the non-template portion or to filter it.
- Fixture mechanics for the test-gated (failing-then-passing) changes: RES-02 needs a multi-file fixture with one TCB-poisoning component (throws `FatalDiagnosticError`) + a SECOND component with a normal template error; RES-03 needs a throwing-`realpath` stub; RES-04 needs a config that triggers an output-path nuisance error.
- Spike (RES-01) mechanics: the fixture(s) and the method used to detect file-less non-template diagnostics, and the exact form of the recorded GO artifact.

### Deferred Ideas (OUT OF SCOPE)

- **Isolating NON-fatal per-file escapes** (our own try/catch around each per-file call) -- ENGINE-REF Open Q1. Deferred: it would reclassify infra/non-fatal crashes as per-file diagnostics, contradicting the Phase 8 infra-vs-type policy. Revisit only if a real non-fatal escape is observed.
- **Phase 10 (HARD) items** -- the drift `tsconfig.drift.json` getter-set tripwire, `EmitFlags.None` fix, vendor markers, retained `getNgStructuralDiagnostics()` under assertion, the TS-99 leak regression spec. Out of this phase. Cross-phase note: Phase 10 HARD-01's getter-set assertion must cover whatever getter set RES-02 leaves in `gather-diagnostics.ts` (incl. the per-file `getNgSemanticDiagnostics(fileName)` usage and COR-02's `getGlobalDiagnostics`).
- **`NgtscProgram` migration / incremental / `--watch`** -- RES-02 stays on the existing `api.Program` surface (PROJECT.md Out of Scope).
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID                  | Description                                                                                                                                                                                                                                                  | Research Support                                                                                                                                                                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RES-01 [GATE/spike] | Determine whether any Angular non-template diagnostics (`traitCompiler` / `checkForPrivateExports`) are file-less / unreachable through a per-file `getDiagnosticsForFile` `d.file === file` filter; produce a GO decision (SIMPLE vs HYBRID). Gates RES-02. | Mechanism verified at v22.0.4: `getNonTemplateDiagnostics()` = `traitCompiler.diagnostics` + `checkForPrivateExports` (`compiler.ts:1243-1258`); `getDiagnosticsForFile` filters it by `.filter((diag) => diag.file === file)` (`compiler.ts:618`). Spike design (probe + GO artifact) below.                                            |
| RES-02              | Angular gathering fault-isolated per file so one `FatalDiagnosticError` yields one diagnostic and does NOT abandon remaining files -- on the existing `api.Program` surface.                                                                                 | `getNgSemanticDiagnostics(fileName)` -> `getDiagnosticsForFile(sf, OptimizeFor.WholeProgram)` with its OWN per-file `isFatalDiagnosticError` try/catch verified at v22.0.4. TCB-phase Fatal trigger identified: `IMPORT_GENERATION_FAILURE` (`reference_emit_environment.ts:52`). Multi-file fixture design below.                       |
| RES-03              | A throwing `realpath()` in the boundary filter is caught (falls back to unresolved path) so a filesystem failure cannot abort the pass.                                                                                                                      | Single edit point `createCanonicalizer` (`filter-diagnostics.ts:127`); `realpath` is injected via `FilterOptions` -> a throwing-stub unit test is the established `filter-diagnostics.spec.ts` idiom. Design below.                                                                                                                      |
| RES-04              | The no-emit override sets `suppressOutputPathCheck: true` so output-path nuisance errors never surface.                                                                                                                                                      | Resolved at TS-source level: the check fires in `createProgram` gated by `!options.noEmit && !options.suppressOutputPathCheck` (typescript.js:129892), NOT in `readConfiguration`. `noEmit: true` already suppresses it; D-09's second-arg placement matches `@angular/build` exactly. Placement caveat resolved + fixture design below. |

</phase_requirements>

## Standard Stack

No new packages. This phase edits four existing core files using the already-installed, locked toolchain. Verified against the correct (npm) registry via the installed manifests:

| Library                 | Version (installed, verified)                                             | Purpose                                                                                                                   | Why Standard                                              |
| ----------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `@angular/compiler-cli` | `22.0.4` `[VERIFIED: node_modules manifest]`                              | The type-check engine reached via `await import()`; the `api.Program` surface RES-02 loops over                           | Locked peer (PROJECT.md); the only stable Angular 22 line |
| `typescript`            | `6.0.3` `[VERIFIED: node_modules manifest]`                               | The compiler substrate; `ts.Diagnostic` / `ts.SourceFile` shapes; `suppressOutputPathCheck` is a `ts.CompilerOptions` key | Locked peer (`>=6.0.0 <6.1.0`)                            |
| `vitest`                | `4.x` (via `@nx/vitest:test`) `[CITED: project.json + vitest.config.mts]` | Test runner for all RES specs                                                                                             | Locked test runner (PROJECT.md / STATE.md)                |

**Installation:** none -- no dependency change. This phase MUST NOT add any package.

**Version verification:** Confirmed installed `typescript@6.0.3` and `@angular/compiler-cli@22.0.4` via `node -e "require(p+'/package.json').version"` against the correct ecosystem (npm/`node_modules`). These match the locked stack in CLAUDE.md / PROJECT.md exactly. No new package to verify.

## Package Legitimacy Audit

> Not applicable -- this phase installs NO external packages. All four changes edit existing `**/src/core/**` files against the already-installed, locked, peer-pinned toolchain (`@angular/compiler-cli@22.0.4`, `typescript@6.0.3`, `vitest` via `@nx/vitest:test`). slopcheck / registry-legitimacy gating is moot: no install occurs. If a future plan attempts to add a package to satisfy any RES requirement, that is a scope violation -- RES-01..04 are all reachable on the existing surface (verified).

## Architecture Patterns

### System Architecture Diagram

```
runTypecheck(options)                          [run-typecheck.ts]
  |
  |-- loadCompilerCli()  (await import ESM)     -- unchanged
  |-- loadTypescript()                          -- unchanged
  |
  |-- ng.readConfiguration(tsConfigPath, {      <== RES-04 EDIT (:105)
  |        suppressOutputPathCheck: true })         second-arg existingOptions
  |        |
  |        '-> parsed { rootNames, options(+basePath), errors }
  |
  |-- [COR-01] scan parsed.errors for code 500 -> throw TypecheckInfrastructureError  -- unchanged
  |-- fold parsed.errors into configDiagnostics                                       -- unchanged
  |-- zero-rootNames guard -> synthesized Error (early return)                         -- unchanged
  |
  |-- ng.performCompilation({                   -- the emit-neutralizing override (:166-193) unchanged
  |        rootNames,
  |        options: {...parsed.options, noEmit:true, composite:false, ...},
  |        emitFlags: 0,
  |        gatherDiagnostics: gatherAllDiagnostics   <== the callback below
  |      })
  |        |
  |        |  outer try/catch: ANY escaped throw -> ONE UNKNOWN_ERROR_CODE 500
  |        |  (perform_compile.ts:313-323) -- this is WHY a non-fatal escape
  |        |  still collapses the run (D-05 caveat; left intact by design)
  |        |
  |        '-> gatherAllDiagnostics(program)     [gather-diagnostics.ts]
  |               getTsOptionDiagnostics()                       -- unchanged
  |               getNgOptionDiagnostics()                       -- unchanged
  |               getTsSyntacticDiagnostics()                    -- unchanged
  |               getTsSemanticDiagnostics()                     -- unchanged
  |               getNgStructuralDiagnostics()                   -- unchanged (no-op @ 22.0.4)
  |               getNgSemanticDiagnostics()        <== RES-02 EDIT (:34)
  |                  REPLACE single whole-program call WITH:
  |                  SIMPLE:  for sf of getTsProgram().getSourceFiles():
  |                             if sf.isDeclarationFile continue
  |                             push ...getNgSemanticDiagnostics(sf.fileName)
  |                  HYBRID:  push ...getNgSemanticDiagnostics()  (whole-program, non-template kept)
  |                           PLUS per-file template loop      (per RES-01 GO)
  |               getTsProgram().getGlobalDiagnostics()  [COR-02]  -- unchanged
  |
  |-- [COR-01b] scan result.diagnostics for code 500 -> throw   -- unchanged
  |
  '-- finalize(... , filter)                     [run-typecheck.ts + filter-diagnostics.ts]
         filterDiagnostics(diagnostics, { basePath, realpath: ts.sys.realpath, ... })
            createCanonicalizer(options)          [filter-diagnostics.ts]
               real = options.realpath(filePath)  <== RES-03 EDIT (:127)
                  WRAP in try/catch -> on throw, fall back to raw filePath,
                  THEN normalize \\->/ + case-fold (cache still applies)
         ts.sortAndDeduplicateDiagnostics(kept)   -- the determinism guarantee, unchanged (:347)
         count Error / Warning categories         -- unchanged
```

### Pattern 1: The gatherer is a pluggable callback inside performCompilation's try/catch

**What:** `gatherAllDiagnostics` is passed as `performCompilation`'s `gatherDiagnostics` callback (`run-typecheck.ts:192`). The per-file calls run INSIDE `performCompilation`'s outer try/catch.
**When to use:** RES-02 must keep the loop inside this callback (do NOT lift it out and add an outer try/catch -- that would isolate non-fatal escapes, which D-05 explicitly defers).
**Consequence:** A `FatalDiagnosticError` is caught per-file by `getDiagnosticsForFile`'s OWN try/catch and never escapes the callback. A NON-fatal throw escapes to `performCompilation`'s outer catch -> one 500 -> `TypecheckInfrastructureError` (the Phase 8 infra signal, preserved).

```
// Source: angular/packages/compiler-cli/src/perform_compile.ts:255-326 @ v22.0.4 [VERIFIED: git show v22.0.4]
// the gatherDiagnostics(program!) call sits inside a try; any escaped throw ->
// ONE { category: Error, code: UNKNOWN_ERROR_CODE, file: undefined } diagnostic.
```

### Pattern 2: Per-file Angular gathering via the fileName overload (RES-02 SIMPLE shape)

**What:** Reach `getDiagnosticsForFile` from the EXISTING `api.Program` surface via `getNgSemanticDiagnostics(sf.fileName)`. No `NgtscProgram` migration, no shim widening (the `fileName?` overload is already declared on the shim).

```ts
// Source: angular/packages/compiler-cli/src/ngtsc/program.ts:224-243 @ v22.0.4 [VERIFIED: git show v22.0.4]
getNgSemanticDiagnostics(fileName?, cancellationToken?): readonly ts.Diagnostic[] {
  let sf: ts.SourceFile | undefined = undefined;
  if (fileName !== undefined) {
    sf = this.tsProgram.getSourceFile(fileName);
    if (sf === undefined) {
      return [];                          // out-of-program no-op (shim parity, D-06)
    }
  }
  if (sf === undefined) {
    return this.compiler.getDiagnostics();                         // whole-program
  } else {
    return this.compiler.getDiagnosticsForFile(sf, OptimizeFor.WholeProgram);  // per-file, isolated
  }
}
```

The SIMPLE loop shape in `gather-diagnostics.ts`:

```ts
// SIMPLE -- chosen ONLY if RES-01 positively proves no file-less non-template diagnostics
for (const sf of program.getTsProgram().getSourceFiles()) {
  if (sf.isDeclarationFile) {
    continue;
  }
  all.push(...program.getNgSemanticDiagnostics(sf.fileName));
}
```

### Pattern 3: The d.file === file filter is the load-bearing risk (RES-01 charter)

**What:** Inside `getDiagnosticsForFile`, the non-template set is filtered to the current file:

```ts
// Source: angular/packages/compiler-cli/src/ngtsc/core/src/compiler.ts:616-639 @ v22.0.4 [VERIFIED: git show v22.0.4]
getDiagnosticsForFile(file: ts.SourceFile, optimizeFor: OptimizeFor): ts.Diagnostic[] {
  const diagnostics: ts.Diagnostic[] = [
    ...this.getNonTemplateDiagnostics().filter((diag) => diag.file === file),   // <-- THE FILTER
  ];
  try {
    diagnostics.push(
      ...this.getTemplateDiagnosticsForFile(file, optimizeFor),
      ...this.runAdditionalChecks(file),
    );
  } catch (err: unknown) {
    if (!isFatalDiagnosticError(err)) {
      throw err;                          // non-fatal escapes (D-05 caveat)
    }
    diagnostics.push(err.toDiagnostic()); // ONE diagnostic; loop continues (RES-02)
  }
  return this.addMessageTextDetails(diagnostics);
}
```

```ts
// getNonTemplateDiagnostics = traitCompiler.diagnostics + checkForPrivateExports
// Source: compiler.ts:1243-1258 @ v22.0.4 [VERIFIED: git show v22.0.4]
private getNonTemplateDiagnostics(): ts.Diagnostic[] {
  if (this.nonTemplateDiagnostics === null) {
    const compilation = this.ensureAnalyzed();
    this.nonTemplateDiagnostics = [...compilation.traitCompiler.diagnostics];   // memoized (D-06)
    if (this.entryPoint !== null && compilation.exportReferenceGraph !== null) {
      this.nonTemplateDiagnostics.push(
        ...checkForPrivateExports(this.entryPoint, ..., compilation.exportReferenceGraph),
      );
    }
  }
  return this.nonTemplateDiagnostics;
}
```

**The risk:** ANY non-template diagnostic whose `.file` is `undefined` (or not strictly `===` an iterated source file) is dropped by EVERY per-file call -> lost from a SIMPLE loop's union. The RES-01 spike must empirically prove such diagnostics do not occur (-> SIMPLE) or default to HYBRID (-> gather the non-template set once whole-program, which does NOT filter by file).

### Anti-Patterns to Avoid

- **Adding an outer/per-call try/catch around the per-file gather (RES-02):** reclassifies non-fatal/infra throws as per-file diagnostics, blurring the Phase 8 infra-vs-type policy. D-05 explicitly forbids this; rely on `getDiagnosticsForFile`'s OWN try/catch.
- **`OptimizeFor.SingleFile` in the loop:** the enum doc warns of "significant unnecessary overhead" -- `SingleFile` re-primes program state each call. The no-arg `fileName` overload implicitly uses `WholeProgram`, which primes `ensureAllShimsForAllFiles()` once; subsequent calls are cache reads. Use `WholeProgram` (D-07). `[CITED: typecheck/api/checker.ts:388-405 @ v22.0.4]`
- **Reading `process.cwd()` / logging / `process.exit` in the realpath fallback (RES-03):** core is PURE; the fallback must be SILENT (no logging). `[CITED: eslint.config.mjs:54-63]`
- **Forcing `strictTemplates: true` or any emit/codegen override beyond the existing neutralizers:** would invent or suppress diagnostics relative to a faithful check. RES-04 adds ONLY `suppressOutputPathCheck` (the one `@angular/build` override with a no-emit-relevant effect); do NOT copy `supportTestBed:false` / `supportJitMode:false` / `annotationsAs` etc. `[CITED: ENGINE-REF #4/#6, PRIOR-ART "do NOT change"]`
- **Re-parsing the tsconfig by hand for RES-04:** `readConfiguration` walks the `extends` chain for `angularCompilerOptions` -- pre-parsing loses that merge. Keep passing the path to `readConfiguration`. `[CITED: COMPILER-CLI-INTERNALS readAngularCompilerOptions]`

## Don't Hand-Roll

| Problem                                            | Don't Build                                                             | Use Instead                                                                                                      | Why                                                                                                                                                                     |
| -------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-file Angular fault isolation                   | A custom per-file try/catch wrapping each Angular check                 | `getNgSemanticDiagnostics(sf.fileName)` -> `getDiagnosticsForFile`'s built-in `isFatalDiagnosticError` try/catch | Angular already isolates exactly the FatalDiagnosticError class per file; a hand-rolled catch would catch the WRONG class (non-fatal/infra) and blur the Phase 8 policy |
| Shim/declaration skipping in the per-file loop     | A bespoke `adapter.isShim()` reimplementation                           | Skip `sf.isDeclarationFile` + rely on the `fileName` overload's out-of-program no-op (`return []`)               | `adapter.isShim` is private; the overload's `getSourceFile(fileName)` returns the real source file and no-ops on files not in the user program (shims) -- verified      |
| Diagnostic dedup/ordering after the per-file union | Manual de-duplication of repeated non-template diagnostics              | The existing `ts.sortAndDeduplicateDiagnostics` in `finalize` (`run-typecheck.ts:347`)                           | Already runs unconditionally; the per-file union's repeated non-template entries are deduped for free; determinism preserved                                            |
| realpath symlink resolution                        | A custom symlink walker / `fs.realpathSync` call in core                | The injected `options.realpath` (prod: `ts.sys.realpath`) wrapped in try/catch                                   | The impl is already injected + memoized; RES-03 only adds the throw-safety wrapper, not new resolution logic                                                            |
| Output-path nuisance suppression                   | A post-hoc filter that drops TS5055/"would overwrite"-class diagnostics | `suppressOutputPathCheck: true` (and/or `noEmit: true`, which already gates the check)                           | The compiler exposes the exact knob; filtering after the fact is fragile and would mask real diagnostics                                                                |

**Key insight:** Every RES requirement has a first-class compiler/TypeScript affordance reachable from the EXISTING surface -- the engine is already complete and faithful; this is plumbing existing knobs, not building new mechanisms.

## Common Pitfalls

### Pitfall 1: The spike reads as "obviously SIMPLE" from static analysis -- but absence of evidence is not proof of absence

**What goes wrong:** A reviewer reads `getDiagnosticsForFile`, sees the `d.file === file` filter, runs one clean fixture, sees no dropped diagnostics, and concludes SIMPLE is safe.
**Why it happens:** `traitCompiler.diagnostics` USUALLY carry a `.file` (the decorated class's source file), so a casual probe finds none file-less. But `checkForPrivateExports` (entry-point publishable-lib path) and certain analysis diagnostics can in principle be file-less or attached to a different `ts.SourceFile` object than the one iterated.
**How to avoid:** The spike must (a) construct a fixture that actually EXERCISES the non-template families (a `traitCompiler` diagnostic AND, ideally, a publishable-entry-point `checkForPrivateExports` diagnostic), (b) inspect `d.file` on the WHOLE-PROGRAM `getNonTemplateDiagnostics` output and compare against the per-file union, and (c) default to HYBRID if it cannot POSITIVELY enumerate every non-template diagnostic as file-bearing-and-matched. Per D-03, inconclusive -> HYBRID.
**Warning signs:** A GO=SIMPLE decision justified by "I didn't see any file-less ones" rather than "I proved the union is identical to the whole-program non-template set on a fixture that produces them."

### Pitfall 2: Picking a FatalDiagnosticError that fires during ANALYSIS, not TCB generation (RES-02 fixture)

**What goes wrong:** The RES-02 fixture uses a component whose Fatal fires in a trait/annotation handler (e.g. a malformed `input()`/`query()` initializer). That Fatal is caught during ANALYSIS and lands in `traitCompiler.diagnostics` (the non-template set) -- it does NOT exercise `getDiagnosticsForFile`'s per-file template try/catch, so the fixture does not prove the RES-02 contract.
**Why it happens:** Most `throw new FatalDiagnosticError` sites are in `annotations/**` (analysis phase), not in the typecheck subtree.
**How to avoid:** Use a Fatal thrown during TCB GENERATION. The citable v22.0.4 trigger is `IMPORT_GENERATION_FAILURE` from `reference_emit_environment.ts:52` (`referenceTcbValue` -> "Unable to import symbol ...") -- raised when a symbol referenced in a component's template cannot be emitted into the type-check block (e.g. a non-exported / local-only symbol used in the template). The fixture's poisoned component must trigger this DURING template type-checking, while a SECOND component carries a plain template error (e.g. an NG8109 or a TS2322 in its template binding) that today vanishes and post-change survives.
**Warning signs:** The "poisoned" diagnostic appears even in the CURRENT whole-program path (meaning it was an analysis diagnostic all along) -- then the fixture does not demonstrate the abandon-remaining-files behavior.

### Pitfall 3: Assuming the RES-04 output-path nuisance arrives via parsed.errors (the D-09 caveat) -- it does not

**What goes wrong:** Planning the RES-04 fixture/placement around "the nuisance error is folded into `parsed.errors` by `readConfiguration`, so the second-arg placement is needed to be early enough."
**Why it happens:** The D-09 caveat hypothesizes the check "fires during config resolution." Source evidence contradicts this.
**How to avoid:** The output-path overwrite check is in TypeScript's `verifyCompilerOptions()`, which runs at the END of `createProgram` (typescript.js:127878), gated by `if (!options.noEmit && !options.suppressOutputPathCheck)` (typescript.js:129892). It produces `programDiagnostics` ("Cannot write file '0' because it would overwrite input file" / "...overwritten by multiple input files"), surfaced via `getOptionsDiagnostics()` -> our `getTsOptionDiagnostics()`. It is NOT produced by `readConfiguration` (which only runs `ts.parseJsonConfigFileContent`). Consequence: (1) `noEmit: true` ALONE already suppresses it -- the engine's existing override may mean a fixture struggles to produce the nuisance at all unless it deliberately unsets `noEmit`; (2) BOTH placements (the `readConfiguration` second arg AND the `performCompilation` options-bag override) flow into the SAME `options` object `createProgram` reads, so both are early enough. The D-09 second-arg placement matches `@angular/build` exactly and is correct; the "too late" hazard does not exist.
**Warning signs:** A RES-04 fixture that cannot reproduce the nuisance error even WITHOUT `suppressOutputPathCheck` -- because `noEmit:true` already killed it. See "Open Questions" for the fixture-design implication.

### Pitfall 4: NG extended codes are NEGATIVE-encoded; assert via NG(), TS codes raw

**What goes wrong:** A spec asserts on bare `8109` for an Angular extended diagnostic and never matches (the real code is `-998109`).
**Why it happens:** Angular encodes extended codes as `ngErrorCode(8109) = -998109`.
**How to avoid:** Reuse the established `const NG = (code) => -990000 - code;` helper for Angular extended codes; assert raw positive codes for TypeScript diagnostics (TS2322, TS2318, TS5055, etc.). `[CITED: run-typecheck.integration.spec.ts:17, config-resolution.integration.spec.ts:30]`
**Warning signs:** A green-looking `.not.toContain(8109)` that is vacuously true.

### Pitfall 5: Cold-compiler integration specs need the raised timeout

**What goes wrong:** A new `*.integration.spec.ts` flakes with a 5000ms timeout on Windows arm64.
**Why it happens:** Each real-compiler spec cold-loads ESM `@angular/compiler-cli` + runs a whole-program no-emit check.
**How to avoid:** The shared `vitest.config.mts` already sets `testTimeout: 30000` / `hookTimeout: 30000` (raised while gating COR-02). New RES integration specs inherit this; do NOT add per-file timeouts. `[CITED: vitest.config.mts:24-25]`

## Runtime State Inventory

> This is a code/config-only hardening phase (no rename/refactor of stored identifiers, no migration). The five categories are answered explicitly for completeness:

| Category            | Items Found                                                                                                                                                                                                                       | Action Required                         |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Stored data         | None -- no datastore, collection name, key, or user_id is touched. Verified: the engine is pure compilation; no persistence.                                                                                                      | none                                    |
| Live service config | None -- no external service config (n8n/Datadog/etc.) is involved; this is a library engine.                                                                                                                                      | none                                    |
| OS-registered state | None -- no OS task/process registration. Nx cache keys are content-derived from source (the cacheable executor target is unchanged by these core edits).                                                                          | none                                    |
| Secrets/env vars    | None -- no secret/env-var name is referenced or renamed. (`FORCE_COLOR`/`NO_COLOR` are read by the formatter, untouched here.)                                                                                                    | none                                    |
| Build artifacts     | The plugin is built via `@nx/js:tsc` to `dist/`; the `test` target `dependsOn: ["build"]`. After editing core `.ts`, the standard `nx test` rebuild covers it. No stale egg-info / global-install analog (CJS build output only). | none beyond normal `nx build`/`nx test` |

**Nothing found in any category** -- verified by inspecting the four edit-point files (all pure compilation logic) and the project graph (no persistence, no external service, no OS registration).

## Code Examples

### RES-03: the realpath try/catch inside createCanonicalizer (the only edit)

```ts
// Source: filter-diagnostics.ts:115-136 (current) [VERIFIED: read 2026-06-29]
// CURRENT (:127):
//   const real = options.realpath(filePath).replace(/\\/g, '/');
//
// RES-03 / D-08 shape (silent fallback, normalization + case-fold still applied,
// cache untouched):
function createCanonicalizer(options): (filePath: string) => string {
  const cache = new Map<string, string>();
  return (filePath: string): string => {
    const cached = cache.get(filePath);
    if (cached !== undefined) {
      return cached;
    }
    let resolved: string;
    try {
      resolved = options.realpath(filePath);
    } catch {
      // D-08: a throwing realpath (EACCES/permission-denied junction/broken
      // symlink) must not abort the whole pass. Fall back to the UNRESOLVED raw
      // path; still normalize + case-fold so it classifies consistently. Silent
      // -- core is PURE (no logging / no process).
      resolved = filePath;
    }
    const real = resolved.replace(/\\/g, '/');
    const canonical = options.useCaseSensitiveFileNames ? real : real.toLowerCase();
    cache.set(filePath, canonical);
    return canonical;
  };
}
```

The RES-03 spec is a PURE unit test: inject `realpath: () => { throw new Error('EACCES'); }` into `filterDiagnostics`'s `FilterOptions` and assert an in-project diagnostic is still kept (no throw escapes). This mirrors the existing `filter-diagnostics.spec.ts` injected-realpath idiom exactly -- no fixture, no compiler. `[CITED: filter-diagnostics.spec.ts:88-106]`

### RES-04: the readConfiguration second arg (the only edit)

```ts
// Source: run-typecheck.ts:105 (current) [VERIFIED: read 2026-06-29]
// CURRENT:
//   const parsed = ng.readConfiguration(options.tsConfigPath);
//
// RES-04 / D-09 shape -- matches @angular/build (angular-compilation.ts:51 @ v22.0.4):
const parsed = ng.readConfiguration(options.tsConfigPath, {
  suppressOutputPathCheck: true,
});
```

The `readConfiguration(project, existingOptions?)` signature is already on the shim (`compiler-cli-types.ts:155-158`); `ts.CompilerOptions` has an index signature so the extra key type-checks. No shim change.

### RES-02 multi-file fixture (Claude's discretion -- a concrete sketch)

```
fixtures/fault-isolation/                       (new fixture dir, workspace-root convention)
  tcb-poison.component.ts                        component A: template references a
                                                 non-exported / local-only symbol ->
                                                 IMPORT_GENERATION_FAILURE Fatal during TCB gen
  tcb-poison.component.html
  survivor.component.ts                          component B: a PLAIN template error
                                                 (e.g. NG8109 interpolated-signal, or a
                                                 TS2322 template-bound type error)
  survivor.component.html
  tsconfig.app.json                              { strictTemplates:true, noEmit:true, files:[A,B] }
```

Today (whole-program path): A's Fatal aborts the single try/catch -> B's diagnostic vanishes.
After RES-02 (per-file path): A yields ONE diagnostic; the loop continues; B's diagnostic survives.
The spec asserts: pre-change `expect(codesOnFile(B)).toHaveLength(0)`; post-change `>= 1`, while A's single diagnostic is present in both. This is the failing-then-passing differentiator. `[CITED: gate-b-error + sibling-import fixture conventions]`

## State of the Art

| Old Approach                                                                                          | Current Approach                                                                           | When Changed                                                                                       | Impact                                                                                                                             |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Whole-program `getNgSemanticDiagnostics()` (single try/catch abandons remaining files on first Fatal) | Per-file `getNgSemanticDiagnostics(fileName)` loop (per-file try/catch isolates one Fatal) | This phase (RES-02), modeled on `@angular/build`'s per-file `getDiagnosticsForFile` loop @ v22.0.4 | One poisoned component no longer suppresses the rest of the program's Angular diagnostics                                          |
| `options.realpath(filePath)` called bare                                                              | Wrapped in try/catch with unresolved-path fallback                                         | This phase (RES-03)                                                                                | A throwing realpath degrades gracefully instead of aborting the pass                                                               |
| `readConfiguration(tsConfigPath)` (no second arg)                                                     | `readConfiguration(tsConfigPath, { suppressOutputPathCheck: true })`                       | This phase (RES-04), matching `@angular/build`'s `loadConfiguration` @ v22.0.4                     | Output-path nuisance suppressed defensively (already inert under `noEmit:true`; this is belt-and-suspenders parity with the build) |

**Deprecated/outdated:** Nothing deprecated. `getNgStructuralDiagnostics()` remains a no-op at v22.0.4 (`return []`, `program.ts:218-222`) but is deliberately RETAINED (Phase 10 HARD-04 decision; out of this phase). No `next.x`-vs-`22.0.4` drift found in any cited section (ENGINE-REF Open Q5 re-confirmed: `getDiagnostics`, `getDiagnosticsForFile`, `getNonTemplateDiagnostics`, `OptimizeFor`, the `readConfiguration` override all matched byte-for-byte).

## Assumptions Log

| #   | Claim                                                                                                                                                            | Section                    | Risk if Wrong                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | A component whose template references a non-exported/local-only symbol triggers `IMPORT_GENERATION_FAILURE` Fatal during TCB generation (a usable RES-02 poison) | Pitfall 2 / Code Examples  | If the chosen construct triggers a DIFFERENT (analysis-phase) Fatal, the fixture lands in `traitCompiler.diagnostics` and does not exercise the per-file template try/catch. Mitigation: the spike/RES-02 plan must VERIFY the poison diagnostic is produced by the template path (its absence in the whole-program non-template set confirms it). The throw site is verified at v22.0.4; only the exact source construct that reaches it is assumed. |
| A2  | `checkForPrivateExports` / `traitCompiler` diagnostics in the no-emit path are file-bearing (would NOT be dropped by `d.file === file`)                          | Pitfall 1 / RES-01 charter | This is EXACTLY the open question RES-01 must settle empirically -- it is NOT assumed to be true. Per D-03, inconclusive -> HYBRID. The spike, not this research, resolves it. Flagged so the planner treats SIMPLE as gated, never default.                                                                                                                                                                                                          |
| A3  | A RES-04 fixture can produce an output-path nuisance error to demonstrate suppression (failing-then-passing)                                                     | Open Questions Q1          | If `noEmit:true` makes the nuisance impossible to produce in our flow, the RES-04 "failing" half cannot be a real nuisance diagnostic. Mitigation in Open Questions: the test may need to assert ABSENCE-under-suppression + that the override is passed (a placement/parity assertion), or temporarily unset `noEmit` in a probe to prove the diagnostic exists and that `suppressOutputPathCheck` kills it.                                         |

**Note:** A2 is the load-bearing unknown the entire RES-01 gate exists to resolve; it is correctly NOT verified here (a runtime probe is required). A1 and A3 are fixture-construction assumptions the RES-02/RES-04 plans must confirm during implementation.

## Open Questions

1. **RES-04 fixture: can an output-path nuisance be produced at all under our `noEmit:true` flow?**
   - What we know: the check is gated by `!options.noEmit && !options.suppressOutputPathCheck` (typescript.js:129892); our emit-neutralizing override sets `noEmit:true`, which ALONE suppresses it. The check lives in `verifyCompilerOptions()` at the end of `createProgram`, producing `programDiagnostics` (surfaced via `getTsOptionDiagnostics()`).
   - What's unclear: whether a fixture can reproduce the nuisance "would overwrite input file" diagnostic within `runTypecheck` to make RES-04 a true failing-then-passing test, given `noEmit:true` pre-empts it.
   - Recommendation: design the RES-04 test as EITHER (a) a placement/parity assertion -- a unit-style proof that `runTypecheck` passes `suppressOutputPathCheck: true` to `readConfiguration` (e.g. via a `readConfiguration` spy in a `run-typecheck.spec.ts`-style unit, the established mock idiom) PLUS an integration assertion that a config with a colliding `outDir`/`rootDir` shape reports NO TS5055/overwrite-class diagnostic; OR (b) a focused probe (acknowledged in the plan) that temporarily clears `noEmit` to confirm the diagnostic exists and that `suppressOutputPathCheck` removes it, documenting that `noEmit:true` is the primary suppressor and `suppressOutputPathCheck` is the `@angular/build`-parity belt. Either satisfies SC4 ("verified safe under `noEmit:true`"). The planner should pick (a) for determinism.

2. **RES-01 GO artifact: what exactly does the verifier check?** (Claude's discretion per D-03, but the planner needs a shape.)
   - What we know: D-03 requires "the shape + the file-less finding that justified it" recorded as a durable artifact the phase verifier checks.
   - Recommendation: a committed `RES-01-SPIKE.md` (or a recorded decision block in the plan SUMMARY) containing: (1) the GO decision (SIMPLE | HYBRID), (2) the fixture(s) used, (3) the method (whole-program `getNonTemplateDiagnostics` `d.file` inspection vs per-file union), (4) the empirical result (e.g. "N non-template diagnostics, all file-bearing and matched -> SIMPLE" or "could not positively enumerate -> HYBRID"), (5) the v22.0.4 citations. The spike itself is throwaway probe code (a temporary `.spike.ts` or an `it.skip`-able probe spec), NOT shipped engine code. Confirm with the user whether the artifact lives in `.planning/` or as a committed spike spec.

3. **HYBRID exact structure (Claude's discretion, D-04 note).** If GO=HYBRID, whether to keep one residual whole-program `getNgSemanticDiagnostics()` purely for its non-template portion (and loop template/extended per file) or to filter the whole-program output. Recommendation: keep the single whole-program `getNgSemanticDiagnostics()` call (it already returns the complete, file-less-safe non-template set) and ADD the per-file template loop, relying on `sortAndDeduplicateDiagnostics` to remove the per-file template duplicates that the whole-program call also produced. This is the strict superset D-03 describes and the lowest-risk HYBRID. The planner decides.

## Environment Availability

| Dependency                       | Required By                                              | Available                                                     | Version                                               | Fallback                                                                                                            |
| -------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `@angular/compiler-cli`          | The engine + all RES integration specs                   | Yes                                                           | `22.0.4`                                              | -- (locked peer; no fallback)                                                                                       |
| `typescript`                     | The engine + `suppressOutputPathCheck` key + all specs   | Yes                                                           | `6.0.3`                                               | -- (locked peer)                                                                                                    |
| `vitest` / `@nx/vitest:test`     | All RES specs                                            | Yes                                                           | 4.x via Nx 23.0.1                                     | --                                                                                                                  |
| Local Angular clones @ `v22.0.4` | RES-01 spike citation re-confirmation only (NOT runtime) | Yes (`D:/projects/github/angular/angular`, `.../angular-cli`) | tag `v22.0.4` reachable via `git show v22.0.4:<path>` | The installed `node_modules/@angular/compiler-cli@22.0.4` is the runtime source of truth; clones are reference only |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none -- the full locked toolchain is installed and verified.

## Validation Architecture

> nyquist_validation is enabled (no `workflow.nyquist_validation: false` in config; absent => enabled).

### Test Framework

| Property           | Value                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Framework          | Vitest 4.x via `@nx/vitest:test` (`environment: jsdom`, `globals: true`)                                               |
| Config file        | `packages/angular-typechecker/vitest.config.mts` (`testTimeout`/`hookTimeout` already 30000ms for cold-compiler specs) |
| Quick run command  | `npx nx test angular-typechecker -- <file>` (single spec) -- or RTK: `rtk npm run` wrappers per CLAUDE.md              |
| Full suite command | `npx nx test angular-typechecker` (the `test` target `dependsOn: ["build"]`)                                           |

### Phase Requirements -> Test Map

| Req ID | Behavior                                                                                                                                                                  | Test Type                                                          | Automated Command                                                                                                                                                             | File Exists?                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| RES-01 | GATE: recorded GO decision on the per-file isolation shape; file-less-non-template finding                                                                                | spike artifact (probe + recorded decision)                         | throwaway probe (e.g. `npx nx test angular-typechecker -- res-01-spike.probe.spec.ts`) producing the GO artifact; the verifier checks the artifact, not a permanent assertion | NEW -- Wave 0 (spike)                                                    |
| RES-02 | One component's TCB-phase `FatalDiagnosticError` yields exactly one diagnostic; a SECOND component's template error survives (today it vanishes)                          | integration (real compiler, multi-file fixture)                    | `npx nx test angular-typechecker -- fault-isolation.integration.spec.ts`                                                                                                      | NEW -- Wave 0 (spec + `fixtures/fault-isolation/`)                       |
| RES-03 | A throwing injected `realpath` is caught; an in-project diagnostic is still kept; the pass does not abort (happy path unchanged)                                          | unit (pure, injected realpath stub)                                | `npx nx test angular-typechecker -- filter-diagnostics.spec.ts` (extend existing)                                                                                             | EXTEND existing `filter-diagnostics.spec.ts`                             |
| RES-04 | `suppressOutputPathCheck: true` is passed to `readConfiguration`; no output-path nuisance (TS5055/overwrite-class) diagnostic surfaces; verified safe under `noEmit:true` | unit (readConfiguration spy) + integration (no-nuisance assertion) | `npx nx test angular-typechecker -- run-typecheck.spec.ts` (unit) + a `*.integration.spec.ts` (no-nuisance)                                                                   | EXTEND `run-typecheck.spec.ts` + NEW integration spec (or fixture-light) |

### Sampling Rate

- **Per task commit:** the single new/extended spec for the task (`-- <file>`), runnable in seconds for unit specs (RES-03/RES-04 unit) and ~tens of seconds for the cold-compiler integration spec (RES-02). The RES-01 spike runs once to produce its artifact.
- **Per wave merge:** the full `npx nx test angular-typechecker` suite (all `*.spec.ts` + `*.integration.spec.ts`) -- proves no regression in COR/ENG/OUT coverage and that the per-file loop did not change the diagnostic SET on clean/ordinarily-erroring fixtures.
- **Phase gate:** full suite green AND the RES-01 GO artifact present/recorded before `/gsd:verify-work`. The gate ordering (RES-01 before RES-02) is enforced by plan sequencing, not by a runtime check.

### Wave 0 Gaps

- [ ] RES-01 spike probe (throwaway): exercises `getNonTemplateDiagnostics`'s `d.file` shape on a fixture that produces non-template diagnostics; records the GO artifact (SIMPLE | HYBRID).
- [ ] `fixtures/fault-isolation/` (NEW): multi-file fixture -- one TCB-poisoning component (`IMPORT_GENERATION_FAILURE`) + one survivor component with a plain template error.
- [ ] `fault-isolation.integration.spec.ts` (NEW): covers RES-02 (the failing-then-passing isolation proof).
- [ ] `filter-diagnostics.spec.ts` (EXTEND): add the throwing-realpath case -- covers RES-03.
- [ ] `run-typecheck.spec.ts` (EXTEND) + a no-nuisance integration assertion: covers RES-04 (the `readConfiguration` second-arg + safe-under-`noEmit` proof).
- [ ] Framework install: none -- Vitest infrastructure exists.

_Existing test infrastructure (the `runTypecheck`-against-workspace-root-`fixtures/` idiom + the pure `filterDiagnostics`-with-injected-realpath idiom + the raised cold-compiler timeout) covers all four requirements with NO new harness._

## Security Domain

> `security_enforcement` is enabled (absent => enabled). This phase is robustness hardening of a pure compilation engine with NO new input surface, NO auth, NO network, NO persistence.

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                                                                                                                                                                                                                     |
| --------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication     | no      | no auth surface in a type-check engine                                                                                                                                                                                                                                                               |
| V3 Session Management | no      | no sessions                                                                                                                                                                                                                                                                                          |
| V4 Access Control     | no      | no access-control surface                                                                                                                                                                                                                                                                            |
| V5 Input Validation   | partial | The only "inputs" are the consumer's tsconfig + source files (already validated/parsed by `readConfiguration` + the compiler). RES-03's realpath try/catch is itself an input-robustness control -- a hostile/broken symlink target no longer aborts the pass. No new untrusted input is introduced. |
| V6 Cryptography       | no      | no crypto                                                                                                                                                                                                                                                                                            |
| V12 Files/Resources   | partial | RES-03 hardens a filesystem (`realpath`) failure path against denial-of-service-by-crash on a restricted/broken symlink. Standard control: catch + graceful fallback (the locked D-08 design). No path-traversal surface -- the filter only CLASSIFIES paths, never reads/writes them.               |

### Known Threat Patterns for {Nx plugin core engine, no-emit type-check}

| Pattern                                                                                                                     | STRIDE                                                   | Standard Mitigation                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| One poisoned component aborts the whole check, hiding real errors elsewhere (a "lying clean / silently incomplete" verdict) | Denial of Service / Repudiation (the tool under-reports) | RES-02 per-file fault isolation -- one Fatal yields one diagnostic, the rest survive (the marquee correctness/robustness control)                |
| A throwing `realpath()` (EACCES, broken junction/symlink, permission-denied) crashes the entire pass                        | Denial of Service                                        | RES-03 try/catch with unresolved-path fallback (D-08) -- degrade gracefully, never abort                                                         |
| An output-path config nuisance error mis-counted as a type error (false fail)                                               | Repudiation (mis-classification)                         | RES-04 `suppressOutputPathCheck: true` (+ `noEmit:true` already gates it) -- the nuisance never surfaces in the type-only verdict                |
| A non-fatal/infra throw silently reclassified as a per-file type diagnostic (would blur the infra-vs-type policy)           | Tampering with the verdict's meaning                     | D-05: do NOT add a catch-all; let non-fatal escapes become `UNKNOWN_ERROR_CODE 500` -> `TypecheckInfrastructureError` (Phase 8 policy preserved) |

These map 1:1 to the four success criteria; each is closed by a locked decision + a Wave-0 test point.

## Sources

### Primary (HIGH confidence)

- Local `@angular/compiler-cli` clone `D:/projects/github/angular/angular` @ `v22.0.4` (via `git show v22.0.4:<path>`):
  - `packages/compiler-cli/src/ngtsc/core/src/compiler.ts` -- `getDiagnostics` (591-609, single try/catch), `getDiagnosticsForFile` (616-639, per-file try/catch + the `d.file === file` filter at :618), `getNonTemplateDiagnostics` (1243-1258, `traitCompiler.diagnostics` + `checkForPrivateExports`, memoized), `runAdditionalChecks` (per-file `sf` arg) -- ALL re-verified live this session.
  - `packages/compiler-cli/src/ngtsc/program.ts:224-243` -- `getNgSemanticDiagnostics(fileName)` -> `getSourceFile` (out-of-program `return []` no-op) -> `getDiagnosticsForFile(sf, OptimizeFor.WholeProgram)`. `getNgStructuralDiagnostics` (218-222) `return []`.
  - `packages/compiler-cli/src/ngtsc/typecheck/src/reference_emit_environment.ts:46-63` -- `referenceTcbValue` throws `FatalDiagnosticError(IMPORT_GENERATION_FAILURE)` during TCB generation (the citable RES-02 TCB-phase trigger).
  - `packages/compiler-cli/src/ngtsc/diagnostics/src/error.ts:14-112` -- `FatalDiagnosticError` / `toDiagnostic` / `isFatalDiagnosticError`.
  - `packages/compiler-cli/src/perform_compile.ts:255-326` -- the outer try/catch -> `UNKNOWN_ERROR_CODE 500` (the D-05 non-fatal-escape boundary).
- Local `@angular/build` clone `D:/projects/github/angular/angular-cli` @ `v22.0.4`:
  - `packages/angular/build/src/tools/angular/compilation/aot-compilation.ts:278-296` -- the per-file `getDiagnosticsForFile(sourceFile, templateDiagnosticsOptimization)` loop (the RES-02 north star).
  - `.../angular-compilation.ts:44-70` -- `loadConfiguration` passes `suppressOutputPathCheck: true` as the `readConfiguration` SECOND ARG (the RES-04 D-09 parity source).
- Installed `node_modules/typescript@6.0.3/lib/typescript.js` -- `verifyCompilerOptions()` invoked at end of `createProgram` (127878); the output-path check gated by `!options.noEmit && !options.suppressOutputPathCheck` (129892); "would overwrite input file" / "...multiple input files" diagnostics (the RES-04 placement-timing RESOLUTION).
- Installed manifests -- `typescript@6.0.3`, `@angular/compiler-cli@22.0.4` (correct npm ecosystem).
- Engine source (read live this session): `gather-diagnostics.ts` (:34 anchor confirmed), `filter-diagnostics.ts` (:127 anchor confirmed), `run-typecheck.ts` (:105 anchor confirmed), `compiler-cli-types.ts` (:76-79 / :155-158 confirmed), and the spec/fixture conventions (`gather-diagnostics.spec.ts`, `filter-diagnostics.spec.ts`, `run-typecheck.spec.ts`, the `*.integration.spec.ts` set, `fixtures/`).

### Secondary (MEDIUM confidence)

- `.planning/research/prior-art/ENGINE-REFERENCE.md` (IMPROVEMENT #1/#4, Resilience analysis, Open Questions 1/3/4) -- cross-checked against the live clone reads above; consistent.
- `.planning/research/prior-art/SHIM-HARDENING.md` (#2 realpath try/catch) and `COMPILER-CLI-INTERNALS.md` (FatalDiagnosticError / UNKNOWN_ERROR_CODE / `readConfiguration` flow) -- consistent with source.
- `.planning/research/prior-art/PRIOR-ART-SUMMARY.md` ("the one load-bearing open question (gates #3)") -- the RES-01 charter.

### Tertiary (LOW confidence)

- None. Every claim is verified against source or the installed toolchain.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- no new packages; installed versions verified against the npm ecosystem and the locked stack.
- Architecture / edit points: HIGH -- all four anchors confirmed live; the per-file delegation, the `d.file === file` filter, the per-file try/catch, the `readConfiguration` second arg, and the TS-level output-path gate all verified at v22.0.4 / typescript@6.0.3 this session.
- RES-01 outcome (SIMPLE vs HYBRID): NOT determined by research -- by design. The MECHANISM is HIGH-confidence; the EMPIRICAL outcome (do file-less non-template diagnostics occur?) is the spike's job. Default HYBRID on inconclusive (D-03).
- Pitfalls / fixtures: HIGH for the mechanisms (throw sites, gating, conventions); MEDIUM for the exact source construct that triggers the RES-02 TCB Fatal (A1) and whether a RES-04 nuisance is reproducible under `noEmit:true` (A3) -- both flagged for the implementing plan to confirm.

**Research date:** 2026-06-29
**Valid until:** ~2026-07-29 (stable, version-pinned to Angular 22.0.4 / TS 6.0.3; re-confirm only if the locked stack moves or the Angular clones advance past the v22.0.4 tree-ish).
