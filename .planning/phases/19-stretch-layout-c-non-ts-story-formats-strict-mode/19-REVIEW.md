---
phase: 19-stretch-layout-c-non-ts-story-formats-strict-mode
reviewed: 2026-07-07T00:10:45Z
depth: deep
files_reviewed: 30
files_reviewed_list:
  - .nxignore
  - e2e/angular-typechecker-install-e2e/fixtures/consumer-storybook-composition/lib-buttons/.storybook/main.ts
  - e2e/angular-typechecker-install-e2e/fixtures/consumer-storybook-composition/lib-buttons/.storybook/tsconfig.json
  - e2e/angular-typechecker-install-e2e/fixtures/consumer-storybook-composition/lib-buttons/project.json
  - e2e/angular-typechecker-install-e2e/fixtures/consumer-storybook-composition/lib-buttons/src/button.component.ts
  - e2e/angular-typechecker-install-e2e/fixtures/consumer-storybook-composition/lib-buttons/src/button.stories.ts
  - e2e/angular-typechecker-install-e2e/fixtures/consumer-storybook-composition/lib-buttons/tsconfig.app.json
  - e2e/angular-typechecker-install-e2e/fixtures/consumer-storybook-composition/lib-buttons/tsconfig.json
  - e2e/angular-typechecker-install-e2e/fixtures/consumer-storybook-composition/lib-cards/.storybook/main.ts
  - e2e/angular-typechecker-install-e2e/fixtures/consumer-storybook-composition/lib-cards/.storybook/tsconfig.json
  - e2e/angular-typechecker-install-e2e/fixtures/consumer-storybook-composition/lib-cards/project.json
  - e2e/angular-typechecker-install-e2e/fixtures/consumer-storybook-composition/lib-cards/src/card.component.ts
  - e2e/angular-typechecker-install-e2e/fixtures/consumer-storybook-composition/lib-cards/src/card.stories.ts
  - e2e/angular-typechecker-install-e2e/fixtures/consumer-storybook-composition/lib-cards/tsconfig.app.json
  - e2e/angular-typechecker-install-e2e/fixtures/consumer-storybook-composition/lib-cards/tsconfig.json
  - e2e/angular-typechecker-install-e2e/fixtures/consumer-storybook-composition/nx.json
  - e2e/angular-typechecker-install-e2e/fixtures/consumer-storybook-composition/package.json
  - e2e/angular-typechecker-install-e2e/fixtures/consumer-storybook-composition/storybook-host/.storybook/main.ts
  - e2e/angular-typechecker-install-e2e/fixtures/consumer-storybook-composition/storybook-host/.storybook/tsconfig.json
  - e2e/angular-typechecker-install-e2e/fixtures/consumer-storybook-composition/storybook-host/project.json
  - e2e/angular-typechecker-install-e2e/fixtures/consumer-storybook-composition/storybook-host/tsconfig.json
  - e2e/angular-typechecker-install-e2e/src/storybook-composition.int.spec.ts
  - packages/angular-typechecker/README.md
  - packages/angular-typechecker/src/core/evaluate-result.spec.ts
  - packages/angular-typechecker/src/core/evaluate-result.ts
  - packages/angular-typechecker/src/executors/typecheck/executor.spec.ts
  - packages/angular-typechecker/src/executors/typecheck/executor.ts
  - packages/angular-typechecker/src/executors/typecheck/normalize-options.spec.ts
  - packages/angular-typechecker/src/executors/typecheck/normalize-options.ts
  - packages/angular-typechecker/src/executors/typecheck/schema.d.ts
  - packages/angular-typechecker/src/executors/typecheck/schema.json
  - packages/angular-typechecker/src/executors/typecheck/schema-parity.spec.ts
  - packages/angular-typechecker/src/storybook-docs.spec.ts
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-07-07T00:10:45Z
**Depth:** deep
**Files Reviewed:** 30
**Status:** issues_found

## Summary

Reviewed the phase-19 change set: the opt-in `strict` verdict gate in
`evaluate-result.ts`, its threading through `schema.json` / `schema.d.ts` /
`normalize-options.ts` / `executor.ts`, the README `## Storybook` /
`### Storybook Composition` coverage prose, the `storybook-docs.spec.ts` content
tripwire, and the Storybook Composition e2e fixtures + `storybook-composition.int.spec.ts`.

I took a FORCE adversarial stance and traced every load-bearing claim end to end.
The phase is fundamentally sound. Specifically verified:

- **Strict gate correctness (T-19-01 / T-19-02).** `(gatesWarnings || strict) && suppressedInGraphWarningCount > 0`
  only widens an OR guard on a `return { success: false }` path. `strict`
  defaults `false` at every layer (`schema.json` `default: false`, `schema.d.ts`
  optional, `normalize-options` `options.strict ?? false`, `evaluate-result`
  destructuring `strict = false`). It can add a fail path and can never turn a
  fail into a pass. A dropped in-graph ERROR already fails unconditionally
  (line 105) independent of `strict`. NaN/negative/`null` `strict` all read
  falsy safely. No defect.
- **Schema <-> d.ts <-> normalized-options parity.** The 5-key set matches and is
  guarded by `schema-parity.spec.ts`; `strict` default `false` is asserted there.
- **README refs claim is NOT an over-claim.** The prose correctly credits the
  consumer-declared ref shape (not `StorybookConfig['refs']`, which is `any`) for
  catching a bad ref, and rests the Composition coverage on per-project
  `typecheck` + `dependsOn:["^typecheck"]` + `implicitDependencies` + `run-many`/
  `affected`. All `storybook-docs.spec.ts` tripwire strings match the README
  verbatim.
