# Phase 12: Extended-diagnostic catalog + completeness tripwire - Research

**Researched:** 2026-07-01
**Domain:** Angular 22 compiler diagnostics surface (extended template diagnostics + baseline TS/NG codes); Vitest data-driven integration testing against the real `@angular/compiler-cli@22.0.4`; a type-level completeness tripwire under classic module resolution.
**Confidence:** HIGH (every code number and enum-membership claim is cited to the installed `.d.ts`/bundle; the one promotability correction is cited to the runtime bundle source).

## Summary

This is an engine-only, test-focused phase. The "what" is locked by CAT-01..05 + DRIFT-01 and the board CONSENSUS (D2). The deliverable is: (1) a single data-driven `it.each` catalog spec keyed on the 18 `ExtendedTemplateDiagnosticName` members, asserting each by exact `NG()` code + `DiagnosticCategory` + count over committed fixtures against the real compiler; (2) a sibling baseline-code `it.each` table (CAT-03); (3) one severity-promotion proof (CAT-02, reuse `fixtures/extended-promoted/`); (4) a type-level enum-vs-table completeness tripwire (DRIFT-01) that runs in the existing `typecheck-drift` Nx target and never ships; (5) a full rewrite of `research/DIAGNOSTIC-CATALOG.md` (CAT-05).

I source-verified the full 18-member enum, every NG code, the default categories, the trigger conditions for every reproducible member, and the promotability nuance. **One locked decision is contradicted by the source and must be re-opened: D-09's claim that NG8011 (`controlFlowPreventingContentProjection`) is "not promotable" is WRONG.** The runtime bundle proves NG8011 AND NG8113 (`unusedStandaloneImports`) — the two checks emitted out-of-band (no `extended/checks/` factory) — BOTH honor `extendedDiagnostics.defaultCategory`. So all 18 are promotable, not 17. Details and the precise citations are in the Promotability section and the Assumptions/Open Questions. Everything else in CONTEXT (the 18-member set, NG8011/NG8021/NG8112 codes, the docs-vs-enum gap, the tripwire mechanism, the fixture-batching direction) is confirmed accurate.

