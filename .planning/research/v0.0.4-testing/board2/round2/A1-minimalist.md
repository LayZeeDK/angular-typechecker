# A1 -- Minimalist / YAGNI position (Board 2, Round 2)

**Mandate:** adversarial minimalism / YAGNI. A HOLD is valid ONLY if it cites a specific
fact the reconciliation (§D) gets wrong. "Do not hold on principle alone."

Verdict up front: **converge on all eight.** The round-1 spread already put the
minimalist at the consensus on D1, D3, D4, D5, D6; the only open contest was D2-scope, and
the round-2 facts dissolve it. Below, the decisive fact per decision and -- where I held in
round 1 -- why the hold no longer survives.

---

## D1 -- CONVERGE

In-memory `createTreeWithEmptyWorkspace`; do not author `createFsTree`/`flushFsTreeChanges`.
This was my round-1 position verbatim. Decision B fixes the generator shape as
project.json-only, emits-no-file-read-back, no per-project-type branching (the 33-line
sandbox shape). That is exactly the trigger I named in round 1 ("a generator behavior an
in-memory Tree cannot model") being NOT met. The in-memory Tree captures 100% of a pure
config edit; the deep `nx/src/generators/tree` import (quarantine file + lint exception +
drift spec) buys real-disk fidelity the generator does not need, and the real-disk fidelity
that IS wanted ("the target actually runs") already lives at the tarball e2e tier. No fact
to cite against §D -- it is my own position.

## D2-organization -- CONVERGE

Single data-driven `it.each` table keyed on the enum members, introduction-version as a row
FIELD not a file split. This was my round-1 position. Fact **A7** (the would-be
`executor.angular17.*` file was renamed to `extended.promotion` because its
introduction-version signal was false; only `angular13` is populated) is direct evidence the
per-version file taxonomy rots. A flat table makes a future Angular major a drop-in row. No
fact sustains a hold.

## D2-scope -- CONVERGE (round-1 hold dropped)

Round-1 hold: ~2-3 representative codes only. Its stated mind-change trigger was "evidence
the tool BRANCHES on specific NG codes (per-code suppression/remap/category override) beyond
NG3004." That trigger has now fired -- in the direction of convergence, not away from it:

- **Fact A3** verifies the tool does NOT branch per-code: zero diagnostic-code literals in
  non-test `src/` except `UNKNOWN_ERROR_CODE=500`, the `NG()`/`ngCodeOf` pure helper, and
  `NG3004` (TCB-fatal). Uniform `DiagnosticCategory` bucketing; no per-NG8xxx
  suppression/remap/override. So each of the 18 is the SAME code path here.

My round-1 hold rested on two legs. Both fail under round-2 facts:

1. **Cost leg (refuted by A1).** I argued "14-18 codes x 6 cells x cold compile is a real CI
   tax." A1 measures it: ~0.5s/fixture, ~9s/cell, parallelized by Vitest workers, inside the
   existing 30000ms timeout margin; D5 reconciliation calls the budget comfortable. The cost
   objection is quantified and small. Leg gone.
2. **"Testing Angular not the plugin" leg (a principle, not a fact).** The mandate forbids
   holding on principle alone. And A3 actually cuts the other way for *structure*: because
   there is no per-code branch, the 18 members collapse into one uniform table with
   per-member fixtures-as-rows -- the marginal cost of rows 4..18 over rows 1..3 is just the
   fixture files + ~0.5s each, no new file, no new taxonomy (the single-table point, (d)).

Decisive structural fact I cannot get around: the **completeness tripwire** (catalog rows
=== `ExtendedTemplateDiagnosticName` enum, in `test`) is UNOPPOSED in the spread and I do not
oppose it. A tripwire asserting "catalog === 18-member enum" is self-contradictory against a
3-row representative catalog -- it would fail on day one. Accepting the tripwire therefore
*entails* enumerating all 18; I cannot accept the tripwire (cheap, catches a NEW 19th member
the day Angular adds one) and simultaneously hold representative-only. And A2 confirms the
18 ARE the exact configurable public contract surface (the two 80xx outliers in-range-or-not
characterized; the two non-member ErrorCodes excluded). There is no fact the reconciliation
gets WRONG; "representative-only" is now a bare-principle preference the mandate disallows.
Converge: all 18 + baselines, exact code + `DiagnosticCategory` + count + one promotion case,
single table, `it.skip`-with-reason for any member not statically reproducible, batch per
program.

## D2-tripwire -- CONVERGE

Catalog-rows === enum tripwire in the `test` tier. Cheap (a pure set-equality assertion, no
compile), runs in every matrix cell with no `ci.yml` change, and is the ONE guard that
catches Angular adding a 19th extended check (FACTS sec.4 already flags catalog/enum drift:
the catalog lists 16 "documented" + mislabels members and omits
`controlFlowPreventingContentProjection`; A2 fixes the count at 18). Nothing to hold.

## D3 -- CONVERGE

No separate executor-against-workspace tier; if a `context.root`-relative `tsConfig` case is
missing, add it to `normalize-options.spec.ts` (unit). This was my round-1 cut. **Fact A4**
verifies the resolution is a pure two-branch function already covered by
`normalize-options.spec.ts`, with no executor-only resolution branch unreached by that unit
spec + the e2e tier. My round-1 mind-change trigger ("a concrete executor resolution path
covered at neither unit nor e2e tier") is verified ABSENT. Converge.

## D4 -- CONVERGE

One generator scenario folded into `install-e2e`; no new e2e project, no Verdaccio. This was
my round-1 position (8-of-8 consensus). **Fact A6** confirms the hosting requirement
precisely: `install-e2e`'s `consumer-app` already has the target pre-wired, so the scenario
needs (a) the shipped `generators.json` + generator and (b) an UN-wired project to generate
onto -- which is exactly what §D specifies (add an un-wired project, `nx g`, assert
`project.json`, then `nx run ...:angular-typecheck --skip-nx-cache`). No new workspace
bootstrap, so my round-1 trigger ("harness cannot host without a 4-8 min fresh bootstrap") is
not met. Converge.

## D5 -- CONVERGE

No `ci.yml` change for in-plugin specs (auto-route into the 6-cell `test` matrix); generator
e2e rides `install-e2e`; add the set-equality `-p`-list guard; single `ci` gate; no
`test`-target split. I argued zero CI edits in round 1; the one addition I now accept is the
`-p`-list guard, and **fact A5** justifies it: no test/tool currently asserts the `e2e` job's
`-p` list equals the e2e-project set, so a new e2e project added to the graph but not to the
`-p` list would run NOWHERE silently (FACTS sec.5: "a new e2e project runs only if added to
this list by name"). That guard is a pure list-equality unit assertion in the `test` tier --
near-zero cost, closes a real silent-skip gap. And A1 confirms no `test`-split is needed (the
budget is comfortable). Converge.

## D6 -- CONVERGE

Generator in scope at decision-B shape; testing scope = generator unit + schema parity + the
18-member catalog + completeness tripwire + one folded generator e2e + the `-p` guard;
exclude `createFsTree`, the mid-tier, Verdaccio, the jscodeshift toolkit, and cache/ordering
+ quiet-mode tests. The only delta from my round-1 D6 is the catalog moving from
"representative" to "all 18" -- which D2-scope above justifies. Every exclusion I pushed for
in round 1 survives in §D. The scope is the smallest that (i) tests the one net-new code path
(the generator), (ii) makes the diagnostic catalog self-policing via the tripwire, and (iii)
adds the one silent-skip guard A5 exposes. No gold-plating remains to cut. Converge.

---

```
ROUND2
D1: CONVERGE
D2-organization: CONVERGE
D2-scope: CONVERGE -- A1 (~0.5s/fixture, ~9s/cell, comfortable budget) refutes the cost leg; A3 (no per-code branching) collapses the 18 into one uniform table so marginal cost of full enumeration is ~0.5s/row; the unopposed completeness tripwire (catalog===18-member enum) is self-contradictory against a representative-only catalog, so representative-only cannot coexist with the tripwire I accept; "testing Angular" is a bare principle the mandate forbids holding on alone; no fact in the reconciliation is wrong.
D2-tripwire: CONVERGE
D3: CONVERGE -- A4 verifies the context.root->tsConfig resolution is a pure two-branch function already unit-covered with no unreached executor-only branch.
D4: CONVERGE -- A6 confirms the install-e2e fixture can host the scenario by adding an un-wired project; no fresh-workspace bootstrap needed.
D5: CONVERGE -- A5 (no -p-list guard exists; a new e2e project would silently run nowhere) justifies the one accepted addition; A1 confirms no test-target split.
D6: CONVERGE
NEW-FACTS-NEEDED: none
```
