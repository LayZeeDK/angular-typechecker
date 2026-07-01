# Phase 13: Engine -- solution-tsconfig reference-walking - Research

**Researched:** 2026-07-01
**Domain:** Angular compiler-cli / TypeScript diagnostic aggregation across referenced leaf tsconfigs (Nx plugin core engine)
**Confidence:** HIGH

## Summary

Phase 13 teaches `runTypecheck` to walk a solution / references-only `tsconfig.json`: resolve
`references[]` to leaf tsconfigs, run `performCompilation` per leaf (Approach A), UNION the raw
per-leaf diagnostics into ONE existing `finalize` pass (boundary filter -> `ts.sortAndDeduplicateDiagnostics`
-> explicit category counts), and return the complete, duplicate-free diagnostic set with
`rootNamesCount` = the sum over walked leaves. Every fork is already LOCKED (L-1..L-7 / D-01..D-05);
this research only PINS the six research directives to code-verified values and specifies the
Validation Architecture. All six directives resolve cleanly against the shipped engine -- no
open blockers.

The six pins: (1) D-05 uses new code `90002` with message `"angular-typechecker: referenced
tsconfig not found: <path>"`, a sibling to `ZERO_ROOT_NAMES_DIAGNOSTIC_CODE = 90001`
(`run-typecheck.ts:93`), synthesized in the walk module and folded+counted (B3) while surviving
leaves still walk. (2) `skippedReferences` is a new OPTIONAL array field on `CoreResult`
modelled on `TemplateCheckAborted` (`run-typecheck.ts:80-87`), carrying `{ referencePath, reason }`
records with a `reason` discriminator; the adapter emits `logger.warn` gated on a non-empty array,
mirroring the `templateCheckAborted !== undefined` seam at `executor.ts:52-63`. (3) The walk
lives in a NEW pure core module `walk-references.ts` (mirroring `filter-diagnostics.ts` /
`gather-diagnostics.ts`), invoked from `runTypecheck` at the D-03a `rootNames.length === 0` split
(`run-typecheck.ts:190`). (4) `fixtures/solution-style` gains a planted `TS2322` in the app/lib
leaf and a NEW `tsconfig.spec.json` leaf with a DISTINCT planted `TS2322` (distinct identity via
distinct files) -- plain TS errors, avoiding spike-001's NG8117+NG8109 co-fire. (5) `includeDeps`
/ `pathBase` are run-level `CoreOptions` that apply ONCE to the single union `finalize`, not
per-leaf. (6) The pre-filter Fatal scan (`detectTemplateCheckAborted`, `run-typecheck.ts:474-489`)
runs over the UNIONED raw diagnostics, so a TCB-abort in ANY leaf fires the notice.

**Primary recommendation:** Add a pure `walk-references.ts` core module that, at the D-03a split,
resolves `parsed.projectReferences`, canonicalizes + dedupes + boundary-filters leaf paths
(reusing `createCanonicalizer`/`isUnderDir` from `filter-diagnostics.ts`), runs
`performCompilation` per surviving leaf, and returns `{ rawDiagnostics (union), rootNamesCount
(sum), skippedReferences }`. `runTypecheck` feeds the union into the EXISTING single `finalize`.
Synthesize `90002` for a nonexistent leaf PATH (fold-and-count, B3); keep the DIRECT COR-01 path
(`run-typecheck.ts:149-178`) and its pinning test (`config-resolution.integration.spec.ts:100-121`)
BYTE-UNCHANGED.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions (from CONTEXT.md; do NOT re-open)

- **L-1 Aggregation:** union raw per-leaf diagnostics -> ONE `finalize` over the union
  (boundary-filter -> `ts.sortAndDeduplicateDiagnostics` -> explicit post-dedupe `DiagnosticCategory`
  counts, NEVER `length - errorCount`); basePath = the solution tsconfig's directory.
- **L-2 Dedupe identity:** `file.path` + start + length + code + `messageText` -- exactly
  `ts.sortAndDeduplicateDiagnostics`' comparer (keys on `file.path` STRING, not the `SourceFile`
  object -- proven for cross-`Program` union).
- **L-3 D-03a three-way split** at `rootNames.length === 0`: references present + >=1 in-project
  leaf -> WALK; references present + 0 in-project -> synth error (code `90001`, distinct message);
  no references -> unchanged empty-project error. `rootNames > 0` direct-leaf path UNTOUCHED; NO
  branch gates on TS18003; `rootNamesCount` = sum over walked leaves.
- **L-4 Skip-with-notice (not silent, not hard-reject):** the module-boundary guard SKIPS
  out-of-project references and records the skipped set. Orthogonal to and composable with the
  existing `filter-diagnostics` + `includeDeps`.
- **L-5 Nx inputs:** swap `production` -> `default`; `outputs: []`, the `{projectRoot}/tsconfig*.json`
  glob, and `^default` retained.
- **L-6 Fixtures + spec:** `fixtures/solution-style` gains a KNOWN diagnostic + a real
  `tsconfig.spec.json` leaf; a references-less fixture covers the still-errors branch; an
  out-of-project-refs fixture covers the boundary guard; `config-resolution.integration.spec.ts:124-152`
  is rewritten to assert the walk.
- **L-7 Approach A:** `performCompilation` per leaf; NO `NgtscProgram`. Incremental
  declaration-reuse DEFERRED (WALK-FUT-02).
- **D-01:** guard lives in PURE CORE, decides "in-project" by path-containment under the solution
  tsconfig's directory, canonicalized with the SAME `createCanonicalizer` + `isUnderDir` that
  `filter-diagnostics.ts` already ships. Structural (no toggle).
- **D-02:** engine sets a NEW pure-detection OPTIONAL field on `CoreResult` (`skippedReferences`)
  with NO `console`/`process`; the Nx adapter branches on presence and renders a `logger.warn`
  notice at the `executor.ts:49-63` seam. Advisory, never a verdict change.
- **D-03:** walk DIRECT `references[]` only (one level); no recursion.
- **D-03b:** emit a skip-with-notice for ANY resolved config (solution OR leaf) that yields
  `rootNames.length === 0`.
- **D-04:** at reference-resolution, canonicalize + dedupe resolved leaf paths and skip a
  self-reference back to the solution tsconfig. Output-neutral.
- **D-05 (maintainer decision, B3 fold-and-count):** a NONEXISTENT leaf tsconfig (ENOENT ->
  code-500 `UNKNOWN_ERROR_CODE`) -> synthesize a COUNTED Error diagnostic (NEW `9000x` code, e.g.
  `90002`) for the broken reference, then WALK the surviving leaves. B3 governs ONLY the
  nonexistent-PATH (500) case; a bad-`extends` TARGET stays a folded 5012 (unchanged). The DIRECT
  single-config COR-01 path (`run-typecheck.ts:149-178`) + its pinning test
  (`config-resolution.integration.spec.ts:100-121`) stay BYTE-UNCHANGED.

### Claude's Discretion (the six directives this research PINS)

