---
phase: 17-input-set-membership-boundary-layout-support
reviewed: 2026-07-06T08:09:55Z
depth: deep
files_reviewed: 43
files_reviewed_list:
  - packages/angular-typechecker/src/core/filter-diagnostics.ts
  - packages/angular-typechecker/src/core/filter-diagnostics.spec.ts
  - packages/angular-typechecker/src/core/filter-diagnostics.structural.spec.ts
  - packages/angular-typechecker/src/core/walk-references.ts
  - packages/angular-typechecker/src/core/walk-references.spec.ts
  - packages/angular-typechecker/src/core/run-typecheck.ts
  - packages/angular-typechecker/src/core/run-typecheck.integration.spec.ts
  - packages/angular-typechecker/src/core/infra-failure.spec.ts
  - packages/angular-typechecker/src/core/evaluate-result.ts
  - packages/angular-typechecker/src/core/evaluate-result.spec.ts
  - packages/angular-typechecker/src/core/exit-codes.ts
  - packages/angular-typechecker/src/core/exit-codes.spec.ts
  - packages/angular-typechecker/src/executors/typecheck/executor.ts
  - packages/angular-typechecker/src/executors/typecheck/executor.spec.ts
  - packages/angular-typechecker/src/core/dual-identity-tripwire.spec.ts
  - packages/angular-typechecker/src/core/external-template.integration.spec.ts
  - packages/angular-typechecker/src/core/fault-isolation.integration.spec.ts
  - packages/angular-typechecker/src/core/layout-a.integration.spec.ts
  - packages/angular-typechecker/src/core/layout-b.integration.spec.ts
  - packages/angular-typechecker/README.md
  - fixtures/sibling-import/main-lib/tsconfig.lib.json
  - fixtures/layout-a-storybook/src/button.stories.ts
  - fixtures/layout-a-storybook/src/button.component.ts
  - fixtures/layout-a-storybook/tsconfig.json
  - fixtures/layout-a-storybook/.storybook/tsconfig.json
  - fixtures/layout-a-storybook-clean/src/button.stories.ts
  - fixtures/layout-b-host/tsconfig.json
  - fixtures/layout-b-host/.storybook/tsconfig.json
  - fixtures/layout-b-host-clean/.storybook/tsconfig.json
  - fixtures/layout-b-aggregated/card.stories.ts
  - fixtures/layout-b-aggregated/card.component.ts
  - fixtures/layout-b-aggregated/card.component.html
  - fixtures/layout-b-aggregated-clean/card.stories.ts
  - fixtures/layout-b-dependency/thing.ts
  - fixtures/external-template-tripwire/error-template.component.ts
  - fixtures/external-template-tripwire/error-template.component.html
  - fixtures/external-template-tripwire/tsconfig.app.json
  - fixtures/clean-template-host/external.component.ts
  - fixtures/clean-template-host/external.component.html
  - fixtures/clean-template-host/inline.component.ts
  - fixtures/clean-template-host/tsconfig.app.json
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-07-06T08:09:55Z
**Depth:** deep
**Files Reviewed:** 43
**Status:** issues_found

## Summary

Deep, cross-file adversarial review of the Phase 17 input-set-membership boundary
filter, the `inputTs` threading through `run-typecheck`, the split suppressed
counters, and the late-bound coverage-incomplete verdict.

**Core correctness axis (the phase charter -- "NEVER a silent false pass") holds.**
I traced every branch of the pure `keep()` decision and every drop path in
`filterDiagnostics`, then followed each through `finalize` -> `evaluateResult` and
the executor. No path was found where an in-graph/first-party diagnostic is
silently dropped without failing the verdict:

- Every `keep() === false` on a first-party (non-`node_modules`) file is COUNTED
  into `suppressedInGraphErrorCount` / `suppressedInGraphWarningCount` (with the
  file recorded), and any error-category in-graph suppression fails the verdict
  as `coverage-incomplete`.
- Dual-identity membership is checked BEFORE the `node_modules` branch, so a
  declared rootName is never misclassified as third-party; a throwing `realpath`
  fails safe (KEEP).
- Branch 4a mis-attribution (wrong/absent `.ts` `relatedInformation`) can only
  over-keep (safe) or, on a wrong SUPPRESS, still counts the `.html` as
  in-graph -> `coverage-incomplete`. Never a silent drop.
- Core purity is intact (no `console`/`process` in `src/core/*.ts`; the only
  matches are in comments), and the structural-gate denylist tokens are absent
  from `filter-diagnostics.ts`.

