# Phase 30: Reporter seam + JSON reporter + `--format` threading + observability - Pattern Map

**Mapped:** 2026-07-18
**Files analyzed:** 21 (2 new source, 1 new/optional helper, 5 modify source, 3 modify adapter schema/type, 8 spec new/modify, 1 doc, + executor.ts flagged below)
**Analogs found:** 21 / 21 (every derivation has a shipped, in-tree source -- this phase is composition, not invention)

> **Scope note for the planner (READ FIRST):** RESEARCH.md already cites exact seams with line numbers and the CONTEXT decisions (D-01..D-13) lock the observable behavior. This PATTERNS.md maps each new/modified file to its closest *shipped* analog and extracts the concrete excerpt to copy, so a plan's action can say "mirror `X` at lines `N-M`" instead of re-deriving. Prefer these real codebase analogs over RESEARCH.md's illustrative "Code Examples" where they overlap.
>
> **One correction to the upstream file list:** `executors/typecheck/executor.ts` IS a modify target (the prompt's list omitted it). `renderReport` gains a REQUIRED `format` param (D-12), and `executor.ts` is the tier that destructures `NormalizedOptions` and calls `renderReport` -- it must forward `format` (+ `maxWarnings`/`strict` for the JSON summary) or `--format json` would never take effect from the Nx/builder adapters. `builder.ts` genuinely stays unchanged (it is `convertNxExecutor(typecheckExecutor)` and reaches the change through `executor.ts`). See the per-file entry.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| NEW `core/json-report.ts` | core reporter (pure) | transform (`CoreResult` -> string) | `core/format-report.ts` | exact (pure-reporter contract) |
| NEW `core/diagnostic-record.ts` (or inline in json-report) | utility (pure helper) | transform (`ts.Diagnostic` -> record) | `core/format-report.ts` `makeFormatHost` + `core/diagnostic-codes.ts` | role-match |
| MODIFY `core/render-report.ts` | core dispatcher (pure) | transform (dispatch on format) | itself (widen in place) | self |
| MODIFY `core/run-typecheck.ts` | core engine (pure) | transform / batch | itself (`presentIfNonEmpty` / value-spread idiom) | self |
| MODIFY `core/walk-references.ts` | core engine (pure) | batch (accumulate per leaf) | itself (`LeafAccumulator` / `gatherLeafInto`) | self |
| MODIFY `cli/parse-args.ts` (+ `HELP_TEXT`) | adapter (arg parser) | transform (`argv` -> `ParseResult`) | itself (max-warnings guard) | self |
| MODIFY `cli/main.ts` | adapter (CLI compose) | request-response | itself (`colorFromEnv`, compose) | self |
| MODIFY `executors/typecheck/executor.ts` | adapter (Nx executor) | request-response | itself (`renderReport` call site) | self |
| MODIFY `executors/typecheck/normalize-options.ts` | adapter mapping (pure) | transform (options -> normalized) | itself | self |
| MODIFY `executors/typecheck/schema.json` | config (JSON schema) | n/a | itself (`strict` enum-less boolean) | self |
| MODIFY `executors/typecheck/schema.d.ts` | config (type) | n/a | itself | self |
| MODIFY `builders/typecheck/schema.json` | config (JSON schema) | n/a | executor `schema.json` | exact |
| NEW `core/json-report.spec.ts` | test (unit + snapshot) | n/a | `core/render-report.spec.ts` (`diag` factory) + `cli/main.spec.ts` | exact |
| NEW `core/json-report.drift.spec.ts` (optional) | test (key drift-lock) | n/a | `executors/.../schema-parity.spec.ts` `EXPECTED_KEYS` | exact |
| NEW `core/*.integration.spec.ts` (totalFilesCount) | test (real compiler) | n/a | `core/run-typecheck.integration.spec.ts` | exact |
| MODIFY `cli/main.spec.ts` | test (stubbed core) | n/a | itself (`vi.hoisted` harness) | self |
| MODIFY `cli/parse-args.spec.ts` | test (pure) | n/a | itself (`expectKind` + enum accept/reject) | self |
| MODIFY `core/run-typecheck.spec.ts` | test (unit) | n/a | itself | self |
| MODIFY `executors/.../schema-parity.spec.ts` | test (drift-lock) | n/a | itself | self |
| MODIFY `builders/.../schema-parity.spec.ts` | test (drift-lock) | n/a | itself | self |
| MODIFY `core/render-report.spec.ts` | test | n/a | itself (add `format:'human'` to 6 calls) | self |
| MODIFY `packages/angular-typechecker/README.md` | doc | n/a | its own `### Options` flag table | self |

---

## Pattern Assignments

### NEW `core/json-report.ts` (core reporter, transform)

**Primary analog:** `core/format-report.ts` (the human reporter -- copy its PURE-function contract, but NEVER its colorizing `ng.formatDiagnostics` call). **Secondary analogs:** `core/evaluate-result.ts` (delegate for the verdict), `core/diagnostic-codes.ts` (code humanization + file-less shape), `core/run-typecheck.ts:192` (message flattening).

**Pure-reporter contract to copy** (`format-report.ts:57-83`) -- injected `ts_`, no `console`/`process`, no verdict, returns a string:
```typescript
export function formatReport(
  diagnostics: readonly ts.Diagnostic[],
  ng: Pick<CompilerCli, 'formatDiagnostics'>,
  ts_: typeof import('typescript'),
  options: FormatOptions,
): string {
  // ...
  const rendered = ng.formatDiagnostics([...toRender], host);
  return options.color ? rendered : rendered.replace(ANSI_PATTERN, '');
}
```
`formatJsonReport` mirrors this shape (pure, injected `ts_`) but takes the FULL `CoreResult` and drops `ng` entirely -- no compiler-cli, so the JSON path never loads the heavy ESM peer (D-12). Signature per RESEARCH Code Examples:
```typescript
export function formatJsonReport(
  result: CoreResult,
  ts_: typeof import('typescript'),
  opts: { pathBase?: string; maxWarnings?: number; strict?: boolean },
): string
```

**Verdict via DELEGATION, never re-derivation** (D-07 / Pitfall 13). Call `evaluateResult` -- the sole owner -- for `summary.outcome`/`summary.success`; NEVER read `errorCount` to decide pass/fail (the coverage-incomplete case is `errorCount===0` + `success===false`). Copy the delegation exactly as the CLI adapter does it (`cli/main.ts:167-170`):
```typescript
const { success, outcome } = evaluateResult(result, {
  maxWarnings: opts.maxWarnings,
  strict: opts.strict,
});
```

**Message flattening -- copy verbatim, NEVER the colorizing path** (`run-typecheck.ts:192`, already the shipped idiom):
```typescript
ts.flattenDiagnosticMessageText(failure.messageText, '\n')
```

**Serialize with `JSON.stringify` ONLY** (D-06 -- zero new dep; escapes quotes/newlines/control chars):
```typescript
return JSON.stringify(payload, null, 2);
```

**Which `summary` fields to project** -- read the field list straight off `CoreResult` (`run-typecheck.ts:54-140`): `tsConfigPath`, `rootNamesCount`, `errorCount`, `warningCount`, `diagnostics.length`, `suppressedThirdParty`, `suppressedInGraphErrorCount`, `suppressedInGraphWarningCount`, and the OPTIONAL advisory fields. For WHICH advisory fields belong in `summary.advisories` and their presence-gating, mirror `emit-advisory-notices.ts:23-31` (it enumerates the exact five: `templateCheckAborted`, `skippedReferences`, split suppressed counts + `suppressedInGraphFiles`, `notTypeCheckedDeclaredFiles`, `bundlerQueryImports`). Each of those is present-if-non-empty on `CoreResult` -- gate the JSON `advisories` block the same way (optional-chain / presence), so a clean run emits an empty/absent block.

---

### NEW `core/diagnostic-record.ts` (shared projection helper, pure) -- or inline+export in `json-report.ts`

**Analog:** `core/format-report.ts` `makeFormatHost` (`:92-108`) for the "small pure helper co-located with the reporter" shape; `core/diagnostic-codes.ts` for the two derivations it wraps. **D-13:** this is the ONE projection Phase 31's SARIF reporter will reuse -- build it standalone with that reuse in mind.

**The file-less-safe `positionsOf` helper** (the classic reporter off-by-one; Pitfall 3). The file-less shape is guaranteed by `synthesizeFilelessError` (`diagnostic-codes.ts:122-135`), which sets `file`/`start`/`length` `undefined` by construction -- so the guard is mandatory, not defensive:
```typescript
// diagnostic-codes.ts:122-135 -- the shape positionsOf MUST tolerate:
export function synthesizeFilelessError(ts, code, messageText): ts.Diagnostic {
  return { category: ts.DiagnosticCategory.Error, code, file: undefined, start: undefined, length: undefined, messageText };
}
```
Projection (from RESEARCH Pattern 2, grounded in the shape above): guard `d.file === undefined || d.start === undefined` -> all-`null` positions; else `d.file.getLineAndCharacterOfPosition(d.start)` (0-based) `+1` on BOTH axes for start AND end (`endPos = d.start + (d.length ?? 0)`).

**The code-string classifier** -- reuse the shipped `ngCodeOf`, NEVER re-derive the `-99xxxx` math (Pitfall 6). Source (`diagnostic-codes.ts:41-52, 108-109`):
```typescript
export const NG = (code: number): number => -990000 - code;
export const ngCodeOf = (code: number): number => Math.abs(code) - 990000; // -998109 -> 8109
export const ZERO_ROOT_NAMES_DIAGNOSTIC_CODE = 90001;
export const REFERENCE_NOT_FOUND_DIAGNOSTIC_CODE = 90002;
```
Classifier: `rawCode < 0` -> `'NG' + ngCodeOf(rawCode)`; `rawCode >= 90000` -> `'ATC' + rawCode`; else `'TS' + rawCode`. Carry BOTH `code` (string) and `rawCode` (int) per D-01.

**severity from `diagnostic.category`, NEVER code sign** (the L-4 rule, restated at `evaluate-result.ts:17-22` and `diagnostic-codes.ts:24-26`): `Error(1)->"error"`, `Warning(0)->"warning"`, `Suggestion(2)->"suggestion"`, `Message(3)->"message"`.

**path relativization** -- the SAME base the human host uses (`format-report.ts:99-101`, `getCurrentDirectory: () => pathBase ?? ...`): `path.relative(pathBase, d.file.fileName).replace(/\\/g, '/')`, `null` when file-less. Never leak an absolute local path (Security V5).

---

### MODIFY `core/render-report.ts` (core dispatcher, transform) -- widen in place (D-12)

**Analog:** itself. Current shipped shape (`render-report.ts:18-55`):
```typescript
export interface RenderOptions {
  pathBase?: string;
  color: boolean;
  failFast?: boolean;
}
export async function renderReport(
  result: Pick<CoreResult, 'diagnostics'>,   // WIDEN to full CoreResult
  options: RenderOptions,
): Promise<string> {
  const ng = await loadCompilerCli();          // MOVE into the human branch (D-12)
  const ts_ = await loadTypescript();
  return formatReport(result.diagnostics, ng, ts_, { ... });
}
```
**Change (RESEARCH Pattern 1):** add `format: ReportFormat` (REQUIRED; RESEARCH A2 recommends required -> forces every call site explicit), `maxWarnings?`/`strict?` (so the `json` branch can delegate to `evaluateResult`); widen `result` to full `CoreResult`; `switch (options.format)`; move `loadCompilerCli()` INTO the `human` branch only. `sarif` case: throw a clear "SARIF renderer lands in Phase 31" error (RESEARCH Open Question 2, option a) -- the enum is VALID, the renderer is not. `renderReport` is NOT in the barrel (`index.ts:14-19`), so widening it is internal/additive -- the 0.x charter holds.

---

### MODIFY `core/run-typecheck.ts` (core engine, transform) -- add optional `totalFilesCount` (OBS-01 / D-11)

**Analog:** itself. Three shipped idioms to copy:

**1. Optional field on `CoreResult`** -- add `totalFilesCount?: number;` alongside the other optionals (`run-typecheck.ts:54-140`). Keep OPTIONAL (Pitfall 14 -- a required field is a breaking change under a patch bump).

**2. Value-presence conditional spread** -- copy the shipped idiom at `finalize` (`run-typecheck.ts:905`), NOT `presentIfNonEmpty` (which is ARRAY-only, `:256-263`):
```typescript
...(templateCheckAborted !== undefined ? { templateCheckAborted } : {}),
```
So: `...(totalFilesCount !== undefined ? { totalFilesCount } : {})`.

**3. Direct-path capture** -- the live program is in scope right after the program-undefined guard (`run-typecheck.ts:458-486`). Count non-declaration files exactly the way `gather-diagnostics.ts:152-153` iterates (`!sf.isDeclarationFile` -> excludes `lib.d.ts`, D-11):
```typescript
// gather-diagnostics.ts:152-153 -- the non-declaration filter template:
for (const sourceFile of program.getTsProgram().getSourceFiles()) {
  if (sourceFile.isDeclarationFile) { continue; }
  // ...
}
```
Capture after `directResult` (`:473-486`), spread onto the return (`:497-503`) with the value-presence idiom above:
```typescript
const totalFilesCount = result.program.getTsProgram()
  .getSourceFiles()
  .filter((sf) => !sf.isDeclarationFile).length;
```

**4. Walk / multi-tsconfig path** -- no per-leaf program survives `finalizeUnion` (`:278-313`), so accumulate during `gatherLeafInto` (see walk-references entry). Thread a `Set<string>` size through `finalizeUnion` as a new param and spread it onto the returned result there.

**Verdict-neutrality (load-bearing, D-11):** `evaluateResult`'s `EvaluateInput` Pick (`evaluate-result.ts:84-93`) deliberately omits `totalFilesCount` -- KEEP it omitted. A negative test locks that `evaluateResult` never reads it.

---

### MODIFY `core/walk-references.ts` (core engine, batch) -- accumulate the source-file Set

**Analog:** itself. `LeafAccumulator` (`walk-references.ts:111-116`) already carries the four per-leaf fields; add a fifth for the deduped non-declaration source-file NAMES (RESEARCH A3: dedupe by `.fileName` string, not object):
```typescript
export interface LeafAccumulator {
  rawDiagnostics: ts.Diagnostic[];
  rootNamePaths: string[];
  notTypeCheckedDeclaredFiles: string[];
  rootNamesCount: number;
  // NEW: sourceFileNames: Set<string>   (non-declaration, name-deduped across leaves)
}
```
Populate it in `gatherLeafInto` (`:145-161`) where each leaf's program is live -- mirror the accumulate style already there:
```typescript
export function gatherLeafInto(acc, ng, ts, parsed, entryPath): void {
  const result = runNoEmitCompilation(ng, parsed);
  acc.rawDiagnostics.push(...parsed.errors);
  acc.rawDiagnostics.push(...result.diagnostics);
  acc.rootNamesCount += parsed.rootNames.length;
  // NEW: for each result.program source file, if !isDeclarationFile, acc.sourceFileNames.add(sf.fileName)
}
```
Both callers (`walkReferences` `:194-199` and `handleMultiTsConfig` `run-typecheck.ts:650-655`) construct the `acc` literal -- add the `Set` there. Carry `set.size` on `WalkResult` (`:41-74`) and thread it into `finalizeUnion`. Note `gatherLeafInto` is the SHARED helper both the walk and the array-fan-out use, so populating it once covers both multi-paths.

---

### MODIFY `cli/parse-args.ts` (+ `HELP_TEXT`) (adapter, transform)

**Analog:** itself. Add three flags to the `parseArgs` options object (`:105-122`) and set `allowNegative: true` for `--no-color` (Pitfall 9 -- strict mode REJECTS an unregistered `--no-color` without it; `allowNegative` is Node >=22.4.0, floor is 22.22.3):
```typescript
const { values } = parseArgs({
  args: argv, strict: true, allowPositionals: false,
  // NEW: allowNegative: true,
  options: {
    tsConfig: { type: 'string', short: 'c', multiple: true },
    'max-warnings': { type: 'string' },
    // NEW: format: { type: 'string' }, quiet: { type: 'boolean' }, color: { type: 'boolean' },
    'fail-fast': { type: 'boolean' },
    // ...
  },
});
```
**Enum validation** -- mirror the `--max-warnings` guard idiom (`:145-159`) exactly: an out-of-enum `format` returns a `usageError`:
```typescript
// :151 -- the guard template to copy:
if (!/^\d+$/.test(rawMaxWarnings)) {
  return { kind: 'usageError', message: `angular-typechecker: --max-warnings expects a non-negative integer, got "${rawMaxWarnings}".` };
}
```
So: `if (rawFormat !== undefined && !['human','json','sarif'].includes(rawFormat)) { return usageError(...); }`. Add `format` (default `'human'`), `quiet`, `color?` to `ParsedOptions` (`:22-32`). Update `HELP_TEXT` (`:65-84`) -- it is drift-locked, see the README entry below.

---

### MODIFY `cli/main.ts` (adapter, request-response)

**Analog:** itself. Three changes to the compose (`:148-172`):

**1. Explicit color override ABOVE env** (`--color`/`--no-color` WIN, D-10). Current: `const color = colorFromEnv(env);` (`:148`) -> `const color = parsed.color ?? colorFromEnv(env);`. `colorFromEnv` (`:58-74`) stays the fallback tier -- extend, don't replace.

**2. Gate `emitAdvisoryNotices` on `--quiet`** (D-09 -- silences stderr chatter ONLY, never payload/verdict). Current (`:155`):
```typescript
emitAdvisoryNotices(result, logger);   // wrap: if (!parsed.quiet) { ... }
```

**3. Thread `format` (+ `maxWarnings`/`strict`) into `renderReport`** (`:157-161`):
```typescript
const report = await renderReport(result, { pathBase, color, failFast: parsed.failFast });
// ADD: format: parsed.format, maxWarnings: parsed.maxWarnings, strict: parsed.strict
```
The exit-code compose (`:167-172`, `evaluateResult(...).success`) stays UNTOUCHED -- machine format never changes the verdict.

---

### MODIFY `executors/typecheck/executor.ts` (adapter, request-response) -- REQUIRED (was omitted upstream)

**Analog:** itself. `renderReport` gains a required `format`, so the executor's call site (`executor.ts:45-60`) must forward it:
```typescript
const { coreOptions, maxWarnings, failFast, color, strict } = normalizeOptions(options, context);
// ... becomes: also destructure `format`
const report = await renderReport(result, {
  pathBase: coreOptions.pathBase, color, failFast,
  // ADD: format, maxWarnings, strict
});
```
The stdout write (`:64`, `process.stdout.write(report)`) and the verdict (`:69`) stay unchanged. `builders/typecheck/builder.ts` is `convertNxExecutor(typecheckExecutor)` -- it reaches this change through `executor.ts` and stays byte-unchanged (confirmed in CONTEXT/RESEARCH).

---

### MODIFY `executors/typecheck/normalize-options.ts` (adapter mapping, transform)

**Analog:** itself. Add `format` to `NormalizedOptions` (`:20-26`) and forward it (default `'human'`). Copy the `strict`-style default (a concrete value, mirroring `failFast`) since `renderReport` reads `format` as a required discriminator:
```typescript
// :60-70 -- the return shape to extend:
return {
  coreOptions: { tsConfigPath, includeDeps: options.includeDeps ?? false, pathBase: context.root },
  maxWarnings: options.maxWarnings,
  failFast: options.failFast ?? false,
  color: process.stdout.isTTY === true,
  strict: options.strict ?? false,
  // ADD: format: options.format ?? 'human',
};
```

---

### MODIFY `executors/typecheck/schema.d.ts` + `schema.json` + `builders/typecheck/schema.json` (config)

**Analog for `schema.d.ts`:** itself (`:1-10`) -- add `format?: 'human' | 'json' | 'sarif';` to `TypecheckExecutorOptions`.

**Analog for the JSON schemas:** the shipped `strict` property (`executor schema.json:31-35`) is the closest enum-less boolean; for an ENUM property with a default, add:
```json
"format": {
  "type": "string",
  "enum": ["human", "json", "sarif"],
  "default": "human",
  "description": "Output format. human (default) is the colorized codeframe report; json is the machine-readable payload; sarif lands in a later release."
}
```
Both schemas set `additionalProperties: false` (`:38` / `:35`), so the property MUST be declared or a `--format` value is rejected. The builder `schema.json` is a byte-copy of the executor's property block MINUS the Nx-only `cli`/`version`/`$id` (already sanitized) -- add the identical `format` block.

---

### NEW `core/json-report.spec.ts` (test, unit + snapshot)

**Analogs:** `core/render-report.spec.ts` (the `diag(...)` hand-built `ts.Diagnostic` factory) + `cli/main.spec.ts` (`coreResult(errorCount)` `CoreResult` factory).

**Hand-built diagnostic factory** (`render-report.spec.ts:24-49`) -- copy the shape, including the stubbed `getLineAndCharacterOfPosition`; for the OFF-BY-ONE guard (Pitfall 3) use a HAND-COUNTED position, not a round-trip, and make the stub return a known non-zero `{line, character}`:
```typescript
function diag(category, fileName, code = TS2322): tsType.Diagnostic {
  const file = { fileName, text: 'const x = 1;\n',
    getLineAndCharacterOfPosition: () => ({ line: 0, character: 0 }) } as unknown as tsType.SourceFile;
  return { category, code, file, start: 0, length: 1, messageText: 'sample message' } as tsType.Diagnostic;
}
const ESC = String.fromCharCode(0x1b);       // :9 -- for the no-ANSI assertion
const NG8109 = -998109; const TS2322 = 2322; // :15-16 -- code-classifier fixtures
```
**`CoreResult` stub factory** (`main.spec.ts:69-82`) -- copy to build the reporter input; add a file-less diagnostic (synthesized `90001`) to prove it appears with `file:null`/null positions and is NOT dropped (Pitfall 10 -- `diagnostics.length` must match one-to-one). Assert: shape/snapshot, 1-based positions (hand-counted), `code`+`rawCode` over all three families (`TS`/`NG8xxx`/`ATC9000x`), severity mapping, and NO `\x1b` byte in the payload (byte-identical under `FORCE_COLOR=1`).

---

### NEW `core/json-report.drift.spec.ts` (optional) (test, key drift-lock)

**Analog:** `executors/typecheck/schema-parity.spec.ts:38-50` -- the `EXPECTED_KEYS` sorted-array + `toEqual(Object.keys(...).sort())` tripwire (D-03). Copy the pattern to lock the JSON payload's TOP-LEVEL and `summary` key sets:
```typescript
const EXPECTED_KEYS = ['failFast','includeDeps','maxWarnings','strict','tsConfig'];
it('declares exactly the ... properties', () => {
  expect(Object.keys(schema.properties).sort()).toEqual(EXPECTED_KEYS);
});
```
Apply the same shape to `Object.keys(payload).sort()` and `Object.keys(payload.summary).sort()`.

---

### NEW `core/*.integration.spec.ts` (totalFilesCount) (test, real compiler)

**Analog:** `core/run-typecheck.integration.spec.ts:1-106`. Copy the real-compiler harness verbatim: `findWorkspaceRoot` + a `fixtures/<name>` tsconfig, `await runTypecheck({ tsConfigPath })`, assert off `CoreResult`:
```typescript
import { findWorkspaceRoot } from '@workspace/test-util';
import { runTypecheck } from './run-typecheck';
const workspaceRoot = findWorkspaceRoot(dirname(fileURLToPath(import.meta.url)));
const appTsConfig = join(workspaceRoot, 'fixtures', 'gate-b-error', 'tsconfig.app.json');
it('...', async () => {
  const result = await runTypecheck({ tsConfigPath: appTsConfig });
  expect(result.rootNamesCount).toBeGreaterThan(0);
  // NEW: expect(result.totalFilesCount).toBeGreaterThanOrEqual(result.rootNamesCount);
});
```
Reuse an existing multi-leaf fixture (e.g. `sibling-import`, referenced at `:34-54`, or `gate-b-error`) so the direct-path count is provable against real non-declaration source files. This is the ONE place `totalFilesCount`'s actual value is exercised (the unit stub only proves the field threads through).

---

### MODIFY `cli/main.spec.ts` (test, stubbed core)

**Analog:** itself -- the `vi.hoisted` + `vi.mock(importOriginal)` harness (`:29-58`) and the `coreResult(errorCount)` factory (`:69-82`) are exactly what VER-01 needs. Extend, do not rebuild:
- **Exit-code parity** across `--format human`/`--format json` incl. coverage-incomplete -- copy the anti-false-pass test at `:143-153` (`errorCount:0`, `success:false`, `exitCode:1`) and re-run it under `--format json`; assert the exit code is IDENTICAL.
- **`--quiet` gates stderr only** -- extend the CLI-03 routing block (`:225-258`); assert the advisory is GONE from stderr but stdout payload + exit code are unchanged.
- **`--color`/`--no-color` override** -- extend the ARGS-05 block (`:299-326`) using the `lastColor()` helper (`:92-94`); assert the flag WINS over `NO_COLOR`/`FORCE_COLOR`.

Note the bare-`vi.fn()` mock rule (`:33-38`): keep `renderReport` a bare `vi.fn()` so `.mock.calls` args are `any[]` (avoids the TS2493/TS2532 that `nx test` would MISS but `nx typecheck` catches -- Pitfall 8).

---

### MODIFY `cli/parse-args.spec.ts` (test, pure)

**Analog:** itself -- the `expectKind` narrower (`:26-33`) and the enum accept/reject style of the `--max-warnings` block (`:121-206`). Add: `--format human|json|sarif` each parse to `options` with the right value; an out-of-enum `--format nonsense` -> `usageError` (mirror `:149-157`); `--no-color` parses to `color:false` under `allowNegative`; `--color` -> `color:true`.

---

### MODIFY `executors/.../schema-parity.spec.ts` + `builders/.../schema-parity.spec.ts` (test, drift-lock)

**Analog:** itself. Add `'format'` to `EXPECTED_KEYS` (executor `:39-45`; builder `:49-55`). The builder's array is `satisfies readonly (keyof TypecheckExecutorOptions)[]` with an `AssertAssignable` reverse probe (`:55-68`) -- so adding `format` to `TypecheckExecutorOptions` WITHOUT updating both arrays FAILS the type-check. Treat updating both `EXPECTED_KEYS` as part of the schema wiring, not an afterthought. Add a `format` default-value assertion mirroring `defaults includeDeps and failFast to false` (`:66-69`).

---

### MODIFY `core/run-typecheck.spec.ts` (test, unit)

**Analog:** itself + the `main.spec.ts` `coreResult` factory shape. Add a unit assertion that a stubbed direct-path result carries `totalFilesCount`, and the load-bearing verdict-neutrality negative test: `evaluateResult` returns the SAME verdict whether or not `totalFilesCount` is present (locks `EvaluateInput`'s omission, `evaluate-result.ts:84-93`).

---

### MODIFY `core/render-report.spec.ts` (test)

**Analog:** itself. Add `format: 'human'` to the 6 existing `renderReport(...)` calls (`:53-54, 65-66, 74-76, 86-89, 103-106, 122`) now that `format` is REQUIRED on `RenderOptions`. Optionally add one `format: 'json'` dispatch assertion (asserts the seam routes to `formatJsonReport` and the output parses as JSON).

---

### MODIFY `packages/angular-typechecker/README.md` (doc) + the drift-lock it trips

**Analog:** the shipped `### Options` flag table (`README.md:522-530`). The `standalone-cli-docs.spec.ts` tripwire (`:60, 87-93`) DERIVES every long-form flag the live `--help` prints (`--[a-zA-Z][\w-]*`) and asserts each appears in the README -- so adding `--format`/`--quiet`/`--color`/`--no-color` to `HELP_TEXT` (`parse-args.ts:65-84`) WILL fail this spec until the README table gains matching rows (Pitfall 7). Recommended fix (RESEARCH Open Question 3, option b): add one table row per new flag to the EXISTING table -- copy the row shape:
```
| `--max-warnings <n>`    | Fail the run if the warning count exceeds n (a non-negative integer; 0 fails on any warning). |
| `--fail-fast`           | Report diagnostics only up to the first error (output brevity; all diagnostics are still gathered). |
```
The full `## Machine-readable output` schema/recipe prose stays DEFERRED to Phase 32 (DOC-01). `standalone-cli-docs.spec.ts` then needs NO edit -- the `helpFlags` derivation (`:60`) self-enforces once both `HELP_TEXT` and the README table carry the flags. `FLAG_TOKENS` (`:45-53`) is a separate removal/rename lock, unaffected by additions.

---

## Shared Patterns

### Pure-core reporter contract
**Source:** `core/format-report.ts:57-83` (and `core/emit-advisory-notices.ts:14-22` / `core/logger.ts` for the "no `console`/`process`/nx import" boundary).
**Apply to:** `json-report.ts`, `diagnostic-record.ts`.
A reporter is `(CoreResult, ts_, opts) => string` -- injected `ts_`, no `console`, no `process`, no verdict, no compiler import at module scope. The `src/core` ESLint boundary enforces it.

### Verdict is delegated, never re-derived (the cardinal anti-false-pass)
**Source:** `core/evaluate-result.ts:116-141` (the coverage-incomplete `errorCount===0 / success===false` branch) + the two shipped call sites `cli/main.ts:167-170`, `executors/typecheck/executor.ts:69`.
**Apply to:** `json-report.ts` (`summary.outcome`/`success` via `evaluateResult`), and every exit-code path (UNCHANGED). NEVER read `errorCount` in a reporter to decide anything about success (Pitfall 13 / D-07).

### Optional-additive `CoreResult` fields (0.x additive-only)
**Source:** `core/run-typecheck.ts:256-263` (`presentIfNonEmpty`, ARRAYS only) and `:905` (value-presence conditional spread, for scalars/objects).
**Apply to:** `totalFilesCount` uses the VALUE spread (`...(x !== undefined ? { x } : {})`), NOT `presentIfNonEmpty`. Keep the field OPTIONAL (Pitfall 14); `index.drift.ts` must still compile.

### Code humanization + file-less-safe shape
**Source:** `core/diagnostic-codes.ts:41-52` (`ngCodeOf`), `:108-109` (synthesized `90001`/`90002`), `:122-135` (`synthesizeFilelessError` -> `file`/`start`/`length` undefined).
**Apply to:** `diagnostic-record.ts` (code classifier + position guard). Never surface the raw negative code (Pitfall 6); never drop a file-less diagnostic (Pitfall 10).

### Message flattening (never colorize)
**Source:** `core/run-typecheck.ts:192` -- `ts.flattenDiagnosticMessageText(d.messageText, '\n')`.
**Apply to:** `json-report.ts` message field. NEVER `ng.formatDiagnostics` (`format-report.ts:80` ALWAYS colorizes -- Pitfall 2).

### Schema <-> type <-> keys drift-lock
**Source:** `executors/typecheck/schema-parity.spec.ts:38-50` (`EXPECTED_KEYS` + `toEqual`); `builders/typecheck/schema-parity.spec.ts:55-68` (`satisfies` + `AssertAssignable` reverse probe).
**Apply to:** both parity specs (add `'format'`) AND the new JSON payload-key drift-lock (D-03).

### Stubbed-core test harness (VER-01)
**Source:** `cli/main.spec.ts:29-58` (`vi.hoisted` + `vi.mock(importOriginal)` keeping `TypecheckInfrastructureError` real), `:69-82` (`coreResult` factory), `:143-153` (the coverage-incomplete anti-false-pass), bare-`vi.fn()` rule (`:33-38`, Pitfall 8).
**Apply to:** `cli/main.spec.ts` extension, `core/json-report.spec.ts`.

### stdout payload / stderr notices split
**Source:** `executors/typecheck/executor.ts:64` (`process.stdout.write(report)`), `cli/main.ts:172` (`RunResult.stdout`); notices via `emit-advisory-notices.ts:23-31` -> injected `Logger` (`logger.ts:19-23`) -> stderr.
**Apply to:** confirm every machine payload goes to the RAW stdout seam ONLY; `--quiet` gates the notice CALL, never the payload (Pitfall 1 / D-08/D-09).

### Color precedence (env + explicit flag)
**Source:** `cli/main.ts:58-74` (`colorFromEnv` -- `NO_COLOR` > `FORCE_COLOR` > `isTTY`).
**Apply to:** `cli/main.ts` (`parsed.color ?? colorFromEnv(env)` -- flag wins, human path only). Machine formats are unconditionally plain (D-10).

---

## No Analog Found

None. Every file has a close in-tree analog. The two genuinely NEW source files (`json-report.ts`, `diagnostic-record.ts`) are pure compositions of shipped helpers (`format-report.ts` contract + `evaluate-result.ts` delegation + `diagnostic-codes.ts` derivations + `ts.flattenDiagnosticMessageText`), and the new spec files clone shipped spec harnesses (`render-report.spec.ts`, `main.spec.ts`, `schema-parity.spec.ts`, `run-typecheck.integration.spec.ts`).

## Metadata

**Analog search scope:** `packages/angular-typechecker/src/{core,cli,executors,builders}/**` + `README.md`; the milestone research (`.planning/research/v0.2.3-reporters/`) cited seams were used to jump straight to line ranges.
**Files scanned (read in full or targeted):** 21 source/spec/schema/doc files.
**Pattern extraction date:** 2026-07-18