1. Synthesized code for D-05 (new `9000x`; message; outside TS/NG/500 spaces).
2. `skippedReferences` field shape (model on `TemplateCheckAborted`; array; reason discriminator).
3. Where the walk lives (new `walk-references.ts` vs inline; keep core pure).
4. The KNOWN diagnostic for `fixtures/solution-style` (planted TS error per leaf; add
   `tsconfig.spec.json` leaf; avoid co-firing extras).
5. `includeDeps` / `pathBase` propagation (apply once to the single union `finalize`).
6. `templateCheckAborted` across leaves (Fatal scan over the UNIONED raw diagnostics).

### Deferred Ideas (OUT OF SCOPE)

- Executor-layer Nx project-graph boundary (additive over the D-01 core floor).
- Transitive reference recursion (no Nx layout exercises it today).
- WALK-FUT-01 (`createNodesV2` granular per-leaf targets) and WALK-FUT-02 (`NgtscProgram`
  incremental declaration-reuse).
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                                                                    | Research Support                                                                                                                                                                                                                     |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| WALK-01 | Accept a solution / references-only `tsconfig.json` and type-check each in-project referenced leaf in ONE call; union+dedupe into a single diagnostic set.     | Directives 1, 3, 5, 6 pin the walk module, union->single-finalize aggregation, `includeDeps`/`pathBase` once-per-run, and the cross-leaf Fatal scan. Spike 001 (union-dedupe) + Spike 004 (D-03a split) are the validated substrate. |
| WALK-02 | Nx target inputs use `default` (not `production`) so a spec-only edit is not a stale PASS; `outputs: []`, `{projectRoot}/tsconfig*.json`, `^default` retained. | L-5 (Spike 005). One-line `nx.json` `targetDefaults` edit; Validation Architecture SC5 covers the production->default hashing proof.                                                                                                 |

_(WALK-01/WALK-02 are the two locked requirements in REQUIREMENTS.md for this phase. D-05's
`90002` code, the `skippedReferences` shape, and the fixture substrate all serve WALK-01's
"complete, duplicate-free, no-false-PASS" contract.)_
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **Core-vs-adapter purity:** NO `console` / NO `process` in `**/src/core/**` (ESLint `no-console`
  / `no-process` gate, `eslint.config.mjs`). The new `walk-references.ts` and the `skippedReferences`
  field are PURE detection; ALL logging stays in the executor adapter (`logger.warn`). Core is
  Nx-agnostic (D-04 contract: zero `@nx/devkit` imports in core).
- **Diagnostics counted by `ts.DiagnosticCategory`,** never by code sign or `length - errorCount`.
- **Angular codes are NEGATIVE-encoded** (`NG(code) = -990000 - code`); assert via the `NG()`
  helper, never the bare positive code. Detect special codes (500 infra, NG3004 TCB fatal,
  90001/90002 synthesized) BY CODE ONLY, never by `source`/message text.
- **Tech stack (locked):** Nx 23.x, Angular 22.x (`@angular/compiler-cli@22.0.4`),
  TypeScript `>=6.0.0 <6.1.0` (verified `6.0.3`), Vitest `~4.1.0` via `@nx/vitest:test`.
- **ASCII-only output** in all files (no em/en dashes, curly quotes, ellipsis, box-drawing).
- **Verify via `nx test`,** never the editor LSP (`npx nx test angular-typechecker`).
- **GSD workflow:** file changes go through a GSD command; this phase is planned then executed.
- **No new external packages** are introduced by this phase -- Package Legitimacy Audit is N/A
  (all machinery reuses shipped `typescript` + `@angular/compiler-cli` peers already declared).

## Architectural Responsibility Map

| Capability                                          | Primary Tier                                                | Secondary Tier      | Rationale                                                                                            |
| --------------------------------------------------- | ----------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------- |
| Resolve `references[]` -> leaf tsconfig paths       | Core (`walk-references.ts`)                                 | --                  | Pure path resolution off `parsed.projectReferences`; no I/O beyond `readConfiguration` per leaf.     |
| Module-boundary guard (in-project decision)         | Core (`walk-references.ts` reusing `filter-diagnostics.ts`) | --                  | D-01: structural path-containment; reuse `createCanonicalizer`/`isUnderDir`. Core stays Nx-agnostic. |
| Per-leaf `performCompilation` + gather              | Core (`walk-references.ts` invoking `gatherAllDiagnostics`) | --                  | Approach A per leaf; the shipped unconditional all-getter is reused verbatim.                        |
| Union + dedupe + count                              | Core (`finalize`, `run-typecheck.ts:394-456`)               | --                  | L-1: ONE `finalize` over the union; NO second dedupe layer.                                          |
| Synthesize `90002` / `90001` guard diagnostics      | Core (`walk-references.ts` + `run-typecheck.ts`)            | --                  | Counted Error diagnostics; folded into the union so counts stay honest.                              |
| `skippedReferences` detection (set the field)       | Core (pure)                                                 | --                  | D-02: pure detection field on `CoreResult`; no logging.                                              |
| Render the skipped-reference `logger.warn` notice   | Executor adapter (`executor.ts:49-63` seam)                 | --                  | Adapter owns ALL I/O + logging + exit; core cannot log.                                              |
| Nx target input hashing (`production` -> `default`) | Nx config (`nx.json` `targetDefaults`)                      | Executor invocation | L-5/WALK-02: cache-correctness lives in `nx.json`, not code.                                         |

## Directive 1 -- D-05 synthesized code + message

**PINNED: code `90002`, message `"angular-typechecker: referenced tsconfig not found: <path>"`.**

- **Chosen code:** `90002`. It is the next number in the private `9000x` synthesized family;
  the ONLY existing member is `ZERO_ROOT_NAMES_DIAGNOSTIC_CODE = 90001` (`run-typecheck.ts:93`),
  so `90002` is the natural sibling with no conflict. `[VERIFIED: run-typecheck.ts:93 grep of the
codebase shows 90001 as the sole 9000x code]`
- **Outside all reserved spaces** (same rationale the 90001 comment records at
  `run-typecheck.ts:89-92`): TS diagnostic codes are 1xxx-9xxx / TS18xxx range (all < 90000);
  Angular extended codes are NEGATIVE-encoded (`NG(code) = -990000 - code`, so all negative);
  `UNKNOWN_ERROR_CODE` is `500`. `90002` collides with none. `[CITED: run-typecheck.ts:89-93]`
- **Exact message:** `"angular-typechecker: referenced tsconfig not found: " + <resolvedPath>`.
  Interpolate the resolved absolute leaf path so an agent/CI gets an actionable next step
  (mirrors the leaf-naming discipline of `synthesizeZeroRootNamesDiagnostic`,
  `run-typecheck.ts:337-346`). Category `ts.DiagnosticCategory.Error`, `file: undefined`,
  `start: undefined`, `length: undefined` -- exactly the file-less shape of the 90001 synthesizer
  (`run-typecheck.ts:348-355`), so `filter-diagnostics.ts:85` keeps it (file-less diagnostics are
  never filtered) and `finalize` counts it as an Error.

