---
phase: 30
slug: reporter-seam-json-reporter-format-threading-observability
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-18
validated: 2026-07-18
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `30-RESEARCH.md` § Validation Architecture. VER-01 is the Unit-tier slice
> for THIS phase; VER-02 (integration) and VER-03 (e2e) are Phase 32.
> Per-task IDs below are anchored to the 3 planned plans (30-01/02/03 sketches);
> the planner/`gsd-validate-phase` auditor finalize exact `<task-id>`s.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest via `@nx/vitest:test` (`project.json`) |
| **Config file** | `packages/angular-typechecker/vitest.config.mts` |
| **Quick run command** | `nx test angular-typechecker` (unit `*.spec.ts`; `dependsOn: build`) |
| **Full suite command** | `nx test angular-typechecker && nx typecheck angular-typechecker && nx lint angular-typechecker && nx format:check` |
| **Spec type-check (load-bearing)** | `tsc --noEmit -p packages/angular-typechecker/tsconfig.spec.json` (via `nx typecheck`) — `nx test` (Vitest/esbuild) does NOT type-check specs |
| **Estimated runtime** | ~30–60 seconds (unit tier); build dependency dominates |

---

## Sampling Rate

- **After every task commit:** Run `nx test angular-typechecker` (fast Vitest loop)
- **After every plan wave:** Run `nx test angular-typechecker && nx typecheck angular-typechecker && nx lint angular-typechecker`
- **Before `/gsd:verify-work`:** Full suite green + `nx format:check` + `index.drift.ts` compiles (additive-only proxy for the Phase-32 audit)
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

