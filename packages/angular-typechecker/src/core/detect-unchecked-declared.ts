import { dirname } from 'node:path';

import type ts from 'typescript';

import type { ParsedConfiguration } from './compiler-cli-types';

/**
 * D-01 (Phase 18, T11): PURE detection of declared-but-uncheckable files -- files
 * a consumer's tsconfig DECLARES that the Angular whole-program type-check cannot
 * cover. `.mdx` is NEVER type-checked; a `.tsx` is only checked when the resolved
 * `compilerOptions.jsx` is set (unset / `None` leaves it uncheckable). This mirrors
 * the shipped `detectTemplateCheckAborted` / `skippedReferences` pure-detector
 * shape: a `readonly`-returning function set on `CoreResult`, rendered by the Nx
 * executor adapter (the ONLY tier that logs). Core is PURE -- no logging or Node
 * runtime globals; `ts.sys` + `ts.parseJsonConfigFileContent` are permitted here
 * (walk-references.ts already reads via `ts.sys`).
 */

/**
 * Filters the DECLARED `.tsx` rootNames that the type-check cannot cover because
 * the resolved `jsx` option is unset or `None`. `.tsx` is always a TS-supported
 * extension, so a declared `.tsx` already appears in `parsed.rootNames` -- no
 * second parse needed. `ts.JsxEmit.None === 0`, so "jsx unset / none" is
 * `jsx === undefined || jsx === 0`; any other `JsxEmit` (e.g. `ReactJSX === 4`)
 * means the `.tsx` IS checked, so nothing is reported. Exported for the pure unit
 * tier (synthetic `rootNames` + `jsx` -- no compiler).
 */
export function detectTsxWithoutJsx(
  rootNames: readonly string[],
  jsx: ts.JsxEmit | undefined,
): readonly string[] {
  const jsxUnset = jsx === undefined || jsx === 0; // ts.JsxEmit.None

  if (!jsxUnset) {
    return [];
  }

  return rootNames.filter((name) => name.endsWith('.tsx'));
}

/**
 * Returns the union of a surviving leaf's declared-but-uncheckable files: the
 * `.tsx`-without-`jsx` set (from `parsed.rootNames`) plus the declared `.mdx` set.
 *
 * `.mdx` is NEVER a TS-supported extension, so it never appears in
 * `parsed.rootNames`. To enumerate the declared `.mdx` files with the EXACT
 * `include` / `exclude` / `files` semantics (never a hand-rolled glob, which would
 * drift from TypeScript's wildcard logic), re-parse the leaf tsconfig via
 * `ts.readConfigFile` + `ts.parseJsonConfigFileContent` with an extra `.mdx` file
 * extension, then filter `fileNames` for `.mdx`. The enumeration is include-driven:
 * a `.storybook/tsconfig.json` whose `include` is `.ts`-only reports zero `.mdx`,
 * which is correct (nothing declared, nothing to warn about). Pure: `ts.sys` is the
 * same host the walk already uses; no logging or Node runtime globals.
 */
export function detectUncheckedDeclaredFiles(
  ts: typeof import('typescript'),
  parsed: ParsedConfiguration,
  leafTsConfigPath: string,
): readonly string[] {
  const tsxWithoutJsx = detectTsxWithoutJsx(
    parsed.rootNames,
    parsed.options.jsx,
  );

  // IN-02: a failed / unparseable config read yields `config === undefined`. Do
  // NOT fall back to `{}` -- `parseJsonConfigFileContent({}, ...)` defaults
  // `include` to `["**/*"]` and would enumerate the ENTIRE leaf directory tree for
  // `.mdx`, a silent whole-tree over-enumeration. With no reliable include set,
  // report only the `.tsx` set. (Latent today: the caller reaches here only after
  // `ng.readConfiguration` on the same path already parsed it, but this guard keeps
  // a future precondition-loosening refactor from regressing into a whole-tree scan.)
  const readResult = ts.readConfigFile(leafTsConfigPath, ts.sys.readFile);

  if (readResult.config === undefined) {
    return tsxWithoutJsx;
  }

  const declaredMdx = ts
    .parseJsonConfigFileContent(
      readResult.config,
      ts.sys,
      dirname(leafTsConfigPath),
      /* existingOptions */ undefined,
      leafTsConfigPath,
      /* resolutionStack */ undefined,
      [
        {
          extension: 'mdx',
          isMixedContent: false,
          // `ScriptKind.Deferred` -- NOT `Unknown`. Only a non-`Unknown`,
          // non-mixed-content extra extension is added to the supported-extension
          // set `parseJsonConfigFileContent`'s wildcard reader uses, so `.mdx`
          // surfaces in `fileNames` for BOTH an extensionless (`**/*`) and an
          // explicit (`**/*.mdx`) include glob. With `Unknown` the enumeration
          // silently returns zero `.mdx` (verified against typescript@6.0.3);
          // `Deferred` is the canonical value for a plugin-handled extension
          // (the same value tsserver uses for `.vue` etc.).
          scriptKind: ts.ScriptKind.Deferred,
        },
      ],
    )
    .fileNames.filter((name) => name.endsWith('.mdx'));

  return [...tsxWithoutJsx, ...declaredMdx];
}
