---
task: 260705-1wo
title: resolve the e2e tsconfig inject()->never issue + add a CI typecheck gate for the e2e projects
type: quick
status: complete
completed: 2026-07-05
branch: test/nx-add-e2e-pnpm-yarn
commits:
  - 7764803 fix(e2e): type-check install-e2e global-setup with vitest 4 TestProject
  - 7549e65 ci(e2e): add typecheck-e2e gate for the e2e projects
files_modified:
  - e2e/angular-typechecker-install-e2e/src/global-setup.ts
  - e2e/angular-typechecker-install-e2e/tsconfig.spec.json
  - e2e/angular-typechecker-install-e2e/project.json
  - e2e/angular-typechecker-cache-e2e/project.json
  - e2e/angular-typechecker-matrix-e2e/project.json
  - .github/workflows/ci.yml
---

# Quick Task 260705-1wo: Resolve e2e tsconfig inject()->never + add a CI typecheck gate

## One-liner

Fixed the latent `inject()`->`never` type errors on every install-e2e spec (vitest-4
`GlobalSetupContext`->`TestProject` + include `global-setup.ts` in the spec program) and
added a `typecheck-e2e` `nx:run-commands` gate to all three e2e projects, wired into the
existing CI `e2e` job with a `-p`-less `nx run-many` step so GUARD-01 stays untouched.

## What was done

### Task 1 -- fix the install-e2e type errors (commit 7764803)

- `e2e/angular-typechecker-install-e2e/src/global-setup.ts`
  - line 5: `import type { GlobalSetupContext } from 'vitest/node';` ->
    `import type { TestProject } from 'vitest/node';`
  - line 68: default-export signature param `{ provide }: GlobalSetupContext` ->
    `{ provide }: TestProject`
  - the `declare module 'vitest' { interface ProvidedContext {...} }` augmentation
    (lines 187-192) was left exactly in place (single augmentation source; no ambient
    `.d.ts` added).
- `e2e/angular-typechecker-install-e2e/tsconfig.spec.json`
  - appended `"src/global-setup.ts"` to `include` so the augmentation enters the tsc
    program and `keyof ProvidedContext` resolves (no longer `never`). Prettier broke the
    now-over-80-char array multi-line (matches what `prettier --check` expects).

Root cause (per RESEARCH, not re-derived): the spec tsconfig omitted `global-setup.ts`,
so the `ProvidedContext` augmentation was out of the program, leaving `keyof
ProvidedContext` = `never`; including the file surfaced the second latent error -- the
vitest-4-removed `GlobalSetupContext` import (successor `TestProject`, exported from
`vitest/node`).

### Task 2 -- add the typecheck-e2e gate + wire CI (commit 7549e65)

- Added a `typecheck-e2e` target to all three e2e `project.json` files (install / cache /
  matrix): `executor: nx:run-commands`, `cache: true`, `inputs: ["default", "^default",
  "{workspaceRoot}/tsconfig.base.json", { "externalDependencies": ["typescript",
  "vitest"] }]`, `options.command = tsc --noEmit -p e2e/<project>/tsconfig.spec.json`,
  `cwd: "."`, `outputs` omitted (defaults to `[]`; `--noEmit` writes nothing). Modeled on
  the plugin's `typecheck-drift` target. No `nx.json` targetDefault added.
- `.github/workflows/ci.yml`: inserted one step into the EXISTING `e2e` job between
  `- run: npm ci` and the folded `- run: > npx nx run-many -t test ... --parallel=1` step:
  `- run: npx nx run-many -t typecheck-e2e` (no `-p` list). No other CI job touched; the
  `ci` aggregate `needs` array is unchanged (`e2e` is already a need and already
  code-path-gated).

The step is deliberately `-p`-less: `run-many -t typecheck-e2e` runs for exactly the three
projects that define the target, so there is no second `-p` list to drift and GUARD-01's
`.find(/^\s*-p\s+\S/)` still selects the folded test-scalar's `-p` list.

## Verification (authoritative signals: tsc + test runner, not the LSP)

| Check | Result |
| ----- | ------ |
| `tsc --noEmit -p e2e/angular-typechecker-install-e2e/tsconfig.spec.json` | **exit 0** (after the fix; baseline was exit 2 with 12 inject()->never errors) |
| `nx run-many -t typecheck-e2e --skip-nx-cache` | **all 3 green (exit 0)** -- angular-typechecker-install-e2e, angular-typechecker-cache-e2e, angular-typechecker-matrix-e2e each `tsc --noEmit` exit 0 |
| `nx test angular-typechecker-install-e2e --skip-nx-cache` | **9 files / 32 tests pass, exit 0** -- runtime unchanged by the type-only edit |
| GUARD-01 / GUARD-01b (`ci-e2e-coverage-guard.spec.ts`) | **4 tests pass** -- the `-p`-less typecheck step left the `-p` find() selecting the test scalar's list |
| `nx run-many -t lint` | **clean (exit 0)** -- maxWarnings:0 |
| `nx format:check --base=main` + `prettier --check` (changed files) | **clean (exit 0)** |
| ci.yml YAML parse + step order | e2e job run steps: corepack enable -> npm ci -> `npx nx run-many -t typecheck-e2e` -> folded test run-many (correct placement) |

Notes:
- The install-e2e run prints `NX Running target typecheck for project consumer-app
  failed` inside `generator-e2e.int.spec.ts` -- that is the spec's INTENTIONAL
  negative-path assertion ("fails with BOTH leaf codes on two-leaf injection"); the test
  itself passed. `local registry exit 143` on teardown is the known benign Windows SIGTERM
  double-fork edge (CI is Linux-only).
- actionlint is not installed locally; ci.yml was validated by a Python YAML parse and the
  structural GUARD specs. CI's `lint-workflows` job runs actionlint on the PR.

## Scope / constraints honored

- Stayed on branch `test/nx-add-e2e-pnpm-yarn`; no new branch, no worktree (main-tree,
  real node_modules).
- No dependency added, no `nx.json` change, no other CI job touched, no `ci` needs-array
  change, cache-e2e/matrix-e2e sources + tsconfigs untouched.
- Two atomic Conventional-Commit commits (fix / ci), no AI attribution; files staged by
  name.
- None of these files live under `packages/angular-typechecker/`, so no published-package
  version bump (no release/tag/publish work).

## Deviations from plan

None -- plan executed exactly as written.

## Self-Check: PASSED

- FOUND: e2e/angular-typechecker-install-e2e/src/global-setup.ts (imports TestProject)
- FOUND: e2e/angular-typechecker-install-e2e/tsconfig.spec.json (include has src/global-setup.ts)
- FOUND: e2e/angular-typechecker-install-e2e/project.json (typecheck-e2e target)
- FOUND: e2e/angular-typechecker-cache-e2e/project.json (typecheck-e2e target)
- FOUND: e2e/angular-typechecker-matrix-e2e/project.json (typecheck-e2e target)
- FOUND: .github/workflows/ci.yml (run-many -t typecheck-e2e step)
- FOUND commit: 7764803 (fix)
- FOUND commit: 7549e65 (ci)
