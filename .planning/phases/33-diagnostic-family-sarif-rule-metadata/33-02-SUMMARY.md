---
phase: 33-diagnostic-family-sarif-rule-metadata
plan: 02
subsystem: reporting
tags: [sarif, code-scanning, diagnostics, integration-test, additive-audit, angular, typescript]

# Dependency graph
requires:
  - phase: 33-01
    provides: "on-demand SARIF rule catalog (one rule per fired ruleId with properties.tags/defaultConfiguration.level/help.text), the familyOf classifier + Family union, and the corrected sarif-report.ts header"
provides:
  - "Integration-tier proof: all FOUR Family literals (typescript, template-type-check, extended-diagnostics, tool) carry the correct SARIF rule tag/level/help over REAL cold-compiler fixtures, schema-valid via validateSarif"
  - "Regenerated machine-reporters-sarif integration snapshots: rules[] collapsed to the fired ruleIds, each with tags/level/help; every result carries a correct ruleIndex"
  - "33-ADDITIVE-AUDIT.md: the standing additive-only verdict vs angular-typechecker@0.2.3 (HOLDS; v0.3.0 untriggered; patch bump 0.2.3 -> 0.2.4)"
affects: [phase-34-multi, phase-35-proof, phase-36-gate-doc]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Integration family-tag proof reuses EXISTING per-family fixtures (extended-content-projection -> NG8011, solution-style-all-missing -> ATC90002) rather than a bespoke composite fixture -- HIGH confidence, leaner (research Open Question 1 recommendation)"
    - "A loud rule-by-id lookup helper that names the present ids when a rule is absent, so a missing rule reads as a clear assertion failure not an undefined crash"
    - "The tool fixture is asserted EXPLICITLY, not snapshotted: the ATC90002 message embeds the resolved (absolute) tsconfig path, which is neither cross-OS byte-stable nor drive-letter clean"

key-files:
  created:
    - .planning/phases/33-diagnostic-family-sarif-rule-metadata/33-ADDITIVE-AUDIT.md
  modified:
    - packages/angular-typechecker/src/core/machine-reporters-sarif.integration.spec.ts
    - packages/angular-typechecker/src/core/__snapshots__/machine-reporters-sarif.integration.spec.ts.snap

key-decisions:
  - "Reused existing per-family fixtures for the integration proof (D-02..D-04 already locked authoritatively by the 33-01 unit tier); no new fixture directory, no bespoke composite fixture"
  - "extended-content-projection -> single NG8011 (warning, extended-diagnostics, angular.dev helpUri); solution-style-all-missing -> two file-less ATC90002 (error, tool) -- both codes confirmed empirically by running the spec, not assumed"
  - "New family blocks assert tags/level/help EXPLICITLY (+ schema-validate + two-run byte-stability); only the two pre-existing describe blocks carry committed snapshots (the release-bearing delta), with the tool fixture intentionally NOT snapshotted (absolute path in the ATC message)"
  - "Task 1 touched NO production module (git diff --stat on sarif-report.ts + diagnostic-family.ts is empty); the family behavior was proven against the already-landed 33-01 code"

patterns-established:
  - "Integration tier runs under the SEPARATE `integration` Nx target (vitest.integration.config.mts); `nx test` excludes *.integration.spec.ts -- both tiers must be run"
  - "Standing additive audit vs the previous published tag, mirroring 32-ADDITIVE-AUDIT.md, gates the patch-bump release"

requirements-completed: [RULE-01, RULE-02, RULE-03, RULE-04]

