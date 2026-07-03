# angular-typechecker

[![npm version](https://img.shields.io/npm/v/angular-typechecker.svg)](https://www.npmjs.com/package/angular-typechecker)
[![npm downloads](https://img.shields.io/npm/dm/angular-typechecker.svg)](https://www.npmjs.com/package/angular-typechecker)
[![license](https://img.shields.io/npm/l/angular-typechecker.svg)](https://github.com/LayZeeDK/angular-typechecker/blob/main/LICENSE)
[![CI](https://github.com/LayZeeDK/angular-typechecker/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/LayZeeDK/angular-typechecker/actions/workflows/ci.yml?query=branch%3Amain)

The complete Angular compiler type-check as a cacheable Nx target that does not
build or emit.

angular-typechecker runs the full Angular compiler diagnostic set over a project
and reports what it finds. It is built for the loops the editor does not cover:
CI, pre-commit, and AI coding agents that need a static check on demand.

- Runs Angular's full diagnostic set (TypeScript, template type-checking, and
  extended NG8xxx) in one pass, not just `tsc`.
- Emits nothing and builds nothing: no bundler, no test runner, no output files.
- Covers applications and every library kind (local/non-buildable, buildable,
  publishable), and checks the spec tsconfig in the same run.
- Runs as a cacheable Nx target, so unchanged projects are skipped on re-runs.
- Prints deterministic, ANSI-free output and exits non-zero on any error, so CI
  jobs and agents can gate on pass/fail directly.

It is a type-checker, not a build, a linter, or a test runner, and it does not
replace your editor's Angular Language Service. It is the headless check you
run everywhere the editor is not.

## Contents

- [What it does](#what-it-does)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Executor options](#executor-options)
- [Output](#output)
- [Exit codes](#exit-codes)
- [Continuous integration](#continuous-integration)
- [Programmatic API](#programmatic-api)
- [How it compares](#how-it-compares)
- [Limitations](#limitations)
- [Contributing](#contributing)
- [License](#license)

## What it does

For each project, angular-typechecker walks the solution `tsconfig.json` down to
its in-project leaves (the app or lib tsconfig and `tsconfig.spec.json`) and
runs the Angular compiler with no emit. It gathers diagnostics from every phase
(option, syntactic, semantic, template, and extended NG8xxx) in one unconditional
pass, so a template or NG8xxx problem still surfaces even when a TypeScript error
sits in the same file. A bare `ngc --noEmit` stops at the first failing phase and
can bury the rest.

## Requirements

| Tool                                    | Supported version                     |
| --------------------------------------- | ------------------------------------- |
| Nx                                      | 23.x                                  |
| Angular (`@angular/compiler-cli`, peer) | 22.x stable (`^22.0.0`)               |
| TypeScript (peer)                       | `>=6.0.0 <6.1.0`                      |
| Node                                    | `^22.22.3 \|\| ^24.15.0 \|\| ^26.0.0` |

`@nx/devkit` ships as a pinned dependency, so you never declare it yourself. You
provide `@angular/compiler-cli` and `typescript`, the versions your workspace
already uses.

Note: the `^22.0.0` peer range excludes Angular 22 pre-releases (`-next` /
`-rc`) by semver rules. To run the plugin on a 22.x pre-release, install with
`--legacy-peer-deps`, which relaxes peer resolution for the whole install, so
use it sparingly. The TypeScript window is narrow on purpose: Angular 22 supports
only TypeScript 6.0.x. The range may widen later; widening is non-breaking under
0.x semver.

## Installation

```sh
nx add angular-typechecker
```

`nx add` installs the package and runs its `init` generator, which seeds a
cacheable `angular-typechecker:typecheck` entry into `nx.json` `targetDefaults`.

Prefer plain npm? Install the package and run `init` yourself:

```sh
npm install --save-dev angular-typechecker
nx g angular-typechecker:init
```

This is `nx add`, not the Angular CLI's `ng add`, and there is no Angular-CLI
installer.

## Quick start

Wire a project with the `configuration` generator, then run the target:

```sh
nx g angular-typechecker:configuration my-app
nx typecheck my-app
```

The generator adds a single `typecheck` target pointed at the project's solution
`tsconfig.json`. Because the engine walks that tsconfig's leaves, the spec
tsconfig is checked in the same run, so you never add a second target. Two flags
matter:

- `--tsConfig <path>` points the target at a different tsconfig. It defaults to
  the solution `tsconfig.json` and falls back to `tsconfig.app.json` /
  `tsconfig.lib.json` when the project has no solution tsconfig with project
  references.
- `--targetName <name>` names the target something other than `typecheck`.

Re-running the generator is safe: it will not overwrite a target of the same name
that is not ours.

### Wiring a project by hand

To skip the generator, add the target yourself. Point it at the solution
`tsconfig.json` and reference the published executor id
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

Then add the cacheable `targetDefaults` entry to `nx.json` (this is what `init`
seeds). Its inputs are what make the whole-program check cache correctly: they
cover non-buildable dependency sources via `^default` and buildable dependency
outputs via `dependentTasksOutputFiles`:

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

One thing to get right: the first input must be `default`, not `production`.
`production` drops `*.spec.ts`, which would under-hash the spec sources the walk
checks, so a spec-only edit could then reuse a stale cache and pass when it
should fail.

## Executor options

| Option        | Type    | Default    | Description                                                                                                      |
| ------------- | ------- | ---------- | ---------------------------------------------------------------------------------------------------------------- |
| `tsConfig`    | string  | (required) | Path to the tsconfig to type-check. Resolved relative to the workspace root when not absolute.                   |
| `includeDeps` | boolean | `false`    | Include out-of-project and `node_modules` diagnostics. The default excludes them (project-in-isolation).         |
| `maxWarnings` | number  | (unset)    | Fail when the warning count exceeds this number. `0` fails on any warning. Omit to never fail on warnings alone. |
| `failFast`    | boolean | `false`    | Report only the first error (output brevity). Not a speed-up; all diagnostics are still gathered.                |

By default the check is scoped to the project in isolation. When it imports a
non-buildable (local) library, that library's sources sit outside the project's
tsconfig boundary and their diagnostics are skipped, so a type error you
introduce in a local dependency would not show up, and a cached pass could hide
it. Set `includeDeps: true` to fold those out-of-project (and `node_modules`)
diagnostics back in.

## Output

angular-typechecker prints one format: the Angular compiler's `formatDiagnostics`,
a superset of `tsc` that renders NG codes and template code frames, written
straight to stdout. A run with a TypeScript error and an Angular template
diagnostic looks like this:

```
libs/ui/src/lib/greeting.component.ts:8:38 - error TS2322: Type 'number' is not assignable to type 'string'.

8   protected readonly label: string = 0;
                                       ~
libs/ui/src/lib/greeting.component.html:1:6 - error NG8002: Can't bind to 'srcc' since it isn't a known property of 'img'.

1 <img [srcc]="label" />
       ~~~~~~~~~~~~~~
```

Each diagnostic is `path:line:column - severity CODE: message`, followed by a code
frame. The report can carry three kinds of finding, all in the same run:

- Plain TypeScript diagnostics (`TS2322` and the rest of the `TSxxxx` set).
- Angular template type-check diagnostics, from checking template expressions and
  bindings against component types, such as `NG8002` above.
- Angular extended diagnostics: the stricter, opt-in template checks, such as
  `NG8101` (an invalid banana-in-a-box binding) or `NG8109` (a signal not invoked
  in a template).

Three things shape the output:

- Color is auto-detected from `stdout.isTTY` and stripped off-TTY (CI, pipes,
  agents), so captured logs stay ANSI-free.
- `failFast` cuts the reported list off at the first error. It shortens output
  only; every diagnostic is still gathered.
- Paths are workspace-root-relative, so they line up with a standard
  `file:line:col` problem matcher (see [Continuous integration](#continuous-integration)).

Machine-readable reporters (JSON, SARIF) are a deliberate non-goal in v0.x; the
human-readable format above is the only output.

## Exit codes

The executor reports a pass/fail result that Nx maps to the process exit code, so
a CI step or an agent can gate on pass/fail directly:

- Exit `0`: no error-category diagnostics were reported, and the warning count
  is within `maxWarnings`.
- Non-zero: at least one error-category diagnostic was reported, or the warning
  count exceeded `maxWarnings`.
- Non-zero: the Angular compiler failed to run at all (an infrastructure error,
  such as a missing or unreadable tsconfig). This is logged distinctly from a
  type error, because a type-checker that reports success on its own crash is
  worse than none.

The exit code signals only pass or fail. To tell a type error, a
warning-threshold failure, and an infrastructure error apart, read the output.

## Continuous integration

Since the target exits non-zero on an error, a CI step that runs
`nx typecheck <project>` fails the job on any type or template error with no
extra scripting. Run it across only the projects a change touches with
`nx affected -t typecheck`.

The workspace-relative `file:line:col` paths also let GitHub Actions annotate each
diagnostic inline. Because the output is a `tsc` superset, one `tsc`-style problem
matcher catches both TypeScript (`TSxxxx`) and Angular (`NGxxxx`) codes. Drop this
in `.github/matchers/tsc.json`:

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

Register it right before the target runs:

```yaml
- run: echo "::add-matcher::.github/matchers/tsc.json"
- run: npx nx typecheck my-app
```

## Programmatic API

Nx loads the executor and the generators by path, so most consumers never import
the package directly. When you do need to run the check from code, the package
exports a small barrel:

```ts
import { runTypecheck, TypecheckInfrastructureError } from 'angular-typechecker';
import type { CoreOptions, CoreResult, SkippedReference } from 'angular-typechecker';

// CoreOptions.tsConfigPath must be absolute. The core never reads
// process.cwd() (unlike the executor's workspace-relative `tsConfig`).
const options: CoreOptions = {
  tsConfigPath: '/abs/path/to/apps/my-app/tsconfig.json',
  includeDeps: false, // set true to include out-of-project + node_modules diagnostics
};

try {
  const result: CoreResult = await runTypecheck(options);
  // result: { tsConfigPath, rootNamesCount, diagnostics: readonly ts.Diagnostic[],
  //   errorCount, warningCount, suppressedCount, durationMs,
  //   templateCheckAborted?, skippedReferences?: readonly SkippedReference[] }
  process.exitCode = result.errorCount > 0 ? 1 : 0;
} catch (error) {
  if (error instanceof TypecheckInfrastructureError) {
    // the compiler crashed (code 500): an infrastructure failure, not a type error
  }

  throw error;
}
```

`runTypecheck` hands back the raw counts and diagnostics and leaves the verdict
and rendering to you. `maxWarnings`, `failFast`, and color live in the executor,
not the barrel, and the engine internals (compiler loader, gatherer, boundary
filter, formatter) stay unexported.

## How it compares

Angular builds already type-check, but they tie that check to emit. Fast dev
pipelines skip it on purpose. Per-file compilers (AnalogJS `fastCompile`, the
experimental Oxc compiler) and esbuild dev trade the whole-program check for
speed and tell you to run it elsewhere; in the editor, the Angular Language
Service handles the live loop. This plugin is that "elsewhere" for headless CI and
agent loops.

- Compared with `ngc --noEmit`: `ngc` short-circuits by phase, so a TypeScript
  error can mask template and NG8xxx diagnostics. angular-typechecker gathers
  every phase in one pass (in the spirit of `@angular/build`), so an ordinary
  TypeScript error never masks the template and NG8xxx diagnostics.
- Compared with Nx's `@nx/js` `typecheck` target: that runs plain `tsc` / `tsgo`,
  which Angular projects cannot use (Angular has no TypeScript project-references
  support) and which never sees template or NG8xxx diagnostics anyway.

For the background on why the whole-program type-check is the dominant, separable
cost of an Angular build, see Brandon Roberts' [Angular Compilation, Type-Checking,
and Build Bottlenecks](https://brandonroberts.dev/blog/posts/angular-compilation-type-checking-and-build-bottlenecks-4n2f)
(2026).

## Limitations

- angular-typechecker is 0.x (pre-1.0). Breaking changes are allowed in minor
  releases under the project's 0.x semver policy.
- A fatal template-compilation error (Angular `NG3004`) aborts type-check-block
  generation for the whole program, which can suppress surviving files' template
  and NG8xxx diagnostics until it is fixed. The run warns loudly about the
  incompleteness and still exits non-zero, so it never passes silently.
- The reference walk is single-level. It checks the solution tsconfig's direct
  in-project leaves; references that are out-of-project, empty, or themselves
  solution tsconfigs are skipped with an advisory warning and do not change the
  verdict. Point `tsConfig` at a leaf directly for those.
- `includeDeps` defaults to `false` (project-in-isolation) for speed and boundary
  hygiene, so type errors in a non-buildable local dependency are not reported
  unless you opt in (see [Executor options](#executor-options)).
- Machine-readable reporters (JSON, SARIF) and a standalone CLI are non-goals in
  v0.x.

## Contributing

Issues and pull requests are welcome on
[GitHub](https://github.com/LayZeeDK/angular-typechecker/issues). Please open an
issue to discuss a substantial change before sending a pull request.

## License

MIT (c) 2026 Lars Gyrup Brink Nielsen
