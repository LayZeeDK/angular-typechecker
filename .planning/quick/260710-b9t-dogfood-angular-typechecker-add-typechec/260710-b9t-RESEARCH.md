# Quick Task 260710-b9t: Dogfood angular-typechecker - Research

**Researched:** 2026-07-10
**Domain:** Nx 23.0.1 target mechanics (executors, targetDefaults, run-many) on this repo
**Confidence:** HIGH (every claim below verified against the installed `node_modules/@nx/*` + `node_modules/nx` source at 23.0.1, or against repo files)

## Summary

The single most load-bearing finding contradicts LOCKED decision **D2**: **`@nx/js:tsc` cannot do a
no-emit type-check.** Its schema *requires* `main` + `outputPath`, and its implementation forces
`outDir`, sets `noEmitOnError`, calls `program.emit()`, and treats `emitSkipped === true` as a
**failure**. Set `noEmit: true` in the referenced tsconfig and the target returns `success: false`
with no real error - a guaranteed CI-red. Nx's own canonical `typecheck` inference target confirms
this: it runs `tsc --build --emitDeclarationOnly` and *explicitly disables itself* (replaces the
command with an `echo`) the moment any referenced tsconfig sets `noEmit: true`.

The verified no-emit mechanism in Nx 23 is exactly what `typecheck-drift` and `typecheck-e2e`
already do: `nx:run-commands` running `tsc --noEmit -p <tsconfig>`. That is the pattern every
non-Angular type-check target in this task should use. Angular projects/fixtures use
`angular-typechecker:typecheck` (which *does* handle `noEmit: true` because it uses
`performCompilation`, not `program.emit`).

**Primary recommendation:** Use two target families under the shared name `typecheck` -
`angular-typechecker:typecheck` for Angular (app, consumer libs, clean fixtures) and
`nx:run-commands` `tsc --noEmit -p` for everything else (plugin lib+spec+drift, test-util, e2e,
tooling configs). Keep the existing executor-keyed `angular-typechecker:typecheck` default; add a
name-keyed `typecheck` default that provides `cache: true` + `outputs: []` for the run-commands
targets. Rename e2e `test` -> `e2e` (executor default follows automatically) and keep
`--parallel=1`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D1** Intentionally-broken fixtures EXCLUDED; only classified-clean fixtures get coverage
  (classify by running, not by name). No negative/exit-inverting targets.
- **D2** Non-Angular files use `@nx/js:tsc` with `noEmit` (NOT raw `tsc` run-commands). Angular ->
  `angular-typechecker:typecheck`. **See Q1 - the `@nx/js:tsc` half of this decision is not
  achievable and must be revised to `nx:run-commands` + `tsc --noEmit`.**
- **D3** Additive coverage only - do NOT force build/test/e2e onto projects that don't need them.
  Do not fight `.nxignore` / release `preVersionCommand`.
- **D4** Unify vocabulary: `nx run-many -t typecheck | test | e2e`. Single target NAME `typecheck`
  across all projects. Rename e2e `test` -> `e2e`, preserve `--parallel=1`.
- **D5** 3-tier test split (test / integration / e2e); reclassify `gate-b.spec.ts` +
  `compiler-cli-types.runtime.spec.ts` to `*.integration.spec.ts` via `git mv`.

### Claude's Discretion
- Mechanism details (config-file vs CLI split, tsconfig grouping for clean fixtures).

### Deferred / Out of scope
- `.planning/**` (ignored). Standalone CLI. Broken-fixture coverage.
</user_constraints>

---

## Q1. `@nx/js:tsc` as a no-emit typecheck target -> NOT POSSIBLE; use `nx:run-commands` + `tsc --noEmit`

**VERIFIED (`node_modules/@nx/js` 23.0.1):**

- Schema (`dist/src/executors/tsc/schema.json`) `required: ["main", "outputPath", "tsConfig"]`. There
  is **no `noEmit`, `emitDeclarationOnly`, or `typecheckOnly` option.** You cannot omit `outputPath`.
- `dist/src/utils/typescript/compilation.js` `getNormalizedTsConfig()` forces
  `tsConfig.options.outDir = options.outputPath` and `tsConfig.options.noEmitOnError = true`.
- `createProgram()` calls `program.emit(...)` then: `if (results.emitSkipped) { logger.error(...); return { success: false }; }`.
  With `noEmit: true`, `program.emit()` *always* sets `emitSkipped: true` -> **the target always
  fails**, even with zero type errors, and prints no meaningful diagnostic. CI-red landmine.
