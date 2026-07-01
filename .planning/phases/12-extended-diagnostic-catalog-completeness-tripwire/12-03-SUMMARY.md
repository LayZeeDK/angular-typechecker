---
phase: 12-extended-diagnostic-catalog-completeness-tripwire
plan: 03
subsystem: testing
tags: [angular-compiler-cli, diagnostics, vitest, fixtures, ng-error-codes, baseline-codes]

# Dependency graph
requires:
  - phase: 12-extended-diagnostic-catalog-completeness-tripwire (Plan 02)
    provides: the single catalog-of-record spec (extended-catalog.integration.spec.ts) with the packageRoot/workspaceRoot resolver, the NG import, and the fixtureTsConfig() helper
provides:
  - CAT-03 baseline coverage -- all 12 baseline TS/NG codes each asserted by exact code in a sibling it.each table inside the one catalog of record
  - Two new committed baseline fixtures (ng-baseline-extra firing 8 NG codes; ng-baseline-import-cycle firing NG3003)
  - The fold+deletion of baseline.angular13.integration.spec.ts (one catalog of record, D-06/D-07)
  - An honest TESTING.md integration-spec count after the net fold
affects: [Phase 12 milestone audit, CAT-05 catalog doc, future Angular-version bumps that revalidate the baseline triggers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sibling it.each table in the same catalog spec (describe.each over BaselineRow objects) -- one catalog of record for both extended and baseline codes"
    - "Baseline PRESENCE assertion via codes.toContain(NG(code)|bareTs) -- distinct from the extended block's exact filter-count discipline"
    - "NG3003 forced deterministically via an NgModule-wired 2-component selector cycle under compilationMode: partial (remote scoping disabled -> cycle-handling strategy Error)"
    - "NG2005 requires the undecorated provider class to have >=1 constructor parameter (resolveProvidersRequiringFactory gate)"

key-files:
  created:
    - fixtures/ng-baseline-extra/ (8 .ts files + tsconfig.app.json)
    - fixtures/ng-baseline-import-cycle/ (cycle.module.ts + first/second.component.ts + tsconfig.app.json)
  modified:
    - packages/angular-typechecker/src/core/extended-catalog.integration.spec.ts (appended the baseline it.each block)
    - .planning/codebase/TESTING.md (integration-spec count 10 -> 8)
  deleted:
    - packages/angular-typechecker/src/core/baseline.angular13.integration.spec.ts (folded into the catalog)

key-decisions:
  - "NG3003 was staged via an NgModule (declarations) selector cycle under compilationMode: partial rather than a standalone imports cycle -- standalone imports resolve via forward references and never fire NG3003"
  - "NG2005 fixture's undecorated provider carries a constructor dependency so it registers as providersRequiringFactory (verified in v22.0.4 bundle)"
  - "NG1001 (non-literal @Component metadata) lives on its OWN component -- unanalyzable metadata suppresses template diagnostics, so NG8002/NG8004 must live on separate components"

patterns-established:
  - "Baseline sibling table: BaselineRow { label, code, isNg, fixtureScenario, expectWarning? } driven by describe.each, reusing the extended spec's fixtureTsConfig() resolver and NG import"
  - "WARN_-prefixed codes (NG6100) get an additional category === ts.DiagnosticCategory.Warning + warningCount >= 1 assertion"

requirements-completed: [CAT-03]

# Metrics
duration: 16min
completed: 2026-07-01
---

# Phase 12 Plan 03: Baseline TS/NG catalog fold Summary

**All 12 baseline TS/NG codes (TS2322/TS2339 + NG2003/2005/2007/2009/1001/3003/6100/8001/8002/8004) asserted by exact code in a sibling it.each table inside the one catalog of record, backed by 2 new empirically-verified fixtures, with baseline.angular13 folded and deleted.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-07-01T07:09:29Z
- **Completed:** 2026-07-01T07:25:40Z
- **Tasks:** 3
- **Files modified:** 16 (13 fixture files created, 1 spec modified, 1 spec deleted, 1 doc modified)

## Accomplishments
- Authored `fixtures/ng-baseline-extra/` (8 component/module files) firing NG2003, NG2005, NG2007, NG2009, NG1001, NG6100 (Warning), NG8002, NG8004 -- every trigger verified against a real `@angular/compiler-cli@22.0.4` run before the spec was written.
- Authored `fixtures/ng-baseline-import-cycle/` (NgModule + 2 mutually-referencing components) firing NG3003 deterministically under `compilationMode: "partial"`.
- Appended a sibling baseline `describe.each` table (12 rows) to `extended-catalog.integration.spec.ts`; NG6100 additionally asserts Warning category + warningCount.
- Folded and deleted `baseline.angular13.integration.spec.ts` (its TS2339 + NG8001 assertions now live in the catalog baseline block) -- one catalog of record (D-06/D-07).
- Corrected TESTING.md's integration-spec count from 10 to the measured 8.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author the ~2 new baseline fixtures** - `5bee856` (test)
2. **Task 2: Add the sibling baseline it.each table** - `e1440fd` (test)
3. **Task 3: Delete the folded baseline spec + correct TESTING.md count** - `46e5a84` (test)

**Plan metadata:** (final docs commit follows this SUMMARY)

## Files Created/Modified
- `fixtures/ng-baseline-extra/param-token.component.ts` - NG2003 (primitive DI param, no token)
- `fixtures/ng-baseline-extra/undecorated-provider.component.ts` - NG2005 (undecorated provider with a constructor dependency)
- `fixtures/ng-baseline-extra/undecorated-base.component.ts` - NG2007 (undecorated base using @Input())
- `fixtures/ng-baseline-extra/shadow-dom.component.ts` - NG2009 (ShadowDom + hyphen-less selector)
- `fixtures/ng-baseline-extra/non-literal.component.ts` - NG1001 (@Component(variable))
- `fixtures/ng-baseline-extra/ngmodule-id.module.ts` - NG6100 (@NgModule({ id: module.id }), Warning)
- `fixtures/ng-baseline-extra/schema-attr.component.ts` - NG8002 (unknown attribute on a known element)
- `fixtures/ng-baseline-extra/missing-pipe.component.ts` - NG8004 (undeclared pipe)
- `fixtures/ng-baseline-extra/tsconfig.app.json` - lists all 8 files, strictTemplates
- `fixtures/ng-baseline-import-cycle/cycle.module.ts` - NgModule declaring both cyclic components
- `fixtures/ng-baseline-import-cycle/first.component.ts` / `second.component.ts` - mutual selector references (no direct imports)
- `fixtures/ng-baseline-import-cycle/tsconfig.app.json` - strictTemplates + compilationMode: partial
- `packages/angular-typechecker/src/core/extended-catalog.integration.spec.ts` - appended the 12-row baseline it.each block
- `packages/angular-typechecker/src/core/baseline.angular13.integration.spec.ts` - DELETED (folded)
- `.planning/codebase/TESTING.md` - integration-spec count 10 -> 8

## Decisions Made
- **NG3003 staged via NgModule, not standalone imports.** A standalone `imports: [Other]` cross-reference cycle never fires NG3003 -- standalone imports resolve via forward references (`standaloneImportMayBeForwardDeclared`), so no cyclic import is generated. NG3003 requires Angular to GENERATE the cross-imports, which happens with NgModule `declarations` where the component files do NOT import each other. Under `compilationMode: "partial"` the cycle-handling strategy is Error (remote scoping is unavailable), which is what raises NG3003. Verified in the v22.0.4 bundle (`cycleHandlingStrategy = compilationMode === PARTIAL ? 1 : 0`).
- **NG2005 needs a constructor dependency.** `resolveProvidersRequiringFactory` only flags an undecorated provider that has >=1 constructor parameter; the initial parameter-less service was silently filtered out. Added an `UndecoratedDependency` constructor param.
- **NG1001 isolated on its own component.** Non-literal `@Component` metadata is unanalyzable, so the compiler emits no template diagnostics for that component -- NG8002/NG8004 therefore live on separate, fully-analyzable components in the same fixture.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] NG3003 did not fire from the planned standalone cross-reference cycle**
- **Found during:** Task 1 (fixture authoring, TDD verification loop)
- **Issue:** The plan sketched NG3003 as a "2-file directive/pipe cross-reference cycle" between standalone components. Two standalone components with explicit `imports:` of each other produced ZERO diagnostics -- standalone imports are forward-declarable, so Angular avoids the cyclic import entirely and never raises NG3003.
- **Fix:** Restructured the fixture to an NgModule (`cycle.module.ts`) declaring both components, where the two component files do NOT import each other (only the module imports both). Set `compilationMode: "partial"` in the fixture tsconfig so the cycle-handling strategy is Error (remote scoping unavailable). This forces Angular to generate the cross-imports and raise NG3003. The fixture still consists of the required two cross-referencing component `.ts` files (plus the wiring module).
- **Files modified:** fixtures/ng-baseline-import-cycle/first.component.ts, second.component.ts, tsconfig.app.json; added cycle.module.ts
- **Verification:** Real `performCompilation` run (project gatherer) shows NG3003 (-993003, Error) on second.component.ts; the Task 2 baseline row `codes.toContain(NG(3003))` passes.
- **Committed in:** `5bee856` (Task 1 commit)

