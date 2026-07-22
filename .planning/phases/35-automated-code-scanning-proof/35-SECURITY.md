---
phase: 35
slug: automated-code-scanning-proof
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on (high) severity (the blocking gate)
threats_found: 14
threats_closed: 14
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
created: 2026-07-22
---

# Phase 35 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (all four PLANs carry a parseable `<threat_model>`).
> This audit VERIFIES each declared mitigation exists in the implemented code — it does
> not scan for new threats. ASVS L1, block on `high`.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| repo content -> Nx project graph | The proof fixture must NOT cross into the real `nx typecheck` merge gate; its deliberate errors are isolated by having NO `project.json` and no `tsconfig.tools.json` entry. | Committed fixture `.ts`/`.html`/`tsconfig` (trusted repo content) |
| repo content -> Angular compiler | Fixture sources are trusted, committed repo content fed to the shipped engine, not attacker-controlled input. | Fixture source text |
| assert script -> `gh` CLI subprocess -> GitHub REST | The assert shells out to `gh`; the subprocess call must be injection-safe (fixed arg array, no shell). | `gh api` path/query strings |
| env (PR data) -> assert script | `PR_NUMBER` / `SARIF_ID` are GitHub-controlled values passed via `env`, consumed as data, never interpolated into a shell. | PR number, SARIF id |
| `GH_TOKEN` -> `gh` | Read-only auth via the ephemeral workflow token; no long-lived secret read or written. | Ephemeral `GITHUB_TOKEN` |
| PR event -> `code-scanning-proof` job | Untrusted PR metadata (PR number, fork flag) crosses here; consumed via Actions expressions / `env`, never a `run:` shell. | PR metadata |
| CI job -> GitHub Code Scanning | Job holds `security-events: write` to upload the SARIF and read alerts/analyses; scope is job-level only. | SARIF payload, alerts/analyses reads |
| reporter output -> GitHub Code Scanning | The SARIF payload crosses into `upload-sarif` ingestion; a rejected payload blocks the proof. | SARIF results (incl. file-less fallback locations) |
| repo filesystem path -> emitted SARIF | `result.tsConfigPath` (a filesystem path) is rendered into `artifactLocation.uri`. | tsconfig path |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-35-01 | Tampering | reused `upload-sarif` action | high | mitigate | Full 40-char SHA pin `github/codeql-action/upload-sarif@7188fc363630916deb702c7fdcf4e481b751f97a # v4.37.1` (`ci.yml:697`); no new marketplace action added. | closed |
| T-35-02 | Tampering / Elevation | PR-metadata command injection | high | mitigate | PR number + `sarif-id` passed via `env:` (`ci.yml:708-711`); `SARIF_ID: ${{ steps.upload.outputs['sarif-id'] }}` uses bracket syntax; never interpolated into a `run:` shell; fork check is an Actions expression (`ci.yml:696,707`), not a shell. | closed |
| T-35-03 | Elevation of Privilege | over-broad token scope | high | mitigate | Job-level `permissions: { contents: read, security-events: write }` ONLY (`ci.yml:658-660`); top-level stays `contents: read` (`ci.yml:29-30`); no `contents: write` / publish scope anywhere in the job. | closed |
| T-35-04 | Information Disclosure | credential persistence | medium | mitigate | `persist-credentials: false` on `actions/checkout` (`ci.yml:666`). | closed |
| T-35-05 | Denial of Service (false red) | fork PR read-only token | medium | mitigate | Upload + assert steps gated on `github.event.pull_request.head.repo.fork == false` (`ci.yml:696,707`); a fork PR builds/generates but skips upload+assert and stays green. | closed |
| T-35-06 | Information Disclosure (noise) | fixture errors leaking to `main` alerts view | high | mitigate | Job `if:` is `github.event_name == 'pull_request' && ...` (`ci.yml:656`) — never push-to-`main`; assert queries `refs/pull/${prNumber}/merge` only (`assert-code-scanning.mjs:246`), never the default-branch view. Trigger fidelity locked by `tools/act/act-compat.sh` (PR-selected / push-main-absent). | closed |
| T-35-07 | Information Disclosure / DoS (false red) | fixture deliberate errors | medium | mitigate | NO `project.json` under `tools/sarif-proof-fixture/` (verified absent on disk) + no `tsconfig.missing.json` (verified absent) -> outside the Nx graph; fixture NOT in `tsconfig.tools.json` `include` allowlist; fallow `overrides` scope `tools/sarif-proof-fixture/**` off `unused-files`/`unrendered-components`/`unused-component-inputs` (`.fallowrc.jsonc:288-292`); `.prettierignore:35` excludes the whitespace-sensitive `.html`. | closed |
| T-35-08 | Tampering / Elevation (command injection) | assert script subprocess | high | mitigate | `execFileSync('gh', args, { encoding, maxBuffer })` — fixed arg array, NO `shell:true` (`assert-code-scanning.mjs:116-131`); PR data read from `process.env` (`:244-245`), never concatenated into a shell; `gh` reads `GH_TOKEN` from env. | closed |
| T-35-09 | Tampering | fixture drift vs reporter contract | low | mitigate | Drift-lock integration `describe` runs the shipped CLI over the fixture and asserts exactly one rule per family at the expected (tag, level) tuples in ONE run (`machine-reporters-sarif.integration.spec.ts:484-540`), so a fixture/reporter change that breaks the contract fails locally. | closed |
| T-35-10 | Denial of Service (flaky false red) | async ingestion timing | medium | mitigate | Deterministic wait handle `waitForProcessing` polls `sarifs/{id}` to `complete` (`assert-code-scanning.mjs:141-159`); bounded `assertAlerts` retry/backoff (`:187-207`, 20 x 6s); throws (fail loud) only on a true timeout or `processing_status: failed`. | closed |
| T-35-11 | Spoofing (dogfood alert masks a proof regression) | alert category isolation | medium | mitigate | Alerts client-filtered to `most_recent_instance.category === angular-typecheck-proof` (tolerant `categoryMatches`) BEFORE set-membership (`assert-code-scanning.mjs:194,219`); unit-tested category-isolation case (`assert-code-scanning.spec.ts:160`). | closed |
| T-35-SC | Tampering (supply chain) | package / action installs | high | mitigate | No new package/action installed this phase; `npm ci` uses the pinned lockfile (`ci.yml:672`); the only action is the pre-pinned `upload-sarif` SHA. (Positive: commit `afe1241` added a nested `ajv->fast-uri ^3.1.4` override clearing HIGH `GHSA-v2hh-gcrm-f6hx`.) | closed |
| T-35-04-01 | Information Disclosure | `sarif-report.ts` PASS-2 fallback location (`artifactLocation.uri = tsConfigPath`) | low | mitigate | File-less arm supplies `fileUri: relativizePath(result.tsConfigPath, pathBase)` (`sarif-report.ts:219`; import `:9`) — repo-relative, forward-slash, cross-OS-stable, the same treatment already applied to `diagnostics[].file`. Residual (cross-drive absolute path) is the pre-existing ASVS-L1-ACCEPTED IN-03 (`diagnostic-record.ts:145`; 30-SECURITY.md IN-03 within T-30-04). | closed |
| T-35-04-SC | Tampering | npm/pip/cargo installs | low | accept | No package installs in plan 35-04 (SARIF-only source + spec + snapshot + README edits); no dependency added or upgraded. Logged in Accepted Risks (AR-35-1). | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `high` count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-35-1 | T-35-04-SC | Plan 35-04 installs, adds, and upgrades zero dependencies (SARIF reporter source + spec + snapshot + README only), so the package-legitimacy checkpoint does not apply. No supply-chain surface introduced. | gsd-security-auditor | 2026-07-22 |
| AR-35-2 (ref) | T-35-04-01 residual (IN-03) | The only residual on the new file-less fallback `artifactLocation.uri` is a cross-Windows-drive `tsConfigPath` (base `D:\` vs file `C:\`) yielding an absolute path from `path.win32.relative` — rare (cross-drive tsconfig references / symlinked deps). Pre-existing, ASVS-L1-ACCEPTED under IN-03 in the archived 30-SECURITY.md (within T-30-04) and documented in `diagnostic-record.ts:145`. Unchanged by this phase; full URI normalization is Phase-31 territory. Not a blocker at ASVS L1. | inherited (30-SECURITY.md) | 2026-07-22 |

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Flags

None. The only `## Threat Flags` section across the phase SUMMARYs (`35-03-SUMMARY.md:95`) reports "None" — all security-relevant surface (the `security-events: write` scope, the PR-metadata env boundary, the reused SHA-pinned action, the fork gate) is enumerated in the plan `<threat_model>` blocks (T-35-01..T-35-SC, T-35-04-01/-SC). No new network endpoint, auth path, or trust boundary appeared during implementation.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-22 | 14 | 14 | 0 | gsd-security-auditor (Claude) |

Notes:
- All 12 `mitigate` threats verified by grep-level evidence in the cited files (ASVS L1 depth); each mitigation traced to a concrete file:line at the correct boundary.
- 1 `accept` threat (T-35-04-SC) verified against the Accepted Risks Log (AR-35-1); 1 residual (IN-03) inherited from 30-SECURITY.md (AR-35-2).
- Real-CI confirmation (informational, not part of the mitigation grep): the `code-scanning-proof` job ingested the SARIF with no `locationFromSarifResult` rejection and the assert exited 0 with all four tuples on `refs/pull/55/merge` (run 29875173270), per 35-VERIFICATION.md.
- Positive supply-chain note: commit `afe1241` overrode nested `ajv->fast-uri` to `^3.1.4`, clearing HIGH `GHSA-v2hh-gcrm-f6hx`.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-22
