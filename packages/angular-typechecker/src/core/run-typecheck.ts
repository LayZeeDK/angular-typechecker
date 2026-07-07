import { dirname } from 'node:path';

import type ts from 'typescript';

import type { CompilerCli, ParsedConfiguration } from './compiler-cli-types';
import { loadCompilerCli } from './compiler-loader';
import { detectBundlerQueryImports } from './detect-bundler-query-imports';
import { detectUncheckedDeclaredFiles } from './detect-unchecked-declared';
import {
  synthesizeFilelessError,
  TCB_GENERATION_FATAL_DIAGNOSTIC_CODE,
  ZERO_ROOT_NAMES_DIAGNOSTIC_CODE,
} from './diagnostic-codes';
import { filterDiagnostics } from './filter-diagnostics';
import { runNoEmitCompilation } from './gather-diagnostics';
import { loadTypescript } from './load-typescript';
import type { SkippedReference } from './walk-references';
import { walkReferences } from './walk-references';

export interface CoreOptions {
  tsConfigPath: string;
  // D-07: project-boundary filter switch. Default false excludes out-of-project
  // + node_modules diagnostics from the reported set; true folds them back in
  // (and resets all suppressed counters to 0 / empty). Orthogonal to the
  // consumer's `skipLibCheck` (which governs whether node_modules `.d.ts`
  // diagnostics are even produced).
  includeDeps?: boolean;
  // D-08: the formatter's relativization base for CI annotation paths.
  // `runTypecheck` IGNORES it -- it is consumed ONLY by `formatReport` (plan
  // 03-03), and lives here for adapter/API discoverability. Including it never
  // affects the boundary filter (which keys off the leaf tsconfig `basePath`).
  pathBase?: string;
}

