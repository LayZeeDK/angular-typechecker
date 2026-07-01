# Phase 3: Filtering, Modes, Output + Quality Gates - Pattern Map

**Mapped:** 2026-06-28
**Files analyzed:** 9 (3 new modules + 3 new specs + 2 edited source/config + 1 extended spec, plus an optional fixture)
**Analogs found:** 9 / 9 (every new/edited file has a same-repo Phase-2 analog -- this is an in-place grow, not greenfield)

> All analogs are existing Phase-2 files in THIS public repo. Do NOT import any external/private prior-art. The
> `D:/projects/sandbox/...executor.ts` filter is the documented ANTI-PATTERN (naive `toLowerCase()`/`startsWith`/
> `includes('node_modules')`) -- it is referenced only to show what NOT to copy.

## File Classification

| New/Modified File                                       | Role                              | Data Flow        | Closest Analog                                                                                                              | Match Quality |
| ------------------------------------------------------- | --------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `src/core/filter-diagnostics.ts`                        | pure function (core)              | transform        | `src/core/gather-diagnostics.ts` (+ `diagnostic-codes.ts` for dep-free pure-helper style)                                   | exact (role)  |
| `src/core/evaluate-result.ts`                           | pure function (core)              | transform        | `src/core/diagnostic-codes.ts` (dep-free pure module) + `finalize` in `run-typecheck.ts` (counts)                           | exact (role)  |
| `src/core/format-report.ts`                             | pure function (core)              | transform        | `src/core/gather-diagnostics.ts` (typed input over `ts.Diagnostic[]`) + `compiler-cli-types.ts` (`CompilerCli`/`ts` typing) | exact (role)  |
| `src/core/filter-diagnostics.spec.ts`                   | test (unit, pure)                 | n/a              | `src/core/gather-diagnostics.spec.ts` (hand-built `ts.Diagnostic[]`)                                                        | exact         |
| `src/core/evaluate-result.spec.ts`                      | test (unit, pure)                 | n/a              | `src/core/gather-diagnostics.spec.ts`                                                                                       | exact         |
| `src/core/format-report.spec.ts`                        | test (unit, pure)                 | n/a              | `src/core/gather-diagnostics.spec.ts`                                                                                       | exact         |
| `src/core/run-typecheck.ts` (EDIT)                      | engine seam (core)                | request-response | itself (`finalize` + `CoreOptions`/`CoreResult`) -- extend in place                                                         | exact (self)  |
| `packages/angular-typechecker/eslint.config.mjs` (EDIT) | config (flat ESLint)              | n/a              | itself + root `eslint.config.mjs` `no-restricted-imports`/`patterns` shape                                                  | exact (self)  |
| `src/core/run-typecheck.integration.spec.ts` (EXTEND)   | test (integration, real compiler) | n/a              | itself + `config-resolution.integration.spec.ts` (fixture-path + `describe.each` idiom)                                     | exact (self)  |
| `fixtures/<sibling-import>/...` (OPTIONAL NEW)          | fixture                           | n/a              | `fixtures/gate-b-error/` (component + `tsconfig.app.json`)                                                                  | exact         |

---

## Pattern Assignments

### `src/core/filter-diagnostics.ts` (pure function, transform)

**Analog:** `src/core/gather-diagnostics.ts` (pure fn over a typed input, dep-free at runtime, `import type` only)
plus `src/core/diagnostic-codes.ts` (the "production-importable, intentionally DEPENDENCY-FREE" pure-helper module).

**Import style to replicate** (`gather-diagnostics.ts:1-3`) -- type-only `ts` import, local type-only import; NO
runtime `@angular/compiler-cli`/`typescript`/devkit import (D-11 will lint-ban devkit family here):

```typescript
import type ts from 'typescript';

import type { Program } from './compiler-cli-types';
```

