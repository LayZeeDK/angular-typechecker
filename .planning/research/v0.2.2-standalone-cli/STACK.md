# Stack Research

**Domain:** Standalone Node CLI `bin` added to an existing `@nx/js:tsc`-built, CommonJS Nx plugin (`angular-typechecker` v0.2.2)
**Researched:** 2026-07-16
**Confidence:** HIGH

## Headline finding (read first)

**No new runtime OR dev dependency is warranted for the standalone CLI.** The entire feature is delivered with:

1. Node stdlib `node:util` `parseArgs` for the whole flag set (verified against the Node 22 docs).
2. A `bin` object with two keys in the already-shipped `package.json`, both pointing at ONE compiled entry.
3. A `#!/usr/bin/env node` shebang authored at the top of the CLI source `.ts` -- `@nx/js:tsc` (native `tsc`) preserves it into the emitted `.js` verbatim (verified).
4. `publint` (already-recommended package-health tool) as the bin tarball audit -- its `bin` rule is exactly "the bin file must start with a shebang".

The CLI entrypoint imports ONLY the framework-agnostic core (`runTypecheck`, `TypecheckInfrastructureError`, `evaluateResult`, `renderReport`, `toExitCode`) plus `node:*` builtins -- **never `@nx/devkit`/`nx`**. Confirmed nx-free by grep: `src/core/**` and `src/core/exit-codes.ts` contain zero `@nx/devkit`/`nx` value imports (the only occurrence is a comment in `angular-cli-wiring.ts`). This satisfies the milestone's lean-startup + dodge-the-nx-`chalk`-crash requirement (24-06 lesson) mechanically, not by convention.

## Recommended Stack

### Core Technologies (all already present -- ZERO additions)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `node:util` `parseArgs` | stdlib (stable since Node 20; present in all supported runtimes `^22.22.3 \|\| ^24.15.0 \|\| ^26.0.0`) | Parse the CLI flag set | Covers every required flag with no dependency. `multiple: true` -> repeatable `-p/--tsConfig`; `short` -> `-p` alias; `type: 'string'` for `--max-warnings` (parse to number by hand -- there is no number type, which is fine); `type: 'boolean'` for the switches; `strict: true` (default) throws a clear error on unknown flags. Ladder rung 3 (stdlib does it) -- stop here. |
| `@nx/js:tsc` build (native `tsc`) | `23.0.1` (unchanged) | Compile `src/bin/*.ts` -> `src/bin/*.js` | Already the build. It compiles ALL of `src/**/*.ts` (per `tsconfig.lib.json` `include`), so a new `src/bin/cli.ts` is picked up with NO `project.json` change. Native `tsc` **preserves the source shebang** into the emitted `.js` (it does not add, strip, or rewrite it). |
| `package.json` `bin` field | n/a (config) | Register two command names | npm-native; two keys can share one target file. `atc` collision risk is nil (a local bin name, never a package name). |
| The pure core (`runTypecheck` / `evaluateResult` / `renderReport` / `toExitCode`) | in-repo | The CLI's only non-stdlib imports | Third thin adapter over the same core, exactly like the Nx executor and the `convertNxExecutor` builder. `toExitCode` is the dead COR-04 scaffold reserved for this CLI since v0.0.3 -- this milestone gives it its first live consumer. |

### Supporting Libraries

**None.** Every candidate below is on the "What NOT to Use" list. The CLI is glue over the existing core; it needs no arg parser, no color lib, no bundler, no shebang tool, and no new manifest.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `publint` (latest `0.3.x`; run via `npx publint`) | Bin tarball audit | Its `bin` rule: "Ensure the file referenced in the `bin` field starts with a shebang." It runs `npm-pack-list` against the **actual dist tarball** (not source), so it validates the shipped `bin` byte-for-byte -- the right tool for this milestone's "prove the shipped `bin`s" gate. Run against `dist/packages/angular-typechecker` after build. Devkit-only; not added to `dependencies`. |
| `@arethetypeswrong/attw` (optional) | Type-resolution audit | **Not bin-specific** -- attw checks `types`/`exports` resolution across module systems, which bins do not participate in. It remains a useful general package-health check (the package already ships `types`), but it neither validates nor is affected by the `bin`. Optional; do not gate the CLI on it. |
| The in-repo Vitest e2e tier | Prove exit codes 0/1/2 + shebang | The milestone's CI-authoritative verification runs the installed tarball's `bin`s in a plain non-Nx project and asserts the literal OS exit code. On Windows the "shebang" works via npm's generated `.cmd`/`.ps1`/shell shims, NOT the shebang line itself -- assert the two `.bin` shims resolve and exit correctly there. |

