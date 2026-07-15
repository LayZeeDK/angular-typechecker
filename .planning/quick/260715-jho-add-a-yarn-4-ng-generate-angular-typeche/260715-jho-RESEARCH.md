# Quick 260715-jho: yarn-4 `ng generate ...:configuration` e2e cell + conditional vanilla refactor - Research

**Researched:** 2026-07-15
**Domain:** Angular CLI schematics under yarn 4 (berry) + shared-core wiring refactor
**Confidence:** HIGH (mechanism + refactor shape verified against source; the empirical crash is what the cell settles)

## Summary

The crash mechanism is fully established (see `.planning/debug/resolved/cli-yarn-e2e-wrong-version.md`)
and I verified every load-bearing file. `configuration`/`init` schematics are BOTH still
`export default convertNxGenerator(<generator>)` with a top-level `import { convertNxGenerator } from '@nx/devkit'`
(verified: `schematics/configuration/schematic.ts:1,19` and `schematics/init/schematic.ts:1,20`). So their
compiled `schematic.js` does `require('@nx/devkit')` at MODULE LOAD -- the exact path 24-06 removed from
`ng-add`. The shared core `src/core/angular-cli-wiring.ts` already exports everything a vanilla rewrite needs,
and `ng-add/schematic.ts` is a working vanilla template to mirror. `@angular-devkit/schematics` is ALREADY in
the eslint `@nx/dependency-checks` `ignoredDependencies` (verified `eslint.config.mjs:104`) -- do NOT re-add.

**Primary recommendation:** add the e2e cell first; it is the arbiter. Prediction is HIGH-confidence CRASH, and
unlike `ng add` it will fail LOUDLY (no bare-catch). If it crashes, apply the vanilla rewrite to both schematics
over the shared core (a near-mechanical mirror of `ng-add`). If it does NOT crash, STOP -- do not refactor
(YAGNI); the committed cell locks the good behavior and the tech_debt resolves as "verified safe."

---

## 1. Crash prediction for `ng generate` specifically

**Mechanism (precise, source-verified):**
1. `ng generate angular-typechecker:configuration <project>` -> Angular CLI resolves the collection from the
   installed package's `schematics: ./collection.json` -> loads the factory
   `./src/schematics/configuration/schematic` (`collection.json:9-13`).
2. Loading that factory module executes its top-level `require('@nx/devkit')` (the `convertNxGenerator` import).
   `@nx/devkit`'s entrypoint `require()`s `nx/src/devkit-exports` -> pulls in `nx` -> nx's bundled CJS
   `log-symbols@4.1.0`, which calls `chalk.blue('..')` at ITS module load expecting chalk v4 (CJS default export
   IS the instance; `.blue` exists).
3. The `ng generate` process ALSO carries chalk v5 (pure ESM, no named `.blue`) via
   `@angular-devkit/schematics -> ora@8 -> log-symbols@6 -> chalk@5`. `@angular-devkit/schematics` is the
   schematics ENGINE that `ng generate` loads unconditionally -- so chalk v5 is present in the process exactly as
   it is for `ng add`. (This is the corrected attribution: chalk v5 comes from schematics' `ora@8`, NOT listr2 --
   listr2 uses colorette; debug doc lines 398-410.)
4. Under yarn 4's node-modules "last-in-wins" hoist, CJS `log-symbols@4`'s `require('chalk')` resolves the hoisted
   v5 chalk; on Node >= 22.12/20.19/23 `require(esm)` is unflagged-ON so it SUCCEEDS returning the namespace whose
   top-level `.blue` is `undefined` -> `TypeError: chalk.blue is not a function`. npm/pnpm place a v4 chalk for
   log-symbols@4, so they never hit this.

