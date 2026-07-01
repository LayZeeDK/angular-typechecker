# Phase 1: Workspace Bootstrap + Engine Spike (GATED) - Pattern Map

**Mapped:** 2026-06-27
**Files analyzed:** 14 new files (+ 1 bootstrap runbook, not a source file)
**Analogs found:** 13 / 14 (1 has no single analog -- see "No Analog Found")

> GREENFIELD NOTE: the repo currently holds only `.git/`, `.planning/`, `CLAUDE.md`. The Nx
> workspace is created DURING this phase, so the "closest existing analog" for every new file is
> in an EXTERNAL read-only reference clone, never in this repo. Each analog below is VERSION-BOUND:
> it must be re-validated against the locked stack (Nx 23.0.1 / Angular 22.0.4 / TypeScript 6.0.3).
> Most shapes were already extracted in `01-RESEARCH.md`; this map consolidates them into a single
> per-file analog table AND records the verification done this session against the cited sources.
>
> ALL excerpts below were re-verified against the live source files this session (line numbers
> confirmed, not copied blind from research). Verification deltas vs. `01-RESEARCH.md` are flagged
> inline as `[VERIFY DELTA]`.

## File Classification

| New file | Role | Data Flow | Closest external analog | Match quality |
|----------|------|-----------|-------------------------|---------------|
| `packages/angular-typechecker/src/core/compiler-loader.ts` | engine-core | transform (lazy ESM load) | `angular-cli .../angular-compilation.ts:34-38` (`loadCompilerCli`) | exact (shape) -- version-bound |
| `packages/angular-typechecker/src/core/gather-diagnostics.ts` | engine-core | transform (diagnostic aggregation) | sandbox `.../angular-typecheck/executor.ts:19-37` (`gatherAllDiagnostics`) | exact (shape) -- version-bound |
| `packages/angular-typechecker/src/core/run-typecheck.ts` | engine-core | request-response (config -> result) | sandbox `executor.ts:39-98` orchestration + `compiler-cli/.../perform_compile.ts:255-279` signature | role-match (recomposed) |
| `packages/angular-typechecker/src/index.ts` | engine-core (export surface) | n/a | nx-verdaccio `package.json main: ./src/index.js` (convention) | role-match |
| `packages/angular-typechecker/src/executors/angular-typecheck/executor.ts` | executor-adapter | request-response (Nx invoke) | nx-verdaccio `kill-process/executor.ts:17-19` (default-export signature) | exact (signature) |
| `packages/angular-typechecker/src/executors/angular-typecheck/schema.json` | config-manifest | n/a | nx-verdaccio `kill-process/schema.json` | exact -- simplify to 1 prop |
| `packages/angular-typechecker/src/executors/angular-typecheck/schema.d.ts` | config-manifest (type) | n/a | nx-verdaccio `kill-process/schema.ts` | exact |
| `packages/angular-typechecker/executors.json` | config-manifest | n/a | nx-verdaccio `executors.json` | exact -- 1 entry |
| `packages/angular-typechecker/package.json` | config-manifest | n/a | nx-verdaccio `package.json` (shape) + `01-RESEARCH.md` Phase-1 scope (D-14) | role-match -- see deps delta |
| `packages/angular-typechecker/project.json` | config-manifest | n/a | nx-verdaccio `project.json` (build asset-copy) | exact (build target) |
| `packages/angular-typechecker/tsconfig.json` | config-manifest | n/a | nx-verdaccio `tsconfig.json` + Analog `tsconfig.base.json` (module/deprecation) | role-match -- module PATCH |
| `packages/angular-typechecker/tsconfig.lib.json` | config-manifest | n/a | nx-verdaccio `tsconfig.lib.json` | exact -- add fixtures exclude |
| `packages/angular-typechecker/src/**/gate-a-static.spec.ts` | test-spec | file-I/O (read built artifact) | `01-RESEARCH.md` Code Examples (no external Vitest analog) | role-match (research-derived) |
| `packages/angular-typechecker/src/**/gate-b.spec.ts` | test-spec | request-response (drive core) | `01-RESEARCH.md` Code Examples + `perform_compile.ts` differential | role-match (research-derived) |
| `fixtures/gate-b-error/{error.component.ts,.html,tsconfig.app.json,tsconfig.lib.json}` | fixture | n/a (compiler input) | sandbox `test-fixtures.ts` injectors (NG8109 + TS2322) | exact (injected shapes) |

