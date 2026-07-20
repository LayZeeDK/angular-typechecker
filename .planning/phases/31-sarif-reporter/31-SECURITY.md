---
phase: 31-sarif-reporter
audited: 2026-07-18
asvs_level: 1
block_on: high
threats_total: 8
threats_closed: 8
threats_open: 0
status: secure
---

# Phase 31: Security Audit (retroactive threat-mitigation verification)

**Phase:** 31 - SARIF reporter
**Milestone:** v0.2.3 Machine-readable reporters
**ASVS Level:** 1 (verify each declared mitigation is PRESENT in the cited code)
**Block threshold:** `high` (open threats of severity high or critical block ship)
**Verdict:** SECURE at ASVS L1 - all 8 declared mitigations verified in implemented source
(not documentation); 0 blocking-open threats.

## Scope

This phase adds ONE new runtime dependency (`node-sarif-builder@^4.1.0`, reached only via
a lazy `await import()`), no network/auth/session/persistence surface. It is build-tooling
output formatting: a pure SARIF 2.1.0 reporter over the same shared `diagnostic-record`
projection Phase 30's JSON reporter uses. ASVS V2/V3/V4 (auth/session/access) are N/A; the
audit scopes to V5 (input validation / output encoding / info disclosure) and, newly this
phase, a slice of V6 (the `partialFingerprints` sha256 recipe) and supply-chain integrity
for the new dependency.

