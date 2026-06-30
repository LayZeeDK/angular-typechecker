# Phase 12: Extended-diagnostic catalog + completeness tripwire - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning
**Mode:** `--auto --analyze --chain` (autonomous single-pass; trade-off tables logged in DISCUSSION-LOG.md; auto-advances to plan-phase with `--research`)

<domain>
## Phase Boundary

The integration suite proves angular-typechecker observes the COMPLETE Angular 22
diagnostic surface -- all 18 `ExtendedTemplateDiagnosticName` members plus the baseline
TS/NG codes -- by EXACT identity (code + `DiagnosticCategory` + occurrence count), over
committed fixtures against the real `@angular/compiler-cli@22.0.4`; and a completeness
tripwire makes any future Angular release that adds/renames/removes an extended-diagnostic
member fail CI LOUDLY instead of silently under-covering.

Requirements CAT-01..05 + DRIFT-01 are locked (see REQUIREMENTS.md). This phase is
engine-only and generator-independent. **This is a HOW-only discussion** -- the WHAT is
fixed by the roadmap success criteria and the board-ratified testing strategy.

**In scope:** the 18-member enum-keyed `it.each` catalog; baseline TS/NG code assertions;
one severity-promotion proof; the enum-vs-table completeness tripwire; correcting
`research/DIAGNOSTIC-CATALOG.md`.

**Out of scope (own phases / deferred):** the `typecheck-configuration` generator (Phase 13);
generator e2e + `-p` guard (Phase 14); per-member promotion testing; `jscodeshift`
error-injection; new e2e projects; Verdaccio; `NgtscProgram` per-file recovery.
</domain>

<decisions>
## Implementation Decisions

All five decisions auto-selected the recommended option (single `--auto` pass). Each is
evidence-backed by the ratified board CONSENSUS, the locked requirements, or facts verified
against the installed `@angular/compiler-cli@22.0.4` -- none sits in the HIGH-IMPACT +
LOW-CONFIDENCE trap quadrant, so auto-locking the DIRECTION is appropriate. Exact mechanics
are handed to plan-phase research (`--research`) as the directives below.

### GA-1 -- Completeness-tripwire mechanism (DRIFT-01)
- **D-01:** The tripwire is a **type-level assertion** that mirrors the EXISTING
  `packages/angular-typechecker/src/core/compiler-cli-types.drift.ts`, run by the existing
  `typecheck-drift` Nx target (NOT a runtime Vitest spec). Rationale (VERIFIED):
  `ExtendedTemplateDiagnosticName` is **not a public runtime export** of
  `@angular/compiler-cli` -- `require('@angular/compiler-cli').ExtendedTemplateDiagnosticName`
  is `undefined`, it is absent from the top-level `index.d.ts`, and the package `exports`
  map exposes no `src/ngtsc/...` subpath. The enum's deep type is reachable only under
  CLASSIC `moduleResolution: node` (exactly the regime `tsconfig.drift.json` already uses,
  because the production `nodenext` build resolves the compiler-cli barrel EMPTY). DRIFT-01's
  own text allows "the `test` (or `typecheck-drift`) job"; the drift job is the right home.
