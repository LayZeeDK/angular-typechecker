# Phase 20: Vite/Analog Storybook query-import guidance - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-07-07
**Phase:** 20-vite-analog-storybook-query-import-guidance-vite-client-read
**Mode:** `--auto --analyze --chain` (autonomous single-pass; recommended/evidence-backed option auto-selected per area)
**Areas discussed:** Signal 2 data shape, Detector input+placement, Advisory gating, Executor render, Charter guard semantics, Signal 1 README restructure, Real-OSS tarball target, Merge/release gating

---

## Signal 2 -- advisory data shape (CoreResult field)

| Option | Description | Selected |
|--------|-------------|----------|
| `readonly string[]` of deduped specifiers | Mirror `notTypeCheckedDeclaredFiles`/`skippedReferences`; `[]`->`undefined` | ✓ |
| `{specifier, file}[]` | Richer per-diagnostic object | |
| count only | Just a number | |

**Auto-selected:** `readonly string[]` (recommended). **Notes:** Blueprint says "add a NEW advisory beside `notTypeCheckedDeclaredFiles`" -- parity with the three shipped advisories is the point; exact field name (`bundlerQueryImports` recommended) left to planner.

---

## Signal 2 -- detector input + placement

| Option | Description | Selected |
|--------|-------------|----------|
| Pure module over KEPT (post-filter) diagnostics, one `finalize` call | Covers walk+direct once; only advises about TS2307 the user sees | ✓ |
| Over ALL raw diagnostics (pre-filter) | Would flag correctly-suppressed node_modules `?query` (noise) | |
| Per-leaf in walk-references.ts | D-01 does this, but D-01 keys on config; this keys on diagnostics | |

**Auto-selected:** KEPT diagnostics, one finalize call site (recommended). **Notes:** Blueprint pseudo-code: "over the final diagnostic set."

---

## Signal 2 -- advisory gating

| Option | Description | Selected |
|--------|-------------|----------|
| Always-on + self-gating | Silent once consumer adds vite/client; no public option | ✓ |
| Behind a new opt-in/opt-out option | Configurable | |

**Auto-selected:** always-on + self-gating (recommended). **Notes:** Consistent with the three shipped advisories and board D4 (no new public option). An option would be over-engineering.

---

## Signal 2 -- executor render

| Option | Description | Selected |
|--------|-------------|----------|
| One `logger.warn` mirroring `warnNotTypeChecked` | Count + `vite/client` fix + "ADVISORY: NOT suppressed" | ✓ |
| Per-specifier lines | Verbose | |

**Auto-selected:** one `logger.warn` (recommended). **Notes:** Core stays pure; executor is the only logging tier. Wording = discretion.

---

## Charter guard -- verdict semantics + guard test

| Option | Description | Selected |
|--------|-------------|----------|
| TS2307 drives verdict as normal; advisory detection never suppresses/flips | Run FAILs on `?query` TS2307; advisory just annotates the fix | ✓ |
| Make advisory suppress or soften the TS2307 | Rejected -- silent false pass | |

**Auto-selected:** TS2307 fails; advisory verdict-neutral (recommended). **Notes:** Subtle point -- "verdict-neutral" means the DETECTION does not alter the verdict (`evaluateResult` never reads it); the underlying error still fails. Guard test: plain missing module (no `?`) still fails + not flagged; `?query` TS2307 kept+reported + advisory fires.

---

## Signal 1 -- README restructure

| Option | Description | Selected |
|--------|-------------|----------|
| Lead with `"types": ["vite/client"]`, name hand-shim fallback, document wildcard blind spot, cross-ref advisory | SB-09 Signal 1 verbatim | ✓ |
| Leave the current bullet (fix buried mid-sentence) | Status quo | |

**Auto-selected:** restructure to lead with the fix (recommended). **Notes:** Existing README already mentions vite/client (~line 440) but buries it; SB-09 requires it to LEAD.

---

## Real-OSS tarball verification target (user-added Gate B)

| Option | Description | Selected |
|--------|-------------|----------|
| `radix-ng/primitives` (locally-packed dist tarball) | Proven `?query` repo: 227 -> 0; exact-stack Layout B | ✓ |
| Other OSS repo | No proven `?query` case | |

**Auto-selected:** radix-ng/primitives (recommended). **Notes:** User required tarball verification in a real OSS project; spike 009 already proved radix-ng. Manual/interactive, NOT CI-baked.

---

## Merge / release gating

| Option | Description | Selected |
|--------|-------------|----------|
| Chain drives up to "PR open + green CI"; merge + release human-gated | Repo is PR-only; never auto-approve deployments | ✓ |
| Auto-merge + auto-cut release | Violates repo rules | |

**Auto-selected:** human-gated merge/release (recommended). **Notes:** Phase not "complete" until Gate A (green CI) AND Gate B (real-OSS verify) both met; surface to user, do not silently self-approve.

---

## Claude's Discretion

- Exact new CoreResult field name (`bundlerQueryImports` recommended), detector module filename, `logger.warn` wording, test-file organization. Algorithm, shape, always-on/self-gating, verdict semantics, and guard assertions are LOCKED.

## Deferred Ideas

- Public toggle/opt-out for the advisory (always-on ships).
- Per-file location in the advisory field (`{specifier, file}[]`) -- specifier-only list ships.
- CI-baked OSS verification (stays manual).
- v0.1.2 release cut/publish + PR merge (human-gated, not this phase's autonomous work).
