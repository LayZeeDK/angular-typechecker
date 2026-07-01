# RES-01 GATE Spike: Per-File Isolation Shape Decision

**Phase:** 09-resilience-per-file-fault-isolation-boundary-robustness
**Plan:** 09-01 (the GATE; gates plan 09-02 / RES-02)
**Date:** 2026-06-29
**Stack (verified):** `@angular/compiler-cli@22.0.4`, `typescript@6.0.3`, Vitest 4 via `@nx/vitest:test`
**Probe:** `packages/angular-typechecker/src/core/res-01-spike.probe.spec.ts` (THROWAWAY; excluded from the plugin build by `tsconfig.lib.json`'s spec exclusion)

---

## GO DECISION

**GO = HYBRID**

Plan 09-02 (RES-02) MUST implement the **HYBRID** gather shape in
`gather-diagnostics.ts` (line 34):

```ts
// HYBRID -- keep the whole-program getNgSemanticDiagnostics() (the file-less-safe,
// NON-template set is NOT filtered by file) AND add the per-file loop for the
// isolated template/extended families. finalize()'s ts.sortAndDeduplicateDiagnostics
// (run-typecheck.ts:347) removes the per-file template duplicates that the
// whole-program call also produces.
all.push(...program.getNgSemanticDiagnostics()); // whole-program: file-less-safe non-template set
for (const sf of program.getTsProgram().getSourceFiles()) {
  if (sf.isDeclarationFile) {
    continue;
  }

  all.push(...program.getNgSemanticDiagnostics(sf.fileName)); // per-file: isolated template/extended
}
```

**SIMPLE is REJECTED.** Per D-02/D-03, SIMPLE (a per-file
`getNgSemanticDiagnostics(sf.fileName)` loop ONLY) is admissible **only** with
POSITIVE proof that no Angular non-template diagnostic is file-less (or attached
to a `ts.SourceFile` not strictly `===` an iterated source file) in the no-emit
path. The spike could **not** positively enumerate the full non-template
diagnostic universe as file-bearing-and-matched, and produced affirmative
evidence that the `d.file === file` filter is fragile (diagnostics attach to
generated `.ngtypecheck.ts` shim files, not the iterated `.component.ts`).
Per D-03, inconclusive defaults to HYBRID -- the strict superset that can never
under-gather. Absence of evidence is not proof of absence (Pitfall 1).

---

## 1. The load-bearing question

`NgCompiler.getDiagnosticsForFile(file, optimizeFor)` builds the per-file set as:

```ts
// Source: angular/packages/compiler-cli/src/ngtsc/core/src/compiler.ts:616-618 @ v22.0.4
const diagnostics: ts.Diagnostic[] = [
  ...this.getNonTemplateDiagnostics().filter((diag) => diag.file === file), // <-- THE FILTER (:618)
];
```

`getNonTemplateDiagnostics()` = `traitCompiler.diagnostics` + `checkForPrivateExports`
(`compiler.ts:1243-1258`, memoized). A naive per-file `getNgSemanticDiagnostics(sf.fileName)`
loop (SIMPLE) would silently DROP any non-template diagnostic whose `.file` is
`undefined` -- or whose `.file` is a `ts.SourceFile` object that is not strictly
`===` the file currently being queried -- because the `diag.file === file` filter
excludes it from every per-file call. The spike's job (D-01): determine
empirically whether such diagnostics occur in the no-emit path.

---

## 2. Fixtures used

All at the WORKSPACE ROOT `fixtures/fault-isolation/` (out of the project graph;
no `@ts-nocheck`; the errors ARE the input):

- **`tcb-poison.component.ts` + `tcb-poison.component.html`** (component A):
  a referenced standalone component (`SubComponent`) is INTENTIONALLY NOT EXPORTED,
  carries a required input, and is bound in the template (`<sub-cmp [someInput]="''" />`).
  Under `strictTemplates`, the type-check block (TCB) must reference `SubComponent`'s
  class; because it is not exported, the reference emitter fails
  (`ReferenceEmitKind.Failed`, `tcb_adapter.ts:377`) and `referenceTcbValue` throws
  `FatalDiagnosticError(IMPORT_GENERATION_FAILURE = 3004)` ("Unable to import symbol
  SubComponent.", `reference_emit_environment.ts:52`) **during TCB GENERATION**.
  This is the EXACT construct from Angular's own v22.0.4 test suite
  (`compiler-cli/test/ngtsc/template_typecheck_spec.ts:86-115`, "should not fail with
  a runtime error when generating TCB").

- **`survivor.component.ts` + `survivor.component.html`** (component B):
  a PLAIN template error (the established `gate-b-error` model) -- a field-initializer
  TS2322 plus an interpolated un-invoked `signal` (NG8109) in the template. Today it
  vanishes when A poisons the whole-program pass; plan 09-02 asserts it survives
  post-HYBRID.

- **`non-template-error.component.ts` + `tsconfig.non-template.json`**:
  a single-file fixture that produces a REAL ANALYSIS-phase Angular NON-TEMPLATE
  diagnostic (a plain non-Angular class in the standalone `imports:` array ->
  `NG2012`), with NO template Fatal to abort the run -- so the probe can inspect a
  genuine `getNonTemplateDiagnostics()` entry's `.file` directly.

- **`tsconfig.app.json`**: `extends ../../tsconfig.base.json`, `noEmit: true`,
  `strict: true`, `angularCompilerOptions.strictTemplates: true`,
  `files: ["tcb-poison.component.ts", "survivor.component.ts"]`.

---

## 3. Method

The probe reaches the LIVE `api.Program` via the same
`loadCompilerCli()` + `readConfiguration(tsConfigPath, { suppressOutputPathCheck: true })`

- `performCompilation` path the engine uses (`run-typecheck.ts:102-193`), with the
  same emit-neutralizing override (`noEmit: true`, `emitFlags: 0`, ...), capturing the
  `program` in a custom `gatherDiagnostics` callback. Then, for each fixture:

* **(W)** gather the WHOLE-PROGRAM Angular set: `program.getNgSemanticDiagnostics()`
  (no `fileName`) -> `compiler.getDiagnostics()` (`program.ts:224-243`).
* **(U)** build the per-file UNION (the SIMPLE shape): `program.getNgSemanticDiagnostics(sf.fileName)`
  over `getTsProgram().getSourceFiles()` skipping `isDeclarationFile` (D-06).
* **(C)** inspect `.file` on EVERY whole-program diagnostic: classify each as
  file-less (`d.file === undefined`), or attached to a `ts.SourceFile` strictly
  `===` an iterated (non-declaration) source file ("matched"), or attached to some
  other file object ("unmatched"). Also compute which whole-program diagnostics are
  dropped from the per-file union (by `(code, fileName)` key). A per-file breakdown
  records which source-file query produced which diagnostics.

A1 verification: confirm the poison `IMPORT_GENERATION_FAILURE` is produced by the
TEMPLATE path (the per-file template try/catch in `getDiagnosticsForFile:626-636`),
not the analysis/non-template set.

---

## 4. Empirical result (live `@angular/compiler-cli@22.0.4`)

### 4a. Poison fixture (`fault-isolation/tsconfig.app.json`)

```
[RES-01] iterated (non-declaration) source files:
  tcb-poison.component.ngtypecheck.ts
  tcb-poison.component.ts
  survivor.component.ngtypecheck.ts
  survivor.component.ts
[RES-01] whole-program diagnostic count: 1
[RES-01] whole-program diagnostics:
  code=-993004 file=tcb-poison.component.ngtypecheck.ts        (IMPORT_GENERATION_FAILURE)
[RES-01] per-file union count: 2
[RES-01] per-file union diagnostics:
  code=-993004 file=tcb-poison.component.ngtypecheck.ts
  code=-993004 file=tcb-poison.component.ngtypecheck.ts
[RES-01] per-file BREAKDOWN (sourceFile -> diagnostics):
  tcb-poison.component.ngtypecheck.ts  -> []
  tcb-poison.component.ts              -> [code=-993004 file=tcb-poison.component.ngtypecheck.ts]
  survivor.component.ngtypecheck.ts    -> []
  survivor.component.ts                -> [code=-993004 file=tcb-poison.component.ngtypecheck.ts]
[RES-01] A1: IMPORT_GENERATION_FAILURE present in per-file union: true
```

**Findings:**

1. **A1 CONFIRMED:** the poison `IMPORT_GENERATION_FAILURE` (NG `-993004`) is a
   TEMPLATE/TCB Fatal -- it is produced via the per-file template try/catch and is
   NOT a non-template/analysis diagnostic. The fixture correctly exercises the
   per-file template path (Pitfall 2 avoided).

2. **The Fatal's `.file` is the GENERATED `tcb-poison.component.ngtypecheck.ts`
   SHIM, not the original `tcb-poison.component.ts`.** This is the affirmative
   evidence that `d.file` on an Angular diagnostic is NOT reliably the source file
   the per-file loop queries. The `d.file === file` filter (`compiler.ts:618`) is
   an object-identity comparison; a diagnostic attached to a shim or to a different
   source-file object than the iterated one would be dropped.

3. **The survivor's diagnostics are ABSENT from BOTH sets here.** Under
   `OptimizeFor.WholeProgram` (the implicit mode of the `fileName` overload, D-07),
   the first per-file call primes the shared `ensureAllShimsForAllFiles()` TCB
   generation; the poison's Fatal during that shared step poisons shim generation,
   so even the per-file loop returns only the poison Fatal for BOTH the poison file
   AND the survivor file (see the breakdown: `survivor.component.ts ->
[-993004 ...]`). This is a RES-02 design input -- the SIMPLE per-file loop does
   NOT, on its own, isolate this whole-program-priming Fatal -- and it independently
   argues against SIMPLE for the isolation guarantee RES-02 must deliver. (Plan
   09-02 owns proving the post-change behavior with its failing-then-passing spec;
   RES-01 only settles the gather SHAPE.)

### 4b. Non-template fixture (`fault-isolation/tsconfig.non-template.json`)

```
[RES-01 non-template] whole-program diagnostics:
  code=-992012 file=non-template-error.component.ts            (NG2012, analysis-phase)
[RES-01 non-template] per-file union diagnostics:
  code=-992012 file=non-template-error.component.ts
[RES-01 non-template] whole-program entries with file-less .file: []
[RES-01 non-template] whole-program diagnostics DROPPED from the per-file union: []
```

**Findings:**

4. The ONE analysis-phase non-template diagnostic exercised (NG2012, a plain class
   in `imports:`) IS file-bearing on its `.component.ts` and IS retained by the
   per-file union. So at least one `traitCompiler` diagnostic class is
   file-bearing-and-matched.

5. **But this is exactly Pitfall 1.** A single file-bearing non-template diagnostic
   is NOT proof that ALL non-template diagnostics are file-bearing. The spike did
   NOT exercise the `checkForPrivateExports` family (the publishable-entry-point
   path, A2 -- which requires `flatModuleOutFile`/`entryPoint` wiring the no-emit
   override and a leaf app/lib tsconfig do not establish), and the non-template
   universe cannot be exhaustively enumerated from these fixtures.

---

## 5. Decision rationale (D-02/D-03)

- D-02: SIMPLE requires POSITIVE proof that NO file-less (or unmatched-file)
  non-template diagnostic exists. The spike did **not** establish that:
  - It positively confirmed only ONE non-template class (NG2012 analysis) as
    file-bearing-and-matched; it did NOT exercise `checkForPrivateExports` (A2, the
    flagged file-less risk), nor can it enumerate the full non-template universe.
  - It produced AFFIRMATIVE counter-evidence that `d.file` is fragile: a real
    Angular diagnostic attached to a generated `.ngtypecheck.ts` shim, not the
    iterated source file -- precisely the shape the `d.file === file` per-file
    filter drops.
- D-03: inconclusive -> **HYBRID**. HYBRID keeps the whole-program
  `getNgSemanticDiagnostics()` call (which returns the non-template set WITHOUT the
  `d.file === file` filter, so it can never drop a file-less / shim-attached
  non-template diagnostic) AND adds the per-file loop for the isolated
  template/extended families. `ts.sortAndDeduplicateDiagnostics` in `finalize`
  (`run-typecheck.ts:347`) dedups the per-file template duplicates the whole-program
  call also produces, so the reported set stays deterministic and duplicate-free.

HYBRID is the strict superset described in D-03 and 09-RESEARCH Open Q3: it can
never under-gather relative to today's whole-program behavior, and it adds the
per-file resilience RES-02 requires.

---

## 6. v22.0.4 citations

- `compiler.ts:616-639` -- `getDiagnosticsForFile`: the non-template set filtered by
  `diag.file === file` (`:618`); the per-file template try/catch that catches
  `isFatalDiagnosticError` (`:626-636`).
- `compiler.ts:1243-1258` -- `getNonTemplateDiagnostics` = `traitCompiler.diagnostics`
  - `checkForPrivateExports` (memoized).
- `program.ts:224-243` -- `getNgSemanticDiagnostics(fileName)` -> `getSourceFile`
  (out-of-program `return []` no-op) -> `getDiagnosticsForFile(sf, OptimizeFor.WholeProgram)`.
- `reference_emit_environment.ts:46-63` -- `referenceTcbValue` throws
  `FatalDiagnosticError(IMPORT_GENERATION_FAILURE)` during TCB generation (the poison
  trigger); `tcb_adapter.ts:313-398` -- `ReferenceEmitKind.Failed` -> `unexportedDiagnostic`.
- `error_code.ts:207` -- `IMPORT_GENERATION_FAILURE = 3004` (NG encodes negative:
  `-993004`); NG2012 (`-992012`) is the analysis-phase non-template diagnostic exercised.
- `compiler-cli/test/ngtsc/template_typecheck_spec.ts:86-115` -- the upstream test the
  poison fixture replicates.

---

## 7. Hand-off to plan 09-02 (RES-02)

- **Implement HYBRID** in `gather-diagnostics.ts:34` (keep the whole-program
  `getNgSemanticDiagnostics()`; ADD the per-file `getNgSemanticDiagnostics(sf.fileName)`
  loop skipping `sf.isDeclarationFile`; rely on `finalize`'s
  `sortAndDeduplicateDiagnostics` for dedup -- D-06). COR-02's
  `getTsProgram().getGlobalDiagnostics()` (line 35) STAYS.
- Use `OptimizeFor.WholeProgram` implicitly via the `fileName` overload; NEVER
  `OptimizeFor.SingleFile` in the loop (D-07).
- Do NOT add an outer/per-call try/catch around the per-file gather; rely on
  `getDiagnosticsForFile`'s OWN `isFatalDiagnosticError` try/catch so a non-fatal
  escape still becomes `UNKNOWN_ERROR_CODE 500` -> `TypecheckInfrastructureError`
  (D-05, the Phase-8 infra-vs-type policy).
- The `fixtures/fault-isolation/` tree (the poison + survivor components and
  `tsconfig.app.json`) is committed for plan 09-02's `fault-isolation.integration.spec.ts`
  to consume as its failing-then-passing differentiator.
- The probe (`res-01-spike.probe.spec.ts`) and the `non-template-error.component.ts` +
  `tsconfig.non-template.json` are throwaway spike artifacts; plan 09-02 may remove
  the probe once RES-02's permanent spec lands (or leave it -- it is build-excluded
  and asserts nothing brittle).
