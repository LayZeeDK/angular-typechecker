---
phase: 09
slug: resilience-per-file-fault-isolation-boundary-robustness
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-29
---

# Phase 09 -- Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

This phase hardens the engine's RESILIENCE: per-file fault isolation of Angular
diagnostic gathering, boundary-filter robustness against a throwing `realpath`,
output-path config-nuisance suppression, and a loud notice when a TCB-generation
Fatal renders the template check incomplete. It is a pure no-emit Angular
type-checker engine: no network, auth, persistence, or secrets surface, so ASVS
V2 (auth) / V3 (session) / V4 (access control) / V6 (crypto) are N/A. The
applicable controls are V5 (input robustness -- the `realpath` + config-nuisance
handling) and V12 (files/resources -- the `realpath` DoS-by-crash hardening). All
six declared threats are verified present in the SHIPPED code (no documentation
accepted as evidence).

---

## Trust Boundaries

| Boundary                                                  | Description                                                                                                                                                                        | Data Crossing                                                        |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| consumer source/template -> compiler diagnostic gathering | A poisoned component (untrusted template input) must not be able to suppress (hide) the rest of the program's Angular diagnostics -- a "lying clean / silently incomplete" verdict | Untrusted `.ts`/`.html` component sources; emitted `ts.Diagnostic[]` |
| filesystem (realpath syscall) -> boundary filter          | `options.realpath` (prod: `ts.sys.realpath`) crosses into the OS; a hostile/broken symlink target or a permission-denied path can throw                                            | Absolute file paths; OS realpath result or thrown error              |
| consumer tsconfig -> config resolution / program creation | The consumer's tsconfig (outDir/rootDir/composite shape) is untrusted input; an output-path config nuisance could be mis-counted as a type error (false fail)                      | Untrusted tsconfig options; `ParsedConfiguration`                    |
| infrastructure crash -> verdict classification            | An internal compiler/host crash (UNKNOWN_ERROR_CODE 500) must never be reclassified as a type error or a clean PASS                                                                | Synthesized 500 diagnostic; `TypecheckInfrastructureError`           |

---

## Threat Register

| Threat ID | Category                                             | Component                                                          | Disposition | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Status |
| --------- | ---------------------------------------------------- | ------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| T-09-01   | Denial of Service / Repudiation (tool under-reports) | gather-diagnostics.ts Angular gathering                            | mitigate    | RES-02 HYBRID per-file isolation: per-file `getNgSemanticDiagnostics(sourceFile.fileName)` loop over `getTsProgram().getSourceFiles()` skipping `isDeclarationFile`; one component's TCB-gen Fatal yields exactly one diagnostic via the compiler's own `isFatalDiagnosticError` catch and does NOT collapse the run; residual whole-program call + COR-02 global getter retained. `gather-diagnostics.ts:69-80`; proof `fault-isolation.integration.spec.ts`.                             | closed |
| T-09-02   | Denial of Service                                    | filter-diagnostics.ts createCanonicalizer                          | mitigate    | RES-03: `options.realpath()` wrapped in try/catch; a throwing realpath falls back to the unresolved raw `filePath`, still normalized (`\\` -> `/`) and case-folded, so the pass does not abort. Catch body is silent (pure core). `filter-diagnostics.ts:129-138`.                                                                                                                                                                                                                         | closed |
| T-09-03   | Repudiation (mis-classification)                     | run-typecheck.ts readConfiguration                                 | mitigate    | RES-04: `{ suppressOutputPathCheck: true }` passed as the `readConfiguration` second arg; with the engine's `noEmit: true` override, no output-path nuisance (TS5055-class) surfaces as a type error. `run-typecheck.ts:142-144`.                                                                                                                                                                                                                                                          | closed |
| T-09-04   | Tampering with the verdict's meaning                 | gather-diagnostics.ts (no catch-all) + run-typecheck.ts infra path | mitigate    | D-05: NO catch-all per-file try/catch added (gatherer loop wraps nothing; only `catch` tokens are in comments); a non-fatal/infra throw still escapes to `performCompilation`'s outer catch -> UNKNOWN_ERROR_CODE 500 -> `TypecheckInfrastructureError`. Both 500 re-throws intact. `gather-diagnostics.ts:71-78`; `run-typecheck.ts:160-171` (config scan) and `:237-245` (post-compile scan).                                                                                            | closed |
| T-09-05   | Repudiation / silent incompleteness                  | gatherer abort path + executor output                              | mitigate    | RES-02 reframe (09-RES-02-DECISION.md, Option A): pure-core detection scans the reported set for `TCB_GENERATION_FATAL_DIAGNOSTIC_CODE` (`NG(3004) === -993004`) and sets `CoreResult.templateCheckAborted`; the executor renders a LOUD `logger.warn` naming the offending source file, emitted before the report. The incompleteness is never silent. `diagnostic-codes.ts:79-90`; `run-typecheck.ts:67` (field), `:406`/`:433-448` (`detectTemplateCheckAborted`); `executor.ts:52-62`. | closed |
| T-09-SC   | Tampering                                            | npm/pip/cargo installs                                             | accept      | No package installs this phase (pure source edits). Verified: `packages/angular-typechecker/package.json` is byte-unchanged since the `0.0.2` release (no Phase 9 commit touches it); dependencies remain `@nx/devkit` + `tslib`, peers `@angular/compiler-cli` + `typescript`. No new runtime dependency added.                                                                                                                                                                           | closed |

