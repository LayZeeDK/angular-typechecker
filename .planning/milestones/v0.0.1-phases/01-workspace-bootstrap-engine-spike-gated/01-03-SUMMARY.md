---
phase: 01-workspace-bootstrap-engine-spike-gated
plan: 03
subsystem: core-engine
tags: [angular-compiler-cli, esm-cjs-bridge, performCompilation, all-getter, nx-executor, fixture, nodenext, gate-a, gate-b, type-shim]

# Dependency graph
requires:
  - phase: 01-02
    provides: "angular-typechecker plugin (@nx/js:tsc build, outputPath dist/packages/angular-typechecker, @nx/vitest:test); plugin tsconfig patched to module/moduleResolution:nodenext; Phase-1 D-14 package.json; apps/ng-spike-app green"
provides:
  - "Promoted tracer-bullet core engine: compiler-loader (memoized await import of @angular/compiler-cli; only runtime value-import), gather-diagnostics (unconditional 6-getter incl. getNgSemanticDiagnostics), run-typecheck (performCompilation -> structured CoreResult: codes[], errorCount, warningCount, durationMs)"
  - "Thin CJS Nx executor stub (the only @nx/devkit importer, type-only) delegating to runTypecheck -- the GATE A artifact"
  - "executors.json (one angular-typecheck entry) + schema.json/schema.d.ts (strict, one required tsConfig)"
  - "Out-of-graph deliberate-error fixture fixtures/gate-b-error/ (TS2322 + NG8109) with app + lib tsconfig variants (strictTemplates:true, noEmit:true set directly)"
  - "src/core/compiler-cli-types.ts: isolated type-only shim re-building the compiler-cli surface from deep declaration files (works around the nodenext barrel-typings collapse)"
  - "Built executor.js + compiler-loader.js at dist/packages/angular-typechecker/src/...; compiler-loader.js retains literal import('@angular/compiler-cli') with no require() downlevel"
affects: [01-04-gate-specs, phase-2-core-engine, phase-4-executor]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Memoized await import('@angular/compiler-cli') ESM bridge as the single runtime value-import; every other module uses import type (core/adapter split, zero @nx/devkit in core)"
    - "Unconditional all-getter (no &&-chain short-circuit) -> surfaces NG8xxx extended diagnostics even after a co-located TS error (the D-16 differentiator)"
    - "Build parsed config ONCE, spread into a FRESH options object per performCompilation call (no shared mutable noEmit state; resolved research Open Q1)"
    - "Out-of-graph fixture: own app + lib tsconfigs, strictTemplates set DIRECTLY (most-derived wins the angularCompilerOptions reverse-merge), nothing imports it (TS #36017)"
    - "Type-only shim isolating an upstream nodenext-typings incompatibility to ONE file (erased at emit; runtime value is the real module)"

key-files:
  created:
    - "packages/angular-typechecker/src/core/compiler-loader.ts (memoized await import; ENG-03 / GATE A runtime path)"
    - "packages/angular-typechecker/src/core/gather-diagnostics.ts (unconditional 6-getter incl. getNgSemanticDiagnostics)"
    - "packages/angular-typechecker/src/core/run-typecheck.ts (performCompilation orchestration -> CoreResult)"
    - "packages/angular-typechecker/src/core/compiler-cli-types.ts (type-only nodenext shim)"
    - "packages/angular-typechecker/src/core/compiler-loader.spec.ts, gather-diagnostics.spec.ts (unit gates)"
    - "packages/angular-typechecker/src/executors/angular-typecheck/executor.ts (thin CJS adapter; GATE A artifact)"
    - "packages/angular-typechecker/src/executors/angular-typecheck/schema.json, schema.d.ts"
    - "packages/angular-typechecker/executors.json (one entry)"
    - "fixtures/gate-b-error/error.component.ts, error.component.html, tsconfig.app.json, tsconfig.lib.json"
  modified:
    - "packages/angular-typechecker/src/index.ts (re-export core surface)"

key-decisions:
  - "Added an isolated type-only shim (compiler-cli-types.ts) re-exporting the compiler-cli surface from the package's DEEP declaration files, because the barrel index.d.ts does not type-resolve under module:nodenext (extensionless export * fails strict ESM resolution). This preserves the locked module:nodenext (GATE A emit) instead of falling back to module:commonjs + a Function-wrapped import."
  - "GATE A static target for Plan 04 is the BUILT compiler-loader.js (it holds the literal import('@angular/compiler-cli')), NOT executor.js -- the await import lives in core per the mandated core/adapter split; the executor is a thin delegate. executor.js carries the negative assertion (no require('@angular/compiler-cli'))."
  - "Angular extended diagnostic codes are encoded NEGATIVE on ts.Diagnostic.code: ngErrorCode(8109) === -998109. Plan 04 GATE B must assert on -998109 (or recover via Math.abs(code)-990000===8109 / ng.ngErrorCode(8109)), NOT the bare 8109."

