# Phase 2: Core Type-Check Engine + Gatherer - Research

**Researched:** 2026-06-27
**Domain:** Programmatic `@angular/compiler-cli` whole-program no-emit type-check engine (Approach A), structured result contract, REAL-compiler integration test tier
**Confidence:** HIGH

This is an implementation-readiness research pass over an already-decision-rich CONTEXT.md. Decisions D-01..D-07d are LOCKED and are NOT re-decided here. This document does three things: (1) VERIFIES the load-bearing source citations against the locked toolchain; (2) fills the implementation-ready gaps (signatures, exact getter order, override application, fixture layout, Vitest split); (3) surfaces the LANDMINES the planner must avoid.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

All of D-01..D-07d are LOCKED. They are summarized here by ID; the planner MUST honor them verbatim from `02-CONTEXT.md` `<decisions>`. This research adds only the implementation detail beneath each, never an alternative.

### Locked Decisions (cite by ID; do NOT re-open)
- **D-01** Approach A `CoreResult` shape: explicit `errorCount`/`warningCount` by `ts.DiagnosticCategory` (NOT `total - errorCount`); keep `diagnostics[]`+`durationMs`; DROP public `codes`; invariant `errorCount + warningCount <= diagnostics.length`.
- **D-02** Force `diagnostics: false` in the options spread (suppresses the "Time for diagnostics" Message).
- **D-03 / D-03a / D-03b** Fail-loud config errors RETURNED not thrown: prepend `parsed.errors`; zero-`rootNames` short-circuit synthesizing one Error diagnostic (`ATC1001`-namespace, `file: undefined`); gate on `rootNames.length === 0` NEVER TS18003; reference-expansion is a dead end (ngtsc ignores `projectReferences`).
- **D-04** Core requires ABSOLUTE `tsConfigPath`; never touches `process.cwd()`.
- **D-05 / D-05a / D-05b / D-05c** Full emit-neutralizing override (verbatim object in CONTEXT), NOT minimal `{...options, noEmit:true}`; `emitFlags: 0` stays; KEEP semantics options verbatim; specs need the same normalization.
- **D-06** Detect + RE-THROW infrastructure failures (loader throw propagates; returned `UNKNOWN_ERROR_CODE` re-thrown) so `CoreResult` holds ONLY genuine diagnostics.
- **D-07 / D-07a / D-07b / D-07c / D-07d** Static hand-authored broken fixtures; representative ~6-8 differentiator subset; app + local-lib + `tsconfig.spec.json`; call `runTypecheck` DIRECTLY (one `performCompilation` per fixture, multiple assertions); assert EXACT codes + counts via the `NG(c) => -990000 - c` helper.

### Claude's Discretion (from CONTEXT.md `<decisions>`)
- Exact fixture directory/file names + shared-base tsconfig layout.
- Precise Vitest unit-vs-integration config split.
- The private synthesized-diagnostic code value/namespace (e.g. `ATC1001`).
- The exact throw type for D-06 infra failures + how Phase-4 executor maps it (Phase 4 concern).
- Module-level memoization of `loadCompilerCli`/`loadTypescript` (already correct; reuse).
- Re-verify exact NG code numbers/names against the Angular 22 clone on implementation (this research does that below).

### Deferred Ideas (OUT OF SCOPE for Phase 2)
Out-of-project/`node_modules` filtering (Phase 3 OUT-02); report-all/fail-fast modes + `--max-warnings` + `formatDiagnostics` output + exit semantics (Phase 3); unit tests that MOCK compiler-cli (Phase 3 TEST-01); ESLint/Prettier/`@nx/dependency-checks`/module-boundary enforcement (Phase 3 WS-04); executor adapter/schema/cacheable target (Phase 4); buildable+publishable lib fixtures + 5-type matrix (Phase 6); full v13->v22 catalog beyond the D-07a subset (additive later); `NgtscProgram` per-file/incremental/`--watch` (deferred milestone REP-02).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENG-01 | Framework-agnostic `runTypecheck(options)` runs `@angular/compiler-cli` whole-program, no-emit, against a given tsconfig | Verified `performCompilation` signature + `readConfiguration` + `ParsedConfiguration` shape against installed 22.0.4; D-05 override is the no-emit application; D-04 absolute-path contract |
| ENG-02 | Custom gatherer collects ALL diagnostics unconditionally, never short-circuiting like `ngc`'s default | `gatherAllDiagnostics` (6 getters) verified present + correct; `defaultGatherDiagnostics` `&&`-chain short-circuit verified in bundled 22.0.4 (the differentiator); only LW-01 import fix needed |
| ENG-04 | Structured result (errors/warnings as `ts.Diagnostic[]` + counts), `strictTemplates` honored, extended categories respected | D-01 `CoreResult` shape; category facts verified (NG8101=WARNING, NG10002=Suggestion, ngErrorCode negative encoding); explicit category counting |
| EXE-02 | Required `tsConfig` (single tsconfig per target); spec checking via `tsconfig.spec.json` | D-03 zero-rootNames guard + D-07b spec fixture; D-03a/D-03b solution-style detection |
| TEST-02 | Integration tests run REAL compiler against fixtures, assert exact codes/counts across v13->v22 catalog (organized by introduction version) | D-07a differentiator subset; D-07c direct-`runTypecheck`; D-07d exact-code helper; catalog codes re-verified against installed 22.0.4 below |
</phase_requirements>

---

## Summary

Phase 2 grows the kept Phase-1 tracer-bullet `core/` into the real engine. The work is precise and contained: replace the minimal `{...parsed.options, noEmit: true}` spread with the full D-05 emit-neutralizing override; fix the count bug (`warningCount = total - errorCount` -> explicit `Warning`-category count, D-01/MD-02); fold dropped `parsed.errors` into the diagnostics + add a zero-`rootNames` guard (D-03/MD-01); detect + re-throw `UNKNOWN_ERROR_CODE` infrastructure failures (D-06); apply the one-line LW-01 import fix in `gather-diagnostics.spec.ts`; and stand up the REAL-compiler integration test tier with ~6-8 static differentiator fixtures (D-07a) asserting exact codes/counts via the `NG()` helper (D-07d).

**Source verification result: all load-bearing citations VERIFY**, with three flags the planner must know: (1) the external Angular clone at `D:/projects/github/angular/angular` is **22.1.0-next.3**, NOT the locked stable **22.0.4** — the cited line numbers are against the `-next.3` clone but every cited code/API/line was re-confirmed to hold identically in the installed 22.0.4 (`.d.ts` + bundled `.js`), so the citations are usable but the planner should treat installed `node_modules/@angular/compiler-cli@22.0.4` as the runtime authority; (2) D-05a's "emit is gated by `emitFlags`, not `noEmit`" is only PARTIALLY accurate for 22.0.4 — both `emitFlags: 0` AND `noEmit: true` are load-bearing, neither is decorative (detail below); (3) D-06's UNKNOWN_ERROR_CODE detection must gate on `code === 500`, NOT on `source === 'angular'` — the synthesized catch diagnostic does not set `source` (landmine below).

**Primary recommendation:** Implement the engine as a single in-place rewrite of `run-typecheck.ts` that (a) calls `ng.readConfiguration`, (b) prepends `parsed.errors`, (c) short-circuits on zero `rootNames` with a synthesized `ATC1001` Error, (d) otherwise calls `performCompilation` with a FRESH D-05 override object + `diagnostics: false` + `emitFlags: 0` + `gatherAllDiagnostics`, (e) detects a returned `UNKNOWN_ERROR_CODE` (500) and re-throws, (f) counts `Error`/`Warning` categories explicitly. Then stand up `*.integration.spec.ts` files per Angular-introduction-version calling `runTypecheck` directly against committed static fixtures.

---

## Architectural Responsibility Map

