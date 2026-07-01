# Angular Diagnostic Catalog (for CAT-01..05 / TEST-02)

The set of TypeScript + Angular compiler diagnostics the integration tests assert by EXACT
code/category/count. All are exercised on **Angular 22** (`@angular/compiler-cli@22.0.4`).

**Source of truth: the `ExtendedTemplateDiagnosticName` enum, NOT the angular.dev docs.** The
extended-diagnostics section below is driven by the enum shipped in
`@angular/compiler-cli` (the build/test-time source of truth), because that is exactly what
the executor observes and what the DRIFT-01 completeness tripwire consumes. The public
angular.dev/extended-diagnostics page lists only **16** members and OMITS two the enum
carries (NG8011 `controlFlowPreventingContentProjection` and NG8112 `unusedLetDeclaration`),
so driving membership from the docs would silently under-cover. Where the docs and the enum
disagree, the enum wins. The introduction-version column is a coverage taxonomy (which
Angular major first shipped each check), not a multi-version test matrix.

> VERIFY ON UPGRADE: the enum is the moving target. When bumping `@angular/compiler-cli`,
> re-confirm the members + NG codes against
> `node_modules/@angular/compiler-cli/src/ngtsc/diagnostics/src/extended_template_diagnostic_name.d.ts`
> and `.../error_code.d.ts`. The DRIFT-01 type-level tripwire
> (`packages/angular-typechecker/src/core/extended-catalog.drift.ts`, run by the
> `typecheck-drift` Nx target) fails CI LOUDLY on any add/rename/remove precisely because the
> docs page lags and omits members -- treat a red tripwire as the authoritative signal that
> the enum moved, then update the catalog `it.each` table and this doc together.

