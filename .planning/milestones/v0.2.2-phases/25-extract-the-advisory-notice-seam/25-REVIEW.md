---
phase: 25-extract-the-advisory-notice-seam
reviewed: 2026-07-16T01:57:40Z
depth: deep
files_reviewed: 4
files_reviewed_list:
  - packages/angular-typechecker/src/core/logger.ts
  - packages/angular-typechecker/src/core/emit-advisory-notices.ts
  - packages/angular-typechecker/src/core/emit-advisory-notices.spec.ts
  - packages/angular-typechecker/src/executors/typecheck/executor.ts
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: issues_found
---

# Phase 25: Code Review Report

**Reviewed:** 2026-07-16T01:57:40Z
**Depth:** deep
**Files Reviewed:** 4
**Status:** issues_found (1 Info; zero Blocker, zero Warning)

## Summary

Phase 25 (CLI-04) extracts the five advisory `warn*` helpers verbatim from
`executor.ts` into a new pure `core/emit-advisory-notices.ts` behind an injected
structural `Logger` (`core/logger.ts`), and swaps the executor's five inline
`warn*(result)` calls for a single `emitAdvisoryNotices(result, logger)`. The
correctness bar is byte-identical observable behavior vs `angular-typechecker@0.2.1`
plus additive-only (ADD-01).

I verified the core claims adversarially rather than trusting the phase notes:

- **Byte-identity (mechanical, not eyeballed):** I extracted the helper region from
  the pre-refactor executor (`git show 75a130e^`) and from the new module, normalized
  away only the `, logger: Logger` signature additions, and diffed. Result:
  **byte-identical** -- no message string, concatenation, interpolation, or body
  change. `skippedReferenceVerdictNote` correctly kept its no-`logger` signature.
- **Emission order preserved:** `emitAdvisoryNotices` calls
  `templateCheckAborted -> skippedReferences -> suppressed -> notTypeChecked ->
  bundlerQueryImports`, matching the original five-call sequence exactly. Within
  `warnSuppressed`, the `info` (node_modules) then `warn` (coverage-incomplete) order
  is unchanged.
- **D-11 core boundary intact:** `logger.ts` imports nothing (empty import graph);
  `emit-advisory-notices.ts` imports only type-only `Logger` / `CoreResult` /
  `SkippedReference` from core-internal paths. Neither touches
  `nx`/`@nx/*`/`@angular-devkit/*`/`console`/`process`. The ESLint `**/src/core/**`
  ban (`eslint.config.mjs`) is not tripped.
- **executor.ts cleanup correct:** the now-unused `CoreResult` and `SkippedReference`
  type imports were removed (they moved with the helpers), no dead imports remain
  (would fail `nx lint` at `maxWarnings:0` otherwise), and the infra-error
  `logger.error` catch path is retained unchanged. The `logger` object is still
  invoked as a method (`logger.warn(...)`) after being passed by reference, so no
  `this`-binding regression is introduced.
- **Spec is a true byte-exact anchor:** `emit-advisory-notices.spec.ts` uses full
  exact-string `toHaveBeenCalledWith` assertions (not substrings), does NOT `vi.mock`
  the module (a plain `vi.fn()` object is injected), and `satisfies Logger`
  correctly preserves the narrow `Mock` type so `.mock.invocationCallOrder` stays
  reachable. Fixture fields match the required `CoreResult` shape and the
  `TemplateCheckAborted` / `SkippedReference` type shapes.

No correctness, security, or maintainability defect was found in the submitted code.
The single Info item below is a pre-existing test-coverage observation, not a defect
introduced by this phase.

## Info

### IN-01: Cross-advisory emission order is not guarded by any automated test

**File:** `packages/angular-typechecker/src/core/emit-advisory-notices.ts:26-30`
(and `emit-advisory-notices.spec.ts` as the natural home for the guard)

**Issue:** Emission order across the five advisories
(`templateCheckAborted -> skippedReferences -> suppressed -> notTypeChecked ->
bundlerQueryImports`) is a stated key correctness property for the byte-identical
requirement, but it is guarded only by source ordering. The new spec exercises one
advisory per test, so it verifies each message and the *within*-`warnSuppressed`
info-before-warn sub-order, but never the *cross*-helper sequence. The executor spec
(`executor.spec.ts`) likewise asserts individual advisories, not their relative
order. A future edit that reorders the calls inside `emitAdvisoryNotices` would emit
correct strings and pass every existing test while silently changing observable
output order.

This is a pre-existing gap (the original inline executor had no cross-order test
either) and does not affect the current behavior, which I confirmed matches 0.2.1 --
hence Info, not Warning.

**Fix (optional, one added test):** drive a `CoreResult` that triggers all five
advisories at once and assert relative order via the same
`.mock.invocationCallOrder` mechanism already used for the info/warn sub-order:

```ts
it('emits the five advisories in the fixed order', () => {
  const logger = mockLogger();

  emitAdvisoryNotices(
    {
      ...coreResult(1),
      templateCheckAborted: { code: -993004, fileName: '/ws/a.ts' },
      skippedReferences: [{ referencePath: '/ws/b.json', reason: 'out-of-project' }],
      suppressedThirdParty: 1,
      suppressedInGraphErrorCount: 1,
      suppressedInGraphWarningCount: 0,
      suppressedInGraphFiles: ['/ws/c.ts'],
      notTypeCheckedDeclaredFiles: ['/ws/d.mdx'],
      bundlerQueryImports: ['./e?raw'],
    },
    logger,
  );

  const order = [
    ...logger.warn.mock.invocationCallOrder, // templateCheckAborted, skipped, coverage, notTypeChecked, bundler
    ...logger.info.mock.invocationCallOrder, // node_modules
  ];
  // assert templateCheckAborted warn precedes the skipped warn, info precedes
  // the coverage warn, coverage precedes notTypeChecked, etc.
});
```

---

_Reviewed: 2026-07-16T01:57:40Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
