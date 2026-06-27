# Follow-up Research Findings (consolidated)

Captures research done after the initial STACK/FEATURES/ARCHITECTURE/PITFALLS + SUMMARY round: Nx 23 release + changelog + inputs reference + deprecations reference, the local Angular source (framework + angular-cli), the local nrwl/nx clone (authoring + testing patterns), the AnalogJS clone, and an Nx-blog triage. This is the authoritative delta to apply to PROJECT.md decisions and to feed the roadmap/planner.

## Sources (all verified, 2026-06-27)

- Local Angular framework `D:/projects/github/angular/angular` (v22.1.0-next.3) + Angular CLI `D:/projects/github/angular/angular-cli` (v22.1.0-next.1).
- Local nrwl/nx clone `D:/projects/github/nrwl/nx`; push-based/nx-verdaccio (Nx 22.3.1); analogjs/analog (Angular ^22 / Nx 22.7.5, Vitest 4).
- nx.dev: Nx 23 release post, changelog (23 -> 20.1), Inputs reference, Deprecations reference (17 sub-pages), Nx 22.7 / 22.1 posts, s1ngularity post-mortem; Nx blog triage (201 posts).
- Brandon Roberts, "Angular Compilation, Type-Checking, and Build Bottlenecks" (2026-06-26).

## CORRECTIONS to PROJECT.md decisions (apply)

