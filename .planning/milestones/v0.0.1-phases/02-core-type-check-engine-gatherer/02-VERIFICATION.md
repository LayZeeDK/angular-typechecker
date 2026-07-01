---
phase: 02-core-type-check-engine-gatherer
verified: 2026-06-27T22:20:00Z
status: passed
score: 4/4 success criteria verified; 13/13 plan must-have truths verified; 5/5 Phase-2 requirements satisfied
overrides_applied: 0
mode_note: >-
  ROADMAP declares mode: mvp, but the phase goal is an engineering-deliverable
  statement ("A framework-agnostic core ... runs the complete Angular compiler
  diagnostic set whole-program and no-emit ... with zero @nx/devkit/CLI
  imports"), NOT an "As a ... I want ... so that ..." User Story
  (user-story.validate returned false). There are no user-facing flows to trace
  (the sole consumer of `runTypecheck` is the Phase-4 executor, not built in this
  phase). Following the precedent set by Phase-1's own VERIFICATION.md, this was
  verified goal-backward against the four explicit ROADMAP Success Criteria plus
  the 13 plan-frontmatter must-have truths, rather than refusing under the MVP
  User Story guard. The User Flow Coverage table is N/A for a pure-engine phase.
re_verification:
  is_re_verification: false
---

# Phase 2: Core Type-Check Engine + Gatherer Verification Report

**Phase Goal:** A framework-agnostic core (`runTypecheck(options)`) runs the complete Angular compiler diagnostic set whole-program and no-emit against a given tsconfig, returning structured results -- with zero `@nx/devkit`/CLI imports so every deferred surface is cheap later.

**Verified:** 2026-06-27T22:20:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

This is a pure-engine deliverable. The central claim is that `runTypecheck` is a
real, framework-agnostic whole-program no-emit type-checker that gathers ALL
diagnostics unconditionally and returns structured, correctly-categorized counts
-- proven against the REAL Angular 22 compiler, not mocks. Every Success
Criterion and every plan must-have was confirmed against the actual source, the
built `dist/` artifact, a full `nx build` + `nx test` run, and three independent
runtime probes executed by this verifier (the SUMMARY claims were NOT trusted).

### Observable Truths (ROADMAP Success Criteria)

| #    | Truth (Success Criterion)                                                                                                                                                                                                                                                         | Status   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SC-1 | `runTypecheck` loads ESM compiler-cli lazily (memoized), resolves a single tsconfig (extends chain + no-emit overrides), runs whole-program, returns a structured result (`ts.Diagnostic[]` + counts) with `strictTemplates` honored and extended-diagnostic categories respected | VERIFIED | `compiler-loader.ts` memoizes `await import('@angular/compiler-cli')` via `cached ??=`; `run-typecheck.ts` calls `ng.readConfiguration` then `ng.performCompilation` with the full D-05 emit-neutralizing override + `diagnostics: false` (D-02) + `emitFlags: 0` + `noEmit: true`; returns `CoreResult { tsConfigPath, rootNamesCount, diagnostics, errorCount, warningCount, durationMs }`. Live probe on `gate-b-error/tsconfig.app.json`: rootNamesCount=1, errorCount=1, warningCount=2 (strictTemplates surfaces NG8109/NG8117 as Warnings). Extended NG8101 default Warning vs `defaultCategory:"error"` promotion both proven (see SC-4).                                                                   |
| SC-2 | The custom gatherer collects ALL diagnostics unconditionally (TS option/syntactic/semantic + Angular template + extended NG8xxx), never short-circuiting by phase like ngc's default                                                                                              | VERIFIED | `gather-diagnostics.ts` calls all six getters unconditionally (`getTsOptionDiagnostics` -> `getNgOptionDiagnostics` -> `getTsSyntacticDiagnostics` -> `getTsSemanticDiagnostics` -> `getNgStructuralDiagnostics` -> `getNgSemanticDiagnostics`) with no `&&`-chain. Wired into `performCompilation` via `gatherDiagnostics: gatherAllDiagnostics`. Live probe: `gate-b-error` codes = `[2322, -998109, -998117]` -- TS2322 AND NG8109 in ONE pass; GATE B differential spec confirms ngc's `defaultGatherDiagnostics` returns only `[2322]`.                                                                                                                                                                        |
| SC-3 | A required `tsConfig` resolves correctly for each project tsconfig INCLUDING a spec tsconfig (`tsconfig.spec.json`), and a references-only / solution-style tsconfig does NOT silently report "0 files / 0 errors"                                                                | VERIFIED | EXE-02 spec-checking: live probe on `config-broken/tsconfig.spec.json` -> codes `[2322,2322,-998109,-998117]`, errorCount=2, rootNamesCount=1 (the planted spec-file TS2322 surfaces -- specs ARE type-checked, the differentiator vs a build). Solution-style guard: live probe on `solution-style/tsconfig.json` -> rootNamesCount=0, errorCount=1, synthesized guard code 90001 with message naming leaf tsconfigs (app/lib/spec). D-03a confirmed: guard gates on `rootNames.length === 0`, NOT TS18003 (spec asserts `codes` excludes 18003).                                                                                                                                                                  |
| SC-4 | Integration tests run the REAL compiler against committed fixtures and assert exact diagnostic codes/counts across the v13->v22 catalog (organized by Angular introduction version), all on Angular 22                                                                            | VERIFIED | Five `*.integration.spec.ts` files call `runTypecheck` directly per fixture and assert EXACT codes via the `NG()` helper (TS raw: 2322/2339/5053/6304/6379; NG via `NG()`: 8001/8101/8109). Per-introduction-version organization present (`baseline.angular13`, `extended.angular13`, `extended.angular17`). NG8101 default-Warning proven; `defaultCategory:"error"` promotion into errorCount proven; D-05 composite-triangle neutralization proven (no 5053/6304/6379); D-02 Time-for-diagnostics Message absence proven. 39/39 tests pass across 12 files. (See IN-01: `extended.angular17` reuses the portable NG8101 shape -- documented decision; per-version filename convention is present and additive.) |

**Score:** 4/4 success criteria verified.

### Plan Must-Have Truths

| #   | Plan  | Truth                                                                                                                                         | Status   | Evidence                                                                                                                                                                    |
| --- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 02-01 | `errorCount` counted explicitly by category Error (not total - errorCount)                                                                    | VERIFIED | `run-typecheck.ts:207` `category === ts.DiagnosticCategory.Error`; no `length - errorCount` in code.                                                                        |
| 2   | 02-01 | `warningCount` counted explicitly by category Warning                                                                                         | VERIFIED | `run-typecheck.ts:210` `category === ts.DiagnosticCategory.Warning`. Live probe: gate-b warningCount=2.                                                                     |
| 3   | 02-01 | Prepends `parsed.errors` so a malformed tsconfig is never silently clean                                                                      | VERIFIED | `run-typecheck.ts:79` `configDiagnostics = [...parsed.errors]` prepended on both paths. config-resolution spec asserts malformed config -> errorCount>=1, not thrown.       |
| 4   | 02-01 | Full D-05 emit-neutralizing override (composite/emitDeclarationOnly base does not emit bogus TS5053)                                          | VERIFIED | `run-typecheck.ts:111-126` full override verbatim. Live probe: composite-triangle has no 5053/6304/6379.                                                                    |
| 5   | 02-01 | Re-throws an infrastructure failure (UNKNOWN_ERROR_CODE 500) instead of counting it as a type error                                           | VERIFIED | `run-typecheck.ts:139-147` detects `code === ng.UNKNOWN_ERROR_CODE`, throws `TypecheckInfrastructureError`. infra-failure.spec proves re-throw on 500 + no-throw on TS2322. |
| 6   | 02-01 | The unconditional gatherer surfaces TS2322 AND NG8109 in one pass via `runTypecheck`                                                          | VERIFIED | Live probe + run-typecheck.integration.spec: codes contain 2322 AND `NG(8109)` (-998109).                                                                                   |
| 7   | 02-01 | `CoreResult` has no public `codes` field; specs derive codes from diagnostics                                                                 | VERIFIED | No `codes:` field on the interface; spec asserts `'codes' in result === false`.                                                                                             |
| 8   | 02-02 | `runTypecheck` against a `tsconfig.spec.json` reports the planted spec-file type error                                                        | VERIFIED | Live probe config-broken spec: TS2322 present, rootNamesCount=1.                                                                                                            |
| 9   | 02-02 | Malformed/nonexistent tsconfig reports errorCount >= 1 (never silently clean)                                                                 | VERIFIED | config-resolution spec asserts the prepended config error (names `tsconfig.does-not-exist.json`), errorCount>=1, no throw.                                                  |
| 10  | 02-02 | References-only / solution-style tsconfig returns rootNamesCount 0 AND errorCount 1 with a leaf-tsconfig-naming message                       | VERIFIED | Live probe: rootNamesCount=0, errorCount=1, guard message matches `/tsconfig\.(app\|lib\|spec)\.json/`; does not gate on TS18003.                                           |
| 11  | 02-03 | TS baseline asserts 2322; template-driven fixture asserts 2339; NG baseline asserts exact NG code via NG()                                    | VERIFIED | baseline.angular13 spec asserts TS2339 (raw) + `NG(8001)`. gate-b covers 2322.                                                                                              |
| 12  | 02-03 | Extended NG8101 category Warning by default; promoted variant same code as Error in errorCount                                                | VERIFIED | extended.angular13: `NG(8101)` category Warning, errorCount===0. extended.angular17: same code category Error, errorCount>=1.                                               |
| 13  | 02-03 | Composite-triangle proves D-05 neutralizes TS5053/6304/6379; diagnostics:true fixture proves D-02 suppresses the Time-for-diagnostics Message | VERIFIED | no-emit-override spec asserts codes exclude 5053/6304/6379 and no category-Message "Time for diagnostics" entry.                                                            |

**Score:** 13/13 plan must-have truths verified.

### Required Artifacts

| Artifact                                          | Expected                                               | Status                 | Details                                                                                                                                                                                                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/core/run-typecheck.ts`                       | Real engine + D-01 CoreResult (D-01..D-06)             | VERIFIED               | `rootNamesCount` in interface + both return paths; full D-05 override; D-02 `diagnostics:false`; D-03 prepend + zero-rootNames guard (code 90001); D-06 detect+re-throw; explicit category counts; `TypecheckInfrastructureError` defined. Wired -> index.ts, all integration specs. |
| `src/core/compiler-cli-types.ts`                  | Widened shim exposing UNKNOWN_ERROR_CODE               | VERIFIED               | `readonly UNKNOWN_ERROR_CODE: typeof UNKNOWN_ERROR_CODE` added to `CompilerCli`, deep-imported from `.../transformers/api`.                                                                                                                                                          |
| `src/core/diagnostic-codes.ts`                    | NG()/ngCodeOf() helpers (D-07d)                        | VERIFIED               | `NG = (code) => -990000 - code`; `ngCodeOf = (code) => Math.abs(code) - 990000`; dependency-free. Imported by baseline/extended integration specs.                                                                                                                                   |
| `src/core/run-typecheck.integration.spec.ts`      | Real-compiler end-to-end proof                         | VERIFIED               | describe.each over app+lib; asserts TS2322 + NG(8109), count invariant, no public codes. 8 tests green.                                                                                                                                                                              |
| `src/core/infra-failure.spec.ts`                  | D-06 re-throw proof                                    | VERIFIED               | hoisted stub of loadCompilerCli; re-throws on 500, no-throw + counts on 2322. 2 tests green.                                                                                                                                                                                         |
| `src/core/config-resolution.integration.spec.ts`  | D-03 fail-loud + EXE-02 spec checking                  | VERIFIED               | spec/malformed/solution-style cases. 5 tests green.                                                                                                                                                                                                                                  |
| `src/core/baseline.angular13.integration.spec.ts` | TS2339 + NG8001 baselines                              | VERIFIED               | 2 tests green.                                                                                                                                                                                                                                                                       |
| `src/core/extended.angular13.integration.spec.ts` | NG8101 default Warning                                 | VERIFIED               | 1 test green (category Warning, errorCount 0).                                                                                                                                                                                                                                       |
| `src/core/extended.angular17.integration.spec.ts` | Category promotion proof                               | VERIFIED               | 2 tests green (promoted NG8101 -> Error; invariant). Misnamed re v17 (IN-01, info).                                                                                                                                                                                                  |
| `src/core/no-emit-override.integration.spec.ts`   | D-05 triangle + D-02 Message                           | VERIFIED               | 2 tests green.                                                                                                                                                                                                                                                                       |
| `fixtures/solution-style/tsconfig.json`           | references-only silent-lie input                       | VERIFIED               | `files:[]`, `references:[{path}]`.                                                                                                                                                                                                                                                   |
| `fixtures/config-broken/tsconfig.spec.json`       | spec tsconfig at planted error                         | VERIFIED               | `files:["error.component.spec.ts"]`.                                                                                                                                                                                                                                                 |
| `fixtures/composite-triangle/tsconfig.json`       | composite/emitDeclarationOnly triangle                 | VERIFIED               | `composite:true`, `declarationMap:true`, `emitDeclarationOnly:true`.                                                                                                                                                                                                                 |
| `fixtures/extended-promoted/tsconfig.app.json`    | defaultCategory error                                  | VERIFIED               | `"defaultCategory": "error"`.                                                                                                                                                                                                                                                        |
| `tsconfig.lib.json`                               | excludes fixtures so Wave-2 are fixture-only additions | VERIFIED (with caveat) | Build excludes all fixtures (none leak to dist). The `fixtures/**/*` exclude entries are dead config (resolve under `packages/angular-typechecker/`, no such dir) -- the real guard is `include: ["src/**/*.ts"]`. See WR-01 (info).                                                 |

### Key Link Verification

| From                   | To                                                                   | Via                                                                  | Status | Details                                                                                                           |
| ---------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| run-typecheck.ts       | gatherAllDiagnostics                                                 | `gatherDiagnostics: gatherAllDiagnostics` in performCompilation call | WIRED  | Drives the unconditional all-getter; live probe surfaces NG codes.                                                |
| run-typecheck.ts       | ng.UNKNOWN_ERROR_CODE                                                | `diagnostic.code === ng.UNKNOWN_ERROR_CODE` detect + re-throw        | WIRED  | infra-failure.spec proves the re-throw.                                                                           |
| compiler-loader.ts     | @angular/compiler-cli (ESM)                                          | memoized `await import()`                                            | WIRED  | Built `compiler-loader.js:19` retains literal `import('@angular/compiler-cli')` (GATE A intact, not downleveled). |
| index.ts               | TypecheckInfrastructureError + runTypecheck + CoreOptions/CoreResult | re-export                                                            | WIRED  | Phase-4 executor seam exported; no `codes` type remains.                                                          |
| \*.integration.spec.ts | runTypecheck                                                         | direct call per fixture (D-07c)                                      | WIRED  | All five integration specs call `runTypecheck({ tsConfigPath })` against committed fixtures.                      |

### Data-Flow Trace (Level 4)

| Artifact          | Data Variable                     | Source                                                                                    | Produces Real Data                                                                                | Status  |
| ----------------- | --------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------- |
| run-typecheck.ts  | `CoreResult.diagnostics` / counts | REAL `@angular/compiler-cli@22.0.4` `performCompilation` over committed fixture tsconfigs | Yes -- live probes yield `[2322,-998109,-998117]`, solution-style guard, composite-triangle clean | FLOWING |
| integration specs | asserted codes/counts             | REAL compiler run per fixture (no mocks except the justified D-06 stub)                   | Yes -- 39/39 green against real compiler                                                          | FLOWING |

The engine is driven by the REAL Angular compiler against REAL committed fixtures -- no hardcoded diagnostic arrays in production paths. The single mock (infra-failure.spec) is the justified D-06 stub.

### Behavioral Spot-Checks

| Behavior                            | Command                                            | Result                                                                 | Status |
| ----------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------- | ------ |
| Plugin builds to CJS, GATE A intact | `npx nx build angular-typechecker --skip-nx-cache` | Successfully ran target build                                          | PASS   |
| Full test suite                     | `npx nx test angular-typechecker --skip-nx-cache`  | 12 files, 39 tests, all pass                                           | PASS   |
| TS2322 + NG8109 in one pass         | runtime probe on gate-b-error/tsconfig.app.json    | codes `[2322,-998109,-998117]`; errorCount 1, warningCount 2           | PASS   |
| Solution-style not silently clean   | runtime probe on solution-style/tsconfig.json      | rootNamesCount 0, errorCount 1, guard code 90001 naming leaf tsconfigs | PASS   |
| Composite-triangle neutralized      | runtime probe on composite-triangle/tsconfig.json  | no 5053/6304/6379, errorCount 0                                        | PASS   |
| Spec tsconfig type-checked          | runtime probe on config-broken/tsconfig.spec.json  | TS2322 present, rootNamesCount 1                                       | PASS   |
| Framework-agnostic core             | `git grep @nx/devkit` in `src/core/`               | zero matches                                                           | PASS   |
| No fixture .ts leaked to dist       | `ls dist/.../fixtures`                             | no such directory                                                      | PASS   |

### Requirements Coverage

| Requirement | Source Plan  | Description                                                                                               | Status    | Evidence                                                                                        |
| ----------- | ------------ | --------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------- |
| ENG-01      | 02-01, 02-02 | Framework-agnostic core runs compiler-cli whole-program no-emit against a given tsconfig                  | SATISFIED | SC-1 evidence; run-typecheck.integration.spec ENG-01 case green.                                |
| ENG-02      | 02-01, 02-03 | Custom gatherer collects ALL diagnostics unconditionally (no ngc short-circuit)                           | SATISFIED | SC-2 evidence; gatherAllDiagnostics all-six-getters; GATE B differential.                       |
| ENG-04      | 02-01, 02-03 | Structured result (ts.Diagnostic[] + counts), strictTemplates honored, extended categories respected      | SATISFIED | SC-1/SC-4; explicit category counts; NG8101 Warning vs promoted Error proven.                   |
| EXE-02      | 02-02        | Required tsConfig per target; spec/unit-test checking via tsconfig.spec.json                              | SATISFIED | SC-3; config-broken spec fixture surfaces the planted spec-file TS2322.                         |
| TEST-02     | 02-03        | Integration tests run real compiler, assert exact codes/counts across v13->v22 (per introduction version) | SATISFIED | SC-4; five real-compiler integration specs, exact-code/count assertions, per-version filenames. |

All 5 Phase-2 requirement IDs declared in plan frontmatter (ENG-01, ENG-02, ENG-04, EXE-02, TEST-02) map to Phase 2 in REQUIREMENTS.md. No orphaned requirements: REQUIREMENTS.md maps exactly these 5 to Phase 2 and all appear in the plans' `requirements` fields. (REQUIREMENTS.md still lists them as "Pending" -- the milestone audit closes statuses post-verification; this is not a phase-goal gap.)

### Anti-Patterns Found

| File                                      | Line  | Pattern                                                             | Severity | Impact                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------- | ----- | ------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| fixtures/gate-b-error/error.component.ts  | 6     | `// @ts-nocheck` (wrapped-comment tail of "Do NOT add @ts-nocheck") | Info     | INERT -- not a top-of-file directive (follows the `import` statement), so TypeScript does not apply it. Empirically the fixture's TS2322 + NG8109 DO surface (live probe). Misleads a reader; the 02-02/02-03 SUMMARYs claimed no line-leading `@ts-nocheck` exists -- two do, but both are non-functional. |
| fixtures/config-broken/error.component.ts | 8     | `// @ts-nocheck` (same wrapped-comment tail)                        | Info     | INERT -- same as above; config-broken spec TS2322 surfaces in the probe (errorCount 2).                                                                                                                                                                                                                     |
| tsconfig.lib.json                         | 26-27 | `fixtures/gate-b-error/**/*` + `fixtures/**/*` excludes             | Info     | Dead config (no `fixtures/` dir under the project root); harmless -- `include: ["src/**/*.ts"]` is the real guard and no fixture leaks to dist. Fixture header comments claiming exclusion via these globs are misleading (REVIEW WR-01/IN-03).                                                             |
| run-typecheck.ts                          | 81    | `durationMs` excludes module-load + config-parse                    | Info     | Metric semantics, not correctness (REVIEW WR-02/IN-04). No consumer asserts wall-clock; the gate-b banner over-reports "cold-run". Does not affect counts or goal.                                                                                                                                          |

No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER in any phase-modified source. No blocking anti-patterns.

### Human Verification Required

None. This is a pure-engine deliverable whose entire contract is automatable and was
reproduced live by the verifier (build + 39 tests + three runtime probes against the
real Angular 22 compiler + exact diagnostic-code arrays + count assertions). No
visual / UX / real-time / external-service surface exists. The only downstream
consumer (the Nx executor) is built in Phase 4.

### Gaps Summary

No genuine gaps. All four ROADMAP Success Criteria are VERIFIED, all 13 plan
must-have truths are VERIFIED, and all 5 Phase-2 requirements are SATISFIED -- each
confirmed against the actual source, the built `dist/` artifact, a full
`nx build` + `nx test` run (39/39 across 12 files), and three independent runtime
probes that exercise the load-bearing behaviors against the REAL compiler:

1. The unconditional gatherer surfaces TS2322 AND NG8109 (-998109) in ONE pass
   (no ngc phase short-circuit), with explicit, correct category counts.
2. A solution-style / references-only tsconfig returns the deterministic
   `rootNamesCount: 0` + `errorCount: 1` guard (code 90001, leaf-tsconfig-naming
   message) -- never a silent "0 files / 0 errors".
3. The D-05 override neutralizes the composite/emitDeclarationOnly TS5053/6304/6379
   triangle; D-02 suppresses the Time-for-diagnostics Message; a spec tsconfig is
   genuinely type-checked (EXE-02); and an infrastructure-failure code 500 is
   re-thrown rather than counted as a type error (D-06).

Four INFO-level quality items (two inert `@ts-nocheck` wrapped-comment tails that
are NOT applied by TypeScript and do not affect the fixtures' error-surfacing; dead
`fixtures/**/*` excludes in `tsconfig.lib.json` whose real guard is the `include`
scope; the `durationMs` metric excluding cold-start; and the `extended.angular17`
filename reusing the portable NG8101 shape) are documented quality/maintainability
defects that match the phase code-review (02-REVIEW.md WR-01/WR-02/IN-01..IN-04).
None block the phase goal: the engine's correctness claims all hold empirically.

Note: the 02-03 SUMMARY recorded "34/34 across 11 files" -- a snapshot taken before
later spec additions. The current, re-run-confirmed state is 39/39 across 12 files,
matching the phase code-review and the orchestrator's expected count.

---

_Verified: 2026-06-27T22:20:00Z_
_Verifier: Claude (gsd-verifier)_
