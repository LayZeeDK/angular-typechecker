---
phase: 35-automated-code-scanning-proof
plan: 01
subsystem: testing
tags: [sarif, code-scanning, fixture, diagnostic-family, fallow, prettier, drift-lock, ci]

# Dependency graph
requires:
  - phase: 33-diagnostic-family-sarif-rule-metadata
    provides: familyOf + per-rule properties.tags/defaultConfiguration.level (the family/level contract the fixture drives)
  - phase: 31-sarif-reporter
    provides: the shipped SARIF 2.1.0 reporter + standalone CLI --format sarif
provides:
  - Isolated one-per-family SARIF proof fixture at tools/sarif-proof-fixture/ (NO project.json) that fires TS2322 + NG8002 + NG8101 + ATC90002 in ONE CLI SARIF run
  - fallow new-only + Prettier gate scoping for the deliberately-broken fixture
  - Local drift-lock integration spec locking the fixture-to-reporter contract (the four family/level tuples)
affects: [35-02, 35-03, code-scanning-proof CI job, assert-code-scanning]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Solution tsconfig (surviving leaf + one deliberately-missing reference) emits all four SARIF families in ONE run -- no second CLI invocation, no merge"
    - "CI proof asset lives under tools/ with NO project.json -> invisible to nx run-many -t typecheck and the explicit-allowlist tsconfig.tools.json"
    - "fallow overrides + .prettierignore scoping keep a deliberately-broken fixture out of the new-only + format gates"

key-files:
  created:
    - tools/sarif-proof-fixture/tsconfig.json
    - tools/sarif-proof-fixture/tsconfig.fixture.json
    - tools/sarif-proof-fixture/type-error.ts
    - tools/sarif-proof-fixture/proof.component.ts
    - tools/sarif-proof-fixture/proof.component.html
  modified:
    - .fallowrc.jsonc
    - .prettierignore
    - packages/angular-typechecker/src/core/machine-reporters-sarif.integration.spec.ts

key-decisions:
  - "All four families from ONE solution-tsconfig CLI run (surviving leaf + missing reference) -- the lazier, self-verifying shape over a second invocation + merge (research Pattern 1)"
  - "Extended NG8xxx = NG8101 invalidBananaInBox (<input ([value])>) -- fires cleanly at warning level with no extra component wiring; coexists with NG8002 on a separate element (no interference)"
  - "ATC90002 (not-found reference) for the tool family -- co-exists with surviving leaves (ATC90001 zero-rootNames would preclude the other three)"
  - "Drift-lock asserts the SET of (family tag, level) tuples + exactly one rule per family; extended ruleId stays discretionary (asserted by tag, not hard-pinned)"

patterns-established:
  - "Pattern 1: one-per-family proof fixture driving the SHIPPED engine -- deterministic SARIF input outside the Nx graph"
  - "Pattern 2: local drift-lock integration spec as the fast tripwire for a real-CI-only contract"

requirements-completed: []  # PROOF-01 spans 35-01 (fixture + drift-lock) and 35-02/35-03 (CI job + gh api assert); stays Pending, closed at phase verification.

coverage:
  - id: D1
    description: "Isolated one-per-family fixture drives the shipped CLI to emit exactly one diagnostic per SARIF family (typescript/error, template-type-check/error, extended-diagnostics/warning, tool/error) in ONE SARIF run"
    requirement: PROOF-01
    verification:
      - kind: integration
        ref: "packages/angular-typechecker/src/core/machine-reporters-sarif.integration.spec.ts#SARIF reporter integration -- sarif-proof-fixture (one rule per family, one run)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The fixture is invisible to the Nx typecheck gate and the tools tsc (no project.json; not in tsconfig.tools.json)"
    requirement: PROOF-01
    verification:
      - kind: other
        ref: "npx nx show projects (excludes sarif-proof-fixture); test ! -f tools/sarif-proof-fixture/project.json"
        status: pass
    human_judgment: false
  - id: D3
    description: "The fallow new-only gate and nx format:check stay green on the deliberately-broken fixture (fixture scoped in fallow overrides; diagnostic-sensitive .html in .prettierignore)"
    verification:
      - kind: other
        ref: "npx fallow audit --format human --base origin/main (no finding names the fixture); npx nx format:check (exit 0); prettier --file-info proof.component.html => ignored:true"
        status: pass
    human_judgment: false
  - id: D4
    description: "The local drift-lock spec locks the fixture-to-reporter contract (four (family tag, level) tuples, one rule per family) so the fixture cannot silently drift from the reporter"
    requirement: PROOF-01
    verification:
      - kind: integration
        ref: "npx nx integration angular-typechecker (156 pass)"
        status: pass
    human_judgment: false

