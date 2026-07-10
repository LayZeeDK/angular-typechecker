# Phase 21: Angular CLI builder + engine multi-tsConfig + GATE A' spike - Pattern Map

**Mapped:** 2026-07-10
**Files analyzed:** 13 (5 new source/manifest, 6 modified source/manifest, 2+ new test, 1 new spike record)
**Analogs found:** 13 / 13 (every new/modified file has a concrete in-repo analog)

> Phase 21 is almost entirely REUSE (RESEARCH "Don't Hand-Roll" key insight). The builder
> is a 3-line re-export of the SAME executor default export; ENG-01's array path mirrors the
> shipped `handleSolutionWalk` union-then-single-`finalize` tail; the spike record mirrors the
> spike-007 orchestrator + record-only discipline. Only `handleMultiTsConfig` (~40-line mirror)
> and the schema sanitization are genuinely new logic.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/builders/typecheck/builder.ts` (NEW) | builder / adapter entry | request-response | `src/executors/typecheck/executor.ts` (the default export it wraps) | exact (structural re-export) |
| `builders.json` (NEW) | manifest / config | declarative | `executors.json` | exact |
| `src/builders/typecheck/schema.json` (NEW) | config (JSON-schema) | input-validation | `src/executors/typecheck/schema.json` (sanitized copy) | role-match (sanitize: strip `cli`/`version`/`$id`) |
| `src/builders/typecheck/schema-parity.spec.ts` (NEW) | test (static) | request-response | `src/executors/typecheck/schema-parity.spec.ts` + `generators/configuration/schema-parity.spec.ts` | exact |
| `src/executors/typecheck/gate-a-static.spec.ts` (MODIFIED) | test (static, built artifact) | file-I/O | itself (extend the existing negative assertion) | exact (self-extension) |
| `src/executors/typecheck/schema.d.ts` (MODIFIED) | type (contract) | - | itself (widen `tsConfig`) | exact |
| `src/executors/typecheck/schema.json` (MODIFIED) | config (JSON-schema) | input-validation | itself (widen `tsConfig.type` -> `oneOf`) | exact |
| `src/executors/typecheck/normalize-options.ts` (MODIFIED) | utility (pure mapping) | transform | itself (widen path resolution to array) | exact |
| `src/core/run-typecheck.ts` (MODIFIED) | service (engine core) | transform / batch | `handleSolutionWalk` + `walkReferences` (same union tail) | exact (mirror shipped tail) |
| `packages/angular-typechecker/package.json` (MODIFIED) | manifest | declarative | existing `executors`/`generators` fields + `files` allowlist | exact |
| `packages/angular-typechecker/project.json` (MODIFIED) | build config | declarative | existing `executors.json`/`generators.json` asset globs | exact |
| `src/package-manifest.spec.ts` (MODIFIED) | test (static) | file-I/O | itself (`files` allowlist assertion) | exact |
| `.planning/spikes/011-*/{harness.mjs,README.md,forensic-log.json}` (NEW) | spike record (orchestrator) | batch / e2e | `.planning/spikes/007-forced-sb10-compile-ng8xxx/` + `CONVENTIONS.md` | role-match (orchestrator drives real `ng run`, not a verbatim-engine `.mjs`) |
| `src/core/<name>.integration.spec.ts` + `fixtures/<name>/` (NEW, ENG-01 array) | test (integration) + fixture | transform | `src/core/run-typecheck.integration.spec.ts` + `fixtures/gate-b-error` | exact |
| Nx-surface regression spec (NEW, ACB-03) | test (static) | file-I/O | `src/package-manifest.spec.ts` (read `package.json` + `executors.json`) | role-match |

---

## Pattern Assignments

### `src/builders/typecheck/builder.ts` (NEW - builder, request-response)

**Analog:** `src/executors/typecheck/executor.ts` (the default export the builder wraps)

The whole builder is a 3-line re-export. It writes NO code of its own; parity with the executor
is STRUCTURAL because it IS the executor default export. Follow the executor's import ordering
convention (external `@nx/devkit` first, then relative `../../` imports).

**Executor imports to mirror the shape of** (`src/executors/typecheck/executor.ts` lines 1-13):
```typescript
import type { ExecutorContext } from '@nx/devkit';
import { logger } from '@nx/devkit';