## The exact `package.json` `bin` shape

Add to the existing manifest (no other field changes required for the two names):

```jsonc
{
  "bin": {
    "angular-typechecker": "./src/bin/cli.js",
    "atc": "./src/bin/cli.js"
  }
}
```

- **Both keys point at the ONE compiled entry** (`./src/bin/cli.js`), never the `.ts`. npm generates a `.bin/angular-typechecker` and a `.bin/atc` shim, both invoking `node .../src/bin/cli.js`.
- Path is relative to the published package root. The published layout keeps the `src/` prefix (the manifest already uses `main: ./src/index.js`), so `./src/bin/cli.js` is consistent with how the package already resolves compiled output.
- `@nx/js:tsc` copies `package.json` (with the `bin` field) into `dist/`, and `nx-release-publish` already packs from `packageRoot: dist/packages/angular-typechecker` (the v0.1.1 hotfix), so the `bin` field ships correctly from the built artifact -- verify with `publint` + `git show <tag>:.../package.json` at release time.

## Bin packaging mechanics (the load-bearing details)

1. **Shebang -- author it in source.** Put `#!/usr/bin/env node` as line 1 of `packages/angular-typechecker/src/bin/cli.ts`. `tsc` preserves it verbatim into `src/bin/cli.js`. Do NOT use a `ts-node` dev shebang + a rewrite tool (`shebang-trim`) -- the source shebang is the compiled shebang here, so there is nothing to rewrite.

2. **`files` whitelist -- already covers it.** The manifest whitelists `"src"`, so `src/bin/cli.js` is included with **no `files` change**. (If you prefer an explicit whitelist entry for grep-ability, `"src"` is sufficient; adding `"src/bin"` would be redundant.)

3. **`@nx/js:tsc` build target -- NO change needed.** `tsconfig.lib.json` includes `src/**/*.ts`, so `src/bin/cli.ts` compiles automatically. `main: src/index.ts` only sets the package `main` mapping; it does not limit which files compile. No new `assets` glob is needed (the `bin` is a compiled `.ts`, not a copied JSON like `executors.json`).

4. **Executable bit -- do NOT add a chmod step.** `tsc`/`@nx/js:tsc` emit without the `+x` bit and `npm pack` does not add it. That is fine: **npm sets the bin target executable (`0o755`) at install time** and creates the `.bin` symlinks/shims. Every mainstream published Node CLI relies on this; a build-time `chmod` is unnecessary complexity. (If a future strict linter ever demands `+x` in the tarball, add a single post-build `chmod` then -- not now.)

5. **Cross-platform.** The shebang is ignored on Windows; npm's generated `.cmd`/PowerShell/shell shims provide the Windows entry. The milestone's "cross-platform shebang works on Windows" check is really "npm's Windows shims resolve and run" -- assert via the installed-tarball e2e.

6. **`module: nodenext` bridge is inherited.** `src/bin/cli.ts` compiles under the same `tsconfig.lib.json` (-> `module: nodenext`) as the executor, so the transitive `await import('@angular/compiler-cli')` reached via `runTypecheck`/`renderReport` survives emit as a native dynamic import (GATE A), unchanged. No new module-format work.

## The nx-free entrypoint (confirmed feasible against the codebase)

The CLI adapter imports ONLY these (all nx-free, verified):

- `runTypecheck`, `TypecheckInfrastructureError`, `CoreOptions`, `CoreResult` from `./core/run-typecheck`
- `evaluateResult` from `./core/evaluate-result`
- `renderReport` from `./core/render-report`
- `toExitCode` from `./core/exit-codes`
- `node:util` (`parseArgs`), `node:path` (`resolve`/`isAbsolute`), `node:process`

**Do NOT reuse `normalize-options.ts`** -- it imports `@nx/devkit` (`joinPathFragments`, `ExecutorContext`). The CLI writes its own tiny path resolver: the core requires ABSOLUTE `tsConfigPath`, and the CLI owns its process (like `ngc`), so resolve each `-p` value with `path.resolve(process.cwd(), p)`. Determine `color` from `process.stdout.isTTY` (same as the executor does, but inline).

