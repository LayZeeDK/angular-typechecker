// SELF-CONTAINED structural type surface for the @angular/compiler-cli members
// the core consumes (D-10 / B-02 fix).
//
// WHY THIS FILE EXISTS (and why it is now self-contained): under `module:
// nodenext` (the GATE A enabler that keeps the runtime dynamic load literal in
// the emitted .js), TypeScript treats @angular/compiler-cli's published
// `index.d.ts` as an ESM module. That barrel re-exports its members with
// EXTENSIONLESS relative paths (`export * from './src/transformers/api'`), which
// strict nodenext ESM resolution refuses to resolve, so the namespace resolves
// EMPTY. The previous workaround imported the surface from the compiler-cli
// package's DEEP declaration files via a deep RELATIVE specifier that climbed up
// four directories into the installed dependency tree. That relative path is
// computed for the WORKSPACE layout and climbs OUT of the published package; in a
// consumer install (under the installed `angular-typechecker/src/core/...`) it
// resolves to a directory that does not exist. `attw --pack` flagged it as an
// `InternalResolutionError`
// on every resolution profile (D-10), and the escape IS reachable from the
// public `index.d.ts` surface (`loadCompilerCli`/`formatReport`/
// `gatherAllDiagnostics`), so erasure was not viable.
//
// THE FIX (D-10 option a): hand-declare the minimal STRUCTURAL surface the core
// calls, sourced from `typescript`'s public types (a real, nodenext-resolvable
// dependency). No path climbs out of the package; the shipped `.d.ts` resolves
// in any consumer install. The exported names are preserved verbatim so the
// public contract is unchanged. These are types ONLY -- the runtime value is
// still the real, fully-featured module loaded via
// `await import('@angular/compiler-cli')` in `compiler-loader.ts` (the structural
// types are erased at emit; zero runtime effect). The engine code that CALLS
// these signatures is the compile-time guard against drift: if a declared shape
// stops matching how the engine uses it, `nx build` fails.
//
// Widen these declarations as the engine grows; keep them MINIMAL and never
// re-introduce a deep relative import into @angular/compiler-cli.

import type * as ts from 'typescript';

/**
 * The underlying `ts.Program` the Angular `Program` wraps. The public
 * `ts.Program` interface does not surface `useCaseSensitiveFileNames()` (it lives
 * on the host), but the real runtime instance returned by `getTsProgram()` does
 * expose it -- the engine reads it in `run-typecheck.ts` to mirror the case-fold
 * used when diagnostics were produced. Declared as an intersection so the call
 * type-checks structurally without re-introducing a deep compiler-cli import.
 */
export type TsProgram = ts.Program & {
  useCaseSensitiveFileNames(): boolean;
};

/**
 * The Angular compiler `Program` (a superset of `ts.Program`). Only the
 * unconditional diagnostic getters the all-getter gatherer calls
 * (`gather-diagnostics.ts`) plus `getTsProgram()` (read in `run-typecheck.ts`
 * for `useCaseSensitiveFileNames`) are declared. Each getter returns the shared
 * `ts.Diagnostic` shape (Angular extended codes are encoded NEGATIVE on
 * `ts.Diagnostic.code`).
 */
export interface Program {
  getTsProgram(): TsProgram;
  getTsOptionDiagnostics(
    cancellationToken?: ts.CancellationToken,
  ): readonly ts.Diagnostic[];
  getNgOptionDiagnostics(
    cancellationToken?: ts.CancellationToken,
  ): readonly ts.Diagnostic[];
  getTsSyntacticDiagnostics(
    sourceFile?: ts.SourceFile,
    cancellationToken?: ts.CancellationToken,
  ): readonly ts.Diagnostic[];
  getTsSemanticDiagnostics(
    sourceFile?: ts.SourceFile,
    cancellationToken?: ts.CancellationToken,
  ): readonly ts.Diagnostic[];
  getNgStructuralDiagnostics(
    cancellationToken?: ts.CancellationToken,
  ): readonly ts.Diagnostic[];
  getNgSemanticDiagnostics(
    fileName?: string,
    cancellationToken?: ts.CancellationToken,
  ): readonly ts.Diagnostic[];
}

