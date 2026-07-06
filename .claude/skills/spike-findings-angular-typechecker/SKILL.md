---
name: spike-findings-angular-typechecker
description: Implementation blueprint from spike experiments. Requirements, proven patterns, and verified knowledge for building angular-typechecker -- the v0.1.2 Storybook input-set-membership boundary (Phase 16 gate = GO, branch 4a) and the shipped v0.1.0 reference-walk engine. Auto-loaded during implementation work.
---

<context>
## Project: angular-typechecker

An Nx plugin that runs the COMPLETE Angular type-check (TypeScript + template type-check + extended
NG8xxx diagnostics), no-emit, decoupled from build/test, per project. Two spike ideas are packaged
here: (1) the SHIPPED v0.1.0 solution-tsconfig reference-walk engine, and (2) the v0.1.2 Storybook
type-check gate -- one boundary-filter correctness fix (directory-containment -> compiler
input-set membership) whose motivating case is the centralized Storybook host.

Spike sessions wrapped: 2026-07-01 (001-005), 2026-07-05 (006-008).
</context>

<requirements>
## Requirements (non-negotiable design decisions)

### v0.1.2 Storybook boundary (Phase 16 gate = GO)

- Charter: **never a silent false pass**; over-report (false FAIL) is the safe direction.
- Replace directory-containment with a pure `keep(diagnostic, inputSet, options) -> boolean` keyed
  on compiler **input-set membership**; route BOTH the walk and the direct single-leaf path through
  it; ZERO ngtsc/component-registry internals (structural `git grep` gate).
- Key `inputTs` on the DECLARED `readConfiguration(leaf).rootNames` (NOT
  `program.getRootFileNames()`, which adds `.ngtypecheck.ts` shims -- spike 006).
- External-template branch = **4a** (spike 008: G1 = html, G5 = PASS): map the `.html` diagnostic to
  its owning component `.ts` via public `ts.Diagnostic.relatedInformation`; keep iff that `.ts` is in
  `inputTs`; default-KEEP the unmappable edge (fail-safe).
- Split the suppressed counter into `suppressedThirdParty` + `suppressedInGraph`; surface both loudly
  in stdout AND the structured result; `suppressedInGraph > 0` => non-clean coverage-incomplete.
- Check the WHOLE tsconfig-declared set, never a `*.stories.ts` allowlist. No Storybook-specific
  machinery (no version gate/selector/option). `@storybook/angular@10` peer incompatibility is
  docs-only (D4).

### v0.1.0 reference-walk engine (shipped)

- Union-then-single-`finalize`; dedupe identity = `ts.sortAndDeduplicateDiagnostics`; counts explicit
  by category; walk skips out-of-project refs (skip-with-notice); D-03a three-way split at
  `rootNames === 0`; walk Nx inputs use the `default` named input; benchmark with Vitest `bench`.
  </requirements>

<findings_index>

## Feature Areas

| Area                                                  | Reference                                  | Key Finding                                                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storybook input-set boundary (v0.1.2, Phase 17 build) | references/storybook-input-set-boundary.md | GATE = GO. Layout B type-checkable on the official stack; ship the input-set `keep()` + branch 4a (relatedInformation ownership) + split counter. |
| Reference-walk engine (v0.1.0, shipped foundation)    | references/reference-walk-engine.md        | The shipped walk the boundary builds on; its rootName-surfacing feeds the new keep-rule.                                                          |

## Source Files

Spike records (README + harness.mjs + forensic-log.json + fixture) are committed in-repo under
`.planning/spikes/NNN-*/` (not duplicated into a `sources/` dir -- they are version-controlled
there). Reproduction of the forced-SB10 spike (007) is documented in its README (isolated scaffold,
`npm install --legacy-peer-deps`).
</findings_index>

<metadata>
## Processed Spikes

- 001-reference-walk-aggregation
- 002-module-boundary-guard
- 003-double-compile-cost
- 004-d03a-surgical-split
- 005-coarse-single-target-caching
- 006-layout-b-rootnames
- 007-forced-sb10-compile-ng8xxx
- 008-external-template-attribution
  </metadata>
