---
phase: 27-bin-shell-cross-platform-packaging
plan: 02
subsystem: verification
tags: [cli, bin, packaging, shebang, nx-free, static-guard, tarball, publint, e2e]

# Dependency graph
requires:
  - phase: 27-bin-shell-cross-platform-packaging
    provides: "27-01 shipped src/cli/bin.ts, the two-name bin field, newLine:lf, .gitattributes, and the src/cli/** ESLint block -- the BUILT and PACKED machinery these guards read"
provides:
  - "bin-static.spec.ts -- test-tier static guard: built dist bin.js has a \\r-free #!/usr/bin/env node shebang AND an nx-free require graph (VER-03)"
  - "tarball-audit.e2e.spec.ts extension -- packed manifest maps both bin names to a shipped ./src/cli/bin.js with a \\r-free shebang; publint --strict covers the bin (PKG-01 / CLI-01 published halves)"
affects: [27-03, 28-cli-install-run-e2e]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dist-read static guard mirrors gate-a-static.spec.ts: distRoot from project.json build.options.outputPath (never hard-coded), read the BUILT .js with fs (never git grep on gitignored dist/)"
    - "Static transitive require-graph walk: matchAll specifiers per comment-stripped file, check every specifier against /^(@nx\\/|nx\\/|nx$)/, follow only relative specifiers (+ '.js', existsSync-guarded); bare/builtin checked-not-followed; @angular/compiler-cli never appears (await import())"
    - "Extend the existing tarball audit rather than add a new spec/project/dependency: publint's bin rule covers shebang correctness for free once the bin field exists"

key-files:
  created:
    - packages/angular-typechecker/src/cli/bin-static.spec.ts
  modified:
    - e2e/angular-typechecker-install-e2e/src/tarball-audit.e2e.spec.ts

key-decisions:
  - "bin-static.spec.ts packageRoot walks UP 2 dirs (src/cli -> src -> packageRoot), NOT 3 like gate-a-static (src/executors/typecheck) -- the one difference from the model (D-10)"
  - "The require-graph walk uses matchAll (not a stateful .exec loop) so recursion cannot corrupt the shared regex lastIndex; the nx-CHECK runs on every specifier before any follow, so no specifier is ever skipped"
  - "Extended the existing tarball-audit spec in place (no new file/dep/project); new describe heading 'CLI-01/PKG-01' avoids the v0.2.0 'PKG-02' id collision (D-11)"
  - "Both guards are STATIC/published-artifact reads only; the runtime require.cache probe on the INSTALLED bin is deferred to Phase 28 (VER-04)"

patterns-established:
  - "The shebang guard has two halves: the dist byte-check (this plan, test tier) and the published-tarball byte-check (this plan, e2e tier)"

requirements-completed: []

# Metrics
duration: ~15 min
completed: 2026-07-16
---

# Phase 27 Plan 02: Bin packaging verification guards Summary

**Shipped the two standing guards that prove Phase-27 packaging survived the build and the pack: a `test`-tier static guard on the BUILT `bin.js` (`\r`-free shebang + nx-free require graph, VER-03) and a published-artifact audit on the PACKED tarball (both bin names -> a shipped `./src/cli/bin.js` with a clean shebang; publint covers the bin rule -- PKG-01 / CLI-01 published halves).**

## Performance

- **Duration:** ~15 min (includes a full 400s install-e2e run)
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- `src/cli/bin-static.spec.ts` (NEW, 127 lines): mirrors `gate-a-static.spec.ts` verbatim -- same imports, the `BuildTarget`/`ProjectJson` interfaces, `stripCommentLines`, and `distRoot = join(workspaceRoot, projectJson.targets.build.options.outputPath)` (never a hard-coded `dist/...`). THE one difference: `packageRoot` walks UP 2 dirs (`'..','..'`) because the spec sits at `src/cli/`, not 3 like gate-a at `src/executors/typecheck/`. Two assertion families:
  - (a) `readFileSync(binJsPath).split('\n')[0]` is exactly `#!/usr/bin/env node` AND `.not.toContain('\r')` (CRLF guard on the Windows arm64 build host).
  - (b) a static transitive walk from `bin.js`: per file, `stripCommentLines` -> `matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)` -> assert no specifier matches `/^(@nx\/|nx\/|nx$)/`, follow only relative specifiers (`join(dir, spec + '.js')`, `existsSync`-guarded, `visited` set). `matchAll` (not a stateful `.exec` loop) means recursion cannot corrupt the shared regex `lastIndex`, and every specifier is nx-checked before any follow. Green: the graph reaches only `./main -> ../core/** + node:* + tslib`; no `@nx/*`/`nx`.
