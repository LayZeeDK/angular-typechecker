---
phase: 20-vite-analog-storybook-query-import-guidance-vite-client-read
reviewed: 2026-07-07T00:00:00Z
depth: deep
files_reviewed: 13
files_reviewed_list:
  - packages/angular-typechecker/src/core/detect-bundler-query-imports.ts
  - packages/angular-typechecker/src/core/detect-bundler-query-imports.spec.ts
  - packages/angular-typechecker/src/core/bundler-query-imports.integration.spec.ts
  - packages/angular-typechecker/src/core/run-typecheck.ts
  - packages/angular-typechecker/src/core/evaluate-result.spec.ts
  - packages/angular-typechecker/src/executors/typecheck/executor.ts
  - packages/angular-typechecker/src/executors/typecheck/executor.spec.ts
  - fixtures/vite-query-imports/src/widget.stories.ts
  - fixtures/vite-query-imports/src/worklet.ts
  - fixtures/vite-query-imports/src/extra.ts
  - fixtures/vite-query-imports/tsconfig.base.json
  - fixtures/vite-query-imports/tsconfig.baseline.json
  - fixtures/vite-query-imports/tsconfig.vite-client.json
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-07-07T00:00:00Z
**Depth:** deep
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 20 (SB-09) adds `detectBundlerQueryImports`, a pure diagnostic-derived detector
that surfaces unresolved Vite/Analog `?query` imports (`?raw`/`?url`/`?worker`/`?inline`)
as a fifth advisory notice, wired at the single `finalize` seam and rendered by the
executor adapter.

I verified the four named risk areas end-to-end and all four hold:

1. **2307 gate ordering (Pitfall 2):** `diagnostic.code !== 2307` is checked BEFORE the
   message match (detect-bundler-query-imports.ts:38-40), so the sibling `2732`/`2792`
   "Cannot find module" hints are excluded. The unit spec proves the gate with a
   `2732`-coded `?query` diagnostic that is correctly NOT flagged.
2. **ReDoS safety:** the extraction regex `/Cannot find module '([^']+)'/` uses a single
   linear negated character class -- no nested quantifier, no catastrophic backtracking --
   and the input is compiler-owned message text.
3. **Verdict-neutrality:** confirmed by reading `evaluate-result.ts` (not just its spec).
   `EvaluateInput` (evaluate-result.ts:69-78) deliberately omits `bundlerQueryImports`, and
   the function body never references it. `finalize` derives `errorCount`/`warningCount`
   from the same `reported` set independently, and the executor reads only `.success` from
   `evaluateResult`. The `?query` TS2307 stay counted errors and drive the verdict; the
   field only names them. Tripwire tests in evaluate-result.spec.ts:247-271 lock this.
4. **Content-isolation:** the detector scans `reported` (the POST-boundary-filter kept set,
   run-typecheck.ts:671) -- NOT the pre-filter superset that `detectTemplateCheckAborted`
   scans -- so a boundary-filtered node_modules `?query` is never named. The advisory
   emits `match[1]` (the specifier string the consumer wrote in their own import), never
   dependency error prose.

Additional cross-checks that passed: `vite@^8.0.0` is a direct devDependency and
`node_modules/vite/client.d.ts` declares all four `*?query` wildcards, so the
integration test's `vite/client` self-gating leg is well-founded (not flaky infra); the
fixture's referenced base files (`snippet.md`, `icon.svg`, `worklet.ts`, `extra.ts`) all
exist; the empty-set -> `undefined` mapping and self-gating length checks are consistent
across core and adapter; the guard/walk paths never spuriously fire the advisory.

No blocking defects. One robustness/consistency warning and two low-severity notes follow.

## Warnings

### WR-01: Specifier extraction depends on the English diagnostic message, contradicting the codebase's own documented anti-pattern

**File:** `packages/angular-typechecker/src/core/detect-bundler-query-imports.ts:42-53`
**Issue:** The detector recovers the module specifier by regex-matching the flattened,
localizable message text `Cannot find module '([^']+)'`. If the Angular/TypeScript
compiler runs under a non-English `--locale` / `ui-locale`, the message is translated, the
regex returns `null`, and the advisory silently produces nothing for genuinely unresolved
`?query` imports.

