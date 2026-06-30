import { dirname } from 'node:path';

import type ts from 'typescript';
import { describe, expect, it } from 'vitest';

import {
  IMPORT_GENERATION_FAILURE_CODE,
  NG,
  TCB_GENERATION_FATAL_DIAGNOSTIC_CODE,
} from './diagnostic-codes';
import {
  detectTemplateCheckAborted,
  resolveFilterBasePath,
} from './run-typecheck';

// WR-01 regression: the project-boundary filter keys off `basePath`. An empty
// base makes `isUnderDir` treat `'' + '/'` as `/`, matching EVERY absolute path
// on POSIX and silently DISABLING the filter. `resolveFilterBasePath` must never
// return '' for an absolute tsConfigPath -- it falls back to the leaf tsconfig's
// directory whenever the parsed `basePath` is missing.
describe('resolveFilterBasePath (WR-01)', () => {
  const tsConfigPath = '/abs/workspace/packages/app/tsconfig.app.json';
  const tsConfigDir = dirname(tsConfigPath);

  it('returns the parsed basePath unchanged when it is a non-empty absolute path', () => {
    const parsedBasePath = '/abs/workspace/packages/app';

    expect(resolveFilterBasePath(parsedBasePath, tsConfigPath)).toBe(
      parsedBasePath,
    );
  });

  it('falls back to dirname(tsConfigPath) when the parsed basePath is undefined', () => {
    expect(resolveFilterBasePath(undefined, tsConfigPath)).toBe(tsConfigDir);
  });

  it('falls back to dirname(tsConfigPath) when the parsed basePath is the empty-string sentinel (?? would not catch it)', () => {
    expect(resolveFilterBasePath('', tsConfigPath)).toBe(tsConfigDir);
  });

  it('never yields an empty base that would disable the boundary filter', () => {
    for (const parsedBasePath of [undefined, '']) {
      expect(resolveFilterBasePath(parsedBasePath, tsConfigPath)).not.toBe('');
    }
  });
});

