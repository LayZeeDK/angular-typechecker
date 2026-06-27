# Phase 1: Workspace Bootstrap + Engine Spike (GATED) - Research

**Researched:** 2026-06-27
**Domain:** Nx 23 plugin authoring + Angular 22 compiler-cli programmatic diagnostics + CJS/ESM module bridge
**Confidence:** HIGH (GATE A emit empirically re-verified on locked TS 6.0.3 this session; GATE B differential read line-by-line from Angular v22 source; all package versions confirmed on the npm registry)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Bootstrap via **move-aside + create-nx-workspace-in-temp + copy + restore** (Mechanism B). Steps: confirm clean tree + capture HEAD; move `.planning/` + `CLAUDE.md` to a scratch dir outside the repo (root then holds only `.git/`); `create-nx-workspace@23.0.1` into a temp sibling dir with `--preset=apps`; copy generated contents (incl. dotfiles, excl. `node_modules`) into the repo root over the preserved `.git/`; restore `.planning/` + `CLAUDE.md`; `nx report` + review full `git status` before committing.
- **D-02:** `create-nx-workspace .` in-place is a HARD ERROR on a non-empty dir. CNW generates into a named subdir and `git init`s ONLY inside that subdir, so the pre-existing root `.git/` is provably never touched. `nx init` rejected (does not scaffold integrated `apps/`/`libs/` + `tsconfig.base.json`).
- **D-03:** Verify exact `23.0.1` flag spelling via `--help` before the real run; pass explicit flags (`--no-interactive`, `--nxCloud=skip`, `--skipGit`) because CNW branches on AI-agent env detection; confirm `cp -R ./.` copies dotfiles on Git Bash/Windows; align `defaultBase` to the repo's actual branch (CNW 23 defaults to `main`).
- **D-04:** Preset = **`--preset=apps`** (empty integrated workspace). Rejected `angular-monorepo` (forces a starter app) and `ts`/TS-solution (`isTsSolutionSetup` changes generator output; `apps` = classic `project.json`).
- **D-05:** Plugin at **`packages/angular-typechecker/`**. Generate with `nx g @nx/plugin:plugin --directory=packages/angular-typechecker --unitTestRunner=vitest`.
- **D-06:** **Minimal Phase-1 scaffold only:** plugin skeleton + one `apps/ng-spike-app` Angular 22 app + one green Vitest test. DEFER `testing/`, `fixtures/`, `e2e/`, reserved `src/plugin|cli|builders` subtrees.
- **D-07:** Spike's "real Angular 22 workspace" = first-party `apps/ng-spike-app/` (in-graph). Phase 6 e2e tarball fixtures are separate, out-of-graph -- do not conflate.
- **D-08:** **Tracer bullet (promote), NOT throwaway.** Build minimal `core/` (compiler-loader, all-getter gatherer, `runTypecheck`) at lean production quality; gate assertions become real tests. Keep it lean before GO.
- **D-09:** Prove NOW: GATE A (static + runtime) and GATE B (positive + differential) on ONE app + ONE local library, plus one cold-run wall-clock.
- **D-10:** DEFER (not the gate): 5-project-type matrix (P2/3), out-of-project/`node_modules` filtering (P3), exhaustive NG8xxx catalog (P2). Keep the ONE library.
- **D-11:** Build a **minimal Nx executor stub now** (default export -> `runTypecheck`, runnable via `nx run`). Set `package.json` `type: "commonjs"` DELIBERATELY (Nx #18801).
- **D-12:** GATE A static = **Vitest test that reads built `dist/.../executor.js`** via `fs.readFileSync` + regex: `/import\(/` present AND `/require\(["']@angular\/compiler-cli/` absent. Do NOT use `git grep` (`dist/` is gitignored). Runtime half satisfied by GATE B's run; assert no `ERR_REQUIRE_ESM`, no `UNKNOWN_ERROR_CODE`.
- **D-13:** Deliberate-error component in a **separate committed fixture dir with its own tsconfig** (`strictTemplates: true`, `noEmit: true`); EXCLUDED from the project graph; no workspace file imports it (TS #36017). Do NOT use `@ts-nocheck`.
- **D-14:** Author in P1: `type: "commonjs"`, `@nx/devkit` pinned dep `23.0.1`, `@angular/compiler-cli`+`typescript` PEER RANGES (`^22.0.0` / `>=6.0.0 <6.1.0`), `engines.node` (`^22.22.3 || ^24.15.0 || ^26.0.0`), version pins. DEFER `files`/`exports`/`keywords` to P5; `@nx/dependency-checks` to P3.
- **D-15:** Root workspace installs Angular/Nx/TS pinned EXACT (nx `23.0.1` / compiler-cli `22.0.4` / typescript `6.0.3`). Plugin-facing peer ranges stay broad.
- **D-16:** Engine = Approach A: `performCompilation({ rootNames, options, emitFlags: 0, gatherDiagnostics })` with custom `gatherDiagnostics` calling every getter UNCONDITIONALLY (incl. `getNgSemanticDiagnostics()`). `NgtscProgram` per-file path DEFERRED.
- **D-17:** GATE B fixture = single standalone component, `count: number = 'not a number';` (TS2322) + NG8109 (`status = signal('ready')` interpolated `{{ status }}`). Assert on CODES (2322 + 8109), not severity. Differential: `defaultGatherDiagnostics` returns 2322 but NOT 8109.
- **D-18:** Pin spike to STABLE Angular `22.0.4`; re-validate `OptimizeFor`/`getNgSemanticDiagnostics`/NG8109.

### Claude's Discretion

- Exact directory/file names within the minimal scaffold (`ng-spike-app`, fixture dir name), precise Vitest config layout, `nxCloud`/`.gitignore` merge mechanics -- planner/executor decide, consistent with the above.

### Deferred Ideas (OUT OF SCOPE)

- Out-of-project + `node_modules` filtering -> Phase 3 (OUT-02).
- Full 5-project-type matrix -> Phase 2/3 + Phase 6 e2e.
- Exhaustive NG8xxx catalog -> Phase 2 (TEST-02).
- ESLint + Prettier + `@nx/dependency-checks` + module-boundary enforcement -> Phase 3 (WS-04).
- Full executor adapter (schema.json, normalize-options, cacheable target) -> Phase 4 (EXE-01/06/07).
- `package.json` `files`/`exports`/`keywords` + publish hardening -> Phase 5 (PKG-01..04).
- `e2e/` tarball-install fixtures + cross-OS/multi-Node CI matrix -> Phase 6 (TEST-03, CI-01).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WS-01 | Repo is an Nx 23 integrated Angular monorepo (via `create-nx-workspace`) hosting the plugin package | Bootstrap runbook (Section 1) + scaffold layout (Section 2); CNW 23.0.1 flags verified against Nx source + registry |
| WS-02 | Plugin builds via `@nx/js:tsc` to CJS `.js`+`.d.ts` with `module: node16`/`nodenext`; build-time check asserts emitted executor `.js` still contains `import(` | Module/build mechanics (Section 3); empirical TS 6.0.3 emit table; `@nx/js:tsc` reads-but-never-reassigns `module` confirmed in `tsc.impl.ts` |
| WS-03 | Plugin unit/integration tests run via `@nx/vitest:test` (Vitest) | Vitest plumbing (Section 7); `@nx/vitest:test` uses `startVitest` -> Vite ESM transform |
| ENG-03 | Core loads ESM `@angular/compiler-cli` via `await import()` under the supported Node range | Engine core (Section 4); memoized `await import()` from `@angular/build`; `compiler-cli@22.0.4` confirmed `type:module` on registry |
| CMP-01 | Supports Nx 23 + Angular 22 + TS `>=6.0 <6.1` | All four pins verified `latest` on npm registry this session |
| CMP-02 | `engines.node = ^22.22.3 \|\| ^24.15.0 \|\| ^26.0.0` | `package.json` shape (Section 3); compiler-cli's own engines `^22.22.3 \|\| ^24.15.0 \|\| >=26.0.0` cross-checked |
</phase_requirements>

## Summary

Every high-risk unknown for Phase 1 is now either empirically verified or read directly from the locked-version source. The single most load-bearing claim -- that `@angular/compiler-cli@22`'s ESM-only `await import()` survives CJS emit -- was **re-verified this session by compiling a loader stub with the locked `typescript@6.0.3`**: `module: nodenext` and `module: node16` both emit a literal `await import('@angular/compiler-cli')`; `module: commonjs` downlevels it to `await Promise.resolve().then(() => __importStar(require('@angular/compiler-cli')))`, which throws `ERR_REQUIRE_ESM` against an ESM-only package. This is exactly GATE A. A critical, plannable trap: the `@nx/plugin:plugin` generator (under `--preset=apps`, non-TS-solution) emits `module: "commonjs"` by default in the generated `tsconfig.json` (`@nx/js` `library.ts` line 1132) -- the planner MUST add an explicit Edit task changing it to `nodenext`/`node16` or the gate fails by construction.

GATE B's differential is proven from `compiler-cli@v22` `perform_compile.ts`: `defaultGatherDiagnostics` is an `&&`-chain ending in `getNgSemanticDiagnostics()`, which is never evaluated after a TS semantic error -- so a co-located TS2322 silently suppresses the NG8109 extended diagnostic. The custom all-getter pushes every getter unconditionally (`getNgSemanticDiagnostics()` -> `NgtscProgram` -> `NgCompiler.getDiagnostics()` -> extended checks). NG8109 (`INTERPOLATED_SIGNAL_NOT_INVOKED`) and the `{{ signal }}` trigger are confirmed in the v22 extended-checks source; extended diagnostics default to WARNING category (hence assert on **code** 8109, not severity), and `strictTemplates` defaults to `true` unless explicitly `false`.

All six getter names (`getTsOptionDiagnostics`, `getNgOptionDiagnostics`, `getTsSyntacticDiagnostics`, `getTsSemanticDiagnostics`, `getNgStructuralDiagnostics`, `getNgSemanticDiagnostics`) and the `performCompilation({ rootNames, options, emitFlags, gatherDiagnostics })` signature are confirmed on the v22 `api.Program` interface and `perform_compile.ts`.

**Primary recommendation:** Bootstrap via Mechanism B with the verified CNW 23.0.1 flags, scaffold the plugin with `@nx/plugin:plugin`, then **immediately patch `tsconfig.lib.json`/`tsconfig.json` `module` to `nodenext`** before building -- this single edit is the difference between GATE A GO and NO-GO. Port the prototype's 17-line all-getter verbatim (it already calls all six getters), swap its static `import` for a memoized `await import()`, and drive both gates from one Vitest spec.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bootstrap the Nx workspace over existing `.git/` | Build/Workspace tooling (CNW + shell) | -- | One-time scaffolding; not runtime code |
| Load ESM compiler-cli from CJS | Core engine (`core/compiler-loader`) | -- | Framework-agnostic; the `await import()` bridge lives in core, never in the adapter |
| Gather all diagnostics unconditionally | Core engine (`core/gather-diagnostics`) | -- | Pure function over `api.Program`; zero Nx/CLI imports (ARCHITECTURE.md core/adapter split) |
| Run whole-program no-emit type-check | Core engine (`core/run-typecheck`) | -- | `performCompilation` orchestration; returns structured result |
| Invoke the core from `nx run` | Nx executor adapter (`executors/.../executor.ts`) | Core | Thin CJS default-export; the artifact GATE A inspects; only tier that imports `@nx/devkit` |
| Assert built `.js` retains `import(` | Test tier (Vitest, `fs.readFileSync`) | -- | Post-build static analysis of the emitted artifact |
| Provide a real Angular 22 type-check target | Angular app project (`apps/ng-spike-app`) | -- | In-graph app tsconfig the gate points `runTypecheck` at |
| Provide a co-located-error fixture | Out-of-graph fixture dir + own tsconfig | -- | Excluded from graph so the app stays green (D-13) |

## Standard Stack

> The locked stack lives in PROJECT.md/CLAUDE.md. This table is the Phase-1 subset, with versions re-verified on the npm registry on 2026-06-27.

### Core (root workspace -- pinned EXACT per D-15)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `nx` | `23.0.1` | Workspace runtime (flows in via devkit peer; not declared in plugin) | `[VERIFIED: npm registry]` `latest = 23.0.1` |
| `@nx/devkit` | `23.0.1` | Plugin API (`ExecutorContext`, `logger`); pinned **dependency** of the plugin | `[VERIFIED: npm registry]` peer `nx: ">= 22 <= 24 || ^23.0.0-0"` |
| `@nx/js` | `23.0.1` | `@nx/js:tsc` build executor (CJS `.js`+`.d.ts`) | `[VERIFIED: npm registry]` |
| `@nx/plugin` | `23.0.1` | `@nx/plugin:plugin` scaffold generator (devDependency, not shipped) | `[VERIFIED: npm registry]` deps pinned `23.0.1`; requires `directory`, supports `--unitTestRunner=vitest` |
| `@nx/vitest` | `23.0.1` | `@nx/vitest:test` Vitest executor | `[VERIFIED: npm registry]` peer `vitest: "^3.0.0 \|\| ^4.0.0"` |
| `@nx/angular` | `23.0.1` | `@nx/angular:application` generator for `apps/ng-spike-app` | `[VERIFIED: npm registry]` |
| `@angular/compiler-cli` | `22.0.4` | The type-check engine (ESM-only, `await import()`) | `[VERIFIED: npm registry]` `latest = 22.0.4`, `type:"module"`, engines `^22.22.3 \|\| ^24.15.0 \|\| >=26.0.0` |
| `typescript` | `6.0.3` | Compiles the plugin AND a runtime peer | `[VERIFIED: npm registry]` `latest = 6.0.3` |
| `vitest` | `4.1.9` | Test runner | `[VERIFIED: npm registry]` in `@nx/vitest@23.0.1` accepted range |
| `tslib` | `2.8.1` (`^2.3.0`) | `importHelpers` runtime helper; plugin **dependency** | `[VERIFIED: npm registry]` |

### Alternatives Considered (all rejected/deferred per locked decisions -- listed for completeness only)

| Instead of | Could Use | Why rejected (decision) |
|------------|-----------|-------------------------|
| Approach A (`performCompilation` + all-getter) | `NgtscProgram` + `getDiagnosticsForFile(sf, OptimizeFor.WholeProgram)` per-file | Far more code (affected-file bookkeeping, `analyzeAsync`, incremental state -- see `aot-compilation.ts`); DEFERRED (D-16) |
| `--preset=apps` | `angular-monorepo` / `ts` (TS-solution) | `angular-monorepo` forces a starter app; `ts` flips `isTsSolutionSetup` (different generator output) (D-04) |
| `@nx/js:tsc` | `@nx/esbuild` / `@nx/js:swc` | swc skips type-checking; esbuild bundles -- both wrong for a `require()`-loaded multi-file executor (PROJECT.md) |
| `@nx/vitest:test` | `@nx/vite:test` | Vitest moved to `@nx/vitest` in Nx 22.2 (`migrate-vitest-to-vitest-package`); `@nx/vite:test` is legacy |
| devkit as pinned dependency | devkit as peerDependency (the Analog `@analogjs/platform` model) | Loses tested-version pin AND disqualifies Nx registry listing (D-14, CLAUDE.md) |

**Installation (root workspace, after bootstrap):**
```bash
# Root devDependencies (exact pins, D-15) -- most arrive via the CNW preset + generators
npm install --save-dev --save-exact nx@23.0.1 @nx/devkit@23.0.1 @nx/js@23.0.1 \
  @nx/plugin@23.0.1 @nx/vitest@23.0.1 @nx/angular@23.0.1 typescript@6.0.3
# compiler-cli installed at ROOT as a devDependency so the spike app + core resolve it,
# while it stays a peerDependency in the PLUGIN's own package.json (D-05 watch-note):
npm install --save-dev --save-exact @angular/compiler-cli@22.0.4
```

**Version verification (run before writing pins):**
```bash
npm view nx@23.0.1 version
npm view @angular/compiler-cli@22.0.4 type engines   # confirm "module" + node range
npm view typescript@6.0.3 version
```

## Package Legitimacy Audit

> slopcheck install was denied by the sandbox classifier (undeclared package). All packages below are first-party, long-established official org packages already locked in PROJECT.md/CLAUDE.md; verified individually via `npm view` (registry, age, source repo). No new/untrusted packages are introduced in Phase 1.

| Package | Registry | Age (created) | Source Repo | slopcheck | Disposition |
|---------|----------|---------------|-------------|-----------|-------------|
| `nx` | npm | 2023-04 (org since) | github.com/nrwl/nx | unavailable | Approved (official) |
| `@nx/devkit` | npm | 2023-04-17 | github.com/nrwl/nx | unavailable | Approved (official) |
| `@nx/js` | npm | 2023-04 | github.com/nrwl/nx | unavailable | Approved (official) |
| `@nx/plugin` | npm | 2023-04-20 | github.com/nrwl/nx | unavailable | Approved (official) |
| `@nx/vitest` | npm | 2025-11-10 | github.com/nrwl/nx | unavailable | Approved -- newest of the set, but the documented `@nx/vite`->`@nx/vitest` split; official nrwl package |
| `@nx/angular` | npm | 2023-04-17 | github.com/nrwl/nx | unavailable | Approved (official) |
| `@angular/compiler-cli` | npm | 2016-05-03 | github.com/angular/angular | unavailable | Approved (official) |
| `typescript` | npm | 2012-10-01 | github.com/microsoft/TypeScript | unavailable | Approved (official) |
| `tslib` | npm | 2014-12-30 | github.com/Microsoft/tslib | unavailable | Approved (official) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none (`@nx/vitest`'s recent creation date is expected -- it is the official package the Nx 22.2 migration moves Vitest support into)

## Architecture Patterns

### System Architecture Diagram (Phase 1 gate path)

```
   bootstrap (Mechanism B)
       |
       v
  Nx 23 integrated workspace  ----------------------------------------+
  (apps/ng-spike-app, packages/angular-typechecker)                   |
       |                                                              |
       |  nx build angular-typechecker  (@nx/js:tsc, module: nodenext)|
       v                                                              |
  dist/packages/angular-typechecker/src/executors/.../executor.js     |
       |                                                              |
       |  [GATE A static]  fs.readFileSync + regex                    |
       |     /import\(/ present  &&  /require\(['"]@angular...        |
       |       /compiler-cli/ absent                                  |
       v                                                              |
  ==== GATE A static PASS/FAIL ====                                   |
                                                                      |
  Vitest spec (WS-03) ------------------------------------------------+
       |
       |  import default executor (or call runTypecheck directly)
       |  point tsConfig at the FIXTURE tsconfig (app variant, then lib variant)
       v
  core/run-typecheck
       |  await loadCompilerCli()  --- memoized await import('@angular/compiler-cli')
       |       (this is the [GATE A runtime] path: no ERR_REQUIRE_ESM)
       v
  readConfiguration(tsConfig)  ->  { rootNames, options, errors }
       |
       v
  performCompilation({ rootNames, options, emitFlags: 0, gatherDiagnostics: gatherAll })
       |                                          |
       |  gatherAll(program):                     |  (differential)
       |    getTsOptionDiagnostics                |  defaultGatherDiagnostics(sameProgram)
       |    getNgOptionDiagnostics                |    &&-chain short-circuits
       |    getTsSyntacticDiagnostics             |    after TS2322 error
       |    getTsSemanticDiagnostics  (TS2322)    |    -> getNgSemanticDiagnostics()
       |    getNgStructuralDiagnostics            |       NEVER evaluated
       |    getNgSemanticDiagnostics  (NG8109) <--+    -> codes: {2322} only
       v
  CoreResult { diagnostics, codes: {2322, 8109}, errorCount, warningCount, durationMs }
       |
       |  [GATE B positive]  codes include 2322 AND 8109
       |  [GATE B differential]  default-gatherer codes include 2322, NOT 8109
       |  [GATE A runtime]  no UNKNOWN_ERROR_CODE (500) in diagnostics
       |  [timing]  durationMs recorded once (cold run)
       v
  ==== GATE B PASS/FAIL ====   x2 (one app tsconfig, one local-library tsconfig)
```

### Recommended Project Structure (Phase 1 minimal)

```
angular-typechecker/                              # the repo root (over preserved .git/)
|-- apps/
|   '-- ng-spike-app/                             # @nx/angular:application standalone app
|-- packages/
|   '-- angular-typechecker/
|       |-- src/
|       |   |-- index.ts                          # re-exports core (export surface)
|       |   |-- core/
|       |   |   |-- compiler-loader.ts            # memoized await import()
|       |   |   |-- gather-diagnostics.ts         # 6-getter all-getter (ported)
|       |   |   '-- run-typecheck.ts              # CoreOptions -> CoreResult
|       |   '-- executors/
|       |       '-- angular-typecheck/
|       |           |-- executor.ts               # default export -> runTypecheck (GATE A artifact)
|       |           |-- schema.json               # minimal v2 schema (cli: "nx")
|       |           '-- schema.d.ts                # AngularTypecheckExecutorOptions
|       |-- executors.json                        # maps angular-typecheck -> executor
|       |-- package.json                          # type:commonjs, devkit dep, peers, engines
|       |-- project.json                          # @nx/js:tsc build + @nx/vitest:test
|       |-- tsconfig.json                          # solution; module: nodenext (PATCH from generated commonjs!)
|       |-- tsconfig.lib.json                      # build includes; excludes specs+fixtures
|       |-- tsconfig.spec.json                     # vitest includes
|       '-- src/**/*.spec.ts                       # GATE A + GATE B + one green smoke test
|-- fixtures/gate-b-error/                         # OUT OF GRAPH (D-13): committed, own tsconfig
|   |-- error.component.ts                         # TS2322 + signal property
|   |-- error.component.html                       # {{ status }} interpolation (NG8109)
|   '-- tsconfig.json                              # strictTemplates:true, noEmit:true
|-- nx.json / tsconfig.base.json / package.json (root) / eslint.config.mjs   # from CNW
```

### Pattern 1: Memoized `await import()` compiler-loader (ENG-03, GATE A runtime)
**What:** A CJS module that loads the ESM-only compiler-cli lazily and memoizes it.
**When to use:** The single entry to all compiler-cli APIs in core. Modeled on `@angular/build` `AngularCompilation.loadCompilerCli()`.
```typescript
// core/compiler-loader.ts
// Source: D:/projects/github/angular/angular-cli/packages/angular/build/src/tools/angular/compilation/angular-compilation.ts:34-38
// Re-validated against @angular/compiler-cli@22.0.4 (type:"module"); compiled with module: nodenext (TS 6.0.3 emit verified this session)
import type * as ng from '@angular/compiler-cli';

let cached: typeof ng | undefined;

export async function loadCompilerCli(): Promise<typeof ng> {
  cached ??= await import('@angular/compiler-cli');

  return cached;
}
```
> NOTE on the static-token gate: keep the literal substring `import(` out of source comments in `executor.ts`/`compiler-loader.ts`, OR have the GATE A check strip comment lines before matching, so the regex matches the real `await import(` call and not a comment. (Verified this session: my naive `rg "import\("` matched a comment line; the precise check on code lines is what matters.)

### Pattern 2: Unconditional all-getter gatherer (ENG-03/GATE B)
**What:** A `gatherDiagnostics` that pushes every getter's output without an `&&` short-circuit.
**When to use:** Passed as `gatherDiagnostics` to `performCompilation`. Ported verbatim from the prototype (which already calls all six getters); only the import style changes.
```typescript
// core/gather-diagnostics.ts
// Source: D:/projects/sandbox/.../executors/angular-typecheck/executor.ts:19-37 (prototype, ported)
// Getter names re-validated against @angular/compiler-cli@v22 src/transformers/api.ts:191-240
import type ts from 'typescript';
import type { Program } from '@angular/compiler-cli';

export function gatherAllDiagnostics(program: Program): readonly ts.Diagnostic[] {
  const all: ts.Diagnostic[] = [];

  all.push(...program.getTsOptionDiagnostics());
  all.push(...program.getNgOptionDiagnostics());
  all.push(...program.getTsSyntacticDiagnostics());
  all.push(...program.getTsSemanticDiagnostics());        // surfaces TS2322
  all.push(...program.getNgStructuralDiagnostics());
  all.push(...program.getNgSemanticDiagnostics());        // surfaces NG8109 -- the getter ngc skips

  return all;
}
```

### Pattern 3: `runTypecheck(CoreOptions): Promise<CoreResult>` (D-08/D-16)
**What:** The promoted core entry. Loads compiler-cli, reads config, runs `performCompilation` with the all-getter, returns a structured result the gate asserts on.
```typescript
// core/run-typecheck.ts
// Signature of performCompilation confirmed at compiler-cli@v22 src/perform_compile.ts:255-279
import type ts from 'typescript';
import { loadCompilerCli } from './compiler-loader';
import { gatherAllDiagnostics } from './gather-diagnostics';

export interface CoreOptions {
  tsConfigPath: string;
}

export interface CoreResult {
  diagnostics: readonly ts.Diagnostic[];
  codes: number[];                 // for code-based assertions (D-17)
  errorCount: number;
  warningCount: number;
  durationMs: number;              // cold-run timing (gate item 6)
}

export async function runTypecheck(options: CoreOptions): Promise<CoreResult> {
  const ng = await loadCompilerCli();                       // GATE A runtime path
  const parsed = ng.readConfiguration(options.tsConfigPath);

  if (parsed.errors.length > 0) {
    // surface config errors as the result (do not throw)
  }

  const start = performance.now();
  const result = ng.performCompilation({
    rootNames: parsed.rootNames,
    options: { ...parsed.options, noEmit: true },
    emitFlags: 0 as ng.EmitFlags,                           // 0 = no emit (prototype used `0 as EmitFlags`)
    gatherDiagnostics: gatherAllDiagnostics,
  });
  const durationMs = performance.now() - start;

  const tsLib = (await import('typescript')).default ?? (await import('typescript'));
  const errorCount = result.diagnostics.filter((d) => d.category === tsLib.DiagnosticCategory.Error).length;

  return {
    diagnostics: result.diagnostics,
    codes: result.diagnostics.map((d) => d.code),
    errorCount,
    warningCount: result.diagnostics.length - errorCount,
    durationMs,
  };
}
```
> The differential half (GATE B) calls `ng.performCompilation({ ..., gatherDiagnostics: ng.defaultGatherDiagnostics })` on an equivalently-configured program and asserts `codes` includes 2322 but NOT 8109. Build the two `performCompilation` calls from the SAME parsed config so the only variable is the gatherer.

### Pattern 4: Minimal Nx executor stub (D-11, GATE A artifact)
```typescript
// executors/angular-typecheck/executor.ts
// Default-export signature confirmed at nx-verdaccio src/executors/kill-process/executor.ts:17-19
import type { ExecutorContext } from '@nx/devkit';
import type { AngularTypecheckExecutorOptions } from './schema';
import { runTypecheck } from '../../core/run-typecheck';

export default async function angularTypecheckExecutor(
  options: AngularTypecheckExecutorOptions,
  _context: ExecutorContext,
): Promise<{ success: boolean }> {
  const result = await runTypecheck({ tsConfigPath: options.tsConfig });

  return { success: result.errorCount === 0 };
}
```

### Anti-Patterns to Avoid
- **Static `import { performCompilation } from '@angular/compiler-cli'` in the shipped executor:** compiles to `require()` under any module setting where the bridge is needed; on v22 it throws `ERR_REQUIRE_ESM`. This is the exact prototype line Phase 1 fixes (use the memoized `await import()` of Pattern 1).
- **Leaving the generated `module: "commonjs"` in the plugin tsconfig:** the `@nx/plugin:plugin` generator emits CommonJS by default (see Pitfall 1) -- guarantees GATE A NO-GO.
- **`@ts-nocheck` on the fixture:** the errors ARE the gate input (D-13).
- **Any workspace file importing the fixture:** TS `exclude` does NOT stop type-checking of imported files (TS #36017) -- a stray import re-introduces the errors into `ng-spike-app` and breaks its green smoke status.
- **Asserting on diagnostic severity/`errorCount` for NG8109:** extended diagnostics default to WARNING (confirmed in source) -- assert on **code 8109** (D-17).
- **`git grep` against `dist/`:** `dist/` is gitignored -> silent zero matches (per CLAUDE.md). Use `fs.readFileSync` in the Vitest spec or `rg -uu`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Read/merge tsconfig + `angularCompilerOptions` (incl. `extends` chain) | Custom JSON merge | `readConfiguration` (compiler-cli) | Handles the `extends` reverse-merge of `angularCompilerOptions` recursively (`perform_compile.ts:85-122`); also returns `rootNames`, `emitFlags`, config errors |
| Whole-program no-emit type-check | Custom `ts.Program` wiring | `performCompilation({ emitFlags: 0, gatherDiagnostics })` | Creates the `NgtscProgram`, runs the gatherer, skips emit when errors exist; the canonical Angular entry |
| Diagnostic formatting | Manual codeframe | `formatDiagnostics` (compiler-cli) | NG-aware codeframes (deferred to OUT-01, but available now) |
| Dynamic ESM-from-CJS load | `createRequire`/eval hacks | `await import()` compiled under `module: nodenext` | Native, downlevel-free on TS 6.0.3 (verified) -- the `@angular/build` model |
| `executors.json` asset copy in build | Hand-write `assets` globs | `@nx/plugin:plugin` generator output | Auto-injects the correct `@nx/js:tsc` asset globs (`executors.json` -> `.`, `**/!(*.ts)`, `**/*.d.ts`) -- confirmed in nx-verdaccio `project.json` |

**Key insight:** compiler-cli's public surface (`readConfiguration`, `performCompilation`, `defaultGatherDiagnostics`, `formatDiagnostics`, `EmitFlags`, `UNKNOWN_ERROR_CODE`, `Program`) is everything the gate needs; the only custom code is the 6-line all-getter and the loader.

## Runtime State Inventory

> This phase is greenfield except for the in-place bootstrap over `.git/`, `.planning/`, `CLAUDE.md`. The bootstrap is a filesystem operation, not a data migration -- but the move-aside/restore has state-preservation hazards worth tabulating.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None -- no datastores exist yet | None |
| Live service config | None -- no external services | None |
| OS-registered state | None | None |
| Secrets/env vars | None in repo; CNW reads `CLAUDECODE`/`OPENCODE` env to detect AI-agent mode (changes prompts/output) | Pass explicit flags so env detection cannot alter behavior (D-03) |
| Build artifacts | None pre-existing | None |
| **Tracked files to preserve across bootstrap** | `.git/` (history + HEAD), `.planning/` (all planning artifacts), `CLAUDE.md` (project instructions) | Mechanism B: capture HEAD; move `.planning/`+`CLAUDE.md` out; CNW into temp; copy generated (incl. dotfiles, excl. `node_modules`) over preserved `.git/`; restore `.planning/`+`CLAUDE.md`; review full `git status` before commit |

**Verified explicitly:** CNW's `initializeGitRepo(directory, ...)` runs `git init` ONLY inside the generated subdir and ONLY when `!skipGit` (`create-workspace.ts:238-245`); with `--skipGit` and generation into a temp sibling, the repo's root `.git/` is never in scope. Confirmed against Nx source (clone at `23.1.0-beta.4`).

## Common Pitfalls

### Pitfall 1: The generator emits `module: "commonjs"` -- GATE A fails by construction
**What goes wrong:** `@nx/plugin:plugin --preset=apps` (non-TS-solution) generates a plugin `tsconfig.json` with `"module": "commonjs"`. Building as-is downlevels `await import()` to `require()`, breaking GATE A.
**Why it happens:** `@nx/js` `library.ts` `getCompilerOptions()` returns `module: options.isUsingTsSolutionConfig ? ... : 'commonjs'` (line 1128-1132). With `--preset=apps`, `isUsingTsSolutionConfig` is false -> `'commonjs'`. **Verified in Nx source.**
**How to avoid:** Add an explicit Edit task after scaffolding: set `module: "nodenext"` (and `moduleResolution: "nodenext"`) in the plugin's `tsconfig.json`/`tsconfig.lib.json`. Keep `package.json` `type: "commonjs"`.
**Warning signs:** Built `executor.js` contains `__importStar(require("@angular/compiler-cli"))`; runtime `ERR_REQUIRE_ESM`.

### Pitfall 2: `@nx/js:tsc` is blamed for module changes -- it is not
**What goes wrong:** Fear that `@nx/js:tsc` rewrites `module` for compilation.
**Why it happens:** Conflation with `determineModuleFormatFromTsConfig`, which only READS `module` to LABEL the package as cjs/esm (`tsc.impl.ts:26-64`) and only runs `updatePackageJson` when `generatePackageJson` is true (line 130).
**How to avoid:** Trust the tsconfig. `compile-typescript-files.ts` has zero `module` reassignment (verified). With `module: nodenext` + `package.json type: "commonjs"`, `determineModuleFormatFromTsConfig` returns `'cjs'` (line 36-51) AND emit keeps literal `import(` -- both correct. Set `generatePackageJson: false` (hand-author the publishable manifest).

### Pitfall 3: Co-located TS error silently suppresses NG8109 in `ngc`
**What goes wrong:** Running `ngc`/`defaultGatherDiagnostics` and concluding "Angular doesn't report NG8109 here" -- when in truth it was short-circuited.
**Why it happens:** `defaultGatherDiagnostics` is an `&&`-chain (`perform_compile.ts:339-359`): after `getTsSemanticDiagnostics()` yields a TS error, `checkOtherDiagnostics` becomes false and `getNgSemanticDiagnostics()` (the last term) is never evaluated.
**How to avoid:** This IS the feature under test. The all-getter pushes every getter unconditionally. The differential assertion (default-gatherer returns 2322 but NOT 8109) proves the all-getter does something `ngc` does not.

### Pitfall 4: `strictTemplates` lost through the `extends` chain
**What goes wrong:** Fixture tsconfig `extends` a base that disables strict templates, so NG8109 never fires.
**Why it happens:** `readConfiguration` reverse-merges `angularCompilerOptions` across `extends` (`perform_compile.ts:110-121`); a base value can override.
**How to avoid:** Set `angularCompilerOptions.strictTemplates: true` DIRECTLY in the fixture tsconfig (most-derived wins). Note: `strictTemplates` defaults to `true` unless explicitly `false` (`compiler.ts:1056`), but make it explicit so the fixture is self-contained.
**Warning signs:** GATE B positive returns 2322 but not 8109 even with the all-getter.

### Pitfall 5: Windows/Git Bash dotfile copy drops `.gitignore`/`.editorconfig`
**What goes wrong:** `cp -R <temp>/* <root>/` skips dotfiles; the workspace loses `.gitignore`, `.editorconfig`, `.prettierrc`, `.vscode/`.
**Why it happens:** Glob `*` does not match dotfiles by default.
**How to avoid:** Use a dotfile-safe copy. Reliable forms on Git Bash/Windows: `cp -R <temp>/. <root>/` (trailing `/.` copies the directory contents including dotfiles), or `(shopt -s dotglob; cp -R <temp>/* <root>/)`, or `rsync -a --exclude node_modules <temp>/ <root>/`. **Verify after copy** that `.gitignore` landed (`git status` should show it). Exclude `node_modules` from the copy and reinstall in root.

### Pitfall 6: ESM load failure masquerades as a diagnostic
**What goes wrong:** A failed `await import('@angular/compiler-cli')` is caught by `performCompilation`'s try/catch and surfaced as a diagnostic with `code: UNKNOWN_ERROR_CODE` (500) -- the gate could mistake it for "ran but produced diagnostics."
**Why it happens:** `performCompilation` catch block pushes `{ code: api.UNKNOWN_ERROR_CODE, ... }` (`perform_compile.ts:314-325`); `readConfiguration` does the same on throw (line 167-180).
**How to avoid:** GATE A runtime assertion = `codes` must NOT include `500` (`UNKNOWN_ERROR_CODE`) and the run must not reject with `ERR_REQUIRE_ESM`. If the loader itself rejects, it happens before `performCompilation`, so also wrap the gate's `runTypecheck` call and assert it resolves.

## Code Examples

### GATE A static check (Vitest, reads built artifact -- WS-02, D-12)
```typescript
// gate-a-static.spec.ts
// dist/ is gitignored -> fs.readFileSync, NOT git grep (CLAUDE.md)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const BUILT = join(
  __dirname, '../../../../dist/packages/angular-typechecker/src/executors/angular-typecheck/executor.js',
);

describe('GATE A static', () => {
  it('built executor retains literal import( and never require()s compiler-cli', () => {
    const code = readFileSync(BUILT, 'utf-8')
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('//'))   // ignore comments
      .join('\n');

    expect(code).toMatch(/import\(/);
    expect(code).not.toMatch(/require\(["']@angular\/compiler-cli/);
  });
});
```

### GATE B positive + differential (Vitest, one app + one lib -- D-09/D-17)
```typescript
// gate-b.spec.ts
import { describe, it, expect } from 'vitest';
import { loadCompilerCli } from '../core/compiler-loader';
import { gatherAllDiagnostics } from '../core/gather-diagnostics';

const FIXTURE_APP_TSCONFIG = '/abs/path/to/fixtures/gate-b-error/tsconfig.app.json';
const FIXTURE_LIB_TSCONFIG = '/abs/path/to/fixtures/gate-b-error/tsconfig.lib.json';

async function codesFor(tsConfigPath: string, useDefault: boolean): Promise<number[]> {
  const ng = await loadCompilerCli();                          // GATE A runtime: no ERR_REQUIRE_ESM
  const parsed = ng.readConfiguration(tsConfigPath);
  const result = ng.performCompilation({
    rootNames: parsed.rootNames,
    options: { ...parsed.options, noEmit: true },
    emitFlags: 0 as ng.EmitFlags,
    gatherDiagnostics: useDefault ? ng.defaultGatherDiagnostics : gatherAllDiagnostics,
  });
  return result.diagnostics.map((d) => d.code);
}

describe.each([
  ['app tsconfig', FIXTURE_APP_TSCONFIG],
  ['local-library tsconfig', FIXTURE_LIB_TSCONFIG],
])('GATE B on %s', (_label, tsConfigPath) => {
  it('all-getter surfaces BOTH 2322 and 8109 (positive)', async () => {
    const codes = await codesFor(tsConfigPath, false);
    expect(codes).toContain(2322);
    expect(codes).toContain(8109);
    expect(codes).not.toContain(500);                          // no UNKNOWN_ERROR_CODE (GATE A runtime)
  });

  it('defaultGatherDiagnostics surfaces 2322 but NOT 8109 (differential)', async () => {
    const codes = await codesFor(tsConfigPath, true);
    expect(codes).toContain(2322);
    expect(codes).not.toContain(8109);
  });
});
```

### GATE B fixture component (D-17)
```typescript
// fixtures/gate-b-error/error.component.ts  (OUT OF GRAPH; nothing imports it)
// Source pattern: prototype test-fixtures.ts injectInterpolatedSignalNotInvokedError (NG8109) + injectTypeScriptError (TS2322)
import { Component, signal } from '@angular/core';

@Component({
  selector: 'gate-b-error',
  standalone: true,
  templateUrl: './error.component.html',
})
export class GateBErrorComponent {
  count: number = 'not a number';     // TS2322
  status = signal('ready');           // referenced un-invoked below -> NG8109
}
```
```html
<!-- fixtures/gate-b-error/error.component.html -->
<p>{{ status }}</p>   <!-- NG8109 INTERPOLATED_SIGNAL_NOT_INVOKED (must be status(), not status) -->
```
```jsonc
// fixtures/gate-b-error/tsconfig.app.json  (the lib variant differs only in rootNames/references)
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true, "moduleResolution": "bundler" },
  "angularCompilerOptions": { "strictTemplates": true },   // set DIRECTLY (Pitfall 4)
  "files": ["error.component.ts"]
}
```
> **App vs lib breadth (D-09/D-10):** the "library" variant points `rootNames` at a library-style tsconfig. Keep the SAME error component; only the tsconfig shape (`files`/`include`, optional `compositeReferences`, lib-style `rootDir`) differs. Libraries are the type most likely to expose a `rootNames` resolution difference -- that is the reason to test a second tsconfig at all (D-10).

### Bootstrap runbook (Mechanism B -- D-01/D-02/D-03, WS-01)
```bash
# 0. Preconditions (Git Bash)
git status --porcelain            # must be clean
HEAD_BEFORE=$(git rev-parse HEAD) # record for post-bootstrap verification
BR=$(git rev-parse --abbrev-ref HEAD)   # the repo's actual default branch (align defaultBase)

# 1. Move tracked planning artifacts aside (root then holds only .git/)
SCRATCH="$(mktemp -d)"
git mv -k .planning "$SCRATCH/.planning" 2>/dev/null || mv .planning "$SCRATCH/"   # prefer plain mv: keep out of index churn
mv CLAUDE.md "$SCRATCH/"

# 2. Confirm flag spelling FIRST (D-03), then generate into a temp sibling
npx create-nx-workspace@23.0.1 --help            # confirm --preset/--nxCloud/--skipGit/--defaultBase
npx create-nx-workspace@23.0.1 atc-temp \
  --preset=apps \
  --packageManager=npm \
  --nxCloud=skip \
  --skipGit \
  --no-interactive \
  --defaultBase="$BR"

# 3. Copy generated contents (incl. dotfiles, excl. node_modules) over the preserved .git/
cp -R atc-temp/. ./                              # trailing /. copies dotfiles (Pitfall 5)
rm -rf ./node_modules atc-temp                   # do not carry the temp install
git status                                       # verify .gitignore/.editorconfig landed

# 4. Restore planning artifacts
mv "$SCRATCH/.planning" ./
mv "$SCRATCH/CLAUDE.md" ./

# 5. Install + verify
npm install
npx nx report                                    # confirms nx 23.0.1 + plugins resolved
git status                                       # FULL review before any commit
test "$(git rev-parse HEAD)" = "$HEAD_BEFORE"    # history preserved (HEAD unchanged)
```
> **AI-agent env note (D-03, verified):** CNW's `isAiAgent()` reads `CLAUDECODE=1`/`OPENCODE=1` and switches to "auto non-interactive, NDJSON output" (`create-nx-workspace.ts:324-344`). Passing `--no-interactive` + the explicit flags above makes behavior deterministic regardless of env detection.

### Scaffold invocations (D-05/D-06)
```bash
# Plugin (directory as-provided since Nx 16 -- no libs/ prefix). Then PATCH module (Pitfall 1).
npx nx g @nx/plugin:plugin --directory=packages/angular-typechecker --unitTestRunner=vitest --no-interactive
# -> generates src/, executors.json, package.json, project.json (@nx/js:tsc build + @nx/vitest:test),
#    tsconfig.{json,lib,spec}.json (module DEFAULTS TO commonjs -- must change to nodenext)

# Spike app (real Angular 22 type-check target)
npx nx g @nx/angular:application --directory=apps/ng-spike-app --standalone --no-interactive
```

### Plugin `package.json` (Phase 1 scope -- D-14)
```jsonc
{
  "name": "angular-typechecker",
  "version": "0.0.1",
  "type": "commonjs",                              // DELIBERATE (Nx #18801; D-11/D-14)
  "main": "./src/index.js",
  "types": "./src/index.d.ts",
  "executors": "./executors.json",
  "dependencies": {
    "@nx/devkit": "23.0.1",                        // pinned dependency; carries nx via its peer
    "tslib": "^2.3.0"
  },
  "peerDependencies": {
    "@angular/compiler-cli": "^22.0.0",
    "typescript": ">=6.0.0 <6.1.0"
  },
  "engines": {
    "node": "^22.22.3 || ^24.15.0 || ^26.0.0"      // CMP-02
  }
  // DEFER files/exports/keywords/repository.url to Phase 5; do NOT declare `nx`.
}
```

### Plugin `tsconfig` (after the Pitfall-1 patch -- WS-02)
```jsonc
// packages/angular-typechecker/tsconfig.json  (solution)
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "nodenext",                          // PATCHED from generated "commonjs"
    "moduleResolution": "nodenext",
    "verbatimModuleSyntax": false,                 // keeps the await import() bridge type-checking cleanly (nx-verdaccio convention)
    "ignoreDeprecations": "6.0"                    // include if carrying older option shapes on TS 6 (Analog base sets it)
  },
  "files": [],
  "include": [],
  "references": [{ "path": "./tsconfig.lib.json" }, { "path": "./tsconfig.spec.json" }]
}
// tsconfig.lib.json: declaration:true, types:["node"], outDir, resolveJsonModule:true,
//   include ["src/**/*.ts"], EXCLUDE "src/**/*.spec.ts" + the fixtures dir.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static `import '@angular/compiler-cli'` (CJS-requireable) | `await import()` compiled under `module: nodenext` | Angular compiler-cli went ESM-only (`type:"module"`) | The prototype's static import (Angular 18) breaks on v22 (`ERR_REQUIRE_ESM`); the bridge is mandatory now |
| `@nx/vite:test` | `@nx/vitest:test` (`@nx/vitest` package) | Nx 22.2 (`migrate-vitest-to-vitest-package`) | Use `@nx/vitest:test` on Nx 23 |
| `create-nx-workspace .` always errors | CNW 23.1 supports `.` for an EMPTY dir (`resolveSpecialFolderName`); still errors on non-empty | Nx 23.1 (clone) | Our repo is non-empty (`.git/` etc.) -> in-place still fails -> Mechanism B stands (D-01) |
| `module: commonjs` plugin tsconfig | `module: nodenext` | Required by ESM-only compiler-cli | Must override the generator default (Pitfall 1) |

**Deprecated/outdated:**
- nx-verdaccio's `tsconfig.json` `module: "CommonJS"` and legacy `.eslintrc.json`: Nx 22-era; do NOT copy verbatim for module config (its package.json/executors.json/asset-copy SHAPES are still good references).
- `@analogjs/platform`'s `@nx/devkit` as peerDependency: the OLD model; PROJECT.md/CLAUDE.md require devkit as a pinned dependency.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact byte-for-byte emit of the REAL `@nx/js:tsc` build (with tslib `importHelpers` + `type:"commonjs"`) keeps a literal `import(`, matching the raw-`tsc` emit I verified this session | Module/build | LOW -- `@nx/js:tsc` proven to not reassign `module`; but the gate's own GATE A static check is the backstop, so a wrong assumption is caught, not shipped |
| A2 | NG8109 still fires on STABLE Angular 22.0.4 (source read at `22.1.0-next.3`; registry confirms 22.0.4 same major) | Engine/GATE B | LOW-MED -- D-18 explicitly schedules re-validation; the gate run on 22.0.4 IS the validation |
| A3 | `@nx/angular:application` (Nx 23) generates a standalone Angular 22 app whose tsconfig the engine can target without extra wiring | Scaffold | LOW -- standard generator; verified the generator + tsconfig templates exist |
| A4 | The `cp -R <temp>/.` dotfile copy behaves on this Windows arm64 / Git Bash exactly as on Linux | Bootstrap | MED -- Pitfall 5 gives two fallbacks (`dotglob`, `rsync`) + a post-copy `git status` verification the planner should encode |
| A5 | The `@nx/plugin:plugin` generator under `--preset=apps` still emits `module:"commonjs"` (read at Nx clone `23.1.0-beta.4`; registry-locked is `23.0.1`) | Pitfall 1 | LOW -- behavior is long-standing; the patch task is idempotent (set to nodenext regardless of generated value) |

## Open Questions

1. **Does the SAME parsed config produce a comparable program for both gatherers?**
   - What we know: `performCompilation` builds a fresh `NgtscProgram` each call; running it twice with different `gatherDiagnostics` is clean.
   - What's unclear: whether reusing `parsed.options` mutated by the first call (e.g., `noEmit`) affects the second.
   - Recommendation: build `parsed` once, spread into a fresh `options` object per call; do not share mutable option objects.

2. **Exact path from the plugin's compiled `dist` to `executor.js` for the GATE A read.**
   - What we know: nx-verdaccio outputs `dist/.../src/executors/<name>/executor.js`; outputPath is `{options.outputPath}`.
   - What's unclear: the precise `outputPath` the `@nx/plugin` generator wires for `packages/angular-typechecker`.
   - Recommendation: the planner reads the generated `project.json` `build.options.outputPath` and computes the GATE A path from it (do not hard-code; derive).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | (assumed per CLAUDE.md: FNM-managed) | target `^22.22.3 \|\| ^24.15.0 \|\| ^26.0.0` | none -- pin the spike-run Node in-range |
| npm | Install/CNW | yes | -- | -- |
| `npx create-nx-workspace@23.0.1` | Bootstrap | yes (via npx, network) | 23.0.1 | none |
| `typescript@6.0.3` | Build/emit | verified installable + emit-tested this session | 6.0.3 | none |
| `@angular/compiler-cli@22.0.4` | Engine | confirmed on registry (`type:module`) | 22.0.4 | none |
| Git Bash | Bootstrap shell | yes (CLAUDE.md) | -- | PowerShell Core equivalent for copy |

**Missing dependencies with no fallback:** none identified -- all locked packages confirmed installable on the registry.
**Note:** pick the spike-run Node version explicitly from the supported range (deferred execution-detail per CONTEXT.md); record it alongside the cold-run timing.

## Validation Architecture

> nyquist_validation is not explicitly false in config -> included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 via `@nx/vitest:test` (Nx 23.0.1) |
| Config file | `packages/angular-typechecker/vitest.config.ts` (generated by `@nx/plugin:plugin --unitTestRunner=vitest`) -- see Wave 0 if absent |
| Quick run command | `npx nx test angular-typechecker` (or `--testPathPattern=gate`) |
| Full suite command | `npx nx test angular-typechecker` |
| Build (prereq for GATE A) | `npx nx build angular-typechecker` |

### Phase Requirements -> Test Map (each gate checklist item -> an assertion + owning test)
| Req / Gate item | Behavior | Test Type | Automated Command / Assertion | File Exists? |
|-----------------|----------|-----------|-------------------------------|--------------|
| WS-01 | Repo is an Nx 23 integrated Angular monorepo with the plugin | smoke | `npx nx report` shows nx 23.0.1; `npx nx show projects` lists `angular-typechecker` + `ng-spike-app` | manual/CI step |
| WS-02 / Gate 1 (A static) | Built `executor.js` has literal `import(`, no `require('@angular/compiler-cli')` | unit (post-build) | `gate-a-static.spec.ts`: `expect(code).toMatch(/import\(/)` + `not.toMatch(/require\(["']@angular\/compiler-cli/)` | Wave 0 |
| ENG-03 / Gate 2 (A runtime) | `await import()` loads compiler-cli, no `ERR_REQUIRE_ESM`, no code 500 | integration | `gate-b.spec.ts`: run resolves; `expect(codes).not.toContain(500)` | Wave 0 |
| ENG-03 / Gate 3 (B positive) | All-getter returns 2322 AND 8109 | integration | `gate-b.spec.ts`: `toContain(2322)` + `toContain(8109)` | Wave 0 |
| ENG-03 / Gate 4 (B differential) | `defaultGatherDiagnostics` returns 2322 but NOT 8109 | integration | `gate-b.spec.ts`: `toContain(2322)` + `not.toContain(8109)` | Wave 0 |
| Gate 5 (B breadth) | Gates 3-4 hold for one app AND one lib tsconfig | integration | `describe.each([app, lib])` in `gate-b.spec.ts` | Wave 0 |
| Gate 6 (timing) | One cold-run wall-clock recorded | integration | `runTypecheck` returns `durationMs`; logged once | Wave 0 |
| WS-03 | Plugin tests run via Vitest | smoke | `npx nx test angular-typechecker` exits 0 with >=1 green test | Wave 0 (generator emits a sample spec) |
| CMP-01 | Nx 23 + Angular 22 + TS 6 resolve together | smoke | `npm ls nx @angular/compiler-cli typescript` shows 23.0.1 / 22.0.4 / 6.0.3 | manual/CI step |
| CMP-02 | `engines.node` correct | static | assert plugin `package.json` `engines.node === "^22.22.3 || ^24.15.0 || ^26.0.0"` | Wave 0 (tiny manifest test, optional) |

### Sampling Rate
- **Per task commit:** `npx nx test angular-typechecker` (Vitest; fast)
- **Per wave merge:** `npx nx build angular-typechecker && npx nx test angular-typechecker` (build must precede GATE A static)
- **Phase gate:** all six checklist items green on one app + one lib + a recorded timing, before declaring GO.

### Wave 0 Gaps
- [ ] `packages/angular-typechecker/src/.../gate-a-static.spec.ts` -- GATE A static (covers WS-02/Gate 1)
- [ ] `packages/angular-typechecker/src/.../gate-b.spec.ts` -- GATE B positive + differential + runtime + breadth + timing (covers ENG-03/Gates 2-6)
- [ ] `fixtures/gate-b-error/{error.component.ts,error.component.html,tsconfig.app.json,tsconfig.lib.json}` -- the deliberate-error fixture (out of graph)
- [ ] Confirm the generator-emitted `vitest.config.ts` resolves the workspace `tsconfig`; framework install arrives via `--unitTestRunner=vitest` (no extra install)
- [ ] One green smoke spec (the generator emits a sample; keep or replace) -- satisfies WS-03 minimally

*If the generator already emits a runnable `vitest.config.ts` + sample spec (it does for `--unitTestRunner=vitest`), the only NEW files are the two gate specs + the fixture.*

## Security Domain

> `security_enforcement` is not explicitly false. Phase 1 introduces no auth/session/network/crypto surface -- it is a build-tooling + local type-check spike. The only supply-chain-adjacent action is installing pinned, official packages and running `create-nx-workspace`.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | no | -- |
| V5 Input Validation | minimal | The executor's only input is a `tsConfig` path string; `readConfiguration` validates/normalizes it (full schema validation deferred to Phase 4) |
| V6 Cryptography | no | -- |
| V14 Configuration / Supply Chain | yes | EXACT version pins (D-15); official packages only (Legitimacy Audit); `--nxCloud=skip` avoids onboarding network calls; no postinstall scripts introduced by our code |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Slopsquatted/typosquatted dep | Spoofing/Tampering | All Phase-1 packages are official `nrwl`/`angular`/`microsoft` org packages, pinned exact; Legitimacy Audit above |
| Arbitrary code via `npx create-nx-workspace` | Tampering/EoP | Pin `@23.0.1`; run with explicit flags; review full `git status` before committing generated files |
| Malicious preset | Tampering | Use only the built-in `--preset=apps` (no third-party preset; `--trustThirdPartyPreset` left default false) |

## Sources

### Primary (HIGH confidence)
- `D:/projects/github/angular/angular/packages/compiler-cli/src/perform_compile.ts` (v22.1.0-next.3) -- `performCompilation` signature (255-279), `defaultGatherDiagnostics` `&&`-chain (328-362), `readConfiguration` extends-merge (75-181), `UNKNOWN_ERROR_CODE` catch (314-325).
- `.../compiler-cli/src/transformers/api.ts` -- `Program` getter signatures (178-253), `EmitFlags` (129-138), `UNKNOWN_ERROR_CODE = 500` (14).
- `.../compiler-cli/index.ts` -- public exports (`performCompilation`, `readConfiguration`, `formatDiagnostics`, `createProgram`, `createCompilerHost`, `NgtscProgram`, `OptimizeFor`).
- `.../compiler-cli/src/ngtsc/program.ts` -- `getNgSemanticDiagnostics()` -> `compiler.getDiagnostics()` whole-program (224-243).
- `.../compiler-cli/src/ngtsc/diagnostics/src/error_code.ts` -- `INTERPOLATED_SIGNAL_NOT_INVOKED = 8109` (586).
- `.../compiler-cli/src/ngtsc/typecheck/extended/checks/interpolated_signal_not_invoked/index.ts` -- NG8109 `{{ signal }}` trigger (Interpolation branch).
- `.../compiler-cli/src/ngtsc/core/src/compiler.ts` -- `strictTemplates` default `!== false` (1056); extended checks gated (662).
- `D:/projects/github/angular/angular-cli/packages/angular/build/.../angular-compilation.ts` (v22.1.0-next.1) -- memoized `loadCompilerCli()` (34-38); `.../aot-compilation.ts` -- the deferred `NgtscProgram`+`getDiagnosticsForFile` path; `.../utils/load-esm.ts` -- `Function`-wrapped dynamic import alternative.
- `D:/projects/github/nrwl/nx` (clone 23.1.0-beta.4) -- `create-nx-workspace.ts` (dir check 855-867, `isAiAgent` 324-344); `yargs-options.ts` (flags); `create-workspace.ts` (git-init scoping 238-245); `plugin/.../schema.json`; `js/.../tsc.impl.ts` (module read-only 26-64); `js/.../library.ts` (`module:'commonjs'` default 1132); `vitest/.../vitest.impl.ts` (`startVitest`).
- `D:/projects/github/push-based/nx-verdaccio/projects/nx-verdaccio/` -- real plugin `package.json`, `project.json` asset-copy, `executors.json`, `tsconfig.{json,lib,spec}.json`, `schema.{json,ts}`, executor default-export.
- `D:/projects/sandbox/nx19-8-angular18-2-.../executors/angular-typecheck/{executor.ts,test-fixtures.ts}` -- the all-getter shape + NG8109/TS2322 injectors (version-bound; ported + re-validated).
- **Empirical (this session):** `typescript@6.0.3` compile of a loader stub -> `module:nodenext`/`node16` emit literal `await import(...)`; `module:commonjs` emits `__importStar(require('@angular/compiler-cli'))`. (Scratchpad emit-test.)
- npm registry (`npm view`, 2026-06-27) -- version/peer/type/engines for nx, @nx/*, @angular/compiler-cli, typescript, vitest, tslib.

### Secondary (MEDIUM confidence)
- `D:/projects/github/analogjs/analog` -- Angular 22 `tsconfig.base.json` (`moduleResolution:"bundler"`, `ignoreDeprecations:"6.0"`, `importHelpers:true`); `@analogjs/platform/package.json` (provenance/exports patterns; devkit-as-peer = the rejected model).
- `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `01-CONTEXT.md`, `01-DISCUSS-RESEARCH.md`, CLAUDE.md embedded stack research.

### Tertiary (LOW confidence)
- TS issue #36017 (`exclude` does not stop type-checking of imported files) -- cited from CONTEXT.md/training, not re-fetched; drives the "nothing imports the fixture" rule (D-13). The risk is mitigated by the gate's own green-`ng-spike-app` assertion.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- every version confirmed on the npm registry; peer/type/engines cross-checked.
- Architecture (engine + gates): HIGH -- getter names, `performCompilation` signature, and the `&&`-chain differential read line-by-line from v22 source; NG8109 trigger confirmed in source.
- GATE A emit: HIGH -- re-verified by compiling with the locked `typescript@6.0.3` this session.
- Bootstrap: HIGH on mechanism/flags (Nx source + registry); MEDIUM on Windows dotfile-copy ergonomics (Pitfall 5 gives fallbacks + a verification step).
- Pitfalls: HIGH -- each traced to a specific source location.

**Research date:** 2026-06-27
**Valid until:** ~2026-07-27 (stable stack); re-verify if Nx publishes 23.1.x or Angular publishes 22.1.0 before execution. Source clones are at `22.1.0-next.x`/`23.1.0-beta.4` -- the gate run on the locked stable `22.0.4`/`23.0.1` is the authoritative re-validation (D-18).
