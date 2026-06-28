# angular-typechecker

An Nx plugin that runs the *complete* Angular compiler type-check -- TypeScript
checks plus Angular template type-checking and extended (NG8xxx) diagnostics --
with **no emit**, decoupled from building the application or running the tests.
It works for every Angular project type: applications, libraries (local /
non-buildable, buildable, and publishable), and unit-test (spec) tsconfigs.

## Why this exists

As Brandon Roberts documents in "Angular Compilation, Type-Checking, and Build
Bottlenecks" (2026), at scale the whole-program type-check is the *dominant,
separable* cost of an Angular build (a standalone `ngc --noEmit` is a large
fraction of a full esbuild build). Fast per-file compilers (AnalogJS
`fastCompile`, the experimental Oxc compiler) and esbuild dev deliberately *skip*
the type-check for speed and expect you to "run the type-check elsewhere"; the
editor's Angular Language Service covers the live loop.

angular-typechecker is that "elsewhere" for headless CI and AI-agent loops --
Nx-native, cacheable, and runnable per project. Unlike a bare `ngc --noEmit` (the
step AnalogJS and that article recommend), it models the modern
`@angular/build:application` builder: it gathers option / syntactic / semantic /
template / extended diagnostics **unconditionally** in one pass, rather than
short-circuiting by phase the way `ngc` does -- so it surfaces template and
extended NG8xxx diagnostics even when a co-located TypeScript error exists.

It is distinct from Nx's built-in `@nx/js` `typecheck` target (plain
`tsc`/`tsgo`): Angular projects cannot use that fast path (Angular lacks
TypeScript project-references support), and it would not surface Angular template
or extended diagnostics anyway.

Reference: https://brandonroberts.dev/blog/posts/angular-compilation-type-checking-and-build-bottlenecks-4n2f

## Requirements

- Nx 23.x
- Angular 22.x (stable) -- `@angular/compiler-cli` is a peer dependency, range
  `^22.0.0`
- TypeScript `>=6.0.0 <6.1.0` -- a peer dependency
- Node `^22.22.3 || ^24.15.0 || ^26.0.0`

`@nx/devkit` ships as a pinned dependency of this package; you do not declare it.

### A note on Angular pre-releases

The published peer range is `@angular/compiler-cli: "^22.0.0"`, which by semver
rules excludes Angular 22 PRE-releases (`-next` / `-rc`). If you consume this
plugin on a 22.x pre-release, install with `--legacy-peer-deps`. The range may be
widened in a future release; widening is non-breaking under 0.x semver.

## Installation

```sh
npm install --save-dev angular-typechecker
```

## Usage

There is no `nx add` / generator in this version (deferred), so target wiring is
manual. There are two equivalent ways to wire it.

### Option A: a per-project target in `project.json`

Add an `angular-typecheck` target to the project you want to check, referencing
the **published** executor id `angular-typechecker:angular-typecheck`:

```jsonc
{
  "targets": {
    "angular-typecheck": {
      "executor": "angular-typechecker:angular-typecheck",
      "options": {
        "tsConfig": "apps/my-app/tsconfig.app.json",
        "includeDeps": true
      }
    }
  }
}
```

Run it:

```sh
nx run my-app:angular-typecheck
```

To type-check the unit-test (spec) tsconfig of a project, point a second target
at its `tsconfig.spec.json`.

### Option B: a cacheable `targetDefaults` entry in `nx.json`

For an Nx-cacheable target shared across projects, add a `targetDefaults` entry
keyed by the **published** executor id. This is the recommended recipe -- it
declares the inputs that make the whole-program check correctly cacheable
(including non-buildable dependency sources via `^default` and buildable
dependency outputs via `dependentTasksOutputFiles`):

```jsonc
{
  "targetDefaults": {
    "angular-typechecker:angular-typecheck": {
      "cache": true,
      "outputs": [],
      "inputs": [
        "production",
        "{projectRoot}/tsconfig*.json",
        "{projectRoot}/package.json",
        "{workspaceRoot}/tsconfig.base.json",
        "^default",
        {
          "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
          "transitive": true
        },
        {
          "externalDependencies": ["typescript", "@angular/compiler-cli"]
        }
      ]
    }
  }
}
```

Each project then declares only its own `angular-typecheck` target with its
`tsConfig` (and `includeDeps`) options, as in Option A.

> Use the **published unscoped** executor id `angular-typechecker:angular-typecheck`.
> A workspace-scoped key (for example `@your-scope/...:angular-typecheck`) will
> not bind to the installed package in a consumer workspace.

### `includeDeps` and non-buildable dependencies

When the project you check imports a **non-buildable (local) library** in the
same workspace, that library's source files are outside the project's own tsconfig
boundary, so their diagnostics are excluded by default. Set `includeDeps: true`
to fold those out-of-project (and `node_modules`) diagnostics back in -- otherwise
a type error introduced in a non-buildable dependency would not surface (and a
cached "pass" could hide it). Set it when your project has non-buildable workspace
dependencies you want covered.

## Options

| Option        | Type    | Default | Description                                                                                              |
| ------------- | ------- | ------- | -------------------------------------------------------------------------------------------------------- |
| `tsConfig`    | string  | (required) | Path to the tsconfig to type-check. Resolved relative to the workspace root when not absolute.        |
| `includeDeps` | boolean | `false` | Include out-of-project and `node_modules` diagnostics. Default excludes them (project-in-isolation).     |
| `maxWarnings` | number  | (unset) | Fail when the warning count exceeds this number. `0` fails on any warning. Omit to never fail on warnings alone. |
| `failFast`    | boolean | `false` | Report only the first error (output brevity). NOT a speed-up -- all diagnostics are still gathered.      |

The default human-readable output uses the Angular compiler's `formatDiagnostics`
(a superset of `tsc`; it renders NG codes and template codeframes). The executor
exits non-zero when any error-category diagnostic is reported, making it
agent-ready and CI-ready.

## License

MIT (c) 2026 Lars Gyrup Brink Nielsen
