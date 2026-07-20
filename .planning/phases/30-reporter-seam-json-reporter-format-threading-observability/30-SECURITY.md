---
phase: 30-reporter-seam-json-reporter-format-threading-observability
audited: 2026-07-18
asvs_level: 1
block_on: high
threats_total: 8
threats_closed: 8
threats_open: 0
status: secure
---

# Phase 30: Security Audit (retroactive threat-mitigation verification)

**Phase:** 30 - Reporter seam, JSON reporter, `--format` threading, observability
**Milestone:** v0.2.3 Machine-readable reporters
**ASVS Level:** 1 (verify each declared mitigation is PRESENT in the cited code)
**Block threshold:** `high` (open threats of severity high or critical block ship)
**Verdict:** SECURE at ASVS L1 - all 8 declared mitigations verified in implemented source; 0 blocking-open threats.

## Scope

This phase adds NO new runtime dependency, NO network/auth/session/persistence surface.
It is build-tooling output formatting: a zero-dependency JSON reporter over the widened
render seam, plus flag threading. Per RESEARCH.md Security Domain, ASVS V2/V3/V4
(auth/session/access) and V6 (crypto) are **N/A**; the audit scopes to **V5 (input
validation / output encoding / info disclosure)**. `partialFingerprints` hashing (V6) is
Phase-31 SARIF territory and out of scope here.

