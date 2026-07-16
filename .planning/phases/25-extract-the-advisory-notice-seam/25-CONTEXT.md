# Phase 25: Extract the advisory-notice seam - Context

**Gathered:** 2026-07-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Lift the five advisory-notice `warn*` helpers out of
`packages/angular-typechecker/src/executors/typecheck/executor.ts` into a new
pure `core/emit-advisory-notices.ts` module, driven by an **injected structural
`Logger`** (`info`/`warn`/`error`). The Nx executor then emits every advisory
through one `emitAdvisoryNotices(result, logger)` call with **byte-identical
observable behavior** vs `angular-typechecker@0.2.1`, and a new unit spec drives
the module directly against a mock `Logger`.

This is a **reusable seam** for the Phase-26 CLI adapter: the CLI drives advisory
output through the same core module and never imports `executor.ts` (which would
drag `@nx/devkit`/`chalk` -- the 24-06 crash class) or re-duplicate five message
helpers.

**Additive / internal only** (ADD-01): no public-API change, no verdict change,
no new dependency. The five advisories are and stay additive signalling --
`evaluateResult` owns the verdict and reads none of these fields.

**In scope:** the five executor advisory helpers (`warnTemplateCheckAborted`,
`warnSkippedReferences` + `skippedReferenceVerdictNote`, `warnSuppressed`,
`warnNotTypeChecked`, `warnBundlerQueryImports`) and their extraction behind a
`Logger` seam; the executor swap to a single call; the `Logger` type; the new
unit spec.

**Out of scope:** the CLI itself, `run()`, exit-code wiring, `parse-args`, the
console logger implementation (all Phase 26+); the generator/schematic
`logger.info` notices (`NO_CACHING_NOTICE` / `NO_ANGULAR_JSON_NOTICE`) -- those
are generator/schematic UX, NOT executor advisories over a `CoreResult`, and
are untouched by CLI-04.

</domain>

<decisions>
## Implementation Decisions

### Logger seam
- **D-01:** Add a new `core/logger.ts` exporting a **structural** `Logger`
  interface: `{ info(message: string): void; warn(message: string): void;
  error(message: string): void }`. It imports nothing (satisfies the existing
  `src/core/**` D-11 lint boundary: no `nx`/`@nx/*`/`@angular-devkit/*`, no
  `console`, no `process.exit`). Do NOT reuse or import `@nx/devkit`'s `Logger`
  type -- that would violate the boundary.
- **D-02:** `@nx/devkit`'s `logger` is **structurally assignable** to this
  `Logger` (it already has `info`/`warn`/`error`), so the executor passes
  `logger` in directly with zero adapter/wrapper. A dedicated file (vs an inline
  type in the advisory module) is chosen so Phase 26's console logger and `run()`
  can import `Logger` without pulling in `emit-advisory-notices.ts` or
  `CoreResult`.
- **D-03:** `Logger.error` is part of the contract now even though the five
  advisories use only `info`/`warn` -- it is the seam the CLI's infrastructure
  path routes through in Phase 26. Including it here freezes the full seam shape
  once (this Logger type is the contract every adapter inherits).

### Module contract
- **D-04:** `core/emit-advisory-notices.ts` exports
  `emitAdvisoryNotices(result: CoreResult, logger: Logger): void` -- synchronous,
  returns void.
- **D-05:** It preserves the **exact current emission order** (the byte-identical
  requirement rests on order + strings): (1) templateCheckAborted, (2)
  skippedReferences -- one notice per reference, (3) suppressed -- third-party
  `logger.info` THEN the in-graph coverage-incomplete `logger.warn`, (4)
  notTypeChecked, (5) bundlerQueryImports. Each fires only under its current
  guard; a clean run stays silent.
- **D-06:** The five current private helpers move into the new module as private
  functions (each `(result, logger)`), and `skippedReferenceVerdictNote` moves
  with `warnSkippedReferences`. All message strings are copied **byte-for-byte**
  -- no rewording, no whitespace change. (Internal helper names are Claude's
  discretion; the message text and routing are what is locked.)

### Executor swap
- **D-07:** `executor.ts` replaces its five inline `warn*(result)` calls
  (currently lines 53-57) with a single `emitAdvisoryNotices(result, logger)`
  call, importing `emitAdvisoryNotices` from `../../core/emit-advisory-notices`
  and passing the already-imported `@nx/devkit` `logger`. The five helper
  functions AND `skippedReferenceVerdictNote` are DELETED from `executor.ts`.
- **D-08:** The infrastructure-error path stays in the executor: the `catch`
  block's `logger.error(...)` over a thrown `TypecheckInfrastructureError` is
  adapter error-handling, not an advisory over a `CoreResult`, so it does NOT
  move into the seam. (`Logger.error` exists for the CLI's future infra routing,
  not for this phase.)

### Verification
- **D-09:** Add `core/emit-advisory-notices.spec.ts` (unit, `test` tier) that
  drives `emitAdvisoryNotices` against a **mock `Logger`** recording
  `info`/`warn`/`error` calls, asserting per notice: (a) exact message text and
  (b) stream routing -- advisories/errors via `warn`, the node_modules-suppressed
  count via `info`. Cover a clean `CoreResult` emitting nothing.
