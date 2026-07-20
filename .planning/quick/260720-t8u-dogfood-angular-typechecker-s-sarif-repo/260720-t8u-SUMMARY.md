---
quick_id: 260720-t8u
title: Dogfood angular-typechecker + fallow SARIF to GitHub Code Scanning in CI
status: complete
date: 2026-07-20
---

# Summary: SARIF -> GitHub Code Scanning

## What changed

Added a single dedicated `code-scanning` job to `.github/workflows/ci.yml` that:

1. Builds `angular-typechecker` and runs its own standalone CLI
   (`--format sarif`) on this repo's real Angular app (`apps/ng-spike-app`) --
   **dogfooding** the SARIF reporter.
2. Runs `fallow audit --format sarif -o fallow.sarif` to produce fallow's SARIF.
3. Uploads BOTH reports to GitHub Code Scanning via the SHA-pinned
   `github/codeql-action/upload-sarif@...# v3.37.1`, each under a distinct
   `category` (`angular-typechecker`, `fallow`).

`tools/act/act-compat.sh` gained two `assert_selected "...ci/code-scanning..."`
lines locking the new job's trigger fidelity on `pull_request` and `push-main`.

## Key design points

- **Least privilege:** top-level `contents: read` untouched; `security-events:
  write` is job-level only (restating `contents: read` for checkout).
- **Not a merge gate:** the job is deliberately absent from the required `ci`
  aggregate's `needs`, so a Code Scanning outage or fork-PR upload skip can never
  deadlock the PR-only merge button. The real gates (type-check in `test`, fallow
  new-only in `fallow`) are byte-unchanged.
- **Fork-PR safe:** uploads gate on `github.event.pull_request.head.repo.fork ==
  false` (read-only token on fork PRs can't write security events); the analysis
  still runs, only the upload skips. No PR metadata is interpolated into any shell.
- **Distinct categories** keep the two tools' analyses separate from each other and
  from the repo's existing CodeQL default-setup analyses.

## Review findings addressed

- **MED-01 (fixed):** on an infra/usage exit (angular-typechecker exit 2 -> empty
  stdout) the `>` redirect leaves a 0-byte file that would fail `upload-sarif`. Each
  generation step now tolerates a non-zero exit (`|| true`) and publishes a
  `produced` output that is `true` only when a NON-EMPTY SARIF exists (`[ -s <file>
  ]`). Uploads gate on `produced == 'true'`, so exit 0/1 (valid file) upload and
  exit 2 (empty) skips -- without wrongly skipping the exit-1 verdict-fail case that
  the reviewer's `outcome == 'success'` suggestion would have dropped.
- **LOW-01 (fixed):** `FALLOW_AUDIT_BASE` moved from job-level to step-level on the
  fallow step, matching the existing `fallow` job's convention.

## Verification

Local (all green):
- `actionlint` exit 0 (validates the new job, job-level permissions, the fork-PR
  expression, and shellchecks the new `run:` bash).
- `tools/act/act-compat.sh` PASSED 16/16 -- incl. `ci/code-scanning SELECTED` on
  both `pull_request` and `push-main`.
- Full plugin test suite 552/552 passed, incl. the `ci.yml`-reading guard specs
  (`ci-e2e-coverage-guard`, `nx-surface-regression`).
- Both SARIFs regenerate as valid SARIF 2.1.0 (drivers `angular-typechecker` /
  `fallow`), then deleted (never committed).

Real CI (authoritative -- CONFIRMED on PR #49):

- First run (`feaf750`): `Upload angular-typechecker SARIF` succeeded (analysis live,
  category `angular-typechecker`); `Upload fallow SARIF` FAILED with "The CodeQL
  Action does not support uploading multiple SARIF runs with the same category"
  (GitHub 2025-07-21 change). Local gates could not catch this -- only a real
  upload surfaces GitHub's SARIF-ingestion rules. This is exactly what the
  "verify in a real CI run" requirement exists to catch.
- Fix (`b3f83ff`): fallow emits two runs (dead-code + complexity) in one file;
  tag each with a distinct `automationDetails.id` and upload WITHOUT a `category`
  input (angular-typechecker's single-run upload keeps its explicit category).
- Second run (`29772901045`, `b3f83ff`): `code-scanning` job fully green -- BOTH
  `Upload angular-typechecker SARIF` and `Upload fallow SARIF` succeeded, and
  `gh api .../code-scanning/analyses?tool_name=angular-typechecker` AND
  `?tool_name=fallow` both return analyses on PR #49's ref. BOTH SUBMITTED (PASS).

## Notes

- `main` is PR-only (empty-bypass ruleset): committed on branch
  `gsd/quick-260720-t8u-code-scanning-sarif`, PR opened. NOT merged (self-merge
  needs explicit user OK); no environment/deployment approved.
- No package-file changes -> no `angular-typechecker` version bump (attribution is
  by files changed; this touches `.github/` + `tools/` only).