## Pattern Assignments

### `src/core/compiler-loader.ts` (engine-core, lazy ESM transform)

**Analog:** `D:/projects/github/angular/angular-cli/packages/angular/build/src/tools/angular/compilation/angular-compilation.ts:34-38`

**Verified this session.** Source reads:
```typescript
static async loadCompilerCli(): Promise<typeof ng> {
  AngularCompilation.#angularCompilerCliModule ??= await import('@angular/compiler-cli');

  return AngularCompilation.#angularCompilerCliModule;
}
// (loadTypescript at :40-44 follows the same ??= memoize-via-await-import shape)
```
The analog is a `static #private` class field; our core is a free function with a module-level
`let cached`. Same memoize-via-`??=`-`await import()` shape, no class.

**Shape to follow:**
```typescript
import type * as ng from '@angular/compiler-cli';   // type-only -> no runtime require

let cached: typeof ng | undefined;

export async function loadCompilerCli(): Promise<typeof ng> {
  cached ??= await import('@angular/compiler-cli');

  return cached;
}
```

**Must CHANGE for the locked stack:**
- The analog imports `@angular/compiler-cli@22.1.0-next.1`; re-validate the `??= await import(...)`
  emit against `@angular/compiler-cli@22.0.4` + `typescript@6.0.3`.
- The build MUST compile this under `module: "nodenext"` (NOT the generator default `commonjs`) so
  the literal `await import(` survives. This is the GATE A static-token line.
- Keep the literal substring `import(` OUT of comments in this file (the GATE A regex strips `//`
  lines, but avoid the trap) -- see Shared Pattern "GATE A static-token discipline".

---

### `src/core/gather-diagnostics.ts` (engine-core, diagnostic aggregation)

**Analog:** `D:/projects/sandbox/nx19-8-angular18-2-.../libs/nx-plugin/src/executors/angular-typecheck/executor.ts:19-37` (`gatherAllDiagnostics`)

**Verified this session.** The prototype's all-getter is exactly the 6-getter, no-short-circuit shape
(lines 19-37), and its getter ORDER + names match the v22 `Program` interface. The crucial getter
is the last one, `getNgSemanticDiagnostics()` (prototype line 34), which `ngc` skips.

**Shape to follow (ported verbatim; only the import style changes):**
```typescript
import type ts from 'typescript';
import type { Program } from '@angular/compiler-cli';

export function gatherAllDiagnostics(program: Program): readonly ts.Diagnostic[] {
  const all: ts.Diagnostic[] = [];

  all.push(...program.getTsOptionDiagnostics());
  all.push(...program.getNgOptionDiagnostics());
  all.push(...program.getTsSyntacticDiagnostics());
  all.push(...program.getTsSemanticDiagnostics());     // surfaces TS2322
  all.push(...program.getNgStructuralDiagnostics());
  all.push(...program.getNgSemanticDiagnostics());     // surfaces NG8109 -- the getter ngc skips

  return all;
}
```

**Must CHANGE for the locked stack:**
- The prototype uses a STATIC `import { ... Program } from '@angular/compiler-cli'` (executor.ts:2-8)
  -- the v22 `ERR_REQUIRE_ESM` break. Use `import type { Program }` here (type-only erases at emit);
  the only runtime value-import of compiler-cli lives in `compiler-loader.ts`.
- Re-validate all six getter names against `@angular/compiler-cli@22.0.4` `Program`
  (`src/transformers/api.ts:178-253`, confirmed in research at v22.1.0-next.3 -- same major).

---

### `src/core/run-typecheck.ts` (engine-core, config -> structured result)

