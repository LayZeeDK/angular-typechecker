---
phase: 24
slug: real-oss-scaffolded-e2e-additive-only-audit-docs
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-11
---

# Phase 24 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

This phase is VERIFICATION + AUDIT + DOCS: it adds NO production runtime code, no
network endpoints, no auth, and no new shipped dependency. The only network action in
the whole phase is a loopback-gated (`127.0.0.1`) Verdaccio publish in the e2e
global-setup. No `high`+ severity threat exists in the phase surface; every plan-time
threat is `mitigate` or `accept`.

Each mitigation was re-verified INDEPENDENTLY against the actual implementation on
2026-07-11 (this audit run did NOT trust the draft's claims or the code review; it
grepped/read the cited files and located each mitigation by `file:line`). See the
"Independent Verification Evidence" section below. All eight threats resolve CLOSED;
`threats_open: 0`.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| public API barrel (`src/index.ts`) -> downstream consumers | A narrowed/renamed export is a silent breaking change; the drift tripwire guards it | Public type/symbol surface |
| test fixture on disk -> builder eager prelude | `fixtures/builder-context/angular.json` is read by the builder's project-graph prelude; first-party test fixture, not untrusted input | Local fixture config |
| README/CHANGELOG prose -> consumer trust | An over-claimed or softened support statement misleads consumers about what is verified | Documentation claims |
| e2e publish step -> npm registry | The global-setup publishes the built tarball; it MUST be local Verdaccio (`127.0.0.1`), never the public registry | Built package tarball |
| committed fixture -> repository | The fixture ships in git; must contain no secrets/tokens and only first-party pinned Angular deps | Scaffolded workspace |
| tmp install (`ng add`) -> package resolution | Inherited `npm_config_*` (a leaked `legacy-peer-deps`) could mask a real on-stack peer result or retarget the install | npm config env |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-24-01 | Tampering | public barrel / schemas (additive-only regression) | mitigate | `src/index.drift.ts` `tsc --noEmit` tripwire (all 5 barrel exports) wired into `tsconfig.drift.json` + `24-ADDITIVE-AUDIT.md` git-diff audit vs `angular-typechecker@0.2.0` + existing surface-regression/schema-parity guards. Verified: `nx typecheck` (drift) green; version unchanged at 0.2.0. | closed |
| T-24-02 | Spoofing | builder-context fixture resolves the wrong workspace root | mitigate | `TestingArchitectHost` pinned at `fixtures/builder-context/`; the WR-01 hardening asserts the planted `TS2322`/`TS2345` surface (fixture genuinely resolves + type-checks). Verified: `builder.integration.spec.ts` green + non-vacuous. | closed |
| T-24-03 | Information disclosure / Repudiation | README `## Angular CLI` claims (softened/over-claimed/deleted) | mitigate | `src/angular-cli-docs.spec.ts` content tripwire (9 tests) locks the load-bearing claims; the `storybook-docs.spec.ts` "not supported" caveat is preserved (not weakened). Verified green. | closed |
| T-24-04 | Tampering | accidental version/tag cut in a prose-only docs change | mitigate | CHANGELOG is prose-only; `package.json` unchanged (verified 0.2.0); no tag; the Release-PR flow is the sole cut path (AGENTS.md). | closed |
| T-24-05 | Tampering | e2e accidentally publishes to a real registry | mitigate | The global-setup `127.0.0.1`-only publish SAFETY gate copied verbatim (`if (!registryUrl.startsWith('http://127.0.0.1:')) throw`) + the loopback invariant re-asserted in the spec. Verified intact by code review. | closed |
| T-24-06 | Information disclosure | committed fixture ships a secret/token or a peer-masking `.npmrc` | mitigate | Fixture stripped of `node_modules`/`.git`; first-party pinned Angular deps only + committed `package-lock.json`; no fixture `.npmrc` with `legacy-peer-deps`; the Verdaccio `.npmrc` is written to tmp at test time, never committed. Verified: no secret/email/`consensus.dk` leak in phase-new files. | closed |
| T-24-07 | Tampering | inherited npm config masks a real on-stack peer result | mitigate | `buildCleanEnv({ stripAllNpmConfig: true })` strips every `npm_config_*`; the spec asserts the on-stack Angular 22 install needs no `--legacy-peer-deps` flag. Verified intact by code review. | closed |
| T-24-SC | Tampering | supply chain (npm/pip/cargo installs) | accept | No new package enters the SHIPPED plugin; `@angular-devkit/architect/testing` is an already-installed optional peer; the fixture declares canonical first-party Angular 22 devDeps only. See Accepted Risks. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Independent Verification Evidence

Located by grep/read against the working tree on 2026-07-11 (not from the draft or
`24-REVIEW.md`). Every mitigation was found in its cited location.