1. **Dependency model.** NOT "all peers." Per the official Nx publish-plugin recipe (verified against `@nx/js`/`@nx/plugin`/`nx-verdaccio` manifests): ship **`@nx/devkit` as a pinned `dependency`**, **do NOT declare `nx`** (devkit's peer carries it transitively), and keep **`@angular/compiler-cli` + `typescript` as `peerDependencies`** (Angular `^22` / TS `>=6.0 <6.1`). devkit-as-dependency is also REQUIRED for Nx plugin-registry listing. Use `@nx/dependency-checks` ESLint to police it.
2. **Test executor.** Use **`@nx/vitest:test`** (dedicated `@nx/vitest` package on Nx 23). NOT `@nx/vite:test` (Vitest moved out of `@nx/vite` in Nx 22.2; the sandbox's `@nx/vite:test` was the old stack).
3. **Module-format refinement.** CJS executor + `await import('@angular/compiler-cli')`, shipped as compiled `.js` -- but compile with **`module: node16`/`nodenext`** (NOT `commonjs`), else TypeScript downlevels `await import()` -> `require()` and hits `ERR_REQUIRE_ESM` at runtime (passes mock unit tests; fails only at real-compiler integration). Build-time assertion: the emitted `.js` must still contain `import(`.

## ADDITIONS (new requirements / phase notes)

- **Core Value differentiator (strong):** Nx already ships an inferred `typecheck` target via `@nx/js` that decouples type-check from build -- but it is plain `tsc`/`tsgo` and, per nx.dev, **"Angular currently lacks TypeScript project references support"**, so Angular projects cannot use that fast path, and it would not emit template/extended diagnostics anyway. angular-typechecker fills exactly this gap: an Angular-aware whole-program no-emit type-check. Differentiate explicitly from `@nx/js`'s `typecheck` (this also informs the deferred `typecheck`-naming hybrid).
- **Complete-gatherer (verified against Angular v22 source):** `ngc`/`defaultGatherDiagnostics` short-circuits by phase (skips `getNgSemanticDiagnostics` = template + extended on earlier-phase errors). The modern `@angular/build` builder does NOT -- it gathers option/syntactic/semantic independently and calls `getDiagnosticsForFile(sf, OptimizeFor.WholeProgram)` per file unconditionally. Model `@angular/build`: custom gatherer runs the Angular semantic phase UNCONDITIONALLY. `@nx/js`'s `run-type-check.ts` is the template for the result shape (`{errors, warnings, inputFilesCount, totalFilesCount}`); swap its `ts.createProgram`+`getPreEmitDiagnostics` for the Angular program + custom all-getter gather.
- **Cache inputs (precise; resolves the stale-cache false-PASS risk):** `cache: true`, **`outputs: []`** (no-emit). Inputs: the tsconfig's include/exclude globs + full `extends` chain + sibling `package.json`; **`^production` / `^{projectRoot}/**/*.ts` dependency filesets** (hash dependency SOURCE -- essential for non-buildable deps that emit no `.d.ts`); `{ dependentTasksOutputFiles: '**/*.d.ts', transitive: true }` for buildable deps; **`{ externalDependencies: ['typescript','@angular/compiler-cli'] }`** (mandatory -- Nx only auto-handles external deps for its OWN plugins). Root `tsconfig.base.json` is auto-considered. Verify with `nx show target inputs <t> --check <file>` and Nx Cloud Task Sandboxing (catches undeclared reads).
- **Diagnostic path base (Features GAP-1 + Pitfall 2):** filter/report on **absolute realpath-normalized `SourceFile.fileName`** (via host `getCanonicalFileName` + `realpath`), NOT the `formatDiagnostics` string (cwd-relative; Nx runs from workspace root). For GitHub Actions annotations emit **workspace-root-relative** paths. pnpm symlinks + case-insensitive FS break naive prefix filtering -> add a pnpm filter fixture.
- **Agent-ready output (v0.0.1 contract):** deterministic, idempotent/re-runnable, **clear non-zero exit on diagnostics**, informative-over-prescriptive error messages. Keep structured `ts.Diagnostic[]` at the gatherer boundary so deferred JSON/SARIF reporters are thin edge layers. The AI-agent-facing layer is a **skill** (procedural doc, deferred -- fits `nx configure-ai-agents`), NOT an MCP tool (Nx's stated direction: teach agents to run the CLI + parse).
- **Supply-chain / publish hardening (s1ngularity + securing-your-build-pipeline):** publish via **npm Trusted Publishers (OIDC)**, not a long-lived `NPM_TOKEN`; keep `provenance`; harden the release GitHub Actions workflow (read-only default `permissions`, no `pull_request_target` with untrusted input, SHA-pinned actions, manual-approval environment for publish); ship a `SECURITY.md`. Audit the actual `npm pack` tarball with `publint` + `attw --pack` (executors.json/schema.json/compiled `.js` must be present); the build must copy `executors.json` into `dist`.
- **Cache-correctness test:** a dedicated "dependency-error-busts-cache" test (a downstream type change must invalidate the consumer's cache).

## CONFIRMATIONS (no change; reassurance)

- FsTree: `import { FsTree, flushChanges } from 'nx/src/generators/tree'` IS still exported on Nx 23.0.1 (the `nx` package keeps the `./src/*` exports wildcard; the stricter-`exports`/`./internal` change applies to `@nx/<pkg>` plugin packages, not core `nx`). `createFsTree()`/`flushFsTreeChanges()` stand, quarantined + eslint-disabled.
- Vitest is Angular 21+'s DEFAULT runner (replaced Karma) -> validates Vitest + `tsconfig.spec.json` handling.
- 0.x semver + `nx release`: Nx 23 `version.adjustSemverBumpsForZeroMajorVersion` defaults `true` (breaking->minor, feature->patch).
- Nothing planned uses a deprecated Nx API: createNodes/createNodesV2 (not v1, removed Nx 20); `cache:true` (not cacheableOperations); `inputs` `{runtime}` (not runtimeCacheInputs); published-plugin local executor/generator (not workspace executors/generators); `as-provided` (derived removed); DB cache (not legacy-cache).

## Adoptable patterns from nrwl/nx (authoring)

- Executor: default `async` export, `PromiseExecutor<Schema>`, destructure `ExecutorContext`; `executors.json` extensionless `implementation`; `schema.json` `version: 2` + `cli: "nx"` + `outputCapture: "direct-nodejs"` + `x-completion-type`/`glob`.
- createNodes (deferred): glob `tsconfig*`/Angular config; `optionsHash` targets-cache for inference speed; inferred target `outputs: []` for no-emit.
- Packaging: `type: commonjs`, `files` whitelist incl. `executors.json`, `exports` with `./internal` boundary, `keywords: [nx, nx-plugin]`, `publishConfig`.
- Module boundaries: ESLint `@nx/enforce-module-boundaries` + `no-restricted-imports` to enforce the framework-agnostic `core/` vs adapter split.

## Adoptable patterns from nrwl/nx (testing -> our tiers)

- T1 (createNodes unit): `createNodesV2[1]` + `new TempFs(...)` (`packages/nx/src/internal-testing-utils/temp-fs.ts`) + file array + `toMatchInlineSnapshot`. (Deferred inference; design now.)
- T2 (executor unit/integration): hand-built `ExecutorContext` (`root,cwd,projectGraph,projectsConfigurations,nxJsonConfiguration,isVerbose,projectName,targetName`); mock `@angular/compiler-cli` at the pure-unit layer, real compiler at integration; `TempFs`/committed fixtures.
- T3 (one CLI smoke): real `nx run <proj>:angular-typecheck` (and, for inference later, `nx show project --json` + `toMatchObject`) -- proves CLI target resolution. Use `@nx/plugin/testing` (published), NOT `@nx/e2e-utils` (Nx-internal).
- T4 (publish/install gate, CI-only): `@nx/plugin:e2e-project` scaffold (`createTestProject()` = `create-nx-workspace` + install `@e2e`) + Verdaccio via `startLocalRegistry` + `nx release` (`releaseVersion`/`releasePublish`), wired through **Vitest `globalSetup`** (Nx's templates are Jest; port). The Connect tarball `file:` install remains a simpler alternative; pick one in the packaging/e2e phase.
- Runner: Nx repo is Jest-internally; we use Vitest (`vi.mock`/`await import()`); Vitest is Jest-API-compatible so the patterns port.

## Future-milestone context (not v0.0.1)

- `createNodes` (unsuffixed) for inference; `createNodesV2` is a deprecated alias (removed Nx 24). Plugin-order precedence: later plugin in `nx.json` wins same-named target (backs the `typecheck` override hybrid).
- tsgo: experimental `compiler: "tsgo"` in `@nx/js/typescript`; TS 7 (Go port, ~10x) is the longer-term tailwind for the decoupled check.
- Ship `migrations.json` once we have breaking changes (Nx evergreen-tooling pattern).
- Storybook 10 is ESM-only; the deferred `*.stories.ts` support pairs with `@analogjs/storybook-angular` / vitest-angular patterns.
- Angular CLI surface (deferred builder + `ng add`): use `convertNxExecutor(executor)` to re-export our Nx executor as an Angular **builder**, and `convertNxGenerator(generator)` as a **schematic** -- both CURRENT `@nx/devkit` APIs, NOT deprecated. Nx 17 only dropped Nx converting *its own* code for the Angular CLI (`@nx/angular` ships no `builders.json`); the wrapping APIs for *our* code remain. So the Angular-CLI adapters are thin re-exports over the same core + Nx executor/generator, not separate implementations. (`wrapAngularDevkitSchematic` does the reverse if ever needed.)
