import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

import { runTypecheck } from './run-typecheck';

// SB-09 (D-06(b)) -- REAL-compiler proof that the bundler-query advisory fires on a
// genuine `?query` compile AND that it NEVER suppresses the underlying TS2307.
//
// The fixture (`fixtures/vite-query-imports/`) is a single set of story-like sources
// checked under two tsconfig legs over the SAME files:
//   - tsconfig.baseline.json  (types: [])            -> the ?query TS2307 fire and
//     are KEPT (counted errors); the advisory names them.
//   - tsconfig.vite-client.json (types: ["vite/client"]) -> vite/client's ambient
//     wildcards clear every ?query, so the advisory self-gates (field undefined) --
//     yet a plain missing module still fails TS2307 (no false pass on either leg).
//
// The pure unit tier (detect-bundler-query-imports.spec.ts) owns the exact
// dedup/sort/gating behaviour over synthetic diagnostics; this tier asserts
// non-brittle PRESENCE (never exact counts against source content). Cold-compiler
// timeout is inherited from vitest.config.mts (testTimeout 30000); do NOT add a
// per-file testTimeout.

const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

function fixtureTsConfig(tsConfigFileName: string): string {
  return join(
    workspaceRoot,
    'fixtures',
    'vite-query-imports',
    tsConfigFileName,
  );
}

function isTs2307For(diagnostic: ts.Diagnostic, needle: string): boolean {
  if (diagnostic.code !== 2307) {
    return false;
  }

  return ts
    .flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    .includes(needle);
}

const QUERY_SPECIFIERS = [
  './snippet.md?raw',
  './icon.svg?url',
  './worklet?worker',
  './extra?inline',
];

describe('bundler-query advisory: baseline leg fires + keeps the TS2307 (SB-09 D-06(b))', () => {
  it('flags the ?query specifiers, keeps them as counted errors, and does NOT flag the plain-missing control', async () => {
    const result = await runTypecheck({
      tsConfigPath: fixtureTsConfig('tsconfig.baseline.json'),
    });

    // A genuinely-checked run (the declared sources are walked, not a vacuous
    // zero-files pass).
    expect(result.rootNamesCount).toBeGreaterThan(0);

    // The advisory fires on the unresolved bundler-query imports.
    expect(result.bundlerQueryImports).toBeDefined();
    expect(result.bundlerQueryImports ?? []).not.toHaveLength(0);

    // Every flagged specifier is a bundler query (contains `?`).
    for (const specifier of result.bundlerQueryImports ?? []) {
      expect(specifier).toContain('?');
    }

    // It names the fixture's ?query specifiers.
    for (const specifier of QUERY_SPECIFIERS) {
      expect(result.bundlerQueryImports).toContain(specifier);
    }

    // NEVER suppressed: every flagged specifier corresponds to a KEPT TS2307 in the
    // reported diagnostics, and those TS2307 are COUNTED as errors. The plain-missing
    // control adds at least one MORE error beyond the flagged queries, so errorCount
    // is strictly greater than the flagged set -- proving both the queries and the
    // plain missing module remain hard errors (charter: never a silent false pass).
    for (const specifier of result.bundlerQueryImports ?? []) {
      expect(
        result.diagnostics.some((diagnostic) =>
          isTs2307For(diagnostic, specifier),
        ),
      ).toBe(true);
    }

    expect(result.errorCount).toBeGreaterThan(
      (result.bundlerQueryImports ?? []).length,
    );

    // D-06(a): the plain missing module (no `?`) is a KEPT TS2307 but is NEVER in the
    // advisory (no false positive).
    expect(
      result.diagnostics.some((diagnostic) =>
        isTs2307For(diagnostic, './does-not-exist'),
      ),
    ).toBe(true);
    expect(result.bundlerQueryImports ?? []).not.toContain('./does-not-exist');
  });
});

describe('bundler-query advisory: vite/client leg self-gates, plain missing still fails (SB-09 D-06(b))', () => {
  it('leaves bundlerQueryImports undefined yet keeps the plain-missing TS2307 (no false pass)', async () => {
    const result = await runTypecheck({
      tsConfigPath: fixtureTsConfig('tsconfig.vite-client.json'),
    });

    expect(result.rootNamesCount).toBeGreaterThan(0);

    // Self-gated: vite/client resolves every ?query, so the advisory falls silent
    // (core maps the empty set to undefined -- D-03).
    expect(result.bundlerQueryImports).toBeUndefined();

    // No false pass on either leg: the plain missing module still fails TS2307.
    expect(
      result.diagnostics.some((diagnostic) =>
        isTs2307For(diagnostic, './does-not-exist'),
      ),
    ).toBe(true);
  });
});