For the filter, the RESEARCH Pattern 1 shape is `import type ts from 'typescript';` only -- the function takes
`useCaseSensitiveFileNames: boolean` and an injected `realpath: (p: string) => string` (so tests pass identity and
never touch the FS). Keep it dep-free like `diagnostic-codes.ts`.

**Export style to replicate** (`gather-diagnostics.ts:15-28`) -- a single named `export function`, `readonly
ts.Diagnostic[]` in, a typed value out; exported `interface` for options/result (mirror `CoreOptions`/`CoreResult`
in `run-typecheck.ts:10-33`):

```typescript
export function gatherAllDiagnostics(program: Program): readonly ts.Diagnostic[] {
  const all: ts.Diagnostic[] = [];
  all.push(...program.getTsOptionDiagnostics());
  // ...
  return all;
}
```

New shape (from RESEARCH Pattern 1/2): `export interface FilterOptions { basePath; includeDeps;
useCaseSensitiveFileNames; realpath }`, `export interface FilterResult { kept: ts.Diagnostic[]; suppressedCount:
number }`, `export function filterDiagnostics(diagnostics, options): FilterResult`.

**What to replicate:**

- The dep-free, `import type`-only header (this is what survives D-11's `core/**` ban with zero churn).
- The `for...of` accumulate-into-a-local-array shape (`const all: ts.Diagnostic[] = []` -> push -> return).
- The doc-comment-with-decision-citations style (`gather-diagnostics.ts:5-14` cites D-16; cite D-05/D-06/D-07 here).
- The CLAUDE.md JS/TS style: braces on every `if`/`for`, blank lines around control flow + `return`.

**Anti-pattern (do NOT copy):** the external `executor.ts` naive filter
(`toLowerCase()`/`startsWith(projectRoot)`/`includes('node_modules')`). Use realpath-first + case-fold + path-SEGMENT
containment (RESEARCH Pattern 2: `canonicalFile.split('/').includes('node_modules')`, `isUnderDir` with a
segment-bounded `dir + '/'` prefix). NEVER filter a `diagnostic.file === undefined` diagnostic (D-03 -- keep it).

---

### `src/core/evaluate-result.ts` (pure function, transform)

**Analog:** `src/core/diagnostic-codes.ts` (a tiny, dep-free, production-importable pure module) for the module
shape; the `finalize` counting in `run-typecheck.ts:206-228` for the category-count semantics it consumes.

**Import style to replicate** -- `diagnostic-codes.ts` has ZERO imports; `evaluate-result.ts` needs only a type-only
import of the result shape it reads (mirror `run-typecheck.ts:3-6` `import type { ... } from './...'`):

```typescript
// diagnostic-codes.ts has no imports at all -- a pure value module.
export const NG = (code: number): number => -990000 - code;
export const ngCodeOf = (code: number): number => Math.abs(code) - 990000;
```

New shape (RESEARCH Pattern 3): `import type { CoreResult } from './run-typecheck';` then `export interface
EvaluateOptions { maxWarnings?: number }` and `export function evaluateResult(result: Pick<CoreResult, 'errorCount' |
'warningCount'>, options: EvaluateOptions = {}): { success: boolean }`.

**Counting contract to honor** (`run-typecheck.ts:213-218`) -- `evaluateResult` reads the SAME explicitly-counted
`errorCount`/`warningCount` that `finalize` produces by `ts.DiagnosticCategory` (never `length - errorCount`):

```typescript
const errorCount = diagnostics.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error).length;
const warningCount = diagnostics.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Warning).length;
```

**What to replicate:**

- The dep-free pure-module shape of `diagnostic-codes.ts` (no runtime imports beyond `import type`).
- `Pick<CoreResult, ...>` so the verdict is decoupled from the full result shape (testable with a 2-field literal).
- Decision-cited doc comment (cite D-03/EXE-05). CLAUDE.md control-flow spacing + braces.
- Logic (D-03): errors ALWAYS fail; `maxWarnings !== undefined && warningCount > maxWarnings` fails; `maxWarnings: 0`
  fails on any warning. Treat negative/NaN `maxWarnings` defensively (RESEARCH Security V5).

---

### `src/core/format-report.ts` (pure function, transform)

**Analog:** `src/core/gather-diagnostics.ts` (typed-input pure fn) for the function shape; `compiler-cli-types.ts`
for how to type the injected `ng` (compiler-cli) surface and the `ts` namespace WITHOUT a runtime import.

**Type-injection style to replicate** (`compiler-cli-types.ts:35-45`) -- the `CompilerCli` interface is the precedent
for passing a typed compiler-cli surface in as a parameter rather than importing it (keeps `core/` dep-free + D-11
clean):

```typescript
export interface CompilerCli {
  readConfiguration: typeof readConfiguration;
  performCompilation: typeof performCompilation;
  // ...
}
```

New shape (RESEARCH Pattern 4): `formatReport(diagnostics: readonly ts.Diagnostic[], ng: Pick<CompilerCli,
'formatDiagnostics'>, ts_: typeof import('typescript'), options: FormatOptions): string`. Inject `ng` + `ts_` so the
function stays pure and the spec can pass a fake `formatDiagnostics` (no compiler mock -- D-13). NOTE:
`compiler-cli-types.ts` currently has NO `formatDiagnostics` member -- this file is the "MAYBE widen" target
(RESEARCH structure note): add `formatDiagnostics: typeof formatDiagnostics;` (type-only) to `CompilerCli` if the
`Pick` needs it.

**What to replicate:**

- The injected-dependency pattern (pass `ng`/`ts_` in) -- mirrors how `run-typecheck.ts` receives `ts`/`ng` from the
  loader rather than importing them at module scope; here they come in as params for purity.
- `export interface FormatOptions { pathBase?; color; failFast? }` (mirror the exported-interface convention).
- ANSI strip via a non-literal-control-char regex (RESEARCH Pattern 4: `new RegExp(String.fromCharCode(0x1b) +
'\\[[0-9;]*m', 'g')`) -- this also satisfies the CLAUDE.md "no non-ASCII / no literal control chars in source" rule.
- D-09 ordering: input is ALREADY sorted+deduped by `runTypecheck` (do the `ts.sortAndDeduplicateDiagnostics` in
  `finalize`, NOT here). D-10: strip ANSI when `color === false`. D-08: `makeFormatHost(ts_, pathBase)` with
  non-identity `getCanonicalFileName`, `getNewLine: () => '\n'`, ABSOLUTE default when `pathBase` unset.
- Reporter-layer fail-fast (D-04/EXE-03): truncate the REPORTED list at the first `ts_.DiagnosticCategory.Error`
  (`diagnostics.findIndex(...)` -> `slice(0, i + 1)`). NEVER a gather short-circuit.

**Anti-pattern (do NOT copy):** compiler-cli's `defaultFormatHost` (identity `getCanonicalFileName`, cwd-based
`getCurrentDirectory`) -- both are the documented determinism traps (D-08). Build OUR host.

