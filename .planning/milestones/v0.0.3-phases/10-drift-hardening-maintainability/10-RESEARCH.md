# Phase 10: Drift-hardening & Maintainability - Research

**Researched:** 2026-06-29
**Domain:** TypeScript type-level drift assertions (vendored-subset guard) + Nx target wiring + Angular compiler-cli runtime introspection
**Confidence:** HIGH (every load-bearing claim empirically verified against the LIVE installed `@angular/compiler-cli@22.0.4` and `typescript@6.0.3` via prototype `tsc --noEmit` runs and a live `await import(...)` probe; throwaway probes removed)

## Summary

Phase 10 hardens the EXISTING vendored `compiler-cli-types.ts` shim against Angular-version drift. The five HARD requirements are all implementable as planned in `10-CONTEXT.md` (D-01..D-11) -- but this research surfaces THREE landmines that change the implementation shape and ONE factual correction to a locked-decision rationale, all proven by running the real compiler against prototype assertions:

1. **`getTsProgram()` CANNOT be a naive `real -> shim` per-member assertion (LANDMINE).** The real `api.Program.getTsProgram()` returns plain `ts.Program` (`api.d.ts:128`), but the shim widens its return to `TsProgram = ts.Program & { useCaseSensitiveFileNames() }`. A `real -> shim` whole-object probe FAILS on this member (TS2322, empirically reproduced) because the shim demands MORE than the real type provides. The per-member probe must handle `getTsProgram` SPECIALLY -- assert `ReturnType<real getTsProgram>` is assignable to `ts.Program`, not `real getTsProgram -> shim getTsProgram`.
2. **`replaceTsWithNgInErrors` is NOT exported at runtime (LANDMINE for HARD-05).** `index.d.ts:13/30` DECLARES it, but the runtime bundle does NOT expose it (`typeof cli.replaceTsWithNgInErrors === 'undefined'`, verified). The HARD-05 spec MUST go through `cli.formatDiagnostics` (which calls the rewrite internally) -- it cannot call `replaceTsWithNgInErrors` directly, and a `ts.formatDiagnostics` fake does NOT rewrite (leaks `TS-998109`). The existing `renderReport` seam loads the real `cli.formatDiagnostics` and is the ideal vehicle.
3. **`emitFlags: 0` does NOT type-check by bare assignment (CORRECTION to D-08 rationale).** D-08 claims "numeric-enum looseness makes `0` assignable to the `EmitFlags` type even without a `None` member." This is FALSE at tsc 6.0.3: `const x: EmitFlags = 0` ERRORS (TS2322). The call site survives ONLY because it uses an explicit CAST (`emitFlags: 0 as EmitFlags`, `run-typecheck.ts:229`). The cast is load-bearing and must stay; the literal `0` remains semantically correct under `noEmit: true`. The OUTCOME D-08 wants (keep `emitFlags: 0`) is fine -- only the stated reason is wrong.

**Primary recommendation:** Implement HARD-01 as a per-member tuple of `real -> shim` `AssertAssignable` pairs for the 6 DIAGNOSTIC getters, a special `getTsProgram -> ts.Program` ReturnType probe, call-site probes at the gatherer's exact arities (defends the proven optional->required silent gap), value-level `UNKNOWN_ERROR_CODE`/`EmitFlags`-member assertions, in `compiler-cli-types.drift.ts` compiled by a `tsconfig.drift.json` (extends `tsconfig.base.json`, classic `module:commonjs` + `moduleResolution:node` + `ignoreDeprecations:"6.0"`, `noEmit`, `include` only the drift file), run by a `typecheck-drift` `nx:run-commands` target wired into `ci.yml`. The runtime getter-set/encoding spec asserts the 7 frozen gathered-getter names are present as functions on the live `NgtscProgram` (subset containment, not prototype equality) + the encoding round-trip. Exclude `*.drift.ts` from `tsconfig.lib.json` and `tsconfig.spec.json`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Build-time drift type-gate (HARD-01) | Build/CI (standalone `tsc --noEmit`) | -- | A type-only assertion; erased at emit; runs as its OWN target under classic-node resolution that the production `nodenext` build cannot use |
| Runtime getter-set + encoding spec (HARD-01 additions blind-spot, D-04) | Test (Vitest integration tier) | CORE (imports `diagnostic-codes.ts`) | Must `await import('@angular/compiler-cli')` -- the executor's real load path; only the test tier touches the real ESM compiler |
| `EmitFlags` correction (HARD-02) | CORE (`compiler-cli-types.ts` shim) | Build-time drift gate (value-level assertion) | Pure type declaration; the call site at `run-typecheck.ts:229` consumes it via cast |
| Vendor markers (HARD-03) | CORE (`compiler-cli-types.ts` comments) | -- | Source-comment hygiene; greppable maintainability marker |
| Retained `getNgStructuralDiagnostics` (HARD-04) | CORE (`gather-diagnostics.ts`) | Build-time gate + runtime spec | A documenting comment + ensuring the getter is in the asserted set (already is) |
| TS-99 leak regression (HARD-05) | Test (integration tier) | CORE (`render-report.ts`/`format-report.ts` exercised) | Must run the REAL `cli.formatDiagnostics` rewrite -- a unit fake would not exercise `replaceTsWithNgInErrors` |

## User Constraints (from CONTEXT.md / locked decisions)

> Copied from `10-CONTEXT.md`. These are SETTLED. Research makes them executable; it does not re-open them.

