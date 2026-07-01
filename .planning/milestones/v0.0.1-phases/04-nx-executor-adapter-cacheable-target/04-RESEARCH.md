# Phase 4: Nx Executor Adapter + Cacheable Target - Research

**Researched:** 2026-06-28
**Domain:** Nx 23 executor adapter (CJS-loads-ESM) + Nx task-cache input correctness for an Angular whole-program type-check
**Confidence:** HIGH (every load-bearing Nx behavior validated against the live installed toolchain in this workspace, not training data)

## Summary

This phase wraps the completed Phase-1-to-3 framework-agnostic `core/` as the first user-runnable surface: a thin `angular-typecheck` Nx executor, made Nx-cacheable with a correct input set, and proven correct by a dependency-error-busts-cache test. The decision set was already locked by an unusually rich, panel-hardened CONTEXT.md (D-01..D-17 + canonical_refs with file:line citations). This research does NOT re-derive those decisions. It (a) VALIDATES every load-bearing assumption against the live installed Nx 23.0.1 / @angular/compiler-cli 22.0.4 / TypeScript 6.0.3 / Vitest 4.1.9, (b) supplies the file-level implementation specifics the planner needs (signatures, exact JSON shapes, fixture construction, the cache-test harness), (c) resolves the open / Claude's-discretion items, and (d) provides the mandatory Validation Architecture (Nyquist) section.

The single most important live finding: **every assumption CONTEXT.md depends on holds on the installed toolchain.** `nx show target inputs --check` exists with the exact array-flag shape (`--check <file...>`), returns exit 0 + a `green ✓` line when the file is an input and exit 1 + a `red ✗` line when it is not. `analyzeSourceFiles` resolves to `true` in this workspace (because `@nx/angular`/`@nx/js`/`@nx/workspace` are root deps), so the `paths`-alias-to-source consumer->dep graph edge (D-10/D-11) forms automatically. The static single-target cache-hit marker is `Nx read the output from the cache instead of running the command for N out of M tasks.` (a superset of the substring CONTEXT.md cites; the cited prefix is a safe match). `runExecutor`, `joinPathFragments`, `logger.error/info`, and `outputCapture: "direct-nodejs"` are all present and valid.

One correction the planner MUST internalize: the D-10 guard's `exit 0` signal is real, but it is ONLY observable when the exit code is captured directly (or via `execSync`, which throws on non-zero). Piping the command through `| head`/`| rg` masks Nx's exit code with the pipe tail's exit code. Use `execSync` and catch, or capture `$?` immediately with no pipe.

**Primary recommendation:** Implement exactly as CONTEXT.md D-01..D-17 specify. Add the `renderReport` core seam (D-02) first as a compile-blocker, then complete the executor + `normalize-options`, wire the executor-id-keyed cacheable `targetDefaults` verbatim from the D-08 snippet, hand-author two committed `libs/` fixtures (no generator needed for a committed fixture), and put the `execSync`/`nx reset` cache test in a DEDICATED serialized integration project (its own Vitest config), running Phase 4 sequentially on the main tree (D-17).

## User Constraints (from CONTEXT.md)

> CONTEXT.md is the authority. The planner MUST honor these verbatim. This section reproduces the locked decisions, discretion areas, and deferred ideas. Where this research adds file-level HOW, it is tagged `[research]` and never overrides a locked decision.

### Locked Decisions (D-01 .. D-17)

**Executor adapter composition (EXE-01, EXE-07)**