_Status: open . closed_
_Disposition: mitigate (implementation required) . accept (documented risk) . transfer (third-party)_

---

## Evidence Detail (verified against shipped code)

- **T-09-01** -- `packages/angular-typechecker/src/core/gather-diagnostics.ts:72-78`: the per-file loop
  `for (const sourceFile of program.getTsProgram().getSourceFiles()) { if (sourceFile.isDeclarationFile) { continue; } all.push(...program.getNgSemanticDiagnostics(sourceFile.fileName)); }`,
  preceded by the residual whole-program `getNgSemanticDiagnostics()` (`:69`, HYBRID superset) and followed by the COR-02 `getTsProgram().getGlobalDiagnostics()` (`:80`). Failing-then-passing proof: `packages/angular-typechecker/src/core/fault-isolation.integration.spec.ts`.
- **T-09-02** -- `packages/angular-typechecker/src/core/filter-diagnostics.ts:129-138`: `try { resolved = options.realpath(filePath); } catch { resolved = filePath; }`, then `:140` `const real = resolved.replace(/\\/g, '/');` and `:141-143` the case-fold. Catch body carries only a comment (no `console`/`process`).
- **T-09-03** -- `packages/angular-typechecker/src/core/run-typecheck.ts:142-144`: `ng.readConfiguration(options.tsConfigPath, { suppressOutputPathCheck: true })`. Proof: `suppress-output-path.integration.spec.ts` asserts no TS5055 surfaces.
- **T-09-04** -- gatherer: `git grep "catch" gather-diagnostics.ts` returns only comment lines (`:22`, `:39`, `:41`); the loop wraps nothing. Infra re-throws: `run-typecheck.ts:164-171` (config-scan 500 -> `TypecheckInfrastructureError`) and `:241-245` (post-`performCompilation` 500 -> `TypecheckInfrastructureError`), both unchanged this phase. `OptimizeFor.SingleFile` appears in src/core only inside comments documenting it is forbidden (D-07) -- never as a call.
- **T-09-05** -- `diagnostic-codes.ts:79` `IMPORT_GENERATION_FAILURE_CODE = 3004`, `:88-90` `TCB_GENERATION_FATAL_DIAGNOSTIC_CODE = NG(IMPORT_GENERATION_FAILURE_CODE)`; `run-typecheck.ts:67` `templateCheckAborted?` field, `:406` `detectTemplateCheckAborted(reported)`, `:433-448` the pure code-only scan; `executor.ts:52-62` the gated `logger.warn` naming the offending file, emitted before `renderReport`. Infra path uses a distinct `logger.error` (`:78-80`).
- **T-09-SC** -- `packages/angular-typechecker/src/core/` edits are pure source; `git log -- packages/angular-typechecker/package.json` shows the last touch was the `0.0.2` release commit (pre-Phase-9). No dependency/peerDependency change.

---

## Unregistered Flags

None. No Phase 9 SUMMARY (09-01 .. 09-05) contains a `## Threat Flags` section
(verified by search). No new attack surface appeared during implementation that
lacks a threat mapping.

---

## Accepted Risks Log

| Risk ID  | Threat Ref | Rationale                                                                                                                                                                                                                                                                                                                                                                                    | Accepted By                                           | Date       |
| -------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------- |
| AR-09-SC | T-09-SC    | Phase 9 is pure source edits (RES-01..RES-05 + RES-02 reframe). No npm/pip/cargo install occurred; the published `package.json` is byte-unchanged since `0.0.2` (deps `@nx/devkit`+`tslib`, peers `@angular/compiler-cli`+`typescript`). The supply-chain / package-legitimacy gate is moot for this phase, and adding a package to satisfy any RES item would be a charter scope violation. | gsd-security-auditor (verified no package.json delta) | 2026-06-29 |

_Accepted risks do not resurface in future audit runs._

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By               |
| ---------- | ------------- | ------ | ---- | -------------------- |
| 2026-06-29 | 6             | 6      | 0    | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-29
