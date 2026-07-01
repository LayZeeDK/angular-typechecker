---
phase: 13-engine-solution-tsconfig-reference-walking
reviewed: 2026-07-01T19:20:00Z
depth: deep
files_reviewed: 30
files_reviewed_list:
  - packages/angular-typechecker/src/core/walk-references.ts
  - packages/angular-typechecker/src/core/run-typecheck.ts
  - packages/angular-typechecker/src/core/filter-diagnostics.ts
  - packages/angular-typechecker/src/executors/angular-typecheck/executor.ts
  - packages/angular-typechecker/src/index.ts
  - nx.json
  - packages/angular-typechecker/src/core/walk-references.spec.ts
  - packages/angular-typechecker/src/core/walk-references.integration.spec.ts
  - packages/angular-typechecker/src/core/config-resolution.integration.spec.ts
  - packages/angular-typechecker/src/core/run-typecheck.spec.ts
  - packages/angular-typechecker/src/core/nx-target-defaults.spec.ts
  - packages/angular-typechecker/src/executors/angular-typecheck/executor.spec.ts
  - e2e/angular-typechecker-cache-e2e/src/cache-busts-on-spec-edit.int.spec.ts
  - libs/typecheck-walk-consumer/src/index.ts
  - libs/typecheck-walk-consumer/src/lib/walk-consumer.component.ts
  - libs/typecheck-walk-consumer/src/lib/walk-consumer.component.spec.ts
  - libs/typecheck-walk-consumer/project.json
  - libs/typecheck-walk-consumer/package.json
  - libs/typecheck-walk-consumer/tsconfig.json
  - libs/typecheck-walk-consumer/tsconfig.lib.json
  - libs/typecheck-walk-consumer/tsconfig.spec.json
  - fixtures/solution-style/error.component.ts
  - fixtures/solution-style/error.component.spec.ts
  - fixtures/solution-style/tsconfig.json
  - fixtures/solution-style/tsconfig.spec.json
  - fixtures/solution-style/tsconfig.app.json
  - fixtures/solution-style-overlap/shared.component.ts
  - fixtures/solution-style-overlap/tsconfig.json
  - fixtures/solution-style-overlap/tsconfig.lib.json
  - fixtures/solution-style-overlap/tsconfig.spec.json
  - fixtures/solution-style-oop/tsconfig.json
  - fixtures/solution-style-empty/tsconfig.json
  - fixtures/solution-style-broken-ref/error.component.ts
  - fixtures/solution-style-broken-ref/tsconfig.json
  - fixtures/solution-style-broken-ref/tsconfig.app.json
  - fixtures/solution-style-selfref/error.component.ts
  - fixtures/solution-style-selfref/tsconfig.json
  - fixtures/solution-style-selfref/tsconfig.app.json
  - README.md
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-07-01T19:20:00Z
**Depth:** deep
**Files Reviewed:** 30
**Status:** issues_found

## Summary

This phase (WALK-01 / WALK-02) adds a solution-tsconfig reference-WALK to the
Angular type-check engine (`walkReferences`), the three-way D-03a split in
`runTypecheck`, the `nx.json` production->default named-input swap, and the
supporting fixtures / consumer-lib / test tiers. I reviewed all 30 files at deep
depth (cross-file import graph, call chains, and behavior against the project's
OWN authoritative signals: `nx test angular-typechecker` and `nx lint
angular-typechecker`).

**The correctness surface is solid.** Every focus-area invariant was verified to
hold, most against the real cold compiler:

- `walkReferences` single-level resolution, canonicalize+dedupe, self-reference
  skip, D-01 module-boundary guard (reuses the SAME `createCanonicalizer` /
  `isUnderDir` -- confirmed by the diff: the only change to `filter-diagnostics.ts`
  is promoting those two helpers from private to `export`, no duplicate
  canonicalizer), the 90002 not-found synth detected by-code-only
  (`=== ng.UNKNOWN_ERROR_CODE`, never `source`/message), fold-and-count continues
  walking survivors, zero-rootNames skip, and the RAW pre-filter/pre-dedupe union
  with SUMMED `rootNamesCount` -- all pass (`walk-references.spec.ts` 11/11,
  `walk-references.integration.spec.ts` 9/9).
