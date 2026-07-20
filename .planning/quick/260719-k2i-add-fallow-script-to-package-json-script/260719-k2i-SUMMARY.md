---
phase: 260719-k2i
plan: 01
status: complete
subsystem: tooling
one_liner: "Added an `npm run fallow` script to the root package.json mirroring the CI new-only code-quality gate verbatim, so the CI-only fallow check is reproducible locally with one command."
tags: [fallow, dx, npm-scripts, ci-parity, code-quality-gate]
requirements_completed: DX-fallow-script
key_files:
  modified:
    - package.json
commit: 7196ab0
verification: passed
---

# Quick Task 260719-k2i: Add `fallow` script to package.json#scripts

## What changed

Added one script entry to the root `package.json` (`@angular-typechecker/source`):

```json
"fallow": "fallow audit --format human --base origin/main"
```

Placed after `format:check`, alongside the other verification scripts. Uses the bare
`fallow` bin (not `npx`) to match the existing `nx`-based scripts — npm puts
`node_modules/.bin` on `PATH`, and `fallow` is already a pinned root devDependency
(`2.103.0`).

## Why

`fallow` is a **CI-only** code-quality gate (`.github/workflows/ci.yml:350`, `.fallowrc.jsonc`
`audit.gate: new-only`) that local `nx lint` does **not** run. That gap is exactly how the
complexity/duplication regressions in quick task 260719-iib passed every local check yet
failed CI. `npm run fallow` now reproduces the CI gate locally with one command, before
pushing.

## Verification (run inline — this was a one-line change, so no separate agent pipeline)

- `npm run fallow` -> exit **0**, "No issues in 192 changed files" (the command resolves the
  bare bin and runs the exact CI new-only gate). The two `WARN Broken tsconfig chain` lines
  are the pre-existing intentional broken-ref/self-ref test fixtures, unrelated to this change.
- `npx prettier --check package.json` -> "All matched files use Prettier code style!"

## Scope

Tooling/DX only. No product source, no committed tests, no version change (stays `0.2.2`).
The command mirrors `ci.yml:350` verbatim, so it cannot drift from the gate it reproduces.
