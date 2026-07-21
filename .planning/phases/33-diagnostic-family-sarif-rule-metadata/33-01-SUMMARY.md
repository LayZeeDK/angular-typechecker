---
phase: 33-diagnostic-family-sarif-rule-metadata
plan: 01
subsystem: reporting
tags: [sarif, code-scanning, diagnostics, node-sarif-builder, angular, typescript]

# Dependency graph
requires:
  - phase: 31-sarif-reporter
    provides: formatSarifReport, node-sarif-builder lazy-import firewall, EXTENDED_DIAGNOSTIC_CATALOG, the .rule/.result mutation precedent
  - phase: 30-json-reporter
    provides: the shared toDiagnosticRecord projection (rawCode + file + code + severity) and codeStringOf boundaries
provides:
  - "familyOf(record): Family classifier + the Family union (typescript | template-type-check | extended-diagnostics | tool), src/core-only, NOT barrel-exported"
  - "On-demand SARIF rule catalog: one reporting descriptor per DISTINCT fired ruleId (empty on a clean run)"
  - "Each cataloged rule carries properties.tags (family), defaultConfiguration.level (toSarifLevel), and help.text alongside helpUri"
  - "Corrected sarif-report.ts module header + catalog comment (on-demand cataloging; completeRunFields sets result.ruleIndex)"
affects: [33-02, phase-34-multi, phase-35-proof, phase-36-gate-doc]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Family derived inside the SARIF path ONLY (no field added to DiagnosticRecord) so JSON/human output stays byte-identical"
    - "PASS-1 Map<ruleId, RuleMeta> fold: any-.html-occurrence-wins family upgrade, first-observed level"
    - ".rule mutation escape hatch (properties/defaultConfiguration/help) with no cast, mirroring result.partialFingerprints"

key-files:
  created:
    - packages/angular-typechecker/src/core/diagnostic-family.ts
    - packages/angular-typechecker/src/core/diagnostic-family.spec.ts
  modified:
    - packages/angular-typechecker/src/core/sarif-report.ts
    - packages/angular-typechecker/src/core/sarif-report.spec.ts
    - packages/angular-typechecker/src/core/__snapshots__/sarif-report.spec.ts.snap

key-decisions:
  - "familyOf reads ONLY rawCode + file; adds no field to DiagnosticRecord and is not re-exported from src/index.ts (D-01)"
  - "rawCode sign/range checked BEFORE the .html heuristic so an external-template extended diagnostic is never downgraded (D-02); order locked by an .html-attributed catalog NG test"
  - "any-.html-occurrence-wins family fold, first-observed level tie-break, both order-independent (D-04/D-06)"
  - "tags/level/help set by mutating SarifRuleBuilder.rule directly, no cast, zero new dependency (D-09)"
  - "tool helpUri = repo information URI (no new README content authored this phase); TS + template-type-check external helpUris verified 200; NG helpUri kept as angular.dev per code"

patterns-established:
  - "Catalog-on-demand: rules[] reflects the actual run (CodeQL/ESLint norm), replacing the always-18-NG catalog"
  - "Doc-accuracy folded with behavior: the header now matches the emitted ruleIndex + on-demand rules"

requirements-completed: [RULE-01, RULE-02, RULE-03, RULE-04]

coverage:
  - id: D1
    description: "familyOf pure classifier maps rawCode+file to one of the four fixed families with the load-bearing rawCode-before-.html order"
    requirement: RULE-02
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/core/diagnostic-family.spec.ts#familyOf (D-01 / D-02 / D-03)"
        status: pass
    human_judgment: false
  - id: D2
    description: "SARIF catalogs one rule per DISTINCT fired ruleId; a clean CoreResult yields an empty rules array; every result gains a correct ruleIndex"
    requirement: RULE-01
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/core/sarif-report.spec.ts#catalogs one rule per DISTINCT fired ruleId ... (RULE-01/02/04)"
        status: pass
      - kind: unit
        ref: "packages/angular-typechecker/src/core/sarif-report.spec.ts#renders a clean CoreResult as an EMPTY results array AND an empty on-demand rule catalog (RULE-01)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every cataloged rule carries properties.tags with exactly one of the four family literals (proven across typescript / template-type-check / extended-diagnostics / tool, incl. the D-04 any-.html-wins reducer both orders)"
    requirement: RULE-02
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/core/sarif-report.spec.ts#resolves a ruleId seen in both a .ts and a .html file to template-type-check, in either order (D-04)"
        status: pass
      - kind: unit
        ref: "packages/angular-typechecker/src/core/sarif-report.spec.ts#tags a catalog NG code extended-diagnostics ... and a non-catalog NG code template-type-check"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every cataloged rule carries defaultConfiguration.level equal to toSarifLevel(severity), with the first-observed tie-break on mixed severities"
    requirement: RULE-03
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/core/sarif-report.spec.ts#keeps the FIRST observed severity level for a ruleId seen at mixed severities in one run (D-06)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every cataloged rule carries a non-empty help.text alongside its helpUri"
    requirement: RULE-04
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/core/sarif-report.spec.ts#emits a SARIF 2.1.0 log ... catalogs one rule per fired ruleId on demand (help.text + helpUri present)"
        status: pass
    human_judgment: false

