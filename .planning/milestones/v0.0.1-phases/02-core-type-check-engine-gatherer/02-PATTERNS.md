# Phase 2: Core Type-Check Engine + Gatherer - Pattern Map

**Mapped:** 2026-06-27
**Files analyzed:** 13 (5 modified core/spec + ~8 new fixtures/integration specs)
**Analogs found:** 13 / 13 (every file has an in-repo or external analog)

This phase GROWS the kept Phase-1 tracer-bullet `core/` in place (NOT a rewrite of the package). Every code analog is the same repo's own Phase-1 seed; every test/fixture analog is either the existing `fixtures/gate-b-error/` + `gate-b.spec.ts` (the layout + assertion idiom to mirror) or Angular's own extended-diagnostics specs (the EXACT-code + category-promotion idiom for D-07d). The fixture root is the WORKSPACE root `fixtures/` dir (not under `src/` -- so Vitest does not collect fixture `.ts` as tests), confirmed by `gate-b.spec.ts:34-36`.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/angular-typechecker/src/core/run-typecheck.ts` | service (engine) | transform (config -> diagnostics) | itself (Phase-1 seed) | exact (in-place evolution) |
| `packages/angular-typechecker/src/core/compiler-cli-types.ts` | model (type shim) | transform | itself (Phase-1 seed) | exact (widen only) |
| `packages/angular-typechecker/src/core/gather-diagnostics.ts` | service (gatherer) | transform | itself (KEEP, no change) | exact |
| `packages/angular-typechecker/src/core/gather-diagnostics.spec.ts` | test (unit) | transform | itself (1-line import fix) | exact |
| `packages/angular-typechecker/src/core/gate-b.spec.ts` | test (integration) | transform | itself (reconcile `codes`) | exact |
| `packages/angular-typechecker/src/index.ts` | config (barrel) | request-response | itself (verify exports) | exact |
| `packages/angular-typechecker/src/core/*.integration.spec.ts` (NEW, per-version) | test (integration) | transform | `gate-b.spec.ts` + Angular `invalid_banana_in_box_spec.ts` | exact (idiom) + role-match |
| `fixtures/<intent>/error.component.ts` + `.html` (NEW: F2-F6) | fixture (broken source) | transform | `fixtures/gate-b-error/error.component.{ts,html}` | exact |
| `fixtures/<intent>/tsconfig.{app,lib,spec}.json` (NEW) | config (fixture tsconfig) | transform | `fixtures/gate-b-error/tsconfig.{app,lib}.json` | exact |
| `fixtures/composite-triangle/tsconfig.json` (NEW: F8) | config (fixture tsconfig) | transform | Nx ts-solution `tsconfig.base.json__tmpl__` | role-match (the triangle source) |
| `fixtures/solution-style/tsconfig.json` (NEW) | config (fixture tsconfig) | transform | Nx ts-solution `tsconfig.json__tmpl__` | exact (the silent-lie input shape) |
| `packages/angular-typechecker/vitest.config.mts` | config | n/a | itself (optional `--exclude` convention) | exact (no change needed) |
| `packages/angular-typechecker/tsconfig.lib.json` | config | n/a | itself (extend the fixtures exclude) | exact |

---

## Pattern Assignments

### `src/core/run-typecheck.ts` (service/engine, transform) -- REWRITE BODY

**Analog:** itself (Phase-1 seed, full file in context). This is an in-place evolution, not a new file. The current body has the THREE defects Phase 2 fixes (MD-01 dropped `parsed.errors`, MD-02 `warningCount = length - errorCount`, the minimal `{...options, noEmit:true}` override).

**Current imports + memoized-namespace pattern to KEEP** (`run-typecheck.ts:1-9`, `56-67`):
```typescript
import type ts from 'typescript';
import type { EmitFlags } from './compiler-cli-types';
import { loadCompilerCli } from './compiler-loader';
import { gatherAllDiagnostics } from './gather-diagnostics';
// ... loadTypescript() module-level memoization (lines 56-67) KEPT verbatim; reused for ts.DiagnosticCategory
```
Add `import { performance } from 'node:perf_hooks'` only if not implicitly available (the current file uses bare `performance.now()` -- keep as-is).

**Core orchestration pattern -- the THREE in-place fixes** (replaces current `run-typecheck.ts:28-54`):
- DROP `codes: number[]` from `CoreResult`; ADD `tsConfigPath: string` + `rootNamesCount: number` (D-01; verbatim shape in `02-RESEARCH.md:190-198`).
- After `ng.readConfiguration(...)`, `const configDiagnostics = [...parsed.errors]` and PREPEND to the final array (D-03, fixes MD-01 -- the current file never reads `parsed.errors`).
- If `parsed.rootNames.length === 0`: short-circuit (skip `performCompilation`), synthesize ONE `ATC1001` Error diagnostic (`file: undefined`, message naming `tsconfig.app.json`/`tsconfig.lib.json`/`tsconfig.spec.json`, branch on `parsed.projectReferences?.length`), return with `rootNamesCount: 0` (D-03/D-03a).
- Replace the minimal `options: { ...parsed.options, noEmit: true }` with the FULL D-05 emit-neutralizing override + `diagnostics: false` (D-02), spread FRESH per call. Verbatim object: `02-CONTEXT.md:53-71` / `02-RESEARCH.md:272-286`. KEEP `emitFlags: 0 as EmitFlags` (D-05a, load-bearing WITH `noEmit`).
- After `performCompilation`: `if (result.diagnostics.some(d => d.code === ng.UNKNOWN_ERROR_CODE)) throw ...` (D-06; gate on `code === 500`, NEVER `source === 'angular'` -- landmine L-3 / V-3).

**Explicit category-count pattern (D-01, fixes MD-02)** -- the current `warningCount: result.diagnostics.length - errorCount` (line 51) is the bug. Replace with the explicit pair the current file ALREADY uses for `errorCount` (lines 43-45), mirrored for Warning:
```typescript
const errorCount = diagnostics.filter(
  (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
).length;
const warningCount = diagnostics.filter(
  (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Warning,
).length; // NOT length - errorCount; Suggestion/Message stay uncounted (invariant: errorCount + warningCount <= diagnostics.length)
```

**Fresh-options-per-call invariant (KEEP)** -- the current JSDoc (`run-typecheck.ts:19-27`) already documents the footgun guard; preserve it. Anti-pattern: sharing one `options` object across two `performCompilation` calls (PITFALL D / L-5).

---

### `src/core/compiler-cli-types.ts` (model/type shim, transform) -- WIDEN

**Analog:** itself (full file in context). The header already says "widen as the engine grows in Phase 2."

**Type-only deep-import pattern to EXTEND** (`compiler-cli-types.ts:15-39`):
```typescript
import type {
  EmitFlags,
  Program,
} from '../../../../node_modules/@angular/compiler-cli/src/transformers/api';
import type {
  defaultGatherDiagnostics,
  ParsedConfiguration,
  performCompilation,
  readConfiguration,
} from '../../../../node_modules/@angular/compiler-cli/src/perform_compile';
```
WIDEN for D-06: add `UNKNOWN_ERROR_CODE` to the import from `.../transformers/api` and to the `CompilerCli` interface as `readonly UNKNOWN_ERROR_CODE: typeof UNKNOWN_ERROR_CODE;` (value 500). Pattern mirrors the existing `readonly EmitFlags: typeof EmitFlags;` (line 38). Re-export `ParsedConfiguration` is already present (line 26) -- `run-typecheck.ts` may import it for the synthesize-guard helper signature.

---

### `src/core/gather-diagnostics.ts` (service/gatherer, transform) -- KEEP

**Analog:** itself (full file in context). NO CHANGE -- the 6-getter unconditional all-getter (lines 20-25) is the correct ENG-02 differentiator (D-16 order). Do not re-design. The `import type { Program } from './compiler-cli-types'` (line 3) is ALREADY the correct nodenext-safe shim import.

---

### `src/core/gather-diagnostics.spec.ts` (test/unit, transform) -- EDIT 1 LINE (LW-01)

**Analog:** itself (full file in context).

**The single LW-01 fix** -- line 1 currently reads the barrel the shim exists to avoid:
```typescript
import type { Program } from '@angular/compiler-cli';   // BEFORE (barrel -- LW-01 defect)
import type { Program } from './compiler-cli-types';     // AFTER (nodenext-safe shim)
```
No other change. The stub-and-assert-order pattern (lines 12-65) stays. (Validation row LW-01 asserts the barrel import is gone via `git grep`.)

---

### `src/core/gate-b.spec.ts` (test/integration, transform) -- RECONCILE `codes`

**Analog:** itself (full file in context). It is the Phase-1 DIFFERENTIAL proof -- do NOT delete it; reconcile its `result.codes` reads (removed from `CoreResult` by D-01).

**The reconcile (L-8)** -- the only `runTypecheck`-result `codes` use is the timing test (`gate-b.spec.ts:102-103`):
```typescript
expect(result.codes).toContain(TS2322);        // BEFORE (codes removed)
expect(result.codes).toContain(NG8109);
// AFTER -- derive inline:
const codes = result.diagnostics.map((diagnostic) => diagnostic.code);
expect(codes).toContain(TS2322);
expect(codes).toContain(NG8109);
```
The `codesFor()` helper (lines 49-66) reads `result.diagnostics.map(...)` directly off `performCompilation` (NOT off `CoreResult`), so it is UNAFFECTED. This file's path-resolution + fixture-location idiom (lines 1-2, 34-39) is THE pattern the new integration specs copy (see below).

---

### `src/core/*.integration.spec.ts` (NEW, test/integration, transform) -- per-introduction-version split

**Analogs:**
1. `src/core/gate-b.spec.ts` (THIS repo) -- the real-FS fixture-path resolution + `runTypecheck`-direct (D-07c) + `describe.each` over tsconfig variants idiom.
2. `D:/projects/github/angular/angular/.../invalid_banana_in_box/invalid_banana_in_box_spec.ts` -- the EXACT-code + category + promotion idiom (D-07d).
3. `D:/projects/sandbox/.../executor.angular17.integration.spec.ts` -- the per-version filename split idiom ONLY (the `success`-boolean assertion is the ANTI-PATTERN D-07d explicitly replaces).

**Fixture-path resolution pattern (copy from `gate-b.spec.ts:1-2, 34-39`):**
```typescript
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// ...
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspaceRoot = join(packageRoot, '..', '..');
const fixtureDir = join(workspaceRoot, 'fixtures', 'gate-b-error'); // -> swap per fixture
const appTsConfig = join(fixtureDir, 'tsconfig.app.json');
```
Fixtures live at WORKSPACE-root `fixtures/`, NOT in `src/` (so Vitest's `include: ['{src,tests}/**/*.{spec,test}...']` never collects fixture `.ts` as tests -- `vitest.config.mts:14`).

