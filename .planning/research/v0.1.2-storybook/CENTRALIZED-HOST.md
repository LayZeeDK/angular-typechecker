# Nx centralized Storybook host: recipe + tsconfig layout (empirical)

Researched 2026-07-05. Builds on `NX-SCAFFOLD.md` in this same directory
(single-project Storybook setup).

## Headline answer

**Yes, aggregated stories live OUTSIDE the host project's own directory --
that is the entire point of the recipe --** and the host's
`.storybook/tsconfig.json` `include` glob is a normal filesystem glob that
reaches out via `../../` (or further) relative segments to pull in `.ts`
files from other projects entirely. I reproduced this empirically: widening
a host's `.storybook/tsconfig.json` `include` to
`../../mylib/src/**/*.stories.ts` (a file physically in a sibling project)
made both plain `tsc --noEmit` **and the real Angular compiler (`ngc
--noEmit`, full `strictTemplates`)** pick up and cleanly compile that
cross-project file with zero special configuration. The host's own solution
`tsconfig.json` still lists `./.storybook/tsconfig.json` in `references[]`
exactly as in the single-project case -- nothing about the reference-wiring
changes; only the leaf's `include` glob reaches further outward. This is a
**manual, hand-edited step** -- no generator flag produces the cross-project
glob automatically.

## The official recipe

**URL:** https://nx.dev/recipes/storybook/one-storybook-for-all
**Title:** "Publishing Storybook - One main Storybook instance for all projects"
(there is a sibling recipe, "One Storybook instance per scope", not fetched
here since the team's ask is the single-instance case.)

Fetched via `markdown.new` (first fallback attempt succeeded, HTTP 200).

### What it prescribes, step by step

1. **Generate a new, otherwise-empty library to act as the host.** Example
   given for React:
   ```
   nx g @nx/react:library libs/storybook-host --bundler=none --unitTestRunner=none
   ```
   For Angular the equivalent is `@nx/angular:library` (not shown in the
   doc, but consistent with the framework-per-project convention the whole
   recipe is built on -- "all your projects ... are using the same
   framework"). This library holds no real app code; the recipe explicitly
   says "you can delete the contents of the `src/lib` folder."

2. **Run the standard Storybook configuration generator on it:**
   ```
   nx g @nx/storybook:configuration storybook-host --interactionTests=true --uiFramework=@storybook/react-vite
   ```
   (Angular equivalent: `--uiFramework=@storybook/angular`, or simply
   `nx g @nx/angular:storybook-configuration storybook-host`.) This step is
   **identical to the single-project case** -- it only creates the
   `.storybook/` folder and infers the usual `storybook` /
   `build-storybook` / `test-storybook` targets. No cross-project awareness
   exists at this point.

3. **Manually edit `.storybook/main.ts`'s `stories` glob** to reach into
   other projects. Sample given:
   ```javascript
   const config: StorybookConfig = {
     stories: ['../../**/ui/**/src/lib/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
     ...
   };
   ```
   The doc explicitly invites multiple patterns/globs to cover different
   project groups.

4. **"If you're using Angular, add the stories in your tsconfig.json"** --
   this is a dedicated, Angular-specific step absent for other frameworks
   (React/Vue don't need it because their Storybook builders don't route
   through the Angular/TypeScript project-reference compilation model the
   same way). Sample `.storybook/tsconfig.json`:
   ```json
   {
     "extends": "../tsconfig.json",
     "compilerOptions": { "emitDecoratorMetadata": true },
     "exclude": ["../**/*.spec.ts"],
     "include": ["../../**/ui/**/src/lib/**/*.stories.ts", "*.ts"]
   }
   ```
   The doc explicitly says to "specify the paths to our stories, using the
   same pattern we used in our `.storybook/main.ts`" -- i.e. the `main.ts`
   glob and the `tsconfig.json` `include` glob must be kept in sync by
   hand; there is no generator or codemod that does this for you.

5. Serve/build/test as normal (`nx storybook storybook-host`, etc.) --
   nothing else changes.

### The dependency-tracking gap the recipe itself calls out

The recipe has an "Extras - dependencies" section explicitly warning that
**Nx cannot see the cross-project imports inside `.storybook/main.ts`**, so
the host won't correctly invalidate its cache when a dependency project
changes. The prescribed fix is to manually declare
`"implicitDependencies": [...]` in the host's `project.json` listing every
project it aggregates stories from. This is corroborating evidence that Nx
treats the `.storybook/main.ts`/`.storybook/tsconfig.json` cross-project
glob as entirely outside its normal project-graph inference -- consistent
with why `angular-typechecker`'s own boundary filter (which presumably also
reasons about "files belonging to this project") needs a deliberate design
decision here rather than picking up graph information for free.

## Empirical reproduction (this repo's throwaway `sblab` workspace)

Continuing directly from `NX-SCAFFOLD.md`'s workspace (Nx 23.0.1, Angular
21.2.9, TypeScript 5.9.3, Storybook/`@storybook/angular` 10.4.6 -- same
version-delta caveat as that report: `@storybook/angular`'s peer range
excludes Angular 22/TS 6, so I stayed on the workspace's native Angular 21
stack; the tsconfig-wiring behavior itself has no runtime dependency on the
installed Angular/TS version).