**2. [Rule 1 - Bug] NG2005 fixture did not fire (parameter-less undecorated provider filtered out)**
- **Found during:** Task 1 (fixture authoring, TDD verification loop)
- **Issue:** An undecorated provider class with no constructor did not surface NG2005. The v22.0.4 `resolveProvidersRequiringFactory` only registers a provider "requiring a factory" when it has >=1 constructor parameter, so a parameter-less class is skipped.
- **Fix:** Gave `UndecoratedService` a constructor parameter (`UndecoratedDependency`).
- **Files modified:** fixtures/ng-baseline-extra/undecorated-provider.component.ts
- **Verification:** Real run shows NG2005 (-992005, Error); the Task 2 baseline row passes.
- **Committed in:** `5bee856` (Task 1 commit)

**Note on `files_modified` accuracy:** the plan's `files_modified` listed a single `fixtures/ng-baseline-extra/error.component.ts` + `error.component.html` and a 2-file import-cycle. The `<interfaces>`/`<action>` blocks explicitly permit splitting into multiple `.ts` files "and update `files_modified` accordingly." Actual files: 8 `.ts` files in ng-baseline-extra (one per code family, because NG1001's unanalyzable metadata and NG2009's per-component encapsulation cannot co-host the template-driven NG8002/NG8004), and a 3-file NgModule cycle. No HTML files (inline templates used, matching the single-diagnostic discipline).

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug) -- both discovered via the TDD verify-before-commit loop.
**Impact on plan:** Both fixes were necessary for the fixtures to actually trigger their target codes. No scope creep -- the fixture directory count and the required cross-referencing components are unchanged; only the internal file layout and the NG3003 wiring strategy differ from the sketch, which the plan explicitly permitted.

## Issues Encountered
- The initial empirical probe under-reported diagnostics because it used `performCompilation`'s DEFAULT gatherer (phase short-circuit) rather than the project's `gatherAllDiagnostics`. Re-probing with the full unconditional getter set (matching `gather-diagnostics.ts`) surfaced all codes correctly, matching what `runTypecheck` sees in the real spec.
- `human_needed`: NONE. NG3003 fires deterministically from the static fixture (no `it.skip` or human-verification carve-out needed).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CAT-03 is fully covered inside the single catalog of record; baseline.angular13 is gone (one catalog of record, D-06/D-07).
- Full plugin suite green: 24 test files, 183 tests (was 25/185 -- the 2 folded baseline.angular13 tests are now baseline catalog rows).
- Ready for the Phase 12 milestone audit / VERIFICATION cross-reference.

## Self-Check: PASSED

- All created files exist (fixtures, catalog spec, SUMMARY).
- baseline.angular13.integration.spec.ts confirmed deleted.
- All 3 task commits present in git log (5bee856, e1440fd, 46e5a84).

---
*Phase: 12-extended-diagnostic-catalog-completeness-tripwire*
*Completed: 2026-07-01*
