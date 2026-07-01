---
phase: 04-nx-executor-adapter-cacheable-target
plan: 03
subsystem: testing
tags: [nx-cache, nx-executor, vitest, execSync, runExecutor, cjs-esm, cache-correctness, integration-e2e]

# Dependency graph
requires:
  - phase: 04-nx-executor-adapter-cacheable-target
    provides: "the completed angular-typecheck executor (04-01) + the executor-id-keyed cacheable targetDefault, the @fixtures alias, the two committed Angular-lib fixtures, and the .pristine sidecar (04-02)"
  - phase: 03-filtering-modes-output-quality-gates
    provides: "the project-boundary filter (includeDeps switch) that governs whether an out-of-project dep diagnostic is reported"
provides:
  - "A dedicated, fully serialized cache-e2e Nx project (e2e/angular-typechecker-cache-e2e) with its own Vitest config (node env, singleFork, fileParallelism false, sequence.concurrent false, testTimeout 180000) -- isolated from the parallel plugin unit pool (D-14)"
  - "The TEST-04 cache HIT/MISS correctness gate: green run #1 -> run #2 CACHE HIT (marker present, exit 0) -> inject a dep-source TS2322 -> run #3 CACHE MISS (marker absent) + new diagnostic + non-zero exit, with the R1 --check edge guard as a BLOCKING pre-flight (D-10/D-12/D-13)"
  - "Crash-safe revert proven (D-15): .pristine heal in beforeAll/afterEach + a finally byte-restore + a CI git-diff backstop; the fixture is never left dirty"
  - "EXE-01/D-16 parity: in-process runExecutor { success } === core errorCount===0 AND code set === core codes, in BOTH green and injected-error states (structured, not stdout)"
  - "EXE-07/D-05 runtime proof: a real nx run returns real TS/NG diagnostics through the compiled CJS executor with no ERR_REQUIRE_ESM"
  - "Nested-nx isolation pattern: strip NX_SKIP_NX_CACHE + the forked-runner env vars so a nested nx run is a clean top-level invocation (otherwise the cache gate is dead)"
affects: [05-packaging-publish, 06-e2e-matrix]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dedicated serialized integration/e2e Nx project for shell-out (execSync nx) + in-process runExecutor harnesses: own Vitest config diverging from the unit tier on EVERY parallelism knob (D-14)"
    - "Nested-nx env isolation: a buildCleanEnv helper that deletes NX_SKIP_NX_CACHE/NX_TASK_HASH/NX_FORKED_TASK_EXECUTOR/etc. before execSync, so the nested nx run is not marked 'inner' nor forced --skip-nx-cache by the outer test task"
    - "Cache-correctness gate: assert the cache-hit STATIC summary marker + exit code + the new diagnostic code (defense-in-depth, all three) on the green-then-broken transition; never inspect .nx/cache internals"
    - "runExecutor in-process parity: build the ExecutorContext from the REAL project graph (createProjectGraphAsync + readProjectsConfigurationFromProjectGraph), read nx.json via readFileSync (NOT the Tree-arg readNxJson overload)"
    - "Crash-safe fixture mutation: .pristine sidecar heal + finally byte-restore (preserve EOL), never git checkout"

key-files:
  created:
    - e2e/angular-typechecker-cache-e2e/project.json
    - e2e/angular-typechecker-cache-e2e/vitest.config.mts
    - e2e/angular-typechecker-cache-e2e/tsconfig.json
    - e2e/angular-typechecker-cache-e2e/tsconfig.spec.json
    - e2e/angular-typechecker-cache-e2e/src/cache-busts-on-dep-error.int.spec.ts
    - e2e/angular-typechecker-cache-e2e/src/executor-parity.int.spec.ts
  modified:
    - nx.json
    - libs/typecheck-consumer/project.json

