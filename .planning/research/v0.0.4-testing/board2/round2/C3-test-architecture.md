# C3 - Test Architecture / Pyramid Economics & Maintainability - ROUND 2

Lens: tier design, coverage-per-cost, determinism, flakiness, redundancy vs gaps, maintainability.
Verdict: CONVERGE on all six. Every round-1 mind-change trigger I set is provably NOT met by the
round-2 verified facts, and the one runtime risk I flagged (catalog cold-compile across the 6-cell
matrix) is retired by fact A1.

---

## D1 - substrate: CONVERGE

My round-1 drop-trigger for authoring `createFsTree` was "the generator emits a real on-disk file
that a later in-boundary step reads back." Decision B fixes the generator shape as `project.json`-only
edits via `readProjectConfiguration`/`updateProjectConfiguration`/`formatFiles`, emitting no file any
in-process step reads back, with no per-project-type branching. That is exactly the shape the in-memory
`createTreeWithEmptyWorkspace` captures 100% of (read-back with no flush). The trigger is not met; the
452:1 in-memory:real-disk margin in the Nx repo (FACTS sec.6) stands. No fact sustains a HOLD.

## D2-organization: CONVERGE (changed from my round-1 per-version-file position)

I held for per-version files in round 1. Fact A7 is the direct counter-evidence I lacked: the
would-be `executor.angular17.*` file was renamed to `extended.promotion` because its
introduction-version signal was FALSE, and only the `angular13` file is populated today. My own round-1
text required the version in a filename to be "load-bearing, not decorative" - A7 shows the file split
actively manufactures false/empty version signals (taxonomy rot). The §D single enum-keyed `it.each`
table with introduction-version as a ROW FIELD keeps the version signal where it stays honest (a
column) while eliminating the rot. Fact A1 (cold-compile ~0.5s, ~9s/cell parallelized) removes any
runtime forcing function that could favor one file layout over the other, so the choice is purely
maintainability - and A7 settles it against the file split. No fact sustains a HOLD; A7 obliges the
change.

## D2-scope: CONVERGE

My round-1 position was all 18 members by exact code + category + count + promotion. §D matches
exactly. Fact A2 supplies the authoritative ErrorCode map I was missing (including the two
out-of-81xx codes 8011/8021 and the confirmation that 8110/8118 are NOT configurable enum members),
and §D's `it.skip`-with-written-reason rule covers my round-1 feasibility caveat (any member not
reproducible by a static fixture is marked, never silent). Nothing to HOLD.

## D2-tripwire: CONVERGE

Fact A2 confirms the configurable extended set is EXACTLY the 18 `ExtendedTemplateDiagnosticName`
members. That gives the completeness tripwire (catalog rows === enum members) a precise, authoritative
target and makes it a cheap, in-plugin guard against catalog rot on every Angular upgrade. Per fact A3
the core does no per-code branching, so the tripwire's only job is catalog/enum drift detection - well
scoped. CONVERGE.

## D3 - mid-tier: CONVERGE

My round-1 mid-tier was conditioned on an UNCOVERED `context.root`->`tsConfig` branch existing, and my
mind-change trigger said: if that coverage is reachable as a pure unit test, push it down instead of
adding a tier. Fact A4 settles it: `normalize-options.ts` resolution is a pure two-branch function with
`normalize-options.spec.ts` present, and NO executor-only resolution branch unreached by the unit spec
+ e2e was found. The gap I hypothesized does not exist, so a mid-tier has no economic justification.
§D (add the missing case to `normalize-options.spec.ts` if any, no new tier) IS my own pushed-down
fallback. CONVERGE.

## D4 - generator e2e: CONVERGE

My round-1 position was one thin generator smoke folded into the existing `install-e2e` tarball
harness (no new project, no Verdaccio). Fact A6 confirms `install-e2e`'s `consumer-app` is ALREADY
target-pre-wired, so hosting a generator e2e requires shipping `generators.json` + the generator and
adding an UN-wired project - precisely what §D specifies, plus `--skip-nx-cache`. CONVERGE.

## D5 - CI mapping: CONVERGE (round-1 latency risk retired)

My single open D5 risk was that the catalog's per-code cold `performCompilation` runs would blow the
6-cell `test` matrix budget (my round-1 mind-change trigger). Fact A1 directly retires it: cold-compile
~0.5s, ~18 fixtures add ~9s of compile work per cell, parallelized by Vitest workers, inside the
existing 30000ms timeout margin. The budget is comfortable; the trigger is NOT met; no `test`-target
split is warranted unless a MEASURED regression appears (which §D already conditions on). §D also adds
the `-p`-list set-equality guard - fact A5 confirms no such guard exists, so this closes a real
integrity gap in the e2e gate where a new e2e project would otherwise be silently un-run. CONVERGE.

## D6 - scope: CONVERGE

My round-1 mind-change trigger was "the generator is NOT a simple config-edit (needs project-graph
inference / cache / mode interaction)." Decision B fixes it as a 33-line pure config-edit with no
project-type branching, so the trigger is not met. §D's scope (generator unit + schema parity +
18-member catalog + completeness tripwire + one folded generator e2e + the `-p` guard; exclude
`createFsTree`, mid-tier, Verdaccio, jscodeshift, cache/ordering and mode tests) matches my round-1
exclusions. CONVERGE.

---

Cross-decision coherence holds: real-disk fidelity is bought exactly once (the folded `install-e2e`
generator scenario); everything cheaper stays in-memory and in-plugin where it is CI-free to add and
deterministic to run. Fact A1 removes the one risk I could not resolve in round 1, so I have no
fact-grounded basis for any HOLD.