---

### `src/core/{filter-diagnostics,evaluate-result,format-report}.spec.ts` (unit tests, pure)

**Analog:** `src/core/gather-diagnostics.spec.ts` -- the CANONICAL pure-function-with-hand-built-`ts.Diagnostic[]`
idiom. This is the single most important test pattern for the phase (D-13).

**Hand-built diagnostic factory + import header to replicate** (`gather-diagnostics.spec.ts:1-11`):

```typescript
import type ts from 'typescript';

import type { Program } from './compiler-cli-types';

import { describe, expect, it, vi } from 'vitest';

import { gatherAllDiagnostics } from './gather-diagnostics';

function diagnostic(code: number): ts.Diagnostic {
  return { code } as ts.Diagnostic;
}
```

RESEARCH gives the Phase-3 factory variant (Code Examples / D-13) -- replicate this exactly for the specs:

```typescript
function diag(fileName: string | undefined, code = 2322): ts.Diagnostic {
  return {
    category: 0 /* ts.DiagnosticCategory.Error -- avoids importing the enum value */,
    code,
    file: fileName === undefined ? undefined : ({ fileName } as ts.SourceFile),
    start: 0,
    length: 1,
    messageText: 'x',
  } as ts.Diagnostic;
}
```

**Fake-`Program` / stub style to replicate** (`gather-diagnostics.spec.ts:16-30`) -- build a structural object cast
`as unknown as Program` with `vi.fn` stubs; assert call order/codes off the return. For `filter-diagnostics.spec.ts`
no Program is even needed (inject `realpath: (p) => p` + `useCaseSensitiveFileNames: true`). For `format-report.spec.ts`
inject a fake `formatDiagnostics` stub (`vi.fn`) and the real `ts` module for `DiagnosticCategory`.