- `run-typecheck.ts` three-way split verified: references+>=1-in-project -> walk
  -> single existing `finalize` (basePath = solution dir, `includeDeps` applied
  ONCE, exactly ONE `sortAndDeduplicateDiagnostics` inside `finalize`);
  references+0-in-project -> 90001 none-in-project; no references -> 90001
  empty-project. The COR-01 direct 500 scan/rethrow and the direct-leaf override
  block are byte-unchanged (confirmed by `git diff` -- the split is confined to the
  `rootNames.length === 0` branch). `skippedReferences` is threaded non-empty-only
  (`[]` -> `undefined`).
- Core purity holds: no `console`/`process`/`@nx/devkit` under `src/core/**`
  (the only matches are documentation comments). Logging lives only in
  `executor.ts`.
- Counting uses explicit `DiagnosticCategory` filters, never `length - errorCount`.
- `nx.json`: the WALK-02 swap is `production` -> `default` on BOTH real executor
  keys (`angular-typechecker:angular-typecheck` and
  `@angular-typechecker/angular-typechecker:angular-typecheck`), retaining
  `outputs:[]`, the `{projectRoot}/tsconfig*.json` glob, and `^default`.
- No circular dependency (walk-references -> filter/gather one-way; run-typecheck
  -> walk-references one-way). `ts.sys.useCaseSensitiveFileNames` is correctly a
  boolean property (verified against `typescript.d.ts` `System` interface), not a
  method.
- ASCII-only across every reviewed source, spec, fixture, and README file.

**No BLOCKER-severity defects were found.** The findings below are two genuine
dead-code WARNINGS (confirmed by the project's own ESLint AND by grep -- the `NG`
helper is only referenced inside comments, never called) that CI does NOT catch
because there is no `lint` gate in `ci.yml`, plus four INFO items (advisory-label
imprecision, a fixture `types` inconsistency, and a minor grammar nit).

## Warnings

### WR-01: Dead `NG` helper in `walk-references.integration.spec.ts`

**File:** `packages/angular-typechecker/src/core/walk-references.integration.spec.ts:46`
**Issue:** `const NG = (code: number): number => -990000 - code;` is declared but
never invoked. `git grep "NG("` finds a single occurrence -- inside a comment on
line 39 ("Assert NG codes via the NG() helper") -- and zero call sites. The file
only asserts `TS2322`, `ZERO_ROOT_NAMES` (90001), and `REFERENCE_NOT_FOUND`
(90002); no NG-encoded code is ever asserted. The project's own ESLint flags this:
`46:7 warning 'NG' is assigned a value but never used @typescript-eslint/no-unused-vars`.
This is not editor LSP noise -- it reproduces under `nx lint angular-typechecker`.
It is not caught by CI either: `ci.yml` runs `nx run-many -t typecheck-drift test`
but has no `lint` target, so this dead code will persist unflagged.
**Fix:** Remove the unused helper (and the now-orphaned comment that promises it):
```ts
// delete line 46:
const NG = (code: number): number => -990000 - code;
```
If a future NG-code assertion is planned for this file, add it now so the helper is
live; otherwise drop it.

### WR-02: Dead `NG` helper in `config-resolution.integration.spec.ts`

**File:** `packages/angular-typechecker/src/core/config-resolution.integration.spec.ts:34`
**Issue:** Identical to WR-01. `const NG = (code: number): number => -990000 - code;`
is declared but never called; the only `NG(` occurrence is the comment on line 31.
ESLint reports `34:7 warning 'NG' is assigned a value but never used`. Confirmed by
grep (1 match, in a comment). Same CI-blind-spot as WR-01.
**Fix:** Remove the unused helper:
```ts
// delete line 34:
const NG = (code: number): number => -990000 - code;
```

## Info

### IN-01: A duplicate (non-self) leaf reference is recorded as `reason: 'self-reference'`