**Where the constant + synthesizer live:** the `90002` constant and a `synthesizeReferenceNotFoundDiagnostic(ts, resolvedPath)`
function live in the NEW `walk-references.ts` (co-located with the walk that emits it), OR the
constant may sit beside `ZERO_ROOT_NAMES_DIAGNOSTIC_CODE` in `run-typecheck.ts` and be imported --
planner's call, but the synthesizer belongs in the walk module (it fires only during the walk).
Keep it a private module constant (not exported) unless a spec needs to reference it by value;
specs assert `codes).toContain(90002)` directly (bare positive, like `TS2322`) since it is NOT
Angular-encoded.

**How the two 9000x codes are consumed (the critical distinction):**

| Case                                    | Trigger                                                                                                                | Code        | Consumed by                                                                                                                                                          |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L-3 references-present-but-0-in-project | all references skipped by boundary guard; `rootNames.length === 0`                                                     | `90001`     | `synthesizeZeroRootNamesDiagnostic` (`run-typecheck.ts:329-356`), existing "references-none-in-project" message branch                                               |
| L-3 empty project (no references)       | `rootNames.length === 0`, no `projectReferences`                                                                       | `90001`     | same synthesizer, "empty-project" message branch (unchanged)                                                                                                         |
| D-05 nonexistent leaf PATH              | `ng.readConfiguration(leafPath)` for a walked leaf returns a code-500 `UNKNOWN_ERROR_CODE` in `parsed.errors` (ENOENT) | **`90002`** | NEW `synthesizeReferenceNotFoundDiagnostic`; RECLASSIFY the 500 -> `90002`, fold into the union, COUNT it, and CONTINUE walking surviving leaves (B3 fold-and-count) |
| bad `extends` TARGET in a leaf          | leaf's `readConfiguration` returns a folded `5012` in `parsed.errors` (NOT a 500)                                      | `5012`      | folded verbatim into the union under shipped D-03 -- **NOT** part of D-05; no reclassification                                                                       |

**The load-bearing distinction (verified against `<specifics>` + `config-resolution.integration.spec.ts:100-121`):**
a nonexistent PATH reliably yields code-500 `UNKNOWN_ERROR_CODE` (ENOENT via `readConfiguration`'s
outer catch), whereas a nonexistent `extends` TARGET yields a folded `5012`. Only the former (500)
is subject to D-05's reclassification-to-`90002`. `[VERIFIED: CONTEXT.md <specifics> lines 281-283

- config-resolution.integration.spec.ts:106-109 comment]`

**COR-01 containment:** D-05's reclassification applies ONLY to a WALKED LEAF's per-leaf
`ng.readConfiguration` 500. The DIRECT single-config path -- the top-level
`configInfrastructureFailure` scan at `run-typecheck.ts:167-178` and its pinning test at
`config-resolution.integration.spec.ts:100-121` -- stays BYTE-UNCHANGED (a direct 500 still
re-throws `TypecheckInfrastructureError`). The walk's per-leaf resolution is the ONLY place
fold-and-count applies. `[CITED: CONTEXT.md D-05 "COR-01 containment", run-typecheck.ts:149-178]`

## Directive 2 -- skippedReferences field shape (D-02)

**PINNED shape (modelled on `TemplateCheckAborted`, `run-typecheck.ts:80-87`):**

```typescript
// A single skipped/reclassified reference edge, recorded during the walk. PURE
// detection (no console/process). Mirrors the TemplateCheckAborted pattern: a
// small named interface carried on CoreResult; the adapter renders the notice.
export interface SkippedReference {
  // The resolved absolute path of the referenced leaf tsconfig (or the raw
  // ref.path when it could not be resolved to an absolute path).
  referencePath: string;
  // Discriminator explaining why the reference was skipped or reclassified.
  reason:
    | 'out-of-project' // D-01/L-4: path-containment guard skipped it (not under the solution dir)
    | 'zero-root-names' // D-03b: the leaf resolved but produced rootNames.length === 0
    | 'self-reference' // D-04: canonical path equals the solution tsconfig (redundant, skipped)
    | 'not-found'; // D-05: ENOENT / code-500 -> reclassified to 90002 (still counted)
}
```

- **Array, not singular.** A solution can reference multiple out-of-project / broken / zero-rootNames
  leaves in one call, so the field is `readonly SkippedReference[]`. CONTEXT.md directive 2
  explicitly says "array -- a solution can have multiple". `[CITED: CONTEXT.md L-169]`
- **Attaches on `CoreResult` as OPTIONAL / additive** (`run-typecheck.ts:33-71`):

```typescript
export interface CoreResult {
  // ...existing fields (tsConfigPath, rootNamesCount, diagnostics, errorCount,
  // warningCount, suppressedCount, durationMs, templateCheckAborted?) ...

