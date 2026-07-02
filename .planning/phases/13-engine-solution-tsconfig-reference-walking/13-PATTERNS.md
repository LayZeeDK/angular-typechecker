# Phase 13: Engine -- solution-tsconfig reference-walking - Pattern Map

**Mapped:** 2026-07-01
**Files analyzed:** 8 file groups (1 NEW core module, 3 CHANGED core/barrel, 1 CHANGED adapter, 2 NEW spec files, 1 fixture group upgrade + 5 NEW sibling fixtures, 1 nx.json edit)
**Analogs found:** 8 / 8 (every new/changed file has an in-repo analog; NO RESEARCH.md-only patterns needed)

All analogs are inside `packages/angular-typechecker/src/core/**` and `fixtures/**` -- this phase
extends a mature engine, so every pattern is a verbatim mirror of shipped code. Core purity
(no `console` / no `process` under `**/src/core/**`), ASCII-only output, TS6/Angular22, and
`NG()`-encoded assertions are the governing rules (CLAUDE.md / AGENTS.md).

## File Classification

| New/Changed File | Role | Data Flow | Closest Analog | Match Quality |
|------------------|------|-----------|----------------|---------------|
| NEW `src/core/walk-references.ts` | core module (pure) | batch / transform (per-leaf compile -> union) | `src/core/filter-diagnostics.ts` (module shape) + `src/core/run-typecheck.ts` (synth/compile idioms) | role-match (new capability, mirrored idioms) |
| CHANGED `src/core/run-typecheck.ts` | core engine | request-response (single call -> CoreResult) | itself: `synthesizeZeroRootNamesDiagnostic` (90001) + `TemplateCheckAborted` field + D-03a guard | exact (extend in place) |
| CHANGED `src/core/filter-diagnostics.ts` | core utility | transform | itself: existing `export function filterDiagnostics` style | exact |
| CHANGED `src/index.ts` (barrel) | config / barrel | n/a | itself: existing `export type { CoreOptions, CoreResult }` at `:15` | exact |
| CHANGED `src/executors/angular-typecheck/executor.ts` | executor adapter | request-response + logging | itself: `templateCheckAborted` render seam `:49-63` | exact |
| NEW `walk-references.spec.ts` (unit) | test (pure unit) | n/a | `run-typecheck.ts` `detectTemplateCheckAborted` (exported for unit tier) + `gather-diagnostics.spec.ts` shape | role-match |
| NEW `walk-references.integration.spec.ts` | test (real-compiler integration) | n/a | `config-resolution.integration.spec.ts` (fixtures + `it.each` + `NG()` + `runTypecheck` off CoreResult) | exact |
| UPGRADED `fixtures/solution-style/*` + 5 NEW sibling fixtures | fixture | n/a | existing `fixtures/solution-style/{tsconfig.json,tsconfig.app.json,error.component.ts}` | exact |
| CHANGED `nx.json` `targetDefaults["angular-typecheck"]` | config | n/a | existing `targetDefaults["angular-typecheck"]` block (one-line `production`->`default`) | exact |

## Pattern Assignments

### NEW `src/core/walk-references.ts` (core module, batch/transform)

**Analogs:** module SHAPE from `filter-diagnostics.ts`; synth + per-leaf-compile idioms from `run-typecheck.ts`.

**Module-shape pattern to mirror** (`filter-diagnostics.ts:1-58`): a pure, `@nx/devkit`-free
module -- `import type ts from 'typescript';`, an exported result interface + exported entry
function, private helpers below. NO `console`/`process` anywhere (the `no-console`/`no-process`
gate is scoped to `**/src/core/**`). The RES-03 fail-safe comment style at
`filter-diagnostics.ts:145-154` documents WHY a fallback keeps a diagnostic -- mirror that
"never silently drop -> false PASS" reasoning for D-05 fold-and-count and D-03b zero-rootNames.

**Per-leaf `performCompilation` override block -- copy VERBATIM from** `run-typecheck.ts:212-239`:

