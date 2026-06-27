import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { runTypecheck } from './run-typecheck';

// REAL-compiler config-resolution proofs (TEST-02, D-07c): call `runTypecheck`
// DIRECTLY against committed fixture tsconfigs and assert off `CoreResult`. This
// slice closes the "type-checker that LIES via config" threat surface end-to-end:
//
//   - EXE-02   a tsconfig.spec.json is type-checked (the named differentiator vs
//              a build check -- a build never compiles the specs).
//   - D-03/MD-01 a malformed/unresolvable tsconfig is never silently clean; the
//              dropped-then-restored `parsed.errors` entry is RETURNED (not
//              thrown) so agents/CI get a non-zero signal.
//   - D-03/D-03a a solution-style / references-only tsconfig returns the
//              deterministic `rootNamesCount: 0` + `errorCount: 1` guard with a
//              leaf-tsconfig-naming message -- NOT a false "0 files / 0 errors".
//
// The engine itself (the D-03 prepend + zero-rootNames guard) was implemented in
// 02-01; these fixtures + assertions prove the guard fires across the real
// silent-lie inputs.

// Angular encodes extended codes negative: ngErrorCode(8109) = -998109. Assert NG
// codes via the NG() helper, never the bare 8109 (PITFALL E / L-4). TS codes are
// raw. The planted spec-file error is a plain TS2322.
const TS2322 = 2322;
const NG = (code: number): number => -990000 - code;

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspaceRoot = join(packageRoot, '..', '..');

const specTsConfig = join(
  workspaceRoot,
  'fixtures',
  'config-broken',
  'tsconfig.spec.json',
);
const malformedTsConfig = join(
  workspaceRoot,
  'fixtures',
  'config-broken',
  'tsconfig.malformed.json',
);
const solutionStyleTsConfig = join(
  workspaceRoot,
  'fixtures',
  'solution-style',
  'tsconfig.json',
);

function messageTextOf(diagnostic: ts.Diagnostic): string {
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
}

describe('config-resolution: spec tsconfig is type-checked (EXE-02)', () => {
  it('reports the planted spec-file TS2322 with rootNamesCount > 0', async () => {
    const result = await runTypecheck({ tsConfigPath: specTsConfig });

    expect(result.rootNamesCount).toBeGreaterThan(0);
    expect(result.errorCount).toBeGreaterThanOrEqual(1);

    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);

    // The planted spec-file type error proves the *.spec.ts source itself was
    // type-checked -- the differentiator vs a build check.
    expect(codes).toContain(TS2322);
  });
});

describe('config-resolution: malformed config is never silently clean (D-03/MD-01)', () => {
  it('returns (does NOT throw) and reports errorCount >= 1 with the config error prepended', async () => {
    // D-03 part 3: config problems are RETURNED, not thrown.
    const result = await runTypecheck({ tsConfigPath: malformedTsConfig });

    expect(result.errorCount).toBeGreaterThanOrEqual(1);

    // The prepended `parsed.errors` entry: a file-read/resolution error naming
    // the unresolvable `extends` target. Its presence proves the malformed
    // config was not dropped into a false "clean".
    const configError = result.diagnostics.find((diagnostic) =>
      messageTextOf(diagnostic).includes('tsconfig.does-not-exist.json'),
    );

    expect(configError).toBeDefined();
    expect(configError?.category).toBe(ts.DiagnosticCategory.Error);
  });

  it('does not throw a TypecheckInfrastructureError for a malformed config', async () => {
    // A malformed config is a genuine (returned) diagnostic, never an infra
    // failure -- so the call resolves rather than rejecting.
    await expect(
      runTypecheck({ tsConfigPath: malformedTsConfig }),
    ).resolves.toBeDefined();
  });
});

describe('config-resolution: solution-style guard fires (D-03/D-03a)', () => {
  it('returns rootNamesCount 0 AND errorCount 1 with a leaf-tsconfig-naming message', async () => {
    const result = await runTypecheck({ tsConfigPath: solutionStyleTsConfig });

    // The deterministic non-zero signal: exactly one synthesized Error, zero
    // root names -- NOT a false "0 files / 0 errors".
    expect(result.rootNamesCount).toBe(0);
    expect(result.errorCount).toBe(1);

    const [guard] = result.diagnostics;

    expect(guard).toBeDefined();
    expect(guard.category).toBe(ts.DiagnosticCategory.Error);

    // The message must steer the user toward a leaf tsconfig.
    expect(messageTextOf(guard)).toMatch(/tsconfig\.(app|lib|spec)\.json/);
  });

  it('does NOT gate on TS18003 (the references-suppressed "No inputs were found")', async () => {
    const result = await runTypecheck({ tsConfigPath: solutionStyleTsConfig });

    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);

    // D-03a / L-2: TypeScript suppresses TS18003 when a config has `references`,
    // so the guard MUST NOT depend on it. The result is the synthesized guard
    // alone, not a TS18003-driven signal.
    expect(codes).not.toContain(18003);
  });
});