**Analogs:** sandbox `executor.ts:39-98` (orchestration: `readConfiguration` -> spread `noEmit:true`
-> `performCompilation({ rootNames, options, emitFlags: 0 as EmitFlags, gatherDiagnostics })`) AND
`D:/projects/github/angular/angular/packages/compiler-cli/src/perform_compile.ts:255-279` (the
`performCompilation` destructured-options signature).

**Verified this session.** `performCompilation` signature (perform_compile.ts:255-279) takes a single
destructured object `{ rootNames, options, ..., gatherDiagnostics = defaultGatherDiagnostics,
emitFlags = api.EmitFlags.Default, ... }` and returns `PerformCompilationResult`. The prototype's
call (executor.ts:65-70) matches: `{ rootNames, options: compilerOptions, emitFlags: 0 as EmitFlags,
gatherDiagnostics: gatherAllDiagnostics }`.

**Shape to follow (recomposed -- the prototype embeds this in the executor; we LIFT it into core):**
```typescript
import type ts from 'typescript';
import { loadCompilerCli } from './compiler-loader';
import { gatherAllDiagnostics } from './gather-diagnostics';

export interface CoreOptions { tsConfigPath: string; }
export interface CoreResult {
  diagnostics: readonly ts.Diagnostic[];
  codes: number[];          // code-based assertions (D-17): 2322, 8109
  errorCount: number;
  warningCount: number;
  durationMs: number;       // cold-run timing (gate item 6)
}

export async function runTypecheck(options: CoreOptions): Promise<CoreResult> {
  const ng = await loadCompilerCli();                       // GATE A runtime path
  const parsed = ng.readConfiguration(options.tsConfigPath);
  const start = performance.now();
  const result = ng.performCompilation({
    rootNames: parsed.rootNames,
    options: { ...parsed.options, noEmit: true },           // fresh options object per call
    emitFlags: 0 as ng.EmitFlags,
    gatherDiagnostics: gatherAllDiagnostics,
  });
  const durationMs = performance.now() - start;
  // errorCount via DiagnosticCategory.Error; codes = diagnostics.map(d => d.code)
  return { diagnostics: result.diagnostics, codes: result.diagnostics.map(d => d.code),
           errorCount: /* ... */ 0, warningCount: /* ... */ 0, durationMs };
}
```

**Must CHANGE for the locked stack:**
- The prototype lives ENTIRELY inside the executor (couples `@nx/devkit` + compiler-cli). Phase 1
  splits per the core/adapter rule: this file has ZERO `@nx/devkit` import; the adapter is thin.
- The prototype STATIC-imports `readConfiguration`/`performCompilation`/`EmitFlags` (executor.ts:2-8)
  -- replace with the `ng.*` namespace returned by `loadCompilerCli()` (the memoized `await import()`).
- The prototype filters `node_modules`/out-of-project diagnostics (executor.ts:72-79, 131-153) --
  DROP that here; out-of-project filtering is DEFERRED to Phase 3 (OUT-02, D-10).
- IMPORTANT (research Open Question 1): build `parsed` ONCE, then spread into a FRESH `options`
  object per `performCompilation` call so the differential's two calls do not share mutated option
  state (`noEmit`). `performCompilation` builds a fresh `NgtscProgram` each call (perform_compile.ts:291).
- `0 as EmitFlags` is the prototype's idiom (executor.ts:68) and is correct (emitFlags default is
  `api.EmitFlags.Default`, perform_compile.ts:264) -- explicitly pass `0`.

---

### `src/executors/angular-typecheck/executor.ts` (executor-adapter, GATE A artifact)

**Analog:** `D:/projects/github/push-based/nx-verdaccio/.../kill-process/executor.ts:17-19` (default-export signature)

**Verified this session.** nx-verdaccio's default export:
```typescript
export default async function runKillProcessExecutor(
  options: KillProcessExecutorOptions
): Promise<ExecutorOutput> {   // ExecutorOutput = { success: boolean; ... }
```
The signature convention is `export default async function (options, context?): Promise<{ success }>`.
nx-verdaccio omits the `context` param (unused); ours takes it but prefixes `_context`.