import { evaluateResult } from '../../core/evaluate-result';
// ...relative core imports...
import { normalizeOptions } from './normalize-options';
import type { TypecheckExecutorOptions } from './schema';
```

**Executor default-export signature the bridge wraps** (`executor.ts` lines 40-43):
```typescript
export default async function typecheckExecutor(
  options: TypecheckExecutorOptions,
  context: ExecutorContext,
): Promise<{ success: boolean }> {
```

**The builder module to author** (from RESEARCH Pattern 1 - the WHOLE file; note the depth is
`../../executors/typecheck/executor` from `src/builders/typecheck/`):
```typescript
import { convertNxExecutor } from '@nx/devkit';

import typecheckExecutor from '../../executors/typecheck/executor';

export default convertNxExecutor(typecheckExecutor);
```

**CJS/nodenext build constraint:** `builder.ts` compiles under the SAME `tsconfig.lib.json`
(`module: nodenext`) as the executor. It does no `import()` itself, but any build-graph drift that
recompiled `compiler-loader.ts` under `commonjs` re-introduces the v0.0.1 downlevel bug - which is
exactly why `gate-a-static.spec.ts` must be EXTENDED to the builder entry (below).

---

### `builders.json` (NEW - manifest, declarative)

**Analog:** `executors.json` (full file, lines 1-11):
```json
{
  "executors": {
    "typecheck": {
      "implementation": "./src/executors/typecheck/executor",
      "schema": "./src/executors/typecheck/schema.json",
      "outputCapture": "direct-nodejs",
      "description": "Type-checks an Angular project (TypeScript + template + extended NG8xxx) with no emit."
    }
  }
}
```

**The `builders.json` to author** (top-level key is `builders`, NOT `executors`; drop the
Nx-only `outputCapture`; extensionless `implementation` path per Nx/Architect convention):
```json
{
  "builders": {
    "typecheck": {
      "implementation": "./src/builders/typecheck/builder",
      "schema": "./src/builders/typecheck/schema.json",
      "description": "Type-checks an Angular project (TypeScript + template + extended NG8xxx) with no emit."
    }
  }
}
```

---

### `src/builders/typecheck/schema.json` (NEW - config, input-validation)

**Analog:** `src/executors/typecheck/schema.json` (lines 1-36), SANITIZED.

The executor schema carries three Nx-only keys the builder must STRIP (`$id` line 3, `cli` line 6,
`version` line 7). The current executor schema has NO `x-*` and NO `$default`, so those are already
absent - the ONLY strip is `$id`/`cli`/`version`. The `tsConfig` type widens to `oneOf` (ENG-01).

**Executor schema keys to strip** (`schema.json` lines 2-7):
```json
  "$schema": "http://json-schema.org/schema",
  "$id": "TypecheckExecutorOptions",
  "title": "Angular type-check executor",
  "description": "...",
  "cli": "nx",
  "version": 2,
```

**Executor `tsConfig` property to widen** (`schema.json` lines 10-13, currently `"type": "string"`):
```json
    "tsConfig": {
      "type": "string",
      "description": "Path to the tsconfig to type-check. Resolved relative to the workspace root when not absolute."
    },
```

Widen to (RESEARCH Pattern 3 / ENG-01 seam #2 - applies to BOTH schemas):
```json
    "tsConfig": {
      "oneOf": [
        { "type": "string" },
        { "type": "array", "items": { "type": "string" }, "minItems": 1 }
      ],
      "description": "Path (or array of paths) to the tsconfig(s) to type-check. Resolved relative to the workspace root when not absolute."
    },
```

Keep `includeDeps`/`maxWarnings`/`failFast`/`strict` verbatim (executor `schema.json` lines 14-32),
plus `"required": ["tsConfig"]` and `"additionalProperties": false` (lines 34-35). Keep `$schema`,
`title`, `description`, `type: "object"`.

**`schema.d.ts` (the builder's TS options interface):** REUSE the executor's `TypecheckExecutorOptions`
(`src/executors/typecheck/schema.d.ts`) - do NOT hand-copy a second interface. `builder.ts` already
imports the executor default export; the builder schema-parity spec can `import type { TypecheckExecutorOptions }`
from the executor. Skip a separate builder `schema.d.ts` unless the parity spec proves it necessary.
(ponytail: reuse over a one-implementation duplicate; the executor interface is the single source of truth for both option surfaces.)

---

### `src/builders/typecheck/schema-parity.spec.ts` (NEW - test, static)

**Analog (primary):** `src/executors/typecheck/schema-parity.spec.ts` (the whole file).
**Analog (secondary, for the "no cli/version" inverse):** `src/generators/configuration/schema-parity.spec.ts`.

The executor parity spec asserts the schema keys equal a literal `EXPECTED_KEYS` array, `required`,
`additionalProperties`, defaults, AND `cli:"nx"`/`version:2` PRESENT. The builder parity spec is the
INVERSE on the last point: assert `cli`/`version` ABSENT.

**Executor spec EXPECTED_KEYS + key/required/props assertions to mirror** (`schema-parity.spec.ts` lines 28-58):
```typescript
const EXPECTED_KEYS = ['failFast', 'includeDeps', 'maxWarnings', 'strict', 'tsConfig'];

it('declares exactly the TypecheckExecutorOptions properties', () => {
  expect(Object.keys(schema.properties).sort()).toEqual(EXPECTED_KEYS);
});

it('keeps tsConfig as the single required flag', () => {
  expect(schema.required).toEqual(['tsConfig']);
});
```

**Executor spec's cli/version PRESENCE assertion** (lines 45-49) - the builder INVERTS this:
```typescript
it('is a v2, cli:nx, strict (additionalProperties:false) schema', () => {
  expect(schema.version).toBe(2);
  expect(schema.cli).toBe('nx');
  expect(schema.additionalProperties).toBe(false);
});
```

**Generator spec's "omits version" pattern to borrow for the inverse** (`generators/configuration/schema-parity.spec.ts` lines 67-74):
```typescript
it('is a cli:nx, strict (additionalProperties:false) schema', () => {
  expect(schema.cli).toBe('nx');
  expect(schema.additionalProperties).toBe(false);
});

it('omits the executor-only "version" field (generator schema)', () => {
  expect(schema).not.toHaveProperty('version');
});
```

**Builder spec assertions to author** (RESEARCH Code Examples): same `EXPECTED_KEYS`, `required: ['tsConfig']`,
`additionalProperties === false`, same defaults, PLUS the inverse sanitization guard
`expect(schema).not.toHaveProperty('cli')` and `expect(schema).not.toHaveProperty('version')`.
Widening `tsConfig` to `oneOf` does NOT break the existing executor parity spec - it only reads
`Object.keys(properties)` + `required` + defaults, never `tsConfig.type` (confirmed lines 36-62).

---

### `src/executors/typecheck/gate-a-static.spec.ts` (MODIFIED - extend to builder entry)

**Analog:** itself. The file already derives `distRoot` from `project.json` `build.options.outputPath`
and asserts the built `.js` bytes. EXTEND it with a builder-entry negative assertion.

**Existing dist-root derivation to reuse verbatim** (lines 44-51):
```typescript
const projectJson = JSON.parse(
  readFileSync(join(packageRoot, 'project.json'), 'utf8'),
) as ProjectJson;
const outputPath = projectJson.targets.build.options.outputPath;
const distRoot = join(workspaceRoot, outputPath);
```

**Existing executor-entry negative assertion to mirror for the builder** (lines 59-65 + 94-98):
```typescript
const executorJsPath = join(distRoot, 'src', 'executors', 'typecheck', 'executor.js');

it('negative: built executors/.../executor.js does NOT require() @angular/compiler-cli', () => {
  const code = stripCommentLines(readFileSync(executorJsPath, 'utf8'));

  expect(code).not.toMatch(/require\(["']@angular\/compiler-cli/);
});
```

**Extension to add** (RESEARCH Code Examples - the builder `.js` reaches compiler-cli through the
SAME `core/compiler-loader.js`, so only the NEGATIVE `require()` assertion is needed on the builder entry;
the POSITIVE `import(` assertion on `compiler-loader.js` at lines 82-86 already covers the load site):
```typescript
const builderJsPath = join(distRoot, 'src', 'builders', 'typecheck', 'builder.js');

it('negative: built builders/.../builder.js does NOT require() @angular/compiler-cli', () => {
  const code = stripCommentLines(readFileSync(builderJsPath, 'utf8'));

  expect(code).not.toMatch(/require\(["']@angular\/compiler-cli/);
});
```
Reuse the existing `stripCommentLines` helper (lines 74-79) unchanged.

---

### ENG-01 seams (MODIFIED)

#### `src/executors/typecheck/schema.d.ts` (widen the interface)

**Analog:** itself. Current (line 1-7):
```typescript
export interface TypecheckExecutorOptions {
  tsConfig: string;
  includeDeps?: boolean;
  maxWarnings?: number;
  failFast?: boolean;
  strict?: boolean;
}
```
Widen `tsConfig: string` -> `tsConfig: string | string[]` (ENG-01 seam #1). Nothing else changes.

#### `src/executors/typecheck/normalize-options.ts` (resolve array entries)

**Analog:** itself. The existing single-string resolution to widen (lines 48-50):
```typescript
const tsConfigPath = isAbsolute(options.tsConfig)
  ? options.tsConfig
  : joinPathFragments(context.root, options.tsConfig);
```

Widen per RESEARCH ENG-01 seam #3 (mirror the existing `isAbsolute ? path : joinPathFragments`
per entry; `joinPathFragments` from `@nx/devkit` is already imported at line 4 for POSIX-separator
stability on Windows arm64 - do NOT switch to `node:path.join`):
```typescript
const resolveOne = (p: string): string =>
  isAbsolute(p) ? p : joinPathFragments(context.root, p);

const tsConfigPath = Array.isArray(options.tsConfig)
  ? options.tsConfig.map(resolveOne)
  : resolveOne(options.tsConfig);
```
`coreOptions.tsConfigPath` (built in the return at lines 52-62) then carries `string | readonly string[]`.

#### `src/core/run-typecheck.ts` (widen `CoreOptions` + branch to `handleMultiTsConfig`)

**Analog:** `handleSolutionWalk` (lines 441-531, SAME FILE) - `handleMultiTsConfig` is the
surviving-leaf tail of `handleSolutionWalk`, sourced from an EXPLICIT path list instead of resolved
references. And `walkReferences` (`src/core/walk-references.ts` lines 108-303) for the per-entry
accumulation loop.

**`CoreOptions.tsConfigPath` to widen** (lines 20-21):
```typescript
export interface CoreOptions {
  tsConfigPath: string;   // -> string | readonly string[]
```

**Branch to add at the TOP of `runTypecheck`** (after the loader/ts loads at lines 268-273, before
the single-string body; RESEARCH ENG-01 seam #4):
```typescript
if (Array.isArray(options.tsConfigPath)) {
  return handleMultiTsConfig(ng, ts, options, start); // NEW
}
// ...existing single-string path UNCHANGED below...
```

**Per-entry accumulation to mirror** (`walk-references.ts` lines 261-288 - the surviving-leaf tail):
```typescript
const parsed = ng.readConfiguration(entry, { suppressOutputPathCheck: true });
// throwIfInfrastructureFailure(parsed.errors) per entry
const result = runNoEmitCompilation(ng, parsed);
rawDiagnostics.push(...parsed.errors);
rawDiagnostics.push(...result.diagnostics);
rootNamesCount += parsed.rootNames.length;
rootNamePaths.push(...parsed.rootNames);
```

**Union-then-single-`finalize` tail to mirror** (`handleSolutionWalk` lines 460-491):
```typescript
throwIfInfrastructureFailure(ng, ts, walk.rawDiagnostics);      // over the UNION
// ...
const result = finalize(
  ts,
  options.tsConfigPath,
  walk.rootNamesCount,
  [...configDiagnostics, ...walk.rawDiagnostics],               // ONE finalize over the union
  start,
  buildFinalizeFilter(
    ts,
    parsed,
    options,
    ts.sys.useCaseSensitiveFileNames,
    walk.rootNamePaths,                                          // COMBINED input set
  ),
);
```

**Reuse (do NOT re-implement):** `buildFinalizeFilter` (lines 207-225), `finalize` (lines 626-709),
`presentIfNonEmpty` (lines 238-245), `throwIfInfrastructureFailure` (lines 169-183), `runNoEmitCompilation`
(from `gather-diagnostics`). The v0.2.0 input-set-membership boundary (`buildFinalizeFilter`'s `inputTs`
arg = combined `rootNamePaths`) filters over the COMBINED declared input sets.

**Planner must lock these edge decisions (RESEARCH Open Q1):** first-entry basePath for the combined
`finalize`; zero-rootNames entry -> coverage-incomplete (mirror the walk's `zero-root-names` handling,
`walk-references.ts` lines 247-254, NOT the direct path's hard 90001); `["x"]` behaves byte-identically
to `"x"` (test it); solution-tsconfig-as-array-entry = documented leaf-only limitation.

**WRONG approach to avoid** (RESEARCH): calling `runTypecheck` per entry and merging `CoreResult`s -
double-implements `finalize`/dedupe/counting AND breaks the boundary. The fan-out MUST be a single
`finalize` over the raw union.

---

### `packages/angular-typechecker/package.json` (MODIFIED - additive `builders` field + `files` entry)

**Analog:** the existing `executors`/`generators` fields + `files` allowlist.

**Existing fields to extend** (lines 29-30 and 35-41):
```json
  "executors": "./executors.json",
  "generators": "./generators.json",
  ...
  "files": [
    "src",
    "executors.json",
    "generators.json",
    "README.md",
    "LICENSE"
  ],
```

Add `"builders": "./builders.json"` alongside `executors`/`generators`, and add `"builders.json"` to
the `files` array (RESEARCH Pattern 1). ADDITIVE ONLY - do NOT touch the existing fields.

**Optional peers (discretion - ACP-01 mapped to Phase 23; RESEARCH recommends declaring here):** the
current `peerDependencies` (lines 46-49) declares only `@angular/compiler-cli` + `typescript`. If pulled
into Phase 21, add `@angular-devkit/architect: ^0.2200.0` + `rxjs: ^7.8.0` as OPTIONAL peers via a new
`peerDependenciesMeta` block. The GATE is not blocked either way (the real Ng22 clone always has both).

---

### `packages/angular-typechecker/project.json` (MODIFIED - CRITICAL: add `builders.json` to build assets)

**Analog:** the existing `executors.json` / `generators.json` asset globs (lines 27-36). `builders.json`
is NOT compiled - it must be COPIED into the dist by the build target's `assets`, exactly like
`executors.json`/`generators.json`. Without this the packed tarball ships no `builders.json` and `ng run`
cannot resolve the builder (memory: 0.0.1-0.1.0 shipped source-only; the tarball MUST carry the manifest).

**Existing asset glob to mirror** (lines 27-36):
```json
{
  "input": "./packages/angular-typechecker",
  "glob": "executors.json",
  "output": "."
},
{
  "input": "./packages/angular-typechecker",
  "glob": "generators.json",
  "output": "."
}
```
Add a third identical block for `"glob": "builders.json"`. The builder's `schema.json` and `builder.js`
under `src/` are already covered by the `**/!(*.ts)` and compiled-`.js` globs (lines 16-26).

---

### `src/package-manifest.spec.ts` (MODIFIED - `files` allowlist assertion)

**Analog:** itself. The spec asserts the EXACT `files` array and the `generators` field - both must be
updated when `builders.json` lands, or the spec fails.

**Existing assertions to update** (lines 87-99):
```typescript
it('declares the explicit files allowlist (D-01; never rely on npm defaults)', () => {
  expect(manifest.files).toEqual([
    'src',
    'executors.json',
    'generators.json',
    'README.md',
    'LICENSE',
  ]);
});

it('registers the generators collection (D-02)', () => {
  expect(manifest.generators).toBe('./generators.json');
});
```
Add `'builders.json'` to the expected `files` array, and add an assertion
`expect(manifest.builders).toBe('./builders.json')` mirroring the `generators` one. (Add `builders?: string`
to the `PluginManifest` interface at lines 32-54.)

---

### ENG-01 integration spec + fixture (NEW)

**Analog:** `src/core/run-typecheck.integration.spec.ts` + the `fixtures/gate-b-error` /
`fixtures/sibling-import` fixtures it consumes.

**Existing integration-spec shape to mirror** (`run-typecheck.integration.spec.ts` lines 22-89): resolve
a hermetic fixture path from `findWorkspaceRoot`, call `runTypecheck({ tsConfigPath })` DIRECTLY, assert
off `CoreResult` (`diagnostics.map(d => d.code)`, `errorCount`, boundary `suppressedInGraph*`). The
app+lib describe.each block (lines 69-72) and the boundary describe (lines 113-243) are the closest models.

**New spec to author:** call `runTypecheck({ tsConfigPath: [buildLeaf, specLeaf] })` with planted errors in
EACH leaf; assert the union surfaces BOTH, the combined-input-set boundary keeps in-project + drops
out-of-project, and `["x"]` yields the identical `CoreResult` as `"x"`. Build the hermetic fixture
under `fixtures/` (co-located app+spec leaves), NEVER mutate the committed `fixtures/gate-b-error` /
`sibling-import` (CONVENTIONS.md hermetic-fixture rule; perturbing them breaks the existing specs + Nx graph).

---

### Nx-surface regression spec (NEW - ACB-03)

**Analog:** `src/package-manifest.spec.ts` (pure `package.json` read-assert; lines 29-58) + `executors.json`.

**Assertion to author** (RESEARCH Pattern 2): after the `builders` field lands, assert `package.json`
still declares `executors: "./executors.json"` unchanged, and that Nx resolves `executors ?? builders`
(the `executors` field present means Nx never reads `builders.json`). Lean form: static read of
`package.json` + `executors.json` (executors field present + unchanged) plus the existing e2e/GUARD-01
resolve smoke covers the Nx-executor-still-resolves side. Follow the `package-manifest.spec.ts`
read-and-assert idiom (JSON.parse of `readFileSync`, typed interface, deterministic - no build, no compiler).

---

### `.planning/spikes/011-*/` (NEW - GATE A' spike record; orchestrator)

**Analog (discipline):** `.planning/spikes/CONVENTIONS.md` + `.planning/spikes/007-forced-sb10-compile-ng8xxx/`
(the isolated-scaffold / external-toolchain / commit-record-only precedent). **Next free number: 011**
(001-010 exist; confirmed against MANIFEST.md).

**KEY DIFFERENCE from spikes 001-010:** those are pure `.mjs` harnesses that copy the engine functions
VERBATIM and run against the workspace `node_modules`. Spike 011 is an ORCHESTRATOR that drives REAL
tooling (`nx build` -> `npm pack` dist -> install tarball into the real Ng22 clone -> hand-wire
`architect.typecheck` -> real `ng run` -> scan stdout/stderr for ESM signatures). The builder code it
tests is REAL plugin code, not a harness copy. This is because the gate MUST exercise the real
`convertNxExecutor` + Architect loader + the eager `retrieveProjectConfigurationsWithAngularProjects`
prelude (an `.mjs`-only harness cannot trigger it - Pitfall 1 / nrwl/nx#19475).

**Spike-007 frontmatter to mirror** (`007/README.md` lines 1-10):
```yaml
---
spike: 007
name: forced-sb10-compile-ng8xxx
type: standard
gate: [G3, G4]
validates: "Given ... when ... then ..."
verdict: VALIDATED
related: [006]
tags: [storybook, sb10, ng8xxx, forced-install, peer-conflict, gate, engine]
---
```

**Spike-007 "commit the record only" reproduction discipline to mirror** (`007/README.md` lines 43-56):
the isolated scaffold is NOT committed - only the record is. For 011 the substrate is an EXTERNAL clone
(`bluehalo/ngx-leaflet` @ `818e9ae55240b570397ede5a15cb4d466785abdc`, `D:\projects\github\bluehalo\ngx-leaflet`);
document the repo URL + commit SHA + the pack/install commands for reproduction; NEVER commit the clone or
its `node_modules`.

**Assertion-bearing harness pattern to mirror** (`007/harness.mjs` lines 227-279; CONVENTIONS.md
"Assertion-bearing harnesses"): a labelled `[PASS]/[FAIL] id: detail` list via an `assert(id, cond, detail)`
helper, a computed `VERDICT` string, `writeFileSync(..., 'forensic-log.json', ...)` with
environment/versions/scenarios/assertions/verdict, and `process.exit(allPass ? 0 : 1)`:
```javascript
function assert(id, cond, detail) {
  const pass = !!cond;
  results.push({ id, pass, detail });
  console.log(`${pass ? '[PASS]' : '[FAIL]'} ${id}: ${detail}`);
}
// ...
writeFileSync(join(HERE, 'forensic-log.json'), JSON.stringify({
  spike: '011-...', environment: versions, scenarios, assertions: results, verdict,
}, null, 2));
console.log(`\nVERDICT: ${verdict}`);
process.exit(allPass ? 0 : 1);
```

**NG-code decoding helper to reuse for planted-error assertions** (`007/harness.mjs` lines 166-171;
CONVENTIONS.md "NG-code decoding"): Angular encodes `ts.Diagnostic.code === -(990000 + ngNumber)` -
NG8002 = -998002. Use `ngNumber(code)` to assert NG8xxx fired without hardcoding raw codes.

**ESM failure-signature scan (the NO-GO signals; RESEARCH GATE A' step 7):** scan `ng run` stdout/stderr
for `ERR_REQUIRE_ESM`, `require() of ES Module`, `Cannot use import statement outside a module`, and any
project-graph/daemon error thrown BEFORE any diagnostic. Presence of ANY = NO-GO evidence.

**After the run:** add the verdict row to `.planning/spikes/MANIFEST.md` (mirror the table format under
each Idea, e.g. lines 125-129), and surface findings through the `spike-findings-angular-typechecker` skill
(the channel that carried the Phase-16 gate, spikes 006-008).

---

## Shared Patterns

### Static byte-assertion on built dist artifacts
**Source:** `src/executors/typecheck/gate-a-static.spec.ts` (lines 24-51 dist-root derivation; 74-79
`stripCommentLines`; 94-98 negative assertion)
**Apply to:** the extended `gate-a-static.spec.ts` builder-entry assertion.
Derive `distRoot` from `project.json` `build.options.outputPath` (never hard-code), read the built `.js`
via `fs.readFileSync` (dist is gitignored - NEVER `git grep`, per CLAUDE.md), strip full-line comments,
then regex-assert bytes. Prerequisite: `nx build angular-typechecker` ran first (`nx build && nx test`).

### Schema-parity static spec (read schema.json, compare to a bound key set)
**Source:** `src/executors/typecheck/schema-parity.spec.ts` + `src/generators/configuration/schema-parity.spec.ts`
**Apply to:** the new builder `schema-parity.spec.ts`.
`JSON.parse(readFileSync(schemaPath))`, assert `Object.keys(properties).sort()` equals a literal
`EXPECTED_KEYS`, assert `required`/`additionalProperties`/defaults, and assert the presence/absence of
`cli`/`version` (present on executor; ABSENT on builder). Pure filesystem read - runs in the fast `nx test`
loop, no build. Optionally bind `EXPECTED_KEYS` to the interface via `satisfies readonly (keyof T)[]` +
the `AssertAssignable` reverse probe (configuration spec lines 38-56) for compile-time drift protection.

### Union-then-single-`finalize` diagnostic aggregation
**Source:** `src/core/run-typecheck.ts` `handleSolutionWalk` (lines 441-531) + `src/core/walk-references.ts`
`walkReferences` (lines 108-303)
**Apply to:** the new `handleMultiTsConfig` (ENG-01 array path).
Per entry: `readConfiguration` -> `throwIfInfrastructureFailure(parsed.errors)` -> `runNoEmitCompilation`;
accumulate the RAW union (`[...parsed.errors, ...result.diagnostics]`), combined `rootNamePaths`, summed
`rootNamesCount`. Then `throwIfInfrastructureFailure` over the union, and ONE `finalize` over
`[...configDiagnostics, ...union]` with `buildFinalizeFilter(..., combinedRootNamePaths)`. Reuse
`buildFinalizeFilter`/`finalize`/`presentIfNonEmpty`/`throwIfInfrastructureFailure` verbatim.

### Manifest / package.json read-and-assert
**Source:** `src/package-manifest.spec.ts` (lines 29-58 setup; 60-138 assertions)
**Apply to:** the modified `package-manifest.spec.ts` (`files` + `builders`) and the new Nx-surface
regression spec (ACB-03). Typed `PluginManifest` interface, `JSON.parse(readFileSync(manifestPath))`,
`toEqual`/`toBe` on exact field values. Pure, deterministic, no build, no compiler-cli load.

### Spike record-only + assertion-bearing orchestrator discipline
**Source:** `.planning/spikes/CONVENTIONS.md` (lines 26-71) + `.planning/spikes/007-.../` (README + harness)
**Apply to:** the new `011-*` spike record.
README frontmatter (spike/name/type/gate/validates/verdict/related/tags) + What/Research/How to Run/
Investigation Trail/Results; harness ends with `[PASS]/[FAIL]` list + `VERDICT` + `forensic-log.json` +
`process.exit(allPass ? 0 : 1)`; commit the RECORD ONLY (never the external clone or its `node_modules`);
document repo URL + SHA + install reproduction; add the verdict row to MANIFEST.md.

### JS/TS style (project + global convention)
**Source:** existing source (e.g. `executor.ts`, `run-typecheck.ts`, `normalize-options.ts`)
**Apply to:** every new/modified `.ts`/`.mjs`.
Blank line before/AND after `if`/`for`/`return`/`try`/`catch` (see `executor.ts` lines 47-84,
`walk-references.ts` loop body); ALWAYS braces on control-flow bodies (no braceless one-liners); ASCII
only (no emoji/box-drawing/em-dash); Prettier `singleQuote: true`. CI gates on `format:check` + `lint`
(maxWarnings:0) before any Release PR.

---

## No Analog Found

None. Every new/modified file has a concrete in-repo analog. The two closest-to-novel items:

| File | Role | Data Flow | Note |
|------|------|-----------|------|
| `src/builders/typecheck/schema.json` | config | input-validation | No existing schema OMITS `cli:"nx"` (executor + both generators all carry it). The sanitized shape is new, but the STRUCTURE + parity-test pattern are fully analog. RESEARCH Pattern 3 supplies the exact content. |
| `.planning/spikes/011-*/harness.mjs` | spike (orchestrator) | batch/e2e | First spike that drives real `ng run` + `nx build`/`npm pack`/tarball-install instead of a verbatim-engine `.mjs`. Discipline (assertions/forensic/record-only) is analog to 007; the orchestration STEPS are spelled out in RESEARCH GATE A' mechanics (steps 1-10). |

---

## Metadata

**Analog search scope:** `packages/angular-typechecker/src/{executors,builders,core,generators}/**`,
`packages/angular-typechecker/{package.json,executors.json,generators.json,project.json}`,
`.planning/spikes/{CONVENTIONS.md,MANIFEST.md,007-*}`.
**Files scanned:** ~18 read in full (executor, both schemas, normalize-options, gate-a-static.spec,
both schema-parity specs, run-typecheck, walk-references, package.json, executors.json, generators.json,
project.json, package-manifest.spec, run-typecheck.integration.spec, spike-007 README + harness,
CONVENTIONS.md, MANIFEST.md).
**Pattern extraction date:** 2026-07-10