// D-01: Approach A result shape. `errorCount`/`warningCount` are counted
// EXPLICITLY by `ts.DiagnosticCategory` (NEVER `length - errorCount`, the MD-02
// bug). The public `codes: number[]` field is REMOVED -- specs derive codes via
// `diagnostics.map((d) => d.code)`. Documented invariant:
// `errorCount + warningCount <= diagnostics.length` (Suggestion + Message
// categories stay inspectable in `diagnostics` but are NOT counted in the
// scalars).
export interface CoreResult {
  // D-07b: the resolved absolute tsconfig path actually checked.
  tsConfigPath: string;
  // D-03: input file count; 0 means the zero-rootNames guard fired.
  rootNamesCount: number;
  // D-02/D-06/D-09: GENUINE compiler diagnostics only (config errors prepended
  // per D-03), FILTERED to the in-project set (D-06) and SORTED + deduped
  // (D-09). `includeDeps: true` folds the out-of-project + node_modules
  // diagnostics back in.
  diagnostics: readonly ts.Diagnostic[];
  // D-01/D-02: category === Error, counted POST-filter on the sorted set.
  errorCount: number;
  // D-01/D-02: category === Warning (explicit, NOT total - errorCount),
  // counted POST-filter on the sorted set.
  warningCount: number;
  // D-05/D-07: split suppressed counters (replacing the prior single silent
  // `suppressedCount`). `suppressedThirdParty` counts node_modules suppressions
  // (quiet -- NEVER affects the verdict, preserving dependency isolation). The
  // per-category in-graph counters count SUPPRESSED first-party (non-node_modules)
  // Error/Warning diagnostics -- the milestone's core correctness signal: an
  // out-of-project first-party diagnostic the boundary used to drop SILENTLY is
  // now COUNTED as in-graph (feeding the 17-04 coverage-incomplete gate).
  // `suppressedInGraphFiles` carries their distinct canonical paths (advisory).
  // All four are 0 / [] on the zero-rootNames guard path (no Program) and
  // whenever `includeDeps` is true.
  suppressedThirdParty: number;
  suppressedInGraphErrorCount: number;
  suppressedInGraphWarningCount: number;
  suppressedInGraphFiles: readonly string[];
  durationMs: number;
  // RES-02 (reframe; 09-RES-02-DECISION.md, Option A): set when a TCB-generation
  // `FatalDiagnosticError` (IMPORT_GENERATION_FAILURE, NG3004 -- the ONLY Fatal
  // thrown from the Type-Check-Block path at v22.0.4) is present in the gathered
  // diagnostics. Detection scans the PRE-filter set in `finalize`, so a Fatal on
  // an out-of-project file is never silently dropped by the project-boundary
  // filter before the notice fires (I-1). That Fatal is thrown DURING the shared
  // `ensureAllShimsForAllFiles()`
  // priming `OptimizeFor.WholeProgram` triggers, which aborts shim generation for
  // ALL files -- so surviving files' Angular template/extended (NG8xxx)
  // diagnostics are SUPPRESSED. This is a PURE detection field (set by scanning
  // diagnostics in `finalize`, no `console`/`process`); the adapter renders the
  // loud, file-named notice (executor `logger.warn`). `undefined` when no such
  // Fatal is present -- the common case -- so consumers branch on presence.
  //
  // This is ADDITIVE signalling on the normal result path. It does NOT touch the
  // infra-vs-type policy (D-05): a non-fatal/infra throw still surfaces as
  // UNKNOWN_ERROR_CODE 500 -> TypecheckInfrastructureError; the notice is a
  // warning, NOT a reclassification of the verdict.
  templateCheckAborted?: TemplateCheckAborted;
  // D-02 (Phase 13): references skipped or reclassified during a solution-tsconfig
  // walk. Present (and NON-EMPTY) ONLY when at least one reference was skipped
  // (out-of-project / zero-root-names / self-reference) or reclassified
  // (not-found -> 90002) during the walk. `undefined` on the direct single-leaf
  // path AND on any walk where every reference walked cleanly -- core maps the
  // walk's empty array `[]` -> `undefined` so consumers branch on presence. Like
  // `templateCheckAborted`, this is PURE detection (set by the pure walk in
  // walk-references.ts, no `console`/`process`); the executor adapter renders the
  // loud, path-named `logger.warn` advisory. ADVISORY only -- recording a skip
  // NEVER changes the verdict. Additive/non-breaking (0.x semver).
  skippedReferences?: readonly SkippedReference[];
  // D-01 (Phase 18, T11): declared-but-uncheckable files -- files a consumer's
  // tsconfig DECLARES that the type-check cannot cover (`.mdx` is NEVER checked;
  // a `.tsx` is checked only when the resolved `compilerOptions.jsx` is set).
  // Present (and NON-EMPTY) only when at least one such file is declared on a
  // SURVIVING leaf (walk path) or the direct single leaf; `undefined` otherwise --
  // core maps the empty array `[]` -> `undefined` so consumers branch on presence,
  // exactly like `skippedReferences`. PURE detection (detect-unchecked-declared.ts,
  // no `console`/`process`); the executor adapter renders the loud `logger.warn`.
  // ADVISORY only -- these paths NEVER change the verdict (deliberately NOT read by
  // `evaluateResult`). Additive/non-breaking (0.x semver).
  notTypeCheckedDeclaredFiles?: readonly string[];
  // SB-09 (D-01/D-02): unresolved bundler-query imports -- the deduped, sorted
  // module specifiers of kept TS2307 diagnostics whose specifier contains a `?`
  // (a Vite/Analog bundler query: `?raw` / `?url` / `?worker` / `?inline`,
  // virtual modules). PURE diagnostic-derived detection (detect-bundler-query-
  // imports.ts, no `console`/`process`) computed over the POST-filter KEPT set in
  // `finalize`, so a boundary-filtered node_modules `?query` is never named.
  // Present (and NON-EMPTY) only when at least one such TS2307 is kept; `undefined`
  // otherwise -- core maps the empty array `[]` -> `undefined` so consumers branch
  // on presence, exactly like `notTypeCheckedDeclaredFiles`. ALWAYS-ON + self-gating
  // (D-03): it falls silent once the consumer adds `"types": ["vite/client"]` (or a
  // hand `declare module` shim), so no public option is needed. ADVISORY only -- the
  // underlying TS2307 stay COUNTED errors and drive the verdict as normal; the field
  // is deliberately NOT read by `evaluateResult` (D-05), so it NEVER flips the
  // verdict. Additive/non-breaking (0.x semver).
  bundlerQueryImports?: readonly string[];
}

/**
 * RES-02: details of a detected TCB-generation Fatal that suppressed surviving
 * files' Angular template/extended diagnostics. `code` is the NEGATIVE-encoded
 * `ts.Diagnostic.code` (`NG(3004) === -993004`); `fileName` is the offending
 * diagnostic's `file?.fileName` when the compiler attached one (it may be
 * `undefined` for a file-less synthesized Fatal).
 */
export interface TemplateCheckAborted {
  // S2: RETAINED as the detector's public shape (always `NG(3004) === -993004` at
  // v22.0.4) and pinned by the detector/drift tests (infra-failure.spec.ts,
  // run-typecheck.spec.ts), even though the current adapter consumes only
  // `fileName`. Do NOT drop it -- removing it breaks those assertions.
  code: number;
  fileName: string | undefined;
}

/**
 * Thrown when `performCompilation` reports a returned `UNKNOWN_ERROR_CODE` (500)
 * diagnostic -- an infrastructure failure (an internal crash in `createProgram`,
 * the host, or a gatherer getter that the compiler's outer catch swallowed into
 * a single Error diagnostic), NOT a genuine type error (D-06). Re-throwing keeps
 * `CoreResult.errorCount` meaning ONLY real type errors. The Phase-4 executor
 * catches this and maps it to a distinct failure message/exit.
 */