```typescript
const result = ng.performCompilation({
  rootNames: parsed.rootNames,
  options: {
    ...parsed.options,
    noEmit: true,
    composite: false,
    declaration: false,
    declarationMap: false,
    emitDeclarationOnly: false,
    incremental: false,
    tsBuildInfoFile: undefined,
    sourceMap: undefined,
    inlineSourceMap: undefined,
    inlineSources: undefined,
    declarationDir: undefined,
    mapRoot: undefined,
    sourceRoot: undefined,
    diagnostics: false,
  },
  emitFlags: 0 as EmitFlags,
  gatherDiagnostics: gatherAllDiagnostics,
});
```

RESEARCH directive 3 says to FACTOR this override into a shared helper (the direct path at
`:212-239` and each walked leaf must use the identical block -- do not let them drift). The walk
returns RAW gathered diagnostics (`result.diagnostics`), never filtered per-leaf (Pitfall 2).

**Synthesized-diagnostic idiom -- mirror** `synthesizeZeroRootNamesDiagnostic` (`run-typecheck.ts:329-356`)
for the NEW `90002` (D-05). The file-less shape at `:348-355` is exact:

```typescript
return {
  category: ts.DiagnosticCategory.Error,
  code: ZERO_ROOT_NAMES_DIAGNOSTIC_CODE, // -> new REFERENCE_NOT_FOUND code 90002
  file: undefined,
  start: undefined,
  length: undefined,
  messageText, // 'angular-typechecker: referenced tsconfig not found: ' + resolvedPath
};
```

`90002` is a private module const (sibling to `ZERO_ROOT_NAMES_DIAGNOSTIC_CODE = 90001`,
`run-typecheck.ts:89-93` -- copy the "outside TS/NG/500 spaces" rationale comment). File-less =
never filtered (`filter-diagnostics.ts:85`), counted as Error by `finalize`.

