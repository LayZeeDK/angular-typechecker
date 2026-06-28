---
phase: 04-nx-executor-adapter-cacheable-target
verified: 2026-06-28T14:10:00Z
status: passed
score: 3/3 success criteria verified (8/8 plan must-have truths verified)
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
requirements_verified: [EXE-01, EXE-06, EXE-07, TEST-04]
gates_run:
  - "nx build angular-typechecker --skip-nx-cache -> exit 0 (GATE A)"
  - "import( survival: compiler-loader.js=1, render-report.js=2; no require() downlevel"
  - "nx test angular-typechecker --skip-nx-cache -> 20 files / 99 tests passed, exit 0"
  - "nx show target inputs typecheck-consumer:angular-typecheck --check <dep file> -> exit 0 + 'is an input' (R1/SC2)"
  - "nx show project typecheck-consumer --json -> cache:true outputs:[] 7 inputs ^default externalDependencies bound"
  - "nx test angular-typechecker-cache-e2e --skip-nx-cache -> 2 files / 6 tests passed, exit 0 (SC3 + parity)"
  - "git diff --exit-code -- libs/typecheck-consumer-dep -> exit 0 (crash-safe revert held)"
  - "nx lint angular-typechecker --skip-nx-cache -> exit 0 (1 pre-existing out-of-scope warning)"
  - "nx show projects -> all 4 fixtures/e2e discovered as main-graph projects"
---

# Phase 4: Nx Executor Adapter + Cacheable Target Verification Report

**Phase Goal:** A thin Nx executor wraps the core as the first user-runnable surface and runs as any Angular project's target, shipped as a CommonJS executor that loads ESM compiler-cli via `import()` with no downlevel, and made Nx-cacheable with inputs proven correct by a dependency-error-busts-cache test.

**Verified:** 2026-06-28T14:10:00Z
**Status:** passed
**Re-verification:** No -- initial verification
**Mode note:** Phase `mode: mvp` in ROADMAP, but the phase goal is a technical contract, not a User Story ("As a... I want... so that..."). Standard goal-backward verification applied (the goal is observably testable in the codebase); the User Flow Coverage table format does not fit a build-tooling phase with no end-user UI flow.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | A sub-50-line `angular-typecheck` executor (ExecutorContext -> CoreOptions -> runTypecheck -> {success}); `nx run` produces same diagnostics as core; CJS that loads ESM compiler-cli via dynamic `import()` (no downlevel at RUNTIME) | VERIFIED | `executor.ts` = 62 lines / 37 non-comment-code lines, composes normalizeOptions -> runTypecheck -> renderReport -> evaluateResult -> {success}. Build retains `import(` (compiler-loader.js=1, render-report.js=2), NO `require("typescript")`/`require("@angular/compiler-cli")` downlevel. RUNTIME proof: `executor-parity.int.spec.ts` real `nx run typecheck-consumer:angular-typecheck` returns TS2322 with no `ERR_REQUIRE_ESM` (passed). Parity: executor `{success}` === (core `errorCount===0`) AND code sets match, both green + injected states (passed). |
| SC2 | Executor target Nx-cacheable (cache:true, outputs:[]) with per-tsconfig inputs + dep-source filesets for non-buildable deps + dependentTasksOutputFiles + externalDependencies:['typescript','@angular/compiler-cli']; verified via `nx show target inputs --check` | VERIFIED | `nx show project typecheck-consumer --json`: resolved target has `cache:true`, `outputs:[]`, 7 inputs incl. `^default`, `externalDependencies:['typescript','@angular/compiler-cli']`, `dependentTasksOutputFiles`. `nx show target inputs ... --check <dep file>` exits 0 + `is an input` line. See "Reasoned deviation" below re `^default` vs ROADMAP's `^production`. |
| SC3 | Dedicated dep-error-busts-cache test: green run, type change injected into transitive SOURCE dep, does NOT cache-hit on re-run, reports the new error | VERIFIED | `cache-busts-on-dep-error.int.spec.ts` ran LIVE (exit 0): R1 pre-flight (blocking) + green run #1 (exit 0) -> run #2 CACHE HIT (marker present, exit 0) -> inject TS2322 into dep SOURCE -> run #3 CACHE MISS (marker absent + `TS2322` reported + non-zero exit). Observed actual output: `dep.component.ts:11:9 - error TS2322: Type 'string' is not assignable to type 'number'` + `Running target angular-typecheck for project typecheck-consumer failed`. |