This is a pure non-UI core-engine phase; "tiers" here are the layered seams inside the framework-agnostic core, not application tiers.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| ESM compiler-cli loading | `core/compiler-loader.ts` (memoized `await import()`) | — | Single runtime value-import; everywhere else `import type` (nodenext invariant) |
| TypeScript namespace loading | `core/run-typecheck.ts` (`loadTypescript`, memoized) | — | Needed for `ts.DiagnosticCategory` category counting; already present |
| tsconfig resolution + config errors | `core/run-typecheck.ts` (`ng.readConfiguration`) | — | ENG-01/EXE-02; D-03 prepends `parsed.errors`; D-04 absolute path |
| Zero-rootNames / solution-style guard | `core/run-typecheck.ts` | — | D-03/D-03a; synthesized `ATC1001` diagnostic; never reaches `performCompilation` |
| No-emit override application | `core/run-typecheck.ts` (D-05 object) | — | ENG-01; fresh object per call (footgun guard) |
| Whole-program compile | `@angular/compiler-cli` `performCompilation` | `core/run-typecheck.ts` orchestrates | Approach A / D-16 |
| Unconditional diagnostic gather | `core/gather-diagnostics.ts` (`gatherAllDiagnostics`) | — | ENG-02 differentiator; correct as-built |
| Infrastructure-failure detection | `core/run-typecheck.ts` (D-06 re-throw) | Phase-4 executor maps the throw | Keeps `errorCount` = real type errors only |
| Structured result + counts | `core/run-typecheck.ts` (`CoreResult`, D-01) | `src/index.ts` barrel re-export | ENG-04 |
| REAL-compiler integration assertions | `*.integration.spec.ts` (Vitest) | committed `fixtures/` | TEST-02; calls `runTypecheck` directly (D-07c) |

**Boundary invariant (carried from Phase 1, enforced in Phase 3/WS-04 but kept here):** `core/` has ZERO `@nx/devkit`/CLI imports. Phase 2 adds no adapter code. The Phase-4 executor is the first `core/` consumer.

---

## Source Verification Results

All citations from CONTEXT.md `<canonical_refs>` and the `<source_verification_targets>` were re-validated. Method: error codes + API shapes verified against the INSTALLED `node_modules/@angular/compiler-cli@22.0.4` (the runtime authority — `.d.ts` declarations + bundled `.mjs`/`.js`); line numbers verified against the external clone `D:/projects/github/angular/angular` (which is **22.1.0-next.3**). TypeScript option-conflict messages verified against installed `typescript@6.0.3`.

### Verified ACCURATE (no drift)

| Citation | Claim | Verification |
|----------|-------|--------------|
| `error_code` NG8101 | `INVALID_BANANA_IN_BOX = 8101` | [VERIFIED] `error_code.d.ts:394` (22.0.4) AND clone `error_code.ts:496`. Pushed via `makeTemplateDiagnostic`/`formatExtendedError` (chunk-33J3WRHI.js:3091-3106) — an extended template check, default category WARNING (NOT suggestion). |
| `error_code` NG8109 | `INTERPOLATED_SIGNAL_NOT_INVOKED = 8109` | [VERIFIED] `error_code.d.ts:477` (22.0.4) AND clone `error_code.ts:586`. |
| `error_code` NG10002 | `SUGGEST_SUBOPTIMAL_TYPE_INFERENCE = 10002` | [VERIFIED] `error_code.d.ts:597` (22.0.4) AND clone `error_code.ts:724`. |
| `error_code` NG8021 | `DEFER_TRIGGER_MISCONFIGURATION = 8021` | [VERIFIED] `error_code.d.ts:375` (22.0.4) AND clone `error_code.ts:447`. |
| `oob.ts:259-268` | NG10002 pushed as `ts.DiagnosticCategory.Suggestion` | [VERIFIED] Installed bundle chunk-VBOLXMVC.js:9395 (`makeTemplateDiagnostic(..., ts.DiagnosticCategory.Suggestion, ngErrorCode(SUGGEST_SUBOPTIMAL_TYPE_INFERENCE), ...)`) AND clone `oob.ts:264-265`. Confirms D-01's MD-02 fix is REAL not theoretical. |
| `util.ts:26-28` | `ngErrorCode = parseInt('-99' + code)` | [VERIFIED] Installed bundle chunk-QY6RCOQ6.js:143-145 (`function ngErrorCode(code){return parseInt("-99"+code);}`) AND clone `util.ts:26-28`. So NG8109 -> -998109. |
| `perform_compile` `readConfiguration` | returns `ParsedConfiguration { project, options, rootNames, projectReferences?, emitFlags, errors }` | [VERIFIED] `perform_compile.d.ts:14-21,26` (22.0.4) AND clone `perform_compile.ts:75,166`. `parsed.errors` + `parsed.projectReferences?` both present — D-03/D-03a usable. |
| `perform_compile` `performCompilation` | accepts `{ rootNames, options, emitFlags, gatherDiagnostics }`, returns `{ diagnostics, program?, emitResult? }` | [VERIFIED] `perform_compile.d.ts:33-45` (22.0.4) AND clone `perform_compile.ts:255-278`. |
| `perform_compile` `options.diagnostics` Message | `if (options.diagnostics) { ...createMessageDiagnostic('Time for diagnostics...') }` | [VERIFIED] Installed bundle chunk-6ZBSJK4S.js:571-573 AND clone `perform_compile.ts:295-298`. D-02 (`diagnostics: false`) suppresses it. |
| `perform_compile` UNKNOWN_ERROR_CODE synth | outer `catch (e)` pushes `{ category: Error, code: UNKNOWN_ERROR_CODE, file: undefined }` | [VERIFIED] Installed bundle chunk-6ZBSJK4S.js:587-595 AND clone `perform_compile.ts:314-327`. `UNKNOWN_ERROR_CODE = 500` (`api.d.ts:11`). |
| `perform_compile` `exitCodeFromResult` | return-not-throw contract | [VERIFIED] `perform_compile.d.ts:32` AND clone `perform_compile.ts:244-253`. D-06 mirrors this. (See landmine on `source` field.) |
| `program.ts:82-84` | plain `ts.createProgram` (no builder/incremental) | [VERIFIED] clone `program.ts:83` (`ts.createProgram(this.host.inputFiles, options, this.host, reuseProgram)`). Confirms Approach A and D-05's `incremental:false`/`tsBuildInfoFile:undefined` reasoning. |
| 6 gatherer getters | `getTsOptionDiagnostics`, `getNgOptionDiagnostics`, `getTsSyntacticDiagnostics`, `getTsSemanticDiagnostics`, `getNgStructuralDiagnostics`, `getNgSemanticDiagnostics` all on `Program` | [VERIFIED] `api.d.ts:134,138,144,156,161,167` (22.0.4). |
| `defaultGatherDiagnostics` short-circuit | `&&`-chain stops at `getNgSemanticDiagnostics` after an earlier error | [VERIFIED] Installed bundle chunk-6ZBSJK4S.js:600-619: `checkOtherDiagnostics = checkOtherDiagnostics && checkDiagnostics(...)` four-stage chain; final stage is `getNgSemanticDiagnostics`. The ENG-02 differentiator is real. |
| TS5053/TS6304 | option-conflict diagnostics | [VERIFIED] `typescript.js` (6.0.3): `Option_0_cannot_be_specified_with_option_1: diag(5053,...)` (line 10347); `Composite_projects_may_not_disable_declaration_emit: diag(6304,...)` (line 10703). Validation logic at ~129653. |

### Drift / Refinement Flags (planner MUST read)

