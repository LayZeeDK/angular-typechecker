import { EXTENDED_DIAGNOSTIC_MEMBERS } from './extended-catalog.members';

/**
 * The single production source of the extended-diagnostic (NG8xxx) catalog that
 * drives the SARIF `rules[]` list (REP-02 / D-06). One entry per
 * `EXTENDED_DIAGNOSTIC_MEMBERS` member, in ENUM DECLARATION ORDER, carrying the
 * humanized NG code and a short human description. The member -> ngCode mapping
 * lives HERE and nowhere else: `extended-catalog.integration.spec.ts` sources its
 * ngCode from this table (no second copy, no drift), and `sarif-report.ts` builds
 * one catalog rule per entry (`id` = `NG{ngCode}`, `helpUri` derived per code).
 *
 * DEPENDENCY-FREE (src/core boundary, mirroring `extended-catalog.members.ts`): it
 * does NOT import `@angular/compiler-cli`, so the SARIF path never loads the heavy
 * ESM peer. `member` is typed as `(typeof EXTENDED_DIAGNOSTIC_MEMBERS)[number]` so
 * a member rename/removal upstream forces a compile error here too. A completeness
 * spec (`extended-catalog.spec.ts`) locks one entry per member in declaration
 * order; the existing `extended-catalog.drift.ts` still guards the member NAME set.
 *
 * The `ngCode` values are LIFTED verbatim from the former `CATALOG` table in
 * `extended-catalog.integration.spec.ts` (each proven against
 * @angular/compiler-cli@22.0.4 over a committed fixture) and cross-checked against
 * `.planning/phases/31-sarif-reporter/31-RESEARCH.md`. `shortDescription` is a
 * concise phrase derived from the Angular extended-diagnostics doc titles
 * (Claude's discretion per D-06). No `helpUri` is stored here -- `sarif-report.ts`
 * derives it per code as `https://angular.dev/extended-diagnostics/NG{ngCode}`.
 */
export interface ExtendedDiagnosticCatalogEntry {
  member: (typeof EXTENDED_DIAGNOSTIC_MEMBERS)[number];
  ngCode: number;
  shortDescription: string;
}

export const EXTENDED_DIAGNOSTIC_CATALOG: readonly ExtendedDiagnosticCatalogEntry[] =
  [
    {
      member: 'invalidBananaInBox',
      ngCode: 8101,
      shortDescription:
        'Inverted banana-in-a-box binding: use [(...)] rather than ([...])',
    },
    {
      member: 'nullishCoalescingNotNullable',
      ngCode: 8102,
      shortDescription:
        'Nullish coalescing (??) applied to a value that is not nullable',
    },
    {
      member: 'optionalChainNotNullable',
      ngCode: 8107,
      shortDescription:
        'Optional chaining (?.) applied to a value that is not nullable',
    },
    {
      member: 'missingControlFlowDirective',
      ngCode: 8103,
      shortDescription:
        'A control-flow directive is used without importing the directive that defines it',
    },
    {
      member: 'missingStructuralDirective',
      ngCode: 8116,
      shortDescription:
        'Unknown structural directive (a required import is missing)',
    },
    {
      member: 'textAttributeNotBinding',
      ngCode: 8104,
      shortDescription:
        'A static text attribute where a property binding was likely intended',
    },
    {
      member: 'uninvokedFunctionInEventBinding',
      ngCode: 8111,
      shortDescription:
        'A function is referenced but not invoked in an event binding',
    },
    {
      member: 'missingNgForOfLet',
      ngCode: 8105,
      shortDescription: 'ngFor is used without the let keyword',
    },
    {
      member: 'suffixNotSupported',
      ngCode: 8106,
      shortDescription: 'The unit suffix is not supported on this binding',
    },
    {
      member: 'skipHydrationNotStatic',
      ngCode: 8108,
      shortDescription:
        'ngSkipHydration is bound dynamically instead of as a static attribute',
    },
    {
      member: 'interpolatedSignalNotInvoked',
      ngCode: 8109,
      shortDescription:
        'A signal read in a template interpolation is not invoked',
    },
    {
      member: 'controlFlowPreventingContentProjection',
      ngCode: 8011,
      shortDescription:
        'Control flow prevents an element from being content-projected',
    },
    {
      member: 'unusedLetDeclaration',
      ngCode: 8112,
      shortDescription: 'An @let declaration in the template is never used',
    },
    {
      member: 'uninvokedTrackFunction',
      ngCode: 8115,
      shortDescription:
        'A track function is referenced but not invoked in a control-flow block',
    },
    {
      member: 'unusedStandaloneImports',
      ngCode: 8113,
      shortDescription: 'A standalone component declares imports it never uses',
    },
    {
      member: 'unparenthesizedNullishCoalescing',
      ngCode: 8114,
      shortDescription:
        'Nullish coalescing mixed with || or && without parentheses',
    },
    {
      member: 'uninvokedFunctionInTextInterpolation',
      ngCode: 8117,
      shortDescription:
        'A function is referenced but not invoked in a text interpolation',
    },
    {
      member: 'deferTriggerMisconfiguration',
      ngCode: 8021,
      shortDescription: 'A @defer block trigger is misconfigured',
    },
  ];
