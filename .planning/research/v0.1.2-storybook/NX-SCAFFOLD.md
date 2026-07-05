# Nx 23 Storybook tsconfig scaffolding for Angular projects (empirical)

Researched 2026-07-05 in a throwaway workspace at
`<scratchpad>/sblab` (never committed, not part of this repo).

## Headline answer

**Yes.** When Nx scaffolds Storybook for an Angular project (library or
application), the project's solution `tsconfig.json` gets a new
`references[]` entry pointing at `./.storybook/tsconfig.json`, alongside the
existing `tsconfig.app.json`/`tsconfig.lib.json` and `tsconfig.spec.json`
entries. This is not an accident of my scaffold order -- it is unconditional,
version-independent generator behavior (confirmed by reading
`@nx/storybook`'s source, see "Confirmed via generator source" below), so an
`angular-typechecker` walker that generically iterates every leaf in
`references[]` (rather than hard-coding an app/lib/spec allowlist) picks up
the Storybook leaf for free, for both libraries and applications.

## Critical caveat found along the way: `@storybook/angular` does not support Angular 22 or TypeScript 6 today

Verified against the npm registry (`registry.npmjs.org/@storybook/angular/latest`,
fetched 2026-07-05): the latest `@storybook/angular` is `10.4.6`, and its
`peerDependencies` are:

```json
"@angular/core": ">=18.0.0 < 22.0.0",
"@angular/common": ">=18.0.0 < 22.0.0",
"@angular/compiler": ">=18.0.0 < 22.0.0",
"@angular/compiler-cli": ">=18.0.0 < 22.0.0",
"@angular/platform-browser": ">=18.0.0 < 22.0.0",
"@angular/platform-browser-dynamic": ">=18.0.0 < 22.0.0",
"typescript": "^4.9.0 || ^5.0.0"
```

Angular 22 and TypeScript 6 (this repo's target stack) are both explicitly
outside the declared range. This is not hypothetical -- I hit it live: even
on Angular 21.2.9 (one minor below the excluded ceiling), `npx nx g
@nx/angular:storybook-configuration mylib` wrote all its files successfully
but then its trailing `npm install` step failed with `ERESOLVE` (npm tried
to add `@angular/platform-browser-dynamic@20.0.7` to satisfy the
`@storybook/angular` peer range, which itself demands `@angular/common@20.0.7`,
conflicting with the workspace's `@angular/common@21.2.9`). I unblocked it
with `npm install --legacy-peer-deps`.

**Consequence for the milestone:** anyone consuming `angular-typechecker`
on Angular 22 who adds Storybook today will need `--legacy-peer-deps` or
`--force` to install it at all, until `@storybook/angular` ships an Angular
22 + TypeScript 6 compatible release. This doesn't block the tsconfig-walk
design (the reference-injection is pure Nx-generator JSON-writing, unrelated
to which Angular/TS version is actually installed -- see next section) but
it is a real adoption friction point worth flagging in the phase's
docs/README once v0.1.2 ships.

## Scaffolded versions

Because `@storybook/angular` excludes Angular 22, and `create-nx-workspace`'s
native `angular-monorepo` preset pins its own Angular version (not
configurable via CLI flag), I scaffolded on the closest working native Nx 23
Angular stack rather than fight the exclusion:

| Package | Version used in scaffold | Target repo's actual stack |
|---|---|---|
| `nx` | 23.0.1 | 23.0.1 (match) |
| `@nx/angular`, `@nx/storybook` | 23.0.1 | 23.0.1 (match) |
| `@angular/core` (+ family) | 21.2.9 | 22.0.4 |
| `typescript` | 5.9.3 | 6.0.3 |
| `storybook` | 10.4.6 (exact; declared `^10.1.0`) | n/a (not yet installed) |
| `@storybook/angular` | 10.4.6 | n/a |

**Why the Angular/TS version delta is safe to generalize past:** the
reference-injection behavior lives entirely in `@nx/storybook`'s Nx
*generator* code (see next section) -- plain JSON-tree writes executed by
Node/TypeScript at `nx generate` time. It has zero runtime dependency on
which `@angular/core`/`typescript` version is actually installed. I also
confirmed the file-tree changes (including the `references[]` push) are
written to disk *before* the generator's trailing `npm install` task runs --
so the tsconfig scaffolding happened successfully even in the run where
`npm install` itself failed on the peer conflict. What I did **not**
verify: whether `@angular/compiler-cli@22.x`'s `performCompilation` actually
type-checks a `.storybook/tsconfig.json` leaf + real `*.stories.ts` files
cleanly against a force-installed `@storybook/angular@10.4.6` on Angular 22.
That should be checked with a real (or `--legacy-peer-deps`-installed)
Angular 22 workspace when the phase is implemented.

## How I got there (commands, in order)

```bash
# 1. First attempt: legacy "ts" preset -- FAILED, unrelated to Storybook.
npx --yes create-nx-workspace@23.0.1 sblab --preset=ts --nxCloud=skip --no-interactive --pm=npm
cd sblab && npx nx add @nx/angular@23.0.1
# -> "The '@nx/angular' plugin doesn't support the existing TypeScript setup.
#     The Angular framework doesn't support a TypeScript setup with project
#     references." (tsconfig.base.json had "composite": true -- a WORKSPACE-WIDE
#     TS project-references mode, distinct from the per-project solution-style
#     references this repo's typecheck executor walks. Confirms this repo's
#     own constraint note: Angular has no TS project-references support.)

# 2. Second attempt: legacy "apps" preset -- SAME failure (also composite:true
#    at the workspace root; "ts" and "apps" both map to the same
#    nrwl/empty-template).

# 3. Working approach: the native "angular-monorepo" preset, which ships its
#    own Angular-compatible tsconfig.base.json (no root "composite":true).
npx --yes create-nx-workspace@23.0.1 sblab --preset=angular-monorepo \
  --appName=myapp --style=css --e2eTestRunner=none --unitTestRunner=vitest \
  --bundler=esbuild --nxCloud=skip --no-interactive --pm=npm
cd sblab

# 4. Generate a buildable Angular library.
npx nx g @nx/angular:library mylib --buildable --unitTestRunner=vitest-angular --no-interactive

# 5. Add Storybook configuration to the library (files written OK; npm
#    install then failed on the Angular-22-exclusion peer conflict noted
#    above -- unblocked with --legacy-peer-deps).
npx nx g @nx/angular:storybook-configuration mylib --no-interactive
npm install --legacy-peer-deps

# 6. For comparison: generate a plain Angular application and repeat.
npx nx g @nx/angular:application myapp2 --unitTestRunner=vitest-angular --e2eTestRunner=none --no-interactive
npx nx g @nx/angular:storybook-configuration myapp2 --no-interactive
```

Notes on the prompt-heavy generators: `@nx/angular:library` rejected
`--unitTestRunner=vitest` with "should be one of vitest-angular,
vitest-analog,jest,none" -- `vitest-angular` is the correct value on Nx 23 /
Angular 21+. Both generators otherwise ran clean on the first try with
`--no-interactive` plus the flags shown.

## Files created

For `mylib` (buildable library), the storybook-configuration generator
created/updated:

```
CREATE mylib/.storybook/main.ts
CREATE mylib/.storybook/preview.ts     (0 bytes -- empty file)
CREATE mylib/.storybook/tsconfig.json
UPDATE mylib/tsconfig.lib.json         (added **/*.stories.ts|.js to exclude)
UPDATE mylib/tsconfig.json             (added .storybook/tsconfig.json to references[])
UPDATE mylib/project.json              (storybook/build-storybook/test-storybook/static-storybook targets)
CREATE mylib/src/lib/mylib/mylib.stories.ts
```

For `myapp2` (plain application), identical shape:

```
CREATE myapp2/.storybook/main.ts
CREATE myapp2/.storybook/preview.ts    (0 bytes)
CREATE myapp2/.storybook/tsconfig.json
UPDATE myapp2/tsconfig.app.json        (added **/*.stories.ts|.js to exclude)
UPDATE myapp2/tsconfig.json            (added .storybook/tsconfig.json to references[])
UPDATE myapp2/project.json
CREATE myapp2/src/app/app.stories.ts
CREATE myapp2/src/app/nx-welcome.stories.ts   (one story per existing component)
```

**App vs library: no structural difference.** Same reference gets added to
the same place (project's own `tsconfig.json`), same exclude pattern lands
on whichever leaf owns `src/**/*.ts` (`tsconfig.app.json` vs
`tsconfig.lib.json`), same `.storybook/tsconfig.json` shape. The only
cosmetic difference is the `main.ts` `stories` glob, which is relative to
each project's actual source layout (`../**/*.@(mdx|stories...)` for the
flat library, `../src/app/**/*.@(mdx|stories...)` for the app with its
nested `src/app`).

## Verbatim tsconfig contents

### `mylib/tsconfig.json` (solution tsconfig -- the one this repo's executor walks)

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "isolatedModules": true,
    "target": "es2022",
    "moduleResolution": "bundler",
    "strict": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "emitDecoratorMetadata": false,
    "module": "preserve"
  },
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "strictTemplates": true
  },
  "files": [],
  "include": [],
  "references": [
    { "path": "./tsconfig.lib.json" },
    { "path": "./tsconfig.spec.json" },
    { "path": "./.storybook/tsconfig.json" }
  ]
}
```

### `mylib/tsconfig.lib.json` (leaf -- now excludes stories)

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../dist/out-tsc",
    "declaration": true,
    "declarationMap": true,
    "inlineSources": true,
    "types": []
  },
  "include": ["src/**/*.ts"],
  "exclude": [
    "src/**/*.spec.ts",
    "src/**/*.test.ts",
    "**/*.stories.ts",
    "**/*.stories.js"
  ]
}
```

