# Phase 8: Correctness & Completeness Fixes - Research

**Researched:** 2026-06-29
**Domain:** Angular `@angular/compiler-cli@22.0.4` `performCompilation`/`readConfiguration` diagnostic surface; the existing `runTypecheck` engine; Vitest unit + real-compiler integration testing.
**Confidence:** HIGH (every version-sensitive claim verified empirically against the installed `@angular/compiler-cli@22.0.4` + `typescript@6.0.3` in `node_modules`, not training data.)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**COR-01 (D-01..D-03):**
- D-01: Immediately after `ng.readConfiguration(options.tsConfigPath)` (BEFORE the zero-rootNames guard and BEFORE `performCompilation`), scan `parsed.errors` for a diagnostic whose `code === ng.UNKNOWN_ERROR_CODE` (500). If found, re-throw as `TypecheckInfrastructureError` (flattened `messageText`).
- D-02: Detect by CODE (`=== UNKNOWN_ERROR_CODE`) ONLY -- never by `source` or message text -- mirroring the existing post-`performCompilation` 500 check (`run-typecheck.ts:171`). KEEP BOTH checks: the new `parsed.errors` scan AND the existing `result.diagnostics` scan. Defense-in-depth at two distinct stages.
- D-03: ONLY code 500 is infrastructure. Every OTHER `parsed.errors` entry stays folded into `configDiagnostics` and is reported/counted exactly as today. Do NOT broaden the infra classification beyond 500.

**COR-02 (D-04):** Add `program.getTsProgram().getGlobalDiagnostics()` to `gatherAllDiagnostics` (`gather-diagnostics.ts`). Append to the `all` array; placement is irrelevant because `finalize`'s `ts.sortAndDeduplicateDiagnostics` already orders + dedups. (D-05 is a cross-phase note for Phase 10 HARD-01, NOT implemented here.)

**COR-03 (D-06):** In `filter-diagnostics.ts`, extend the file-less guard from `diagnostic.file === undefined` (`:77`) to also treat a present-but-empty `fileName` as file-less: `diagnostic.file === undefined || diagnostic.file.fileName === ''`. File-less diagnostics are always kept.

**COR-04 (D-07..D-10):**
- D-07: CORE owns a pure, framework-agnostic exit-code policy (e.g. `core/exit-codes.ts`: `toExitCode(result | TypecheckInfrastructureError) -> 0 | 1 | 2` -- clean `0`, type errors (`errorCount > 0`) `1`, infra `2`; ngc-parallel). Fully unit-testable with NO process and NO compiler. Exact filename/signature at planner discretion.
- D-08: The Nx executor surfaces an infra failure DISTINCTLY within Nx's `{ success: boolean }` contract: catch `TypecheckInfrastructureError` -> distinct `logger.error` operator message (already present, `executor.ts:53`) + `return { success: false }` (Nx maps to exit 1). The executor does NOT call `process.exit` and does NOT attempt a numeric code.
- D-09: The literal distinct OS exit code (`2` infra / `1` type / `0` clean) is delivered by the DEFERRED standalone CLI surface, which owns its process and consumes the SAME `toExitCode` policy. One definition, three consumers.
- D-10: SC4 / COR-04 are REFRAMED (already amended in ROADMAP.md + REQUIREMENTS.md). The verifier checks the reframed contract (engine classification + pure policy + distinct executor message), NOT a literal executor exit code.

### Claude's Discretion
- Exact filenames / signatures (`core/exit-codes.ts`, `toExitCode` name), the precise placement of `getGlobalDiagnostics()` within the `gatherAllDiagnostics` array, and test-fixture mechanics.
- Whether `toExitCode` takes a discriminated union or two overloads -- planner's call.

### Deferred Ideas (OUT OF SCOPE)
- Standalone CLI surface (owns its process; calls `process.exit(toExitCode(...))`).
- Angular CLI builder (`convertNxExecutor` re-export).
- OBS-01 `totalFilesCount`.
- Phase 9 (RES) / Phase 10 (HARD) items. Cross-phase note: HARD-01 must add `getTsProgram().getGlobalDiagnostics` to the drift getter-set assertion.
- NO `NgtscProgram` migration. NO new executor option or feature surface.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COR-01 | A config-resolution infra crash (`UNKNOWN_ERROR_CODE`/500 in `readConfiguration().errors`) is detected after the config parse and re-thrown as `TypecheckInfrastructureError`, never folded/counted. | VERIFIED: the `readConfiguration` outer catch produces a 500 with `source: 'angular'`, `file: undefined`, `rootNames: []`. Triggers: a nonexistent tsconfig path (ENOENT lstat throw) and circular `extends` (RangeError). The scan MUST precede the zero-rootNames guard (the 500 case has `rootNames: []`). See "COR-01" below. |
| COR-02 | Global/location-less TS semantic diagnostics (e.g. TS2318) are gathered via `program.getTsProgram().getGlobalDiagnostics()`. | VERIFIED: the current 6-getter gatherer misses TS2318 entirely (`getTsSemanticDiagnostics()` returns `[]`); `getGlobalDiagnostics()` returns the TS2318 set, all file-less. `getGlobalDiagnostics` is on the public `ts.Program` interface -> the shim already type-checks the call. See "COR-02" below. |
| COR-03 | A diagnostic whose `file.fileName` is present-but-empty is treated as file-less (kept, never dropped by the boundary filter). | VERIFIED: an empty `fileName` is SUPPRESSED today (`isUnderDir('', base) === false`); the extended guard keeps it. See "COR-03" below. |
| COR-04 | Pure `toExitCode` policy (0 clean / 1 type / 2 infra, ngc-parallel) in core; executor surfaces infra distinctly within `{ success: false }`. | VERIFIED: ngc's own `exitCodeFromResult` is exactly this 0/1/2 mapping. Nx hard-maps `{ success }` to 0/1 -- so the literal `2` lives only in the deferred CLI. See "COR-04" below. |
</phase_requirements>

## Summary

