# Stack Research

**Domain:** Machine-readable reporters (JSON + SARIF 2.1.0) for angular-typechecker v0.2.3 (additive patch)
**Researched:** 2026-07-18
**Confidence:** HIGH (package manifests + API + type defs read from the actual npm tarball; GitHub SARIF requirement confirmed from GitHub Docs; verified against registry.npmjs.org)

## Headline (read first)

- **ONE new runtime dependency** for the whole milestone: `node-sarif-builder@^4.1.0` (MIT, CommonJS, `node>=20`). Everything else the reporters need is already present.
- The **JSON reporter needs ZERO new dependencies** -- `JSON.stringify` + the existing `formatDiagnostics` env-color plumbing cover it.
- `node-sarif-builder` is **plain CommonJS** (no `type` field, `main: dist/index.js`, no `exports` map, body is `"use strict"; require(...)`). So a lazy `await import('node-sarif-builder')` under `module: nodenext` + `type: commonjs` is sound -- **no `ERR_REQUIRE_ESM` is possible**, because the target is CJS, not ESM. (Unlike `@angular/compiler-cli`, node-sarif-builder needs no CJS->ESM bridge at all; both `require()` and `import()` would work. `import()` is chosen only to defer the load.)
- `node-sarif-builder` bakes SARIF **2.1.0** in by construction (`version: '2.1.0'`, `$schema: .../sarif-2.1.0.json`) -- exactly what GitHub Code Scanning `upload-sarif` requires.

## Recommended Stack

### Core Technologies (net-new this milestone)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `node-sarif-builder` | `^4.1.0` (latest, published 2026-04-19) | Build a SARIF 2.1.0 log in memory and serialize to a JSON string | MIT, CommonJS, actively maintained (v4 is 2026), `node>=20` (fits the locked `^22.22.3 \|\| ^24.15.0 \|\| ^26.0.0`). Emits a correct 2.1.0 `$schema`+`version` by construction and auto-fills artifact/rule indices. Lazy-`import()`ed **only** on the `--format sarif` path. Classified as a `dependency`. |

**Everything else the reporters need is already in the stack** (no addition):

| Already present | Used for | Note |
|-----------------|----------|------|
| Node `JSON.stringify` (stdlib) | The entire JSON reporter serialization | REP-01 is a pure function over `CoreResult`; no lib. |
| Existing `formatDiagnostics` + env-color detection (v0.2.2 ARGS-05 / CLIX-02) | `--quiet`, `--color` / `--no-color` | Already shipped; the reporters reuse it, add nothing. |
| `ts.Diagnostic` fields on `CoreResult` (TypeScript, locked peer) | Source of file/line/column/code/category/message for BOTH reporters | The reporters map these; no new parsing dep. |

### Supporting Libraries (transitive -- installed by node-sarif-builder, NOT declared by us)

| Library | Version | Purpose | Supply-chain note |
|---------|---------|---------|-------------------|
| `@types/sarif` | `^2.1.7` (a **runtime `dependency`** of node-sarif-builder, ~74 KB, MIT, types-only) | SARIF 2.1.0 TypeScript types (`Log`, `Run`, `Result`, `Result.level`, `ArtifactLocation`, `Region`, ...) exposed under module name `sarif` | Comes in transitively -- pure `.d.ts`, zero runtime code, no deps. **Correction to the charter wording:** it is a transitive *dependency*, not "bundled" inside the tarball. See dependency-classification below for whether WE declare it. |
| `fs-extra` | `^11.1.1` (a runtime `dependency` of node-sarif-builder) | Backs node-sarif-builder's `generateSarifFile[Sync]` file-writing helpers ONLY | `require('fs-extra')` sits at the top of `sarif-builder.js`, so it loads whenever node-sarif-builder loads -- but node-sarif-builder is itself lazy-`import()`ed, so `fs-extra` never loads on the JSON / human / CLI-flag paths. We call `buildSarifJsonString()` (pure `JSON.stringify`), never the `generateSarifFile*` helpers, so we never exercise `fs-extra` at runtime. Mature, widely-used, low risk. |

### Development Tools (test-only -- validation is a test concern, never a runtime dep)

