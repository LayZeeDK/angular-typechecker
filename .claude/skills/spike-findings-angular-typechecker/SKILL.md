---
name: spike-findings-angular-typechecker
description: Implementation blueprint from spike experiments. Requirements, proven patterns, and verified knowledge for building angular-typechecker -- the v0.1.2 Storybook input-set-membership boundary (Phase 16 gate = GO, branch 4a), the shipped v0.1.0 reference-walk engine, Vite/Analog Storybook query-import guidance (the `vite/client` recipe + optional advisory), and the v0.2.1 Angular CLI builder GATE A' (Phase 21 = GO: the CJS->ESM `await import()` bridge survives `convertNxExecutor` + a real `ng run`). Auto-loaded during implementation work.
---

<context>
## Project: angular-typechecker

An Nx plugin that runs the COMPLETE Angular type-check (TypeScript + template type-check + extended
NG8xxx diagnostics), no-emit, decoupled from build/test, per project. Two spike ideas are packaged
here: (1) the SHIPPED v0.1.0 solution-tsconfig reference-walk engine, and (2) the v0.1.2 Storybook
type-check gate -- one boundary-filter correctness fix (directory-containment -> compiler
input-set membership) whose motivating case is the centralized Storybook host.

Spike sessions wrapped: 2026-07-01 (001-005), 2026-07-05 (006-008), 2026-07-07 (009-010).
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

### Vite/Analog query-import guidance (v0.1.2 UAT follow-up)

- The fix is CONSUMER-side: recommend `"types": ["vite/client"]` on the checked tsconfig (zeroes Vite
  `?query` TS2307; radix 227 -> 0). Never auto-suppress `?query` TS2307 (no-false-pass). A hand
  `declare module '*?query'` shim is a fallback but incomplete. An optional detection advisory keys on
  unresolved TS2307 + `?`-in-specifier (builder-agnostic, verdict-neutral, self-gating). Wildcard
  blind spot: a `?query` import of a missing base resolves through the ambient wildcard.
  </requirements>

<findings_index>

## Feature Areas

| Area                                                  | Reference                                       | Key Finding                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storybook input-set boundary (v0.1.2, Phase 17 build) | references/storybook-input-set-boundary.md      | GATE = GO. Layout B type-checkable on the official stack; ship the input-set `keep()` + branch 4a (relatedInformation ownership) + split counter.                                                                                                                                                                                                                                            |
| Reference-walk engine (v0.1.0, shipped foundation)    | references/reference-walk-engine.md             | The shipped walk the boundary builds on; its rootName-surfacing feeds the new keep-rule.                                                                                                                                                                                                                                                                                                     |
| Vite/Analog query-import support (v0.1.2 follow-up)   | references/vite-analog-query-imports.md         | `"types": ["vite/client"]` zeroes Vite `?query` TS2307 (radix 227->0) safely; optional diagnostic-based advisory; never auto-suppress.                                                                                                                                                                                                                                                       |
| Angular CLI builder GATE A' (v0.2.1, Phase 21 gate)   | .planning/spikes/011-builder-ng-run-esm-bridge/ | GATE = GO. The shipped CJS->ESM `await import()` bridge survives `convertNxExecutor` + a real `ng run` on-stack Angular 22 (app + library, incl. the eager project-graph prelude); no `ERR_REQUIRE_ESM`, planted `TS2322` RED / clean GREEN, on-stack install needs no `--legacy-peer-deps`. Builder = `convertNxExecutor(typecheckExecutor)`; never hand-write an architect builder (D-04). |

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
- 009-vite-ambient-shim-resolves-query-imports
- 010-vite-query-detection-advisory
- 011-builder-ng-run-esm-bridge
  </metadata>
