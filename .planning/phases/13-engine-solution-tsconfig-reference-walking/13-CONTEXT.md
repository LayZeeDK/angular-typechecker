# Phase 13: Engine -- solution-tsconfig reference-walking - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning
**Mode:** `--analyze` + phase-specific research (4 parallel research agents over the engine
source + installed packages + spikes 001-005). Three-and-a-half forks auto-locked
(evidence-backed, HIGH confidence, non-trap); one sub-decision (broken referenced leaf)
was HIGH-impact + NOT-HIGH-confidence (trap quadrant) and resolved by the maintainer.

<domain>
## Phase Boundary

Teach the `angular-typecheck` engine (`runTypecheck`) to accept a solution /
references-only `tsconfig.json` and type-check each IN-PROJECT referenced leaf (lib/app +
spec) in ONE call: resolve `references[]` to leaf tsconfigs, run `performCompilation` per
leaf, UNION the raw per-leaf diagnostics into a single `finalize` pass (dedupe by
`ts.sortAndDeduplicateDiagnostics` value identity; explicit post-dedupe category counts;
basePath = the solution tsconfig's directory). This supersedes the D-03a solution-style
short-circuit so a single target pointed at `tsconfig.json` yields the complete,
duplicate-free diagnostic set for the whole project.

Requirements **WALK-01, WALK-02** are locked (see REQUIREMENTS.md). This is engine-only
(Approach A / `performCompilation`; NO `NgtscProgram`) and generator-independent -- the
generator (Phase 14) and its e2e (Phase 15) CONSUME this walk. **This is a HOW-only
discussion**: the WHAT is fixed by ROADMAP SC1-5 and the five VALIDATED spikes.

**In scope:** the reference-resolution + per-leaf walk loop; the module-boundary guard
(core, path-containment); the D-03a three-way split; the `skippedReferences` notice; the
`production` -> `default` Nx input change; the `fixtures/solution-style` substrate upgrade
(KNOWN diagnostic + real `tsconfig.spec.json` leaf) + references-less + out-of-project-refs
fixtures; the `config-resolution.integration.spec.ts:124-152` rewrite; README walk recipe.

**Out of scope (own phases / deferred):** the `typecheck-configuration` generator (Phase 14);
generator e2e + `-p` guard (Phase 15); `NgtscProgram` incremental declaration-reuse
(WALK-FUT-02); `createNodesV2` per-leaf granular targets (WALK-FUT-01); an executor-layer
Nx project-graph boundary (deferred, composes additively over the core guard); transitive
reference recursion.
</domain>

<decisions>
## Implementation Decisions

### Locked upstream (spikes 001-005 + ROADMAP SC1-5 + WALK-01/02) -- do NOT re-open

These are FIXED before this discussion; the planner encodes them, the researcher pins exact
mechanics. Listed so no downstream agent re-litigates a settled fork.

- **L-1 Aggregation:** union raw per-leaf diagnostics -> ONE `finalize` over the union
  (boundary-filter -> `ts.sortAndDeduplicateDiagnostics` -> explicit post-dedupe
  `DiagnosticCategory` counts, NEVER `length - errorCount`); basePath = the solution
  tsconfig's directory. (Spike 001; `run-typecheck.ts:394-456`.)
- **L-2 Dedupe identity:** `file.path` + start + length + code + `messageText` -- exactly
  `ts.sortAndDeduplicateDiagnostics`' comparer (keys on `file.path` STRING, not the
  `SourceFile` object -- proven for cross-`Program` union). (Spike 001.)
- **L-3 D-03a three-way split** at `rootNames.length === 0`: references present + >=1
  in-project leaf -> WALK; references present + 0 in-project -> synth error (code `90001`,
  distinct message); no references -> unchanged empty-project error. `rootNames > 0`
  direct-leaf path UNTOUCHED; NO branch gates on TS18003; `rootNamesCount` = sum over walked
  leaves. (Spike 004; ROADMAP SC3; `run-typecheck.ts:185-203,329-356`.)
- **L-4 Skip-with-notice (not silent, not hard-reject):** the module-boundary guard SKIPS
  out-of-project references and records the skipped set. Orthogonal to and composable with
  the existing diagnostic-layer `filter-diagnostics` + `includeDeps` (which continue to
  govern imported SOURCE diagnostics unchanged). (Spike 002; ROADMAP SC2.)
- **L-5 Nx inputs:** swap `production` -> `default` (the lib+spec source union -- spec
  sources MUST hash or a spec-only edit yields a stale PASS); `outputs: []`, the
  `{projectRoot}/tsconfig*.json` glob, and `^default` retained. (Spike 005; WALK-02.)