Retroactively audited 2026-07-18 (post-execution, gsd-nyquist-auditor). Every row below was
independently re-run this pass (not merely read from SUMMARY/VERIFICATION prose) — see
"Independent Audit Evidence" below the table.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 30-01-01/02 | 01 | 1 | FMT-01, OBS-01, ADD-01 | — | `renderReport` widened; `format:'human'` default; `totalFilesCount` optional; verdict never reads it | unit | `nx test angular-typechecker` | ✅ `core/run-typecheck.spec.ts` | ✅ green |
| 30-01-02 | 01 | 1 | OBS-01 | T-30-01 info-disclosure | non-declaration `totalFilesCount` captured off live Program + walk `Set`-dedupe; real count (post-WR-01: `.ngtypecheck.ts` shims excluded, exact literal `1`) | integration | `nx integration angular-typechecker` | ✅ `core/total-files-count.integration.spec.ts` | ✅ green |
| 30-02-03 | 02 | 1 | FMT-01, ADD-01 | — | human output byte-identical with `--format` omitted; 6 `render-report.spec.ts` calls green after `format:'human'`; `format:'json'` dispatch + `format:'sarif'` Phase-31 throw | unit | `nx test angular-typechecker` | ✅ `core/render-report.spec.ts` (extended) | ✅ green |
| 30-02-01/02 | 02 | 1 | REP-01 | V5 output-encoding | JSON shape: flat `diagnostics[]`, 1-based positions, `code`+`rawCode`, `severity`, `summary.outcome`, `formatVersion:1`, tool `version` | unit + snapshot | `nx test angular-typechecker` | ✅ `core/json-report.spec.ts` + `__snapshots__/json-report.spec.ts.snap` | ✅ green |
| 30-02-02 | 02 | 1 | REP-01 | false-pass | file-less diagnostic (`90001`) → `file:null` + null positions, NOT dropped (`diagnostics.length` == `CoreResult`) | unit | `nx test angular-typechecker` | ✅ `core/json-report.spec.ts` ("never drops a file-less diagnostic") | ✅ green |
| 30-02-01 | 02 | 1 | REP-01 | off-by-one | HAND-COUNTED position fixture asserts exact 1-based `line`/`column`/`endLine`/`endColumn` | unit | `nx test angular-typechecker` | ✅ `core/json-report.spec.ts` ("projects 0-based positions to 1-based ... hand-counted") | ✅ green |
| 30-02-01/02 | 02 | 1 | REP-01, FMT-03 | — | severity `ts.DiagnosticCategory` → `error`/`warning`/`suggestion`/`message`; code classifier over `TS####`/`NG8xxx`/`ATC9000x` via `codeStringOf`/`toDiagnosticRecord` | unit (data-driven) | `nx test angular-typechecker` | ✅ `core/json-report.spec.ts` | ✅ green |
| 30-02-02 | 02 | 1 | FMT-03 | ANSI leak | NO `\x1b` byte; payload byte-identical under `FORCE_COLOR=1` vs plain | unit | `nx test angular-typechecker` | ✅ `core/json-report.spec.ts` ("emits no ANSI byte and is byte-identical under FORCE_COLOR=1") | ✅ green |
| 30-02-02 | 02 | 1 | REP-01 (D-03) | tamper/drift | JSON top-level + `summary` + `advisories` + per-diagnostic KEY-SET drift-lock (mirrors `EXPECTED_KEYS`) | unit | `nx test angular-typechecker` | ✅ `core/json-report.spec.ts` ("JSON payload key drift-lock (D-03)" describe block) | ✅ green |
| 30-03-03 | 03 | 2 | FMT-02 | false-pass | exit-code PARITY across `human`/`json` for identical stubbed `CoreResult`, incl. coverage-incomplete `errorCount===0`/`success===false` | unit (stubbed core) | `nx test angular-typechecker` | ✅ `cli/main.spec.ts` ("FMT-02 / D-07: exit-code parity ...") | ✅ green |
| 30-03-03 | 03 | 2 | CLIX-02 | never-silent | `--quiet` skips `emitAdvisoryNotices` (stderr chatter gone) but stdout payload + exit code UNCHANGED | unit (stubbed core) | `nx test angular-typechecker` | ✅ `cli/main.spec.ts` ("CLIX-02 / D-09: --quiet silences the stderr advisory ONLY") | ✅ green |
| 30-03-03 | 03 | 2 | CLIX-02 | — | `--color`/`--no-color` flag WINS over `NO_COLOR`/`FORCE_COLOR`/TTY; machine format stays plain regardless (`allowNegative` parse) | unit | `nx test angular-typechecker` | ✅ `cli/main.spec.ts` ("ARGS-05: color precedence") + `cli/parse-args.spec.ts` | ✅ green |
| 30-03-01/02 | 03 | 2 | FMT-01 | — | `format` enum in both `schema-parity.spec.ts` `EXPECTED_KEYS`; `parse-args` accepts `human`/`json`/`sarif`, rejects out-of-enum as `usageError` | unit | `nx test angular-typechecker` | ✅ both `schema-parity.spec.ts` + `cli/parse-args.spec.ts` | ✅ green |
| 30-03-01 | 03 | 2 | FMT-01 (VER-01) | drift | HELP_TEXT + README flag drift-lock green after adding new flags | unit (fs read) | `nx test angular-typechecker` | ✅ `standalone-cli-docs.spec.ts` | ✅ green |
| CR-01 (code-review, post-30-03) | — | — | FMT-03 | T-30-07 false-pass / stdout-purity | Nx executor gates `emitAdvisoryNotices` on `format === 'human'` (`@nx/devkit`'s `logger.info` routes to stdout in a task process); `--format json` stdout stays a single `JSON.parse`-able payload even when `suppressedThirdParty > 0` | unit (stubbed core) | `nx test angular-typechecker` | ✅ `executors/typecheck/executor.spec.ts` ("CR-01: does NOT emit advisory notices on --format json" + "CR-01: STILL emits the advisory on --format human") | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky.*

### Independent Audit Evidence (adversarial re-run, 2026-07-18)

Every command below was executed fresh during this audit, not sourced from prior SUMMARY/VERIFICATION prose:

| Command | Result |
|---------|--------|
| `nx test angular-typechecker` | 46 test files, 506 tests passed |
| `nx integration angular-typechecker` | 22 test files, 120 tests passed |
| `npx vitest run --config packages/angular-typechecker/vitest.integration.config.mts -t "counts the doubly-compiled shared"` | 1/1 passed (2244ms, real cold compiler, asserts `toBe(1)` post-WR-01) |
| `nx typecheck angular-typechecker` | green (spec + drift + tools tsconfigs) |
| `nx lint angular-typechecker` | green (0 warnings) |
| `nx format:check` | green |

Source files read in full and cross-checked against the must-haves above:
`core/json-report.ts`, `core/json-report.spec.ts`, `core/diagnostic-record.ts`,
`core/render-report.ts`, `core/render-report.spec.ts`,
`core/total-files-count.integration.spec.ts`, `executors/typecheck/executor.spec.ts`,
both `schema-parity.spec.ts`. No test weakened; no gap required a new test — every
VER-01 slice named in the phase's gap list already has a real, passing, behavior-proving
test on disk (including the CR-01 stdout-purity regression added post-code-review and the
WR-01 shim-exclusion literal update, both already committed before this audit).

---

## Wave 0 Requirements

All satisfied during phase execution (confirmed on disk + re-run during this audit):

- [x] `core/json-report.spec.ts` — REP-01 shape/snapshot/severity/code/file-less/off-by-one/no-ANSI (the primary VER-01 deliverable)
- [x] JSON payload-key drift-lock — a describe block reusing the `EXPECTED_KEYS` pattern (D-03), extended to top-level + `summary` + `advisories` + per-diagnostic key sets
- [x] `cli/main.spec.ts` EXTENSION — exit-code parity across `human`/`json` (incl. coverage-incomplete), `--quiet`-gates-stderr-only, `--color`/`--no-color` override. Reuses the shipped `vi.hoisted` + `vi.mock(importOriginal)` harness and the `coreResult(errorCount)` factory
- [x] `cli/parse-args.spec.ts` EXTENSION — `--format` enum accept/reject; `--no-color` parses to `color:false` under `allowNegative`
- [x] Both `schema-parity.spec.ts` — `'format'` added to `EXPECTED_KEYS` + enum/default-value assertion (executor + builder)
- [x] `core/run-typecheck.spec.ts` + `core/total-files-count.integration.spec.ts` — OBS-01 capture + the verdict-neutrality negative test + real-compiler exact-literal dedupe proof
- [x] `core/render-report.spec.ts` — 6 existing calls widened to `format: 'human'`; added `format:'json'` dispatch assertion + `format:'sarif'` Phase-31 throw assertion
- [x] `executors/typecheck/executor.spec.ts` — CR-01 stdout-purity regression (added post-code-review, before this audit): `--format json` never emits `emitAdvisoryNotices`, stdout stays one `JSON.parse`-able payload; `--format human` still emits the advisory byte-identically
- No framework install needed (Vitest is present)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| — | — | — | — |

*All phase behaviors have automated verification (unit + one integration for the real `totalFilesCount`).*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-07-18 (gsd-nyquist-auditor retroactive audit) — 0 gaps found; all
14 VER-01 slices (13 per-task rows + CR-01) have real, passing, independently re-run tests on
disk. No test files generated this pass (none were needed); no implementation touched.
