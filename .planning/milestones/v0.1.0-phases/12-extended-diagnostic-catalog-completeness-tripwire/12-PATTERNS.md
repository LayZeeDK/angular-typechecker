# Phase 12: Extended-diagnostic catalog + completeness tripwire - Pattern Map

**Mapped:** 2026-07-01
**Files analyzed:** 8 code/config files (3 NEW, 3 EDIT, 3 DELETE-fold) + ~8-10 NEW fixtures + 1 doc
**Analogs found:** 8 / 8 (every new/edited code file has an exact or role-match analog already in the repo)

> Build ON the RESEARCH.md "Recommended file layout", fixture-batching map, and Code Examples -- this
> document does NOT repeat them; it pins each new file to a CONCRETE existing analog with exact
> paths + line numbers the executor mirrors.

> **CORRECTNESS GUARD (carry into every plan): NG8011 (`controlFlowPreventingContentProjection`)
> IS promotable** (CONTEXT.md D-09 CORRECTED 2026-07-01; triple-verified docs+source+runtime).
> Treat NG8011 as a NORMAL promotable catalog member (default `Warning`, promotable to `Error`
> via `extendedDiagnostics.defaultCategory: "error"`). Do NOT map, write, or document any
> "NG8011 stays-Warning-under-promotion" / "NG8011 not promotable" pattern -- such a test would
> FAIL against real Angular 22.0.4. The only real NG8011/NG8113 distinction is emission MECHANISM
> (out-of-band, no `extended/checks/` factory), NOT promotability.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/extended-catalog.members.ts` (NEW) | model / source-of-truth constant | transform (consumed by spec + tripwire) | `src/core/diagnostic-codes.ts` (dependency-free exported const module) | role-match |
| `src/core/extended-catalog.integration.spec.ts` (NEW) | test (integration) | request-response (fixture -> `runTypecheck` -> assert) | `extended.angular13.integration.spec.ts` + `run-typecheck.integration.spec.ts` (`describe.each`) + `baseline.angular13.integration.spec.ts` | exact |
| `src/core/extended-catalog.drift.ts` (NEW) | test (type-level tripwire) | transform (type assertion, `noEmit`) | `src/core/compiler-cli-types.drift.ts` | exact |
| `fixtures/<batch-*>/` + `fixtures/<own-program>/` (NEW ~8) | test fixture | file-I/O (committed source fed to compiler) | `fixtures/extended-v13/`, `fixtures/extended-promoted/` | exact |
| `fixtures/ng-baseline-extra/` (NEW 1-2) | test fixture | file-I/O | `fixtures/ng-baseline/`, `fixtures/ts-baseline/` | exact |
| `tsconfig.drift.json` (EDIT) | config | n/a | self (existing `files` array) | exact |
| `project.json` `typecheck-drift` target (EDIT) | config | n/a | self (existing `inputs[]`) | exact |
| `extended.angular13.integration.spec.ts` (DELETE-fold) | test | n/a | folded into catalog (D-07) | n/a |
| `extended.promotion.integration.spec.ts` (DELETE-fold) | test | n/a | folded into catalog (D-07/D-08) | n/a |
| `baseline.angular13.integration.spec.ts` (DELETE-fold) | test | n/a | folded into catalog baseline table (D-06) | n/a |
| `.planning/research/DIAGNOSTIC-CATALOG.md` (EDIT) | doc | n/a | NO code analog -- doc rewrite (CAT-05) | n/a (doc) |

---

## Pattern Assignments

### `src/core/extended-catalog.members.ts` (NEW) -- the single `as const` 18-member list

**Role:** model / source-of-truth constant. **Data flow:** transform.
**Analog:** `packages/angular-typechecker/src/core/diagnostic-codes.ts` (a production-importable,
intentionally DEPENDENCY-FREE module of exported consts -- see its header lines 18-24).

**Why this analog:** `diagnostic-codes.ts` is the established pattern for "a dependency-free module
holding canonical constants that BOTH the test tier and other code consume." `extended-catalog.members.ts`
plays the same role for the 18 member-VALUE strings (D-02 single source of truth), consumed by BOTH the
runtime `it.each` table AND the type-level tripwire. Like `diagnostic-codes.ts`, it must NOT import
`@angular/compiler-cli` (the whole point of D-01 is that the enum is unreachable at runtime/under
`nodenext`; the members list is a hand-mirrored `as const`, and the tripwire is what keeps it honest).

**The list MUST be `as const` and in ENUM DECLARATION ORDER** (verified against the installed enum,
`node_modules/@angular/compiler-cli/src/ngtsc/diagnostics/src/extended_template_diagnostic_name.d.ts`,
18 members). Concrete shape to author (string VALUES, not SCREAMING_SNAKE keys -- A3 / RESEARCH Code
Examples chose value-union comparison so the runtime table keys align):

```typescript
// Mirrors the dependency-free exported-const idiom of ./diagnostic-codes.ts.
// The single source of truth (D-02): consumed by extended-catalog.integration.spec.ts
// (it.each row keys) AND extended-catalog.drift.ts (type-level set-equality vs the real enum).
// ENUM DECLARATION ORDER, verified vs @angular/compiler-cli@22.0.4
// src/ngtsc/diagnostics/src/extended_template_diagnostic_name.d.ts (18 members).
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
```

**Doc-header pattern to copy:** open with a `/** ... */` block explaining WHY it is dependency-free and
WHO consumes it -- exactly as `diagnostic-codes.ts:1-24` does (the header is load-bearing in this repo;
reviewers expect the "why vendored / why no compiler-cli import" rationale inline).

---

### `src/core/extended-catalog.integration.spec.ts` (NEW) -- the 18-row `it.each` + sibling baseline `it.each`

**Role:** test (integration). **Data flow:** request-response (`runTypecheck({ tsConfigPath })` -> assert on `CoreResult`).
**Analogs (compose all three):**
- `src/core/extended.angular13.integration.spec.ts` -- the find-by-code + assert-category single-row idiom.
- `src/core/run-typecheck.integration.spec.ts` -- the `describe.each([...])` parameterization idiom (lines 67-104).
- `src/core/baseline.angular13.integration.spec.ts` -- the sibling baseline-codes table (extend/absorb, D-06).

**Imports + path-resolution pattern** (copy verbatim from `extended.angular13.integration.spec.ts:1-30`):

```typescript
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { NG } from './diagnostic-codes';
import { runTypecheck } from './run-typecheck';
import { EXTENDED_DIAGNOSTIC_MEMBERS } from './extended-catalog.members';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspaceRoot = join(packageRoot, '..', '..');
// each fixture tsconfig path is join(workspaceRoot, 'fixtures', '<scenario>', 'tsconfig.app.json')
```

The `packageRoot`/`workspaceRoot` two-step (`'..','..'` then `'..','..'`) is the cwd-independent fixture
resolver every integration spec uses -- copy it exactly (`extended.angular13.integration.spec.ts:22-23`).

**Core find-by-code + assert-category idiom** (from `extended.angular13.integration.spec.ts:33-44`):

```typescript
const result = await runTypecheck({ tsConfigPath: extendedV13TsConfig });
const banana = result.diagnostics.find((diagnostic) => diagnostic.code === NG(8101));
expect(banana).toBeDefined();
expect(banana?.category).toBe(ts.DiagnosticCategory.Warning);
expect(result.warningCount).toBeGreaterThanOrEqual(1);
expect(result.errorCount).toBe(0);
```

For the catalog's EXACT-COUNT requirement (CAT-01: code + category + occurrence count), use `.filter`
+ `.toBe(expectedCount)` rather than `.find`, then assert `hits[0]?.category` (RESEARCH Code Examples
sketch, lines 307-318). Count by `ts.DiagnosticCategory`, NEVER by code sign (L-4; diagnostic-codes.ts
header lines 22-24).

**`describe.each` parameterization idiom** (from `run-typecheck.integration.spec.ts:67-70`):

```typescript
describe.each([
  ['app tsconfig', appTsConfig],
  ['local-library tsconfig', libTsConfig],
])('runTypecheck end-to-end (%s)', (_label, tsConfigPath) => { /* it(...) blocks */ });
```

For the catalog, parameterize over `CATALOG` ROW OBJECTS (not tuples). The `it.skip`-when-`skipReason`
gate (D-05/CAT-04) is `const maybe = row.skipReason ? it.skip : it;` (RESEARCH lines 308-310). RESEARCH
Reproducibility analysis projects ZERO `it.skip` rows -- but the row STAYS in `CATALOG` regardless of
skip (the tripwire consumes the LIST, not the test outcome).

**Sibling baseline table** (extend `baseline.angular13.integration.spec.ts:38-56`): same `runTypecheck`
call, but raw TS codes assert as bare numbers (`const TS2339 = 2339; expect(codes).toContain(TS2339);`,
lines 20/44) while NG codes route through `NG()` (`expect(codes).toContain(NG(8001));`, line 53). NG6100
is a **Warning** (`WARN_` prefix) -- its baseline row must expect `DiagnosticCategory.Warning` and count
in `warningCount` (RESEARCH Baseline Codes section). The 12 baseline codes: TS2322, TS2339, NG2003,
NG2005, NG2007, NG2009, NG1001, NG3003, NG6100, NG8001, NG8002, NG8004 (D-06).

**Promotion row** (CAT-02/D-08): fold `extended.promotion.integration.spec.ts:37-61` -- the SAME NG8101
shape against `fixtures/extended-promoted/tsconfig.app.json`, asserting `ts.DiagnosticCategory.Error` +
`errorCount >= 1` + the count invariant `errorCount + warningCount <= diagnostics.length`.

**Fold note (D-07):** the three folded specs (`extended.angular13`, `extended.promotion`,
`baseline.angular13`) are DELETED after their assertions land in the catalog -- not left as dead
duplicates (one catalog of record). Update TESTING.md's "(10 `.integration.spec.ts` files)" count
(`.planning/codebase/TESTING.md:46`) in this phase (RESEARCH Open Question 3).

---

### `src/core/extended-catalog.drift.ts` (NEW) -- the type-level enum-vs-table completeness tripwire

**Role:** test (type-level). **Data flow:** transform (`noEmit`, never ships).
**Analog (EXACT):** `packages/angular-typechecker/src/core/compiler-cli-types.drift.ts` -- mirror its
`AssertAssignable<From, To extends From>` helper (line 49) + the classic-resolution deep-import of REAL
`@angular/compiler-cli` types + the `void (0 as unknown as Probe)` instantiation idiom (lines 99-100).

**Header pattern to copy:** `compiler-cli-types.drift.ts:1-33` opens with a long block explaining (1) WHY
the file exists, (2) WHY it never ships / never breaks the production build (resolves only under classic
`node10` resolution, compiles ONLY under `tsconfig.drift.json`, excluded from lib/spec, not `index`-reachable),
(3) its SCOPE. Author an equivalent header for the new file: it asserts MUTUAL set-equality between the
`as const` member-VALUE union and the real enum's string-VALUE union, run by `typecheck-drift`.

**The assertion-helper + instantiation idiom** (copy from `compiler-cli-types.drift.ts:49, 57-84, 99-100`):

```typescript
// D-03 PlainTS helper, ZERO new dependency (NOT expect-type/tsd). To extends From
// only resolves to `true` when From is assignable to To; a non-assignable pair errors
// where the alias is instantiated.
type AssertAssignable<From, To extends From> = true;