export class TypecheckInfrastructureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TypecheckInfrastructureError';
  }
}

/**
 * Re-throws a returned `UNKNOWN_ERROR_CODE` (500) as a
 * `TypecheckInfrastructureError` -- the load-bearing infra-vs-type invariant of
 * this tool, applied at THREE stages (config parse, walk union, post-compile) so
 * `errorCount` never counts a compiler crash as a type error. Detects BY CODE only
 * (never `source`/message text). The synthesized guard / not-found codes are
 * 90001/90002 (NOT 500), so they are never mistaken for infrastructure.
 */
function throwIfInfrastructureFailure(
  ng: CompilerCli,
  ts: typeof import('typescript'),
  diagnostics: readonly ts.Diagnostic[],
): void {
  const failure = diagnostics.find(
    (diagnostic) => diagnostic.code === ng.UNKNOWN_ERROR_CODE,
  );

  if (failure !== undefined) {
    throw new TypecheckInfrastructureError(
      ts.flattenDiagnosticMessageText(failure.messageText, '\n'),
    );
  }
}

/**
 * A resolved config is solution-style / references-only iff it declares at least
 * one project reference. Computed in ONE place so the walk-branch predicate and the
 * zero-rootNames guard's message branch -- which the code requires to AGREE -- can
 * never drift.
 */
function hasProjectReferences(parsed: ParsedConfiguration): boolean {
  return (
    parsed.projectReferences !== undefined &&
    parsed.projectReferences.length > 0
  );
}

/**
 * Builds the project-boundary `FinalizeFilter` shared by the walk (>=1 in-project
 * leaf) path and the direct single-leaf path. Two things differ between the two
 * callers, so both are parameters: `useCaseSensitiveFileNames` (the walk reuses
 * `ts.sys`; the direct path reads it off the live Program host) and `inputTs`
 * (the walk passes the union `walk.rootNamePaths`; the direct path passes the
 * single leaf's `parsed.rootNames`). `basePath`, `includeDeps`, and `realpath`
 * are identical.
 */
function buildFinalizeFilter(
  ts: typeof import('typescript'),
  parsed: ParsedConfiguration,
  options: CoreOptions,
  useCaseSensitiveFileNames: boolean,
  inputTs: readonly string[],
): FinalizeFilter {
  return {
    basePath: resolveFilterBasePath(
      parsed.options.basePath,
      options.tsConfigPath,
    ),
    includeDeps: options.includeDeps ?? false,
    useCaseSensitiveFileNames,
    inputTs,
    realpath: (filePath: string): string =>
      ts.sys.realpath?.(filePath) ?? filePath,
  };
}

/**
 * Runs the complete Angular whole-program type-check for a single tsconfig with
 * no emit, gathering all diagnostic phases unconditionally, and returns a
 * structured result. The config is parsed ONCE and spread into a FRESH `options`
 * object so that a second `performCompilation` call (e.g. the GATE B
 * differential) never shares the mutated `noEmit` state of the first (resolved
 * research Open Question 1). Out-of-project + node_modules diagnostics are
 * filtered out by default in `finalize` (D-06; opt-in `includeDeps`), and the
 * kept set is sorted + deduped via `ts.sortAndDeduplicateDiagnostics` (D-09).
 *
 * The core requires an ABSOLUTE `tsConfigPath` and never touches
 * `process.cwd()` (D-04); the Phase-4 executor owns path resolution.
 */
