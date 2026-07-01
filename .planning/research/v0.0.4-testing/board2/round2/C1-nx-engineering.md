# C1 -- Nx plugin engineering / ecosystem conventions lens (Round 2)

LENS: what is idiomatic and maintainable for an Nx 23 plugin. Round-2 task: for each
decision, CONVERGE on D's reconciliation or HOLD with a sustaining fact. A HOLD requires a
specific fact the reconciliation gets wrong -- principle/preference alone does not qualify.

Verdict: **CONVERGE on all eight.** My two round-1 divergences from the eventual
reconciliation (D2-organization = per-version files; D3 = add a thin mid-tier) were both
preference-led, and the facts now on the table either trigger my own round-1 mind-change
clauses or actively cut against the preference. Nothing in FACTS / ROUND2-BRIEF, nor anything
I verified in the repo, shows the reconciliation getting a fact wrong.

---

## D1 -- CONVERGE

Reconciliation: in-memory `createTreeWithEmptyWorkspace` for generator unit tests; do not
author `createFsTree`/`flushFsTreeChanges`.

This was already my round-1 position (the 452:1 in-memory:real-disk ratio in Nx's own specs;
public `@nx/devkit/testing` vs the internal `nx/src/generators/tree` deep import with its
`eslint-disable @nx/enforce-module-boundaries` + drift-pin tax). My round-1 drop-trigger for
the maximalist's `createFsTree` was "generator emits no file AND a generator-e2e runs the
target." Decision B fixes the generator shape to a pure `project.json` edit that emits no
file any in-process step reads back; D4 adds the folded generator-e2e that runs the target.
Both halves of my trigger are met. No fact sustains a hold.

## D2-organization -- CONVERGE (this is my real round-1 change)

Reconciliation: single data-driven `it.each` table keyed on the `ExtendedTemplateDiagnosticName`
members, with introduction-version as a ROW FIELD, not a file split.

Round-1 I argued for per-introduction-version *files*. The facts cut against that as a
file-split axis:

- **A7 (taxonomy rot, observed):** the would-be `executor.angular17.*` file was renamed to
  `extended.promotion.*` because its introduction-version signal was false. I verified this
  in the live source -- `extended.promotion.integration.spec.ts` lines 21-25 state the
  `angular17` signal "was false: it carried no v17-specific code and there is no
  `fixtures/extended-v17/` tree." The per-version file taxonomy already failed once in THIS
  repo.
- **DIAGNOSTIC-CATALOG.md (verified) self-describes the version axis as "a coverage
  taxonomy, not a multi-version test matrix -- all are exercised on Angular 22."** So
  introduction-version is, by the catalog author's own statement, metadata, not a
  test-partition axis. A version-keyed file split reifies a label the catalog explicitly says
  is NOT a matrix dimension.
- **A3 (no per-code branching in core):** the gatherer runs all getters unconditionally and
  buckets by `DiagnosticCategory`; verified-consistent with `diagnostic-codes.ts` (pure
  encoding helpers, no per-code switch). There is no production code path whose
  maintainability the version split would mirror.

The existing `extended.angular13.integration.spec.ts` is a single-`it` file, not a populated
per-version harness -- so "it's already the established convention here" (my round-1 prop)
overstated a one-fixture file. No fact shows the enum-keyed table getting anything wrong; the
version simply moves from a filename to a row field. CONVERGE.

## D2-scope -- CONVERGE

Reconciliation: assert all 18 members + baseline TS/NG by exact code + `DiagnosticCategory` +
count, one promotion case, against the real compiler over committed fixtures; `it.skip` (with
written reason) any member a static fixture cannot reproduce.

