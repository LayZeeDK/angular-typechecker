# Phase 31: SARIF reporter - Research

**Researched:** 2026-07-18
**Domain:** SARIF 2.1.0 machine-readable reporter for a multi-adapter Angular type-check plugin (additive patch `0.2.2 -> 0.2.3`)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (file-less rep):** File-less diagnostics (synthesized 90001/90002, global TS) become **no-location results** in `results[]` and are NEVER dropped. The verdict / exit code -- NOT the SARIF -- is the authoritative fail signal for them; the exit code stays IDENTICAL to the human/JSON runs for the same input. (Rejected: anchoring a synthetic 1:1:1:1 region on the tsconfig.)
- **D-02 (partialFingerprints):** Self-compute `partialFingerprints` as a `sha256` hex digest (Node stdlib `crypto` -- ZERO new dep) over a stable OS-invariant tuple: humanized `ruleId` + repo-relative forward-slash URI + flattened (ANSI-free) message + 1-based `startLine`. Store under a VERSIONED key `atcFingerprint/v1`. NO absolute path, NO `cwd`, NO volatile field in the hash. File-less diagnostics still get a fingerprint (empty-URI sentinel).
- **D-03 (lazy boundary + interop):** `renderReport`'s `sarif` branch reaches the reporter ONLY via `await import('./sarif-report')`; `sarif-report.ts` in turn does `await import('node-sarif-builder')` and accesses the API via defensive `(mod.default ?? mod)`. Human / JSON / `--help` / CLI-boot never load it (require-graph guard, VER-04). Proven by a REAL-import integration test (VER-04).
- **D-04 (typing):** Type the builder API via `import type { ... } from 'node-sarif-builder'` (erased at compile). Do NOT add `@types/sarif` as a devDependency and do NOT `import ... from 'sarif'`.
- **D-05 (dep classification):** Declare `node-sarif-builder@^4.1.0` (MIT, CommonJS, `engines.node >=20`) as a runtime `dependency`. If `@nx/dependency-checks` cannot see the lazy-only `import()`, add `node-sarif-builder` to `ignoredDependencies` with a one-line comment -- resolve against the REAL lint run during execution (do NOT infer). Use `buildSarifJsonString({ indent: false })`; the builder bakes `version: "2.1.0"` + `$schema` in and auto-fills artifact/rule indices.
- **D-06 (rules[] catalog):** Catalog EXACTLY the 18 NG8xxx extended diagnostics, driven from `core/extended-catalog.members.ts` (the enum truth -- never a hand-maintained list; a drift tripwire already guards that file). Each rule carries `id` = humanized `NG8xxx`, `name`, `shortDescription`, and a `helpUri` to the Angular extended-diagnostics docs. TS#### / ATC9000x results reference their rule by `ruleId` WITHOUT a `driver.rules[]` catalog entry. Let the builder own `ruleIndex` linkage -- add each distinct rule once, set only `ruleId` on the result.
- **D-07 (validation scope):** Phase 31 ships the SARIF Unit tier ONLY -- deterministic golden-snapshot + shape unit specs (driver / rules / results / locations / 1-based region / `partialFingerprints`; no `\x1b` byte under `FORCE_COLOR=1`; file-less no-location; exit-code PARITY with human/JSON incl. coverage-incomplete `errorCount === 0` / `success === false`). The reporter is a PURE `(CoreResult, ts) => string` and NEVER re-derives `success`. Full SARIF 2.1.0 schema validation (ajv/golden-schema in CI), cross-OS/Node byte-determinism, and shipped-tarball e2e are Phase 32 (VER-02/VER-03) -- do NOT pull forward.
- **D-08 (additive-only):** `--format sarif` is purely additive: `--format` omitted => human output byte-identical to `@0.2.2`; `renderReport` stays out of the public barrel; `builder.ts` byte-unchanged; `node-sarif-builder` is the only new runtime dep; `index.drift.ts` / public barrel unchanged. Patch bump `0.2.2 -> 0.2.3`.

### Claude's Discretion (planner-owned)
- The exact `partialFingerprints` tuple field order / separator and the hash-input serialization, the internal signature of the shared-projection reuse in `sarif-report.ts`, the precise NG8xxx `shortDescription` / `helpUri` strings, and the golden-snapshot fixture layout -- provided the observable SARIF matches D-01..D-07 and the additive-only charter (D-08) holds.

### Deferred Ideas (OUT OF SCOPE)
- Full SARIF 2.1.0 schema validation in CI, cross-OS/Node byte-determinism, shipped-tarball e2e across all three adapters, the additive-only git-diff audit vs `@0.2.2`, README `## Machine-readable output` + curated CHANGELOG -- **Phase 32** (VER-02, VER-03, ADD-01, DOC-01).
- Published hosted `$schema` URL (REP-04), `--output <file>` (CLIX-03), other formats (REP-03), `relatedInformation` -> `relatedLocations` (REP-05) -- future milestones.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REP-02 | `--format sarif` emits valid SARIF 2.1.0 for GitHub `upload-sarif` -- `runs[].tool.driver` (name/version/informationUri + `rules[]` catalog for the 18 NG8xxx) and `results[]` (humanized `ruleId`, mapped `level`, `message.text`, `locations[]` with repo-relative forward-slash `artifactLocation.uri` + 1-based `region` + self-computed `partialFingerprints`), deterministic ordering. Built with `node-sarif-builder@^4.1.0` lazy-`import()`ed ONLY on the SARIF path. File-less diagnostics represented, never dropped. | The full build sequence, the `(mod.default ?? mod)` interop, the file-less no-location behavior, the `partialFingerprints` write path, deterministic byte-identical output, and the 18-code catalog are all EMPIRICALLY VERIFIED against the real 4.1.0 package this session (see Open Questions Resolved 1-5). URIs/positions/codes are inherited from the shipped `core/diagnostic-record.ts` projection (D-13). |
| VER-04 | A require-graph guard proves human / JSON / `--help` / CLI-boot never load `node-sarif-builder`; a REAL-import (not mock) integration test proves the CJS-under-`await import()` interop (`(mod.default ?? mod)`); confirm/resolve `@nx/dependency-checks` lazy-only-import visibility. | The `bin-static.spec.ts` static-require-graph walk is the exact reusable pattern (Open Question 7); the real-import test is scripted below (verified working this session); the `@nx/dependency-checks` outcome + exact fallback is in Open Question 2. |

VER-01's SARIF-shape Unit specs ride along in this phase (per REQUIREMENTS' VER-01 note); full cross-format exit-code parity is exercised once SARIF exists.
</phase_requirements>

## Summary