# Metrics
duration: ~58m (wall-clock, includes a usage-limit reset gap; active work ~35m)
completed: 2026-07-21
status: complete
---

# Phase 35 Plan 01: Isolated one-per-family SARIF proof fixture Summary

**An isolated `tools/sarif-proof-fixture/` (no project.json) that drives the shipped CLI to emit TS2322 + NG8002 + NG8101 + ATC90002 -- one diagnostic per SARIF family -- in a SINGLE run, scoped out of the fallow/Prettier gates and locked by a local drift-lock integration spec.**

## Performance

- **Duration:** ~58 min wall-clock (includes a usage-limit reset gap; active work ~35 min)
- **Started:** 2026-07-21T18:09:06Z
- **Completed:** 2026-07-21T19:07:43Z
- **Tasks:** 3
- **Files modified:** 8 (5 created + 3 edited)

## Accomplishments
- Built the isolated proof fixture: a solution `tsconfig.json` (`files:[]`) referencing a surviving leaf (`tsconfig.fixture.json` -> TS2322 in `type-error.ts` + external-`.html` NG8002 + warning NG8101 in `proof.component.html`) plus ONE deliberately-missing `./tsconfig.missing.json` reference that synthesizes ATC90002. One CLI run emits all four families as exactly four rules in one SARIF run.
- Confirmed the fixture is invisible to the Nx graph (`nx show projects` excludes it), carries no `project.json`, and is not in the explicit-allowlist `tsconfig.tools.json`.
- Scoped the deliberately-broken fixture out of the two CI-gate landmines: a new `.fallowrc.jsonc` `overrides` entry (unused-files/unrendered-components/unused-component-inputs off) and a `.prettierignore` line for the diagnostic-sensitive `proof.component.html`.
- Added the local drift-lock: a 5th `describe` block in `machine-reporters-sarif.integration.spec.ts` asserting exactly one rule per family at the expected level over ONE fixture run, reusing the existing helpers.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the isolated one-per-family fixture** - `4169c1a` (test)
2. **Task 2: Scope the fixture out of the fallow new-only gate and Prettier** - `c871a8d` (chore)
3. **Task 3: Add the local drift-lock describe block to the SARIF integration spec** - `cc60a58` (test)

**Plan metadata:** (this docs commit)

## Files Created/Modified
- `tools/sarif-proof-fixture/tsconfig.json` - Solution tsconfig: `files:[]`, references the surviving leaf + one missing reference (ATC90002 source).
- `tools/sarif-proof-fixture/tsconfig.fixture.json` - Surviving leaf (strict + strictTemplates), `files:[type-error.ts, proof.component.ts]`.
- `tools/sarif-proof-fixture/type-error.ts` - `: number = 'not a number'` -> TS2322 (typescript/error).
- `tools/sarif-proof-fixture/proof.component.ts` - Standalone component, external `templateUrl`.
- `tools/sarif-proof-fixture/proof.component.html` - `[nonExistentProp]` (NG8002 template-type-check/error) + `([value])` banana-in-box (NG8101 extended-diagnostics/warning).
- `.fallowrc.jsonc` - New `overrides` entry scoping `tools/sarif-proof-fixture/**` off the new-only rules.
- `.prettierignore` - Ignore the whitespace-sensitive `proof.component.html`.
- `packages/angular-typechecker/src/core/machine-reporters-sarif.integration.spec.ts` - New drift-lock `describe` block + `proofFixtureTsConfig` const.