**Boundary-guard + self-ref dedupe -- reuse** `createCanonicalizer` + `isUnderDir` from
`filter-diagnostics.ts` (currently module-private at `:128,184`). Pitfall 6 / Open Question 1:
export them from `filter-diagnostics.ts` (smallest delta) OR extract to a shared
`path-canonicalize.ts`; the walk MUST reuse the SAME implementation (D-01 "reuse tested machinery
verbatim"), never a duplicate canonicalizer.

**Result shape** (RESEARCH directive 3): `WalkResult { rawDiagnostics, rootNamesCount (SUM over
walked leaves -- Pitfall 5), skippedReferences }`. Signature:
`walkReferences(ng, ts, solutionParsed, solutionTsConfigPath): Promise<WalkResult>`.

---

### CHANGED `src/core/run-typecheck.ts` (core engine, request-response)

**Analog:** itself -- three shipped idioms extended in place.

**1. D-03a three-way split** at the existing single-branch guard (`run-typecheck.ts:185-203`).
The current `if (parsed.rootNames.length === 0)` (`:190`) returns one synth guard. Replace with
(L-3 / Spike 004):

```
rootNames > 0                             -> compile-direct (UNCHANGED; :212-299)
rootNames === 0 && references present     -> const walk = await walkReferences(ng, ts, parsed, options.tsConfigPath);
                                             walk.rootNamesCount > 0
                                               -> finalize(ts, tsConfigPath, walk.rootNamesCount,
                                                           [...configDiagnostics, ...walk.rawDiagnostics], start, {filter...})
                                                  + thread walk.skippedReferences onto result
                                             else -> synthesizeZeroRootNamesDiagnostic(90001, none-in-project) + attach skippedReferences
rootNames === 0 && no references          -> synthesizeZeroRootNamesDiagnostic(90001, empty-project) (UNCHANGED)
```

`references present` = the same `parsed.projectReferences !== undefined && .length > 0` predicate
already used in `synthesizeZeroRootNamesDiagnostic` at `:333-335`.

**2. `finalize` args for the walk branch -- copy the DIRECT path's filter block** (`run-typecheck.ts:287-298`):

```typescript
{
  basePath: resolveFilterBasePath(parsed.options.basePath, options.tsConfigPath),
  includeDeps: options.includeDeps ?? false,
  useCaseSensitiveFileNames: firstWalkedLeafProgram.getTsProgram().useCaseSensitiveFileNames(),
  realpath: (filePath: string): string => ts.sys.realpath?.(filePath) ?? filePath,
}
```

Directive 5: `includeDeps` applies ONCE here (not per-leaf); `basePath` = the SOLUTION tsconfig's
directory via `resolveFilterBasePath`; `useCaseSensitiveFileNames` from ANY one walked leaf's
program (they share the FS host). Directive 6: because the union is passed as the pre-filter
`diagnostics` arg, `detectTemplateCheckAborted` (`:444,474-489`) fires on a TCB abort in ANY leaf
with NO change to the detection logic.

**3. `skippedReferences` threading** -- Open Question 2: attach after `finalize` returns in the
walk branch (do NOT add a `finalize` param). Mirror the presence spread idiom at `:454`:
`...(templateCheckAborted !== undefined ? { templateCheckAborted } : {})`. Core maps an empty
walk array `[]` -> `undefined` on `CoreResult` so the adapter presence check is sufficient.

**4. `CoreResult` optional field** -- mirror the `templateCheckAborted?` field doc-comment style
(`:52-71`): add `skippedReferences?: readonly SkippedReference[];` and a `SkippedReference`
interface modelled on `TemplateCheckAborted` (`:80-87`) with `{ referencePath: string; reason:
'out-of-project' | 'zero-root-names' | 'self-reference' | 'not-found' }`.

**COR-01 containment (load-bearing):** the DIRECT 500 scan/rethrow (`:167-178`) and its pinning
test (`config-resolution.integration.spec.ts:100-121`) stay BYTE-UNCHANGED. Fold-and-count applies
ONLY inside the walk's per-leaf `ng.readConfiguration` (Pitfall 4).

---

### CHANGED `src/core/filter-diagnostics.ts` (core utility, transform)

**Analog:** its own existing export style. The file already does
`export function filterDiagnostics(...)` (`:64`) and `export interface FilterOptions` (`:39`).
`createCanonicalizer` (`:128`) and `isUnderDir` (`:184`) are declared with a bare `function`
(module-private). The ONLY change: add the `export` keyword to those two (Pitfall 6 / Open
Question 1). Keep the doc-comments verbatim; do NOT alter their bodies (D-01 "reuse verbatim").
`isNodeModulesPath` (`:173`) stays private unless the walk also needs it.

---

### CHANGED `src/index.ts` (barrel)

**Analog:** the existing `export type { CoreOptions, CoreResult }` line (`index.ts:15`, cited in
RESEARCH). Add `SkippedReference` alongside it:
`export type { CoreOptions, CoreResult, SkippedReference } from './core/run-typecheck';`
(or from `./core/walk-references` if the interface lives there). Additive, non-breaking (0.x).

---

### CHANGED `src/executors/angular-typecheck/executor.ts` (adapter, request-response + logging)

**Analog:** the `templateCheckAborted` render seam at `executor.ts:49-63` -- copy its structure exactly.

**Excerpt to mirror** (`executor.ts:52-63`):

```typescript
if (result.templateCheckAborted !== undefined) {
  const offendingFile =
    result.templateCheckAborted.fileName ?? 'an unknown file';

  logger.warn(
    `angular-typecheck: a fatal template-compilation error ...`,
  );
}
```

**New block to ADD directly after it** (D-02 / RESEARCH directive 2), gated on presence AND
non-empty, iterating the array and calling `logger.warn` per skipped reference. The notice is
ADVISORY (never a verdict change, L-4). ASCII-only message text. This is the ONLY place logging
happens -- core sets the field purely; the adapter renders. `logger` is already imported from
`@nx/devkit` (`executor.ts:2`); no new import.

---

### NEW `walk-references.spec.ts` (unit) + `walk-references.integration.spec.ts` (integration)

**Unit analog:** `run-typecheck.ts` exports `detectTemplateCheckAborted` specifically "for the
RES-02 unit tier: a synthesized diagnostic set lets the detection logic be proven WITHOUT a real
cold-compiler run" (`:470-473`). Mirror that: unit-test the walk's pure decisions (reference
resolution, self-ref dedupe, boundary skip, `90002` synthesis, `[]`->`undefined` mapping) against
HAND-BUILT `ParsedConfiguration` / stub programs -- no cold compiler. `it.each` is the
parameterized idiom (CONTEXT `<code_context>`).