Phase 31 is small and low-risk because Phase 30 already did the structural work. The `--format sarif` enum VALUE is already threaded through every adapter (both `schema.json`s, `parse-args.ts`, `normalize-options.ts`, `schema.d.ts`, both `schema-parity` specs), `format` already flows to `renderReport`, and `renderReport`'s `sarif` branch already exists -- it just `throw`s `'Phase 31'`. The phase replaces that throw with `await import('./sarif-report')` and ships one new pure module `core/sarif-report.ts` plus the two VER-04 guards.

The reporter is nearly mechanical because it REUSES the shipped `core/diagnostic-record.ts` projection (D-13). `toDiagnosticRecord(diagnostic, ts_, pathBase)` already produces the humanized `code` (`NG8xxx`/`TS####`/`ATC9000x`), the repo-relative forward-slash `file`, the 1-based `line`/`column`/`endLine`/`endColumn` (or `null`), the `severity`, and the ANSI-free `message`. The SARIF reporter maps that record straight into `node-sarif-builder` calls. **This means Pitfalls 3 (off-by-one), 4/8 (URI normalization), and 6 (ruleId) are ALREADY SOLVED by the shared projection -- the SARIF reporter MUST NOT re-implement any of them; it must read `record.file` / `record.code` / `record.line` and never call `path.relative` or `ngCodeOf` itself.** All that is genuinely SARIF-specific is: a `severity -> SARIF level` map (`suggestion`/`message` -> `note`), the `sha256` fingerprint, the 18-rule catalog, and the builder assembly.

Every SARIF-specific mechanic was verified against the REAL `node-sarif-builder@4.1.0` this session (npm `view` + tarball `.d.ts` read + a fresh `npm install` + two runnable scripts): the CJS-under-`await import()` shape, the minimal `initSimple` call sequence, the file-less no-location result, the `partialFingerprints` write path, and two-build byte-determinism. The one item that genuinely cannot be settled by inference is whether `@nx/dependency-checks` sees the lazy-only dynamic import -- resolve it against the real `nx lint` run (exact fallback provided).

**Primary recommendation:** Ship `core/sarif-report.ts` as a thin adapter over `toDiagnosticRecord` + `node-sarif-builder`, reached only via `await import()`; source the 18 NG codes from a small enum-keyed production catalog (the mapping today lives only in a test file -- promote it to one source); guard laziness with a `bin-static`-style static require-graph walk retargeted to `node-sarif-builder`/`fs-extra`; and prove interop with a real-import test.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SARIF envelope assembly + serialization | Pure core (`core/sarif-report.ts`) | -- | Reporters are pure `(CoreResult, ts) => string`; no I/O, no verdict (established split) |
| Per-diagnostic normalization (positions/codes/paths) | Pure core (`core/diagnostic-record.ts`, shipped) | -- | D-13 anti-drift: JSON + SARIF share ONE projection so they cannot diverge |
| Format dispatch + lazy import boundary | Pure core (`core/render-report.ts`, shipped seam) | -- | The one seam all three adapters call; `await import('./sarif-report')` is the firewall |
| `node-sarif-builder` SARIF-object bookkeeping | External dep (lazy) | -- | Owns `$schema`/`version`, artifact/rule indices; angular-typechecker owns the URI it feeds in |
| `--format` selection + stdout write + `pathBase` | Adapters (CLI/executor/builder) | -- | Already threaded in Phase 30; unchanged this phase |
| Verdict / exit code | Pure core (`evaluate-result.ts`/`exit-codes.ts`, shipped) | Adapters | UNTOUCHED -- `--format` can never change pass/fail (D-07) |

## Open Questions Resolved (the 7 MEDIUM items)

### 1. `node-sarif-builder@^4.1.0` real API + CJS-under-`await import()` interop `[VERIFIED: npm registry + tarball .d.ts + real install this session]`

**(a) It is plain CommonJS.** `npm view` + the tarball `package.json`: `type` field ABSENT, `main: dist/index.js`, `module: dist/index.js`, `typings: dist/index.d.ts`, NO `exports` map, `engines.node: ">=20"`, no `postinstall`. So `await import('node-sarif-builder')` cannot throw `ERR_REQUIRE_ESM` -- the target is CJS. The lazy import is a startup-leanness win, not an interop necessity.

**(b) Exact export shape via `await import()`.** The compiled `dist/index.js` is:
```js
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SarifResultBuilder = exports.SarifRuleBuilder = exports.SarifRunBuilder = exports.SarifBuilder = void 0;
Object.defineProperty(exports, "SarifBuilder", { enumerable: true, get: () => sarif_builder_1.SarifBuilder });
// ...three more named getters. NO `module.exports =`, NO `exports.default`.
```
Empirically (a real `npm install node-sarif-builder@4.1.0` + `const mod = await import('node-sarif-builder')` under Node 24):
- `Object.keys(mod)` = `['SarifBuilder','SarifResultBuilder','SarifRuleBuilder','SarifRunBuilder','__esModule','default','module.exports']`
- `mod.SarifBuilder` is a `function` (named exports ARE hoisted to the namespace -- cjs-module-lexer detects the `Object.defineProperty` getters), AND
- `mod.default` is an object whose keys are exactly the four builders.

So **`(mod.default ?? mod)` yields `mod.default`, which carries all four builders** -- the D-03 destructure works. The exact line:
```ts
const mod = await import('node-sarif-builder');
const { SarifBuilder, SarifRunBuilder, SarifResultBuilder, SarifRuleBuilder } =
  (mod as { default?: typeof mod } & typeof mod).default ?? mod;
```
(Both `mod.X` and `mod.default.X` work at runtime; the `(mod.default ?? mod)` form is the locked defensive choice and is future-proof if a later release changes the interop shape.)

**(c) Minimal call sequence to a SARIF 2.1.0 string (verified end-to-end this session):**
```ts
const runB = new SarifRunBuilder().initSimple({
  toolDriverName: 'angular-typechecker',
  toolDriverVersion: packageManifest.version,      // read from ../../package.json (json-report.ts:31 pattern)
  url: 'https://github.com/LayZeeDK/angular-typechecker',
});
// 18-rule catalog (D-06): add each ONCE.
runB.addRule(new SarifRuleBuilder().initSimple({
  ruleId: 'NG8109', shortDescriptionText: '...', helpUri: 'https://angular.dev/extended-diagnostics/NG8109',
}));
// One result per diagnostic:
const resB = new SarifResultBuilder().initSimple({
  level, messageText, ruleId, fileUri, startLine, startColumn, endLine, endColumn,
});
resB.result.partialFingerprints = { 'atcFingerprint/v1': hash };   // no initSimple param -- see Q3
runB.addResult(resB);

const logB = new SarifBuilder();
logB.addRun(runB);
return logB.buildSarifJsonString({ indent: false });   // baked $schema + version:"2.1.0"
```
Real `.d.ts` signatures (from the tarball):
- `SarifRunBuilder.initSimple({ toolDriverName: string; toolDriverVersion: string; url?: string }): this` + `addRule(rb)` + `addResult(rb)`.
- `SarifResultBuilder.initSimple({ level: Result.level; messageText: string; ruleId: string; fileUri?: string; startLine?: number; startColumn?: number; endLine?: number; endColumn?: number }): this`. Public field `result: Result`.
- `SarifRuleBuilder.initSimple({ ruleId: string; shortDescriptionText: string; fullDescriptionText?: string; helpUri?: string }): this`.
- `SarifBuilder.buildSarifJsonString(options?: { indent: boolean }): string`; constructor bakes `version: '2.1.0'` + `$schema: 'http://json.schemastore.org/sarif-2.1.0.json'`.
- `Result.level` = `'none' | 'note' | 'warning' | 'error'` (from the transitive `sarif` types). Passing a string literal needs no `sarif` import (D-04 holds).

