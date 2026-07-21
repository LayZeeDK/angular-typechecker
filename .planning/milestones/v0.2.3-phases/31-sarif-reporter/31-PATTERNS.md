# Phase 31: SARIF reporter - Pattern Map

**Mapped:** 2026-07-18
**Files analyzed:** 11 (6 new, 5 modified/conditional)
**Analogs found:** 11 / 11 (every file has a same-repo analog; `node-sarif-builder` is the only external, and it has an in-repo lazy-import precedent)

RESEARCH.md already identified every analog with line numbers; this map confirms
each against the live tree and pins the exact excerpts the planner copies from. The
SARIF reporter is a THIN transform over two shipped assets (`toDiagnosticRecord` +
the `json-report.ts` structure), so most patterns are copy-with-rename, not net-new.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| NEW `core/sarif-report.ts` (`formatSarifReport`) | utility (pure reporter) | transform (CoreResult -> string) | `core/json-report.ts` | exact (same `(CoreResult, ts_, opts) => string` contract; same `toDiagnosticRecord`/`relativizePath` reuse; same manifest read) |
| MODIFY `core/render-report.ts` | utility (dispatch seam) | transform / dispatch | itself (`json` case + `human` lazy-load) | exact (replace the `sarif` throw at :73-78 with `await import('./sarif-report')`) |
| NEW `core/sarif-report.spec.ts` | test | transform (unit) | `core/json-report.spec.ts` | exact (hand-built `ts.Diagnostic` factories, off-by-one fixture, no-ANSI/FORCE_COLOR, exit-parity, snapshot+version-redact, key drift-lock) |
| NEW `core/sarif-require-graph.spec.ts` | test | file-I/O (static walk over built `dist`) | `cli/bin-static.spec.ts` | exact (clone `collectNxRequires`; retarget regex + entry file) |
| NEW `core/sarif-report.interop.spec.ts` | test | request-response (REAL `await import()`) | `core/compiler-loader.spec.ts` | role-match (real await-import of a CJS/ESM module + assert the namespace shape; test tier, node_modules only) |
| NEW (recommended) `core/extended-catalog.ts` | config / data (rules[] catalog source) | transform (static table) | `core/extended-catalog.members.ts` + `CATALOG` table in `extended-catalog.integration.spec.ts:84-235` | exact (dependency-free `as const` idiom + the member->ngCode rows to promote) |
| NEW (recommended) `core/extended-catalog.spec.ts` | test | transform (unit) | structure guard in `extended-catalog.integration.spec.ts:240-246` | exact |
| MODIFY `core/render-report.spec.ts` | test | transform | itself (`json` dispatch test :164-176) | exact (replace the sarif-throws test :178-182 with a real-renderer assertion) |
| MODIFY (recommended) `core/extended-catalog.integration.spec.ts` | test | transform | itself | exact (import `ngCode` from the new `extended-catalog.ts`; drop its literal `ngCode:` column so there is ONE ngCode source) |
| MODIFY `package.json` | config | -- | shipped `dependencies` block | exact (add `node-sarif-builder@^4.1.0` alongside `@nx/devkit`/`nx`/`tslib`) |
| CONDITIONAL MODIFY `eslint.config.mjs` | config | -- | `ignoredDependencies` array :164-169 | exact (ONLY if the real `nx lint` flags the lazy-only import obsolete -- D-05/VER-04, resolve at execute-time; do NOT pre-add) |

**Already done in Phase 30 (NO modification this phase -- reference only):** both
schema-parity specs (`executors/typecheck/schema-parity.spec.ts:78-81`,
`builders/typecheck/schema-parity.spec.ts:105-108`) ALREADY assert
`format.enum === ['human','json','sarif']`. The enum VALUE + `schema.d.ts` +
`parse-args.ts` + `normalize-options.ts` are all threaded. `builder.ts` inherits
`format` via the shared `TypecheckExecutorOptions` and stays byte-unchanged (D-08).
The CONTEXT phrase "thread ... through both schema-parity specs" refers to the
Phase-30 work that is already merged; Phase 31 replaces ONLY the renderer throw.

## Pattern Assignments

### NEW `core/sarif-report.ts` (utility, transform)

