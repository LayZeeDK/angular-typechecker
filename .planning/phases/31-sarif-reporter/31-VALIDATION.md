---
phase: 31
slug: sarif-reporter
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-18
validated: 2026-07-18
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `31-RESEARCH.md` § Validation Architecture. VER-01's SARIF-shape unit slice
> rides along here (REQUIREMENTS.md note); VER-02 (schema/cross-OS) and VER-03 (tarball
> e2e) are explicitly deferred to Phase 32 — out of this phase's Nyquist scope (D-07).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 via `@nx/vitest:test` |
| **Config file** | `packages/angular-typechecker/vitest.config.mts` (unit `test` tier, `dependsOn: build`) |
| **Quick run command** | `nx test angular-typechecker` |
| **Full suite command** | `nx test angular-typechecker && nx typecheck angular-typechecker && nx lint angular-typechecker && nx format:check` |
| **Spec type-check (load-bearing)** | `tsc --noEmit -p packages/angular-typechecker/tsconfig.spec.json` (via `nx typecheck`) — `nx test` (Vitest/esbuild) does NOT type-check specs |
| **Estimated runtime** | ~5-6 seconds (unit tier, 523 tests); build dependency (`dependsOn: build`) dominates on a cold cache |

---

## Sampling Rate

- **After every task commit:** `nx test angular-typechecker`
- **After every plan wave:** `nx test angular-typechecker && nx typecheck angular-typechecker && nx lint angular-typechecker`
- **Before `/gsd:verify-work`:** full suite green + `nx format:check` + the require-graph guard (reads built `dist`, `dependsOn: build`)
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

