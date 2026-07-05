---
spike: 008
name: external-template-attribution
type: standard
gate: [G1, G5]
validates: "Given a component with an external templateUrl .html carrying a real NG8002 + NG8102, when performCompilation runs on the official stack, then record whether template diagnostics attribute to the component .ts or the .html (G1), and whether a STABLE public signal maps an .html diagnostic back to its owning rootName component .ts without ngtsc internals (G5)."
verdict: VALIDATED
related: [006, 007]
tags: [storybook, external-template, attribution, relatedInformation, gate, engine]
---

# Spike 008: external-template attribution + ownership signal (G1, G5)

## What This Validates

The two SELECTOR gates of the Phase-16 gate (both outcomes shippable; they pick the Phase-17
D2(d) keep-rule branch, they do not gate Layout B):

- **G1:** for an EXTERNAL `templateUrl` `.html`, do template diagnostics attribute to the
  component `.ts` or to the `.html`?
- **G5:** if `.html`, can an owning-component -> external-template map be built from a STABLE
  PUBLIC signal (not ngtsc internals)? PASS -> ship D2(d) 4a; FAIL -> ship 4b fallback.

Storybook-free: pure `@angular/compiler-cli@22.0.4` behavior (attribution is a compiler mechanic,
independent of Storybook -- see the pre-007 rationale). Fixture = one component whose external
`.html` carries a core (NG8002) AND an extended (NG8102) diagnostic.

## How to Run

```bash
node .planning/spikes/008-external-template-attribution/harness.mjs
# exits 0 iff all assertions pass; writes forensic-log.json
```

Runs against the workspace toolchain (no scaffold, no install). Copies the engine gatherer
(`runNoEmitCompilation` + `gatherAllDiagnostics`) VERBATIM.

## What to Expect

3 assertions PASS; `G1 = html | G5 = PASS (4a)`.

## Investigation Trail

1. **External template IS checked (008-a).** Both diagnostics fired on the external template:
   NG8002 (core, Error) and NG8102 (extended, Warning). External `templateUrl` templates are
   fully template-type-checked on the official stack.
2. **G1 = html (008-b), unambiguous.** BOTH diagnostics' `diagnostic.file.fileName` point to
   `bad.component.html` (the external template), NOT the component `.ts`. So D2(d)'s external-
   template branch IS engaged for Layout B (the `.html` is neither a rootName nor, for an
   aggregated cross-project component, under the host base dir -> keep-rule (c) would drop it ->
   branch (d) is required).
3. **G5 = PASS 4a (008-c), verified content.** BOTH `.html`-attributed diagnostics carry
   `relatedInformation` pointing back to `bad.component.ts` with the message
   **"Error/Warning occurs in the template of component BadComponent."** That is precisely the
   owning-component signal: `.html` -> owning component `.ts`. `ts.Diagnostic.relatedInformation`
   is a STABLE PUBLIC TypeScript field (no ngtsc internals), and the "occurs in the template of
   component X" linkage is Angular's standard external-template diagnostic shape. So 4a is
   feasible: map the external `.html` to its owning `.ts` via `relatedInformation`, then keep iff
   that `.ts` is a rootName (in-graph) -- exact + isolation-correct.

## Results

**VERDICT: VALIDATED -- G1 = html, G5 = PASS (4a).**

Recommended Phase-17 D2(d) branch: **4a -- owning-component->external-template map via
`relatedInformation`.** On an `.html`-attributed diagnostic, read `relatedInformation`, resolve
the owning component `.ts`, and KEEP iff that `.ts` is in the walked `inputTs` (rootNames);
otherwise suppress (dependency isolation). This is exact and isolation-correct, using only public
API.

### Findings / guidance for Phase 17

- **SB-02(d) selected = 4a** (not the 4b keep-all fallback). Isolation stays exact: an imported
  dependency's external-template error (owned by a NON-rootName component) is correctly
  suppressed; an in-graph aggregated component's external-template error is kept.
- **Fail-safe for the unmappable edge (board G8):** if an `.html` diagnostic ever has NO
  `relatedInformation` `.ts` (not observed here), KEEP it (over-report is the safe direction --
  never a false pass). Phase 17's 4a implementation must default-keep the unmappable case.
- **Tripwire (board 4a for the .ts case is moot now, but keep the inverse):** since G1 = html,
  Phase 17 should assert that external-template diagnostics DO carry a `.ts`
  `relatedInformation`, so a future Angular attribution change (e.g. flipping to `.ts`, or
  dropping relatedInformation) is caught loudly rather than silently dropping diagnostics.
- **Boundary must reference ZERO ngtsc internals** (structural `git grep` gate, SB-02):
  `relatedInformation` is public `ts.Diagnostic` API -- compliant.
