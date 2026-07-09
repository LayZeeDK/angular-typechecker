# Coding Conventions

**Analysis Date:** 2026-07-09

This is an Nx plugin monorepo (Nx 23 / Angular 22 / TypeScript 6). The published
package is `packages/angular-typechecker/`; supporting projects live in `libs/`,
`e2e/`, `apps/`, and `fixtures/`. All conventions below are enforced by the two
required CI gates: `format:check` (Prettier) and `lint` (ESLint, `maxWarnings: 0`).

## Naming Patterns

**Files:**

- kebab-case for all `.ts` sources: `run-typecheck.ts`, `gather-diagnostics.ts`,
  `filter-diagnostics.ts`, `detect-bundler-query-imports.ts`.
- Suffix conventions carry meaning and are load-bearing for tsconfig include/exclude
  and vitest globs:
  - `*.spec.ts` -- unit test, colocated next to source.
  - `*.integration.spec.ts` -- real-compiler integration test (runs `performCompilation`).
  - `*.int.spec.ts` -- e2e test (only under `e2e/*/src/`; the vitest `include` there is `src/**/*.int.spec.ts`).
  - `*.drift.ts` -- build-time drift tripwires, type-checked by the `typecheck-drift` target, EXCLUDED from both lib and spec compilation.
  - `*.members.ts` / `*.runtime.spec.ts` / `*.structural.spec.ts` -- narrower spec facets.
- Nx plugin scaffolding files keep their canonical names: `executor.ts`,
  `generator.ts`, `schema.d.ts`, `executors.json`, `generators.json`, `schema.json`.

**Functions:**

- camelCase: `runTypecheck`, `gatherAllDiagnostics`, `finalize`, `buildFinalizeFilter`,
  `detectTemplateCheckAborted`, `normalizeOptions`.
- Exported executor default is an `async function` returning `Promise<{ success: boolean }>`
  (`packages/angular-typechecker/src/executors/typecheck/executor.ts`).
- Adapter-only helpers use a `warn*` prefix (`warnSkippedReferences`, `warnSuppressed`).

**Variables:**

- camelCase for locals and parameters (`configDiagnostics`, `rootNamesCount`, `extractDir`).
- SCREAMING_SNAKE_CASE for module-level constants and fixed sets: `TS2322`,
  `NX_RUNNER_ENV_KEYS`, `REQUIRED_FILES`, `INSTALL_SCRIPT_KEYS`,
  `TCB_GENERATION_FATAL_DIAGNOSTIC_CODE`, `ZERO_ROOT_NAMES_DIAGNOSTIC_CODE`.

**Types:**

- PascalCase for interfaces, type aliases, and classes: `CoreOptions`, `CoreResult`,
  `TemplateCheckAborted`, `FinalizeFilter`, `TypecheckInfrastructureError`,
  `TypecheckExecutorOptions`, `RunResult`.
- No `I`-prefix on interfaces.
- Error classes extend `Error` and set `this.name` in the constructor
  (`TypecheckInfrastructureError` in `packages/angular-typechecker/src/core/run-typecheck.ts`).

## Code Style

**Formatting:**

- Tool: Prettier `~3.6.2`. Config is `.prettierrc` and contains ONLY `{ "singleQuote": true }`.
  Everything else is Prettier default (2-space indent, semicolons, trailing commas es5+, 80 cols).
- `.editorconfig`: UTF-8, `indent_style = space`, `indent_size = 2`, final newline,
  trim trailing whitespace. Markdown exempts line length + trailing whitespace.
- `format:check` runs ONLY over PR-changed files (nx `--base/--head`), because the repo
  intentionally carries un-Prettier'd fixtures. Do NOT run a whole-repo format.
- `.prettierignore` excludes `/dist`, `/coverage`, `/.nx`, `/.planning/`, lockfiles, and
  specific whitespace-sensitive Angular template fixtures whose reflow changes which NG
  diagnostics fire (e.g. `fixtures/extended-batch-fn/error.component.html`).

**Linting:**

- ESLint 9 FLAT config (`eslint.config.mjs`), NOT legacy `.eslintrc`. Root config composes
  `@nx/eslint-plugin` presets. The plugin project extends the root and adds project-scoped rules.
- `maxWarnings: 0` is baked into `@nx/eslint:lint` targetDefaults in `nx.json` -- a single
  warning fails CI. No CI flag is passed; the default carries it.
- `@nx/enforce-module-boundaries` (error) governs cross-project imports.
- `@nx/dependency-checks` (error) polices the published `package.json` deps/peers, with
  `checkVersionMismatches: false` so autofix never rewrites the public peer ranges
  (`^22.0.0`) to the installed exact versions. NEVER run `eslint --fix` on the manifest.
- `@nx/nx-plugin-checks` (error) validates `executors.json` / `generators.json` shapes.
- JSON is parsed with `jsonc-eslint-parser` in the config's `languageOptions`.

## Import Organization

Imports are grouped with a blank line between groups, in this order:

1. Node built-ins, always `node:`-prefixed: `import { dirname, join } from 'node:path';`
2. External type-only imports: `import type ts from 'typescript';`
3. External/workspace value imports: `import { describe, expect, it, vi } from 'vitest';`,
   `import { logger } from '@nx/devkit';`, `import { findWorkspaceRoot } from '@workspace/test-util';`
