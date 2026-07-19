---
phase: 260719-kbj
plan: 01
status: complete
subsystem: tooling
one_liner: "Upgraded the CI code-quality gate from Fallow 2.103.0 to Fallow 3 (3.6.0) with zero breaking changes -- our advanced .fallowrc.jsonc setup and audit --gate new-only strategy fully preserved; migration was an exact-pin bump + lockfile refresh + one config line for the new v3.1.0 dev-dependencies-in-production warn rule."
tags: [fallow, fallow-3, deps, code-quality-gate, ci, opengsd, migration]
requirements_completed: fallow-3-migration
key_files:
  modified:
    - package.json
    - package-lock.json
    - .fallowrc.jsonc
    - .planning/PROJECT.md
    - .planning/codebase/STACK.md
commit: cf7b86f
verification: passed
---

# Quick Task 260719-kbj: Update to Fallow 3

## What changed

| File | Change |
|------|--------|
| `package.json` (root) | devDep `fallow` `2.103.0` -> `3.6.0` (EXACT pin, no `^`/`~`). npm script unchanged (`fallow audit --format human --base origin/main`). |
| `package-lock.json` | Refreshed via `npm install` -- `fallow` + the 8 `@fallow-cli/*` platform packages -> `3.6.0`. Diff scoped to fallow only; no unrelated churn. |
| `.fallowrc.jsonc` | Added `"dev-dependencies-in-production": "off"` to `rules` (FAL-13) -- silences the new v3.1.0 warn rule's 6 non-published false positives. Every other key preserved unchanged. |
| `.planning/PROJECT.md`, `.planning/codebase/STACK.md` | Current-state tech-stack version references `fallow@2.103.0` -> `fallow@3.6.0`. Historical v0.0.3 adoption records left as-is. |

**NO change** to `.github/workflows/ci.yml` (the `fallow audit --format human --base origin/main`
job works identically on 3.6.0), `.planning/config.json`, or the published package manifest.

## Why this was a trivial, faithful migration

Research (`260719-kbj-RESEARCH.md`, HIGH confidence -- ran the real 3.6.0 win32-arm64 binary
against our repo) found **Fallow 3.0.0 ships zero breaking changes**: "CLI flags, configuration,
and JSON output contracts are all unchanged" (github.com/fallow-rs/fallow/releases/tag/v3.0.0).
The major bump only marks CSS analysis landing in `fallow audit`. Every `.fallowrc.jsonc` key we
use (`entry`, `ignoreExports`, `ignoreDependencies`, `rules`, `health`, `overrides`, `duplicates`,
`audit`) is still valid under the 3.6.0 `deny_unknown_fields` loader, and no rule we scope was
renamed.

Per the user's steer, the `op-nx/github-cache` reference (which uses whole-repo
`dead-code --fail-on-issues`) is only a minimal OpenGSD-check example; we **kept our advanced
setup** -- the richer config and the `audit --gate new-only` diff-based strategy (which also gates
complexity + duplication, unlike `dead-code`). Its `ignorePatterns` key is a distinct v3/v2 key,
not a rename of anything we use.

## Verification (run inline -- research collapsed this to a version bump, so no extra agent pipeline)

- `npx fallow --version` -> `fallow 3.6.0 signed` (win32-arm64 binary verified).
- `npm run fallow` (= `fallow audit --format human --base origin/main`, new-only gate) -> **exit 0**,
  "No issues in 196 changed files". The 6 `dev-dependencies-in-production` warns are silenced by
  FAL-13, so the report is clean.
- Lockfile diff scope check -> only `fallow` + `@fallow-cli/*` changed; zero unrelated packages.
- `npx prettier --check package.json .fallowrc.jsonc` -> clean.
- `npm install` -> exit 0, 0 vulnerabilities (the `allow-scripts` warnings are pre-existing, unrelated).

## Scope

Tooling/CI-gate only. No product source, no committed tests, no version change (stays `0.2.2`;
the bump touches the ROOT package.json, not the published `packages/angular-typechecker`, so
`nx release` attribution is unaffected). `chore(deps)` is a no-bump conventional-commit type.