key-decisions:
  - "D-14: dedicated serialized cache-e2e project (node env, singleFork, no parallelism, testTimeout 180000), separate from the plugin unit test project"
  - "D-12/D-13: cache HIT asserts the static marker 'Nx read the output from the cache instead of running the command'; cache MISS asserts marker ABSENT + TS2322 + non-zero exit (all three)"
  - "D-10: R1 --check edge guard runs as a BLOCKING pre-flight via execSync (throws on exit 1); assert 'is an input' (ASCII), no head/rg pipe"
  - "D-15: crash-safe revert via the .pristine sidecar heal + finally byte-restore; NEVER git checkout; CI git-diff backstop"
  - "D-16: parity asserts STRUCTURED executor success + diagnostic codes vs the core in both states; runExecutor in-process + one real execSync nx run"
  - "Nested-nx isolation (Rule 3): strip NX_SKIP_NX_CACHE + forked-runner env vars before the nested nx run -- without it every nested run is a cache-miss and the HIT assertion can never pass"
  - "04-02 hand-off honored: FORCE_COLOR=0 (and NO_COLOR via env semantics), NOT the --no-color CLI flag the executor schema rejects"

patterns-established:
  - "Serialized e2e project for nx-CLI-shelling harnesses (D-14)"
  - "Nested-nx env isolation (buildCleanEnv strips the outer runner's NX_* vars)"
  - "Green-then-broken cache-correctness gate with defense-in-depth assertions"
  - "Crash-safe fixture mutation via .pristine sidecar + finally byte-restore"

requirements-completed: [TEST-04, EXE-01, EXE-07]

# Metrics
duration: 15min
completed: 2026-06-28
---

# Phase 4 Plan 03: Cache-Correctness Vertical Slice Summary

**A dedicated serialized cache-e2e Nx project proves the executor cache does NOT lie: a green run caches a HIT, then a TS2322 injected into a non-buildable transitive dep busts the cache (MISS) and surfaces the new diagnostic with a non-zero exit -- plus EXE-01 parity (runExecutor === core) and EXE-07 (real NG/TS diagnostics through the compiled CJS executor, no ERR_REQUIRE_ESM).**

## Performance

- **Duration:** ~15 min (after the verified spike work that uncovered two blocking prerequisites)
- **Started:** 2026-06-28T11:41:09Z
- **Tasks:** 3 + 1 prerequisite fix commit
- **Files:** 8 (6 created, 2 modified)

## Accomplishments

- Scaffolded `e2e/angular-typechecker-cache-e2e` as a real, discoverable, FULLY SERIALIZED main-graph Nx project (D-14): own `vitest.config.mts` with `environment: 'node'`, `pool: 'forks'` + `singleFork: true`, `fileParallelism: false`, `sequence.concurrent: false`, `testTimeout/hookTimeout: 180000`; a single `@nx/vitest:test` target; `implicitDependencies` on the plugin + both fixtures.
- Authored the TEST-04 gate (`cache-busts-on-dep-error.int.spec.ts`): a BLOCKING R1 `nx show target inputs --check` pre-flight (the consumer->dep edge exists), then the green-then-broken transition -- green run #1 (exit 0) -> run #2 CACHE HIT (the static marker present, exit 0) -> inject a TS2322 into `depLabel`'s body -> run #3 CACHE MISS (marker absent + TS2322 + non-zero exit, defense-in-depth) -> plus a `--skip-nx-cache` anti-lying-cache differential. Crash-safe revert via the `.pristine` heal + `finally` byte-restore.
- Authored the EXE-01/EXE-07 proof (`executor-parity.int.spec.ts`): in-process `runExecutor` (context built from the REAL project graph) asserts executor `{ success }` === (core `errorCount === 0`) AND the structured diagnostic-code set === the core's, in BOTH the green and injected-error states; plus ONE real `execSync('nx run typecheck-consumer:angular-typecheck --skip-nx-cache')` proving real TS diagnostics come back through the compiled CJS executor at runtime with no `ERR_REQUIRE_ESM`.
- Full phase suite green: `nx build angular-typechecker` (GATE A import() retained), `nx test angular-typechecker` (20 files / 99 tests), `nx test angular-typechecker-cache-e2e` (2 files / 6 tests). `git diff --exit-code -- libs/typecheck-consumer-dep` clean after the run.

## Task Commits