This phase hardens four narrow holes in the *existing* `runTypecheck` engine. The architecture is locked (CONTEXT.md D-01..D-10); this research nails the exact APIs, values, fixtures, and the failing-then-passing test design at the implementation level.

All four fixes were verified empirically against the installed `@angular/compiler-cli@22.0.4` bundle (`node_modules/@angular/compiler-cli/bundles/chunk-6ZBSJK4S.js` + `index.js`) and `typescript@6.0.3` -- not from training memory. The four changes are surgical: COR-01 adds an early `parsed.errors` 500 scan in `run-typecheck.ts` (before the zero-rootNames guard); COR-02 adds one line to `gather-diagnostics.ts`; COR-03 extends one boolean in `filter-diagnostics.ts`; COR-04 adds a new pure `core/exit-codes.ts` consumed by the (mostly-already-correct) executor.

**Primary recommendation:** Implement each fix exactly as the locked decisions specify, each gated by a dedicated failing-then-passing test. Use the *nonexistent tsconfig path* as the COR-01 500 fixture (deterministic and cross-OS; "broken extends" in the CONTEXT prose is imprecise -- a *nonexistent* extends target is code 5012, NOT 500). Use `noLib: true` + `types: []` as the COR-02 TS2318 fixture. Use a hand-built `{ file: { fileName: '' } }` literal for COR-03 (a unit-tier synthesized diagnostic; the real compiler rarely emits one). For COR-04, mirror `evaluate-result.ts` as the structural template for the new pure policy, and add one executor-spec assertion that the infra catch returns `{ success: false }` with the distinct `logger.error`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Config-parse 500 detection (COR-01) | CORE (`run-typecheck.ts`) | -- | Engine orchestration; the `TypecheckInfrastructureError` boundary is a core concept. |
| Global TS diagnostic gathering (COR-02) | CORE (`gather-diagnostics.ts`) | -- | All diagnostic gathering lives in the all-getter gatherer; the `api.Program` is a core input. |
| Empty-`fileName` boundary classification (COR-03) | CORE (`filter-diagnostics.ts`) | -- | Pure boundary-filter policy; no framework or process. |
| Exit-code policy `toExitCode` (COR-04) | CORE (new `core/exit-codes.ts`) | Nx executor (consumer), deferred CLI (consumer) | Single source of truth in pure core; adapters consume it. ESLint bans `process.exit` in `core/**` -> policy must stay pure. |
| Distinct infra messaging within `{ success }` (COR-04 D-08) | Nx executor adapter (`executor.ts`) | -- | The adapter owns I/O + the `{ success }` contract; Nx maps to 0/1. |

## Standard Stack

No new packages. This phase edits existing source and adds one new core file + new spec files. The locked stack (verified installed) governs:

| Library | Version (installed, verified) | Purpose | Why Standard |
|---------|------------------------------|---------|--------------|
| `@angular/compiler-cli` | `22.0.4` | The type-check engine (peer, ESM, `await import()`). Provides `readConfiguration`, `performCompilation`, `UNKNOWN_ERROR_CODE`, `exitCodeFromResult`. | [VERIFIED: node_modules `package.json` `version: 22.0.4`] Locked stable target; never `next`/rc. |
| `typescript` | `6.0.3` | `ts.Diagnostic`, `ts.Program.getGlobalDiagnostics()`, `ts.flattenDiagnosticMessageText`, `ts.DiagnosticCategory`, `ts.sortAndDeduplicateDiagnostics`. | [VERIFIED: `ts.version === '6.0.3'` printed by probe] Locked peer `>=6.0.0 <6.1.0`. |
| `vitest` | `4.x` | Test runner (`@nx/vitest:test`). | [CITED: PROJECT.md / project.json `test` target] Existing suite uses `vi.hoisted`, `vi.mock`, `describe.each`. |

**Installation:** none. No `npm install` for this phase.

## Package Legitimacy Audit

Not applicable -- this phase installs **no external packages**. All edits are to existing source plus new spec/fixture files using already-installed, already-audited dependencies (`@angular/compiler-cli@22.0.4`, `typescript@6.0.3`, `vitest@4.x`). slopcheck gate intentionally skipped (no new dependencies to vet).

## Architecture Patterns

### System Architecture Diagram (the four edit points in the existing flow)

```
runTypecheck(options)                                  [core/run-typecheck.ts]
  |
  v
  loadCompilerCli() -> ng ; loadTypescript() -> ts
  |
  v
  parsed = ng.readConfiguration(options.tsConfigPath)
  |
  +--[ COR-01 NEW SCAN ]---------------------------------------------+
  |   const infra = parsed.errors.find(d => d.code === ng.UNKNOWN_ERROR_CODE)
  |   if (infra) throw new TypecheckInfrastructureError(             |
  |       ts.flattenDiagnosticMessageText(infra.messageText, '\n'))  |
  |   <-- MUST come BEFORE the zero-rootNames guard (the 500 case    |
  |       has rootNames: [], so the guard would otherwise swallow it)|
  +------------------------------------------------------------------+
  |
  v
  configDiagnostics = [...parsed.errors]    (non-500 errors stay folded, D-03)
  |
  v
  if (parsed.rootNames.length === 0) -> zero-rootNames guard -> finalize(...)
  |
  v
  result = ng.performCompilation({ ..., gatherDiagnostics: gatherAllDiagnostics })
  |                                                  |
  |                                                  v
  |                        gatherAllDiagnostics(program)   [core/gather-diagnostics.ts]
  |                          all.push(...getTsOptionDiagnostics())
  |                          all.push(...getNgOptionDiagnostics())
  |                          all.push(...getTsSyntacticDiagnostics())
  |                          all.push(...getTsSemanticDiagnostics())
  |                          all.push(...getNgStructuralDiagnostics())
  |                          all.push(...getNgSemanticDiagnostics())
  |                  [ COR-02 NEW ] all.push(...program.getTsProgram().getGlobalDiagnostics())
  |
  v
  existing 500 scan on result.diagnostics -> throw TypecheckInfrastructureError  (KEEP, D-02)
  |
  v
  finalize(... filter ...)                                [core/run-typecheck.ts]
       |
       v
     filterDiagnostics(diagnostics, opts)                 [core/filter-diagnostics.ts]
       for each diagnostic:
   [ COR-03 ] if (diagnostic.file === undefined
                  || diagnostic.file.fileName === '') -> kept (file-less)
       ... else classify by basePath/node_modules ...
       |
       v
     ts.sortAndDeduplicateDiagnostics(kept)  -> CoreResult { diagnostics, errorCount, ... }

----------------------------------------------------------------------
Nx executor adapter                          [executors/angular-typecheck/executor.ts]
  try { result = await runTypecheck(coreOptions); ... return evaluateResult(result, ...) }
  catch (error) {
    if (error instanceof TypecheckInfrastructureError) {
        logger.error('angular-typecheck: ... infrastructure error ...')   (D-08, already present)
        return { success: false }                                         (Nx maps -> exit 1)
    }
    throw error
  }

NEW pure policy                                            [core/exit-codes.ts]
  toExitCode(input): 0 | 1 | 2
    input is TypecheckInfrastructureError -> 2   (infra)
    input.errorCount > 0                   -> 1   (type errors)
    otherwise                              -> 0   (clean)
  Consumers: (now) the executor for classification/tests; (deferred) the standalone CLI for process.exit.
```