- **D-10:** The existing executor + builder specs are the **byte-identical
  regression guard** (criterion 2: "all existing executor and builder tests stay
  green with no behavioral diff"). No new snapshot/golden fixture -- the notice
  output is already asserted there.

### Claude's Discretion
- Internal private-helper names inside the new module (keep `warnTemplateCheckAborted`
  etc., or rename -- message text is what is fixed).
- Whether `emitAdvisoryNotices` calls the five helpers in a straight sequence or
  iterates a small internal list (observably identical).
- Whether `Logger` lives in `core/logger.ts` as its own file vs a `core/logger.ts`
  that also later grows a console impl -- keep it type-only for this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + roadmap (what + why)
- `.planning/REQUIREMENTS.md` -- CLI-04 (the seam requirement), CLI-03 (nx-free
  core boundary + stdout/stderr routing this seam feeds), ADD-01 (additive-only
  charter: the logger swap must be observably identical).
- `.planning/ROADMAP.md` -- "### Phase 25: Extract the advisory-notice seam"
  (goal + the 3 success criteria this CONTEXT implements).

### Code to extract / preserve
- `packages/angular-typechecker/src/executors/typecheck/executor.ts` -- the five
  `warn*` helpers to move (lines ~88-264) + `skippedReferenceVerdictNote`; the
  call site to swap (lines ~53-57); the infra `catch`/`logger.error` path to
  LEAVE (lines ~75-85).
- `packages/angular-typechecker/src/core/run-typecheck.ts` -- `CoreResult` and
  the structured advisory fields the seam reads: `templateCheckAborted`,
  `skippedReferences`, `suppressedThirdParty`, `suppressedInGraphErrorCount`,
  `suppressedInGraphWarningCount`, `suppressedInGraphFiles`,
  `notTypeCheckedDeclaredFiles`, `bundlerQueryImports`.
- `packages/angular-typechecker/src/core/walk-references.ts` -- the
  `SkippedReference['reason']` union that `skippedReferenceVerdictNote` switches on.

### Boundary enforcement (already in place -- no new rule needed)
- `packages/angular-typechecker/eslint.config.mjs` -- the D-11 block scoped to
  `**/src/core/**/*.ts` bans `nx`/`@nx/*`/`@angular-devkit/*`/`yargs` imports,
  `no-console`, and `process.exit`. Both new files (`core/logger.ts`,
  `core/emit-advisory-notices.ts`) land under it and are enforced automatically.

### Milestone architecture (thin-adapter seam context)
- `.planning/research/v0.2.2-standalone-cli/ARCHITECTURE.md` -- the third-thin-adapter
  design (Nx executor + Angular CLI builder + CLI all over one core).
- `.planning/research/v0.2.2-standalone-cli/SUMMARY.md` -- milestone synthesis.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **The five `warn*` helpers in `executor.ts`** are already pure over `CoreResult`
  except for the hardcoded `@nx/devkit` `logger` reference -- extraction is a
  mechanical lift + parameterize `logger`. `warnSuppressed` is the only one that
  uses BOTH `logger.info` (node_modules count) and `logger.warn` (in-graph
  coverage-incomplete); preserve both branches and their order.
- **`@nx/devkit` `logger`** already exposes `info`/`warn`/`error`, so it drops
  straight into the `Logger` param -- no shim.

### Established Patterns
- **Detection(core)-vs-rendering(adapter) split** (documented in `run-typecheck.ts`
  and `walk-references.ts`): the core only COUNTS/records paths; the adapter
  renders the loud notice. This phase moves the RENDERING into core-but-pure
  (behind an injected logger) -- the split is preserved because the module still
  takes no I/O of its own; the caller owns the concrete logger.
- **Self-gating notices:** every helper early-returns on its own guard
  (`=== undefined`, `?.length`, `> 0`), so a clean run emits nothing. Keep verbatim.
- **`core/**` purity boundary** (D-11, `eslint.config.mjs`): the reason this
  extraction is safe -- the new module physically cannot import nx/console/process,
  which is exactly what lets the CLI import it.

### Integration Points
- `executor.ts` (Nx executor) -- swaps five calls for one; imports the new module.
- Phase 26 CLI `run()` -- will import `emitAdvisoryNotices` + `Logger` and inject a
  console logger. This phase makes that possible; it does not build it.
- `builders/typecheck/builder.ts` -- unchanged (it re-exports the executor via
  `convertNxExecutor`), but its integration spec is part of the byte-identical
  guard.

</code_context>

<specifics>
## Specific Ideas

- The literal phrase in the goal -- "the CLI never has to import `executor.ts`
  (which would drag `@nx/devkit`/`chalk` -- the 24-06 crash class)" -- is the
  motivating constraint: the seam exists so the CLI's runtime import graph never
  reaches nx. The `core/**` lint boundary is what enforces it.
- Byte-identical means literally the same strings and the same emission order; do
  not "clean up" any message during the move.

</specifics>

<deferred>
## Deferred Ideas

- Console `Logger` implementation + stdout/stderr routing (CLI-03) -- Phase 26.
- Wiring `Logger.error` to the CLI infrastructure path + `toExitCode` -- Phase 26.

None beyond the above -- discussion stayed within phase scope.

</deferred>

---

*Phase: 25-extract-the-advisory-notice-seam*
*Context gathered: 2026-07-16*
