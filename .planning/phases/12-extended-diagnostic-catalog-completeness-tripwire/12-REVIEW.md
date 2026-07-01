---
phase: 12-extended-diagnostic-catalog-completeness-tripwire
reviewed: 2026-07-01T09:45:00Z
depth: deep
files_reviewed: 45
files_reviewed_list:
  - packages/angular-typechecker/src/core/extended-catalog.members.ts
  - packages/angular-typechecker/src/core/extended-catalog.drift.ts
  - packages/angular-typechecker/src/core/extended-catalog.integration.spec.ts
  - packages/angular-typechecker/tsconfig.drift.json
  - packages/angular-typechecker/project.json
  - fixtures/extended-batch-expression/error.component.ts
  - fixtures/extended-batch-expression/error.component.html
  - fixtures/extended-batch-expression/tsconfig.app.json
  - fixtures/extended-batch-fn/error.component.ts
  - fixtures/extended-batch-fn/error.component.html
  - fixtures/extended-batch-fn/tsconfig.app.json
  - fixtures/extended-batch-structural/error.component.ts
  - fixtures/extended-batch-structural/error.component.html
  - fixtures/extended-batch-structural/tsconfig.app.json
  - fixtures/extended-content-projection/child.component.ts
  - fixtures/extended-content-projection/child.component.html
  - fixtures/extended-content-projection/parent.component.ts
  - fixtures/extended-content-projection/parent.component.html
  - fixtures/extended-content-projection/tsconfig.app.json
  - fixtures/extended-defer-trigger/error.component.ts
  - fixtures/extended-defer-trigger/error.component.html
  - fixtures/extended-defer-trigger/tsconfig.app.json
  - fixtures/extended-ngfor-let/error.component.ts
  - fixtures/extended-ngfor-let/error.component.html
  - fixtures/extended-ngfor-let/tsconfig.app.json
  - fixtures/extended-skip-hydration/error.component.ts
  - fixtures/extended-skip-hydration/error.component.html
  - fixtures/extended-skip-hydration/tsconfig.app.json
  - fixtures/extended-unused-standalone-imports/error.component.ts
  - fixtures/extended-unused-standalone-imports/error.component.html
  - fixtures/extended-unused-standalone-imports/tsconfig.app.json
  - fixtures/ng-baseline-extra/missing-pipe.component.ts
  - fixtures/ng-baseline-extra/ngmodule-id.module.ts
  - fixtures/ng-baseline-extra/non-literal.component.ts
  - fixtures/ng-baseline-extra/param-token.component.ts
  - fixtures/ng-baseline-extra/schema-attr.component.ts
  - fixtures/ng-baseline-extra/shadow-dom.component.ts
  - fixtures/ng-baseline-extra/undecorated-base.component.ts
  - fixtures/ng-baseline-extra/undecorated-provider.component.ts
  - fixtures/ng-baseline-extra/tsconfig.app.json
  - fixtures/ng-baseline-import-cycle/cycle.module.ts
  - fixtures/ng-baseline-import-cycle/first.component.ts
  - fixtures/ng-baseline-import-cycle/second.component.ts
  - fixtures/ng-baseline-import-cycle/tsconfig.app.json
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
status: clean
---

# Phase 12: Code Review Report

**Reviewed:** 2026-07-01T09:45:00Z
**Depth:** deep
**Files Reviewed:** 45
**Status:** clean

## Summary

Reviewed the extended-diagnostic catalog completeness-tripwire phase: the single
source-of-truth member list, the type-level drift tripwire, the data-driven
catalog integration spec, the drift tsconfig, the `typecheck-drift` target
wiring, and 40 deliberately-broken fixture files.

The adversarial stance assumed defects and looked specifically for: catalog rows
that could silently pass (zero-count filters), decoupling of the member field
type from the source-of-truth list, an NG8011 assertion that wrongly expects it
to stay a Warning under `defaultCategory:"error"`, drift between the tripwire's
asserted set and the members list, wrong/extra/absent fixture diagnostics, a
tripwire that is a no-op, and non-ASCII characters. None were found. The lockstep
chain (members list <-> type-level tripwire <-> runtime structure guard <-> per-row
assertions) is intact and load-bearing.

Verification performed (not merely read):

- **All 18 NG codes cross-checked against upstream truth.** Every `ngCode` in
  `CATALOG` matches `@angular/compiler-cli@22.0.4`
  `src/ngtsc/diagnostics/src/error_code.d.ts` (8011, 8021, 8101-8117 as mapped).
  All 12 baseline codes (TS2322, TS2339, NG1001/2003/2005/2007/2009/3003/6100/
  8001/8002/8004) match too.
