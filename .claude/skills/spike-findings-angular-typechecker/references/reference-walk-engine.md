# Reference-walk engine (v0.1.0, SHIPPED)

Foundation the Storybook boundary builds on. Spikes 001-005 de-risked the solution-tsconfig
reference-walking engine; it SHIPPED in v0.1.0 (Phase 13, `walk-references.ts`). This is a
pointer, not a build blueprint -- the code is in `packages/angular-typechecker/src/core/` and the
full milestone detail is in `.planning/milestones/v0.1.0-ROADMAP.md`.

## Proven decisions (locked, shipped)

- **Aggregate via UNION-then-single-`finalize`** (spike 001): union raw per-leaf diagnostics, then
  ONE boundary-filter + `ts.sortAndDeduplicateDiagnostics` + explicit category counts over the
  union. basePath = the solution tsconfig dir.
- **Dedupe identity = `ts.sortAndDeduplicateDiagnostics`** -- keys on `diagnostic.file.path`
  (STRING) + start + length + code + messageText (NOT the SourceFile object). This is what makes
  cross-`Program` union-dedupe viable.
- **Counts explicit by category** (D-01): `errorCount`/`warningCount` counted on the POST-filter set
  by `ts.DiagnosticCategory`, never `length - errorCount`.
- **Walk boundary guard SKIPS out-of-project references** (spike 002; path-containment under the
  project dir) and records the skipped set (skip-with-notice, not silent) -- a
  reference-resolution-layer guard, orthogonal to and composable with the diagnostic-layer
  `filter-diagnostics` + `includeDeps`.
- **D-03a three-way split at `rootNames === 0`** (spike 004): references + >=1 in-project leaf ->
  WALK; references + 0 in-project -> synthesize error; no references -> synthesize error. Never gate
  on TS18003.
- **Walk target Nx inputs use the `default` named input** (spike 003/005), NOT `production` (which
  excludes `*.spec.ts`); `outputs: []`.
- **Benchmark with Vitest `bench`** (maintainer directive, spike 003).

## Relevance to Phase 17

The Storybook boundary (see `storybook-input-set-boundary.md`) REPLACES this engine's
directory-containment diagnostic filter with input-set membership, routing BOTH the walk and the
direct single-leaf path through one `keep()`. The walk's rootName-surfacing (it already holds
`result.program`) is the new input to the keep-rule. Everything else above stays.

## Origin

Spikes 001-005 (all VALIDATED). Records in `.planning/spikes/00{1..5}-*/`. Deferred synergy:
project references + `NgtscProgram` incremental declaration-reuse (collapse the walk's
double-compile tax) -- already deferred in PROJECT.md (Approach A for v0.0.x/v0.1.x).