- **L-6 Fixtures + spec:** `fixtures/solution-style` gains a KNOWN diagnostic + a real
  `tsconfig.spec.json` leaf (so the walk assertion proves type-checking occurred); a
  references-less fixture covers the still-errors branch; an out-of-project-refs fixture
  covers the boundary guard; `config-resolution.integration.spec.ts:124-152` is rewritten to
  assert the walk. (ROADMAP SC4; Spike 004 spec-rewrite note.)
- **L-7 Approach A:** `performCompilation` per leaf; NO `NgtscProgram`. Incremental
  declaration-reuse (collapsing the ~1-extra-compile-per-leaf tax) is DEFERRED (WALK-FUT-02).
  (Spike 003; PROJECT.md.)

### GA-1 -- Module-boundary guard layer (open fork -> AUTO-LOCKED)

- **D-01:** The guard lives in the **PURE CORE** engine and decides "in-project" by
  **path-containment under the solution tsconfig's directory**, canonicalized with the SAME
  `createCanonicalizer` (realpath + `\\`->`/` + case-fold) and `isUnderDir` that
  `filter-diagnostics.ts` already ships. It is structural (no toggle), operates at the
  reference-resolution layer, and reuses tested machinery verbatim.
  - **Rejected (deferred):** an Nx project-graph boundary at the executor layer
    (`ExecutorContext.projectGraph` -> project `sourceRoot`/`root`). It would require plumbing
    the Nx graph INTO the core, breaking the D-04 Nx-agnostic core contract
    (`run-typecheck.ts:110-122`; core has zero `@nx/devkit` imports). It is ADDITIVE -- it can
    layer over the core path-containment floor later without unwinding D-01 (see Deferred).
  - **Rating:** IMPACT MEDIUM (guard's observable behavior is identical under both options; only
    code location forks; fully reversible/composable), CONFIDENCE HIGH (Spike 002 VALIDATED;
    ROADMAP SC2 mandates path-containment; upholds the code-verified D-04 contract). Non-trap.

### GA-2 -- Skipped-reference surfacing (open fork -> AUTO-LOCKED)