- `e2e/angular-typechecker-install-e2e/src/tarball-audit.e2e.spec.ts` (EXTENDED, +35 lines, no new file/dep/project):
  - Added `'src/cli/bin.js'` to `REQUIRED_FILES` (the compiled bin must ship; excluded from the `.spec.` leak guard, and `bin-static.spec.ts` is dropped from the tarball by `tsconfig.lib.json`).
  - Extended `TarballManifest` with `bin?: Record<string, string>`.
  - New `describe('CLI-01/PKG-01: the packed tarball ships a runnable bin')` (distinct heading -- the existing `PKG-02` block is a v0.2.0 id): reads `extractDir/package/package.json` and asserts `manifest.bin['angular-typechecker'] === './src/cli/bin.js'` AND `manifest.bin['atc'] === './src/cli/bin.js'`; asserts `filePaths` contains `src/cli/bin.js`; reads the shipped `src/cli/bin.js` and asserts a `\r`-free `#!/usr/bin/env node` first line.
  - The pre-existing `npx publint "<tgz>" --strict` assertion now covers the bin automatically (publint's `bin` rule requires a leading shebang) -- no new publint wiring.

## Task Commits

Each task was committed atomically:

1. **Task 1: bin-static shebang + nx-free require-graph guard** - `8b17ef0` (test)
2. **Task 2: audit the published bin in the packed tarball** - `065f049` (test)

**Plan metadata:** see the docs commit that carries this SUMMARY + STATE.md + ROADMAP.md.

## Files Created/Modified

- `packages/angular-typechecker/src/cli/bin-static.spec.ts` - NEW: VER-03 dist static guard.
- `e2e/angular-typechecker-install-e2e/src/tarball-audit.e2e.spec.ts` - MODIFIED: `+ src/cli/bin.js` in `REQUIRED_FILES`, `TarballManifest.bin`, and the `CLI-01/PKG-01` describe block.

## Decisions Made

- Followed D-10 / D-11 verbatim. The only Claude's-discretion call (the walk implementation) uses `matchAll` to sidestep the `.exec`+`g`-flag `lastIndex` recursion hazard.
- Did NOT prematurely mark VER-03 / PKG-01 / CLI-01 complete in REQUIREMENTS.md: each spans 27-01 + 27-02 (+ phase verification), so requirement closure is owned by the phase verifier / milestone audit, not this plan. `requirements-completed: []` for that reason.

## Deviations from Plan

None - plan executed exactly as written. The wave-1 deferred Phase-26 typecheck defect (`main.spec.ts`) was already resolved out of band (commit `c25119b`), so `nx typecheck` is now fully green (all three tsc commands), including the drift command that type-checks `bin-static.spec.ts`.

## Verification (self-check)

Run on the MAIN checkout (sequential single-plan wave, real `node_modules`):

- `nx test angular-typechecker` (builds first via `dependsOn: ["build"]`): **GREEN** -- 43 files / 435 tests, including `src/cli/bin-static.spec.ts (2 tests)`.
- `nx typecheck angular-typechecker`: **GREEN** -- all three tsc commands (`tsconfig.spec.json`, `tsconfig.drift.json`, `tsconfig.tools.json`).
- `nx lint angular-typechecker` (maxWarnings:0): **GREEN** -- the spec's `node:*` / `vitest` / `@workspace/test-util` imports clear the `src/cli/**` nx-free ban.
- `nx e2e angular-typechecker-install-e2e`: **GREEN on Windows** -- 11 files / 40 tests, including `src/tarball-audit.e2e.spec.ts (9 tests)` (6 pre-existing + 3 new). Verdaccio's globalSetup bound cleanly this run (`local registry exit 143` is the normal SIGTERM teardown; the `consumer-*:typecheck failed` lines are the specs' own planted-error assertions, and their containing specs passed).

Note on the e2e tier: it ran green locally on Windows this session, but per PROJECT.md / AGENTS.md the heavy e2e tier is Linux-CI-authoritative (Windows-Verdaccio 127.0.0.1 bind is known-flaky). The `test`-tier `bin-static.spec.ts` is the deterministic, always-run guard; the tarball extension is CI-authoritative on Linux.

## Deferred Issues

None from this plan. (Phase-27's ADD-01 additive-only audit + `27-ADDITIVE-AUDIT.md` is plan 27-03, not this plan.)

## Next Phase Readiness

- Plan 27-03 (the last in the phase) writes `27-ADDITIVE-AUDIT.md` (ADD-01: barrel-drift green + git-diff vs `angular-typechecker@0.2.1`).
- Phase 27's requirements (CLI-01, PKG-01, PKG-02, VER-03, ADD-01) are ready for phase verification once 27-03 lands.

## Self-Check: PASSED

- `packages/angular-typechecker/src/cli/bin-static.spec.ts` exists (FOUND).
- `e2e/angular-typechecker-install-e2e/src/tarball-audit.e2e.spec.ts` extension present (FOUND).
- Task commits `8b17ef0` and `065f049` exist in git history (FOUND).
- `nx test` (incl. bin-static, 435 green), `nx typecheck` (3 tsc green), `nx lint` (maxWarnings:0 green), and `nx e2e install-e2e` (40 green, tarball-audit 9) all verified.

---
*Phase: 27-bin-shell-cross-platform-packaging*
*Completed: 2026-07-16*