- **D-02:** Single source of truth: the catalog's 18 row keys and the tripwire's asserted
  set MUST derive from ONE declaration (e.g. the `it.each` table's `as const` member list),
  so the runtime table and the type-level tripwire cannot drift from each other. The tripwire
  asserts mutual set-equality between that list and the real `ExtendedTemplateDiagnosticName`
  (a member added/renamed/removed upstream fails the assertion at its slot).

### GA-2 -- Fixture strategy for the 18-member catalog (CAT-01)
- **D-03:** **Batch fixtures per program where practical** (consensus D2). Reuse the EXISTING
  `fixtures/extended-v13/` (NG8101 warning-default) and `fixtures/extended-promoted/`
  (NG8101 promoted to error). Group the remaining extended checks into a small number of new
  fixture programs rather than 18 separate trees (cold `performCompilation` is ~0.5s/fixture;
  fewer programs = cheaper CI). The exact grouping is an implementation discovery -- checks
  whose templates conflict in one component split into their own program.
- **D-04:** Each catalog row maps `enum member -> { NG code, expected DiagnosticCategory,
  occurrence count, introduction-version, fixture ref, optional skip-reason }`. Assertions
  use the existing `NG()` helper (`diagnostic.code === NG(8101)`); counting is ALWAYS by
  `ts.DiagnosticCategory`, never by code sign (L-4).

### GA-3 -- Catalog spec layout + table shape (CAT-03, CAT-04)
- **D-05:** A SINGLE new data-driven spec (`extended-catalog.integration.spec.ts` or similar)
  holds the 18-row `it.each` table keyed on the enum members, with introduction-version as a
  ROW FIELD (not a per-version file split). Any member not reproducible by a static Angular
  22.0.4 fixture is `it.skip` WITH A WRITTEN REASON and its row STAYS in the table (so the
  tripwire stays honest). This SUPERSEDES the OLD catalog's "mirror the per-introduction-version
  split (`executor.angularNN.integration.spec.ts`)" guidance.
- **D-06:** The baseline TS/NG codes (CAT-03: TS2322, TS2339, NG2003, NG2005, NG2007, NG2009,
  NG1001, NG3003, NG6100, NG8001, NG8002, NG8004) are asserted by exact code in a sibling
  `it.each` table (extend/absorb `baseline.angular13.integration.spec.ts`).
- **D-07:** The existing `extended.angular13.integration.spec.ts` and
  `extended.promotion.integration.spec.ts` are folded into / referenced by the catalog so
  there is ONE catalog of record (no duplicate NG8101 assertions drifting independently).

### GA-4 -- Severity-promotion coverage depth (CAT-02)
- **D-08:** Keep ONE promotion proof -- NG8101 via the existing `fixtures/extended-promoted/`
  tsconfig (`extendedDiagnostics.defaultCategory: "error"` flips the warning-default to an
  error) -- per CAT-02 / consensus "at least one". Per-member promotion testing is YAGNI.
- **D-09:** NG8011 (`controlFlowPreventingContentProjection`) is asserted at its OBSERVED
  category, and its promotion case is explicitly `it.skip` WITH A REASON (emitted out-of-band,
  no `extended/checks/` factory, NOT promotable via `extendedDiagnostics`). 17 of 18 are
  promotable; NG8011 is the one exception.

### GA-5 -- `DIAGNOSTIC-CATALOG.md` correction scope (CAT-05)
- **D-10:** FULL rewrite of the extended-diagnostics section of
  `.planning/research/DIAGNOSTIC-CATALOG.md` to the SOURCE-VERIFIED authoritative 18-member
  `ExtendedTemplateDiagnosticName` set (name + NG code + category + introduction-version).
- **D-11:** Correct the VERIFIED error in the OLD catalog: `unusedLetDeclaration` (NG8112)
  IS an `ExtendedTemplateDiagnosticName` enum member -- the OLD catalog wrongly excluded it
  as "held by undocumented compiler diagnostics / NOT on the extended-diagnostics docs list."
  The enum (build/test-time source of truth) DIFFERS from the angular.dev docs list; the enum
  wins. This docs-vs-enum gap is precisely why DRIFT-01 consumes the ENUM, not the docs/range.
- **D-12:** Note that NG8110 (`UNSUPPORTED_INITIALIZER_API_USAGE`) and NG8118 are `ErrorCode`s
  but are NOT configurable extended diagnostics (not in the enum). Replace the stale
  per-version-file-split "Test organization" guidance with the single enum-keyed `it.each` +
  completeness-tripwire decision (D-01/D-05).

### Claude's Discretion (research directives for plan-phase `--research`)
The following are NOT user gray areas -- they are facts/choices for the researcher to PIN and
the planner to encode. They are pre-grounded here so research is targeted, not open-ended:

1. **Pin the exact 18 member->NG-code mapping** against the installed
   `@angular/compiler-cli@22.0.4` `extended_template_diagnostic_name.d.ts` +
   `error_code.d.ts`. Three already source-verified this session: NG8011
   (`controlFlowPreventingContentProjection`), NG8021 (`deferTriggerMisconfiguration`), NG8112
   (`unusedLetDeclaration`). The set = {NG8011, NG8021} U {NG8101..8117 MINUS NG8110}. Note the
   enum DECLARATION order != code order; carry both name and code per row.
2. **Determine which members are NOT reproducible by a static fixture under Angular 22.0.4**
   (candidates needing special setup: `skipHydrationNotStatic` [hydration context],
   `deferTriggerMisconfiguration` [`@defer` triggers], `unusedStandaloneImports`/
   `unusedLetDeclaration` [require the check to actually fire]). Each non-reproducible member
   becomes `it.skip` with a written reason (CAT-04); its row stays.
3. **Confirm the tripwire's exact form:** the deep-import specifier for the enum under classic
   resolution (mirror how `compiler-cli-types.drift.ts` imports real types), and whether the
   set-equality assertion compares the enum's string-VALUE union (`\`${ExtendedTemplateDiagnosticName}\``)
   or its member-NAME keys against the catalog's `as const` list.
4. **Verify the promotability nuance** (17 promotable, NG8011 not) against the
   `extended/checks/` factory registration set, and confirm each member's default
   `DiagnosticCategory`.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Strategy / requirements (read FIRST)
- `.planning/research/v0.0.4-testing/board2/CONSENSUS.md` -- the UNANIMOUS 8-lens board
  ratification of the v0.0.4 testing strategy. D2 governs this phase (18-member enum-keyed
  `it.each`, exact code+category+count, one promotion case, NG8011 out-of-band, enum-vs-table
  tripwire, batch fixtures per program). Authoritative over the OLD DIAGNOSTIC-CATALOG.md.
- `.planning/REQUIREMENTS.md` (CAT-01..05, DRIFT-01) -- the locked requirements for this phase.
- `.planning/ROADMAP.md` (Phase 12 "Phase Details") -- goal-backward success criteria 1-5.

### Diagnostic catalog (to be CORRECTED by this phase -- currently STALE)
- `.planning/research/DIAGNOSTIC-CATALOG.md` -- the doc CAT-05 rewrites. WARNING: its current
  extended-diagnostics table is docs-derived (16 entries), wrongly EXCLUDES NG8112
  (`unusedLetDeclaration`), and its per-version-split "Test organization" guidance CONTRADICTS
  CAT-04. Treat as the BEFORE state, not as truth, until rewritten under D-10..D-12.

### Existing code patterns to mirror / extend
- `packages/angular-typechecker/src/core/compiler-cli-types.drift.ts` -- the EXISTING build-time
  drift tripwire to MIRROR for DRIFT-01 (deep real-compiler-cli type import under classic node
  resolution; type-level `AssertAssignable` probes; value-level pins).
- `packages/angular-typechecker/tsconfig.drift.json` -- the `typecheck-drift` target's tsconfig
  (classic `moduleResolution: node`, `ignoreDeprecations: "6.0"`, `noEmit`). The new tripwire
  compiles ONLY here (excluded from `tsconfig.lib.json`/`tsconfig.spec.json`, never ships).
- `packages/angular-typechecker/src/core/diagnostic-codes.ts` -- the `NG()` / `ngCodeOf()`
  encoding helpers (`NG(8101) === -998101`). All NG-code assertions go through `NG()`.
- `packages/angular-typechecker/src/core/extended.angular13.integration.spec.ts` -- existing
  NG8101 warning-default spec (fold into the catalog).
- `packages/angular-typechecker/src/core/extended.promotion.integration.spec.ts` -- existing
  NG8101 promotion proof (reuse for CAT-02 / D-08).
- `packages/angular-typechecker/src/core/baseline.angular13.integration.spec.ts` -- baseline
  TS/NG codes spec (extend/absorb for CAT-03 / D-06).
- `fixtures/extended-v13/` and `fixtures/extended-promoted/` -- existing reusable fixtures
  (NG8101 warning + promoted). New fixtures live under `fixtures/<scenario>/` (workspace root).

### Codebase maps
- `.planning/codebase/TESTING.md` -- test tiers, naming (`*.integration.spec.ts`), fixtures
  convention, the `NG()` negative-encoding rule, 30s integration timeout, `typecheck-drift`
  target description.

### Source of truth (deep, NOT public exports -- read via the installed package)
- `node_modules/@angular/compiler-cli/src/ngtsc/diagnostics/src/extended_template_diagnostic_name.d.ts`
  -- the authoritative 18-member enum.
- `node_modules/@angular/compiler-cli/src/ngtsc/diagnostics/src/error_code.d.ts` -- the
  numeric `ErrorCode` mapping (NG8011=8011, NG8021=8021, NG8101=8101, NG8110=8110, NG8112=8112,
  ...). NOTE: not a public export; reachable only under classic resolution.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `compiler-cli-types.drift.ts` + `tsconfig.drift.json` + the `typecheck-drift` Nx target:
  a ready-made, CI-wired home for the type-level completeness tripwire (D-01). No new CI cell.
- `diagnostic-codes.ts` `NG()`: every extended/NG assertion already routes through it.
- `fixtures/extended-v13/` and `fixtures/extended-promoted/`: cover NG8101 warning + promotion
  (D-03, D-08) -- no new fixture needed for NG8101.
- `baseline.angular13.integration.spec.ts`, `extended.angular13.integration.spec.ts`,
  `extended.promotion.integration.spec.ts`: existing specs to fold into the catalog of record.

### Established Patterns
- Integration specs call `runTypecheck({ tsConfigPath })` against a `fixtures/*` tsconfig and
  assert off `CoreResult` (`diagnostics`, `errorCount`, `warningCount`); find a diagnostic by
  `code === NG(xxxx)`, assert `.category`; count by `DiagnosticCategory`, never code sign.
- Fixtures resolve paths via `fileURLToPath(import.meta.url)` + `join(...)` (cwd-independent);
  in-plugin integration specs auto-route into the existing 6-cell `test` matrix (no `ci.yml`
  change -- consensus D5).
- `it.each` / `describe.each` is already the idiom for parameterized integration cases
  (`run-typecheck.integration.spec.ts`, `matrix-5types.int.spec.ts`).
- The drift pattern: import REAL compiler-cli types under classic resolution, assert at the
  type level, pin values; the file is `noEmit`, excluded from lib/spec tsconfigs, never ships.

### Integration Points
- New catalog spec(s) land under `packages/angular-typechecker/src/core/*.integration.spec.ts`
  (auto-included by the plugin `vitest.config.mts` globs; `test` `dependsOn: ["build"]`).
- New tripwire `.drift.ts` lands under `src/core/`, included ONLY by `tsconfig.drift.json`
  and run by `typecheck-drift` (CI already runs `run-many -t typecheck-drift test -p
  angular-typechecker`).
- New fixtures land under `fixtures/<scenario>/` (workspace root, plugin integration tier).
</code_context>

<specifics>
## Specific Ideas (source-verified this session, 2026-07-01)

- The 18 `ExtendedTemplateDiagnosticName` members (installed `@angular/compiler-cli@22.0.4`,
  enum-declaration order): invalidBananaInBox, nullishCoalescingNotNullable,
  optionalChainNotNullable, missingControlFlowDirective, missingStructuralDirective,
  textAttributeNotBinding, uninvokedFunctionInEventBinding, missingNgForOfLet,
  suffixNotSupported, skipHydrationNotStatic, interpolatedSignalNotInvoked,
  controlFlowPreventingContentProjection, unusedLetDeclaration, uninvokedTrackFunction,
  unusedStandaloneImports, unparenthesizedNullishCoalescing,
  uninvokedFunctionInTextInterpolation, deferTriggerMisconfiguration.
- Verified code numbers (from `error_code.d.ts`): CONTROL_FLOW_PREVENTING_CONTENT_PROJECTION
  = 8011; DEFER_TRIGGER_MISCONFIGURATION = 8021; INVALID_BANANA_IN_BOX = 8101;
  UNSUPPORTED_INITIALIZER_API_USAGE = 8110 (NOT in the enum); UNUSED_LET_DECLARATION = 8112
  (IS in the enum). => the 18 = {NG8011, NG8021} U {NG8101..8117 minus NG8110}. A numeric
  "NG81xx" filter is provably WRONG (it would miss NG8011/NG8021 and wrongly include NG8110).
- `ExtendedTemplateDiagnosticName` is NOT a public runtime export: `require(...)` -> undefined,
  absent from top-level `index.d.ts`, no `src/ngtsc/...` subpath in the package `exports` map.
  This is the decisive fact behind D-01 (type-level tripwire under classic resolution).
</specifics>

<deferred>
## Deferred Ideas

None surfaced -- discussion stayed within phase scope. (Generator work is Phase 13; generator
e2e + `-p` guard is Phase 14; `NgtscProgram` per-file recovery, jscodeshift injection, and
per-member promotion testing remain out of scope per REQUIREMENTS.md / board CONSENSUS D6.)
</deferred>

---

*Phase: 12-extended-diagnostic-catalog-completeness-tripwire*
*Context gathered: 2026-07-01*
