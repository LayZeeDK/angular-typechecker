import type { Program } from '@angular/compiler-cli';
import type ts from 'typescript';

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
    } as unknown as Program;

    const codes = gatherAllDiagnostics(program).map(
      (diagnostic) => diagnostic.code,
    );

    expect(getNgSemanticDiagnostics).toHaveBeenCalledOnce();
    expect(codes).toContain(2322);
    expect(codes).toContain(8109);
  });
});
