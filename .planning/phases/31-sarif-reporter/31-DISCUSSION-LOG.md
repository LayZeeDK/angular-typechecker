# Phase 31: SARIF reporter - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-18
**Phase:** 31-sarif-reporter
**Mode:** `--analyze --auto --chain` (autonomous single-pass; recommended option auto-selected per gray area)
**Areas discussed:** partialFingerprints recipe, @types/sarif strategy, rules[] catalog scope, Phase-31 validation strategy

Big decisions (file-less no-location, `node-sarif-builder@^4.1.0` as a dependency,
lazy `await import()`, humanized `ruleId`, repo-relative forward-slash URIs, 1-based
regions, deterministic ordering, additive-only charter) were LOCKED upstream by
REQUIREMENTS.md REP-02/VER-04 + the ROADMAP goal + the HIGH-confidence research; they
are recorded in CONTEXT.md as carried decisions, not re-discussed here.

---

## partialFingerprints recipe (REP-02, open design choice)

| Option | Description | Selected |
|--------|-------------|----------|
| sha256 tuple, versioned `/v1` | `sha256(ruleId + repo-relative-URI + flattened-message + 1-based startLine)`, stored under key `atcFingerprint/v1`; stdlib `crypto`, no cwd/abs-path in the hash | ✓ |
| Rely on GitHub auto-populate | Emit no `partialFingerprints`; let GitHub best-effort match | |
| Hash including absolute path / duration | Richer entropy but non-deterministic across OS/Node | |

**Auto-selected:** sha256 tuple under `atcFingerprint/v1` (recommended default). — D-02
**Notes:** IMPACT MED (versioned, re-tunable — GitHub matches on any fingerprint version; no installed alert base yet) x CONFIDENCE HIGH (standard SARIF practice, research-backed, deterministic-by-construction). Not trap-quadrant. Removes reliance on GitHub auto-populate; mandatory for the `/sarifs` API path.

---

## @types/sarif strategy (REP-02)

| Option | Description | Selected |
|--------|-------------|----------|
| `import type` from `node-sarif-builder` | Type via the erased type-only import; no extra dep | ✓ |
| Add `@types/sarif` devDependency | Import types directly from `'sarif'` | |

**Auto-selected:** `import type` from `node-sarif-builder` (recommended default). — D-04
**Notes:** IMPACT LOW (dev-only, internal) x CONFIDENCE HIGH (STACK reconciliation explicit: `@types/sarif`/`fs-extra` are node-sarif-builder's transitive deps, not ours). Keeps our declared deps minimal.

---

## rules[] catalog scope (REP-02)

| Option | Description | Selected |
|--------|-------------|----------|
| 18 NG8xxx only, enum-driven + helpUri | Catalog the 18 NG8xxx from `extended-catalog.members.ts`; TS/ATC referenced by `ruleId` with no catalog entry | ✓ |
| Catalog every code (TS + NG + ATC) | Full rule catalog for all diagnostic codes | |
| No rules[] catalog | Only `ruleId` on results, no `driver.rules[]` | |

**Auto-selected:** 18 NG8xxx only, enum-driven (recommended default). — D-06
**Notes:** IMPACT MED (GitHub alert grouping quality) x CONFIDENCE HIGH (18-member enum truth, drift-guarded; ROADMAP goal + FEATURES). SARIF permits results to name rules absent from the catalog, so TS/ATC need no entry.

---

## Phase-31 validation strategy (VER-04 unit slice)

| Option | Description | Selected |
|--------|-------------|----------|
| Golden-snapshot + shape unit specs here; full schema-validation in Phase 32 | Deterministic snapshot + driver/rules/results shape + no-ANSI + exit-parity specs now; ajv/CI schema validation + cross-OS determinism + tarball e2e stay Phase 32 | ✓ |
| Pull full ajv schema validation forward into Phase 31 | Add the dev-only ajv SARIF 2.1.0 validation harness now | |

**Auto-selected:** golden-snapshot + shape unit specs here; defer full validation to Phase 32 (recommended default). — D-07
**Notes:** IMPACT LOW-MED (verification placement) x CONFIDENCE HIGH (ROADMAP already splits VER-02/VER-03 into Phase 32). Keeps the Phase-31/32 boundary intact.

---

## Claude's Discretion

- Exact `partialFingerprints` tuple field order / separator and hash-input serialization.
- Internal signature of the shared-projection reuse inside `sarif-report.ts`.
- The precise NG8xxx `shortDescription` / `helpUri` strings.
- The golden-snapshot fixture layout.

## Deferred Ideas

- Full SARIF 2.1.0 schema validation in CI, cross-OS/Node byte-determinism, shipped-tarball e2e, additive-only git-diff audit, README/CHANGELOG — Phase 32 (VER-02/VER-03/ADD-01/DOC-01).
- Published hosted `$schema` URL (REP-04), `--output <file>` (CLIX-03), other formats (REP-03), `relatedInformation` -> SARIF `relatedLocations` — future milestones, out of scope.