4. Local type + value imports (`./` relative): `import { runTypecheck } from './run-typecheck';`

Additional rules:

- Use `import type` for type-only imports even though `verbatimModuleSyntax: false`
  (the plugin tsconfig sets it false so the CJS `await import()` bridge type-checks).
- Path aliases (from `tsconfig.base.json`): `angular-typechecker` (the barrel),
  `@workspace/test-util`, `@fixtures/typecheck-consumer-dep`. Specs import the public
  barrel or a relative sibling, never deep-reach into another project.

## Error Handling

- Distinguish INFRASTRUCTURE failures from TYPE errors. A compiler crash surfaces as a
  `TypecheckInfrastructureError` (a real type-checker that swallows an unknown failure and
  reports success is worse than none).
- Detect infrastructure by DIAGNOSTIC CODE only (`ng.UNKNOWN_ERROR_CODE` === 500), NEVER by
  `source` or message text. This code-only discipline is applied at three stages
  (config parse, walk union, post-compile) in `core/run-typecheck.ts`.
- The executor adapter is the ONLY place that catches: it narrows `instanceof
  TypecheckInfrastructureError` -> `logger.error` + `{ success: false }`, and RE-THROWS every
  other error (`executor.ts`).
- e2e process helpers rethrow with captured stdout+stderr so a failed nested `nx`/`npm`
  surfaces WHY (`sh` in `libs/test-util/src/lib/e2e-process.ts`); `execSync` throwing on
  non-zero exit is the mechanism used to capture exit codes.

## Logging

- Framework: `@nx/devkit`'s `logger` (`logger.error` / `logger.warn` / `logger.info`).
- STRICT boundary: only the executor adapter tier touches `logger`. The framework-agnostic
  `core/**` is forbidden from `console` (ESLint `no-console: error`) and `process.exit`
  (`no-restricted-properties`). Core only COUNTS and RECORDS structured advisory fields;
  the adapter RENDERS them (the detection-vs-rendering split, D-11).
- The report itself is written to RAW `process.stdout.write` (never `logger.info`, which
  would prepend Nx chrome and corrupt byte-deterministic codeframes / problem-matcher parsing).

## Comments

**When to comment:**

- Heavy, deliberate block comments explaining WHY, not what. Decisions are referenced by
  stable ids (`D-01`, `RES-02`, `SB-09`, `COR-02`, `Pitfall 7`, `WR-01`) that trace back to
  `.planning/` artifacts. This is the dominant documentation style -- preserve it.
- Comments name landmines and load-bearing invariants explicitly (e.g. "MUST precede the
  zero-rootNames guard", "detect BY CODE only", "LOAD-BEARING").

**JSDoc/TSDoc:**

- Exported functions, classes, and interfaces carry `/** ... */` blocks describing purpose,
  invariants, and why the shape exists (see every export in `core/run-typecheck.ts`).
- Interface fields are documented inline with `//` comments tied to decision ids.

## Function Design

- Small, single-purpose module functions composed by an orchestrator (`runTypecheck`
  delegates to `handleSolutionWalk`, `finalize`, `buildFinalizeFilter`, `presentIfNonEmpty`).
- Functions are extracted specifically to stay under the cognitive-complexity budget
  (`handleSolutionWalk` was carved out of `runTypecheck` for this reason) -- fallow audits
  new complexity in CI (`.fallowrc.jsonc`, `fallow` job).
- Prefer explicit parameter objects (`CoreOptions`, `FinalizeFilter`) over long positional lists.
- Return `readonly` arrays in public result types (`CoreResult.diagnostics: readonly ts.Diagnostic[]`).
- Advisory array fields on `CoreResult` are PRESENT only when non-empty (`[]` maps to
  `undefined`), via the shared `presentIfNonEmpty` helper -- consumers branch on presence.

## Module Design

- The published plugin is CommonJS: `package.json` `"type": "commonjs"`, `main:
  "./src/index.js"`, `types: "./src/index.d.ts"`, `exports` map `{ ".": "./src/index.js",
  "./package.json": "./package.json" }`. Do NOT add a `module` field or `type: module`.
- Compiled with `module`/`moduleResolution: "nodenext"` (plugin `tsconfig.json`) so the
  dynamic `await import('@angular/compiler-cli')` (ESM-only) survives emit and is NOT
  downleveled to `require()`. Reach the ESM compiler-cli via `await import()`, never a static import.
- The public barrel (`src/index.ts`) exports ONLY `runTypecheck`,
  `TypecheckInfrastructureError`, and the `CoreOptions` / `CoreResult` / `SkippedReference`
  types. Engine internals stay unexported and free to change; the executor + generators are
  reached BY PATH via `executors.json` / `generators.json`, not the barrel.
- Dependencies: `@nx/devkit` is a pinned `dependency` (`23.0.1`); `@angular/compiler-cli`
  (`^22.0.0`) and `typescript` (`>=6.0.0 <6.1.0`) are `peerDependencies`; `tslib` is a
  dependency (paired with `importHelpers: true`). NEVER declare `nx` -- devkit's peer carries it.
- The `core/**` boundary is locked at lint time: it may not import `nx`, `@nx/*`,
  `@angular-devkit/*`, or a CLI arg parser (`yargs`), even type-only. Only the executor
  adapter (`executors/typecheck/`) and `normalize-options.ts` may import `@nx/devkit`.

---

*Convention analysis: 2026-07-09*
