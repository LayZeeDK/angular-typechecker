# Phase 10: Drift-hardening & Maintainability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-06-29
**Phase:** 10-drift-hardening-maintainability
**Mode:** `--analyze --auto --chain`
**Areas discussed:** Drift-assertion mechanism (escalated), typecheck-drift CI target (auto), EmitFlags correction (auto), Vendor markers (auto), TS-99 regression spec (auto)

---

## Drift-assertion mechanism (HARD-01) -- ESCALATED from `--auto`

Escalated out of `--auto` auto-selection: HIGH-impact (freezes the central tripwire's
contract) + initially LOW-confidence on intent (HARD-01 text is internally contradictory:
"a new OR removed getter breaks CI" vs "real->shim direction only -- deliberate subset").
Resolved via web + GitHub prior-art research (the latter empirically verified @ tsc 6.0.3),
an npm dev-dependency survey, and a 5-member Opus advisory board, then user-confirmed.

### Sub-decision 1 -- Scope / additions blind-spot

| Option | Description | Selected |
|--------|-------------|----------|
| Runtime getter-set spec | ProbeOnly type-gate + a ~15-line Vitest spec asserting the REAL imported api.Program getter set + pinning the encoding (NG/UNKNOWN_ERROR_CODE/ngErrorCode). Closes additions blind-spot + runtime-semantic drift. No new dep. | X |
| ProbeOnly type-gate alone | Just the assignability probe; accept the low-probability silent additions risk; rely on human upgrade review. | |
| api-extractor report diff | Committed .api.md snapshot, CI-gated, human-reviewed each bump. Board majority (3/5) called it disproportionate / scope-creep for v0.0.1. | |

**User's choice:** Runtime getter-set spec (the board synthesis recommendation).
**Notes:** All 5 board members rejected AlsoAdditions/exhaustiveness for the type-gate
(width subtyping can't catch additions; noisy on every Angular minor; index-signature
gotcha; zero prior art for exhaustiveness against a vendored foreign subset). The runtime
spec is the cheapest control for the real additions risk (members 2 + 4) AND closes a gap
no type check can (runtime-semantic / ngErrorCode-arithmetic drift).

### Sub-decision 2 -- Tooling

| Option | Description | Selected |
|--------|-------------|----------|
| PlainTS AssertAssignable | One-line `type AssertAssignable<From, To extends From> = true` + tuple of pairs + call-site probes. Zero new dep, clean under @nx/dependency-checks. | X |
| expect-type devDep | Add expect-type (already transitive via Vitest 4.1.9 -> 1.4.0); expectTypeOf().toExtend(); nicer failure messages. Board's closest call (2/5). | |

**User's choice:** PlainTS AssertAssignable.
**Notes:** At ~7 one-shot assertions a library earns nothing; declaring expect-type adds a
policed devDep + a runtime import in the drift file. `tsd` rejected outright (bundles its own
TS 5.9, breaks fidelity vs our TS 6.0.3).

### Construction (board near-unanimous; presented as locked, not separately re-asked)

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-written shim + per-member probe | Keep compiler-cli-types.ts as source of truth; assert per-member (tuple of pairs) + call-site probes. | X |
| Pick-derived shim | Re-derive shim via Pick<api.Program,...>. | |

**Rationale:** Pick auto-tracks upstream (a removed getter silently resolves to fewer keys
instead of breaking -- a follower, not a tripwire) AND is mechanically unavailable (Pick needs
the real type, which only resolves under classic-node, not the production nodenext build).

---

## typecheck-drift CI target (HARD-01 wiring) -- auto-locked

| Option | Description | Selected |
|--------|-------------|----------|
| nx:run-commands `tsc --noEmit -p tsconfig.drift.json` | Pure type-check, no emit; classic-node resolution; consistent CI wiring. | X |
| @nx/js:tsc target | Build-oriented; would emit. | |

**Notes:** Drift file co-located at `src/core/compiler-cli-types.drift.ts`; `tsconfig.drift.json`
extends `tsconfig.base.json` (classic node), `noEmit`, includes only the drift file; excluded
from `tsconfig.lib.json` so it never ships. OS-independent -- single CI invocation.

## EmitFlags correction (HARD-02) -- auto-locked

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror real members, drop fake None | DTS=1..All=31 per real enum; keep `emitFlags: 0` as documented literal. | X |
| Empty enum / keep None documented | Less faithful. | |

**Notes:** Verified the real `@angular/compiler-cli@22.0.4` EmitFlags has NO `None` member.

## Vendor markers (HARD-03) -- auto-locked

| Option | Description | Selected |
|--------|-------------|----------|
| Marker per distinct divergence | `// angular-typechecker: vendored -- <reason>` on each narrowed/fabricated construct; one git grep finds all. | X |
| Single file-level marker | Less greppable per-divergence. | |

## TS-99 regression spec (HARD-05) -- auto-locked

| Option | Description | Selected |
|--------|-------------|----------|
| Integration-tier, real formatDiagnostics | Real NG8xxx fixture through `formatReport(..., {color:false})`; assert NG#### present, no `TS-99`. | X |
| Unit-tier with fake | Would not exercise Angular's real `replaceTsWithNgInErrors` rewrite. | |

---

## Claude's Discretion
- Exact tuple/helper structure in the drift file; call-site probe placement; frozen getter-set
  representation in the runtime spec.
- HARD-05 NG8xxx fixture mechanics; HARD-02 EmitFlags assertion mechanics.
- Whether `typecheck-drift` is a standalone CI step or folded into the existing `nx run-many`.
- Exact marker-comment wording (must contain the literal `angular-typechecker: vendored` token).

## Deferred Ideas
- AlsoAdditions/exhaustiveness in the type-gate (rejected -- unanimous board).
- api-extractor `.api.md` report-diff additions-review (backlog; disproportionate for v0.0.1).
- `expect-type` as a type-testing dep (revisit if assertions grow past dozens).
- `Pick`-derived shim (rejected -- auto-tracks, defeats the alarm; unavailable under nodenext).
- `NgtscProgram` migration / incremental / `--watch` (out of milestone).
