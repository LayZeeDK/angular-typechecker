import type ts from 'typescript';

/**
 * Pure, dependency-free project-boundary filter (SB-02/SB-04). It runs as a
 * SEPARATE pass AFTER `performCompilation` returns -- the unconditional
 * all-getter (`gatherAllDiagnostics`, D-16) is never touched -- and partitions
 * the gathered diagnostics into the in-graph set plus split suppressed counters.
 *
 * D-01/D-02: the keep decision is **compiler input-set membership**, NOT the
 * prior directory-containment proxy. `inputTs` is the union of every walked
 * leaf's DECLARED `readConfiguration().rootNames` `.ts` paths (never a Program's
 * root file set -- that adds synthetic `.ngtypecheck.ts` shims). Membership is
 * DUAL-IDENTITY: each declared rootName is stored under BOTH a `raw` form
 * (slash + case-fold, NO realpath -- never throws) AND a `full` form
 * (realpath + slash + case-fold, when realpath succeeds). A diagnostic file is
 * matched if EITHER of its forms hits EITHER stored form. This RECOVERS a
 * declared root whose realpath transiently throws (matched via `raw`) so a real
 * error on a declared file is never silently dropped (charter: a declared root is
 * never dropped; board-verified against the installed TypeScript 6.0.3 + Angular
 * 22.0.4 compiler sources).
 *
 * D-04a: membership ALONE would misclassify a clean host's OWN external `.html`
 * template, indirect-inline synthetic name, or `.ngtypecheck.ts` shim (none are
 * declared rootNames). So the keep-rule RETAINS a narrowed "under the solution/host
 * base" clause AND branch 4a (below). A base-kept non-rootName first-party
 * diagnostic is classified in-graph / kept -- never counted as suppressed.
 *
 * D-04: branch 4a resolves an external-template (`.html`) diagnostic's owning
 * component `.ts` via the diagnostic's public `ts.Diagnostic.relatedInformation`
 * and KEEPs iff that owner is in `inputTs`. An unmappable `.html` (no `.ts`
 * relatedInformation) DEFAULT-KEEPs (over-report safe; never a false pass). ZERO
 * compiler-internal (component-registry / template-type-checker) APIs are read --
 * enforced by the structural gate spec.
 *
 * D-05/D-07: the prior single silent `suppressedCount` is REPLACED by
 * `suppressedThirdParty` (node_modules; quiet; NEVER affects the verdict -- this
 * preserves isolation) plus per-category `suppressedInGraphErrorCount` /
 * `suppressedInGraphWarningCount` (Suggestion/Message are always excluded from the
 * counts) plus an advisory `suppressedInGraphFiles` (distinct canonical paths of
 * every suppressed first-party diagnostic). The Warning verdict is late-bound in
 * `evaluateResult` with the real `maxWarnings`, so `core` carries per-category
 * counts and never bakes the decision.
 *
 * D-06/COR-03: file-less diagnostics (config errors, the zero-rootNames guard) and
 * a present-but-empty `fileName` are NEVER filtered -- they have no path to
 * classify and dropping one is a false PASS. An unresolvable file (throwing
 * realpath) not matched by raw membership is likewise KEPT (fail-safe).
 *
 * D-07: `includeDeps: true` turns the boundary filter OFF -- every diagnostic is
 * kept and all four suppressed counters are 0.
 */
export interface FilterOptions {
  /** D-04a: narrowed containment baseline = the solution/host tsconfig dir. */
  basePath: string;
  /** D-07: false (default) excludes out-of-graph + node_modules; true keeps all. */
  includeDeps: boolean;
  /** D-06: from the live program host's `useCaseSensitiveFileNames()`. */
  useCaseSensitiveFileNames: boolean;
  /**
   * D-06: resolve symlinks (pnpm `.pnpm/`). Inject `ts.sys.realpath`; tests pass
   * an identity function so they never touch the filesystem.
   */
  realpath: (filePath: string) => string;
  /**
   * D-02: the DECLARED rootName `.ts` paths (raw, pre-canonical) whose union is
   * the input set. Empty is legal (guard paths omit the filter entirely).
   */
  inputTs: readonly string[];
}