Retroactively audited 2026-07-18 (post-execution, adversarial FORCE-stance pass). Every row
below was independently re-run this pass (not merely read from SUMMARY/VERIFICATION/SECURITY
prose) — see "Independent Audit Evidence" below the table. One genuine gap was found and
closed (see the MJ-01 row) — a real regression test that did not exist prior to this audit.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 31-01-01 | 01 | 1 | REP-02 (D-06) | — | `EXTENDED_DIAGNOSTIC_CATALOG` has exactly one entry per `EXTENDED_DIAGNOSTIC_MEMBERS` member, declaration order; positive+unique `ngCode`; non-empty `shortDescription` | unit | `nx test angular-typechecker` | ✅ `core/extended-catalog.spec.ts` | ✅ green |
| 31-01-01 | 01 | 1 | REP-02 (D-06) | — | integration spec sources `ngCode` from the catalog (single source, ENRICHED not stripped); 18 NG-code rows still fire behavior-identically | unit + integration | `nx test angular-typechecker` + `nx typecheck angular-typechecker` | ✅ `core/extended-catalog.integration.spec.ts` | ✅ green |
| 31-01-02 | 01 | 1 | REP-02 (D-01, D-04, D-05) | T-31-SC (supply chain) | valid SARIF 2.1.0: `version`, driver name/version/18-rule catalog, `node-sarif-builder` reached ONLY via `await import()` (`import type` only, no `@types/sarif`/`fs-extra`) | unit | `nx test angular-typechecker` | ✅ `core/sarif-report.spec.ts` | ✅ green |
| 31-01-02 | 01 | 1 | REP-02 (D-01) | T-31-03 false-pass | located diagnostic → `ruleId`/`level`/`message.text` + 1-based region, HAND-COUNTED off-by-one fixture (both start AND end axes, reused from `json-report.spec.ts`) | unit | `nx test angular-typechecker` | ✅ `core/sarif-report.spec.ts` ("maps a located diagnostic...") | ✅ green |
| 31-01-02 | 01 | 1 | REP-02 (D-01) | T-31-03 false-pass | file-less diagnostic → no-location result, NEVER dropped (`results.length === diagnostics.length`) | unit | `nx test angular-typechecker` | ✅ `core/sarif-report.spec.ts` ("never drops a file-less diagnostic...") | ✅ green |
| 31-01-02 | 01 | 1 | REP-02 (D-02) | T-31-01 info disclosure | every result carries `partialFingerprints['atcFingerprint/v1']` (sha256 hex), file-less included | unit | `nx test angular-typechecker` | ✅ `core/sarif-report.spec.ts` ("writes a versioned partialFingerprints...") | ✅ green |
| 31-01-02 | 01 | 1 | REP-02 (D-02) | T-31-03 correctness (MJ-01, code review) | two SAME-line, SAME-rule, SAME-message diagnostics get DISTINCT `atcFingerprint/v1` when columns differ (the collision the code review's MJ-01 finding fixed via `d3e1cd3`) | unit | `nx test angular-typechecker` | ✅ `core/sarif-report.spec.ts` ("gives two same-line, same-rule, same-message diagnostics DISTINCT fingerprints...") — **NEW this audit, see Gap Closed below** | ✅ green |
| 31-01-02 | 01 | 1 | REP-02 | severity mapping | `ts.DiagnosticCategory` → SARIF `level` (`error`/`warning`/`suggestion,message→note`) over all four categories | unit (data-driven) | `nx test angular-typechecker` | ✅ `core/sarif-report.spec.ts` ("maps each severity to its SARIF level...") | ✅ green |
| 31-01-02 | 01 | 1 | REP-02 (D-05) | T-31-02 tampering | no `\x1b` byte; byte-identical under `FORCE_COLOR=1`; full-shape golden snapshot with `driver.version` redacted | unit + snapshot | `nx test angular-typechecker` | ✅ `core/sarif-report.spec.ts` + `__snapshots__/sarif-report.spec.ts.snap` | ✅ green |
| 31-01-02 | 01 | 1 | VER-01 (D-07) | T-31-03 false-pass | coverage-incomplete `CoreResult` (`errorCount:0`/`success:false`) stays `success:false` while SARIF still emits one result per diagnostic (verdict never re-derived) | unit | `nx test angular-typechecker` | ✅ `core/sarif-report.spec.ts` ("never masks the verdict...") | ✅ green |
| 31-01-03 | 01 | 1 | REP-02 (D-03) | T-31-05 firewall regression | `render-report.ts` sarif branch dispatches to `formatSarifReport` via the REAL renderer (not mocked) — parseable SARIF 2.1.0, ANSI-free; Phase-31-throws test removed | unit | `nx test angular-typechecker` | ✅ `core/render-report.spec.ts` ("dispatches format:sarif...") | ✅ green |
| 31-01-03 | 01 | 1 | VER-01 (D-07) | T-31-03 false-pass | exit-code PARITY across `human`/`json`/`sarif` for the SAME stubbed `CoreResult`, incl. type-error (→1) AND coverage-incomplete (`errorCount:0`/`success:false` →1) | unit (stubbed core) | `nx test angular-typechecker` | ✅ `cli/main.spec.ts` ("FMT-02 / D-07: exit-code parity across --format human, json and sarif") | ✅ green |
| 31-02-01 | 02 | 2 | VER-04 (D-03) | T-31-05 firewall regression | static require-graph walk from BUILT `render-report.js` (shared seam) AND `bin.js` (CLI boot) never reaches `node-sarif-builder`/`fs-extra`; POSITIVE control proves `import('./sarif-report.js')` is present (laziness present, not merely absent) | test tier (reads dist) | `nx test angular-typechecker` (`dependsOn: build`) | ✅ `core/sarif-require-graph.spec.ts` | ✅ green |
| 31-02-02 | 02 | 2 | VER-04 (D-03) | T-31-06 interop drift | REAL (not mocked) `await import('node-sarif-builder')`; resolves 4 builders via `(mod.default ?? mod)`; minimal build serializes to `version:'2.1.0'` | test tier (real import) | `nx test angular-typechecker` | ✅ `core/sarif-report.interop.spec.ts` | ✅ green |
| 31-02-03 | 02 | 2 | VER-04 (D-05, A1) | T-31-07 manifest integrity | `@nx/dependency-checks` sees the lazy `await import('node-sarif-builder')` as used; `nx lint` green at `maxWarnings:0` with NO `ignoredDependencies` entry (resolved against the real lint, not inferred) | lint (real run) | `nx lint angular-typechecker` | N/A — resolve-at-execute, no file (`eslint.config.mjs` byte-unchanged, confirmed by `git status`) | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky.*

### Gap Closed This Audit

**MJ-01 fingerprint-collision regression (REP-02/D-02).** The phase's own code review
(`31-REVIEW.md`) found and the team fixed a real defect: `fingerprintOf`'s original tuple
(`code, file, message, line`) omitted `column`, so two distinct diagnostics sharing a rule +
an unparameterized message on the same source line (e.g. NG8102's fixed-string message
occurring twice on one line) produced an IDENTICAL `atcFingerprint/v1`, silently breaking
GitHub Code Scanning's per-alert tracking guarantee. Commit `d3e1cd3` fixed the recipe
(added `column` to the tuple) and regenerated the golden snapshot, but neither that commit
nor the code-review resolution added a targeted regression test asserting the two colliding
diagnostics now get DISTINCT fingerprints — the existing suite only asserted fingerprint
*shape* (`/^[0-9a-f]{64}$/`), never *uniqueness* under the exact collision precondition. The
phase's own SECURITY.md explicitly filed this under "Unregistered Flags" as "a correctness
invariant, not a new vulnerability surface" — i.e., squarely Nyquist's job, not security's,
and it was unfilled.

This audit added
`core/sarif-report.spec.ts` > `'gives two same-line, same-rule, same-message diagnostics
DISTINCT fingerprints when their columns differ (D-02 collision fix)'`: two synthetic
diagnostics at the same line, same `ruleId`, same `message.text`, different `startColumn`
→ asserts `partialFingerprints['atcFingerprint/v1']` differs. Verified adversarially: a
standalone Node script confirmed the pre-fix tuple (no column) DOES collide for this exact
input (`hash(A) === hash(B)` → `true`), and the post-fix tuple (with column) does not
(`hash(A) === hash(B)` → `false`) — so this test is capable of failing and would have caught
the shipped MJ-01 defect had it existed at review time. `nx test`, `nx typecheck`, `nx lint`,
`nx format:check` all green after adding it (523 tests, was 522).

### Independent Audit Evidence (adversarial re-run, 2026-07-18)

Every command below was executed fresh during this audit (clean working tree beforehand,
`git status --short` empty), not sourced from prior SUMMARY/VERIFICATION/SECURITY prose:

| Command | Result |
|---------|--------|
| `nx test angular-typechecker` (before the new test) | 50 files, 522 tests passed |
| `nx test angular-typechecker --testFile=sarif-report.spec.ts` (after adding the gap-fill test) | 9/9 passed |
| `nx test angular-typechecker --skip-nx-cache` (full suite, after adding the gap-fill test) | 50 files, 523 tests passed |
| `nx typecheck angular-typechecker --skip-nx-cache` | green (spec + drift + tools tsconfigs) |
| `nx lint angular-typechecker --skip-nx-cache` | green (`maxWarnings:0`) |
| `nx format:check` | green (after `nx format:write` on the new spec file) |
| Standalone Node script recomputing `fingerprintOf`'s sha256 tuple with/without `column` for the same two-diagnostic collision fixture | pre-fix tuple collides (`true`); post-fix tuple distinct (`false`) — proves the new test is behaviorally load-bearing, not vacuous |

Source files read in full and cross-checked against the must-haves in `31-01-PLAN.md` /
`31-02-PLAN.md`: `core/sarif-report.ts`, `core/extended-catalog.ts`,
`core/render-report.ts`, `core/sarif-require-graph.spec.ts`,
`core/sarif-report.interop.spec.ts`, `core/extended-catalog.spec.ts`, `cli/main.spec.ts`
(the FMT-02/D-07 block), `31-REVIEW.md`, `31-SECURITY.md`. Every other requirement slice
named in the phase's must-haves already had a real, passing, behavior-proving test on disk
(shape, off-by-one, file-less-never-dropped, no-ANSI, exit-parity, require-graph firewall +
positive control, real-import interop, catalog completeness/uniqueness). Only the MJ-01
fingerprint-collision case lacked a regression test; it is now closed.

---

## Wave 0 Requirements

All satisfied on disk prior to this audit, EXCEPT the one gap closed above:

- [x] `core/sarif-report.spec.ts` — shape/golden/off-by-one/no-ANSI/file-less/exit-parity (REP-02, VER-01)
- [x] `core/sarif-report.spec.ts` — fingerprint-collision regression (REP-02/D-02, MJ-01) — **added this audit**
- [x] `core/sarif-report.interop.spec.ts` — REAL-import interop (VER-04)
- [x] `core/sarif-require-graph.spec.ts` — static require-graph guard + positive control (VER-04)
- [x] `core/extended-catalog.spec.ts` — one entry per `EXTENDED_DIAGNOSTIC_MEMBERS`, positive + UNIQUE `ngCode`, non-empty description
- [x] `core/render-report.spec.ts` — real-renderer `format:'sarif'` dispatch (Phase-31-throws test replaced)
- [x] `cli/main.spec.ts` — FMT-02/D-07 parity block extended with the `--format sarif` arm (both type-error and coverage-incomplete legs)
- No framework install needed (Vitest already present)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| — | — | — | — |

*All phase behaviors have automated verification. Full SARIF 2.1.0 schema validation,
cross-OS/Node byte-determinism, and the shipped-tarball e2e are explicitly DEFERRED to
Phase 32 (VER-02/VER-03) — out of this phase's Nyquist scope (D-07), not a gap here.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-07-18 (adversarial FORCE-stance audit) — 1 genuine gap found
(MJ-01 fingerprint-collision regression, REP-02/D-02) and closed with a real, passing,
independently-verified-capable-of-failing test. All other REP-02/VER-04/VER-01(SARIF-slice)
behaviors already had real tests on disk. No implementation touched.