**Direct-`runTypecheck` driver pattern (D-07c) -- adapt the `codesFor` helper from `gate-b.spec.ts:49-66`, but call `runTypecheck` (NOT raw `performCompilation`), and assert off `CoreResult`:**
```typescript
async function resultFor(tsConfigPath: string) {
  return runTypecheck({ tsConfigPath }); // ONE performCompilation per fixture (D-07c); never share a program
}
const NG = (code: number): number => -990000 - code;          // D-07d named must-have; NG(8109) -> -998109
const ngCodeOf = (code: number): number => Math.abs(code) - 990000; // recovery
```
TS codes assert RAW (`2322`, `2339`); NG codes assert via `NG(8001)`, `NG(8109)`, etc. (PITFALL E / L-4 -- never assert bare `8109`).

**EXACT-code + category assertion idiom (copy from Angular `invalid_banana_in_box_spec.ts:49-51`):**
```typescript
// Angular's own idiom -- mirror it with our NG() helper + CoreResult.diagnostics:
const banana = result.diagnostics.find((d) => d.code === NG(8101));
expect(banana?.category).toBe(ts.DiagnosticCategory.Warning); // NG8101 default WARNING (error_code.d.ts:394)
expect(banana?.code).toBe(NG(8101));
```

**Category-PROMOTION idiom for F6 (copy from `invalid_banana_in_box_spec.ts:135-160`)** -- the "respect configured category" test: a fixture tsconfig with `extendedDiagnostics.defaultCategory: "error"` (or per-check label) flips the SAME code from `warningCount` into `errorCount` for free (D-01 fact). Assert: default fixture -> `category === Warning` in `warningCount`; promoted fixture -> `category === Error` in `errorCount`.

