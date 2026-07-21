---
phase: 35
slug: automated-code-scanning-proof
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-21
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Sourced from `35-RESEARCH.md` ## Validation Architecture. Task-level rows are
> finalized during planning / `/gsd:validate-phase`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x via `@nx/vitest:test` |
| **Config file** | `packages/angular-typechecker/vitest.config.mts` (unit / `test`); `vitest.integration.config.mts` (`integration` target) |
| **Quick run command** | `npx nx run-many -t test` |
| **Full suite command** | `npx nx run-many -t test && npx nx run-many -t integration` |
| **Estimated runtime** | ~60-120 seconds (unit) + integration tier |

**KEY:** `nx test` EXCLUDES `*.integration.spec.ts`; the integration tier runs under the separate `integration` target. The recommended local drift-lock is an INTEGRATION spec (real cold compiler over the fixture), so it runs under `nx integration`, not `nx test`.

---

## Sampling Rate

- **After every task commit:** Run `npx nx run-many -t test` (fast unit tier) + `npx nx integration angular-typechecker` when the drift-lock spec changes.
- **After every plan wave:** Run `npx nx run-many -t test && npx nx run-many -t integration` + `npx nx format:check` + `npx nx run-many -t lint` + `npx fallow audit --format human --base origin/main` (catches the fallow/Prettier fixture landmines BEFORE the PR).
- **Before `/gsd:verify-work`:** Full suite must be green.
- **Phase gate (authoritative):** the `code-scanning-proof` job GREEN on a real PR against `main` — the ONLY place the SARIF->ingestion assertion is exercised.
- **Max feedback latency:** ~120 seconds (local); real-CI ingestion adds async latency (bounded poll).

---

## Per-Task Verification Map

> Task IDs assigned by the planner (Phase 35 not yet planned when this was drafted). Requirement-level rows below map each PROOF requirement to its test tier; `/gsd:validate-phase` finalizes the per-task grid.

| Task ID | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD (plan) | 1 | PROOF-01 | — | fixture emits exactly one diagnostic per family; SARIF carries the 4 (tag, severity) tuples | integration (drift-lock) | `npx nx integration angular-typechecker` | ❌ W0 | ⬜ pending |
| TBD (plan) | 1 | PROOF-01 | — | pure alert-matching logic (set-membership over a mock alerts payload) | unit | `npx nx test` (assert-code-scanning matcher) | ❌ W0 | ⬜ pending |
| TBD (plan) | 1 | PROOF-01 | T-35 fixture-error-isolation | fixture is OUTSIDE the Nx graph (no `project.json`) | structural | `nx show projects` excludes it | n/a | ⬜ pending |
| TBD (plan) | 1 | PROOF-01/02 | T-35 fork/scope/token | SARIF->Code Scanning ingestion; alerts land with category/tag/severity | **real-CI-only** | `code-scanning-proof` job on a PR (`assert-code-scanning.mjs`) | ❌ W0 | ⬜ pending |
| TBD (plan) | 1 | PROOF-02 | — | assert exits non-zero on missing tuple / timeout | unit + real-CI | matcher unit test (negative) + job red when a family is removed | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tools/sarif-proof-fixture/**` — the isolated fixture (solution `tsconfig.json` + surviving leaf tsconfig + sources), NO `project.json`.
- [ ] `tools/ci/assert-code-scanning.mjs` — the `gh api` poll + set-membership assert.
- [ ] `.github/workflows/ci.yml` — the `code-scanning-proof` job.
- [ ] `machine-reporters-sarif.integration.spec.ts` (extend) OR a new sibling — the local drift-lock (RECOMMENDED).
- [ ] `assert-code-scanning` matcher unit test (RECOMMENDED) — proves the pure tuple-matching logic incl. the negative/RED case without hitting GitHub.
- [ ] `.fallowrc.jsonc` — `overrides` scoping off the unused/unresolved rules for `tools/sarif-proof-fixture/**` (fallow landmine).
- [ ] `.prettierignore` — add the fixture files if their reflow is diagnostic-sensitive (Prettier landmine).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SARIF alerts land in GitHub Code Scanning with the expected category/tags/severity | PROOF-01/02 | GitHub ingestion is a live external service; local gates cannot prove it (standing SARIF-dogfood lesson) | Automated in CI via the `code-scanning-proof` job on a real PR; verify the job is GREEN and, if diagnosing, `gh api repos/LayZeeDK/angular-typechecker/code-scanning/alerts?ref=refs/pull/<n>/merge` |

*The CI job automates this; it is "manual-only" only in that it cannot run in the local unit/integration tiers.*

---

## The Nyquist point (load-bearing)

The phase's PRIMARY behavior — "the SARIF contract lands in GitHub Code Scanning" — is provable ONLY in real CI, on a `pull_request`. Local gates (schema validation, the drift-lock spec, actionlint, act-compat) prove the SARIF is well-formed and carries the right tags, but CANNOT prove GitHub ingested it and surfaced the alerts (standing SARIF-dogfood lesson: local gates all pass while GitHub still rejects). The drift-lock spec is the fast local tripwire; the CI job is the authoritative gate.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency acceptable (local < 120s; real-CI ingestion bounded-poll)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
