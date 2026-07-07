import type ts from 'typescript';

/**
 * SB-09 D-02: PURE detection of unresolved bundler-query imports. A `?` in a
 * module specifier is a bundler (Vite/webpack) query -- TypeScript and Node
 * module specifiers NEVER contain one -- so an unresolved TS2307 whose specifier
 * contains a `?` is a Vite/Analog bundler-query import (`?raw` / `?url` /
 * `?worker` / `?inline`, virtual modules) the consumer can resolve with
 * `"types": ["vite/client"]` on the checked tsconfig (or a hand `declare module`
 * shim). This mirrors the shipped `detectUncheckedDeclaredFiles` /
 * `detectTemplateCheckAborted` pure-detector shape: a `readonly`-returning
 * function set on `CoreResult`, rendered by the Nx executor adapter (the ONLY
 * tier that logs). Core is PURE -- no `console` / `process`.
 *
 * ADVISORY only: the TS2307 stay COUNTED errors (a missing module can be a real
 * bug) -- this NEVER suppresses a diagnostic (charter: never a silent false
 * pass). Always-on + self-gating: it keys on the PRESENCE of unresolved `?query`
 * TS2307, so it returns [] (and `CoreResult` maps that to `undefined`) once the
 * consumer resolves them -- no public option needed (D-03).
 *
 * The caller (`finalize`) passes the FINAL KEPT (post-boundary-filter) diagnostic
 * set, NOT the pre-filter superset that `detectTemplateCheckAborted` scans -- so a
 * `?query` TS2307 on a node_modules / out-of-project file the boundary filter
 * dropped is never named here (the consumer cannot see or fix it via their
 * tsconfig). Returns the deduped specifiers, sorted for a deterministic order.
 */
export function detectBundlerQueryImports(
  ts: typeof import('typescript'),
  diagnostics: readonly ts.Diagnostic[],
): readonly string[] {
  const flagged = new Set<string>();

  for (const diagnostic of diagnostics) {
    // Pitfall 2: gate on `code === 2307` FIRST. typescript@6.0.3 has THREE
    // "Cannot find module '{0}'..." messages -- 2307 (plain), 2732
    // (resolveJsonModule hint), 2792 (moduleResolution hint) -- that share the
    // prefix; a message-only match would capture the 2732/2792 hints too.
    if (diagnostic.code !== 2307) {
      continue;
    }

    const message = ts.flattenDiagnosticMessageText(
      diagnostic.messageText,
      '\n',
    );
    // Security V5: `[^']+` is a linear negated character class -- no nested
    // quantifier, no catastrophic backtracking -- and messageText is
    // compiler-owned, not user input. `exec` returns null on no match.
    const match = /Cannot find module '([^']+)'/.exec(message);

    if (match !== null && match[1].includes('?')) {
      flagged.add(match[1]);
    }
  }

  return [...flagged].sort();
}