```bash
# 1. Host library, no test runner (a pure shell, per the recipe).
npx nx g @nx/angular:library storybook-host --unitTestRunner=none --no-interactive

# 2. Standard Storybook configuration -- identical to the single-project case.
#    --generateStories=false since this host has no components of its own.
npx nx g @nx/angular:storybook-configuration storybook-host --generateStories=false --no-interactive
```

Generated `storybook-host/tsconfig.json` (before any manual cross-project edit --
identical shape to the single-project case in `NX-SCAFFOLD.md`):

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { ... },
  "angularCompilerOptions": { ... },
  "files": [],
  "include": [],
  "references": [
    { "path": "./tsconfig.lib.json" },
    { "path": "./.storybook/tsconfig.json" }
  ]
}
```

Generated `storybook-host/.storybook/tsconfig.json` (before edit -- scoped
to the host's own `src/`, exactly like the single-project case):

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": { "emitDecoratorMetadata": true },
  "exclude": ["../**/*.spec.ts"],
  "include": [
    "../src/**/*.stories.ts", "../src/**/*.stories.js",
    "../src/**/*.stories.jsx", "../src/**/*.stories.tsx",
    "../src/**/*.stories.mdx", "*.js", "*.ts"
  ]
}
```

Then, following the recipe's manual step, I widened both `main.ts` and
`.storybook/tsconfig.json` to reach into the sibling `mylib` project (which
already has a real component + a real `*.stories.ts` file from the
single-project research):

```javascript
// storybook-host/.storybook/main.ts (edited)
stories: [
  '../**/*.@(mdx|stories.@(js|jsx|ts|tsx))',
  '../../mylib/src/**/*.stories.@(js|jsx|ts|tsx|mdx)',
],
```

```json
// storybook-host/.storybook/tsconfig.json (edited -- added one line)
"include": [
  "../src/**/*.stories.ts", "../src/**/*.stories.js",
  "../src/**/*.stories.jsx", "../src/**/*.stories.tsx",
  "../src/**/*.stories.mdx",
  "../../mylib/src/**/*.stories.ts",
  "*.js", "*.ts"
]
```

**Verification 1 -- file discovery.** `tsc -p storybook-host/.storybook/tsconfig.json --noEmit --listFilesOnly | rg mylib` returned both:
```
.../mylib/src/lib/mylib/mylib.ts
.../mylib/src/lib/mylib/mylib.stories.ts
```
confirming the compiler pulls in the cross-project story **and its
transitively-imported component** purely via the widened glob -- no path
alias, no reference to `mylib`'s own tsconfig needed for file discovery.

**Verification 2 -- plain TypeScript compiles clean.** `tsc -p
storybook-host/.storybook/tsconfig.json --noEmit` produced zero output
(zero errors).

