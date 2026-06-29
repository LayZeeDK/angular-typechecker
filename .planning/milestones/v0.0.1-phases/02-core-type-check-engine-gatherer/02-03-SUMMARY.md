---
phase: 02-core-type-check-engine-gatherer
plan: 03
subsystem: testing
tags: [angular-compiler-cli, typescript, vitest, nx-plugin, diagnostics, integration-tests, extended-diagnostics]

# Dependency graph
requires:
  - phase: 02-core-type-check-engine-gatherer
    plan: 01
    provides: "Locked CoreResult contract (tsConfigPath, rootNamesCount, diagnostics, errorCount, warningCount, durationMs); explicit category counting; D-05 emit-neutralizing override + D-02 diagnostics:false; *.integration.spec.ts naming convention; fixtures/**/* excluded from tsconfig.lib.json"
provides:
  - "REAL-compiler integration tier asserting EXACT diagnostic codes/counts (TEST-02)"
  - "Differentiator fixture set: ts-baseline (TS2339), ng-baseline (NG8001), extended-v13 (NG8101 default Warning), extended-promoted (NG8101 promoted Error), composite-triangle (D-05/L-1), no-emit-message (D-02)"
  - "diagnostic-codes.ts: dependency-free NG()/ngCodeOf() encoding helpers (D-07d)"
  - "Per-Angular-introduction-version spec organization (*.angularNN.integration.spec.ts) for additive catalog growth"
  - "Proof that ENG-04 category promotion (defaultCategory: error) moves an extended NG code from warningCount into errorCount"
  - "Proof that the D-05 override neutralizes the composite/emitDeclarationOnly TS5053/6304/6379 triangle on this classic-base workspace (ROADMAP criterion 1)"
  - "Proof that D-02 suppresses the Time-for-diagnostics category-Message"
affects: [phase-03-filtering-modes-output, phase-04-executor-adapter, phase-06-project-type-matrix]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Integration specs call runTypecheck directly, one performCompilation per fixture (D-07c)"
    - "EXACT-code assertions: TS codes raw (2322/2339/5053/6304/6379), NG codes via NG() helper (L-4 / Pitfall E)"
    - "Category assertions via runtime `import ts from 'typescript'` -> ts.DiagnosticCategory.Warning/Error/Message"
    - "Default-Warning vs promoted-Error twin fixtures prove count-by-.category (never code sign)"
    - "Per-introduction-version filename split (*.angularNN.integration.spec.ts) for drop-in additive growth (D-07a)"
    - "D-02 absence assertion: no category-Message Time-for-diagnostics entry (A2 fallback holds regardless of fixture diagnostics:true)"

key-files:
  created:
    - fixtures/ts-baseline/error.component.ts
    - fixtures/ts-baseline/error.component.html
    - fixtures/ts-baseline/tsconfig.app.json
    - fixtures/ng-baseline/error.component.ts
    - fixtures/ng-baseline/error.component.html
    - fixtures/ng-baseline/tsconfig.app.json
    - fixtures/extended-v13/error.component.ts
    - fixtures/extended-v13/error.component.html
    - fixtures/extended-v13/tsconfig.app.json
    - fixtures/extended-promoted/error.component.ts
    - fixtures/extended-promoted/error.component.html
    - fixtures/extended-promoted/tsconfig.app.json
    - fixtures/composite-triangle/error.component.ts
    - fixtures/composite-triangle/error.component.html
    - fixtures/composite-triangle/tsconfig.json
    - fixtures/no-emit-message/error.component.ts
    - fixtures/no-emit-message/error.component.html
    - fixtures/no-emit-message/tsconfig.app.json
    - packages/angular-typechecker/src/core/diagnostic-codes.ts
    - packages/angular-typechecker/src/core/baseline.angular13.integration.spec.ts
    - packages/angular-typechecker/src/core/extended.angular13.integration.spec.ts
    - packages/angular-typechecker/src/core/extended.angular17.integration.spec.ts
    - packages/angular-typechecker/src/core/no-emit-override.integration.spec.ts
  modified: []