// ... type aliases ...

void (0 as unknown as CatalogCoversEnum);
void (0 as unknown as EnumCoversCatalog);
```

**Deep-import specifier (VERIFIED 2026-07-01):** the barrel `@angular/compiler-cli` index.d.ts does NOT
re-export `ExtendedTemplateDiagnosticName` (RESEARCH Pitfall 3); the SUB-BARREL does. Verified:
`node_modules/@angular/compiler-cli/src/ngtsc/diagnostics/index.d.ts` line:
`export { ExtendedTemplateDiagnosticName } from './src/extended_template_diagnostic_name';`. So the import is:

```typescript
import { ExtendedTemplateDiagnosticName } from '@angular/compiler-cli/src/ngtsc/diagnostics';
```

This resolves ONLY under classic `moduleResolution: node` (the regime `tsconfig.drift.json` uses).
NOTE this DIFFERS from `compiler-cli-types.drift.ts`, which imports from the BARREL (`'@angular/compiler-cli'`,
line 35) -- the barrel carries `Program`/`EmitFlags`/`UNKNOWN_ERROR_CODE` but NOT the enum. There is no
existing deep-`src/`-import precedent in the repo (RESEARCH verified `git grep` found none), so the
executor MUST confirm the specifier compiles by running `nx typecheck-drift angular-typechecker` in the
first plan (Assumption A2). Fallback leaf path if the sub-barrel fails:
`'@angular/compiler-cli/src/ngtsc/diagnostics/src/extended_template_diagnostic_name'`.

**The mutual set-equality probe** (RESEARCH Code Examples lines 338-349 -- value-union form, A3):

```typescript
import { EXTENDED_DIAGNOSTIC_MEMBERS } from './extended-catalog.members';