### Recommended Project Structure (new/edited files)

```
packages/angular-typechecker/src/
  core/
    run-typecheck.ts          # EDIT (COR-01 early scan)
    gather-diagnostics.ts     # EDIT (COR-02 one push)
    filter-diagnostics.ts     # EDIT (COR-03 one boolean)
    exit-codes.ts             # NEW  (COR-04 pure toExitCode)
    exit-codes.spec.ts        # NEW  (COR-04 unit cases)
    config-resolution-500.integration.spec.ts   # NEW or extend config-resolution.integration.spec.ts (COR-01)
    global-diagnostics.integration.spec.ts       # NEW or extend run-typecheck.integration.spec.ts (COR-02)
    filter-diagnostics.spec.ts # EDIT (COR-03 empty-fileName case)
  executors/angular-typecheck/
    executor.spec.ts          # EDIT (COR-04 D-08 assert; mostly already present)
fixtures/
  config-broken/              # extend: add a fixture that triggers a 500 (or use a nonexistent path)
  global-diagnostics/         # NEW (COR-02 TS2318 fixture: noLib + types:[])
```

### Pattern 1: COR-01 -- the early `parsed.errors` 500 scan (mirror the existing post-`performCompilation` scan)

**What:** Insert the scan right after `const parsed = ng.readConfiguration(...)` (run-typecheck.ts:105) and BEFORE `const configDiagnostics = [...parsed.errors]` / the zero-rootNames guard. It is a structural twin of the existing `result.diagnostics` scan at `run-typecheck.ts:171-179`.

**When to use:** Always, on every run, before any other config handling.

**Example (the existing template at run-typecheck.ts:171-179, to be mirrored for `parsed.errors`):**
```typescript
// EXISTING (post-performCompilation) -- KEEP unchanged (D-02 defense-in-depth):
const infrastructureFailure = result.diagnostics.find(
  (diagnostic) => diagnostic.code === ng.UNKNOWN_ERROR_CODE,
);
if (infrastructureFailure !== undefined) {
  throw new TypecheckInfrastructureError(
    ts.flattenDiagnosticMessageText(infrastructureFailure.messageText, '\n'),
  );
}

// NEW (COR-01, placed right after readConfiguration, before the guard):
const configInfrastructureFailure = parsed.errors.find(
  (diagnostic) => diagnostic.code === ng.UNKNOWN_ERROR_CODE,
);
if (configInfrastructureFailure !== undefined) {
  throw new TypecheckInfrastructureError(
    ts.flattenDiagnosticMessageText(
      configInfrastructureFailure.messageText,
      '\n',
    ),
  );
}
```
Note: `ts` is already loaded at this point (`run-typecheck.ts:103`), so `ts.flattenDiagnosticMessageText` is available before the guard. Detect by `code` only (D-02) -- the config-path 500 also carries `source: 'angular'` but code-only is sufficient and matches the existing scan.

### Pattern 2: COR-02 -- one append in `gatherAllDiagnostics`