- **e2e negatives fail for the intended reason (not false-green).** The
  `url: 123` refs test fails on a real `CompositionRef.url: string` violation
  (the fixture declares its OWN ref shape, matching the README claim); the
  `count: "not-a-number"` story test fails on a real in-project TS2322. Both use
  unique anchors, `expect(injected).not.toBe(original)` to guard a no-op replace,
  `skipNxCache: true`, and plant-then-restore in `finally`. A clean baseline
  asserts exit 0 first, so a planted failure is attributable to the plant.

No BLOCKERs. The findings below are a documentation-accuracy WARNING in the
user-facing `schema.json` `strict` description plus three INFO items.

## Warnings

### WR-01: `schema.json` `strict` description describes a verdict state that cannot exist

**File:** `packages/angular-typechecker/src/executors/typecheck/schema.json:31`
**Issue:** The `strict` option description ends with:

> "Default reports coverage-incomplete without failing on a dropped in-graph warning."

This collides with the tool's formal `Outcome` vocabulary and describes a state
that the verdict model never produces. Per `evaluate-result.ts`:

- With `strict` off and `maxWarnings` UNSET, a dropped in-graph warning yields
  `outcome: 'clean'` / `success: true` (lines 135-139) -- NOT `coverage-incomplete`.
- With `strict` off and `maxWarnings` gated, a dropped in-graph warning yields
  `outcome: 'coverage-incomplete'` / `success: false`.

`coverage-incomplete` is by definition a FAILING outcome (`success: false`), so
"reports coverage-incomplete WITHOUT failing" is self-contradictory as a verdict
statement. The intended meaning is either the advisory `logger.warn`
("coverage is INCOMPLETE") in `executor.ts:warnSuppressed`, or the `clean`
default -- but the word `coverage-incomplete` names a distinct fail outcome, so a
user reading `nx` CLI help is told the default already surfaces coverage-incomplete
when it actually reports `clean`. This description is not covered by the
`storybook-docs.spec.ts` tripwire, so it can drift unnoticed. The related
phrasing "escalates the coverage-incomplete outcome to a hard failure" (also in
README:186 and README:411-415) is imprecise for the same reason -- `strict`
escalates a dropped in-graph *warning* (which would otherwise be `clean`) TO the
`coverage-incomplete` outcome; it does not escalate an already-failing outcome.
**Fix:** Reword the `schema.json` description so it does not reuse the formal
outcome name for the non-failing default, e.g.:

```json
"description": "Opt-in strict mode: FAIL when a first-party in-graph diagnostic was dropped by the project boundary (a dropped in-graph warning that would otherwise stay clean becomes a coverage-incomplete failure). By default a dropped in-graph warning does not fail the verdict on its own (it stays clean unless maxWarnings gates it); the incompleteness is still surfaced as an advisory notice. strict only adds a fail path; it never turns a fail into a pass."
```

Optionally align README:186 / README:411-415 to "escalates a dropped in-graph
warning TO the coverage-incomplete (failing) outcome".

## Info

### IN-01: Brittle unverified count "48 TypeScript 6 `.d.ts` errors" in shipped README

**File:** `packages/angular-typechecker/README.md:454`
**Issue:** "That forced `@storybook/angular@10.4.6` emits 48 TypeScript 6 `.d.ts`
errors, but they are `node_modules`-attributed and suppressed" hardcodes a
precise count that no test verifies. It will silently rot on any
`@storybook/angular` / TypeScript patch bump and can confuse a user who counts a
different number and wonders whether something is wrong. The behavioral claim
(node_modules-attributed and suppressed) is what matters; the exact count adds
brittleness without adding safety.
**Fix:** Drop the exact number or soften to "dozens of": e.g. "emits TypeScript 6
`.d.ts` errors, but they are `node_modules`-attributed and suppressed, so they
never leak into your verdict."

### IN-02: No end-to-end assertion that the executor forwards `strict: true`

**File:** `packages/angular-typechecker/src/executors/typecheck/executor.spec.ts:164-176`
**Issue:** The `strict` FLIP is thoroughly unit-tested at the `evaluateResult`
layer (`evaluate-result.spec.ts:158-204`) and the mapping is tested in
`normalize-options.spec.ts:94-103`, but the executor composition test only proves
the `strict: false` default path is forwarded (`evaluateResult` called with
`{ maxWarnings: undefined, strict: false }`). There is no test asserting the
executor forwards `strict: true` when `normalizeOptions` returns it. The seam is
trivial (the executor destructures `strict` and passes it straight through), so
the risk is low, but a one-line variant would close it.
**Fix:** Add a case that stubs `normalizeOptions` to return `strict: true` and
asserts `evaluateResult` is called with `{ maxWarnings: <x>, strict: true }`,
mirroring the existing `strict: false` assertion at line 172.

### IN-03: `storybook-host` fan-out negative test asserts only the exit code

**File:** `e2e/angular-typechecker-install-e2e/src/storybook-composition.int.spec.ts:177-183`
**Issue:** The `dependsOn:["^typecheck"]` fan-out assertion checks
`fanout.code).not.toBe(0)` plus the anti-crash guards (no `ERR_REQUIRE_ESM`, no
`infrastructure error`) but does not assert the planted `TS2322` token reached
the aggregated output. Because the clean baseline (line 138-148) proves the host
passes green with nothing planted, a non-zero fan-out exit is attributable to the
planted upstream error, so this is not false-green. It is slightly weaker than the
sibling `own` assertion at line 171 which does check the token. Acceptable as-is
(Nx may not forward an upstream task's stdout to the same capture), noted only for
completeness -- no change required.

---

_Reviewed: 2026-07-07T00:10:45Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
