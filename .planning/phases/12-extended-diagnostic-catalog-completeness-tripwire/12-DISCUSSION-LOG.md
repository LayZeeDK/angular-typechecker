# Phase 12: Extended-diagnostic catalog + completeness tripwire - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-07-01
**Phase:** 12-extended-diagnostic-catalog-completeness-tripwire
**Areas discussed:** tripwire-mechanism, fixture-strategy, catalog-spec-layout, promotion-coverage, catalog-doc-correction
**Mode:** `--auto --analyze` (autonomous single pass; recommended option auto-selected per area; no interactive prompts). Phase-specific research was performed BEFORE gray-area analysis and verified against the installed `@angular/compiler-cli@22.0.4`.

---

## GA-1 -- Completeness-tripwire mechanism (DRIFT-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Type-level assertion in a `.drift.ts`, run by `typecheck-drift` | Mirror existing `compiler-cli-types.drift.ts`; deep-import the enum under classic node resolution; the enum is not public-exported; requirement allows the `typecheck-drift` job | ✓ |
| Runtime Vitest spec deep-importing the enum | Familiar `expect().toEqual()` | |
| Runtime spec parsing the `.d.ts` text | Avoids import-resolution fight | |

**Auto-selected (recommended):** Type-level tripwire under `typecheck-drift`.
**Notes:** VERIFIED `require('@angular/compiler-cli').ExtendedTemplateDiagnosticName === undefined`; absent from top-level `index.d.ts`; no `src/ngtsc/...` subpath in the `exports` map. The deep type is reachable only under classic `moduleResolution: node` -- exactly the regime `tsconfig.drift.json` uses. Runtime options are fragile (blocked under `nodenext`/`exports` or brittle text-parsing). IMPACT medium (internal test infra, reversible) + CONFIDENCE high (established pattern + requirement text) => not the trap quadrant.

---

## GA-2 -- Fixture strategy for the 18-member catalog (CAT-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Batch fixtures per program where practical | Consensus D2; reuse `extended-v13`/`extended-promoted`; fewer cold compiles (~0.5s each) | ✓ |
| One fixture program per diagnostic (18) | Maximal isolation | |
| Extend only the 2 existing fixtures | Minimal new files | |

**Auto-selected (recommended):** Batch per program where practical.
**Notes:** Aligns with consensus D2 and the CI cold-compile budget. Exact grouping is an implementation discovery (conflicting checks split out). Reuses existing NG8101 fixtures.

---

## GA-3 -- Catalog spec layout + table shape (CAT-03, CAT-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Single enum-keyed `it.each` catalog spec; baseline codes in a sibling table | CAT-04 mandates one data-driven table; intro-version as a row field; one source of truth for the tripwire | ✓ |
| Keep per-version split files (OLD catalog guidance) | Drop-in future-version file | |

**Auto-selected (recommended):** Single enum-keyed `it.each` catalog spec.
**Notes:** Per-version split contradicts CAT-04 and would fragment the tripwire's source of truth. Existing `extended.angular13` + `extended.promotion` specs fold into the catalog of record. Non-reproducible members become `it.skip` with a reason, rows retained.

---

## GA-4 -- Severity-promotion coverage depth (CAT-02)

| Option | Description | Selected |
|--------|-------------|----------|
| One promotion proof (NG8101 via existing fixture) + NG8011 asserted at observed category, promotion skipped with reason | CAT-02/consensus = "at least one"; honors NG8011 out-of-band/not-promotable | ✓ |
| Promotion-test every promotable member | Exhaustive | |

**Auto-selected (recommended):** One promotion proof + NG8011 skip-with-reason.
**Notes:** Per-member promotion is YAGNI (adversarial lens). 17 of 18 promotable; NG8011 (`controlFlowPreventingContentProjection`) is emitted out-of-band and is not promotable.

---

## GA-5 -- `DIAGNOSTIC-CATALOG.md` correction scope (CAT-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Full rewrite to the source-verified 18-member enum set + drop stale per-version-split guidance + add NG8110/NG8112/NG8118 clarifications | Makes the canonical ref authoritative; fixes the verified NG8112 exclusion error | ✓ |
| Append a correction note only | Smaller diff | |

**Auto-selected (recommended):** Full rewrite to the source-verified 18-member set.
**Notes:** VERIFIED that `unusedLetDeclaration` (NG8112) IS an enum member -- the OLD catalog wrongly excluded it. The enum (build/test-time source of truth) differs from the angular.dev docs list; the enum wins. NG8110 (`UNSUPPORTED_INITIALIZER_API_USAGE`) and NG8118 are `ErrorCode`s but NOT in the enum.

---

## Claude's Discretion

Four research directives were handed to plan-phase (`--research`) rather than locked as user decisions: (1) pin the exact 18 member->NG-code mapping; (2) determine which members need `it.skip` (not statically reproducible under Angular 22.0.4); (3) confirm the tripwire's exact deep-import specifier + set-equality assertion form; (4) verify the promotability nuance (17 promotable, NG8011 not) against the `extended/checks/` factory set. See CONTEXT.md `<decisions>` "Claude's Discretion".

## Deferred Ideas

None -- discussion stayed within phase scope. Generator (Phase 13), generator e2e + `-p` guard (Phase 14), `NgtscProgram` per-file recovery, jscodeshift injection, and per-member promotion testing remain out of scope per REQUIREMENTS.md / board CONSENSUS D6.
