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
- The reference-walk aggregates via UNION-then-single-`finalize` (union raw per-leaf diagnostics,
  then one boundary-filter + `sortAndDeduplicate` + count over the union), basePath = the project
  dir (dirname of the solution tsconfig). (Spike 001.)
- The walk boundary guard SKIPS out-of-project references (path-containment under the project dir)
  and records the skipped set (skip-with-notice, not silent); it is a reference-resolution-layer
  guard, orthogonal to and composable with the diagnostic-layer `filter-diagnostics` + `includeDeps`.
  (Spike 002.)
- The D-03a guard splits three-way at `rootNames === 0`: references present + >=1 in-project leaf
  -> WALK; references present + 0 in-project -> synthesize error (new message); no references ->
  synthesize error (unchanged). rootNames>0 direct path untouched; no branch gates on TS18003.
  (Spike 004.)
- A walk target's Nx `targetDefaults` inputs MUST use the `default` named input (the lib+spec union),
  NOT `production` (which excludes `*.spec.ts`); `outputs: []`, the `{projectRoot}/tsconfig*.json`
  glob, and `^default` are already correct. (Spike 005.)
- Benchmarks use Vitest `bench` for standardized statistics (a standalone node harness may accompany
  it for production-representative absolutes + correctness assertions). (Maintainer directive, Spike 003.)
- For the Phase-13 spec rewrite: the `fixtures/solution-style` leaf (currently clean) needs a KNOWN
  diagnostic and a real `tsconfig.spec.json` leaf so the walk assertion proves type-checking occurred
  (the substrate gap). (Spikes 001/004.)

## DEFERRED synergy

- Project references + `NgtscProgram` per-file incremental declaration-reuse could compile a shared
  dep once and reuse its declarations across leaves, collapsing the walk's double-compile tax toward
  zero. Already DEFERRED in PROJECT.md (Approach A / `performCompilation` for v0.0.x). The walk is
  correct today; the optimization is additive later. (Spike 003.)

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
| 005 | coarse-single-target-caching | 5 | standard | one Nx target (`outputs: []`, union of leaf inputs) yields a sound coarse cache key: any leaf/dep change busts, nothing under-hashes | **VALIDATED** (1 required input change: `production` -> `default`) | caching, nx, devex |

_Build order: risk order (aggregation -> boundary -> cost -> D-03a split -> caching). Aggregation
runs first as the make-or-break gate; a NO-GO there kills the idea before the rest. Spike # follows
run order; the Obj column maps each back to the idea's original 1-5 numbering._

---

## Idea 2 -- v0.1.2 Storybook type-check gate (Phase 16, SB-05)

Resolve the hard GO/NO-GO gates (G1-G5) that decide whether the centralized Storybook-host
layout (Layout B, the Nx "one-storybook-for-all" recipe) is type-checkable on the OFFICIAL
stack (Nx 23.0.1 / Angular 22.0.4 / TS 6.0.3, `@storybook/angular@10.4.6` force-installed) --
so the milestone commits to Layout B ONLY on evidence, or ships Layout A alone with Layout B
documented "not yet supported". Full gate detail + decision tree:
`.planning/research/v0.1.2-storybook/board/CONSENSUS.md` (P16 spike section). Governing charter:
**never a silent false pass**. Build order = risk order (G2 -> G3 -> G4 -> G1 -> G5); G2/G3/G4
are the kill gates, G1/G5 select the shipping branch. User directive: build G2 first, then reassess.

### Requirements emerging from this idea

- **G2 = YES (Spike 006):** a Layout-B host's widened cross-project `.storybook/tsconfig.json`
  `include` globs DO materialize the aggregated `*.stories.ts`/`*.component.ts` as the leaf's
  `parsed.rootNames` (declared inputs) on the official stack. The input-set-membership boundary
  primitive is viable for Layout B.
- **Program-roots superset (Spike 006):** `program.getTsProgram().getRootFileNames()` = the
  declared `readConfiguration().rootNames` PLUS one synthetic `<root>.ngtypecheck.ts` shim per
  root. Phase 17 keys `inputTs` on the DECLARED set (or tolerates + never treats a shim path as a
  real first-party source when computing `suppressedInGraph`).
- **Declared-vs-import-only (Spike 006):** only files the host `include` glob DECLARES become
  rootNames; an aggregated file reached ONLY via import is a SourceFile but not a rootName ->
  keep-rule (c) would suppress it. Reinforces D3 (check the WHOLE declared set, never a
  `*.stories.ts` allowlist; a stories-only host glob leaves aggregated components import-only).
- **G3 = YES + G4 = YES (Spike 007):** forced `@storybook/angular@10.4.6` (installed
  `--legacy-peer-deps` -- peer-caps Angular <22/TS ^4.9||^5, the real D4 conflict) compiles via
  `performCompilation` on the official stack with NO infra failure; a clean story passes clean.
- **D4 confirmed (Spike 007):** under `skipLibCheck:false`, forced-SB10 `.d.ts` produce 48
  diagnostics -- ALL `node_modules`-attributed and suppressed, ZERO leak in-project. Forced-SB10
  `.d.ts` errors can never cause a false FAIL; docs-only, no runtime version gate (D4/D6). The 48
  checked `.d.ts` + zero in-project TS2307/TS2305 also prove the SB10 type surface genuinely
  resolved under TS6.
