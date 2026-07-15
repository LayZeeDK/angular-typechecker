---
spike: 011
name: builder-ng-run-esm-bridge
type: standard
gate: [GATE-A']
validates: "Given the shipped typecheck executor re-exported as an Angular CLI builder via convertNxExecutor and installed from the built tarball into a real on-stack Angular 22 angular.json workspace, when a real `ng run <project>:typecheck` runs on an app AND a library (incl. convertNxExecutor's eager retrieveProjectConfigurationsWithAngularProjects project-graph prelude), then the CJS-loads-ESM @angular/compiler-cli await import() bridge SURVIVES with NO ERR_REQUIRE_ESM, a planted TS2322 surfaces RED, and a clean project is GREEN."
verdict: GO
related: []
tags: [angular-cli, builder, convert-nx-executor, ng-run, esm-bridge, gate, gate-a-prime, engine]
---

# Spike 011: builder survives `ng run` -- the CJS->ESM bridge GATE A' (GO/NO-GO)

## What This Validates

The milestone's headline GO/NO-GO (ACB-02 / GATE A'): does the shipped
CommonJS-executor-loads-ESM-`@angular/compiler-cli`-via-`await import()` bridge SURVIVE
being wrapped by `@nx/devkit`'s `convertNxExecutor` and driven by a REAL
`ng run <project>:typecheck` -- including the wrapper's eager, ESM-sensitive
`retrieveProjectConfigurationsWithAngularProjects` project-graph prelude (nrwl/nx#19475)?

A GO requires ALL of:

- **No `ERR_REQUIRE_ESM`** (nor `require() of ES Module` / `Cannot use import statement
  outside a module`) on-stack Angular 22, for an app AND a library, incl. the eager prelude.
- **Diagnostics genuinely FLOW** (not a vacuous pass): a planted `TS2322` surfaces RED via
  `ng run` on the project it was planted in, and a clean control is GREEN (exit 0).
- **On-stack install is clean** -- NO `--legacy-peer-deps` needed.

This gate cannot be proven by an `.mjs`-only harness (spikes 001-010 style): those never
trigger the eager project-graph prelude. So this spike is an ORCHESTRATOR that drives the
REAL `convertNxExecutor` + the REAL Architect loader + a REAL `ng run` against REAL plugin
code (the minimal builder landed in Plan 21-01, tasks 1-2). The static-byte half of the
gate (the built `builder.js` never `require()`s `@angular/compiler-cli`) lives in the
committed, CI-authoritative `gate-a-static.spec.ts`.

## Research

`convertNxExecutor` ships in the already-pinned `@nx/devkit@23.0.1` (non-deprecated). Its
returned builder does `require('@angular-devkit/architect').createBuilder(...)` +
`require('rxjs')` and runs an eager `readNxJsonFromDisk` +
`retrieveProjectConfigurationsWithAngularProjects` prelude BEFORE our executor. The bridge
never re-transforms `core/compiler-loader.ts`, where the `await import('@angular/compiler-cli')`
lives -- so the milestone verdict was "SHOULD survive" (LOW-to-MEDIUM residual risk), to be
CONVERTED TO EVIDENCE by this gate.

Substrate (real, on-stack, non-Nx `angular.json`): `bluehalo/ngx-leaflet` -- an Angular 22
CLI workspace with an application (`ngx-leaflet-demo`, root) AND a publishable library
(`ngx-leaflet`, `projects/ngx-leaflet`). Both projects use the `architect` target key
(Assumption A1 CONFIRMED). npm lockfile; `@angular/* ^22.0.0`, `typescript ~6.0.3`.

## How to Run

The external clone and its `node_modules` are NEVER committed -- only this record is. To
reproduce:

```bash
# 1. Clone the substrate at the exact commit (outside this repo).
git clone https://github.com/bluehalo/ngx-leaflet D:/projects/github/bluehalo/ngx-leaflet
git -C D:/projects/github/bluehalo/ngx-leaflet checkout 818e9ae55240b570397ede5a15cb4d466785abdc

# 2. From the angular-typechecker repo root, run the orchestrator.
#    (Override the clone path with NGX_LEAFLET_CLONE=/abs/path if it lives elsewhere.)
node .planning/spikes/011-builder-ng-run-esm-bridge/harness.mjs
```

The harness is self-contained and record-only: it auto-provisions the clone's
`node_modules` (`npm ci`) if absent, `nx build`s the plugin, `npm pack`s the BUILT dist
(asserting the tarball carries `src/builders/typecheck/builder.js` + the builder
`schema.json` + `builders.json`), `npm install`s that tarball into the clone with
`--no-save` (NO `--legacy-peer-deps`; it retries WITH the flag and RECORDS it as a finding
only if the clean install fails), hand-wires an `architect.typecheck` target on the app and
the library (`ng g` is Phase 22), runs `ng run <project>:typecheck` three times (app clean
baseline, library clean, app with a planted `TS2322`), scans every run for the ESM failure
signatures, and writes `forensic-log.json`. A `finally` block restores every touched file
(`angular.json`, `src/main.ts`, `package.json`, `package-lock.json`) and removes the
installed tarball + the transitively-dragged `nx`/`@nx` trees + the `.nx`/`.angular` caches
(Pitfall 4). Exit 0 iff all assertions pass.

## What to Expect

15 assertions PASS; `VERDICT: GO`. `forensic-log.json` records the environment, the clone
repo URL + SHA, the tarball contents, the (clean) install, and the three per-project
`ng run` results with their exit codes + ESM-signature scans.

## Investigation Trail

1. **Tarball carries the built builder.** `npm pack --json` on `dist/packages/angular-typechecker`
   listed 76 files including the compiled `src/builders/typecheck/builder.js`, the sanitized
   builder `schema.json`, and `builders.json` (the 0.0.1-0.1.0 source-only packaging
   regression precedent -- assert the manifest ships).
2. **On-stack install was CLEAN.** `npm install <tarball> --no-save` into the Angular 22
   clone added 91 packages (incl. the transitive `@nx/devkit` -> `nx`) in ~12s with NO
   `--legacy-peer-deps` and NO ERESOLVE. (npm's `allow-scripts` warnings for `nx`/`esbuild`/
   `@parcel/watcher` postinstalls are expected and irrelevant -- we type-check via
   `@angular/compiler-cli`, we neither build nor serve.)
3. **The bridge SURVIVED on the app (clean baseline).** `ng run ngx-leaflet-demo:typecheck`
   (tsConfig `tsconfig.app.json`) exited 0 -- the eager project-graph prelude ran, the
   executor reached the compiler, and the verdict mapped to a GREEN `BuilderOutput`. No ESM
   signature anywhere in the output.
4. **The bridge SURVIVED on the library.** `ng run ngx-leaflet:typecheck` (tsConfig
   `projects/ngx-leaflet/tsconfig.lib.json`) exited 0 -- proving the bridge holds for a
   library project too, again ESM-clean.
5. **Diagnostics FLOW (not a vacuous pass).** Appending
   `const __angularTypecheckerGateAPlanted: number = 'gate-a-planted-type-error';` to the
   app's `src/main.ts` made the SAME `ng run ngx-leaflet-demo:typecheck` exit 1 with
   `src/main.ts:17:7 - error TS2322: Type 'string' is not assignable to type 'number'.` --
   real diagnostics surface RED through `convertNxExecutor` + Architect and the verdict maps
   to a non-zero exit. `main.ts` was restored immediately after.
6. **No ESM failure signatures in any of the three runs** (`ERR_REQUIRE_ESM` /
   `require() of ES Module` / `Cannot use import statement outside a module`); no
   project-graph/daemon error before any diagnostic.

## Results

**VERDICT: GO.** The shipped CJS-executor -> ESM-`@angular/compiler-cli` `await import()`
bridge SURVIVES `convertNxExecutor` + a real `ng run` on-stack Angular 22 (app AND library),
including the eager `retrieveProjectConfigurationsWithAngularProjects` prelude, with NO
`ERR_REQUIRE_ESM`. The planted `TS2322` surfaces RED and the clean control is GREEN, so the
verdict maps end-to-end (engine -> `convertNxExecutor` -> Architect `BuilderOutput` -> exit
code). The on-stack install needed no `--legacy-peer-deps`. GATE A' is cleared; the minimal
builder (Plan 21-01) STAYS, and Waves 2-3 (ENG-01 + the ACB in-repo guard suite) may proceed
pending the human GO/NO-GO checkpoint.

### Findings that carry forward

- **The builder is a pure re-export -- parity is structural.** `ng run` runs the SAME core
  the Nx executor does; the planted-vs-clean RED/GREEN contrast on the same project proves
  the whole chain (normalize-options -> runTypecheck -> `await import()` -> renderReport ->
  evaluateResult -> `{ success }` -> `BuilderOutput`).
- **`convertNxExecutor` works in a pure Angular CLI (`angular.json`, no `nx.json`)
  workspace.** The eager prelude reads `angular.json` and tolerates an absent `nx.json`.
- **Installing the plugin drags `nx` transitively + can create `.nx`/`.angular` dirs**
  (Pitfall 4) -- expected; the harness cleans them so the clone stays pristine.

### Scope notes (not silent caps)

- The GATE uses a single-string `tsConfig` (the pure bridge proof). The `tsConfig: string[]`
  widening (ENG-01) is Plan 21-02, verified by in-repo integration tests + this same clone's
  array-form targets later.
- The clean runs produced no stdout (a clean verdict is signalled by exit 0); the planted run
  carries the codeframe. `reachedCompiler` treats exit 0 as "bridge reached the engine".
- Angular CLI schema-dialect acceptance of the builder options was covered by the sanitized
  builder `schema.json` + its parity guard (Plan 21-02); this gate confirmed `ng run` parses
  and passes `tsConfig` through with no validation error.
