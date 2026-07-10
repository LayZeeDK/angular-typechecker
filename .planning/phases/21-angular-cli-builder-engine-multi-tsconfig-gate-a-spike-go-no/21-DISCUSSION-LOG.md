# Phase 21: Angular CLI builder + engine multi-tsConfig + GATE A' spike (GO/NO-GO) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-07-10
**Phase:** 21-angular-cli-builder-engine-multi-tsconfig-gate-a-spike-go-no
**Mode:** `--analyze --auto --chain` (autonomous single pass; recommended options auto-locked; no interactive prompts)
**Areas discussed:** GATE A' proof methodology, GO/NO-GO checklist + gate ordering, builder schema.json, tsConfig array aggregation

---

## GATE A' proof methodology

| Option | Description | Selected |
|--------|-------------|----------|
| Isolated throwaway `ng` scaffolds (Ng22 + Ng21), real `ng run` | Real toolchain; spike-007 forced-dep precedent; dev repo `node_modules` untouched | ✓ |
| Pure `.mjs` harness (spikes 001-010 style) | Fastest, hermetic | Cannot exercise a real `ng run` / the eager project-graph prelude -- the exact thing GATE A' must prove |
| Committed Verdaccio tarball e2e | Closest to prod | That is Phase 24's job; over-heavy for a gate |

**Auto-selected:** isolated throwaway scaffolds (recommended default).
**Notes:** GATE A' is a RUNTIME `ng run` proof; an `.mjs` harness cannot trigger the wrapper's
eager `retrieveProjectConfigurationsWithAngularProjects` prelude (Pitfall 1 / nrwl/nx#19475).
Recorded under `.planning/spikes/NNN-*` per CONVENTIONS.md; record committed, scaffold
`node_modules` never committed. HIGH confidence (established precedent).

---

## GATE A' GO/NO-GO checklist + gate ordering

| Option | Description | Selected |
|--------|-------------|----------|
| Spike-first gates ship; NO-GO stops Phase 21 (documented), never hand-written architect builder | Standard GATED-phase pattern (cf. Phase 16 gating Layout B) | ✓ |
| Build the builder and spike concurrently | Faster if GO | Invests before the gate resolves; contradicts the GATE charter |

**Auto-selected:** spike-first gates ship (recommended; locked by roadmap GATE + charter).
**Notes:** GO requires all of: on-stack Ng22 no `ERR_REQUIRE_ESM` (incl. prelude); off-stack Ng21
same (subject to U-01); builder output IDENTICAL to the Nx executor (parity is part of the gate);
static byte-assertion extended to the builder entry; `nx run` still resolves (`executors ?? builders`).

---

## Builder schema.json

| Option | Description | Selected |
|--------|-------------|----------|
| Sanitized copy + schema-parity test | Safe vs Architect's stricter validation; `schema-parity.spec.ts` pattern exists | ✓ |
| Reuse executor `schema.json` verbatim | Zero new files | Pitfall 7 (MEDIUM): Architect may reject `cli:"nx"`/`x-*`/positional `$default` |

**Auto-selected:** sanitized copy + parity test (research default).
**Notes:** LOW impact + spike-confirmed. If the spike proves Architect accepts the executor schema
verbatim, collapse to reuse.

---

## tsConfig array aggregation (ENG-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Union raw per-entry diagnostics -> ONE finalize over the union | Reuses the shipped spike-001 walk aggregation + v0.2.0 input-set boundary; dedupe-correct | ✓ |
| Per-entry finalize then union | Simpler to reason per-entry | Double-counts / mis-dedupes across entries; diverges from the shipped walk |

**Auto-selected:** union-then-single-finalize (matches the shipped reference-walk engine).
**Notes:** Additive-only -- widen `CoreOptions.tsConfig` + executor `schema.json` (`oneOf`) +
`normalize-options`; single-string + Nx path byte-unchanged.

## Claude's Discretion

- Plan decomposition (plan count; `/gsd:spike` vs inline gating plan; the exact spike number NNN).
- Hermetic fixture contents (which planted app/spec errors prove builder-vs-executor parity).
- Whether optional-peer classification (ACP-01) is pulled into this phase or left to Phase 23.

## Deferred Ideas

None new -- discussion stayed within phase scope.

## UNRESOLVED (trap quadrant -- escalated, not decided)

- **U-01 split-result contingency (Ng22 GO / Ng21 NO-GO).** Requirement ACB-02 ("on-stack AND
  off-stack") vs the charter ("Ng21 is only an off-stack cross-check") disagree. Recorded in
  CONTEXT.md `<unresolved>` with both options (A: on-stack is the true gate + document Ng21 as an
  off-stack limitation; B: literal split = NO-GO). Decide ONLY if the spike produces a split;
  surface to the user then -- do not auto-lock.