| Threat ID | What was checked | Located at (file:line) | Verdict |
|-----------|------------------|------------------------|---------|
| T-24-01 | Barrel drift tripwire imports + references all 5 exports (2 value + 3 type-only) | `src/index.drift.ts:21-22` (imports), `:27-28,33,35` (references) | present |
| T-24-01 | Tripwire wired into the drift `tsc --noEmit` target | `tsconfig.drift.json:15` (`"src/index.drift.ts"` in `files`) | present |
| T-24-01 | Barrel under lock exports exactly the 5 names | `src/index.ts:14-19` | present |
| T-24-01 | Additive-only git-diff verdict vs the `0.2.0` tag (barrel UNCHANGED, executor schema WIDEN-ONLY, others unchanged/new-file) | `24-ADDITIVE-AUDIT.md:52-59` | present |
| T-24-01 / T-24-04 | Published `version` unchanged at `0.2.0` | `packages/angular-typechecker/package.json:3` | confirmed |
| T-24-02 | `TestingArchitectHost(fixtureRoot, fixtureRoot)` pinned at `fixtures/builder-context` | `builder.integration.spec.ts:60,85` | present |
| T-24-02 | WR-01 hardening: planted `TS2322`+`TS2345` asserted in captured stdout (not a vacuous `success:false`) | `builder.integration.spec.ts:165-166,189-190` | present |
| T-24-02 | Fixture is a resolvable Angular CLI root declaring the builder + 2-element `tsConfig` | `fixtures/builder-context/angular.json:12-16` | present |
| T-24-03 | Docs tripwire locks the load-bearing `## Angular CLI` claims (9 assertions) | `src/angular-cli-docs.spec.ts:26-83` | present |
| T-24-03 | README carries the auto-wire-all + parity + no-caching + nx-transitive + off-stack claims | `README.md:394-396,417-418,451,456-457,467-468` | present |
| T-24-03 | Storybook "not supported" caveat preserved (not weakened) + coherent deferral | `storybook-docs.spec.ts:67-70`; `README.md:461-463,567-568` | present |
| T-24-04 | CHANGELOG `0.2.1` entry is prose only (no version bump, no link ref) | `CHANGELOG.md:5-32` | present |
| T-24-04 | No `angular-typechecker@0.2.1` git tag exists (latest tag is `@0.2.0`) | `git tag -l` (0.0.1..0.2.0 only) | confirmed |
| T-24-05 | Loopback-only publish SAFETY gate (`if (!registryUrl.startsWith('http://127.0.0.1:')) throw`) | `e2e/.../src/global-setup.ts:118-122` | present |
| T-24-05 | Loopback invariant re-asserted in the spec | `e2e/.../src/ng-add-ng-run.e2e.spec.ts:174` | present |
| T-24-06 | Committed fixture: no `.npmrc`, `package-lock.json` present, no `node_modules`/`.git` | `git ls-files` fixture tree (34 files, none an `.npmrc`) | confirmed |
| T-24-06 | No secret/token committed; only `legacy-peer-deps` hit is a PROHIBITION note | secret grep = NO_SECRET_MATCH; `REGENERATE.md:34` (prohibition only) | confirmed |
| T-24-06 | Fixture declares canonical first-party pinned Angular 22 devDeps only | `fixtures/.../package.json:13-32` | confirmed |
| T-24-07 | `buildCleanEnv({ stripAllNpmConfig: true })` strips every `npm_config_*` | `global-setup.ts:128,130-134`; `ng-add-ng-run.e2e.spec.ts:92` | present |
| T-24-07 | On-stack install asserted with NO `--legacy-peer-deps` (`sh('npm install')` throws on ERESOLVE) | `ng-add-ng-run.e2e.spec.ts:202` | present |
| T-24-SC | No new SHIPPED dep (deps still `@nx/devkit`+`tslib`); `@angular-devkit/architect/testing` already installed as an optional peer | `package.json:49-64`; `node_modules/@angular-devkit/architect/testing` present | confirmed |

Threat-flag reconciliation: no SUMMARY carries a `## Threat Flags` heading; `24-03-SUMMARY.md:145` states "No threat flags." No unregistered attack surface. Mitigations `T-24-05/06/07` map to the disclosed e2e surface. No unregistered flags to log.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-24-01 | T-24-SC | Phase 24 adds no new dependency to the shipped plugin. The only dev-time libraries used (`@angular-devkit/architect/testing`, `@angular/cli`, first-party pinned Angular 22 packages in the committed fixture) are canonical first-party Angular packages, already installed / already optional peers, verified against `registry.npmjs.org` (RESEARCH.md Package Legitimacy Audit — none `[ASSUMED]`/`[SUS]`). Verdaccio proxies upstream at pinned versions. | Lars Gyrup Brink Nielsen | 2026-07-11 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-11 | 8 | 8 | 0 | Claude (gsd-secure-phase; mitigations cross-confirmed by 24-REVIEW.md + 24-VERIFICATION.md) |
| 2026-07-11 | 8 | 8 | 0 | Claude (gsd-security-auditor; INDEPENDENT file-level re-verification -- each mitigation located by grep/read at `file:line`, draft claims NOT trusted; see Independent Verification Evidence) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-11
