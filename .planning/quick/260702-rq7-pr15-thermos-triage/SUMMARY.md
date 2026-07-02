---
slug: pr15-thermos-triage
status: complete
date: 2026-07-02
validate: false
---

# SUMMARY: PR #15 Thermos-review triage

Triaged the fourth review round (`/thermos:thermos`) against the Phase/Milestone/
Project decisions, the prior triage (`20260702-pr15-review-triage`), and the
ponytail-full lens. **Outcome: zero code changes.** Every finding is
already-satisfied, deliberately-decided, or correctly-deferred. Re-churning a
green, thrice-reviewed, merge-ready PR is the wrong move -- the laziest correct
action is to record the triage and stop.

## Per-directive triage

### #1 Executor-rename break -- skip migrations.json (DECISION, no code)

- Decision honored: **no `migrations.json`**. Install base is days-old (0.0.1-0.0.3
  published within the last week) and 0.x minors allow documented breaks.
- Already in place (verified): the rename commit `956e657` is
  `feat(executor)!:` with a full `BREAKING CHANGE:` footer that spells out the
  exact consumer migration (`:angular-typecheck` -> `:typecheck` in project.json
  + nx.json targetDefaults). So `nx release` computes the 0.1.0 minor correctly
  AND the break is documented. The curated CHANGELOG 0.1.0 entry draws from that
  footer at release time (per AGENTS.md) -- not a PR-scope action.
- Net: directive fully satisfied; nothing to do.

### #2 Comment legibility -- keep GSD IDs + plain language (DECISION, no code)

- The reviewer's HIGH recommended STRIPPING the `D-xx`/`RES-xx` IDs. Directive #2
  overrides that: keep the IDs, ensure they are combined with plain language.
- Verified: a scan of all 20 shipped core `.ts` files (non-spec, non-drift)
  found **zero ID-only comment lines** -- every GSD-ID comment already pairs the
  ID with a plain-language statement of the invariant (e.g. `run-typecheck.ts`
  `D-01: ...counted EXPLICITLY... NEVER length - errorCount`). The desired state
  already holds.
- CAVEAT (flagged, not acted on): #2 does NOT reduce the comment VOLUME the
  reviewer measured (`run-typecheck.ts` ~325 comment : ~261 code). Keeping IDs +
  prose is the user's chosen trade-off. If volume-trimming is ever wanted, that
  is a separate decision, distinct from this directive.

### #3 Extract `run-typecheck.ts:260-352` walk branch (AUDIT -> DECLINE)

- The three-way `D-03a` split is a **deliberate, spec'd design** (Phase 13,
  `13-04-PLAN.md`/`13-04-SUMMARY.md`; L-3 / Spike 004). Phase-13 Open Question 2
  explicitly resolved to "attach `skippedReferences` AFTER `finalize` returns in
  the walk branch, do NOT add a finalize param" -- i.e. the inline two-return
  shape is intentional.
- The prior round-2 simplification already extracted the sensible helpers
  (`throwIfInfrastructureFailure`, `runNoEmitCompilation`, `buildFinalizeFilter`,
  `hasProjectReferences`) and **consciously declined the "finalize-fork collapse"**
  to preserve the never-filter-config-errors-on-all-skipped invariant.
- Ponytail: the proposed `runSolutionWalk(ng, ts, parsed, options,
  configDiagnostics, start)` is a 6-argument helper (a long-parameter-list smell)
  for zero behavior gain, on an already-refactored, deliberately-shaped block. No
  rung of the ladder is cleared. **DECLINE** -- churn.

### #4 Remaining findings (AUDIT -> DECLINE / DEFER)

- **target-defaults dup (2 specs): reviewer erred -- KEEP both.** They guard
  DISTINCT failure modes, not the same one:
  - `init/target-defaults-drift.spec.ts` (C11) pins MUTUAL EQUALITY (generator
    const == both nx.json copies).
  - `core/nx-target-defaults.spec.ts` (WALK-02/L-5) pins the CORRECT VALUES
    (`default` not `production`, `outputs: []`) -- the stale-PASS guard.
  - A wrong-but-consistent edit (e.g. `default` -> `production` in all three)
    PASSES the drift spec and is caught ONLY by the intent spec. Deleting either
    weakens a real, distinct guarantee. Not redundant. **DECLINE dedup.**
- **schema-parity 3x harness: DEFER.** Test-only boilerplate; parity specs are
  deliberately explicit/self-contained; the three differ in key lists +
  `required` assertion. A shared helper is low-value churn on a green PR (round-2
  already declined similar test consolidation).
- **directory-style project references reported not-found (LOW): DEFER.** YAGNI:
  Nx never generates directory refs (all fixtures use file refs), and the case
  fails LOUD (a counted, path-named 90002), never a silent PASS. The single-level
  walk limitation is already documented in `walk-references.ts`. Fast-follow with
  a fixture + `resolveProjectReferencePath` directory fallback only if a real
  consumer hits it.

## Validation

None run: the triage lands no code, so there is nothing to re-verify. The PR
remains green as of the last CI run (test 251/251 + build + drift + lint +
prettier + fallow exit 0).