export async function runTypecheck(options: CoreOptions): Promise<CoreResult> {
  // Capture `start` at the very top so `durationMs` reflects the
  // FULL cold-run wall-clock -- including the ESM module load of
  // @angular/compiler-cli + typescript and the config parse, which are the
  // dominant cold-start cost -- on BOTH the normal and the zero-rootNames-guard
  // return paths (the guard path otherwise reported a near-zero, misleading
  // value). The loader memoizes after the first call, so a warm call still
  // measures the residual load + parse + compile window honestly.
  const start = performance.now();

  // D-06: a throw from loadCompilerCli (ESM load of @angular/compiler-cli)
  // propagates as a true environment/install error, never a type result.
  const ng = await loadCompilerCli();
  const ts = await loadTypescript();

  // RES-04 / D-09: pass `suppressOutputPathCheck: true` as the `existingOptions`
  // second arg, matching `@angular/build`'s `loadConfiguration`
  // (`angular-compilation.ts:51` @ v22.0.4) EXACTLY. The output-path overwrite
  // check fires in TypeScript's `verifyCompilerOptions()` at the END of
  // `createProgram`, gated by `!options.noEmit && !options.suppressOutputPathCheck`
  // (verifyCompilerOptions, TS 6.0.3) -- NOT in `readConfiguration` (Pitfall 3, RESOLVED).
  // The engine's emit-neutralizing override below already sets `noEmit: true`,
  // which ALONE suppresses the check; this is belt-and-suspenders parity with the
  // build so an output-path config nuisance (TS5055 / overwrite-class) never
  // surfaces as a type error in the type-only verdict. `ts.CompilerOptions`
  // carries an index signature, so the extra key type-checks (no shim change).
  const parsed = ng.readConfiguration(options.tsConfigPath, {
    suppressOutputPathCheck: true,
  });

  // COR-01 / D-01..D-03: a config-resolution CRASH surfaces here as a code-500
  // (UNKNOWN_ERROR_CODE) in `parsed.errors` -- the `readConfiguration` outer
  // catch wraps a real throw (a nonexistent tsconfig path's ENOENT, a circular
  // `extends` RangeError) into a single synthesized Error diagnostic. Detect it
  // by CODE only (D-02; never `source`/message text -- the same predicate as the
  // post-`performCompilation` scan below) and re-throw as infrastructure.
  //
  // This scan MUST precede the zero-rootNames guard: the 500 case returns
  // `rootNames: []`, so a late scan would be unreachable -- the guard returns
  // first and the 500 would be folded into `configDiagnostics` and mis-counted
  // as a type error (a crash masquerading as a clean/typed verdict). Both 500
  // scans coexist (D-02 defense-in-depth at two distinct stages). Only code 500
  // is infrastructure: every OTHER `parsed.errors` entry (e.g. a 5012 missing
  // `extends` target) stays folded into `configDiagnostics` below (D-03).
  throwIfInfrastructureFailure(ng, ts, parsed.errors);

  // D-03 part 1 (fixes MD-01): NEVER drop `parsed.errors`. A malformed,
  // unreadable, or nonexistent tsconfig surfaces here and is prepended to the
  // final diagnostics so it is counted -- never a silent "clean".
  const configDiagnostics = [...parsed.errors];

  // D-03 part 2 / D-03a (Phase 13 three-way split; L-3 / Spike 004): gate on
  // `rootNames.length === 0` (NEVER TS18003, which TypeScript suppresses when a
  // config has a `references` array). A solution-style / references-only or empty
  // config skips the direct `performCompilation` and splits three ways:
  //   1. references present + >=1 in-project leaf -> WALK the leaves and feed the
  //      raw union into the SAME single `finalize` as the direct path.
  //   2. references present + 0 in-project leaves (all skipped/reclassified) ->
  //      finalize the walk's counted union (the not-found 90002s) when non-empty,
  //      else synthesize the none-in-project 90001 guard; attach skippedReferences.
  //   3. no references (empty project) -> synthesize the empty-project 90001 guard
  //      (UNCHANGED).
  // Every path returns at least one synthesized/counted Error or a walked union so
  // agents/CI get a deterministic non-zero signal instead of a false PASS.
  if (parsed.rootNames.length === 0) {
    // `hasProjectReferences` is the SAME predicate `synthesizeZeroRootNamesDiagnostic`
    // uses (below), so the branch classification and the guard message agree.
    if (hasProjectReferences(parsed)) {
      return handleSolutionWalk(
        ng,
        ts,
        parsed,
        options,
        configDiagnostics,
        start,
      );
    }

    // No references (empty project): UNCHANGED. No Program on this path: nothing
    // to filter (the single guard diagnostic is file-less and would never be
    // filtered anyway), so all suppressed counters are 0 / empty and `finalize`
    // runs with `filter` omitted.
    const guard = synthesizeZeroRootNamesDiagnostic(ts, parsed);

    return finalize(
      ts,
      options.tsConfigPath,
      0,
      [...configDiagnostics, guard],
      start,
    );
  }

  // D-05 + D-02: run the no-emit whole-program compilation via the shared
  // runNoEmitCompilation (gather-diagnostics.ts) -- the single source of truth for
  // the ENTIRE invocation (a FRESH per-call options object spreading
  // `...parsed.options` then EMIT_NEUTRALIZING_OPTIONS, `emitFlags: 0`, and the
  // unconditional all-getter), spread IDENTICALLY here and in the solution-tsconfig
  // walk (walk-references.ts) so the direct-leaf and walk paths can never diverge.
  // D-05b: every semantics-defining option (module, moduleResolution, target, lib,
  // paths, strictTemplates, extended*) stays untouched via the `...parsed.options`
  // spread inside the helper.
  const result = runNoEmitCompilation(ng, parsed);

  // D-06 / V-3 / L-3: detect a returned UNKNOWN_ERROR_CODE (500) by CODE only --
  // never by `source === 'angular'` (the synthesized diagnostic sets no source).
  // Re-throw so the infra failure is never counted as a type error.
  throwIfInfrastructureFailure(ng, ts, result.diagnostics);

  // #3 DEFENSE-IN-DEPTH: the real PerformCompilationResult.program is OPTIONAL
  // (the optional `program?` field of `PerformCompilationResult`); the vendored
  // shim narrows it to non-optional (compiler-cli-types.ts) to match the engine's
  // guarded usage below. A `{ program: undefined }` return WITHOUT an
  // UNKNOWN_ERROR_CODE (500) diagnostic is type-permitted but NOT observed in
  // @angular/compiler-cli@22.0.4 source -- this guard converts that hypothetical
  // bare TypeError (from the `result.program.getTsProgram()` access in the
  // `finalize` CALL ARGS below (within `runTypecheck`)) into the SAME
  // infra-class failure as the rest of the path. It is DISJOINT from the
  // post-compilation 500 scan above (which handles UNKNOWN_ERROR_CODE), so there
  // is no double-handling. This is a RUNTIME defense, not a type change -- the
  // shim `program` stays non-optional, so TS treats the access as always-defined.
  if (result.program === undefined) {
    throw new TypecheckInfrastructureError(
      'angular-typechecker: the Angular compiler returned no Program ' +
        '(performCompilation produced neither a Program nor an ' +
        'UNKNOWN_ERROR_CODE diagnostic). This is an infrastructure failure, ' +
        'not a type error.',
    );
  }

  // D-06: classify against the leaf tsconfig's `basePath` (the directory
  // `readConfiguration` injects), NEVER `parsed.options.rootDir` -- in this
  // `--preset=apps` workspace `rootDir` is the workspace root, which would mark
  // every file in-project and defeat the filter. The live program host supplies
  // `useCaseSensitiveFileNames()` so the case-fold mirrors how diagnostics were
  // produced (RESEARCH D-05/D-06).
  const directResult = finalize(
    ts,
    options.tsConfigPath,
    parsed.rootNames.length,
    [...configDiagnostics, ...result.diagnostics],
    start,
    buildFinalizeFilter(
      ts,
      parsed,
      options,
      result.program.getTsProgram().useCaseSensitiveFileNames(),
      parsed.rootNames,
    ),
  );

  // D-01 (Phase 18, T11): the direct single-leaf path computes its declared-but-
  // uncheckable files from its OWN `parsed` + leaf tsconfig path, attached via the
  // SAME `[]` -> `undefined` conditional-spread idiom as the walk path above.
  const notTypeCheckedDeclaredFiles = detectUncheckedDeclaredFiles(
    ts,
    parsed,
    options.tsConfigPath,
  );

  return {
    ...directResult,
    ...(notTypeCheckedDeclaredFiles.length > 0
      ? { notTypeCheckedDeclaredFiles }
      : {}),
  };
}