**Exact-counts assertion (D-07d, replaces the sandbox `success`-boolean anti-pattern):**
```typescript
expect(result.errorCount).toBe(1);
expect(result.errorCount + result.warningCount).toBeLessThanOrEqual(result.diagnostics.length); // D-01 invariant
```

**Per-version file split (sandbox naming idiom)** -- name files by Angular introduction version so future codes are drop-in: `*.angularNN.integration.spec.ts` (e.g. `extended.angular13.integration.spec.ts` for NG8101, `extended.angular17.integration.spec.ts` for NG8109). Use Vitest `describe.each` to fan out within a version where useful (the `gate-b.spec.ts:68-71` `describe.each([...])` pattern).

---

### `fixtures/<intent>/error.component.{ts,html}` (NEW: F2-F6, fixture/broken source, transform)

**Analog:** `fixtures/gate-b-error/error.component.ts` + `error.component.html` (both in context).

**Broken-standalone-component pattern (copy the shape):**
```typescript
import { Component, signal } from '@angular/core';
// Deliberate-error fixture. OUT OF the project graph; excluded from tsconfig.lib.json.
// Do NOT add @ts-nocheck -- the errors ARE the gate input.
@Component({
  selector: 'gate-b-error',
  standalone: true,
  templateUrl: './error.component.html',
})
export class GateBErrorComponent {
  count: number = 'not a number'; // TS2322
  status = signal('ready');       // interpolated un-invoked -> NG8109
}
```
- F1 (TS2322) + F7 (multi-error TS2322 + NG8109 + NG8117 companion) are ALREADY satisfied by `gate-b-error/` -- REUSE; do not duplicate.
- F2 (TS2339 template-driven missing member), F3 (NG8001 `SCHEMA_INVALID_ELEMENT` unknown element), F4 (NG2003 `PARAM_MISSING_TOKEN` missing injection token), F5 (NG8101 `INVALID_BANANA_IN_BOX`, default Warning), F6 (NG8109/NG8021 with a `defaultCategory:"error"` promotion variant): NEW, mirror the `gate-b-error` component+template shape. Codes re-verified in installed 22.0.4 `error_code.d.ts` (NG8001=238, NG2003=57, NG8101=394, NG8109=477, NG8021=375, NG8117=557).
- AVOID NG8110/NG8112 (not extended diagnostics -- L-7).

