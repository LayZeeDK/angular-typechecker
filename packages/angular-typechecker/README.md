# angular-typechecker

[![npm version](https://img.shields.io/npm/v/angular-typechecker.svg)](https://www.npmjs.com/package/angular-typechecker)
[![license](https://img.shields.io/npm/l/angular-typechecker.svg)](https://github.com/LayZeeDK/angular-typechecker/blob/main/LICENSE)
[![CI](https://github.com/LayZeeDK/angular-typechecker/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/LayZeeDK/angular-typechecker/actions/workflows/ci.yml?query=branch%3Amain)

An Nx plugin that runs the _complete_ Angular compiler type-check (TypeScript
checks, Angular template type-checking, and extended NG8xxx diagnostics) with no
emit, without building your app or running your tests. It covers every Angular
project type: applications, libraries (local/non-buildable, buildable, and
publishable), and unit-test (spec) tsconfigs.

## Why this exists

Brandon Roberts' "Angular Compilation, Type-Checking, and Build Bottlenecks"
(2026) shows that at scale the whole-program type-check is the dominant cost of
an Angular build, and a separable one. Fast per-file compilers (AnalogJS
`fastCompile`, the experimental Oxc compiler) and esbuild dev skip the
type-check for speed and expect you to run it elsewhere. In the editor, the
Angular Language Service covers the live loop.

angular-typechecker is that "elsewhere" for headless CI and AI-agent loops:
Nx-native, cacheable, runnable per project. Unlike a bare `ngc --noEmit`, it
gathers option, syntactic, semantic, template, and extended diagnostics in one
unconditional pass, so template and extended NG8xxx diagnostics still surface
when a co-located TypeScript error exists. It also differs from Nx's built-in
`@nx/js` `typecheck` target (plain `tsc`/`tsgo`): Angular projects can't use that
fast path, because Angular has no TypeScript project-references support, and it
would not surface Angular template or extended diagnostics anyway.

Reference: https://brandonroberts.dev/blog/posts/angular-compilation-type-checking-and-build-bottlenecks-4n2f

## Requirements

- Nx 23.x
- Angular 22.x (stable). `@angular/compiler-cli` is a peer dependency, range
  `^22.0.0`.
- TypeScript `>=6.0.0 <6.1.0`, a peer dependency.
- Node `^22.22.3 || ^24.15.0 || ^26.0.0`

`@nx/devkit` ships as a pinned dependency of this package, so you do not declare
it.

### A note on Angular pre-releases

The published peer range `@angular/compiler-cli: "^22.0.0"` excludes Angular 22
pre-releases (`-next` / `-rc`) by semver rules. To use the plugin on a 22.x
pre-release, install with `--legacy-peer-deps`. The range may widen in a future
release; widening is non-breaking under 0.x semver.

## Installation

```sh
npm install --save-dev angular-typechecker
```

Or install and seed the cacheable target defaults in one step with `nx add` (see
Usage below).

## Usage

The quickest way to wire a project is the generator. An equivalent manual recipe
follows it.

### Recommended: the `configuration` generator

Install the plugin and seed the cacheable target defaults in one step:

```sh
nx add angular-typechecker
```

`nx add` runs this plugin's `init` generator on install, which seeds the
cacheable `angular-typechecker:typecheck` entry into `nx.json` `targetDefaults`.
If you installed with `npm install --save-dev angular-typechecker` instead, run
`nx g angular-typechecker:init` once to seed the same defaults. The plugin uses
`nx add`; there is no Angular-CLI installer.

Then wire a project's `typecheck` target:

```sh
nx g angular-typechecker:configuration my-app
```

This adds a single `typecheck` target pointed at the project's solution
`tsconfig.json`. The engine walks that tsconfig's in-project referenced leaves
(the lib/app tsconfig and the `tsconfig.spec.json`) in one run, so the spec
tsconfig is type-checked automatically. You do not wire a second target.

Run it:

```sh
nx run my-app:typecheck
```

Useful flags:

- `--tsConfig <path>` overrides the tsconfig the target points at. It defaults to
  the project's solution `tsconfig.json`, falling back to the leaf
  `tsconfig.app.json` / `tsconfig.lib.json` for a flat project with no solution
  tsconfig.
- `--targetName <name>` names the target something other than `typecheck`.

Re-running the generator is idempotent: it will not clobber a target of the same
name that is not ours.

### Manual wiring (equivalent)

To edit config by hand, add the `typecheck` target to the project's
`project.json`, pointed at its solution `tsconfig.json` (so the engine walks the
lib/app and spec leaves), referencing the published executor id
`angular-typechecker:typecheck`:

```jsonc
{
  "targets": {
    "typecheck": {
      "executor": "angular-typechecker:typecheck",
      "options": {
        "tsConfig": "apps/my-app/tsconfig.json",
      },
    },
  },
}
```

Then add a cacheable `targetDefaults` entry to `nx.json`, keyed by the published
executor id. This is what the `init` generator seeds for you. It declares the
inputs that make the whole-program check correctly cacheable, including
non-buildable dependency sources via `^default` and buildable dependency outputs
via `dependentTasksOutputFiles`:

```jsonc
{
  "targetDefaults": {
    "angular-typechecker:typecheck": {
      "cache": true,
      "outputs": [],
      "inputs": [
        "default",
        "{projectRoot}/tsconfig*.json",
        "{projectRoot}/package.json",
        "{workspaceRoot}/tsconfig.base.json",
        "^default",
        {
          "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
          "transitive": true,
        },
        {
          "externalDependencies": ["typescript", "@angular/compiler-cli"],
        },
      ],
    },
  },
}
```

> The first input must be `default`, not `production`. `production` excludes
> `*.spec.ts`, so it would under-hash the spec sources the walk type-checks. A
> spec-only edit would then fail to bust the cache and could yield a stale pass.

> Use the published, unscoped executor id `angular-typechecker:typecheck`. A
> workspace-scoped key (for example `@your-scope/...:typecheck`) will not bind to
> the installed package in a consumer workspace.

### `includeDeps` and non-buildable dependencies

When the project you check imports a non-buildable (local) library in the same
workspace, that library's source files sit outside the project's own tsconfig
boundary, so their diagnostics are excluded by default. Set `includeDeps: true`
to fold those out-of-project (and `node_modules`) diagnostics back in. Otherwise
a type error introduced in a non-buildable dependency would not surface, and a
cached "pass" could hide it. Set it when your project has non-buildable workspace
dependencies you want covered.

## Options

| Option        | Type    | Default    | Description                                                                                                      |
| ------------- | ------- | ---------- | ---------------------------------------------------------------------------------------------------------------- |
| `tsConfig`    | string  | (required) | Path to the tsconfig to type-check. Resolved relative to the workspace root when not absolute.                   |
| `includeDeps` | boolean | `false`    | Include out-of-project and `node_modules` diagnostics. Default excludes them (project-in-isolation).             |
| `maxWarnings` | number  | (unset)    | Fail when the warning count exceeds this number. `0` fails on any warning. Omit to never fail on warnings alone. |
| `failFast`    | boolean | `false`    | Report only the first error (output brevity). Not a speed-up; all diagnostics are still gathered.                |

## Output

There is one output format: the Angular compiler's `formatDiagnostics`, a
superset of `tsc` that renders NG codes and template codeframes. The executor
writes it to raw stdout. A run reporting a TypeScript error and an Angular
template diagnostic (NG8xxx) looks like this:

```
libs/ui/src/lib/greeting.component.ts:8:38 - error TS2322: Type 'number' is not assignable to type 'string'.

8   protected readonly label: string = 0;
                                       ~
libs/ui/src/lib/greeting.component.html:1:6 - error NG8002: Can't bind to 'srcc' since it isn't a known property of 'img'.

1 <img [srcc]="label" />
       ~~~~~~~~~~~~~~
```

A few knobs shape that output:

- Color is auto-detected via `stdout.isTTY` and stripped off-TTY (CI, pipes,
  agents), so captured logs stay ANSI-free.
- `failFast` truncates the reported list at the first error. It is an
  output-brevity switch, not a speed-up: every diagnostic is still gathered.
- Paths are workspace-root-relative, so they work with a standard
  `file:line:col` problem matcher (see CI integration).

The exit-code contract is simple: the executor exits non-zero on any
error-category diagnostic, or when the warning count exceeds `maxWarnings`. That
makes it agent-ready and CI-ready with no extra parsing.

Machine-readable reporters (JSON/SARIF) are a known non-goal in v0.x; the single
human-readable format above is the only output.

## CI integration

Because the executor exits non-zero on any error-category diagnostic, a CI step
that runs `nx run <project>:typecheck` fails the job on a type or template error
with no extra scripting.

The workspace-relative `file:line:col` paths also let you surface each diagnostic
as an inline GitHub Actions annotation via a `tsc`-style problem matcher. Since
the output is a `tsc` superset, one matcher annotates both TypeScript (`TSxxxx`)
and Angular (`NGxxxx`) diagnostics. Add `.github/matchers/tsc.json`:

```json
{
  "problemMatcher": [
    {
      "owner": "angular-typechecker",
      "pattern": [
        {
          "regexp": "^(\\S.*?):(\\d+):(\\d+)\\s+-\\s+(error|warning)\\s+((?:TS|NG)\\d+):\\s+(.*)$",
          "file": 1,
          "line": 2,
          "column": 3,
          "severity": 4,
          "code": 5,
          "message": 6
        }
      ]
    }
  ]
}
```

Then register it immediately before running the target:

```yaml
- run: echo "::add-matcher::.github/matchers/tsc.json"
- run: npx nx run my-app:typecheck
```

## Programmatic API

The plugin's primary surface is the executor and the generators, both of which Nx
loads by path. To run the whole-program type-check from code, the package also
exports a small barrel:

```ts
import { runTypecheck, TypecheckInfrastructureError } from 'angular-typechecker';
import type { CoreOptions, CoreResult, SkippedReference } from 'angular-typechecker';

// CoreOptions.tsConfigPath must be absolute -- the core never touches
// process.cwd() (unlike the executor's workspace-relative `tsConfig`).
const options: CoreOptions = {
  tsConfigPath: '/abs/path/to/apps/my-app/tsconfig.json',
  includeDeps: false, // fold out-of-project + node_modules diagnostics back in
};

try {
  const result: CoreResult = await runTypecheck(options);
  // result: { tsConfigPath, rootNamesCount, diagnostics: readonly ts.Diagnostic[],
  //   errorCount, warningCount, suppressedCount, durationMs,
  //   templateCheckAborted?, skippedReferences?: readonly SkippedReference[] }
  process.exitCode = result.errorCount > 0 ? 1 : 0;
} catch (error) {
  if (error instanceof TypecheckInfrastructureError) {
    // a compiler/infrastructure crash (code 500), not a type error
  }

  throw error;
}
```

`maxWarnings`, `failFast`, and the formatter/color options are executor concerns,
not part of the barrel API. `runTypecheck` returns the raw counts and
diagnostics and leaves the verdict and rendering to the caller. The engine
internals (compiler loader, gatherer, boundary filter, formatter) are
intentionally not exported.

## License

MIT (c) 2026 Lars Gyrup Brink Nielsen