| Tool | Purpose | Notes |
|------|---------|-------|
| A SARIF 2.1.0 schema validator (e.g. `ajv` + the sarif-2.1.0 JSON schema) | Assert the emitted SARIF validates against 2.1.0 in unit tests | **devDependency only.** Do NOT ship a runtime validator. node-sarif-builder already throws on its own `SARIF_BUILDER_INVALID` sentinels, and GitHub validates on upload. If `ajv` feels heavy for one snapshot test, a committed golden-SARIF snapshot + a shape assertion is enough. Choose per Nyquist-coverage needs. |
| Existing Vitest 4 pyramid | Snapshot JSON + SARIF shapes; real-cold-compiler integration; shipped-tarball e2e | Already in place; no new test framework. |

## `node-sarif-builder@4.1.0` public API (verified from `dist/*.d.ts` in the tarball)

Build-a-log-in-memory-then-serialize flow (the methods the charter asked to confirm -- all real):

```ts
// Type-only imports are ERASED at compile time -> they do NOT trigger the runtime load,
// so they do not defeat laziness. Use them to type the dynamically-imported value.
import type { SarifBuilder, SarifRunBuilder, SarifResultBuilder } from 'node-sarif-builder';

async function toSarif(result: CoreResult, root: string): Promise<string> {
  // Lazy: this is the ONLY place node-sarif-builder (and fs-extra) load.
  const nsb = await import('node-sarif-builder');

  const runB = new nsb.SarifRunBuilder().initSimple({
    toolDriverName: 'angular-typechecker',
    toolDriverVersion: '0.2.3',
    url: 'https://github.com/LayZeeDK/angular-typechecker',
  });

  for (const d of diagnostics) {
    const resB = new nsb.SarifResultBuilder().initSimple({
      level: 'error',            // Result.level union: 'none'|'note'|'warning'|'error' -- pass as a string literal
      messageText: '...',
      ruleId: 'NG8101',          // or 'TS2339' etc.
      fileUri: '...',            // WE own the realpath-normalized, workspace-root-relative URI
      startLine: 1, startColumn: 1, endLine: 1, endColumn: 10,
    });
    runB.addResult(resB);
  }

  const logB = new nsb.SarifBuilder();
  logB.addRun(runB);
  return logB.buildSarifJsonString({ indent: true });   // pure JSON.stringify, no fs
}
```

Confirmed method names (real, from `dist/lib/*.d.ts`):
- `SarifBuilder`: `addRun(runBuilder)`, `buildSarifOutput(): Log`, `buildSarifJsonString({ indent }): string`, plus `generateSarifFile[Sync](file)` (the fs-writing helpers we do NOT use). Constructor defaults `version: '2.1.0'` + `$schema: 'http://json.schemastore.org/sarif-2.1.0.json'`.
- `SarifRunBuilder`: `initSimple({ toolDriverName, toolDriverVersion, url? })`, `addRule(ruleBuilder)`, `addResult(resultBuilder)`, `setToolDriver*`.
- `SarifResultBuilder`: `initSimple({ level, messageText, ruleId, fileUri?, startLine?, startColumn?, endLine?, endColumn? })`, `setLevel/setMessageText/setRuleId/setLocationRegion/setLocationArtifactUri`.
- `SarifRuleBuilder`: rule metadata (map NG/TS codes to rule descriptors if desired -- optional; results carry `ruleId` regardless).

Note: the builder's `initSimple` object API takes only primitives/string-unions, so you can build a complete SARIF log **without importing any `sarif` type** (see classification below).

Minor cosmetic mismatch (harmless): node-sarif-builder emits `$schema` over `http://`, GitHub docs show `https://`. The `$schema` field is advisory; GitHub keys off `version: "2.1.0"`. No action needed.

## Dependency classification (`@nx/dependency-checks`)

| Package | Where it goes | Rationale |
|---------|---------------|-----------|
| `node-sarif-builder` | **`dependency`** (exact or `^4.1.0`), on the published plugin | It is `import()`ed at runtime on the `--format sarif` path. Same class as `@nx/devkit`. Policed by `@nx/dependency-checks`. Add it to the SARIF reporter's import graph so the rule sees it. |
| `@types/sarif` | **Do NOT declare** if you avoid importing `'sarif'` directly (recommended); **direct `devDependency`** only if you reference `Sarif.Log`/`Result`/etc. yourself | node-sarif-builder's `initSimple` object API needs no `sarif` types. Prefer typing your reporter with `import type { ... } from 'node-sarif-builder'` (erased). If you *do* `import type { Result } from 'sarif'`, declare `@types/sarif` as a direct **devDependency** (type-only, compile-time) so `@nx/dependency-checks` stays honest instead of relying on transitive `@types` resolution. Either way it is NEVER a runtime `dependency` of angular-typechecker. |
| `fs-extra` | **Do NOT declare** | Purely transitive via node-sarif-builder; we never import it and never call the methods that use it. Declaring it would be a false dependency. |
| (JSON reporter) | **nothing** | REP-01 uses only Node stdlib + existing code. |

