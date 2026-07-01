---
spike: 005
name: coarse-single-target-caching
type: standard
validates: 'Given a single Nx angular-typecheck target that walks the lib + spec leaves, when the task cache key is computed, then outputs:[] is correct and the inputs must union the leaf inputs so any leaf/dep change busts the cache and nothing under-hashes'
verdict: VALIDATED
related: [002, 003]
tags: [caching, nx, devex]
---

# Spike 005: coarse-single-target-caching

## What This Validates

**Given** a single `angular-typecheck` target pointed at the solution `tsconfig.json` that WALKS the
lib + spec leaves, **when** Nx computes the task cache key (a content hash over the RESOLVED INPUT
FILE SET), **then** `outputs: []` is correct (no emit) and the inputs must cover the UNION of the
leaf inputs so any leaf/dep change busts the cache and nothing under-hashes. [Objective 5]

## Research

Nx hashes exactly the files that its resolved input set contains -- so a file can bust the cache
IFF it is a member of that set. The shipped `targetDefaults["angular-typecheck"]` (nx.json) is:

```json
"outputs": [],
"inputs": [
  "production",                       // <- excludes *.spec.ts AND tsconfig.spec.json
  "{projectRoot}/tsconfig*.json",     // <- re-adds tsconfig.spec.json
  "{projectRoot}/package.json",
  "{workspaceRoot}/tsconfig.base.json",
  "^default",                         // <- dependency projects' default inputs (covers the dep)
  { "dependentTasksOutputFiles": "**/*.{d.ts,...,tsbuildinfo}", "transitive": true },
  { "externalDependencies": ["typescript", "@angular/compiler-cli"] }
]
```

The `production` named input excludes spec sources:
`"!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)"` and `"!{projectRoot}/tsconfig.spec.json"`.
That is correct for TODAY's target (it points at `tsconfig.lib.json`, which excludes specs). But a
WALK target ALSO checks the spec leaf -- so it must hash spec sources too.

## How to Run

```
node .planning/spikes/005-coarse-single-target-caching/harness.mjs
```

Resolves the named inputs (verbatim from nx.json) against the modeled project file set (real files +
the spec source + spec tsconfig a walk would add) using `minimatch`, and asserts membership. Exits 0
on all-pass; writes `forensic-log.json`.

Dependency-edge (`^default`) coverage confirmed live:

```
npx nx show projects --affected --files=libs/typecheck-consumer-dep/src/lib/dep.component.ts
-> ["typecheck-consumer-dep","angular-typechecker-cache-e2e","typecheck-consumer"]
```

`typecheck-consumer` is affected by a dep-source change -> the project-graph edge exists and
`^default` hashes the non-buildable dep's source.

## What to Expect

| File-set                             | spec SOURCE hashed? | tsconfig.spec.json hashed? |
| ------------------------------------ | :-----------------: | :------------------------: |
| `default` named input                |         yes         |            yes             |
| `production` named input             |       **no**        |             no             |
| CURRENT target inputs                |       **no**        | yes (via `tsconfig*.json`) |
| WALK target inputs (`default`-based) |         yes         |            yes             |

All 6 assertions PASS; `VERDICT: VALIDATED`.

## Investigation Trail

1. Read `targetDefaults["angular-typecheck"]` from nx.json: `outputs: []` (correct) and a
   `production`-based input set. Spotted that `production` excludes `*.spec.ts` + `tsconfig.spec.json`.
2. Built a `minimatch` resolver over the named inputs and the modeled project file set (real files +
   a walk's spec source + spec tsconfig).
3. **First run FAILED C6** -- my resolver applied `production`'s internal excludes to the WHOLE union,
   so it dropped `tsconfig.spec.json` even though the separate `tsconfig*.json` input re-adds it.
   That was a resolver bug, not a finding: Nx scopes a named input's `!` excludes to that named
   input; sibling inputs union independently. Fixed the resolver (per-input exclude scoping).
4. Re-run: 6/6 PASS. The corrected picture SHARPENS the finding -- the current inputs already hash
   `tsconfig.spec.json` (via the glob); it is specifically the spec SOURCE files that `production`
   drops.
5. Confirmed `^default` reaches the non-buildable dep via `nx show projects --affected`.

## Results

**VERDICT: VALIDATED.**

- **`outputs: []` is already correct** -- the type-check emits nothing; Nx caches the terminal
  output + exit code only.
- **THE FINDING (the one config change the walk needs):** swap the target's file-set input from
  `production` to `default` (the union that INCLUDES spec sources). Without it, a spec-only edit does
  NOT bust a walk target that checks the spec leaf -> STALE PASS (a type-checker that lies about
  specs). `tsconfig.spec.json` is already covered by `{projectRoot}/tsconfig*.json`, and `^default`
  already covers the non-buildable dep source, so `production -> default` is the ONLY input change.
- **The module-boundary guard (Spike 002) is a caching-correctness mechanism too.** Because the walk
  skips out-of-project references, it never reads a file OUTSIDE the project + its graph deps -- i.e.
  outside what `default` + `^default` hash. So nothing the walk reads is left un-hashed: no stale
  PASS is possible from a file Nx didn't know about.
- **Coarseness tradeoff (from Spike 003):** one target = one cache entry, so ANY project source (lib
  OR spec) or dep change busts the WHOLE type-check (re-runs all leaves). Coarser than N per-leaf
  targets, but correct and simple -- the right default for a check-everything tool. If per-leaf cache
  granularity is ever wanted, that is the multi-target alternative, not this walk.

**Impact:** GO on Objective 5, with ONE concrete requirement for Phase 13: a walk target's
`targetDefaults` inputs use `default` (not `production`). Hand this to planning alongside the
generator's target-shape decision (GEN-02/03).