---

### `fixtures/<intent>/tsconfig.{app,lib,spec}.json` (NEW, config/fixture tsconfig, transform)

**Analog:** `fixtures/gate-b-error/tsconfig.app.json` + `tsconfig.lib.json` (both in context).

**Fixture tsconfig pattern (copy):**
```jsonc
{
  "extends": "../../tsconfig.base.json",     // workspace base (classic; tsconfig.base.json in context)
  "compilerOptions": {
    "noEmit": true, "target": "es2022", "module": "preserve",
    "moduleResolution": "bundler", "strict": true,
    "emitDecoratorMetadata": false, "experimentalDecorators": false
  },
  "angularCompilerOptions": { "strictTemplates": true }, // strictTemplates ON is load-bearing for template/TS2339
  "files": ["error.component.ts"]            // app: files[]; lib: "include": ["**/*.ts"] (see lib analog)
}
```
- D-07b REQUIRES app + local-lib + `tsconfig.spec.json` variants. `gate-b-error/` covers app+lib; ADD a `tsconfig.spec.json` (the named differentiator vs a build check -- success criterion 3). Model it on the lib variant but name it `tsconfig.spec.json` and point at a planted spec-file error (proves specs are type-checked, EXE-02).
- For F6 promotion, set `"angularCompilerOptions": { "strictTemplates": true, "extendedDiagnostics": { "defaultCategory": "error" } }`.

---

### `fixtures/composite-triangle/tsconfig.json` (NEW: F8, config, transform)

**Analog:** `D:/projects/github/nrwl/nx/.../init/files/ts-solution/tsconfig.base.json__tmpl__:1-23` (the composite-triangle SOURCE).