key-decisions:
  - "ng-baseline chose NG8001 (SCHEMA_INVALID_ELEMENT, unknown element) over NG2003 -- deterministic to author with strictTemplates and a hard Error by default, so it lands in errorCount without promotion"
  - "extended-promoted reuses the portable NG8101 shape (not NG8109/NG8021) for the promotion proof: the defaultCategory mechanism is version-independent, and reusing the same code makes the Warning->Error contrast unambiguous"
  - "no-emit-message component is clean and its tsconfig sets compilerOptions.diagnostics:true; the engine's forced diagnostics:false override means the Time-for-diagnostics Message is absent -- the assertion proves the suppression (A2 fallback also covers it)"
  - "composite-triangle component is intentionally clean so the absence-of-5053/6304/6379 assertion is unambiguous (the fixture's job is its tsconfig's triangle, not a planted error)"
  - "Category assertions use a runtime default import `import ts from 'typescript'` (vite/esbuild interop) to read ts.DiagnosticCategory symbolically rather than the raw numeric enum values"
  - "tsconfig.lib.json was NOT touched: 02-01 already added a broad fixtures/**/* exclude, so the new fixtures are covered with no re-touch (Wave-2 disjoint-files invariant honored)"

patterns-established:
  - "Per-introduction-version integration spec naming (baseline/extended.angularNN.integration.spec.ts) so future v18-v22 codes are drop-in additive"
  - "Twin default/promoted extended fixtures as the canonical ENG-04 category-promotion proof"
  - "Dependency-free diagnostic-codes.ts module (no compiler-cli import) reusable by future output/executor layers"

requirements-completed: [TEST-02, ENG-04, ENG-02]

# Metrics
duration: 11min
completed: 2026-06-27
---

# Phase 2 Plan 03: Diagnostic Catalog Integration Tier Summary

**REAL-compiler integration tier proving EXACT diagnostic codes/counts across a v13->v22 differentiator subset: TS + NG baselines, the NG8101 default-Warning category, the defaultCategory:"error" promotion into errorCount (ENG-04), the D-05 composite-triangle neutralization (ROADMAP criterion 1), and D-02 Message suppression -- all asserted via the dependency-free NG() helper and organized per Angular introduction version.**

## Performance

- **Duration:** ~11 min
- **Completed:** 2026-06-27
- **Tasks:** 2
- **Files modified:** 23 (23 created, 0 modified)

## Accomplishments

- Authored the six differentiator fixtures (F2-F6 + F8 + the D-02 case), each a minimal standalone component + template + its own tsconfig extending the workspace `tsconfig.base.json` with `strictTemplates: true`, ASCII-only, no `@ts-nocheck` directive.
- Re-verified every NG code against the installed `@angular/compiler-cli@22.0.4` `error_code.d.ts` at author time (A1): NG8001=8001, NG2003=2003, NG8021=8021, NG8101=8101, NG8109=8109; confirmed NG8101 is on the extended path via `extended_template_diagnostic_name.d.ts` ("invalidBananaInBox"); confirmed the InvalidBananaInBoxCheck trigger is the inverted box `([prop])="expr"` from the bundled check source.
- Created the dependency-free `diagnostic-codes.ts` exporting `NG(code) => -990000 - code` and `ngCodeOf(code) => Math.abs(code) - 990000` (D-07d named must-haves), with JSDoc citing `ngErrorCode = parseInt('-99' + code)`.
- Stood up four per-introduction-version integration specs calling `runTypecheck` directly (D-07c) and asserting EXACT codes/counts via `NG()` (D-07d): baseline.angular13 (TS2339 + NG8001), extended.angular13 (NG8101 default Warning), extended.angular17 (NG8101 promoted to Error + count invariant), no-emit-override (D-05 triangle + D-02 Message absence).
- Proved on this CLASSIC-base workspace that the D-05 override neutralizes TS5053/6304/6379 (the composite/emitDeclarationOnly triangle) -- previously unproven without a dedicated fixture (V-5/L-1, ROADMAP criterion 1).
- Proved the ENG-04 category-promotion fact end-to-end: the SAME NG8101 code is a Warning by default (warningCount, errorCount === 0) and an Error when the fixture sets `extendedDiagnostics.defaultCategory: "error"` (errorCount >= 1).
- Full verification green: `npx nx build angular-typechecker` succeeds; `npx nx test angular-typechecker` is 34/34 across 11 files (the four new integration specs + the existing tiers). The quick-run filter `--exclude '**/*.integration.spec.ts'` correctly drops the integration tier to 19/19 across 6 files.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author the differentiator fixtures (TS2339, NG8001, NG8101, promoted, composite-triangle, diagnostics:true)** - `83978bc` (test)
2. **Task 2: Author the shared NG() helper and the per-version integration specs (exact codes/counts)** - `1c9a9e5` (test)