export interface FilterResult {
  /** In-graph diagnostics (plus every file-less / unresolvable diagnostic, D-06). */
  kept: ts.Diagnostic[];
  /** D-05: node_modules-segment suppressions (expected; NEVER affects the verdict). */
  suppressedThirdParty: number;
  /** D-05/D-07: suppressed first-party Error diagnostics (verdict-affecting). */
  suppressedInGraphErrorCount: number;
  /** D-05/D-07: suppressed first-party Warning diagnostics (late-bound verdict). */
  suppressedInGraphWarningCount: number;
  /** D-07: distinct canonical files of the suppressed first-party diagnostics (advisory). */
  suppressedInGraphFiles: readonly string[];
}

/**
 * Partitions `diagnostics` into the in-graph set + the split suppressed counters,
 * on dual-identity input-set membership (D-02) plus the narrowed base clause
 * (D-04a) and external-template branch 4a (D-04).
 */
export function filterDiagnostics(
  diagnostics: readonly ts.Diagnostic[],
  options: FilterOptions,
): FilterResult {
  // T8 symmetry: build ONE full canonicalizer and ONE raw canonicalizer and use
  // the SAME pair for both the input set and every diagnostic file -- two
  // canonicalizers (or one applied to only one side) would break symlink/junction
  // membership (Pitfall 2).
  const canonicalizeFull = createCanonicalizer(options);
  const canonicalizeRaw = createRawCanonicalizer(options);
  const canonicalBase = canonicalizeFull(options.basePath);

  // Dual-identity input set: each declared rootName contributes its raw form
  // (always) AND its full canonical form (when realpath succeeds).
  const inputSet = new Set<string>();

  for (const rootName of options.inputTs) {
    inputSet.add(canonicalizeRaw(rootName));

    const full = canonicalizeFull(rootName);

    if (full !== undefined) {
      inputSet.add(full);
    }
  }

  const keepOptions = {
    canonicalizeRaw,
    canonicalizeFull,
    canonicalBase,
    includeDeps: options.includeDeps,
  };

  const kept: ts.Diagnostic[] = [];
  let suppressedThirdParty = 0;
  let suppressedInGraphErrorCount = 0;
  let suppressedInGraphWarningCount = 0;
  const suppressedInGraphFiles = new Set<string>();

  for (const diagnostic of diagnostics) {
    if (keep(diagnostic, inputSet, keepOptions)) {
      kept.push(diagnostic);

      continue;
    }

    // Suppressed. A suppressed diagnostic always has a resolved, non-empty file
    // (keep()'s fail-safe branches keep every file-less/unresolvable case), so
    // `canonicalFile` is defined here. Bucket node_modules (quiet third-party) vs
    // first-party in-graph (verdict-affecting) using the memoized full form -- no
    // second realpath syscall (createCanonicalizer memoizes).
    const file = diagnostic.file;
    const canonicalFile =
      file === undefined ? undefined : canonicalizeFull(file.fileName);

    if (canonicalFile !== undefined && isNodeModulesPath(canonicalFile)) {
      suppressedThirdParty++;

      continue;
    }

    // Per-category split (D-05): Suggestion (2) / Message (3) are ALWAYS excluded
    // from the counts (provably cannot fail any gate); only Error/Warning count.
    // The Warning decision is late-bound in `evaluateResult`, so core just counts.
    if (diagnostic.category === 1 /* ts.DiagnosticCategory.Error */) {
      suppressedInGraphErrorCount++;
    } else if (diagnostic.category === 0 /* ts.DiagnosticCategory.Warning */) {
      suppressedInGraphWarningCount++;
    }

    if (canonicalFile !== undefined) {
      suppressedInGraphFiles.add(canonicalFile);
    }
  }

  return {
    kept,
    suppressedThirdParty,
    suppressedInGraphErrorCount,
    suppressedInGraphWarningCount,
    suppressedInGraphFiles: [...suppressedInGraphFiles],
  };
}