- **Member list is exactly the enum, in declaration order.** `EXTENDED_DIAGNOSTIC_MEMBERS`
  equals the 18-member `ExtendedTemplateDiagnosticName` string-value union in
  `extended_template_diagnostic_name.d.ts`, same order.
- **The spec actually passes against the real compiler.** `npx vitest run
  extended-catalog.integration.spec.ts` -> 33 passed (18 extended rows + 1
  structure guard + 2 promotion + 12 baseline). This proves each fixture fires
  its target code exactly once at the asserted category, and that NG8101 promotes
  from Warning to Error under `defaultCategory:"error"` (D-08/CAT-02).
- **The drift tripwire is NOT a no-op (both directions).** Removing a member from
  the list -> `tsc -p tsconfig.drift.json` fails `EnumCoversCatalog` (TS2344);
  adding a spurious member -> fails `CatalogCoversEnum` (TS2344). Both exit
  non-zero (real `tsc` exit code 2, confirmed after isolating the earlier `tail`
  exit-code masking), so the `nx:run-commands` `typecheck-drift` gate fails
  loudly. The clean state exits 0. Member file restored byte-identical to HEAD
  after the probes.
- **NG8011 is modeled correctly.** Its row is a normal Warning-default member
  (`ts.DiagnosticCategory.Warning`), not `it.skip`-ped and not asserted to stay a
  Warning under promotion. This matches the D-09 CORRECTED verified behavior.
- **No non-ASCII characters** in any of the 45 files.

No Critical or Warning findings. The three Info items below are minor and
optional.

## Info

### IN-01: `hits[0]?.category` optional-chaining is defensively redundant given the count assert

**File:** `packages/angular-typechecker/src/core/extended-catalog.integration.spec.ts:265-267`
**Issue:** The category assertion `expect(hits[0]?.category).toBe(row.expectedCategory)`
uses optional chaining, but it can never silently pass on an empty `hits`: line
265 (`expect(hits.length).toBe(row.expectedCount)`, with every row's
`expectedCount === 1`) already fails first when `hits` is empty, and even if it
did not, `undefined` would not equal the real `ts.DiagnosticCategory.Warning`
(numeric `1`). This is correct and safe as written -- noted only because the `?.`
reads as if guarding a nullable case the preceding assertion has already
foreclosed. No change required; if anything, `hits[0].category` (non-optional)
would document the invariant more honestly. Not a defect.
**Fix:** Optional; leave as-is, or drop the `?.` to signal that `hits[0]` is
guaranteed present by the prior length assertion.

### IN-02: `expectedCount` is uniformly 1 across all 18 rows -- consider a guard against a future 0

**File:** `packages/angular-typechecker/src/core/extended-catalog.integration.spec.ts:82-233`
**Issue:** Every extended row uses `expectedCount: 1`, which is the safe,
non-vacuous case (a `.filter(...).length === 1` assertion cannot pass without a
real hit). This is currently correct. The latent risk is future maintenance: a
row edited to `expectedCount: 0` would turn its test into a vacuous pass (asserts
the code is absent, and the category line would then read `undefined` and fail --
actually still safe, but the count line alone would pass on "diagnostic never
fired"). No such row exists today.
**Fix:** Optional hardening -- a one-line structure assertion that every
`row.expectedCount >= 1`, alongside the existing declaration-order guard at
lines 239-243, would make the "no vacuous count" property explicit and
regression-proof.

### IN-03: `extended-batch-expression` inline comment references a member-name/value that could drift silently

**File:** `fixtures/extended-batch-expression/error.component.ts:19`
**Issue:** The header comment illustrates NG8114 with the fragment
`{{ (flag ? one : two) }}... see html`, but the actual template line (and the
class member) uses `flag && maybeNull ?? 'fallback'`. The comment fragment is
stale/illustrative and does not match the committed template, which could mislead
a future maintainer about what triggers NG8114 in this fixture. The fixture
itself is correct (the real run confirms NG8114 fires exactly once); only the
prose is imprecise. Fixture comments are not enforced by any test, so this cannot
cause a false pass -- it is a documentation-accuracy nit.
**Fix:** Update the line-19 comment fragment to mirror the actual template
expression (`{{ flag && maybeNull ?? 'fallback' }}`) so the comment and the
`error.component.html` line 9 agree.

---

_Reviewed: 2026-07-01T09:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
