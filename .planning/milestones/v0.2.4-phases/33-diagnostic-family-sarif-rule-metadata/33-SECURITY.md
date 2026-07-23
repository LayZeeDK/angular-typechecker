---
phase: 33
slug: diagnostic-family-sarif-rule-metadata
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-21
---

# Phase 33 - Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Verification-only audit. Registers authored at plan time in both 33-01-PLAN.md and
> 33-02-PLAN.md `<threat_model>` blocks; mitigations were VERIFIED PRESENT in the
> implemented code/artifacts by grep + source read + a live gate run -- no new-threat scan.
> ASVS L1. block_on: `high`. Live categories: V5 output encoding (SARIF strings),
> V14 Configuration / Supply-Chain (no-new-dependency), plus V8 information disclosure
> (paths) carried as an accepted residual.

---

## Verdict

**PASS.** Every declared mitigation is present in the implemented code. `threats_open: 0`;
no open threat exists at any severity, so nothing sits at or above the `high` blocking
threshold. The phase ships.

- Threats closed: 7 / 7 (T-33-01, T-33-02, T-33-03, T-33-04, T-33-05, T-33-06, T-33-SC).
  T-33-SC appears in both plan registers as one shared supply-chain threat.
- Highest open severity: none.
- Blocking (severity >= `high`) open threats: 0.
- Unregistered flags: none (neither 33-01-SUMMARY.md nor 33-02-SUMMARY.md declares a
  `## Threat Flags` section, and the audit re-diff surfaced no new attack surface).

Independent gate evidence at current HEAD `6b08416` (not trusted from the audit doc, re-run):
`npx nx test angular-typechecker` -> 53 files / 565 tests passed; `npx nx integration
angular-typechecker` -> 24 files / 152 tests passed. The audit doc records its work at
`974524b`, which predates the WR-01 fix commit `029b45d`; the sole src drift since is that
fix (sarif-report.ts + its spec), matching the audit's section-6 addendum.

---

## Trust Boundaries

| Boundary | Description | Data crossing |
|----------|-------------|---------------|
| angular-typechecker SARIF string -> GitHub Code Scanning ingestion | The emitted SARIF crosses into GitHub's ingestion + alert rendering; malformed / mis-encoded content is rejected or mis-rendered there. | SARIF 2.1.0 JSON |
| compiler diagnostic text + file paths -> SARIF result/rule fields | Compiler-derived message text and paths are embedded in the payload; both are pre-normalized by the shared `toDiagnosticRecord` projection (ANSI-free text, repo-relative forward-slash paths). | flattened message text + repo-relative URIs |
| test + audit artifacts -> repository | The specs, snapshots, and `33-ADDITIVE-AUDIT.md` are test-tier / planning artifacts; none ship in the published package or run at consumer runtime. | source-controlled files |

---

## Threat Verification

