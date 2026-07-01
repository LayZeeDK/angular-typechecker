---
quick_id: 260701-shh
description: Add CI format:check + lint jobs (nx-set-shas base/head), bake maxWarnings:0, format whole repo, bump outdated actions
date: 2026-07-01
branch: gsd/v0.0.4-typecheck-generator-and-extended-testing
status: complete
---

# Quick Task 260701-shh - Summary

## What shipped (5 atomic commits)

| Commit    | Type          | What                                                                        |
| --------- | ------------- | --------------------------------------------------------------------------- |
| `c2afbe7` | `chore`       | `.prettierignore`: exclude lockfiles + the 2 diagnostic-sensitive templates |
| `34651b5` | `style`       | Prettier over the whole repo (`nx format:write --all`), 377 files           |
| `fe18fbb` | `chore(lint)` | Bake `maxWarnings:0` into `@nx/eslint:lint` + clear the 2 warnings          |
| `151c876` | `chore(deps)` | Bump `actions/checkout` 5.0.1->7.0.0, `actions/setup-node` 5.0.0->6.4.0     |
| `4f0ccdf` | `ci`          | New `format-lint` job (nx-set-shas base/head) + act-compat assertion        |

## Requirement coverage

1. **CI jobs for `nx format:check` + `nx run-many -t lint`** -- new `format-lint`
   job in `ci.yml` (Linux, Node 24), path-gated (`needs: changes`,
   `if: code != 'false'`) like `test`/`e2e`/`fallow`, and folded into the required
   `ci` aggregate's `needs`.
2. **nrwl/nx-set-shas for `--base`/`--head`** -- `nrwl/nx-set-shas@v5.0.1`
   (SHA-pinned) with `id: nx-shas`; `nx format:check` runs with
   `--base=${{ steps.nx-shas.outputs.base }} --head=${{ steps.nx-shas.outputs.head }}`.
   `fetch-depth: 0` on checkout so it can resolve the base commit.
3. **Update outdated actions (Dependabot)** -- applied both open Dependabot PRs as
   SHA-pins (checkout 7×, setup-node 4× across `ci.yml` + `release.yml`).
   Supersedes Dependabot PRs #1 and #2.

## Decisions (all user-confirmed)

- **Format scope:** whole repo (`nx format:write --all`). Prettier had never been
  run here (380 files unformatted).
- **`maxWarnings:0`:** baked into the `@nx/eslint:lint` targetDefaults (verified
  resolved on both projects) -- NOT passed as a CI flag (per user: avoid the flag).
- **Lint warnings:** the phantom `To` type parameter in the two `AssertAssignable`
  drift tripwires -- resolved with a scoped `eslint-disable-next-line` + rationale
  (its `extends From` constraint IS the assertion; removing it would break the tripwire).
- **Branch:** kept on `gsd/v0.0.4-...` (no new branch, no worktree).

## Caveats / deviations (flagged)

- **Two fixture templates are NOT Prettier-owned** (the one deviation from "format
  everything"): `fixtures/extended-batch-fn/error.component.html` and
  `fixtures/extended-batch-expression/error.component.html`. Reformatting them
  dropped NG8111 and NG8114 respectively, failing the exact-count assertions in
  `extended-catalog.integration.spec.ts` (verified empirically). The other 3
  reformatted templates (composite-triangle, extended-promoted, extended-v13) are
  diagnostic-neutral and ARE formatted. Generated lockfiles are also ignored.
- **Action bumps are major-version jumps** (checkout v5->v7, setup-node v5->v6).
  Applied verbatim from Dependabot; behavior validated by act-compat + the CI matrix
  on the PR.
- **e2e suite not run locally** (heavy tarball/pnpm installs). The format sweep only
  reformatted e2e `.ts` spec files (whitespace-only) and left the consumer-workspace
  `pnpm-lock.yaml` untouched, so the risk is low; CI's `e2e` job is the gate.
- **`format-lint` is path-gated**, so a planning/docs-only PR skips it (consistent
  with the repo's D-08 design and the `ci` aggregate's skipped-tolerance).

## Verification (local, authoritative)

- `nx format:check --all` -> exit 0 (whole repo Prettier-clean)
- `nx run-many -t lint` (no flag) -> exit 0, 0 warnings (maxWarnings:0 resolved on both projects)
- `nx run-many -t test -p angular-typechecker` -> 214 passed / 214
- `nx typecheck-drift angular-typechecker` -> pass (drift tripwires still compile)
- `nx build angular-typechecker` -> pass
- `tools/act/act-compat.sh` (Docker) -> 14 passed / 0 failed, incl. `ci/format-lint SELECTED`
- Workflows Prettier-clean + valid YAML; actionlint deferred to the CI `lint-workflows` job.

## Follow-ups

- Close/let Dependabot auto-close PRs #1 and #2 after this lands.
- A PR that changes real source/config/docs must be Prettier-clean (the format-lint
  gate checks PR-changed files via nx-set-shas base/head). NOTE: `.planning/` is NO
  LONGER gated -- it was excluded from Prettier after review (see Post-review updates),
  so GSD planning churn no longer needs a format pass.

## Post-review updates (2026-07-01)

- **Code review** (`260701-shh-REVIEW.md`, deep: 0 blockers / 1 warning / 3 info).
  WR-01 fixed by granting `format-lint` a read-only `actions: read` for nx-set-shas'
  push-path base derivation (commit f406123); IN-01 ci.yml comment reworded to "every
  project that defines a lint target" (f406123); IN-02/IN-03 accepted as-is.
- **`.planning/` de-scoped from Prettier** (commits 9d132b2 + 53a0c4a). GSD emits
  unformatted planning markdown every phase, so gating it created per-PR friction for
  no benefit; `.planning/` is now in `.prettierignore` and this task's `.planning`
  format churn (340 files) was reverted. Real source/config/docs + the 3
  diagnostic-neutral fixture templates remain Prettier-formatted. This revises the
  original "format the entire repo" scope.
- **CI-verified** via draft PR #14 (opened then closed). All task-relevant jobs
  passed: format-lint, act-compat, lint-workflows, the full 6-cell test matrix, e2e,
  and CodeQL. Only fallow failed -- Phase 12-13 milestone WIP (new-only vs origin/main),
  not this task.
