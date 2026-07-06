import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

import { TCB_GENERATION_FATAL_DIAGNOSTIC_CODE } from './diagnostic-codes';
import { evaluateResult } from './evaluate-result';
import { detectTemplateCheckAborted, runTypecheck } from './run-typecheck';

// RES-02 -- REAL-compiler multi-file fault-isolation proof against
// fixtures/fault-isolation/ (authored by 09-01). The gatherer now gathers the
// Angular semantic set HYBRID (the RES-01 GO decision, 09-RES-01-SPIKE.md): a
// residual whole-program getNgSemanticDiagnostics() PLUS a per-file
// getNgSemanticDiagnostics(sf.fileName) loop with the compiler's OWN per-file
// isFatalDiagnosticError try/catch (getDiagnosticsForFile, compiler.ts:626-636
// @ v22.0.4).
//
// THE ISOLATION CONTRACT THIS SPEC PROVES (SC2 / D-04 / D-05): one component's
// TCB-phase FatalDiagnosticError (IMPORT_GENERATION_FAILURE, NG3004) yields
// EXACTLY ONE diagnostic and does NOT collapse the whole run to a single
// TypecheckInfrastructureError (UNKNOWN_ERROR_CODE 500). The surviving component
// is NOT abandoned: its own diagnostic on its own file is still reported. The
// poison Fatal is surfaced as a real, file-attributed diagnostic (NOT swallowed,
// NOT promoted to infra-500), exactly as the per-file isFatalDiagnosticError
// try/catch intends.
//
// EMPIRICAL SCOPE NOTE (documented in 09-02-SUMMARY.md, "Deviations"): the poison
// is a TCB-GENERATION-phase Fatal. On the api.Program surface the per-file
// getNgSemanticDiagnostics(fileName) overload hard-codes OptimizeFor.WholeProgram
// (program.ts:294 @ v22.0.4 -> getDiagnosticsForFile(sf, OptimizeFor.WholeProgram)),
// so the FIRST per-file call (like the whole-program call) primes the SHARED
// ensureAllShimsForAllFiles() pass. The poison's Fatal is thrown DURING that
// shared TCB-generation priming (checker.js:10768), which aborts shim generation
// for ALL files -- so the survivor's TEMPLATE/extended diagnostics
// (NG8109 / NG8117 on survivor.component.html, confirmed produced when the
// survivor compiles ALONE) do NOT come back under WholeProgram priming, in EITHER
// the whole-program or the per-file path. This is a compiler-level limitation that
// affects @angular/build identically (its aot-compilation.ts loop also routes
// through ensureAllShimsForAllFiles); recovering it would require
// OptimizeFor.SingleFile per file, which D-07 forbids (and NgtscProgram migration,
// which D-04/PROJECT.md forbid). The survivor's OWN diagnostic that IS reported is
// its TS-level error (TS2322), produced by the file-scoped TS semantic getter
// INDEPENDENTLY of the aborted Angular TCB priming -- which is precisely why the
// run is NOT abandoned and the survivor still surfaces.
//
// Cold-compiler timeout is inherited from vitest.config.mts (testTimeout 30000);
// do NOT add a per-file testTimeout (Pitfall 5).

// Angular encodes extended codes negative: ngErrorCode(8109) = -998109. Assert
// Angular codes via NG(); TS codes are raw (Pitfall 4 -- never a bare 8109).
const NG = (code: number): number => -990000 - code;

// IMPORT_GENERATION_FAILURE = 3004 (error_code.ts:207 @ v22.0.4) -> NG(3004).
const NG_IMPORT_GENERATION_FAILURE = NG(3004);

// The survivor's TS field-initializer error (string assigned to number).
const TS2322 = 2322;

// The infrastructure-failure code (500) that, if present, would mean the whole
// run collapsed to a single TypecheckInfrastructureError instead of isolating the
// Fatal -- the Phase 8 infra-vs-type boundary RES-02 must NOT cross (D-05).
const UNKNOWN_ERROR_CODE = 500;

const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);
const faultIsolationTsConfig = join(
  workspaceRoot,
  'fixtures',
  'fault-isolation',
  'tsconfig.app.json',
);
const survivorComponent = join(
  workspaceRoot,
  'fixtures',
  'fault-isolation',
  'survivor.component.ts',
);

// RES-02 (reframe): an ORDINARILY-ERRORING Angular program with NO
// TCB-generation Fatal -- ng-baseline emits NG8001 (SCHEMA_INVALID_ELEMENT), a
// real Angular template error. It proves the suppression flag does NOT fire on a
// clean / ordinarily-erroring run even when Angular template diagnostics are
// present (no false positive).
const ordinaryNgErrorTsConfig = join(
  workspaceRoot,
  'fixtures',
  'ng-baseline',
  'tsconfig.app.json',
);