/**
 * D-03a (Phase 13): the references-present arm of the zero-rootNames branch,
 * extracted VERBATIM from `runTypecheck` so the entry function stays under the
 * cognitive-complexity budget. PURE core (no `console`/`process`); uses only the
 * module-scoped helpers `walkReferences`, `throwIfInfrastructureFailure`,
 * `finalize`, and `buildFinalizeFilter`. A solution-style / references-only
 * config splits two ways: >=1 in-project leaf walked (finalize the raw union) vs
 * 0 in-project leaves (finalize the counted not-found 90002s, else synthesize the
 * none-in-project 90001 guard). Both paths attach `skippedReferences` via the same
 * `[]` -> `undefined` conditional-spread idiom.
 */
async function handleSolutionWalk(
  ng: CompilerCli,
  ts: typeof import('typescript'),
  parsed: ParsedConfiguration,
  options: CoreOptions,
  configDiagnostics: readonly ts.Diagnostic[],
  start: number,
): Promise<CoreResult> {
  const walk = await walkReferences(ng, ts, parsed, options.tsConfigPath);

  // D-06 parity (I-2 / S-7): a per-leaf UNKNOWN_ERROR_CODE (500) in the walk
  // union -- whether returned by a surviving leaf's performCompilation OR
  // raised by an EXISTING leaf's config resolution (walk-references.ts) -- is
  // an INFRASTRUCTURE failure, never a type error. Re-throw it here exactly as
  // the direct single-leaf path does (the walk stays pure and free of the
  // run-typecheck import cycle), so `errorCount` never counts a compiler crash
  // and the leaf-vs-solution entry points stay consistent. The synthesized
  // not-found code is 90002 (NOT 500), so a genuine missing reference is not
  // caught here -- it stays a counted 90002 and the run resolves.
  throwIfInfrastructureFailure(ng, ts, walk.rawDiagnostics);

  // Core maps the walk's empty array `[]` -> `undefined` on CoreResult so the
  // adapter's presence check is sufficient; mirror the templateCheckAborted
  // conditional-spread idiom in `finalize`.
  const skipped =
    walk.skippedReferences.length > 0
      ? { skippedReferences: walk.skippedReferences }
      : {};

  if (walk.rootNamesCount > 0) {
    // >=1 in-project leaf walked: feed the RAW union into the SAME single
    // `finalize` as the direct path (L-1). `includeDeps` applies ONCE here
    // (Directive 5); `basePath` = the SOLUTION tsconfig's directory; the
    // union is the pre-filter `diagnostics` arg so `detectTemplateCheckAborted`
    // scans EVERY leaf's diagnostics (Directive 6). No per-leaf Program is
    // available here (the walk owns and discards each leaf's Program), so the
    // case-fold host reuses `ts.sys` -- the same filesystem host every leaf
    // Program used -- matching the direct path's `realpath` fallback.
    const result = finalize(
      ts,
      options.tsConfigPath,
      walk.rootNamesCount,
      [...configDiagnostics, ...walk.rawDiagnostics],
      start,
      buildFinalizeFilter(
        ts,
        parsed,
        options,
        ts.sys.useCaseSensitiveFileNames,
        walk.rootNamePaths,
      ),
    );

    // D-01 (Phase 18, T11): attach the walk's aggregated declared-but-
    // uncheckable files via the SAME `[]` -> `undefined` conditional-spread
    // idiom as `skipped`. Sourced from the walk's surviving-leaf aggregation
    // (Pitfall 7), so only surviving leaves contribute.
    const notTypeChecked =
      walk.notTypeCheckedDeclaredFiles.length > 0
        ? {
            notTypeCheckedDeclaredFiles: walk.notTypeCheckedDeclaredFiles,
          }
        : {};

    return { ...result, ...skipped, ...notTypeChecked };
  }

  // References present but 0 in-project leaves (every reference skipped /
  // reclassified). If the walk produced counted diagnostics -- the actionable
  // 90002 "referenced tsconfig not found" Errors, one per not-found leaf --
  // finalize the UNION so those SPECIFIC, path-named diagnostics are reported
  // (I-1). Collapsing N broken references into one generic 90001, whose message
  // ("references are not consulted ... point the tsConfig at a leaf that lists
  // files") is simply WRONG for the all-not-found case, would misdescribe the
  // cause. Only when the union is EMPTY -- every reference was boundary-skipped
  // / zero-root-names / self-reference / duplicate, so nothing was counted --
  // do we synthesize the none-in-project 90001 guard, keeping the verdict a
  // deterministic non-zero signal. Every diagnostic here is file-less (no
  // surviving leaf ran, and the infra-500 case already re-threw above), so no
  // boundary filter is needed.
  const guardDiagnostics =
    walk.rawDiagnostics.length > 0
      ? walk.rawDiagnostics
      : [synthesizeZeroRootNamesDiagnostic(ts, parsed)];
  const result = finalize(
    ts,
    options.tsConfigPath,
    0,
    [...configDiagnostics, ...guardDiagnostics],
    start,
  );

  return { ...result, ...skipped };
}

