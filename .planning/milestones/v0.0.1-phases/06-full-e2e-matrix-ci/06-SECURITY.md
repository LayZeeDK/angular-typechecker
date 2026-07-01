---
phase: 06-full-e2e-matrix-ci
audit: security
asvs_level: 1
security_block_on: HIGH
threats_open: 0
threats_total: 8
threats_closed: 8
date: 2026-06-29
---

# Phase 6 -- Security Threat Verification

**Phase:** 6 -- Full e2e Matrix + CI
**ASVS Level:** 1 (block on HIGH)
**Threats Closed:** 8/8
**Open above HIGH:** 0

Phase 6's attack surface is supply-chain + CI-workflow hardening (NOT application
input handling). The audit verifies that every declared mitigation in the
`06-04-PLAN.md` / `06-05-PLAN.md` `<threat_model>` registers (cross-referenced with
RD-06/07/08/09 and `06-RESEARCH.md` Security Domain) is PRESENT in the implemented
code -- proven by grep/diff against the actual files, not by documentation or intent.

Verdict: every declared mitigation is present. `release.yml`'s additive `if:` ref
gate (06-04) was confirmed -- by commit diff -- to be the ONLY material change, and
it does NOT weaken the frozen OIDC model. The `release-hygiene` regression spec is
the standing backstop for that envelope.

## Threat Verification (PLAN `<threat_model>` registers + checklist)

| #   | Threat ID                                                                       | Category               | Disposition | Status  | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------- | ---------------------- | ----------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Least privilege (V4) / T-06-05-04                                               | Elevation              | mitigate    | COVERED | `.github/workflows/ci.yml:27-28` top-level `permissions: { contents: read }`; NO job re-grants any permission (grep for `id-token`/`write` in active config returns matches only in the comment header lines 10-11)                                                                                                                                                                                                                                                                                                   |
| 2   | No command-injection vector (V5) / T-06-05-01                                   | Elevation / Tampering  | mitigate    | COVERED | `ci.yml:23` trigger is `pull_request: {}` (NEVER `pull_request_target` -- grep returns none); the only `${{ }}` in any `run:` step is the boolean gate expr `ci.yml:137`; all interpolations (`ci.yml:31,42,61`) are trusted GitHub/matrix context, no PR title/branch/body                                                                                                                                                                                                                                           |
| 3   | SHA-pinned actions (V14) / T-06-05-02 / T-06-05-SC                              | Tampering              | mitigate    | COVERED | every `uses:` is a full 40-char SHA: checkout `93cb6efe...` (`ci.yml:56,75,97,113`), setup-node `a0853c24...` (`ci.yml:59,78`), pnpm/action-setup `008330...` (`ci.yml:82`); act pinned `v0.2.89` (`ci.yml:100-102`); actionlint pinned `1.7.7` (`ci.yml:118`); Dependabot `github-actions` ecosystem (`dependabot.yml:7`)                                                                                                                                                                                            |
| 4   | persist-credentials false (V14) / T-06-05-03                                    | Information Disclosure | mitigate    | COVERED | every one of the 4 checkout steps carries `persist-credentials: false` immediately after: `ci.yml:58, 77, 99, 115` (one per checkout at lines 56/75/97/113)                                                                                                                                                                                                                                                                                                                                                           |
| 5   | act-compat is container-free                                                    | Tampering              | mitigate    | COVERED | `tools/act/act-compat.sh:28` `set -euo pipefail`; only `act --validate` (`:86`) + `act -n --pull=false` (`:58`) -- NEVER plain `act <event>` execution; no nested privileged Docker. The 4 event JSONs (`tools/act/events/{pull_request,push-main,push-tag,workflow_dispatch}.json`) carry only `pull_request`/`ref`/`inputs` scaffolding -- zero secrets                                                                                                                                                             |
| 6   | e2e installs only THIS repo's tarball / T-06-05-05                              | Tampering / Elevation  | accept      | COVERED | `npm pack --json` from local dist -> install local `.tgz` only: `matrix-5types.int.spec.ts:192` `npm install <tarballPath>`; `pnpm-symlink.int.spec.ts:176` `pnpm add <tarballPath> ... --ignore-scripts`. Both wipe inherited `.npmrc` (`:185`/`:159`) + redirect `npm_config_userconfig` to a nonexistent path; no third-party registry fetch for the package under test. Phase-5 PKG-02 audit asserts no install scripts. Accepted risk logged below                                                               |
| 7   | release.yml unchanged except `if:` gate (OIDC intact) / T-06-04-01 / T-06-04-02 | Elevation / Tampering  | mitigate    | COVERED | `git show dc740ab` proves the 06-04 change is exactly one comment block + `if: startsWith(github.ref, 'refs/tags/angular-typechecker@')` (`release.yml:54`) at publish-job level. Full active-config invariant scan PASSES: id-token:write only (`:47`), no `contents: write`, no `NODE_AUTH_TOKEN`, contents:read top-level (`:33-34`), `environment: npm-publish` (`:43`), `registry-url` retained (`:69`), `NPM_CONFIG_PROVENANCE: true` (`:86`), no `pull_request_target`. The `if:` is additive, NOT a weakening |
| 8   | No secrets in ci.yml                                                            | Information Disclosure | mitigate    | COVERED | no `registry-url` in `ci.yml` (grep none); no active secret/token env (only match is comment line 11); the test/e2e/act-compat/lint-workflows/ci jobs declare none                                                                                                                                                                                                                                                                                                                                                    |