No BLOCKER findings. There are **zero** Critical issues.

The findings below are a set of DOCUMENTATION/COMMENT contradictions and one
user-facing notice inaccuracy, all rooted in the SAME behavioral change: Phase 17
made a `zero-root-names` reference (and any suppressed in-graph diagnostic) a
verdict-affecting `coverage-incomplete` signal, but the README and one core
comment still describe the pre-17 "advisory / does not change the verdict"
behavior. Because this is a public, shipped package (`README.md` is in the `files`
whitelist) and `AGENTS.md` treats this repo's docs/comments as ground truth ("a
type-checker that lies"), these are real WARNING-level defects, not cosmetics.

## Warnings

### WR-01: README claims empty references "do not change the verdict" -- Phase 17 makes them fail

**File:** `packages/angular-typechecker/README.md:358-361`
**Issue:** The Limitations section states, verbatim:

> "references that are out-of-project, **empty**, or themselves solution tsconfigs
> are skipped with an advisory warning and **do not change the verdict**."

This is now FALSE for the `empty` (zero-root-names) case. Phase 17's
`evaluateResult` (evaluate-result.ts:105-112) fails ANY run carrying a
`zero-root-names` skipped reference as `coverage-incomplete` (`success: false`),
proven by the passing test at `evaluate-result.spec.ts:108-118`. The README is the
published, user-facing contract (it ships in the package `files` whitelist), so a
consumer relying on it will be surprised when a clean app with an empty
`tsconfig.spec.json` leaf (e.g. a new library before any `*.spec.ts` exists) now
returns a failing verdict in CI. Note the `Exit codes` section (README:238-241)
also implies only errors / warning-threshold cause non-zero, without mentioning
the coverage-incomplete trigger.

**Fix:** Update the Limitations bullet to reflect the shipped behavior, e.g.:

```md
- The reference walk is single-level. Out-of-project references, or references
  that are themselves solution tsconfigs, are skipped with an advisory warning and
  do not change the verdict. An **empty** (zero-input-files) in-project leaf,
  however, now fails the run as `coverage-incomplete` (a non-zero verdict) -- a
  declared leaf that checked nothing is treated as a coverage gap, not a pass.
  Point `tsConfig` at a leaf directly for the skipped cases.
```

Also add a line to `Exit codes` noting that a dropped in-graph (first-party)
diagnostic or a zero-input leaf produces a non-zero (coverage-incomplete) exit.
Please also CONFIRM the product intent: failing a clean project that merely has an
empty spec leaf is aligned with the "over-report safe" charter, but it reverses a
previously-documented decision and is a common real-world state.

### WR-02: `walk-references.ts` D-03b comment now contradicts the shipped verdict

**File:** `packages/angular-typechecker/src/core/walk-references.ts:216-225`
**Issue:** The `zero-root-names` skip comment still asserts the pre-17 policy:

> "a resolved leaf with no input files ... is recorded as an ADVISORY skip -- **on
> its own it does NOT fail the verdict** ... failing the WHOLE solution for that
> **would be a false negative**."

Phase 17 reversed exactly this: `evaluateResult` step 4 makes a `zero-root-names`
skipped reference fail as `coverage-incomplete` UNCONDITIONALLY (independent of
whether a sibling was checked or anything was dropped). On load-bearing verdict
code this stale comment is a hazard: a future maintainer reading it as ground
truth could "restore" the documented advisory behavior and silently reopen the
coverage gate the phase just closed. Per `AGENTS.md`, an inaccurate comment here
propagates into future agent behavior.

**Fix:** Rewrite the D-03b comment to state the current contract: a
`zero-root-names` leaf is recorded as a skip AND is a verdict-affecting
`coverage-incomplete` trigger in `evaluate-result.ts` (a declared first-party leaf
that resolved zero files is a coverage gap). Cross-reference
`evaluate-result.ts:105-112`. Keep the "a sibling's real errors still fail" and
"every-leaf-empty -> 90001" mitigations, but drop the "does NOT fail the verdict /
false negative" language.

### WR-03: coverage-incomplete notice hardcodes "verdict is NOT clean" but can fire on a clean run

