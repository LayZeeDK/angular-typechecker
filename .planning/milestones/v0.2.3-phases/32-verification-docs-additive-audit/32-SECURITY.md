---
phase: 32
slug: verification-docs-additive-audit
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-07-19
---

# Phase 32 -- Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Verdict: **SECURED** (7/7 threats CLOSED). Independently reached by the gsd-security-auditor
subagent (agent afbd4c4f164b37ce2, opus) -- every declared mitigation verified PRESENT in
committed code, not merely documented. Phase 32 is the FINAL phase of milestone v0.2.3
(machine-readable JSON/SARIF reporters): a docs + test + additive-audit phase adding no new
runtime surface. block_on = high; every threat is severity `low`, so none would block even if
open.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| npm registry -> dev machine | `ajv`/`ajv-formats` install (dev-only tooling, never shipped) | package tarballs (dev tier) |
| committed schema fixture -> ajv validator | network-free at test time; no fetch-at-test injection surface | SARIF JSON payloads (test) |
| diagnostic file path -> committed/uploaded SARIF payload | absolute local paths must never leak into machine output | file URIs in JSON/SARIF |
| Verdaccio local registry -> consumer install | e2e installs the packed tarball by name from a 127.0.0.1 registry | packed plugin tarball |
| shipped bin/executor stdout -> test assertion | the machine payload boundary stays pure (no advisory text on stdout) | reporter payloads |
| published npm surface -> consumer | additive-only audit is the control that no breaking change reaches a patch consumer | public API / schemas |
| curated CHANGELOG -> public GitHub Release notes | internal ids / jargon must not leak into consumer-facing release notes | release prose |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-32-SC | Tampering (dep drift) | `ajv`/`ajv-formats` install + plugin `dependencies` | low | mitigate/accept | Shipped `packages/angular-typechecker/package.json` deps = `{@nx/devkit, node-sarif-builder@^4.1.0, nx, tslib}` -- NO `ajv`/`ajv-formats`, no devDependencies block. Root `package.json` carries `ajv@^8.20.0` + `ajv-formats@^3.0.1` as dev-only. `32-ADDITIVE-AUDIT.md` records `node-sarif-builder` as the sole new runtime dep. | closed |
| T-32-01 | Information disclosure | SARIF `artifactLocation.uri` / JSON `file` path | low | mitigate | `relativizePath` (`core/diagnostic-record.ts:113-124`) relativizes to `pathBase` + `.replace(/\\/g,'/')`; SARIF `fileUri` reuses the SAME `toDiagnosticRecord` projection (`core/sarif-report.ts:91,99`). Specs assert `not.toMatch(/[\\:]/)` on JSON `file` (`machine-reporters-json.integration.spec.ts:100`) and SARIF `uri` (`machine-reporters-sarif.integration.spec.ts:161`) -- blocks backslash AND drive-letter colon. | closed |
| T-32-02 | Tampering (slopsquat) | slopsquatted `ajv-format` typo | low | mitigate | Exact official names `ajv` + `ajv-formats` in root devDeps (not `ajv-format`). ADD-01 dep-diff is the standing catch for any stray dep. | closed |
| T-32-03 | Tampering/Spoofing | Verdaccio e2e harness | low | mitigate | `libs/test-util/src/lib/verdaccio-global-setup.ts:207` `listenAddress: '127.0.0.1'`; `:218` hard-asserts the URL `startsWith('http://127.0.0.1:')`; publish-once/tokened. The 32-02 commits touched no global-setup -- reused, not new surface. | closed |
| T-32-04 | EoP / contract break | published executor id / public barrel | low | mitigate | `src/index.drift.ts` barrel-drift tsc + 4 `schema-parity.spec.ts` (executor/builder/2 generators); `32-ADDITIVE-AUDIT.md` records ADDITIVE-ONLY HOLDS, v0.3.0 UNTRIGGERED, version held at 0.2.2 (widen-only schemas, no rename/narrow). | closed |
| T-32-05 | Information disclosure | CHANGELOG / README prose | low | mitigate | `machine-readable-docs.spec.ts:91-103` slices the `## 0.2.3` entry and asserts `not.toMatch` of internal ids / plan-id scopes / board jargon; the actual entry reads clean (consumer prose, no ids, no date). | closed |
| T-32-06 | Tampering (doc drift) | documented `--format` claims | low | mitigate | `machine-readable-docs.spec.ts:36,72-74` drift-locks `--format` against live `parseCliArgs(['--help'])` AND the README; section/anchor asserted at `:46,51`; stale-claim absence drift-lock at `:78-79`. | closed |

*Status: open | closed | open-below-threshold (non-blocking)*
*Severity: critical > high > medium > low -- only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) | accept (documented risk) | transfer (third-party)*

---

## Accepted Risks Log

No accepted risks. Every disposition is `mitigate` and verified closed. (T-32-SC carries an
`accept` leg in 32-02 for "this plan adds no dependency"; it is covered by the same
dependency-diff control, which passes -- no standing accepted risk remains.)

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-19 | 7 | 7 | 0 | gsd-security-auditor (opus, agent afbd4c4f164b37ce2) |

Notes:
- `threats_open: 0` (blocking count under `block_on: high`). All 7 threats CLOSED; none is
  severity >= high, so even a hypothetical gap here would be non-blocking.
- The one packaging change surfaced mid-phase (`project.json` asset-glob
  `ignore: ["**/__snapshots__/**"]`) is present and classified non-breaking by ADD-01 -- it
  removes a pre-existing dev-snapshot tarball leak, tightening (not widening) the published
  surface. No threat regressed.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (none)
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-19
