---
phase: 11
slug: fallow-code-quality-ci-gate
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-30
---

# Phase 11 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (both 11-01 and 11-02 carried `<threat_model>` blocks);
> all dispositions verified CLOSED against the shipped code. Independently corroborated by
> the deep code review (11-REVIEW.md: 0 Critical, security posture intact) and the phase
> verifier (11-VERIFICATION.md: QUAL-03 posture preserved).

---

## Trust Boundaries

| Boundary                                             | Description                                                                                 | Data Crossing                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------- |
| npm registry -> local/CI node_modules                | A new analyzer dependency (`fallow`) crosses into the dev/CI dependency tree                | package + lockfile (no secrets) |
| repo working tree -> fallow analyzer                 | fallow reads source + git history; no network/privileged surface                            | source code (read-only)         |
| untrusted PR -> ci.yml `fallow` job                  | a fork/untrusted PR triggers the new job on the SAFE `pull_request` (code-checkout) trigger | PR diff (untrusted)             |
| GitHub Actions runner -> repo (token)                | the checkout token scope available to the new job                                           | `GITHUB_TOKEN` (read-only)      |
| third-party actions (`checkout`, `setup-node`) -> CI | mutable-tag repoint risk on the actions the new job uses                                    | action code (pinned by SHA)     |

---

## Threat Register

| Threat ID | Category               | Component                                                                                                              | Disposition         | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                        | Status |
| --------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| T-11-01   | Tampering/Spoofing     | `fallow` npm dep (slopsquat / hijacked release)                                                                        | mitigate            | EXACT-pin `"fallow": "2.103.0"` (no `^`/`~`) in `package.json:37` + lockfile; CI `npm ci` then `npx fallow` (locked version, never `@latest`). Slopcheck cleared 2.103.0 (404k wk dl, source `github.com/fallow-rs/fallow`, no postinstall).                                                                                                                                                                                                      | closed |
| T-11-02   | Tampering              | `.fallowrc.jsonc` over-suppression baselining real debt                                                                | accept (controlled) | "Resolve, not baseline": false positives suppressed STRUCTURALLY (entry/ignoreExports/overrides), one documented JSONC reason each; genuine `@angular/forms` finding REMOVED at source (not ignored); `unused-dependencies` stays `error`; only structurally-untraceable `unused-dev-dependencies` is `off`. Deep code review confirmed no suppression hides real dead code (mapped each to a verified false positive via a no-suppression scan). | closed |
| T-11-SC   | Tampering              | npm install of `fallow`                                                                                                | mitigate            | Package Legitimacy Audit in 11-RESEARCH.md cleared `fallow` `[OK]`; no `postinstall` script; no human checkpoint required.                                                                                                                                                                                                                                                                                                                        | closed |
| T-11-03   | Tampering              | mutable action tag repointed to malicious code (tj-actions vector)                                                     | mitigate            | `fallow` job reuses the EXACT 40-char SHA pins already in ci.yml (`actions/checkout@93cb6efe... # v5.0.1`, `actions/setup-node@a0853c24... # v5.0.0`); Dependabot keeps them in lockstep. No new/un-pinned action. Confirmed in shipped `ci.yml` fallow job.                                                                                                                                                                                      | closed |
| T-11-04   | Elevation of Privilege | untrusted-PR exploitation of the new CI job                                                                            | mitigate            | Reuses the SAFE `pull_request` (code-checkout) trigger; top-level `permissions: contents: read` (ci.yml:27-28) unchanged; the `fallow` job re-grants NO write (no job `permissions:` block); `npx fallow audit` reads git + filesystem only.                                                                                                                                                                                                      | closed |
| T-11-05   | Tampering              | PR-metadata command injection in the new run step                                                                      | mitigate            | The `fallow` job run step uses FIXED ids + flags only (`npx fallow audit --format human --base origin/main`); NO `${{ github.event.* }}` interpolation (confirmed by grep of the shipped job).                                                                                                                                                                                                                                                    | closed |
| T-11-06   | Info Disclosure        | checkout credential persisted to `.git/config` and leaked                                                              | mitigate            | `persist-credentials: false` on the `fallow` job checkout (matches every other checkout in the file). Confirmed in shipped `ci.yml`.                                                                                                                                                                                                                                                                                                              | closed |
| T-11-07   | Elevation of Privilege | output-channel privilege creep (SARIF needs `security-events: write`; PR-feedback formats need `pull-requests: write`) | mitigate            | Gate uses `--format human` (CI-log only), NOT `--ci`/SARIF and NOT the PR-feedback formats (`review-github`/`pr-comment-github`) -- all DEFERRED to a later milestone; no `security-events` or `pull-requests` permission requested — least-privilege `contents: read` holds. Confirmed: no `security-events` token anywhere in ci.yml.                                                                                                           | closed |

_Status: open · closed_
_Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)_

---

## Accepted Risks Log

| Risk ID  | Threat Ref | Rationale                                                                                                                                                                                                                                                                                                                                                 | Accepted By                                 | Date       |
| -------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ---------- |
| AR-11-01 | T-11-02    | `unused-dev-dependencies: off` accepts that root dev-tooling deps (ESLint flat-config plugins, swc register, attw/publint CLIs) are structurally un-traceable by import graph and will always false-positive; dev-dep hygiene is owned by `@nx/dependency-checks` (published package) + manual review. `unused-dependencies` stays `error` for prod deps. | Lars Gyrup Brink Nielsen (D-06, plan 11-01) | 2026-06-30 |

_Accepted risks do not resurface in future audit runs._

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By                                                                                                                                                        |
| ---------- | ------------- | ------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-30 | 8             | 8      | 0    | gsd-secure-phase (short-circuit: register authored at plan time, all mitigations verified in shipped code; corroborated by 11-REVIEW.md + 11-VERIFICATION.md) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-30