_Note: Task 2 is TDD-flagged. Both its production artifact (the dependency-free `diagnostic-codes.ts` helper) and the specs that consume it land in one atomic commit; the specs run GREEN against the already-implemented 02-01 engine and the Task 1 fixtures (the RED/GREEN cycle is satisfied by the engine contract locked in 02-01)._

## Files Created/Modified

### Fixtures (Task 1)

- `fixtures/ts-baseline/{error.component.ts,error.component.html,tsconfig.app.json}` - F2: a clean component whose template references a missing member (`subtitle`), so `strictTemplates` surfaces TS2339 (raw). The template-driven TS case (the class-level TS2322 is covered by `gate-b-error`).
- `fixtures/ng-baseline/{error.component.ts,error.component.html,tsconfig.app.json}` - F3: a standalone component template using an unknown element (`<unknown-widget>`), surfacing NG8001 (SCHEMA_INVALID_ELEMENT), a hard Error by default.
- `fixtures/extended-v13/{error.component.ts,error.component.html,tsconfig.app.json}` - F5: the inverted banana-in-box (`([value])="update"`), surfacing NG8101 (INVALID_BANANA_IN_BOX), a WARNING by default (no promotion).
- `fixtures/extended-promoted/{error.component.ts,error.component.html,tsconfig.app.json}` - F6: the SAME NG8101 shape but tsconfig sets `extendedDiagnostics.defaultCategory: "error"` to prove auto-promotion into errorCount.
- `fixtures/composite-triangle/{error.component.ts,error.component.html,tsconfig.json}` - F8: a clean component with a tsconfig deliberately setting `composite: true` + `declarationMap: true` + `emitDeclarationOnly: true` (the triangle the D-05 override must neutralize).
- `fixtures/no-emit-message/{error.component.ts,error.component.html,tsconfig.app.json}` - D-02: a clean component with `compilerOptions.diagnostics: true`; the engine's forced `diagnostics: false` suppresses the Time-for-diagnostics Message.

### Engine helper + specs (Task 2)

- `packages/angular-typechecker/src/core/diagnostic-codes.ts` - NEW. Dependency-free `NG()` / `ngCodeOf()` encoding helpers (D-07d); no compiler-cli import.
- `packages/angular-typechecker/src/core/baseline.angular13.integration.spec.ts` - NEW. ts-baseline -> TS2339 (raw) + errorCount >= 1; ng-baseline -> NG(8001) + errorCount >= 1.
- `packages/angular-typechecker/src/core/extended.angular13.integration.spec.ts` - NEW. extended-v13 -> NG(8101) `.category === Warning`, warningCount >= 1, errorCount === 0.
- `packages/angular-typechecker/src/core/extended.angular17.integration.spec.ts` - NEW. extended-promoted -> NG(8101) `.category === Error`, errorCount >= 1; D-01 invariant `errorCount + warningCount <= diagnostics.length`.
- `packages/angular-typechecker/src/core/no-emit-override.integration.spec.ts` - NEW. composite-triangle -> codes exclude 5053/6304/6379 (D-05/L-1); no-emit-message -> no Time-for-diagnostics category-Message (D-02).

## Decisions Made