**Verification 3 -- the real Angular compiler compiles clean too.** `npx ngc
-p storybook-host/.storybook/tsconfig.json --noEmit` (the actual
`@angular/compiler-cli` binary, with `strictTemplates: true` inherited
through the `extends` chain) also produced zero output -- meaning full
Angular template type-checking of a component physically outside the host
project succeeds with no additional wiring beyond the one-line `include`
edit the recipe documents. This is the closest available proxy in this
scratch stack for what `angular-typechecker`'s own `performCompilation` call
would do.

**Verification 4 -- the reference survives the manual edit.**
`storybook-host/tsconfig.json`'s `references[]` still lists
`./.storybook/tsconfig.json` after the `include` widening -- confirming (as
expected, since the generator step and the manual edit are two independent,
sequential operations) that nothing about the reference-injection mechanism
documented in `NX-SCAFFOLD.md` needs to change for the centralized-host
case. Only the leaf's own `include` array changes.

## Cross-reference: `D:/projects/github/radix-ng/primitives` (real Angular 22 / TS 6 / Storybook 10 instance)

Confirmed stack versions (root `package.json`):

| Package | Version |
|---|---|
| `@angular/core` | 22.0.2 |
| `typescript` | 6.0.3 |
| `storybook` | 10.4.6 |
| `@nx/angular`, `@nx/storybook`, `nx` | 23.1.0-beta.1 (note: beta, one minor ahead of this repo's stable 23.0.1) |

### `apps/radix-storybook/tsconfig.json` (host solution tsconfig, verbatim)

```json
{
    "compilerOptions": {
        "target": "es2022",
        "useDefineForClassFields": false,
        "esModuleInterop": true,
        "forceConsistentCasingInFileNames": true,
        "strict": true,
        "noImplicitOverride": true,
        "noPropertyAccessFromIndexSignature": true,
        "noImplicitReturns": true,
        "noFallthroughCasesInSwitch": true,
        "module": "preserve",
        "moduleResolution": "bundler",
        "lib": ["dom", "es2022"]
    },
    "files": [],
    "include": [],
    "references": [
        { "path": "./.storybook/tsconfig.json" }
    ],
    "extends": "../../tsconfig.base.json",
    "angularCompilerOptions": {
        "enableI18nLegacyMessageIdFormat": false,
        "strictInjectionParameters": true,
        "strictInputAccessModifiers": true,
        "strictTemplates": true
    }
}
```

Notable: **`references[]` contains ONLY `.storybook/tsconfig.json`** -- no
`tsconfig.app.json`/`tsconfig.lib.json` at all. This host app truly has no
source of its own (matches the recipe's "delete the contents of `src/lib`"
suggestion, taken to its logical conclusion: don't even keep an app/lib
leaf). For `angular-typechecker`'s walker this means a centralized-host
project can legitimately have a solution `tsconfig.json` whose *only* leaf
is the Storybook one.

### `apps/radix-storybook/.storybook/tsconfig.json` (verbatim)

```json
{
    "extends": "../tsconfig.json",
    "compilerOptions": {
        "emitDecoratorMetadata": true,
        "resolveJsonModule": true
    },
    "exclude": ["../**/*.spec.ts"],
    "include": [
        "../../../packages/primitives/**/*.stories.ts",
        "../../../packages/primitives/**/*.stories.tsx",
        "../../../packages/primitives/**/*.stories.mdx",
        "../../../packages/primitives/**/*.directive.ts",
        "../../../packages/primitives/**/*.component.ts",
        "../../../packages/primitives/**/src/**/*.ts",
        "*.ts",
        "*.tsx"
    ]
}
```

Two things beyond the minimal recipe:

- The glob reaches **three** `../` segments up (`.storybook/` ->
  `radix-storybook/` -> `apps/` -> repo root) and then into
  `packages/primitives/` -- i.e. an entirely different top-level directory
  from the host app, not just "a sibling lib." The recipe's own example
  only demonstrated `../../**/ui/**` inside what was implicitly the same
  `libs/` tree; radix shows the pattern generalizes to crossing top-level
  workspace directories (`apps/` <-> `packages/`) with no extra
  configuration.
- The `include` list is **not limited to `.stories.*`** -- it also sweeps
  `**/*.directive.ts`, `**/*.component.ts`, and `**/src/**/*.ts` for the
  entire `packages/primitives` tree. This means radix's real-world choice
  is to type-check essentially all of `packages/primitives`' source through
  this one host leaf, not just the story files themselves. This is a
  deliberate widening beyond what the official recipe shows, presumably
  because the actual directive/component source needs to be in the
  compiler's closure for the stories to resolve real types, or simply
  because they wanted one comprehensive host-driven compile pass. Worth
  noting as a real-world data point: **the boundary of "what this leaf
  type-checks" is not reliably narrower than "the aggregated project's
  entire source tree."**

### Does radix match the official recipe, or deviate?

**The tsconfig wiring matches the recipe's pattern exactly** (host solution
tsconfig references only `.storybook/tsconfig.json`; that leaf's `include`
reaches outside the host directory via relative-path globs; the pattern is
manually maintained, not generator-produced). **The Storybook framework
itself deviates:** radix uses `@analogjs/storybook-angular` (`.storybook/main.ts`
imports `StorybookConfig` from `@analogjs/storybook-angular`, and
`project.json`'s `storybook`/`build-storybook` targets use the
`@analogjs/storybook-angular:start-storybook` / `:build-storybook`
executors), a Vite-based framework maintained by the AnalogJS project --
**not** `@storybook/angular` (the webpack-based framework `@nx/angular:storybook-configuration`
actually scaffolds, per `NX-SCAFFOLD.md`). This means radix's exact
Storybook setup was **not** produced by running `@nx/angular:storybook-configuration`
as-is; it was hand-built or migrated to AnalogJS's framework afterward. This
is corroborated by `project.json`'s targets using bespoke
`@analogjs/storybook-angular:*` executors and a heavily customized
`.storybook/main.ts` (custom Vite plugin for `?raw` imports, `compodoc`
integration, custom `staticDirs`, etc.) well beyond anything a generator
would emit.