type EnumValues = `${ExtendedTemplateDiagnosticName}`;
type CatalogValues = (typeof EXTENDED_DIAGNOSTIC_MEMBERS)[number];

type CatalogCoversEnum = AssertAssignable<CatalogValues, EnumValues>; // enum subset of catalog
type EnumCoversCatalog = AssertAssignable<EnumValues, CatalogValues>; // catalog subset of enum

void (0 as unknown as CatalogCoversEnum);
void (0 as unknown as EnumCoversCatalog);
```

A member ADDED upstream fails `EnumCoversCatalog`; a member REMOVED/RENAMED upstream fails
`CatalogCoversEnum` (loud `typecheck-drift` failure -- DRIFT-01). Keep the file named `*.drift.ts` so the
existing `src/**/*.drift.ts` exclude glob keeps it out of build/test/tarball (verified
`tsconfig.lib.json:18`, `tsconfig.spec.json:29`).

---

### NEW fixtures (`fixtures/<scenario>/`) -- ~8 batched/own-program + 1-2 baseline

**Role:** test fixture. **Data flow:** file-I/O (committed static source fed to the real compiler).
**Analogs (EXACT):** `fixtures/extended-v13/` (warning-default) and `fixtures/extended-promoted/`
(promoted-to-error). Each is a FLAT directory at the workspace root with three files:
`tsconfig.app.json` + `<name>.component.ts` + `<name>.component.html`.

**`tsconfig.app.json` shape to mirror** (copy `fixtures/extended-v13/tsconfig.app.json` verbatim, vary
only `files` + the optional `extendedDiagnostics.defaultCategory`):

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "target": "es2022",
    "module": "preserve",
    "moduleResolution": "bundler",
    "strict": true,
    "emitDecoratorMetadata": false,
    "experimentalDecorators": false
  },
  "angularCompilerOptions": {
    "strictTemplates": true
  },
  "files": ["<name>.component.ts"]
}
```