- Nx's canonical inference target (`dist/src/plugins/typescript/plugin.js` ~L274-279) uses
  `tsc --build <config> --emitDeclarationOnly` and swaps in
  `echo "The 'typecheck' target is disabled because one or more project references set 'noEmit: true'..."`
  when any referenced tsconfig has `noEmit: true`. Confirms noEmit is fundamentally incompatible with
  Nx's tsc-based type-check.

**Recommended pattern (the accepted Nx 23 no-emit typecheck):** `nx:run-commands` running
`tsc --noEmit -p <tsconfig>` - identical to the existing `typecheck-drift` / `typecheck-e2e`.

```json
"typecheck": {
  "executor": "nx:run-commands",
  "cache": true,
  "inputs": [
    "default",
    "{workspaceRoot}/tsconfig.base.json",
    { "externalDependencies": ["typescript"] }
  ],
  "options": { "command": "tsc --noEmit -p libs/test-util/tsconfig.spec.json", "cwd": "." }
}
```

**Pitfall:** Do not point `@nx/js:tsc` at a spec/config tsconfig. Even ignoring noEmit, it requires a
single `main` entry point (specs/configs have none) and would emit `.js` + a generated `package.json`
into `dist`. **Action for the plan:** revise D2 wording from "`@nx/js:tsc` with noEmit" to
"`nx:run-commands` + `tsc --noEmit -p`". [ASSUMED that the user accepts this revision - it is the only
way to satisfy the *goal* of D2, a real no-emit type-check.]

## Q2. Unified `typecheck` name across multiple executors - targetDefaults precedence

**VERIFIED (`node_modules/nx/dist/src/project-graph/utils/project-configuration/target-defaults.js`,
`readTargetDefaultsForTarget`):** exactly ONE targetDefault is selected per target, in this order:

1. If the target has an executor AND `targetDefaults[<executor-id>]` exists -> **use the executor key
   only** (the name key is *ignored*).
2. Else if `targetDefaults[<targetName>]` exists -> use the name key.
3. Else -> longest matching glob key.

**Crucial clarification of CONTEXT.md:** the existing nx.json key `"angular-typechecker:typecheck"` is
an **EXECUTOR-id key** (`<plugin>:<executor>`), not a target-name key. It applies only to targets whose
`executor` is `angular-typechecker:typecheck`. So:

| Target's executor | Which default applies |
|---|---|
| `angular-typechecker:typecheck` (app, consumer libs, clean fixtures) | existing `angular-typechecker:typecheck` executor default (`outputs: []`, rich inputs) |
| `nx:run-commands` (plugin, test-util, e2e, tooling, drift) | the **name-keyed `typecheck`** default (there is no `nx:run-commands` key) |
| `@nx/js:tsc` (do NOT use for typecheck) | would hit the `@nx/js:tsc` default (`dependsOn:["^build"]`, no `outputs:[]`) - another reason to avoid it |

**Recommended nx.json (add a name-keyed default; keep the executor one):**

```json
"targetDefaults": {
  "angular-typechecker:typecheck": { "...existing (leave as-is)": true },
  "typecheck": {
    "cache": true,
    "outputs": []
  }
}
```

**Merge behaviour (VERIFIED `target-merging.js` `mergeTargetConfigurations`):** array props like
`inputs`/`outputs` from a target's own config **replace** the default's (target wins; only the `"..."`
spread sentinel merges). So keep each run-commands target's own `inputs` (external deps) - they
override the default cleanly, and `cache: true` + `outputs: []` fill in from the name default.

**Pitfall:** Do NOT expect the name-keyed `typecheck` default to configure the Angular executor targets
- the executor key shadows it. That is fine (the executor default already sets `outputs: []` + the
right inputs), but planning must not "consolidate" both into one name-keyed default expecting it to
reach the Angular targets.

## Q3. Fold `typecheck-drift` + `typecheck-e2e` into `typecheck`

Both are already `nx:run-commands` + `tsc --noEmit -p` - the correct executor (Q1). **RENAME, do not
convert.**

- `typecheck-drift` -> `typecheck` on the plugin. Keeps `nx:run-commands`, keeps its per-target
  `inputs` (the drift/type files + `externalDependencies: ["typescript","@angular/compiler-cli"]`).
  Command unchanged: `tsc --noEmit -p packages/angular-typechecker/tsconfig.drift.json`.
