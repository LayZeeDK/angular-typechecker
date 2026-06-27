import type ts from 'typescript';

import type {
  EmitFlags,
  ParsedConfiguration,
} from './compiler-cli-types';
import { loadCompilerCli } from './compiler-loader';
import { filterDiagnostics } from './filter-diagnostics';
import { gatherAllDiagnostics } from './gather-diagnostics';

export interface CoreOptions {
  tsConfigPath: string;
  // D-07: project-boundary filter switch. Default false excludes out-of-project
  // + node_modules diagnostics from the reported set; true folds them back in
  // (and resets `suppressedCount` to 0). Orthogonal to the consumer's
  // `skipLibCheck` (which governs whether node_modules `.d.ts` diagnostics are
  // even produced).
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
  // D-02: count of excluded out-of-project + node_modules diagnostics. 0 on the
  // zero-rootNames guard path (no Program) and whenever `includeDeps` is true.
  suppressedCount: number;
  durationMs: number;
}

// Private synthesized-diagnostic code for the D-03 zero-rootNames guard. Chosen
// OUTSIDE the TypeScript code range and OUTSIDE the Angular negative `-99xxxx`
// encoding and the `500` UNKNOWN_ERROR_CODE space, so it can never collide with
// a genuine TS or NG diagnostic (Claude's discretion per CONTEXT/RESEARCH).
const ZERO_ROOT_NAMES_DIAGNOSTIC_CODE = 90001;

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
  // WR-02 / IN-04: capture `start` at the very top so `durationMs` reflects the
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

  const parsed = ng.readConfiguration(options.tsConfigPath);

  // D-03 part 1 (fixes MD-01): NEVER drop `parsed.errors`. A malformed,
  // unreadable, or nonexistent tsconfig surfaces here and is prepended to the
  // final diagnostics so it is counted -- never a silent "clean".
  const configDiagnostics = [...parsed.errors];

  // D-03 part 2 / D-03a: gate on `rootNames.length === 0` (NEVER TS18003, which
  // TypeScript suppresses when a config has a `references` array). A
  // solution-style / references-only or empty config short-circuits here so
  // `performCompilation` is skipped, and one synthesized Error is returned --
  // giving agents/CI a deterministic non-zero signal instead of a false PASS.
  if (parsed.rootNames.length === 0) {
    const guard = synthesizeZeroRootNamesDiagnostic(ts, parsed);

    // No Program on this path: nothing to filter (the single guard diagnostic is
    // file-less and would never be filtered anyway), so `suppressedCount` is 0
    // and `finalize` runs with `filter` omitted.
    return finalize(
      ts,
      options.tsConfigPath,
      0,
      [...configDiagnostics, guard],
      start,
    );
  }

  // D-05 + D-02: build a FRESH per-call options object (footgun guard against a
  // mutated `noEmit` leaking across calls) spreading `...parsed.options` then the
  // full emit-neutralizing override. `composite: false` is the gatekeeper that
  // makes `declaration: false` / `incremental: false` safe and that breaks the
  // composite/emitDeclarationOnly triangle producing a bogus TS5053/TS6304.
  // D-05b: every semantics-defining option (module, moduleResolution, target,
  // lib, paths, strictTemplates, extended*) stays untouched via the spread.
  const result = ng.performCompilation({
    rootNames: parsed.rootNames,
    options: {
      ...parsed.options,
      // ---- D-05 emit-neutralizing override (verbatim from 02-CONTEXT.md) ----
      noEmit: true,
      composite: false,
      declaration: false,
      declarationMap: false,
      emitDeclarationOnly: false,
      incremental: false,
      tsBuildInfoFile: undefined,
      sourceMap: undefined,
      inlineSourceMap: undefined,
      inlineSources: undefined,
      declarationDir: undefined,
      mapRoot: undefined,
      sourceRoot: undefined,
      // ---- D-02: suppress the "Time for diagnostics" Message ----
      diagnostics: false,
    },
    // D-05a / V-2: emitFlags: 0 AND noEmit: true are BOTH load-bearing, neither
    // decorative. emitFlags: 0 is the suppressor when i18n is involved; noEmit
    // is the suppressor for the clean fall-through to ts.Program.emit.
    emitFlags: 0 as EmitFlags,
    // ENG-02: the unconditional all-getter (no ngc phase short-circuit).
    gatherDiagnostics: gatherAllDiagnostics,
  });

  // D-06 / V-3 / L-3: detect a returned UNKNOWN_ERROR_CODE (500) by CODE only --
  // never by `source === 'angular'` (the synthesized diagnostic sets no source).
  // Re-throw so the infra failure is never counted as a type error.
  const infrastructureFailure = result.diagnostics.find(
    (diagnostic) => diagnostic.code === ng.UNKNOWN_ERROR_CODE,
  );

  if (infrastructureFailure !== undefined) {
    throw new TypecheckInfrastructureError(
      ts.flattenDiagnosticMessageText(infrastructureFailure.messageText, '\n'),
    );
  }

  // D-06: classify against the leaf tsconfig's `basePath` (the directory
  // `readConfiguration` injects), NEVER `parsed.options.rootDir` -- in this
  // `--preset=apps` workspace `rootDir` is the workspace root, which would mark
  // every file in-project and defeat the filter. The live program host supplies
  // `useCaseSensitiveFileNames()` so the case-fold mirrors how diagnostics were
  // produced (RESEARCH D-05/D-06).
  return finalize(
    ts,
    options.tsConfigPath,
    parsed.rootNames.length,
    [...configDiagnostics, ...result.diagnostics],
    start,
    {
      basePath: parsed.options.basePath ?? '',
      includeDeps: options.includeDeps ?? false,
      useCaseSensitiveFileNames: result.program
        .getTsProgram()
        .useCaseSensitiveFileNames(),
      realpath: (filePath: string): string =>
        ts.sys.realpath?.(filePath) ?? filePath,
    },
  );
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
  const hasReferences =
    parsed.projectReferences !== undefined &&
    parsed.projectReferences.length > 0;

  const messageText = hasReferences
    ? 'angular-typechecker: the resolved tsconfig has no input files because it ' +
      'is a solution-style / references-only config (TypeScript project ' +
      'references are not consulted by the Angular compiler). Point the ' +
      'tsConfig option at a leaf tsconfig that lists files, e.g. ' +
      'tsconfig.app.json, tsconfig.lib.json, or tsconfig.spec.json.'
    : 'angular-typechecker: the resolved tsconfig has no input files (empty ' +
      'project). Point the tsConfig option at a leaf tsconfig that includes ' +
      'source files, e.g. tsconfig.app.json, tsconfig.lib.json, or ' +
      'tsconfig.spec.json.';

  return {
    category: ts.DiagnosticCategory.Error,
    code: ZERO_ROOT_NAMES_DIAGNOSTIC_CODE,
    file: undefined,
    start: undefined,
    length: undefined,
    messageText,
  };
}