**Shape to follow:**
```typescript
import type { ExecutorContext } from '@nx/devkit';
import type { AngularTypecheckExecutorOptions } from './schema';
import { runTypecheck } from '../../core/run-typecheck';

export default async function angularTypecheckExecutor(
  options: AngularTypecheckExecutorOptions,
  _context: ExecutorContext,
): Promise<{ success: boolean }> {
  const result = await runTypecheck({ tsConfigPath: options.tsConfig });

  return { success: result.errorCount === 0 };
}
```

**Must CHANGE for the locked stack:**
- This is the ONLY tier that imports `@nx/devkit`; keep it thin (delegate to `runTypecheck`).
- This compiled `executor.js` is the file GATE A reads. It MUST be built under `module: nodenext`
  so the `await import(` (reached transitively via `runTypecheck` -> `compiler-loader`) is NOT
  downleveled to `require(`. The static-token regex runs against THIS artifact.
- `import type { ExecutorContext }` (type-only) so the adapter does not pull `@nx/devkit` runtime
  value-imports it does not use.

---

### `src/executors/angular-typecheck/schema.json` + `schema.d.ts` (config-manifest)

**Analog:** nx-verdaccio `.../kill-process/schema.json` + `.../kill-process/schema.ts`

**Verified this session.** schema.json uses `"$schema": "http://json-schema.org/schema"`, `"$id"`,
`"type": "object"`, a `properties` map (with `aliases`), and `"additionalProperties": true`.
schema.ts hand-authors a matching `Partial<{ ... }>` type (Nx does NOT generate it).

**Shape to follow (minimal -- one `tsConfig` property for Phase 1):**
```jsonc
// schema.json
{
  "$schema": "http://json-schema.org/schema",
  "$id": "AngularTypecheckExecutorOptions",
  "title": "Angular type-check executor",
  "type": "object",
  "properties": {
    "tsConfig": { "type": "string", "description": "Path to the tsconfig to type-check" }
  },
  "required": ["tsConfig"],
  "additionalProperties": false
}
```
```typescript
// schema.d.ts  (matching hand-authored type; cli: "nx" convention belongs in executors.json/schema)
export interface AngularTypecheckExecutorOptions {
  tsConfig: string;
}
```

**Must CHANGE vs. the analog:**
- nx-verdaccio uses `"additionalProperties": true` (lenient); for a strict typed tool use `false`
  (PROJECT.md convention -- "strict typed tool, `false` recommended").
- nx-verdaccio's type is `Partial<{...}>`; ours has a REQUIRED `tsConfig`, so a plain `interface`
  with a non-optional field + `"required": ["tsConfig"]` in JSON.
- Full schema (normalize-options, multiple props, cacheable wiring) is DEFERRED to Phase 4 (EXE-01).

---

### `executors.json` (config-manifest)

**Analog:** nx-verdaccio `executors.json`

**Verified this session.** Each entry: `"implementation": "./src/executors/<name>/executor"`
(extensionless), `"schema": "./src/executors/<name>/schema.json"`, `"description"`.

**Shape to follow (one entry):**
```jsonc
{
  "executors": {
    "angular-typecheck": {
      "implementation": "./src/executors/angular-typecheck/executor",
      "schema": "./src/executors/angular-typecheck/schema.json",
      "description": "Type-checks an Angular project (TS + template + extended NG8xxx) with no emit."
    }
  }
}
```
The `@nx/plugin:plugin`/`:executor` generator auto-emits this + the build asset-copy glob; verify
the generated shape matches, then trim to one entry.

---

### `project.json` (config-manifest, build asset-copy)

**Analog:** nx-verdaccio `project.json` (build target)

**Verified this session.** The `@nx/js:tsc` build target globs the executor manifests into the
output:
```jsonc
"build": {
  "executor": "@nx/js:tsc",
  "outputs": ["{options.outputPath}"],
  "options": {
    "outputPath": "{projectName}/dist",          // nx-verdaccio value; ours is generator-derived
    "main": "{projectRoot}/src/index.ts",
    "tsConfig": "{projectRoot}/tsconfig.lib.json",
    "assets": [
      "{projectRoot}/*.md",
      { "input": "{projectRoot}/src", "glob": "**/!(*.ts)", "output": "./src" },
      { "input": "{projectRoot}/src", "glob": "**/*.d.ts",  "output": "./src" },
      { "input": "{projectRoot}",     "glob": "executors.json", "output": "." }
    ]
  }
}
```

