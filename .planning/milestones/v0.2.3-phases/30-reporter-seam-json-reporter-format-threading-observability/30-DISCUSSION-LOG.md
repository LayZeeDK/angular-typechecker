# Phase 30: Reporter seam + JSON reporter + `--format` threading + observability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-07-18
**Phase:** 30-reporter-seam-json-reporter-format-threading-observability
**Mode:** `--analyze --auto --chain` (autonomous single-pass; recommended defaults auto-locked; no user prompts)
**Areas discussed:** JSON code representation, JSON summary payload set, totalFilesCount scope, `$schema` publication, durationMs surfacing, color/quiet precedence

---

## JSON code representation (REP-01 / D-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Both `code` + `rawCode` | Humanized `TS####`/`NG8xxx`/`ATC9000x` string AND the raw int | ✓ |
| Humanized string only | Lossy; drops the exact TS/ng discriminator | |
| Raw code only | Negative ng codes break agent grep + GitHub grouping | |

**Auto-selected (recommended default):** Both `code` + `rawCode`.
**Notes:** Locked by REP-01. Agents get a stable grep-able code; `rawCode` preserves
the exact discriminator. IMPACT HIGH (public payload) x CONFIDENCE HIGH (ESLint/Biome
conventions + shipped `CoreResult`; hedged by `formatVersion` + drift-lock) -> not trap quadrant.

## JSON summary payload set (REP-01 / D-02/D-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Flat `diagnostics[]` + rich `summary` | Flat array + discriminated `outcome`, counts, `totalFilesCount`, structured advisory fields, `formatVersion` int + tool version, drift-locked keys | ✓ |
| ESLint-style per-file nesting | More nesting for agents to walk; no `outcome` | |
| Minimal (diagnostics + pass/fail) | Loses the never-silent `outcome`/advisory signal | |

**Auto-selected (recommended default):** Flat `diagnostics[]` + rich `summary`, `formatVersion: 1`.
**Notes:** Locked by REP-01 + roadmap success criterion 1. The discriminated `outcome`
is this tool's signature never-silent signal. IMPACT HIGH x CONFIDENCE HIGH -> not trap quadrant.

## totalFilesCount scope (OBS-01 / D-11)

| Option | Description | Selected |
|--------|-------------|----------|
| Non-declaration source files | The meaningful "files checked" count for agents | ✓ |
| Raw `@nx/js`-parity all-files | Includes `.d.ts`; less meaningful | |

**Auto-selected (recommended default):** Non-declaration source files.
**Notes:** Locked by OBS-01. OPTIONAL, additive, `evaluateResult` never reads it.
IMPACT LOW-MED (verdict-neutral, trivially adjustable) x CONFIDENCE HIGH -> not trap quadrant.

## `$schema` publication (REP-01 / D-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Defer; `formatVersion` marker only | Ship `formatVersion` int + drift-lock; no hosted URL yet | ✓ |
| Publish a hosted `$schema` URL now | Premature; shape not stabilized in the wild (REP-04) | |

**Auto-selected (recommended default):** Defer.
**Notes:** Out-of-Scope table + REP-04. IMPACT LOW (conservative) x CONFIDENCE HIGH -> not trap quadrant.

## durationMs surfacing (REP-01 / D-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Do NOT surface durationMs | Keeps snapshots byte-stable; no non-determinism | ✓ |
| Surface durationMs (redacted in snapshots) | Adds a volatile field that must be redacted everywhere | |

**Auto-selected (recommended default):** Do NOT surface.
**Notes:** REP-01 default. IMPACT LOW (additive later) x CONFIDENCE HIGH -> not trap quadrant.

## Color/quiet precedence (FMT-03, CLIX-02 / D-08/D-09/D-10)

| Option | Description | Selected |
|--------|-------------|----------|
| Overrides above NO_COLOR>FORCE_COLOR>TTY, human-path only; machine always plain; `--quiet` gates stderr only | Machine payload never colorized; verdict/payload never silenced | ✓ |
| `--color` affects machine formats too | Would inject ANSI into JSON/SARIF -- rejected | |

**Auto-selected (recommended default):** Overrides above the shipped precedence, human-path only; machine unconditionally plain; `--quiet` gates stderr advisory chatter only.
**Notes:** FMT-03 + CLIX-02; builds on shipped `colorFromEnv` + `Logger`. IMPACT MEDIUM x CONFIDENCE HIGH -> not trap quadrant.

---

## Claude's Discretion

- Internal key names/nesting of the `summary.advisories` block, the exact `presentIfNonEmpty`
  call sites, the drift-lock spec filename, and the shared normalized-record projection
  signature -- planner-owned, provided the observable payload matches D-01..D-06 and the
  additive-only charter holds.

## Deferred Ideas

- SARIF reporter + `node-sarif-builder` + require-graph guard + CJS interop test -> Phase 31.
- Integration/shipped-tarball e2e, SARIF schema validation, cross-OS determinism, additive-only
  git-diff audit, README/CHANGELOG -> Phase 32.
- `partialFingerprints` recipe + file-less SARIF representation -> Phase 31 design choices.
- Hosted `$schema` URL (REP-04), `--output` (CLIX-03), other formats (REP-03), `--watch` (CLIX-01)
  -> future milestones, out of scope.