If `@nx/dependency-checks` flags `node-sarif-builder` as "unused" because it is reached only through a lazy `await import()` (dynamic imports can be missed by static import-graph analysis), add it to the rule's allow/`ignoredDependencies`-style config with a one-line comment, or reference it in a way the rule's graph sees. Confirm during Phase execution against the actual lint run.

## Lazy-import soundness under `module: nodenext` + `type: commonjs`

- angular-typechecker is CommonJS built with `module: nodenext`. TypeScript under `node16`/`nodenext` emits `import()` **verbatim** (it does NOT downlevel dynamic `import()` to `require()`) -- this is the exact property the shipped `@angular/compiler-cli` bridge already relies on (v0.0.1 GATE A, PROJECT.md), so it is proven in this repo.
- `node-sarif-builder` is CommonJS, so `await import('node-sarif-builder')` resolves to the CJS module with no interop hazard and **cannot throw `ERR_REQUIRE_ESM`** (that error only arises when CJS `require()`s an ESM-only module; neither condition applies here).
- Therefore both `require('node-sarif-builder')` and `await import('node-sarif-builder')` are technically valid. **Use `await import()`** purely to keep the module (and its `fs-extra`) out of the process on the JSON / human / CLI-flag paths -- a lazy-load optimization and a startup-leanness win, not an interop necessity.

## Installation

