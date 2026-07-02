---
quick_id: 260701-shh
description: Add CI format:check + lint jobs (nx-set-shas base/head), bake maxWarnings:0, format whole repo, bump outdated actions
date: 2026-07-01
branch: gsd/v0.0.4-typecheck-generator-and-extended-testing
mode: quick
---

# Quick Task 260701-shh: CI format:check + lint gates, whole-repo format, action bumps

## Task Boundary

Four coupled changes, all on the current `gsd/v0.0.4-...` branch (user-confirmed):

1. **Add CI jobs/steps** for `nx format:check` and `nx run-many -t lint`, using
   `nrwl/nx-set-shas` to derive `--base`/`--head` for `format:check`.
2. **Resolve existing lint + formatting issues** (user directive). Prettier has
   never been run here: `nx format:check` flags ~380 files. User chose to
   **format the entire repo**. `nx run-many -t lint` emits 2 warnings.
3. **Enforce `maxWarnings: 0`** by baking it into the `@nx/eslint:lint`
   targetDefaults in `nx.json` (user directive: do NOT pass the flag in CI if it
   can be avoided -- the target inherits it, so `nx run-many -t lint` enforces it).
4. **Update outdated GitHub Actions** per Dependabot: `actions/checkout`
   5.0.1 -> 7.0.0, `actions/setup-node` 5.0.0 -> 6.4.0 (SHA-pinned).

## Locked Decisions

- **Format scope:** whole repo (`nx format:write`). Verify no regressions by
  running the full `angular-typechecker` test + `typecheck-drift` suite after
  (fixtures carry exact diagnostic-count assertions).
- **Lockfile exception:** add `pnpm-lock.yaml` / `package-lock.json` to
  `.prettierignore`. Prettier must never rewrite a generated lockfile (integrity
  - matrix-e2e risk). The one deliberate deviation from "format everything".
- **maxWarnings:** `nx.json` `targetDefaults."@nx/eslint:lint".options.maxWarnings = 0`.
  No `--max-warnings` flag in CI.
- **Lint-warning fix:** the 2 warnings are the phantom `To` type parameter in
  `AssertAssignable<From, To extends From> = true` (drift tripwires). Resolve
  with a scoped `eslint-disable-next-line @typescript-eslint/no-unused-vars`
  - reason -- preserves the tripwire's `= true` design; `To`'s `extends From`
    constraint IS the assertion.
- **CI job shape:** one new `format-lint` job (Linux, Node 24), path-gated
  (`needs: changes`, `if: code != 'false'`) like `test`/`e2e`/`fallow`, folded
  into the `ci` aggregate `needs`. `fetch-depth: 0` for nx-set-shas. No per-job
  permissions (nx-set-shas falls back to HEAD~1 on push when it cannot read
  Actions runs under the top-level `contents: read`; PRs work fully).
- **act-compat:** add a `ci/format-lint` SELECTED assertion to the PR plan in
  `tools/act/act-compat.sh` (mirrors every other ci job's assertion).
- **Pins:** checkout v7.0.0 `9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0`;
  setup-node v6.4.0 `48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e`;
  nx-set-shas v5.0.1 `afb73a62d26e41464e9254689e1fd6122ee683c1` (annotated-tag
  dereferenced to the commit SHA).

## must_haves

- truths:
  - CI runs `nx format:check` (base/head from nx-set-shas) and `nx run-many -t lint`.
  - `nx run-many -t lint` fails on ANY warning (maxWarnings:0 inherited from target).
  - `nx format:check` is green repo-wide.
  - No action reference in ci.yml/release.yml is older than the Dependabot target.
- artifacts:
  - `.github/workflows/ci.yml` (new `format-lint` job + ci aggregate + bumped pins)
  - `.github/workflows/release.yml` (bumped pins)
  - `nx.json` (maxWarnings:0)
  - `.prettierignore` (lockfile exception)
  - `tools/act/act-compat.sh` (format-lint assertion)

## Tasks

### Task 1 -- Lockfile ignore + whole-repo format (commits: chore + style)

- files: `.prettierignore`, ~379 repo files
- action: add lockfile patterns to `.prettierignore`; run `npx nx format:write`.
- verify: `npx nx run-many -t test -p angular-typechecker` + `npx nx typecheck-drift angular-typechecker` green; `git diff` on `pnpm-lock.yaml` empty.
- done: fixtures/specs reformatted with zero test regressions.

### Task 2 -- Clear lint warnings + enforce maxWarnings:0 (commit: chore(lint))

- files: `packages/angular-typechecker/src/core/compiler-cli-types.drift.ts`, `.../extended-catalog.drift.ts`, `nx.json`
- action: add `eslint-disable-next-line` + reason above each `AssertAssignable`; set `maxWarnings: 0` in `@nx/eslint:lint` targetDefaults.
- verify: `npx nx run-many -t lint` (no flag) green with 0 warnings.
- done: zero-warning lint enforced from the target.

### Task 3 -- Bump outdated actions (commit: chore(deps))

- files: `.github/workflows/ci.yml`, `.github/workflows/release.yml`
- action: replace all `actions/checkout@<v5.0.1 sha>` -> v7.0.0 sha; `actions/setup-node@<v5.0.0 sha>` -> v6.4.0 sha (comments updated).
- verify: no v5.0.1 checkout / v5.0.0 setup-node references remain.
- done: pins match the Dependabot targets.

### Task 4 -- Add format-lint CI job + act assertion (commit: ci)

- files: `.github/workflows/ci.yml`, `tools/act/act-compat.sh`
- action: add `format-lint` job (checkout fetch-depth:0, setup-node, nx-set-shas, npm ci, format:check --base/--head, run-many lint); add to `ci` needs; add `ci/format-lint` PR assertion in act-compat.sh.
- verify: `actionlint` (via CI lint-workflows) + local `tools/act/act-compat.sh` (Docker) green; YAML parses.
- done: gate wired into the required `ci` aggregate.

## Verification gate (final, on the branch tip)

- `npx nx format:check` -> exit 0
- `npx nx run-many -t lint` -> exit 0, 0 warnings
- `npx nx run-many -t test -p angular-typechecker` -> green
- `npx nx typecheck-drift angular-typechecker` -> green
- `npx nx build angular-typechecker` -> green
- `tools/act/act-compat.sh` -> PASSED (local, Docker)
