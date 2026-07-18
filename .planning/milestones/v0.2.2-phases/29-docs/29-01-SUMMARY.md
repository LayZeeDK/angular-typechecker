---
phase: 29-docs
plan: 01
subsystem: docs
tags: [readme, changelog, cli, standalone-cli, doc-tripwire, vitest, supply-chain]

# Dependency graph
requires:
  - phase: 26-cli-foundation
    provides: parseCliArgs / HELP_TEXT (the flag set + 0/1/2 exit-code line the docs mirror)
  - phase: 27-cli-bin
    provides: the two-name bin (angular-typechecker + atc) the install docs describe
  - phase: 28-cli-e2e
    provides: the shipped-tarball CLI verification the docs now describe as released
provides:
  - README `## Standalone CLI` section (install + 7-flag table + 0/1/2 exit-code table) + ToC anchor
  - Curated public `## 0.2.2` CHANGELOG entry (end-user language, undated)
  - standalone-cli-docs.spec.ts doc-drift tripwire (supply-chain guard + HELP_TEXT/README drift-lock + CHANGELOG hygiene)
affects: [release, v0.2.2-release-pr]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Doc-drift tripwire: pure fs read + `\\s+`-normalized `toContain`, cloned from angular-cli-docs.spec.ts"
    - "HELP_TEXT/README single-source drift-lock via the exported parseCliArgs(['--help'])"

key-files:
  created:
    - packages/angular-typechecker/src/standalone-cli-docs.spec.ts
  modified:
    - packages/angular-typechecker/README.md
    - CHANGELOG.md

key-decisions:
  - "README subsection kept named `### Exit codes`; the duplicate `#exit-codes` anchor is harmless (the pre-existing `## Exit codes` keeps the base anchor, so all existing cross-links still resolve)"
  - "Warning phrased so the literal token `npx atc` never appears in README or CHANGELOG (the tripwire asserts not.toContain('npx atc'))"
  - "0.2.2 left UNDATED to match 0.2.1 (date stamped at the Release-PR cut)"

patterns-established:
  - "Doc tripwire that reads BOTH the README and the repo-root CHANGELOG (first tripwire to assert on CHANGELOG)"

requirements-completed: [DOC-01]

# Metrics
duration: 4min
completed: 2026-07-17
---

# Phase 29 Plan 01: Docs Summary

**Documented the shipped standalone CLI: a README `## Standalone CLI` section (install, 7-flag table mirroring HELP_TEXT, and the `0`/`1`/`2` exit-code contract), a curated public `## 0.2.2` CHANGELOG entry, and a doc-drift tripwire that locks the supply-chain guard, the flag set, and CHANGELOG hygiene.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-16T23:40:50Z
- **Completed:** 2026-07-16T23:44:44Z
- **Tasks:** 3
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments

- README `## Standalone CLI` section placed between `## Angular CLI` and `## Storybook`, with a matching `[Standalone CLI](#standalone-cli)` ToC anchor. Leads with the canonical `npx angular-typechecker -c <tsconfig>`; documents `atc` only as a post-install PATH alias with an explicit `atc@0.0.6` supply-chain warning; a 7-flag table mirroring HELP_TEXT; and a `0`/`1`/`2` exit-code table framed as the first adapter to own literal `2` (reconciled with, not contradicting, the existing `## Exit codes` section).
- Curated, undated `## 0.2.2` CHANGELOG entry in end-user language (bold lead + `### Features` / `### Notes` / `### Compatibility`), framed as purely additive, with no internal ids/scopes.
- New `standalone-cli-docs.spec.ts` doc tripwire (447 tests green): asserts the heading + ToC anchor, `npx angular-typechecker` present + `not.toContain('npx atc')` + `atc@0.0.6` named, every HELP_TEXT flag token in BOTH the README and the live `parseCliArgs(['--help'])` output, the `0`/`1`/`2` triad, and a leak-free `## 0.2.2` CHANGELOG entry.

## Task Commits

Each task was committed atomically:

1. **Task 1: README `## Standalone CLI` section + ToC anchor** - `2e2b8a5` (docs)
2. **Task 2: Curated `## 0.2.2` CHANGELOG entry** - `00f7449` (docs)
3. **Task 3: `standalone-cli-docs.spec.ts` doc tripwire** - `dc5f192` (test)

## Files Created/Modified

- `packages/angular-typechecker/README.md` - Added the `## Standalone CLI` section + ToC anchor; removed the now-stale "standalone CLI is a non-goal" Limitations line.
- `CHANGELOG.md` - Added the curated `## 0.2.2` entry above `## 0.2.1`.
- `packages/angular-typechecker/src/standalone-cli-docs.spec.ts` - New doc-drift + supply-chain + CHANGELOG-hygiene tripwire.

## Decisions Made

- Kept the section subsection heading `### Exit codes` despite the duplicate `#exit-codes` anchor. The pre-existing top-level `## Exit codes` claims the base anchor, so every existing `[Exit codes](#exit-codes)` cross-link still resolves; the new subsection is reachable at GitHub's auto-suffixed anchor and nothing links to it.
- Phrased the supply-chain warning so the literal token `npx atc` never appears in either doc (the tripwire's `not.toContain('npx atc')` would otherwise fail).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed the stale "standalone CLI is a non-goal" Limitations line**
- **Found during:** Task 1 (README `## Standalone CLI` section)
- **Issue:** README `## Limitations` stated "Machine-readable reporters (JSON, SARIF) and a standalone CLI are non-goals in v0.x." The standalone CLI shipped in Phases 25-28, so the new `## Standalone CLI` section directly contradicts that line.
- **Fix:** Narrowed the line to "Machine-readable reporters (JSON, SARIF) are non-goals in v0.x." (same class of fix as Phase 24's stale Installation line correction).
- **Files modified:** packages/angular-typechecker/README.md
- **Verification:** Task 1 inline verify + full `nx test` (447) / `format:check` / `lint` / `typecheck` all green.
- **Committed in:** 2e2b8a5 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug: stale contradicting doc line)
**Impact on plan:** In-scope docs coherence fix, no scope creep. No behavior/CLI/packaging change (docs-only phase honored).

## Issues Encountered

None. Prettier reformatted the README markdown tables on the Task 1 `prettier --write` pass; tokens survived and all inline verifies and the full gate battery passed.

## Verification

All four repo gates green (memory `verify-format-and-lint-before-release`):

- `nx test angular-typechecker` - 44 files / 447 tests passed (includes the new tripwire)
- `nx format:check` - clean
- `nx lint angular-typechecker` - all files pass linting (maxWarnings:0)
- `nx typecheck angular-typechecker` - spec + drift + tools tsc all green

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- DOC-01 is closed: the standalone CLI is documented in the README (ships to npm) and in the CHANGELOG (feeds the curated GitHub Release notes).
- The `## 0.2.2` CHANGELOG entry is written but the release is NOT cut here -- the version bump/tag/publish is the separate human-gated Release-PR flow (AGENTS.md). The entry stays undated until that cut.

## Self-Check: PASSED

- FOUND: packages/angular-typechecker/README.md
- FOUND: CHANGELOG.md
- FOUND: packages/angular-typechecker/src/standalone-cli-docs.spec.ts
- FOUND commit: 2e2b8a5 (Task 1)
- FOUND commit: 00f7449 (Task 2)
- FOUND commit: dc5f192 (Task 3)

---
*Phase: 29-docs*
*Completed: 2026-07-17*
