import type ts from 'typescript';

import type { Program } from './compiler-cli-types';

import { describe, expect, it, vi } from 'vitest';

import { gatherAllDiagnostics } from './gather-diagnostics';

function diagnostic(code: number): ts.Diagnostic {
  return { code } as ts.Diagnostic;
}

describe('gatherAllDiagnostics', () => {
  it('calls all six getters unconditionally and in order', () => {
    const calls: string[] = [];
    const stub = (name: string, code: number) =>
      vi.fn(() => {
        calls.push(name);

        return [diagnostic(code)];
      });

    const program = {
      getTsOptionDiagnostics: stub('getTsOptionDiagnostics', 1),
      getNgOptionDiagnostics: stub('getNgOptionDiagnostics', 2),
      getTsSyntacticDiagnostics: stub('getTsSyntacticDiagnostics', 3),
      getTsSemanticDiagnostics: stub('getTsSemanticDiagnostics', 2322),
      getNgStructuralDiagnostics: stub('getNgStructuralDiagnostics', 5),
      getNgSemanticDiagnostics: stub('getNgSemanticDiagnostics', 8109),
      // COR-02 / D-04: the seventh getter lives on the underlying ts.Program
      // (getTsProgram().getGlobalDiagnostics). Stub it returning no globals so
      // this test keeps asserting the SIX per-Program getters in order; the
      // global-diagnostics push is covered by its own test below.
      getTsProgram: () => ({ getGlobalDiagnostics: () => [] }),
    } as unknown as Program;

    const result = gatherAllDiagnostics(program);

    expect(calls).toEqual([
      'getTsOptionDiagnostics',
      'getNgOptionDiagnostics',
      'getTsSyntacticDiagnostics',
      'getTsSemanticDiagnostics',
      'getNgStructuralDiagnostics',
      'getNgSemanticDiagnostics',
    ]);
    expect(result.map((diagnostic) => diagnostic.code)).toEqual([
      1, 2, 3, 2322, 5, 8109,
    ]);
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
      // COR-02 / D-04: stub the seventh getter (no globals) so the gatherer's
      // unconditional getTsProgram().getGlobalDiagnostics() call does not throw.
      getTsProgram: () => ({ getGlobalDiagnostics: () => [] }),
    } as unknown as Program;

    const codes = gatherAllDiagnostics(program).map(
      (diagnostic) => diagnostic.code,
    );

    expect(getNgSemanticDiagnostics).toHaveBeenCalledOnce();
    expect(codes).toContain(2322);
    expect(codes).toContain(8109);
  });

  it('gathers GLOBAL TS diagnostics via getTsProgram().getGlobalDiagnostics (COR-02 / D-04)', () => {
    // The six per-file/option getters return nothing; the global diagnostic
    // (e.g. a raw TS2318) reaches the gatherer ONLY through the seventh call,
    // getTsProgram().getGlobalDiagnostics(). 2318 is a RAW TypeScript code
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
      getTsProgram: () => ({ getGlobalDiagnostics }),
    } as unknown as Program;

    const codes = gatherAllDiagnostics(program).map(
      (diagnostic) => diagnostic.code,
    );

    expect(getGlobalDiagnostics).toHaveBeenCalledOnce();
    expect(codes).toContain(2318);
  });
});