Two trust boundaries, both declared in the plans:
- `CoreResult.diagnostics -> SARIF payload (stdout)`: source-derived message text and file
  paths (may contain the maintainer's absolute local path) cross into a machine payload
  that may be committed to / uploaded to a public repo (GitHub Code Scanning).
- `npm install (node-sarif-builder + transitive fs-extra)`: one new third-party runtime
  dependency, reached only via a lazy `await import()` on the SARIF path.

## Threat Verification

| Threat ID | Category | Severity | Disposition | Status | Evidence |
|-----------|----------|----------|-------------|--------|----------|
| T-31-01 | Information disclosure (`artifactLocation.uri`) | medium | mitigate | CLOSED | `sarif-report.ts:91,97-105` reads `record.file` from `toDiagnosticRecord` and never calls `path.relative` itself (confirmed by `git grep` — the only hits for `path.relative`/`ngCodeOf`/`getLineAndCharacterOfPosition`/`flattenDiagnosticMessageText` in `sarif-report.ts` are the doc-comment prohibition, lines 15-16, not calls). `diagnostic-record.ts:113-121` `relativizePath` = `relative(pathBase, absolutePath)` then `.replace(/\\/g, '/')`. `sarif-report.spec.ts:149` asserts `physicalLocation.artifactLocation.uri === 'src/y.component.ts'` for a Windows-style absolute fixture path (`D:/ws/proj/src/y.component.ts`) relative to `pathBase 'D:/ws/proj'` — repo-relative, forward-slash, no drive letter. Independently re-ran: `nx test angular-typechecker --testFile=sarif` — 12/12 pass. |
| T-31-02 | Tampering (SARIF message/text serialization) | medium | mitigate | CLOSED | `node_modules/node-sarif-builder/dist/lib/sarif-builder.js:69-77` `buildSarifJsonString` serializes exclusively via `JSON.stringify(this.log)` (confirmed by reading the installed package source — no hand-concatenation anywhere in the reporter or the builder). `sarif-report.ts` never string-concatenates SARIF JSON. Messages come from `ts_.flattenDiagnosticMessageText` (`diagnostic-record.ts:55`) via the shared projection, never a colorizing/ANSI path. `sarif-report.spec.ts:207-232` asserts no `\x1b` byte and byte-identical output under `FORCE_COLOR=1`. |
| T-31-03 | Repudiation / false-pass (reporter verdict independence) | high | mitigate | CLOSED | `sarif-report.ts` has NO `try`/`catch` anywhere in `formatSarifReport` (a throw propagates as infra, exit 2) and NEVER reads/derives `success`/`outcome` — `evaluateResult` (`evaluate-result.ts`) is untouched by this phase. The D-01 never-drop loop (`sarif-report.ts:90-113`) maps every `result.diagnostics` entry to exactly one SARIF result, including file-less ones (no `locations` key, never dropped). `sarif-report.spec.ts:259-275` asserts a coverage-incomplete `CoreResult` (`errorCount:0`, `success:false`) still yields `results.length === diagnostics.length`. `main.spec.ts:211-246` (`FMT-02/D-07`) asserts `sarif.exitCode === human.exitCode === json.exitCode` for BOTH the type-error (→1) and coverage-incomplete (→1) legs. Independently re-ran: `nx test angular-typechecker --testFile=main.spec` — 30/30 pass, including both FMT-02 legs. |
| T-31-04 | Information disclosure (node_modules diagnostic TEXT) | low | accept | CLOSED (accepted-risk logged) | `run-typecheck.ts:79,838,879-894,945` — `suppressedThirdParty` is an integer COUNT computed by the boundary filter that excludes node_modules diagnostics from `CoreResult.diagnostics` before any reporter (human/JSON/SARIF) ever sees them. `sarif-report.ts` iterates ONLY `result.diagnostics` (already boundary-filtered upstream) — it never has access to a node_modules diagnostic's text. Same mechanism Phase 30 accepted for the JSON reporter (30-SECURITY.md AR-2). See Accepted Risks AR-1 below. |
| T-31-SC | Tampering (`node-sarif-builder` supply chain / load surface) | high | mitigate | CLOSED | Legitimacy verdict recorded OK in 31-RESEARCH.md's Package Legitimacy Audit (~3.2M downloads/wk, repo present, `postinstall: null`, MIT) — confirmed present in `package.json` (`dependencies.node-sarif-builder: "^4.1.0"`, both root and `packages/angular-typechecker/package.json`), `@types/sarif`/`fs-extra` ABSENT from both manifests (`git grep -c "@types/sarif\|fs-extra"` on `packages/angular-typechecker/package.json` = 0). Reached ONLY via `await import('node-sarif-builder')` (`sarif-report.ts:59`) itself reached ONLY via `await import('./sarif-report.js')` (`render-report.ts:83`) — no static value import of either (`import type * as NodeSarifBuilder` at `sarif-report.ts:30` erases at compile). Empirically locked by the require-graph guard (see T-31-05). |
| T-31-05 | Tampering / supply chain (lazy `await import()` firewall regression) | high | mitigate | CLOSED | `sarif-require-graph.spec.ts:128-152`: a static require-graph walk from the BUILT `render-report.js` (the shared seam) AND `bin.js` (CLI boot) asserts `node-sarif-builder`/`fs-extra` never appear (`violations` === `[]` for both), PLUS a positive control asserting the comment-stripped `render-report.js` source contains `import('./sarif-report.js')` — proving "no violation" means "lazy", not "the module is unreferenced". Independently re-ran: 3/3 tests pass (part of the 12/12 `--testFile=sarif` run above), which rebuilds `dist` first via `dependsOn: build`. |
| T-31-06 | Tampering (CJS-under-`await import()` interop drift) | medium | mitigate | CLOSED | `sarif-report.interop.spec.ts` does a GENUINE `await import('node-sarif-builder')` (no `vi.mock` — confirmed by reading the file, no mock of the package anywhere in it), resolves the four builder classes via `(mod.default ?? mod)`, and asserts a minimal built payload has `version === '2.1.0'`. Independently re-ran: 1/1 test passes (part of the 12/12 run above). |
| T-31-07 | Tampering (manifest dependency-classification integrity) | low | mitigate | CLOSED | `eslint.config.mjs:164-169` `ignoredDependencies` array does NOT contain `node-sarif-builder` (confirmed by reading the array: `['nx', '@angular-devkit/architect', '@angular-devkit/schematics', 'rxjs']`) — resolved against the REAL `nx lint angular-typechecker` (A1: Nx's project graph sees the lazy dynamic import and the dep passes as used). Independently re-ran: `nx lint angular-typechecker` — "All files pass linting" (maxWarnings:0 green). No `eslint --fix` was run; `checkVersionMismatches:false` and the public peer ranges are untouched. |

## Unregistered Flags

None. Neither `31-01-SUMMARY.md` nor `31-02-SUMMARY.md` contains a `## Threat Flags`
section; `31-02-SUMMARY.md`'s "Threat Model Coverage" explicitly states "No new threat
surface flagged." Independent review of the shipped source confirms this: the new
`extended-catalog.ts` module is dependency-free static data (member/ngCode/shortDescription
strings derived from Angular's own documentation, not user input); the `helpUri`/
`informationUri` strings are static literals, not constructed from diagnostic content; the
`sha256` fingerprint (`fingerprintOf`, `sarif-report.ts:152-162`) hashes only already-public
diagnostic fields (code/path/message/line/column) with no secret or volatile material — a
correctness invariant, not a new vulnerability surface, per the phase's own framing. No new
network, auth, or persistence surface was introduced.

## Accepted Risks Log

- **AR-1 (T-31-04):** The SARIF reporter emits only already-boundary-filtered
  `CoreResult.diagnostics`; node_modules suppressions surface as the COUNT
  `suppressedThirdParty` only (never a dependency's diagnostic TEXT). This mirrors Phase
  30's AR-2 for the JSON reporter, now also true for SARIF. Residual content-isolation
  risk: low. Accepted at ASVS L1.

## Residual / awareness (non-blocking, carried from Phase 30)

- **IN-03 (within T-31-01, inherited from 30-SECURITY.md):** a cross-Windows-drive
  `pathBase` vs. diagnostic file (e.g. base `D:\` vs. file `C:\`) yields an absolute path
  from `path.win32.relative`, since SARIF reuses the SAME `relativizePath` the JSON
  reporter uses. Rare (cross-drive tsconfig references / symlinked deps). Not fixed this
  phase (D-13 REUSES the shared projection by design — a SARIF-specific fix would
  reintroduce exactly the drift D-13 exists to prevent). Acceptable at ASVS L1; tracked as
  awareness, not a new blocker.

## Verdict

**SECURE at ASVS Level 1.** All 8 declared threat mitigations (5 from 31-01-PLAN.md,
3 from 31-02-PLAN.md) are present and verified in the implemented source — not
documentation or intent — and re-confirmed by independently re-running the cited test
suites (`nx test angular-typechecker --testFile=sarif`: 12/12 pass; `nx test
angular-typechecker --testFile=main.spec`: 30/30 pass; `nx lint angular-typechecker`:
clean at maxWarnings:0). `threats_open = 0`; no high- or critical-severity threat is
unmitigated. The phase clears the `block_on: high` gate.

---

_Audited: 2026-07-18 by gsd-security-auditor (retroactive, ASVS L1, FORCE stance)_
