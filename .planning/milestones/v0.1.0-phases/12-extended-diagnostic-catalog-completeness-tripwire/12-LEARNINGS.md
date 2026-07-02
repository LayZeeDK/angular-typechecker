---
phase: 12
phase_name: "extended-diagnostic-catalog-completeness-tripwire"
project: "angular-typechecker"
generated: "2026-07-01"
counts:
  decisions: 7
  lessons: 8
  patterns: 6
  surprises: 5
missing_artifacts:
  - "12-UAT.md (none authored -- verification passed with no human_needed items)"
---

# Phase 12 Learnings: extended-diagnostic-catalog-completeness-tripwire

## Decisions

### Deep-import the enum from the compiler-cli sub-barrel under classic resolution
`ExtendedTemplateDiagnosticName` is not a public runtime export; the tripwire imports it from `@angular/compiler-cli/src/ngtsc/diagnostics` (the sub-barrel re-export), which resolves only under classic `moduleResolution: node` -- exactly the regime `tsconfig.drift.json` already uses. The documented leaf-path fallback was not needed.

**Rationale:** The barrel omits the enum and the production `nodenext` build resolves compiler-cli empty; classic resolution in the drift tsconfig is the one place the deep type is reachable.
**Source:** 12-01-SUMMARY.md

### Compare the enum's string-VALUE union, not member-NAME keys
The tripwire and the catalog compare `` `${ExtendedTemplateDiagnosticName}` `` (the camelCase value union) against `(typeof EXTENDED_DIAGNOSTIC_MEMBERS)[number]`, not the SCREAMING_SNAKE key names.

**Rationale:** Lets the runtime `it.each` table key its rows on the same string values it asserts against, so one `as const` list serves both.
**Source:** 12-01-SUMMARY.md

### Vendor `AssertAssignable`, add no type-assertion dependency
The mutual set-equality probe uses a vendored `type AssertAssignable<From, To extends From> = true` rather than `tsd` / `expect-type`.

**Rationale:** Zero new dependency (the phase installs no packages by design, T-12-SC), consistent with the existing `compiler-cli-types.drift.ts`.
**Source:** 12-01-SUMMARY.md

### One `as const` source of truth feeds both the spec and the tripwire
`EXTENDED_DIAGNOSTIC_MEMBERS` (dependency-free, declaration order) is the single D-02 declaration consumed by both the runtime `describe.each` catalog and the type-level tripwire.

**Rationale:** The two representations cannot drift from each other if they derive from one list; the tripwire keeps that list honest against the upstream enum.
**Source:** 12-01-SUMMARY.md, 12-02-SUMMARY.md

### NG8011 is a normal promotable Warning-default member (D-09 corrected)
`controlFlowPreventingContentProjection` (NG8011) is asserted like any other member -- default Warning, promotable via `defaultCategory` -- not `it.skip`-ped and never asserted to stay Warning under promotion.

**Rationale:** Triple-verified (docs + source + runtime): NG8011 and NG8113 are emitted out-of-band (no factory) but both honor `defaultCategory`. The old CAT-02 "not promotable" parenthetical is factually wrong and is flagged (D-13) for milestone-audit reconciliation.
**Source:** 12-02-SUMMARY.md, 12-CONTEXT.md (D-09/D-13)

### Baseline codes assert PRESENCE; extended codes assert EXACT COUNT
The baseline sibling table uses `codes.toContain(NG(code) | bareTs)`; the extended table uses `.filter(d => d.code === NG(ngCode)).length === expectedCount`.

**Rationale:** CAT-03 asks for "asserted by exact code" (presence), which tolerates incidental co-firing; CAT-01 demands exact occurrence count, which requires single-diagnostic fixtures.
**Source:** 12-03-SUMMARY.md

### Rewrite DIAGNOSTIC-CATALOG.md from the enum, not the angular.dev docs
The catalog doc was rewritten to the 18-member enum set (the build/test source of truth), including the 2 enum-only members (NG8011, NG8112) the 16-entry docs list omits, and noting NG8110/NG8118 as non-enum ErrorCodes.

**Rationale:** The docs-vs-enum gap is exactly why DRIFT-01 consumes the enum; the doc must not re-introduce that gap.
**Source:** 12-04-SUMMARY.md / 12-04-PLAN.md, 12-CONTEXT.md (D-10..D-13)

---

## Lessons

### A bare `*ngFor` without CommonModule co-fires NG8103 alongside NG8105
Batching `missingNgForOfLet` (NG8105) with the structural batch collided the NG8103 exact count. NG8105 fires cleanly only when CommonModule IS imported, so it needs its own fixture.

**Context:** Fixture authoring for the extended catalog; caught by a real-run probe, not by inspection.
**Source:** 12-02-SUMMARY.md

### `[ngSkipHydration]="x"` binding co-fires NG8002; the static text attribute does not
The property-binding form of skipHydration triggers an incidental NG8002 (SCHEMA_INVALID_ATTRIBUTE) Error. The static text-attribute branch `ngSkipHydration="yes"` fires NG8108 alone.

**Context:** Engineering the NG8108 single-diagnostic fixture.
**Source:** 12-02-SUMMARY.md

### NG8114 needs a genuinely nullable `??` LHS or NG8102 also fires
An `??` over a non-nullable left side raises NG8102 (nullishCoalescingNotNullable) in addition to the intended NG8114, doubling a count.

**Context:** Expression-batch fixture authoring.
**Source:** 12-02-SUMMARY.md

### Standalone `imports:` cross-reference cycles never fire NG3003
Standalone imports are forward-declarable, so Angular avoids the cyclic import and emits nothing. NG3003 requires Angular to GENERATE cross-imports -- an NgModule `declarations` cycle where the component files do not import each other, under `compilationMode: "partial"` (cycle-handling strategy Error).

