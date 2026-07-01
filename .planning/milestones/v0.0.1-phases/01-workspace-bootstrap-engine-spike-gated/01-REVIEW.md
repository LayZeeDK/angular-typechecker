---
phase: 01-workspace-bootstrap-engine-spike-gated
reviewed: 2026-06-27T16:49:12Z
depth: deep
advisory: true
blocking: false
files_reviewed: 13
files_reviewed_list:
  - packages/angular-typechecker/src/core/compiler-loader.ts
  - packages/angular-typechecker/src/core/gather-diagnostics.ts
  - packages/angular-typechecker/src/core/run-typecheck.ts
  - packages/angular-typechecker/src/core/compiler-cli-types.ts
  - packages/angular-typechecker/src/core/compiler-loader.spec.ts
  - packages/angular-typechecker/src/core/gather-diagnostics.spec.ts
  - packages/angular-typechecker/src/core/gate-b.spec.ts
  - packages/angular-typechecker/src/executors/angular-typecheck/executor.ts
  - packages/angular-typechecker/src/executors/angular-typecheck/schema.json
  - packages/angular-typechecker/src/executors/angular-typecheck/schema.d.ts
  - packages/angular-typechecker/src/executors/angular-typecheck/gate-a-static.spec.ts
  - fixtures/gate-b-error/error.component.ts
  - fixtures/gate-b-error/tsconfig.app.json
findings:
  critical: 0
  high: 0
  medium: 2
  low: 3
  info: 4
  total: 9
status: clean
---

# Phase 1: Code Review Report (ADVISORY)

**Reviewed:** 2026-06-27T16:49:12Z
**Depth:** deep (cross-file + live compiler-cli source trace)
**Files Reviewed:** 13 source + spec files (planning artifacts excluded)
**Status:** clean (no Critical/High findings; the kept tracer-bullet core is correct for the gate it proves)
**Advisory:** non-blocking. Phase is verified GO. Findings below are forward-looking hardening for the Phase 2 engine that grows this core.

## Summary

The Phase 1 tracer-bullet core is correct on every axis the spike was meant to prove, and I verified each claim against live sources rather than trusting the SUMMARY:

- **Memoization** (`compiler-loader.ts`): `cached ??= (await import(...))` is correct. There is no double-load *correctness* bug -- a concurrent race could issue two `import()` calls, but ESM module caching makes both resolve to the same namespace object, so the memoized value is stable. (Noted as Info IN-01.)
- **Unconditional all-getter** (`gather-diagnostics.ts`): all six getters are called with no `&&` short-circuit, in the documented order, and `getNgSemanticDiagnostics()` is genuinely invoked last. I confirmed against the live `defaultGatherDiagnostics` in `@angular/compiler-cli@22.0.4` (`bundles/chunk-6ZBSJK4S.js:600-617`) that ngc's `&&`-chain short-circuits exactly where the SUMMARY claims -- the differential is real, not asserted on a too-broad condition.
- **Fresh options per call** (`run-typecheck.ts:37`, `gate-b.spec.ts:58`): `{ ...parsed.options, noEmit: true }` is spread fresh on every `performCompilation` call; no shared mutable `noEmit`. The differential genuinely depends on this and it holds.
- **`emitFlags: 0`**: correct and intentional (no emit) per D-16.
- **ESM-load failure does NOT masquerade as a code-500 diagnostic**: I traced `performCompilation`'s try/catch (`chunk-6ZBSJK4S.js:561-598`). It wraps `createProgram` + `gatherDiagnostics`, NOT the `await import()`. Because `loadCompilerCli()` is awaited *before* `performCompilation` is called (`run-typecheck.ts:29`), an `ERR_REQUIRE_ESM` rejects the `runTypecheck` promise -- it cannot be swallowed into a code-500 diagnostic. T-01-07 is genuinely mitigated. (One residual nuance in MD-02.)
- **GATE specs are load-bearing**: the GATE A negative uses the specific `require(...)` call regex (not a bare substring) on both built files with comment-stripping -- robust against the JSDoc mention. The GATE B differential asserts `toContain(-998109)` positively and `not.toContain(-998109)` on the default gatherer over the same fixture -- a true differential with no false-pass path. Re-ran `nx test angular-typechecker`: 4 files, 12 tests, all green (cold-run durationMs ~286).
- **Fixture** (`fixtures/gate-b-error/*`): genuinely triggers TS2322 + NG8109 (confirmed by the passing GATE B run), `strictTemplates: true` + `noEmit: true` present in both tsconfig variants, and `git grep` confirms nothing outside the fixture dir + specs references it (the only other hit is the deliberate `tsconfig.lib.json` exclude line).
- **compiler-cli-types.ts shim**: type-only, erased at emit (the built `compiler-loader.js` carries no trace of it -- GATE A static re-confirms), and `skipLibCheck: true` is what keeps the deep `.d.ts` imports resolving without re-checking their internal extensionless re-exports. The accepted caveat (fragile deep relative path) is documented; I found no *additional* concrete correctness problem beyond it. See IN-04 for one masking-risk note that is within the documented caveat.