/**
 * Pure boundary decision. Reads ONLY public `ts.Diagnostic` fields (zero
 * compiler-internal APIs). Branches are evaluated in the ORDER below; dual-identity membership
 * is checked BEFORE node_modules so a declared root is never dropped (D-02 charter;
 * equivalent to the research b-before-c order for real inputs since a rootName is
 * never under node_modules).
 *
 * @param inputSet dual-identity set containing BOTH raw and full canonical rootNames.
 */
export function keep(
  diagnostic: ts.Diagnostic,
  inputSet: ReadonlySet<string>,
  options: {
    /** slash + case-fold, NO realpath, never undefined. */
    canonicalizeRaw: (filePath: string) => string;
    /** realpath + slash + case-fold; undefined when realpath threw. */
    canonicalizeFull: (filePath: string) => string | undefined;
    /** full-canonical solution/host base; undefined when its realpath threw. */
    canonicalBase: string | undefined;
    includeDeps: boolean;
  },
): boolean {
  // D-07 fold-back: the boundary filter is OFF -- keep everything.
  if (options.includeDeps) {
    return true;
  }

  // (a) file-less OR present-but-empty fileName -> KEEP (fail-safe, D-06/COR-03).
  if (diagnostic.file === undefined || diagnostic.file.fileName === '') {
    return true;
  }

  const fileName = diagnostic.file.fileName;
  const rawForm = options.canonicalizeRaw(fileName);
  const fullForm = options.canonicalizeFull(fileName);

  // DUAL-IDENTITY membership FIRST (D-02): a declared root is never dropped. A
  // rootName whose realpath transiently throws is still matched via its raw form.
  if (isMember(inputSet, rawForm, fullForm)) {
    return true;
  }

  // (a') realpath threw AND not matched by raw membership -> KEEP (RES-03 fail-safe:
  // a throw cannot PROVE the file is out-of-graph).
  if (fullForm === undefined) {
    return true;
  }

  // (b) node_modules SEGMENT -> SUPPRESS (dependency noise isolation).
  if (isNodeModulesPath(fullForm)) {
    return false;
  }

  // (c) under the narrowed solution/host base -> KEEP (D-04a: the host's OWN inline
  // templates, external `.html`, indirect-inline synthetic names, `.ngtypecheck.ts`
  // shims -- none are declared rootNames but all are first-party).
  if (isUnderDir(fullForm, options.canonicalBase)) {
    return true;
  }

  // Reached: resolved, non-node_modules, NOT a declared root, NOT under base.
  // A `.ts`/`.tsx` here is a transitively-imported DEPENDENCY source -> SUPPRESS
  // (isolation). Order this BEFORE branch 4a: a dependency `.ts` has no template
  // `relatedInformation`, so a blanket else-> 4a would default-KEEP it and break
  // isolation.
  if (fullForm.endsWith('.ts') || fullForm.endsWith('.tsx')) {
    return false;
  }

  // (d)/4a: a non-`.ts` external-template resource (e.g. `.html`). Resolve the
  // owning component `.ts` via public `relatedInformation`; KEEP iff that owner is
  // in the input set, else SUPPRESS (a dependency's external template -> isolation).
  const owner = owningComponentTs(diagnostic);

  if (owner === undefined) {
    // Unmappable (no `.ts` relatedInformation) -> default-KEEP (over-report safe).
    return true;
  }

  return isMember(
    inputSet,
    options.canonicalizeRaw(owner),
    options.canonicalizeFull(owner),
  );
}

/** Dual-identity membership: either the raw or (when defined) full form hits the set. */
function isMember(
  inputSet: ReadonlySet<string>,
  rawForm: string,
  fullForm: string | undefined,
): boolean {
  return (
    inputSet.has(rawForm) || (fullForm !== undefined && inputSet.has(fullForm))
  );
}

