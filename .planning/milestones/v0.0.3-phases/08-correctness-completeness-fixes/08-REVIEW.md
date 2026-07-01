---
phase: 08-correctness-completeness-fixes
reviewed: 2026-06-29T18:51:00Z
depth: deep
files_reviewed: 14
files_reviewed_list:
  - packages/angular-typechecker/src/core/run-typecheck.ts
  - packages/angular-typechecker/src/core/gather-diagnostics.ts
  - packages/angular-typechecker/src/core/filter-diagnostics.ts
  - packages/angular-typechecker/src/core/exit-codes.ts
  - packages/angular-typechecker/src/core/exit-codes.spec.ts
  - packages/angular-typechecker/src/core/filter-diagnostics.spec.ts
  - packages/angular-typechecker/src/core/gather-diagnostics.spec.ts
  - packages/angular-typechecker/src/core/infra-failure.spec.ts
  - packages/angular-typechecker/src/core/config-resolution.integration.spec.ts
  - packages/angular-typechecker/src/core/global-diagnostics.integration.spec.ts
  - packages/angular-typechecker/src/executors/angular-typecheck/executor.spec.ts
  - fixtures/global-diagnostics/tsconfig.json
  - fixtures/global-diagnostics/global-error.ts
  - packages/angular-typechecker/vitest.config.mts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-06-29T18:51:00Z
**Depth:** deep
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Adversarial deep review of the Phase 8 correctness/completeness fixes across the
diagnostic pipeline `runTypecheck -> gatherAllDiagnostics -> filterDiagnostics ->
finalize`, plus the new pure `core/exit-codes` policy. I traced the four COR
changes end to end, ran the affected unit + real-compiler integration specs,
built the package (the structural-types drift guard), and ran lint.

**All four COR fixes are correct and behave as documented**, verified against the
real `@angular/compiler-cli@22.0.4`:

- **COR-01** (config-resolution 500 re-thrown before the zero-rootNames guard):
  confirmed by runtime probe that a nonexistent tsconfig path yields exactly one
  `code: 500` (`source: 'angular'`) error with `rootNames.length === 0`, so the
  early scan MUST precede the guard -- the implementation places it correctly.
  `ng.UNKNOWN_ERROR_CODE === 500` confirmed at runtime; the code-only predicate
  matches the post-`performCompilation` scan (no `source`/text coupling). Both
  500 scans coexist as documented.
- **COR-02** (7th getter `getTsProgram().getGlobalDiagnostics()`): confirmed by
  runtime probe that the `global-diagnostics` fixture emits 10 file-less TS2318
  diagnostics through `getGlobalDiagnostics()` only; the file-less classification
  in the comment is accurate, and `sortAndDeduplicateDiagnostics` keeps all 10
  (they are distinct global type names, not duplicates -- the dedup claim holds).
- **COR-03** (file-less guard widened to `file === undefined || file.fileName ===
''`): correct; the empty-`fileName` canonicalizes to `''` and `isUnderDir('',
base) === false`, so the widened guard prevents a real-error false PASS. Spec
  asserts the failing-then-passing transition.
- **COR-04** (pure `toExitCode` 0/1/2): pure (imports only `./run-typecheck`,
  within the `core/**` boundary), correctly NOT wired into the executor return
  per D-08. `instanceof` discrimination of the union is sound.

Build, lint, and every Phase 8 spec pass green. The only lint warning is the
pre-existing unused `NG` helper at `config-resolution.integration.spec.ts:30`
(introduced in commit `07af39e`, plan 02-02 -- not this phase; confirmed via
`git log -L`).

No BLOCKER-class defects found. Two WARNINGs concern the `toExitCode` contract
(latent, because D-08 defers wiring it) and three INFO items are
documentation/quality nits.

## Warnings

### WR-01: `toExitCode` ignores the warning gate, diverging from `evaluateResult` -- a future `--max-warnings` failure will exit 0 (clean)

**File:** `packages/angular-typechecker/src/core/exit-codes.ts:34-46`
**Issue:** `exit-codes.ts` describes `toExitCode` as the "exit-code sibling of
`evaluate-result.ts`'s `{ success }` verdict: the single source of truth that
classifies a run as clean / type-error / infrastructure-failure". But the two
classifiers DIVERGE on the warning gate. `evaluateResult` returns
`{ success: false }` when `warningCount > maxWarnings`
(`evaluate-result.ts:54`), which the Nx executor maps to a failing run. By
contrast `toExitCode` inspects ONLY `errorCount`:

```ts
if (input.errorCount > 0) {
  return 1;
}
return 0;
```

So a run that PASSES the type-error check but FAILS the `--max-warnings` gate
(e.g. `warningCount: 5, maxWarnings: 0`) returns `{ success: false }` through the
executor today, yet would return exit code `0` (clean) the moment the deferred
standalone CLI wires `toExitCode` into `process.exit`. That is the exact
"reported as clean when it is a logical failure" hazard the module's own header
warns against -- just shifted from the infra branch to the warning branch. The
module header and the EXIT-CODE CONTRACT comment never mention warnings at all,
so the gap is silent.

This is a WARNING (not a BLOCKER) only because D-08 keeps `toExitCode`
unwired: no production consumer is affected yet. It becomes a live correctness
bug the instant the CLI surface adopts it.

**Fix:** Either (a) make `toExitCode` accept the warning gate so it matches
`evaluateResult`'s verdict, deriving exit `1` from the same `{ success: false }`
decision; or (b) if exit-code policy is deliberately error-only (ngc parity:
`ngc` exits non-zero on errors, not on warnings), state that explicitly in the
EXIT-CODE CONTRACT and document that the CLI must combine `toExitCode` with the
`evaluateResult` verdict for the warning gate. Concretely, option (a):