**Assertion style to replicate** (`gather-diagnostics.spec.ts:34-45`) -- `expect(result.map((d) => d.code)).toEqual([
...])`, `expect(...).toHaveBeenCalledOnce()`, `toContain`. RESEARCH Code Examples already spell out the exact
`filterDiagnostics` / `evaluateResult` assertions (lines ~458-495) -- mirror them.

**What to replicate:**

- One `describe(<functionName>, ...)` block per module, `it(<behavior + req-id>, ...)` cases (e.g.
  `'keeps in-project, suppresses out-of-project + node_modules (D-05/D-06)'`).
- `import type ts from 'typescript'` (type-only) + named `{ describe, expect, it, vi }` from `'vitest'`.
- NO `@angular/compiler-cli` mock anywhere in these three (D-13 payoff). For `format-report.spec.ts` assert
  idempotency (same input -> byte-identical output) and ANSI-stripped-when-`color:false`.

---

### `src/core/run-typecheck.ts` (engine seam -- EDIT IN PLACE)

**Analog:** itself. Extend the existing `CoreOptions`/`CoreResult` interfaces and the `finalize` helper; do not rewrite.

**`CoreOptions` extension point** (`run-typecheck.ts:10-12`):

```typescript
export interface CoreOptions {
  tsConfigPath: string;
}
```

-> add `includeDeps?: boolean;` (D-07, default false) and `pathBase?: string;` (D-08; `runTypecheck` IGNORES it -- the
adapter passes it to `formatReport`). Keep the doc-comment-with-citation convention used throughout this file.

**`CoreResult` extension point** (`run-typecheck.ts:21-33`) -- add `suppressedCount: number;` (D-02), keep the
existing field-comment style:

```typescript
export interface CoreResult {
  tsConfigPath: string;
  rootNamesCount: number;
  diagnostics: readonly ts.Diagnostic[];
  errorCount: number;
  warningCount: number;
  durationMs: number; // <- add `suppressedCount: number;` near here (D-02)
}
```

**`finalize` wiring point** (`run-typecheck.ts:206-228`) -- this is where the filter + sort + count compose. Current:

```typescript
function finalize(
  ts: typeof import('typescript'),
  tsConfigPath: string,
  rootNamesCount: number,
  diagnostics: readonly ts.Diagnostic[],
  start: number,
): CoreResult {
  const errorCount = diagnostics.filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  ).length;
  // ...
  return { tsConfigPath, rootNamesCount, diagnostics, errorCount, warningCount, durationMs: ... };
}
```

RESEARCH "`finalize` extension" note: insert, IN ORDER -- (1) `filterDiagnostics(diagnostics, ...)` ->
`{ kept, suppressedCount }`; (2) `ts.sortAndDeduplicateDiagnostics(kept)`; (3) count Error/Warning on the
SORTED+FILTERED set; (4) return with `suppressedCount`. The two call sites differ:

- Normal path (`run-typecheck.ts:114-162`): holds the live `result.program.getTsProgram()` host (for
  `useCaseSensitiveFileNames()`) and `parsed.options.basePath` -- pass them to the filter.
