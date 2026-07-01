---
spike: 002
name: module-boundary-guard
type: standard
validates: 'Given a solution tsconfig.json whose references[] include an out-of-project path plus a local path-mapped dep, when the walker resolves references, then out-of-project references are rejected/skipped at the walk boundary while local path-mapped dep sources stay governed by the existing filter-diagnostics + includeDeps'
verdict: VALIDATED
related: [001, 004]
tags: [boundary, security, engine]
---

# Spike 002: module-boundary-guard

## What This Validates

**Given** a solution `project/tsconfig.json` whose `references[]` include an IN-project leaf
(`./tsconfig.lib.json`) and an OUT-of-project leaf (`../outsider/tsconfig.lib.json`), and whose
in-project leaf imports both an in-project path-mapped dep (`@in/dep`) and an out-of-project one
(`@ext/dep`), **when** the walker resolves references and applies a module-boundary guard,
**then** the out-of-project _reference_ is skipped from the walk (its diagnostics never gathered,
and `includeDeps=true` does NOT resurrect it), while out-of-project imported _dep sources_ stay
governed by the EXISTING `filter-diagnostics` + `includeDeps` -- unchanged. [Objective 2]

## Research

Two boundaries exist and must not be conflated:

| Boundary                       | Layer                | Mechanism                                                                                                                                                                                                            | Toggle             |
| ------------------------------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| WALK boundary (NEW)            | reference resolution | a referenced leaf is walked iff its resolved config path is UNDER the project dir (dirname of the solution tsconfig), canonicalized (realpath + case-fold) exactly like the diagnostic filter's basePath (D-05/D-06) | none -- structural |
| DIAGNOSTIC boundary (EXISTING) | post-compilation     | `filter-diagnostics`: a diagnostic's `file` under the project basePath is kept, else suppressed; `node_modules` segment excluded                                                                                     | `includeDeps`      |

The engine core is path-based and Nx-agnostic (D-04), so path-containment under the project dir is
the natural boundary at the core layer. A richer alternative exists ONE layer up (the Nx executor
adapter already holds `ExecutorContext.projectGraph`, so it could define "in-project" by the Nx
project's `sourceRoot`/`root` instead of raw path-containment) -- recorded as a Phase-13 design
option, not needed for the core proof.

**Reject vs skip:** this spike implements SKIP + record the skipped set (`skippedReferences`) so
the engine can surface a notice rather than silently under-checking. A hard REJECT (error) is the
alternative; SKIP-with-notice is recommended because a project's references to sibling projects are
a normal Nx/TS-build-ordering artifact, not a request to type-check those siblings.

## How to Run

```
node .planning/spikes/002-module-boundary-guard/harness.mjs
```

Exits 0 on all-pass. Writes `forensic-log.json`. Runs the guarded walk at includeDeps false AND
true, plus a NO-GUARD baseline (walk every reference) at includeDeps=true for contrast.

## What to Expect

| Run                        | errorCount | files reported                                                   |
| -------------------------- | ---------- | ---------------------------------------------------------------- |
| guarded, includeDeps=false | 1          | in-project dep only (external dep suppressed, suppressedCount=1) |
| guarded, includeDeps=true  | 2          | in-project dep + external dep (outsider STILL absent)            |
| no-guard, includeDeps=true | 3          | in-project dep + external dep + OUTSIDER (leaks)                 |

All 7 assertions PASS; `VERDICT: VALIDATED`.

## Observability

`forensic-log.json`: resolved references, walked vs skipped sets, the three runs' errorCount +
suppressedCount + reported files, and every assertion.

## Investigation Trail

1. Built a fixture that separates the two boundaries: an out-of-project _referenced project_
   (`outsider`) and an out-of-project _imported dep source_ (`external-dep`), plus an in-project
   dep (`indep`). Distinct files carry distinct TS2322s so presence is unambiguous per file.
2. Implemented the guard as path-containment under the project dir, canonicalized with the same
   realpath+case-fold canonicalizer the diagnostic filter uses.
3. Ran guarded (includeDeps false/true) + a no-guard baseline. All 7 assertions passed first run.
4. **Key contrast isolated.** The diagnostic filter ALONE would already suppress the outsider error
   under includeDeps=false (it is out-of-basePath) -- so includeDeps=false could not, on its own,
   prove the walk guard. The discriminating case is includeDeps=TRUE: it resurrects the out-of-project
   imported SOURCE (external-dep) but must NOT resurrect the out-of-project REFERENCE (outsider). The
   no-guard baseline confirms outsider leaks at includeDeps=true without the guard, and the guarded
   run confirms it does not. The guard is therefore doing distinct, load-bearing work.

## Results

**VERDICT: VALIDATED.**

- **The walk boundary is distinct from and composes with the diagnostic boundary.** Out-of-project
  references are skipped structurally (never become leaves); out-of-project imported dep sources
  remain governed by the unchanged `filter-diagnostics` + `includeDeps`. `includeDeps` toggles the
  latter and has NO effect on the former -- exactly the separation Objective 2 requires.
- **The existing filter behavior is unchanged under the walk.** In-project path-mapped dep sources
  are reported by default; external dep sources are suppressed by default and kept with
  `includeDeps` -- identical to the shipped single-leaf behavior, just fed a unioned input.
- **The guard is load-bearing (not incidental).** Without it, walking every reference and setting
  `includeDeps=true` leaks the outsider project's error (errorCount 3 vs 2).

**Edge case flagged for Spike 004:** if EVERY reference is out-of-project, the guard yields zero
leaves and thus zero rootNames overall. That must synthesize the deterministic error (never a false
"0 files / 0 errors" clean) -- i.e. the D-03a guard still fires when references exist but none
survive the boundary. Resolve the exact split in Spike 004.

**Design decisions for Phase 13 discuss (recorded, not locked here):** (a) skip-with-notice vs hard
reject for out-of-project references; (b) core path-containment boundary vs an executor-layer Nx
project-graph boundary. GO on Objective 2.