**Must CHANGE for the locked stack:**
- DERIVE the GATE A `dist` path from the GENERATED `build.options.outputPath` (research Open
  Question 2) -- do NOT hard-code nx-verdaccio's `{projectName}/dist`. The `@nx/plugin` generator
  under `packages/angular-typechecker` may wire a different `outputPath`
  (likely `dist/packages/angular-typechecker`); read the generated value and compute the spec path.
- Use `@nx/vitest:test` for the test target (NOT nx-verdaccio's `unit-test`/`int-test` custom
  targets -- those are its own conventions); the `--unitTestRunner=vitest` generator emits this.
- The `schema.json` files are copied by the `**/!(*.ts)` glob (no extra asset entry needed).

---

### `tsconfig.json` + `tsconfig.lib.json` (config-manifest -- the load-bearing PATCH)

**Analogs:** nx-verdaccio `tsconfig.json` / `tsconfig.lib.json` (layout) + Analog `tsconfig.base.json`
(module + deprecation handling for Angular 22 / TS 6).

**Verified this session.**
- nx-verdaccio `tsconfig.json`: `"module": "CommonJS"`, `"target": "ES2018"`,
  `"verbatimModuleSyntax": false`, `files: []`, `include: []`, `references` -> lib + spec.
  **`module: "CommonJS"` here is the Nx-22-era shape RESEARCH FLAGS AS DEPRECATED -- do NOT copy it.**
- nx-verdaccio `tsconfig.lib.json`: `extends ./tsconfig.json`, `declaration: true`, `types: ["node"]`,
  `resolveJsonModule: true`, `outDir: ../../dist/out-tsc`, `include: ["src/**/*.ts"]`, and an
  `exclude` list of all `*.spec.ts`/`*.test.ts`/mock files.
- Analog `tsconfig.base.json:7,11,18`: `"moduleResolution": "bundler"`, `"importHelpers": true`,
  `"ignoreDeprecations": "6.0"` -- the Angular 22 / TS 6 base shape.

**Shape to follow (AFTER the Pitfall-1 patch):**
```jsonc
// tsconfig.json (solution)
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "nodenext",            // PATCHED from generator default "commonjs" -- the GATE A line
    "moduleResolution": "nodenext",
    "verbatimModuleSyntax": false,   // keeps the await import() bridge type-checking (nx-verdaccio convention)
    "ignoreDeprecations": "6.0"      // carry if older option shapes appear on TS 6 (Analog base sets it)
  },
  "files": [],
  "include": [],
  "references": [{ "path": "./tsconfig.lib.json" }, { "path": "./tsconfig.spec.json" }]
}
// tsconfig.lib.json: declaration:true, types:["node"], outDir, resolveJsonModule:true,
//   include ["src/**/*.ts"], EXCLUDE "src/**/*.spec.ts" AND the fixtures dir.
```

**Must CHANGE for the locked stack (this is the single most load-bearing edit in the phase):**
- The `@nx/plugin:plugin` generator under `--preset=apps` emits `"module": "commonjs"`
  (`@nx/js` `library.ts:1132`, research-verified). Building as-is downlevels `await import()` to
  `require()` -> GATE A NO-GO. ADD an explicit Edit task setting `module: "nodenext"` +
  `moduleResolution: "nodenext"`. Idempotent (set regardless of generated value).
- Do NOT copy nx-verdaccio's `module: "CommonJS"` / `target: "ES2018"` -- Nx-22-era; the package
  manifest stays `type: "commonjs"`, but the tsconfig `module` is `nodenext`.
- `tsconfig.lib.json` `exclude` MUST list the out-of-graph `fixtures/gate-b-error/` dir so the
  deliberate-error fixture is never compiled into the package (D-13).

---

### `src/**/gate-a-static.spec.ts` (test-spec, reads built artifact)

