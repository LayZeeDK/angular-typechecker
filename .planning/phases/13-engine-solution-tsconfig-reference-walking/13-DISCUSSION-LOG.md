# Phase 13: Engine -- solution-tsconfig reference-walking - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-07-01
**Phase:** 13-engine-solution-tsconfig-reference-walking
**Areas discussed:** Boundary layer, Skip-notice surfacing, Walk depth, Dedupe/self-ref, Broken leaf
**Mode:** `--analyze` + phase-specific research. Maintainer directive: "Research each question
then auto-pick the recommended option of the open decisions except for high-impact,
low-confidence." Four forks researched by parallel agents; the three-and-a-half evidence-backed
(HIGH-confidence, non-trap) forks were auto-locked; the one trap-quadrant sub-decision was
escalated to the maintainer.

---

## Boundary layer (GA-1 -> D-01) -- AUTO-LOCKED

| Option                            | Description                                                                                                                                                      | Selected |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Core path-containment             | Guard in the pure core; "in-project" = path-containment under the solution dir, reusing `filter-diagnostics.ts` canonicalizer/`isUnderDir`. Spike 002 VALIDATED. | [X]      |
| Nx project-graph (executor layer) | Define "in-project" via `ExecutorContext.projectGraph` sourceRoot/root. Would break the D-04 Nx-agnostic core contract; deferred (composes additively).          |          |

**Choice:** Core path-containment (auto -- IMPACT MEDIUM / CONFIDENCE HIGH / non-trap).
**Notes:** Spike 002 VALIDATED it; ROADMAP SC2 mandates path-containment; upholds the
code-verified D-04 core contract (zero `@nx/devkit` imports). Nx-graph variant is additive later.

---

## Skip-notice surfacing (GA-2 -> D-02) -- AUTO-LOCKED

| Option                                                | Description                                                                                                                                 | Selected |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Pure-detection CoreResult field + adapter logger.warn | New optional `skippedReferences` field set in core (no I/O); executor renders `logger.warn`. Mirrors shipped RES-02 `templateCheckAborted`. | [X]      |
| Fold advisory diagnostic into `diagnostics`           | Pollutes the genuine-diagnostics set + counts.                                                                                              |          |
| Log from core directly                                | Hard-fails the `no-console` lint gate on `**/src/core/**`.                                                                                  |          |

**Choice:** Pure-detection field + adapter warn (auto -- IMPACT MEDIUM / CONFIDENCE HIGH / non-trap).
**Notes:** Reuses the exact `executor.ts:49-63` seam; additive optional field on the public
`CoreResult` is non-breaking (0.x). Advisory, never a verdict change (consistent with locked L-4).

---

## Walk depth (GA-3 -> D-03 + D-03b) -- AUTO-LOCKED

| Option                             | Description                                                                                                                         | Selected |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Direct references only (one level) | Walk the solution's own `references[]`; do not recurse. `projectReferences` is single-level by type; Nx leaves carry no references. | [X]      |
| Transitive recursion               | Recurse into a leaf's own references. Solves a layout Nx does not produce; deferred.                                                |          |

**Choice:** Direct references only (auto -- IMPACT LOW / CONFIDENCE HIGH / non-trap).
**Notes:** Verified `ParsedConfiguration.projectReferences: readonly ts.ProjectReference[]`
(flat); repo-wide `references[]` only in solution tsconfigs; cross-project deps arrive as
path-mapped SOURCE, not reference edges. Planner directive D-03b added: emit skip-with-notice
for any resolved config (solution OR leaf) with 0 rootNames, closing the only theoretical
under-check hazard.

---

## Dedupe / self-ref (GA-4 -> D-04) -- AUTO-LOCKED

| Option                                           | Description                                                                                                | Selected |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | -------- |
| Canonicalize + dedupe leaf paths + skip self-ref | Before the compile loop; output-neutral (union already dedupes); saves ~1 full compile per redundant leaf. | [X]      |

**Choice:** Dedupe + skip self-ref (auto -- IMPACT LOW / CONFIDENCE HIGH / non-trap).
**Notes:** Canonicalizer already exists; cannot change the reported set (spike 001 value-dedupe).

---

## Broken leaf -- nonexistent referenced tsconfig (GA-5 -> D-05) -- MAINTAINER-DECIDED (trap quadrant)

| Option                                | Description                                                                                                                                                                          | Selected |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| B3: fold as counted error             | Synthesize a counted Error (new `9000x` code) for the broken ref, walk survivors. Non-zero verdict AND survivors checked; narrow COR-01 reclassification (referenced-leaf 500 only). | [X]      |
| B1: infra-abort (COR-01 consistency)  | Rethrow `TypecheckInfrastructureError`, abort the whole walk. Strongest consistency; one typo collapses the multi-leaf run.                                                          |          |
| B2: skip-with-notice (RES resilience) | Skip the broken leaf + warn, walk survivors. Risks a false PASS by omission if survivors are clean and the warn is missed.                                                           |          |

**Choice:** B3 fold-and-count (maintainer-selected).
**Notes:** NOT auto-locked -- HIGH impact (error semantics for a whole input class of a
correctness tool; pinned by SC3 + the spec rewrite; inherited by Phases 14/15) AND NOT-HIGH
confidence (COR-01 "500 = infra -> rethrow" vs RES-02 "one fault must not collapse the run"
conflict; NO spike covered this input class). Escalated per the trap-quadrant rule; maintainer
chose B3. Scope: nonexistent PATH (500) only -- a malformed/bad-`extends` leaf already folds as
5012 under shipped D-03. The direct single-config COR-01 path + its test stay byte-unchanged.

---

## Claude's Discretion

Handed to `/gsd-plan-phase 13 --research` (detailed in CONTEXT.md `<decisions>` -> Claude's
Discretion): the exact new `9000x` synth code + message for D-05; the `skippedReferences` field
shape (array; reason enum); walk code organization (new `walk-references.ts` core module vs
inline); the KNOWN diagnostic to plant per leaf in `fixtures/solution-style` (prefer a plain
TS2322 per leaf; avoid extended co-fires); `includeDeps`/`pathBase` apply once to the union
`finalize`; and confirming `templateCheckAborted` detection runs over the unioned raw set.

## Deferred Ideas

- Executor-layer Nx project-graph boundary (additive over the core guard).
- Transitive reference recursion (behind a visited-set, if ever needed).
- WALK-FUT-01 (`createNodesV2` granular per-leaf targets) / WALK-FUT-02 (`NgtscProgram`
  incremental declaration-reuse) -- tracked in REQUIREMENTS.md Future Requirements.
