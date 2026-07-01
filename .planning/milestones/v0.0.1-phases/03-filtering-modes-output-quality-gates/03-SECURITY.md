---
phase: 03
slug: filtering-modes-output-quality-gates
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-28
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Register authored at plan time (all four 03-0x-PLAN.md files carried a
`<threat_model>` block). All `mitigate`-disposition threats were verified against
the merged implementation; all `accept`-disposition threats are documented below.
This is a pure post-processing phase over the developer's OWN type-check output:
no authentication/session/access-control, no network, no filesystem-write
capability, and no untrusted external input. No `high`-severity threats apply.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| consumer tsconfig + source -> runTypecheck | Developer's own tsconfig and source; a developer-invoked static checker over their own code, not external input. | local source paths (non-sensitive) |
| diagnostic fileName -> boundary classification | Compiler-produced `file.fileName` classified against `basePath`; a misclassification is a correctness concern (a type-checker that lies), not an attack surface. | absolute file paths (non-sensitive) |
| maxWarnings input -> evaluateResult | The only numeric input; the Phase-4 adapter parses/validates the CLI value, this function defends against negative/NaN as robustness. | single number |
| diagnostics + ng/ts injected -> formatReport | Compiler-produced diagnostics + injected compiler-cli/ts surfaces; renders the developer's own output. | diagnostic objects (non-sensitive) |
| core/ <-> adapter (compile/lint-time) | Code-organization boundary: the framework-agnostic core must not depend on @nx/devkit/CLI/architect. Enforced at lint time, not a runtime trust boundary. | n/a (static) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-03-01 | Information Disclosure | filterDiagnostics path classification | mitigate | realpath-first + path-SEGMENT containment (`dir + '/'`) + `node_modules`-by-segment (`split('/').includes`) in `filter-diagnostics.ts` (D-06). Hardened further by WR-01 fix: `resolveFilterBasePath` never yields an empty base (commit 4c7cf66). Verified by the sibling-import boundary cases (4 real-compiler tests) + deep code review. | closed |
| T-03-02 | Tampering | suppressedCount / POST-filter counts | accept | Counts derived purely from compiler-produced diagnostics; no external mutation surface. Invariant `errorCount + warningCount <= diagnostics.length` holds. Developer-local, no PII. | closed |
| T-03-03 | Tampering | evaluateResult maxWarnings handling | mitigate | Negative/NaN `maxWarnings` treated as unset via `Number.isFinite(maxWarnings) && maxWarnings >= 0` in `evaluate-result.ts` (Security V5). Cannot crash the verdict or invert pass/fail. Verified by defensive unit cases. | closed |
| T-03-04 | Spoofing | verdict success boolean | accept | Pure deterministic function of POST-filter counts; no external mutation/auth concern. Errors always fail (cannot be suppressed by maxWarnings). | closed |
| T-03-05 | Denial of Service | ANSI-strip regex | mitigate | `ANSI_PATTERN` is linear (`ESC + \[[0-9;]*m`, bounded class, single `*`, anchored to `m`) -- no nested quantifiers, no catastrophic backtracking. Render input is compiler-produced, not adversarial. Confirmed by pattern inspection + deep code review (explicitly cleared as no-ReDoS). | closed |
| T-03-06 | Tampering | formatReport determinism (pathBase/getNewLine) | mitigate | Deterministic `FormatDiagnosticsHost`: absolute paths by default (not cwd-relative), `getNewLine: () => '\n'` in `format-report.ts`. Verified by idempotency + getNewLine + rendered-path unit cases. | closed |
| T-03-07 | Information Disclosure | core/ purity (no console/process) | accept | The formatter returns a string and reads no stdout/exit; the Phase-4 adapter owns I/O. Enforced by the D-11 lint gate (no-console + process.exit ban). No secrets/PII. | closed |
| T-03-08 | Tampering | core/ framework-agnostic invariant | mitigate | `@typescript-eslint/no-restricted-imports` core/** ban (incl. type-only -- `allowTypeImports` omitted) + `no-console` + `no-restricted-properties` process.exit ban in `eslint.config.mjs`. Verified by `npx nx lint angular-typechecker` exit 0 AND the verifier's negative control (a temp type-only `@nx/devkit` import in core/ produced 2 errors + non-zero lint). | closed |
| T-03-09 | Repudiation | published package.json dependency honesty | accept | `@nx/dependency-checks` (already enabled, untouched -- D-12) keeps published deps honest. Orthogonal to the boundary ban; no change needed. | closed |
| T-03-SC | Tampering | npm/pip/cargo installs (supply chain) | mitigate | Zero new packages installed this phase (all APIs from already-locked typescript@6.0.3 / @angular/compiler-cli@22.0.4 peers + present eslint plugins). Confirmed by an empty `git diff` of both package.json files across the phase. | closed |

*Status: open / closed*
*Disposition: mitigate (implementation required) / accept (documented risk) / transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-02 | Counts derive purely from compiler output; no external mutation surface; developer-local, no PII. | Lars Gyrup Brink Nielsen | 2026-06-28 |
| AR-03-02 | T-03-04 | Verdict is a pure deterministic function; errors always fail; no auth surface. | Lars Gyrup Brink Nielsen | 2026-06-28 |
| AR-03-03 | T-03-07 | core/ returns values only; the Phase-4 adapter owns all I/O and exit; lint gate enforces purity. | Lars Gyrup Brink Nielsen | 2026-06-28 |
| AR-03-04 | T-03-09 | @nx/dependency-checks (enabled, untouched) keeps published deps honest; orthogonal to the boundary ban. | Lars Gyrup Brink Nielsen | 2026-06-28 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-28 | 10 | 10 | 0 | gsd-secure-phase (orchestrator, short-circuit: plan-time register, threats_open 0) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-28
