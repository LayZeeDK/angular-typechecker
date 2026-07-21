---
phase: 34
slug: per-project-sarif-categories-in-ci
status: verified
# threats_open = count of OPEN threats at or above block_on (high) severity
threats_open: 0
asvs_level: 1
created: 2026-07-21
---

# Phase 34 - Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Verification-only audit. Register authored at plan time in 34-01-PLAN.md's
> `<threat_model>` block; each mitigation was VERIFIED PRESENT in the implemented
> code (git grep + source read of ci.yml + the two tools/ci/*.mjs + the drift-guard
> spec) -- no new-threat scan. ASVS L1. block_on: `high`. This phase is CI-only:
> a `pull_request`-triggered `code-scanning` job + two `tools/ci/*.mjs` scripts
> (repo-local fs reads + a fixed-arg `spawnSync`, no shell) + two plugin specs.

---

## Verdict

**PASS.** Every declared mitigation is present in the implemented code. `threats_open: 0`;
no open threat exists at any severity, so nothing sits at or above the `high` blocking
threshold. The phase ships.

- Threats closed: 7 / 7 (T-34-01, T-34-02, T-34-03, T-34-04, T-34-05, T-34-06, T-34-SC).
- Highest open severity: none.
- Blocking (severity >= `high`) open threats: 0.
- Unregistered flags: none (34-01-SUMMARY.md declares no `## Threat Flags` section).

Every mitigation is a "preserve the existing posture" invariant (D-05): the phase
rewired only the angular-typechecker generate + upload region of the `code-scanning`
job and added two `tools/ci/*.mjs` scripts + two specs. The `git diff` of the phase
commits (`9d8ba99~1..b3eb306`) touches EXACTLY: `.github/workflows/ci.yml`, the two
new specs, and the two new `tools/ci/*.mjs` -- `package.json` is byte-unchanged.
The restored `|| true` per-generation tolerance (WR-02) does not weaken any mitigation:
it governs upload-vs-skip semantics, not the fork gate, the SHA pin, or the permissions.

---

## Trust Boundaries

| Boundary | Description | Data crossing |
|----------|-------------|---------------|
| untrusted PR event -> code-scanning job | A `pull_request` event carries attacker-controllable metadata (title, branch, author, fork status) into the CI job. | PR event context |
| committed workspace files -> discovery/merge scripts | The two `tools/ci/*.mjs` scripts read only repo-local committed `project.json` files and the shipped CLI's own stdout; no external/PR-controlled input. | repo-local JSON + CLI stdout |
| merged SARIF -> GitHub Code Scanning API | The upload crosses into GitHub's Code Scanning store using a job-scoped `security-events: write` token via a SHA-pinned action. | SARIF 2.1.0 JSON |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-34-01 | Tampering / EoP | code-scanning `run:` steps | high | mitigate | No PR metadata interpolated into any shell; discovery/merge read fixed repo files; `spawnSync` fixed arg array, no `shell: true`; fork check is an Actions expression. | closed |
| T-34-02 | Elevation of Privilege | both upload steps | high | mitigate | Fork-PR skip gate `...pull_request.head.repo.fork == false` preserved verbatim on both uploads (analysis runs; only upload skips). | closed |
| T-34-03 | Tampering | `upload-sarif` action ref | high | mitigate | `upload-sarif` pinned to the 40-char SHA `7188fc363630916deb702c7fdcf4e481b751f97a`; no new Action added. | closed |
| T-34-04 | Information Disclosure | actions/checkout | medium | mitigate | `persist-credentials: false` preserved on the code-scanning checkout. | closed |
| T-34-05 | Elevation of Privilege | job `permissions` | high | mitigate | `security-events: write` at JOB level only; top-level workflow permissions stay `contents: read`. | closed |
| T-34-06 | Repudiation / gate integrity | discovery script + drift guard | medium | mitigate | `list-typecheck-projects.mjs` throws on an empty set (fail-loud); the MULTI-02 drift guard turns a dropped/added consumer into a loud RED. | closed |
| T-34-SC | Tampering (supply chain) | npm/action installs | low | accept | No new dependency (package.json byte-unchanged) and no new Action; merge uses Node builtins + the already-pinned `upload-sarif`. | closed |

*Status: open . closed . open - below high threshold (non-blocking)*
*Severity: critical > high > medium > low - only open threats at or above `high` count toward threats_open*
*Disposition: mitigate (implementation required) . accept (documented risk) . transfer (third-party)*

---

## Threat Verification

| Threat ID | Category | Severity | Disposition | Verdict | Evidence |
|-----------|----------|----------|-------------|---------|----------|
| T-34-01 | Tampering / EoP | high | mitigate | VERIFIED-present (CLOSED) | The `atc-sarif` `run:` (`ci.yml:570-573`) is `node tools/ci/merge-sarif.mjs || true` + the `[ -s ]` produced-guard -- NO `${{ }}` PR-metadata interpolation. `merge-sarif.mjs:90-94` spawns via `spawnSync(process.execPath, args, { cwd, encoding, maxBuffer })` -- NO `shell: true`; the arg array (`:78-84`) is `[BIN, '-c', <leaf>..., '--format', 'sarif']`, every leaf sourced from committed `project.json`, no PR data. `list-typecheck-projects.mjs` reads only repo-local `project.json` via `fs` (`:58,24`). The fork check is an Actions `if:` expression (`ci.yml:601`), not shell. |
| T-34-02 | Elevation of Privilege | high | mitigate | VERIFIED-present (CLOSED) | `ci.yml:601` on "Upload angular-typechecker SARIF": `if: ${{ (github.event_name != 'pull_request' || github.event.pull_request.head.repo.fork == false) && steps.atc-sarif.outputs.produced == 'true' }}` -- fork gate verbatim. Mirrored on the fallow upload (`ci.yml:610`). The analysis (build + generate) still runs on a fork PR; only the upload skips. |
| T-34-03 | Tampering | high | mitigate | VERIFIED-present (CLOSED) | Both uploads pin `github/codeql-action/upload-sarif@7188fc363630916deb702c7fdcf4e481b751f97a # v4.37.1` (`ci.yml:602` and `ci.yml:611`). `git grep -c` of the SHA over ci.yml returns 2. No new Action was added: the phase diff touches only the atc-sarif generate/upload region, and the merge is Node-builtin-only. |
| T-34-04 | Information Disclosure | medium | mitigate | VERIFIED-present (CLOSED) | `ci.yml:551` `persist-credentials: false` on the code-scanning job's `actions/checkout` step (`:549-552`). No checkout credential is persisted to `.git/config`. |
| T-34-05 | Elevation of Privilege | high | mitigate | VERIFIED-present (CLOSED) | Top-level `permissions: contents: read` (`ci.yml:29-30`). The `code-scanning` job re-declares `permissions: { contents: read, security-events: write }` (`ci.yml:543-545`) -- `security-events: write` is job-scoped ONLY; job-level permissions REPLACE the top-level block, which stays read-only for every other job. |
| T-34-06 | Repudiation / gate integrity | medium | mitigate | VERIFIED-present (CLOSED) | `list-typecheck-projects.mjs:83-87` throws `no angular-typechecker:typecheck projects discovered` on an empty set (fail-loud). The MULTI-02 drift guard (`multi-typecheck-discovery-guard.spec.ts:120-145`) execs the SAME discovery CLI CI runs and `toEqual`s an independent root-agnostic enumeration (executor-FIELD parse, `:108-110`; root + `e2e/` subtraction `:100`), asserting the enumeration is non-empty (`:127-130`) before the equality -- a dropped/added consumer is a loud RED. |
| T-34-SC | Tampering (supply chain) | low | accept | VERIFIED (accepted, provably unchanged) | `git diff --name-only 9d8ba99~1..b3eb306` lists only ci.yml + the two specs + the two `tools/ci/*.mjs`; `packages/angular-typechecker/package.json` is byte-unchanged. `dependencies` stays `{@nx/devkit, node-sarif-builder, nx, tslib}` (`package.json:53-58`) -- `node-sarif-builder` is pre-existing, not new, and is NOT imported by the merge (`merge-sarif.mjs:20-26` imports only `node:child_process`, `node:fs`, `node:url` + the sibling discovery module). No new Action. Logged in Accepted Risks below. |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| T-34-SC | Supply-chain: a dependency or Action could be silently added, expanding install-time surface. | NOT APPLICABLE this phase -- no package-install task (D-06), `package.json` is byte-unchanged across the phase commits, the merge is assembled with Node builtins + the already-SHA-pinned `upload-sarif`, and no new Action ref appears. The active `@nx/dependency-checks` error gate would fail `nx lint` at maxWarnings:0 if a dependency were added. Accepted as provably unchanged; no package-legitimacy checkpoint required. | gsd-security-auditor | 2026-07-21 |

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Flags

None. 34-01-SUMMARY.md declares no `## Threat Flags` section, and the phase diff
(`9d8ba99~1..b3eb306`) surfaces no new attack surface beyond the CI-only files the
register already covers.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-21 | 7 | 7 | 0 | gsd-security-auditor |

- Register read from `34-01-PLAN.md` `<threat_model>` (T-34-01/02/03/04/05/06/SC).
- Verification method per ASVS L1: mitigation PRESENT in the cited file. Each `mitigate`
  threat confirmed by source read + `git grep`; the `accept` threat (T-34-SC) confirmed
  provably unchanged via `git diff --name-only` of the phase commits and logged above.
- Implementation code was NOT modified by this audit (34-SECURITY.md is the only artifact
  written).
- Audited at HEAD `cf4e60b`; phase implementation commits `9d8ba99` / `5d7247e` / `b3eb306`.
- Note: MULTI-01 end-to-end GitHub acceptance of the multi-run file is real-CI-only
  (async/server-side ingestion) and is NOT a security mitigation -- it is deferred to
  Phase 35 (PROOF) and does not bear on any threat here.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-21

---

*Phase: 34-per-project-sarif-categories-in-ci*
*Audited: 2026-07-21 -- HEAD `cf4e60b`, implementation commits `9d8ba99` / `5d7247e` / `b3eb306`*