**Logger injection = plain `console`.** The executor renders its five advisory notices (`warnTemplateCheckAborted`, `warnSkippedReferences`, `warnSuppressed`, `warnNotTypeChecked`, `warnBundlerQueryImports`) via `@nx/devkit` `logger`. The CLI must re-express these against `console.warn`/`console.error` (or a 3-line injected logger). This is CLI-owned glue over the SAME pure `CoreResult` fields -- not a re-implementation and not a new dependency. Keep `process.exit`/`console` at the CLI edge only (the `src/core/**` eslint block bans them -- the CLI lives outside `core/`, so it is the correct home for the process side-effects, mirroring the adapter pattern).

**Recommended shape (testability, mirrors the adapter split):**
- `src/cli/run-cli.ts` -- pure-ish `runCli(argv: string[], io: { stdout, stderr }): Promise<0 | 1 | 2>`: parseArgs -> resolve paths -> `runTypecheck` -> advisory notices -> `renderReport` -> `evaluateResult` + `toExitCode`. Catches `TypecheckInfrastructureError` -> exit `2`. Unit-testable without spawning a process.
- `src/bin/cli.ts` -- 3 lines: the shebang + `runCli(process.argv.slice(2), process).then((code) => process.exit(code))`. This is the only file with a shebang and the only `process.exit` site.
- Wire `toExitCode` to the `evaluateResult` verdict, NOT raw counts: map `outcome` (`type-error`/`coverage-incomplete`/`warnings-exceeded` -> exit 1, `clean` -> 0) and reserve `2` for the caught `TypecheckInfrastructureError`. `toExitCode`'s own doc-comment warns against re-deriving the verdict from raw counts -- honor it (a `coverage-incomplete` run reads clean from `errorCount` alone).

## The exact `parseArgs` config

```ts
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true, // optional: accept bare tsconfig paths too
  options: {
    tsConfig:      { type: 'string',  short: 'p', multiple: true }, // repeatable
    'max-warnings':{ type: 'string' },                              // parse Number() by hand
    'fail-fast':   { type: 'boolean' },
    'include-deps':{ type: 'boolean' },
    strict:        { type: 'boolean' },
    help:          { type: 'boolean', short: 'h' },
    version:       { type: 'boolean', short: 'v' },
  },
});
```

- `multiple: true` collects `-p a -p b` into `values.tsConfig = ['a','b']` -> pass straight to the core's `tsConfigPath: string[]` (ENG-01 already accepts an array).
- `--max-warnings 0` arrives as the string `"0"`; `Number()` it and hand to `evaluateResult` (which already defends against negative/NaN as "unset").
- `strict: true` (the default) throws on an unknown flag -- good CLI UX; catch it and print usage.
- No number type is a non-issue: one `Number(...)` call.

## Installation

```bash
# Core:      nothing to install -- parseArgs is stdlib, the core already ships.
# Runtime:   NO new dependency, NO new peerDependency.
# Dev audit: npx publint dist/packages/angular-typechecker   (already-recommended tool; not added to deps)
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `node:util` `parseArgs` | `commander` / `yargs` / `meow` / `cac` | Only if you later add subcommands, auto-generated `--help` with rich formatting, or config-file/glob input -- all explicitly OUT of scope for v0.2.2. For a flat flag set with one repeatable option, parseArgs is the whole job. |
| `node:util` `parseArgs` | `arg` / `minimist` (tiny parsers) | Never here -- they are the same size problem parseArgs already solves in stdlib, and add a dependency + a supply-chain surface for zero gain. |
| One compiled `.js` loaded by `node` | `esbuild`/`ncc`/`pkg` bundled bin | Only if you needed a zero-dependency single-file or a native executable. The package ships its deps as peers/deps normally; bundling fights the existing `@nx/js:tsc` multi-file layout and the `await import()` ESM bridge. |
| `#!/usr/bin/env node` in source | `shebang-trim` + ts-node dev shebang | Only if you wanted the source file itself runnable via `ts-node` in dev. Not needed -- the source shebang IS the compiled shebang. |
| npm install-time `chmod` | build-time `chmod +x` step | Only if a strict tarball-permission linter demands `+x` in the packed tar. npm's install-time chmod covers real usage. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Any arg-parsing dependency (`commander`, `yargs`, `minimist`, `meow`, `cac`, `arg`) | The flag set is flat with one repeatable option -- fully covered by stdlib. A dep adds install weight + supply-chain risk for nothing. | `node:util` `parseArgs`. |
| A color library (`chalk`, `picocolors`, `kleur`) | Coloring already lives in `formatReport`/`renderReport` via `@angular/compiler-cli` + the `color` flag. | Pass `color: process.stdout.isTTY` to `renderReport`. |
| Importing `@nx/devkit`/`nx` (or reusing `normalize-options.ts` / the executor) in the CLI path | Re-introduces the nx `chalk`-chain crash class (24-06) and bloats startup; defeats the milestone's lean, nx-free entrypoint requirement. | Import ONLY the pure core + `node:*`; write CLI-owned path resolution + a `console` logger. |
| A new JSON manifest (a `bin.json`, an `executors.json`-style file) | `bin` is a native `package.json` field -- there is no separate collateral to compile or glob. | The `bin` object in `package.json`; no `assets` change. |
| A build-time `chmod`/`fs.chmodSync` step | npm sets `+x` on install; the step is redundant maintenance. | Rely on npm's install-time chmod; let `publint` assert the shebang. |
| `type: "module"` / an ESM bin | The package is CJS by contract; the CLI reaches ESM compiler-cli via the same `await import()` bridge under `module: nodenext`. | Keep `type: "commonjs"`; author the shebang; compile with the existing build. |
| Re-deriving exit codes from raw `errorCount` | A `coverage-incomplete`/`warnings-exceeded` run reads clean from raw counts -> silent false pass. | Map `evaluateResult(...).outcome` to 0/1 and reserve 2 for the caught `TypecheckInfrastructureError` (`toExitCode`). |
| `attw` as a bin gate | attw audits type resolution; bins are not type-facing, so it neither validates nor is affected by the bin. | `publint` (its `bin` rule checks the shebang against the packed tarball). attw stays an optional general check. |

