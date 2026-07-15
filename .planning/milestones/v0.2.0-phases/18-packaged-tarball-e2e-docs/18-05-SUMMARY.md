---
phase: 18-packaged-tarball-e2e-docs
plan: 05
subsystem: docs
tags: [readme, changelog, storybook, coverage-claim, wr-01, sb-07]

# Dependency graph
requires:
  - phase: 18-01
    provides: the notTypeCheckedDeclaredFiles advisory field on CoreResult
  - phase: 18-04
    provides: the packaged-tarball Storybook criterion-1 e2e (Layout A + B)
provides:
  - README ## Storybook section carrying the exact MUST/MUST-NOT/caveat coverage claim
  - README Limitations WR-01 fix (zero-input in-project leaf is coverage-incomplete)
  - README Programmatic-API CoreResult comment updated with notTypeCheckedDeclaredFiles
  - Curated CHANGELOG 0.1.2 section with the green->red false-pass -> true-fail callout
  - WR-01 todo resolved
affects: [v0.1.2 release cut, milestone close, README/CHANGELOG]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Prose-only docs plan: author README + CHANGELOG for a release without cutting it (D-05)"
    - "Negative-grep-safe wording: avoid the literal MUST-NOT phrases even when negating them"

key-files:
  created: []
  modified:
    - packages/angular-typechecker/README.md
    - CHANGELOG.md
    - .planning/todos/resolved/wr-01-readme-coverage-incomplete.md

key-decisions:
  - "Dated the 0.1.2 CHANGELOG header 2026-07-06 (provisional; amended at the Release-PR cut)"
  - "Capitalized SOLUTION in the coverage claim to match the board CONSENSUS verbatim + the plan key_link pattern"
  - "Reworded the MUST-NOT paragraph so it does not contain the literal forbidden substrings (negation would still trip a substring grep)"

patterns-established:
  - "Coverage claim spine sourced verbatim from board CONSENSUS.md, restated in README prose style"

requirements-completed: [SB-07]

# Metrics
duration: 18min
completed: 2026-07-06
---

# Phase 18 Plan 05: SB-07 docs Summary

**README Storybook coverage section (exact MUST/MUST-NOT/caveat claim), Limitations WR-01 fix (zero-input leaf is coverage-incomplete), CoreResult comment update, and a curated CHANGELOG 0.1.2 section with the green->red false-pass -> true-fail callout -- prose only, no release cut.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-07-06T13:34:00Z
- **Completed:** 2026-07-06T13:52:14Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added a `## Storybook` README section whose spine is the exact board CONSENSUS coverage claim (complete Angular type-check over the files the Storybook tsconfig declares, provided the target points at the SOLUTION `tsconfig.json`), plus the MUST-NOT scope limits and every MUST caveat (`.mdx` never checked; `.tsx` only with `jsx`; external `templateUrl` via `relatedInformation` owner mapping; Layout C unsupported; leaf tsconfig excludes stories; force-install `--legacy-peer-deps`/`--force` and `ERR_PNPM_IGNORED_BUILDS`; forced-SB10's node_modules `.d.ts` errors suppressed while genuine `main.ts`/`preview.ts` TS6 errors are real). Added the Contents entry and the DX note (target reads `references[]` at execute time).
- Rewrote the README Limitations single-level-walk bullet (WR-01): a referenced in-project leaf resolving to zero input files now yields a non-clean coverage-incomplete verdict; only out-of-project / duplicate / self references stay advisory. Old "empty ... skipped with an advisory warning and do not change the verdict" wording removed.
- Updated the Programmatic-API `CoreResult` shape comment with `notTypeCheckedDeclaredFiles?: readonly string[]`.
- Wrote a curated CHANGELOG `## 0.1.2` section above `## 0.1.1` (Features / Fixes / Internal / Compatibility) with a prominent blockquote green->red behavior-change callout, plus the `[0.1.2]:` ref-link footer. No version bump, no tag (D-05).
- Resolved the WR-01 todo (`git mv` pending -> resolved, `status: resolved`).

## Task Commits

Each task was committed atomically:

1. **Task 1: README Storybook section + Limitations WR-01 fix + CoreResult comment** - `f5ae1fc` (docs)
2. **Task 2: Curated CHANGELOG 0.1.2 section + resolve WR-01 todo** - `624beab` (docs)

**Plan metadata:** (final metadata commit below)

## Files Created/Modified

- `packages/angular-typechecker/README.md` - New `## Storybook` section + Contents entry, rewritten Limitations WR-01 bullet, updated CoreResult comment.
- `CHANGELOG.md` - Curated 0.1.2 section with the green->red callout and the `[0.1.2]` ref-link.
- `.planning/todos/resolved/wr-01-readme-coverage-incomplete.md` - Moved from pending; `status: resolved`.

## Decisions Made

- Dated the 0.1.2 header `2026-07-06` (provisional; the actual date is amended when the release is cut through the AGENTS.md Release-PR flow). D-05: no `nx release`, no version bump, no tag -- `package.json` version stays `0.1.1`.
- Capitalized SOLUTION in the coverage claim to match both the board CONSENSUS.md verbatim wording and the plan's `key_link` pattern `SOLUTION \`tsconfig.json\``.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MUST-NOT paragraph tripped its own negative acceptance grep**
- **Found during:** Task 1 (README Storybook section)
- **Issue:** The plan's acceptance check requires `git grep -i 'complete storybook coverage'` (and `'all storybook files'`) to return nothing. My first draft negated those phrases by quoting them (`It is not "complete Storybook coverage" or a check of "all Storybook files"`), which still contains the literal substrings and would fail the substring grep.
- **Fix:** Reworded to "It does not cover every Storybook file, it is not a guarantee of exhaustive Storybook checking" -- same MUST-NOT meaning, no forbidden substring.
- **Files modified:** packages/angular-typechecker/README.md
- **Verification:** `git grep -i 'complete storybook coverage'` and `'all storybook files'` both return nothing.
- **Committed in:** f5ae1fc (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The reword preserves the exact MUST-NOT semantics while satisfying the negative acceptance grep. No scope creep.

## Issues Encountered

- `angular-typechecker` has no `format:check` project target (`format:check` is a workspace-level Nx command), so the plan's `nx run-many -t format:check lint -p angular-typechecker` ran only `lint`. Verified README + CHANGELOG formatting directly with `npx prettier --check` (both clean) and `lint` passes (maxWarnings:0).

## User Setup Required

None - prose-only docs plan.

## Next Phase Readiness

- SB-07 satisfied: README + CHANGELOG carry the exact coverage claim, caveats, and the green->red callout; WR-01 resolved.
- The v0.1.2 release CUT (nx release / version bump / tag / OIDC publish) is intentionally NOT done here -- it runs through the AGENTS.md Release-PR flow after the milestone closes (D-05). The CHANGELOG date is provisional and amended at cut time.

## Self-Check: PASSED

- FOUND: packages/angular-typechecker/README.md
- FOUND: CHANGELOG.md
- FOUND: .planning/todos/resolved/wr-01-readme-coverage-incomplete.md
- FOUND: .planning/phases/18-packaged-tarball-e2e-docs/18-05-SUMMARY.md
- FOUND commit: f5ae1fc (Task 1)
- FOUND commit: 624beab (Task 2)

---
*Phase: 18-packaged-tarball-e2e-docs*
*Completed: 2026-07-06*