| # | Flag | Detail | Action |
|---|------|--------|--------|
| V-1 | **External clone is 22.1.0-next.3, not locked 22.0.4** | All CONTEXT line citations point at `D:/projects/github/angular/angular` = `22.1.0-next.3`. Every cited code/API/line was re-confirmed identical in installed 22.0.4 (`.d.ts` + bundles), so citations are usable — but the clone is NOT the locked stable. | Treat `node_modules/@angular/compiler-cli@22.0.4` as the runtime authority. The clone is for line-number/`.ts`-source reading only. Do not assume `-next.3`-only behavior. |
| V-2 | **D-05a is only PARTIALLY accurate for 22.0.4** | CONTEXT D-05a: "emit is gated by `emitFlags`, not `noEmit` ... `noEmit: true` is belt-and-suspenders." In installed 22.0.4 the `NgtscProgram.emit` `emitFlags & EmitFlags.JS` early-return (`program.ts:286-300`, bundle chunk-6ZBSJK4S.js:316-325) is reached ONLY when `emitFlags & I18nBundle` is set (the source comment says so explicitly). With `emitFlags: 0` and no i18n, emit falls through to `defaultEmitCallback` -> `ts.Program.emit`, where **`noEmit: true` is the actual suppressor**. ALSO: `performCompilation` only emits `if (!hasErrors(allDiagnostics))` — for broken fixtures (errors present) emit never runs regardless. | Keep BOTH `emitFlags: 0` AND `noEmit: true`. Neither is decorative. Do NOT drop `noEmit: true` as "redundant." The primary guard for broken fixtures is the `!hasErrors` gate; `noEmit:true` is the guard for the CLEAN fixture. |
| V-3 | **D-06 must gate on `code === 500`, NOT `source === 'angular'`** | The synthesized catch diagnostic (perform_compile.ts:314-327 / bundle :587-595) sets `{ category, messageText, code: 500, file, start, length }` — it does NOT set a `source` field. But `exitCodeFromResult` (clone `perform_compile.ts:252`) checks `d.source === 'angular' && d.code === UNKNOWN_ERROR_CODE`. Copying that predicate verbatim would MISS the synthesized diagnostic. | D-06 detection: `result.diagnostics.some(d => d.code === UNKNOWN_ERROR_CODE)` (import `UNKNOWN_ERROR_CODE` from the loaded namespace, value 500). Do NOT add the `source === 'angular'` clause. (Landmine L-3 below.) |
| V-4 | **`hasErrors` cited line is off** | CONTEXT bounds `exitCodeFromResult`/`hasErrors` at clone "244-253". `exitCodeFromResult` is at 244-253; `hasErrors` is actually at clone `perform_compile.ts:364`. Minor; the API claim holds. | Cosmetic only; no impact. |
| V-5 | **This workspace's `tsconfig.base.json` is CLASSIC, not TS-solution** | `--preset=apps` (Phase-1 D-04) produced a classic base with `declaration:false, sourceMap:true` — NO `composite`/`emitDeclarationOnly`. The D-05 TS5053/TS6304 triangle is a CONSUMER-workspace risk (TS-solution setups, e.g. Nx `ts-solution/tsconfig.base.json__tmpl__` which sets `composite:true, declarationMap:true, emitDeclarationOnly:true`), NOT this dev workspace's default. | A Phase-2 fixture will NOT exercise the composite triangle unless it deliberately sets `composite: true`. To make D-05 regression-proof (success criterion 1, "Angular no-emit overrides"), author ONE fixture/tsconfig that sets `composite: true` + `emitDeclarationOnly: true` so the override is proven to neutralize TS5053/TS6304. (Landmine L-1 + Validation row.) |

---

## Standard Stack

**No new packages.** Phase 2 is a pure code-and-test phase against the LOCKED, already-installed toolchain. The Package Legitimacy Audit section is therefore N/A (no installs).

### Already-installed (verified versions)
| Package | Installed | Role in Phase 2 | Verification |
|---------|-----------|-----------------|--------------|
| `@angular/compiler-cli` | `22.0.4` (peer; exact dev pin) | The type-check engine (`readConfiguration`, `performCompilation`, `defaultGatherDiagnostics`, `UNKNOWN_ERROR_CODE`, `EmitFlags`) | [VERIFIED: node_modules] `package.json` version 22.0.4; all APIs confirmed above |
| `typescript` | `6.0.3` (peer; exact dev pin) | `ts.DiagnosticCategory` for explicit counting; `ts.Diagnostic` type | [VERIFIED: node_modules] version 6.0.3; TS5053/6304 messages confirmed |
| `nx` / `@nx/vitest` | `23.0.1` | `@nx/vitest:test` runs the integration tier | [VERIFIED: package.json] |
| `vitest` | `~4.1.0` (`4.1.9` resolved) | Test runner (`describe.each`, `it`, `expect`) | [VERIFIED: package.json] |

### Module-load pattern (KEEP as-is, widen the type shim)
- `core/compiler-loader.ts` memoized `await import('@angular/compiler-cli')` — the single runtime value-import. KEEP.
- `core/compiler-cli-types.ts` nodenext-safe shim — the `CompilerCli` interface currently declares `readConfiguration`, `performCompilation`, `defaultGatherDiagnostics`, `EmitFlags`. **Phase 2 must widen it to also expose `UNKNOWN_ERROR_CODE`** (for D-06) — add `readonly UNKNOWN_ERROR_CODE: typeof UNKNOWN_ERROR_CODE;` sourced from `'../../../../node_modules/@angular/compiler-cli/src/transformers/api'`. (The shim header already says "widen as the engine grows in Phase 2.")

---

## Architecture Patterns

### Engine data-flow (the `runTypecheck` pipeline)

```
runTypecheck({ tsConfigPath })           [D-04: tsConfigPath is ABSOLUTE; core never reads cwd]
        |
        v
  loadCompilerCli()  (memoized await import; D-06: a throw here PROPAGATES = infra error)
  loadTypescript()   (memoized; for ts.DiagnosticCategory)
        |
        v
  ng.readConfiguration(tsConfigPath) -> parsed { options, rootNames, projectReferences?, errors }
        |
        +--> configDiagnostics = [...parsed.errors]          [D-03 (1): prepend, never drop -- MD-01]
        |
        v
  parsed.rootNames.length === 0 ?
        |  yes                                   |  no
        v                                        v
  SHORT-CIRCUIT (skip performCompilation)   options = { ...parsed.options, <D-05 override>, diagnostics:false }
  synthesize ONE ATC1001 Error diagnostic   [D-05: FRESH object per call -- footgun guard]
  (message tailored by                            |
   parsed.projectReferences?.length;              v
   D-03 (2)/D-03a)                          ng.performCompilation({
        |                                      rootNames: parsed.rootNames,
        |                                      options,
        |                                      emitFlags: 0,                 [D-05a: load-bearing w/ noEmit]
        |                                      gatherDiagnostics: gatherAllDiagnostics,  [ENG-02]
        |                                    }) -> result.diagnostics
        |                                        |
        |                                        v
        |                                  result.diagnostics.some(d => d.code === UNKNOWN_ERROR_CODE)?
        |                                        |  yes -> THROW (D-06; infra failure, NOT a type error)
        |                                        |  no  -> continue
        |                                        v
        +------------------> allDiagnostics = [...configDiagnostics, ...result.diagnostics]
                                                 |
                                                 v
                              errorCount   = count(category === Error)     [D-01: explicit -- MD-02]
                              warningCount = count(category === Warning)   [D-01: NOT total - errors]
                                                 |
                                                 v
                              CoreResult { tsConfigPath, rootNamesCount, diagnostics, errorCount, warningCount, durationMs }
```

Note on the short-circuit path: the synthesized `ATC1001` is an Error, so `errorCount === 1` for the solution-style/empty case — agents/CI get a deterministic non-zero signal (D-03 (3)). `rootNamesCount === 0` is the machine-readable marker that the guard fired.

### The `CoreResult` contract (D-01, verbatim target)

```ts
// run-typecheck.ts  -- REPLACES the current CoreResult (drops public `codes`)
export interface CoreResult {
  tsConfigPath: string;                  // resolved absolute path actually checked (D-07b)
  rootNamesCount: number;                // input file count; 0 => the D-03 guard fired
  diagnostics: readonly ts.Diagnostic[]; // GENUINE compiler diagnostics only (D-06); config errors prepended (D-03)
  errorCount: number;                    // category === Error (explicit)
  warningCount: number;                  // category === Warning (explicit, NOT total - errorCount)
  durationMs: number;
}
```