patterns-established:
  - "Built executor path: dist/packages/angular-typechecker/src/executors/angular-typecheck/executor.js (derived from build.options.outputPath dist/packages/angular-typechecker, not hard-coded)"
  - "Each task committed atomically, files staged BY NAME; single-writer STATE.md/ROADMAP.md in sequential main-tree mode; no --no-verify"

requirements-completed: [ENG-03, WS-02]

# Metrics
duration: ~40min
completed: 2026-06-27
---

# Phase 01 Plan 03: Tracer-Bullet Core + Executor Stub + Error Fixture Summary

**The promoted tracer-bullet core engine is in place -- a memoized `await import('@angular/compiler-cli')` ESM bridge, an unconditional six-getter gatherer (including the `getNgSemanticDiagnostics()` that `ngc` short-circuits), and `runTypecheck` returning a structured `CoreResult` -- plus a thin CJS executor stub, its manifest, and an out-of-graph TS2322+NG8109 fixture; `nx build angular-typechecker` succeeds and the built `compiler-loader.js` retains a literal `import('@angular/compiler-cli')` with no `require()` downlevel (GATE A emit intact), proven end-to-end by `require()`-loading the built CJS executor against the fixture with no `ERR_REQUIRE_ESM`.**

## CRITICAL paths for Plan 04 (GATE A/B derivation -- do not hard-code)

- **Built executor.js (the adapter; outputPath-derived):**
  `dist/packages/angular-typechecker/src/executors/angular-typecheck/executor.js`
- **Built compiler-loader.js (the runtime path; HOLDS the literal `import(` -- GATE A static should read THIS):**
  `dist/packages/angular-typechecker/src/core/compiler-loader.js`
- **Fixture app tsconfig (absolute):**
  `D:/projects/github/LayZeeDK/angular-typechecker/fixtures/gate-b-error/tsconfig.app.json`
- **Fixture lib tsconfig (absolute):**
  `D:/projects/github/LayZeeDK/angular-typechecker/fixtures/gate-b-error/tsconfig.lib.json`
- **Spike-run Node:** v24.18.0 (in-range `^24.15.0`); compiler-cli 22.0.4 / typescript 6.0.3 / nx 23.0.1.
- **Cold-run `durationMs`:** `runTypecheck` returns it (gate item 6); the runtime smoke ran the full `performCompilation` on the fixture lib tsconfig successfully (sub-second after warm load).

## Performance

- **Duration:** ~40 min
- **Tasks:** 3 auto (Task 1 TDD; no checkpoints; autonomous: true)
- **Files:** 14 created, 1 modified (src/index.ts)

## Task Commits

1. **Task 1: Build the tracer-bullet core (compiler-loader, gather-diagnostics, run-typecheck, index)** - `b506c6b` (feat)
2. **Task 2: Build the executor stub + manifest, and the out-of-graph error fixture** - `2695652` (feat)
3. **Task 3 [blocking fix]: Resolve compiler-cli types under module:nodenext so the plugin builds** - `271e544` (fix)

**Plan metadata:** (this commit) (docs: complete plan -- SUMMARY.md + STATE.md + ROADMAP.md)

> Task 3 in the PLAN was "build the plugin + confirm the import(-bearing executor.js"; the build surfaced a genuine nodenext type-resolution blocker that had to be fixed before the build could succeed, so the `271e544` fix commit carries that work. The build + artifact verification itself is documented below under Verification.

## Engine correctness (the heart of the spike)

