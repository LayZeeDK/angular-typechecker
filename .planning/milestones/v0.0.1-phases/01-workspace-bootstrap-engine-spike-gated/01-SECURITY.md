---
phase: 1
slug: workspace-bootstrap-engine-spike-gated
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-27
---

# Phase 1 - Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Verification-only audit. Register authored at plan time (`register_authored_at_plan_time: true`);
> mitigations were VERIFIED present in implemented code/artifacts -- no new-threat scan.
> ASVS L1. block_on: high. Live category: V14 Configuration / Supply-Chain (plus minimal V5, deferred).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| npm registry -> dev machine | `create-nx-workspace@23.0.1` + pinned `@nx/*` / `@angular/*` packages downloaded and executed during scaffold/install | package tarballs + lifecycle scripts (untrusted code) |
| temp sibling dir -> repo root | generated workspace files copied over the live `.git/` (state-preservation hazard) | dotfiles + tracked planning artifacts |
| consumer package.json -> plugin | the plugin's declared peer ranges constrain which compiler-cli/typescript a consumer installs | version-range contract |
| executor (untrusted `tsConfig` path) -> core | the executor's only runtime input is a `tsConfig` path string crossing into `runTypecheck` | filesystem path string |
| core -> ESM compiler-cli | `await import('@angular/compiler-cli')` loads and executes the compiler at runtime | dynamic ESM module load |
| built artifact (untrusted emit) -> GATE A static spec | the spec reads the compiled `.js` from disk and asserts on its bytes | emitted JavaScript |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-01-01 | Tampering | `npx create-nx-workspace` arbitrary code on scaffold | mitigate | Pinned `create-nx-workspace@23.0.1` exact; explicit flags only; built-in `--preset=apps` (no third-party preset; `--trustThirdPartyPreset` default false); full `git status` reviewed at blocking human checkpoint before commit. Root `package-lock.json` pins `nx`/`@nx/devkit` @23.0.1; 01-01-SUMMARY documents the human-verify checkpoint + confirmed flags. | closed |
| T-01-02 | Tampering | Dotfile-copy clobbers/drops tracked files over live `.git/` | mitigate | `.planning/` + `CLAUDE.md` moved aside to a mktemp scratch dir; `--skipGit` + named-subdir generation never touches root `.git/`; post-copy HEAD-unchanged + `git status` no-clobber check at the blocking checkpoint. Linear git history confirmed: `.planning` commits precede bootstrap `ab182b2` whose parent is the captured pre-bootstrap HEAD `4a848a4` (no merges, no rewrite); `.planning/PROJECT.md` + `CLAUDE.md` tracked and present. | closed |
| T-01-03 | Spoofing/Tampering | Slopsquatted / typosquatted dependency | mitigate | All packages are official `nrwl` / `angular` / `microsoft` org packages pinned EXACT (D-15). 01-RESEARCH.md "Package Legitimacy Audit" (lines 128-142) marks every package "Approved (official)"; root `package.json` + lockfile carry exact pins. | closed |
| T-01-04 | Tampering | Wrong / over-broad dependency classification (declaring `nx`, or compiler-cli as a dep) | mitigate | D-14 model present in `packages/angular-typechecker/package.json`: `@nx/devkit` exact-pinned `dependency` `23.0.1`; NO `nx` in deps or peers; `@angular/compiler-cli ^22.0.0` + `typescript >=6.0.0 <6.1.0` as `peerDependencies`. | closed |
| T-01-05 | Tampering | `module: commonjs` ships an `ERR_REQUIRE_ESM` executor | mitigate | `packages/angular-typechecker/tsconfig.json` sets `module: "nodenext"` + `moduleResolution: "nodenext"` (the BLOCKING Plan-02 patch); `tsconfig.lib.json` inherits it (no commonjs re-override). GATE A static backstop (`gate-a-static.spec.ts`) asserts the built emit before GO. | closed |
| T-01-06 | Tampering | Built executor downlevels `import()` to `require()` | mitigate | `gate-a-static.spec.ts` reads the built `.js` via `fs.readFileSync`: positive `/import\(/` on `core/compiler-loader.js`, negative `/require\(["']@angular\/compiler-cli/` on BOTH built files (comment-stripped). Verified built `dist/.../core/compiler-loader.js:19` retains literal `import('@angular/compiler-cli')`; built `executor.js` has no `require('@angular/compiler-cli')`. (Per RESEARCH-ADDENDUM-WAVE3 Finding 2 the `await import()` lives in core, not `executor.js`.) | closed |
| T-01-07 | Information Disclosure | ESM-load failure masquerades as a diagnostic (`UNKNOWN_ERROR_CODE` 500) | mitigate | `runTypecheck` surfaces config errors as the structured result; `gate-b.spec.ts` asserts `not.toContain(500)` and that the run resolves (a failed `await import()` would reject) -- a hidden load failure fails the gate. | closed |
| T-01-08 | Spoofing | Stray workspace import of the error fixture re-introduces TS2322/NG8109 into `ng-spike-app` (TS #36017) | mitigate | `fixtures/gate-b-error/` has NO `project.json` (out of graph) and its own `tsconfig.app.json`/`tsconfig.lib.json` only; excluded in `packages/angular-typechecker/tsconfig.lib.json` (`fixtures/gate-b-error/**/*`); nothing imports it (the lone reference is a path string in `gate-b.spec.ts:36`, not a module import). `nx show projects` = `[angular-typechecker, ng-spike-app]`; `ng-spike-app` builds green. | closed |
| T-01-10 | Information Disclosure | A masked ESM-load failure (`UNKNOWN_ERROR_CODE` 500) is mistaken for a passing GATE B run | mitigate | `gate-b.spec.ts:82` asserts `expect(allCodes).not.toContain(UNKNOWN_ERROR_CODE)` (500) per `describe.each` case, and both runs resolve (no `ERR_REQUIRE_ESM`). | closed |
| T-01-11 | Tampering | A comment containing `import(` false-passes the GATE A regex | mitigate | `gate-a-static.spec.ts` `stripCommentLines()` removes `//` / `*` / `/*` comment lines before matching, AND asserts the `require('@angular/compiler-cli')` NEGATIVE on both built files as an independent second check. | closed |
| T-01-12 | Repudiation | A NO-GO gate result silently advanced to Phase 2 | mitigate | 01-04-SUMMARY.md records an explicit per-item GO/NO-GO ledger against all six checklist items (verdict GO with reproduced diagnostic-code evidence); the ROADMAP GATED note blocks Phase 2 on criteria 2 and 3. | closed |
| T-01-SC | Tampering | npm installs / supply chain | accept | EXACT pins; `--nxCloud=skip`; official packages only; no new packages and no postinstall scripts introduced by our code; resolves from the locked `package-lock.json`. Residual risk LOW (V14). Documented in Accepted Risks Log. | closed |
| T-01-09 | Elevation of Privilege | Executor input validation absent (V5) | accept | Phase-1 input is a single `tsConfig` path normalized by `readConfiguration`; full schema validation / normalize-options DEFERRED to Phase 4 (EXE-01). LOW risk for an in-repo spike. Documented in Accepted Risks Log. | closed |

*Status: open - closed*
*Disposition: mitigate (implementation required) - accept (documented risk) - transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01-SC | T-01-SC | Supply-chain exposure during npm scaffold/install. Mitigated to LOW (V14): EXACT version pins (root + lockfile), `--nxCloud=skip` avoids onboarding network calls, official `nrwl`/`angular`/`microsoft` packages only (01-RESEARCH.md Legitimacy Audit, all "Approved"), no new packages and no postinstall scripts introduced by this project's code; installs resolve from the locked `package-lock.json`. Residual risk accepted for a v0.0.1 in-repo spike; `@nx/dependency-checks` enforcement lands in Phase 3 (WS-04). | gsd-security-auditor (verification) | 2026-06-27 |
| AR-01-09 | T-01-09 | Executor input validation absent (V5). Phase-1 executor input is a single `tsConfig` path normalized by the Angular compiler's `readConfiguration`; full schema validation / normalize-options is intentionally DEFERRED to Phase 4 (EXE-01). LOW risk for an in-repo spike with no untrusted external callers. | gsd-security-auditor (verification) | 2026-06-27 |

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Flags

None. The four SUMMARY files carry no `## Threat Flags` section; their `## Threat model dispositions` notes map only to already-registered IDs (T-01-06/07/08/09/10/11/12/SC). No new attack surface appeared during implementation that lacks a threat mapping.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-27 | 12 | 12 | 0 | gsd-security-auditor |

Verification method: each `mitigate` threat verified by locating the declared mitigation in the cited code/artifact (tsconfig values, package.json dependency model, gate spec assertions, built `dist` bytes via `rg -uu`, git history linearity); each `accept` threat recorded in the Accepted Risks Log above. No implementation files modified.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-27
