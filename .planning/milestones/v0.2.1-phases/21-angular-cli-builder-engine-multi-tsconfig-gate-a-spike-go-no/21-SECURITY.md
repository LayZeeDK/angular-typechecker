---
phase: 21
slug: angular-cli-builder-engine-multi-tsconfig-gate-a-spike-go-no
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-10
---

# Phase 21 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Angular CLI builder (`convertNxExecutor` re-export) + engine multi-tsconfig (`tsConfig`
> `string | string[]`) + GATE A' real-`ng run` bridge spike. Register authored at plan
> time; each mitigation VERIFIED present in the implemented code below.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Angular CLI (`ng run`) -> builder options | Consumer-supplied `tsConfig`/flags cross into the builder via Architect's schema validator | `tsConfig` (string or array), `includeDeps`, `maxWarnings`, `failFast`, `strict` |
| Consumer options -> engine | `tsConfig` (now `string | string[]`) crosses into `normalize-options` + the core | tsconfig path(s), boundary/verdict knobs |
| Plugin manifest -> Nx executor loader | The additive `builders` field must not change what Nx resolves (`executors ?? builders`) | package.json `executors`/`builders` fields, executors.json |
| Local dev machine -> npm registry + external clone | The GATE A' spike packs a dist tarball and `npm install`s it into an out-of-repo clone (drags `nx` transitively) | built tarball, transitive `nx`, `.nx/` dir |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-21-01 | Tampering (Input Validation, V5) | builder `schema.json` option surface | mitigate | Sanitized builder schema keeps `additionalProperties:false` + `required:["tsConfig"]`; engine requires an absolute tsconfig path, never reads `process.cwd()`; Architect rejects unknown options. VERIFIED: `src/builders/typecheck/schema.json:34-35`; `src/executors/typecheck/normalize-options.ts:53-58`; `src/core/run-typecheck.ts:278-300` (no `process.cwd()` call — only the `never reads process.cwd()` doc invariant at line 276 / normalize-options.ts:35). | closed |
| T-21-02 | Tampering/Elevation (Supply chain, V14) | packed dist tarball + transitive `nx` install into the clone | mitigate | No NEW shipped dependency (`convertNxExecutor` is in pinned `@nx/devkit@23.0.1`); tarball-content audit asserts builders.json + builder.js + schema.json are built artifacts; the `nx`-transitive + `.nx/` dir is a documented tradeoff cleaned up by the harness; clone never committed. VERIFIED: `package.json:44-51` (deps = `@nx/devkit@23.0.1` + `tslib`, peers unchanged, no new dep); `forensic-log.json` assertions `tarball-builder-js`/`tarball-builder-schema`/`tarball-builders-json` all pass; `cloneGitStatusAfter: "(clean)"`. | closed |
| T-21-03 | Repudiation (false PASS) | the bridge under `ng run` | mitigate | GATE proves real diagnostics FLOW (planted error RED, clean GREEN); `UNKNOWN_ERROR_CODE` (500) re-thrown as `TypecheckInfrastructureError` carries through the builder unchanged. VERIFIED: `forensic-log.json` `app-planted-red` (exit 1), `app-baseline-green` (exit 0), `lib-clean` (exit 0), `verdict: GO`; `src/core/run-typecheck.ts:181-195` (`throwIfInfrastructureFailure`); builder is a thin re-export of the same executor (`src/builders/typecheck/builder.ts:21`). | closed |
| T-21-04 | Tampering (Input Validation, V5) | `tsConfig` array entries | mitigate | Schema `oneOf` with `array.items.type:string` + `minItems:1`; normalize-options resolves each entry to an absolute path via `joinPathFragments`; core still requires absolute paths, never reads `process.cwd()`. VERIFIED: `src/executors/typecheck/schema.json:10-16` + `src/builders/typecheck/schema.json:7-13` (`oneOf`, `minItems:1`); `src/executors/typecheck/normalize-options.ts:53-58` (`resolveOne` mapped over entries). | closed |
| T-21-05 | Repudiation (false PASS via array aggregation) | `handleMultiTsConfig` union/finalize | mitigate | Single `finalize` over the COMBINED input set (never per-entry); per-entry 500 re-throws as `TypecheckInfrastructureError`; zero-rootNames entry feeds coverage-incomplete, never a silent pass; empty array throws infra. VERIFIED: `src/core/run-typecheck.ts:682-695` (exactly ONE `finalize` over `rawDiagnostics` union with `combinedRootNamePaths`), `:627`+`:676` (per-entry + union 500 re-throw), `:638-645` (zero-rootNames `SkippedReference`), `:666-671` (empty-array infra throw); proven by `src/core/multi-tsconfig.integration.spec.ts` + `fixtures/multi-tsconfig-array/`. | closed |
| T-21-06 | Tampering (fixture integrity) | committed fixtures | mitigate | New hermetic fixture only (`fixtures/multi-tsconfig-array`); committed fixtures never mutated. VERIFIED: `git show 76330dc -- fixtures/` = 4 files ADDED under `multi-tsconfig-array` only, 63 insertions, no deletions/modifications of any pre-existing fixture. | closed |
| T-21-07 | Tampering (Input Validation, V5) | builder schema drift | mitigate | `schema-parity.spec` locks the builder option surface to `TypecheckExecutorOptions` (keys, required, `additionalProperties:false`, defaults, `oneOf`) and asserts sanitization (no `cli`/`version`/`$id`). VERIFIED: `src/builders/typecheck/schema-parity.spec.ts` — `EXPECTED_KEYS` bound via `satisfies` + `AssertAssignable` reverse probe (:49-68), `required` == `['tsConfig']` (:75-77), `additionalProperties === false` (:79-81), `not.toHaveProperty('cli'|'version'|'$id')` (:83-87), `oneOf` string+array assertion (:102-114). | closed |
| T-21-08 | Repudiation (silent Nx-surface regression) | package.json `builders` field vs `executors` resolution | mitigate | `nx-surface-regression.spec` asserts `executors` present + unchanged so `executors ?? builders` never reads builders.json; `nx run <project>:typecheck` stays resolvable. VERIFIED: `src/builders/typecheck/nx-surface-regression.spec.ts` — `executors === './executors.json'` (:42-44), `builders === './builders.json'` (:46-48), `executors.json` still declares `typecheck` implementation (:50-54). | closed |
| T-21-09 | Tampering (engine fork) | builder.ts | mitigate | Thin-wrapper source assertion fails if builder.ts stops being the exact `convertNxExecutor(typecheckExecutor)` re-export — forbids a hand-written architect builder (D-04). VERIFIED: `src/builders/typecheck/builder.spec.ts` — source regex for `convertNxExecutor` import (:37-41), executor-default import (:43-47), `export default convertNxExecutor(typecheckExecutor)` (:49-53), + runtime Architect-brand assertion (:55-64). | closed |
| T-21-SC | Tampering (Supply chain) | no npm/pip/cargo install of a NEW package in this phase | accept | RESEARCH Package Legitimacy Audit: no new shipped deps; the only install is our own built tarball into the clone; slopcheck clean; no blocking legitimacy checkpoint required. See Accepted Risks Log. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-21-01 | T-21-SC | No NEW shipped dependency is added in Phase 21 — `convertNxExecutor` ships in the already-pinned `@nx/devkit@23.0.1` (verified: `package.json` deps = `@nx/devkit@23.0.1` + `tslib`; peers unchanged). The GATE A' spike's only install is the phase's own built tarball into an out-of-repo clone; the transitive `nx` install + `.nx/` dir are an expected, documented tradeoff cleaned up by the harness (`forensic-log.json` `cloneGitStatusAfter: "(clean)"`). slopcheck clean; no `[ASSUMED]`/`[SUS]` packages, so no blocking-human legitimacy checkpoint is required. | gsd-security-auditor (plan-time disposition `accept`) | 2026-07-10 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-10 | 10 | 10 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-10