**Score:** 3/3 ROADMAP success criteria verified.

### Plan Must-Have Truths (cross-checked against codebase)

| Plan | Truth | Status | Evidence |
|------|-------|--------|----------|
| 04-01 | Sub-50-line executor composes normalize -> runTypecheck -> renderReport -> evaluateResult -> {success} | VERIFIED | executor.ts read; 37 code lines |
| 04-01 | renderReport core seam loads ng+ts internally, delegates to formatReport | VERIFIED | render-report.ts read; loadCompilerCli + private loadTypescript -> formatReport |
| 04-01 | normalizeOptions resolves rel tsConfig to abs via joinPathFragments, splits reporter knobs | VERIFIED | normalize-options.ts read; isAbsolute + joinPathFragments(context.root, ...) |
| 04-01 | Executor catches TypecheckInfrastructureError, re-throws all others | VERIFIED | executor.ts catch block: instanceof -> logger.error+{success:false}; else `throw error` |
| 04-01 | schema.json: tsConfig req + includeDeps + maxWarnings (no default) + failFast + version 2; schema.d.ts lockstep | VERIFIED | schema.json read (4 props, version 2, additionalProperties false, maxWarnings has NO default); schema.d.ts matches |
| 04-01 | executors.json declares outputCapture direct-nodejs | VERIFIED | executors.json read; `"outputCapture": "direct-nodejs"` |
| 04-02 | nx.json cacheable default keyed by executor id, cache:true, outputs:[], D-08 inputs recipe | VERIFIED | nx.json read; both published-name + workspace-scoped keys present with `^default` recipe |
| 04-02 | tsconfig.base.json @fixtures/typecheck-consumer-dep -> SOURCE alias | VERIFIED | tsconfig.base.json read; relative `./libs/...` (TS5090 fix held) |
| 04-02 | typecheck-consumer-dep NON-buildable committed Angular lib, real main-graph project | VERIFIED | project.json `targets:{}` (no build); `nx show projects` lists it |
| 04-02 | typecheck-consumer carries angular-typecheck target, imports dep via @fixtures alias | VERIFIED | project.json target + consumer.component.ts static import of depLabel |
| 04-02 | consumer->dep edge forms; `nx show target inputs --check` exit 0 | VERIFIED | R1 guard re-run LIVE: exit 0 + `is an input` |
| 04-02 | .pristine sidecar byte-identical for crash-safe revert | VERIFIED | byte-compare: identical, 810 bytes |
| 04-03 | Dedicated serialized cache-e2e Nx project (singleFork, no parallelism, testTimeout>=180000, node env) | VERIFIED | vitest.config.mts read; all knobs present; project.json @nx/vitest:test |
| 04-03 | Cache test proves HIT then MISS+new diagnostic+non-zero exit | VERIFIED | e2e ran LIVE, 6/6 tests passed (see SC3) |
| 04-03 | R1 pre-flight blocking in spec (execSync --check, exit 0) | VERIFIED | spec read + test passed |
| 04-03 | Crash-safe revert: .pristine heal + finally byte-restore + CI git-diff backstop; never dirty | VERIFIED | spec read (healFromPristine, no git checkout); `git diff --exit-code -- libs/typecheck-consumer-dep` exit 0 after run |
| 04-03 | In-process runExecutor parity: {success}===core AND code set===core, both states | VERIFIED | executor-parity.int.spec.ts read + 2 parity tests passed |
| 04-03 | >=1 real execSync nx run proves EXE-01 + EXE-07 (no ERR_REQUIRE_ESM) | VERIFIED | real nx run test passed; asserts no ERR_REQUIRE_ESM + TS2322 + non-zero exit |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/angular-typechecker/src/core/render-report.ts` | renderReport seam | VERIFIED | loadCompilerCli + private loadTypescript -> formatReport; no @nx/devkit import |
| `.../executors/angular-typecheck/normalize-options.ts` | pure rel->abs mapper | VERIFIED | joinPathFragments; only isAbsolute from node:path |
| `.../executors/angular-typecheck/executor.ts` | completed adapter | VERIFIED | full composition + infra-catch + re-throw; raw stdout |
| `.../executors/angular-typecheck/schema.json` | v0.0.1 contract | VERIFIED | 4 props, version 2, maxWarnings no default, additionalProperties false |
| `packages/angular-typechecker/executors.json` | outputCapture direct-nodejs | VERIFIED | present |
| `nx.json` | executor-id-keyed cacheable default | VERIFIED | dual-key (published + workspace-scoped) both bound, ^default recipe |
| `tsconfig.base.json` | @fixtures alias to source | VERIFIED | relative path |
| `libs/typecheck-consumer-dep/**` | non-buildable dep + .pristine | VERIFIED | no build target, private, byte-identical sidecar |
| `libs/typecheck-consumer/**` | consumer w/ target + includeDeps:true | VERIFIED | target + includeDeps:true (Deviation 2 fix) |
| `e2e/angular-typechecker-cache-e2e/**` | serialized cache-e2e project + 2 int specs | VERIFIED | project + config + both specs; 6/6 tests pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| executor.ts | core/render-report.ts | import + await renderReport | WIRED | imported + called |
| render-report.ts | core/format-report.ts | delegates with injected ng/ts | WIRED | formatReport called |
| index.ts | core/render-report.ts | barrel export | WIRED | `export { renderReport }` (loadTypescript NOT leaked) |
| consumer.component.ts | @fixtures/typecheck-consumer-dep | static import (forms Nx edge) | WIRED | R1 guard exit 0 proves edge |
| nx.json targetDefault | dep source files | ^default expansion | WIRED | --check + cache MISS prove dep source is hashed |
| consumer/project.json | tsconfig.lib.json | angular-typecheck tsConfig option | WIRED | resolved target shows tsConfig |
| cache spec | .pristine sidecar | beforeAll heal + finally byte-restore | WIRED | revert held (git diff clean) |
| parity spec | runExecutor + runTypecheck | structured parity | WIRED | both tests pass |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Produces Real Data | Status |
|----------|------|--------|--------------------|--------|
| executor.ts report | renderReport(result) | runTypecheck -> real performCompilation diagnostics | Yes (real TS2322 observed in live nx run) | FLOWING |
| cache MISS verdict | nx run exit code + stdout | real Nx CLI + cache + graph | Yes (real `failed` + TS2322) | FLOWING |
| nx.json cache inputs | ^default + externalDependencies | resolved via Rust hasher (--check exit 0) | Yes (dep source provably in hash) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Plugin builds, import() survives | `nx build ... --skip-nx-cache` + rg import( | exit 0; import( retained; no require downlevel | PASS |
| Unit suite green | `nx test angular-typechecker --skip-nx-cache` | 20 files / 99 tests passed | PASS |
| R1 edge guard (SC2) | `nx show target inputs ... --check <dep>` | exit 0 + "is an input" | PASS |
| Cache config bound (SC2) | `nx show project typecheck-consumer --json` | cache:true, outputs:[], 7 inputs, ^default, externalDependencies | PASS |
| Cache HIT/MISS gate (SC3) | `nx test angular-typechecker-cache-e2e --skip-nx-cache` | 2 files / 6 tests passed; TS2322 surfaced on MISS | PASS |
| Crash-safe revert | `git diff --exit-code -- libs/typecheck-consumer-dep` | exit 0 (clean) | PASS |
| Module boundary (WS-04) | `nx lint angular-typechecker --skip-nx-cache` | exit 0 (1 pre-existing out-of-scope warning) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| EXE-01 | 04-01, 04-03 | angular-typecheck executor wraps core, settable as any project's target | SATISFIED | executor.ts + consumer target + real nx run + parity tests |
| EXE-06 | 04-02 | Nx-cacheable target (cache:true, outputs:[], correct inputs + externalDependencies) | SATISFIED | nx.json recipe bound; --check exit 0; cache HIT/MISS proven |
| EXE-07 | 04-01, 04-03 | CJS executor loads ESM compiler-cli via import() with no downlevel | SATISFIED | build-time import( survival + runtime nx run no ERR_REQUIRE_ESM |
| TEST-04 | 04-03 | dependency-error-busts-cache correctness test | SATISFIED | cache-busts-on-dep-error.int.spec.ts passed live, both edges + R1 |

No orphaned requirements: all 4 phase IDs (EXE-01, EXE-06, EXE-07, TEST-04) are claimed by plans and verified. REQUIREMENTS.md maps exactly these 4 to Phase 4 and marks them Complete.

### Reasoned Deviation (NOT a gap)

**SC2 wording:** ROADMAP SC2 reads `^production`/`^{projectRoot}` dependency-source filesets. The implementation uses `^default` (CONTEXT D-08, `[panel: changed from research's ^production]`). This is an intentional, reasoned strengthening, NOT a gap:
- `^default` is a SUPERSET of `^production` (default includes test files; production excludes them).
- For a correctness gate, over-invalidation is the safe direction: a change to a dep file that `production` EXCLUDES still busts a whole-program check.
- The SC2 intent ("dep-source filesets for non-buildable deps so the cache busts on a dep source change") is fully satisfied -- and proven live by the R1 `--check` guard + the cache-MISS test (the dep TS2322 surfaced and exit was non-zero).
- The deviation is documented in CONTEXT D-08 and both 04-02 + 04-03 SUMMARYs. No override entry required: the criterion's intent is met more strictly.

### Documented Deviations Confirmed Held

1. **Dual-key targetDefaults (04-03 Dev 1):** Both `angular-typechecker:angular-typecheck` (published name) and `@angular-typechecker/angular-typechecker:angular-typecheck` (workspace-scoped) keys present in nx.json. The workspace-scoped key is what BINDS in-dev (consumer references it). Verified: resolved target shows cache:true + 7 inputs -> caching is LIVE (the CACHE HIT test passed, which is impossible if the default did not bind). Phase-5 hand-off note (README must use published-name key) recorded in 04-03 SUMMARY.
2. **includeDeps:true on consumer (04-03 Dev 2):** Without it, the out-of-project non-buildable dep diagnostic is silently suppressed by the Phase-3 boundary filter -> the MISS case would be a FALSE PASS (a lying cache). Verified: consumer/project.json has `includeDeps:true`; the live cache-MISS test surfaced TS2322 (not suppressed) with a non-zero exit. This closes the second false-PASS hole.
3. **TS5090 relative-alias fix (04-02):** tsconfig.base.json alias value is `./libs/...` (relative). Full unit suite green (99 tests) confirms no inherited TS5090 options diagnostic leaks into other fixtures.
4. **Nested-nx env isolation (04-03 Dev 3):** buildCleanEnv strips NX_SKIP_NX_CACHE + forked-runner vars in both specs. Verified: the cache HIT assertion passed under `nx test ... --skip-nx-cache` (only possible if the nested run is a clean top-level invocation).

### Anti-Patterns Found

None. No TODO/FIXME/XXX/HACK/PLACEHOLDER debt markers in any phase-modified file. No stub patterns. The benign `Failed to load the ES module: ...executor.ts` warning on every nx run is the documented dev-workspace behavior (executor resolves from SOURCE via the local plugin graph; Nx falls back to CJS require and runs correctly -- confirmed by the EXE-07 runtime test passing with no ERR_REQUIRE_ESM). Not a defect.

### Human Verification Required

None. Every success criterion is programmatically verifiable and was verified by re-running the gates in this verifier's own process (not trusting SUMMARY claims): build + import() survival, unit suite, R1 --check guard, resolved cache config, the cache HIT/MISS e2e (with the actual TS2322 diagnostic observed in output), crash-safe revert (git diff clean), and lint.

### Gaps Summary

No gaps. All 3 ROADMAP success criteria and all 8 plan must-have truth groups are VERIFIED against the actual codebase with live gate runs. The phase's central correctness concern -- a cache that lies (false PASS) -- is defended on both fronts the 04-03 SUMMARY claimed to fix, and both fixes were independently confirmed: (1) the cache config genuinely binds (CACHE HIT proven live), and (2) the dep source error genuinely surfaces (TS2322 + non-zero exit proven live, not suppressed). The crash-safe revert held (working tree clean). The first user-runnable surface exists, runs as a real Angular project target via `nx run`, and loads ESM compiler-cli through the compiled CJS executor at runtime with no downlevel.

---

_Verified: 2026-06-28T14:10:00Z_
_Verifier: Claude (gsd-verifier)_