**Analog:** none external -- shape is `01-RESEARCH.md` Code Examples (GATE A static check). Vitest
`describe/it/expect` + `node:fs`/`node:path`.

**Shape to follow:**
```typescript
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

// DERIVE this path from project.json build.options.outputPath (do not hard-code -- Open Q 2)
const BUILT = join(__dirname, '../../../../dist/.../executors/angular-typecheck/executor.js');

describe('GATE A static', () => {
  it('built executor retains literal import( and never require()s compiler-cli', () => {
    const code = readFileSync(BUILT, 'utf-8')
      .split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n');  // strip comments
    expect(code).toMatch(/import\(/);
    expect(code).not.toMatch(/require\(["']@angular\/compiler-cli/);
  });
});
```

**Must CHANGE / WATCH:**
- `dist/` is gitignored -> use `fs.readFileSync` (or `rg -uu`), NEVER `git grep` (silent zero matches).
- Build MUST run before this spec (sampling-rate note: `nx build` precedes GATE A static).
- Compute `BUILT` from the generated `outputPath`, not a literal.

---

### `src/**/gate-b.spec.ts` (test-spec, drives core -- positive + differential + breadth + runtime + timing)

**Analog:** `01-RESEARCH.md` Code Examples (GATE B) + the differential proof from
`perform_compile.ts:328-362` (`defaultGatherDiagnostics` `&&`-chain).

**Verified this session.** `defaultGatherDiagnostics` (perform_compile.ts:339-359) is an `&&`-chain
where `checkOtherDiagnostics` flips false after `getTsSemanticDiagnostics()` yields a TS error, so the
final term `getNgSemanticDiagnostics()` (line 358-359) is NEVER evaluated -> NG8109 suppressed. The
all-getter pushes it unconditionally. THIS is the differential the spec asserts.

**Shape to follow:**
```typescript
import { describe, it, expect } from 'vitest';
import { loadCompilerCli } from '../core/compiler-loader';
import { gatherAllDiagnostics } from '../core/gather-diagnostics';

async function codesFor(tsConfigPath: string, useDefault: boolean): Promise<number[]> {
  const ng = await loadCompilerCli();                          // GATE A runtime: no ERR_REQUIRE_ESM
  const parsed = ng.readConfiguration(tsConfigPath);
  const result = ng.performCompilation({
    rootNames: parsed.rootNames,
    options: { ...parsed.options, noEmit: true },              // FRESH options object per call (Open Q 1)
    emitFlags: 0 as ng.EmitFlags,
    gatherDiagnostics: useDefault ? ng.defaultGatherDiagnostics : gatherAllDiagnostics,
  });
  return result.diagnostics.map(d => d.code);
}

describe.each([['app tsconfig', APP_TSCONFIG], ['local-library tsconfig', LIB_TSCONFIG]])(
  'GATE B on %s', (_label, tsConfigPath) => {
    it('all-getter surfaces BOTH 2322 and 8109 (positive)', async () => {
      const codes = await codesFor(tsConfigPath, false);
      expect(codes).toContain(2322); expect(codes).toContain(8109);
      expect(codes).not.toContain(500);                        // no UNKNOWN_ERROR_CODE (GATE A runtime)
    });
    it('defaultGatherDiagnostics surfaces 2322 but NOT 8109 (differential)', async () => {
      const codes = await codesFor(tsConfigPath, true);
      expect(codes).toContain(2322); expect(codes).not.toContain(8109);
    });
  });
```

**Must CHANGE / WATCH:**
- Assert on CODES `2322` + `8109`, NOT severity (extended diagnostics default to WARNING category,
  `compiler.ts:1056`).
- Assert `not.toContain(500)` -- a failed `await import()` is caught by `performCompilation` and
  surfaced as `code: UNKNOWN_ERROR_CODE` (perform_compile.ts:317-324, `UNKNOWN_ERROR_CODE = 500`
  confirmed at `api.ts:14`). 500 means the ESM load failed, not a real diagnostic (Pitfall 6).
- Run for BOTH an app tsconfig AND a local-library tsconfig (`describe.each`, gate item 5).
- Record one cold-run `durationMs` (gate item 6) -- the core returns it.
- Build the two gatherer calls from the SAME parsed config, only the gatherer differs.

