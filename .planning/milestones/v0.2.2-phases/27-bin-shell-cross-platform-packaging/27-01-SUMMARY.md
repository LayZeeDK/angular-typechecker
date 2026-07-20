---
phase: 27-bin-shell-cross-platform-packaging
plan: 01
subsystem: infra
tags: [cli, bin, packaging, tsconfig, eslint, gitattributes, nodenext, shebang, nx-plugin]

# Dependency graph
requires:
  - phase: 26-pure-cli-core-exit-code-wiring
    provides: "the pure run(argv, env): Promise<{ exitCode, stdout, stderr }> core in src/cli/main.ts that bin.ts wraps; the nx-free src/cli/** boundary (D-15) this plan enforces"
provides:
  - "src/cli/bin.ts -- the flush-safe OS shell (shebang + run().then/.catch, the only process.exit/stream-write site)"
  - "package.json two-name bin field (angular-typechecker + atc -> ./src/cli/bin.js)"
  - "tsconfig.lib.json newLine: lf (deterministic LF shebang emit across build hosts)"
  - "repo-root .gitattributes (*.ts eol=lf source guard)"
  - "eslint.config.mjs src/cli/** nx-free import-ban block (CLI-03 / VER-03 enforcement half)"
affects: [27-02, 28-cli-install-run-e2e, 29-docs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Third thin adapter OS shell: bin.ts wires run() to the process boundary, zero logic beyond wiring"
    - "Flush-safe exit: process.exitCode + natural event-loop drain, never process.exit"
    - "nx-free src/cli/** import boundary enforced at lint time (mirrors the core/** block, import-ban only)"

key-files:
  created:
    - packages/angular-typechecker/src/cli/bin.ts
    - .gitattributes
  modified:
    - packages/angular-typechecker/package.json
    - packages/angular-typechecker/tsconfig.lib.json
    - packages/angular-typechecker/eslint.config.mjs

key-decisions:
  - "bin.ts uses .then/.catch (top-level await is illegal under type: commonjs + module: nodenext) and sets process.exitCode, never process.exit (D-02 flush-safety)"
  - "Two bin names map to ONE compiled ./src/cli/bin.js; version stays 0.2.1; files unchanged (D-04/D-05)"
  - "No separate bin tsconfig -- bin.ts inherits tsconfig.lib.json (module: nodenext) so the await import() ESM bridge is not downleveled (D-08/PKG-02)"
  - "cli/** ESLint block is import-ban ONLY -- omits no-console + process.exit ban (bin.ts legitimately writes streams + sets the exit code) (D-09)"

patterns-established:
  - "OS process boundary lives only in bin.ts; run() stays pure (EXIT-02)"
  - "Deterministic LF emit via newLine:lf (primary) + narrow .gitattributes (belt-and-suspenders)"

requirements-completed: [CLI-01, PKG-01, PKG-02, VER-03]

# Metrics
duration: ~12 min
completed: 2026-07-16
---

# Phase 27 Plan 01: Bin shell + cross-platform packaging Summary

**Shipped the thin cross-platform `src/cli/bin.ts` OS shell (flush-safe `run().then/.catch`, `process.exitCode` never `process.exit`), the two-name `bin` field over one compiled `bin.js`, the `newLine: lf` + `.gitattributes` shebang guards, and the nx-free `src/cli/**` ESLint import-ban.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-16T16:49:00+02:00 (approx)
- **Completed:** 2026-07-16T16:57:00+02:00 (approx)
- **Tasks:** 3
- **Files modified:** 5 (2 created, 3 modified) + 1 deferred-items log

## Accomplishments
- `src/cli/bin.ts`: ~15-line shebang + `run(process.argv.slice(2)).then/.catch` shell. Writes `stdout`/`stderr`, sets `process.exitCode` (never `process.exit`, flush-safe D-02), maps an unknown throw to exit 2 (D-03). Imports only `./main`.
- `package.json` `bin`: `angular-typechecker` AND `atc` both -> `./src/cli/bin.js`. `version` still `0.2.1`; `files` unchanged. Confirmed the dist manifest carries the two-name `bin`.
- `tsconfig.lib.json` `newLine: lf`: deterministic LF emit so the compiled shebang has no `\r` (Windows arm64 build host). Built `dist/.../src/cli/bin.js` first line verified `#!/usr/bin/env node` with no CR.
- Repo-root `.gitattributes`: narrow `*.ts text eol=lf` source guard (NOT a repo-wide renormalization).
- `eslint.config.mjs` `**/src/cli/**/*.ts` block: bans `nx`, `@nx/*`, `@angular-devkit/*`, the adapter modules, and the barrel; import-ban ONLY (no `no-console`, no `process.exit` ban). Negative probe (temporary `@nx/devkit` import) tripped the ban; reverted.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the flush-safe bin.ts shell** - `705fe86` (feat)
2. **Task 2: Add the bin field + LF packaging guards** - `2aa6790` (feat)
3. **Task 3: Add the src/cli/** nx-free ESLint import-ban block** - `d4be9cc` (feat)

**Plan metadata:** see the docs commit that carries this SUMMARY + STATE.md + ROADMAP.md + deferred-items.md.

## Files Created/Modified
- `packages/angular-typechecker/src/cli/bin.ts` - NEW: the flush-safe OS shell over `run()`.
- `packages/angular-typechecker/package.json` - MODIFIED: added two-name `bin` field.
- `packages/angular-typechecker/tsconfig.lib.json` - MODIFIED: added `newLine: "lf"`.
- `.gitattributes` - NEW: narrow `*.ts text eol=lf` source guard.
- `packages/angular-typechecker/eslint.config.mjs` - MODIFIED: added the `src/cli/**` nx-free import-ban block.
- `.planning/phases/27-bin-shell-cross-platform-packaging/deferred-items.md` - NEW: logs the pre-existing Phase-26 typecheck defect (see Deferred Issues).

## Decisions Made
- Followed all CONTEXT decisions D-01..D-09 verbatim; the D-02-corrected `process.exitCode` pattern (not the older ARCHITECTURE.md `process.exit` draft) was used.
- Included the optional (Claude's-discretion) adapter-module + barrel bans in the `cli/**` ESLint block for explicit intent, per PATTERNS/RESEARCH.
- Scope: this plan is Tasks 1-3 only. The `bin-static.spec.ts` static guard (VER-03 test half), the `tarball-audit.e2e.spec.ts` publint extension (PKG-01 published half), and `27-ADDITIVE-AUDIT.md` (ADD-01) belong to plan 27-02 -- NOT executed here.

## Deviations from Plan

None - plan executed exactly as written. bin.ts uses `.then/.catch` (Claude's discretion within D-01, as top-level await is illegal under `type: commonjs`), matching the RESEARCH.md pattern.

## Deferred Issues

**1. [Out of scope - pre-existing Phase-26 defect] `nx typecheck` fails on `src/cli/main.spec.ts`**
- **Found during:** 27-01 self-check (`nx run angular-typechecker:typecheck`).
- **Symptom:** `tsc --noEmit -p tsconfig.spec.json` fails with `main.spec.ts(89,...) TS2532 / TS2493` on the `lastColor()` helper (`mocks.renderReport.mock.calls.at(-1)?.[1].color`).
- **Why not fixed here:** `main.spec.ts` is NOT touched by any 27-01 commit (last touched by `4a88087 test(26-02)`); `tsconfig.spec.json` extends `tsconfig.json`, NOT the `tsconfig.lib.json` this plan edited; `newLine` cannot produce a tuple-index type error. It is a Phase-26 escaped defect (26-02 verified test/lint/format but not typecheck). Per the GSD SCOPE BOUNDARY rule, pre-existing failures in unrelated files are logged, not fixed.
- **Impact:** The `typecheck` target is red ONLY on this spec. The other two typecheck commands are green: `tsconfig.drift.json` (the ADD-01 barrel-drift guard, exit 0) and `tsconfig.tools.json` (exit 0). All 27-01 source (`bin.ts`) compiles clean under the build.
- **Recommended home:** a Phase-26 gap-close / quick task (annotate the `renderReport` mock's call-args tuple or guard the `[1]` index). Logged in `deferred-items.md` D1.

## Issues Encountered
- The pre-existing typecheck failure above was investigated and root-caused as a Phase-26 escaped defect (not a 27-01 regression), then logged/deferred per scope rules.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 27-02 can now write `bin-static.spec.ts` (VER-03 dist static guard), extend `tarball-audit.e2e.spec.ts` (PKG-01 published half), and author `27-ADDITIVE-AUDIT.md` (ADD-01) against the shipped bin + packaging.
- Blocker for phase verification: the deferred Phase-26 `main.spec.ts` typecheck defect should be closed before the phase's `nx typecheck` gate is claimed green (owner: a Phase-26 gap-close, not this plan).

## Self-Check

Verification run on the main checkout:
- `nx build angular-typechecker`: GREEN (compiles `bin.ts` -> `dist/.../src/cli/bin.js`, shebang `#!/usr/bin/env node`, no CR; dist manifest carries the two-name `bin`; version 0.2.1; files unchanged).
- `nx test angular-typechecker`: GREEN (433 tests, incl. `gate-a-static.spec.ts` proving the `await import()` ESM bridge is not downleveled -- PKG-02).
- `nx lint angular-typechecker` (maxWarnings:0): GREEN with the new `src/cli/**` block; negative probe (`import '@nx/devkit'`) tripped the ban as expected.
- `nx typecheck` (drift + tools commands): GREEN (barrel-drift ADD-01 guard exit 0, tools exit 0). Spec command RED on a PRE-EXISTING Phase-26 defect in `main.spec.ts` -- deferred (see Deferred Issues / `deferred-items.md`), not a 27-01 regression.

## Self-Check: PASSED (for this plan's deliverables)

All 27-01 deliverables verified: files exist, 3 task commits present, build/test/lint green, `bin.ts` typecheck-clean under the build. The single typecheck-target red is a documented pre-existing Phase-26 defect in an unrelated file, out of this plan's scope.

---
*Phase: 27-bin-shell-cross-platform-packaging*
*Completed: 2026-07-16*
