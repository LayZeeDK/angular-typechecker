# Phase 32: Verification + docs + additive audit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-19
**Phase:** 32-verification-docs-additive-audit
**Mode:** `--analyze --auto --chain` (autonomous single-pass; recommended options auto-selected, no interactive prompts)
**Areas discussed:** SARIF schema validation, Volatile-field redaction, Integration fixtures, Shipped-tarball e2e placement, Additive-only audit, README + CHANGELOG

---

## SARIF 2.1.0 schema validation (VER-02)

| Option | Description | Selected |
|--------|-------------|----------|
| `ajv` dev-dep + committed schema | Validate the real reporter output against a committed SARIF 2.1.0 schema JSON; dev-only, network-free, deterministic | ✓ |
| Golden-snapshot + shape assertion only | Reuse Phase 31's snapshot; no true schema validator | |
| `@microsoft/sarif-multitool` | Heavyweight dotnet CLI conversion/validation tool | |

**Auto-selected:** `ajv` dev-dep + committed schema (recommended default).
**Notes:** VER-02 explicitly mandates "validated against the 2.1.0 schema (dev-only validator)" — a golden snapshot alone does not satisfy it. STACK.md recommends `ajv` as the dev-only choice and rejects sarif-multitool as heavyweight. Dev-only => additive-only charter untouched. `[auto] Selected: ajv + committed schema (recommended default).`

---

## Volatile-field redaction for byte-stability (VER-02)

| Option | Description | Selected |
|--------|-------------|----------|
| One shared redaction helper | Normalize tool version (+ any duration) to a placeholder, reused across JSON + SARIF specs, before the byte assertion | ✓ |
| Per-spec inline redaction | Duplicate the redaction logic in each spec | |
| Assert literal values | No redaction | |

**Auto-selected:** One shared redaction helper (recommended default).
**Notes:** JSON already omits `durationMs` (Phase-30 D-05) and SARIF carries no duration, so the only live volatile field today is the tool version; the helper is future-proofed. Two-run + cross-cell matrix, incl. the Windows path -> forward-slash URI. PITFALLS 11/12. `[auto] Selected: shared redaction helper (recommended default).`

---

## Integration fixtures (VER-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse committed real-compiler fixtures | Pick an existing fixture with a mixed TS + NG8xxx (+ file-less) diagnostic set | ✓ |
| New dedicated reporter fixture | Author a fresh fixture only for the reporter integration tier | |

**Auto-selected:** Reuse committed fixtures (recommended default).
**Notes:** 30+ committed `*.integration.spec.ts` real-compiler fixtures already exist; reuse one that yields representative JSON + SARIF content and exercises the file-less no-location path. Add a dedicated fixture only if none fits. `[auto] Selected: reuse committed fixtures (recommended default).`

---

## Shipped-tarball e2e placement (VER-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Extend existing e2e projects | CLI via cli-e2e, ng run via ng-cli-e2e, Nx executor via install/matrix-e2e; keeps the per-project CI matrix lean | ✓ |
| New dedicated reporter-e2e project | A 6th e2e project just for the reporters | |

**Auto-selected:** Extend existing e2e projects (recommended default).
**Notes:** 5 e2e projects + the per-project dynamic CI matrix + `tarball-audit.e2e.spec.ts` extension pattern are all shipped. Each adapter asserts stdout-purity, schema-valid SARIF, and exit-code parity. Test infra (reversible); exact project-to-adapter mapping is a plan-time re-open. `[auto] Selected: extend existing e2e projects (recommended default).`

---

## Additive-only audit (ADD-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror `24-ADDITIVE-AUDIT.md` vs `@0.2.2` | git-diff + barrel-drift audit -> `32-ADDITIVE-AUDIT.md`; re-confirm the node-sarif-builder classification | ✓ |
| Ad-hoc manual review | No documented audit artifact | |

**Auto-selected:** Mirror the 24 pattern vs `@0.2.2` (recommended default).
**Notes:** The `24-ADDITIVE-AUDIT.md` template shipped; the `angular-typechecker@0.2.2` baseline tag exists (verified); the `node-sarif-builder` dependency classification + `@nx/dependency-checks` visibility are already resolved (31-01, A1). The audit re-confirms, does not re-litigate. `[auto] Selected: mirror 24 pattern (recommended default).`

---

## README + CHANGELOG (DOC-01)

| Option | Description | Selected |
|--------|-------------|----------|
| `## Machine-readable output` + curated CHANGELOG + docs tripwire | README prose (flag, JSON schema, upload-sarif recipe, run-from-repo-root caveat) + undated end-user CHANGELOG 0.2.3 + a `*-docs.spec.ts` lock | ✓ |
| README prose only | No tripwire, no CHANGELOG | |

**Auto-selected:** Full docs + tripwire + curated CHANGELOG (recommended default).
**Notes:** Three shipped `*-docs.spec.ts` tripwires + the curated-CHANGELOG pattern; end-user language, no internal ids. Docs-only, no release cut, `package.json` stays 0.2.2. `[auto] Selected: full docs + tripwire + CHANGELOG (recommended default).`

---

## Claude's Discretion

- Exact fixture selection, redaction-helper signature/placeholders, whether `ajv` needs `ajv-formats`, the docs-spec filename, and the precise project-to-adapter e2e mapping — planner-owned, provided the observable proofs hold.

## Deferred Ideas

- The actual v0.2.3 release cut (version bump + tag + npm publish) — human-gated Release-PR flow after this phase verifies.
- Hosted `$schema` URL (REP-04), `--output` (CLIX-03), other formats (REP-03), SARIF `relatedLocations` (REP-05), `--watch` (CLIX-01) — future milestones.
- Off-stack Angular 20/21 verification — dropped since v0.2.1.