This directly contradicts an explicit convention the project established and documented
elsewhere for exactly this reason. `filter-diagnostics.ts:324-325` states: "Match by
EXTENSION only; never the English message text (locale-fragile)." Every other detector in
this milestone is locale-safe by design -- `detectTemplateCheckAborted`
(run-typecheck.ts:705-720) and both `throwIfInfrastructureFailure` scans
(run-typecheck.ts:169-183) detect BY CODE only. This module is the sole place in the
reviewed set that reintroduces English-message coupling.

The docstring (lines 46-48) justifies the regex only on ReDoS grounds ("messageText is
compiler-owned, not user input") and does not disclose the locale limitation, so a future
maintainer has no signal that the advisory is locale-conditional.

Severity is WARNING, not BLOCKER: this is verdict-neutral (the TS2307 still fails; no
silent false pass), so it degrades robustness/coverage of the advisory, not correctness.

**Fix:** There is no structured specifier field on `ts.Diagnostic`, so a full locale-safe
extraction would require reading the source text at `diagnostic.start`/`length` (not
available to this pure detector). At minimum, document the English-locale assumption on the
detector so the limitation is explicit, e.g.:

```typescript
// LIMITATION: specifier recovery relies on the ENGLISH TS2307 message shape. Under a
// non-English compiler --locale the match fails and this advisory silently no-ops. This is
// verdict-neutral (the TS2307 still fails), but unlike the code-only sibling detectors
// (detectTemplateCheckAborted, the infra-500 scans) this one is locale-conditional. If
// locale-safe extraction is ever required, resolve the specifier from the source file at
// the diagnostic's start/length rather than from message text.
```

If the advisory is expected to fire in localized CI at all, escalate to resolving the
specifier via the program's source-file text at the diagnostic position (the same
robustness bar `filter-diagnostics.ts` set for template ownership).

## Info

### IN-01: The `?`-presence heuristic can false-positive on non-bundler specifiers; the docstring's "NEVER contain one" claim is overstated

**File:** `packages/angular-typechecker/src/core/detect-bundler-query-imports.ts:4-8, 51`
**Issue:** The docstring asserts that "TypeScript and Node module specifiers NEVER contain
[a `?`]" and the gate flags any kept TS2307 specifier containing `?`. URL-style imports
(e.g. `import x from 'https://cdn.example/mod.js?v=1'`) and other query-bearing specifiers
also contain `?`; if such an import surfaces as a kept TS2307, it would be reported as a
"bundler query import" and the notice would suggest `"types": ["vite/client"]`, which would
not resolve it. Impact is low: this is advisory-only, verdict-neutral, and such imports are
rare in Angular sources.
**Fix:** Soften the absolute claim in the docstring (e.g. "a `?` in a specifier is
overwhelmingly a bundler query; URL/query specifiers are the rare exception and, being
advisory-only, do not affect the verdict"). No code change required.

### IN-02: Integration test's `errorCount > flagged.length` assertion is implicitly coupled to the fixture producing no incidental type errors

**File:** `packages/angular-typechecker/src/core/bundler-query-imports.integration.spec.ts:94-96`
**Issue:** The baseline-leg assertion `result.errorCount > (result.bundlerQueryImports ??
[]).length` relies on the fixture yielding exactly the 4 `?query` TS2307 plus the 1
plain-missing control (5 > 4). It holds today because `widget.stories.ts` only re-exports
the failed (`any`-typed) imports and `worklet.ts`/`extra.ts` are `export {}`. If the fixture
sources ever grow an incidental strict-mode error unrelated to the queries, the assertion
would still pass while silently no longer proving "the plain-missing control adds a distinct
error beyond the flagged queries." The per-specifier `toContain` checks (lines 77-79) remain
the load-bearing proof.
**Fix:** Optional hardening -- assert the exact expected delta instead of a strict-greater
bound (e.g. `errorCount === QUERY_SPECIFIERS.length + 1`) so an incidental fixture error
fails loudly rather than being absorbed. Not required; current coverage is adequate.

---

_Reviewed: 2026-07-07T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