The single trust boundary is `CoreResult.diagnostics -> machine payload (stdout)`:
source-derived message text (may contain quotes/newlines/control chars) and file paths
(may contain the maintainer's absolute local path) cross into a payload that may be
committed or uploaded to CI.

## Threat Verification

| Threat ID | Category | Severity | Disposition | Status | Evidence |
|-----------|----------|----------|-------------|--------|----------|
| T-30-01 | Repudiation / false-pass | high | mitigate | CLOSED | `evaluate-result.ts:84-93` `EvaluateInput` Pick omits `totalFilesCount` (verdict never reads it); file is **byte-unchanged this phase** (`git log 1777112..HEAD` shows no commit touching it). Verdict-neutrality negative test at `run-typecheck.spec.ts:261-275` asserts `evaluateResult` is byte-identical with vs without the field across counts `[0,1,7,3186]` on clean AND failing verdicts. |
| T-30-02 | Information disclosure | low | accept | CLOSED (accepted-risk logged) | `totalFilesCount` is an integer count of non-declaration files - no path or source text crosses into it. See Accepted Risks AR-1. |
| T-30-03 | Tampering (malformed output) | medium | mitigate | CLOSED | `json-report.ts:107` serializes via `JSON.stringify(payload, null, 2)` ONLY - no hand-concatenation anywhere in the module. Messages come from `ts_.flattenDiagnosticMessageText` (`diagnostic-record.ts:55`), never a colorizing path, so quotes/newlines/control chars are correctly escaped. `json-report.spec.ts:320` asserts no `\x1b` byte and byte-identical output under `FORCE_COLOR=1`. |
| T-30-04 | Information disclosure (absolute-path leak) | medium | mitigate | CLOSED (residual noted) | `diagnostic-record.ts:113-121` `relativizePath(absolutePath, pathBase)` = `relative(pathBase, ...)` + `/\\/g -> /`. Applied to EVERY path in the payload: `file` (`diagnostic-record.ts:131`), `tsConfigPath` (`json-report.ts:81`), and all advisory paths (`json-report.ts:120,128,135,143`). `json-report.spec.ts:217,385` assert repo-relative forward-slash output. **Residual:** cross-Windows-drive base (IN-03: base `D:\` vs file `C:\`) yields an absolute path from `path.win32.relative`; documented Phase-31 (URI normalization) territory, acceptable at ASVS L1. |
| T-30-05 | Information disclosure (content isolation) | low | accept | CLOSED (accepted-risk logged) | Reporter emits ONLY `result.diagnostics` (already boundary-filtered upstream in `run-typecheck`) mapped 1:1 through the projection (`json-report.ts:102-104`). node_modules suppressions surface as COUNTS only (`summary.suppressedThirdParty`, `json-report.ts:94`); `emit-advisory-notices.ts:134-140` `warnSuppressed` emits the third-party COUNT, never a dependency's diagnostic TEXT. In-graph advisory notices name file paths (`suppressedInGraphFiles`), never third-party error text. See Accepted Risks AR-2. |
| T-30-06 | Repudiation / false-pass (verdict coupling) | high | mitigate | CLOSED | `json-report.ts:70-73` obtains `summary.success`/`outcome` by DELEGATING to `evaluateResult(result, { maxWarnings, strict })` - never re-derived from counts. The coverage-incomplete case (`errorCount===0`, `success===false`) is preserved as data. No `try/catch`-to-success in the module: a reporter throw propagates to the adapter infra catch (`main.ts:185-197`, `executor.ts:88-96`) -> exit 2, never swallowed to success. `evaluate-result.ts` is byte-unchanged (T-30-01 evidence). |
| T-30-07 | Repudiation / false-pass (stdout purity + exit code across formats) | high | mitigate | CLOSED | **CR-01 fix present:** `executor.ts:61` gates `emitAdvisoryNotices` on `format === 'human'` (commit 2698aa0), so `@nx/devkit`'s `logger.info -> stdout` no longer corrupts the `--format json` payload; payload goes to `process.stdout.write` ONLY (`executor.ts:80`). **Lock test present:** `executor.spec.ts:564-608` runs `--format json` with `suppressedThirdParty:3` and asserts `loggerInfo`/`loggerWarn` NOT called + `JSON.parse(writes.join(''))` does not throw; `executor.spec.ts:610-625` asserts human format still emits the advisory. Exit compose untouched: both `main.ts:179-184` and `executor.ts:85-87` read ONLY `evaluateResult(...).success` (`toExitCode`/`evaluateResult` sole owners). |
| T-30-08 | Repudiation / information suppression (`--quiet`) | medium | mitigate | CLOSED | `main.ts:160-162` gates `emitAdvisoryNotices` on `!parsed.quiet` - stderr advisory chatter ONLY. `--quiet` never touches the stdout payload (`renderReport` call `main.ts:164-173` is unconditional) nor the verdict/exit code (`main.ts:179-184` unconditional). VER-01 unit slice in `main.spec.ts` (per plan 30-03 Task 3) asserts payload + exit code unchanged under `--quiet`. |

## Unregistered Flags

None. Both `30-02-SUMMARY.md` and `30-03-SUMMARY.md` `## Threat Flags` sections report
"None" - no new network endpoint, auth path, file-access pattern, or trust-boundary
change beyond the `CoreResult.diagnostics -> stdout` boundary the register already covers.
Every declared threat maps to an ID in the plans' `<threat_model>` blocks.

## Accepted Risks Log

- **AR-1 (T-30-02):** `CoreResult.totalFilesCount` is surfaced as `summary.totalFilesCount`,
  an integer count of non-declaration source files. It carries no path or source text.
  Residual disclosure risk: low. Accepted at ASVS L1.
- **AR-2 (T-30-05):** The reporter emits only already-boundary-filtered `CoreResult.diagnostics`
  plus suppression COUNTS. A dependency's diagnostic message text never crosses into the
  payload. Residual content-isolation risk: low. Accepted at ASVS L1.

## Residual / awareness (non-blocking, tracked for Phase 31)

- **IN-03 (within T-30-04):** cross-Windows-drive `pathBase` vs diagnostic file yields an
  absolute `file`/advisory path because `path.win32.relative` has no cross-drive relative
  form. Rare (cross-drive tsconfig references / symlinked deps). Full URI normalization is
  Phase 31; noted for awareness, acceptable at ASVS L1. Not a blocker.

## Verdict

**SECURE at ASVS Level 1.** All 8 declared threat mitigations are present and verified in
the implemented source (not documentation). `threats_open = 0`; no high- or critical-severity
threat is unmitigated. The phase clears the `block_on: high` gate.

---

_Audited: 2026-07-18 by gsd-security-auditor (retroactive, ASVS L1, FORCE stance)_