The `../../tsconfig.base.json` relative path assumes the fixture sits ONE level under `fixtures/`
(i.e. `fixtures/<scenario>/`) -- every existing extended/baseline fixture is flat. If a batched fixture
uses subdirectories (e.g. a two-component setup for NG8011 content-projection), recompute the `extends`
depth accordingly. The promotion variant adds `"extendedDiagnostics": { "defaultCategory": "error" }`
(copy `fixtures/extended-promoted/tsconfig.app.json:12-17`) -- already covered by reusing the existing
`extended-promoted` fixture, so no NEW promotion fixture is needed (D-08).

**Component + template shape to mirror** (`fixtures/extended-v13/error.component.ts:21-29` +
`error.component.html`):

```typescript
import { Component } from '@angular/core';

// <header: which NG code this triggers, its default category, the EXACT trigger,
//  and "this diagnostic is the ONLY diagnostic (no incidental TS/NG error)">
@Component({
  selector: '<scenario>',
  standalone: true,
  templateUrl: './error.component.html',
})
export class <Scenario>Component {
  // class members chosen so ONLY the target diagnostic fires
}
```

**Critical fixture-authoring rule** (copy the discipline from `extended-v13/error.component.ts:18-20`):
every class member referenced in the template must be valid so the TARGET diagnostic is the ONLY
diagnostic (no incidental TS error pollutes the exact-count assertion). For BATCHED fixtures (RESEARCH
batching map, Batches A-D): each batched code must have exactly one clean trigger and produce a
DETERMINISTIC occurrence count -- split a batch the moment a count collides (D-03; RESEARCH Pitfall 4).
Do NOT add `@ts-nocheck` (the diagnostic IS the fixture input). Fixtures live at the workspace root and
are kept out of the plugin build by `tsconfig.lib.json`'s `include: ["src/**/*.ts"]` scope
(`extended-v13/error.component.ts:4-7`).

**Batching map (mirror, do not re-derive):** RESEARCH "Fixture-batching map" (lines 163-181) assigns the
~13 uncovered extended members to 4 batches (A: interpolation/expression family; B: structural/control-flow;
C: event/track function; D: `@let`) + 4 own-programs (8108 skipHydrationNotStatic, 8113 unusedStandaloneImports,
8021 deferTriggerMisconfiguration, 8011 controlFlowPreventingContentProjection). Reuse `extended-v13` (8101
warning), `extended-promoted` (8101 promoted), `gate-b-error` (8109 + TS2322). Baseline fixtures: 1-2 new
programs for the 9 uncovered baseline codes (NG2003/2005/2007/2009/1001/3003/6100/8002/8004) -- mirror
`fixtures/ng-baseline/` shape.

