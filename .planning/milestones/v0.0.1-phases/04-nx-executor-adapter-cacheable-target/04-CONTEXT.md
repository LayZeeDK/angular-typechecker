# Phase 4: Nx Executor Adapter + Cacheable Target - Context

**Gathered:** 2026-06-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Wrap the framework-agnostic Phase-1-to-3 core as the FIRST user-runnable surface: a thin `angular-typecheck` Nx executor that any Angular project can set as a target, shipped as CommonJS that loads ESM `@angular/compiler-cli` via dynamic `import()` (no downlevel at runtime), made Nx-CACHEABLE with inputs proven correct by a dependency-error-busts-cache test.

Requirements covered: **EXE-01** (executor wraps core, settable as any project's target), **EXE-06** (cacheable target with correct inputs), **EXE-07** (CJS-loads-ESM at runtime, no `import()`->`require()` downlevel), **TEST-04** (dependency-error-busts-cache correctness test).

This phase clarifies HOW to wire what is already scoped. LOCKED and NOT re-decided here: the core API (`runTypecheck`/`evaluateResult`/`filterDiagnostics`/`formatReport`, Phase-3 D-01/D-03), the unconditional all-getter gatherer (ENG-02), the memoized `await import()` loader + `module: nodenext` GATE-A invariant (Phase-1), the project-boundary filter (Phase-3 D-05/D-06), `pathBase`-only-in-formatter (Phase-3 D-08), fail-fast-is-reporting-only (Phase-3 D-04). OUT of scope: packaging/publish + the one e2e smoke (Phase 5), the full 5-project-type e2e matrix + pnpm/mixed-case + cross-OS CI (Phase 6), `createNodesV2` inference + CLI/builder surfaces (deferred milestones).

**Process note:** decisions below are grounded in (1) the existing project research (`.planning/research/*`), (2) two phase-specific research passes against the local Nx/`@angular/build`/nx-verdaccio clones + official docs + tracked Nx issues, and (3) a 5-member Opus review panel (cache-correctness, test-determinism, packaging/hygiene, API-contract, delivery lenses) that red-teamed the decision set and the user's TEST-04 selection. Two decisions were escalated to and resolved by the user (TEST-04 fixture topology; executor schema scope). Panel hardening is folded in inline and tagged `[panel]`.
</domain>

<decisions>
## Implementation Decisions

### Executor adapter composition (EXE-01, EXE-07)

- **D-01: Complete the existing stub into the full sub-50-line adapter via a hexagonal-lite split** — `executor.ts` (default export) + a pure `normalize-options.ts`. Compose: `normalizeOptions(options, context)` -> `runTypecheck(coreOptions)` -> `renderReport(...)` (write to stdout) -> `evaluateResult(result, { maxWarnings })` -> `{ success }`. Catch `TypecheckInfrastructureError` -> distinct `logger.error` meta message + `{ success: false }`; **RE-THROW any other error** (never swallow an unknown failure — a type-checker that lies is worse than none). DROP ARCHITECTURE.md's proposed `internal/exit-code.ts` — Phase-3's `evaluateResult` already IS the verdict (the ARCHITECTURE doc is stale here). `normalize-options.ts` returns `{ coreOptions, maxWarnings, failFast, color }` so `CoreOptions` stays clean of reporter-only knobs (Phase-3 D-01/D-03/D-04).

- **D-02 `[panel, compile-blocker]`: Add a NEW core seam `renderReport(result, { pathBase, color, failFast }): Promise<string>`** exported from `core/`. **Required** because `formatReport` needs injected `ng`/`ts` that `runTypecheck` does NOT return and `loadTypescript` is NOT exported from the barrel — so the adapter cannot call `formatReport` as the contract stands. `renderReport` internally uses the memoized `loadCompilerCli()` + `loadTypescript()` (zero extra cost) and delegates to `formatReport`, keeping the CJS->ESM module loading inside `core/` where the loaders live. Do NOT instead (a) add a `formatted` field to `CoreResult` (re-couples rendering into the engine, violates Phase-3 D-01, forces color/failFast/pathBase into the engine), or (b) merely re-export `loadTypescript` (leaks module-loading orchestration into every future adapter). Every deferred surface (CLI/builder) reuses `renderReport`. **Maintainability acceptance test:** the future CLI must be expressible as ~15 lines reusing `normalize`-equivalent + `runTypecheck` + `renderReport` + `evaluateResult` + `process.exit`.

- **D-03 `[panel]`: tsConfig resolution rule (unambiguous):** `isAbsolute(options.tsConfig) ? options.tsConfig : joinPathFragments(context.root, options.tsConfig)` — **WORKSPACE-root-relative** (Nx-idiomatic; matches `@nx/js:tsc`, `@angular/build`, nx-verdaccio; the documented `"tsConfig": "libs/x/tsconfig.lib.json"` form). NOT project-root-relative (would break the documented form). `joinPathFragments` (not `node:path.join`) for POSIX separator stability on Windows arm64. The core requires an ABSOLUTE path and never reads `process.cwd()` (Phase-3 D-04). Document "tsConfig is resolved relative to the workspace root" in the README; unit-test both relative and absolute inputs.

- **D-04 `[panel]`: Output channel + outputCapture.** Write the `renderReport` string via `process.stdout.write(report)` (raw) — NOT `logger.info` (which prepends Nx chrome/own color, corrupting `formatReport`'s byte-deterministic codeframes + breaking GitHub Actions problem-matcher `file:line:col` parsing; OUT-03 idempotency). Use `logger.error` ONLY for the infra-error meta message. The adapter computes `color = process.stdout.isTTY === true` and passes it into `renderReport` (the core stays `process`-free per Phase-3 D-11). Set `"outputCapture": "direct-nodejs"` in `executors.json` NOW (preserves `isTTY` + captures stdout verbatim for cache replay; `"pipe"` strips TTY-ness). Phase 5 only verifies it ships in the tarball.

- **D-05: EXE-07 runtime proof (NOT a repeat of Phase-1's build-time grep).** Phase-1 GATE A already proved the built `compiler-loader.js` retains a literal `import(` and that `require()`-loading the built executor against a fixture ran with no `ERR_REQUIRE_ESM`. Phase-4 SC1 demands the stronger RUNTIME proof at the EXECUTOR boundary: a real `nx run <consumer>:angular-typecheck` through the compiled CJS executor returns real NG/template diagnostics (proving `import()` loaded ESM compiler-cli at runtime, not merely that the literal survived emit). Do NOT register a custom hasher on the target (it would void the `nx show target inputs --check` guard, D-10).

### Executor schema (EXE-01; v0.0.1 public contract) — USER DECISION: ship all three

- **D-06 `[user: "Ship all three in Phase 4"]`: `schema.json` (v2, `cli: "nx"`, `additionalProperties: false`) properties:**
  - `tsConfig` (string, **required**, a FLAG — never `$default` positional; only argv index 0 is reliable per Pitfall).
  - `includeDeps` (boolean, default `false`) — EXE-04.
  - `maxWarnings` (number, **NO json-schema default** — `undefined` = "warnings never fail"; `0` = fail on any warning ESLint-style; `evaluateResult` defensively treats negative/NaN as unset) — EXE-05. A `default: 0` would silently fail any warning (NG8xxx default to warning) = an un-loosenable breaking footgun; leave it absent.
  - `failFast` (boolean, default `false`; description = "report only the first error (output brevity) — NOT a speed-up; all diagnostics are still gathered", per Phase-3 D-04) — EXE-03.
  - camelCase names matching the core (`includeDeps`/`maxWarnings`/`failFast`) so the adapter is a literal pass-through. Add `"version": 2` NOW (PKG-02 mandates v2; avoids a later migration). Keep `schema.json` + `schema.d.ts` in lockstep + add a **key-parity unit test** (`schema.json` `properties` keys === `AngularTypecheckExecutorOptions` keys; ARCHITECTURE Pattern 4). NO `aliases` (camelCase self-documents; Nx auto-derives `--kebab`; a redundant alias is a second contract surface). Do NOT add a redundant `mode` enum alongside `failFast`.
  - Rationale for shipping now: the executor is v0.0.1's ONLY user surface (no CLI); EXE-03/04/05 are v0.0.1 requirements; the core already implements all three; deferring leaves the executor strictly weaker than the core it wraps and makes TEST-04/EXE-01 unable to exercise the modes. (Adding options later is non-breaking, so the cost of shipping now is low and the value is immediate.)

### Cacheable target recipe (EXE-06)

- **D-07: Define the cacheable target via `nx.json` `targetDefaults` keyed by the EXECUTOR id `angular-typechecker:angular-typecheck`** (executor-id key beats target-name key — `target-defaults.ts:190-205`; nx-verdaccio precedent `nx.json:135-150`). `cache: true`, `outputs: []` (no-emit check has no file outputs). The plugin-author's OWN `nx.json` carries it for dogfooding the fixtures (never published — `nx.json` is not in `files`). README documents the FULL consumer recipe **with inputs** (not just `cache:true` — an under-specified inputs set produces a lying cache). `createNodesV2` inference that would compute exact per-tsconfig inputs is deferred.

- **D-08: The `inputs` recipe (each line annotated):**
  - `"production"` — this project's non-test source. Coarse-but-safe over-approximation of the dynamic tsconfig include/exclude (Nx inputs are static globs; over-inclusion is the safe direction). It is the documented `@nx/js` fallback when includes can't be determined.
  - `"{projectRoot}/tsconfig*.json"` — leaf + sibling tsconfigs (their include/exclude + chain bytes bust on change).
  - `"{projectRoot}/package.json"` — sibling manifest (deps/types affect resolution).
  - `"{workspaceRoot}/tsconfig.base.json"` — the `extends` ROOT. MANDATORY: `production` is `{projectRoot}`-scoped and misses it. **Invariant guard `[panel]`:** every tsconfig in any project's extends chain must match a listed input glob; if a project later adds an intermediate workspace-root shared tsconfig, add it explicitly.
  - `"^default"` `[panel: changed from research's `^production`]` — THE non-buildable-dep-source cache-bust. Use `^default` (not `^production`) so a change to a dep file that `production` EXCLUDES still busts a WHOLE-PROGRAM check (over-invalidation = the safe direction for a correctness gate). The Nx Rust hasher expands each graph dependency's `default` fileset into the dep's source files, transitively (`hash_planner.rs:355-403`, `inputs.rs:45-68`).
  - `{ "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}", "transitive": true }` — buildable deps consumed via dist `.d.ts`. Free config; KEEP; but NOT proven by a buildable-dep test in Phase 4 (deferred to Phase 6 `[delivery panel]`).
  - `{ "externalDependencies": ["typescript", "@angular/compiler-cli"] }` — a compiler/TS bump must bust; NARROWS from Nx's `AllExternalDependencies` default so unrelated dep bumps don't needlessly bust. Both must be resolvable external nodes (they are, as peers); otherwise Nx hard-errors at hash time (`hash_planner.rs:207-258`) — document in README that consumers must have the peers installed.

- **D-09: Architectural fork — use the `^default`/`^production` INLINED-SOURCE model, NOT `@nx/js`'s project-references model** (`dependentTasksOutputFiles` + dep `.d.ts`). `@nx/js`'s typecheck/tsc targets assume TS project references where deps pre-emit `.d.ts` (and it even leaves `externalDependencies` COMMENTED OUT — `plugin.ts:722-724`). **Angular has no TS project-references support** (PROJECT.md/CLAUDE.md), so our deps are inlined source and the dep SOURCE must be hashed. We deliberately diverge: `^default` for dep source + explicitly enabled `externalDependencies` for a type-check tool.

- **D-10 `[panel: the headline correctness guard]`: Residual hole R1 — the consumer->dep project-graph EDGE must exist** for `^default` to reach a dep; no input glob fixes a missing edge, and a missing edge ships a permanently-green cache on a broken dep. Ensure `analyzeSourceFiles` (Nx 23 default) + the `tsconfig.base.json` paths alias (consumer import) forms the edge; declare `implicitDependencies` for any non-statically-analyzable edge. TEST-04 MUST assert the edge as a **BLOCKING pre-flight** with `nx show target inputs <consumer>:angular-typecheck --check <exact dep source file>` (exit 0 + a `✓` line on the PRECISE file you will mutate, `NX_DAEMON=false`) BEFORE the dynamic test — verified: `--check` resolves the real hash plan via `HashPlanInspector.inspectTaskInputs`, exit 0 = input / exit 1 = not (`show-target/inputs.ts`). This also satisfies SC2's "verified via `nx show target inputs --check`" literally. A custom hasher voids this — so D-05's no-custom-hasher rule is load-bearing here too.

### TEST-04 dependency-error-busts-cache + fixture topology (TEST-04) — USER DECISION: dedicated committed libs

- **D-11 `[user: "Dedicated committed libs"; panel-hardened]`: Fixture topology** — two dedicated COMMITTED libs that are REAL main-workspace-graph projects (non-negotiable: Nx cannot cache-test projects it does not discover; nested/generated/`tmp` fixtures hit the discovery trap — Nx skips gitignored/`tsconfig.base.json`-excluded paths, and this repo gitignores `tmp`/`dist` + excludes `tmp`):
  - `libs/typecheck-consumer-dep` — a NON-buildable Angular lib (NO `build` target). This is the critical cache case: with no build step the consumer compiles the dep's `.ts` directly, so cache correctness depends ENTIRELY on the consumer's hash including the dep SOURCE. (Do NOT build a buildable/publishable lib in Phase 4 — that is Phase-6 surface `[delivery panel]`.)
  - `libs/typecheck-consumer` — the project that carries the `angular-typecheck` target and imports the dep.
  - `tsconfig.base.json` paths alias `@fixtures/typecheck-consumer-dep` -> `libs/typecheck-consumer-dep/src/index.ts` (alias -> SOURCE, not dist) — this both type-checks the import AND forms the Nx graph edge (D-10). The injected error must land IN the consumer's program so SC3's "reports the new error" survives the default boundary filter (Phase-3 D-05/D-07) `[API panel]`.
  - **Hygiene `[packaging panel]` (graph membership is REQUIRED, so harden — do not relocate out of the graph):** tag both `tags: ["scope:fixture"]` + a module-boundary constraint (the product never depends on them); `"private": true` in each fixture `package.json`; the alias is namespaced (`@fixtures/...`) and never shadows a product alias. (Directory grouping under an e2e/fixtures area instead of top-level `libs/` is acceptable planner discretion AS LONG AS they remain discovered main-graph projects; the user approved top-level `libs/`.)

- **D-12 `[panel-hardened]`: Cache-hit assertion** — substring-match the single-target STATIC summary marker `Nx read the output from the cache instead of running the command` (verified Nx 23 string, `static-run-one-terminal-output-life-cycle.ts`; do NOT match the dynamic-only per-task tags `[local cache]` / `[existing outputs match the cache, left as is]`). Force determinism: `--output-style=static` + `execSync` (non-TTY) + `NX_DAEMON=false` + `FORCE_COLOR=0`/`--no-color` (the marker is wrapped in `output.dim()` -> ANSI flake risk). Defense-in-depth, ALL required: static marker + exit code + the new diagnostic code present in stdout. Optionally add a `--skip-nx-cache` differential framed as the explicit anti-lying-cache check. Do NOT inspect `.nx/cache` internals (unstable).

- **D-13: Test sequence** — `nx reset` (or a fresh per-run `NX_CACHE_DIRECTORY`) -> green run #1 (baseline) -> green run #2 (assert CACHE HIT — proves caching is live) -> inject a known error into the dep's committed SOURCE (e.g. `const x: number = 'str';` for TS2322, or a template NG8xxx) -> run #3 (assert NO cache marker + the new diagnostic reported + non-zero exit) -> cleanup (D-15). The **green-then-broken** transition is load-bearing: a cache that serves a stale GREEN result is the real danger; both halves required.

- **D-14 `[determinism panel]`: Test harness placement** — put the `execSync('nx ...')`/`nx reset` specs in a DEDICATED, serialized integration/e2e project (its own Vitest config: `pool: 'forks'`, `poolOptions.forks.singleFork: true`, `fileParallelism: false`, `sequence.concurrent: false`, `testTimeout >= 180000`), NOT in the plugin's unit `test` project. A spec shelling `nx run` from inside `nx run <plugin>:test`, under the default parallel `forks` pool, races on the shared `.nx/cache` + daemon -> non-deterministic false pass/fail -> the single most important correctness gate gets `.skip`'d. Use a per-run `NX_CACHE_DIRECTORY` (tmp) for the cold baseline instead of a global `nx reset` mid-suite (Windows `.nx/` lock risk); reserve `nx reset` for at most one `beforeAll`. The in-process `runExecutor`+core equivalence checks (D-16) stay in the fast unit tier.

- **D-15 `[determinism panel]`: Crash-safe revert** — NOT `git checkout` (defeated by a killed worker; reverts to HEAD masking other working edits; touches the index). Use: a committed PRISTINE sidecar of the mutated file + a `beforeAll` "fixture is pristine" heal (restore from the sidecar if a prior crashed run left the injection) + a `finally` byte-restore of the captured original content (preserve EOL — read+write the same string) + a post-job `git diff --exit-code -- libs/typecheck-consumer-dep` CI backstop. Mutate a non-`.spec` source file the Vitest `include` glob will not pick up.

- **D-16 `[determinism + API panel]`: EXE-01 demonstration shares the TEST-04 fixture; assert equivalence on STRUCTURED values, not rendered stdout** (formatting/paths/ANSI diverge cross-OS). Assert (a) the executor's `{ success }` === (core `CoreResult.errorCount === 0`), and (b) the executor's reported diagnostic CODE set === `core CoreResult.diagnostics.map(d => d.code).sort()` (codes are stable ints — TS raw, NG negative-encoded — separator-immune), in BOTH green and injected-error states. Two tiers: `runExecutor` (programmatic, in-process, ESM via Vitest) for the parity signal + ONE real `execSync('nx run <consumer>:angular-typecheck --skip-nx-cache --output-style=static --no-color')` for discoverability (assert exit code + a single stable diagnostic-code substring only). EXE-01's literal "`nx run`" wording requires >=1 real `nx run`.

### Sequencing (Phase-3 LEARNINGS + delivery panel)

- **D-17: Run Phase 4 SEQUENTIALLY ON THE MAIN TREE** (real `node_modules` + real project graph + the daemon). Phase 4 is entirely dependency/daemon/graph-heavy, and the `compiler-cli-types.ts` deep-import shim breaks `@nx/js:tsc` builds without `node_modules` at the package dir (STATE [01-03 CAVEAT]). The SC3 cache test is non-parallelizable and worktree-hostile (the cache/daemon key on the real graph + workspace root; a junctioned worktree realpath-resolves OUTSIDE the worktree -> graph drift, Phase-3 LEARNINGS). Creating `libs/*` invalidates the graph for any in-flight plan -> another reason to serialize. If worktrees are used for the adapter/schema plans, the SC3 cache test MUST run on the main tree.

### Claude's Discretion
- Exact fixture project names / `scope:fixture` label / alias string; the exact injected error code; whether the consumer is an app or a lib (research slight-leaned a lib for cleanliness — either works, as long as it is a real graph project carrying the target); the precise `renderReport` signature and whether `color` is a param vs derived; the exact `normalize-options` return shape; whether to ALSO add a `require()`-the-built-executor int test alongside the `nx run` runtime proof.
- Verify the non-buildable lib generator flags against `nx g @nx/angular:library --help` on 23.0.1 (do NOT copy the Nx 19.8 prior-art flags such as `--projectNameAndRootFormat`, removed) — or hand-author the fixture `project.json`/tsconfig/source (a committed fixture needs no generator).
- LIVE-verify (once the libs exist) that the paths-alias-to-source forms the consumer->dep graph edge in THIS `--preset=apps` workspace BEFORE relying on TEST-04 (the D-10 guard does exactly this).
- 5-min spike: confirm a nested `nx` call inside Vitest honors `NX_CACHE_DIRECTORY` before committing the D-14 harness plan.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 4 spec + scope (this repo)
- `.planning/ROADMAP.md` Phase 4 section — goal + 3 success criteria.
- `.planning/REQUIREMENTS.md` — EXE-01, EXE-06, EXE-07, TEST-04 (the Phase-4 set) + traceability.
- `.planning/PROJECT.md` — locked stack, dependency model (`@nx/devkit` pinned dep; compiler-cli + typescript peers), module format, engine, Key Decisions, deferred surfaces.

### Phase 1/2/3 carry-forwards (this repo) — MUST read
- `.planning/phases/03-filtering-modes-output-quality-gates/03-CONTEXT.md` — D-01 hybrid composition (the adapter composes `runTypecheck` + `evaluateResult` + `formatReport`), D-03 pure verdict, D-04 fail-fast = reporting-only, D-05/D-06 boundary filter, D-08 `pathBase`<-`context.root` realized in the adapter, D-11 core/** import ban (adapter MAY use devkit/console).
- `.planning/phases/03-filtering-modes-output-quality-gates/03-LEARNINGS.md` — worktrees lack node_modules; run the dependency-heavy wave on the main tree; the deep-import shim trips enforce-module-boundaries; junction-safe teardown.
- `.planning/phases/02-core-type-check-engine-gatherer/02-CONTEXT.md` — `CoreResult` category counting, no-emit override, infra-failure re-throw.
- `.planning/phases/01-workspace-bootstrap-engine-spike-gated/01-CONTEXT.md` + `.planning/STATE.md` Accumulated Context — GATE A `import(` survival, negative-encoded NG codes (`-998109`), [01-03 CAVEAT] deep-import shim fragility.

### Project research (this repo)
- `.planning/research/ARCHITECTURE.md` — thin-adapter pattern (Pattern 1), lazy memoized ESM bridge (Pattern 2), schema.json-as-source-of-truth (Pattern 4), proposed `src/executors/`/`internal/` tree, Build/Publish boundary. CAVEATS (panel-confirmed STALE): `internal/exit-code.ts` is superseded by Phase-3 `evaluateResult` (do NOT add it); the data-flow `CoreResult { formatted }` is contradicted by Phase-3 D-01 (do NOT add `formatted`); lines ~314/~376 on dependency classification are stale (PROJECT.md authoritative — devkit is a DEPENDENCY, not peer).
- `.planning/research/PITFALLS.md` — Pitfall 1 (`import()`->`require()` downlevel), **Pitfall 4 (stale cache hides errors — the TEST-04 raison d'etre)**, Pitfall 5 (tarball missing manifests, Phase 5), Pitfall 6 (peer ranges, Phase 5), the "Looks Done But Isn't" checklist.
- `.planning/research/FEATURES.md`, `.planning/research/STACK.md` (executors.json/schema.json conventions, `@nx/js:tsc` build, `files` allowlist), `.planning/research/FOLLOWUP-FINDINGS.md`, `.planning/research/DIAGNOSTIC-CATALOG.md`.

### Current source this phase grows in place (this repo)
- `packages/angular-typechecker/src/executors/angular-typecheck/executor.ts` — the incomplete stub (only `errorCount===0`, no evaluate/format/pathBase/infra-catch/abs-path) to complete (D-01).
- `packages/angular-typechecker/src/executors/angular-typecheck/schema.json` + `schema.d.ts` — extend per D-06; keep in lockstep.
- `packages/angular-typechecker/executors.json` — already correct (`angular-typecheck` -> `./src/executors/angular-typecheck/executor`); add `outputCapture` (D-04).
- `packages/angular-typechecker/src/core/run-typecheck.ts` — `runTypecheck`/`CoreOptions`/`CoreResult`/`TypecheckInfrastructureError` (note: `loadTypescript` is PRIVATE here — drives the D-02 `renderReport` seam).
- `packages/angular-typechecker/src/core/format-report.ts` + `evaluate-result.ts` + `index.ts` — `formatReport(diagnostics, ng, ts, opts)` (needs injected ng/ts -> D-02), `evaluateResult({maxWarnings})` (the verdict -> D-01), the public barrel (add `renderReport` export).
- `nx.json` — `namedInputs` (`production`/`default`/`sharedGlobals`) + `targetDefaults`; add the executor-id-keyed cacheable default (D-07/D-08).
- `apps/ng-spike-app/` — the Phase-1 spike app (solution-style tsconfig); reference only — TEST-04 uses dedicated fixtures, not this app.
- `tsconfig.base.json` (add the namespaced fixture paths alias), `.gitignore` (do NOT place fixtures under gitignored paths).

### External reference sources (absolute paths, read-only; re-validate against installed Nx 23.0.1 / `@angular/compiler-cli@22.0.4` / TS 6.0.3)
- `D:/projects/github/nrwl/nx` (the Nx clone) — `packages/js/src/plugins/typescript/plugin.ts:713-953` (`getInputs`: extends-chain, dynamic include/exclude->globs, `dependentTasksOutputFiles`, `externalDependencies` COMMENTED OUT — the model we diverge from); `packages/nx/src/hasher/task-hasher.ts:279-298,354-427` (DEFAULT_INPUTS incl. `{dependencies:true,input:'default'}`; `^`-prefix split); `packages/nx/src/native/tasks/hash_planner.rs:207-258,355-403` + `inputs.rs:45-93` (the Rust hasher: `^default`/`^production` expand each dep's fileset transitively; `externalDependencies` must resolve to external nodes); `packages/nx/src/project-graph/utils/project-configuration/target-defaults.ts:190-205` (executor-id key precedence); `packages/nx/src/command-line/show/show-target/inputs.ts` + `command-object.ts:307-360` (`nx show target inputs --check <file>` semantics, exit 0/1, custom-hasher void); `packages/nx/src/tasks-runner/life-cycles/static-run-one-terminal-output-life-cycle.ts` (the cache-hit marker, `output.dim()`-wrapped); `e2e/nx/src/cache.test.ts` (Nx's own cache-hit assertion pattern — the model for D-12).
- `D:/projects/github/push-based/nx-verdaccio` — `nx.json:135-150` (targetDefaults keyed by executor id), `nx.json:14-33,49-54` (`production` + `typecheck-typescript-inputs` named-input shapes), `nx.json:220-224` (`analyzeSourceFiles:true`), `projects/nx-verdaccio/project.json` + `package.json` (published-plugin `files`/`release.projects` scope; LEGACY `.eslintrc.json` — do NOT copy config shape). Nx 22.3.1-era; use for patterns only, not the test runner (`@nx/vite:test` -> we use `@nx/vitest:test`).
- `D:/projects/github/angular/angular-cli/packages/angular/build` — `AngularCompilation` thin-`execute` builders + memoized `loadCompilerCli`/`loadTypescript` (the renderReport/loader shape to mirror).
- `D:/projects/github/analogjs/analog/packages/nx-plugin` — single-project plugin + `src/executors/<name>/{schema.json,schema.d,*.impl}` convention.
- `D:/projects/sandbox/nx19-8-angular18-2-esbuild-playwright-storybook` (Angular 18.2 prior prototype, PUBLIC; version-bound, INSPIRATION ONLY — re-validate every pattern against Nx 23, import no code): `libs/nx-plugin/src/executors/angular-typecheck/` (monolithic executor + `runExecutor`+`ExecutorContext` int-test shape + `injectTypeScriptError`), `INTEGRATION-TESTING-LEARNINGS.md` (the Nx fixture-discovery trap, Vitest-over-Jest ESM rationale, `NX_DAEMON=false`).

### External docs / issues (URLs; re-validate against Nx 23.0.1)
- Nx Inputs / Named Inputs — https://nx.dev/docs/reference/inputs ; Configure Inputs for Task Caching — https://nx.dev/recipes/running-tasks/configure-inputs ; How Caching Works — https://nx.dev/concepts/how-caching-works ; Cache Task Results — https://nx.dev/docs/features/cache-task-results.
- Nx executors — https://nx.dev/docs/concepts/executors-and-configurations ; Local Executors — https://nx.dev/docs/extending-nx/local-executors ; ExecutorContext — https://nx.dev/docs/reference/devkit/ExecutorContext.
- Tracked Nx cache gaps (panel-classified): #32182 (source/inlined namedInputs over-invalidation = safe), #22277 (externalDependencies — fixed), #22265 (buildable under-invalidation — fixed, not our path), #15964 (external pkg change — fixed), #9147 (`process.cwd()` differs with/without daemon -> `NX_DAEMON=false`).
- TS `module: node16`/`nodenext` keeps dynamic `import()` untransformed — https://www.typescriptlang.org/docs/handbook/modules/reference.html (EXE-07).
- Brandon Roberts, "Angular Compilation, Type-Checking, and Build Bottlenecks" (2026-06-26) — https://brandonroberts.dev/blog/posts/angular-compilation-type-checking-and-build-bottlenecks-4n2f (the type-check is the dominant separable cost this cacheable target accelerates).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The Phase-3 `core/` is composed-not-grown by Phase 4: `runTypecheck` (engine seam), `evaluateResult({maxWarnings})` (the verdict — used directly, D-01), `formatReport` (needs a `renderReport` wrapper, D-02), `filterDiagnostics`, the memoized `loadCompilerCli` (+ private `loadTypescript`). The barrel `src/index.ts` already exports the first four; add `renderReport`.
- The existing executor stub + `executors.json` + `schema.json`/`schema.d.ts` are real starting points (complete the stub; extend the schema).
- `nx.json` `namedInputs` (`production`/`default`) already exist — reuse, don't redefine.
- GATE-A evidence (Phase 1) covers the build-time half of EXE-07; Phase 4 adds only the runtime half.

### Established Patterns
- Framework-agnostic core with ZERO `@nx/devkit`/CLI imports, lint-enforced (Phase-3 D-11); the executor + `normalize-options` are the ONLY tiers that touch `@nx/devkit` (type-only `ExecutorContext`). `module: nodenext` CJS build with the `import(`-survival invariant (GATE A).
- Thin-adapter-over-single-core-entry (ARCHITECTURE Pattern 1) — the design lever that makes the deferred CLI/createNodesV2/builder ~50 lines each.
- Injected-compiler-surface pure functions (Phase-3 pattern) — `formatReport`/`evaluateResult` take a `Pick<>` of ng/ts; `renderReport` is the seam that supplies them.

### Integration Points
- adapter -> core: `normalizeOptions` -> `runTypecheck` -> `renderReport` -> `evaluateResult` -> `{ success }` (single seam; D-01/D-02).
- target -> Nx cache: `targetDefaults["angular-typechecker:angular-typecheck"]` with the D-08 inputs; `outputCapture: "direct-nodejs"`; verified via `nx show target inputs --check`.
- fixture graph edge: `libs/typecheck-consumer` import of `@fixtures/typecheck-consumer-dep` (paths alias to source) -> Nx project-graph edge -> `^default` reach (D-10/D-11).

### Prior-art learnings (sanitized; inspiration only)
- The Nx 19.8 prototype confirms: `runExecutor`+`ExecutorContext` int-test shape, `injectTypeScriptError`, the fixture-discovery trap (Nx skips gitignored/excluded dirs), `NX_DAEMON=false`, Vitest-over-Jest for ESM compiler-cli. Re-validate all on Nx 23; its generator flags (`--projectNameAndRootFormat`) are removed in newer Nx — do NOT copy verbatim.
</code_context>

<specifics>
## Specific Ideas

- **Cacheable target snippet** (`nx.json`, executor-id-keyed): `{ "angular-typechecker:angular-typecheck": { "cache": true, "outputs": [], "inputs": ["production", "{projectRoot}/tsconfig*.json", "{projectRoot}/package.json", "{workspaceRoot}/tsconfig.base.json", "^default", { "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}", "transitive": true }, { "externalDependencies": ["typescript", "@angular/compiler-cli"] }] } }`.
- **R1 guard command:** `NX_DAEMON=false nx show target inputs typecheck-consumer:angular-typecheck --check libs/typecheck-consumer-dep/src/lib/<mutated-file>.ts` -> assert exit 0 + `✓` on that exact file (D-10).
- **Cache-hit marker:** `Nx read the output from the cache instead of running the command` on a single-target `--output-style=static --no-color` run (D-12).
- **Fixture alias:** `tsconfig.base.json` `paths`: `"@fixtures/typecheck-consumer-dep": ["libs/typecheck-consumer-dep/src/index.ts"]` (alias -> SOURCE).
- **Schema:** `tsConfig` (req flag) + `includeDeps` (default false) + `maxWarnings` (number, no default) + `failFast` (default false) + `version: 2` + `additionalProperties: false` (D-06).
</specifics>

<deferred>
## Deferred Ideas

All roadmap-scoped or out-of-milestone (NOT new in-phase capabilities):
- **Phase-5 packaging hand-off (record now so it isn't lost):** scope `nx.json` `release.projects: ["angular-typechecker"]`; add the plugin `files` allowlist (`["src","executors.json","README.md","LICENSE"]`); add a `tar -tf` tarball assertion that no `libs/`/`fixtures/`/`*.spec.ts`/`tsconfig.spec.json` leak; `attw --pack` must confirm no unresolved fixture-alias specifier in shipped `.d.ts`; README ships the FULL consumer `targetDefaults` recipe (inputs included). Verify `outputCapture: "direct-nodejs"` is in the tarball.
- **Buildable/publishable lib fixture + the `dependentTasksOutputFiles` PROOF + the full 5-project-type matrix + pnpm + mixed-case path assertions** -> Phase 6 e2e (TEST-03, CI-01). The `dependentTasksOutputFiles` line stays in the Phase-4 recipe (free config) but is not exercised by a buildable-dep test until Phase 6.
- **One e2e smoke against the packed tarball** -> Phase 5 (TEST-05).
- **`createNodesV2` inference** (compute exact per-tsconfig inputs, infer `angular-typecheck` targets) + optional `typecheck` override -> deferred milestone (INF-01/02). v0.0.1 uses manual `targetDefaults` + README wiring.
- **CLI bin / Angular builder / `ng add`/`nx add`** -> deferred milestones; each reuses `normalizeOptions`-equivalent + `runTypecheck` + `renderReport` + `evaluateResult` (the D-02 maintainability acceptance test guards this).
- **A `mode` enum** alongside `failFast` -> not in v0.0.1 (the boolean is the cleaner contract).

None of the discussion drifted outside the Phase 4 boundary.
</deferred>

---

*Phase: 4-Nx Executor Adapter + Cacheable Target*
*Context gathered: 2026-06-28*