| Threat ID | Category | Severity | Disposition | Verdict | Evidence |
|-----------|----------|----------|-------------|---------|----------|
| T-33-01 | Tampering / DoS | medium | mitigate | VERIFIED-present (CLOSED) | `sarif-report.ts:225` returns `logBuilder.buildSarifJsonString({ indent: false })` -- builder-delegated serialization; no hand-concatenated JSON anywhere in the module. `validateSarif` (committed SARIF 2.1.0 draft-07 ajv gate) present + green at `sarif-report.spec.ts:394-398,409-413` and all four integration describe blocks (`machine-reporters-sarif.integration.spec.ts:245-249,310-313,365-369,404-408`). Both tiers green. |
| T-33-02 | Information disclosure | low | accept | VERIFIED (accepted residual) | The new rule fields emit NO path: `git grep record.file/record.message` over `sarif-report.ts` returns only the PASS-2 result location (`:200,203-205`) and the hashed fingerprint tuple (`:325-326`) -- never `buildRuleMeta` (`:235-290`). Path emission is unchanged; `toDiagnosticRecord` still relativizes. Repo-relative forward-slash proven at `machine-reporters-sarif.integration.spec.ts:251-259`. Carried from 30-SECURITY.md IN-03 (see Accepted Risks below). |
| T-33-03 | Tampering (ASVS V5 output encoding) | low | mitigate | VERIFIED-present (CLOSED) | `buildRuleMeta` (`sarif-report.ts:235-290`) + `TOOL_RULE_TEXT` (`:86-97`) interpolate ONLY static developer-authored literals, catalog `shortDescription` strings, and `ruleId` (= `record.code`, a bounded compiler-code label e.g. `TS2322` / `NG8011` / `ATC90002`). No `record.message`, no `record.file`, no free user input reaches a rule field. WR-01 fix `029b45d` rebuilds via `buildRuleMeta(record,'template-type-check')` on upgrade (`:170`) -- still static + ruleId only (`:272-279`). `JSON.stringify` escaping via `buildSarifJsonString`; the no-ANSI test (`sarif-report.spec.ts:481-506`) is present + green. |
| T-33-04 | Tampering / DoS | medium | mitigate | VERIFIED-present (CLOSED) | `validateSarif` runs over EVERY fixture payload including both NEW family describe blocks -- extended-content-projection (`:365-369`) and solution-style-all-missing (`:404-408`) -- plus the executor payload (`:290-294`). Integration tier green (152 tests). |
| T-33-05 | Information disclosure | low | mitigate | VERIFIED-present (CLOSED) | `machine-reporters-sarif.integration.spec.ts:251-259` asserts every `artifactLocation.uri` `not.toMatch(/[\\:]/)` (no backslash, no drive letter) over the Windows-authored `layout-b-host` fixture; the committed redacted snapshots reproduce cross-OS. Green. |
| T-33-06 | Tampering | medium | mitigate | VERIFIED-present (CLOSED) | `33-ADDITIVE-AUDIT.md` exists and records a per-published-path git-diff verdict vs `angular-typechecker@0.2.3` (baseline `f12775c`). Independently re-run at HEAD `6b08416`: the `src/`-scoped diff lists EXACTLY the seven permitted files; the do-not-touch surfaces (`json-report.ts`, `format-report.ts`, `diagnostic-record.ts`, `extended-catalog.ts`, `index.ts`, `index.drift.ts`) show an EMPTY diff. No unexpected entry. |
| T-33-SC | Tampering (supply chain) | low | accept | VERIFIED (accepted, provably unchanged) | `git diff angular-typechecker@0.2.3..HEAD -- packages/angular-typechecker/package.json` is EMPTY; `dependencies` stays `{@nx/devkit, node-sarif-builder, nx, tslib}`. `@nx/dependency-checks` is configured `'error'` over `**/*.json` (`eslint.config.mjs:130-131`), so a silently-added dependency fails `nx lint` at maxWarnings:0. No package-install task exists (D-09). |

---

## Accepted Risks

| ID | Threat | Severity | Rationale |
|----|--------|----------|-----------|
| T-33-02 | Repo-relative file paths in `artifactLocation.uri` disclose project structure to whoever can read the SARIF / Code Scanning alerts. | low | Repo-relative forward-slash paths (no absolute path, no drive letter, no cwd) are the intended, necessary SARIF contract -- GitHub Code Scanning locates alerts by them. Phase 33 adds NO new path emission (rule fields carry none). Previously assessed + accepted as 30-SECURITY.md IN-03; unchanged this phase. |
| T-33-SC | A dependency could be silently added, expanding the install-time supply-chain surface. | low | NOT APPLICABLE this phase -- no package-install task, D-09 forbids a new dependency, the manifest is byte-unchanged vs `@0.2.3`, and the active `@nx/dependency-checks` error gate would fail lint if one were added. Accepted as provably unchanged. |

---

## Unregistered Flags

None. Neither phase SUMMARY declares a `## Threat Flags` section, and the additive audit
re-diff surfaced no new published attack surface beyond the seven planned SARIF-path files.

---

## Audit Trail

- Registers read from `33-01-PLAN.md` (T-33-01/02/03/SC) and `33-02-PLAN.md`
  (T-33-04/05/06/SC) `<threat_model>` blocks.
- Verification method per ASVS L1: mitigation PRESENT in the cited file. Each `mitigate`
  threat confirmed by source read + `git grep`; each `accept` threat confirmed unchanged
  (git diff) and logged above; the additive-audit and no-new-dependency claims re-run
  independently rather than trusted from `33-ADDITIVE-AUDIT.md`.
- Live gate confirmation at HEAD `6b08416`: `nx test` (565), `nx integration` (152) green.
- Implementation code was NOT modified by this audit (SECURITY.md is the only artifact written).

---

*Phase: 33-diagnostic-family-sarif-rule-metadata*
*Audited: 2026-07-21 -- baseline `angular-typechecker@0.2.3` (`f12775c`), HEAD `6b08416`*
