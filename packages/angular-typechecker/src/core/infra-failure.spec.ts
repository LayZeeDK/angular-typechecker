import type ts from 'typescript';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CompilerCli } from './compiler-cli-types';

// D-06 re-throw proof -- the SINGLE justified mock in Phase 2 (RESEARCH Open Q2;
// broad mocking is Phase-3 TEST-01). It stubs the loaded @angular/compiler-cli
// namespace so `performCompilation` returns a synthesized code-500
// (UNKNOWN_ERROR_CODE) diagnostic, proving `runTypecheck` RE-THROWS a
// `TypecheckInfrastructureError` instead of counting the infra crash as a type
// error. A contrasting case returns a normal TS2322 (category Error) and proves
// only code 500 -- not a real type error -- triggers the throw.

const UNKNOWN_ERROR_CODE = 500;
const TS2322 = 2322;

// Hoisted mutable handle so each test can swap the stubbed `performCompilation`
// behavior before importing/calling the engine.
const compilerCliStub = vi.hoisted(() => {
  return {
    performCompilation: vi.fn(),
  };
});

vi.mock('./compiler-loader', () => {
  return {
    loadCompilerCli: vi.fn(
      async (): Promise<CompilerCli> =>
        ({
          // Non-empty rootNames so the engine does NOT short-circuit on the
          // D-03 zero-rootNames guard and instead reaches performCompilation.
          readConfiguration: vi.fn(() => ({
            project: '/virtual/tsconfig.json',
            options: {},
            rootNames: ['/virtual/error.component.ts'],
            errors: [],
            emitFlags: 0,
          })),
          performCompilation: compilerCliStub.performCompilation,
          defaultGatherDiagnostics: vi.fn(() => []),
          EmitFlags: { None: 0 },
          UNKNOWN_ERROR_CODE,
        }) as unknown as CompilerCli,
    ),
  };
});

function errorDiagnostic(code: number, message: string): ts.Diagnostic {
  return {
    category: 1, // ts.DiagnosticCategory.Error
    code,
    file: undefined,
    start: undefined,
    length: undefined,
    messageText: message,
  } as ts.Diagnostic;
}

describe('runTypecheck infrastructure-failure handling (D-06)', () => {
  beforeEach(() => {
    compilerCliStub.performCompilation.mockReset();
  });

  it('RE-THROWS a TypecheckInfrastructureError when performCompilation returns an UNKNOWN_ERROR_CODE (500) diagnostic', async () => {
    compilerCliStub.performCompilation.mockReturnValue({
      diagnostics: [
        errorDiagnostic(UNKNOWN_ERROR_CODE, 'simulated internal crash'),
      ],
      program: undefined,
    });

    const { runTypecheck, TypecheckInfrastructureError } = await import(
      './run-typecheck'
    );

    await expect(
      runTypecheck({ tsConfigPath: '/virtual/tsconfig.json' }),
    ).rejects.toBeInstanceOf(TypecheckInfrastructureError);
  });

  it('does NOT throw on a normal TS2322 type error and counts it in errorCount', async () => {
    compilerCliStub.performCompilation.mockReturnValue({
      diagnostics: [
        errorDiagnostic(TS2322, 'Type string is not assignable to type number'),
      ],
      program: undefined,
    });

    const { runTypecheck } = await import('./run-typecheck');

    const result = await runTypecheck({
      tsConfigPath: '/virtual/tsconfig.json',
    });

    expect(result.errorCount).toBe(1);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      TS2322,
    );
  });
});