- Zero-rootNames guard path (`run-typecheck.ts:95-105`): NO `Program` -- there `suppressedCount = 0` and the single
  file-less guard diagnostic is never filtered. Keep two `finalize` shapes OR make the program/filter params optional
  so the guard path stays clean (RESEARCH).

**Loader-reuse precedent** (`run-typecheck.ts:230-241`) -- `loadTypescript()` memoizes `typeof ts`; reuse it where
`finalize` needs `ts.sortAndDeduplicateDiagnostics` (it already receives `ts` as its first param).

**What to replicate:** the existing decision-cited doc comments, the FRESH-options-object footgun guard style, and the
explicit-category counting (NEVER `length - errorCount`). Use `parsed.options.basePath` as the in-project baseline
(D-05), NEVER `parsed.options.rootDir` (RESEARCH correction: it is the workspace root in this `--preset=apps` repo).

---

### `packages/angular-typechecker/eslint.config.mjs` (config -- EDIT IN PLACE)

**Analog:** itself (the `...baseConfig` spread + per-`files` override block at lines 5-23) and the root
`eslint.config.mjs` `no-restricted-imports`-shaped block (the `@nx/enforce-module-boundaries` entry at lines 22-39
shows the `[ "error", { ... } ]` rule-options shape + the `files`-scoped block convention).

**Existing override-block shape to mirror** (`packages/angular-typechecker/eslint.config.mjs:5-23`):

```javascript
export default [
    ...baseConfig,
    {
        files: [
            "**/*.json"
        ],
        rules: {
            "@nx/dependency-checks": [
                "error",
                { "ignoredFiles": [ ... ] }
            ]
        },
        languageOptions: { parser: await import("jsonc-eslint-parser") }
    },
    // ... add the NEW core/** override block here
];
```

Add a NEW block AFTER the `...baseConfig` spread (RESEARCH D-11 block, lines ~502-530):

```javascript
{
  files: ['**/src/core/**/*.ts'],
  rules: {
    '@typescript-eslint/no-restricted-imports': [
      'error',
      {
        paths: [
          { name: 'nx', message: 'core/ is framework-agnostic: no Nx CLI/devkit imports (D-11).' },
          { name: '@nx/devkit', message: 'core/ must not import @nx/devkit (D-11).' },
          { name: '@angular-devkit/architect', message: 'core/ must not import the Angular CLI architect (D-11).' },
          { name: 'yargs', message: 'core/ must not import a CLI arg parser (D-11).' },
        ],
        patterns: [
          { group: ['@nx/*'], message: 'core/ must not import any @nx/* package (D-11).' },
          { group: ['@angular-devkit/*'], message: 'core/ must not import any @angular-devkit/* package (D-11).' },
        ],
      },
    ],
    'no-console': 'error',
    'no-restricted-properties': [
      'error',
      { object: 'process', property: 'exit', message: 'core/ must not call process.exit (D-11); the adapter owns exit.' },
    ],
  },
},
```

**What to replicate:**

- The flat-config array shape: spread base, then `{ files, rules, languageOptions? }` override objects.
- Scope to `**/src/core/**/*.ts` ONLY (do NOT hit the future Phase-4 adapter that legitimately imports `@nx/devkit`).
- Leave the existing `@nx/dependency-checks` + `@nx/nx-plugin-checks` blocks UNTOUCHED (D-12).
- Note the repo's existing config uses 4-space indent + double quotes; the ADDED block in RESEARCH uses 2-space +
  single quotes. Prettier (`singleQuote: true`) will normalize on `--write` -- match whatever `npx prettier --write`
  produces; lint must pass clean (SC5). `allowTypeImports` is OMITTED so type-only imports are also banned (D-11).

---

### `src/core/run-typecheck.integration.spec.ts` (integration test -- EXTEND IN PLACE)

**Analog:** itself + `src/core/config-resolution.integration.spec.ts` (the fixture-path + real-compiler idiom).