1. **Prerequisite fix: bind cacheable target default + surface dep errors** - `d278b68` (fix) [Rule 1 + Rule 2]
2. **Task 1: scaffold the serialized cache-e2e Nx project (D-14)** - `294847c` (feat)
3. **Task 2: TEST-04 cache HIT/MISS gate with crash-safe revert (D-10/D-12/D-13/D-15)** - `b2e4df1` (feat)
4. **Task 3: executor parity + real nx run proof (D-16/D-05/EXE-01/EXE-07)** - `bbd3522` (feat)

**Plan metadata:** (this docs commit)

## Files Created/Modified

- `e2e/angular-typechecker-cache-e2e/project.json` - Single `@nx/vitest:test` target; `implicitDependencies` on the plugin + fixtures; `scope:fixture`.
- `e2e/angular-typechecker-cache-e2e/vitest.config.mts` - The D-14 serialized config (node env, singleFork, no parallelism, 180000 timeout).
- `e2e/angular-typechecker-cache-e2e/tsconfig.json` + `tsconfig.spec.json` - Solution + spec tsconfigs for the int specs.
- `e2e/angular-typechecker-cache-e2e/src/cache-busts-on-dep-error.int.spec.ts` - The TEST-04 HIT/MISS correctness gate + R1 guard + anti-lying-cache differential.
- `e2e/angular-typechecker-cache-e2e/src/executor-parity.int.spec.ts` - EXE-01/D-16 parity (runExecutor) + the EXE-07/D-05 real-nx-run runtime proof.
- `nx.json` - Added the workspace-scoped executor-id key `@angular-typechecker/angular-typechecker:angular-typecheck` (prerequisite fix; see Deviations).
- `libs/typecheck-consumer/project.json` - Set `includeDeps: true` on the angular-typecheck target (prerequisite fix; see Deviations).

## Decisions Made

- The injected error is a TS2322 placed INSIDE `depLabel`'s body (a value the consumer exercises) -- built via `JSON.stringify('str')` to avoid any quote-escaping hazard and keep the source ASCII-only. A standalone unused `const __atc_bust` appended to the file was tried first but its error was suppressed/unreliable; the in-program `depLabel` mutation is the robust landing site.
- The parity oracle uses `runTypecheck({ ..., includeDeps: true })` to match the consumer target's `includeDeps: true`; the core IS what the executor delegates to, so it is a faithful structured oracle for both states.
- The optional `require()`-the-built-executor int test (Open Q5) was NOT added: the real `nx run` proof already exercises the compiled CJS executor at runtime end-to-end (a stronger EXE-07 signal than a bytes-only require), and the in-process `runExecutor` parity covers the executor verdict. The belt-and-braces test would add dist-coupling for marginal value.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The cacheable target default was never binding -- caching was effectively OFF**
- **Found during:** Spike before Task 1 (verifying the cache HIT marker)
- **Issue:** The 04-02 `nx.json` `targetDefaults` entry was keyed `angular-typechecker:angular-typecheck` (the PUBLISHED package name). But the dev-workspace fixture target references the executor via the tsconfig path-alias scope `@angular-typechecker/angular-typechecker:angular-typecheck`. `targetDefaults` match on the EXACT executor id, so the default never bound: `nx show project typecheck-consumer` resolved the target with `cache` undefined / no `inputs`, and EVERY run was a `cache-miss` (`run.json` `cacheStatus`). The cache-hit marker could never appear -> the TEST-04 HIT assertion would have been impossible.
- **Fix:** Added the workspace-scoped executor-id key `@angular-typechecker/angular-typechecker:angular-typecheck` alongside the published-name key (both carry the identical D-08 `^default` recipe, so the published-consumer README guidance stays valid). Verified the target now resolves with `cache: true`, `outputs: []`, 7 inputs, and the 2nd green run is a `local-cache-hit` with the marker present.
- **Files modified:** `nx.json`
- **Verification:** `nx show project typecheck-consumer --json` shows `cache: true` + 7 inputs; the HIT/MISS spec passes.
- **Committed in:** `d278b68`