# Metrics
duration: 17min
completed: 2026-07-21
status: complete
---

# Phase 33 Plan 01: Diagnostic-family SARIF rule metadata Summary

**Flipped the SARIF reporter from a fixed 18-NG catalog to one rule per distinct fired ruleId, each carrying a diagnostic-family tag, default severity level, and inline help text -- via a new pure `familyOf` classifier and a `.rule` mutation, with zero new dependency and JSON/human output byte-unchanged.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-07-21T07:48:32Z
- **Completed:** 2026-07-21T08:05:07Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- New pure `src/core/diagnostic-family.ts`: `familyOf(record): Family` reading only `rawCode` + `file`, with the `rawCode`-before-`.html` order locked by an `.html`-attributed catalog NG test (an external-template extended diagnostic is never downgraded). Not added to the public barrel.
- `sarif-report.ts` now catalogs rules ON-DEMAND: one reporting descriptor per distinct fired `ruleId` (empty `rules[]` on a clean run), each decorated with `properties.tags` (RULE-02), `defaultConfiguration.level` (RULE-03, reusing `toSarifLevel`), and `help.text` (RULE-04) via the `.rule` escape hatch -- no cast, no new dependency.
- The any-`.html`-occurrence-wins family fold and the first-observed level tie-break are locked by tests in BOTH orders (D-04/D-06).
- Corrected the stale module header + catalog comment (D-11): rules are on-demand and `completeRunFields` sets `result.ruleIndex` on every result -- both now match the regenerated snapshot.
- SARIF-only boundary held: `json-report.ts`, `format-report.ts`, `diagnostic-record.ts`, `extended-catalog.ts`, `src/index.ts`, and `src/index.drift.ts` are byte-unchanged; the integration spec + its snapshot are untouched (owned by plan 33-02).

## Task Commits

Each task was committed atomically (TDD RED -> GREEN):

1. **Task 1 (RED): failing diagnostic-family spec** - `5b785df` (test)
2. **Task 1 (GREEN): diagnostic-family classifier** - `454424d` (feat)
3. **Task 2 (RED): re-aim SARIF spec to on-demand catalog** - `b28fedd` (test)
4. **Task 2 (GREEN): on-demand rule catalog + header fix + snapshot** - `ae41bad` (feat)
5. **Prettier line-wrap of the two new specs** - `5f50e6d` (style)

**Plan metadata:** _(final docs commit -- SUMMARY + STATE + ROADMAP + REQUIREMENTS)_

## Files Created/Modified
- `packages/angular-typechecker/src/core/diagnostic-family.ts` - NEW pure classifier: `familyOf` + the `Family` union + module-private `EXTENDED_NG_CODES` set.
- `packages/angular-typechecker/src/core/diagnostic-family.spec.ts` - NEW direct-call boundary matrix (9 tests): one case per branch + the order proof + the D-03 imprecision contract.
- `packages/angular-typechecker/src/core/sarif-report.ts` - Replaced the unconditional 18-rule loop with a PASS-1 `Map<ruleId, RuleMeta>` fold + per-family `buildRuleMeta`; corrected the stale header/comment.
- `packages/angular-typechecker/src/core/sarif-report.spec.ts` - Re-aimed the two catalog-length tests; added tags/level/help, curated-ATC, D-04 reducer, D-06 tie-break, and NG family assertions; widened the local SARIF interfaces (`ruleIndex`, `SarifRule`).
- `packages/angular-typechecker/src/core/__snapshots__/sarif-report.spec.ts.snap` - Regenerated: `rules[]` shrank from 18 to `[TS2322, ATC90001]`, each with `tags`/`defaultConfiguration`/`help`; both results gained a correct `ruleIndex` (0, 1).

