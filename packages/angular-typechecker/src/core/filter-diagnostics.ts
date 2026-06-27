import type ts from 'typescript';

/**
 * Pure, dependency-free project-boundary filter (D-05/D-06/D-07). It runs as a
 * SEPARATE pass AFTER `performCompilation` returns -- the unconditional
 * all-getter (`gatherAllDiagnostics`, D-16) is never touched -- and partitions
 * the gathered diagnostics into the in-project set plus a count of suppressed
 * out-of-project + `node_modules` diagnostics.
 *
 * D-05: the in-project baseline is the leaf tsconfig's `basePath` (the directory
 * `ng.readConfiguration` injects), NOT `rootDir` -- in this `--preset=apps`
 * workspace `rootDir` resolves to the workspace root, which would mark every file
 * in-project and defeat the filter.
 *
 * D-06: classification is on the absolute, realpath-normalized `fileName` via a
 * canonicalizer that (1) resolves symlinks with the injected `realpath`
 * (pnpm `.pnpm/` safe), (2) normalizes `\\` to `/`, then (3) lower-cases ONLY
 * when the host filesystem is case-insensitive (realpath FIRST, then case-fold).
 * `node_modules` is excluded by a path-SEGMENT test (`split('/').includes`) so a
 * sibling directory like `node_modules-tools` is NOT misclassified, and
 * containment uses a segment-bounded prefix (`dir + '/'`) so `/foo/bar-other`
 * is NOT treated as under `/foo/bar`. This replaces the prior-art naive filter
 * (`toLowerCase()` + bare `startsWith` + `includes('node_modules')`) that breaks
 * on pnpm symlinks, case-sensitive Linux CI, and the `node_modules-tools` case.
 *
 * D-03: file-less diagnostics (config errors from `parsed.errors`, the
 * zero-rootNames guard) are NEVER filtered -- they have no path to classify and
 * dropping one would produce a false PASS.
 *
 * D-07: `includeDeps: true` turns the boundary filter OFF -- every diagnostic is
 * kept and `suppressedCount` resets to 0. It is orthogonal to the consumer's
 * `skipLibCheck` (which governs whether `node_modules` `.d.ts` diagnostics are
 * even produced).
 */
export interface FilterOptions {
  /** D-05: canonical-realpath baseline = the leaf tsconfig's `basePath`. */
  basePath: string;
  /** D-07: false (default) excludes out-of-project + node_modules; true keeps all. */
  includeDeps: boolean;
  /** D-06: from the live program host's `useCaseSensitiveFileNames()`. */
  useCaseSensitiveFileNames: boolean;
  /**
   * D-06: resolve symlinks (pnpm `.pnpm/`). Inject `ts.sys.realpath`; tests pass
   * an identity function so they never touch the filesystem.
   */
  realpath: (filePath: string) => string;
}

export interface FilterResult {
  /** In-project diagnostics (plus every file-less diagnostic, D-03). */
  kept: ts.Diagnostic[];
  /** Count of excluded out-of-project + node_modules diagnostics (D-02). */
  suppressedCount: number;
}

/**
 * Partitions `diagnostics` into the in-project set + a suppressed count, on the
 * absolute realpath-normalized `fileName` against `options.basePath`.
 */
export function filterDiagnostics(
  diagnostics: readonly ts.Diagnostic[],
  options: FilterOptions,
): FilterResult {
  if (options.includeDeps) {
    return { kept: [...diagnostics], suppressedCount: 0 };
  }

  const canonicalize = createCanonicalizer(options);
  const canonicalBase = canonicalize(options.basePath);

  const kept: ts.Diagnostic[] = [];
  let suppressedCount = 0;

  for (const diagnostic of diagnostics) {
    // D-03: NEVER filter a file-less diagnostic (config error / zero-rootNames
    // guard) -- it has no path to classify and dropping it is a false PASS.
    if (diagnostic.file === undefined) {
      kept.push(diagnostic);

      continue;
    }

    const canonicalFile = canonicalize(diagnostic.file.fileName);

    if (
      isNodeModulesPath(canonicalFile) ||
      !isUnderDir(canonicalFile, canonicalBase)
    ) {
      suppressedCount++;

      continue;
    }

    kept.push(diagnostic);
  }

  return { kept, suppressedCount };
}

/**
 * Builds a canonicalizer: realpath FIRST (resolves pnpm `.pnpm/` symlinks to the
 * real location), normalize `\\` to `/`, THEN case-fold only on a
 * case-insensitive filesystem (D-06/Pitfall 3). Results are memoized per input
 * path so a hot run over thousands of components does not re-resolve the same
 * directory repeatedly (a cache, not a `realpath()` syscall per diagnostic).
 */
function createCanonicalizer(
  options: Pick<FilterOptions, 'useCaseSensitiveFileNames' | 'realpath'>,
): (filePath: string) => string {
  const cache = new Map<string, string>();

  return (filePath: string): string => {
    const cached = cache.get(filePath);

    if (cached !== undefined) {
      return cached;
    }

    const real = options.realpath(filePath).replace(/\\/g, '/');
    const canonical = options.useCaseSensitiveFileNames
      ? real
      : real.toLowerCase();

    cache.set(filePath, canonical);

    return canonical;
  };
}

/**
 * SEGMENT test (D-06): `node_modules-tools/x.ts` must NOT match. Splitting on
 * `/` and checking for an exact `node_modules` segment avoids the substring
 * false-positive of `includes('node_modules')`.
 */
function isNodeModulesPath(canonicalFile: string): boolean {
  return canonicalFile.split('/').includes('node_modules');
}

/**
 * Segment-bounded containment (D-06): equal, or under `dir + '/'`. A bare
 * `startsWith(dir)` would wrongly accept `/foo/bar-other` as under `/foo/bar`.
 */
function isUnderDir(canonicalFile: string, canonicalDir: string): boolean {
  if (canonicalFile === canonicalDir) {
    return true;
  }

  const dirWithSeparator = canonicalDir.endsWith('/')
    ? canonicalDir
    : canonicalDir + '/';

  return canonicalFile.startsWith(dirWithSeparator);
}
