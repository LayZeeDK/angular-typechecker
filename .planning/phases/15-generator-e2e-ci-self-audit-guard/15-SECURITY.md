---
phase: 15
slug: generator-e2e-ci-self-audit-guard
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-02
---

# Phase 15 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Phase 15 is a testing + CI-config phase — it changed NO production/runtime source.
> The attack surface is confined to test-harness `execSync` calls, the tarball install
> honesty controls, and a read-only CI-config guard. All six plan-time threats
> (T-15-01..06) are verified CLOSED against the committed implementation.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| dev workspace -> nested nx/npm subprocess (tmp consumer) | The GE2E specs shell out (`execSync`) to `nx`/`npm` inside per-scenario tmp workspaces | Fixed literal target ids + flags only; injected source lines built via `JSON.stringify` — no untrusted/PR-metadata input crosses |
| public registry -> tmp install | The tmp `npm install` resolves the fixture's Angular/Nx/TS deps from the public registry | The PACKAGE UNDER TEST comes from the LOCAL freshly-packed tarball; only already-vetted fixture deps come from the registry |
| guard spec -> repo-root config files | GUARD-01 reads `.github/workflows/ci.yml` + `e2e/*/project.json` from the repo root | Read-only; no untrusted external input; the guard asserts, never edits |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-15-01 | Tampering | `execSync` in `generator-e2e`/`nx-add-e2e` specs | mitigate | Fixed literal target ids (`consumer-generator:typecheck`, `angular-typechecker:configuration`/`:init`) + fixed flags only; injected lines + tarball path via `JSON.stringify`; no untrusted string reaches the shell (`generator-e2e.int.spec.ts:51-52,162-165,227,251-254`; `nx-add-e2e.int.spec.ts:174,184`) | closed |
| T-15-02 | Tampering (V14 supply-chain honesty) | tmp install of the tarball | mitigate | Honesty controls: empty `.npmrc` in tmp + `npm_config_userconfig` -> non-existent path + peer-override env keys deleted + no `--legacy-peer-deps`, so a real consumer ERESOLVE surfaces instead of being masked (`generator-e2e.int.spec.ts:106-107,222,229`; `nx-add-e2e.int.spec.ts:81-82,157,176`) | closed |
| T-15-03 | Elevation | postinstall/lifecycle script in the shipped tarball (s1ngularity vector) | mitigate | `tarball-audit.int.spec.ts` no-install-scripts guard (preinstall/install/postinstall/prepare/prepublish `toBeUndefined()` on the REAL extracted `package/package.json`, `:64-70,253-262`) remains byte-unchanged; D-13 additions are append-only to `REQUIRED_FILES`; shipped `packages/angular-typechecker/package.json` declares no `scripts` field | closed |
| T-15-04 | Repudiation | the guard silently false-PASSing (defeats its purpose) | mitigate | MANDATORY deliberate-RED proof performed + recorded in `15-01-SUMMARY.md:86-102` (phantom `e2e/phantom-e2e` -> LOCATED RED message -> restored to green, tree clean); committed guard is structurally non-vacuous — bidirectional per-element `toContain` with located messages + `toEqual` backstop over real fs/ci.yml sets (`ci-e2e-coverage-guard.spec.ts:100-120`) | closed |
| T-15-05 | Elevation | the guard editing `ci.yml` (privilege change to the required gate) | mitigate | The guard imports ONLY `readFileSync, readdirSync` and makes only read calls (`ci-e2e-coverage-guard.spec.ts:1,35,39,93`); no `writeFileSync`/`rmSync`/`appendFileSync`, no `child_process`/`execSync` — it asserts, never edits; no `ci.yml` structural change | closed |
| T-15-06 | Tampering | extraction mis-reading the wrong `-p` (the mid-line `test`-job `-p angular-typechecker`) | mitigate | Job-scope to the `e2e:` block (`/^  e2e:\s*$/` + job-key regex `/^  [a-z0-9-]+:\s*$/` allowing the `2` digit) + line-start folded-scalar match `/^\s*-p\s+\S/` (`ci-e2e-coverage-guard.spec.ts:59,70,77`); the mid-line `test`-job `-p` is both outside the slice and non-line-start, so it cannot be captured (belt-and-suspenders) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|

No accepted risks — all threats mitigated in code.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-02 | 6 | 6 | 0 | gsd-security-auditor (opus) |

Notes: register authored at plan time (both PLANs carried a `<threat_model>` block) — the auditor verified each mitigation exists rather than scanning for new threats. Neither SUMMARY declared a `## Threat Flags` section; no unregistered attack surface appeared. No new secrets, permissions, workflow-permission changes, or dependencies were introduced; the single required `ci` gate stays byte-unchanged. Package Legitimacy Gate not applicable — the phase installs the LOCAL tarball and resolves already-vetted deps.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (none)
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-02