- **D-01:** Complete the existing stub into a sub-50-line adapter via a hexagonal-lite split: `executor.ts` (default export) + a pure `normalize-options.ts`. Compose `normalizeOptions(options, context)` -> `runTypecheck(coreOptions)` -> `renderReport(...)` (write to stdout) -> `evaluateResult(result, { maxWarnings })` -> `{ success }`. Catch `TypecheckInfrastructureError` -> distinct `logger.error` meta message + `{ success: false }`; **RE-THROW any other error**. DROP ARCHITECTURE.md's `internal/exit-code.ts` (stale; `evaluateResult` IS the verdict). `normalize-options.ts` returns `{ coreOptions, maxWarnings, failFast, color }` so `CoreOptions` stays free of reporter-only knobs.
- **D-02 [compile-blocker]:** Add a NEW core seam `renderReport(result, { pathBase, color, failFast }): Promise<string>` exported from `core/`. Required because `formatReport` needs injected `ng`/`ts` that `runTypecheck` does NOT return and `loadTypescript` is NOT exported from the barrel. `renderReport` internally uses the memoized `loadCompilerCli()` + `loadTypescript()` and delegates to `formatReport`. Do NOT (a) add a `formatted` field to `CoreResult`, or (b) merely re-export `loadTypescript`. Maintainability acceptance test: the future CLI must be expressible in ~15 lines reusing `normalize`-equivalent + `runTypecheck` + `renderReport` + `evaluateResult` + `process.exit`.
- **D-03:** tsConfig resolution rule: `isAbsolute(options.tsConfig) ? options.tsConfig : joinPathFragments(context.root, options.tsConfig)` (WORKSPACE-root-relative). Use `joinPathFragments` (not `node:path.join`) for POSIX-separator stability on Windows arm64. Core requires an ABSOLUTE path and never reads `process.cwd()`. Document "tsConfig is resolved relative to the workspace root" in the README; unit-test both relative and absolute inputs.
- **D-04:** Write the `renderReport` string via `process.stdout.write(report)` (raw), NOT `logger.info`. Use `logger.error` ONLY for the infra-error meta message. The adapter computes `color = process.stdout.isTTY === true` and passes it into `renderReport` (core stays `process`-free). Set `"outputCapture": "direct-nodejs"` in `executors.json` NOW.
- **D-05:** EXE-07 runtime proof (NOT a repeat of Phase-1's build-time grep): a real `nx run <consumer>:angular-typecheck` through the compiled CJS executor returns real NG/template diagnostics. Do NOT register a custom hasher on the target (it voids the `nx show target inputs --check` guard).

**Executor schema (EXE-01; v0.0.1 public contract) - USER DECISION: ship all three**

- **D-06 [user: "Ship all three in Phase 4"]:** `schema.json` (v2, `cli: "nx"`, `additionalProperties: false`) properties:
  - `tsConfig` (string, **required**, a FLAG - never `$default` positional).
  - `includeDeps` (boolean, default `false`) - EXE-04.
  - `maxWarnings` (number, **NO json-schema default**; `undefined` = warnings never fail; `0` = fail on any warning; `evaluateResult` treats negative/NaN as unset) - EXE-05.
  - `failFast` (boolean, default `false`; description = "report only the first error (output brevity) - NOT a speed-up; all diagnostics are still gathered") - EXE-03.
  - camelCase names matching the core. Add `"version": 2` NOW. Keep `schema.json` + `schema.d.ts` in lockstep + add a key-parity unit test. NO `aliases`. Do NOT add a redundant `mode` enum.

**Cacheable target recipe (EXE-06)**

- **D-07:** Define the cacheable target via `nx.json` `targetDefaults` keyed by the EXECUTOR id `angular-typechecker:angular-typecheck`. `cache: true`, `outputs: []`. The plugin-author's OWN `nx.json` carries it (never published). README documents the FULL consumer recipe with inputs. `createNodesV2` inference deferred.
- **D-08:** The `inputs` recipe: `"production"`, `"{projectRoot}/tsconfig*.json"`, `"{projectRoot}/package.json"`, `"{workspaceRoot}/tsconfig.base.json"`, `"^default"`, `{ "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}", "transitive": true }`, `{ "externalDependencies": ["typescript", "@angular/compiler-cli"] }`. (Each line's rationale in CONTEXT.md D-08; the buildable-dep `dependentTasksOutputFiles` line stays as free config but is not proven until Phase 6.)
- **D-09:** Use the `^default`/`^production` INLINED-SOURCE model, NOT @nx/js's project-references model. Angular has no TS project-references support, so deps are inlined source and the dep SOURCE must be hashed (`^default`) + `externalDependencies` explicitly enabled.
- **D-10 [headline correctness guard]:** Residual hole R1 - the consumer->dep project-graph EDGE must exist for `^default` to reach a dep. Ensure `analyzeSourceFiles` + the `tsconfig.base.json` paths alias form the edge; declare `implicitDependencies` for any non-statically-analyzable edge. TEST-04 MUST assert the edge as a BLOCKING pre-flight with `nx show target inputs <consumer>:angular-typecheck --check <exact dep source file>` (exit 0 + a `✓` line, `NX_DAEMON=false`) BEFORE the dynamic test. A custom hasher voids this.

**TEST-04 dependency-error-busts-cache + fixture topology - USER DECISION: dedicated committed libs**

- **D-11 [user: "Dedicated committed libs"; panel-hardened]:** Two dedicated COMMITTED libs that are REAL main-workspace-graph projects: `libs/typecheck-consumer-dep` (NON-buildable Angular lib, NO `build` target - the critical cache case) and `libs/typecheck-consumer` (carries the `angular-typecheck` target and imports the dep). `tsconfig.base.json` paths alias `@fixtures/typecheck-consumer-dep` -> `libs/typecheck-consumer-dep/src/index.ts` (alias -> SOURCE). The injected error must land IN the consumer's program. Hygiene: `tags: ["scope:fixture"]` + module-boundary constraint, `"private": true` in each fixture `package.json`, namespaced alias.
- **D-12 [panel-hardened]:** Cache-hit assertion - substring-match the single-target STATIC summary marker `Nx read the output from the cache instead of running the command` (do NOT match dynamic-only tags `[local cache]`). Force determinism: `--output-style=static` + `execSync` (non-TTY) + `NX_DAEMON=false` + `FORCE_COLOR=0`/`--no-color`. Defense-in-depth, ALL required: static marker + exit code + new diagnostic code in stdout. Optional `--skip-nx-cache` differential. Do NOT inspect `.nx/cache` internals.
- **D-13:** Test sequence - `nx reset` (or fresh per-run `NX_CACHE_DIRECTORY`) -> green run #1 (baseline) -> green run #2 (assert CACHE HIT) -> inject a known error into the dep's committed SOURCE -> run #3 (assert NO cache marker + new diagnostic reported + non-zero exit) -> cleanup (D-15). The green-then-broken transition is load-bearing.
- **D-14 [determinism panel]:** Test harness placement - put the `execSync('nx ...')`/`nx reset` specs in a DEDICATED, serialized integration/e2e project (its own Vitest config: `pool: 'forks'`, `poolOptions.forks.singleFork: true`, `fileParallelism: false`, `sequence.concurrent: false`, `testTimeout >= 180000`), NOT in the plugin's unit `test` project. Use a per-run `NX_CACHE_DIRECTORY` (tmp) for the cold baseline; reserve `nx reset` for at most one `beforeAll`. The in-process `runExecutor`+core equivalence checks (D-16) stay in the fast unit tier.
- **D-15 [determinism panel]:** Crash-safe revert - NOT `git checkout`. Use: a committed PRISTINE sidecar of the mutated file + a `beforeAll` "fixture is pristine" heal + a `finally` byte-restore of the captured original content (preserve EOL) + a post-job `git diff --exit-code -- libs/typecheck-consumer-dep` CI backstop. Mutate a non-`.spec` source file the Vitest `include` glob will not pick up.
- **D-16 [determinism + API panel]:** EXE-01 demonstration shares the TEST-04 fixture; assert equivalence on STRUCTURED values, not rendered stdout. Assert (a) executor `{ success }` === (core `errorCount === 0`), and (b) executor reported diagnostic CODE set === `core diagnostics.map(d => d.code).sort()`, in BOTH green and injected-error states. Two tiers: `runExecutor` (programmatic, in-process) for parity + ONE real `execSync('nx run ...')` for discoverability. EXE-01's literal "nx run" wording requires >=1 real `nx run`.

**Sequencing**

- **D-17:** Run Phase 4 SEQUENTIALLY ON THE MAIN TREE (real `node_modules` + real graph + daemon). The `compiler-cli-types.ts` deep-import shim breaks `@nx/js:tsc` without `node_modules` at the package dir. The SC3 cache test is non-parallelizable and worktree-hostile. Creating `libs/*` invalidates the graph for any in-flight plan. If worktrees are used for the adapter/schema plans, the SC3 cache test MUST run on the main tree.

### Claude's Discretion (from CONTEXT.md)

- Exact fixture project names / `scope:fixture` label / alias string; the exact injected error code; whether the consumer is an app or a lib (research slight-leaned a lib for cleanliness - either works, as long as it is a real graph project carrying the target); the precise `renderReport` signature and whether `color` is a param vs derived; the exact `normalize-options` return shape; whether to ALSO add a `require()`-the-built-executor int test alongside the `nx run` runtime proof.
- Verify the non-buildable lib generator flags against `nx g @nx/angular:library --help` on 23.0.1 (do NOT copy the Nx 19.8 prior-art flags such as `--projectNameAndRootFormat`, removed) - or hand-author the fixture `project.json`/tsconfig/source.
- LIVE-verify (once the libs exist) that the paths-alias-to-source forms the consumer->dep graph edge in THIS `--preset=apps` workspace BEFORE relying on TEST-04.
- 5-min spike: confirm a nested `nx` call inside Vitest honors `NX_CACHE_DIRECTORY` before committing the D-14 harness plan.

> **Research resolutions to the discretion items are in `## Open Questions` and `## Code Examples` below.** Headlines: (1) graph-edge mechanism is verified-live to work (`analyzeSourceFiles: true`); (2) generator flags verified - prefer hand-authoring committed fixtures; (3) recommend the consumer be a non-buildable Angular **lib** for symmetry and to avoid an app `build` target muddying the graph; (4) `renderReport(result, { pathBase, color, failFast })` with `color` a required param (adapter derives it); (5) add the optional `require()`-the-built-executor int test - it is cheap insurance for EXE-07.

### Deferred Ideas (OUT OF SCOPE)

- **Phase-5 packaging hand-off (record now):** `nx.json` `release.projects: ["angular-typechecker"]`; plugin `files` allowlist (`["src","executors.json","README.md","LICENSE"]`); `tar -tf` tarball assertion that no `libs/`/`fixtures/`/`*.spec.ts`/`tsconfig.spec.json` leak; `attw --pack` must confirm no unresolved fixture-alias specifier in shipped `.d.ts`; README ships the FULL consumer `targetDefaults` recipe; verify `outputCapture: "direct-nodejs"` in the tarball.
- **Buildable/publishable lib fixture + `dependentTasksOutputFiles` PROOF + full 5-project-type matrix + pnpm + mixed-case** -> Phase 6 e2e. The `dependentTasksOutputFiles` line stays in the Phase-4 recipe (free config) but is not exercised by a buildable-dep test until Phase 6.
- **One e2e smoke against the packed tarball** -> Phase 5.
- **`createNodesV2` inference** -> deferred milestone. v0.0.1 uses manual `targetDefaults` + README wiring.
- **CLI bin / Angular builder / ng add / nx add** -> deferred milestones.
- **A `mode` enum** alongside `failFast` -> not in v0.0.1.

## Phase Requirements

| ID      | Description                                                                                                                                   | Research Support                                                                                                                                                                                                                                        |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EXE-01  | An `angular-typecheck` Nx executor wraps the core and can be set as any Angular project's target.                                             | D-01 composition; existing stub at `src/executors/angular-typecheck/executor.ts` is a real starting point; `runExecutor` (verified in devkit) + one real `execSync('nx run ...')` satisfy the demonstration (D-16).                                     |
| EXE-06  | The executor target is Nx-cacheable (`cache: true`, `outputs: []`, correct per-tsconfig + dependency-source inputs + `externalDependencies`). | D-07/D-08/D-09 verbatim `targetDefaults` snippet; all input object shapes confirmed valid in Nx 23.0.1 `InputDefinition`; `nx show target inputs --check` verified live (exit 0/1 + glyph).                                                             |
| EXE-07  | Shipped as a CommonJS executor that loads ESM compiler-cli via dynamic `import()` with no `import()`->`require()` downlevel.                  | GATE A (Phase 1) covers build-time half; D-05 runtime half = a real `nx run` returns NG diagnostics through the compiled CJS executor. The literal `import(` lives in built `core/compiler-loader.js` (verified), reached transitively by the executor. |
| TEST-04 | A dependency-error-busts-cache correctness test verifies a downstream type change invalidates the consumer's cache.                           | D-10..D-16; fixture topology, R1 edge guard (verified-live mechanism), cache-hit marker (exact string verified), crash-safe revert, dedicated serialized integration project.                                                                           |

## Architectural Responsibility Map

| Capability                                                   | Primary Tier                                            | Secondary Tier                                         | Rationale                                                                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| tsConfig path resolution (rel->abs)                          | Adapter (`normalize-options.ts`)                        | -                                                      | Only the adapter has `ExecutorContext.root`; core requires an absolute path and is `process`-free (D-03). |
| Option pass-through (`includeDeps`/`maxWarnings`/`failFast`) | Adapter (`normalize-options.ts`)                        | Core (`CoreOptions`/`EvaluateOptions`/`FormatOptions`) | camelCase pass-through; adapter splits reporter-only knobs out of `CoreOptions` (D-01/D-06).              |
| Whole-program diagnostic gathering                           | Core (`runTypecheck`)                                   | -                                                      | Already implemented Phase 2/3; unchanged.                                                                 |
| CJS->ESM compiler load                                       | Core (`compiler-loader.ts` + private `loadTypescript`)  | -                                                      | The memoized `await import()` lives in core; the `renderReport` seam keeps module-loading there (D-02).   |
| Human report rendering                                       | Core (`renderReport` -> `formatReport`)                 | -                                                      | D-02 seam supplies injected ng/ts that `formatReport` requires.                                           |
| Verdict (pass/fail)                                          | Core (`evaluateResult`)                                 | Adapter (maps to `{ success }`)                        | `evaluateResult` IS the verdict; adapter only maps the boolean (D-01).                                    |
| stdout/stderr/TTY                                            | Adapter (`process.stdout.write`, `logger.error`)        | -                                                      | Core stays `process`-free; adapter owns the output channel (D-04).                                        |
| Cache input correctness                                      | Nx config (`nx.json targetDefaults`)                    | -                                                      | Static globs + `^default` + `externalDependencies`; not code (D-07/D-08).                                 |
| Consumer->dep graph edge                                     | Nx project graph (`analyzeSourceFiles` + `paths` alias) | `implicitDependencies` fallback                        | The edge is what makes `^default` reach the dep source (D-10/D-11).                                       |

## Standard Stack

This phase adds NO new runtime/published dependencies. It uses only already-installed, already-locked toolchain packages. The "stack" here is the Nx/devkit surface the adapter and tests consume.

### Core (already installed - verified live in this workspace 2026-06-28)

| Library                 | Version (verified) | Purpose                                                                                       | Why Standard                                                                                                                                                                                                                             |
| ----------------------- | ------------------ | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nx`                    | 23.0.1             | Workspace runtime; `nx run`, `nx show target inputs --check`, `nx reset`, the cache           | [VERIFIED: node require of `nx/package.json`] Provides the executor loader (`require()`-based) + the Rust task hasher.                                                                                                                   |
| `@nx/devkit`            | 23.0.1             | `ExecutorContext` (type-only), `logger`, `joinPathFragments`, `runExecutor`                   | [VERIFIED: node `require('@nx/devkit')` - `logger.error/info/warn` present, `joinPathFragments` is a function, `runExecutor` is a function] The only `@nx/devkit` consumer is the adapter tier (type-only `ExecutorContext` + `logger`). |
| `@nx/vitest`            | 23.0.1             | `@nx/vitest:test` executor for both the unit tier and the dedicated cache-integration project | [VERIFIED: node require] Already wired for the plugin's `test` target.                                                                                                                                                                   |
| `vitest`                | 4.1.9              | Test runner (ESM, required for `runExecutor` + ESM compiler-cli)                              | [VERIFIED: node require] Already the project runner.                                                                                                                                                                                     |
| `typescript`            | 6.0.3              | Peer; loaded lazily by core via `import('typescript')`                                        | [VERIFIED: node require] Locked TS-6 pairing.                                                                                                                                                                                            |
| `@angular/compiler-cli` | 22.0.4             | Peer; the type-check engine loaded via `import('@angular/compiler-cli')`                      | [VERIFIED: node require] Locked Angular 22.                                                                                                                                                                                              |

### Supporting (test-only fixtures - no new install)

| Library       | Version | Purpose                                                          | When to Use                                                                                                                                                                                        |
| ------------- | ------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@nx/angular` | 23.0.1  | OPTIONAL fixture-scaffold generator (`nx g @nx/angular:library`) | [VERIFIED: `nx g @nx/angular:library --help` runs on 23.0.1] Only if you choose to generate rather than hand-author the committed fixtures. Hand-authoring is recommended (see Open Questions Q2). |

### Alternatives Considered

| Instead of                                       | Could Use                              | Tradeoff                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------ | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hand-authored committed fixtures                 | `nx g @nx/angular:library` then commit | The generator emits a full Angular lib (extra files, eslint config, vitest config) that bloats the fixture and must be pruned. A committed fixture needs only `project.json` + `tsconfig*.json` + `src/index.ts` + a component. Hand-authoring is smaller and intentional. Either is valid per D-11. |
| `runExecutor` (programmatic) for the parity tier | Only `execSync('nx run ...')`          | `execSync` is slow (full Nx process boot) and harder to assert structured values on. `runExecutor` runs in-process under Vitest's ESM loader, giving fast structured parity (D-16). Keep ONE `execSync` for the literal "nx run" requirement + cache test.                                           |

**Installation:** None. No package is added in this phase.

**Version verification (run 2026-06-28, this workspace):**

```
nx 23.0.1 | @nx/devkit 23.0.1 | @nx/vitest 23.0.1 | @nx/js 23.0.1
@nx/angular 23.0.1 | typescript 6.0.3 | @angular/compiler-cli 22.0.4 | vitest 4.1.9
```

All match CONTEXT.md / PROJECT.md / STATE.md exactly. [VERIFIED: `node -e require(<pkg>/package.json).version`]

## Package Legitimacy Audit

> No external packages are installed in this phase. All packages consumed are already present in the locked, committed `package.json` / lockfile and were installed in Phases 1-3. slopcheck is not applicable (nothing new to verify). The four toolchain packages exercised (`nx`, `@nx/devkit`, `@nx/vitest`, `@angular/compiler-cli`) are first-party Nrwl/Angular packages with millions of weekly downloads and public source repos, already vetted and pinned.

| Package                  | Registry | Status | Disposition |
| ------------------------ | -------- | ------ | ----------- |
| (none - no new installs) | -        | -      | N/A         |

**Packages removed due to slopcheck [SLOP] verdict:** none (no new packages).
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
  nx run <consumer>:angular-typecheck            (EXE-01 / D-05 runtime proof)
              |
              v
  +-------------------------------------------------------------+
  |  Nx CLI: require()s the compiled CJS executor.js             |
  |  (cache lookup FIRST: hash inputs per nx.json targetDefaults |
  |   -> HIT => replay captured stdout; MISS => run below)       |
  +-----------------------------+-------------------------------+
                                | (cache MISS)
                                v
  +-------------------------------------------------------------+
  |  ADAPTER TIER (the only @nx/devkit consumer; type-only ctx)  |
  |                                                              |
  |  executor.ts (default export, sub-50 lines)                  |
  |    1. normalizeOptions(options, context)  [normalize-options.ts]
  |         -> { coreOptions:{ tsConfigPath(ABS), includeDeps,  |
  |              pathBase }, maxWarnings, failFast, color }       |
  |         tsConfigPath = isAbsolute(o.tsConfig)                |
  |              ? o.tsConfig                                     |
  |              : joinPathFragments(context.root, o.tsConfig)   |
  |         pathBase = context.root  (D-08 Phase-3)              |
  |         color = process.stdout.isTTY === true               |
  |    2. result = await runTypecheck(coreOptions) ---------------+
  |    3. report = await renderReport(result,{pathBase,color,    |  |
  |                       failFast})  ----- (CORE seam, D-02) ----+--+
  |    4. process.stdout.write(report)   (raw; NOT logger.info)  |  | |
  |    5. return evaluateResult(result,{ maxWarnings }) -> {success}| | |
  |    catch TypecheckInfrastructureError -> logger.error + {false}|  | |
  |    catch (other) -> THROW (never swallow)                    |  | |
  +-------------------------------------------------------------+  | |
                                                                   | |
              +----------------------------------------------------+ |
              v                                                      |
  +-------------------------------------------------------------+    |
  |  CORE TIER (zero @nx/devkit; lint-enforced; process-free)    |    |
  |                                                              |    |
  |  runTypecheck(CoreOptions): Promise<CoreResult>  (Phase 2/3) |    |
  |    loadCompilerCli() / loadTypescript()  -- await import() --+----+ (ESM bridge,
  |    readConfiguration -> performCompilation(gatherAll) ->     |       memoized;
  |    filter -> sortAndDedup -> { diagnostics, errorCount, ...} |       GATE A
  |                                                              |       literal import()
  |  renderReport(result, opts): Promise<string>   (NEW, D-02)   |       survives emit)
  |    const ng = await loadCompilerCli();                       |
  |    const ts = await loadTypescript();   (private here)       |
  |    return formatReport(result.diagnostics, ng, ts, opts);    |
  |                                                              |
  |  evaluateResult({errorCount,warningCount},{maxWarnings})     |
  |    errors always fail; warningCount > maxWarnings fails      |
  +-------------------------------------------------------------+

  CACHE INPUT GRAPH (EXE-06 / D-08 / D-10):
    nx.json targetDefaults["angular-typechecker:angular-typecheck"]
      inputs: production, tsconfig*.json, package.json,
              {workspaceRoot}/tsconfig.base.json,
              ^default  ----(reaches via project-graph EDGE)---->  dep SOURCE files
              dependentTasksOutputFiles (buildable deps; Phase-6 proof),
              externalDependencies:[typescript,@angular/compiler-cli]
    EDGE formed by: analyzeSourceFiles:true (VERIFIED) +
                    tsconfig.base.json paths alias @fixtures/...-> dep src
```

### Recommended Project Structure (additions only)

```
nx.json                                  # ADD executor-id-keyed cacheable targetDefault (D-07/D-08)
tsconfig.base.json                       # ADD namespaced fixture paths alias -> dep SOURCE (D-11)
packages/angular-typechecker/
  executors.json                         # ADD "outputCapture": "direct-nodejs" (D-04)
  src/
    index.ts                             # ADD export renderReport (+ RenderOptions type)
    core/
      render-report.ts                   # NEW seam (D-02): loads ng/ts, delegates to formatReport
      render-report.spec.ts              # NEW unit test (fake or real formatDiagnostics)
    executors/angular-typecheck/
      executor.ts                        # COMPLETE the stub (D-01)
      executor.spec.ts                   # NEW: mock core; assert mapping + infra-catch + re-throw
      normalize-options.ts              # NEW pure fn (D-01/D-03)
      normalize-options.spec.ts          # NEW: rel/abs resolution, knob split
      schema.json                        # EXTEND per D-06 (4 props + version:2)
      schema.d.ts                        # EXTEND in lockstep
      schema-parity.spec.ts              # NEW key-parity test (D-06)
      executor.built-cjs.int.spec.ts     # OPTIONAL: require() the built executor.js (EXE-07 belt-and-braces)
libs/                                    # NEW committed fixtures (real main-graph projects, D-11)
  typecheck-consumer-dep/                #   NON-buildable Angular lib (NO build target)
    project.json  tsconfig.json  tsconfig.lib.json  package.json(private:true)
    src/index.ts  src/lib/dep.component.ts        # the file mutated by TEST-04
    src/lib/dep.component.ts.pristine             # committed sidecar (D-15)
  typecheck-consumer/                    #   carries the angular-typecheck target; imports the dep
    project.json  tsconfig.json  tsconfig.lib.json  package.json(private:true)
    src/index.ts  src/lib/consumer.component.ts   # imports @fixtures/typecheck-consumer-dep
e2e/ (or packages/angular-typechecker-cache-e2e/)   # NEW dedicated serialized integration project (D-14)
    project.json                         # @nx/vitest:test target
    vitest.config.mts                    # singleFork, no parallelism, testTimeout>=180000
    src/cache-busts-on-dep-error.int.spec.ts        # the TEST-04 harness (D-12/D-13/D-15)
    src/executor-parity.int.spec.ts                 # D-16 runExecutor parity + ONE execSync nx run
```

### Pattern 1: Thin adapter over a single core entry (D-01)

**What:** `executor.ts` is a translator: native input -> `CoreOptions`, `CoreResult` -> `{ success }`. All logic lives in core.
**When to use:** This phase; every deferred surface (CLI/builder/createNodesV2) reuses the same seam.
**Example:** see `## Code Examples` (the full executor + normalize-options).

### Pattern 2: The `renderReport` core seam (D-02, compile-blocker)

**What:** A new `core/` function `renderReport(result, { pathBase, color, failFast }): Promise<string>` that internally loads ng + ts (memoized) and delegates to the existing `formatReport`. It exists because `formatReport` REQUIRES injected `ng`/`ts` (`formatReport(diagnostics, ng, ts_, options)` - verified in `src/core/format-report.ts:57`) and the adapter cannot reach them: `loadCompilerCli` IS exported from the barrel but `loadTypescript` is PRIVATE to `run-typecheck.ts` (verified - `src/index.ts` does NOT export it; it is a module-local `cachedTypescript` closure at `run-typecheck.ts:340-352`).
**When to use:** Always - this is the only way the adapter can render without re-coupling rendering into the engine or leaking module-loading orchestration.
**Anti-pattern guard:** Do NOT add a `formatted` field to `CoreResult` (re-couples rendering into the engine, contradicts Phase-3 D-01). Do NOT merely re-export `loadTypescript` (leaks module-loading into every future adapter).

### Pattern 3: `^default` inlined-source cache model (D-08/D-09)

**What:** Because Angular has no TS project references, dependency `.d.ts` artifacts do not exist for non-buildable deps - the consumer compiles the dep's `.ts` directly. So the cache must hash the dep SOURCE via `^default` (the transitive dependency `default` fileset), NOT `dependentTasksOutputFiles` alone. This diverges deliberately from @nx/js's typecheck/tsc model (which assumes pre-emitted `.d.ts` and leaves `externalDependencies` commented out).
**When to use:** Any whole-program check over inlined-source dependencies.

### Anti-Patterns to Avoid

- **Registering a custom hasher on the target:** voids `nx show target inputs --check` (verified: `inputs.js:11-14` detects `hasCustomHasher` and prints a warning + sets `exitCode=1`), defeating the D-10 guard. Use static `inputs` only.
- **Piping the `--check` guard through `| head`/`| rg`:** the pipe's exit code masks Nx's exit code (observed live - a negative check reported exit 0 when piped through `head`, exit 1 when captured directly). Capture exit directly or use `execSync` (throws on non-zero).
- **`logger.info` for the report body:** prepends Nx chrome/color, corrupts byte-deterministic codeframes and breaks GitHub problem-matcher parsing (D-04). Use `process.stdout.write`.
- **`node:path.join` for tsConfig resolution:** emits backslashes on Windows arm64. Use `joinPathFragments` (POSIX-stable, D-03).
- **`git checkout` to revert the injected error:** masks other working edits, touches the index, defeated by a killed worker. Use the committed-sidecar + `finally` byte-restore (D-15).

## Don't Hand-Roll

| Problem                                   | Don't Build                                                    | Use Instead                                                                | Why                                                                                                                                                           |
| ----------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| tsConfig rel->abs resolution              | `path.join` + manual `\`->`/`                                  | `joinPathFragments(context.root, tsConfig)` from `@nx/devkit`              | POSIX-separator stability on Windows arm64; Nx-idiomatic (D-03).                                                                                              |
| Cache input correctness for inlined deps  | A custom hasher or hand-globbed dep file list                  | `^default` + the project-graph edge (`analyzeSourceFiles` + `paths` alias) | The Nx Rust hasher expands `^default` to each dep's transitive source fileset automatically; a custom hasher voids the `--check` guard (D-08/D-10).           |
| Verifying an input is in the hash         | Reading `.nx/cache` internals or re-implementing the hash plan | `nx show target inputs <t> --check <file>` (exit 0 + `✓`)                  | Official, stable, resolves the real `HashPlanInspector` plan; CONTEXT.md's literal SC2 requirement (D-10). Verified live.                                     |
| Detecting a cache hit                     | Parsing `.nx/cache` or timing the run                          | substring-match the static summary marker                                  | `.nx/cache` internals are unstable; the static marker is a stable, documented summary line (D-12). Verified-exact string.                                     |
| Pass/fail verdict                         | New exit-code logic in the executor                            | `evaluateResult(result, { maxWarnings })`                                  | Already implemented + unit-tested in Phase 3; the adapter only maps the boolean (D-01). The ARCHITECTURE.md `internal/exit-code.ts` is stale - do NOT add it. |
| Programmatic executor invocation in tests | Spawning `nx` via `execSync` for every parity assertion        | `runExecutor` from `@nx/devkit`                                            | In-process, fast, structured; reserve `execSync` for the ONE literal-`nx run` + the cache test (D-16). Verified present.                                      |

**Key insight:** Cache correctness for an Angular whole-program check is NOT a coding problem - it is a configuration problem (the right `inputs` list) plus a graph problem (the consumer->dep edge must exist). The only code is the thin adapter and the test harness. Every load-bearing mechanism (hash expansion, edge formation, input verification, cache-hit detection) is an existing Nx feature, verified live to behave as CONTEXT.md assumes.

## Common Pitfalls

### Pitfall 1: Stale cache hides a real dependency error (the TEST-04 raison d'etre)

**What goes wrong:** A green cache result is replayed even though a transitive non-buildable dep now has a type error. A type-checker that lies is worse than none.
**Why it happens:** If the `inputs` set misses the dep source (no `^default`) OR the consumer->dep graph edge does not exist (so `^default` reaches nothing), the dep's source bytes are not in the hash.
**How to avoid:** `^default` in the inputs (D-08) + a real graph edge (D-10/D-11). Prove BOTH: the R1 `--check` pre-flight (edge exists -> dep file is an input) AND the dynamic green-then-broken sequence (D-13).
**Warning signs:** "Passed in CI but the app doesn't compile"; `--skip-nx-cache` surfaces errors the cached run missed; changing a dep `.ts` does not change the consumer's hash.

### Pitfall 2: The consumer->dep edge silently does not form

**What goes wrong:** `^default` is in the inputs but reaches no dep because Nx never built the edge; the cache is permanently green on a broken dep.
**Why it happens:** The import is not statically analyzable, OR `analyzeSourceFiles` is off, OR the `paths` alias points at `dist` instead of source.
**How to avoid:** In THIS workspace, `analyzeSourceFiles` resolves to `true` (VERIFIED - `@nx/angular`/`@nx/js`/`@nx/workspace` are root deps; `node_modules/nx/.../plugins/js/utils/config.js:41-51`), the alias points at `libs/typecheck-consumer-dep/src/index.ts` (SOURCE), and the consumer imports it with a static `import`. The R1 `--check` guard (D-10) is the BLOCKING pre-flight that proves the edge before the dynamic test runs. If the edge ever fails to form, declare `implicitDependencies: ["typecheck-consumer-dep"]` on the consumer's `project.json`.
**Warning signs:** R1 guard prints `✗ ... is not an input` (exit 1) on the dep source file.

### Pitfall 3: `import()` downleveled to `require()` at runtime (EXE-07)

**What goes wrong:** The compiled executor hits `ERR_REQUIRE_ESM` against ESM-only `@angular/compiler-cli`.
**Why it happens:** `module: commonjs` would rewrite `import()` to `require()`. The project builds under `module: nodenext` (GATE A) so the literal `import(` survives - verified in built `core/compiler-loader.js`.
**How to avoid:** D-05 runtime proof: a real `nx run <consumer>:angular-typecheck` returns real NG diagnostics through the compiled CJS executor (only possible if `import()` loaded ESM at runtime). Optionally also `require()` the built `executor.js` in a Node int test (Open Q5).
**Warning signs:** Unit tests (mocked) pass; the first real run throws `ERR_REQUIRE_ESM`.

### Pitfall 4: Non-deterministic cache test (the test gets `.skip`'d)

**What goes wrong:** A spec shelling `nx run` from inside `nx run <plugin>:test` under the default parallel `forks` pool races on the shared `.nx/cache` + daemon -> flaky -> the most important correctness gate gets disabled.
**Why it happens:** Parallel test workers contend on the same cache directory and daemon.
**How to avoid:** Dedicated serialized integration project (D-14): own Vitest config with `singleFork: true`, `fileParallelism: false`, `sequence.concurrent: false`, `testTimeout >= 180000`, `NX_DAEMON=false`, per-run `NX_CACHE_DIRECTORY` (tmp) for the cold baseline. Run Phase 4 on the main tree (D-17).
**Warning signs:** Test passes solo, fails under `nx run-many`; intermittent cache-hit/miss flips.

### Pitfall 5: Crashed test leaves the injected error committed

**What goes wrong:** A killed worker leaves the mutated dep source on disk; the next run starts broken, or the error gets committed.
**Why it happens:** Naive `try/finally` does not survive a SIGKILL; `git checkout` masks other edits.
**How to avoid:** Committed PRISTINE sidecar + `beforeAll` heal + `finally` byte-restore (preserve EOL) + a CI backstop `git diff --exit-code -- libs/typecheck-consumer-dep` (D-15). Mutate a non-`.spec` file the Vitest `include` glob will not pick up.
**Warning signs:** `git status` shows a modified fixture after a test run; the suite fails on a "clean" checkout.

## Code Examples

> These are research-derived reference shapes for the planner, grounded in the existing source (`format-report.ts`, `evaluate-result.ts`, `run-typecheck.ts`) and CONTEXT.md. The planner owns final wording.

### `renderReport` core seam (D-02)

```typescript
// src/core/render-report.ts
import type ts from 'typescript';

import { loadCompilerCli } from './compiler-loader';
import { formatReport } from './format-report';
import type { CoreResult } from './run-typecheck';

export interface RenderOptions {
  // D-08: workspace-root base for CI annotation paths; unset => absolute.
  pathBase?: string;
  // D-10: false => strip ANSI (CI/agents/pipes). The adapter passes
  // process.stdout.isTTY so the core stays process-free (D-04/Phase-3 D-11).
  color: boolean;
  // EXE-03/D-04: reporter-only truncation at the first error.
  failFast?: boolean;
}

// Private here too: render-report owns the ts load so loadTypescript never
// leaks out of core (D-02). Mirror the run-typecheck.ts memoization shape.
let cachedTypescript: typeof ts | undefined;
async function loadTypescript(): Promise<typeof ts> {
  if (cachedTypescript === undefined) {
    const loaded = (await import('typescript')) as typeof ts & {
      default?: typeof ts;
    };
    cachedTypescript = loaded.default ?? loaded;
  }

  return cachedTypescript;
}

/**
 * The single render seam every adapter (executor now; CLI/builder later) reuses.
 * Loads the memoized ng + ts and delegates to the injected-surface formatReport.
 * CoreResult.diagnostics are ALREADY sorted + deduped by runTypecheck (D-09).
 */
export async function renderReport(result: Pick<CoreResult, 'diagnostics'>, options: RenderOptions): Promise<string> {
  const ng = await loadCompilerCli();
  const ts_ = await loadTypescript();

  return formatReport(result.diagnostics, ng, ts_, {
    pathBase: options.pathBase,
    color: options.color,
    failFast: options.failFast,
  });
}
```

Note: there will be TWO module-local `loadTypescript` memo caches (one in `run-typecheck.ts`, one in `render-report.ts`). That is acceptable (each `import('typescript')` resolves the same module instance; the second is a near-free cache miss once). If the planner prefers a single cache, promote `loadTypescript` into `compiler-loader.ts` as a NON-barrel-exported helper that both modules import - but do NOT export it from `src/index.ts` (D-02 anti-leak rule). Either is fine; the simpler duplication is shown above.

### Executor (D-01) - completes the existing stub at `src/executors/angular-typecheck/executor.ts`

```typescript
// src/executors/angular-typecheck/executor.ts
import type { ExecutorContext } from '@nx/devkit';
import { logger } from '@nx/devkit';

import { renderReport } from '../../core/render-report';
import { runTypecheck, TypecheckInfrastructureError } from '../../core/run-typecheck';
import { evaluateResult } from '../../core/evaluate-result';
import { normalizeOptions } from './normalize-options';
import type { AngularTypecheckExecutorOptions } from './schema';

export default async function angularTypecheckExecutor(options: AngularTypecheckExecutorOptions, context: ExecutorContext): Promise<{ success: boolean }> {
  const { coreOptions, maxWarnings, failFast, color } = normalizeOptions(options, context);

  try {
    const result = await runTypecheck(coreOptions);
    const report = await renderReport(result, {
      pathBase: coreOptions.pathBase,
      color,
      failFast,
    });
    process.stdout.write(report); // D-04: raw stdout, NOT logger.info

    return evaluateResult(result, { maxWarnings });
  } catch (error) {
    if (error instanceof TypecheckInfrastructureError) {
      logger.error(`angular-typecheck: the Angular compiler failed to run (infrastructure error, not a type error): ${error.message}`);

      return { success: false };
    }

    throw error; // D-01: never swallow an unknown failure
  }
}
```

### `normalize-options` (D-01/D-03)

```typescript
// src/executors/angular-typecheck/normalize-options.ts
import { isAbsolute } from 'node:path';

import type { ExecutorContext } from '@nx/devkit';
import { joinPathFragments } from '@nx/devkit';

import type { CoreOptions } from '../../core/run-typecheck';
import type { AngularTypecheckExecutorOptions } from './schema';

export interface NormalizedOptions {
  coreOptions: CoreOptions; // tsConfigPath (ABS) + includeDeps + pathBase
  maxWarnings?: number; // reporter/verdict-only; NOT in CoreOptions
  failFast: boolean; // reporter-only
  color: boolean; // derived from TTY
}

export function normalizeOptions(options: AngularTypecheckExecutorOptions, context: ExecutorContext): NormalizedOptions {
  const tsConfigPath = isAbsolute(options.tsConfig) ? options.tsConfig : joinPathFragments(context.root, options.tsConfig); // D-03

  return {
    coreOptions: {
      tsConfigPath,
      includeDeps: options.includeDeps ?? false,
      pathBase: context.root, // D-08 (Phase-3): workspace-root-relative CI paths
    },
    maxWarnings: options.maxWarnings, // undefined stays undefined (EXE-05)
    failFast: options.failFast ?? false,
    color: process.stdout.isTTY === true, // D-04
  };
}
```

### `schema.json` extension (D-06)

```json
{
  "$schema": "http://json-schema.org/schema",
  "$id": "AngularTypecheckExecutorOptions",
  "title": "Angular type-check executor",
  "description": "Type-checks an Angular project (TypeScript + template + extended NG8xxx) with no emit.",
  "cli": "nx",
  "version": 2,
  "type": "object",
  "properties": {
    "tsConfig": {
      "type": "string",
      "description": "Path to the tsconfig to type-check. Resolved relative to the workspace root when not absolute."
    },
    "includeDeps": {
      "type": "boolean",
      "default": false,
      "description": "Include out-of-project and node_modules diagnostics. Default excludes them."
    },
    "maxWarnings": {
      "type": "number",
      "description": "Fail when the warning count exceeds this number. 0 fails on any warning. Omit to never fail on warnings alone."
    },
    "failFast": {
      "type": "boolean",
      "default": false,
      "description": "Report only the first error (output brevity) - NOT a speed-up; all diagnostics are still gathered."
    }
  },
  "required": ["tsConfig"],
  "additionalProperties": false
}
```

Note: `maxWarnings` has NO `default` key (D-06 - a `default: 0` would silently fail any warning since NG8xxx default to warning).

```typescript
// src/executors/angular-typecheck/schema.d.ts
export interface AngularTypecheckExecutorOptions {
  tsConfig: string;
  includeDeps?: boolean;
  maxWarnings?: number;
  failFast?: boolean;
}
```

### `executors.json` - add `outputCapture` (D-04)

```json
{
  "executors": {
    "angular-typecheck": {
      "implementation": "./src/executors/angular-typecheck/executor",
      "schema": "./src/executors/angular-typecheck/schema.json",
      "outputCapture": "direct-nodejs",
      "description": "Type-checks an Angular project (TypeScript + template + extended NG8xxx) with no emit."
    }
  }
}
```

[VERIFIED: `direct-nodejs` is a valid `outputCapture` value in `node_modules/nx/.../config/misc-interfaces.d.ts`]

### `nx.json` - executor-id-keyed cacheable target default (D-07/D-08)

Add this entry to the existing `targetDefaults` object (do NOT touch the existing `namedInputs`, which already define `production`/`default`/`sharedGlobals`):

```json
"angular-typechecker:angular-typecheck": {
  "cache": true,
  "outputs": [],
  "inputs": [
    "production",
    "{projectRoot}/tsconfig*.json",
    "{projectRoot}/package.json",
    "{workspaceRoot}/tsconfig.base.json",
    "^default",
    { "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}", "transitive": true },
    { "externalDependencies": ["typescript", "@angular/compiler-cli"] }
  ]
}
```

[VERIFIED: both input object shapes are valid `InputDefinition` members in `node_modules/nx/.../config/workspace-json-project-json.d.ts:175-195`: `{ externalDependencies: string[] }` and `{ dependentTasksOutputFiles: string; transitive?: boolean }`.] Caveat (D-08): `typescript` and `@angular/compiler-cli` must be resolvable external nodes (they are, as installed peers) or Nx hard-errors at hash time - document in README that consumers must have the peers installed.

### `tsconfig.base.json` - fixture paths alias (D-11)

Add to the existing `compilerOptions.paths` (alongside `@angular-typechecker/angular-typechecker`):

```json
"@fixtures/typecheck-consumer-dep": ["libs/typecheck-consumer-dep/src/index.ts"]
```

Alias -> SOURCE (not dist). This both type-checks the consumer's import AND forms the Nx graph edge (D-10).

### R1 edge guard pre-flight (D-10) - run BEFORE the dynamic cache test

```bash
NX_DAEMON=false npx nx show target inputs typecheck-consumer:angular-typecheck \
  --check libs/typecheck-consumer-dep/src/lib/dep.component.ts
# Expected: exit 0 + a line: "✓ libs/typecheck-consumer-dep/src/lib/dep.component.ts is an input for typecheck-consumer:angular-typecheck (files)"
```

[VERIFIED live 2026-06-28 against an existing target: positive = exit 0 + green `✓ ... is an input ... (files)`; negative = exit 1 + red `✗ ... is not an input`.] In the test harness, run via `execSync` (throws on non-zero -> the test fails if the edge is missing) AND assert the stdout contains the `✓ <file> is an input` substring. Do NOT pipe through `head`/`rg` (masks the exit code).

### Cache-hit detection marker (D-12)

```
Nx read the output from the cache instead of running the command
```

[VERIFIED: the full installed-Nx string is `Nx read the output from the cache instead of running the command for ${N} out of ${M} tasks.` wrapped in `output.dim()`, present in BOTH `static-run-one-terminal-output-life-cycle.js:41` and the static run-many lifecycle. The substring above is a stable prefix.] Force `--output-style=static --no-color` + `FORCE_COLOR=0` + `NX_DAEMON=false` so the `output.dim()` ANSI does not split the substring. Detect a cache MISS by the ABSENCE of this marker (the run actually executed) AND the presence of the freshly-injected diagnostic code in stdout + a non-zero exit (defense-in-depth, all three required - D-12).

### TEST-04 harness skeleton (D-13/D-14/D-15)

```typescript
// e2e/.../src/cache-busts-on-dep-error.int.spec.ts (dedicated serialized project)
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

const CACHE_MARKER = 'Nx read the output from the cache instead of running the command';
const DEP_FILE = 'libs/typecheck-consumer-dep/src/lib/dep.component.ts';
const PRISTINE = `${DEP_FILE}.pristine`;
const TARGET = 'typecheck-consumer:angular-typecheck';

// Per-run isolated cache (D-14) - avoids the global .nx lock on Windows.
const cacheDir = mkdtempSync(join(tmpdir(), 'atc-cache-'));
const env = { ...process.env, NX_DAEMON: 'false', FORCE_COLOR: '0', NX_CACHE_DIRECTORY: cacheDir };

function run(extra = ''): { stdout: string; code: number } {
  try {
    const stdout = execSync(`npx nx run ${TARGET} --output-style=static --no-color ${extra}`, { env, encoding: 'utf8' });

    return { stdout, code: 0 };
  } catch (error: any) {
    return { stdout: `${error.stdout ?? ''}${error.stderr ?? ''}`, code: error.status ?? 1 };
  }
}

beforeAll(() => {
  // D-15 heal: restore from the committed pristine sidecar in case a prior crash left an injection.
  writeFileSync(DEP_FILE, readFileSync(PRISTINE, 'utf8'));
});

describe('TEST-04: a dep type error busts the consumer cache', () => {
  it('R1 pre-flight: the dep source IS an input for the consumer target (edge exists)', () => {
    // throws (fails the test) on exit 1; assert the glyph too.
    const out = execSync(`npx nx show target inputs ${TARGET} --check ${DEP_FILE}`, { env, encoding: 'utf8' });

    expect(out).toContain(`${DEP_FILE} is an input`);
  });

  it('green -> cache HIT -> inject dep error -> cache MISS + new diagnostic', () => {
    const original = readFileSync(DEP_FILE, 'utf8');

    try {
      const first = run();
      expect(first.code).toBe(0);

      const second = run();
      expect(second.stdout).toContain(CACHE_MARKER); // CACHE HIT (caching is live)
      expect(second.code).toBe(0);

      // Inject a known TS2322 into the dep SOURCE (lands in the consumer program).
      writeFileSync(DEP_FILE, `${original}\nexport const __atc_bust: number = 'str';\n`);

      const third = run();
      expect(third.stdout).not.toContain(CACHE_MARKER); // CACHE MISS (no stale green)
      expect(third.stdout).toMatch(/TS2322|2322/); // the new diagnostic surfaces
      expect(third.code).not.toBe(0);
    } finally {
      writeFileSync(DEP_FILE, original); // D-15 byte-restore, preserve EOL
    }
  });
});

afterEach(() => {
  // belt-and-braces in case a sync error skipped the finally.
  writeFileSync(DEP_FILE, readFileSync(PRISTINE, 'utf8'));
});
```

### Dedicated cache-e2e Vitest config (D-14)

```typescript
// e2e/.../vitest.config.mts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'angular-typechecker-cache-e2e',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.int.spec.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 180000,
  },
});
```

### D-16 parity tier (in-process `runExecutor`)

```typescript
// e2e/.../src/executor-parity.int.spec.ts
import { runExecutor } from '@nx/devkit';
import { runTypecheck } from '@angular-typechecker/angular-typechecker';
// build the ExecutorContext for typecheck-consumer; call runExecutor for the
// angular-typecheck target; iterate the async generator's single { success };
// compare { success } to (core errorCount === 0) and the reported diagnostic
// code set to core diagnostics.map(d => d.code).sort(), in BOTH green and
// injected-error states. PLUS one literal execSync('nx run ...') for EXE-01.
```

## Runtime State Inventory

> This phase CREATES new state (fixtures, a cache config, an alias) rather than renaming existing state. It is not a rename/refactor phase. The closest analog is "what runtime state must the cache test account for" - covered below.

| Category            | Items Found                                                                                                                                                                                                                                                             | Action Required                                                                                                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stored data         | Nx task cache (`.nx/cache` or per-run `NX_CACHE_DIRECTORY`) holds the consumer's hashed result + captured stdout.                                                                                                                                                       | The TEST-04 harness MUST isolate it (per-run tmp `NX_CACHE_DIRECTORY`) and reset between cold runs (`nx reset` at most once in `beforeAll`). Never inspect internals.                                                                |
| Live service config | Nx daemon (caches the project graph in-memory). A stale daemon can serve an outdated graph that omits a just-added fixture edge.                                                                                                                                        | Set `NX_DAEMON=false` for all guard + cache-test invocations (D-12/D-14). Phase 4 runs on the main tree where the daemon sees the real graph (D-17).                                                                                 |
| OS-registered state | None - no OS tasks, services, or registrations.                                                                                                                                                                                                                         | None - verified (no scheduler/launchd/systemd touchpoints in this phase).                                                                                                                                                            |
| Secrets/env vars    | The harness reads `NX_DAEMON`, `FORCE_COLOR`, `NX_CACHE_DIRECTORY` (sets, does not consume secrets).                                                                                                                                                                    | None - no secrets; these are deterministic test-control env vars only.                                                                                                                                                               |
| Build artifacts     | The plugin must be BUILT (`nx build angular-typechecker`) before a real `nx run` resolves the compiled executor (`dist/.../executor.js` - verified present). The deep-import shim breaks `@nx/js:tsc` without `node_modules` at the package dir (STATE [01-03 CAVEAT]). | Build the plugin before the D-05/D-16 `nx run` proofs. Run on the main tree with real `node_modules` (D-17). The cache test's consumer target references the executor by published-style id `angular-typechecker:angular-typecheck`. |

**Nothing found in OS-registered category:** None - verified by inspecting the phase scope (no OS-level registrations are created or renamed).

## State of the Art

| Old Approach                                                                              | Current Approach                                                 | When Changed                          | Impact                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--projectNameAndRootFormat` on `@nx/angular:library`                                     | `directory` positional; flag removed                             | Nx 20+ (removed before 23)            | [VERIFIED: `nx g @nx/angular:library --help` on 23.0.1 has no such flag] Do NOT copy the Nx 19.8 prior-art generator invocation. Prefer hand-authored committed fixtures. |
| `@nx/vite:test` Vitest executor                                                           | `@nx/vitest:test` (dedicated package)                            | Nx 22.2                               | Already adopted in this workspace; the cache-e2e project also uses `@nx/vitest:test`.                                                                                     |
| `@nx/js`-style project-references cache model (`dependentTasksOutputFiles` + dep `.d.ts`) | `^default` inlined-source model for Angular (no TS project refs) | This project's deliberate fork (D-09) | Angular deps are inlined source; the dep SOURCE must be hashed via `^default`, not just dist `.d.ts`.                                                                     |

