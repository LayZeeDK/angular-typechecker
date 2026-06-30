import type ts from 'typescript';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CompilerCli } from './compiler-cli-types';
import { TCB_GENERATION_FATAL_DIAGNOSTIC_CODE } from './diagnostic-codes';

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

// RES-02 / I-1: a FILE-carrying Error diagnostic (the file-less `errorDiagnostic`
// cannot exercise the boundary-filter classification). The detector reads only
// `.code` and `.file?.fileName`, so the minimal `{ fileName }` shim is enough.
function fileDiagnostic(code: number, fileName: string): ts.Diagnostic {
  return {
    category: 1, // ts.DiagnosticCategory.Error
    code,
    file: { fileName } as ts.SourceFile,
    start: undefined,
    length: undefined,
    messageText: 'x',
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
    // Clear the readConfiguration call history so the RES-04 spy assertion sees
    // only THIS test's call. `mockReset` would also drop the default return
    // value, so reset then restore the default below.
    compilerCliStub.readConfiguration.mockReset();
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

    // T3: the re-throw flattens the planted messageText via
    // `ts.flattenDiagnosticMessageText(..., '\n')` (a no-op for a single string),
    // so the thrown message carries the compiler text verbatim, not a generic
    // placeholder.
    await expect(
      runTypecheck({ tsConfigPath: '/virtual/tsconfig.json' }),
    ).rejects.toThrow(/simulated internal crash/);
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

  // RES-04 / D-09 / SC4 (deterministic Option a, RESEARCH Open Q1): prove the
  // engine passes `{ suppressOutputPathCheck: true }` as the SECOND ARG to
  // `readConfiguration`, matching `@angular/build`'s `loadConfiguration`
  // (`angular-compilation.ts:51` @ v22.0.4) EXACTLY. The output-path overwrite
  // check fires in TypeScript's `verifyCompilerOptions()` gated by
  // `!options.noEmit && !options.suppressOutputPathCheck` (verifyCompilerOptions, TS 6.0.3),
  // so this is belt-and-suspenders parity (the engine's `noEmit:true` already
  // suppresses it). A spy assertion is the deterministic proof of the placement;
  // the no-nuisance behavior under the real compiler is proven by the companion
  // `suppress-output-path.integration.spec.ts`.
  it('RES-04: passes { suppressOutputPathCheck: true } to readConfiguration', async () => {
    compilerCliStub.performCompilation.mockReturnValue({
      diagnostics: [],
      // The non-infra path completes through the Phase-3 boundary filter, which
      // reads `program.getTsProgram().useCaseSensitiveFileNames()`.
      program: fakeProgram(),
    });

    const { runTypecheck } = await import('./run-typecheck');

    await runTypecheck({ tsConfigPath: '/virtual/tsconfig.json' });

    expect(compilerCliStub.readConfiguration).toHaveBeenCalledWith(
      '/virtual/tsconfig.json',
      { suppressOutputPathCheck: true },
    );
  });

  // RES-02 / I-1: an out-of-basePath TCB-generation Fatal (NG3004) is SUPPRESSED
  // from the reported set by the boundary filter, yet it MUST still fire
  // `templateCheckAborted` -- the abort is whole-program, so survivors' template
  // diagnostics are gone regardless of where the offending shim lives. The mock
  // `readConfiguration` returns `options: {}`, so `resolveFilterBasePath` falls
  // back to `dirname('/virtual/tsconfig.json')` === `/virtual`; an NG3004 whose
  // file sits at `/elsewhere/...` is therefore out-of-basePath and filtered out.
  // This FAILS when detection scans the post-filter reported set (NG3004 absent ->
  // `templateCheckAborted` undefined) and PASSES when detection scans the
  // pre-filter `diagnostics` arg (the I-1 fix).
  it('RES-02 / I-1: an out-of-basePath TCB-generation Fatal is SUPPRESSED yet still sets templateCheckAborted', async () => {
    compilerCliStub.performCompilation.mockReturnValue({
      diagnostics: [
        fileDiagnostic(
          TCB_GENERATION_FATAL_DIAGNOSTIC_CODE,
          '/elsewhere/poison.component.ngtypecheck.ts',
        ),
      ],
      program: fakeProgram(),
    });

    const { runTypecheck } = await import('./run-typecheck');

    const result = await runTypecheck({
      tsConfigPath: '/virtual/tsconfig.json',
    });

    // The NG3004 was suppressed by the boundary filter (out of /virtual).
    expect(result.suppressedCount).toBeGreaterThanOrEqual(1);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain(
      TCB_GENERATION_FATAL_DIAGNOSTIC_CODE,
    );

    // YET the abort notice still fires, naming the SOURCE component (the
    // `.ngtypecheck` shim infix is normalized back to `.ts`).
    expect(result.templateCheckAborted).toBeDefined();
    expect(result.templateCheckAborted?.code).toBe(
      TCB_GENERATION_FATAL_DIAGNOSTIC_CODE,
    );
    expect(result.templateCheckAborted?.fileName).toBe(
      '/elsewhere/poison.component.ts',
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

    // T3: the config-stage re-throw flattens the planted ENOENT messageText. Assert
    // a stable cross-OS substring (no path tail / drive letter) so the regex is
    // deterministic on Windows/Linux/macOS.
    await expect(
      runTypecheck({ tsConfigPath: '/virtual/tsconfig.json' }),
    ).rejects.toThrow(/no such file or directory/);

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