Verified emitted envelope (`indent:false`): no `\r`, no `\x1b`, `version:"2.1.0"`, and the builder auto-emits a run-level `artifacts[]` with `sourceLanguage:"TypeScript"` derived from each `.ts` `fileUri` (and an empty `artifacts:[]` for a file-less-only run -- no crash).

### 2. `@nx/dependency-checks` visibility of a lazy-only `await import()` `[ASSUMED -- confirm at execute-time per D-05/VER-04]`

The rule is configured at `packages/angular-typechecker/eslint.config.mjs:128-176`: `checkVersionMismatches: false`, `ignoredDependencies: ['nx','@angular-devkit/architect','@angular-devkit/schematics','rxjs']`, plus `@nx/nx-plugin-checks` at `:182-190`. It runs against `**/*.json` (the manifest) and derives usage from Nx's project graph.

**Most-likely outcome (ASSUMED, ~high):** Nx's project-graph dependency analysis (the `@nx/js`/TS import locator) detects dynamic `import('node-sarif-builder')` expressions, not only static imports, and it analyzes every `.ts` file in the project directly (it does not need to FOLLOW the `await import('./sarif-report')` firewall -- `sarif-report.ts` is a project file scanned in place). So declaring `node-sarif-builder` in `dependencies` should satisfy the rule with **no `ignoredDependencies` entry needed** (present-and-used passes both the missing and obsolete checks).

**This cannot be settled by inference (D-05 says so). Exact fallback for the planner:** run `nx lint angular-typechecker` after adding the dep; if the rule reports `node-sarif-builder` as an obsolete/unused dependency, add `'node-sarif-builder'` to the `ignoredDependencies` array at `eslint.config.mjs:164-169` with a one-line comment, e.g.:
```
// node-sarif-builder is reached ONLY through a lazy `await import()` on the
// --format sarif path (D-03/D-05); if @nx/dependency-checks' project-graph
// analysis misses the dynamic import it would flag the declared dep obsolete
// and fail `nx lint` at maxWarnings:0.
```
Do NOT run `eslint --fix` on the manifest (it would rewrite peer ranges; `checkVersionMismatches:false` is deliberate). This mirrors the exact pattern already used for `nx`/`rxjs`/`@angular-devkit/*`.

### 3. `partialFingerprints` recipe -- deterministic across OS/Node `[VERIFIED: crypto + real build this session]`

