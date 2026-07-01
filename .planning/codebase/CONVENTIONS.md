# Coding Conventions

**Analysis Date:** 2026-06-30

This is a CommonJS-output Nx 23 plugin (`packages/angular-typechecker/`) that runs the
Angular whole-program type-check. The conventions below are derived from the actual source
under `packages/angular-typechecker/src/` and the workspace tooling configs. Follow them
exactly when adding or editing code.

## Naming Patterns

**Files:**

- `kebab-case.ts` for all source modules: `run-typecheck.ts`, `compiler-loader.ts`,
  `gather-diagnostics.ts`, `evaluate-result.ts`, `exit-codes.ts`, `normalize-options.ts`.
- Co-located unit tests: `<module>.spec.ts` (e.g. `exit-codes.spec.ts`).
- Real-compiler integration tests in the plugin: `<name>.integration.spec.ts`
  (e.g. `run-typecheck.integration.spec.ts`).
- E2E specs (tarball/install/matrix tier, under `e2e/`): `<name>.int.spec.ts`
  (e.g. `tarball-audit.int.spec.ts`).
- Type-only build-time tripwire: `<name>.drift.ts` (e.g. `compiler-cli-types.drift.ts`) --
  never shipped, never `import`-reachable, compiled only by the `typecheck-drift` target.
- Schema pairs per executor: `schema.json` (runtime) + `schema.d.ts` (the matching TS
  interface), kept in parity by `schema-parity.spec.ts`.

**Functions:**

- `camelCase`. Exported engine/adapter entry points are verbs: `runTypecheck`,
  `loadCompilerCli`, `gatherAllDiagnostics`, `evaluateResult`, `renderReport`,
  `normalizeOptions`, `toExitCode`. Private helpers also `camelCase`
  (`synthesizeZeroRootNamesDiagnostic`, `resolveFilterBasePath`, `finalize`).

**Variables:**

- `camelCase` for locals/params (`tsConfigPath`, `suppressedCount`, `configDiagnostics`).
- `SCREAMING_SNAKE_CASE` for module-level constants and synthesized codes:
  `ZERO_ROOT_NAMES_DIAGNOSTIC_CODE`, `TCB_GENERATION_FATAL_DIAGNOSTIC_CODE`,
  `UNKNOWN_ERROR_CODE`, test literals like `TS2322`, `INJECTED_TS_CODE`, `REQUIRED_FILES`.

**Types:**

- `PascalCase` interfaces and classes: `CoreOptions`, `CoreResult`, `NormalizedOptions`,
  `TemplateCheckAborted`, `TypecheckInfrastructureError`, `AngularTypecheckExecutorOptions`.
- Custom error subclasses extend `Error` and set `this.name` in the constructor (see
  `TypecheckInfrastructureError` in `src/core/run-typecheck.ts`).

## Code Style

**Formatting (Prettier):**

- Config: `.prettierrc` -- the only override is `{ "singleQuote": true }`. Everything else
  is Prettier defaults (2-space indent, semicolons, trailing commas in multiline).
- `.editorconfig`: UTF-8, 2-space indent, final newline, trim trailing whitespace
  (markdown exempt from trim + line-length).
- `.prettierignore`: `/dist`, `/coverage`, `/.nx/cache`, `/.nx/workspace-data`, `.angular`.
- Prettier version: `~3.6.2` (root `devDependencies`).

**Linting (ESLint flat config):**

- Root config: `eslint.config.mjs` -- composes `@nx/eslint-plugin` flat presets
  (`flat/base`, `flat/typescript`, `flat/javascript`) plus `@nx/enforce-module-boundaries`.
- Plugin config: `packages/angular-typechecker/eslint.config.mjs` extends the root and adds
  three load-bearing rule blocks:
  1. **`core/` purity boundary** (`files: ['**/src/core/**/*.ts']`): bans importing `nx`,
     `@nx/devkit`, any `@nx/*`, `@angular-devkit/*`, and `yargs` via
     `@typescript-eslint/no-restricted-imports` (type-only imports ALSO banned --
     `allowTypeImports` is intentionally omitted). Also `'no-console': 'error'` and a
     `no-restricted-properties` ban on `process.exit`. The framework-agnostic `core/`
     owns NO I/O and NO process side effects; the executor adapter owns those.
  2. **`@nx/dependency-checks`** (ERROR, on `**/*.json`): catches missing/obsolete deps;
     `checkVersionMismatches: false` so the autofix never rewrites the PUBLIC peer ranges
     to installed exacts (`^22.0.0` -> `22.0.4`). NEVER run `eslint --fix` on the manifest.
  3. **`@nx/nx-plugin-checks`** (ERROR, on `**/package.json`).
- `jsonc-eslint-parser` parses JSON for the dependency/plugin rules.

## Import Organization

Imports are grouped, blank-line-separated, alphabetized within each group. Observed order
(see `src/core/run-typecheck.ts`, `src/core/gather-diagnostics.spec.ts`):

1. Node built-ins, `node:`-prefixed (`import { dirname } from 'node:path';`).
2. Type-only imports of external packages (`import type ts from 'typescript';`).
3. Type-only imports of local modules (`import type { Program } from './compiler-cli-types';`).
4. Value imports of external packages -- in specs, the test runner sits here
   (`import { describe, expect, it, vi } from 'vitest';`).
5. Value imports of local modules (`import { gatherAllDiagnostics } from './gather-diagnostics';`).

**Conventions:**

- Prefer `import type { ... }` for anything used only in type position. The compiler-cli
  surface is reached at VALUE level exactly once (`compiler-loader.ts`'s
  `await import('@angular/compiler-cli')`); every other reference is `import type`.
