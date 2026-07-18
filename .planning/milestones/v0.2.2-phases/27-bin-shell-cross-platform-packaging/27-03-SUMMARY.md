---
phase: 27-bin-shell-cross-platform-packaging
plan: 03
subsystem: audit
tags: [additive-only, audit, semver, barrel-drift, public-surface, git-diff, add-01]

# Dependency graph
requires:
  - phase: 27-bin-shell-cross-platform-packaging
    provides: "27-01 shipped the two-name bin field + src/cli/bin.ts + newLine:lf; 27-02 shipped the bin-static + tarball packaging guards -- the net-new surface this audit proves additive"
provides:
  - "27-ADDITIVE-AUDIT.md -- the ADD-01 additive-only verdict vs angular-typechecker@0.2.1 (guard cross-check + per-path git-diff + net-new additions + disposition)"
affects: [milestone-audit, release]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive-only audit = standing-guard cross-check (barrel-drift tripwire green) + per-path git-diff vs the last shipped tag + net-new confirmation via git ls-tree/cat-file; models 24-ADDITIVE-AUDIT.md"

key-files:
  created:
    - .planning/phases/27-bin-shell-cross-platform-packaging/27-ADDITIVE-AUDIT.md
  modified: []

key-decisions:
  - "Verdict ADDITIVE-ONLY HOLDS -- v0.3.0 untriggered; grounded in real git-diff + nx typecheck output, not memory"
  - "Baseline is angular-typechecker@0.2.1 (the last shipped tag), NOT 0.2.0; scope is the whole v0.2.2 milestone (Phases 25-27)"
  - "executor.ts (+13/-195) documented as an INTERNAL, observably-identical Phase-25 logger swap -- not public surface (executor id + schema + schema.d.ts byte-unchanged)"

patterns-established:
  - "Every additive-only surface now has a standing guard; this audit is the milestone-final cross-check + one-off git-diff"

requirements-completed: [ADD-01]

# Metrics
duration: ~10 min
completed: 2026-07-16
---

# Phase 27 Plan 03: Additive-only audit (ADD-01) Summary

**Proved the whole v0.2.2 milestone (Phases 25-27) additive-only vs the concrete `angular-typechecker@0.2.1` tag and recorded the ADDITIVE-ONLY verdict in `27-ADDITIVE-AUDIT.md` -- barrel-drift tripwire green, every public-surface path byte-unchanged, the `bin` field + `src/cli/**` net-new, v0.3.0 untriggered.**

## Performance

- **Duration:** ~10 min
- **Tasks:** 1
- **Files modified:** 1 (1 created)

## Accomplishments