## STRIDE Register Cross-reference (per-PLAN)

### 06-04-PLAN `<threat_model>`

| Threat ID  | Category                                                              | Disposition | Status  | Evidence                                                                                                                                                                                                                                                                       |
| ---------- | --------------------------------------------------------------------- | ----------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-06-04-01 | Elevation -- publish fires on a non-tag ref if a trigger is broadened | mitigate    | COVERED | `release.yml:54` `if: startsWith(github.ref, 'refs/tags/angular-typechecker@')` -- publish job unreachable unless ref is a release tag, independent of `on:`                                                                                                                   |
| T-06-04-02 | Tampering -- a careless edit silently weakens the OIDC model          | mitigate    | COVERED | the change is a single job-level `if:` line (commit `dc740ab` diff); the `release-hygiene.int.spec.ts` regression spec (lines 112-207) asserts every invariant (SHA pins, no token, no contents:write, registry-url retained, no pull_request_target) -- the standing backstop |

### 06-05-PLAN `<threat_model>`

| Threat ID  | Category                                                        | Disposition | Status  | Evidence                                                                                                                                                                                                       |
| ---------- | --------------------------------------------------------------- | ----------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-06-05-01 | Elevation/Tampering -- untrusted PR field into a privileged run | mitigate    | COVERED | `ci.yml:23` `pull_request` (not `_target`); `ci.yml:27-28` `contents: read`; no PR field interpolated into any `run:` (fixed ids/flags only -- `ci.yml:64,86-88,105,121`)                                      |
| T-06-05-02 | Tampering -- mutable action tag repointed                       | mitigate    | COVERED | all `uses:` 40-char SHA (`ci.yml:56,59,75,78,82,97,113`); act `v0.2.89`; actionlint `1.7.7`; Dependabot lockstep (`dependabot.yml:7`)                                                                          |
| T-06-05-03 | Information Disclosure -- persisted checkout credential         | mitigate    | COVERED | `persist-credentials: false` on all 4 checkouts (`ci.yml:58,77,99,115`)                                                                                                                                        |
| T-06-05-04 | Elevation -- over-privileged CI token                           | mitigate    | COVERED | top-level `contents: read` (`ci.yml:27-28`); no `registry-url`/`NODE_AUTH_TOKEN` in active config                                                                                                              |
| T-06-05-05 | Tampering -- malicious tarball postinstall in CI                | accept      | COVERED | local `npm pack` -> install local `.tgz` only (`matrix-5types.int.spec.ts:192`, `pnpm-symlink.int.spec.ts:176`); pnpm uses `--ignore-scripts`; Phase-5 PKG-02 = no install scripts; accepted risk logged below |
| T-06-05-SC | Tampering -- act/actionlint binary downloads                    | mitigate    | COVERED | act pinned `v0.2.89` (`ci.yml:102`); actionlint pinned `1.7.7` (`ci.yml:118`); surrounding actions SHA-pinned; both run container-free (no nested Docker)                                                      |

## Accepted Risks Log

- **T-06-05-05 (accept) -- malicious tarball postinstall in CI.** The matrix-e2e
  fixtures install only THIS repo's freshly-`npm pack`-ed tarball (no third-party
  registry fetch for the package under test); the Phase-5 PKG-02 audit asserts the
  package declares no install scripts, and the pnpm spec additionally passes
  `--ignore-scripts`. Residual risk is the standard public-registry transitive
  dependency tree (Angular 22 + Nx 23) that any consumer install pulls -- this is
  the inherent baseline, not new Phase-6 attack surface. Accepted at ASVS L1 for a
  CI/test gate. Evidence: `matrix-5types.int.spec.ts:192`,
  `pnpm-symlink.int.spec.ts:176`.

## Unregistered Flags

None. No new attack surface appeared during implementation that lacks a threat
mapping. The `tools/act/**` + `.actrc` dev/CI tooling is excluded from the published
`files` whitelist (it does not reach the tarball), and the act suite is
validation/dry-run only -- it never executes the publish job and never touches
OIDC/secrets.

## Verification Method Notes

- All implementation files were treated READ-ONLY; no source was patched.
- `release.yml` integrity confirmed both by an active-config (comment-stripped)
  invariant scan AND by `git show dc740ab` (the 06-04 commit diff) -- the `if:` gate
  is the sole material change.
- "Least privilege" / "no secrets" verified by grepping for `write`/`id-token`/
  `registry-url`/`NODE_AUTH_TOKEN`/`secret` in `ci.yml` active config -- the only
  matches are inside the threat-model comment header (lines 10-11), not config.
- `persist-credentials: false` verified per checkout (4 checkouts, 4 matches), not
  by a single grep hit -- the mitigation applies to EVERY entry point.

**threats_open (above HIGH): 0** -- phase clears the security gate.