**Analog:** `core/json-report.ts` (the sibling machine reporter; same pure contract, same D-13 projection reuse, same lazy-purity charter). RESEARCH's verified skeleton is in `31-RESEARCH.md:356-433` -- copy its mechanics; the analog below is where the repo *conventions* (import order, manifest read, map-every-diagnostic, purity comment style) come from.

**Imports + manifest-version pattern** (`json-report.ts:1-4`, `:31`):
```typescript
import { relativizePath, toDiagnosticRecord } from './diagnostic-record';
import { evaluateResult } from './evaluate-result';
import type { CoreResult } from './run-typecheck';
// ...
// compiled src/core/*.js -> ../../package.json is the package root (json-report.ts:29-31)
const packageManifest = require('../../package.json') as { version: string };
```
SARIF drops `evaluateResult` (it emits no verdict-bearing summary) but keeps the
`toDiagnosticRecord`/`relativizePath` import and the identical manifest read
(`packageManifest.version` -> `toolDriverVersion`). Add
`import { createHash } from 'node:crypto';` (D-02) and the `import type { ... } from 'node-sarif-builder'` (D-04, erased at compile).

**Signature + map-EVERY-diagnostic (never-drop) pattern** (`json-report.ts:65-69`, `:99-104`):
```typescript
export function formatJsonReport(
  result: CoreResult,
  ts_: typeof import('typescript'),
  opts: JsonReportOptions,
): string {
  // ...
  // Pitfall 10: map EVERY diagnostic through the shared projection -- a file-less
  // entry carries file:null / null positions and is NEVER dropped ...
  diagnostics: result.diagnostics.map((diagnostic) =>
    toDiagnosticRecord(diagnostic, ts_, opts.pathBase),
  ),
```
SARIF signature becomes `async ... => Promise<string>` (the lazy `await import()`
makes it async, unlike the sync JSON reporter). The map-every-diagnostic loop is
the anti-drop invariant SARIF MUST preserve (D-01 / Pitfall 3): one `SarifResultBuilder`
per record, `record.file === null` -> omit `fileUri` + positions.

**Conditional-spread additive idiom for the file-less branch** (`json-report.ts:91-93`, `:114-149`): the `...(cond ? { key } : {})` pattern the JSON reporter uses for optional summary fields is exactly the shape RESEARCH's skeleton uses for the file-less `fileUri`/position omission (`31-RESEARCH.md:405-413`).

**Anti-pattern (from the analog header, `json-report.ts:5-22`):** the reporter is PURE -- no `console`, no `process`, no verdict re-derivation, no `try/catch`-to-success. A reporter throw must propagate as infra (exit 2). SARIF adds one more: NEVER call `path.relative` / `ngCodeOf` / `getLineAndCharacterOfPosition` itself -- read `record.file`/`record.code`/`record.line` only (D-13, see Shared Patterns).

---

### MODIFY `core/render-report.ts` (utility, dispatch seam)

**Analog:** itself. The `json` case (sync sub-reporter) and the `human` case (lazy `await`-load) bracket exactly what the `sarif` case must become.

**The throw to REPLACE** (`render-report.ts:73-78`):
```typescript
case 'sarif': {
  throw new Error(
    'angular-typechecker: the SARIF reporter lands in Phase 31 (v0.2.3). ' +
      'Use --format json or --format human until then.',
  );
}
```

**The two in-file patterns to mirror** -- the `json` case shows the sub-reporter call shape (`render-report.ts:65-71`); the `human` case shows the lazy-`await` firewall (`render-report.ts:80-90`):
```typescript
case 'json': {
  return formatJsonReport(result, ts_, {
    pathBase: options.pathBase,
    maxWarnings: options.maxWarnings,
    strict: options.strict,
  });
}
// ...
case 'human':
default: {
  // D-12: the heavy ESM compiler-cli loads ONLY for the human branch.
  const ng = await loadCompilerCli();
  return formatReport(result.diagnostics, ng, ts_, { ... });
}
```
Replacement (from `31-RESEARCH.md:193-200`) -- combine the two: reach the reporter via `await import` (like `human`), call it like `json`:
```typescript
case 'sarif': {
  const { formatSarifReport } = await import('./sarif-report');   // lazy firewall (D-03)
  return formatSarifReport(result, ts_, options.pathBase);
}
```
`ts_` is already loaded at `render-report.ts:62` (`await loadTypescript()`);
`options.pathBase` is already threaded. Do NOT add a top-level
`import ... from './sarif-report'` -- that would defeat the require-graph guard
(the `await import()` is the firewall the VER-04 spec locks). Also update the type
comment at `render-report.ts:7-13` / the JSDoc at `:39-56` (they currently say
"the `sarif` case throws until Phase 31").