/**
 * Branch 4a (D-04): scan the diagnostic's public `relatedInformation` and return
 * the first related file whose name ends in `.ts`/`.tsx` -- the owning component
 * source. Match by EXTENSION only; never the English message text (locale-fragile).
 */
function owningComponentTs(diagnostic: ts.Diagnostic): string | undefined {
  const related = diagnostic.relatedInformation ?? [];

  for (const info of related) {
    const name = info.file?.fileName;

    if (name !== undefined && (name.endsWith('.ts') || name.endsWith('.tsx'))) {
      return name;
    }
  }

  return undefined;
}

/**
 * Builds a canonicalizer: realpath FIRST (resolves pnpm `.pnpm/` symlinks to the
 * real location), normalize `\\` to `/`, THEN case-fold only on a
 * case-insensitive filesystem (D-06/Pitfall 3). Results are memoized per input
 * path so a hot run over thousands of components does not re-resolve the same
 * directory repeatedly (a cache, not a `realpath()` syscall per diagnostic).
 */
export function createCanonicalizer(
  options: Pick<FilterOptions, 'useCaseSensitiveFileNames' | 'realpath'>,
): (filePath: string) => string | undefined {
  const cache = new Map<string, string>();

  return (filePath: string): string | undefined => {
    const cached = cache.get(filePath);

    if (cached !== undefined) {
      return cached;
    }

    let resolved: string;

    try {
      resolved = options.realpath(filePath);
    } catch {
      // D-08 (RES-03): a throwing realpath (EACCES / permission-denied junction /
      // broken symlink) must NOT abort the whole type-check pass AND must NOT cause
      // a false PASS. A throw cannot PROVE the file is out-of-graph, so signal
      // `undefined` and let the caller KEEP the diagnostic (dual-identity raw-form
      // recovery + fail-safe bias for a correctness tool). Do NOT cache `undefined`
      // -- a transient EACCES could resolve on a later call. Silent -- core is PURE.
      return undefined;
    }

    const real = resolved.replace(/\\/g, '/');
    const canonical = options.useCaseSensitiveFileNames
      ? real
      : real.toLowerCase();

    cache.set(filePath, canonical);

    return canonical;
  };
}

/**
 * Builds a RAW canonicalizer: normalize `\\` to `/`, THEN case-fold only on a
 * case-insensitive filesystem -- with NO realpath resolution. It NEVER throws and
 * NEVER returns undefined (D-02): it is how a declared rootName is matched via its
 * pre-realpath identity, so a transient realpath throw on that root still keeps its
 * diagnostics. Same case-fold policy and memoization as `createCanonicalizer`.
 */
function createRawCanonicalizer(
  options: Pick<FilterOptions, 'useCaseSensitiveFileNames'>,
): (filePath: string) => string {
  const cache = new Map<string, string>();

  return (filePath: string): string => {
    const cached = cache.get(filePath);

    if (cached !== undefined) {
      return cached;
    }

    const slashed = filePath.replace(/\\/g, '/');
    const canonical = options.useCaseSensitiveFileNames
      ? slashed
      : slashed.toLowerCase();

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
 * A `undefined` dir means the basePath realpath threw (RES-03): we cannot classify,
 * so treat the file as in-graph (over-keep-safe) -- a non-node_modules file is
 * then KEPT rather than silently suppressed against an unprovable baseline.
 */
export function isUnderDir(
  canonicalFile: string,
  canonicalDir: string | undefined,
): boolean {
  if (canonicalDir === undefined) {
    return true;
  }

  if (canonicalFile === canonicalDir) {
    return true;
  }

  const dirWithSeparator = canonicalDir.endsWith('/')
    ? canonicalDir
    : canonicalDir + '/';

  return canonicalFile.startsWith(dirWithSeparator);
}