## Stack Patterns by Variant

**If a future milestone adds subcommands or config-file discovery (currently OUT of scope):**
- Reconsider `cac` or `commander` at that point -- but only then, and only if parseArgs' manual `--help` becomes unwieldy.
- Because parseArgs has no subcommand/auto-help machinery; a flat flag set does not need it.

**If a future milestone ships machine-readable reporters (JSON/SARIF, currently deferred):**
- Add a `--format` string flag (parseArgs handles it) that selects the reporter in `run-cli.ts`.
- Because the reporter selection is CLI-side glue over the same `CoreResult`; still no new dependency for arg parsing.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `node:util` `parseArgs` | Node `^22.22.3 \|\| ^24.15.0 \|\| ^26.0.0` | Stable since Node 20; every supported runtime has it. `multiple`, `short`, `strict`, `allowPositionals`, `allowNegative`, `tokens` all present. |
| `@nx/js:tsc` `23.0.1` + `tsc` (TypeScript `>=6.0.0 <6.1.0`) | shebang preservation | Native `tsc` preserves a source `#!` line into emit; unchanged behavior across the TS 6.0.x window. |
| `package.json` `bin` (two names) | npm / pnpm / yarn | All three create both `.bin` shims from the two keys; both resolve to the one target. No PM-specific handling. |
| `publint` `0.3.x` | the dist tarball | Uses `npm-pack-list`; validates the actual shipped `bin` file's shebang. |

## Sources

- Node 22 `util.parseArgs` API (nodejs.org/docs/latest-v22.x/api/util.html) -- HIGH: option `type` is `boolean`|`string` only (no number), `multiple: true` collects into an array, `short` single-char alias, `strict` (default true) throws on unknown args, `allowPositionals`/`allowNegative`/`tokens` present. Confirms parseArgs covers the full flag set.
- TypeScript shebang preservation (microsoft/TypeScript#10382, #45319; multiple TS-CLI guides) -- HIGH/MEDIUM: `tsc` passes the source shebang through to compiled output unchanged; no native option to inject a different shebang (not needed here). Author `#!/usr/bin/env node` in source.
- publint rules (publint.dev/rules; bjornlu.com/projects/publint) -- HIGH: the `bin` rule requires the referenced file to start with a shebang; publint validates against the packed tarball via `npm-pack-list`. attw is type-resolution-focused (comparisons page) -- not bin-specific.
- Codebase inspection (`packages/angular-typechecker/src/**`, `package.json`, `project.json`) -- HIGH: core is nx-free (`git grep` for `@nx/devkit`/`nx` in `src/core/**` returns only a comment in `angular-cli-wiring.ts`); `toExitCode` (`exit-codes.ts`) imports only `./run-typecheck`; `runTypecheck`/`evaluateResult`/`renderReport` are nx-free; the CJS->ESM bridge (`compiler-loader.ts`) compiles under `tsconfig.json` `module: nodenext`; `files` whitelists `src`; build compiles all `src/**/*.ts`; no `bin` field present today.

---
*Stack research for: standalone CLI `bin` for angular-typechecker v0.2.2*
*Researched: 2026-07-16*
