---
phase: 18
slug: packaged-tarball-e2e-docs
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-06
---

# Phase 18 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (all 5 PLAN.md files carry a `<threat_model>` block);
> this audit VERIFIED each `mitigate` disposition against the shipped implementation and
> recorded each `accept` disposition as a documented low-risk. No new-threat scan performed
> (register is complete). Surface is minimal: a test-fixture-only Storybook install, an
> advisory that names only the consumer's own declared files, and prose-only docs edits.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| consumer tsconfig -> core (D-01 detector) | The detector reads paths/globs already parsed by `readConfiguration` / `ts.parseJsonConfigFileContent` via `ts.sys`. No new external input crosses; no filesystem writes. | Consumer's own tsconfig-declared file paths |
| committed fixtures -> cold compiler | Integration specs compile committed, reviewed in-repo fixtures via `runTypecheck`. No network, no untrusted input. | In-repo fixture source |
| npm registry / local Verdaccio -> throwaway tmp workspace (e2e) | The e2e installs a pinned test-fixture package (`@storybook/angular@10.4.6`) and the freshly-published angular-typechecker dist into a `mkdtemp` workspace removed by `removeTmpDir`. | Published tarball + pinned fixture dep |
| (none) for docs (18-05) | Prose-only edits to README / CHANGELOG / a planning todo. | none |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-18-01-I | Information disclosure | executor.ts D-01 notice | mitigate | Advisory `logger.warn` names ONLY `result.notTypeCheckedDeclaredFiles` (the consumer's own declared paths), never dependency error text — same isolation rule as `suppressedInGraphFiles`. VERIFIED by code review (a82df5) + `notTypeCheckedDeclaredFiles` never enters `evaluate-result.ts`. | closed |
| T-18-01-T | Tampering (V5 input) | detect-unchecked-declared.ts | accept | Reads already-parsed tsconfig paths/globs via `ts.sys`; no new untrusted input, no writes. Low-value target. Documented accepted risk. | closed |
| T-18-02-T | Tampering (V12 files) | integration fixtures | accept | Committed, reviewed source compiled in-process; no untrusted input. Low risk. Documented accepted risk. | closed |
| T-18-03-T | Tampering (V12 files) | T11 fixtures | accept | Committed, reviewed fixtures compiled in-process; no untrusted input. Low risk. Documented accepted risk. | closed |
| T-18-04-SC | Tampering / Elevation (supply chain) | `@storybook/angular@10.4.6` force-install | mitigate | TEST-FIXTURE ONLY (never a product dependency — plugin ships zero Storybook coupling). Version-pinned; pre-vetted across spikes 006-008; on npm (18-RESEARCH Package Legitimacy Audit -> Approved). `--legacy-peer-deps` scoped to Storybook ONLY; installed into a throwaway tmp workspace (`removeTmpDir`). VERIFIED in `storybook-tarball.int.spec.ts` + green e2e run. | closed |
| T-18-04-S | Spoofing (registry) | Verdaccio resolution | mitigate | `buildCleanEnv({ stripAllNpmConfig: true })` + `expect(verdaccioUrl.startsWith('http://localhost:')).toBe(true)` (spec line 156) ensure resolution is from local Verdaccio, not a public proxy. VERIFIED in the spec. | closed |
| T-18-04-B03 | Tampering (masked ERESOLVE) | angular-typechecker install | mitigate | OUR tarball installed with NO peer-resolution override + a nonexistent `npm_config_userconfig`, so a real ERESOLVE on our published peers surfaces (B-03 honesty). VERIFIED by code review + spec. | closed |
| T-18-05-I | Information disclosure | public CHANGELOG | mitigate | Curated scopes; no internal plan-id (`NN-NN`) leaks into the public `## 0.1.2` changelog section. VERIFIED (`awk` scan of the 0.1.2 section returns no `18-0N` / `NN-NN:` scope — only the release date `2026-07-06`). | closed |
| T-18-05-R | Repudiation (accidental release) | CHANGELOG / package.json | mitigate | PROSE ONLY (D-05): package version unchanged (`0.1.1`) and no `angular-typechecker@0.1.2` tag — no accidental release cut. VERIFIED (verifier D-05 check + re-confirmed). | closed |

*Status: open · closed*
*Disposition: mitigate (implementation verified) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-18-01 | T-18-01-T | Detector reads only already-parsed, in-project tsconfig paths via `ts.sys`; no untrusted input, no writes. Negligible attack surface. | Lars Gyrup Brink Nielsen | 2026-07-06 |
| AR-18-02 | T-18-02-T, T-18-03-T | Integration fixtures are committed, reviewed in-repo source compiled in-process; no network or untrusted input. | Lars Gyrup Brink Nielsen | 2026-07-06 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-06 | 9 | 9 | 0 | Claude (gsd-secure-phase; mitigations cross-verified against code review a82df5 + verification + e2e run) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-06
