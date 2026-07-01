---
phase: 05-packaging-publish-hardening-e2e-smoke-mvp
plan: 05
subsystem: live-release-execution (HUMAN-GATED, B-01)
tags: [npm-publish, oidc, provenance, trusted-publisher, supply-chain, first-release]
requirements: [PKG-03]
execution_mode: human-gated (B-01) -- maintainer-executed with orchestrator assistance; no autonomous agent run (plan was autonomous:false)
dependency_graph:
  requires:
    - "05-01 (manifest: version 0.0.1, repository.url, publishConfig)"
    - "05-02 (tarball audit gate proving publishability)"
    - "05-03 (e2e install smoke proving install-and-run)"
    - "05-04 (nx release config + hardened release.yml + SECURITY.md + Dependabot)"
  provides:
    - "angular-typechecker@0.0.1 LIVE on npm (MIT, 0.x) with SLSA provenance attestation"
    - "npm Trusted Publisher registered (OIDC) -> tokenless steady-state publishing for all future releases"
    - "package publishing access set to 'Require 2FA and disallow tokens' (strictest)"
    - "GitHub Release angular-typechecker@0.0.1 with curated notes"
  affects:
    - "0.0.2 = the first OIDC steady-state release (cut via nx release --skip-publish -> tag -> approve); see the registry-url empty-_authToken caveat noted inline in release.yml"
tech_stack:
  added: []
  patterns:
    - "first-publish bootstrap: short-lived granular bypass-2FA token in CI, then revoke + register Trusted Publisher (npm/cli#8544: OIDC cannot do a first publish)"
    - "provenance on a token publish via id-token:write + NPM_CONFIG_PROVENANCE (auth = token, attestation = OIDC, independent)"
key_files:
  created:
    - "CHANGELOG.md (curated 0.0.1 -- Initial release; not in the npm files allowlist, repo/GitHub-Release artifact only)"
  modified:
    - "packages/angular-typechecker/package.json (publishConfig.access=public -- D-04 correction)"
    - "packages/angular-typechecker/src/package-manifest.spec.ts (guard access:public)"
    - ".github/workflows/release.yml (CI build step; one-time seed-token activate then revert to OIDC-only)"
    - "nx.json (release.releaseTag.pattern = angular-typechecker@{version} -- verifier catch, pre-publish)"
decisions:
  - "Executed the live publish as a HUMAN action (B-01) -- the only irreversible step in the phase; the agent never ran the publish. The autonomous chain stopped at publish-ready; the maintainer performed seed -> register TP -> revoke out-of-band on npmjs.com/GitHub."
  - "First-publish bootstrap via a one-time granular WRITE token with BYPASS 2FA enabled (scoped All-packages since the unscoped package did not exist yet), supplied to the hardened release.yml as NODE_AUTH_TOKEN for one CI run with id-token:write + NPM_CONFIG_PROVENANCE so the seed still got provenance; token revoked + secret deleted immediately after."
  - "Trusted Publisher registered with the strictest package publishing access: 'Require two-factor authentication and disallow tokens' (OIDC trusted publishing is unaffected by 'disallow tokens'; confirmed via npm's own UI note + docs)."
  - "Allowed actions: npm publish (direct). Stage-only (npm stage publish) deferred -- nx release publish does a direct publish and staged-publishing support is unverified; flagged as a future hardening."
metrics:
  completed: 2026-06-28
  tasks: 3 (all checkpoint:human-action / human-verify)
  files: 4 modified + 1 created (CHANGELOG)
  ci_runs: 4 (3 failed-then-fixed, 1 success) -- the seed deliberately ran through release.yml to validate it end-to-end
---

# Phase 5 Plan 05: Live First Publish (HUMAN-GATED, B-01) Summary

`angular-typechecker@0.0.1` is **published to npm with provenance**, and tokenless OIDC publishing is established for every future release. This plan was a HUMAN RUNBOOK (B-01) -- the irreversible publish + the out-of-band npmjs.com / GitHub actions were performed by the maintainer (orchestrator-assisted); no autonomous agent ran the publish. The seed was deliberately run THROUGH the hardened `release.yml` (not a separate workflow) so the real workflow's build -> pack -> publish -> provenance -> approval machinery was validated end-to-end; only the first-publish auth (which OIDC replaces) was the seed-specific path.

## What Was Done