**Primary recommendation:** Build one `extended-catalog.integration.spec.ts` with an 18-row `as const` table (the single source of truth), a sibling baseline table, fold the two existing NG8101 specs into it, reuse the four existing fixtures, add a small number of new batched fixture programs, and add one `extended-catalog.drift.ts` type-level tripwire to `tsconfig.drift.json`. Treat the catalog's `as const` member-name list as the single declaration both the runtime table and the tripwire consume (D-02). Re-open D-09 before locking the promotion rows.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** The DRIFT-01 tripwire is a **type-level assertion** mirroring `compiler-cli-types.drift.ts`, run by the existing `typecheck-drift` Nx target (NOT a runtime Vitest spec). `ExtendedTemplateDiagnosticName` is not a public runtime export; its deep type is reachable only under classic `moduleResolution: node` (the regime `tsconfig.drift.json` uses).
- **D-02:** Single source of truth: the catalog's 18 row keys and the tripwire's asserted set derive from ONE declaration (the `it.each` table's `as const` member list); the tripwire asserts mutual set-equality between that list and the real enum.
- **D-03:** Batch fixtures per program where practical (consensus D2). Reuse `fixtures/extended-v13/` and `fixtures/extended-promoted/`. Group remaining checks into a small number of new fixture programs; conflicting checks split into their own program.
- **D-04:** Each row maps `enum member -> { NG code, expected DiagnosticCategory, occurrence count, introduction-version, fixture ref, optional skip-reason }`. Assertions use `NG()`; counting is ALWAYS by `ts.DiagnosticCategory`, never code sign (L-4).
- **D-05:** A SINGLE new data-driven spec holds the 18-row `it.each` table keyed on the enum members; introduction-version is a ROW FIELD. Non-reproducible members are `it.skip` WITH A WRITTEN REASON and their rows STAY. Supersedes the OLD catalog's per-version-file split.
- **D-06:** The baseline TS/NG codes (TS2322, TS2339, NG2003, NG2005, NG2007, NG2009, NG1001, NG3003, NG6100, NG8001, NG8002, NG8004) are asserted by exact code in a sibling `it.each` table (extend/absorb `baseline.angular13.integration.spec.ts`).
- **D-07:** Fold the existing `extended.angular13.integration.spec.ts` and `extended.promotion.integration.spec.ts` into / reference them from the catalog so there is ONE catalog of record (no duplicate NG8101 assertions).
- **D-08:** Keep ONE promotion proof — NG8101 via `fixtures/extended-promoted/` (`extendedDiagnostics.defaultCategory: "error"`). Per-member promotion testing is YAGNI.
- **D-09:** NG8011 is asserted at its OBSERVED category, and its promotion case is `it.skip` WITH A REASON (claimed: emitted out-of-band, no `extended/checks/` factory, NOT promotable). **[SEE Open Question 1 — the "NOT promotable" half of this decision is contradicted by source and must be re-opened.]**
- **D-10:** FULL rewrite of the extended-diagnostics section of `DIAGNOSTIC-CATALOG.md` to the source-verified authoritative 18-member set (name + NG code + category + introduction-version).
- **D-11:** Correct the verified error: `unusedLetDeclaration` (NG8112) IS an enum member (the OLD catalog wrongly excluded it). The enum (build/test source of truth) differs from the angular.dev docs list; the enum wins.
- **D-12:** Note that NG8110 (`UNSUPPORTED_INITIALIZER_API_USAGE`) and NG8118 (`FORBIDDEN_REQUIRED_INITIALIZER_INVOCATION`) are `ErrorCode`s but NOT configurable extended diagnostics (not in the enum). Replace the stale per-version-file-split "Test organization" guidance with D-01/D-05.

### Claude's Discretion

Four research directives (1: pin the member->code mapping; 2: determine non-reproducible members; 3: confirm the tripwire's exact form; 4: verify promotability + default categories). All four are pinned in this document — see Architecture Patterns, Code Examples, Promotability, and Validation Architecture.

### Deferred Ideas (OUT OF SCOPE)

- The `typecheck-configuration` generator (Phase 13); generator e2e + `-p` guard (Phase 14).
- Per-member promotion testing; `jscodeshift` error-injection; new e2e projects; Verdaccio; `NgtscProgram` per-file recovery.
- The bespoke `createFsTree` real-disk helper (board Option A, FSTREE-01).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAT-01 | Assert all 18 `ExtendedTemplateDiagnosticName` members by exact code + `DiagnosticCategory` + count, real compiler, committed fixtures | Member->code->category table pinned (Standard Stack table); trigger shapes sketched (Code Examples); fixture batching mapped (Architecture Patterns) |
| CAT-02 | At least one severity-promotion case (NG8011 exception under review) | `fixtures/extended-promoted/` already proves NG8101 warning->error; the NG8011/NG8113 promotability finding is in Promotability + Open Question 1 |
| CAT-03 | Baseline TS/NG codes asserted by exact code | All 12 baseline codes verified against `error_code.d.ts`; existing `ts-baseline`/`ng-baseline` cover 2; minimal triggers + new-fixture needs listed (Baseline Codes section) |
| CAT-04 | Single `it.each` table keyed on enum members; non-reproducible = `it.skip` w/ reason; row stays | Reproducibility analysis per member (Reproducibility section); the table-shape sketch (Code Examples) |
| CAT-05 | Rewrite `DIAGNOSTIC-CATALOG.md` to the authoritative 18-member set | Authoritative table + docs-vs-enum gap + NG8110/NG8118 note all source-verified (Standard Stack, State of the Art) |
| DRIFT-01 | Completeness tripwire: catalog set === enum; loud CI failure on drift | Exact import specifier, value-vs-name comparison choice, and an `AssertAssignable`-style mutual-equality sketch (Code Examples + Architecture Patterns) |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Assert each extended diagnostic by exact code+category+count | Integration test tier (`*.integration.spec.ts`, real compiler) | Committed fixtures (`fixtures/<scenario>/`) | Only a real cold `performCompilation` proves the engine observes the diagnostic; pure-unit specs cannot exercise the compiler |
| Provide diagnostic-triggering source | Committed static fixtures | — | Static component+template fixtures (no AST mutation, no jscodeshift) reproduce the diagnostics deterministically; this is the locked board strategy |
| Encode/compare NG codes | `diagnostic-codes.ts` `NG()` helper (production-importable, dependency-free) | — | Negative-encoding lives in one place; every assertion routes through it (L-4) |
| Enum-vs-table completeness assertion | Build/test-time type-check (`typecheck-drift` Nx target, `tsconfig.drift.json`) | — | The enum is not a runtime export; only a type-level assertion under classic resolution can consume it without shipping it |
| Catalog of record for the diagnostic surface | `DIAGNOSTIC-CATALOG.md` (planning doc) | The `as const` table in the spec | The spec table is the executable source of truth; the markdown is human-readable documentation regenerated from it |

## Standard Stack

No new packages. This phase uses only what the workspace already pins. Re-verified against the installed tree 2026-07-01.

### Core (already installed; no install step)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@angular/compiler-cli` | `22.0.4` | The diagnostic engine under test (peer; ESM, loaded via `await import()`) `[VERIFIED: node_modules/@angular/compiler-cli/package.json]` | The authoritative source of the enum + codes |
| `typescript` | `>=6.0.0 <6.1.0` (`6.0.3` installed) | `ts.DiagnosticCategory`, `ts.Diagnostic` shapes for assertions | The peer the engine type-checks against |
| `vitest` | `~4.1.0` | The `it.each` data-driven runner | The locked test runner (`@nx/vitest:test`) |

### Supporting (already in the repo; reuse, do not re-create)
| Asset | Path | Purpose |
|-------|------|---------|
| `NG()` / `ngCodeOf()` | `packages/angular-typechecker/src/core/diagnostic-codes.ts` | NG-code encode/decode for every assertion `[VERIFIED: read 2026-07-01]` |
| `runTypecheck` / `CoreResult` | `packages/angular-typechecker/src/core/run-typecheck.ts` | The integration entry point; returns `{ diagnostics, errorCount, warningCount, suppressedCount, ... }`. Counts by `ts.DiagnosticCategory` `[VERIFIED]` |
| Drift tripwire pattern | `packages/angular-typechecker/src/core/compiler-cli-types.drift.ts` + `tsconfig.drift.json` | The exact `AssertAssignable<From, To extends From>` + classic-resolution import idiom to mirror for DRIFT-01 `[VERIFIED]` |
| Existing fixtures | `fixtures/extended-v13/`, `fixtures/extended-promoted/`, `fixtures/ts-baseline/`, `fixtures/ng-baseline/`, `fixtures/gate-b-error/` | Cover NG8101 (warn + promoted), TS2339, NG8001, NG8109 (signal) `[VERIFIED: read 2026-07-01]` |

### The authoritative 18-member `ExtendedTemplateDiagnosticName` -> NG-code -> default-category table

`[VERIFIED: node_modules/@angular/compiler-cli/src/ngtsc/diagnostics/src/extended_template_diagnostic_name.d.ts:17-36 (enum + declaration order)]`
`[VERIFIED: node_modules/@angular/compiler-cli/src/ngtsc/diagnostics/src/error_code.d.ts (each code)]`

Rows are in ENUM DECLARATION ORDER (which differs from code order — note NG8011 sits at declaration index 11 but its code is below NG8101). Default category for every factory-based check is **Warning** (the factory reads `extendedDiagnostics.checks[name] ?? defaultCategory ?? DiagnosticCategoryLabel.Warning` at bundle line 3727; with `strictTemplates: true` and no override, all default to Warning). The two out-of-band checks (NG8011, NG8113) also default to **Warning** (bundle lines 4924-4925/4954-4955: `?? DiagnosticCategoryLabel.Warning`).

| # (decl) | Enum member | string value | ErrorCode | NG code | `error_code.d.ts` line | Default category | Has `extended/checks/` factory? |
|----------|-------------|--------------|-----------|---------|------------------------|------------------|---------------------------------|
| 0 | INVALID_BANANA_IN_BOX | invalidBananaInBox | 8101 | NG(8101) = -998101 | 394 | Warning | yes (`invalid_banana_in_box/`) |
| 1 | NULLISH_COALESCING_NOT_NULLABLE | nullishCoalescingNotNullable | 8102 | NG(8102) | 403 | Warning | yes (`nullish_coalescing_not_nullable/`) |
| 2 | OPTIONAL_CHAIN_NOT_NULLABLE | optionalChainNotNullable | 8107 | NG(8107) | 456 | Warning | yes (`optional_chain_not_nullable/`) |
| 3 | MISSING_CONTROL_FLOW_DIRECTIVE | missingControlFlowDirective | 8103 | NG(8103) | 408 | Warning | yes (`missing_control_flow_directive/`) |
| 4 | MISSING_STRUCTURAL_DIRECTIVE | missingStructuralDirective | 8116 | NG(8116) | 543 | Warning | yes (`missing_structural_directive/`) |
| 5 | TEXT_ATTRIBUTE_NOT_BINDING | textAttributeNotBinding | 8104 | NG(8104) | 424 | Warning | yes (`text_attribute_not_binding/`) |
| 6 | UNINVOKED_FUNCTION_IN_EVENT_BINDING | uninvokedFunctionInEventBinding | 8111 | NG(8111) | 503 | Warning | yes (`uninvoked_function_in_event_binding/`) |
| 7 | MISSING_NGFOROF_LET | missingNgForOfLet | 8105 | NG(8105) | 434 | Warning | yes (`missing_ngforof_let/`) |
| 8 | SUFFIX_NOT_SUPPORTED | suffixNotSupported | 8106 | NG(8106) | 445 | Warning | yes (`suffix_not_supported/`) |
| 9 | SKIP_HYDRATION_NOT_STATIC | skipHydrationNotStatic | 8108 | NG(8108) | 468 | Warning | yes (`skip_hydration_not_static/`) |
| 10 | INTERPOLATED_SIGNAL_NOT_INVOKED | interpolatedSignalNotInvoked | 8109 | NG(8109) | 477 | Warning | yes (`interpolated_signal_not_invoked/`) |
| 11 | CONTROL_FLOW_PREVENTING_CONTENT_PROJECTION | controlFlowPreventingContentProjection | 8011 | NG(8011) = -998011 | 319 | Warning | **NO — out-of-band (`oob.d.ts`)** |
| 12 | UNUSED_LET_DECLARATION | unusedLetDeclaration | 8112 | NG(8112) | 515 | Warning | yes (`unused_let_declaration/`) |
| 13 | UNINVOKED_TRACK_FUNCTION | uninvokedTrackFunction | 8115 | NG(8115) | 539 | Warning | yes (`uninvoked_track_function/`) |
| 14 | UNUSED_STANDALONE_IMPORTS | unusedStandaloneImports | 8113 | NG(8113) | 519 | Warning | **NO — out-of-band (added to SUPPORTED set manually)** |
| 15 | UNPARENTHESIZED_NULLISH_COALESCING | unparenthesizedNullishCoalescing | 8114 | NG(8114) | 523 | Warning | yes (`unparenthesized_nullish_coalescing/`) |
| 16 | UNINVOKED_FUNCTION_IN_TEXT_INTERPOLATION | uninvokedFunctionInTextInterpolation | 8117 | NG(8117) | 557 | Warning | yes (`uninvoked_function_in_text_interpolation/`) |
| 17 | DEFER_TRIGGER_MISCONFIGURATION | deferTriggerMisconfiguration | 8021 | NG(8021) = -998021 | 375 | Warning | yes (`defer_trigger_misconfiguration/`) |

**Set identity confirmed:** 18 members = {NG8011, NG8021} ∪ {NG8101..NG8117 MINUS NG8110}. NG8110 (`UNSUPPORTED_INITIALIZER_API_USAGE`, line 491) and NG8118 (`FORBIDDEN_REQUIRED_INITIALIZER_INVOCATION`, line 572) are `ErrorCode`s NOT in the enum. A numeric "NG81xx" filter is provably wrong (misses NG8011/NG8021, wrongly includes NG8110/NG8118). `[VERIFIED]`

**There are 16 factory directories** under `extended/checks/`, not 17. `[VERIFIED: ls node_modules/@angular/compiler-cli/src/ngtsc/typecheck/extended/checks/ = 16 dirs]` The two without a factory are NG8011 and NG8113 — both emitted out-of-band but both added to `SUPPORTED_DIAGNOSTIC_NAMES` manually so both are still configurable. `[VERIFIED: bundles/chunk-33J3WRHI.js:3794-3798]`

## Package Legitimacy Audit

Not applicable. This phase installs NO external packages. All assets (`@angular/compiler-cli`, `typescript`, `vitest`, the `NG()` helper, the fixtures) are already in the locked, lockfile-pinned tree. The dev-repo `.npmrc legacy-peer-deps=true` note (STATE.md) is relevant ONLY if the planner adds a dev dependency — which this phase should not. If the planner does add one, gate it behind a `checkpoint:human-verify` and run the slopcheck protocol then.

## Architecture Patterns

### System data flow (catalog spec)

```
fixtures/<scenario>/tsconfig.app.json  (strictTemplates: true [+ defaultCategory: "error" for the promotion fixture])
        |
        v
it.each( CATALOG_ROWS )  -- one row per enum member: { member, ngCode, expectedCategory, expectedCount, fixtureTsConfig, introVersion, skipReason? }
        |  (it.skip when skipReason present -- row stays for tripwire honesty)
        v
runTypecheck({ tsConfigPath })  -->  CoreResult { diagnostics[], errorCount, warningCount, suppressedCount }
        |
        v
find diagnostic by  d.code === NG(row.ngCode)   ==> assert d.category === row.expectedCategory
count diagnostics with that code                ==> assert occurrence count
count by ts.DiagnosticCategory                   ==> assert errorCount/warningCount (NEVER by code sign -- L-4)

CATALOG_ROWS  (the single `as const` member-name list, D-02)
        |
        +--> consumed by the runtime it.each table (above)
        +--> consumed by extended-catalog.drift.ts  (type-level set-equality vs the real enum; runs in typecheck-drift)
```

### Recommended file layout

```
packages/angular-typechecker/src/core/
  extended-catalog.integration.spec.ts   # NEW: the 18-row it.each + sibling baseline it.each (folds the two existing NG8101 specs + baseline spec)
  extended-catalog.drift.ts              # NEW: type-level enum-vs-table tripwire; added to tsconfig.drift.json "files"
  diagnostic-codes.ts                    # REUSE: NG()
  run-typecheck.ts                       # REUSE: runTypecheck/CoreResult
  (DELETE/absorb) extended.angular13.integration.spec.ts, extended.promotion.integration.spec.ts, baseline.angular13.integration.spec.ts  # D-07/D-06: fold into the catalog of record
fixtures/
  extended-v13/        # REUSE: NG8101 warning
  extended-promoted/   # REUSE: NG8101 promoted (CAT-02)
  ts-baseline/         # REUSE: TS2339
  ng-baseline/         # REUSE: NG8001
  gate-b-error/        # REUSE: TS2322 + NG8109 (signal not invoked)
  extended-batch-*/    # NEW: a small number of batched programs for the remaining ~13 members (see batching map)
  ng-baseline-extra/   # NEW (likely): the baseline codes ts-baseline/ng-baseline don't yet cover (NG2003/2005/2007/2009/1001/3003/6100/8002/8004, TS2322 via gate-b-error)
packages/angular-typechecker/tsconfig.drift.json   # EDIT: add "src/core/extended-catalog.drift.ts" to "files"
packages/angular-typechecker/project.json          # EDIT: add the new drift file (and its inputs) to the typecheck-drift target inputs[]
```

### Fixture-batching map (D-03 — checks that share a template without interfering can co-locate in one program)

Each `performCompilation` is ~0.5s cold, so fewer programs = cheaper CI. A check fires per-template-node; multiple distinct triggers in ONE component template are fine **as long as one trigger does not produce an incidental second diagnostic that pollutes the count**. The hard constraint: a row asserts an exact occurrence count for its code, so a batch must keep each batched code's count deterministic.

| Batch group | Members (camelCase) | Why batchable / why split |
|-------------|---------------------|----------------------------|
| **Reuse: extended-v13** | invalidBananaInBox (NG8101, warning) | already exists |
| **Reuse: extended-promoted** | invalidBananaInBox (NG8101, promoted -> error) | already exists; CAT-02 |
| **Reuse: gate-b-error** | interpolatedSignalNotInvoked (NG8109) + TS2322 | already exists; signal-not-invoked is here |
| **Batch A (interpolation/expression family)** | nullishCoalescingNotNullable (8102), optionalChainNotNullable (8107), unparenthesizedNullishCoalescing (8114), uninvokedFunctionInTextInterpolation (8117), textAttributeNotBinding (8104), suffixNotSupported (8106) | All are independent expression/attribute interpolation checks in one component's bindings; no cross-interference. Verify counts. |
| **Batch B (structural/control-flow directive family)** | missingControlFlowDirective (8103), missingStructuralDirective (8116), missingNgForOfLet (8105) | All fire on un-imported directives in one standalone component WITHOUT CommonModule; co-locatable. NOTE: 8103 vs 8116 may both fire on the same node — split if counts collide. |
| **Batch C (event/track function family)** | uninvokedFunctionInEventBinding (8111), uninvokedTrackFunction (8115) | independent; one template with a `(click)="fn"` and a `@for(...; track fn)`. |
| **Batch D (@let family)** | unusedLetDeclaration (8112) | small; can join Batch C or stand alone. |
| **Own program: skipHydrationNotStatic (8108)** | skipHydrationNotStatic | `[ngSkipHydration]="x"` binding; harmless to batch but keep isolated if the binding interferes. |
| **Own program: unusedStandaloneImports (8113)** | unusedStandaloneImports | needs a standalone `@Component({ imports: [X] })` where X is unused; component-metadata-level, NOT a template node. Keep its own program (a real unused import must exist and nothing else may consume it). |
| **Own program: deferTriggerMisconfiguration (8021)** | deferTriggerMisconfiguration | needs a `@defer` block with conflicting triggers; isolate so the defer block doesn't interact with other checks. |
| **Own program: controlFlowPreventingContentProjection (8011)** | controlFlowPreventingContentProjection | needs a parent component with a content-projection slot + a child whose `@if` block has multiple root nodes; two-component setup. Keep isolated. |

The exact grouping is an implementation discovery (D-03). Recommendation: start with the 4 batches + 4 own-programs above (~8 new fixtures) and split a batch only if an occurrence-count assertion proves a collision.

### Pattern: the catalog `it.each` row + assertion (mirror existing specs)

The existing `extended.angular13.integration.spec.ts` already shows the find-by-code + assert-category idiom; `run-typecheck.integration.spec.ts` shows `describe.each([...])('label (%s)', (_label, tsConfigPath) => {...})`. Mirror both. See Code Examples for the full sketch.

### Pattern: the DRIFT-01 type-level tripwire (mirror `compiler-cli-types.drift.ts`)

Mirror the existing drift file's `AssertAssignable<From, To extends From>` helper and classic-resolution import. The tripwire asserts **mutual** set-equality (the `as const` member-name list ⊆ enum AND enum ⊆ the list) so an added, renamed, OR removed upstream member fails. See Code Examples for the full sketch.

### Anti-patterns to avoid

- **Numeric range filter ("NG81xx"):** provably wrong — misses NG8011/NG8021, wrongly includes NG8110/NG8118. Drive everything from the enum.
- **Asserting by bare positive code (`8101`):** never matches; `ts.Diagnostic.code` is negative-encoded. Always `NG(8101)`. (L-4 / `diagnostic-codes.ts` header.)
- **Counting by `length - errorCount` or by code sign:** the engine counts by `ts.DiagnosticCategory` explicitly; mirror that (the MD-02 bug the core header warns against).
- **Putting the tripwire in a Vitest spec:** the enum is not a runtime export (`require(...).ExtendedTemplateDiagnosticName === undefined`); a runtime spec cannot consume it. It MUST be the type-level `typecheck-drift` file.
- **Importing the enum from the barrel `'@angular/compiler-cli'`:** the barrel `index.d.ts` re-exports `ErrorCode` + `ngErrorCode` but NOT `ExtendedTemplateDiagnosticName`. The tripwire must use the deep specifier (see Code Examples). `[VERIFIED: index.d.ts:30 lists only isLocalCompilationDiagnostics, ErrorCode, ngErrorCode]`
- **Letting the new `.drift.ts` reach `tsconfig.lib.json`/`tsconfig.spec.json`:** both already `exclude: ["src/**/*.drift.ts"]` — keep the new file named `*.drift.ts` so the existing glob excludes it from build/test/tarball. `[VERIFIED: tsconfig.lib.json:18, tsconfig.spec.json:29]`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Encode/compare NG codes | A local `-99...` formula in the spec | `NG()` from `diagnostic-codes.ts` | One canonical encoder; already unit-tested; L-4 discipline |
| Run the compiler + shape results | A bespoke `performCompilation` wrapper in the spec | `runTypecheck({ tsConfigPath })` | Owns emit-neutralizing override, boundary filter, infra-failure classification, count-by-category |
| Type-level set-equality / assignability probe | An npm type-assertion lib (`tsd`, `expect-type`) | The vendored `AssertAssignable<From, To extends From>` from `compiler-cli-types.drift.ts` | Zero new dependency (D-03 of the existing drift work); the codebase already standardized on it |
| Trigger diagnostics | jscodeshift / AST mutation | Committed static fixtures | Locked board strategy (CONSENSUS D6; OUT OF SCOPE per REQUIREMENTS) |
| New CI cell for the tripwire | A new `ci.yml` job | The existing `typecheck-drift` target (`nx run-many -t typecheck-drift test`) | Already CI-wired; consensus D5: no `ci.yml` change |

**Key insight:** every mechanism this phase needs already exists in the repo. The work is data (rows + fixtures) and one new type-level file, not new infrastructure.

## Reproducibility Analysis (CAT-04 — which members need `it.skip`)

For each member: can a STATIC committed fixture under Angular 22.0.4 (`strictTemplates: true`) make the diagnostic fire? Verified by reading each check's trigger in the bundle. **Finding: all 18 appear statically reproducible** — none requires a runtime, a browser, hydration, or a build step. The CONTEXT directive's "candidates needing special setup" hypotheses were checked and refuted at the source:

| Member | Reproducible by static fixture? | Trigger (verified) | Notes / refuted hypothesis |
|--------|-------------------------------|--------------------|----------------------------|
| invalidBananaInBox (8101) | YES (exists) | `([value])="update"` (parens outside brackets) | existing fixture |
| nullishCoalescingNotNullable (8102) | YES | `{{ nonNullable ?? fallback }}` where LHS type excludes null/undefined | |
| optionalChainNotNullable (8107) | YES | `{{ nonNullable?.bar }}` LHS not nullable | |
| missingControlFlowDirective (8103) | YES | `*ngIf` used without importing `CommonModule` | |
| missingStructuralDirective (8116) | YES | a structural directive used but not imported | may co-fire with 8103 — split if counts collide |
| textAttributeNotBinding (8104) | YES | `attr.x="value"` / `class.blue="true"` static (likely meant as binding) | |
| uninvokedFunctionInEventBinding (8111) | YES | `(click)="myFunc"` (not invoked) | |
| missingNgForOfLet (8105) | YES | `*ngFor="item of items"` (missing `let`) | |
| suffixNotSupported (8106) | YES | `[attr.width.px]="5"` | |
| skipHydrationNotStatic (8108) | YES | `[ngSkipHydration]="x"` OR `ngSkipHydration="someValue"` | **REFUTES "needs hydration context"** — bundle line 3326/3336: it is a pure static-attribute check, no hydration runtime `[VERIFIED: chunk-33J3WRHI.js:3321-3336]` |
| interpolatedSignalNotInvoked (8109) | YES (exists) | `{{ mySignal }}` (signal not invoked) | `fixtures/gate-b-error` |
| controlFlowPreventingContentProjection (8011) | YES | parent with `<ng-content>` slot; child projects an `@if` block with >1 root node into it | two-component setup; static `[VERIFIED: error_code.d.ts:306-319 example]` |
| unusedLetDeclaration (8112) | YES | `@let notUsed = 2;` declared, never read | **REFUTES "must actually fire / special setup"** — pure static template check `[VERIFIED: chunk-33J3WRHI.js:3497-3505]` |
| uninvokedTrackFunction (8115) | YES | `@for (item of items; track trackByName) {}` (track fn not invoked) | |
| unusedStandaloneImports (8113) | YES | standalone `@Component({ imports: [SomeUnused] })` not referenced in template | component-metadata check; static `[VERIFIED: chunk-33J3WRHI.js:3988-3992]` |
| unparenthesizedNullishCoalescing (8114) | YES | `{{ a && b ?? c }}` (mixed `&&`/`??` no parens) | |
| uninvokedFunctionInTextInterpolation (8117) | YES | `{{ firstName }}` where firstName is a function | |
| deferTriggerMisconfiguration (8021) | YES | `@defer (on immediate; on timer(1s)) {}` ("immediate makes additional triggers redundant") | static `[VERIFIED: chunk-33J3WRHI.js:3648-3671]` |

**Recommendation:** plan for ZERO `it.skip` rows. If, during implementation, a specific trigger proves to need non-static setup (none identified), that row becomes `it.skip` WITH A WRITTEN REASON and STAYS in the table (D-05/CAT-04). The tripwire is unaffected by skips (it consumes the row LIST, not the test outcome). Flagged as Assumption A1 — the planner should have the executor confirm each trigger fires in a real run before deleting any `it.skip` scaffolding.

## Promotability (CAT-02 / Directive 4) — CORRECTION to D-09

The CONTEXT/CONSENSUS claim is "17 of 18 promotable; NG8011 is the one exception (out-of-band, not promotable)." **The source contradicts the second half.** Findings, all cited to the runtime bundle:

1. There are **16** `extended/checks/` factory directories (not 17). The two WITHOUT a factory are NG8011 AND NG8113. `[VERIFIED: ls .../extended/checks/]`
2. The configurable/"supported" set is the FULL 18: `SUPPORTED_DIAGNOSTIC_NAMES` = `ALL_DIAGNOSTIC_FACTORIES.map(f => f.name)` (16) PLUS `CONTROL_FLOW_PREVENTING_CONTENT_PROJECTION` AND `UNUSED_STANDALONE_IMPORTS` added manually. `[VERIFIED: chunk-33J3WRHI.js:3794-3798]`
3. **Both out-of-band checks honor `extendedDiagnostics.defaultCategory`:** `controlFlowPreventingContentProjection: this.options.extendedDiagnostics?.defaultCategory || DiagnosticCategoryLabel.Warning` and the identical line for `unusedStandaloneImports`. `[VERIFIED: chunk-33J3WRHI.js:4924-4925, 4954-4955]` They also honor per-check `extendedDiagnostics.checks.*`. `[VERIFIED: chunk-33J3WRHI.js:4992-4997]`
4. **NG8011 promotion provably fires:** in `@angular/compiler`, `this.category = tcb.env.config.controlFlowPreventingContentProjection === 'error' ? OutOfBandDiagnosticCategory.Error : OutOfBandDiagnosticCategory.Warning;` then `translateCategory(Error) => ts.DiagnosticCategory.Error`. `[VERIFIED: @angular/compiler/fesm2022/compiler.mjs:32010; translateCategory @ chunk-VBOLXMVC.js:9571-9576]`
5. **NG8113 promotion provably fires:** `const category = this.typeCheckingConfig.unusedStandaloneImports === "error" ? ts25.DiagnosticCategory.Error : ts25.DiagnosticCategory.Warning;` `[VERIFIED: chunk-33J3WRHI.js:3986]`
6. The angular.dev docs corroborate: they list NG8113 as a configurable extended diagnostic with `warning`/`error`/`suppress`. `[CITED: angular.dev/extended-diagnostics]`

**Conclusion:** all 18 (not 17) are promotable via `extendedDiagnostics.defaultCategory: "error"`. The genuine distinction is *factory-based (16)* vs *out-of-band (2: NG8011, NG8113)* — NOT promotable vs not. The catalog can still keep ONE promotion proof (D-08, NG8101) and need not test per-member promotion (YAGNI holds). But the D-09 instruction to `it.skip` NG8011's promotion "because not promotable" rests on a false premise and **must be re-opened** (Open Question 1). If the planner keeps a single promotion proof, fine; but do not document NG8011 as "not promotable," and if any promotion is asserted for NG8011 it should expect an Error, not a skip.

## Baseline Codes (CAT-03)

All 12 verified against `error_code.d.ts`. Existing fixtures cover TS2339 (`ts-baseline`), NG8001 (`ng-baseline`), TS2322 + NG8109 (`gate-b-error`). The rest need fixtures (likely 1-2 new batched programs).

| Code | ErrorCode constant | line | Category | Minimal trigger | Covered today? |
|------|--------------------|------|----------|-----------------|----------------|
| TS2322 | (TypeScript) | — | Error (raw) | `count: number = 'x'` class-level type error | YES (`gate-b-error`) |
| TS2339 | (TypeScript) | — | Error (raw) | template references a missing class member | YES (`ts-baseline`) |
| NG2003 | PARAM_MISSING_TOKEN | 57 | Error | constructor with a primitive/untyped DI param lacking a token | NO |
| NG2005 | UNDECORATED_PROVIDER | 60 | Error | undecorated class passed as a provider | NO |
| NG2007 | UNDECORATED_CLASS_USING_ANGULAR_FEATURES | 70 | Error | undecorated base class uses Angular features | NO |
| NG2009 | COMPONENT_INVALID_SHADOW_DOM_SELECTOR | 80 | Error | `ViewEncapsulation.ShadowDom` + selector without a hyphen | NO |
| NG1001 | DECORATOR_ARG_NOT_LITERAL | 12 | Error | `@Component(someVar)` (metadata not a literal) | NO |
| NG3003 | IMPORT_CYCLE_DETECTED | 166 | Error | a directive/pipe relationship forcing an un-handleable cyclic import | NO (harder to stage; may need 2 files) |
| NG6100 | WARN_NGMODULE_ID_UNNECESSARY | 230 | **Warning** (note the `WARN_` prefix) | `@NgModule({ id: module.id })` | NO |
| NG8001 | SCHEMA_INVALID_ELEMENT | 238 | Error | unknown custom element in template | YES (`ng-baseline`) |
| NG8002 | SCHEMA_INVALID_ATTRIBUTE | 242 | Error | unknown attribute on a known element | NO |
| NG8004 | MISSING_PIPE | 250 | Error | template uses a pipe that isn't declared/imported | NO |

`[VERIFIED: node_modules/@angular/compiler-cli/src/ngtsc/diagnostics/src/error_code.d.ts]`

Notes for the planner:
- NG6100 is a **Warning** (`WARN_` prefix); the catalog row must expect `DiagnosticCategory.Warning` and count it in `warningCount`. The stale catalog lists it without a category.
- NG3003 (import-cycle) is the trickiest baseline to stage statically (needs a directive/pipe cross-reference cycle). If it proves non-trivial, it is still a baseline code (not an extended one) so CAT-03 requires asserting it by exact code — keep it; if unreproducible, document why (but baseline codes are not governed by the CAT-04 `it.skip` rule, which is scoped to the 18 extended members — flag to the planner that baseline rows have no `it.skip` carve-out in the requirements).
- The stale catalog's "aliases" (NG8004 (NG1019), NG2005 (NG1005), NG3003 (NG8003)) are NOT in the v22.0.4 `error_code.d.ts` — those alias numbers do not appear. Use the verified primary codes only; the rewrite (CAT-05) should drop the alias parentheticals unless re-verified.

## Code Examples

### The catalog table + `it.each` (sketch — mirror `extended.angular13.integration.spec.ts` + `run-typecheck.integration.spec.ts`)

```typescript
// Source: mirrors packages/angular-typechecker/src/core/extended.angular13.integration.spec.ts
//         + run-typecheck.integration.spec.ts (describe.each idiom)
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { NG } from './diagnostic-codes';
import { runTypecheck } from './run-typecheck';
import { EXTENDED_DIAGNOSTIC_MEMBERS } from './extended-catalog.members'; // the single `as const` list (D-02)

interface CatalogRow {
  member: (typeof EXTENDED_DIAGNOSTIC_MEMBERS)[number]; // the enum string value
  ngCode: number;                 // 4-digit, fed to NG()
  expectedCategory: ts.DiagnosticCategory;
  expectedCount: number;          // exact occurrence count
  introVersion: string;           // row field, NOT a file split (D-05)
  fixtureTsConfig: string;
  skipReason?: string;            // present => it.skip, row stays (D-05/CAT-04)
}

const CATALOG: readonly CatalogRow[] = [
  { member: 'invalidBananaInBox', ngCode: 8101, expectedCategory: ts.DiagnosticCategory.Warning, expectedCount: 1, introVersion: 'v13', fixtureTsConfig: extendedV13TsConfig },
  // ... 17 more rows, ENUM-ORDER, one per member ...
];

describe.each(CATALOG)('extended diagnostic %s', (row) => {
  const maybe = row.skipReason ? it.skip : it;

  maybe(`NG${row.ngCode}: exact code + category + count`, async () => {
    const result = await runTypecheck({ tsConfigPath: row.fixtureTsConfig });

    const hits = result.diagnostics.filter((d) => d.code === NG(row.ngCode));

    expect(hits.length).toBe(row.expectedCount);
    expect(hits[0]?.category).toBe(row.expectedCategory);
  });
});
```

### The DRIFT-01 type-level tripwire (sketch — mirror `compiler-cli-types.drift.ts`)

```typescript
// Source: mirrors packages/angular-typechecker/src/core/compiler-cli-types.drift.ts
//         (AssertAssignable helper + classic-resolution deep import; noEmit; never ships)
// Deep specifier: the enum is NOT on the barrel index.d.ts. Use the diagnostics sub-barrel.
// VERIFY the exact specifier compiles under tsconfig.drift.json (classic moduleResolution: node):
//   '@angular/compiler-cli/src/ngtsc/diagnostics'        (sub-barrel re-export, index.d.ts:12)
//   or the leaf '.../diagnostics/src/extended_template_diagnostic_name'
import { ExtendedTemplateDiagnosticName } from '@angular/compiler-cli/src/ngtsc/diagnostics';

import { EXTENDED_DIAGNOSTIC_MEMBERS } from './extended-catalog.members'; // the `as const` list (D-02)

// Compare the enum's STRING-VALUE union against the catalog list (recommended): the catalog
// rows ARE keyed on the string values ('invalidBananaInBox'), and runtime assertions use those
// strings, so a value-union comparison is the honest contract. (Member-NAME keys would force the
// catalog to carry SCREAMING_SNAKE keys it does not otherwise use.)
type EnumValues = `${ExtendedTemplateDiagnosticName}`;
type CatalogValues = (typeof EXTENDED_DIAGNOSTIC_MEMBERS)[number];

// Mutual set-equality: a member ADDED upstream fails the second probe; a member REMOVED/RENAMED
// upstream fails the first. AssertAssignable<From, To extends From> from the existing drift file.
type AssertAssignable<From, To extends From> = true;

type CatalogCoversEnum = AssertAssignable<CatalogValues, EnumValues>;   // enum ⊆ catalog
type EnumCoversCatalog = AssertAssignable<EnumValues, CatalogValues>;   // catalog ⊆ enum

void (0 as unknown as CatalogCoversEnum);
void (0 as unknown as EnumCoversCatalog);
```

Wiring (mirror the existing drift wiring):
- Add `"src/core/extended-catalog.drift.ts"` to `tsconfig.drift.json` `"files"` (alongside the existing `compiler-cli-types.drift.ts`). `[VERIFIED: tsconfig.drift.json:12]`
- Add the new file (and `'@angular/compiler-cli'` is already an `externalDependencies` input) to the `typecheck-drift` target `inputs[]` in `project.json` so Nx cache-invalidates on a change. `[VERIFIED: project.json:45-61]`
- The `*.drift.ts` glob already excludes it from `tsconfig.lib.json`/`tsconfig.spec.json` -> it never reaches build/test/tarball. `[VERIFIED]`
- The CI gate already runs `nx run-many -t typecheck-drift test -p angular-typechecker` (TESTING.md) -> no `ci.yml` change.

### Promotion proof (CAT-02 — already exists, reuse verbatim)

`fixtures/extended-promoted/tsconfig.app.json` sets `angularCompilerOptions.extendedDiagnostics.defaultCategory: "error"`; the existing `extended.promotion.integration.spec.ts` asserts NG8101 lands as `DiagnosticCategory.Error` in `errorCount`. Fold this into the catalog as the single promotion row (D-07/D-08). `[VERIFIED: read 2026-07-01]`

## Runtime State Inventory

Not a rename/refactor/migration phase — but it has a doc-rewrite (CAT-05) and folds three spec files. The relevant "stale state after the change" inventory:

| Category | Items | Action Required |
|----------|-------|-----------------|
| Stored data | None — verified (no datastore touches a diagnostic code as a key). | none |
| Live service config | None — verified (no external service holds the catalog). | none |
| OS-registered state | None — verified. | none |
| Secrets/env vars | None — verified. | none |
| Build artifacts | The folded specs (`extended.angular13.integration.spec.ts`, `extended.promotion.integration.spec.ts`, `baseline.angular13.integration.spec.ts`) — if absorbed into the catalog, the old files must be DELETED (not left as dead duplicates) so there is ONE catalog of record (D-07). TESTING.md's spec-count tally ("10 integration spec files") will need updating. | delete old specs; update TESTING.md counts in the same phase or note for a follow-up |

## Common Pitfalls

### Pitfall 1: Trusting the angular.dev docs list for membership
**What goes wrong:** the docs list 16 diagnostics and OMIT NG8011 and NG8112 (and the docs treat NG8113 as a normal entry). Driving the catalog from the docs under-covers by 2 and re-introduces the exact bug CAT-05 fixes.
**Why:** the enum (build/test source of truth) is a SUPERSET of the docs. `[VERIFIED: docs omit NG8011/NG8112; enum includes both]`
**How to avoid:** drive the catalog and the tripwire from the ENUM (the whole point of DRIFT-01). Docs are a names/intro-version cross-check only.
**Warning signs:** a catalog with 16 rows; a tripwire that passes against a 16-entry list.

### Pitfall 2: Asserting NG8011 promotion is impossible
**What goes wrong:** following D-09 verbatim, the catalog documents NG8011 as "not promotable" and skips its promotion — but the compiler DOES promote it (verified). Future readers inherit a false fact, and a "negative" assertion (expect-warning-even-with-defaultCategory-error) would FAIL.
**Why:** the out-of-band checks (NG8011, NG8113) honor `defaultCategory` exactly like factory checks. `[VERIFIED: compiler.mjs:32010; chunk-33J3WRHI.js:3986]`
**How to avoid:** re-open D-09 (Open Question 1). Keep ONE promotion proof (NG8101). If documenting NG8011's nature, say "emitted out-of-band (no factory) but still promotable," not "not promotable."

### Pitfall 3: The enum import resolving empty / failing under the wrong tsconfig
**What goes wrong:** importing `ExtendedTemplateDiagnosticName` from `'@angular/compiler-cli'` resolves to nothing (it's not on the barrel), or the deep import that works under classic `node` resolution breaks under `nodenext` (lib/spec).
**Why:** the barrel omits the enum (`index.d.ts:30`); the sub-barrel `src/ngtsc/diagnostics/index.d.ts:12` has it; classic resolution walks into the package, `nodenext` refuses extensionless deep paths. There is NO existing deep-import precedent in the repo (the current drift file uses the barrel for `Program`/`EmitFlags`). `[VERIFIED: git grep found no @angular/compiler-cli/src import]`
**How to avoid:** put the tripwire ONLY in `extended-catalog.drift.ts` (classic resolution via `tsconfig.drift.json`); verify the exact specifier compiles by running `nx typecheck-drift` during implementation; keep the `*.drift.ts` name so build/test exclude it.
**Warning signs:** TS2305 ("has no exported member") in `nx build`/`nx test` (means the file leaked out of the drift tsconfig); the tripwire passing trivially (means the import resolved to `any`/empty).

### Pitfall 4: Occurrence-count collisions in a batched fixture
**What goes wrong:** two checks fire on the same template node, or one trigger incidentally produces a second diagnostic, so an exact-count assertion fails.
**Why:** the catalog asserts exact `expectedCount` per code; batching multiplies the chances of an incidental extra diagnostic.
**How to avoid:** build each fixture so each batched code has exactly one clean trigger and no incidental TS/NG error (the existing fixtures' headers explicitly engineer "the diagnostic is the ONLY diagnostic"). Split a batch the moment a count collides (D-03 allows it).

### Pitfall 5: 30s cold-compile timeout / Windows arm64 flake
**What goes wrong:** more fixtures = more cold `performCompilation` runs; the default 5000ms Vitest timeout flakes.
**Why:** each cold run is ~0.5s but ESM load + whole-program check on slow hardware can spike.
**How to avoid:** the plugin `vitest.config.mts` already sets `testTimeout`/`hookTimeout` to 30000 (TESTING.md). Keep the catalog in the plugin tier (it inherits that). Do not add new fixtures that each spawn a fresh program when they could batch.

## State of the Art

| Old (stale `DIAGNOSTIC-CATALOG.md`) | Current (source-verified) | Why it changed |
|-------------------------------------|---------------------------|----------------|
| 16-entry docs-derived extended list | 18-member enum (adds NG8011, NG8112) | The enum is the build/test source of truth; docs lag/omit |
| NG8112 (`unusedLetDeclaration`) excluded as "undocumented" | NG8112 IS an enum member (decl index 12) | `[VERIFIED: enum line 30]` |
| "Mirror the per-introduction-version file split" test org | Single enum-keyed `it.each`, intro-version a row field + completeness tripwire | D-05/D-01; per-version files would silently under-cover |
| Inject errors via jscodeshift | Committed static fixtures | Board CONSENSUS D6 (OUT OF SCOPE) |
| 17 promotable / NG8011 not promotable | All 18 promotable; the real split is factory (16) vs out-of-band (2: NG8011, NG8113) | `[VERIFIED: bundle source]` |
| NG8004 (NG1019), NG2005 (NG1005), NG3003 (NG8003) aliases | No such alias numbers in v22.0.4 `error_code.d.ts` | Drop the alias parentheticals unless re-verified |

**Deprecated/outdated to remove in the rewrite:** the per-version test-org guidance; the jscodeshift injection guidance; the 16-entry table; the alias parentheticals; the "NG8011 not promotable" framing.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | All 18 extended members are reproducible by a static fixture (zero `it.skip` needed) — based on reading each check's trigger, NOT yet from a green real-compiler run | Reproducibility | LOW-MEDIUM. If a specific trigger needs non-static setup, that row becomes `it.skip` w/ reason (CAT-04 allows it; tripwire unaffected). The executor should confirm each fires before deleting skip scaffolding. |
| A2 | The deep specifier `'@angular/compiler-cli/src/ngtsc/diagnostics'` resolves the enum under classic `node` resolution in `tsconfig.drift.json` — verified the sub-barrel re-exports it; NOT yet compiled in this session | Code Examples / Pitfall 3 | LOW. If it doesn't, fall back to the leaf path `.../diagnostics/src/extended_template_diagnostic_name`. Verify with `nx typecheck-drift` in the first plan. |
| A3 | Comparing the enum's string-VALUE union against the catalog's `as const` value list (not member-NAME keys) is the right tripwire form | Code Examples | LOW. Both forms catch add/rename/remove; values align with how the runtime table is keyed (D-04). |
| A4 | Default category for ALL 18 is Warning under `strictTemplates: true` with no override — verified the factory default + both out-of-band defaults are `Warning` | Standard Stack table | LOW. `[VERIFIED]` but a fixture that incidentally sets a per-check category would change the observed category; keep fixtures override-free except the promotion fixture. |

## Open Questions

> **ORCHESTRATOR RESOLUTION (2026-07-01) -- OQ1 is RESOLVED; treat the entry below as historical.**
> NG8011 IS promotable, confirmed three independent ways: docs (general `defaultCategory` rule +
> NG8113 is documented-yet-out-of-band) + `@angular/compiler-cli@22.0.4` source (read at tag
> `v22.0.4`: `SUPPORTED_DIAGNOSTIC_NAMES` lists all 18; `core/src/compiler.ts:1112-1115` wires
> both out-of-band fields to `defaultCategory`; `extended_template_checker.ts:40-44` for the 16
> factories) + an empirical `runTypecheck` probe (NG8011 = Warning by default, = Error under
> `defaultCategory:"error"`; single diagnostic `-998011`). The user chose "Correct it": the
> catalog treats NG8011 as a normal promotable member -- NO `it.skip` for promotion, NO "not
> promotable" framing, and NO test asserting it stays a Warning under `defaultCategory:"error"`.
> CONTEXT.md D-09 is corrected; D-13 flags CAT-02/CONSENSUS as superseded for the milestone audit
> (their text is left as-is, no re-ratification this phase). CAT-02 stays satisfied by the single
> NG8101 promotion proof (D-08).

1. **D-09 contradiction — is NG8011 "not promotable"? (HIGH IMPACT, re-open required.)**
   - What we know: the runtime bundle + `@angular/compiler` source prove NG8011 (and NG8113) DO honor `extendedDiagnostics.defaultCategory: "error"` and emit an Error when promoted. `[VERIFIED: compiler.mjs:32010; chunk-33J3WRHI.js:3986, 4924-4925]`
   - What's unclear: nothing technical — the source is unambiguous. What's unclear is the DECISION: D-09 (a locked decision) instructs the catalog to treat NG8011 as not promotable and skip its promotion case. This is a HIGH-IMPACT, hard-to-reverse documentation/test claim that contradicts the phase's own source.
   - Recommendation: per the global rule on auto-locked HIGH-IMPACT/NOW-LOW-CONFIDENCE decisions, the planner should re-open D-09 (interactive discuss or cross-AI review). Concretely: keep ONE promotion proof (NG8101, D-08), do NOT add a per-member promotion test (YAGNI), but RE-WORD any NG8011/NG8113 framing from "not promotable" to "emitted out-of-band (no `extended/checks/` factory) but still promotable via `defaultCategory`." Do not write a test that asserts NG8011 stays a Warning under `defaultCategory: "error"` — it would fail.

2. **NG3003 (import-cycle) static reproducibility for CAT-03.**
   - What we know: NG3003 = `IMPORT_CYCLE_DETECTED` (line 166); it needs a directive/pipe relationship forcing an un-handleable cyclic import — harder to stage than the other baselines.
   - What's unclear: whether a 2-file static fixture reliably triggers it under the engine's whole-program check, or whether partial-compilation mode is needed.
   - Recommendation: attempt a static 2-file fixture first; if it won't fire deterministically, flag to the planner that baseline codes (CAT-03) have NO `it.skip` carve-out in the requirements (the `it.skip` rule is scoped to the 18 extended members) — so an unreproducible baseline code is a requirements question, not an auto-skip.

3. **TESTING.md spec-count drift after folding three specs into one.**
   - What we know: D-07 folds `extended.angular13`, `extended.promotion`, `baseline.angular13` into the catalog; TESTING.md tallies "10 integration spec files."
   - Recommendation: update TESTING.md's counts in this phase (or note a follow-up) so the codebase map stays accurate (AGENTS.md requires `AGENTS.md` changes be reviewed; TESTING.md is a planning doc, lighter-weight, but keep it honest).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@angular/compiler-cli` | every catalog/baseline integration assertion + the tripwire's enum | YES | 22.0.4 (installed) | none needed |
| `typescript` | category/diagnostic types; `tsc` for `typecheck-drift` | YES | 6.0.3 (installed) | none needed |
| `vitest` via `@nx/vitest:test` | the `it.each` runner | YES | ~4.1.0 | none needed |
| Nx `typecheck-drift` target | DRIFT-01 home | YES (wired in `project.json`) | — | none needed |

No external/network dependencies. No missing dependencies. The dev-repo `.npmrc legacy-peer-deps=true` is a dev-install convenience (STATE.md) and is irrelevant unless the planner adds a dev dep (it should not).

## Validation Architecture

Nyquist validation is enabled (config absent => enabled). All requirements are validated by automated Vitest integration assertions + the `typecheck-drift` type-check.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `~4.1.0` via `@nx/vitest:test` |
| Config file | `packages/angular-typechecker/vitest.config.mts` (globals: true; testTimeout/hookTimeout 30000) |
| Quick run command | `npx nx test angular-typechecker --skip-nx-cache` |
| Full suite command | `npx nx run-many -t typecheck-drift test -p angular-typechecker` (drift + test; the CI plugin gate) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAT-01 | all 18 extended members assert exact code+category+count vs real compiler | integration (`it.each`) | `npx nx test angular-typechecker -- extended-catalog.integration` | NEW (Wave 0) |
| CAT-02 | one promotion proof: NG8101 warning -> error under `defaultCategory: "error"` | integration | (same spec; folded promotion row) | partially exists (`extended.promotion.integration.spec.ts` + `fixtures/extended-promoted`) — fold in |
| CAT-03 | 12 baseline TS/NG codes assert by exact code | integration (sibling `it.each`) | (same spec; baseline table) | partially exists (`baseline.angular13`, `ts-baseline`, `ng-baseline`, `gate-b-error`) — extend |
| CAT-04 | single enum-keyed table; intro-version a row field; non-reproducible = `it.skip` w/ reason, row stays | integration (table shape) | (same spec) | NEW (Wave 0) |
| CAT-05 | `DIAGNOSTIC-CATALOG.md` rewritten to the authoritative 18-member set | doc rewrite (verified by review + the tripwire keeping it honest) | manual review + `git diff`; tripwire enforces the SET | NEW (doc) |
| DRIFT-01 | catalog set === enum; CI fails loudly on add/rename/remove | type-level (typecheck-drift) | `npx nx typecheck-drift angular-typechecker` | NEW (Wave 0) |

### Sampling Rate
- **Per task commit:** `npx nx test angular-typechecker --skip-nx-cache` (the catalog spec is the unit of work; run it after each fixture/row addition).
- **Per wave merge:** `npx nx run-many -t typecheck-drift test -p angular-typechecker` (drift + full plugin test; proves the tripwire compiles AND the catalog is green together).
- **Phase gate:** full suite green (drift + test) before `/gsd-verify-work`. The tripwire is the structural guarantee that the catalog stays in lockstep with the enum.

### Wave 0 Gaps
- [ ] `packages/angular-typechecker/src/core/extended-catalog.members.ts` — the single `as const` member-value list (D-02 source of truth) consumed by BOTH the spec and the tripwire.
- [ ] `packages/angular-typechecker/src/core/extended-catalog.integration.spec.ts` — the 18-row extended `it.each` + the baseline sibling `it.each` (folds the 3 existing specs).
- [ ] `packages/angular-typechecker/src/core/extended-catalog.drift.ts` — the type-level enum-vs-table tripwire (added to `tsconfig.drift.json` `files` + `typecheck-drift` inputs).
- [ ] New batched fixtures under `fixtures/` (~8: Batch A-D + own-programs for 8108/8113/8021/8011) for the ~13 extended members not covered by existing fixtures, plus 1-2 baseline fixtures for the 9 uncovered baseline codes.
- [ ] Delete the folded specs (`extended.angular13`, `extended.promotion`, `baseline.angular13`) once absorbed (D-07); update TESTING.md counts.
- [ ] Framework install: none — Vitest + the `typecheck-drift` target already exist.

## Security Domain

`security_enforcement` posture: this phase is test/doc-only, adds no runtime code path, no new dependency, no network, no untrusted input, no auth/crypto/data handling. The only "input" is the committed fixtures (authored in-repo) fed to the locked, lockfile-pinned compiler. No ASVS category applies. No new threat surface is introduced. (If the planner unexpectedly adds a dependency or a script, run the Package Legitimacy Gate then.)

## Sources

### Primary (HIGH confidence) — the installed package is authoritative for codes/membership
- `node_modules/@angular/compiler-cli/src/ngtsc/diagnostics/src/extended_template_diagnostic_name.d.ts` (read) — the 18-member enum + declaration order.
- `node_modules/@angular/compiler-cli/src/ngtsc/diagnostics/src/error_code.d.ts` (read) — every NG code + line number.
- `node_modules/@angular/compiler-cli/bundles/chunk-33J3WRHI.js` (read) — `ALL_DIAGNOSTIC_FACTORIES`, `SUPPORTED_DIAGNOSTIC_NAMES`, the factory default-category line (3727), the two out-of-band `defaultCategory` lines (4924-4925/4954-4955/4992-4997), NG8113 promotion (3986), the NG8021/NG8112/NG8108 trigger checks (3321-3336, 3497-3531, 3648-3713).
- `node_modules/@angular/compiler/fesm2022/compiler.mjs` (read) — NG8011 promotion (`controlFlowPreventingContentProjection === 'error'`, line 32010) + `OutOfBandDiagnosticCategory` (30023-30027).
- `node_modules/@angular/compiler-cli/index.d.ts` (read) + `.../src/ngtsc/diagnostics/index.d.ts` (read) — barrel does NOT export the enum; sub-barrel does (the deep-import specifier).
- `node_modules/@angular/compiler-cli/src/ngtsc/typecheck/extended/` (`ls`) — 16 factory dirs + `index.d.ts` `ALL_DIAGNOSTIC_FACTORIES`.
- Repo files (read): `compiler-cli-types.drift.ts`, `tsconfig.drift.json`, `diagnostic-codes.ts`, `run-typecheck.ts`, the 3 existing integration specs, the 5 fixtures, `project.json`, `tsconfig.lib.json`, `tsconfig.spec.json`, `compiler-cli-types.ts`.

### Secondary (MEDIUM confidence) — cross-check only
- `angular.dev/extended-diagnostics` (WebFetch) — confirmed the docs list 16, include NG8113, omit NG8011/NG8112, and document `defaultCategory`/per-check `warning`/`error`/`suppress`. Names/intro-version cross-check; the enum overrides for membership.

### Planning inputs (read)
- `12-CONTEXT.md`, `REQUIREMENTS.md`, `board2/CONSENSUS.md`, `DIAGNOSTIC-CATALOG.md` (stale, the BEFORE state), `TESTING.md`, `STATE.md`, `CLAUDE.md`, `AGENTS.md`.

## Metadata

**Confidence breakdown:**
- Standard stack (enum + codes + categories): HIGH — every cell cited to the installed `.d.ts`/bundle with line numbers.
- Architecture (catalog shape, fixture batching, tripwire form): HIGH for the mechanism (mirrors existing verified patterns); MEDIUM for exact fixture grouping (an implementation discovery, D-03) and the deep-import specifier (verified re-export, not yet compiled — A2).
- Pitfalls: HIGH — derived from source + existing codebase headers.
- Promotability correction (D-09): HIGH — three independent source citations (two bundle chunks + the compiler `.mjs`) plus docs corroboration.

**Research date:** 2026-07-01
**Valid until:** until the next `@angular/compiler-cli` minor (the enum is the moving target; the tripwire is precisely the guard for that). For the locked 22.0.4 pin: stable.