> **NG8011 fixture (`controlFlowPreventingContentProjection`, own program):** a two-component setup --
> a parent with an `<ng-content>` projection slot and a child that projects an `@if` block with >1 root
> node into it (RESEARCH Reproducibility line 229; trigger verified `error_code.d.ts:306-319`). It is a
> NORMAL promotable member (default `Warning`); do NOT special-case it as "not promotable".

---

### `tsconfig.drift.json` (EDIT) -- add the new drift file to `files`

**Analog:** self. The existing `files` array has one entry (line 12). Add the new file:

```json
"files": [
  "src/core/compiler-cli-types.drift.ts",
  "src/core/extended-catalog.drift.ts"
]
```

No other change -- the existing `moduleResolution: node` + `ignoreDeprecations: "6.0"` + `noEmit`
compilerOptions (lines 4-7) are exactly the classic-resolution regime the new deep import needs.

---

### `project.json` `typecheck-drift` target (EDIT) -- add the new drift file to `inputs[]`

**Analog:** self. The `typecheck-drift` target `inputs[]` (lines 48-55) lists each drift-relevant file so
Nx cache-invalidates on a change. Add the new file AND its source-of-truth dependency:

```json
"inputs": [
  "{projectRoot}/src/core/compiler-cli-types.drift.ts",
  "{projectRoot}/src/core/compiler-cli-types.ts",
  "{projectRoot}/src/core/extended-catalog.drift.ts",
  "{projectRoot}/src/core/extended-catalog.members.ts",
  "{projectRoot}/tsconfig.drift.json",
  "{workspaceRoot}/tsconfig.base.json",
  { "externalDependencies": ["typescript", "@angular/compiler-cli"] }
]
```

`@angular/compiler-cli` is ALREADY in the `externalDependencies` input (line 54), so the new enum import
is covered for cache invalidation. The `command` (line 58, `tsc --noEmit -p ...tsconfig.drift.json`) needs
NO change -- it compiles all `files` in the drift tsconfig. The CI gate already runs
`nx run-many -t typecheck-drift test -p angular-typechecker` (TESTING.md) -- no `ci.yml` change (consensus D5).

---

### `.planning/research/DIAGNOSTIC-CATALOG.md` (EDIT) -- CAT-05 doc rewrite

**Role:** doc. **NO code analog.** This is a documentation rewrite (D-10..D-12), out of scope for
code-pattern mapping. The planner drives it from RESEARCH.md's authoritative 18-member table (lines 89-108)
+ State of the Art (lines 405-414): full rewrite to the source-verified 18-member set (name + NG code +
category + intro-version), add NG8112, drop the stale 16-entry docs list, the per-version-file-split test
org, the jscodeshift guidance, the alias parentheticals, and the "NG8011 not promotable" framing; note
NG8110/NG8118 are `ErrorCode`s NOT in the enum.

---

## Shared Patterns

### NG-code encoding (every NG assertion routes through `NG()`)
**Source:** `packages/angular-typechecker/src/core/diagnostic-codes.ts:39` (`export const NG = (code) => -990000 - code;`)
**Apply to:** the catalog spec (every extended + NG-baseline row) and the baseline sibling table.
Raw TS codes (TS2322, TS2339) assert as bare numbers; NG codes assert as `NG(8101)`, never bare (L-4 /
Pitfall E). Count by `ts.DiagnosticCategory`, never by code sign (header lines 22-24).

### `runTypecheck` integration entry point
**Source:** `packages/angular-typechecker/src/core/run-typecheck.ts` (returns `CoreResult { diagnostics, errorCount, warningCount, suppressedCount, ... }`)
**Apply to:** every catalog/baseline/promotion row -- `await runTypecheck({ tsConfigPath })`, then assert
off `CoreResult`. One `performCompilation` per fixture (~0.5s cold; the plugin `vitest.config.mts` sets a
30000ms timeout -- keep the catalog in the plugin tier so it inherits that; RESEARCH Pitfall 5).

