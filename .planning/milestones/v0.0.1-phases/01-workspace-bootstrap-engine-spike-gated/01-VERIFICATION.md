---
phase: 01-workspace-bootstrap-engine-spike-gated
verified: 2026-06-27T18:45:00Z
status: passed
score: 4/4 success criteria verified; 6/6 go/no-go items GO; 6/6 Phase-1 requirements satisfied
overrides_applied: 0
mode_note: >-
  ROADMAP declares mode: mvp, but the phase goal is an engineering-deliverable
  statement (a GATED spike GO/NO-GO), NOT a "As a ... I want ... so that ..."
  User Story. There are no user-facing flows to trace. Verified goal-backward
  against the four explicit Success Criteria + the six-item go/no-go checklist
  (the documented Phase-1 contract) rather than refusing under the MVP User
  Story guard. The User Flow Coverage table is N/A for a spike phase.
---

# Phase 1: Workspace Bootstrap + Engine Spike (GATED) Verification Report

**Phase Goal:** A working Nx 23 integrated Angular monorepo hosting the plugin package, with a thrown-away-or-promoted spike that PROVES the highest-risk unknowns against a real Angular 22 workspace before the engine is built for real.
**Verified:** 2026-06-27T18:45:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

This is a GATED spike phase. The central deliverable is a defensible GO/NO-GO
decision on the six-item checklist (CONTEXT.md), backed by automated, committed,
reproducible evidence -- not a user-facing capability. Every success criterion and
every gate item was confirmed against the actual codebase, the built artifacts,
and a live `nx build` + `nx test` run executed by this verifier (not trusting the
SUMMARY claims). All evidence reproduced.

### Observable Truths (Success Criteria)

| #    | Truth (Success Criterion)                                                                                                                                                                                                                                                          | Status   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | -------- | --- | -------------------------------------------------------------------------------------------------------------------------------------- |
| SC-1 | Nx 23 integrated Angular monorepo created in-place over pre-existing `.git`/`.planning` (no clobber); `angular-typechecker` package pinned to Nx 23 / Angular 22 / TS `>=6.0 <6.1` + `engines.node` correct                                                                        | VERIFIED | `npx nx show projects` -> `["angular-typechecker","ng-spike-app"]`. Git history linear and intact: original `.planning` commits (de7a194, b6a96ba) PRECEDE bootstrap commit ab182b2 "bootstrap Nx 23 ... over preserved .git" -- no history rewrite; `.planning/` + `CLAUDE.md` present; working tree clean. Plugin `package.json`: `@nx/devkit@23.0.1` pinned dep, peers `@angular/compiler-cli@^22.0.0` + `typescript@>=6.0.0 <6.1.0`, `engines.node = ^22.22.3                                                                                                                                                                                                                                                                                                                                                                                                                               |     | ^24.15.0 |     | ^26.0.0`, NO `nx`declared. Installed: nx 23.0.1, @angular/compiler-cli 22.0.4, typescript 6.0.3 (read from node_modules +`nx report`). |
| SC-2 | Plugin builds via `@nx/js:tsc` to CommonJS `.js` + `.d.ts`; built executor path STILL contains `import(` (nodenext did not downlevel to `require()`)                                                                                                                               | VERIFIED | `npx nx build angular-typechecker --skip-nx-cache` GREEN. Built `dist/.../src/core/compiler-loader.js:19` contains literal `yield import('@angular/compiler-cli')`; only `require("tslib")` present -- no `require('@angular/compiler-cli')`. Built `executor.js`: only `require("tslib")` + `require("../../core/run-typecheck")`; package named only in a JSDoc comment. `.d.ts` emitted (executor.d.ts, compiler-loader.d.ts, index.d.ts). Built package.json `type: commonjs`. Plugin tsconfig `module/moduleResolution: nodenext`. (Per RESEARCH-ADDENDUM Finding 2, the `import(` correctly lives in `core/compiler-loader.js`, not `executor.js` -- accepted corrected form of SC-2/WS-02.)                                                                                                                                                                                              |
| SC-3 | On a real Angular 22 workspace, the custom gatherer surfaces template + extended (NG8xxx) diagnostics UNCONDITIONALLY even with a co-located TS error (no ngc short-circuit); ESM compiler-cli loads via `await import()` under the supported Node range; cold-run timing recorded | VERIFIED | Live `nx test` reproduced: all-getter on BOTH app + lib fixtures returns `[2322, -998109, -998117]`; `defaultGatherDiagnostics` (ngc) returns `[2322]` only -- the &&-chain short-circuit the all-getter overcomes is proven (differential). NG8109 manifests as `-998109` (`ngErrorCode(8109)=parseInt('-99'+8109)`; recover `Math.abs(c)-990000===8109`) -- accepted per RESEARCH-ADDENDUM Finding 3 / scope note 3. `await import('@angular/compiler-cli')` resolved at runtime with no `ERR_REQUIRE_ESM` and no code 500 (UNKNOWN_ERROR_CODE absent). Cold-run reproduced live: `durationMs = 286.50` (SUMMARY recorded 296.82) on Node v24.18.0 (in-range `^24.15.0`). NOTE: the "full project-type matrix + out-of-project filtering" clause of SC-3 is DEFERRED to Phases 2/3 per CONTEXT D-09/D-10 (scope note 1) -- Phase-1 breadth is one app + one local library, which IS verified. |
| SC-4 | Vitest harness (`@nx/vitest:test`) runs at least one green test                                                                                                                                                                                                                    | VERIFIED | Live `npx nx test angular-typechecker --skip-nx-cache`: 4 test files, 12 tests, ALL pass. "Successfully ran target test for project angular-typechecker."                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