**What:** Add `all.push(...program.getTsProgram().getGlobalDiagnostics());` to the gatherer (`gather-diagnostics.ts:27`). Placement is irrelevant (D-04: `finalize`'s `sortAndDeduplicateDiagnostics` orders + dedups). The `Program` shim already declares `getTsProgram(): TsProgram` where `TsProgram = ts.Program & {...}`, and `getGlobalDiagnostics()` is on the public `ts.Program` interface -- so the call type-checks under `module: nodenext` with **no shim edit**.

**When to use:** Always, as part of the unconditional all-getter.

**Example:**
```typescript
// Source: VERIFIED against @angular/compiler-cli@22.0.4 + typescript@6.0.3
export function gatherAllDiagnostics(program: Program): readonly ts.Diagnostic[] {
  const all: ts.Diagnostic[] = [];
  all.push(...program.getTsOptionDiagnostics());
  all.push(...program.getNgOptionDiagnostics());
  all.push(...program.getTsSyntacticDiagnostics());
  all.push(...program.getTsSemanticDiagnostics());
  all.push(...program.getNgStructuralDiagnostics());
  all.push(...program.getNgSemanticDiagnostics());
  all.push(...program.getTsProgram().getGlobalDiagnostics()); // COR-02
  return all;
}
```

### Pattern 3: COR-03 -- extend the file-less guard

**What:** Change `filter-diagnostics.ts:77` from `if (diagnostic.file === undefined)` to `if (diagnostic.file === undefined || diagnostic.file.fileName === '')`. Update the JSDoc/comment so a maintainer knows an empty `fileName` is a synthesized-diagnostic edge.

**When to use:** In the per-diagnostic loop, before classification.

**Example:**
```typescript
// Source: VERIFIED empirically (probe-cor03d): isUnderDir('', base) === false
for (const diagnostic of diagnostics) {
  // D-03 + COR-03/D-06: NEVER filter a file-less diagnostic -- file === undefined
  // OR a present-but-empty fileName (a synthesized diagnostic). Both have no path
  // to classify; dropping one is a false PASS.
  if (diagnostic.file === undefined || diagnostic.file.fileName === '') {
    kept.push(diagnostic);
    continue;
  }
  // ... existing classification ...
}
```

### Pattern 4: COR-04 -- pure `toExitCode` policy (mirror `evaluate-result.ts`)

**What:** New `core/exit-codes.ts` exporting a pure function `toExitCode`. It accepts either a `CoreResult` (read `errorCount`) or a `TypecheckInfrastructureError`, and returns `0 | 1 | 2`. No `process`, no compiler, no `@nx/*` (ESLint-enforced). Use a `Pick<CoreResult, 'errorCount'>` input like `evaluate-result.ts` does, plus the typed-error branch.

**When to use:** The executor consumes it for classification/messaging now (D-08); the deferred standalone CLI calls `process.exit(toExitCode(...))` later (D-09).

**Example (recommended signature -- discriminated union; planner may choose overloads per D-discretion):**
```typescript
// Source: ngc exitCodeFromResult parity, VERIFIED @ chunk-6ZBSJK4S.js:549-556
import type { CoreResult } from './run-typecheck';
import { TypecheckInfrastructureError } from './run-typecheck';

/**
 * Pure, framework-agnostic exit-code policy (COR-04 / D-07). Single source of
 * truth for all surfaces: 0 = clean, 1 = type errors, 2 = infrastructure failure
 * (ngc-parallel: see @angular/compiler-cli exitCodeFromResult). NO process side
 * effects -- the standalone CLI (deferred) owns process.exit(toExitCode(...));
 * the Nx executor maps {success} to 0/1 and uses this only for classification.
 */
export function toExitCode(
  input: Pick<CoreResult, 'errorCount'> | TypecheckInfrastructureError,
): 0 | 1 | 2 {
  if (input instanceof TypecheckInfrastructureError) {
    return 2;
  }
  if (input.errorCount > 0) {
    return 1;
  }
  return 0;
}
```
Note on the `import { TypecheckInfrastructureError }` from `run-typecheck`: it is a value import (needed for `instanceof`), and `run-typecheck.ts` is in `core/` so no boundary lint is triggered. The reverse (run-typecheck importing exit-codes) is NOT needed -- `toExitCode` is a leaf consumed by adapters, keeping `run-typecheck` unaware of it.

### Anti-Patterns to Avoid
- **Detecting the 500 by `source === 'angular'` or message text** -- D-02 forbids it. The `performCompilation` catch does NOT set `source` (verified `chunk-6ZBSJK4S.js:587-598`); the `readConfiguration` catch DOES. Code-only is the uniform, correct predicate for both stages.
- **Placing the COR-01 scan after the zero-rootNames guard** -- the 500 case has `rootNames: []` (verified), so a late scan would be unreachable: the guard returns first and the 500 is folded + counted as a type error (the current bug).
- **Broadening infra classification beyond code 500** -- D-03. Genuine config diagnostics (5012 missing-extends, 1005 malformed-JSON, 18003 no-inputs) stay folded.
- **Editing `compiler-cli-types.ts` for COR-02** -- unnecessary. `getGlobalDiagnostics` is already reachable via the declared `TsProgram = ts.Program & {...}`. (Adding it to the drift assertion is Phase 10 HARD-01, D-05.)
- **Putting `process.exit` or a numeric OS code in the executor** -- D-08. Nx hard-maps `{ success }` to 0/1; `process.exit` from an executor is hostile to batch/run-many.
- **Calling `getGlobalDiagnostics()` on the Angular `Program` directly** -- it lives on the underlying `ts.Program`, reached via `getTsProgram()`. (The Angular `api.Program` does not expose `getGlobalDiagnostics`.)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Global TS diagnostics (TS2318 et al.) | A custom global-type scan | `program.getTsProgram().getGlobalDiagnostics()` | TypeScript already buckets these separately from per-file semantic diagnostics; `@angular/build` calls it explicitly. Verified the per-file path returns `[]` for TS2318. |
| Flattening a diagnostic chain to a string | Manual `messageText` recursion | `ts.flattenDiagnosticMessageText(messageText, '\n')` | Already used at `run-typecheck.ts:177`; handles `DiagnosticMessageChain`. |
| Sort/dedup of overlapping diagnostics | Manual de-dup of global vs per-file overlap | `ts.sortAndDeduplicateDiagnostics` (already in `finalize`) | D-04: makes COR-02 placement irrelevant and any overlap safe. |
| The 500 sentinel value | Hardcoding `500` in new code | `ng.UNKNOWN_ERROR_CODE` (the loaded namespace) | Matches the existing scan; the shim types it as literal `500` and the real export equals `500` (verified). |
| ngc 0/1/2 exit mapping rationale | Inventing a new scheme | Mirror ngc `exitCodeFromResult` (0/1/2) | Verified source; gives CI/agents a familiar contract; the standalone CLI inherits it verbatim. |

**Key insight:** Every value and API in this phase already exists in the loaded namespace or the existing engine. The fixes are about *reaching* diagnostics the engine currently drops and *classifying* a crash it currently mis-counts -- not about new machinery.

## Runtime State Inventory

> Not a rename/refactor/migration phase. Omitted.

## Common Pitfalls

### Pitfall 1: "Broken extends" does NOT reliably produce a 500
**What goes wrong:** Following the CONTEXT prose literally and writing a fixture with a *nonexistent* `extends` target, expecting a 500.
**Why it happens:** A nonexistent extends target surfaces as TS **5012** ("Cannot read file ...") + TS **18003** -- genuine config diagnostics that stay folded (D-03), NOT a 500. The COR-01 test would then never reach the throw and would silently "pass" the wrong way.
**How to avoid:** Use a trigger that makes `readConfiguration`'s outer catch fire (a real throw): a **nonexistent tsconfig path** (ENOENT from `host.lstat` in `calcProjectFileAndBasePath`) -- the cleanest, deterministic, cross-OS option -- or **circular `extends`** (RangeError "Maximum call stack size exceeded" from `readAngularCompilerOptions`). Both produce a 500 with `source: 'angular'`, `file: undefined`, `rootNames: []`. [VERIFIED: probe-cor01.mjs]
**Warning signs:** A COR-01 fixture whose `parsed.errors` codes are `[5012, 18003]` or `[1005]` instead of `[500]`.

### Pitfall 2: The 500-in-`parsed.errors` case also has `rootNames: []`
**What goes wrong:** Placing the scan after the zero-rootNames guard, so the guard returns a synthesized "no input files" diagnostic + the folded 500 (counted as a type error) and the run never throws.
**Why it happens:** Both the nonexistent-path and circular-extends 500 paths return `rootNames: []`. The guard at `run-typecheck.ts:117` fires on `parsed.rootNames.length === 0`.
**How to avoid:** D-01 mandates the scan BEFORE the guard. [VERIFIED: probe-cor01-order.mjs shows today's path returns `errorCount: 2` instead of throwing.]
**Warning signs:** A COR-01 integration test that asserts `errorCount` / `rootNamesCount` instead of `rejects.toBeInstanceOf(TypecheckInfrastructureError)`.

### Pitfall 3: TS2318 is invisible to the current gatherer -- the "failing" assertion must target the engine, not `getGlobalDiagnostics` directly
**What goes wrong:** Writing a COR-02 test that calls `getGlobalDiagnostics()` directly (which always passes) instead of asserting the full `runTypecheck`/`gatherAllDiagnostics` output contains TS2318.
**Why it happens:** `getGlobalDiagnostics()` returns TS2318 regardless of the engine change; the *failing-then-passing* property only holds when you assert through the gatherer.
**How to avoid:** Assert `result.diagnostics.map(d => d.code).includes(2318)` (or via `gatherAllDiagnostics` over a real program). Pre-fix this is empty; post-fix it contains 2318. [VERIFIED: probe-cor02.mjs -- gatherer codes `[]` before, global codes `[2318 x10]` after.]
**Warning signs:** A unit test that mocks `getTsProgram().getGlobalDiagnostics` to return `[2318]` AND mocks the other six getters -- that proves the wiring (good for `gather-diagnostics.spec.ts`) but the *real-compiler* proof (the failing-then-passing one) should run a real fixture.

### Pitfall 4: TS2318 diagnostics are file-less -- they exercise COR-03's "always keep" path
**What goes wrong:** A COR-02 integration test that filters to in-project files would drop the TS2318s (they have `file: undefined`).
**Why it happens:** `getGlobalDiagnostics()` diagnostics are file-less (verified). The boundary filter keeps file-less diagnostics (D-03), so they survive -- but only because of the file-less rule.
**How to avoid:** Assert the codes are present in `result.diagnostics` (they are kept as file-less). This is a nice cross-check that COR-02 and COR-03 cooperate.
**Warning signs:** `suppressedCount` unexpectedly counting the globals (it must not -- they are file-less, never suppressed).

### Pitfall 5: NG codes are negative -- assert TS codes raw, NG codes via `NG()`
**What goes wrong:** Asserting a bare `8109` for an NG diagnostic.
**Why it happens:** Angular encodes extended codes negative: `ngErrorCode(8109) = -998109`. The existing specs define `const NG = (code) => -990000 - code`.
**How to avoid:** For COR-02 the relevant code is the raw TypeScript `2318` (a TS global diagnostic, positive). Use raw `2318`. Only reach for `NG()` if a fixture also asserts an NG code. [VERIFIED: existing specs use this idiom; COR-02's TS2318 is raw.]
**Warning signs:** N/A for COR-02 specifically (2318 is a TS code), but watch it in any mixed fixture.

### Pitfall 6: An empty `fileName` is a synthesized-diagnostic edge -- prefer the unit tier
**What goes wrong:** Trying to make the *real* Angular compiler emit a diagnostic with `file: { fileName: '' }` for a real-compiler COR-03 fixture.
**Why it happens:** A present-but-empty `fileName` is "unusual but not impossible for synthesized diagnostics" (SHIM-HARDENING #4) -- the real compiler practically never produces one; engineering a fixture for it is brittle.
**How to avoid:** Test COR-03 at the **unit tier** in `filter-diagnostics.spec.ts` with a hand-built literal `diag('')` (the existing `diag(fileName)` helper already supports a string). Assert it is kept (`result.kept` length 1, `suppressedCount` 0). [VERIFIED: probe-cor03d -- current guard SUPPRESSES `''`, proposed guard KEEPS it.]
**Warning signs:** A flaky real-compiler test that depends on a specific Angular internal emitting an empty `fileName`.

## Code Examples

### COR-01 unit test (mirror infra-failure.spec.ts; stub `readConfiguration` to return a 500 in `errors`)
```typescript
// Source: pattern from infra-failure.spec.ts (the single justified compiler-loader mock)
// Stub loadCompilerCli so readConfiguration returns parsed.errors with a code-500
// diagnostic AND rootNames: [] (the real shape). Assert runTypecheck REJECTS with
// TypecheckInfrastructureError -- proving the scan fires BEFORE the zero-rootNames guard.
readConfiguration: vi.fn(() => ({
  project: '',
  options: {},
  rootNames: [],                       // the real 500 shape has rootNames: []
  errors: [
    {
      category: 1, code: 500, source: 'angular',
      file: undefined, start: undefined, length: undefined,
      messageText: "Error: ENOENT: no such file or directory, lstat '...'",
    },
  ],
  emitFlags: 0,
})),
// ... then: await expect(runTypecheck({ tsConfigPath: '/virtual/tsconfig.json' }))
//             .rejects.toBeInstanceOf(TypecheckInfrastructureError);
// Contrast case: a code-5012 (or 18003) entry must NOT throw and must be counted/returned (D-03).
```

### COR-01 integration test (real compiler; nonexistent path)
```typescript
// Source: config-resolution.integration.spec.ts idiom (workspaceRoot join + runTypecheck)
it('re-throws a TypecheckInfrastructureError for a config-resolution 500 (nonexistent tsconfig)', async () => {
  const { TypecheckInfrastructureError } = await import('./run-typecheck');
  const missing = join(workspaceRoot, 'fixtures', 'config-broken', 'tsconfig.does-not-exist.json');
  await expect(runTypecheck({ tsConfigPath: missing }))
    .rejects.toBeInstanceOf(TypecheckInfrastructureError);
});
// Cross-check (D-03 boundary): the EXISTING malformed fixture (extends a nonexistent target ->
// code 5012) must still RESOLVE with errorCount >= 1 and NOT throw -- already asserted in
// config-resolution.integration.spec.ts (do not regress it).
```

### COR-02 fixture (TS2318 via noLib) + integration assertion
```jsonc
// fixtures/global-diagnostics/tsconfig.json  (NEW)
{
  "compilerOptions": { "noLib": true, "types": [], "skipLibCheck": false, "noEmit": true },
  "files": ["global-error.ts"]
}
```
```typescript
// fixtures/global-diagnostics/global-error.ts  (NEW)
export const x: number = 1;
export function f() { return [1, 2, 3]; } // uses Array -> TS2318 "Cannot find global type 'Array'"
```
```typescript
// integration assertion (run-typecheck.integration.spec.ts or a new spec)
it('COR-02: surfaces a global TS2318 the per-file path never emits', async () => {
  const result = await runTypecheck({
    tsConfigPath: join(workspaceRoot, 'fixtures', 'global-diagnostics', 'tsconfig.json'),
  });
  expect(result.diagnostics.map((d) => d.code)).toContain(2318);
});
// VERIFIED probe: the 6-getter gatherer returns [] for this fixture; getGlobalDiagnostics
// returns 10x TS2318 (all file-less), so they are kept by the boundary filter.
```

### COR-02 wiring unit test (extend gather-diagnostics.spec.ts)
```typescript
// Add a getTsProgram stub returning getGlobalDiagnostics; assert the gatherer calls it
// and the result includes the global code. Order is irrelevant (sortAndDeduplicate later).
const program = {
  getTsOptionDiagnostics: () => [], getNgOptionDiagnostics: () => [],
  getTsSyntacticDiagnostics: () => [], getTsSemanticDiagnostics: () => [],
  getNgStructuralDiagnostics: () => [], getNgSemanticDiagnostics: () => [],
  getTsProgram: () => ({ getGlobalDiagnostics: () => [{ code: 2318 } as ts.Diagnostic] }),
} as unknown as Program;
expect(gatherAllDiagnostics(program).map((d) => d.code)).toContain(2318);
```

### COR-03 unit case (extend filter-diagnostics.spec.ts)
```typescript
it('keeps a diagnostic whose file.fileName is present-but-empty (COR-03/D-06)', () => {
  const result = filterDiagnostics([diag('')], { ...base, includeDeps: false });
  expect(result.kept).toHaveLength(1);
  expect(result.suppressedCount).toBe(0);
});
// VERIFIED: before the fix this asserts kept.length === 0 (SUPPRESSED) -- the failing case.
```

### COR-04 unit cases (new exit-codes.spec.ts) + executor D-08 assertion
```typescript
// exit-codes.spec.ts
import { toExitCode } from './exit-codes';
import { TypecheckInfrastructureError } from './run-typecheck';
it('returns 2 for an infrastructure error', () =>
  expect(toExitCode(new TypecheckInfrastructureError('boom'))).toBe(2));
it('returns 1 when errorCount > 0', () =>
  expect(toExitCode({ errorCount: 3 })).toBe(1));
it('returns 0 when clean', () =>
  expect(toExitCode({ errorCount: 0 })).toBe(0));

// executor.spec.ts already asserts the D-08 path (line 141-154):
//   "catches a TypecheckInfrastructureError -> logger.error + { success: false }".
// COR-04 D-08 is largely SATISFIED by existing code/tests; verify the test still holds and
// (optional) assert the logger.error message contains "infrastructure error" to lock the
// DISTINCT operator message vs a plain type-error verdict.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Scan only `result.diagnostics` for the 500 | Also scan `parsed.errors` (COR-01) | This phase | Config-resolution crashes are classified as infra, not type errors. |
| 6-getter gatherer (misses global TS diagnostics) | 7th call: `getTsProgram().getGlobalDiagnostics()` (COR-02) | This phase | TS2318-class errors no longer silently dropped. |
| File-less guard = `file === undefined` only | Also `file.fileName === ''` (COR-03) | This phase | Empty-`fileName` synthesized diagnostics are reported, not suppressed. |
| Infra-vs-type implied only by the executor catch | Explicit pure `toExitCode` (0/1/2) policy in core (COR-04) | This phase | Single source of truth; deferred CLI drops in cleanly with the literal OS code. |

**Deprecated/outdated:**
- The CONTEXT/REQUIREMENTS "broken `extends`" phrasing for the COR-01 fixture is imprecise -- a *nonexistent extends target* is code 5012, not 500. Use a nonexistent tsconfig path (or circular extends) to trigger the 500. (This is a fixture-design clarification, not a decision change.)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The cleanest cross-OS COR-01 500 fixture is a *nonexistent tsconfig path*; circular `extends` is the alternative. | Pitfall 1, Code Examples | LOW -- both verified to produce a 500 on this machine; planner may pick either. A circular-extends fixture is committed-file-based (no runtime path assembly) and may be preferred for determinism. |
| A2 | A unit-tier `diag('')` literal is the right tier for COR-03 (real compiler rarely emits empty `fileName`). | Pitfall 6 | LOW -- if a real-compiler trigger is later found, an integration test can be added; the unit test still proves the guard. |
| A3 | `toExitCode` taking `Pick<CoreResult,'errorCount'> | TypecheckInfrastructureError` is the cleanest signature. | Pattern 4 | LOW -- D explicitly leaves union-vs-overloads to the planner; both satisfy the contract. |

**Note:** No `[ASSUMED]` package or version claims -- every API, value, and behavior was verified against the installed `@angular/compiler-cli@22.0.4` / `typescript@6.0.3`.

## Open Questions

1. **COR-01 fixture form: nonexistent path vs. committed circular-extends files.**
   - What we know: both produce a code-500 in `parsed.errors` (verified). A nonexistent path needs no committed fixture file (just an absolute path that does not exist); circular extends needs two committed `tsconfig` files.
   - What's unclear: which the team prefers for repo hygiene / determinism. The existing `config-broken/` fixture dir is the natural home for a committed variant.
   - Recommendation: prefer the **nonexistent-path** form for the integration test (zero new fixture files, deterministic ENOENT on every OS), and cover the contrast (5012 stays folded) by keeping the existing malformed-fixture assertions. Add a circular-extends committed fixture only if a file-based trigger is desired.

2. **Whether COR-04 D-08 needs any executor code change at all.**
   - What we know: `executor.ts:51-58` already catches `TypecheckInfrastructureError`, logs a distinct `logger.error`, and returns `{ success: false }`. `executor.spec.ts:141-154` already asserts it.
   - What's unclear: whether the planner wants the executor to *call* `toExitCode` (it does not need to -- Nx maps `{ success }` to 0/1) or just keep the existing distinct message.
   - Recommendation: D-08 is mostly satisfied; the only *new* COR-04 artifact is `core/exit-codes.ts` + its spec. Keep the executor as-is (optionally tighten the spec to assert the message contains "infrastructure error"). Do NOT wire `toExitCode` into the executor's return -- that would contradict D-08.

## Environment Availability

> All dependencies are already installed and verified. No external services.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@angular/compiler-cli` | COR-01/02 (engine) | yes | 22.0.4 | -- |
| `typescript` | all (diagnostics, globals) | yes | 6.0.3 | -- |
| `vitest` (`@nx/vitest:test`) | all tests | yes | 4.x | -- |
| Node | runtime | yes | 22/24/26 (probes ran on 24.18.0) | -- |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

> `nyquist_validation: true` (config.json) -- section REQUIRED.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x via `@nx/vitest:test` (jsdom environment, `globals: true`) |
| Config file | `packages/angular-typechecker/vitest.config.ts` |
| Quick run command | `npx nx test angular-typechecker -- --reporter=dot` (or `rtk vitest run` scoped) |
| Full suite command | `npx nx test angular-typechecker` (Nx target `test`, `dependsOn: ["build"]`) |

Note: spec include glob is `{src,tests}/**/*.{test,spec}.{...}`; integration specs are co-located in `src/core/*.integration.spec.ts` and read fixtures from the workspace-root `fixtures/` dir via the `packageRoot/workspaceRoot` join idiom.

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COR-01 | A code-500 in `parsed.errors` re-throws `TypecheckInfrastructureError` (scan before the guard) | unit (mock `compiler-loader`) | `npx nx test angular-typechecker -- infra-failure` (extend) | EXTEND `infra-failure.spec.ts` |
| COR-01 | Nonexistent tsconfig path re-throws; a 5012/18003 malformed config stays folded (D-03 boundary) | integration (real compiler) | `npx nx test angular-typechecker -- config-resolution` (extend) | EXTEND `config-resolution.integration.spec.ts` (or NEW `config-resolution-500.integration.spec.ts`) |
| COR-02 | `gatherAllDiagnostics` calls `getTsProgram().getGlobalDiagnostics()` and includes its codes | unit | `npx nx test angular-typechecker -- gather-diagnostics` (extend) | EXTEND `gather-diagnostics.spec.ts` |
| COR-02 | A real fixture's TS2318 (file-less) appears in `result.diagnostics`; pre-fix it is absent | integration (real compiler) | `npx nx test angular-typechecker -- global-diagnostics` (new) or `run-typecheck.integration` | NEW fixture `fixtures/global-diagnostics/` + assertion |
| COR-03 | A present-but-empty `fileName` diagnostic is kept (not suppressed) | unit (pure) | `npx nx test angular-typechecker -- filter-diagnostics` (extend) | EXTEND `filter-diagnostics.spec.ts` |
| COR-04 | `toExitCode` returns 2 (infra) / 1 (errorCount>0) / 0 (clean) | unit (pure) | `npx nx test angular-typechecker -- exit-codes` (new) | NEW `exit-codes.spec.ts` |
| COR-04 | Executor catches `TypecheckInfrastructureError` -> `{ success: false }` + distinct `logger.error` | unit (mock seams) | `npx nx test angular-typechecker -- executor` | EXISTS `executor.spec.ts:141-154` (verify; optionally tighten message assertion) |

### Sampling Rate
- **Per task commit:** the targeted spec for the edited fix, e.g. `npx nx test angular-typechecker -- gather-diagnostics` (or the `rtk vitest run <file>` equivalent). Each COR fix has a dedicated failing-then-passing spec; run that first.
- **Per wave merge:** full `npx nx test angular-typechecker` (the `test` target builds first, so it also exercises the `module: nodenext` GATE A compile -- catching any type-level regression in the shim usage from COR-02).
- **Phase gate:** full suite green + `npx nx lint angular-typechecker` green (the `core/**` ESLint boundary must still pass -- `exit-codes.ts` must not import `@nx/*` / `process.exit`) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `fixtures/global-diagnostics/tsconfig.json` + `global-error.ts` -- COR-02 real-compiler TS2318 fixture (NEW).
- [ ] `packages/angular-typechecker/src/core/exit-codes.spec.ts` -- COR-04 unit cases (NEW; mirror `evaluate-result.spec.ts`).
- [ ] (optional) `fixtures/config-broken/` committed circular-extends pair -- only if a file-based COR-01 500 trigger is chosen over the nonexistent-path form.
- Framework install: none -- Vitest infrastructure already present and exercised by 20 existing spec files.

*All other COR tests extend existing spec files; no new test framework or config needed.*

## Security Domain

> No explicit `security_enforcement` key in config.json. This phase adds no new input surface, no new dependency, no I/O, no network, no auth, no crypto. It hardens internal diagnostic classification only.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | no | -- |
| V5 Input Validation | marginal | The only "input" is the tsconfig path the consumer already controls (Nx target wiring). COR-01 hardens crash handling so a malformed config cannot masquerade as a clean type-check (a *correctness* guarantee, not an injection surface). `evaluate-result.ts` already validates `maxWarnings` defensively. |
| V6 Cryptography | no | -- |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A config crash silently reported as "clean" (false-negative type-check) | Spoofing (the tool lies about safety) | COR-01: re-throw `TypecheckInfrastructureError` so a crash is never a PASS; KEEP both 500 scans (D-02 defense-in-depth). This is the phase's core security-relevant guarantee for CI/agents. |
| Under-reporting (global TS errors dropped) -> a real error escapes CI | Tampering / Repudiation | COR-02: gather `getGlobalDiagnostics()` so the reported set is complete. |
| A real error suppressed by a path edge (empty `fileName`) | Tampering | COR-03: always keep file-less diagnostics. |

## Sources

### Primary (HIGH confidence)
- Installed `node_modules/@angular/compiler-cli@22.0.4` bundle `bundles/chunk-6ZBSJK4S.js` -- read directly: `readConfiguration` (:456-518, outer catch :504-517 = code-500 with `source: 'angular'`, read-error branch :478-487 with `file`), `calcProjectFileAndBasePath` (:448-454, `host.lstat` throw -> 500), `exitCodeFromResult` (:549-556 = 0/1/2 mapping), `performCompilation` catch (:587-598 = code-500 NO source), `defaultGatherDiagnostics` (:600-618, confirms no `getGlobalDiagnostics`).
- Installed `node_modules/@angular/compiler-cli/src/transformers/api.d.ts:11` -- `export declare const UNKNOWN_ERROR_CODE = 500;` (literal type).
- Installed `node_modules/@angular/compiler-cli/bundles/index.js` -- public barrel re-exports `UNKNOWN_ERROR_CODE`, `exitCodeFromResult`, `performCompilation`, `readConfiguration`, `EmitFlags`.
- Installed `node_modules/typescript/lib/typescript.d.ts:6037` -- `getGlobalDiagnostics(cancellationToken?): readonly Diagnostic[]` on the public `Program` interface.
- Empirical probes (run on Node 24.18.0 against the installed packages): `probe-cor01.mjs` (nonexistent path -> 500; circular extends -> 500; malformed JSON -> 1005; broken-extends-target -> 5012/18003), `probe-cor02.mjs` (gatherer codes `[]` vs `getGlobalDiagnostics` `[2318 x10]` file-less), `probe-cor03d.mjs` (empty `fileName` SUPPRESSED today, KEPT with the extended guard), `probe-cor01-order.mjs` (today's fold returns `errorCount: 2` instead of throwing).
- Existing source (read): `run-typecheck.ts`, `gather-diagnostics.ts`, `filter-diagnostics.ts`, `evaluate-result.ts`, `executor.ts`, `compiler-cli-types.ts`, `eslint.config.mjs`.
- Existing specs (read, used as templates): `infra-failure.spec.ts`, `gather-diagnostics.spec.ts`, `filter-diagnostics.spec.ts`, `executor.spec.ts`, `config-resolution.integration.spec.ts`, `run-typecheck.integration.spec.ts`, `run-typecheck.spec.ts`, `evaluate-result.spec.ts`.

### Secondary (MEDIUM confidence)
- `.planning/research/prior-art/COMPILER-CLI-INTERNALS.md` and `PRIOR-ART-SUMMARY.md` -- corroborated by the direct source reads above (the prior-art line numbers reference the v22.0.4 source tree; the bundle line numbers above are the installed equivalents and agree).
- `.planning/research/prior-art/SHIM-HARDENING.md` -- the empty-`fileName` (#4) edge origin (synthesized diagnostics).

### Tertiary (LOW confidence)
- None. No unverified WebSearch claims were used; everything is from the installed packages and the repo.

## Metadata

**Confidence breakdown:**
- COR-01 (value + triggers + ordering): HIGH -- 500 value, `source`, file-less, `rootNames: []`, and the fold-vs-throw bug all reproduced empirically.
- COR-02 (gap + fix + type-checkability): HIGH -- gatherer-misses-TS2318 and `getGlobalDiagnostics` returns them reproduced; `getGlobalDiagnostics` confirmed on the public `ts.Program` type so the shim already type-checks.
- COR-03 (suppression today + fix): HIGH -- `isUnderDir('', base) === false` reproduced; the extended guard keeps it.
- COR-04 (ngc 0/1/2 parity + Nx 0/1 mapping): HIGH -- `exitCodeFromResult` read in the installed bundle; Nx mapping cited from CONTEXT's verified prior art (nx 23.0.1 `run.ts:72`, `command-object.ts:30`).
- Test/fixture strategy: HIGH -- patterns lifted directly from the existing 20-spec suite.

**Research date:** 2026-06-29
**Valid until:** until the next `@angular/compiler-cli` / `typescript` bump (the locked stack is pinned to 22.0.4 / 6.0.3, so stable for this milestone). Re-verify the 500/`exitCodeFromResult`/`getGlobalDiagnostics` claims at any Angular-version change (that re-verification is exactly Phase 10 HARD-01's drift assertion).