### Locked Decisions (D-01..D-11)
- **D-01 (HARD-01 SCOPE):** `real -> shim` assignability ProbeOnly type-gate. Catches REMOVED/renamed/signature-changed getters loudly. A newly-ADDED upstream getter is intentionally NOT a build failure (deliberate subset). Exhaustiveness/`Exclude<keyof>` REJECTED.
- **D-02 (HARD-01 CONSTRUCTION):** Hand-written shim is the FIXED spec; the real type is checked AGAINST it. Per-member TUPLE OF PAIRS (one assertion per called getter), not a single whole-object assignment. `Pick`-derivation REJECTED (auto-tracks upstream; mechanically unavailable under nodenext).
- **D-03 (HARD-01 TOOLING):** PlainTS `type AssertAssignable<From, To extends From> = true;` helper. ZERO new dev dependency. `expect-type` not added; `tsd` rejected.
- **D-04 (ADDITIONS + RUNTIME-DRIFT control):** A runtime Vitest spec against the REAL `await import('@angular/compiler-cli')` asserts (a) the `api.Program` getter set equals a frozen expected set; (b) the encoding mirror `NG(8001) === ngErrorCode(8001)` round-trip and `UNKNOWN_ERROR_CODE === 500`. api-extractor REJECTED.
- **D-05 (type-system traps):** optional->required param change is SILENT under assignability -> add call-site probes at the gatherer's exact arities; `getGlobalDiagnostics` lives on `ts.Program` not `api.Program` -> cover with a call-site probe `real.getTsProgram().getGlobalDiagnostics()`; returns stay `readonly`; value-level constants need their own assertions.
- **D-06 (WIRING):** Drift file at `src/core/compiler-cli-types.drift.ts`; `tsconfig.drift.json` classic `module` + `moduleResolution: node`, `noEmit`, `include` ONLY the drift file, extends `tsconfig.base.json`; exclude `*.drift.ts` from `tsconfig.lib.json`; `typecheck-drift` via `nx:run-commands` running `tsc --noEmit -p .../tsconfig.drift.json`; add to `ci.yml`, OS-independent.
- **D-07 (REQUIREMENT-WORDING FIX):** HARD-01 acceptance text is internally contradictory ("new OR removed breaks the build" vs "real->shim only"). The planner applies the minimal correction (see Phase Requirements below) under the code-review gate.
- **D-08 (HARD-02):** Mirror the real `EmitFlags` members (DTS=1, JS=2, Metadata=4, I18nBundle=8, Codegen=16, Default=19, All=31); drop the fabricated `None`; keep `emitFlags: 0` as a documented literal; add a value-level drift assertion for the members.
- **D-09 (HARD-03):** Add the greppable `// angular-typechecker: vendored -- <reason>` marker to each distinct narrowed/fabricated construct.
- **D-10 (HARD-04):** KEEP `getNgStructuralDiagnostics()` in the gatherer, documented as forward-compatible no-op-tolerant; ensure it is in the asserted set.
- **D-11 (HARD-05):** Integration-tier spec using the REAL compiler-cli `formatDiagnostics`; feed a real NG8xxx fixture's diagnostics through `formatReport(..., { color: false })` and assert output CONTAINS `NG####` and contains NO `TS-99`.

### Claude's Discretion
- Exact tuple/helper structure in the drift file; whether call-site probes sit in the same drift file or a sibling; the precise representation of the frozen getter set in the runtime spec (array of names vs typed tuple).
- Fixture mechanics for the HARD-05 NG8xxx integration fixture and the HARD-02 `EmitFlags` assertion.
- Whether `typecheck-drift` is a standalone CI step or folded into the existing `nx run-many`.
- Exact marker-comment wording per construct (must contain the literal `angular-typechecker: vendored` token).

### Deferred Ideas (OUT OF SCOPE)
- AlsoAdditions / `Exclude<keyof>` exhaustiveness in the type-gate (rejected).
- `@microsoft/api-extractor` `.api.md` report-diff (rejected as scope-creep).
- `expect-type` as a type-testing dev dependency (not adopted now).
- `Pick<api.Program, ...>`-derived shim (rejected).
- `NgtscProgram` migration / incremental / `--watch` (out of milestone, PROJECT.md).

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **CORE is framework-agnostic and PURE.** ESLint bans `@nx/*` / `@angular-devkit/*` imports AND `process.exit` in `**/src/core/**`. The drift file is type-only (erased at emit, never shipped). The runtime spec is a TEST -- it may `await import('@angular/compiler-cli')` like the integration tier.
- **`git grep` first, then `rg`.** The HARD-03 enumeration grep is `git grep "angular-typechecker: vendored"`.
- **Published plugin is policed by `@nx/dependency-checks`.** D-03's PlainTS-over-`expect-type` keeps the published manifest free of an unnecessary devDep. Do NOT add a new dependency for HARD-01.
- **AGENTS.md / REQUIREMENTS wording changes need code review.** D-07's HARD-01 wording fix is satisfied by the phase's `code_review_gate`.
- **No emojis / no non-ASCII** in any source, comment, or output (CLAUDE.md). ESC chars in specs are built via `String.fromCharCode(0x1b)`.
- **Commit scopes:** prefer `core`/`build`/`ci` scopes; internal plan-id scopes leak into the public changelog.
- **TypeScript LSP diagnostics are NOT authoritative** -- the `tsc --noEmit -p tsconfig.drift.json` run is the ground truth for HARD-01, not the editor feed.

## Phase Requirements

| ID | Description (D-07-corrected where noted) | Research Support |
|----|-------------|------------------|
| HARD-01 | A build-time `tsconfig.drift.json` (classic `moduleResolution: node`) type-checked in CI as its own `typecheck-drift` target FAILS when a REMOVED, renamed, or signature-changed diagnostic getter (among the getters we call) stops the real `api.Program` being assignable to the shim; newly-ADDED upstream getters are intentionally NOT a build failure and are surfaced instead by the runtime getter-set spec; the NG error-code encoding (`ngErrorCode`) + `UNKNOWN_ERROR_CODE` literal are mirrored. **[D-07 wording fix applied here -- code-review gate covers it.]** | Per-member probe shape proven (all 6 diag getters pass `real -> shim`); `getTsProgram` special-cased (`ReturnType -> ts.Program`); tripwire FIRES on missing getter (TS2339) and signature change at call site (TS2554); classic-node resolves the real barrel (verified); nodenext resolves it EMPTY (verified, TS2305). |
| HARD-02 | The fabricated `EmitFlags.None = 0` is corrected against the real enum; `emitFlags: 0` retained as a documented literal (safe under `noEmit: true`). | Real `EmitFlags` has NO `None` (verified `'None' in cli.EmitFlags === false`); members DTS=1...All=31 verified; `0 as EmitFlags` cast type-checks (verified); bare `: EmitFlags = 0` does NOT (TS2322 -- corrects D-08 rationale). |
| HARD-03 | Every divergence in the vendored surface carries a greppable `// angular-typechecker: vendored -- <reason>` marker. | 6 distinct constructs enumerated below; existing idiom at `diagnostic-codes.ts:56` verified (1 marker exists today). |
| HARD-04 | `getNgStructuralDiagnostics()` retained, documented as forward-compatible no-op-tolerant, covered by the HARD-01 assertion. | Present at `gather-diagnostics.ts:66`; in the per-member probe set; already exercised by `gather-diagnostics.spec.ts:53`. |
| HARD-05 | A regression spec asserts no `TS-99` substring survives the `color: false` output path. | Real `cli.formatDiagnostics` rewrites `TS-998109 -> NG8109` (verified); `ts.formatDiagnostics` does NOT (leaks `TS-998109`); `replaceTsWithNgInErrors` NOT exported at runtime (verified); `renderReport`/`extended-promoted` fixture is the integration vehicle. |