Round-1 I sat in "all-but-bounded-by-cost." A1 retires the cost objection: ~0.5s per cold
compile, ~9s added per matrix cell, parallelized by Vitest workers, inside the existing
30000ms margin. The reconciliation's explicit `it.skip`-with-reason clause pre-satisfies my
round-1 D2-scope mind-change trigger ("if several extended codes are un-triggerable by a
static fixture, split into exact-code-via-fixtures + documented `it.skip` rather than forcing
AST injection"). Exact code + category + count is the repo's verified idiom
(`extended.angular13`/`config-resolution` specs assert exactly that via the `NG()` helper).
No sustaining fact for a hold.

## D2-tripwire -- CONVERGE

Reconciliation: a completeness tripwire asserting catalog rows === the
`ExtendedTemplateDiagnosticName` enum.

This is directly idiomatic here: `schema-parity.spec.ts` already asserts an enumerated key
set equals a contract (`Object.keys(schema.properties).sort()` === `EXPECTED_KEYS`), and
`package-manifest.spec.ts` asserts the published manifest. A "catalog rows === enum members"
tripwire is the same proven, fast (no-compiler), deterministic-read pattern. FACTS items in
this area (A2 -- 18 enum members with two codes 8011/8021 outside 81xx; 8110/8118 are
`ErrorCode`s but NOT enum members) are exactly the kind of drift a tripwire catches. No fact
opposes it; nobody held against it in round 1. CONVERGE.

## D3 -- CONVERGE (my second round-1 change)

Reconciliation: no separate executor-against-workspace tier; if a `context.root`-relative
`tsConfig` case is missing from `normalize-options.spec.ts`, add it there (unit).

Round-1 I floated one thin mid-tier spec, with the explicit mind-change trigger: drop it if
an existing spec already exercises `context`-driven `tsConfig` resolution. That trigger is
MET, verified in the repo:

- `normalize-options.spec.ts` already covers BOTH branches: relative ->
  `joinPathFragments(context.root, tsConfig)` (lines 16-28, asserts `/ws/libs/x/...` and POSIX
  separators) and absolute pass-through (lines 30-37). A4 confirms these are the only two
  branches and that no executor-only resolution branch is unreached.
- `config-resolution.integration.spec.ts` separately drives the REAL compiler over committed
  fixtures (spec-tsconfig, malformed, solution-style, missing-path), covering the
  resolution-to-compilation seam end to end.

So the seam I wanted the mid-tier to cover is already covered by a unit spec plus an
integration spec. The mid-tier's value shrinks to zero. CONVERGE.

## D4 -- CONVERGE

Reconciliation: one generator scenario inside `install-e2e` (ship `generators.json` + the
generator, add an un-wired project, `nx g`, assert `project.json`, then run the target with
`--skip-nx-cache`); no new e2e project, no Verdaccio.

This was unanimous (8/8) in round 1 and is my position. A6 resolves my round-1 missing fact
(can `install-e2e` host it): the `consumer-app` fixture already pre-wires the target, so the
scenario needs (a) shipped `generators.json` + generator and (b) an un-wired project to
target -- exactly what the reconciliation specifies. Keeping the single npm-pack tarball
mechanism (no second Verdaccio mechanism that is known-fragile on Windows arm64) is the
maintainable choice. No fact sustains a hold.

## D5 -- CONVERGE

Reconciliation: no `ci.yml` change for in-plugin specs; generator e2e rides `install-e2e`;
add the set-equality `-p`-list guard; single `ci` gate; no `test`-target split.

In-plugin specs auto-route into the 6-cell `test` matrix (FACTS 5; confirmed by the
`vitest.config.mts` include and the existing `*.integration.spec.ts` placement). A1 shows the
budget is comfortable, so my round-1 conditional Linux-only split does not trigger -- "absent
timing evidence, keep it uniform" was my own clause, and the evidence says comfortable. The
`-p`-list guard is justified by A5 (no such guard exists today) and matches the FACTS 5
gate-meaning property that a new e2e project is invisible until named in the list -- a
set-equality test is cheap insurance against that exact silent gap. No fact opposes; CONVERGE.

## D6 -- CONVERGE

Reconciliation: generator in scope at decision-B's shape; testing scope = generator unit +
schema parity + the 18-member catalog + completeness tripwire + one folded generator e2e +
the `-p` guard; exclude `createFsTree`, mid-tier, Verdaccio, jscodeshift, cache/ordering, mode
tests.

My round-1 scope matched this except for the per-project-type-branching unknown, whose
mind-change trigger was "if the generator is specified with full per-project-type branching
across all five types, split the milestone." Decision B fixes the shape to NO per-project-type
branching beyond a default `tsConfig` value (the 33-line sandbox shape). That is the explicit
NOT-met condition for my trigger. Scope is the lean single-shape generator + catalog
closure. No sustaining fact for a hold; CONVERGE.

---

```
ROUND2
D1: CONVERGE
D2-organization: CONVERGE
D2-scope: CONVERGE
D2-tripwire: CONVERGE
D3: CONVERGE
D4: CONVERGE
D5: CONVERGE
D6: CONVERGE
NEW-FACTS-NEEDED: none
```