### Type-level assertion helper (zero new dependency)
**Source:** `packages/angular-typechecker/src/core/compiler-cli-types.drift.ts:49`
(`type AssertAssignable<From, To extends From> = true;`)
**Apply to:** `extended-catalog.drift.ts`. Do NOT add `tsd`/`expect-type` (RESEARCH Don't Hand-Roll).

### Fixture path resolution (cwd-independent)
**Source:** `extended.angular13.integration.spec.ts:22-23`
(`const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..'); const workspaceRoot = join(packageRoot, '..', '..');`)
**Apply to:** the catalog spec for every fixture tsconfig path.

### `*.drift.ts` naming -> auto-excluded from build/test/tarball
**Source:** `tsconfig.lib.json:18` + `tsconfig.spec.json:29` (`"src/**/*.drift.ts"` exclude glob)
**Apply to:** `extended-catalog.drift.ts` -- naming it `*.drift.ts` is what keeps it out of `nx build`/`nx test`
and the published tarball. (Under their `nodenext` mode the deep enum import would resolve EMPTY -> TS2305 ->
break the build; the glob prevents that.)

### Doc-header rationale block (repo convention)
**Source:** `diagnostic-codes.ts:1-24`, `compiler-cli-types.drift.ts:1-33`, `extended-v13/error.component.ts:3-20`
**Apply to:** all three NEW code files + each NEW fixture component. This repo expects a load-bearing
"why this exists / why vendored / what it triggers / this is the ONLY diagnostic" header inline; reviewers
gate on it.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.planning/research/DIAGNOSTIC-CATALOG.md` | doc | n/a | Documentation rewrite (CAT-05), not code -- driven by RESEARCH.md tables, no code analog applies. |

Every NEW/EDITED code file has an exact or role-match analog already in the repo. There is NO new
infrastructure to build (RESEARCH "Key insight": the work is data + one type-level file).

## Metadata

**Analog search scope:** `packages/angular-typechecker/src/core/` (specs + drift + diagnostic-codes),
`packages/angular-typechecker/` (tsconfig.*, project.json), `fixtures/` (all 13 fixture dirs),
`node_modules/@angular/compiler-cli/src/ngtsc/diagnostics/` (enum + sub-barrel, via `rg`/`cat` since gitignored).
**Files scanned (read):** 16 (4 specs, drift file, diagnostic-codes, 4 tsconfigs, project.json, 6 fixture
files, 2 installed `.d.ts`).
**Pattern extraction date:** 2026-07-01

## PATTERN MAPPING COMPLETE

**Phase:** 12 - Extended-diagnostic catalog + completeness tripwire
**Files classified:** 11 (3 NEW code, 3 EDIT config, 3 DELETE-fold specs, ~8-10 NEW fixtures grouped, 1 doc)
**Analogs found:** 8 / 8 code/config files (every new/edited code file has an exact or role-match analog)

### Coverage
- Files with exact analog: 7 (catalog spec, drift file, fixtures x2 families, tsconfig.drift.json, project.json)
- Files with role-match analog: 1 (`extended-catalog.members.ts` -> `diagnostic-codes.ts` const-module pattern)
- Files with no analog: 1 (DIAGNOSTIC-CATALOG.md doc rewrite -- expected, not code)

### Key Patterns Identified
- All NG-code assertions route through `NG()` from `diagnostic-codes.ts`; raw TS codes assert bare; count ALWAYS by `ts.DiagnosticCategory` (L-4), never code sign.
- The catalog spec mirrors `extended.angular13.integration.spec.ts` (find-by-code + assert-category) parameterized via `run-typecheck.integration.spec.ts`'s `describe.each`; baseline sibling extends `baseline.angular13.integration.spec.ts`.
- The tripwire mirrors `compiler-cli-types.drift.ts` (`AssertAssignable<From, To extends From>` + `void (0 as unknown as Probe)`) but imports the enum from the SUB-BARREL `'@angular/compiler-cli/src/ngtsc/diagnostics'` (VERIFIED re-export; barrel does NOT export it) under classic resolution; `*.drift.ts` naming keeps it out of build/test/tarball.
- New fixtures mirror `fixtures/extended-v13/` (flat `tsconfig.app.json` extends `../../tsconfig.base.json` + `strictTemplates: true` + component + template); each fixture engineers its target diagnostic as the ONLY diagnostic for deterministic exact-count assertions; batch per RESEARCH map, split on count collision.
- `EXTENDED_DIAGNOSTIC_MEMBERS` (`as const`, enum-declaration order, 18 string values) is the single source of truth (D-02) consumed by both the spec and the tripwire; dependency-free like `diagnostic-codes.ts`.

### Correctness Guard Carried
- NG8011 IS promotable (D-09 CORRECTED) -- mapped as a NORMAL promotable member; NO "stays-warning-under-promotion" pattern anywhere.

### File Created
`.planning/phases/12-extended-diagnostic-catalog-completeness-tripwire/12-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. The planner can reference each analog (with exact paths + line numbers) in PLAN.md action sections.