**Fixture-path resolution to replicate** (`run-typecheck.integration.spec.ts:19-24` /
`config-resolution.integration.spec.ts:32-52`):

```typescript
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspaceRoot = join(packageRoot, '..', '..');
const fixtureDir = join(workspaceRoot, 'fixtures', 'gate-b-error');
const appTsConfig = join(fixtureDir, 'tsconfig.app.json');
```

**Real-compiler assertion idiom to replicate** (`run-typecheck.integration.spec.ts:30-46`) -- `await
runTypecheck({ tsConfigPath })`, assert off `CoreResult`, use the local `NG()` helper for negative codes,
`describe.each` for multiple tsconfigs:

```typescript
const result = await runTypecheck({ tsConfigPath });
const codes = result.diagnostics.map((diagnostic) => diagnostic.code);
expect(codes).toContain(TS2322);
expect(codes).toContain(NG(8109));
```

**What to add** (RESEARCH Wave 0 / D-02): a case asserting `result.suppressedCount` and POST-filter
`errorCount`/`warningCount` on a fixture with an out-of-project (sibling) import; and a case asserting `includeDeps:
true` folds the suppressed diagnostics back (`suppressedCount: 0`). Also the discretion fixture (RESEARCH Pitfall 5):
assert TS6059 does NOT appear when a leaf tsconfig with a narrow `rootDir` includes a sibling import.

**What to replicate:** the `const NG = (code) => -990000 - code;` local helper (lines 17 / 30 in both specs), the
`describe.each([...])` table when covering app vs lib tsconfigs, the `flattenDiagnosticMessageText` helper
(`config-resolution.integration.spec.ts:54-56`) if asserting on message text.

---

### `fixtures/<sibling-import>/...` (OPTIONAL NEW fixture)

**Analog:** `fixtures/gate-b-error/` -- a component (`error.component.ts`) + a leaf `tsconfig.app.json`.

**Fixture tsconfig shape to replicate** (`fixtures/gate-b-error/tsconfig.app.json:1-16`):

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "target": "es2022",
    "module": "preserve",
    "moduleResolution": "bundler",
    "strict": true,
    "emitDecoratorMetadata": false,
    "experimentalDecorators": false
  },
  "angularCompilerOptions": { "strictTemplates": true },
  "files": ["error.component.ts"]
}
```

**Fixture source-file convention to replicate** (`fixtures/gate-b-error/error.component.ts:1-17`) -- a standalone
component, a header comment explaining it is OUT of the project graph (nothing imports it; kept out of the plugin
build by `tsconfig.lib.json` `include: ["src/**/*.ts"]`), NEVER `@ts-nocheck`.

**What to replicate / CRITICAL constraint:**

- Place the fixture under `fixtures/` (a DISCOVERED location). Nx silently does NOT discover projects under
  `tmp/`/`dist/`/`cache/`/`build/` or anything in `.gitignore` / `tsconfig.base.json` `exclude` (`["node_modules",
"tmp"]`) -- RESEARCH Landmine 5. Do NOT put the fixture in an excluded dir.
- For the D-02 scenario: a `main-lib` leaf project that imports a `dependency-lib` SIBLING via `paths` (lands OUTSIDE
  `basePath` -> suppressed by default; `includeDeps: true` surfaces it) -- the DIAGNOSTIC-CATALOG `main-lib` ->
  `dependency-lib` scenario the D-05 baseline must satisfy.

---

## Shared Patterns

### Pure, dependency-free `core/` module (the D-11-survivable shape)

**Source:** `src/core/gather-diagnostics.ts:1-3`, `src/core/diagnostic-codes.ts` (whole file, zero imports).
**Apply to:** all three new modules (`filter-diagnostics.ts`, `evaluate-result.ts`, `format-report.ts`).

```typescript
import type ts from 'typescript';