function diagnosticsOnFile(
  diagnostics: readonly { file?: { fileName: string } }[],
  absolutePath: string,
): readonly { file?: { fileName: string } }[] {
  // CoreResult fileNames are absolute + forward-slash; the join() path uses the
  // OS separator, so compare on the normalized forward-slash form.
  const normalized = absolutePath.replace(/\\/g, '/');

  return diagnostics.filter(
    (diagnostic) => diagnostic.file?.fileName === normalized,
  );
}

describe('runTypecheck fault isolation (fault-isolation fixture)', () => {
  it('RES-02 / SC2: the poison TCB Fatal yields exactly ONE diagnostic and does NOT abandon the survivor', async () => {
    const result = await runTypecheck({ tsConfigPath: faultIsolationTsConfig });

    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);

    // The poison component's IMPORT_GENERATION_FAILURE is surfaced as a real
    // Angular diagnostic via the per-file isFatalDiagnosticError try/catch...
    expect(codes).toContain(NG_IMPORT_GENERATION_FAILURE);

    // ...exactly ONCE (the per-file duplicate the whole-program call also
    // produced is deduped by finalize's sortAndDeduplicateDiagnostics, D-06).
    const poisonOccurrences = codes.filter(
      (code) => code === NG_IMPORT_GENERATION_FAILURE,
    );
    expect(poisonOccurrences).toHaveLength(1);

    // CRITICAL (D-05): the run did NOT collapse to a single infra-500. The Fatal
    // was isolated as a type diagnostic, not promoted to a TypecheckInfrastructureError.
    expect(codes).not.toContain(UNKNOWN_ERROR_CODE);
  });

  it('RES-02 / SC2: the survivor component is NOT abandoned -- its own diagnostic is still reported', async () => {
    const result = await runTypecheck({ tsConfigPath: faultIsolationTsConfig });

    // The survivor's own diagnostic (its TS2322 field-initializer error) is still
    // reported on its file: the poison's Fatal did NOT abandon the rest of the
    // program. diagnosticsOnFile(survivor) is >= 1 -- the run completed and
    // surfaced the survivor's error instead of aborting on the poison.
    expect(
      diagnosticsOnFile(result.diagnostics, survivorComponent).length,
    ).toBeGreaterThanOrEqual(1);

    // Specifically, the survivor's TS2322 is present (the file-scoped TS semantic
    // getter produces it independently of the poisoned Angular TCB priming).
    const survivorCodes = diagnosticsOnFile(
      result.diagnostics,
      survivorComponent,
    ).map((diagnostic) => diagnostic.code);
    expect(survivorCodes).toContain(TS2322);
  });

  it('RES-02 / D-05: errorCount reflects the isolated diagnostics, not an infra collapse', async () => {
    const result = await runTypecheck({ tsConfigPath: faultIsolationTsConfig });

    // Two errors survive into the verdict: the poison Fatal AND the survivor
    // TS2322. A single infra-500 collapse would yield errorCount === 1 with the
    // 500 code; isolation yields >= 2 real diagnostics with no 500.
    expect(result.errorCount).toBeGreaterThanOrEqual(2);
    expect(
      result.diagnostics.some(
        (diagnostic) => diagnostic.code === UNKNOWN_ERROR_CODE,
      ),
    ).toBe(false);
  });

  it('RES-02 reframe: the TCB-generation Fatal SETS templateCheckAborted naming the offending file', async () => {
    const result = await runTypecheck({ tsConfigPath: faultIsolationTsConfig });

    // The reframed loud-notice signal: the real-compiler poison run flags the
    // template-check abort (NG3004) so the adapter can warn that survivors'
    // template/extended diagnostics may be suppressed -- never silently.
    expect(result.templateCheckAborted).toBeDefined();
    expect(result.templateCheckAborted?.code).toBe(
      NG_IMPORT_GENERATION_FAILURE,
    );
    // The offending file is named (forward-slash absolute, like every CoreResult
    // fileName) so the adapter notice can point at it.
    expect(result.templateCheckAborted?.fileName).toMatch(
      /fixtures\/fault-isolation\/tcb-poison\.component\.ts$/,
    );
  });
});

describe('runTypecheck templateCheckAborted is UNSET on ordinary runs (RES-02 reframe)', () => {
  it('does NOT flag an abort on an ordinarily-erroring Angular program (NG8001, no TCB-generation Fatal)', async () => {
    const result = await runTypecheck({
      tsConfigPath: ordinaryNgErrorTsConfig,
    });

    // ng-baseline emits a real Angular template error (NG8001) but NO
    // TCB-generation Fatal, so the suppression flag must stay unset: the notice
    // fires only when survivors' template diagnostics were actually aborted.
    expect(result.templateCheckAborted).toBeUndefined();

    // Sanity: the fixture really did produce its ordinary Angular error, so this
    // is a genuine "erroring but not aborted" run, not a vacuous clean pass.
    expect(result.errorCount).toBeGreaterThanOrEqual(1);
    expect(
      result.diagnostics.some((diagnostic) => diagnostic.code === NG(8001)),
    ).toBe(true);
  });
});