---

### `fixtures/gate-b-error/*` (fixture -- the deliberate co-located TS2322 + NG8109 component)

**Analog:** `D:/projects/sandbox/.../angular-typecheck/test-fixtures.ts` -- `injectTypeScriptError`
(:290-309) and `injectInterpolatedSignalNotInvokedError` (:769-803).

**Verified this session.** The prototype injectors confirm both error shapes:
- TS2322: `injectTypeScriptError` adds `count: number = 'not a number';` (test-fixtures.ts:304).
- NG8109: `injectInterpolatedSignalNotInvokedError` imports `signal`, adds
  `statusSignal = signal('ready');` (test-fixtures.ts:793), and a template `<p>{{ statusSignal }}</p>`
  (test-fixtures.ts:800) -- signal interpolated but NOT invoked.

**[VERIFY DELTA] vs. `01-RESEARCH.md`:** the research fixture (RESEARCH lines 487-502) names the signal
`status` and uses `templateUrl: './error.component.html'`; the PROTOTYPE injector names it
`statusSignal` and the template is `{{ statusSignal }}`. Both trigger NG8109 identically -- the
property name is cosmetic. Use the research's `status`/`templateUrl` shape (committed file, not an
AST injection), but the SIGNAL name must match between `.ts` and `.html`.

**Shape to follow:**
```typescript
// fixtures/gate-b-error/error.component.ts  (OUT OF GRAPH; nothing imports it)
import { Component, signal } from '@angular/core';

@Component({
  selector: 'gate-b-error',
  standalone: true,
  templateUrl: './error.component.html',
})
export class GateBErrorComponent {
  count: number = 'not a number';     // TS2322 (matches prototype injectTypeScriptError)
  status = signal('ready');           // interpolated un-invoked below -> NG8109
}
```
```html
<!-- error.component.html -->
<p>{{ status }}</p>   <!-- NG8109 INTERPOLATED_SIGNAL_NOT_INVOKED: must be status(), here status -->
```
```jsonc
// tsconfig.app.json (the lib variant differs only in rootNames/include shape)
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true, "moduleResolution": "bundler" },
  "angularCompilerOptions": { "strictTemplates": true },   // set DIRECTLY (Pitfall 4)
  "files": ["error.component.ts"]
}
```

**Must CHANGE for the locked stack:**
- The prototype MUTATES generated library components at runtime via jscodeshift; Phase 1 ships a
  STATIC committed fixture (D-13). Port the error SHAPES, not the injection machinery.
- Set `angularCompilerOptions.strictTemplates: true` DIRECTLY in the fixture tsconfig (most-derived
  wins; the `extends` chain reverse-merges `angularCompilerOptions`, Pitfall 4). It defaults to
  `true` unless explicitly `false` (`compiler.ts:1056`), but make it explicit (self-contained).
- The fixture dir MUST be EXCLUDED from the project graph AND no workspace file may import it
  (TS `exclude` does not stop type-checking of imported files -- TS #36017, D-13). The
  `ng-spike-app` green-smoke assertion is the backstop.
- Provide BOTH `tsconfig.app.json` and `tsconfig.lib.json` variants (gate item 5 -- one app + one
  lib tsconfig); same component, only `files`/`include`/lib-style `rootDir` differ.
- Re-validate NG8109 fires on STABLE `@angular/compiler-cli@22.0.4` (prototype was Angular 18; D-18).

## Shared Patterns

### Core/adapter split (zero-`@nx/devkit` core)
**Source:** ARCHITECTURE.md + the prototype's coupling as the ANTI-pattern (sandbox `executor.ts`
mixes `@nx/devkit` + compiler-cli in one file).
**Apply to:** all `src/core/*.ts` files (no `@nx/devkit`, no CLI imports) and the executor adapter
(the ONLY file importing `@nx/devkit`, kept thin -> delegates to `runTypecheck`).

### Memoized `await import()` ESM bridge
**Source:** `angular-cli .../angular-compilation.ts:34-38`.
**Apply to:** `compiler-loader.ts` is the SINGLE runtime value-import of `@angular/compiler-cli`;
every other core file uses `import type` only. Compiled under `module: nodenext`.