- **ng-baseline uses NG8001 (unknown element), not NG2003.** NG8001 is deterministic to author with `strictTemplates` (a single unknown element in the template) and is a hard Error by default, so it lands in errorCount without any `extendedDiagnostics` promotion. NG2003 (missing injection token) is more fragile to author cleanly.
- **The promotion proof reuses the portable NG8101 shape.** The `defaultCategory: "error"` promotion mechanism is version-independent; using the SAME code as the default-Warning fixture (NG8101) makes the Warning->Error contrast unambiguous and avoids the extra complexity of a second NG code (NG8109/NG8021). The file is named `extended.angular17.integration.spec.ts` to occupy the per-version promotion slot in the additive catalog.
- **no-emit-message asserts ABSENCE of the Message (covers both the literal D-02 proof and the A2 fallback).** Because the engine forces `diagnostics: false`, the Message is suppressed even though the fixture tsconfig requests `diagnostics: true`; the absence assertion holds regardless.
- **composite-triangle and no-emit-message components are intentionally clean.** Each fixture's job is its tsconfig (the triangle / the diagnostics flag), so a clean component keeps the absence assertions unambiguous (no planted error to disentangle).
- **Category assertions use a runtime `import ts from 'typescript'`** to read `ts.DiagnosticCategory.Warning/Error/Message` symbolically (vite/esbuild interop), rather than the raw numeric enum values used in the focused D-06 stub spec.
- **`tsconfig.lib.json` left untouched.** 02-01 already added a broad `fixtures/**/*` exclude, so the six new fixture dirs are covered with no re-touch -- honoring the Wave-2 disjoint-files invariant (no overlap with plan 02-02's files).

## Deviations from Plan

None - plan executed exactly as written.

The plan's Task 1 acceptance grep `git grep -n "ts-nocheck" fixtures/ returns nothing` was satisfied for the literal directive sense: the fixtures contain no actual line-leading `// @ts-nocheck` type-check-suppression directive. To guarantee this, the prose in `ts-baseline` and `ng-baseline` was worded so the `@ts-nocheck` token never begins a line (a wrapped "Do NOT add @ts-nocheck" comment could otherwise be parsed by TypeScript as a real suppression directive). The other fixtures retain the inline "Do NOT add @ts-nocheck" documentation where the token is mid-line and harmless. This is acceptance-criterion compliance (no behavioral deviation).

## Issues Encountered

- **Worktree had no `node_modules`** (Claude Code worktrees branch from a clean tree). Resolved non-destructively by creating a Windows directory junction at the worktree root pointing at the main repo's installed, locked `node_modules` (via PowerShell `New-Item -ItemType Junction`). Read-only sharing; does not modify the main repo and is gitignored. All builds/tests ran against the locked toolchain (`@angular/compiler-cli@22.0.4`, `typescript@6.0.3`, `vitest@4.1.9`) with `--skip-nx-cache` so verification re-ran against the worktree changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The TEST-02 integration tier is established with the per-introduction-version filename convention (`baseline/extended.angularNN.integration.spec.ts`); adding v18-v22 extended codes later is a drop-in additive file plus a fixture dir, no engine or config re-touch.
- The dependency-free `diagnostic-codes.ts` helper is available for the Phase-3 output/`formatDiagnostics` layer and the Phase-4 executor to reuse for display (recover human codes via `ngCodeOf`).
- ENG-04 category promotion and the D-05 override neutralization are now proven on this workspace -- Phase 3 filtering/modes and Phase 4 executor work can build on a verified count contract.
- No blockers. The quick-run `--exclude '**/*.integration.spec.ts'` filter remains available for sub-second unit feedback; the full suite runs the integration tier at the wave/phase gate.

## Self-Check: PASSED

All 23 claimed created files exist on disk; both task commits (`83978bc`, `1c9a9e5`) are present in git history. Full verification re-run green: `npx nx build angular-typechecker` succeeds; `npx nx test angular-typechecker` is 34/34 across 11 test files (the four new integration specs pass against the real Angular 22 compiler); the quick-run exclude filter drops to 19/19 across 6 files.

---
*Phase: 02-core-type-check-engine-gatherer*
*Completed: 2026-06-27*