- No path aliases in published source. The dev workspace uses a `@fixtures/*` tsconfig
  alias for fixtures, but ZERO `@fixtures` references may reach shipped `.d.ts`
  (guarded by `e2e/.../tarball-audit.int.spec.ts`).
- `@nx/devkit` may be imported ONLY from the executor adapter tier
  (`src/executors/angular-typecheck/executor.ts`, `normalize-options.ts`) -- never `core/`.

## Error Handling

**Strategy:** distinguish a TYPE error (a real diagnostic) from an INFRASTRUCTURE failure
(the compiler failed to RUN). The two map to different exit codes and verdicts.

- A returned/synthesized `UNKNOWN_ERROR_CODE` (500) diagnostic is detected BY CODE ONLY
  (never by `source`/message text) at two stages in `runTypecheck` (after
  `readConfiguration` and after `performCompilation`) and re-thrown as
  `TypecheckInfrastructureError` (`src/core/run-typecheck.ts`).
- The executor adapter catches ONLY `TypecheckInfrastructureError` -> `logger.error` +
  `{ success: false }`. EVERY other error is RE-THROWN -- "a type-checker that silently
  swallows an unknown failure and reports success is worse than none"
  (`src/executors/angular-typecheck/executor.ts`).
- Exit-code policy is a pure leaf in `core/exit-codes.ts`: `2` = infra failure, `1` =
  `errorCount > 0`, `0` = clean (ngc parity). It performs NO process side effects.
- Defensive guards use explicit `=== undefined` / `!== undefined` checks (never truthiness)
  and `??` for defaults, with a guard against the empty-string footgun where `??` is
  insufficient (see `resolveFilterBasePath`).

## Logging

**Framework:** `@nx/devkit`'s `logger` -- but ONLY in the executor adapter tier. `core/`
forbids `console` via ESLint (`no-console: error`).

**Patterns:**

- `logger.error(...)` for an infrastructure failure (distinct operator message containing
  "infrastructure error").
- `logger.warn(...)` for the loud TCB-generation-abort suppression notice (names the
  offending file; never silent).
- The rendered type-check report goes to RAW `process.stdout.write(report)`, NEVER
  `logger.info` -- Nx chrome/color would corrupt the byte-deterministic codeframes and the
  GitHub problem-matcher `file:line:col` parsing (`executor.ts`, D-04).

## Comments

**When to Comment:**

- Heavy, intentional commenting. Modules and non-obvious branches carry block comments
  explaining the WHY, the failure mode being guarded, and the decision reference
  (`D-01`, `COR-04`, `RES-02`, `Pitfall 5`, etc.) that justifies the choice. These decision
  refs trace back to `.planning/` artifacts -- preserve them when editing.
- Comment the footguns: every defensive guard states what breaks if it is removed
  (the empty-`basePath` filter-disable, the mutated-`noEmit` cross-call leak, the
  `length - errorCount` miscount, etc.).

**JSDoc/TSDoc:**

- Exported functions and many interfaces/fields carry `/** ... */` doc comments describing
  contract, invariants, and purity. Field-level comments document the invariant
  (`errorCount + warningCount <= diagnostics.length`).

## Function Design

**Size:** functions stay single-purpose. `runTypecheck` is the one large orchestrator;
it delegates to small pure helpers (`finalize`, `resolveFilterBasePath`,
`detectTemplateCheckAborted`, `synthesizeZeroRootNamesDiagnostic`).

**Parameters:** public entry points take a single options object
(`runTypecheck(options: CoreOptions)`, `normalizeOptions(options, context)`). Booleans are
opt-in with safe defaults applied via `?? false`.

**Return Values:** return structured result objects (`CoreResult`, `NormalizedOptions`,
`{ success: boolean }`), `readonly` arrays for diagnostic sets, and union literals for
policy (`0 | 1 | 2` from `toExitCode`). Conditional fields are spread in only when present
(`...(templateCheckAborted !== undefined ? { templateCheckAborted } : {})`).

## Module Design

**Exports:** named exports throughout `core/`; the executor uses a `default export` async
function (Nx requires the executor's default export). The public API surface is the barrel
`src/index.ts`, which re-exports the `core/` functions + their option/result types.

**Barrel Files:** `src/index.ts` is the single barrel and the published `main`/`exports`
entry (`./src/index.js`). `core/` modules import each other by relative path, not via the
barrel, to avoid cycles. `exit-codes.ts` must NOT be imported by `run-typecheck.ts`
(the engine stays unaware of exit policy -- documented layering rule).

## Commit Conventions (release-driving)

Conventional Commits are MANDATORY -- `nx release` (`nx.json` -> `release.version.
conventionalCommits: true`) computes both the next version and the changelog from the
commit log. See `AGENTS.md` for the authoritative rules. Key points:

- Format: `type(scope): imperative summary`. Breaking change = `!` before colon OR a
  `BREAKING CHANGE:` footer.
- This repo is pre-1.0, so `adjustSemverBumpsForZeroMajorVersion` shifts bumps DOWN one
  level: `feat`/`fix` both produce a PATCH bump; a breaking change produces a MINOR bump.
  `docs`/`chore`/`refactor`/`test`/`build`/`ci`/`style`/`perf` produce NO bump.
- Only commits that touch `packages/angular-typechecker/` files count toward its version;
  `.planning/`-only or docs-only commits do not bump the package.
- Keep scopes PUBLIC-clean (`core`, `executor`, `release`, `deps`) -- internal plan-id
  scopes (`feat(05-01): ...`) leak verbatim into the generated changelog.
- No AI attribution in commit messages. Never `git add .`/`-A`/`-u` -- stage by name.

---

_Convention analysis: 2026-06-30_