| Step | Action | By | Evidence |
| ---- | ------ | -- | -------- |
| 1 | Publish-readiness pre-flight (05-01..05-04 green, dry-run previews 0.0.1) | orchestrator + human | 05-VERIFICATION (passed) |
| 2 | npm account 2FA confirmed; repo `npm-publish` environment + required reviewer; Private Vulnerability Reporting enabled | human (GitHub/npm UI) | -- |
| 3 | Granular WRITE token (bypass-2FA, All-packages, short expiry) -> GitHub secret `NPM_SEED_TOKEN` | human (npm UI) | -- |
| 4 | Seed token activated in `release.yml`; tag `angular-typechecker@0.0.1` cut + pushed | orchestrator | commits 136f1ac, 689f917, 9d3f7b7 |
| 5 | Maintainer approved the `npm-publish` deployment; CI seed-published 0.0.1 with provenance | human + CI | gh run 28330808612 (success) |
| 6 | Lock-down: seed token reverted in `release.yml` (OIDC-only); npm token revoked; `NPM_SEED_TOKEN` secret deleted | orchestrator (revert) + human (revoke/delete) | commit 4708eae |
| 7 | Trusted Publisher registered (GitHub Actions, repo LayZeeDK/angular-typechecker, workflow release.yml, env npm-publish, action npm publish) with "Require 2FA and disallow tokens" | human (npm UI) | npm package settings |
| 8 | GitHub Release `angular-typechecker@0.0.1` created with curated notes | orchestrator | releases/tag/angular-typechecker@0.0.1 |

## Verification (live)

`npm view angular-typechecker --json`:
- `version`: **0.0.1**
- `dist.attestations.provenance.predicateType`: **https://slsa.dev/provenance/v1** (SLSA provenance present)
- `maintainers`: `layzee <larsbrinknielsen@gmail.com>`
- `dist.tarball`: https://registry.npmjs.org/angular-typechecker/-/angular-typechecker-0.0.1.tgz

PKG-03 EXECUTION is complete (the CONFIG half was 05-04). 05-VERIFICATION re-verified -> `status: passed`.

## Deviations / real defects the seed run surfaced (and fixed)

Running the seed through the actual `release.yml` caught two genuine, ship-blocking bugs that a source-tree check would have missed -- the core value of seeding via the real workflow:

**1. [Blocking] `publishConfig.access` must be explicit for provenance on a NEW package (D-04 correction).**
- CI error: `Can't generate provenance for new or private package, you must set access to public`.
- D-04 had DROPPED `access` ("unscoped defaults to public, so it's a no-op") -- wrong for a first publish + provenance. Fixed: added `publishConfig.access: "public"` + a manifest-spec guard.
- Commit: 9d3f7b7.

**2. [Blocking] Granular token needed the "Bypass 2FA" flag.**
- CI error: `This operation requires a one-time password` (CI cannot supply an interactive OTP).
- The original Step-3 token-creation instructions omitted the granular token's **Bypass 2FA** checkbox; classic automation tokens (which auto-bypassed 2FA) are gone, and account-level "require 2FA for write actions" being off does NOT exempt a non-bypass token. Fixed by recreating the token with **Bypass 2FA** enabled (npm-side; no code change). Web-research-confirmed (npm docs + npm/cli#8869/#9268).

**Pre-publish verifier catch (also fixed):** `nx.json` used the deprecated top-level `releaseTagPattern`; switched to the Nx 23 nested `release.releaseTag.pattern = "angular-typechecker@{version}"` so the cut tag matches the `release.yml` trigger glob (commit 785c747). Also added a CI `nx build` step before publish (fresh CI checkout, gitignored dist; commit 9e57088).

Both runtime defects are now guarded (manifest spec for access:public; the bypass-2FA requirement documented in the runbook + memory) so they cannot regress.

## Known follow-ups (not gaps in this plan)

- **0.0.2 = first OIDC steady-state release.** The seed proved release.yml's machinery but used token auth; tokenless OIDC is first exercised at 0.0.2. If it 404s on auth, drop `registry-url` from the `setup-node` step (the empty-`_authToken` trap -- documented inline in release.yml). Tracked in memory `angular-typechecker-release-mechanics`.
- **Staged publishing (npm stage publish, stage-only Trusted Publisher)** -- a stronger future hardening; deferred (needs a workflow change + nx staged-publish support verification).

## Authentication Gates

All present and satisfied by the human: npm account 2FA; the `npm-publish` GitHub Environment required-reviewer approval (clicked per publish); the one-time seed token (now revoked) for the first publish; the npm Trusted Publisher (OIDC) for steady state.

## Self-Check: PASSED

0.0.1 is live on npm with provenance (verified via `npm view`); the Trusted Publisher is registered with "disallow tokens"; the seed token + secret are removed; `release.yml` is OIDC-only (no active `NODE_AUTH_TOKEN`); all referenced commits exist (136f1ac, 689f917, 9d3f7b7, 4708eae, 785c747, 9e57088). PKG-03 execution complete.
