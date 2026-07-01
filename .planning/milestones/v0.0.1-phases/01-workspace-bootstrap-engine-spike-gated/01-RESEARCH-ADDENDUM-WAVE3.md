# Phase 1 - Research Addendum: Wave 3 Findings Verification (pre-Wave 4 / pre-GO)

**Researched:** 2026-06-27
**Scope:** Targeted verification of the three Wave 3 executor findings against the LIVE Angular v22 source, the installed `node_modules/@angular/compiler-cli@22.0.4`, and the built `dist/` artifacts. NOT a full phase re-research.
**Confidence:** HIGH (every claim below reproduced empirically this session with the locked `typescript@6.0.3` + `@angular/compiler-cli@22.0.4`; ngErrorCode encoding read line-by-line from live v22 source and confirmed at runtime).

**One-line verdict:** All three findings are CONFIRMED. The Wave 3 deep-`.d.ts` shim (finding 1) is the CORRECT tradeoff under the locked `module:nodenext` and should be KEPT with a documented Phase-2 caveat -- the canonical alternatives all either break GATE A emit or rely on a runtime trick we deliberately rejected. Findings 2 and 3 are corrections that tighten the Wave 4 gate-spec; neither threatens GO.

---

## Finding 1 - `module:nodenext` cannot resolve the compiler-cli barrel typings; deep-`.d.ts` shim

### (a) Root cause: CONFIRMED (reproduced this session)

The barrel collapse is real and reproduces exactly as reported. Importing the named members from the package root under the plugin's locked `module:nodenext` / `moduleResolution:nodenext` errors TS2305 for all six:

```
__repro_barrel.ts(4,3): error TS2305: Module '"@angular/compiler-cli"' has no exported member 'Program'.
... (EmitFlags, ParsedConfiguration, performCompilation, readConfiguration, defaultGatherDiagnostics)
```

`tsc --traceResolution` shows the precise mechanism:

```
Module name '@angular/compiler-cli' was successfully resolved to '.../index.d.ts'
  (via 'exports' subpath '.' with target './index.d.ts')
Resolving module './src/transformers/api' from '.../index.d.ts'.
  Loading module as file / folder, candidate '.../src/transformers/api'
  Directory '.../src/transformers/api' does not exist, skipping all lookups in it.
Module name './src/transformers/api' was not resolved.   <-- and the same for EVERY export *
```

- The barrel `index.d.ts` IS reached (via the `exports["."]` -> `./index.d.ts` mapping).
- Under nodenext (Node16 ESM semantics) an extensionless relative specifier (`export * from './src/transformers/api'`) is only tried **as a directory** (looking for `api/index.d.ts`); the sibling `api.d.ts` is never probed. Every one of the ~25 `export *` lines in `index.d.ts:1-30` fails -> the `@angular/compiler-cli` namespace resolves EMPTY -> TS2305/TS2339/TS2503 at the call sites.
- Source: `node_modules/@angular/compiler-cli/index.d.ts:1-30` (extensionless `export * from './src/...'`); root cause is Node16/NodeNext ESM resolution requiring explicit extensions in relative specifiers, which Angular's published typings do not carry.

### (a, cont.) Does the package `exports` map permit the shim's deep subpaths? NO - the shim deliberately bypasses the exports map.

`node_modules/@angular/compiler-cli/package.json` `exports` (lines 11-31) exposes ONLY: `.`, `./package.json`, `./linker`, `./linker/babel`, `./private/*`. There is **no `./src/*` subpath**.

Reproduced this session - a **package-name** deep subpath is BLOCKED:

```
import type { Program } from '@angular/compiler-cli/src/transformers/api';
  -> error TS2307: Cannot find module '@angular/compiler-cli/src/transformers/api' (EXIT 2)
```

The shim does NOT use a package-name subpath. It uses a **relative filesystem path**:

```ts
// packages/angular-typechecker/src/core/compiler-cli-types.ts:15-24
import type { EmitFlags, Program } from '../../../../node_modules/@angular/compiler-cli/src/transformers/api';
import type { defaultGatherDiagnostics, ParsedConfiguration, performCompilation, readConfiguration } from '../../../../node_modules/@angular/compiler-cli/src/perform_compile';
```

Relative path imports are NOT gated by the target package's `exports` map (exports only gates bare/package-name specifiers). Reproduced this session - the relative deep import type-checks cleanly: `tsc -p tsconfig` over `__repro_deep.ts` -> **EXIT 0**.

**Why it works despite the leaf `.d.ts` files themselves containing extensionless imports** (e.g. `perform_compile.d.ts:10` `import * as api from './transformers/api'`): the root `tsconfig.base.json` sets `"skipLibCheck": true`, so TypeScript does not re-resolve/type-check the internal extensionless re-exports inside the `.d.ts` files the shim points at. It only needs the _named symbols declared in those two leaf files_ to be reachable, which they are.

**Fragility (the real caveat):** the shim is coupled to TWO internal facts that are NOT part of the public type contract: (1) the on-disk `.d.ts` layout (`src/transformers/api.d.ts`, `src/perform_compile.d.ts`); (2) npm hoisting placing the package exactly four levels up at `<repo>/node_modules/@angular/compiler-cli`. A patch release that relocates a declaration file, or a non-hoisted/nested install layout, breaks the path. It is type-only (erased at emit; the built `compiler-loader.js` has zero trace of it), so a break is a _build-time type error caught by CI_, never a shipped runtime bug. Risk class: low-severity, high-visibility.

### (b) How does `@angular/build` import compiler-cli TYPES, and does it hit the same problem? NO - it uses node10 resolution + the Function-import trick.

- **Type imports:** `@angular/build` imports types from the package ROOT barrel - `import type * as ng from '@angular/compiler-cli'` (verified across 7 files: `angular-compilation.ts:9`, `aot-compilation.ts:9`, `jit-compilation.ts:9`, `noop-compilation.ts:9`, `hmr-candidates.ts:9`, `angular-host.ts:9`; `parallel-compilation.ts:9` imports `CompilerOptions` the same way). This is the SAME barrel-root import that fails for us under nodenext.
- **Why it works for them:** their TS build is `"module": "commonjs"` + `"moduleResolution": "node"` (node10/classic) - `D:/projects/github/angular/angular-cli/tsconfig.json:5-6`. Reproduced this session in OUR repo: `module:commonjs` + `moduleResolution:node10` resolves the barrel -> **EXIT 0**. node10/classic DOES probe sibling `.d.ts` for extensionless specifiers, so the barrel re-exports resolve. They never hit the nodenext problem because they never use nodenext.
- **The cost they pay instead:** under `module:commonjs`, TypeScript unconditionally downlevels `await import(...)` to `await Promise.resolve().then(() => __importStar(require(...)))` (reproduced this session - see emit matrix below), which throws `ERR_REQUIRE_ESM` on the ESM-only compiler-cli. To dodge that, `@angular/build` hides the dynamic import behind a `Function` constructor (`load-esm.ts:26-33`: `new Function('modulePath', 'return import(modulePath);')`). The file's own comment confirms: _"TypeScript will currently, unconditionally downlevel dynamic import into a require call ... a Function constructor is used to prevent TypeScript from changing the dynamic import."_ This is exactly the workaround PROJECT.md/Wave 3 rejected for us.