**Breaking-change note for the planner:** the public `codes: number[]` field is REMOVED. Existing Phase-1 specs derive codes inline (`result.codes.toContain(...)` in `gate-b.spec.ts:102-103`). Phase 2 must update those call sites to `result.diagnostics.map(d => d.code)` — OR keep `gate-b.spec.ts` reading `codes` by changing it to map. The `gate-b.spec.ts` GATE B suite is a Phase-1 artifact; do not delete it (it remains the differential proof) but reconcile its `result.codes` usage with the new shape. Minimal fix: a local `const codes = result.diagnostics.map(d => d.code)` in those two assertions.

### The no-emit override (D-05, verbatim) — application notes

Apply the D-05 object EXACTLY as written in CONTEXT. Two implementation notes the planner needs:

1. **Order is load-bearing via `composite: false`.** TS option validation (typescript.js ~129653) reads: `if (options.composite) { if (options.declaration === false) -> TS6304; if (options.incremental === false) -> TS6379 }`. Because the override sets `composite: false`, that entire block is skipped, which makes `declaration: false`/`incremental: false` SAFE. If a future edit dropped `composite: false` but kept `declaration: false`, TS6304 fires; if it kept `incremental: false` without `composite: false`, TS6379 fires. Keep `composite: false` as the gatekeeper. (Landmine L-1.)
2. **`diagnostics: false` (D-02) is a SEPARATE key from the D-05 object** in CONTEXT's prose ("Force `diagnostics: false` in the options spread alongside the no-emit overrides"). Merge it into the same spread: `{ ...parsed.options, <D-05 fields>, diagnostics: false }`.

### Gatherer (ENG-02) — keep + one fix

`gather-diagnostics.ts` is correct as-built (6 getters, unconditional, no `&&`-chain). The getter order (`getTsOptionDiagnostics`, `getNgOptionDiagnostics`, `getTsSyntacticDiagnostics`, `getTsSemanticDiagnostics`, `getNgStructuralDiagnostics`, `getNgSemanticDiagnostics`) matches D-16. The framework's own `defaultGatherDiagnostics` groups them differently (`[option+ngOption]`, `[syntactic]`, `[semantic+structural]`, `[ngSemantic]`) but that is only to bound its `&&`-chain — for the unconditional all-getter the grouping is irrelevant; collecting all six in any order yields the identical superset. No change to `gather-diagnostics.ts`.