**Triangle-reproduction pattern (D-05/L-1 regression proof)** -- a fixture tsconfig that DELIBERATELY sets the three options the D-05 override must neutralize:
```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,            // Nx ts-solution base sets these workspace-wide
    "declarationMap": true,
    "emitDeclarationOnly": true,
    "target": "es2022", "module": "preserve", "moduleResolution": "bundler", "strict": true
  },
  "angularCompilerOptions": { "strictTemplates": true },
  "files": ["error.component.ts"]
}
```
Assertion (integration spec): `codes` does NOT contain `5053`/`6304`/`6379` -- proves the D-05 override (with `composite: false` as the gatekeeper) neutralizes the triangle. WITHOUT this fixture, success criterion 1 is unproven on this workspace's CLASSIC base (V-5).

---

### `fixtures/solution-style/tsconfig.json` (NEW, config, transform)

**Analog:** `D:/projects/github/nrwl/nx/.../init/files/ts-solution/tsconfig.json__tmpl__:1-6` (the EXACT silent-lie input shape).

**Solution-style / references-only pattern (D-03/D-03a guard proof)** -- the input that produces zero `rootNames` AND suppresses TS18003:
```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compileOnSave": false,
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }]
}
```
Assertion (integration spec): `result.rootNamesCount === 0` AND `result.errorCount === 1` AND the synthesized `ATC1001` message names a leaf tsconfig. This is the MD-01 regression proof (PITFALL C / L-2 -- TS18003 does NOT fire because `references` is present).

---

### `packages/angular-typechecker/vitest.config.mts` (config) -- LIKELY NO CHANGE

**Analog:** itself (full file in context). Claude's-discretion split. Recommendation (RESEARCH): filename-convention `*.integration.spec.ts` within the ONE config; the global `include` (line 14) already collects `*.spec.ts` and `*.integration.spec.ts`. Quick run excludes integration via `-- --exclude '**/*.integration.spec.ts'`. Leave `environment: 'jsdom'` (line 13) -- the compiler runs in Node regardless; do not over-configure. Do NOT add a second Nx target (the mock/unit tier is Phase 3).

---

### `packages/angular-typechecker/tsconfig.lib.json` (config) -- EXTEND FIXTURES EXCLUDE

**Analog:** itself (`tsconfig.lib.json:26` already excludes `"fixtures/gate-b-error/**/*"`). When NEW fixture dirs are added, extend the `exclude` array with each new `fixtures/<intent>/**/*` so broken fixture `.ts` are never compiled into the published package. Same idiom, additive.

---

## Shared Patterns

### Memoized ESM/namespace loading (KEEP, do not touch)
**Source:** `src/core/compiler-loader.ts:16-20` (compiler-cli) + `src/core/run-typecheck.ts:56-67` (typescript)
**Apply to:** every `core/` consumer; reused across all `runTypecheck` calls in one process.
```typescript
export async function loadCompilerCli(): Promise<CompilerCli> {
  cached ??= (await import('@angular/compiler-cli')) as unknown as CompilerCli;
  return cached;
}
```
The single runtime value-import of `@angular/compiler-cli`. Everywhere else: `import type` via `compiler-cli-types`. Do NOT move the `await import()` out of `core/` (L-6 -- GATE A regression). `core/` keeps ZERO `@nx/devkit`/CLI imports (Phase-2 invariant; module-boundary enforcement is Phase 3/WS-04).

### Negative NG-code encoding helper (D-07d named must-have)
**Source:** Angular `util.ts:26-28` (`ngErrorCode = parseInt('-99'+code)`); mirrored as the test `NG()` helper.
**Apply to:** every integration spec asserting NG codes.
```typescript
const NG = (code: number): number => -990000 - code;          // NG8109 -> -998109 (agrees with ngErrorCode)
const ngCodeOf = (code: number): number => Math.abs(code) - 990000; // recovery for output
```
TS codes assert RAW (no offset). Count by `.category`, never by code sign (L-4).

### Exact-code + category + promotion assertion (the D-07d core idiom)
**Source:** `D:/projects/github/angular/angular/.../invalid_banana_in_box_spec.ts:49-51` (exact code + Warning category) and `:135-160` (promotion to Error via `defaultCategory`).
**Apply to:** every TEST-02 integration assertion. Replaces the sandbox `expect(result.success).toBe(false)` anti-pattern (`D:/projects/sandbox/.../executor.angular17.integration.spec.ts:9`).
```typescript
const diag = result.diagnostics.find((d) => d.code === NG(8101));
expect(diag?.category).toBe(ts.DiagnosticCategory.Warning); // or .Error when promoted
expect(result.errorCount).toBe(<exact>);
```