## Decisions Made
- **All four families in ONE run** (research Pattern 1): a solution tsconfig unions a surviving leaf's real diagnostics with a synthesized ATC90002 for the missing reference. Lazier and self-verifying vs a second invocation + merge, and sidesteps the multi-run-same-category rejection downstream.
- **NG8101 (invalidBananaInBox)** for the extended family: `<input ([value])="value" />` fired cleanly at warning with no extra component wiring, and coexisted with NG8002 on a separate `<div>` with no interference (empirically confirmed via the drift-lock spec -- exactly 4 rules, no incidental diagnostics). NG8011 (the two-component fallback) was not needed.
- **ATC90002** (not-found reference), not ATC90001 (zero-rootNames), because 90002 co-exists with the surviving leaf while 90001 requires no surviving leaves.
- **Drift-lock asserts the tuple SET + one-rule-per-family** rather than an exact extended ruleId, keeping the extended code Task-1-discretionary while still catching any family drift; TS2322/NG8002/ATC90002 are pinned explicitly.
- **No comments in the fixture JSON files** -- `tsconfig.fixture.json` is a non-standard name (Prettier's `json` parser, no comments allowed), so comment-free JSON guarantees `format:check` stays green; the intent lives in the `.ts`/`.html` comments + this SUMMARY.

## Deviations from Plan

None - plan executed exactly as written. The three tasks landed as specified; the fixture emitted the exact four families on the first attempt (NG8101 fired cleanly, so the plan's split-into-two-components fallback was unnecessary).

## Issues Encountered
- **Plan verify grep is over-broad (not a defect).** The plan's Task-2 verify (`npx fallow audit ... 2>&1 | rg -i "sarif-proof-fixture"`) folds stderr into the match and trips on a benign `WARN tsconfig chain not fully loaded ... tsconfig.missing.json` line -- that missing reference is BY DESIGN (it synthesizes ATC90002). The correct signal is that no fallow FINDING (stdout) names the fixture, which was verified. Also confirmed `prettier --file-info proof.component.html => {"ignored": true}`.
- **Pre-existing fallow health finding (out of scope, logged).** `fallow audit` exits 1 on this milestone branch due to health-tier findings on `packages/angular-typechecker/src/core/sarif-report.ts` (`formatSarifReport` 111 lines; `buildRuleMeta` complexity) -- Phase 33 code (last touched by `029b45d`), NOT this plan, and forbidden to touch by D-04. Recorded in `deferred-items.md` for milestone-level hygiene (Phase 33/36 or the milestone PR).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The fixture + local drift-lock are the LOCAL half of PROOF-01. Ready for 35-02 (the `code-scanning-proof` CI job + `tools/ci/assert-code-scanning.mjs` gh-api poll/assert) and 35-03 (the real-CI ingestion gate). The four expected (family tag, severity) tuples the CI assert must check are now locked locally: typescript/error, template-type-check/error, extended-diagnostics/warning, tool/error.
- **PROOF-01 stays Pending** (spans 35-01/02/03) -- closed at phase verification once the CI job lands the alerts.
- No published surface changed; no version bump (D-04 holds: package.json byte-unchanged, only a spec touched under `src/**`).

## Self-Check: PASSED
- All 5 fixture files exist on disk.
- All 3 task commits present (`4169c1a`, `c871a8d`, `cc60a58`).
- Gates green: `nx integration` (156 pass), `nx run-many -t typecheck` (exit 0), `nx format:check` (exit 0), `nx lint angular-typechecker` (exit 0), fallow does not flag the fixture.

---
*Phase: 35-automated-code-scanning-proof*
*Completed: 2026-07-21*