**2. [Rule 2 - Missing Critical] The injected dep error was silently suppressed -> the MISS case would be a false PASS (a lying cache)**
- **Found during:** Spike before Task 2 (verifying the MISS case surfaces the error)
- **Issue:** The non-buildable dep lives in a SIBLING project root (`libs/typecheck-consumer-dep`), so its diagnostics are OUT OF PROJECT for the consumer's leaf-tsconfig boundary filter (Phase-3 D-05/D-06) and are SILENTLY SUPPRESSED by default. An injected dep error produced exit 0 / `Successfully ran` -- the exact "type-checker that lies" failure TEST-04 exists to prevent. The consumer target as committed in 04-02 could not actually demonstrate the dep-error-busts-cache behavior.
- **Fix:** Set `includeDeps: true` on the consumer's `angular-typecheck` target, folding the inlined non-buildable dep source back into the reported set. This is the realistic whole-program configuration for catching errors in non-buildable transitive deps (the phase's purpose). Verified: with `includeDeps:true` the injected TS2322 surfaces with exit 1.
- **Files modified:** `libs/typecheck-consumer/project.json`
- **Verification:** the MISS case reports TS2322 + non-zero exit; the parity oracle (also `includeDeps:true`) matches.
- **Committed in:** `d278b68`

**3. [Rule 3 - Blocking] The nested `nx run` inherited the outer test's `NX_SKIP_NX_CACHE` and never cached**
- **Found during:** Task 2 (the HIT assertion failed inside Vitest while passing identically via plain node)
- **Issue:** Running under `nx run <cache-e2e>:test`, the outer Nx runner injects env vars into the test process -- crucially `NX_SKIP_NX_CACHE=true` (set whenever the outer test task itself ran with `--skip-nx-cache`) plus `NX_TASK_HASH`/`NX_FORKED_TASK_EXECUTOR`/`NX_INVOCATION_ROOT_PID`. A naive `...process.env` propagated `NX_SKIP_NX_CACHE` into the nested `nx run`, so every nested run was a `cache-miss` and the CACHE HIT assertion could never pass (the gate would be dead). Run #1 and run #2 had an IDENTICAL hash yet both were misses -- the cache was never read back.
- **Fix:** A `buildCleanEnv` helper deletes the outer-runner `NX_*` vars before `execSync`, making the nested `nx run` a clean top-level invocation regardless of how the outer test is invoked. Applied in both int specs.
- **Files modified:** `e2e/angular-typechecker-cache-e2e/src/cache-busts-on-dep-error.int.spec.ts`, `executor-parity.int.spec.ts`
- **Verification:** with the strip, run #2 is `local-cache-hit` with the marker; both specs pass even when the outer `nx test` is invoked with `--skip-nx-cache`.
- **Committed in:** `b2e4df1` (cache spec) + `bbd3522` (parity spec)

**4. [Rule 3 - Blocking] runExecutor needed the real project graph + a non-Tree readNxJson**
- **Found during:** Task 3 (runExecutor parity)
- **Issue:** (a) An empty `projectsConfigurations.projects` map made `runExecutor` throw `Could not find project "typecheck-consumer"`. (b) The devkit `readNxJson()` resolved to the Tree-arg overload and threw `Cannot read properties of undefined (reading 'exists')` when called with no Tree.
- **Fix:** Build the `ExecutorContext` from the REAL graph via `createProjectGraphAsync` + `readProjectsConfigurationFromProjectGraph`; read `nx.json` via `readFileSync` + `JSON.parse` instead of the Tree-arg `readNxJson`.
- **Files modified:** `e2e/angular-typechecker-cache-e2e/src/executor-parity.int.spec.ts`
- **Verification:** both parity tests pass; `runExecutor` runs the executor in-process and returns the correct `{ success }` in both states.
- **Committed in:** `bbd3522`

---

**Total deviations:** 4 auto-fixed (1 bug, 1 missing-critical, 2 blocking)
**Impact on plan:** Deviations 1 and 2 were load-bearing prerequisites carried (latent) from 04-02 -- without them the central correctness gate this plan exists to build was impossible (a non-binding cache config and a suppressed dep error are exactly the two ways the cache could "lie"). Deviations 3 and 4 are test-harness mechanics for nested-nx-under-Vitest. No scope creep; all four are necessary for correctness.

