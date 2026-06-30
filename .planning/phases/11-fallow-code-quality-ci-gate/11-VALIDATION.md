---
phase: 11
slug: fallow-code-quality-ci-gate
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-30
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> This phase delivers a CI workflow GATE (a new `fallow` job in `ci.yml`), a `.fallowrc.jsonc`
> config, a root `fallow` devDependency, and an `act-compat.sh` assertion — NOT application
> source. So "tests" here = workflow static-validation (actionlint), trigger/selection fidelity
> (act dry-run), and the live gate command's exit code (`npx fallow audit --base origin/main`).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | GitHub Actions validation: `actionlint` 1.7.7 (static) + `act` v0.2.89 (`--validate` parse + `-n` dry-run selection) + `fallow@2.103.0` audit (the gate itself) |
| **Config file** | `.fallowrc.jsonc` (created this phase, repo root); `tools/act/act-compat.sh` (extended); `.github/workflows/ci.yml` (extended) |
| **Quick run command** | `npx fallow audit --base origin/main` (must exit 0) |
| **Full suite command** | `./actionlint -color && bash tools/act/act-compat.sh && npx fallow audit --format json --base origin/main` |
| **Estimated runtime** | ~30-60 seconds (fallow ~1.3s; actionlint ~1s; act dry-run a few s; npm ci dominates on a cold tree) |

---

## Sampling Rate

- **After every task commit:** Run `npx fallow audit --base origin/main` (config/finding-resolution tasks) and/or `./actionlint -color` (workflow-edit tasks).
- **After every plan wave:** Run the full suite command above.
- **Before `/gsd:verify-work`:** Full suite green AND a real green `ci` run on the PR (act's `needs.*.result`/skipped semantics diverge from GitHub — the aggregate gate's arithmetic is only authoritative on a real run).
- **Max feedback latency:** ~60 seconds locally.

---

## Per-Task Verification Map

> Task IDs are assigned by the planner; rows below are requirement-level and are refined into
> per-task rows by `/gsd-validate-phase` after execution.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-XX | config | — | QUAL-02 | — | False positives suppressed + genuine findings resolved; gate green | integration | `npx fallow audit --base origin/main` exits 0 | ❌ W0 (.fallowrc.jsonc) | ⬜ pending |
| 11-XX | ci-job | — | QUAL-01 | T-11 (untrusted-PR; least-privilege; SHA-pin) | New `fallow` job in `ci` needs:+gate; path-gated; fails on introduced findings | static + selection | `./actionlint -color`; `bash tools/act/act-compat.sh` (selects `ci/fallow`) | ❌ W0 (ci.yml edit) | ⬜ pending |
| 11-XX | tooling | — | QUAL-03 | T-11 | fallow exact-pinned root devDep; act asserts `ci/fallow`; security posture preserved | static | `bash tools/act/act-compat.sh`; `git grep -n '"fallow"' package.json` (exact version) | ❌ W0 (package.json) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Pin `fallow@2.103.0` as an exact root `devDependency` and `npm ci` so `npx fallow` resolves the locked version (prerequisite for the audit command to run reproducibly).
- [ ] `actionlint` 1.7.7 and `act` v0.2.89 are already provisioned by the existing `lint-workflows` / `act-compat` CI jobs and `tools/act/act-compat.sh` — no new framework install needed for workflow validation.

*Existing CI infrastructure (actionlint + act-compat) covers workflow validation; the only new tool is the pinned `fallow` devDependency.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The gate actually FAILS a PR that introduces dead code | QUAL-01 | act's `needs.*.result`/skipped semantics diverge from GitHub; the aggregate `ci` pass/fail arithmetic is only authoritative on a real GitHub run (per ci.yml header caveat) | On a throwaway branch, add an obviously-unused exported symbol, push a draft PR, confirm the `fallow` job (and thus `ci`) goes red; then confirm a clean PR is green. |
| Gate is green on adoption (the whole point) | QUAL-02 | Confirmed locally via `fallow audit` exit 0, but the canonical proof is the Phase 11 PR's own `ci` run being green | Observe the Phase 11 PR's `ci` check is green with the new `fallow` job present. |

*Local `npx fallow audit --base origin/main` exit-0 is the fast automated proxy; the real-PR green run is the authoritative confirmation.*

---

## Validation Sign-Off

- [ ] Each QUAL requirement has an automated verify command (fallow exit code / actionlint / act-compat) or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers the fallow devDependency install
- [ ] No watch-mode flags (all commands are one-shot)
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter (by `/gsd-validate-phase` post-execution)

**Approval:** pending