## Standard Stack

No new packages. This phase uses only what is already installed.

| Tool | Version (verified) | Purpose | Notes |
|------|--------------------|---------|-------|
| `typescript` | 6.0.3 | Compiles the drift assertion (`tsc --noEmit`) | Workspace `node_modules/.bin/tsc`; `require('typescript').version === '6.0.3'` confirmed |
| `@angular/compiler-cli` | 22.0.4 | The real `api.Program` / `EmitFlags` / `ngErrorCode` the drift file + runtime spec assert against | `package.json` is `type: module`, `exports['.'].default === './bundles/index.js`, `types === './index.d.ts'` -- the exports map is why nodenext resolves empty |
| `vitest` | 4.x | Runs the runtime getter-set spec + HARD-05 spec | Existing `@nx/vitest:test` target |
| `nx` | 23.0.1 | `nx:run-commands` for the `typecheck-drift` target | Built-in executor; no package add |

**Installation:** none. (D-03: zero new dev dependency.)

## Package Legitimacy Audit

Not applicable -- this phase installs NO external packages. All tooling (`typescript`, `@angular/compiler-cli`, `vitest`, `nx`) is already present and policed by `@nx/dependency-checks`. The `nx:run-commands` executor ships with `nx` core.

## Architecture Patterns

### Data flow (HARD-01 two-pronged guard)

```
                 Angular upgrade changes api.Program / EmitFlags / ngErrorCode
                                          |
              +---------------------------+---------------------------+
              |                                                       |
   BUILD-TIME (type) gate                                  RUNTIME (value) gate
   tsconfig.drift.json                                     *.runtime.spec.ts
   (classic node10 resolution                             (await import real
    -> real barrel RESOLVES)                                compiler-cli)
              |                                                       |
   compiler-cli-types.drift.ts                            enumerate live NgtscProgram
   - per-member AssertAssignable (6 diag getters)         prototype getters
   - getTsProgram -> ts.Program ReturnType probe          - 7 frozen names present? (subset
   - call-site probes (arity defends optional->required)    containment -> renamed/removed FAILS)
   - value-level UNKNOWN_ERROR_CODE: 500                   - new get*Diagnostics? -> flag review
   - value-level EmitFlags member pins                     - NG(n) === ngErrorCode(n) round-trip
              |                                            - UNKNOWN_ERROR_CODE === 500
   removed/renamed/sig-changed getter -> tsc EXIT 2                  |
   (typecheck-drift target FAILS ci.yml)                  drift -> vitest assertion FAILS

       (BUILD gate catches removal/rename/sig-change;     RUNTIME gate catches ADDITION
        cannot catch ADDITION -- deliberate subset)        + runtime-semantic encoding drift)
```

The two gates are complementary: the type gate cannot see additions (TS width subtyping), the runtime gate covers them; the type gate cannot see arithmetic/encoding drift (`ngErrorCode` is a runtime function), the runtime gate covers it.

### Recommended file layout

```
packages/angular-typechecker/
  tsconfig.drift.json                      # NEW: classic-node drift tsconfig (extends tsconfig.base.json)
  project.json                             # EDIT: add typecheck-drift nx:run-commands target
  src/core/
    compiler-cli-types.ts                  # EDIT: HARD-02 EmitFlags fix + HARD-03 vendor markers
    compiler-cli-types.drift.ts            # NEW: HARD-01 type assertions (type-only, excluded from lib + spec)
    gather-diagnostics.ts                  # EDIT: HARD-04 documenting comment on getNgStructuralDiagnostics
    compiler-cli-types.runtime.spec.ts     # NEW: HARD-01 D-04 runtime getter-set + encoding spec
    <ng8xxx>.ts99-leak.integration.spec.ts # NEW (or extend render-report.spec.ts): HARD-05 regression
```

### Pattern 1: The per-member `AssertAssignable` tuple (HARD-01, VERIFIED)

```typescript
// Source: empirically compiled clean against @angular/compiler-cli@22.0.4 under
// tsconfig with module:commonjs + moduleResolution:node + ignoreDeprecations:"6.0".
import type { Program as RealProgram } from '@angular/compiler-cli';
import type { Program as ShimProgram } from './compiler-cli-types';
import type * as ts from 'typescript';

// D-03: the PlainTS helper. From extends To is the assignability constraint.
type AssertAssignable<From, To extends From> = true;

// D-02: the 6 DIAGNOSTIC getters, one real->shim pair each. A removed/renamed/
// return-changed getter errors at the precise tuple slot.
type DiagnosticGetterProbe = [
  AssertAssignable<RealProgram['getTsOptionDiagnostics'], ShimProgram['getTsOptionDiagnostics']>,
  AssertAssignable<RealProgram['getNgOptionDiagnostics'], ShimProgram['getNgOptionDiagnostics']>,
  AssertAssignable<RealProgram['getTsSyntacticDiagnostics'], ShimProgram['getTsSyntacticDiagnostics']>,
  AssertAssignable<RealProgram['getTsSemanticDiagnostics'], ShimProgram['getTsSemanticDiagnostics']>,
  AssertAssignable<RealProgram['getNgStructuralDiagnostics'], ShimProgram['getNgStructuralDiagnostics']>, // HARD-04
  AssertAssignable<RealProgram['getNgSemanticDiagnostics'], ShimProgram['getNgSemanticDiagnostics']>,
];

// LANDMINE: getTsProgram CANNOT be a real->shim member assertion. The real returns
// plain ts.Program; the shim widens to TsProgram = ts.Program & {useCaseSensitiveFileNames}.
// real->shim FAILS (TS2322 verified) because the shim demands MORE. Assert the real
// return is assignable to ts.Program instead (the shim's own base).
type GetTsProgramProbe = AssertAssignable<ReturnType<RealProgram['getTsProgram']>, ts.Program>;

void (0 as unknown as DiagnosticGetterProbe);
void (0 as unknown as GetTsProgramProbe);
```

### Pattern 2: Call-site probes (D-05 optional->required defense, VERIFIED load-bearing)