**Integration analog:** `config-resolution.integration.spec.ts` (read in full) -- copy its whole
harness shape:
- Path setup: `packageRoot`/`workspaceRoot` via `dirname(fileURLToPath(import.meta.url))` then
  `join(workspaceRoot, 'fixtures', '<name>', 'tsconfig.json')` (`:32-52`).
- `const TS2322 = 2322;` and `const NG = (code) => -990000 - code;` (`:29-30`) -- assert bare TS
  codes and the NEW `90002` as a bare positive (`codes).toContain(90002)`, `NG()`-encode Angular
  codes only.
- `messageTextOf(diagnostic)` helper (`:54-56`) via `ts.flattenDiagnosticMessageText`.
- Assert off `CoreResult` from `await runTypecheck({ tsConfigPath })` -- `rootNamesCount`,
  `errorCount`, `codes = result.diagnostics.map(d => d.code)`, `codes.filter(c => c === 2322).length`,
  distinct `file.fileName` (`:59-70`, `:126-151`).
- D-05 negative assertion: `runTypecheck({ tsConfigPath: brokenRefSolution })` RESOLVES (does NOT
  `rejects.toBeInstanceOf(TypecheckInfrastructureError)`) -- inverse of the COR-01 pinning test at
  `:118-120`.

**The block to REWRITE:** `config-resolution.integration.spec.ts:124-152` (the
`describe('...solution-style guard fires...')` block). Currently asserts `rootNamesCount === 0` +
`errorCount === 1` + guard message. Rewrite to assert the WALK: `rootNamesCount > 0`,
`errorCount === 2`, `codes.filter(c => c === 2322).length === 2`, distinct file names
(`error.component.ts` vs `error.component.spec.ts`), `codes` still NOT containing `18003` (KEEP
the `:142-151` TS18003-independence `it`), `skippedReferences` undefined. The COR-01 block
(`:100-121`) stays BYTE-UNCHANGED.

---

### UPGRADED `fixtures/solution-style/*` + 5 NEW sibling fixtures (fixture)

**Analog:** the existing `fixtures/solution-style/{tsconfig.json,tsconfig.app.json,error.component.ts}` (all read).

**`tsconfig.json`** currently (`fixtures/solution-style/tsconfig.json`):
```json
{ "extends": "../../tsconfig.base.json", "compileOnSave": false, "files": [], "references": [{ "path": "./tsconfig.app.json" }] }
```
Add the spec-leaf reference: `{ "path": "./tsconfig.spec.json" }` to the `references` array.

**`tsconfig.app.json`** structure is the template for the NEW `tsconfig.spec.json` (mirror the
`extends`/`compilerOptions`/`files` shape at `tsconfig.app.json:1-16`; the spec leaf adds
`"types": ["vitest/globals", "node"]` and `"files": ["error.component.spec.ts"]`).

**`error.component.ts`** currently a CLEAN signal component (`:12-19`, `template: '<p>{{ status() }}</p>'`,
`status = signal('ready')`). REPLACE with a plain-literal template + planted `count: number =
'not-a-number';` (TS2322) -- Pitfall 3: NO interpolated signal, so no NG8117/NG8109 co-fire.
NEW `error.component.spec.ts` carries a DISTINCT planted TS2322 (`const specOnly: number =
'also-not-a-number';`). Keep the fixture header comment style (`error.component.ts:3-11`) noting
the fixture is out of the plugin build graph, no `@ts-nocheck`.

**5 NEW sibling fixtures** (mirror the same `extends: "../../tsconfig.base.json"` base):
`-overlap` (lib+spec share ONE source -> dedupe collapse, SC2), `-oop` (references ONLY an
out-of-project leaf -> boundary skip + 90001 + `skippedReferences`), `-empty`
(`{ "extends": "../../tsconfig.base.json", "files": [] }`, no references -> 90001 empty-project),
`-broken-ref` (real leaf + a nonexistent path -> D-05 90002 + survivor walked),
`-selfref` (references itself / a leaf twice -> D-04 output-neutral dedupe).

---

### CHANGED `nx.json` `targetDefaults["angular-typecheck"]` (config)

**Analog:** the existing `targetDefaults["angular-typecheck"]` block in `nx.json`. One-line edit
(L-5 / WALK-02 / Spike 005): swap `"production"` -> `"default"` in `inputs`. RETAIN `outputs: []`,
the `{projectRoot}/tsconfig*.json` glob, and `^default`. Rationale: a spec-only source edit MUST
change the input hash or a spec-only change yields a stale PASS.

## Shared Patterns

### Core purity (no logging in core; adapter renders)
**Source:** `run-typecheck.ts` `templateCheckAborted` (pure detection field, `:52-71,444`) ->
`executor.ts:52-63` (`logger.warn`).
**Apply to:** `walk-references.ts` (sets `skippedReferences` purely) + `executor.ts` (renders it).
Core has ZERO `console`/`process`/`@nx/devkit`. The `no-console`/`no-process` ESLint gate is
scoped to `**/src/core/**`.

### Synthesized private diagnostic codes (outside TS/NG/500 spaces)
**Source:** `run-typecheck.ts:89-93` (`ZERO_ROOT_NAMES_DIAGNOSTIC_CODE = 90001` + rationale comment).
**Apply to:** the new `90002` REFERENCE_NOT_FOUND constant + synthesizer. File-less shape
(`file/start/length: undefined`) so `filter-diagnostics.ts:85` always keeps it and `finalize`
counts it as an Error.

### Detect-by-CODE-only (never source/message text)
**Source:** the infra-500 scans (`run-typecheck.ts:167-169,244-246`) and `detectTemplateCheckAborted`
(`:474-479`).
**Apply to:** the walk's per-leaf 500 detection (`diagnostic.code === ng.UNKNOWN_ERROR_CODE`) ->
reclassify to 90002. NEVER match on `source`/messageText.

### Single-`finalize`-over-the-union aggregation
**Source:** `run-typecheck.ts` `finalize` (`:394-456`) -- filter -> `ts.sortAndDeduplicateDiagnostics`
-> explicit category counts (NEVER `length - errorCount`).
**Apply to:** the walk branch feeds ONE union into the EXISTING `finalize`; NO second dedupe/merge
layer (Pitfall 1). Cross-`Program` dedupe is by `file.path` STRING identity (L-2).

### Integration-spec harness (fixtures + NG() + off-CoreResult)
**Source:** `config-resolution.integration.spec.ts` (full file).
**Apply to:** both new spec files -- `join(workspaceRoot, 'fixtures', ...)` paths, `TS2322`/`NG()`
consts, `messageTextOf`, assertions off `runTypecheck(...)` `CoreResult`, `it.each` for the
three-way split.

## No Analog Found

None. Every new/changed file has a direct in-repo analog; no file must fall back to RESEARCH.md
reference patterns.

## Metadata

**Analog search scope:** `packages/angular-typechecker/src/core/**`, `packages/angular-typechecker/src/executors/angular-typecheck/`, `packages/angular-typechecker/src/index.ts`, `fixtures/solution-style/`, `nx.json` (via CONTEXT/RESEARCH citations).
**Files scanned:** 10 (the fixed read-set) -- no node_modules, no broader exploration.
**Pattern extraction date:** 2026-07-01
