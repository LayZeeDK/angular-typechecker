---
phase: 25
phase_name: "extract-the-advisory-notice-seam"
project: "angular-typechecker"
generated: "2026-07-16"
counts:
  decisions: 5
  lessons: 3
  patterns: 3
  surprises: 2
missing_artifacts:
  - "25-UAT.md"
---

# Phase 25 Learnings: extract-the-advisory-notice-seam

## Decisions

### Homegrown structural Logger, not @nx/devkit's type
The injected `Logger` (`info`/`warn`/`error`, each `(message: string): void`) is declared in a new `core/logger.ts` that imports NOTHING, rather than reusing `@nx/devkit`'s `Logger` type. Importing the devkit type -- even type-only -- would violate the `src/core/**` D-11 lint boundary (`allowTypeImports` is omitted, so type-only nx imports are banned too). `@nx/devkit`'s runtime `logger` is structurally assignable to the homegrown interface, so the executor passes it in with zero adapter.

**Rationale:** Keep the seam usable from the pure core (and the future CLI) without any framework import; structural typing gives the executor a free pass-through.
**Source:** 25-01-PLAN.md (D-01/D-02/D-03), 25-01-SUMMARY.md

### Logger.error is in the contract even though no advisory uses it
The seam exposes `error` alongside `info`/`warn` although all five advisories only use `info`/`warn`. It exists to freeze the full seam shape once, for the Phase-26 CLI infrastructure path.

**Rationale:** Define the adapter contract a single time so Phase 26's console logger + `run()` inherit a stable shape; avoid a later breaking widening.
**Source:** 25-01-PLAN.md (D-03)

### Verbatim cut-paste move; only append `, logger: Logger`
The five helpers + `skippedReferenceVerdictNote` were moved by literal cut-paste from `executor.ts`; the sole per-helper edit is appending `, logger: Logger` to each signature (`skippedReferenceVerdictNote` keeps its no-logger signature). No message string, concatenation, interpolation, or emission order changed.

**Rationale:** Byte-identical observable behavior vs 0.2.1 is the phase's hard requirement; retyping risks a silent one-character drift that still passes substring assertions.
**Source:** 25-01-PLAN.md (D-04/D-05/D-06), 25-VERIFICATION.md

### The infrastructure-error catch stays in the executor
The `catch (TypecheckInfrastructureError) -> logger.error(...)` path was NOT moved into the seam; it remains in `executor.ts`.

**Rationale:** That path is adapter error-handling over a thrown error, not an advisory over a `CoreResult`; the seam is strictly for the five additive notices.
**Source:** 25-01-PLAN.md (D-08)

### Existing executor + builder specs are the byte-identical regression guard
`executor.spec.ts` is left byte-unchanged and does NOT `vi.mock` the new module, so the real `emitAdvisoryNotices` runs against the mocked `@nx/devkit` logger and the existing notice assertions still prove output identity.

**Rationale:** A refactor that mocks away the code it moved would prove nothing; keeping the real seam under the existing assertions is the cheapest true guard (no new snapshot fixture).
**Source:** 25-01-PLAN.md (D-10), 25-REVIEW.md

## Lessons

### A glob path inside a JSDoc block comment closes the comment early
Writing the boundary path with its glob suffix (`**/src/core/**`) inside a `/** ... */` doc comment embeds a literal `*/`, terminating the comment mid-block and dumping `src`/`core` into code as bare identifiers (TS2304). Rephrase doc prose to the non-glob form (`src/core`) inside block comments.

**Context:** Hit during Task 1 on both new core files; caught by the `nx build` gate before the commit and fixed with no behavioral impact.
**Source:** 25-01-SUMMARY.md (Issues Encountered)

### The TS LSP diagnostic feed was stale across this refactor
After the executor swap + helper deletion, the editor `new-diagnostics` feed reported TS2304 on `CoreResult`/`SkippedReference` at the OLD (deleted) helper line numbers and the pre-fix JSDoc-glob identifiers -- errors that no longer existed. The authoritative gate (`nx build` + `nx typecheck` + `nx test`) was green.

**Context:** Confirms the project rule that the LSP feed is non-authoritative and lags edits; the build/test runner is the gate. Verify with the compiler, not the passive feed, especially in the same turn as edits.
**Source:** orchestrator gate re-run; 25-VERIFICATION.md

### Deleting moved code must also delete its now-unused type imports
Removing the five helpers from `executor.ts` orphaned the `CoreResult` and `SkippedReference` type imports; `nx lint` at `maxWarnings:0` fails on unused imports, so the cleanup is part of the same edit -- while keeping the still-used `runTypecheck`/`TypecheckInfrastructureError` value imports.

**Context:** A verbatim-extraction refactor is not done at the move; the origin file's import list must be reconciled or the lint gate blocks.
**Source:** 25-01-PLAN.md (Task 3), 25-REVIEW.md

## Patterns

### Pure-core render module behind an injected Logger
A `core/` module that renders human-facing notices but performs no I/O of its own -- the caller injects a concrete `Logger` sink. The module stays inside the `core/**` no-nx/no-console/no-process boundary, so every adapter (Nx executor, Angular CLI builder, standalone CLI) can drive it.

**When to use:** Any output-producing logic that must be shared across a framework adapter and a framework-free adapter without dragging the framework's logging/`chalk` chain into the lean path.
**Source:** 25-01-SUMMARY.md (patterns-established), 25-CONTEXT.md

### Byte-exact spec anchor via full-string toHaveBeenCalledWith
For a "behavior must not change" refactor, anchor the moved code with a NEW spec that asserts the EXACT full message string (`toHaveBeenCalledWith('<complete text>')`, not `stringContaining`) plus stream routing, driven against a plain `vi.fn()` mock (no `vi.mock`).

**When to use:** Extractions / moves where existing tests use substring assertions (which a boundary-space drift would still pass) -- the exact-string spec is the byte-level tripwire.
**Source:** 25-01-SUMMARY.md (Pattern 2), 25-REVIEW.md

### Cross-collaborator ordering test via .mock.invocationCallOrder
When emission ORDER across several sink calls is a correctness property, assert it with one combined-scenario test that triggers all cases at once and reconstructs the true cross-stream timeline from `.mock.invocationCallOrder` on the shared mock -- positional checks on that timeline are order-sensitive by construction.

**When to use:** A property guarded only by source ordering where per-case tests each exercise one path and would all pass after a reorder.
**Source:** 25-VALIDATION.md (IN-01 fill), 25-REVIEW.md (IN-01)

## Surprises

### Cross-advisory emission order was invisible to the initial spec
The first spec (7 tests) exercised each advisory in isolation, so a future reorder inside `emitAdvisoryNotices` would emit correct strings and pass every test while silently changing output order -- an explicit locked property (D-05) with zero test coverage. Surfaced as code-review Info IN-01 and filled by the nyquist auditor with the `invocationCallOrder` test.

**Impact:** Turned a passing-but-blind suite into one that actually guards D-05; no behavior changed, but the coverage hole would have masked a real regression later.
**Source:** 25-REVIEW.md (IN-01), 25-VALIDATION.md

### @nx/devkit's logger dropped into the seam with zero adapter
The executor passes its `@nx/devkit` `logger` directly as the `Logger` argument -- no wrapper, no shape mapping -- because the devkit logger already exposes `info`/`warn`/`error` and TypeScript structural typing accepts it against the 3-method interface.

**Impact:** The swap that could have needed an adapter shim needed none; the whole executor change is one call site plus deletions.
**Source:** 25-01-SUMMARY.md (tech-stack patterns), 25-VERIFICATION.md
