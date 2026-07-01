---
phase: 3
slug: filtering-modes-output-quality-gates
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-28
validated: 2026-06-28
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `03-RESEARCH.md` `## Validation Architecture`. The Per-Task Verification Map
> is finalized post-planning (task IDs come from the plans); the requirement->test map below is
> the planning-time contract.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x via `@nx/vitest:test` |
| **Config file** | `packages/angular-typechecker/vitest.config.mts` (`include: ['{src,tests}/**/*.{test,spec}.{...}']`) |
| **Quick run command** | `npx nx test angular-typechecker -- <file>.spec.ts` |
| **Full suite command** | `npx nx test angular-typechecker` |
| **Lint gate** | `npx nx lint angular-typechecker` (+ `npx prettier --check .`) |
| **Estimated runtime** | ~10-20 seconds (pure-function unit tier dominates; one real-compiler integration extension) |

---

## Sampling Rate

- **After every task commit:** Run the single new/edited spec, e.g. `npx nx test angular-typechecker -- filter-diagnostics.spec.ts`
- **After every plan wave:** Run `npx nx test angular-typechecker` + `npx nx lint angular-typechecker`
- **Before `/gsd:verify-work`:** Full unit suite green AND lint clean (SC5)
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

> Finalized during planning / validate-phase once plan task IDs exist. The requirement->test
> contract that every task must map onto:

| Req ID | Behavior | Test Type | Automated Command | Status |
|--------|----------|-----------|-------------------|--------|
| EXE-04 | in-project kept; out-of-project + `node_modules` suppressed; `node_modules-tools` NOT misclassified; file-less kept; `includeDeps: true` folds back | unit (pure) | `npx nx test angular-typechecker -- filter-diagnostics.spec.ts` | ✅ (7 cases) |
| OUT-02 | realpath-first + case-fold canonicalization; segment containment; `.ngtypecheck.ts` shadow kept | unit (pure, injected realpath) | `npx nx test angular-typechecker -- filter-diagnostics.spec.ts` | ✅ |
| EXE-03 | report-all default; fail-fast truncates REPORTED list at first Error (NOT a gather short-circuit) | unit (pure) | `npx nx test angular-typechecker -- format-report.spec.ts` | ✅ (fail-fast case L176) |
| EXE-05 | errors always fail; `maxWarnings` threshold; `maxWarnings: 0` fails on any warning; categories respected | unit (pure) | `npx nx test angular-typechecker -- evaluate-result.spec.ts` | ✅ (9 cases) |
| OUT-01 | output contains NG codes + codeframes via `ng.formatDiagnostics` | unit (injected `formatDiagnostics`) | `npx nx test angular-typechecker -- format-report.spec.ts` | ✅ |
| OUT-03 | sorted alphabetical-by-file (file-less first); idempotent (byte-identical on repeat); ANSI stripped when `color: false` | unit (pure) | `npx nx test angular-typechecker -- format-report.spec.ts` | ✅ (11 cases) |
| EXE-04 / D-02 | `runTypecheck` returns FILTERED+SORTED diagnostics + `suppressedCount`; counts POST-filter | integration (real compiler) | `npx nx test angular-typechecker -- run-typecheck.integration.spec.ts` | ✅ (sibling-import fixture) |
| TEST-01 | the unit tier exists, covering gatherer/filter/resolution/modes/maxWarnings | meta (suite presence) | `npx nx test angular-typechecker` | ✅ (16 files / 74 tests) |
| WS-04 | ESLint `core/**` import ban + `@nx/dependency-checks` + Prettier; lint clean | lint gate | `npx nx lint angular-typechecker` | ✅ (exit 0; ban proven live by verifier negative control) |
| WR-01 | boundary-filter `basePath` never falls back to `''` (filter stays active when parsed basePath is missing) | unit (pure) | `npx nx test angular-typechecker -- run-typecheck.spec.ts` | ✅ (4 cases; code-review follow-up) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `packages/angular-typechecker/src/core/filter-diagnostics.spec.ts` — covers EXE-04, OUT-02 (7 cases)
- [x] `packages/angular-typechecker/src/core/evaluate-result.spec.ts` — covers EXE-05 (9 cases)
- [x] `packages/angular-typechecker/src/core/format-report.spec.ts` — covers EXE-03, OUT-01, OUT-03 (11 cases)
- [x] EXTENDED `run-typecheck.integration.spec.ts` — asserts `suppressedCount` + POST-filter counts via the new `fixtures/sibling-import/` (main-lib importing a sibling dependency-lib via `paths`), kept under `fixtures/` (not a Nx-excluded dir)
- [x] ESLint `core/**` `no-restricted-imports` override added to `packages/angular-typechecker/eslint.config.mjs` (incl. type-only ban; + no-console + process.exit ban)
- [x] Framework install: none (Vitest + ESLint plugins already present — confirmed zero dependency changes)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| pnpm-symlink + mixed-case path realpath/case-fold backstop | OUT-02 | Requires a pnpm workspace + case-sensitive FS matrix | DEFERRED to Phase 6 e2e (TEST-03, CI-01) — not run in Phase 3 |

*All Phase-3-scoped behaviors have automated verification; the cross-OS path backstop is intentionally deferred to the Phase 6 e2e matrix.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-28; `wave_0_complete: true` confirmed post-execution.

---

## Validation Audit 2026-06-28

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 (no gaps to fill) |
| Escalated | 0 |

Post-execution audit (State A). Every Phase-3 requirement maps to a green
automated test; the full suite is 16 files / 74 tests passing and the WS-04 lint
gate exits 0 (the `core/**` import ban proven live by the verifier's negative
control). No MISSING or PARTIAL gaps, so the gsd-nyquist-auditor was not spawned
(Step 3 no-gaps short-circuit). The only manual-only item (pnpm-symlink +
mixed-case path backstop, OUT-02) remains intentionally deferred to the Phase 6
e2e matrix (TEST-03/CI-01). `wave_0_complete` flipped false -> true.
