---
phase: quick-260703-wcg
plan: 01
subsystem: docs
tags: [license, readme, nx-plugin, packaging, ci, problem-matcher]

# Dependency graph
requires: []
provides:
  - Repo-root ./LICENSE (moved via git mv, history preserved) still shipped in the tarball via the build asset
  - Consumer-facing package README with badges, honest Output example, CI integration, and a Programmatic API section
affects: [release, packaging, docs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Build asset input '.' (workspace-root-relative) copies a repo-root file into the package dist"

key-files:
  created:
    - LICENSE
  modified:
    - packages/angular-typechecker/project.json
    - README.md
    - packages/angular-typechecker/README.md

key-decisions:
  - "CI problem-matcher regexp and Output example match the tool's REAL renderer format (file:line:col - error CODE:), not the file(line,col): / file:line:col: shape loosely described in RESEARCH.md"

patterns-established:
  - "Package README documents only real features (single formatDiagnostics output; no JSON/SARIF, no standalone CLI, no Angular-CLI installer)"

requirements-completed:
  - "quick-260703-wcg: relocate LICENSE to repo root; overhaul the published package README"

# Metrics
duration: ~15min
completed: 2026-07-03
---

# Phase quick-260703-wcg Plan 01: LICENSE relocation and package README overhaul Summary

**Moved LICENSE to the repo root (kept in the tarball via a workspace-root build asset) and rewrote the published package README with badges, a byte-accurate Output example, a tsc-superset CI problem matcher, and a Programmatic API section.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-03T23:43:50+02:00
- **Tasks:** 2
- **Files modified:** 4 (1 created via rename, 3 edited)

## Accomplishments

- Relocated `packages/angular-typechecker/LICENSE` to `./LICENSE` with `git mv` (100% rename, history preserved); the root file still lands in `dist/packages/angular-typechecker/LICENSE` and the packed tarball.
- Repointed the build asset `input` from `./packages/angular-typechecker` to `.` so `@nx/js:tsc` copies the ROOT LICENSE into dist; touched no other asset.
- Fixed the root README license link target AND visible text to `[`LICENSE`](./LICENSE)`.
- Overhauled the package README: badge row (npm version, license, CI), trimmed Why, honest single-format Output with a real TS2322 + NG8002 codeframe example, CI integration (problem matcher + add-matcher step), and a brief Programmatic API section matching the barrel exports exactly.
- Left `packages/angular-typechecker/package.json` untouched (its `files` array is asserted by `package-manifest.spec.ts`).

## Task Commits

Each task was committed atomically with public-changelog-safe scopes:

1. **Task 1: Relocate LICENSE to repo root** - `100b3ad` (chore(license))
2. **Task 2: Overhaul the published package README** - `3ba8d7f` (docs(readme))

_Docs artifacts (this SUMMARY, PLAN, RESEARCH, STATE) are committed separately by the orchestrator._

## Files Created/Modified

- `LICENSE` - MIT license, now at repo root (moved from the package dir; history preserved).
- `packages/angular-typechecker/project.json` - LICENSE build-asset `input` changed to `.` so the root LICENSE ships in dist.
- `README.md` - root README license link retargeted to `./LICENSE` (target + display text).
- `packages/angular-typechecker/README.md` - full consumer-facing rewrite (badges, Output, CI integration, Programmatic API).

## Decisions Made

- **Output example and problem-matcher regexp match the tool's actual renderer.** The real output (from `format-report.ts` -> Angular `formatDiagnostics`, which calls `formatDiagnosticsWithColorAndContext` unconditionally) is `file:line:col - error CODE: message` followed by a codeframe. I generated a byte-accurate example with the installed `@angular/compiler-cli` `formatDiagnostics` rather than hand-aligning a codeframe, and wrote the matcher regexp (`^(\S.*?):(\d+):(\d+)\s+-\s+(error|warning)\s+((?:TS|NG)\d+):\s+(.*)$`) to match that exact format.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in the deliverable] CI problem-matcher pattern corrected to the tool's real output format**

- **Found during:** Task 2 (README CI integration section)
- **Issue:** PLAN.md step 9 and RESEARCH.md section 4 describe the diagnostic line as `file:line:col: error TSxxxx: message` (a `: ` separator before the severity). The tool's real renderer emits `file:line:col - error CODE: message` (a ` - ` separator, plus a codeframe), because Angular's `formatDiagnostics` calls `formatDiagnosticsWithColorAndContext` unconditionally (verified in `format-report.ts` and by running the installed `@angular/compiler-cli`). A matcher built to the literally-described `: ` shape would annotate NOTHING against the real output.
- **Fix:** Wrote the Output example from real renderer output and authored the `.github/matchers/tsc.json` regexp to match the actual ` - ` format (still a tsc superset that captures both `TSxxxx` and `NGxxxx`, per the plan's intent).
- **Files modified:** packages/angular-typechecker/README.md
- **Verification:** Byte-accurate example generated via `@angular/compiler-cli` `formatDiagnostics`; content-substring check + prettier + lint pass.
- **Committed in:** 3ba8d7f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 correctness fix to the deliverable's documented recipe)
**Impact on plan:** The correction keeps the CI recipe actually functional against the tool's real output. No scope creep; the plan's intent (a working tsc-superset problem matcher) is preserved.

## Issues Encountered

- None. All planned verification passed on the main checkout.

## Verification Results

All run on the main checkout (single-plan wave, no worktree):

1. **Build + LICENSE placement** - PASS
   - `nx build angular-typechecker --skip-nx-cache`: success
   - `test -f dist/packages/angular-typechecker/LICENSE`: PASS
   - `test -f LICENSE`: PASS
   - `test ! -f packages/angular-typechecker/LICENSE`: PASS
2. **Package unit tests** (`nx test angular-typechecker --skip-nx-cache`) - PASS (35 files, 252 tests; `package-manifest.spec.ts` green, source package.json `files` unchanged).
3. **Tarball-audit e2e** (`nx test angular-typechecker-install-e2e --skip-nx-cache`) - PASS (5 files, 26 tests; `tarball-audit.int.spec.ts` asserts `LICENSE` is packed). Caveat: the install-smoke spec logs an internal `consumer-app:typecheck failed` line - that is the spec's DELIBERATELY injected TS2322 error being captured as a non-zero-exit assertion, not a real failure; the outer target reports success.
4. **Prettier** (`npx prettier --check packages/angular-typechecker/README.md packages/angular-typechecker/project.json README.md`) - PASS (README canonicalized with `--write` before commit; collapsed two import lines).
5. **Lint** (`nx run angular-typechecker:lint --skip-nx-cache`) - PASS (all files pass; the `@nx/eslint:lint` v24-deprecation notice is pre-existing and out of scope).

## Next Phase Readiness

- LICENSE is at the conventional root location so the shields.io license badge and the GitHub `main/LICENSE` link resolve.
- Package README is complete and accurate for the npm page and AI agents; no invented features.
- Ready for a Release PR when a `feat`/`fix` warrants a version bump (these two commits are `chore`/`docs` - no bump on their own).

## Self-Check: PASSED

- All created/modified files present: `LICENSE`, `packages/angular-typechecker/project.json`, `README.md`, `packages/angular-typechecker/README.md`, SUMMARY.md.
- Source `packages/angular-typechecker/LICENSE` confirmed gone (rename, not a stray deletion).
- Both task commits present: `100b3ad`, `3ba8d7f`.

---
*Phase: quick-260703-wcg*
*Completed: 2026-07-03*
