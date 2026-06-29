---
phase: 02-core-type-check-engine-gatherer
plan: 02
subsystem: testing
tags: [angular-compiler-cli, typescript, vitest, fixtures, config-resolution, fail-loud, integration-test]

# Dependency graph
requires:
  - phase: 02-core-type-check-engine-gatherer
    plan: 01
    provides: "Locked CoreResult contract (tsConfigPath/rootNamesCount/diagnostics/errorCount/warningCount/durationMs); config-error prepend (D-03); zero-rootNames guard synthesizing one Error (code 90001, D-03/D-03a); tsconfig.lib.json fixtures/**/* exclude"
provides:
  - "config-broken fixtures: a tsconfig.spec.json pointing at a planted spec-file TS2322 (EXE-02 differentiator) + a tsconfig.malformed.json (extends a nonexistent file -> config error)"
  - "solution-style fixture: references-only tsconfig.json (files:[], references:[...]) + leaf tsconfig.app.json + component (D-03/D-03a silent-lie input)"
  - "config-resolution.integration.spec.ts: REAL-compiler proof that a spec tsconfig is checked, a malformed config is never silently clean and never thrown, and a solution-style config returns rootNamesCount 0 + errorCount 1 with a leaf-tsconfig-naming message"
affects: [02-03-diagnostic-catalog, phase-03-filtering-modes-output, phase-04-executor-adapter]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fixture-only Wave-2 slice: new committed fixtures under workspace-root fixtures/ (out of the project graph, covered by the existing tsconfig.lib.json fixtures/**/* exclude); no engine or shared-config re-touch"
    - "REAL-compiler config-resolution assertions via direct runTypecheck (D-07c); messageText string-coerced through ts.flattenDiagnosticMessageText for the leaf-tsconfig regex"
    - "Malformed-config fixture via extends-a-nonexistent-file (yields a returned TS5012 config error, not a JSON parse failure of the committed file)"

key-files:
  created:
    - fixtures/config-broken/error.component.ts
    - fixtures/config-broken/error.component.html
    - fixtures/config-broken/error.component.spec.ts
    - fixtures/config-broken/tsconfig.spec.json
    - fixtures/config-broken/tsconfig.malformed.json
    - fixtures/solution-style/tsconfig.json
    - fixtures/solution-style/tsconfig.app.json
    - fixtures/solution-style/error.component.ts
    - packages/angular-typechecker/src/core/config-resolution.integration.spec.ts
  modified: []

key-decisions:
  - "Malformed-config fixture uses extends a nonexistent path (tsconfig.does-not-exist.json) rather than invalid JSON: ng.readConfiguration returns it as a TS5012 config error in parsed.errors (prepended, D-03) so the committed file itself stays valid and the assertion targets the restored config-error message"
  - "Spec fixture plants its OWN TS2322 in error.component.spec.ts (distinct from the component's TS2322) so the spec source being checked is provable; the spec file avoids Jasmine/Vitest globals (exports a plain function) to carry EXACTLY one planted error with no incidental TS2304 noise"
  - "Solution-style assertions are EXACT (rootNamesCount === 0 AND errorCount === 1) and additionally assert the guard does NOT depend on TS18003 (D-03a / L-2: references suppress TS18003)"
  - "config-resolution.integration.spec.ts named *.integration.spec.ts so the quick-run `--exclude '**/*.integration.spec.ts'` skips it (verified: full 8 files/32 tests vs quick 6 files/19 tests)"

patterns-established:
  - "messageTextOf(diagnostic) helper = ts.flattenDiagnosticMessageText(d.messageText, '\\n') for asserting on diagnostic prose (config-error file name + the synthesized leaf-tsconfig guard message)"
  - "Malformed-config detection in tests by message substring (the unresolvable extends target file name), not by code, since the config-error code is the TS file-read code"

requirements-completed: [EXE-02, ENG-01]

# Metrics
duration: 9min
completed: 2026-06-27
---

# Phase 2 Plan 02: Config Resolution Slice Summary

**The fail-loud config-resolution slice proven end-to-end: committed spec / malformed / solution-style fixtures plus a REAL-compiler integration spec that proves a tsconfig.spec.json is type-checked (EXE-02), a malformed config is never silently clean and never thrown (D-03/MD-01), and a references-only solution-style config returns the deterministic rootNamesCount 0 + errorCount 1 guard with a leaf-tsconfig-naming message (D-03/D-03a).**

