/**
 * The 18 `ExtendedTemplateDiagnosticName` member VALUES -- the single source of
 * truth (CONTEXT.md D-02) for the extended-diagnostic catalog surface.
 *
 * This module is intentionally DEPENDENCY-FREE: it does NOT import
 * `@angular/compiler-cli`. That is deliberate (CONTEXT.md D-01):
 * `ExtendedTemplateDiagnosticName` is NOT a public runtime export of
 * `@angular/compiler-cli` (`require('@angular/compiler-cli').ExtendedTemplateDiagnosticName`
 * is `undefined`, it is absent from the top-level `index.d.ts`, and the package
 * `exports` map exposes no `src/ngtsc/...` subpath), so it is unreachable at
 * runtime and under the production `nodenext` resolution the barrel resolves
 * empty. The list below is therefore a HAND-MIRRORED `as const` of the enum's
 * string VALUES (camelCase, NOT the SCREAMING_SNAKE member NAMES), kept in ENUM
 * DECLARATION ORDER, verified against the installed enum at
 * `node_modules/@angular/compiler-cli/src/ngtsc/diagnostics/src/extended_template_diagnostic_name.d.ts`
 * (@angular/compiler-cli@22.0.4, 18 members).
 *
 * WHO CONSUMES IT (both derive from THIS one declaration so they cannot drift):
 * 1. The runtime `it.each` catalog spec (Plan 02,
 *    `extended-catalog.integration.spec.ts`) -- keys its rows on these values.
 * 2. The type-level completeness tripwire (`extended-catalog.drift.ts`) --
 *    asserts this list set-equals the REAL enum's string-value union under
 *    classic module resolution (DRIFT-01). That tripwire is what keeps this
 *    hand-mirrored list HONEST: a member added/renamed/removed upstream fails
 *    `typecheck-drift` loudly instead of silently under-covering.
 *
 * Mirrors the dependency-free exported-const idiom of `./diagnostic-codes.ts`.
 */
export const EXTENDED_DIAGNOSTIC_MEMBERS = [
  'invalidBananaInBox',
  'nullishCoalescingNotNullable',
  'optionalChainNotNullable',
  'missingControlFlowDirective',
  'missingStructuralDirective',
  'textAttributeNotBinding',
  'uninvokedFunctionInEventBinding',
  'missingNgForOfLet',
  'suffixNotSupported',
  'skipHydrationNotStatic',
  'interpolatedSignalNotInvoked',
  'controlFlowPreventingContentProjection',
  'unusedLetDeclaration',
  'uninvokedTrackFunction',
  'unusedStandaloneImports',
  'unparenthesizedNullishCoalescing',
  'uninvokedFunctionInTextInterpolation',
  'deferTriggerMisconfiguration',
] as const;