/**
 * The bitflag enum `performCompilation` accepts as `emitFlags`. The members now
 * MIRROR the real `@angular/compiler-cli@22.0.4` enum verbatim
 * (`src/transformers/api.d.ts:74-82`): `DTS=1, JS=2, Metadata=4, I18nBundle=8,
 * Codegen=16, Default=19, All=31` -- the real enum has NO `None` member (the
 * earlier fabricated zero-valued member is removed, HARD-02). The engine only ever passes
 * the literal `0` (the emit-neutralizing value, with `noEmit: true`); `0` is not
 * a declared member, so the call site uses an explicit CAST
 * (`emitFlags: 0 as EmitFlags`, run-typecheck.ts:229) -- a bare `: EmitFlags = 0`
 * ERRORS TS2322 at tsc 6.0.3, the cast is what keeps `0` acceptable. Declared as
 * an ambient enum so it is usable both as a TYPE (`0 as EmitFlags`) and as a
 * VALUE namespace (`readonly EmitFlags: typeof EmitFlags` on `CompilerCli`);
 * `declare` means no runtime code is emitted (the shim stays erased-at-emit).
 */
export declare enum EmitFlags {
  DTS = 1,
  JS = 2,
  Metadata = 4,
  I18nBundle = 8,
  Codegen = 16,
  Default = 19,
  All = 31,
}

/**
 * The synthesized infrastructure-failure diagnostic code (`500`) that
 * `performCompilation` RE-uses when its outer catch swallows an internal crash.
 * Declared as an ambient numeric constant so it is usable both as a TYPE and as
 * the VALUE member `readonly UNKNOWN_ERROR_CODE` on `CompilerCli`. `declare`
 * emits no runtime code.
 */
export declare const UNKNOWN_ERROR_CODE = 500;

/**
 * The structural result of `readConfiguration` the engine reads
 * (`run-typecheck.ts`): the parsed root file names, the resolved compiler
 * options (carrying the injected absolute `basePath` the boundary filter keys
 * off), any config-parse errors, and the optional project references the
 * zero-rootNames guard branches on.
 */
export interface ParsedConfiguration {
  project: string;
  options: ts.CompilerOptions & { basePath?: string };
  rootNames: readonly string[];
  projectReferences?: readonly ts.ProjectReference[];
  emitFlags: EmitFlags;
  errors: readonly ts.Diagnostic[];
}

/**
 * The argument shape `performCompilation` accepts. `options` is intentionally the
 * full TypeScript+Angular compiler-options bag (the engine spreads
 * `parsed.options` and adds the emit-neutralizing override); `gatherDiagnostics`
 * is the pluggable gatherer seam (the unconditional all-getter, or ngc's
 * `defaultGatherDiagnostics` in the GATE B differential).
 */
export interface PerformCompilationOptions {
  rootNames: readonly string[];
  options: ts.CompilerOptions;
  emitFlags?: EmitFlags;
  gatherDiagnostics?: (program: Program) => readonly ts.Diagnostic[];
}

/**
 * The structural result of `performCompilation` the engine reads: the gathered
 * diagnostics and the resulting `Program` (whose `getTsProgram()` the boundary
 * filter reads). `program` is declared NON-optional because the engine only
 * reaches `result.program` on the non-infrastructure-failure path -- the
 * infrastructure-failure path (a returned `UNKNOWN_ERROR_CODE` diagnostic)
 * RE-THROWS before any `result.program` access (`run-typecheck.ts`). Angular's
 * own declaration types it optional; narrowing it here matches the engine's
 * guarded usage and keeps the build (the drift guard) green under the engine's
 * non-strict-null compiler options.
 */
export interface PerformCompilationResult {
  diagnostics: readonly ts.Diagnostic[];
  program: Program;
}

/**
 * The structural type of the loaded @angular/compiler-cli namespace, declared
 * self-contained over the `typescript` substrate (see file header for why the
 * package's own typings cannot be imported under nodenext). Only the members the
 * core actually calls are declared; widen as the engine grows.
 */
export interface CompilerCli {
  readConfiguration(
    project: string,
    existingOptions?: ts.CompilerOptions,
  ): ParsedConfiguration;
  performCompilation(
    options: PerformCompilationOptions,
  ): PerformCompilationResult;
  // ngc's phase-short-circuiting gatherer (the GATE B differential baseline);
  // same call shape as the unconditional all-getter.
  defaultGatherDiagnostics(program: Program): readonly ts.Diagnostic[];
  readonly EmitFlags: typeof EmitFlags;
  // D-06: the value (500) of the synthesized infrastructure-failure diagnostic
  // that `performCompilation` returns when its outer catch swallows an internal
  // crash. The engine detects this code and RE-THROWS rather than counting it as
  // a type error, so `CoreResult` holds only genuine compiler diagnostics.
  readonly UNKNOWN_ERROR_CODE: typeof UNKNOWN_ERROR_CODE;
  // OUT-01: the human-output renderer the Phase-3 formatter injects via
  // `Pick<CompilerCli, 'formatDiagnostics'>`. It emits NG codes + template
  // codeframes (a superset of `tsc`).
  formatDiagnostics(
    diagnostics: readonly ts.Diagnostic[],
    host?: ts.FormatDiagnosticsHost,
  ): string;
}
