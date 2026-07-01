# Spike Manifest

## Idea

De-risk, before re-planning v0.0.4, a **runtime solution-tsconfig reference-walking**
mode for the `angular-typecheck` engine. Today the engine's D-03a guard *errors* when
pointed at a solution-style `tsconfig.json` (`files: []`, `references: [...]`), telling
the user to point at a leaf. The proposed reversal: point **one** target at
`<project>/tsconfig.json`, resolve the in-project `references[]` to leaf tsconfigs
(`tsconfig.lib.json` + `tsconfig.spec.json`), run `performCompilation` **per leaf**, and
**union + dedupe** the diagnostics by identity (`file + start + length + code + message`).
If feasible, the Phase 13 `typecheck-configuration` generator could wire a single target
per project instead of one target per leaf (the open GEN-02/03 design decision). This is a
**gated GO/NO-GO** because it reverses shipped, tested behavior.

## Requirements

Design decisions that emerged / are locked as spikes progress. Non-negotiable for the real build.

- Dedupe identity MUST be `file(name/path) + start + length + code + messageText` --
  i.e. exactly `ts.sortAndDeduplicateDiagnostics`' `diagnosticsEqualityComparer` (verified
  in TS 6.0.3: it compares `diagnostic.file.path` as a STRING, never the `SourceFile`
  object). This is what makes cross-`Program` union-dedupe viable.
- `errorCount` / `warningCount` MUST be counted EXPLICITLY on the POST-dedupe set by
  `DiagnosticCategory` (never `length - errorCount`) -- the existing engine invariant
  (D-01) carries forward unchanged.
- The existing project-boundary filter (`filter-diagnostics` + `includeDeps`) governing
  out-of-project + `node_modules` source diagnostics stays UNCHANGED; the new
  module-boundary guard operates at the *reference-resolution* layer, not the diagnostic
  layer. (Locked pending Spike 002.)
- Spikes build HERMETIC fixtures under `.planning/spikes/NNN-*/fixture/` -- they do NOT
  mutate `libs/typecheck-consumer*` (committed fixtures the plugin specs consume) to avoid
  perturbing `run-typecheck.integration.spec.ts` / the executor specs / the Nx graph.

## Environment (verified live 2026-07-01)

- Node 24.18.0 | `@angular/compiler-cli` 22.0.4 | `typescript` 6.0.3 | Vitest 4 | Windows arm64.
- Substrate present: `libs/typecheck-consumer` (solution-style `tsconfig.json` -> `tsconfig.lib.json`)
  imports the non-buildable `libs/typecheck-consumer-dep` via the `@fixtures/typecheck-consumer-dep`
  path alias in `tsconfig.base.json`. GAP: the consumer has **no** `tsconfig.spec.json` and the
  solution references only the lib leaf -- so the lib+spec overlap (001/003) and the out-of-project
  reference (002) are scaffolded inside each spike's hermetic fixture.

## Spikes

| # | Name | Obj | Type | Validates | Verdict | Tags |
|---|------|-----|------|-----------|---------|------|
| 001 | reference-walk-aggregation | 1 [Q2] | standard | solution `tsconfig.json` -> lib + spec leaves sharing a source; per-leaf `performCompilation` union+dedupe yields a complete, duplicate-free set with correct error/warning counts | **VALIDATED** | aggregation, dedupe, counts, engine |
| 002 | module-boundary-guard | 2 | standard | out-of-project `references[]` are rejected/skipped at the walk boundary; local path-mapped dep sources stay governed by the existing `filter-diagnostics` + `includeDeps` | **VALIDATED** | boundary, security, engine |
| 003 | double-compile-cost | 4 [Q1] | benchmark | measure the wall-clock cost of compiling a local non-buildable lib dep across the lib + spec leaves; record project-references / `NgtscProgram` incremental declaration-reuse as DEFERRED synergy | **VALIDATED** | performance, cost, engine |
| 004 | d03a-surgical-split | 3 | standard | zero-rootNames guard splits surgically: references present -> walk; none -> still synthesize the deterministic error (rewrite `config-resolution.integration.spec.ts:124-130`) | **VALIDATED** | guard, regression, engine |
| 005 | coarse-single-target-caching | 5 | standard | one Nx target (`outputs: []`, union of leaf inputs) yields a sound coarse cache key: any leaf/dep change busts, nothing under-hashes | PENDING | caching, nx, devex |

_Build order: risk order (aggregation -> boundary -> cost -> D-03a split -> caching). Aggregation
runs first as the make-or-break gate; a NO-GO there kills the idea before the rest. Spike # follows
run order; the Obj column maps each back to the idea's original 1-5 numbering._
