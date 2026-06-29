---
phase: 02-core-type-check-engine-gatherer
reviewed: 2026-06-27T20:12:32Z
depth: deep
files_reviewed: 28
files_reviewed_list:
  - packages/angular-typechecker/src/core/run-typecheck.ts
  - packages/angular-typechecker/src/core/compiler-cli-types.ts
  - packages/angular-typechecker/src/core/diagnostic-codes.ts
  - packages/angular-typechecker/src/core/compiler-loader.ts
  - packages/angular-typechecker/src/core/gather-diagnostics.ts
  - packages/angular-typechecker/src/index.ts
  - packages/angular-typechecker/tsconfig.lib.json
  - packages/angular-typechecker/src/core/gather-diagnostics.spec.ts
  - packages/angular-typechecker/src/core/gate-b.spec.ts
  - packages/angular-typechecker/src/core/run-typecheck.integration.spec.ts
  - packages/angular-typechecker/src/core/infra-failure.spec.ts
  - packages/angular-typechecker/src/core/config-resolution.integration.spec.ts
  - packages/angular-typechecker/src/core/baseline.angular13.integration.spec.ts
  - packages/angular-typechecker/src/core/extended.angular13.integration.spec.ts
  - packages/angular-typechecker/src/core/extended.angular17.integration.spec.ts
  - packages/angular-typechecker/src/core/no-emit-override.integration.spec.ts
  - fixtures/ts-baseline/tsconfig.app.json
  - fixtures/ng-baseline/tsconfig.app.json
  - fixtures/extended-v13/tsconfig.app.json
  - fixtures/extended-promoted/tsconfig.app.json
  - fixtures/composite-triangle/tsconfig.json
  - fixtures/no-emit-message/tsconfig.app.json
  - fixtures/config-broken/tsconfig.spec.json
  - fixtures/config-broken/tsconfig.malformed.json
  - fixtures/solution-style/tsconfig.json
  - fixtures/solution-style/tsconfig.app.json
  - fixtures/gate-b-error/tsconfig.app.json
  - fixtures/gate-b-error/tsconfig.lib.json
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-06-27T20:12:32Z
**Depth:** deep
**Files Reviewed:** 28
**Status:** issues_found

## Summary

Adversarial deep review of the Phase 2 core type-check engine and gatherer:
`run-typecheck.ts`, `gather-diagnostics.ts`, `compiler-loader.ts`,
`compiler-cli-types.ts`, `diagnostic-codes.ts`, `index.ts`, the plugin
`tsconfig.lib.json`, the nine spec files, and the eight test-fixture trees.

The engine's load-bearing correctness claims were independently verified against
the installed `@angular/compiler-cli@22.0.4` and `typescript@6.0.x`, not merely
accepted from the comments:

- **D-01 counting** -- `errorCount`/`warningCount` are computed by explicit
  `ts.DiagnosticCategory` filters in `finalize`, never `length - errorCount`.
  The documented invariant `errorCount + warningCount <= diagnostics.length`
  holds structurally (the two filters are mutually exclusive subsets). CORRECT.
- **D-03 prepend + zero-rootNames guard** -- `parsed.errors` is captured before
  the guard and prepended on both the guard path and the normal path; the guard
  gates on `parsed.rootNames.length === 0` (NOT TS18003, which TS suppresses when
  a config has `references`). Verified the `solution-style` fixture path returns
  `rootNamesCount: 0` + exactly one synthesized Error. CORRECT.
- **D-05 override completeness** -- the emit-neutralizing override clears every
  option that pairs with `noEmit`/`composite`/`declaration` to produce a spurious
  conflict (composite, declaration, declarationMap, emitDeclarationOnly,
  declarationDir, incremental, tsBuildInfoFile, source/inline maps). The
  `emitDeclarationOnly: false` clear specifically prevents the `noEmit` +
  `emitDeclarationOnly` conflict; `declarationDir: undefined` prevents the TS5069
  orphan. The composite-triangle fixture proves TS5053/6304/6379 are neutralized.
  CORRECT for the cases exercised.
- **D-06 infra re-throw** -- detection is by `diagnostic.code === ng.UNKNOWN_ERROR_CODE`
  (500) only, never by source. Confirmed empirically that TypeScript defines NO
  diagnostic with code 500 (`ts.Diagnostics` has zero entries with `code === 500`)
  and that Angular's codes are negative-encoded or 8xxx, so the `=== 500` check
  cannot collide with a genuine TS or NG diagnostic. The re-throw happens before
  `finalize`, so an infra crash never lands in `errorCount`. CORRECT.