**Why the presence of chalk v5 is a property of the installed TREE, not the command:** both `ng add` and
`ng generate` load `@angular-devkit/schematics -> ora@8 -> chalk@5` into the SAME yarn-hoisted `node_modules`.
The hoist layout is fixed by the `yarn install`, not by which CLI verb runs. So if `ng add` crashed pre-24-06 on
this fixture's dependency graph, `ng generate` running the convertNx schematic on that same tree should crash
identically -- and at factory LOAD, before the rule body runs.

**The one genuine uncertainty:** prior spikes found a CLEAN STANDALONE nx-chain load did NOT reproduce the crash
(debug doc line 282-285). That standalone ran OUTSIDE the full CLI process, so `@angular-devkit/schematics` (hence
chalk v5) was never loaded -> log-symbols@4 resolved nx's own bundled chalk@4 (has `.blue`) -> no crash. What is
different about REAL `ng generate`: it loads `@angular-devkit/schematics` (the engine) -> ora@8 -> chalk@5 INTO
the process/tree, so the v5 chalk is present for log-symbols@4 to mis-resolve. The residual unknown is purely
whether THIS fixture's (`e2e/.../fixtures/ng-cli-workspace`) yarn hoist actually places v5 where nx's log-symbols@4
resolves it -- which is exactly what the e2e settles.

**Expected empirical outcome:** CRASH -- `ng generate angular-typechecker:configuration ng-cli-workspace` exits
non-zero with `TypeError: chalk.blue is not a function` at `@nx/devkit`/nx factory load. Unlike `ng add`'s
post-install probe (which swallowed the throw in a bare `catch {}` -> silent no-wire), `ng generate` has no such
catch, so the failure is LOUD. **Confidence: HIGH that it crashes; the e2e cell is the arbiter and the refactor is
conditional on the observed result** (per CONTEXT: if no crash, STOP + do not refactor).

---

## 2. Exact e2e cell shape

New file: `e2e/angular-typechecker-ng-cli-e2e/src/ng-generate-configuration-yarn.e2e.spec.ts`. Model on
`ng-add-ng-run-yarn.e2e.spec.ts`; reuse verbatim: `setupYarnWorkspace` (all yarn config incl. the LOAD-BEARING
`enableMirror: false`), `typecheckTarget`, `ngRun`, `plant`, `buildCleanEnv({ stripAllNpmConfig: true })`, the
`corepackAvailable` guard, the `900000` timeout, and the shared `global-setup.ts` (build+publish ONCE via Verdaccio).

**Differences from the `ng add` sibling:**
- Single test (`it.skipIf(!corepackAvailable)`), NOT `.each(['flat','workspace'])`. FLAT layout only, APP project
  `ng-cli-workspace` (root app, `root: ''`). Rationale (CONTEXT): the crash is schematic-factory-load, layout-
  independent; `configuration` is inherently single-project; `ng add`'s two-layout matrix already covers topology.
- Install via **plain `corepack yarn add -D angular-typechecker`** (NOT `ng add`):
  `corepack enable` -> `corepack yarn install` -> `corepack yarn add -D angular-typechecker` ->
  `corepack yarn ng generate angular-typechecker:configuration ng-cli-workspace`.
- Do NOT install `nx` explicitly. `nx` is a DIRECT dependency of angular-typechecker since 24-04, so yarn pulls it
  transitively (yarn only skips the `@nx/devkit` PEER). Its presence is what makes the current crash possible; the
  vanilla schematic never loads `@nx/devkit` so nx becomes irrelevant on that path.