- `typecheck-e2e` -> `typecheck` on each of the 3 e2e projects. Keeps `nx:run-commands`, keeps its
  `inputs` (`externalDependencies: ["typescript","vitest","@nx/vite","@nx/devkit"]`). Command
  unchanged: `tsc --noEmit -p e2e/<proj>/tsconfig.spec.json`.

**Per-project caveat:** the plugin needs to type-check *both* its drift tsconfig *and* its lib+spec (Q1
gap #1). A single project can have only one `typecheck` target, so use `nx:run-commands` `commands: []`
(array) to run multiple `tsc --noEmit` invocations under one target:

```json
"typecheck": {
  "executor": "nx:run-commands",
  "cache": true,
  "inputs": ["default", "{workspaceRoot}/tsconfig.base.json",
    { "externalDependencies": ["typescript", "@angular/compiler-cli"] }],
  "options": {
    "commands": [
      "tsc --noEmit -p packages/angular-typechecker/tsconfig.spec.json",
      "tsc --noEmit -p packages/angular-typechecker/tsconfig.drift.json"
    ],
    "parallel": false,
    "cwd": "."
  }
}
```

Note `tsconfig.spec.json` `include`s `src/**/*.spec.ts` + the vitest configs and `extends` the
`nodenext` solution tsconfig (verified) - so it type-checks the ~50 plugin specs (the biggest gap) and
the plugin's own `vitest.config.mts`. Lib source stays covered by `build`.

**Pitfall:** enabling spec type-checking for the first time will surface real errors that must be fixed
to go green (CONTEXT gap #1) - budget for it. Set `"parallel": false` in the `commands` block so two
`tsc` runs don't interleave output/racing on the same `.tsbuildinfo` if one is ever added.

## Q4. Vitest 3-tier split (D5)

**VERIFIED (`node_modules/@nx/vitest/dist/src/executors/test/schema.json` 23.0.1):** options are
`configFile` (alias `config`), `reportsDirectory`, `mode`, `runMode`, `testFiles`, `watch`. **There is
no `--exclude` / include-glob option.** (Also note: the executor carries an `x-deprecated` notice -
removed in Nx v24, migrate to `@nx/vitest/plugin` later; out of scope for this task.)

Since there is no exclude flag, **use two config files** (matches D5's stated preference):

- `vitest.config.mts` (existing) -> narrow `include` to fast unit only:
  `include: ['src/**/!(*.integration).spec.ts']` (or add `exclude: ['**/*.integration.spec.ts']`).
- `vitest.integration.config.mts` (new) -> `include: ['src/**/*.integration.spec.ts']`, separate
  `test.name: 'angular-typechecker:integration'`, separate coverage dir.

```jsonc
// project.json (plugin) - two @nx/vitest:test targets
"test": {
  "executor": "@nx/vitest:test",
  "dependsOn": ["build"],
  "outputs": ["{options.reportsDirectory}"],
  "options": { "reportsDirectory": "coverage/packages/angular-typechecker" }
},
"integration": {
  "executor": "@nx/vitest:test",
  "dependsOn": ["build"],
  "outputs": ["{options.reportsDirectory}"],
  "options": {
    "configFile": "packages/angular-typechecker/vitest.integration.config.mts",
    "reportsDirectory": "coverage/packages/angular-typechecker-integration"
  }
}
```

- **targetDefaults apply to BOTH automatically** - VERIFIED: the `@nx/vitest:test` default is
  executor-keyed, and the precedence rule (Q2) selects it by executor regardless of the target name
  (`test` or `integration`). Both inherit `cache: true` + `inputs: ["default","^production"]`.
- **`reportsDirectory` must differ** between the two (shown above) so v8 coverage doesn't overwrite.
- The default `vitest.config.mts` target uses no `configFile` option; `@nx/vitest:test` auto-discovers
  the project's `vitest.config.mts`. The `integration` target must set `configFile` explicitly.

**Renaming e2e `test` -> `e2e`:** VERIFIED - the `@nx/vitest:test` executor default still applies after
rename (executor-keyed, Q2). Keep `outputs: ["{options.reportsDirectory}"]`. `nx run-many -t e2e`
runs the target for the 3 e2e projects only. **`--parallel=1` is still required** at the run-many level
- the 3 e2e projects pack+`rm` the *same* dist tarball (ci.yml lines 178-190; MEMORY:
  "e2e projects share one tarball; serialize"). Update ci.yml's e2e step from
  `nx run-many -t test -p <3 projects> --parallel=1` to `nx run-many -t e2e --parallel=1` (no `-p`
  list needed - only the e2e projects define `e2e`).

**Pitfall:** the `gate-b` + `compiler-cli-types.runtime` reclassification is a `git mv` to
`*.integration.spec.ts`. After renaming, the *fast* `test` target's narrowed `include` must actually
exclude them (via the `!(*.integration)` glob or `exclude`), or they'll run in both tiers. Verify no
source references those two spec paths by string before the `git mv` (the include globs catch them
either way, but a hard-coded path would break).

## Q5. Clean loose fixtures via `nx run-many -t typecheck` (no new graph projects)

**KEY CAPABILITY (VERIFIED `packages/angular-typechecker/src/core/walk-references.ts`):** the
`angular-typechecker:typecheck` executor supports **solution-style tsconfigs**. Given a `tsconfig.json`
with `files: []` + `references: [...]`, it resolves **one level** of references, applies a
module-boundary guard (each leaf must be *under the solution tsconfig's directory*), skips
self/duplicate references, and runs `performCompilation` **per leaf as its own program** (no
cross-fixture symbol collisions), unioning diagnostics. A nonexistent reference becomes a counted
`90002` error.

**Recommended mechanism (ONE target, no project.json added to any fixture):**

1. Create `fixtures/tsconfig.clean.json` (solution-style), listing only the empirically-classified
   clean fixtures - Angular *and* non-Angular (the executor's `performCompilation` type-checks plain TS
   fine, and each leaf already sets its own `noEmit: true` + `moduleResolution: bundler`):

```jsonc
{
  "files": [],
  "references": [
    { "path": "./clean-template-host/tsconfig.app.json" },
    { "path": "./not-type-checked-clean/tsconfig.json" }
    // ... only the classified-clean set; broken siblings are simply omitted
  ]
}
```

2. Add a `typecheck` target to the **root project** (`@angular-typechecker/source`, `./project.json`):

```json
"typecheck": {
  "executor": "angular-typechecker:typecheck",
  "options": { "tsConfig": "fixtures/tsconfig.clean.json" },
  "inputs": [
    "{workspaceRoot}/fixtures/**/*",
    "{workspaceRoot}/tsconfig.base.json",
    { "externalDependencies": ["typescript", "@angular/compiler-cli"] }
  ]
}
```

- Broken fixtures excluded simply by omission from `references[]` (D1 satisfied).
- No project.json on fixtures -> they stay off the graph -> `run-many -t build`, `.nxignore`, and
  release scoping are untouched (D3 satisfied).
- Place the solution tsconfig at `fixtures/` (not repo root) so the module-boundary guard's containment
  check keeps leaves scoped to `fixtures/`.

**MUST-OVERRIDE inputs pitfall (CI-red / cache-poisoning risk):** the root project's `{projectRoot}` is
the **repo root**. The executor-keyed `angular-typechecker:typecheck` default's inputs include the
`default` namedInput (`{projectRoot}/**/*` = the *entire repo*, including `.planning/`). On the root
project that makes the cache key depend on every file in the repo - it will ~never hit cache and any
edit busts it. **The target MUST declare its own `inputs`** (shown above) - which *replaces* the
executor default's inputs per the merge rule (Q2). Do not rely on the executor default here.

**Ponytail/scope note:** the clean fixtures are ALREADY type-checked by the real
`@angular/compiler-cli` inside the 16 `*.integration.spec.ts` (extended-catalog / run-typecheck /
config-resolution assert their exact clean-vs-broken diagnostics). A dedicated clean-fixtures
`typecheck` target is therefore *redundant* coverage - the genuine new coverage in this task is the
plugin spec files (Q3) and the tooling configs (Q6). Recommend the planner confirm with the user
whether the clean-fixtures target is worth the maintenance (a hand-maintained `references[]` list that
must be re-classified whenever a fixture is added) or whether spec-level coverage suffices. If kept,
the mechanism above is the least-invasive one.

## Q6. Type-checking `.mjs` / `.mts` / `.js` tooling configs

**Files in scope (VERIFIED via `git ls-files`, excluding `.planning/`):** 11 configs -
root `eslint.config.mjs`, `vitest.workspace.ts`; `apps/ng-spike-app/eslint.config.mjs`;
`libs/test-util/{eslint.config.mjs,vitest.config.mts}`;
`packages/angular-typechecker/{eslint.config.mjs,vitest.config.mts}`;
`e2e/*/vitest.config.mts` (x3).

**Recommended: ONE root `tsconfig.tools.json` + a root-project run-commands `typecheck` command.**
Required options (the repo base sets `moduleResolution: "node"` (classic) + `module: "esnext"` with no
`allowJs`/`checkJs`, none of which type-checks `.mjs`/`.js` or resolves modern `exports` maps):

```jsonc
// tsconfig.tools.json (repo root)
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "allowJs": true,          // .mjs / .js
    "checkJs": true,          // actually type-check the .mjs/.js configs
    "module": "esnext",
    "moduleResolution": "bundler", // resolves package `exports` maps; lenient on import extensions
    "target": "es2022",
    "types": ["node"],        // __dirname, process, etc.
    "skipLibCheck": true
  },
  "include": [
    "eslint.config.mjs",
    "vitest.workspace.ts",
    "apps/ng-spike-app/eslint.config.mjs",
    "libs/test-util/eslint.config.mjs",
    "libs/test-util/vitest.config.mts",
    "packages/angular-typechecker/eslint.config.mjs",
    "packages/angular-typechecker/vitest.config.mts",
    "e2e/angular-typechecker-cache-e2e/vitest.config.mts",
    "e2e/angular-typechecker-install-e2e/vitest.config.mts",
    "e2e/angular-typechecker-matrix-e2e/vitest.config.mts"
  ]
}
```

Because the root project can host only one `typecheck` target and Q5 also wants the root project for
clean fixtures, put this tooling check as an *additional command* on the plugin project's `typecheck`
`commands: []` (Q3), OR give the root project a run-commands `typecheck` with `commands: []` that runs
BOTH the tools tsc and delegates the fixtures... no - the fixtures need the Angular executor. **Cleanest
resolution:** root project `typecheck` = the Angular executor over `fixtures/tsconfig.clean.json` (Q5);
add `tsc --noEmit -p tsconfig.tools.json` as one entry in the **plugin's** `typecheck` `commands: []`
(the tooling configs are workspace-wide; attaching the sweep to the plugin project is arbitrary but
harmless - `run-many -t typecheck` runs all targets regardless of which project hosts the sweep).

**Pitfalls (any could turn CI red the first time):**
- **Flat ESLint config typing:** `import nx from '@nx/eslint-plugin'` then `...nx.configs['flat/base']`.
  If the plugin types `configs` values loosely (`any`) the spread is fine; if typed as a non-iterable
  object, `checkJs` will error on the spread. Verify per-file; if it errors, either narrow with a local
  cast or exclude that one file with an inline comment explaining why.
- **`import.meta`** in `.mts`: allowed under `module: esnext` + `moduleResolution: bundler`. OK.
- **`__dirname` in `.mts`** (plugin `vitest.config.mts` uses `root: __dirname`): type-checks clean
  because `@types/node` declares it ambiently, even though the file is nominally ESM. Not a blocker.
- **`vitest/config` + `@nx/vite/plugins/*` types:** shipped as `.d.ts`, resolvable under `bundler`. OK.
- **eslint inputs interaction:** the `production` namedInput excludes `eslint.config.mjs`, and the
  `@nx/eslint:lint` default already lists `eslint.config.mjs` as an input. The tools `typecheck` target
  should use `default` (not `production`) inputs so config edits bust its cache.

## Q7. Dogfood `angular-typechecker:typecheck` on the app + Angular libs

**VERIFIED (`packages/angular-typechecker/src/executors/typecheck/schema.json`):** the executor takes
`tsConfig` (required), `includeDeps` (default `false`), `maxWarnings`, `failFast`, `strict`. The
consumer libs already prove it works pointed at a lib tsconfig (`libs/typecheck-consumer/project.json`
uses it with `includeDeps: true`).

**Recommended app target:**

```json
"typecheck": {
  "executor": "angular-typechecker:typecheck",
  "options": { "tsConfig": "apps/ng-spike-app/tsconfig.app.json" }
}
```

- Point it at `tsconfig.app.json` (the same tsconfig `@angular/build` compiles). This is the showcase
  dogfood target - it adds the Angular template + NG8xxx extended diagnostics that `build` also runs,
  but decoupled.
- **`includeDeps`:** leave at default `false` (excludes node_modules / out-of-project diagnostics) for
  a clean app verdict. The consumer libs set `true` deliberately to exercise transitive walking; the
  app doesn't need it. [ASSUMED - confirm the app has no intentional cross-boundary diagnostics you'd
  want surfaced; if it does, set `includeDeps: true`.]
- No new inputs needed - the executor-keyed `angular-typechecker:typecheck` default applies (Q2) and
  its `{projectRoot}/**/*` default input is fine for a real project (unlike the root project, Q5).

**Pitfall:** the app `build` already type-checks app source, so this target's marginal value is the
extended NG8xxx diagnostics and the "runs without building" property - that IS the dogfood point, so
keep it, but don't expect it to catch errors `build` misses on the *app* (it may on templates if the
builder's check is narrower).

---

## Consolidated target layout (recommendation)

| Project | `typecheck` executor | Covers | Notes |
|---|---|---|---|
| ng-spike-app | `angular-typechecker:typecheck` | app src + templates | Q7 |
| typecheck-consumer / walk-consumer | `angular-typechecker:typecheck` | (exists) | unchanged |
| typecheck-consumer-dep | `nx:run-commands` tsc --noEmit *or* fold into a consumer | index.ts, dep.component.ts | gap #4 |
| angular-typechecker (plugin) | `nx:run-commands` `commands:[]` | spec tsconfig + drift tsconfig + `tsconfig.tools.json` | folds `typecheck-drift`; Q3/Q6 |
| test-util | `nx:run-commands` tsc --noEmit | lib+spec tsconfig | Q1 |
| @angular-typechecker/source (root) | `angular-typechecker:typecheck` | `fixtures/tsconfig.clean.json` | Q5; MUST override inputs |
| 3x e2e | `nx:run-commands` tsc --noEmit (renamed from `typecheck-e2e`) | e2e spec tsconfig | Q3; keep own inputs |

| Target | Change |
|---|---|
| e2e `test` (x3) | rename -> `e2e` (executor default follows); ci.yml `-t e2e --parallel=1` |
| plugin `test` | narrow `include` to fast unit; add `integration` target + `vitest.integration.config.mts` (D5/Q4) |
| nx.json targetDefaults | add name-keyed `"typecheck": { "cache": true, "outputs": [] }`; keep executor keys |

**Green-before-PR gates (from CONTEXT + ci.yml):** `nx run-many -t typecheck`, `-t test`,
`-t integration`, `-t e2e --parallel=1`, `-t lint`, `nx format:check`,
`nx scoped-name-guard angular-typechecker`; if ci.yml edited, `bash tools/act/act-compat.sh` +
actionlint. `@nx/eslint:lint` default `maxWarnings: 0` - new/edited files must be Prettier- and
lint-clean.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | D2's "`@nx/js:tsc` with noEmit" will be revised to `nx:run-commands` + `tsc --noEmit` | Q1 | If forced to keep `@nx/js:tsc`, all non-Angular typecheck targets fail CI (verified) |
| A2 | Clean-fixtures `typecheck` target is worth adding despite spec-level redundancy | Q5 | Wasted maintenance (hand-kept `references[]`); no correctness impact |
| A3 | App has no intentional cross-boundary diagnostics needing `includeDeps: true` | Q7 | App typecheck under-reports; flip to `true` |
| A4 | The flat ESLint config files type-check clean under `checkJs`+`bundler` | Q6 | One or more configs need an inline exclusion comment; classify at execution |

## Sources

### Primary (HIGH - inspected at 23.0.1)
- `node_modules/@nx/js/dist/src/executors/tsc/schema.json` - required main/outputPath/tsConfig, no noEmit
- `node_modules/@nx/js/dist/src/utils/typescript/compilation.js` - forced outDir/noEmitOnError, emitSkipped=failure
- `node_modules/@nx/js/dist/src/plugins/typescript/plugin.js` - canonical `tsc --build --emitDeclarationOnly`, noEmit-disables-typecheck
- `node_modules/@nx/vitest/dist/src/executors/test/schema.json` - options (no exclude), x-deprecated
- `node_modules/nx/dist/src/project-graph/utils/project-configuration/target-defaults.js` - `readTargetDefaultsForTarget` precedence
- `node_modules/nx/dist/src/project-graph/utils/project-configuration/target-merging.js` - `mergeTargetConfigurations` array-replace
- `packages/angular-typechecker/src/executors/typecheck/schema.json` + `src/core/walk-references.ts` - executor options + solution-style walk
- Repo: `nx.json`, all relevant `project.json`, `tsconfig.*`, `.github/workflows/ci.yml`, `git ls-files` config enumeration

**Confidence:** HIGH across all seven questions - every mechanic is source-verified against the
installed 23.0.1 packages, not training data.
