---
phase: 8
slug: correctness-completeness-fixes
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-29
---

# Phase 8 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

This phase ships correctness/completeness fixes to a no-emit, no-network, no-auth,
no-PII static Angular type-checker engine run in CI / dev / agent loops. The realistic
threat surface is narrow: the only meaningful security property is that the tool must
NOT lie about safety — it must never report a crash as clean or as a plain type error,
never drop a real diagnostic, and never mislabel infrastructure-vs-type. The threat
register below was authored at plan time (`register_authored_at_plan_time: true`); this
audit VERIFIES each declared mitigation exists in the implemented code (no new-threat
scan). Every mitigation was confirmed by reading the cited source — not by trusting the
SUMMARY / VERIFICATION / REVIEW documents.

---

## Trust Boundaries

| Boundary                                                                | Description                                                                                                                                                                                   | Data Crossing                                                                                                               |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| consumer tsconfig path -> engine                                        | The only "input" is the tsconfig path the consumer wires via the Nx target. No network, no auth, no PII, no untrusted user input.                                                             | A filesystem path (string) controlled by the workspace owner.                                                               |
| engine config parse -> reported diagnostics                             | `readConfiguration` -> `parsed.errors` / `parsed.rootNames` feed the diagnostic set. A config-resolution crash (code-500) must be classified as infrastructure, never folded as a type error. | Compiler diagnostics (objects); a crash surfaces as a synthesized code-500 Error diagnostic.                                |
| engine gatherer -> reported diagnostics                                 | The unconditional all-getter must gather the COMPLETE diagnostic set, including global/location-less TS diagnostics.                                                                          | `ts.Diagnostic[]` from the live `@angular/compiler-cli` program.                                                            |
| core policy -> adapter surfaces (Nx executor now, CLI/builder deferred) | core/ stays pure (ESLint-enforced: no `process.exit`, no `@nx/*`, no console); the adapter owns I/O + exit.                                                                                   | Classification result (`{ success }` for the executor; `0\|1\|2` exit code via the pure `toExitCode` for the deferred CLI). |

---

## Threat Register

| Threat ID | Category                              | Component                             | Disposition | Mitigation                                                                                                                                                                                                                                                                                                                                                            | Status |
| --------- | ------------------------------------- | ------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| T-08-01   | Spoofing                              | run-typecheck.ts config parse         | mitigate    | Early `parsed.errors` code-500 scan keyed `=== ng.UNKNOWN_ERROR_CODE`, placed AFTER `readConfiguration` and BEFORE the `configDiagnostics` fold and the zero-rootNames guard; re-throws `TypecheckInfrastructureError`. Post-`performCompilation` 500 scan RETAINED (two-stage defense-in-depth). `run-typecheck.ts:121-132` (early) + `:198-206` (post-compilation). | closed |
| T-08-02   | Tampering                             | COR-01 re-throw vs real type errors   | mitigate    | Both 500 scans gate STRICTLY on `code === ng.UNKNOWN_ERROR_CODE` (no `source`/message coupling); every non-500 `parsed.errors` entry stays folded at `run-typecheck.ts:137` and is counted. Proven by the 5012 unit contrast (`infra-failure.spec.ts:182`) and the malformed-5012 integration case (`config-resolution.integration.spec.ts:91`).                      | closed |
| T-08-03   | Tampering / Repudiation               | gather-diagnostics.ts                 | mitigate    | Seventh getter `program.getTsProgram().getGlobalDiagnostics()` added so global/location-less TS diagnostics are gathered. `gather-diagnostics.ts:35`. Unit wiring (`gather-diagnostics.spec.ts:82,99`) + real-compiler integration (`global-diagnostics.integration.spec.ts:44`) prove TS2318 surfaces through `result.diagnostics`.                                  | closed |
| T-08-04   | Tampering                             | file-less globals + boundary filter   | accept      | TS2318 globals are file-less and retained by the existing file-less "always keep" rule (`filter-diagnostics.ts:85`); no new mitigation by design. See Accepted Risks Log (R-08-04).                                                                                                                                                                                   | closed |
| T-08-05   | Tampering                             | filter-diagnostics.ts file-less guard | mitigate    | File-less guard widened to `diagnostic.file === undefined \|\| diagnostic.file.fileName === ''` so a present-but-empty `fileName` (a synthesized-diagnostic edge that canonicalizes to `''` and would otherwise be suppressed) is always kept. `filter-diagnostics.ts:85`. Proven by `filter-diagnostics.spec.ts:69-75` (`diag('')` kept, `suppressedCount` 0).       | closed |
| T-08-06   | Spoofing                              | exit-codes.ts classification (COR-04) | mitigate    | `toExitCode` keys infrastructure STRICTLY on `instanceof TypecheckInfrastructureError` -> 2; `errorCount > 0` -> 1; clean -> 0 — never collapses infra into clean/type-error. `exit-codes.ts:34-46`. All three branches locked by `exit-codes.spec.ts:12-22`.                                                                                                         | closed |
| T-08-07   | Elevation of Privilege / side effects | core purity boundary                  | mitigate    | `exit-codes.ts` imports ONLY from `./run-typecheck` and performs no process side effects; ESLint bans `process.exit`, `@nx/*`, `@angular-devkit/*`, `yargs`, and `console` across `**/src/core/**/*.ts`. `exit-codes.ts:24-46` + `eslint.config.mjs:16-64`. Lint gate green (0 errors).                                                                               | closed |
| T-08-SC   | Tampering                             | npm/pip/cargo installs                | N/A         | No package installs in this phase (zero new runtime dependencies; 08-RESEARCH Package Legitimacy Audit: not applicable). Verified: SUMMARY `tech-stack.added: []` on all three plans; no new `dependencies` introduced.                                                                                                                                               | closed |

_Status: open · closed_
_Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)_

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Accepted By              | Date       |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ---------- |
| R-08-04 | T-08-04    | The TS2318-class global diagnostics surfaced by COR-02 (`getTsProgram().getGlobalDiagnostics()`) are file-less. They depend on the boundary filter's existing file-less "always keep" rule (`filter-diagnostics.ts:85`, JSDoc `:26-32`) to reach the reported set rather than on a dedicated control. Risk is low: the globals are kept today via the `file === undefined` branch, and COR-03 (T-08-05) additionally widened the same guard to cover the present-but-empty `fileName` edge. No new mitigation is warranted; the dependency is documented and test-covered (`global-diagnostics.integration.spec.ts:44` proves the globals survive the filter end-to-end). | Lars Gyrup Brink Nielsen | 2026-06-29 |

_Accepted risks do not resurface in future audit runs._

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By                        |
| ---------- | ------------- | ------ | ---- | ----------------------------- |
| 2026-06-29 | 8             | 8      | 0    | Claude (gsd-security-auditor) |

Notes:

- 7 mitigation/accept threats from the consolidated register (T-08-01..T-08-07) plus the
  N/A supply-chain placeholder (T-08-SC) carried in every plan's `<threat_model>`.
- All 5 `mitigate` threats verified by direct source read of the cited file:line; both
  `accept`/`N/A` dispositions resolved (R-08-04 logged; T-08-SC confirmed zero new deps).
- No `## Threat Flags` section appears in any Phase 8 SUMMARY — the executors declared no
  new attack surface during implementation. No unregistered flags.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (R-08-04)
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-29