### `mylib/tsconfig.spec.json` (leaf -- unchanged by Storybook)

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../dist/out-tsc",
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts"]
}
```

### `mylib/.storybook/tsconfig.json` (the new leaf)

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "emitDecoratorMetadata": true
  },
  "exclude": ["../**/*.spec.ts"],
  "include": [
    "../src/**/*.stories.ts",
    "../src/**/*.stories.js",
    "../src/**/*.stories.jsx",
    "../src/**/*.stories.tsx",
    "../src/**/*.stories.mdx",
    "*.js",
    "*.ts"
  ]
}
```

Notes on this leaf:
- It `extends` the **project's own `tsconfig.json`** (same pattern as
  `tsconfig.lib.json`/`tsconfig.app.json`/`tsconfig.spec.json`), so it
  inherits `angularCompilerOptions` (including `strictTemplates`) without
  redeclaring them. No special-cased Angular-compiler-options merging is
  needed for a references-walker to handle this leaf -- it is shaped exactly
  like the other leaves.
- Its own `include` covers `../src/**/*.stories.*` **and** bare `*.js`/`*.ts`
  inside `.storybook/` itself -- meaning this leaf, once picked up by a
  references-walk, also type-checks `.storybook/main.ts` and
  `.storybook/preview.ts` themselves, not only `*.stories.ts` files. Worth
  noting since the milestone is framed as "stories.ts type-checking" but the
  natural unit of work (the leaf Nx already creates) is "the whole
  `.storybook/` config surface."