import type { Program } from './compiler-cli-types';
```

Type-only imports + injected runtime dependencies (`ng`/`ts_`/`realpath` passed as params). Zero `@nx/devkit`/`nx`/
`@angular-devkit/*`/`yargs` imports, zero `console`/`process.exit` -- exactly what the new D-11 ESLint override bans.

### Exported-interface + single-named-`export function` API

**Source:** `src/core/run-typecheck.ts:10-33` (`CoreOptions`/`CoreResult`), `src/core/gather-diagnostics.ts:15`.
**Apply to:** every new module exports its `*Options`/`*Result` interface + one named function.

```typescript
export interface CoreOptions { tsConfigPath: string; }
export interface CoreResult { /* documented fields */ }
export function gatherAllDiagnostics(program: Program): readonly ts.Diagnostic[] { ... }
```

### Explicit category counting (NEVER `length - errorCount`)

**Source:** `src/core/run-typecheck.ts:213-218`.
**Apply to:** `evaluate-result.ts` consumes these counts; any new counting in `finalize` filters by
`ts.DiagnosticCategory.Error` / `.Warning` explicitly. Invariant: `errorCount + warningCount <= diagnostics.length`.

### Hand-built `ts.Diagnostic` factory + `vi.fn` stubs (the unit-test idiom)

**Source:** `src/core/gather-diagnostics.spec.ts:9-11, 16-30`.
**Apply to:** all three new `.spec.ts` files. A `diag(...)` / `diagnostic(...)` factory casting a literal `as
ts.Diagnostic`; structural fakes cast `as unknown as Program`; NO `@angular/compiler-cli` mock (D-13).

```typescript
function diagnostic(code: number): ts.Diagnostic {
  return { code } as ts.Diagnostic;
}
```

### Decision-cited doc comments

**Source:** `src/core/run-typecheck.ts:14-20, 56-67`; `src/core/gather-diagnostics.ts:5-14`;
`src/core/diagnostic-codes.ts:1-24`.
**Apply to:** every new file -- a block comment naming the governing decision IDs (D-02..D-11) and the WHY, matching
the established density.

### Fixture-path resolution from spec location

**Source:** `src/core/run-typecheck.integration.spec.ts:19-24`, `config-resolution.integration.spec.ts:32-52`.
**Apply to:** the extended integration spec (and any new fixture references). `dirname(fileURLToPath(import.meta.url))`
-> `..`/`..` to packageRoot -> `..`/`..` to workspaceRoot -> `join(workspaceRoot, 'fixtures', ...)`.

### CLAUDE.md JS/TS style (project-wide, enforced)

**Source:** global user instructions + observed in every analog.
**Apply to:** all new/edited TS -- braces on EVERY `if`/`else`/`for`/`while` body (no braceless one-liners); blank
line before/after `if`/`for`/`return`/`try` etc. (except first/last line in a block); `singleQuote: true` (Prettier);
ASCII only, no literal control chars (the ANSI regex uses `String.fromCharCode(0x1b)`).

---

## No Analog Found

None. Every Phase-3 file maps to an existing Phase-2 analog in this repo. The only "new kind" of artifact is the
optional sibling-import fixture, and `fixtures/gate-b-error/` is a direct structural analog for it.

---

## Metadata

**Analog search scope:** `packages/angular-typechecker/src/core/**` (all 15 files), `packages/angular-typechecker/
eslint.config.mjs`, root `eslint.config.mjs`, `fixtures/**` (tsconfig + component conventions).
**Files scanned:** 12 read in full (run-typecheck.ts, gather-diagnostics.ts, gather-diagnostics.spec.ts,
diagnostic-codes.ts, compiler-cli-types.ts, run-typecheck.integration.spec.ts, config-resolution.integration.spec.ts,
both eslint.config.mjs, gate-b-error/tsconfig.app.json, gate-b-error/error.component.ts) + the full CONTEXT.md and
RESEARCH.md.
**Pattern extraction date:** 2026-06-28
**Repo visibility:** PUBLIC -- no private prior-art ("Connect") leaked; the external `executor.ts` is cited only as the
documented anti-pattern.

```

```