- Assertions (mirror the sibling's success end-state): after `ng generate`, `typecheckTarget(tmp, 'ng-cli-workspace')`
  has `builder === 'angular-typechecker:typecheck'` and `options.tsConfig === ['tsconfig.app.json','tsconfig.spec.json']`;
  `ng run ng-cli-workspace:typecheck` is green on the clean scaffold, then catches a planted `TSxxxx` after `plant(...)`;
  assert NO `chalk.blue`, NO `ERR_REQUIRE_ESM`, NO `infrastructure error`. Only the APP project (single-project command).

**Answers to the specific questions:**
- **Does `ng generate` need a `--skip-*`/interactive flag under yarn?** No. `ng add` needs `--skip-confirmation`
  (install prompt); `ng generate` has no install step. Passing the project POSITIONALLY satisfies the only required
  schema field (`schema.json`: `project` required, `$default.$source: argv, index: 0`); there is NO `x-prompt` in
  the schema, so nothing prompts. `execSync` is non-TTY so Angular's analytics prompt auto-declines. Optional
  belt-and-suspenders: `--interactive=false` (or `--defaults`) -- not required.
- **Does `configuration` require `--project`?** Yes (`required: ["project"]`). Supply it as the positional arg
  (`... :configuration ng-cli-workspace`) or `--project ng-cli-workspace`; both bind to `project`.
- **Any prompt that would hang non-interactive?** None -- no `x-prompt` and the required `project` is provided.
- **Must the new spec file be registered anywhere (coverage guard / CI matrix)?** No. The `ci-e2e-coverage-guard.spec.ts`
  guards operate at PROJECT level (each `e2e/*/project.json` must have `e2e`/`typecheck` targets, `type:e2e` tag,
  build `dependsOn`) -- the spec lives in the EXISTING `angular-typechecker-ng-cli-e2e` project, which already
  satisfies all of them. The CI matrix is dynamic (`fromJSON(needs.discover.outputs.projects)` via
  `tools/ci/list-e2e-projects.mjs`) at project granularity, so a new spec in an existing project is auto-covered.
  Two guard invariants the new spec must NOT violate (it does not): it must not run `npm pack --json` without
  `--pack-destination` (it uses `yarn add`, no pack), and it must not run `nx build angular-typechecker` (build runs
  once upstream via `dependsOn`).

Run command (main checkout, single-plan wave -> no worktree per AGENTS.md):
`NX_DAEMON=false npx nx e2e angular-typechecker-ng-cli-e2e --skip-nx-cache` (slow; generous timeout / background).

---

## 3. Exact vanilla-refactor shape (CONDITIONAL on the cell crashing)

Mirror `src/schematics/ng-add/schematic.ts` over `src/core/angular-cli-wiring.ts`.

**`src/schematics/configuration/schematic.ts` (rewrite):**
- `export default function configuration(options: ConfigurationGeneratorSchema): Rule` returning
  `(tree: Tree, context: SchematicContext): Tree`. Imports of `Rule`/`Tree`/`SchematicContext` are **type-only**
  from `@angular-devkit/schematics` (erased at compile -> compiled `schematic.js` requires ONLY `../../core/...`).
- Logic replicates the generator's **CLI branch** (`generators/configuration/generator.ts:136-178`):
  1. `const targetName = resolveTargetName(options.targetName, options.project);`
  2. read + parse `angular.json` (`tree.read('angular.json')`), cast to `AngularJsonWorkspace`; look up
     `workspace.projects[options.project]` -> throw "was not found in angular.json" if absent.
  3. `const tsConfig = resolveTsConfigLeaves(project.root ?? '', project.projectType, options.tsConfig, options.project, (p) => tree.exists(p));`
  4. `wireTypecheckTarget(workspace, options.project, targetName, tsConfig);`
  5. `tree.overwrite('angular.json', ${JSON.stringify(workspace, null, 2)}\n);`
  6. `context.logger.info(NO_CACHING_NOTICE);` then `return tree;`
- Shared-core helpers used: `resolveTargetName`, `resolveTsConfigLeaves` (which calls `resolveTsConfigOverride`
  internally when `--tsConfig` is set), `wireTypecheckTarget`, `NO_CACHING_NOTICE`, type `AngularJsonWorkspace`.
- `--skipFormat`: accepted for schema parity, **no-op** on the vanilla path (no devkit Prettier pass) -- same as
  `ng-add/schematic.ts:110-113`.

**`src/schematics/init/schematic.ts` (rewrite):**
- `export default function init(options: InitGeneratorSchema): Rule` returning `(tree, context) => Tree`.
- On an Angular CLI workspace `init` is a near-no-op (the generator CLI branch logs `NO_CACHING_NOTICE` and returns
  without touching `nx.json` -- `generators/init/generator.ts:83-87`). Preserve that: `context.logger.info(NO_CACHING_NOTICE); return tree;`.
  ZERO `@nx/devkit`. (Do NOT silently return without the notice -- the init-angular-cli spec asserts ACS-03 behavior.)

**UNCHANGED (byte-stable surface):**
- `generators/configuration/generator.ts`, `generators/init/generator.ts` (the `nx g` path stays convertNx-free-of-change).
- `collection.json` -- factory paths already point at `./src/schematics/configuration/schematic` and `.../init/schematic`;
  only the compiled impl changes, the JSON is untouched.
- `generators.json` (Nx resolves `generators ?? schematics` -> `nx g`/`nx add` unaffected).
- All `schema.json` / `schema.d.ts` (surface byte-stable; `ConfigurationGeneratorSchema` = `{project, tsConfig?, targetName?, skipFormat?}`; `InitGeneratorSchema` = `{skipFormat?}`).

**LOAD-BEARING invariant (same as 24-06):** compiled `dist/.../schematics/configuration/schematic.js` and
`.../init/schematic.js` contain ZERO `@nx/devkit`. dist is gitignored, so prove with `rg -uu` (NOT `git grep`):
`rg -uu "@nx/devkit" dist/packages/angular-typechecker/src/schematics/configuration/schematic.js dist/packages/angular-typechecker/src/schematics/init/schematic.js`
-> expect zero matches. Primary functional proof is the e2e passing (if it loaded `@nx/devkit` it would crash under yarn 4).

**eslint:** `@angular-devkit/schematics` is ALREADY in `ignoredDependencies` (`eslint.config.mjs:101-106`, added by
24-06 for the vanilla ng-add). Do NOT double-add -- verify only.

**Unit specs (if refactored):** add `schematics/configuration/*.spec.ts` and `schematics/init/*.spec.ts` via
`@angular-devkit/schematics/testing`, mirroring `ng-add/ng-add.spec.ts` (the Rule is SYNCHRONOUS -> invoke directly
with a logger-backed `context = { logger: runner.logger }` so `context.logger.info` notices are capturable; wrap in
an `async` helper so a synchronous throw surfaces for `rejects.toThrow`). The existing generator specs stay green
(generator unchanged): `configuration.spec.ts`, `configuration-angular-cli.spec.ts`, `configuration-matrix.spec.ts`,
`init.spec.ts`, `init-angular-cli.spec.ts`, `target-defaults-drift.spec.ts`, both `schema-parity.spec.ts`.

---

## 4. Pitfalls / gotchas

1. **`enableMirror: false` is LOAD-BEARING and must be in the new cell.** Because the local Verdaccio dist and
   public-npm both ship version `0.2.0`, a stale schematics-less `0.2.0` in the yarn global mirror gets copied
   BY LOCATOR unless `enableMirror: false`, producing the ORIGINAL "does not support schematics" error that would
   MASK the crash test. Reuse `setupYarnWorkspace` verbatim (it already sets it, plus `enableGlobalCache: false`,
   `npmMinimalAgeGate: 0`, `unsafeHttpWhitelist: 127.0.0.1`, per-fixture `cacheFolder`, `enableImmutableInstalls: false`).
2. **CLI-branch (leaf ARRAY) vs Nx-branch (solution-walk single string) -- preserve the CLI branch exactly.** The
   generator forks on `tree.exists('angular.json') && !tree.exists('nx.json')`. The CLI branch uses
   `resolveTsConfigLeaves` -> `[tsconfig.app.json, tsconfig.spec.json]` (RF-01 Approach A array). The Nx branch uses
   `resolveTsConfig` (solution `tsconfig.json` with non-empty `references[]` -> single string; solution-walk). The
   vanilla schematic replicates ONLY the CLI branch -> behavior on a genuine Angular CLI workspace is IDENTICAL to
   today (the convertNx schematic already takes the CLI branch there). The Nx-branch is DROPPED from the vanilla
   schematic -- but it is only reachable when `nx.json` exists, and Nx users invoke `nx g` (the unchanged generator).
   Flag explicitly: a `ng generate` on a hybrid `angular.json`+`nx.json` workspace would now read `angular.json`
   directly instead of taking the Nx path -- an edge, and exactly how vanilla `ng-add` already behaves (CLI-only).
3. **Root-app leaf resolution.** Fixture APP `ng-cli-workspace` has `root: ''`; `resolveTsConfigLeaves('', 'application', ...)`
   yields `['tsconfig.app.json','tsconfig.spec.json']` via `posix.join('', 'x') === 'x'`. Matches the ng-add app target;
   the cell must assert that exact array.
4. **`nx g` path + surface-regression stay green.** `collection.json`/`generators.json` untouched;
   `nx-generators-surface-regression.spec.ts` asserts the factory PATHS (`./src/schematics/configuration/schematic`,
   `./src/schematics/init/schematic`) -- stable across the impl rewrite. Do not touch `generators.json`.
5. **Non-interactive `ng generate`.** Provide `project` positionally; no `x-prompt` -> no hang. `execSync` is non-TTY.
6. **Slow shared Verdaccio globalSetup.** One build+publish shared across all ng-cli-e2e specs; the new spec adds one
   more slow yarn install + `ng generate` + two `ng run` invocations. Use the `900000` timeout; run on the main
   checkout (single-plan wave -> no worktree, real `node_modules`); `NX_DAEMON=false ... --skip-nx-cache`.
7. **Windows arm64 shell.** `corepack yarn` via Git Bash; the `corepackAvailable` guard skips cleanly where corepack
   yarn cannot provision. No `mklink`/junction needed (main-tree run, not a worktree).
8. **`format:check` + `lint` (maxWarnings:0) before declaring done** (memory: verify-format-and-lint-before-release).
   New `schematic.ts` must follow the JS/TS style rules (blank lines around control flow/returns, always-braces,
   `singleQuote`). Confirm `@nx/dependency-checks` does not flag `@angular-devkit/schematics` (already ignored) and
   that the type-only import is erased so the compiled JS imports only `../../core/angular-cli-wiring`.
9. **If the crash does NOT reproduce: STOP (YAGNI).** Keep `configuration`/`init` convertNx; the committed cell locks
   the good behavior; update the v0.2.1-MILESTONE-AUDIT tech_debt item to "verified safe" and adjust the README
   `## Angular CLI` note accordingly. Do not refactor speculatively.

---

## Assumptions Log

| # | Claim | Risk if wrong |
|---|-------|---------------|
| A1 | `ng generate` loads `@angular-devkit/schematics` -> ora@8 -> chalk@5 into the process just like `ng add`, so the crash reproduces | LOW -- this is the whole point of the cell; if wrong, the cell simply passes and the refactor is (correctly) skipped |
| A2 | Angular CLI's `ng generate` has no bare-catch around factory load, so the crash surfaces LOUDLY (non-zero exit) | LOW -- if it were swallowed, the cell's wire-assertion would still fail (no target written), so the cell is still a valid arbiter |

All other claims are `[VERIFIED]` against the cited source files in this session.

## RESEARCH COMPLETE

**File:** `D:\projects\github\LayZeeDK\angular-typechecker\.planning\quick\260715-jho-add-a-yarn-4-ng-generate-angular-typeche\260715-jho-RESEARCH.md`
