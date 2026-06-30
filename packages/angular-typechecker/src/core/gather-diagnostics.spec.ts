import type ts from 'typescript';

import type { Program } from './compiler-cli-types';

import { describe, expect, it, vi } from 'vitest';

import { gatherAllDiagnostics } from './gather-diagnostics';

function diagnostic(code: number): ts.Diagnostic {
  return { code } as ts.Diagnostic;
}

// RES-02 / D-04: the Angular semantic set is gathered HYBRID (per the RES-01 GO
// decision in 09-RES-01-SPIKE.md) -- a residual whole-program
// getNgSemanticDiagnostics() PLUS a per-file loop over
// getTsProgram().getSourceFiles() (skipping isDeclarationFile) calling
// getNgSemanticDiagnostics(sf.fileName). These mocks therefore stub
// getTsProgram() with BOTH getGlobalDiagnostics() (COR-02) and getSourceFiles()
// (the RES-02 per-file loop). A tiny ts.SourceFile builder keeps the loop body
// exercised without a real compiler.
function sourceFile(fileName: string, isDeclarationFile = false): ts.SourceFile {
  return { fileName, isDeclarationFile } as ts.SourceFile;
}

describe('gatherAllDiagnostics', () => {
  it('calls all the unconditional getters in order, then the per-file Angular loop (RES-02 HYBRID)', () => {
    const calls: string[] = [];
    const stub = (name: string, code: number) =>
      vi.fn(() => {
        calls.push(name);

        return [diagnostic(code)];
      });

    // getNgSemanticDiagnostics is called whole-program (no arg) AND per-file
    // (with a fileName). Record the call and tag it so the order assertion can
    // distinguish the residual whole-program call from the per-file iterations.
    const getNgSemanticDiagnostics = vi.fn((fileName?: string) => {
      calls.push(
        fileName === undefined
          ? 'getNgSemanticDiagnostics'
          : `getNgSemanticDiagnostics(${fileName})`,
      );

      return [diagnostic(8109)];
    });

    const program = {
      getTsOptionDiagnostics: stub('getTsOptionDiagnostics', 1),
      getNgOptionDiagnostics: stub('getNgOptionDiagnostics', 2),
      getTsSyntacticDiagnostics: stub('getTsSyntacticDiagnostics', 3),
      getTsSemanticDiagnostics: stub('getTsSemanticDiagnostics', 2322),
      getNgStructuralDiagnostics: stub('getNgStructuralDiagnostics', 5),
      getNgSemanticDiagnostics,
      // COR-02 / D-04 + RES-02: the underlying ts.Program exposes BOTH
      // getGlobalDiagnostics (the COR-02 seventh getter, no globals here) and
      // getSourceFiles (the RES-02 per-file loop source). A .d.ts source file is
      // included to prove the loop skips it (isDeclarationFile).
      getTsProgram: () => ({
        getGlobalDiagnostics: () => [],
        getSourceFiles: () => [
          sourceFile('/ws/a.component.ts'),
          sourceFile('/ws/lib.d.ts', true),
          sourceFile('/ws/b.component.ts'),
        ],
      }),
    } as unknown as Program;

    const result = gatherAllDiagnostics(program);

    expect(calls).toEqual([
      'getTsOptionDiagnostics',
      'getNgOptionDiagnostics',
      'getTsSyntacticDiagnostics',
      'getTsSemanticDiagnostics',
      'getNgStructuralDiagnostics',
      'getNgSemanticDiagnostics',
      'getNgSemanticDiagnostics(/ws/a.component.ts)',
      'getNgSemanticDiagnostics(/ws/b.component.ts)',
    ]);
    // The .d.ts source file is skipped (D-06): only the two .component.ts files
    // drive a per-file call.
    expect(result.map((diagnostic) => diagnostic.code)).toEqual([
      1, 2, 3, 2322, 5, 8109, 8109, 8109,
    ]);
  });

  it('skips isDeclarationFile source files in the per-file Angular loop (RES-02 / D-06)', () => {
    const getNgSemanticDiagnostics = vi.fn(() => [diagnostic(8109)]);

    const program = {
      getTsOptionDiagnostics: vi.fn(() => []),
      getNgOptionDiagnostics: vi.fn(() => []),
      getTsSyntacticDiagnostics: vi.fn(() => []),
      getTsSemanticDiagnostics: vi.fn(() => []),
      getNgStructuralDiagnostics: vi.fn(() => []),
      getNgSemanticDiagnostics,
      getTsProgram: () => ({
        getGlobalDiagnostics: () => [],
        getSourceFiles: () => [
          sourceFile('/ws/only.d.ts', true),
          sourceFile('/ws/another.d.ts', true),
        ],
      }),
    } as unknown as Program;

    gatherAllDiagnostics(program);

    // Only the residual whole-program call fires; every source file is a .d.ts,
    // so the per-file loop adds NO further calls.
    expect(getNgSemanticDiagnostics).toHaveBeenCalledTimes(1);
    expect(getNgSemanticDiagnostics).toHaveBeenCalledWith();
  });

  it('still calls getNgSemanticDiagnostics even after a TypeScript semantic error (no short-circuit)', () => {
    const getNgSemanticDiagnostics = vi.fn(() => [diagnostic(8109)]);

    const program = {
      getTsOptionDiagnostics: vi.fn(() => []),
      getNgOptionDiagnostics: vi.fn(() => []),
      getTsSyntacticDiagnostics: vi.fn(() => []),
      getTsSemanticDiagnostics: vi.fn(() => [diagnostic(2322)]),
      getNgStructuralDiagnostics: vi.fn(() => []),
      getNgSemanticDiagnostics,
      // COR-02 / D-04 + RES-02: stub getGlobalDiagnostics (no globals) and
      // getSourceFiles (no project source files) so the gatherer's unconditional
      // getGlobalDiagnostics() call and per-file loop do not throw.
      getTsProgram: () => ({
        getGlobalDiagnostics: () => [],
        getSourceFiles: () => [],
      }),
    } as unknown as Program;

    const codes = gatherAllDiagnostics(program).map(
      (diagnostic) => diagnostic.code,
    );

    // The residual whole-program call still fires unconditionally after the TS
    // semantic error (no short-circuit); with no project source files the
    // per-file loop adds nothing.
    expect(getNgSemanticDiagnostics).toHaveBeenCalledOnce();
    expect(codes).toContain(2322);
    expect(codes).toContain(8109);
  });

  it('gathers GLOBAL TS diagnostics via getTsProgram().getGlobalDiagnostics (COR-02 / D-04)', () => {
    // The six per-file/option getters return nothing; the global diagnostic
    // (e.g. a raw TS2318) reaches the gatherer ONLY through the
    // getTsProgram().getGlobalDiagnostics() call. 2318 is a RAW TypeScript code
    // (positive) -- it is NOT an Angular extended code, so it is asserted
    // directly, never via the negative NG() encoding (RESEARCH Pitfall 5).
    const getGlobalDiagnostics = vi.fn(() => [diagnostic(2318)]);

    const program = {
      getTsOptionDiagnostics: vi.fn(() => []),
      getNgOptionDiagnostics: vi.fn(() => []),
      getTsSyntacticDiagnostics: vi.fn(() => []),
      getTsSemanticDiagnostics: vi.fn(() => []),
      getNgStructuralDiagnostics: vi.fn(() => []),
      getNgSemanticDiagnostics: vi.fn(() => []),
      getTsProgram: () => ({ getGlobalDiagnostics, getSourceFiles: () => [] }),
    } as unknown as Program;

    const codes = gatherAllDiagnostics(program).map(
      (diagnostic) => diagnostic.code,
    );

    expect(getGlobalDiagnostics).toHaveBeenCalledOnce();
    expect(codes).toContain(2318);
  });
});