/**
 * The per-call inputs the project-boundary filter needs, sourced from the live
 * Program host + the parsed config. Omitted on the zero-rootNames guard path
 * (no Program), where `suppressedCount` is 0 and nothing is filtered.
 */
interface FinalizeFilter {
  // D-05: in-project baseline = the leaf tsconfig's `basePath`.
  basePath: string;
  // D-07: false (default) excludes out-of-project + node_modules.
  includeDeps: boolean;
  // D-06: from `result.program.getTsProgram().useCaseSensitiveFileNames()`.
  useCaseSensitiveFileNames: boolean;
  // D-06: symlink resolution (pnpm `.pnpm/`); `ts.sys.realpath` in production.
  realpath: (filePath: string) => string;
}

/**
 * Assembles the CoreResult. When `filter` is supplied (the normal path), it
 * first excludes out-of-project + node_modules diagnostics (D-06), then sorts +
 * dedupes the kept set via `ts.sortAndDeduplicateDiagnostics` (D-09), then
 * counts Error and Warning categories EXPLICITLY (D-01) on that POST-filter,
 * sorted set -- never by subtracting errors from the total. On the
 * zero-rootNames guard path (no `filter`), the diagnostics pass through unsorted
 * and unfiltered with `suppressedCount: 0`. Suggestion + Message categories stay
 * in `diagnostics` but are not counted, preserving the invariant
 * `errorCount + warningCount <= diagnostics.length`.
 */
function finalize(
  ts: typeof import('typescript'),
  tsConfigPath: string,
  rootNamesCount: number,
  diagnostics: readonly ts.Diagnostic[],
  start: number,
  filter?: FinalizeFilter,
): CoreResult {
  let reported: readonly ts.Diagnostic[] = diagnostics;
  let suppressedCount = 0;

  if (filter !== undefined) {
    const filtered = filterDiagnostics(diagnostics, {
      basePath: filter.basePath,
      includeDeps: filter.includeDeps,
      useCaseSensitiveFileNames: filter.useCaseSensitiveFileNames,
      realpath: filter.realpath,
    });

    // D-09: sort + dedup the kept set BEFORE counting/formatting so the report
    // is deterministic (alphabetical by file, file-less first) and any
    // accidental cross-phase duplicates from the unconditional all-getter are
    // removed.
    reported = ts.sortAndDeduplicateDiagnostics(filtered.kept);
    suppressedCount = filtered.suppressedCount;
  }

  const errorCount = reported.filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  ).length;
  const warningCount = reported.filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Warning,
  ).length;

  return {
    tsConfigPath,
    rootNamesCount,
    diagnostics: reported,
    errorCount,
    warningCount,
    suppressedCount,
    durationMs: performance.now() - start,
  };
}

let cachedTypescript: typeof ts | undefined;

async function loadTypescript(): Promise<typeof ts> {
  if (cachedTypescript === undefined) {
    const loaded = (await import('typescript')) as typeof ts & {
      default?: typeof ts;
    };
    cachedTypescript = loaded.default ?? loaded;
  }

  return cachedTypescript;
}
