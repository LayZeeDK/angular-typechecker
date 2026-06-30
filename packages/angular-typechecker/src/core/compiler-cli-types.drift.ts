// BUILD-TIME DRIFT TRIPWIRE for the vendored `compiler-cli-types.ts` shim
// (HARD-01 / HARD-02 / HARD-04). This file is TYPE-ONLY and never ships.
//
// WHY THIS FILE EXISTS (the INVERSE of the shim's own header): the shim
// (`compiler-cli-types.ts`) hand-declares a deliberate SUBSET of the real
// `@angular/compiler-cli` `api.Program` because the production `nodenext` build
// resolves the real package barrel EMPTY (its `index.d.ts` re-exports with
// extensionless relative paths that strict nodenext ESM resolution refuses, so
// the namespace resolves empty). That subset is faithful TODAY, but an Angular
// upgrade that REMOVES, renames, or signature-changes one of the diagnostic
// getters the gatherer calls would otherwise pass `nx build` silently and the
// engine would under-gather at runtime. This file makes that LOUD: it imports
// the REAL named types from `@angular/compiler-cli` and asserts the real
// `api.Program` stays assignable TO the shim (real->shim, a deliberate-subset
// direction). A removed/renamed/return-changed called getter fails the assertion
// at its precise tuple slot; an optional->required param change (SILENT under
// assignability) is caught by the call-site probes; a renumbered `EmitFlags` or
// a changed `UNKNOWN_ERROR_CODE` is caught by the value-level pins.
//
// WHY IT NEVER SHIPS AND NEVER BREAKS THE PRODUCTION BUILD: the real-barrel
// import only resolves under CLASSIC node10 module resolution, which is why this
// file compiles ONLY under `tsconfig.drift.json` (classic `moduleResolution:
// node` + `ignoreDeprecations: "6.0"`, run by the `typecheck-drift` Nx target).
// It is EXCLUDED from both `tsconfig.lib.json` and `tsconfig.spec.json` (under
// their `nodenext` mode the same import resolves EMPTY -> TS2305 -> would break
// `nx build`/`nx test`), so `nx build` and `nx test` never see it and it is not
// `index`-reachable nor in the `files` whitelist that gates the tarball.
//
// SCOPE (D-01): real->shim catches REMOVED/renamed/signature-changed getters.
// A newly-ADDED upstream getter is intentionally NOT a build failure here (the
// shim is a deliberate subset) -- additions are surfaced out-of-band by the
// runtime getter-set spec (Plan 03). Widen the shim (and this file) as the
// engine grows; keep both MINIMAL.

import type { Program as RealProgram } from '@angular/compiler-cli';
// Value imports (NOT `import type`): the value-level pins below read
// `UNKNOWN_ERROR_CODE` as a value and `EmitFlags` as a value-namespace
// (`RealEmitFlags.DTS` etc.). The drift file is erased at emit (this target
// is `noEmit`), so these bindings exist only for the type-check.
import { EmitFlags as RealEmitFlags, UNKNOWN_ERROR_CODE as RealUnknown } from '@angular/compiler-cli';
import type * as ts from 'typescript';

import type { Program as ShimProgram } from './compiler-cli-types';

// D-03: the PlainTS assignability helper (ZERO new dependency; no `expect-type`/
// `tsd`). `To extends From` is the constraint -- the type only resolves to
// `true` when `From` is assignable to `To`; a non-assignable pair errors where
// the alias is instantiated below.
type AssertAssignable<From, To extends From> = true;

// D-02: the 6 DIAGNOSTIC getters the gatherer calls, one real->shim pair each.
// A removed/renamed/return-changed getter errors at its exact tuple slot. The
// getter SET mirrors `gather-diagnostics.ts` (`getTsOptionDiagnostics`,
// `getNgOptionDiagnostics`, `getTsSyntacticDiagnostics`,
// `getTsSemanticDiagnostics`, `getNgStructuralDiagnostics` [HARD-04],
// `getNgSemanticDiagnostics`).
type DiagnosticGetterProbe = [
  AssertAssignable<
    RealProgram['getTsOptionDiagnostics'],
    ShimProgram['getTsOptionDiagnostics']
  >,
  AssertAssignable<
    RealProgram['getNgOptionDiagnostics'],
    ShimProgram['getNgOptionDiagnostics']
  >,
  AssertAssignable<
    RealProgram['getTsSyntacticDiagnostics'],
    ShimProgram['getTsSyntacticDiagnostics']
  >,
  AssertAssignable<
    RealProgram['getTsSemanticDiagnostics'],
    ShimProgram['getTsSemanticDiagnostics']
  >,
  // HARD-04: getNgStructuralDiagnostics is in the asserted set so a future
  // Angular that reactivates it cannot silently under-gather.
  AssertAssignable<
    RealProgram['getNgStructuralDiagnostics'],
    ShimProgram['getNgStructuralDiagnostics']
  >,
  AssertAssignable<
    RealProgram['getNgSemanticDiagnostics'],
    ShimProgram['getNgSemanticDiagnostics']
  >,
];