```typescript
// Source: empirically verified the per-member probe stays GREEN on optional->required
// but a no-arg call-site errors TS2554 ("Expected 1 arguments, but got 0").
declare const real: RealProgram; // type-only; never constructed.

function _callSiteProbes(): void {
  const _a: readonly ts.Diagnostic[] = real.getTsOptionDiagnostics();
  const _b: readonly ts.Diagnostic[] = real.getNgOptionDiagnostics();
  const _c: readonly ts.Diagnostic[] = real.getTsSyntacticDiagnostics();
  const _d: readonly ts.Diagnostic[] = real.getTsSemanticDiagnostics();
  const _e: readonly ts.Diagnostic[] = real.getNgStructuralDiagnostics();
  // BOTH arities the gatherer uses (gather-diagnostics.ts:69 no-arg, :77 with fileName):
  const _f: readonly ts.Diagnostic[] = real.getNgSemanticDiagnostics();
  const _g: readonly ts.Diagnostic[] = real.getNgSemanticDiagnostics('x.ts');
  // D-05: getGlobalDiagnostics lives on ts.Program (COR-02 reach-through, gather-diagnostics.ts:80):
  const _h: readonly ts.Diagnostic[] = real.getTsProgram().getGlobalDiagnostics();
  void _a; void _b; void _c; void _d; void _e; void _f; void _g; void _h;
}
```

### Pattern 3: Value-level constant + EmitFlags assertions (HARD-01 + HARD-02, VERIFIED)

```typescript
import { EmitFlags as RealEmitFlags, UNKNOWN_ERROR_CODE as RealUnknown } from '@angular/compiler-cli';

// UNKNOWN_ERROR_CODE must be exactly 500 (the literal the shim hard-codes + the
// infra-failure detector at run-typecheck.ts:238 compares against).
const _unknown: 500 = RealUnknown;

// HARD-02: each EmitFlags member pinned to its real numeric. A renumbered enum errors.
const _dts: RealEmitFlags.DTS = 1;
const _js: RealEmitFlags.JS = 2;
const _meta: RealEmitFlags.Metadata = 4;
const _i18n: RealEmitFlags.I18nBundle = 8;
const _codegen: RealEmitFlags.Codegen = 16;
const _default: RealEmitFlags.Default = 19;
const _all: RealEmitFlags.All = 31;
void _unknown; void _dts; void _js; void _meta; void _i18n; void _codegen; void _default; void _all;
```

### Pattern 4: Runtime getter-set spec (HARD-01 additions blind-spot, D-04, VERIFIED)

```typescript
// Source: live `await import('@angular/compiler-cli')` probe against a real
// NgtscProgram built from fixtures/ng-baseline. The instance constructor is
// "NgtscProgram"; the gathered getters and getGlobalDiagnostics all resolve.
import { describe, expect, it } from 'vitest';
import { NG, ngCodeOf } from './diagnostic-codes';

// The FROZEN set of getters gather-diagnostics.ts CALLS on api.Program.
const GATHERED_GETTERS = [
  'getTsProgram',
  'getTsOptionDiagnostics',
  'getNgOptionDiagnostics',
  'getTsSyntacticDiagnostics',
  'getTsSemanticDiagnostics',
  'getNgStructuralDiagnostics',
  'getNgSemanticDiagnostics',
] as const;

it('every gathered getter is present as a function on the real NgtscProgram (renamed/removed -> loud)', async () => {
  const cli = await import('@angular/compiler-cli');
  const parsed = cli.readConfiguration(NG_BASELINE_TSCONFIG, { suppressOutputPathCheck: true });
  const { program } = cli.performCompilation({
    rootNames: parsed.rootNames,
    options: { ...parsed.options, noEmit: true },
    emitFlags: 0,
    gatherDiagnostics: () => [],
  });
  // SUBSET containment, NOT prototype equality: the runtime prototype has MORE
  // methods than api.Program declares (emitXi18n, getApiDocumentation,
  // getEmittedSourceFiles, getIndexedComponents, getReuseTsProgram are runtime-only).
  for (const name of GATHERED_GETTERS) {
    expect(typeof (program as any)[name]).toBe('function');
  }
  expect(typeof program.getTsProgram().getGlobalDiagnostics).toBe('function'); // COR-02 reach-through
});

it('flags any NEW diagnostic getter for review (additions blind-spot the type gate cannot see)', async () => {
  const cli = await import('@angular/compiler-cli');
  const { program } = /* build as above */;
  const proto = Object.getPrototypeOf(program);
  const runtimeDiagGetters = Object.getOwnPropertyNames(proto)
    .filter((n) => n !== 'constructor' && typeof (program as any)[n] === 'function')
    .filter((n) => /^get.*Diagnostics$/.test(n) || n === 'getTsProgram');
  const added = runtimeDiagGetters.filter((n) => !GATHERED_GETTERS.includes(n as any));
  // Verified empty at 22.0.4. A non-empty `added` is the "do we now miss diagnostics?" signal.
  expect(added).toEqual([]);
});

it('mirrors the NG encoding (runtime-semantic drift the type gate cannot catch)', async () => {
  const cli = await import('@angular/compiler-cli');
  expect(NG(8001)).toBe(cli.ngErrorCode(8001));   // -998001
  expect(NG(8109)).toBe(cli.ngErrorCode(8109));   // -998109
  expect(NG(3004)).toBe(cli.ngErrorCode(3004));   // -993004 (RES-02 TCB fatal)
  expect(ngCodeOf(cli.ngErrorCode(8109))).toBe(8109);
  expect(cli.UNKNOWN_ERROR_CODE).toBe(500);
});
```

### Pattern 5: HARD-05 TS-99 leak regression (VERIFIED real-vs-fake behavior)

```typescript
// Source: live probe -- cli.formatDiagnostics([{code: ngErrorCode(8109)}], host)
// returns "...NG8109..." (no TS-99); ts.formatDiagnostics returns "TS-998109..." (LEAKS).
// replaceTsWithNgInErrors is NOT exported at runtime; the rewrite happens INSIDE
// cli.formatDiagnostics. renderReport loads the real cli.formatDiagnostics.
import { runTypecheck } from './run-typecheck';
import { renderReport } from './render-report';
import { NG } from './diagnostic-codes';

it('no TS-99 substring survives the color:false output path (HARD-05)', async () => {
  // Reuse the extended-promoted fixture (NG8101 as Error) -- a REAL NG8xxx producer.
  const result = await runTypecheck({ tsConfigPath: EXTENDED_PROMOTED_TSCONFIG });
  expect(result.diagnostics.some((d) => d.code === NG(8101))).toBe(true); // sanity: NG8xxx present
  const out = await renderReport({ diagnostics: result.diagnostics }, { color: false });
  expect(out).toMatch(/NG\d{4}/);     // positive: an NG#### label rendered
  expect(out).not.toContain('TS-99'); // negative: no raw un-rewritten negative NG code
});
```

### Anti-Patterns to Avoid