**File:** `packages/angular-typechecker/src/executors/typecheck/executor.ts:132-143`
**Issue:** The loud coverage notice fires whenever
`suppressedInGraphErrorCount > 0 || suppressedInGraphWarningCount > 0` and states
"this run's coverage is INCOMPLETE and **the verdict is NOT clean**". But the
warning-severity coverage trigger is LATE-BOUND on `maxWarnings`
(evaluate-result.ts:124-129): when ONLY in-graph warnings were dropped
(`suppressedInGraphWarningCount > 0`, `suppressedInGraphErrorCount === 0`) AND
`maxWarnings` is unset (the DEFAULT), `evaluateResult` returns
`{ success: true, outcome: 'clean' }`. The executor then prints "the verdict is
NOT clean" while returning `{ success: true }` (exit 0) -- the notice contradicts
the tool's own verdict and exit code in a reachable case (a first-party
out-of-graph file carrying only warning-category diagnostics). This over-states
failure (safe direction for a notice) but is factually inconsistent output from a
correctness tool that is otherwise careful about not lying.

**Fix:** Make the notice honest about the late-binding. Either soften the wording
when only warnings were dropped, or compute the effective verdict first and word
the notice to match. Minimal fix -- split the message:

```ts
if (result.suppressedInGraphErrorCount > 0) {
  logger.warn(
    `angular-typechecker: this run's coverage is INCOMPLETE and the verdict is ` +
      `NOT clean -- ${result.suppressedInGraphErrorCount} error(s) on first-party ` +
      `files were dropped by the project boundary. Dropped file(s): ` +
      `${result.suppressedInGraphFiles.join(', ')}.`,
  );
} else if (result.suppressedInGraphWarningCount > 0) {
  logger.warn(
    `angular-typechecker: this run's coverage is INCOMPLETE -- ` +
      `${result.suppressedInGraphWarningCount} warning(s) on first-party files ` +
      `were dropped by the project boundary. This fails the verdict only under ` +
      `--max-warnings. Dropped file(s): ${result.suppressedInGraphFiles.join(', ')}.`,
  );
}
```

Relatedly, the `zero-root-names` `verdictNote` (executor.ts:92-96) describes an
INDIRECT mechanism ("If a sibling leaf was checked, this leaf's transitively-
imported files may have been dropped"), whereas `evaluateResult` fails on
`zero-root-names` DIRECTLY and unconditionally. Consider tightening that wording
too so it matches the actual (direct) verdict trigger.

## Info

### IN-01: `toExitCode` mirrors only ONE of `evaluateResult`'s four coverage triggers

**File:** `packages/angular-typechecker/src/core/exit-codes.ts:54-64`
**Issue:** `toExitCode` returns `1` for `suppressedInGraphErrorCount > 0` but does
NOT mirror the other coverage-incomplete triggers `evaluateResult` enforces
(`templateCheckAborted`, `zero-root-names` skipped reference, or a `maxWarnings`-
gated in-graph warning). So a completed run with `errorCount === 0` but
`templateCheckAborted` set (survivors' template diagnostics suppressed) or a
`zero-root-names` leaf would map to exit `0` (clean) through `toExitCode`. The
`ponytail:` comment documents this as intentional because `toExitCode` currently
has NO live consumer (the Nx executor uses `evaluateResult`); it is COR-04 scaffold
for a deferred CLI. This is not a live bug, but it is a latent false-PASS-via-exit-
code the moment a CLI wires `toExitCode` -- flagged so it is not forgotten.

**Fix:** No change needed today. When the deferred CLI gains a live consumer, add
the `templateCheckAborted` / `zero-root-names` / gated-warning triggers to
`toExitCode` (and a `maxWarnings` param), or have the CLI derive its exit code from
`evaluateResult`'s `outcome` rather than re-deriving here, so the two verdict
sources cannot drift.

### IN-02: `owningComponentTs` returns the first `.ts` in `relatedInformation`, not the proven owner

**File:** `packages/angular-typechecker/src/core/filter-diagnostics.ts:275-287`
**Issue:** Branch 4a resolves the owning component by taking the FIRST
`relatedInformation` entry whose file ends in `.ts`/`.tsx`. If a future Angular
attaches multiple `.ts` related files (e.g. a used directive's source before the
owning component), the first may not be the true owner. The safety analysis shows
this cannot cause a silent false pass (a wrong owner-not-in-set -> SUPPRESS still
counts the `.html` as in-graph -> coverage-incomplete; a wrong owner-in-set ->
over-KEEP is safe), and the integration tripwire
(`external-template.integration.spec.ts`) pins the current attribution. So this is
informational only.

**Fix:** No change required for v0.1.x. If ever tightening, prefer the
`relatedInformation` entry whose message identifies the component template owner --
but only via PUBLIC `ts.Diagnostic` fields, never a compiler-internal API (the
structural gate forbids it). The current first-`.ts` heuristic is adequate and
fail-safe.

---

_Reviewed: 2026-07-06T08:09:55Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
