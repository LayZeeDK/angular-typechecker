---
phase: 30
slug: reporter-seam-json-reporter-format-threading-observability
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-18
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

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 30-01-* | 01 | 1 | FMT-01, OBS-01, ADD-01 | — | `renderReport` widened; `format:'human'` default; `totalFilesCount` optional; verdict never reads it | unit | `nx test angular-typechecker` | ❌ W0 | ⬜ pending |
| 30-01-* | 01 | 1 | OBS-01 | T-30 info-disclosure | non-declaration `totalFilesCount` captured off live Program + walk `Set`-dedupe; real count | integration | `nx integration angular-typechecker` | ❌ W0 | ⬜ pending |
| 30-01-* | 01 | 1 | FMT-01, ADD-01 | — | human output byte-identical with `--format` omitted; 6 `render-report.spec.ts` calls green after `format:'human'` | unit | `nx test angular-typechecker` | ✅ (extend) | ⬜ pending |
| 30-02-* | 02 | 1 | REP-01 | V5 output-encoding | JSON shape: flat `diagnostics[]`, 1-based positions, `code`+`rawCode`, `severity`, `summary.outcome`, `formatVersion:1`, tool `version` | unit + snapshot | `nx test angular-typechecker` | ❌ W0 | ⬜ pending |
| 30-02-* | 02 | 1 | REP-01 | false-pass | file-less diagnostic (`90001`) → `file:null` + null positions, NOT dropped (`diagnostics.length` == `CoreResult`) | unit | `nx test angular-typechecker` | ❌ W0 | ⬜ pending |
| 30-02-* | 02 | 1 | REP-01 | off-by-one | HAND-COUNTED position fixture asserts exact 1-based `line`/`column`/`endLine`/`endColumn` | unit | `nx test angular-typechecker` | ❌ W0 | ⬜ pending |
| 30-02-* | 02 | 1 | REP-01, FMT-03 | — | severity `ts.DiagnosticCategory` → `error`/`warning`/`suggestion`/`message`; code classifier over `TS####`/`NG8xxx`/`ATC9000x` | unit (data-driven) | `nx test angular-typechecker` | ❌ W0 | ⬜ pending |
| 30-02-* | 02 | 1 | FMT-03 | ANSI leak | NO `\x1b` byte; payload byte-identical under `FORCE_COLOR=1` vs plain | unit | `nx test angular-typechecker` | ❌ W0 | ⬜ pending |
| 30-02-* | 02 | 1 | REP-01 (D-03) | tamper/drift | JSON top-level + `summary` KEY-SET drift-lock (mirror `EXPECTED_KEYS`) | unit | `nx test angular-typechecker` | ❌ W0 | ⬜ pending |
| 30-03-* | 03 | 2 | FMT-02 | false-pass | exit-code PARITY across `human`/`json` for identical stubbed `CoreResult`, incl. coverage-incomplete `errorCount===0`/`success===false` | unit (stubbed core) | `nx test angular-typechecker` | ✅ (extend `main.spec.ts`) | ⬜ pending |
| 30-03-* | 03 | 2 | CLIX-02 | never-silent | `--quiet` skips `emitAdvisoryNotices` (stderr chatter gone) but stdout payload + exit code UNCHANGED | unit (stubbed core) | `nx test angular-typechecker` | ✅ (extend) | ⬜ pending |
| 30-03-* | 03 | 2 | CLIX-02 | — | `--color`/`--no-color` flag WINS over `NO_COLOR`/`FORCE_COLOR`/TTY; machine format stays plain regardless (`allowNegative` parse) | unit | `nx test angular-typechecker` | ✅ (extend) + `parse-args.spec.ts` | ⬜ pending |
| 30-03-* | 03 | 2 | FMT-01 | — | `format` enum in both `schema-parity.spec.ts` `EXPECTED_KEYS`; `parse-args` accepts `human`/`json`/`sarif`, rejects out-of-enum as `usageError` | unit | `nx test angular-typechecker` | ✅ (extend) | ⬜ pending |
| 30-03-* | 03 | 2 | FMT-01 (VER-01) | drift | HELP_TEXT + README flag drift-lock green after adding new flags | unit (fs read) | `nx test angular-typechecker` | ✅ (`standalone-cli-docs.spec.ts`) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. `❌ W0` = Wave-0 test file to be created before implementation.*

---

## Wave 0 Requirements

- [ ] `core/json-report.spec.ts` — REP-01 shape/snapshot/severity/code/file-less/off-by-one/no-ANSI (the primary VER-01 deliverable)
- [ ] JSON payload-key drift-lock — a `core/json-report.drift.spec.ts` or a describe block reusing the `EXPECTED_KEYS` pattern (D-03)
- [ ] `cli/main.spec.ts` EXTENSION — exit-code parity across `human`/`json` (incl. coverage-incomplete), `--quiet`-gates-stderr-only, `--color`/`--no-color` override. Reuse the shipped `vi.hoisted` + `vi.mock(importOriginal)` harness and the `coreResult(errorCount)` factory
- [ ] `cli/parse-args.spec.ts` EXTENSION — `--format` enum accept/reject; `--no-color` parses to `color:false` under `allowNegative`
- [ ] Both `schema-parity.spec.ts` — add `'format'` to `EXPECTED_KEYS` + default-value assertion (executor + builder)
- [ ] `core/run-typecheck.spec.ts` + a `totalFilesCount` real-compiler `*.integration.spec.ts` — OBS-01 capture + the verdict-neutrality negative test
- [ ] `core/render-report.spec.ts` — add `format: 'human'` to the 6 existing calls; optionally a `format:'json'` dispatch assertion
- No framework install needed (Vitest is present)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| — | — | — | — |

*All phase behaviors have automated verification (unit + one integration for the real `totalFilesCount`).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
