# Phase 16 Summary: Storybook type-check gate spike (GATED, GO/NO-GO)

**Status:** COMPLETE -- 2026-07-05
**Executed via:** `/gsd-spike` (a spike phase -- no PLAN.md; deliverable is a written spike record).
**Verdict:** **GO** -- Layout B (centralized Storybook host) is type-checkable on the official stack.
**Requirement:** SB-05 (RESOLVED).

## What this phase delivered

A reproducible, recorded spike resolving the hard GO/NO-GO gates G1-G5 on the OFFICIAL stack
(Nx 23.0.1 / Angular 22.0.4 / TS 6.0.3, `@storybook/angular@10.4.6` force-installed), so the
milestone commits to Layout B **on evidence**. Every gate passed or resolved favorably; no gate
forced the Layout-A-only fallback.

| Gate | Result | Spike |
|------|--------|-------|
| G2 (HARD prereq) -- widened cross-project include -> `parsed.rootNames` | YES | 006 |
| G3 (HARD) -- forced SB10 compiles via `performCompilation` + clean-clean | YES | 007 |
| G4 (HARD, positive) -- NG8xxx fire RED on stories/aggregated components | YES | 007 |
| G1 (selector) -- external-template attribution | `.html` | 008 |
| G5 (selector) -- stable public ownership signal | PASS -> branch **4a** | 008 |

**Decision locked:** SB-02(d) external-template branch = **4a** -- map an external `.html`
diagnostic to its owning rootName component `.ts` via public `ts.Diagnostic.relatedInformation`;
keep iff in-graph; default-keep the unmappable edge.

## Success criteria (all met)

1. Each of G1-G5 resolved with a recorded, reproducible result on the official stack -- YES
   (harness + `forensic-log.json` per spike).
2. Documented GO/NO-GO verdict for Layout B, reviewed at the 16->17 gate -- YES (GO).
3. SB-02(d) external-template branch + SB-05 map-vs-fallback selected by evidence -- YES (4a).
4. A written spike record under `.planning/spikes/` -- YES (006, 007, 008 + MANIFEST + WRAP-UP-SUMMARY).

## Records / pointers

- Spike records: `.planning/spikes/006-layout-b-rootnames/`,
  `.planning/spikes/007-forced-sb10-compile-ng8xxx/`,
  `.planning/spikes/008-external-template-attribution/`.
- Manifest + verdict: `.planning/spikes/MANIFEST.md` (Idea-2 GO/NO-GO section).
- Wrap-up summary: `.planning/spikes/WRAP-UP-SUMMARY.md`.
- **Phase-17 implementation blueprint:**
  `.claude/skills/spike-findings-angular-typechecker/references/storybook-input-set-boundary.md`.

## Notes

- Key nuance for Phase 17: build `inputTs` from `readConfiguration().rootNames` (the declared set),
  NOT `program.getRootFileNames()` (which adds `.ngtypecheck.ts` shims -- spike 006).
- D4 confirmed (spike 007): forced-SB10 `.d.ts` errors under TS6 are all `node_modules`-attributed
  and suppressed -- docs-only, no runtime version gate.
- The forced-SB10 scaffold (`node_modules`) is NOT committed -- it lives in the session scratchpad;
  reproduction is documented in `007-*/README.md`.

## Next

`/gsd-plan-phase 17` -- input-set-membership boundary + Layout A/B support (SB-02, SB-04, SB-01, SB-03).