// RES-02 (reframe; 09-RES-02-DECISION.md, Option A): a TCB-generation
// FatalDiagnosticError (NG3004 IMPORT_GENERATION_FAILURE) is thrown DURING the
// shared ensureAllShimsForAllFiles() priming, which aborts shim generation for
// ALL files -- so surviving files' Angular template/extended (NG8xxx)
// diagnostics are suppressed. `detectTemplateCheckAborted` is the PURE core
// signal that lets the adapter surface a loud notice so that incompleteness is
// never silent. These unit tests prove the detection on SYNTHESIZED reported
// sets (no cold compiler); the integration tier proves it end-to-end against the
// poison fixture.
describe('detectTemplateCheckAborted (RES-02 reframe)', () => {
  // Category is read only by the count step in finalize, not by the detector;
  // the literal Error value (1) keeps these synthesized diagnostics realistic
  // without importing the heavy runtime `typescript` module.
  const ERROR_CATEGORY = 1 as ts.DiagnosticCategory;

  function diagnostic(code: number, fileName?: string): ts.Diagnostic {
    return {
      category: ERROR_CATEGORY,
      code,
      file:
        fileName === undefined ? undefined : ({ fileName } as ts.SourceFile),
      start: undefined,
      length: undefined,
      messageText: 'synthesized',
    };
  }

  it('the negative-encoded TCB-generation Fatal code equals NG(3004)', () => {
    // Guards the vendored constant against an encoding drift: the detector keys
    // off TCB_GENERATION_FATAL_DIAGNOSTIC_CODE, which MUST equal the value the
    // compiler stamps on a caught Fatal (ngErrorCode(3004)).
    expect(TCB_GENERATION_FATAL_DIAGNOSTIC_CODE).toBe(
      NG(IMPORT_GENERATION_FAILURE_CODE),
    );
    expect(TCB_GENERATION_FATAL_DIAGNOSTIC_CODE).toBe(-993004);
  });

  it('flags the abort and carries the offending file when the NG3004 Fatal is present', () => {
    const reported = [
      diagnostic(2322, '/ws/app/survivor.component.ts'),
      diagnostic(
        TCB_GENERATION_FATAL_DIAGNOSTIC_CODE,
        '/ws/app/poison.component.ts',
      ),
    ];

    expect(detectTemplateCheckAborted(reported)).toEqual({
      code: TCB_GENERATION_FATAL_DIAGNOSTIC_CODE,
      fileName: '/ws/app/poison.component.ts',
    });
  });

  it('carries fileName undefined for a file-less TCB-generation Fatal', () => {
    const reported = [diagnostic(TCB_GENERATION_FATAL_DIAGNOSTIC_CODE)];

    expect(detectTemplateCheckAborted(reported)).toEqual({
      code: TCB_GENERATION_FATAL_DIAGNOSTIC_CODE,
      fileName: undefined,
    });
  });

  it('normalizes the generated .ngtypecheck.ts shim path back to the source component', () => {
    // The compiler attaches the TCB-generation Fatal to the synthesized
    // `<name>.ngtypecheck.ts` shim, NOT the authored `<name>.ts`. The notice
    // must point at a file the consumer can open and fix, so the shim infix is
    // stripped (verified compiler convention at v22.0.4).
    const reported = [
      diagnostic(
        TCB_GENERATION_FATAL_DIAGNOSTIC_CODE,
        '/ws/app/poison.component.ngtypecheck.ts',
      ),
    ];

    expect(detectTemplateCheckAborted(reported)?.fileName).toBe(
      '/ws/app/poison.component.ts',
    );
  });

  it('leaves an already-source (non-shim) offending file path unchanged', () => {
    const reported = [
      diagnostic(
        TCB_GENERATION_FATAL_DIAGNOSTIC_CODE,
        '/ws/app/poison.component.ts',
      ),
    ];

    expect(detectTemplateCheckAborted(reported)?.fileName).toBe(
      '/ws/app/poison.component.ts',
    );
  });

  // S5d: the shim regex `/\.ngtypecheck\.ts$/` is `.ts$`-anchored, so a
  // `.ngtypecheck.tsx` name does NOT match and passes through UNCHANGED -- pinning
  // the `$` anchor. Per the documented LIMITATION (run-typecheck.ts), `.tsx`
  // sources collapse to `<name>.ngtypecheck.ts`, never `.tsx`, so this is a
  // negative-case anchor guard; mirrors the `.ngtypecheck.ts` positive test above.
  it('leaves a .ngtypecheck.tsx path unchanged (the .ts$ shim anchor does not match .tsx)', () => {
    const reported = [
      diagnostic(
        TCB_GENERATION_FATAL_DIAGNOSTIC_CODE,
        '/ws/app/poison.component.ngtypecheck.tsx',
      ),
    ];

    expect(detectTemplateCheckAborted(reported)?.fileName).toBe(
      '/ws/app/poison.component.ngtypecheck.tsx',
    );
  });

  it('stays UNSET on a clean reported set (no false positive)', () => {
    const reported = [
      diagnostic(2322, '/ws/app/a.component.ts'),
      diagnostic(NG(8109), '/ws/app/b.component.ts'),
    ];

    expect(detectTemplateCheckAborted(reported)).toBeUndefined();
  });

  it('stays UNSET on an empty reported set', () => {
    expect(detectTemplateCheckAborted([])).toBeUndefined();
  });

  it('does NOT fire on the sibling structural codes NG3001 / NG3003 (analysis-phase, not TCB-generation)', () => {
    // The decision EXCLUDES 3001/3003: at v22.0.4 they are thrown during
    // component analysis, surface through the structural getters, and do NOT
    // abort shared TCB-generation shim priming -- so they must not trip the
    // suppression notice.
    const reported = [
      diagnostic(NG(3001), '/ws/app/c.component.ts'),
      diagnostic(NG(3003), '/ws/app/d.component.ts'),
    ];

    expect(detectTemplateCheckAborted(reported)).toBeUndefined();
  });
});