The two Medium findings are forward-looking robustness gaps (not gate failures): config-parse errors are silently dropped, and `warningCount` conflates non-Error categories. Both are safe to defer but should be on the Phase 2 radar because they change real-world result correctness once the engine runs against arbitrary consumer tsconfigs.

## Critical Issues

None.

## High Issues

None.

## Medium

### MD-01: `readConfiguration` parse errors (`parsed.errors`) are silently dropped -> false "success" on a broken tsconfig

**File:** `packages/angular-typechecker/src/core/run-typecheck.ts:32-53`
**Issue:** `ng.readConfiguration(options.tsConfigPath)` returns a `ParsedConfiguration` whose shape (verified in `node_modules/@angular/compiler-cli/src/perform_compile.d.ts`) includes `errors: ts.Diagnostic[]`. These hold config-resolution failures: a missing/malformed tsconfig, an unresolvable `extends`, an invalid `angularCompilerOptions` key, or a glob that matches zero files. `run-typecheck.ts` reads only `parsed.rootNames` and `parsed.options` and never inspects `parsed.errors`. Consequence: a tsconfig that fails to parse can yield empty `rootNames`, `performCompilation` then finds nothing to check, and the result is `errorCount: 0` / the executor returns `success: true`. For a *type-checking* tool, a config that could not even be read reporting "clean" is a silent false pass -- the highest-impact failure mode for this product. The Phase 1 gate never exercises a broken config, so the spike does not surface it.

This is below High only because it is forward-looking (the gate fixtures are valid, so nothing is currently wrong) and the fix is a Phase 2 engine concern (EXE-01 territory). Flagging now because the kept core is the foundation Phase 2 grows, and the contract (`CoreResult`) is being set here.

**Fix:** Surface `parsed.errors` in the result and let them count toward `errorCount`. Concretely, fold them into the diagnostics before counting:

```ts
const parsed = ng.readConfiguration(options.tsConfigPath);

// ...
const allDiagnostics = [...parsed.errors, ...result.diagnostics];

const errorCount = allDiagnostics.filter(
  (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
).length;

return {
  diagnostics: allDiagnostics,
  codes: allDiagnostics.map((diagnostic) => diagnostic.code),
  errorCount,
  warningCount: allDiagnostics.length - errorCount,
  durationMs,
};
```

(If you prefer to fail fast, short-circuit when `parsed.errors` contains an Error-category diagnostic before calling `performCompilation`.) Add a Phase 2 spec with a deliberately broken tsconfig asserting `errorCount > 0`.

### MD-02: `warningCount` conflates Warning, Suggestion, and Message categories (and can miscount the ngc "Time for diagnostics" message)