---

### NEW `core/sarif-report.spec.ts` (test, transform-unit)

**Analog:** `core/json-report.spec.ts` -- the sibling reporter's spec. Nearly every helper transfers verbatim.

**Hand-built off-by-one fixture** (`json-report.spec.ts:37-57`) -- the hand-counted position guard (an off-by-one is invisible to a snapshot):
```typescript
const START = 100;
const SPAN = 15;
function positionedDiag(): ts.Diagnostic {
  const file = {
    fileName: 'D:/ws/proj/src/y.component.ts',
    getLineAndCharacterOfPosition: (position: number) =>
      position === START ? { line: 11, character: 4 } : { line: 11, character: 19 },
  } as unknown as ts.SourceFile;
  return { category: ERROR, code: TS2322, file, start: START, length: SPAN,
    messageText: 'Type X is not assignable to type Y.' } as ts.Diagnostic;
}
```
SARIF asserts the projected 1-based `region` (startLine 12, startColumn 5, endLine 12, endColumn 20) -- reuse this exact fixture so JSON and SARIF pin the SAME hand-counted values.

**File-less fixture** (`json-report.spec.ts:61-70`): `filelessDiag()` with `file/start/length` undefined -> SARIF asserts NO `locations` key (D-01) and length one-to-one.

**No-ANSI + FORCE_COLOR=1 byte-stability idiom** (`json-report.spec.ts:18`, `:320-345`):
```typescript
const ESC = String.fromCharCode(0x1b);   // no literal control char in source (CLAUDE.md)
// ... set process.env.FORCE_COLOR='1' in a try/finally that restores the previous value ...
expect(forced).toBe(plain);
expect(forced).not.toContain(ESC);
```

**Snapshot with version redaction** (`json-report.spec.ts:241-248`, Pitfall 5): read the manifest version the SAME way the reporter does (`:74-79`), assert it, then snapshot `{ ...payload, version: '[version]' }` so the golden does not churn every release. For SARIF, redact `runs[0].tool.driver.version` before `toMatchSnapshot()`.

**Exit-code PARITY / verdict-purity assertion** (`json-report.spec.ts:258-274`): the coverage-incomplete case (`errorCount === 0` but `success === false`). SARIF's parity spec asserts `toExitCode` is IDENTICAL across `human`/`json`/`sarif` for the same `CoreResult` -- the reporter never re-derives success (D-07).

**Key/shape drift-lock via a maximal fixture** (`json-report.spec.ts:100-121`, `:405-478`): `maximalResult()` exercises every field; the drift-lock block pins the exact key sets with `Object.keys(...).sort()`. SARIF's analog pins the driver/rule/result/location shape.

---

### NEW `core/sarif-require-graph.spec.ts` (test, file-I/O static walk) -- VER-04

**Analog:** `cli/bin-static.spec.ts` -- clone it wholesale; three retargets.

**dist-root derivation from project.json** (`bin-static.spec.ts:22-49`) -- copy verbatim; a spec in `src/core/` is TWO dirs up to packageRoot, same as `bin-static.spec.ts` in `src/cli/`:
```typescript
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspaceRoot = findWorkspaceRoot(packageRoot);
const projectJson = JSON.parse(readFileSync(join(packageRoot, 'project.json'), 'utf8')) as ProjectJson;
const outputPath = projectJson.targets.build.options.outputPath;
const distRoot = join(workspaceRoot, outputPath);
```

