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

// Hoisted mutable handles so each test can swap the stubbed `readConfiguration`
// AND `performCompilation` behavior before importing/calling the engine. The
// default `readConfiguration` returns non-empty rootNames so the engine does NOT
// short-circuit on the D-03 zero-rootNames guard and instead reaches
// `performCompilation`; the COR-01 cases override it to drive the config-parse
// 500 / 5012 shapes.
const compilerCliStub = vi.hoisted(() => {
  return {
    readConfiguration: vi.fn(() => ({
      project: '/virtual/tsconfig.json',
      options: {},
      rootNames: ['/virtual/error.component.ts'],
      errors: [],
      emitFlags: 0,
    })),
    performCompilation: vi.fn(),
  };
});

vi.mock('./compiler-loader', () => {
  return {
    loadCompilerCli: vi.fn(
      async (): Promise<CompilerCli> =>
        ({
          readConfiguration: compilerCliStub.readConfiguration,
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

// Minimal fake Program for the non-infra-failure path: a real `performCompilation`
// always returns a `program` whose `getTsProgram().useCaseSensitiveFileNames()`
// the Phase-3 boundary filter reads. The diagnostics here are file-less, so the
// filter keeps them regardless -- this stub just satisfies the host access.
function fakeProgram(): unknown {
  return {
    getTsProgram: () => ({
      useCaseSensitiveFileNames: () => true,
    }),
  };
}

describe('runTypecheck infrastructure-failure handling (D-06)', () => {
  beforeEach(() => {
    compilerCliStub.performCompilation.mockReset();
    // Restore the default non-empty-rootNames / no-errors config parse so the
    // post-performCompilation cases below reach `performCompilation`. The COR-01
    // cases override this per test.
    compilerCliStub.readConfiguration.mockReturnValue({
      project: '/virtual/tsconfig.json',
      options: {},
      rootNames: ['/virtual/error.component.ts'],
      errors: [],
      emitFlags: 0,
    });
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
      // The normal (non-500) path reaches the Phase-3 boundary filter, which
      // reads `program.getTsProgram().useCaseSensitiveFileNames()`.
      program: fakeProgram(),
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

// COR-01 / D-01..D-03 unit twin: the SECOND 500 scan, on `parsed.errors`. A
// config-resolution crash (nonexistent tsconfig path / circular extends) surfaces
// as a code-500 in `readConfiguration().errors` AND `rootNames: []` -- the real
// shape verified against @angular/compiler-cli@22.0.4. This stubs that shape and
// proves `runTypecheck` REJECTS with a `TypecheckInfrastructureError` BEFORE the
// zero-rootNames guard (a late scan would be swallowed by the guard and the 500
// mis-counted as a type error). The contrast case proves a genuine config
// diagnostic (code 5012) with non-empty rootNames stays folded and is RETURNED,
// never thrown (D-03 boundary).
const TS5012 = 5012;

describe('runTypecheck config-resolution infrastructure-failure handling (COR-01)', () => {
  beforeEach(() => {
    compilerCliStub.performCompilation.mockReset();
    compilerCliStub.readConfiguration.mockReset();
  });

  it('RE-THROWS a TypecheckInfrastructureError for a config-parse UNKNOWN_ERROR_CODE (500) in parsed.errors with rootNames: []', async () => {
    // The real 500 shape: rootNames: [] (so the scan MUST precede the
    // zero-rootNames guard) and a single code-500 Error in parsed.errors.
    compilerCliStub.readConfiguration.mockReturnValue({
      project: '/virtual/tsconfig.json',
      options: {},
      rootNames: [],
      errors: [
        {
          category: 1, // ts.DiagnosticCategory.Error
          code: UNKNOWN_ERROR_CODE,
          source: 'angular',
          file: undefined,
          start: undefined,
          length: undefined,
          messageText:
            "Error: ENOENT: no such file or directory, lstat '/virtual/tsconfig.json'",
        },
      ],
      emitFlags: 0,
    });

    const { runTypecheck, TypecheckInfrastructureError } = await import(
      './run-typecheck'
    );

    await expect(
      runTypecheck({ tsConfigPath: '/virtual/tsconfig.json' }),
    ).rejects.toBeInstanceOf(TypecheckInfrastructureError);

    // The scan must fire on the config parse alone -- performCompilation is
    // never reached on the 500 path.
    expect(compilerCliStub.performCompilation).not.toHaveBeenCalled();
  });

  it('does NOT throw on a genuine config diagnostic (code 5012) with non-empty rootNames; it stays folded and is RETURNED (D-03)', async () => {
    // A non-500 config diagnostic (e.g. a nonexistent `extends` target -> 5012)
    // is a genuine, returnable diagnostic -- never re-classified as infra.
    compilerCliStub.readConfiguration.mockReturnValue({
      project: '/virtual/tsconfig.json',
      options: {},
      rootNames: ['/virtual/error.component.ts'],
      errors: [
        errorDiagnostic(TS5012, "Cannot read file '/virtual/tsconfig.base.json'."),
      ],
      emitFlags: 0,
    });
    compilerCliStub.performCompilation.mockReturnValue({
      diagnostics: [],
      program: fakeProgram(),
    });

    const { runTypecheck } = await import('./run-typecheck');

    const result = await runTypecheck({
      tsConfigPath: '/virtual/tsconfig.json',
    });

    // The 5012 entry stays folded into the reported diagnostics and is counted.
    expect(result.errorCount).toBeGreaterThanOrEqual(1);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      TS5012,
    );
  });
});