coverage:
  - id: I1
    description: "layout-b-host: rules[] holds exactly {NG8002 template-type-check, TS2322 typescript}; every result resolves by a correct ruleIndex; both rules carry error level + help.text"
    requirement: RULE-01
    verification:
      - kind: integration
        ref: "machine-reporters-sarif.integration.spec.ts#catalogs exactly the two fired ruleIds ... (RULE-01) / tags the external-template NG8002 rule template-type-check ... (RULE-02/03/04)"
        status: pass
    human_judgment: false
  - id: I2
    description: "global-diagnostics: rules[] holds exactly one TS2318 (typescript, error) that all ten file-less results resolve to by ruleIndex 0"
    requirement: RULE-01
    verification:
      - kind: integration
        ref: "machine-reporters-sarif.integration.spec.ts#catalogs exactly ONE TS2318 rule that all ten results resolve to by ruleIndex 0 (RULE-01)"
        status: pass
    human_judgment: false
  - id: I3
    description: "extended-content-projection: the real NG8011 rule carries tags extended-diagnostics, keeps its angular.dev helpUri, at warning level with non-empty help.text; schema-valid"
    requirement: RULE-02
    verification:
      - kind: integration
        ref: "machine-reporters-sarif.integration.spec.ts#tags the fired NG8011 rule extended-diagnostics ... (RULE-02/03/04)"
        status: pass
    human_judgment: false
  - id: I4
    description: "solution-style-all-missing: the file-less ATC90002 rule carries tags tool at error level with non-empty help.text; both results resolve by ruleIndex 0; schema-valid"
    requirement: RULE-02
    verification:
      - kind: integration
        ref: "machine-reporters-sarif.integration.spec.ts#tags the fired ATC90002 rule tool ... (RULE-02/03/04)"
        status: pass
    human_judgment: false
  - id: I5
    description: "Every fixture payload (incl. the two new family blocks) passes validateSarif (committed SARIF 2.1.0 draft-07 ajv schema)"
    requirement: RULE-01
    verification:
      - kind: integration
        ref: "machine-reporters-sarif.integration.spec.ts#schema-validates against the committed SARIF 2.1.0 schema (x4 describe blocks)"
        status: pass
    human_judgment: false
  - id: A1
    description: "Additive-only vs angular-typechecker@0.2.3: whole-package diff lists only the 7 SARIF-path files; do-not-touch modules + manifest byte-unchanged; unified release dry run = patch 0.2.3 -> 0.2.4"
    requirement: RULE-01
    verification:
      - kind: audit
        ref: ".planning/phases/33-diagnostic-family-sarif-rule-metadata/33-ADDITIVE-AUDIT.md"
        status: pass
    human_judgment: false

# Metrics
duration: 22min
completed: 2026-07-21
status: complete
---

# Phase 33 Plan 02: Diagnostic-family SARIF rule metadata (integration proof + additive audit) Summary

**Proved all four diagnostic families carry the correct SARIF rule tag, level, and inline help when the REAL Angular and TypeScript cold compilers emit the diagnostics -- across four committed fixtures, schema-valid and snapshot-locked -- then proved the change is SARIF-path-only and ships as an additive `0.2.3 -> 0.2.4` patch bump via the standing additive audit.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-07-21T08:12:00Z
- **Completed:** 2026-07-21T08:31:00Z
- **Tasks:** 2 (Task 1 tdd)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- **Task 1 -- four family tags over real fixtures (RULE-01..04):** extended `machine-reporters-sarif.integration.spec.ts` so all four `Family` literals are proven over REAL cold-compiler output:
  - `layout-b-host`: `NG8002` -> `template-type-check`, `TS2322` -> `typescript`; `rules[]` holds exactly those two; every result resolves by a correct `ruleIndex`.
  - `global-diagnostics`: a single `TS2318` `typescript` rule at `error` level that all ten file-less results resolve to by `ruleIndex` 0.
  - NEW `extended-content-projection` block: the real `NG8011` rule -> `extended-diagnostics`, keeping its `https://angular.dev/extended-diagnostics/NG8011` helpUri, at `warning` level.
  - NEW `solution-style-all-missing` block: two file-less `ATC90002` results -> a single `tool` rule at `error` level.
  - Widened the spec's local SARIF interface chain (rule `properties.tags` / `defaultConfiguration.level` / `help.text`, result `ruleIndex`) and added a loud rule-by-id lookup. `validateSarif` stays green across all four describe blocks.
  - Regenerated both committed integration snapshots: `rules[]` collapsed from the fixed 18-NG catalog to only the fired ruleIds (each carrying tags/level/help), and every result gained a correct 0-based `ruleIndex`. Eyeballed: `global-diagnostics` is exactly one rule with ten results at `ruleIndex` 0; `layout-b-host` is `[NG8002, TS2322]` with results at `ruleIndex` 0/1; every `artifactLocation.uri` stays repo-relative forward-slash (no drive letter/backslash).
  - Production code byte-unchanged: `git diff --stat` on `sarif-report.ts` + `diagnostic-family.ts` is empty.
