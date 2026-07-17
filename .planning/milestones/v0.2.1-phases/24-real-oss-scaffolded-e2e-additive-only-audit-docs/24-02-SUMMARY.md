---
phase: 24-real-oss-scaffolded-e2e-additive-only-audit-docs
plan: 02
subsystem: docs
tags: [readme, changelog, angular-cli, ng-add, tripwire, docs-guard]

# Dependency graph
requires:
  - phase: 21-angular-cli-builder-engine-multi-tsconfig-gate-a-spike-go-no
    provides: the Angular CLI builder (convertNxExecutor) + ng run <project>:typecheck
  - phase: 22-configuration-schematic-the-angular-json-write-fork
    provides: the angular.json write-fork (per-project tsConfig-array target)
  - phase: 23-init-schematic-parity-first-party-ng-add
    provides: ng add auto-wire-all + the no-caching notice
provides:
  - README `## Angular CLI` end-user section documenting the full consumer flow
  - src/angular-cli-docs.spec.ts content tripwire locking the load-bearing claims
  - curated CHANGELOG 0.2.1 prose entry (no version cut)
affects: [release-pr, milestone-close, v0.2.1-docs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Docs content tripwire (README readFileSync + normalized toContain) per storybook-docs.spec.ts"

key-files:
  created:
    - packages/angular-typechecker/src/angular-cli-docs.spec.ts
  modified:
    - packages/angular-typechecker/README.md
    - CHANGELOG.md

key-decisions:
  - "Placed `## Angular CLI` between `## How it compares` and `## Storybook`; kept the Storybook 'not supported' caveat coherent by deferring the Storybook case rather than weakening it"
  - "Corrected the now-stale Installation line 'there is no Angular-CLI installer' -- Phases 21-23 shipped `ng add` (Rule 1 fix)"
  - "CHANGELOG 0.2.1 entry is prose only: no date, no link ref, no version bump, no tag (the cut is the human-gated Release-PR flow)"

patterns-established:
  - "Docs tripwire: lock section-unique normalized substrings so deleting the section fails CI; do not duplicate a sibling tripwire's claims"

requirements-completed: [ACD-01]

# Metrics
duration: ~15min
completed: 2026-07-11
---

# Phase 24 Plan 02: Angular CLI docs + content tripwire Summary

**README `## Angular CLI` end-user section (ng add auto-wire-all, ng run parity, tsConfig-array targets, nx-transitive/no-caching, off-stack --legacy-peer-deps), a filesystem-read docs tripwire locking those claims, and a curated 0.2.1 CHANGELOG entry -- all prose, no version cut.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-11 (after 24-01 completed)
- **Completed:** 2026-07-11
- **Tasks:** 3
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments

- Documented the complete Angular CLI consumer flow in the README in end-user language: `ng add angular-typechecker` (auto-wires a `typecheck` target into every application + library, idempotent), `ng generate angular-typechecker:configuration <project>` (single project), and `ng run <project>:typecheck` (exit verdict identical to the Nx executor), plus the per-project `tsConfig`-array target shape, the `nx`-transitive / `.nx/` / no-target-caching notes, and the off-stack `--legacy-peer-deps` note for Angular < 22.
- Added `src/angular-cli-docs.spec.ts`, a pure filesystem-read tripwire mirroring `storybook-docs.spec.ts`, that locks the load-bearing `## Angular CLI` claims via normalized `toContain` assertions -- deleting or softening the section fails CI on every PR.
- Added a curated end-user `0.2.1` CHANGELOG entry (prose only) describing Angular CLI workspace support, with no internal ids, no version bump, and no tag.
- Kept the shipped Storybook "Angular CLI Storybook setup ... is not supported" caveat intact and coherent (the new section defers the Storybook case rather than contradicting it); the unchanged `storybook-docs.spec.ts` stays green.

## Task Commits

Each task was committed atomically:

1. **Task 1: README `## Angular CLI` section** - `1b928cc` (docs)
2. **Task 2: Angular CLI docs content tripwire** - `c719955` (test)
3. **Task 3: Curated CHANGELOG 0.2.1 prose entry** - `830ca46` (docs)

**Plan metadata:** (this SUMMARY + STATE/ROADMAP/REQUIREMENTS) - final commit below.

## Files Created/Modified

- `packages/angular-typechecker/README.md` - New top-level `## Angular CLI` section (+ ToC entry); corrected the stale Installation "no Angular-CLI installer" line to point to it.
- `packages/angular-typechecker/src/angular-cli-docs.spec.ts` - New docs content tripwire (9 tests) locking the Angular CLI claims.
- `CHANGELOG.md` - New curated `0.2.1` prose entry for Angular CLI workspace support (no cut).

## Decisions Made

- **Section placement:** `## Angular CLI` sits between `## How it compares` and `## Storybook`, a natural flow (Nx contrast -> Angular CLI path -> Storybook). ToC updated to match.
- **Storybook-caveat coherence:** the new section adds a one-line deferral -- "A Storybook wired through the Angular CLI is a separate, unsupported case" -- so it reads coherently with, and does not weaken, the existing Storybook "not supported" caveat. The tripwire locks that deferral too.
- **Tripwire anchor choice:** each assertion targets a phrase unique to the `## Angular CLI` section (verified against the whole README), so removing the section makes the spec RED; the off-stack claim locks the unique phrase "an Angular workspace older than 22 cannot satisfy them" rather than the bare `--legacy-peer-deps` string, which also appears in Requirements and Storybook.
- **CHANGELOG prose only:** no date, no bottom link reference, no `package.json` bump, no `nx release`, no tag -- the 0.2.0 -> 0.2.1 cut is the separate human-gated Release-PR flow (AGENTS.md).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected a now-false Installation claim ("there is no Angular-CLI installer")**
- **Found during:** Task 1 (README `## Angular CLI` section)
- **Issue:** The Installation section stated "This is `nx add`, not the Angular CLI's `ng add`, and there is no Angular-CLI installer." That was true before this milestone but is now false: Phases 21-23 shipped the first-party `ng add` / `ng generate` Angular CLI surface, which this very plan documents. Leaving the line would directly contradict the new section.
- **Fix:** Rewrote the line to "This is `nx add`, the Nx installer. In a plain Angular CLI (`angular.json`) workspace, use `ng add angular-typechecker` instead; see [Angular CLI](#angular-cli)."
- **Files modified:** packages/angular-typechecker/README.md
- **Verification:** `npx nx test angular-typechecker` green (323 tests); prettier `--check` clean; no stray scoped ref (`scoped-name-guard` green).
- **Committed in:** `1b928cc` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug / stale-doc correction)
**Impact on plan:** The fix removes a documentation contradiction the new section would otherwise create; it is contained to the same file and section-adjacent. No scope creep -- still docs-only, no production code touched.

## Issues Encountered

- Prettier flagged the new spec on first write (line-wrap of the `readmePath` join and one assertion argument); `prettier --write` fixed it and the assertions are unchanged. No functional impact.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ACD-01 is satisfied: README `## Angular CLI` section (all D-06 enumerated contents) + curated CHANGELOG 0.2.1 prose entry + a standing docs tripwire, with the Storybook caveat preserved and no version cut.
- `package.json` remains at `0.2.0`; the 0.2.1 version cut + tag + npm publish stay with the human-gated Release-PR flow (AGENTS.md).
- Plan 24-01 (ACV-03 gap-fill + ACP-02 audit) and 24-02 (docs) are done; the remaining Phase 24 work is the e2e substrate + verification/audit artifacts and the phase-level verification.

## Self-Check: PASSED

- Files: README.md, src/angular-cli-docs.spec.ts, CHANGELOG.md, 24-02-SUMMARY.md all present.
- Commits: 1b928cc (README), c719955 (spec), 830ca46 (CHANGELOG) all in history.

---
*Phase: 24-real-oss-scaffolded-e2e-additive-only-audit-docs*
*Completed: 2026-07-11*
