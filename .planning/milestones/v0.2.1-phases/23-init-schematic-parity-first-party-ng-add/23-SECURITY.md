---
phase: 23
slug: init-schematic-parity-first-party-ng-add
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-11
---

# Phase 23 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Verified by gsd-security-auditor (opus) against the working-tree implementation,
including the post-code-review fixes WR-01 (`angular.json && !nx.json`
discriminator), WR-02 (widened `@angular-devkit/architect` + `rxjs` optional
peer ranges), and WR-03/IN-01 (`ng-add --project` fails loud + notice gated on
wired>0). Register was authored at plan time across 23-01/02/03
(`register_authored_at_plan_time: true`) — the audit VERIFIED mitigations exist;
it did not scan for new threats.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| `ng add` / `ng generate` invocation -> schematic writes | CLI flags + workspace `angular.json` / `package.json` / `nx.json` read, per-project targets + devDependency classification written via the virtual `Tree`. No network, no secrets, no user-code execution. | Workspace config JSON (non-sensitive). ASVS L1 config-write-correctness + dependency-hygiene. |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-23-06 | Tampering | `init` generator seeding a stray `nx.json` on an Angular CLI workspace | mitigate | `init/generator.ts:84-88` fork `if (tree.exists('angular.json') && !tree.exists('nx.json')) { logger.info(NO_CACHING_NOTICE); return; }` returns before `readNxJson`/`updateNxJson`. Proof: `init-angular-cli.spec.ts` (`nx.json===false`) + WR-01 hybrid-lock test. | closed |
| T-23-05a | Tampering | `init` schematic registration silently changing the Nx `nx add`/`nx g` surface | mitigate | `generators.json` still declares `init`; `collection.json` declares the `init` schematic; Nx `generators ?? schematics` keeps the collection invisible. Proof: `nx-generators-surface-regression.spec.ts`. | closed |
| T-23-02 | Tampering | angular-typechecker classified as a production `dependency` (wrong for a dev-only type-checker) | mitigate | `package.json` `"ng-add": { "save": "devDependencies" }`; Plan-03 defensive tree move backstops. Proof: `package-manifest.spec.ts`. | closed |
| T-23-07 | Tampering | `@nx/dependency-checks` autofix rewriting the PUBLIC peer ranges to installed exacts | mitigate | `eslint.config.mjs` `checkVersionMismatches: false` + hand-added `ignoredDependencies: ['@angular-devkit/architect','rxjs']`; never `eslint --fix` the manifest. Public ranges intact post-WR-02: architect `>=0.2200.0 <0.2300.0`, rxjs `^6.5.3 || ^7.4.0` (not installed exacts). Proof: `package-manifest.spec.ts`. | closed |
| T-23-08 | Information Disclosure / Tampering | declaring `nx` explicitly double-constrains the consumer's Nx | mitigate | `nx` absent from `dependencies` (only `@nx/devkit` + `tslib`) and `peerDependencies`; transitive-pull consequence documented in `eslint.config.mjs`. | closed |
| T-23-01 | Tampering | wiring a `typecheck` target into a wrong project (non-app/lib, or a name collision) | mitigate | Strict `projectType in {application, library}` filter in `ng-add/generator.ts`; WR-03 throw when `--project` matches nothing; inherited collision-by-builder-id throw in `configuration/generator.ts`. Proof: `ng-add.spec.ts`. | closed |
| T-23-02b | Tampering | angular-typechecker left in `dependencies` on the install-skipped edge | mitigate | Defensive `updateJson` deps->devDeps move in `ng-add/generator.ts`. Proof: `ng-add.spec.ts`. | closed |
| T-23-03 | Tampering | redundant `npm install` from a returned `GeneratorCallback` (lockfile churn) | mitigate | `ngAddGenerator` returns `Promise<void>`; no `addDependenciesToPackageJson` / `installPackagesTask` / `GeneratorCallback` (grep-verified absent). | closed |
| T-23-04 | Denial of Service (bad UX) | malformed `angular.json` / missing project / unresolvable leaves | mitigate | `configuration/generator.ts` throws clear located errors; leaves are existence-probed; RF-02 no-`angular.json` guard in `ng-add/generator.ts`. Proof: `ng-add.spec.ts`. | closed |
| T-23-05 | Tampering | `ng-add` registered where Nx sees it -> changes `nx add` | mitigate | `ng-add` in `collection.json` ONLY, absent from `generators.json`. Proof: `nx-generators-surface-regression.spec.ts` asserts both. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-23-SC | T-23-SC (Plans 01/02/03) | Phase 23 installs no external packages. `@angular-devkit/architect` and `rxjs` are declared as OPTIONAL peerDependencies (consumer-provided, canonical first-party Angular/RxJS packages already present in any Angular CLI workspace), not added to `dependencies`. No new runtime dependency added, so no package-legitimacy checkpoint is required. | Lars Gyrup Brink Nielsen | 2026-07-11 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-11 | 11 | 11 | 0 | gsd-security-auditor (opus) |

*11 unique threats (10 mitigate + 1 accept); 13 register rows counting the per-plan T-23-SC repeats.*

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-11