- **Task 2 -- SARIF-only boundary + additive charter (D-12):** wrote `33-ADDITIVE-AUDIT.md` (mirroring `32-ADDITIVE-AUDIT.md`): the full local battery exit statuses, the whole-package git-diff vs `@0.2.3` (exactly the 7 SARIF-path files), empty diffs on every do-not-touch surface + the manifest, and the unified `nx release --dry-run` patch-bump result. Verdict: additive-only HOLDS; v0.3.0 escape hatch untriggered.

## Task Commits

1. **Task 1: prove all four families over real fixtures + regenerate integration snapshots** - `974524b` (test)
2. **Task 2: the phase 33 additive-only audit vs @0.2.3** - `f0d675d` (docs)

**Plan metadata:** _(final docs commit -- SUMMARY + STATE + ROADMAP + REQUIREMENTS)_

## Files Created/Modified

- `packages/angular-typechecker/src/core/machine-reporters-sarif.integration.spec.ts` - Added family-tag/level/help/ruleIndex assertions to the two existing blocks; added two NEW describe blocks (extended-diagnostics via `extended-content-projection`, tool via `solution-style-all-missing`); widened the local SARIF interfaces; added `rulesOf`/`ruleIds`/`ruleById`/`expectEveryResultResolvesToItsRule` helpers; extended the header comment to the four families. (9 -> 21 tests.)
- `packages/angular-typechecker/src/core/__snapshots__/machine-reporters-sarif.integration.spec.ts.snap` - Regenerated: both fixtures' `rules[]` collapsed 18 -> the fired ruleIds, each with `properties.tags`/`defaultConfiguration.level`/`help.text`; every result gained a correct `ruleIndex`.
- `.planning/phases/33-diagnostic-family-sarif-rule-metadata/33-ADDITIVE-AUDIT.md` - NEW standing additive-only audit vs `angular-typechecker@0.2.3`.

## Decisions Made

- **Reused existing per-family fixtures** for the integration proof rather than a bespoke composite fixture (research Open Question 1 recommendation: HIGH-confidence, leaner; the 33-01 unit tier already locks D-02..D-04 authoritatively with synthesized records). No new fixture directory, no new dependency.
- **Confirmed the fired ruleId empirically** by running the spec, not by assuming: `extended-content-projection` yields a single `NG8011` warning, `solution-style-all-missing` yields two file-less `ATC90002` errors.
- **Did not snapshot the two new family blocks** -- they assert the family tag/level/help EXPLICITLY (+ schema-validate + two-run byte-stability). The `tool` fixture in particular MUST NOT be snapshotted: the `ATC90002` "referenced tsconfig not found: <path>" message embeds the resolved absolute tsconfig path, which is neither cross-OS byte-stable nor drive-letter clean. Only the two pre-existing describe blocks (the release-bearing delta) carry committed snapshots.

## Deviations from Plan

### 1. [Plan-command inaccuracy] `nx test` does NOT run the integration tier

- **Found during:** Task 1 verification.
- **Issue:** The plan `<verification>` battery and the orchestrator brief describe `npx nx test angular-typechecker` as "unit plus integration," and Task 1's acceptance criterion says the run contains `machine-reporters-sarif.integration.spec.ts`. It does NOT: `vitest.config.mts` explicitly excludes `**/*.integration.spec.ts`, and the real-compiler specs run under the SEPARATE `integration` Nx target (`vitest.integration.config.mts`). Running only `nx test` would never exercise this plan's primary artifact.
- **Fix:** Ran `npx nx integration angular-typechecker` (24 files / 152 tests, exit 0) in addition to `npx nx test angular-typechecker` (53 files / 565 tests, exit 0). Both tiers green. Snapshot regeneration used `vitest run --config .../vitest.integration.config.mts machine-reporters-sarif -u`.
- **Verification:** Both `nx test` and `nx integration` exit 0; recorded in the audit's battery table.
- **Committed in:** n/a (verification-command correction, not a code change).