**Scope boundary:** Angular **runtime** errors (NG0xxx, listed at https://angular.dev/errors)
are OUT of scope -- a static no-emit type-check cannot detect them. The relevant
**compile-time** compiler errors are the baseline NG codes below (a subset of
angular.dev/errors); we capture them via the compiler's emitted diagnostics on fixtures, not
by enumerating the errors reference.

## Baseline diagnostics (no `extendedDiagnostics` needed; present since v13 unless noted)

Asserted by exact code. Raw TypeScript codes (TS2322, TS2339) assert as bare numbers; NG
codes assert through the `NG()` encoder (`NG(8001) === -998001`), never as bare positives.
Count by `ts.DiagnosticCategory`, never by code sign.

| Code | Introduced | Category | Scenario / trigger |
|------|-----------|----------|--------------------|
| TS2322 | TypeScript | Error | Plain type-assignment error in a component class |
| TS2339 | TypeScript | Error | Template references a missing member (template type-check) |
| NG2003 | v13 | Error | Missing injection token (primitive constructor param) |
| NG2005 | v13 | Error | Undecorated class passed as a provider |
| NG2007 | v13 | Error | Undecorated base class uses Angular features |
| NG2009 | v13 | Error | Invalid Shadow DOM selector (ViewEncapsulation.ShadowDom, selector missing hyphen) |
| NG1001 | v13 | Error | Component metadata argument not a literal |
| NG3003 | v13 | Error | Import cycle detected (directive/pipe relationship forcing an un-handleable cyclic import) |
| NG6100 | v14 | Warning | `@NgModule({ id: module.id })` anti-pattern (note the `WARN_` prefix -- counts in `warningCount`) |
| NG8001 | v13 | Error | Unknown component/element |
| NG8002 | v13 | Error | Invalid attribute/directive usage (e.g. `[(ngModel)]` without importing the directive) |
| NG8004 | v13 | Error | Missing pipe declaration |

Codes verified against `@angular/compiler-cli@22.0.4`
`src/ngtsc/diagnostics/src/error_code.d.ts`. Note: the previously listed "aliases" for NG8004,
NG2005, and NG3003 do NOT appear as distinct alias numbers in v22.0.4 `error_code.d.ts` and have
been dropped -- use the primary codes only. NG6100 is a **Warning** (the `WARN_` prefix in
`WARN_NGMODULE_ID_UNNECESSARY`); its catalog row expects `DiagnosticCategory.Warning` and it is
tallied in `warningCount`.

## Extended template diagnostics -- the authoritative 18-member `ExtendedTemplateDiagnosticName` set

These require `strictTemplates: true`. **All 18 default to `DiagnosticCategory.Warning`** and
**all 18 are promotable** to `Error` via `angularCompilerOptions.extendedDiagnostics.defaultCategory: "error"`
(or per-check via `extendedDiagnostics.checks.<name>: "error" | "warning" | "suppress"`).

The rows are in ENUM DECLARATION ORDER (which differs from code order -- e.g. NG8011 sits at
declaration index 11 but its numeric code is below NG8101). Each row carries the enum string
value (the key the catalog `it.each` table and the tripwire compare), the NG code, the default
category, and the introduction version.

| # | Enum member (string value) | NG code | Default category | Introduced |
|---|----------------------------|---------|------------------|-----------|
| 0 | invalidBananaInBox | NG8101 | Warning | v13 |
| 1 | nullishCoalescingNotNullable | NG8102 | Warning | v13 |
| 2 | optionalChainNotNullable | NG8107 | Warning | v14 |
| 3 | missingControlFlowDirective | NG8103 | Warning | v14 |
| 4 | missingStructuralDirective | NG8116 | Warning | v19 (19.2.0; docs listed it at v20) |
| 5 | textAttributeNotBinding | NG8104 | Warning | v14 |
| 6 | uninvokedFunctionInEventBinding | NG8111 | Warning | v18 |
| 7 | missingNgForOfLet | NG8105 | Warning | v14 |
| 8 | suffixNotSupported | NG8106 | Warning | v14 |
| 9 | skipHydrationNotStatic | NG8108 | Warning | v16 |
| 10 | interpolatedSignalNotInvoked | NG8109 | Warning | v17 |
| 11 | controlFlowPreventingContentProjection | NG8011 | Warning (out-of-band: no `extended/checks/` factory; STILL promotable) | v17 |
| 12 | unusedLetDeclaration | NG8112 | Warning (enum-only: angular.dev docs OMIT it) | v18 |
| 13 | uninvokedTrackFunction | NG8115 | Warning | v20 |
| 14 | unusedStandaloneImports | NG8113 | Warning (out-of-band: no `extended/checks/` factory; STILL promotable) | v19 |
| 15 | unparenthesizedNullishCoalescing | NG8114 | Warning | v20 |
| 16 | uninvokedFunctionInTextInterpolation | NG8117 | Warning | v20 |
| 17 | deferTriggerMisconfiguration | NG8021 | Warning | v21 |

Verified against `@angular/compiler-cli@22.0.4`
`src/ngtsc/diagnostics/src/extended_template_diagnostic_name.d.ts` (enum + declaration order)
and `.../src/error_code.d.ts` (each NG code).

**Set identity:** the 18 members = {NG8011, NG8021} UNION {NG8101..NG8117 MINUS NG8110}. A
numeric "NG81xx" filter is provably WRONG -- it would miss NG8011 and NG8021 and would wrongly
include NG8110 and NG8118. Drive the catalog and the tripwire from the enum, never from a code
range.

**NG8110 and NG8118 are `ErrorCode`s but NOT configurable extended diagnostics** (they are not
in the enum): NG8110 = `UNSUPPORTED_INITIALIZER_API_USAGE`, NG8118 =
`FORBIDDEN_REQUIRED_INITIALIZER_INVOCATION`. Their code numbers fall inside the NG81xx range but
they are ordinary compiler `ErrorCode`s, not members of `ExtendedTemplateDiagnosticName`, so
they are neither in this table nor promotable via `extendedDiagnostics`.

### Promotability: emission mechanism, not a promotability split

All 18 are promotable. The only real distinction among them is the emission MECHANISM:

- **16 have an `extended/checks/<name>/` factory.** These read
  `extendedDiagnostics.checks[name] ?? defaultCategory ?? Warning`.
- **2 are emitted out-of-band (no factory): NG8011 (`controlFlowPreventingContentProjection`)
  and NG8113 (`unusedStandaloneImports`).** They are added to Angular's
  `SUPPORTED_DIAGNOSTIC_NAMES` manually and BOTH honor `extendedDiagnostics.defaultCategory`
  (and per-check config) exactly like the factory checks. NG8113 is the documented-yet-out-of-band
  twin that proves "no factory" does NOT mean "not configurable."

So NG8011 is framed as **emitted out-of-band but STILL promotable** -- it honors
`defaultCategory` like every other member. A test asserting NG8011 stays a `Warning` under
`defaultCategory: "error"` would FAIL against real Angular 22.0.4 (it emits an `Error`, single
diagnostic, code `-998011`). This corrects an earlier framing that treated NG8011 as an
un-promotable exception (verified via docs + `@angular/compiler-cli@22.0.4` source + an empirical
`runTypecheck` probe: NG8011 = `Warning` by default, = `Error` under `defaultCategory: "error"`).

**Introduction-version provenance + method:** the "Introduced" column is derived by diffing the
versioned extended-diagnostics docs across majors -- `https://v<NN>.angular.dev/extended-diagnostics`
(older majors on `angular.io`; the unversioned `angular.dev/extended-diagnostics` is the current
= v22 set) -- cross-checked against the Angular compiler `git tag --contains` signal, which is
authoritative because the docs page can LAG the compiler release: NG8103-NG8107 shipped in
**14.1.0** though the v14 overview page only listed NG8101/NG8102 (do NOT re-date them to v15),
and NG8116 shipped in **19.2.0** but appeared in the docs only at v20. The two enum-only members
(NG8011, NG8112) are absent from the docs list entirely, so their introduction majors are carried
from the compiler history and are not independently re-verified against the docs (the enum, not
the intro-version, is the membership authority -- the tripwire keys on the enum). To extend for a
future major, prefer `git tag --contains <commit>` on the compiler source over the docs-diff.

## Special test cases (behavior, not a single code)

- **Dependency filtering**: `main-lib` (clean) depends on `dependency-lib` (has a type error).
  Default (`excludeLibsFromTypeCheck`/no `includeDeps`): `main-lib` PASSES (dependency error
  filtered). With `includeDeps: true`: `main-lib` FAILS. (EXE-04.)
- **Complete gather (no short-circuit)**: a component with BOTH a plain TS error AND a
  template/extended error -> the executor reports BOTH in one run (proves the unconditional
  gatherer; `ngc --noEmit` would report only the TS error). (ENG-02.)
- **Dependency-error-busts-cache**: changing a dependency's source type must invalidate the
  consumer's cached typecheck result. (TEST-04 / EXE-06.)
- **Clean project**: no diagnostics -> success, exit 0.

## Test organization: a single enum-keyed `it.each` catalog + a completeness tripwire

The catalog is a SINGLE data-driven spec, NOT a per-introduction-version file split, and it uses
committed static fixtures rather than programmatic AST mutation of generated fixtures. Two
coupled pieces keep the covered set honest (D-01, D-02, D-05):

1. **One enum-keyed `it.each` catalog spec** (`extended-catalog.integration.spec.ts`) holds an
   18-row table keyed on the enum members, with introduction-version carried as a ROW FIELD
   (not a per-version file). Each row maps `enum member -> { NG code, expected
   DiagnosticCategory, occurrence count, introduction-version, fixture ref, optional
   skip-reason }`. Assertions run `runTypecheck({ tsConfigPath })` against a committed
   `fixtures/<scenario>/` tsconfig, find the diagnostic by `d.code === NG(row.ngCode)`, assert
   `d.category === row.expectedCategory`, and assert the exact occurrence count. Any member not
   reproducible by a static Angular 22.0.4 fixture is `it.skip` WITH A WRITTEN REASON and its
   row STAYS in the table (so the tripwire stays honest). A sibling `it.each` table asserts the
   baseline TS/NG codes by exact code. This SUPERSEDES the old catalog's guidance to mirror a
   per-introduction-version file split (one `*.integration.spec.ts` per Angular major).

2. **A type-level enum-vs-table completeness tripwire** (`extended-catalog.drift.ts`, run by the
   existing `typecheck-drift` Nx target -- NOT a runtime Vitest spec, because
   `ExtendedTemplateDiagnosticName` is not a public runtime export). The catalog rows and the
   tripwire's asserted set derive from ONE `as const` declaration (`EXTENDED_DIAGNOSTIC_MEMBERS`),
   and the tripwire asserts mutual set-equality between that list and the real enum (imported
   deep, under classic module resolution). A member added, renamed, or removed upstream fails the
   assertion, so a future Angular release cannot silently under-cover.

Fixtures are batched per program where practical (fewer cold `performCompilation` runs = cheaper
CI); a batch is split only when an exact occurrence-count assertion would collide. Assert exact
codes + categories + counts, not just pass/fail.
