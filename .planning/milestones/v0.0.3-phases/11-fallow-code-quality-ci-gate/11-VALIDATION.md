---
phase: 11
slug: fallow-code-quality-ci-gate
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-30
updated: 2026-06-30
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> This phase delivers a CI workflow GATE (a new `fallow` job in `ci.yml`), a `.fallowrc.jsonc`
> config, a root `fallow` devDependency, and an `act-compat.sh` assertion — NOT application
> source. So "tests" here = workflow static-validation (actionlint), trigger/selection fidelity
> (act dry-run), and the live gate command's exit code (`npx fallow audit --base origin/main`).

---

## Test Infrastructure

| Property               | Value                                                                                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | GitHub Actions validation: `actionlint` 1.7.7 (static) + `act` v0.2.89 (`--validate` parse + `-n` dry-run selection) + `fallow@2.103.0` audit (the gate itself) |
| **Config file**        | `.fallowrc.jsonc` (created this phase, repo root); `tools/act/act-compat.sh` (extended); `.github/workflows/ci.yml` (extended)                                  |
| **Quick run command**  | `npx fallow audit --base origin/main` (must exit 0)                                                                                                             |
| **Full suite command** | `./actionlint -color && bash tools/act/act-compat.sh && npx fallow audit --format json --base origin/main`                                                      |
| **Estimated runtime**  | ~30-60 seconds (fallow ~1.3s; actionlint ~1s; act dry-run a few s; npm ci dominates on a cold tree)                                                             |

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

| Task ID | Plan    | Wave | Requirement | Threat Ref    | Secure Behavior                                                                      | Test Type               | Automated Command                                                                                                 | File Exists                   | Status                                    |
| ------- | ------- | ---- | ----------- | ------------- | ------------------------------------------------------------------------------------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------- |
| 11-01   | config  | 1    | QUAL-02     | T-11-01/02/SC | False positives suppressed + genuine findings resolved; gate green                   | integration             | `npx fallow audit --format json --base origin/main` exits 0 (verified: verdict pass, 0 findings)                  | ✅ .fallowrc.jsonc            | ✅ green                                  |
| 11-02   | ci-job  | 2    | QUAL-01     | T-11-03..07   | New `fallow` job in `ci` needs:+gate; path-gated; runs the audit on every PR         | static + selection (CI) | CI `lint-workflows` (`./actionlint -color`); CI `act-compat` (`bash tools/act/act-compat.sh` selects `ci/fallow`) | ✅ ci.yml                     | ⬜ CI-pending                             |
| 11-02   | tooling | 2    | QUAL-03     | T-11-01/03    | fallow exact-pinned root devDep; act asserts `ci/fallow`; security posture preserved | static                  | `git grep -n '"fallow": "2.103.0"' package.json` (exact, verified); `act --validate` (verified); CI `act-compat`  | ✅ package.json/act-compat.sh | ✅ green (local) / ⬜ CI-pending (act -n) |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · CI-pending = automated but runs in CI (actionlint/Docker absent on the arm64 dev box)_

> **Coverage verdict:** ongoing regression is FULLY AUTOMATED — the `fallow` CI job runs `fallow audit` on every PR (proven live: `fallow dead-code` finds 24 issues / exit 1, so the gate is not a no-op), and the `lint-workflows` + `act-compat` jobs auto-verify the wiring. The single MANUAL item is the ONE-TIME adoption red/green proof (act's aggregate-gate arithmetic diverges from GitHub) — tracked in 11-HUMAN-UAT.md item 1, not an ongoing coverage gap.

---

## Wave 0 Requirements

- [ ] Pin `fallow@2.103.0` as an exact root `devDependency` and `npm ci` so `npx fallow` resolves the locked version (prerequisite for the audit command to run reproducibly).
- [ ] `actionlint` 1.7.7 and `act` v0.2.89 are already provisioned by the existing `lint-workflows` / `act-compat` CI jobs and `tools/act/act-compat.sh` — no new framework install needed for workflow validation.

_Existing CI infrastructure (actionlint + act-compat) covers workflow validation; the only new tool is the pinned `fallow` devDependency._

---

## Manual-Only Verifications

| Behavior                                               | Requirement | Why Manual                                                                                                                                                                  | Test Instructions                                                                                                                                                     |
| ------------------------------------------------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The gate actually FAILS a PR that introduces dead code | QUAL-01     | act's `needs.*.result`/skipped semantics diverge from GitHub; the aggregate `ci` pass/fail arithmetic is only authoritative on a real GitHub run (per ci.yml header caveat) | On a throwaway branch, add an obviously-unused exported symbol, push a draft PR, confirm the `fallow` job (and thus `ci`) goes red; then confirm a clean PR is green. |
| Gate is green on adoption (the whole point)            | QUAL-02     | Confirmed locally via `fallow audit` exit 0, but the canonical proof is the Phase 11 PR's own `ci` run being green                                                          | Observe the Phase 11 PR's `ci` check is green with the new `fallow` job present.                                                                                      |

_Local `npx fallow audit --base origin/main` exit-0 is the fast automated proxy; the real-PR green run is the authoritative confirmation._

---

## Validation Sign-Off

- [x] Each QUAL requirement has an automated verify command (fallow exit code / actionlint / act-compat) or a Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers the fallow devDependency install (fallow@2.103.0 pinned + installed in plan 11-01)
- [x] No watch-mode flags (all commands are one-shot)
- [x] Feedback latency < 60s (fallow audit ~1.3s; actionlint ~1s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-06-30

---

## Validation Audit 2026-06-30

| Metric                   | Count                                                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Requirements audited     | 3 (QUAL-01, QUAL-02, QUAL-03)                                                                                                |
| Covered (automated)      | 3 (ongoing CI regression: fallow job + lint-workflows + act-compat)                                                          |
| Partial                  | 0                                                                                                                            |
| Missing                  | 0                                                                                                                            |
| New test files generated | 0 (CI-gate phase — no unit-testable app code; act-compat.sh + actionlint + the fallow job ARE the validation infrastructure) |
| Manual-only (one-time)   | 1 (adoption red/green proof on a real PR — 11-HUMAN-UAT.md item 1; tracked, not a coverage gap)                              |

**Verdict:** NYQUIST-COMPLIANT for ongoing regression (every PR is auto-gated). The auditor was NOT spawned — there were no fillable gaps (no application code to unit-test; generating a test for "CI fails on dead code" would duplicate the existing `act-compat` job and the real-PR gate). State A audit performed inline against the shipped artifacts.