/**
 * WR-01: resolves the project-boundary filter's `basePath`. `readConfiguration`
 * injects an absolute `basePath` in practice, but on the defensive path where it
 * is missing (undefined OR empty string -- `??` alone would not catch `''`) we
 * MUST fall back to the leaf tsconfig's directory, NEVER `''`. An empty base
 * makes `isUnderDir` treat `'' + '/'` as `/`, which matches EVERY absolute path
 * on POSIX and silently DISABLES the boundary filter -- the exact failure the
 * filter module guards against. `tsConfigPath` is required absolute (see
 * `runTypecheck`), so `dirname` always yields an absolute, non-empty base.
 */
export function resolveFilterBasePath(
  parsedBasePath: string | undefined,
  tsConfigPath: string,
): string {
  if (parsedBasePath !== undefined && parsedBasePath !== '') {
    return parsedBasePath;
  }

  return dirname(tsConfigPath);
}

/**
 * Builds the single D-03 zero-rootNames Error diagnostic. The message names the
 * leaf tsconfigs literally and branches on `parsed.projectReferences?.length`
 * (solution-style / references-only vs empty project) so an agent gets an
 * actionable next step.
 */
function synthesizeZeroRootNamesDiagnostic(
  ts: typeof import('typescript'),
  parsed: ParsedConfiguration,
): ts.Diagnostic {
  const messageText = hasProjectReferences(parsed)
    ? 'angular-typechecker: the resolved tsconfig has no input files because it ' +
      'is a solution-style / references-only config (TypeScript project ' +
      'references are not consulted by the Angular compiler). Point the ' +
      'tsConfig option at a leaf tsconfig that lists files, e.g. ' +
      'tsconfig.app.json, tsconfig.lib.json, or tsconfig.spec.json.'
    : 'angular-typechecker: the resolved tsconfig has no input files (empty ' +
      'project). Point the tsConfig option at a leaf tsconfig that includes ' +
      'source files, e.g. tsconfig.app.json, tsconfig.lib.json, or ' +
      'tsconfig.spec.json.';

  return synthesizeFilelessError(
    ts,
    ZERO_ROOT_NAMES_DIAGNOSTIC_CODE,
    messageText,
  );
}

