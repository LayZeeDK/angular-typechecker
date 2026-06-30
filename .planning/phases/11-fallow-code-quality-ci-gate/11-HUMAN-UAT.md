---
status: partial
phase: 11-fallow-code-quality-ci-gate
source: [11-VERIFICATION.md]
started: 2026-06-30
updated: 2026-06-30
---

## Current Test

[awaiting human / real-PR + CI testing]

## Tests

> All 14 automated must-haves are VERIFIED against the shipped code (see 11-VERIFICATION.md).
> These 5 items require a real GitHub PR run or local tooling not available on the Windows arm64
> dev box (Docker / actionlint). They are the documented Manual-Only verifications from
> 11-VALIDATION.md plus the code-review WR-01 Warning, consistent with the Phase 6/7 CI-gate precedent.

### 1. Gate fails a PR that introduces dead code (QUAL-01 authoritative)
expected: On a throwaway branch, add an obviously-unused exported symbol and open a draft PR; the `fallow` job (and thus the `ci` aggregate) goes RED.
result: [pending]

### 2. Gate is green on adoption (QUAL-02 canonical proof)
expected: The Phase 11 PR's own `ci` check is GREEN with the new `fallow` job present (a clean tree introduces 0 findings).
result: [pending]

### 3. origin/main resolves in the fallow job's CI checkout (WR-01, code-review Warning)
expected: On a real draft PR, the `fallow` job's `npx fallow audit --base origin/main` resolves `origin/main` (merge-base) under `actions/checkout@v5` + `fetch-depth: 0` — no "base ref not found" error and correct new-vs-inherited attribution. (Locally it resolves to 1e37d55; robustness-only, no proven defect.)
result: [pending]

### 4. actionlint passes on the new fallow job
expected: The CI `lint-workflows` job (`./actionlint -color`) is GREEN with the new job present. (Deferred to CI — actionlint is not provisioned on the dev box; `act --validate` passed locally.)
result: [pending]

### 5. act -n selects ci/fallow on pull_request
expected: The CI `act-compat` job's `bash tools/act/act-compat.sh` passes, selecting `ci/fallow` on the pull_request dry-run plan. (Deferred to CI — Docker unavailable locally.)
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