**File:** `packages/angular-typechecker/src/core/walk-references.ts:122-133`
**Issue:** The dedupe branch folds two distinct cases -- the genuine self-reference
(`canonicalLeaf === canonicalSolutionPath`) and an already-seen duplicate leaf
(`seenCanonicalLeaves.has(canonicalLeaf)`) -- into a single
`reason: 'self-reference'`. So a solution that lists `./tsconfig.app.json` twice
records the second edge as `self-reference` even though it is a duplicate, not a
self-reference (see the `solution-style-selfref` fixture + the unit spec at
`walk-references.spec.ts:402-405`, which asserts exactly this fold). This is
advisory-only -- the verdict is unchanged (the duplicate is never compiled) -- and
the `SkippedReference.reason` union deliberately has no `'duplicate'` member. The
executor then renders `... was self-reference and was skipped ...` for a plain
duplicate, which is mildly misleading in the operator notice.
**Fix (optional):** If the advisory precision matters, add a `'duplicate'` reason to
the `SkippedReference.reason` union and branch the two conditions:
```ts
if (canonicalLeaf === canonicalSolutionPath) {
  skippedReferences.push({ referencePath: leafPath, reason: 'self-reference' });

  continue;
}

if (seenCanonicalLeaves.has(canonicalLeaf)) {
  skippedReferences.push({ referencePath: leafPath, reason: 'duplicate' });

  continue;
}
```
Otherwise document the fold explicitly in the `reason` doc-comment. Low priority.

### IN-02: `out-of-project` and dedupe ordering can relabel a repeated out-of-project leaf

**File:** `packages/angular-typechecker/src/core/walk-references.ts:135-151`
**Issue:** An out-of-project leaf is added to `seenCanonicalLeaves` (line 136)
BEFORE the boundary guard rejects it (line 144). If the same out-of-project path is
referenced twice, the first edge is recorded `out-of-project` and the second is
recorded `self-reference` (the dedupe branch fires first on the repeat). Purely a
notice-label artifact -- neither edge is ever compiled and the verdict is
unchanged -- so this is INFO, not a bug. Noting it because it compounds IN-01: the
`self-reference` reason is doing triple duty (self, duplicate-in-project,
duplicate-out-of-project).
**Fix:** Same as IN-01 (a distinct `'duplicate'` reason) resolves this too, or
accept the fold and document it. Low priority.

### IN-03: Inconsistent `types` across the solution-style spec-leaf fixtures

**File:** `fixtures/solution-style/tsconfig.spec.json:11`
**Issue:** `fixtures/solution-style/tsconfig.spec.json` sets
`"types": ["vitest/globals", "node"]`, while the parallel spec-leaf fixtures
(`fixtures/solution-style-overlap/tsconfig.spec.json`,
`libs/typecheck-walk-consumer/tsconfig.spec.json`) use `"types": []` and declare
test globals inline. The `solution-style` spec source (`error.component.spec.ts`)
uses NO vitest/node globals -- it only plants a `const specOnly: number = '...'`
TS2322 -- so the `["vitest/globals", "node"]` types are unnecessary here and create
an inconsistent fixture convention. The integration test still passes
(`errorCount === 2`), so this is not a correctness defect, but a future edit that
relies on ambient types resolving would behave differently across the fixtures.
**Fix:** For consistency and to keep the fixture minimal, set
`"types": []` in `fixtures/solution-style/tsconfig.spec.json` (the spec source needs
no ambient types). Cosmetic; verify the integration spec still reports exactly the
two planted TS2322 after the change.

### IN-04: Awkward grammar in the skipped-reference advisory (`was not-found`)

**File:** `packages/angular-typechecker/src/executors/angular-typecheck/executor.ts:78-84`
**Issue:** The notice interpolates the raw `reason` discriminator:
`... was ${skipped.reason} and was skipped or reclassified ...`. For
`reason: 'not-found'` this renders "... was not-found and was skipped ..." which
reads awkwardly (the reason `'not-found'` is a state, not an action). Functionally
correct and covered by the executor spec (which matches the `not-found` substring),
so INFO only.
**Fix (optional):** Map the discriminator to a human phrase, e.g.
`` `... was skipped or reclassified (reason: ${skipped.reason}) during the ...` ``,
which reads cleanly for all four reasons and keeps the substring the spec asserts.

---

_Reviewed: 2026-07-01T19:20:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