**`project.json`'s `implicitDependencies`:**
```json
"implicitDependencies": ["primitives"]
```
confirming radix followed the recipe's "Extras - dependencies" advice to
manually declare the cross-project dependency Nx can't infer from
`.storybook/main.ts` imports.

### Path aliases: how they're actually involved

`tsconfig.base.json` at the repo root defines one path-alias entry per
published primitive, e.g.:
```json
"@radix-ng/primitives/tabs": ["packages/primitives/tabs/index.ts"],
"@radix-ng/primitives/accordion": ["packages/primitives/accordion/index.ts"],
...
```
This flows into the host's `.storybook/tsconfig.json` automatically through
the ordinary `extends` chain (`.storybook/tsconfig.json` -> `../tsconfig.json`
-> `../../tsconfig.base.json`) -- **no special wiring is needed for a
centralized host to see the same `paths` map every other leaf in the
workspace already sees.** Concretely:

- **The `include` glob never uses aliases** -- `include`/`exclude` in
  `tsconfig.json` are always filesystem-relative glob patterns; TypeScript
  does not resolve `paths` aliases when discovering files via `include`.
  That's why the glob has to physically walk `../../../packages/primitives/**`
  rather than something alias-shaped.
- **Aliases DO matter for the compiled files' own `import` statements.**
  Most same-package stories use plain relative imports (verified in
  `packages/primitives/accordion/stories/accordion.stories.ts`: `import {
  RdxAccordionHeaderDirective } from '../src/accordion-header.directive'`,
  since the story sits right next to its own package's `src/`). But some
  stories import their own package's *public* entry point via the alias
  instead of a relative path -- confirmed in
  `packages/primitives/tabs/stories/tabs.stories.ts`:
  `} from '@radix-ng/primitives/tabs';` -- exercising the same public API
  surface a consuming application would use. Either way, resolution "just
  works" because the alias map is already in scope via `extends`, with zero
  extra configuration attributable to the centralized-host pattern itself.

## Implications for `angular-typechecker`'s boundary/coverage design

1. **The "diagnostics only count if the file is under the project's own
   directory" assumption is invalidated by an officially documented Nx
   pattern**, not an edge case. For a centralized host, essentially every
   file of interest (the aggregated stories, and per radix's real-world
   extension, the aggregated libraries' entire source) lives outside the
   host project's directory tree by design. A references-walker that
   already resolves `include` globs correctly (as required for
   `NX-SCAFFOLD.md`'s single-project case) will *already* pick these files
   up in the compilation unit -- the only piece that needs to change is
   whatever downstream filter currently drops diagnostics whose file path
   doesn't start with the project root.
2. **No new tsconfig-parsing logic is needed** -- `.storybook/tsconfig.json`
   for a centralized host is the exact same shape (`extends` the project's
   own `tsconfig.json`, plain `include`/`exclude` globs) as for the
   single-project case in `NX-SCAFFOLD.md`. The only difference is the glob
   *content*, which is workspace-specific and manually authored -- nothing
   `angular-typechecker` needs to special-case or validate beyond "trust
   whatever `include` resolves to."
3. **A centralized host's solution `tsconfig.json` can have `.storybook/tsconfig.json`
   as its ONLY reference** (confirmed in radix) -- don't assume every
   project walked by the executor has an app/lib leaf; a pure-shell
   Storybook host is a legitimate, real-world project shape.
4. **Consider whether "which project owns this diagnostic" should be
   reported per-source-file rather than per-walked-project.** Since a
   centralized host's compilation unit spans many other projects' files,
   surfacing a diagnostic as belonging to `storybook-host` when the actual
   broken file lives in `packages/primitives/tabs/...` would be confusing
   in CI output; consider attributing diagnostics to the file's own
   position in the workspace (which Nx/TS diagnostics already carry as an
   absolute path) rather than to the walked project's name.
5. **Dependency/cache-invalidation is a known, explicitly-documented gap
   Nx itself doesn't solve automatically** (the recipe's own "Extras"
   section, corroborated by radix's manual `implicitDependencies`). If
   `angular-typechecker`'s executor is ever wired into Nx's caching
   (`inputs`/`outputs`), the same problem applies: a centralized host's
   typecheck target needs to declare the aggregated projects as inputs (or
   rely on the user's own `implicitDependencies`) or its cache will go
   stale silently when an aggregated project's story/component changes.
   Out of scope for the type-check logic itself, but worth a README note
   once this ships.
6. **Path aliases require no special handling.** They're already resolved
   through the standard `extends` chain to `tsconfig.base.json`, exactly as
   for every other leaf `angular-typechecker` already compiles.

## Generator command(s) that scaffold the pattern

There is **no single generator flag** that produces the centralized-host
layout. The full sequence is:
```bash
nx g @nx/angular:library <host-name> --unitTestRunner=none
nx g @nx/angular:storybook-configuration <host-name> --generateStories=false
# then hand-edit <host-name>/.storybook/main.ts (stories[]) and
# <host-name>/.storybook/tsconfig.json (include[]) to add the cross-project
# glob(s), and optionally <host-name>/project.json's implicitDependencies.
```
Both generator steps are identical to the single-project case in
`NX-SCAFFOLD.md`; the centralization is entirely a manual post-generation
edit, per the official recipe.

## Open questions / caveats

- Not verified against an actual Angular 22 + TypeScript 6 install (same
  caveat as `NX-SCAFFOLD.md` -- `@storybook/angular`'s peer range excludes
  that stack today). The `ngc --noEmit` cross-project verification above
  used Angular 21.2.9 / TypeScript 5.9.3. Given `ngc` is a thin CLI wrapper
  around `performCompilation` with no version-conditional logic around
  cross-project file discovery, I expect this to hold on Angular 22/TS 6,
  but it should be smoke-tested when the phase lands (same recommendation
  as `NX-SCAFFOLD.md`).
- Did not attempt to actually run `nx build-storybook`/`nx storybook` on
  either the `sblab` centralized host or radix's real one -- this research
  focused on the tsconfig/compilation-unit question, not on Storybook's own
  runtime behavior.
- radix's `@analogjs/storybook-angular` framework choice means it is not a
  pure validation of `@nx/angular:storybook-configuration`'s generator
  output -- it validates that the **tsconfig-layout pattern** the recipe
  describes holds up in a real, large, Angular-22-stack codebase, but the
  Storybook *framework/builder* wiring in that repo is a different (and
  apparently manually customized) code path than what Nx's own generator
  produces.