## Issues Encountered

- The static cache-hit summary marker (`Nx read the output from the cache instead of running the command`) is emitted by the run-many/static SUMMARY lifecycle; it appears on a single-target `nx run` once caching is actually live. The earlier "no marker" symptom was a downstream consequence of Deviation 1 (caching off), not a wrong marker -- confirmed by reading `run.json` `cacheStatus` during the spike.
- A benign ESM-load warning prints on every `nx run` because the executor resolves from SOURCE (`executor.ts`) via the local plugin graph; Nx falls back to the CJS require path and the executor runs correctly (the real-nx-run EXE-07 test confirms no `ERR_REQUIRE_ESM`). This is the 04-02-noted dev-workspace behavior, not a defect.

## Threat Surface

No new security-relevant surface beyond the plan's `<threat_model>`.
- **T-04-08 (harness leaves injected error committed):** mitigated -- `.pristine` heal (`beforeAll`/`afterEach`) + `finally` byte-restore + the CI `git diff --exit-code -- libs/typecheck-consumer-dep` backstop, all verified clean after the run; never `git checkout`; the mutated file is a non-`.spec` source the Vitest include glob ignores.
- **T-04-09 (lying cache):** mitigated -- the green-then-broken transition asserts CACHE MISS + the new diagnostic + non-zero exit; the R1 `--check` pre-flight proves the dep source is hashed; defense-in-depth, all three signals required. Deviations 1+2 closed the two latent holes that would have made the cache lie.
- **T-04-10 (command injection into execSync):** mitigated -- the nx command is built from a FIXED target id + fixed flags + committed-constant fixture paths; the injected error literal is built via `JSON.stringify`; no untrusted string reaches the shell.
- **T-04-11 (non-deterministic races):** mitigated -- the D-14 serialization (singleFork, no parallelism, per-run tmp `NX_CACHE_DIRECTORY`, `NX_DAEMON=false`) + the nested-nx env strip + the D-17 main-tree run.
- **T-04-12 (swallowed executor error -> false PASS):** the parity test confirms executor verdict === core verdict in both states; a swallowed error would surface as a parity mismatch.
- No package installs (T-04-SC N/A).

## Threat Flags

None -- no new network endpoints, auth paths, file-access patterns, or trust-boundary schema changes introduced beyond the plan's threat model.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TEST-04 / EXE-01 / EXE-07 are proven end-to-end through the real Nx CLI + cache + project graph. The executor is the first user-runnable surface and its cache is now demonstrably honest.
- **Hand-off to Phase 5 (packaging):** the published-consumer `targetDefaults` recipe must be keyed by the PUBLISHED executor id `angular-typechecker:angular-typecheck` (the workspace-scoped `@angular-typechecker/angular-typechecker:...` key is a DEV-WORKSPACE-only artifact of the tsconfig path alias and must NOT leak into the README/consumer guidance). Document `includeDeps: true` as the recipe for catching non-buildable transitive-dep errors. Ensure the cache-e2e fixtures + `libs/*` never leak into the tarball (`files` allowlist).
- **Hand-off to Phase 6 (e2e matrix):** the buildable/publishable-dep `dependentTasksOutputFiles` path is still un-exercised (free config in the recipe); the full 5-project-type matrix + pnpm + mixed-case remain Phase-6 scope.

## Self-Check: PASSED

All 6 created config/spec files + the SUMMARY exist on disk; all 4 commits (`d278b68`, `294847c`, `b2e4df1`, `bbd3522`) exist in git history. Verification gates re-run green: `nx build angular-typechecker` succeeded (GATE A import() retained); `nx test angular-typechecker` 20 files / 99 tests passed; `nx test angular-typechecker-cache-e2e` 2 files / 6 tests passed; `git diff --exit-code -- libs/typecheck-consumer-dep` clean.

---
*Phase: 04-nx-executor-adapter-cacheable-target*
*Completed: 2026-06-28*