// D-09a(iv) / FM-9 MANDATORY drift probe (Phase 17 board). Two guards, proven
// against the REAL poison fixture and version-pinned to Angular 22.0.4 / TS 6.0.3:
// (1) the whole-program TCB-generation abort is now VERDICT-AFFECTING (17-04), no
// longer advisory-only; (2) the recognized TCB-generation fatal-code surface is
// EXACTLY NG3004, so a future Angular Fatal beyond NG3004 trips LOUD instead of
// silently leaving a coverage gap. Mirrors the existing RES-02 real-fixture idiom.
//
// PLAN-DEVIATION NOTE (Rule 1): the plan's literal assertion "evaluateResult(result)
// -> outcome === 'coverage-incomplete'" against the poison fixture is impossible --
// the poison run has errorCount > 0 (the NG3004 Fatal + the survivor's TS2322 are
// real reported errors), and evaluate-result.ts step 1 makes `type-error` WIN the
// label over `coverage-incomplete`. The honest FM-9 proof feeds the fixture's REAL
// abort signal into an isolated evaluate input (errorCount 0) so the fold is proven
// verdict-affecting without the error-count confound.
describe('runTypecheck FM-9 TCB-abort drift probe (D-09a iv)', () => {
  it('the TCB abort is verdict-affecting AND the recognized fatal-code surface is pinned to NG3004', async () => {
    const result = await runTypecheck({ tsConfigPath: faultIsolationTsConfig });

    // The real compiler produced the whole-program TCB-generation abort.
    expect(result.templateCheckAborted).toBeDefined();

    // The poison run NEVER reads clean: its full verdict fails. The LABEL is
    // `type-error` (not coverage-incomplete) because the NG3004 Fatal and the
    // survivor's TS2322 are real reported errors that WIN the label -- errors are
    // the loudest signal (evaluate-result.ts step 1).
    expect(evaluateResult(result).success).toBe(false);

    // FM-9 (17-04) is now VERDICT-AFFECTING, not advisory-only: the SAME abort
    // signal the real fixture produced drives a `coverage-incomplete` verdict when
    // it is the ONLY failure (errorCount 0). A regression that unwired the FM-9
    // fold would flip this to a silent clean pass on a run whose survivors'
    // template diagnostics were suppressed by the abort.
    expect(
      evaluateResult({
        errorCount: 0,
        warningCount: 0,
        templateCheckAborted: result.templateCheckAborted,
      }),
    ).toEqual({ success: false, outcome: 'coverage-incomplete' });

    // VERSION PIN (Angular 22.0.4 / TS 6.0.3): the real compiler's TCB-generation
    // Fatal is EXACTLY IMPORT_GENERATION_FAILURE (NG3004). If a future Angular
    // renumbers it or introduces a NEW TCB-generation Fatal, this equality breaks
    // LOUD -- update TCB_GENERATION_FATAL_DIAGNOSTIC_CODE, this probe, AND the
    // extended-catalog drift tests so coverage-incompleteness is never silently
    // missed.
    expect(result.templateCheckAborted?.code).toBe(
      TCB_GENERATION_FATAL_DIAGNOSTIC_CODE,
    );
    expect(TCB_GENERATION_FATAL_DIAGNOSTIC_CODE).toBe(NG(3004));

    // The detector recognizes NG3004 and ONLY NG3004: the sibling structural codes
    // NG3001 (SYMBOL_NOT_EXPORTED) / NG3003 (IMPORT_CYCLE_DETECTED) are
    // analysis-phase Fatals that do NOT abort shared TCB-generation shim priming,
    // so they must NOT trip the abort notice.
    const ERROR_CATEGORY = 1 as ts.DiagnosticCategory;
    const synthetic = (code: number): ts.Diagnostic => ({
      category: ERROR_CATEGORY,
      code,
      file: { fileName: '/ws/app/x.component.ts' } as ts.SourceFile,
      start: undefined,
      length: undefined,
      messageText: 'synthesized',
    });

    expect(detectTemplateCheckAborted([synthetic(NG(3004))])).toBeDefined();
    expect(detectTemplateCheckAborted([synthetic(NG(3001))])).toBeUndefined();
    expect(detectTemplateCheckAborted([synthetic(NG(3003))])).toBeUndefined();
  });
});