/**
 * The per-call inputs the project-boundary filter needs, sourced from the live
 * Program host + the parsed config. Omitted on the zero-rootNames guard path
 * (no Program), where all suppressed counters are 0 / empty and nothing is
 * filtered.
 */
interface FinalizeFilter {
  // D-05: in-project baseline = the leaf tsconfig's `basePath`.
  basePath: string;
  // D-07: false (default) excludes out-of-project + node_modules.
  includeDeps: boolean;
  // D-06: from `result.program.getTsProgram().useCaseSensitiveFileNames()`.
  useCaseSensitiveFileNames: boolean;
  // D-02: the DECLARED rootName `.ts` paths whose union is the input set. The
  // walk path threads `walk.rootNamePaths`; the direct path threads
  // `parsed.rootNames`.
  inputTs: readonly string[];
  // D-06: symlink resolution (pnpm `.pnpm/`); `ts.sys.realpath` in production.
  realpath: (filePath: string) => string;
}

/**
 * Assembles the CoreResult. When `filter` is supplied (the normal path), it
 * first excludes out-of-project + node_modules diagnostics (D-06). The kept set
 * is then sorted + deduped via `ts.sortAndDeduplicateDiagnostics` (D-09)
 * UNCONDITIONALLY -- including the zero-rootNames guard path (no `filter`, where
 * diagnostics pass through unfiltered with all suppressed counters 0 / empty) --
 * so the reported order is deterministic on every path (IN-01/IN-05). Error and Warning
 * categories are then counted EXPLICITLY (D-01) on that POST-filter, sorted set,
 * never by subtracting errors from the total. Suggestion + Message categories
 * stay in `diagnostics` but are not counted, preserving the invariant
 * `errorCount + warningCount <= diagnostics.length`.
 *
 * RES-02 (reframe): it also scans the PRE-filter `diagnostics` arg (the raw
 * gathered set before the boundary filter + dedup, a SUPERSET of `reported`) for
 * a TCB-generation Fatal (NG3004) and, when present, sets `templateCheckAborted`
 * so the adapter can surface the loud suppression notice. Scanning the pre-filter
 * set also catches an out-of-basePath poison the boundary filter would suppress
 * from `reported`. This is pure detection -- it never mutates the verdict or
 * touches the infra-500 path (D-05).
 */
function finalize(
  ts: typeof import('typescript'),
  tsConfigPath: string,
  rootNamesCount: number,
  diagnostics: readonly ts.Diagnostic[],
  start: number,
  filter?: FinalizeFilter,
): CoreResult {
  let kept: readonly ts.Diagnostic[] = diagnostics;
  let suppressedThirdParty = 0;
  let suppressedInGraphErrorCount = 0;
  let suppressedInGraphWarningCount = 0;
  let suppressedInGraphFiles: readonly string[] = [];

  if (filter !== undefined) {
    const filtered = filterDiagnostics(diagnostics, {
      basePath: filter.basePath,
      includeDeps: filter.includeDeps,
      useCaseSensitiveFileNames: filter.useCaseSensitiveFileNames,
      realpath: filter.realpath,
      inputTs: filter.inputTs,
    });

    kept = filtered.kept;
    suppressedThirdParty = filtered.suppressedThirdParty;
    suppressedInGraphErrorCount = filtered.suppressedInGraphErrorCount;
    suppressedInGraphWarningCount = filtered.suppressedInGraphWarningCount;
    suppressedInGraphFiles = filtered.suppressedInGraphFiles;
  }

  // D-09 / IN-01 / IN-05: sort + dedup the kept set UNCONDITIONALLY before
  // counting/formatting so the report is deterministic (alphabetical by file,
  // file-less first) on BOTH the normal path and the zero-rootNames guard path,
  // and any accidental cross-phase duplicates from the unconditional all-getter
  // are always removed.
  const reported = ts.sortAndDeduplicateDiagnostics(kept);

  const errorCount = reported.filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  ).length;
  const warningCount = reported.filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Warning,
  ).length;

  // RES-02 (reframe; 09-RES-02-DECISION.md): PURE detection of a TCB-generation
  // Fatal in the PRE-filter `diagnostics` arg -- the raw gathered set BEFORE the
  // boundary filter and dedup -- NOT the post-filter `reported` set. Detect by
  // CODE only (the same code-only discipline the infra-500 scans use -- never
  // `source`/message text). The abort is whole-program: it aborts shim generation
  // for ALL files, so survivors' template diagnostics are gone no matter where the
  // offending shim lives. An out-of-basePath poison is SUPPRESSED from `reported`
  // by the boundary filter, so scanning `reported` would silently miss it; the
  // pre-filter arg is a SUPERSET of `reported`, so this catches BOTH the in-project
  // and the out-of-basePath case while remaining order/dedup-independent (a pure
  // code-only `.find`). It never affects counts -- errorCount/warningCount derive
  // from `reported` -- so this is purely additive signalling. `undefined` when no
  // such Fatal is present (the common path).
  const templateCheckAborted = detectTemplateCheckAborted(diagnostics);

  // SB-09 (D-02): PURE detection of unresolved bundler-query imports. Unlike
  // `detectTemplateCheckAborted` above -- which scans the PRE-filter `diagnostics`
  // arg (a whole-program TCB abort must fire even for an out-of-project poison) --
  // this scans `reported`, the POST-filter KEPT set (Pitfall 1). D-02 requires it:
  // the advisory must name ONLY TS2307 the consumer actually SEES and can fix via
  // their tsconfig; a boundary-filtered node_modules `?query` is dropped from
  // `reported` and must never be named. The two detectors look alike but have
  // OPPOSITE scan targets -- a future refactor MUST NOT unify them onto one arg.
  const bundlerQueryImports = detectBundlerQueryImports(ts, reported);

  return {
    tsConfigPath,
    rootNamesCount,
    diagnostics: reported,
    errorCount,
    warningCount,
    suppressedThirdParty,
    suppressedInGraphErrorCount,
    suppressedInGraphWarningCount,
    suppressedInGraphFiles,
    durationMs: performance.now() - start,
    ...(templateCheckAborted !== undefined ? { templateCheckAborted } : {}),
    ...(bundlerQueryImports.length > 0 ? { bundlerQueryImports } : {}),
  };
}