- **D-02:** The engine sets a **new pure-detection OPTIONAL field on `CoreResult`**
  (working name `skippedReferences`) with NO `console`/`process` -- mirroring the shipped
  RES-02 `templateCheckAborted` pattern (`run-typecheck.ts:52-71,444-489`). The Nx executor
  adapter branches on presence and renders the loud, path-named notice via `logger.warn`,
  reusing the exact seam at `executor.ts:49-63`. The notice is ADVISORY, never a verdict
  change (consistent with L-4 skip-with-notice).
  - **Rejected:** folding an advisory diagnostic into `diagnostics` (pollutes the "genuine
    compiler diagnostics only" set + counts, `run-typecheck.ts:38-42`); core-side logging
    (HARD-fails the `no-console` lint gate scoped to `**/src/core/**`, `eslint.config.mjs:16,54`).
  - **Rating:** IMPACT MEDIUM (`CoreResult` is a public exported shape -- `index.ts:15` -- but an
    optional field is additive/non-breaking, and 0.x semver), CONFIDENCE HIGH (mirrors a shipped,
    4-tier-tested pattern). Non-trap.

### GA-3 -- Reference-walk depth (open fork -> AUTO-LOCKED)

- **D-03:** Walk the solution tsconfig's **DIRECT `references[]` only (one level)**. Do NOT
  recurse into a referenced leaf's own `references[]`. `ParsedConfiguration.projectReferences`
  is single-level by type (`readonly ts.ProjectReference[]`, `perform_compile.d.ts:18`);
  repo-wide, `references[]` appears ONLY in solution tsconfigs (leaves use `include`/`files`);
  cross-project deps flow through `tsconfig.base.json` `paths` as imported SOURCE (pulled into
  each leaf's Program by module resolution, governed by the existing filter), NOT as reference
  edges. Matches all 5 spike fixtures.
  - **Rejected (deferred):** transitive recursion -- solves a layout that does not occur in Nx;
    adds recursion + cycle detection + re-dedupe for zero discovered leaves. Additive later
    (behind a visited-set) if a solution-of-solutions layout ever appears.
  - **Rating:** IMPACT LOW (does not under-check any real Nx layout; fully reversible/additive),
    CONFIDENCE HIGH (matches the `ts.ProjectReference` type shape, Nx convention, this repo's
    tsconfigs, and every spike). Non-trap.
- **D-03b (planner directive, rider on D-02/D-03):** Emit a **skip-with-notice for ANY resolved
  config (solution OR referenced leaf) that yields `rootNames.length === 0`** (references-only
  or empty `include`). The engine already returns only `parsed.errors` for such configs;
  promote that to an explicit user-visible `skippedReferences`-style notice so a mis-pointed
  reference cannot become a silent zero-diagnostic PASS. This closes the only theoretical
  under-check hazard of the direct-only walk.

### GA-4 -- Duplicate / self reference handling (open fork -> AUTO-LOCKED)

- **D-04:** At reference-resolution, BEFORE the per-leaf compile loop, **canonicalize +
  dedupe the resolved leaf paths and skip a self-reference** back to the solution tsconfig
  (canonical path equals the solution's). Output-neutral (the union `finalize` already dedupes
  diagnostics by value); it saves the ~1-full-`performCompilation`-per-redundant-leaf tax
  (spike 003). Record the deduped/skipped set for observability alongside `skippedReferences`.
  - **Rating:** IMPACT LOW, CONFIDENCE HIGH (canonicalizer exists; output cannot change). Non-trap.

### GA-5 -- Broken / nonexistent referenced leaf tsconfig (TRAP QUADRANT -> maintainer-decided)

- **D-05 (maintainer decision, 2026-07-01):** When the solution references a **NONEXISTENT**
  leaf tsconfig (typo / stale path -> ENOENT -> code-500 `UNKNOWN_ERROR_CODE` from a per-leaf
  `ng.readConfiguration`), the walk **synthesizes a COUNTED Error diagnostic** (a NEW code +
  message in the D-03a `9000x` synthesized family; e.g. `90002` -- exact number is a research
  directive) for the broken reference, then **walks the surviving leaves** (option **B3:
  fold-and-count**). Result: deterministic NON-ZERO verdict AND survivors still checked; no
  false-PASS-by-omission.
  - **Why this was NOT auto-locked:** HIGH impact (defines error semantics for a whole input
    class of a correctness tool; pinned by SC3 + the spec rewrite; inherited by Phases 14/15;
    not cheaply reversible) AND NOT-HIGH confidence (two SHIPPED principles conflict -- COR-01
    "a config-resolution 500 IS infrastructure -> rethrow" vs RES-02 "one fault must not
    collapse the run" -- and NO spike covered this input class). Escalated to the maintainer per
    the trap-quadrant rule; the maintainer selected B3.
  - **Scope:** B3 governs ONLY the nonexistent-PATH (500) case. A malformed / bad-`extends` leaf
    already folds as a counted 5012 diagnostic under shipped D-03 -- unchanged, not part of D-05.
  - **COR-01 containment (load-bearing):** B3 is a NARROW, deliberate reclassification of a
    referenced-leaf 500 into a counted diagnostic. The DIRECT single-config COR-01 path
    (`run-typecheck.ts:149-178`) and its pinning test (`config-resolution.integration.spec.ts:100-121`)
    stay BYTE-UNCHANGED. Only the walk's per-leaf resolution applies fold-and-count.
  - **Rejected:** B1 infra-abort (strongest COR-01 consistency but one typo collapses the whole
    multi-leaf run -- survivors never checked); B2 skip-with-notice (RES-aligned but risks a
    false PASS by omission if survivors are clean and the warn is missed).

### Claude's Discretion (research directives for `/gsd-plan-phase 13 --research`)

Facts/choices for the researcher to PIN and the planner to encode -- pre-grounded so research
is targeted, not open-ended:

1. **Synthesized code for D-05.** Pick the exact new code in the private `9000x` family
   (`ZERO_ROOT_NAMES_DIAGNOSTIC_CODE = 90001` at `run-typecheck.ts:93`) -- e.g. `90002` -- and
   its distinct message ("referenced tsconfig not found: <path>"). Keep it OUTSIDE the TS range
   and the Angular `-99xxxx` / `500` spaces (same rationale as 90001).
2. **`skippedReferences` field shape.** Model on `TemplateCheckAborted` (`run-typecheck.ts:80-87`):
   a small named interface carrying the offending reference path(s) + reason (out-of-project vs
   0-rootNames). Decide singular vs array (array -- a solution can have multiple). Gate adapter
   emission on non-empty, mirroring the `!== undefined` gate.
3. **Where the walk lives (code organization).** Likely a new `walk-references.ts` core module
   (mirrors the separate `filter-diagnostics.ts` / `gather-diagnostics.ts` modularity) invoked
   from `runTypecheck` at the D-03a split; or inline. Planner's call -- keep the core pure
   (no `console`/`process`).
4. **The KNOWN diagnostic for `fixtures/solution-style`.** Plant a stable, unambiguous
   diagnostic in the lib/app leaf AND add a `tsconfig.spec.json` leaf with its own planted error
   (so the walk union proves BOTH leaves ran). Avoid co-firing extras (cf. spike 001's NG8117 +
   NG8109 interpolated-signal surprise) -- prefer a plain TS error (e.g. TS2322) per leaf.
5. **`includeDeps` / `pathBase` propagation.** These are run-level `CoreOptions`; confirm they
   apply once to the single union `finalize` (not per-leaf), preserving current semantics.
6. **`templateCheckAborted` across leaves.** Confirm the pre-filter Fatal scan runs over the
   UNIONED raw diagnostics so a TCB-abort in ANY leaf still fires the notice.
   </decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Strategy / requirements (read FIRST)

- `.planning/REQUIREMENTS.md` (WALK-01, WALK-02) -- the locked requirements for this phase.
- `.planning/ROADMAP.md` (Phase 13 "Phase Details") -- goal-backward success criteria SC1-5.
- `.planning/spikes/MANIFEST.md` -- the locked design decisions ("Requirements" section) and
  the 5-spike verdict table; the authoritative GO record for the walk.

### Spike reports (the de-risking evidence -- read the ones matching each decision)

- `.planning/spikes/001-reference-walk-aggregation/README.md` -- union-raw -> single-finalize
  aggregation + cross-`Program` value-dedupe (L-1/L-2). Note the NG8117+NG8109 co-fire surprise.
- `.planning/spikes/002-module-boundary-guard/README.md` -- core path-containment guard,
  skip-with-notice, the two-boundary table (L-4 / D-01); records the Nx-graph boundary as a
  deferred Phase-13 option.
- `.planning/spikes/003-double-compile-cost/README.md` -- ~1 extra `performCompilation` per
  leaf; WALK ~2x a single combined program; DEFERRED incremental-reuse synergy (L-7).
- `.planning/spikes/004-d03a-surgical-split/README.md` -- the three-way `rootNames===0` split
  - the concrete `config-resolution.integration.spec.ts:124-152` rewrite (L-3 / L-6).
- `.planning/spikes/005-coarse-single-target-caching/README.md` -- `production`->`default`
  input change; `outputs:[]`; `^default` covers the non-buildable dep (L-5 / WALK-02).

### Existing engine code to extend / mirror

- `packages/angular-typechecker/src/core/run-typecheck.ts` -- the engine: D-03a guard
  (185-203), `synthesizeZeroRootNamesDiagnostic` (329-356), `finalize` (394-456), the RES-02
  `templateCheckAborted` pure-detection pattern (52-71, 444-489) to MIRROR for D-02, the COR-01
  500 scan/rethrow (149-178) that D-05 narrowly reclassifies per-leaf.
- `packages/angular-typechecker/src/core/filter-diagnostics.ts` -- `createCanonicalizer` +
  `isUnderDir` + `isNodeModulesPath` (121-201) that D-01 (guard) and D-04 (leaf dedupe) reuse.
- `packages/angular-typechecker/src/core/gather-diagnostics.ts` -- `gatherAllDiagnostics` (the
  unconditional all-getter each per-leaf `performCompilation` uses).
- `packages/angular-typechecker/src/executors/**` (the Nx adapter, incl. `executor.ts:49-63`
  render seam + `normalize-options.ts`) -- where D-02's `logger.warn` notice renders.
- `packages/angular-typechecker/src/index.ts` -- the public barrel exporting `CoreResult`
  (the shape D-02 adds an optional field to).

### The spec + fixtures this phase edits

- `packages/angular-typechecker/src/core/config-resolution.integration.spec.ts:124-152` -- the
  solution-style guard block REWRITTEN to assert the walk (L-6 / Spike 004).
- `fixtures/solution-style/{tsconfig.json,tsconfig.app.json,error.component.ts}` -- upgraded
  with a KNOWN diagnostic + a real `tsconfig.spec.json` leaf (L-6 / directive 4).

### Codebase maps

- `.planning/codebase/TESTING.md` -- test tiers, `*.integration.spec.ts` naming, fixtures
  convention, the `NG()` negative-encoding rule, integration timeout, `typecheck-drift` target.
- `.planning/codebase/ARCHITECTURE.md` / `CONVENTIONS.md` -- core-vs-adapter purity boundary,
  module layout, D-nn decision vocabulary.

### Config the walk target depends on

- `nx.json` (`targetDefaults["angular-typecheck"]`) -- the `production`->`default` input swap
  lands here (L-5 / WALK-02).
  </canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `filter-diagnostics.ts` `createCanonicalizer` + `isUnderDir` + `isNodeModulesPath`: the exact
  realpath/case-fold path-containment machinery the D-01 core boundary guard and the D-04 leaf
  dedupe reuse verbatim -- no new canonicalizer.
- `run-typecheck.ts` `finalize` (union -> filter -> `sortAndDeduplicateDiagnostics` -> explicit
  counts): already the single aggregation seam; the walk feeds it the UNION of leaves (L-1). No
  second dedupe/merge layer needed.
- `run-typecheck.ts` `templateCheckAborted` / `detectTemplateCheckAborted`: the shipped
  "pure-detection field on CoreResult, adapter renders `logger.warn`" template D-02 clones.
- `synthesizeZeroRootNamesDiagnostic` + `ZERO_ROOT_NAMES_DIAGNOSTIC_CODE = 90001`: the
  synthesized-Error idiom D-05 (B3) and the L-3 none-in-project branch extend (new `9000x` code).

### Established Patterns

- Core is PURE and Nx-agnostic (D-04 contract; `no-console`/`no-process` ESLint gate on
  `**/src/core/**`); the executor adapter owns ALL I/O + logging + exit. Every new notice
  (D-02) is a pure field set in core + a `logger.warn` in the adapter.
- Diagnostics are counted by `ts.DiagnosticCategory`, never by code sign or `length - errorCount`.
- Integration specs call `runTypecheck({ tsConfigPath })` against a `fixtures/*` tsconfig and
  assert off `CoreResult`; codes via `NG()` / raw TS codes; `it.each` is the parameterized idiom.

### Integration Points

- The walk hooks in at the D-03a `rootNames.length === 0` split in `runTypecheck`
  (`run-typecheck.ts:190`) -- the references-present + >=1-in-project branch calls the new walk;
  the other two branches keep synthesizing the guard error.
- New/changed specs live under `packages/angular-typechecker/src/core/*.integration.spec.ts`
  (auto-routed into the existing 6-cell `test` matrix; no `ci.yml` change).
- The `production`->`default` change is a one-line edit in `nx.json` `targetDefaults`.
  </code_context>

<specifics>
## Specific Ideas (verified this session, 2026-07-01)

- Cross-`Program` dedupe is sound because `ts.sortAndDeduplicateDiagnostics` keys on
  `diagnostic.file.path` (a STRING), not the `SourceFile` object (spike 001, verified in
  typescript@6.0.3). A shared source compiled in the lib and spec leaves collapses to one.
- `ParsedConfiguration.projectReferences` is a FLAT `readonly ts.ProjectReference[]`
  (`node_modules/@angular/compiler-cli/src/perform_compile.d.ts:18`); `ProjectReference`
  (`typescript.d.ts:6983-6992`) has no nested `references` -- so a single-level walk is the
  data's natural shape (D-03).
- A nonexistent tsconfig PATH reliably yields code-500 `UNKNOWN_ERROR_CODE` (ENOENT via
  `readConfiguration`'s outer catch); a nonexistent `extends` TARGET yields a folded 5012 --
  distinct, and only the former is subject to D-05 (B3).
- The walk adds NO compute vs the multi-target alternative (~N compiles either way); its real
  trade is coarser caching (one key), which spike 005 made sound via `production`->`default`.
  </specifics>

<deferred>
## Deferred Ideas

- **Executor-layer Nx project-graph boundary** (GA-1 rejected variant) -- define "in-project"
  by the Nx project `sourceRoot`/`root` via `ExecutorContext.projectGraph`. ADDITIVE over the
  core path-containment floor (D-01); revisit only if a non-standard physical layout needs it.
- **Transitive reference recursion** (GA-3 rejected variant) -- recurse into a leaf's own
  `references[]` behind a visited-set. No Nx layout exercises it today; add additively if a
  solution-of-solutions layout ever appears.
- **WALK-FUT-01** (`createNodesV2` granular per-leaf `typecheck` targets) and **WALK-FUT-02**
  (`NgtscProgram` incremental declaration-reuse to collapse the double-compile tax) -- tracked
  in REQUIREMENTS.md Future Requirements; both need the deferred `NgtscProgram` engine or Nx
  inference and are additive, not blocking.

None of these are in Phase 13 scope -- discussion stayed within the walk boundary.
</deferred>

---

_Phase: 13-engine-solution-tsconfig-reference-walking_
_Context gathered: 2026-07-01_
