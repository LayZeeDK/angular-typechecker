import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

import { runTypecheck } from './run-typecheck';

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