```bash
# Core (runtime dependency on the published plugin)
npm install node-sarif-builder@^4.1.0

# Dev dependency ONLY if the reporter imports 'sarif' types directly (otherwise skip)
npm install -D @types/sarif@^2.1.7

# Dev dependency ONLY if you validate SARIF against the 2.1.0 schema in tests (optional)
npm install -D ajv
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `node-sarif-builder` | Hand-build the SARIF JSON object literal (no dep) | Viable -- SARIF 2.1.0 is "just JSON" and you already own the URIs. But you would re-implement artifact/rule index bookkeeping, the `$schema`/`version` header, and the level mapping, and re-validate it forever. The charter deliberately chose the library; keep it. Reconsider only if `@nx/dependency-checks` lazy-import friction proves worse than owning ~60 lines. |
| `node-sarif-builder` | `@microsoft/sarif-multitool` / `sarif` npm tooling | Those are heavyweight CLI/conversion tools, not in-memory builders. Wrong shape for a pure reporter. |
| `JSON.stringify` (JSON reporter) | Any serialization lib | Never -- stdlib is exactly right; a lib would be pure bloat. |
| devDependency `ajv` (test validation) | Committed golden SARIF snapshot + shape assertions | If one dev-dep for one test feels heavy, snapshot the output and assert key fields; node-sarif-builder's internal `SARIF_BUILDER_INVALID` guard already catches gross errors. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| A JSON serialization library | `JSON.stringify` is the correct, zero-cost answer | Node stdlib |
| A color library (chalk/picocolors/etc.) | Color/`--no-color`/`NO_COLOR`/`FORCE_COLOR` already handled by the shipped v0.2.2 formatter (ARGS-05); machine output is uncolored anyway | Existing env-color detection + `formatDiagnostics` |
| A runtime SARIF schema validator | Validation is a TEST concern; shipping a validator adds runtime weight for zero user value; GitHub validates on upload and node-sarif-builder self-guards | devDependency validator in tests only |
| `@types/sarif` as a runtime `dependency` | Types are compile-time only; it is never needed in the shipped runtime graph | devDependency (only if importing `'sarif'` directly), else rely on transitive |
| Declaring `fs-extra` yourself | We never import it; it is transitive and only used by file-writing methods we do not call | Leave it transitive |
| Eagerly `import`ing node-sarif-builder at module top | Loads it (and `fs-extra`) for JSON/human/CLI-flag runs that never emit SARIF | Lazy `await import('node-sarif-builder')` inside the SARIF reporter only; `import type` for the type surface |
| A one-element-array workaround for single input | (Adapter-level, carried from v0.2.2 ARGS-03) unrelated to reporters | n/a -- reporters are pure over `CoreResult` |

## Stack Patterns by Variant

**If `--format json` (REP-01):**
- Pure function `CoreResult -> object -> JSON.stringify`. No dependency loads.
- Surface OBS-01 `totalFilesCount` (optional) in the payload; map each `ts.Diagnostic` to `{ file, line, column, code, category/severity, message }` under a stable, documented schema.

**If `--format sarif` (REP-02):**
- `await import('node-sarif-builder')` inside the reporter (only here). Build one run, one result per kept diagnostic, `buildSarifJsonString({ indent: true })`.
- angular-typechecker owns the realpath-normalized, workspace-root-relative `artifactLocation` URI and passes it as `fileUri`; the builder does the artifact/rule index bookkeeping.

**If neither (default human / `--quiet` / CLI-flag paths):**
- node-sarif-builder and `fs-extra` never load. Startup stays lean and nx-`chalk`-chain-free (the v0.2.2 CLI import-boundary posture is preserved).

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `node-sarif-builder@4.1.0` | Node `^22.22.3 \|\| ^24.15.0 \|\| ^26.0.0` | Declares `engines.node: ">=20"` -- the locked range is a strict subset. OK. |
| `node-sarif-builder@4.1.0` | `module: nodenext` + `type: commonjs` build | CJS module; `await import()` valid, `ERR_REQUIRE_ESM` impossible. |
| `node-sarif-builder@4.1.0` | TypeScript 6.0.3 (locked) | Its own build uses `typescript@^6.0.0` (devDependency); ships prebuilt `.js` + `.d.ts`, so it does not compile against the consumer's TS. Its `.d.ts` are plain and TS6-clean. |
| `@types/sarif@2.1.7` | SARIF 2.1.0 | The `sarif` module = SARIF 2.1.0 types (`Log`/`Run`/`Result`/`ArtifactLocation`/`Region`/`Result.level`). Usable for a typed builder. Last published 2023 but SARIF 2.1.0 is a frozen OASIS standard, so staleness is expected and fine. |
| Emitted SARIF (`version: "2.1.0"`) | GitHub Code Scanning `upload-sarif` | 2.1.0 is the required (and only accepted) version; GitHub consumes a supported subset. Max 10 MB gzipped per file. |

## Sources

- `registry.npmjs.org/node-sarif-builder` (metadata) + the `node-sarif-builder-4.1.0.tgz` tarball (`package.json`, `dist/index.js`, `dist/lib/sarif-builder.{js,d.ts}`, `dist/lib/sarif-run-builder.d.ts`, `dist/lib/sarif-result-builder.d.ts`, `dist/types/node-sarif-builder.d.ts`), read 2026-07-18 -- HIGH: latest `4.1.0` (published 2026-04-19), MIT, `type` absent (=CommonJS), `main: dist/index.js`, no `exports` map, `engines.node ">=20"`, deps `@types/sarif@^2.1.7` + `fs-extra@^11.1.1`; confirmed API (`SarifBuilder`/`SarifRunBuilder`/`SarifResultBuilder`/`SarifRuleBuilder`, `buildSarifOutput`, `buildSarifJsonString`), default `version: '2.1.0'` + `$schema` sarif-2.1.0, `fs-extra` used only in `generateSarifFile*`.
- `registry.npmjs.org/@types/sarif`, read 2026-07-18 -- HIGH: latest `2.1.7` (2023-11-07), MIT, types-only (`index.d.ts`), zero deps, module name `sarif`.
- [SARIF support for code scanning -- GitHub Docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning) -- HIGH: SARIF **2.1.0** is the required and only accepted version; GitHub consumes a supported subset; header should declare `version` + `$schema`.
- [Uploading a SARIF file to GitHub -- GitHub Docs](https://docs.github.com/en/enterprise-server@3.6/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) -- HIGH: `upload-sarif` action; 10 MB gzipped file-size cap; only syntactically valid SARIF processed.
- angular-typechecker `.planning/PROJECT.md` + `.planning/milestones/v0.2.2-REQUIREMENTS.md` -- HIGH (project-internal): locked stack, `module: nodenext`+`type: commonjs` CJS->ESM bridge precedent (v0.0.1 GATE A), env-color/`formatDiagnostics` already shipped (ARGS-05), additive-only charter, `@nx/dependency-checks` policing.

---
*Stack research for: JSON + SARIF machine-readable reporters (angular-typechecker v0.2.3)*
*Researched: 2026-07-18*