## Performance

- **Duration:** ~9 min
- **Completed:** 2026-06-27
- **Tasks:** 2
- **Files modified:** 9 (9 created, 0 modified)

## Accomplishments

- Authored the three config-resolution fixture inputs (8 files) that exercise the "type-checker that LIES via config" threat surface end-to-end against the engine locked by 02-01:
  - `fixtures/config-broken/`: a `tsconfig.spec.json` pointing at `error.component.spec.ts` (which carries its OWN planted TS2322), plus a `tsconfig.malformed.json` that `extends` a nonexistent file.
  - `fixtures/solution-style/`: a references-only `tsconfig.json` (`files:[]`, `references:[...]`), a leaf `tsconfig.app.json`, and a minimal valid leaf component.
- Stood up `config-resolution.integration.spec.ts` (5 tests, REAL compiler, direct `runTypecheck` per D-07c) proving:
  - EXE-02: the spec tsconfig reports the planted spec-file TS2322 with `rootNamesCount > 0` (specs are type-checked, not just built -- the named differentiator vs a build check).
  - D-03/MD-01: the malformed tsconfig returns `errorCount >= 1` with the prepended config error present (it names the unresolvable `extends` target), and `runTypecheck` resolves rather than throwing.
  - D-03/D-03a: the solution-style tsconfig returns EXACTLY `rootNamesCount === 0` AND `errorCount === 1`, the synthesized Error's message matches `/tsconfig\.(app|lib|spec)\.json/`, and the guard does NOT depend on TS18003 (references suppress it -- L-2).
- Confirmed the engine behavior via a throwaway probe against the built dist before writing assertions (spec -> errorCount 2 incl. TS2322; malformed -> errorCount 2 incl. TS5012 config error, no throw; solution -> rootNamesCount 0 / errorCount 1 / code 90001 guard).
- Verified the slice is fixture-only and additive: `npx nx build angular-typechecker` still succeeds (new fixture `.ts` excluded from the lib build by the existing `fixtures/**/*` exclude); no engine, shim, or `tsconfig.lib.json` re-touch.
- Full verification green: `npx nx build angular-typechecker` succeeds; `npx nx test angular-typechecker` is 32/32 across 8 files (was 27/27 across 7 before this slice; +5 tests, +1 file). Quick-run `--exclude '**/*.integration.spec.ts'` correctly skips the integration tier (6 files/19 tests).

## Task Commits

Each task was committed atomically:

1. **Task 1: Author the config-resolution fixtures (spec, malformed, solution-style)** - `8f4932b` (test)
2. **Task 2: Author config-resolution.integration.spec.ts (D-03 + EXE-02 proofs)** - `07af39e` (test)

_Note: Task 2 is TDD-flagged. Here the test lands against the engine contract already implemented in 02-01 (the D-03 prepend + zero-rootNames guard); the new fixtures + assertions prove that contract fires across the real silent-lie inputs. Both commits use the `test` type because both deliver test infrastructure (committed fixtures + the integration spec); no engine source changed in this slice._

## Files Created/Modified

- `fixtures/config-broken/error.component.ts` - Broken standalone component (deliberate TS2322 + NG8109 template) mirroring the gate-b-error shape; the spec source imports it.
- `fixtures/config-broken/error.component.html` - `{{ status }}` template (un-invoked signal -> NG8109/NG8117).
- `fixtures/config-broken/error.component.spec.ts` - The EXE-02 differentiator: a `*.spec.ts` with its OWN planted TS2322 (a `string` assigned to a `number`), exported as a plain function (no Jasmine/Vitest globals) so it carries exactly the one planted error.
- `fixtures/config-broken/tsconfig.spec.json` - Spec tsconfig (`files: ["error.component.spec.ts"]`, `strictTemplates: true`) modeled on the gate-b-error app variant; proves specs are type-checked.
- `fixtures/config-broken/tsconfig.malformed.json` - `extends: "./tsconfig.does-not-exist.json"`; `ng.readConfiguration` returns the unresolvable extends as a TS5012 config error (prepended per D-03), never a silent clean.
- `fixtures/solution-style/tsconfig.json` - The silent-lie input: `{ files:[], references:[{ path: "./tsconfig.app.json" }] }`; produces zero rootNames AND suppresses TS18003.
- `fixtures/solution-style/tsconfig.app.json` - The leaf tsconfig the references target resolves to (the leaf the guard message steers toward).
- `fixtures/solution-style/error.component.ts` - Minimal valid standalone component (the references leaf source); valid by design -- the regression proof is that the SOLUTION config yields zero rootNames regardless.
- `packages/angular-typechecker/src/core/config-resolution.integration.spec.ts` - NEW. REAL-compiler proof of the three fail-loud config behaviors (EXE-02, D-03/MD-01, D-03/D-03a) via direct `runTypecheck` against the committed fixtures.