// LANDMINE (RESEARCH Pitfall 1): getTsProgram CANNOT be a naive real->shim member
// pair. The real `api.Program.getTsProgram()` returns plain `ts.Program`, but the
// shim WIDENS its return to `TsProgram = ts.Program & { useCaseSensitiveFileNames() }`.
// A real->shim member pair FAILS (TS2322) because the shim demands MORE than the
// real type provides. Assert instead that the real return is assignable to
// `ts.Program` (the shim's own base) -- that is the contract this file can
// honestly check; the shim's `useCaseSensitiveFileNames` extension is vendored
// (it exists on the runtime instance, not on the public `ts.Program` type).
type GetTsProgramProbe = AssertAssignable<
  ReturnType<RealProgram['getTsProgram']>,
  ts.Program
>;

void (0 as unknown as DiagnosticGetterProbe);
void (0 as unknown as GetTsProgramProbe);

// D-05: call-site probes -- the optional->required silent-gap defense. An
// `optional -> required` param change is SILENT under assignability (method-param
// bivariance + arity tolerance), so the per-member probes above stay GREEN while
// the gatherer's call would break. These invoke each getter at the EXACT arity
// `gather-diagnostics.ts` uses; a newly-required param errors TS2554 here.
// `real` is type-only (never constructed); `_callSiteProbes` is never called.
declare const real: RealProgram;

function _callSiteProbes(): void {
  const _a: readonly ts.Diagnostic[] = real.getTsOptionDiagnostics();
  const _b: readonly ts.Diagnostic[] = real.getNgOptionDiagnostics();
  const _c: readonly ts.Diagnostic[] = real.getTsSyntacticDiagnostics();
  const _d: readonly ts.Diagnostic[] = real.getTsSemanticDiagnostics();
  const _e: readonly ts.Diagnostic[] = real.getNgStructuralDiagnostics();
  // BOTH arities the gatherer uses: no-arg residual whole-program set
  // (gather-diagnostics.ts:77) AND per-file (gather-diagnostics.ts:85).
  const _f: readonly ts.Diagnostic[] = real.getNgSemanticDiagnostics();
  const _g: readonly ts.Diagnostic[] = real.getNgSemanticDiagnostics('x.ts');
  // COR-02 reach-through (gather-diagnostics.ts:88): getGlobalDiagnostics lives
  // on `ts.Program`, NOT `api.Program` -- a Program-level probe would miss it.
  const _h: readonly ts.Diagnostic[] = real
    .getTsProgram()
    .getGlobalDiagnostics();
  // WR-02 reach-through (gather-diagnostics.ts:80): the per-file template/extended
  // loop iterates `getTsProgram().getSourceFiles()` (reading `isDeclarationFile`
  // / `fileName` at :81-85). Like getGlobalDiagnostics, this lives on `ts.Program`
  // -- probe it so the asserted gatherer call-surface stays complete.
  const _i: readonly ts.SourceFile[] = real.getTsProgram().getSourceFiles();

  void _a;
  void _b;
  void _c;
  void _d;
  void _e;
  void _f;
  void _g;
  void _h;
  void _i;
}

void _callSiteProbes;

// Value-level assertions (own constants, NOT members of `api.Program`).
//
// UNKNOWN_ERROR_CODE must be exactly 500 -- the literal the shim hard-codes
// (`compiler-cli-types.ts`) and the infra-failure detector compares against
// (`run-typecheck.ts`). A changed upstream value errors TS2322 here.
const _unknown: 500 = RealUnknown;

// HARD-02: each `EmitFlags` member pinned to its real numeric value (DTS=1 ..
// All=31; the real enum has NO `None`). A renumbered enum errors TS2322 at the
// changed member. Mirrors the corrected shim enum from Plan 01.
const _dts: RealEmitFlags.DTS = 1;
const _js: RealEmitFlags.JS = 2;
const _meta: RealEmitFlags.Metadata = 4;
const _i18n: RealEmitFlags.I18nBundle = 8;
const _codegen: RealEmitFlags.Codegen = 16;
const _default: RealEmitFlags.Default = 19;
const _all: RealEmitFlags.All = 31;

void _unknown;
void _dts;
void _js;
void _meta;
void _i18n;
void _codegen;
void _default;
void _all;