- **Do NOT include `getTsProgram` as a naive `real -> shim` member in the assignability tuple.** It FAILS (TS2322) because the shim's `TsProgram` is wider. Special-case it with `ReturnType<...> -> ts.Program`. (Empirically reproduced.)
- **Do NOT write the HARD-05 spec against `ts.formatDiagnostics` or a `vi.fn` fake.** Those do NOT run `replaceTsWithNgInErrors`; the test would pass vacuously while leaking `TS-998109` in production. Use the real `cli.formatDiagnostics` via `renderReport`.
- **Do NOT call `cli.replaceTsWithNgInErrors` directly in the spec.** It is `undefined` at runtime despite the `.d.ts` declaration. Go through `formatDiagnostics`.
- **Do NOT assert "runtime prototype methods === api.Program getter set" (equality).** The real `NgtscProgram` prototype has runtime-only extras (`emitXi18n`, `getApiDocumentation`, etc.). Use SUBSET containment for the loud removal check and a filtered diff for the additions-review check.
- **Do NOT compile the drift file under `nodenext` / include it in `tsconfig.lib.json` or `tsconfig.spec.json`.** Under nodenext the real barrel resolves EMPTY (TS2305 verified) -- the drift file would break `nx build` and `nx test`. It compiles ONLY under the classic-node `tsconfig.drift.json`.
- **Do NOT change `emitFlags: 0 as EmitFlags` to bare `emitFlags: 0`.** The cast is load-bearing -- bare assignment errors TS2322 against the corrected enum (the cast is what makes `0` acceptable; the literal value is semantically "emit nothing" under `noEmit`).
- **Do NOT use `@nx/js:tsc` for the drift check.** It is a build (emits, expects multi-file lib layout); the drift check emits nothing and needs distinct classic-node resolution. Use `nx:run-commands` running `tsc --noEmit`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type-drift assertion | A custom type-comparison library or `expect-type`/`tsd` | One-line `type AssertAssignable<From, To extends From> = true;` + tuple | D-03: at ~7 one-shot assertions a library earns nothing and adds a `@nx/dependency-checks`-policed devDep; `tsd` would even run under TS 5.9 (wrong compiler) |
| NG-code encoding mirror | Re-deriving `parseInt('-99' + code)` in the spec | Import `NG` / `ngCodeOf` from `diagnostic-codes.ts` | Already dependency-free, production-importable, and the canonical encoding; D-04 pins it against the real `ngErrorCode` |
| TS-99 -> NG rewrite | Re-implementing `replaceTsWithNgInErrors` | The real `cli.formatDiagnostics` via `renderReport` | The rewrite is Angular's; reimplementing it would test our copy, not the real path (and `replaceTsWithNgInErrors` is not even exported) |
| Drift CI runner | A bash/node script invoking tsc | `nx:run-commands` target + `ci.yml` step | Nx-native, cacheable, OS-independent, consistent with the existing `test`/`e2e` targets |

**Key insight:** The vendored SUBSET is the unusual choice (forced by the nodenext empty-resolution problem); the Angular ecosystem (`@angular/build`, AnalogJS) uses the real types directly with no shim and no drift guard. That is precisely WHY angular-typechecker needs an explicit guard the real consumers do not -- but the guard itself should be as minimal as the shim (PlainTS, no new tooling).

## Common Pitfalls

