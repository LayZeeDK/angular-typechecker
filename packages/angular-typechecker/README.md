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
- [Partial coverage](#partial-coverage)
- [Output](#output)
- [Exit codes](#exit-codes)
- [Continuous integration](#continuous-integration)
- [Programmatic API](#programmatic-api)
- [How it compares](#how-it-compares)
- [Angular CLI](#angular-cli)
- [Standalone CLI](#standalone-cli)
- [Machine-readable output](#machine-readable-output)
- [Storybook](#storybook)
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

In a pnpm workspace, add it to the workspace root and run `init` the same way:

```sh
pnpm add -Dw angular-typechecker
nx g angular-typechecker:init
```

This is `nx add`, the Nx installer. In a plain Angular CLI (`angular.json`)
workspace, use `ng add angular-typechecker` instead; see
[Angular CLI](#angular-cli).

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
`production` drops `*.spec.ts`, which would under-hash the spec sources the check
covers, so a spec-only edit could then reuse a stale cache and pass when it
should fail.

## Executor options

| Option        | Type    | Default    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------- | ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsConfig`    | string  | (required) | Path to the tsconfig to type-check. Resolved relative to the workspace root when not absolute.                                                                                                                                                                                                                                                                                                                                                        |
| `includeDeps` | boolean | `false`    | Include out-of-project and `node_modules` diagnostics. The default excludes them (project-in-isolation).                                                                                                                                                                                                                                                                                                                                              |
| `maxWarnings` | number  | (unset)    | Fail when the warning count exceeds this number. `0` fails on any warning. A dropped warning on an uncovered first-party file counts toward this total too. Omit to never fail on warnings alone.                                                                                                                                                                                                                                                     |
| `failFast`    | boolean | `false`    | Report diagnostics only up to the first error (output brevity; all diagnostics are still gathered).                                                                                                                                                                                                                                                                                                                                                   |
| `strict`      | boolean | `false`    | Controls what a first-party file the check couldn't fully cover does to the run. Default (off): a file with an error fails the run; one with only warnings just prints a notice, though a dropped warning still counts toward `maxWarnings`. On: a warning-only file fails regardless of `maxWarnings` (a file with an error still fails). It only adds a fail path; it never turns a failure into a pass. See [Partial coverage](#partial-coverage). |

## Partial coverage

The check runs a project in isolation, so a few situations leave a first-party file
not fully covered. It always tells you when that happens; whether the run fails
depends on the case, as described below.

- A first-party file imported from source that the checked `tsconfig` doesn't
  declare. When your project imports an internal workspace library from source (often
  through a TypeScript `paths` alias), the compiler pulls that file in and checks it,
  but it belongs to another project, so its diagnostics are dropped from your report
  and you see your own errors, not the library's. An error in such a file fails the
  run; a warning on it just prints a notice unless you gate warnings with
  `maxWarnings` or turn on `strict`. To see the error reported
  directly, run that library's own `typecheck` target, or set `includeDeps: true` to
  fold these diagnostics back into your report.
- A referenced config that declares no files: an empty config, or a `tsconfig` that
  only points at other projects (the check follows one level of `references`). This
  fails the run rather than passing over something it never checked. Out-of-project,
  duplicate, and self references are skipped with a warning and don't change the
  result; point `tsConfig` at that config directly if you need it checked.
- A fatal template error (`NG3004`) stops Angular's template type-checking for the
  whole program, which hides other files' template and NG8xxx diagnostics until you
  fix it. The run exits non-zero and tells you its results are incomplete.
- A declared file the check can't type-check, which is advisory and does not fail the
  run: `.mdx` is never type-checked, and a `.tsx` is checked only when your `tsconfig`
  sets `compilerOptions.jsx`. The run prints a notice naming these files and stays
  green. See `notTypeCheckedDeclaredFiles` under [Programmatic API](#programmatic-api).

The opt-in `strict` option extends the first case: it makes a warning-only uncovered
file fail the run too, so any first-party file the check couldn't fully cover fails.

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

This is the default human-readable report. For JSON and SARIF output aimed at
agents, scripts, and GitHub Code Scanning, see
[Machine-readable output](#machine-readable-output).

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

// tsConfigPath must be absolute. runTypecheck does not resolve it for you.
const options: CoreOptions = {
  tsConfigPath: '/abs/path/to/apps/my-app/tsconfig.json',
  includeDeps: false, // set true to include out-of-project + node_modules diagnostics
};

try {
  const result: CoreResult = await runTypecheck(options);
  // result: { tsConfigPath, rootNamesCount, diagnostics: readonly ts.Diagnostic[],
  //   errorCount, warningCount, suppressedThirdParty, suppressedInGraphErrorCount,
  //   suppressedInGraphWarningCount, suppressedInGraphFiles: readonly string[],
  //   durationMs, templateCheckAborted?,
  //   skippedReferences?: readonly SkippedReference[],
  //   notTypeCheckedDeclaredFiles?: readonly string[],
  //   bundlerQueryImports?: readonly string[] }
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

## Angular CLI

You can run angular-typechecker in a plain Angular CLI (`angular.json`) workspace,
with no Nx. The package ships an Angular CLI builder and the matching `ng add` and
`ng generate` schematics, so the same complete Angular type-check runs behind
`ng run <project>:typecheck`.

### Install and wire every project

```sh
ng add angular-typechecker
```

`ng add angular-typechecker` installs the package as a dev dependency and wires a
`typecheck` target into every `application` and `library` project in your
`angular.json` at once. It is idempotent: run it again and it leaves your existing
targets untouched, wiring only projects that are still missing one. On the
supported Angular 22 stack the install needs no `--legacy-peer-deps` flag. It also
prints a one-time notice that the Angular CLI path does not cache target results,
so you know each run does the full check (see
[Caching and the nx dependency](#caching-and-the-nx-dependency)).

### Wire a single project

For a project you add later, wire just that one:

```sh
ng generate angular-typechecker:configuration <project>
```

### Run the check

```sh
ng run <project>:typecheck
```

`ng run <project>:typecheck` runs the exact same complete Angular type-check as the
Nx executor, and its pass/fail exit verdict is identical: it exits zero when no
error-category diagnostic is reported and non-zero otherwise. Everything under
[Output](#output) and [Exit codes](#exit-codes) applies unchanged.

### The per-project target

Each wired project gains a `typecheck` target in its `angular.json` `architect`
block:

```jsonc
{
  "architect": {
    "typecheck": {
      "builder": "angular-typechecker:typecheck",
      "options": {
        "tsConfig": ["tsconfig.app.json", "tsconfig.spec.json"],
      },
    },
  },
}
```

The `tsConfig` array lists the project's build leaf and its spec leaf, so a single
target checks the project's complete set of files in one run. An application
resolves to `["tsconfig.app.json", "tsconfig.spec.json"]`; a library resolves to
`["projects/<lib>/tsconfig.lib.json", "projects/<lib>/tsconfig.spec.json"]`. The
builder unions the diagnostics from every leaf in the array, the same way the Nx
target follows a solution `tsconfig.json`'s references.

### Caching and the nx dependency

Two things are different from the Nx target:

- **No target caching.** The Angular CLI `typecheck` target does not cache its
  result. The Angular CLI has no task-result cache to seed, so every
  `ng run <project>:typecheck` runs the full check. Rely on your CI cache to skip
  unchanged work.
- **`nx` comes along transitively.** The Angular CLI builder reuses the same engine
  as the Nx executor, so installing angular-typechecker pulls in `nx` as a
  transitive dependency, and a `.nx/` directory may appear in your workspace even
  though you never invoke Nx directly. This is expected; leave it in place or add
  `.nx/` to your `.gitignore`.

This section covers standard application and library projects. A Storybook wired
through the Angular CLI is a separate, unsupported case, called out under
[Storybook](#storybook).

### Angular versions before 22

The `@angular/compiler-cli` `^22.0.0` and TypeScript `>=6.0.0 <6.1.0` peer ranges
mean an Angular workspace older than 22 cannot satisfy them cleanly. To try
angular-typechecker there anyway, install with `--legacy-peer-deps`, which relaxes
peer resolution for the whole install; behavior on an unsupported Angular version
is not verified.

## Standalone CLI

You can run angular-typechecker as a standalone command in any repository, with no
Nx and no Angular CLI. It is the third thin adapter over the same `runTypecheck`
core -- the Nx executor and the Angular CLI builder are the other two -- so it runs
the identical complete Angular type-check (TypeScript, template, and NG8xxx
diagnostics, with no emit) and just adds a plain command-line entry point on top.

### Install and run

The zero-install way to run it in any repository is `npx`:

```sh
npx angular-typechecker -c <tsconfig>
```

That fetches and runs the published package without adding it to your
`package.json`. To install it as a dev dependency instead:

```sh
npm install --save-dev angular-typechecker
```

In a pnpm workspace, add it to the workspace root:

```sh
pnpm add -Dw angular-typechecker
```

After a local install, the `angular-typechecker` command is on your project's
`PATH`, and a short `atc` alias resolves to the same command:

```sh
angular-typechecker -c tsconfig.json
atc -c tsconfig.json
```

The `atc` name is a post-install `PATH` shorthand only -- never run it through
`npx`. Doing so, in a repository where the package is not installed, fetches an
unrelated published package (`atc@0.0.6`, a 2013 "Manage fleet spawns" package),
not this tool -- a supply-chain hazard. The only uninstalled invocation is
`npx angular-typechecker`.

### Options

The command mirrors the executor's behavior through these flags, the same list
`angular-typechecker --help` prints:

| Flag                    | Description                                                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `-c, --tsConfig <path>` | Path to a tsconfig to check (repeatable; required). A single solution tsconfig is reference-walked; two or more are union-checked. |
| `--max-warnings <n>`    | Fail the run if the warning count exceeds n (a non-negative integer; 0 fails on any warning).                                      |
| `--fail-fast`           | Report diagnostics only up to the first error (output brevity; all diagnostics are still gathered).                                |
| `--include-deps`        | Include out-of-project / node_modules diagnostics.                                                                                 |
| `--strict`              | Fail on dropped in-graph warnings (verdict only).                                                                                  |
| `--format <fmt>`        | Output format: `human` (default), `json`, or `sarif`. See [Machine-readable output](#machine-readable-output).                     |
| `--quiet`               | Silence advisory notices on stderr. Never affects the report on stdout or the exit code.                                           |
| `--color`               | Force ANSI color on the human report, overriding `NO_COLOR` / `FORCE_COLOR` / TTY detection.                                       |
| `--no-color`            | Disable ANSI color on the human report.                                                                                            |
| `-h, --help`            | Print this help and exit.                                                                                                          |
| `--version`             | Print the version and exit.                                                                                                        |

`-c` / `--tsConfig` is the only required flag, and it is repeatable: pass it once
to reference-walk a single solution `tsconfig.json`, or several times
(`-c a/tsconfig.json -c b/tsconfig.json`) to union-check multiple tsconfigs in one
run. There is deliberately no `-p` / `--project` flag -- it would collide with the
Nx and Angular CLI notion of a workspace project -- so passing one is an unknown
flag and exits `2` (see below).

### Exit codes

Unlike the Nx executor and the Angular CLI builder, which return a `{ success }`
result and let the host (Nx or the Angular CLI) collapse every failure into a
single non-zero code, the standalone CLI is the first adapter that owns the OS exit
code directly, so it splits a type-check verdict from an infrastructure or usage
failure:

| Code | Meaning                 | When                                                                                                                                                                                             |
| ---- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `0`  | clean                   | The run completed with no error-category diagnostics, the warning count within `--max-warnings`, and complete coverage.                                                                          |
| `1`  | verdict-fail            | Type / template / NG8xxx errors, or the warning count exceeded `--max-warnings`, or coverage was incomplete (a first-party file the check could not fully cover).                                |
| `2`  | infrastructure-or-usage | The compiler failed to run (a missing or unreadable tsconfig, a config-resolution failure), or a usage error (an unknown flag, a missing required `--tsConfig`, a non-integer `--max-warnings`). |

This is the same pass/fail verdict the [Exit codes](#exit-codes) section describes
for the Nx and Angular CLI adapters -- `0` for a clean run, non-zero otherwise --
with the non-zero case split into `1` (the type-check found a problem) and `2` (the
type-check could not run). Everything under [Output](#output) applies to the CLI's
report unchanged.

### Example

Run it against a single tsconfig. A planted type error is reported and the command
exits `1`:

```sh
npx angular-typechecker -c tsconfig.json
```

```
apps/my-app/src/app/app.component.ts:8:38 - error TS2322: Type 'number' is not assignable to type 'string'.

8   protected readonly label: string = 0;
                                       ~
```

A clean run prints nothing and exits `0`.

## Machine-readable output

By default angular-typechecker prints the human-readable report described under
[Output](#output). For AI agents, scripts, and CI security dashboards it can also
emit two machine formats: a flat JSON payload and SARIF 2.1.0. Select one with
`--format`:

```sh
npx angular-typechecker -c tsconfig.json --format json
npx angular-typechecker -c tsconfig.json --format sarif
```

The same choice is available on the Nx executor and the Angular CLI builder
through a `format` option (`human` by default), so `nx typecheck` and
`ng run <project>:typecheck` produce the identical payload:

```jsonc
{
  "targets": {
    "typecheck": {
      "executor": "angular-typechecker:typecheck",
      "options": {
        "tsConfig": "apps/my-app/tsconfig.json",
        "format": "json",
      },
    },
  },
}
```

The machine payload is written to stdout, and nothing else goes there: advisory
and progress notices stay on stderr, and no ANSI color ever appears in a machine
payload, whatever the terminal. So `... --format json > report.json` captures a
clean payload while the notices stay visible on your terminal. The exit code is
identical across `human`, `json`, and `sarif` for the same input, so switching
format never changes pass or fail.

### JSON

`--format json` emits a single JSON object with a flat `diagnostics` array and a
`summary`. Positions are 1-based, paths are repo-relative, and a file-less
diagnostic carries `null` for its file and positions:

```json
{
  "formatVersion": 1,
  "tool": "angular-typechecker",
  "version": "0.2.2",
  "tsConfigPath": "apps/my-app/tsconfig.json",
  "summary": {
    "outcome": "type-error",
    "success": false,
    "errorCount": 1,
    "warningCount": 0,
    "diagnosticCount": 1,
    "rootNamesCount": 12,
    "totalFilesCount": 34,
    "suppressedThirdParty": 0,
    "suppressedInGraphErrorCount": 0,
    "suppressedInGraphWarningCount": 0
  },
  "diagnostics": [
    {
      "file": "apps/my-app/src/app/app.component.ts",
      "line": 8,
      "column": 38,
      "endLine": 8,
      "endColumn": 39,
      "code": "TS2322",
      "rawCode": 2322,
      "severity": "error",
      "message": "Type 'number' is not assignable to type 'string'."
    }
  ]
}
```

Field reference:

- **Top level:** `formatVersion` (an integer that bumps only on a breaking shape
  change), `tool`, `version` (the installed angular-typechecker version),
  `tsConfigPath`, `summary`, and `diagnostics`.
- **`summary`:** `outcome` is one of `clean`, `type-error`, `coverage-incomplete`,
  or `warnings-exceeded`; `success` is the pass/fail verdict; `errorCount`,
  `warningCount`, `diagnosticCount`, and `rootNamesCount` are counts.
  `suppressedThirdParty` counts dropped `node_modules` diagnostics, while
  `suppressedInGraphErrorCount` and `suppressedInGraphWarningCount` count dropped
  first-party ones. `totalFilesCount` (the number of source files checked) and
  `advisories` (the same notices printed on stderr, as data) appear only when
  there is something to report.
- **Each `diagnostics` entry:** `file` (repo-relative, or `null` for a file-less
  diagnostic), 1-based `line`, `column`, `endLine`, and `endColumn` (all `null`
  when file-less), a `code` string (`TS2322`, an `NG8xxx` template code, or an
  `ATC9000x` tool code), the raw `rawCode` integer, `severity`
  (`error` / `warning` / `suggestion` / `message`), and the `message`.

The `success` field, not the presence of any single diagnostic, is the
authoritative verdict: a `coverage-incomplete` run reports `success: false` with
`errorCount: 0`, so never infer pass or fail by counting `diagnostics` yourself.

### SARIF and GitHub Code Scanning

`--format sarif` emits SARIF 2.1.0, the format GitHub Code Scanning ingests. Each
diagnostic becomes a SARIF result; the 18 Angular extended (`NG8xxx`) checks are
declared once in the run's `rules` catalog, and every result carries a
`partialFingerprints` value so Code Scanning can group and track the same alert
across runs. Write the SARIF to a file and hand it to the `upload-sarif` action:

```yaml
- run: npm ci
- run: npx angular-typechecker -c tsconfig.json --format sarif > results.sarif
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: results.sarif
```

A file-less diagnostic (a whole-program error with no source location) is emitted
as a result with no location rather than being dropped. GitHub cannot pin a
no-location result to a line, so treat the run's exit code / `success`, not the
SARIF alert, as the authoritative fail signal for those.

#### Run from the repository root

Each result's `artifactLocation.uri` is made relative to the directory the check
runs in. Run angular-typechecker from the repository root so those URIs stay
repo-relative and GitHub Code Scanning can match each alert to the file in your
source tree. Running from a subdirectory produces URIs relative to that
subdirectory, which GitHub cannot line up with the repository.

## Storybook

`nx typecheck` type-checks your Storybook stories with no extra setup. Storybook's
TypeScript files (your `*.stories.ts`, `.storybook/main.ts`, and
`.storybook/preview.ts`) are just more files your project's `tsconfig` includes, so
the tool checks them the same way it checks the rest of your project. There is no
Storybook-specific option or flag, and the plugin has no dependency on Storybook.

You get the complete Angular check on every TypeScript file your Storybook
`tsconfig` declares: TypeScript errors plus template and NG8xxx diagnostics, with
no emit. A passing run means all of those files type-checked cleanly. One thing
makes this work, and the `configuration` generator already sets it up for you.
Point the `typecheck` target at your project's top-level `tsconfig.json`, the one
with a `references` array, not at a specific `tsconfig.app.json` /
`tsconfig.lib.json`. The tool follows those references to find your stories, so a
single leaf config leaves the stories out. Order doesn't matter: the target reads
the references each time it runs, so adding Storybook after you wire `typecheck`
works on the next run, with no re-generation.

This covers both ways teams set up Storybook in an Nx workspace:

- A Storybook in each project (`nx g @nx/angular:storybook-configuration`): that
  project's stories are checked.
- One central Storybook for the whole workspace (the Nx "one Storybook for all
  projects" recipe, where a single Storybook pulls in stories and components from
  many projects): the files its `tsconfig` declares are checked too, and a
  first-party file reached only through an import is surfaced as incomplete coverage
  rather than skipped. A real error in any of them fails the run.

### Storybook Composition

Storybook Composition (one Storybook that embeds other, independently built
Storybooks) is a project structure, not a special `tsconfig`. Each composed project
and the composing host are ordinary per-project Storybooks, so you check them the
normal way: give each project its own `typecheck` target and run them together with
`nx run-many -t typecheck` or `nx affected -t typecheck`. To check a host and
everything it composes in one command, add `dependsOn: ["^typecheck"]` to the
host's `typecheck` target and list the composed projects in the host's
`implicitDependencies`.

This checks each project's own TypeScript, including the host's
`.storybook/main.ts`, so a real TypeScript error in its `refs` object is reported.
It does not verify that the composed `refs` URLs resolve or deploy; those are
runtime URLs, not TypeScript. Note that `@storybook/angular` types the `refs`
object loosely (as `any`), so a mistyped `refs` value is caught only if you
annotate it with your own type.

### What this does and doesn't promise

It type-checks the TypeScript files your Storybook `tsconfig` declares. It does not
claim to cover every Storybook file, and it does not verify that Storybook builds or
runs. It is a type-check, nothing more. Setups other than the two above aren't
officially supported. When it can't fully check a first-party file it says so;
whether that fails the run depends on the case (see [Partial coverage](#partial-coverage)).

### Things to know

- `.mdx` docs are never type-checked, and a `.tsx` story is checked only when your
  `tsconfig` sets `compilerOptions.jsx`. When your Storybook config declares files
  like these that can't be checked, `nx typecheck` prints a notice naming them; this
  never changes whether the run passes. See `notTypeCheckedDeclaredFiles` under
  [Programmatic API](#programmatic-api).
- Stories that use an external `templateUrl` are handled. A template error such as
  `NG8002` is reported against the right component, not dropped.
- Vite and Analog Storybook `?query` imports: add `"types": ["vite/client"]` to the
  tsconfig you check. That one line is the fix. Imports like
  `import src from './x?raw'` (and `?url`, `?worker`, `?inline`, and virtual modules)
  are Vite features TypeScript doesn't understand on its own, so the Angular compiler
  reports them as `TS2307` ("cannot find module"). Adding `"vite/client"` declares
  that whole family of imports and clears the errors. In one real project it took the
  count from 227 such errors to zero without hiding any genuine problem: a truly
  missing module, or the wrong type of value, still fails. This applies whether your
  Storybook builds with webpack/esbuild (`@storybook/angular`) or Vite
  (`@analogjs/storybook-angular`). It is standard TypeScript behavior for Vite
  projects, not something specific to this tool.

  If you'd rather not depend on Vite's types, declare the imports yourself in a
  `.d.ts` your `tsconfig` includes, one per suffix
  (`declare module '*?raw' { const src: string; export default src; }`). This only
  covers the suffixes you list, so `"vite/client"` is preferred. Either way there is
  one narrow blind spot: a `?query` import of a base file that doesn't exist won't be
  flagged, the same gap between building and type-checking that Vite itself has.

  The tool never hides these `TS2307` errors automatically, because a missing module
  can be a real bug. When it sees unresolved `?query` imports it lists them in a
  notice that points you at this same fix and goes quiet once they resolve (see
  `bundlerQueryImports` under [Programmatic API](#programmatic-api)).

- Point the target at your top-level `tsconfig.json`, not a `tsconfig.app.json` /
  `tsconfig.lib.json`. A leaf config leaves the stories out.
- A single flat `tsconfig.json` with no `references` isn't an officially supported
  Storybook setup. Pointed at a flat config directly, the tool checks the stories
  that config includes; a config that declares no files fails the run instead of
  passing with nothing checked.
- The Angular CLI Storybook setup (`ng add @storybook/angular`, which wires its
  tsconfigs through `angular.json` with no top-level `references`) is not supported.
- Installing Storybook on Angular 22 needs a peer-dependency override.
  `@storybook/angular@10.4.6` still caps its Angular peer at `>=18 <22`
  (TypeScript `^4.9 || ^5`), so you need `--legacy-peer-deps` (or `--force`) to
  install it on Angular 22 / TypeScript 6; on pnpm, `nx add` can hit
  `ERR_PNPM_IGNORED_BUILDS`. This is a Storybook install constraint, not an
  angular-typechecker one; the tool applies no version gate. That Storybook version
  also emits 48 TypeScript 6 errors from its own bundled type declarations. Those
  come from `node_modules` and never affect your result, while genuine errors in your
  own `main.ts` / `preview.ts` are still reported.

## Limitations

- angular-typechecker is 0.x (pre-1.0). Breaking changes are allowed in minor
  releases under the project's 0.x semver policy.
- Some first-party files can't be fully covered when a project is checked in
  isolation; see [Partial coverage](#partial-coverage) for the cases and how to
  control them.

## Contributing

Issues and pull requests are welcome on
[GitHub](https://github.com/LayZeeDK/angular-typechecker/issues). Please open an
issue to discuss a substantial change before sending a pull request.

## License

MIT (c) 2026 Lars Gyrup Brink Nielsen