- **compiler-loader.ts:** `loadCompilerCli()` does `cached ??= await import('@angular/compiler-cli'); return cached;` -- the ONLY runtime value-import of compiler-cli; memoization proven by a unit spec (second call returns the same reference). The real load resolves the ESM package with no `ERR_REQUIRE_ESM` (unit spec asserts `performCompilation`/`readConfiguration`/`defaultGatherDiagnostics` are functions on the loaded module).
- **gather-diagnostics.ts:** `gatherAllDiagnostics(program)` pushes all six getters UNCONDITIONALLY in order (`getTsOptionDiagnostics`, `getNgOptionDiagnostics`, `getTsSyntacticDiagnostics`, `getTsSemanticDiagnostics`, `getNgStructuralDiagnostics`, `getNgSemanticDiagnostics`). A unit spec proves call-order and that `getNgSemanticDiagnostics()` is still called after a `getTsSemanticDiagnostics()` TS error (no short-circuit). No out-of-project/node_modules filtering (deferred, D-10).
- **run-typecheck.ts:** `runTypecheck({ tsConfigPath })` -> `await loadCompilerCli()`, `ng.readConfiguration`, times `ng.performCompilation({ rootNames, options: { ...parsed.options, noEmit: true }, emitFlags: 0 as EmitFlags, gatherDiagnostics: gatherAllDiagnostics })`, and returns `{ diagnostics, codes, errorCount (via DiagnosticCategory.Error), warningCount, durationMs }`. A FRESH `options` object is spread per call (resolved research Open Q1).
- **executor.ts:** thin CJS default-export delegating to `runTypecheck`; the only tier importing `@nx/devkit` (type-only `ExecutorContext`). `runTypecheck` returns its own promise; success = `errorCount === 0`.
- **fixtures/gate-b-error/:** standalone component, `count: number = 'not a number'` (TS2322) + `status = signal('ready')` interpolated `{{ status }}` (NG8109). App + lib tsconfig variants set `angularCompilerOptions.strictTemplates: true` + `compilerOptions.noEmit: true` directly. Out of the project graph (no project.json; excluded in tsconfig.lib.json; nothing imports it). `nx show projects` lists only `[angular-typechecker, ng-spike-app]`; `nx build ng-spike-app` stays green.

## Engine validation evidence (de-risks GATE B; full assertions are Plan 04)

Ran the real `@angular/compiler-cli@22.0.4` all-getter and `defaultGatherDiagnostics` against BOTH fixture tsconfig variants (throwaway probe; not committed):

| tsconfig | all-getter codes | default (ngc) codes |
|----------|------------------|---------------------|
| tsconfig.app.json | `[2322, -998109, -998117]` | `[2322]` |
| tsconfig.lib.json | `[2322, -998109, -998117]` | `[2322]` |

- **GATE B positive:** the all-getter surfaces TS2322 AND the NG8109 extended diagnostic (encoded `-998109`) AND NG8117 (`-998117`); no code 500 (`UNKNOWN_ERROR_CODE`).
- **GATE B differential:** `defaultGatherDiagnostics` (ngc) surfaces only `[2322]` -- the NG8109 extended diagnostic is short-circuited away, exactly the behavior the all-getter overcomes (D-16).
- **D-18 re-validation:** NG8109 (`ErrorCode.INTERPOLATED_SIGNAL_NOT_INVOKED === 8109`) fires on STABLE Angular 22.0.4.
- **Encoding finding (gate-relevant):** Angular extended codes are stored NEGATIVE on `ts.Diagnostic.code`: `ng.ngErrorCode(8109) === -998109`, recover via `Math.abs(code) - 990000`. Plan 04 GATE B must assert on `-998109` (or the recovery), NOT the bare `8109`.

## Verification

- `npx nx test angular-typechecker` -> 2 files, 4 tests, all pass (Vitest; WS-03).
- `npx nx build angular-typechecker` -> succeeds (CJS `.js` + `.d.ts` via `@nx/js:tsc`); `executors.json` + `schema.json` copied into the output (asset globs).
- **GATE A static (built artifacts, comment-stripped):**
  - `compiler-loader.js` contains literal `import('@angular/compiler-cli')` (NOT downleveled) and does NOT contain `require('@angular/compiler-cli')`.
  - `executor.js` does NOT contain `require('@angular/compiler-cli')` (and, by the core/adapter split, does not itself contain `import(` -- the load is in `compiler-loader.js`).
  - `run-typecheck.js` retains literal `import('typescript')` too.
- **GATE A runtime (end-to-end):** `require()`-loading the built CJS `executor.js` (as Nx's loader does) and invoking it against `fixtures/gate-b-error/tsconfig.lib.json` ran to completion with NO `ERR_REQUIRE_ESM`, returning `{ success: false }` (correct -- the fixture's TS2322 makes `errorCount > 0`).
- `apps/ng-spike-app` still builds green (T-01-08 backstop: the fixture did not leak into the graph).

## Threat model dispositions