- **Leg (a) barrel-drift tripwire GREEN:** `npx nx typecheck angular-typechecker --skip-nx-cache` ran all three tsc commands (`tsconfig.spec.json`, `tsconfig.drift.json`, `tsconfig.tools.json`) and succeeded. The `tsconfig.drift.json` leg compiles `src/index.drift.ts`, which imports and references all five barrel exports (`runTypecheck`, `TypecheckInfrastructureError`, `CoreOptions`, `CoreResult`, `SkippedReference`), so a removed/renamed export would fail `tsc` LOUDLY. It did not -- the five exports are byte-intact.
- **Leg (b) per-path git-diff vs `angular-typechecker@0.2.1`:** ran `git diff angular-typechecker@0.2.1..HEAD -- <path>` for all 9 public-surface paths (both schemas' `schema.json`, both `schema.d.ts`, `builder.ts`, both generator schemas, `executors.json`, `generators.json`, `builders.json`, `collection.json`, `src/index.ts`). ALL UNCHANGED (empty diff). The only implementation change is `executor.ts` (+13/-195) -- the Phase-25 advisory-notice extraction into `core/emit-advisory-notices` (`emitAdvisoryNotices(result, logger)`), internal + observably identical; the executor id, its `schema.json`/`schema.d.ts`, and the `executors.json` mapping are byte-unchanged, so no consumer-observable contract changed.
- **Leg (c) net-new confirmation:** `git ls-tree -r angular-typechecker@0.2.1 -- .../src/cli/` returns 0 files (HEAD has 8) -- the whole CLI core is net-new (Phase 26 + 27). `git cat-file -e angular-typechecker@0.2.1:.../src/cli/bin.ts` and `.../bin-static.spec.ts` both report absent at the tag. `git show angular-typechecker@0.2.1:.../package.json` has no `"bin"` field. Version stays `0.2.1` at both the tag and HEAD.
- **Leg (d) wrote `27-ADDITIVE-AUDIT.md`** (ASCII-only, 136 lines), modeled on `24-ADDITIVE-AUDIT.md`, baseline `angular-typechecker@0.2.1`: Verdict paragraph (ADDITIVE-ONLY HOLDS, v0.3.0 untriggered); Guard cross-check map table (11 standing guards, all present + green -- confirmed each spec file exists on disk); Git-diff verdict per audited path table (all UNCHANGED) + an internal-change sub-table for the `executor.ts` logger swap; New-file additions table (`src/cli/bin.ts`, `bin-static.spec.ts`, the `bin` field, the rest of `src/cli/**`); ADD-01 disposition paragraph.

## Task Commits

Each task was committed atomically:

1. **Task 1: Run the additive-only audit and write 27-ADDITIVE-AUDIT.md (ADD-01)** - `2411497` (docs)

**Plan metadata:** see the docs commit that carries this SUMMARY + STATE.md + ROADMAP.md.

## Files Created/Modified

- `.planning/phases/27-bin-shell-cross-platform-packaging/27-ADDITIVE-AUDIT.md` - NEW: the ADD-01 additive-only audit doc.

## Decisions Made

- Followed D-12 verbatim. Baseline retargeted `0.2.0` -> `0.2.1` (the last shipped version; v0.2.1 shipped after Phase 24).
- Added `schema.d.ts` (both executor + builder) and `builder.ts` to the audited-path set beyond the plan's minimum -- they are public TS surface and are all byte-unchanged, strengthening the verdict.
- Documented `executor.ts` as an internal, observably-identical change in a dedicated sub-table (transparent, grounded in the real diff) rather than omitting it, because the plan explicitly calls out the Phase-25 logger swap.

## Deviations from Plan

None - plan executed exactly as written. No breaking change was found on any public-surface path, so the ADDITIVE-ONLY verdict is genuine (no false verdict, no v0.3.0 trigger). No production code changed; no `nx release`; version stays `0.2.1`.

## Deferred Issues

None from this plan.

## Next Phase Readiness

- Phase 27's requirements (CLI-01, PKG-01, PKG-02, VER-03, ADD-01) are all ready for phase verification -- 27-03 (ADD-01) was the last plan in the phase.
- The milestone is proven additive-only; the eventual release stays on the 0.2.x line (the version bump remains the human-gated Release-PR flow, not any phase).

## Self-Check

Verification run on the main checkout:

- `git tag -l 'angular-typechecker@0.2*'`: FOUND `angular-typechecker@0.2.1` (the baseline).
- `npx nx typecheck angular-typechecker --skip-nx-cache`: GREEN (3 tsc commands incl. `tsconfig.drift.json` barrel-drift tripwire).
- Per-path `git diff angular-typechecker@0.2.1..HEAD`: 9 public-surface paths + `schema.d.ts` x2 + `builder.ts` all UNCHANGED; `executor.ts` internal-only.
- `git ls-tree`/`git cat-file`: `src/cli/` tree + `bin.ts` + `bin-static.spec.ts` + the `bin` field all net-new (absent at the tag).
- All 11 standing-guard spec files cited in the doc confirmed present on disk.
- `27-ADDITIVE-AUDIT.md` exists, is ASCII-only (no non-ASCII), contains `ADDITIVE-ONLY` (x3), states baseline `angular-typechecker@0.2.1`, and carries all five sections.
- Task commit `2411497` present in git history.

## Self-Check: PASSED

Audit doc created, ASCII-only, grounded in real git-diff + nx typecheck output; verdict ADDITIVE-ONLY; task commit present.

---
*Phase: 27-bin-shell-cross-platform-packaging*
*Completed: 2026-07-16*