- `exclude: ["../**/*.spec.ts"]` only excludes spec files; it does not
  exclude non-story `.ts` files under `src/`, but since `include` is an
  explicit allowlist of `.stories.*` + `.storybook/*.{js,ts}` patterns
  (not a `src/**/*.ts` blanket), the exclude is effectively belt-and-braces.

### `myapp2/tsconfig.json` / `tsconfig.app.json` / `.storybook/tsconfig.json`

Structurally identical to the library case above (same `references[]` push,
same exclude addition, same `.storybook/tsconfig.json` shape) -- see the
"App vs library" note above. Full content omitted here since it duplicates
the library case field-for-field.

### `.storybook/main.ts` (library)

```typescript
import type { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
  stories: ['../**/*.@(mdx|stories.@(js|jsx|ts|tsx))'],
  addons: [],
  framework: {
    name: '@storybook/angular',
    options: {},
  },
};

export default config;
```

`.storybook/preview.ts` was generated **empty** (0 bytes) in both cases.

### Sample generated story (`mylib/src/lib/mylib/mylib.stories.ts`)

```typescript
import type { Meta, StoryObj } from '@storybook/angular';
import { Mylib } from './mylib';
import { expect } from 'storybook/test';

const meta: Meta<Mylib> = {
  component: Mylib,
  title: 'Mylib',
};
export default meta;

type Story = StoryObj<Mylib>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/mylib/gi)).toBeTruthy();
  },
};
```

Note the `import { expect } from 'storybook/test'` -- Storybook 10's
interaction-test API ships its own `storybook/test` subpath export; a
type-check of this file requires `storybook` (not just `@storybook/angular`)
to be resolvable in `node_modules`, same as any other third-party import --
no special handling needed by `angular-typechecker` beyond normal
`node_modules` resolution (which it already does for `@angular/*`).

## Confirmed via generator source (not just empirical result)