- **Gatherer ordering** -- `gatherAllDiagnostics` calls the six getters in the
  exact same order as the bundled `defaultGatherDiagnostics`
  (`getTsOptionDiagnostics` -> `getNgOptionDiagnostics` -> `getTsSyntacticDiagnostics`
  -> `getTsSemanticDiagnostics` -> `getNgStructuralDiagnostics` ->
  `getNgSemanticDiagnostics`), minus the `&&`-chain short-circuit. Verified
  against `bundles/chunk-6ZBSJK4S.js:600`. CORRECT differential.
- **NG() encoding** -- `NG(code) = -990000 - code` equals the compiler's
  `parseInt('-99' + code)` for every 4-digit code in use (8001/8101/8109/8117).
  Arithmetic verified. CORRECT for current usage (see IN-02 for the latent edge).

**Security:** no `eval`, no `child_process`/`exec`/shell, no `new Function`, no
real `process.cwd()`/`process.env` usage in source. The only untrusted input is
the consumer `tsConfigPath` passed to `readConfiguration`, whose file/`extends`
reads are inherent to the tool's purpose (a CI/dev type-checker operating on the
consumer's own workspace). No injection or traversal vulnerability in scope.

**Tests:** 39/39 pass across 12 files (re-run during review, confirmed green).
No test-correctness defects found (assertions match the engine contract and the
fixtures genuinely trigger the diagnostics they assert).

The findings below are quality/maintainability defects -- dead and
self-contradicting config, a mislabeled timing metric, and a misnamed/under-
covering spec. None block shipping the Phase 2 engine.

## Warnings

### WR-01: Dead `tsconfig.lib.json` fixture excludes + false "excluded" comments throughout the fixtures

**File:** `packages/angular-typechecker/tsconfig.lib.json:26-27`
**Issue:** The lib tsconfig excludes `"fixtures/gate-b-error/**/*"` and
`"fixtures/**/*"`. Both paths are resolved relative to the project root
(`packages/angular-typechecker/`), but there is NO `packages/angular-typechecker/fixtures/`
directory -- the fixtures live at the workspace root (`fixtures/`). Verified:
`ls packages/angular-typechecker/fixtures` -> "No such file or directory". These
two exclude globs therefore match nothing and are pure dead config. The fixtures
are kept out of the package build solely by `"include": ["src/**/*.ts"]`, which
already scopes compilation to `src/`.

The harm is not a broken build (build stays green) but actively misleading
documentation: at least seven fixture files assert in their header comments that
they are "excluded from the plugin's tsconfig.lib.json (fixtures/**/*)" -- e.g.
`fixtures/gate-b-error/error.component.ts:4-5`,
`fixtures/ts-baseline/error.component.ts:4-6`,
`fixtures/config-broken/error.component.ts:6-8`. That stated mechanism is false;
a future maintainer who relocates fixtures under the package, or who deletes the
`include` narrowing trusting the exclude as the real guard, would pull the
deliberately-broken fixtures into the published build.
**Fix:** Either delete the two ineffective excludes (the `include` already does
the job) and correct the fixture comments to say "kept out by tsconfig.lib.json's
`include: src/**/*.ts` scope", or, if an explicit exclude is desired as
defense-in-depth, point it at the real location with a workspace-root-relative
path:
```jsonc
// tsconfig.lib.json -- remove the non-matching entries:
"exclude": [
  "vite.config.ts", "vite.config.mts", "vitest.config.ts", "vitest.config.mts",
  "src/**/*.test.ts", "src/**/*.spec.ts",
  "src/**/*.test.tsx", "src/**/*.spec.tsx",
  "src/**/*.test.js", "src/**/*.spec.js",
  "src/**/*.test.jsx", "src/**/*.spec.jsx"
  // (fixtures/** excludes deleted: no fixtures dir under this project root)
]
```

### WR-02: `durationMs` mislabeled "cold-run wall-clock" while excluding the dominant cold-start cost