## Decisions Made
- Kept family derivation entirely inside the SARIF path (no `DiagnosticRecord` field, not barrel-exported) so JSON/human output cannot drift (D-01/D-12).
- Used the repo information URI as the `tool`-family `helpUri` rather than authoring a new README anchor this phase (keeps the additive audit scoped to `src/`); confirmed the TypeScript and Angular template-type-check `helpUri` targets return 200 (`help.text` is the RULE-04-critical field regardless).
- Imported the two synthesized ATC code constants (`ZERO_ROOT_NAMES_DIAGNOSTIC_CODE`, `REFERENCE_NOT_FOUND_DIAGNOSTIC_CODE`) to key the curated tool-rule table, keeping the code numbers single-sourced (dependency-free `src/core` import, firewall-safe).

## Deviations from Plan

### 1. [Plan-command inaccuracy] `format:check` target name

- **Found during:** Final verification battery (check 5).
- **Issue:** The plan lists `npx nx run angular-typechecker:format:check`, but this project's `project.json` has no `format` target (`nx` reported `Cannot find configuration for task angular-typechecker:format`).
- **Fix:** Ran the repo's actual format gate, the workspace-level `npx nx format:check` (exit 0), and also `npx prettier --check` on the five changed files (exit 0). No code change; the plan text names a non-existent target.
- **Verification:** `npx nx format:check` exit 0; `npx prettier --check <5 files>` exit 0.
- **Committed in:** n/a (verification-command correction, not a code change).

### 2. [Formatting hygiene] Prettier line-wrap of the two new specs

- **Found during:** Final verification battery (Prettier check).
- **Issue:** A few `expect(...)` lines in the two new spec files exceeded Prettier's printWidth 80 as first authored.
- **Fix:** `prettier --write` re-wrapped them (pure line-wrapping; no assertion or behavior change), committed separately as `style(core)` `5f50e6d`.
- **Verification:** `npx prettier --check` exit 0; `nx test` still 565 passing.
- **Committed in:** `5f50e6d`.

---

**Total deviations:** 2 (1 plan-command inaccuracy, 1 formatting hygiene). Neither is a code-logic deviation.
**Impact on plan:** None on scope or behavior. The git-diff scope guard still shows exactly the 5 planned files; all do-not-touch surfaces are byte-unchanged.

## Issues Encountered
- Confirmed early that changing `sarif-report.ts` in plan 01 would churn the `machine-reporters-sarif.integration.spec.ts` snapshot. That snapshot runs under the SEPARATE `integration` target (`vitest.config.mts` excludes `**/*.integration.spec.ts`), NOT the `test` target, so plan 01's six-check battery stays green and the integration snapshot regen is correctly owned by plan 33-02. No scope conflict.

## Verification Battery (all green)
1. `npx nx test angular-typechecker` -- 565 tests / 53 files PASS (incl. new `diagnostic-family.spec.ts`, re-aimed `sarif-report.spec.ts`, untouched JSON key drift-lock).
2. `npx nx typecheck angular-typechecker` -- exit 0 (all 3 tsc projects incl. drift; proves the three `.rule` assignments compile with no cast).
3. `npx tsc --noEmit -p packages/angular-typechecker/tsconfig.spec.json` -- exit 0.
4. `npx nx lint angular-typechecker` -- exit 0 at maxWarnings 0 (incl. `@nx/dependency-checks`: no dependency added, D-09).
5. `npx nx format:check` -- exit 0 (workspace command; see Deviation 1).
6. `npx nx build angular-typechecker` -- exit 0.

## Next Phase Readiness
- Plan 33-02 (wave 2) can now write the SARIF integration spec against the changed `sarif-report.ts`, regenerate the two integration snapshots, and run the additive audit vs `angular-typechecker@0.2.3`.
- Version deliberately untouched at `0.2.3` (the patch bump to `0.2.4` and the release cut are the separate human-gated Release-PR step).
- No blockers.

## Self-Check: PASSED

- All 5 created/modified files present on disk (diagnostic-family.ts, diagnostic-family.spec.ts, sarif-report.ts, sarif-report.spec.ts, sarif-report.spec.ts.snap) + this SUMMARY.
- All 5 task commits present in git: `5b785df`, `454424d`, `b28fedd`, `ae41bad`, `5f50e6d`.

---
*Phase: 33-diagnostic-family-sarif-rule-metadata*
*Completed: 2026-07-21*