### 2. [Plan-command inaccuracy, inherited from Wave 1] `format:check` target name

- **Found during:** Task 2 battery.
- **Issue:** The plan lists `npx nx run angular-typechecker:format:check`; this project's `project.json` has no `format` target.
- **Fix:** Ran the repo's actual gate `npx nx format:check` (exit 0), matching how Wave 1 verified.
- **Verification:** `npx nx format:check` exit 0.
- **Committed in:** n/a (verification-command correction).

### 3. [Note, not committed] Orchestrator-managed `.planning/config.json` flag

- **Found during:** staging.
- **Issue:** `.planning/config.json` `_auto_chain_active` flipped `true -> false` in the working tree -- orchestrator/workflow state, not part of this plan.
- **Fix:** Left it unstaged/untouched (never `git add`ed); only task-related files were staged per commit.

---

**Total deviations:** 2 plan-command inaccuracies (both verification-command only) + 1 unstaged-state note. No code-logic deviation. The git-diff scope guard shows exactly the planned files; all do-not-touch surfaces are byte-unchanged.
**Impact on plan:** None on scope or behavior.

## Issues Encountered

- The committed integration snapshot was already RED at plan start (the two `matches the committed redacted snapshot` tests failed) because Wave 1's `sarif-report.ts` change had landed but the integration snapshot regen is owned by THIS plan (exactly as 33-01-SUMMARY predicted). Regenerating it is the intended Task 1 outcome, not a defect. Every result correctly gained a `ruleIndex` -- no result whose ruleId should be cataloged was missing one, so no Wave-1 defect surfaced.

## Verification Battery (all green)

1. `npx nx test angular-typechecker` -- 53 files / 565 tests PASS (unit; incl. JSON key drift-lock).
2. `npx nx integration angular-typechecker` -- 24 files / 152 tests PASS (integration; incl. the extended SARIF spec, 21 tests).
3. `npx nx typecheck angular-typechecker` -- exit 0 (3 tsc projects incl. drift + tools).
4. `npx tsc --noEmit -p packages/angular-typechecker/tsconfig.spec.json` -- exit 0 (widened SARIF interfaces type-check).
5. `npx nx lint angular-typechecker` -- exit 0 at maxWarnings 0 (incl. `@nx/dependency-checks`; no dependency added).
6. `npx nx format:check` -- exit 0.
7. `npx nx build angular-typechecker` -- exit 0.
8. Additive audit vs `angular-typechecker@0.2.3` -- written; verdict HOLDS.
9. `npx nx release --dry-run` (unified) -- proposes patch bump `0.2.3 -> 0.2.4`; no breaking-change marker since the baseline tag.

## Next Phase Readiness

- Phase 33 is functionally complete: RULE-01..04 are proven at both the unit tier (33-01) and the integration tier (33-02) over real cold-compiler fixtures, and the additive-only charter holds.
- Version deliberately untouched at `0.2.3`; the `0.2.4` cut + tag + npm publish are the separate human-gated Release-PR flow.
- Downstream phases 34 (per-project CI categories), 35 (Code Scanning proof), and 36 (gate + docs) build on this verified SARIF surface. No blockers.

## Self-Check: PASSED

- All 3 created/modified deliverables present on disk (`machine-reporters-sarif.integration.spec.ts`, its `__snapshots__/*.snap`, `33-ADDITIVE-AUDIT.md`) + this SUMMARY.
- Both task commits present in git: `974524b` (test), `f0d675d` (docs).

---
*Phase: 33-diagnostic-family-sarif-rule-metadata*
*Completed: 2026-07-21*