### Pitfall 1: `getTsProgram` whole-object assignability failure
**What goes wrong:** A naive whole-object `const _: ShimProgram = realProgram` (or a `getTsProgram` member pair) fails the build with TS2322 even on a clean Angular 22.0.4.
**Why it happens:** The shim deliberately widened `getTsProgram()`'s return to `ts.Program & { useCaseSensitiveFileNames() }` (the runtime exposes it; the public `ts.Program` type does not). `real -> shim` requires the real to satisfy the shim's WIDER demand, which it cannot.
**How to avoid:** Per-member tuple for the 6 diagnostic getters; a separate `ReturnType<RealProgram['getTsProgram']> -> ts.Program` probe for `getTsProgram`. (D-02's per-member design already implies this -- this research makes the special case explicit.)
**Warning signs:** TS2322 mentioning `useCaseSensitiveFileNames` is missing.

### Pitfall 2: HARD-05 spec passes but production leaks TS-99
**What goes wrong:** A spec built on `ts.formatDiagnostics` or a `vi.fn` fake passes (no rewrite needed) while production output via `cli.formatDiagnostics` is what matters.
**Why it happens:** Only `cli.formatDiagnostics` runs `replaceTsWithNgInErrors`; the negative code renders as `TS-998101` until rewritten to `NG8101`.
**How to avoid:** Exercise the real `cli.formatDiagnostics` (via `renderReport` or `loadCompilerCli`).
**Warning signs:** The spec uses `ts.formatDiagnostics` or `realNg = { formatDiagnostics: ts.formatDiagnostics }` (note: `format-report.spec.ts:62` does exactly this for OTHER assertions -- do not copy it for the TS-99 assertion).

### Pitfall 3: Drift file breaks the production build
**What goes wrong:** `nx build` or `nx test` fails with TS2305 ("no exported member 'Program'").
**Why it happens:** The drift file's `import { Program } from '@angular/compiler-cli'` resolves EMPTY under the production `nodenext` mode (the exact reason the shim exists).
**How to avoid:** Exclude `src/**/*.drift.ts` from BOTH `tsconfig.lib.json` (already excludes `*.spec.ts`/`*.test.ts` -- add `*.drift.ts`) AND `tsconfig.spec.json` (so Vitest's typecheck and the test build do not pick it up). It compiles ONLY under `tsconfig.drift.json`.
**Warning signs:** TS2305 on `@angular/compiler-cli` named imports during `nx build`/`nx test`.

### Pitfall 4: `ignoreDeprecations` missing on the drift tsconfig
**What goes wrong:** `tsc -p tsconfig.drift.json` errors TS5107 ("Option 'moduleResolution=node10' is deprecated ... Specify 'ignoreDeprecations': '6.0'").
**Why it happens:** TS 6.0 treats classic `moduleResolution: node` (node10) as a deprecation error by default.
**How to avoid:** Set `"ignoreDeprecations": "6.0"` in `tsconfig.drift.json` (the production `tsconfig.json:7` already does this; the base does NOT). Verified: adding it yields a clean compile.
**Warning signs:** TS5107 as the only error.

## Code Examples

### tsconfig.drift.json (VERIFIED to resolve the real barrel + compile the assertions clean)

```json
// Source: prototype compiled clean against @angular/compiler-cli@22.0.4 / TS 6.0.3.
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "ignoreDeprecations": "6.0",
    "noEmit": true,
    "declaration": false,
    "types": ["node"],
    "skipLibCheck": true
  },
  "files": ["src/core/compiler-cli-types.drift.ts"]
}
```

Notes: `tsconfig.base.json` already sets `moduleResolution: node` but `module: esnext` -- override `module` to `commonjs` (classic node10 resolution; either `commonjs` or `node16`-less classic works, the load-bearing key is `moduleResolution: node`). `skipLibCheck: true` keeps the run fast and scoped to the assertion file. Use `files` (not `include`) to pin EXACTLY the drift file (D-06: "include only the drift file").

### typecheck-drift target in project.json

```json
// Add alongside build/lint/test. Source: nx:run-commands is built into nx 23.0.1.
"typecheck-drift": {
  "executor": "nx:run-commands",
  "cache": true,
  "inputs": [
    "{projectRoot}/src/core/compiler-cli-types.drift.ts",
    "{projectRoot}/src/core/compiler-cli-types.ts",
    "{projectRoot}/tsconfig.drift.json",
    "{workspaceRoot}/tsconfig.base.json",
    "{workspaceRoot}/node_modules/@angular/compiler-cli/index.d.ts",
    "{workspaceRoot}/node_modules/@angular/compiler-cli/src/transformers/api.d.ts"
  ],
  "options": {
    "command": "tsc --noEmit -p packages/angular-typechecker/tsconfig.drift.json",
    "cwd": "."
  }
}
```

Notes: `tsc` resolves from the workspace `node_modules/.bin/tsc` (TS 6.0.3) when run via `nx:run-commands` (which prepends `node_modules/.bin` to PATH). `cache: true` with the listed `inputs` makes the target skip when neither the shim, the drift file, nor the installed compiler-cli typings changed -- a re-install/upgrade of `@angular/compiler-cli` invalidates the cache (its `index.d.ts`/`api.d.ts` are inputs), which is exactly the drift trigger. `outputs` omitted (no emit). No `outputs` -> Nx treats it as a check.

### ci.yml wiring (Claude's discretion -- two options)

The current `test` job runs `npx nx run-many -t test -p angular-typechecker`. Two OS-independent options:

```yaml
# Option A (lean, recommended): add typecheck-drift to the run-many target list so it
# runs in the same job (caches per the inputs above; runs once even across the matrix
# since the matrix re-runs it per cell -- acceptable, it is fast and cached).
- run: npx nx run-many -t typecheck-drift test -p angular-typechecker
```

```yaml
# Option B (dedicated lean step in a single-cell job, if matrix re-runs are unwanted):
# a new ubuntu-only job (OS-independent: depends only on the installed compiler-cli)
# gated on needs.changes.outputs.code != 'false', added to the `ci` aggregate `needs`.
typecheck-drift:
  needs: changes
  if: ${{ needs.changes.outputs.code != 'false' }}
  runs-on: ubuntu-latest
  env: { NX_DAEMON: false }
  steps:
    - uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5.0.1
      with: { persist-credentials: false }
    - uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5.0.0
      with: { node-version: 24, cache: npm }
    - run: npm ci
    - run: npx nx run typecheck-drift -p angular-typechecker
```

**Recommendation:** Option A (fold into the existing `run-many`). It is the minimal-surface change, stays inside the existing path-gated `test` job, and the matrix re-runs are cheap+cached. If Option B is chosen, the new job MUST be added to the `ci` aggregate's `needs: [...]` list and follow the SHA-pinned-action / `persist-credentials: false` / `NX_DAEMON: false` conventions exactly (see `ci.yml` threat model). Either way it is OS-independent (depends only on the installed `@angular/compiler-cli` typings).

### HARD-03 vendor-marker enumeration (the 6 constructs needing the marker)

From `compiler-cli-types.ts` (existing idiom: `diagnostic-codes.ts:56` `// angular-typechecker: vendored -- <reason>`):

| # | Construct | Lines | Divergence (the `<reason>`) |
|---|-----------|-------|------------------------------|
| 1 | `TsProgram` intersection | :45-47 | Adds synthetic `useCaseSensitiveFileNames()` not on the public `ts.Program` (runtime exposes it) |
| 2 | `Program` subset interface | :57-80 | Declares ONLY the 7 getters the gatherer calls -- a deliberate subset of the real `api.Program` |
| 3 | `EmitFlags` enum | :89-91 (HARD-02 rewrites to :real members) | After HARD-02: mirrors the real members (DTS=1..All=31); the divergence is "no `loadNgStructureAsync`/`emit`/etc. -- only what `performCompilation` accepts as `emitFlags`" |
| 4 | `UNKNOWN_ERROR_CODE` literal | :100 | Hand-declared `= 500` instead of importing the real const (ESM-only) |
| 5 | `PerformCompilationResult.program` non-optional | :143-146 | Real types it OPTIONAL (`perform_compile.d.ts:29` `program?`); narrowed non-optional to match the engine's guarded usage |
| 6 | `ParsedConfiguration` subset | :109-116 | Subset of the real (`perform_compile.d.ts:14-21`); `options` adds `{ basePath?: string }` |

A single `git grep "angular-typechecker: vendored"` must enumerate all 6 (plus the existing 1 in `diagnostic-codes.ts`). Marker wording per construct is Claude's discretion (must contain the literal token).

## Runtime State Inventory

Not applicable -- Phase 10 is a pure code/config/test phase (new drift file, new tsconfig, a project.json target, source comments, two new specs). There is no stored data, live-service config, OS-registered state, secrets, or build artifact that embeds a renamed string. The one near-adjacent concern: a re-install/upgrade of `@angular/compiler-cli` invalidates the `typecheck-drift` cache (its typings are declared `inputs`) -- which is the INTENDED drift trigger, not stale state.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Shim's fabricated `EmitFlags.None = 0` | Mirror real members DTS=1..All=31, drop `None` | This phase (HARD-02) | The shim's enum becomes faithful; `0 as EmitFlags` cast unchanged |
| No drift guard on the vendored subset | Build-time type gate + runtime value gate | This phase (HARD-01) | An upstream getter removal/rename/sig-change or encoding change fails CI loudly |
| `getNgStructuralDiagnostics` "consider dropping" | Retained, documented, asserted | This phase (HARD-04, reversed from "drop it") | Forward-compatible if Angular reactivates it (currently returns `[]` in practice but the getter exists) |

**Deprecated/outdated:**
- `replaceTsWithNgInErrors` as a callable export: DECLARED in `index.d.ts` but NOT in the runtime bundle (treat as internal-only; do not depend on it).
- D-08's "numeric-enum looseness" rationale: inaccurate at TS 6.0.3 (corrected above); the cast is what makes `0` acceptable.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `nx:run-commands` prepends `node_modules/.bin` so bare `tsc` resolves the workspace TS 6.0.3 | typecheck-drift target | LOW -- if a global tsc shadowed it, the version would differ; mitigate by using `npx tsc` or `node_modules/.bin/tsc` explicitly in the `command` if the planner wants belt-and-suspenders. Verified `node_modules/.bin/tsc` is TS 6.0.3. |
| A2 | Option A (fold typecheck-drift into the matrix `run-many`) re-running per matrix cell is acceptable | ci.yml wiring | LOW -- it is fast + cached; if the planner prefers a single run, Option B is provided. Both are OS-independent. |
| A3 | The `extended-promoted` fixture (NG8101 Error) is the best HARD-05 reuse target | HARD-05 | LOW -- `extended-v13` (NG8101 Warning) also works; both flow NG8101 through `result.diagnostics`. Either produces a real NG8xxx for the rewrite path. |

**Note:** All HARD-01/02/05 type-system and runtime claims are VERIFIED (not assumed) -- they were reproduced by compiling prototypes and importing the live module this session. The Assumptions above are only about CI ergonomics and fixture choice (Claude's-discretion areas), not about the drift mechanics.

## Open Questions

1. **Should the call-site probes live in `compiler-cli-types.drift.ts` or a sibling `compiler-cli-types.callsite.drift.ts`?**
   - What we know: both compile under the same `tsconfig.drift.json` (the prototype had them co-located and clean).
   - What's unclear: purely organizational (Claude's discretion per D-06/Claude's-discretion).
   - Recommendation: co-locate in the single drift file -- one file, one target, one grep target; matches D-06's "include ONLY the drift file" and keeps the `files` array a singleton.

2. **Does the runtime spec need a real fixture, or can it build a minimal program?**
   - What we know: the probe used `fixtures/ng-baseline/tsconfig.app.json` and `performCompilation` succeeded; all 7 getters resolved.
   - What's unclear: whether a lighter `ts-baseline` fixture also yields an `NgtscProgram` (likely yes -- `performCompilation` always returns one).
   - Recommendation: reuse an existing fixture (`ng-baseline` or `extended-v13`) with `gatherDiagnostics: () => []` so the spec only introspects the program shape, not diagnostics -- fast and deterministic.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `typescript` | HARD-01 drift compile | yes | 6.0.3 | -- |
| `@angular/compiler-cli` | HARD-01 (both gates), HARD-02, HARD-05 | yes | 22.0.4 | -- |
| `nx` (`nx:run-commands`) | typecheck-drift target | yes | 23.0.1 | -- |
| `vitest` | runtime spec + HARD-05 spec | yes | 4.x (`@nx/vitest:test`) | -- |
| `node_modules/.bin/tsc` | typecheck-drift command | yes | 6.0.3 | `npx tsc` |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none material (A1 above).

## Validation Architecture

> `workflow.nyquist_validation: true` -- this section is required and consumed for VALIDATION.md.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x via `@nx/vitest:test` |
| Config file | `packages/angular-typechecker/vite.config.ts` / `vitest.config.ts` (existing) |
| Quick run command | `npx nx run angular-typechecker:test` (or filter `-t <name>`) |
| Full suite command | `npx nx run-many -t test -p angular-typechecker` |
| Drift gate command | `npx nx run typecheck-drift -p angular-typechecker` (NEW; build-time, not Vitest) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HARD-01 | Removed/renamed/sig-changed getter or changed `UNKNOWN_ERROR_CODE`/`EmitFlags` breaks the build | build-time tsc | `npx nx run typecheck-drift -p angular-typechecker` (EXIT != 0 on drift) | NO -- Wave 0 (new `compiler-cli-types.drift.ts` + `tsconfig.drift.json`) |
| HARD-01 (additions + encoding) | New upstream getter flagged; `NG(n) === ngErrorCode(n)`; `UNKNOWN_ERROR_CODE === 500` | unit/integration (runtime `await import`) | `npx nx run angular-typechecker:test -t "compiler-cli-types runtime"` | NO -- Wave 0 (new `compiler-cli-types.runtime.spec.ts`) |
| HARD-02 | `EmitFlags` mirrors real members; `0 as EmitFlags` still type-checks | build-time tsc (value-level assertion in drift file) + existing `nx build` | `npx nx run typecheck-drift` + `npx nx build angular-typechecker` | drift file NEW; build EXISTS |
| HARD-03 | Every divergence carries the greppable marker | static grep (verification step, not a runtime test) | `git grep -c "angular-typechecker: vendored" -- packages/angular-typechecker/src/core/compiler-cli-types.ts` (expect >= 6) | N/A (grep assertion) |
| HARD-04 | `getNgStructuralDiagnostics` retained, called, and asserted | unit (existing) + build-time gate (per-member probe) | `npx nx run angular-typechecker:test -t "gatherAllDiagnostics"` + drift gate | `gather-diagnostics.spec.ts` EXISTS (asserts the call); drift coverage NEW |
| HARD-05 | No `TS-99` survives the `color:false` path; an `NG####` label renders | integration (real `cli.formatDiagnostics`) | `npx nx run angular-typechecker:test -t "TS-99"` | NO -- Wave 0 (new spec OR extend `render-report.spec.ts`) |

### Sampling Rate
- **Per task commit:** the touched spec(s) + `typecheck-drift` (the latter is fast + cached).
- **Per wave merge:** `npx nx run-many -t typecheck-drift test -p angular-typechecker`.
- **Phase gate:** full suite + `typecheck-drift` green before `/gsd-verify-work`; `git grep` marker count >= 6 confirmed.

### Wave 0 Gaps
- [ ] `packages/angular-typechecker/tsconfig.drift.json` -- the classic-node drift tsconfig (HARD-01)
- [ ] `packages/angular-typechecker/src/core/compiler-cli-types.drift.ts` -- the type assertions (HARD-01/02/04)
- [ ] `typecheck-drift` target in `packages/angular-typechecker/project.json` (HARD-01)
- [ ] `*.drift.ts` exclusion added to `tsconfig.lib.json` (and `tsconfig.spec.json`) (HARD-01 safety)
- [ ] `packages/angular-typechecker/src/core/compiler-cli-types.runtime.spec.ts` -- runtime getter-set + encoding (HARD-01 D-04)
- [ ] HARD-05 spec (new `*.ts99-leak.integration.spec.ts` OR a `not.toContain('TS-99')` assertion added to the existing NG8109 case in `render-report.spec.ts`)
- [ ] `ci.yml` wiring of `typecheck-drift` (Option A fold-in recommended)
- [ ] Framework install: none -- Vitest + TS + nx all present.

## Security Domain

> `security_enforcement` not explicitly `false` -- included. This phase has a SMALL security surface: it adds a CI command and a build-time check; it ships NO new runtime code (the drift file is type-only/erased; the specs are test-only).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface |
| V3 Session Management | no | None |
| V4 Access Control | no | None |
| V5 Input Validation | no | The drift file takes no external input; the runtime spec imports the trusted installed package only |
| V6 Cryptography | no | None |
| V14 Configuration / Supply chain | yes | `ci.yml` already enforces SHA-pinned actions + `persist-credentials: false` + least-privilege `contents: read`; any new `typecheck-drift` CI job MUST follow the same pins/conventions (Option B template above does). No new dependency is added (D-03), so no new supply-chain surface. |

### Known Threat Patterns for this phase
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A new CI step interpolating untrusted PR metadata into a run command | Tampering / Elevation | The `typecheck-drift` command uses FIXED target ids + flags only (no PR title/branch/author) -- matches the existing `ci.yml` threat model |
| Unpinned action in a new job | Tampering (tj-actions vector) | Reuse the exact SHA-pinned `checkout`/`setup-node` refs already in `ci.yml`; Dependabot keeps them fresh |
| The drift file accidentally shipped (it imports the real ESM barrel) | Information disclosure / build breakage | Excluded from `tsconfig.lib.json` + `files` whitelist already gates the tarball; the drift file is `*.drift.ts` (not `index`-reachable) and never in `executors.json` |
| Runtime spec executing arbitrary code via the imported package | Tampering | It imports ONLY the already-installed, `@nx/dependency-checks`-policed `@angular/compiler-cli` -- the same module the executor loads in production |

## Sources

### Primary (HIGH confidence -- this session, against the installed package + live runtime)
- Live `await import('@angular/compiler-cli')` probe (project root, removed after use): `EmitFlags` has NO `None` (`'None' in cli.EmitFlags === false`); members DTS=1,JS=2,Metadata=4,I18nBundle=8,Codegen=16,Default=19,All=31; `UNKNOWN_ERROR_CODE === 500`; `ngErrorCode(8001/8101/8109/3004) === -998001/-998101/-998109/-993004`; `cli.formatDiagnostics([{code:-998109}],host)` -> contains `NG8109`, no `TS-99`; `ts.formatDiagnostics` -> `TS-998109` (leaks); `replaceTsWithNgInErrors` runtime `=== undefined`; live program `constructor.name === 'NgtscProgram'`; all 7 gathered getters + `getTsProgram().getGlobalDiagnostics` are functions; runtime prototype has extras (`emitXi18n`, `getApiDocumentation`, `getEmittedSourceFiles`, `getIndexedComponents`, `getReuseTsProgram`).
- Prototype `tsc --noEmit -p` runs (TS 6.0.3, removed after use): per-member `real -> shim` for 6 diag getters compiles clean; `getTsProgram` whole-object FAILS TS2322 (needs `ReturnType -> ts.Program`); call-site no-arg on a required-param getter FAILS TS2554 while the member probe stays GREEN (optional->required silent gap); `0 as EmitFlags` OK, bare `: EmitFlags = 0` FAILS TS2322; missing real getter FAILS TS2339; classic-node resolves the real barrel; nodenext resolves it EMPTY (TS2305); TS5107 without `ignoreDeprecations: "6.0"`.
- `node_modules/@angular/compiler-cli/index.d.ts` (barrel: `export * from './src/transformers/api'` -> `Program`/`EmitFlags`/`UNKNOWN_ERROR_CODE` are TOP-LEVEL named exports, NOT under an `api` namespace; `{ ErrorCode, ngErrorCode }` from `./src/ngtsc/diagnostics`; `replaceTsWithNgInErrors` declared at :13/:30 from `./src/util`).
- `node_modules/@angular/compiler-cli/src/transformers/api.d.ts` (`Program` :122-185 -> `getTsProgram(): ts.Program` :128; `EmitFlags` :74-82 NO `None`; `UNKNOWN_ERROR_CODE = 500` :11).
- `node_modules/@angular/compiler-cli/src/perform_compile.d.ts` (`ParsedConfiguration` :14-21; `PerformCompilationResult.program?` OPTIONAL :29; `readConfiguration(project, existingOptions?, host?)` :26).
- `node_modules/@angular/compiler-cli/package.json` (`type: module`, `exports['.'] = { types: './index.d.ts', default: './bundles/index.js' }` -- the empty-resolution cause).
- Repo source read this session: `compiler-cli-types.ts`, `gather-diagnostics.ts`, `diagnostic-codes.ts`, `format-report.ts`, `render-report.ts`, `run-typecheck.ts` (`emitFlags: 0 as EmitFlags` :229; infra detector `=== ng.UNKNOWN_ERROR_CODE` :238), `tsconfig.json`/`tsconfig.lib.json`/`tsconfig.spec.json`/`tsconfig.base.json`, `project.json`, `ci.yml`, `render-report.spec.ts`, `format-report.spec.ts`, `gather-diagnostics.spec.ts`, `extended.angular13.integration.spec.ts`, `extended.promotion.integration.spec.ts`.

### Secondary (MEDIUM)
- `10-CONTEXT.md` (D-01..D-11), `09-CONTEXT.md` (cross-phase getter-set note), `REQUIREMENTS.md` (HARD-01..05), `ROADMAP.md` (Phase 10 SC1-5).

### Tertiary (LOW)
- None -- no unverified web claims; all mechanics confirmed locally.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new packages; all versions verified against the installed tree.
- Architecture (drift gate shape + runtime spec): HIGH -- every assertion shape compiled/ran against the live package this session.
- Pitfalls: HIGH -- the four pitfalls were each empirically reproduced (TS2322 getTsProgram, TS-99 fake leak, TS2305 nodenext, TS5107 deprecation).
- CI wiring: MEDIUM -- two valid options provided; the choice is Claude's discretion and both are OS-independent.

**Research date:** 2026-06-29
**Valid until:** until the next `@angular/compiler-cli` upgrade (the drift gate's entire purpose is to detect that event; re-verify the `EmitFlags`/getter-set facts on any compiler-cli bump). 30 days for the tooling/Nx facts.
