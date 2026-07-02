import type ts from 'typescript';

/**
 * NG diagnostic-code encoding helpers (D-07d named must-haves).
 *
 * Angular encodes its diagnostic codes NEGATIVELY for DISPLAY: the compiler's own
 * `ngErrorCode(code) = parseInt('-99' + code)` turns the 4-digit `ErrorCode`
 * (e.g. `INTERPOLATED_SIGNAL_NOT_INVOKED = 8109`) into the value seen on a
 * `ts.Diagnostic.code` (`-998109`). TypeScript's own codes are RAW (no offset):
 * `2322`, `2339`, `5053`, etc.
 *
 * `NG()` mirrors that encoding so specs assert the EXPECTED code symbolically
 * (`NG(8109)`), never the bare 4-digit number (`8109` would never match -- L-4 /
 * Pitfall E). The two formulas agree for every 4-digit NG code:
 * `parseInt('-99' + 8109) === -998109 === -990000 - 8109`.
 *
 * `ngCodeOf()` is the inverse: recover the human 4-digit code from a diagnostic's
 * negative code for output/logging (`-998109` -> `8109`).
 *
 * This module is production-importable and intentionally DEPENDENCY-FREE (no
 * `@angular/compiler-cli` import). It is consumed by the integration test tier
 * today; the executor/output layers (Phase 3/4) may reuse it for display.
 *
 * Counting is always by `ts.DiagnosticCategory`, NEVER by code sign (L-4): the
 * negative encoding affects DISPLAY only, not severity.
 */

/**
 * Encodes a 4-digit Angular `ErrorCode` to the negative value seen on a
 * `ts.Diagnostic.code`. Mirrors the compiler's `ngErrorCode(code) =
 * parseInt('-99' + code)`. Example: `NG(8101) === -998101`.
 *
 * PRECONDITION: `code` is a 4-digit Angular `ErrorCode` (1000-9999). The
 * `-990000 - code` shortcut ONLY equals `parseInt('-99' + code)` for exactly 4
 * digits. For a 3-digit code the two diverge (`NG(801) === -990801` vs
 * `parseInt('-99801') === -99801`); 5+ digits likewise. All current NG codes are
 * 4-digit (8001/8101/8109/8117); passing a non-4-digit code would compute a
 * wrong, never-matching value -- the exact "bare code never matches" trap this
 * module exists to prevent, one level up.
 */
export const NG = (code: number): number => -990000 - code;

/**
 * Recovers the human 4-digit Angular `ErrorCode` from a negative diagnostic code.
 * Inverse of `NG()`. Example: `ngCodeOf(-998101) === 8101`.
 *
 * PRECONDITION: `code` is the negative encoding of a 4-digit Angular `ErrorCode`
 * (i.e. produced by `NG()` / the compiler's `parseInt('-99' + code)`). The
 * `Math.abs(code) - 990000` inverse only round-trips for that 4-digit range; a
 * differently-shaped input yields a wrong code (see the `NG()` precondition).
 */
export const ngCodeOf = (code: number): number => Math.abs(code) - 990000;