**File:** `packages/angular-typechecker/src/core/run-typecheck.ts:71-81`
**Issue:** `start = performance.now()` is captured at line 81, AFTER
`await loadCompilerCli()` (line 71), `await loadTypescript()` (line 72), and
`ng.readConfiguration(...)` (line 74). So `durationMs = performance.now() - start`
(line 219) measures only the `performCompilation` + gather window and EXCLUDES
the ESM module load of `@angular/compiler-cli` and the config parse -- which are
precisely the largest components of a genuine cold start. `gate-b.spec.ts:93-99`
logs this value under the banner "GATE B timing (cold-run wall-clock)" and
"cold-run durationMs", so the reported number systematically under-reports the
real cold cost and any downstream SUMMARY/agent that quotes it as wall-clock is
misled. (The test only asserts `> 0`, so this does not fail today -- it is a
correctness defect in the metric's meaning, not a test break.)
**Fix:** Capture `start` at the top of `runTypecheck`, before the awaited loads,
so `durationMs` reflects the full call. If a "compile-only" sub-metric is also
wanted, add a separate field rather than redefining the labeled one:
```ts
export async function runTypecheck(options: CoreOptions): Promise<CoreResult> {
  const start = performance.now(); // move to the top: include module load + config parse

  const ng = await loadCompilerCli();
  const ts = await loadTypescript();
  const parsed = ng.readConfiguration(options.tsConfigPath);
  // ... remove the later `const start = performance.now();`
}
```
Alternatively, if the intent really is to exclude module load (e.g. because the
loader memoizes after the first call), relabel the field and the gate-b banner to
"compile durationMs" so the metric's name matches its semantics.

## Info

### IN-01: `extended.angular17.integration.spec.ts` is misnamed and adds no v17 coverage

**File:** `packages/angular-typechecker/src/core/extended.angular17.integration.spec.ts:1-57`
**Issue:** The filename promises an Angular-v17 extended-diagnostics slice, but
the spec contains no v17-specific code: it reuses the v13-introduced NG8101
(`INVALID_BANANA_IN_BOX`) via the `extended-promoted` fixture to prove
category promotion. There is no `fixtures/extended-v17/` tree at all (verified:
glob returns nothing). The spec's own comment concedes "The promotion mechanism
is version-independent, so it is asserted here against the portable NG8101 shape."
The result is a coverage gap masked by the filename -- the additive v13->v22
catalog (D-07a) has a v17 slot that is empty, and a reader scanning file names
would wrongly assume v17 extended codes are covered.
**Fix:** Rename the file to reflect what it actually proves (e.g.
`extended.promotion.integration.spec.ts`), or genuinely add a v17-introduced
extended diagnostic + matching `fixtures/extended-v17/` tree so the name is
truthful. At minimum, drop "angular17" from the name to avoid the false coverage
signal.

### IN-02: `NG()`/`ngCodeOf()` silently assume 4-digit codes with no precondition guard

**File:** `packages/angular-typechecker/src/core/diagnostic-codes.ts:31,37`
**Issue:** `NG(code) = -990000 - code` only equals the compiler's
`ngErrorCode(code) = parseInt('-99' + code)` when `code` is exactly 4 digits.
For a 3-digit code the two diverge (`NG(801) = -990801` vs
`parseInt('-99801') = -99801`); for 5 digits likewise. The header comment states
the formulas "agree for every 4-digit NG code" but the function signature accepts
any `number` with no runtime or type-level guard, so a future caller passing a
non-4-digit Angular code would silently compute a wrong, never-matching value --
the exact "bare 8109 never matches" trap the module exists to prevent, just one
level up. All current NG codes (8001/8101/8109/8117) are 4-digit, so this is
latent, not active.
**Fix:** Document the 4-digit precondition on the function itself (not only in
the file header), and consider a dev-only assertion:
```ts
export const NG = (code: number): number => {
  // Precondition: `code` is a 4-digit Angular ErrorCode (1000-9999). The
  // `-990000 - code` shortcut only equals parseInt('-99' + code) for 4 digits.
  return -990000 - code;
};
```

### IN-03: Redundant exclude entry in `tsconfig.lib.json`

**File:** `packages/angular-typechecker/tsconfig.lib.json:26`
**Issue:** `"fixtures/gate-b-error/**/*"` is a strict subset of the following
`"fixtures/**/*"` on line 27, so it is redundant even if the paths matched
anything (they do not -- see WR-01). Dead, duplicated config.
**Fix:** Remove line 26 (and line 27 per WR-01).

### IN-04: Near-zero `durationMs` on the zero-rootNames guard path

**File:** `packages/angular-typechecker/src/core/run-typecheck.ts:81-98`
**Issue:** On the guard path, `start` is captured (line 81) immediately before
synthesizing a single diagnostic and returning, so `durationMs` for a
solution-style / empty-project config is effectively ~0ms while still excluding
the config-parse and module-load work that actually happened. The CoreResult
contract documents `durationMs` without noting it can be a near-zero/meaningless
value on this branch. Low impact (no consumer asserts `durationMs > 0` for this
path today), but the field's value is misleading there.
**Fix:** Folding into the WR-02 fix (capturing `start` at the top of the function)
also gives the guard path a meaningful `durationMs` covering config parse + load.

---

_Reviewed: 2026-06-27T20:12:32Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