- **NG8xxx fire on the forced stack (Spike 007, G4 positive):** NG8002 (core template) and NG8102
  (extended, promoted to error via `defaultCategory`) both fire RED in-project on aggregated
  components -- the "complete type-check incl. NG8xxx" claim is honest on green (SB-07).

### Spikes (Idea 2)

| # | Gate(s) | Type | Validates | Verdict | Tags |
|---|---------|------|-----------|---------|------|
| 006 | G2 (HARD prereq) | standard | widened cross-project `.storybook/tsconfig.json` include globs materialize as the leaf's `parsed.rootNames` (declared inputs, not merely imports) on the official Angular 22.0.4 / TS 6.0.3 stack | **VALIDATED (G2 = YES)** | storybook, layout-b, rootnames, boundary, gate, engine |
| 007 | G3, G4 | standard | forced `@storybook/angular@10.4.6` compiles via `performCompilation` (no infra fail) + clean story passes clean, SB10 `.d.ts` errors node_modules-suppressed (G3); NG8002 core + NG8102 extended fire RED in-project (G4, positive) | **VALIDATED (G3=YES, G4=YES)** | storybook, sb10, ng8xxx, gate, engine |
| 008 | G1, G5 | standard | external `templateUrl` `.html` NG8002+NG8102 attribute to the `.html` (G1 = html); both carry `relatedInformation` -> owning component `.ts` ("occurs in the template of component X"), a stable public signal (G5 = PASS 4a) | **VALIDATED (G1=html, G5=PASS 4a)** | storybook, external-template, attribution, relatedInformation, gate, engine |

_Build order: G2 -> (G3, G4) -> (G1, G5), risk order. G2 first per user directive; reassessed; then 007, then 008._

### Idea-2 GO/NO-GO verdict (Phase-16 gate)

**GO -- Layout B IS supportable on the official stack.** All three HARD kill gates pass
(G2 = YES rootNames, G3 = YES forced-SB10 compiles + clean-clean, G4 = YES NG8xxx fire RED), and
the selectors resolve to **D2(d) branch 4a** (G1 = html + G5 = PASS: map external `.html` ->
owning rootName component `.ts` via public `relatedInformation`). Phase 17 ships Layout A + Layout B
with the input-set-membership boundary and the 4a external-template branch. NO gate forced the
Layout-A-only fallback. Reviewed at the 16->17 handoff before planning Phase 17.

---

## Idea 3 -- Vite/Analog Storybook query-import support (post-v0.1.2 UAT follow-up)

The phase-19 OSS real-repo UAT (`.planning/phases/19-.../19-UAT.md`) found `angular-typechecker`
surfaces ~228 `TS2307` on radix-ng's Vite `?raw` imports. The engine is CORRECT to surface them
(a story is a declared rootName -> in-project -> kept). The open question: what is the cleanest,
SAFE consumer-facing resolution for Vite/Analog Storybook stories using Vite query suffixes
(`?raw`/`?url`/`?worker`/`?inline`/virtual modules), WITHOUT auto-suppressing `TS2307` (a missing
module can be real -- the never-a-silent-false-pass charter). Candidates: documented recipe
(`vite/client`) vs a shipped hand shim vs an in-tool detection advisory.

### Requirements emerging from this idea

- **Recommended fix = `"types": ["vite/client"]`** on the checked tsconfig (Spike 009). `vite/client`
  declares the full query family as wildcard ambient modules; one line zeroes the query `TS2307`
  (227 -> 0 on radix, 5 -> 0 hermetic). A hand `declare module '*?query'` .d.ts is a fallback but
  incomplete unless every suffix is enumerated (missed `?inline` in the hermetic test).
- **No-false-pass PRESERVED by the recipe (Spike 009):** an ambient wildcard satisfies module
  RESOLUTION for matched specifiers only -- a plain missing module (`./nope`) still fails `TS2307`
  (verified on radix: 1 pre-existing plain miss kept + a planted plain miss still errored), and the
  imported value keeps its real type (`?raw` -> `string`, so misuse still `TS2322`). The tool must
  NEVER auto-suppress `?query` `TS2307`.
- **Documented limitation (Spike 009):** a `?query` import of a NONEXISTENT base file resolves via
  the wildcard (TS cannot verify base existence through an ambient wildcard; mirrors Vite's own
  build-vs-typecheck split). Narrow -- only `?query`-suffixed imports of a missing base.

### Spikes (Idea 3)

| # | Name | Type | Validates | Verdict | Tags |
|---|------|------|-----------|---------|------|
| 009 | vite-ambient-shim-resolves-query-imports | comparison | ambient decls (`vite/client` vs hand shim) drop Vite `?query` TS2307 to 0 while a genuine missing module still fails (no-false-pass on resolution) and misuse still errors (no-false-pass on types); validated hermetically + on radix-ng (227->0) | **VALIDATED** | storybook, vite, analog, module-resolution, ts2307, no-false-pass, engine, devex |
| 010 | vite-query-detection-advisory | standard | a diagnostic-based detector (unresolved TS2307 + `?`-query specifier; NO Storybook/framework coupling) emits an advisory, never suppresses, no false positive on plain missing modules, self-gates silent once resolved | **VALIDATED** | storybook, vite, advisory, detection, no-false-pass, devex |

_Build order: risk order (009 the make-or-break recipe first; 010 the UX advisory second)._