/**
 * RES-02 (reframe; 09-RES-02-DECISION.md): the human 4-digit Angular `ErrorCode`
 * for `IMPORT_GENERATION_FAILURE`.
 *
 * angular-typechecker: vendored -- mirrors `@angular/compiler-cli` v22.0.4
 * `ErrorCode.IMPORT_GENERATION_FAILURE = 3004`
 * (`src/ngtsc/diagnostics/src/error_code.d.ts:170`). Kept as a bare literal here
 * (NOT an `@angular/compiler-cli` import) so this module stays dependency-free
 * (see the module header) and the core never pins to the ESM-only compiler.
 *
 * WHY THIS CODE SPECIFICALLY: it is the ONLY `FatalDiagnosticError` thrown from
 * the TCB-generation (Type-Check-Block) path that reaches `NgCompiler`'s per-file
 * `getDiagnosticsForFile` -> `getTemplateDiagnosticsForFile` `isFatalDiagnosticError`
 * catch (verified at v22.0.4: the typecheck bundle throws it at the reference
 * emitter's `referenceTcbValue`, and that bundle throws NO other Fatal code).
 * Because the TCB-generation Fatal is thrown DURING the shared
 * `ensureAllShimsForAllFiles()` priming that `OptimizeFor.WholeProgram` triggers,
 * it aborts shim generation for ALL files -- so surviving files' Angular
 * template/extended (NG8xxx) diagnostics are SUPPRESSED. Detecting this code in
 * the PRE-filter gathered set (the raw `diagnostics` `finalize` receives), NOT
 * the post-boundary-filter `reported` set, is the signal that drives the loud
 * RES-02 suppression notice.
 *
 * The sibling structural codes `SYMBOL_NOT_EXPORTED = 3001` and
 * `IMPORT_CYCLE_DETECTED = 3003` are deliberately EXCLUDED: at v22.0.4 they are
 * thrown during component ANALYSIS (a separate bundle), surface through the
 * structural / non-template getters, and do NOT abort shared TCB-generation
 * shim priming -- so they do not suppress survivors' template diagnostics.
 */
export const IMPORT_GENERATION_FAILURE_CODE = 3004;

/**
 * RES-02: the NEGATIVE (`ts.Diagnostic.code`) encoding of the TCB-generation
 * `IMPORT_GENERATION_FAILURE` Fatal -- `NG(3004) === -993004`. This is the value
 * actually seen on a reported diagnostic (the compiler's `makeDiagnostic` runs
 * `code: ngErrorCode(this.code)` on the caught Fatal at v22.0.4). `finalize`
 * scans the PRE-filter gathered set (the raw `diagnostics` `finalize` receives),
 * NOT the post-boundary-filter `reported` set, for this exact value to flag the
 * template-check abort.
 */
export const TCB_GENERATION_FATAL_DIAGNOSTIC_CODE = NG(
  IMPORT_GENERATION_FAILURE_CODE,
);

/**
 * The SYNTHESIZED diagnostic-code space (90000+): angular-typechecker's OWN codes
 * for conditions the compiler never emits -- a references-only / empty config
 * (`90001`) and a not-found referenced leaf (`90002`). Both are chosen OUTSIDE the
 * TypeScript code range (1xxx-9xxx / TS18xxx, all < 90000), OUTSIDE the Angular
 * negative `-99xxxx` encoding, and OUTSIDE the `500` UNKNOWN_ERROR_CODE space, so
 * neither can collide with a genuine TS or NG diagnostic. Co-located here (the
 * canonical code home) as siblings so the whole synthesized space is auditable in
 * one place and a future `90003` cannot silently collide with `90001`/`90002`.
 */
export const ZERO_ROOT_NAMES_DIAGNOSTIC_CODE = 90001;
export const REFERENCE_NOT_FOUND_DIAGNOSTIC_CODE = 90002;

/**
 * Builds a FILE-LESS Error `ts.Diagnostic` (`file`/`start`/`length` undefined). The
 * file-less shape is LOAD-BEARING: the project-boundary filter
 * (filter-diagnostics.ts) keeps a diagnostic unconditionally ONLY when it is
 * file-less, so a synthesized guard / not-found Error is never suppressed and is
 * always counted. Both synthesized-code sites (the zero-rootNames `90001` guard in
 * run-typecheck.ts and the not-found `90002` in walk-references.ts) build their
 * diagnostic through this ONE factory, so that load-bearing shape -- and the risk
 * of drifting it into a silently-suppressed false-PASS -- lives in exactly one
 * place. `ts` is passed in so this module stays runtime-dependency-free.
 */
export function synthesizeFilelessError(
  ts: typeof import('typescript'),
  code: number,
  messageText: string,
): ts.Diagnostic {
  return {
    category: ts.DiagnosticCategory.Error,
    code,
    file: undefined,
    start: undefined,
    length: undefined,
    messageText,
  };
}
