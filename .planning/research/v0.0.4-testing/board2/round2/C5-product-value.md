# C5 - Product value / consumer (Round 2)

**Lens:** Does the test protect what AI agents + CI consume -- a fast, complete, trustworthy
type-check pass/fail and diagnostic signal, decoupled from build/test? My round-1 posture: spend
the budget on the NG8xxx exact-code catalog (G1) and the generate-then-run generator e2e (G4+G3);
keep substrate cheap and public; coarse boolean assertions are the one thing I will not accept for
the catalog.

Verdict: **CONVERGE on all eight.** Every round-1 position that differed from the reconciliation
had its differentiator answered by a fact verified after round 1, and each of my own stated
mind-change triggers was either met (D2-org, D3) or provably NOT met (D1, D6). No surviving fact
sustains a HOLD; the only places I diverged in round 1 were preference (D2-organization) or a
worry (D5 cost), and the facts resolve both.

## D1 -- CONVERGE
Round 1 I already favored in-memory `createTreeWithEmptyWorkspace` and did NOT want to author
`createFsTree`. My only mind-change trigger was "generator emits a file a real ngc/executor run
must read mid-flow." Decision B fixes the generator as `project.json`-only, emits no file
(matches the 33-line sandbox generator, FACTS.md S7a). Trigger NOT met -> the in-memory tree
captures 100% of the observable behavior; the real-disk proof a consumer cares about (the target
actually runs) is already bought by the tarball e2e. Converge.

## D2-organization -- CONVERGE (my round-1 preference was not fact-backed; a fact now opposes it)
Round 1 I preferred per-introduction-version files. That was a preference, not a fact -- and
fact A7 (verified) is a fact AGAINST it: the per-introduction-version taxonomy already ROTTED in
this very repo (the `angular17` file was renamed to an `extended.promotion` file because its
introduction-version signal was false; only `angular13` is populated today). Fact A3 (verified)
adds that the core has zero per-code / per-version branching -- it runs all getters unconditionally
and buckets by `DiagnosticCategory` -- so "introduction version" carries no behavioral meaning a
file split would protect. The single data-driven `it.each` table keyed on the enum members, with
introduction-version demoted to a row FIELD, preserves the provenance metadata I valued without
the rotting file split. The rule of "cite a fact or converge" applies squarely: A7 sustains the
reconciliation, nothing sustains the per-version files. Converge.

## D2-scope -- CONVERGE
The reconciliation asserts all 18 `ExtendedTemplateDiagnosticName` members + baseline TS/NG codes
by exact code + `DiagnosticCategory` + count, plus one severity-promotion case, against the real
compiler over committed fixtures, with `it.skip` + written reason for any member not reproducible
by a static fixture. This is exactly my G1 headline position (exact code + category, never coarse
boolean; documented skips, never silent). Fact A2 supplies the authoritative name->code map
(including the two out-of-81xx codes 8011/8021 and the exclusion of the two non-enum ErrorCodes
8110/8118), which removes my round-1 FACTS-NEEDED blocker. Converge.

## D2-tripwire -- CONVERGE
Catalog-rows === `ExtendedTemplateDiagnosticName`-enum completeness check, run in `test`. I
proposed exactly this provenance guard in round 1 (the catalog's 16-vs-18 discrepancy in
FACTS.md S4 -- `controlFlowPreventingContentProjection` unlisted, `unusedLetDeclaration` flagged
undocumented). A static tripwire that fails when the enum grows is the cheapest defense against a
future-Angular NG8xxx silently going uncovered -- a false green is my worst failure mode. Converge.

## D3 -- CONVERGE (my own mind-change trigger is now met by a verified fact)
Round 1 I supported a thin mid-tier ONLY if it covered a `context.root`->`tsConfig` resolution
branch nothing else proved, and my explicit drop-trigger was "path resolution is a trivial
no-branch one-liner already proven by `normalize-options.spec.ts`." Fact A4 (verified) shows
precisely that: resolution is a pure two-branch function
(`isAbsolute(tsConfig) ? tsConfig : joinPathFragments(context.root, tsConfig)`) WITH
`normalize-options.spec.ts` present, and no executor-only branch unreached by that unit spec + the
e2e tier. My trigger is met -> drop the separate tier; if a `context.root`-relative case is
missing, add it to the unit spec. Converge.

## D4 -- CONVERGE
One generator scenario folded into `install-e2e`: ship `generators.json` + the generator, add an
un-wired project, `nx g`, assert `project.json`, then `nx run <proj>:angular-typecheck` with
`--skip-nx-cache`. This IS my round-1 fold-in fallback, and it preserves the load-bearing
generate-then-run round trip (G4+G3) that I refused to drop. Fact A6 (verified) confirms the
mechanics: `install-e2e`'s `consumer-app` is pre-wired, so hosting the generator e2e requires
(a) shipping `generators.json` and (b) an un-wired project -- exactly what the reconciliation
specifies. No Verdaccio (its scaffolded path has a known Windows failure), no second e2e project.
I'd still carry a stdout/diagnostic-text assertion on the run step so we prove the signal reaches
the consumer, not just the exit code -- but that is additive to, not in conflict with, §D. Converge.

## D5 -- CONVERGE (my round-1 cost worry is resolved by a measured fact)
In-plugin specs auto-route into the 6-cell `test` matrix (no `ci.yml` change); generator e2e rides
`install-e2e`; single `ci` gate; add the set-equality `-p`-list guard (fact A5: none exists today);
no `test`-target split. My round-1 FACTS-NEEDED was the per-cell wall-clock cost of ~16 cold
fixtures x 6 cells. Fact A1 (measured) answers it: one cold `performCompilation` ~0.5s (gate-b =
529ms), ~18 fixtures add ~9s of compile work per cell, parallelized by Vitest workers, against an
existing 30000ms timeout margin -- comfortable. So my "consolidate fixtures / run full-catalog on
Linux only" fallback is unnecessary; cross-OS coverage of the catalog (load-bearing against
OS-specific false greens) stays intact, which is the outcome I wanted. The reconciliation already
keeps the split as a contingency on a measured regression. Converge.

## D6 -- CONVERGE (my round-1 expand-trigger is provably NOT met)
Generator in scope at shape B; testing scope = generator unit + schema parity + 18-member catalog
+ completeness tripwire + one folded generator e2e + the `-p` guard; exclude `createFsTree`,
mid-tier, Verdaccio, jscodeshift, cache/ordering and quiet-mode tests. My round-1 expand-trigger
was "milestone intends the BROAD per-project-type generator" (which would expand generator tests
and force me to narrow the catalog to ship). Decision B explicitly fixes "no per-project-type
branching beyond a default `tsConfig`," so that trigger is NOT met -> the catalog stays full and
the generator stays a 33-line single-shape deliverable. This is the shippable 0.0.3 -> 0.0.4 `feat`
(patch bump, FACTS.md S8). Converge.