I traced the exact code path in the installed `@nx/angular@23.0.1` and
`@nx/storybook@23.0.1` packages (read from
`node_modules/@nx/angular/dist/src/generators/storybook-configuration/lib/generate-storybook-configuration.js`
and `node_modules/@nx/storybook/dist/src/generators/configuration/`):

1. `@nx/angular:storybook-configuration` (`generate-storybook-configuration.js`)
   just calls `@nx/storybook`'s `configurationGenerator` with
   `uiFramework: '@storybook/angular'` -- there is no Angular-specific
   tsconfig logic living in `@nx/angular` itself; it all lives in
   `@nx/storybook`.
2. `@nx/storybook`'s `configuration.js` (`configurationGeneratorInternal`)
   runs, in order (relevant excerpt):
   ```js
   createProjectStorybookDir(tree, schema.project, schema.uiFramework, ...);   // writes .storybook/main.ts, preview.ts, tsconfig.json for Angular
   if (schema.uiFramework !== '@storybook/angular') {
     createStorybookTsconfigFile(tree, root, schema.uiFramework, ...);        // writes project-root tsconfig.storybook.json for NON-Angular frameworks
   }
   configureTsProjectConfig(tree, schema);      // adds **/*.stories.ts|.js to the app/lib leaf's exclude[]
   editTsconfigBaseJson(tree);                  // sets skipLibCheck on tsconfig.base.json
   configureTsSolutionConfig(tree, schema);     // <-- pushes the references[] entry (see below)
   ```
3. `configureTsSolutionConfig` (in `lib/util-functions.js`), despite its
   name, runs **unconditionally** for every project (it is not gated by
   whether the workspace uses Nx's newer "TS solution setup" / package-based
   style -- my scaffold uses the classic "integrated" style and still got
   the reference). Its body:
   ```js
   function configureTsSolutionConfig(tree, schema) {
     const { root } = readProjectConfiguration(tree, schema.project);
     const tsConfigPath = join(root, 'tsconfig.json');
     const tsConfigContent = readJson(tree, tsConfigPath);
     if (schema.uiFramework === '@storybook/angular') {
       if (!tsConfigContent.references?.map(r => r.path)?.includes('./.storybook/tsconfig.json')) {
         tsConfigContent.references = [...(tsConfigContent.references || []), { path: './.storybook/tsconfig.json' }];
       }
     } else {
       // non-Angular frameworks get './tsconfig.storybook.json' pushed instead
       ...
     }
     writeJson(tree, tsConfigPath, tsConfigContent);
   }
   ```
   This is an explicit `if (schema.uiFramework === '@storybook/angular')`
   branch -- Angular is handled distinctly from every other Storybook
   framework (React/Vue/etc. get a *different* filename,
   `tsconfig.storybook.json`, at the project root rather than inside
   `.storybook/`). This is why the team lead's question needs an
   Angular-specific answer rather than a generic "how does Nx do Storybook"
   answer: **the reference filename and its unconditional injection into
   the project's own solution tsconfig is an Angular-only code path.**

This confirms the empirical result is not an artifact of my particular
workspace/preset choice -- it is deliberate, version-independent Nx
generator behavior specific to `@storybook/angular`.

## Where `*.stories.ts` is type-checked today

**Nowhere, via any standalone/decoupled mechanism.** Concretely:

- Neither `mylib` (ng-packagr-built library) nor `myapp2` (esbuild-built
  Angular application) got an inferred Nx `typecheck` target after adding
  Storybook. I confirmed via `nx show project <name> --json`: the target
  list for both was `lint, build, test, build-storybook, storybook,
  test-storybook, static-storybook` (+ `serve`/`serve-static` for the app) --
  no `typecheck` target at all, for either project, before or after adding
  Storybook. (This workspace's `nx.json` does register a `@nx/vite/plugin`
  with `typecheckTargetName: "typecheck"`, but that inferred target only
  materializes for projects that have their own `vite.config.*` -- e.g. the
  template's pre-existing `shop`/`api` apps -- not for the ng-packagr
  library or esbuild application I generated.)
- `build-storybook` (executor `@storybook/angular:build-storybook`) declares
  `@angular-devkit/build-angular` as a peer dependency, meaning it delegates
  the actual Angular compilation to the official Angular CLI/webpack
  toolchain (which historically performs full AOT compilation, including
  type-checking, as part of producing the browser bundle). I did **not**
  actually run `nx build-storybook` (a full webpack build, high time cost
  and, given the Angular-22-exclusion peer situation, non-trivial risk of
  unrelated breakage on this scratch stack) -- this point is inferred from
  the declared peer dependency, not directly observed. If true, it means
  today the only place `*.stories.ts` gets any type-checking at all is as an
  incidental side effect of a full, coupled `build-storybook`/`storybook`
  (dev-server) run -- exactly the "coupled to build" problem
  `angular-typechecker` exists to solve for `.ts`/`.html` files, just not
  yet extended to `.storybook/`.