**Score:** 4/4 success criteria verified.

### Six-Item Go/No-Go Checklist Confirmation

| #   | Checklist item                                                                                                                 | Verdict | Verifier evidence (reproduced live)                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | [A static] built `compiler-loader.js` matches `/import\(/`; neither built file matches `/require\(["']@angular\/compiler-cli/` | GO      | Read built bytes directly: `compiler-loader.js:19` literal `import('@angular/compiler-cli')`; both built files have only `require("tslib")`/`require("../../core/run-typecheck")`. `gate-a-static.spec.ts` (3 tests) pass live.                                                             |
| 2   | [A runtime] loading the ESM compiler-cli via `await import()` resolves (no `ERR_REQUIRE_ESM`, no 500)                          | GO      | `gate-b.spec.ts` awaits `loadCompilerCli()` -> `performCompilation`; `not.toContain(500)` asserted and passing; runs resolved live (a failed import would reject).                                                                                                                          |
| 3   | [B positive] all-getter returns codes incl. BOTH `2322` and NG8109 (`-998109`)                                                 | GO      | Live run: app + lib all-getter = `[2322, -998109, -998117]`. `toContain(2322)`, `toContain(-998109)`, `Math.abs(c)-990000===8109` all pass.                                                                                                                                                 |
| 4   | [B differential] `defaultGatherDiagnostics` returns `2322` but NOT `-998109`                                                   | GO      | Live run: app + lib ngc default = `[2322]`. `toContain(2322)` + `not.toContain(-998109)` pass.                                                                                                                                                                                              |
| 5   | [B breadth] items 3-4 hold for one app tsconfig AND one local-library tsconfig                                                 | GO      | `describe.each([['app tsconfig', appTsConfig],['local-library tsconfig', libTsConfig]])` -- both variants pass live (identical arrays). Fixture has both `tsconfig.app.json` + `tsconfig.lib.json`, `strictTemplates: true`, `noEmit: true`, out-of-graph (absent from `nx show projects`). |
| 6   | [timing] one cold-run wall-clock recorded                                                                                      | GO      | Reproduced live: `[GATE B timing] cold-run durationMs = 286.4964`. SUMMARY recorded 296.82.                                                                                                                                                                                                 |

**GO iff 1-6 all hold -> all six GO -> GO. Phase 2 (the real engine) may begin.**

### Required Artifacts