In short: **@angular/build trades the barrel problem away by paying a runtime-trick + node10-resolution cost. Our `module:nodenext` trades the runtime trick away by paying a barrel-typings cost (the shim).** Both are isolated workarounds for the same upstream gap (Angular's typings are not nodenext-clean).

### (c) Cleaner canonical options (emit + resolution matrix, all reproduced this session)

Emit of `await import('@angular/compiler-cli')` and barrel-resolution by module/resolution combo, `typescript@6.0.3`:

| `module`            | `moduleResolution` | emit of `import()`                                       | top-level emit (Nx `require()`-loadable?)      | barrel resolves? | Verdict                                                                                                            |
| ------------------- | ------------------ | -------------------------------------------------------- | ---------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| `nodenext` (LOCKED) | `nodenext`         | literal `import(...)`                                    | CJS (`exports.default`, `require(...)`) - YES  | NO (TS2305)      | Current. Needs the shim. GATE A intact.                                                                            |
| `node16`            | `node16`           | literal `import(...)`                                    | CJS - YES                                      | NO (TS2305)      | Same as nodenext; same shim needed.                                                                                |
| `commonjs`          | `node`/`node10`    | `Promise.resolve().then(()=>__importStar(require(...)))` | CJS - YES                                      | YES (EXIT 0)     | GATE A NO-GO: downlevels to `require()` -> `ERR_REQUIRE_ESM`. Only survivable with the `Function` trick.           |
| `esnext`            | `bundler`          | literal `import(...)`                                    | **ESM** (`import {..}`, `export default`) - NO | YES (EXIT 0)     | GATE A NO-GO: executor emits ESM; Nx `require()` of it throws `ERR_REQUIRE_ESM` on the executor itself.            |
| `preserve`          | `bundler`          | literal `import(...)`                                    | **ESM** (`import {..}`, `export default`) - NO | YES (EXIT 0)     | Same as esnext - executor is ESM, not `require()`-loadable.                                                        |
| `nodenext`          | `bundler`          | n/a                                                      | n/a                                            | n/a              | ILLEGAL: TS5095/TS5109 (`bundler` requires module preserve/commonjs/es2015+; nodenext forces nodenext resolution). |

Option assessment:

1. **`moduleResolution: "bundler"`** - resolves the barrel cleanly, BUT it is _mutually exclusive_ with `module: nodenext` (TS5095/TS5109). To get bundler resolution you must set `module` to `esnext`/`preserve`/`commonjs`. With `esnext`/`preserve` the executor's _top-level_ emit becomes ESM (`import`/`export` statements), which Nx's `require()`-based loader cannot load (`ERR_REQUIRE_ESM` on the executor) - GATE A NO-GO by construction. **Rejected.** (Note: the prior 01-RESEARCH.md emit table only checked the _dynamic-import_ line, which stays literal under esnext/preserve; this addendum adds the decisive top-level-emit check that disqualifies them.)
2. **A supported deep type entry** - none exists. The `exports` map publishes no `./src/*` types subpath; a package-name deep import is TS2307 (reproduced). Not available without an upstream change.
3. **The `Function`-wrapped dynamic import (`load-esm.ts`)** - only relevant under `module:commonjs` (to dodge the `require()` downlevel). Under our locked `module:nodenext` the dynamic import already survives natively, so the Function trick is pure downside (loses type-safety on the import, hides it from the compiler). It does NOT fix the _typings_ problem - you would STILL need the shim (or node10 resolution) for the barrel types. **Rejected** (the explicitly-rejected @angular/build path).
4. **`import type` from the package root** - this IS what fails (TS2305); it is the problem, not a fix.

**Net:** there is no option that keeps the literal `import(` in a `require()`-loadable CJS executor AND types the barrel cleanly, _except_ the deep-`.d.ts` shim. The shim is the minimal isolation of the upstream gap.

### (d) VERDICT: KEEP the shim as-is for v0.0.1, with a Phase-2 caveat.

**Keep `packages/angular-typechecker/src/core/compiler-cli-types.ts` unchanged.** It is the correct engineering tradeoff: it preserves the locked `module:nodenext` (the GATE A emit enabler), keeps the executor CJS/`require()`-loadable, types the consumed surface, and isolates the entire workaround to one type-only file that is erased at emit.

Caveats to carry into Phase 2 (record in the kept-core notes):

- The shim's two relative deep paths are coupled to compiler-cli's internal `.d.ts` layout and to a hoisted install. Add a Wave-0/CI guard in a later phase: a tiny type-check (already effectively covered by `nx build`) plus, ideally, a one-line assertion that `node_modules/@angular/compiler-cli/src/perform_compile.d.ts` exists, so a layout change fails loudly with a pointer to this file rather than a cryptic TS2307.
- Widen the `CompilerCli` surface in the shim only as the Phase-2 engine grows (it currently declares only `readConfiguration`, `performCompilation`, `defaultGatherDiagnostics`, `EmitFlags` + the `Program`/`ParsedConfiguration`/`EmitFlags` type re-exports).
- Revisit and delete the shim if/when `@angular/compiler-cli` ships nodenext-clean typings (extension-ful re-exports or a `./src/*` types export). Track upstream; this is an Angular-side gap, not ours.
- Do NOT "clean up" the shim by switching the plugin to `moduleResolution:bundler` or the `Function` trick - both regress GATE A (see matrix).

---

## Finding 2 - GATE A positive target is `core/compiler-loader.js`, not `executor.js`. CONFIRMED.

Verified against the built artifacts under `dist/packages/angular-typechecker/`:

- **`dist/packages/angular-typechecker/src/core/compiler-loader.js:19`** contains the literal dynamic import:

  ```js
  cached !== null && cached !== void 0 ? cached : (cached = (yield import('@angular/compiler-cli')));
  ```

  (`yield import(...)` because `target` downlevels async/await to tslib generators - but `import(` is LITERAL, never `require()`.) This file is the ONLY place the literal `import(` appears in code. It does NOT contain `require('@angular/compiler-cli')`.

- **`dist/packages/angular-typechecker/src/executors/angular-typecheck/executor.js`** contains NO `import(` in code. It `require("../../core/run-typecheck")` and `require("tslib")` only - NO `require('@angular/compiler-cli')`. The string `@angular/compiler-cli` DOES appear, but only inside the JSDoc comment block (lines 9-10: "...load of @angular/compiler-cli in compiler-loader.ts survives emit...").

- `dist/.../src/core/run-typecheck.js:44` also retains a literal `import('typescript')` (the lazy TS loader) - not gate-relevant but confirms the nodenext emit held across all core files.

### Canonical Wave 4 GATE A static wording (exact paths + assertions)

- **Positive assertion target (literal `import(` present):**
  `dist/packages/angular-typechecker/src/core/compiler-loader.js`
  Assert: `expect(code).toMatch(/import\(/)` (comment-stripped is fine; the real call is on line 19).

- **Negative assertion target (no `require()` of compiler-cli):** assert on BOTH built files -
  `dist/packages/angular-typechecker/src/core/compiler-loader.js` AND
  `dist/packages/angular-typechecker/src/executors/angular-typecheck/executor.js`
  Assert: `expect(code).not.toMatch(/require\(["']@angular\/compiler-cli/)`.

- **CRITICAL gotcha for the executor negative check:** `executor.js` contains the bare substring `@angular/compiler-cli` in a JSDoc comment. A naive `expect(code).not.toContain('@angular/compiler-cli')` would FALSE-FAIL. Use the specific require-CALL regex `/require\(["']@angular\/compiler-cli/` and/or strip comment lines first (the 01-RESEARCH.md GATE A example already strips `//`-prefixed lines - keep that). Do not assert the bare package string is absent.

- **Path derivation note (do not hard-code):** both paths derive from `build.options.outputPath` (`dist/packages/angular-typechecker`) + the source-relative path. Wave 4 should read `outputPath` from `project.json` and join `src/core/compiler-loader.js` / `src/executors/angular-typecheck/executor.js`, per resolved research Open Q2.

---

## Finding 3 - Angular extended diagnostic codes are encoded NEGATIVE. CONFIRMED + encoding pinned.

### ngErrorCode encoding (read from live v22 source + confirmed at runtime)

Source: `D:/projects/github/angular/angular/packages/compiler-cli/src/ngtsc/diagnostics/src/util.ts:26-28`:

```ts
export function ngErrorCode(code: ErrorCode): number {
  return parseInt('-99' + code);
}
```

It is **string concatenation `'-99' + code`**, then `parseInt`. For a 4-digit `ErrorCode` N: `parseInt('-99' + N)` = `-(990000 + N)`. Confirmed at runtime against `@angular/compiler-cli@22.0.4`:

```
ngErrorCode(8109) = -998109
ngErrorCode(8117) = -998117
UNKNOWN_ERROR_CODE = 500
```

- NG8109 -> `-998109`. CONFIRMED.
- **Recovery math:** `Math.abs(-998109) - 990000 = 998109 - 990000 = 8109`. The Wave 3 SUMMARY's `Math.abs(code) - 990000 === 8109` is CORRECT. (General form for any 4-digit NG code: `Math.abs(code) - 990000 === <code>`.) Equivalent recovery: `ng.ngErrorCode(8109) === code`.
- The `-99` prefix is by design - the formatter's `ERROR_CODE_MATCHER = /(...)TS-99(\d+...)/g` (`util.ts:11`) rewrites the `TS-99xxxx` that TypeScript prints into `NGxxxx` (`util.ts:13-24`). So NG codes are deliberately stored as `parseInt('-99'+code)` on `ts.Diagnostic.code`.

### What is `-998117`? NG8117 = UNINVOKED_FUNCTION_IN_TEXT_INTERPOLATION - EXPECTED, not noise.

Source: `error_code.ts:674` `UNINVOKED_FUNCTION_IN_TEXT_INTERPOLATION = 8117` (and `error_code.ts:586` `INTERPOLATED_SIGNAL_NOT_INVOKED = 8109`).

The fixture's `{{ status }}` (where `status = signal('ready')`) triggers BOTH extended checks because a signal is a callable function interpolated without invocation:

- NG8109 (signal-specific: "Signal functions should be invoked when interpolated" - doc example `{{ mySignal() }}`).
- NG8117 (general: "A function in a text interpolation is not invoked" - doc example `{{ firstName() }}`).

So `-998117` is an EXPECTED companion diagnostic for this exact fixture shape, not noise and not an ESM-load artifact. (It is NOT 500/`UNKNOWN_ERROR_CODE`, so it does not trip the GATE A runtime negative.)

### Live GATE B re-validation (both fixture variants, this session)

Ran the all-getter and `defaultGatherDiagnostics` against the REAL fixture with `@angular/compiler-cli@22.0.4`:

| fixture tsconfig    | all-getter codes           | default (ngc) codes |
| ------------------- | -------------------------- | ------------------- |
| `tsconfig.app.json` | `[2322, -998109, -998117]` | `[2322]`            |
| `tsconfig.lib.json` | `[2322, -998109, -998117]` | `[2322]`            |

Matches Wave 3's reported probe exactly. Confirms: positive (2322 + NG8109), differential (ngc emits only 2322; both NG codes short-circuited), breadth (app AND lib), runtime-no-500 (no 500 in either set). NG8109 fires on STABLE 22.0.4 (resolves Assumptions Log A2 / D-18).

### EXACT Wave 4 GATE B assertion forms

- **2322 is NOT offset** (TS codes are stored raw). Assert positively on the literal `2322`.
- **NG8109 present (positive):** assert on the encoded value. Preferred for readability + robustness:
  ```ts
  expect(codes).toContain(-998109);
  // OR, self-documenting against the ErrorCode number:
  expect(codes.some((c) => Math.abs(c) - 990000 === 8109)).toBe(true);
  // OR (if the loaded ng namespace is in scope): expect(codes).toContain(ng.ngErrorCode(8109));
  ```
  Recommendation: assert `toContain(-998109)` for the primary check (matches the proven probe output exactly), and optionally add the `Math.abs(...)-990000` form as a documented helper so the magic number's meaning is explicit. Do NOT assert the bare `8109` (it never appears).
- **Differential (NG8109 absent from ngc):**
  ```ts
  // all-getter set:
  expect(allCodes).toContain(2322);
  expect(allCodes).toContain(-998109);
  // defaultGatherDiagnostics set:
  expect(defaultCodes).toContain(2322);
  expect(defaultCodes).not.toContain(-998109);
  ```
- **Runtime-no-500 (GATE A runtime, keep):** `expect(allCodes).not.toContain(500);` (and assert the `runTypecheck`/probe promise resolves - no `ERR_REQUIRE_ESM`).
- **NG8117 (optional):** you MAY additionally assert `toContain(-998117)` to lock the companion diagnostic, but it is not required by the gate. If asserting, treat it as expected (not noise).

---

## Wave 4 Gate-Spec Contract (executor can follow verbatim)

**GATE A static** (one spec; reads BUILT artifacts via `fs.readFileSync`; `dist/` is gitignored, never `git grep`):

- Resolve `outputPath = dist/packages/angular-typechecker` (derive from `project.json` `build.options.outputPath`; do not hard-code).
- Positive: read `${outputPath}/src/core/compiler-loader.js`, strip `//` comment lines, `expect(code).toMatch(/import\(/)`.
- Negative (both files): read `${outputPath}/src/core/compiler-loader.js` AND `${outputPath}/src/executors/angular-typecheck/executor.js`, `expect(code).not.toMatch(/require\(["']@angular\/compiler-cli/)`. (Comment-strip first; the executor mentions the package in a comment.)
- Prereq: `nx build angular-typechecker` must run before this spec (build precedes static read).

**GATE B positive + differential + breadth + runtime-no-500 + timing** (one spec; `describe.each([app, lib])`):

- For each of `fixtures/gate-b-error/tsconfig.app.json` and `tsconfig.lib.json`:
  - Build `parsed = ng.readConfiguration(tsConfigPath)` once; spread a FRESH `{ ...parsed.options, noEmit: true }` per `performCompilation` call (no shared mutable options - resolved Open Q1).
  - all-getter run -> `allCodes`:
    - `expect(allCodes).toContain(2322)` (positive, TS)
    - `expect(allCodes).toContain(-998109)` (positive, NG8109; optionally also the `Math.abs(c)-990000===8109` helper assertion)
    - `expect(allCodes).not.toContain(500)` (GATE A runtime: no `UNKNOWN_ERROR_CODE`)
  - `defaultGatherDiagnostics` run on the SAME parsed config -> `defaultCodes`:
    - `expect(defaultCodes).toContain(2322)`
    - `expect(defaultCodes).not.toContain(-998109)` (differential)
  - Assert the run promise resolves (no `ERR_REQUIRE_ESM`).
- Timing: capture one cold-run `durationMs` (the existing `runTypecheck` returns it); log once. Not a pass/fail threshold in Phase 1 - just record (gate item 6).

**Which codes, at a glance:** TS error `2322` (raw); NG8109 `-998109` (recover via `Math.abs(c)-990000`); NG8117 `-998117` (expected companion, optional); `UNKNOWN_ERROR_CODE` `500` (must be ABSENT).

---

## GO / NO-GO impact

**GO stands. Nothing here threatens the gate.**

- **Finding 1** is an accepted, isolated, type-only workaround for an upstream typings gap; it does NOT touch the built emit (GATE A static re-confirmed: `compiler-loader.js` retains literal `import(`, no `require('@angular/compiler-cli')` anywhere). The verified alternatives are all worse (break GATE A emit or reintroduce the rejected `Function` trick). The only downstream action is a Phase-2 caveat note + an optional CI layout-guard - neither blocks GO.
- **Finding 2** is a target-path correction (point GATE A positive at `compiler-loader.js`, keep the negative on both, use the require-call regex not a bare substring). It tightens the Wave 4 spec; it does not change any gate outcome.
- **Finding 3** is an encoding correction (assert `-998109`, recover via `Math.abs(c)-990000`). The underlying GATE B behavior (all-getter surfaces NG8109; ngc does not) is PROVEN on stable 22.0.4 for both app and lib variants. This resolves Assumptions Log A2 / D-18 in the affirmative.

All six gate checklist items (A-static, A-runtime, B-positive, B-differential, B-breadth, timing) are supported by reproduced evidence. Wave 4 can author the specs against the contract above and call GO.

---

## Sources (this session, all HIGH confidence)

Primary - live source + installed package + built artifacts (re-read/reproduced 2026-06-27):

- `node_modules/@angular/compiler-cli/package.json:11-31` - `exports` map (no `./src/*`); `index.d.ts:1-30` - extensionless `export *` barrel.
- `node_modules/@angular/compiler-cli/src/perform_compile.d.ts`, `src/transformers/api.d.ts` - the deep leaf files the shim targets (exist; carry the named symbols; contain internal extensionless imports skipped under `skipLibCheck`).
- `D:/projects/github/angular/angular/packages/compiler-cli/src/ngtsc/diagnostics/src/util.ts:26-28` - `ngErrorCode = parseInt('-99'+code)`; `:11-24` - the `TS-99`->`NG` formatter rationale.
- `.../diagnostics/src/error_code.ts:586` (`INTERPOLATED_SIGNAL_NOT_INVOKED=8109`), `:674` (`UNINVOKED_FUNCTION_IN_TEXT_INTERPOLATION=8117`).
- `D:/projects/github/angular/angular-cli/tsconfig.json:5-6` (`module:commonjs`, `moduleResolution:node`); `tsconfig-build-esm.json:9` (`module:esnext`); `packages/angular/build/src/utils/load-esm.ts:26-33` (Function-wrapped import); `.../tools/angular/compilation/angular-compilation.ts:9,35` (`import type * as ng` + `await import`); 6 sibling files import compiler-cli types from the barrel root.
- Built: `dist/packages/angular-typechecker/src/core/compiler-loader.js:19` (literal `import(`), `.../executors/angular-typecheck/executor.js` (no `import(` in code; `@angular/compiler-cli` only in comments; no `require('@angular/compiler-cli')`), `.../core/run-typecheck.js:44` (literal `import('typescript')`).
- Plugin config: `packages/angular-typechecker/tsconfig.json` (`module/moduleResolution:nodenext`), `tsconfig.lib.json`, `../../tsconfig.base.json` (`skipLibCheck:true`).

Empirical reproductions (this session, `typescript@6.0.3` / `@angular/compiler-cli@22.0.4` / Node v24.18.0):

- Barrel under nodenext -> TS2305 x6 (+ `--traceResolution` showing extensionless `export *` unresolved).
- Deep relative-path shim under nodenext -> EXIT 0 (with `skipLibCheck`).
- Package-name deep subpath under nodenext -> TS2307 (exports-map blocked).
- node10/classic resolution -> barrel EXIT 0 (the @angular/build path).
- Emit matrix (nodenext/node16 -> literal `import(`, CJS top-level; commonjs -> `require()` downlevel; esnext/preserve+bundler -> literal `import(` but ESM top-level; nodenext+bundler illegal TS5095/TS5109).
- Live fixture probe -> all-getter `[2322,-998109,-998117]`, ngc `[2322]` for both app and lib variants; `ngErrorCode(8109)=-998109`, `ngErrorCode(8117)=-998117`, `UNKNOWN_ERROR_CODE=500`.

All temporary repro files were removed from the repo after measurement (verified: `git status` shows no stray `__repro*`/`__probe`/`tsconfig.repro*` artifacts).
