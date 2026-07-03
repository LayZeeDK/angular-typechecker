import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

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
//   - D-03/D-03a (Phase 13) a solution-style tsconfig with references + >=1
//              in-project leaf WALKS the leaves and unions the per-leaf
//              diagnostics into ONE finalize -- reporting BOTH leaves' planted
//              TS2322 (`rootNamesCount > 0`, `errorCount: 2`) -- NOT the old
//              short-circuit guard. TS18003 stays suppressed (references present).
//
// The engine itself (the D-03 prepend + zero-rootNames guard + the Phase 13
// three-way split into the reference walk) was implemented in 02-01 / 13-04;
// these fixtures + assertions prove the behavior across the real silent-lie
// inputs. (The empty-project / none-in-project 90001 guard branches are proven by
// the dedicated walk integration spec.)

// The planted spec-file error is a plain TS2322 (raw positive). No NG8xxx code is
// asserted here (PITFALL E / L-4), so no negative-encoding helper is needed
// (Angular would encode extended codes negative, e.g. ngErrorCode(8109) = -998109).
const TS2322 = 2322;

const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

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

describe('config-resolution: a config-resolution 500 is infrastructure, never a type error (COR-01)', () => {
  it('re-throws a TypecheckInfrastructureError for a nonexistent tsconfig path', async () => {
    // COR-01 / D-01..D-03: a nonexistent tsconfig path makes
    // `readConfiguration`'s outer catch fire (ENOENT from host.lstat in
    // calcProjectFileAndBasePath) -> a code-500 (UNKNOWN_ERROR_CODE) in
    // parsed.errors with rootNames: []. The early scan classifies it as
    // infrastructure and re-throws BEFORE the zero-rootNames guard -- never a
    // folded/counted type error. A nonexistent PATH triggers ENOENT (the 500);
    // a nonexistent EXTENDS TARGET triggers 5012 (a folded diagnostic, proven by
    // the malformed-config cases above). They are distinct -- both must hold.
    const { TypecheckInfrastructureError } = await import('./run-typecheck');
    const missingTsConfig = join(
      workspaceRoot,
      'fixtures',
      'config-broken',
      'tsconfig.does-not-exist.json',
    );

    await expect(
      runTypecheck({ tsConfigPath: missingTsConfig }),
    ).rejects.toBeInstanceOf(TypecheckInfrastructureError);
  });
});

describe('config-resolution: solution-style tsconfig walks its leaves (D-03/D-03a)', () => {
  it('walks app + spec leaves and unions both planted TS2322 (rootNamesCount > 0, errorCount 2)', async () => {
    const result = await runTypecheck({ tsConfigPath: solutionStyleTsConfig });

    // Phase 13 (L-3 / L-1): references + >=1 in-project leaf -> WALK, not the old
    // zero-rootNames short-circuit. The union reports BOTH leaves' planted TS2322
    // (app leaf + spec leaf), each in its OWN file so nothing collapses under
    // ts.sortAndDeduplicateDiagnostics.
    expect(result.rootNamesCount).toBeGreaterThan(0);
    expect(result.errorCount).toBe(2);

    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);

    // EXACTLY two TS2322 -- one per leaf; proves both leaves ran AND nothing
    // double-counted (no second dedupe layer over the union).
    expect(codes.filter((code) => code === TS2322)).toHaveLength(2);

    // The two TS2322 live in DISTINCT files (error.component.ts vs
    // error.component.spec.ts) -- the completeness + both-leaves-ran proof. The
    // spec-file error is reachable ONLY through the spec leaf (a build never
    // compiles specs), so its presence is the named build differentiator.
    const ts2322FileNames = result.diagnostics
      .filter((diagnostic) => diagnostic.code === TS2322)
      .map((diagnostic) => diagnostic.file?.fileName ?? '');

    expect(
      ts2322FileNames.some((fileName) =>
        fileName.endsWith('error.component.ts'),
      ),
    ).toBe(true);
    expect(
      ts2322FileNames.some((fileName) =>
        fileName.endsWith('error.component.spec.ts'),
      ),
    ).toBe(true);

    // Both references are in-project and walk cleanly, so no skipped-reference
    // notice is recorded.
    expect(result.skippedReferences).toBeUndefined();
  });

  it('does NOT gate on TS18003 (the references-suppressed "No inputs were found")', async () => {
    const result = await runTypecheck({ tsConfigPath: solutionStyleTsConfig });

    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);

    // D-03a / L-2: TypeScript suppresses TS18003 when a config has `references`,
    // so the walk branch MUST NOT depend on it. The reported set is the union of
    // the leaves' real diagnostics, never a TS18003-driven signal.
    expect(codes).not.toContain(18003);
  });
});