## Decisions Made

- **Malformed-config fixture via `extends` a nonexistent path** (not invalid JSON) - keeps the committed `tsconfig.malformed.json` itself a valid, parseable file while still producing a returned config error (TS5012 "Cannot read file ...tsconfig.does-not-exist.json") from `ng.readConfiguration`. The test asserts on the config-error message substring (the unresolvable file name) rather than a code, since the config-error code is the TS file-read code, not a fixed sentinel.
- **The spec fixture plants its OWN TS2322** distinct from the component's TS2322, and the spec file exports a plain function instead of using `describe`/`it`/`expect` - this gives the spec source exactly one planted error with no incidental TS2304 "cannot find name" noise, so its presence in the diagnostics unambiguously proves the `*.spec.ts` was type-checked.
- **Solution-style assertions are EXACT and add a TS18003-independence check** - `rootNamesCount === 0` AND `errorCount === 1` AND `messageText` matches `/tsconfig\.(app|lib|spec)\.json/`, PLUS an explicit `codes` does-not-contain `18003` (D-03a / L-2: TypeScript suppresses TS18003 when a config has `references`, so the guard must gate on empty rootNames, never on TS18003).
- **`*.integration.spec.ts` naming** keeps the new spec in the REAL-compiler tier that the quick-run `--exclude '**/*.integration.spec.ts'` skips (verified by the differential file/test counts).

## Deviations from Plan

None - plan executed exactly as written.

The two `ts-nocheck` matches reported by the broad acceptance grep (`git grep "ts-nocheck" fixtures/config-broken fixtures/solution-style`) are prose-only ("Do NOT add @ts-nocheck") inside fixture comments, mirroring the existing `gate-b-error/error.component.ts` convention; a tightened grep for an actual `// @ts-nocheck` pragma (`^\s*//\s*@ts-nocheck\s*$`) returns nothing. This is acceptance-criterion compliance (no functional `@ts-nocheck`), not a deviation.

## Issues Encountered

- **Worktree had no `node_modules`** (Claude Code worktrees branch from a clean tree). Resolved non-destructively, identical to 02-01, by creating a Windows directory junction at the worktree root pointing at the main repo's already-installed, locked `node_modules` (`mklink /J node_modules <main-repo>\node_modules`). This is read-only sharing; it does not modify the main repo and is gitignored (absent from `git status`). All builds/tests ran against the locked toolchain (`@angular/compiler-cli@22.0.4`, `typescript@6.0.3`, `vitest@4.1.9`). Verification runs used `--skip-nx-cache` so the build/test re-ran against the worktree's changes rather than the shared cache.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The fail-loud config-resolution slice is proven end-to-end against the real compiler; the three silent-lie inputs (spec/malformed/solution-style) now have committed fixtures + assertions. The D-03 guard, the config-error prepend, and the EXE-02 spec-checking differentiator are regression-locked.
- This slice touched ONLY new fixtures + one new spec (no engine, shim, or `tsconfig.lib.json` edits), so it composes cleanly with the parallel Wave-2 slice 02-03 (diagnostic catalog) which adds its own disjoint fixture dirs and spec.
- No blockers. The `*.integration.spec.ts` quick-run/full-run split continues to work; Phase 3 (filtering/modes/output) and Phase 4 (executor adapter) consume the same `CoreResult` and the now-proven fail-loud config behavior.

## Self-Check: PASSED

All 9 claimed created files exist on disk; both task commits (`8f4932b`, `07af39e`) are present in git history. Full verification re-run green: `npx nx build angular-typechecker` succeeds; `npx nx test angular-typechecker` is 32/32 across 8 test files; the quick-run `--exclude '**/*.integration.spec.ts'` is 19/19 across 6 files (the integration tier is skipped as designed).

---
*Phase: 02-core-type-check-engine-gatherer*
*Completed: 2026-06-27*
