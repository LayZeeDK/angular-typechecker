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
- **D-09 (CORRECTED 2026-07-01 -- docs + source + runtime verified):** ALL 18 extended
  diagnostics -- INCLUDING NG8011 (`controlFlowPreventingContentProjection`) -- are promotable
  to `Error` via `angularCompilerOptions.extendedDiagnostics.defaultCategory: "error"`. NG8011
  is asserted in the catalog like any other member (default `Warning`, promotable to `Error`);
  it is NOT `it.skip`-ped and NOT special-cased as "not promotable". The only real distinction
  among the 18 is emission MECHANISM, not promotability: 16 have an `extended/checks/<name>/`
  factory; 2 (NG8011 + NG8113 `unusedStandaloneImports`) are emitted out-of-band -- but BOTH
  out-of-band fields read `defaultCategory` (`core/src/compiler.ts:1112-1115` /
  `extended/src/extended_template_checker.ts:40-44`), and Angular's own
  `SUPPORTED_DIAGNOSTIC_NAMES` (`extended/index.ts`) lists all 18 as configurable.
  **Verification (triple):** docs (general `defaultCategory` rule + NG8113 is
  documented-yet-out-of-band) + source (`@angular/compiler-cli@22.0.4`, read at tag `v22.0.4`)
  - an empirical `runTypecheck` probe (NG8011 = Warning by default, = Error under
    `defaultCategory:"error"`; single diagnostic, code `-998011`). **This SUPERSEDES the board
    CONSENSUS D2 nuance and requirement CAT-02's parenthetical ("NG8011 excepted: out-of-band /
    not promotable") -- both are factually wrong; see D-13.** CAT-02's core ask (at least one
    promotion proof) is still satisfied by D-08 (NG8101). A test asserting NG8011 stays a Warning
    under `defaultCategory:"error"` would FAIL against real Angular 22.0.4.

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
- **D-13 (requirement-correction flag for the milestone audit):** Requirement CAT-02's
  parenthetical "(NG8011 excepted: out-of-band / not promotable -- assert its observed category)"
  and board CONSENSUS D2's matching nuance are FACTUALLY WRONG -- NG8011 IS promotable (see D-09,
  triple-verified). Per the user's "Correct it" decision (2026-07-01), the implementation follows
  the verified truth; `REQUIREMENTS.md` (CAT-02) and `CONSENSUS.md` text are LEFT AS-IS (no
  re-ratification this phase) but are flagged HERE as superseded so the milestone audit reconciles
  them. CAT-02 remains satisfied: one promotion proof via NG8101 (D-08). Also for the CAT-05
  rewrite: angular.dev lists only 16 extended diagnostics, but the `ExtendedTemplateDiagnosticName`
  enum has 18 -- the 2 enum-only members are NG8011 and NG8112 (`unusedLetDeclaration`); NG8113
  (`unusedStandaloneImports`) is the documented-yet-out-of-band twin proving "no factory" !=
  "not configurable".

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
4. **Promotability -- RESOLVED 2026-07-01 (no longer open):** ALL 18 are promotable via
   `defaultCategory` (see corrected D-09; verified by docs + source + an empirical
   `runTypecheck` probe). 16 factory checks + 2 out-of-band (NG8011, NG8113), all wired to
   `defaultCategory`. The only remaining research task is to confirm each member's DEFAULT
   `DiagnosticCategory` -- all 18 default to `Warning` under `strictTemplates` (verified).
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

_Phase: 12-extended-diagnostic-catalog-completeness-tripwire_
_Context gathered: 2026-07-01_