### Fresh-options-per-call + one-program-per-fixture (D-05/D-07c)
**Source:** `src/core/gate-b.spec.ts:56-63` (each `performCompilation` gets its own `{ ...parsed.options, ... }` spread) + `run-typecheck.ts:19-27` JSDoc.
**Apply to:** the engine override AND every integration fixture run. Never reuse an `options` object or a `Program` across calls/fixtures (PITFALL D / L-5).

### Real-FS fixture path resolution (out-of-graph, committed)
**Source:** `src/core/gate-b.spec.ts:1-2, 34-39`; Angular `perform_compile_spec.ts:51-53` (`path.resolve` + real FS).
**Apply to:** every integration spec. Fixtures are committed at workspace-root `fixtures/`, out of the project graph, excluded from `tsconfig.lib.json`. The core requires an ABSOLUTE `tsConfigPath` (D-04) -- tests build it via `join(workspaceRoot, 'fixtures', ...)`.

### Infrastructure-failure detection by code, not source (D-06 / L-3)
**Source:** the D-06 decision + V-3 flag (RESEARCH). Detection MUST be `d.code === ng.UNKNOWN_ERROR_CODE` (500), NOT the `source === 'angular'` predicate that `exitCodeFromResult` uses (the synthesized 500 diagnostic sets no `source`).
**Apply to:** `run-typecheck.ts` (the re-throw) and the D-06 test. The exact throw TYPE + the Phase-4 executor mapping are Phase-4 concerns (Claude's discretion / out of scope here).

---

## No Analog Found

| File | Role | Data Flow | Reason / Resolution |
|------|------|-----------|---------------------|
| (D-06 infra-failure test) | test | transform | No existing test stubs the loaded `performCompilation`. RESEARCH Open Q2 recommends a focused stub returning a single `code: 500` diagnostic + assert `runTypecheck` throws. This is the one justified mock in Phase 2 (broad mocking is Phase-3 TEST-01); planner confirms scope. No code analog -- pattern is "stub the memoized namespace, assert throw." |
| `ATC1001` synthesized-diagnostic helper | utility | transform | No existing synthesized diagnostic in the repo. Claude's discretion (numeric value + namespace). Shape: `{ category: Error, code: <private positive outside TS/NG/500 ranges, e.g. 90001>, file: undefined, start: undefined, length: undefined, messageText: <tailored, names leaf tsconfigs> }`. Branch the message on `parsed.projectReferences?.length`. |

---

## Metadata

**Analog search scope (this repo, `git grep`/Glob):** `packages/angular-typechecker/src/core/`, `src/executors/`, `fixtures/`, root + package `tsconfig*.json`, `vitest.config.mts`, `src/index.ts`.
**Analog search scope (external clones, `rg`):** `D:/projects/github/angular/angular/packages/compiler-cli/test/` + `.../typecheck/extended/test/checks/invalid_banana_in_box/`; `D:/projects/github/nrwl/nx/packages/js/src/generators/init/files/ts-solution/`; `D:/projects/sandbox/nx19-8-angular18-2-.../libs/nx-plugin/src/executors/angular-typecheck/`; installed `node_modules/@angular/compiler-cli@22.0.4/src/ngtsc/diagnostics/src/error_code.d.ts` (code-name re-verification).
**Files scanned:** ~24 (8 in-repo core/spec/config + 4 in-repo fixtures + 12 external analogs/templates/declarations).
**NG codes re-verified against installed 22.0.4:** NG8001=`SCHEMA_INVALID_ELEMENT`, NG8003=`MISSING_REFERENCE_TARGET`, NG2003=`PARAM_MISSING_TOKEN`, NG8021=`DEFER_TRIGGER_MISCONFIGURATION`, NG8101=`INVALID_BANANA_IN_BOX`, NG8109=`INTERPOLATED_SIGNAL_NOT_INVOKED`, NG8117=`UNINVOKED_FUNCTION_IN_TEXT_INTERPOLATION`, NG10002=`SUGGEST_SUBOPTIMAL_TYPE_INFERENCE`.
**Pattern extraction date:** 2026-06-27