`node-sarif-builder` has **no `initSimple` parameter for `partialFingerprints`** (confirmed in the `.d.ts` -- the result setters are `setLevel/setMessageText/setRuleId/setLocationRegion/setLocationArtifactUri` only). Write the public field directly BEFORE `addResult`:
```ts
resB.result.partialFingerprints = { 'atcFingerprint/v1': fingerprintOf(record) };
```
Verified this round-trips into the emitted JSON. Node stdlib `crypto` is available with ZERO new dep:
```ts
import { createHash } from 'node:crypto';
function fingerprintOf(record: DiagnosticRecord): string {
  const tuple = [record.code, record.file ?? '', record.message, record.line ?? ''].join('\n');
  return createHash('sha256').update(tuple, 'utf8').digest('hex');
}
```
Determinism (verified: two builds byte-identical): the tuple is `code` (humanized `NG8xxx`/`TS####`/`ATC9000x`) + repo-relative forward-slash `file` (empty-string sentinel when `null`) + flattened ANSI-free `message` + 1-based `line` (empty sentinel when `null`). It contains NO absolute path, NO `cwd`, NO tool version, NO duration -- so it is stable across the OS x Node matrix. The `/v1` key lets a later `/v2` recipe co-exist without churning GitHub alerts (GitHub matches on any fingerprint version). Separator: use a newline (or `\x00`) rather than a space so field boundaries are unambiguous (Claude's discretion per D-02).

### 4. File-less-diagnostic SARIF representation `[VERIFIED: real build this session]`

Confirmed: a SARIF result built via `initSimple({ level, messageText, ruleId })` with **`fileUri` and all four positions OMITTED** produces a result with **no `locations` key at all** (`'locations' in result === false`) -- a spec-valid no-location result (D-01). The file-less result still carries `level`, `message.text`, and `ruleId`. Exact call:
```ts
// record.file === null (synthesized 90001/90002, global TS): omit fileUri + positions.
const resB = new SarifResultBuilder().initSimple({
  level, messageText: record.message, ruleId: record.code,   // no fileUri/startLine/...
});
resB.result.partialFingerprints = { 'atcFingerprint/v1': fingerprintOf(record) };  // still fingerprinted (empty-URI sentinel)
runB.addResult(resB);
```
GitHub GH1001: a locationless result will not DISPLAY as a Code Scanning alert -- acceptable per D-01; the verdict/exit code (identical across formats) is the authoritative fail signal for file-less diagnostics. Drive the branch off `record.file === null` (which is exactly `diagnostic.file === undefined`, since `positionsOf` already returns all-`null` for a file-less diagnostic).

### 5. The 18-NG8xxx `rules[]` catalog -- name-only enum + the code mapping `[VERIFIED: codebase]`

`core/extended-catalog.members.ts` exports `EXTENDED_DIAGNOSTIC_MEMBERS` as a **NAME-ONLY** `as const` of 18 camelCase strings (e.g. `'interpolatedSignalNotInvoked'`) -- it carries NO NG code and NO description. The drift guard (`extended-catalog.drift.ts`) locks only NAME set-equality against the real enum.

**The member -> NG-code mapping currently lives ONLY in a test file** (`core/extended-catalog.integration.spec.ts`, the `CATALOG` table). The SARIF catalog rule `id` MUST equal the humanized `NG8xxx` so `result.ruleId` (from `record.code`) links to it (the builder auto-computes `ruleIndex` on a match -- verified: a located `NG8109` result got `ruleIndex:0`; an `ATC90001` result absent from the catalog got `ruleIndex` undefined, per D-06). The full mapping (from the shipped spec, all 18 in enum-declaration order):

| member | NG code | member | NG code |
|--------|---------|--------|---------|
| invalidBananaInBox | 8101 | interpolatedSignalNotInvoked | 8109 |
| nullishCoalescingNotNullable | 8102 | controlFlowPreventingContentProjection | 8011 |
| optionalChainNotNullable | 8107 | unusedLetDeclaration | 8112 |
| missingControlFlowDirective | 8103 | uninvokedTrackFunction | 8115 |
| missingStructuralDirective | 8116 | unusedStandaloneImports | 8113 |
| textAttributeNotBinding | 8104 | unparenthesizedNullishCoalescing | 8114 |
| uninvokedFunctionInEventBinding | 8111 | uninvokedFunctionInTextInterpolation | 8117 |
| missingNgForOfLet | 8105 | deferTriggerMisconfiguration | 8021 |
| suffixNotSupported | 8106 | skipHydrationNotStatic | 8108 |

**Planner decision (recommended, DRY + anti-drift):** promote this mapping into ONE production module -- e.g. `core/extended-catalog.ts` exporting an enum-keyed table `{ member, ngCode, name, shortDescription }` (one entry per `EXTENDED_DIAGNOSTIC_MEMBERS` member). Add a structure spec asserting `catalog.map(r => r.member)` equals `[...EXTENDED_DIAGNOSTIC_MEMBERS]` (mirrors the integration spec's structure guard at `:240-246`), so the name-completeness stays enum-driven and the existing `extended-catalog.drift.ts` still guards the name set. To avoid a second copy of the ngCode mapping, have `extended-catalog.integration.spec.ts` import `ngCode` from this new module (removing its literal `ngCode:` column) -- then there is exactly ONE ngCode source and zero drift. `id` = `'NG' + ngCode`; `name` = PascalCase member or the doc title; `shortDescription` = a short human phrase; `helpUri` (Q5 sub-point) is derivable per code.

**helpUri per-code is derivable `[VERIFIED: angular.dev]`:** Angular maintains a dedicated page per diagnostic at `https://angular.dev/extended-diagnostics/NG{ngCode}` (confirmed for NG8109; the sidebar lists NG8101/NG8102/... individually). So `helpUri = 'https://angular.dev/extended-diagnostics/NG' + ngCode`. RECOMMEND the planner spot-verify the two lower-numbered outliers -- NG8011 (`controlFlowPreventingContentProjection`) and NG8021 (`deferTriggerMisconfiguration`) -- resolve to pages; if one 404s, drop `helpUri` for just that rule (it is optional metadata).

### 6. Reuse of the shipped `core/diagnostic-record.ts` projection (D-13) `[VERIFIED: codebase]`

Exported surface (all pure, no `@angular/compiler-cli`):
- `interface DiagnosticRecord { file: string|null; line: number|null; column: number|null; endLine: number|null; endColumn: number|null; code: string; rawCode: number; severity: 'error'|'warning'|'suggestion'|'message'; message: string }`
- `toDiagnosticRecord(diagnostic, ts_, pathBase): DiagnosticRecord` -- the whole projection.
- `positionsOf(diagnostic)`, `codeStringOf(rawCode)`, `relativizePath(absolutePath, pathBase)` -- the internals JSON also uses.

**How `core/sarif-report.ts` consumes it (prevents JSON/SARIF drift, D-13):** map EVERY diagnostic through `toDiagnosticRecord(diagnostic, ts_, pathBase)` and read only the record fields -- `record.code` -> `ruleId`; `record.file`/`record.line`/... -> `fileUri`/`startLine`/... (omit when `null`); `record.message` -> `messageText`; `severity -> level` via a local map (`error->error`, `warning->warning`, `suggestion->note`, `message->note`). The SARIF reporter MUST NOT call `path.relative`, `ngCodeOf`, `getLineAndCharacterOfPosition`, or `flattenDiagnosticMessageText` itself -- doing so re-implements the projection and reintroduces the drift D-13 forbids. Because the record is the SAME object the JSON reporter maps, JSON and SARIF cannot disagree on positions/codes/paths, and Pitfalls 3/4/6/8 are inherited-solved.

**`render-report.ts` wiring:** the `sarif` case at `render-report.ts:73-78` currently throws. Replace with:
```ts
case 'sarif': {
  const { formatSarifReport } = await import('./sarif-report');   // lazy firewall (D-03)
  return formatSarifReport(result, ts_, options.pathBase);
}
```
`ts_` is already loaded at the top of `renderReport` (`loadTypescript()`); `options.pathBase` is already threaded (CLI `process.cwd()` at `main.ts:142`; executor `context.root` at `normalize-options.ts:65`; builder inherits). No adapter change is required -- `--format sarif` flows end-to-end once the throw is replaced. Update the spec `render-report.spec.ts:178-182` (the "throws a Phase-31 error" test) to assert the real renderer instead (parse the output, assert `version:"2.1.0"`, no `\x1b`).

### 7. VER-04 guards from shipped patterns `[VERIFIED: bin-static.spec.ts pattern]`

**(a) Require-graph guard** -- clone the `bin-static.spec.ts:78-112` `collectNxRequires` static walk (reads BUILT `dist` `.js`, `dependsOn: build`, `@workspace/test-util` `findWorkspaceRoot`, `REQUIRE_SPECIFIER` regex, `stripCommentLines`, follows only relative `.js` requires). Retarget the forbidden pattern from `/^(@nx\/|nx\/|nx$)/` to `/^(node-sarif-builder|fs-extra)$/` and walk from the built **`render-report.js`** (the shared seam all three formats pass through). Because `render-report.js` reaches `sarif-report.js` only via `await import("./sarif-report")` -- which is `import(...)`, NOT a `require(...)`, so the regex never matches and the walk never enters `sarif-report.js` -- `node-sarif-builder`/`fs-extra` never appear in the static require graph. Assert `violations` is empty. Add a POSITIVE control: assert `render-report.js` source contains `import("./sarif-report")` (proves laziness is present, not that the module is merely absent). Optionally also walk from `bin.js` for an explicit CLI-boot proof (its `require` chain reaches `render-report.js` statically but still never enters `sarif-report.js`).

**(b) Real-import interop test** -- a `test`-tier spec (NOT integration; it needs only `node_modules`, no cold compiler). It does the REAL `await import('node-sarif-builder')`, applies `(mod.default ?? mod)`, and asserts the four builders are constructable and a minimal `buildSarifJsonString({indent:false})` produces `version:"2.1.0"` -- the exact shape verified in this research. This is what a mocked unit test cannot catch (Pitfall 9). Vitest via `@nx/vitest`; place beside `sarif-report.spec.ts`. (The pure golden-snapshot/shape specs MAY mock or feed hand-built diagnostics like `json-report.spec.ts`; at least this ONE test imports the real package.)

## Standard Stack

### Core (net-new this phase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node-sarif-builder` | `^4.1.0` | Build + serialize a SARIF 2.1.0 log in memory | Charter-locked (D-05); MIT, CommonJS, 3.2M weekly downloads, actively maintained; bakes `version:"2.1.0"`+`$schema`, auto-fills artifact/rule indices. Lazy-`import()`ed ONLY on the SARIF path. `[VERIFIED: npm registry]` |

### Reused (already in the tree -- add nothing)
| Asset | Purpose |
|-------|---------|
| `node:crypto` `createHash('sha256')` | `partialFingerprints` (D-02) -- zero new dep `[VERIFIED]` |
| `core/diagnostic-record.ts` `toDiagnosticRecord` | The shared normalized projection (D-13) -- positions/codes/paths/severity/message |
| `core/render-report.ts` seam | Format dispatch + the `await import('./sarif-report')` firewall |
| `core/extended-catalog.members.ts` + `.drift.ts` | The 18-member enum truth + its name-completeness tripwire (drives the catalog) |
| `require('../../package.json').version` | `toolDriverVersion` (the `json-report.ts:31` pattern) |
| `@workspace/test-util` `findWorkspaceRoot` + the `bin-static.spec.ts` walk | The VER-04 require-graph guard |

### Transitive (installed BY node-sarif-builder -- do NOT declare)
| Library | Version | Note |
|---------|---------|------|
| `@types/sarif` | `^2.1.7` | Types-only; resolves transitively. D-04: type via `import type ... from 'node-sarif-builder'`, never `import ... from 'sarif'`. `[VERIFIED: real install]` |
| `fs-extra` | `^11.1.1` | `require`d at the top of `sarif-builder.js`, so it loads WHEN node-sarif-builder loads -- which is only on the SARIF path. We call `buildSarifJsonString` (pure), never the `generateSarifFile*` fs helpers. Never declare it. `[VERIFIED: real install -- fs-extra absent -> load fails, confirming top-level require]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node-sarif-builder` | Hand-build the SARIF object literal (no dep) | Charter-locked to the builder; hand-rolling re-implements `$schema`/`version`/artifact+rule index bookkeeping and re-validates forever. Reconsider only if `@nx/dependency-checks` friction (Q2) proves worse than ~60 hand-maintained lines. |

**Installation (dev repo):**
```bash
npm install node-sarif-builder@^4.1.0 --save --workspace=packages/angular-typechecker
```
Add to `packages/angular-typechecker/package.json` `dependencies` (alongside `@nx/devkit`, `nx`, `tslib`). Do NOT add `@types/sarif` or `fs-extra`.

**Version verification (this session):** `npm view node-sarif-builder@4.1.0` -> `latest = 4.1.0` (published 2026-04-19), `type` absent (CJS), `main: dist/index.js`, `engines.node: ">=20"` (strict superset of the locked `^22.22.3 || ^24.15.0 || ^26.0.0`), deps `@types/sarif@^2.1.7` + `fs-extra@^11.1.1`, no `postinstall`.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `node-sarif-builder` | npm | latest published 2026-04-19 | ~3.2M/wk | github.com/nvuillam/node-sarif-builder | OK | Approved -- add to `dependencies` |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none. (`gsd-tools query package-legitimacy check` -> `OK`: exists, not deprecated, `postinstall: null`, repo present, high downloads.)

## Architecture Patterns

### System Architecture Diagram

```
adapter (CLI / executor / builder)  -- parses --format, computes pathBase, writes stdout
        |  format='sarif', pathBase, color(ignored), maxWarnings/strict
        v
renderReport(result, options)                     [core/render-report.ts, shipped seam]
        |  switch(format)
        |   'human' -> loadCompilerCli() + formatReport   (heavy ESM peer, human ONLY)
        |   'json'  -> formatJsonReport(result, ts_)       (shipped)
        |   'sarif' -> await import('./sarif-report')  <=== LAZY FIREWALL (replaces the throw)
        v
formatSarifReport(result, ts_, pathBase)          [core/sarif-report.ts, NEW]
        |  await import('node-sarif-builder'); (mod.default ?? mod)   <=== lazy dep load
        |  build run.tool.driver + 18-rule catalog (from extended-catalog)
        |  for each diagnostic:
        |     record = toDiagnosticRecord(diagnostic, ts_, pathBase)  <=== SHARED projection (D-13)
        |     result = initSimple({ level<-severity, messageText<-message,
        |                           ruleId<-code, fileUri<-file, region<-line/col })
        |     result.partialFingerprints = { 'atcFingerprint/v1': sha256(tuple) }
        |  buildSarifJsonString({ indent: false })
        v
   returns a STRING -> adapter writes to stdout ONLY
        (evaluateResult/toExitCode consume the SAME CoreResult independently -- verdict never sees format)
```

### Recommended file layout
```
packages/angular-typechecker/src/core/
  sarif-report.ts            # NEW: formatSarifReport (pure, lazy node-sarif-builder)
  sarif-report.spec.ts       # NEW: shape + golden snapshot + off-by-one + no-ANSI + file-less + exit-parity
  sarif-report.interop.spec.ts (or .real.spec.ts)  # NEW: VER-04 real-import interop (test tier)
  sarif-require-graph.spec.ts  # NEW: VER-04 static require-graph guard (reads dist, dependsOn build)
  extended-catalog.ts        # NEW (recommended): enum-keyed {member, ngCode, name, shortDescription}
  render-report.ts           # MODIFY: replace the sarif throw with await import('./sarif-report')
  extended-catalog.integration.spec.ts  # MODIFY (recommended): import ngCode from extended-catalog.ts
```

### Pattern 1: `severity -> SARIF level` (the only SARIF-specific mapping)
```ts
// DiagnosticRecord.severity is 'error'|'warning'|'suggestion'|'message';
// SARIF Result.level is 'error'|'warning'|'note'|'none'.
function toSarifLevel(severity: DiagnosticRecord['severity']): 'error' | 'warning' | 'note' {
  return severity === 'error' ? 'error' : severity === 'warning' ? 'warning' : 'note';
}
```

### Pattern 2: rule catalog once, results by ruleId only (D-06, Pitfall 7)
Add the 18 `SarifRuleBuilder` rules ONCE via `runB.addRule(...)`; set only `ruleId` on each result. The builder computes `ruleIndex` when a result's `ruleId` matches a catalog `id` (verified: match -> `ruleIndex:0`; no match -> omitted). NEVER hand-compute `ruleIndex`.

### Anti-Patterns to Avoid
- **Re-implementing URI/position/code logic in `sarif-report.ts`** -- reuse `toDiagnosticRecord` (D-13). Calling `path.relative`/`ngCodeOf`/`getLineAndCharacterOfPosition` here reintroduces drift.
- **Eager `import { SarifBuilder } from 'node-sarif-builder'` at module top of `render-report.ts` or an adapter** -- loads the dep (+ `fs-extra`) on every human/JSON/boot run. Reach it ONLY via `await import()` inside `sarif-report.ts` (D-03).
- **Deriving the URI from `process.cwd()` / the builder's `SARIF_URI_ABSOLUTE` example** -- angular-typechecker owns the URI (it comes from `record.file`, already relativized to `pathBase`). Pass `fileUri` in; never let the builder guess.
- **A `try/catch` around the reporter that swallows to success** -- a reporter throw is infrastructure (exit 2), never a swallowed pass (D-07, Pitfall 13).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SARIF 2.1.0 envelope + indices | A hand-written object literal | `node-sarif-builder` (charter D-05) | Auto `$schema`/`version`/`ruleIndex`/`artifacts[]`; spec-conformant by construction |
| 0-based -> 1-based positions | A new `+1` helper | `toDiagnosticRecord` (`positionsOf`) | Shipped, file-less-safe, single off-by-one site (D-13) |
| Repo-relative forward-slash URI | `path.relative(...).replace(/\\/g,'/')` in the reporter | `record.file` from `toDiagnosticRecord` | Shipped `relativizePath`; JSON already uses it -- prevents drift |
| Humanized `ruleId` (`NG8109`/`TS2322`) | `'NG'+ngCodeOf(code)` in the reporter | `record.code` | Shipped `codeStringOf`; identical to the JSON code string |
| Fingerprint hashing | A custom hash / a hash lib | `node:crypto` `createHash('sha256')` | Stdlib, zero dep, deterministic (D-02) |
| Require-graph laziness proof | A new walker | Clone `bin-static.spec.ts` `collectNxRequires` | Proven static-walk pattern; just retarget the specifier regex |

**Key insight:** the SARIF reporter is a THIN mapping over `toDiagnosticRecord` + `node-sarif-builder`. Everything hard (positions, paths, codes, message flattening) is already solved upstream; hand-rolling any of it is the drift D-13 exists to prevent.

## Common Pitfalls

### Pitfall 1: Re-implementing the projection instead of reusing it (drift)
**What goes wrong:** `sarif-report.ts` computes its own URI/position/code, and SARIF silently diverges from JSON on the same diagnostic.
**How to avoid:** map through `toDiagnosticRecord`; read only record fields. (D-13.)
**Warning signs:** a SARIF `region` or `uri` that differs from the JSON payload's `line`/`file` for the same fixture.

### Pitfall 2: `ruleId` / catalog `id` mismatch breaks `ruleIndex` linkage
**What goes wrong:** catalog uses `id: 'interpolatedSignalNotInvoked'` (the member name) while results use `ruleId: 'NG8109'` -> no linkage.
**How to avoid:** catalog `id` = `'NG'+ngCode`; results `ruleId` = `record.code`. Both resolve to `NG8109`. Verified the builder then sets `ruleIndex` automatically.
**Warning signs:** every NG result has an undefined `ruleIndex` in a golden snapshot.

### Pitfall 3: File-less diagnostic dropped or crashes the reporter (silent false pass)
**What goes wrong:** the reporter assumes every diagnostic has a `file` -> crash or omission; a dropped file-less error makes the SARIF say "clean" while the verdict fails.
**How to avoid:** branch on `record.file === null` -> `initSimple` without `fileUri`/positions (verified: no `locations` key). Map EVERY diagnostic one-to-one. (D-01, Pitfall 10.)
**Warning signs:** SARIF `results.length` < `CoreResult.diagnostics.length`.

### Pitfall 4: Verdict/exit coupling via `--format`
**What goes wrong:** the SARIF path re-derives success from counts, or a reporter throw flips exit 2 to a pass.
**How to avoid:** pure `(CoreResult, ts) => string`; `evaluateResult`/`toExitCode` stay the sole owners; a throw propagates as infra. Assert IDENTICAL exit code across `human`/`json`/`sarif` for the same input, including the coverage-incomplete `errorCount===0`/`success===false` case. (D-07, Pitfall 13.)

### Pitfall 5: Non-deterministic golden snapshot
**What goes wrong:** the golden SARIF embeds the tool version (bumps every release) or relies on an unstable field.
**How to avoid:** redact `driver.version` in the snapshot (`expect.any(String)` / normalize before compare). The rest is deterministic (verified two-build byte-identity). The builder's property EMISSION order is builder-internal, not `initSimple` order -- snapshot the ACTUAL builder output, don't hand-author expected field order. (Pitfall 12.)

### Pitfall 6: Eager load defeats the firewall
**What goes wrong:** a static `import 'node-sarif-builder'` (or a static `require('./sarif-report')`) pulls the dep + `fs-extra` onto the boot path.
**How to avoid:** `await import()` at both layers (D-03); the require-graph guard (VER-04) locks it. The `$schema` is `http://` not `https://` (harmless -- GitHub keys off `version:"2.1.0"`); do not "fix" it.

## Code Examples

### `core/sarif-report.ts` skeleton (verified mechanics)
```ts
import { createHash } from 'node:crypto';

import type ts from 'typescript';
import type {
  SarifBuilder as SarifBuilderCtor,
  SarifRunBuilder as SarifRunBuilderCtor,
  SarifResultBuilder as SarifResultBuilderCtor,
  SarifRuleBuilder as SarifRuleBuilderCtor,
} from 'node-sarif-builder';                       // D-04: erased at compile

import { toDiagnosticRecord, type DiagnosticRecord } from './diagnostic-record';
import type { CoreResult } from './run-typecheck';
import { EXTENDED_DIAGNOSTIC_CATALOG } from './extended-catalog';   // NEW enum-keyed table (Q5)

const packageManifest = require('../../package.json') as { version: string };
const INFORMATION_URI = 'https://github.com/LayZeeDK/angular-typechecker';

export async function formatSarifReport(
  result: CoreResult,
  ts_: typeof import('typescript'),
  pathBase: string | undefined,
): Promise<string> {
  const mod = await import('node-sarif-builder');          // lazy dep load (D-03)
  const { SarifBuilder, SarifRunBuilder, SarifResultBuilder, SarifRuleBuilder } =
    (mod as { default?: typeof mod } & typeof mod).default ?? mod;

  const runB = new SarifRunBuilder().initSimple({
    toolDriverName: 'angular-typechecker',
    toolDriverVersion: packageManifest.version,
    url: INFORMATION_URI,
  });

  for (const entry of EXTENDED_DIAGNOSTIC_CATALOG) {       // D-06: all 18, once
    runB.addRule(
      new SarifRuleBuilder().initSimple({
        ruleId: 'NG' + entry.ngCode,
        shortDescriptionText: entry.shortDescription,
        helpUri: 'https://angular.dev/extended-diagnostics/NG' + entry.ngCode,
      }),
    );
  }

  for (const diagnostic of result.diagnostics) {           // already sorted+deduped
    const record = toDiagnosticRecord(diagnostic, ts_, pathBase);   // D-13 shared projection
    const resB = new SarifResultBuilder().initSimple({
      level: toSarifLevel(record.severity),
      messageText: record.message,
      ruleId: record.code,
      ...(record.file !== null
        ? {
            fileUri: record.file,
            startLine: record.line ?? undefined,
            startColumn: record.column ?? undefined,
            endLine: record.endLine ?? undefined,
            endColumn: record.endColumn ?? undefined,
          }
        : {}),                                             // D-01: file-less -> no location
    });
    resB.result.partialFingerprints = { 'atcFingerprint/v1': fingerprintOf(record) };
    runB.addResult(resB);
  }

  const logB = new SarifBuilder();
  logB.addRun(runB);

  return logB.buildSarifJsonString({ indent: false });     // baked $schema + version:"2.1.0"
}

function toSarifLevel(severity: DiagnosticRecord['severity']): 'error' | 'warning' | 'note' {
  return severity === 'error' ? 'error' : severity === 'warning' ? 'warning' : 'note';
}

function fingerprintOf(record: DiagnosticRecord): string {
  const tuple = [record.code, record.file ?? '', record.message, record.line ?? ''].join('\n');

  return createHash('sha256').update(tuple, 'utf8').digest('hex');
}
```
(Types annotate locals if desired, e.g. `const resB: SarifResultBuilderCtor = ...` -- erased at compile per D-04.)

### VER-04 require-graph guard (clone of `bin-static.spec.ts`)
```ts
const FORBIDDEN = /^(node-sarif-builder|fs-extra)$/;       // retargeted from the nx pattern
// ...collectRequires(renderReportJsPath) using the bin-static.spec.ts walk...
expect(violations).toEqual([]);                            // never on the static require graph
expect(readFileSync(renderReportJsPath, 'utf8')).toContain('import("./sarif-report")'); // laziness present
```

### VER-04 real-import interop (test tier)
```ts
it('the real node-sarif-builder is reachable via (mod.default ?? mod) and builds 2.1.0', async () => {
  const mod = await import('node-sarif-builder');
  const { SarifBuilder, SarifRunBuilder } = (mod as any).default ?? mod;
  const runB = new SarifRunBuilder().initSimple({ toolDriverName: 'x', toolDriverVersion: '0.0.0' });
  const logB = new SarifBuilder();
  logB.addRun(runB);
  const json = JSON.parse(logB.buildSarifJsonString({ indent: false }));

  expect(json.version).toBe('2.1.0');
});
```

## Runtime State Inventory

Not applicable -- this phase is purely additive code (a new pure module + specs + one throw-replacement + one manifest dependency). No rename/refactor/migration, no stored data, no live-service config, no OS-registered state, no secret/env-var rename. **None -- verified: the phase adds files and one dependency; it changes no persisted or externally-registered state.**

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ARCHITECTURE.md "compute `path.relative(pathBase, file.fileName)` in the SARIF reporter" | Reuse `record.file` from `toDiagnosticRecord` | Phase 30 shipped `diagnostic-record.ts` (D-13) | URI/position/code logic is now upstream; the SARIF reporter must NOT re-derive |
| Research cites node-sarif-builder "v3.x" | `^4.1.0` (published 2026-04-19) | STACK tarball read, re-verified this session | API stable across both; use 4.1.0 |

**Deprecated/outdated:** none relevant. `@types/sarif@2.1.7` is from 2023 but SARIF 2.1.0 is a frozen OASIS standard -- staleness is expected and fine.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@nx/dependency-checks` detects the lazy-only `await import('node-sarif-builder')` via Nx's project-graph analysis, so declaring the dep satisfies the rule with NO `ignoredDependencies` entry. | Open Q2 | LOW -- if wrong, `nx lint` fails loudly at maxWarnings:0; the exact fix (add to `ignoredDependencies:164-169` with a comment) is documented. D-05/VER-04 already require resolving this at the real lint run, so it is a caught-at-execute item, not a silent risk. |
| A2 | `helpUri` pages exist for ALL 18 codes at `angular.dev/extended-diagnostics/NG{code}` (NG8109 verified; the lower-numbered NG8011 / NG8021 not individually checked). | Open Q5 | LOW -- `helpUri` is optional SARIF metadata; a 404 on one rule means dropping just that rule's `helpUri`. Planner should spot-verify NG8011 + NG8021. |

**Everything else in this research was VERIFIED (real package/codebase/build this session) or CITED (angular.dev, GitHub SARIF docs) -- these two are the only claims needing confirmation.**

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `node-sarif-builder` | REP-02 SARIF reporter | installable (npm) | `4.1.0` | none -- charter-locked dep; `npm install --save` in the plugin workspace |
| `node:crypto` | `partialFingerprints` (D-02) | yes (Node stdlib) | -- | none needed |
| Node runtime | build + test | yes | 24.x (dev host); locked range `^22.22.3 \|\| ^24.15.0 \|\| ^26.0.0` (superset of node-sarif-builder's `>=20`) | -- |

**Missing dependencies with no fallback:** none (node-sarif-builder installs cleanly; transitive `@types/sarif` + `fs-extra` resolve automatically -- verified via a fresh `npm install` this session).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4 via `@nx/vitest:test` |
| Config file | `packages/angular-typechecker/vitest.config.*` (unit `test` tier, `dependsOn: build`) + `vitest.integration.config.*` (real cold compiler) |
| Quick run command | `nx test angular-typechecker` |
| Full suite command | `nx test angular-typechecker && nx typecheck angular-typechecker && nx lint angular-typechecker` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REP-02 | SARIF shape: driver/rules/results/1-based region/partialFingerprints, no `\x1b` under `FORCE_COLOR=1`, deterministic golden snapshot | unit (test tier) | `nx test angular-typechecker` | Wave 0 (`sarif-report.spec.ts`) |
| REP-02 | File-less diagnostic -> no-location result, never dropped | unit | `nx test angular-typechecker` | Wave 0 |
| REP-02/VER-01 | Exit-code PARITY across human/json/sarif incl. coverage-incomplete (`errorCount===0`/`success===false`) | unit | `nx test angular-typechecker` | Wave 0 (extend the shipped parity spec) |
| REP-02 | Off-by-one: hand-counted position fixture (both start AND end axes) | unit | `nx test angular-typechecker` | Wave 0 (mirror `json-report.spec.ts:37-57`) |
| VER-04 | Human/JSON/boot never statically require `node-sarif-builder`/`fs-extra` | test tier (reads dist) | `nx test angular-typechecker` | Wave 0 (`sarif-require-graph.spec.ts`) |
| VER-04 | REAL-import CJS interop `(mod.default ?? mod)` builds 2.1.0 | test tier | `nx test angular-typechecker` | Wave 0 (`sarif-report.interop.spec.ts`) |
| REP-02 | Catalog covers exactly the 18 members (enum-driven) | unit | `nx test angular-typechecker` | Wave 0 (if `extended-catalog.ts` added) |

### Sampling Rate
- **Per task commit:** `nx test angular-typechecker`
- **Per wave merge:** `nx test angular-typechecker && nx typecheck angular-typechecker && nx lint angular-typechecker --maxWarnings=0`
- **Phase gate:** full suite green before `/gsd:verify-work`. **CRITICAL (repo lesson):** `nx test` (Vitest/esbuild) does NOT type-check specs -- ALSO run `nx typecheck angular-typechecker` (which runs `tsc --noEmit` over `tsconfig.spec.json` + the drift tsconfig) and `nx format:check` before considering the phase done.

### Wave 0 Gaps
- [ ] `core/sarif-report.spec.ts` -- shape/golden/off-by-one/no-ANSI/file-less/exit-parity (REP-02, VER-01)
- [ ] `core/sarif-report.interop.spec.ts` -- REAL-import interop (VER-04)
- [ ] `core/sarif-require-graph.spec.ts` -- static require-graph guard (VER-04)
- [ ] (recommended) `core/extended-catalog.spec.ts` -- one entry per `EXTENDED_DIAGNOSTIC_MEMBERS`
- [ ] Update `core/render-report.spec.ts:178-182` (replace the sarif-throws test with the real renderer)
- Framework install: none -- Vitest + `@nx/vitest` already present.

## Security Domain

> `security_enforcement` is not set in config (absent = enabled). This is a pure reporter; the surface is output encoding + path/info disclosure, not auth/session/access-control.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | no | -- |
| V5 Input Validation / Output Encoding | yes | Diagnostic message text is serialized by `node-sarif-builder` (`JSON.stringify` internally) -- quotes/newlines/control chars are escaped; NEVER hand-concatenate SARIF JSON |
| V6 Cryptography | yes (hashing only) | `partialFingerprints` uses `node:crypto` sha256 for IDENTITY, not secrecy -- no keys, no secrets; never hand-roll a hash |

### Known Threat Patterns for a diagnostics reporter
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Absolute local path (`D:\Users\...`) leaked into a SARIF committed/uploaded to a public repo | Information Disclosure | Repo-relative forward-slash URI from `record.file` (`relativizePath`) -- inherited from D-13; assert no drive letter / no leading `/` / no `\` in URIs |
| Dependency (node_modules) diagnostic TEXT emitted into the payload | Information Disclosure | Reporter emits only `CoreResult.diagnostics` (already boundary-filtered); node_modules suppressions are counts, never text (shipped invariant) |
| Malformed SARIF from unescaped message content | Tampering | Let the builder serialize; never string-concat JSON |
| Supply-chain (the one new dep) | Tampering | `node-sarif-builder` legitimacy verdict `OK` (3.2M downloads, repo present, no `postinstall`); lazy-loaded only on the SARIF path |

## Sources

### Primary (HIGH confidence)
- **The real `node-sarif-builder@4.1.0` package** -- `npm view` metadata + `npm pack`/tarball `dist/index.js` + all four `dist/lib/*.d.ts` + a fresh `npm install` + two runnable scripts (interop shape, full build sequence, file-less no-location, `partialFingerprints` write path, two-build byte-determinism). Read/executed 2026-07-18.
- **The shipped codebase** (`packages/angular-typechecker/src/`): `core/diagnostic-record.ts`, `core/render-report.ts`, `core/json-report.ts`, `core/extended-catalog.members.ts` + `.drift.ts`, `core/extended-catalog.integration.spec.ts` (the member->ngCode mapping), `core/diagnostic-codes.ts`, `cli/bin-static.spec.ts` (the require-graph pattern), `eslint.config.mjs` (`@nx/dependency-checks`), `package.json`, `cli/main.ts` + `executors/typecheck/normalize-options.ts` (pathBase/format wiring), `core/render-report.spec.ts` + `core/json-report.spec.ts` (test patterns).
- **`gsd-tools query package-legitimacy check`** -> `node-sarif-builder` = `OK`.
- `.planning/research/v0.2.3-reporters/{SUMMARY,STACK,ARCHITECTURE,PITFALLS,FEATURES}.md` -- the HIGH-confidence milestone research this phase turns into plan-ready specifics.
- `.planning/phases/31-sarif-reporter/31-CONTEXT.md` (D-01..D-08); `.planning/REQUIREMENTS.md` (REP-02, VER-04).

### Secondary (MEDIUM confidence)
- angular.dev "Extended diagnostics" -- per-code page pattern `angular.dev/extended-diagnostics/NG####` (NG8109 fetched + confirmed; sidebar lists NG8101/NG8102/... individually).
- GitHub Docs "SARIF support for code scanning" (via the milestone research) -- required fields, 1-based regions, GH1001 locationless behavior, `partialFingerprints` matching.

### Tertiary (LOW confidence)
- `@nx/dependency-checks` dynamic-import detection (A1) -- reasoned from the rule's project-graph mechanics; NOT run this session (D-05 mandates confirming at the real `nx lint`).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- the one dep verified against the real 4.1.0 tarball + install + legitimacy `OK`.
- Architecture / reuse (D-13, seam wiring): HIGH -- read line-by-line against shipped source; the sarif branch + pathBase/format threading already exist.
- SARIF mechanics (interop, file-less, fingerprints, catalog linkage, determinism): HIGH -- empirically executed against the real package this session.
- `@nx/dependency-checks` lazy-import behavior: MEDIUM (A1) -- confirm at execute-time; exact fallback documented.

**Research date:** 2026-07-18
**Valid until:** ~2026-08-17 (node-sarif-builder API is stable across 3.x/4.x; SARIF 2.1.0 is frozen; re-verify only if the dep majors)
