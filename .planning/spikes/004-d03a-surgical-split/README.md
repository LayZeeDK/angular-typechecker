---
spike: 004
name: d03a-surgical-split
type: standard
validates: 'Given the zero-rootNames guard, when references[] are present and at least one survives the boundary guard the engine walks the leaves; when references are present but none are in-project, or there are no references, it still synthesizes the deterministic error; the rootNames>0 direct path is untouched'
verdict: VALIDATED
related: [001, 002]
tags: [guard, regression, engine]
---

# Spike 004: d03a-surgical-split

## What This Validates

**Given** the shipped D-03a guard that fires on `parsed.rootNames.length === 0`, **when** the split
adds a three-way branch at exactly that point, **then**: references present + >=1 in-project leaf ->
WALK (spike 001 pipeline); references present but none in-project -> STILL synthesize the guard
error (new message); no references (empty project) -> STILL synthesize the guard error (unchanged);
and the `rootNames > 0` direct-leaf path is untouched. This is the rewrite of
`config-resolution.integration.spec.ts:124-130`. [Objective 3]

## Research

The shipped guard (`run-typecheck.ts:190-203`) short-circuits ALL zero-rootNames configs to one
synthesized Error. The message already branches on `parsed.projectReferences?.length` (references-
present vs empty) -- but BOTH branches error today. The split reuses the SAME trigger
(`rootNames === 0`) and the SAME reference signal, and only changes the references-present branch to
walk WHEN a reference survives the module-boundary guard (Spike 002). The decision tree:

```
rootNames > 0                                             -> compile-direct              (UNCHANGED)
rootNames === 0 && references present && >=1 in-project   -> WALK the in-project leaves  (NEW)
rootNames === 0 && references present && 0 in-project     -> guard-error (none-in-project, NEW msg)
rootNames === 0 && no references                          -> guard-error (empty-project, UNCHANGED)
```

The guard must NOT gate on TS18003 (TypeScript suppresses "No inputs were found" when a config has
`references`) -- preserved (D-03a / L-2).

## How to Run

```
node .planning/spikes/004-d03a-surgical-split/harness.mjs
```

Exits 0 on all-pass. Writes `forensic-log.json` (per-scenario mode/rootNames/err/codes + the spec
rewrite note).

## What to Expect

| Scenario                          | entry                         | mode                                       | err | codes                       |
| --------------------------------- | ----------------------------- | ------------------------------------------ | --- | --------------------------- |
| solution, in-project ref          | `with-refs/tsconfig.json`     | **walk**                                   | 1   | `[2322]` (the leaf's error) |
| solution, out-of-project ref only | `oop-refs/tsconfig.json`      | **guard-error:references-none-in-project** | 1   | `[90001]`                   |
| empty (no files, no refs)         | `empty/tsconfig.json`         | **guard-error:empty-project**              | 1   | `[90001]`                   |
| direct leaf (rootNames>0)         | `with-refs/tsconfig.lib.json` | **compile-direct**                         | 1   | `[2322]`                    |

Shipped engine on the with-refs case: `guard-error` (the regression the rewrite fixes). All 6
assertions PASS; `VERDICT: VALIDATED`.

## Investigation Trail

1. Built four hermetic entries: a solution with an in-project ref (leaf carries a KNOWN TS2322 so
   the walk is observable), a solution with only an out-of-project ref (`../outsider`), an empty
   config, and a direct leaf.
2. Implemented the split as a single decision tree keyed on `rootNames`, `projectReferences.length`,
   and the boundary-guard survivor count (reusing Spike 002's `isInProjectReference`).
3. Ran all four + a `currentEngineMode` probe. All 6 assertions passed first run:
   - with-refs WALKS (reports the leaf TS2322; guard NOT synthesized) whereas the shipped engine
     returns guard-error -- proving the spec rewrite is needed and correct.
   - oop-refs and empty STILL error (code 90001), with distinct messages; the outsider error is
     never reported (its leaf is never walked -- composes with Spike 002).
   - direct-leaf is untouched.
   - no branch depends on TS18003.

## Results

**VERDICT: VALIDATED.**

- **The split is surgical.** It changes behavior for exactly ONE input class -- a zero-rootNames
  config whose references resolve to at least one in-project leaf -- and leaves every other class
  (direct leaf, empty project, all-out-of-project references) exactly as shipped.
- **No false clean anywhere.** Every non-walkable zero-rootNames config still returns a deterministic
  non-zero signal (code 90001), including the new "references present but none in-project" case that
  Spike 002 flagged. Composes cleanly with the boundary guard.
- **TS18003 independence preserved** (D-03a / L-2).

**Concrete spec rewrite for `config-resolution.integration.spec.ts:124-130`:**

1. The current block asserts the solution-style fixture returns `rootNamesCount: 0` + `errorCount: 1`.
   Under the split it now WALKS. Repoint it to the walk outcome: `rootNamesCount > 0` and the leaf's
   diagnostics reported. **The `fixtures/solution-style` leaf is currently clean** (`error.component.ts`
   is valid) -- to make the walk assertion prove type-checking occurred (not a false clean), give the
   leaf a known diagnostic OR add a `tsconfig.spec.json` leaf with a planted error and reference it
   from the solution (the substrate gap the maintainer flagged; do it in the real fixture, not just
   the spike).
2. KEEP a references-LESS empty fixture (or add one) asserting the guard STILL fires
   (`errorCount: 1`, leaf-tsconfig-naming message).
3. ADD a case for the new branch: a solution referencing only an out-of-project tsconfig ->
   `errorCount: 1` with the "none in-project" message.
4. The existing "does NOT gate on TS18003" assertion is unchanged.

**Impact:** GO on Objective 3. The split logic, the two guard messages, and the CoreResult shape
question (rootNamesCount = sum of walked leaves' rootNames) are ready to hand to Phase-13 planning.