**File:** `packages/angular-typechecker/src/core/run-typecheck.ts:43-52`
**Issue:** `warningCount` is computed as `result.diagnostics.length - errorCount` -- i.e. "everything that is not category `Error`." `ts.DiagnosticCategory` has four members: `Warning`, `Error`, `Suggestion`, `Message`. NG8xxx extended diagnostics (the product's headline feature) default to `Warning`, so they land in this bucket correctly -- but so do `Suggestion` and `Message` diagnostics. Two concrete consequences: (1) the count is mislabelled -- it is "non-errors," not "warnings"; (2) if a consumer tsconfig sets `compilerOptions.diagnostics: true`, `performCompilation` appends a category-`Message` "Time for diagnostics: Nms." diagnostic (verified at `chunk-6ZBSJK4S.js:571-574, 423-431`), which would inflate `warningCount` by one and pollute `codes` with `DEFAULT_ERROR_CODE`. The fixture tsconfigs do not set `diagnostics: true`, so the gate is unaffected, but arbitrary consumer configs can.

**Fix:** Count the warning category explicitly instead of by subtraction, and decide deliberately whether Message/Suggestion belong in the surfaced set:

```ts
const errorCount = result.diagnostics.filter(
  (d) => d.category === ts.DiagnosticCategory.Error,
).length;
const warningCount = result.diagnostics.filter(
  (d) => d.category === ts.DiagnosticCategory.Warning,
).length;
```

Consider filtering out category-`Message` diagnostics from `codes`/`diagnostics` (or never enabling `options.diagnostics`) so the reported set is purely the type-check signal. Defer the policy decision to Phase 2, but record it on the `CoreResult` contract now.

## Low

### LW-01: `gather-diagnostics.spec.ts` imports `Program` from the barrel that the production code deliberately avoids

**File:** `packages/angular-typechecker/src/core/gather-diagnostics.spec.ts:1`
**Issue:** `import type { Program } from '@angular/compiler-cli';` imports the barrel type directly -- the exact import that `compiler-cli-types.ts` exists to work around because it does NOT resolve under `module: nodenext`. It "works" here only because specs are compiled by Vitest/esbuild (which does not full-type-check) and `tsconfig.spec.json`, not by the `module: nodenext` lib build. This is an inconsistency, not a runtime bug, but it (a) undercuts the shim's stated invariant ("`Program` is imported from the shim everywhere") and (b) will silently break if spec type-checking is ever tightened. Production code (`gather-diagnostics.ts:3`) correctly imports `Program` from `./compiler-cli-types`.

**Fix:** Import `Program` from the shim for consistency: `import type { Program } from './compiler-cli-types';`.

### LW-02: GATE B differential does not lock the *breadth* of the short-circuit (only NG8109)

**File:** `packages/angular-typechecker/src/core/gate-b.spec.ts:85-90`
**Issue:** The differential asserts `defaultCodes` contains `2322` and not `-998109`. It does not assert that the all-getter set is strictly a superset of the default set, nor that NG8117 (`-998117`, the expected companion) is likewise absent from the default gatherer. As written, the test would still pass if a future Angular release surfaced NG8109 under ngc but the all-getter happened to also include it -- the load-bearing claim ("all-getter surfaces strictly more") is only partially pinned. Low severity because the current assertion pair is sufficient to prove the v22.0.4 behavior and the gate is GO.

**Fix (optional hardening for Phase 2):** add `expect(defaultCodes).not.toContain(-998117);` and an `expect(allCodes.length).toBeGreaterThan(defaultCodes.length);` superset check, or assert the set difference contains the NG codes.

### LW-03: `stripCommentLines` regex strips any line beginning with `*`, which could mask code in a future generated artifact

**File:** `packages/angular-typechecker/src/executors/angular-typecheck/gate-a-static.spec.ts:63-68`
**Issue:** `filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))` drops every line whose first non-space char is `*`. That is correct for JSDoc continuation lines, but it would also drop a real code line that wrapped onto a `*`-leading continuation (rare in tsc output, but not impossible). More relevantly for robustness: the positive assertion `toMatch(/import\(/)` is intentionally broad -- it matches *any* `import(`, not specifically `import('@angular/compiler-cli')`. For `compiler-loader.js` that is fine (it only imports the one package), but if Phase 2 adds another dynamic import to that file the positive test could pass for the wrong reason.

**Fix (optional):** tighten the positive to the specific call: `expect(code).toMatch(/import\(\s*["']@angular\/compiler-cli/)`. This makes the test assert what it actually means and removes reliance on the file containing exactly one dynamic import.

## Info

### IN-01: `loadCompilerCli` memoization has a benign concurrent-call window

**File:** `packages/angular-typechecker/src/core/compiler-loader.ts:16-20`
**Issue:** If `loadCompilerCli()` is called twice before the first `await import()` resolves, both calls issue an `import()`. This is not a correctness bug (ESM module caching makes both resolve to the same namespace, and `cached` ends up pointing at that shared object), and it is not a leak. If you ever want strict single-flight (cache the *promise*, not the resolved value), do `cached ??= import('@angular/compiler-cli') as ...` and type `cached` as `Promise<CompilerCli> | undefined`. Not needed for Phase 1.

### IN-02: Executor swallows the rich `CoreResult` and returns only `{ success }`

**File:** `packages/angular-typechecker/src/executors/angular-typecheck/executor.ts:18-20`
**Issue:** The executor computes `success = result.errorCount === 0` and discards `diagnostics`/`codes`/`warningCount`/`durationMs` without logging. For a tracer-bullet stub this is fine and matches D-11 (full adapter is Phase 4 / EXE-01), but a developer running `nx run ...:angular-typecheck` today gets a pass/fail with zero diagnostic output. Phase 4 should format and print the diagnostics (`ng.formatDiagnostics` exists in the same module). No change needed now.

### IN-03: Default-export signature and devkit isolation are correct

**File:** `packages/angular-typechecker/src/executors/angular-typecheck/executor.ts:1-21`
**Issue (positive confirmation):** signature is `(options, context) => Promise<{ success: boolean }>` per Nx convention; `@nx/devkit` is imported type-only (`import type { ExecutorContext }`) and the executor is the only tier referencing it; no core logic leaked into the adapter; `executors.json` `implementation` is the correct extensionless path. `_context` is intentionally unused (the known `no-unused-vars` finding deferred to WS-04/Phase 3 -- not re-flagged per scope).

### IN-04: Shim `CompilerCli` surface is structural -- a future drift in the real namespace would not be caught at the call site

**File:** `packages/angular-typechecker/src/core/compiler-cli-types.ts:34-39` + `compiler-loader.ts:17`
**Issue:** The loader casts `(await import(...)) as unknown as CompilerCli`. The double cast means the *real* runtime namespace is never structurally checked against `CompilerCli` -- if a future compiler-cli renamed `performCompilation` the type system would still believe the shim. This is inherent to the `as unknown as` bridge and is within the documented Phase-2 caveat (the shim is coupled to internal layout); the `compiler-loader.spec.ts` runtime `typeof ng.performCompilation === 'function'` assertions are what actually guard this at runtime, which is the right backstop for now. No action for Phase 1; widen the shim + keep the runtime typeof guards as the engine grows.

---

_Reviewed: 2026-06-27T16:49:12Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
_Advisory: non-blocking (phase verified GO)_