- Plain `tsc --noEmit -p mylib/.storybook/tsconfig.json` (no Angular
  compiler, just structural TS) passed cleanly on both the library's and
  the application's storybook tsconfig -- confirming the files are at least
  syntactically well-typed TypeScript, but this does **not** exercise
  Angular template type-checking (`strictTemplates`) the way
  `performCompilation` would.

## Implications for angular-typechecker's `references[]`-walking design

1. **No new leaf-discovery code needed if the walker is already generic.**
   Since `.storybook/tsconfig.json` is a normal entry in the project's
   `references[]` array -- same array, same shape as `tsconfig.app.json` /
   `tsconfig.lib.json` / `tsconfig.spec.json` -- a walker that iterates
   *every* reference and runs `performCompilation` per leaf will pick it up
   automatically, with zero Storybook-specific code. If the current
   implementation instead special-cases or allowlists expected leaf names
   (e.g. only looks for `tsconfig.{app,lib,spec}.json`), that assumption
   needs to be relaxed to "walk whatever `references[]` actually contains."
2. **No extra `angularCompilerOptions` handling required.** The Storybook
   leaf extends the project's own `tsconfig.json` and inherits
   `angularCompilerOptions` (`strictTemplates`, etc.) exactly like every
   other leaf -- `performCompilation` should invoke identically.
3. **Scope creep to consider:** because the leaf's `include` also matches
   bare `.storybook/*.js`/`*.ts` (i.e. `main.ts`/`preview.ts`), a generic
   walker will type-check the Storybook *configuration* files too, not only
   `*.stories.ts` component stories. This is probably desirable (more
   complete coverage) but should be an explicit, stated scope decision for
   the phase rather than a surprise.
4. **No disjointness problem.** `tsconfig.lib.json`/`tsconfig.app.json`
   explicitly `exclude` `**/*.stories.ts`/`.js`, so stories are compiled by
   exactly one leaf (the Storybook one), matching the existing
   app/lib-vs-spec partitioning pattern this repo's executor already
   depends on.
5. **Peer/version friction is a real, separate risk to flag in the phase,**
   not a tsconfig-walking problem: `@storybook/angular@10.4.6`'s peer range
   excludes Angular 22 and TypeScript 6 outright. `angular-typechecker`
   itself has no dependency on `@storybook/*` (stories just need to resolve
   `@storybook/angular`/`storybook` from the consumer's own `node_modules`,
   same as any other third-party import), so this doesn't block the
   plugin's implementation -- but expect early adopters on Angular 22 to hit
   the `--legacy-peer-deps` wall before they ever reach
   `angular-typechecker`'s new stories support. Worth a README callout once
   shipped.
6. **App vs library: treat identically.** No branch needed in the walker
   based on project type -- the reference-injection and leaf shape are the
   same for both.

## Open questions / caveats

- Not verified: whether `@angular/compiler-cli@22.x` (`performCompilation`)
  cleanly compiles a real `.storybook/tsconfig.json` leaf + `*.stories.ts`
  files with actual Angular 22 + TypeScript 6 installed (this research used
  Angular 21.2.9 / TypeScript 5.9.3 due to the peer-range exclusion above).
  Recommend a smoke test with a `--legacy-peer-deps`-forced Angular 22
  install when the phase is implemented.
- Not verified: whether `nx build-storybook` actually performs Angular
  template type-checking today (inferred from `@angular-devkit/build-angular`
  peer dependency, not directly run).
- Not checked: publishable Angular libraries (only buildable was tested) --
  expect identical behavior since the Storybook generator operates on the
  project's own `tsconfig.json` regardless of the library's
  buildable/publishable/non-buildable distinction, but this wasn't
  empirically confirmed.
- Not checked: Nx's newer "TS solution setup" (package-based monorepo style,
  where `isUsingTsSolutionSetup(tree)` would return `true`). Source reading
  shows `configureTsSolutionConfig`'s Angular branch is unconditional either
  way, but `createProjectStorybookDir`'s exact template output was only
  observed under the classic "integrated" style.