**Context:** The plan sketched NG3003 as a standalone cycle; it produced zero diagnostics.
**Source:** 12-03-SUMMARY.md

### NG2005 only fires for an undecorated provider with >=1 constructor parameter
`resolveProvidersRequiringFactory` silently skips a parameter-less undecorated provider, so it must carry a constructor dependency to surface NG2005.

**Context:** Baseline fixture authoring.
**Source:** 12-03-SUMMARY.md

### Non-literal `@Component` metadata (NG1001) suppresses that component's template diagnostics
Unanalyzable metadata means the compiler emits no template diagnostics for that component, so NG8002/NG8004 must live on separate, fully-analyzable components in the same fixture.

**Context:** Co-hosting multiple baseline codes in one fixture directory.
**Source:** 12-03-SUMMARY.md

### Empirical fixture probes must use the project's full `gatherAllDiagnostics`, not the default gatherer
`performCompilation`'s default gatherer short-circuits by phase and under-reports; the project's unconditional all-getter set (`gather-diagnostics.ts`) is what `runTypecheck` actually sees.

**Context:** An initial probe under-reported codes until re-run with the full getter set.
**Source:** 12-03-SUMMARY.md

### `nx test <project> -- <file>` narrows only the reporter, not the run
The `-- <file>` passthrough narrows Vitest's reporter scope but still runs the full plugin suite -- a known Nx/Vitest behavior, harmless to correctness.

**Context:** Interpreting per-file test invocations.
**Source:** 12-02-SUMMARY.md

---

## Patterns

### Single-source-of-truth `as const` module consumed by a spec and a type-level tripwire
A dependency-free `as const` list (mirroring `diagnostic-codes.ts`) feeds both a runtime `describe.each` and a compile-time drift assertion, so the two cannot diverge.

**When to use:** Any time a hand-mirrored list must stay locked to an upstream, non-runtime-exported enum/constant.
**Source:** 12-01-SUMMARY.md

### Type-level completeness tripwire that fails loudly at a named probe slot
Mutual set-equality (`CatalogCoversEnum` + `EnumCoversCatalog`) via a vendored `AssertAssignable`, run by a `typecheck-drift` Nx target over a `*.drift.ts` file that never ships. A removed member fails one probe (TS2344); an added member fails the other.

**When to use:** To make an upstream membership change fail CI loudly instead of silently under-covering, without a runtime dependency on a non-public export.
**Source:** 12-01-SUMMARY.md

### Data-driven `describe.each` catalog + structure-guard, member type coupled to the source list
Rows keyed on the `as const` list; `member` typed as `(typeof LIST)[number]` (a rename breaks compilation); a structure-guard test asserts one row per member in declaration order.

**When to use:** Parameterized coverage over a fixed enumerable surface where every member must be represented exactly once.
**Source:** 12-02-SUMMARY.md

### D-03 fixture batching with split-on-collision
Co-locate independent checks in one compiled program to amortize cold `performCompilation`; split a member into its own program the moment its exact-count assertion collides with another diagnostic.

**When to use:** Exact-count diagnostic fixtures where cold-compile cost matters but some checks co-fire.
**Source:** 12-02-SUMMARY.md

### One-diagnostic-per-fixture, probe-before-commit
Engineer each fixture so its target diagnostic is the ONLY diagnostic, verified by a real `runTypecheck` probe (with the full gatherer) before the catalog row is written.

**When to use:** Any exact-count assertion against the real compiler.
**Source:** 12-02-SUMMARY.md, 12-03-SUMMARY.md

### Sibling presence-table for baseline codes in the same catalog of record
A `BaselineRow { label, code, isNg, fixtureScenario, expectWarning? }` `describe.each` reusing the extended spec's resolver and `NG` import; WARN_-prefixed codes (NG6100) add a Warning-category + warningCount assertion.

**When to use:** Coarser presence coverage that should live in the same file as the exact-count catalog to keep one catalog of record.
**Source:** 12-03-SUMMARY.md

---

## Surprises

### The deep-import specifier compiled green on the first try
Assumption A2 -- the phase's only unverified-by-compile risk -- resolved immediately; the leaf-path fallback was never exercised.

**Impact:** De-risked the tripwire in Plan 01; no contingency work needed downstream.
**Source:** 12-01-SUMMARY.md

### Three batched extended fixtures co-fired a second diagnostic
NG8105+NG8103, NG8108+NG8002, and NG8114+NG8102 co-fired -- each caught only by real-run verification, never by reading the fixture.

**Impact:** Forced one D-03 split and two trigger swaps; validated the "probe every fixture before committing" discipline.
**Source:** 12-02-SUMMARY.md

### Standalone-component import cycles cannot produce NG3003
A plan-sketch assumption (a standalone 2-component cycle) produced zero diagnostics; NG3003 required an NgModule + `compilationMode: "partial"`.

**Impact:** Reworked the NG3003 fixture wiring; a reusable fact for any future cyclic-import coverage.
**Source:** 12-03-SUMMARY.md

### All 18 extended members reproduced from static fixtures -- zero `it.skip`
RESEARCH A1 projected zero skips; a real run confirmed every member fires from a committed static fixture, so the `skipReason`/`it.skip` gate exists but is unused.

**Impact:** Full CAT-01 coverage with no honest-skip carve-outs; the gate remains for future non-reproducible members.
**Source:** 12-02-SUMMARY.md

### The default `performCompilation` gatherer under-reports diagnostics
An initial probe missed codes because it used the phase-short-circuiting default gatherer instead of the project's unconditional all-getter set.

**Impact:** Nearly produced false "does not fire" conclusions; corrected by matching `gather-diagnostics.ts`.
**Source:** 12-03-SUMMARY.md