  // D-02 (Phase 13): references skipped or reclassified during a solution-tsconfig
  // walk. Present (and non-empty) ONLY when at least one reference was skipped
  // (out-of-project / zero-root-names / self-reference) or reclassified
  // (not-found -> 90002). Undefined on the direct single-leaf path and on any walk
  // where every reference was walked cleanly. PURE detection: the adapter renders
  // the loud logger.warn; core never logs. Additive/non-breaking (0.x semver).
  skippedReferences?: readonly SkippedReference[];
}
```

- **Adapter emission gate mirrors `templateCheckAborted !== undefined`.** In `executor.ts`, ADD a
  branch alongside the existing `if (result.templateCheckAborted !== undefined)` block
  (`executor.ts:52-63`). The gate is presence-AND-non-empty:

```typescript
// D-02 (Phase 13): surface the loud skipped-reference notice. Fires only when
// the core recorded at least one skipped/reclassified reference during a walk.
if (result.skippedReferences !== undefined && result.skippedReferences.length > 0) {
  for (const skipped of result.skippedReferences) {
    logger.warn(`angular-typecheck: reference '${skipped.referencePath}' was ` + `${skipped.reason} and was skipped/reclassified during the ` + `solution-tsconfig walk. ...advisory only; the verdict is unchanged.`);
  }
}
```

Core sets the field only when non-empty (never `[]`) so the `!== undefined` presence check is
sufficient, and the extra `.length > 0` is belt-and-suspenders. The notice is ADVISORY, never a
verdict change (consistent with L-4 skip-with-notice). `[CITED: executor.ts:49-63; run-typecheck.ts:452-455]`

- **Core purity preserved:** the field is set by the pure walk in `walk-references.ts`; NO
  `console`/`process` in core (`eslint.config.mjs` `no-console`/`no-process` on `**/src/core/**`).
- **`index.ts` export:** add `export type { SkippedReference } from './core/run-typecheck';` (or from
  `walk-references.ts` if the interface lives there) alongside the existing `CoreResult` export
  (`index.ts:15`) so consumers can type the new field.

## Directive 3 -- Where the walk lives (code organization)

**PINNED: a NEW pure core module `packages/angular-typechecker/src/core/walk-references.ts`**
(mirrors the separate `filter-diagnostics.ts` / `gather-diagnostics.ts` modularity; keeps
`run-typecheck.ts` readable and the walk unit-testable in isolation).

**Recommended exported signature(s):**

```typescript
// walk-references.ts (PURE core -- no console/process, no @nx/devkit).

export interface WalkResult {
  // The UNION of raw (pre-filter, pre-dedupe) diagnostics gathered across every
  // walked leaf, PLUS any synthesized 90002 not-found diagnostics. Fed straight
  // into the single existing finalize() over the union (L-1).
  rawDiagnostics: readonly ts.Diagnostic[];
  // Sum of parsed.rootNames.length across walked leaves (L-3 rootNamesCount).
  rootNamesCount: number;
  // D-02: references skipped (out-of-project / zero-root-names / self-reference)
  // or reclassified (not-found). Empty array when every reference walked cleanly;
  // runTypecheck maps [] -> undefined on CoreResult.
  skippedReferences: readonly SkippedReference[];
}

export async function walkReferences(
  ng: CompilerCli, // the loaded @angular/compiler-cli (readConfiguration, performCompilation, UNKNOWN_ERROR_CODE)
  ts: typeof import('typescript'),
  solutionParsed: ParsedConfiguration, // the already-parsed solution config (carries projectReferences)
  solutionTsConfigPath: string, // absolute path to the solution tsconfig (for self-ref detection + basePath)
): Promise<WalkResult>;
```

Internals reuse `createCanonicalizer` + `isUnderDir` from `filter-diagnostics.ts` for the D-01
boundary guard and D-04 self-reference/leaf dedupe (export them from `filter-diagnostics.ts` if not
already exported -- currently `createCanonicalizer`/`isUnderDir` are module-private at
`filter-diagnostics.ts:128,184`, so the planner must export them or add a small shared helper).
Each surviving leaf runs `ng.performCompilation({ rootNames, options: {...emit-neutralizing...},
emitFlags: 0, gatherDiagnostics: gatherAllDiagnostics })` -- the SAME override block as
`run-typecheck.ts:212-239`; factor that override into a shared helper to avoid drift.

**The runTypecheck invocation point (the D-03a split):** at `run-typecheck.ts:190`
(`if (parsed.rootNames.length === 0)`), replace the current single-branch guard with the three-way
split (L-3 / Spike 004):

```
rootNames > 0                                          -> compile-direct (UNCHANGED; run-typecheck.ts:212-299)
rootNames === 0 && references present                 -> const walk = await walkReferences(ng, ts, parsed, options.tsConfigPath);
                                                          if (walk.rootNamesCount > 0)  -> finalize over [...configDiagnostics, ...walk.rawDiagnostics]
                                                                                           with the walk's skippedReferences threaded onto the result
                                                          else (0 in-project leaves)    -> synthesizeZeroRootNamesDiagnostic (90001, none-in-project msg)
                                                                                           + attach walk.skippedReferences
rootNames === 0 && no references                       -> synthesizeZeroRootNamesDiagnostic (90001, empty-project msg; UNCHANGED)
```

The walk's union feeds the EXISTING `finalize` (`run-typecheck.ts:394`) with the SAME
boundary-filter args (basePath = the solution tsconfig's directory via `resolveFilterBasePath`,
`run-typecheck.ts:288-291`; `useCaseSensitiveFileNames`/`realpath` from ONE of the walked leaves'
programs -- they share the same filesystem host, so any leaf's program works; recommend the first
walked leaf). `skippedReferences` is threaded onto the `finalize` result (or `finalize` gains an
optional `skippedReferences` arg mirroring how `templateCheckAborted` is spread in at
`run-typecheck.ts:454`). Keep core pure throughout.

## Directive 4 -- KNOWN diagnostic for fixtures/solution-style

**PINNED: plant a plain `TS2322` (type-not-assignable) in a DISTINCT source file per leaf; add a
new `tsconfig.spec.json` leaf; reference BOTH leaves from the solution `tsconfig.json`. Avoid any
Angular template extended diagnostic (no interpolated signals) so nothing co-fires like
spike-001's NG8117+NG8109 surprise.** `[CITED: spike 001 README lines 103-113, 135-136; CONTEXT.md
directive 4]`

**Why TS2322 with DISTINCT files:** each leaf's planted error lives in its OWN file, so the two
diagnostics have DISTINCT `(file.path, start, length, code, messageText)` identities and cannot
be collapsed by `ts.sortAndDeduplicateDiagnostics` (L-2). The union assertion then unambiguously
proves BOTH leaves ran (two distinct TS2322s reported). A shared file compiled in both leaves
would collapse to one -- that is the dedupe proof, covered by a SEPARATE overlap fixture (see
Validation Architecture SC2/dedupe fixture), NOT the solution-style completeness fixture.

**Fixture file shapes (`fixtures/solution-style/`):**

`tsconfig.json` (solution -- ADD the spec leaf reference):

```json
{
  "extends": "../../tsconfig.base.json",
  "compileOnSave": false,
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.spec.json" }]
}
```

`tsconfig.app.json` (UNCHANGED structure; still `"files": ["error.component.ts"]`).

`error.component.ts` (REPLACE the current clean component with a component carrying a planted
`TS2322` -- assign a `string` to a `number`-typed field; keep the template a plain literal so no
NG8xxx fires):

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'solution-style-leaf',
  standalone: true,
  template: '<p>ready</p>',
})
export class SolutionStyleLeafComponent {
  // Planted TS2322: string assigned to number. Proves the app/lib leaf was
  // type-checked. Plain TS error only -- no interpolated signal, so no NG8117/
  // NG8109 co-fire (spike 001).
  count: number = 'not-a-number';
}
```

NEW `tsconfig.spec.json` (the spec leaf -- its OWN include + a planted error in a spec file):

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
    "experimentalDecorators": false,
    "types": ["vitest/globals", "node"]
  },
  "files": ["error.component.spec.ts"]
}
```

NEW `error.component.spec.ts` (spec-leaf source with its OWN DISTINCT planted TS2322 -- reachable
ONLY through the spec leaf, the named differentiator vs a build):

```typescript
import { SolutionStyleLeafComponent } from './error.component';

// Planted TS2322 in the SPEC leaf, distinct file/identity from the component's.
// A build never compiles specs; the walk's spec leaf does -- proving the spec
// was type-checked.
const specOnly: number = 'also-not-a-number';
void specOnly;
void SolutionStyleLeafComponent;
```

**Expected codes / identities the rewritten spec asserts** (`config-resolution.integration.spec.ts`
solution-style block, replacing `:124-152`):

- `result.rootNamesCount` **> 0** (sum of both leaves' rootNames; was `=== 0`).
- `result.errorCount` **=== 2** (two distinct TS2322s -- one per leaf; no dedupe collapse because
  distinct files).
- `result.diagnostics.map(d => d.code)` contains `TS2322` (2322) -- and the multiset has EXACTLY
  two `2322` entries (assert `codes.filter(c => c === 2322).length === 2` to prove both leaves ran
  AND nothing double-counted).
- The two reported TS2322 diagnostics have DISTINCT `file.fileName` (one `error.component.ts`, one
  `error.component.spec.ts`) -- the completeness + both-leaves-ran proof.
- `codes` does NOT contain `18003` (KEEP the existing TS18003-independence assertion, unchanged
  per Spike 004 note 4).
- `result.skippedReferences` is `undefined` (both references are in-project and walk cleanly).

**References-less fixture** (`fixtures/solution-style-empty/` OR reuse an existing empty fixture):
a `tsconfig.json` with `"files": []` and NO `references` -> asserts the guard STILL fires
(`rootNamesCount === 0`, `errorCount === 1`, code `90001`, leaf-tsconfig-naming message,
`skippedReferences` undefined). Shape:

```json
{ "extends": "../../tsconfig.base.json", "files": [] }
```

**Out-of-project-refs fixture** (`fixtures/solution-style-oop/`): a `tsconfig.json` that references
ONLY a leaf OUTSIDE the solution directory (e.g. `{ "path": "../ts-baseline/tsconfig.json" }` or a
dedicated sibling outside the fixture dir), so the D-01 boundary guard skips it. Asserts:
`errorCount === 1`, code `90001` (references-present-but-none-in-project message), and
`skippedReferences` is a non-empty array with a `reason: 'out-of-project'` entry naming the skipped
path. The out-of-project leaf's own error is NEVER reported (its leaf is never walked -- composes
with the boundary guard, Spike 004 note 3).

## Directive 5 -- includeDeps / pathBase propagation

**CONFIRMED: `includeDeps` and `pathBase` are run-level `CoreOptions` (`run-typecheck.ts:11-24`)
and apply ONCE to the single union `finalize`, NEVER per-leaf.** `[VERIFIED: run-typecheck.ts source]`

- `pathBase` is IGNORED by `runTypecheck` entirely -- the doc comment at `run-typecheck.ts:19-23`
  states it is consumed ONLY by `formatReport` (the formatter's relativization base), and grep of
  `run-typecheck.ts` confirms `options.pathBase` is never read in the engine. It rides on
  `CoreOptions` for adapter/API discoverability. The walk does NOT touch it. `[CITED: run-typecheck.ts:19-23]`
- `includeDeps` is threaded into `finalize` EXACTLY ONCE, at the single `finalize` call
  (`run-typecheck.ts:292`: `includeDeps: options.includeDeps ?? false`). Because the walk feeds
  ONE union into ONE `finalize` (L-1), `includeDeps` governs the WHOLE union's boundary filter in a
  single pass -- semantics are preserved. There is NO per-leaf `finalize`, so there is no place for
  `includeDeps` to apply per-leaf. `[VERIFIED: run-typecheck.ts:292 + finalize at :394-415]`
- **Threading in the walk:** the walk's per-leaf `performCompilation` calls do NOT filter (they
  return raw gathered diagnostics via `gatherAllDiagnostics`); filtering happens ONLY in the single
  post-union `finalize`, where `options.includeDeps` is passed once (as today). The planner must
  ensure the walk-branch `finalize` call passes `includeDeps: options.includeDeps ?? false` and the
  solution-directory `basePath` -- identical to the direct path's `finalize` args
  (`run-typecheck.ts:287-298`).

## Directive 6 -- templateCheckAborted across leaves

**CONFIRMED: the pre-filter Fatal scan runs over the UNIONED raw diagnostics, so a TCB-abort in
ANY leaf fires the notice.** `[VERIFIED: run-typecheck.ts finalize + detectTemplateCheckAborted]`

- `detectTemplateCheckAborted(diagnostics)` (`run-typecheck.ts:474-489`) scans by CODE only
  (`TCB_GENERATION_FATAL_DIAGNOSTIC_CODE`) and is called INSIDE `finalize` on the PRE-filter
  `diagnostics` ARG -- NOT the post-filter `reported` set (`run-typecheck.ts:444`:
  `const templateCheckAborted = detectTemplateCheckAborted(diagnostics);`). `[CITED: run-typecheck.ts:444, 474-489]`
- Because the walk passes the UNION of every leaf's raw gathered diagnostics into that single
  `finalize` (L-1), the pre-filter `diagnostics` arg IS the union. So a TCB-generation Fatal
  (NG3004) present in ANY leaf's gathered set is in the union, `detectTemplateCheckAborted` finds it
  (first-match), and `templateCheckAborted` is set on the result -- exactly as on the direct path.
  The existing adapter `logger.warn` (`executor.ts:52-63`) then fires. No change to the detection
  logic is needed; only the walk must ensure it hands `finalize` the full pre-filter union (which
  the recommended `WalkResult.rawDiagnostics` does). `[VERIFIED: run-typecheck.ts:394-444; the
`finalize` `diagnostics` arg is the pre-filter superset]`
- Position relative to the union: the scan is at `run-typecheck.ts:444`, AFTER the boundary filter
  produces `kept`/`reported` (`:405-422`) but scanning the ORIGINAL `diagnostics` arg -- so an
  out-of-basePath Fatal that the boundary filter would suppress from `reported` is STILL caught
  (the pre-filter superset property, documented at `run-typecheck.ts:437-443`). This carries to the
  union unchanged.

## CONTEXT.md line-reference verification

Verified the CONTEXT.md line references (captured 2026-07-01) against current line numbers. Drift
corrections (the code has moved slightly since the earlier captures embedded in prose):

| CONTEXT.md claim                                           | Cited lines                                     | Verified current lines                                                                                                                                      | Status                                                             |
| ---------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `ZERO_ROOT_NAMES_DIAGNOSTIC_CODE = 90001`                  | `run-typecheck.ts:93`                           | `:93`                                                                                                                                                       | CORRECT                                                            |
| D-03a guard / split point                                  | `run-typecheck.ts:185-203` (and `:190`)         | guard at `:185-203`, trigger `if` at `:190`                                                                                                                 | CORRECT                                                            |
| `synthesizeZeroRootNamesDiagnostic`                        | `run-typecheck.ts:329-356`                      | `:329-356`                                                                                                                                                  | CORRECT                                                            |
| `finalize`                                                 | `run-typecheck.ts:394-456`                      | `:394-456`                                                                                                                                                  | CORRECT                                                            |
| RES-02 `templateCheckAborted` pure-detection               | `run-typecheck.ts:52-71, 444-489`               | field `:52-71`, detect `:444` + fn `:474-489`                                                                                                               | CORRECT                                                            |
| COR-01 500 scan/rethrow (direct path)                      | `run-typecheck.ts:149-178`                      | `:149-178`                                                                                                                                                  | CORRECT                                                            |
| `TemplateCheckAborted` interface                           | `run-typecheck.ts:80-87`                        | `:80-87`                                                                                                                                                    | CORRECT                                                            |
| `CoreResult` shape                                         | `run-typecheck.ts:38-42` (diagnostics doc)      | `:33-71` (full interface)                                                                                                                                   | CORRECT (the `:38-42` cite is the diagnostics-field doc, accurate) |
| `createCanonicalizer` + `isUnderDir` + `isNodeModulesPath` | `filter-diagnostics.ts:121-201`                 | `createCanonicalizer :128`, `isNodeModulesPath :173`, `isUnderDir :184`; block spans `:121-201`                                                             | CORRECT                                                            |
| executor `logger.warn` render seam                         | `executor.ts:49-63`                             | `:49-63` (the `templateCheckAborted` block)                                                                                                                 | CORRECT                                                            |
| `CoreResult` export                                        | `index.ts:15`                                   | `:15` (`export type { CoreOptions, CoreResult }`)                                                                                                           | CORRECT                                                            |
| spec solution-style block to rewrite                       | `config-resolution.integration.spec.ts:124-152` | `:124-152` (`describe('...solution-style guard fires...')`)                                                                                                 | CORRECT                                                            |
| COR-01 pinning test (BYTE-UNCHANGED)                       | `config-resolution.integration.spec.ts:100-121` | `:100-121`                                                                                                                                                  | CORRECT                                                            |
| `eslint.config.mjs` no-console/no-process scope            | `:16,54`                                        | Not re-read this session (per read-set) -- treated as accurate; the purity rule is independently confirmed by CLAUDE.md/AGENTS.md and the core doc comments | ASSUMED (see Assumptions Log A1)                                   |
| `perform_compile.d.ts:18` `projectReferences` flat array   | `node_modules/@angular/compiler-cli/...`        | Not re-read (node_modules excluded from read-set) -- trusted from CONTEXT.md `<specifics>`                                                                  | ASSUMED (see Assumptions Log A2)                                   |

**Net:** all tracked-source line references in CONTEXT.md are CURRENT and accurate; no drift found
in the files read this session. Two references point at files outside the read-set (`eslint.config.mjs`,
`node_modules/.../perform_compile.d.ts`) and are carried as ASSUMED (both are corroborated by
independent evidence, but not re-verified byte-for-byte this session).

## Validation Architecture

Nyquist validation is ENABLED (no `workflow.nyquist_validation: false` observed). Follows
`.planning/codebase/TESTING.md` conventions.

### Test Framework

| Property           | Value                                                                                                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | Vitest `~4.1.0` via Nx executor `@nx/vitest:test`                                                                                                                                                     |
| Config file        | `packages/angular-typechecker/vitest.config.mts` (include glob `{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}`; `testTimeout`/`hookTimeout` 30000 for cold-compiler integration specs) |
| Quick run command  | `npx nx test angular-typechecker`                                                                                                                                                                     |
| Full suite command | `npx nx run-many -t typecheck-drift test -p angular-typechecker` (drift tripwire + unit + integration)                                                                                                |

### Behaviors to sample (per ROADMAP SC1-5) and test tier

| SC         | Observable behavior                                                                                                                                                                                                               | Tier                                                                                                                        | Fixture                                                                              | Automated command                           |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------- |
| SC1        | UNION completeness: a solution `tsconfig.json` referencing app+spec leaves reports BOTH leaves' planted TS2322 (spec-only error present -- the build differentiator).                                                             | integration (`*.integration.spec.ts`, real compiler)                                                                        | `fixtures/solution-style` (upgraded)                                                 | `npx nx test angular-typechecker`           |
| SC2        | DEDUPE collapse: two leaves sharing a source file collapse the shared diagnostic to ONE across `Program`s (cross-`Program` value dedupe).                                                                                         | integration                                                                                                                 | `fixtures/solution-style-overlap` (lib+spec share one source, per spike 001)         | `npx nx test angular-typechecker`           |
| SC2        | BOTH leaves ran: two DISTINCT TS2322s (distinct files) reported; `errorCount === 2`.                                                                                                                                              | integration                                                                                                                 | `fixtures/solution-style`                                                            | `npx nx test angular-typechecker`           |
| SC2        | Boundary skip vs no-guard baseline leak: an out-of-project reference is SKIPPED (its error never reported) AND recorded in `skippedReferences` (`reason: 'out-of-project'`).                                                      | integration                                                                                                                 | `fixtures/solution-style-oop`                                                        | `npx nx test angular-typechecker`           |
| SC3        | Three-way D-03a split: (a) refs + in-project leaf -> WALK (`rootNamesCount > 0`); (b) refs + 0 in-project -> `90001` none-in-project; (c) no refs -> `90001` empty-project; (d) `rootNames > 0` direct-leaf UNCHANGED.            | integration (a,b,c) + integration (d, existing)                                                                             | `solution-style`, `solution-style-oop`, `solution-style-empty`, existing direct leaf | `npx nx test angular-typechecker`           |
| SC3/D-05   | FOLD-and-count: a solution referencing a NONEXISTENT leaf PATH synthesizes ONE counted `90002` Error AND still walks the surviving leaf (survivor's TS2322 also reported); `skippedReferences` has a `reason: 'not-found'` entry. | integration                                                                                                                 | `fixtures/solution-style-broken-ref` (references a real leaf + a nonexistent path)   | `npx nx test angular-typechecker`           |
| SC4        | Spec rewrite: `config-resolution.integration.spec.ts` solution-style block asserts the walk (rootNamesCount>0, two TS2322, no 18003); COR-01 pinning test (`:100-121`) BYTE-UNCHANGED.                                            | integration                                                                                                                 | `fixtures/solution-style`                                                            | `npx nx test angular-typechecker`           |
| SC5        | production->default hashing: a spec-only edit BUSTS the Nx cache (no stale PASS).                                                                                                                                                 | e2e (`*.int.spec.ts`, cache-e2e project) + unit assertion on `nx.json` `targetDefaults`                                     | `e2e/angular-typechecker-cache-e2e` fixtures                                         | `npx nx test angular-typechecker-cache-e2e` |
| cross-leaf | `templateCheckAborted` fires on a TCB-abort in ANY leaf (union pre-filter scan).                                                                                                                                                  | unit (pure `detectTemplateCheckAborted` over a synthesized union) + integration (poison fixture referenced from a solution) | synthesized set (unit) + `fixtures/fault-isolation`-style leaf under a solution      | `npx nx test angular-typechecker`           |
| D-04       | self-reference / duplicate leaf skipped: a solution that references itself (or lists a leaf twice) skips the redundant compile; output unchanged; `skippedReferences` records `reason: 'self-reference'`.                         | integration                                                                                                                 | `fixtures/solution-style-selfref`                                                    | `npx nx test angular-typechecker`           |

### Minimum fixture set

- `fixtures/solution-style` (UPGRADED): app leaf (`error.component.ts` planted TS2322) + NEW
  `tsconfig.spec.json` leaf (`error.component.spec.ts` DISTINCT planted TS2322); solution references
  both. Proves union completeness + both-leaves-ran (SC1/SC2).
- `fixtures/solution-style-overlap` (NEW): lib leaf + spec leaf sharing ONE source file (mirrors
  spike 001's `widget.component.ts`), the shared diagnostic planted once. Proves cross-`Program`
  dedupe collapse (SC2). Use a plain TS error only (no interpolated signal) to avoid NG8117+NG8109.
- `fixtures/solution-style-oop` (NEW): references ONLY an out-of-project leaf. Proves boundary skip
  - `90001` none-in-project + `skippedReferences` (SC2/SC3).
- `fixtures/solution-style-empty` (NEW or reuse): `files: []`, no `references`. Proves the guard
  still fires (`90001` empty-project) -- the references-less branch (SC3).
- `fixtures/solution-style-broken-ref` (NEW): references a real leaf + a NONEXISTENT path. Proves
  D-05 fold-and-count `90002` + survivor still walked (SC3/D-05).
- `fixtures/solution-style-selfref` (NEW): references itself and/or a leaf twice. Proves D-04
  output-neutral dedupe + `skippedReferences` self-reference record.

### Exact assertions proving each SC (integration tier, off `CoreResult`)

- **Union completeness (SC1):** `codes.filter(c => c === 2322).length === 2`; the two reported
  TS2322 have distinct `file.fileName` (`error.component.ts` vs `error.component.spec.ts`);
  `rootNamesCount > 0`.
- **Dedupe collapse (SC2):** for the overlap fixture, the shared-source diagnostic appears exactly
  ONCE in `result.diagnostics` though it is gathered in both the lib and spec programs; assert the
  count of that specific `(fileName, code)` pair `=== 1`; `errorCount`/`warningCount` reflect the
  deduped multiset (no double-count).
- **Both leaves ran (SC2):** distinct-file TS2322 count `=== 2` (as SC1); alternatively assert a
  spec-only symbol's diagnostic is present (reachable only through the spec leaf).
- **Boundary skip vs no-guard leak (SC2):** the out-of-project leaf's planted error code is NOT in
  `codes`; `skippedReferences` contains `{ reason: 'out-of-project', referencePath: <the oop path> }`.
  (No-guard baseline: a control assertion that WITHOUT the guard the oop error WOULD appear -- expressed
  as a comment / the `solution-style` overlap contrast, since the guard is structural and always on.)
- **Three-way split (SC3):** `it.each` over `[solution-style -> walk (rootNamesCount>0, err 2)]`,
  `[oop -> 90001 none-in-project]`, `[empty -> 90001 empty-project]`; the existing direct-leaf spec
  stays green (compile-direct unchanged).
- **D-05 fold-and-count (SC3):** `codes).toContain(90002)`; `codes.filter(c => c === 90002).length === 1`;
  the survivor leaf's TS2322 ALSO in `codes` (survivor walked); `errorCount >= 2`;
  `skippedReferences` has `reason: 'not-found'`. And a NEGATIVE assertion:
  `runTypecheck({ tsConfigPath: brokenRefSolution })` RESOLVES (does NOT throw
  `TypecheckInfrastructureError`) -- proving the per-leaf 500 was reclassified, not rethrown.
- **COR-01 unchanged (SC4):** the DIRECT nonexistent-path pinning test
  (`config-resolution.integration.spec.ts:100-121`) still `rejects.toBeInstanceOf(TypecheckInfrastructureError)`
  -- verify byte-unchanged.
- **production->default hashing (SC5):** cache-e2e proves a spec-only source edit changes the Nx
  input hash (cache miss) so the run re-executes rather than replaying a stale PASS; plus a unit/manifest
  assertion that `nx.json` `targetDefaults["angular-typecheck"].inputs` contains `default` (not
  `production`), retains `outputs: []`, the `{projectRoot}/tsconfig*.json` glob, and `^default`.
- **templateCheckAborted across leaves:** unit -- `detectTemplateCheckAborted([...leafA, ...leafBWithNG3004])`
  returns the abort details; integration -- a solution whose ONE leaf carries the TCB poison sets
  `result.templateCheckAborted` and the adapter `logger.warn` fires (executor unit spec with a mocked
  core returning `templateCheckAborted`).

### Sampling Rate

- **Per task commit:** `npx nx test angular-typechecker` (unit + integration; the walk's fixtures run
  cold-compiler, ~30s timeout each).
- **Per wave merge:** `npx nx run-many -t typecheck-drift test -p angular-typechecker`.
- **Phase gate:** full plugin suite + cache-e2e green before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `packages/angular-typechecker/src/core/walk-references.spec.ts` -- pure unit tests for the walk
      (reference resolution, self-ref dedupe, boundary skip, `90002` synthesis) against hand-built
      `ParsedConfiguration` / stub programs (no cold compiler).
- [ ] `packages/angular-typechecker/src/core/walk-references.integration.spec.ts` -- real-compiler
      walk proofs (SC1/SC2/SC3/D-05) against the new fixtures.
- [ ] Fixtures: `solution-style` upgrade (+ `tsconfig.spec.json`, `error.component.spec.ts`,
      planted TS2322 in `error.component.ts`); NEW `solution-style-overlap`, `solution-style-oop`,
      `solution-style-empty`, `solution-style-broken-ref`, `solution-style-selfref`.
- [ ] `config-resolution.integration.spec.ts` solution-style block rewrite (`:124-152`); COR-01
      block (`:100-121`) BYTE-UNCHANGED.
- [ ] cache-e2e spec + fixture for the production->default hashing proof (SC5); `nx.json`
      `targetDefaults` edit.
- [ ] `detectTemplateCheckAborted` unit coverage over a synthesized union (cross-leaf).
- [ ] Framework install: none -- Vitest/`@nx/vitest` already present.

## Common Pitfalls

### Pitfall 1: Second dedupe layer over the union

**What goes wrong:** re-deduping per-leaf then again at the union double-implements the merge and
misreconciles counts.
**How to avoid:** L-1 -- feed ONE union into the SINGLE existing `finalize`; `ts.sortAndDeduplicateDiagnostics`
handles cross-`Program` dedupe by `file.path` string identity in one place (`run-typecheck.ts:422`).

### Pitfall 2: Filtering per-leaf instead of once over the union

**What goes wrong:** applying the boundary filter / `includeDeps` per leaf changes suppressedCount
semantics and can drop a diagnostic that is in-project relative to the SOLUTION dir but out-of-project
relative to a leaf dir.
**How to avoid:** the walk returns RAW gathered diagnostics; the SINGLE post-union `finalize` filters
once against the SOLUTION-directory basePath with the run-level `includeDeps` (Directive 5).

### Pitfall 3: Co-firing extended diagnostics muddying union/dedupe assertions

**What goes wrong:** an interpolated un-invoked signal co-fires NG8117 + NG8109 (spike 001), inflating
expected counts and making multiset assertions brittle.
**How to avoid:** plant PLAIN TS2322 errors (Directive 4); keep fixture templates literal (no `{{ signal }}`).

### Pitfall 4: D-05 reclassifying the DIRECT-path 500 (COR-01 regression)

**What goes wrong:** applying fold-and-count to the top-level `configInfrastructureFailure` scan
would turn a direct nonexistent-config 500 into a counted `90002`, breaking the COR-01 pinning test.
**How to avoid:** fold-and-count applies ONLY inside the walk's per-leaf resolution; the direct
`run-typecheck.ts:167-178` scan and its test (`:100-121`) stay BYTE-UNCHANGED.

### Pitfall 5: `rootNamesCount` wrong on the walk path

**What goes wrong:** returning a leaf count or `0` instead of the SUM confuses "did anything run".
**How to avoid:** `rootNamesCount` = sum of `parsed.rootNames.length` over WALKED (surviving) leaves
(L-3); a broken/skipped leaf contributes 0 but still records a `skippedReferences` entry / a `90002`.

### Pitfall 6: `createCanonicalizer`/`isUnderDir` are module-private

**What goes wrong:** the walk cannot reuse them without an export, tempting a duplicate canonicalizer
(violates D-01's "reuse tested machinery verbatim").
**How to avoid:** export `createCanonicalizer` + `isUnderDir` from `filter-diagnostics.ts` (they are
private at `:128,184` today) OR extract them into a shared `path-canonicalize.ts` core module; the
walk imports the SAME implementation.

## Assumptions Log

| #   | Claim                                                                                                                                                           | Section                                 | Risk if Wrong                                                                                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | `eslint.config.mjs:16,54` scopes `no-console`/`no-process` to `**/src/core/**` exactly as CONTEXT.md states.                                                    | Project Constraints / line verification | LOW -- the purity rule is independently stated in CLAUDE.md + AGENTS.md + core doc comments; only the precise line numbers are unverified this session. If off, the planner re-reads `eslint.config.mjs`.                      |
| A2  | `ParsedConfiguration.projectReferences` is a flat `readonly ts.ProjectReference[]` with no nested `references` (single-level walk is the data's natural shape). | Directive 3 / D-03                      | LOW -- verified in CONTEXT.md `<specifics>` (perform_compile.d.ts:18) and matches every spike; node_modules was excluded from this session's read-set. If wrong, D-03 (already locked) would need recursion (deferred anyway). |
| A3  | `90002` is unused elsewhere in the codebase (only `90001` exists in the `9000x` family).                                                                        | Directive 1                             | LOW -- based on the read-set; the planner should confirm with a repo-wide `git grep 90002` returning zero matches before adding the constant.                                                                                  |

## Open Questions

1. **Export vs extract for the canonicalizer.**
   - What we know: D-01 mandates reusing `createCanonicalizer`/`isUnderDir` verbatim; they are
     module-private in `filter-diagnostics.ts` today.
   - What's unclear: whether to export them from `filter-diagnostics.ts` or extract into a shared
     `path-canonicalize.ts`.
   - Recommendation: export from `filter-diagnostics.ts` (smallest delta); extract only if a third
     consumer appears. Planner's call.

2. **`finalize` gains a `skippedReferences` param vs threading on the result object.**
   - What we know: `templateCheckAborted` is spread onto the result inside `finalize`
     (`run-typecheck.ts:454`).
   - What's unclear: whether to add an optional `skippedReferences` arg to `finalize` (symmetry) or
     attach it in the walk-branch after `finalize` returns.
   - Recommendation: attach after `finalize` returns in the walk branch -- `finalize` stays focused on
     the diagnostic pipeline; `skippedReferences` is a walk-only concern. Planner's call.

## Environment Availability

Not applicable -- Phase 13 is code/config/fixture-only changes within the existing workspace. No new
external tools, services, or runtimes. `typescript` + `@angular/compiler-cli` peers and Vitest are
already installed; the walk reuses shipped machinery.

## Security Domain

`security_enforcement` posture: the change is a pure in-process type-check engine extension with no
new network, filesystem-write, auth, crypto, or user-input surface. `ng.readConfiguration` /
`performCompilation` operate on developer-controlled tsconfig paths already trusted by the executor.

| ASVS Category                | Applies | Standard Control                                                                                                                                                      |
| ---------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V5 Input Validation          | minimal | Reference paths come from the developer's own `tsconfig.json`; a nonexistent path is handled deterministically (D-05 `90002`, no crash). No untrusted external input. |
| V6 Cryptography              | no      | none                                                                                                                                                                  |
| V2/V3/V4 Auth/Session/Access | no      | not a networked or multi-user surface                                                                                                                                 |

**Threat pattern note:** the only correctness-security concern is a FALSE PASS (a type-checker that
lies). D-05 fold-and-count + D-03b zero-rootNames notice + the boundary guard's `skippedReferences`
record all close the "silent under-check" hazard -- covered by the Validation Architecture assertions.

## Sources

### Primary (HIGH confidence)

- `packages/angular-typechecker/src/core/run-typecheck.ts` -- engine: `CoreOptions`/`CoreResult`
  (`:11-71`), `TemplateCheckAborted` (`:80-87`), `ZERO_ROOT_NAMES_DIAGNOSTIC_CODE = 90001` (`:93`),
  COR-01 direct 500 scan (`:149-178`), D-03a guard/split (`:185-203`),
  `synthesizeZeroRootNamesDiagnostic` (`:329-356`), `finalize` (`:394-456`),
  `detectTemplateCheckAborted` (`:474-489`).
- `packages/angular-typechecker/src/core/filter-diagnostics.ts` -- `createCanonicalizer` (`:128`),
  `isNodeModulesPath` (`:173`), `isUnderDir` (`:184`), file-less keep rule (`:85`).
- `packages/angular-typechecker/src/core/gather-diagnostics.ts` -- `gatherAllDiagnostics` (`:57-91`).
- `packages/angular-typechecker/src/index.ts` -- public barrel; `CoreResult` export (`:15`).
- `packages/angular-typechecker/src/core/config-resolution.integration.spec.ts` -- COR-01 pinning
  test (`:100-121`, BYTE-UNCHANGED) + solution-style block to rewrite (`:124-152`).
- `packages/angular-typechecker/src/executors/angular-typecheck/executor.ts` -- `logger.warn` seam
  (`:49-63`).
- `fixtures/solution-style/{tsconfig.json,tsconfig.app.json,error.component.ts}` -- the substrate to
  upgrade.
- `.planning/spikes/001-reference-walk-aggregation/README.md` -- union-raw -> single-finalize +
  cross-`Program` value-dedupe (L-1/L-2); NG8117+NG8109 co-fire surprise.
- `.planning/spikes/004-d03a-surgical-split/README.md` -- three-way `rootNames===0` split + concrete
  spec rewrite (L-3/L-6).
- `.planning/codebase/TESTING.md` -- test tiers, `*.integration.spec.ts` naming, fixtures convention,
  `NG()` negative encoding, `it.each`, 30000 integration timeout.
- `.planning/phases/13-.../13-CONTEXT.md` -- locked decisions + `<specifics>` code-verified library
  facts (2026-07-01).

### Secondary (MEDIUM confidence)

- CONTEXT.md `<specifics>` re: `ts.sortAndDeduplicateDiagnostics` keying on `file.path` (typescript@6.0.3)
  and `perform_compile.d.ts:18` flat `projectReferences` -- corroborated by spike 001 source-read but
  not re-verified in node_modules this session.

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**

- Directive pins (1-6): HIGH -- all resolved against tracked source read this session; codes/shapes/
  invocation points cited to exact lines.
- Line-reference verification: HIGH for read-set files (all CURRENT); two out-of-read-set refs
  (`eslint.config.mjs`, node_modules) carried as ASSUMED (A1/A2).
- Validation Architecture: HIGH -- mirrors TESTING.md tiers + spike 001/004 assertions.

**Research date:** 2026-07-01
**Valid until:** 2026-07-31 (stable -- engine internals and locked decisions are settled; the only
volatility is if a plan changes the module layout, which does not invalidate the pinned values).
