// BUILD-TIME COMPLETENESS TRIPWIRE for the extended-diagnostic catalog
// (DRIFT-01). This file is TYPE-ONLY and never ships.
//
// WHY THIS FILE EXISTS: the catalog's 18 members live as ONE hand-mirrored
// `as const` list in `./extended-catalog.members` (the D-02 single source of
// truth), because `ExtendedTemplateDiagnosticName` is NOT a public runtime
// export of `@angular/compiler-cli` (absent from the barrel `index.d.ts`, no
// `src/ngtsc/...` subpath in the package `exports` map, `undefined` at runtime).
// A hand-mirrored list can silently drift from the real enum: a future Angular
// release that ADDS, RENAMES, or REMOVES an extended-diagnostic member would
// otherwise leave the catalog silently under-covering (or asserting a member
// that no longer exists) with no failure. This file makes that drift LOUD: it
// deep-imports the REAL enum under classic module resolution and asserts MUTUAL
// set-equality between the enum's string-VALUE union and the `as const` list's
// value union. A member added upstream fails `EnumCoversCatalog`; a member
// removed/renamed upstream fails `CatalogCoversEnum` -- either way,
// `nx typecheck-drift` fails at the offending probe slot instead of shipping a
// stale catalog.
//
// WHY IT NEVER SHIPS AND NEVER BREAKS THE PRODUCTION BUILD: the enum's deep
// specifier only resolves under CLASSIC `moduleResolution: node`, which is why
// this file compiles ONLY under `tsconfig.drift.json` (classic
// `moduleResolution: node` + `ignoreDeprecations: "6.0"` + `noEmit`, run by the
// `typecheck-drift` Nx target). It is EXCLUDED from both `tsconfig.lib.json` and
// `tsconfig.spec.json` by their `src/**/*.drift.ts` glob (under their `nodenext`
// mode the deep import would resolve EMPTY -> TS2305 -> would break
// `nx build`/`nx test`), so build and test never see it and it is not
// `index`-reachable nor in the `files` whitelist that gates the tarball.
//
// NOTE (differs from compiler-cli-types.drift.ts): that sibling drift file
// imports from the BARREL `'@angular/compiler-cli'` (which carries
// `Program`/`EmitFlags`/`UNKNOWN_ERROR_CODE` but NOT this enum). The enum is
// re-exported by the SUB-BARREL
// (`src/ngtsc/diagnostics/index.d.ts`:
//   `export { ExtendedTemplateDiagnosticName } from './src/extended_template_diagnostic_name';`),
// so this file uses the deep specifier below.
//
// SCOPE (DRIFT-01): mutual set-equality of the extended-diagnostic member SET.
// This is a NAME/VALUE-membership guard only; it does NOT pin NG codes, default
// categories, or occurrence counts -- those are asserted at runtime by the
// catalog integration spec against the real compiler.

import { ExtendedTemplateDiagnosticName } from '@angular/compiler-cli/src/ngtsc/diagnostics';

import { EXTENDED_DIAGNOSTIC_MEMBERS } from './extended-catalog.members';

// The PlainTS assignability helper (ZERO new dependency; no `expect-type`/`tsd`),
// vendored identically from `compiler-cli-types.drift.ts`. `To extends From` is
// the constraint -- the type only resolves to `true` when `From` is assignable
// to `To`; a non-assignable pair errors where the alias is instantiated below.
// `To` is an INTENTIONAL phantom type parameter: its `extends From` constraint
// IS the assertion; it is never referenced in the body by design, which
// no-unused-vars flags -- suppress that single, deliberate case.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type AssertAssignable<From, To extends From> = true;

// The two value unions to compare (A3 / RESEARCH: value-union form, because the
// catalog rows ARE keyed on the string VALUES and the runtime assertions use
// those strings -- a value-union comparison is the honest contract; member-NAME
// keys would force the catalog to carry SCREAMING_SNAKE keys it never uses).
type EnumValues = `${ExtendedTemplateDiagnosticName}`;
type CatalogValues = (typeof EXTENDED_DIAGNOSTIC_MEMBERS)[number];

// Mutual set-equality: catalog subset of enum AND enum subset of catalog.
// A member REMOVED/RENAMED upstream (present in the catalog, gone from the enum)
// fails CatalogCoversEnum; a member ADDED upstream (in the enum, missing from the
// catalog) fails EnumCoversCatalog.
type CatalogCoversEnum = AssertAssignable<CatalogValues, EnumValues>; // enum superset of catalog values
type EnumCoversCatalog = AssertAssignable<EnumValues, CatalogValues>; // catalog superset of enum values

void (0 as unknown as CatalogCoversEnum);
void (0 as unknown as EnumCoversCatalog);