```ts
export function toExitCode(input: Pick<CoreResult, 'errorCount' | 'warningCount'> | TypecheckInfrastructureError, options: { maxWarnings?: number } = {}): 0 | 1 | 2 {
  if (input instanceof TypecheckInfrastructureError) {
    return 2;
  }

  if (input.errorCount > 0) {
    return 1;
  }

  const { maxWarnings } = options;
  const gatesWarnings = maxWarnings !== undefined && Number.isFinite(maxWarnings) && maxWarnings >= 0;

  if (gatesWarnings && input.warningCount > maxWarnings) {
    return 1;
  }

  return 0;
}
```

At minimum, add a spec case locking the chosen warning-gate semantics so the
contract is testable before the CLI consumes it.

### WR-02: `toExitCode` / `exit-codes.ts` is unreachable in this phase and not part of the public API surface -- its "three consumers" contract is unvalidated end to end

**File:** `packages/angular-typechecker/src/core/exit-codes.ts:1-46`, `packages/angular-typechecker/src/index.ts`
**Issue:** `toExitCode` has no production caller. A repo search shows it is
imported only by its own `exit-codes.spec.ts`; the executor uses
`evaluateResult`, never `toExitCode`. The module header asserts "One definition,
three consumers (Nx executor now, Angular CLI builder + CLI later)", but the Nx
executor does NOT consume it (correct per D-08), and the future consumers cannot
reach it because `exit-codes.ts` is NOT re-exported from the package's public
`src/index.ts` (every sibling core utility -- `evaluateResult`,
`filterDiagnostics`, `gatherAllDiagnostics`, `runTypecheck` -- IS exported there;
`toExitCode` is the lone omission). The result is dead code whose only validation
is a unit test of literals; nothing exercises it against a real `CoreResult` or a
real process boundary, so the "single source of truth" claim is aspirational, not
proven.

The header comment "Nx executor now" is therefore factually inaccurate for the
current state -- the Nx executor consumes `evaluateResult`, not this policy.

**Fix:** Pick one and make the comment match reality:

- If `toExitCode` is meant to be consumable by the deferred CLI/builder, export
  it from `src/index.ts` now (`export { toExitCode } from './core/exit-codes';`)
  so it is part of the published contract the future consumers import, and the
  `@nx/dependency-checks`/public-API surface tracks it.
- Correct the header's "three consumers (Nx executor now, ...)" wording: the Nx
  executor does not consume `toExitCode` (D-08 binds it to `{ success }`), so
  "now" overstates current usage. Reword to "zero consumers now (deferred per
  D-08); CLI + builder later".

## Info

### IN-01: Stale test title -- "calls all six getters" after the seventh getter was added (COR-02)

**File:** `packages/angular-typechecker/src/core/gather-diagnostics.spec.ts:14`
**Issue:** The first test is titled `'calls all six getters unconditionally and
in order'` and asserts the six per-Program getter names + their six codes. COR-02
added a SEVENTH getter (`getTsProgram().getGlobalDiagnostics()`). The test still
passes because the stubbed `getGlobalDiagnostics` returns `[]` and is not pushed
into the `calls[]` tracker, but the title now under-counts the gatherer's actual
fan-out and reads as if six is the full set. A maintainer scanning the suite
could wrongly conclude the seventh getter is untested in the ordering test.
**Fix:** Rename to reflect intent, e.g. `'calls the six per-Program getters
unconditionally and in order (the seventh global getter is covered below)'`, and
keep the inline comment at lines 30-33 that already explains why the global getter
is stubbed empty here.

### IN-02: Pre-existing unused `NG` helper still present (predates Phase 8)

**File:** `packages/angular-typechecker/src/core/config-resolution.integration.spec.ts:30`
**Issue:** `const NG = (code: number): number => -990000 - code;` is declared but
never used (the file asserts only `TS2322`), producing the lone lint warning
(`@typescript-eslint/no-unused-vars`). Confirmed via `git log -L` that this line
was introduced in plan 02-02 (commit `07af39e`), NOT in Phase 8 -- the prompt
flagged it as pre-existing. Phase 8 added the COR-01 `describe` block to this file
without touching the helper. Noting it only so the warning is accounted for; it is
not a Phase 8 regression.
**Fix:** Out of Phase 8 scope, but a one-line cleanup: delete the unused `NG`
helper (no NG-coded assertion exists in this file), or prefix it `_NG` if it is
intentionally retained as documentation of the encoding.

### IN-03: `filterDiagnostics` file-less guard catches `fileName === ''` but not a `fileName: undefined` edge (type-impossible, defensive only)

**File:** `packages/angular-typechecker/src/core/filter-diagnostics.ts:85`, `packages/angular-typechecker/src/core/filter-diagnostics.ts:120-135`
**Issue:** The widened guard is `diagnostic.file === undefined ||
diagnostic.file.fileName === ''`. If a diagnostic ever carried a `file` object
whose `fileName` were `undefined` (rather than `''`), the guard would NOT catch
it; `canonicalize(undefined)` would then call `options.realpath(undefined)` and
`.replace(/\\/g, '/')` on the result, risking a `TypeError`. In practice
`ts.SourceFile.fileName` is typed `string` and is always present, so this case is
type-impossible from the real compiler -- hence INFO, not a bug. Raised only
because the COR-03 widening explicitly hardens against synthesized-diagnostic
edges, and `undefined` is the adjacent edge a synthesizer could produce.
**Fix:** Optional hardening to fully cover the "no usable path" family in one
predicate: `if (diagnostic.file === undefined || !diagnostic.file.fileName)`
(an empty string and `undefined` are both falsy), which subsumes the current
`=== ''` check without changing behavior on real inputs.

---

_Reviewed: 2026-06-29T18:51:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