/**
 * RES-02: scans the given diagnostics for the TCB-generation Fatal code
 * (`TCB_GENERATION_FATAL_DIAGNOSTIC_CODE === NG(3004)`) and, if found, returns
 * the abort details (the negative code + the offending file when attached). Pure:
 * no `console`/`process`. Returns `undefined` when no TCB-generation Fatal is in
 * the set -- the common case -- so the adapter renders the notice only on
 * presence. `finalize` passes the PRE-filter diagnostics (NOT the boundary-
 * filtered `reported` set), so an out-of-project Fatal still fires the notice
 * (I-1); `find` returns the first match, and the compiler attaches the
 * TCB-generation Fatal to a single shim, so first-match is the offending
 * diagnostic.
 *
 * Exported for the RES-02 unit tier: a synthesized diagnostic set lets the
 * detection logic be proven WITHOUT a real cold-compiler run (the integration
 * tier proves it end-to-end against the poison fixture).
 */
export function detectTemplateCheckAborted(
  diagnostics: readonly ts.Diagnostic[],
): TemplateCheckAborted | undefined {
  const fatal = diagnostics.find(
    (diagnostic) => diagnostic.code === TCB_GENERATION_FATAL_DIAGNOSTIC_CODE,
  );

  if (fatal === undefined) {
    return undefined;
  }

  return {
    code: fatal.code,
    fileName: normalizeShimFileName(fatal.file?.fileName),
  };
}

/**
 * RES-02: maps a generated Angular type-check SHIM path back to its SOURCE
 * component. The TCB-generation Fatal attaches to the synthesized
 * `<name>.ngtypecheck.ts` shim (empirically confirmed -- 09-02-SUMMARY.md and the
 * HYBRID-gatherer header), NOT the authored `<name>.ts`. The notice must point at
 * a file the consumer can actually open and fix, so this strips the
 * `.ngtypecheck` infix that the compiler injects via
 * `fileName.replace(/\.tsx?$/, ".ngtypecheck.ts")` (verified at v22.0.4). A
 * non-shim (already-source) path or `undefined` passes through unchanged.
 *
 * LIMITATION (WR-01): the compiler collapses BOTH `.ts` and `.tsx` sources to the
 * SAME `<name>.ngtypecheck.ts` shim, so the original extension is unrecoverable
 * from the shim name alone -- a `.tsx`-sourced component is therefore named as
 * `<name>.ts` here. This affects ONLY the advisory notice's path string, never the
 * verdict, the counts, or the diagnostic's own codeframe (which renders the real
 * path independently). `.tsx` Angular component sources are vanishingly rare (no
 * JSX in Angular). If `.tsx` support is ever in scope, resolve the offending
 * source via the program's source-file map rather than this string surgery.
 */
function normalizeShimFileName(
  fileName: string | undefined,
): string | undefined {
  if (fileName === undefined) {
    return undefined;
  }

  return fileName.replace(/\.ngtypecheck\.ts$/, '.ts');
}