**Deprecated/outdated (in the project's own research docs):**

- ARCHITECTURE.md `internal/exit-code.ts`: superseded by Phase-3 `evaluateResult` - do NOT add it (CONTEXT.md confirms stale).
- ARCHITECTURE.md `CoreResult { formatted }`: contradicted by Phase-3 D-01 - do NOT add a `formatted` field; use the `renderReport` seam (D-02).
- ARCHITECTURE.md dependency-classification lines (~314/~376): stale - devkit is a DEPENDENCY (already correctly in `package.json`), not a peer; PROJECT.md authoritative.

## Assumptions Log

| #   | Claim                                                                                                                       | Section          | Risk if Wrong                                                                                                                                                                                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | The consumer->dep graph edge forms automatically from the `paths` alias + `analyzeSourceFiles:true` in THIS workspace.      | Pitfall 2 / D-10 | LOW - mechanism verified live (`analyzeSourceFiles` resolves true). The LIVE-verify-once-libs-exist step (CONTEXT discretion) + the R1 `--check` guard (D-10) catch a miss before TEST-04 trusts the cache. Fallback: `implicitDependencies`.                                             |
| A2  | A nested `nx` call inside Vitest honors `NX_CACHE_DIRECTORY`.                                                               | D-14 harness     | LOW-MEDIUM - CONTEXT.md asks for a 5-min spike to confirm before committing the harness. `NX_CACHE_DIRECTORY` is a documented env var; the spike is cheap insurance. Mitigation: if it does not, fall back to a single `nx reset` in `beforeAll` (Windows `.nx` lock risk noted in D-14). |
| A3  | The static cache-hit marker substring is stable across the run.                                                             | D-12             | LOW - exact string verified in installed Nx 23.0.1 (both static lifecycles). `--output-style=static --no-color` + `FORCE_COLOR=0` keep it un-split by ANSI.                                                                                                                               |
| A4  | A non-buildable Angular lib (no `build` target) is the right consumer-dep so the consumer compiles the dep SOURCE directly. | D-11             | LOW - this IS the critical cache case by design (no build step => cache correctness depends entirely on hashing the dep source).                                                                                                                                                          |

## Open Questions

1. **App vs lib for the consumer fixture (CONTEXT discretion)**
   - What we know: either works as long as it is a real graph project carrying the `angular-typecheck` target; research slight-leaned a lib.
   - What's unclear: nothing blocking.
   - Recommendation: make BOTH fixtures non-buildable Angular **libs** (`typecheck-consumer` + `typecheck-consumer-dep`). Symmetry, no app `build`/serve targets to muddy the graph, smaller fixture. The consumer lib's `project.json` carries only the `angular-typecheck` target (no `build`).

2. **Generate vs hand-author the fixtures (CONTEXT discretion)**
   - What we know: the generator works on 23.0.1 but emits extra files; a committed fixture needs no generator.
   - What's unclear: nothing.
   - Recommendation: HAND-AUTHOR. A committed fixture needs only `project.json` (with `tags: ["scope:fixture"]`, the `angular-typecheck` target on the consumer, NO `build` target on either), `tsconfig.json` + `tsconfig.lib.json` (extending `tsconfig.base.json`, `strictTemplates:true` so NG8xxx can fire), `package.json` (`"private": true`), `src/index.ts`, and one component each. Smaller, intentional, no generator-output pruning. The dep's mutated file gets a committed `.pristine` sidecar (D-15).

3. **`renderReport` signature - `color` param vs derived (CONTEXT discretion)**
   - Recommendation: `color` is a REQUIRED param on `renderReport` (the core stays `process`-free per Phase-3 D-11; the adapter derives `process.stdout.isTTY === true` and passes it). Signature: `renderReport(result: Pick<CoreResult,'diagnostics'>, options: { pathBase?: string; color: boolean; failFast?: boolean }): Promise<string>`. See Code Examples.

4. **`normalize-options` return shape (CONTEXT discretion)**
   - Recommendation: `{ coreOptions: CoreOptions; maxWarnings?: number; failFast: boolean; color: boolean }` - keeps `CoreOptions` free of reporter-only knobs (D-01). See Code Examples.

5. **Also add a `require()`-the-built-executor int test? (CONTEXT discretion)**
   - Recommendation: YES, add it as cheap EXE-07 insurance. A Node int test that `require()`s the built `dist/.../executor.js`, invokes it against a fixture tsconfig, and asserts it runs with no `ERR_REQUIRE_ESM` directly exercises the CJS-loads-ESM boundary at the EXECUTOR level (the existing GATE-A static spec only asserts bytes; this asserts behavior). It complements - does not replace - the D-05 `nx run` proof. Place it in the dedicated integration project (it needs the built dist) or guard it behind a "dist exists" precondition like the existing `gate-a-static.spec.ts`.

6. **(Confirm at plan time) does the consumer's tsconfig produce a non-empty rootNames set?**
   - What we know: `runTypecheck` synthesizes a zero-rootNames Error if the leaf tsconfig has no files (run-typecheck.ts:117). The consumer's `tsconfig.lib.json` must `include` its `src/**/*.ts` so the green baseline run #1 is genuinely clean (errorCount 0), not a synthesized guard error.
   - Recommendation: point the target at the consumer's leaf `tsconfig.lib.json` (not a solution-style root) and verify run #1 is genuinely green before relying on the green-then-broken transition.

## Environment Availability

| Dependency                                    | Required By                                                                       | Available                             | Version                | Fallback                             |
| --------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------- | ---------------------- | ------------------------------------ |
| `nx` CLI                                      | `nx run`, `nx show target inputs --check`, `nx reset`, cache                      | Yes                                   | 23.0.1                 | -                                    |
| `@nx/devkit`                                  | adapter (`ExecutorContext`, `logger`, `joinPathFragments`), tests (`runExecutor`) | Yes                                   | 23.0.1                 | -                                    |
| `@nx/vitest:test`                             | unit tier + dedicated cache-e2e project                                           | Yes                                   | 23.0.1                 | -                                    |
| `vitest`                                      | test runner (ESM, `runExecutor`, ESM compiler-cli)                                | Yes                                   | 4.1.9                  | -                                    |
| `typescript` (peer)                           | core `import('typescript')`                                                       | Yes                                   | 6.0.3                  | -                                    |
| `@angular/compiler-cli` (peer)                | core `import('@angular/compiler-cli')`                                            | Yes                                   | 22.0.4                 | -                                    |
| Native Nx hasher (`nx.win32-arm64-msvc.node`) | `^default` expansion + `--check`                                                  | Yes                                   | bundled with nx 23.0.1 | -                                    |
| Built plugin dist (`dist/.../executor.js`)    | D-05/D-16 `nx run` proofs                                                         | Yes (present; rebuild before the run) | -                      | `nx build angular-typechecker` first |

**Missing dependencies with no fallback:** None. Every dependency this phase needs is installed and verified live.
**Missing dependencies with fallback:** None.

## Validation Architecture

> nyquist_validation is enabled (`.planning/config.json` workflow.nyquist_validation: true). This section enumerates, per success criterion, the test tier, observable signal, and the minimum cases that constitute adequate coverage.

### Test Framework

| Property              | Value                                                                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework             | Vitest 4.1.9 via `@nx/vitest:test` (verified)                                                                                                                          |
| Unit config file      | `packages/angular-typechecker/vitest.config.mts` (exists; `environment: jsdom`, `include: ['{src,tests}/**/*.{test,spec}.*']`)                                         |
| Cache-e2e config file | NEW `e2e/.../vitest.config.mts` (singleFork, no parallelism, testTimeout>=180000, `environment: node`) - Wave 0                                                        |
| Quick run command     | `npx nx test angular-typechecker` (unit tier)                                                                                                                          |
| Full suite command    | `npx nx build angular-typechecker && npx nx test angular-typechecker && npx nx test angular-typechecker-cache-e2e` (build-before-static + unit + serialized cache-e2e) |

### Phase Requirements -> Test Map

| Req ID  | Behavior                                                                                                               | Test Type                                        | Automated Command                                                                  | File Exists?      |
| ------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------- | ----------------- |
| EXE-01  | `normalizeOptions` resolves rel + abs tsConfig; splits reporter knobs                                                  | unit                                             | `npx nx test angular-typechecker` (normalize-options.spec.ts)                      | Wave 0            |
| EXE-01  | executor maps `{success}`; catches infra error -> `{false}`; re-throws unknown                                         | unit (mock core)                                 | `npx nx test angular-typechecker` (executor.spec.ts)                               | Wave 0            |
| EXE-01  | executor `{success}` + diagnostic-code set === core, green AND injected-error                                          | integration (`runExecutor` in-process)           | `npx nx test angular-typechecker-cache-e2e` (executor-parity.int.spec.ts)          | Wave 0            |
| EXE-01  | literal `nx run <consumer>:angular-typecheck` runs                                                                     | integration (`execSync`)                         | `npx nx test angular-typechecker-cache-e2e`                                        | Wave 0            |
| EXE-01  | `renderReport` delegates to formatReport with injected ng/ts                                                           | unit                                             | `npx nx test angular-typechecker` (render-report.spec.ts)                          | Wave 0            |
| EXE-01  | schema.json keys === schema.d.ts keys (parity)                                                                         | unit                                             | `npx nx test angular-typechecker` (schema-parity.spec.ts)                          | Wave 0            |
| EXE-06  | the dep SOURCE file IS an input for the consumer target (R1 edge guard)                                                | integration (`execSync` `--check`, exit 0 + `✓`) | `npx nx test angular-typechecker-cache-e2e` (the BLOCKING pre-flight)              | Wave 0            |
| EXE-06  | `tsconfig.base.json` change IS an input (extends-root)                                                                 | integration (`--check`) optional                 | same                                                                               | Wave 0 (optional) |
| EXE-07  | a real `nx run` returns real NG/template diagnostics through the compiled CJS executor (no ERR_REQUIRE_ESM at runtime) | integration                                      | `npx nx test angular-typechecker-cache-e2e`                                        | Wave 0            |
| EXE-07  | `require()` the built `executor.js` runs without ERR_REQUIRE_ESM (optional belt-and-braces)                            | integration                                      | same (dist-exists guarded)                                                         | Wave 0 (optional) |
| EXE-07  | built `core/compiler-loader.js` retains literal `import(` (build-time half)                                            | static                                           | already covered by `gate-a-static.spec.ts` (exists)                                | Yes               |
| TEST-04 | green run -> 2nd run CACHE HIT (marker present, exit 0)                                                                | integration                                      | `npx nx test angular-typechecker-cache-e2e` (cache-busts-on-dep-error.int.spec.ts) | Wave 0            |
| TEST-04 | inject dep error -> run CACHE MISS (no marker) + new diagnostic + non-zero exit                                        | integration                                      | same                                                                               | Wave 0            |

### Sampling Rate

- **Per task commit:** `npx nx test angular-typechecker` (fast unit tier; < 30s for the adapter/normalize/render/schema specs).
- **Per wave merge:** `npx nx build angular-typechecker && npx nx test angular-typechecker` (build + unit; the build is required so the static GATE-A and any built-executor int specs read real dist bytes).
- **Phase gate:** the FULL suite green, including `npx nx test angular-typechecker-cache-e2e` (the serialized cache-correctness gate), before `/gsd:verify-work`. Run on the MAIN tree (D-17).

### Required distinct cases (Nyquist - both edges of every binary signal)

| Signal                      | Required case A                                                               | Required case B                                                                               |
| --------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Cache hit/miss (TEST-04)    | **CACHE HIT** on the 2nd green run (marker present)                           | **CACHE MISS** after the dep error injection (marker absent + new diagnostic + non-zero exit) |
| R1 edge existence (D-10)    | **`✓` is an input** on the dep source file (exit 0) - the BLOCKING pre-flight | (negative documented: a non-input file yields `✗`/exit 1; the guard relies on the positive)   |
| tsConfig resolution (D-03)  | **relative** path -> joined to `context.root`                                 | **absolute** path -> passed through unchanged                                                 |
| Verdict mapping (D-01)      | **green** (errorCount 0) -> `{ success: true }`                               | **injected error** (errorCount>0) -> `{ success: false }`                                     |
| Infra error handling (D-01) | `TypecheckInfrastructureError` -> `logger.error` + `{ success: false }`       | unknown error -> **re-thrown** (not swallowed)                                                |
| Parity (D-16)               | green state: executor codes === core codes                                    | injected-error state: executor codes === core codes                                           |

### Wave 0 Gaps

- [ ] `packages/angular-typechecker/src/core/render-report.spec.ts` - covers EXE-01 (D-02 seam)
- [ ] `packages/angular-typechecker/src/executors/angular-typecheck/normalize-options.spec.ts` - covers EXE-01/D-03 (rel+abs)
- [ ] `packages/angular-typechecker/src/executors/angular-typecheck/executor.spec.ts` - covers EXE-01/D-01 (mapping, infra-catch, re-throw)
- [ ] `packages/angular-typechecker/src/executors/angular-typecheck/schema-parity.spec.ts` - covers EXE-01/D-06
- [ ] `e2e/.../vitest.config.mts` + `project.json` (`@nx/vitest:test`) - the dedicated serialized cache-e2e project (D-14)
- [ ] `e2e/.../src/cache-busts-on-dep-error.int.spec.ts` - covers TEST-04 + EXE-06 (R1 guard + HIT/MISS)
- [ ] `e2e/.../src/executor-parity.int.spec.ts` - covers EXE-01/EXE-07/D-16 (runExecutor parity + one execSync nx run)
- [ ] `libs/typecheck-consumer-dep/**` + `libs/typecheck-consumer/**` committed fixtures incl. the `.pristine` sidecar (D-11/D-15)
- [ ] (optional) `e2e/.../src/built-executor-require.int.spec.ts` - EXE-07 belt-and-braces (Open Q5)

Existing infrastructure that already covers part of the phase: `gate-a-static.spec.ts` (EXE-07 build-time half), the Phase-3 unit suite (core composition is already tested), `vitest.config.mts` (unit tier plumbing).

## Security Domain

> `security_enforcement` is not set in `.planning/config.json` (absent = enabled). This phase is an internal build-tooling adapter + test harness with no network, no auth, no user-facing data path, and no new dependencies - so most ASVS categories do not apply. The applicable controls are input validation of the executor schema and the test-harness's filesystem mutation safety.

### Applicable ASVS Categories

| ASVS Category         | Applies            | Standard Control                                                                                                                                                                                                                                                                                         |
| --------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication     | no                 | No auth surface.                                                                                                                                                                                                                                                                                         |
| V3 Session Management | no                 | No sessions.                                                                                                                                                                                                                                                                                             |
| V4 Access Control     | no                 | No access-control surface.                                                                                                                                                                                                                                                                               |
| V5 Input Validation   | yes                | `schema.json` (`additionalProperties: false`, typed props, `required: ["tsConfig"]`) is the Nx-enforced validation layer; `evaluateResult` defensively treats negative/NaN `maxWarnings` as unset (verified - `evaluate-result.ts:48-53`). The adapter does not interpolate option strings into a shell. |
| V6 Cryptography       | no                 | No crypto.                                                                                                                                                                                                                                                                                               |
| V12 Files & Resources | yes (test harness) | The TEST-04 harness WRITES to a committed fixture file. Mitigate per D-15: write only the known `DEP_FILE` path (no path interpolation from untrusted input), restore from a committed `.pristine` sidecar, `finally` byte-restore, CI `git diff --exit-code` backstop.                                  |

### Known Threat Patterns for this stack

| Pattern                                                                     | STRIDE                  | Standard Mitigation                                                                                                                                                                        |
| --------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Command injection via tsConfig/option values into `execSync` (test harness) | Tampering               | The harness builds the `nx run` command from a FIXED target id + fixed flags, never from untrusted option strings. Fixture paths are committed constants. No user input reaches the shell. |
| A lying cache (false PASS) lets broken code through CI                      | Repudiation / Tampering | TEST-04 is the dedicated correctness gate (Pitfall 1); `^default` + the verified graph edge + the R1 `--check` guard ensure the dep source is hashed.                                      |
| Test harness leaves an injected type error committed                        | Tampering               | D-15 crash-safe revert (pristine sidecar + finally + CI `git diff --exit-code -- libs/typecheck-consumer-dep`).                                                                            |
| Unknown executor error silently swallowed -> false `{success:true}`         | Repudiation             | D-01: re-throw any non-`TypecheckInfrastructureError` (never swallow); a type-checker that lies is worse than none.                                                                        |
| Schema accepts unexpected properties                                        | Tampering               | `additionalProperties: false` (D-06) + the key-parity test.                                                                                                                                |

## Project Constraints (from CLAUDE.md)

The project + global CLAUDE.md impose directives the planner MUST honor:

- **Windows arm64 search:** NEVER use the `grep` command; use `git grep` (tracked) or `rg -uu` (gitignored, e.g. `node_modules`/`dist`). The cache-test harness and any input-checking helpers must follow this (the existing specs already read `dist` via `fs.readFileSync`, never `git grep`, because dist is gitignored).
- **ASCII-only output:** no emojis/box-drawing/em-dashes in scripts, code, or comments. (The `✓`/`✗` glyphs appear in Nx's OWN output, which the harness MATCHES - it must match the literal glyph Nx emits, but must not EMIT non-ASCII itself. Match on the substring `is an input` to stay ASCII-safe in assertions.)
- **Git staging:** never `git add .`/`-A`/`-u`; stage fixtures + config by name. Prefer `git mv` for any moves.
- **Public repo:** never introduce proprietary/Connect specifics; the Nx 19.8 prototype is version-bound INSPIRATION only - re-validate every pattern against Nx 23.0.1 (this research did so live).
- **GSD workflow:** file-changing tools go through a GSD command (this is a research-only pass; no source edits made).
- **Module-boundary lint (Phase-3 WS-04):** the `core/**` ESLint override bans `nx`/`@nx/devkit`/architect imports (type-only too). The NEW `core/render-report.ts` MUST NOT import `@nx/devkit` - it imports only `./compiler-loader`, `./format-report`, and `typescript` (via `import()`) + a `CoreResult` type. The adapter tier (`executor.ts`, `normalize-options.ts`) is the only tier allowed to import `@nx/devkit`.
- **`singleQuote: true`** Prettier; **braces on all control-flow bodies**; **blank lines around control flow/returns** (global JS/TS style).
- **devkit is a DEPENDENCY** (already in `package.json`), not a peer - do NOT follow ARCHITECTURE.md's stale peer-dep guidance.

## Sources

### Primary (HIGH confidence - verified live in this workspace 2026-06-28)

- Installed Nx 23.0.1 source (`node_modules/nx/dist/src/`):
  - `command-line/show/show-target/inputs.js:8-33,130,138` - `nx show target inputs --check` semantics: `--check` is an array; custom-hasher detection sets `exitCode=1`; positive `✓ ... is an input ... (files)` exit 0, negative `✗ ... is not an input` exit 1; `--check` ignores `--json`.
  - `tasks-runner/life-cycles/static-run-one-terminal-output-life-cycle.js:41` + static run-many - exact cache-hit marker `Nx read the output from the cache instead of running the command for ${N} out of ${M} tasks.` wrapped in `output.dim()`.
  - `plugins/js/utils/config.js:8-60` - `analyzeSourceFiles` defaults `true` when `@nx/angular`/`@nx/js`/`@nx/workspace`/etc. are root deps (this workspace qualifies).
  - `config/workspace-json-project-json.d.ts:175-195` - `InputDefinition` union confirms `{ externalDependencies: string[] }` and `{ dependentTasksOutputFiles: string; transitive?: boolean }` are valid.
  - `config/misc-interfaces.d.ts` - `outputCapture: "direct-nodejs"` is a valid value.
- `node -e require('<pkg>/package.json').version` - nx/devkit/vitest-pkg/js/angular 23.0.1, typescript 6.0.3, @angular/compiler-cli 22.0.4, vitest 4.1.9.
- `node -e require('@nx/devkit')` - `logger.error/info/warn`, `joinPathFragments` (function), `runExecutor` (function) all present.
- `nx g @nx/angular:library --help` (23.0.1) - `directory` positional, `--buildable`/`--publishable`/`--tags`/`--importPath`/`--unitTestRunner`/`--skipFormat`; NO `--projectNameAndRootFormat`.
- `nx show target inputs --help` (23.0.1) - subcommand structure + `--check` array flag.
- LIVE `nx show target inputs <t> --check <file>` runs (positive exit 0 + `✓`; negative exit 1 + `✗`; pipe masks exit code).
- This repo's existing source: `src/core/run-typecheck.ts` (`CoreOptions`/`CoreResult`/`TypecheckInfrastructureError`; private `loadTypescript`), `src/core/format-report.ts:57` (`formatReport(diagnostics, ng, ts_, options)`), `src/core/evaluate-result.ts` (`evaluateResult`), `src/index.ts` (barrel - exports `loadCompilerCli` but NOT `loadTypescript`), `src/executors/angular-typecheck/{executor.ts,schema.json,schema.d.ts}`, `executors.json`, `project.json`, `nx.json`, `tsconfig.base.json`, `gate-a-static.spec.ts`, `run-typecheck.integration.spec.ts`, `vitest.config.mts`, `package.json`.

### Secondary (MEDIUM confidence - CONTEXT.md canonical_refs, re-anchored to live behavior where possible)

- CONTEXT.md `04-CONTEXT.md` D-01..D-17 + canonical_refs (the locked decisions, with Nx-clone file:line citations for the Rust hasher internals `hash_planner.rs`/`inputs.rs` which are not shipped in `node_modules` and so are cited, not re-verified here).
- `.planning/research/ARCHITECTURE.md` (Pattern 1/2/4; stale-flagged items noted), `.planning/research/PITFALLS.md` (Pitfall 1/4 especially), `.planning/STATE.md` ([01-03 CAVEAT] deep-import shim, GATE A evidence, Phase-3 exports).

### Tertiary (LOW confidence - documentation URLs, not re-fetched this session)

- nx.dev Inputs/Named Inputs, Configure Inputs, How Caching Works, Cache Task Results; Executors/Local Executors/ExecutorContext (CONTEXT canonical_refs). Behavior validated against the installed binary instead of the docs.
- Tracked Nx issues (#32182, #22277, #22265, #15964, #9147) - panel-classified in CONTEXT.md.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - every version + API surface verified live via `node require` / `--help`.
- Architecture / composition: HIGH - grounded in the existing Phase-2/3 source + CONTEXT.md locked decisions; the `renderReport` seam is forced by a verified API gap (`loadTypescript` not in the barrel).
- Cache recipe (EXE-06): HIGH - input object shapes validated against the live `InputDefinition` type; `analyzeSourceFiles:true` and the `--check` guard verified live; the Rust-hasher `^default` expansion is CITED from the Nx clone (not shipped in node_modules).
- TEST-04 mechanics: HIGH - exact cache-hit marker + `--check` exit/glyph semantics verified live; the only open spike (A2: `NX_CACHE_DIRECTORY` honored in a nested call) is a documented env var with a cheap fallback.
- Pitfalls: HIGH - each anti-pattern is backed by a verified behavior or an existing project learning.

**Research date:** 2026-06-28
**Valid until:** 2026-07-28 (stable - the toolchain is exact-pinned; re-validate only if Nx/Angular/TS pins move).