**The one fix (LW-01, D's gatherer section):** `gather-diagnostics.spec.ts:1` still reads `import type { Program } from '@angular/compiler-cli'` (the barrel the nodenext shim exists to avoid). Change to `import type { Program } from './compiler-cli-types'`. This is the single named LW-01 fix; verified still open in the current spec.

### Anti-Patterns to Avoid
- **Sharing one parsed-config `options` object across two `performCompilation` calls.** `performCompilation`/`createProgram` can mutate `options`; the differential GATE B already proved this needs a FRESH spread per call. D-07c mandates one `performCompilation` per fixture for this reason. Do NOT reuse a program or options object across fixtures.
- **Counting the synthesized `UNKNOWN_ERROR_CODE` as a type error.** That conflates an infra crash with a type failure; D-06 re-throws instead.
- **Reading `process.cwd()` anywhere in `core/`.** Breaks framework-agnostic purity (D-04); the executor resolves paths in Phase 4.
- **Hand-parsing tsconfig.** Always go through `ng.readConfiguration` (gets the full `extends` chain + `angularCompilerOptions`).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| tsconfig `extends` chain + `angularCompilerOptions` resolution | A custom tsconfig parser | `ng.readConfiguration(absolutePath)` | Resolves the full extends chain, `paths`, and Angular options exactly as ngtsc does; verified API |
| Whole-program compile orchestration | A bespoke `ts.createProgram` + Angular wiring | `ng.performCompilation({ ... gatherDiagnostics })` | Builds the `NgtscProgram` + host correctly; the custom gatherer plugs into its `gatherDiagnostics` hook |
| Negative NG-code decoding | Bit-twiddling on `d.code` | `Math.abs(code) - 990000` (assert) / the `NG()` helper (expect) | `ngErrorCode = parseInt('-99'+code)` verified; counting is by `.category`, not code sign |
| "Did emit run / is this no-emit" | Inspecting emitted files | The `!hasErrors` gate + `noEmit:true` + `emitFlags:0` combination | Engine already guarantees no write for broken fixtures; `noEmit` covers the clean case |
| Solution-style detection | Parsing `references` arrays by hand | `parsed.rootNames.length === 0` (gate) + `parsed.projectReferences?.length` (message tailoring) | D-03a: TS18003 is suppressed when `references` present; rootNames is the reliable signal |

**Key insight:** The entire engine is a thin orchestration over `readConfiguration` + `performCompilation` + the custom gatherer. The value-add is the UNCONDITIONAL gather (ENG-02) and the correct RESULT contract (D-01/D-03/D-06), not any compiler re-implementation.

---

## Concrete Signatures & File Layout

### Files Phase 2 touches (grows in place — NOT a rewrite of the package)

| File | Action | What |
|------|--------|------|
| `src/core/run-typecheck.ts` | REWRITE body | New `CoreResult` (drop `codes`, add `tsConfigPath`/`rootNamesCount`); D-05 override; D-02 `diagnostics:false`; D-03 prepend + zero-rootNames guard + `ATC1001`; D-06 detect+throw; D-01 explicit counts |
| `src/core/gather-diagnostics.ts` | KEEP | No change (ENG-02 correct) |
| `src/core/gather-diagnostics.spec.ts` | EDIT 1 line | LW-01: import `Program` from `./compiler-cli-types` |
| `src/core/compiler-loader.ts` | KEEP | No change |
| `src/core/compiler-cli-types.ts` | WIDEN | Add `UNKNOWN_ERROR_CODE` to `CompilerCli` (D-06 needs the value 500); optionally `exitCodeFromResult` if useful |
| `src/core/gate-b.spec.ts` | RECONCILE | Replace `result.codes` (removed) with `result.diagnostics.map(d => d.code)` in the timing test (lines 102-103) |
| `src/index.ts` | KEEP/verify | Still exports `runTypecheck` + `CoreOptions`/`CoreResult` types (no `codes` type to worry about) |
| `src/core/run-typecheck.spec.ts` | NEW (optional unit) | Pure-logic asserts where they don't need the real compiler — but note TEST-01 (mocked unit tests) is Phase 3; keep Phase-2 new specs as REAL-compiler integration |
| `src/**/*.integration.spec.ts` | NEW | The TEST-02 tier (see Vitest split + fixture catalog below) |
| `fixtures/<new dirs>` | NEW | The D-07a differentiator fixtures + their tsconfigs (see catalog) |

### `runTypecheck` skeleton (implementation-ready; planner refines)

```ts
// run-typecheck.ts -- conceptual shape; honor D-01..D-06 exactly
export async function runTypecheck(options: CoreOptions): Promise<CoreResult> {
  const ng = await loadCompilerCli();      // D-06: throw here propagates (infra)
  const ts = await loadTypescript();

  const parsed = ng.readConfiguration(options.tsConfigPath);
  const configDiagnostics = [...parsed.errors];        // D-03 (1): never drop -- MD-01

  const start = performance.now();

  if (parsed.rootNames.length === 0) {                 // D-03 (2)/D-03a: the reliable gate
    const guard = synthesizeZeroRootNamesDiagnostic(ts, parsed); // ATC1001, category Error, file: undefined
    return finalize(ts, options.tsConfigPath, 0, [...configDiagnostics, guard], start);
  }

  const result = ng.performCompilation({
    rootNames: parsed.rootNames,
    options: {
      ...parsed.options,
      // ---- D-05 emit-neutralizing override (verbatim from CONTEXT) ----
      noEmit: true, composite: false, declaration: false, declarationMap: false,
      emitDeclarationOnly: false, incremental: false, tsBuildInfoFile: undefined,
      sourceMap: undefined, inlineSourceMap: undefined, inlineSources: undefined,
      declarationDir: undefined, mapRoot: undefined, sourceRoot: undefined,
      // ---- D-02 ----
      diagnostics: false,
    },
    emitFlags: 0 as EmitFlags,                          // D-05a: load-bearing with noEmit
    gatherDiagnostics: gatherAllDiagnostics,            // ENG-02
  });

  if (result.diagnostics.some((d) => d.code === ng.UNKNOWN_ERROR_CODE)) {  // D-06; V-3: by code, NOT source
    throw new TypecheckInfrastructureError(/* the 500 diagnostic's messageText */);
  }

  return finalize(ts, options.tsConfigPath, parsed.rootNames.length,
                  [...configDiagnostics, ...result.diagnostics], start);
}

function finalize(ts, tsConfigPath, rootNamesCount, diagnostics, start): CoreResult {
  const errorCount   = diagnostics.filter((d) => d.category === ts.DiagnosticCategory.Error).length;   // D-01
  const warningCount = diagnostics.filter((d) => d.category === ts.DiagnosticCategory.Warning).length; // D-01 (NOT total - errors)
  return { tsConfigPath, rootNamesCount, diagnostics, errorCount, warningCount, durationMs: performance.now() - start };
}
```

Notes: `synthesizeZeroRootNamesDiagnostic` builds `{ category: Error, code: <ATC1001 numeric>, file: undefined, start: undefined, length: undefined, messageText: <tailored> }`. The `ATC1001` value is Claude's discretion (CONTEXT) — pick a number outside both the TS range and the Angular `-99xxxx`/`500` space (e.g. a small private positive like `90001`, or a string-coded scheme; the planner decides). The message must name the leaf tsconfigs explicitly (`tsconfig.app.json` / `tsconfig.lib.json` / `tsconfig.spec.json`) per D-03/the `<specifics>` block, branching on `parsed.projectReferences?.length` (solution-style vs empty project).

### The `NG()` assertion helper (D-07d, named must-have)

```ts
// test helper -- mirror Angular's own ngErrorCode for ASSERTING expected codes
const NG = (code: number): number => -990000 - code;   // NG8109 -> -998109
// recovery for diagnostics seen in output:
const ngCodeOf = (code: number): number => Math.abs(code) - 990000;  // -998109 -> 8109
```
TS codes stay raw (`2322`, `2339`). NG codes assert via `NG(8109)`. Verified consistent with `ngErrorCode(code) = parseInt('-99'+code)` (the two formulas agree for all 4-digit NG codes: `parseInt('-99'+8109) === -998109 === -990000 - 8109`).

---

## Fixture Catalog (D-07a differentiator subset)

Re-verify each NG code/name against the installed 22.0.4 `error_code.d.ts` (or `extended_template_diagnostic_name.ts`) when authoring — the catalog flags this. All codes below were re-confirmed present in 22.0.4 during this research. **Do NOT author fixtures for NG8110 (`UNSUPPORTED_INITIALIZER_API_USAGE`) or NG8112 (`UNUSED_LET_DECLARATION`)** — they are undocumented compiler diagnostics, not extended diagnostics (DIAGNOSTIC-CATALOG.md). NG8116 shipped in 19.2.0 despite docs lag.

The D-07a target is ~6-8 fixtures. Each is a minimal standalone component (or class) with its OWN committed `tsconfig.*.json` extending a shared fixture base (`strictTemplates: true`). Organize files per introduction version (`*.angularNN.integration.spec.ts`) so future codes are drop-in (D-07a).

| # | Fixture intent | Expected codes (assert exact) | Category | Notes |
|---|----------------|-------------------------------|----------|-------|
| F1 | TS baseline: class-level type-assignment error | `2322` | Error | Plain `count: number = 'x'` (already exists in `gate-b-error`; reuse the shape) |
| F2 | TS template-driven: template references missing member | `2339` | Error | Requires `strictTemplates`; template type-check surfaces it as TS2339 |
| F3 | NG baseline: unknown element/component | `NG(8001)` | Error | NG8001 unknown component/element (verify name in 22.0.4) |
| F4 | NG baseline: missing injection token | `NG(2003)` | Error | NG2003 primitive constructor param without token |
| F5 | Extended early (v13): invalid banana-in-box | `NG(8101)` | **Warning** (default) | NG8101 verified WARNING (not suggestion) at error_code.d.ts:394. Assert as Warning unless promoted |
| F6 | Extended late: signal-not-invoked (v17) OR defer-trigger (v21) | `NG(8109)` or `NG(8021)` | **Warning** -> **Error** when promoted | Use a fixture with `extendedDiagnostics.defaultCategory: "error"` to PROVE category promotion auto-bumps it into `errorCount` (D-01 fact). NG8109 fixture is portable from `gate-b-error` |
| F7 | **Multi-error (the single most valuable fixture, ENG-02)** | `2322` AND `NG(8109)` (+ tolerate `NG(8117)`) | mixed | Plain TS error AND template/extended error in the SAME program. Proves the no-short-circuit gatherer surfaces both where `ngc` defaultGatherDiagnostics returns only `2322`. The `gate-b-error` fixture already IS this — promote/keep it |
| F8 | **D-05 composite-triangle regression** | clean (0 errors) OR the intended error only — and NO `5053`/`6304`/`6379` | n/a | A fixture tsconfig with `composite: true` + `emitDeclarationOnly: true` (+ `declarationMap: true`). Proves the D-05 override neutralizes the triangle (V-5/L-1). Without this, success criterion 1 ("Angular no-emit overrides") is unproven on this classic-base workspace |

Also REQUIRED by D-07b (project-type coverage, not a separate diagnostic):
- An **application** tsconfig (`tsconfig.app.json`-shaped) and a **local non-buildable library** tsconfig (`tsconfig.lib.json`-shaped) and a **`tsconfig.spec.json`** all pointing at fixture sources — the spec tsconfig is the named differentiator vs a build check (success criterion 3). The existing `fixtures/gate-b-error/{tsconfig.app.json, tsconfig.lib.json}` covers app+lib; ADD a `tsconfig.spec.json` variant.
- A **solution-style / references-only** tsconfig (`{ files:[], include:[], references:[...] }`) to prove the D-03 guard returns the `ATC1001` Error with `rootNamesCount === 0` (success criterion 3, "does NOT silently report 0 files / 0 errors"). This fixture is the MD-01 regression proof.

Fixture placement: keep the Phase-1 convention — committed under a top-level `fixtures/` dir (NOT in `src/`, so Vitest does not collect them as tests; NOT in the project graph; excluded from `tsconfig.lib.json` per the existing `"fixtures/gate-b-error/**/*"` exclude). Add the new fixtures alongside `gate-b-error/` (e.g. `fixtures/ts-baseline/`, `fixtures/ng-baseline/`, `fixtures/extended-v17/`, `fixtures/multi-error/` (or reuse gate-b-error), `fixtures/composite-triangle/`, `fixtures/solution-style/`). Exact names are Claude's discretion.

**Reuse note:** `fixtures/gate-b-error/` already satisfies F1+F7 (TS2322 + NG8109 + NG8117 companion) and provides app+lib tsconfigs. The new work is F2-F6, F8, the spec tsconfig, and the solution-style fixture.

---

## Vitest Config Split (Claude's discretion — recommendation)

Current state: ONE `vitest.config.mts` (`include: ['{src,tests}/**/*.{test,spec}.*']`, `environment: 'jsdom'`). All Phase-1 specs are fast.

The REAL-compiler integration tier is meaningfully slower (cold ESM import + `performCompilation` per fixture; Phase-1 recorded ~297ms cold-run). Two viable approaches:

**Recommended: filename-convention split within one config (lowest friction).**
- Name integration specs `*.integration.spec.ts`; keep fast specs as `*.spec.ts`.
- Quick run (per task/commit): `npx nx test angular-typechecker -- --exclude '**/*.integration.spec.ts'` (or a `projects`/`include` filter) for the fast unit specs.
- Full run (per wave/phase gate): `npx nx test angular-typechecker` runs everything.
- Rationale: avoids a second Nx target now; the integration specs still run under the same `@nx/vitest:test` target (WS-03). The unit/mock tier (TEST-01) is Phase 3 — do NOT build the mock split now.

**Alternative: a Vitest `workspace`/second project for `integration`.** More ceremony (second config, second `name`); defer unless the integration tier grows large. The split TIMING is explicitly Claude's discretion per CONTEXT.

`environment`: the integration specs call `runTypecheck` against committed fixture tsconfigs — they do NOT need `jsdom` (no DOM). They can run in `node`. But forcing a per-file environment override adds config; keeping the inherited `jsdom` is harmless (the compiler runs in Node regardless). Recommendation: leave the global environment; do not over-configure.

---

## Common Pitfalls (Phase-2-specific; the broader project list lives in PITFALLS.md)

### Pitfall A: Dropping `noEmit: true` as "redundant"
**What goes wrong:** A clean fixture (no errors) reaches `program.emit({ emitFlags: 0 })`; with i18n absent the `emitFlags & JS` early-return is NOT hit, so emit falls through to `ts.Program.emit`, where ONLY `noEmit: true` suppresses the write.
**Why:** D-05a's wording undersells `noEmit`. Verified in 22.0.4 bundle.
**Avoid:** Keep both `noEmit: true` and `emitFlags: 0`. (See V-2.)
**Warning signs:** Stray `.js`/`.d.ts` appearing next to a clean fixture during integration tests.

### Pitfall B: Counting the synthesized crash as a type error
**What goes wrong:** An ESM-load or internal-crash surfaces as a single Error diagnostic with `code: 500`; counting it inflates `errorCount` and a green project "fails" for an infra reason.
**Why:** `performCompilation`'s outer catch converts ALL throws to one `UNKNOWN_ERROR_CODE` diagnostic.
**Avoid:** D-06 detect-and-rethrow on `code === 500`.
**Warning signs:** `errorCount: 1` with a stack-trace `messageText` and `file: undefined`.

### Pitfall C: Solution-style tsconfig silently passing
**What goes wrong:** Target points at `{ files:[], include:[], references:[...] }`; `rootNames` is empty; `performCompilation` reports 0 errors -> false "clean."
**Why:** TS18003 is suppressed when `references` present (D-03a); ngtsc ignores `projectReferences` (D-03b).
**Avoid:** Gate on `rootNames.length === 0` BEFORE `performCompilation`; synthesize `ATC1001`.
**Warning signs:** `rootNamesCount: 0` with `errorCount: 0` (the bug); the guard makes it `errorCount: 1`.

### Pitfall D: Shared mutated options across calls
**What goes wrong:** Reusing one `options` object across two `performCompilation` calls leaks a mutated `noEmit`/program state.
**Why:** The compiler can mutate options; proven in the Phase-1 GATE B differential.
**Avoid:** FRESH spread per call (D-05); one `performCompilation` per fixture (D-07c).

### Pitfall E: Asserting bare NG codes
**What goes wrong:** `expect(codes).toContain(8109)` never matches; the real code is `-998109`.
**Why:** `ngErrorCode = parseInt('-99'+code)` (verified). TS codes are NOT offset.
**Avoid:** The `NG()` helper (D-07d); TS codes raw.

---

## Landmines (planner MUST route around)

| # | Landmine | Trigger | Mitigation |
|---|----------|---------|------------|
| **L-1** | TS5053/TS6304/TS6379 composite-triangle | A consumer (or fixture) tsconfig with `composite:true`/`emitDeclarationOnly:true` + the minimal `{...options, noEmit:true}` -> `getTsOptionDiagnostics()` reports a bogus Error -> every project "fails" for the wrong reason | Apply the FULL D-05 override; `composite: false` is the gatekeeper that makes `declaration:false`/`incremental:false` safe (verified at typescript.js ~129653). Author F8 to prove it. |
| **L-2** | TS18003 does NOT fire on solution-style configs | Detecting solution-style via TS18003 "No inputs were found" | Gate on `rootNames.length === 0` (D-03a). TS deliberately suppresses TS18003 when `references` present (`canJsonReportNoInputFiles = !hasProperty(raw,"files") && !hasProperty(raw,"references")`), and Nx solution roots have BOTH. |
| **L-3** | `exitCodeFromResult`'s `source === 'angular'` predicate | Copying `exitCodeFromResult` logic verbatim for D-06 detection | The synthesized 500 diagnostic does NOT set `source`. Detect on `d.code === UNKNOWN_ERROR_CODE` (500) only. (V-3.) |
| **L-4** | Negative NG-code encoding | Bucketing diagnostics by code sign, or asserting bare `8109` | Count by `.category` (D-01); assert via `NG()` (D-07d). The negative encoding affects DISPLAY only. |
| **L-5** | Fresh-options-per-call mutation | Reusing an `options` object across `performCompilation` calls | FRESH spread every call (D-05/D-07c). |
| **L-6** | ESM `await import()` under `module: nodenext` regression | Any refactor of `compiler-loader.ts` that lets `@nx/js:tsc` downlevel `import()` -> `require()` | KEEP `compiler-loader.ts` untouched; the GATE A static spec (`gate-a-static.spec.ts`) still guards the built artifact. Do NOT move the `await import()` out of core. |
| **L-7** | NG8110/NG8112 are NOT extended diagnostics | Authoring fixtures expecting them on the extended-diagnostics path | Skip them (DIAGNOSTIC-CATALOG). Use NG8101/8109/8021 for the extended range. |
| **L-8** | Public `codes` removal breaks Phase-1 specs | Dropping `CoreResult.codes` (D-01) without reconciling `gate-b.spec.ts:102-103` | Replace `result.codes` with `result.diagnostics.map(d => d.code)` at those call sites; keep the GATE B suite intact (it remains the differential proof). |
| **L-9** | External clone is `-next.3`, not `22.0.4` | Reading behavior/line numbers from `D:/projects/github/angular/angular` and assuming it matches the locked stack | Confirm against installed `node_modules/@angular/compiler-cli@22.0.4` for any runtime-behavior claim. (V-1.) |

---

## Runtime State Inventory

Phase 2 is greenfield engine code + new committed fixtures — no rename/refactor/migration of stored or registered state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no datastores; type-check is stateless per run | None |
| Live service config | None — no external services | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | `dist/packages/angular-typechecker/` (gitignored) is rebuilt by `nx build`; the GATE A static spec reads it. Changing `CoreResult` does not change the built-artifact assertions (they read `import(` tokens, not the result shape). | Re-run `nx build` before any GATE A static spec run (already the Phase-1 pattern: `nx build && nx test`) |

**Nothing requiring data migration** — verified: the engine holds no persisted state; each `runTypecheck` is a fresh `performCompilation`.

---

## Validation Architecture

> Consumed downstream to generate `02-VALIDATION.md` for Nyquist coverage. `workflow.nyquist_validation` is enabled (not `false` in config). Every Phase-2 requirement and every locked decision maps to a concrete, observable validation at the right sampling rate.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `4.1.9` via `@nx/vitest:test` |
| Config file | `packages/angular-typechecker/vitest.config.mts` |
| Quick run command (fast specs) | `npx nx test angular-typechecker -- --exclude '**/*.integration.spec.ts'` |
| Full suite command | `npx nx build angular-typechecker && npx nx test angular-typechecker` (build precedes so GATE A static reads fresh `dist`) |
| Integration tier | `*.integration.spec.ts` (REAL compiler, committed fixtures, `runTypecheck` direct — D-07c) |

### Requirement -> Test Map
| Req / Decision | Behavior | Test Type | Automated Command / Assertion | File Exists? |
|----------------|----------|-----------|-------------------------------|--------------|
| ENG-01 | `runTypecheck` loads ESM compiler-cli, resolves tsconfig, runs whole-program no-emit, returns structured result | integration | `runTypecheck({tsConfigPath: <app fixture>})` resolves; `result.rootNamesCount > 0`; `result.diagnostics` is a `ts.Diagnostic[]` | Wave 0 (`engine.integration.spec.ts`) |
| ENG-02 | Gatherer surfaces TS + template + extended in ONE pass, no short-circuit | unit + integration | Unit: `gather-diagnostics.spec.ts` (6 getters called, in order) [EXISTS, fix LW-01 import]. Integration: F7 multi-error fixture -> `expect(codes).toEqual(expect.arrayContaining([2322, NG(8109)]))` AND a differential `defaultGatherDiagnostics` run returns `[2322]` only | unit EXISTS; integration Wave 0 |
| ENG-04 | Counts by category; `strictTemplates` honored; extended categories respected | integration | F5 (NG8101) -> `warningCount >= 1` (default WARNING); F6 promoted (`defaultCategory:"error"`) -> SAME code now in `errorCount`; invariant `errorCount + warningCount <= diagnostics.length` | Wave 0 |
| EXE-02 | Required single `tsConfig`; spec tsconfig checked | integration | `runTypecheck({tsConfigPath: <tsconfig.spec.json fixture>})` -> reports the planted spec-file error (proves specs are type-checked) | Wave 0 (`spec-tsconfig.integration.spec.ts`) |
| TEST-02 | REAL compiler, exact codes/counts, per-introduction-version organization | integration | `*.angularNN.integration.spec.ts` files; each fixture: `expect(codes).toContain(<exact>)` + `expect(result.errorCount).toBe(<n>)` | Wave 0 |
| D-01 | Explicit `errorCount`/`warningCount`; no public `codes`; invariant | integration | F5/F6 counts; assert `'codes' in result === false` (or TS type-level: `CoreResult` has no `codes`); `result.errorCount + result.warningCount <= result.diagnostics.length` | Wave 0 |
| D-02 | `diagnostics:false` suppresses "Time for diagnostics" Message | integration | A fixture tsconfig that sets `diagnostics: true` in `angularCompilerOptions`/compilerOptions -> `result.diagnostics` contains NO category-`Message` "Time for diagnostics" entry | Wave 0 (`no-emit-override.integration.spec.ts`) |
| D-03 / MD-01 | Config errors prepended; malformed tsconfig not silently clean | integration | `runTypecheck` against a malformed/nonexistent tsconfig -> `result.errorCount >= 1` (NOT `0`/success); `result.diagnostics` includes the `parsed.errors` entry | Wave 0 (`config-errors.integration.spec.ts`) |
| D-03 / D-03a | Zero-rootNames guard fires on solution-style | integration | `runTypecheck` against `{files:[],include:[],references:[...]}` fixture -> `result.rootNamesCount === 0` AND `result.errorCount === 1` AND the diagnostic message names a leaf tsconfig | Wave 0 |
| D-05 / L-1 | Override neutralizes the composite-triangle (TS5053/6304/6379) | integration | F8 composite-triangle fixture -> `codes` does NOT contain `5053`,`6304`,`6379`; the intended (or zero) diagnostics only | Wave 0 (`composite-triangle.integration.spec.ts`) |
| D-05a / V-2 | No emit written for clean fixture | integration | After `runTypecheck` on a CLEAN fixture, no emitted `.js`/`.d.ts` appears beside the fixture (assert via fs check) OR `result` is clean and the fixture dir is unchanged | Wave 0 (optional; lower priority) |
| D-06 / L-3 | Infra crash re-thrown, not counted | integration OR unit | Simulate a returned `UNKNOWN_ERROR_CODE` (e.g. via a fixture that forces an internal crash, or a focused unit test stubbing `performCompilation` to return a 500 diagnostic) -> `runTypecheck` THROWS; a normal type error does NOT throw | Wave 0 (`infra-failure.integration.spec.ts`) |
| LW-01 | gatherer spec imports from the shim | static/lint | `git grep -n "from '@angular/compiler-cli'" packages/angular-typechecker/src/core/gather-diagnostics.spec.ts` returns NOTHING (the barrel import is gone) | one-line fix |

### Sampling Rate
- **Per task commit:** quick run (fast specs) — `npx nx test angular-typechecker -- --exclude '**/*.integration.spec.ts'`. Sub-second; catches the unit-level gatherer-order + LW-01.
- **Per wave merge:** full suite — `npx nx build angular-typechecker && npx nx test angular-typechecker`. Runs the REAL-compiler integration tier + GATE A static + GATE B differential.
- **Phase gate:** full suite green before `/gsd:verify-work`; every row above asserted.

### Wave 0 Gaps (test infra to create before/with implementation)
- [ ] `fixtures/` new dirs + tsconfigs: ts-baseline (F2), ng-baseline (F3/F4), extended (F5/F6), composite-triangle (F8), solution-style, spec-tsconfig variant. (F1/F7 reuse `gate-b-error`.)
- [ ] `src/core/*.integration.spec.ts` (or a per-version split `*.angularNN.integration.spec.ts`) with the `NG()` helper + a shared `codesFor(tsConfigPath)` runner calling `runTypecheck`.
- [ ] `config-errors.integration.spec.ts` (D-03/MD-01) + solution-style guard assertion.
- [ ] `composite-triangle.integration.spec.ts` (D-05/L-1).
- [ ] `infra-failure` test (D-06) — decide integration fixture vs focused stub.
- [ ] LW-01 one-line import fix in `gather-diagnostics.spec.ts`.
- [ ] `gate-b.spec.ts` reconcile `result.codes` -> `result.diagnostics.map(d=>d.code)`.
- [ ] (Optional) `*.integration.spec.ts` naming convention + the `--exclude` quick-run wiring; no new Nx target required.

*Framework install: NONE — Vitest + `@nx/vitest:test` already configured (WS-03 complete).*

---

## Security Domain

> `security_enforcement` is enabled (absent in config = enabled). This is a non-network, no-emit, in-process type-check engine consuming the consumer's own tsconfig; the attack surface is minimal but documented.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | No access control surface |
| V5 Input Validation | yes (light) | The sole input is `tsConfigPath` (absolute) + the resolved tsconfig. `ng.readConfiguration` does the parsing; malformed/unreadable configs are RETURNED as diagnostics (D-03), never crash-leak. Do NOT `eval`/exec consumer config. |
| V6 Cryptography | no | None |
| V7 Error Handling & Logging | yes | D-06 re-throws infra errors with the compiler's `messageText` (may contain absolute paths/stack). Phase 2 returns it; do NOT log secrets/env. Path normalization for OUTPUT is Phase 3 (OUT-02) — Phase 2 keeps absolute `fileName` on `ts.Diagnostic` (correct for the structured contract). |
| V12 Files & Resources | yes (light) | Reads the consumer tsconfig + the `rootNames` source files via the compiler host. No writes (no-emit; V-2 ensures it). Fixtures are committed, trusted, out-of-graph. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Type-checker that LIES (false PASS on broken code) | Tampering / Repudiation of trust | D-03 (config errors not dropped — MD-01), D-03a (solution-style guard), D-06 (infra crash not counted as 0 errors). "A type-checker that lies is worse than none." This is the dominant correctness threat; the Validation Architecture rows D-03/D-06 are its gates. |
| Emit side-effects writing into the consumer tree | Tampering | D-05 full override + `noEmit:true` + `emitFlags:0` + `!hasErrors` gate (V-2) — no files written. |
| Masked ESM-load failure mistaken for a clean run | Tampering | D-06 / L-3: detect `code === 500` and re-throw (Phase-1 GATE B already asserts `not.toContain(500)`). |
| Path leakage in error messages | Information Disclosure (low) | Absolute paths are appropriate in the structured `ts.Diagnostic[]`; output relativization is Phase 3 (OUT-02), explicitly deferred. |

No new dependencies -> no supply-chain delta this phase (the s1ngularity/publish-hardening concerns are Phase 5).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ngc --noEmit` (or `defaultGatherDiagnostics`) phase short-circuit | Unconditional all-getter modeled on `@angular/build` | Phase-1 spike proved it | ENG-02 differentiator; surfaces template+extended diagnostics co-located with TS errors |
| Minimal `{...options, noEmit:true}` | Full emit-neutralizing override (D-05) | This phase | Survives Nx 23 TS-solution `composite/emitDeclarationOnly` bases without bogus TS5053 |
| `warningCount = total - errorCount` | Explicit `Warning`-category count (D-01) | This phase | Fixes MD-02 category conflation (Suggestion/Message no longer mis-counted) |
| Dropped `parsed.errors` | Prepend config errors + zero-rootNames guard (D-03) | This phase | Fixes MD-01 false-clean on malformed/solution-style configs |

**Deprecated/outdated:** none introduced. The `NgtscProgram` + `getDiagnosticsForFile(OptimizeFor.WholeProgram)` per-file path (the heavier `@angular/build` model) remains DEFERRED (REP-02) — Approach A (`performCompilation` + custom gatherer) is the v0.0.1 engine.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | NG code NAMES for F2-F6 (NG8001 unknown element, NG2003 missing token, etc.) match 22.0.4 exactly | Fixture Catalog | LOW — the catalog flags re-verification on implementation; codes 8101/8109/8021/10002 were re-confirmed in 22.0.4 this session; F3/F4's exact NG2003/NG8001 names should be re-grepped in `error_code.d.ts` when authoring (the differentiator codes are confirmed) |
| A2 | A consumer tsconfig with `diagnostics: true` reliably injects the "Time for diagnostics" Message that D-02 suppresses | Validation (D-02 row) | LOW — verified the code path exists (bundle :571-573); the D-02 fixture proves it; if the Message proves hard to trigger via tsconfig, assert D-02 by absence (no category-Message entry) which holds regardless |
| A3 | The `*.integration.spec.ts` filename convention + `--exclude` is sufficient for the unit/integration split without a second Nx target | Vitest Split | LOW — Claude's discretion per CONTEXT; if Vitest's `--exclude` proves awkward under `@nx/vitest:test`, fall back to a Vitest `workspace`/`projects` filter (no behavior change) |

*All other claims are `[VERIFIED]` against installed 22.0.4 / TS 6.0.3 or `[CITED]` to CONTEXT decision IDs.*

---

## Open Questions

1. **The `ATC1001` synthesized-code numeric value + namespace scheme.**
   - What we know: Claude's discretion (CONTEXT); must be category Error, `file: undefined`, message naming leaf tsconfigs, distinct from TS codes and the Angular `-99xxxx`/`500` space.
   - What's unclear: exact numeric (and whether to expose a small `ATC` enum for future synthesized codes).
   - Recommendation: pick a private positive integer clearly outside TS/NG ranges (e.g. `90001`) OR a string `code` if `ts.Diagnostic` tolerates it in the consumer's eyes; document it as an `angular-typechecker`-namespaced diagnostic. Defer any public enumeration to when a second synthesized code is needed.

2. **D-06 infra-failure test mechanism (real fixture vs focused stub).**
   - What we know: D-06 re-throws on returned `code === 500`; the exact throw type is Phase-4's concern (CONTEXT).
   - What's unclear: whether to force a genuine internal crash via a fixture (hard to make deterministic) or unit-stub `performCompilation` to return a 500 diagnostic.
   - Recommendation: a focused test that stubs the loaded namespace's `performCompilation` to return a single 500 diagnostic and asserts `runTypecheck` throws — deterministic, no fragile crash-inducing fixture. (This is a mocked test, which TEST-01 reserves for Phase 3, but the D-06 throw is a Phase-2 behavior; a single targeted stub here is justified and not the broad mock-coverage TEST-01 owns. Flag for planner to confirm scope.)

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@angular/compiler-cli` | the engine | yes | 22.0.4 (installed) | — |
| `typescript` | category counting | yes | 6.0.3 (installed) | — |
| `nx` / `@nx/vitest` | test runner | yes | 23.0.1 | — |
| `vitest` | test runner | yes | 4.1.9 | — |
| Node | runtime | yes | v24.18.0 (in-range `^24.15.0`) | — |
| External Angular clone | line-number citation reading only | yes (BUT `22.1.0-next.3`, not 22.0.4) | 22.1.0-next.3 | Use installed `node_modules/@angular/compiler-cli@22.0.4` `.d.ts`+bundles as authority |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** the external clone version mismatch (V-1/L-9) — fall back to the installed package for runtime-behavior authority.

---

## Sources

### Primary (HIGH confidence — verified this session)
- Installed `node_modules/@angular/compiler-cli@22.0.4` — `.d.ts` declarations (`perform_compile.d.ts`, `transformers/api.d.ts`, `ngtsc/diagnostics/src/error_code.d.ts`) + bundled JS (`bundles/chunk-6ZBSJK4S.js` performCompilation/defaultGatherDiagnostics/emit; `chunk-QY6RCOQ6.js` ngErrorCode/ErrorCode; `chunk-VBOLXMVC.js` oob NG10002 Suggestion; `chunk-33J3WRHI.js` NG8101 banana-in-box). The RUNTIME authority for the locked stack.
- Installed `node_modules/typescript@6.0.3` — `lib/typescript.js` TS5053 (10347), TS6304 (10703), TS6379 (10729), composite-validation block (~129653).
- External clone `D:/projects/github/angular/angular` (**22.1.0-next.3**) — `perform_compile.ts` (75/166/244-253/255-327/364), `ngtsc/program.ts` (60-90/82-84/282-300), `ngtsc/diagnostics/src/util.ts` (24-30), `error_code.ts` (447/496/586/724), `oob.ts` (264-265). Line-citation reference; version-flagged (V-1).
- Nx clone `D:/projects/github/nrwl/nx` — `packages/js/src/generators/init/files/ts-solution/tsconfig.base.json__tmpl__` (composite:true/declarationMap:true/emitDeclarationOnly:true — the D-05 triangle source).
- This repo: `02-CONTEXT.md` (D-01..D-07d), `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `PROJECT.md`, `01-CONTEXT.md` (D-16/D-17/D-18), `01-LEARNINGS.md`, `01-04-SUMMARY.md`, `DIAGNOSTIC-CATALOG.md`, `FOLLOWUP-FINDINGS.md`, `PITFALLS.md`; current `core/*.ts` + `*.spec.ts` + `fixtures/gate-b-error/*` + `vitest.config.mts` + `tsconfig.base.json`.

### Secondary (MEDIUM — cited, not independently re-fetched this session)
- TS5053 provenance: microsoft/TypeScript#36917, #32380 (CONTEXT). TS6304: ionic-team/stencil#2349, TypeStrong/ts-node#656 (CONTEXT).
- angular.dev/extended-diagnostics (DIAGNOSTIC-CATALOG, verified 2026-06-27 there).

### Tertiary (LOW)
- None requiring validation; no WebSearch was needed (this research is local-source-based and the citations resolved against installed packages).

---

## Metadata

**Confidence breakdown:**
- Source verification: HIGH — every load-bearing citation re-confirmed against installed 22.0.4 + TS 6.0.3; three flags (V-1/V-2/V-3) raised and resolved.
- Standard stack: HIGH — no new packages; all versions verified from `node_modules`/`package.json`.
- Architecture/signatures: HIGH — `runTypecheck` pipeline derived from verified APIs + locked decisions.
- Fixture catalog: MEDIUM-HIGH — differentiator codes (2322/2339/8101/8109/8021/10002) verified; F3/F4 exact NG names flagged for author-time re-grep (A1).
- Validation Architecture: HIGH — every requirement + decision mapped to an observable assertion.
- Landmines: HIGH — each verified against installed source.

**Research date:** 2026-06-27
**Valid until:** ~2026-07-27 (stable locked stack; re-check only if `@angular/compiler-cli`/`typescript`/`nx` pins change). The external-clone version drift (V-1) is the only moving part — it does not affect the locked runtime.