### GATE A static-token discipline
**Source:** D-12 + research NOTE (RESEARCH:250) -- a naive `import(` match hit a COMMENT line.
**Apply to:** `compiler-loader.ts`, `executor.ts` (keep the literal `import(` out of comments); the
GATE A spec strips `//` lines before matching. `dist/` is gitignored -> `fs.readFileSync`, never
`git grep`.

### Assert on diagnostic CODE, not severity
**Source:** `compiler.ts:1056` (extended diagnostics default to WARNING).
**Apply to:** `gate-b.spec.ts` -- `expect(codes).toContain(8109)`, never `errorCount`-based for NG8109.

### `@nx/js:tsc` asset-copy for executor manifests
**Source:** nx-verdaccio `project.json:15-32`.
**Apply to:** `project.json` build target -- the `**/!(*.ts)` glob copies `schema.json`; the explicit
`executors.json -> .` entry copies the manifest. Generator auto-injects these.

### `type: "commonjs"` package + `module: "nodenext"` tsconfig (the deliberate split)
**Source:** D-11/D-14 + Nx #18801 (research Pitfall 2) -- `@nx/js:tsc`'s
`determineModuleFormatFromTsConfig` READS `module` only to LABEL cjs/esm; it does NOT reassign it.
**Apply to:** `package.json` `type: "commonjs"` (DELIBERATE) alongside tsconfig `module: "nodenext"`.
With this pairing the label is `cjs` AND the emit keeps a literal `import(` -- both correct.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `package.json` (deps section) | config-manifest | n/a | nx-verdaccio's deps are the REJECTED model: it declares `nx: "22.3.1"` + `@nx/plugin` as DIRECT dependencies and `@nx/js` as a peer. Phase 1 (D-14) declares ONLY `@nx/devkit@23.0.1` (pinned dep) + `tslib`, with `@angular/compiler-cli`/`typescript` as PEER RANGES and NO `nx`. The package.json SHAPE (type/main/types/executors/files) matches nx-verdaccio; the dependency CLASSIFICATION is original to this project. Use the `01-RESEARCH.md` Phase-1 `package.json` block (RESEARCH:565-585) as the authority, NOT nx-verdaccio's deps. `files`/`exports`/`keywords` DEFERRED to Phase 5. |

> Note: `src/index.ts` (export surface) and the two Vitest gate specs have only convention-level
> analogs (nx-verdaccio `main: ./src/index.js`; research Code Examples) -- they are listed under
> Pattern Assignments with research-derived shapes rather than here, since a usable pattern exists.

## Metadata

**Analog search scope:**
- `D:/projects/github/push-based/nx-verdaccio/projects/nx-verdaccio/` (Nx 22.3.1 published plugin)
- `D:/projects/github/angular/angular-cli/packages/angular/build/` (v22.1.0-next.1 -- engine model)
- `D:/projects/github/angular/angular/packages/compiler-cli/` (v22.1.0-next.3 -- signatures + differential)
- `D:/projects/sandbox/nx19-8-angular18-2-.../libs/nx-plugin/src/executors/angular-typecheck/` (Angular 18.2 prototype -- version-bound)
- `D:/projects/github/analogjs/analog/tsconfig.base.json` (Angular 22 / TS 6 base shape)

**Files scanned (read this session):** 14 source files across the 5 clones; all key excerpts cited
in `01-RESEARCH.md` re-verified against the live source (line numbers confirmed).

**Verification deltas found vs. 01-RESEARCH.md:** 1 cosmetic (NG8109 fixture signal name
`status` [research] vs `statusSignal` [prototype injector] -- both fire NG8109; flagged inline).
No load-bearing discrepancy found; `performCompilation` signature, `defaultGatherDiagnostics`
`&&`-chain, `UNKNOWN_ERROR_CODE = 500`, the prototype all-getter + injectors, and the Analog/
nx-verdaccio tsconfig shapes all confirmed.

**Pattern extraction date:** 2026-06-27
