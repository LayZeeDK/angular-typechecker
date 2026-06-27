import type ts from 'typescript';

import type {
  EmitFlags,
  ParsedConfiguration,
} from './compiler-cli-types';
import { loadCompilerCli } from './compiler-loader';
import { gatherAllDiagnostics } from './gather-diagnostics';

export interface CoreOptions {
  tsConfigPath: string;
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
  // D-06: GENUINE compiler diagnostics only (config errors prepended per D-03).
  diagnostics: readonly ts.Diagnostic[];
  // D-01: category === Error (explicit).
  errorCount: number;
  // D-01: category === Warning (explicit, NOT total - errorCount).
  warningCount: number;
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
 * research Open Question 1). No filtering of out-of-project diagnostics is
 * applied (deferred to Phase 3, D-10).
 *
 * The core requires an ABSOLUTE `tsConfigPath` and never touches
 * `process.cwd()` (D-04); the Phase-4 executor owns path resolution.
 */
export async function runTypecheck(options: CoreOptions): Promise<CoreResult> {
  // D-06: a throw from loadCompilerCli (ESM load of @angular/compiler-cli)
  // propagates as a true environment/install error, never a type result.
  const ng = await loadCompilerCli();
  const ts = await loadTypescript();

  const parsed = ng.readConfiguration(options.tsConfigPath);

  // D-03 part 1 (fixes MD-01): NEVER drop `parsed.errors`. A malformed,
  // unreadable, or nonexistent tsconfig surfaces here and is prepended to the
  // final diagnostics so it is counted -- never a silent "clean".
  const configDiagnostics = [...parsed.errors];

  const start = performance.now();

  // D-03 part 2 / D-03a: gate on `rootNames.length === 0` (NEVER TS18003, which
  // TypeScript suppresses when a config has a `references` array). A
  // solution-style / references-only or empty config short-circuits here so
  // `performCompilation` is skipped, and one synthesized Error is returned --
  // giving agents/CI a deterministic non-zero signal instead of a false PASS.
  if (parsed.rootNames.length === 0) {
    const guard = synthesizeZeroRootNamesDiagnostic(ts, parsed);

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

  return finalize(
    ts,
    options.tsConfigPath,
    parsed.rootNames.length,
    [...configDiagnostics, ...result.diagnostics],
    start,
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
 * Assembles the CoreResult, counting Error and Warning categories EXPLICITLY
 * (D-01) -- never by subtracting errors from the total. Suggestion + Message
 * categories stay in `diagnostics` but are not counted, preserving the invariant
 * `errorCount + warningCount <= diagnostics.length`.
 */
function finalize(
  ts: typeof import('typescript'),
  tsConfigPath: string,
  rootNamesCount: number,
  diagnostics: readonly ts.Diagnostic[],
  start: number,
): CoreResult {
  const errorCount = diagnostics.filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  ).length;
  const warningCount = diagnostics.filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Warning,
  ).length;

  return {
    tsConfigPath,
    rootNamesCount,
    diagnostics,
    errorCount,
    warningCount,
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