**The static walk** (`bin-static.spec.ts:53-112`) -- `stripCommentLines` + `collectNxRequires` copy verbatim. Retarget:
1. The forbidden regex `NX_SPECIFIER = /^(@nx\/|nx\/|nx$)/` -> `/^(node-sarif-builder|fs-extra)$/` (D-05: `fs-extra` is node-sarif-builder's top-level `require`, so catching it proves the whole chain stays off the boot path).
2. The entry file `binJsPath` (built `bin.js`) -> the built `render-report.js` (the seam ALL three formats pass through). `REQUIRE_SPECIFIER` matches only `require(...)`, never `import(...)`, so the walk never enters `sarif-report.js` -- exactly the firewall being proven.
3. Assertions (`bin-static.spec.ts:114-127`): `expect(violations).toEqual([])` PLUS a POSITIVE control -- `expect(readFileSync(renderReportJsPath,'utf8')).toContain('import("./sarif-report")')` (proves laziness is PRESENT, not that the module is merely absent). Optionally also walk from built `bin.js` for an explicit CLI-boot proof.

Prerequisite (from the analog header :19-20): the `test` target `dependsOn: ["build"]`, so `nx test` builds `dist` before this reads it.

---

### NEW `core/sarif-report.interop.spec.ts` (test, REAL await-import) -- VER-04

**Analog:** `core/compiler-loader.spec.ts` -- the shipped REAL-import interop spec. It does the genuine `await import()` of a CJS/ESM boundary module and asserts the namespace carries the expected callables (what a mocked test cannot catch, Pitfall 9).

**The whole analog** (`compiler-loader.spec.ts:5-20`):
```typescript
describe('loadCompilerCli', () => {
  it('loads the ESM @angular/compiler-cli namespace without ERR_REQUIRE_ESM ...', async () => {
    const ng = await loadCompilerCli();
    expect(typeof ng.performCompilation).toBe('function');
    // ...
  });
});
```
SARIF's interop spec (script in `31-RESEARCH.md:446-457`) does the REAL
`await import('node-sarif-builder')`, applies `(mod.default ?? mod)`, and asserts
the four builders are constructable and `buildSarifJsonString({indent:false})`
yields `version:"2.1.0"`. Place it beside `sarif-report.ts` as a `test`-tier spec
(needs only `node_modules`, NOT the cold-compiler integration tier).

---

### NEW (recommended) `core/extended-catalog.ts` (config/data, static table) -- D-06

**Analogs:** the dependency-free `as const` idiom of `core/extended-catalog.members.ts`, plus the `CATALOG` rows in `core/extended-catalog.integration.spec.ts:84-235` (which is where the member->NG-code mapping currently lives -- promote it to production).

**The enum-truth const to key off** (`extended-catalog.members.ts:29-48`) -- 18 members in enum-declaration order, no `@angular/compiler-cli` import:
```typescript
export const EXTENDED_DIAGNOSTIC_MEMBERS = [
  'invalidBananaInBox',
  'nullishCoalescingNotNullable',
  // ...16 more, enum-declaration order...
  'deferTriggerMisconfiguration',
] as const;
```

**The member->ngCode rows to lift** (`extended-catalog.integration.spec.ts:71-79` interface, `:84-235` data) -- each `CatalogRow` carries `member` (typed as `(typeof EXTENDED_DIAGNOSTIC_MEMBERS)[number]`) + `ngCode`. The new table keeps `{ member, ngCode, name, shortDescription }`; `id = 'NG' + ngCode`, `helpUri = 'https://angular.dev/extended-diagnostics/NG' + ngCode`. Full 18-row mapping is in `31-RESEARCH.md:168-179`. RESEARCH flags spot-verifying NG8011 + NG8021 help pages (A2); drop `helpUri` for any 404 (optional metadata).

**Anti-drift wiring:** the new `extended-catalog.integration.spec.ts` should import `ngCode` FROM this module (drop its literal `ngCode:` column) so there is exactly ONE ngCode source -- see the MODIFY entry below.

---

### NEW (recommended) `core/extended-catalog.spec.ts` (test) -- catalog completeness

**Analog:** the structure guard in `extended-catalog.integration.spec.ts:240-246`:
```typescript
describe('extended-diagnostic catalog (structure)', () => {
  it('has exactly one row per EXTENDED_DIAGNOSTIC_MEMBERS entry, in declaration order', () => {
    expect(CATALOG.map((row) => row.member)).toEqual([...EXTENDED_DIAGNOSTIC_MEMBERS]);
  });
});
```
The new spec asserts `EXTENDED_DIAGNOSTIC_CATALOG.map(r => r.member)` equals
`[...EXTENDED_DIAGNOSTIC_MEMBERS]` -- keeping the catalog enum-driven and letting
the existing `extended-catalog.drift.ts` type-tripwire keep the NAME set honest.

---

### MODIFY `core/render-report.spec.ts` (test)

**Analog:** itself. The `json` dispatch test (`render-report.spec.ts:164-176`) is the template for the new `sarif` dispatch test.

**The test to REPLACE** (`render-report.spec.ts:178-182`):
```typescript
it('throws a Phase-31 error for format:sarif (enum valid here, renderer deferred)', async () => {
  await expect(
    renderReport(coreResultOf([]), { format: 'sarif', color: false }),
  ).rejects.toThrow(/Phase 31/);
});
```
Replace with a real-renderer assertion modeled on the `json` case (`:164-176`):
`renderReport(..., { format: 'sarif', ... })` -> `JSON.parse(out)`, assert
`json.version === '2.1.0'` and `out` has no `ESC` byte. The `ESC`/`diag()`/`coreResultOf()`
helpers already exist at `:8-67`.

---

### MODIFY `package.json` (config) + CONDITIONAL `eslint.config.mjs` (config) -- D-05/VER-04

**`package.json`:** add `node-sarif-builder: "^4.1.0"` to `dependencies` (alongside `@nx/devkit`/`nx`/`tslib`). Do NOT add `@types/sarif` or `fs-extra` -- both are transitive (D-04). Install: `npm install node-sarif-builder@^4.1.0 --save --workspace=packages/angular-typechecker`.

**`eslint.config.mjs` -- CONDITIONAL, resolve at execute-time (do NOT pre-add):** run `nx lint angular-typechecker` after adding the dep. RESEARCH's A1 assumption (`~high`) is that Nx's project-graph analysis sees the dynamic `import('node-sarif-builder')` and the declared dep passes with NO ignore. ONLY if the rule flags it obsolete, append `'node-sarif-builder'` to the `ignoredDependencies` array with a one-line comment. The exact existing pattern to mirror (`eslint.config.mjs:164-169`):
```javascript
ignoredDependencies: [
  'nx',
  '@angular-devkit/architect',
  '@angular-devkit/schematics',
  'rxjs',
],
```
`checkVersionMismatches: false` is already set (`:137`) and deliberate -- do NOT run `eslint --fix` on the manifest (it would rewrite the public peer ranges).

## Shared Patterns

### D-13 shared projection reuse (the anti-drift contract) -- MANDATORY for `sarif-report.ts`
**Source:** `core/diagnostic-record.ts`
**Apply to:** `core/sarif-report.ts` (SARIF reads ONLY record fields; JSON already does)
The reporter maps every diagnostic through `toDiagnosticRecord` and reads fields --
it MUST NOT re-implement positions/URIs/codes (Pitfalls 3/4/6/8 are inherited-solved).

Interface (`diagnostic-record.ts:26-36`) + the projection (`:42-57`):
```typescript
export interface DiagnosticRecord {
  file: string | null;      // repo-relative forward-slash, or null (file-less)
  line: number | null; column: number | null;
  endLine: number | null; endColumn: number | null;
  code: string;             // 'TS####' | 'NG8xxx' | 'ATC9000x'  -> SARIF ruleId
  rawCode: number;
  severity: 'error' | 'warning' | 'suggestion' | 'message';
  message: string;          // ANSI-free, flattened
}
export function toDiagnosticRecord(diagnostic, ts_, pathBase): DiagnosticRecord { ... }
```
SARIF mapping: `record.code -> ruleId`; `record.file/line/... -> fileUri/startLine/...`
(omit when `null`); `record.message -> messageText`; `severity -> level` via the ONE
new SARIF-specific map (`suggestion`/`message` -> `note`, `31-RESEARCH.md:297-299`).
`relativizePath` (`:113-121`) and `positionsOf` (`:66-86`) are already applied inside
the projection -- never call them directly from the reporter.

### `await import()` CJS/ESM bridge + `(mod.default ?? mod)`
**Source:** `core/render-report.ts:83` (`await loadCompilerCli()` in the human branch) and `core/compiler-loader.spec.ts` (the real-import shape)
**Apply to:** `core/sarif-report.ts` (load `node-sarif-builder` lazily) and `core/render-report.ts` (reach `sarif-report.ts` lazily)
Two lazy layers (D-03): `render-report.ts` does `await import('./sarif-report')`;
`sarif-report.ts` does `await import('node-sarif-builder')` then destructures via
`(mod.default ?? mod)`. Verified interop shape + exact destructure in `31-RESEARCH.md:79-85`.

### Verdict purity / never-re-derive-success
**Source:** `core/json-report.ts:70-73` (delegates to `evaluateResult`) + `core/evaluate-result.ts` (the sole owner, UNTOUCHED)
**Apply to:** `core/sarif-report.ts` (emits no summary at all) and the exit-parity spec
`--format` can never change pass/fail (D-07). SARIF emits no verdict; the parity spec
asserts `toExitCode` is identical across all three formats for the same `CoreResult`.

### No-ANSI + FORCE_COLOR byte-stability test idiom
**Source:** `core/json-report.spec.ts:18`, `:320-345`
**Apply to:** `core/sarif-report.spec.ts`
`const ESC = String.fromCharCode(0x1b);` (no literal control char per CLAUDE.md);
save/restore `process.env.FORCE_COLOR` in a `try/finally`; assert `forced === plain`
and neither contains `ESC`.

### findWorkspaceRoot + project.json-derived dist path (for specs that read built `.js`)
**Source:** `cli/bin-static.spec.ts:22-49`
**Apply to:** `core/sarif-require-graph.spec.ts`
Derive `distRoot` from `project.json` `build.options.outputPath` (never hard-code);
`findWorkspaceRoot` from `@workspace/test-util`.

### Manifest version read
**Source:** `core/json-report.ts:31`
**Apply to:** `core/sarif-report.ts`
`const packageManifest = require('../../package.json') as { version: string };` --
compiled `src/core/*.js` is two dirs below the package root. `.version` feeds
`toolDriverVersion`.

### Enum-driven catalog + drift lock
**Source:** `core/extended-catalog.members.ts:29-48` (the `as const` truth) + `core/extended-catalog.drift.ts:55-74` (the type-level mutual set-equality tripwire) + `extended-catalog.integration.spec.ts:240-246` (the runtime structure guard)
**Apply to:** `core/extended-catalog.ts` + `core/extended-catalog.spec.ts`
Drive the 18-rule catalog from `EXTENDED_DIAGNOSTIC_MEMBERS`; a completeness spec keeps
one entry per member; the existing `.drift.ts` still guards the name set.

## No Analog Found

None. Every file maps to a same-repo analog. The one external asset,
`node-sarif-builder@^4.1.0`, has no in-repo API analog (it is the new dep) but its
INTEGRATION pattern (lazy `await import()` + `(mod.default ?? mod)` + a real-import
interop test) is fully precedented by the shipped `@angular/compiler-cli` ESM bridge
(`compiler-loader.ts` / `compiler-loader.spec.ts`) and the verified skeleton in
`31-RESEARCH.md:356-457`.

## Metadata

**Analog search scope:** `packages/angular-typechecker/src/core/`,
`.../src/cli/`, `.../src/executors/typecheck/`, `.../src/builders/typecheck/`,
`packages/angular-typechecker/eslint.config.mjs`.
**Files scanned:** 11 read in full (json-report.ts, render-report.ts,
diagnostic-record.ts, extended-catalog.members.ts, extended-catalog.drift.ts,
extended-catalog.integration.spec.ts, bin-static.spec.ts, compiler-loader.spec.ts,
json-report.spec.ts, render-report.spec.ts, both schema-parity specs) + one targeted
read (eslint.config.mjs:120-192).
**Pattern extraction date:** 2026-07-18