- **T-01-06 (import() downleveled to require()):** MITIGATED. Built `compiler-loader.js` retains literal `import('@angular/compiler-cli')`; no `require('@angular/compiler-cli')` anywhere in the built core/executor. The `module:nodenext` emit held even through the Task 3 type-shim fix.
- **T-01-07 (ESM-load failure masquerades as a diagnostic, code 500):** MITIGATED for now. The all-getter probe returned no code 500; the runtime smoke did not reject. Plan 04 GATE B keeps the explicit `not.toContain(500)` assertion.
- **T-01-08 (stray import of the fixture re-introduces errors into ng-spike-app):** MITIGATED. Fixture is out of graph, excluded in tsconfig.lib.json, imported by nothing; `nx build ng-spike-app` green.
- **T-01-09 (executor input validation absent):** ACCEPTED (Phase 1) -- single `tsConfig` path normalized by `readConfiguration`; full schema validation deferred to Phase 4 (EXE-01).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @angular/compiler-cli@22.0.4 barrel typings do not resolve under module:nodenext**
- **Found during:** Task 3 (`nx build angular-typechecker`).
- **Issue:** Under `module:nodenext` TypeScript treats `@angular/compiler-cli`'s published `index.d.ts` as ESM; that barrel re-exports its members with EXTENSIONLESS relative paths (`export * from './src/transformers/api'`), which strict nodenext ESM resolution refuses to resolve (`tsc --traceResolution`: "Module './src/transformers/api' was not resolved" -- it only looks for a directory, never the sibling `api.d.ts`). The `@angular/compiler-cli` namespace therefore resolved EMPTY -> build errors TS2305 (`no exported member 'Program'`), TS2339 (`readConfiguration`/`performCompilation` do not exist), TS2503 (`namespace 'ng'`). The Vitest run had not caught it because Vite/esbuild does not full-type-check. (LSP diagnostics were not the signal -- the `@nx/js:tsc` build is the authoritative gate per CLAUDE.md.)
- **Fix:** Added `src/core/compiler-cli-types.ts`, a single type-only module that re-builds the consumed surface (`Program`, `EmitFlags`, `ParsedConfiguration`, and the `typeof` of `performCompilation`/`readConfiguration`/`defaultGatherDiagnostics`) from the package's DEEP declaration files (`src/transformers/api`, `src/perform_compile`), which DO resolve under nodenext. The loader returns the structural `CompilerCli` namespace; the runtime value is the real, fully-featured module. Rewired the three core files to import types from the shim. This PRESERVES the locked `module:nodenext` (GATE A emit) rather than retreating to `module:commonjs` + a `Function`-wrapped import (the rejected @angular/build workaround).
- **Files modified:** `src/core/compiler-cli-types.ts` (new), `compiler-loader.ts`, `gather-diagnostics.ts`, `run-typecheck.ts`.
- **Commit:** `271e544`.
- **Caveat (flagged):** the shim re-exports via a deep relative path into `node_modules/@angular/compiler-cli/...` -- fragile if hoisting changes the layout, and coupled to the package's internal `.d.ts` structure. It is type-only (erased at emit). Revisit when `@angular/compiler-cli` ships nodenext-clean typings (Angular's own `@angular/build` consumes these types under `module:commonjs`/`moduleResolution:node`, so the upstream barrel is simply not nodenext-tested).

**2. [Plan/architecture tension -- recorded, not a code change] GATE A static target is compiler-loader.js, not executor.js**
- The PLAN Task 3 verify/acceptance asserts the literal `import(` lives in the built `executor.js`. By the mandated core/adapter split (D-08; the executor must be a THIN delegate, the `await import()` belongs in core), the literal `import(` actually lives in the built `compiler-loader.js`; `executor.js` is a thin `require()`-based delegate. The threat-model intent (T-01-06: the built OUTPUT retains literal `import(` and never `require('@angular/compiler-cli')`) is fully satisfied. Plan 04's GATE A static spec must point at `compiler-loader.js` for the positive `import(` assertion and keep the negative `not require('@angular/compiler-cli')` assertion on both. No code changed for this; it is a derivation note for Plan 04.

**Total deviations:** 1 auto-fixed blocking issue (nodenext typings) + 1 recorded plan/architecture derivation note. No scope creep; no new capabilities; locked decisions (D-08/D-13/D-16/D-18, module:nodenext) all intact.

## Known Stubs

None. The core is the promoted tracer bullet (D-08), fully wired to the real compiler-cli; the executor stub is intentionally minimal (full normalize-options/schema validation deferred to Phase 4, EXE-01) but is functionally complete for the spike (delegates to the real `runTypecheck`).

## Self-Check: PASSED

- Files verified present: compiler-loader.ts, gather-diagnostics.ts, run-typecheck.ts, compiler-cli-types.ts, index.ts, executor.ts, schema.json, schema.d.ts, executors.json, fixtures/gate-b-error/{error.component.ts, error.component.html, tsconfig.app.json, tsconfig.lib.json}, built dist/.../executor.js + compiler-loader.js.
- Commits verified present: `b506c6b`, `2695652`, `271e544`.
- Functional gates: 4/4 Vitest tests pass; `nx build angular-typechecker` succeeds; built `compiler-loader.js` retains literal `import('@angular/compiler-cli')` with no `require()` downlevel; built CJS executor runs against the fixture with no `ERR_REQUIRE_ESM`; fixture out of graph; `ng-spike-app` green.

---
*Phase: 01-workspace-bootstrap-engine-spike-gated*
*Completed: 2026-06-27*