| Artifact                                      | Expected                                               | Status   | Details                                                                                                                                         |
| --------------------------------------------- | ------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/angular-typechecker/package.json`   | type:commonjs, devkit dep, peers, engines, no nx       | VERIFIED | Exactly per D-14/CMP-01/CMP-02.                                                                                                                 |
| `packages/angular-typechecker/tsconfig.json`  | module/moduleResolution nodenext                       | VERIFIED | nodenext both; `ignoreDeprecations: "6.0"`.                                                                                                     |
| `src/core/compiler-loader.ts`                 | memoized `await import()` of compiler-cli              | VERIFIED | Single value-import; memoized via `cached ??=`. Wired -> run-typecheck, gate-b spec.                                                            |
| `src/core/gather-diagnostics.ts`              | unconditional 6-getter all-getter                      | VERIFIED | All six getters incl. `getNgSemanticDiagnostics()` unconditionally. Wired -> run-typecheck, gate-b spec.                                        |
| `src/core/run-typecheck.ts`                   | `runTypecheck` -> structured CoreResult + durationMs   | VERIFIED | performCompilation, fresh `{...options, noEmit:true}`, durationMs. Wired -> executor, gate-b spec.                                              |
| `src/executors/angular-typecheck/executor.ts` | thin CJS executor delegating to core                   | VERIFIED | Default export -> `runTypecheck`. Built executor.js is `require()`-loadable CJS.                                                                |
| `src/core/compiler-cli-types.ts`              | type-only nodenext shim                                | VERIFIED | Accepted, documented type-only workaround (addendum Finding 1 VERDICT: keep). Erased at emit.                                                   |
| `src/executors/.../gate-a-static.spec.ts`     | GATE A static via fs.readFileSync                      | VERIFIED | Reads built artifacts; positive on compiler-loader.js, negative on both; comment-stripped; path derived from project.json outputPath.           |
| `src/core/gate-b.spec.ts`                     | GATE B positive+differential+breadth+runtime+timing    | VERIFIED | `describe.each([app,lib])`; asserts -998109; timing logged.                                                                                     |
| `fixtures/gate-b-error/`                      | out-of-graph TS2322+NG8109 fixture (app+lib tsconfigs) | VERIFIED | `count: number = 'not a number'` (TS2322) + `status = signal('ready')` interpolated `{{ status }}` (NG8109/8117); both tsconfigs; out of graph. |
| `apps/ng-spike-app/`                          | real Angular 22 standalone spike app, kept green       | VERIFIED | Standalone bootstrap, in graph.                                                                                                                 |
| `dist/packages/angular-typechecker/`          | built CJS .js + .d.ts + executors.json                 | VERIFIED | All present; package.json type:commonjs.                                                                                                        |

### Key Link Verification

| From                  | To                                                          | Via                                                        | Status | Details                                                       |
| --------------------- | ----------------------------------------------------------- | ---------------------------------------------------------- | ------ | ------------------------------------------------------------- |
| gate-a-static.spec.ts | dist compiler-loader.js (positive) + executor.js (negative) | fs.readFileSync + regex, path from project.json outputPath | WIRED  | Live: 3 tests pass against freshly-built dist.                |
| gate-b.spec.ts        | fixtures/gate-b-error tsconfigs                             | loadCompilerCli + performCompilation (both gatherers)      | WIRED  | Live: 5 tests pass; toContain(-998109) holds.                 |
| executor.ts           | core/run-typecheck.ts                                       | `import { runTypecheck }`                                  | WIRED  | Built executor.js `require("../../core/run-typecheck")`.      |
| run-typecheck.ts      | compiler-loader + gather-diagnostics                        | import + call                                              | WIRED  | Drives all-getter through performCompilation.                 |
| compiler-loader.ts    | @angular/compiler-cli (ESM)                                 | `await import()`                                           | WIRED  | Literal `import(` survives in built .js; resolves at runtime. |

### Data-Flow Trace (Level 4)

| Artifact         | Data Variable               | Source                                                                          | Produces Real Data                                         | Status  |
| ---------------- | --------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------- |
| gate-b.spec.ts   | diagnostic `codes`          | REAL `@angular/compiler-cli@22.0.4` `performCompilation` over committed fixture | Yes -- live run yields `[2322,-998109,-998117]` / `[2322]` | FLOWING |
| run-typecheck.ts | CoreResult.durationMs/codes | real compiler run on real tsconfig                                              | Yes -- live cold-run 286.50ms                              | FLOWING |

The gate is driven by the REAL Angular compiler against a REAL committed fixture -- no mocks, no hardcoded diagnostic arrays. This is the strongest possible evidence for a spike gate.

### Behavioral Spot-Checks

| Behavior                | Command                                            | Result                                                             | Status |
| ----------------------- | -------------------------------------------------- | ------------------------------------------------------------------ | ------ |
| Plugin builds to CJS    | `npx nx build angular-typechecker --skip-nx-cache` | Successfully ran target build                                      | PASS   |
| Vitest harness green    | `npx nx test angular-typechecker --skip-nx-cache`  | 4 files, 12 tests, all pass                                        | PASS   |
| Project graph           | `npx nx show projects`                             | `["angular-typechecker","ng-spike-app"]` (fixture out-of-graph)    | PASS   |
| Toolchain pins          | `nx report` + node_modules read                    | nx 23.0.1, compiler-cli 22.0.4, TS 6.0.3, devkit 23.0.1            | PASS   |
| Built import() survives | read `dist/.../compiler-loader.js` bytes           | literal `import('@angular/compiler-cli')`, no compiler-cli require | PASS   |
| Git history intact      | `git log --oneline`                                | linear; `.planning` commits precede bootstrap; no rewrite          | PASS   |

### Requirements Coverage

| Requirement | Source Plan       | Description                                                                | Status    | Evidence                                                                                                                     |
| ----------- | ----------------- | -------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------- | --- | -------- | --------- | -------------------------------- |
| WS-01       | 01-01/01-02       | Nx 23 integrated Angular monorepo hosting the plugin                       | SATISFIED | SC-1 evidence: `nx show projects`, no-clobber git history, plugin package present.                                           |
| WS-02       | 01-02/01-03/01-04 | Builds via `@nx/js:tsc` to CJS .js+.d.ts; built artifact retains `import(` | SATISFIED | SC-2 evidence: green build, `.d.ts` emitted, literal `import(` in built compiler-loader.js (corrected target per Finding 2). |
| WS-03       | 01-04             | Unit/integration tests run via `@nx/vitest:test`                           | SATISFIED | SC-4 evidence: 12 green tests live.                                                                                          |
| ENG-03      | 01-03/01-04       | Core loads ESM compiler-cli via `await import()` under supported Node      | SATISFIED | SC-3 evidence: runtime resolve no ERR_REQUIRE_ESM/500 on Node v24.18.0; literal `import(` in built emit.                     |
| CMP-01      | 01-01/01-02       | Nx 23 + Angular 22 + TS `>=6.0 <6.1`                                       | SATISFIED | nx 23.0.1, @angular/compiler-cli 22.0.4, typescript 6.0.3 (exact dev pins + ranged peers).                                   |
| CMP-02      | 01-02             | `engines.node = ^22.22.3                                                   |           | ^24.15.0                                                                                                                     |     | ^26.0.0` | SATISFIED | Verbatim in plugin package.json. |

All 6 Phase-1 requirements (REQUIREMENTS.md per-phase set) SATISFIED. No orphaned requirements: REQUIREMENTS.md maps exactly WS-01/02/03, ENG-03, CMP-01/02 to Phase 1, and all appear in the plans' `requirements` fields.

### Anti-Patterns Found

| File   | Line | Pattern                                       | Severity | Impact |
| ------ | ---- | --------------------------------------------- | -------- | ------ |
| (none) | -    | No TBD/FIXME/XXX in any phase-modified source | -        | Clean. |

Notes on intentional, documented items (NOT anti-patterns, per scope notes):

- `compiler-cli-types.ts:18,24` deep `node_modules/@angular/compiler-cli/src/...` relative type imports -- the accepted type-only nodenext shim (addendum Finding 1 VERDICT: keep with Phase-2 caveat). Surfaces as 2 `@nx/enforce-module-boundaries` lint findings deferred to WS-04/Phase 3 (logged in deferred-items.md). ESLint is NOT a Phase-1 gate.
- `executor.ts:16` `_context` unused-arg -- intentional thin-stub signature; 1 lint warning deferred to Phase 3/Phase 4 (logged).
- `.npmrc` `legacy-peer-deps=true` -- documented intentional Angular-22 + Nx-23 peer reconciliation, not a defect.

### Human Verification Required

None. This is a spike gate whose entire contract is automatable and was reproduced
live by the verifier (build + 12 tests + diagnostic-code arrays + timing + version
pins + git-history integrity). No visual/UX/real-time/external-service surface exists.

### Gaps Summary

No genuine gaps. All four success criteria verified, all six go/no-go checklist
items confirmed GO against independently reproduced evidence, and all six Phase-1
requirements satisfied. The two riskiest unknowns are PROVEN on a real Angular 22
workspace:

1. GATE A: the literal `import(` survives `module: nodenext` emit (verified on the
   built bytes) and the ESM `@angular/compiler-cli` loads at runtime with no
   `ERR_REQUIRE_ESM`/code-500.
2. GATE B: the unconditional all-getter surfaces NG8109 (`-998109`) + NG8117
   (`-998117`) where ngc's `defaultGatherDiagnostics` returns only `[2322]` --
   for BOTH an app and a local-library tsconfig.

All deferrals (full 5-type matrix, out-of-project/node_modules filtering, exhaustive
NG8xxx catalog, ESLint/dependency-checks + the 3 pre-existing lint findings, full
executor adapter, package.json files/exports/keywords + publish, e2e/CI matrix) are
documented, locked, roadmap-scoped to Phases 2/3/4/5/6 -- correctly NOT counted as
Phase-1 gaps (CONTEXT D-09/D-10/D-14, deferred-items.md, scope notes 1-4).

The GATED roadmap note's condition (Phase 2 begins only if criteria 2 and 3 hold)
is met: both GATE A and GATE B are GO.

---

_Verified: 2026-06-27T18:45:00Z_
_Verifier: Claude (gsd-verifier)_
