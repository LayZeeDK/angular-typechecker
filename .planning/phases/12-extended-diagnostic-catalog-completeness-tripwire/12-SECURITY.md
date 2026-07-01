---
phase: 12
slug: extended-diagnostic-catalog-completeness-tripwire
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-01
---

# Phase 12 -- Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

This is a TEST / BUILD-TIME-ONLY phase of the angular-typechecker Nx plugin. It adds a
type-level drift tripwire (`*.drift.ts`, `noEmit`, never shipped), an `as const` member
list, a data-driven integration catalog spec, committed Angular fixtures, and a planning-doc
rewrite. There is NO runtime/production code path, no network, no untrusted input, no
auth/crypto/data handling, and NO new dependency. The only "input" is the locked,
lockfile-pinned `@angular/compiler-cli@22.0.4` type declarations consumed at type-check /
test time. Register authored at plan time across all four PLAN.md `<threat_model>` blocks;
verified CLOSED at secure-phase.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| (none new) | Test/build-time-only phase: committed in-repo fixtures + a type-level `noEmit` tripwire fed to the locked, lockfile-pinned `@angular/compiler-cli@22.0.4`; a planning-doc rewrite. No runtime path, no network, no untrusted input, no new dependency. | None (in-repo authored fixtures + locked compiler type declarations only) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-12-01 | Tampering | `extended-catalog.drift.ts` deep-import of `@angular/compiler-cli` types | accept | Type-only, `noEmit`, never ships (the `*.drift.ts` exclude glob keeps it out of lib/spec/tarball); consumes the locked lockfile-pinned compiler. No new threat surface. | closed |
| T-12-02 | Tampering | New committed extended fixtures + `extended-catalog.integration.spec.ts` | accept | Authored-in-repo fixtures fed to the locked compiler at test time only. No runtime path, no untrusted input. | closed |
| T-12-03 | Tampering | New baseline fixtures + baseline spec block + `TESTING.md` count | accept | Authored-in-repo fixtures fed to the locked compiler; a documentation count edit. No runtime path. | closed |
| T-12-04 | Information Disclosure | `.planning/research/DIAGNOSTIC-CATALOG.md` rewrite | accept | Planning-doc rewrite of public Angular diagnostic facts; no secrets, no PII, no prior-art leakage. | closed |
| T-12-SC | Tampering | npm / pip / cargo installs (supply chain) | mitigate | N/A -- this phase installs NO packages. VERIFIED at secure-phase: no `package.json`, `package-lock.json`, or `.npmrc` change across the phase diff (base `83a30ac^..HEAD`). Escalation contract (STOP + `checkpoint:human-verify` on any unexpected dependency) was never triggered. | closed |

*Status: open . closed*
*Disposition: mitigate (implementation required) . accept (documented risk) . transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-12-01 | T-12-01 | Type-level `noEmit` drift file that never ships (excluded from lib/spec/tarball by the `*.drift.ts` glob) and consumes only the locked compiler's type declarations under classic resolution. No exploitable surface. | Lars Gyrup Brink Nielsen | 2026-07-01 |
| R-12-02 | T-12-02, T-12-03 | Deliberately-diagnostic-triggering Angular fixtures are authored in-repo and fed only to the locked compiler at test time; they are not executed as runtime code and accept no external input. | Lars Gyrup Brink Nielsen | 2026-07-01 |
| R-12-03 | T-12-04 | Rewrite of an internal planning doc containing only public Angular compiler facts; no secrets, PII, or prior-art. | Lars Gyrup Brink Nielsen | 2026-07-01 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-01 | 5 | 5 | 0 | gsd-secure-phase (short-circuit: register authored at plan time, threats_open 0; supply-chain mitigation verified against the phase diff) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-01
